//! FFmpeg engine module for Tauri video editor.
//!
//! Provides dynamic filtergraph generation, sidecar process execution,
//! hardware-accelerated video encoder selection, and command builders.

pub mod audio;
pub mod ffmpeg;
pub mod filtergraph;
pub mod metadata;
pub mod proxy;
pub mod silence;

pub use audio::*;
pub use ffmpeg::*;
pub use filtergraph::*;
pub use metadata::*;
pub use proxy::*;
pub use silence::*;
