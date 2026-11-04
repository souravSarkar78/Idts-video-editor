//! Media and asset management IPC commands

use std::fs;
use std::path::PathBuf;

/// Cleans up associated background disk caches for deleted media assets and optionally
/// purges timeline clip instances from the in-memory cached project.
#[tauri::command]
pub fn delete_media_batch(
    media_ids: Vec<String>,
    remove_timeline_instances: bool,
) -> Result<(), String> {
    if media_ids.is_empty() {
        return Ok(());
    }

    let thumbs_dir = crate::engine::thumbnail::get_preview_cache_dir();
    let waveforms_dir = crate::engine::waveform::get_waveform_cache_dir();
    let proxies_dir = crate::engine::proxy::get_proxy_dir();
    let stabilization_dir = crate::engine::stabilize::get_stabilization_dir();

    for id in &media_ids {
        let clean_id = id.trim();
        if clean_id.is_empty() {
            continue;
        }

        // 1. Delete cached thumbnails (%LOCALAPPDATA%/idts-video-editor/cache/thumbs/{media_id}.jpg / .png)
        let thumb_jpg = thumbs_dir.join(format!("{}.jpg", clean_id));
        let thumb_png = thumbs_dir.join(format!("{}.png", clean_id));
        let _ = fs::remove_file(&thumb_jpg);
        let _ = fs::remove_file(&thumb_png);

        // 2. Delete cached waveform peaks (cache/waveforms/{media_id}.peaks)
        let waveform_file = waveforms_dir.join(format!("{}.peaks", clean_id));
        let _ = fs::remove_file(&waveform_file);

        // 3. Delete proxy files (proxies/{media_id}_proxy.mp4 / {media_id}.mp4)
        let proxy_file = proxies_dir.join(format!("{}_proxy.mp4", clean_id));
        let proxy_alt = proxies_dir.join(format!("{}.mp4", clean_id));
        let _ = fs::remove_file(&proxy_file);
        let _ = fs::remove_file(&proxy_alt);

        // 4. Delete stabilization motion vectors (stabilization/{media_id}.trf / .mat)
        let trf_file = stabilization_dir.join(format!("{}.trf", clean_id));
        let mat_file = stabilization_dir.join(format!("{}.mat", clean_id));
        let _ = fs::remove_file(&trf_file);
        let _ = fs::remove_file(&mat_file);

        // Clean any filename matching or containing media_id
        clean_matching_cache_files(&thumbs_dir, clean_id);
        clean_matching_cache_files(&waveforms_dir, clean_id);
        clean_matching_cache_files(&proxies_dir, clean_id);
        clean_matching_cache_files(&stabilization_dir, clean_id);
    }

    // 5. Purge from in-memory project snapshot if cascading deletion was confirmed
    if remove_timeline_instances {
        crate::engine::recovery::purge_media_from_cached_project(&media_ids);
    }

    Ok(())
}

/// Retrieves the complete expanded catalog of 50+ titles, 50+ visual filters, and 50+ transitions.
#[tauri::command]
pub fn get_available_effects() -> Result<crate::models::effects::EffectLibrary, String> {
    Ok(crate::models::effects::get_complete_effect_library())
}

fn clean_matching_cache_files(dir: &PathBuf, id: &str) {
    if !dir.exists() {
        return;
    }
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() {
                if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                    if name.contains(id) {
                        let _ = fs::remove_file(&path);
                    }
                }
            }
        }
    }
}
