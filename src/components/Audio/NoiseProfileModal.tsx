import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import {
  Play,
  Pause,
  X,
  RotateCcw,
  Sparkles,
  CheckCircle2,
  Clock,
  Volume2,
  Info,
  Sliders,
  Scissors,
  Check,
} from 'lucide-react';
import { Waves, Shield } from '@/components/Icons';
import { useTimelineStore } from '../../store/timelineStore';
import { formatTimecode } from '../../utils/timecode';
import { Clip } from '../../types/ipc';

function getMediaUrl(filePath: string): string {
  if (!filePath) return '';
  if (
    filePath.startsWith('blob:') ||
    filePath.startsWith('http:') ||
    filePath.startsWith('https:') ||
    filePath.startsWith('data:')
  ) {
    return filePath;
  }
  try {
    const internals = typeof window !== 'undefined' ? (window as any).__TAURI_INTERNALS__ : null;
    if (internals?.convertFileSrc) {
      return internals.convertFileSrc(filePath, 'asset');
    }
  } catch {}
  return filePath;
}

export const NoiseProfileModal: React.FC = () => {
  const {
    isNoiseModalOpen,
    noiseModalClipId,
    setIsNoiseModalOpen,
    tracks,
    playhead,
    fps,
    captureNoiseProfile,
    clearNoiseProfile,
    updateNoiseProfileSettings,
    previewSpectralDenoise,
    applyClipSpectralDenoise,
    runSilenceAutoCutWithAmbientFill,
    fetchWaveformData,
    waveformData,
  } = useTimelineStore(
    useShallow((state) => ({
      isNoiseModalOpen: state.isNoiseModalOpen,
      noiseModalClipId: state.noiseModalClipId,
      setIsNoiseModalOpen: state.setIsNoiseModalOpen,
      tracks: state.tracks,
      playhead: state.playhead,
      fps: state.project?.fps || 30,
      captureNoiseProfile: state.captureNoiseProfile,
      clearNoiseProfile: state.clearNoiseProfile,
      updateNoiseProfileSettings: state.updateNoiseProfileSettings,
      previewSpectralDenoise: state.previewSpectralDenoise,
      applyClipSpectralDenoise: state.applyClipSpectralDenoise,
      runSilenceAutoCutWithAmbientFill: state.runSilenceAutoCutWithAmbientFill,
      fetchWaveformData: state.fetchWaveformData,
      waveformData: state.waveformData,
    }))
  );

  // Locate targeted clip
  const targetClip: Clip | null = React.useMemo(() => {
    if (!noiseModalClipId) return null;
    for (const track of tracks) {
      const c = track.clips.find((clip) => clip.id === noiseModalClipId);
      if (c) return c;
    }
    return null;
  }, [tracks, noiseModalClipId]);

  const clipDuration = targetClip
    ? targetClip.durationSeconds || (targetClip.durationMs ? targetClip.durationMs / 1000 : 10)
    : 10;

  // Clip Noise Profile Settings (Live from Zustand store)
  const np = targetClip?.audioProcessing?.noiseProfile || {
    noiseReductionEnabled: false,
    reductionIntensityDb: 12.0,
    sensitivity: 6.0,
    frequencySmoothingBands: 6,
    auditionResidue: false,
    ambientRecoveryEnabled: false,
    ambientFillIntensity: 0.25,
    silenceCutThresholdDb: -35.0,
    silenceMinDurationSec: 0.6,
    cutMarginPaddingMs: 50,
  };

  const hasProfile = Boolean(np.noiseProfilePath || np.roomToneLoopPath);
  const profileDuration = np.profileDurationSec ? `${np.profileDurationSec.toFixed(1)}s Ambient` : 'Ambient Loaded';

  // Selected noise sample range: startSec & durationSec
  const [startSec, setStartSec] = useState<number>(0);
  const [durationSec, setDurationSec] = useState<number>(3.0);
  const [modalPlayhead, setModalPlayhead] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<'denoise' | 'autocut'>('denoise');
  const [isCapturing, setIsCapturing] = useState<boolean>(false);
  const [isRunningAutoCut, setIsRunningAutoCut] = useState<boolean>(false);
  const [playbackMode, setPlaybackMode] = useState<'none' | 'clean' | 'raw' | 'sample'>('none');
  const [isRenderingPreview, setIsRenderingPreview] = useState<boolean>(false);
  const [isLiveUpdating, setIsLiveUpdating] = useState<boolean>(false);
  const [isApplyingFull, setIsApplyingFull] = useState<boolean>(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [cleanPeaks, setCleanPeaks] = useState<number[] | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const waveformContainerRef = useRef<HTMLDivElement>(null);
  const mediaPlayerRef = useRef<HTMLVideoElement | null>(null);
  const auditionRafRef = useRef<number | null>(null);
  const fullCleanWavRef = useRef<string | null>(null);
  const liveDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const activeRequestIdRef = useRef<number>(0);
  const handleTogglePlayPauseRef = useRef<() => void>(() => {});

  // Initial range positioning: try centering around current playhead if within clip, else start at 0
  useEffect(() => {
    if (isNoiseModalOpen && targetClip) {
      const clipStart = targetClip.startPositionSeconds || 0;
      const relPlayhead = playhead - clipStart;
      const initialDur = Math.min(3.0, Math.max(1.0, clipDuration * 0.3));

      let initialStart = 0;
      if (relPlayhead >= 0 && relPlayhead <= clipDuration) {
        initialStart = Math.max(0, Math.min(clipDuration - initialDur, relPlayhead - initialDur / 2));
      }
      setStartSec(Number(initialStart.toFixed(2)));
      setDurationSec(Number(initialDur.toFixed(2)));
      setModalPlayhead(Math.max(0, Math.min(clipDuration, relPlayhead >= 0 ? relPlayhead : 0)));
      setErrorMsg(null);
      setFeedbackMsg(null);
      setPlaybackMode('none');
      fullCleanWavRef.current = null;
      setCleanPeaks(null);

      if (targetClip.filePath) {
        fetchWaveformData(targetClip.filePath);
      }
    }
  }, [isNoiseModalOpen, targetClip?.id]);

  // Pre-load / generate clean waveform data on modal open for overlay comparison
  useEffect(() => {
    if (!isNoiseModalOpen || !targetClip) return;

    let isMounted = true;
    const loadCleanPeaks = async () => {
      // 1. If clip already has a denoisedAudioPath from previous apply, fetch it immediately
      const savedDenoised = targetClip.audioProcessing?.noiseProfile?.denoisedAudioPath;
      if (savedDenoised) {
        try {
          const peaks = await fetchWaveformData(savedDenoised);
          if (peaks && peaks.length > 0 && isMounted) {
            setCleanPeaks(peaks);
            return;
          }
        } catch {}
      }

      // 2. Otherwise, generate preview waveform in background
      try {
        const redDb = np.reductionIntensityDb ?? 12.0;
        const sens = np.sensitivity ?? 6.0;
        const gs = np.frequencySmoothingBands ?? 6;
        const residue = np.auditionResidue ?? false;
        const wav = await previewSpectralDenoise(
          targetClip.id,
          0.0,
          clipDuration,
          redDb,
          sens,
          gs,
          residue
        );
        if (wav && isMounted) {
          fullCleanWavRef.current = wav;
          const peaks = await fetchWaveformData(wav);
          if (peaks && peaks.length > 0 && isMounted) {
            setCleanPeaks(peaks);
          }
        }
      } catch (e) {
        console.warn('Initial clean waveform preview generation failed:', e);
      }
    };

    loadCleanPeaks();

    return () => {
      isMounted = false;
    };
  }, [isNoiseModalOpen, targetClip?.id]);

  // Stop audition playback on unmount or modal close
  const stopAudition = useCallback(() => {
    if (liveDebounceRef.current) {
      clearTimeout(liveDebounceRef.current);
      liveDebounceRef.current = null;
    }
    if (auditionRafRef.current) {
      cancelAnimationFrame(auditionRafRef.current);
      auditionRafRef.current = null;
    }
    const media = mediaPlayerRef.current;
    if (media) {
      try {
        media.pause();
      } catch {}
    }
    setPlaybackMode('none');
    setIsLiveUpdating(false);
  }, []);

  useEffect(() => {
    return () => {
      stopAudition();
    };
  }, [stopAudition]);

  // Spacebar and Escape keyboard listener: intercepts Space to play/pause selected part in modal
  useEffect(() => {
    if (!isNoiseModalOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;

      const target = e.target as HTMLElement | null;
      if (
        target &&
        (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable)
      ) {
        return;
      }

      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        e.stopPropagation();
        if (target && target.tagName === 'BUTTON') {
          target.blur();
        }
        handleTogglePlayPauseRef.current();
        return;
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        stopAudition();
        setIsNoiseModalOpen(false, null);
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [isNoiseModalOpen, stopAudition, setIsNoiseModalOpen]);

  // Waveform Peaks & Dual-Layer Denoised Overlay Drawing
  const peaks = targetClip?.filePath ? waveformData[targetClip.filePath] || [] : [];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    const midY = height / 2;

    // Draw center baseline
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, midY);
    ctx.lineTo(width, midY);
    ctx.stroke();

    let waveData = peaks;
    if (!waveData || waveData.length === 0) {
      // Procedural fallback waveform if loading
      const fakePoints = 200;
      waveData = [];
      for (let i = 0; i < fakePoints; i++) {
        const val = 0.12 + Math.sin(i * 0.08) * 0.22 + Math.random() * 0.12;
        waveData.push(Math.min(1.0, val));
      }
    }

    const barWidth = Math.max(2, width / waveData.length);
    const halfH = midY - 6;

    const nrEnabled = np.noiseReductionEnabled;
    const nrDb = np.reductionIntensityDb ?? 12.0;
    const redFactor = Math.pow(10, -nrDb / 20); // 12dB = ~0.25, 24dB = ~0.063, 36dB = ~0.015
    const isResidue = np.auditionResidue;

    // LAYER 1 (Base Layer): Original / Raw Audio Waveform
    // Rendered in translucent cyan so the user sees the original dynamic range and noise floor
    if (nrEnabled) {
      ctx.fillStyle = 'rgba(0, 240, 255, 0.32)';
    } else {
      const rawGradient = ctx.createLinearGradient(0, 0, 0, height);
      rawGradient.addColorStop(0, '#00F0FF');
      rawGradient.addColorStop(0.5, '#2563EB');
      rawGradient.addColorStop(1, '#00F0FF');
      ctx.fillStyle = rawGradient;
    }

    for (let i = 0; i < waveData.length; i++) {
      const x = (i / waveData.length) * width;
      const rawVal = Math.max(0.015, Math.min(1.0, waveData[i]));
      const rawBarH = rawVal * halfH;
      ctx.fillRect(x, midY - rawBarH, Math.max(1, barWidth - 1), rawBarH * 2);
    }

    // LAYER 2 (Overlay Layer): Clean Processed Audio Waveform
    // Overlaid in the exact same location in bright glowing emerald (or residue amber)
    // allowing direct visual comparison of how much noise was reduced
    if (nrEnabled) {
      const cleanGradient = ctx.createLinearGradient(0, 0, 0, height);
      if (isResidue) {
        cleanGradient.addColorStop(0, '#F59E0B');
        cleanGradient.addColorStop(0.5, '#EF4444');
        cleanGradient.addColorStop(1, '#F59E0B');
      } else {
        cleanGradient.addColorStop(0, '#10B981');
        cleanGradient.addColorStop(0.5, '#00F0FF');
        cleanGradient.addColorStop(1, '#10B981');
      }
      ctx.fillStyle = cleanGradient;

      for (let i = 0; i < waveData.length; i++) {
        const x = (i / waveData.length) * width;
        const rawVal = Math.max(0.015, Math.min(1.0, waveData[i]));

        let cleanVal: number;
        if (cleanPeaks && cleanPeaks.length > 0) {
          const cleanIdx = Math.min(
            cleanPeaks.length - 1,
            Math.floor((i / waveData.length) * cleanPeaks.length)
          );
          cleanVal = Math.max(0.015, Math.min(1.0, cleanPeaks[cleanIdx]));
        } else {
          // Dynamic live fallback while debounce/FFmpeg is generating
          if (isResidue) {
            cleanVal = rawVal < 0.24 ? rawVal * 1.2 : rawVal * 0.08;
          } else {
            const noiseGateThreshold = 0.22;
            if (rawVal < noiseGateThreshold) {
              const ratio = Math.max(0, rawVal / noiseGateThreshold);
              cleanVal = rawVal * (redFactor + (1 - redFactor) * Math.pow(ratio, 2.5));
            } else {
              cleanVal = rawVal;
            }
          }
        }

        cleanVal = Math.max(0.015, Math.min(1.0, cleanVal));
        const cleanBarH = cleanVal * halfH;
        ctx.fillRect(x, midY - cleanBarH, Math.max(1, barWidth - 1), cleanBarH * 2);
      }
    }
  }, [peaks, cleanPeaks, np.noiseReductionEnabled, np.reductionIntensityDb, np.auditionResidue]);

  // Handle Dragging Selection Range
  const [draggingMode, setDraggingMode] = useState<'move' | 'left' | 'right' | null>(null);
  const dragStartRef = useRef<{ clientX: number; origStart: number; origDur: number } | null>(null);

  const handleMouseDown = (e: React.MouseEvent, mode: 'move' | 'left' | 'right') => {
    e.preventDefault();
    e.stopPropagation();
    stopAudition();
    setDraggingMode(mode);
    dragStartRef.current = {
      clientX: e.clientX,
      origStart: startSec,
      origDur: durationSec,
    };
  };

  useEffect(() => {
    if (!draggingMode) return;

    const handleMouseMove = (e: MouseEvent) => {
      const container = waveformContainerRef.current;
      const startInfo = dragStartRef.current;
      if (!container || !startInfo) return;

      const rect = container.getBoundingClientRect();
      const deltaX = e.clientX - startInfo.clientX;
      const deltaSec = (deltaX / rect.width) * clipDuration;

      if (draggingMode === 'move') {
        const newStart = Math.max(0, Math.min(clipDuration - startInfo.origDur, startInfo.origStart + deltaSec));
        setStartSec(Number(newStart.toFixed(2)));
      } else if (draggingMode === 'left') {
        const currentEnd = startInfo.origStart + startInfo.origDur;
        const newStart = Math.max(0, Math.min(currentEnd - 0.5, startInfo.origStart + deltaSec));
        const newDur = currentEnd - newStart;
        setStartSec(Number(newStart.toFixed(2)));
        setDurationSec(Number(newDur.toFixed(2)));
      } else if (draggingMode === 'right') {
        const maxDur = clipDuration - startInfo.origStart;
        const newDur = Math.max(0.5, Math.min(maxDur, startInfo.origDur + deltaSec));
        setDurationSec(Number(newDur.toFixed(2)));
      }
    };

    const handleMouseUp = () => {
      setDraggingMode(null);
      dragStartRef.current = null;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggingMode, clipDuration, startSec, durationSec, stopAudition]);

  // Click on background waveform to scrub playhead anywhere in whole clip
  const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const container = waveformContainerRef.current;
    if (!container || draggingMode) return;
    const rect = container.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickRatio = Math.max(0, Math.min(1, clickX / rect.width));
    const clickTime = Number((clickRatio * clipDuration).toFixed(2));

    setModalPlayhead(clickTime);

    const media = mediaPlayerRef.current;
    if (media && playbackMode !== 'none' && targetClip) {
      const clipInPoint = targetClip.inPointSeconds || 0;
      if (playbackMode === 'sample') {
        const endSec = Number((startSec + durationSec).toFixed(2));
        const clampedTime = Math.max(startSec, Math.min(Math.max(startSec, endSec - 0.05), clickTime));
        setModalPlayhead(clampedTime);
        media.currentTime = clipInPoint + clampedTime;
      } else if (playbackMode === 'clean') {
        // Preview clean audio has no boundaries - scrub freely anywhere!
        media.currentTime = clickTime;
      } else if (playbackMode === 'raw') {
        // Audition raw audio has no boundaries - scrub freely anywhere!
        media.currentTime = clipInPoint + clickTime;
      }
    }
  };

  // 1. Master bypass toggle switch for noise reduction (Step 2 Switch)
  const handleToggleNoiseReduction = async (enabled: boolean) => {
    if (!targetClip) return;

    updateNoiseProfileSettings(targetClip.id, {
      noiseReductionEnabled: enabled,
    });

    const media = mediaPlayerRef.current;
    if (!media) return;

    // If audio is actively playing in clean or raw (full clip), hot-swap between clean and raw without boundaries!
    if (playbackMode === 'clean' || playbackMode === 'raw') {
      const currentPos = modalPlayhead;

      if (!enabled) {
        // Switch immediately to RAW audio without boundaries
        if (auditionRafRef.current) {
          cancelAnimationFrame(auditionRafRef.current);
          auditionRafRef.current = null;
        }
        const clipInPoint = targetClip.inPointSeconds || 0;
        const rawSrc = getMediaUrl(targetClip.filePath);
        if (media.src !== rawSrc) {
          media.src = rawSrc;
        }
        media.currentTime = clipInPoint + currentPos;
        media.volume = 1.0;
        media.muted = false;
        try {
          await media.play();
          setPlaybackMode('raw');

          const checkRawLoop = () => {
            if (!media || media.paused) {
              stopAudition();
              return;
            }
            const curr = media.currentTime;
            const rel = Math.max(0, curr - clipInPoint);
            setModalPlayhead(rel);
            // Full clip without boundaries: loop at clip end
            if (rel >= clipDuration || media.ended) {
              setModalPlayhead(0);
              media.currentTime = clipInPoint;
              stopAudition();
              return;
            }
            auditionRafRef.current = requestAnimationFrame(checkRawLoop);
          };
          auditionRafRef.current = requestAnimationFrame(checkRawLoop);
        } catch (e) {
          console.error('Failed to play raw audio:', e);
        }
      } else {
        // Switch immediately to CLEAN audio without boundaries
        if (auditionRafRef.current) {
          cancelAnimationFrame(auditionRafRef.current);
          auditionRafRef.current = null;
        }

        let cleanWav = fullCleanWavRef.current;
        if (!cleanWav) {
          setIsRenderingPreview(true);
          try {
            const redDb = np.reductionIntensityDb ?? 12.0;
            const sens = np.sensitivity ?? 6.0;
            const gs = np.frequencySmoothingBands ?? 6;
            const residue = np.auditionResidue ?? false;
            cleanWav = await previewSpectralDenoise(
              targetClip.id,
              0.0,
              clipDuration,
              redDb,
              sens,
              gs,
              residue
            );
            if (cleanWav) {
              fullCleanWavRef.current = cleanWav;
              fetchWaveformData(cleanWav).then((peaks) => {
                if (peaks && peaks.length > 0) setCleanPeaks(peaks);
              });
            }
          } catch (e) {
            console.error('Failed to render preview on toggle:', e);
          } finally {
            setIsRenderingPreview(false);
          }
        }

        if (cleanWav && media) {
          const cleanUrl = getMediaUrl(cleanWav);
          if (media.src !== cleanUrl) {
            media.src = cleanUrl;
          }
          media.currentTime = currentPos;
          media.volume = 1.0;
          media.muted = false;
          try {
            await media.play();
            setPlaybackMode('clean');

            const checkCleanLoop = () => {
              if (!media || media.paused) {
                stopAudition();
                return;
              }
              const curr = media.currentTime;
              setModalPlayhead(curr);
              // Full clip without boundaries: loop at clip end
              if (curr >= clipDuration || media.ended) {
                setModalPlayhead(0);
                media.currentTime = 0;
                stopAudition();
                return;
              }
              auditionRafRef.current = requestAnimationFrame(checkCleanLoop);
            };
            auditionRafRef.current = requestAnimationFrame(checkCleanLoop);
          } catch (e) {
            console.error('Failed to play clean audio:', e);
          }
        }
      }
    }
  };

  // 2. Real-time Slider Handler: updates state immediately & hot-swaps live preview without pausing
  const handleUpdateSettings = (settings: any) => {
    if (!targetClip) return;

    // Invalidate cached clean WAV since parameters changed
    fullCleanWavRef.current = null;

    // Merge settings and ensure noiseReductionEnabled is on
    const updatedSettings = {
      ...settings,
      noiseReductionEnabled: true,
    };
    updateNoiseProfileSettings(targetClip.id, updatedSettings);

    // If actively playing in clean mode, schedule real-time background re-render and live hot-swap
    if (playbackMode === 'clean') {
      if (liveDebounceRef.current) {
        clearTimeout(liveDebounceRef.current);
      }
      setIsLiveUpdating(true);

      liveDebounceRef.current = setTimeout(async () => {
        const reqId = ++activeRequestIdRef.current;
        try {
          const currentNp = { ...np, ...updatedSettings };
          const redDb = currentNp.reductionIntensityDb ?? 12.0;
          const sens = currentNp.sensitivity ?? 6.0;
          const gs = currentNp.frequencySmoothingBands ?? 6;
          const residue = currentNp.auditionResidue ?? false;

          const updatedWav = await previewSpectralDenoise(
            targetClip.id,
            0.0,
            clipDuration,
            redDb,
            sens,
            gs,
            residue
          );

          if (reqId !== activeRequestIdRef.current) return;

          if (updatedWav) {
            fullCleanWavRef.current = updatedWav;
            const peaks = await fetchWaveformData(updatedWav);
            if (peaks && peaks.length > 0 && reqId === activeRequestIdRef.current) {
              setCleanPeaks(peaks);
            }
            const media = mediaPlayerRef.current;
            if (media && playbackMode === 'clean' && !media.paused) {
              const currentPos = media.currentTime;
              const newSrc = getMediaUrl(updatedWav);
              if (media.src !== newSrc) {
                media.src = newSrc;
                media.currentTime = currentPos;
                media.play().catch(() => {});
              }
            }
          }
        } catch (err) {
          console.error('Realtime preview update failed:', err);
        } finally {
          if (reqId === activeRequestIdRef.current) {
            setIsLiveUpdating(false);
          }
        }
      }, 250);
    }
  };

  // 3. Play Selected Raw Audio Sample Range (Top Bar "Play Clip" & Spacebar)
  // Always plays the selected raw camera noise sample [startSec, endSec] on loop!
  const handlePlaySelectedSample = useCallback(async () => {
    if (playbackMode === 'sample') {
      stopAudition();
      return;
    }
    stopAudition();
    if (!targetClip?.filePath) return;
    const media = mediaPlayerRef.current;
    if (!media) return;

    const clipInPoint = targetClip.inPointSeconds || 0;
    const endSec = Number((startSec + durationSec).toFixed(2));

    try {
      const mediaSrc = getMediaUrl(targetClip.filePath);
      if (media.src !== mediaSrc) {
        media.src = mediaSrc;
      }

      let initialTime = startSec;
      if (modalPlayhead >= startSec && modalPlayhead < endSec) {
        initialTime = modalPlayhead;
      }
      media.currentTime = clipInPoint + initialTime;
      setModalPlayhead(initialTime);
      media.volume = 1.0;
      media.muted = false;

      await media.play();
      setPlaybackMode('sample');
      setErrorMsg(null);

      const checkLoop = () => {
        if (!media || media.paused) {
          stopAudition();
          return;
        }

        const curr = media.currentTime;
        const rel = Math.max(0, curr - clipInPoint);
        setModalPlayhead(rel);

        // Always loop strictly within the selected raw sample range:
        if (rel >= endSec || rel >= clipDuration || media.ended) {
          media.currentTime = clipInPoint + startSec;
          setModalPlayhead(startSec);
        }

        auditionRafRef.current = requestAnimationFrame(checkLoop);
      };

      auditionRafRef.current = requestAnimationFrame(checkLoop);
    } catch (err: any) {
      console.error('Failed to play selected sample:', err);
      setErrorMsg('Could not play selected sample: ' + (err?.message || err));
      stopAudition();
    }
  }, [playbackMode, targetClip, startSec, durationSec, clipDuration, modalPlayhead, stopAudition]);

  // 4. Preview Clean Denoised Audio across the ENTIRE clip WITHOUT BOUNDARIES
  const handlePreviewCleanAudio = async () => {
    if (playbackMode === 'clean') {
      stopAudition();
      return;
    }
    stopAudition();
    if (!targetClip) return;

    // Automatically enable noise reduction
    updateNoiseProfileSettings(targetClip.id, {
      noiseReductionEnabled: true,
    });

    setIsRenderingPreview(true);
    setErrorMsg(null);
    setFeedbackMsg(null);

    try {
      const redDb = np.reductionIntensityDb ?? 12.0;
      const sens = np.sensitivity ?? 6.0;
      const gs = np.frequencySmoothingBands ?? 6;
      const residue = np.auditionResidue ?? false;

      // Render clean audio for the whole clip so user can listen and scrub anywhere freely!
      let cleanWav = fullCleanWavRef.current;
      if (!cleanWav) {
        cleanWav = await previewSpectralDenoise(
          targetClip.id,
          0.0,
          clipDuration,
          redDb,
          sens,
          gs,
          residue
        );
        fullCleanWavRef.current = cleanWav;
      }

      if (cleanWav) {
        fetchWaveformData(cleanWav).then((peaks) => {
          if (peaks && peaks.length > 0) setCleanPeaks(peaks);
        });
      }

      if (!cleanWav) {
        setErrorMsg('Failed to generate clean preview audio. Verify FFmpeg sidecar.');
        setIsRenderingPreview(false);
        return;
      }

      const media = mediaPlayerRef.current;
      if (!media) {
        setIsRenderingPreview(false);
        return;
      }

      const cleanUrl = getMediaUrl(cleanWav);
      if (media.src !== cleanUrl) {
        media.src = cleanUrl;
      }

      // No boundaries! Play from current modalPlayhead across the whole clip
      let startPos = modalPlayhead;
      if (startPos >= clipDuration) {
        startPos = 0;
      }
      media.currentTime = startPos;
      setModalPlayhead(startPos);
      media.volume = 1.0;
      media.muted = false;

      await media.play();
      setPlaybackMode('clean');
      setIsRenderingPreview(false);

      const checkLoop = () => {
        if (!media || media.paused) {
          stopAudition();
          return;
        }

        const curr = media.currentTime;
        setModalPlayhead(curr);

        // Whole clip with NO boundaries: stop at end of clip
        if (curr >= clipDuration || media.ended) {
          media.currentTime = 0;
          setModalPlayhead(0);
          stopAudition();
          return;
        }

        auditionRafRef.current = requestAnimationFrame(checkLoop);
      };

      auditionRafRef.current = requestAnimationFrame(checkLoop);
    } catch (err: any) {
      console.error('Failed to preview clean audio:', err);
      setErrorMsg('Could not preview clean audio: ' + (err?.message || err));
      stopAudition();
      setIsRenderingPreview(false);
    }
  };

  // 5. Audition Raw Unprocessed Audio across the ENTIRE clip WITHOUT BOUNDARIES
  const handleAuditionRawAudio = async () => {
    if (playbackMode === 'raw') {
      stopAudition();
      return;
    }
    stopAudition();
    if (!targetClip?.filePath) return;
    const media = mediaPlayerRef.current;
    if (!media) return;

    const clipInPoint = targetClip.inPointSeconds || 0;

    try {
      const mediaSrc = getMediaUrl(targetClip.filePath);
      if (media.src !== mediaSrc) {
        media.src = mediaSrc;
      }

      // No boundaries! Play from current modalPlayhead across the whole clip
      let startPos = modalPlayhead;
      if (startPos >= clipDuration) {
        startPos = 0;
      }
      media.currentTime = clipInPoint + startPos;
      setModalPlayhead(startPos);
      media.volume = 1.0;
      media.muted = false;

      await media.play();
      setPlaybackMode('raw');
      setErrorMsg(null);

      const checkLoop = () => {
        if (!media || media.paused) {
          stopAudition();
          return;
        }

        const curr = media.currentTime;
        const rel = Math.max(0, curr - clipInPoint);
        setModalPlayhead(rel);

        // Whole clip with NO boundaries: stop at end of clip
        if (rel >= clipDuration || media.ended) {
          media.currentTime = clipInPoint;
          setModalPlayhead(0);
          stopAudition();
          return;
        }

        auditionRafRef.current = requestAnimationFrame(checkLoop);
      };

      auditionRafRef.current = requestAnimationFrame(checkLoop);
    } catch (err: any) {
      console.error('Failed to audition raw audio:', err);
      setErrorMsg('Could not audition raw audio: ' + (err?.message || err));
      stopAudition();
    }
  };

  // 6. Play / Pause toggle for the selected raw sample (bound to Play Clip button and Space bar)
  const handleTogglePlayPause = useCallback(() => {
    if (playbackMode === 'sample') {
      stopAudition();
    } else {
      handlePlaySelectedSample();
    }
  }, [playbackMode, handlePlaySelectedSample, stopAudition]);

  // Keep ref synchronized for keydown event listener
  useEffect(() => {
    handleTogglePlayPauseRef.current = handleTogglePlayPause;
  }, [handleTogglePlayPause]);

  // 4. Execute Spectral Noise Profiling Capture
  const handleCapture = async () => {
    if (!targetClip) return;
    setIsCapturing(true);
    setErrorMsg(null);
    setFeedbackMsg(null);
    fullCleanWavRef.current = null;
    setCleanPeaks(null);

    try {
      const ok = await captureNoiseProfile(targetClip.id, startSec, durationSec);
      if (ok) {
        setFeedbackMsg(`✓ Noise profile trained from ${durationSec.toFixed(1)}s sample at ${startSec.toFixed(2)}s!`);
        // Regenerate clean preview and waveform with newly captured spectral profile
        const redDb = np.reductionIntensityDb ?? 12.0;
        const sens = np.sensitivity ?? 6.0;
        const gs = np.frequencySmoothingBands ?? 6;
        const residue = np.auditionResidue ?? false;
        const newWav = await previewSpectralDenoise(
          targetClip.id,
          0.0,
          clipDuration,
          redDb,
          sens,
          gs,
          residue
        );
        if (newWav) {
          fullCleanWavRef.current = newWav;
          const peaks = await fetchWaveformData(newWav);
          if (peaks && peaks.length > 0) {
            setCleanPeaks(peaks);
          }
          if (playbackMode === 'clean') {
            const media = mediaPlayerRef.current;
            if (media && !media.paused) {
              const currentPos = media.currentTime;
              const newSrc = getMediaUrl(newWav);
              if (media.src !== newSrc) {
                media.src = newSrc;
              }
              media.currentTime = currentPos;
              media.play().catch(() => {});
            }
          }
        }
      } else {
        setErrorMsg('Failed to capture spectral profile. Verify media format.');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || String(err));
    } finally {
      setIsCapturing(false);
    }
  };

  const handleClear = () => {
    if (!targetClip) return;
    clearNoiseProfile(targetClip.id);
    fullCleanWavRef.current = null;
    setCleanPeaks(null);
    setFeedbackMsg('Noise profile cleared (reverted to generic filter)');
    const redDb = np.reductionIntensityDb ?? 12.0;
    const sens = np.sensitivity ?? 6.0;
    const gs = np.frequencySmoothingBands ?? 6;
    const residue = np.auditionResidue ?? false;
    previewSpectralDenoise(
      targetClip.id,
      0.0,
      clipDuration,
      redDb,
      sens,
      gs,
      residue
    ).then(async (newWav) => {
      if (newWav) {
        fullCleanWavRef.current = newWav;
        const peaks = await fetchWaveformData(newWav);
        if (peaks && peaks.length > 0) {
          setCleanPeaks(peaks);
        }
        const media = mediaPlayerRef.current;
        if (media && playbackMode === 'clean' && !media.paused) {
          const currentPos = media.currentTime;
          const newSrc = getMediaUrl(newWav);
          if (media.src !== newSrc) {
            media.src = newSrc;
          }
          media.currentTime = currentPos;
          media.play().catch(() => {});
        }
      }
    });
  };

  const handleRunAutoCut = async () => {
    if (!targetClip) return;
    setIsRunningAutoCut(true);
    setErrorMsg(null);
    setFeedbackMsg(null);
    stopAudition();

    try {
      const msg = await runSilenceAutoCutWithAmbientFill(targetClip.id);
      if (msg) {
        setFeedbackMsg(msg);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || String(err));
    } finally {
      setIsRunningAutoCut(false);
    }
  };

  const handleApplyToEntireClip = async () => {
    if (!targetClip) return;
    setIsApplyingFull(true);
    setErrorMsg(null);
    setFeedbackMsg(null);
    stopAudition();

    try {
      updateNoiseProfileSettings(targetClip.id, {
        noiseReductionEnabled: true,
      });
      await applyClipSpectralDenoise(targetClip.id);
      setIsNoiseModalOpen(false, null);
    } catch (err: any) {
      setErrorMsg(err?.message || String(err));
    } finally {
      setIsApplyingFull(false);
    }
  };

  if (!isNoiseModalOpen || !targetClip) return null;

  const leftPercent = (startSec / clipDuration) * 100;
  const widthPercent = (durationSec / clipDuration) * 100;
  const endSec = Number((startSec + durationSec).toFixed(2));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150 select-none">
      <video ref={mediaPlayerRef} playsInline preload="auto" className="hidden" />

      <div className="w-full max-w-5xl bg-[#12141A] border border-[#2B3040] rounded-xl shadow-2xl overflow-hidden flex flex-col text-[#F0F3F8] max-h-[92vh]">
        {/* Header (Fixed) */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#222630] bg-[#0E1015] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-[#00F0FF]/15 text-[#00F0FF] border border-[#00F0FF]/30">
              <Waves size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold tracking-wide text-[#F0F3F8]">
                  Spectral Noise Cancellation & Room Tone Suite
                </h2>
                <span
                  className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded ${
                    hasProfile ? 'bg-[#00F0FF]/15 text-[#00F0FF]' : 'bg-[#181B22] text-[#64748B]'
                  }`}
                >
                  {hasProfile ? `[ Profile: ${profileDuration} ]` : '[ No Profile ]'}
                </span>
              </div>
              <p className="text-[11px] text-[#8A92A6] truncate max-w-lg">
                Target Clip: <span className="text-[#00F0FF] font-medium">{targetClip.name}</span> ({clipDuration.toFixed(1)}s total)
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              stopAudition();
              setIsNoiseModalOpen(false, null);
            }}
            className="p-1 rounded-lg text-[#64748B] hover:text-[#F0F3F8] hover:bg-[#1A1D24] transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* ========================================================================= */}
        {/* PINNED TOP WAVEFORM SECTION (Fixed in place - NEVER scrolls away)         */}
        {/* ========================================================================= */}
        <div className="px-5 pt-3 pb-2.5 bg-[#090B0F] border-b border-[#222630] space-y-2 shrink-0">
          {/* Feedback & Error Alerts */}
          {feedbackMsg && (
            <div className="px-3 py-1.5 rounded-lg bg-[#10B981]/15 border border-[#10B981]/35 text-xs text-[#10B981] flex items-center justify-between animate-in fade-in">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={13} className="shrink-0" />
                <span>{feedbackMsg}</span>
              </div>
              <button onClick={() => setFeedbackMsg(null)} className="text-[#10B981]/70 hover:text-[#10B981] cursor-pointer">
                <X size={12} />
              </button>
            </div>
          )}

          {errorMsg && (
            <div className="px-3 py-1.5 rounded-lg bg-red-500/15 border border-red-500/35 text-xs text-red-400 flex items-center justify-between animate-in fade-in">
              <span>{errorMsg}</span>
              <button onClick={() => setErrorMsg(null)} className="text-red-400/70 hover:text-red-400 cursor-pointer">
                <X size={12} />
              </button>
            </div>
          )}

          {/* Audio Waveform Transport & Scrubber Header */}
          <div className="flex items-center justify-between text-[11px] pb-1 border-b border-[#1A1D24]">
            <div className="flex items-center gap-2.5">
              {/* Play/Pause Button */}
              <button
                onClick={handleTogglePlayPause}
                disabled={isRenderingPreview}
                className={`px-2.5 py-1 rounded-md border text-xs flex items-center gap-1.5 font-bold transition-all cursor-pointer ${
                  playbackMode === 'sample'
                    ? 'bg-[#00F0FF]/20 border-[#00F0FF] text-[#00F0FF] shadow-[0_0_10px_rgba(0,240,255,0.25)]'
                    : 'bg-[#181B22] border-[#2B3040] text-[#CBD5E1] hover:text-white hover:bg-[#222630]'
                }`}
                title={
                  playbackMode === 'sample'
                    ? 'Pause (Space)'
                    : `Play selected raw noise sample (${durationSec.toFixed(1)}s) [Space]`
                }
              >
                {playbackMode === 'sample' ? <Pause size={12} /> : <Play size={12} />}
                <span>{playbackMode === 'sample' ? 'Pause' : 'Play Clip'}</span>
              </button>

              {/* Timecode Readout */}
              <span className="font-mono text-xs font-bold text-[#F0F3F8]">
                {formatTimecode(modalPlayhead, fps)}
                <span className="text-[#64748B] font-normal mx-1.5">/</span>
                <span className="text-[#8A92A6]">{formatTimecode(clipDuration, fps)}</span>
              </span>

              {/* Dual-Waveform Comparison Legend Pill */}
              {np.noiseReductionEnabled && (
                <div className="flex items-center gap-2 text-[10px] font-mono px-2 py-0.5 rounded bg-[#12141A] border border-[#222630]">
                  <span className="flex items-center gap-1 text-[#00F0FF]/80">
                    <span className="w-2 h-2 rounded-xs bg-[#00F0FF]/40 border border-[#00F0FF]/70 inline-block" />
                    <span>Original</span>
                  </span>
                  <span className="text-[#475569]">/</span>
                  <span className="flex items-center gap-1 text-[#10B981] font-semibold">
                    <span className="w-2 h-2 rounded-xs bg-[#10B981] inline-block shadow-[0_0_6px_#10B981]" />
                    <span>Cleaned Overlay</span>
                  </span>
                </div>
              )}

              {/* Mode Pill */}
              {playbackMode === 'sample' ? (
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#00F0FF]/20 border border-[#00F0FF]/40 text-[#00F0FF] flex items-center gap-1.5">
                  ● Selected Raw Noise Sample ({startSec.toFixed(2)}s → {endSec.toFixed(2)}s)
                </span>
              ) : playbackMode === 'clean' ? (
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#10B981]/20 border border-[#10B981]/40 text-[#10B981] flex items-center gap-1.5">
                  ● Clean Denoised Audio ({np.reductionIntensityDb?.toFixed(1) ?? '12.0'} dB) - Full Clip
                </span>
              ) : playbackMode === 'raw' ? (
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center gap-1.5">
                  ● Raw Camera Audio (Bypassed) - Full Clip
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#161922] border border-[#222630] text-[#8A92A6]">
                  {np.noiseReductionEnabled ? 'Noise Reduction: Active (Ready)' : 'Noise Reduction: Bypassed (Ready)'}
                </span>
              )}

              {isLiveUpdating && (
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#00F0FF]/15 border border-[#00F0FF]/30 text-[#00F0FF] animate-pulse flex items-center gap-1">
                  <RotateCcw size={10} className="animate-spin" /> Live Tuning...
                </span>
              )}
            </div>

            {/* Noise Sample Badge */}
            <div className="font-mono text-[10px] flex items-center gap-1.5 text-[#8A92A6]">
              <span>Noise Sample:</span>
              <span className="text-[#00F0FF] font-bold">{startSec.toFixed(2)}s → {endSec.toFixed(2)}s ({durationSec.toFixed(1)}s)</span>
            </div>
          </div>

          <div
            ref={waveformContainerRef}
            onClick={handleContainerClick}
            className="relative w-full h-24 bg-[#07080B] border border-[#1C202B] rounded-lg overflow-hidden cursor-crosshair group shadow-inner"
          >
            {/* Canvas Waveform */}
            <canvas
              ref={canvasRef}
              width={960}
              height={96}
              className="absolute inset-0 w-full h-full pointer-events-none opacity-90 transition-opacity"
            />

            {/* Dimmed Left Mask */}
            <div
              style={{ width: `${Math.max(0, leftPercent)}%` }}
              className="absolute top-0 bottom-0 left-0 bg-black/70 backdrop-blur-[1px] pointer-events-none transition-[width] duration-75"
            />

            {/* Dimmed Right Mask */}
            <div
              style={{
                left: `${Math.min(100, leftPercent + widthPercent)}%`,
                right: 0,
              }}
              className="absolute top-0 bottom-0 bg-black/70 backdrop-blur-[1px] pointer-events-none transition-[left] duration-75"
            />

            {/* Active Noise Sampling Selection Box (Step 1) */}
            <div
              style={{
                left: `${leftPercent}%`,
                width: `${widthPercent}%`,
              }}
              onMouseDown={(e) => handleMouseDown(e, 'move')}
              className="absolute top-0 bottom-0 border-2 border-dashed border-[#00F0FF] bg-[#00F0FF]/10 shadow-[0_0_15px_rgba(0,240,255,0.25)] cursor-grab active:cursor-grabbing group-hover:border-[#38f2ff] transition-[left,width] duration-75 flex items-center justify-between z-10"
            >
              {/* Left Trim Handle */}
              <div
                onMouseDown={(e) => handleMouseDown(e, 'left')}
                className="w-3.5 h-full -ml-1.5 bg-[#00F0FF] hover:bg-white cursor-ew-resize flex items-center justify-center opacity-90 transition-colors z-20 rounded-l-sm"
                title="Drag to adjust sample start"
              >
                <div className="w-0.5 h-4 bg-[#090B0E] rounded-full" />
              </div>

              {/* Center Label / Grip */}
              <div className="px-2 py-0.5 rounded bg-[#090B0E]/85 border border-[#00F0FF]/40 text-[9px] font-mono text-[#00F0FF] font-bold pointer-events-none shadow flex items-center gap-1">
                <Waves size={10} />
                <span>Noise Sample ({durationSec.toFixed(1)}s)</span>
              </div>

              {/* Right Trim Handle */}
              <div
                onMouseDown={(e) => handleMouseDown(e, 'right')}
                className="w-3.5 h-full -mr-1.5 bg-[#00F0FF] hover:bg-white cursor-ew-resize flex items-center justify-center opacity-90 transition-colors z-20 rounded-r-sm"
                title="Drag to adjust sample duration"
              >
                <div className="w-0.5 h-4 bg-[#090B0E] rounded-full" />
              </div>
            </div>

            {/* Entire-Clip Playhead Needle (Draggable & Clickable) */}
            <div
              style={{ left: `${(modalPlayhead / clipDuration) * 100}%` }}
              className={`absolute top-0 bottom-0 w-1 pointer-events-none z-30 transition-[left] duration-75 ${
                playbackMode === 'clean'
                  ? 'bg-[#10B981] shadow-[0_0_12px_#10B981]'
                  : playbackMode === 'sample'
                  ? 'bg-[#00F0FF] shadow-[0_0_12px_#00F0FF]'
                  : playbackMode === 'raw'
                  ? 'bg-amber-400 shadow-[0_0_12px_#f59e0b]'
                  : 'bg-[#00F0FF] shadow-[0_0_8px_#00f0ff]'
              }`}
            >
              {/* Needle Floating Time Tag */}
              <div
                className={`absolute -top-0.5 -translate-x-1/2 px-1 py-0.2 rounded text-[8px] font-mono font-bold shadow ${
                  playbackMode === 'clean'
                    ? 'bg-[#10B981] text-black'
                    : playbackMode === 'sample'
                    ? 'bg-[#00F0FF] text-black'
                    : playbackMode === 'raw'
                    ? 'bg-amber-400 text-black'
                    : 'bg-[#00F0FF] text-black'
                }`}
              >
                {modalPlayhead.toFixed(1)}s
              </div>
            </div>
          </div>

          {/* Timecode Scale Bar */}
          <div className="flex items-center justify-between text-[9px] font-mono text-[#525D73] px-1">
            <span>00:00.00</span>
            <span>{formatTimecode(clipDuration / 2, fps)}</span>
            <span>{formatTimecode(clipDuration, fps)}</span>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* SCROLLABLE CONTROLS BODY (Waveform stays locked above - No scrolling out)  */}
        {/* ========================================================================= */}
        <div className="p-4 space-y-3 overflow-y-auto flex-1">
          {/* TAB NAVIGATION: 1. NOISE PROFILE & DENOISE / 2. AUTO-CUT SILENCE & FILL */}
          <div className="flex items-center gap-1 border-b border-[#222630] pb-1">
            <button
              onClick={() => setActiveTab('denoise')}
              className={`px-3 py-1.5 rounded-t text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                activeTab === 'denoise'
                  ? 'bg-[#181B22] text-[#00F0FF] border-b-2 border-[#00F0FF]'
                  : 'text-[#8A92A6] hover:text-[#F0F3F8]'
              }`}
            >
              <Sparkles size={13} />
              <span>Spectral Denoise & Sample Capture</span>
            </button>
            <button
              onClick={() => setActiveTab('autocut')}
              className={`px-3 py-1.5 rounded-t text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                activeTab === 'autocut'
                  ? 'bg-[#181B22] text-[#10B981] border-b-2 border-[#10B981]'
                  : 'text-[#8A92A6] hover:text-[#F0F3F8]'
              }`}
            >
              <Scissors size={13} />
              <span>Auto-Cut Silence & Ambient Fill</span>
            </button>
          </div>

          {/* TAB 1: SPECTRAL DENOISE (SIDE-BY-SIDE 2-COLUMN GRID) */}
          {activeTab === 'denoise' && (
            <div className="grid grid-cols-2 gap-3.5 items-stretch animate-in fade-in duration-100">
              {/* ========================================================================= */}
              {/* LEFT COLUMN: STEP 1 - GET NOISE PROFILE                                   */}
              {/* ========================================================================= */}
              <div className="p-3.5 rounded-lg bg-[#0D0E12] border border-[#222630] flex flex-col justify-between space-y-3">
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="px-1.5 py-0.5 rounded bg-[#00F0FF]/15 text-[#00F0FF] font-mono font-bold text-[10px]">
                        Step 1
                      </span>
                      <span className="text-xs font-bold text-[#F0F3F8]">
                        Capture Noise Profile
                      </span>
                      {hasProfile ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#10B981]/20 border border-[#10B981]/40 text-[#10B981] flex items-center gap-1">
                          ✓ Profile Active ({np.profileDurationSec ? `${np.profileDurationSec.toFixed(1)}s` : 'Loaded'})
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono text-[#64748B] bg-[#161922] border border-[#222630]">
                          [ No Profile ]
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="text-[11px] text-[#8A92A6]">
                    Select 2–4s ambient noise on the waveform above.
                  </p>

                  {/* Presets */}
                  <div className="flex items-center gap-1.5 pt-0.5">
                    <span className="text-[10px] text-[#8A92A6]">Presets:</span>
                    {[1.5, 2.0, 3.0, 4.0, 5.0].map((dur) => (
                      <button
                        key={dur}
                        onClick={() => {
                          stopAudition();
                          const newDur = Math.min(dur, clipDuration - startSec);
                          setDurationSec(Number(newDur.toFixed(2)));
                        }}
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium transition-colors cursor-pointer border ${
                          Math.abs(durationSec - dur) < 0.1
                            ? 'bg-[#00F0FF]/20 border-[#00F0FF] text-[#00F0FF] font-bold'
                            : 'bg-[#181B22] border-[#222630] text-[#8A92A6] hover:text-white'
                        }`}
                      >
                        {dur.toFixed(1)}s
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-1">
                    {/* Start Position Slider */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-[#8A92A6]">Sample Start</span>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            step={0.1}
                            min={0}
                            max={Math.max(0, clipDuration - durationSec)}
                            value={startSec}
                            onChange={(e) => {
                              stopAudition();
                              setStartSec(Math.max(0, Math.min(clipDuration - durationSec, Number(e.target.value))));
                            }}
                            className="w-14 px-1 py-0.5 text-right font-mono text-[11px] bg-[#161922] border border-[#2B3040] rounded text-[#F0F3F8]"
                          />
                          <span className="text-[10px] text-[#8A92A6]">s</span>
                        </div>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={Math.max(0, clipDuration - durationSec)}
                        step={0.05}
                        value={startSec}
                        onChange={(e) => {
                          stopAudition();
                          setStartSec(Number(e.target.value));
                        }}
                        className="w-full h-1.5 bg-[#222630] rounded appearance-none cursor-pointer accent-[#00F0FF]"
                      />
                    </div>

                    {/* Duration Slider */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-[#8A92A6]">Sample Duration</span>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            step={0.1}
                            min={0.5}
                            max={Math.min(10.0, clipDuration - startSec)}
                            value={durationSec}
                            onChange={(e) => {
                              stopAudition();
                              setDurationSec(Math.max(0.5, Math.min(10.0, Number(e.target.value))));
                            }}
                            className="w-14 px-1 py-0.5 text-right font-mono text-[11px] bg-[#161922] border border-[#2B3040] rounded text-[#00F0FF]"
                          />
                          <span className="text-[10px] text-[#8A92A6]">s</span>
                        </div>
                      </div>
                      <input
                        type="range"
                        min={0.5}
                        max={Math.min(10.0, clipDuration - startSec)}
                        step={0.1}
                        value={durationSec}
                        onChange={(e) => {
                          stopAudition();
                          setDurationSec(Number(e.target.value));
                        }}
                        className="w-full h-1.5 bg-[#222630] rounded appearance-none cursor-pointer accent-[#00F0FF]"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-[#1C202B]">
                  <button
                    onClick={handleCapture}
                    disabled={isCapturing}
                    className="flex-1 py-1.5 px-3 rounded bg-[#00F0FF] hover:bg-[#34f3ff] text-[#0A0C10] font-bold text-xs flex items-center justify-center gap-1.5 shadow-[0_0_12px_rgba(0,240,255,0.25)] transition-all cursor-pointer disabled:opacity-50"
                  >
                    <Sparkles size={13} />
                    <span>{isCapturing ? 'Analyzing Spectral Profile...' : `Get Noise Profile (${durationSec.toFixed(1)}s Sample)`}</span>
                  </button>

                  {hasProfile && (
                    <button
                      onClick={handleClear}
                      className="py-1.5 px-3 rounded bg-[#181B22] hover:bg-[#222630] border border-[#222630] text-[#8A92A6] hover:text-white text-xs font-medium transition-colors cursor-pointer"
                      title="Clear captured spectral profile"
                    >
                      <RotateCcw size={12} />
                    </button>
                  )}
                </div>
              </div>

              {/* ========================================================================= */}
              {/* RIGHT COLUMN: STEP 2 - NOISE REDUCTION PARAMETERS                         */}
              {/* ========================================================================= */}
              <div className="p-3.5 rounded-lg bg-[#0D0E12] border border-[#222630] flex flex-col justify-between space-y-3">
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between pb-1 border-b border-[#1C202B]">
                    <div className="flex items-center gap-2">
                      <span className="px-1.5 py-0.5 rounded bg-[#10B981]/15 text-[#10B981] font-mono font-bold text-[10px]">
                        Step 2
                      </span>
                      <span className="text-xs font-bold text-[#F0F3F8]">
                        Noise Reduction Settings
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[11px] font-bold font-mono transition-colors ${
                          np.noiseReductionEnabled ? 'text-[#00F0FF]' : 'text-[#8A92A6]'
                        }`}
                      >
                        {np.noiseReductionEnabled ? 'Denoise: ON' : 'Bypass: OFF'}
                      </span>
                      <label
                        className="relative inline-flex items-center cursor-pointer"
                        title="Toggle Noise Reduction On / Off (Instant A/B Bypass Switch)"
                      >
                        <input
                          type="checkbox"
                          checked={np.noiseReductionEnabled}
                          onChange={(e) => handleToggleNoiseReduction(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-8 h-4 bg-[#222630] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3.5 after:transition-all peer-checked:bg-[#00F0FF]"></div>
                      </label>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {/* Parameter 1: Noise reduction (dB) */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-[#CBD5E1] font-medium">Reduction (dB):</span>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            step={0.5}
                            min={0}
                            max={48}
                            value={np.reductionIntensityDb ?? 12.0}
                            onChange={(e) =>
                              handleUpdateSettings({
                                reductionIntensityDb: Math.max(0, Math.min(48, Number(e.target.value))),
                              })
                            }
                            className="w-14 px-1 py-0.5 text-right font-mono text-[11px] bg-[#161922] border border-[#2B3040] rounded text-[#00F0FF] font-bold"
                          />
                          <span className="text-[10px] text-[#8A92A6]">dB</span>
                        </div>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={48}
                        step={0.5}
                        value={np.reductionIntensityDb ?? 12.0}
                        onChange={(e) =>
                          handleUpdateSettings({
                            reductionIntensityDb: Number(e.target.value),
                          })
                        }
                        className="w-full h-1.5 bg-[#222630] rounded appearance-none cursor-pointer accent-[#00F0FF]"
                      />
                    </div>

                    {/* Parameter 2: Sensitivity */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-[#CBD5E1] font-medium">Sensitivity:</span>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            step={0.1}
                            min={0.5}
                            max={12.0}
                            value={np.sensitivity ?? 6.0}
                            onChange={(e) =>
                              handleUpdateSettings({
                                sensitivity: Math.max(0.5, Math.min(12.0, Number(e.target.value))),
                              })
                            }
                            className="w-14 px-1 py-0.5 text-right font-mono text-[11px] bg-[#161922] border border-[#2B3040] rounded text-[#F0F3F8]"
                          />
                        </div>
                      </div>
                      <input
                        type="range"
                        min={0.5}
                        max={12.0}
                        step={0.1}
                        value={np.sensitivity ?? 6.0}
                        onChange={(e) =>
                          handleUpdateSettings({
                            sensitivity: Number(e.target.value),
                          })
                        }
                        className="w-full h-1.5 bg-[#222630] rounded appearance-none cursor-pointer accent-[#00F0FF]"
                      />
                    </div>
                  </div>

                  {/* Parameter 3: Frequency smoothing (bands) */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-[#CBD5E1] font-medium">Frequency smoothing (bands):</span>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step={1}
                          min={0}
                          max={12}
                          value={np.frequencySmoothingBands ?? 6}
                          onChange={(e) =>
                            handleUpdateSettings({
                              frequencySmoothingBands: Math.max(0, Math.min(12, Number(e.target.value))),
                            })
                          }
                          className="w-14 px-1 py-0.5 text-right font-mono text-[11px] bg-[#161922] border border-[#2B3040] rounded text-[#F0F3F8]"
                        />
                      </div>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={12}
                      step={1}
                      value={np.frequencySmoothingBands ?? 6}
                      onChange={(e) =>
                        handleUpdateSettings({
                          frequencySmoothingBands: Number(e.target.value),
                        })
                      }
                      className="w-full h-1.5 bg-[#222630] rounded appearance-none cursor-pointer accent-[#00F0FF]"
                    />
                  </div>
                </div>

                {/* Noise Mode: Reduce vs Residue */}
                <div className="flex items-center gap-6 pt-2 border-t border-[#1C202B] text-[11px]">
                  <span className="text-[#8A92A6] font-medium">Noise:</span>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="modal_denoise_output_mode"
                      checked={!np.auditionResidue}
                      onChange={() =>
                        handleUpdateSettings({ auditionResidue: false })
                      }
                      className="accent-[#00F0FF] cursor-pointer"
                    />
                    <span className={!np.auditionResidue ? 'text-[#F0F3F8] font-bold' : 'text-[#8A92A6]'}>
                      Reduce (Clean Audio)
                    </span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="modal_denoise_output_mode"
                      checked={np.auditionResidue}
                      onChange={() =>
                        handleUpdateSettings({ auditionResidue: true })
                      }
                      className="accent-[#F59E0B] cursor-pointer"
                    />
                    <span className={np.auditionResidue ? 'text-[#F59E0B] font-bold' : 'text-[#8A92A6]'}>
                      Residue (Audition Noise)
                    </span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: AUTO-CUT SILENCE & AMBIENT FILL                                     */}
          {/* ========================================================================= */}
          {activeTab === 'autocut' && (
            <div className="p-3.5 rounded-lg bg-[#0D0E12] border border-[#222630] space-y-3 animate-in fade-in duration-100">
              <div className="flex items-center justify-between pb-1 border-b border-[#1C202B]">
                <span className="text-xs font-bold text-[#F0F3F8] flex items-center gap-1.5">
                  <Scissors size={13} className="text-[#10B981]" />
                  <span>Silence Auto-Cut & Ambient Fill Configuration</span>
                </span>
              </div>

              {/* Threshold */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-[#8A92A6]">Silence Cut Threshold</span>
                  <span className="font-mono text-xs font-bold text-[#10B981]">
                    {np.silenceCutThresholdDb.toFixed(1)} dB
                  </span>
                </div>
                <input
                  type="range"
                  min={-60}
                  max={-20}
                  step={1}
                  value={np.silenceCutThresholdDb}
                  onChange={(e) =>
                    updateNoiseProfileSettings(targetClip.id, {
                      silenceCutThresholdDb: Number(e.target.value),
                    })
                  }
                  className="w-full h-1.5 bg-[#222630] rounded appearance-none cursor-pointer accent-[#10B981]"
                />
              </div>

              {/* Min Duration & Padding */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-[#8A92A6]">Min Silence Duration</span>
                    <span className="font-mono text-xs font-bold text-[#10B981]">
                      {np.silenceMinDurationSec.toFixed(2)}s
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0.2}
                    max={2.0}
                    step={0.05}
                    value={np.silenceMinDurationSec}
                    onChange={(e) =>
                      updateNoiseProfileSettings(targetClip.id, {
                        silenceMinDurationSec: Number(e.target.value),
                      })
                    }
                    className="w-full h-1.5 bg-[#222630] rounded appearance-none cursor-pointer accent-[#10B981]"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-[#8A92A6]">Margin Padding</span>
                    <span className="font-mono text-xs font-bold text-[#10B981]">
                      {np.cutMarginPaddingMs}ms
                    </span>
                  </div>
                  <input
                    type="range"
                    min={10}
                    max={100}
                    step={5}
                    value={np.cutMarginPaddingMs}
                    onChange={(e) =>
                      updateNoiseProfileSettings(targetClip.id, {
                        cutMarginPaddingMs: Number(e.target.value),
                      })
                    }
                    className="w-full h-1.5 bg-[#222630] rounded appearance-none cursor-pointer accent-[#10B981]"
                  />
                </div>
              </div>

              {/* Fill Cut Gaps Checkbox */}
              <div className="pt-1 border-t border-[#1C202B]">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={np.ambientRecoveryEnabled}
                    onChange={(e) =>
                      updateNoiseProfileSettings(targetClip.id, {
                        ambientRecoveryEnabled: e.target.checked,
                      })
                    }
                    className="rounded bg-[#0D0E11] border-[#222630] text-[#00F0FF] focus:ring-0 cursor-pointer w-3.5 h-3.5 accent-[#00F0FF]"
                  />
                  <span className="text-xs font-medium text-[#F0F3F8]">
                    Fill Cut Gaps with Ambient Room Tone Bed
                  </span>
                </label>
              </div>

              {/* Ambient Retrieval Intensity */}
              {np.ambientRecoveryEnabled && (
                <div className="space-y-1 pl-5 pt-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-[#8A92A6]">Ambient Retrieval Intensity</span>
                    <span className="font-mono text-xs font-bold text-[#00F0FF]">
                      {Math.round(np.ambientFillIntensity * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0.05}
                    max={1.0}
                    step={0.05}
                    value={np.ambientFillIntensity}
                    onChange={(e) =>
                      updateNoiseProfileSettings(targetClip.id, {
                        ambientFillIntensity: Number(e.target.value),
                      })
                    }
                    className="w-full h-1.5 bg-[#222630] rounded appearance-none cursor-pointer accent-[#00F0FF]"
                  />
                </div>
              )}

              {/* Run Auto-Cut Button */}
              <div className="pt-2">
                <button
                  onClick={handleRunAutoCut}
                  disabled={isRunningAutoCut}
                  className="w-full py-2 px-3 rounded bg-gradient-to-r from-[#10B981] to-[#00F0FF] text-[#0A0C10] font-bold text-xs flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(16,185,129,0.3)] transition-all cursor-pointer disabled:opacity-50"
                >
                  <Scissors size={14} />
                  <span>
                    {isRunningAutoCut
                      ? 'Detecting Silence & Building Ambient Bridges...'
                      : 'Run Silence Auto-Cut with Ambient Fill'}
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-[#222630] bg-[#0E1015]">
          {/* Audition & Preview Controls */}
          <div className="flex items-center gap-2">
            {/* Preview Clean Button */}
            <button
              onClick={handlePreviewCleanAudio}
              disabled={isRenderingPreview}
              className={`py-1.5 px-3 rounded text-xs font-semibold flex items-center gap-1.5 border transition-all cursor-pointer ${
                playbackMode === 'clean'
                  ? 'bg-[#10B981]/25 text-[#10B981] border-[#10B981] shadow-[0_0_12px_rgba(16,185,129,0.3)]'
                  : 'bg-[#181B22] text-[#00F0FF] hover:bg-[#00F0FF]/15 border-[#00F0FF]/40'
              }`}
              title="Preview clean denoised audio across the entire clip without boundaries"
            >
              {isRenderingPreview ? (
                <RotateCcw size={13} className="animate-spin text-[#00F0FF]" />
              ) : playbackMode === 'clean' ? (
                <Pause size={13} />
              ) : (
                <Sparkles size={13} />
              )}
              <span>
                {isRenderingPreview
                  ? 'Denoising Preview...'
                  : playbackMode === 'clean'
                  ? 'Stop Clean Preview'
                  : 'Preview Clean Audio'}
              </span>
            </button>

            {/* Audition Raw Audio Button */}
            <button
              onClick={handleAuditionRawAudio}
              className={`py-1.5 px-3 rounded text-xs font-semibold flex items-center gap-1.5 border transition-all cursor-pointer ${
                playbackMode === 'raw'
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-[0_0_12px_rgba(245,158,11,0.3)]'
                  : 'bg-[#181B22] text-[#8A92A6] hover:text-white border-[#222630] hover:bg-[#222630]'
              }`}
              title="Audition original raw camera audio across the entire clip without boundaries"
            >
              {playbackMode === 'raw' ? <Pause size={13} /> : <Play size={13} />}
              <span>{playbackMode === 'raw' ? 'Stop Raw' : 'Audition Raw Audio'}</span>
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => {
                stopAudition();
                setIsNoiseModalOpen(false, null);
              }}
              className="px-3.5 py-1.5 rounded bg-[#181B22] hover:bg-[#222630] border border-[#222630] text-[#8A92A6] hover:text-white text-xs font-medium transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              onClick={handleApplyToEntireClip}
              disabled={isApplyingFull}
              className="px-4 py-1.5 rounded bg-gradient-to-r from-[#10B981] to-[#00F0FF] hover:from-[#17cf93] hover:to-[#22f4ff] text-[#0A0C10] font-bold text-xs flex items-center gap-1.5 shadow-[0_0_15px_rgba(0,240,255,0.3)] transition-all cursor-pointer disabled:opacity-50"
            >
              {isApplyingFull ? <RotateCcw size={13} className="animate-spin" /> : <Check size={14} />}
              <span>{isApplyingFull ? 'Applying to Entire Clip...' : 'OK - Apply to Entire Clip'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
