//! Audio cross-correlation synchronization module.
//!
//! Downsamples audio tracks to mono 8kHz, extracts normalized audio energy envelopes,
//! computes cross-correlation over lag intervals, and determines the millisecond timeline offset.

use std::io::Read;
use std::path::Path;
use std::process::{Command as StdCommand, Stdio};

use crate::engine::ffmpeg::find_ffmpeg_executable;

/// Samples per second for downsampled mono audio
const SAMPLE_RATE: usize = 8000;
/// Envelope frames per second (10ms per envelope window)
const ENVELOPE_HZ: usize = 100;
/// Window size in audio samples for each envelope frame (8000 / 100 = 80 samples)
const SAMPLES_PER_FRAME: usize = SAMPLE_RATE / ENVELOPE_HZ;
/// Maximum search lag in seconds (covers ±60 seconds offset)
const MAX_SEARCH_LAG_SECS: f64 = 60.0;

/// Extracts an audio energy envelope from a media file up to `max_duration_sec`.
pub fn extract_audio_envelope(file_path: &str, max_duration_sec: f64) -> Result<Vec<f32>, String> {
    let p = Path::new(file_path);
    if !p.exists() {
        return Err(format!("Media file does not exist: {}", file_path));
    }

    let ffmpeg_bin = find_ffmpeg_executable()
        .ok_or_else(|| "Could not locate ffmpeg sidecar binary".to_string())?;

    let dur_str = format!("{:.1}", max_duration_sec.max(5.0));

    let mut cmd = StdCommand::new(&ffmpeg_bin);
    cmd.args([
        "-v", "quiet",
        "-y",
        "-t", &dur_str,
        "-i", file_path,
        "-vn",
        "-ac", "1",
        "-ar", &SAMPLE_RATE.to_string(),
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
    let mut stdout = child.stdout.take().ok_or_else(|| "Failed to capture ffmpeg stdout".to_string())?;

    let mut raw_bytes = Vec::new();
    stdout.read_to_end(&mut raw_bytes).map_err(|e| format!("Failed to read raw audio data: {}", e))?;
    let _ = child.wait();

    let sample_count = raw_bytes.len() / 4;
    if sample_count == 0 {
        return Err(format!("No audio stream found in file: {}", file_path));
    }

    let mut samples = Vec::with_capacity(sample_count);
    for chunk in raw_bytes.chunks_exact(4) {
        let val = f32::from_le_bytes([chunk[0], chunk[1], chunk[2], chunk[3]]);
        samples.push(val);
    }

    // Compute envelope using RMS per 10ms frame
    let frame_count = sample_count / SAMPLES_PER_FRAME;
    let mut envelope = Vec::with_capacity(frame_count);

    for chunk in samples.chunks(SAMPLES_PER_FRAME) {
        if chunk.is_empty() {
            continue;
        }
        let sum_sq: f32 = chunk.iter().map(|&s| s * s).sum();
        let rms = (sum_sq / chunk.len() as f32).sqrt();
        envelope.push(rms);
    }

    // Smooth envelope slightly (3-tap box filter)
    if envelope.len() >= 3 {
        for i in 1..envelope.len() - 1 {
            envelope[i] = (envelope[i - 1] + envelope[i] * 2.0 + envelope[i + 1]) / 4.0;
        }
    }

    Ok(envelope)
}

/// Computes normalized cross-correlation between two audio envelopes and finds the lag in milliseconds.
/// Positive lag means Track B is delayed relative to Track A (starts later).
/// Negative lag means Track B starts before Track A.
pub fn compute_envelope_cross_correlation(
    env_a: &[f32],
    env_b: &[f32],
    envelope_rate_hz: f64,
) -> i64 {
    let n = env_a.len();
    let m = env_b.len();

    if n == 0 || m == 0 {
        return 0;
    }

    let max_lag_frames = ((MAX_SEARCH_LAG_SECS * envelope_rate_hz) as usize)
        .min(n)
        .min(m)
        .max(10);

    let min_lag = -(max_lag_frames as isize);
    let max_lag = max_lag_frames as isize;

    let mut best_score = -1.0f32;
    let mut best_lag: isize = 0;

    for lag in min_lag..=max_lag {
        let (a_start, b_start, len) = if lag >= 0 {
            let l = lag as usize;
            if l >= n {
                continue;
            }
            (l, 0, (n - l).min(m))
        } else {
            let l = (-lag) as usize;
            if l >= m {
                continue;
            }
            (0, l, n.min(m - l))
        };

        // Require at least 1 second (100 frames) of overlapping content
        if len < (envelope_rate_hz as usize).max(30) {
            continue;
        }

        let slice_a = &env_a[a_start..a_start + len];
        let slice_b = &env_b[b_start..b_start + len];

        let mean_a = slice_a.iter().sum::<f32>() / len as f32;
        let mean_b = slice_b.iter().sum::<f32>() / len as f32;

        let mut dot = 0.0f32;
        let mut var_a = 0.0f32;
        let mut var_b = 0.0f32;

        for i in 0..len {
            let da = slice_a[i] - mean_a;
            let db = slice_b[i] - mean_b;
            dot += da * db;
            var_a += da * da;
            var_b += db * db;
        }

        let denom = (var_a * var_b).sqrt();
        let corr = if denom > 1e-6 {
            dot / denom
        } else {
            0.0
        };

        if corr > best_score {
            best_score = corr;
            best_lag = lag;
        }
    }

    // Convert frames to milliseconds
    let ms_per_frame = 1000.0 / envelope_rate_hz;
    (best_lag as f64 * ms_per_frame).round() as i64
}

/// Computes the relative millisecond timeline sync offset between primary and secondary tracks
/// using acoustic waveform cross-correlation.
#[tauri::command]
pub fn sync_by_audio(track_a_path: String, track_b_path: String) -> Result<i64, String> {
    if track_a_path.is_empty() || track_b_path.is_empty() {
        return Err("Audio sync requires two valid file paths".to_string());
    }

    let env_a = extract_audio_envelope(&track_a_path, 120.0)?;
    let env_b = extract_audio_envelope(&track_b_path, 120.0)?;

    let offset_ms = compute_envelope_cross_correlation(&env_a, &env_b, ENVELOPE_HZ as f64);
    Ok(offset_ms)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cross_correlation_synthetic_offset() {
        // Generate a 1000-sample synthetic test envelope with distinct peaks
        let mut env_a = vec![0.05f32; 1000];
        // Add signature pulses
        env_a[100] = 0.9;
        env_a[200] = 0.8;
        env_a[350] = 1.0;
        env_a[500] = 0.7;
        env_a[650] = 0.95;

        // Create env_b delayed by 50 frames (at 100Hz = 500ms)
        let delay_frames = 50;
        let mut env_b = vec![0.05f32; 1000];
        for i in 0..1000 - delay_frames {
            env_b[i + delay_frames] = env_a[i];
        }

        let offset = compute_envelope_cross_correlation(&env_a, &env_b, 100.0);
        assert_eq!(offset, 500, "Should detect exactly 500ms delay");
    }

    #[test]
    fn test_cross_correlation_zero_lag() {
        let mut env = vec![0.1f32; 500];
        env[150] = 0.85;
        env[300] = 0.95;

        let offset = compute_envelope_cross_correlation(&env, &env, 100.0);
        assert_eq!(offset, 0, "Identical envelopes should have 0ms offset");
    }
}
