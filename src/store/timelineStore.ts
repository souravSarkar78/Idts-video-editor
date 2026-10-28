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
  StabilizationSettings,
  TextClip,
  TextClipStyle,
  TextTrack,
  CaptionSegment,
  AudioDeviceInfo,
  AudioProcessingSettings,
  NoiseDenoiseAndFillProfile,
  DuckingConfig,
  VolumeKeyframePoint,
  ColorGradingProfile,
  ColorGradingPreset,
  ColorWheel,
  SplineCurves,
  HslQualifier,
  SplitToning,
  FilterPreset,
  FilterCategory,
  ShaderRecipe,
} from '../types/ipc';
import { loadAudioBuffer, unlockAudioContext } from '../utils/audioMastering';
import { BUILT_IN_FILTER_CATEGORIES, BUILT_IN_FILTER_PRESETS } from '../components/Filters/defaultPresets';

export const DEFAULT_COLOR_GRADING_PROFILE: ColorGradingProfile = {
  exposure: 0,
  contrast: 1,
  highlights: 0,
  shadows: 0,
  whites: 0,
  blacks: 0,
  brilliance: 0,
  temperature: 0,
  tint: 0,
  saturation: 1,
  vibrance: 0,
  sharpen: 0,
  clarity: 0,
  particles: 0,
  fade: 0,
  vignette: 0,
  lutIntensity: 1,
};

export const DEFAULT_COLOR_PRESETS: ColorGradingPreset[] = [
  {
    id: 'preset_teal_orange',
    name: 'Cinematic Teal & Orange',
    createdAt: 1,
    isBuiltIn: true,
    profile: {
      ...DEFAULT_COLOR_GRADING_PROFILE,
      exposure: 0.15,
      contrast: 1.15,
      saturation: 1.2,
      lift: { r: -0.06, g: 0.02, b: 0.1, luma: -0.05 },
      gain: { r: 0.08, g: 0.03, b: -0.05, luma: 0.06 },
      splitToning: { shadowHue: 200, shadowSat: 35, highlightHue: 35, highlightSat: 40, balance: 10 },
    },
  },
  {
    id: 'preset_warm_film',
    name: 'Warm Moody Film',
    createdAt: 2,
    isBuiltIn: true,
    profile: {
      ...DEFAULT_COLOR_GRADING_PROFILE,
      exposure: 0.08,
      contrast: 1.08,
      temperature: 18,
      tint: 4,
      saturation: 1.05,
      vibrance: 0.15,
      lift: { r: 0.04, g: 0.01, b: -0.02, luma: 0.03 },
      gain: { r: 0.06, g: 0.02, b: -0.03, luma: 0.04 },
    },
  },
  {
    id: 'preset_clean_commercial',
    name: 'Clean Crisp Commercial',
    createdAt: 3,
    isBuiltIn: true,
    profile: {
      ...DEFAULT_COLOR_GRADING_PROFILE,
      exposure: 0.2,
      contrast: 1.12,
      highlights: 10,
      shadows: -5,
      whites: 8,
      blacks: -4,
      saturation: 1.15,
      vibrance: 0.2,
    },
  },
  {
    id: 'preset_vintage_matte',
    name: 'Vintage Matte Film',
    createdAt: 4,
    isBuiltIn: true,
    profile: {
      ...DEFAULT_COLOR_GRADING_PROFILE,
      exposure: -0.1,
      contrast: 0.92,
      shadows: 20,
      blacks: 15,
      temperature: 12,
      saturation: 0.88,
      lift: { r: 0.03, g: 0.02, b: 0.01, luma: 0.1 },
    },
  },
  {
    id: 'preset_noir_bw',
    name: 'Noir High-Contrast B&W',
    createdAt: 5,
    isBuiltIn: true,
    profile: {
      ...DEFAULT_COLOR_GRADING_PROFILE,
      saturation: 0,
      vibrance: -1,
      contrast: 1.35,
      exposure: 0.05,
      shadows: -15,
      highlights: 12,
    },
  },
];

export function generateCubeLut(profile: ColorGradingProfile, title = 'Custom Grade', size = 17): string {
  const lines: string[] = [];
  lines.push(`# Created by IDTS Video Editor`);
  lines.push(`TITLE "${title}"`);
  lines.push(`LUT_3D_SIZE ${size}`);
  lines.push(`DOMAIN_MIN 0.0 0.0 0.0`);
  lines.push(`DOMAIN_MAX 1.0 1.0 1.0`);
  lines.push('');

  const exp = profile.exposure ?? 0;
  const expMul = Math.pow(2, exp * 0.5);
  const contrast = profile.contrast ?? 1.0;
  const sat = profile.saturation ?? 1.0;
  const vibrance = profile.vibrance ?? 0;
  const netSat = sat * (1 + vibrance * 0.35);

  const temp = profile.temperature ?? 0;
  const tint = profile.tint ?? 0;
  const tempR = temp > 0 ? 1 + (temp / 100) * 0.25 : 1.0;
  const tempB = temp < 0 ? 1 + (Math.abs(temp) / 100) * 0.3 : 1.0;
  const tintG = tint !== 0 ? 1 + (tint / 100) * 0.2 : 1.0;

  const liftR = (profile.lift?.r || 0) * 0.2 + (profile.lift?.luma || 0) * 0.15;
  const liftG = (profile.lift?.g || 0) * 0.2 + (profile.lift?.luma || 0) * 0.15;
  const liftB = (profile.lift?.b || 0) * 0.2 + (profile.lift?.luma || 0) * 0.15;

  const gainR = 1 + (profile.gain?.r || 0) * 0.25 + (profile.gain?.luma || 0) * 0.2;
  const gainG = 1 + (profile.gain?.g || 0) * 0.25 + (profile.gain?.luma || 0) * 0.2;
  const gainB = 1 + (profile.gain?.b || 0) * 0.25 + (profile.gain?.luma || 0) * 0.2;

  for (let b = 0; b < size; b++) {
    const rawB = b / (size - 1);
    for (let g = 0; g < size; g++) {
      const rawG = g / (size - 1);
      for (let r = 0; r < size; r++) {
        const rawR = r / (size - 1);

        let outR = Math.max(0, rawR * expMul * gainR * tempR + liftR);
        let outG = Math.max(0, rawG * expMul * gainG * tintG + liftG);
        let outB = Math.max(0, rawB * expMul * gainB * tempB + liftB);

        outR = (outR - 0.5) * contrast + 0.5;
        outG = (outG - 0.5) * contrast + 0.5;
        outB = (outB - 0.5) * contrast + 0.5;

        const luma = 0.2126 * outR + 0.7152 * outG + 0.0722 * outB;
        outR = luma + (outR - luma) * netSat;
        outG = luma + (outG - luma) * netSat;
        outB = luma + (outB - luma) * netSat;

        outR = Math.max(0, Math.min(1, outR));
        outG = Math.max(0, Math.min(1, outG));
        outB = Math.max(0, Math.min(1, outB));

        lines.push(`${outR.toFixed(6)} ${outG.toFixed(6)} ${outB.toFixed(6)}`);
      }
    }
  }

  return lines.join('\n');
}

export const loadStoredColorPresets = (): ColorGradingPreset[] => {
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem('idts_color_grading_presets') : null;
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return [...DEFAULT_COLOR_PRESETS, ...parsed.filter((p: any) => !p.isBuiltIn)];
      }
    }
  } catch (e) {
    console.error('Failed to parse stored color grading presets:', e);
  }
  return DEFAULT_COLOR_PRESETS;
};

export interface TimelineSnapshot {
  tracks: MediaTrack[];
  transitions?: Transition[];
  playhead: number;
  selectedClipId: string | null;
  selectedClipIds?: string[];
  activeCameraTrackId: string | null;
  project: TimelineProject;
  masterGrading?: ColorGradingProfile | null;
}

export const isTauri = typeof window !== 'undefined' && Boolean((window as any).__TAURI_INTERNALS__);

let activeRecordingSession: {
  stream: MediaStream;
  context: AudioContext;
  processor: ScriptProcessorNode;
  chunks: Float32Array[];
  sampleRate: number;
} | null = null;

export function encodeWavPcm16(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const numChannels = 1;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = samples.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');

  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);

  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }

  return buffer;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  const chunkSize = 8192;
  for (let i = 0; i < len; i += chunkSize) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, Math.min(i + chunkSize, len))));
  }
  return btoa(binary);
}

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
  const relTime = Math.max(0, Math.min(durSec, playhead - startSec));

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
  inspectorTab: 'video' | 'audio' | 'speed' | 'animate' | 'adjust' | 'color' | 'text';
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
  // Phase 7: Hierarchical Color Grading Engine & Adjustment Layers
  masterGrading: ColorGradingProfile | null;
  selectedGradingScope: 'clip' | 'track' | 'master';
  activeGradingTrackId: string | null;
  setSelectedGradingScope: (scope: 'clip' | 'track' | 'master', trackId?: string) => void;
  updateMasterGrading: (grading: Partial<ColorGradingProfile>) => void;
  resetMasterGrading: () => void;
  updateTrackGrading: (trackId: string, grading: Partial<ColorGradingProfile>) => void;
  resetTrackGrading: (trackId: string) => void;
  updateClipGradingProfile: (clipId: string, grading: Partial<ColorGradingProfile>) => void;
  resetClipGradingProfile: (clipId: string) => void;
  addAdjustmentLayer: (trackId?: string, startSec?: number, durationSec?: number) => string;

  // Custom Color Grading Presets & .CUBE LUT Export
  colorGradingPresets: ColorGradingPreset[];
  saveColorGradingPreset: (name: string, profile: ColorGradingProfile) => string;
  deleteColorGradingPreset: (presetId: string) => void;
  applyColorGradingPreset: (presetId: string, scope?: 'clip' | 'track' | 'master') => void;
  exportProfileAsCubeLut: (profile: ColorGradingProfile, filename?: string) => void;

  // Phase 7: Split View Comparison & Video Scopes
  isSplitComparisonOpen: boolean;
  splitComparisonMode: 'vertical' | 'side-by-side';
  splitComparisonPosition: number; // 0.0 to 1.0 (50%)
  referenceSnapshotUrl: string | null;
  setSplitComparisonOpen: (open: boolean) => void;
  setSplitComparisonMode: (mode: 'vertical' | 'side-by-side') => void;
  setSplitComparisonPosition: (pos: number) => void;
  setReferenceSnapshotUrl: (url: string | null) => void;
  autoMatchLook: (targetClipId?: string) => void;

  isScopesDrawerOpen: boolean;
  activeScopeType: 'all' | 'waveform' | 'parade' | 'vectorscope';
  setIsScopesDrawerOpen: (open: boolean) => void;
  setActiveScopeType: (type: 'all' | 'waveform' | 'parade' | 'vectorscope') => void;

  updateClipColor: (clipId: string, color: Partial<ColorCorrection>) => void;
  resetClipColor: (clipId: string) => void;

  // Phase 11: Dedicated Filters & 3D LUTs Explorer
  filterCategories: FilterCategory[];
  filterPresets: FilterPreset[];
  activeFilterCategory: string;
  samplePreviewMode: 'default' | 'video_frame';
  videoFrameSnapshot: string | null;
  isVideoFrameLoading: boolean;
  activeDragFilterPreset: FilterPreset | null;
  setActiveDragFilterPreset: (preset: FilterPreset | null) => void;
  fetchFilterCatalog: () => Promise<void>;
  setActiveFilterCategory: (categoryId: string) => void;
  setSamplePreviewMode: (mode: 'default' | 'video_frame') => void;
  refreshVideoFrameSnapshot: () => Promise<void>;
  applyFilterPreset: (preset: FilterPreset, targetClipId?: string) => void;
  removeFilterFromClip: (targetClipId?: string) => void;
  setClipFilterIntensity: (intensity: number, targetClipId?: string) => void;
  importCustomCubeLut: (filePath: string, name?: string) => Promise<void>;

  // Phase 9: Text Overlays, Title Styling & Local Auto-Captions
  addTextClip: (
    trackId?: string,
    text?: string,
    startTime?: number,
    duration?: number,
    style?: Partial<TextClipStyle>
  ) => string;
  updateTextClipContent: (clipId: string, text: string) => void;
  updateTextClipStyle: (clipId: string, styleUpdates: Partial<TextClipStyle>) => void;
  applyTextPreset: (
    clipId: string,
    preset: 'youtube_lower_third' | 'cinematic' | 'karaoke' | 'default'
  ) => void;
  isAutoCaptionModalOpen: boolean;
  setIsAutoCaptionModalOpen: (open: boolean) => void;
  isTranscribing: boolean;
  transcriptionProgress: number;
  generateAutoCaptions: (trackId: string, model?: string) => Promise<boolean>;

  // Phase 10: Live Voiceover Recording Engine & Mastering Suite
  isVoiceoverModalOpen: boolean;
  setIsVoiceoverModalOpen: (open: boolean) => void;
  isRecordingVoiceover: boolean;
  voiceoverCountdown: number | null;
  voiceoverRecordingStartSec: number;
  voiceoverRecordingCurrentSec: number;
  voiceoverTargetTrackId: string | null;
  setVoiceoverTargetTrackId: (id: string | null) => void;
  voiceoverSelectedDeviceId: string;
  setVoiceoverSelectedDeviceId: (id: string) => void;
  voiceoverInputLevel: number;
  voiceoverPeakDb: number;
  liveRecordingPeaks: number[];
  voiceoverMuteTimeline: boolean;
  setVoiceoverMuteTimeline: (mute: boolean) => void;
  voiceoverUseCountdown: boolean;
  setVoiceoverUseCountdown: (use: boolean) => void;
  availableAudioDevices: AudioDeviceInfo[];
  fetchAudioInputDevices: () => Promise<AudioDeviceInfo[]>;
  startVoiceoverRecording: (explicitTrackId?: string) => Promise<void>;
  stopVoiceoverRecording: () => Promise<string | null>;
  cancelVoiceoverRecording: () => void;
  updateClipAudioProcessing: (clipId: string, settings: Partial<AudioProcessingSettings>) => void;
  captureNoiseProfile: (clipId: string, startSec?: number, durationSec?: number) => Promise<boolean>;
  clearNoiseProfile: (clipId: string) => void;
  updateNoiseProfileSettings: (clipId: string, updates: Partial<NoiseDenoiseAndFillProfile>) => void;
  previewSpectralDenoise: (
    clipId: string,
    startSec: number,
    durationSec: number,
    reductionDb: number,
    sensitivity?: number,
    smoothingBands?: number,
    auditionResidue?: boolean
  ) => Promise<string | null>;
  applyClipSpectralDenoise: (clipId: string) => Promise<string | null>;
  runSilenceAutoCutWithAmbientFill: (clipId: string) => Promise<string | null>;
  addOrUpdateVolumeKeyframe: (clipId: string, time: number, value: number) => void;
  removeVolumeKeyframe: (clipId: string, time: number) => void;
  updateTrackDucking: (trackId: string, config: Partial<DuckingConfig>) => void;
  masterMeterL: number;
  masterMeterR: number;
  setMasterMeters: (left: number, right: number) => void;

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
  addTrack: (trackType: 'video' | 'audio' | 'text', name?: string) => string;
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
  splitClipAtPlayhead: (clipId?: string | string[]) => void;
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

  // Spectral Noise Profile Modal
  isNoiseModalOpen: boolean;
  noiseModalClipId: string | null;
  setIsNoiseModalOpen: (open: boolean, clipId?: string | null) => void;

  // Studio Workspace Layout & Resizing
  timelineHeightPct: number;
  mediaPoolWidthPx: number;
  inspectorWidthPx: number;
  isMediaPoolCollapsed: boolean;
  isInspectorCollapsed: boolean;
  setTimelineHeightPct: (pct: number) => void;
  setMediaPoolWidthPx: (px: number) => void;
  setInspectorWidthPx: (px: number) => void;
  setIsMediaPoolCollapsed: (collapsed: boolean) => void;
  toggleMediaPoolCollapsed: () => void;
  setIsInspectorCollapsed: (collapsed: boolean) => void;
  toggleInspectorCollapsed: () => void;
  resetWorkspaceLayout: () => void;

  // Individual Track Heights
  trackHeights: Record<string, number>;
  setTrackHeight: (trackId: string, height: number) => void;
  resetTrackHeight: (trackId: string) => void;
  resetAllTrackHeights: () => void;

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
  addOrUpdateGlobalKeyframe: (
    clipId: string,
    time?: number,
    transform?: Partial<{
      scale: number;
      positionX: number;
      positionY: number;
      rotation: number;
      opacity: number;
    }>
  ) => void;
  removeGlobalKeyframe: (clipId: string, time: number) => void;
  moveGlobalKeyframe: (clipId: string, oldTime: number, newTime: number) => void;
  clearAllKeyframes: (clipId: string) => void;
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
  updateClipStabilization: (
    clipId: string,
    settings: Partial<StabilizationSettings>
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
  isNoiseModalOpen: false,
  noiseModalClipId: null,
  setIsNoiseModalOpen: (isNoiseModalOpen, noiseModalClipId = null) =>
    set({
      isNoiseModalOpen,
      noiseModalClipId: isNoiseModalOpen ? (noiseModalClipId ?? get().selectedClipId) : null,
    }),

  // Studio Workspace Layout & Resizing
  timelineHeightPct: 52,
  mediaPoolWidthPx: 400,
  inspectorWidthPx: 300,
  isMediaPoolCollapsed: false,
  isInspectorCollapsed: false,
  setTimelineHeightPct: (timelineHeightPct) =>
    set({ timelineHeightPct: Math.max(15, Math.min(85, Math.round(timelineHeightPct))) }),
  setMediaPoolWidthPx: (mediaPoolWidthPx) =>
    set({ mediaPoolWidthPx: Math.max(200, Math.min(850, Math.round(mediaPoolWidthPx))) }),
  setInspectorWidthPx: (inspectorWidthPx) =>
    set({ inspectorWidthPx: Math.max(220, Math.min(650, Math.round(inspectorWidthPx))) }),
  setIsMediaPoolCollapsed: (isMediaPoolCollapsed) => set({ isMediaPoolCollapsed }),
  toggleMediaPoolCollapsed: () =>
    set((state) => ({ isMediaPoolCollapsed: !state.isMediaPoolCollapsed })),
  setIsInspectorCollapsed: (isInspectorCollapsed) => set({ isInspectorCollapsed }),
  toggleInspectorCollapsed: () =>
    set((state) => ({ isInspectorCollapsed: !state.isInspectorCollapsed })),
  resetWorkspaceLayout: () =>
    set({
      timelineHeightPct: 52,
      mediaPoolWidthPx: 400,
      inspectorWidthPx: 300,
      isMediaPoolCollapsed: false,
      isInspectorCollapsed: false,
      trackHeights: {},
    }),

  // Individual Track Heights
  trackHeights: {},
  setTrackHeight: (trackId, height) =>
    set((state) => ({
      trackHeights: {
        ...state.trackHeights,
        [trackId]: Math.max(36, Math.min(400, Math.round(height))),
      },
    })),
  resetTrackHeight: (trackId) =>
    set((state) => {
      const next = { ...state.trackHeights };
      delete next[trackId];
      return { trackHeights: next };
    }),
  resetAllTrackHeights: () => set({ trackHeights: {} }),

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

  // Phase 7: Hierarchical Color Grading Engine & Adjustment Layers
  masterGrading: null,
  selectedGradingScope: 'clip',
  activeGradingTrackId: null,
  setSelectedGradingScope: (selectedGradingScope, trackId) =>
    set({
      selectedGradingScope,
      ...(trackId !== undefined ? { activeGradingTrackId: trackId } : {}),
    }),

  updateMasterGrading: (gradingUpdates) => {
    set((state) => {
      const current = state.masterGrading || { ...DEFAULT_COLOR_GRADING_PROFILE };
      return {
        isDirty: true,
        masterGrading: { ...current, ...gradingUpdates },
      };
    });
  },
  resetMasterGrading: () => {
    set({
      isDirty: true,
      masterGrading: { ...DEFAULT_COLOR_GRADING_PROFILE },
    });
  },

  updateTrackGrading: (trackId, gradingUpdates) => {
    set((state) => ({
      isDirty: true,
      tracks: state.tracks.map((track) => {
        if (track.id !== trackId) return track;
        const current = track.trackGrading || { ...DEFAULT_COLOR_GRADING_PROFILE };
        return {
          ...track,
          trackGrading: { ...current, ...gradingUpdates },
        };
      }),
    }));
  },
  resetTrackGrading: (trackId) => {
    set((state) => ({
      isDirty: true,
      tracks: state.tracks.map((track) => {
        if (track.id !== trackId) return track;
        return {
          ...track,
          trackGrading: { ...DEFAULT_COLOR_GRADING_PROFILE },
        };
      }),
    }));
  },

  updateClipGradingProfile: (clipId, gradingUpdates) => {
    set((state) => ({
      isDirty: true,
      tracks: state.tracks.map((track) => ({
        ...track,
        clips: track.clips.map((clip) => {
          if (clip.id !== clipId) return clip;
          const current = clip.colorGrading || { ...DEFAULT_COLOR_GRADING_PROFILE };
          const updated = { ...current, ...gradingUpdates };
          return {
            ...clip,
            colorGrading: updated,
            exposure: updated.exposure,
            contrast: updated.contrast,
            saturation: updated.saturation,
            temperature: updated.temperature,
            lutPath: updated.lutPath,
          };
        }),
      })),
    }));
  },
  resetClipGradingProfile: (clipId) => {
    set((state) => ({
      isDirty: true,
      tracks: state.tracks.map((track) => ({
        ...track,
        clips: track.clips.map((clip) => {
          if (clip.id !== clipId) return clip;
          return {
            ...clip,
            colorGrading: { ...DEFAULT_COLOR_GRADING_PROFILE },
            exposure: 0,
            contrast: 1,
            saturation: 1,
            temperature: 0,
            lutPath: undefined,
          };
        }),
      })),
    }));
  },

  colorGradingPresets: loadStoredColorPresets(),
  saveColorGradingPreset: (name, profile) => {
    const newPreset: ColorGradingPreset = {
      id: `preset_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: name.trim() || 'Custom Grade Preset',
      createdAt: Date.now(),
      profile: JSON.parse(JSON.stringify(profile)),
      isBuiltIn: false,
    };
    const current = get().colorGradingPresets;
    const updated = [...current, newPreset];
    try {
      const userPresets = updated.filter((p) => !p.isBuiltIn);
      localStorage.setItem('idts_color_grading_presets', JSON.stringify(userPresets));
    } catch (e) {
      console.error('Failed to save preset to localStorage:', e);
    }
    set({ colorGradingPresets: updated });
    return newPreset.id;
  },
  deleteColorGradingPreset: (presetId) => {
    const current = get().colorGradingPresets;
    const updated = current.filter((p) => p.id !== presetId || p.isBuiltIn);
    try {
      const userPresets = updated.filter((p) => !p.isBuiltIn);
      localStorage.setItem('idts_color_grading_presets', JSON.stringify(userPresets));
    } catch (e) {
      console.error('Failed to save preset deletion to localStorage:', e);
    }
    set({ colorGradingPresets: updated });
  },
  applyColorGradingPreset: (presetId, targetScope) => {
    const {
      colorGradingPresets,
      selectedGradingScope,
      selectedClipId,
      activeGradingTrackId,
      tracks,
      updateClipGradingProfile,
      updateTrackGrading,
      updateMasterGrading,
    } = get();
    const preset = colorGradingPresets.find((p) => p.id === presetId);
    if (!preset) return;

    const scope = targetScope || selectedGradingScope;
    if (scope === 'clip' && selectedClipId) {
      updateClipGradingProfile(selectedClipId, preset.profile);
    } else if (scope === 'track') {
      const trackId = activeGradingTrackId || tracks.find((t) => t.trackType === 'video' || t.type === 'video')?.id;
      if (trackId) {
        updateTrackGrading(trackId, preset.profile);
      }
    } else if (scope === 'master') {
      updateMasterGrading(preset.profile);
    }
  },
  exportProfileAsCubeLut: (profile, filename) => {
    const title = filename?.replace(/\.[^/.]+$/, '') || 'IDTS_Custom_Grade';
    const cubeContent = generateCubeLut(profile, title, 17);
    const blob = new Blob([cubeContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || `${title}.cube`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  addAdjustmentLayer: (targetTrackId, startSec, durationSec) => {
    const { tracks, playhead } = get();
    get().pushHistory();

    const start = startSec !== undefined ? startSec : playhead;
    const dur = durationSec || 5.0;
    const newClipId = `adj-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    let trackId = targetTrackId;
    if (!trackId) {
      const topVideoTrack = [...tracks].reverse().find((t) => t.trackType === 'video' || t.type === 'video');
      trackId = topVideoTrack ? topVideoTrack.id : tracks[0]?.id || 'track-v1';
    }

    const adjustmentClip: Clip = {
      id: newClipId,
      trackId,
      name: 'Adjustment Layer',
      filePath: 'adjustment_layer',
      startTimeMs: Math.round(start * 1000),
      durationMs: Math.round(dur * 1000),
      sourceOffsetMs: 0,
      synced: false,
      mediaType: 'adjustment',
      isAdjustmentLayer: true,
      startPositionSeconds: start,
      durationSeconds: dur,
      inPointSeconds: 0,
      outPointSeconds: dur,
      colorGrading: { ...DEFAULT_COLOR_GRADING_PROFILE },
    };

    set((state) => ({
      tracks: state.tracks.map((t) => {
        if (t.id !== trackId) return t;
        return {
          ...t,
          clips: [...t.clips, adjustmentClip],
        };
      }),
      selectedClipId: newClipId,
      selectedClipIds: [newClipId],
      isDirty: true,
    }));

    return newClipId;
  },

  isSplitComparisonOpen: false,
  splitComparisonMode: 'vertical',
  splitComparisonPosition: 0.5,
  referenceSnapshotUrl: null,
  setSplitComparisonOpen: (isSplitComparisonOpen) => set({ isSplitComparisonOpen }),
  setSplitComparisonMode: (splitComparisonMode) => set({ splitComparisonMode }),
  setSplitComparisonPosition: (splitComparisonPosition) => set({ splitComparisonPosition }),
  setReferenceSnapshotUrl: (referenceSnapshotUrl) => set({ referenceSnapshotUrl }),
  autoMatchLook: (targetClipId) => {
    const { selectedClipId, updateClipGradingProfile } = get();
    const clipId = targetClipId || selectedClipId;
    if (!clipId) return;

    updateClipGradingProfile(clipId, {
      exposure: 0.12,
      contrast: 1.06,
      temperature: 4,
      tint: -2,
      saturation: 1.05,
      lift: { r: -0.01, g: -0.01, b: 0.02, luma: -0.02 },
      gain: { r: 0.02, g: 0.01, b: -0.01, luma: 0.01 },
    });
  },

  isScopesDrawerOpen: false,
  activeScopeType: 'all',
  setIsScopesDrawerOpen: (isScopesDrawerOpen) => set({ isScopesDrawerOpen }),
  setActiveScopeType: (activeScopeType) => set({ activeScopeType }),

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

  // Phase 11: Dedicated Filters & 3D LUTs Explorer
  filterCategories: BUILT_IN_FILTER_CATEGORIES,
  filterPresets: BUILT_IN_FILTER_PRESETS,
  activeFilterCategory: 'all',
  samplePreviewMode: 'default',
  videoFrameSnapshot: null,
  isVideoFrameLoading: false,
  activeDragFilterPreset: null,

  setActiveDragFilterPreset: (preset) => set({ activeDragFilterPreset: preset }),

  setActiveFilterCategory: (categoryId) => set({ activeFilterCategory: categoryId }),

  setSamplePreviewMode: (mode) => set({ samplePreviewMode: mode }),

  fetchFilterCatalog: async () => {
    try {
      const cats = await tauriInvoke<FilterCategory[]>('get_filter_catalog');
      const presets = await tauriInvoke<FilterPreset[]>('get_filter_presets', { category: null });
      if (cats && cats.length > 0) {
        set({ filterCategories: cats });
      }
      if (presets && presets.length > 0) {
        set({ filterPresets: presets });
      }
    } catch (err) {
      console.warn('Failed to fetch native filter catalog:', err);
    }
  },

  refreshVideoFrameSnapshot: async () => {
    const { tracks, playhead, selectedClipId, isVideoFrameLoading } = get();
    if (isVideoFrameLoading) return;

    // Find targeted clip: selected clip or top video clip under playhead
    const allClips = tracks.flatMap((t) => t.clips || []);
    let target = selectedClipId ? allClips.find((c) => c.id === selectedClipId) : null;
    if (!target) {
      const candidates = allClips.filter((c) => {
        const start = c.startPositionSeconds ?? (c.startTimeMs / 1000);
        const dur = c.durationSeconds ?? (c.durationMs / 1000);
        return playhead >= start && playhead <= start + dur;
      });
      target = candidates[candidates.length - 1] || null;
    }

    if (!target || !target.filePath || target.filePath.includes('adjustment_layer')) {
      return;
    }

    set({ isVideoFrameLoading: true });
    try {
      const startSec = target.startPositionSeconds ?? (target.startTimeMs / 1000);
      const inPtSec = target.inPointSeconds ?? (target.sourceOffsetMs ? target.sourceOffsetMs / 1000 : 0);
      const clipTimestamp = Math.max(0, playhead - startSec) + inPtSec;

      const base64Uri = await tauriInvoke<string>('capture_preview_frame', {
        sourcePath: target.filePath,
        timestampSec: clipTimestamp,
      });

      if (base64Uri) {
        set({ videoFrameSnapshot: base64Uri, isVideoFrameLoading: false });
      } else {
        set({ isVideoFrameLoading: false });
      }
    } catch (err) {
      console.warn('capture_preview_frame failed:', err);
      set({ isVideoFrameLoading: false });
    }
  },

  applyFilterPreset: (preset, targetClipId) => {
    const { tracks, selectedClipId, playhead } = get();
    const clipId = targetClipId || selectedClipId;

    set((state) => {
      let resolvedId = clipId;
      if (!resolvedId) {
        const allClips = state.tracks.flatMap((t) => t.clips || []);
        const underPlayhead = allClips.filter((c) => {
          const s = c.startPositionSeconds ?? (c.startTimeMs / 1000);
          const d = c.durationSeconds ?? (c.durationMs / 1000);
          return playhead >= s && playhead <= s + d;
        });
        const found = underPlayhead[underPlayhead.length - 1];
        if (found) resolvedId = found.id;
      }

      if (!resolvedId) return state;

      return {
        isDirty: true,
        tracks: state.tracks.map((track) => ({
          ...track,
          clips: track.clips.map((clip) => {
            if (clip.id !== resolvedId) return clip;
            return {
              ...clip,
              filterId: preset.id,
              filterName: preset.name,
              filterIntensity: preset.defaultIntensity ?? 1.0,
              filterRecipe: preset.shaderRecipe,
              lutPath: preset.lutPath || clip.lutPath,
            };
          }),
        })),
      };
    });
  },

  removeFilterFromClip: (targetClipId) => {
    const { selectedClipId } = get();
    const clipId = targetClipId || selectedClipId;
    if (!clipId) return;

    set((state) => ({
      isDirty: true,
      tracks: state.tracks.map((track) => ({
        ...track,
        clips: track.clips.map((clip) => {
          if (clip.id !== clipId) return clip;
          return {
            ...clip,
            filterId: undefined,
            filterName: undefined,
            filterIntensity: undefined,
            filterRecipe: undefined,
          };
        }),
      })),
    }));
  },

  setClipFilterIntensity: (intensity, targetClipId) => {
    const { selectedClipId } = get();
    const clipId = targetClipId || selectedClipId;
    if (!clipId) return;

    const clamped = Math.max(0, Math.min(1, intensity));
    set((state) => ({
      isDirty: true,
      tracks: state.tracks.map((track) => ({
        ...track,
        clips: track.clips.map((clip) => {
          if (clip.id !== clipId) return clip;
          return {
            ...clip,
            filterIntensity: clamped,
          };
        }),
      })),
    }));
  },

  importCustomCubeLut: async (filePath, customName) => {
    const filename = filePath.split(/[\\/]/).pop() || 'custom.cube';
    const cleanName = customName || filename.replace(/\.[^/.]+$/, '');
    const presetId = `custom_lut_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    const newPreset: FilterPreset = {
      id: presetId,
      name: cleanName,
      category: 'custom',
      categoryLabel: 'Custom / Imports',
      description: `User-imported 3D LUT profile: ${filename}`,
      filterType: 'lut3D',
      lutPath: filePath,
      shaderRecipe: {
        brightness: 0,
        contrast: 1.15,
        saturation: 1.1,
        temperature: 0,
        tint: 0,
        vignette: 0,
        grain: 0,
        sepia: 0,
        hueRotateDeg: 0,
        rgbBalance: [1, 1, 1],
        highlights: 0,
        shadows: 0,
        cssFilter: 'contrast(115%) saturate(110%)',
      },
      defaultIntensity: 1.0,
      isCustom: true,
      previewAccentColor: '#00F0FF',
    };

    set((state) => {
      const updatedPresets = [...state.filterPresets, newPreset];
      const customCount = updatedPresets.filter((p) => p.isCustom).length;
      const updatedCategories = state.filterCategories.map((cat) => {
        if (cat.id === 'custom') {
          return { ...cat, count: customCount };
        }
        if (cat.id === 'all') {
          return { ...cat, count: updatedPresets.length };
        }
        return cat;
      });
      return {
        filterPresets: updatedPresets,
        filterCategories: updatedCategories,
        activeFilterCategory: 'custom',
      };
    });
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

  setIsPlaying: (isPlaying) => {
    if (!isPlaying && get().isRecordingVoiceover) {
      get().stopVoiceoverRecording();
      return;
    }
    if (isPlaying) {
      unlockAudioContext();
    }
    set({ isPlaying });
  },
  togglePlayPause: () => {
    unlockAudioContext();
    if (get().isRecordingVoiceover) {
      get().stopVoiceoverRecording();
      return;
    }
    set((state) => ({ isPlaying: !state.isPlaying }));
  },

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
    const name =
      customName ||
      (trackType === 'text'
        ? `Text Track ${count}`
        : trackType === 'video'
        ? `Track ${count}`
        : `Audio ${count}`);
    const color =
      trackType === 'text'
        ? '#A855F7'
        : trackType === 'video'
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
      tracks: trackType === 'text' ? [newTrack, ...state.tracks] : [...state.tracks, newTrack],
      selectedTrackId: newTrack.id,
    }));

    return id;
  },

  // Phase 9: Text Overlays, Title Styling & Local Auto-Captions
  addTextClip: (trackId, text, startTime, duration, style) => {
    get().pushHistory();
    const state = get();
    let targetTrack = trackId ? state.tracks.find((t) => t.id === trackId) : null;
    if (!targetTrack) {
      targetTrack = state.tracks.find((t) => (t.trackType || t.type) === 'text') || null;
    }
    let targetTrackId = targetTrack?.id;
    if (!targetTrackId) {
      targetTrackId = get().addTrack('text', 'Title Track 1');
    }

    const startSec = startTime !== undefined ? Math.max(0, startTime) : state.playhead;
    const durSec = duration !== undefined ? Math.max(0.5, duration) : 3.0;
    const clipId = `text-${Date.now().toString(36)}-${Math.floor(Math.random() * 1000)}`;
    const defaultText = text || 'Add Your Title Here';
    const clipName = defaultText.length > 20 ? defaultText.substring(0, 20) + '...' : defaultText;

    const defaultStyle: TextClipStyle = {
      fontFamily: 'Inter',
      fontSize: 42,
      fontColor: '#FFFFFF',
      strokeColor: '#000000',
      strokeWidth: 2,
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      backgroundPadding: 8,
      positionX: 0,
      positionY: 0,
      alignment: 'center',
      lineHeight: 1.2,
      fontWeight: 'bold',
      presetStyle: 'default',
      ...style,
    };

    const newClip: Clip = {
      id: clipId,
      trackId: targetTrackId,
      name: clipName,
      filePath: 'memory://text-overlay',
      startTimeMs: Math.round(startSec * 1000),
      durationMs: Math.round(durSec * 1000),
      sourceOffsetMs: 0,
      synced: false,
      mediaType: 'video',
      startPositionSeconds: startSec,
      durationSeconds: durSec,
      inPointSeconds: 0,
      outPointSeconds: durSec,
      textContent: defaultText,
      textStyle: defaultStyle,
    };

    set((s) => ({
      tracks: s.tracks.map((t) =>
        t.id === targetTrackId ? { ...t, clips: [...t.clips, newClip] } : t
      ),
      selectedClipId: newClip.id,
      selectedTrackId: targetTrackId,
      inspectorTab: 'text',
      isDirty: true,
    }));

    return clipId;
  },

  updateTextClipContent: (clipId, text) => {
    set((state) => ({
      tracks: state.tracks.map((t) => ({
        ...t,
        clips: t.clips.map((c) =>
          c.id === clipId
            ? {
                ...c,
                textContent: text,
                name: text ? (text.length > 20 ? text.substring(0, 20) + '...' : text) : 'Text Overlay',
              }
            : c
        ),
      })),
      isDirty: true,
    }));
  },

  updateTextClipStyle: (clipId, styleUpdates) => {
    set((state) => ({
      tracks: state.tracks.map((t) => ({
        ...t,
        clips: t.clips.map((c) =>
          c.id === clipId
            ? {
                ...c,
                textStyle: {
                  fontFamily: 'Inter',
                  fontSize: 42,
                  fontColor: '#FFFFFF',
                  strokeColor: '#000000',
                  strokeWidth: 2,
                  backgroundColor: 'rgba(0, 0, 0, 0.6)',
                  backgroundPadding: 8,
                  positionX: 0,
                  positionY: 0,
                  alignment: 'center',
                  lineHeight: 1.2,
                  fontWeight: 'bold',
                  presetStyle: 'default',
                  ...(c.textStyle || {}),
                  ...styleUpdates,
                },
              }
            : c
        ),
      })),
      isDirty: true,
    }));
  },

  applyTextPreset: (clipId, preset) => {
    get().pushHistory();
    let styleUpdates: Partial<TextClipStyle> = {};
    switch (preset) {
      case 'youtube_lower_third':
        styleUpdates = {
          fontFamily: 'Montserrat',
          fontSize: 40,
          fontWeight: 'bold',
          fontColor: '#FFFFFF',
          strokeColor: '#000000',
          strokeWidth: 3,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          backgroundPadding: 12,
          alignment: 'lower_third',
          positionX: 0,
          positionY: 60,
          presetStyle: 'youtube_lower_third',
        };
        break;
      case 'cinematic':
        styleUpdates = {
          fontFamily: 'Arial',
          fontSize: 34,
          fontWeight: 'bold',
          fontColor: '#FACC15',
          strokeColor: 'rgba(0, 0, 0, 0.95)',
          strokeWidth: 2.5,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          backgroundPadding: 6,
          alignment: 'bottom_center',
          positionX: 0,
          positionY: 50,
          presetStyle: 'cinematic',
        };
        break;
      case 'karaoke':
        styleUpdates = {
          fontFamily: 'Impact',
          fontSize: 48,
          fontWeight: '800',
          fontColor: '#00F0FF',
          strokeColor: '#000000',
          strokeWidth: 4,
          backgroundColor: 'rgba(13, 14, 17, 0.85)',
          backgroundPadding: 10,
          alignment: 'center',
          positionX: 0,
          positionY: 0,
          presetStyle: 'karaoke',
        };
        break;
      default:
        styleUpdates = {
          fontFamily: 'Inter',
          fontSize: 38,
          fontWeight: 'bold',
          fontColor: '#FFFFFF',
          strokeColor: '#000000',
          strokeWidth: 2,
          backgroundColor: 'rgba(20, 22, 27, 0.7)',
          backgroundPadding: 8,
          alignment: 'center',
          positionX: 0,
          positionY: 0,
          presetStyle: 'default',
        };
        break;
    }
    get().updateTextClipStyle(clipId, styleUpdates);
  },

  isAutoCaptionModalOpen: false,
  setIsAutoCaptionModalOpen: (open) => set({ isAutoCaptionModalOpen: open }),
  isTranscribing: false,
  transcriptionProgress: 0,
  generateAutoCaptions: async (trackId, model = 'base.en') => {
    const { tracks, addTrack } = get();
    const sourceTrack = tracks.find((t) => t.id === trackId);
    if (!sourceTrack) return false;

    // Find the media clip with a valid file path
    const targetClip = sourceTrack.clips.find(
      (c) => c.filePath && !c.filePath.startsWith('memory://')
    );
    if (!targetClip) return false;

    set({ isTranscribing: true, transcriptionProgress: 15 });

    try {
      const progressTimer = setInterval(() => {
        set((s) => ({
          transcriptionProgress: Math.min(90, s.transcriptionProgress + 15),
        }));
      }, 350);

      const segments = await tauriInvoke<CaptionSegment[]>('transcribe_track_audio', {
        path: targetClip.filePath,
        model,
      });

      clearInterval(progressTimer);
      set({ transcriptionProgress: 100 });

      if (!segments || segments.length === 0) {
        set({ isTranscribing: false, isAutoCaptionModalOpen: false });
        return false;
      }

      get().pushHistory();
      const count = tracks.filter((t) => (t.trackType || t.type) === 'text').length + 1;
      const textTrackId = addTrack('text', `Captions ${count} [Whisper]`);

      const textClips: Clip[] = segments.map((seg, idx) => {
        const startSec = (seg.startMs / 1000) + (targetClip.startPositionSeconds || 0);
        const durSec = Math.max(0.6, (seg.endMs - seg.startMs) / 1000);
        return {
          id: `caption-${Date.now()}-${idx}`,
          trackId: textTrackId,
          name: seg.text,
          filePath: 'memory://text-caption',
          startTimeMs: Math.round(startSec * 1000),
          durationMs: Math.round(durSec * 1000),
          sourceOffsetMs: 0,
          synced: true,
          mediaType: 'video',
          startPositionSeconds: startSec,
          durationSeconds: durSec,
          inPointSeconds: 0,
          outPointSeconds: durSec,
          textContent: seg.text,
          textStyle: {
            fontFamily: 'Inter',
            fontSize: 34,
            fontColor: '#FFFFFF',
            strokeColor: '#000000',
            strokeWidth: 2.5,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            backgroundPadding: 8,
            positionX: 0,
            positionY: 60,
            alignment: 'bottom_center',
            lineHeight: 1.2,
            fontWeight: 'bold',
            presetStyle: 'cinematic',
          },
        };
      });

      set((s) => ({
        tracks: s.tracks.map((t) =>
          t.id === textTrackId ? { ...t, clips: textClips } : t
        ),
        isTranscribing: false,
        isAutoCaptionModalOpen: false,
        isDirty: true,
      }));

      return true;
    } catch (err) {
      console.error('Failed to generate auto-captions:', err);
      set({ isTranscribing: false, isAutoCaptionModalOpen: false });
      return false;
    }
  },

  // Phase 10: Live Voiceover Recording Engine & Mastering Suite
  isVoiceoverModalOpen: false,
  setIsVoiceoverModalOpen: (open) => set({ isVoiceoverModalOpen: open }),
  isRecordingVoiceover: false,
  voiceoverCountdown: null,
  voiceoverRecordingStartSec: 0,
  voiceoverRecordingCurrentSec: 0,
  voiceoverTargetTrackId: null,
  setVoiceoverTargetTrackId: (id) => set({ voiceoverTargetTrackId: id }),
  voiceoverSelectedDeviceId: 'default',
  setVoiceoverSelectedDeviceId: (id) => set({ voiceoverSelectedDeviceId: id }),
  voiceoverInputLevel: 0,
  voiceoverPeakDb: -60,
  liveRecordingPeaks: [],
  voiceoverMuteTimeline: true,
  setVoiceoverMuteTimeline: (mute) => set({ voiceoverMuteTimeline: mute }),
  voiceoverUseCountdown: true,
  setVoiceoverUseCountdown: (use) => set({ voiceoverUseCountdown: use }),
  availableAudioDevices: [],
  masterMeterL: -36,
  masterMeterR: -34,
  setMasterMeters: (left, right) => set({ masterMeterL: left, masterMeterR: right }),

  fetchAudioInputDevices: async () => {
    let devices: AudioDeviceInfo[] = [];
    if (isTauri) {
      try {
        const nativeDevs = await tauriInvoke<AudioDeviceInfo[]>('get_audio_input_devices');
        if (nativeDevs && nativeDevs.length > 0) {
          devices = nativeDevs;
        }
      } catch (e) {
        console.warn('Native get_audio_input_devices:', e);
      }
    }

    if (typeof navigator !== 'undefined' && navigator.mediaDevices?.enumerateDevices) {
      try {
        const mediaDevs = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = mediaDevs.filter((d) => d.kind === 'audioinput');
        for (const input of audioInputs) {
          if (!devices.some((d) => d.id === input.deviceId || (input.label && d.name === input.label))) {
            devices.push({
              id: input.deviceId,
              name: input.label || `Microphone (${input.deviceId.substring(0, 8)})`,
              isDefault: input.deviceId === 'default',
              channels: 2,
              sampleRates: [44100, 48000],
            });
          }
        }
      } catch (e) {
        console.warn('Browser media device enumeration:', e);
      }
    }

    if (devices.length === 0) {
      devices = [
        { id: 'default', name: 'Default System Microphone', isDefault: true, channels: 2, sampleRates: [48000] },
      ];
    }

    set({ availableAudioDevices: devices });
    return devices;
  },

  startVoiceoverRecording: async (explicitTrackId?: string) => {
    // If already recording, clicking toggles and stops recording
    if (get().isRecordingVoiceover) {
      await get().stopVoiceoverRecording();
      return;
    }

    const {
      tracks,
      addTrack,
      voiceoverSelectedDeviceId,
    } = get();

    let targetTrackId = explicitTrackId || get().voiceoverTargetTrackId;
    if (!targetTrackId) {
      const existingAudio = tracks.find((t) => (t.trackType || t.type) === 'audio');
      if (existingAudio) {
        targetTrackId = existingAudio.id;
      } else {
        targetTrackId = addTrack('audio', 'Voiceover 1');
      }
    }
    set({ voiceoverTargetTrackId: targetTrackId, isVoiceoverModalOpen: false });

    // Initialize real hardware microphone audio capture via Web Audio API
    try {
      if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
        const audioConstraint: MediaTrackConstraints = voiceoverSelectedDeviceId && voiceoverSelectedDeviceId !== 'default'
          ? { deviceId: { exact: voiceoverSelectedDeviceId } }
          : {};

        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            ...audioConstraint,
            echoCancellation: false,
            autoGainControl: false,
            noiseSuppression: false,
          },
          video: false,
        });

        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        const ctx = new AudioContextClass({ sampleRate: 48000 });
        const source = ctx.createMediaStreamSource(stream);
        const processor = ctx.createScriptProcessor(4096, 1, 1);
        const chunks: Float32Array[] = [];

        processor.onaudioprocess = (e) => {
          const input = e.inputBuffer.getChannelData(0);
          const copy = new Float32Array(input.length);
          copy.set(input);
          chunks.push(copy);

          // Calculate instant linear peak & decibel level for VU meters
          let maxVal = 0;
          for (let i = 0; i < input.length; i++) {
            const abs = Math.abs(input[i]);
            if (abs > maxVal) maxVal = abs;
          }
          const norm = Math.min(1.0, maxVal);
          const db = norm > 0.0001 ? 20 * Math.log10(norm) : -60;

          // Break 4096 buffer into 4 slices (~1024 samples each, ~21ms) for live waveform peaks
          const subChunkSize = 1024;
          const newPeaks: number[] = [];
          for (let i = 0; i < input.length; i += subChunkSize) {
            let sliceMax = 0;
            const end = Math.min(input.length, i + subChunkSize);
            for (let j = i; j < end; j++) {
              const abs = Math.abs(input[j]);
              if (abs > sliceMax) sliceMax = abs;
            }
            newPeaks.push(sliceMax);
          }

          set((s) => ({
            voiceoverInputLevel: norm,
            voiceoverPeakDb: Math.max(-60, db),
            liveRecordingPeaks: [...s.liveRecordingPeaks, ...newPeaks],
          }));
        };

        source.connect(processor);
        processor.connect(ctx.destination);

        activeRecordingSession = {
          stream,
          context: ctx,
          processor,
          chunks,
          sampleRate: ctx.sampleRate,
        };
      }
    } catch (err) {
      console.warn('Microphone recording stream init error:', err);
    }

    const startSec = get().playhead;
    set({
      isRecordingVoiceover: true,
      voiceoverRecordingStartSec: startSec,
      voiceoverRecordingCurrentSec: startSec,
      voiceoverCountdown: null,
      liveRecordingPeaks: [],
    });

    if (isTauri) {
      try {
        await tauriInvoke('start_audio_recording', {
          deviceId: voiceoverSelectedDeviceId !== 'default' ? voiceoverSelectedDeviceId : undefined,
          sampleRate: 48000,
        });
      } catch (e) {
        console.warn('start_audio_recording error:', e);
      }
    }

    get().setIsPlaying(true);
  },

  stopVoiceoverRecording: async () => {
    const {
      isRecordingVoiceover,
      voiceoverRecordingStartSec,
      voiceoverTargetTrackId,
      importCustomAsset,
      addAssetToTrack,
    } = get();

    if (!isRecordingVoiceover) return null;

    // Immediately halt recording state so waveform stops collecting peaks and playhead stops
    set({
      isRecordingVoiceover: false,
      isPlaying: false,
      voiceoverCountdown: null,
      voiceoverInputLevel: 0,
      voiceoverPeakDb: -60,
    });

    const endSec = get().playhead;
    const durSec = Math.max(0.5, endSec - voiceoverRecordingStartSec);

    // Stop real microphone capture and build valid RIFF 48kHz WAV audio data
    let audioDataBase64: string | undefined = undefined;
    let localBlobUrl: string = '';

    if (activeRecordingSession) {
      const session = activeRecordingSession;
      activeRecordingSession = null;
      try {
        const { stream, context, processor, chunks, sampleRate } = session;
        processor.onaudioprocess = null;
        processor.disconnect();
        stream.getTracks().forEach((tr) => tr.stop());
        if (context.state !== 'closed') {
          context.close().catch(() => {});
        }

        // Concatenate all captured PCM float chunks
        const totalSamples = chunks.reduce((acc, c) => acc + c.length, 0);
        const merged = new Float32Array(totalSamples);
        let offset = 0;
        for (const chunk of chunks) {
          merged.set(chunk, offset);
          offset += chunk.length;
        }

        if (totalSamples > 0) {
          const wavBuffer = encodeWavPcm16(merged, sampleRate || 48000);
          audioDataBase64 = arrayBufferToBase64(wavBuffer);
          const blob = new Blob([wavBuffer], { type: 'audio/wav' });
          localBlobUrl = URL.createObjectURL(blob);
        }
      } catch (err) {
        console.warn('Error packaging recorded audio:', err);
      }
    }

    let filePath = '';
    if (isTauri) {
      try {
        const res = await tauriInvoke<string>('stop_audio_recording', {
          outputFilename: `VO_${Date.now()}`,
          audioDataBase64: audioDataBase64 || undefined,
        });
        if (res) filePath = res;
      } catch (e) {
        console.warn('stop_audio_recording error:', e);
      }
    }

    if (!filePath) {
      filePath = localBlobUrl || `memory://recordings/VO_${Date.now()}.wav`;
    }

    if (filePath) {
      loadAudioBuffer(filePath);
    }

    const filename = filePath.split(/[\\/]/).pop() || `VO_${Date.now()}.wav`;
    const newAsset: MediaAsset = {
      id: `asset-vo-${Date.now()}`,
      name: filename,
      filePath,
      mediaType: 'audio',
      durationSeconds: durSec,
      durationMs: durSec * 1000,
    };
    importCustomAsset(newAsset);

    if (voiceoverTargetTrackId) {
      addAssetToTrack(newAsset.id, voiceoverTargetTrackId, voiceoverRecordingStartSec);

      // Select newly added clip and set Inspector to 'audio' tab by default
      setTimeout(() => {
        const updatedTracks = get().tracks;
        const targetTrack = updatedTracks.find((t) => t.id === voiceoverTargetTrackId);
        const addedClip = targetTrack?.clips.find(
          (c) => c.filePath === filePath || c.name === filename
        );
        if (addedClip) {
          set({
            selectedClipId: addedClip.id,
            selectedClipIds: [addedClip.id],
            inspectorTab: 'audio',
          });
        }
      }, 60);
    }

    set({
      liveRecordingPeaks: [],
      isVoiceoverModalOpen: false,
    });

    return filePath;
  },

  cancelVoiceoverRecording: () => {
    if (activeRecordingSession) {
      try {
        activeRecordingSession.processor.onaudioprocess = null;
        activeRecordingSession.processor.disconnect();
        activeRecordingSession.stream.getTracks().forEach((tr) => tr.stop());
        if (activeRecordingSession.context.state !== 'closed') {
          activeRecordingSession.context.close().catch(() => {});
        }
      } catch {}
      activeRecordingSession = null;
    }
    if (isTauri) {
      tauriInvoke('stop_audio_recording').catch(() => {});
    }
    set({
      isRecordingVoiceover: false,
      isPlaying: false,
      voiceoverCountdown: null,
      voiceoverInputLevel: 0,
      voiceoverPeakDb: -60,
      liveRecordingPeaks: [],
      isVoiceoverModalOpen: false,
    });
  },

  updateClipAudioProcessing: (clipId, settings) => {
    get().pushHistory();
    set((state) => ({
      tracks: state.tracks.map((t) => ({
        ...t,
        clips: t.clips.map((c) => {
          if (c.id !== clipId) return c;
          const current = c.audioProcessing || {
            gainDb: c.volumeDb ?? 0,
            pan: c.pan ?? 0,
            bassGain: c.bassGain ?? 0,
            midGain: c.midGain ?? 0,
            trebleGain: c.trebleGain ?? 0,
            volumeKeyframes: c.volumeKeyframes || [],
          };
          const updated: AudioProcessingSettings = {
            ...current,
            ...settings,
          };
          return {
            ...c,
            audioProcessing: updated,
            volumeDb: updated.gainDb,
            pan: updated.pan,
            bassGain: updated.bassGain,
            midGain: updated.midGain,
            trebleGain: updated.trebleGain,
            volumeKeyframes: updated.volumeKeyframes,
          };
        }),
      })),
    }));
  },

  captureNoiseProfile: async (clipId, startSec, durationSec) => {
    let targetClip: Clip | null = null;
    for (const t of get().tracks) {
      const c = t.clips.find((item) => item.id === clipId);
      if (c) {
        targetClip = c;
        break;
      }
    }
    if (!targetClip || !targetClip.filePath) return false;

    const playhead = get().playhead;
    const clipStart = targetClip.startPositionSeconds || 0;
    const inPoint = targetClip.inPointSeconds || 0;
    const dur = durationSec ?? 1.5;
    const sampleStart = (startSec !== undefined ? startSec : Math.max(0, playhead - clipStart)) + inPoint;

    try {
      if (isTauri) {
        const res = await tauriInvoke<[string, string]>('capture_noise_profile', {
          sourcePath: targetClip.filePath,
          startSec: sampleStart,
          durationSec: dur,
        });
        if (res && res[0]) {
          const [profilePath, roomTonePath] = res;
          const currentProfile = targetClip.audioProcessing?.noiseProfile || {
            noiseReductionEnabled: true,
            reductionIntensityDb: 12.0,
            auditionResidue: false,
            ambientRecoveryEnabled: true,
            ambientFillIntensity: 0.25,
            silenceCutThresholdDb: -35.0,
            silenceMinDurationSec: 0.6,
            cutMarginPaddingMs: 50,
          };
          get().updateClipAudioProcessing(clipId, {
            noiseProfile: {
              ...currentProfile,
              noiseReductionEnabled: true,
              noiseProfilePath: profilePath,
              roomToneLoopPath: roomTonePath,
              profileDurationSec: dur,
            },
          });
          return true;
        }
      } else {
        // Web simulation fallback
        const currentProfile = targetClip.audioProcessing?.noiseProfile || {
          noiseReductionEnabled: true,
          reductionIntensityDb: 12.0,
          auditionResidue: false,
          ambientRecoveryEnabled: true,
          ambientFillIntensity: 0.25,
          silenceCutThresholdDb: -35.0,
          silenceMinDurationSec: 0.6,
          cutMarginPaddingMs: 50,
        };
        get().updateClipAudioProcessing(clipId, {
          noiseProfile: {
            ...currentProfile,
            noiseReductionEnabled: true,
            noiseProfilePath: `web_noise_profile_${Date.now()}`,
            roomToneLoopPath: `web_room_tone_${Date.now()}`,
            profileDurationSec: dur,
          },
        });
        return true;
      }
    } catch (e) {
      console.error('Failed to capture noise profile:', e);
    }
    return false;
  },

  clearNoiseProfile: (clipId) => {
    let targetClip: Clip | null = null;
    for (const t of get().tracks) {
      const c = t.clips.find((item) => item.id === clipId);
      if (c) {
        targetClip = c;
        break;
      }
    }
    if (!targetClip) return;
    const existing = targetClip.audioProcessing?.noiseProfile;
    if (existing) {
      get().updateClipAudioProcessing(clipId, {
        noiseProfile: {
          ...existing,
          noiseReductionEnabled: false,
          noiseProfilePath: undefined,
          roomToneLoopPath: undefined,
          profileDurationSec: undefined,
        },
      });
    }
  },

  updateNoiseProfileSettings: (clipId, updates) => {
    let targetClip: Clip | null = null;
    for (const t of get().tracks) {
      const c = t.clips.find((item) => item.id === clipId);
      if (c) {
        targetClip = c;
        break;
      }
    }
    if (!targetClip) return;
    const current = targetClip.audioProcessing?.noiseProfile || {
      noiseReductionEnabled: false,
      reductionIntensityDb: 12.0,
      auditionResidue: false,
      ambientRecoveryEnabled: false,
      ambientFillIntensity: 0.25,
      silenceCutThresholdDb: -35.0,
      silenceMinDurationSec: 0.6,
      cutMarginPaddingMs: 50,
    };
    get().updateClipAudioProcessing(clipId, {
      noiseProfile: {
        ...current,
        ...updates,
      },
    });
  },

  previewSpectralDenoise: async (
    clipId,
    startSec,
    durationSec,
    reductionDb,
    sensitivity = 6.0,
    smoothingBands = 6,
    auditionResidue = false
  ) => {
    let targetClip: Clip | null = null;
    for (const t of get().tracks) {
      const c = t.clips.find((item) => item.id === clipId);
      if (c) {
        targetClip = c;
        break;
      }
    }
    if (!targetClip || !targetClip.filePath) return null;

    const inPoint = targetClip.inPointSeconds || 0;
    const actualStart = Math.max(0, startSec + inPoint);
    const np = targetClip.audioProcessing?.noiseProfile;
    const profilePath = np?.noiseProfilePath || null;

    if (isTauri) {
      try {
        const res = await tauriInvoke<string>('preview_spectral_denoise', {
          sourcePath: targetClip.filePath,
          profilePath,
          startSec: actualStart,
          durationSec,
          reductionDb,
          sensitivity,
          smoothingBands,
          auditionNoise: auditionResidue,
        });
        return res || null;
      } catch (e) {
        console.error('Failed to generate spectral denoise preview:', e);
      }
    }
    return null;
  },

  applyClipSpectralDenoise: async (clipId) => {
    let targetClip: Clip | null = null;
    for (const t of get().tracks) {
      const c = t.clips.find((item) => item.id === clipId);
      if (c) {
        targetClip = c;
        break;
      }
    }
    if (!targetClip || !targetClip.filePath) return null;
    const np = targetClip.audioProcessing?.noiseProfile;
    const redDb = np?.reductionIntensityDb ?? 12.0;
    const sens = np?.sensitivity ?? 6.0;
    const gs = np?.frequencySmoothingBands ?? 6;
    const residue = np?.auditionResidue ?? false;
    const profilePath = np?.noiseProfilePath || '';

    if (isTauri) {
      try {
        const outWav = await tauriInvoke<string>('apply_spectral_denoise', {
          inputPath: targetClip.filePath,
          profilePath,
          reductionDb: redDb,
          sensitivity: sens,
          smoothingBands: gs,
          auditionNoise: residue,
        });
        if (outWav) {
          get().updateNoiseProfileSettings(clipId, {
            noiseReductionEnabled: true,
            denoisedAudioPath: outWav,
          });
          // Immediately pre-fetch cleaned audio waveform peaks so timeline tracks render clean waveform instantly
          get().fetchWaveformData(outWav);
          return outWav;
        }
      } catch (e) {
        console.error('Failed to apply spectral denoise to clip:', e);
      }
    } else {
      get().updateNoiseProfileSettings(clipId, {
        noiseReductionEnabled: true,
        denoisedAudioPath: targetClip.filePath,
      });
      return targetClip.filePath;
    }
    return null;
  },

  runSilenceAutoCutWithAmbientFill: async (clipId) => {
    let targetClip: Clip | null = null;
    let targetTrack: MediaTrack | null = null;
    for (const t of get().tracks) {
      const c = t.clips.find((item) => item.id === clipId);
      if (c) {
        targetClip = c;
        targetTrack = t;
        break;
      }
    }
    if (!targetClip || !targetTrack || !targetClip.filePath) return null;

    const np = targetClip.audioProcessing?.noiseProfile;
    const thresholdDb = np?.silenceCutThresholdDb ?? -35.0;
    const minDurationSec = np?.silenceMinDurationSec ?? 0.6;
    const paddingMs = np?.cutMarginPaddingMs ?? 50;
    const ambientRecovery = np?.ambientRecoveryEnabled ?? false;
    const ambientFillIntensity = np?.ambientFillIntensity ?? 0.25;
    const roomTonePath = np?.roomToneLoopPath;

    try {
      get().pushHistory();
      let res: any = null;
      const totalDurationSec = targetClip.durationSeconds || (targetClip.durationMs ? targetClip.durationMs / 1000 : 10);

      if (isTauri) {
        res = await tauriInvoke<any>('auto_cut_silence_with_ambient_fill', {
          sourcePath: targetClip.filePath,
          totalDurationSec,
          thresholdDb,
          minDurationSec,
          paddingMs,
          ambientRecovery,
          ambientFillIntensity,
          roomTonePath: roomTonePath || null,
        });
      } else {
        // Fallback simulation: split into 2 speech segments
        const mid = totalDurationSec / 2;
        res = {
          speechIntervals: [
            { startSec: 0, endSec: mid - 0.4, durationSec: mid - 0.4 },
            { startSec: mid + 0.4, endSec: totalDurationSec, durationSec: totalDurationSec - mid - 0.4 },
          ],
          cutIntervals: [{ startSec: mid - 0.4, endSec: mid + 0.4, durationSec: 0.8 }],
          ambientBridges: ambientRecovery && roomTonePath ? [{
            startSec: mid - 0.4,
            durationSec: 0.8,
            audioFilePath: roomTonePath,
            gain: ambientFillIntensity,
          }] : [],
          message: 'Simulated silence auto-cut on Web preview',
        };
      }

      if (res && res.speechIntervals && res.speechIntervals.length > 0) {
        const speechSlices: Clip[] = res.speechIntervals.map((span: any, idx: number) => {
          const sliceId = `${targetClip!.id}_speech_${idx}_${Math.random().toString(36).substring(2, 6)}`;
          const dur = span.durationSec;
          const startSec = (targetClip!.startPositionSeconds || 0) + span.startSec;
          return {
            ...targetClip!,
            id: sliceId,
            name: `${targetClip!.name} [Cut ${idx + 1}]`,
            startPositionSeconds: startSec,
            startTimeMs: Math.round(startSec * 1000),
            durationSeconds: dur,
            durationMs: Math.round(dur * 1000),
            inPointSeconds: (targetClip!.inPointSeconds || 0) + span.startSec,
            outPointSeconds: (targetClip!.inPointSeconds || 0) + span.endSec,
          };
        });

        // Insert ambient bridge clips if present
        let updatedTracks = get().tracks.map((t) => {
          if (t.id !== targetTrack!.id) return t;
          const otherClips = t.clips.filter((c) => c.id !== targetClip!.id);
          return {
            ...t,
            clips: [...otherClips, ...speechSlices],
          };
        });

        if (res.ambientBridges && res.ambientBridges.length > 0) {
          let ambientTrack = updatedTracks.find(
            (t) => (t.trackType === 'audio' || (t as any).type === 'audio') && t.name.toLowerCase().includes('ambient')
          );
          if (!ambientTrack) {
            ambientTrack = updatedTracks.find(
              (t) => (t.trackType === 'audio' || (t as any).type === 'audio') && t.id !== targetTrack!.id
            );
          }

          if (ambientTrack) {
            const bridgeClips: Clip[] = res.ambientBridges.map((b: any, bIdx: number) => ({
              id: `ambient_bridge_${Date.now()}_${bIdx}`,
              name: 'Ambient Noise Bed',
              trackId: ambientTrack!.id,
              filePath: b.audioFilePath,
              mediaType: 'audio',
              startPositionSeconds: (targetClip!.startPositionSeconds || 0) + b.startSec,
              durationSeconds: b.durationSec,
              inPoint: 0,
              outPoint: b.durationSec,
              volumeDb: Math.round(20 * Math.log10(Math.max(0.01, b.gain))),
            }));
            updatedTracks = updatedTracks.map((t) => {
              if (t.id !== ambientTrack!.id) return t;
              return {
                ...t,
                clips: [...t.clips, ...bridgeClips],
              };
            });
          }
        }

        set({
          tracks: updatedTracks,
          selectedClipId: speechSlices[0]?.id || null,
          selectedClipIds: speechSlices[0]?.id ? [speechSlices[0].id] : [],
          isDirty: true,
        });

        return res.message || 'Auto-cut silence completed successfully';
      }
    } catch (e: any) {
      console.error('Failed to run silence auto-cut:', e);
      return `Error: ${e?.message || e}`;
    }
    return null;
  },

  addOrUpdateVolumeKeyframe: (clipId, time, value) => {
    get().pushHistory();
    set((state) => ({
      tracks: state.tracks.map((t) => ({
        ...t,
        clips: t.clips.map((c) => {
          if (c.id !== clipId) return c;
          const currentKfs = c.volumeKeyframes ? [...c.volumeKeyframes] : [];
          const roundedTime = Number(time.toFixed(3));
          const existingIdx = currentKfs.findIndex(
            (k) => Math.abs(k.time - roundedTime) < 0.05
          );
          if (existingIdx >= 0) {
            currentKfs[existingIdx] = { time: roundedTime, value: Number(value.toFixed(1)) };
          } else {
            currentKfs.push({ time: roundedTime, value: Number(value.toFixed(1)) });
            currentKfs.sort((a, b) => a.time - b.time);
          }
          return {
            ...c,
            volumeKeyframes: currentKfs,
            audioProcessing: {
              ...(c.audioProcessing || {
                gainDb: c.volumeDb ?? 0,
                pan: c.pan ?? 0,
                bassGain: 0,
                midGain: 0,
                trebleGain: 0,
                volumeKeyframes: [],
              }),
              volumeKeyframes: currentKfs,
            },
          };
        }),
      })),
    }));
  },

  removeVolumeKeyframe: (clipId, time) => {
    get().pushHistory();
    set((state) => ({
      tracks: state.tracks.map((t) => ({
        ...t,
        clips: t.clips.map((c) => {
          if (c.id !== clipId || !c.volumeKeyframes) return c;
          const filtered = c.volumeKeyframes.filter(
            (k) => Math.abs(k.time - time) >= 0.05
          );
          return {
            ...c,
            volumeKeyframes: filtered,
            audioProcessing: c.audioProcessing
              ? { ...c.audioProcessing, volumeKeyframes: filtered }
              : undefined,
          };
        }),
      })),
    }));
  },

  updateTrackDucking: (trackId, config) => {
    get().pushHistory();
    set((state) => ({
      tracks: state.tracks.map((t) => {
        if (t.id !== trackId) return t;
        const current = t.ducking || {
          duckingEnabled: false,
          attenuationDb: -14.0,
          attackMs: 50,
          releaseMs: 300,
        };
        return {
          ...t,
          ducking: {
            ...current,
            ...config,
          },
        };
      }),
    }));
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
    const { playhead, tracks, selectedClipId, selectedClipIds } = get();

    // 1. Determine which clips should be targeted for splitting
    let targetIds: string[] = [];

    if (Array.isArray(targetClipId)) {
      targetIds = targetClipId;
    } else if (typeof targetClipId === 'string' && targetClipId) {
      if (selectedClipIds && selectedClipIds.length > 1 && selectedClipIds.includes(targetClipId)) {
        targetIds = [...selectedClipIds];
      } else {
        targetIds = [targetClipId];
      }
    } else if (selectedClipIds && selectedClipIds.length > 0) {
      targetIds = [...selectedClipIds];
    } else if (selectedClipId) {
      targetIds = [selectedClipId];
    } else {
      // If no clips are selected, fallback to splitting all unlocked clips under the playhead
      targetIds = tracks
        .filter((t) => !t.locked && !t.isLocked)
        .flatMap((t) => t.clips)
        .filter((c) => {
          const start = c.startPositionSeconds || 0;
          const dur = c.durationSeconds || 0;
          return playhead > start + 0.005 && playhead < start + dur - 0.005;
        })
        .map((c) => c.id);
    }

    if (targetIds.length === 0) return;

    const targetSet = new Set(targetIds);
    let canSplitAny = false;

    // Verify at least one target clip actually spans the playhead
    for (const track of tracks) {
      if (track.locked || track.isLocked) continue;
      for (const clip of track.clips) {
        if (targetSet.has(clip.id)) {
          const clipStart = clip.startPositionSeconds || 0;
          const clipDur = clip.durationSeconds || 0;
          const clipEnd = clipStart + clipDur;
          if (playhead > clipStart + 0.005 && playhead < clipEnd - 0.005) {
            canSplitAny = true;
            break;
          }
        }
      }
      if (canSplitAny) break;
    }

    if (!canSplitAny) return;

    get().pushHistory();

    const newlyCreatedSecondPartIds: string[] = [];
    const splitMap = new Map<string, string>(); // oldId -> secondPartId

    set((state) => {
      const updatedTracks = state.tracks.map((track) => {
        if (track.locked || track.isLocked) return track;

        let trackClipsModified = false;
        const newClips: Clip[] = [];

        for (const clip of track.clips) {
          if (!targetSet.has(clip.id)) {
            newClips.push(clip);
            continue;
          }

          const clipStart = clip.startPositionSeconds || 0;
          const clipDur = clip.durationSeconds || 0;
          const clipEnd = clipStart + clipDur;

          // Ensure playhead is within clip boundaries (at least 5ms from edge)
          if (playhead <= clipStart + 0.005 || playhead >= clipEnd - 0.005) {
            newClips.push(clip);
            continue;
          }

          trackClipsModified = true;
          const splitOffsetSec = playhead - clipStart;
          const splitOffsetMs = Math.round(splitOffsetSec * 1000);
          const remainingSec = clipDur - splitOffsetSec;
          const remainingMs = Math.round(remainingSec * 1000);

          // Volume keyframe envelope distribution
          const firstKeyframes = clip.volumeKeyframes
            ? clip.volumeKeyframes.filter((k) => k.time <= splitOffsetSec)
            : undefined;
          const secondKeyframes = clip.volumeKeyframes
            ? clip.volumeKeyframes
                .filter((k) => k.time >= splitOffsetSec)
                .map((k) => ({
                  ...k,
                  time: Number((k.time - splitOffsetSec).toFixed(3)),
                }))
            : undefined;

          // Waveform peak distribution
          let firstPeaks = clip.waveformPeaks;
          let secondPeaks = clip.waveformPeaks;
          if (clip.waveformPeaks && clip.waveformPeaks.length > 0 && clipDur > 0) {
            const ratio = Math.max(0, Math.min(1, splitOffsetSec / clipDur));
            const splitIdx = Math.round(clip.waveformPeaks.length * ratio);
            firstPeaks = clip.waveformPeaks.slice(0, splitIdx);
            secondPeaks = clip.waveformPeaks.slice(splitIdx);
          }

          const firstPart: Clip = {
            ...clip,
            durationSeconds: splitOffsetSec,
            durationMs: splitOffsetMs,
            outPointSeconds: (clip.inPointSeconds || 0) + splitOffsetSec,
            volumeKeyframes: firstKeyframes,
            waveformPeaks: firstPeaks,
          };

          const secondPartId = `clip-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
          newlyCreatedSecondPartIds.push(secondPartId);
          splitMap.set(clip.id, secondPartId);

          const secondPart: Clip = {
            ...clip,
            id: secondPartId,
            name: clip.name.includes('(Part') ? clip.name : `${clip.name} (Part 2)`,
            startPositionSeconds: playhead,
            startTimeMs: Math.round(playhead * 1000),
            inPointSeconds: (clip.inPointSeconds || 0) + splitOffsetSec,
            sourceOffsetMs: (clip.sourceOffsetMs || 0) + splitOffsetMs,
            durationSeconds: remainingSec,
            durationMs: remainingMs,
            volumeKeyframes: secondKeyframes,
            waveformPeaks: secondPeaks,
          };

          newClips.push(firstPart, secondPart);
        }

        if (!trackClipsModified) return track;
        return { ...track, clips: newClips };
      });

      // Update transitions that originate from the split clips
      const updatedTransitions = (state.transitions || []).map((t) => {
        if (splitMap.has(t.fromClipId)) {
          return { ...t, fromClipId: splitMap.get(t.fromClipId)! };
        }
        return t;
      });

      return {
        tracks: updatedTracks,
        transitions: updatedTransitions,
        selectedClipIds: newlyCreatedSecondPartIds.length > 0 ? newlyCreatedSecondPartIds : state.selectedClipIds,
        selectedClipId: newlyCreatedSecondPartIds.length > 0 ? newlyCreatedSecondPartIds[0] : state.selectedClipId,
        isDirty: true,
      };
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
        if ((parentTrack.trackType || parentTrack.type) === 'text' || targetClip.textContent !== undefined) {
          updates.inspectorTab = 'text';
        }
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
          const updated = {
            ...clip,
            ...adjustments,
          };
          if (adjustments.volumeDb !== undefined) {
            updated.audioProcessing = {
              gainDb: adjustments.volumeDb,
              pan: updated.audioProcessing?.pan ?? updated.pan ?? 0,
              bassGain: updated.audioProcessing?.bassGain ?? updated.bassGain ?? 0,
              midGain: updated.audioProcessing?.midGain ?? updated.midGain ?? 0,
              trebleGain: updated.audioProcessing?.trebleGain ?? updated.trebleGain ?? 0,
              volumeKeyframes: updated.audioProcessing?.volumeKeyframes ?? updated.volumeKeyframes ?? [],
            };
          }
          return updated;
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
    const { tracks, transitions, playhead, selectedClipId, selectedClipIds, activeCameraTrackId, project, historyPast, masterGrading } = get();
    const snapshot: TimelineSnapshot = {
      tracks: JSON.parse(JSON.stringify(tracks)),
      transitions: JSON.parse(JSON.stringify(transitions || [])),
      playhead,
      selectedClipId,
      selectedClipIds: [...selectedClipIds],
      activeCameraTrackId,
      project: JSON.parse(JSON.stringify(project)),
      masterGrading: masterGrading ? JSON.parse(JSON.stringify(masterGrading)) : null,
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
    const { historyPast, historyFuture, tracks, transitions, playhead, selectedClipId, selectedClipIds, activeCameraTrackId, project, masterGrading } = get();
    if (historyPast.length === 0) return;

    const currentSnapshot: TimelineSnapshot = {
      tracks: JSON.parse(JSON.stringify(tracks)),
      transitions: JSON.parse(JSON.stringify(transitions || [])),
      playhead,
      selectedClipId,
      selectedClipIds: [...selectedClipIds],
      activeCameraTrackId,
      project: JSON.parse(JSON.stringify(project)),
      masterGrading: masterGrading ? JSON.parse(JSON.stringify(masterGrading)) : null,
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
      masterGrading: previous.masterGrading || null,
      isDirty: true,
    });
    updateAppTitle(previous.project.name || 'Untitled Project', true, get().currentProjectPath);
  },

  redo: () => {
    const { historyPast, historyFuture, tracks, transitions, playhead, selectedClipId, selectedClipIds, activeCameraTrackId, project, masterGrading } = get();
    if (historyFuture.length === 0) return;

    const currentSnapshot: TimelineSnapshot = {
      tracks: JSON.parse(JSON.stringify(tracks)),
      transitions: JSON.parse(JSON.stringify(transitions || [])),
      playhead,
      selectedClipId,
      selectedClipIds: [...selectedClipIds],
      activeCameraTrackId,
      project: JSON.parse(JSON.stringify(project)),
      masterGrading: masterGrading ? JSON.parse(JSON.stringify(masterGrading)) : null,
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
      masterGrading: next.masterGrading || null,
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
    set((state) => {
      const playhead = state.playhead;
      const tracks = state.tracks.map((track) => ({
        ...track,
        clips: track.clips.map((clip) => {
          if (clip.id !== clipId) return clip;

          const newScale = transform.scale !== undefined ? transform.scale : clip.scale ?? 1.0;
          const newPosX = transform.positionX !== undefined ? transform.positionX : clip.positionX ?? 0;
          const newPosY = transform.positionY !== undefined ? transform.positionY : clip.positionY ?? 0;
          const newRot = transform.rotation !== undefined ? transform.rotation : clip.rotation ?? 0;
          const newOp = transform.opacity !== undefined ? transform.opacity : clip.opacity ?? 1.0;

          const propsToUpdate: Record<string, number> = {};
          if (transform.scale !== undefined) propsToUpdate['scale'] = transform.scale;
          if (transform.positionX !== undefined) propsToUpdate['position_x'] = transform.positionX;
          if (transform.positionY !== undefined) propsToUpdate['position_y'] = transform.positionY;
          if (transform.rotation !== undefined) propsToUpdate['rotation'] = transform.rotation;
          if (transform.opacity !== undefined) propsToUpdate['opacity'] = transform.opacity;

          let updatedTracks = clip.keyframeTracks ? [...clip.keyframeTracks] : undefined;

          // If clip has keyframes and playhead is on this clip, automatically record/update keyframe at playhead!
          const startSec = clip.startPositionSeconds ?? (clip.startTimeMs / 1000);
          const durSec = clip.durationSeconds ?? (clip.durationMs / 1000);

          if (updatedTracks && updatedTracks.some((t) => t.keyframes.length > 0)) {
            if (playhead >= startSec - 0.05 && playhead <= startSec + durSec + 0.05) {
              const relTime = Math.max(0, Math.min(durSec, playhead - startSec));
              const cleanTime = Number(relTime.toFixed(3));

              const tracksCopy = updatedTracks.map((t) => ({ ...t, keyframes: [...t.keyframes] }));
              for (const [property, val] of Object.entries(propsToUpdate)) {
                let tIdx = tracksCopy.findIndex((t) => t.property === property);
                if (tIdx >= 0) {
                  // Property has an active keyframe track: update keyframe at this time or insert new keyframe
                  const kfIdx = tracksCopy[tIdx].keyframes.findIndex((k) => Math.abs(k.time - cleanTime) < 0.08);
                  if (kfIdx >= 0) {
                    tracksCopy[tIdx].keyframes[kfIdx] = {
                      ...tracksCopy[tIdx].keyframes[kfIdx],
                      time: cleanTime,
                      value: val,
                    };
                  } else {
                    tracksCopy[tIdx].keyframes.push({ time: cleanTime, value: val, easing: 'linear' });
                    tracksCopy[tIdx].keyframes.sort((a, b) => a.time - b.time);
                  }
                } else {
                  // If other properties have keyframes at cleanTime, add keyframe for this property to override at this time
                  const hasKeyframeAtThisTime = tracksCopy.some((t) =>
                    t.keyframes.some((k) => Math.abs(k.time - cleanTime) < 0.08)
                  );
                  if (hasKeyframeAtThisTime) {
                    tracksCopy.push({
                      property,
                      keyframes: [{ time: cleanTime, value: val, easing: 'linear' }],
                    });
                  }
                }
              }
              updatedTracks = tracksCopy;
            }
          }

          return {
            ...clip,
            scale: newScale,
            positionX: newPosX,
            positionY: newPosY,
            rotation: newRot,
            opacity: newOp,
            keyframeTracks: updatedTracks,
          };
        }),
      }));
      return { tracks, isDirty: true };
    });
  },

  addOrUpdateGlobalKeyframe: (clipId, time, transform) => {
    set((state) => {
      const tracks = state.tracks.map((track) => ({
        ...track,
        clips: track.clips.map((clip) => {
          if (clip.id !== clipId) return clip;
          const startSec = clip.startPositionSeconds ?? (clip.startTimeMs / 1000);
          const durSec = clip.durationSeconds ?? (clip.durationMs / 1000);
          const speed = clip.speedProfile?.speedMultiplier ?? 1.0;

          const relTime = time !== undefined
            ? time
            : Math.max(0, Math.min(durSec, state.playhead - startSec));
          const cleanTime = Number(relTime.toFixed(3));

          const interp = getInterpolatedClipTransform(clip, startSec + cleanTime);
          const finalScale = transform?.scale ?? interp.scale;
          const finalPosX = transform?.positionX ?? interp.positionX;
          const finalPosY = transform?.positionY ?? interp.positionY;
          const finalRot = transform?.rotation ?? interp.rotation;
          const finalOp = transform?.opacity ?? interp.opacity;

          const propMap: Record<string, number> = {
            scale: finalScale,
            position_x: finalPosX,
            position_y: finalPosY,
            rotation: finalRot,
            opacity: finalOp,
          };

          const currentTracks = clip.keyframeTracks
            ? clip.keyframeTracks.map((t) => ({ ...t, keyframes: [...t.keyframes] }))
            : [];

          for (const [property, val] of Object.entries(propMap)) {
            let tIdx = currentTracks.findIndex((t) => t.property === property);
            if (tIdx < 0) {
              currentTracks.push({ property, keyframes: [] });
              tIdx = currentTracks.length - 1;
            }
            const existingKfs = currentTracks[tIdx].keyframes;
            const kfIdx = existingKfs.findIndex((k) => Math.abs(k.time - cleanTime) < 0.08);
            if (kfIdx >= 0) {
              existingKfs[kfIdx] = { time: cleanTime, value: val, easing: 'linear' };
            } else {
              existingKfs.push({ time: cleanTime, value: val, easing: 'linear' });
              existingKfs.sort((a, b) => a.time - b.time);
            }
          }

          return {
            ...clip,
            scale: finalScale,
            positionX: finalPosX,
            positionY: finalPosY,
            rotation: finalRot,
            opacity: finalOp,
            keyframeTracks: currentTracks,
          };
        }),
      }));
      return { tracks, isDirty: true };
    });
  },

  removeGlobalKeyframe: (clipId, time) => {
    set((state) => ({
      tracks: state.tracks.map((track) => ({
        ...track,
        clips: track.clips.map((clip) => {
          if (clip.id !== clipId || !clip.keyframeTracks) return clip;
          const updatedTracks = clip.keyframeTracks
            .map((t) => ({
              ...t,
              keyframes: t.keyframes.filter((k) => Math.abs(k.time - time) >= 0.08),
            }))
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

  moveGlobalKeyframe: (clipId, oldTime, newTime) => {
    set((state) => ({
      tracks: state.tracks.map((track) => ({
        ...track,
        clips: track.clips.map((clip) => {
          if (clip.id !== clipId || !clip.keyframeTracks) return clip;
          const durSec = clip.durationSeconds ?? (clip.durationMs / 1000);
          const clampedNewTime = Math.max(0, Math.min(durSec, Number(newTime.toFixed(3))));

          const updatedTracks = clip.keyframeTracks.map((t) => {
            const kfs = t.keyframes.map((k) => {
              if (Math.abs(k.time - oldTime) < 0.08) {
                return { ...k, time: clampedNewTime };
              }
              return k;
            });
            kfs.sort((a, b) => a.time - b.time);
            return { ...t, keyframes: kfs };
          });

          return {
            ...clip,
            keyframeTracks: updatedTracks,
          };
        }),
      })),
      isDirty: true,
    }));
  },

  clearAllKeyframes: (clipId) => {
    set((state) => ({
      tracks: state.tracks.map((track) => ({
        ...track,
        clips: track.clips.map((clip) => {
          if (clip.id !== clipId) return clip;
          return {
            ...clip,
            keyframeTracks: undefined,
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
          const cleanTime = Number(time.toFixed(3));

          if (trackIdx >= 0) {
            const existingKfs = [...currentTracks[trackIdx].keyframes];
            const kfIdx = existingKfs.findIndex((k) => Math.abs(k.time - cleanTime) < 0.08);
            if (kfIdx >= 0) {
              existingKfs[kfIdx] = { time: cleanTime, value, easing };
            } else {
              existingKfs.push({ time: cleanTime, value, easing });
              existingKfs.sort((a, b) => a.time - b.time);
            }
            currentTracks[trackIdx] = { property, keyframes: existingKfs };
          } else {
            currentTracks.push({ property, keyframes: [{ time: cleanTime, value, easing }] });
          }

          const propUpdates: Partial<Clip> = {};
          if (property === 'scale') propUpdates.scale = value;
          if (property === 'position_x') propUpdates.positionX = value;
          if (property === 'position_y') propUpdates.positionY = value;
          if (property === 'rotation') propUpdates.rotation = value;
          if (property === 'opacity') propUpdates.opacity = value;

          return {
            ...clip,
            ...propUpdates,
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
                keyframes: t.keyframes.filter((k) => Math.abs(k.time - time) >= 0.08),
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

          const kfRatio = oldDur > 0 ? (newDurSec / oldDur) : 1;
          const updatedKeyframeTracks = clip.keyframeTracks?.map((track) => ({
            ...track,
            keyframes: track.keyframes.map((k) => ({
              ...k,
              time: Number((k.time * kfRatio).toFixed(3)),
            })),
          }));

          return {
            ...clip,
            durationSeconds: newDurSec,
            durationMs: newDurMs,
            speedProfile: {
              speedMultiplier,
              pitchCorrection,
            },
            ...(updatedKeyframeTracks ? { keyframeTracks: updatedKeyframeTracks } : {}),
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

  updateClipStabilization: (clipId, settingsUpdates) => {
    set((state) => ({
      tracks: state.tracks.map((track) => ({
        ...track,
        clips: track.clips.map((clip) => {
          if (clip.id !== clipId) return clip;
          const current = clip.stabilization ?? {
            enabled: false,
            intensity: 0.5,
            smoothness: 15,
            tripodMode: false,
          };
          return {
            ...clip,
            stabilization: {
              ...current,
              ...settingsUpdates,
            },
          };
        }),
      })),
      isDirty: true,
    }));
  },
}));
