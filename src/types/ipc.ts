/**
 * Antigravity Desktop Video Editor - Shared IPC Data Contracts
 * Mirror of Rust IPC contracts in `src-tauri/src/models/ipc.rs`
 */

export type TrackType = 'video' | 'audio';

export type MediaType = 'video' | 'audio' | 'image';

export type SyncMode = 'filename' | 'audio' | 'waveform' | 'metadata';

export interface ClipMetadata {
  durationSeconds: number;
  width?: number;
  height?: number;
  framerate?: number;
  sampleRate?: number;
  channels?: number;
  codec?: string;
  creationTime?: string;
  fileSizeBytes?: number;
}

export interface Clip {
  id: string;
  trackId: string;
  name: string;
  filePath: string;

  // Primary millisecond timeline coordinates (Rust IPC contract)
  startTimeMs: number;
  durationMs: number;
  sourceOffsetMs: number;
  synced: boolean;

  // Frontend helper fields (seconds & UI caches)
  mediaType?: MediaType;
  inPointSeconds?: number;
  outPointSeconds?: number;
  startPositionSeconds?: number;
  durationSeconds?: number;
  isSynced?: boolean;
  syncDeltaSeconds?: number;
  waveformPeaks?: number[];
  metadata?: ClipMetadata;

  // Color & Audio Inspector properties (Milestone 4 & Phase 7)
  brightness?: number; // -1.0 to 1.0 (default 0)
  contrast?: number; // 0.0 to 2.0 (default 1)
  saturation?: number; // 0.0 to 3.0 (default 1)
  temperature?: number; // -100.0 to 100.0 (default 0)
  lutPath?: string; // Path or preset ID for 3D LUT
  color?: ColorCorrection;
  volumeDb?: number; // -60 to +12 dB
  audioExtracted?: boolean; // When true, audio was detached to an independent track
  hasAudio?: boolean; // False if muted/extracted or pure video

  // Phase 6: Proxy workflow support
  proxyPath?: string;
  hasProxy?: boolean;
}

export interface ColorCorrection {
  brightness: number; // -1.0 to 1.0 (default 0)
  contrast: number; // -2.0 to 2.0 (default 1)
  saturation: number; // 0.0 to 3.0 (default 1)
  temperature: number; // -100.0 to 100.0 (default 0)
  lutPath?: string;
}

export interface Transition {
  id: string;
  trackId: string;
  fromClipId: string;
  toClipId: string;
  transitionType: 'fade' | 'dissolve' | 'wipeleft' | 'wiperight' | 'slideup' | 'slidedown' | string;
  duration: number; // in seconds
  alignment?: 'center' | 'start' | 'end' | string;
  showBorder?: boolean;
  borderColor?: string;
  borderWidth?: number;
}

export interface MediaTrack {
  id: string;
  name: string;
  trackType: TrackType;
  type?: TrackType; // UI compatibility alias
  muted: boolean;
  isMuted?: boolean; // UI compatibility alias
  solo: boolean;
  isSolo?: boolean; // UI compatibility alias
  locked: boolean;
  isLocked?: boolean; // UI compatibility alias
  visible?: boolean;
  isVisible?: boolean; // UI compatibility alias
  clips: Clip[];

  // Interop styling and mixer controls
  color?: string; // Hex color for clip and header accent, e.g. #00F0FF, #A855F7, #F59E0B
  volume?: number; // 0.0 - 1.0 (or >1.0 for gain)
  pan?: number; // -1.0 to 1.0
  timeOffsetSeconds?: number;
  transitions?: Transition[];
}

// Track is an alias for MediaTrack for frontend convenience
export type Track = MediaTrack;

export interface MediaBin {
  id: string;
  name: string;
  parentId?: string;
  color?: string;
}

export interface MediaAsset {
  id: string;
  name: string;
  filePath: string;
  mediaType: MediaType;
  durationSeconds: number;
  durationMs: number;
  binId?: string;
  thumbnailUrl?: string;
  width?: number;
  height?: number;
  framerate?: number;
  sampleRate?: number;
  fileSizeBytes?: number;
  creationTime?: string;
  proxyPath?: string;
  hasProxy?: boolean;
}

export interface TimelineProject {
  id: string;
  name: string;
  fps: number; // e.g. 24, 25, 29.97, 30, 60
  sampleRate: number; // e.g. 44100, 48000
  width: number; // e.g. 1920, 3840
  height: number; // e.g. 1080, 2160
  durationMs: number;
  tracks: MediaTrack[];
  transitions?: Transition[];
  bins?: MediaBin[];
  assets?: MediaAsset[];
  currentTimeMs?: number;
}

// Alias for backwards compatibility with earlier frontend draft
export type ProjectSettings = TimelineProject;

export interface SyncPreset {
  id: string;
  name: string;
  pattern: string;
  description: string;
}

export interface SyncCandidate {
  trackId: string;
  trackName: string;
  clipId: string;
  clipName: string;
  filePath: string;
  parsedTimestamp?: string;
  calculatedOffsetSeconds: number;
  calculatedOffsetMs?: number;
  confidence: number; // 0.0 to 1.0 (especially for audio waveform correlation)
  isReference: boolean;
}

export type SyncPlacementMode = 'compact' | 'absolute' | 'custom_gap';

export interface SyncRequest {
  mode: SyncMode;
  pattern?: string;
  tracks?: MediaTrack[];
  referenceTrackId?: string;
  trackIds?: string[];
  placementMode?: SyncPlacementMode;
  maxGapSeconds?: number;
}

export interface SyncResult {
  success: boolean;
  message: string;
  trackOffsets: Record<string, number>;
  updatedProject?: TimelineProject;
  candidates?: SyncCandidate[];
  referenceTimestamp?: string;
}

export interface ClipSyncOffset {
  clipId: string;
  trackId: string;
  offsetMs: number;
  offsetSeconds: number;
  timestamp?: string;
}

export interface TrackSyncOffset {
  trackId: string;
  trackName: string;
  offsetMs: number;
  offsetSeconds: number;
  earliestClipTimestamp?: string;
  clipOffsets?: ClipSyncOffset[];
}

export type HardwareEncoder = 'h264_nvenc' | 'h264_qsv' | 'h264_amf' | 'libx264';

export interface HardwareProbeResponse {
  availableEncoders: HardwareEncoder[];
  primaryEncoder: HardwareEncoder;
  hasCuda: boolean;
  hasQuickSync: boolean;
}

export interface ExportConfig {
  outputPath: string;
  width?: number;
  height?: number;
  fps?: number;
  codec?: string; // e.g. 'h264_nvenc' | 'h264_qsv' | 'h264_amf' | 'libx264'
  appliedLutPath?: string;
  denoiseEnabled?: boolean;
  project?: TimelineProject;
  tracks?: MediaTrack[];
}

export interface ExportProgress {
  percentage: number;
  currentFrame: number;
  fps: number;
  etaSeconds?: number;
}

// Milestone 5: Project Persistence (.idts) and Preferences
export interface ProjectMetadata {
  id: string;
  name: string;
  createdAt: string;
  modifiedAt: string;
  fps: number;
  width: number;
  height: number;
  durationMs: number;
}

export interface MediaPool {
  bins: MediaBin[];
  assets: MediaAsset[];
}

export interface TimelineData {
  tracks: MediaTrack[];
  transitions?: Transition[];
  playheadSec: number;
  activeCameraTrackId?: string;
}

export interface ProjectData {
  version: string;
  metadata: ProjectMetadata;
  mediaPool: MediaPool;
  timeline: TimelineData;
}

export interface AppPreferences {
  shortcuts: Record<string, string>;
  autoSaveIntervalSec: number;
  theme: string;
  snappingEnabled: boolean;
  autoGenerateProxies: boolean;
  proxyResolution: '720p' | '540p' | '360p' | string;
  proxyCodec: 'h264_nvenc' | 'libx264' | string;
}

export interface ProxyProgressEvent {
  path: string;
  progress: number;
  status: 'transcoding' | 'completed' | 'error' | 'cancelled' | string;
  proxyPath?: string;
  errorMessage?: string;
}

export interface SilenceInterval {
  startSec: number;
  endSec: number;
  durationSec: number;
}


