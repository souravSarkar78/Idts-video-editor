//! Audio processing and waveform peak extraction module using bundled FFmpeg sidecar.
//!
//! Uses streamed chunk-based peak downsampling with zero full-track RAM decompression.

use std::collections::HashMap;
use std::io::Read;
use std::path::Path;
use std::process::{Command as StdCommand, Stdio};
use std::sync::{Mutex, OnceLock};

use crate::engine::ffmpeg::find_ffmpeg_executable;

/// Thread-safe in-memory cache for audio waveform peak vectors.
/// Key is the canonical file path.
static WAVEFORM_CACHE: OnceLock<Mutex<HashMap<String, Vec<f32>>>> = OnceLock::new();

fn get_cache() -> &'static Mutex<HashMap<String, Vec<f32>>> {
    WAVEFORM_CACHE.get_or_init(|| Mutex::new(HashMap::new()))
}

/// Computes deterministic hash for audio waveform cache
fn compute_audio_hash(file_path: &str, points_per_sec: usize) -> u64 {
    let mut hasher = std::collections::hash_map::DefaultHasher::new();
    std::hash::Hash::hash(&file_path, &mut hasher);
    std::hash::Hash::hash(&points_per_sec, &mut hasher);
    if let Ok(meta) = std::fs::metadata(file_path) {
        std::hash::Hash::hash(&meta.len(), &mut hasher);
    }
    std::hash::Hasher::finish(&hasher)
}

/// Extracts low-resolution audio peak samples (0.0 .. 1.0) for waveform visualization.
///
/// Uses streamed 8kHz chunk processing through a 4KB pipe buffer to ensure
/// zero unbounded memory growth even for multi-hour video and audio media.
pub fn extract_audio_peaks(file_path: &str, points_per_sec: usize) -> Result<Vec<f32>, String> {
    if file_path.is_empty() {
        return Ok(Vec::new());
    }

    // 1. Check in-memory cache first
    {
        if let Ok(cache) = get_cache().lock() {
            if let Some(peaks) = cache.get(file_path) {
                return Ok(peaks.clone());
            }
        }
    }

    let cache_dir = crate::engine::thumbnail::get_preview_cache_dir();
    let _ = std::fs::create_dir_all(&cache_dir);
    let hash_val = compute_audio_hash(file_path, points_per_sec);
    let disk_cache_file = cache_dir.join(format!("wf_{:016x}.bin", hash_val));

    // 2. Check disk cache before executing FFmpeg
    if disk_cache_file.exists() {
        if let Ok(bytes) = std::fs::read(&disk_cache_file) {
            if bytes.len() >= 4 && bytes.len() % 4 == 0 {
                let mut disk_peaks = Vec::with_capacity(bytes.len() / 4);
                for c in bytes.chunks_exact(4) {
                    disk_peaks.push(f32::from_le_bytes([c[0], c[1], c[2], c[3]]));
                }
                if let Ok(mut cache) = get_cache().lock() {
                    cache.insert(file_path.to_string(), disk_peaks.clone());
                }
                return Ok(disk_peaks);
            }
        }
    }

    let p = Path::new(file_path);
    if !p.exists() {
        return Err(format!("Media file does not exist: {}", file_path));
    }

    let ffmpeg_bin = find_ffmpeg_executable()
        .ok_or_else(|| "Could not locate ffmpeg sidecar binary".to_string())?;

    let sample_rate: usize = 8000;
    let points = if points_per_sec == 0 { 25 } else { points_per_sec };
    let window_size = (sample_rate / points).max(1);

    // Spawn FFmpeg to stream raw 32-bit float mono audio at 8kHz to stdout
    let mut cmd = StdCommand::new(&ffmpeg_bin);
    cmd.args([
        "-v", "quiet",
        "-y",
        "-i", file_path,
        "-vn",
        "-filter_complex", "aformat=channel_layouts=mono,aresample=8000",
        "-f", "f32le",
        "pipe:1",
    ])
    .stdout(Stdio::piped())
    .stderr(Stdio::null());

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }

    let mut child = cmd.spawn().map_err(|e| format!("Failed to spawn ffmpeg: {}", e))?;
    let pid = child.id();
    crate::engine::process_manager::register_process(pid, "ffmpeg waveform streaming extraction");
    let mut stdout = child.stdout.take().ok_or_else(|| {
        crate::engine::process_manager::unregister_process(pid);
        "Failed to capture ffmpeg stdout".to_string()
    })?;

    // Stream through a 4KB chunk buffer: calculate peaks on the fly without accumulating PCM samples
    let mut peaks: Vec<f32> = Vec::new();
    let mut chunk_buf = [0u8; 4096];
    let mut remainder = Vec::with_capacity(4);

    let mut current_window_max = 0.0f32;
    let mut samples_in_window = 0usize;

    loop {
        let n = match stdout.read(&mut chunk_buf) {
            Ok(0) => break,
            Ok(bytes_read) => bytes_read,
            Err(e) if e.kind() == std::io::ErrorKind::Interrupted => continue,
            Err(_) => break,
        };

        let mut data_to_process = &chunk_buf[..n];
        if !remainder.is_empty() {
            let needed = 4 - remainder.len();
            if n >= needed {
                remainder.extend_from_slice(&data_to_process[..needed]);
                data_to_process = &data_to_process[needed..];
                let val = f32::from_le_bytes([remainder[0], remainder[1], remainder[2], remainder[3]]);
                remainder.clear();
                current_window_max = current_window_max.max(val.abs());
                samples_in_window += 1;
                if samples_in_window >= window_size {
                    peaks.push(current_window_max.min(1.0));
                    current_window_max = 0.0;
                    samples_in_window = 0;
                }
            } else {
                remainder.extend_from_slice(data_to_process);
                continue;
            }
        }

        let full_samples = data_to_process.len() / 4;
        let leftover_bytes = data_to_process.len() % 4;

        for chunk in data_to_process[..full_samples * 4].chunks_exact(4) {
            let val = f32::from_le_bytes([chunk[0], chunk[1], chunk[2], chunk[3]]);
            current_window_max = current_window_max.max(val.abs());
            samples_in_window += 1;
            if samples_in_window >= window_size {
                peaks.push(current_window_max.min(1.0));
                current_window_max = 0.0;
                samples_in_window = 0;
            }
        }

        if leftover_bytes > 0 {
            remainder.extend_from_slice(&data_to_process[full_samples * 4..]);
        }
    }

    if samples_in_window > 0 {
        peaks.push(current_window_max.min(1.0));
    }

    let _ = child.wait();
    crate::engine::process_manager::unregister_process(pid);

    // Cache the extracted downsampled peaks in memory and on disk
    if let Ok(mut cache) = get_cache().lock() {
        cache.insert(file_path.to_string(), peaks.clone());
    }

    let mut write_bytes = Vec::with_capacity(peaks.len() * 4);
    for p in &peaks {
        write_bytes.extend_from_slice(&p.to_le_bytes());
    }
    let _ = std::fs::write(&disk_cache_file, write_bytes);

    Ok(peaks)
}

/// Tauri command to retrieve waveform peak data for a given media file path.
#[tauri::command]
pub fn get_waveform_data(path: String) -> Result<Vec<f32>, String> {
    extract_audio_peaks(&path, 25)
}
