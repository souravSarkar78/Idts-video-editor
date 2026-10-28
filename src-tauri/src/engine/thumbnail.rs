//! Video frame extraction engine for thumbnail generation and live filter preview cards.
//!
//! Extracts downscaled high-performance frame snapshots using sidecar FFmpeg into
//! `%LOCALAPPDATA%/idts-video-editor/temp_previews/` and returns base64 data URIs.

use std::path::{Path, PathBuf};
use crate::engine::ffmpeg::find_ffmpeg_executable;

const BASE64_CHARS: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/// Fast zero-dependency base64 encoder for image payload streaming.
fn encode_base64(data: &[u8]) -> String {
    let mut out = String::with_capacity((data.len() + 2) / 3 * 4);
    for chunk in data.chunks(3) {
        let b0 = chunk[0] as u32;
        let b1 = if chunk.len() > 1 { chunk[1] as u32 } else { 0 };
        let b2 = if chunk.len() > 2 { chunk[2] as u32 } else { 0 };
        let triple = (b0 << 16) | (b1 << 8) | b2;

        out.push(BASE64_CHARS[((triple >> 18) & 0x3F) as usize] as char);
        out.push(BASE64_CHARS[((triple >> 12) & 0x3F) as usize] as char);
        if chunk.len() > 1 {
            out.push(BASE64_CHARS[((triple >> 6) & 0x3F) as usize] as char);
        } else {
            out.push('=');
        }
        if chunk.len() > 2 {
            out.push(BASE64_CHARS[(triple & 0x3F) as usize] as char);
        } else {
            out.push('=');
        }
    }
    out
}

/// Resolves the preview cache directory in LocalAppData.
pub fn get_preview_cache_dir() -> PathBuf {
    #[cfg(target_os = "windows")]
    {
        if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
            return PathBuf::from(local_app_data)
                .join("idts-video-editor")
                .join("temp_previews");
        }
    }

    std::env::temp_dir()
        .join("idts-video-editor")
        .join("temp_previews")
}

/// Extracts a downscaled 16:9 preview frame (320x180) from a media source file at `timestamp_sec`.
///
/// Saves to `%LOCALAPPDATA%/idts-video-editor/temp_previews/current_frame.jpg` and
/// returns a `data:image/jpeg;base64,...` URI for instant WebGL texture binding.
pub fn capture_preview_frame(source_path: String, timestamp_sec: f64) -> Result<String, String> {
    let input_path = Path::new(&source_path);
    if !input_path.exists() {
        return Err(format!("Source video file does not exist: {}", source_path));
    }

    let cache_dir = get_preview_cache_dir();
    std::fs::create_dir_all(&cache_dir)
        .map_err(|e| format!("Failed to create preview cache directory: {}", e))?;

    let output_file = cache_dir.join("current_frame.jpg");

    let ffmpeg_bin = find_ffmpeg_executable()
        .ok_or_else(|| "Could not locate sidecar FFmpeg binary".to_string())?;

    let ss_str = format!("{:.3}", timestamp_sec.max(0.0));

    let mut cmd = std::process::Command::new(ffmpeg_bin);
    cmd.args([
        "-y",
        "-ss",
        &ss_str,
        "-i",
        &source_path,
        "-vframes",
        "1",
        "-vf",
        "scale=320:180:force_original_aspect_ratio=decrease,pad=320:180:(ow-iw)/2:(oh-ih)/2",
        "-q:v",
        "3",
        output_file.to_str().unwrap_or("current_frame.jpg"),
    ]);

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }

    let output = cmd
        .output()
        .map_err(|e| format!("Failed to execute FFmpeg for frame extraction: {}", e))?;

    if !output.status.success() {
        let err_msg = String::from_utf8_lossy(&output.stderr);
        return Err(format!("FFmpeg frame extraction failed: {}", err_msg));
    }

    let frame_bytes = std::fs::read(&output_file)
        .map_err(|e| format!("Failed to read extracted frame file: {}", e))?;

    let b64 = encode_base64(&frame_bytes);
    Ok(format!("data:image/jpeg;base64,{}", b64))
}
