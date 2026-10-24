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
} from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useTimelineStore, isTauri } from '../../store/timelineStore';
import { formatTimecode } from '../../utils/timecode';
import { Clip } from '../../types/ipc';

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
    }))
  );

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const incomingVideoRef = useRef<HTMLVideoElement>(null);
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

  const getClipSeekTime = (clip: Clip, ph: number): number => {
    const s = clip.startPositionSeconds ?? (clip.startTimeMs != null ? clip.startTimeMs / 1000 : 0);
    const inPoint = clip.inPointSeconds ?? (clip.sourceOffsetMs != null ? clip.sourceOffsetMs / 1000 : 0);
    const dur = clip.durationSeconds ?? (clip.durationMs != null ? clip.durationMs / 1000 : 10);
    if (ph < s) {
      return inPoint;
    }
    if (ph > s + dur) {
      return Math.max(inPoint, inPoint + dur - 0.03);
    }
    return ph - s + inPoint;
  };

  // Compute real-time CSS filter style from clip's inspector adjustments & temperature
  const getInspectorFilterStyle = (clip?: any) => {
    const targetClip = clip || activeLayer?.clip;
    if (!targetClip) return undefined;
    const b = targetClip.color?.brightness ?? targetClip.brightness ?? 0;
    const c = targetClip.color?.contrast ?? targetClip.contrast ?? 1.0;
    const s = targetClip.color?.saturation ?? targetClip.saturation ?? 1.0;
    const temp = targetClip.color?.temperature ?? targetClip.temperature ?? 0;

    const brightnessVal = Math.max(0, 1 + b);
    const contrastVal = Math.max(0, c);
    const saturateVal = Math.max(0, s);

    let tempFilter = '';
    if (temp > 0) {
      const warmFactor = (temp / 100) * 0.35;
      tempFilter = ` sepia(${warmFactor}) hue-rotate(-${temp * 0.12}deg)`;
    } else if (temp < 0) {
      tempFilter = ` hue-rotate(${Math.abs(temp) * 0.22}deg)`;
    }

    let lutFilter = '';
    const lut = (targetClip.color?.lutPath || targetClip.lutPath || '').toLowerCase();
    if (lut.includes('teal_orange')) {
      lutFilter = ' hue-rotate(-12deg) saturate(1.25) contrast(1.15)';
    } else if (lut.includes('warm_film')) {
      lutFilter = ' sepia(0.22) saturate(1.1) brightness(1.04)';
    } else if (lut.includes('clean_cool')) {
      lutFilter = ' hue-rotate(15deg) saturate(0.92) contrast(1.05)';
    } else if (lut.includes('vintage')) {
      lutFilter = ' sepia(0.35) contrast(1.2) brightness(0.95)';
    } else if (lut.includes('vibrant')) {
      lutFilter = ' saturate(1.35) contrast(1.1)';
    } else if (lut.includes('monochrome') || lut.includes('bw')) {
      lutFilter = ' grayscale(1) contrast(1.15)';
    } else if (lut.length > 0) {
      lutFilter = ' contrast(1.08)';
    }

    return `brightness(${brightnessVal}) contrast(${contrastVal}) saturate(${saturateVal})${tempFilter}${lutFilter}`;
  };

  // Sync audio volume levels
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
    const volumeDb = activeLayer?.clip?.volumeDb ?? 0;
    const baseGain = isMuted || volumeDb <= -58 ? 0 : Math.min(1.0, Math.max(0.0, Math.pow(10, volumeDb / 20)));

    const activeVid = activePlayer === 'player1' ? videoRef.current : incomingVideoRef.current;
    const standbyVid = activePlayer === 'player1' ? incomingVideoRef.current : videoRef.current;

    if (activeVid) {
      activeVid.muted = isMuted;
      activeVid.volume = baseGain;
    }
    if (standbyVid) {
      standbyVid.muted = true;
      standbyVid.volume = 0;
    }
  }, [
    activePlayer,
    currentActiveClip,
    activeLayer?.clip?.volumeDb,
    activeLayer?.track?.muted,
    activeLayer?.track?.isMuted,
  ]);

  // Scrubbing / Seek synchronization (accurate frame seeking when paused)
  useEffect(() => {
    if (isPlaying) {
      const activeVid = activePlayer === 'player1' ? videoRef.current : incomingVideoRef.current;
      const activeClip = activePlayer === 'player1' ? player1Clip : player2Clip;
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
      videoRef.current.currentTime = getClipSeekTime(player1Clip, playhead);
    }
    if (incomingVideoRef.current && player2Clip && player2Clip.id === currentActiveClip.id) {
      incomingVideoRef.current.currentTime = getClipSeekTime(player2Clip, playhead);
    }
  }, [playhead, isPlaying, player1Clip, player2Clip, activePlayer, currentActiveClip]);

  // Continuous smooth requestAnimationFrame playback loop driven by hardware decoder clock
  useEffect(() => {
    let animId: number | null = null;

    if (!isPlaying) {
      if (videoRef.current && !videoRef.current.paused) videoRef.current.pause();
      if (incomingVideoRef.current && !incomingVideoRef.current.paused) incomingVideoRef.current.pause();
      return;
    }

    const curVid = activePlayerRef.current === 'player2' ? incomingVideoRef.current : videoRef.current;
    const curClip = activePlayerRef.current === 'player2' ? player2Clip : player1Clip;
    // Only play video element if playhead is currently over a valid active video clip!
    if (currentActiveClip && curClip?.id === currentActiveClip.id) {
      if (curVid && curVid.paused) {
        curVid.play().catch(() => {});
      }
    } else {
      if (videoRef.current && !videoRef.current.paused) videoRef.current.pause();
      if (incomingVideoRef.current && !incomingVideoRef.current.paused) incomingVideoRef.current.pause();
    }

    let lastTime = performance.now();

    const tick = (now: number) => {
      const state = useTimelineStore.getState();
      if (!state.isPlaying) return;

      const deltaSec = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      let nextPlayhead = state.playhead + deltaSec;

      // Master video clock is the active player (only if currently inside the active clip)
      const topClip = getTopClipAt(nextPlayhead);
      const masterVideo = activePlayerRef.current === 'player2' ? incomingVideoRef.current : videoRef.current;
      const masterClip = activePlayerRef.current === 'player2' ? player2Clip : player1Clip;

      if (topClip && masterVideo && !masterVideo.paused && !masterVideo.seeking && masterClip && masterClip.id === topClip.id) {
        const clipStart = masterClip.startPositionSeconds ?? (masterClip.startTimeMs ? masterClip.startTimeMs / 1000 : 0);
        const inPoint = masterClip.inPointSeconds ?? (masterClip.sourceOffsetMs ? masterClip.sourceOffsetMs / 1000 : 0);
        const calculatedPlayhead = clipStart + masterVideo.currentTime - inPoint;
        const drift = calculatedPlayhead - state.playhead;
        if (Math.abs(drift) > 0.25 && Math.abs(drift) < 2.0) {
          nextPlayhead = state.playhead + deltaSec + drift * 0.15;
        }
      }

      // Check if active clip switched at nextPlayhead across tracks or joints
      if (topClip) {
        if (player1Clip?.id === topClip.id) {
          if (activePlayerRef.current !== 'player1') {
            activePlayerRef.current = 'player1';
            setActivePlayer('player1');
          }
          if (videoRef.current && videoRef.current.paused) {
            videoRef.current.play().catch(() => {});
          }
        } else if (player2Clip?.id === topClip.id) {
          if (activePlayerRef.current !== 'player2') {
            activePlayerRef.current = 'player2';
            setActivePlayer('player2');
          }
          if (incomingVideoRef.current && incomingVideoRef.current.paused) {
            incomingVideoRef.current.play().catch(() => {});
          }
        }
      } else {
        // Empty space or cleared track: pause both players so video never plays on empty timeline
        if (videoRef.current && !videoRef.current.paused) videoRef.current.pause();
        if (incomingVideoRef.current && !incomingVideoRef.current.paused) incomingVideoRef.current.pause();
      }

      // Pre-roll standby player if approaching upcoming clip (within 0.8s)
      const standbyVideo = activePlayerRef.current === 'player2' ? videoRef.current : incomingVideoRef.current;
      const standbyClip = activePlayerRef.current === 'player2' ? player1Clip : player2Clip;
      if (standbyVideo && standbyClip && standbyVideo.readyState >= 1) {
        const startSec = standbyClip.startPositionSeconds ?? (standbyClip.startTimeMs ? standbyClip.startTimeMs / 1000 : 0);
        const inPoint = standbyClip.inPointSeconds ?? (standbyClip.sourceOffsetMs ? standbyClip.sourceOffsetMs / 1000 : 0);
        const curActiveClip = activePlayerRef.current === 'player2' ? player2Clip : player1Clip;
        const activeEndSec = curActiveClip
          ? (curActiveClip.startPositionSeconds ?? (curActiveClip.startTimeMs ? curActiveClip.startTimeMs / 1000 : 0)) +
            (curActiveClip.durationSeconds ?? (curActiveClip.durationMs ? curActiveClip.durationMs / 1000 : 10))
          : 0;

        if (nextPlayhead >= activeEndSec - 0.8 || nextPlayhead >= startSec - 0.8) {
          const targetTime = Math.max(0, nextPlayhead - startSec + inPoint);
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
  }, [isPlaying, isVideoLoaded, isIncomingVideoLoaded, player1Clip, player2Clip, currentActiveClip]);

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

  const getPlayerStyle = (player: 'player1' | 'player2'): React.CSSProperties => {
    if (activeTransitionInfo && activeTransitionInfo.isActive) {
      const fromClipId = activeTransitionInfo.fromClip?.id;
      const toClipId = activeTransitionInfo.toClip?.id;

      const thisClip = player === 'player1' ? player1Clip : player2Clip;
      if (thisClip?.id === toClipId) {
        return {
          ...getIncomingTransitionStyle(activeTransitionInfo),
          zIndex: 10,
        };
      }
      if (thisClip?.id === fromClipId) {
        return {
          ...getPrimaryTransitionStyle(activeTransitionInfo),
          zIndex: 5,
        };
      }
    }

    const thisClip = player === 'player1' ? player1Clip : player2Clip;
    // Only display this player if there is an active clip at playhead AND this player holds that exact clip!
    const isCurrent = Boolean(currentActiveClip && thisClip?.id === currentActiveClip.id);

    if (isCurrent) {
      return {
        opacity: 1,
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
                  videoRef.current.currentTime = getClipSeekTime(player1Clip, playhead);
                }
              }}
              onError={() => setIsVideoLoaded(false)}
              style={{
                filter: getInspectorFilterStyle(player1Clip),
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
                  incomingVideoRef.current.currentTime = getClipSeekTime(player2Clip, playhead);
                }
              }}
              onError={() => setIsIncomingVideoLoaded(false)}
              style={{
                filter: getInspectorFilterStyle(player2Clip),
                ...getPlayerStyle('player2'),
              }}
              className="absolute inset-0 w-full h-full object-contain"
              playsInline
              muted={activePlayer !== 'player2' || Boolean(activeLayer?.track.muted || activeLayer?.track.isMuted)}
            />
          )}

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
    </div>
  );
};
