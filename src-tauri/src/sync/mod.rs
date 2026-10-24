//! Antigravity Video Editor Synchronization Engine
//!
//! Provides filename timestamp parsing and relative timeline alignment for multi-cam projects.
//! Owned and maintained by `sync_algorithm_specialist`.

pub mod audio_correlate;
pub mod filename;

pub use audio_correlate::*;
pub use filename::{
    calculate_relative_offsets, extract_filename, sync_active_timeline_tracks,
    sync_clips_by_filenames, sync_tracks_by_filename, template_to_regex,
    ClipTimestampInput, FilenameTimestampParser, ParsedTimestamp, SyncError,
    SyncedClipOffset, TimelineSyncResult, TimestampPreset,
};

/// High-level convenience function to extract timestamp from a camera filename using auto-detection
pub fn parse_camera_filename(filename: &str) -> Result<ParsedTimestamp, SyncError> {
    FilenameTimestampParser::auto_detect(filename)
}
