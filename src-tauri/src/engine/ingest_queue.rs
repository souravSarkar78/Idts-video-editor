//! Centralized serialized background ingestion queue.
//!
//! Throttles parallel metadata probing and thumbnail extraction via a strict
//! 2-worker background thread pool to eliminate unbounded process spawning,
//! memory spikes, and async reactor runtime panics.

use std::collections::VecDeque;
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::{Arc, Mutex, OnceLock};
use tauri::{AppHandle, Emitter};

use crate::models::ipc::{ImportBatchResult, ImportProgressPayload, IngestStatus};
use crate::engine::probe::probe_clip_lightweight;
use crate::engine::thumbnail::extract_clip_thumbnail_file;

/// Represents an individual media file ingestion task in the FIFO queue
#[derive(Debug, Clone)]
pub struct IngestTask {
    pub media_id: String,
    pub file_path: String,
    pub index: usize,
    pub total: usize,
}

/// Centralized state for the media ingest queue
pub struct MediaIngestQueue {
    tasks: Mutex<VecDeque<IngestTask>>,
    is_cancelled: Arc<AtomicBool>,
    total_in_batch: Arc<AtomicUsize>,
    processed_count: Arc<AtomicUsize>,
    active_workers: Arc<AtomicUsize>,
}

impl MediaIngestQueue {
    pub fn new() -> Self {
        Self {
            tasks: Mutex::new(VecDeque::new()),
            is_cancelled: Arc::new(AtomicBool::new(false)),
            total_in_batch: Arc::new(AtomicUsize::new(0)),
            processed_count: Arc::new(AtomicUsize::new(0)),
            active_workers: Arc::new(AtomicUsize::new(0)),
        }
    }
}

static INGEST_QUEUE: OnceLock<Arc<MediaIngestQueue>> = OnceLock::new();

pub fn get_ingest_queue() -> &'static Arc<MediaIngestQueue> {
    INGEST_QUEUE.get_or_init(|| Arc::new(MediaIngestQueue::new()))
}

/// Enqueues a batch of media file paths for background serialized processing
pub fn enqueue_import_batch(app_handle: AppHandle, file_paths: Vec<String>) -> ImportBatchResult {
    let queue_mgr = get_ingest_queue();
    queue_mgr.is_cancelled.store(false, Ordering::SeqCst);

    let total = file_paths.len();
    queue_mgr.total_in_batch.store(total, Ordering::SeqCst);
    queue_mgr.processed_count.store(0, Ordering::SeqCst);

    let mut initial_items = Vec::with_capacity(total);
    let mut new_tasks = VecDeque::with_capacity(total);

    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();

    for (idx, path) in file_paths.into_iter().enumerate() {
        let media_id = format!("media-{}-{}", timestamp, idx);
        let task = IngestTask {
            media_id: media_id.clone(),
            file_path: path.clone(),
            index: idx + 1,
            total,
        };

        initial_items.push(ImportProgressPayload {
            media_id,
            file_path: path,
            total,
            current: idx + 1,
            status: IngestStatus::Pending,
            metadata: None,
            error: None,
        });

        new_tasks.push_back(task);
    }

    // Add tasks to queue
    {
        if let Ok(mut lock) = queue_mgr.tasks.lock() {
            lock.extend(new_tasks);
        }
    }

    // Emit initial Pending payloads to frontend
    for item in &initial_items {
        let _ = app_handle.emit("import-progress", item);
    }

    // Spawn up to 2 concurrent worker threads if not already running
    let max_workers = 2usize;
    let current_workers = queue_mgr.active_workers.load(Ordering::SeqCst);
    let needed_workers = max_workers.saturating_sub(current_workers).min(total.max(1));

    for i in 0..needed_workers {
        queue_mgr.active_workers.fetch_add(1, Ordering::SeqCst);
        let app_clone = app_handle.clone();
        let queue_clone = Arc::clone(queue_mgr);

        let _ = std::thread::Builder::new()
            .name(format!("ingest-worker-{}", current_workers + i + 1))
            .spawn(move || {
                run_worker_loop(app_clone, queue_clone);
            });
    }

    ImportBatchResult {
        total_queued: total,
        initial_items,
    }
}

/// RAII worker guard ensuring active_workers count is decremented on thread exit
struct WorkerGuard(Arc<AtomicUsize>);

impl Drop for WorkerGuard {
    fn drop(&mut self) {
        self.0.fetch_sub(1, Ordering::SeqCst);
    }
}

/// Background worker thread loop that consumes tasks sequentially
fn run_worker_loop(app_handle: AppHandle, queue_mgr: Arc<MediaIngestQueue>) {
    let _guard = WorkerGuard(Arc::clone(&queue_mgr.active_workers));

    loop {
        if queue_mgr.is_cancelled.load(Ordering::SeqCst) {
            // Drain remaining tasks and mark them cancelled
            let mut remaining = Vec::new();
            if let Ok(mut lock) = queue_mgr.tasks.lock() {
                while let Some(t) = lock.pop_front() {
                    remaining.push(t);
                }
            }
            for task in remaining {
                let payload = ImportProgressPayload {
                    media_id: task.media_id,
                    file_path: task.file_path,
                    total: task.total,
                    current: task.index,
                    status: IngestStatus::Cancelled,
                    metadata: None,
                    error: Some("Import cancelled by user".to_string()),
                };
                let _ = app_handle.emit("import-progress", &payload);
            }
            break;
        }

        // Pop next task atomically
        let task = match queue_mgr.tasks.lock().ok().and_then(|mut lock| lock.pop_front()) {
            Some(t) => t,
            None => break, // All tasks consumed, exit thread
        };

        process_single_task(&app_handle, &queue_mgr, task);
    }
}

/// Processes a single media file ingestion task
fn process_single_task(app: &AppHandle, queue_mgr: &Arc<MediaIngestQueue>, task: IngestTask) {
    if queue_mgr.is_cancelled.load(Ordering::SeqCst) {
        let payload = ImportProgressPayload {
            media_id: task.media_id,
            file_path: task.file_path,
            total: task.total,
            current: task.index,
            status: IngestStatus::Cancelled,
            metadata: None,
            error: Some("Import cancelled by user".to_string()),
        };
        let _ = app.emit("import-progress", &payload);
        return;
    }

    // State 1: Probing
    let probing_payload = ImportProgressPayload {
        media_id: task.media_id.clone(),
        file_path: task.file_path.clone(),
        total: task.total,
        current: task.index,
        status: IngestStatus::Probing,
        metadata: None,
        error: None,
    };
    let _ = app.emit("import-progress", &probing_payload);

    let mut metadata = match probe_clip_lightweight(&task.file_path) {
        Ok(m) => m,
        Err(e) => {
            let err_payload = ImportProgressPayload {
                media_id: task.media_id,
                file_path: task.file_path,
                total: task.total,
                current: task.index,
                status: IngestStatus::Failed,
                metadata: None,
                error: Some(e),
            };
            let _ = app.emit("import-progress", &err_payload);
            return;
        }
    };

    // Check if file is audio or video
    let path_lower = task.file_path.to_lowercase();
    let is_audio = path_lower.ends_with(".wav")
        || path_lower.ends_with(".mp3")
        || path_lower.ends_with(".aac")
        || path_lower.ends_with(".flac")
        || path_lower.ends_with(".m4a")
        || path_lower.ends_with(".ogg");

    // State 2: Generating Thumbnail (video only)
    if !is_audio {
        let thumb_payload = ImportProgressPayload {
            media_id: task.media_id.clone(),
            file_path: task.file_path.clone(),
            total: task.total,
            current: task.index,
            status: IngestStatus::GeneratingThumb,
            metadata: None,
            error: None,
        };
        let _ = app.emit("import-progress", &thumb_payload);

        if let Ok(thumb_path) = extract_clip_thumbnail_file(&task.file_path) {
            metadata.thumbnail_data_url = Some(thumb_path);
        }
    }

    // Telemetry probe (GoPro, Sony, DJI, Insta360)
    let telemetry = crate::engine::stabilize::probe_clip_telemetry(&task.file_path);
    metadata.has_gyro_data = Some(telemetry.has_gyro);
    metadata.gyro_format = telemetry.gyro_format;

    // State 3: Ready
    queue_mgr.processed_count.fetch_add(1, Ordering::SeqCst);
    let ready_payload = ImportProgressPayload {
        media_id: task.media_id,
        file_path: task.file_path,
        total: task.total,
        current: task.index,
        status: IngestStatus::Ready,
        metadata: Some(metadata),
        error: None,
    };
    let _ = app.emit("import-progress", &ready_payload);
}

/// Cancels all remaining queued import tasks
pub fn cancel_ingest_queue() {
    let queue_mgr = get_ingest_queue();
    queue_mgr.is_cancelled.store(true, Ordering::SeqCst);
}
