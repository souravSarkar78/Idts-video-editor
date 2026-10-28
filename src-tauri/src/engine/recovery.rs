//! Crash Recovery, Atomic Auto-Save & Emergency State Dumps
//!
//! Provides atomic auto-save snapshots to `%LOCALAPPDATA%/idts-video-editor/recovery/`,
//! dirty exit detection on application startup, and emergency state dumps on unexpected panic.

use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex, OnceLock};
use chrono::Utc;
use crate::models::ipc::{AutosaveSnapshotInfo, RecoveryCheckResult};
use crate::models::project::ProjectData;

static LAST_KNOWN_PROJECT: OnceLock<Arc<Mutex<Option<ProjectData>>>> = OnceLock::new();

fn get_last_project_store() -> &'static Arc<Mutex<Option<ProjectData>>> {
    LAST_KNOWN_PROJECT.get_or_init(|| Arc::new(Mutex::new(None)))
}

/// Resolves the dedicated recovery folder on local disk.
pub fn get_recovery_dir() -> PathBuf {
    #[cfg(target_os = "windows")]
    {
        if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
            let p = PathBuf::from(local_app_data)
                .join("idts-video-editor")
                .join("recovery");
            let _ = fs::create_dir_all(&p);
            return p;
        }
    }

    let fallback = std::env::temp_dir()
        .join("idts-video-editor")
        .join("recovery");
    let _ = fs::create_dir_all(&fallback);
    fallback
}

/// Path to the active session lock file.
fn get_session_lock_path() -> PathBuf {
    get_recovery_dir().join(".session_active")
}

/// Marks the beginning of a live editing session.
pub fn mark_session_active() {
    let lock_path = get_session_lock_path();
    let info = format!("pid={}\nstart={}", std::process::id(), Utc::now().to_rfc3339());
    let _ = fs::write(lock_path, info);
}

/// Marks a clean application shutdown by removing the session lock file.
pub fn mark_session_clean_exit() {
    let lock_path = get_session_lock_path();
    if lock_path.exists() {
        let _ = fs::remove_file(lock_path);
    }
}

/// Keeps an in-memory snapshot of the latest project state for emergency panic dumping.
pub fn update_cached_project_state(project: &ProjectData) {
    if let Ok(mut store) = get_last_project_store().lock() {
        *store = Some(project.clone());
    }
}

/// Executes an atomic auto-save of the active timeline state.
/// Writes to a temporary file first before atomically replacing `.idts.bak`.
pub fn atomic_autosave(project: &ProjectData) -> Result<AutosaveSnapshotInfo, String> {
    update_cached_project_state(project);

    let recovery_dir = get_recovery_dir();
    let sanitized_id = if project.metadata.id.trim().is_empty() {
        "untitled".to_string()
    } else {
        project
            .metadata
            .id
            .chars()
            .map(|c| if c.is_alphanumeric() || c == '-' || c == '_' { c } else { '_' })
            .collect::<String>()
    };

    let target_filename = format!("autosave_{}.idts.bak", sanitized_id);
    let temp_filename = format!("autosave_{}.tmp", sanitized_id);

    let target_path = recovery_dir.join(&target_filename);
    let temp_path = recovery_dir.join(&temp_filename);

    let serialized = serde_json::to_string_pretty(project)
        .map_err(|e| format!("Failed to serialize auto-save snapshot: {}", e))?;

    // 1. Write to temp file
    fs::write(&temp_path, serialized)
        .map_err(|e| format!("Failed to write temporary auto-save file: {}", e))?;

    // 2. Atomic rename to target
    #[cfg(target_os = "windows")]
    {
        // On Windows rename will fail if target exists, so remove existing first if needed
        if target_path.exists() {
            let _ = fs::remove_file(&target_path);
        }
    }

    fs::rename(&temp_path, &target_path)
        .map_err(|e| format!("Failed to atomically commit auto-save: {}", e))?;

    let timestamp = Utc::now().to_rfc3339();

    Ok(AutosaveSnapshotInfo {
        project_id: project.metadata.id.clone(),
        project_name: project.metadata.name.clone(),
        timestamp,
        file_path: target_path.to_string_lossy().to_string(),
        is_dirty_exit: false,
    })
}

/// Checks if a previous session terminated unexpectedly (crash / dirty exit)
/// and locates the most recent auto-save snapshot available.
pub fn check_for_recovery_snapshot() -> RecoveryCheckResult {
    let session_lock = get_session_lock_path();
    let is_dirty = session_lock.exists();

    let recovery_dir = get_recovery_dir();
    let mut latest_file: Option<(PathBuf, std::time::SystemTime)> = None;

    if let Ok(entries) = fs::read_dir(&recovery_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            let name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
            if (name.starts_with("autosave_") && name.ends_with(".idts.bak"))
                || (name.starts_with("emergency_dump_") && name.ends_with(".idts"))
            {
                if let Ok(meta) = entry.metadata() {
                    if let Ok(modified) = meta.modified() {
                        if latest_file.as_ref().map_or(true, |(_, m)| modified > *m) {
                            latest_file = Some((path, modified));
                        }
                    }
                }
            }
        }
    }

    if let Some((path, _)) = latest_file {
        if let Ok(content) = fs::read_to_string(&path) {
            if let Ok(project) = serde_json::from_str::<ProjectData>(&content) {
                return RecoveryCheckResult {
                    has_recovery: true,
                    snapshot: Some(AutosaveSnapshotInfo {
                        project_id: project.metadata.id,
                        project_name: project.metadata.name,
                        timestamp: project.metadata.modified_at,
                        file_path: path.to_string_lossy().to_string(),
                        is_dirty_exit: is_dirty,
                    }),
                };
            }
        }
    }

    RecoveryCheckResult {
        has_recovery: false,
        snapshot: None,
    }
}

/// Restores the project data from a recovery snapshot file path.
pub fn restore_snapshot(file_path: &str) -> Result<ProjectData, String> {
    let path = Path::new(file_path);
    if !path.exists() {
        return Err(format!("Snapshot file not found: {}", file_path));
    }

    let content = fs::read_to_string(path)
        .map_err(|e| format!("Failed to read snapshot file: {}", e))?;

    let project: ProjectData = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse recovered project: {}", e))?;

    // Mark current session active again
    mark_session_active();

    Ok(project)
}

/// Discards recovery state and cleans up snapshot files.
pub fn discard_snapshot(file_path: Option<String>) -> Result<(), String> {
    if let Some(path_str) = file_path {
        let p = Path::new(&path_str);
        if p.exists() {
            let _ = fs::remove_file(p);
        }
    }
    // Also remove the lock if present
    mark_session_clean_exit();
    mark_session_active(); // Re-arm for current session
    Ok(())
}

/// Registers panic hook to dump project state to disk if an unhandled panic occurs.
pub fn install_panic_hook() {
    let default_hook = std::panic::take_hook();
    std::panic::set_hook(Box::new(move |panic_info| {
        eprintln!("[Emergency Recovery] Panic detected! Writing emergency state dump...");
        if let Ok(store) = get_last_project_store().lock() {
            if let Some(ref project) = *store {
                let recovery_dir = get_recovery_dir();
                let dump_file = recovery_dir.join(format!(
                    "emergency_dump_{}.idts",
                    Utc::now().format("%Y%m%d_%H%M%S")
                ));
                if let Ok(serialized) = serde_json::to_string_pretty(project) {
                    let _ = fs::write(dump_file, serialized);
                }
            }
        }
        // Also terminate any active sidecar child processes so they don't linger
        crate::engine::process_manager::kill_all_active_processes();

        default_hook(panic_info);
    }));
}
