//! Spectral Noise Profiling & Intelligent Ambient Noise Fill Engine
//!
//! Provides two-pass spectral audio profiling via FFmpeg `afftdn`, seamless room-tone
//! loop synthesis, and automated silence-cut ambient bridging for natural speech transitions.

use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Command as StdCommand, Stdio};
use serde::{Deserialize, Serialize};

use crate::engine::ffmpeg::find_ffmpeg_executable;
use crate::models::ipc::SilenceInterval;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AmbientBridgeClip {
    pub start_sec: f64,
    pub duration_sec: f64,
    pub audio_file_path: String,
    pub gain: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AutoCutResult {
    pub speech_intervals: Vec<SilenceInterval>,
    pub cut_intervals: Vec<SilenceInterval>,
    pub ambient_bridges: Vec<AmbientBridgeClip>,
    pub message: String,
}

/// Helper to get or create the local app data directory for noise profiles and cache
pub fn get_noise_profile_dir() -> Result<PathBuf, String> {
    let base = if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
        PathBuf::from(local_app_data).join("idts-video-editor").join("noise_profiles")
    } else if let Ok(user_profile) = std::env::var("USERPROFILE") {
        PathBuf::from(user_profile).join(".idts-video-editor").join("noise_profiles")
    } else {
        std::env::temp_dir().join("idts-video-editor").join("noise_profiles")
    };

    if !base.exists() {
        fs::create_dir_all(&base)
            .map_err(|e| format!("Failed to create noise profile directory: {}", e))?;
    }
    Ok(base)
}

/// Clean up Windows file URI formatting
fn normalize_path(path: &str) -> String {
    let mut clean = path.trim();
    if clean.starts_with("file:///") {
        clean = &clean[8..];
    } else if clean.starts_with("file://") {
        clean = &clean[7..];
    }
    #[cfg(target_os = "windows")]
    if clean.starts_with('/') && clean.chars().nth(2) == Some(':') {
        clean = &clean[1..];
    }
    clean.to_string()
}

/// Simple hash helper for cached noise profile files
fn compute_sample_hash(source_path: &str, start_sec: f64, duration_sec: f64) -> String {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};

    let mut hasher = DefaultHasher::new();
    source_path.hash(&mut hasher);
    ((start_sec * 1000.0) as i64).hash(&mut hasher);
    ((duration_sec * 1000.0) as i64).hash(&mut hasher);
    format!("{:x}", hasher.finish())
}

/// Two-pass spectral noise profiler:
/// 1. Extracts ambient sample audio at start_sec with duration_sec (clamped 0.2s - 10.0s).
/// 2. Synthesizes a seamless loop tile (`room_tone_{hash}.wav`) with micro-crossfades to prevent seam pops.
/// 3. Returns `(profile_path, room_tone_path)`.
pub fn capture_noise_profile(
    source_path: String,
    start_sec: f64,
    duration_sec: f64,
) -> Result<(String, String), String> {
    let clean_path = normalize_path(&source_path);
    let p = Path::new(&clean_path);
    if !p.exists() {
        return Err(format!("Source media file does not exist: {}", clean_path));
    }

    let ffmpeg_bin = find_ffmpeg_executable()
        .ok_or_else(|| "Could not locate FFmpeg binary for noise profiling".to_string())?;

    let dur = duration_sec.clamp(0.2, 10.0);
    let start = start_sec.max(0.0);
    let hash = compute_sample_hash(&clean_path, start, dur);
    let cache_dir = get_noise_profile_dir()?;

    let sample_wav = cache_dir.join(format!("sample_{}.wav", hash));
    let profile_bin = cache_dir.join(format!("profile_{}.bin", hash));
    let room_tone_wav = cache_dir.join(format!("room_tone_{}.wav", hash));

    // 1. Extract 48kHz stereo noise sample from source
    let mut extract_cmd = StdCommand::new(&ffmpeg_bin);
    extract_cmd.args([
        "-y",
        "-ss",
        &format!("{:.3}", start),
        "-t",
        &format!("{:.3}", dur),
        "-i",
        &clean_path,
        "-vn",
        "-sn",
        "-ar",
        "48000",
        "-ac",
        "2",
        sample_wav.to_str().unwrap_or("sample.wav"),
    ]);
    extract_cmd.stdout(Stdio::null());
    extract_cmd.stderr(Stdio::piped());

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        extract_cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }

    let out = extract_cmd
        .output()
        .map_err(|e| format!("Failed to spawn FFmpeg to extract noise sample: {}", e))?;
    if !out.status.success() {
        let err = String::from_utf8_lossy(&out.stderr);
        return Err(format!("FFmpeg failed extracting noise sample: {}", err.trim()));
    }

    // 2. Synthesize seamless loopable room-tone tile using smooth boundary crossfade
    // To ensure the room tone loops indefinitely without clicks, apply 30ms head/tail S-curve fades
    let fade_dur = (dur * 0.1).clamp(0.02, 0.1);
    let fade_out_start = (dur - fade_dur).max(0.0);
    let loop_filter = format!(
        "afade=t=in:ss=0:d={:.3}:curve=hsin,afade=t=out:st={:.3}:d={:.3}:curve=hsin",
        fade_dur, fade_out_start, fade_dur
    );

    let mut loop_cmd = StdCommand::new(&ffmpeg_bin);
    loop_cmd.args([
        "-y",
        "-i",
        sample_wav.to_str().unwrap_or("sample.wav"),
        "-af",
        &loop_filter,
        "-ar",
        "48000",
        "-ac",
        "2",
        room_tone_wav.to_str().unwrap_or("room_tone.wav"),
    ]);
    loop_cmd.stdout(Stdio::null());
    loop_cmd.stderr(Stdio::piped());

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        loop_cmd.creation_flags(0x08000000);
    }

    let _ = loop_cmd.output();

    // 2.2 Measure true noise floor of the captured ambient noise sample
    let sample_noise_floor = measure_sample_volume(&ffmpeg_bin, &sample_wav);

    // 2.5 Extract precise 15-band custom noise profile using FFmpeg runtime analyzer
    let custom_band_noise = extract_band_noise_profile(&ffmpeg_bin, &sample_wav, dur);

    // 3. Write metadata to profile_bin
    let profile_meta = serde_json::json!({
        "sourcePath": clean_path,
        "sampleStartSec": start,
        "sampleDurationSec": dur,
        "sampleNoiseFloor": sample_noise_floor,
        "hash": hash,
        "sampleWavPath": sample_wav.to_string_lossy(),
        "roomTonePath": room_tone_wav.to_string_lossy(),
        "bandNoise": custom_band_noise,
        "createdAt": chrono_crate_now_iso(),
    });

    let _ = fs::write(&profile_bin, profile_meta.to_string());

    Ok((
        profile_bin.to_string_lossy().to_string(),
        room_tone_wav.to_string_lossy().to_string(),
    ))
}

fn measure_sample_volume(ffmpeg_bin: &Path, sample_wav: &Path) -> f32 {
    let mut cmd = StdCommand::new(ffmpeg_bin);
    cmd.args([
        "-v",
        "info",
        "-i",
        sample_wav.to_str().unwrap_or("sample.wav"),
        "-af",
        "volumedetect",
        "-f",
        "null",
        "-",
    ]);
    cmd.stdout(Stdio::null());
    cmd.stderr(Stdio::piped());
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000);
    }
    if let Ok(out) = cmd.output() {
        let err = String::from_utf8_lossy(&out.stderr);
        for line in err.lines() {
            if let Some(pos) = line.find("mean_volume:") {
                let rest = line[pos + 12..].trim();
                let num_str = rest.split_whitespace().next().unwrap_or("-35.0");
                if let Ok(val) = num_str.parse::<f32>() {
                    return val;
                }
            }
        }
    }
    -35.0
}

fn chrono_crate_now_iso() -> String {
    // Simple timestamp helper
    format!("{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0))
}

/// Runs FFmpeg sample_noise analyzer on the extracted noise snippet to capture exact 15-band spectral noise floor
fn extract_band_noise_profile(ffmpeg_bin: &Path, sample_wav: &Path, dur: f64) -> Option<String> {
    let stop_t = (dur * 0.9).max(0.1);
    let filter = format!("asendcmd=0.0 afftdn sn start,asendcmd={:.2} afftdn sn stop,afftdn", stop_t);

    let mut cmd = StdCommand::new(ffmpeg_bin);
    cmd.args([
        "-v",
        "info",
        "-y",
        "-i",
        sample_wav.to_str().unwrap_or("sample.wav"),
        "-af",
        &filter,
        "-f",
        "null",
        "-",
    ]);
    cmd.stdout(Stdio::null());
    cmd.stderr(Stdio::piped());

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000);
    }

    if let Ok(out) = cmd.output() {
        let err = String::from_utf8_lossy(&out.stderr);
        for line in err.lines().rev() {
            if let Some(pos) = line.find("bn=") {
                let bn_str = line[pos + 3..].trim();
                if !bn_str.is_empty() {
                    return Some(bn_str.to_string());
                }
            }
        }
    }
    None
}

/// Builds a surgical spectral filter matching whatever sound profile was captured in Step 1
pub fn build_spectral_filter_chain(
    custom_bn: Option<&str>,
    red_db: f32,
    sens: f32,
    gs: u32,
    mode: &str,
) -> String {
    if let Some(bn_str) = custom_bn {
        let bn_vals: Vec<f32> = bn_str
            .split_whitespace()
            .filter_map(|s| s.parse::<f32>().ok())
            .collect();

        if !bn_vals.is_empty() {
            // Center frequencies matching the octave bands
            let freqs = [
                25, 50, 100, 200, 400, 800, 1600, 3200, 6400, 12800, 16000, 18000, 19000, 20000, 22000,
            ];

            if mode == "n" {
                // For noise residue audition: isolate the frequencies that were captured
                let mut entries = Vec::new();
                for (i, &f) in freqs.iter().enumerate() {
                    let b = bn_vals.get(i).copied().unwrap_or(-24.0);
                    let w = ((b + 12.0) / 36.0).clamp(0.0, 1.0);
                    let gain = ((w - 1.0) * 48.0).clamp(-48.0, 0.0);
                    entries.push(format!("entry({},{})", f, gain));
                }
                let fireq = format!("firequalizer=gain_entry='{}'", entries.join(";"));
                return format!("highpass=f=40,{}", fireq);
            }

            let mut entries = Vec::new();
            for (i, &f) in freqs.iter().enumerate() {
                let b = bn_vals.get(i).copied().unwrap_or(-24.0);
                // Weight is 0.0 for quiet/absent frequencies, up to 1.0 for loud captured frequencies
                let w = ((b + 12.0) / 36.0).clamp(0.0, 1.0);
                let cut = -(red_db * w * (sens / 6.0)).clamp(0.0, 48.0);
                entries.push(format!("entry({},{})", f, cut));
            }

            let fireq = format!("firequalizer=gain_entry='{}'", entries.join(";"));
            let nf = (-45.0 + (sens / 12.0) * 22.0).clamp(-50.0, -22.0);
            return format!("highpass=f=40,{},afftdn=nr={:.1}:nf={:.1}:bm=1.5:gs={}:om={}", fireq, red_db, nf, gs, mode);
        }
    }

    // Fallback if no custom profile: standard white-noise spectral gate
    let nf = (-45.0 + (sens / 12.0) * 22.0).clamp(-50.0, -22.0);
    format!("highpass=f=60,afftdn=nt=w:nr={:.1}:nf={:.1}:bm=1.25:gs={}:om={}", red_db, nf, gs, mode)
}

/// Helper to read custom band_noise and measured floor directly from a specific profile bin file
fn load_custom_band_noise(profile_path: Option<&str>) -> Option<(String, f32)> {
    let p_str = profile_path?;
    let trimmed = p_str.trim();
    if trimmed.is_empty() {
        return None;
    }
    let p = Path::new(trimmed);
    if !p.exists() {
        return None;
    }
    let content = fs::read_to_string(p).ok()?;
    let json: serde_json::Value = serde_json::from_str(&content).ok()?;
    let bn = json.get("bandNoise").and_then(|v| v.as_str())?.to_string();
    let mean_vol = json
        .get("sampleNoiseFloor")
        .and_then(|v| v.as_f64())
        .map(|v| v as f32)
        .unwrap_or(-35.0);
    Some((bn, mean_vol))
}

/// Renders a fast preview snippet (or whole clip) of clean denoised audio for the modal preview.
pub fn preview_spectral_denoise(
    source_path: String,
    profile_path: Option<String>,
    start_sec: f64,
    duration_sec: f64,
    reduction_db: f32,
    sensitivity: Option<f32>,
    smoothing_bands: Option<u32>,
    output_mode: Option<String>,
) -> Result<String, String> {
    let clean_path = normalize_path(&source_path);
    let p = Path::new(&clean_path);
    if !p.exists() {
        return Err(format!("Source media file does not exist: {}", clean_path));
    }

    let ffmpeg_bin = find_ffmpeg_executable()
        .ok_or_else(|| "Could not locate FFmpeg binary".to_string())?;

    let dur = duration_sec.clamp(0.5, 600.0);
    let start = start_sec.max(0.0);
    let red_db = reduction_db.clamp(0.0, 48.0);
    let sens = sensitivity.unwrap_or(6.0).clamp(0.5, 12.0);
    let gs = smoothing_bands.unwrap_or(6).clamp(0, 15);
    let mode = output_mode.unwrap_or_else(|| "o".to_string());

    let cache_dir = get_noise_profile_dir()?.join("previews");
    let _ = fs::create_dir_all(&cache_dir);

    let custom_info = load_custom_band_noise(profile_path.as_deref());
    let custom_bn = custom_info.map(|(bn, _)| bn);

    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};
    let mut hasher = DefaultHasher::new();
    clean_path.hash(&mut hasher);
    profile_path.hash(&mut hasher);
    ((start * 1000.0) as i64).hash(&mut hasher);
    ((dur * 1000.0) as i64).hash(&mut hasher);
    ((red_db * 10.0) as i64).hash(&mut hasher);
    ((sens * 10.0) as i64).hash(&mut hasher);
    gs.hash(&mut hasher);
    mode.hash(&mut hasher);
    custom_bn.hash(&mut hasher);
    let hash = format!("{:x}", hasher.finish());

    let out_wav = cache_dir.join(format!("preview_clean_{}.wav", hash));
    if out_wav.exists() {
        return Ok(out_wav.to_string_lossy().to_string());
    }

    let filter = build_spectral_filter_chain(custom_bn.as_deref(), red_db, sens, gs, &mode);

    let mut cmd = StdCommand::new(&ffmpeg_bin);
    cmd.args([
        "-y",
        "-ss",
        &format!("{:.3}", start),
        "-t",
        &format!("{:.3}", dur),
        "-i",
        &clean_path,
        "-vn",
        "-sn",
        "-af",
        &filter,
        "-ar",
        "48000",
        "-ac",
        "2",
        out_wav.to_str().unwrap_or("preview.wav"),
    ]);
    cmd.stdout(Stdio::null());
    cmd.stderr(Stdio::piped());

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000);
    }

    let output = cmd
        .output()
        .map_err(|e| format!("Failed to spawn FFmpeg for preview: {}", e))?;
    if !output.status.success() {
        let err = String::from_utf8_lossy(&output.stderr);
        return Err(format!("FFmpeg preview denoise failed: {}", err.trim()));
    }

    Ok(out_wav.to_string_lossy().to_string())
}

/// Applies spectral FFT noise reduction using FFmpeg's `afftdn` filter.
/// Output mode:
/// - "o": Clean denoised output
/// - "n": Audition noise residue only (what was removed)
pub fn apply_spectral_denoise(
    input_path: String,
    profile_path: String,
    reduction_db: f32,
    sensitivity: Option<f32>,
    smoothing_bands: Option<u32>,
    output_mode: Option<String>,
) -> Result<String, String> {
    let clean_path = normalize_path(&input_path);
    let p = Path::new(&clean_path);
    if !p.exists() {
        return Err(format!("Input audio file does not exist: {}", clean_path));
    }

    let ffmpeg_bin = find_ffmpeg_executable()
        .ok_or_else(|| "Could not locate FFmpeg executable for denoise".to_string())?;

    let cache_dir = get_noise_profile_dir()?;
    let denoise_dir = cache_dir.join("denoised");
    let _ = fs::create_dir_all(&denoise_dir);

    let red_db = reduction_db.clamp(0.0, 48.0);
    let sens = sensitivity.unwrap_or(6.0).clamp(0.5, 12.0);
    let gs = smoothing_bands.unwrap_or(6).clamp(0, 15);
    let mode = output_mode.unwrap_or_else(|| "o".to_string());

    let custom_info = load_custom_band_noise(Some(&profile_path));
    let custom_bn = custom_info.map(|(bn, _)| bn);

    let hash = format!("{:x}", {
        use std::collections::hash_map::DefaultHasher;
        use std::hash::{Hash, Hasher};
        let mut hasher = DefaultHasher::new();
        clean_path.hash(&mut hasher);
        profile_path.hash(&mut hasher);
        ((red_db * 10.0) as i64).hash(&mut hasher);
        ((sens * 10.0) as i64).hash(&mut hasher);
        gs.hash(&mut hasher);
        mode.hash(&mut hasher);
        custom_bn.hash(&mut hasher);
        hasher.finish()
    });

    let out_wav = denoise_dir.join(format!("denoised_{}.wav", hash));
    if out_wav.exists() {
        return Ok(out_wav.to_string_lossy().to_string());
    }

    let filter = build_spectral_filter_chain(custom_bn.as_deref(), red_db, sens, gs, &mode);

    let mut cmd = StdCommand::new(&ffmpeg_bin);
    cmd.args([
        "-y",
        "-i",
        &clean_path,
        "-vn",
        "-af",
        &filter,
        "-ar",
        "48000",
        "-ac",
        "2",
        out_wav.to_str().unwrap_or("denoised.wav"),
    ]);
    cmd.stdout(Stdio::null());
    cmd.stderr(Stdio::piped());

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000);
    }

    let output = cmd
        .output()
        .map_err(|e| format!("Failed to run FFmpeg denoise process: {}", e))?;
    if !output.status.success() {
        let err = String::from_utf8_lossy(&output.stderr);
        return Err(format!("FFmpeg denoise failed: {}", err.trim()));
    }

    Ok(out_wav.to_string_lossy().to_string())
}

/// Automated silence cut planning with edge padding and intelligent ambient noise bridging.
///
/// Takes silence intervals, expands spoken speech segments with `padding_ms` margin,
/// and if ambient recovery is enabled, constructs ambient audio bridge clips across cut seams.
pub fn plan_auto_cut_silence_with_ambient(
    total_duration_sec: f64,
    raw_silences: Vec<SilenceInterval>,
    padding_ms: u32,
    ambient_recovery_enabled: bool,
    ambient_fill_intensity: f32,
    room_tone_path: Option<String>,
) -> AutoCutResult {
    let padding_sec = (padding_ms as f64 / 1000.0).clamp(0.01, 0.2);

    // Filter silences that have positive duration
    let mut cut_intervals: Vec<SilenceInterval> = Vec::new();
    for s in raw_silences {
        let start_padded = s.start_sec + padding_sec;
        let end_padded = s.end_sec - padding_sec;
        if end_padded > start_padded + 0.05 {
            cut_intervals.push(SilenceInterval {
                start_sec: start_padded,
                end_sec: end_padded,
                duration_sec: end_padded - start_padded,
            });
        }
    }

    // Invert cuts to obtain speech intervals spanning [0.0, total_duration_sec]
    let mut speech_intervals: Vec<SilenceInterval> = Vec::new();
    let mut current_pos = 0.0;

    for cut in &cut_intervals {
        if cut.start_sec > current_pos + 0.04 {
            speech_intervals.push(SilenceInterval {
                start_sec: current_pos,
                end_sec: cut.start_sec,
                duration_sec: cut.start_sec - current_pos,
            });
        }
        current_pos = cut.end_sec;
    }

    if current_pos < total_duration_sec - 0.04 {
        speech_intervals.push(SilenceInterval {
            start_sec: current_pos,
            end_sec: total_duration_sec,
            duration_sec: total_duration_sec - current_pos,
        });
    }

    // Build ambient bridge clips across cut seams if ambient recovery is enabled
    let mut ambient_bridges: Vec<AmbientBridgeClip> = Vec::new();
    if ambient_recovery_enabled {
        if let Some(ref tone_path) = room_tone_path {
            if Path::new(tone_path).exists() {
                for cut in &cut_intervals {
                    ambient_bridges.push(AmbientBridgeClip {
                        start_sec: cut.start_sec,
                        duration_sec: cut.duration_sec,
                        audio_file_path: tone_path.clone(),
                        gain: ambient_fill_intensity.clamp(0.0, 1.0),
                    });
                }
            }
        }
    }

    let cut_count = cut_intervals.len();
    let message = format!(
        "Detected {} silence gap(s); generated {} speech slice(s) and {} ambient fill bridge(s)",
        cut_count,
        speech_intervals.len(),
        ambient_bridges.len()
    );

    AutoCutResult {
        speech_intervals,
        cut_intervals,
        ambient_bridges,
        message,
    }
}
