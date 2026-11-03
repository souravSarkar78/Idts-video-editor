//! Telemetry probing for embedded action cam and drone IMU sensors
//!
//! Detects GoPro GPMF (`gpmd`), DJI/Android/Insta360 Camera Motion Metadata (`camm`),
//! and Sony Real-Time Metadata (`rtmd`/`fdsc`).

use std::fs::File;
use std::io::{Read, Seek, SeekFrom};
use std::path::Path;
use std::process::Command;
use crate::models::ipc::TelemetryProbeResult;
use crate::engine::metadata::find_ffprobe_executable;

/// Probes media container for embedded IMU telemetry tracks
pub fn probe_clip_telemetry(media_path: &str) -> TelemetryProbeResult {
    let path = Path::new(media_path);
    if !path.exists() {
        return TelemetryProbeResult {
            has_gyro: false,
            gyro_format: None,
            manufacturer: None,
        };
    }

    // 1. Fast binary header/tail scan for known box tags
    if let Ok(res) = fast_binary_probe(path) {
        if res.has_gyro {
            return res;
        }
    }

    // 2. FFprobe stream inspection
    if let Ok(res) = ffprobe_telemetry_probe(media_path) {
        if res.has_gyro {
            return res;
        }
    }

    TelemetryProbeResult {
        has_gyro: false,
        gyro_format: None,
        manufacturer: None,
    }
}

/// Fast scan of container MP4/MOV header and footer for telemetry atom markers
fn fast_binary_probe(path: &Path) -> Result<TelemetryProbeResult, std::io::Error> {
    let mut file = File::open(path)?;
    let file_len = file.metadata()?.len();

    // Read first 2MB (or whole file)
    let head_size = (file_len as usize).min(2 * 1024 * 1024);
    let mut buffer = vec![0u8; head_size];
    file.read_exact(&mut buffer)?;

    if let Some(res) = inspect_buffer_for_telemetry(&buffer) {
        return Ok(res);
    }

    // Read last 1MB for moov atoms placed at file footer (common in camera MP4s)
    if file_len > 2 * 1024 * 1024 {
        let tail_size = ((file_len - head_size as u64) as usize).min(1024 * 1024);
        file.seek(SeekFrom::End(-(tail_size as i64)))?;
        let mut tail_buffer = vec![0u8; tail_size];
        file.read_exact(&mut tail_buffer)?;

        if let Some(res) = inspect_buffer_for_telemetry(&tail_buffer) {
            return Ok(res);
        }
    }

    Ok(TelemetryProbeResult {
        has_gyro: false,
        gyro_format: None,
        manufacturer: None,
    })
}

fn inspect_buffer_for_telemetry(buf: &[u8]) -> Option<TelemetryProbeResult> {
    // Check GoPro GPMF
    if buf.windows(4).any(|w| w == b"gpmd") || buf.windows(9).any(|w| w == b"GoPro MET") {
        return Some(TelemetryProbeResult {
            has_gyro: true,
            gyro_format: Some("GoPro GPMF".to_string()),
            manufacturer: Some("GoPro".to_string()),
        });
    }

    // Check DJI / Android / Insta360 CAMM
    if buf.windows(4).any(|w| w == b"camm") || buf.windows(8).any(|w| w == b"DJI.Meta") {
        let is_dji = buf.windows(8).any(|w| w == b"DJI.Meta");
        let is_insta = buf.windows(8).any(|w| w == b"Insta360");
        let mfg = if is_dji {
            "DJI"
        } else if is_insta {
            "Insta360"
        } else {
            "CAMM Camera Motion"
        };

        return Some(TelemetryProbeResult {
            has_gyro: true,
            gyro_format: Some("Camera Motion Metadata (camm)".to_string()),
            manufacturer: Some(mfg.to_string()),
        });
    }

    // Check Sony RTMD / FDSC
    if buf.windows(4).any(|w| w == b"rtmd") || buf.windows(4).any(|w| w == b"fdsc") {
        return Some(TelemetryProbeResult {
            has_gyro: true,
            gyro_format: Some("Sony Real-Time Metadata (rtmd)".to_string()),
            manufacturer: Some("Sony".to_string()),
        });
    }

    // Check Insta360 proprietary trailer
    if buf.windows(8).any(|w| w == b"Insta360") {
        return Some(TelemetryProbeResult {
            has_gyro: true,
            gyro_format: Some("Insta360 Gyro Telemetry".to_string()),
            manufacturer: Some("Insta360".to_string()),
        });
    }

    None
}

/// Uses ffprobe to identify data streams tagged as telemetry
fn ffprobe_telemetry_probe(media_path: &str) -> Result<TelemetryProbeResult, String> {
    let ffprobe_bin = match find_ffprobe_executable() {
        Some(bin) => bin,
        None => return Ok(TelemetryProbeResult { has_gyro: false, gyro_format: None, manufacturer: None }),
    };

    let mut cmd = Command::new(&ffprobe_bin);
    cmd.args([
        "-v",
        "error",
        "-show_entries",
        "stream=index,codec_name,codec_tag_string,handler_name",
        "-show_entries",
        "format_tags",
        "-of",
        "json",
        media_path,
    ]);

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }

    let output = cmd.output().map_err(|e| format!("ffprobe failed: {}", e))?;
    if !output.status.success() {
        return Ok(TelemetryProbeResult { has_gyro: false, gyro_format: None, manufacturer: None });
    }

    let out_str = String::from_utf8_lossy(&output.stdout);
    let val: serde_json::Value = serde_json::from_str(&out_str).map_err(|e| e.to_string())?;

    if let Some(streams) = val.get("streams").and_then(|s| s.as_array()) {
        for s in streams {
            let codec_name = s.get("codec_name").and_then(|v| v.as_str()).unwrap_or("");
            let codec_tag = s.get("codec_tag_string").and_then(|v| v.as_str()).unwrap_or("");
            let handler = s.get("handler_name").and_then(|v| v.as_str()).unwrap_or("");

            if codec_name.contains("gpmd") || codec_tag.contains("gpmd") || handler.contains("GoPro") {
                return Ok(TelemetryProbeResult {
                    has_gyro: true,
                    gyro_format: Some("GoPro GPMF".to_string()),
                    manufacturer: Some("GoPro".to_string()),
                });
            }
            if codec_name.contains("camm") || codec_tag.contains("camm") || handler.contains("DJI") {
                return Ok(TelemetryProbeResult {
                    has_gyro: true,
                    gyro_format: Some("Camera Motion Metadata (camm)".to_string()),
                    manufacturer: Some(if handler.contains("DJI") { "DJI".to_string() } else { "CAMM".to_string() }),
                });
            }
            if codec_name.contains("rtmd") || codec_tag.contains("rtmd") || codec_name.contains("fdsc") {
                return Ok(TelemetryProbeResult {
                    has_gyro: true,
                    gyro_format: Some("Sony Real-Time Metadata (rtmd)".to_string()),
                    manufacturer: Some("Sony".to_string()),
                });
            }
        }
    }

    Ok(TelemetryProbeResult {
        has_gyro: false,
        gyro_format: None,
        manufacturer: None,
    })
}
