//! Shared IPC Data Contracts for Antigravity Video Editor
//!
//! Defines the core project, track, clip, and multi-cam synchronization models.
//! Mirrored in `src/types/ipc.ts`.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Track media type: Video, Audio, or Text
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TrackType {
    #[serde(alias = "Video", alias = "video")]
    Video,
    #[serde(alias = "Audio", alias = "audio")]
    Audio,
    #[serde(alias = "Text", alias = "text")]
    Text,
}

impl Default for TrackType {
    fn default() -> Self {
        TrackType::Video
    }
}

/// Clip media type
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum MediaType {
    #[serde(alias = "video", alias = "Video")]
    Video,
    #[serde(alias = "audio", alias = "Audio")]
    Audio,
    #[serde(alias = "image", alias = "Image")]
    Image,
    #[serde(alias = "adjustment", alias = "adjustment_layer", alias = "AdjustmentLayer")]
    AdjustmentLayer,
}

impl Default for MediaType {
    fn default() -> Self {
        MediaType::Video
    }
}

/// Synchronization mode for multi-cam alignment
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SyncMode {
    #[serde(alias = "Filename", alias = "filename")]
    Filename,
    #[serde(alias = "Audio", alias = "audio", alias = "waveform", alias = "Waveform")]
    Audio,
    #[serde(alias = "Metadata", alias = "metadata")]
    Metadata,
}

impl Default for SyncMode {
    fn default() -> Self {
        SyncMode::Filename
    }
}

/// Metadata extracted from a media clip file
#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ClipMetadata {
    pub duration_seconds: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub width: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub height: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub framerate: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sample_rate: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub channels: Option<u16>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub codec: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub creation_time: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub file_size_bytes: Option<u64>,
}

/// Individual keyframe point on an animation track
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct KeyframePoint {
    pub time: f64,       // seconds relative to clip start
    pub value: f32,
    pub easing: String,  // "linear", "ease_in_out"
}

/// Keyframe track binding a specific animatable property to an array of keyframe points
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct KeyframeTrack {
    pub property: String, // "scale", "position_x", "position_y", "rotation", "opacity"
    pub keyframes: Vec<KeyframePoint>,
}

/// Clip playback speed configuration
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SpeedProfile {
    #[serde(default = "default_speed_multiplier")]
    pub speed_multiplier: f32, // 0.1 to 16.0, default 1.0
    #[serde(default = "default_true_val")]
    pub pitch_correction: bool, // default true
}

fn default_speed_multiplier() -> f32 {
    1.0
}

fn default_true_val() -> bool {
    true
}

impl Default for SpeedProfile {
    fn default() -> Self {
        Self {
            speed_multiplier: 1.0,
            pitch_correction: true,
        }
    }
}

/// Native audio input device info
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AudioDeviceInfo {
    pub id: String,
    pub name: String,
    pub is_default: bool,
    pub channels: u16,
    pub sample_rates: Vec<u32>,
}

/// Keyframed volume rubber-band envelope point
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct VolumeKeyframePoint {
    pub time: f64,       // seconds relative to clip start
    pub value: f32,      // gain in dB (-60 to +12) or multiplier
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub easing: Option<String>,
}

fn default_reduction_intensity() -> f32 {
    12.0
}
fn default_ambient_fill_intensity() -> f32 {
    0.25
}
fn default_silence_cut_threshold() -> f32 {
    -35.0
}
fn default_silence_min_duration() -> f32 {
    0.6
}
fn default_cut_margin_padding() -> u32 {
    50
}
fn default_sensitivity() -> f32 {
    6.0
}
fn default_smoothing_bands() -> u32 {
    6
}

/// Spectral noise profiling, denoise and intelligent ambient noise fill configuration
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct NoiseDenoiseAndFillProfile {
    #[serde(default)]
    pub noise_reduction_enabled: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub noise_profile_path: Option<String>,
    #[serde(default = "default_reduction_intensity")]
    pub reduction_intensity_db: f32, // 0.0 to 48.0 dB, default 12.0
    #[serde(default = "default_sensitivity")]
    pub sensitivity: f32, // 0.5 to 12.0, default 6.0 (Audacity style)
    #[serde(default = "default_smoothing_bands")]
    pub frequency_smoothing_bands: u32, // 0 to 12, default 6
    #[serde(default)]
    pub audition_residue: bool, // Clean Output vs Audition Noise Residue
    #[serde(default)]
    pub ambient_recovery_enabled: bool,
    #[serde(default = "default_ambient_fill_intensity")]
    pub ambient_fill_intensity: f32, // 0.0 to 1.0, default 0.25
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub room_tone_loop_path: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub profile_duration_sec: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub denoised_audio_path: Option<String>,
    #[serde(default = "default_silence_cut_threshold")]
    pub silence_cut_threshold_db: f32, // -60.0 to -20.0, default -35.0
    #[serde(default = "default_silence_min_duration")]
    pub silence_min_duration_sec: f32, // 0.2 to 2.0, default 0.6
    #[serde(default = "default_cut_margin_padding")]
    pub cut_margin_padding_ms: u32, // default: 50ms
}

impl Default for NoiseDenoiseAndFillProfile {
    fn default() -> Self {
        Self {
            noise_reduction_enabled: false,
            noise_profile_path: None,
            reduction_intensity_db: 12.0,
            sensitivity: 6.0,
            frequency_smoothing_bands: 6,
            audition_residue: false,
            ambient_recovery_enabled: false,
            ambient_fill_intensity: 0.25,
            room_tone_loop_path: None,
            profile_duration_sec: None,
            denoised_audio_path: None,
            silence_cut_threshold_db: -35.0,
            silence_min_duration_sec: 0.6,
            cut_margin_padding_ms: 50,
        }
    }
}

/// Comprehensive audio processing settings (EQ, Pan, Volume Keyframes, Denoise & Ambient Fill)
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
#[serde(rename_all = "camelCase")]
pub struct AudioProcessingSettings {
    #[serde(default)]
    pub gain_db: f32,
    #[serde(default)]
    pub pan: f32,
    #[serde(default)]
    pub bass_gain: f32,
    #[serde(default)]
    pub mid_gain: f32,
    #[serde(default)]
    pub treble_gain: f32,
    #[serde(default)]
    pub volume_keyframes: Vec<VolumeKeyframePoint>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub noise_profile: Option<NoiseDenoiseAndFillProfile>,
}

/// Multi-track dynamic sidechain ducking configuration
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct DuckingConfig {
    #[serde(default)]
    pub ducking_enabled: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub target_track_index: Option<usize>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub target_track_id: Option<String>,
    #[serde(default = "default_ducking_attenuation")]
    pub attenuation_db: f32, // -6.0 to -30.0 dB
    #[serde(default = "default_ducking_attack")]
    pub attack_ms: u32,
    #[serde(default = "default_ducking_release")]
    pub release_ms: u32,
}

fn default_ducking_attenuation() -> f32 {
    -14.0
}

fn default_ducking_attack() -> u32 {
    50
}

fn default_ducking_release() -> u32 {
    300
}

impl Default for DuckingConfig {
    fn default() -> Self {
        Self {
            ducking_enabled: false,
            target_track_index: None,
            target_track_id: None,
            attenuation_db: -14.0,
            attack_ms: 50,
            release_ms: 300,
        }
    }
}

/// Optical lens distortion and blur parameters
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
#[serde(rename_all = "camelCase")]
pub struct LensEffects {
    #[serde(default)]
    pub defish_enabled: bool,
    #[serde(default)]
    pub defish_strength: f32, // -1.0 to 1.0
    #[serde(default)]
    pub gaussian_blur: f32,   // 0.0 to 50.0
}

/// Video stabilization and motion smoothing settings
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct StabilizationSettings {
    #[serde(default)]
    pub enabled: bool,
    #[serde(default = "default_stabilization_intensity")]
    pub intensity: f32, // 0.0 to 1.0 (0% to 100%)
    #[serde(default = "default_stabilization_smoothness")]
    pub smoothness: u32, // 1 to 50 frame smoothing window
    #[serde(default)]
    pub tripod_mode: bool, // Lock camera movement completely
}

fn default_stabilization_intensity() -> f32 {
    0.5
}

fn default_stabilization_smoothness() -> u32 {
    15
}

impl Default for StabilizationSettings {
    fn default() -> Self {
        Self {
            enabled: false,
            intensity: 0.5,
            smoothness: 15,
            tripod_mode: false,
        }
    }
}

/// Structured caption token block from speech recognition
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CaptionSegment {
    pub id: String,
    pub start_ms: i64,
    pub end_ms: i64,
    pub text: String,
}

/// Text styling parameters for title layers and captions
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct TextClipStyle {
    #[serde(default = "default_font_family")]
    pub font_family: String,
    #[serde(default = "default_font_size")]
    pub font_size: f32,
    #[serde(default = "default_font_color")]
    pub font_color: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub stroke_color: Option<String>,
    #[serde(default)]
    pub stroke_width: f32,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub background_color: Option<String>,
    #[serde(default = "default_bg_padding")]
    pub background_padding: f32,
    #[serde(default)]
    pub position_x: f32,
    #[serde(default)]
    pub position_y: f32,
    #[serde(default = "default_alignment")]
    pub alignment: String, // "left", "center", "right"
    #[serde(default = "default_line_height")]
    pub line_height: f32,
    #[serde(default = "default_font_weight")]
    pub font_weight: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub preset_style: Option<String>,
}

fn default_font_family() -> String {
    "Inter".to_string()
}

fn default_font_size() -> f32 {
    48.0
}

fn default_font_color() -> String {
    "#FFFFFF".to_string()
}

fn default_bg_padding() -> f32 {
    8.0
}

fn default_alignment() -> String {
    "center".to_string()
}

fn default_line_height() -> f32 {
    1.2
}

fn default_font_weight() -> String {
    "bold".to_string()
}

impl Default for TextClipStyle {
    fn default() -> Self {
        Self {
            font_family: default_font_family(),
            font_size: default_font_size(),
            font_color: default_font_color(),
            stroke_color: Some("#000000".to_string()),
            stroke_width: 2.0,
            background_color: None,
            background_padding: default_bg_padding(),
            position_x: 0.0,
            position_y: 0.0,
            alignment: default_alignment(),
            line_height: default_line_height(),
            font_weight: default_font_weight(),
            preset_style: None,
        }
    }
}

/// A text or title overlay clip on the timeline
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct TextClip {
    pub id: String,
    pub text: String,
    pub start_time: f64,
    pub duration: f64,
    pub track_index: usize,
    #[serde(default)]
    pub style: TextClipStyle,
}

/// Dedicated timeline track for text / subtitle overlay layers
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct TextTrack {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub muted: bool,
    #[serde(default)]
    pub locked: bool,
    #[serde(default = "default_visible")]
    pub visible: bool,
    #[serde(default)]
    pub clips: Vec<TextClip>,
}

/// A media clip placed on a timeline track
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Clip {
    pub id: String,
    pub track_id: String,
    #[serde(default)]
    pub name: String,
    pub file_path: String,

    // Primary millisecond timeline coordinates
    pub start_time_ms: i64,
    pub duration_ms: i64,
    pub source_offset_ms: i64,
    #[serde(default)]
    pub synced: bool,

    // Frontend interop and UI helper fields
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub media_type: Option<MediaType>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub in_point_seconds: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub out_point_seconds: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub start_position_seconds: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub duration_seconds: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub is_synced: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sync_delta_seconds: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub waveform_peaks: Option<Vec<f32>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub metadata: Option<ClipMetadata>,

    // Color & Audio Inspector properties (Milestone 4 & Phase 7)
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub brightness: Option<f32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub contrast: Option<f32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub saturation: Option<f32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub temperature: Option<f32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub lut_path: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub color: Option<ColorCorrection>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub volume_db: Option<f32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub audio_extracted: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub has_audio: Option<bool>,
    // Phase 6: Proxy workflow support
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub proxy_path: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub has_proxy: Option<bool>,

    // Phase 8: Motion Transform Controls, Keyframing, Speed Ramping, Lens Effects
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub scale: Option<f32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub position_x: Option<f32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub position_y: Option<f32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub rotation: Option<f32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub opacity: Option<f32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub keyframe_tracks: Option<Vec<KeyframeTrack>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub speed_profile: Option<SpeedProfile>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub lens_effects: Option<LensEffects>,

    // Phase 9: Text Overlays, Title Styling & Auto-Captions
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub text_content: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub text_style: Option<TextClipStyle>,

    // Phase 10: Audio Mastering Suite, EQ, Pan & Volume Envelopes
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub pan: Option<f32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub bass_gain: Option<f32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub mid_gain: Option<f32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub treble_gain: Option<f32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub volume_keyframes: Option<Vec<VolumeKeyframePoint>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub audio_processing: Option<AudioProcessingSettings>,

    // Phase 7: Hierarchical Color Grading & Adjustment Layers
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub color_grading: Option<ColorGradingProfile>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub is_adjustment_layer: Option<bool>,

    // Video Stabilization & Motion Smoothing
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub stabilization: Option<StabilizationSettings>,

    // Phase 11: Dedicated Filters & 3D LUTs Explorer
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub filter_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub filter_name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub filter_intensity: Option<f32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub filter_recipe: Option<crate::models::filters::ShaderRecipe>,
}

impl Clip {
    pub fn new(
        id: impl Into<String>,
        track_id: impl Into<String>,
        file_path: impl Into<String>,
        start_time_ms: i64,
        duration_ms: i64,
    ) -> Self {
        let path = file_path.into();
        let name = std::path::Path::new(&path)
            .file_name()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_else(|| "clip".to_string());
        let dur_sec = duration_ms as f64 / 1000.0;
        let start_sec = start_time_ms as f64 / 1000.0;

        Self {
            id: id.into(),
            track_id: track_id.into(),
            name,
            file_path: path,
            start_time_ms,
            duration_ms,
            source_offset_ms: 0,
            synced: false,
            media_type: Some(MediaType::Video),
            in_point_seconds: Some(0.0),
            out_point_seconds: Some(dur_sec),
            start_position_seconds: Some(start_sec),
            duration_seconds: Some(dur_sec),
            is_synced: Some(false),
            sync_delta_seconds: None,
            waveform_peaks: None,
            metadata: None,
            brightness: None,
            contrast: None,
            saturation: None,
            temperature: None,
            lut_path: None,
            color: None,
            volume_db: None,
            audio_extracted: Some(false),
            has_audio: Some(true),
            proxy_path: None,
            has_proxy: Some(false),
            scale: None,
            position_x: None,
            position_y: None,
            rotation: None,
            opacity: None,
            keyframe_tracks: None,
            speed_profile: None,
            lens_effects: None,
            text_content: None,
            text_style: None,
            pan: None,
            bass_gain: None,
            mid_gain: None,
            treble_gain: None,
            volume_keyframes: None,
            audio_processing: None,
            color_grading: None,
            is_adjustment_layer: None,
            stabilization: None,
            filter_id: None,
            filter_name: None,
            filter_intensity: None,
            filter_recipe: None,
        }
    }
}

/// A media track on the timeline containing clips
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct MediaTrack {
    pub id: String,
    pub name: String,
    pub track_type: TrackType,
    #[serde(default)]
    pub muted: bool,
    #[serde(default)]
    pub solo: bool,
    #[serde(default)]
    pub locked: bool,
    #[serde(default = "default_visible")]
    pub visible: bool,
    #[serde(default)]
    pub clips: Vec<Clip>,

    // Interop with frontend Track styling & audio controls
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub color: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub volume: Option<f32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub pan: Option<f32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub time_offset_seconds: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub transitions: Option<Vec<Transition>>,

    // Phase 10: Multi-Track Dynamic Ducking
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ducking: Option<DuckingConfig>,

    // Phase 7: Hierarchical Track-Level Color Grading
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub track_grading: Option<ColorGradingProfile>,
}

fn default_visible() -> bool {
    true
}

impl MediaTrack {
    pub fn new(id: impl Into<String>, name: impl Into<String>, track_type: TrackType) -> Self {
        Self {
            id: id.into(),
            name: name.into(),
            track_type,
            muted: false,
            solo: false,
            locked: false,
            visible: true,
            clips: Vec::new(),
            color: None,
            volume: Some(1.0),
            pan: Some(0.0),
            time_offset_seconds: Some(0.0),
            transitions: None,
            ducking: None,
            track_grading: None,
        }
    }
}

/// Color grading and 3D LUT configuration for a clip
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ColorCorrection {
    #[serde(default)]
    pub brightness: f32, // -1.0 to 1.0, default 0.0
    #[serde(default = "default_contrast")]
    pub contrast: f32,   // -2.0 to 2.0 (or 0.0 to 3.0), default 1.0
    #[serde(default = "default_saturation")]
    pub saturation: f32, // 0.0 to 3.0, default 1.0
    #[serde(default)]
    pub temperature: f32,// -100.0 to 100.0, default 0.0
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub lut_path: Option<String>,
}

fn default_contrast() -> f32 {
    1.0
}

fn default_saturation() -> f32 {
    1.0
}

impl Default for ColorCorrection {
    fn default() -> Self {
        Self {
            brightness: 0.0,
            contrast: 1.0,
            saturation: 1.0,
            temperature: 0.0,
            lut_path: None,
        }
    }
}

/// Normalized chromatic vector and luminance slider for 3-way color wheels
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ColorWheel {
    #[serde(default)]
    pub r: f32, // -1.0 to 1.0 chromatic offset
    #[serde(default)]
    pub g: f32,
    #[serde(default)]
    pub b: f32,
    #[serde(default)]
    pub luma: f32, // -1.0 to 1.0 luminance slider
}

impl Default for ColorWheel {
    fn default() -> Self {
        Self {
            r: 0.0,
            g: 0.0,
            b: 0.0,
            luma: 0.0,
        }
    }
}

/// Spline Curves control points (normalized [0.0, 1.0]) for Master, Red, Green, Blue
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct SplineCurves {
    #[serde(default)]
    pub master: Vec<(f32, f32)>,
    #[serde(default)]
    pub red: Vec<(f32, f32)>,
    #[serde(default)]
    pub green: Vec<(f32, f32)>,
    #[serde(default)]
    pub blue: Vec<(f32, f32)>,
}

/// HSL Secondary Qualifier for targeted color isolation and adjustment
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HslQualifier {
    #[serde(default)]
    pub enabled: bool,
    #[serde(default = "default_hue_center")]
    pub hue_center: f32, // 0.0 to 360.0 degrees
    #[serde(default = "default_hue_width")]
    pub hue_width: f32, // 0.0 to 180.0 degrees
    #[serde(default = "default_hue_softness")]
    pub hue_softness: f32, // 0.0 to 50.0 degrees
    #[serde(default = "default_sat_center")]
    pub sat_center: f32, // 0.0 to 1.0
    #[serde(default = "default_sat_width")]
    pub sat_width: f32, // 0.0 to 1.0
    #[serde(default = "default_sat_softness")]
    pub sat_softness: f32, // 0.0 to 1.0
    #[serde(default = "default_lum_center")]
    pub lum_center: f32, // 0.0 to 1.0
    #[serde(default = "default_lum_width")]
    pub lum_width: f32, // 0.0 to 1.0
    #[serde(default = "default_lum_softness")]
    pub lum_softness: f32, // 0.0 to 1.0
    #[serde(default)]
    pub isolated_hue_shift: f32, // -180.0 to +180.0 degrees
    #[serde(default = "default_isolated_sat")]
    pub isolated_sat: f32, // 0.0 to 2.0 (1.0 = unchanged)
    #[serde(default = "default_isolated_gain")]
    pub isolated_gain: f32, // 0.0 to 2.0 (1.0 = unchanged)
    #[serde(default)]
    pub show_matte: bool, // Highlight isolation mask in viewport
}

fn default_hue_center() -> f32 { 180.0 }
fn default_hue_width() -> f32 { 60.0 }
fn default_hue_softness() -> f32 { 20.0 }
fn default_sat_center() -> f32 { 0.5 }
fn default_sat_width() -> f32 { 0.5 }
fn default_sat_softness() -> f32 { 0.2 }
fn default_lum_center() -> f32 { 0.5 }
fn default_lum_width() -> f32 { 0.5 }
fn default_lum_softness() -> f32 { 0.2 }
fn default_isolated_sat() -> f32 { 1.0 }
fn default_isolated_gain() -> f32 { 1.0 }

impl Default for HslQualifier {
    fn default() -> Self {
        Self {
            enabled: false,
            hue_center: 180.0,
            hue_width: 60.0,
            hue_softness: 20.0,
            sat_center: 0.5,
            sat_width: 0.5,
            sat_softness: 0.2,
            lum_center: 0.5,
            lum_width: 0.5,
            lum_softness: 0.2,
            isolated_hue_shift: 0.0,
            isolated_sat: 1.0,
            isolated_gain: 1.0,
            show_matte: false,
        }
    }
}

/// Split-Toning color styling for shadows and highlights
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct SplitToning {
    #[serde(default)]
    pub shadow_hue: f32, // 0 to 360 deg
    #[serde(default)]
    pub shadow_sat: f32, // 0 to 100%
    #[serde(default)]
    pub highlight_hue: f32, // 0 to 360 deg
    #[serde(default)]
    pub highlight_sat: f32, // 0 to 100%
    #[serde(default)]
    pub balance: f32, // -100 to +100
}

/// Individual color band adjustment (Hue, Saturation, Brightness) for selective color grading
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct SelectiveColorAdjustment {
    #[serde(default)]
    pub hue: f32, // -100.0 to 100.0
    #[serde(default)]
    pub saturation: f32, // -100.0 to 100.0
    #[serde(default)]
    pub brightness: f32, // -100.0 to 100.0
}

/// Comprehensive Phase 7 Hierarchical Color Grading Profile
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ColorGradingProfile {
    // Primaries & Balance
    #[serde(default)]
    pub exposure: f32, // -4.0 to +4.0 EV, default 0.0
    #[serde(default = "default_contrast")]
    pub contrast: f32, // 0.0 to 2.0, default 1.0
    #[serde(default)]
    pub highlights: f32, // -1.0 to 1.0, default 0.0
    #[serde(default)]
    pub shadows: f32, // -1.0 to 1.0, default 0.0
    #[serde(default)]
    pub whites: f32, // -1.0 to 1.0, default 0.0
    #[serde(default)]
    pub blacks: f32, // -1.0 to 1.0, default 0.0
    #[serde(default)]
    pub brilliance: f32, // -1.0 to 1.0, default 0.0
    #[serde(default)]
    pub temperature: f32, // -100.0 to 100.0, default 0.0
    #[serde(default)]
    pub tint: f32, // -100.0 to 100.0, default 0.0
    #[serde(default = "default_saturation")]
    pub saturation: f32, // 0.0 to 3.0, default 1.0
    #[serde(default)]
    pub vibrance: f32, // -1.0 to 1.0, default 0.0

    // Effects
    #[serde(default)]
    pub sharpen: f32, // 0.0 to 100.0
    #[serde(default)]
    pub clarity: f32, // -100.0 to 100.0
    #[serde(default)]
    pub particles: f32, // 0.0 to 100.0 (film grain)
    #[serde(default)]
    pub fade: f32, // 0.0 to 100.0
    #[serde(default)]
    pub vignette: f32, // 0.0 to 100.0

    // Selective 8-Color Adjustments
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub selective_colors: Option<std::collections::HashMap<String, SelectiveColorAdjustment>>,

    // 3-Way Color Wheels
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub lift: Option<ColorWheel>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub gamma: Option<ColorWheel>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub gain: Option<ColorWheel>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub offset: Option<ColorWheel>,

    // Spline Curves
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub curves: Option<SplineCurves>,

    // HSL Secondary Qualifier
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub hsl_qualifier: Option<HslQualifier>,

    // Split-Toning
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub split_toning: Option<SplitToning>,

    // 3D LUT & Opacity
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub lut_path: Option<String>,
    #[serde(default = "default_lut_intensity")]
    pub lut_intensity: f32, // 0.0 to 1.0, default 1.0

    // Keyframed adjustments
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub keyframe_tracks: Option<Vec<KeyframeTrack>>,
}

fn default_lut_intensity() -> f32 {
    1.0
}

impl Default for ColorGradingProfile {
    fn default() -> Self {
        Self {
            exposure: 0.0,
            contrast: 1.0,
            highlights: 0.0,
            shadows: 0.0,
            whites: 0.0,
            blacks: 0.0,
            brilliance: 0.0,
            temperature: 0.0,
            tint: 0.0,
            saturation: 1.0,
            vibrance: 0.0,
            sharpen: 0.0,
            clarity: 0.0,
            particles: 0.0,
            fade: 0.0,
            vignette: 0.0,
            selective_colors: None,
            lift: None,
            gamma: None,
            gain: None,
            offset: None,
            curves: None,
            hsl_qualifier: None,
            split_toning: None,
            lut_path: None,
            lut_intensity: 1.0,
            keyframe_tracks: None,
        }
    }
}

/// Video cut-joint transition between two adjacent clips on a track
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Transition {
    pub id: String,
    pub track_id: String,
    pub from_clip_id: String,
    pub to_clip_id: String,
    pub transition_type: String, // "fade", "dissolve", "wipeleft", "wiperight", "slideup", "slidedown"
    pub duration: f64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub alignment: Option<String>, // "center", "start", "end"
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub show_border: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub border_color: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub border_width: Option<f64>,
}

/// Media Bin / Folder for organizing project assets (e.g. "Front POV", "Helmet Cam", "External Audio")
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct MediaBin {
    pub id: String,
    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub parent_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub color: Option<String>,
}

/// Media Asset imported into the project Media Pool
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct MediaAsset {
    pub id: String,
    pub name: String,
    pub file_path: String,
    #[serde(default)]
    pub media_type: MediaType,
    pub duration_seconds: f64,
    pub duration_ms: i64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub bin_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub thumbnail_url: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub width: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub height: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub framerate: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sample_rate: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub file_size_bytes: Option<u64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub creation_time: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub proxy_path: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub has_proxy: Option<bool>,
}

/// Progress event emitted during proxy generation via Tauri event system
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProxyProgressEvent {
    pub path: String,
    pub progress: f32,
    pub status: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub proxy_path: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub error_message: Option<String>,
}

/// Interval of audio silence detected in a track or clip
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SilenceInterval {
    pub start_sec: f64,
    pub end_sec: f64,
    pub duration_sec: f64,
}

/// Timeline project state tree
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct TimelineProject {
    pub id: String,
    pub name: String,
    #[serde(default = "default_fps")]
    pub fps: f64,
    #[serde(default = "default_sample_rate")]
    pub sample_rate: u32,
    #[serde(default = "default_width")]
    pub width: u32,
    #[serde(default = "default_height")]
    pub height: u32,
    #[serde(default)]
    pub duration_ms: i64,
    #[serde(default)]
    pub tracks: Vec<MediaTrack>,
    #[serde(default)]
    pub transitions: Vec<Transition>,
    #[serde(default)]
    pub bins: Vec<MediaBin>,
    #[serde(default)]
    pub assets: Vec<MediaAsset>,
    #[serde(default)]
    pub current_time_ms: i64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub master_grading: Option<ColorGradingProfile>,
}

fn default_fps() -> f64 {
    30.0
}

fn default_sample_rate() -> u32 {
    48000
}

fn default_width() -> u32 {
    1920
}

fn default_height() -> u32 {
    1080
}

impl Default for TimelineProject {
    fn default() -> Self {
        Self {
            id: "default-project".to_string(),
            name: "Untitled Project".to_string(),
            fps: default_fps(),
            sample_rate: default_sample_rate(),
            width: default_width(),
            height: default_height(),
            duration_ms: 0,
            tracks: Vec::new(),
            transitions: Vec::new(),
            bins: Vec::new(),
            assets: Vec::new(),
            current_time_ms: 0,
            master_grading: None,
        }
    }
}

/// Preset configuration for regex-based filename synchronization
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SyncPreset {
    pub id: String,
    pub name: String,
    pub pattern: String,
    pub description: String,
}

impl SyncPreset {
    pub fn default_presets() -> Vec<SyncPreset> {
        vec![
            SyncPreset {
                id: "preset_vid_timestamp".to_string(),
                name: "Standard Timestamp (VID_YYYYMMDD_HHMMSS)".to_string(),
                pattern: r"VID_(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})".to_string(),
                description: "Matches Android/Standard camera format VID_YYYYMMDD_HHMMSS".to_string(),
            },
            SyncPreset {
                id: "preset_gopro".to_string(),
                name: "GoPro Hero (GH/GX)".to_string(),
                pattern: r"G[HX](\d{2})(\d{4})".to_string(),
                description: "Matches GoPro Hero naming conventions".to_string(),
            },
            SyncPreset {
                id: "preset_sony".to_string(),
                name: "Sony Alpha (CXXXX)".to_string(),
                pattern: r"C(\d{4})".to_string(),
                description: "Matches Sony Alpha / FX sequential naming".to_string(),
            },
            SyncPreset {
                id: "preset_dji".to_string(),
                name: "DJI Drone / Action (DJI_XXXX)".to_string(),
                pattern: r"DJI_(\d{4})".to_string(),
                description: "Matches DJI drone and Action camera clips".to_string(),
            },
        ]
    }
}

/// Candidate match identified during synchronization
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SyncCandidate {
    pub track_id: String,
    pub track_name: String,
    pub clip_id: String,
    pub clip_name: String,
    pub file_path: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub parsed_timestamp: Option<String>,
    pub calculated_offset_seconds: f64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub calculated_offset_ms: Option<i64>,
    pub confidence: f64,
    pub is_reference: bool,
}

/// Placement strategy for synchronized clips on the timeline
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SyncPlacementMode {
    #[serde(alias = "compact", alias = "Compact", alias = "snap")]
    Compact,
    #[serde(alias = "absolute", alias = "Absolute", alias = "realtime")]
    Absolute,
    #[serde(alias = "custom_gap", alias = "customGap", alias = "capped")]
    CustomGap,
}

impl Default for SyncPlacementMode {
    fn default() -> Self {
        SyncPlacementMode::Compact
    }
}

/// Synchronization request payload from frontend to backend
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SyncRequest {
    pub mode: SyncMode,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub pattern: Option<String>,
    #[serde(default)]
    pub tracks: Vec<MediaTrack>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub reference_track_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub track_ids: Option<Vec<String>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub placement_mode: Option<SyncPlacementMode>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub max_gap_seconds: Option<f64>,
}

/// Synchronization response payload from backend to frontend
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SyncResult {
    pub success: bool,
    pub message: String,
    #[serde(default)]
    pub track_offsets: HashMap<String, i64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub updated_project: Option<TimelineProject>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub candidates: Option<Vec<SyncCandidate>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub reference_timestamp: Option<String>,
}

/// Clip-level timeline synchronization offset
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ClipSyncOffset {
    pub clip_id: String,
    pub track_id: String,
    pub offset_ms: i64,
    pub offset_seconds: f64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub timestamp: Option<String>,
}

/// Track-level timeline synchronization offset
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct TrackSyncOffset {
    pub track_id: String,
    pub track_name: String,
    pub offset_ms: i64,
    pub offset_seconds: f64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub earliest_clip_timestamp: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub clip_offsets: Option<Vec<ClipSyncOffset>>,
}

/// Hardware encoder types supported on Windows
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum HardwareEncoder {
    H264Nvenc,
    H264Qsv,
    H264Amf,
    Libx264,
}

/// Hardware probe response for GPU capability detection
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct HardwareProbeResponse {
    pub available_encoders: Vec<HardwareEncoder>,
    pub primary_encoder: HardwareEncoder,
    pub has_cuda: bool,
    pub has_quick_sync: bool,
}

/// Configuration for timeline video export requested by the frontend
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ExportConfig {
    pub output_path: String,
    #[serde(default = "default_width")]
    pub width: u32,
    #[serde(default = "default_height")]
    pub height: u32,
    #[serde(default = "default_fps")]
    pub fps: f64,
    #[serde(default = "default_codec")]
    pub codec: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub applied_lut_path: Option<String>,
    #[serde(default)]
    pub denoise_enabled: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub project: Option<TimelineProject>,
    #[serde(default)]
    pub tracks: Vec<MediaTrack>,
}

fn default_codec() -> String {
    "h264_nvenc".to_string()
}

/// Progress event emitted during FFmpeg rendering
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ExportProgress {
    pub percentage: f32,
    pub current_frame: u64,
    pub fps: f32,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub eta_seconds: Option<f32>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_clip_serialization() {
        let clip = Clip::new("clip-1", "track-1", "C:\\Videos\\VID_20260101_120000.mp4", 1000, 5000);
        let json = serde_json::to_string(&clip).expect("serialize clip");
        assert!(json.contains("\"startTimeMs\":1000"));
        assert!(json.contains("\"durationMs\":5000"));
        assert!(json.contains("\"trackId\":\"track-1\""));

        let deserialized: Clip = serde_json::from_str(&json).expect("deserialize clip");
        assert_eq!(clip.id, deserialized.id);
        assert_eq!(clip.duration_ms, deserialized.duration_ms);
    }

    #[test]
    fn test_sync_preset_defaults() {
        let presets = SyncPreset::default_presets();
        assert_eq!(presets.len(), 4);
        assert!(presets[0].pattern.contains("VID_"));
    }

    #[test]
    fn test_sync_request_and_result_roundtrip() {
        let mut offsets = HashMap::new();
        offsets.insert("track-1".to_string(), 0);
        offsets.insert("track-2".to_string(), 1450);

        let result = SyncResult {
            success: true,
            message: "Synchronized 2 tracks successfully".to_string(),
            track_offsets: offsets,
            updated_project: None,
            candidates: None,
            reference_timestamp: None,
        };

        let json = serde_json::to_string(&result).expect("serialize sync result");
        assert!(json.contains("\"trackOffsets\":{"));
        assert!(json.contains("\"success\":true"));

        let deserialized: SyncResult = serde_json::from_str(&json).expect("deserialize sync result");
        assert_eq!(deserialized.track_offsets.get("track-2"), Some(&1450));
    }

    #[test]
    fn test_export_config_deserialization_with_redundant_fields() {
        // Simulates the exact JSON payload sent from frontend with both canonical and alias fields
        let json_payload = r#"{
            "outputPath": "C:\\Exports\\Master.mp4",
            "width": 1920,
            "height": 1080,
            "fps": 30.0,
            "codec": "h264_nvenc",
            "denoiseEnabled": false,
            "tracks": [
                {
                    "id": "track-v1",
                    "name": "Track 1",
                    "trackType": "video",
                    "type": "video",
                    "muted": false,
                    "isMuted": false,
                    "solo": false,
                    "isSolo": false,
                    "locked": false,
                    "isLocked": false,
                    "visible": true,
                    "isVisible": true,
                    "clips": []
                }
            ]
        }"#;

        let config: Result<ExportConfig, _> = serde_json::from_str(json_payload);
        assert!(config.is_ok(), "ExportConfig should deserialize cleanly without duplicate field errors: {:?}", config.err());
        let config = config.unwrap();
        assert_eq!(config.tracks.len(), 1);
        assert_eq!(config.tracks[0].locked, false);
        assert_eq!(config.tracks[0].track_type, TrackType::Video);
    }
}
