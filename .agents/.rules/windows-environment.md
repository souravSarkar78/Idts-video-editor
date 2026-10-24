---
trigger: always_on
description: Windows path handling and MSVC toolchain constraints
---

# Windows Development Rules

- **Path Delimiters:** Use `std::path::Path` or `PathBuf` with `.to_string_lossy()` in Rust to avoid Windows backslash escaping errors.
- **Sidecar Execution:** When invoking FFmpeg or FFprobe, use the Tauri v2 shell API:
  `app.shell().sidecar("ffmpeg")` (do not hardcode `.exe` or absolute system paths).
- **GPU Hardware Flags:** Default video encoder selection on Windows must prioritize:
  1. `h264_nvenc` (NVIDIA)
  2. `h264_qsv` (Intel)
  3. `h264_amf` (AMD)
  4. `libx264` (CPU fallback)
- **Terminal Execution:** When executing build or test commands, use PowerShell syntax and MSVC toolchain (`x86_64-pc-windows-msvc`).