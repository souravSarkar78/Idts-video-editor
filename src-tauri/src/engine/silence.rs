//! Audio silence detection module using FFmpeg sidecar.
//!
//! Analyzes video/audio tracks for low-volume intervals using FFmpeg's `silencedetect` audio filter,
//! returning frame-accurate time intervals for automated multi-track ripple silence excision.

use std::path::Path;
use std::process::{Command as StdCommand, Stdio};

use crate::engine::ffmpeg::find_ffmpeg_executable;
use crate::engine::metadata::probe_media_file;
use crate::models::ipc::SilenceInterval;

/// Detects intervals of silence in an audio/video file.
///
/// Runs FFmpeg with `silencedetect=noise=${threshold_db}dB:d=${duration_sec}` and parses
/// stdout/stderr for `silence_start` and `silence_end` markers.
///
/// Returns a list of `(start_sec, end_sec)` intervals.
pub fn detect_track_silence(
    path: String,
    threshold_db: f32,
    duration_sec: f32,
) -> Result<Vec<(f64, f64)>, String> {
    let mut clean_path = path.trim();
    if clean_path.starts_with("file:///") {
        clean_path = &clean_path[8..];
    } else if clean_path.starts_with("file://") {
        clean_path = &clean_path[7..];
    }
    #[cfg(target_os = "windows")]
    if clean_path.starts_with('/') && clean_path.chars().nth(2) == Some(':') {
        clean_path = &clean_path[1..];
    }

    let p = Path::new(clean_path);
    if !p.exists() {
        return Err(format!("Media file does not exist: {}", clean_path));
    }

    let ffmpeg_bin = find_ffmpeg_executable()
        .ok_or_else(|| "Could not locate ffmpeg executable for silence detection".to_string())?;

    let total_duration = probe_media_file(clean_path)
        .map(|m| m.duration_seconds)
        .unwrap_or(0.0);

    // Normalize threshold (e.g. -35 -> "-35dB", ensuring negative)
    let db_val = if threshold_db > 0.0 {
        -threshold_db
    } else {
        threshold_db
    };
    let min_dur = duration_sec.max(0.05);

    let filter_arg = format!("silencedetect=noise={}dB:d={}", db_val, min_dur);

    let mut cmd = StdCommand::new(&ffmpeg_bin);
    cmd.args([
        "-v", "info",
        "-i", clean_path,
        "-vn",
        "-sn",
        "-dn",
        "-af", &filter_arg,
        "-f", "null",
        "-",
    ]);
    cmd.stdout(Stdio::null());
    cmd.stderr(Stdio::piped());

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }

    let output = cmd
        .output()
        .map_err(|e| format!("Failed to spawn ffmpeg for silence detection: {}", e))?;

    let stderr_str = String::from_utf8_lossy(&output.stderr);
    if !output.status.success() && !stderr_str.contains("silence_") {
        let err_snippet = if stderr_str.len() > 300 {
            &stderr_str[stderr_str.len() - 300..]
        } else {
            &stderr_str
        };
        return Err(format!("FFmpeg error during silence detection: {}", err_snippet.trim()));
    }
    let mut intervals: Vec<(f64, f64)> = Vec::new();
    let mut current_start: Option<f64> = None;

    for line in stderr_str.lines() {
        if line.contains("silence_start:") {
            if let Some(pos) = line.find("silence_start:") {
                let after = &line[pos + 14..].trim();
                let token = after.split_whitespace().next().unwrap_or("");
                if let Ok(start) = token.parse::<f64>() {
                    current_start = Some(start);
                }
            }
        } else if line.contains("silence_end:") {
            if let Some(pos) = line.find("silence_end:") {
                let after = &line[pos + 12..].trim();
                let token = after.split_whitespace().next().unwrap_or("");
                // Format could be "18.234 | silence_duration: 5.889"
                let clean_token = token.split('|').next().unwrap_or("").trim();
                if let Ok(end) = clean_token.parse::<f64>() {
                    if let Some(start) = current_start.take() {
                        if end > start {
                            intervals.push((start, end));
                        }
                    }
                }
            }
        }
    }

    // If silence continued until the end of the file
    if let Some(start) = current_start {
        let end = if total_duration > start {
            total_duration
        } else {
            start + min_dur as f64
        };
        intervals.push((start, end));
    }

    Ok(intervals)
}

/// Helper returning structured `SilenceInterval` objects for rich frontend inspection
pub fn detect_track_silence_intervals(
    path: String,
    threshold_db: f32,
    duration_sec: f32,
) -> Result<Vec<SilenceInterval>, String> {
    let raw = detect_track_silence(path, threshold_db, duration_sec)?;
    Ok(raw
        .into_iter()
        .map(|(start_sec, end_sec)| SilenceInterval {
            start_sec,
            end_sec,
            duration_sec: (end_sec - start_sec).max(0.0),
        })
        .collect())
}
