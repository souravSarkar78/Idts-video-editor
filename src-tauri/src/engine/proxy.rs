//! Proxy generation engine for low-resolution, high-framerate preview workflows.
//!
//! Generates fast-decode H.264 proxy MP4s scaled to 720p/540p/360p with ultrafast presets
//! and low bitrates, storing them in `%LOCALAPPDATA%/idts-video-editor/proxies/`.
//! Provides IPC commands with cancellation and real-time progress events.

use std::collections::HashMap;
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::process::{Command as StdCommand, Stdio};
use std::sync::{Mutex, OnceLock};
use tauri::{AppHandle, Emitter, Runtime};

use crate::engine::ffmpeg::find_ffmpeg_executable;
use crate::engine::metadata::probe_media_file;
use crate::models::ipc::ProxyProgressEvent;

/// Map of active proxy generation jobs: Source File Path -> Process ID
static RUNNING_JOBS: OnceLock<Mutex<HashMap<String, u32>>> = OnceLock::new();

fn get_running_jobs() -> &'static Mutex<HashMap<String, u32>> {
    RUNNING_JOBS.get_or_init(|| Mutex::new(HashMap::new()))
}

/// Resolves standard proxy storage directory in `%LOCALAPPDATA%/idts-video-editor/proxies/`
pub fn get_proxy_dir() -> PathBuf {
    let base = std::env::var("LOCALAPPDATA")
        .map(PathBuf::from)
        .or_else(|_| {
            std::env::var("USERPROFILE")
                .map(|p| PathBuf::from(p).join("AppData").join("Local"))
        })
        .or_else(|_| std::env::var("HOME").map(|h| PathBuf::from(h).join(".cache")))
        .unwrap_or_else(|_| std::env::temp_dir());

    let dir = base.join("idts-video-editor").join("proxies");
    let _ = std::fs::create_dir_all(&dir);
    dir
}

/// Computes a deterministic 64-bit FNV-1a hash across process restarts and platforms
pub fn deterministic_hash(input: &str) -> u64 {
    let mut hash: u64 = 0xcbf29ce484222325;
    for byte in input.as_bytes() {
        hash ^= *byte as u64;
        hash = hash.wrapping_mul(0x100000001b3);
    }
    hash
}

/// Derives a deterministic proxy file path for a source media file and resolution
pub fn get_proxy_path(source_path: &str, resolution: &str) -> PathBuf {
    let hash_val = deterministic_hash(source_path);

    let stem = Path::new(source_path)
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("clip");

    let clean_stem: String = stem
        .chars()
        .filter(|c| c.is_alphanumeric() || *c == '_' || *c == '-')
        .collect();

    let dir = get_proxy_dir();
    dir.join(format!("{}_{:016x}_{}.mp4", clean_stem, hash_val, resolution))
}

/// Maps resolution label string to vertical height and horizontal constraint
pub fn parse_resolution(resolution: &str) -> (u32, u32) {
    match resolution.to_lowercase().trim() {
        "360p" | "360" => (640, 360),
        "540p" | "540" => (960, 540),
        "720p" | "720" => (1280, 720),
        "1080p" | "1080" => (1920, 1080),
        _ => (1280, 720),
    }
}

/// Helper to construct FFmpeg argument list for proxy generation
pub fn build_proxy_args(
    source_path: &str,
    output_path: &str,
    resolution: (u32, u32),
    use_hardware: bool,
) -> Vec<String> {
    let scale_filter = format!("scale=-2:{}", resolution.1);
    let mut args = vec![
        "-nostdin".to_string(),
        "-y".to_string(),
        "-progress".to_string(),
        "pipe:1".to_string(),
        "-v".to_string(),
        "error".to_string(),
        "-i".to_string(),
        source_path.to_string(),
        "-vf".to_string(),
        scale_filter,
    ];

    if use_hardware {
        args.extend([
            "-c:v".to_string(),
            "h264_nvenc".to_string(),
            "-preset".to_string(),
            "p1".to_string(),
            "-tune".to_string(),
            "ll".to_string(),
            "-b:v".to_string(),
            "2000k".to_string(),
            "-maxrate".to_string(),
            "3000k".to_string(),
            "-bufsize".to_string(),
            "4000k".to_string(),
        ]);
    } else {
        args.extend([
            "-c:v".to_string(),
            "libx264".to_string(),
            "-preset".to_string(),
            "ultrafast".to_string(),
            "-crf".to_string(),
            "28".to_string(),
            "-g".to_string(),
            "30".to_string(),
        ]);
    }

    // Audio & container flags: lightweight aac with faststart moov atom
    args.extend([
        "-c:a".to_string(),
        "aac".to_string(),
        "-b:a".to_string(),
        "128k".to_string(),
        "-ar".to_string(),
        "48000".to_string(),
        "-movflags".to_string(),
        "+faststart".to_string(),
        output_path.to_string(),
    ]);

    args
}

/// Generates a lightweight fast-decode proxy MP4 for the given source file synchronously
pub fn generate_proxy(
    source_path: &str,
    output_path: &str,
    resolution: (u32, u32),
    use_hardware: bool,
) -> Result<(), String> {
    let ffmpeg_bin = find_ffmpeg_executable()
        .ok_or_else(|| "Could not locate ffmpeg executable for proxy generation".to_string())?;

    let p = Path::new(source_path);
    if !p.exists() {
        return Err(format!("Source media file does not exist: {}", source_path));
    }

    if let Some(parent) = Path::new(output_path).parent() {
        let _ = std::fs::create_dir_all(parent);
    }

    let temp_output = format!("{}.tmp.mp4", output_path);
    let args = build_proxy_args(source_path, &temp_output, resolution, use_hardware);

    let mut cmd = StdCommand::new(&ffmpeg_bin);
    cmd.args(&args);
    cmd.stdin(Stdio::null());
    cmd.stdout(Stdio::null());
    cmd.stderr(Stdio::piped());

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }

    let output = cmd
        .output()
        .map_err(|e| format!("Failed to execute ffmpeg for proxy: {}", e))?;

    if !output.status.success() {
        let _ = std::fs::remove_file(&temp_output);
        // If NVENC failed, retry with CPU fallback
        if use_hardware {
            return generate_proxy(source_path, output_path, resolution, false);
        }
        let err_str = String::from_utf8_lossy(&output.stderr);
        return Err(format!("FFmpeg proxy generation failed: {}", err_str));
    }

    // Rename temporary file to final target
    std::fs::rename(&temp_output, output_path)
        .map_err(|e| format!("Failed to move temp proxy to final destination: {}", e))?;

    Ok(())
}

/// Helper to execute an FFmpeg proxy process with line-by-line stdout progress and non-blocking stderr drain
fn run_proxy_ffmpeg<R: Runtime>(
    app: &AppHandle<R>,
    ffmpeg_bin: &Path,
    source_path: &str,
    temp_output: &str,
    args: &[String],
    total_duration_sec: f64,
) -> Result<(), String> {
    let mut cmd = StdCommand::new(ffmpeg_bin);
    cmd.args(args);
    cmd.stdin(Stdio::null());
    cmd.stdout(Stdio::piped());
    cmd.stderr(Stdio::piped());

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }

    let mut child = cmd.spawn().map_err(|e| format!("Failed to spawn ffmpeg: {}", e))?;
    let pid = child.id();
    {
        let mut jobs = get_running_jobs().lock().unwrap();
        jobs.insert(source_path.to_string(), pid);
    }

    let stdout = child.stdout.take();
    let stderr = child.stderr.take();
    let app_handle_clone = app.clone();
    let source_path_clone = source_path.to_string();

    // Stream progress line-by-line from stdout (-progress pipe:1)
    let progress_handle = std::thread::spawn(move || {
        if let Some(pipe) = stdout {
            let reader = BufReader::new(pipe);
            for line_res in reader.lines() {
                if let Ok(line) = line_res {
                    let trimmed = line.trim();
                    if trimmed.starts_with("out_time_us=") {
                        if let Ok(us) = trimmed[12..].parse::<u64>() {
                            let cur_sec = (us as f64) / 1_000_000.0;
                            let pct = ((cur_sec / total_duration_sec) * 100.0).clamp(0.0, 99.0) as f32;
                            let _ = app_handle_clone.emit(
                                "proxy-progress",
                                ProxyProgressEvent {
                                    path: source_path_clone.clone(),
                                    progress: pct,
                                    status: "transcoding".to_string(),
                                    proxy_path: None,
                                    error_message: None,
                                },
                            );
                        }
                    } else if trimmed == "progress=end" {
                        let _ = app_handle_clone.emit(
                            "proxy-progress",
                            ProxyProgressEvent {
                                path: source_path_clone.clone(),
                                progress: 99.5,
                                status: "transcoding".to_string(),
                                proxy_path: None,
                                error_message: None,
                            },
                        );
                    }
                }
            }
        }
    });

    // Drain stderr concurrently to prevent pipe buffer deadlocks
    let err_handle = std::thread::spawn(move || {
        let mut err_str = String::new();
        if let Some(pipe) = stderr {
            let mut reader = BufReader::new(pipe);
            let _ = std::io::Read::read_to_string(&mut reader, &mut err_str);
        }
        err_str
    });

    let status = child.wait().map_err(|e| format!("Error waiting on ffmpeg: {}", e))?;

    {
        let mut jobs = get_running_jobs().lock().unwrap();
        jobs.remove(source_path);
    }

    let _ = progress_handle.join();
    let stderr_output = err_handle.join().unwrap_or_default();

    if !status.success() {
        let _ = std::fs::remove_file(temp_output);
        return Err(format!("FFmpeg exited with status {}: {}", status, stderr_output.trim()));
    }

    Ok(())
}

/// Transcodes a media asset to a proxy MP4 asynchronously with progress events and cancellation
pub async fn create_proxy_task<R: Runtime>(
    app: AppHandle<R>,
    source_path: String,
    resolution: String,
) -> Result<String, String> {
    let target_path = get_proxy_path(&source_path, &resolution);
    let target_path_str = target_path.to_string_lossy().to_string();

    // Check if valid proxy already exists
    if target_path.exists() {
        if let Ok(meta) = std::fs::metadata(&target_path) {
            if meta.len() > 100_000 {
                let _ = app.emit(
                    "proxy-progress",
                    ProxyProgressEvent {
                        path: source_path.clone(),
                        progress: 100.0,
                        status: "completed".to_string(),
                        proxy_path: Some(target_path_str.clone()),
                        error_message: None,
                    },
                );
                return Ok(target_path_str);
            }
        }
    }

    let ffmpeg_bin = find_ffmpeg_executable()
        .ok_or_else(|| "Could not locate ffmpeg executable".to_string())?;

    // Probe total duration for accurate progress calculation
    let total_duration_sec = probe_media_file(&source_path)
        .map(|m| m.duration_seconds)
        .unwrap_or(30.0)
        .max(0.1);

    let res_dims = parse_resolution(&resolution);
    let temp_output = format!("{}.tmp.mp4", target_path_str);

    // Initial 0% progress notification
    let _ = app.emit(
        "proxy-progress",
        ProxyProgressEvent {
            path: source_path.clone(),
            progress: 0.0,
            status: "transcoding".to_string(),
            proxy_path: None,
            error_message: None,
        },
    );

    // First attempt: try hardware encoding (h264_nvenc)
    let hw_args = build_proxy_args(&source_path, &temp_output, res_dims, true);
    let run_res = run_proxy_ffmpeg(
        &app,
        &ffmpeg_bin,
        &source_path,
        &temp_output,
        &hw_args,
        total_duration_sec,
    );

    let final_res = match run_res {
        Ok(()) => Ok(()),
        Err(hw_err) => {
            // Hardware encoding failed; fallback immediately to CPU ultrafast libx264
            eprintln!(
                "[Proxy] Hardware encoding failed ({}), falling back to CPU libx264...",
                hw_err
            );
            let _ = std::fs::remove_file(&temp_output);
            let cpu_args = build_proxy_args(&source_path, &temp_output, res_dims, false);
            run_proxy_ffmpeg(
                &app,
                &ffmpeg_bin,
                &source_path,
                &temp_output,
                &cpu_args,
                total_duration_sec,
            )
        }
    };

    match final_res {
        Ok(()) => {
            if Path::new(&temp_output).exists() {
                let _ = std::fs::rename(&temp_output, &target_path);
            }
            let _ = app.emit(
                "proxy-progress",
                ProxyProgressEvent {
                    path: source_path.clone(),
                    progress: 100.0,
                    status: "completed".to_string(),
                    proxy_path: Some(target_path_str.clone()),
                    error_message: None,
                },
            );
            Ok(target_path_str)
        }
        Err(err) => {
            let _ = std::fs::remove_file(&temp_output);
            let _ = app.emit(
                "proxy-progress",
                ProxyProgressEvent {
                    path: source_path.clone(),
                    progress: 0.0,
                    status: "error".to_string(),
                    proxy_path: None,
                    error_message: Some(err.clone()),
                },
            );
            Err(err)
        }
    }
}

/// Cancels an in-progress proxy generation job and deletes any partial files
pub fn cancel_proxy(source_path: &str) -> Result<(), String> {
    let pid_opt = {
        let mut jobs = get_running_jobs().lock().unwrap();
        jobs.remove(source_path)
    };

    if let Some(pid) = pid_opt {
        #[cfg(target_os = "windows")]
        {
            use std::os::windows::process::CommandExt;
            let _ = StdCommand::new("taskkill")
                .args(["/F", "/PID", &pid.to_string()])
                .creation_flags(0x08000000)
                .output();
        }
        #[cfg(not(target_os = "windows"))]
        {
            let _ = StdCommand::new("kill")
                .args(["-9", &pid.to_string()])
                .output();
        }
    }

    // Clean up partial temp file
    for res in &["720p", "540p", "360p"] {
        let p = get_proxy_path(source_path, res);
        let tmp = format!("{}.tmp.mp4", p.display());
        let _ = std::fs::remove_file(tmp);
    }

    Ok(())
}

/// Deletes generated proxy files for the given source path across all resolutions
pub fn delete_proxy_files(source_path: &str) -> Result<(), String> {
    let mut deleted_any = false;
    for res in &["720p", "540p", "360p", "1080p"] {
        let p = get_proxy_path(source_path, res);
        if p.exists() {
            let _ = std::fs::remove_file(&p);
            deleted_any = true;
        }
        let tmp = format!("{}.tmp.mp4", p.display());
        if Path::new(&tmp).exists() {
            let _ = std::fs::remove_file(&tmp);
        }
    }

    if deleted_any {
        Ok(())
    } else {
        Ok(())
    }
}
