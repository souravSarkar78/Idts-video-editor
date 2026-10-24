/**
 * Antigravity Desktop Video Editor - Centralized Frame Cache Service
 * Caches decoded video frames across Media Pool cards and Timeline track filmstrips.
 * Reuses frames to prevent redundant GPU/CPU resource utilization when hovering or scrubbing.
 */

// Global key-value cache: `${filePath}@${timeBucket}` -> dataURL
export const frameCache = new Map<string, string>();

interface FrameIndexEntry {
  time: number;
  dataUrl: string;
}

// Sorted index per file for fast nearest-neighbor lookups
const fileFramesIndex = new Map<string, FrameIndexEntry[]>();

// Poster thumbnail per file
export const filePosterCache = new Map<string, string>();

/**
 * Normalizes time into a 0.5s bucket for cache grouping
 */
export function timeBucket(timeSeconds: number): string {
  return (Math.round(timeSeconds * 2) / 2).toFixed(1);
}

/**
 * Stores a frame in the cache and updates the index for fast nearest-neighbor lookups
 */
export function setCachedFrame(filePath: string, timeSeconds: number, dataUrl: string): void {
  if (!filePath || !dataUrl) return;

  const bucket = timeBucket(timeSeconds);
  const key = `${filePath}@${bucket}`;
  frameCache.set(key, dataUrl);

  if (!filePosterCache.has(filePath)) {
    filePosterCache.set(filePath, dataUrl);
  }

  let index = fileFramesIndex.get(filePath);
  if (!index) {
    index = [];
    fileFramesIndex.set(filePath, index);
  }

  // Avoid inserting duplicates at the exact same bucket time
  const existingIdx = index.findIndex((e) => Math.abs(e.time - timeSeconds) < 0.25);
  if (existingIdx >= 0) {
    index[existingIdx].dataUrl = dataUrl;
  } else {
    index.push({ time: timeSeconds, dataUrl });
    index.sort((a, b) => a.time - b.time);
  }
}

/**
 * Retrieves the nearest cached frame for a given file strictly within maxToleranceSec.
 * Returns null if no cached frame is within tolerance (never returns poster as a false match).
 */
export function getNearestCachedFrame(
  filePath: string,
  timeSeconds: number,
  maxToleranceSec: number = 0.8
): string | null {
  if (!filePath) return null;

  // 1. Exact bucket match
  const exactKey = `${filePath}@${timeBucket(timeSeconds)}`;
  if (frameCache.has(exactKey)) {
    return frameCache.get(exactKey)!;
  }

  // 2. Nearest frame from sorted index within tolerance
  const index = fileFramesIndex.get(filePath);
  if (index && index.length > 0) {
    let closest: FrameIndexEntry | null = null;
    let minDiff = Infinity;

    for (const entry of index) {
      const diff = Math.abs(entry.time - timeSeconds);
      if (diff < minDiff) {
        minDiff = diff;
        closest = entry;
      }
    }

    if (closest && minDiff <= maxToleranceSec) {
      return closest.dataUrl;
    }
  }

  // Strictly return null so caller knows an authentic frame at this time needs decoding
  return null;
}

/**
 * Explicitly gets the default poster thumbnail for a file if available
 */
export function getFilePoster(filePath: string): string | null {
  return filePosterCache.get(filePath) || null;
}

/**
 * Checks whether any frame is already cached for the given file
 */
export function hasCachedFrames(filePath: string): boolean {
  const index = fileFramesIndex.get(filePath);
  return Boolean((index && index.length > 0) || filePosterCache.has(filePath));
}

/**
 * Helper to capture a frame from an HTMLVideoElement onto a shared offscreen canvas
 */
let sharedCanvas: HTMLCanvasElement | null = null;
let sharedCtx: CanvasRenderingContext2D | null = null;

export function captureVideoFrame(
  video: HTMLVideoElement,
  width: number = 160,
  height: number = 90
): string | null {
  try {
    if (!video || video.videoWidth === 0 || video.seeking) return null;

    if (!sharedCanvas) {
      sharedCanvas = document.createElement('canvas');
    }
    sharedCanvas.width = width;
    sharedCanvas.height = height;

    if (!sharedCtx) {
      sharedCtx = sharedCanvas.getContext('2d', { willReadFrequently: true });
    }
    if (!sharedCtx) return null;

    sharedCtx.drawImage(video, 0, 0, width, height);
    return sharedCanvas.toDataURL('image/jpeg', 0.65);
  } catch {
    return null;
  }
}
