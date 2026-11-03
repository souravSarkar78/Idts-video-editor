//! Asynchronous chunked waveform extraction engine.
//!
//! Extracts downsampled audio peaks non-blockingly on background worker threads
//! and streams progressive chunks to the frontend via Tauri events, while persisting
//! full peak caches in `%LOCALAPPDATA%/idts-video-editor/cache/waveforms/{media_hash}.peaks`.

use std::collections::{HashMap, HashSet};
use std::io::Read;
use std::path::{Path, PathBuf};
use std::process::{Command as StdCommand, Stdio};
use std::sync::{Mutex, OnceLock};
use tauri::{AppHandle, Emitter};

use crate::engine::ffmpeg::find_ffmpeg_executable;
use crate::models::ipc::WaveformChunkPayload;

/// Thread-safe in-memory cache for audio waveform peak vectors.
/// Key is the canonical file path.
static ASYNC_WAVEFORM_CACHE: OnceLock<Mutex<HashMap<String, Vec<f32>>>> = OnceLock::new();

/// Active background extraction tracker to prevent duplicate worker spawns for the same media file.
static ACTIVE_EXTRACTIONS: OnceLock<Mutex<HashSet<String>>> = OnceLock::new();

fn get_mem_cache() -> &'static Mutex<HashMap<String, Vec<f32>>> {
    ASYNC_WAVEFORM_CACHE.get_or_init(|| Mutex::new(HashMap::new()))
}

fn get_active_extractions() -> &'static Mutex<HashSet<String>> {
    ACTIVE_EXTRACTIONS.get_or_init(|| Mutex::new(HashSet::new()))
}

/// Resolves the dedicated persistent waveforms directory
pub fn get_waveform_cache_dir() -> PathBuf {
    #[cfg(target_os = "windows")]
    {
        if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
            return PathBuf::from(local_app_data)
                .join("idts-video-editor")
                .join("cache")
                .join("waveforms");
        }
    }

    std::env::temp_dir()
        .join("idts-video-editor")
        .join("cache")
        .join("waveforms")
}

/// Computes deterministic hash for audio waveform cache file
pub fn compute_media_waveform_hash(file_path: &str, points_per_sec: usize) -> u64 {
    let mut hasher = std::collections::hash_map::DefaultHasher::new();
    std::hash::Hash::hash(&file_path, &mut hasher);
    std::hash::Hash::hash(&points_per_sec, &mut hasher);
    if let Ok(meta) = std::fs::metadata(file_path) {
        std::hash::Hash::hash(&meta.len(), &mut hasher);
    }
    std::hash::Hasher::finish(&hasher)
}

/// Checks if pre-computed waveform peaks already exist in memory or disk cache
pub fn get_cached_waveform(file_path: &str, points_per_sec: usize) -> Option<Vec<f32>> {
    // 1. In-memory check
    if let Ok(cache) = get_mem_cache().lock() {
        if let Some(peaks) = cache.get(file_path) {
            return Some(peaks.clone());
        }
    }

    // 2. Disk cache check
    let cache_dir = get_waveform_cache_dir();
    let hash = compute_media_waveform_hash(file_path, points_per_sec);
    let disk_file = cache_dir.join(format!("{:016x}.peaks", hash));

    if disk_file.exists() {
        if let Ok(bytes) = std::fs::read(&disk_file) {
            if bytes.len() >= 4 && bytes.len() % 4 == 0 {
                let mut peaks = Vec::with_capacity(bytes.len() / 4);
                for c in bytes.chunks_exact(4) {
                    peaks.push(f32::from_le_bytes([c[0], c[1], c[2], c[3]]));
                }
                if let Ok(mut cache) = get_mem_cache().lock() {
                    cache.insert(file_path.to_string(), peaks.clone());
                }
                return Some(peaks);
            }
        }
    }

    None
}

/// Initiates non-blocking background waveform extraction and progressive chunk streaming.
/// Returns immediately without stalling the caller.
pub fn start_background_waveform_stream(
    app_handle: AppHandle,
    clip_id: String,
    file_path: String,
    points_per_sec: usize,
) {
    let pps = if points_per_sec == 0 { 25 } else { points_per_sec };

    // 1. If already cached, emit immediately in one shot and return
    if let Some(cached_peaks) = get_cached_waveform(&file_path, pps) {
        let chunk_size = 250; // ~10 seconds at 25 pps
        let total_chunks = (cached_peaks.len() + chunk_size - 1) / chunk_size;
        let total_chunks = total_chunks.max(1);

        for (chunk_idx, chunk) in cached_peaks.chunks(chunk_size).enumerate() {
            let is_last = chunk_idx + 1 == total_chunks;
            let payload = WaveformChunkPayload {
                clip_id: clip_id.clone(),
                file_path: file_path.clone(),
                chunk_index: chunk_idx,
                total_chunks,
                points_per_sec: pps,
                min_max_pairs: chunk.to_vec(),
                is_last_chunk: is_last,
            };
            let _ = app_handle.emit("waveform-chunk-ready", &payload);
        }
        return;
    }

    // 2. Deduplicate: if an extraction is already active for this path, do not spawn another
    {
        let mut active = get_active_extractions().lock().unwrap();
        if active.contains(&file_path) {
            return;
        }
        active.insert(file_path.clone());
    }

    // 3. Spawn asynchronous low-priority background thread
    let file_path_clone = file_path.clone();
    let clip_id_clone = clip_id.clone();
    let app_handle_clone = app_handle.clone();

    let spawn_res = std::thread::Builder::new()
        .name(format!("waveform-worker-{}", clip_id))
        .spawn(move || {
            let res = extract_and_stream_waveform_chunks(
                &app_handle_clone,
                &clip_id_clone,
                &file_path_clone,
                pps,
            );

            // Clear from active extraction set
            if let Ok(mut active) = get_active_extractions().lock() {
                active.remove(&file_path_clone);
            }

            if let Err(e) = res {
                eprintln!("[WaveformWorker] Background extraction error for {}: {}", file_path_clone, e);
            }
        });

    if spawn_res.is_err() {
        if let Ok(mut active) = get_active_extractions().lock() {
            active.remove(&file_path);
        }
    }
}

/// Internal streaming processor using FFmpeg 8kHz mono pipe with quantized 10s chunk broadcasts.
fn extract_and_stream_waveform_chunks(
    app: &AppHandle,
    clip_id: &str,
    file_path: &str,
    points_per_sec: usize,
) -> Result<(), String> {
    let p = Path::new(file_path);
    if !p.exists() {
        return Err(format!("File does not exist: {}", file_path));
    }

    let ffmpeg_bin = find_ffmpeg_executable()
        .ok_or_else(|| "Could not locate sidecar FFmpeg binary".to_string())?;

    let sample_rate: usize = 8000;
    let window_size = (sample_rate / points_per_sec).max(1);
    let chunk_point_capacity = points_per_sec * 10; // 10-second quantized blocks (~250 peaks)

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
    crate::engine::process_manager::register_process(pid, "ffmpeg async waveform extraction");

    let mut stdout = child.stdout.take().ok_or_else(|| {
        crate::engine::process_manager::unregister_process(pid);
        "Failed to capture ffmpeg stdout".to_string()
    })?;

    let mut all_peaks: Vec<f32> = Vec::new();
    let mut current_chunk: Vec<f32> = Vec::with_capacity(chunk_point_capacity);
    let mut chunk_index = 0usize;

    let mut chunk_buf = [0u8; 8192];
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
                    let peak = current_window_max.min(1.0);
                    current_chunk.push(peak);
                    all_peaks.push(peak);
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
                let peak = current_window_max.min(1.0);
                current_chunk.push(peak);
                all_peaks.push(peak);
                current_window_max = 0.0;
                samples_in_window = 0;

                // When quantized chunk capacity is reached, emit progressive chunk event
                if current_chunk.len() >= chunk_point_capacity {
                    let payload = WaveformChunkPayload {
                        clip_id: clip_id.to_string(),
                        file_path: file_path.to_string(),
                        chunk_index,
                        total_chunks: 0, // In-progress indicator
                        points_per_sec,
                        min_max_pairs: current_chunk.clone(),
                        is_last_chunk: false,
                    };
                    let _ = app.emit("waveform-chunk-ready", &payload);
                    current_chunk.clear();
                    chunk_index += 1;
                }
            }
        }

        if leftover_bytes > 0 {
            remainder.extend_from_slice(&data_to_process[full_samples * 4..]);
        }
    }

    if samples_in_window > 0 {
        let peak = current_window_max.min(1.0);
        current_chunk.push(peak);
        all_peaks.push(peak);
    }

    let _ = child.wait();
    crate::engine::process_manager::unregister_process(pid);

    // Emit final chunk with is_last_chunk: true and total chunks calculated
    let total_chunks = chunk_index + if current_chunk.is_empty() { 0 } else { 1 };
    let final_payload = WaveformChunkPayload {
        clip_id: clip_id.to_string(),
        file_path: file_path.to_string(),
        chunk_index,
        total_chunks: total_chunks.max(1),
        points_per_sec,
        min_max_pairs: current_chunk,
        is_last_chunk: true,
    };
    let _ = app.emit("waveform-chunk-ready", &final_payload);

    // Persist full waveform peak array in memory cache
    if let Ok(mut cache) = get_mem_cache().lock() {
        cache.insert(file_path.to_string(), all_peaks.clone());
    }

    // Persist to binary disk cache: %LOCALAPPDATA%/idts-video-editor/cache/waveforms/{hash}.peaks
    let cache_dir = get_waveform_cache_dir();
    let _ = std::fs::create_dir_all(&cache_dir);
    let hash = compute_media_waveform_hash(file_path, points_per_sec);
    let disk_file = cache_dir.join(format!("{:016x}.peaks", hash));

    let mut write_bytes = Vec::with_capacity(all_peaks.len() * 4);
    for p in &all_peaks {
        write_bytes.extend_from_slice(&p.to_le_bytes());
    }
    let _ = std::fs::write(&disk_file, write_bytes);

    Ok(())
}
