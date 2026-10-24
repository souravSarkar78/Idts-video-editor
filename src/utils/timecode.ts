/**
 * Frame-accurate timecode conversion utilities for NLE video editing
 */

export function secondsToFrames(seconds: number, fps: number): number {
  return Math.round(seconds * fps);
}

export function framesToSeconds(frames: number, fps: number): number {
  return frames / fps;
}

export function formatTimecode(seconds: number, fps: number = 30): string {
  if (isNaN(seconds) || seconds < 0) {
    seconds = 0;
  }

  const totalFrames = Math.floor(seconds * fps);
  const frames = totalFrames % Math.round(fps);
  const totalSeconds = Math.floor(seconds);
  const s = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const m = totalMinutes % 60;
  const h = Math.floor(totalMinutes / 60);

  const pad = (n: number, z = 2) => ('00' + n).slice(-z);

  return `${pad(h)}:${pad(m)}:${pad(s)}:${pad(frames)}`;
}

export function formatDeltaSeconds(deltaSeconds: number): string {
  const sign = deltaSeconds > 0 ? '+' : deltaSeconds < 0 ? '-' : ' ';
  const abs = Math.abs(deltaSeconds);
  return `${sign}${abs.toFixed(3)}s`;
}

export function formatTime(seconds: number): string {
  const totalSeconds = Math.floor(seconds);
  const s = totalSeconds % 60;
  const m = Math.floor(totalSeconds / 60);
  const ms = Math.floor((seconds % 1) * 100);
  const pad = (n: number) => ('00' + n).slice(-2);
  return `${pad(m)}:${pad(s)}.${pad(ms)}`;
}
