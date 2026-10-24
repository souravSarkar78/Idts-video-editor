// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

// Instruct Windows graphics drivers (NVIDIA Optimus & AMD PowerXpress)
// to automatically run this application on the discrete high-performance GPU.
#[no_mangle]
#[used]
pub static NvOptimusEnablement: u32 = 1;

#[no_mangle]
#[used]
pub static AmdPowerXpressRequestHighPerformance: i32 = 1;

fn main() {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;

        // 1. Configure Windows DirectX graphics preferences (UserGpuPreferences) for High Performance (dGPU)
        if let Ok(exe_path) = std::env::current_exe() {
            let exe_str = exe_path.to_string_lossy().to_string();
            let _ = std::process::Command::new("reg")
                .args([
                    "add",
                    r"HKCU\Software\Microsoft\DirectX\UserGpuPreferences",
                    "/v",
                    &exe_str,
                    "/t",
                    "REG_SZ",
                    "/d",
                    "GpuPreference=2;",
                    "/f",
                ])
                .creation_flags(0x08000000) // CREATE_NO_WINDOW
                .output();
        }

        // 2. Chromium / Edge WebView2 flags for GPU acceleration and hardware video decoding
        let gpu_args = [
            "--gpu-preference=2",
            "--force-high-performance-gpu",
            "--enable-gpu-rasterization",
            "--enable-zero-copy",
            "--ignore-gpu-blocklist",
            "--enable-hardware-overlays",
        ].join(" ");

        // Microsoft Edge WebView2 reads WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS
        for var_name in [
            "WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS",
            "WEBVIEW2_ADDITIONAL_BROWSER_ARGS",
        ] {
            let current = std::env::var(var_name).unwrap_or_default();
            if !current.contains("--gpu-preference=2") {
                let combined = if current.is_empty() {
                    gpu_args.clone()
                } else {
                    format!("{} {}", current, gpu_args)
                };
                std::env::set_var(var_name, combined);
            }
        }
    }

    video_editor_lib::run();
}
