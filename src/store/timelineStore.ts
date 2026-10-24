import { create } from 'zustand';
import { useShortcutStore } from './shortcutStore';
import {
  TimelineProject,
  MediaTrack,
  Clip,
  ClipMetadata,
  SyncCandidate,
  MediaBin,
  MediaAsset,
  SyncPreset,
  SyncRequest,
  TrackSyncOffset,
  ClipSyncOffset,
  ExportConfig,
  ExportProgress,
  ProjectData,
  Transition,
  ColorCorrection,
  KeyframePoint,
  KeyframeTrack,
  SpeedProfile,
  LensEffects,
} from '../types/ipc';

export interface TimelineSnapshot {
  tracks: MediaTrack[];
  transitions?: Transition[];
  playhead: number;
  selectedClipId: string | null;
  selectedClipIds?: string[];
  activeCameraTrackId: string | null;
  project: TimelineProject;
}

export const isTauri = typeof window !== 'undefined' && Boolean((window as any).__TAURI_INTERNALS__);

/**
 * Updates document and native window title dynamically:
 * "idts video editor — [ProjectName].idts" (with dirty indicator '*' when unsaved changes exist)
 */
export function updateAppTitle(projectName: string, isDirty: boolean, filePath?: string | null) {
  const baseName = filePath
    ? filePath.split(/[\\/]/).pop() || `${projectName}.idts`
    : `${projectName}.idts`;
  const cleanName = baseName.toLowerCase().endsWith('.idts') ? baseName : `${baseName}.idts`;
  const dirtyMark = isDirty ? ' *' : '';
  const title = `idts video editor — ${cleanName}${dirtyMark}`;

  if (typeof document !== 'undefined') {
    document.title = title;
  }

  if (isTauri) {
    import('@tauri-apps/api/window')
      .then(({ getCurrentWindow }) => {
        getCurrentWindow().setTitle(title).catch(() => {});
      })
      .catch(() => {});
  }
}

export async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T | null> {
  if (!isTauri) return null;
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke<T>(cmd, args);
  } catch (err) {
    console.warn(`[Tauri IPC] ${cmd} warning:`, err);
    return null;
  }
}

/**
 * Computes interpolated motion transform values (linear / ease_in_out) at the given playhead time
 */
export function getInterpolatedClipTransform(clip: Clip, playhead: number) {
  const startSec = clip.startPositionSeconds ?? (clip.startTimeMs / 1000);
  const durSec = clip.durationSeconds ?? (clip.durationMs / 1000);
  const speed = clip.speedProfile?.speedMultiplier ?? 1.0;
  const relTime = Math.max(0, Math.min(durSec, playhead - startSec)) * speed;

  const interpolateProp = (prop: string, defaultVal: number): number => {
    const track = clip.keyframeTracks?.find((t) => t.property === prop);
    if (!track || !track.keyframes || track.keyframes.length === 0) {
      return defaultVal;
    }
    const kfs = [...track.keyframes].sort((a, b) => a.time - b.time);
    if (relTime <= kfs[0].time) return kfs[0].value;
    if (relTime >= kfs[kfs.length - 1].time) return kfs[kfs.length - 1].value;

    for (let i = 0; i < kfs.length - 1; i++) {
      const k0 = kfs[i];
      const k1 = kfs[i + 1];
      if (relTime >= k0.time && relTime <= k1.time) {
        const span = k1.time - k0.time;
        if (span <= 0.0001) return k0.value;
        let t = (relTime - k0.time) / span;
        if (k0.easing === 'ease_in_out') {
          t = t * t * (3 - 2 * t);
        }
        return k0.value + (k1.value - k0.value) * t;
      }
    }
    return defaultVal;
  };

  return {
    scale: interpolateProp('scale', clip.scale ?? 1.0),
    positionX: interpolateProp('position_x', clip.positionX ?? 0),
    positionY: interpolateProp('position_y', clip.positionY ?? 0),
    rotation: interpolateProp('rotation', clip.rotation ?? 0),
    opacity: interpolateProp('opacity', clip.opacity ?? 1.0),
  };
}

export interface ActiveDragAssetInfo {
  asset: MediaAsset;
  mouseX: number;
  mouseY: number;
}

export interface TimelineState {
  project: TimelineProject;
  tracks: MediaTrack[];
  bins: MediaBin[];
  assets: MediaAsset[];
  activeBinId: string;
  playhead: number; // in seconds
  isPlaying: boolean;
  zoom: number; // pixels per second
  selectedClipId: string | null;
  selectedClipIds: string[];
  selectedTrackId: string | null;
  selectedAssetId: string | null;
  draggedAsset: MediaAsset | null;
  setDraggedAsset: (asset: MediaAsset | null) => void;
  activeDragAsset: ActiveDragAssetInfo | null;
  setActiveDragAsset: (info: ActiveDragAssetInfo | null) => void;
  isSyncModalOpen: boolean;
  activeTab: 'media' | 'audio' | 'text' | 'stickers' | 'effects' | 'transitions' | 'filters';
  inspectorTab: 'video' | 'audio' | 'speed' | 'animate' | 'adjust' | 'color';
  lastSyncMessage: string | null;

  // Phase 7: Transitions & Color Grading
  transitions: Transition[];
  selectedTransitionId: string | null;
  activeDragTransition: { transitionType: string; label: string; mouseX: number; mouseY: number } | null;
  setActiveDragTransition: (info: { transitionType: string; label: string; mouseX: number; mouseY: number } | null) => void;
  setSelectedTransitionId: (id: string | null) => void;
  addTransition: (transition: Omit<Transition, 'id'> | Transition) => void;
  updateTransition: (id: string, updates: Partial<Transition>) => void;
  removeTransition: (id: string) => void;
  updateClipColor: (clipId: string, color: Partial<ColorCorrection>) => void;
  resetClipColor: (clipId: string) => void;

  // Navigation & Tabs
  setActiveTab: (tab: TimelineState['activeTab']) => void;
  setInspectorTab: (tab: TimelineState['inspectorTab']) => void;

  // Playback & Scrubbing
  setPlayhead: (time: number) => void;
  stepFrames: (frames: number) => void;
  setIsPlaying: (isPlaying: boolean) => void;
  togglePlayPause: () => void;
  setZoom: (zoom: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;

  // Media Pool & Bins
  setActiveBinId: (binId: string) => void;
  createBin: (name: string) => void;
  renameBin: (binId: string, name: string) => void;
  deleteBin: (binId: string) => void;
  importFiles: (files: FileList | File[]) => void;
  importFromNativePaths: (paths: string[]) => Promise<void>;
  importCustomAsset: (asset: Partial<MediaAsset>) => void;
  deleteAsset: (assetId: string) => void;
  moveAssetToBin: (assetId: string, binId?: string) => void;
  selectAsset: (assetId: string | null) => void;
  addAssetToTrack: (assetId: string, trackId: string, targetSeconds?: number) => void;

  // Dynamic Tracks
  addTrack: (trackType: 'video' | 'audio', name?: string) => string;
  removeTrack: (trackId: string) => void;
  toggleTrackVisibility: (trackId: string) => void;
  toggleMute: (trackId: string) => void;
  toggleSolo: (trackId: string) => void;
  toggleLock: (trackId: string) => void;
  renameTrack: (trackId: string, name: string) => void;
  selectTrack: (trackId: string | null) => void;

  // Clip Manipulation
  moveClip: (clipId: string, newStartPositionSec: number, targetTrackId?: string) => void;
  trimClip: (clipId: string, newInSec: number, newOutSec: number, newStartSec?: number) => void;
  trimClipLeft: (
    clipId: string,
    deltaSeconds: number,
    initialStartSec?: number,
    initialInSec?: number,
    initialDurSec?: number,
    speed?: number
  ) => void;
  trimClipRight: (
    clipId: string,
    deltaSeconds: number,
    initialDurSec?: number,
    initialInSec?: number,
    speed?: number
  ) => void;
  splitClipAtPlayhead: (clipId?: string) => void;
  deleteClip: (clipId: string) => void;
  deleteSelectedClips: () => void;
  selectClip: (clipId: string | null, isMulti?: boolean) => void;
  selectClips: (clipIds: string[]) => void;
  moveMultipleClips: (moves: Array<{ clipId: string; newStartSec: number }>) => void;
  extractAudioFromClip: (clipId: string) => void;
  duplicateClip: (clipId: string) => void;

  // Export Master Pipeline
  isExportModalOpen: boolean;
  isExporting: boolean;
  exportProgress: ExportProgress | null;
  exportStatusMessage: string | null;
  setExportModalOpen: (open: boolean) => void;
  startExport: (config: ExportConfig) => Promise<{ success: boolean; message: string }>;
  cancelExport: () => void;

  // Track-Level Multi-Sync Action & Placement Settings
  syncPlacementMode: 'compact' | 'absolute' | 'capped';
  syncGapCushionSec: number;
  setSyncPlacementMode: (mode: 'compact' | 'absolute' | 'capped') => void;
  setSyncGapCushionSec: (sec: number) => void;
  syncAllTracks: (options?: {
    pattern?: string;
    placementMode?: 'compact' | 'absolute' | 'capped';
    gapCushionSec?: number;
  } | string) => { success: boolean; message: string; count: number };
  executeTauriSync: (customPattern?: string) => Promise<{ success: boolean; message: string; count: number }>;
  applySyncResults: (candidates: SyncCandidate[]) => void;
  setSyncModalOpen: (open: boolean) => void;
  getActiveVideoClip: () => { clip: Clip; track: MediaTrack } | null;
  resetToSampleData: () => void;

  // Milestone 4: Waveforms, Multicam Angle Switching & Inspector
  waveformData: Record<string, number[]>;
  fetchWaveformData: (filePath: string) => Promise<number[]>;
  isMulticamActive: boolean;
  activeCameraTrackId: string | null;
  multicamSplitOnCut: boolean;
  toggleMulticamSplitOnCut: () => void;
  setMulticamSplitOnCut: (split: boolean) => void;
  toggleMulticamActive: () => void;
  switchMulticamAngle: (angleIndex: number) => void;
  updateClipAdjustments: (
    clipId: string,
    adjustments: {
      brightness?: number;
      contrast?: number;
      saturation?: number;
      lutPath?: string;
      volumeDb?: number;
    }
  ) => void;
  syncTracksByAudio: (
    primaryTrackId: string,
    secondaryTrackId: string
  ) => Promise<{ success: boolean; offsetMs: number; message: string }>;

  // Milestone 5: Snapping, History & Project Persistence (.idts)
  isSnappingEnabled: boolean;
  toggleSnapping: () => void;
  setSnappingEnabled: (enabled: boolean) => void;
  calculateSnappedPosition: (
    proposedSec: number,
    clipDurationSec: number,
    excludeClipId?: string,
    zoom?: number
  ) => number;

  historyPast: TimelineSnapshot[];
  historyFuture: TimelineSnapshot[];
  isDirty: boolean;
  currentProjectPath: string | null;
  pushHistory: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  rippleDeleteClip: (clipId?: string) => void;

  saveProject: (asNewFile?: boolean) => Promise<boolean>;
  openProject: (pathOverride?: string) => Promise<boolean>;
  createNewProject: () => void;
  loadProjectData: (data: ProjectData, filePath?: string) => void;

  // Phase 6: Proxy Workflow & High-Performance Preview
  isProxyMode: boolean;
  proxyProgress: Record<string, number>;
  proxyStatus: Record<string, 'transcoding' | 'completed' | 'error' | 'cancelled'>;
  setProxyMode: (enabled: boolean) => void;
  toggleProxyMode: () => void;
  generateClipProxy: (filePath: string, resolution?: string) => Promise<string | null>;
  cancelClipProxy: (filePath: string) => Promise<void>;
  deleteClipProxy: (filePath: string) => Promise<void>;
  checkClipProxy: (filePath: string, resolution?: string) => Promise<string | null>;
  initProxyEventListener: () => void;

  // Phase 6: Multi-Track Ripple Editing Engine
  isRippleMode: boolean;
  toggleRippleMode: () => void;
  setRippleMode: (enabled: boolean) => void;
  deleteGapAtTime: (trackId: string, timeSec: number) => void;

  // Trimming Tool vs Rate Stretch (Slow-Mo) Drag Mode
  edgeDragMode: 'trim' | 'stretch';
  setEdgeDragMode: (mode: 'trim' | 'stretch') => void;
  toggleEdgeDragMode: () => void;
  stretchClip: (
    clipId: string,
    newDurSec: number,
    newStartSec?: number,
    pitchCorrection?: boolean
  ) => void;

  // Phase 6: Audio Silence Auto-Cut Modal & Engine
  isSilenceModalOpen: boolean;
  setSilenceModalOpen: (open: boolean) => void;
  autoCutSilence: (
    targetTrackId: string,
    thresholdDb: number,
    minDurationSec: number
  ) => Promise<{ cutCount: number; removedSec: number; error?: string }>;

  // Phase 8: Motion Transform Controls, Dynamic Keyframing Engine, Speed Ramping, Lens Effects
  expandedKeyframeClipIds: string[];
  toggleKeyframeLane: (clipId: string) => void;
  updateClipTransform: (
    clipId: string,
    transform: {
      scale?: number;
      positionX?: number;
      positionY?: number;
      rotation?: number;
      opacity?: number;
    }
  ) => void;
  addOrUpdateKeyframe: (
    clipId: string,
    property: string,
    time: number,
    value: number,
    easing?: string
  ) => void;
  removeKeyframe: (clipId: string, property: string, time: number) => void;
  updateClipSpeed: (
    clipId: string,
    speedMultiplier: number,
    pitchCorrection?: boolean
  ) => void;
  updateClipLensEffects: (
    clipId: string,
    lens: Partial<LensEffects>
  ) => void;
}

// Color palettes for dynamic track assignments
const VIDEO_COLORS = ['#00F0FF', '#A855F7', '#EC4899', '#3B82F6', '#06B6D4', '#8B5CF6'];
const AUDIO_COLORS = ['#F59E0B', '#10B981', '#14B8A6', '#84CC16', '#EAB308'];

// Initial default bins matching user request
const INITIAL_BINS: MediaBin[] = [
  { id: 'all', name: 'All Media', color: '#00F0FF' },
  { id: 'bin-front', name: 'Front POV', color: '#38BDF8' },
  { id: 'bin-helmet', name: 'Helmet Cam', color: '#A855F7' },
  { id: 'bin-audio', name: 'External Audio', color: '#F59E0B' },
];

// Initial clean media pool assets (empty on startup)
const INITIAL_ASSETS: MediaAsset[] = [];

// Initial clean project definition
const INITIAL_PROJECT: TimelineProject = {
  id: 'proj_default',
  name: 'Untitled Project',
  fps: 30,
  sampleRate: 48000,
  width: 1920,
  height: 1080,
  durationMs: 120000,
  tracks: [],
  bins: INITIAL_BINS,
  assets: [],
};

/**
 * Sanitizes a MediaTrack object for IPC transfer to Rust backend,
 * stripping redundant UI compatibility aliases and ensuring consistent fields.
 */
export function sanitizeTrackForIpc(track: MediaTrack): MediaTrack {
  return {
    id: track.id,
    name: track.name,
    trackType: track.trackType || track.type || 'video',
    muted: Boolean(track.muted ?? track.isMuted ?? false),
    solo: Boolean(track.solo ?? track.isSolo ?? false),
    locked: Boolean(track.locked ?? track.isLocked ?? false),
    visible: track.visible !== false && track.isVisible !== false,
    color: track.color,
    volume: track.volume,
    pan: track.pan,
    timeOffsetSeconds: track.timeOffsetSeconds,
    clips: (track.clips || []).map((clip) => ({
      id: clip.id,
      trackId: clip.trackId,
      name: clip.name,
      filePath: clip.filePath,
      startTimeMs: clip.startTimeMs,
      durationMs: clip.durationMs,
      sourceOffsetMs: clip.sourceOffsetMs,
      synced: Boolean(clip.synced ?? clip.isSynced ?? false),
      mediaType: clip.mediaType,
      inPointSeconds: clip.inPointSeconds,
      outPointSeconds: clip.outPointSeconds,
      startPositionSeconds: clip.startPositionSeconds,
      durationSeconds: clip.durationSeconds,
      isSynced: clip.isSynced,
      syncDeltaSeconds: clip.syncDeltaSeconds,
      waveformPeaks: clip.waveformPeaks,
      metadata: clip.metadata,
    })),
  };
}

// Initial clean tracks ready for footage
const INITIAL_TRACKS: MediaTrack[] = [
  {
    id: 'track-v1',
    name: 'Track 1',
    trackType: 'video',
    color: '#00F0FF',
    muted: false,
    solo: false,
    locked: false,
    visible: true,
    volume: 1.0,
    pan: 0,
    timeOffsetSeconds: 0,
    clips: [],
  },
  {
    id: 'track-a1',
    name: 'Audio 1',
    trackType: 'audio',
    color: '#F59E0B',
    muted: false,
    solo: false,
    locked: false,
    visible: true,
    volume: 1.0,
    pan: 0,
    timeOffsetSeconds: 0,
    clips: [],
  },
];

/**
 * Parses camera filename into Unix timestamp in milliseconds.
 * Mirrors `src-tauri/src/sync/filename.rs` logic.
 */
function parseFilenameToEpoch(filename: string, customPattern?: string): number | null {
  const baseName = filename.split(/[\\/]/).pop() || filename;

  // Custom regex or template if provided
  if (customPattern) {
    try {
      let regexStr = customPattern;
      if (customPattern.includes('{') && customPattern.includes('}')) {
        regexStr = customPattern
          .replace(/\{YYYY\}/g, '(?<year>\\d{4})')
          .replace(/\{MM\}/g, '(?<month>\\d{2})')
          .replace(/\{DD\}/g, '(?<day>\\d{2})')
          .replace(/\{HH\}/g, '(?<hour>\\d{2})')
          .replace(/\{mm\}/g, '(?<minute>\\d{2})')
          .replace(/\{ss\}/g, '(?<second>\\d{2})')
          .replace(/\{SSS\}/g, '(?<millis>\\d{3})');
      }
      const reg = new RegExp(regexStr);
      const match = reg.exec(baseName);
      if (match && match.groups) {
        const { year, month, day, hour, minute, second, millis } = match.groups;
        if (year && month && day && hour && minute && second) {
          const dt = new Date(
            Date.UTC(
              parseInt(year, 10),
              parseInt(month, 10) - 1,
              parseInt(day, 10),
              parseInt(hour, 10),
              parseInt(minute, 10),
              parseInt(second, 10),
              millis ? parseInt(millis, 10) : 0
            )
          );
          return dt.getTime();
        }
      }
    } catch {
      // Fallback to presets
    }
  }

  // Preset 1: VID_YYYYMMDD_HHMMSS (e.g. VID_20261002_062623_10_071.mp4)
  const vidMatch = /VID_(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})/.exec(baseName);
  if (vidMatch) {
    const [, y, m, d, h, min, s] = vidMatch;
    return new Date(
      Date.UTC(
        parseInt(y, 10),
        parseInt(m, 10) - 1,
        parseInt(d, 10),
        parseInt(h, 10),
        parseInt(min, 10),
        parseInt(s, 10)
      )
    ).getTime();
  }

  // Preset 2: DJI_YYYYMMDD_HHMMSS (e.g. DJI_20261002_062650.MP4)
  const djiMatch = /DJI_(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})/.exec(baseName);
  if (djiMatch) {
    const [, y, m, d, h, min, s] = djiMatch;
    return new Date(
      Date.UTC(
        parseInt(y, 10),
        parseInt(m, 10) - 1,
        parseInt(d, 10),
        parseInt(h, 10),
        parseInt(min, 10),
        parseInt(s, 10)
      )
    ).getTime();
  }

  // Preset 3: AUDIO_YYYYMMDD_HHMMSS (e.g. AUDIO_20261002_062615.wav)
  const audioMatch = /AUDIO_(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})/.exec(baseName);
  if (audioMatch) {
    const [, y, m, d, h, min, s] = audioMatch;
    return new Date(
      Date.UTC(
        parseInt(y, 10),
        parseInt(m, 10) - 1,
        parseInt(d, 10),
        parseInt(h, 10),
        parseInt(min, 10),
        parseInt(s, 10)
      )
    ).getTime();
  }

  // Preset 4: Generic YYYYMMDD_HHMMSS anywhere in filename
  const genericMatch = /(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})/.exec(baseName);
  if (genericMatch) {
    const [, y, m, d, h, min, s] = genericMatch;
    return new Date(
      Date.UTC(
        parseInt(y, 10),
        parseInt(m, 10) - 1,
        parseInt(d, 10),
        parseInt(h, 10),
        parseInt(min, 10),
        parseInt(s, 10)
      )
    ).getTime();
  }

    return null;
}

/**
 * Automatically inspects all tracks and moves any overlapping clips to separate tracks.
 * If no existing non-overlapping track of the same type is found, a new track is created.
 */
export function resolveTrackOverlaps(currentTracks: MediaTrack[]): { tracks: MediaTrack[]; movedCount: number } {
  let movedCount = 0;
  // Deep clone tracks structure
  const updatedTracks: MediaTrack[] = currentTracks.map((t) => ({
    ...t,
    clips: [...t.clips],
  }));

  const checkOverlap = (c1: Clip, c2: Clip): boolean => {
    const s1 = c1.startPositionSeconds ?? (c1.startTimeMs ? c1.startTimeMs / 1000 : 0);
    const d1 = c1.durationSeconds ?? (c1.durationMs ? c1.durationMs / 1000 : 10);
    const e1 = s1 + d1;

    const s2 = c2.startPositionSeconds ?? (c2.startTimeMs ? c2.startTimeMs / 1000 : 0);
    const d2 = c2.durationSeconds ?? (c2.durationMs ? c2.durationMs / 1000 : 10);
    const e2 = s2 + d2;

    // Allow abutting clips with small epsilon (0.05s)
    return s1 < e2 - 0.05 && s2 < e1 - 0.05;
  };

  // We process track by track
  for (let tIdx = 0; tIdx < updatedTracks.length; tIdx++) {
    const track = updatedTracks[tIdx];
    const trackType = track.trackType || track.type || 'video';

    // Sort clips on this track chronologically
    track.clips.sort(
      (a, b) =>
        (a.startPositionSeconds ?? (a.startTimeMs ? a.startTimeMs / 1000 : 0)) -
        (b.startPositionSeconds ?? (b.startTimeMs ? b.startTimeMs / 1000 : 0))
    );

    const keptClips: Clip[] = [];
    const conflictingClips: Clip[] = [];

    for (const clip of track.clips) {
      const hasConflict = keptClips.some((existing) => checkOverlap(existing, clip));
      if (hasConflict) {
        conflictingClips.push(clip);
      } else {
        keptClips.push(clip);
      }
    }

    track.clips = keptClips;

    // For every conflicting clip, find another compatible track without overlap or create a new one
    for (const confClip of conflictingClips) {
      let placed = false;

      // 1. Check existing tracks of the same type
      for (const otherTrack of updatedTracks) {
        const otherType = otherTrack.trackType || otherTrack.type || 'video';
        if (otherType === trackType && otherTrack.id !== track.id && !otherTrack.locked && !otherTrack.isLocked) {
          const hasConflict = otherTrack.clips.some((existing) => checkOverlap(existing, confClip));
          if (!hasConflict) {
            otherTrack.clips.push({ ...confClip, trackId: otherTrack.id });
            otherTrack.clips.sort(
              (a, b) =>
                (a.startPositionSeconds ?? (a.startTimeMs ? a.startTimeMs / 1000 : 0)) -
                (b.startPositionSeconds ?? (b.startTimeMs ? b.startTimeMs / 1000 : 0))
            );
            placed = true;
            movedCount++;
            break;
          }
        }
      }

      // 2. If no existing track can fit it, create a new track!
      if (!placed) {
        const count = updatedTracks.filter((t) => (t.trackType || t.type) === trackType).length + 1;
        const newTrackId = `track-${trackType[0]}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`;
        const newTrackName = trackType === 'video' ? `Track ${count}` : `Audio ${count}`;
        const newColor =
          trackType === 'video'
            ? VIDEO_COLORS[(count - 1) % VIDEO_COLORS.length]
            : AUDIO_COLORS[(count - 1) % AUDIO_COLORS.length];

        const newTrack: MediaTrack = {
          id: newTrackId,
          name: newTrackName,
          trackType: trackType === 'audio' ? 'audio' : 'video',
          type: trackType === 'audio' ? 'audio' : 'video',
          color: newColor,
          muted: false,
          isMuted: false,
          solo: false,
          isSolo: false,
          locked: false,
          isLocked: false,
          visible: true,
          isVisible: true,
          timeOffsetSeconds: confClip.startPositionSeconds || 0,
          clips: [{ ...confClip, trackId: newTrackId }],
        };

        updatedTracks.push(newTrack);
        placed = true;
        movedCount++;
      }
    }
  }

  // Ensure every track's timeOffsetSeconds matches the earliest clip currently residing on that track
  const finalTracks = updatedTracks.map((t) => ({
    ...t,
    timeOffsetSeconds:
      t.clips.length > 0 ? Math.min(...t.clips.map((c) => c.startPositionSeconds ?? 0)) : 0,
  }));

  return { tracks: finalTracks, movedCount };
}

export const useTimelineStore = create<TimelineState>((set, get) => ({
  project: INITIAL_PROJECT,
  tracks: INITIAL_TRACKS,
  bins: INITIAL_BINS,
  assets: INITIAL_ASSETS,
  activeBinId: 'all',
  playhead: 0,
  isPlaying: false,
  zoom: 35, // pixels per second
  selectedClipId: null,
  selectedClipIds: [],
  selectedTrackId: 'track-v1',
  selectedAssetId: null,
  draggedAsset: null,
  activeDragAsset: null,
  isSyncModalOpen: false,
  isExportModalOpen: false,
  isExporting: false,
  exportProgress: null,
  exportStatusMessage: null,
  setExportModalOpen: (isExportModalOpen) => set({ isExportModalOpen }),
  activeTab: 'media',
  inspectorTab: 'video',
  lastSyncMessage: null,
  syncPlacementMode: 'compact',
  syncGapCushionSec: 1.0,

  // Phase 6: Proxy state
  isProxyMode: false,
  proxyProgress: {},
  proxyStatus: {},
  setProxyMode: (isProxyMode) => set({ isProxyMode }),
  toggleProxyMode: () => set((state) => ({ isProxyMode: !state.isProxyMode })),

  // Phase 6: Ripple & Silence state
  isRippleMode: false,
  toggleRippleMode: () => set((state) => ({ isRippleMode: !state.isRippleMode })),
  setRippleMode: (isRippleMode) => set({ isRippleMode }),
  edgeDragMode: 'trim',
  setEdgeDragMode: (edgeDragMode) => set({ edgeDragMode }),
  toggleEdgeDragMode: () => set((state) => ({ edgeDragMode: state.edgeDragMode === 'trim' ? 'stretch' : 'trim' })),
  isSilenceModalOpen: false,
  setSilenceModalOpen: (isSilenceModalOpen) => set({ isSilenceModalOpen }),

  // Phase 7: Transitions & Color Grading
  transitions: [],
  selectedTransitionId: null,
  activeDragTransition: null,
  setActiveDragTransition: (activeDragTransition) => set({ activeDragTransition }),
  setSelectedTransitionId: (selectedTransitionId) => set({ selectedTransitionId }),

  addTransition: (transition) => {
    const id = 'id' in transition && transition.id ? transition.id : `trans-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const newTrans: Transition = {
      ...transition,
      id,
      duration: transition.duration || 1.0,
      alignment: transition.alignment || 'center',
      showBorder: transition.showBorder ?? false,
      borderColor: transition.borderColor || '#A855F7',
      borderWidth: transition.borderWidth || 2,
    };
    get().pushHistory();
    set((state) => ({
      transitions: [
        ...state.transitions.filter(
          (t) => !(t.trackId === newTrans.trackId && t.fromClipId === newTrans.fromClipId && t.toClipId === newTrans.toClipId)
        ),
        newTrans,
      ],
      selectedTransitionId: id,
      isDirty: true,
    }));
  },

  updateTransition: (id, updates) => {
    get().pushHistory();
    set((state) => ({
      transitions: state.transitions.map((t) => (t.id === id ? { ...t, ...updates } : t)),
      isDirty: true,
    }));
  },

  removeTransition: (id) => {
    get().pushHistory();
    set((state) => ({
      transitions: state.transitions.filter((t) => t.id !== id),
      selectedTransitionId: state.selectedTransitionId === id ? null : state.selectedTransitionId,
      isDirty: true,
    }));
  },

  updateClipColor: (clipId, colorUpdates) => {
    set((state) => ({
      isDirty: true,
      tracks: state.tracks.map((track) => ({
        ...track,
        clips: track.clips.map((clip) => {
          if (clip.id !== clipId) return clip;
          const current = clip.color || {
            brightness: clip.brightness ?? 0,
            contrast: clip.contrast ?? 1,
            saturation: clip.saturation ?? 1,
            temperature: clip.temperature ?? 0,
            lutPath: clip.lutPath,
          };
          const nextColor: ColorCorrection = {
            ...current,
            ...colorUpdates,
          };
          return {
            ...clip,
            brightness: nextColor.brightness,
            contrast: nextColor.contrast,
            saturation: nextColor.saturation,
            temperature: nextColor.temperature,
            lutPath: nextColor.lutPath,
            color: nextColor,
          };
        }),
      })),
    }));
  },

  resetClipColor: (clipId) => {
    set((state) => ({
      isDirty: true,
      tracks: state.tracks.map((track) => ({
        ...track,
        clips: track.clips.map((clip) => {
          if (clip.id !== clipId) return clip;
          return {
            ...clip,
            brightness: 0,
            contrast: 1,
            saturation: 1,
            temperature: 0,
            lutPath: undefined,
            color: {
              brightness: 0,
              contrast: 1,
              saturation: 1,
              temperature: 0,
              lutPath: undefined,
            },
          };
        }),
      })),
    }));
  },

  setSyncPlacementMode: (syncPlacementMode) => set({ syncPlacementMode }),
  setSyncGapCushionSec: (syncGapCushionSec) => set({ syncGapCushionSec }),

  setActiveTab: (activeTab) => set({ activeTab }),
  setInspectorTab: (inspectorTab) => set({ inspectorTab }),

  setPlayhead: (time) => {
    const { project } = get();
    const maxSec = (project.durationMs || 120000) / 1000;
    set({ playhead: Math.max(0, Math.min(time, maxSec)) });
  },

  stepFrames: (frames) => {
    const { playhead, project } = get();
    const frameDelta = frames / project.fps;
    const maxSec = (project.durationMs || 120000) / 1000;
    set({ playhead: Math.max(0, Math.min(playhead + frameDelta, maxSec)) });
  },

  setIsPlaying: (isPlaying) => set({ isPlaying }),
  togglePlayPause: () => set((state) => ({ isPlaying: !state.isPlaying })),

  setZoom: (zoom) => set({ zoom: Math.max(0.05, Math.min(zoom, 400)) }),
  zoomIn: () => set((state) => ({ zoom: Math.min(state.zoom * 1.25, 400) })),
  zoomOut: () => set((state) => ({ zoom: Math.max(state.zoom / 1.25, 0.05) })),

  // Media Pool & Bins
  setActiveBinId: (activeBinId) => set({ activeBinId }),

  createBin: (name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const newBin: MediaBin = {
      id: `bin-${Date.now()}`,
      name: trimmed,
      color: '#00F0FF',
    };
    set((state) => ({
      bins: [...state.bins, newBin],
      activeBinId: newBin.id,
    }));
  },

  renameBin: (binId, name) => {
    if (binId === 'all') return;
    set((state) => ({
      bins: state.bins.map((b) => (b.id === binId ? { ...b, name } : b)),
    }));
  },

  deleteBin: (binId) => {
    if (binId === 'all') return;
    set((state) => ({
      bins: state.bins.filter((b) => b.id !== binId),
      activeBinId: state.activeBinId === binId ? 'all' : state.activeBinId,
      assets: state.assets.map((a) => (a.binId === binId ? { ...a, binId: 'all' } : a)),
    }));
  },

  moveAssetToBin: (assetId, binId) => {
    set((state) => ({
      assets: state.assets.map((a) => (a.id === assetId ? { ...a, binId: binId === 'all' ? undefined : binId } : a)),
    }));
  },

  importFiles: (files) => {
    const { activeBinId } = get();
    const targetBin = activeBinId === 'all' ? undefined : activeBinId;
    const newAssets: MediaAsset[] = [];

    Array.from(files).forEach((file, index) => {
      const isAudio = file.type.startsWith('audio') || file.name.endsWith('.wav') || file.name.endsWith('.mp3');
      const ext = file.name.split('.').pop()?.toUpperCase() || 'MOV';
      const durationSec = 30 + (index % 5) * 15;

      newAssets.push({
        id: `asset-${Date.now()}-${index}`,
        name: file.name,
        filePath: (file as any).path || `D:/Recordings/Imported/${file.name}`,
        mediaType: isAudio ? 'audio' : 'video',
        durationSeconds: durationSec,
        durationMs: durationSec * 1000,
        binId: targetBin,
        thumbnailUrl: isAudio
          ? ''
          : `https://images.unsplash.com/photo-${1500000000000 + (index * 12345678) % 500000000}?w=320&auto=format&fit=crop&q=60`,
        width: isAudio ? undefined : 3840,
        height: isAudio ? undefined : 2160,
        framerate: isAudio ? undefined : 30,
        sampleRate: isAudio ? 48000 : undefined,
        fileSizeBytes: file.size || 150000000,
        creationTime: new Date().toISOString(),
        hasProxy: false,
        proxyPath: undefined,
      });
    });

    set((state) => ({
      assets: [...state.assets, ...newAssets],
    }));
  },

  importFromNativePaths: async (paths) => {
    if (paths.length === 0) return;
    const { activeBinId, assets } = get();
    const targetBin = activeBinId === 'all' ? undefined : activeBinId;

    // Call ffprobe sidecar via Tauri IPC to inspect metadata
    let metadatas: ClipMetadata[] = [];
    try {
      const res = await tauriInvoke<ClipMetadata[]>('get_clip_metadata', { paths });
      if (res && res.length === paths.length) {
        metadatas = res;
      }
    } catch {
      // fallback if IPC fails
    }

    const newAssets: MediaAsset[] = paths.map((filePath, index) => {
      const fileName = filePath.split(/[\\/]/).pop() || filePath;
      const isAudio = /\.(wav|mp3|aac|m4a|flac|ogg)$/i.test(fileName);
      const meta = metadatas[index] || {};
      const durSec = meta.durationSeconds && meta.durationSeconds > 0 ? meta.durationSeconds : 30.0;

      return {
        id: `asset-native-${Date.now()}-${index}`,
        name: fileName,
        filePath,
        mediaType: isAudio ? 'audio' : 'video',
        durationSeconds: durSec,
        durationMs: Math.round(durSec * 1000),
        binId: targetBin,
        thumbnailUrl: isAudio
          ? undefined
          : `https://images.unsplash.com/photo-${1500000000000 + (index * 9876543) % 500000000}?w=320&auto=format&fit=crop&q=60`,
        width: meta.width || (isAudio ? undefined : 3840),
        height: meta.height || (isAudio ? undefined : 2160),
        framerate: meta.framerate || (isAudio ? undefined : 30.0),
        sampleRate: meta.sampleRate || (isAudio ? 48000 : undefined),
        fileSizeBytes: meta.fileSizeBytes || 150000000,
        creationTime: meta.creationTime || new Date().toISOString(),
        hasProxy: false,
        proxyPath: undefined,
      };
    });

    set({ assets: [...assets, ...newAssets] });

    // Check existing proxies and trigger auto-generation ONLY if explicitly opted in
    const { generateClipProxy, checkClipProxy } = get();
    const autoGen =
      (typeof window !== 'undefined' && Boolean((window as any).__IDTS_AUTO_GEN_PROXIES__)) ||
      Boolean(useShortcutStore.getState().autoGenerateProxies);

    for (const asset of newAssets) {
      if (asset.mediaType === 'video') {
        checkClipProxy(asset.filePath).then((existing) => {
          if (!existing && autoGen) {
            generateClipProxy(asset.filePath);
          }
        });
      }
    }
  },

  importCustomAsset: (assetData) => {
    const { activeBinId } = get();
    const newAsset: MediaAsset = {
      id: assetData.id || `asset-${Date.now()}`,
      name: assetData.name || 'Untitled Clip',
      filePath: assetData.filePath || `D:/Footage/${assetData.name}`,
      mediaType: assetData.mediaType || 'video',
      durationSeconds: assetData.durationSeconds || 30.0,
      durationMs: (assetData.durationSeconds || 30.0) * 1000,
      binId: assetData.binId || (activeBinId === 'all' ? undefined : activeBinId),
      thumbnailUrl: assetData.thumbnailUrl,
      width: assetData.width || 3840,
      height: assetData.height || 2160,
      framerate: assetData.framerate || 30,
      sampleRate: assetData.sampleRate,
      fileSizeBytes: assetData.fileSizeBytes,
      creationTime: assetData.creationTime || new Date().toISOString(),
    };

    set((state) => ({ assets: [...state.assets, newAsset] }));
  },

  deleteAsset: (assetId) => {
    set((state) => ({
      assets: state.assets.filter((a) => a.id !== assetId),
      selectedAssetId: state.selectedAssetId === assetId ? null : state.selectedAssetId,
    }));
  },

  selectAsset: (selectedAssetId) => set({ selectedAssetId }),
  setDraggedAsset: (draggedAsset) => set({ draggedAsset }),
  setActiveDragAsset: (activeDragAsset) => set({ activeDragAsset }),

  addAssetToTrack: (assetId, trackId, targetSeconds) => {
    const { assets, tracks, playhead } = get();
    const asset = assets.find((a) => a.id === assetId);
    if (!asset) return;

    const track = tracks.find((t) => t.id === trackId);
    if (!track) return;

    const startSec = targetSeconds !== undefined ? targetSeconds : playhead;
    const durSec = asset.durationSeconds || 30.0;

    const newClip: Clip = {
      id: `clip-${Date.now()}`,
      trackId: track.id,
      name: asset.name,
      filePath: asset.filePath,
      mediaType: asset.mediaType,
      startTimeMs: Math.round(startSec * 1000),
      durationMs: Math.round(durSec * 1000),
      sourceOffsetMs: 0,
      synced: false,
      isSynced: false,
      startPositionSeconds: startSec,
      durationSeconds: durSec,
      inPointSeconds: 0,
      outPointSeconds: durSec,
      syncDeltaSeconds: undefined,
      hasProxy: Boolean(asset.hasProxy),
      proxyPath: asset.proxyPath,
      metadata: {
        durationSeconds: durSec,
        width: asset.width,
        height: asset.height,
        framerate: asset.framerate,
        sampleRate: asset.sampleRate,
        codec: asset.mediaType === 'audio' ? 'pcm_s24le' : 'h264_nvenc',
        creationTime: asset.creationTime,
      },
    };

    set((state) => {
      const updatedTracks = state.tracks.map((t) => {
        if (t.id === trackId) {
          const newClips = [...t.clips, newClip];
          return {
            ...t,
            clips: newClips,
            timeOffsetSeconds:
              newClips.length > 0 ? Math.min(...newClips.map((c) => c.startPositionSeconds ?? 0)) : 0,
          };
        }
        return t;
      });

      // Recalculate project duration if needed
      const maxClipEnd = Math.max(
        ...updatedTracks.flatMap((t) => t.clips).map((c) => (c.startPositionSeconds || 0) + (c.durationSeconds || 0)),
        120
      );

      return {
        tracks: updatedTracks,
        selectedClipId: newClip.id,
        selectedTrackId: track.id,
        project: {
          ...state.project,
          durationMs: Math.max(state.project.durationMs, Math.round(maxClipEnd * 1000)),
        },
      };
    });
  },

  // Dynamic Tracks Management
  addTrack: (trackType, customName) => {
    get().pushHistory();
    const { tracks } = get();
    const id = `track-${trackType[0]}-${Date.now().toString(36)}`;
    const count = tracks.filter((t) => (t.trackType || t.type) === trackType).length + 1;
    const name = customName || (trackType === 'video' ? `Track ${count}` : `Audio ${count}`);
    const color =
      trackType === 'video'
        ? VIDEO_COLORS[(count - 1) % VIDEO_COLORS.length]
        : AUDIO_COLORS[(count - 1) % AUDIO_COLORS.length];

    const newTrack: MediaTrack = {
      id,
      name,
      trackType,
      type: trackType,
      color,
      muted: false,
      isMuted: false,
      solo: false,
      isSolo: false,
      locked: false,
      isLocked: false,
      visible: true,
      isVisible: true,
      volume: 1.0,
      pan: 0,
      timeOffsetSeconds: 0,
      clips: [],
    };

    set((state) => ({
      tracks: [...state.tracks, newTrack],
      selectedTrackId: newTrack.id,
    }));

    return id;
  },

  removeTrack: (trackId) => {
    get().pushHistory();
    set((state) => ({
      tracks: state.tracks.filter((t) => t.id !== trackId),
      selectedTrackId: state.selectedTrackId === trackId ? null : state.selectedTrackId,
    }));
  },

  toggleTrackVisibility: (trackId) => {
    set((state) => ({
      tracks: state.tracks.map((t) =>
        t.id === trackId
          ? {
              ...t,
              visible: t.visible !== undefined ? !t.visible : false,
              isVisible: t.isVisible !== undefined ? !t.isVisible : false,
            }
          : t
      ),
    }));
  },

  toggleMute: (trackId) => {
    set((state) => ({
      tracks: state.tracks.map((t) =>
        t.id === trackId
          ? {
              ...t,
              muted: !t.muted,
              isMuted: !t.isMuted,
            }
          : t
      ),
    }));
  },

  toggleSolo: (trackId) => {
    set((state) => ({
      tracks: state.tracks.map((t) =>
        t.id === trackId
          ? {
              ...t,
              solo: !t.solo,
              isSolo: !t.isSolo,
            }
          : t
      ),
    }));
  },

  toggleLock: (trackId) => {
    set((state) => ({
      tracks: state.tracks.map((t) =>
        t.id === trackId
          ? {
              ...t,
              locked: !t.locked,
              isLocked: !t.isLocked,
            }
          : t
      ),
    }));
  },

  renameTrack: (trackId, name) => {
    set((state) => ({
      tracks: state.tracks.map((t) => (t.id === trackId ? { ...t, name } : t)),
    }));
  },

  selectTrack: (selectedTrackId) => set({ selectedTrackId }),

  // Clip manipulation
  moveClip: (clipId, newStartPositionSec, targetTrackId) => {
    set((state) => {
      const sanitizedStart = Math.max(0, newStartPositionSec);
      let foundClip: Clip | null = null;

      // Locate clip
      for (const track of state.tracks) {
        const c = track.clips.find((item) => item.id === clipId);
        if (c) {
          foundClip = { ...c };
          break;
        }
      }

      if (!foundClip) return state;

      const updatedTracks = state.tracks.map((track) => {
        // If moving across tracks
        if (targetTrackId && targetTrackId !== foundClip!.trackId) {
          if (track.id === foundClip!.trackId) {
            return {
              ...track,
              clips: track.clips.filter((c) => c.id !== clipId),
            };
          }
          if (track.id === targetTrackId) {
            return {
              ...track,
              clips: [
                ...track.clips.filter((c) => c.id !== clipId),
                {
                  ...foundClip!,
                  trackId: targetTrackId,
                  startPositionSeconds: sanitizedStart,
                  startTimeMs: Math.round(sanitizedStart * 1000),
                },
              ],
            };
          }
          return track;
        }

        // Same track movement
        return {
          ...track,
          clips: track.clips.map((clip) =>
            clip.id === clipId
              ? {
                  ...clip,
                  startPositionSeconds: sanitizedStart,
                  startTimeMs: Math.round(sanitizedStart * 1000),
                }
              : clip
          ),
        };
      });

      // Ensure every track's timeOffsetSeconds matches its earliest clip
      const finalTracks = updatedTracks.map((t) => ({
        ...t,
        timeOffsetSeconds:
          t.clips.length > 0 ? Math.min(...t.clips.map((c) => c.startPositionSeconds ?? 0)) : 0,
      }));

      // Automatically recalculate project duration if clip is moved past current bounds
      const maxClipEnd = Math.max(
        ...finalTracks.flatMap((t) => t.clips).map((c) => (c.startPositionSeconds || 0) + (c.durationSeconds || 0)),
        120
      );

      return {
        tracks: finalTracks,
        project: {
          ...state.project,
          durationMs: Math.max(state.project.durationMs, Math.round(maxClipEnd * 1000)),
        },
      };
    });
  },

  trimClip: (clipId, newInSec, newOutSec, newStartSec) => {
    set((state) => ({
      tracks: state.tracks.map((track) => ({
        ...track,
        clips: track.clips.map((clip) => {
          if (clip.id === clipId) {
            const inSec = Math.max(0, newInSec);
            const outSec = Math.max(inSec + 0.1, newOutSec);
            const durationSec = outSec - inSec;
            const startSec = newStartSec !== undefined ? Math.max(0, newStartSec) : clip.startPositionSeconds || 0;
            return {
              ...clip,
              inPointSeconds: inSec,
              outPointSeconds: outSec,
              startPositionSeconds: startSec,
              startTimeMs: Math.round(startSec * 1000),
              durationSeconds: durationSec,
              durationMs: Math.round(durationSec * 1000),
            };
          }
          return clip;
        }),
      })),
    }));
  },

  trimClipLeft: (
    clipId,
    deltaSeconds,
    initialStartSec,
    initialInSec,
    initialDurSec,
    speed = 1.0
  ) => {
    set((state) => {
      let shiftDelta = 0;
      let clipStartSec = 0;
      let clipEndSec = 0;
      let targetTrackId = '';

      for (const t of state.tracks) {
        const c = t.clips.find((item) => item.id === clipId);
        if (c) {
          targetTrackId = t.id;
          const curIn = initialInSec !== undefined ? initialInSec : (c.inPointSeconds || 0);
          const curDur = initialDurSec !== undefined ? initialDurSec : (c.durationSeconds || 10);
          const curStart = initialStartSec !== undefined ? initialStartSec : (c.startPositionSeconds || 0);
          const clipSpeed = c.speedProfile?.speedMultiplier ?? speed;

          const maxDelta = Math.max(0, curDur - 0.1);
          const minDelta = -(curIn / clipSpeed);
          const clampedDelta = Math.max(minDelta, Math.min(deltaSeconds, maxDelta));
          shiftDelta = clampedDelta;
          clipStartSec = curStart;
          clipEndSec = curStart + curDur;
          break;
        }
      }

      return {
        tracks: state.tracks.map((track) => {
          const isAffectedTrack = state.isRippleMode
            ? !track.locked && !track.isLocked
            : track.id === targetTrackId;

          if (!isAffectedTrack) return track;

          return {
            ...track,
            clips: track.clips.map((clip) => {
              if (clip.id === clipId) {
                const curIn = initialInSec !== undefined ? initialInSec : (clip.inPointSeconds || 0);
                const curDur = initialDurSec !== undefined ? initialDurSec : (clip.durationSeconds || 10);
                const curStart = initialStartSec !== undefined ? initialStartSec : (clip.startPositionSeconds || 0);
                const clipSpeed = clip.speedProfile?.speedMultiplier ?? speed;

                const maxDelta = Math.max(0, curDur - 0.1);
                const minDelta = -(curIn / clipSpeed);
                const clampedDelta = Math.max(minDelta, Math.min(deltaSeconds, maxDelta));

                const nextIn = Math.max(0, curIn + (clampedDelta * clipSpeed));
                const nextStart = state.isRippleMode ? curStart : Math.max(0, curStart + clampedDelta);
                const nextDur = Math.max(0.1, curDur - clampedDelta);
                const nextOut = nextIn + (nextDur * clipSpeed);

                return {
                  ...clip,
                  inPointSeconds: nextIn,
                  outPointSeconds: nextOut,
                  startPositionSeconds: nextStart,
                  startTimeMs: Math.round(nextStart * 1000),
                  durationSeconds: nextDur,
                  durationMs: Math.round(nextDur * 1000),
                };
              }

              if (state.isRippleMode) {
                const cStart = clip.startPositionSeconds || 0;
                if (cStart >= clipEndSec - 0.05) {
                  const newStart = Math.max(0, cStart - shiftDelta);
                  return {
                    ...clip,
                    startPositionSeconds: newStart,
                    startTimeMs: Math.round(newStart * 1000),
                  };
                }
              }

              return clip;
            }),
          };
        }),
        isDirty: true,
      };
    });
  },

  trimClipRight: (
    clipId,
    deltaSeconds,
    initialDurSec,
    initialInSec,
    speed = 1.0
  ) => {
    set((state) => {
      let shiftDelta = 0;
      let clipEndSec = 0;
      let targetTrackId = '';

      for (const t of state.tracks) {
        const c = t.clips.find((item) => item.id === clipId);
        if (c) {
          targetTrackId = t.id;
          const curIn = initialInSec !== undefined ? initialInSec : (c.inPointSeconds || 0);
          const curDur = initialDurSec !== undefined ? initialDurSec : (c.durationSeconds || 10);
          const clipStart = c.startPositionSeconds || 0;
          const clipSpeed = c.speedProfile?.speedMultiplier ?? speed;

          const sourceDur =
            c.metadata?.durationSeconds ||
            state.assets.find((a) => a.filePath === c.filePath)?.durationSeconds ||
            7200;
          const maxTimelineDur = Math.max(curDur, (sourceDur - curIn) / clipSpeed);
          const nextDur = Math.max(0.1, Math.min(maxTimelineDur, curDur + deltaSeconds));
          shiftDelta = nextDur - curDur;
          clipEndSec = clipStart + curDur;
          break;
        }
      }

      return {
        tracks: state.tracks.map((track) => {
          const isAffectedTrack = state.isRippleMode
            ? !track.locked && !track.isLocked
            : track.id === targetTrackId;

          if (!isAffectedTrack) return track;

          return {
            ...track,
            clips: track.clips.map((clip) => {
              if (clip.id === clipId) {
                const curIn = initialInSec !== undefined ? initialInSec : (clip.inPointSeconds || 0);
                const curDur = initialDurSec !== undefined ? initialDurSec : (clip.durationSeconds || 10);
                const clipSpeed = clip.speedProfile?.speedMultiplier ?? speed;

                const sourceDur =
                  clip.metadata?.durationSeconds ||
                  state.assets.find((a) => a.filePath === clip.filePath)?.durationSeconds ||
                  7200;
                const maxTimelineDur = Math.max(curDur, (sourceDur - curIn) / clipSpeed);
                const nextDur = Math.max(0.1, Math.min(maxTimelineDur, curDur + deltaSeconds));
                const nextOut = Math.min(sourceDur, curIn + (nextDur * clipSpeed));

                return {
                  ...clip,
                  outPointSeconds: nextOut,
                  durationSeconds: nextDur,
                  durationMs: Math.round(nextDur * 1000),
                };
              }

              if (state.isRippleMode) {
                const cStart = clip.startPositionSeconds || 0;
                if (cStart >= clipEndSec - 0.05) {
                  const newStart = Math.max(0, cStart + shiftDelta);
                  return {
                    ...clip,
                    startPositionSeconds: newStart,
                    startTimeMs: Math.round(newStart * 1000),
                  };
                }
              }

              return clip;
            }),
          };
        }),
        isDirty: true,
      };
    });
  },

  stretchClip: (
    clipId,
    newDurSec,
    newStartSec,
    pitchCorrection = true
  ) => {
    set((state) => {
      let shiftDelta = 0;
      let clipEndSec = 0;
      let targetTrackId = '';

      for (const t of state.tracks) {
        const c = t.clips.find((item) => item.id === clipId);
        if (c) {
          targetTrackId = t.id;
          const curDur = c.durationSeconds || (c.durationMs ? c.durationMs / 1000 : 10);
          const curStart = c.startPositionSeconds || 0;
          const clampedDur = Math.max(0.1, newDurSec);
          shiftDelta = clampedDur - curDur;
          clipEndSec = curStart + curDur;
          break;
        }
      }

      return {
        tracks: state.tracks.map((track) => {
          const isAffectedTrack = state.isRippleMode
            ? !track.locked && !track.isLocked
            : track.id === targetTrackId;

          if (!isAffectedTrack) return track;

          return {
            ...track,
            clips: track.clips.map((clip) => {
              if (clip.id === clipId) {
                const currentSpeed = clip.speedProfile?.speedMultiplier ?? 1.0;
                const sourceSpan =
                  clip.outPointSeconds != null && clip.inPointSeconds != null && clip.outPointSeconds > clip.inPointSeconds
                    ? clip.outPointSeconds - clip.inPointSeconds
                    : (clip.durationSeconds || (clip.durationMs ? clip.durationMs / 1000 : 10)) * currentSpeed;

                const clampedDur = Math.max(0.1, newDurSec);
                const newSpeed = Math.max(0.1, Math.min(16.0, Number((sourceSpan / clampedDur).toFixed(3))));
                const startSec = newStartSec !== undefined ? Math.max(0, newStartSec) : (clip.startPositionSeconds || 0);

                return {
                  ...clip,
                  startPositionSeconds: startSec,
                  startTimeMs: Math.round(startSec * 1000),
                  durationSeconds: clampedDur,
                  durationMs: Math.round(clampedDur * 1000),
                  speedProfile: {
                    speedMultiplier: newSpeed,
                    pitchCorrection,
                  },
                };
              }

              if (state.isRippleMode) {
                const cStart = clip.startPositionSeconds || 0;
                if (cStart >= clipEndSec - 0.05) {
                  const newStart = Math.max(0, cStart + shiftDelta);
                  return {
                    ...clip,
                    startPositionSeconds: newStart,
                    startTimeMs: Math.round(newStart * 1000),
                  };
                }
              }

              return clip;
            }),
          };
        }),
        isDirty: true,
      };
    });
  },

  splitClipAtPlayhead: (targetClipId) => {
    const { playhead, tracks, selectedClipId } = get();
    const clipId = targetClipId || selectedClipId;
    if (!clipId) return;

    get().pushHistory();

    set((state) => {
      const updatedTracks = state.tracks.map((track) => {
        const clipIdx = track.clips.findIndex((c) => c.id === clipId);
        if (clipIdx === -1) return track;

        const clip = track.clips[clipIdx];
        const clipStart = clip.startPositionSeconds || 0;
        const clipDur = clip.durationSeconds || 0;
        const clipEnd = clipStart + clipDur;

        // Ensure playhead splits inside the clip
        if (playhead <= clipStart + 0.1 || playhead >= clipEnd - 0.1) return track;

        const splitOffsetSec = playhead - clipStart;
        const firstPart: Clip = {
          ...clip,
          durationSeconds: splitOffsetSec,
          durationMs: Math.round(splitOffsetSec * 1000),
          outPointSeconds: (clip.inPointSeconds || 0) + splitOffsetSec,
        };

        const secondPart: Clip = {
          ...clip,
          id: `clip-${Date.now()}`,
          name: `${clip.name} (Part 2)`,
          startPositionSeconds: playhead,
          startTimeMs: Math.round(playhead * 1000),
          inPointSeconds: (clip.inPointSeconds || 0) + splitOffsetSec,
          durationSeconds: clipDur - splitOffsetSec,
          durationMs: Math.round((clipDur - splitOffsetSec) * 1000),
        };

        const newClips = [...track.clips];
        newClips.splice(clipIdx, 1, firstPart, secondPart);
        return { ...track, clips: newClips };
      });

      return { tracks: updatedTracks };
    });
  },

  deleteClip: (clipId) => {
    const { selectedClipIds } = get();
    const idsToDelete =
      selectedClipIds.length > 1 && selectedClipIds.includes(clipId)
        ? selectedClipIds
        : [clipId];

    get().pushHistory();
    set((state) => ({
      tracks: state.tracks.map((t) => {
        const remainingClips = t.clips.filter((c) => !idsToDelete.includes(c.id));
        return {
          ...t,
          clips: remainingClips,
          timeOffsetSeconds:
            remainingClips.length > 0
              ? Math.min(...remainingClips.map((c) => c.startPositionSeconds ?? 0))
              : 0,
        };
      }),
      selectedClipId: null,
      selectedClipIds: [],
      isDirty: true,
    }));
  },

  deleteSelectedClips: () => {
    const { selectedClipIds, selectedClipId } = get();
    const idsToDelete =
      selectedClipIds.length > 0
        ? selectedClipIds
        : selectedClipId
        ? [selectedClipId]
        : [];
    if (idsToDelete.length === 0) return;

    get().pushHistory();
    set((state) => ({
      tracks: state.tracks.map((t) => {
        const remainingClips = t.clips.filter((c) => !idsToDelete.includes(c.id));
        return {
          ...t,
          clips: remainingClips,
          timeOffsetSeconds:
            remainingClips.length > 0
              ? Math.min(...remainingClips.map((c) => c.startPositionSeconds ?? 0))
              : 0,
        };
      }),
      selectedClipId: null,
      selectedClipIds: [],
      isDirty: true,
    }));
  },

  selectClip: (selectedClipId, isMulti = false) => {
    if (!selectedClipId) {
      set({ selectedClipId: null, selectedClipIds: [] });
      return;
    }
    const { selectedClipIds, tracks, playhead } = get();
    if (isMulti) {
      const nextIds = selectedClipIds.includes(selectedClipId)
        ? selectedClipIds.filter((id) => id !== selectedClipId)
        : [...selectedClipIds, selectedClipId];
      set({
        selectedClipId,
        selectedClipIds: nextIds,
      });
    } else {
      set({
        selectedClipId,
        selectedClipIds: [selectedClipId],
      });
    }
    const parentTrack = tracks.find((t) => t.clips.some((c) => c.id === selectedClipId));
    if (parentTrack) {
      const targetClip = parentTrack.clips.find((c) => c.id === selectedClipId);
      const updates: any = { selectedTrackId: parentTrack.id };
      if (targetClip) {
        const startSec = targetClip.startPositionSeconds ?? (targetClip.startTimeMs ? targetClip.startTimeMs / 1000 : 0);
        const durSec = targetClip.durationSeconds ?? (targetClip.durationMs ? targetClip.durationMs / 1000 : 10);
        if (playhead < startSec || playhead >= startSec + durSec) {
          updates.playhead = startSec;
        }
      }
      set(updates);
    }
  },

  selectClips: (selectedClipIds) => {
    set({
      selectedClipIds,
      selectedClipId: selectedClipIds.length > 0 ? selectedClipIds[selectedClipIds.length - 1] : null,
    });
    if (selectedClipIds.length > 0) {
      const { tracks } = get();
      const lastId = selectedClipIds[selectedClipIds.length - 1];
      const parentTrack = tracks.find((t) => t.clips.some((c) => c.id === lastId));
      if (parentTrack) {
        set({ selectedTrackId: parentTrack.id });
      }
    }
  },

  moveMultipleClips: (moves) => {
    set((state) => {
      const moveMap = new Map(moves.map((m) => [m.clipId, m.newStartSec]));
      let maxClipEnd = 0;

      const updatedTracks = state.tracks.map((track) => {
        const updatedClips = track.clips.map((clip) => {
          if (moveMap.has(clip.id)) {
            const newStart = Math.max(0, moveMap.get(clip.id)!);
            const durSec = clip.durationSeconds || 10;
            if (newStart + durSec > maxClipEnd) {
              maxClipEnd = newStart + durSec;
            }
            return {
              ...clip,
              startPositionSeconds: newStart,
              startTimeMs: Math.round(newStart * 1000),
            };
          }
          const cEnd = (clip.startPositionSeconds || 0) + (clip.durationSeconds || 10);
          if (cEnd > maxClipEnd) maxClipEnd = cEnd;
          return clip;
        });

        return {
          ...track,
          clips: updatedClips,
          timeOffsetSeconds:
            updatedClips.length > 0
              ? Math.min(...updatedClips.map((c) => c.startPositionSeconds ?? 0))
              : 0,
        };
      });

      return {
        tracks: updatedTracks,
        isDirty: true,
        project: {
          ...state.project,
          durationMs: Math.max(state.project.durationMs, Math.round(maxClipEnd * 1000)),
        },
      };
    });
  },

  extractAudioFromClip: (clipId: string) => {
    const state = get();
    let foundClip: Clip | null = null;
    let sourceTrack: MediaTrack | null = null;

    for (const track of state.tracks) {
      const c = track.clips.find((item) => item.id === clipId);
      if (c) {
        foundClip = c;
        sourceTrack = track;
        break;
      }
    }

    if (!foundClip || !sourceTrack) return;
    if (sourceTrack.trackType === 'audio' || sourceTrack.type === 'audio') return;
    if (foundClip.audioExtracted) return;

    state.pushHistory();

    const audioTracks = state.tracks.filter((t) => (t.trackType || t.type) === 'audio');
    let targetTrackId = audioTracks.find((t) => !t.locked)?.id;

    let updatedTracks = [...state.tracks];

    if (!targetTrackId) {
      // Create new audio track dynamically
      const count = audioTracks.length + 1;
      targetTrackId = `track-a-${Date.now().toString(36)}`;
      const newAudioTrack: MediaTrack = {
        id: targetTrackId,
        name: `Audio ${count}`,
        trackType: 'audio',
        type: 'audio',
        muted: false,
        solo: false,
        locked: false,
        clips: [],
      };
      updatedTracks.push(newAudioTrack);
    }

    const startSec = foundClip.startPositionSeconds ?? foundClip.startTimeMs / 1000;
    const durSec = foundClip.durationSeconds ?? foundClip.durationMs / 1000;

    const extractedAudioClip: Clip = {
      id: `clip-audio-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
      trackId: targetTrackId,
      name: `${foundClip.name.replace(/\.[^/.]+$/, '')} (Audio)`,
      filePath: foundClip.filePath,
      startTimeMs: foundClip.startTimeMs,
      durationMs: foundClip.durationMs,
      sourceOffsetMs: foundClip.sourceOffsetMs,
      synced: foundClip.synced,
      mediaType: 'audio',
      inPointSeconds: foundClip.inPointSeconds ?? 0,
      outPointSeconds: foundClip.outPointSeconds ?? durSec,
      startPositionSeconds: startSec,
      durationSeconds: durSec,
      isSynced: foundClip.isSynced,
      syncDeltaSeconds: foundClip.syncDeltaSeconds,
      waveformPeaks: foundClip.waveformPeaks,
      metadata: foundClip.metadata ? { ...foundClip.metadata } : undefined,
      hasAudio: true,
    };

    set({
      tracks: updatedTracks.map((t) => {
        if (t.id === sourceTrack!.id) {
          return {
            ...t,
            clips: t.clips.map((c) =>
              c.id === clipId ? { ...c, audioExtracted: true, hasAudio: false } : c
            ),
          };
        }
        if (t.id === targetTrackId) {
          return {
            ...t,
            clips: [...t.clips, extractedAudioClip],
          };
        }
        return t;
      }),
      isDirty: true,
      selectedClipId: extractedAudioClip.id,
    });

    updateAppTitle(state.project.name || 'Untitled Project', true, state.currentProjectPath);
  },

  duplicateClip: (clipId: string) => {
    const state = get();
    let foundClip: Clip | null = null;
    let sourceTrack: MediaTrack | null = null;

    for (const track of state.tracks) {
      const c = track.clips.find((item) => item.id === clipId);
      if (c) {
        foundClip = c;
        sourceTrack = track;
        break;
      }
    }

    if (!foundClip || !sourceTrack) return;
    state.pushHistory();

    const startSec = (foundClip.startPositionSeconds ?? 0) + (foundClip.durationSeconds ?? 5);
    const dupClip: Clip = {
      ...foundClip,
      id: `clip-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
      startPositionSeconds: startSec,
      startTimeMs: Math.round(startSec * 1000),
      name: `${foundClip.name} (Copy)`,
    };

    set({
      tracks: state.tracks.map((t) =>
        t.id === sourceTrack!.id ? { ...t, clips: [...t.clips, dupClip] } : t
      ),
      isDirty: true,
      selectedClipId: dupClip.id,
    });

    updateAppTitle(state.project.name || 'Untitled Project', true, state.currentProjectPath);
  },

  // Track-Level Multi-Sync Action with Configurable Idle Gap Placement
  syncAllTracks: (options) => {
    const { tracks, syncPlacementMode, syncGapCushionSec } = get();
    const pattern = typeof options === 'string' ? options : options?.pattern;
    const placementMode =
      (typeof options === 'object' && options?.placementMode) || syncPlacementMode || 'compact';
    const cushionSec =
      typeof options === 'object' && options?.gapCushionSec !== undefined
        ? options.gapCushionSec
        : syncGapCushionSec;

    interface ParsedItem {
      clip: Clip;
      trackId: string;
      startEpochMs: number;
      durationMs: number;
      endEpochMs: number;
    }

    const items: ParsedItem[] = [];

    // Parse timestamp for every clip placed across all active tracks
    tracks.forEach((track) => {
      track.clips.forEach((clip) => {
        const epoch =
          parseFilenameToEpoch(clip.name, pattern) || parseFilenameToEpoch(clip.filePath, pattern);
        if (epoch !== null) {
          const durMs =
            clip.durationMs || (clip.durationSeconds ? Math.round(clip.durationSeconds * 1000) : 30000);
          items.push({
            clip,
            trackId: track.id,
            startEpochMs: epoch,
            durationMs: durMs,
            endEpochMs: epoch + durMs,
          });
        }
      });
    });

    if (items.length === 0) {
      return {
        success: false,
        message: 'No camera timestamps detected in current clips. Use presets or custom pattern.',
        count: 0,
      };
    }

    // Sort all clips chronologically by recording start time
    items.sort((a, b) => a.startEpochMs - b.startEpochMs);

    const earliestEpoch = items[0].startEpochMs;
    const clipCalculatedStarts: Record<string, number> = {};

    if (placementMode === 'absolute') {
      // Wall-Clock Absolute: retain true real elapsed time between takes
      items.forEach((item) => {
        const deltaMs = Math.max(0, item.startEpochMs - earliestEpoch);
        clipCalculatedStarts[item.clip.id] = deltaMs / 1000;
      });
    } else {
      // Compact / Snap to Last Clip (Close Idle Gaps):
      // Gaps between multi-cam recording sessions exceeding threshold are snapped!
      const gapThresholdMs = placementMode === 'capped' ? Math.max(1000, cushionSec * 1000) : 10000;
      const cushionMs = Math.max(0, cushionSec * 1000);

      let currentClusterStartEpoch = items[0].startEpochMs;
      let currentClusterEndEpoch = items[0].endEpochMs;
      let clusterTimelineStartMs = 0;

      items.forEach((item, index) => {
        if (index === 0) {
          clipCalculatedStarts[item.clip.id] = 0;
          return;
        }

        const idleGapMs = item.startEpochMs - currentClusterEndEpoch;

        if (idleGapMs > gapThresholdMs) {
          // Idle dead gap detected where all cameras stopped recording!
          // Compress the gap: snap new session right after previous cluster + cushion
          const prevClusterDurationMs = currentClusterEndEpoch - currentClusterStartEpoch;
          clusterTimelineStartMs = clusterTimelineStartMs + prevClusterDurationMs + cushionMs;

          currentClusterStartEpoch = item.startEpochMs;
          currentClusterEndEpoch = item.endEpochMs;

          clipCalculatedStarts[item.clip.id] = clusterTimelineStartMs / 1000;
        } else {
          // Part of the same recording session / overlapping take
          currentClusterEndEpoch = Math.max(currentClusterEndEpoch, item.endEpochMs);
          const intraOffsetMs = item.startEpochMs - currentClusterStartEpoch;
          const timelinePosMs = clusterTimelineStartMs + intraOffsetMs;
          clipCalculatedStarts[item.clip.id] = timelinePosMs / 1000;
        }
      });
    }

    // Update tracks and clips
    const rawUpdatedTracks = tracks.map((track) => {
      const updatedClips = track.clips.map((clip) => {
        const calculatedStartSec = clipCalculatedStarts[clip.id];
        if (calculatedStartSec !== undefined) {
          return {
            ...clip,
            startTimeMs: Math.round(calculatedStartSec * 1000),
            startPositionSeconds: calculatedStartSec,
            synced: true,
            isSynced: true,
            syncDeltaSeconds: calculatedStartSec,
          };
        }
        return clip;
      });

      const earliestSec =
        updatedClips.length > 0
          ? Math.min(...updatedClips.map((c) => c.startPositionSeconds ?? 0))
          : 0;

      return {
        ...track,
        timeOffsetSeconds: earliestSec,
        clips: updatedClips,
      };
    });

    // Automatically resolve any overlapping clips on the same track by moving them to separate tracks!
    const { tracks: updatedTracks, movedCount } = resolveTrackOverlaps(rawUpdatedTracks);

    const maxEnd = Math.max(
      ...updatedTracks
        .flatMap((t) => t.clips)
        .map((c) => (c.startPositionSeconds || 0) + (c.durationSeconds || 0)),
      120
    );

    const modeLabel =
      placementMode === 'compact'
        ? `Snapped to Last Clip (${cushionSec}s cushion)`
        : placementMode === 'capped'
        ? `Capped Gaps (max ${cushionSec}s)`
        : 'Real-Time Wall Clock';

    const movedNotice =
      movedCount > 0 ? ` (${movedCount} overlapping clip${movedCount > 1 ? 's' : ''} moved to separate tracks)` : '';
    const message = `Synchronized ${items.length} clips with ${modeLabel}!${movedNotice}`;

    set({
      tracks: updatedTracks,
      lastSyncMessage: message,
      project: {
        ...get().project,
        durationMs: Math.round(maxEnd * 1000),
      },
    });

    return {
      success: true,
      message,
      count: items.length,
    };
  },

  executeTauriSync: async (customPattern) => {
    const { tracks, syncPlacementMode, syncGapCushionSec } = get();

    if (isTauri) {
      try {
        const cleanTracks = tracks.map(sanitizeTrackForIpc);
        const request: SyncRequest = {
          mode: 'filename',
          pattern: customPattern,
          tracks: cleanTracks,
          placementMode:
            syncPlacementMode === 'compact'
              ? 'compact'
              : syncPlacementMode === 'capped'
              ? 'custom_gap'
              : 'absolute',
          maxGapSeconds: syncGapCushionSec,
        };

        const offsets = await tauriInvoke<TrackSyncOffset[]>('sync_active_timeline', { request });
        if (offsets && offsets.length > 0) {
          let totalSynced = 0;

          set((state) => {
            // Index clip offsets returned by Rust backend
            const clipOffsetMap: Record<string, ClipSyncOffset> = {};
            offsets.forEach((to) => {
              to.clipOffsets?.forEach((co) => {
                clipOffsetMap[co.clipId] = co;
              });
            });

            const rawTracks = state.tracks.map((track) => {
              const syncOffset = offsets.find((o) => o.trackId === track.id);
              const updatedClips = track.clips.map((clip) => {
                const co = clipOffsetMap[clip.id];
                if (co) {
                  totalSynced++;
                  return {
                    ...clip,
                    startTimeMs: co.offsetMs,
                    startPositionSeconds: co.offsetSeconds,
                    synced: true,
                    isSynced: true,
                    syncDeltaSeconds: co.offsetSeconds,
                  };
                } else if (syncOffset && syncOffset.offsetSeconds !== undefined) {
                  totalSynced++;
                  return {
                    ...clip,
                    startTimeMs: syncOffset.offsetMs,
                    startPositionSeconds: syncOffset.offsetSeconds,
                    synced: true,
                    isSynced: true,
                    syncDeltaSeconds: syncOffset.offsetSeconds,
                  };
                }
                return clip;
              });

              // Track timeOffsetSeconds is always the start of the earliest clip on this track
              const earliestSec =
                updatedClips.length > 0
                  ? Math.min(...updatedClips.map((c) => c.startPositionSeconds ?? 0))
                  : syncOffset
                  ? syncOffset.offsetSeconds
                  : 0;

              return {
                ...track,
                timeOffsetSeconds: earliestSec,
                clips: updatedClips,
              };
            });

            const { tracks: updatedTracks, movedCount } = resolveTrackOverlaps(rawTracks);
            const maxEnd = Math.max(
              ...updatedTracks
                .flatMap((t) => t.clips)
                .map((c) => (c.startPositionSeconds || 0) + (c.durationSeconds || 0)),
              120
            );

            const movedNotice =
              movedCount > 0 ? ` (${movedCount} overlapping clip${movedCount > 1 ? 's' : ''} moved to separate tracks)` : '';
            const msg = `Backend synchronized ${totalSynced} clips across ${offsets.length} tracks (${syncPlacementMode} mode)${movedNotice}`;
            return {
              tracks: updatedTracks,
              lastSyncMessage: msg,
              project: {
                ...state.project,
                durationMs: Math.max(state.project.durationMs, Math.round(maxEnd * 1000)),
              },
            };
          });

          return {
            success: true,
            message: `Synchronized ${totalSynced} clips successfully`,
            count: totalSynced,
          };
        }
      } catch (err) {
        console.warn('Tauri sync IPC fallback to local:', err);
      }
    }

    // Fallback to sophisticated frontend take-clustering & gap snapping
    return get().syncAllTracks({ pattern: customPattern });
  },

  applySyncResults: (candidates) => {
    set((state) => {
      const rawTracks = state.tracks.map((track) => {
        const trackCandidates = candidates.filter((c) => c.trackId === track.id);
        if (trackCandidates.length === 0) return track;

        const updatedClips = track.clips.map((clip) => {
          const cand = trackCandidates.find((c) => c.clipId === clip.id);
          if (cand) {
            return {
              ...clip,
              startTimeMs: cand.calculatedOffsetMs || Math.round(cand.calculatedOffsetSeconds * 1000),
              startPositionSeconds: cand.calculatedOffsetSeconds,
              synced: true,
              isSynced: true,
              syncDeltaSeconds: cand.calculatedOffsetSeconds,
            };
          }
          return clip;
        });

        const earliestSec =
          updatedClips.length > 0
            ? Math.min(...updatedClips.map((c) => c.startPositionSeconds ?? 0))
            : 0;

        return {
          ...track,
          timeOffsetSeconds: earliestSec,
          clips: updatedClips,
        };
      });

      const { tracks: updatedTracks } = resolveTrackOverlaps(rawTracks);
      return { tracks: updatedTracks };
    });
  },

  setSyncModalOpen: (isSyncModalOpen) => set({ isSyncModalOpen }),

  // Returns the active topmost video clip covering the playhead position for the single Program Monitor canvas
  getActiveVideoClip: () => {
    const { tracks, playhead, activeCameraTrackId } = get();

    // Priority to active multicam track selection if it has a clip at current playhead
    if (activeCameraTrackId) {
      const activeTrack = tracks.find((t) => t.id === activeCameraTrackId);
      if (activeTrack && activeTrack.visible !== false && !activeTrack.muted) {
        let bestClip: Clip | null = null;
        for (let i = 0; i < activeTrack.clips.length; i++) {
          const clip = activeTrack.clips[i];
          const start = clip.startPositionSeconds || 0;
          const end = start + (clip.durationSeconds || 0);
          if (playhead >= start && playhead <= end) {
            if (!bestClip || start > (bestClip.startPositionSeconds || 0)) {
              bestClip = clip;
            }
          }
        }
        if (bestClip) {
          return { clip: bestClip, track: activeTrack };
        }
      }
    }

    // Top-to-bottom search for visible, unmuted video tracks
    for (const track of tracks) {
      const isVideo = track.trackType === 'video' || track.type === 'video';
      const isVisible = track.visible !== false && track.isVisible !== false;
      const isMuted = track.muted || track.isMuted;

      if (isVideo && isVisible && !isMuted) {
        let bestClip: Clip | null = null;
        for (let i = 0; i < track.clips.length; i++) {
          const clip = track.clips[i];
          const start = clip.startPositionSeconds || 0;
          const end = start + (clip.durationSeconds || 0);
          if (playhead >= start && playhead <= end) {
            if (!bestClip || start > (bestClip.startPositionSeconds || 0)) {
              bestClip = clip;
            }
          }
        }
        if (bestClip) {
          return { clip: bestClip, track };
        }
      }
    }

    // Fallback: Sub-frame boundary tolerance (0.05s) to eliminate micro-gap seams between snapped clips
    for (const track of tracks) {
      const isVideo = track.trackType === 'video' || track.type === 'video';
      const isVisible = track.visible !== false && track.isVisible !== false;
      const isMuted = track.muted || track.isMuted;

      if (isVideo && isVisible && !isMuted) {
        for (let i = 0; i < (track.clips || []).length; i++) {
          const clip = track.clips[i];
          const start = clip.startPositionSeconds || 0;
          const end = start + (clip.durationSeconds || 0);
          if (playhead >= start - 0.05 && playhead <= end + 0.05) {
            return { clip, track };
          }
        }
      }
    }

    return null;
  },

  // Milestone 4: Waveform cache and fetch
  waveformData: {},
  fetchWaveformData: async (filePath: string) => {
    if (!filePath) return [];
    const cached = get().waveformData[filePath];
    if (cached && cached.length > 0) return cached;

    if (isTauri) {
      try {
        const peaks = await tauriInvoke<number[]>('get_waveform_data', { path: filePath });
        if (peaks && peaks.length > 0) {
          set((state) => ({
            waveformData: { ...state.waveformData, [filePath]: peaks },
          }));
          return peaks;
        }
      } catch (err) {
        console.warn('Failed to fetch waveform from Tauri:', err);
      }
    }

    // Pseudo-waveform for non-tauri or fallback
    const pseudoPeaks: number[] = [];
    let hash = 0;
    for (let i = 0; i < filePath.length; i++) {
      hash = (hash << 5) - hash + filePath.charCodeAt(i);
      hash |= 0;
    }
    for (let i = 0; i < 150; i++) {
      const v = Math.abs(Math.sin((i + hash) * 0.12) * 0.65 + Math.cos(i * 0.35) * 0.25);
      pseudoPeaks.push(Math.min(1.0, Math.max(0.04, v)));
    }
    set((state) => ({
      waveformData: { ...state.waveformData, [filePath]: pseudoPeaks },
    }));
    return pseudoPeaks;
  },

  // Milestone 4: Multicam Mode & Angle Switching
  isMulticamActive: false,
  activeCameraTrackId: null,
  multicamSplitOnCut: true,
  toggleMulticamSplitOnCut: () => {
    set((state) => ({ multicamSplitOnCut: !state.multicamSplitOnCut }));
  },
  setMulticamSplitOnCut: (multicamSplitOnCut) => {
    set({ multicamSplitOnCut });
  },
  toggleMulticamActive: () => {
    set((state) => ({ isMulticamActive: !state.isMulticamActive }));
  },

  switchMulticamAngle: (angleIndex: number) => {
    const { tracks, playhead, multicamSplitOnCut } = get();
    const videoTracks = tracks.filter((t) => t.trackType === 'video' || t.type === 'video');
    if (angleIndex < 0 || angleIndex >= videoTracks.length) return;

    const targetTrack = videoTracks[angleIndex];

    // If split is disabled: purely switch active camera monitoring without splitting timeline clips
    if (!multicamSplitOnCut) {
      set({ activeCameraTrackId: targetTrack.id });
      return;
    }

    set((state) => {
      const now = Date.now();
      const updatedTracks = state.tracks.map((track) => {
        const isVideo = track.trackType === 'video' || track.type === 'video';
        if (!isVideo) return track;

        const clipIdx = track.clips.findIndex((c) => {
          const s = c.startPositionSeconds || 0;
          const e = s + (c.durationSeconds || 0);
          return playhead > s + 0.05 && playhead < e - 0.05;
        });

        if (clipIdx === -1) return track;

        const clip = track.clips[clipIdx];
        const clipStart = clip.startPositionSeconds || 0;
        const clipDur = clip.durationSeconds || 0;
        const splitOffsetSec = playhead - clipStart;

        // Part 1: before playhead
        const part1: Clip = {
          ...clip,
          durationSeconds: splitOffsetSec,
          durationMs: Math.round(splitOffsetSec * 1000),
          outPointSeconds: (clip.inPointSeconds || 0) + splitOffsetSec,
        };

        // Part 2: after playhead
        const part2: Clip = {
          ...clip,
          id: `clip-${now}-${track.id}`,
          startPositionSeconds: playhead,
          startTimeMs: Math.round(playhead * 1000),
          inPointSeconds: (clip.inPointSeconds || 0) + splitOffsetSec,
          durationSeconds: clipDur - splitOffsetSec,
          durationMs: Math.round((clipDur - splitOffsetSec) * 1000),
        };

        const newClips = [...track.clips];
        newClips.splice(clipIdx, 1, part1, part2);

        return {
          ...track,
          clips: newClips,
        };
      });

      return {
        tracks: updatedTracks,
        activeCameraTrackId: targetTrack.id,
      };
    });
  },

  // Milestone 4: Clip Inspector Adjustments
  updateClipAdjustments: (clipId, adjustments) => {
    set((state) => ({
      tracks: state.tracks.map((track) => ({
        ...track,
        clips: track.clips.map((clip) => {
          if (clip.id !== clipId) return clip;
          return {
            ...clip,
            ...adjustments,
          };
        }),
      })),
    }));
  },

  // Milestone 4: Audio Cross-Correlation Synchronization
  syncTracksByAudio: async (primaryTrackId: string, secondaryTrackId: string) => {
    const { tracks } = get();
    const trackA = tracks.find((t) => t.id === primaryTrackId);
    const trackB = tracks.find((t) => t.id === secondaryTrackId);

    if (!trackA || !trackB || !trackA.clips[0] || !trackB.clips[0]) {
      return { success: false, offsetMs: 0, message: 'Both tracks must contain at least one clip' };
    }

    const pathA = trackA.clips[0].filePath;
    const pathB = trackB.clips[0].filePath;

    if (isTauri) {
      try {
        const offsetMs = await tauriInvoke<number>('sync_by_audio', {
          trackAPath: pathA,
          trackBPath: pathB,
        });

        if (offsetMs !== null && offsetMs !== undefined) {
          const deltaSec = offsetMs / 1000.0;
          set((state) => ({
            tracks: state.tracks.map((t) => {
              if (t.id === secondaryTrackId) {
                return {
                  ...t,
                  timeOffsetSeconds: deltaSec,
                  clips: t.clips.map((c) => ({
                    ...c,
                    startPositionSeconds: Math.max(0, (c.startPositionSeconds || 0) + deltaSec),
                    isSynced: true,
                    synced: true,
                    syncDeltaSeconds: deltaSec,
                  })),
                };
              }
              return t;
            }),
          }));
          return {
            success: true,
            offsetMs,
            message: `Synced via audio cross-correlation: ${(deltaSec >= 0 ? '+' : '')}${deltaSec.toFixed(3)}s offset applied`,
          };
        }
      } catch (err: any) {
        return { success: false, offsetMs: 0, message: String(err) };
      }
    }

    return { success: false, offsetMs: 0, message: 'Audio sync requires Tauri desktop backend' };
  },

  startExport: async (config: ExportConfig) => {
    const { tracks, project } = get();
    set({
      isExporting: true,
      exportProgress: { percentage: 0, currentFrame: 0, fps: 0 },
      exportStatusMessage: 'Initializing export pipeline...',
    });

    const cleanTracks = (config.tracks || tracks).map(sanitizeTrackForIpc);
    const baseProject = config.project || project;
    const cleanProject: TimelineProject = {
      ...baseProject,
      tracks: (baseProject.tracks || []).map(sanitizeTrackForIpc),
    };

    const exportPayload: ExportConfig = {
      ...config,
      tracks: cleanTracks,
      project: cleanProject,
      width: config.width || project.width || 1920,
      height: config.height || project.height || 1080,
      fps: config.fps || project.fps || 30.0,
      codec: config.codec || 'h264_nvenc',
      denoiseEnabled: config.denoiseEnabled ?? false,
    };

    let unlisten: (() => void) | null = null;

    if (isTauri) {
      try {
        const { listen } = await import('@tauri-apps/api/event');
        unlisten = await listen<ExportProgress>('export-progress', (event) => {
          set({
            exportProgress: event.payload,
            exportStatusMessage: `Encoding frame ${event.payload.currentFrame} @ ${event.payload.fps.toFixed(1)} fps...`,
          });
        });

        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('render_project', { exportConfig: exportPayload });

        if (unlisten) unlisten();
        set({
          isExporting: false,
          exportProgress: { percentage: 100, currentFrame: 0, fps: 0 },
          exportStatusMessage: 'Export completed successfully!',
        });

        return { success: true, message: `Successfully rendered to ${config.outputPath}` };
      } catch (err: any) {
        if (unlisten) unlisten();
        const errMsg = err?.toString() || 'Unknown render error';
        console.error('[Render Error]:', errMsg);
        set({ isExporting: false, exportStatusMessage: `Export failed: ${errMsg}` });
        return { success: false, message: errMsg };
      }
    } else {
      // Browser preview simulated export loop
      return new Promise((resolve) => {
        let progress = 0;
        const totalFrames = Math.round(((project.durationMs || 60000) / 1000) * (exportPayload.fps || 30));
        const interval = setInterval(() => {
          progress += 5;
          const currentFrame = Math.round((progress / 100) * totalFrames);
          set({
            exportProgress: {
              percentage: progress,
              currentFrame,
              fps: 59.4,
              etaSeconds: Math.max(0, (100 - progress) * 0.12),
            },
            exportStatusMessage: `Simulated encoding frame ${currentFrame}/${totalFrames} @ 59.4 fps...`,
          });

          if (progress >= 100) {
            clearInterval(interval);
            set({
              isExporting: false,
              exportProgress: { percentage: 100, currentFrame: totalFrames, fps: 60, etaSeconds: 0 },
              exportStatusMessage: 'Export completed successfully!',
            });
            resolve({ success: true, message: `Render simulation finished: ${config.outputPath}` });
          }
        }, 100);
      });
    }
  },

  cancelExport: () => {
    set({ isExporting: false, exportProgress: null, exportStatusMessage: null });
  },

  resetToSampleData: () => {
    set({
      project: INITIAL_PROJECT,
      tracks: INITIAL_TRACKS,
      transitions: [],
      selectedTransitionId: null,
      activeDragTransition: null,
      bins: INITIAL_BINS,
      assets: INITIAL_ASSETS,
      playhead: 0,
      selectedClipId: null,
      selectedTrackId: 'track-v1',
      selectedAssetId: null,
      lastSyncMessage: null,
      isExportModalOpen: false,
      isExporting: false,
      exportProgress: null,
    });
  },

  // Milestone 5: Magnetic Snapping, Undo/Redo & Project Persistence (.idts)
  isSnappingEnabled: true,
  toggleSnapping: () => {
    set((state) => ({ isSnappingEnabled: !state.isSnappingEnabled }));
  },
  setSnappingEnabled: (isSnappingEnabled: boolean) => {
    set({ isSnappingEnabled });
  },

  calculateSnappedPosition: (
    proposedSec: number,
    clipDurationSec: number,
    excludeClipId?: string,
    zoom?: number
  ) => {
    const { tracks, playhead, isSnappingEnabled } = get();
    if (!isSnappingEnabled) return Math.max(0, proposedSec);

    const thresholdPx = 10;
    const effectiveZoom = zoom && zoom > 0 ? zoom : 50;
    const thresholdSec = Math.max(0.08, thresholdPx / effectiveZoom);

    // Anchor points: 0.0s, playhead, and all other clip boundaries
    const snapPoints: number[] = [0.0, playhead];
    for (const track of tracks) {
      for (const clip of track.clips) {
        if (clip.id === excludeClipId) continue;
        const s = clip.startPositionSeconds || 0;
        const e = s + (clip.durationSeconds || 0);
        snapPoints.push(s, e);
      }
    }

    let bestStart = proposedSec;
    let minDiff = thresholdSec;
    const proposedEnd = proposedSec + clipDurationSec;

    for (const point of snapPoints) {
      // 1. Check clip left edge snapping to point
      const diffLeft = Math.abs(proposedSec - point);
      if (diffLeft < minDiff) {
        minDiff = diffLeft;
        bestStart = point;
      }

      // 2. Check clip right edge snapping to point
      const diffRight = Math.abs(proposedEnd - point);
      if (diffRight < minDiff) {
        minDiff = diffRight;
        bestStart = Math.max(0, point - clipDurationSec);
      }
    }

    return Math.max(0, bestStart);
  },

  historyPast: [],
  historyFuture: [],
  isDirty: false,
  currentProjectPath: null,

  pushHistory: () => {
    const { tracks, transitions, playhead, selectedClipId, selectedClipIds, activeCameraTrackId, project, historyPast } = get();
    const snapshot: TimelineSnapshot = {
      tracks: JSON.parse(JSON.stringify(tracks)),
      transitions: JSON.parse(JSON.stringify(transitions || [])),
      playhead,
      selectedClipId,
      selectedClipIds: [...selectedClipIds],
      activeCameraTrackId,
      project: JSON.parse(JSON.stringify(project)),
    };
    set({
      historyPast: [...historyPast.slice(-49), snapshot],
      historyFuture: [],
      isDirty: true,
    });
    updateAppTitle(project.name || 'Untitled Project', true, get().currentProjectPath);
  },

  canUndo: () => get().historyPast.length > 0,
  canRedo: () => get().historyFuture.length > 0,

  undo: () => {
    const { historyPast, historyFuture, tracks, transitions, playhead, selectedClipId, selectedClipIds, activeCameraTrackId, project } = get();
    if (historyPast.length === 0) return;

    const currentSnapshot: TimelineSnapshot = {
      tracks: JSON.parse(JSON.stringify(tracks)),
      transitions: JSON.parse(JSON.stringify(transitions || [])),
      playhead,
      selectedClipId,
      selectedClipIds: [...selectedClipIds],
      activeCameraTrackId,
      project: JSON.parse(JSON.stringify(project)),
    };

    const previous = historyPast[historyPast.length - 1];
    const newPast = historyPast.slice(0, -1);

    set({
      historyPast: newPast,
      historyFuture: [currentSnapshot, ...historyFuture],
      tracks: previous.tracks,
      transitions: previous.transitions || [],
      playhead: previous.playhead,
      selectedClipId: previous.selectedClipId,
      selectedClipIds: previous.selectedClipIds || (previous.selectedClipId ? [previous.selectedClipId] : []),
      activeCameraTrackId: previous.activeCameraTrackId,
      project: previous.project,
      isDirty: true,
    });
    updateAppTitle(previous.project.name || 'Untitled Project', true, get().currentProjectPath);
  },

  redo: () => {
    const { historyPast, historyFuture, tracks, transitions, playhead, selectedClipId, selectedClipIds, activeCameraTrackId, project } = get();
    if (historyFuture.length === 0) return;

    const currentSnapshot: TimelineSnapshot = {
      tracks: JSON.parse(JSON.stringify(tracks)),
      transitions: JSON.parse(JSON.stringify(transitions || [])),
      playhead,
      selectedClipId,
      selectedClipIds: [...selectedClipIds],
      activeCameraTrackId,
      project: JSON.parse(JSON.stringify(project)),
    };

    const next = historyFuture[0];
    const newFuture = historyFuture.slice(1);

    set({
      historyPast: [...historyPast, currentSnapshot],
      historyFuture: newFuture,
      tracks: next.tracks,
      transitions: next.transitions || [],
      playhead: next.playhead,
      selectedClipId: next.selectedClipId,
      selectedClipIds: next.selectedClipIds || (next.selectedClipId ? [next.selectedClipId] : []),
      activeCameraTrackId: next.activeCameraTrackId,
      project: next.project,
      isDirty: true,
    });
    updateAppTitle(next.project.name || 'Untitled Project', true, get().currentProjectPath);
  },

  rippleDeleteClip: (targetClipId) => {
    const { selectedClipId } = get();
    const clipId = targetClipId || selectedClipId;
    if (!clipId) return;

    get().pushHistory();

    set((state) => ({
      tracks: state.tracks.map((track) => {
        const targetIdx = track.clips.findIndex((c) => c.id === clipId);
        if (targetIdx === -1) return track;

        const targetClip = track.clips[targetIdx];
        const gapSec = targetClip.durationSeconds || 10;
        const targetStart = targetClip.startPositionSeconds || 0;

        const updatedClips = track.clips
          .filter((c) => c.id !== clipId)
          .map((c) => {
            const cStart = c.startPositionSeconds || 0;
            if (cStart > targetStart) {
              const shiftedStart = Math.max(0, cStart - gapSec);
              return {
                ...c,
                startPositionSeconds: shiftedStart,
                startTimeMs: Math.round(shiftedStart * 1000),
              };
            }
            return c;
          });

        return {
          ...track,
          clips: updatedClips,
          timeOffsetSeconds:
            updatedClips.length > 0
              ? Math.min(...updatedClips.map((c) => c.startPositionSeconds ?? 0))
              : 0,
        };
      }),
      selectedClipId: null,
      isDirty: true,
    }));
  },

  saveProject: async (asNewFile = false) => {
    const { project, tracks, assets, bins, playhead, activeCameraTrackId, currentProjectPath } = get();

    let targetPath = currentProjectPath;
    if (asNewFile || !targetPath) {
      if (isTauri) {
        const defaultName = `${project.name || 'Untitled_Project'}.idts`;
        const chosen = await tauriInvoke<string | null>('save_project_dialog', { defaultName });
        if (!chosen) return false;
        targetPath = chosen;
      } else {
        const promptName = window.prompt(
          'Save Project As (.idts):',
          `${project.name || 'Untitled_Project'}.idts`
        );
        if (!promptName) return false;
        targetPath = promptName.toLowerCase().endsWith('.idts') ? promptName : `${promptName}.idts`;
      }
    }

    const projectData: ProjectData = {
      version: '1.0.0',
      metadata: {
        id: project.id,
        name: project.name || 'Untitled Project',
        createdAt: new Date().toISOString(),
        modifiedAt: new Date().toISOString(),
        fps: project.fps || 30,
        width: project.width || 1920,
        height: project.height || 1080,
        durationMs: project.durationMs || 120000,
      },
      mediaPool: {
        bins: bins || [],
        assets: assets || [],
      },
      timeline: {
        tracks,
        transitions: get().transitions || [],
        playheadSec: playhead,
        activeCameraTrackId: activeCameraTrackId || undefined,
      },
    };

    if (isTauri) {
      try {
        await tauriInvoke('save_project', { path: targetPath, projectData });
        set({ currentProjectPath: targetPath, isDirty: false });
        updateAppTitle(project.name || 'Untitled Project', false, targetPath);
        return true;
      } catch (err) {
        console.error('Failed to save project:', err);
        return false;
      }
    } else {
      localStorage.setItem('idts_project_' + targetPath, JSON.stringify(projectData));
      set({ currentProjectPath: targetPath, isDirty: false });
      updateAppTitle(project.name || 'Untitled Project', false, targetPath);
      return true;
    }
  },

  openProject: async (pathOverride?: string) => {
    let targetPath = pathOverride;
    if (!targetPath) {
      if (isTauri) {
        const chosen = await tauriInvoke<string | null>('open_project_dialog');
        if (!chosen) return false;
        targetPath = chosen;
      } else {
        const promptName = window.prompt('Enter path to open .idts project:');
        if (!promptName) return false;
        targetPath = promptName;
      }
    }

    if (isTauri) {
      try {
        const data = await tauriInvoke<ProjectData>('load_project', { path: targetPath });
        if (data) {
          get().loadProjectData(data, targetPath);
          return true;
        }
      } catch (err) {
        console.error('Failed to load project:', err);
        return false;
      }
    } else {
      const stored = localStorage.getItem('idts_project_' + targetPath);
      if (stored) {
        const data = JSON.parse(stored) as ProjectData;
        get().loadProjectData(data, targetPath);
        return true;
      }
    }
    return false;
  },

  loadProjectData: (data: ProjectData, filePath?: string) => {
    set({
      project: {
        id: data.metadata.id,
        name: data.metadata.name,
        fps: data.metadata.fps,
        width: data.metadata.width,
        height: data.metadata.height,
        durationMs: data.metadata.durationMs,
        sampleRate: 48000,
        tracks: data.timeline.tracks,
        bins: data.mediaPool.bins,
        assets: data.mediaPool.assets,
      },
      tracks: data.timeline.tracks,
      transitions: data.timeline.transitions || [],
      bins: data.mediaPool.bins,
      assets: data.mediaPool.assets,
      playhead: data.timeline.playheadSec || 0,
      activeCameraTrackId: data.timeline.activeCameraTrackId || null,
      currentProjectPath: filePath || null,
      isDirty: false,
      historyPast: [],
      historyFuture: [],
    });
    updateAppTitle(data.metadata.name, false, filePath);
  },

  deleteGapAtTime: (trackId, timeSec) => {
    const { tracks, isRippleMode, pushHistory } = get();
    const track = tracks.find((t) => t.id === trackId);
    if (!track || track.clips.length === 0) return;

    const sorted = [...track.clips].sort(
      (a, b) => (a.startPositionSeconds || 0) - (b.startPositionSeconds || 0)
    );

    let gapStartSec = 0;
    let gapEndSec = 0;

    for (let i = 0; i < sorted.length; i++) {
      const c = sorted[i];
      const cStart = c.startPositionSeconds || 0;
      const cEnd = cStart + (c.durationSeconds || 10);

      if (cEnd <= timeSec) {
        gapStartSec = cEnd;
      }
      if (cStart >= timeSec) {
        gapEndSec = cStart;
        break;
      }
    }

    if (gapEndSec <= gapStartSec) {
      if (sorted.length > 0 && timeSec < (sorted[0].startPositionSeconds || 0)) {
        gapStartSec = 0;
        gapEndSec = sorted[0].startPositionSeconds || 0;
      } else {
        return;
      }
    }

    const gapDuration = gapEndSec - gapStartSec;
    if (gapDuration <= 0.01) return;

    pushHistory();

    set((state) => ({
      tracks: state.tracks.map((t) => {
        const isAffected = isRippleMode ? !t.locked && !t.isLocked : t.id === trackId;
        if (!isAffected) return t;

        return {
          ...t,
          clips: t.clips.map((clip) => {
            const cStart = clip.startPositionSeconds || 0;
            if (cStart >= gapEndSec - 0.05) {
              const newStart = Math.max(0, cStart - gapDuration);
              return {
                ...clip,
                startPositionSeconds: newStart,
                startTimeMs: Math.round(newStart * 1000),
              };
            }
            return clip;
          }),
        };
      }),
    }));
  },

  generateClipProxy: async (filePath, resolution = '720p') => {
    set((state) => ({
      proxyProgress: { ...state.proxyProgress, [filePath]: 0 },
      proxyStatus: { ...state.proxyStatus, [filePath]: 'transcoding' },
    }));

    if (!isTauri) {
      await new Promise((r) => setTimeout(r, 800));
      set((state) => ({
        proxyProgress: { ...state.proxyProgress, [filePath]: 100 },
        proxyStatus: { ...state.proxyStatus, [filePath]: 'completed' },
        assets: state.assets.map((a) =>
          a.filePath === filePath ? { ...a, proxyPath: filePath, hasProxy: true } : a
        ),
        tracks: state.tracks.map((t) => ({
          ...t,
          clips: t.clips.map((c) =>
            c.filePath === filePath ? { ...c, proxyPath: filePath, hasProxy: true } : c
          ),
        })),
      }));
      return filePath;
    }

    try {
      const proxyPath = await tauriInvoke<string>('create_clip_proxy', {
        path: filePath,
        resolution,
      });

      const safePath = proxyPath || undefined;
      set((state) => ({
        proxyProgress: { ...state.proxyProgress, [filePath]: 100 },
        proxyStatus: { ...state.proxyStatus, [filePath]: 'completed' },
        assets: state.assets.map((a) =>
          a.filePath === filePath ? { ...a, proxyPath: safePath, hasProxy: true } : a
        ),
        tracks: state.tracks.map((t) => ({
          ...t,
          clips: t.clips.map((c) =>
            c.filePath === filePath ? { ...c, proxyPath: safePath, hasProxy: true } : c
          ),
        })),
      }));
      return proxyPath;
    } catch (err) {
      set((state) => ({
        proxyStatus: { ...state.proxyStatus, [filePath]: 'error' },
      }));
      throw err;
    }
  },

  cancelClipProxy: async (filePath) => {
    if (isTauri) {
      try {
        await tauriInvoke('cancel_clip_proxy', { path: filePath });
      } catch {}
    }
    set((state) => ({
      proxyStatus: { ...state.proxyStatus, [filePath]: 'cancelled' },
    }));
  },

  deleteClipProxy: async (filePath) => {
    if (isTauri) {
      try {
        await tauriInvoke('delete_clip_proxy', { path: filePath });
      } catch (err) {
        console.warn('Failed to delete proxy file:', err);
      }
    }
    set((state) => {
      const nextProgress = { ...state.proxyProgress };
      delete nextProgress[filePath];
      const nextStatus = { ...state.proxyStatus };
      delete nextStatus[filePath];

      return {
        proxyProgress: nextProgress,
        proxyStatus: nextStatus,
        assets: state.assets.map((a) =>
          a.filePath === filePath ? { ...a, proxyPath: undefined, hasProxy: false } : a
        ),
        tracks: state.tracks.map((t) => ({
          ...t,
          clips: t.clips.map((c) =>
            c.filePath === filePath ? { ...c, proxyPath: undefined, hasProxy: false } : c
          ),
        })),
      };
    });
  },

  checkClipProxy: async (filePath, resolution = '720p') => {
    if (!isTauri) return null;
    try {
      const p = await tauriInvoke<string | null>('check_clip_proxy', { path: filePath, resolution });
      if (p && typeof p === 'string' && p.trim().length > 0) {
        set((state) => ({
          assets: state.assets.map((a) =>
            a.filePath === filePath ? { ...a, proxyPath: p, hasProxy: true } : a
          ),
          tracks: state.tracks.map((t) => ({
            ...t,
            clips: t.clips.map((c) =>
              c.filePath === filePath ? { ...c, proxyPath: p, hasProxy: true } : c
            ),
          })),
        }));
        return p;
      }
      return null;
    } catch {
      return null;
    }
  },

  initProxyEventListener: () => {
    if (!isTauri) return;
    import('@tauri-apps/api/event').then(({ listen }) => {
      listen<any>('proxy-progress', (event) => {
        const payload = event.payload;
        if (!payload || !payload.path) return;

        set((state) => ({
          proxyProgress: { ...state.proxyProgress, [payload.path]: payload.progress },
          proxyStatus: { ...state.proxyStatus, [payload.path]: payload.status },
        }));

        if (payload.status === 'completed' && payload.proxyPath) {
          const pPath: string | undefined = payload.proxyPath || undefined;
          set((state) => ({
            assets: state.assets.map((a) =>
              a.filePath === payload.path ? { ...a, proxyPath: pPath, hasProxy: true } : a
            ),
            tracks: state.tracks.map((t) => ({
              ...t,
              clips: t.clips.map((c) =>
                c.filePath === payload.path ? { ...c, proxyPath: pPath, hasProxy: true } : c
              ),
            })),
          }));
        }
      });
    });
  },

  autoCutSilence: async (targetTrackId, thresholdDb, minDurationSec) => {
    const { tracks, pushHistory } = get();
    const track = tracks.find((t) => t.id === targetTrackId);
    if (!track || track.clips.length === 0) {
      return { cutCount: 0, removedSec: 0 };
    }

    let totalCuts = 0;
    let totalRemovedSec = 0;
    let lastError: string | null = null;

    const newClips: Clip[] = [];
    let cumulativeShift = 0;

    for (const clip of track.clips) {
      const curIn = clip.inPointSeconds ?? (clip.sourceOffsetMs ? clip.sourceOffsetMs / 1000 : 0);
      const curDur = clip.durationSeconds ?? (clip.durationMs ? clip.durationMs / 1000 : 10);
      const curOut = curIn + curDur;
      const curStart = Math.max(0, (clip.startPositionSeconds ?? (clip.startTimeMs ? clip.startTimeMs / 1000 : 0)) - cumulativeShift);

      let silenceIntervals: Array<[number, number]> = [];
      try {
        if (isTauri) {
          const res = await tauriInvoke<Array<[number, number]>>('detect_track_silence', {
            path: clip.filePath,
            thresholdDb,
            durationSec: minDurationSec,
          });
          if (res) {
            silenceIntervals = res;
          }
        }
      } catch (err: any) {
        lastError = String(err?.message || err);
        console.warn('detect_track_silence error:', err);
      }

      const visibleSilences: Array<[number, number]> = [];
      for (const [sStart, sEnd] of silenceIntervals) {
        const oStart = Math.max(curIn, sStart);
        const oEnd = Math.min(curOut, sEnd);
        if (oEnd > oStart + 0.05) {
          visibleSilences.push([oStart, oEnd]);
        }
      }

      if (visibleSilences.length === 0) {
        newClips.push({
          ...clip,
          startPositionSeconds: curStart,
          startTimeMs: Math.round(curStart * 1000),
        });
        continue;
      }

      visibleSilences.sort((a, b) => a[0] - b[0]);
      const audibleSlices: Array<[number, number]> = [];
      let cursor = curIn;

      for (const [silStart, silEnd] of visibleSilences) {
        if (silStart > cursor + 0.05) {
          audibleSlices.push([cursor, silStart]);
        }
        totalRemovedSec += silEnd - silStart;
        cursor = silEnd;
      }

      if (curOut > cursor + 0.05) {
        audibleSlices.push([cursor, curOut]);
      }

      if (audibleSlices.length === 0) {
        cumulativeShift += curDur;
        totalCuts++;
        continue;
      }

      totalCuts += audibleSlices.length - 1;
      let pieceStart = curStart;

      for (let i = 0; i < audibleSlices.length; i++) {
        const [inSlice, outSlice] = audibleSlices[i];
        const sliceDur = outSlice - inSlice;

        newClips.push({
          ...clip,
          id: i === 0 ? clip.id : `clip-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          name: i === 0 ? clip.name : `${clip.name} (Part ${i + 1})`,
          inPointSeconds: inSlice,
          outPointSeconds: outSlice,
          durationSeconds: sliceDur,
          durationMs: Math.round(sliceDur * 1000),
          startPositionSeconds: pieceStart,
          startTimeMs: Math.round(pieceStart * 1000),
        });

        pieceStart += sliceDur;
      }

      const clipRemoved = curDur - (pieceStart - curStart);
      cumulativeShift += clipRemoved;
    }

    if (totalCuts > 0) {
      pushHistory();
      set((state) => ({
        tracks: state.tracks.map((t) => {
          if (t.id === targetTrackId) {
            return { ...t, clips: newClips };
          }
          return t;
        }),
        isDirty: true,
      }));
    }

    return { cutCount: totalCuts, removedSec: totalRemovedSec, error: lastError || undefined };
  },

  createNewProject: () => {
    const newProj = {
      id: `proj_${Date.now()}`,
      name: 'Untitled Project',
      fps: 30,
      sampleRate: 48000,
      width: 1920,
      height: 1080,
      durationMs: 120000,
      tracks: INITIAL_TRACKS,
      transitions: [],
      selectedTransitionId: null,
      activeDragTransition: null,
      bins: INITIAL_BINS,
      assets: [],
    };
    set({
      project: newProj,
      tracks: INITIAL_TRACKS,
      transitions: [],
      selectedTransitionId: null,
      activeDragTransition: null,
      bins: INITIAL_BINS,
      assets: [],
      playhead: 0,
      selectedClipId: null,
      selectedTrackId: null,
      currentProjectPath: null,
      isDirty: false,
      historyPast: [],
      historyFuture: [],
    });
    updateAppTitle('Untitled Project', false, null);
  },

  // Phase 8: Motion Transform Controls, Dynamic Keyframing Engine, Speed Ramping, Lens Effects
  expandedKeyframeClipIds: [],
  toggleKeyframeLane: (clipId: string) => {
    set((state) => ({
      expandedKeyframeClipIds: state.expandedKeyframeClipIds.includes(clipId)
        ? state.expandedKeyframeClipIds.filter((id) => id !== clipId)
        : [...state.expandedKeyframeClipIds, clipId],
    }));
  },

  updateClipTransform: (clipId, transform) => {
    set((state) => ({
      tracks: state.tracks.map((track) => ({
        ...track,
        clips: track.clips.map((clip) => {
          if (clip.id !== clipId) return clip;
          return {
            ...clip,
            scale: transform.scale !== undefined ? transform.scale : clip.scale,
            positionX: transform.positionX !== undefined ? transform.positionX : clip.positionX,
            positionY: transform.positionY !== undefined ? transform.positionY : clip.positionY,
            rotation: transform.rotation !== undefined ? transform.rotation : clip.rotation,
            opacity: transform.opacity !== undefined ? transform.opacity : clip.opacity,
          };
        }),
      })),
      isDirty: true,
    }));
  },

  addOrUpdateKeyframe: (clipId, property, time, value, easing = 'linear') => {
    set((state) => {
      const tracks = state.tracks.map((track) => ({
        ...track,
        clips: track.clips.map((clip) => {
          if (clip.id !== clipId) return clip;
          const currentTracks = clip.keyframeTracks ? [...clip.keyframeTracks] : [];
          const trackIdx = currentTracks.findIndex((t) => t.property === property);

          if (trackIdx >= 0) {
            const existingKfs = [...currentTracks[trackIdx].keyframes];
            const kfIdx = existingKfs.findIndex((k) => Math.abs(k.time - time) < 0.05);
            if (kfIdx >= 0) {
              existingKfs[kfIdx] = { time, value, easing };
            } else {
              existingKfs.push({ time, value, easing });
              existingKfs.sort((a, b) => a.time - b.time);
            }
            currentTracks[trackIdx] = { property, keyframes: existingKfs };
          } else {
            currentTracks.push({ property, keyframes: [{ time, value, easing }] });
          }

          return {
            ...clip,
            keyframeTracks: currentTracks,
          };
        }),
      }));
      return { tracks, isDirty: true };
    });
  },

  removeKeyframe: (clipId, property, time) => {
    set((state) => ({
      tracks: state.tracks.map((track) => ({
        ...track,
        clips: track.clips.map((clip) => {
          if (clip.id !== clipId || !clip.keyframeTracks) return clip;
          const updatedTracks = clip.keyframeTracks
            .map((t) => {
              if (t.property !== property) return t;
              return {
                ...t,
                keyframes: t.keyframes.filter((k) => Math.abs(k.time - time) >= 0.05),
              };
            })
            .filter((t) => t.keyframes.length > 0);

          return {
            ...clip,
            keyframeTracks: updatedTracks.length > 0 ? updatedTracks : undefined,
          };
        }),
      })),
      isDirty: true,
    }));
  },

  updateClipSpeed: (clipId, speedMultiplier, pitchCorrection = true) => {
    const { pushHistory, playhead } = get();
    pushHistory();

    let adjustedPlayhead: number | null = null;

    set((state) => ({
      tracks: state.tracks.map((track) => ({
        ...track,
        clips: track.clips.map((clip) => {
          if (clip.id !== clipId) return clip;
          const currentSpeed = clip.speedProfile?.speedMultiplier ?? 1.0;
          const sourceDurSec =
            (clip.outPointSeconds != null && clip.inPointSeconds != null && clip.outPointSeconds > clip.inPointSeconds)
              ? (clip.outPointSeconds - clip.inPointSeconds)
              : (clip.durationSeconds || (clip.durationMs ? clip.durationMs / 1000 : 10)) * currentSpeed;

          const newDurSec = Math.max(0.1, sourceDurSec / speedMultiplier);
          const newDurMs = Math.round(newDurSec * 1000);

          const clipStart = clip.startPositionSeconds ?? (clip.startTimeMs ? clip.startTimeMs / 1000 : 0);
          const oldDur = clip.durationSeconds ?? (clip.durationMs ? clip.durationMs / 1000 : 10);
          if (playhead >= clipStart && playhead <= clipStart + oldDur) {
            const ratio = oldDur > 0 ? (playhead - clipStart) / oldDur : 0;
            adjustedPlayhead = clipStart + ratio * newDurSec;
          }

          return {
            ...clip,
            durationSeconds: newDurSec,
            durationMs: newDurMs,
            speedProfile: {
              speedMultiplier,
              pitchCorrection,
            },
          };
        }),
      })),
      ...(adjustedPlayhead !== null ? { playhead: adjustedPlayhead } : {}),
      isDirty: true,
    }));
  },

  updateClipLensEffects: (clipId, lensUpdates) => {
    set((state) => ({
      tracks: state.tracks.map((track) => ({
        ...track,
        clips: track.clips.map((clip) => {
          if (clip.id !== clipId) return clip;
          const current = clip.lensEffects ?? {
            defishEnabled: false,
            defishStrength: 0,
            gaussianBlur: 0,
          };
          return {
            ...clip,
            lensEffects: {
              ...current,
              ...lensUpdates,
            },
          };
        }),
      })),
      isDirty: true,
    }));
  },
}));
