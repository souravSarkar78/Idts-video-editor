//! Filtergraph module for dynamic FFmpeg `-filter_complex` construction and GPU encoder configuration.
//!
//! Provides dynamic chaining of video and audio filters, including 3D LUT application (.cube),
//! audio denoising (`afftdn`), and prioritized Windows hardware-accelerated video encoders.

use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

use crate::models::ipc::{
    ColorCorrection, KeyframeTrack, LensEffects, SpeedProfile,
};

/// Builds video filter expression tokens for color correction, temperature, and 3D LUT.
///
/// Maps brightness, contrast, and saturation to FFmpeg's `eq` filter,
/// temperature to `colorbalance`, and LUT path to `lut3d=file='...'`.
pub fn build_color_filter_chain(color: &ColorCorrection) -> Vec<String> {
    let mut filters = Vec::new();

    // 1. FFmpeg eq: brightness, contrast, saturation
    let b = color.brightness.clamp(-1.0, 1.0);
    let c = color.contrast.clamp(-2.0, 3.0);
    let s = color.saturation.clamp(0.0, 3.0);

    let needs_eq = (b.abs() > 0.001) || ((c - 1.0).abs() > 0.001) || ((s - 1.0).abs() > 0.001);
    if needs_eq {
        filters.push(format!("eq=brightness={:.3}:contrast={:.3}:saturation={:.3}", b, c, s));
    }

    // 2. FFmpeg colorbalance for temperature adjustment (-100.0 to 100.0)
    // Warm (>0): enhance red shadows/midtones, reduce blue shadows/midtones
    // Cool (<0): enhance blue shadows/midtones, reduce red shadows/midtones
    let temp = color.temperature.clamp(-100.0, 100.0);
    if temp.abs() > 0.5 {
        let factor = (temp / 100.0) * 0.35;
        if factor > 0.0 {
            filters.push(format!(
                "colorbalance=rs={:.3}:rm={:.3}:bs=-{:.3}:bm=-{:.3}",
                factor, factor, factor, factor
            ));
        } else {
            let abs_factor = -factor;
            filters.push(format!(
                "colorbalance=bs={:.3}:bm={:.3}:rs=-{:.3}:rm=-{:.3}",
                abs_factor, abs_factor, abs_factor, abs_factor
            ));
        }
    }

    // 3. 3D LUT (.cube)
    if let Some(ref lut) = color.lut_path {
        let trimmed = lut.trim();
        if !trimmed.is_empty() {
            let escaped = escape_ffmpeg_filter_path(Path::new(trimmed));
            filters.push(format!("lut3d=file='{}'", escaped));
        }
    }

    filters
}

/// Builds video speed adjustment filters (PTS retiming and optical flow interpolation for slow motion).
pub fn build_speed_video_filters(speed_profile: Option<&SpeedProfile>) -> Vec<String> {
    let mut filters = Vec::new();
    if let Some(sp) = speed_profile {
        let speed = sp.speed_multiplier.clamp(0.05, 32.0);
        if (speed - 1.0).abs() > 0.005 {
            filters.push(format!("setpts=(1.0/{:.4})*PTS", speed));
            if speed < 0.999 {
                filters.push("minterpolate=fps=60:mi_mode=mci".to_string());
            }
        }
    }
    filters
}

/// Builds audio tempo filters using cascading atempo filters (0.5 to 2.0 per step) to preserve pitch,
/// or mutes audio if pitch correction is disabled.
pub fn build_speed_audio_filters(speed_profile: Option<&SpeedProfile>) -> Vec<String> {
    let mut filters = Vec::new();
    if let Some(sp) = speed_profile {
        if !sp.pitch_correction {
            // Mute audio if pitch correction is disabled for non-1.0 speeds
            if (sp.speed_multiplier - 1.0).abs() > 0.005 {
                filters.push("volume=0".to_string());
                return filters;
            }
        }
        let speed = sp.speed_multiplier.clamp(0.05, 32.0);
        if (speed - 1.0).abs() > 0.005 {
            let mut rem = speed;
            while rem > 2.0 {
                filters.push("atempo=2.0".to_string());
                rem /= 2.0;
            }
            while rem < 0.5 {
                filters.push("atempo=0.5".to_string());
                rem /= 0.5;
            }
            if (rem - 1.0).abs() > 0.005 {
                filters.push(format!("atempo={:.3}", rem));
            }
        }
    }
    filters
}

/// Builds lens distortion correction (defish) and gaussian blur filter chain.
pub fn build_lens_effects_filter_chain(lens: Option<&LensEffects>) -> Vec<String> {
    let mut filters = Vec::new();
    if let Some(effects) = lens {
        if effects.defish_enabled && effects.defish_strength.abs() > 0.005 {
            let k1 = (effects.defish_strength * -0.25).clamp(-0.99, 0.99);
            let k2 = (effects.defish_strength * -0.10).clamp(-0.99, 0.99);
            filters.push(format!("lenscorrection=cx=0.5:cy=0.5:k1={:.3}:k2={:.3}", k1, k2));
        }
        if effects.gaussian_blur > 0.05 {
            let sigma = effects.gaussian_blur.clamp(0.1, 50.0);
            filters.push(format!("gblur=sigma={:.1}", sigma));
        }
    }
    filters
}

/// Helper to interpolate a property value at time t from a keyframe track.
pub fn interpolate_keyframe_property(
    track: Option<&KeyframeTrack>,
    default_val: f32,
    time_sec: f64,
) -> f32 {
    let track = match track {
        Some(t) if !t.keyframes.is_empty() => t,
        _ => return default_val,
    };

    let kfs = &track.keyframes;
    if time_sec <= kfs[0].time {
        return kfs[0].value;
    }
    if time_sec >= kfs[kfs.len() - 1].time {
        return kfs[kfs.len() - 1].value;
    }

    // Find bounding pair
    for i in 0..kfs.len() - 1 {
        let k0 = &kfs[i];
        let k1 = &kfs[i + 1];
        if time_sec >= k0.time && time_sec <= k1.time {
            let span = k1.time - k0.time;
            if span <= 0.0001 {
                return k0.value;
            }
            let mut ratio = ((time_sec - k0.time) / span) as f32;
            if k0.easing == "ease_in_out" {
                ratio = ratio * ratio * (3.0 - 2.0 * ratio);
            }
            return k0.value + (k1.value - k0.value) * ratio;
        }
    }

    default_val
}

/// Builds dynamic FFmpeg transform and motion filter chain:
/// - scale
/// - rotation (rotate)
/// - opacity (colorchannelmixer)
/// Returns (v_filter_tokens, overlay_x_expr, overlay_y_expr)
pub fn build_motion_transform_filters(
    scale: Option<f32>,
    position_x: Option<f32>,
    position_y: Option<f32>,
    rotation: Option<f32>,
    opacity: Option<f32>,
    keyframe_tracks: Option<&[KeyframeTrack]>,
    _width: u32,
    _height: u32,
) -> (Vec<String>, String, String) {
    let mut filters = Vec::new();

    // Find keyframe tracks if any
    let kf_scale = keyframe_tracks.and_then(|ts| ts.iter().find(|t| t.property == "scale"));
    let kf_rot = keyframe_tracks.and_then(|ts| ts.iter().find(|t| t.property == "rotation"));
    let kf_opacity = keyframe_tracks.and_then(|ts| ts.iter().find(|t| t.property == "opacity"));
    let kf_pos_x = keyframe_tracks.and_then(|ts| ts.iter().find(|t| t.property == "position_x"));
    let kf_pos_y = keyframe_tracks.and_then(|ts| ts.iter().find(|t| t.property == "position_y"));

    let has_scale_kf = kf_scale.map_or(false, |t| t.keyframes.len() > 1);
    let has_rot_kf = kf_rot.map_or(false, |t| t.keyframes.len() > 1);
    let has_op_kf = kf_opacity.map_or(false, |t| t.keyframes.len() > 1);
    let has_pos_kf = kf_pos_x.map_or(false, |t| t.keyframes.len() > 1) || kf_pos_y.map_or(false, |t| t.keyframes.len() > 1);

    // 1. Scale
    let base_scale = scale.unwrap_or(1.0).clamp(0.05, 10.0);
    if has_scale_kf {
        if let Some(track) = kf_scale {
            let mut expr_pieces = Vec::new();
            for i in 0..track.keyframes.len() - 1 {
                let k0 = &track.keyframes[i];
                let k1 = &track.keyframes[i + 1];
                let cond = format!("between(t,{:.3},{:.3})", k0.time, k1.time);
                let interp = format!("({:.3}+({:.3}-{:.3})*(t-{:.3})/{:.3})", k0.value, k1.value, k0.value, k0.time, (k1.time - k0.time).max(0.001));
                expr_pieces.push(format!("if({},{},", cond, interp));
            }
            let last_val = track.keyframes.last().map(|k| k.value).unwrap_or(base_scale);
            let mut full_expr = format!("{:.3}", last_val);
            for _ in 0..expr_pieces.len() {
                full_expr.push(')');
            }
            let chained = expr_pieces.join("") + &full_expr;
            filters.push(format!("scale=w='iw*({})':h='ih*({})':eval=frame", chained, chained));
        }
    } else if (base_scale - 1.0).abs() > 0.01 {
        filters.push(format!(
            "scale=w='trunc(iw*{:.3}/2)*2':h='trunc(ih*{:.3}/2)*2'",
            base_scale, base_scale
        ));
    }

    // 2. Rotation
    let base_rot = rotation.unwrap_or(0.0);
    if has_rot_kf {
        if let Some(track) = kf_rot {
            let mut expr_pieces = Vec::new();
            for i in 0..track.keyframes.len() - 1 {
                let k0 = &track.keyframes[i];
                let k1 = &track.keyframes[i + 1];
                let cond = format!("between(t,{:.3},{:.3})", k0.time, k1.time);
                let interp = format!("({:.3}+({:.3}-{:.3})*(t-{:.3})/{:.3})", k0.value, k1.value, k0.value, k0.time, (k1.time - k0.time).max(0.001));
                expr_pieces.push(format!("if({},{},", cond, interp));
            }
            let last_val = track.keyframes.last().map(|k| k.value).unwrap_or(base_rot);
            let mut full_expr = format!("{:.3}", last_val);
            for _ in 0..expr_pieces.len() {
                full_expr.push(')');
            }
            let chained = expr_pieces.join("") + &full_expr;
            filters.push(format!("rotate='({})*PI/180':c=none:ow='rotw(({})*PI/180)':oh='roth(({})*PI/180)'", chained, chained, chained));
        }
    } else if base_rot.abs() > 0.05 {
        let rad = base_rot * std::f32::consts::PI / 180.0;
        filters.push(format!(
            "rotate={:.4}:c=none:ow=rotw({:.4}):oh=roth({:.4})",
            rad, rad, rad
        ));
    }

    // 3. Opacity
    let base_opacity = opacity.unwrap_or(1.0).clamp(0.0, 1.0);
    if has_op_kf {
        if let Some(track) = kf_opacity {
            let mut expr_pieces = Vec::new();
            for i in 0..track.keyframes.len() - 1 {
                let k0 = &track.keyframes[i];
                let k1 = &track.keyframes[i + 1];
                let cond = format!("between(t,{:.3},{:.3})", k0.time, k1.time);
                let interp = format!("({:.3}+({:.3}-{:.3})*(t-{:.3})/{:.3})", k0.value, k1.value, k0.value, k0.time, (k1.time - k0.time).max(0.001));
                expr_pieces.push(format!("if({},{},", cond, interp));
            }
            let last_val = track.keyframes.last().map(|k| k.value).unwrap_or(base_opacity);
            let mut full_expr = format!("{:.3}", last_val);
            for _ in 0..expr_pieces.len() {
                full_expr.push(')');
            }
            let chained = expr_pieces.join("") + &full_expr;
            filters.push(format!("format=yuva420p,colorchannelmixer=aa='{}'", chained));
        }
    } else if base_opacity < 0.999 {
        filters.push(format!("format=yuva420p,colorchannelmixer=aa={:.3}", base_opacity));
    }

    // 4. Overlay coordinates (x, y)
    let px = position_x.unwrap_or(0.0);
    let py = position_y.unwrap_or(0.0);

    let overlay_x = if has_pos_kf && kf_pos_x.is_some() {
        let track = kf_pos_x.unwrap();
        let mut expr_pieces = Vec::new();
        for i in 0..track.keyframes.len() - 1 {
            let k0 = &track.keyframes[i];
            let k1 = &track.keyframes[i + 1];
            let cond = format!("between(t,{:.3},{:.3})", k0.time, k1.time);
            let interp = format!("({:.1}+({:.1}-{:.1})*(t-{:.3})/{:.3})", k0.value, k1.value, k0.value, k0.time, (k1.time - k0.time).max(0.001));
            expr_pieces.push(format!("if({},{},", cond, interp));
        }
        let last_val = track.keyframes.last().map(|k| k.value).unwrap_or(px);
        let mut full_expr = format!("{:.1}", last_val);
        for _ in 0..expr_pieces.len() {
            full_expr.push(')');
        }
        let chained = expr_pieces.join("") + &full_expr;
        format!("(W-w)/2+({})", chained)
    } else if px.abs() > 0.1 {
        format!("(W-w)/2+{:.1}", px)
    } else {
        "(W-w)/2".to_string()
    };

    let overlay_y = if has_pos_kf && kf_pos_y.is_some() {
        let track = kf_pos_y.unwrap();
        let mut expr_pieces = Vec::new();
        for i in 0..track.keyframes.len() - 1 {
            let k0 = &track.keyframes[i];
            let k1 = &track.keyframes[i + 1];
            let cond = format!("between(t,{:.3},{:.3})", k0.time, k1.time);
            let interp = format!("({:.1}+({:.1}-{:.1})*(t-{:.3})/{:.3})", k0.value, k1.value, k0.value, k0.time, (k1.time - k0.time).max(0.001));
            expr_pieces.push(format!("if({},{},", cond, interp));
        }
        let last_val = track.keyframes.last().map(|k| k.value).unwrap_or(py);
        let mut full_expr = format!("{:.1}", last_val);
        for _ in 0..expr_pieces.len() {
            full_expr.push(')');
        }
        let chained = expr_pieces.join("") + &full_expr;
        format!("(H-h)/2+({})", chained)
    } else if py.abs() > 0.1 {
        format!("(H-h)/2+{:.1}", py)
    } else {
        "(H-h)/2".to_string()
    };

    (filters, overlay_x, overlay_y)
}

/// Builds an FFmpeg `xfade` filter string for two intersecting video segments.
///
/// Supported transition types: "fade", "dissolve", "wipeleft", "wiperight", "slideup", "slidedown".
pub fn build_xfade_filter(transition_type: &str, duration: f64, offset: f64) -> String {
    let normalized = match transition_type.to_lowercase().as_str() {
        "fade" | "dip_black" | "black" => "fade",
        "fadewhite" | "dip_white" | "white" => "fadewhite",
        "wipeleft" => "wipeleft",
        "wiperight" => "wiperight",
        "slideup" => "slideup",
        "slidedown" => "slidedown",
        "dissolve" | "crossdissolve" | _ => "dissolve",
    };

    format!(
        "xfade=transition={}:duration={:.3}:offset={:.3}",
        normalized,
        duration.max(0.1),
        offset.max(0.0)
    )
}

/// Escapes a file path specifically for use inside FFmpeg filter options on Windows.
///
/// On Windows, FFmpeg filter argument parsing interprets `:` as parameter delimiters
/// and `\` as escape sequences. This function replaces backslashes with forward slashes
/// and escapes colons and single quotes so paths can be safely enclosed in `file='...'`.
pub fn escape_ffmpeg_filter_path(path: &Path) -> String {
    let path_str = path.to_string_lossy();
    // Convert backslashes to forward slashes for cross-platform FFmpeg filter path compatibility
    let normalized = path_str.replace('\\', "/");
    // Escape colons (Windows drive letters like C:) and single quotes
    normalized.replace(':', "\\:").replace('\'', "\\'")
}

/// Supported 3D LUT interpolation algorithms in FFmpeg `lut3d`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Lut3DInterpolation {
    #[serde(rename = "nearest")]
    Nearest,
    #[serde(rename = "trilinear")]
    Trilinear,
    #[serde(rename = "tetrahedral")]
    Tetrahedral,
}

impl Lut3DInterpolation {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Nearest => "nearest",
            Self::Trilinear => "trilinear",
            Self::Tetrahedral => "tetrahedral",
        }
    }
}

/// Configuration options for the FFmpeg `afftdn` (Audio FFT Denoise) filter.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct AfftdnConfig {
    /// Noise reduction in dB. Range: 0.01 to 97. Default: 12.0 dB.
    pub noise_reduction_db: Option<f32>,
    /// Noise floor in dB. Range: -80 to -20. Default: -50.0 dB.
    pub noise_floor_db: Option<f32>,
    /// Noise type: 'w' (white), 'v' (vinyl), 's' (shellac), 't' (tire), 'b' (brown), 'm' (pink).
    pub noise_type: Option<String>,
    /// Adaptively track noise floor changes (0 = disabled, 1 = enabled).
    pub track_noise: Option<bool>,
    /// Track residual floor (0 = disabled, 1 = enabled).
    pub track_residual: Option<bool>,
    /// Output mode: 'o' (filtered audio), 'n' (noise only), 'i' (input).
    pub output_mode: Option<String>,
}

impl Default for AfftdnConfig {
    fn default() -> Self {
        Self {
            noise_reduction_db: Some(12.0),
            noise_floor_db: Some(-50.0),
            noise_type: None,
            track_noise: None,
            track_residual: None,
            output_mode: None,
        }
    }
}

impl AfftdnConfig {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn with_noise_reduction(mut self, db: f32) -> Self {
        self.noise_reduction_db = Some(db);
        self
    }

    pub fn with_noise_floor(mut self, db: f32) -> Self {
        self.noise_floor_db = Some(db);
        self
    }

    pub fn with_noise_type(mut self, noise_type: impl Into<String>) -> Self {
        self.noise_type = Some(noise_type.into());
        self
    }

    pub fn with_track_noise(mut self, enabled: bool) -> Self {
        self.track_noise = Some(enabled);
        self
    }

    pub fn with_track_residual(mut self, enabled: bool) -> Self {
        self.track_residual = Some(enabled);
        self
    }

    pub fn with_output_mode(mut self, mode: impl Into<String>) -> Self {
        self.output_mode = Some(mode.into());
        self
    }

    /// Formats the configuration into an FFmpeg `afftdn` filter string.
    pub fn to_filter_string(&self) -> String {
        let mut opts = Vec::new();
        if let Some(nr) = self.noise_reduction_db {
            opts.push(format!("nr={}", nr));
        }
        if let Some(nf) = self.noise_floor_db {
            opts.push(format!("nf={}", nf));
        }
        if let Some(ref nt) = self.noise_type {
            opts.push(format!("nt={}", nt));
        }
        if let Some(tn) = self.track_noise {
            opts.push(format!("tn={}", if tn { 1 } else { 0 }));
        }
        if let Some(tr) = self.track_residual {
            opts.push(format!("tr={}", if tr { 1 } else { 0 }));
        }
        if let Some(ref om) = self.output_mode {
            opts.push(format!("om={}", om));
        }

        if opts.is_empty() {
            "afftdn".to_string()
        } else {
            format!("afftdn={}", opts.join(":"))
        }
    }
}

/// Common video filters supported in the filter chain.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum VideoFilter {
    /// 3D LUT file (.cube) applied via `lut3d=file='<escaped_path>'`.
    Lut3D {
        path: PathBuf,
        interp: Option<Lut3DInterpolation>,
    },
    /// Video scaling filter `scale=width:height`. Use -1 for automatic aspect-ratio preservation.
    Scale {
        width: i32,
        height: i32,
        force_original_aspect_ratio: Option<String>,
    },
    /// Frame rate conversion `fps=fps=<fps>`.
    Fps(f64),
    /// Color balance / EQ `eq=brightness=...:contrast=...:saturation=...`.
    ColorAdjustment {
        brightness: Option<f32>,
        contrast: Option<f32>,
        saturation: Option<f32>,
    },
    /// Video crop `crop=w:h:x:y`.
    Crop {
        width: u32,
        height: u32,
        x: u32,
        y: u32,
    },
    /// Arbitrary custom video filter expression.
    Custom(String),
}

impl VideoFilter {
    pub fn lut3d(path: impl Into<PathBuf>) -> Self {
        Self::Lut3D {
            path: path.into(),
            interp: None,
        }
    }

    pub fn lut3d_with_interp(path: impl Into<PathBuf>, interp: Lut3DInterpolation) -> Self {
        Self::Lut3D {
            path: path.into(),
            interp: Some(interp),
        }
    }

    pub fn scale(width: i32, height: i32) -> Self {
        Self::Scale {
            width,
            height,
            force_original_aspect_ratio: None,
        }
    }

    pub fn to_filter_string(&self) -> String {
        match self {
            Self::Lut3D { path, interp } => {
                let escaped = escape_ffmpeg_filter_path(path);
                match interp {
                    Some(i) => format!("lut3d=file='{}':interp={}", escaped, i.as_str()),
                    None => format!("lut3d=file='{}'", escaped),
                }
            }
            Self::Scale {
                width,
                height,
                force_original_aspect_ratio,
            } => {
                if let Some(ref force) = force_original_aspect_ratio {
                    format!(
                        "scale={}:{}:force_original_aspect_ratio={}",
                        width, height, force
                    )
                } else {
                    format!("scale={}:{}", width, height)
                }
            }
            Self::Fps(fps) => format!("fps=fps={}", fps),
            Self::ColorAdjustment {
                brightness,
                contrast,
                saturation,
            } => {
                let mut opts = Vec::new();
                if let Some(b) = brightness {
                    opts.push(format!("brightness={}", b));
                }
                if let Some(c) = contrast {
                    opts.push(format!("contrast={}", c));
                }
                if let Some(s) = saturation {
                    opts.push(format!("saturation={}", s));
                }
                if opts.is_empty() {
                    "eq".to_string()
                } else {
                    format!("eq={}", opts.join(":"))
                }
            }
            Self::Crop {
                width,
                height,
                x,
                y,
            } => format!("crop={}:{}:{}:{}", width, height, x, y),
            Self::Custom(filter) => filter.clone(),
        }
    }
}

/// Common audio filters supported in the filter chain.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum AudioFilter {
    /// Audio FFT Denoising via `afftdn`.
    Denoise(AfftdnConfig),
    /// Volume adjustment e.g. `volume=1.5` or `volume=-3dB`.
    Volume(f32),
    /// High-pass filter `highpass=f=<frequency>`.
    HighPass { frequency: f32 },
    /// Low-pass filter `lowpass=f=<frequency>`.
    LowPass { frequency: f32 },
    /// Arbitrary custom audio filter expression.
    Custom(String),
}

impl AudioFilter {
    pub fn denoise(config: Option<AfftdnConfig>) -> Self {
        Self::Denoise(config.unwrap_or_default())
    }

    pub fn volume(gain: f32) -> Self {
        Self::Volume(gain)
    }

    pub fn to_filter_string(&self) -> String {
        match self {
            Self::Denoise(cfg) => cfg.to_filter_string(),
            Self::Volume(vol) => format!("volume={:.2}", vol),
            Self::HighPass { frequency } => format!("highpass=f={}", frequency),
            Self::LowPass { frequency } => format!("lowpass=f={}", frequency),
            Self::Custom(filter) => filter.clone(),
        }
    }
}

/// Supported Windows video encoders prioritized by hardware acceleration.
///
/// Priority order on Windows:
/// 1. `h264_nvenc` (NVIDIA)
/// 2. `h264_qsv` (Intel)
/// 3. `h264_amf` (AMD)
/// 4. `libx264` (CPU fallback)
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum VideoEncoder {
    #[serde(rename = "h264_nvenc")]
    H264Nvenc,
    #[serde(rename = "h264_qsv")]
    H264Qsv,
    #[serde(rename = "h264_amf")]
    H264Amf,
    #[serde(rename = "libx264")]
    Libx264,
}

impl VideoEncoder {
    /// Prioritized list of Windows video encoders.
    pub const PRIORITY: [VideoEncoder; 4] = [
        VideoEncoder::H264Nvenc,
        VideoEncoder::H264Qsv,
        VideoEncoder::H264Amf,
        VideoEncoder::Libx264,
    ];

    /// Returns the static priority list.
    pub fn priority_order() -> &'static [VideoEncoder] {
        &Self::PRIORITY
    }

    /// Canonical FFmpeg codec name.
    pub fn codec_name(&self) -> &'static str {
        match self {
            Self::H264Nvenc => "h264_nvenc",
            Self::H264Qsv => "h264_qsv",
            Self::H264Amf => "h264_amf",
            Self::Libx264 => "libx264",
        }
    }

    /// User-friendly display name.
    pub fn display_name(&self) -> &'static str {
        match self {
            Self::H264Nvenc => "NVIDIA NVENC (H.264)",
            Self::H264Qsv => "Intel Quick Sync Video (H.264)",
            Self::H264Amf => "AMD AMF (H.264)",
            Self::Libx264 => "CPU Software (libx264)",
        }
    }

    /// Whether this encoder uses dedicated hardware acceleration.
    pub fn is_hardware_accelerated(&self) -> bool {
        !matches!(self, Self::Libx264)
    }

    /// Parse an encoder from string name.
    pub fn from_codec_name(name: &str) -> Option<Self> {
        match name.trim().to_lowercase().as_str() {
            "h264_nvenc" | "nvenc" => Some(Self::H264Nvenc),
            "h264_qsv" | "qsv" => Some(Self::H264Qsv),
            "h264_amf" | "amf" => Some(Self::H264Amf),
            "libx264" | "x264" | "cpu" => Some(Self::Libx264),
            _ => None,
        }
    }

    /// Generates recommended default FFmpeg encoding arguments for this encoder on Windows.
    ///
    /// - `quality`: Constant rate / quantizer value (CRF, CQ, or global_quality). Defaults to 23.
    /// - `bitrate_kbps`: Optional target bitrate in kbps (e.g. 8000 for 8 Mbps). If specified, bitrate mode is used.
    pub fn default_args(&self, quality: Option<u32>, bitrate_kbps: Option<u32>) -> Vec<String> {
        let mut args = Vec::new();
        args.push("-c:v".to_string());
        args.push(self.codec_name().to_string());

        let q = quality.unwrap_or(23);

        match self {
            Self::H264Nvenc => {
                // NVENC quality presets (p1 to p7, p4 is balanced)
                args.push("-preset".to_string());
                args.push("p4".to_string());
                args.push("-tune".to_string());
                args.push("hq".to_string());
                if let Some(br) = bitrate_kbps {
                    args.push("-b:v".to_string());
                    args.push(format!("{}k", br));
                } else {
                    args.push("-rc".to_string());
                    args.push("vbr".to_string());
                    args.push("-cq".to_string());
                    args.push(q.to_string());
                }
                args.push("-pix_fmt".to_string());
                args.push("yuv420p".to_string());
            }
            Self::H264Qsv => {
                // Intel QuickSync Video defaults
                args.push("-preset".to_string());
                args.push("medium".to_string());
                if let Some(br) = bitrate_kbps {
                    args.push("-b:v".to_string());
                    args.push(format!("{}k", br));
                } else {
                    args.push("-global_quality".to_string());
                    args.push(q.to_string());
                }
                args.push("-pix_fmt".to_string());
                args.push("nv12".to_string());
            }
            Self::H264Amf => {
                // AMD AMF defaults
                args.push("-quality".to_string());
                args.push("balanced".to_string());
                if let Some(br) = bitrate_kbps {
                    args.push("-rc".to_string());
                    args.push("cbr".to_string());
                    args.push("-b:v".to_string());
                    args.push(format!("{}k", br));
                } else {
                    args.push("-rc".to_string());
                    args.push("cqp".to_string());
                    args.push("-qp_p".to_string());
                    args.push(q.to_string());
                    args.push("-qp_i".to_string());
                    args.push(q.to_string());
                }
                args.push("-pix_fmt".to_string());
                args.push("nv12".to_string());
            }
            Self::Libx264 => {
                // Standard CPU libx264
                args.push("-preset".to_string());
                args.push("medium".to_string());
                if let Some(br) = bitrate_kbps {
                    args.push("-b:v".to_string());
                    args.push(format!("{}k", br));
                } else {
                    args.push("-crf".to_string());
                    args.push(q.to_string());
                }
                args.push("-pix_fmt".to_string());
                args.push("yuv420p".to_string());
            }
        }

        args
    }

    /// Parses the raw standard output of `ffmpeg -encoders` and extracts recognized encoders.
    pub fn parse_available_encoders(ffmpeg_encoders_output: &str) -> Vec<VideoEncoder> {
        let mut found = Vec::new();
        for line in ffmpeg_encoders_output.lines() {
            let line_trimmed = line.trim();
            if line_trimmed.contains("h264_nvenc") && !found.contains(&VideoEncoder::H264Nvenc) {
                found.push(VideoEncoder::H264Nvenc);
            }
            if line_trimmed.contains("h264_qsv") && !found.contains(&VideoEncoder::H264Qsv) {
                found.push(VideoEncoder::H264Qsv);
            }
            if line_trimmed.contains("h264_amf") && !found.contains(&VideoEncoder::H264Amf) {
                found.push(VideoEncoder::H264Amf);
            }
            if line_trimmed.contains("libx264") && !found.contains(&VideoEncoder::Libx264) {
                found.push(VideoEncoder::Libx264);
            }
        }
        found
    }

    /// Selects the highest priority encoder available based on Windows GPU priorities.
    /// Falls back to `Libx264` if none of the hardware encoders are present.
    pub fn select_best_encoder(available: &[VideoEncoder]) -> VideoEncoder {
        for candidate in Self::priority_order() {
            if available.contains(candidate) {
                return *candidate;
            }
        }
        VideoEncoder::Libx264
    }

    /// Probes raw `ffmpeg -encoders` output and resolves the best available encoder.
    pub fn detect_best_encoder_from_output(ffmpeg_encoders_output: &str) -> VideoEncoder {
        let available = Self::parse_available_encoders(ffmpeg_encoders_output);
        Self::select_best_encoder(&available)
    }
}

/// Dynamic FFmpeg FilterGraph structure.
///
/// Supports chained video filters (LUTs, scaling, etc.), chained audio filters (afftdn, volume),
/// and custom complex filter segments. Generates full `-filter_complex` strings and stream mapping args.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct FilterGraph {
    /// Input video stream label (default: `"0:v"`).
    pub video_input_label: String,
    /// Input audio stream label (default: `"0:a"`).
    pub audio_input_label: String,
    /// Output video stream label (default: `"v_out"`).
    pub video_output_label: String,
    /// Output audio stream label (default: `"a_out"`).
    pub audio_output_label: String,
    /// Chained video filters.
    pub video_filters: Vec<VideoFilter>,
    /// Chained audio filters.
    pub audio_filters: Vec<AudioFilter>,
    /// Additional custom filter chains.
    pub custom_chains: Vec<String>,
}

impl Default for FilterGraph {
    fn default() -> Self {
        Self {
            video_input_label: "0:v".to_string(),
            audio_input_label: "0:a".to_string(),
            video_output_label: "v_out".to_string(),
            audio_output_label: "a_out".to_string(),
            video_filters: Vec::new(),
            audio_filters: Vec::new(),
            custom_chains: Vec::new(),
        }
    }
}

impl FilterGraph {
    pub fn builder() -> FilterGraphBuilder {
        FilterGraphBuilder::new()
    }

    pub fn is_empty(&self) -> bool {
        self.video_filters.is_empty()
            && self.audio_filters.is_empty()
            && self.custom_chains.is_empty()
    }

    pub fn has_video_filters(&self) -> bool {
        !self.video_filters.is_empty()
    }

    pub fn has_audio_filters(&self) -> bool {
        !self.audio_filters.is_empty()
    }

    /// Builds the video filter chain string, e.g.:
    /// `[0:v]lut3d=file='path.cube',scale=1920:1080[v_out]`
    pub fn build_video_chain(&self) -> Option<String> {
        if self.video_filters.is_empty() {
            return None;
        }
        let filters: Vec<String> = self
            .video_filters
            .iter()
            .map(|f| f.to_filter_string())
            .collect();
        Some(format!(
            "[{inputs}]{filter_body}[{output}]",
            inputs = self.video_input_label,
            filter_body = filters.join(","),
            output = self.video_output_label
        ))
    }

    /// Builds the audio filter chain string, e.g.:
    /// `[0:a]afftdn=nr=12:nf=-50,volume=1.20[a_out]`
    pub fn build_audio_chain(&self) -> Option<String> {
        if self.audio_filters.is_empty() {
            return None;
        }
        let filters: Vec<String> = self
            .audio_filters
            .iter()
            .map(|f| f.to_filter_string())
            .collect();
        Some(format!(
            "[{inputs}]{filter_body}[{output}]",
            inputs = self.audio_input_label,
            filter_body = filters.join(","),
            output = self.audio_output_label
        ))
    }

    /// Generates the complete `-filter_complex` string by joining all active filter chains.
    ///
    /// Returns `None` if no filters or custom chains are configured.
    pub fn build_filter_complex(&self) -> Option<String> {
        let mut chains = Vec::new();

        if let Some(vc) = self.build_video_chain() {
            chains.push(vc);
        }

        if let Some(ac) = self.build_audio_chain() {
            chains.push(ac);
        }

        for custom in &self.custom_chains {
            chains.push(custom.clone());
        }

        if chains.is_empty() {
            None
        } else {
            Some(chains.join(";"))
        }
    }

    /// Generates FFmpeg mapping arguments matching the filtergraph structure.
    pub fn build_mapping_args(&self) -> Vec<String> {
        let mut args = Vec::new();

        if self.has_video_filters() {
            args.push("-map".to_string());
            args.push(format!("[{}]", self.video_output_label));
        } else {
            args.push("-map".to_string());
            args.push(self.video_input_label.clone());
        }

        if self.has_audio_filters() {
            args.push("-map".to_string());
            args.push(format!("[{}]", self.audio_output_label));
        } else {
            args.push("-map".to_string());
            args.push(format!("{}?", self.audio_input_label));
        }

        args
    }

    /// Generates combined `-filter_complex` arguments and output `-map` stream mappings.
    pub fn build_command_args(&self) -> Vec<String> {
        let mut args = Vec::new();
        if let Some(fc) = self.build_filter_complex() {
            args.push("-filter_complex".to_string());
            args.push(fc);
        }
        args.extend(self.build_mapping_args());
        args
    }
}

/// Builder for constructing [`FilterGraph`] instances dynamically.
#[derive(Debug, Clone, Default)]
pub struct FilterGraphBuilder {
    graph: FilterGraph,
}

impl FilterGraphBuilder {
    pub fn new() -> Self {
        Self {
            graph: FilterGraph::default(),
        }
    }

    pub fn video_input(mut self, label: impl Into<String>) -> Self {
        self.graph.video_input_label = label.into();
        self
    }

    pub fn audio_input(mut self, label: impl Into<String>) -> Self {
        self.graph.audio_input_label = label.into();
        self
    }

    pub fn video_output(mut self, label: impl Into<String>) -> Self {
        self.graph.video_output_label = label.into();
        self
    }

    pub fn audio_output(mut self, label: impl Into<String>) -> Self {
        self.graph.audio_output_label = label.into();
        self
    }

    pub fn add_video_filter(mut self, filter: VideoFilter) -> Self {
        self.graph.video_filters.push(filter);
        self
    }

    /// Appends a 3D LUT filter (`.cube`) using the specified file path.
    pub fn add_lut3d(mut self, path: impl Into<PathBuf>) -> Self {
        self.graph.video_filters.push(VideoFilter::lut3d(path));
        self
    }

    /// Appends a 3D LUT filter with custom interpolation.
    pub fn add_lut3d_with_interp(
        mut self,
        path: impl Into<PathBuf>,
        interp: Lut3DInterpolation,
    ) -> Self {
        self.graph
            .video_filters
            .push(VideoFilter::lut3d_with_interp(path, interp));
        self
    }

    /// Appends a video scaling filter.
    pub fn add_scale(mut self, width: i32, height: i32) -> Self {
        self.graph
            .video_filters
            .push(VideoFilter::scale(width, height));
        self
    }

    /// Appends an FPS conversion filter.
    pub fn add_fps(mut self, fps: f64) -> Self {
        self.graph.video_filters.push(VideoFilter::Fps(fps));
        self
    }

    pub fn add_audio_filter(mut self, filter: AudioFilter) -> Self {
        self.graph.audio_filters.push(filter);
        self
    }

    /// Appends an audio denoiser filter (`afftdn`).
    pub fn add_audio_denoise(mut self, config: Option<AfftdnConfig>) -> Self {
        self.graph
            .audio_filters
            .push(AudioFilter::denoise(config));
        self
    }

    /// Appends a volume filter.
    pub fn add_volume(mut self, gain: f32) -> Self {
        self.graph.audio_filters.push(AudioFilter::volume(gain));
        self
    }

    /// Appends a custom filter chain segment.
    pub fn add_custom_chain(mut self, chain: impl Into<String>) -> Self {
        self.graph.custom_chains.push(chain.into());
        self
    }

    pub fn build(self) -> FilterGraph {
        self.graph
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn test_windows_path_escaping() {
        let windows_path = PathBuf::from(r"C:\Users\editor\LUTs\cool_look.cube");
        let escaped = escape_ffmpeg_filter_path(&windows_path);
        assert_eq!(escaped, "C\\:/Users/editor/LUTs/cool_look.cube");

        let filter = VideoFilter::lut3d(windows_path);
        assert_eq!(
            filter.to_filter_string(),
            "lut3d=file='C\\:/Users/editor/LUTs/cool_look.cube'"
        );
    }

    #[test]
    fn test_windows_path_with_single_quotes_and_spaces() {
        let path = PathBuf::from(r"D:\Video Projects\LUT's\mood.cube");
        let escaped = escape_ffmpeg_filter_path(&path);
        assert_eq!(escaped, "D\\:/Video Projects/LUT\\'s/mood.cube");

        let filter = VideoFilter::lut3d_with_interp(path, Lut3DInterpolation::Tetrahedral);
        assert_eq!(
            filter.to_filter_string(),
            "lut3d=file='D\\:/Video Projects/LUT\\'s/mood.cube':interp=tetrahedral"
        );
    }

    #[test]
    fn test_afftdn_filter_string() {
        let default_denoise = AfftdnConfig::default();
        assert_eq!(default_denoise.to_filter_string(), "afftdn=nr=12:nf=-50");

        let custom_denoise = AfftdnConfig::new()
            .with_noise_reduction(18.5)
            .with_noise_floor(-45.0)
            .with_noise_type("w")
            .with_track_noise(true);
        assert_eq!(
            custom_denoise.to_filter_string(),
            "afftdn=nr=18.5:nf=-45:nt=w:tn=1"
        );
    }

    #[test]
    fn test_dynamic_filtergraph_chaining() {
        let lut_path = PathBuf::from(r"C:\Presets\cinematic.cube");
        let graph = FilterGraph::builder()
            .add_lut3d(lut_path)
            .add_scale(1920, 1080)
            .add_audio_denoise(Some(AfftdnConfig::default()))
            .add_volume(1.25)
            .build();

        let fc = graph.build_filter_complex().unwrap();
        assert_eq!(
            fc,
            "[0:v]lut3d=file='C\\:/Presets/cinematic.cube',scale=1920:1080[v_out];[0:a]afftdn=nr=12:nf=-50,volume=1.25[a_out]"
        );

        let args = graph.build_command_args();
        assert_eq!(
            args,
            vec![
                "-filter_complex",
                "[0:v]lut3d=file='C\\:/Presets/cinematic.cube',scale=1920:1080[v_out];[0:a]afftdn=nr=12:nf=-50,volume=1.25[a_out]",
                "-map",
                "[v_out]",
                "-map",
                "[a_out]"
            ]
        );
    }

    #[test]
    fn test_encoder_priority_and_selection() {
        assert_eq!(
            VideoEncoder::priority_order(),
            &[
                VideoEncoder::H264Nvenc,
                VideoEncoder::H264Qsv,
                VideoEncoder::H264Amf,
                VideoEncoder::Libx264,
            ]
        );

        // Simulated ffmpeg -encoders output with all encoders
        let full_output = r#"
Encoders:
 V..... h264_amf             AMD AMF H.264 Encoder (codec h264)
 V..... h264_nvenc           NVIDIA NVENC H.264 encoder (codec h264)
 V..... h264_qsv             Intel Quick Sync Video H.264 encoder (codec h264)
 V..... libx264              libx264 H.264 / AVC / MPEG-4 AVC / MPEG-4 part 10 (codec h264)
"#;
        assert_eq!(
            VideoEncoder::detect_best_encoder_from_output(full_output),
            VideoEncoder::H264Nvenc
        );

        // Simulated Intel + AMD + CPU
        let qsv_output = r#"
 V..... h264_amf             AMD AMF H.264 Encoder
 V..... h264_qsv             Intel Quick Sync Video H.264
 V..... libx264              libx264
"#;
        assert_eq!(
            VideoEncoder::detect_best_encoder_from_output(qsv_output),
            VideoEncoder::H264Qsv
        );

        // Simulated AMD + CPU
        let amf_output = r#"
 V..... h264_amf             AMD AMF H.264 Encoder
 V..... libx264              libx264
"#;
        assert_eq!(
            VideoEncoder::detect_best_encoder_from_output(amf_output),
            VideoEncoder::H264Amf
        );

        // CPU only
        let cpu_output = r#"
 V..... libx264              libx264
"#;
        assert_eq!(
            VideoEncoder::detect_best_encoder_from_output(cpu_output),
            VideoEncoder::Libx264
        );
    }

    #[test]
    fn test_phase8_speed_filters() {
        // Fast forward 4x
        let sp_fast = SpeedProfile {
            speed_multiplier: 4.0,
            pitch_correction: true,
        };
        let v_fast = build_speed_video_filters(Some(&sp_fast));
        assert!(v_fast[0].contains("setpts="));
        let a_fast = build_speed_audio_filters(Some(&sp_fast));
        assert_eq!(a_fast, vec!["atempo=2.0", "atempo=2.0"]);

        // Slow motion 0.5x with minterpolate optical flow
        let sp_slow = SpeedProfile {
            speed_multiplier: 0.5,
            pitch_correction: true,
        };
        let v_slow = build_speed_video_filters(Some(&sp_slow));
        assert_eq!(v_slow.len(), 2);
        assert!(v_slow[1].contains("minterpolate"));
        let a_slow = build_speed_audio_filters(Some(&sp_slow));
        assert_eq!(a_slow, vec!["atempo=0.5"]);

        // Pitch correction disabled
        let sp_no_pitch = SpeedProfile {
            speed_multiplier: 2.0,
            pitch_correction: false,
        };
        let a_no_pitch = build_speed_audio_filters(Some(&sp_no_pitch));
        assert_eq!(a_no_pitch, vec!["volume=0"]);
    }

    #[test]
    fn test_phase8_lens_effects() {
        let lens = LensEffects {
            defish_enabled: true,
            defish_strength: 0.8,
            gaussian_blur: 12.0,
        };
        let filters = build_lens_effects_filter_chain(Some(&lens));
        assert_eq!(filters.len(), 2);
        assert!(filters[0].contains("lenscorrection="));
        assert!(filters[1].contains("gblur=sigma=12.0"));
    }

    #[test]
    fn test_phase8_motion_transform_filters() {
        let (filters, overlay_x, overlay_y) = build_motion_transform_filters(
            Some(1.5),
            Some(50.0),
            Some(-30.0),
            Some(45.0),
            Some(0.8),
            None,
            1920,
            1080,
        );

        assert!(filters.iter().any(|f| f.contains("scale=")));
        assert!(filters.iter().any(|f| f.contains("rotate=")));
        assert!(filters.iter().any(|f| f.contains("colorchannelmixer=")));
        assert_eq!(overlay_x, "(W-w)/2+50.0");
        assert_eq!(overlay_y, "(H-h)/2+-30.0");
    }
}
