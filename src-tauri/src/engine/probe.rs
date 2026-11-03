//! Lightweight media metadata probing using ffprobe sidecar.
//!
//! Executes ffprobe without decoding video frames or loading packet payloads into memory.

use std::path::Path;
use std::process::Command;
use serde::Deserialize;

use crate::models::ipc::ClipMetadata;
use crate::engine::metadata::{find_ffprobe_executable, parse_fractional_fps};

#[derive(Debug, Deserialize)]
struct FFprobeStreamEntry {
    codec_type: Option<String>,
    codec_name: Option<String>,
    width: Option<u32>,
    height: Option<u32>,
    r_frame_rate: Option<String>,
    sample_rate: Option<String>,
    channels: Option<u16>,
    duration: Option<String>,
}

#[derive(Debug, Deserialize)]
struct FFprobeFormatEntry {
    duration: Option<String>,
    size: Option<String>,
    tags: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
struct FFprobeProbeOutput {
    streams: Option<Vec<FFprobeStreamEntry>>,
    format: Option<FFprobeFormatEntry>,
}

/// Probes media container and stream headers strictly lightweight.
/// Does not read video frames or buffer video packets in memory.
pub fn probe_clip_lightweight(file_path: &str) -> Result<ClipMetadata, String> {
    let path = Path::new(file_path);
    if !path.exists() {
        return Err(format!("File does not exist: {}", file_path));
    }

    let ffprobe_bin = find_ffprobe_executable()
        .ok_or_else(|| "Could not locate ffprobe executable".to_string())?;

    let mut cmd = Command::new(&ffprobe_bin);
    cmd.args([
        "-v",
        "error",
        "-show_entries",
        "stream=codec_type,codec_name,width,height,duration,r_frame_rate,sample_rate,channels:format=duration,size:format_tags=creation_time,DATE,creation_time_utc",
        "-of",
        "json",
        file_path,
    ]);

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }

    let output = cmd
        .output()
        .map_err(|e| format!("Failed to execute ffprobe: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("ffprobe failed (status {}): {}", output.status, stderr));
    }

    let stdout_str = String::from_utf8_lossy(&output.stdout);
    let probe_data: FFprobeProbeOutput = serde_json::from_str(&stdout_str)
        .map_err(|e| format!("Failed to parse ffprobe JSON output: {}", e))?;

    let mut metadata = ClipMetadata::default();

    // 1. Container-level duration and size
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
            if let Some(tags_obj) = tags.as_object() {
                for key in ["creation_time", "DATE", "creation_time_utc", "date"] {
                    if let Some(val) = tags_obj.get(key).and_then(|v| v.as_str()) {
                        metadata.creation_time = Some(val.to_string());
                        break;
                    }
                }
            }
        }
    }

    // Fallback file size if missing from format
    if metadata.file_size_bytes.is_none() {
        if let Ok(fs_meta) = std::fs::metadata(path) {
            metadata.file_size_bytes = Some(fs_meta.len());
        }
    }

    // 2. Stream-level metadata (Video first, then Audio)
    if let Some(streams) = &probe_data.streams {
        for s in streams {
            let codec_type = s.codec_type.as_deref().unwrap_or("");
            if codec_type.eq_ignore_ascii_case("video") && metadata.width.is_none() {
                metadata.width = s.width;
                metadata.height = s.height;
                metadata.codec = s.codec_name.clone();

                if let Some(r_fps) = &s.r_frame_rate {
                    metadata.framerate = parse_fractional_fps(r_fps);
                }

                if metadata.duration_seconds == 0.0 {
                    if let Some(dur_str) = &s.duration {
                        if let Ok(dur) = dur_str.trim().parse::<f64>() {
                            metadata.duration_seconds = dur;
                        }
                    }
                }
            } else if codec_type.eq_ignore_ascii_case("audio") && metadata.sample_rate.is_none() {
                if let Some(sr_str) = &s.sample_rate {
                    metadata.sample_rate = sr_str.trim().parse::<u32>().ok();
                }
                metadata.channels = s.channels;

                if metadata.codec.is_none() {
                    metadata.codec = s.codec_name.clone();
                }

                if metadata.duration_seconds == 0.0 {
                    if let Some(dur_str) = &s.duration {
                        if let Ok(dur) = dur_str.trim().parse::<f64>() {
                            metadata.duration_seconds = dur;
                        }
                    }
                }
            }
        }
    }

    // Minimum sensible duration fallback
    if metadata.duration_seconds <= 0.0 {
        metadata.duration_seconds = 1.0;
    }

    Ok(metadata)
}
