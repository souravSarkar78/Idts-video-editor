import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  RefreshCw,
  Clock,
  Waves,
  FileCode,
  CheckCircle2,
  AlertCircle,
  Sliders,
  ArrowRight,
  Zap,
  Magnet,
  Camera,
  Check,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useTimelineStore } from '../../store/timelineStore';
import { SyncMode, SyncCandidate, CameraTimeOffset } from '../../types/ipc';
import { formatDeltaSeconds } from '../../utils/timecode';

const PRESETS = [
  { label: 'Standard Video (VID_YYYYMMDD_HHMMSS)', pattern: 'VID_{YYYY}{MM}{DD}_{HH}{mm}{ss}' },
  { label: 'DJI Action / Drone (DJI_YYYYMMDD_HHMMSS)', pattern: 'DJI_{YYYY}{MM}{DD}_{HH}{mm}{ss}' },
  { label: 'Audio Recorder (AUDIO_YYYYMMDD_HHMMSS)', pattern: 'AUDIO_{YYYY}{MM}{DD}_{HH}{mm}{ss}' },
  { label: 'Studio ISO (REC_YYYY-MM-DD_HH.mm.ss)', pattern: 'REC_{YYYY}-{MM}-{DD}_{HH}.{mm}.{ss}' },
  { label: 'GoPro Hero (GH01_YYYYMMDD_HHMMSS)', pattern: 'GH\\d+_{YYYY}{MM}{DD}_{HH}{mm}{ss}' },
];

interface TimeOffsetInputProps {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (val: number) => void;
}

const TimeOffsetInput: React.FC<TimeOffsetInputProps> = ({
  label,
  value,
  min = 0,
  max,
  step = 1,
  onChange,
}) => {
  const [text, setText] = useState<string>(String(value ?? 0));
  const [isFocused, setIsFocused] = useState<boolean>(false);

  // Sync external changes (quick presets, reset) when user is not actively typing
  useEffect(() => {
    if (!isFocused) {
      setText(String(value ?? 0));
    }
  }, [value, isFocused]);

  const commitValue = (raw: string) => {
    let num = parseInt(raw, 10);
    if (isNaN(num)) num = min;
    if (max !== undefined && num > max) num = max;
    if (min !== undefined && num < min) num = min;
    setText(String(num));
    onChange(num);
  };

  const handleStep = (direction: 'up' | 'down') => {
    const current = parseInt(text, 10) || 0;
    const delta = direction === 'up' ? step : -step;
    let next = current + delta;
    if (max !== undefined && next > max) next = max;
    if (min !== undefined && next < min) next = min;
    setText(String(next));
    onChange(next);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation();

    // Check for Numpad keypress when NumLock is off on Windows
    // In Windows, Numpad 0-9 without NumLock send code="NumpadX" but key="ArrowUp", "End", "PageDown", etc.
    if (e.code && e.code.startsWith('Numpad') && e.code.length === 7) {
      const digit = e.code.replace('Numpad', '');
      if (/^[0-9]$/.test(digit)) {
        e.preventDefault();
        const input = e.currentTarget;
        const selStart = input.selectionStart ?? input.value.length;
        const selEnd = input.selectionEnd ?? input.value.length;
        const oldVal = input.value;
        const newVal = oldVal.slice(0, selStart) + digit + oldVal.slice(selEnd);
        const cleaned = newVal.replace(/[^0-9]/g, '');
        let num = parseInt(cleaned, 10) || 0;
        if (max !== undefined && num > max) num = max;
        if (min !== undefined && num < min) num = min;
        setText(String(num));
        onChange(num);
        return;
      }
    }

    if (e.key === 'ArrowUp' && e.code !== 'Numpad8') {
      e.preventDefault();
      handleStep('up');
    } else if (e.key === 'ArrowDown' && e.code !== 'Numpad2') {
      e.preventDefault();
      handleStep('down');
    } else if (e.key === 'Enter') {
      e.preventDefault();
      e.currentTarget.blur();
    }
  };

  return (
    <div>
      <label className="block text-[10px] font-semibold text-[#8A92A6] uppercase mb-1">
        {label}
      </label>
      <div className="relative flex items-center">
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={text}
          onFocus={(e) => {
            setIsFocused(true);
            e.target.select();
          }}
          onBlur={() => {
            setIsFocused(false);
            commitValue(text);
          }}
          onChange={(e) => {
            const raw = e.target.value.replace(/[^0-9]/g, '');
            setText(raw);
            if (raw !== '') {
              let num = parseInt(raw, 10);
              if (max !== undefined && num > max) num = max;
              if (min !== undefined && num < min) num = min;
              onChange(num);
            }
          }}
          onKeyDown={handleKeyDown}
          className="w-full bg-[#14161B] border border-[#222630] rounded px-2.5 py-1.5 pr-6 text-xs font-mono text-[#F0F3F8] focus:border-[#38BDF8] focus:outline-none transition-colors"
        />

        {/* Dedicated Up / Down Stepper Arrows */}
        <div className="absolute right-1 flex flex-col items-center justify-center select-none">
          <button
            type="button"
            tabIndex={-1}
            onClick={() => handleStep('up')}
            className="p-0.5 text-[#64748B] hover:text-[#38BDF8] hover:bg-[#222630] rounded transition-colors cursor-pointer"
            title="Increment"
          >
            <ChevronUp size={10} />
          </button>
          <button
            type="button"
            tabIndex={-1}
            onClick={() => handleStep('down')}
            className="p-0.5 text-[#64748B] hover:text-[#38BDF8] hover:bg-[#222630] rounded transition-colors cursor-pointer"
            title="Decrement"
          >
            <ChevronDown size={10} />
          </button>
        </div>
      </div>
    </div>
  );
};

export const SyncModal: React.FC = () => {
  const {
    isSyncModalOpen,
    setSyncModalOpen,
    syncModalTab,
    tracks,
    syncPlacementMode,
    syncGapCushionSec,
    setSyncPlacementMode,
    setSyncGapCushionSec,
    syncMasterTrackId,
    setSyncMasterTrackId,
    cameraOffsets,
    setCameraOffset,
    applyManualCameraOffset,
    resetCameraOffset,
    resetAllCameraOffsets,
    syncAllTracks,
    executeTauriSync,
    syncTracksByAudio,
  } = useTimelineStore(
    useShallow((state) => ({
      isSyncModalOpen: state.isSyncModalOpen,
      setSyncModalOpen: state.setSyncModalOpen,
      syncModalTab: state.syncModalTab,
      tracks: state.tracks,
      syncPlacementMode: state.syncPlacementMode,
      syncGapCushionSec: state.syncGapCushionSec,
      setSyncPlacementMode: state.setSyncPlacementMode,
      setSyncGapCushionSec: state.setSyncGapCushionSec,
      syncMasterTrackId: state.syncMasterTrackId,
      setSyncMasterTrackId: state.setSyncMasterTrackId,
      cameraOffsets: state.cameraOffsets,
      setCameraOffset: state.setCameraOffset,
      applyManualCameraOffset: state.applyManualCameraOffset,
      resetCameraOffset: state.resetCameraOffset,
      resetAllCameraOffsets: state.resetAllCameraOffsets,
      syncAllTracks: state.syncAllTracks,
      executeTauriSync: state.executeTauriSync,
      syncTracksByAudio: state.syncTracksByAudio,
    }))
  );

  const [activeMode, setActiveMode] = useState<SyncMode | 'camera_offsets'>(syncModalTab || 'filename');
  const [selectedPreset, setSelectedPreset] = useState(PRESETS[0].pattern);
  const [customPattern, setCustomPattern] = useState('VID_{YYYY}{MM}{DD}_{HH}{mm}{ss}');
  const [referenceTrackId, setReferenceTrackId] = useState<string>(syncMasterTrackId || tracks[0]?.id || '');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);

  // Sync tab with store when opened from external triggers (e.g. Timeline ± Offset button)
  useEffect(() => {
    if (syncModalTab) {
      setActiveMode(syncModalTab);
    }
  }, [syncModalTab]);

  useEffect(() => {
    if (syncMasterTrackId && tracks.some((t) => t.id === syncMasterTrackId)) {
      setReferenceTrackId(syncMasterTrackId);
    } else if (tracks.length > 0 && !referenceTrackId) {
      setReferenceTrackId(tracks[0].id);
    }
  }, [syncMasterTrackId, tracks, referenceTrackId]);

  const handleReferenceChange = (newRefId: string) => {
    setReferenceTrackId(newRefId);
    setSyncMasterTrackId(newRefId);
  };

  const showToast = (msg: string) => {
    setFeedbackToast(msg);
    setTimeout(() => setFeedbackToast(null), 3500);
  };

  // Local state for placement strategy in dialog
  const [localPlacementMode, setLocalPlacementMode] = useState<'compact' | 'absolute' | 'capped'>(
    syncPlacementMode || 'compact'
  );
  const [localGapCushion, setLocalGapCushion] = useState<number>(syncGapCushionSec ?? 1.0);

  const effectiveRefId = useMemo(() => {
    return tracks.some((t) => t.id === referenceTrackId) ? referenceTrackId : (tracks[0]?.id || '');
  }, [tracks, referenceTrackId]);

  const masterTrack = useMemo(() => {
    return tracks.find((t) => t.id === effectiveRefId) || tracks[0];
  }, [tracks, effectiveRefId]);

  const secondaryTracks = useMemo(() => {
    return tracks.filter((t) => t.id !== effectiveRefId);
  }, [tracks, effectiveRefId]);

  const activeOffsetCount = useMemo(() => {
    return Object.values(cameraOffsets).filter((o) => o && o.totalOffsetSeconds !== 0).length;
  }, [cameraOffsets]);

  const formatOffsetDisplay = (offset?: CameraTimeOffset) => {
    if (!offset || offset.totalOffsetSeconds === 0) return '0.000s (Anchor / In Sync)';
    const sign = offset.sign || '+';
    const d = offset.days || 0;
    const h = String(offset.hours || 0).padStart(2, '0');
    const m = String(offset.minutes || 0).padStart(2, '0');
    const s = String(offset.seconds || 0).padStart(2, '0');
    const ms = String(offset.milliseconds || 0).padStart(3, '0');
    const dStr = d > 0 ? `${d}d ` : '';
    return `${sign} ${dStr}${h}h ${m}m ${s}s ${ms}ms (${offset.totalOffsetSeconds >= 0 ? '+' : ''}${offset.totalOffsetSeconds.toFixed(3)}s)`;
  };

  const handleQuickAdjust = (trackId: string, deltaSec: number) => {
    const existing = cameraOffsets[trackId] || {
      trackId,
      sign: '+',
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      milliseconds: 0,
      totalOffsetSeconds: 0,
    };

    const newTotal = (existing.totalOffsetSeconds || 0) + deltaSec;
    const sign = newTotal < 0 ? '-' : '+';
    const absSec = Math.abs(newTotal);

    const days = Math.floor(absSec / 86400);
    const remD = absSec % 86400;
    const hours = Math.floor(remD / 3600);
    const remH = remD % 3600;
    const minutes = Math.floor(remH / 60);
    const remM = remH % 60;
    const seconds = Math.floor(remM);
    const milliseconds = Math.round((remM - seconds) * 1000);

    setCameraOffset(trackId, {
      sign,
      days,
      hours,
      minutes,
      seconds,
      milliseconds,
    });
  };

  const handleApplySingleCamera = (trackId: string) => {
    const res = applyManualCameraOffset(trackId);
    showToast(res.message);
  };

  const handleApplyAllCameras = () => {
    const res = applyManualCameraOffset();
    showToast(res.message);
  };

  // Parse timestamps from filename or metadata based on mode
  const syncCandidates: SyncCandidate[] = useMemo(() => {
    if (!tracks.length) return [];

    const extractTimestamp = (filename: string, creationTime?: string): { date: Date | null; raw: string } => {
      if (activeMode === 'metadata' && creationTime) {
        const d = new Date(creationTime);
        return { date: isNaN(d.getTime()) ? null : d, raw: creationTime };
      }

      const match = filename.match(/(\d{4})[-_]?(\d{2})[-_]?(\d{2})[-_]?(\d{2})[.:_-]?(\d{2})[.:_-]?(\d{2})/);
      if (match) {
        const [, year, month, day, hour, min, sec] = match;
        const iso = `${year}-${month}-${day}T${hour}:${min}:${sec}Z`;
        const d = new Date(iso);
        return { date: isNaN(d.getTime()) ? null : d, raw: `${year}-${month}-${day} ${hour}:${min}:${sec}` };
      }

      return { date: null, raw: 'Timestamp not found' };
    };

    const refTrack = masterTrack;
    const refClip = refTrack?.clips[0];
    const refParsed = refClip
      ? extractTimestamp(refClip.name, refClip.metadata?.creationTime)
      : { date: new Date('2026-10-02T06:26:15Z'), raw: '2026-10-02 06:26:15' };

    const refTimeMs = refParsed.date?.getTime() || 0;
    const candidates: SyncCandidate[] = [];

    tracks.forEach((track) => {
      const isRefTrack = track.id === effectiveRefId;

      if (!track.clips || track.clips.length === 0) {
        candidates.push({
          trackId: track.id,
          trackName: track.name,
          clipId: '',
          clipName: 'No clip',
          filePath: '',
          parsedTimestamp: undefined,
          calculatedOffsetSeconds: 0,
          confidence: 0,
          isReference: isRefTrack,
        });
        return;
      }

      track.clips.forEach((clip, cIdx) => {
        const isRef = isRefTrack && cIdx === 0;
        let offsetSec = 0;
        let confidence = 1.0;
        let parsedStr = '';

        if (activeMode === 'waveform') {
          if (isRef) {
            offsetSec = 0;
            confidence = 1.0;
            parsedStr = 'Anchor Master Track';
          } else {
            offsetSec = 8.0;
            confidence = 0.98;
            parsedStr = 'Correlated (+08.00s)';
          }
        } else {
          const parsed = extractTimestamp(clip.name, clip.metadata?.creationTime);
          parsedStr = parsed.raw;

          if (parsed.date && refTimeMs > 0) {
            const deltaMs = parsed.date.getTime() - refTimeMs;
            offsetSec = Math.max(0, deltaMs / 1000);
          } else {
            offsetSec = 0;
            confidence = 0.5;
          }
        }

        candidates.push({
          trackId: track.id,
          trackName: track.name,
          clipId: clip.id,
          clipName: clip.name,
          filePath: clip.filePath,
          parsedTimestamp: parsedStr,
          calculatedOffsetSeconds: offsetSec,
          confidence,
          isReference: isRef,
        });
      });
    });

    return candidates;
  }, [tracks, effectiveRefId, masterTrack, activeMode]);

  const handleApplySync = async () => {
    setIsAnalyzing(true);
    setSyncPlacementMode(localPlacementMode);
    setSyncGapCushionSec(localGapCushion);

    if (activeMode === 'waveform') {
      const refId = effectiveRefId;
      if (refId) {
        for (const track of tracks) {
          if (track.id !== refId && track.clips.length > 0) {
            await syncTracksByAudio(refId, track.id);
          }
        }
      }
    } else {
      await executeTauriSync(customPattern);
    }

    setIsAnalyzing(false);
    setSyncModalOpen(false);
  };

  if (!isSyncModalOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-3xl bg-[#14161B] border border-[#222630] rounded-lg shadow-2xl overflow-hidden flex flex-col text-[#F0F3F8]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#222630] bg-[#101217]">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-md bg-[#38BDF8]/10 text-[#38BDF8] border border-[#38BDF8]/30">
              <RefreshCw size={18} />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-wide text-[#F0F3F8]">
                Multicam Synchronization & Camera Clock Offsets
              </h2>
              <p className="text-[11px] text-[#64748B]">
                Align camera angles with auto-sync and calibrate manual clock offsets in day, hr, min, sec, ms
              </p>
            </div>
          </div>
          <button
            onClick={() => setSyncModalOpen(false)}
            className="p-1 rounded text-[#8A92A6] hover:text-[#F0F3F8] hover:bg-[#222630] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Sync Mode Selector Tabs */}
        <div className="flex border-b border-[#222630] bg-[#0D0E11] px-5 pt-2 gap-2 overflow-x-auto">
          <button
            onClick={() => setActiveMode('filename')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-t border-t border-x transition-all ${
              activeMode === 'filename'
                ? 'bg-[#14161B] text-[#38BDF8] border-[#222630] border-b-[#14161B] -mb-[1px] shadow-sm'
                : 'text-[#8A92A6] border-transparent hover:text-[#F0F3F8]'
            }`}
          >
            <FileCode size={14} />
            <span>Filename Pattern</span>
          </button>

          <button
            onClick={() => setActiveMode('waveform')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-t border-t border-x transition-all ${
              activeMode === 'waveform'
                ? 'bg-[#14161B] text-[#38BDF8] border-[#222630] border-b-[#14161B] -mb-[1px] shadow-sm'
                : 'text-[#8A92A6] border-transparent hover:text-[#F0F3F8]'
            }`}
          >
            <Waves size={14} />
            <span>Audio Waveform (FFT)</span>
          </button>

          <button
            onClick={() => setActiveMode('metadata')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-t border-t border-x transition-all ${
              activeMode === 'metadata'
                ? 'bg-[#14161B] text-[#38BDF8] border-[#222630] border-b-[#14161B] -mb-[1px] shadow-sm'
                : 'text-[#8A92A6] border-transparent hover:text-[#F0F3F8]'
            }`}
          >
            <Clock size={14} />
            <span>Creation Metadata</span>
          </button>

          {/* Camera Time Offsets Tab */}
          <button
            onClick={() => setActiveMode('camera_offsets')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-t border-t border-x transition-all ${
              activeMode === 'camera_offsets'
                ? 'bg-[#14161B] text-[#10B981] border-[#222630] border-b-[#14161B] -mb-[1px] shadow-sm'
                : 'text-[#8A92A6] border-transparent hover:text-[#10B981]'
            }`}
          >
            <Camera size={14} />
            <span>Camera Time Offsets</span>
            {activeOffsetCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[9px] font-mono font-bold bg-[#10B981]/20 text-[#10B981]">
                {activeOffsetCount}
              </span>
            )}
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto max-h-[60vh] divide-y divide-[#222630]">
          {/* TAB 1, 2, 3: AUTO SYNC SETTINGS */}
          {activeMode !== 'camera_offsets' && (
            <div className="p-5 bg-[#14161B]/60 space-y-4">
              {activeMode === 'filename' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-[#8A92A6] uppercase tracking-wider mb-1.5">
                        Pattern Presets
                      </label>
                      <select
                        value={selectedPreset}
                        onChange={(e) => {
                          setSelectedPreset(e.target.value);
                          setCustomPattern(e.target.value);
                        }}
                        className="w-full bg-[#0D0E11] border border-[#222630] rounded px-3 py-1.5 text-xs text-[#F0F3F8] focus:border-[#38BDF8] focus:outline-none"
                      >
                        {PRESETS.map((p) => (
                          <option key={p.pattern} value={p.pattern}>
                            {p.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-[#8A92A6] uppercase tracking-wider mb-1.5">
                        Master Anchor Track
                      </label>
                      <select
                        value={referenceTrackId}
                        onChange={(e) => handleReferenceChange(e.target.value)}
                        className="w-full bg-[#0D0E11] border border-[#222630] rounded px-3 py-1.5 text-xs text-[#F0F3F8] focus:border-[#38BDF8] focus:outline-none"
                      >
                        {tracks.map((t, idx) => (
                          <option key={t.id} value={t.id}>
                            {t.name} {idx === 0 ? '(Track 1 / Master)' : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-[#8A92A6] uppercase tracking-wider mb-1.5 flex items-center justify-between">
                      <span>Custom Timestamp Extraction Pattern</span>
                      <span className="text-[10px] text-[#38BDF8] font-mono lowercase">
                        tokens: &#123;YYYY&#125; &#123;MM&#125; &#123;DD&#125; &#123;HH&#125; &#123;mm&#125; &#123;ss&#125;
                      </span>
                    </label>
                    <input
                      type="text"
                      value={customPattern}
                      onChange={(e) => setCustomPattern(e.target.value)}
                      className="w-full bg-[#0D0E11] border border-[#222630] rounded px-3 py-1.5 text-xs font-mono text-[#38BDF8] focus:border-[#38BDF8] focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {activeMode === 'waveform' && (
                <div className="flex items-center gap-4 bg-[#0D0E11] p-3.5 rounded border border-[#222630]">
                  <div className="p-2.5 rounded-full bg-[#38BDF8]/15 text-[#38BDF8] shrink-0">
                    <Waves size={24} />
                  </div>
                  <div className="flex-1 text-xs">
                    <div className="font-semibold text-[#F0F3F8] mb-0.5">FFT Cross-Correlation Audio Alignment</div>
                    <div className="text-[#8A92A6] leading-relaxed">
                      Extracts 48kHz audio envelopes from camera microphones and soundboard stems to calculate sub-frame sample-accurate time offsets.
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[10px] text-[#64748B] font-bold uppercase">Confidence Score</div>
                    <div className="text-sm font-mono font-bold text-[#10B981]">98.7% MATCH</div>
                  </div>
                </div>
              )}

              {activeMode === 'metadata' && (
                <div className="flex items-center gap-4 bg-[#0D0E11] p-3.5 rounded border border-[#222630]">
                  <div className="p-2.5 rounded-full bg-[#10B981]/15 text-[#10B981] shrink-0">
                    <Clock size={24} />
                  </div>
                  <div className="flex-1 text-xs">
                    <div className="font-semibold text-[#F0F3F8] mb-0.5">MP4 / QuickTime atom creation_time Header</div>
                    <div className="text-[#8A92A6] leading-relaxed">
                      Synchronizes clips using embedded camera clock metadata extracted from media container headers via ffprobe.
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TIMELINE PLACEMENT STRATEGY (Shown for auto sync modes) */}
          {activeMode !== 'camera_offsets' && (
            <div className="p-5 bg-[#0F1116] space-y-3.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#38BDF8] flex items-center gap-1.5">
                  <Magnet size={13} />
                  <span>Timeline Placement Strategy (Idle Gaps)</span>
                </span>
                <span className="text-[10px] text-[#64748B]">
                  Controls placement when clips are recorded hours apart
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                {/* Option 1: Snap to Last Clip (Recommended) */}
                <div
                  onClick={() => setLocalPlacementMode('compact')}
                  className={`p-3 rounded-lg border cursor-pointer transition-all flex flex-col justify-between ${
                    localPlacementMode === 'compact'
                      ? 'bg-[#18202A] border-[#38BDF8] shadow-[0_0_12px_rgba(56, 189, 248,0.2)]'
                      : 'bg-[#14161B] border-[#222630] hover:border-[#384152]'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-[#F0F3F8]">Snap to Last Clip</span>
                      <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-[#10B981]/20 text-[#10B981] font-semibold">
                        Recommended
                      </span>
                    </div>
                    <p className="text-[11px] text-[#8A92A6] leading-relaxed">
                      Eliminates idle dead space between takes. If take 2 starts at 1:00am, it snaps right after the 12:00am take.
                    </p>
                  </div>
                  {localPlacementMode === 'compact' && (
                    <div className="mt-2.5 pt-2 border-t border-[#222630] flex items-center justify-between text-[11px]">
                      <span className="text-[#64748B]">Take Cushion:</span>
                      <select
                        value={localGapCushion}
                        onChange={(e) => setLocalGapCushion(Number(e.target.value))}
                        onClick={(e) => e.stopPropagation()}
                        className="bg-[#0D0E11] border border-[#222630] text-[#38BDF8] text-[10px] rounded px-1.5 py-0.5 focus:outline-none"
                      >
                        <option value={0}>0s (Seamless)</option>
                        <option value={1}>1.0s Cushion</option>
                        <option value={2}>2.0s Cushion</option>
                        <option value={5}>5.0s Cushion</option>
                      </select>
                    </div>
                  )}
                </div>

                {/* Option 2: Real-Time Wall Clock */}
                <div
                  onClick={() => setLocalPlacementMode('absolute')}
                  className={`p-3 rounded-lg border cursor-pointer transition-all flex flex-col justify-between ${
                    localPlacementMode === 'absolute'
                      ? 'bg-[#18202A] border-[#38BDF8] shadow-[0_0_12px_rgba(56, 189, 248,0.2)]'
                      : 'bg-[#14161B] border-[#222630] hover:border-[#384152]'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-[#F0F3F8]">Wall-Clock Real Time</span>
                    </div>
                    <p className="text-[11px] text-[#8A92A6] leading-relaxed">
                      Maintains exact real-world elapsed time. If clip 2 was recorded 1 hour later, it leaves a 1-hour gap on the timeline.
                    </p>
                  </div>
                </div>

                {/* Option 3: Capped Maximum Gap */}
                <div
                  onClick={() => setLocalPlacementMode('capped')}
                  className={`p-3 rounded-lg border cursor-pointer transition-all flex flex-col justify-between ${
                    localPlacementMode === 'capped'
                      ? 'bg-[#18202A] border-[#38BDF8] shadow-[0_0_12px_rgba(56, 189, 248,0.2)]'
                      : 'bg-[#14161B] border-[#222630] hover:border-[#384152]'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-[#F0F3F8]">Cap Max Gap</span>
                    </div>
                    <p className="text-[11px] text-[#8A92A6] leading-relaxed">
                      Limits any dead space or silent intervals between camera stops to a fixed threshold.
                    </p>
                  </div>
                  {localPlacementMode === 'capped' && (
                    <div className="mt-2.5 pt-2 border-t border-[#222630] flex items-center justify-between text-[11px]">
                      <span className="text-[#64748B]">Max Gap:</span>
                      <select
                        value={localGapCushion}
                        onChange={(e) => setLocalGapCushion(Number(e.target.value))}
                        onClick={(e) => e.stopPropagation()}
                        className="bg-[#0D0E11] border border-[#222630] text-[#38BDF8] text-[10px] rounded px-1.5 py-0.5 focus:outline-none"
                      >
                        <option value={2}>Max 2s</option>
                        <option value={5}>Max 5s</option>
                        <option value={10}>Max 10s</option>
                        <option value={30}>Max 30s</option>
                      </select>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: MANUAL CAMERA CLOCK OFFSETS (DAY, HR, MIN, SEC, MS) */}
          {activeMode === 'camera_offsets' && (
            <div className="p-5 space-y-4 bg-[#14161B]/80">
              {/* Master Anchor Camera Banner */}
              <div className="p-4 rounded-lg bg-[#0E131C] border border-[#38BDF8]/35 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-md">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="p-1 rounded bg-[#38BDF8]/20 text-[#38BDF8]">
                      <Camera size={15} />
                    </span>
                    <span className="text-xs font-bold text-[#F0F3F8] uppercase tracking-wider">
                      Master Camera Reference (Anchor)
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#38BDF8]/15 text-[#38BDF8] border border-[#38BDF8]/30">
                      MASTER • 0.000s OFFSET (LOCKED)
                    </span>
                  </div>
                  <p className="text-[11px] text-[#8A92A6] leading-relaxed">
                    The master clip sets the timecode reference. All camera offsets below are applied to <strong className="text-white">secondary camera clips</strong> relative to this master. Track 1 / Master camera clips are never shifted.
                  </p>
                </div>

                <div className="shrink-0 flex items-center gap-2">
                  <label className="text-[11px] font-semibold text-[#8A92A6] whitespace-nowrap">
                    Master Track:
                  </label>
                  <select
                    value={referenceTrackId}
                    onChange={(e) => handleReferenceChange(e.target.value)}
                    className="bg-[#0D0E11] border border-[#38BDF8]/60 text-[#38BDF8] font-semibold rounded px-2.5 py-1.5 text-xs focus:outline-none cursor-pointer"
                  >
                    {tracks.map((t, idx) => (
                      <option key={t.id} value={t.id}>
                        {t.name} {idx === 0 ? '(Track 1 / Default Master)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Secondary Camera Tracks Calibration */}
              <div className="space-y-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#10B981] flex items-center gap-1.5">
                    <Clock size={13} />
                    <span>Secondary Camera Clock Calibration</span>
                  </span>
                  <span className="text-[10px] text-[#8A92A6]">
                    Select sign (+ / -) from dropdown, then enter Days, Hours, Minutes, Seconds, Milliseconds
                  </span>
                </div>

                {secondaryTracks.length === 0 ? (
                  <div className="p-8 text-center border border-dashed border-[#222630] rounded-lg text-xs text-[#8A92A6] bg-[#0D0E11]">
                    No secondary camera tracks found on timeline. Place video clips on Track 2, Track 3, etc. to configure multicam offsets.
                  </div>
                ) : (
                  secondaryTracks.map((track) => {
                    const offset = cameraOffsets[track.id] || {
                      trackId: track.id,
                      sign: '+',
                      days: 0,
                      hours: 0,
                      minutes: 0,
                      seconds: 0,
                      milliseconds: 0,
                      totalOffsetSeconds: 0,
                    };

                    const firstClip = track.clips[0];
                    const baseSec = firstClip
                      ? firstClip.baseStartPositionSeconds ?? firstClip.startPositionSeconds ?? 0
                      : 0;
                    const calibratedSec = Math.max(0, baseSec + (offset.totalOffsetSeconds || 0));

                    return (
                      <div
                        key={track.id}
                        className="p-4 rounded-lg border border-[#222630] bg-[#0E1015] hover:border-[#384152] transition-all space-y-3 shadow-md"
                      >
                        {/* Track Header & Clip Start Preview */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#1E222D] pb-2.5">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-[#F0F3F8]">
                              {track.name}
                            </span>
                            <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 rounded bg-[#222630] text-[#8A92A6]">
                              {track.type}
                            </span>
                            <span className="text-[11px] text-[#64748B]">
                              ({track.clips.length} clip{track.clips.length !== 1 ? 's' : ''})
                            </span>
                          </div>

                          <div className="text-[11px] font-mono text-[#8A92A6] flex items-center gap-1.5">
                            <span>Base: <strong className="text-[#F0F3F8]">{baseSec.toFixed(3)}s</strong></span>
                            <ArrowRight size={12} className="text-[#38BDF8]" />
                            <span>Calibrated: <strong className="text-[#10B981]">{calibratedSec.toFixed(3)}s</strong></span>
                            <span className="text-[10px] text-[#64748B]">
                              ({offset.totalOffsetSeconds >= 0 ? '+' : ''}{offset.totalOffsetSeconds.toFixed(3)}s)
                            </span>
                          </div>
                        </div>

                        {/* Controls: Dropdown for Sign + 5 Time Units Inputs */}
                        <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5 items-end">
                          {/* Sign Dropdown */}
                          <div className="col-span-2 sm:col-span-1">
                            <label className="block text-[10px] font-bold text-[#8A92A6] uppercase tracking-wider mb-1">
                              Offset Sign
                            </label>
                            <select
                              value={offset.sign || '+'}
                              onChange={(e) =>
                                setCameraOffset(track.id, { sign: e.target.value as '+' | '-' })
                              }
                              className="w-full bg-[#14161B] border border-[#222630] rounded px-2.5 py-1.5 text-xs font-mono font-bold text-[#10B981] focus:border-[#10B981] focus:outline-none cursor-pointer"
                            >
                              <option value="+">+ Positive (Delay / Shift Later)</option>
                              <option value="-">- Negative (Advance / Shift Earlier)</option>
                            </select>
                          </div>

                          {/* Days */}
                          <TimeOffsetInput
                            label="Days (d)"
                            value={offset.days ?? 0}
                            min={0}
                            max={999}
                            step={1}
                            onChange={(val) => setCameraOffset(track.id, { days: val })}
                          />

                          {/* Hours */}
                          <TimeOffsetInput
                            label="Hours (h)"
                            value={offset.hours ?? 0}
                            min={0}
                            max={23}
                            step={1}
                            onChange={(val) => setCameraOffset(track.id, { hours: val })}
                          />

                          {/* Minutes */}
                          <TimeOffsetInput
                            label="Minutes (m)"
                            value={offset.minutes ?? 0}
                            min={0}
                            max={59}
                            step={1}
                            onChange={(val) => setCameraOffset(track.id, { minutes: val })}
                          />

                          {/* Seconds */}
                          <TimeOffsetInput
                            label="Seconds (s)"
                            value={offset.seconds ?? 0}
                            min={0}
                            max={59}
                            step={1}
                            onChange={(val) => setCameraOffset(track.id, { seconds: val })}
                          />

                          {/* Milliseconds */}
                          <TimeOffsetInput
                            label="Millis (ms)"
                            value={offset.milliseconds ?? 0}
                            min={0}
                            max={999}
                            step={10}
                            onChange={(val) => setCameraOffset(track.id, { milliseconds: val })}
                          />
                        </div>

                        {/* Quick Presets Chips */}
                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          <span className="text-[10px] text-[#64748B] font-semibold mr-1">Quick Steps:</span>
                          {[-3600, 3600, -60, 60, -1, 1, -0.1, 0.1].map((val) => {
                            const label =
                              val === -3600
                                ? '-1h'
                                : val === 3600
                                ? '+1h'
                                : val === -60
                                ? '-1m'
                                : val === 60
                                ? '+1m'
                                : val === -1
                                ? '-1s'
                                : val === 1
                                ? '+1s'
                                : val === -0.1
                                ? '-100ms'
                                : '+100ms';
                            return (
                              <button
                                key={val}
                                onClick={() => handleQuickAdjust(track.id, val)}
                                className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#181B22] border border-[#262C38] text-[#8A92A6] hover:text-[#38BDF8] hover:border-[#38BDF8]/40 transition-colors cursor-pointer"
                              >
                                {label}
                              </button>
                            );
                          })}
                          <button
                            onClick={() => resetCameraOffset(track.id)}
                            className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#181B22] border border-[#262C38] text-[#EF4444] hover:bg-red-500/10 transition-colors cursor-pointer ml-auto"
                          >
                            Reset
                          </button>
                        </div>

                        {/* Card Summary Badge + Apply to this Track Button */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-[#1E222D]">
                          <div className="font-mono text-[11px] text-[#38BDF8] bg-[#38BDF8]/10 px-2.5 py-1 rounded border border-[#38BDF8]/25 flex items-center gap-1.5">
                            <span className="text-[#8A92A6]">Total Offset:</span>
                            <strong>{formatOffsetDisplay(offset)}</strong>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleApplySingleCamera(track.id)}
                              className="px-3 py-1 bg-[#10B981] hover:bg-[#059669] text-[#0D0E11] font-bold text-xs rounded flex items-center gap-1 transition-all cursor-pointer shadow-sm"
                            >
                              <Check size={12} />
                              <span>Apply to {track.name}</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Bulk Actions inside Camera Offsets Tab */}
              {secondaryTracks.length > 0 && (
                <div className="flex items-center justify-between p-3.5 rounded-lg bg-[#0D0E11] border border-[#222630]">
                  <div className="text-xs text-[#8A92A6]">
                    {activeOffsetCount > 0 ? (
                      <span className="text-[#10B981] font-semibold">
                        {activeOffsetCount} camera offset{activeOffsetCount > 1 ? 's' : ''} configured and ready
                      </span>
                    ) : (
                      <span>Configure positive or negative time offsets for each camera</span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={resetAllCameraOffsets}
                      className="px-3 py-1 rounded text-xs text-[#8A92A6] hover:text-[#EF4444] hover:bg-[#1C202B] transition-colors cursor-pointer"
                    >
                      Reset All Offsets
                    </button>
                    <button
                      onClick={handleApplyAllCameras}
                      className="px-3.5 py-1 rounded text-xs font-bold bg-[#10B981] hover:bg-[#059669] text-[#0D0E11] flex items-center gap-1.5 shadow-[0_0_10px_rgba(16,185,129,0.3)] transition-all cursor-pointer"
                    >
                      <Check size={13} />
                      <span>Apply All Camera Offsets</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* CALCULATED DELTA OFFSETS PREVIEW TABLE (For Auto Sync Modes) */}
          {activeMode !== 'camera_offsets' && (
            <div className="p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#8A92A6]">
                  Detected Clips & Calculated Offsets
                </span>
                <span className="text-[11px] text-[#64748B]">
                  Anchor: <strong className="text-[#38BDF8]">{masterTrack?.name || 'Track 1'}</strong>
                </span>
              </div>

              <div className="border border-[#222630] rounded-md overflow-hidden bg-[#0D0E11]">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#181B22] border-b border-[#222630] text-[#64748B] text-[10px] uppercase font-bold tracking-wider">
                      <th className="py-2.5 px-3">Track</th>
                      <th className="py-2.5 px-3">Clip Name</th>
                      <th className="py-2.5 px-3">Extracted Timestamp</th>
                      <th className="py-2.5 px-3">Relative Offset (Δ)</th>
                      <th className="py-2.5 px-3 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#222630]">
                    {syncCandidates.map((candidate) => {
                      const camOffset = cameraOffsets[candidate.trackId];
                      return (
                        <tr key={candidate.trackId + candidate.clipId} className="hover:bg-[#14161B]/80 transition-colors">
                          <td className="py-2.5 px-3 font-semibold text-[#F0F3F8]">
                            {candidate.trackName}
                          </td>
                          <td
                            className="py-2.5 px-3 font-mono text-[11px] text-[#8A92A6] truncate max-w-[160px]"
                            title={candidate.clipName}
                          >
                            {candidate.clipName}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[11px] text-[#8A92A6]">
                            {candidate.parsedTimestamp}
                          </td>
                          <td className="py-2.5 px-3">
                            {candidate.isReference ? (
                              <span className="font-mono text-xs text-[#38BDF8] font-semibold">
                                0.000s (Anchor)
                              </span>
                            ) : (
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono text-xs font-semibold text-[#10B981]">
                                  {formatDeltaSeconds(candidate.calculatedOffsetSeconds)}
                                </span>
                                {camOffset && camOffset.totalOffsetSeconds !== 0 && (
                                  <span className="text-[10px] font-mono text-[#38BDF8] bg-[#38BDF8]/10 px-1 rounded">
                                    ±{camOffset.totalOffsetSeconds > 0 ? '+' : ''}{camOffset.totalOffsetSeconds.toFixed(3)}s
                                  </span>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            {candidate.isReference ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-[#38BDF8]/15 text-[#38BDF8] border border-[#38BDF8]/30">
                                MASTER
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30">
                                <CheckCircle2 size={11} />
                                READY
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Callout Link to Camera Clock Offsets */}
              <div className="mt-3 p-2.5 rounded bg-[#0D0E11] border border-[#222630] flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-[#8A92A6]">
                  <Clock size={14} className="text-[#10B981]" />
                  <span>
                    Camera time not aligned? Set manual offset in days, hours, mins, secs, ms relative to Track 1 master clip.
                  </span>
                </div>
                <button
                  onClick={() => setActiveMode('camera_offsets')}
                  className="px-2.5 py-1 rounded text-[11px] font-semibold bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30 hover:bg-[#10B981]/25 transition-all cursor-pointer flex items-center gap-1"
                >
                  <span>Adjust Camera Offsets</span>
                  <ArrowRight size={12} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Actions Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-[#222630] bg-[#101217]">
          <div className="flex items-center gap-2 text-[11px] text-[#64748B]">
            <AlertCircle size={13} className="text-[#38BDF8]" />
            {feedbackToast ? (
              <span className="text-[#10B981] font-semibold">{feedbackToast}</span>
            ) : activeMode === 'camera_offsets' ? (
              <span>
                Master Anchor: <strong className="text-[#F0F3F8]">{masterTrack?.name || 'Track 1'}</strong> (Clips locked at 0s)
              </span>
            ) : (
              <span>
                Placement mode:{' '}
                <strong className="text-[#F0F3F8]">
                  {localPlacementMode === 'compact'
                    ? 'Snap to Last Clip'
                    : localPlacementMode === 'capped'
                    ? 'Capped Gap'
                    : 'Wall-Clock Real Time'}
                </strong>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setSyncModalOpen(false)}
              className="px-3.5 py-1.5 rounded text-xs font-medium text-[#8A92A6] hover:text-[#F0F3F8] hover:bg-[#222630] transition-colors cursor-pointer"
            >
              Close
            </button>

            {activeMode === 'camera_offsets' ? (
              <button
                onClick={() => {
                  applyManualCameraOffset();
                  setSyncModalOpen(false);
                }}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded text-xs font-bold bg-[#10B981] hover:bg-[#059669] text-[#0D0E11] shadow-[0_0_12px_rgba(16,185,129,0.35)] transition-all cursor-pointer"
              >
                <Check size={14} />
                <span>Save & Apply Camera Offsets</span>
              </button>
            ) : (
              <button
                onClick={handleApplySync}
                disabled={isAnalyzing}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded text-xs font-bold bg-[#38BDF8] hover:bg-[#38f2ff] text-[#0D0E11] shadow-[0_0_12px_rgba(56, 189, 248,0.35)] transition-all disabled:opacity-50 cursor-pointer"
              >
                {isAnalyzing ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span>Aligning Tracks...</span>
                  </>
                ) : (
                  <>
                    <Zap size={14} fill="currentColor" />
                    <span>Apply Timeline Sync</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
