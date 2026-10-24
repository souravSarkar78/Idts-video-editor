//! Camera Filename Timestamp Parser & Relative Timeline Offset Calculator
//!
//! Provides configurable regex and template-based timestamp parsing for multi-camera video
//! and audio files (e.g. `VID_20261002_062623_10_071.mp4`, `DJI_20261002_062700.MP4`,
//! `AUDIO_20261002_062615.wav`).
//!
//! Calculates relative millisecond offsets anchored at 0 ms for the earliest clip, assigning
//! positive delta offsets to subsequent tracks.

use chrono::{DateTime, Datelike, NaiveDate, NaiveDateTime, NaiveTime, Timelike};
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::fmt;
use std::path::Path;
use thiserror::Error;

use crate::models::ipc::{
    ClipSyncOffset, MediaTrack, SyncCandidate, SyncPlacementMode, SyncRequest, SyncResult,
    TrackSyncOffset,
};

/// Errors encountered during filename timestamp parsing and synchronization
#[derive(Debug, Error, Clone, PartialEq, Eq)]
pub enum SyncError {
    #[error("No clips provided for timeline synchronization")]
    EmptyClips,

    #[error("Failed to compile regex pattern '{pattern}': {reason}")]
    RegexCompilationFailed { pattern: String, reason: String },

    #[error("Filename '{filename}' does not match timestamp pattern '{pattern}'")]
    FilenameParseFailed { pattern: String, filename: String },

    #[error("No recognized timestamp found in filename: '{0}'")]
    NoTimestampFound(String),

    #[error("Invalid date or time components ({year}-{month}-{day} {hour}:{minute}:{second}.{millisecond}): {reason}")]
    InvalidDateTime {
        year: i32,
        month: u32,
        day: u32,
        hour: u32,
        minute: u32,
        second: u32,
        millisecond: u32,
        reason: String,
    },

    #[error("Pattern is missing required capture groups: {0}")]
    MissingCaptureGroup(String),

    #[error("Invalid path '{0}'")]
    InvalidPath(String),
}

/// A parsed timestamp extracted from a media filename
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ParsedTimestamp {
    pub year: i32,
    pub month: u32,
    pub day: u32,
    pub hour: u32,
    pub minute: u32,
    pub second: u32,
    pub millisecond: u32,
}

impl ParsedTimestamp {
    /// Creates a new validated `ParsedTimestamp`
    pub fn new(
        year: i32,
        month: u32,
        day: u32,
        hour: u32,
        minute: u32,
        second: u32,
        millisecond: u32,
    ) -> Result<Self, SyncError> {
        if month < 1 || month > 12 {
            return Err(SyncError::InvalidDateTime {
                year,
                month,
                day,
                hour,
                minute,
                second,
                millisecond,
                reason: format!("month must be between 1 and 12, got {}", month),
            });
        }

        if hour > 23 || minute > 59 || second > 59 || millisecond > 999 {
            return Err(SyncError::InvalidDateTime {
                year,
                month,
                day,
                hour,
                minute,
                second,
                millisecond,
                reason: "time component out of valid 24h range".to_string(),
            });
        }

        // Validate calendar date using chrono
        if NaiveDate::from_ymd_opt(year, month, day).is_none() {
            return Err(SyncError::InvalidDateTime {
                year,
                month,
                day,
                hour,
                minute,
                second,
                millisecond,
                reason: format!("invalid day {} for year {} month {}", day, year, month),
            });
        }

        Ok(Self {
            year,
            month,
            day,
            hour,
            minute,
            second,
            millisecond,
        })
    }

    /// Converts to a `chrono::NaiveDateTime`
    pub fn to_naive_datetime(&self) -> Option<NaiveDateTime> {
        let date = NaiveDate::from_ymd_opt(self.year, self.month, self.day)?;
        let time = NaiveTime::from_hms_milli_opt(
            self.hour,
            self.minute,
            self.second,
            self.millisecond,
        )?;
        Some(NaiveDateTime::new(date, time))
    }

    /// Constructs from a `chrono::NaiveDateTime`
    pub fn from_naive_datetime(dt: NaiveDateTime) -> Self {
        Self {
            year: dt.year(),
            month: dt.month(),
            day: dt.day(),
            hour: dt.hour(),
            minute: dt.minute(),
            second: dt.second(),
            millisecond: dt.and_utc().timestamp_subsec_millis(),
        }
    }

    /// Converts to UTC Unix epoch timestamp in milliseconds
    pub fn to_epoch_millis(&self) -> i64 {
        if let Some(ndt) = self.to_naive_datetime() {
            ndt.and_utc().timestamp_millis()
        } else {
            0
        }
    }

    /// Constructs from UTC Unix epoch timestamp in milliseconds
    pub fn from_epoch_millis(millis: i64) -> Option<Self> {
        let dt = DateTime::from_timestamp_millis(millis)?;
        Some(Self::from_naive_datetime(dt.naive_utc()))
    }

    /// Difference in milliseconds: `self - other`
    pub fn diff_millis(&self, other: &Self) -> i64 {
        self.to_epoch_millis() - other.to_epoch_millis()
    }

    /// Formats as standard `YYYY-MM-DD HH:MM:SS`
    pub fn format_standard(&self) -> String {
        format!(
            "{:04}-{:02}-{:02} {:02}:{:02}:{:02}",
            self.year, self.month, self.day, self.hour, self.minute, self.second
        )
    }

    /// Formats as compact string `YYYYMMDD_HHMMSS`
    pub fn format_compact(&self) -> String {
        format!(
            "{:04}{:02}{:02}_{:02}{:02}{:02}",
            self.year, self.month, self.day, self.hour, self.minute, self.second
        )
    }

    /// Formats as ISO 8601 string `YYYY-MM-DDTHH:MM:SS.sssZ`
    pub fn format_iso(&self) -> String {
        format!(
            "{:04}-{:02}-{:02}T{:02}:{:02}:{:02}.{:03}Z",
            self.year, self.month, self.day, self.hour, self.minute, self.second, self.millisecond
        )
    }
}

impl fmt::Display for ParsedTimestamp {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        if self.millisecond > 0 {
            write!(
                f,
                "{:04}-{:02}-{:02} {:02}:{:02}:{:02}.{:03}",
                self.year, self.month, self.day, self.hour, self.minute, self.second, self.millisecond
            )
        } else {
            write!(
                f,
                "{:04}-{:02}-{:02} {:02}:{:02}:{:02}",
                self.year, self.month, self.day, self.hour, self.minute, self.second
            )
        }
    }
}

/// Preset patterns for popular camera and audio recording hardware
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TimestampPreset {
    /// Android / Standard cameras: `VID_YYYYMMDD_HHMMSS` (e.g. `VID_20261002_062623_10_071.mp4`)
    VidStandard,
    /// DJI Drones & Action cameras: `DJI_YYYYMMDD_HHMMSS` (e.g. `DJI_20261002_062700.MP4`)
    Dji,
    /// Audio field recorders: `AUDIO_YYYYMMDD_HHMMSS` (e.g. `AUDIO_20261002_062615.wav`)
    Audio,
    /// Dashcams / Action cams: `REC_YYYYMMDD_HHMMSS` or `MOVIE_YYYYMMDD_HHMMSS`
    Dashcam,
    /// ISO-8601 formatted: `YYYY-MM-DD_HH-MM-SS` or `YYYY-MM-DD HH.MM.SS`
    IsoLike,
    /// Compact timestamp: `YYYYMMDD_HHMMSS` or `YYYYMMDD-HHMMSS`
    Compact,
    /// Automatic fallback cascade trying standard presets in sequence
    AutoDetect,
}

impl TimestampPreset {
    /// Returns the regex pattern string associated with this preset
    pub fn pattern(&self) -> &'static str {
        match self {
            TimestampPreset::VidStandard => {
                r"VID_(?P<year>\d{4})(?P<month>\d{2})(?P<day>\d{2})_(?P<hour>\d{2})(?P<minute>\d{2})(?P<second>\d{2})"
            }
            TimestampPreset::Dji => {
                r"DJI_(?P<year>\d{4})(?P<month>\d{2})(?P<day>\d{2})_(?P<hour>\d{2})(?P<minute>\d{2})(?P<second>\d{2})"
            }
            TimestampPreset::Audio => {
                r"AUDIO_(?P<year>\d{4})(?P<month>\d{2})(?P<day>\d{2})_(?P<hour>\d{2})(?P<minute>\d{2})(?P<second>\d{2})"
            }
            TimestampPreset::Dashcam => {
                r"(?:REC|MOVIE)_(?P<year>\d{4})(?P<month>\d{2})(?P<day>\d{2})_(?P<hour>\d{2})(?P<minute>\d{2})(?P<second>\d{2})"
            }
            TimestampPreset::IsoLike => {
                r"(?P<year>\d{4})-(?P<month>\d{2})-(?P<day>\d{2})[T_\s](?P<hour>\d{2})[-.:](?P<minute>\d{2})[-.:](?P<second>\d{2})(?:[._](?P<millisecond>\d{1,3}))?"
            }
            TimestampPreset::Compact => {
                r"(?P<year>20\d{2})(?P<month>\d{2})(?P<day>\d{2})[-_](?P<hour>\d{2})(?P<minute>\d{2})(?P<second>\d{2})"
            }
            TimestampPreset::AutoDetect => "",
        }
    }
}

/// Configurable parser for extracting timestamps from filenames
#[derive(Debug, Clone)]
pub struct FilenameTimestampParser {
    raw_pattern: String,
    regex: Option<Regex>,
    is_auto_detect: bool,
}

impl FilenameTimestampParser {
    /// Compiles a parser from a built-in `TimestampPreset`
    pub fn from_preset(preset: TimestampPreset) -> Result<Self, SyncError> {
        if preset == TimestampPreset::AutoDetect {
            return Ok(Self {
                raw_pattern: "auto_detect".to_string(),
                regex: None,
                is_auto_detect: true,
            });
        }

        let pat = preset.pattern();
        let regex = Regex::new(pat).map_err(|e| SyncError::RegexCompilationFailed {
            pattern: pat.to_string(),
            reason: e.to_string(),
        })?;

        Ok(Self {
            raw_pattern: pat.to_string(),
            regex: Some(regex),
            is_auto_detect: false,
        })
    }

    /// Creates a parser from a user-friendly template string
    ///
    /// Supported tokens:
    /// - `{YYYY}`: 4-digit year `(?P<year>\d{4})`
    /// - `{YY}`: 2-digit year `(?P<short_year>\d{2})`
    /// - `{MM}`: 2-digit month `(?P<month>\d{2})`
    /// - `{DD}`: 2-digit day `(?P<day>\d{2})`
    /// - `{HH}`: 2-digit hour `(?P<hour>\d{2})`
    /// - `{mm}`: 2-digit minute `(?P<minute>\d{2})`
    /// - `{ss}`: 2-digit second `(?P<second>\d{2})`
    /// - `{SSS}` or `{millis}`: 1-3 digit millisecond `(?P<millisecond>\d{1,3})`
    ///
    /// Example: `FilenameTimestampParser::from_template("VID_{YYYY}{MM}{DD}_{HH}{mm}{ss}")`
    pub fn from_template(template: &str) -> Result<Self, SyncError> {
        let regex_str = template_to_regex(template);
        let regex = Regex::new(&regex_str).map_err(|e| SyncError::RegexCompilationFailed {
            pattern: regex_str.clone(),
            reason: e.to_string(),
        })?;

        Ok(Self {
            raw_pattern: template.to_string(),
            regex: Some(regex),
            is_auto_detect: false,
        })
    }

    /// Compiles a custom regular expression string
    /// Supports named groups: `year`, `month`, `day`, `hour`, `minute` (or `min`), `second` (or `sec`), `millisecond` (or `millis`)
    /// Also supports positional capture groups (year=1, month=2, day=3, hour=4, minute=5, second=6, millisecond=7)
    pub fn from_regex(pattern: &str) -> Result<Self, SyncError> {
        let regex = Regex::new(pattern).map_err(|e| SyncError::RegexCompilationFailed {
            pattern: pattern.to_string(),
            reason: e.to_string(),
        })?;

        Ok(Self {
            raw_pattern: pattern.to_string(),
            regex: Some(regex),
            is_auto_detect: false,
        })
    }

    /// Parses a filename and extracts the `ParsedTimestamp`
    pub fn parse(&self, filename: &str) -> Result<ParsedTimestamp, SyncError> {
        let clean_name = extract_filename(filename);

        if self.is_auto_detect {
            return Self::auto_detect(clean_name);
        }

        if let Some(re) = &self.regex {
            parse_with_regex(re, clean_name, &self.raw_pattern)
        } else {
            Err(SyncError::RegexCompilationFailed {
                pattern: self.raw_pattern.clone(),
                reason: "Uninitialized regular expression".to_string(),
            })
        }
    }

    /// Parses a path (handling Windows backslashes and Unix slashes properly)
    pub fn parse_path<P: AsRef<Path>>(&self, path: P) -> Result<ParsedTimestamp, SyncError> {
        let p = path.as_ref();
        let filename = p
            .file_name()
            .and_then(|f| f.to_str())
            .ok_or_else(|| SyncError::InvalidPath(p.to_string_lossy().to_string()))?;
        self.parse(filename)
    }

    /// Automatically scans and tests standard presets until a match is found
    pub fn auto_detect(filename: &str) -> Result<ParsedTimestamp, SyncError> {
        let clean_name = extract_filename(filename);
        let presets = [
            TimestampPreset::VidStandard,
            TimestampPreset::Dji,
            TimestampPreset::Audio,
            TimestampPreset::Dashcam,
            TimestampPreset::IsoLike,
            TimestampPreset::Compact,
        ];

        for preset in presets {
            if let Ok(parser) = Self::from_preset(preset) {
                if let Ok(ts) = parser.parse(clean_name) {
                    return Ok(ts);
                }
            }
        }

        Err(SyncError::NoTimestampFound(clean_name.to_string()))
    }
}

/// Converts a format template string with `{YYYY}`, `{MM}`, etc. into a regular expression
pub fn template_to_regex(template: &str) -> String {
    let mut result = String::new();
    let mut chars = template.chars().peekable();

    while let Some(c) = chars.next() {
        if c == '{' {
            let mut token = String::new();
            while let Some(&inner) = chars.peek() {
                chars.next();
                if inner == '}' {
                    break;
                }
                token.push(inner);
            }

            match token.as_str() {
                "YYYY" => result.push_str(r"(?P<year>\d{4})"),
                "YY" => result.push_str(r"(?P<short_year>\d{2})"),
                "MM" => result.push_str(r"(?P<month>\d{2})"),
                "DD" => result.push_str(r"(?P<day>\d{2})"),
                "HH" => result.push_str(r"(?P<hour>\d{2})"),
                "mm" => result.push_str(r"(?P<minute>\d{2})"),
                "ss" => result.push_str(r"(?P<second>\d{2})"),
                "SSS" | "millis" | "ms" | "fff" => {
                    result.push_str(r"(?P<millisecond>\d{1,3})")
                }
                other => {
                    // Unknown token: escape literally
                    result.push_str(&regex::escape(&format!("{{{}}}", other)));
                }
            }
        } else {
            result.push_str(&regex::escape(&c.to_string()));
        }
    }

    result
}

/// Extracts filename component safely across Windows backslash and Unix slash conventions
pub fn extract_filename(path: &str) -> &str {
    let trimmed = path.trim();
    if let Some(idx) = trimmed.rfind(|c| c == '/' || c == '\\') {
        &trimmed[idx + 1..]
    } else {
        trimmed
    }
}

/// Parses a filename against a compiled regex using either named or positional capture groups
fn parse_with_regex(regex: &Regex, filename: &str, pattern_repr: &str) -> Result<ParsedTimestamp, SyncError> {
    let captures = regex.captures(filename).ok_or_else(|| SyncError::FilenameParseFailed {
        pattern: pattern_repr.to_string(),
        filename: filename.to_string(),
    })?;

    // Check for named captures first
    let get_named = |name: &str| captures.name(name).and_then(|m| m.as_str().parse::<u32>().ok());

    let year = if let Some(y) = captures.name("year").and_then(|m| m.as_str().parse::<i32>().ok()) {
        Some(y)
    } else if let Some(sy) = captures.name("short_year").and_then(|m| m.as_str().parse::<i32>().ok()) {
        Some(2000 + sy)
    } else {
        None
    };

    let month = get_named("month").or_else(|| get_named("MM"));
    let day = get_named("day").or_else(|| get_named("DD"));
    let hour = get_named("hour").or_else(|| get_named("HH"));
    let minute = get_named("minute").or_else(|| get_named("min")).or_else(|| get_named("mm"));
    let second = get_named("second").or_else(|| get_named("sec")).or_else(|| get_named("ss"));
    let millisecond = get_named("millisecond")
        .or_else(|| get_named("millis"))
        .or_else(|| get_named("ms"))
        .or_else(|| get_named("SSS"))
        .unwrap_or(0);

    if let (Some(y), Some(m), Some(d), Some(h), Some(min), Some(s)) = (year, month, day, hour, minute, second) {
        return ParsedTimestamp::new(y, m, d, h, min, s, millisecond);
    }

    // Fall back to positional capture groups 1..=6 (and optional 7)
    if captures.len() >= 7 {
        let p_year = captures.get(1).and_then(|m| m.as_str().parse::<i32>().ok());
        let p_month = captures.get(2).and_then(|m| m.as_str().parse::<u32>().ok());
        let p_day = captures.get(3).and_then(|m| m.as_str().parse::<u32>().ok());
        let p_hour = captures.get(4).and_then(|m| m.as_str().parse::<u32>().ok());
        let p_min = captures.get(5).and_then(|m| m.as_str().parse::<u32>().ok());
        let p_sec = captures.get(6).and_then(|m| m.as_str().parse::<u32>().ok());
        let p_ms = captures
            .get(7)
            .and_then(|m| m.as_str().parse::<u32>().ok())
            .unwrap_or(0);

        if let (Some(y), Some(m), Some(d), Some(h), Some(min), Some(s)) =
            (p_year, p_month, p_day, p_hour, p_min, p_sec)
        {
            let y_adjusted = if y < 100 { 2000 + y } else { y };
            return ParsedTimestamp::new(y_adjusted, m, d, h, min, s, p_ms);
        }
    }

    Err(SyncError::MissingCaptureGroup(
        "Regex must supply named groups (year, month, day, hour, minute, second) or at least 6 positional groups"
            .to_string(),
    ))
}

/// Generic input representation for clip offset calculation
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClipTimestampInput<T = String> {
    pub id: T,
    pub timestamp: ParsedTimestamp,
}

impl<T> ClipTimestampInput<T> {
    pub fn new(id: T, timestamp: ParsedTimestamp) -> Self {
        Self { id, timestamp }
    }
}

/// Resulting offset of a clip relative to the earliest clip
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncedClipOffset<T = String> {
    pub id: T,
    pub timestamp: ParsedTimestamp,
    /// Timeline offset in milliseconds (0 ms for the earliest clip)
    pub offset_ms: u64,
    /// True if this clip is the reference anchor clip
    pub is_anchor: bool,
}

/// Complete result of relative timeline offset calculation
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TimelineSyncResult<T = String> {
    pub anchor_id: T,
    pub earliest_timestamp: ParsedTimestamp,
    pub clips: Vec<SyncedClipOffset<T>>,
}

/// Calculates relative timeline offsets for a collection of clips with parsed timestamps.
///
/// Behavior:
/// 1. Finds the earliest timestamp among all clips.
/// 2. Anchors the earliest clip at exactly 0 ms offset.
/// 3. Assigns positive delta offsets (in milliseconds) to all subsequent clips relative to the earliest clip.
pub fn calculate_relative_offsets<T: Clone + fmt::Debug>(
    inputs: &[ClipTimestampInput<T>],
) -> Result<TimelineSyncResult<T>, SyncError> {
    if inputs.is_empty() {
        return Err(SyncError::EmptyClips);
    }

    // Find the clip with the earliest timestamp
    let earliest_input = inputs
        .iter()
        .min_by_key(|clip| clip.timestamp.to_epoch_millis())
        .expect("inputs is non-empty");

    let earliest_epoch = earliest_input.timestamp.to_epoch_millis();
    let anchor_id = earliest_input.id.clone();
    let earliest_timestamp = earliest_input.timestamp;

    let mut synced_clips = Vec::with_capacity(inputs.len());

    for clip in inputs {
        let clip_epoch = clip.timestamp.to_epoch_millis();
        let delta_ms = clip_epoch - earliest_epoch;

        // Ensure offset is non-negative
        let offset_ms = if delta_ms < 0 { 0 } else { delta_ms as u64 };
        let is_anchor = clip.timestamp == earliest_timestamp;

        synced_clips.push(SyncedClipOffset {
            id: clip.id.clone(),
            timestamp: clip.timestamp,
            offset_ms,
            is_anchor,
        });
    }

    Ok(TimelineSyncResult {
        anchor_id,
        earliest_timestamp,
        clips: synced_clips,
    })
}

/// Synchronizes a list of filenames or paths, returning their relative millisecond offsets
pub fn sync_clips_by_filenames<T: AsRef<str> + Clone + fmt::Debug>(
    file_items: &[(T, &str)],
    parser: Option<&FilenameTimestampParser>,
) -> Result<TimelineSyncResult<T>, SyncError> {
    if file_items.is_empty() {
        return Err(SyncError::EmptyClips);
    }

    let default_parser = FilenameTimestampParser::from_preset(TimestampPreset::AutoDetect)?;
    let p = parser.unwrap_or(&default_parser);

    let mut inputs = Vec::with_capacity(file_items.len());
    for (id, filename) in file_items {
        let ts = p.parse(filename)?;
        inputs.push(ClipTimestampInput::new(id.clone(), ts));
    }

    calculate_relative_offsets(&inputs)
}

/// Synchronizes media tracks using filename timestamps, conforming to the IPC `SyncResult` model
pub fn sync_tracks_by_filename(
    tracks: &[MediaTrack],
    pattern: Option<&str>,
) -> Result<SyncResult, SyncError> {
    if tracks.is_empty() {
        return Ok(SyncResult {
            success: false,
            message: "No tracks provided to synchronize".to_string(),
            track_offsets: std::collections::HashMap::new(),
            updated_project: None,
            candidates: Some(Vec::new()),
            reference_timestamp: None,
        });
    }

    let parser = if let Some(pat) = pattern {
        if pat.contains('{') && pat.contains('}') {
            FilenameTimestampParser::from_template(pat)?
        } else {
            FilenameTimestampParser::from_regex(pat)?
        }
    } else {
        FilenameTimestampParser::from_preset(TimestampPreset::AutoDetect)?
    };

    // Extract the primary clip filename for each track
    struct TrackClipMeta {
        track_id: String,
        track_name: String,
        clip_id: String,
        clip_name: String,
        file_path: String,
        timestamp: ParsedTimestamp,
    }

    let mut track_metas = Vec::new();
    let mut missing_tracks = Vec::new();

    for track in tracks {
        if let Some(clip) = track.clips.first() {
            match parser.parse_path(&clip.file_path) {
                Ok(ts) => {
                    track_metas.push(TrackClipMeta {
                        track_id: track.id.clone(),
                        track_name: track.name.clone(),
                        clip_id: clip.id.clone(),
                        clip_name: clip.name.clone(),
                        file_path: clip.file_path.clone(),
                        timestamp: ts,
                    });
                }
                Err(_) => {
                    missing_tracks.push(track.name.clone());
                }
            }
        }
    }

    if track_metas.is_empty() {
        return Ok(SyncResult {
            success: false,
            message: "Could not parse timestamp from any track clips".to_string(),
            track_offsets: std::collections::HashMap::new(),
            updated_project: None,
            candidates: Some(Vec::new()),
            reference_timestamp: None,
        });
    }

    // Earliest timestamp is the anchor
    let earliest = track_metas
        .iter()
        .min_by_key(|m| m.timestamp.to_epoch_millis())
        .expect("track_metas non-empty");

    let earliest_epoch = earliest.timestamp.to_epoch_millis();
    let reference_timestamp_str = earliest.timestamp.format_standard();

    let mut track_offsets = std::collections::HashMap::new();
    let mut candidates = Vec::new();

    for meta in &track_metas {
        let delta_ms = (meta.timestamp.to_epoch_millis() - earliest_epoch).max(0);
        let delta_sec = delta_ms as f64 / 1000.0;
        let is_ref = meta.timestamp == earliest.timestamp;

        track_offsets.insert(meta.track_id.clone(), delta_ms);

        candidates.push(SyncCandidate {
            track_id: meta.track_id.clone(),
            track_name: meta.track_name.clone(),
            clip_id: meta.clip_id.clone(),
            clip_name: meta.clip_name.clone(),
            file_path: meta.file_path.clone(),
            parsed_timestamp: Some(meta.timestamp.format_standard()),
            calculated_offset_seconds: delta_sec,
            calculated_offset_ms: Some(delta_ms),
            confidence: 1.0,
            is_reference: is_ref,
        });
    }

    let msg = format!(
        "Successfully synchronized {} tracks (earliest anchored at {} at 0 ms)",
        candidates.len(),
        reference_timestamp_str
    );

    Ok(SyncResult {
        success: true,
        message: msg,
        track_offsets,
        updated_project: None,
        candidates: Some(candidates),
        reference_timestamp: Some(reference_timestamp_str),
    })
}

/// Calculates relative timeline offsets for each active track based on clip timestamps.
///
/// Anchors the overall earliest clip timestamp at 0 ms (00:00:00.000) and computes
/// relative positive millisecond and second offsets for all tracks.
pub fn sync_active_timeline_tracks(
    request: &SyncRequest,
) -> Result<Vec<TrackSyncOffset>, SyncError> {
    if request.tracks.is_empty() {
        return Err(SyncError::EmptyClips);
    }

    let parser = if let Some(pat) = &request.pattern {
        if pat.contains('{') && pat.contains('}') {
            FilenameTimestampParser::from_template(pat)?
        } else {
            FilenameTimestampParser::from_regex(pat)?
        }
    } else {
        FilenameTimestampParser::from_preset(TimestampPreset::AutoDetect)?
    };

    #[allow(dead_code)]
    struct ClipAnalysis {
        clip_id: String,
        #[allow(dead_code)]
        track_id: String,
        timestamp: ParsedTimestamp,
        epoch_ms: i64,
        duration_ms: i64,
    }

    let mut clip_analyses = Vec::new();

    for track in &request.tracks {
        for clip in &track.clips {
            let parsed_opt = parser
                .parse_path(&clip.file_path)
                .or_else(|_| parser.parse(&clip.name))
                .ok();

            if let Some(ts) = parsed_opt {
                let epoch = ts.to_epoch_millis();
                let dur = if clip.duration_ms > 0 {
                    clip.duration_ms
                } else if let Some(dur_sec) = clip.duration_seconds {
                    (dur_sec * 1000.0) as i64
                } else {
                    30_000
                };

                clip_analyses.push(ClipAnalysis {
                    clip_id: clip.id.clone(),
                    track_id: track.id.clone(),
                    timestamp: ts,
                    epoch_ms: epoch,
                    duration_ms: dur,
                });
            }
        }
    }

    if clip_analyses.is_empty() {
        return Err(SyncError::NoTimestampFound(
            "Could not parse filename timestamps from clips on any active track".to_string(),
        ));
    }

    // Sort chronologically by recording start timestamp
    clip_analyses.sort_by_key(|c| c.epoch_ms);

    let earliest_epoch = clip_analyses[0].epoch_ms;
    let placement = request.placement_mode.unwrap_or(SyncPlacementMode::Compact);
    let cushion_sec = request.max_gap_seconds.unwrap_or(0.0).max(0.0);
    let cushion_ms = (cushion_sec * 1000.0) as i64;

    let mut clip_calculated_starts: std::collections::HashMap<String, i64> =
        std::collections::HashMap::new();

    match placement {
        SyncPlacementMode::Absolute => {
            for clip in &clip_analyses {
                let delta = (clip.epoch_ms - earliest_epoch).max(0);
                clip_calculated_starts.insert(clip.clip_id.clone(), delta);
            }
        }
        SyncPlacementMode::Compact | SyncPlacementMode::CustomGap => {
            let gap_threshold_ms = if placement == SyncPlacementMode::CustomGap {
                (cushion_sec * 1000.0).max(1000.0) as i64
            } else {
                10_000 // 10s idle recording threshold
            };

            let mut current_cluster_start = clip_analyses[0].epoch_ms;
            let mut current_cluster_end = clip_analyses[0].epoch_ms + clip_analyses[0].duration_ms;
            let mut cluster_timeline_start_ms = 0i64;

            for (idx, clip) in clip_analyses.iter().enumerate() {
                if idx == 0 {
                    clip_calculated_starts.insert(clip.clip_id.clone(), 0);
                    continue;
                }

                let idle_gap_ms = clip.epoch_ms - current_cluster_end;

                if idle_gap_ms > gap_threshold_ms {
                    let prev_cluster_duration = current_cluster_end - current_cluster_start;
                    cluster_timeline_start_ms += prev_cluster_duration + cushion_ms;

                    current_cluster_start = clip.epoch_ms;
                    current_cluster_end = clip.epoch_ms + clip.duration_ms;

                    clip_calculated_starts.insert(clip.clip_id.clone(), cluster_timeline_start_ms);
                } else {
                    current_cluster_end = current_cluster_end.max(clip.epoch_ms + clip.duration_ms);
                    let intra_offset_ms = clip.epoch_ms - current_cluster_start;
                    let timeline_pos = cluster_timeline_start_ms + intra_offset_ms;
                    clip_calculated_starts.insert(clip.clip_id.clone(), timeline_pos);
                }
            }
        }
    }

    let mut results = Vec::new();

    for track in &request.tracks {
        let mut track_clip_offsets = Vec::new();
        let mut earliest_ts: Option<ParsedTimestamp> = None;

        for clip in &track.clips {
            if let Some(&start_ms) = clip_calculated_starts.get(&clip.id) {
                let ts = clip_analyses
                    .iter()
                    .find(|c| c.clip_id == clip.id)
                    .map(|c| c.timestamp.clone());

                if let Some(t) = &ts {
                    if earliest_ts
                        .as_ref()
                        .map_or(true, |cur| t.to_epoch_millis() < cur.to_epoch_millis())
                    {
                        earliest_ts = Some(t.clone());
                    }
                }

                track_clip_offsets.push(ClipSyncOffset {
                    clip_id: clip.id.clone(),
                    track_id: track.id.clone(),
                    offset_ms: start_ms,
                    offset_seconds: start_ms as f64 / 1000.0,
                    timestamp: ts.map(|t| t.format_standard()),
                });
            }
        }

        let min_start_ms = track_clip_offsets
            .iter()
            .map(|c| c.offset_ms)
            .min()
            .unwrap_or(0);

        results.push(TrackSyncOffset {
            track_id: track.id.clone(),
            track_name: track.name.clone(),
            offset_ms: min_start_ms,
            offset_seconds: min_start_ms as f64 / 1000.0,
            earliest_clip_timestamp: earliest_ts.map(|t| t.format_standard()),
            clip_offsets: Some(track_clip_offsets),
        });
    }

    Ok(results)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::ipc::Clip;

    #[test]
    fn test_parse_vid_standard_filename() {
        let parser = FilenameTimestampParser::from_preset(TimestampPreset::VidStandard)
            .expect("compile preset");
        let filename = "VID_20261002_062623_10_071.mp4";
        let ts = parser.parse(filename).expect("parse timestamp");

        assert_eq!(ts.year, 2026);
        assert_eq!(ts.month, 10);
        assert_eq!(ts.day, 2);
        assert_eq!(ts.hour, 6);
        assert_eq!(ts.minute, 26);
        assert_eq!(ts.second, 23);
        assert_eq!(ts.millisecond, 0);
        assert_eq!(ts.format_standard(), "2026-10-02 06:26:23");
        assert_eq!(ts.format_compact(), "20261002_062623");
    }

    #[test]
    fn test_parse_dji_filename() {
        let parser = FilenameTimestampParser::from_preset(TimestampPreset::Dji)
            .expect("compile DJI preset");
        let filename = "DJI_20261002_062700.MP4";
        let ts = parser.parse(filename).expect("parse timestamp");

        assert_eq!(ts.year, 2026);
        assert_eq!(ts.month, 10);
        assert_eq!(ts.day, 2);
        assert_eq!(ts.hour, 6);
        assert_eq!(ts.minute, 27);
        assert_eq!(ts.second, 0);
        assert_eq!(ts.format_standard(), "2026-10-02 06:27:00");
    }

    #[test]
    fn test_parse_audio_filename() {
        let parser = FilenameTimestampParser::from_preset(TimestampPreset::Audio)
            .expect("compile Audio preset");
        let filename = "AUDIO_20261002_062615.wav";
        let ts = parser.parse(filename).expect("parse timestamp");

        assert_eq!(ts.year, 2026);
        assert_eq!(ts.month, 10);
        assert_eq!(ts.day, 2);
        assert_eq!(ts.hour, 6);
        assert_eq!(ts.minute, 26);
        assert_eq!(ts.second, 15);
        assert_eq!(ts.format_standard(), "2026-10-02 06:26:15");
    }

    #[test]
    fn test_parse_windows_path_with_backslashes() {
        let parser = FilenameTimestampParser::from_preset(TimestampPreset::VidStandard)
            .expect("compile preset");
        let path = r"D:\Recordings\MultiCam\VID_20261002_062623_10_071.mp4";
        let ts = parser.parse_path(path).expect("parse path");

        assert_eq!(ts.year, 2026);
        assert_eq!(ts.month, 10);
        assert_eq!(ts.day, 2);
        assert_eq!(ts.hour, 6);
        assert_eq!(ts.minute, 26);
        assert_eq!(ts.second, 23);
    }

    #[test]
    fn test_template_parser_custom_pattern() {
        let parser = FilenameTimestampParser::from_template("VID_{YYYY}{MM}{DD}_{HH}{mm}{ss}")
            .expect("compile template");
        let ts = parser
            .parse("VID_20261002_062623_10_071.mp4")
            .expect("parse template");

        assert_eq!(ts.format_standard(), "2026-10-02 06:26:23");
    }

    #[test]
    fn test_template_parser_with_milliseconds() {
        let parser = FilenameTimestampParser::from_template("CAM_{YYYY}{MM}{DD}_{HH}{mm}{ss}_{SSS}")
            .expect("compile template");
        let ts = parser
            .parse("CAM_20261002_062623_500.mov")
            .expect("parse template with ms");

        assert_eq!(ts.millisecond, 500);
        assert_eq!(ts.format_standard(), "2026-10-02 06:26:23");
        assert_eq!(ts.to_string(), "2026-10-02 06:26:23.500");
    }

    #[test]
    fn test_custom_regex_with_positional_groups() {
        let parser = FilenameTimestampParser::from_regex(
            r"SONY_(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})\.mxf",
        )
        .expect("compile positional regex");

        let ts = parser
            .parse("SONY_20261002_062640.mxf")
            .expect("parse positional");
        assert_eq!(ts.format_standard(), "2026-10-02 06:26:40");
    }

    #[test]
    fn test_auto_detect_cascade() {
        let clips = [
            ("VID_20261002_062623_10_071.mp4", "2026-10-02 06:26:23"),
            ("DJI_20261002_062700.MP4", "2026-10-02 06:27:00"),
            ("AUDIO_20261002_062615.wav", "2026-10-02 06:26:15"),
            ("REC_20261002_062610.MOV", "2026-10-02 06:26:10"),
            ("2026-10-02_06-26-05.mp4", "2026-10-02 06:26:05"),
        ];

        for (filename, expected) in clips {
            let ts = FilenameTimestampParser::auto_detect(filename)
                .unwrap_or_else(|e| panic!("failed to auto-detect {}: {}", filename, e));
            assert_eq!(ts.format_standard(), expected);
        }
    }

    #[test]
    fn test_relative_timeline_offset_calculation() {
        // Earliest: AUDIO_20261002_062615.wav (06:26:15)
        // Middle:   VID_20261002_062623_10_071.mp4 (06:26:23) -> +8,000 ms
        // Latest:   DJI_20261002_062700.MP4 (06:27:00) -> +45,000 ms

        let ts_audio = ParsedTimestamp::new(2026, 10, 2, 6, 26, 15, 0).unwrap();
        let ts_vid = ParsedTimestamp::new(2026, 10, 2, 6, 26, 23, 0).unwrap();
        let ts_dji = ParsedTimestamp::new(2026, 10, 2, 6, 27, 0, 0).unwrap();

        let inputs = vec![
            ClipTimestampInput::new("track-vid".to_string(), ts_vid),
            ClipTimestampInput::new("track-dji".to_string(), ts_dji),
            ClipTimestampInput::new("track-audio".to_string(), ts_audio),
        ];

        let result = calculate_relative_offsets(&inputs).expect("calculate offsets");

        // Anchor is the earliest clip
        assert_eq!(result.anchor_id, "track-audio");
        assert_eq!(result.earliest_timestamp, ts_audio);

        // Find each clip's calculated offset
        let get_offset = |id: &str| {
            result
                .clips
                .iter()
                .find(|c| c.id == id)
                .map(|c| (c.offset_ms, c.is_anchor))
                .unwrap()
        };

        // Audio clip: 0 ms offset (anchored at 0 ms)
        let (audio_offset, audio_anchor) = get_offset("track-audio");
        assert_eq!(audio_offset, 0);
        assert!(audio_anchor);

        // Video clip: 8,000 ms offset (+8 seconds)
        let (vid_offset, vid_anchor) = get_offset("track-vid");
        assert_eq!(vid_offset, 8_000);
        assert!(!vid_anchor);

        // DJI clip: 45,000 ms offset (+45 seconds)
        let (dji_offset, dji_anchor) = get_offset("track-dji");
        assert_eq!(dji_offset, 45_000);
        assert!(!dji_anchor);
    }

    #[test]
    fn test_sync_clips_by_filenames_integration() {
        let files = [
            ("clip-1", "VID_20261002_062623_10_071.mp4"),
            ("clip-2", "DJI_20261002_062700.MP4"),
            ("clip-3", "AUDIO_20261002_062615.wav"),
        ];

        let result = sync_clips_by_filenames(&files, None).expect("sync filenames");

        assert_eq!(result.anchor_id, "clip-3");
        let offsets: std::collections::HashMap<_, _> = result
            .clips
            .into_iter()
            .map(|c| (c.id, c.offset_ms))
            .collect();

        assert_eq!(*offsets.get("clip-3").unwrap(), 0);
        assert_eq!(*offsets.get("clip-1").unwrap(), 8000);
        assert_eq!(*offsets.get("clip-2").unwrap(), 45000);
    }

    #[test]
    fn test_identical_timestamps_both_anchor_at_zero() {
        let ts = ParsedTimestamp::new(2026, 10, 2, 6, 26, 15, 0).unwrap();
        let inputs = vec![
            ClipTimestampInput::new("clip-a", ts),
            ClipTimestampInput::new("clip-b", ts),
        ];

        let result = calculate_relative_offsets(&inputs).expect("calculate");
        assert_eq!(result.clips[0].offset_ms, 0);
        assert_eq!(result.clips[1].offset_ms, 0);
        assert!(result.clips[0].is_anchor);
        assert!(result.clips[1].is_anchor);
    }

    #[test]
    fn test_empty_clips_returns_error() {
        let empty: Vec<ClipTimestampInput<String>> = Vec::new();
        let err = calculate_relative_offsets(&empty).unwrap_err();
        assert_eq!(err, SyncError::EmptyClips);
    }

    #[test]
    fn test_invalid_filename_error() {
        let parser = FilenameTimestampParser::from_preset(TimestampPreset::VidStandard).unwrap();
        let err = parser.parse("non_matching_filename.mp4").unwrap_err();
        match err {
            SyncError::FilenameParseFailed { .. } => (),
            other => panic!("expected FilenameParseFailed, got {:?}", other),
        }
    }

    #[test]
    fn test_sync_tracks_by_filename_ipc_contract() {
        let mut track_v = MediaTrack::new("track-1", "Video Camera", crate::models::ipc::TrackType::Video);
        track_v.clips.push(Clip::new("clip-v", "track-1", "D:\\VID_20261002_062623_10_071.mp4", 0, 60000));

        let mut track_a = MediaTrack::new("track-2", "Audio Recorder", crate::models::ipc::TrackType::Audio);
        track_a.clips.push(Clip::new("clip-a", "track-2", "D:\\AUDIO_20261002_062615.wav", 0, 60000));

        let result = sync_tracks_by_filename(&[track_v, track_a], None).expect("sync tracks");

        assert!(result.success);
        assert_eq!(result.track_offsets.get("track-2"), Some(&0)); // Earliest anchored at 0 ms
        assert_eq!(result.track_offsets.get("track-1"), Some(&8000)); // +8,000 ms
        assert_eq!(result.reference_timestamp.as_deref(), Some("2026-10-02 06:26:15"));
    }
}
