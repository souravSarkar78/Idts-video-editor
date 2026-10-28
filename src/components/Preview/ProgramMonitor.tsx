import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  Maximize,
  Sparkles,
  CheckCircle2,
  Tv,
  Film,
  Camera,
  Layers,
  Video,
  Scissors,
  Zap,
  Move,
  Split,
} from 'lucide-react';
import { RotateCw, Activity, Shield } from '@/components/Icons';
import { useShallow } from 'zustand/react/shallow';
import { useTimelineStore, isTauri, getInterpolatedClipTransform } from '../../store/timelineStore';
import { formatTimecode } from '../../utils/timecode';
import { Clip, ColorGradingProfile } from '../../types/ipc';
import { getActiveAudioClock } from '../Audio/TimelineAudioPlayer';
import { getInterpolatedVolumeDb, getSharedAudioContext } from '../../utils/audioMastering';
import { VideoScopes } from './VideoScopes';
import { compileShaderRecipeToCssFilter } from '../../utils/filterRecipe';

function getCleanMediaUrl(rawPath: string): string {
  if (!rawPath) return '';
  if (
    rawPath.startsWith('blob:') ||
    rawPath.startsWith('http:') ||
    rawPath.startsWith('https:') ||
    rawPath.startsWith('data:')
  ) {
    return rawPath;
  }
  if (typeof window !== 'undefined') {
    try {
      const internals = (window as any).__TAURI_INTERNALS__;
      if (internals?.convertFileSrc) {
        return internals.convertFileSrc(rawPath, 'asset');
      }
    } catch {}
  }
  return rawPath;
}

export const ProgramMonitor: React.FC = () => {
  const {
    playhead,
    project,
    isPlaying,
    tracks,
    togglePlayPause,
    stepFrames,
    setPlayhead,
    getActiveVideoClip,
    isMulticamActive,
    toggleMulticamActive,
    switchMulticamAngle,
    activeCameraTrackId,
    multicamSplitOnCut,
    toggleMulticamSplitOnCut,
    isProxyMode,
    toggleProxyMode,
    transitions,
    selectedClipId,
    updateClipTransform,
    inspectorTab,
    selectClip,
    updateTextClipContent,
    updateTextClipStyle,
    masterGrading,
    isScopesDrawerOpen,
    setIsScopesDrawerOpen,
    activeScopeType,
    setActiveScopeType,
    isSplitComparisonOpen,
    setSplitComparisonOpen,
    splitComparisonMode,
    setSplitComparisonMode,
    splitComparisonPosition,
    setSplitComparisonPosition,
    referenceSnapshotUrl,
    setReferenceSnapshotUrl,
    autoMatchLook,
  } = useTimelineStore(
    useShallow((state) => ({
      playhead: state.playhead,
      project: state.project,
      isPlaying: state.isPlaying,
      tracks: state.tracks,
      togglePlayPause: state.togglePlayPause,
      stepFrames: state.stepFrames,
      setPlayhead: state.setPlayhead,
      getActiveVideoClip: state.getActiveVideoClip,
      isMulticamActive: state.isMulticamActive,
      toggleMulticamActive: state.toggleMulticamActive,
      switchMulticamAngle: state.switchMulticamAngle,
      activeCameraTrackId: state.activeCameraTrackId,
      multicamSplitOnCut: state.multicamSplitOnCut,
      toggleMulticamSplitOnCut: state.toggleMulticamSplitOnCut,
      isProxyMode: state.isProxyMode,
      toggleProxyMode: state.toggleProxyMode,
      transitions: state.transitions,
      selectedClipId: state.selectedClipId,
      updateClipTransform: state.updateClipTransform,
      inspectorTab: state.inspectorTab,
      selectClip: state.selectClip,
      updateTextClipContent: state.updateTextClipContent,
      updateTextClipStyle: state.updateTextClipStyle,
      masterGrading: state.masterGrading,
      isScopesDrawerOpen: state.isScopesDrawerOpen,
      setIsScopesDrawerOpen: state.setIsScopesDrawerOpen,
      activeScopeType: state.activeScopeType,
      setActiveScopeType: state.setActiveScopeType,
      isSplitComparisonOpen: state.isSplitComparisonOpen,
      setSplitComparisonOpen: state.setSplitComparisonOpen,
      splitComparisonMode: state.splitComparisonMode,
      setSplitComparisonMode: state.setSplitComparisonMode,
      splitComparisonPosition: state.splitComparisonPosition,
      setSplitComparisonPosition: state.setSplitComparisonPosition,
      referenceSnapshotUrl: state.referenceSnapshotUrl,
      setReferenceSnapshotUrl: state.setReferenceSnapshotUrl,
      autoMatchLook: state.autoMatchLook,
    }))
  );

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const incomingVideoRef = useRef<HTMLVideoElement>(null);
  const denoisedAudioPlayerRef = useRef<HTMLAudioElement>(null);
  const [player1Clip, setPlayer1Clip] = useState<Clip | null>(() => getActiveVideoClip()?.clip || null);
  const [player2Clip, setPlayer2Clip] = useState<Clip | null>(null);
  const [activePlayer, setActivePlayer] = useState<'player1' | 'player2'>('player1');
  const activePlayerRef = useRef<'player1' | 'player2'>('player1');
  activePlayerRef.current = activePlayer;
  const [isVideoLoaded, setIsVideoLoaded] = useState<boolean>(false);
  const [isIncomingVideoLoaded, setIsIncomingVideoLoaded] = useState<boolean>(false);
  const [vuLeft, setVuLeft] = useState(42);
  const [vuRight, setVuRight] = useState(45);
  const [aspectRatio, setAspectRatio] = useState<'Original' | '16:9' | '9:16' | '1:1'>('16:9');
  const [gpuInfo, setGpuInfo] = useState<string | null>(null);

  // Activate discrete high-performance GPU adapter via WebGPU and WebGL powerPreference request
  useEffect(() => {
    let resolvedGpu = false;

    // 1. WebGPU high-performance adapter activation
    if (typeof navigator !== 'undefined' && 'gpu' in navigator && (navigator as any).gpu) {
      (navigator as any).gpu
        .requestAdapter({ powerPreference: 'high-performance' })
        .then(async (adapter: any) => {
          if (adapter) {
            const info = (await adapter.requestAdapterInfo?.()) || adapter.info;
            const name = info?.description || info?.device || info?.architecture;
            if (name) {
              resolvedGpu = true;
              setGpuInfo(name);
              console.log('[Antigravity GPU Acceleration] WebGPU Active Adapter:', name);
            }
          }
        })
        .catch(() => {});
    }

    // 2. WebGL high-performance adapter activation (Direct3D ANGLE backend)
    try {
      const probeCanvas = document.createElement('canvas');
      const gl =
        probeCanvas.getContext('webgl2', { powerPreference: 'high-performance' }) ||
        probeCanvas.getContext('webgl', { powerPreference: 'high-performance' });
      if (gl) {
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        if (ext) {
          const renderer = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL);
          if (typeof renderer === 'string') {
            const clean = renderer.replace(/Direct3D.*vs_\d+_\d+\s+ps_\d+_\d+/, '').replace(/[()]/g, '').trim();
            if (!resolvedGpu) {
              setGpuInfo(clean);
            }
            console.log('[Antigravity GPU Acceleration] WebGL Active Adapter:', clean);
          }
        }
      }
    } catch (e) {
      console.warn('[Antigravity GPU Acceleration] GPU initialization notice:', e);
    }
  }, []);

  // Milestone 4: Multicam Angle Hotkey Listener (Keys 1-9 cut active program angle at current playhead)
  useEffect(() => {
    if (!isMulticamActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      const num = parseInt(e.key, 10);
      if (!isNaN(num) && num >= 1 && num <= 9) {
        e.preventDefault();
        switchMulticamAngle(num - 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMulticamActive, switchMulticamAngle]);

  // Compute the topmost active video clip covering the playhead
  const activeLayer = getActiveVideoClip();
  const totalSeconds = (project.durationMs || 120000) / 1000;

  const allVideoTracks = (tracks || []).filter(
    (t) =>
      (t.trackType === 'video' || t.type === 'video') &&
      t.visible !== false &&
      t.isVisible !== false &&
      !t.muted &&
      !t.isMuted
  );

  // Fast helper to determine the topmost visible video clip at any given timeline second
  const getTopClipAt = (sec: number): Clip | null => {
    for (const t of allVideoTracks) {
      for (const c of t.clips || []) {
        const s = c.startPositionSeconds ?? (c.startTimeMs ? c.startTimeMs / 1000 : 0);
        const dur = c.durationSeconds ?? (c.durationMs ? c.durationMs / 1000 : 10);
        if (sec >= s && sec < s + dur) {
          return c;
        }
      }
    }
    return null;
  };

  // Helper to find the next clip chronologically across all video tracks
  const getNextClipAfter = (timeSec: number, excludeClipId?: string): Clip | null => {
    let earliestNext: Clip | null = null;
    let earliestStart = Infinity;

    for (const t of allVideoTracks) {
      for (const c of t.clips || []) {
        if (excludeClipId && c.id === excludeClipId) continue;
        const s = c.startPositionSeconds ?? (c.startTimeMs ? c.startTimeMs / 1000 : 0);
        const dur = c.durationSeconds ?? (c.durationMs ? c.durationMs / 1000 : 10);
        const end = s + dur;
        if (end > timeSec) {
          const effStart = Math.max(s, timeSec);
          if (effStart < earliestStart) {
            earliestStart = effStart;
            earliestNext = c;
          }
        }
      }
    }
    return earliestNext;
  };

  // Active or upcoming visual transition between adjacent clips covering the playhead
  const activeTransitionInfo = (() => {
    // 1. Check explicit transitions in transitions[] (from Transitions Panel)
    if (transitions && transitions.length > 0) {
      const allClips = tracks.flatMap((t) => t.clips);
      for (const t of transitions) {
        const fromClip = allClips.find((c) => c.id === t.fromClipId);
        const toClip = allClips.find((c) => c.id === t.toClipId);
        if (!fromClip || !toClip) continue;

        const fromEndSec = (fromClip.startPositionSeconds || 0) + (fromClip.durationSeconds || 10);
        const toStartSec = toClip.startPositionSeconds || 0;
        const cutSec = (fromEndSec + toStartSec) / 2;
        const dur = Math.max(0.1, t.duration || 1.0);
        const startSec = cutSec - dur / 2;
        const endSec = cutSec + dur / 2;

        const isPreloading = playhead >= startSec - 1.5 && playhead <= endSec;
        const isActive = playhead >= startSec && playhead <= endSec;

        if (isPreloading) {
          const progress = isActive
            ? Math.max(0, Math.min(1, (playhead - startSec) / dur))
            : 0;
          return {
            transition: t,
            fromClip,
            toClip,
            progress,
            isActive,
            type: t.transitionType.toLowerCase(),
            cutSec,
            startSec,
            endSec,
            dur,
          };
        }
      }
    }

    // 2. Check for overlapping clips on the same track (automatic overlap crossfade)
    for (const track of (tracks || [])) {
      if (track.trackType !== 'video' && track.type !== 'video') continue;
      if (track.visible === false || track.isVisible === false || track.muted || track.isMuted) continue;
      if (!track.clips || track.clips.length < 2) continue;

      for (let i = 0; i < track.clips.length - 1; i++) {
        const fromClip = track.clips[i];
        const toClip = track.clips[i + 1];
        const fromEndSec = (fromClip.startPositionSeconds || 0) + (fromClip.durationSeconds || 10);
        const toStartSec = toClip.startPositionSeconds || 0;

        // If clips overlap on the same track by at least 50ms
        if (toStartSec < fromEndSec - 0.05) {
          const startSec = toStartSec;
          const endSec = fromEndSec;
          const dur = Math.max(0.1, endSec - startSec);
          const cutSec = (startSec + endSec) / 2;

          const isPreloading = playhead >= startSec - 1.5 && playhead <= endSec;
          const isActive = playhead >= startSec && playhead <= endSec;

          if (isPreloading) {
            const progress = isActive
              ? Math.max(0, Math.min(1, (playhead - startSec) / dur))
              : 0;
            return {
              transition: {
                id: `auto-overlap-${fromClip.id}-${toClip.id}`,
                trackId: track.id,
                fromClipId: fromClip.id,
                toClipId: toClip.id,
                transitionType: 'dissolve',
                duration: dur,
              },
              fromClip,
              toClip,
              progress,
              isActive,
              type: 'dissolve',
              cutSec,
              startSec,
              endSec,
              dur,
            };
          }
        }
      }
    }

    return null;
  })();

  const currentActiveClip = activeLayer?.clip || null;

  // Determine the upcoming clip that will take over after currentActiveClip ends
  const upcomingClip = (() => {
    if (activeTransitionInfo?.toClip) {
      return activeTransitionInfo.toClip;
    }
    if (!currentActiveClip) return null;
    const dur = currentActiveClip.durationSeconds ?? (currentActiveClip.durationMs ? currentActiveClip.durationMs / 1000 : 10);
    const s = currentActiveClip.startPositionSeconds ?? (currentActiveClip.startTimeMs ? currentActiveClip.startTimeMs / 1000 : 0);
    const endSec = s + dur;

    // 1. Check topmost clip immediately after endSec (underlay on multitrack or snapped neighbor)
    const after = getTopClipAt(endSec + 0.02);
    if (after && after.id !== currentActiveClip.id) return after;

    // 2. Check next clip after small gap (e.g. 0.2s)
    const gap = getTopClipAt(endSec + 0.2);
    if (gap && gap.id !== currentActiveClip.id) return gap;

    // 3. Search chronologically across all tracks
    return getNextClipAfter(endSec, currentActiveClip.id);
  })();

  // Synchronous, bulletproof URL resolution (works in Tauri v2 & Web)
  const resolveVideoUrl = (clip: Clip | null): string | null => {
    if (!clip?.filePath) return null;
    const rawPath = isProxyMode && clip.proxyPath ? clip.proxyPath : clip.filePath;
    if (isTauri && typeof window !== 'undefined') {
      try {
        const internals = (window as any).__TAURI_INTERNALS__;
        if (internals?.convertFileSrc) {
          return internals.convertFileSrc(rawPath, 'asset');
        }
      } catch {}
    }
    return rawPath;
  };

  const player1Src = resolveVideoUrl(player1Clip);
  const player2Src = resolveVideoUrl(player2Clip);

  // Collect all existing video clip IDs across all tracks to detect deleted/cleared clips
  const existingClipIds = useMemo(() => {
    const ids = new Set<string>();
    for (const t of tracks || []) {
      if (t.trackType === 'video' || t.type === 'video') {
        for (const c of t.clips || []) {
          ids.add(c.id);
        }
      }
    }
    return ids;
  }, [tracks]);

  // Maintain Player 1 & Player 2 dual buffering assignments
  useEffect(() => {
    // If a clip was deleted/cleared from the track, immediately remove it from player buffers
    if (player1Clip && !existingClipIds.has(player1Clip.id)) {
      setPlayer1Clip(null);
      setIsVideoLoaded(false);
      if (videoRef.current) {
        videoRef.current.pause();
      }
    }
    if (player2Clip && !existingClipIds.has(player2Clip.id)) {
      setPlayer2Clip(null);
      setIsIncomingVideoLoaded(false);
      if (incomingVideoRef.current) {
        incomingVideoRef.current.pause();
      }
    }

    if (!currentActiveClip) {
      if (videoRef.current && !videoRef.current.paused) videoRef.current.pause();
      if (incomingVideoRef.current && !incomingVideoRef.current.paused) incomingVideoRef.current.pause();

      const hasAnyVideoClips = existingClipIds.size > 0;
      if (!hasAnyVideoClips) {
        setPlayer1Clip(null);
        setPlayer2Clip(null);
        setIsVideoLoaded(false);
        setIsIncomingVideoLoaded(false);
      }
      return;
    }

    let nextActive = activePlayerRef.current;
    if (player1Clip?.id === currentActiveClip.id) {
      nextActive = 'player1';
    } else if (player2Clip?.id === currentActiveClip.id) {
      nextActive = 'player2';
    }

    if (nextActive !== activePlayerRef.current) {
      setActivePlayer(nextActive);
      activePlayerRef.current = nextActive;
    }

    if (nextActive === 'player1') {
      if (player1Clip?.id !== currentActiveClip.id) setPlayer1Clip(currentActiveClip);
      if (player2Clip?.id !== upcomingClip?.id) setPlayer2Clip(upcomingClip);
    } else {
      if (player2Clip?.id !== currentActiveClip.id) setPlayer2Clip(currentActiveClip);
      if (player1Clip?.id !== upcomingClip?.id) setPlayer1Clip(upcomingClip);
    }
  }, [
    currentActiveClip?.id,
    currentActiveClip?.filePath,
    currentActiveClip?.proxyPath,
    upcomingClip?.id,
    upcomingClip?.filePath,
    upcomingClip?.proxyPath,
    isProxyMode,
    existingClipIds,
  ]);

  const getFreshClip = (clip: Clip | null | undefined): Clip | null => {
    if (!clip) return null;
    for (const t of tracks || []) {
      const c = t.clips?.find((item) => item.id === clip.id);
      if (c) return c;
    }
    return clip;
  };

  const getClipSeekTime = (clip: Clip, ph: number): number => {
    const s = clip.startPositionSeconds ?? (clip.startTimeMs != null ? clip.startTimeMs / 1000 : 0);
    const inPoint = clip.inPointSeconds ?? (clip.sourceOffsetMs != null ? clip.sourceOffsetMs / 1000 : 0);
    const dur = clip.durationSeconds ?? (clip.durationMs != null ? clip.durationMs / 1000 : 10);
    const speed = clip.speedProfile?.speedMultiplier ?? 1.0;
    const sourceDur =
      clip.outPointSeconds != null && clip.outPointSeconds > inPoint
        ? clip.outPointSeconds - inPoint
        : dur * speed;

    if (ph <= s) {
      return inPoint;
    }
    if (ph >= s + dur) {
      return Math.max(inPoint, inPoint + sourceDur - 0.03);
    }
    const timelineElapsed = ph - s;
    const sourceElapsed = timelineElapsed * speed;
    return Math.min(inPoint + sourceDur, inPoint + sourceElapsed);
  };

  // Helper function: Compiles a ColorGradingProfile into standard CSS filter expression tokens
  const compileColorProfileToCssFilter = (profile?: ColorGradingProfile | null, legacyColor?: any) => {
    if (!profile && !legacyColor) return '';

    // 1. Exposure & Dynamic Brightness
    const exp = profile?.exposure ?? 0;
    const expFactor = exp !== 0 ? Math.pow(2, exp * 0.65) : 1.0;
    const whites = profile?.whites ?? 0;
    const blacks = profile?.blacks ?? 0;
    const highlights = profile?.highlights ?? 0;
    const shadows = profile?.shadows ?? 0;
    const legacyB = legacyColor?.brightness ?? 0;

    // 3-Way Color Wheels Luma contributions
    const liftLuma = (profile?.lift?.luma ?? 0) * 0.35;
    const gammaLuma = (profile?.gamma?.luma ?? 0) * 0.35;
    const gainLuma = (profile?.gain?.luma ?? 0) * 0.45;
    const offsetLuma = (profile?.offset?.luma ?? 0) * 0.4;

    // Spline Curves curvature evaluation across all channels
    let curveBrightness = 0;
    let curveContrast = 1.0;
    let curveWarmth = 0;
    let curveTint = 0;

    if (profile?.curves) {
      if (profile.curves.master && profile.curves.master.length >= 2) {
        const pts = profile.curves.master;
        const pFirst = pts[0];
        const pLast = pts[pts.length - 1];
        const endLift = (pFirst[1] - pFirst[0]) * 0.8;
        const endDrop = (pLast[1] - pLast[0]) * 0.8;

        const sumX = pts.reduce((acc, p) => acc + p[0], 0);
        const sumY = pts.reduce((acc, p) => acc + p[1], 0);
        const avgX = sumX / pts.length;
        const avgY = sumY / pts.length;
        const midDelta = (avgY - avgX) * 1.5;

        curveBrightness += endLift + endDrop + midDelta;
        curveContrast += Math.abs(midDelta) * 0.5;
      }

      if (profile.curves.red && profile.curves.red.length >= 2) {
        const pts = profile.curves.red;
        const avgX = pts.reduce((acc, p) => acc + p[0], 0) / pts.length;
        const avgY = pts.reduce((acc, p) => acc + p[1], 0) / pts.length;
        curveWarmth += (avgY - avgX) * 50;
      }

      if (profile.curves.blue && profile.curves.blue.length >= 2) {
        const pts = profile.curves.blue;
        const avgX = pts.reduce((acc, p) => acc + p[0], 0) / pts.length;
        const avgY = pts.reduce((acc, p) => acc + p[1], 0) / pts.length;
        curveWarmth -= (avgY - avgX) * 50;
      }

      if (profile.curves.green && profile.curves.green.length >= 2) {
        const pts = profile.curves.green;
        const avgX = pts.reduce((acc, p) => acc + p[0], 0) / pts.length;
        const avgY = pts.reduce((acc, p) => acc + p[1], 0) / pts.length;
        curveTint += (avgY - avgX) * 50;
      }
    }

    const brilliance = profile?.brilliance ?? 0;

    let brightnessVal = Math.max(
      0.01,
      expFactor *
        (1 +
          legacyB +
          whites * 0.35 +
          highlights * 0.35 +
          blacks * 0.3 +
          shadows * 0.3 +
          brilliance * 0.25 +
          liftLuma +
          gainLuma +
          offsetLuma +
          curveBrightness)
    );

    // 2. Contrast & Fade
    const baseContrast = profile?.contrast ?? legacyColor?.contrast ?? 1.0;
    const fade = (profile?.fade ?? 0) / 100;
    let contrastVal = Math.max(
      0.01,
      baseContrast *
        (1 +
          (whites - blacks) * 0.25 +
          (highlights - shadows) * 0.2 +
          (gammaLuma !== 0 ? -gammaLuma * 0.3 : 0)) *
        curveContrast *
        (fade > 0.01 ? Math.max(0.4, 1 - fade * 0.35) : 1.0)
    );

    // 3. Saturation & Vibrance
    const baseSat = profile?.saturation ?? legacyColor?.saturation ?? 1.0;
    const vibranceVal = profile?.vibrance ?? 0;
    let saturateVal = Math.max(0, baseSat * (1 + vibranceVal * 0.5));

    // Selective 8-color adjustments
    let selHueShift = 0;
    if (profile?.selectiveColors) {
      const entries = Object.values(profile.selectiveColors);
      for (const e of entries) {
        if (Math.abs(e.hue) > 0.1) selHueShift += (e.hue / 100) * 15;
        if (Math.abs(e.saturation) > 0.1) saturateVal *= (1 + (e.saturation / 100) * 0.25);
        if (Math.abs(e.brightness) > 0.1) brightnessVal *= (1 + (e.brightness / 100) * 0.2);
      }
    }

    // 4. Temperature, Tint & Color Wheels Chromatic Shift
    const temp = profile?.temperature ?? legacyColor?.temperature ?? 0;
    const tint = profile?.tint ?? 0;

    const liftR = (profile?.lift?.r || 0) * 0.6;
    const liftB = (profile?.lift?.b || 0) * 0.6;
    const liftG = (profile?.lift?.g || 0) * 0.6;

    const gammaR = (profile?.gamma?.r || 0) * 0.8;
    const gammaB = (profile?.gamma?.b || 0) * 0.8;
    const gammaG = (profile?.gamma?.g || 0) * 0.8;

    const gainR = (profile?.gain?.r || 0) * 1.0;
    const gainB = (profile?.gain?.b || 0) * 1.0;
    const gainG = (profile?.gain?.g || 0) * 1.0;

    const offsetR = (profile?.offset?.r || 0) * 0.8;
    const offsetB = (profile?.offset?.b || 0) * 0.8;
    const offsetG = (profile?.offset?.g || 0) * 0.8;

    const wheelWarmth = (liftR - liftB + gammaR - gammaB + gainR - gainB + offsetR - offsetB) * 55;
    const wheelTint =
      ((liftG + gammaG + gainG + offsetG) -
        (liftR + liftB + gammaR + gammaB + gainR + gainB + offsetR + offsetB) / 2) *
      50;

    const netWarmth = temp + wheelWarmth + curveWarmth;
    const netTint = tint + wheelTint + curveTint;

    let tempFilter = '';
    if (netWarmth > 1) {
      const warmFactor = Math.min(0.85, (netWarmth / 100) * 0.55);
      const warmHueRotate = -(netWarmth / 100) * 35;
      tempFilter = ` sepia(${warmFactor.toFixed(3)}) hue-rotate(${warmHueRotate.toFixed(1)}deg)`;
    } else if (netWarmth < -1) {
      const coolHueRotate = (Math.abs(netWarmth) / 100) * 45;
      const coolDesat = Math.max(0.7, 1 - (Math.abs(netWarmth) / 100) * 0.2);
      tempFilter = ` hue-rotate(${coolHueRotate.toFixed(1)}deg) saturate(${coolDesat.toFixed(3)})`;
    }

    let tintFilter = '';
    if (Math.abs(netTint) > 1) {
      const tintHueRotate = (netTint / 100) * 35;
      tintFilter = ` hue-rotate(${tintHueRotate.toFixed(1)}deg)`;
    }

    // 5. Split-Toning Emulation
    let splitFilter = '';
    if (profile?.splitToning) {
      const st = profile.splitToning;
      if ((st.shadowSat && st.shadowSat > 3) || (st.highlightSat && st.highlightSat > 3)) {
        const shadowShift = (st.shadowHue || 0) * 0.08;
        const hlShift = (st.highlightHue || 0) * 0.08;
        splitFilter = ` hue-rotate(${((hlShift - shadowShift) * 0.7).toFixed(1)}deg)`;
      }
    }

    // 6. 3D LUT emulation
    let lutFilter = '';
    const lut = (profile?.lutPath || legacyColor?.lutPath || '').toLowerCase();
    const lutIntensity = profile?.lutIntensity ?? 1.0;
    if (lutIntensity > 0.01) {
      if (lut.includes('teal_orange')) {
        lutFilter = ` hue-rotate(-${(22 * lutIntensity).toFixed(1)}deg) saturate(${(1 + 0.35 * lutIntensity).toFixed(3)}) contrast(${(1 + 0.25 * lutIntensity).toFixed(3)})`;
      } else if (lut.includes('warm_film')) {
        lutFilter = ` sepia(${(0.35 * lutIntensity).toFixed(3)}) saturate(${(1 + 0.15 * lutIntensity).toFixed(3)}) brightness(${(1 + 0.08 * lutIntensity).toFixed(3)}) contrast(${(1 + 0.12 * lutIntensity).toFixed(3)})`;
      } else if (lut.includes('clean_cool')) {
        lutFilter = ` hue-rotate(${(25 * lutIntensity).toFixed(1)}deg) saturate(${(1 - 0.12 * lutIntensity).toFixed(3)}) contrast(${(1 + 0.15 * lutIntensity).toFixed(3)})`;
      } else if (lut.includes('vintage')) {
        lutFilter = ` sepia(${(0.45 * lutIntensity).toFixed(3)}) contrast(${(1 + 0.28 * lutIntensity).toFixed(3)}) brightness(${(1 - 0.08 * lutIntensity).toFixed(3)})`;
      } else if (lut.includes('vibrant')) {
        lutFilter = ` saturate(${(1 + 0.65 * lutIntensity).toFixed(3)}) contrast(${(1 + 0.22 * lutIntensity).toFixed(3)})`;
      } else if (lut.includes('monochrome') || lut.includes('bw')) {
        lutFilter = ` grayscale(${lutIntensity.toFixed(2)}) contrast(${(1 + 0.3 * lutIntensity).toFixed(3)})`;
      } else if (lut.length > 0) {
        lutFilter = ` contrast(${(1 + 0.18 * lutIntensity).toFixed(3)}) saturate(${(1 + 0.15 * lutIntensity).toFixed(3)})`;
      }
    }

    // 7. HSL Secondary Qualifier adjustments
    let hslFilter = '';
    let hslMatteFilter = '';
    const hsl = profile?.hslQualifier;
    if (hsl && hsl.enabled) {
      if (hsl.showMatte) {
        hslMatteFilter = 'grayscale(100%) contrast(500%) invert(100%)';
      } else {
        const shift = hsl.isolatedHueShift ?? 0;
        const sat = hsl.isolatedSat ?? 1.0;
        const gain = hsl.isolatedGain ?? 1.0;
        if (Math.abs(shift) > 0.5) hslFilter += ` hue-rotate(${shift.toFixed(1)}deg)`;
        if (Math.abs(sat - 1.0) > 0.01) saturateVal *= sat;
        if (Math.abs(gain - 1.0) > 0.01) brightnessVal *= Math.max(0.05, gain);
      }
    }

    // Build optimized filter tokens - only include active transforms
    const tokens: string[] = [];
    if (hslMatteFilter) {
      tokens.push(hslMatteFilter);
    }
    if (Math.abs(brightnessVal - 1.0) > 0.005) tokens.push(`brightness(${brightnessVal.toFixed(3)})`);
    if (Math.abs(contrastVal - 1.0) > 0.005) tokens.push(`contrast(${contrastVal.toFixed(3)})`);
    if (Math.abs(saturateVal - 1.0) > 0.005) tokens.push(`saturate(${saturateVal.toFixed(3)})`);
    if (tempFilter) tokens.push(tempFilter.trim());
    if (tintFilter) tokens.push(tintFilter.trim());
    if (Math.abs(selHueShift) > 0.5) tokens.push(`hue-rotate(${selHueShift.toFixed(1)}deg)`);
    if (splitFilter) tokens.push(splitFilter.trim());
    if (lutFilter) tokens.push(lutFilter.trim());
    if (hslFilter) tokens.push(hslFilter.trim());

    return tokens.join(' ');
  };

  // Phase 7: Hierarchical Multi-Pass Color Grading Pipeline
  // Clip Pass -> Track Pass -> Adjustment Layer Pass -> Master Pass
  const getInspectorFilterStyle = (clip?: any) => {
    const rawTarget = clip || activeLayer?.clip;
    const targetClip = rawTarget ? getFreshClip(rawTarget) || rawTarget : null;

    // Check if HSL qualifier showMatte is enabled on clip, track, adjustment layer, or master
    const isShowMatte = Boolean(
      (targetClip?.colorGrading?.hslQualifier?.enabled && targetClip.colorGrading.hslQualifier.showMatte) ||
        (activeLayer?.track?.trackGrading?.hslQualifier?.enabled &&
          activeLayer.track.trackGrading.hslQualifier.showMatte) ||
        (masterGrading?.hslQualifier?.enabled && masterGrading.hslQualifier.showMatte) ||
        targetClip?.colorGrading?.hslQualifier?.showMatte ||
        activeLayer?.track?.trackGrading?.hslQualifier?.showMatte ||
        masterGrading?.hslQualifier?.showMatte
    );

    if (isShowMatte) {
      return 'grayscale(1) contrast(5) invert(1)';
    }

    if (!targetClip) {
      const masterFilter = compileColorProfileToCssFilter(masterGrading);
      return masterFilter || undefined;
    }

    // 1. Clip Pass
    const clipFilter = compileColorProfileToCssFilter(
      targetClip.colorGrading,
      targetClip.color || targetClip
    );

    // 2. Track Pass (lookup containing track for accurate track grade)
    const clipTrack =
      (tracks || []).find((t) => t.clips?.some((c) => c.id === targetClip.id)) || activeLayer?.track;
    const trackFilter = compileColorProfileToCssFilter(clipTrack?.trackGrading);

    // 3. Adjustment Layer Pass (active adjustment layers on timeline covering playhead)
    let adjFilter = '';
    const activeAdjustmentLayers = (tracks || [])
      .flatMap((t) => t.clips || [])
      .filter((c) => {
        if (!c.isAdjustmentLayer && c.mediaType !== 'adjustment' && c.filePath !== 'adjustment_layer')
          return false;
        const start = c.startPositionSeconds ?? 0;
        const dur = c.durationSeconds ?? 0;
        return playhead >= start && playhead <= start + dur;
      });

    for (const adj of activeAdjustmentLayers) {
      const f = compileColorProfileToCssFilter(adj.colorGrading);
      if (f) adjFilter += ` ${f}`;
      if (adj.filterRecipe) {
        const pf = compileShaderRecipeToCssFilter(
          adj.filterRecipe,
          adj.filterIntensity ?? 1.0
        );
        if (pf && pf !== 'none') adjFilter += ` ${pf}`;
      }
    }

    // 4. Preset Filter / 3D LUT Pass on Clip
    let presetFilter = '';
    if (targetClip.filterRecipe) {
      const pf = compileShaderRecipeToCssFilter(
        targetClip.filterRecipe,
        targetClip.filterIntensity ?? 1.0
      );
      if (pf && pf !== 'none') presetFilter = ` ${pf}`;
    }

    // 5. Master Pass
    const masterFilter = compileColorProfileToCssFilter(masterGrading);

    // Lens Gaussian Blur
    let blurFilter = '';
    const blur = targetClip.lensEffects?.gaussianBlur ?? 0;
    if (blur > 0.05) {
      blurFilter = ` blur(${Math.min(25, blur * 0.5)}px)`;
    }

    const combined = `${clipFilter} ${trackFilter} ${adjFilter} ${presetFilter} ${masterFilter} ${blurFilter}`.trim();
    return combined || undefined;
  };

  // Sync audio volume, ducking, and mute levels
  useEffect(() => {
    if (!currentActiveClip) {
      if (videoRef.current) {
        videoRef.current.muted = true;
        videoRef.current.volume = 0;
      }
      if (incomingVideoRef.current) {
        incomingVideoRef.current.muted = true;
        incomingVideoRef.current.volume = 0;
      }
      return;
    }

    const isMuted = Boolean(activeLayer?.track?.muted || activeLayer?.track?.isMuted);
    const clip = activeLayer?.clip;
    const clipStart = clip?.startPositionSeconds ?? 0;
    const volumeDb = clip ? getInterpolatedVolumeDb(clip, playhead - clipStart) : 0;

    // Check dialogue activity on speech tracks for auto-ducking
    const isAnyDialogueActive = (tracks || []).some((t) => {
      if (t.id === activeLayer?.track?.id) return false;
      const isSpeechTrack =
        (t.name || '').toLowerCase().includes('voice') ||
        (t.name || '').toLowerCase().includes('dialogue') ||
        (t.name || '').toLowerCase().includes('mic');
      if (!isSpeechTrack) return false;
      return (t.clips || []).some((c) => {
        const s = c.startPositionSeconds ?? 0;
        const d = c.durationSeconds ?? 10;
        return playhead >= s && playhead < s + d;
      });
    });

    const isDucked = Boolean(activeLayer?.track?.ducking?.duckingEnabled && isAnyDialogueActive);
    const duckingDb = isDucked ? (activeLayer?.track?.ducking?.attenuationDb ?? -14) : 0;
    const totalDb = volumeDb + duckingDb;
    const linearGain = isMuted || totalDb <= -58 ? 0 : Math.pow(10, totalDb / 20);

    const activeVid = activePlayer === 'player1' ? videoRef.current : incomingVideoRef.current;
    const standbyVid = activePlayer === 'player1' ? incomingVideoRef.current : videoRef.current;

    const np = activeLayer?.clip?.audioProcessing?.noiseProfile;
    const hasDenoised = Boolean(np?.noiseReductionEnabled && np?.denoisedAudioPath);

    if (activeVid) {
      if (hasDenoised) {
        activeVid.muted = true;
        activeVid.volume = 0;
      } else {
        activeVid.muted = isMuted || linearGain === 0;
        activeVid.volume = isMuted ? 0 : Math.max(0, Math.min(1.0, linearGain));
      }
    }
    if (standbyVid) {
      standbyVid.muted = true;
      standbyVid.volume = 0;
    }

    if (denoisedAudioPlayerRef.current) {
      if (hasDenoised && np?.denoisedAudioPath) {
        const cleanSrc = getCleanMediaUrl(np.denoisedAudioPath);
        if (denoisedAudioPlayerRef.current.src !== cleanSrc) {
          denoisedAudioPlayerRef.current.src = cleanSrc;
        }
        denoisedAudioPlayerRef.current.muted = isMuted || linearGain === 0;
        denoisedAudioPlayerRef.current.volume = isMuted ? 0 : Math.max(0, Math.min(1.0, linearGain));
      } else {
        denoisedAudioPlayerRef.current.muted = true;
        denoisedAudioPlayerRef.current.volume = 0;
      }
    }
  }, [
    activePlayer,
    currentActiveClip,
    activeLayer?.clip?.volumeDb,
    activeLayer?.clip?.audioProcessing,
    activeLayer?.track?.muted,
    activeLayer?.track?.isMuted,
    activeLayer?.track?.ducking,
    playhead,
    tracks,
  ]);

  // Real-Time Web Audio Preview: Simulate low-gain ambient bed when Ambient Recovery is active
  const ambientBedRef = useRef<{ ctx: AudioContext; node: AudioBufferSourceNode | null; gain: GainNode | null } | null>(null);

  useEffect(() => {
    const np = activeLayer?.clip?.audioProcessing?.noiseProfile;
    const shouldPlayBed = Boolean(isPlaying && np?.ambientRecoveryEnabled && (np.ambientFillIntensity ?? 0.25) > 0);

    if (!shouldPlayBed) {
      if (ambientBedRef.current?.node) {
        try {
          ambientBedRef.current.node.stop();
          ambientBedRef.current.node.disconnect();
        } catch {}
        ambientBedRef.current.node = null;
      }
      return;
    }

    try {
      const ctx = getSharedAudioContext();
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }

      if (!ambientBedRef.current) {
        ambientBedRef.current = { ctx, node: null, gain: null };
      }

      if (!ambientBedRef.current.gain) {
        const gain = ctx.createGain();
        gain.connect(ctx.destination);
        ambientBedRef.current.gain = gain;
      }

      const intensity = Math.max(0, Math.min(1.0, np?.ambientFillIntensity ?? 0.25));
      ambientBedRef.current.gain.gain.setTargetAtTime(intensity * 0.03, ctx.currentTime, 0.05);

      if (!ambientBedRef.current.node) {
        // Generate 3s loop of filtered ambient pink noise for real-time room tone bed
        const bufferSize = ctx.sampleRate * 3;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        let b0 = 0, b1 = 0, b2 = 0;
        for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2 - 1;
          b0 = 0.99765 * b0 + white * 0.0990460;
          b1 = 0.96300 * b1 + white * 0.1243680;
          b2 = 0.86650 * b2 + white * 0.2636820;
          data[i] = (b0 + b1 + b2) * 0.04;
        }

        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.loop = true;

        const bandFilter = ctx.createBiquadFilter();
        bandFilter.type = 'bandpass';
        bandFilter.frequency.value = 250;
        bandFilter.Q.value = 0.8;

        source.connect(bandFilter);
        bandFilter.connect(ambientBedRef.current.gain);
        source.start(0);
        ambientBedRef.current.node = source;
      }
    } catch {}

    return () => {
      if (ambientBedRef.current?.node) {
        try {
          ambientBedRef.current.node.stop();
          ambientBedRef.current.node.disconnect();
        } catch {}
        ambientBedRef.current.node = null;
      }
    };
  }, [isPlaying, activeLayer?.clip?.audioProcessing?.noiseProfile]);

  // Scrubbing / Seek synchronization (accurate frame seeking when paused)
  useEffect(() => {
    if (isPlaying) {
      const activeVid = activePlayer === 'player1' ? videoRef.current : incomingVideoRef.current;
      const rawClip = activePlayer === 'player1' ? player1Clip : player2Clip;
      const activeClip = getFreshClip(rawClip);
      if (activeVid && activeClip && currentActiveClip && activeClip.id === currentActiveClip.id) {
        const targetTime = getClipSeekTime(activeClip, playhead);
        const diff = Math.abs(activeVid.currentTime - targetTime);
        if (diff > 0.6) {
          activeVid.currentTime = targetTime;
        }
      }
      return;
    }

    if (!currentActiveClip) {
      if (videoRef.current && !videoRef.current.paused) videoRef.current.pause();
      if (incomingVideoRef.current && !incomingVideoRef.current.paused) incomingVideoRef.current.pause();
      return;
    }

    if (videoRef.current && player1Clip && player1Clip.id === currentActiveClip.id) {
      const fresh1 = getFreshClip(player1Clip) || player1Clip;
      videoRef.current.currentTime = getClipSeekTime(fresh1, playhead);
    }
    if (incomingVideoRef.current && player2Clip && player2Clip.id === currentActiveClip.id) {
      const fresh2 = getFreshClip(player2Clip) || player2Clip;
      incomingVideoRef.current.currentTime = getClipSeekTime(fresh2, playhead);
    }
    if (denoisedAudioPlayerRef.current && currentActiveClip) {
      const fresh = getFreshClip(currentActiveClip) || currentActiveClip;
      const np = fresh.audioProcessing?.noiseProfile;
      if (np?.noiseReductionEnabled && np?.denoisedAudioPath) {
        const dSrc = getCleanMediaUrl(np.denoisedAudioPath);
        if (denoisedAudioPlayerRef.current.src !== dSrc) {
          denoisedAudioPlayerRef.current.src = dSrc;
        }
        denoisedAudioPlayerRef.current.currentTime = getClipSeekTime(fresh, playhead);
      }
    }
  }, [playhead, isPlaying, player1Clip, player2Clip, activePlayer, currentActiveClip, tracks]);

  // Continuous smooth requestAnimationFrame playback loop driven by hardware decoder clock
  useEffect(() => {
    let animId: number | null = null;

    if (!isPlaying) {
      if (videoRef.current && !videoRef.current.paused) videoRef.current.pause();
      if (incomingVideoRef.current && !incomingVideoRef.current.paused) incomingVideoRef.current.pause();
      if (denoisedAudioPlayerRef.current && !denoisedAudioPlayerRef.current.paused) denoisedAudioPlayerRef.current.pause();
      return;
    }

    const curVid = activePlayerRef.current === 'player2' ? incomingVideoRef.current : videoRef.current;
    const rawCurClip = activePlayerRef.current === 'player2' ? player2Clip : player1Clip;
    const curClip = getFreshClip(rawCurClip);
    // Only play video element if playhead is currently over a valid active video clip!
    if (currentActiveClip && curClip?.id === currentActiveClip.id) {
      if (curVid) {
        const speed = curClip.speedProfile?.speedMultiplier ?? 1.0;
        curVid.playbackRate = Math.max(0.1, Math.min(16.0, speed));
        (curVid as any).preservesPitch = curClip.speedProfile?.pitchCorrection ?? true;
        if (curVid.paused) {
          curVid.play().catch(() => {});
        }
      }
      const np = curClip.audioProcessing?.noiseProfile;
      if (np?.noiseReductionEnabled && np?.denoisedAudioPath && denoisedAudioPlayerRef.current) {
        const dAudio = denoisedAudioPlayerRef.current;
        const dSrc = getCleanMediaUrl(np.denoisedAudioPath);
        if (dAudio.src !== dSrc) dAudio.src = dSrc;
        dAudio.playbackRate = curVid ? curVid.playbackRate : 1.0;
        if (curVid && Math.abs(dAudio.currentTime - curVid.currentTime) > 0.15) {
          dAudio.currentTime = curVid.currentTime;
        }
        if (dAudio.paused) dAudio.play().catch(() => {});
      } else if (denoisedAudioPlayerRef.current && !denoisedAudioPlayerRef.current.paused) {
        denoisedAudioPlayerRef.current.pause();
      }
    } else {
      if (videoRef.current && !videoRef.current.paused) videoRef.current.pause();
      if (incomingVideoRef.current && !incomingVideoRef.current.paused) incomingVideoRef.current.pause();
      if (denoisedAudioPlayerRef.current && !denoisedAudioPlayerRef.current.paused) denoisedAudioPlayerRef.current.pause();
    }

    let lastTime = performance.now();

    const tick = (now: number) => {
      const state = useTimelineStore.getState();
      if (!state.isPlaying) return;

      const deltaSec = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      let nextPlayhead = state.playhead + deltaSec;

      // Sync clock against audio or video hardware decoders to eliminate playhead-audio drift
      const audioClock = getActiveAudioClock();
      const topClip = getTopClipAt(nextPlayhead);
      const masterVideo = activePlayerRef.current === 'player2' ? incomingVideoRef.current : videoRef.current;
      const rawMasterClip = activePlayerRef.current === 'player2' ? player2Clip : player1Clip;
      const masterClip = getFreshClip(rawMasterClip);

      if (
        audioClock &&
        !audioClock.audio.paused &&
        !audioClock.audio.seeking &&
        audioClock.audio.readyState >= 2
      ) {
        const audioElapsed = audioClock.audio.currentTime - audioClock.inPoint;
        const targetTimelineSec = audioClock.clipStart + audioElapsed;
        const drift = targetTimelineSec - state.playhead;
        if (Math.abs(drift) > 0.02 && Math.abs(drift) < 1.0) {
          nextPlayhead = targetTimelineSec;
        }
      } else if (topClip && masterVideo && !masterVideo.paused && !masterVideo.seeking && masterClip && masterClip.id === topClip.id) {
        const clipStart = masterClip.startPositionSeconds ?? (masterClip.startTimeMs ? masterClip.startTimeMs / 1000 : 0);
        const inPoint = masterClip.inPointSeconds ?? (masterClip.sourceOffsetMs ? masterClip.sourceOffsetMs / 1000 : 0);
        const speed = masterClip.speedProfile?.speedMultiplier ?? 1.0;
        const sourceElapsed = masterVideo.currentTime - inPoint;
        const calculatedPlayhead = clipStart + (sourceElapsed / speed);
        const drift = calculatedPlayhead - state.playhead;
        if (Math.abs(drift) > 0.03 && Math.abs(drift) < 2.0) {
          nextPlayhead = calculatedPlayhead;
        }
      }

      // Check if active clip switched at nextPlayhead across tracks or joints
      if (topClip) {
        if (player1Clip?.id === topClip.id) {
          if (activePlayerRef.current !== 'player1') {
            activePlayerRef.current = 'player1';
            setActivePlayer('player1');
          }
          if (videoRef.current) {
            const fresh1 = getFreshClip(player1Clip) || player1Clip;
            const speed = fresh1.speedProfile?.speedMultiplier ?? 1.0;
            videoRef.current.playbackRate = Math.max(0.1, Math.min(16.0, speed));
            (videoRef.current as any).preservesPitch = fresh1.speedProfile?.pitchCorrection ?? true;
            if (videoRef.current.paused) {
              videoRef.current.play().catch(() => {});
            }
          }
        } else if (player2Clip?.id === topClip.id) {
          if (activePlayerRef.current !== 'player2') {
            activePlayerRef.current = 'player2';
            setActivePlayer('player2');
          }
          if (incomingVideoRef.current) {
            const fresh2 = getFreshClip(player2Clip) || player2Clip;
            const speed = fresh2.speedProfile?.speedMultiplier ?? 1.0;
            incomingVideoRef.current.playbackRate = Math.max(0.1, Math.min(16.0, speed));
            (incomingVideoRef.current as any).preservesPitch = fresh2.speedProfile?.pitchCorrection ?? true;
            if (incomingVideoRef.current.paused) {
              incomingVideoRef.current.play().catch(() => {});
            }
          }
        }
      } else {
        // Empty space or cleared track: pause both players so video never plays on empty timeline
        if (videoRef.current && !videoRef.current.paused) videoRef.current.pause();
        if (incomingVideoRef.current && !incomingVideoRef.current.paused) incomingVideoRef.current.pause();
      }

      // Pre-roll standby player if approaching upcoming clip (within 0.8s)
      const standbyVideo = activePlayerRef.current === 'player2' ? videoRef.current : incomingVideoRef.current;
      const rawStandbyClip = activePlayerRef.current === 'player2' ? player1Clip : player2Clip;
      const standbyClip = getFreshClip(rawStandbyClip);
      if (standbyVideo && standbyClip && standbyVideo.readyState >= 1) {
        const startSec = standbyClip.startPositionSeconds ?? (standbyClip.startTimeMs ? standbyClip.startTimeMs / 1000 : 0);
        const curActiveClip = activePlayerRef.current === 'player2' ? player2Clip : player1Clip;
        const freshCurActive = getFreshClip(curActiveClip);
        const activeEndSec = freshCurActive
          ? (freshCurActive.startPositionSeconds ?? (freshCurActive.startTimeMs ? freshCurActive.startTimeMs / 1000 : 0)) +
            (freshCurActive.durationSeconds ?? (freshCurActive.durationMs ? freshCurActive.durationMs / 1000 : 10))
          : 0;

        if (nextPlayhead >= activeEndSec - 0.8 || nextPlayhead >= startSec - 0.8) {
          const targetTime = getClipSeekTime(standbyClip, nextPlayhead);
          const standbySpeed = standbyClip.speedProfile?.speedMultiplier ?? 1.0;
          standbyVideo.playbackRate = Math.max(0.1, Math.min(16.0, standbySpeed));
          (standbyVideo as any).preservesPitch = standbyClip.speedProfile?.pitchCorrection ?? true;
          if (standbyVideo.paused) {
            standbyVideo.currentTime = targetTime;
            standbyVideo.play().catch(() => {});
          } else if (Math.abs(standbyVideo.currentTime - targetTime) > 0.3) {
            standbyVideo.currentTime = targetTime;
          }
        }
      }

      const maxSec = (state.project.durationMs || 120000) / 1000;
      if (nextPlayhead >= maxSec) {
        state.setIsPlaying(false);
        state.setPlayhead(maxSec);
        return;
      }

      state.setPlayhead(nextPlayhead);
      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => {
      if (animId) cancelAnimationFrame(animId);
      if (videoRef.current && !videoRef.current.paused) videoRef.current.pause();
      if (incomingVideoRef.current && !incomingVideoRef.current.paused) incomingVideoRef.current.pause();
    };
  }, [isPlaying, isVideoLoaded, isIncomingVideoLoaded, player1Clip, player2Clip, currentActiveClip, tracks]);

  // Audio VU meter dynamics during playback
  useEffect(() => {
    if (!isPlaying) {
      setVuLeft(0);
      setVuRight(0);
      return;
    }

    const interval = setInterval(() => {
      const base = 52 + Math.random() * 35;
      setVuLeft(Math.min(96, Math.max(8, base + (Math.random() * 10 - 5))));
      setVuRight(Math.min(96, Math.max(8, base + (Math.random() * 10 - 5))));
    }, 75);

    return () => clearInterval(interval);
  }, [isPlaying]);

  // HTML5 Canvas Rendering for Program Monitor Viewport
  useEffect(() => {
    // Canvas is hidden behind video during active video playback - skip heavy 2D drawing cycles to maximize 60 FPS performance!
    if (isPlaying && currentActiveClip && (isVideoLoaded || isIncomingVideoLoaded)) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Clear background
    ctx.fillStyle = '#08090C';
    ctx.fillRect(0, 0, width, height);

    if (activeLayer) {
      const { clip, track } = activeLayer;
      const trackColor = track.color || '#00F0FF';

      // Draw active clip background gradient/shading
      const grad = ctx.createRadialGradient(
        width / 2,
        height / 2,
        width * 0.1,
        width / 2,
        height / 2,
        width * 0.6
      );
      grad.addColorStop(0, '#1E2330');
      grad.addColorStop(0.7, '#11141C');
      grad.addColorStop(1, '#080A0E');

      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      // Draw subtle studio video grid
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
      ctx.lineWidth = 1;
      const step = 40;
      for (let x = 0; x < width; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Draw Center Crosshair / Viewfinder Mark
      ctx.strokeStyle = trackColor;
      ctx.lineWidth = 1.5;
      const cx = width / 2;
      const cy = height / 2;
      const chSize = 16;
      ctx.beginPath();
      ctx.moveTo(cx - chSize, cy);
      ctx.lineTo(cx + chSize, cy);
      ctx.moveTo(cx, cy - chSize);
      ctx.lineTo(cx, cy + chSize);
      ctx.stroke();

      // Draw Source Overlay Badge
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.roundRect ? ctx.roundRect(16, 16, 180, 26, 4) : ctx.fillRect(16, 16, 180, 26);
      ctx.fill();
      ctx.strokeStyle = trackColor;
      ctx.stroke();

      ctx.font = 'bold 11px monospace';
      ctx.fillStyle = trackColor;
      ctx.fillText(`LAYER: ${track.name.toUpperCase()}`, 26, 33);

      // Draw Filename & Clip Duration
      ctx.font = '12px monospace';
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(clip.name, 16, height - 24);

      // Draw Frame Index
      const frameIdx = Math.floor(playhead * project.fps);
      ctx.font = '10px monospace';
      ctx.fillStyle = '#64748B';
      ctx.fillText(`FRAME ${frameIdx} | ${project.fps} FPS`, 16, height - 10);

      // Draw Live REC Indicator if playing
      if (isPlaying) {
        ctx.fillStyle = '#EF4444';
        ctx.beginPath();
        ctx.arc(width - 24, 26, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = 'bold 10px monospace';
        ctx.fillText('PLAY', width - 60, 30);
      }
    } else {
      // Empty Timeline Slate
      ctx.fillStyle = '#0F1217';
      ctx.fillRect(0, 0, width, height);

      ctx.font = '13px sans-serif';
      ctx.fillStyle = '#525D73';
      ctx.textAlign = 'center';
      ctx.fillText('NO ACTIVE VIDEO LAYER AT PLAYHEAD', width / 2, height / 2 - 10);

      ctx.font = '11px monospace';
      ctx.fillStyle = '#3E4657';
      ctx.fillText('Place video clips on timeline tracks to preview', width / 2, height / 2 + 12);
      ctx.textAlign = 'left';
    }

    // Always draw frame-accurate Timecode in Bottom Right
    const tcStr = formatTimecode(playhead, project.fps);
    ctx.font = 'bold 14px monospace';
    ctx.fillStyle = '#00F0FF';
    ctx.textAlign = 'right';
    ctx.fillText(tcStr, width - 16, height - 16);
    ctx.textAlign = 'left';
  }, [playhead, activeLayer, isPlaying, project.fps]);

  const getPrimaryTransitionStyle = (
    info: NonNullable<typeof activeTransitionInfo>
  ): React.CSSProperties => {
    if (!info || !info.isActive) return {};
    const { type, progress } = info;

    switch (type) {
      case 'fade':
      case 'dip_black':
      case 'black':
        return {
          opacity: progress < 0.5 ? Math.max(0, 1 - progress * 2) : 0,
        };

      case 'fadewhite':
      case 'dip_white':
      case 'white':
        return {
          opacity: progress < 0.5 ? 1 : 0,
          filter: progress < 0.5 ? `brightness(${1 + progress * 4})` : undefined,
        };

      case 'slideup':
        return {
          transform: `translateY(-${progress * 100}%)`,
          opacity: progress >= 1 ? 0 : 1,
        };

      case 'slidedown':
        return {
          transform: `translateY(${progress * 100}%)`,
          opacity: progress >= 1 ? 0 : 1,
        };

      case 'dissolve':
      case 'crossdissolve':
        return {
          opacity: Math.max(0, 1 - progress),
        };

      case 'wipeleft':
      case 'wiperight':
        return {
          opacity: progress < 1 ? 1 : 0,
        };

      case 'cut':
        return {
          opacity: progress >= 1 ? 0 : 1,
        };

      default:
        return {
          opacity: Math.max(0, 1 - progress),
        };
    }
  };

  const getIncomingTransitionStyle = (
    info: NonNullable<typeof activeTransitionInfo>
  ): React.CSSProperties => {
    if (!info || !info.isActive) return { opacity: 0 };
    const { type, progress } = info;

    switch (type) {
      case 'cut':
        return {
          opacity: progress >= 1 ? 1 : 0,
        };

      case 'dissolve':
      case 'crossdissolve':
        return {
          opacity: progress,
        };

      case 'fade':
      case 'dip_black':
      case 'black':
        return {
          opacity: progress >= 0.5 ? Math.max(0, (progress - 0.5) * 2) : 0,
        };

      case 'fadewhite':
      case 'dip_white':
      case 'white':
        return {
          opacity: progress >= 0.5 ? 1 : 0,
          filter: progress >= 0.5 ? `brightness(${1 + (1 - progress) * 4})` : undefined,
        };

      case 'wipeleft': {
        const wipePercent = (1 - progress) * 100;
        return {
          clipPath: `inset(0 0 0 ${wipePercent}%)`,
          opacity: 1,
        };
      }

      case 'wiperight': {
        const wipePercent = (1 - progress) * 100;
        return {
          clipPath: `inset(0 ${wipePercent}% 0 0)`,
          opacity: 1,
        };
      }

      case 'slideup':
        return {
          transform: `translateY(${(1 - progress) * 100}%)`,
          opacity: 1,
        };

      case 'slidedown':
        return {
          transform: `translateY(-${(1 - progress) * 100}%)`,
          opacity: 1,
        };

      default:
        return {
          opacity: progress,
        };
    }
  };

  // Selected clip for direct transform manipulation
  const selectedClip = useMemo(() => {
    if (!selectedClipId) return null;
    for (const t of tracks) {
      const c = t.clips.find((item) => item.id === selectedClipId);
      if (c) return c;
    }
    return null;
  }, [tracks, selectedClipId]);

  const selectedClipTransform = useMemo(() => {
    if (!selectedClip) return null;
    return getInterpolatedClipTransform(selectedClip, playhead);
  }, [selectedClip, playhead]);

  // Direct manipulation bounding box interaction state
  const [activeHandle, setActiveHandle] = useState<
    'center' | 'rotate' | 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | null
  >(null);
  const dragStartRef = useRef<{
    clipId: string;
    mouseX: number;
    mouseY: number;
    initialPosX: number;
    initialPosY: number;
    initialScale: number;
    initialRotation: number;
    initialDist: number;
    centerX: number;
    centerY: number;
  } | null>(null);

  const handleStartTransformDrag = (
    handle: 'center' | 'rotate' | 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w',
    e: React.MouseEvent
  ) => {
    e.stopPropagation();
    e.preventDefault();
    if (!selectedClip || !selectedClipTransform) return;

    const viewportRect = canvasRef.current?.getBoundingClientRect();
    const centerX = viewportRect
      ? viewportRect.left + viewportRect.width / 2 + selectedClipTransform.positionX
      : e.clientX;
    const centerY = viewportRect
      ? viewportRect.top + viewportRect.height / 2 + selectedClipTransform.positionY
      : e.clientY;
    const initialDist = Math.hypot(e.clientX - centerX, e.clientY - centerY);

    setActiveHandle(handle);
    dragStartRef.current = {
      clipId: selectedClip.id,
      mouseX: e.clientX,
      mouseY: e.clientY,
      initialPosX: selectedClipTransform.positionX,
      initialPosY: selectedClipTransform.positionY,
      initialScale: selectedClipTransform.scale,
      initialRotation: selectedClipTransform.rotation,
      initialDist,
      centerX,
      centerY,
    };
  };

  useEffect(() => {
    if (!activeHandle || !dragStartRef.current) return;

    const onMouseMove = (e: MouseEvent) => {
      const start = dragStartRef.current;
      if (!start) return;

      const deltaX = e.clientX - start.mouseX;
      const deltaY = e.clientY - start.mouseY;

      if (activeHandle === 'center') {
        const newX = Math.round(start.initialPosX + deltaX);
        const newY = Math.round(start.initialPosY + deltaY);
        updateClipTransform(start.clipId, { positionX: newX, positionY: newY });
      } else if (activeHandle === 'rotate') {
        const angleRad = Math.atan2(e.clientY - start.centerY, e.clientX - start.centerX);
        let angleDeg = Math.round((angleRad * 180) / Math.PI + 90);
        if (angleDeg < -180) angleDeg += 360;
        if (angleDeg > 180) angleDeg -= 360;
        updateClipTransform(start.clipId, { rotation: angleDeg });
      } else {
        // 8-direction scale handles
        const currentDist = Math.hypot(e.clientX - start.centerX, e.clientY - start.centerY);
        const ratio = currentDist / Math.max(10, start.initialDist);
        const newScale = Math.max(0.1, Math.min(5.0, Number((start.initialScale * ratio).toFixed(2))));
        updateClipTransform(start.clipId, { scale: newScale });
      }
    };

    const onMouseUp = () => {
      setActiveHandle(null);
      dragStartRef.current = null;
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [activeHandle]);

  // On-Canvas Text Direct Manipulation Interaction State
  const [editingTextClipId, setEditingTextClipId] = useState<string | null>(null);
  const [textDragActive, setTextDragActive] = useState<boolean>(false);
  const textDragRef = useRef<{
    clipId: string;
    mode: 'move' | 'resize';
    startMouseX: number;
    startMouseY: number;
    initialPosX: number;
    initialPosY: number;
    initialFontSize: number;
  } | null>(null);

  const handleStartTextDrag = (
    clipId: string,
    mode: 'move' | 'resize',
    e: React.MouseEvent
  ) => {
    e.stopPropagation();
    e.preventDefault();
    let currentClip: Clip | null = null;
    for (const t of tracks) {
      const c = t.clips.find((item) => item.id === clipId);
      if (c) {
        currentClip = c;
        break;
      }
    }
    if (!currentClip) return;

    const style = currentClip.textStyle || {
      fontFamily: 'Inter',
      fontSize: 42,
      fontColor: '#FFFFFF',
      strokeColor: '#000000',
      strokeWidth: 2,
      positionX: 0,
      positionY: 0,
      alignment: 'center',
    };

    setTextDragActive(true);
    textDragRef.current = {
      clipId,
      mode,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      initialPosX: style.positionX || 0,
      initialPosY: style.positionY || 0,
      initialFontSize: style.fontSize || 42,
    };
  };

  useEffect(() => {
    if (!textDragActive || !textDragRef.current) return;

    const onMouseMove = (e: MouseEvent) => {
      const info = textDragRef.current;
      if (!info) return;

      const deltaX = e.clientX - info.startMouseX;
      const deltaY = e.clientY - info.startMouseY;

      if (info.mode === 'move') {
        const newX = Math.round(info.initialPosX + deltaX);
        const newY = Math.round(info.initialPosY + deltaY);
        updateTextClipStyle(info.clipId, { positionX: newX, positionY: newY });
      } else if (info.mode === 'resize') {
        const newSize = Math.max(14, Math.min(180, Math.round(info.initialFontSize + deltaX * 0.4)));
        updateTextClipStyle(info.clipId, { fontSize: newSize });
      }
    };

    const onMouseUp = () => {
      setTextDragActive(false);
      textDragRef.current = null;
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [textDragActive, updateTextClipStyle]);

  const getPlayerStyle = (player: 'player1' | 'player2'): React.CSSProperties => {
    const rawClip = player === 'player1' ? player1Clip : player2Clip;
    const thisClip = getFreshClip(rawClip);
    const transform = thisClip ? getInterpolatedClipTransform(thisClip, playhead) : null;
    const stabScale =
      thisClip?.stabilization?.enabled && (thisClip.stabilization.intensity ?? 0) > 0.001
        ? 1 + (thisClip.stabilization.intensity ?? 0.5) * 0.05
        : 1.0;
    const dynamicTransformStyle: React.CSSProperties = transform
      ? {
          transform: `translate(${transform.positionX}px, ${transform.positionY}px) rotate(${transform.rotation}deg) scale(${(transform.scale * stabScale).toFixed(3)})`,
          transformOrigin: 'center center',
          opacity: transform.opacity,
        }
      : {
          transform: stabScale !== 1.0 ? `scale(${stabScale.toFixed(3)})` : undefined,
          transformOrigin: 'center center',
        };

    if (activeTransitionInfo && activeTransitionInfo.isActive) {
      const fromClipId = activeTransitionInfo.fromClip?.id;
      const toClipId = activeTransitionInfo.toClip?.id;

      if (thisClip?.id === toClipId) {
        return {
          ...getIncomingTransitionStyle(activeTransitionInfo),
          ...dynamicTransformStyle,
          zIndex: 10,
        };
      }
      if (thisClip?.id === fromClipId) {
        return {
          ...getPrimaryTransitionStyle(activeTransitionInfo),
          ...dynamicTransformStyle,
          zIndex: 5,
        };
      }
    }

    // Only display this player if there is an active clip at playhead AND this player holds that exact clip!
    const isCurrent = Boolean(currentActiveClip && thisClip?.id === currentActiveClip.id);

    if (isCurrent) {
      return {
        ...dynamicTransformStyle,
        opacity: dynamicTransformStyle.opacity !== undefined ? dynamicTransformStyle.opacity : 1,
        zIndex: 10,
        pointerEvents: 'auto',
      };
    } else {
      return {
        opacity: 0,
        zIndex: 5,
        pointerEvents: 'none',
      };
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#0D0E11] border-r border-[#222630] select-none">
      {/* Top Header: Player / Program Monitor */}
      <div className="h-9 bg-[#14161B] border-b border-[#222630] px-3.5 flex items-center justify-between text-xs text-[#8A92A6]">
        <div className="flex items-center gap-2">
          <span className="font-bold text-[#F0F3F8]">Program Monitor</span>
          <span className="text-[10px] text-[#64748B] font-mono">
            {project.width}x{project.height}
          </span>
        </div>

        {/* Aspect Ratio, Angle, and GPU Hardware info */}
        <div className="flex items-center gap-2 text-[11px]">
          {/* Video Scopes Toggle */}
          <button
            onClick={() => setIsScopesDrawerOpen(!isScopesDrawerOpen)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-bold border transition-all cursor-pointer ${
              isScopesDrawerOpen
                ? 'bg-[#E11D48] text-[#FFFFFF] border-[#E11D48] shadow-[0_0_10px_rgba(225,29,72,0.4)]'
                : 'bg-[#181B22] text-[#8A92A6] border-[#222630] hover:text-[#F0F3F8]'
            }`}
            title="Toggle Video Scopes (Waveform, RGB Parade, Vectorscope)"
          >
            <Activity size={12} />
            <span>Scopes</span>
          </button>

          {/* Reference Comparison Split View Toggle */}
          <button
            onClick={() => setSplitComparisonOpen(!isSplitComparisonOpen)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-bold border transition-all cursor-pointer ${
              isSplitComparisonOpen
                ? 'bg-[#8B5CF6] text-[#FFFFFF] border-[#8B5CF6] shadow-[0_0_10px_rgba(139,92,246,0.4)]'
                : 'bg-[#181B22] text-[#8A92A6] border-[#222630] hover:text-[#F0F3F8]'
            }`}
            title="Toggle Reference Comparison Split View"
          >
            <Split size={12} />
            <span>Compare</span>
          </button>

          {isSplitComparisonOpen && (
            <div className="flex items-center gap-1.5 bg-[#181B22] px-2 py-0.5 rounded border border-[#222630]">
              <button
                onClick={() => {
                  const source = videoRef.current || canvasRef.current;
                  if (source) {
                    const tempCanvas = document.createElement('canvas');
                    tempCanvas.width = 1280;
                    tempCanvas.height = 720;
                    const ctx = tempCanvas.getContext('2d');
                    if (ctx) {
                      ctx.drawImage(source, 0, 0, 1280, 720);
                      setReferenceSnapshotUrl(tempCanvas.toDataURL('image/jpeg', 0.85));
                    }
                  }
                }}
                className="text-[10px] font-bold text-[#8B5CF6] hover:text-[#A78BFA] transition-colors"
                title="Capture current frame as Reference Still"
              >
                Capture Ref
              </button>
              <span className="text-[#3A3F50]">|</span>
              <button
                onClick={() => {
                  const nextMode = splitComparisonMode === 'vertical' ? 'side-by-side' : 'vertical';
                  setSplitComparisonMode(nextMode);
                }}
                className="text-[10px] text-[#8A92A6] hover:text-[#F0F3F8] transition-colors"
                title="Switch between Split Slider and Side-by-Side"
              >
                {splitComparisonMode === 'vertical' ? 'Wipe' : 'Side'}
              </button>
              {referenceSnapshotUrl && (
                <>
                  <span className="text-[#3A3F50]">|</span>
                  <button
                    onClick={() => {
                      autoMatchLook();
                    }}
                    className="text-[10px] font-bold text-[#10B981] hover:text-[#34D399] transition-colors"
                    title="Auto-match exposure and color balance to Reference Still"
                  >
                    Match Look
                  </button>
                </>
              )}
            </div>
          )}

          {/* Global Proxy Mode Toggle */}
          <button
            onClick={toggleProxyMode}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-bold border transition-all cursor-pointer ${
              isProxyMode
                ? 'bg-[#10B981] text-[#0D0E11] border-[#10B981] shadow-[0_0_10px_rgba(16,185,129,0.4)]'
                : 'bg-[#181B22] text-[#8A92A6] border-[#222630] hover:text-[#F0F3F8]'
            }`}
            title={
              isProxyMode
                ? 'Proxy Mode Active: Decoding fast lightweight proxies for fluid scrubbing and multi-cam playback'
                : 'Proxy Mode Inactive: Decoding full-resolution master media'
            }
          >
            <Zap size={12} fill={isProxyMode ? 'currentColor' : 'none'} />
            <span>Proxy {isProxyMode ? 'ON' : 'OFF'}</span>
          </button>

          {/* Multicam Mode Switcher Toggle */}
          <button
            onClick={toggleMulticamActive}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-bold border transition-all cursor-pointer ${
              isMulticamActive
                ? 'bg-[#00F0FF] text-[#0D0E11] border-[#00F0FF] shadow-[0_0_10px_rgba(0,240,255,0.4)]'
                : 'bg-[#181B22] text-[#8A92A6] border-[#222630] hover:text-[#F0F3F8]'
            }`}
            title="Toggle Multicam Angle Switcher (Keys 1-9 to Cut)"
          >
            <Layers size={12} />
            <span>Multicam {isMulticamActive ? 'ON' : 'OFF'}</span>
          </button>

          {/* Multicam Split on Cut Option Toggle */}
          {isMulticamActive && (
            <button
              onClick={toggleMulticamSplitOnCut}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-bold border transition-all cursor-pointer ${
                multicamSplitOnCut
                  ? 'bg-[#10B981]/20 text-[#10B981] border-[#10B981]/40 hover:bg-[#10B981]/30'
                  : 'bg-[#F59E0B]/20 text-[#F59E0B] border-[#F59E0B]/40 hover:bg-[#F59E0B]/30'
              }`}
              title={
                multicamSplitOnCut
                  ? 'Split on Cut: ON (Switching camera angles splits timeline clips at the playhead)'
                  : 'Split on Cut: OFF (Switching camera angles changes live view only without splitting clips)'
              }
            >
              <Scissors size={12} className={multicamSplitOnCut ? 'text-[#10B981]' : 'text-[#F59E0B]'} />
              <span>{multicamSplitOnCut ? 'Split: ON' : 'Split: OFF'}</span>
            </button>
          )}

          {gpuInfo && (
            <div
              title={`Hardware GPU Acceleration Active: ${gpuInfo}`}
              className="flex items-center gap-1 px-2 py-0.5 rounded bg-[#00F0FF]/10 text-[#00F0FF] border border-[#00F0FF]/25 font-mono text-[10px]"
            >
              <Sparkles size={11} className="text-[#00F0FF]" />
              <span className="truncate max-w-[150px]">{gpuInfo}</span>
            </div>
          )}

          {activeLayer ? (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30 font-mono text-[10px]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] shadow-[0_0_6px_#10B981]" />
              <span>{activeLayer.track.name}</span>
              {isProxyMode && activeLayer.clip.hasProxy && (
                <span className="px-1 py-0.2 rounded text-[8px] font-bold bg-[#10B981] text-[#0D0E11] ml-0.5">
                  PROX
                </span>
              )}
              {activeLayer.clip.stabilization?.enabled && (
                <span
                  title={`Stabilization Active: ${Math.round((activeLayer.clip.stabilization.intensity ?? 0.5) * 100)}%`}
                  className="flex items-center gap-0.5 px-1 py-0.2 rounded text-[8px] font-bold bg-[#00F0FF] text-[#0D0E11] ml-0.5"
                >
                  <Shield size={9} />
                  <span>STAB</span>
                </span>
              )}
            </div>
          ) : (
            <span className="text-[10px] text-[#64748B] font-mono">No Active Video</span>
          )}
        </div>
      </div>

      {/* Main Single Program Monitor Canvas Viewport */}
      <div className="flex-1 flex items-center justify-center relative bg-[#090A0D] overflow-hidden p-4">
        {/* Rendered Frame Stage with Aspect Ratio Container */}
        <div
          style={{
            aspectRatio:
              aspectRatio === '16:9'
                ? '16 / 9'
                : aspectRatio === '9:16'
                ? '9 / 16'
                : aspectRatio === '1:1'
                ? '1 / 1'
                : `${project.width} / ${project.height}`,
          }}
          className="relative w-full max-w-full max-h-full rounded-md overflow-hidden bg-[#0A0C10] border border-[#222630] shadow-2xl flex items-center justify-center group"
        >
          {/* HTML5 Canvas Surface (studio viewfinder & permanent in-flow sizer) */}
          <canvas
            ref={canvasRef}
            width={project.width || 1920}
            height={project.height || 1080}
            style={{ filter: getInspectorFilterStyle() }}
            className="w-full h-full object-contain block pointer-events-none"
          />

          {/* Base Layer: Player 1 */}
          {player1Src && (
            <video
              ref={videoRef}
              src={player1Src}
              preload="auto"
              disablePictureInPicture
              disableRemotePlayback
              onLoadedMetadata={() => {
                setIsVideoLoaded(true);
                if (videoRef.current && player1Clip) {
                  const fresh1 = getFreshClip(player1Clip) || player1Clip;
                  videoRef.current.currentTime = getClipSeekTime(fresh1, playhead);
                }
              }}
              onError={() => setIsVideoLoaded(false)}
              style={{
                filter: getInspectorFilterStyle(getFreshClip(player1Clip) || player1Clip),
                ...getPlayerStyle('player1'),
              }}
              className="absolute inset-0 w-full h-full object-contain"
              playsInline
              muted={activePlayer !== 'player1' || Boolean(activeLayer?.track.muted || activeLayer?.track.isMuted)}
            />
          )}

          {/* Secondary Layer: Player 2 */}
          {player2Src && (
            <video
              ref={incomingVideoRef}
              src={player2Src}
              preload="auto"
              disablePictureInPicture
              disableRemotePlayback
              onLoadedMetadata={() => {
                setIsIncomingVideoLoaded(true);
                if (incomingVideoRef.current && player2Clip) {
                  const fresh2 = getFreshClip(player2Clip) || player2Clip;
                  incomingVideoRef.current.currentTime = getClipSeekTime(fresh2, playhead);
                }
              }}
              onError={() => setIsIncomingVideoLoaded(false)}
              style={{
                filter: getInspectorFilterStyle(getFreshClip(player2Clip) || player2Clip),
                ...getPlayerStyle('player2'),
              }}
              className="absolute inset-0 w-full h-full object-contain"
              playsInline
              muted={activePlayer !== 'player2' || Boolean(activeLayer?.track.muted || activeLayer?.track.isMuted)}
            />
          )}

          {/* Dedicated Denoised Audio Player for pristine background-hiss-free playback */}
          <audio ref={denoisedAudioPlayerRef} playsInline preload="auto" className="hidden" />

          {/* Wipe Transition Laser Edge Guide (Optional, user configurable) */}
          {activeTransitionInfo?.isActive &&
            Boolean(activeTransitionInfo.transition?.showBorder) &&
            activeTransitionInfo.type === 'wipeleft' && (
              <div
                style={{
                  left: `${(1 - activeTransitionInfo.progress) * 100}%`,
                  width: `${activeTransitionInfo.transition?.borderWidth || 2}px`,
                  backgroundColor: activeTransitionInfo.transition?.borderColor || '#A855F7',
                  boxShadow: `0 0 10px ${activeTransitionInfo.transition?.borderColor || '#A855F7'}`,
                }}
                className="absolute top-0 bottom-0 z-20 pointer-events-none -translate-x-1/2"
              />
            )}
          {activeTransitionInfo?.isActive &&
            Boolean(activeTransitionInfo.transition?.showBorder) &&
            activeTransitionInfo.type === 'wiperight' && (
              <div
                style={{
                  left: `${activeTransitionInfo.progress * 100}%`,
                  width: `${activeTransitionInfo.transition?.borderWidth || 2}px`,
                  backgroundColor: activeTransitionInfo.transition?.borderColor || '#A855F7',
                  boxShadow: `0 0 10px ${activeTransitionInfo.transition?.borderColor || '#A855F7'}`,
                }}
                className="absolute top-0 bottom-0 z-20 pointer-events-none -translate-x-1/2"
              />
            )}

          {/* Dip to White Flash Dissolve Overlay */}
          {activeTransitionInfo?.isActive &&
            (activeTransitionInfo.type === 'fadewhite' ||
              activeTransitionInfo.type === 'dip_white' ||
              activeTransitionInfo.type === 'white') && (
              <div
                style={{
                  opacity:
                    activeTransitionInfo.progress < 0.5
                      ? activeTransitionInfo.progress * 2
                      : (1 - activeTransitionInfo.progress) * 2,
                }}
                className="absolute inset-0 bg-white pointer-events-none z-15 transition-none"
              />
            )}

          {/* Transition Active Floating Badge */}
          {activeTransitionInfo?.isActive && (
            <div className="absolute top-2 right-2 px-2 py-0.5 rounded bg-[#A855F7]/80 text-white font-mono text-[9px] font-bold z-20 flex items-center gap-1 shadow-lg pointer-events-none animate-pulse">
              <Sparkles size={10} />
              <span className="capitalize">{activeTransitionInfo.transition.transitionType} ({activeTransitionInfo.transition.duration}s)</span>
            </div>
          )}

          {/* Program Monitor Direct Manipulation Transform Bounding Box */}
          {selectedClip && selectedClipTransform && currentActiveClip?.id === selectedClip.id && inspectorTab === 'video' && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                transformOrigin: 'center center',
                transform: `translate(${selectedClipTransform.positionX}px, ${selectedClipTransform.positionY}px) rotate(${selectedClipTransform.rotation}deg) scale(${selectedClipTransform.scale})`,
                pointerEvents: 'none',
                zIndex: 25,
              }}
              className="border-2 border-[#00F0FF] shadow-[0_0_12px_rgba(0,240,255,0.4)] select-none"
            >
              {/* Center Anchor Point Handle */}
              <div
                onMouseDown={(e) => handleStartTransformDrag('center', e)}
                style={{ pointerEvents: 'auto' }}
                title="Anchor Point: Drag to translate Position X/Y"
                className="absolute left-1/2 top-1/2 -ml-3 -mt-3 w-6 h-6 rounded-full border-2 border-[#00F0FF] bg-black/70 flex items-center justify-center cursor-move z-30 shadow-[0_0_8px_#00F0FF] hover:scale-125 transition-transform"
              >
                <div className="w-1.5 h-1.5 bg-[#00F0FF] rounded-full" />
              </div>

              {/* Outer Rotation Handle (stem + round grip) */}
              <div className="absolute left-1/2 -top-6 -ml-px w-0.5 h-6 bg-[#00F0FF] pointer-events-none" />
              <div
                onMouseDown={(e) => handleStartTransformDrag('rotate', e)}
                style={{ pointerEvents: 'auto' }}
                title="Rotation Handle: Drag to rotate clip"
                className="absolute left-1/2 -top-9 -ml-3 w-6 h-6 rounded-full border-2 border-[#00F0FF] bg-black/80 flex items-center justify-center cursor-grab active:cursor-grabbing hover:scale-125 transition-transform z-30 shadow-[0_0_8px_#00F0FF]"
              >
                <RotateCw size={11} className="text-[#00F0FF]" />
              </div>

              {/* 8 Resize Handles */}
              {/* NW */}
              <div
                onMouseDown={(e) => handleStartTransformDrag('nw', e)}
                style={{ pointerEvents: 'auto' }}
                className="absolute -left-1.5 -top-1.5 w-3 h-3 bg-[#00F0FF] border border-white cursor-nwse-resize z-30 hover:scale-125 transition-transform"
              />
              {/* N */}
              <div
                onMouseDown={(e) => handleStartTransformDrag('n', e)}
                style={{ pointerEvents: 'auto' }}
                className="absolute left-1/2 -ml-1.5 -top-1.5 w-3 h-3 bg-[#00F0FF] border border-white cursor-ns-resize z-30 hover:scale-125 transition-transform"
              />
              {/* NE */}
              <div
                onMouseDown={(e) => handleStartTransformDrag('ne', e)}
                style={{ pointerEvents: 'auto' }}
                className="absolute -right-1.5 -top-1.5 w-3 h-3 bg-[#00F0FF] border border-white cursor-nesw-resize z-30 hover:scale-125 transition-transform"
              />
              {/* E */}
              <div
                onMouseDown={(e) => handleStartTransformDrag('e', e)}
                style={{ pointerEvents: 'auto' }}
                className="absolute -right-1.5 top-1/2 -mt-1.5 w-3 h-3 bg-[#00F0FF] border border-white cursor-ew-resize z-30 hover:scale-125 transition-transform"
              />
              {/* SE */}
              <div
                onMouseDown={(e) => handleStartTransformDrag('se', e)}
                style={{ pointerEvents: 'auto' }}
                className="absolute -right-1.5 -bottom-1.5 w-3 h-3 bg-[#00F0FF] border border-white cursor-nwse-resize z-30 hover:scale-125 transition-transform"
              />
              {/* S */}
              <div
                onMouseDown={(e) => handleStartTransformDrag('s', e)}
                style={{ pointerEvents: 'auto' }}
                className="absolute left-1/2 -ml-1.5 -bottom-1.5 w-3 h-3 bg-[#00F0FF] border border-white cursor-ns-resize z-30 hover:scale-125 transition-transform"
              />
              {/* SW */}
              <div
                onMouseDown={(e) => handleStartTransformDrag('sw', e)}
                style={{ pointerEvents: 'auto' }}
                className="absolute -left-1.5 -bottom-1.5 w-3 h-3 bg-[#00F0FF] border border-white cursor-nesw-resize z-30 hover:scale-125 transition-transform"
              />
              {/* W */}
              <div
                onMouseDown={(e) => handleStartTransformDrag('w', e)}
                style={{ pointerEvents: 'auto' }}
                className="absolute -left-1.5 top-1/2 -mt-1.5 w-3 h-3 bg-[#00F0FF] border border-white cursor-ew-resize z-30 hover:scale-125 transition-transform"
              />

              {/* Real-time Transform Coordinate Pill Overlay */}
              <div className="absolute -bottom-7 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded bg-black/80 backdrop-blur-xs border border-[#222630] text-[#00F0FF] font-mono text-[9px] pointer-events-none whitespace-nowrap shadow-lg flex items-center gap-2">
                <span>Scale: {selectedClipTransform.scale.toFixed(2)}x</span>
                <span>Pos: ({selectedClipTransform.positionX}, {selectedClipTransform.positionY})</span>
                <span>Rot: {selectedClipTransform.rotation}°</span>
              </div>
            </div>
          )}

          {/* On-Canvas Text Direct Manipulation Overlays */}
          {(() => {
            const activeTextClips: Clip[] = [];
            for (const track of tracks) {
              if (track.visible === false || track.isVisible === false) continue;
              const isTextTrack = (track.trackType || track.type) === 'text';
              for (const clip of track.clips) {
                if (!isTextTrack && clip.textContent === undefined) continue;
                const start = clip.startPositionSeconds ?? (clip.startTimeMs / 1000);
                const dur = clip.durationSeconds ?? (clip.durationMs / 1000);
                if (playhead >= start && playhead <= start + dur) {
                  activeTextClips.push(clip);
                }
              }
            }

            return activeTextClips.map((textClip) => {
              const isSelected = selectedClipId === textClip.id;
              const transform = getInterpolatedClipTransform(textClip, playhead);
              const style = textClip.textStyle || {
                fontFamily: 'Inter',
                fontSize: 42,
                fontColor: '#FFFFFF',
                strokeColor: '#000000',
                strokeWidth: 2,
                backgroundColor: 'rgba(0,0,0,0.6)',
                backgroundPadding: 8,
                positionX: 0,
                positionY: 0,
                alignment: 'center',
                fontWeight: 'bold',
                lineHeight: 1.2,
              };

              const totalX = (style.positionX || 0) + (transform.positionX || 0);
              const totalY = (style.positionY || 0) + (transform.positionY || 0);
              const scale = transform.scale ?? 1.0;
              const rotation = transform.rotation ?? 0;
              const opacity = transform.opacity ?? 1.0;

              let alignClass = 'items-center justify-center';
              if (style.alignment === 'left') alignClass = 'items-center justify-start pl-8';
              else if (style.alignment === 'right') alignClass = 'items-center justify-end pr-8';
              else if (style.alignment === 'top_left' || style.alignment === 'top-left') alignClass = 'items-start justify-start p-8';
              else if (style.alignment === 'lower_third' || style.alignment === 'lower-third') alignClass = 'items-end justify-center pb-16';
              else if (style.alignment === 'bottom_center' || style.alignment === 'bottom-center') alignClass = 'items-end justify-center pb-8';

              const isEditing = editingTextClipId === textClip.id;

              return (
                <div
                  key={textClip.id}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    zIndex: isSelected ? 35 : 30,
                    pointerEvents: 'none',
                  }}
                  className={`flex ${alignClass}`}
                >
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      selectClip(textClip.id);
                    }}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      selectClip(textClip.id);
                      setEditingTextClipId(textClip.id);
                    }}
                    onMouseDown={(e) => {
                      if (e.target instanceof HTMLInputElement) return;
                      e.stopPropagation();
                      selectClip(textClip.id);
                      handleStartTextDrag(textClip.id, 'move', e);
                    }}
                    style={{
                      fontFamily: style.fontFamily || 'Inter, sans-serif',
                      fontSize: `${style.fontSize || 42}px`,
                      fontWeight: style.fontWeight || 'bold',
                      lineHeight: style.lineHeight || 1.2,
                      color: style.fontColor || '#FFFFFF',
                      WebkitTextStroke:
                        style.strokeWidth && style.strokeWidth > 0
                          ? `${style.strokeWidth}px ${style.strokeColor || '#000000'}`
                          : undefined,
                      textShadow:
                        style.strokeWidth && style.strokeWidth > 0
                          ? `0 0 ${style.strokeWidth * 3}px ${style.strokeColor || '#000000'}`
                          : '0 2px 8px rgba(0,0,0,0.8)',
                      backgroundColor: style.backgroundColor || 'transparent',
                      padding: style.backgroundPadding ? `${style.backgroundPadding}px` : undefined,
                      transform: `translate(${totalX}px, ${totalY}px) rotate(${rotation}deg) scale(${scale})`,
                      transformOrigin: 'center center',
                      opacity: opacity,
                      pointerEvents: 'auto',
                    }}
                    className={`relative rounded-md max-w-[85%] text-center cursor-move select-none transition-shadow ${
                      isSelected
                        ? 'ring-2 ring-[#A855F7] ring-offset-2 ring-offset-black/50 shadow-[0_0_16px_rgba(168,85,247,0.5)]'
                        : 'hover:ring-1 hover:ring-[#A855F7]/60'
                    }`}
                  >
                    {isEditing ? (
                      <input
                        autoFocus
                        type="text"
                        value={textClip.textContent || textClip.name}
                        onChange={(e) => updateTextClipContent(textClip.id, e.target.value)}
                        onBlur={() => setEditingTextClipId(null)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === 'Escape') {
                            setEditingTextClipId(null);
                          }
                        }}
                        className="bg-black/80 text-white px-2 py-1 rounded border border-[#A855F7] outline-none text-center min-w-[200px]"
                      />
                    ) : (
                      <span>{textClip.textContent || textClip.name}</span>
                    )}

                    {/* Corner Resize Handles for Selected Text Clip */}
                    {isSelected && !isEditing && (
                      <>
                        <div
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            handleStartTextDrag(textClip.id, 'resize', e);
                          }}
                          title="Drag to resize text font"
                          className="absolute -right-2 -bottom-2 w-4 h-4 rounded-full bg-[#A855F7] border border-white cursor-nwse-resize shadow-[0_0_8px_#A855F7] hover:scale-125 transition-transform"
                        />
                        <div
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            handleStartTextDrag(textClip.id, 'resize', e);
                          }}
                          title="Drag to resize text font"
                          className="absolute -left-2 -top-2 w-4 h-4 rounded-full bg-[#A855F7] border border-white cursor-nwse-resize shadow-[0_0_8px_#A855F7] hover:scale-125 transition-transform"
                        />
                      </>
                    )}
                  </div>
                </div>
              );
            });
          })()}

          {/* Multicam Miniature PiP Angles Switcher Overlay */}
          {isMulticamActive && (
            <div className="absolute bottom-2 left-2 right-2 bg-[#0C0E12]/92 backdrop-blur-md border border-[#222630] rounded-lg p-2 flex items-center gap-2 overflow-x-auto z-20 shadow-2xl">
              {/* Split on Cut Mode Selector Pill */}
              <button
                onClick={toggleMulticamSplitOnCut}
                className={`h-13 px-2.5 rounded-md border flex flex-col justify-center items-center gap-1 shrink-0 transition-all cursor-pointer ${
                  multicamSplitOnCut
                    ? 'bg-[#10B981]/15 text-[#10B981] border-[#10B981]/30 hover:bg-[#10B981]/25'
                    : 'bg-[#F59E0B]/15 text-[#F59E0B] border-[#F59E0B]/30 hover:bg-[#F59E0B]/25'
                }`}
                title={
                  multicamSplitOnCut
                    ? 'Split on Cut is ACTIVE (angle switch splits clip). Click to disable.'
                    : 'Split on Cut is OFF (angle switch only previews/switches angle). Click to enable.'
                }
              >
                <Scissors size={13} className={multicamSplitOnCut ? 'text-[#10B981]' : 'text-[#F59E0B]'} />
                <span className="text-[9px] font-mono font-bold uppercase whitespace-nowrap">
                  {multicamSplitOnCut ? 'Split: ON' : 'Split: OFF'}
                </span>
              </button>
              {tracks
                .filter((t) => t.trackType === 'video' || t.type === 'video')
                .map((vt, index) => {
                  const isCurrentActive = activeLayer?.track.id === vt.id;
                  const clipAtHead = vt.clips.find((c) => {
                    const start = c.startPositionSeconds || 0;
                    const end = start + (c.durationSeconds || 0);
                    return playhead >= start && playhead <= end;
                  });

                  return (
                    <button
                      key={vt.id}
                      onClick={() => switchMulticamAngle(index)}
                      className={`flex-1 min-w-[110px] max-w-[170px] h-13 rounded-md border text-left p-1.5 flex flex-col justify-between transition-all relative overflow-hidden group cursor-pointer ${
                        isCurrentActive
                          ? 'bg-[#181216] border-red-500 shadow-[0_0_12px_rgba(239,68,68,0.5)] ring-1 ring-red-500'
                          : 'bg-[#12141A] border-[#222630] hover:border-[#00F0FF]/60 hover:bg-[#161922]'
                      }`}
                      title={`Angle ${index + 1}: ${vt.name} (Press '${index + 1}' to Cut)`}
                    >
                      {/* Top Bar: Angle Number + Live Tally */}
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-[10px] px-1 py-0.2 rounded bg-black/70 text-white border border-white/10">
                          [{index + 1}]
                        </span>
                        {isCurrentActive ? (
                          <span className="flex items-center gap-1 font-mono font-bold text-[9px] text-red-400 bg-red-500/20 px-1 rounded animate-pulse">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                            LIVE
                          </span>
                        ) : (
                          <span className="text-[9px] font-mono text-[#64748B]">CUT</span>
                        )}
                      </div>

                      {/* Track name & active clip */}
                      <div className="truncate">
                        <div
                          className="text-[11px] font-bold truncate"
                          style={{ color: vt.color || '#00F0FF' }}
                        >
                          {vt.name}
                        </div>
                        <div className="text-[9px] font-mono text-[#64748B] truncate">
                          {clipAtHead ? clipAtHead.name : 'No Clip'}
                        </div>
                      </div>
                    </button>
                  );
                })}
            </div>
          )}

          {/* Center Safe Guides (hover visible) */}
          <div className="absolute inset-8 border border-white/5 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="absolute inset-16 border border-dashed border-white/5 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity" />

          {/* Reference Comparison Split View Overlay */}
          {isSplitComparisonOpen && referenceSnapshotUrl && (
            <>
              {splitComparisonMode === 'vertical' ? (
                <>
                  {/* Left Side: Reference Still clipped */}
                  <img
                    src={referenceSnapshotUrl}
                    alt="Reference Still"
                    className="absolute inset-0 w-full h-full object-contain pointer-events-none z-10"
                    style={{
                      clipPath: `polygon(0 0, ${splitComparisonPosition}% 0, ${splitComparisonPosition}% 100%, 0 100%)`,
                    }}
                  />
                  {/* Vertical Divider Line with handle */}
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-[#8B5CF6] shadow-[0_0_8px_#8B5CF6] z-20 pointer-events-none flex items-center justify-center"
                    style={{ left: `${splitComparisonPosition}%` }}
                  >
                    <div className="w-5 h-5 -ml-[0.5px] rounded-full bg-[#8B5CF6] text-white flex items-center justify-center text-[8px] font-bold shadow-lg border border-white/30">
                      VS
                    </div>
                  </div>
                  {/* Draggable Slider Control on Bottom */}
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-30 bg-[#0D0E11]/80 backdrop-blur-sm border border-[#222630] rounded-full px-3 py-1 flex items-center gap-2">
                    <span className="text-[9px] font-bold text-[#8B5CF6]">REF</span>
                    <input
                      type="range"
                      min={5}
                      max={95}
                      value={splitComparisonPosition}
                      onChange={(e) => setSplitComparisonPosition(Number(e.target.value))}
                      className="w-32 h-1 accent-[#8B5CF6] cursor-ew-resize bg-[#222630] rounded"
                    />
                    <span className="text-[9px] font-bold text-[#00F0FF]">GRADE</span>
                  </div>
                </>
              ) : (
                /* Side-by-Side Mode */
                <div className="absolute inset-0 z-10 flex pointer-events-none">
                  <div className="w-1/2 h-full relative border-r-2 border-[#8B5CF6] bg-black/60 flex items-center justify-center overflow-hidden">
                    <img
                      src={referenceSnapshotUrl}
                      alt="Reference Still"
                      className="w-full h-full object-contain"
                    />
                    <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-[#8B5CF6] text-white text-[9px] font-bold tracking-wider">
                      REFERENCE
                    </span>
                  </div>
                  <div className="w-1/2 h-full relative">
                    <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-[#00F0FF] text-[#0D0E11] text-[9px] font-bold tracking-wider">
                      CURRENT
                    </span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Bottom Player Transport Bar */}
      <div className="h-11 bg-[#14161B] border-t border-[#222630] px-4 flex items-center justify-between text-xs shrink-0">
        {/* Left: Timecode readout + Master VU meters */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-mono">
            <span className="text-[#00F0FF] font-bold text-xs timecode-display">
              {formatTimecode(playhead, project.fps)}
            </span>
            <span className="text-[#525D73]">/</span>
            <span className="text-[#8A92A6] text-xs timecode-display">
              {formatTimecode(totalSeconds, project.fps)}
            </span>
          </div>

          {/* Mini Stereo VU Meter */}
          <div className="flex items-end gap-0.5 h-3.5 bg-[#0D0E11] px-1 py-0.5 rounded border border-[#222630]">
            <div className="w-1.5 h-full bg-[#1A1D24] rounded-xs overflow-hidden flex flex-col justify-end">
              <div
                style={{ height: `${vuLeft}%` }}
                className={`w-full ${vuLeft > 80 ? 'bg-red-400' : 'bg-[#10B981]'}`}
              />
            </div>
            <div className="w-1.5 h-full bg-[#1A1D24] rounded-xs overflow-hidden flex flex-col justify-end">
              <div
                style={{ height: `${vuRight}%` }}
                className={`w-full ${vuRight > 80 ? 'bg-red-400' : 'bg-[#10B981]'}`}
              />
            </div>
          </div>
        </div>

        {/* Center: Play/Pause and Step buttons */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => stepFrames(-1)}
            title="Previous Frame (Left Arrow, Shift for 1 sec)"
            className="p-1 rounded hover:bg-[#222630] text-[#8A92A6] hover:text-[#00F0FF] transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={(e) => {
              e.currentTarget.blur();
              togglePlayPause();
            }}
            title="Play / Pause (Space)"
            className={`p-1.5 rounded-full transition-all ${
              isPlaying
                ? 'bg-[#00F0FF] text-[#0D0E11] shadow-[0_0_10px_rgba(0,240,255,0.4)]'
                : 'bg-[#222630] hover:bg-[#2D3340] text-[#F0F3F8]'
            }`}
          >
            {isPlaying ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" />}
          </button>
          <button
            onClick={() => stepFrames(1)}
            title="Next Frame (Right Arrow, Shift for 1 sec)"
            className="p-1 rounded hover:bg-[#222630] text-[#8A92A6] hover:text-[#00F0FF] transition-colors"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Right: Aspect ratio pill & Fullscreen button */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const ratios: ('Original' | '16:9' | '9:16' | '1:1')[] = ['Original', '16:9', '9:16', '1:1'];
              const next = ratios[(ratios.indexOf(aspectRatio) + 1) % ratios.length];
              setAspectRatio(next);
            }}
            className="px-2 py-0.5 rounded bg-[#0D0E11] border border-[#222630] text-[10px] font-mono text-[#8A92A6] hover:text-[#F0F3F8] transition-colors"
            title="Switch Aspect Ratio"
          >
            {aspectRatio}
          </button>
          <button
            onClick={() => {
              if (document.fullscreenElement) {
                document.exitFullscreen();
              } else {
                document.documentElement.requestFullscreen();
              }
            }}
            title="Toggle Fullscreen"
            className="p-1 rounded hover:bg-[#222630] text-[#8A92A6] hover:text-[#00F0FF] transition-colors"
          >
            <Maximize size={14} />
          </button>
        </div>
      </div>

      {/* Live Video Scopes Floating Drawer */}
      <VideoScopes
        isOpen={isScopesDrawerOpen}
        onClose={() => setIsScopesDrawerOpen(false)}
        activeScope={activeScopeType}
        onSelectScope={setActiveScopeType}
        videoElement={videoRef.current}
        canvasElement={canvasRef.current}
      />
    </div>
  );
};
