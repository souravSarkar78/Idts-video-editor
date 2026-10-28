use std::fs;
use std::path::Path;
use serde::{Deserialize, Serialize};

use super::ipc::{MediaAsset, MediaBin, MediaTrack, Transition};
pub use super::ipc::{
    AudioDeviceInfo, AudioProcessingSettings, CaptionSegment, ColorCorrection, ColorGradingProfile,
    ColorWheel, DuckingConfig, HslQualifier, KeyframePoint, KeyframeTrack, LensEffects,
    NoiseDenoiseAndFillProfile, SpeedProfile, SplineCurves, SplitToning, StabilizationSettings, SelectiveColorAdjustment, TextClip, TextClipStyle, TextTrack, VolumeKeyframePoint,
};

/// High-level project metadata for .idts project file
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectMetadata {
    pub id: String,
    pub name: String,
    pub created_at: String,
    pub modified_at: String,
    pub fps: f64,
    pub width: u32,
    pub height: u32,
    pub duration_ms: u64,
}

/// Media pool container for bins and assets
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct MediaPool {
    #[serde(default)]
    pub bins: Vec<MediaBin>,
    #[serde(default)]
    pub assets: Vec<MediaAsset>,
}

/// Multi-track timeline state
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct TimelineData {
    #[serde(default)]
    pub tracks: Vec<MediaTrack>,
    #[serde(default)]
    pub text_tracks: Vec<TextTrack>,
    #[serde(default)]
    pub transitions: Vec<Transition>,
    #[serde(default)]
    pub playhead_sec: f64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub active_camera_track_id: Option<String>,
    // Phase 7: Hierarchical Master Bus Color Grading
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub master_grading: Option<ColorGradingProfile>,
}

/// Complete serializable project schema saved as `.idts`
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectData {
    #[serde(default = "default_project_version")]
    pub version: String,
    pub metadata: ProjectMetadata,
    #[serde(default)]
    pub media_pool: MediaPool,
    pub timeline: TimelineData,
}

fn default_project_version() -> String {
    "1.0.0".to_string()
}

impl ProjectData {
    /// Save project to disk with .idts extension
    pub fn save_to_file(&self, path: &Path) -> Result<(), String> {
        let serialized = serde_json::to_string_pretty(self)
            .map_err(|e| format!("Failed to serialize project: {}", e))?;

        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create project directory: {}", e))?;
        }

        fs::write(path, serialized)
            .map_err(|e| format!("Failed to write .idts project file: {}", e))?;

        Ok(())
    }

    /// Load project from .idts file
    pub fn load_from_file(path: &Path) -> Result<Self, String> {
        if !path.exists() {
            return Err(format!("Project file not found: {}", path.display()));
        }

        let content = fs::read_to_string(path)
            .map_err(|e| format!("Failed to read project file: {}", e))?;

        let project: Self = serde_json::from_str(&content)
            .map_err(|e| format!("Failed to parse .idts project: {}", e))?;

        Ok(project)
    }
}
