//! Antigravity Desktop Video Editor Library
//!
//! Entry point for Tauri 2.0 desktop application backend.

pub mod engine;
pub mod models;
pub mod sync;

use std::path::Path;
use engine::audio::get_waveform_data;
use engine::ffmpeg::execute_export;
use engine::metadata::probe_media_file;
use models::ipc::{ClipMetadata, ExportConfig, SyncPreset, SyncRequest, SyncResult, TrackSyncOffset};
use models::project::ProjectData;
use models::settings::AppPreferences;
use sync::audio_correlate::sync_by_audio;
use sync::{parse_camera_filename, sync_active_timeline_tracks, sync_tracks_by_filename, ParsedTimestamp};

/// Supported media extensions for video and audio import
const SUPPORTED_EXTENSIONS: &[&str] = &[
    "mp4", "mov", "mkv", "avi", "webm", "m4v",
    "wav", "mp3", "aac", "m4a", "flac", "ogg",
];

/// Helper to recursively collect supported media files in a directory
fn scan_folder_recursive(dir: &Path, media_files: &mut Vec<String>) {
    if let Ok(entries) = std::fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                scan_folder_recursive(&path, media_files);
            } else if path.is_file() {
                if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
                    let ext_lower = ext.to_lowercase();
                    if SUPPORTED_EXTENSIONS.contains(&ext_lower.as_str()) {
                        media_files.push(path.to_string_lossy().to_string());
                    }
                }
            }
        }
    }
}

/// Prompts native Windows file picker supporting standard video and audio formats
#[tauri::command]
fn open_file_dialog() -> Result<Vec<String>, String> {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        let ps_script = r#"
            Add-Type -AssemblyName System.Windows.Forms
            $d = New-Object System.Windows.Forms.OpenFileDialog
            $d.Multiselect = $true
            $d.Filter = "Media Files (*.mp4;*.mov;*.mkv;*.avi;*.wav;*.mp3)|*.mp4;*.mov;*.mkv;*.avi;*.wav;*.mp3|All Files (*.*)|*.*"
            if ($d.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
                $d.FileNames | ForEach-Object { Write-Output $_ }
            }
        "#;

        let output = std::process::Command::new("powershell")
            .args(["-NoProfile", "-NonInteractive", "-Command", ps_script])
            .creation_flags(0x08000000) // CREATE_NO_WINDOW
            .output()
            .map_err(|e| format!("Failed to launch file picker dialog: {}", e))?;

        let out_str = String::from_utf8_lossy(&output.stdout);
        let files: Vec<String> = out_str
            .lines()
            .map(|l| l.trim().to_string())
            .filter(|l| !l.is_empty())
            .collect();

        Ok(files)
    }

    #[cfg(not(target_os = "windows"))]
    {
        Ok(Vec::new())
    }
}

/// Prompts native Windows folder picker and reads all supported video/audio files recursively
#[tauri::command]
fn open_folder_dialog() -> Result<Vec<String>, String> {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        let ps_script = r#"
            Add-Type -AssemblyName System.Windows.Forms
            $d = New-Object System.Windows.Forms.FolderBrowserDialog
            $d.Description = "Select Folder to Import Media"
            $d.ShowNewFolderButton = $false
            if ($d.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
                Write-Output $d.SelectedPath
            }
        "#;

        let output = std::process::Command::new("powershell")
            .args(["-NoProfile", "-NonInteractive", "-Command", ps_script])
            .creation_flags(0x08000000) // CREATE_NO_WINDOW
            .output()
            .map_err(|e| format!("Failed to launch folder picker dialog: {}", e))?;

        let folder_path = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if folder_path.is_empty() {
            return Ok(Vec::new());
        }

        let mut media_files = Vec::new();
        scan_folder_recursive(Path::new(&folder_path), &mut media_files);
        media_files.sort();
        Ok(media_files)
    }

    #[cfg(not(target_os = "windows"))]
    {
        Ok(Vec::new())
    }
}

/// Prompts native Windows save file picker for video export destination
#[tauri::command]
fn save_file_dialog(default_path: Option<String>) -> Result<Option<String>, String> {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        let (initial_dir, file_name) = match default_path {
            Some(ref p) if !p.trim().is_empty() => {
                let path = Path::new(p);
                let dir = path.parent().map(|d| d.to_string_lossy().to_string()).unwrap_or_default();
                let file = path.file_name().map(|f| f.to_string_lossy().to_string()).unwrap_or_else(|| "Master_Render.mp4".to_string());
                (dir, file)
            }
            _ => (String::new(), "Master_Render.mp4".to_string()),
        };

        let initial_dir_escaped = initial_dir.replace('"', "`\"");
        let file_name_escaped = file_name.replace('"', "`\"");

        let ps_script = format!(
            r#"
            Add-Type -AssemblyName System.Windows.Forms
            $d = New-Object System.Windows.Forms.SaveFileDialog
            $d.Title = "Select Export Video Destination"
            $d.Filter = "MP4 Video (*.mp4)|*.mp4|QuickTime Movie (*.mov)|*.mov|MKV Video (*.mkv)|*.mkv|All Files (*.*)|*.*"
            $d.DefaultExt = "mp4"
            $d.AddExtension = $true
            if ("{dir}" -ne "") {{ $d.InitialDirectory = "{dir}" }}
            $d.FileName = "{name}"
            if ($d.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {{
                Write-Output $d.FileName
            }}
            "#,
            dir = initial_dir_escaped,
            name = file_name_escaped
        );

        let output = std::process::Command::new("powershell")
            .args(["-Sta", "-NoProfile", "-NonInteractive", "-Command", &ps_script])
            .creation_flags(0x08000000) // CREATE_NO_WINDOW
            .output()
            .map_err(|e| format!("Failed to launch save file dialog: {}", e))?;

        let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if path.is_empty() {
            Ok(None)
        } else {
            Ok(Some(path))
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        Ok(None)
    }
}

/// Prompts native file picker for a 3D LUT (.cube) file
#[tauri::command]
fn open_lut_dialog() -> Result<Option<String>, String> {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        let ps_script = r#"
            Add-Type -AssemblyName System.Windows.Forms
            $d = New-Object System.Windows.Forms.OpenFileDialog
            $d.Title = "Select 3D LUT File"
            $d.Filter = "3D LUT Files (*.cube)|*.cube|All Files (*.*)|*.*"
            $d.Multiselect = $false
            if ($d.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
                Write-Output $d.FileName
            }
        "#;

        let output = std::process::Command::new("powershell")
            .args(["-Sta", "-NoProfile", "-NonInteractive", "-Command", ps_script])
            .creation_flags(0x08000000)
            .output()
            .map_err(|e| format!("Failed to launch LUT picker dialog: {}", e))?;

        let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if path.is_empty() {
            Ok(None)
        } else {
            Ok(Some(path))
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        Ok(None)
    }
}

/// Extracts a 16:9 downscaled preview frame at timestamp_sec and returns base64 data URI
#[tauri::command]
fn capture_preview_frame(source_path: String, timestamp_sec: f64) -> Result<String, String> {
    crate::engine::thumbnail::capture_preview_frame(source_path, timestamp_sec)
}

/// Retrieves the complete built-in filter and 3D LUT category hierarchy
#[tauri::command]
fn get_filter_catalog() -> Result<Vec<crate::models::filters::FilterCategory>, String> {
    Ok(crate::models::filters::get_built_in_categories(0))
}

/// Retrieves filter presets, optionally filtered by category
#[tauri::command]
fn get_filter_presets(category: Option<String>) -> Result<Vec<crate::models::filters::FilterPreset>, String> {
    let presets = crate::models::filters::get_built_in_presets();
    if let Some(cat) = category {
        if cat == "all" || cat.is_empty() {
            Ok(presets)
        } else {
            Ok(presets.into_iter().filter(|p| p.category == cat).collect())
        }
    } else {
        Ok(presets)
    }
}

/// Probes metadata for a list of file paths using ffprobe sidecar
#[tauri::command]
fn get_clip_metadata(paths: Vec<String>) -> Vec<ClipMetadata> {
    paths
        .into_iter()
        .map(|path| match probe_media_file(&path) {
            Ok(meta) => meta,
            Err(_) => ClipMetadata {
                duration_seconds: 10.0,
                width: Some(1920),
                height: Some(1080),
                framerate: Some(30.0),
                codec: Some("h264".to_string()),
                ..Default::default()
            },
        })
        .collect()
}

/// Computes multi-track relative timeline synchronization offsets anchored at 00:00:00.000
#[tauri::command]
fn sync_active_timeline(request: SyncRequest) -> Result<Vec<TrackSyncOffset>, String> {
    sync_active_timeline_tracks(&request).map_err(|e| e.to_string())
}

#[tauri::command]
fn sync_timeline_tracks(request: SyncRequest) -> Result<SyncResult, String> {
    sync_tracks_by_filename(&request.tracks, request.pattern.as_deref())
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn parse_filename_timestamp_cmd(filename: String) -> Result<ParsedTimestamp, String> {
    parse_camera_filename(&filename).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_sync_presets() -> Vec<SyncPreset> {
    SyncPreset::default_presets()
}

/// Renders the multi-track timeline project into a final master video file
#[tauri::command]
async fn render_project(app: tauri::AppHandle, export_config: ExportConfig) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        execute_export(&app, &export_config)
    })
    .await
    .map_err(|e| format!("Task execution error: {}", e))?
}

/// Helper to resolve preferences path (%APPDATA%/idts-video-editor/preferences.json)
fn get_preferences_path() -> std::path::PathBuf {
    let base_dir = std::env::var("APPDATA")
        .map(std::path::PathBuf::from)
        .or_else(|_| {
            std::env::var("USERPROFILE")
                .map(|p| std::path::PathBuf::from(p).join("AppData").join("Roaming"))
        })
        .or_else(|_| {
            std::env::var("HOME")
                .map(|h| std::path::PathBuf::from(h).join(".config"))
        })
        .unwrap_or_else(|_| std::env::temp_dir());

    base_dir.join("idts-video-editor").join("preferences.json")
}

/// Saves application preferences (keyboard shortcuts, auto-save settings)
#[tauri::command]
fn save_preferences(prefs: AppPreferences) -> Result<(), String> {
    let path = get_preferences_path();
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create preferences directory: {}", e))?;
    }
    let serialized = serde_json::to_string_pretty(&prefs)
        .map_err(|e| format!("Failed to serialize preferences: {}", e))?;
    std::fs::write(&path, serialized)
        .map_err(|e| format!("Failed to write preferences to {}: {}", path.display(), e))?;
    Ok(())
}

/// Loads application preferences from disk (%APPDATA%/idts-video-editor/preferences.json)
#[tauri::command]
fn load_preferences() -> Result<AppPreferences, String> {
    let path = get_preferences_path();
    if !path.exists() {
        return Ok(AppPreferences::default());
    }
    let content = std::fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read preferences: {}", e))?;
    let prefs: AppPreferences = serde_json::from_str(&content)
        .unwrap_or_default();
    Ok(prefs)
}

/// Saves the complete project schema as a `.idts` file
#[tauri::command]
fn save_project(path: String, project_data: ProjectData) -> Result<(), String> {
    let mut normalized_path = path.trim().to_string();
    if !normalized_path.to_lowercase().ends_with(".idts") {
        normalized_path.push_str(".idts");
    }
    project_data.save_to_file(Path::new(&normalized_path))
}

/// Loads a `.idts` project file from disk
#[tauri::command]
fn load_project(path: String) -> Result<ProjectData, String> {
    ProjectData::load_from_file(Path::new(&path))
}

/// Prompts native Windows save file picker for `.idts` project files
#[tauri::command]
fn save_project_dialog(default_name: Option<String>) -> Result<Option<String>, String> {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        let mut file_name = default_name.unwrap_or_else(|| "Untitled_Project.idts".to_string());
        if !file_name.to_lowercase().ends_with(".idts") {
            file_name.push_str(".idts");
        }
        let file_name_escaped = file_name.replace('"', "`\"");

        let ps_script = format!(
            r#"
            Add-Type -AssemblyName System.Windows.Forms
            $d = New-Object System.Windows.Forms.SaveFileDialog
            $d.Title = "Save idts Video Editor Project"
            $d.Filter = "idts Project (*.idts)|*.idts|All Files (*.*)|*.*"
            $d.DefaultExt = "idts"
            $d.AddExtension = $true
            $d.FileName = "{name}"
            if ($d.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {{
                Write-Output $d.FileName
            }}
            "#,
            name = file_name_escaped
        );

        let output = std::process::Command::new("powershell")
            .args(["-Sta", "-NoProfile", "-NonInteractive", "-Command", &ps_script])
            .creation_flags(0x08000000)
            .output()
            .map_err(|e| format!("Failed to launch save project dialog: {}", e))?;

        let mut out_path = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if out_path.is_empty() {
            Ok(None)
        } else {
            if !out_path.to_lowercase().ends_with(".idts") {
                out_path.push_str(".idts");
            }
            Ok(Some(out_path))
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        Ok(None)
    }
}

/// Prompts native Windows file picker to open a `.idts` project file
#[tauri::command]
fn open_project_dialog() -> Result<Option<String>, String> {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        let ps_script = r#"
            Add-Type -AssemblyName System.Windows.Forms
            $d = New-Object System.Windows.Forms.OpenFileDialog
            $d.Title = "Open idts Video Editor Project"
            $d.Filter = "idts Project (*.idts)|*.idts|All Files (*.*)|*.*"
            $d.Multiselect = $false
            if ($d.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
                Write-Output $d.FileName
            }
        "#;

        let output = std::process::Command::new("powershell")
            .args(["-Sta", "-NoProfile", "-NonInteractive", "-Command", ps_script])
            .creation_flags(0x08000000)
            .output()
            .map_err(|e| format!("Failed to launch open project dialog: {}", e))?;

        let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if path.is_empty() {
            Ok(None)
        } else {
            Ok(Some(path))
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        Ok(None)
    }
}

/// Generates a lightweight editing proxy for a clip with real-time progress events
#[tauri::command]
async fn create_clip_proxy(
    app: tauri::AppHandle,
    path: String,
    resolution: String,
) -> Result<String, String> {
    crate::engine::proxy::create_proxy_task(app, path, resolution).await
}

/// Cancels an active proxy generation task
#[tauri::command]
fn cancel_clip_proxy(path: String) -> Result<(), String> {
    crate::engine::proxy::cancel_proxy(&path)
}

/// Deletes cached proxy files for a media asset
#[tauri::command]
fn delete_clip_proxy(path: String) -> Result<(), String> {
    crate::engine::proxy::delete_proxy_files(&path)
}

/// Checks if a proxy file already exists on disk for a given media path and resolution
#[tauri::command]
fn check_clip_proxy(path: String, resolution: Option<String>) -> Option<String> {
    if path.trim().is_empty() {
        return None;
    }
    let res = resolution.unwrap_or_else(|| "720p".to_string());
    let p = crate::engine::proxy::get_proxy_path(&path, &res);
    if p.exists() {
        if let Ok(meta) = std::fs::metadata(&p) {
            if meta.len() > 100_000 {
                return Some(p.to_string_lossy().to_string());
            }
        }
    }
    None
}

/// Detects audio silence intervals in a media file using FFmpeg silencedetect
#[tauri::command]
fn detect_track_silence(
    path: String,
    threshold_db: f32,
    duration_sec: f32,
) -> Result<Vec<(f64, f64)>, String> {
    crate::engine::silence::detect_track_silence(path, threshold_db, duration_sec)
}

/// Detects audio silence intervals returning structured SilenceInterval items
#[tauri::command]
fn detect_track_silence_intervals(
    path: String,
    threshold_db: f32,
    duration_sec: f32,
) -> Result<Vec<models::ipc::SilenceInterval>, String> {
    crate::engine::silence::detect_track_silence_intervals(path, threshold_db, duration_sec)
}

/// Captures two-pass spectral noise profile from media audio sample and synthesizes seamless room tone tile
#[tauri::command]
fn capture_noise_profile(
    source_path: String,
    start_sec: f64,
    duration_sec: f64,
) -> Result<(String, String), String> {
    crate::engine::audio_denoise::capture_noise_profile(source_path, start_sec, duration_sec)
}

/// Renders a fast preview snippet of clean denoised audio
#[tauri::command]
fn preview_spectral_denoise(
    source_path: String,
    profile_path: Option<String>,
    start_sec: f64,
    duration_sec: f64,
    reduction_db: f32,
    sensitivity: Option<f32>,
    smoothing_bands: Option<u32>,
    audition_noise: bool,
) -> Result<String, String> {
    let mode = if audition_noise { Some("n".to_string()) } else { Some("o".to_string()) };
    crate::engine::audio_denoise::preview_spectral_denoise(
        source_path,
        profile_path,
        start_sec,
        duration_sec,
        reduction_db,
        sensitivity,
        smoothing_bands,
        mode,
    )
}

/// Applies spectral FFT noise reduction using FFmpeg's afftdn filter
#[tauri::command]
fn apply_spectral_denoise(
    input_path: String,
    profile_path: String,
    reduction_db: f32,
    sensitivity: Option<f32>,
    smoothing_bands: Option<u32>,
    audition_noise: bool,
) -> Result<String, String> {
    let mode = if audition_noise { Some("n".to_string()) } else { Some("o".to_string()) };
    crate::engine::audio_denoise::apply_spectral_denoise(
        input_path,
        profile_path,
        reduction_db,
        sensitivity,
        smoothing_bands,
        mode,
    )
}

/// Auto-cuts silence with edge padding margin and intelligent ambient noise fill bridging
#[tauri::command]
fn auto_cut_silence_with_ambient_fill(
    source_path: String,
    total_duration_sec: f64,
    threshold_db: f32,
    min_duration_sec: f32,
    padding_ms: u32,
    ambient_recovery: bool,
    ambient_fill_intensity: f32,
    room_tone_path: Option<String>,
) -> Result<crate::engine::audio_denoise::AutoCutResult, String> {
    let raw_silences = crate::engine::silence::detect_track_silence_intervals(
        source_path,
        threshold_db,
        min_duration_sec,
    )?;
    Ok(crate::engine::audio_denoise::plan_auto_cut_silence_with_ambient(
        total_duration_sec,
        raw_silences,
        padding_ms,
        ambient_recovery,
        ambient_fill_intensity,
        room_tone_path,
    ))
}

/// Transcribes track audio using local Whisper speech recognition or acoustic cadence engine
#[tauri::command]
fn transcribe_track_audio(path: String, model: String) -> Result<Vec<models::ipc::CaptionSegment>, String> {
    crate::engine::transcribe::transcribe_audio_file(&path, &model)
}

/// Enumerates available native audio input devices
#[tauri::command]
fn get_audio_input_devices() -> Result<Vec<models::ipc::AudioDeviceInfo>, String> {
    Ok(crate::engine::audio_capture::enumerate_audio_input_devices())
}

/// Begins streaming voiceover audio recording
#[tauri::command]
fn start_audio_recording(
    app: tauri::AppHandle,
    device_id: Option<String>,
    sample_rate: Option<u32>,
) -> Result<(), String> {
    crate::engine::audio_capture::start_recording(&app, device_id, sample_rate)
}

/// Appends a chunk of audio samples during recording
#[tauri::command]
fn append_audio_recording_chunk(chunk_base64: String) -> Result<(), String> {
    crate::engine::audio_capture::append_recording_chunk(&chunk_base64)
}

/// Stops voiceover audio recording and flushes a clean 48kHz WAV file
#[tauri::command]
fn stop_audio_recording(
    output_filename: Option<String>,
    audio_data_base64: Option<String>,
) -> Result<String, String> {
    crate::engine::audio_capture::stop_recording(output_filename, audio_data_base64)
}

/// Reads an audio or media file directly from disk into raw binary bytes
#[tauri::command]
fn read_audio_file(path: String) -> Result<Vec<u8>, String> {
    std::fs::read(&path).map_err(|e| format!("Failed to read file '{}': {}", path, e))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;

        // Ensure Windows DirectX UserGpuPreferences marks current exe as High-Performance GPU
        if let Ok(exe_path) = std::env::current_exe() {
            let exe_str = exe_path.to_string_lossy().to_string();
            let _ = std::process::Command::new("reg")
                .args([
                    "add",
                    r"HKCU\Software\Microsoft\DirectX\UserGpuPreferences",
                    "/v",
                    &exe_str,
                    "/t",
                    "REG_SZ",
                    "/d",
                    "GpuPreference=2;",
                    "/f",
                ])
                .creation_flags(0x08000000)
                .output();
        }

        let gpu_args = [
            "--gpu-preference=2",
            "--force-high-performance-gpu",
            "--enable-gpu-rasterization",
            "--enable-zero-copy",
            "--ignore-gpu-blocklist",
            "--enable-hardware-overlays",
        ].join(" ");

        for var_name in [
            "WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS",
            "WEBVIEW2_ADDITIONAL_BROWSER_ARGS",
        ] {
            let current = std::env::var(var_name).unwrap_or_default();
            if !current.contains("--gpu-preference=2") {
                let combined = if current.is_empty() {
                    gpu_args.clone()
                } else {
                    format!("{} {}", current, gpu_args)
                };
                std::env::set_var(var_name, combined);
            }
        }
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            open_file_dialog,
            open_folder_dialog,
            save_file_dialog,
            open_lut_dialog,
            get_waveform_data,
            sync_by_audio,
            get_clip_metadata,
            sync_active_timeline,
            sync_timeline_tracks,
            parse_filename_timestamp_cmd,
            get_sync_presets,
            render_project,
            save_preferences,
            load_preferences,
            save_project,
            load_project,
            save_project_dialog,
            open_project_dialog,
            create_clip_proxy,
            cancel_clip_proxy,
            delete_clip_proxy,
            check_clip_proxy,
            detect_track_silence,
            detect_track_silence_intervals,
            capture_noise_profile,
            preview_spectral_denoise,
            apply_spectral_denoise,
            auto_cut_silence_with_ambient_fill,
            transcribe_track_audio,
            get_audio_input_devices,
            start_audio_recording,
            append_audio_recording_chunk,
            stop_audio_recording,
            read_audio_file,
            capture_preview_frame,
            get_filter_catalog,
            get_filter_presets
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
