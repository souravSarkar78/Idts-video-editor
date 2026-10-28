//! Audio processing and waveform peak extraction module using bundled FFmpeg sidecar.

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

/// Extracts low-resolution audio peak samples (0.0 .. 1.0) for waveform visualization.
///
/// Uses FFmpeg to decode the first audio stream to mono 8kHz raw 32-bit float PCM (`f32le`),
/// then buckets the samples into `points_per_sec` peaks per second.
pub fn extract_audio_peaks(file_path: &str, points_per_sec: usize) -> Result<Vec<f32>, String> {
    if file_path.is_empty() {
        return Ok(Vec::new());
    }

    // Check in-memory cache first
    {
        if let Ok(cache) = get_cache().lock() {
            if let Some(peaks) = cache.get(file_path) {
                return Ok(peaks.clone());
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
        "-ac", "1",
        "-ar", &sample_rate.to_string(),
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
    crate::engine::process_manager::register_process(pid, "ffmpeg waveform extraction");
    let mut stdout = child.stdout.take().ok_or_else(|| {
        crate::engine::process_manager::unregister_process(pid);
        "Failed to capture ffmpeg stdout".to_string()
    })?;

    // Read f32le raw bytes
    let mut raw_bytes = Vec::new();
    let read_res = stdout.read_to_end(&mut raw_bytes);
    let _ = child.wait();
    crate::engine::process_manager::unregister_process(pid);
    read_res.map_err(|e| format!("Failed to read raw audio data: {}", e))?;

    let sample_count = raw_bytes.len() / 4;
    if sample_count == 0 {
        // No audio stream or silent/empty
        return Ok(Vec::new());
    }

    let mut samples = Vec::with_capacity(sample_count);
    for chunk in raw_bytes.chunks_exact(4) {
        let val = f32::from_le_bytes([chunk[0], chunk[1], chunk[2], chunk[3]]);
        samples.push(val);
    }

    // Downsample into peak points
    let mut peaks = Vec::with_capacity(sample_count / window_size + 1);
    for chunk in samples.chunks(window_size) {
        let max_val = chunk.iter().fold(0.0f32, |acc, &s| acc.max(s.abs()));
        peaks.push(max_val.min(1.0));
    }

    // Cache the extracted peaks
    if let Ok(mut cache) = get_cache().lock() {
        cache.insert(file_path.to_string(), peaks.clone());
    }

    Ok(peaks)
}

/// Tauri command to retrieve waveform peak data for a given media file path.
#[tauri::command]
pub fn get_waveform_data(path: String) -> Result<Vec<f32>, String> {
    extract_audio_peaks(&path, 25)
}
