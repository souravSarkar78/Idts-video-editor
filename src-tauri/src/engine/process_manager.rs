//! Process Manager & Sidecar Zombie Killer
//!
//! Tracks all active FFmpeg, FFprobe, and Whisper worker child process IDs (PIDs).
//! Cascades process termination on window close, application exit, or project reset
//! to guarantee zero orphaned zombie processes consuming system CPU and RAM.

use std::collections::HashMap;
use std::sync::{Arc, Mutex, OnceLock};
use crate::models::ipc::ProcessHealthStats;

#[derive(Debug, Clone)]
pub struct TrackedProcess {
    pub pid: u32,
    pub description: String,
    pub started_at: std::time::Instant,
}

#[derive(Default)]
pub struct ProcessRegistry {
    processes: HashMap<u32, TrackedProcess>,
    total_spawned: u64,
}

static REGISTRY: OnceLock<Arc<Mutex<ProcessRegistry>>> = OnceLock::new();

fn get_registry() -> &'static Arc<Mutex<ProcessRegistry>> {
    REGISTRY.get_or_init(|| Arc::new(Mutex::new(ProcessRegistry::default())))
}

/// Registers a child process PID for lifecycle tracking.
pub fn register_process(pid: u32, description: &str) {
    if let Ok(mut reg) = get_registry().lock() {
        reg.processes.insert(
            pid,
            TrackedProcess {
                pid,
                description: description.to_string(),
                started_at: std::time::Instant::now(),
            },
        );
        reg.total_spawned += 1;
        #[cfg(debug_assertions)]
        eprintln!("[ProcessManager] Registered sidecar PID {} ({})", pid, description);
    }
}

/// Unregisters a completed child process PID.
pub fn unregister_process(pid: u32) {
    if let Ok(mut reg) = get_registry().lock() {
        reg.processes.remove(&pid);
        #[cfg(debug_assertions)]
        eprintln!("[ProcessManager] Unregistered PID {}", pid);
    }
}

/// Retrieves the current process health statistics.
pub fn get_health_stats() -> ProcessHealthStats {
    if let Ok(reg) = get_registry().lock() {
        ProcessHealthStats {
            active_sidecar_pids: reg.processes.keys().copied().collect(),
            active_process_count: reg.processes.len(),
            total_spawned_count: reg.total_spawned,
        }
    } else {
        ProcessHealthStats {
            active_sidecar_pids: Vec::new(),
            active_process_count: 0,
            total_spawned_count: 0,
        }
    }
}

/// Forcefully terminates all tracked active child processes across Windows/macOS/Linux.
pub fn kill_all_active_processes() {
    let pids: Vec<(u32, String)> = {
        if let Ok(mut reg) = get_registry().lock() {
            let list = reg
                .processes
                .values()
                .map(|p| (p.pid, p.description.clone()))
                .collect();
            reg.processes.clear();
            list
        } else {
            Vec::new()
        }
    };

    for (pid, desc) in pids {
        eprintln!("[ProcessManager] Terminating zombie process PID {} ({})", pid, desc);
        kill_pid(pid);
    }
}

/// Kills a single process and its child tree safely.
pub fn kill_pid(pid: u32) {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        // Taskkill /F /T kills the entire process tree cleanly
        let _ = std::process::Command::new("taskkill")
            .args(["/F", "/T", "/PID", &pid.to_string()])
            .creation_flags(0x08000000) // CREATE_NO_WINDOW
            .output();
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = std::process::Command::new("kill")
            .args(["-9", &pid.to_string()])
            .output();
    }
}
