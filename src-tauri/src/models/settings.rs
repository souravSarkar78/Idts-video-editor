use std::collections::HashMap;
use serde::{Deserialize, Serialize};

/// Application preferences including customizable keyboard shortcuts
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppPreferences {
    pub shortcuts: HashMap<String, String>,
    #[serde(default = "default_auto_save_interval")]
    pub auto_save_interval_sec: u32,
    #[serde(default = "default_theme")]
    pub theme: String,
    #[serde(default = "default_snapping")]
    pub snapping_enabled: bool,
    #[serde(default = "default_auto_generate_proxies")]
    pub auto_generate_proxies: bool,
    #[serde(default = "default_proxy_resolution")]
    pub proxy_resolution: String,
    #[serde(default = "default_proxy_codec")]
    pub proxy_codec: String,
}

fn default_auto_save_interval() -> u32 {
    60
}

fn default_theme() -> String {
    "studio_dark".to_string()
}

fn default_snapping() -> bool {
    true
}

fn default_auto_generate_proxies() -> bool {
    false
}

fn default_proxy_resolution() -> String {
    "720p".to_string()
}

fn default_proxy_codec() -> String {
    "h264_nvenc".to_string()
}

impl Default for AppPreferences {
    fn default() -> Self {
        let mut shortcuts = HashMap::new();
        shortcuts.insert("play_pause".to_string(), "Space".to_string());
        shortcuts.insert("split_clip".to_string(), "c".to_string());
        shortcuts.insert("shuttle_reverse".to_string(), "j".to_string());
        shortcuts.insert("shuttle_pause".to_string(), "k".to_string());
        shortcuts.insert("shuttle_forward".to_string(), "l".to_string());
        shortcuts.insert("ripple_delete".to_string(), "Shift+Delete".to_string());
        shortcuts.insert("delete_clip".to_string(), "Delete".to_string());
        shortcuts.insert("toggle_snapping".to_string(), "s".to_string());
        shortcuts.insert("ripple_mode".to_string(), "b".to_string());
        shortcuts.insert("undo".to_string(), "Ctrl+z".to_string());
        shortcuts.insert("redo".to_string(), "Ctrl+y".to_string());
        shortcuts.insert("save_project".to_string(), "Ctrl+s".to_string());
        shortcuts.insert("multicam_angle_1".to_string(), "1".to_string());
        shortcuts.insert("multicam_angle_2".to_string(), "2".to_string());
        shortcuts.insert("multicam_angle_3".to_string(), "3".to_string());
        shortcuts.insert("multicam_angle_4".to_string(), "4".to_string());

        Self {
            shortcuts,
            auto_save_interval_sec: 60,
            theme: "studio_dark".to_string(),
            snapping_enabled: true,
            auto_generate_proxies: false,
            proxy_resolution: "720p".to_string(),
            proxy_codec: "h264_nvenc".to_string(),
        }
    }
}
