//! Models module for Antigravity Video Editor
//!
//! Exposes IPC contracts, timeline state structures, settings, and project serialization types.

pub mod filters;
pub mod ipc;
pub mod project;
pub mod settings;

pub use filters::*;
pub use ipc::*;
pub use project::*;
pub use settings::*;
