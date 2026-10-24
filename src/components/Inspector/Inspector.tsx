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
} from 'lucide-react';
import { Diamond, RotateCw } from '@/components/Icons';
import { useShallow } from 'zustand/react/shallow';
import { useTimelineStore, isTauri, tauriInvoke, getInterpolatedClipTransform } from '../../store/timelineStore';
import { formatDeltaSeconds } from '../../utils/timecode';
import { Clip, MediaTrack } from '../../types/ipc';

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
    toggleMute,
    toggleSolo,
    getActiveVideoClip,
    updateClipTransform,
    addOrUpdateKeyframe,
    removeKeyframe,
    updateClipSpeed,
    updateClipLensEffects,
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
      toggleMute: state.toggleMute,
      toggleSolo: state.toggleSolo,
      getActiveVideoClip: state.getActiveVideoClip,
      updateClipTransform: state.updateClipTransform,
      addOrUpdateKeyframe: state.addOrUpdateKeyframe,
      removeKeyframe: state.removeKeyframe,
      updateClipSpeed: state.updateClipSpeed,
      updateClipLensEffects: state.updateClipLensEffects,
    }))
  );

  const [isCollapsed, setIsCollapsed] = useState(false);

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

  // Local inspector adjustment states synced with selected clip
  const [brightness, setBrightness] = useState<number>(0); // -100 to +100 (%)
  const [contrast, setContrast] = useState<number>(100); // 0 to 200 (%)
  const [saturation, setSaturation] = useState<number>(100); // 0 to 200 (%)
  const [temperature, setTemperature] = useState<number>(0); // -100 to +100
  const [lutPreset, setLutPreset] = useState<string>('none');
  const [customLutPath, setCustomLutPath] = useState<string>('');
  const [volumeDb, setVolumeDb] = useState<number>(0); // -60 to +12 dB
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

  // Live stereo VU meter animation during playback
  const [meterL, setMeterL] = useState(-36);
  const [meterR, setMeterR] = useState(-34);

  // Keyframe status helper for animatable properties
  const getKeyframeStatus = (property: string) => {
    if (!selectedClip) return { hasTrack: false, hasKeyframeAtPlayhead: false, relTime: 0, keyframe: null };
    const startSec = selectedClip.startPositionSeconds ?? (selectedClip.startTimeMs / 1000);
    const durSec = selectedClip.durationSeconds ?? (selectedClip.durationMs / 1000);
    const speed = selectedClip.speedProfile?.speedMultiplier ?? 1.0;
    const relTime = Math.max(0, Math.min(durSec, playhead - startSec)) * speed;

    const track = selectedClip.keyframeTracks?.find((t) => t.property === property);
    if (!track) {
      return { hasTrack: false, hasKeyframeAtPlayhead: false, relTime, keyframe: null };
    }
    const kf = track.keyframes.find((k) => Math.abs(k.time - relTime) < 0.08);
    return {
      hasTrack: track.keyframes.length > 0,
      hasKeyframeAtPlayhead: Boolean(kf),
      relTime,
      keyframe: kf || null,
    };
  };

  const handleToggleKeyframe = (property: string, currentValue: number) => {
    if (!selectedClip) return;
    const { hasKeyframeAtPlayhead, relTime, keyframe } = getKeyframeStatus(property);
    if (hasKeyframeAtPlayhead && keyframe) {
      removeKeyframe(selectedClip.id, property, keyframe.time);
    } else {
      addOrUpdateKeyframe(selectedClip.id, property, Number(relTime.toFixed(3)), currentValue);
    }
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

  // Sync state when selected clip changes
  useEffect(() => {
    if (selectedClip) {
      setBrightness(Math.round((selectedClip.color?.brightness ?? selectedClip.brightness ?? 0) * 100));
      setContrast(Math.round((selectedClip.color?.contrast ?? selectedClip.contrast ?? 1.0) * 100));
      setSaturation(Math.round((selectedClip.color?.saturation ?? selectedClip.saturation ?? 1.0) * 100));
      setTemperature(Math.round(selectedClip.color?.temperature ?? selectedClip.temperature ?? 0));
      setVolumeDb(selectedClip.volumeDb ?? 0);
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
    selectedClip?.lutPath,
    selectedClip?.color,
  ]);

  // Animate live stereo dB meter during timeline playback
  useEffect(() => {
    if (!isPlaying) {
      setMeterL(-60);
      setMeterR(-60);
      return;
    }

    const interval = setInterval(() => {
      // Simulate realistic stereo dynamics based on volumeDb
      const base = Math.max(-55, Math.min(0, volumeDb - 12));
      const jitterL = (Math.random() * 8) - 4;
      const jitterR = (Math.random() * 8) - 4;
      setMeterL(Math.min(0, Math.max(-60, base + jitterL)));
      setMeterR(Math.min(0, Math.max(-60, base + jitterR)));
    }, 60);

    return () => clearInterval(interval);
  }, [isPlaying, volumeDb]);

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
    }
  };

  if (isCollapsed) {
    return (
      <div className="w-10 shrink-0 bg-[#14161B] border-l border-[#222630] flex flex-col items-center py-3 select-none">
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
    <div className="w-80 shrink-0 bg-[#14161B] border-l border-[#222630] flex flex-col overflow-hidden select-none">
      {/* Top Main Tabs (Video, Color, Audio, Speed) + Collapse button */}
      <div className="h-10 bg-[#101217] border-b border-[#222630] px-2.5 flex items-center justify-between text-xs font-semibold">
        <div className="flex items-center gap-1">
          {(['video', 'color', 'audio', 'speed'] as const).map((tab) => {
            const isActive = inspectorTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setInspectorTab(tab)}
                className={`px-2.5 py-1 rounded text-xs capitalize transition-colors cursor-pointer ${
                  isActive
                    ? 'text-[#00F0FF] bg-[#1A1E27]'
                    : 'text-[#8A92A6] hover:text-[#F0F3F8]'
                }`}
              >
                {tab === 'color' ? 'Color' : tab}
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
                    {selectedClip.synced ? 'Multicam Synced' : 'Unsynchronized'}
                  </span>
                </div>
                {selectedClip.syncDeltaSeconds !== undefined && (
                  <span className="text-[#00F0FF] font-bold">
                    {formatDeltaSeconds(selectedClip.syncDeltaSeconds)}
                  </span>
                )}
              </div>
            </div>

            {/* TAB: VIDEO (Clip Properties, In/Out Points, Proxy Status) */}
            {inspectorTab === 'video' && (
              <div className="space-y-3">
                <div className="p-3 rounded-lg bg-[#0D0E11] border border-[#222630] space-y-2.5">
                  <div className="flex items-center justify-between text-xs font-bold text-[#F0F3F8]">
                    <div className="flex items-center gap-1.5">
                      <Film size={13} className="text-[#00F0FF]" />
                      <span>Video Properties</span>
                    </div>
                  </div>

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

                {/* Motion Transform Controls & Keyframe Engine */}
                <div className="p-3 rounded-lg bg-[#0D0E11] border border-[#222630] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#F0F3F8] flex items-center gap-1.5">
                      <Move size={13} className="text-[#00F0FF]" />
                      <span>Motion & Transform</span>
                    </span>
                    <button
                      onClick={handleResetTransform}
                      title="Reset all transforms"
                      className="px-2 py-0.5 rounded bg-[#181B24] hover:bg-[#202532] text-[#8A92A6] hover:text-[#00F0FF] text-[10px] font-mono flex items-center gap-1 transition-colors cursor-pointer border border-[#222630]"
                    >
                      <RotateCcw size={10} />
                      <span>Reset</span>
                    </button>
                  </div>

                  {/* 1. Scale */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-[#8A92A6] flex items-center gap-1">
                        <Maximize2 size={11} className="text-[#64748B]" />
                        <span>Scale</span>
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[#F0F3F8] text-[10px]">{currentTransform.scale.toFixed(2)}x</span>
                        {/* Keyframe Stopwatch Diamond */}
                        {(() => {
                          const kf = getKeyframeStatus('scale');
                          return (
                            <button
                              onClick={() => handleToggleKeyframe('scale', currentTransform.scale)}
                              title={kf.hasKeyframeAtPlayhead ? 'Remove keyframe at playhead' : 'Add keyframe at playhead'}
                              className={`p-1 rounded transition-colors cursor-pointer ${
                                kf.hasKeyframeAtPlayhead
                                  ? 'text-[#00F0FF] bg-[#00F0FF]/20 shadow-[0_0_6px_#00F0FF]'
                                  : kf.hasTrack
                                  ? 'text-[#00F0FF] hover:bg-[#00F0FF]/10'
                                  : 'text-[#525D73] hover:text-[#8A92A6]'
                              }`}
                            >
                              <Diamond size={11} fill={kf.hasKeyframeAtPlayhead ? 'currentColor' : 'none'} />
                            </button>
                          );
                        })()}
                      </div>
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
                      <span className="text-[#8A92A6] flex items-center gap-1">
                        <span>Position X</span>
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[#F0F3F8] text-[10px]">{Math.round(currentTransform.positionX)} px</span>
                        {(() => {
                          const kf = getKeyframeStatus('position_x');
                          return (
                            <button
                              onClick={() => handleToggleKeyframe('position_x', currentTransform.positionX)}
                              title={kf.hasKeyframeAtPlayhead ? 'Remove keyframe at playhead' : 'Add keyframe at playhead'}
                              className={`p-1 rounded transition-colors cursor-pointer ${
                                kf.hasKeyframeAtPlayhead
                                  ? 'text-[#00F0FF] bg-[#00F0FF]/20 shadow-[0_0_6px_#00F0FF]'
                                  : kf.hasTrack
                                  ? 'text-[#00F0FF] hover:bg-[#00F0FF]/10'
                                  : 'text-[#525D73] hover:text-[#8A92A6]'
                              }`}
                            >
                              <Diamond size={11} fill={kf.hasKeyframeAtPlayhead ? 'currentColor' : 'none'} />
                            </button>
                          );
                        })()}
                      </div>
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
                      <span className="text-[#8A92A6] flex items-center gap-1">
                        <span>Position Y</span>
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[#F0F3F8] text-[10px]">{Math.round(currentTransform.positionY)} px</span>
                        {(() => {
                          const kf = getKeyframeStatus('position_y');
                          return (
                            <button
                              onClick={() => handleToggleKeyframe('position_y', currentTransform.positionY)}
                              title={kf.hasKeyframeAtPlayhead ? 'Remove keyframe at playhead' : 'Add keyframe at playhead'}
                              className={`p-1 rounded transition-colors cursor-pointer ${
                                kf.hasKeyframeAtPlayhead
                                  ? 'text-[#00F0FF] bg-[#00F0FF]/20 shadow-[0_0_6px_#00F0FF]'
                                  : kf.hasTrack
                                  ? 'text-[#00F0FF] hover:bg-[#00F0FF]/10'
                                  : 'text-[#525D73] hover:text-[#8A92A6]'
                              }`}
                            >
                              <Diamond size={11} fill={kf.hasKeyframeAtPlayhead ? 'currentColor' : 'none'} />
                            </button>
                          );
                        })()}
                      </div>
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
                      <span className="text-[#8A92A6] flex items-center gap-1">
                        <RotateCw size={11} className="text-[#64748B]" />
                        <span>Rotation</span>
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[#F0F3F8] text-[10px]">{Math.round(currentTransform.rotation)}°</span>
                        {(() => {
                          const kf = getKeyframeStatus('rotation');
                          return (
                            <button
                              onClick={() => handleToggleKeyframe('rotation', currentTransform.rotation)}
                              title={kf.hasKeyframeAtPlayhead ? 'Remove keyframe at playhead' : 'Add keyframe at playhead'}
                              className={`p-1 rounded transition-colors cursor-pointer ${
                                kf.hasKeyframeAtPlayhead
                                  ? 'text-[#00F0FF] bg-[#00F0FF]/20 shadow-[0_0_6px_#00F0FF]'
                                  : kf.hasTrack
                                  ? 'text-[#00F0FF] hover:bg-[#00F0FF]/10'
                                  : 'text-[#525D73] hover:text-[#8A92A6]'
                              }`}
                            >
                              <Diamond size={11} fill={kf.hasKeyframeAtPlayhead ? 'currentColor' : 'none'} />
                            </button>
                          );
                        })()}
                      </div>
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
                      <span className="text-[#8A92A6] flex items-center gap-1">
                        <Eye size={11} className="text-[#64748B]" />
                        <span>Opacity</span>
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[#F0F3F8] text-[10px]">{Math.round(currentTransform.opacity * 100)}%</span>
                        {(() => {
                          const kf = getKeyframeStatus('opacity');
                          return (
                            <button
                              onClick={() => handleToggleKeyframe('opacity', currentTransform.opacity)}
                              title={kf.hasKeyframeAtPlayhead ? 'Remove keyframe at playhead' : 'Add keyframe at playhead'}
                              className={`p-1 rounded transition-colors cursor-pointer ${
                                kf.hasKeyframeAtPlayhead
                                  ? 'text-[#00F0FF] bg-[#00F0FF]/20 shadow-[0_0_6px_#00F0FF]'
                                  : kf.hasTrack
                                  ? 'text-[#00F0FF] hover:bg-[#00F0FF]/10'
                                  : 'text-[#525D73] hover:text-[#8A92A6]'
                              }`}
                            >
                              <Diamond size={11} fill={kf.hasKeyframeAtPlayhead ? 'currentColor' : 'none'} />
                            </button>
                          );
                        })()}
                      </div>
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

                {/* Lens / Optical Effects Section */}
                <div className="p-3 rounded-lg bg-[#0D0E11] border border-[#222630] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#F0F3F8] flex items-center gap-1.5">
                      <Camera size={13} className="text-[#A855F7]" />
                      <span>Lens & Optical Effects</span>
                    </span>
                    <button
                      onClick={handleResetLens}
                      title="Reset lens effects"
                      className="px-2 py-0.5 rounded bg-[#181B24] hover:bg-[#202532] text-[#8A92A6] hover:text-[#A855F7] text-[10px] font-mono flex items-center gap-1 transition-colors cursor-pointer border border-[#222630]"
                    >
                      <RotateCcw size={10} />
                      <span>Reset</span>
                    </button>
                  </div>

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
              </div>
            )}

            {/* TAB: COLOR (Dedicated Color Grading Inspector & 3D LUT Pipeline) */}
            {inspectorTab === 'color' && (
              <div className="space-y-3">
                {/* 1. Color Grading Sliders with Numerical Inputs & Resets */}
                <div className="p-3 rounded-lg bg-[#0D0E11] border border-[#222630] space-y-3.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#F0F3F8] flex items-center gap-1.5">
                      <Palette size={13} className="text-[#00F0FF]" />
                      <span>Color Grading Inspector</span>
                    </span>
                    <button
                      onClick={handleResetAllColor}
                      title="Reset All Color Grading Controls"
                      className="px-2 py-0.5 rounded bg-[#181B24] hover:bg-[#202532] text-[#8A92A6] hover:text-[#00F0FF] text-[10px] font-mono flex items-center gap-1 transition-colors cursor-pointer border border-[#222630]"
                    >
                      <RotateCcw size={10} />
                      <span>Reset All</span>
                    </button>
                  </div>

                  {/* Brightness */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-[#8A92A6] flex items-center gap-1">
                        <Sun size={11} className="text-[#00F0FF]" />
                        <span>Brightness</span>
                      </span>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min={-100}
                          max={100}
                          value={brightness}
                          onChange={(e) => handleColorUpdate({ brightness: Number(e.target.value) })}
                          className="w-12 h-5 bg-[#14161B] border border-[#222630] rounded px-1 text-right text-[10px] font-mono text-[#00F0FF] outline-none"
                        />
                        <button
                          onClick={() => handleResetSlider('brightness')}
                          title="Reset Brightness"
                          className="text-[#64748B] hover:text-[#00F0FF] transition-colors cursor-pointer"
                        >
                          <RotateCcw size={11} />
                        </button>
                      </div>
                    </div>
                    <input
                      type="range"
                      min={-100}
                      max={100}
                      value={brightness}
                      onChange={(e) => handleColorUpdate({ brightness: Number(e.target.value) })}
                      className="w-full h-1 bg-[#222630] rounded appearance-none cursor-pointer accent-[#00F0FF]"
                    />
                  </div>

                  {/* Contrast */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-[#8A92A6]">Contrast</span>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min={0}
                          max={200}
                          value={contrast}
                          onChange={(e) => handleColorUpdate({ contrast: Number(e.target.value) })}
                          className="w-12 h-5 bg-[#14161B] border border-[#222630] rounded px-1 text-right text-[10px] font-mono text-[#00F0FF] outline-none"
                        />
                        <button
                          onClick={() => handleResetSlider('contrast')}
                          title="Reset Contrast"
                          className="text-[#64748B] hover:text-[#00F0FF] transition-colors cursor-pointer"
                        >
                          <RotateCcw size={11} />
                        </button>
                      </div>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={200}
                      value={contrast}
                      onChange={(e) => handleColorUpdate({ contrast: Number(e.target.value) })}
                      className="w-full h-1 bg-[#222630] rounded appearance-none cursor-pointer accent-[#00F0FF]"
                    />
                  </div>

                  {/* Saturation */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-[#8A92A6]">Saturation</span>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min={0}
                          max={300}
                          value={saturation}
                          onChange={(e) => handleColorUpdate({ saturation: Number(e.target.value) })}
                          className="w-12 h-5 bg-[#14161B] border border-[#222630] rounded px-1 text-right text-[10px] font-mono text-[#00F0FF] outline-none"
                        />
                        <button
                          onClick={() => handleResetSlider('saturation')}
                          title="Reset Saturation"
                          className="text-[#64748B] hover:text-[#00F0FF] transition-colors cursor-pointer"
                        >
                          <RotateCcw size={11} />
                        </button>
                      </div>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={300}
                      value={saturation}
                      onChange={(e) => handleColorUpdate({ saturation: Number(e.target.value) })}
                      className="w-full h-1 bg-[#222630] rounded appearance-none cursor-pointer accent-[#00F0FF]"
                    />
                  </div>

                  {/* Temperature */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-[#8A92A6] flex items-center gap-1">
                        <Thermometer size={11} className={temperature > 0 ? 'text-amber-400' : temperature < 0 ? 'text-[#00F0FF]' : 'text-[#8A92A6]'} />
                        <span>Temperature</span>
                      </span>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min={-100}
                          max={100}
                          value={temperature}
                          onChange={(e) => handleColorUpdate({ temperature: Number(e.target.value) })}
                          className={`w-12 h-5 bg-[#14161B] border border-[#222630] rounded px-1 text-right text-[10px] font-mono outline-none ${
                            temperature > 0 ? 'text-amber-400' : temperature < 0 ? 'text-[#00F0FF]' : 'text-[#8A92A6]'
                          }`}
                        />
                        <button
                          onClick={() => handleResetSlider('temperature')}
                          title="Reset Temperature"
                          className="text-[#64748B] hover:text-[#00F0FF] transition-colors cursor-pointer"
                        >
                          <RotateCcw size={11} />
                        </button>
                      </div>
                    </div>
                    <input
                      type="range"
                      min={-100}
                      max={100}
                      value={temperature}
                      onChange={(e) => handleColorUpdate({ temperature: Number(e.target.value) })}
                      className="w-full h-1 bg-gradient-to-r from-blue-500 via-[#222630] to-amber-500 rounded appearance-none cursor-pointer accent-[#00F0FF]"
                    />
                    <div className="flex items-center justify-between text-[9px] font-mono text-[#64748B] px-0.5">
                      <span>Cool (-100)</span>
                      <span>Neutral (0)</span>
                      <span>Warm (+100)</span>
                    </div>
                  </div>
                </div>

                {/* 2. 3D Color LUT Preset Selector & Import */}
                <div className="p-3 rounded-lg bg-[#0D0E11] border border-[#222630] space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#F0F3F8] flex items-center gap-1.5">
                      <Tv size={13} className="text-[#A855F7]" />
                      <span>3D Color LUT (.cube)</span>
                    </span>
                    {lutPreset !== 'none' && (
                      <span className="text-[10px] font-mono text-[#10B981] bg-[#10B981]/15 px-1.5 py-0.2 rounded border border-[#10B981]/30">
                        Active
                      </span>
                    )}
                  </div>

                  <select
                    value={lutPreset}
                    onChange={(e) => handleLutChange(e.target.value)}
                    className="w-full bg-[#14161B] border border-[#222630] focus:border-[#A855F7] rounded px-2.5 py-1.5 text-xs font-mono text-[#F0F3F8] outline-none cursor-pointer"
                  >
                    <option value="none">None / Bypass 3D LUT</option>
                    <option value="teal_orange">Rec.709 Cinematic Teal & Orange</option>
                    <option value="warm_film">Warm Golden Film</option>
                    <option value="clean_cool">Clean Cool Commercial</option>
                    <option value="vintage">Vintage Bleach Bypass</option>
                    <option value="vibrant">Vibrant Color Boost</option>
                    <option value="monochrome">Cinematic Black & White</option>
                    <option value="custom">Custom .cube File...</option>
                  </select>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleBrowseLut}
                      className="w-full py-1.5 px-3 rounded bg-[#1E222D] hover:bg-[#252B3A] border border-[#222630] hover:border-[#A855F7]/60 text-xs font-semibold text-[#A855F7] hover:text-[#d8b4fe] transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      <FolderOpen size={13} />
                      <span>Import LUT (.cube)</span>
                    </button>
                  </div>

                  {customLutPath && (
                    <div className="pt-1 text-[10px] text-[#64748B] font-mono break-all leading-tight">
                      File: {customLutPath}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB: AUDIO (Volume Fader, Mute/Solo, Live Stereo dB Meter) */}
            {inspectorTab === 'audio' && (
              <div className="space-y-3">
                {/* 1. Track & Clip Audio Gain / Fader */}
                <div className="p-3 rounded-lg bg-[#0D0E11] border border-[#222630] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#F0F3F8] flex items-center gap-1.5">
                      <Volume2 size={13} className="text-[#10B981]" />
                      <span>Audio Volume Fader</span>
                    </span>
                    <button
                      onClick={() => handleVolumeChange(0)}
                      title="Reset to 0dB Unity Gain"
                      className="text-[#64748B] hover:text-[#10B981] transition-colors cursor-pointer"
                    >
                      <RotateCcw size={12} />
                    </button>
                  </div>

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

                {/* 2. Live Stereo dB Meter */}
                <div className="p-3 rounded-lg bg-[#0D0E11] border border-[#222630] space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-[#F0F3F8]">
                    <span>Live Stereo dB Meter</span>
                    <span className="text-[10px] font-mono text-[#64748B]">
                      {isPlaying ? 'ACTIVE' : 'IDLE'}
                    </span>
                  </div>

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
              </div>
            )}

            {/* TAB: SPEED (Speed Ramping Panel) */}
            {inspectorTab === 'speed' && (
              <div className="p-3 rounded-lg bg-[#0D0E11] border border-[#222630] space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#F0F3F8] flex items-center gap-1.5">
                    <Gauge size={13} className="text-[#00F0FF]" />
                    <span>Speed Ramping</span>
                  </span>
                  <span className="px-2 py-0.5 rounded bg-[#00F0FF]/15 text-[#00F0FF] border border-[#00F0FF]/30 font-mono text-xs font-bold">
                    {currentSpeed.toFixed(2)}x
                  </span>
                </div>

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
                  <p className="text-[10px] text-[#525D73] mt-1">
                    Preserves natural vocal pitch using cascaded FFmpeg tempo stretching without chipmunking or deep distortion.
                  </p>
                </div>

                {/* Timeline Visual Feedback Note */}
                <div className="p-2.5 rounded bg-[#14161B] border border-[#222630] text-[10px] text-[#8A92A6] space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-[#F0F3F8]">
                    <Sparkles size={11} className="text-[#00F0FF]" />
                    <span>Dynamic Timeline Stretch</span>
                  </div>
                  <p className="text-[#64748B] leading-relaxed">
                    Changing playback speed directly adjusts clip length on the timeline and labels the clip block with a <span className="text-[#00F0FF] font-mono font-bold">[{currentSpeed.toFixed(1)}x]</span> tag.
                  </p>
                </div>
              </div>
            )}

            {/* TAB: ADJUST */}
            {inspectorTab === 'adjust' && (
              <div className="p-3 rounded-lg bg-[#0D0E11] border border-[#222630] space-y-2 text-center text-[#64748B] py-6">
                <Sparkles size={28} className="mx-auto text-[#00F0FF] opacity-50 mb-1" />
                <div className="text-xs text-[#8A92A6]">Hardware Filtergraph EQ</div>
                <div className="text-[10px] text-[#525D73]">All adjustments render in hardware MP4 export</div>
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
