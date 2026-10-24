//! Media metadata extraction module using ffprobe sidecar.
//!
//! Invokes ffprobe to extract stream, codec, format, framerate, and timing information
//! from video and audio containers.

use serde::Deserialize;
use std::path::{Path, PathBuf};
use std::process::Command;

use crate::models::ipc::ClipMetadata;

/// Internal raw structure for deserializing ffprobe JSON stream entries
#[derive(Debug, Deserialize)]
struct FFprobeStream {
    codec_type: Option<String>,
    codec_name: Option<String>,
    width: Option<u32>,
    height: Option<u32>,
    r_frame_rate: Option<String>,
    avg_frame_rate: Option<String>,
    sample_rate: Option<String>,
    channels: Option<u16>,
    duration: Option<String>,
    tags: Option<serde_json::Value>,
}

/// Internal raw structure for deserializing ffprobe JSON format entries
#[derive(Debug, Deserialize)]
struct FFprobeFormat {
    duration: Option<String>,
    size: Option<String>,
    tags: Option<serde_json::Value>,
}

/// Internal top-level container for ffprobe `-print_format json` output
#[derive(Debug, Deserialize)]
struct FFprobeOutput {
    streams: Option<Vec<FFprobeStream>>,
    format: Option<FFprobeFormat>,
}

/// Resolves the absolute or relative path to the bundled ffprobe executable.
pub fn find_ffprobe_executable() -> Option<PathBuf> {
    // 1. Check relative to current working directory
    let candidate_paths = [
        PathBuf::from("src-tauri/binaries/ffprobe-x86_64-pc-windows-msvc.exe"),
        PathBuf::from("binaries/ffprobe-x86_64-pc-windows-msvc.exe"),
        PathBuf::from("ffprobe-x86_64-pc-windows-msvc.exe"),
        PathBuf::from("ffprobe.exe"),
    ];

    for path in &candidate_paths {
        if path.exists() {
            return Some(path.clone());
        }
    }

    // 2. Check relative to current running executable
    if let Ok(current_exe) = std::env::current_exe() {
        if let Some(exe_dir) = current_exe.parent() {
            let relative_candidates = [
                exe_dir.join("ffprobe.exe"),
                exe_dir.join("binaries").join("ffprobe-x86_64-pc-windows-msvc.exe"),
                exe_dir.join("ffprobe-x86_64-pc-windows-msvc.exe"),
                exe_dir.join("../src-tauri/binaries/ffprobe-x86_64-pc-windows-msvc.exe"),
            ];
            for path in &relative_candidates {
                if path.exists() {
                    return Some(path.clone());
                }
            }
        }
    }

    // 3. Fallback to system PATH `ffprobe`
    Some(PathBuf::from("ffprobe"))
}

/// Parses a fractional framerate string like "60/1" or "30000/1001" to f64.
pub fn parse_fractional_fps(fps_str: &str) -> Option<f64> {
    if fps_str.is_empty() || fps_str == "0/0" {
        return None;
    }

    if let Some((num_str, den_str)) = fps_str.split_once('/') {
        let num: f64 = num_str.trim().parse().ok()?;
        let den: f64 = den_str.trim().parse().ok()?;
        if den > 0.0 {
            Some(num / den)
        } else {
            None
        }
    } else {
        fps_str.trim().parse::<f64>().ok()
    }
}

/// Probes a media file using ffprobe and extracts comprehensive container and stream metadata.
pub fn probe_media_file(file_path: &str) -> Result<ClipMetadata, String> {
    let path = Path::new(file_path);
    if !path.exists() {
        return Err(format!("File does not exist: {}", file_path));
    }

    let ffprobe_bin = find_ffprobe_executable()
        .ok_or_else(|| "Could not locate ffprobe executable".to_string())?;

    let output = Command::new(&ffprobe_bin)
        .args([
            "-v",
            "quiet",
            "-print_format",
            "json",
            "-show_format",
            "-show_streams",
            file_path,
        ])
        .output()
        .map_err(|e| format!("Failed to execute ffprobe: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("ffprobe exited with status {}: {}", output.status, stderr));
    }

    let stdout_str = String::from_utf8_lossy(&output.stdout);
    let probe_data: FFprobeOutput = serde_json::from_str(&stdout_str)
        .map_err(|e| format!("Failed to parse ffprobe JSON output: {}", e))?;

    let mut metadata = ClipMetadata::default();

    // 1. Container-level metadata from `format`
    if let Some(format) = &probe_data.format {
        if let Some(dur_str) = &format.duration {
            if let Ok(dur) = dur_str.trim().parse::<f64>() {
                metadata.duration_seconds = dur;
            }
        }

        if let Some(size_str) = &format.size {
            if let Ok(size) = size_str.trim().parse::<u64>() {
                metadata.file_size_bytes = Some(size);
            }
        }

        if let Some(tags) = &format.tags {
            if let Some(creation_time) = tags.get("creation_time").and_then(|v| v.as_str()) {
                metadata.creation_time = Some(creation_time.to_string());
            }
        }
    }

    // 2. Stream-level metadata from `streams`
    if let Some(streams) = &probe_data.streams {
        // Find primary video stream
        let video_stream = streams.iter().find(|s| s.codec_type.as_deref() == Some("video"));
        if let Some(v) = video_stream {
            metadata.width = v.width;
            metadata.height = v.height;
            metadata.codec = v.codec_name.clone();

            // Extract framerate (try r_frame_rate first, then avg_frame_rate)
            if let Some(r_fps) = &v.r_frame_rate {
                metadata.framerate = parse_fractional_fps(r_fps);
            }
            if metadata.framerate.is_none() {
                if let Some(avg_fps) = &v.avg_frame_rate {
                    metadata.framerate = parse_fractional_fps(avg_fps);
                }
            }

            // Fallback duration from stream if format duration was absent
            if metadata.duration_seconds <= 0.0 {
                if let Some(dur_str) = &v.duration {
                    if let Ok(dur) = dur_str.trim().parse::<f64>() {
                        metadata.duration_seconds = dur;
                    }
                }
            }

            // Check stream tags for creation_time if format tag was absent
            if metadata.creation_time.is_none() {
                if let Some(tags) = &v.tags {
                    if let Some(ct) = tags.get("creation_time").and_then(|t| t.as_str()) {
                        metadata.creation_time = Some(ct.to_string());
                    }
                }
            }
        }

        // Find primary audio stream
        let audio_stream = streams.iter().find(|s| s.codec_type.as_deref() == Some("audio"));
        if let Some(a) = audio_stream {
            if let Some(sr_str) = &a.sample_rate {
                metadata.sample_rate = sr_str.trim().parse::<u32>().ok();
            }
            metadata.channels = a.channels;

            // If file is audio-only (no video codec), set audio codec
            if metadata.codec.is_none() {
                metadata.codec = a.codec_name.clone();
            }

            // Fallback duration from audio stream if still missing
            if metadata.duration_seconds <= 0.0 {
                if let Some(dur_str) = &a.duration {
                    if let Ok(dur) = dur_str.trim().parse::<f64>() {
                        metadata.duration_seconds = dur;
                    }
                }
            }
        }
    }

    Ok(metadata)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_fractional_fps() {
        assert_eq!(parse_fractional_fps("60/1"), Some(60.0));
        assert_eq!(parse_fractional_fps("30/1"), Some(30.0));
        let ntsc = parse_fractional_fps("30000/1001").unwrap();
        assert!((ntsc - 29.970029).abs() < 0.001);
        assert_eq!(parse_fractional_fps("24/1"), Some(24.0));
        assert_eq!(parse_fractional_fps("0/0"), None);
        assert_eq!(parse_fractional_fps(""), None);
    }
}
