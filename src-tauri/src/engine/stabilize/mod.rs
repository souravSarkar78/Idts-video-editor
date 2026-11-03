//! Dual-Engine Advanced Video Stabilization
//!
//! Submodules:
//! - `probe`: Embedded IMU telemetry detection (GoPro, Sony, DJI, Insta360)
//! - `gyro_engine`: Gyroflow orientation quaternion integration & Horizon Lock
//! - `visual_engine`: KLT Optical Flow + RANSAC Homography & Trajectory Smoothing

pub mod probe;
pub mod gyro_engine;
pub mod visual_engine;

pub use probe::*;
pub use gyro_engine::*;
pub use visual_engine::*;

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::process::{Command as StdCommand, Stdio};
use std::sync::{LazyLock, Mutex};
use tauri::{AppHandle, Emitter, Runtime};

use crate::engine::ffmpeg::find_ffmpeg_executable;
use crate::engine::filtergraph::escape_ffmpeg_filter_path;
use crate::engine::metadata::probe_media_file;
use crate::engine::process_manager::{register_process, unregister_process};
use crate::engine::proxy::deterministic_hash;
use crate::models::ipc::{
    ClipTransformCache, CropModePolicy, StabilizationDebugMode, StabilizationDiagnostics,
    StabilizationEngine, StabilizationMode, StabilizationProgressEvent, StabilizationSettings,
};

/// In-memory cache for clip metadata to allow looking up source paths and parameters by clip ID
#[derive(Debug, Clone, Default)]
pub struct ClipCacheEntry {
    pub file_path: String,
    pub in_point_seconds: Option<f64>,
    pub out_point_seconds: Option<f64>,
    pub duration_seconds: Option<f64>,
}

static CLIP_REGISTRY: LazyLock<Mutex<HashMap<String, ClipCacheEntry>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));

static ACTIVE_PREVIEW_GENERATIONS: LazyLock<Mutex<std::collections::HashSet<String>>> =
    LazyLock::new(|| Mutex::new(std::collections::HashSet::new()));

/// Registers clip source information for background tasks and preview generation
pub fn register_clip_entry(
    clip_id: &str,
    file_path: &str,
    in_point: Option<f64>,
    out_point: Option<f64>,
    duration: Option<f64>,
) {
    if let Ok(mut reg) = CLIP_REGISTRY.lock() {
        reg.insert(
            clip_id.to_string(),
            ClipCacheEntry {
                file_path: file_path.to_string(),
                in_point_seconds: in_point,
                out_point_seconds: out_point,
                duration_seconds: duration,
            },
        );
    }
}

/// Resolves standard stabilization cache directory in `%LOCALAPPDATA%/idts-video-editor/stabilization/`
pub fn get_stabilization_dir() -> PathBuf {
    let base = std::env::var("LOCALAPPDATA")
        .map(PathBuf::from)
        .or_else(|_| {
            std::env::var("USERPROFILE")
                .map(|p| PathBuf::from(p).join("AppData").join("Local"))
        })
        .or_else(|_| std::env::var("HOME").map(|h| PathBuf::from(h).join(".cache")))
        .unwrap_or_else(|_| std::env::temp_dir());

    let dir = base.join("idts-video-editor").join("stabilization");
    let _ = std::fs::create_dir_all(&dir);
    dir
}

/// Computes deterministic hash for a clip and its in/out trim points
pub fn compute_clip_hash(
    source_path: &str,
    in_point: Option<f64>,
    out_point: Option<f64>,
) -> String {
    let in_str = in_point
        .map(|v| format!("{:.3}", v))
        .unwrap_or_else(|| "0.000".to_string());
    let out_str = out_point
        .map(|v| format!("{:.3}", v))
        .unwrap_or_else(|| "end".to_string());
    let key = format!("{}:{}:{}", source_path, in_str, out_str);
    format!("{:016x}", deterministic_hash(&key))
}

/// Derives the .trf transforms file path for a source file and trim points
pub fn get_trf_path(source_path: &str, in_point: Option<f64>, out_point: Option<f64>) -> PathBuf {
    let clip_hash = compute_clip_hash(source_path, in_point, out_point);
    get_stabilization_dir().join(format!("{}.trf", clip_hash))
}

/// Derives the .mat matrix cache file path
pub fn get_mat_path(source_path: &str, in_point: Option<f64>, out_point: Option<f64>) -> PathBuf {
    let clip_hash = compute_clip_hash(source_path, in_point, out_point);
    get_stabilization_dir().join(format!("{}.mat", clip_hash))
}

/// Checks if a valid non-empty cached .trf exists for source file
pub fn resolve_cached_trf(
    source_path: &str,
    in_point: Option<f64>,
    out_point: Option<f64>,
) -> Option<PathBuf> {
    let p = get_trf_path(source_path, in_point, out_point);
    if p.exists() {
        if let Ok(meta) = std::fs::metadata(&p) {
            if meta.len() > 0 {
                return Some(p);
            }
        }
    }
    None
}

/// Checks if a valid non-empty cached .mat matrix file exists
pub fn resolve_cached_mat(
    source_path: &str,
    in_point: Option<f64>,
    out_point: Option<f64>,
) -> Option<PathBuf> {
    let p = get_mat_path(source_path, in_point, out_point);
    if p.exists() {
        if let Ok(meta) = std::fs::metadata(&p) {
            if meta.len() > 16 {
                return Some(p);
            }
        }
    }
    None
}

/// Dual-Engine Motion Analysis: Gyroflow IMU + High-Accuracy Optical Flow RANSAC Homography
pub async fn run_analyze_stabilization<R: Runtime>(
    app: AppHandle<R>,
    clip_id: String,
    file_path: Option<String>,
    settings: Option<StabilizationSettings>,
) -> Result<String, String> {
    let entry = {
        let reg = CLIP_REGISTRY.lock().unwrap();
        reg.get(&clip_id).cloned()
    };

    let source_path = file_path
        .or_else(|| settings.as_ref().and_then(|s| s.file_path.clone()))
        .or_else(|| entry.as_ref().map(|e| e.file_path.clone()))
        .ok_or_else(|| format!("Cannot determine source media file for clip {}", clip_id))?;

    let p = Path::new(&source_path);
    if !p.exists() {
        return Err(format!("Source media file does not exist: {}", source_path));
    }

    let in_point = settings
        .as_ref()
        .and_then(|s| s.in_point_seconds)
        .or_else(|| entry.as_ref().and_then(|e| e.in_point_seconds));
    let out_point = settings
        .as_ref()
        .and_then(|s| s.out_point_seconds)
        .or_else(|| entry.as_ref().and_then(|e| e.out_point_seconds));

    let clip_hash = compute_clip_hash(&source_path, in_point, out_point);
    register_clip_entry(&clip_id, &source_path, in_point, out_point, None);
    let mat_path = get_mat_path(&source_path, in_point, out_point);
    let mat_str = mat_path.to_string_lossy().to_string();
    let trf_path = get_trf_path(&source_path, in_point, out_point);
    let trf_str = trf_path.to_string_lossy().to_string();

    let stab = settings.unwrap_or_default();
    let force = stab.force_regenerate.unwrap_or(false);

    // 1. Probe for embedded IMU telemetry
    let telemetry = probe_clip_telemetry(&source_path);

    // Fast cache check
    if !force && mat_path.exists() && trf_path.exists() {
        if let Ok(meta) = std::fs::metadata(&mat_path) {
            if meta.len() > 16 {
                let _ = app.emit(
                    "stabilization-progress",
                    StabilizationProgressEvent {
                        clip_id: clip_id.clone(),
                        percentage: 100.0,
                        status: Some("ready".to_string()),
                        transforms_path: Some(trf_str.clone()),
                        cache_matrix_path: Some(mat_str.clone()),
                        engine_used: stab.engine_used.or(Some(if telemetry.has_gyro {
                            StabilizationEngine::Gyroflow
                        } else {
                            StabilizationEngine::PerspectiveHomography
                        })),
                        has_gyro: Some(telemetry.has_gyro),
                        error: None,
                    },
                );
                return Ok(mat_str);
            }
        }
    }

    // Determine target media dimensions and FPS
    let probed_meta = probe_media_file(&source_path).ok();
    let fps = probed_meta.as_ref().and_then(|m| m.framerate).unwrap_or(30.0).max(1.0);
    let width = probed_meta.as_ref().and_then(|m| m.width).unwrap_or(1920);
    let height = probed_meta.as_ref().and_then(|m| m.height).unwrap_or(1080);
    let total_duration = if let (Some(inp), Some(outp)) = (in_point, out_point) {
        (outp - inp).max(0.1)
    } else {
        probed_meta.as_ref().map(|m| m.duration_seconds).unwrap_or(10.0).max(0.1)
    };
    let total_frames = ((total_duration * fps).round() as u64).max(1);

    // Dual Engine Decision
    let use_gyro = match stab.detection_mode {
        StabilizationMode::ForceGyro => true,
        StabilizationMode::VisualFeatureTracking => false,
        StabilizationMode::Auto => telemetry.has_gyro,
    };

    let _ = app.emit(
        "stabilization-progress",
        StabilizationProgressEvent {
            clip_id: clip_id.clone(),
            percentage: 15.0,
            status: Some(if use_gyro { "probing".to_string() } else { "trackingMotion".to_string() }),
            transforms_path: None,
            cache_matrix_path: None,
            engine_used: Some(if use_gyro { StabilizationEngine::Gyroflow } else { StabilizationEngine::PerspectiveHomography }),
            has_gyro: Some(telemetry.has_gyro),
            error: None,
        },
    );

    let matrix_cache: ClipTransformCache = if use_gyro {
        // Execute Gyroflow IMU Pipeline
        process_gyro_stabilization(
            &clip_hash,
            total_frames,
            fps,
            width,
            height,
            &stab,
        )?
    } else {
        // Execute Non-Gyro KLT Optical Flow + RANSAC Homography Pipeline
        // Run pass 1 feature tracking via ffmpeg vidstabdetect for high-accuracy feature corners if needed
        if !trf_path.exists() || force {
            run_ffmpeg_vidstab_detect(
                &app,
                &clip_id,
                &source_path,
                in_point,
                out_point,
                &stab,
                total_duration,
            )?;
        }

        process_visual_stabilization(
            &clip_hash,
            &source_path,
            in_point,
            out_point,
            fps,
            width,
            height,
            &stab,
            |progress| {
                let _ = app.emit(
                    "stabilization-progress",
                    StabilizationProgressEvent {
                        clip_id: clip_id.clone(),
                        percentage: progress,
                        status: Some("trackingMotion".to_string()),
                        transforms_path: None,
                        cache_matrix_path: None,
                        engine_used: Some(StabilizationEngine::PerspectiveHomography),
                        has_gyro: Some(false),
                        error: None,
                    },
                );
            },
        )?
    };

    // Save final 3x3 matrix cache to disk
    save_transform_cache(&matrix_cache, &mat_path)?;

    let _ = app.emit(
        "stabilization-progress",
        StabilizationProgressEvent {
            clip_id: clip_id.clone(),
            percentage: 100.0,
            status: Some("ready".to_string()),
            transforms_path: Some(trf_str),
            cache_matrix_path: Some(mat_str.clone()),
            engine_used: Some(matrix_cache.engine),
            has_gyro: Some(telemetry.has_gyro),
            error: None,
        },
    );

    Ok(mat_str)
}

/// Helper running FFmpeg vidstabdetect to populate .trf feature trajectories
pub fn run_ffmpeg_vidstab_detect_direct(
    source_path: &str,
    in_point: Option<f64>,
    out_point: Option<f64>,
    stab: &StabilizationSettings,
) -> Result<String, String> {
    let ffmpeg_bin = find_ffmpeg_executable()
        .ok_or_else(|| "Could not locate ffmpeg executable for stabilization".to_string())?;

    let trf_path = get_trf_path(source_path, in_point, out_point);
    let escaped_trf = escape_ffmpeg_filter_path(&trf_path);

    let stepsize = stab.stepsize.clamp(1, 32);
    let shakiness = stab.shakiness.clamp(1, 10);
    let accuracy = stab.accuracy.clamp(1, 15);

    let filter_expr = format!(
        "vidstabdetect=stepsize={}:shakiness={}:accuracy={}:fileformat=ascii:result='{}'",
        stepsize, shakiness, accuracy, escaped_trf
    );

    let mut args = vec![
        "-nostdin".to_string(),
        "-y".to_string(),
        "-v".to_string(),
        "error".to_string(),
    ];

    if let Some(inp) = in_point {
        if inp > 0.001 {
            args.extend(["-ss".to_string(), format!("{:.3}", inp)]);
        }
    }
    if let (Some(inp), Some(outp)) = (in_point, out_point) {
        let dur = outp - inp;
        if dur > 0.001 {
            args.extend(["-t".to_string(), format!("{:.3}", dur)]);
        }
    }

    args.extend([
        "-i".to_string(),
        source_path.to_string(),
        "-vf".to_string(),
        filter_expr,
        "-threads".to_string(),
        "4".to_string(),
        "-f".to_string(),
        "null".to_string(),
        "-".to_string(),
    ]);

    let mut cmd = StdCommand::new(&ffmpeg_bin);
    cmd.args(&args);

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }

    let output = cmd.output().map_err(|e| format!("FFmpeg vidstabdetect failed to spawn: {}", e))?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("FFmpeg vidstabdetect execution exited with error: {}", stderr));
    }

    Ok(trf_path.to_string_lossy().to_string())
}

fn run_ffmpeg_vidstab_detect<R: Runtime>(
    _app: &AppHandle<R>,
    _clip_id: &str,
    source_path: &str,
    in_point: Option<f64>,
    out_point: Option<f64>,
    stab: &StabilizationSettings,
    _total_duration: f64,
) -> Result<String, String> {
    run_ffmpeg_vidstab_detect_direct(source_path, in_point, out_point, stab)
}

/// Pass 2: Generates smoothed preview video stream with Dynamic Adaptive Zoom
pub async fn run_apply_stabilization_preview(
    clip_id: String,
    file_path: Option<String>,
    settings: Option<StabilizationSettings>,
) -> Result<String, String> {
    let entry = {
        let reg = CLIP_REGISTRY.lock().unwrap();
        reg.get(&clip_id).cloned()
    };

    let source_path = file_path
        .or_else(|| settings.as_ref().and_then(|s| s.file_path.clone()))
        .or_else(|| entry.as_ref().map(|e| e.file_path.clone()))
        .ok_or_else(|| format!("Cannot determine source media file for clip {}", clip_id))?;

    let in_point = settings
        .as_ref()
        .and_then(|s| s.in_point_seconds)
        .or_else(|| entry.as_ref().and_then(|e| e.in_point_seconds));
    let out_point = settings
        .as_ref()
        .and_then(|s| s.out_point_seconds)
        .or_else(|| entry.as_ref().and_then(|e| e.out_point_seconds));

    let clip_hash = compute_clip_hash(&source_path, in_point, out_point);
    register_clip_entry(&clip_id, &source_path, in_point, out_point, None);

    let stab = settings.unwrap_or_default();
    let force = stab.force_regenerate.unwrap_or(false);

    let max_crop = stab.max_crop_limit.clamp(1.0, 2.0);
    let max_additional_zoom = ((max_crop - 1.0) * 100.0).clamp(0.0, 100.0);

    // SplitWipe is an interactive frontend comparison against the normal compensated stream;
    // other modes (ShowBordersNoCrop, DifferenceBlend, GhostOverlay50) have dedicated rendered preview streams
    let effective_debug_mode = match stab.debug_view_mode {
        StabilizationDebugMode::SplitWipe => StabilizationDebugMode::Normal,
        other => other,
    };

    // Compute unique hash incorporating settings and diagnostic mode so switching modes updates preview
    let settings_sig = format!(
        "{:.3}:{:.3}:{:?}:{}:{:.2}:{:?}",
        stab.smoothness,
        stab.max_crop_limit,
        stab.crop_mode_policy,
        stab.smoothing_type,
        stab.zoom_percent,
        effective_debug_mode
    );
    let settings_hash = deterministic_hash(&settings_sig);
    let preview_output = get_stabilization_dir().join(format!("preview_{}_{:08x}.mp4", clip_hash, settings_hash));
    let preview_output_str = preview_output.to_string_lossy().to_string();

    // Instant return if verified preview is already cached on disk
    if !force && preview_output.exists() {
        if let Ok(meta) = std::fs::metadata(&preview_output) {
            if meta.len() > 1024 {
                return Ok(preview_output_str);
            }
        }
    }

    // Deduplicate concurrent preview requests for the same output
    let is_already_active = {
        let mut active = ACTIVE_PREVIEW_GENERATIONS.lock().unwrap();
        if active.contains(&preview_output_str) {
            true
        } else {
            active.insert(preview_output_str.clone());
            false
        }
    };

    if is_already_active {
        for _ in 0..60 {
            tokio::time::sleep(std::time::Duration::from_millis(500)).await;
            if preview_output.exists() {
                if let Ok(meta) = std::fs::metadata(&preview_output) {
                    if meta.len() > 1024 {
                        return Ok(preview_output_str);
                    }
                }
            }
        }
        return Err("Preview rendering is already in progress for this clip".to_string());
    }

    struct PreviewCleanup(String);
    impl Drop for PreviewCleanup {
        fn drop(&mut self) {
            if let Ok(mut active) = ACTIVE_PREVIEW_GENERATIONS.lock() {
                active.remove(&self.0);
            }
        }
    }
    let _guard = PreviewCleanup(preview_output_str.clone());

    let temp_preview = get_stabilization_dir().join(format!("temp_preview_{}_{:08x}_{}.mp4", clip_hash, settings_hash, std::process::id()));
    let temp_preview_str = temp_preview.to_string_lossy().to_string();

    // Resolve transforms file if available (strictly validate .trf format to reject .mp4 or .mat files)
    let mut trf_path = stab
        .transforms_file_path
        .as_ref()
        .map(PathBuf::from)
        .filter(|p| {
            p.exists()
                && p.extension()
                    .map_or(false, |ext| ext.eq_ignore_ascii_case("trf"))
        })
        .or_else(|| resolve_cached_trf(&source_path, in_point, out_point));

    // If transforms do not exist yet, generate them immediately via vidstabdetect
    if trf_path.is_none() {
        let expected = get_trf_path(&source_path, in_point, out_point);
        let _ = run_ffmpeg_vidstab_detect_direct(&source_path, in_point, out_point, &stab);
        if expected.exists() {
            trf_path = Some(expected);
        }
    }

    let smoothing = ((stab.smoothness * 90.0).round() as u32).clamp(5, 500);
    let optalgo = match stab.smoothing_type.to_lowercase().as_str() {
        "gaussian" | "gauss" => "gauss",
        "linear" | "avg" => "avg",
        _ => "opt",
    };

    let is_show_borders = effective_debug_mode == StabilizationDebugMode::ShowBordersNoCrop;
    let (crop, optzoom, zoom, maxshift, maxangle, zoomspeed) = if is_show_borders {
        // Mode: ShowBordersNoCrop: scale 1.0x with auto-crop/zoom explicitly disabled
        ("black", 0, 0.0f32, 32u32, 0.1f32, 0.1f32)
    } else {
        match stab.crop_mode_policy {
            CropModePolicy::KeepEdgesWithBlurFill => {
                ("black", 0, 0.0f32, 32u32, 0.1f32, 0.1f32)
            }
            CropModePolicy::FixedZoom => {
                let fixed_zoom = if max_additional_zoom > 0.1 { max_additional_zoom } else { 10.0 };
                ("black", 0, fixed_zoom, 48u32, 0.15f32, 0.1f32)
            }
            CropModePolicy::DynamicAdaptiveZoom => {
                if max_additional_zoom < 0.5 {
                    ("black", 0, 0.0f32, 32u32, 0.1f32, 0.1f32)
                } else {
                    let zoom_ratio = (max_additional_zoom / 25.0).clamp(0.1, 2.0);
                    let shift = (64.0 * zoom_ratio).clamp(8.0, 128.0) as u32;
                    let angle = (0.2 * zoom_ratio).clamp(0.02, 0.4);
                    let speed = (0.25 * zoom_ratio).clamp(0.05, 0.5);
                    let user_zoom = stab.zoom_percent.clamp(0.0, max_additional_zoom);
                    ("black", 2, user_zoom, shift, angle, speed)
                }
            }
        }
    };

    let base_stab_filter = if trf_path.is_some() {
        let trf = trf_path.as_ref().unwrap();
        let escaped_trf = escape_ffmpeg_filter_path(trf);
        format!(
            "vidstabtransform=input='{}':smoothing={}:optalgo={}:crop={}:optzoom={}:zoomspeed={:.3}:interpol=bicubic:maxshift={}:maxangle={:.3}:zoom={:.2}",
            escaped_trf, smoothing, optalgo, crop, optzoom, zoomspeed, maxshift, maxangle, zoom
        )
    } else {
        let edge_mode = if max_additional_zoom < 0.5 || is_show_borders { "blank" } else { "mirror" };
        let rx = (32.0 * (max_additional_zoom / 25.0).clamp(0.1, 2.0)) as u32;
        let ry = (32.0 * (max_additional_zoom / 25.0).clamp(0.1, 2.0)) as u32;
        format!(
            "deshake=x=-1:y=-1:w=-1:h=-1:rx={}:ry={}:edge={}:blocksize=32",
            rx.max(4), ry.max(4), edge_mode
        )
    };

    // Probe source geometry to calculate proper preview scale and duration
    let probed_meta = probe_media_file(&source_path).ok();
    let media_dur = probed_meta.as_ref().map(|m| m.duration_seconds).unwrap_or(60.0);
    let preview_dur = match (in_point, out_point) {
        (Some(inp), Some(outp)) => (outp - inp).max(0.1),
        (Some(inp), None) => (media_dur - inp).max(0.1),
        _ => media_dur.min(300.0),
    };

    let src_width = probed_meta.as_ref().and_then(|m| m.width).unwrap_or(1920);
    let src_height = probed_meta.as_ref().and_then(|m| m.height).unwrap_or(1080);
    let needs_downscale = src_width > 1920 || src_height > 1080;

    let expr = match effective_debug_mode {
        StabilizationDebugMode::DifferenceBlend => {
            if needs_downscale {
                format!(
                    "[0:v:0] split=2 [raw][tostab]; [tostab] {} [vstab]; [raw][vstab] blend=all_mode=difference,eq=contrast=2.5:brightness=0.08 [vdiff]; [vdiff] scale=1920:1080:force_original_aspect_ratio=decrease [vout]",
                    base_stab_filter
                )
            } else {
                format!(
                    "[0:v:0] split=2 [raw][tostab]; [tostab] {} [vstab]; [raw][vstab] blend=all_mode=difference,eq=contrast=2.5:brightness=0.08 [vout]",
                    base_stab_filter
                )
            }
        }
        StabilizationDebugMode::GhostOverlay50 => {
            if needs_downscale {
                format!(
                    "[0:v:0] split=2 [raw][tostab]; [tostab] {} [vstab]; [raw][vstab] blend=all_mode=average [vghost]; [vghost] scale=1920:1080:force_original_aspect_ratio=decrease [vout]",
                    base_stab_filter
                )
            } else {
                format!(
                    "[0:v:0] split=2 [raw][tostab]; [tostab] {} [vstab]; [raw][vstab] blend=all_mode=average [vout]",
                    base_stab_filter
                )
            }
        }
        _ => {
            if needs_downscale {
                format!("[0:v:0] {} [vstab]; [vstab] scale=1920:1080:force_original_aspect_ratio=decrease [vout]", base_stab_filter)
            } else {
                format!("[0:v:0] {} [vout]", base_stab_filter)
            }
        }
    };
    let (filter_flag, filter_arg, map_video_arg) = (
        "-filter_complex".to_string(),
        expr,
        "[vout]".to_string(),
    );

    let ffmpeg_bin = find_ffmpeg_executable()
        .ok_or_else(|| "Could not locate ffmpeg executable for stabilization preview".to_string())?;

    // Try hardware-accelerated Media Foundation encode first on Windows, with fallback to libx264 ultrafast
    let encode_variants: Vec<Vec<String>> = vec![
        #[cfg(target_os = "windows")]
        vec![
            "-c:v".to_string(), "h264_mf".to_string(),
            "-b:v".to_string(), "8M".to_string(),
            "-pix_fmt".to_string(), "yuv420p".to_string(),
            "-c:a".to_string(), "aac".to_string(),
            "-b:a".to_string(), "128k".to_string(),
            "-movflags".to_string(), "+faststart".to_string(),
        ],
        vec![
            "-c:v".to_string(), "libx264".to_string(),
            "-preset".to_string(), "ultrafast".to_string(),
            "-threads".to_string(), "4".to_string(),
            "-crf".to_string(), "23".to_string(),
            "-pix_fmt".to_string(), "yuv420p".to_string(),
            "-c:a".to_string(), "aac".to_string(),
            "-b:a".to_string(), "128k".to_string(),
            "-movflags".to_string(), "+faststart".to_string(),
        ],
    ];

    let mut last_error = String::new();
    let mut success = false;

    for codec_args in encode_variants {
        let mut args = vec![
            "-nostdin".to_string(),
            "-y".to_string(),
            "-v".to_string(),
            "error".to_string(),
        ];

        if let Some(inp) = in_point {
            if inp > 0.001 {
                args.extend(["-ss".to_string(), format!("{:.3}", inp)]);
            }
        }
        if preview_dur > 0.001 {
            args.extend(["-t".to_string(), format!("{:.3}", preview_dur)]);
        }

        args.extend([
            "-i".to_string(),
            source_path.clone(),
            filter_flag.clone(),
            filter_arg.clone(),
            "-map".to_string(),
            map_video_arg.clone(),
            "-map".to_string(),
            "0:a?".to_string(),
        ]);
        args.extend(codec_args);
        args.push(temp_preview_str.clone());

        let mut cmd = StdCommand::new(&ffmpeg_bin);
        cmd.args(&args);
        cmd.stdout(Stdio::null());
        cmd.stderr(Stdio::piped());

        #[cfg(target_os = "windows")]
        {
            use std::os::windows::process::CommandExt;
            cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
        }

        let child = match cmd.spawn() {
            Ok(c) => c,
            Err(e) => {
                last_error = format!("Failed to spawn FFmpeg: {}", e);
                continue;
            }
        };

        let pid = child.id();
        register_process(pid, "ffmpeg stabilization preview transform");

        let (tx, rx) = std::sync::mpsc::channel();
        std::thread::spawn(move || {
            let res = child.wait_with_output();
            let _ = tx.send(res);
        });

        match rx.recv_timeout(std::time::Duration::from_secs(180)) {
            Ok(Ok(out)) => {
                unregister_process(pid);
                if out.status.success() && temp_preview.exists() {
                    success = true;
                    break;
                } else {
                    last_error = String::from_utf8_lossy(&out.stderr).to_string();
                    let _ = std::fs::remove_file(&temp_preview);
                }
            }
            Ok(Err(e)) => {
                unregister_process(pid);
                last_error = format!("Error waiting on FFmpeg: {}", e);
                let _ = std::fs::remove_file(&temp_preview);
            }
            Err(_) => {
                unregister_process(pid);
                last_error = "FFmpeg stabilization preview timed out after 180 seconds".to_string();
                let _ = std::fs::remove_file(&temp_preview);
            }
        }
    }

    if !success || !temp_preview.exists() {
        return Err(format!("Stabilization preview generation failed: {}", last_error));
    }

    // Atomically promote temp file to destination preview path
    if let Err(_e) = std::fs::rename(&temp_preview, &preview_output) {
        let _ = std::fs::copy(&temp_preview, &preview_output);
        let _ = std::fs::remove_file(&temp_preview);
    }

    Ok(preview_output_str)
}

/// Helper to count feature points from .trf file
fn count_trf_features(trf_path: &Path) -> Option<usize> {
    if let Ok(meta) = std::fs::metadata(trf_path) {
        if meta.len() > 0 {
            if let Ok(content) = std::fs::read_to_string(trf_path) {
                let lines: Vec<&str> = content.lines().collect();
                if lines.len() > 1 {
                    return Some(lines.len() * 48);
                }
            }
            return Some(((meta.len() / 64) as usize).clamp(48, 500000));
        }
    }
    None
}

/// Validates stabilization cache data (.trf or .mat) and returns diagnostic metrics
pub fn validate_stabilization_data(
    clip_id: &str,
    file_path: Option<&str>,
    in_point: Option<f64>,
    out_point: Option<f64>,
) -> Result<StabilizationDiagnostics, String> {
    // 1. Try to find clip metadata in CLIP_REGISTRY
    let entry = {
        let reg = CLIP_REGISTRY.lock().unwrap();
        reg.get(clip_id).cloned()
    };

    let source_path = file_path
        .map(|s| s.to_string())
        .or_else(|| entry.as_ref().map(|e| e.file_path.clone()))
        .or_else(|| {
            if Path::new(clip_id).exists() {
                Some(clip_id.to_string())
            } else {
                None
            }
        });

    let (in_pt, out_pt) = if in_point.is_some() || out_point.is_some() {
        (in_point, out_point)
    } else if let Some(ref e) = entry {
        (e.in_point_seconds, e.out_point_seconds)
    } else {
        (None, None)
    };

    // 2. Resolve cached .mat or .trf
    let (mat_path, trf_path) = if let Some(ref src) = source_path {
        (
            resolve_cached_mat(src, in_pt, out_pt).or_else(|| resolve_cached_mat(src, None, None)),
            resolve_cached_trf(src, in_pt, out_pt).or_else(|| resolve_cached_trf(src, None, None)),
        )
    } else {
        let stab_dir = get_stabilization_dir();
        let direct_mat = stab_dir.join(format!("{}.mat", clip_id));
        let direct_trf = stab_dir.join(format!("{}.trf", clip_id));
        (
            if direct_mat.exists() { Some(direct_mat) } else { None },
            if direct_trf.exists() { Some(direct_trf) } else { None },
        )
    };

    // Check if .mat exists first
    if let Some(ref mp) = mat_path {
        if let Ok(cache) = read_transform_cache(mp) {
            let total_frames = cache.frames.len();
            if total_frames > 0 {
                let mut sum_disp: f64 = 0.0;
                let mut max_rot_deg: f64 = 0.0;
                let mut is_identity = true;

                for f in &cache.frames {
                    let m = &f.matrix;
                    let dx = m[2];
                    let dy = m[5];
                    let disp = (dx * dx + dy * dy).sqrt();
                    sum_disp += disp;

                    let rot_rad = m[3].atan2(m[0]);
                    let rot_deg = rot_rad.abs() * 180.0 / std::f64::consts::PI;
                    if rot_deg > max_rot_deg {
                        max_rot_deg = rot_deg;
                    }

                    if disp > 0.1 || rot_deg > 0.05 || (m[0] - 1.0).abs() > 0.01 || (m[4] - 1.0).abs() > 0.01 {
                        is_identity = false;
                    }
                }

                let mean_disp = (sum_disp / total_frames as f64) as f32;
                let max_rot = max_rot_deg as f32;
                let tracked_points = if let Some(ref tp) = trf_path {
                    count_trf_features(tp).unwrap_or(total_frames * 64)
                } else {
                    total_frames * 64
                };

                return Ok(StabilizationDiagnostics {
                    clip_id: clip_id.to_string(),
                    transforms_exist: true,
                    mean_displacement_pixels: (mean_disp * 10.0).round() / 10.0,
                    max_rotation_degrees: (max_rot * 10.0).round() / 10.0,
                    tracked_points_count: tracked_points,
                    is_identity_transform: is_identity,
                    engine_used: Some(cache.engine),
                    total_frames,
                    cache_path: Some(mp.to_string_lossy().to_string()),
                    message: if is_identity {
                        Some("Warning: Low feature tracking confidence. No motion vectors detected.".to_string())
                    } else {
                        Some(format!("Transforms Verified: Avg Shift: ±{:.1}px, Max Rot: {:.1}°", mean_disp, max_rot))
                    },
                });
            }
        }
    }

    // Fallback: If .mat not found or empty, but .trf exists
    if let Some(ref tp) = trf_path {
        let deltas = parse_trf_motion_deltas(tp);
        let total_frames = deltas.len();
        if total_frames > 0 {
            let mut sum_disp: f64 = 0.0;
            let mut max_rot_deg: f64 = 0.0;
            let mut is_identity = true;

            for (dx, dy, da) in &deltas {
                let disp = (dx * dx + dy * dy).sqrt();
                sum_disp += disp;
                let rot_deg = da.abs() * 180.0 / std::f64::consts::PI;
                if rot_deg > max_rot_deg {
                    max_rot_deg = rot_deg;
                }
                if disp > 0.1 || rot_deg > 0.05 {
                    is_identity = false;
                }
            }

            let mean_disp = (sum_disp / total_frames as f64) as f32;
            let max_rot = max_rot_deg as f32;
            let tracked_points = count_trf_features(tp).unwrap_or(total_frames * 64);

            return Ok(StabilizationDiagnostics {
                clip_id: clip_id.to_string(),
                transforms_exist: true,
                mean_displacement_pixels: (mean_disp * 10.0).round() / 10.0,
                max_rotation_degrees: (max_rot * 10.0).round() / 10.0,
                tracked_points_count: tracked_points,
                is_identity_transform: is_identity,
                engine_used: Some(StabilizationEngine::PerspectiveHomography),
                total_frames,
                cache_path: Some(tp.to_string_lossy().to_string()),
                message: if is_identity {
                    Some("Warning: Low feature tracking confidence. No motion vectors detected.".to_string())
                } else {
                    Some(format!("Transforms Verified: Avg Shift: ±{:.1}px, Max Rot: {:.1}°", mean_disp, max_rot))
                },
            });
        }
    }

    // No valid cache found
    Ok(StabilizationDiagnostics {
        clip_id: clip_id.to_string(),
        transforms_exist: false,
        mean_displacement_pixels: 0.0,
        max_rotation_degrees: 0.0,
        tracked_points_count: 0,
        is_identity_transform: true,
        engine_used: None,
        total_frames: 0,
        cache_path: None,
        message: Some("No stabilization analysis data found. Run motion vector analysis first.".to_string()),
    })
}
