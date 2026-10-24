//! Shared IPC Data Contracts for Antigravity Video Editor
//!
//! Defines the core project, track, clip, and multi-cam synchronization models.
//! Mirrored in `src/types/ipc.ts`.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Track media type: Video or Audio
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TrackType {
    #[serde(alias = "Video", alias = "video")]
    Video,
    #[serde(alias = "Audio", alias = "audio")]
    Audio,
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
