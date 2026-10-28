import { Clip } from '../types/ipc';

export interface AudioMasteringOptions {
  volumeDb?: number;
  pan?: number;
  bassGain?: number;
  midGain?: number;
  trebleGain?: number;
  isMuted?: boolean;
  duckingDb?: number;
  noiseReductionEnabled?: boolean;
  reductionDb?: number;
  ambientRecoveryEnabled?: boolean;
  ambientIntensity?: number;
}

export interface TrackDspStrip {
  rumbleFilter: BiquadFilterNode;
  bassFilter: BiquadFilterNode;
  midFilter: BiquadFilterNode;
  trebleFilter: BiquadFilterNode;
  pannerNode: StereoPannerNode;
  gainNode: GainNode;
  activeSource: AudioBufferSourceNode | null;
  startedAtCtxTime: number;
  startedAtOffset: number;
}

let sharedAudioContext: AudioContext | null = null;
const trackDspMap = new Map<string, TrackDspStrip>();
const audioBufferCache = new Map<string, AudioBuffer>();
const pendingBufferLoads = new Map<string, Promise<AudioBuffer | null>>();

/**
 * Returns a shared browser AudioContext, resuming it if suspended.
 */
export function getSharedAudioContext(): AudioContext {
  if (!sharedAudioContext || sharedAudioContext.state === 'closed') {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    sharedAudioContext = new AudioCtx();
  }
  return sharedAudioContext;
}

/**
 * Resumes AudioContext synchronously during a user gesture (pointerdown/keydown/play).
 */
export function unlockAudioContext(): void {
  try {
    const ctx = getSharedAudioContext();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
  } catch {}
}

/**
 * Computes interpolated volume (dB) at a given timeline offset for clips with volume keyframes.
 */
export function getInterpolatedVolumeDb(clip?: Clip | null, offsetSec: number = 0): number {
  if (!clip) return 0;
  const baseDb = clip.volumeDb ?? clip.audioProcessing?.gainDb ?? 0;
  const kfs = clip.volumeKeyframes || clip.audioProcessing?.volumeKeyframes;
  if (!kfs || kfs.length === 0) return baseDb;

  const sorted = [...kfs].sort((a, b) => a.time - b.time);
  if (offsetSec <= sorted[0].time) return sorted[0].value;
  if (offsetSec >= sorted[sorted.length - 1].time) return sorted[sorted.length - 1].value;

  for (let i = 0; i < sorted.length - 1; i++) {
    const kfA = sorted[i];
    const kfB = sorted[i + 1];
    if (offsetSec >= kfA.time && offsetSec <= kfB.time) {
      const span = kfB.time - kfA.time;
      if (span <= 0) return kfA.value;
      const t = (offsetSec - kfA.time) / span;
      return kfA.value + (kfB.value - kfA.value) * t;
    }
  }

  return baseDb;
}

/**
 * Registers an in-memory AudioBuffer directly (e.g. for recorded voiceovers).
 */
export function registerAudioBuffer(filePath: string, buffer: AudioBuffer): void {
  if (filePath && buffer) {
    audioBufferCache.set(filePath, buffer);
  }
}

/**
 * Returns a cached AudioBuffer if available.
 */
export function getCachedAudioBuffer(filePath: string): AudioBuffer | null {
  return audioBufferCache.get(filePath) || null;
}

/**
 * Loads and decodes an audio file into an AudioBuffer using Tauri raw file read IPC or fetch.
 * This completely avoids CORS and MediaElementAudioSource cross-origin zeroing.
 */
export async function loadAudioBuffer(filePath: string): Promise<AudioBuffer | null> {
  if (!filePath) return null;
  // If it's a video file, skip decodeAudioData to prevent buffering massive video frames into memory
  if (/\.(mp4|mov|mkv|avi|m4v|webm)$/i.test(filePath)) {
    return null;
  }
  if (audioBufferCache.has(filePath)) {
    return audioBufferCache.get(filePath)!;
  }
  if (pendingBufferLoads.has(filePath)) {
    return pendingBufferLoads.get(filePath)!;
  }

  const loadPromise = (async () => {
    const ctx = getSharedAudioContext();
    try {
      let arrayBuffer: ArrayBuffer | null = null;

      // 1. If in Tauri desktop, read raw file bytes directly with std::fs::read via IPC
      if (typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__) {
        try {
          const { invoke } = await import('@tauri-apps/api/core');
          const bytes = await invoke<number[]>('read_audio_file', { path: filePath });
          if (bytes && bytes.length > 0) {
            arrayBuffer = new Uint8Array(bytes).buffer;
          }
        } catch (ipcErr) {
          console.warn('Tauri read_audio_file fallback to fetch:', ipcErr);
        }
      }

      // 2. Fallback to fetch for web mode or blob URLs
      if (!arrayBuffer) {
        let src = filePath;
        if (
          !src.startsWith('blob:') &&
          !src.startsWith('http:') &&
          !src.startsWith('https:') &&
          !src.startsWith('data:') &&
          typeof window !== 'undefined'
        ) {
          const internals = (window as any).__TAURI_INTERNALS__;
          if (internals?.convertFileSrc) {
            src = internals.convertFileSrc(filePath, 'asset');
          }
        }
        const res = await fetch(src);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        arrayBuffer = await res.arrayBuffer();
      }

      if (!arrayBuffer) return null;

      // Decode PCM data into AudioBuffer
      const decoded = await ctx.decodeAudioData(arrayBuffer.slice(0));
      audioBufferCache.set(filePath, decoded);
      return decoded;
    } catch (err) {
      console.warn('Failed to load audio buffer for:', filePath, err);
      return null;
    } finally {
      pendingBufferLoads.delete(filePath);
    }
  })();

  pendingBufferLoads.set(filePath, loadPromise);
  return loadPromise;
}

/**
 * Gets or creates the persistent Web Audio DSP filter strip for a track.
 */
export function getOrCreateTrackDsp(trackId: string): TrackDspStrip {
  if (trackDspMap.has(trackId)) {
    return trackDspMap.get(trackId)!;
  }

  const ctx = getSharedAudioContext();

  // 0. Highpass Rumble Filter (Spectral Denoise Simulation)
  const rumbleFilter = ctx.createBiquadFilter();
  rumbleFilter.type = 'highpass';
  rumbleFilter.frequency.value = 20;
  rumbleFilter.Q.value = 0.7;

  // 1. Bass Lowshelf Filter (100 Hz, ±15 dB)
  const bassFilter = ctx.createBiquadFilter();
  bassFilter.type = 'lowshelf';
  bassFilter.frequency.value = 100;
  bassFilter.gain.value = 0;

  // 2. Mid Peaking Filter (1000 Hz, Q = 1.0, ±15 dB)
  const midFilter = ctx.createBiquadFilter();
  midFilter.type = 'peaking';
  midFilter.frequency.value = 1000;
  midFilter.Q.value = 1.0;
  midFilter.gain.value = 0;

  // 3. Treble Highshelf Filter (8000 Hz, ±15 dB)
  const trebleFilter = ctx.createBiquadFilter();
  trebleFilter.type = 'highshelf';
  trebleFilter.frequency.value = 8000;
  trebleFilter.gain.value = 0;

  // 4. Stereo Panner (-1.0 Left to +1.0 Right)
  const pannerNode = ctx.createStereoPanner();
  pannerNode.pan.value = 0;

  // 5. Track Output Gain Node (Volume dB + Dynamic Ducking)
  const gainNode = ctx.createGain();
  gainNode.gain.value = 1.0;

  // Connect chain: rumble -> bass -> mid -> treble -> panner -> gain -> destination
  rumbleFilter
    .connect(bassFilter)
    .connect(midFilter)
    .connect(trebleFilter)
    .connect(pannerNode)
    .connect(gainNode)
    .connect(ctx.destination);

  const strip: TrackDspStrip = {
    rumbleFilter,
    bassFilter,
    midFilter,
    trebleFilter,
    pannerNode,
    gainNode,
    activeSource: null,
    startedAtCtxTime: 0,
    startedAtOffset: 0,
  };

  trackDspMap.set(trackId, strip);
  return strip;
}

/**
 * Updates 3-Band Parametric EQ, Stereo Pan, Volume and Auto-Ducking in real time on a track strip.
 */
export function updateTrackDspParameters(
  trackId: string,
  options: AudioMasteringOptions
): void {
  const strip = getOrCreateTrackDsp(trackId);
  const ctx = getSharedAudioContext();
  const now = ctx.currentTime;

  const isMuted = Boolean(options.isMuted);
  const baseDb = options.volumeDb ?? 0;
  const duckDb = options.duckingDb ?? 0;
  const totalDb = baseDb + duckDb;

  const linearGain = isMuted || totalDb <= -58 ? 0 : Math.pow(10, totalDb / 20);
  const bass = options.bassGain ?? 0;
  const mid = options.midGain ?? 0;
  const treble = options.trebleGain ?? 0;
  const pan = Math.max(-1.0, Math.min(1.0, options.pan ?? 0));
  const noiseReduction = Boolean(options.noiseReductionEnabled);
  const cutoffHz = noiseReduction ? 85 : 20;

  try {
    strip.rumbleFilter.frequency.setTargetAtTime(cutoffHz, now, 0.02);
    strip.bassFilter.gain.setTargetAtTime(bass, now, 0.01);
    strip.midFilter.gain.setTargetAtTime(mid, now, 0.01);
    strip.trebleFilter.gain.setTargetAtTime(treble, now, 0.01);
    strip.pannerNode.pan.setTargetAtTime(pan, now, 0.01);
    strip.gainNode.gain.setTargetAtTime(linearGain, now, 0.01);
  } catch {
    strip.rumbleFilter.frequency.value = cutoffHz;
    strip.bassFilter.gain.value = bass;
    strip.midFilter.gain.value = mid;
    strip.trebleFilter.gain.value = treble;
    strip.pannerNode.pan.value = pan;
    strip.gainNode.gain.value = linearGain;
  }
}

/**
 * Starts playing an AudioBuffer through the track's DSP chain at the exact offset.
 */
export function startTrackBufferPlayback(
  trackId: string,
  audioBuffer: AudioBuffer,
  offsetSec: number
): void {
  const strip = getOrCreateTrackDsp(trackId);
  const ctx = getSharedAudioContext();

  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }

  // Stop previous source if already playing
  if (strip.activeSource) {
    try {
      strip.activeSource.stop();
      strip.activeSource.disconnect();
    } catch {}
    strip.activeSource = null;
  }

  const source = ctx.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(strip.rumbleFilter);

  const safeOffset = Math.max(0, Math.min(audioBuffer.duration - 0.02, offsetSec));
  source.start(0, safeOffset);

  strip.activeSource = source;
  strip.startedAtCtxTime = ctx.currentTime;
  strip.startedAtOffset = safeOffset;

  source.onended = () => {
    if (strip.activeSource === source) {
      strip.activeSource = null;
    }
  };
}

/**
 * Stops buffer playback on a track.
 */
export function stopTrackBufferPlayback(trackId: string): void {
  const strip = trackDspMap.get(trackId);
  if (!strip || !strip.activeSource) return;

  try {
    strip.activeSource.stop();
    strip.activeSource.disconnect();
  } catch {}
  strip.activeSource = null;
}

/**
 * Returns whether an AudioBuffer is actively playing through the track's DSP chain.
 */
export function isTrackBufferActive(trackId: string): boolean {
  const strip = trackDspMap.get(trackId);
  return Boolean(strip && strip.activeSource);
}

/**
 * Returns current accurate audio clock from an active track DSP buffer.
 */
export function getTrackDspClock(trackId: string): number | null {
  const strip = trackDspMap.get(trackId);
  if (!strip || !strip.activeSource) return null;
  const ctx = getSharedAudioContext();
  const elapsed = ctx.currentTime - strip.startedAtCtxTime;
  return strip.startedAtOffset + Math.max(0, elapsed);
}
