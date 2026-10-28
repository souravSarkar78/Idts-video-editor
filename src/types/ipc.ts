/**
 * Antigravity Desktop Video Editor - Shared IPC Data Contracts
 * Mirror of Rust IPC contracts in `src-tauri/src/models/ipc.rs`
 */

export type TrackType = 'video' | 'audio' | 'text';

export type MediaType = 'video' | 'audio' | 'image' | 'adjustment' | 'adjustment_layer';

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

  // Phase 8: Motion Transform Controls, Keyframing, Speed Ramping, Lens Effects
  scale?: number;
  positionX?: number;
  positionY?: number;
  rotation?: number;
  opacity?: number;
  keyframeTracks?: KeyframeTrack[];
  speedProfile?: SpeedProfile;
  lensEffects?: LensEffects;

  // Phase 9: Text Overlays, Title Styling & Auto-Captions
  textContent?: string;
  textStyle?: TextClipStyle;

  // Phase 10: Audio Mastering Suite, EQ, Pan & Volume Envelopes
  pan?: number; // -1.0 (Full Left) to +1.0 (Full Right)
  bassGain?: number; // -15.0 to +15.0 dB (100Hz)
  midGain?: number; // -15.0 to +15.0 dB (1kHz)
  trebleGain?: number; // -15.0 to +15.0 dB (8kHz)
  volumeKeyframes?: VolumeKeyframePoint[];
  audioProcessing?: AudioProcessingSettings;

  // Phase 7: Hierarchical Color Grading & Adjustment Layers
  colorGrading?: ColorGradingProfile;
  isAdjustmentLayer?: boolean;

  // Video Stabilization & Motion Smoothing
  stabilization?: StabilizationSettings;

  // Phase 11: Dedicated Filters & 3D LUTs Explorer
  filterId?: string;
  filterName?: string;
  filterIntensity?: number;
  filterRecipe?: ShaderRecipe;
}

export interface AudioDeviceInfo {
  id: string;
  name: string;
  isDefault: boolean;
  channels: number;
  sampleRates: number[];
}

export interface VolumeKeyframePoint {
  time: number; // in seconds relative to clip start
  value: number; // gain in dB (-60 to +12) or multiplier
  easing?: 'linear' | 'ease_in_out' | string;
}

export interface NoiseDenoiseAndFillProfile {
  noiseReductionEnabled: boolean;
  noiseProfilePath?: string;
  reductionIntensityDb: number;
  sensitivity?: number;
  frequencySmoothingBands?: number;
  auditionResidue: boolean;
  ambientRecoveryEnabled: boolean;
  ambientFillIntensity: number;
  roomToneLoopPath?: string;
  profileDurationSec?: number;
  denoisedAudioPath?: string;
  silenceCutThresholdDb: number;
  silenceMinDurationSec: number;
  cutMarginPaddingMs: number;
}

export interface AudioProcessingSettings {
  gainDb: number;
  pan: number;
  bassGain: number;
  midGain: number;
  trebleGain: number;
  volumeKeyframes: VolumeKeyframePoint[];
  noiseProfile?: NoiseDenoiseAndFillProfile;
}

export interface DuckingConfig {
  duckingEnabled: boolean;
  targetTrackIndex?: number;
  targetTrackId?: string;
  attenuationDb: number; // -6.0 to -30.0 dB
  attackMs: number;
  releaseMs: number;
}

export interface CaptionSegment {
  id: string;
  startMs: number;
  endMs: number;
  text: string;
}

export interface TextClipStyle {
  fontFamily: string;
  fontSize: number;
  fontColor: string; // hex or rgba
  strokeColor?: string;
  strokeWidth: number;
  backgroundColor?: string;
  backgroundPadding: number;
  positionX: number;
  positionY: number;
  alignment: 'left' | 'center' | 'right' | string;
  lineHeight: number;
  fontWeight: 'normal' | 'bold' | '500' | '600' | '700' | '800' | string;
  presetStyle?: 'youtube_lower_third' | 'cinematic' | 'karaoke' | 'default' | string;
}

export interface TextClip {
  id: string;
  text: string;
  startTime: number; // in seconds
  duration: number; // in seconds
  trackIndex: number;
  style: TextClipStyle;
}

export interface TextTrack {
  id: string;
  name: string;
  muted?: boolean;
  locked?: boolean;
  visible?: boolean;
  clips: TextClip[];
}

export interface KeyframePoint {
  time: number; // in seconds relative to clip start
  value: number;
  easing: 'linear' | 'ease_in_out' | string;
}

export interface KeyframeTrack {
  property: 'scale' | 'position_x' | 'position_y' | 'rotation' | 'opacity' | string;
  keyframes: KeyframePoint[];
}

export interface SpeedProfile {
  speedMultiplier: number; // 0.1 to 16.0, default 1.0
  pitchCorrection: boolean; // default true
}

export interface LensEffects {
  defishEnabled: boolean;
  defishStrength: number; // -1.0 to 1.0
  gaussianBlur: number; // 0.0 to 50.0
}

export interface StabilizationSettings {
  enabled: boolean;
  intensity: number; // 0.0 to 1.0
  smoothness?: number; // 1 to 50, default 15
  tripodMode?: boolean;
}

export interface ColorCorrection {
  brightness: number; // -1.0 to 1.0 (default 0)
  contrast: number; // -2.0 to 2.0 (default 1)
  saturation: number; // 0.0 to 3.0 (default 1)
  temperature: number; // -100.0 to 100.0 (default 0)
  lutPath?: string;
}

export interface ColorWheel {
  r: number; // -1.0 to 1.0
  g: number;
  b: number;
  luma: number; // -1.0 to 1.0
}

export interface SplineCurves {
  master: Array<[number, number]>;
  red: Array<[number, number]>;
  green: Array<[number, number]>;
  blue: Array<[number, number]>;
}

export interface HslQualifier {
  enabled: boolean;
  hueCenter: number; // 0 to 360 deg
  hueWidth: number; // 0 to 180 deg
  hueSoftness: number; // 0 to 50 deg
  satCenter: number; // 0 to 1
  satWidth: number; // 0 to 1
  satSoftness: number; // 0 to 1
  lumCenter: number; // 0 to 1
  lumWidth: number; // 0 to 1
  lumSoftness: number; // 0 to 1
  isolatedHueShift: number; // -180 to 180 deg
  isolatedSat: number; // 0 to 2
  isolatedGain: number; // 0 to 2
  showMatte: boolean;
}

export interface SplitToning {
  shadowHue: number; // 0 to 360 deg
  shadowSat: number; // 0 to 100%
  highlightHue: number; // 0 to 360 deg
  highlightSat: number; // 0 to 100%
  balance: number; // -100 to 100
}

export interface SelectiveColorAdjustment {
  hue: number; // -100 to 100
  saturation: number; // -100 to 100
  brightness: number; // -100 to 100
}

export interface ColorGradingProfile {
  // Primaries & Balance / Lightness
  exposure?: number; // -4.0 to +4.0 EV, default 0
  contrast?: number; // 0.0 to 2.0, default 1.0
  highlights?: number; // -1.0 to 1.0, default 0
  shadows?: number; // -1.0 to 1.0, default 0
  whites?: number; // -1.0 to 1.0, default 0
  blacks?: number; // -1.0 to 1.0, default 0
  brilliance?: number; // -1.0 to 1.0, default 0
  temperature?: number; // -100.0 to 100.0, default 0
  tint?: number; // -100.0 to 100.0, default 0
  saturation?: number; // 0.0 to 3.0, default 1.0
  vibrance?: number; // -1.0 to 1.0, default 0

  // Effects
  sharpen?: number; // 0 to 100
  clarity?: number; // -100 to 100
  particles?: number; // 0 to 100
  fade?: number; // 0 to 100
  vignette?: number; // 0 to 100

  // Selective 8-Color Adjustments
  selectiveColors?: Record<string, SelectiveColorAdjustment>;

  // 3-Way Color Wheels
  lift?: ColorWheel;
  gamma?: ColorWheel;
  gain?: ColorWheel;
  offset?: ColorWheel;

  // Spline Curves
  curves?: SplineCurves;

  // HSL Secondary Qualifier
  hslQualifier?: HslQualifier;

  // Split-Toning
  splitToning?: SplitToning;

  // 3D LUT & Opacity
  lutPath?: string;
  lutIntensity?: number; // 0.0 to 1.0, default 1.0

  // Keyframed adjustments
  keyframeTracks?: KeyframeTrack[];
}

export interface ColorGradingPreset {
  id: string;
  name: string;
  createdAt: number;
  profile: ColorGradingProfile;
  isBuiltIn?: boolean;
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
  ducking?: DuckingConfig;
  trackGrading?: ColorGradingProfile;
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
  textTracks?: TextTrack[];
  transitions?: Transition[];
  bins?: MediaBin[];
  assets?: MediaAsset[];
  currentTimeMs?: number;
  masterGrading?: ColorGradingProfile;
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
  textTracks?: TextTrack[];
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

// Phase 11: Dedicated Filters & 3D LUTs Explorer
export type FilterType = 'lut3D' | 'colorGrade' | 'stylize' | 'vintage' | 'monochrome';

export interface ShaderRecipe {
  brightness: number;
  contrast: number;
  saturation: number;
  temperature: number;
  tint: number;
  vignette: number;
  grain: number;
  sepia: number;
  hueRotateDeg: number;
  colorTintHex?: string;
  rgbBalance: [number, number, number];
  highlights: number;
  shadows: number;
  cssFilter: string;
}

export interface FilterPreset {
  id: string;
  name: string;
  category: string;
  categoryLabel: string;
  description: string;
  filterType: FilterType;
  lutPath?: string;
  shaderRecipe: ShaderRecipe;
  ffmpegFilter?: string;
  defaultIntensity: number;
  isCustom: boolean;
  previewAccentColor: string;
}

export interface FilterCategory {
  id: string;
  name: string;
  icon: string;
  count: number;
  description: string;
}


