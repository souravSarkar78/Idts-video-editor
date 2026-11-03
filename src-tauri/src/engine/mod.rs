//! FFmpeg engine module for Tauri video editor.
//!
//! Provides dynamic filtergraph generation, sidecar process execution,
//! hardware-accelerated video encoder selection, and command builders.

pub mod audio;
pub mod audio_capture;
pub mod audio_denoise;
pub mod ffmpeg;
pub mod filtergraph;
pub mod metadata;
pub mod proxy;
pub mod silence;
pub mod stabilize;
pub mod thumbnail;
pub mod transcribe;
pub mod process_manager;
pub mod recovery;
pub mod probe;
pub mod ingest_queue;
pub mod waveform;

pub use audio::*;
pub use audio_capture::*;
pub use audio_denoise::*;
pub use ffmpeg::*;
pub use filtergraph::*;
pub use metadata::*;
pub use proxy::*;
pub use silence::*;
pub use stabilize::*;
pub use thumbnail::*;
pub use transcribe::*;
pub use process_manager::*;
pub use recovery::*;
pub use probe::*;
pub use ingest_queue::*;
pub use waveform::*;
