# Antigravity Workspace Directives: Desktop Video Editor

## Project Overview
A high-performance desktop video editor built with Tauri 2.0 (Rust backend), React/TypeScript (frontend), and an FFmpeg hardware sidecar.

## Subagent Architecture & Roles
When running in multi-agent mode, assign work using isolated subagent domains:

1. **core_architect**
   - Owns: `src-tauri/src/main.rs`, `src-tauri/src/models/`, `src-tauri/Cargo.toml`
   - Role: Defines shared structs, IPC serialization, and project state trees.

2. **ffmpeg_engineer**
   - Owns: `src-tauri/src/engine/`
   - Role: Spawns FFmpeg/ffprobe sidecars, builds hardware-accelerated filtergraphs (NVENC/QSV), and handles 3D LUTs and audio denoising.

3. **sync_algorithm_specialist**
   - Owns: `src-tauri/src/sync/`
   - Role: Regex timestamp parsing for camera filenames (`VID_YYYYMMDD_HHMMSS`) and FFT audio cross-correlation for timeline offset calculation.

4. **ui_frontend_engineer**
   - Owns: `src/`
   - Role: Multi-track timeline UI, clip drag/trim, track-snapping, sync dialog, and WebGL/WebGPU preview.

## Invariants & Rules
- Do NOT modify files owned by another domain without an explicit IPC schema update.
- Always implement the Rust struct in `src-tauri/src/models/ipc.rs` and mirror it in `src/types/ipc.ts` first.
- Always run `cargo check` after modifying Rust files to ensure zero compile warnings.