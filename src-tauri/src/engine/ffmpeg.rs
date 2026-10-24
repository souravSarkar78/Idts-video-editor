//! FFmpeg and FFprobe sidecar invocation and command builder module.
//!
//! Invokes sidecars using the Tauri v2 shell API (`app.shell().sidecar("ffmpeg")`),
//! strictly adhering to Windows path conventions and domain isolation.

use serde::{Deserialize, Serialize};
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::process::{Command as StdCommand, Stdio};
use std::time::Instant;
use tauri::{AppHandle, Emitter, Runtime};
use tauri_plugin_shell::process::Command;
use tauri_plugin_shell::ShellExt;

use crate::engine::filtergraph::{
    build_color_filter_chain, escape_ffmpeg_filter_path, FilterGraph, VideoEncoder,
};
use crate::models::ipc::{
    ColorCorrection, ExportConfig as IpcExportConfig, ExportProgress, MediaType, TrackType, Transition,
};

/// Canonical Tauri sidecar executable names registered in `tauri.conf.json`.
pub const SIDECAR_FFMPEG: &str = "ffmpeg";
pub const SIDECAR_FFPROBE: &str = "ffprobe";

/// Errors originating from FFmpeg/FFprobe sidecar operations.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum EngineError {
    SidecarSpawn(String),
    SidecarExecution(String),
    InvalidConfiguration(String),
    FilterGraphError(String),
    EncoderDetectionFailed(String),
    Io(String),
}

impl std::fmt::Display for EngineError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::SidecarSpawn(msg) => write!(f, "Sidecar spawn error: {}", msg),
            Self::SidecarExecution(msg) => write!(f, "Sidecar execution error: {}", msg),
            Self::InvalidConfiguration(msg) => write!(f, "Invalid configuration: {}", msg),
            Self::FilterGraphError(msg) => write!(f, "Filtergraph error: {}", msg),
            Self::EncoderDetectionFailed(msg) => write!(f, "Encoder detection failed: {}", msg),
            Self::Io(msg) => write!(f, "IO error: {}", msg),
        }
    }
}

impl std::error::Error for EngineError {}

/// Instantiates a Tauri v2 sidecar command for `ffmpeg`.
pub fn sidecar_ffmpeg<R: Runtime>(app: &AppHandle<R>) -> Result<Command, EngineError> {
    app.shell()
        .sidecar(SIDECAR_FFMPEG)
        .map_err(|e| EngineError::SidecarSpawn(format!("Failed to spawn ffmpeg sidecar: {}", e)))
}

/// Instantiates a Tauri v2 sidecar command for `ffprobe`.
pub fn sidecar_ffprobe<R: Runtime>(app: &AppHandle<R>) -> Result<Command, EngineError> {
    app.shell()
        .sidecar(SIDECAR_FFPROBE)
        .map_err(|e| EngineError::SidecarSpawn(format!("Failed to spawn ffprobe sidecar: {}", e)))
}

// ============================================================================
// Probe Command Builders
// ============================================================================

/// Builds argument list for probing media files with ffprobe.
pub fn build_probe_args(file_path: &Path) -> Vec<String> {
    vec![
        "-v".to_string(),
        "quiet".to_string(),
        "-print_format".to_string(),
        "json".to_string(),
        "-show_format".to_string(),
        "-show_streams".to_string(),
        "-show_chapters".to_string(),
        "-i".to_string(),
        file_path.to_string_lossy().to_string(),
    ]
}

/// Creates a ready-to-execute ffprobe sidecar command to probe media metadata.
pub fn build_probe_command<R: Runtime>(
    app: &AppHandle<R>,
    file_path: &Path,
) -> Result<Command, EngineError> {
    let args = build_probe_args(file_path);
    Ok(sidecar_ffprobe(app)?.args(args))
}

/// Builds argument list for probing supported encoders via ffmpeg.
pub fn build_probe_encoders_args() -> Vec<String> {
    vec![
        "-v".to_string(),
        "quiet".to_string(),
        "-encoders".to_string(),
    ]
}

/// Creates a sidecar command to list available encoders.
pub fn build_probe_encoders_command<R: Runtime>(
    app: &AppHandle<R>,
) -> Result<Command, EngineError> {
    let args = build_probe_encoders_args();
    Ok(sidecar_ffmpeg(app)?.args(args))
}

// ============================================================================
// Preview Generation Command Builders
// ============================================================================

/// Configuration for extracting a single preview frame (thumbnail/scrub preview).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct PreviewFrameConfig {
    pub input_path: PathBuf,
    pub timestamp_secs: f64,
    pub output_path: PathBuf,
    pub filtergraph: Option<FilterGraph>,
    pub width: Option<u32>,
    pub height: Option<u32>,
}

impl PreviewFrameConfig {
    pub fn new(input_path: impl Into<PathBuf>, timestamp_secs: f64, output_path: impl Into<PathBuf>) -> Self {
        Self {
            input_path: input_path.into(),
            timestamp_secs,
            output_path: output_path.into(),
            filtergraph: None,
            width: None,
            height: None,
        }
    }

    pub fn with_filtergraph(mut self, filtergraph: FilterGraph) -> Self {
        self.filtergraph = Some(filtergraph);
        self
    }

    pub fn with_dimensions(mut self, width: u32, height: u32) -> Self {
        self.width = Some(width);
        self.height = Some(height);
        self
    }
}

/// Builds argument list for single preview frame generation.
pub fn build_preview_frame_args(config: &PreviewFrameConfig) -> Vec<String> {
    let mut args = Vec::new();

    // Fast seek before input
    args.push("-ss".to_string());
    args.push(format!("{:.3}", config.timestamp_secs));

    // Input path
    args.push("-i".to_string());
    args.push(config.input_path.to_string_lossy().to_string());

    // Filter complex or simple scale filter
    if let Some(ref fg) = config.filtergraph {
        if let Some(fc) = fg.build_filter_complex() {
            args.push("-filter_complex".to_string());
            args.push(fc);
            args.push("-map".to_string());
            args.push(format!("[{}]", fg.video_output_label));
        }
    } else if let (Some(w), Some(h)) = (config.width, config.height) {
        args.push("-vf".to_string());
        args.push(format!("scale={}:{}", w, h));
    }

    // Frame capture options
    args.push("-vframes".to_string());
    args.push("1".to_string());
    args.push("-q:v".to_string());
    args.push("2".to_string());
    args.push("-y".to_string());

    // Destination path
    args.push(config.output_path.to_string_lossy().to_string());

    args
}

/// Creates a sidecar command to extract a single video frame preview.
pub fn build_preview_frame_command<R: Runtime>(
    app: &AppHandle<R>,
    config: &PreviewFrameConfig,
) -> Result<Command, EngineError> {
    let args = build_preview_frame_args(config);
    Ok(sidecar_ffmpeg(app)?.args(args))
}

/// Configuration for short preview clip rendering (e.g. looped effect preview).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct PreviewClipConfig {
    pub input_path: PathBuf,
    pub start_secs: f64,
    pub duration_secs: f64,
    pub output_path: PathBuf,
    pub encoder: Option<VideoEncoder>,
    pub filtergraph: Option<FilterGraph>,
}

/// Builds argument list for preview clip rendering.
pub fn build_preview_clip_args(config: &PreviewClipConfig) -> Vec<String> {
    let mut args = Vec::new();

    args.push("-ss".to_string());
    args.push(format!("{:.3}", config.start_secs));
    args.push("-t".to_string());
    args.push(format!("{:.3}", config.duration_secs));

    args.push("-i".to_string());
    args.push(config.input_path.to_string_lossy().to_string());

    if let Some(ref fg) = config.filtergraph {
        args.extend(fg.build_command_args());
    }

    let encoder = config.encoder.unwrap_or(VideoEncoder::Libx264);
    args.extend(encoder.default_args(Some(23), None));

    args.push("-c:a".to_string());
    args.push("aac".to_string());
    args.push("-b:a".to_string());
    args.push("128k".to_string());

    args.push("-y".to_string());
    args.push(config.output_path.to_string_lossy().to_string());

    args
}

/// Creates a sidecar command to render a preview video clip.
pub fn build_preview_clip_command<R: Runtime>(
    app: &AppHandle<R>,
    config: &PreviewClipConfig,
) -> Result<Command, EngineError> {
    let args = build_preview_clip_args(config);
    Ok(sidecar_ffmpeg(app)?.args(args))
}

// ============================================================================
// Export Command Builders
// ============================================================================

/// Represents a single input stream/file segment for timeline export.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ExportInput {
    pub path: PathBuf,
    pub start_secs: Option<f64>,
    pub duration_secs: Option<f64>,
}

impl ExportInput {
    pub fn new(path: impl Into<PathBuf>) -> Self {
        Self {
            path: path.into(),
            start_secs: None,
            duration_secs: None,
        }
    }

    pub fn with_trim(mut self, start_secs: f64, duration_secs: f64) -> Self {
        self.start_secs = Some(start_secs);
        self.duration_secs = Some(duration_secs);
        self
    }
}

/// Configuration for timeline export / rendering.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ExportConfig {
    /// Video and audio inputs.
    pub inputs: Vec<ExportInput>,
    /// Target output file path.
    pub output_path: PathBuf,
    /// Video/Audio dynamic filtergraph (LUTs, afftdn, etc.).
    pub filtergraph: Option<FilterGraph>,
    /// Chosen video encoder (e.g. `H264Nvenc`, `H264Qsv`, etc.).
    pub encoder: VideoEncoder,
    /// Rate control quality metric (CRF / CQ / global_quality). Default: 23.
    pub quality: Option<u32>,
    /// Optional target video bitrate in kbps (e.g. 10000 for 10 Mbps).
    pub video_bitrate_kbps: Option<u32>,
    /// Target audio bitrate in kbps. Default: 192.
    pub audio_bitrate_kbps: Option<u32>,
    /// Target audio codec. Default: "aac".
    pub audio_codec: Option<String>,
    /// Optional output framerate.
    pub fps: Option<f64>,
    /// Overwrite destination file without prompting. Default: true.
    pub overwrite: bool,
    /// Arbitrary additional FFmpeg arguments.
    pub extra_args: Option<Vec<String>>,
}

impl ExportConfig {
    pub fn new(output_path: impl Into<PathBuf>, encoder: VideoEncoder) -> Self {
        Self {
            inputs: Vec::new(),
            output_path: output_path.into(),
            filtergraph: None,
            encoder,
            quality: Some(23),
            video_bitrate_kbps: None,
            audio_bitrate_kbps: Some(192),
            audio_codec: Some("aac".to_string()),
            fps: None,
            overwrite: true,
            extra_args: None,
        }
    }

    pub fn add_input(mut self, input: ExportInput) -> Self {
        self.inputs.push(input);
        self
    }

    pub fn with_filtergraph(mut self, filtergraph: FilterGraph) -> Self {
        self.filtergraph = Some(filtergraph);
        self
    }

    pub fn with_quality(mut self, quality: u32) -> Self {
        self.quality = Some(quality);
        self
    }

    pub fn with_video_bitrate(mut self, kbps: u32) -> Self {
        self.video_bitrate_kbps = Some(kbps);
        self
    }

    pub fn with_fps(mut self, fps: f64) -> Self {
        self.fps = Some(fps);
        self
    }
}

/// Builds the complete argument list for timeline export.
pub fn build_export_args(config: &ExportConfig) -> Vec<String> {
    let mut args = Vec::new();

    // Overwrite flag
    if config.overwrite {
        args.push("-y".to_string());
    }

    // Input files with optional trim parameters
    for input in &config.inputs {
        if let Some(start) = input.start_secs {
            args.push("-ss".to_string());
            args.push(format!("{:.3}", start));
        }
        if let Some(duration) = input.duration_secs {
            args.push("-t".to_string());
            args.push(format!("{:.3}", duration));
        }
        args.push("-i".to_string());
        args.push(input.path.to_string_lossy().to_string());
    }

    // Filtergraph arguments and stream mapping
    if let Some(ref fg) = config.filtergraph {
        args.extend(fg.build_command_args());
    } else {
        // Direct stream mapping without filtergraph
        args.push("-map".to_string());
        args.push("0:v".to_string());
        args.push("-map".to_string());
        args.push("0:a?".to_string());
    }

    // Video encoder parameters
    args.extend(config.encoder.default_args(config.quality, config.video_bitrate_kbps));

    // Optional framerate lock
    if let Some(fps) = config.fps {
        args.push("-r".to_string());
        args.push(format!("{:.2}", fps));
    }

    // Audio encoding parameters
    let audio_codec = config.audio_codec.as_deref().unwrap_or("aac");
    args.push("-c:a".to_string());
    args.push(audio_codec.to_string());

    let audio_bitrate = config.audio_bitrate_kbps.unwrap_or(192);
    args.push("-b:a".to_string());
    args.push(format!("{}k", audio_bitrate));

    // Container optimization for streaming & web playback
    args.push("-movflags".to_string());
    args.push("+faststart".to_string());

    // Extra user-specified args
    if let Some(ref extra) = config.extra_args {
        args.extend(extra.clone());
    }

    // Destination output path
    args.push(config.output_path.to_string_lossy().to_string());

    args
}

/// Creates a sidecar command to execute the timeline export.
pub fn build_export_command<R: Runtime>(
    app: &AppHandle<R>,
    config: &ExportConfig,
) -> Result<Command, EngineError> {
    if config.inputs.is_empty() {
        return Err(EngineError::InvalidConfiguration(
            "Export configuration must contain at least one input".to_string(),
        ));
    }

    let args = build_export_args(config);
    Ok(sidecar_ffmpeg(app)?.args(args))
}

/// Resolves the absolute or relative path to the bundled ffmpeg executable.
pub fn find_ffmpeg_executable() -> Option<PathBuf> {
    let candidate_paths = [
        PathBuf::from("src-tauri/binaries/ffmpeg-x86_64-pc-windows-msvc.exe"),
        PathBuf::from("binaries/ffmpeg-x86_64-pc-windows-msvc.exe"),
        PathBuf::from("ffmpeg-x86_64-pc-windows-msvc.exe"),
        PathBuf::from("ffmpeg.exe"),
    ];

    for path in &candidate_paths {
        if path.exists() {
            return Some(path.clone());
        }
    }

    if let Ok(current_exe) = std::env::current_exe() {
        if let Some(exe_dir) = current_exe.parent() {
            let relative_candidates = [
                exe_dir.join("ffmpeg.exe"),
                exe_dir.join("binaries").join("ffmpeg-x86_64-pc-windows-msvc.exe"),
                exe_dir.join("ffmpeg-x86_64-pc-windows-msvc.exe"),
                exe_dir.join("../src-tauri/binaries/ffmpeg-x86_64-pc-windows-msvc.exe"),
            ];
            for path in &relative_candidates {
                if path.exists() {
                    return Some(path.clone());
                }
            }
        }
    }

    Some(PathBuf::from("ffmpeg"))
}

#[derive(Debug, Clone)]
struct ExportClipItem {
    id: String,
    _track_id: String,
    path: String,
    start_sec: f64,
    duration_sec: f64,
    in_point_sec: f64,
    is_video: bool,
    has_audio: bool,
    input_index: usize,
    brightness: Option<f32>,
    contrast: Option<f32>,
    saturation: Option<f32>,
    temperature: Option<f32>,
    lut_path: Option<String>,
    volume_db: Option<f32>,
}

/// Executes timeline project export via FFmpeg sidecar, streaming real-time progress events.
pub fn execute_export<R: Runtime>(
    app: &AppHandle<R>,
    ipc_config: &IpcExportConfig,
) -> Result<(), String> {
    let ffmpeg_bin = find_ffmpeg_executable()
        .ok_or_else(|| "Could not locate ffmpeg sidecar binary".to_string())?;

    // Collect active tracks
    let tracks = if !ipc_config.tracks.is_empty() {
        &ipc_config.tracks
    } else if let Some(ref proj) = ipc_config.project {
        &proj.tracks
    } else {
        return Err("No tracks found to export".to_string());
    };

    // Collect project-level and track-level transitions
    let mut transitions: Vec<Transition> = if let Some(ref proj) = ipc_config.project {
        proj.transitions.clone()
    } else {
        Vec::new()
    };
    for track in tracks {
        if let Some(ref tr_list) = track.transitions {
            for t in tr_list {
                if !transitions.iter().any(|existing| existing.id == t.id) {
                    transitions.push(t.clone());
                }
            }
        }
    }

    // Filter active clips
    let mut active_clips: Vec<ExportClipItem> = Vec::new();
    let mut input_idx = 0;

    for track in tracks {
        if track.muted {
            continue;
        }

        let is_video_track = track.track_type == TrackType::Video;

        for clip in &track.clips {
            let start_sec = clip.start_position_seconds.unwrap_or(clip.start_time_ms as f64 / 1000.0);
            let duration_sec = clip.duration_seconds.unwrap_or(clip.duration_ms as f64 / 1000.0);
            let in_point_sec = clip.in_point_seconds.unwrap_or(0.0);

            if duration_sec <= 0.05 {
                continue;
            }

            let is_video = match clip.media_type {
                Some(MediaType::Video) => true,
                Some(MediaType::Audio) => false,
                _ => is_video_track,
            };

            let has_audio = match clip.media_type {
                Some(MediaType::Audio) => true,
                Some(MediaType::Video) => clip.metadata.as_ref().and_then(|m| m.channels).unwrap_or(2) > 0,
                _ => true,
            };

            let b = clip.color.as_ref().map(|c| c.brightness).or(clip.brightness);
            let c = clip.color.as_ref().map(|c| c.contrast).or(clip.contrast);
            let s = clip.color.as_ref().map(|c| c.saturation).or(clip.saturation);
            let t = clip.color.as_ref().map(|c| c.temperature).or(clip.temperature);
            let lut = clip.color.as_ref().and_then(|c| c.lut_path.clone()).or_else(|| clip.lut_path.clone());

            active_clips.push(ExportClipItem {
                id: clip.id.clone(),
                _track_id: track.id.clone(),
                path: clip.file_path.clone(),
                start_sec,
                duration_sec,
                in_point_sec,
                is_video,
                has_audio,
                input_index: input_idx,
                brightness: b,
                contrast: c,
                saturation: s,
                temperature: t,
                lut_path: lut,
                volume_db: clip.volume_db,
            });
            input_idx += 1;
        }
    }

    if active_clips.is_empty() {
        return Err("No active clips found on timeline to render".to_string());
    }

    // Ensure output parent directory exists
    let out_path = PathBuf::from(&ipc_config.output_path);
    if let Some(parent) = out_path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }

    // Check if input clips exist on disk.
    for clip in &active_clips {
        let p = Path::new(&clip.path);
        if !p.exists() {
            return Err(format!(
                "Input media file not found on disk: {}. Please import local media files to render.",
                clip.path
            ));
        }
    }

    let width = if ipc_config.width > 0 { ipc_config.width } else { 1920 };
    let height = if ipc_config.height > 0 { ipc_config.height } else { 1080 };
    let fps = if ipc_config.fps > 0.0 { ipc_config.fps } else { 30.0 };

    let total_duration_secs = active_clips
        .iter()
        .map(|c| c.start_sec + c.duration_sec)
        .fold(0.0f64, f64::max)
        .max(1.0);

    // Initial 0% progress
    let _ = app.emit(
        "export-progress",
        ExportProgress {
            percentage: 0.0,
            current_frame: 0,
            fps: 0.0,
            eta_seconds: None,
        },
    );

    // Try primary encoder, with fallback to libx264 if hardware encoder fails
    let encoders_to_try = if ipc_config.codec.to_lowercase().contains("nvenc") {
        vec!["h264_nvenc", "libx264"]
    } else if ipc_config.codec.to_lowercase().contains("qsv") {
        vec!["h264_qsv", "libx264"]
    } else if ipc_config.codec.to_lowercase().contains("amf") {
        vec!["h264_amf", "libx264"]
    } else {
        vec!["libx264"]
    };

    let mut last_error = String::new();

    for codec in encoders_to_try {
        match run_ffmpeg_export_process(
            app,
            &ffmpeg_bin,
            ipc_config,
            &active_clips,
            &transitions,
            width,
            height,
            fps,
            total_duration_secs,
            codec,
        ) {
            Ok(()) => {
                let _ = app.emit(
                    "export-progress",
                    ExportProgress {
                        percentage: 100.0,
                        current_frame: (total_duration_secs * fps).round() as u64,
                        fps: fps as f32,
                        eta_seconds: Some(0.0),
                    },
                );
                return Ok(());
            }
            Err((is_retryable, err)) => {
                last_error = err;
                if !is_retryable {
                    break;
                }
            }
        }
    }

    Err(last_error)
}

fn run_ffmpeg_export_process<R: Runtime>(
    app: &AppHandle<R>,
    ffmpeg_bin: &Path,
    ipc_config: &IpcExportConfig,
    active_clips: &[ExportClipItem],
    transitions: &[Transition],
    width: u32,
    height: u32,
    fps: f64,
    total_duration_secs: f64,
    codec: &str,
) -> Result<(), (bool, String)> {
    let mut args: Vec<String> = Vec::new();
    args.push("-y".to_string());

    // Inputs with trim
    for clip in active_clips {
        if clip.in_point_sec > 0.0 {
            args.push("-ss".to_string());
            args.push(format!("{:.3}", clip.in_point_sec));
        }
        args.push("-t".to_string());
        args.push(format!("{:.3}", clip.duration_sec));
        args.push("-i".to_string());
        args.push(clip.path.clone());
    }

    // Build -filter_complex
    let video_clips: Vec<&ExportClipItem> = active_clips.iter().filter(|c| c.is_video).collect();
    let audio_clips: Vec<&ExportClipItem> = active_clips.iter().filter(|c| c.has_audio).collect();

    let mut filter_chains: Vec<String> = Vec::new();

    // 1. Video Filtergraph
    let mut last_v = "v_base".to_string();
    filter_chains.push(format!(
        "color=c=black:s={}x{}:r={:.2}:d={:.3}[v_base]",
        width, height, fps, total_duration_secs
    ));

    for (idx, clip) in video_clips.iter().enumerate() {
        let v_scaled = format!("v_scaled_{}", idx);
        let next_v = format!("v_layer_{}", idx);
        let start = clip.start_sec;
        let end = clip.start_sec + clip.duration_sec;

        let mut v_filters = vec![
            format!("scale={}:{}:force_original_aspect_ratio=decrease", width, height),
            format!("pad={}:{}:(ow-iw)/2:(oh-ih)/2", width, height),
            "setsar=1".to_string(),
            format!("fps=fps={:.2}", fps),
            format!("setpts=PTS-STARTPTS+{:.3}/TB", start),
        ];

        // Clip-level Inspector color adjustments (eq, colorbalance temperature, 3D LUT)
        let color_corr = ColorCorrection {
            brightness: clip.brightness.unwrap_or(0.0),
            contrast: clip.contrast.unwrap_or(1.0),
            saturation: clip.saturation.unwrap_or(1.0),
            temperature: clip.temperature.unwrap_or(0.0),
            lut_path: clip.lut_path.clone(),
        };
        let color_filters = build_color_filter_chain(&color_corr);
        v_filters.extend(color_filters);

        // Transition in from prior clip on the same track
        if let Some(trans) = transitions.iter().find(|t| t.to_clip_id == clip.id) {
            let dur = trans.duration.min(clip.duration_sec * 0.5).max(0.1);
            match trans.transition_type.to_lowercase().as_str() {
                "fade" | "dip_black" | "black" => {
                    v_filters.push(format!("fade=t=in:st={:.3}:d={:.3}:alpha=1", start, dur));
                }
                "fadewhite" | "dip_white" | "white" => {
                    v_filters.push(format!("fade=t=in:st={:.3}:d={:.3}:color=white:alpha=1", start, dur));
                }
                "dissolve" | "crossdissolve" | _ => {
                    v_filters.push(format!("fade=t=in:st={:.3}:d={:.3}:alpha=1", start, dur));
                }
            }
        }

        // Transition out to next clip on the same track
        if let Some(trans) = transitions.iter().find(|t| t.from_clip_id == clip.id) {
            let dur = trans.duration.min(clip.duration_sec * 0.5).max(0.1);
            v_filters.push(format!("fade=t=out:st={:.3}:d={:.3}:alpha=1", (end - dur).max(start), dur));
        }

        filter_chains.push(format!(
            "[{}:v]{}[{}]",
            clip.input_index, v_filters.join(","), v_scaled
        ));

        filter_chains.push(format!(
            "[{}][{}]overlay=enable='between(t,{:.3},{:.3})':eof_action=pass[{}]",
            last_v, v_scaled, start, end, next_v
        ));
        last_v = next_v;
    }

    // Apply global project 3D LUT if requested
    if let Some(ref lut_path) = ipc_config.applied_lut_path {
        if !lut_path.trim().is_empty() {
            let escaped_lut = escape_ffmpeg_filter_path(Path::new(lut_path));
            let v_lut = "v_lut".to_string();
            filter_chains.push(format!("[{}]lut3d=file='{}'[{}]", last_v, escaped_lut, v_lut));
            last_v = v_lut;
        }
    }

    // 2. Audio Filtergraph
    let last_a = "a_out".to_string();
    if audio_clips.is_empty() {
        filter_chains.push(format!("anullsrc=r=48000:cl=stereo:d={:.3}[a_out]", total_duration_secs));
    } else {
        let mut a_labels = Vec::new();
        for (idx, clip) in audio_clips.iter().enumerate() {
            let a_delayed = format!("a_del_{}", idx);
            let delay_ms = (clip.start_sec * 1000.0).round() as i64;
            let mut a_filters = vec![format!("adelay={}|{}", delay_ms, delay_ms)];

            // Clip-level Inspector audio volume in dB
            if let Some(vol_db) = clip.volume_db {
                if vol_db.abs() > 0.05 {
                    a_filters.push(format!("volume={:.1}dB", vol_db));
                }
            }

            filter_chains.push(format!(
                "[{}:a]{}[{}]",
                clip.input_index, a_filters.join(","), a_delayed
            ));
            a_labels.push(format!("[{}]", a_delayed));
        }

        let a_mixed = "a_mix".to_string();
        if audio_clips.len() == 1 {
            filter_chains.push(format!("{}anull[{}]", a_labels[0], a_mixed));
        } else {
            filter_chains.push(format!(
                "{}amix=inputs={}:dropout_transition=0:normalize=0[{}]",
                a_labels.join(""),
                audio_clips.len(),
                a_mixed
            ));
        }

        if ipc_config.denoise_enabled {
            filter_chains.push(format!("[{}]afftdn=nr=12:nf=-50[a_out]", a_mixed));
        } else {
            filter_chains.push(format!("[{}]anull[a_out]", a_mixed));
        }
    }

    args.push("-filter_complex".to_string());
    args.push(filter_chains.join(";"));

    args.push("-map".to_string());
    args.push(format!("[{}]", last_v));

    args.push("-map".to_string());
    args.push(format!("[{}]", last_a));

    // Encoder parameters
    match codec {
        "h264_nvenc" => {
            args.extend([
                "-c:v".to_string(), "h264_nvenc".to_string(),
                "-gpu".to_string(), "0".to_string(),
                "-preset".to_string(), "p4".to_string(),
                "-tune".to_string(), "hq".to_string(),
                "-cq".to_string(), "23".to_string(),
                "-pix_fmt".to_string(), "yuv420p".to_string(),
            ]);
        }
        "h264_qsv" => {
            args.extend([
                "-c:v".to_string(), "h264_qsv".to_string(),
                "-preset".to_string(), "medium".to_string(),
                "-global_quality".to_string(), "23".to_string(),
                "-pix_fmt".to_string(), "nv12".to_string(),
            ]);
        }
        "h264_amf" => {
            args.extend([
                "-c:v".to_string(), "h264_amf".to_string(),
                "-quality".to_string(), "balanced".to_string(),
                "-rc".to_string(), "cqp".to_string(),
                "-qp_p".to_string(), "23".to_string(),
                "-qp_i".to_string(), "23".to_string(),
                "-pix_fmt".to_string(), "nv12".to_string(),
            ]);
        }
        _ => {
            args.extend([
                "-c:v".to_string(), "libx264".to_string(),
                "-preset".to_string(), "medium".to_string(),
                "-crf".to_string(), "23".to_string(),
                "-pix_fmt".to_string(), "yuv420p".to_string(),
            ]);
        }
    }

    // Audio & container options
    args.extend([
        "-c:a".to_string(), "aac".to_string(),
        "-b:a".to_string(), "192k".to_string(),
        "-movflags".to_string(), "+faststart".to_string(),
        "-progress".to_string(), "pipe:1".to_string(),
    ]);

    args.push(ipc_config.output_path.clone());

    // Launch FFmpeg process with pipe:1 for real-time progress
    let mut cmd = StdCommand::new(ffmpeg_bin);
    cmd.args(&args);

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }

    cmd.stdout(Stdio::piped());
    cmd.stderr(Stdio::piped());

    let mut child = cmd.spawn().map_err(|e| {
        (false, format!("Failed to spawn ffmpeg ({}): {}", ffmpeg_bin.display(), e))
    })?;

    let stdout = child.stdout.take().ok_or_else(|| {
        (false, "Failed to capture ffmpeg stdout".to_string())
    })?;

    let start_time = Instant::now();
    let reader = BufReader::new(stdout);

    let mut current_frame: u64 = 0;
    let mut current_fps: f32 = 0.0;
    let mut last_emit = Instant::now();

    for line in reader.lines() {
        if let Ok(l) = line {
            let trimmed = l.trim();
            if let Some(frame_str) = trimmed.strip_prefix("frame=") {
                current_frame = frame_str.trim().parse::<u64>().unwrap_or(current_frame);
            } else if let Some(fps_str) = trimmed.strip_prefix("fps=") {
                current_fps = fps_str.trim().parse::<f32>().unwrap_or(current_fps);
            } else if let Some(time_us_str) = trimmed.strip_prefix("out_time_us=") {
                if let Ok(us) = time_us_str.trim().parse::<i64>() {
                    let cur_sec = (us as f64 / 1_000_000.0).max(0.0);
                    let percentage = ((cur_sec / total_duration_secs) * 100.0).clamp(0.0, 99.0) as f32;

                    // Emit progress throttled to ~100ms
                    if last_emit.elapsed().as_millis() >= 90 {
                        last_emit = Instant::now();
                        let elapsed_sec = start_time.elapsed().as_secs_f32();
                        let eta = if percentage > 2.0 && percentage < 99.0 {
                            Some(((100.0 - percentage) / (percentage / elapsed_sec)).max(0.0))
                        } else {
                            None
                        };

                        let _ = app.emit(
                            "export-progress",
                            ExportProgress {
                                percentage,
                                current_frame,
                                fps: current_fps,
                                eta_seconds: eta,
                            },
                        );
                    }
                }
            }
        }
    }

    let status = child.wait().map_err(|e| (false, format!("FFmpeg wait error: {}", e)))?;

    if !status.success() {
        let stderr_out = child.stderr.take().map(|s| {
            let mut buf = String::new();
            let _ = std::io::Read::read_to_string(&mut std::io::BufReader::new(s), &mut buf);
            buf
        }).unwrap_or_default();

        let is_hw_error = codec != "libx264"
            && (stderr_out.contains("Device creation failed")
                || stderr_out.contains("Cannot load nvcuda")
                || stderr_out.contains("No NVENC capable devices")
                || stderr_out.contains("Function not implemented")
                || stderr_out.contains("Error while opening encoder"));

        return Err((is_hw_error, format!("FFmpeg render failed (codec: {}): {}", codec, stderr_out)));
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::engine::filtergraph::{AfftdnConfig, FilterGraph, VideoEncoder};
    use std::path::PathBuf;

    #[test]
    fn test_build_probe_args() {
        let path = PathBuf::from(r"C:\Media\sample.mp4");
        let args = build_probe_args(&path);
        assert_eq!(
            args,
            vec![
                "-v",
                "quiet",
                "-print_format",
                "json",
                "-show_format",
                "-show_streams",
                "-show_chapters",
                "-i",
                r"C:\Media\sample.mp4"
            ]
        );
    }

    #[test]
    fn test_build_preview_frame_args_with_lut() {
        let input = PathBuf::from(r"C:\Media\raw_footage.mp4");
        let output = PathBuf::from(r"C:\Media\thumb.jpg");
        let lut_path = PathBuf::from(r"C:\LUTs\teal_orange.cube");

        let graph = FilterGraph::builder()
            .add_lut3d(lut_path)
            .build();

        let config = PreviewFrameConfig::new(input, 15.5, output)
            .with_filtergraph(graph);

        let args = build_preview_frame_args(&config);
        assert_eq!(
            args,
            vec![
                "-ss",
                "15.500",
                "-i",
                r"C:\Media\raw_footage.mp4",
                "-filter_complex",
                "[0:v]lut3d=file='C\\:/LUTs/teal_orange.cube'[v_out]",
                "-map",
                "[v_out]",
                "-vframes",
                "1",
                "-q:v",
                "2",
                "-y",
                r"C:\Media\thumb.jpg"
            ]
        );
    }

    #[test]
    fn test_build_export_args_with_nvenc_and_denoise() {
        let input = ExportInput::new(r"C:\Clips\clip1.mp4").with_trim(2.0, 10.0);
        let output = PathBuf::from(r"C:\Exports\final_render.mp4");
        let lut = PathBuf::from(r"C:\LUTs\warm.cube");

        let graph = FilterGraph::builder()
            .add_lut3d(lut)
            .add_audio_denoise(Some(AfftdnConfig::default()))
            .build();

        let config = ExportConfig::new(output, VideoEncoder::H264Nvenc)
            .add_input(input)
            .with_filtergraph(graph)
            .with_quality(21)
            .with_fps(60.0);

        let args = build_export_args(&config);

        // Verify key command arguments
        assert!(args.contains(&"-y".to_string()));
        assert!(args.contains(&"-ss".to_string()));
        assert!(args.contains(&"2.000".to_string()));
        assert!(args.contains(&"-t".to_string()));
        assert!(args.contains(&"10.000".to_string()));
        assert!(args.contains(&"-filter_complex".to_string()));
        assert!(args.contains(&"-c:v".to_string()));
        assert!(args.contains(&"h264_nvenc".to_string()));
        assert!(args.contains(&"-preset".to_string()));
        assert!(args.contains(&"p4".to_string()));
        assert!(args.contains(&"-tune".to_string()));
        assert!(args.contains(&"hq".to_string()));
        assert!(args.contains(&"-cq".to_string()));
        assert!(args.contains(&"21".to_string()));
        assert!(args.contains(&"-r".to_string()));
        assert!(args.contains(&"60.00".to_string()));
        assert!(args.contains(&"-c:a".to_string()));
        assert!(args.contains(&"aac".to_string()));
        assert!(args.contains(&"+faststart".to_string()));
        assert_eq!(args.last().unwrap(), r"C:\Exports\final_render.mp4");
    }
}
