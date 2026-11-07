import React, { useState, useEffect } from 'react';
import {
  Sliders,
  Volume2,
  VolumeX,
  Gauge,
  Sparkles,
  RotateCcw,
  CheckCircle2,
  SlidersHorizontal,
  Film,
  Music,
  Check,
  ChevronRight,
  ChevronLeft,
  Tv,
  FolderOpen,
  Palette,
  Sun,
  Thermometer,
  Zap,
  Move,
  Maximize2,
  Eye,
  Camera,
  Type,
  Mic,
  Trash2,
  Play,
  ChevronDown,
  Loader2,
  Compass,
  HelpCircle,
} from 'lucide-react';
import { Diamond, RotateCw, AlignLeft, AlignCenter, AlignRight, Subtitles, Shield, AlertTriangle } from '@/components/Icons';
import { useShallow } from 'zustand/react/shallow';
import { useTimelineStore, isTauri, tauriInvoke, getInterpolatedClipTransform } from '../../store/timelineStore';
import { formatDeltaSeconds } from '../../utils/timecode';
import { Clip, MediaTrack } from '../../types/ipc';
import { ColorGradingInspector } from './ColorGradingInspector';
import { SpectralDenoiseInspector } from './SpectralDenoiseInspector';
import { getInterpolatedVolumeDb } from '../../utils/audioMastering';

export const Inspector: React.FC = () => {
  const {
    playhead,
    selectedClipId,
    tracks,
    isPlaying,
    inspectorTab,
    setInspectorTab,
    updateClipAdjustments,
    updateClipColor,
    resetClipColor,
    masterGrading,
    selectedGradingScope,
    setSelectedGradingScope,
    updateMasterGrading,
    resetMasterGrading,
    updateTrackGrading,
    resetTrackGrading,
    updateClipGradingProfile,
    resetClipGradingProfile,
    addAdjustmentLayer,
    toggleMute,
    toggleSolo,
    getActiveVideoClip,
    updateClipTransform,
    addOrUpdateGlobalKeyframe,
    removeGlobalKeyframe,
    clearAllKeyframes,
    addOrUpdateKeyframe,
    removeKeyframe,
    updateClipSpeed,
    updateClipLensEffects,
    updateClipStabilization,
    setSplitStabilizationComparison,
    analyzeClipStabilization,
    applyStabilizationPreview,
    validateStabilizationData,
    stabilizationDiagnostics,
    probeClipTelemetry,
    isStabilizationAnalyzing,
    isStabilizationRendering,
    setPlayhead,
    selectClip,
    updateTextClipContent,
    updateTextClipStyle,
    applyTextPreset,
    updateClipAudioProcessing,
    addOrUpdateVolumeKeyframe,
    removeVolumeKeyframe,
    updateTrackDucking,
    waveformData,
    isCollapsed,
    setIsCollapsed,
  } = useTimelineStore(
    useShallow((state) => ({
      playhead: state.playhead,
      selectedClipId: state.selectedClipId,
      tracks: state.tracks,
      isPlaying: state.isPlaying,
      inspectorTab: state.inspectorTab,
      setInspectorTab: state.setInspectorTab,
      updateClipAdjustments: state.updateClipAdjustments,
      updateClipColor: state.updateClipColor,
      resetClipColor: state.resetClipColor,
      masterGrading: state.masterGrading,
      selectedGradingScope: state.selectedGradingScope,
      setSelectedGradingScope: state.setSelectedGradingScope,
      updateMasterGrading: state.updateMasterGrading,
      resetMasterGrading: state.resetMasterGrading,
      updateTrackGrading: state.updateTrackGrading,
      resetTrackGrading: state.resetTrackGrading,
      updateClipGradingProfile: state.updateClipGradingProfile,
      resetClipGradingProfile: state.resetClipGradingProfile,
      addAdjustmentLayer: state.addAdjustmentLayer,
      toggleMute: state.toggleMute,
      toggleSolo: state.toggleSolo,
      getActiveVideoClip: state.getActiveVideoClip,
      updateClipTransform: state.updateClipTransform,
      addOrUpdateGlobalKeyframe: state.addOrUpdateGlobalKeyframe,
      removeGlobalKeyframe: state.removeGlobalKeyframe,
      clearAllKeyframes: state.clearAllKeyframes,
      addOrUpdateKeyframe: state.addOrUpdateKeyframe,
      removeKeyframe: state.removeKeyframe,
      updateClipSpeed: state.updateClipSpeed,
      updateClipLensEffects: state.updateClipLensEffects,
      updateClipStabilization: state.updateClipStabilization,
      setSplitStabilizationComparison: state.setSplitStabilizationComparison,
      analyzeClipStabilization: state.analyzeClipStabilization,
      applyStabilizationPreview: state.applyStabilizationPreview,
      validateStabilizationData: state.validateStabilizationData,
      stabilizationDiagnostics: state.stabilizationDiagnostics,
      probeClipTelemetry: state.probeClipTelemetry,
      isStabilizationAnalyzing: state.isStabilizationAnalyzing,
      isStabilizationRendering: state.isStabilizationRendering,
      setPlayhead: state.setPlayhead,
      selectClip: state.selectClip,
      updateTextClipContent: state.updateTextClipContent,
      updateTextClipStyle: state.updateTextClipStyle,
      applyTextPreset: state.applyTextPreset,
      updateClipAudioProcessing: state.updateClipAudioProcessing,
      addOrUpdateVolumeKeyframe: state.addOrUpdateVolumeKeyframe,
      removeVolumeKeyframe: state.removeVolumeKeyframe,
      updateTrackDucking: state.updateTrackDucking,
      waveformData: state.waveformData,
      isCollapsed: state.isInspectorCollapsed,
      setIsCollapsed: state.setIsInspectorCollapsed,
    }))
  );

  // Locate selected clip and its parent track
  let selectedClip: Clip | null = null;
  let parentTrack: MediaTrack | null = null;

  if (selectedClipId) {
    for (const track of tracks) {
      const c = track.clips.find((item) => item.id === selectedClipId);
      if (c) {
        selectedClip = c;
        parentTrack = track;
        break;
      }
    }
  }

  // Fallback to active video clip covering playhead if no explicit selection
  if (!selectedClip) {
    const activeLayer = getActiveVideoClip();
    if (activeLayer) {
      selectedClip = activeLayer.clip;
      parentTrack = activeLayer.track;
    }
  }

  const isTextClip =
    Boolean(selectedClip?.textContent !== undefined) ||
    parentTrack?.trackType === 'text' ||
    (parentTrack as any)?.type === 'text';

  const isAudioTrack = Boolean(
    parentTrack && (parentTrack.trackType === 'audio' || (parentTrack as any)?.type === 'audio')
  );

  const textStyle = selectedClip?.textStyle || {
    fontFamily: 'Inter',
    fontSize: 36,
    fontColor: '#FFFFFF',
    fontWeight: 'bold',
    strokeColor: '#000000',
    strokeWidth: 2,
    backgroundColor: 'transparent',
    backgroundPadding: 8,
    positionX: 0.5,
    positionY: 0.85,
    alignment: 'center',
    lineHeight: 1.2,
  };

  useEffect(() => {
    if (isTextClip && inspectorTab !== 'text' && inspectorTab !== 'video') {
      setInspectorTab('text');
    } else if (isAudioTrack && inspectorTab !== 'audio') {
      setInspectorTab('audio');
    } else if (!isTextClip && !isAudioTrack && inspectorTab === 'text') {
      setInspectorTab('video');
    }
  }, [selectedClip?.id, isTextClip, isAudioTrack, inspectorTab, setInspectorTab]);

  const tabs = isTextClip
    ? ([
        { id: 'text', label: 'Typography' },
        { id: 'video', label: 'Layout' },
      ] as const)
    : ([
        { id: 'video', label: 'Video' },
        { id: 'color', label: 'Adjustment' },
        { id: 'audio', label: 'Audio' },
      ] as const);

  // Local inspector adjustment states synced with selected clip
  const [brightness, setBrightness] = useState<number>(0); // -100 to +100 (%)
  const [contrast, setContrast] = useState<number>(100); // 0 to 200 (%)
  const [saturation, setSaturation] = useState<number>(100); // 0 to 200 (%)
  const [temperature, setTemperature] = useState<number>(0); // -100 to +100
  const [lutPreset, setLutPreset] = useState<string>('none');
  const [customLutPath, setCustomLutPath] = useState<string>('');
  const [volumeDb, setVolumeDb] = useState<number>(0); // -60 to +12 dB
  const [pan, setPan] = useState<number>(0); // -1.0 to +1.0
  const [bassGain, setBassGain] = useState<number>(0); // -15 to +15 dB
  const [midGain, setMidGain] = useState<number>(0); // -15 to +15 dB
  const [trebleGain, setTrebleGain] = useState<number>(0); // -15 to +15 dB
  const [speedMultiplier, setSpeedMultiplier] = useState(1.0);

  // Synchronized interpolated transform based on current playhead
  const currentTransform = selectedClip
    ? getInterpolatedClipTransform(selectedClip, playhead)
    : { scale: 1.0, positionX: 0, positionY: 0, rotation: 0, opacity: 1.0 };

  const currentSpeed = selectedClip?.speedProfile?.speedMultiplier ?? 1.0;
  const currentPitchCorrection = selectedClip?.speedProfile?.pitchCorrection ?? true;
  const currentDefish = selectedClip?.lensEffects?.defishEnabled ?? false;
  const currentDefishStrength = Math.round((selectedClip?.lensEffects?.defishStrength ?? 0) * 100);
  const currentBlur = selectedClip?.lensEffects?.gaussianBlur ?? 0;
  // Section collapse state: 1st section open by default, others collapsed
  const [videoSections, setVideoSections] = useState({
    properties: true,
    transform: false,
    lens: false,
    stabilization: false,
    speed: false,
  });
  const toggleVideoSection = (key: keyof typeof videoSections) => {
    setVideoSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const [audioSections, setAudioSections] = useState({
    volume: true,
    spectral: false,
    eq: false,
    ducking: false,
    envelopes: false,
    meter: false,
  });
  const toggleAudioSection = (key: keyof typeof audioSections) => {
    setAudioSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const [textSections, setTextSections] = useState({
    content: true,
    font: false,
    colors: false,
    alignment: false,
    transcript: false,
  });
  const toggleTextSection = (key: keyof typeof textSections) => {
    setTextSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const isStabilizationCollapsed = !videoSections.stabilization;
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);

  const stabProfile = selectedClip?.stabilizationProfile ?? selectedClip?.stabilization;
  const currentStabEnabled = stabProfile?.enabled ?? false;
  const currentStabMode = stabProfile?.mode ?? 'two_pass';
  const currentDetectionMode = stabProfile?.detectionMode ?? 'auto';
  const hasGyroData = Boolean(selectedClip?.metadata?.hasGyroData ?? stabProfile?.hasGyroData);
  const currentEngineUsed = stabProfile?.engineUsed ?? (hasGyroData ? 'gyroflow' : 'perspectiveHomography');
  const currentSmoothness = Math.round((stabProfile?.smoothness ?? 0.5) * 100);
  const currentCropPolicy = stabProfile?.cropModePolicy ?? 'dynamicAdaptiveZoom';
  const currentMaxCropLimit = Math.round((stabProfile?.maxCropLimit ?? 1.25) * 100);
  const currentHorizonLock = Boolean(stabProfile?.horizonLock);
  const currentRollingShutter = Math.round(stabProfile?.rollingShutterCompensationMs ?? 0);
  const currentDebugViewMode = stabProfile?.debugViewMode ?? 'normal';
  const currentSplitWipePos = stabProfile?.splitWipePosition !== undefined ? Math.round(stabProfile.splitWipePosition * 100) : 50;
  const clipDiagnostics = selectedClip ? stabilizationDiagnostics[selectedClip.id] : undefined;

  const stabStatus = stabProfile?.status ?? ((stabProfile?.transformsFilePath || stabProfile?.cacheMatrixPath) ? { type: 'ready' } : { type: 'unanalyzed' });
  const isClipAnalyzing = Boolean(
    (selectedClip && isStabilizationAnalyzing[selectedClip.id] !== undefined) ||
    stabStatus.type === 'analyzing' ||
    stabStatus.type === 'trackingMotion' ||
    stabStatus.type === 'probing'
  );
  const analysisProgress = selectedClip
    ? isStabilizationAnalyzing[selectedClip.id] ?? (stabStatus.type === 'analyzing' || stabStatus.type === 'trackingMotion' ? stabStatus.progress : 0)
    : 0;
  const isStabilized = stabStatus.type === 'ready' || Boolean(stabProfile?.transformsFilePath || stabProfile?.cacheMatrixPath);

  useEffect(() => {
    if (selectedClip && selectedClip.filePath && selectedClip.mediaType === 'video') {
      if (selectedClip.metadata?.hasGyroData === undefined && stabProfile?.hasGyroData === undefined) {
        probeClipTelemetry(selectedClip.id).catch(() => {});
      }
    }
  }, [selectedClip?.id, selectedClip?.filePath]);

  // Query stabilization verification diagnostics on stabilized clip selection
  useEffect(() => {
    if (selectedClip && isStabilized && !stabilizationDiagnostics[selectedClip.id]) {
      validateStabilizationData(selectedClip.id).catch(() => {});
    }
  }, [selectedClip?.id, isStabilized]);

  // Live stereo VU meter animation during playback
  const [meterL, setMeterL] = useState(-36);
  const [meterR, setMeterR] = useState(-34);

  // Global Keyframe status and navigation
  const keyframeTimes = selectedClip?.keyframeTracks
    ? Array.from(
        new Set(
          selectedClip.keyframeTracks.flatMap((t) =>
            t.keyframes.map((k) => Number(k.time.toFixed(3)))
          )
        )
      ).sort((a, b) => a - b)
    : [];

  const clipStartSec = selectedClip ? (selectedClip.startPositionSeconds ?? (selectedClip.startTimeMs / 1000)) : 0;
  const clipDurSec = selectedClip ? (selectedClip.durationSeconds ?? (selectedClip.durationMs / 1000)) : 1;
  const clipSpeed = selectedClip?.speedProfile?.speedMultiplier ?? 1.0;
  const currentRelTime = Math.max(0, Math.min(clipDurSec, playhead - clipStartSec));

  const currentKfTime = keyframeTimes.find((t) => Math.abs(t - currentRelTime) < 0.08);
  const hasKeyframeAtPlayhead = currentKfTime !== undefined;
  const prevKfTime = keyframeTimes.filter((t) => t < currentRelTime - 0.08).pop();
  const nextKfTime = keyframeTimes.find((t) => t > currentRelTime + 0.08);

  const hasPropertyKeyframe = (property: string): boolean => {
    if (!selectedClip?.keyframeTracks) return false;
    const track = selectedClip.keyframeTracks.find((t) => t.property === property);
    if (!track) return false;
    return track.keyframes.some((k) => Math.abs(k.time - currentRelTime) < 0.08);
  };

  const allPropertiesKeyframed = ['scale', 'position_x', 'position_y', 'rotation', 'opacity'].every(hasPropertyKeyframe);
  const activePropertyKeyframeCount = ['scale', 'position_x', 'position_y', 'rotation', 'opacity'].filter(hasPropertyKeyframe).length;

  const handleTogglePropertyKeyframe = (property: string, currentValue: number) => {
    if (!selectedClip) return;
    if (hasPropertyKeyframe(property)) {
      removeKeyframe(selectedClip.id, property, currentRelTime);
    } else {
      addOrUpdateKeyframe(selectedClip.id, property, currentRelTime, currentValue);
    }
  };

  const handleToggleGlobalKeyframe = () => {
    if (!selectedClip) return;
    if (hasKeyframeAtPlayhead && allPropertiesKeyframed && currentKfTime !== undefined) {
      removeGlobalKeyframe(selectedClip.id, currentKfTime);
    } else {
      addOrUpdateGlobalKeyframe(selectedClip.id, currentRelTime, currentTransform);
    }
  };

  const handleJumpToPrevKeyframe = () => {
    if (!selectedClip || prevKfTime === undefined) return;
    setPlayhead(clipStartSec + prevKfTime);
  };

  const handleJumpToNextKeyframe = () => {
    if (!selectedClip || nextKfTime === undefined) return;
    setPlayhead(clipStartSec + nextKfTime);
  };

  const handleResetTransform = () => {
    if (!selectedClip) return;
    updateClipTransform(selectedClip.id, {
      scale: 1.0,
      positionX: 0,
      positionY: 0,
      rotation: 0,
      opacity: 1.0,
    });
  };

  const handleResetLens = () => {
    if (!selectedClip) return;
    updateClipLensEffects(selectedClip.id, {
      defishEnabled: false,
      defishStrength: 0,
      gaussianBlur: 0,
    });
  };

  const handleResetStabilization = () => {
    if (!selectedClip) return;
    updateClipStabilization(selectedClip.id, {
      enabled: false,
      detectionMode: 'auto',
      smoothness: 0.5,
      cropModePolicy: 'dynamicAdaptiveZoom',
      maxCropLimit: 1.25,
      rollingShutterCompensationMs: 0.0,
      horizonLock: false,
      shakiness: 5,
      accuracy: 10,
      stepsize: 6,
      smoothing: 30,
      cropMode: 'auto',
      zoomPercent: 0,
      smoothingType: 'gaussian',
      status: { type: 'unanalyzed' },
      transformsFilePath: undefined,
      cacheMatrixPath: undefined,
    });
  };

  // Sync state when selected clip changes
  useEffect(() => {
    if (selectedClip) {
      setBrightness(Math.round((selectedClip.color?.brightness ?? selectedClip.brightness ?? 0) * 100));
      setContrast(Math.round((selectedClip.color?.contrast ?? selectedClip.contrast ?? 1.0) * 100));
      setSaturation(Math.round((selectedClip.color?.saturation ?? selectedClip.saturation ?? 1.0) * 100));
      setTemperature(Math.round(selectedClip.color?.temperature ?? selectedClip.temperature ?? 0));
      setVolumeDb(selectedClip.volumeDb ?? 0);
      setPan(selectedClip.audioProcessing?.pan ?? selectedClip.pan ?? 0);
      setBassGain(selectedClip.audioProcessing?.bassGain ?? selectedClip.bassGain ?? 0);
      setMidGain(selectedClip.audioProcessing?.midGain ?? selectedClip.midGain ?? 0);
      setTrebleGain(selectedClip.audioProcessing?.trebleGain ?? selectedClip.trebleGain ?? 0);
      const activeLut = selectedClip.color?.lutPath || selectedClip.lutPath;
      if (activeLut) {
        const lp = activeLut.toLowerCase();
        setCustomLutPath(activeLut);
        if (lp.includes('teal_orange')) {
          setLutPreset('teal_orange');
        } else if (lp.includes('warm_film')) {
          setLutPreset('warm_film');
        } else if (lp.includes('clean_cool')) {
          setLutPreset('clean_cool');
        } else if (lp.includes('vintage')) {
          setLutPreset('vintage');
        } else if (lp.includes('vibrant')) {
          setLutPreset('vibrant');
        } else if (lp.includes('monochrome') || lp.includes('bw')) {
          setLutPreset('monochrome');
        } else {
          setLutPreset('custom');
        }
      } else {
        setLutPreset('none');
      }
    }
  }, [
    selectedClip?.id,
    selectedClip?.brightness,
    selectedClip?.contrast,
    selectedClip?.saturation,
    selectedClip?.temperature,
    selectedClip?.volumeDb,
    selectedClip?.pan,
    selectedClip?.bassGain,
    selectedClip?.midGain,
    selectedClip?.trebleGain,
    selectedClip?.audioProcessing,
    selectedClip?.lutPath,
    selectedClip?.color,
  ]);

  // Dynamic Live Stereo dB Meter calculating the REAL played audio decibels at the playhead
  useEffect(() => {
    if (!isPlaying) {
      setMeterL(-60);
      setMeterR(-60);
      return;
    }

    const interval = setInterval(() => {
      // Find the active playing clip at current playhead
      let activeClip: Clip | null = null;
      let activeTrack: MediaTrack | null = null;

      // Prioritize selected clip if playhead is currently inside it
      if (selectedClip) {
        const s = selectedClip.startPositionSeconds ?? 0;
        const d = selectedClip.durationSeconds ?? 0;
        if (playhead >= s && playhead < s + d) {
          activeClip = selectedClip;
          activeTrack = parentTrack;
        }
      }

      // Otherwise find any audio or video clip playing across active tracks
      if (!activeClip) {
        for (const t of tracks) {
          if (t.muted || t.isMuted) continue;
          for (const c of t.clips || []) {
            const s = c.startPositionSeconds ?? 0;
            const d = c.durationSeconds ?? 0;
            if (playhead >= s && playhead < s + d && c.filePath) {
              activeClip = c;
              activeTrack = t;
              break;
            }
          }
          if (activeClip) break;
        }
      }

      if (!activeClip || !activeClip.filePath || activeTrack?.muted || activeTrack?.isMuted) {
        setMeterL(-60);
        setMeterR(-60);
        return;
      }

      const np = activeClip.audioProcessing?.noiseProfile;
      const isDenoised = Boolean(np?.noiseReductionEnabled);
      const effectivePath = (isDenoised && np?.denoisedAudioPath) ? np.denoisedAudioPath : activeClip.filePath;

      // Read real acoustic peak from waveform data
      const peaks = waveformData[effectivePath] || [];
      const relTime = Math.max(0, playhead - (activeClip.startPositionSeconds ?? 0));
      const inPoint = activeClip.inPointSeconds || 0;
      const totalSec = activeClip.metadata?.durationSeconds || activeClip.durationSeconds || 60;
      const sampleTime = inPoint + relTime;
      const progress = Math.max(0, Math.min(1, sampleTime / totalSec));
      const peakIdx = Math.min(peaks.length - 1, Math.floor(progress * peaks.length));

      let amp = peaks.length > 0 ? (peaks[peakIdx] ?? 0.05) : 0.05;

      // If noise reduction is enabled on raw audio without a pre-rendered WAV yet, apply live spectral gate
      if (isDenoised && (!np?.denoisedAudioPath || effectivePath === activeClip.filePath)) {
        const redDb = np?.reductionIntensityDb ?? 12.0;
        const sens = np?.sensitivity ?? 6.0;
        const noiseGateThreshold = Math.min(0.45, 0.12 + (sens / 12.0) * 0.28);
        if (amp < noiseGateThreshold) {
          const redFactor = Math.pow(10, -redDb / 20);
          const ratio = Math.max(0, amp / noiseGateThreshold);
          amp = amp * (redFactor + (1 - redFactor) * Math.pow(ratio, 2.0));
        }
      }

      // Volume Gain & Auto-Ducking
      const clipVolDb = getInterpolatedVolumeDb(activeClip, relTime);
      const duckDb = activeTrack?.ducking?.duckingEnabled ? (activeTrack.ducking.attenuationDb ?? -14) : 0;
      const totalGainDb = clipVolDb + duckDb;
      const linearVol = totalGainDb <= -58 ? 0 : Math.pow(10, totalGainDb / 20);

      // Stereo Pan
      const pan = activeClip.audioProcessing?.pan ?? 0;
      const panLeft = pan <= 0 ? 1.0 : Math.max(0.01, 1.0 - pan);
      const panRight = pan >= 0 ? 1.0 : Math.max(0.01, 1.0 + pan);

      const linearL = amp * linearVol * panLeft;
      const linearR = amp * linearVol * panRight;

      // Convert to Decibels (-60 dB to +6 dB)
      const dbL = linearL > 0.0001 ? Math.min(6, Math.max(-60, 20 * Math.log10(linearL))) : -60;
      const dbR = linearR > 0.001 ? Math.min(6, Math.max(-60, 20 * Math.log10(linearR))) : -60;

      setMeterL(Number(dbL.toFixed(1)));
      setMeterR(Number(dbR.toFixed(1)));
    }, 50);

    return () => clearInterval(interval);
  }, [isPlaying, playhead, selectedClip, parentTrack, tracks, waveformData]);

  // Commit Color Grading adjustments
  const handleColorUpdate = (updates: {
    brightness?: number;
    contrast?: number;
    saturation?: number;
    temperature?: number;
  }) => {
    const newB = updates.brightness !== undefined ? updates.brightness : brightness;
    const newC = updates.contrast !== undefined ? updates.contrast : contrast;
    const newS = updates.saturation !== undefined ? updates.saturation : saturation;
    const newT = updates.temperature !== undefined ? updates.temperature : temperature;

    if (updates.brightness !== undefined) setBrightness(newB);
    if (updates.contrast !== undefined) setContrast(newC);
    if (updates.saturation !== undefined) setSaturation(newS);
    if (updates.temperature !== undefined) setTemperature(newT);

    if (selectedClip) {
      updateClipColor(selectedClip.id, {
        brightness: newB / 100.0,
        contrast: newC / 100.0,
        saturation: newS / 100.0,
        temperature: newT,
      });
      updateClipAdjustments(selectedClip.id, {
        brightness: newB / 100.0,
        contrast: newC / 100.0,
        saturation: newS / 100.0,
      });
    }
  };

  const handleResetSlider = (param: 'brightness' | 'contrast' | 'saturation' | 'temperature') => {
    switch (param) {
      case 'brightness':
        handleColorUpdate({ brightness: 0 });
        break;
      case 'contrast':
        handleColorUpdate({ contrast: 100 });
        break;
      case 'saturation':
        handleColorUpdate({ saturation: 100 });
        break;
      case 'temperature':
        handleColorUpdate({ temperature: 0 });
        break;
    }
  };

  const handleResetAllColor = () => {
    setBrightness(0);
    setContrast(100);
    setSaturation(100);
    setTemperature(0);
    handleLutChange('none');
    if (selectedClip) {
      resetClipColor(selectedClip.id);
    }
  };

  // Commit 3D LUT preset or custom file
  const handleLutChange = (preset: string, pathOverride?: string) => {
    setLutPreset(preset);
    let path = pathOverride ?? customLutPath;

    if (preset === 'none') {
      path = '';
    } else if (preset === 'teal_orange') {
      path = 'C:\\Presets\\LUTs\\cinematic_teal_orange.cube';
    } else if (preset === 'warm_film') {
      path = 'C:\\Presets\\LUTs\\warm_golden_film.cube';
    } else if (preset === 'clean_cool') {
      path = 'C:\\Presets\\LUTs\\clean_cool_commercial.cube';
    } else if (preset === 'vintage') {
      path = 'C:\\Presets\\LUTs\\vintage_bleach_bypass.cube';
    } else if (preset === 'vibrant') {
      path = 'C:\\Presets\\LUTs\\vibrant_boost.cube';
    } else if (preset === 'monochrome') {
      path = 'C:\\Presets\\LUTs\\cinematic_monochrome.cube';
    }

    if (selectedClip) {
      updateClipColor(selectedClip.id, { lutPath: path || undefined });
      updateClipAdjustments(selectedClip.id, { lutPath: path || undefined });
    }
  };

  const handleBrowseLut = async () => {
    try {
      if (isTauri) {
        const selected = await tauriInvoke<string | null>('open_lut_dialog');
        if (selected) {
          setCustomLutPath(selected);
          handleLutChange('custom', selected);
        }
      } else {
        const prompted = window.prompt('Enter path to 3D LUT (.cube) file:', customLutPath);
        if (prompted) {
          setCustomLutPath(prompted);
          handleLutChange('custom', prompted);
        }
      }
    } catch (err) {
      console.warn('Failed to browse LUT file:', err);
    }
  };

  // Commit Audio Volume Fader
  const handleVolumeChange = (newDb: number) => {
    setVolumeDb(newDb);
    if (selectedClip) {
      updateClipAdjustments(selectedClip.id, { volumeDb: newDb });
      updateClipAudioProcessing(selectedClip.id, { gainDb: newDb });
    }
  };

  const handlePanChange = (newPan: number) => {
    setPan(newPan);
    if (selectedClip) {
      updateClipAudioProcessing(selectedClip.id, { pan: newPan });
    }
  };

  const handleBassChange = (newBass: number) => {
    setBassGain(newBass);
    if (selectedClip) {
      updateClipAudioProcessing(selectedClip.id, { bassGain: newBass });
    }
  };

  const handleMidChange = (newMid: number) => {
    setMidGain(newMid);
    if (selectedClip) {
      updateClipAudioProcessing(selectedClip.id, { midGain: newMid });
    }
  };

  const handleTrebleChange = (newTreble: number) => {
    setTrebleGain(newTreble);
    if (selectedClip) {
      updateClipAudioProcessing(selectedClip.id, { trebleGain: newTreble });
    }
  };

  const handleApplyEqPreset = (b: number, m: number, t: number) => {
    setBassGain(b);
    setMidGain(m);
    setTrebleGain(t);
    if (selectedClip) {
      updateClipAudioProcessing(selectedClip.id, { bassGain: b, midGain: m, trebleGain: t });
    }
  };

  const handleAddKeyframeAtPlayhead = () => {
    if (!selectedClip) return;
    const clipStart = selectedClip.startPositionSeconds || 0;
    const offset = Math.max(0, Math.min(selectedClip.durationSeconds || 10, playhead - clipStart));
    addOrUpdateVolumeKeyframe(selectedClip.id, offset, volumeDb);
  };

  if (isCollapsed) {
    return (
      <div className="w-full h-full bg-[#14161B] border-l border-[#222630] flex flex-col items-center py-3 select-none">
        <button
          onClick={() => setIsCollapsed(false)}
          className="p-1.5 rounded-lg bg-[#1E222D] hover:bg-[#252B3A] text-[#00F0FF] hover:scale-105 transition-all cursor-pointer"
          title="Expand Inspector Panel"
        >
          <ChevronLeft size={16} />
        </button>
        <div className="mt-8 flex flex-col items-center gap-6 text-[#64748B]">
          <span className="text-[11px] font-bold tracking-widest uppercase [writing-mode:vertical-lr] rotate-180">
            Inspector
          </span>
          <Sliders size={16} className="text-[#8A92A6]" />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-[#14161B] border-l border-[#222630] flex flex-col overflow-hidden select-none">
      {/* Top Main Tabs + Collapse button */}
      <div className="h-10 bg-[#101217] border-b border-[#222630] px-2.5 flex items-center justify-between text-xs font-semibold">
        <div className="flex items-center gap-1">
          {tabs.map((tab) => {
            const isActive = inspectorTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setInspectorTab(tab.id as any)}
                className={`px-2.5 py-1 rounded text-xs capitalize transition-colors cursor-pointer ${
                  isActive
                    ? isTextClip && tab.id === 'text'
                      ? 'text-[#C084FC] bg-[#2E184D]'
                      : 'text-[#00F0FF] bg-[#1A1E27]'
                    : 'text-[#8A92A6] hover:text-[#F0F3F8]'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <button
          onClick={() => setIsCollapsed(true)}
          className="p-1 rounded hover:bg-[#222630] text-[#64748B] hover:text-[#F0F3F8] transition-colors cursor-pointer"
          title="Collapse Inspector"
        >
          <ChevronRight size={15} />
        </button>
      </div>

      {/* Main Inspector Scrollable Body */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5">
        {selectedClip ? (
          <>
            {/* Selected Clip Identification Header */}
            <div className="p-2.5 rounded bg-[#0D0E11] border border-[#222630] space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-[#64748B]">Selected Clip:</span>
                <span
                  className="font-mono font-bold text-[10px] px-1.5 py-0.2 rounded"
                  style={{
                    backgroundColor: `${parentTrack?.color || '#00F0FF'}20`,
                    color: parentTrack?.color || '#00F0FF',
                  }}
                >
                  {parentTrack?.name}
                </span>
              </div>
              <div className="text-xs font-semibold text-[#F0F3F8] truncate" title={selectedClip.name}>
                {selectedClip.name}
              </div>

              {/* Multicam Synchronization Status Badge */}
              <div className="flex items-center justify-between text-[11px] font-mono pt-1 border-t border-[#1C202B]">
                <div className="flex items-center gap-1">
                  <CheckCircle2
                    size={12}
                    className={selectedClip.synced ? 'text-[#10B981]' : 'text-[#64748B]'}
                  />
                  <span className={selectedClip.synced ? 'text-[#10B981]' : 'text-[#64748B]'}>
                    {selectedClip.synced ? 'Multicam Synced' : isTextClip ? 'Text / Title Layer' : 'Unsynchronized'}
                  </span>
                </div>
                {selectedClip.syncDeltaSeconds !== undefined && (
                  <span className="text-[#00F0FF] font-bold">
                    {formatDeltaSeconds(selectedClip.syncDeltaSeconds)}
                  </span>
                )}
              </div>
            </div>

            {/* TAB: TEXT / TYPOGRAPHY & TITLE STYLING */}
            {inspectorTab === 'text' && selectedClip && (
              <div className="space-y-3">
                {/* 1. Text Content Editor & Quick Style Presets - Open by default */}
                <div className="rounded-lg bg-[#0D0E11] border border-[#222630] overflow-hidden">
                  <div
                    onClick={() => toggleTextSection('content')}
                    className="p-3 flex items-center justify-between cursor-pointer hover:bg-[#14161F]/60 transition-colors select-none"
                  >
                    <div className="flex items-center gap-1.5 text-xs font-bold text-[#F0F3F8]">
                      <Type size={13} className="text-[#C084FC]" />
                      <span>Text & Title Content</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-[#C084FC] font-mono font-semibold bg-[#A855F7]/15 px-2 py-0.5 rounded">
                        {(selectedClip.durationSeconds || selectedClip.durationMs / 1000).toFixed(2)}s
                      </span>
                      <span className="text-[#8A92A6]">
                        {textSections.content ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </span>
                    </div>
                  </div>

                  {textSections.content && (
                    <div className="p-3 pt-0 border-t border-[#1C202B] space-y-3 mt-1">
                      <textarea
                        value={selectedClip.textContent ?? ''}
                        onChange={(e) => updateTextClipContent(selectedClip.id, e.target.value)}
                        placeholder="Enter caption or title text..."
                        rows={3}
                        className="w-full bg-[#14161B] border border-[#222630] rounded-md p-2.5 text-xs text-[#F0F3F8] placeholder-[#525D73] focus:outline-none focus:border-[#C084FC] resize-y font-medium transition-colors"
                      />

                      {/* Quick Style Presets */}
                      <div className="space-y-1.5 pt-1 border-t border-[#1C202B]">
                        <span className="text-[10px] text-[#8A92A6] font-semibold block">Quick Style Presets</span>
                        <div className="grid grid-cols-2 gap-1.5">
                          <button
                            onClick={() => applyTextPreset(selectedClip.id, 'youtube_lower_third')}
                            className="px-2.5 py-1.5 rounded bg-[#14161B] hover:bg-[#1A1E27] border border-[#222630] hover:border-[#EAB308]/50 text-left cursor-pointer transition-colors group"
                          >
                            <div className="text-[11px] font-bold text-[#F0F3F8] group-hover:text-[#EAB308]">
                              YouTube Lower-3rd
                            </div>
                            <div className="text-[9px] text-[#64748B]">Bold yellow/dark stroke</div>
                          </button>

                          <button
                            onClick={() => applyTextPreset(selectedClip.id, 'cinematic')}
                            className="px-2.5 py-1.5 rounded bg-[#14161B] hover:bg-[#1A1E27] border border-[#222630] hover:border-[#00F0FF]/50 text-left cursor-pointer transition-colors group"
                          >
                            <div className="text-[11px] font-bold text-[#F0F3F8] group-hover:text-[#00F0FF]">
                              Cinematic Subtitle
                            </div>
                            <div className="text-[9px] text-[#64748B]">Clean letterbox caption</div>
                          </button>

                          <button
                            onClick={() => applyTextPreset(selectedClip.id, 'karaoke')}
                            className="px-2.5 py-1.5 rounded bg-[#14161B] hover:bg-[#1A1E27] border border-[#222630] hover:border-[#10B981]/50 text-left cursor-pointer transition-colors group"
                          >
                            <div className="text-[11px] font-bold text-[#F0F3F8] group-hover:text-[#10B981]">
                              Karaoke Punch
                            </div>
                            <div className="text-[9px] text-[#64748B]">Vibrant neon outline</div>
                          </button>

                          <button
                            onClick={() => applyTextPreset(selectedClip.id, 'default')}
                            className="px-2.5 py-1.5 rounded bg-[#14161B] hover:bg-[#1A1E27] border border-[#222630] hover:border-[#A855F7]/50 text-left cursor-pointer transition-colors group"
                          >
                            <div className="text-[11px] font-bold text-[#F0F3F8] group-hover:text-[#A855F7]">
                              Clean Modern
                            </div>
                            <div className="text-[9px] text-[#64748B]">Minimalist center/lower</div>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. Typography & Font Settings - Collapsed by default */}
                <div className="rounded-lg bg-[#0D0E11] border border-[#222630] overflow-hidden">
                  <div
                    onClick={() => toggleTextSection('font')}
                    className="p-3 flex items-center justify-between cursor-pointer hover:bg-[#14161F]/60 transition-colors select-none"
                  >
                    <div className="flex items-center gap-1.5 text-xs font-bold text-[#F0F3F8]">
                      <SlidersHorizontal size={13} className="text-[#C084FC]" />
                      <span>Typography & Font</span>
                    </div>
                    <span className="text-[#8A92A6]">
                      {textSections.font ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </span>
                  </div>

                  {textSections.font && (
                    <div className="p-3 pt-0 border-t border-[#1C202B] space-y-3 mt-1">
                      {/* Font Family */}
                      <div className="space-y-1">
                        <span className="text-[10px] text-[#64748B] block">Font Family</span>
                        <select
                          value={textStyle.fontFamily || 'Inter'}
                          onChange={(e) => updateTextClipStyle(selectedClip.id, { fontFamily: e.target.value })}
                          className="w-full bg-[#14161B] border border-[#222630] rounded px-2.5 py-1 text-xs text-[#F0F3F8] focus:outline-none focus:border-[#C084FC] cursor-pointer"
                        >
                          {['Inter', 'Roboto', 'Arial', 'Montserrat', 'Helvetica', 'Times New Roman', 'Impact', 'Courier New', 'JetBrains Mono'].map((font) => (
                            <option key={font} value={font} style={{ fontFamily: font }}>
                              {font}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Font Size & Weight */}
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[10px]">
                            <span className="text-[#64748B]">Size</span>
                            <span className="font-mono text-[#F0F3F8]">{textStyle.fontSize || 36}px</span>
                          </div>
                          <input
                            type="range"
                            min="12"
                            max="120"
                            step="1"
                            value={textStyle.fontSize || 36}
                            onChange={(e) => updateTextClipStyle(selectedClip.id, { fontSize: Number(e.target.value) })}
                            className="w-full accent-[#C084FC] h-1.5 bg-[#222630] rounded cursor-pointer"
                          />
                        </div>

                        <div className="space-y-1">
                          <span className="text-[10px] text-[#64748B] block">Weight</span>
                          <select
                            value={textStyle.fontWeight || 'bold'}
                            onChange={(e) => updateTextClipStyle(selectedClip.id, { fontWeight: e.target.value })}
                            className="w-full bg-[#14161B] border border-[#222630] rounded px-2 py-1 text-xs text-[#F0F3F8] focus:outline-none focus:border-[#C084FC] cursor-pointer"
                          >
                            <option value="300">Light (300)</option>
                            <option value="normal">Regular (400)</option>
                            <option value="500">Medium (500)</option>
                            <option value="600">Semi-Bold (600)</option>
                            <option value="bold">Bold (700)</option>
                            <option value="900">Black (900)</option>
                          </select>
                        </div>
                      </div>

                      {/* Line Height */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="text-[#64748B]">Line Height</span>
                          <span className="font-mono text-[#F0F3F8]">{(textStyle.lineHeight || 1.2).toFixed(1)}x</span>
                        </div>
                        <input
                          type="range"
                          min="0.8"
                          max="2.5"
                          step="0.05"
                          value={textStyle.lineHeight || 1.2}
                          onChange={(e) => updateTextClipStyle(selectedClip.id, { lineHeight: Number(e.target.value) })}
                          className="w-full accent-[#C084FC] h-1.5 bg-[#222630] rounded cursor-pointer"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* 3. Colors, Stroke & Box Background - Collapsed by default */}
                <div className="rounded-lg bg-[#0D0E11] border border-[#222630] overflow-hidden">
                  <div
                    onClick={() => toggleTextSection('colors')}
                    className="p-3 flex items-center justify-between cursor-pointer hover:bg-[#14161F]/60 transition-colors select-none"
                  >
                    <div className="flex items-center gap-1.5 text-xs font-bold text-[#F0F3F8]">
                      <Palette size={13} className="text-[#00F0FF]" />
                      <span>Colors & Appearance</span>
                    </div>
                    <span className="text-[#8A92A6]">
                      {textSections.colors ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </span>
                  </div>

                  {textSections.colors && (
                    <div className="p-3 pt-0 border-t border-[#1C202B] space-y-3 mt-1">
                      {/* Text Color Fill */}
                      <div className="space-y-1">
                        <span className="text-[10px] text-[#64748B] block">Fill Color</span>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={textStyle.fontColor?.startsWith('#') ? textStyle.fontColor : '#FFFFFF'}
                            onChange={(e) => updateTextClipStyle(selectedClip.id, { fontColor: e.target.value })}
                            className="w-7 h-7 rounded border border-[#222630] bg-transparent cursor-pointer"
                          />
                          <input
                            type="text"
                            value={textStyle.fontColor || '#FFFFFF'}
                            onChange={(e) => updateTextClipStyle(selectedClip.id, { fontColor: e.target.value })}
                            className="flex-1 bg-[#14161B] border border-[#222630] rounded px-2 py-1 text-xs font-mono text-[#F0F3F8] focus:outline-none focus:border-[#C084FC]"
                          />
                        </div>
                      </div>

                      {/* Text Stroke / Border */}
                      <div className="space-y-2 pt-2 border-t border-[#1C202B]">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-semibold text-[#F0F3F8]">Text Outline / Stroke</span>
                          <span className="font-mono text-[10px] text-[#64748B]">{textStyle.strokeWidth || 0}px</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={textStyle.strokeColor?.startsWith('#') ? textStyle.strokeColor : '#000000'}
                            onChange={(e) => updateTextClipStyle(selectedClip.id, { strokeColor: e.target.value })}
                            className="w-7 h-7 rounded border border-[#222630] bg-transparent cursor-pointer"
                          />
                          <input
                            type="range"
                            min="0"
                            max="10"
                            step="0.5"
                            value={textStyle.strokeWidth || 0}
                            onChange={(e) => updateTextClipStyle(selectedClip.id, { strokeWidth: Number(e.target.value) })}
                            className="flex-1 accent-[#C084FC] h-1.5 bg-[#222630] rounded cursor-pointer"
                          />
                        </div>
                      </div>

                      {/* Background Box */}
                      <div className="space-y-2 pt-2 border-t border-[#1C202B]">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-semibold text-[#F0F3F8]">Background Banner Box</span>
                          <label className="flex items-center gap-1.5 text-[10px] text-[#64748B] cursor-pointer">
                            <input
                              type="checkbox"
                              checked={Boolean(textStyle.backgroundColor && textStyle.backgroundColor !== 'transparent')}
                              onChange={(e) =>
                                updateTextClipStyle(selectedClip.id, {
                                  backgroundColor: e.target.checked ? 'rgba(0,0,0,0.75)' : 'transparent',
                                  backgroundPadding: e.target.checked ? 10 : 0,
                                })
                              }
                              className="rounded border-[#222630] accent-[#C084FC]"
                            />
                            <span>Enable Box</span>
                          </label>
                        </div>

                        {Boolean(textStyle.backgroundColor && textStyle.backgroundColor !== 'transparent') && (
                          <div className="space-y-2 p-2 rounded bg-[#14161B] border border-[#222630]">
                            <div className="flex items-center gap-2">
                              <input
                                type="color"
                                value={textStyle.backgroundColor?.startsWith('#') ? textStyle.backgroundColor : '#000000'}
                                onChange={(e) => updateTextClipStyle(selectedClip.id, { backgroundColor: e.target.value })}
                                className="w-6 h-6 rounded border border-[#222630] bg-transparent cursor-pointer"
                              />
                              <input
                                type="text"
                                value={textStyle.backgroundColor}
                                onChange={(e) => updateTextClipStyle(selectedClip.id, { backgroundColor: e.target.value })}
                                className="flex-1 bg-[#0D0E11] border border-[#222630] rounded px-2 py-0.5 text-[10px] font-mono text-[#F0F3F8]"
                              />
                            </div>
                            <div className="space-y-1">
                              <div className="flex items-center justify-between text-[10px]">
                                <span className="text-[#64748B]">Box Padding</span>
                                <span className="font-mono text-[#F0F3F8]">{textStyle.backgroundPadding || 8}px</span>
                              </div>
                              <input
                                type="range"
                                min="0"
                                max="30"
                                step="1"
                                value={textStyle.backgroundPadding || 8}
                                onChange={(e) => updateTextClipStyle(selectedClip.id, { backgroundPadding: Number(e.target.value) })}
                                className="w-full accent-[#C084FC] h-1.5 bg-[#222630] rounded cursor-pointer"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* 4. Positioning & Alignment - Collapsed by default */}
                <div className="rounded-lg bg-[#0D0E11] border border-[#222630] overflow-hidden">
                  <div
                    onClick={() => toggleTextSection('alignment')}
                    className="p-3 flex items-center justify-between cursor-pointer hover:bg-[#14161F]/60 transition-colors select-none"
                  >
                    <div className="flex items-center gap-1.5 text-xs font-bold text-[#F0F3F8]">
                      <Move size={13} className="text-[#00F0FF]" />
                      <span>Canvas Position & Alignment</span>
                    </div>
                    <span className="text-[#8A92A6]">
                      {textSections.alignment ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </span>
                  </div>

                  {textSections.alignment && (
                    <div className="p-3 pt-0 border-t border-[#1C202B] space-y-3 mt-1">
                      {/* Text Alignment */}
                      <div className="space-y-1">
                        <span className="text-[10px] text-[#64748B] block">Text Alignment</span>
                        <div className="grid grid-cols-3 gap-1 bg-[#14161B] p-1 rounded border border-[#222630]">
                          {(['left', 'center', 'right'] as const).map((align) => (
                            <button
                              key={align}
                              onClick={() => updateTextClipStyle(selectedClip.id, { alignment: align })}
                              className={`flex items-center justify-center py-1 rounded text-xs transition-colors cursor-pointer ${
                                (textStyle.alignment || 'center') === align
                                  ? 'bg-[#C084FC] text-black font-bold'
                                  : 'text-[#8A92A6] hover:text-[#F0F3F8] hover:bg-[#222630]'
                              }`}
                            >
                              {align === 'left' && <AlignLeft size={13} />}
                              {align === 'center' && <AlignCenter size={13} />}
                              {align === 'right' && <AlignRight size={13} />}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Alignment Presets */}
                      <div className="space-y-1">
                        <span className="text-[10px] text-[#64748B] block">Position Presets</span>
                        <div className="grid grid-cols-2 gap-1.5">
                          <button
                            onClick={() =>
                              updateTextClipStyle(selectedClip.id, {
                                positionX: 0.1,
                                positionY: 0.15,
                                alignment: 'left',
                              })
                            }
                            className="px-2 py-1 text-[11px] rounded bg-[#14161B] border border-[#222630] hover:border-[#C084FC] text-[#8A92A6] hover:text-[#F0F3F8] cursor-pointer transition-colors"
                          >
                            Top-Left
                          </button>
                          <button
                            onClick={() =>
                              updateTextClipStyle(selectedClip.id, {
                                positionX: 0.5,
                                positionY: 0.5,
                                alignment: 'center',
                              })
                            }
                            className="px-2 py-1 text-[11px] rounded bg-[#14161B] border border-[#222630] hover:border-[#C084FC] text-[#8A92A6] hover:text-[#F0F3F8] cursor-pointer transition-colors"
                          >
                            Center Screen
                          </button>
                          <button
                            onClick={() =>
                              updateTextClipStyle(selectedClip.id, {
                                positionX: 0.1,
                                positionY: 0.82,
                                alignment: 'left',
                              })
                            }
                            className="px-2 py-1 text-[11px] rounded bg-[#14161B] border border-[#222630] hover:border-[#C084FC] text-[#8A92A6] hover:text-[#F0F3F8] cursor-pointer transition-colors"
                          >
                            Lower-Third
                          </button>
                          <button
                            onClick={() =>
                              updateTextClipStyle(selectedClip.id, {
                                positionX: 0.5,
                                positionY: 0.88,
                                alignment: 'center',
                              })
                            }
                            className="px-2 py-1 text-[11px] rounded bg-[#14161B] border border-[#222630] hover:border-[#C084FC] text-[#8A92A6] hover:text-[#F0F3F8] cursor-pointer transition-colors"
                          >
                            Bottom-Center
                          </button>
                        </div>
                      </div>

                      {/* Position X Slider */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="text-[#64748B]">Horizontal X</span>
                          <span className="font-mono text-[#F0F3F8]">{Math.round((textStyle.positionX ?? 0.5) * 100)}%</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.01"
                          value={textStyle.positionX ?? 0.5}
                          onChange={(e) => updateTextClipStyle(selectedClip.id, { positionX: Number(e.target.value) })}
                          className="w-full accent-[#C084FC] h-1.5 bg-[#222630] rounded cursor-pointer"
                        />
                      </div>

                      {/* Position Y Slider */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="text-[#64748B]">Vertical Y</span>
                          <span className="font-mono text-[#F0F3F8]">{Math.round((textStyle.positionY ?? 0.85) * 100)}%</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.01"
                          value={textStyle.positionY ?? 0.85}
                          onChange={(e) => updateTextClipStyle(selectedClip.id, { positionY: Number(e.target.value) })}
                          className="w-full accent-[#C084FC] h-1.5 bg-[#222630] rounded cursor-pointer"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* 5. Captions Transcript Side-List - Collapsed by default */}
                <div className="rounded-lg bg-[#0D0E11] border border-[#222630] overflow-hidden">
                  <div
                    onClick={() => toggleTextSection('transcript')}
                    className="p-3 flex items-center justify-between cursor-pointer hover:bg-[#14161F]/60 transition-colors select-none"
                  >
                    <div className="flex items-center gap-1.5 text-xs font-bold text-[#F0F3F8]">
                      <Subtitles size={13} className="text-[#C084FC]" />
                      <span>Captions Transcript</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-[#64748B] font-mono">
                        {parentTrack ? `${parentTrack.clips.length} segments` : ''}
                      </span>
                      <span className="text-[#8A92A6]">
                        {textSections.transcript ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </span>
                    </div>
                  </div>

                  {textSections.transcript && (
                    <div className="p-3 pt-0 border-t border-[#1C202B] space-y-2 mt-1">
                      {parentTrack && parentTrack.clips.length > 0 ? (
                        <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
                          {parentTrack.clips
                            .slice()
                            .sort((a, b) => (a.startPositionSeconds ?? a.startTimeMs / 1000) - (b.startPositionSeconds ?? b.startTimeMs / 1000))
                            .map((clip) => {
                              const isCurrent = clip.id === selectedClip.id;
                              const startSec = clip.startPositionSeconds ?? clip.startTimeMs / 1000;
                              const endSec = startSec + (clip.durationSeconds ?? clip.durationMs / 1000);
                              return (
                                <div
                                  key={clip.id}
                                  onClick={() => {
                                    selectClip(clip.id);
                                    setPlayhead(startSec);
                                  }}
                                  className={`p-2 rounded border text-left cursor-pointer transition-colors ${
                                    isCurrent
                                      ? 'bg-[#A855F7]/15 border-[#C084FC] text-[#F0F3F8]'
                                      : 'bg-[#14161B] border-[#222630] hover:border-[#384152] text-[#8A92A6]'
                                  }`}
                                >
                                  <div className="flex items-center justify-between text-[10px] font-mono mb-1">
                                    <span className={isCurrent ? 'text-[#C084FC] font-bold' : 'text-[#64748B]'}>
                                      {startSec.toFixed(2)}s – {endSec.toFixed(2)}s
                                    </span>
                                    {isCurrent && (
                                      <span className="text-[9px] bg-[#C084FC] text-black px-1 py-0.2 rounded font-bold">
                                        ACTIVE
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[11px] truncate font-medium">
                                    {clip.textContent || clip.name || 'Empty text block'}
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      ) : (
                        <div className="text-[11px] text-[#64748B] text-center py-2">
                          No caption segments found on this track.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB: VIDEO (Clip Properties, In/Out Points, Proxy Status) */}
            {inspectorTab === 'video' && (
              <div className="space-y-3">
                {/* 1. Video Properties - Open by default */}
                <div className="rounded-lg bg-[#0D0E11] border border-[#222630] overflow-hidden">
                  <div
                    onClick={() => toggleVideoSection('properties')}
                    className="p-3 flex items-center justify-between cursor-pointer hover:bg-[#14161F]/60 transition-colors select-none"
                  >
                    <div className="flex items-center gap-1.5 text-xs font-bold text-[#F0F3F8]">
                      <Film size={13} className="text-[#00F0FF]" />
                      <span>Video Properties</span>
                    </div>
                    <span className="text-[#8A92A6]">
                      {videoSections.properties ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </span>
                  </div>

                  {videoSections.properties && (
                    <div className="p-3 pt-0 border-t border-[#1C202B] space-y-2.5 mt-1">
                      <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                        <div className="p-2 rounded bg-[#14161B] border border-[#222630]">
                          <span className="text-[#64748B] block text-[10px]">Duration</span>
                          <span className="text-[#F0F3F8] font-bold">
                            {(selectedClip.durationSeconds || selectedClip.durationMs / 1000).toFixed(2)}s
                          </span>
                        </div>

                        <div className="p-2 rounded bg-[#14161B] border border-[#222630]">
                          <span className="text-[#64748B] block text-[10px]">Resolution</span>
                          <span className="text-[#F0F3F8] font-bold">
                            {selectedClip.metadata?.width && selectedClip.metadata?.height
                              ? `${selectedClip.metadata.width}x${selectedClip.metadata.height}`
                              : '1920x1080'}
                          </span>
                        </div>

                        <div className="p-2 rounded bg-[#14161B] border border-[#222630]">
                          <span className="text-[#64748B] block text-[10px]">In Point</span>
                          <span className="text-[#F0F3F8] font-bold">
                            {(selectedClip.inPointSeconds || 0).toFixed(2)}s
                          </span>
                        </div>

                        <div className="p-2 rounded bg-[#14161B] border border-[#222630]">
                          <span className="text-[#64748B] block text-[10px]">Out Point</span>
                          <span className="text-[#F0F3F8] font-bold">
                            {(
                              selectedClip.outPointSeconds ||
                              selectedClip.durationSeconds ||
                              selectedClip.durationMs / 1000
                            ).toFixed(2)}s
                          </span>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-[#1C202B] space-y-1">
                        <span className="text-[#64748B] text-[10px] block font-mono">File Path</span>
                        <span className="text-[#8A92A6] text-[10px] font-mono break-all leading-tight block">
                          {selectedClip.filePath}
                        </span>
                      </div>

                      {/* Proxy workflow badge & status */}
                      <div className="pt-2 border-t border-[#1C202B] flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Zap size={12} className={selectedClip.hasProxy ? 'text-[#10B981]' : 'text-[#64748B]'} />
                          <span className="text-xs text-[#8A92A6]">Editing Proxy:</span>
                        </div>
                        {selectedClip.hasProxy ? (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30">
                            Active (PROX)
                          </span>
                        ) : (
                          <span className="text-[10px] font-mono text-[#64748B]">Original Full-Res</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. Motion Transform Controls - Collapsed by default */}
                <div className="rounded-lg bg-[#0D0E11] border border-[#222630] overflow-hidden">
                  <div
                    onClick={() => toggleVideoSection('transform')}
                    className="p-3 flex items-center justify-between cursor-pointer hover:bg-[#14161F]/60 transition-colors select-none"
                  >
                    <span className="text-xs font-bold text-[#F0F3F8] flex items-center gap-1.5">
                      <Move size={13} className="text-[#00F0FF]" />
                      <span>Motion & Transform</span>
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleResetTransform();
                        }}
                        title="Reset all transforms to default"
                        className="px-2 py-0.5 rounded bg-[#181B24] hover:bg-[#202532] text-[#8A92A6] hover:text-[#00F0FF] text-[10px] font-mono flex items-center gap-1 transition-colors cursor-pointer border border-[#222630]"
                      >
                        <RotateCcw size={10} />
                        <span>Reset</span>
                      </button>
                      <span className="text-[#8A92A6]">
                        {videoSections.transform ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </span>
                    </div>
                  </div>

                  {videoSections.transform && (
                    <div className="p-3 pt-0 border-t border-[#1C202B] space-y-3 mt-1">

                  {/* MASTER GLOBAL KEYFRAME CONTROLLER BAR */}
                  <div className="p-2.5 rounded-lg bg-[#14161B] border border-[#222630] space-y-2">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-[#8A92A6] font-medium flex items-center gap-1.5">
                        <Diamond
                          size={11}
                          className={hasKeyframeAtPlayhead ? 'text-[#00F0FF]' : 'text-[#64748B]'}
                          fill={hasKeyframeAtPlayhead ? 'currentColor' : 'none'}
                        />
                        <span>Master Keyframe</span>
                      </span>
                      <span className="font-mono text-[10px] text-[#64748B]">
                        {keyframeTimes.length > 0
                          ? `${keyframeTimes.length} Keyframe Timestamp${keyframeTimes.length > 1 ? 's' : ''}`
                          : 'No Keyframes (Static)'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-1.5">
                      {/* Jump Previous Keyframe */}
                      <button
                        onClick={handleJumpToPrevKeyframe}
                        disabled={prevKfTime === undefined}
                        title={
                          prevKfTime !== undefined
                            ? `Jump to Previous Keyframe at ${prevKfTime.toFixed(2)}s`
                            : 'No previous keyframe'
                        }
                        className="p-1.5 rounded bg-[#1C202B] hover:bg-[#252B3A] text-[#8A92A6] hover:text-[#00F0FF] disabled:text-[#3E4554] disabled:cursor-not-allowed border border-[#222630] transition-colors cursor-pointer"
                      >
                        <ChevronLeft size={13} />
                      </button>

                      {/* Master Global Keyframe Toggle Button */}
                      <button
                        onClick={handleToggleGlobalKeyframe}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded text-xs font-bold transition-all cursor-pointer border ${
                          hasKeyframeAtPlayhead && allPropertiesKeyframed
                            ? 'bg-[#00F0FF]/20 text-[#00F0FF] border-[#00F0FF]/60 shadow-[0_0_10px_rgba(0,240,255,0.35)]'
                            : hasKeyframeAtPlayhead
                            ? 'bg-[#00F0FF]/15 text-[#00F0FF] border-[#00F0FF]/40'
                            : keyframeTimes.length > 0
                            ? 'bg-[#1C202B] hover:bg-[#252B3A] text-[#F0F3F8] hover:text-[#00F0FF] border-[#222630] hover:border-[#00F0FF]/50'
                            : 'bg-[#00F0FF]/10 hover:bg-[#00F0FF]/20 text-[#00F0FF] border-[#00F0FF]/30'
                        }`}
                        title={
                          hasKeyframeAtPlayhead && allPropertiesKeyframed
                            ? `Remove All Keyframes at ${currentKfTime?.toFixed(2)}s`
                            : hasKeyframeAtPlayhead
                            ? `Complete Master Keyframe at ${currentRelTime.toFixed(2)}s (${activePropertyKeyframeCount}/5 active)`
                            : `Add Master Keyframe at ${currentRelTime.toFixed(2)}s (Records all 5 options)`
                        }
                      >
                        <Diamond
                          size={13}
                          fill={hasKeyframeAtPlayhead ? 'currentColor' : 'none'}
                          className={hasKeyframeAtPlayhead ? 'text-[#00F0FF]' : 'text-[#8A92A6]'}
                        />
                        <span>
                          {hasKeyframeAtPlayhead && allPropertiesKeyframed
                            ? `Master Active (${currentKfTime?.toFixed(2)}s)`
                            : hasKeyframeAtPlayhead
                            ? `Partial (${activePropertyKeyframeCount}/5) • Click for Master`
                            : 'Add Master Keyframe (All)'}
                        </span>
                      </button>

                      {/* Jump Next Keyframe */}
                      <button
                        onClick={handleJumpToNextKeyframe}
                        disabled={nextKfTime === undefined}
                        title={
                          nextKfTime !== undefined
                            ? `Jump to Next Keyframe at ${nextKfTime.toFixed(2)}s`
                            : 'No next keyframe'
                        }
                        className="p-1.5 rounded bg-[#1C202B] hover:bg-[#252B3A] text-[#8A92A6] hover:text-[#00F0FF] disabled:text-[#3E4554] disabled:cursor-not-allowed border border-[#222630] transition-colors cursor-pointer"
                      >
                        <ChevronRight size={13} />
                      </button>
                    </div>

                    {keyframeTimes.length > 0 && (
                      <div className="flex items-center justify-between pt-1 border-t border-[#1C202B] text-[10px]">
                        <span className="text-[#64748B]">
                          {hasKeyframeAtPlayhead
                            ? '⚡ Sliders update keyframe at playhead'
                            : 'Moving sliders records keyframe'}
                        </span>
                        <button
                          onClick={() => clearAllKeyframes(selectedClip.id)}
                          className="text-[#64748B] hover:text-red-400 underline transition-colors cursor-pointer"
                          title="Remove all transform keyframes from this clip"
                        >
                          Clear All
                        </button>
                      </div>
                    )}
                  </div>

                  {/* 1. Scale */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleTogglePropertyKeyframe('scale', currentTransform.scale)}
                          title={
                            hasPropertyKeyframe('scale')
                              ? `Remove Scale Keyframe at ${currentRelTime.toFixed(2)}s`
                              : `Add Scale Keyframe at ${currentRelTime.toFixed(2)}s (overrides master)`
                          }
                          className={`p-1 rounded transition-all cursor-pointer ${
                            hasPropertyKeyframe('scale')
                              ? 'text-[#00F0FF] bg-[#00F0FF]/20 shadow-[0_0_6px_rgba(0,240,255,0.4)]'
                              : 'text-[#64748B] hover:text-[#00F0FF] hover:bg-[#1C202B]'
                          }`}
                        >
                          <Diamond size={10} fill={hasPropertyKeyframe('scale') ? 'currentColor' : 'none'} />
                        </button>
                        <span className="text-[#8A92A6] flex items-center gap-1">
                          <Maximize2 size={11} className="text-[#64748B]" />
                          <span>Scale</span>
                        </span>
                      </div>
                      <button
                        onClick={() => updateClipTransform(selectedClip.id, { scale: 1.0 })}
                        title="Reset scale to 1.0x"
                        className="font-mono text-[#F0F3F8] hover:text-[#00F0FF] text-[10px] cursor-pointer"
                      >
                        {currentTransform.scale.toFixed(2)}x
                      </button>
                    </div>
                    <input
                      type="range"
                      min={0.1}
                      max={3.0}
                      step={0.05}
                      value={currentTransform.scale}
                      onChange={(e) => updateClipTransform(selectedClip.id, { scale: Number(e.target.value) })}
                      className="w-full h-1 bg-[#1A1E27] rounded-lg appearance-none cursor-pointer accent-[#00F0FF]"
                    />
                  </div>

                  {/* 2. Position X */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleTogglePropertyKeyframe('position_x', currentTransform.positionX)}
                          title={
                            hasPropertyKeyframe('position_x')
                              ? `Remove Position X Keyframe at ${currentRelTime.toFixed(2)}s`
                              : `Add Position X Keyframe at ${currentRelTime.toFixed(2)}s (overrides master)`
                          }
                          className={`p-1 rounded transition-all cursor-pointer ${
                            hasPropertyKeyframe('position_x')
                              ? 'text-[#00F0FF] bg-[#00F0FF]/20 shadow-[0_0_6px_rgba(0,240,255,0.4)]'
                              : 'text-[#64748B] hover:text-[#00F0FF] hover:bg-[#1C202B]'
                          }`}
                        >
                          <Diamond size={10} fill={hasPropertyKeyframe('position_x') ? 'currentColor' : 'none'} />
                        </button>
                        <span className="text-[#8A92A6] flex items-center gap-1">
                          <span>Position X</span>
                        </span>
                      </div>
                      <button
                        onClick={() => updateClipTransform(selectedClip.id, { positionX: 0 })}
                        title="Reset Position X to 0"
                        className="font-mono text-[#F0F3F8] hover:text-[#00F0FF] text-[10px] cursor-pointer"
                      >
                        {Math.round(currentTransform.positionX)} px
                      </button>
                    </div>
                    <input
                      type="range"
                      min={-1000}
                      max={1000}
                      step={2}
                      value={currentTransform.positionX}
                      onChange={(e) => updateClipTransform(selectedClip.id, { positionX: Number(e.target.value) })}
                      className="w-full h-1 bg-[#1A1E27] rounded-lg appearance-none cursor-pointer accent-[#00F0FF]"
                    />
                  </div>

                  {/* 3. Position Y */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleTogglePropertyKeyframe('position_y', currentTransform.positionY)}
                          title={
                            hasPropertyKeyframe('position_y')
                              ? `Remove Position Y Keyframe at ${currentRelTime.toFixed(2)}s`
                              : `Add Position Y Keyframe at ${currentRelTime.toFixed(2)}s (overrides master)`
                          }
                          className={`p-1 rounded transition-all cursor-pointer ${
                            hasPropertyKeyframe('position_y')
                              ? 'text-[#00F0FF] bg-[#00F0FF]/20 shadow-[0_0_6px_rgba(0,240,255,0.4)]'
                              : 'text-[#64748B] hover:text-[#00F0FF] hover:bg-[#1C202B]'
                          }`}
                        >
                          <Diamond size={10} fill={hasPropertyKeyframe('position_y') ? 'currentColor' : 'none'} />
                        </button>
                        <span className="text-[#8A92A6] flex items-center gap-1">
                          <span>Position Y</span>
                        </span>
                      </div>
                      <button
                        onClick={() => updateClipTransform(selectedClip.id, { positionY: 0 })}
                        title="Reset Position Y to 0"
                        className="font-mono text-[#F0F3F8] hover:text-[#00F0FF] text-[10px] cursor-pointer"
                      >
                        {Math.round(currentTransform.positionY)} px
                      </button>
                    </div>
                    <input
                      type="range"
                      min={-1000}
                      max={1000}
                      step={2}
                      value={currentTransform.positionY}
                      onChange={(e) => updateClipTransform(selectedClip.id, { positionY: Number(e.target.value) })}
                      className="w-full h-1 bg-[#1A1E27] rounded-lg appearance-none cursor-pointer accent-[#00F0FF]"
                    />
                  </div>

                  {/* 4. Rotation */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleTogglePropertyKeyframe('rotation', currentTransform.rotation)}
                          title={
                            hasPropertyKeyframe('rotation')
                              ? `Remove Rotation Keyframe at ${currentRelTime.toFixed(2)}s`
                              : `Add Rotation Keyframe at ${currentRelTime.toFixed(2)}s (overrides master)`
                          }
                          className={`p-1 rounded transition-all cursor-pointer ${
                            hasPropertyKeyframe('rotation')
                              ? 'text-[#00F0FF] bg-[#00F0FF]/20 shadow-[0_0_6px_rgba(0,240,255,0.4)]'
                              : 'text-[#64748B] hover:text-[#00F0FF] hover:bg-[#1C202B]'
                          }`}
                        >
                          <Diamond size={10} fill={hasPropertyKeyframe('rotation') ? 'currentColor' : 'none'} />
                        </button>
                        <span className="text-[#8A92A6] flex items-center gap-1">
                          <RotateCw size={11} className="text-[#64748B]" />
                          <span>Rotation</span>
                        </span>
                      </div>
                      <button
                        onClick={() => updateClipTransform(selectedClip.id, { rotation: 0 })}
                        title="Reset Rotation to 0°"
                        className="font-mono text-[#F0F3F8] hover:text-[#00F0FF] text-[10px] cursor-pointer"
                      >
                        {Math.round(currentTransform.rotation)}°
                      </button>
                    </div>
                    <input
                      type="range"
                      min={-360}
                      max={360}
                      step={1}
                      value={currentTransform.rotation}
                      onChange={(e) => updateClipTransform(selectedClip.id, { rotation: Number(e.target.value) })}
                      className="w-full h-1 bg-[#1A1E27] rounded-lg appearance-none cursor-pointer accent-[#00F0FF]"
                    />
                  </div>

                  {/* 5. Opacity */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleTogglePropertyKeyframe('opacity', currentTransform.opacity)}
                          title={
                            hasPropertyKeyframe('opacity')
                              ? `Remove Opacity Keyframe at ${currentRelTime.toFixed(2)}s`
                              : `Add Opacity Keyframe at ${currentRelTime.toFixed(2)}s (overrides master)`
                          }
                          className={`p-1 rounded transition-all cursor-pointer ${
                            hasPropertyKeyframe('opacity')
                              ? 'text-[#00F0FF] bg-[#00F0FF]/20 shadow-[0_0_6px_rgba(0,240,255,0.4)]'
                              : 'text-[#64748B] hover:text-[#00F0FF] hover:bg-[#1C202B]'
                          }`}
                        >
                          <Diamond size={10} fill={hasPropertyKeyframe('opacity') ? 'currentColor' : 'none'} />
                        </button>
                        <span className="text-[#8A92A6] flex items-center gap-1">
                          <Eye size={11} className="text-[#64748B]" />
                          <span>Opacity</span>
                        </span>
                      </div>
                      <button
                        onClick={() => updateClipTransform(selectedClip.id, { opacity: 1.0 })}
                        title="Reset Opacity to 100%"
                        className="font-mono text-[#F0F3F8] hover:text-[#00F0FF] text-[10px] cursor-pointer"
                      >
                        {Math.round(currentTransform.opacity * 100)}%
                      </button>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={1.0}
                      step={0.01}
                      value={currentTransform.opacity}
                      onChange={(e) => updateClipTransform(selectedClip.id, { opacity: Number(e.target.value) })}
                      className="w-full h-1 bg-[#1A1E27] rounded-lg appearance-none cursor-pointer accent-[#00F0FF]"
                    />
                  </div>
                </div>
              )}
            </div>

          {/* 3. Lens / Optical Effects Section - Collapsed by default */}
          <div className="rounded-lg bg-[#0D0E11] border border-[#222630] overflow-hidden">
            <div
              onClick={() => toggleVideoSection('lens')}
              className="p-3 flex items-center justify-between cursor-pointer hover:bg-[#14161F]/60 transition-colors select-none"
            >
              <span className="text-xs font-bold text-[#F0F3F8] flex items-center gap-1.5">
                <Camera size={13} className="text-[#A855F7]" />
                <span>Lens & Optical Effects</span>
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleResetLens();
                  }}
                  title="Reset lens effects"
                  className="px-2 py-0.5 rounded bg-[#181B24] hover:bg-[#202532] text-[#8A92A6] hover:text-[#A855F7] text-[10px] font-mono flex items-center gap-1 transition-colors cursor-pointer border border-[#222630]"
                >
                  <RotateCcw size={10} />
                  <span>Reset</span>
                </button>
                <span className="text-[#8A92A6]">
                  {videoSections.lens ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </span>
              </div>
            </div>

            {videoSections.lens && (
              <div className="p-3 pt-0 border-t border-[#1C202B] space-y-3 mt-1">
                {/* Action-Cam Defish */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <label className="flex items-center gap-2 cursor-pointer text-[#F0F3F8]">
                      <input
                        type="checkbox"
                        checked={currentDefish}
                        onChange={(e) => updateClipLensEffects(selectedClip.id, { defishEnabled: e.target.checked })}
                        className="rounded border-[#222630] accent-[#A855F7]"
                      />
                      <span>Action-Cam Defish</span>
                    </label>
                    <span className="font-mono text-[#A855F7] text-[10px]">{currentDefishStrength}</span>
                  </div>
                  <input
                    type="range"
                    min={-100}
                    max={100}
                    step={1}
                    disabled={!currentDefish}
                    value={currentDefishStrength}
                    onChange={(e) =>
                      updateClipLensEffects(selectedClip.id, { defishStrength: Number(e.target.value) / 100 })
                    }
                    className="w-full h-1 bg-[#1A1E27] rounded-lg appearance-none cursor-pointer accent-[#A855F7] disabled:opacity-40"
                  />
                </div>

                {/* Gaussian Blur */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-[#8A92A6]">Background Blur</span>
                    <span className="font-mono text-[#F0F3F8] text-[10px]">{currentBlur.toFixed(1)} px</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={50}
                    step={0.5}
                    value={currentBlur}
                    onChange={(e) => updateClipLensEffects(selectedClip.id, { gaussianBlur: Number(e.target.value) })}
                    className="w-full h-1 bg-[#1A1E27] rounded-lg appearance-none cursor-pointer accent-[#A855F7]"
                  />
                </div>
              </div>
            )}
          </div>

          {/* 4. Video Stabilization Module - Collapsed by default */}
          <div className="rounded-lg bg-[#0D0E11] border border-[#222630] overflow-hidden">
            {/* Collapsible Header */}
            <div
              onClick={() => toggleVideoSection('stabilization')}
              className="p-3 flex items-center justify-between cursor-pointer hover:bg-[#14161F]/60 transition-colors select-none"
            >
              <span className="text-xs font-bold text-[#F0F3F8] flex items-center gap-1.5">
                <Shield size={13} className="text-[#00F0FF]" />
                <span>Video Stabilization</span>
                {currentStabEnabled && (
                  <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-[#00F0FF]/15 text-[#00F0FF] border border-[#00F0FF]/30 ml-1">
                    {isStabilized ? 'STABILIZED' : isClipAnalyzing ? 'ANALYZING' : 'ENABLED'}
                  </span>
                )}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleResetStabilization();
                  }}
                  title="Reset video stabilization"
                  className="px-2 py-0.5 rounded bg-[#181B24] hover:bg-[#202532] text-[#8A92A6] hover:text-[#00F0FF] text-[10px] font-mono flex items-center gap-1 transition-colors cursor-pointer border border-[#222630]"
                >
                  <RotateCcw size={10} />
                  <span>Reset</span>
                </button>
                <span className="text-[#8A92A6]">
                  {videoSections.stabilization ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </span>
              </div>
            </div>

            {videoSections.stabilization && (
                    <div className="p-3 pt-0 border-t border-[#1C202B] space-y-3 mt-1">
                      {/* Telemetry Sensor Header Pill Badge */}
                      <div className="pt-2">
                        {hasGyroData ? (
                          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-[#00F0FF]/10 border border-[#00F0FF]/30 text-[#00F0FF] text-[11px] font-mono">
                            <Compass size={13} className="text-[#00F0FF] shrink-0 animate-pulse" />
                            <span className="font-semibold">[ 🧭 Action Cam Gyro Detected ]</span>
                            <span className="text-[10px] text-[#8A92A6] ml-auto">GPMF/CAMM IMU</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-[#1C202B] border border-[#2B3140] text-[#94A3B8] text-[11px] font-mono">
                            <Eye size={13} className="text-[#38BDF8] shrink-0" />
                            <span className="font-semibold text-[#E2E8F0]">[ 👁️ Visual Tracking (Optical Flow) ]</span>
                            <span className="text-[10px] text-[#64748B] ml-auto">KLT RANSAC</span>
                          </div>
                        )}
                      </div>

                      {/* Enable Stabilization Checkbox Toggle */}
                      <div className="flex items-center justify-between text-[11px]">
                        <label className="flex items-center gap-2 cursor-pointer text-[#F0F3F8]">
                          <input
                            type="checkbox"
                            checked={currentStabEnabled}
                            onChange={(e) =>
                              updateClipStabilization(selectedClip.id, { enabled: e.target.checked })
                            }
                            className="rounded border-[#222630] accent-[#00F0FF]"
                          />
                          <span className="font-medium">Enable Stabilization</span>
                        </label>
                        <span
                          className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                            currentStabEnabled ? 'bg-[#00F0FF]/15 text-[#00F0FF]' : 'bg-[#181B24] text-[#64748B]'
                          }`}
                        >
                          {currentStabEnabled ? 'Active' : 'Off'}
                        </span>
                      </div>

                      {/* Stabilization Pipeline Mode Selector (Real-Time vs Two-Pass) */}
                      <div className="space-y-1.5 pt-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-[#8A92A6]">Pipeline Mode</span>
                          <span className="font-mono text-[#00F0FF] text-[10px]">
                            {currentStabMode === 'realtime' ? '⚡ Real-Time (Instant)' : '🎬 Two-Pass (High Accuracy)'}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-1.5">
                          <button
                            type="button"
                            disabled={!currentStabEnabled}
                            onClick={() => {
                              useTimelineStore.setState((s) => {
                                const nextR = { ...s.isStabilizationRendering };
                                delete nextR[selectedClip.id];
                                return { isStabilizationRendering: nextR };
                              });
                              updateClipStabilization(selectedClip.id, { mode: 'realtime' });
                            }}
                            className={`px-2.5 py-1.5 rounded text-[10px] font-mono transition-all border cursor-pointer flex items-center justify-center gap-1.5 ${
                              currentStabMode === 'realtime'
                                ? 'bg-[#00F0FF]/20 text-[#00F0FF] border-[#00F0FF]/60 font-bold shadow-[0_0_8px_rgba(0,240,255,0.25)]'
                                : 'bg-[#14161F] hover:bg-[#1C202B] text-[#8A92A6] hover:text-[#F0F3F8] border-[#222630]'
                            } disabled:opacity-40 disabled:pointer-events-none`}
                          >
                            <Zap size={12} className={currentStabMode === 'realtime' ? 'text-[#00F0FF]' : ''} />
                            <span>Real-Time (Instant)</span>
                          </button>
                          <button
                            type="button"
                            disabled={!currentStabEnabled}
                            onClick={() => updateClipStabilization(selectedClip.id, { mode: 'two_pass' })}
                            className={`px-2.5 py-1.5 rounded text-[10px] font-mono transition-all border cursor-pointer flex items-center justify-center gap-1.5 ${
                              currentStabMode === 'two_pass'
                                ? 'bg-[#00F0FF]/20 text-[#00F0FF] border-[#00F0FF]/60 font-bold shadow-[0_0_8px_rgba(0,240,255,0.25)]'
                                : 'bg-[#14161F] hover:bg-[#1C202B] text-[#8A92A6] hover:text-[#F0F3F8] border-[#222630]'
                            } disabled:opacity-40 disabled:pointer-events-none`}
                          >
                            <Film size={12} className={currentStabMode === 'two_pass' ? 'text-[#00F0FF]' : ''} />
                            <span>Two-Pass (Render)</span>
                          </button>
                        </div>
                      </div>

                      {/* Stabilization Mode Radio Selector */}
                      <div className="space-y-1.5 pt-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-[#8A92A6]">Tracking & Solver Engine</span>
                          <span className="font-mono text-[#00F0FF] text-[10px]">
                            {currentDetectionMode === 'forceGyro'
                              ? '🧭 Gyroflow IMU'
                              : currentDetectionMode === 'visualFeatureTracking'
                              ? '👁️ Optical Flow'
                              : `🤖 Auto (${hasGyroData ? 'Gyroflow' : 'Optical Flow'})`}
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-1">
                          <button
                            type="button"
                            disabled={!currentStabEnabled}
                            onClick={() => updateClipStabilization(selectedClip.id, { detectionMode: 'auto' })}
                            className={`px-2 py-1.5 rounded text-[10px] font-mono transition-colors border cursor-pointer ${
                              currentDetectionMode === 'auto'
                                ? 'bg-[#00F0FF]/20 text-[#00F0FF] border-[#00F0FF]/50 font-bold shadow-xs'
                                : 'bg-[#14161F] hover:bg-[#1C202B] text-[#8A92A6] hover:text-[#F0F3F8] border-[#222630]'
                            } disabled:opacity-40 disabled:pointer-events-none`}
                          >
                            Auto (Rec.)
                          </button>
                          <button
                            type="button"
                            disabled={!currentStabEnabled}
                            onClick={() => updateClipStabilization(selectedClip.id, { detectionMode: 'visualFeatureTracking' })}
                            className={`px-2 py-1.5 rounded text-[10px] font-mono transition-colors border cursor-pointer ${
                              currentDetectionMode === 'visualFeatureTracking'
                                ? 'bg-[#00F0FF]/20 text-[#00F0FF] border-[#00F0FF]/50 font-bold shadow-xs'
                                : 'bg-[#14161F] hover:bg-[#1C202B] text-[#8A92A6] hover:text-[#F0F3F8] border-[#222630]'
                            } disabled:opacity-40 disabled:pointer-events-none`}
                          >
                            Optical Flow
                          </button>
                          <button
                            type="button"
                            disabled={!currentStabEnabled || !hasGyroData}
                            title={hasGyroData ? 'Use embedded IMU gyroscope sensors' : 'No Gyro telemetry found in video metadata'}
                            onClick={() => updateClipStabilization(selectedClip.id, { detectionMode: 'forceGyro' })}
                            className={`px-2 py-1.5 rounded text-[10px] font-mono transition-colors border cursor-pointer ${
                              currentDetectionMode === 'forceGyro'
                                ? 'bg-[#00F0FF]/20 text-[#00F0FF] border-[#00F0FF]/50 font-bold shadow-xs'
                                : !hasGyroData
                                ? 'bg-[#101217] text-[#475569] border-[#1C202B] cursor-not-allowed opacity-50'
                                : 'bg-[#14161F] hover:bg-[#1C202B] text-[#8A92A6] hover:text-[#F0F3F8] border-[#222630]'
                            } disabled:opacity-40 disabled:pointer-events-none`}
                          >
                            Gyroflow IMU {!hasGyroData && '🚫'}
                          </button>
                        </div>
                      </div>

                      {/* Status Badges & Motion Analysis Action */}
                      <div className="space-y-2">
                        {isClipAnalyzing ? (
                          <div className="p-2.5 rounded-md bg-[#00F0FF]/10 border border-[#00F0FF]/40 space-y-2">
                            <div className="flex items-center justify-between text-xs font-semibold text-[#00F0FF]">
                              <span className="flex items-center gap-1.5">
                                <Loader2 size={13} className="animate-spin text-[#00F0FF]" />
                                <span>
                                  {stabStatus.type === 'probing'
                                    ? '[ Probing IMU Sensors... ]'
                                    : `[ Tracking Motion Vectors... ${Math.round(analysisProgress)}% ]`}
                                </span>
                              </span>
                              <span className="font-mono text-[10px]">
                                {currentDetectionMode === 'forceGyro' || (currentDetectionMode === 'auto' && hasGyroData)
                                  ? 'Gyroflow'
                                  : 'KLT Homography'}
                              </span>
                            </div>
                            <div className="w-full h-1.5 bg-[#14161F] rounded-full overflow-hidden border border-[#00F0FF]/30">
                              <div
                                className="h-full bg-linear-to-r from-[#00F0FF] to-[#38BDF8] transition-all duration-200"
                                style={{ width: `${Math.max(5, analysisProgress)}%` }}
                              />
                            </div>
                          </div>
                        ) : isStabilizationRendering?.[selectedClip.id] ? (
                          <div className="p-2.5 rounded-md bg-[#00F0FF]/10 border border-[#00F0FF]/40 flex items-center justify-between">
                            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#00F0FF]">
                              <Loader2 size={13} className="animate-spin text-[#00F0FF]" />
                              <span>[ Rendering Stabilized Video... ]</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                useTimelineStore.setState((s) => {
                                  const nextR = { ...s.isStabilizationRendering };
                                  delete nextR[selectedClip.id];
                                  return { isStabilizationRendering: nextR };
                                });
                              }}
                              className="px-2 py-0.5 rounded bg-[#181B24] hover:bg-red-500/20 text-red-400 text-[10px] font-mono border border-red-500/30 transition-colors cursor-pointer"
                              title="Dismiss render indicator"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : isStabilized ? (
                          <div className="p-2 rounded-md bg-emerald-950/30 border border-emerald-500/40 flex items-center justify-between">
                            <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                              <CheckCircle2 size={14} className="text-emerald-400" />
                              <span>[ ✓ Stabilized ({currentEngineUsed === 'gyroflow' ? 'Gyroflow IMU' : 'Optical Flow Homography'}) ]</span>
                            </div>
                            <button
                              onClick={() => analyzeClipStabilization(selectedClip.id)}
                              disabled={!currentStabEnabled}
                              title="Re-run Motion Tracking"
                              className="px-2 py-1 rounded bg-[#181B24] hover:bg-[#202532] text-[10px] font-mono text-[#8A92A6] hover:text-[#00F0FF] border border-[#222630] transition-colors cursor-pointer flex items-center gap-1 disabled:opacity-40"
                            >
                              <RotateCcw size={10} />
                              <span>Re-Analyze</span>
                            </button>
                          </div>
                        ) : (
                          <div className="p-2.5 rounded-md bg-[#14161F] border border-[#222630] space-y-2">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="font-mono text-[#8A92A6]">[ Not Analyzed ]</span>
                              {stabStatus.type === 'error' && (
                                <span className="text-[10px] text-red-400 font-mono">Error: {stabStatus.message || 'Tracking failed'}</span>
                              )}
                            </div>
                            <button
                              onClick={() => analyzeClipStabilization(selectedClip.id)}
                              disabled={!currentStabEnabled}
                              className="w-full py-2 px-3 rounded-md bg-[#00F0FF] hover:bg-[#38BDF8] disabled:bg-[#1A1E27] disabled:text-[#64748B] text-[#0D0E11] text-xs font-bold transition-all shadow-[0_0_12px_rgba(0,240,255,0.25)] hover:shadow-[0_0_16px_rgba(0,240,255,0.45)] cursor-pointer flex items-center justify-center gap-2 select-none"
                            >
                              <Sparkles size={14} />
                              <span>Stabilize Clip</span>
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Post-Analysis Controls (Instant interactive adjustments) */}
                      <div className="space-y-3 pt-2 border-t border-[#1C202B]">
                        {/* Smoothness Strength Slider */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-[#8A92A6]">Smoothness Strength</span>
                            <span className="font-mono text-[#00F0FF] text-[10px]">{currentSmoothness}%</span>
                          </div>
                          <input
                            type="range"
                            min={1}
                            max={100}
                            step={1}
                            disabled={!currentStabEnabled}
                            value={currentSmoothness}
                            onChange={(e) =>
                              updateClipStabilization(selectedClip.id, {
                                smoothness: Number(e.target.value) / 100,
                                smoothing: Math.round(Number(e.target.value) * 0.9),
                              })
                            }
                            className="w-full h-1 bg-[#1A1E27] rounded-lg appearance-none cursor-pointer accent-[#00F0FF] disabled:opacity-40"
                          />
                          <div className="flex justify-between text-[9px] text-[#475569] font-mono">
                            <span>Subtle (10%)</span>
                            <span>Smooth (50%)</span>
                            <span>Locked (100%)</span>
                          </div>
                        </div>

                        {/* Framing & Borders */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-[#8A92A6]">Framing & Borders</span>
                          </div>
                          <select
                            disabled={!currentStabEnabled}
                            value={currentCropPolicy}
                            onChange={(e) =>
                              updateClipStabilization(selectedClip.id, {
                                cropModePolicy: e.target.value as any,
                                cropMode: e.target.value === 'keepEdgesWithBlurFill' ? 'keep_aspect' : 'auto',
                              })
                            }
                            className="w-full bg-[#14161F] text-[#F0F3F8] border border-[#222630] rounded-md px-2 py-1.5 text-xs font-mono focus:border-[#00F0FF] outline-hidden disabled:opacity-40 cursor-pointer"
                          >
                            <option value="dynamicAdaptiveZoom">Dynamic Auto-Zoom (Conceal Edges)</option>
                            <option value="fixedZoom">Fixed Zoom 110% (Zero Breathing)</option>
                            <option value="keepEdgesWithBlurFill">Replicate Edge Pixels / Blur Fill</option>
                          </select>
                        </div>

                        {/* Maximum Zoom Limit Slider */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-[#8A92A6]">Maximum Zoom Limit</span>
                            <span className="font-mono text-[#F0F3F8] text-[10px]">{currentMaxCropLimit}%</span>
                          </div>
                          <input
                            type="range"
                            min={100}
                            max={150}
                            step={1}
                            disabled={!currentStabEnabled}
                            value={currentMaxCropLimit}
                            onChange={(e) =>
                              updateClipStabilization(selectedClip.id, {
                                maxCropLimit: Number(e.target.value) / 100,
                              })
                            }
                            className="w-full h-1 bg-[#1A1E27] rounded-lg appearance-none cursor-pointer accent-[#00F0FF] disabled:opacity-40"
                          />
                          <div className="flex justify-between text-[9px] text-[#475569] font-mono whitespace-nowrap">
                            <span>100% (No crop)</span>
                            <span>125% (Std)</span>
                            <span>150% (Max)</span>
                          </div>
                        </div>

                        {/* Horizon Lock Toggle Switch */}
                        <div className="flex items-center justify-between text-[11px] pt-1">
                          <div className="space-y-0.5">
                            <span className="text-[#F0F3F8] font-medium flex items-center gap-1.5">
                              <Compass size={12} className={hasGyroData ? 'text-[#00F0FF]' : 'text-[#64748B]'} />
                              <span>Horizon Lock</span>
                            </span>
                            <p className="text-[9.5px] text-[#64748B]">
                              {hasGyroData ? 'Locks roll tilt with IMU orientation' : 'Requires Gyro IMU telemetry'}
                            </p>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={currentHorizonLock}
                              disabled={!currentStabEnabled || !hasGyroData}
                              onChange={(e) =>
                                updateClipStabilization(selectedClip.id, {
                                  horizonLock: e.target.checked,
                                })
                              }
                              className="sr-only peer"
                            />
                            <div className="w-8 h-4 bg-[#14161F] peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-[#00F0FF] disabled:opacity-40"></div>
                          </label>
                        </div>

                        {/* Rolling Shutter Compensation */}
                        <div className="space-y-1.5 pt-1">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-[#8A92A6]">Rolling Shutter Compensation</span>
                            <span className="font-mono text-[#00F0FF] text-[10px]">{currentRollingShutter} ms</span>
                          </div>
                          <input
                            type="range"
                            min={0}
                            max={40}
                            step={1}
                            disabled={!currentStabEnabled}
                            value={currentRollingShutter}
                            onChange={(e) =>
                              updateClipStabilization(selectedClip.id, {
                                rollingShutterCompensationMs: Number(e.target.value),
                              })
                            }
                            className="w-full h-1 bg-[#1A1E27] rounded-lg appearance-none cursor-pointer accent-[#00F0FF] disabled:opacity-40"
                          />
                          <div className="flex justify-between text-[9px] text-[#475569] font-mono">
                            <span>0 ms (Off)</span>
                            <span>15 ms</span>
                            <span>40 ms</span>
                          </div>
                        </div>

                        {/* Stabilization Verification & Diagnostic Suite */}
                        <div className="pt-2 border-t border-[#1C202B] space-y-2.5">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-semibold text-[#F0F3F8] flex items-center gap-1.5">
                              <Shield size={12} className="text-[#00F0FF]" />
                              <span>Stabilization Diagnostics</span>
                            </span>
                            {clipDiagnostics && (
                              <span className="text-[9.5px] font-mono text-[#00F0FF] bg-[#00F0FF]/10 px-1.5 py-0.5 rounded border border-[#00F0FF]/30">
                                {clipDiagnostics.transformsExist ? 'Verified' : 'Unchecked'}
                              </span>
                            )}
                          </div>

                          {/* Health Indicator Metrics */}
                          {clipDiagnostics && clipDiagnostics.transformsExist && (
                            <div className="p-2.5 rounded-md bg-[#14161F] border border-[#222630] space-y-1.5 text-[10.5px] font-mono">
                              <div className="flex items-center justify-between">
                                <span className="text-[#8A92A6]">Avg Correction Shift:</span>
                                <span className="text-[#00F0FF] font-bold">±{clipDiagnostics.meanDisplacementPixels} px</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-[#8A92A6]">Max Rotation Corrected:</span>
                                <span className="text-[#38BDF8] font-bold">{clipDiagnostics.maxRotationDegrees}°</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-[#8A92A6]">Tracked Feature Points:</span>
                                <span className="text-[#F0F3F8]">{clipDiagnostics.trackedPointsCount.toLocaleString()}</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-[#8A92A6]">Frames Tracked:</span>
                                <span className="text-[#F0F3F8]">{clipDiagnostics.totalFrames}</span>
                              </div>

                              {clipDiagnostics.isIdentityTransform && (
                                <div className="mt-2 p-2 rounded bg-amber-500/10 border border-amber-500/40 text-amber-300 flex items-start gap-1.5 text-[10px]">
                                  <AlertTriangle size={13} className="shrink-0 text-amber-400 mt-0.5" />
                                  <span>Warning: Low feature tracking confidence. No motion vectors detected.</span>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Quick Audition Button */}
                          <button
                            type="button"
                            disabled={!currentStabEnabled}
                            onClick={() => {
                              const nextMode = currentDebugViewMode === 'showBordersNoCrop' ? 'normal' : 'showBordersNoCrop';
                              updateClipStabilization(selectedClip.id, { debugViewMode: nextMode });
                              setSplitStabilizationComparison(false);
                            }}
                            className={`w-full py-1.5 px-2.5 rounded text-[10px] font-mono transition-all border cursor-pointer flex items-center justify-center gap-1.5 ${
                              currentDebugViewMode === 'showBordersNoCrop'
                                ? 'bg-[#00F0FF] text-[#0D0E11] font-bold border-[#00F0FF] shadow-[0_0_10px_rgba(0,240,255,0.4)]'
                                : 'bg-[#181B24] hover:bg-[#202532] text-[#8A92A6] hover:text-[#00F0FF] border-[#222630]'
                            } disabled:opacity-40 disabled:pointer-events-none`}
                            title="Toggle uncropped 1.0x edge view to see camera shake compensation within black border margins"
                          >
                            <Eye size={11} />
                            <span>Audition Without Auto-Zoom (1.0x Borders)</span>
                          </button>

                          {/* Diagnostic Inspection Mode Selector */}
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="text-[#8A92A6]">Diagnostic View Mode</span>
                              <span className="font-mono text-[9.5px] text-[#00F0FF]">
                                {currentDebugViewMode === 'normal' && 'Normal (Compensated)'}
                                {currentDebugViewMode === 'splitWipe' && 'Split Wipe (Before vs After)'}
                                {currentDebugViewMode === 'showBordersNoCrop' && 'Show Borders (No Crop)'}
                                {currentDebugViewMode === 'differenceBlend' && 'Difference Blend (Motion Heatmap)'}
                                {currentDebugViewMode === 'ghostOverlay50' && 'Ghost Overlay 50%'}
                              </span>
                            </div>
                            <select
                              disabled={!currentStabEnabled}
                              value={currentDebugViewMode}
                              onChange={(e) => {
                                const mode = e.target.value as any;
                                updateClipStabilization(selectedClip.id, {
                                  debugViewMode: mode,
                                });
                                setSplitStabilizationComparison(mode === 'splitWipe');
                              }}
                              className="w-full bg-[#14161F] text-[#F0F3F8] border border-[#222630] rounded-md px-2 py-1.5 text-xs font-mono focus:border-[#00F0FF] outline-hidden disabled:opacity-40 cursor-pointer"
                            >
                              <option value="normal">Normal (Fully Compensated)</option>
                              <option value="splitWipe">Split Wipe (Interactive Divider)</option>
                              <option value="showBordersNoCrop">Show Borders (1.0x No Crop)</option>
                              <option value="differenceBlend">Difference Blend (Motion Heatmap)</option>
                              <option value="ghostOverlay50">Ghost Overlay 50% (Double Contour)</option>
                            </select>
                          </div>

                          {/* Split Wipe Position Slider when Split Wipe is active */}
                          {currentDebugViewMode === 'splitWipe' && (
                            <div className="space-y-1.5 p-2 rounded bg-[#14161F] border border-[#222630]">
                              <div className="flex items-center justify-between text-[10.5px]">
                                <span className="text-[#8A92A6]">Split Wipe Position</span>
                                <span className="font-mono text-[#00F0FF] text-[10px]">{currentSplitWipePos}%</span>
                              </div>
                              <input
                                type="range"
                                min={5}
                                max={95}
                                step={1}
                                value={currentSplitWipePos}
                                onChange={(e) =>
                                  updateClipStabilization(selectedClip.id, {
                                    splitWipePosition: Number(e.target.value) / 100,
                                  })
                                }
                                className="w-full h-1 bg-[#1A1E27] rounded-lg appearance-none cursor-pointer accent-[#00F0FF]"
                              />
                              <div className="flex justify-between text-[9px] font-mono">
                                <span className="text-amber-400">RAW [Left]</span>
                                <span className="text-[#00F0FF]">STABILIZED [Right]</span>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Re-generate Smoothed Stream */}
                        <div className="pt-2">
                          <button
                            onClick={async () => {
                              if (!selectedClip) return;
                              setIsGeneratingPreview(true);
                              try {
                                await applyStabilizationPreview(selectedClip.id, true);
                              } finally {
                                setIsGeneratingPreview(false);
                              }
                            }}
                            disabled={!currentStabEnabled || !isStabilized || isGeneratingPreview}
                            className="w-full py-1.5 px-3 rounded bg-[#181B24] hover:bg-[#202532] border border-[#222630] hover:border-[#00F0FF]/50 text-xs font-mono text-[#8A92A6] hover:text-[#00F0FF] transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-30 disabled:pointer-events-none"
                          >
                            {isGeneratingPreview ? (
                              <>
                                <Loader2 size={12} className="animate-spin text-[#00F0FF]" />
                                <span>Rendering Preview Stream...</span>
                              </>
                            ) : (
                              <>
                                <Tv size={12} />
                                <span>Update Smoothed Preview Stream</span>
                              </>
                            )}
                          </button>
                        </div>

                        {/* Why Dual-Engine Stabilization Info Card */}
                        <div className="pt-2 border-t border-[#1C202B]">
                          <details className="group text-[11px] text-[#8A92A6]">
                            <summary className="cursor-pointer flex items-center justify-between text-[#8A92A6] hover:text-[#00F0FF] transition-colors select-none py-1">
                              <span className="flex items-center gap-1.5 font-medium">
                                <HelpCircle size={12} className="text-[#00F0FF]" />
                                <span>How Dual-Engine Stabilization works</span>
                              </span>
                              <ChevronDown size={12} className="group-open:rotate-180 transition-transform" />
                            </summary>
                            <div className="mt-2 p-2.5 rounded bg-[#14161F] border border-[#222630] space-y-2 text-[10.5px] leading-relaxed text-[#94A3B8]">
                              <p>
                                <strong className="text-[#F0F3F8]">🧭 Gyroflow IMU Pipeline:</strong> If action cam or drone telemetry is detected (GoPro GPMF, Sony RTMD, DJI/Insta360 CAMM), stabilization uses true physical camera angular rate quaternions with zero perspective shear and optional Horizon Lock.
                              </p>
                              <p>
                                <strong className="text-[#F0F3F8]">👁️ Optical Flow RANSAC:</strong> For DSLR, mirrorless, and phone footage, multi-pass KLT corner tracking calculates 8-DOF planar homographies, filtering foreground moving objects to isolate true camera trajectory.
                              </p>
                              <p className="text-[#00F0FF] font-medium">
                                💡 Transform matrices are cached permanently (.mat). Sliders update smoothing, framing, and borders instantly without re-analyzing!
                              </p>
                            </div>
                          </details>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* 5. Speed Ramping Section - Collapsed by default */}
                <div className="rounded-lg bg-[#0D0E11] border border-[#222630] overflow-hidden">
                  <div
                    onClick={() => toggleVideoSection('speed')}
                    className="p-3 flex items-center justify-between cursor-pointer hover:bg-[#14161F]/60 transition-colors select-none"
                  >
                    <span className="text-xs font-bold text-[#F0F3F8] flex items-center gap-1.5">
                      <Gauge size={13} className="text-[#00F0FF]" />
                      <span>Speed Ramping</span>
                      <span className="px-1.5 py-0.2 rounded bg-[#00F0FF]/15 text-[#00F0FF] border border-[#00F0FF]/30 font-mono text-[10px] font-bold ml-1">
                        {currentSpeed.toFixed(2)}x
                      </span>
                    </span>
                    <span className="text-[#8A92A6]">
                      {videoSections.speed ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </span>
                  </div>

                  {videoSections.speed && (
                    <div className="p-3 pt-0 border-t border-[#1C202B] space-y-4 mt-1">
                      {/* Speed Slider */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-[11px] text-[#8A92A6]">
                          <span>Speed Multiplier</span>
                          <span className="font-mono text-[#F0F3F8] text-[10px]">
                            {currentSpeed < 1.0 ? 'Slow Motion' : currentSpeed > 1.0 ? 'Fast Forward' : 'Normal (1.0x)'}
                          </span>
                        </div>
                        <input
                          type="range"
                          min={0.1}
                          max={16.0}
                          step={0.05}
                          value={currentSpeed}
                          onChange={(e) => updateClipSpeed(selectedClip.id, Number(e.target.value), currentPitchCorrection)}
                          className="w-full h-1.5 bg-[#1A1E27] rounded-lg appearance-none cursor-pointer accent-[#00F0FF]"
                        />
                        <div className="flex justify-between text-[9px] font-mono text-[#525D73]">
                          <span>0.1x</span>
                          <span>1.0x</span>
                          <span>4.0x</span>
                          <span>16.0x</span>
                        </div>
                      </div>

                      {/* Quick Speed Buttons */}
                      <div className="space-y-1.5">
                        <span className="text-[10px] font-mono text-[#64748B] block">Quick Presets</span>
                        <div className="grid grid-cols-6 gap-1">
                          {[0.25, 0.5, 1.0, 2.0, 4.0, 8.0].map((rate) => (
                            <button
                              key={rate}
                              onClick={() => updateClipSpeed(selectedClip.id, rate, currentPitchCorrection)}
                              className={`py-1 rounded text-[11px] font-mono font-medium transition-colors cursor-pointer border ${
                                Math.abs(currentSpeed - rate) < 0.01
                                  ? 'bg-[#00F0FF] text-[#0D0E11] border-[#00F0FF] font-bold shadow-[0_0_8px_rgba(0,240,255,0.4)]'
                                  : 'bg-[#14161B] text-[#8A92A6] border-[#222630] hover:text-[#F0F3F8]'
                              }`}
                            >
                              {rate}x
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Pitch Correction Checkbox */}
                      <div className="pt-2 border-t border-[#1C202B]">
                        <label className="flex items-center gap-2 cursor-pointer text-xs text-[#F0F3F8]">
                          <input
                            type="checkbox"
                            checked={currentPitchCorrection}
                            onChange={(e) => updateClipSpeed(selectedClip.id, currentSpeed, e.target.checked)}
                            className="rounded border-[#222630] accent-[#00F0FF]"
                          />
                          <span>Maintain Audio Pitch (atempo)</span>
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB: ADJUSTMENT (CapCut-Style Suite & Hierarchical Color Grading Engine) */}
            {(inspectorTab === 'color' || inspectorTab === 'adjust') && (
              <ColorGradingInspector
                scope={selectedGradingScope}
                onSelectScope={setSelectedGradingScope}
                selectedClip={selectedClip}
                parentTrack={parentTrack}
                tracks={tracks}
                masterGrading={masterGrading}
                updateClipGradingProfile={updateClipGradingProfile}
                resetClipGradingProfile={resetClipGradingProfile}
                updateTrackGrading={updateTrackGrading}
                resetTrackGrading={resetTrackGrading}
                updateMasterGrading={updateMasterGrading}
                resetMasterGrading={resetMasterGrading}
                onAddAdjustmentLayer={() => addAdjustmentLayer(parentTrack?.id)}
              />
            )}

            {/* TAB: AUDIO (Audio Mastering Suite, EQ, Dynamic Ducking, Volume Envelopes) */}
            {inspectorTab === 'audio' && (
              <div className="space-y-3">
                {/* 1. Track & Clip Audio Gain / Fader & Stereo Pan - Open by default */}
                <div className="rounded-lg bg-[#0D0E11] border border-[#222630] overflow-hidden">
                  <div
                    onClick={() => toggleAudioSection('volume')}
                    className="p-3 flex items-center justify-between cursor-pointer hover:bg-[#14161F]/60 transition-colors select-none"
                  >
                    <span className="text-xs font-bold text-[#F0F3F8] flex items-center gap-1.5">
                      <Volume2 size={13} className="text-[#10B981]" />
                      <span>Volume & Stereo Pan</span>
                      <span
                        className={`font-mono text-[10px] font-bold ml-1 ${
                          volumeDb > 0 ? 'text-amber-400' : volumeDb === 0 ? 'text-[#10B981]' : 'text-[#8A92A6]'
                        }`}
                      >
                        {volumeDb > 0 ? `+${volumeDb.toFixed(1)}` : volumeDb <= -60 ? '-∞' : volumeDb.toFixed(1)} dB
                      </span>
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleVolumeChange(0);
                          handlePanChange(0);
                        }}
                        title="Reset Gain to 0dB & Center Pan"
                        className="text-[#64748B] hover:text-[#10B981] transition-colors cursor-pointer"
                      >
                        <RotateCcw size={12} />
                      </button>
                      <span className="text-[#8A92A6]">
                        {audioSections.volume ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </span>
                    </div>
                  </div>

                  {audioSections.volume && (
                    <div className="p-3 pt-0 border-t border-[#1C202B] space-y-3 mt-1">
                      {/* Volume Fader Slider (-60dB to +12dB) */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-[#8A92A6]">Gain Level</span>
                          <span
                            className={`font-mono text-xs font-bold ${
                              volumeDb > 0 ? 'text-amber-400' : volumeDb === 0 ? 'text-[#10B981]' : 'text-[#8A92A6]'
                            }`}
                          >
                            {volumeDb > 0 ? `+${volumeDb.toFixed(1)}` : volumeDb <= -60 ? '-∞' : volumeDb.toFixed(1)} dB
                          </span>
                        </div>

                        <input
                          type="range"
                          min={-60}
                          max={12}
                          step={0.5}
                          value={volumeDb}
                          onChange={(e) => handleVolumeChange(Number(e.target.value))}
                          className="w-full h-1.5 bg-[#222630] rounded appearance-none cursor-pointer accent-[#10B981]"
                        />

                        {/* Fader Reference Scale */}
                        <div className="flex items-center justify-between text-[9px] font-mono text-[#525D73] px-0.5">
                          <span>-60</span>
                          <span>-36</span>
                          <span>-18</span>
                          <span className="text-[#10B981] font-bold">0 dB</span>
                          <span>+6</span>
                          <span>+12</span>
                        </div>
                      </div>

                      {/* Stereo Pan Slider (-1.0 Left to +1.0 Right) */}
                      <div className="space-y-1.5 pt-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-[#8A92A6]">Stereo Pan</span>
                          <span className="font-mono text-xs font-bold text-[#00F0FF]">
                            {pan === 0 ? 'Center' : pan < 0 ? `${Math.round(Math.abs(pan) * 100)}% L` : `${Math.round(pan * 100)}% R`}
                          </span>
                        </div>

                        <input
                          type="range"
                          min={-1.0}
                          max={1.0}
                          step={0.05}
                          value={pan}
                          onChange={(e) => handlePanChange(Number(e.target.value))}
                          className="w-full h-1.5 bg-[#222630] rounded appearance-none cursor-pointer accent-[#00F0FF]"
                        />

                        <div className="flex items-center justify-between text-[9px] font-mono text-[#525D73] px-0.5">
                          <span>Left</span>
                          <button
                            onClick={() => handlePanChange(0)}
                            className="hover:text-[#00F0FF] transition-colors cursor-pointer"
                            title="Center Pan"
                          >
                            Center
                          </button>
                          <span>Right</span>
                        </div>
                      </div>

                      {/* Mute & Solo Track Quick Toggles */}
                      {parentTrack && (
                        <div className="flex items-center gap-2 pt-2 border-t border-[#1C202B]">
                          <button
                            onClick={() => toggleMute(parentTrack.id)}
                            className={`flex-1 py-1.5 rounded text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                              parentTrack.muted
                                ? 'bg-red-500/20 text-red-400 border border-red-500/40'
                                : 'bg-[#181B22] text-[#8A92A6] hover:text-[#F0F3F8] border border-[#222630]'
                            }`}
                          >
                            {parentTrack.muted ? <VolumeX size={12} /> : <Volume2 size={12} />}
                            <span>{parentTrack.muted ? 'MUTED' : 'MUTE'}</span>
                          </button>

                          <button
                            onClick={() => toggleSolo(parentTrack.id)}
                            className={`flex-1 py-1.5 rounded text-xs font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer ${
                              parentTrack.solo
                                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                                : 'bg-[#181B22] text-[#8A92A6] hover:text-[#F0F3F8] border border-[#222630]'
                            }`}
                          >
                            <span>SOLO</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* 2. Spectral Noise Profiling & Intelligent Ambient Noise Fill - Collapsed by default */}
                <div className="rounded-lg bg-[#0D0E11] border border-[#222630] overflow-hidden">
                  <div
                    onClick={() => toggleAudioSection('spectral')}
                    className="p-3 flex items-center justify-between cursor-pointer hover:bg-[#14161F]/60 transition-colors select-none"
                  >
                    <span className="text-xs font-bold text-[#F0F3F8] flex items-center gap-1.5">
                      <Sparkles size={13} className="text-[#38BDF8]" />
                      <span>Spectral Noise & Ambient Fill</span>
                    </span>
                    <span className="text-[#8A92A6]">
                      {audioSections.spectral ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </span>
                  </div>

                  {audioSections.spectral && (
                    <div className="p-3 pt-0 border-t border-[#1C202B] mt-1">
                      {selectedClip ? (
                        <SpectralDenoiseInspector selectedClip={selectedClip} />
                      ) : (
                        <div className="text-center text-xs text-[#64748B] py-2">
                          Select a clip to adjust Spectral Denoise & Auto-Cut Silence.
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* 3. 3-Band Parametric EQ Mastering - Collapsed by default */}
                <div className="rounded-lg bg-[#0D0E11] border border-[#222630] overflow-hidden">
                  <div
                    onClick={() => toggleAudioSection('eq')}
                    className="p-3 flex items-center justify-between cursor-pointer hover:bg-[#14161F]/60 transition-colors select-none"
                  >
                    <span className="text-xs font-bold text-[#F0F3F8] flex items-center gap-1.5">
                      <SlidersHorizontal size={13} className="text-[#00F0FF]" />
                      <span>3-Band Parametric EQ</span>
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleApplyEqPreset(0, 0, 0);
                        }}
                        title="Reset EQ to Flat (0dB)"
                        className="text-[#64748B] hover:text-[#00F0FF] transition-colors cursor-pointer"
                      >
                        <RotateCcw size={12} />
                      </button>
                      <span className="text-[#8A92A6]">
                        {audioSections.eq ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </span>
                    </div>
                  </div>

                  {audioSections.eq && (
                    <div className="p-3 pt-0 border-t border-[#1C202B] space-y-3 mt-1">
                      {/* EQ Presets */}
                      <div className="grid grid-cols-4 gap-1">
                        <button
                          onClick={() => handleApplyEqPreset(0, 0, 0)}
                          className={`px-1.5 py-1 rounded text-[10px] font-semibold border transition-all cursor-pointer ${
                            bassGain === 0 && midGain === 0 && trebleGain === 0
                              ? 'bg-[#00F0FF]/15 border-[#00F0FF]/40 text-[#00F0FF]'
                              : 'bg-[#181B22] border-[#222630] text-[#8A92A6] hover:text-white'
                          }`}
                        >
                          Flat
                        </button>
                        <button
                          onClick={() => handleApplyEqPreset(-2.0, 2.5, 3.5)}
                          className="px-1.5 py-1 rounded text-[10px] font-semibold bg-[#181B22] hover:bg-[#222630] border border-[#222630] text-[#8A92A6] hover:text-[#00F0FF] transition-all cursor-pointer truncate"
                          title="Vocal Clarity (+2.5dB Mid, +3.5dB Treble, -2dB Bass)"
                        >
                          Vocal
                        </button>
                        <button
                          onClick={() => handleApplyEqPreset(4.5, 0, -1.0)}
                          className="px-1.5 py-1 rounded text-[10px] font-semibold bg-[#181B22] hover:bg-[#222630] border border-[#222630] text-[#8A92A6] hover:text-[#00F0FF] transition-all cursor-pointer truncate"
                          title="Bass Punch (+4.5dB Low, -1dB Treble)"
                        >
                          Bass+
                        </button>
                        <button
                          onClick={() => handleApplyEqPreset(2.0, 3.0, -3.0)}
                          className="px-1.5 py-1 rounded text-[10px] font-semibold bg-[#181B22] hover:bg-[#222630] border border-[#222630] text-[#8A92A6] hover:text-[#00F0FF] transition-all cursor-pointer truncate"
                          title="Warm Radio (+2dB Bass, +3dB Mid, -3dB Treble)"
                        >
                          Radio
                        </button>
                      </div>

                      {/* Bass Band (100 Hz) */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-[#8A92A6]">Bass (100 Hz)</span>
                          <span className="font-mono text-[10px] font-bold text-[#F0F3F8]">
                            {bassGain > 0 ? `+${bassGain.toFixed(1)}` : bassGain.toFixed(1)} dB
                          </span>
                        </div>
                        <input
                          type="range"
                          min={-15}
                          max={15}
                          step={0.5}
                          value={bassGain}
                          onChange={(e) => handleBassChange(Number(e.target.value))}
                          className="w-full h-1.5 bg-[#222630] rounded appearance-none cursor-pointer accent-[#00F0FF]"
                        />
                      </div>

                      {/* Mid Band (1 kHz) */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-[#8A92A6]">Mid (1.0 kHz)</span>
                          <span className="font-mono text-[10px] font-bold text-[#F0F3F8]">
                            {midGain > 0 ? `+${midGain.toFixed(1)}` : midGain.toFixed(1)} dB
                          </span>
                        </div>
                        <input
                          type="range"
                          min={-15}
                          max={15}
                          step={0.5}
                          value={midGain}
                          onChange={(e) => handleMidChange(Number(e.target.value))}
                          className="w-full h-1.5 bg-[#222630] rounded appearance-none cursor-pointer accent-[#00F0FF]"
                        />
                      </div>

                      {/* Treble Band (8 kHz) */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-[#8A92A6]">Treble (8.0 kHz)</span>
                          <span className="font-mono text-[10px] font-bold text-[#F0F3F8]">
                            {trebleGain > 0 ? `+${trebleGain.toFixed(1)}` : trebleGain.toFixed(1)} dB
                          </span>
                        </div>
                        <input
                          type="range"
                          min={-15}
                          max={15}
                          step={0.5}
                          value={trebleGain}
                          onChange={(e) => handleTrebleChange(Number(e.target.value))}
                          className="w-full h-1.5 bg-[#222630] rounded appearance-none cursor-pointer accent-[#00F0FF]"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* 4. Multi-Track Dynamic Auto-Ducking - Collapsed by default */}
                {parentTrack && (
                  <div className="rounded-lg bg-[#0D0E11] border border-[#222630] overflow-hidden">
                    <div
                      onClick={() => toggleAudioSection('ducking')}
                      className="p-3 flex items-center justify-between cursor-pointer hover:bg-[#14161F]/60 transition-colors select-none"
                    >
                      <span className="text-xs font-bold text-[#F0F3F8] flex items-center gap-1.5">
                        <Sparkles size={13} className="text-[#F59E0B]" />
                        <span>Dynamic Auto-Ducking</span>
                        {Boolean(parentTrack.ducking?.duckingEnabled) && (
                          <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-[#F59E0B]/15 text-[#F59E0B] border border-[#F59E0B]/30 ml-1">
                            ON
                          </span>
                        )}
                      </span>
                      <div className="flex items-center gap-2">
                        <label
                          className="relative inline-flex items-center cursor-pointer"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            checked={parentTrack.ducking?.duckingEnabled ?? false}
                            onChange={(e) =>
                              updateTrackDucking(parentTrack.id, {
                                duckingEnabled: e.target.checked,
                                attenuationDb: parentTrack.ducking?.attenuationDb ?? -14.0,
                                attackMs: parentTrack.ducking?.attackMs ?? 20,
                                releaseMs: parentTrack.ducking?.releaseMs ?? 250,
                              })
                            }
                            className="sr-only peer"
                          />
                          <div className="w-8 h-4 bg-[#222630] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3.5 after:transition-all peer-checked:bg-[#F59E0B]"></div>
                        </label>
                        <span className="text-[#8A92A6]">
                          {audioSections.ducking ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </span>
                      </div>
                    </div>

                    {audioSections.ducking && (
                      <div className="p-3 pt-0 border-t border-[#1C202B] space-y-3 mt-1">
                        <p className="text-[10px] text-[#64748B] leading-tight pt-1">
                          Automatically attenuates (lowers) this track's audio whenever speech is detected on the target dialogue track.
                        </p>

                        <div className="space-y-2 pt-1">
                          {/* Target Dialogue Track Picker */}
                          <div className="space-y-1">
                            <label className="text-[10px] text-[#8A92A6]">Target Dialogue Track</label>
                            <select
                              value={parentTrack.ducking?.targetTrackId || ''}
                              onChange={(e) =>
                                updateTrackDucking(parentTrack.id, { targetTrackId: e.target.value })
                              }
                              className="w-full bg-[#181B22] border border-[#222630] rounded px-2 py-1 text-xs text-[#F0F3F8] focus:border-[#F59E0B] outline-none"
                            >
                              <option value="">Auto-Detect Dialogue Track</option>
                              {tracks
                                .filter((t) => t.id !== parentTrack?.id)
                                .map((t) => (
                                  <option key={t.id} value={t.id}>
                                    {t.name} ({t.trackType || t.type})
                                  </option>
                                ))}
                            </select>
                          </div>

                          {/* Attenuation dB */}
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-[10px]">
                              <span className="text-[#8A92A6]">Ducking Attenuation</span>
                              <span className="font-mono text-[#F59E0B]">
                                {(parentTrack.ducking?.attenuationDb ?? -14.0).toFixed(1)} dB
                              </span>
                            </div>
                            <input
                              type="range"
                              min={-30}
                              max={-6}
                              step={0.5}
                              value={parentTrack.ducking?.attenuationDb ?? -14.0}
                              onChange={(e) =>
                                updateTrackDucking(parentTrack.id, {
                                  attenuationDb: Number(e.target.value),
                                })
                              }
                              className="w-full h-1.5 bg-[#222630] rounded appearance-none cursor-pointer accent-[#F59E0B]"
                            />
                          </div>

                          {/* Attack & Release Speeds */}
                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                              <div className="flex items-center justify-between text-[9px] text-[#8A92A6]">
                                <span>Attack</span>
                                <span className="font-mono">{parentTrack.ducking?.attackMs ?? 20}ms</span>
                              </div>
                              <input
                                type="range"
                                min={10}
                                max={200}
                                step={5}
                                value={parentTrack.ducking?.attackMs ?? 20}
                                onChange={(e) =>
                                  updateTrackDucking(parentTrack.id, {
                                    attackMs: Number(e.target.value),
                                  })
                                }
                                className="w-full h-1 bg-[#222630] rounded appearance-none cursor-pointer accent-[#F59E0B]"
                              />
                            </div>

                            <div className="space-y-1">
                              <div className="flex items-center justify-between text-[9px] text-[#8A92A6]">
                                <span>Release</span>
                                <span className="font-mono">{parentTrack.ducking?.releaseMs ?? 250}ms</span>
                              </div>
                              <input
                                type="range"
                                min={50}
                                max={1000}
                                step={25}
                                value={parentTrack.ducking?.releaseMs ?? 250}
                                onChange={(e) =>
                                  updateTrackDucking(parentTrack.id, {
                                    releaseMs: Number(e.target.value),
                                  })
                                }
                                className="w-full h-1 bg-[#222630] rounded appearance-none cursor-pointer accent-[#F59E0B]"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 5. Interactive Timeline Volume Envelopes / Keyframes - Collapsed by default */}
                {selectedClip && (
                  <div className="rounded-lg bg-[#0D0E11] border border-[#222630] overflow-hidden">
                    <div
                      onClick={() => toggleAudioSection('envelopes')}
                      className="p-3 flex items-center justify-between cursor-pointer hover:bg-[#14161F]/60 transition-colors select-none"
                    >
                      <span className="text-xs font-bold text-[#F0F3F8] flex items-center gap-1.5">
                        <Diamond size={13} className="text-[#10B981]" />
                        <span>Volume Envelopes</span>
                        {Boolean(selectedClip.volumeKeyframes?.length) && (
                          <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30 ml-1">
                            {selectedClip.volumeKeyframes!.length} pts
                          </span>
                        )}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAddKeyframeAtPlayhead();
                          }}
                          className="px-2 py-0.5 rounded bg-[#10B981]/15 hover:bg-[#10B981]/25 border border-[#10B981]/40 text-[#10B981] text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                          title="Add volume envelope keyframe at current playhead"
                        >
                          <span>+ Add</span>
                        </button>
                        <span className="text-[#8A92A6]">
                          {audioSections.envelopes ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </span>
                      </div>
                    </div>

                    {audioSections.envelopes && (
                      <div className="p-3 pt-0 border-t border-[#1C202B] space-y-2.5 mt-1">
                        {/* Keyframe List */}
                        {selectedClip.volumeKeyframes && selectedClip.volumeKeyframes.length > 0 ? (
                          <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                            {selectedClip.volumeKeyframes.map((kf, idx) => {
                              const absTime = (selectedClip?.startPositionSeconds || 0) + kf.time;
                              return (
                                <div
                                  key={`${kf.time}-${idx}`}
                                  className="flex items-center justify-between px-2 py-1 rounded bg-[#181B22] border border-[#222630] text-[10px]"
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono text-[#10B981] font-bold">
                                      +{kf.time.toFixed(2)}s
                                    </span>
                                    <span className="font-mono text-[#F0F3F8]">
                                      {kf.value > 0 ? `+${kf.value.toFixed(1)}` : kf.value.toFixed(1)} dB
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-1.5">
                                    <button
                                      onClick={() => setPlayhead(absTime)}
                                      className="text-[#64748B] hover:text-[#00F0FF] p-0.5 transition-colors cursor-pointer"
                                      title={`Seek playhead to ${absTime.toFixed(2)}s`}
                                    >
                                      <Play size={10} />
                                    </button>
                                    <button
                                      onClick={() => removeVolumeKeyframe(selectedClip!.id, kf.time)}
                                      className="text-[#64748B] hover:text-red-400 p-0.5 transition-colors cursor-pointer"
                                      title="Delete volume keyframe"
                                    >
                                      <Trash2 size={10} />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="p-2.5 rounded bg-[#14161B] border border-dashed border-[#222630] text-center">
                            <p className="text-[10px] text-[#64748B]">
                              No volume envelope keyframes yet. Double-click on the clip waveform line or click "+ Add at Playhead".
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* 6. Live Stereo dB Meter - Collapsed by default */}
                <div className="rounded-lg bg-[#0D0E11] border border-[#222630] overflow-hidden">
                  <div
                    onClick={() => toggleAudioSection('meter')}
                    className="p-3 flex items-center justify-between cursor-pointer hover:bg-[#14161F]/60 transition-colors select-none"
                  >
                    <span className="text-xs font-bold text-[#F0F3F8] flex items-center gap-1.5">
                      <Sliders size={13} className="text-[#10B981]" />
                      <span>Live Stereo dB Meter</span>
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-[#64748B]">
                        {isPlaying ? 'ACTIVE' : 'IDLE'}
                      </span>
                      <span className="text-[#8A92A6]">
                        {audioSections.meter ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </span>
                    </div>
                  </div>

                  {audioSections.meter && (
                    <div className="p-3 pt-0 border-t border-[#1C202B] space-y-2 mt-1">
                      {/* Left Channel Bar */}
                      <div className="space-y-0.5">
                        <div className="flex items-center justify-between text-[10px] font-mono text-[#8A92A6]">
                          <span>CH L</span>
                          <span>{meterL <= -60 ? '-∞' : `${meterL.toFixed(1)} dB`}</span>
                        </div>
                        <div className="w-full h-2 bg-[#1A1D24] rounded overflow-hidden">
                          <div
                            style={{ width: `${Math.min(100, Math.max(0, ((meterL + 60) / 60) * 100))}%` }}
                            className={`h-full transition-all duration-75 ${
                              meterL > -3 ? 'bg-red-500' : meterL > -12 ? 'bg-amber-400' : 'bg-[#10B981]'
                            }`}
                          />
                        </div>
                      </div>

                      {/* Right Channel Bar */}
                      <div className="space-y-0.5">
                        <div className="flex items-center justify-between text-[10px] font-mono text-[#8A92A6]">
                          <span>CH R</span>
                          <span>{meterR <= -60 ? '-∞' : `${meterR.toFixed(1)} dB`}</span>
                        </div>
                        <div className="w-full h-2 bg-[#1A1D24] rounded overflow-hidden">
                          <div
                            style={{ width: `${Math.min(100, Math.max(0, ((meterR + 60) / 60) * 100))}%` }}
                            className={`h-full transition-all duration-75 ${
                              meterR > -3 ? 'bg-red-500' : meterR > -12 ? 'bg-amber-400' : 'bg-[#10B981]'
                            }`}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-[#64748B]">
            <Sliders size={32} className="mx-auto mb-2 opacity-40 text-[#64748B]" />
            <div className="text-xs font-semibold text-[#8A92A6]">No Clip Selected</div>
            <div className="text-[11px] text-[#525D73] mt-1 max-w-[180px]">
              Click any clip on the timeline to inspect and edit color & audio properties
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
