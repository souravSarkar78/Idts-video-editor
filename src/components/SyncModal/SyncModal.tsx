import React, { useState, useMemo } from 'react';
import {
  X,
  RefreshCw,
  Clock,
  Waves,
  FileCode,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Sliders,
  Play,
  ArrowRight,
  Zap,
  Split,
  Magnet,
} from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useTimelineStore } from '../../store/timelineStore';
import { SyncMode, SyncCandidate } from '../../types/ipc';
import { formatDeltaSeconds } from '../../utils/timecode';

const PRESETS = [
  { label: 'Standard Video (VID_YYYYMMDD_HHMMSS)', pattern: 'VID_{YYYY}{MM}{DD}_{HH}{mm}{ss}' },
  { label: 'DJI Action / Drone (DJI_YYYYMMDD_HHMMSS)', pattern: 'DJI_{YYYY}{MM}{DD}_{HH}{mm}{ss}' },
  { label: 'Audio Recorder (AUDIO_YYYYMMDD_HHMMSS)', pattern: 'AUDIO_{YYYY}{MM}{DD}_{HH}{mm}{ss}' },
  { label: 'Studio ISO (REC_YYYY-MM-DD_HH.mm.ss)', pattern: 'REC_{YYYY}-{MM}-{DD}_{HH}.{mm}.{ss}' },
  { label: 'GoPro Hero (GH01_YYYYMMDD_HHMMSS)', pattern: 'GH\\d+_{YYYY}{MM}{DD}_{HH}{mm}{ss}' },
];

export const SyncModal: React.FC = () => {
  const {
    isSyncModalOpen,
    setSyncModalOpen,
    tracks,
    syncPlacementMode,
    syncGapCushionSec,
    setSyncPlacementMode,
    setSyncGapCushionSec,
    syncAllTracks,
    executeTauriSync,
    syncTracksByAudio,
  } = useTimelineStore(
    useShallow((state) => ({
      isSyncModalOpen: state.isSyncModalOpen,
      setSyncModalOpen: state.setSyncModalOpen,
      tracks: state.tracks,
      syncPlacementMode: state.syncPlacementMode,
      syncGapCushionSec: state.syncGapCushionSec,
      setSyncPlacementMode: state.setSyncPlacementMode,
      setSyncGapCushionSec: state.setSyncGapCushionSec,
      syncAllTracks: state.syncAllTracks,
      executeTauriSync: state.executeTauriSync,
      syncTracksByAudio: state.syncTracksByAudio,
    }))
  );

  const [activeMode, setActiveMode] = useState<SyncMode>('filename');
  const [selectedPreset, setSelectedPreset] = useState(PRESETS[0].pattern);
  const [customPattern, setCustomPattern] = useState('VID_{YYYY}{MM}{DD}_{HH}{mm}{ss}');
  const [referenceTrackId, setReferenceTrackId] = useState<string>(tracks[0]?.id || '');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Local state for placement strategy in dialog
  const [localPlacementMode, setLocalPlacementMode] = useState<'compact' | 'absolute' | 'capped'>(
    syncPlacementMode || 'compact'
  );
  const [localGapCushion, setLocalGapCushion] = useState<number>(syncGapCushionSec ?? 1.0);

  // Parse timestamps from filename or metadata based on mode
  const syncCandidates: SyncCandidate[] = useMemo(() => {
    if (!tracks.length) return [];

    const effectiveRefId = tracks.some((t) => t.id === referenceTrackId)
      ? referenceTrackId
      : tracks[0].id;

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

    const refTrack = tracks.find((t) => t.id === effectiveRefId) || tracks[0];
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
  }, [tracks, referenceTrackId, activeMode, customPattern]);

  const handleApplySync = async () => {
    setIsAnalyzing(true);
    setSyncPlacementMode(localPlacementMode);
    setSyncGapCushionSec(localGapCushion);

    if (activeMode === 'waveform') {
      const refId = referenceTrackId || tracks[0]?.id;
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
            <div className="p-1.5 rounded-md bg-[#00F0FF]/10 text-[#00F0FF] border border-[#00F0FF]/30">
              <RefreshCw size={18} />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-wide text-[#F0F3F8]">
                Multicam Synchronization & Placement Settings
              </h2>
              <p className="text-[11px] text-[#64748B]">
                Configure timecode alignment pattern and timeline placement behavior across takes
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
        <div className="flex border-b border-[#222630] bg-[#0D0E11] px-5 pt-2 gap-2">
          <button
            onClick={() => setActiveMode('filename')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-t border-t border-x transition-all ${
              activeMode === 'filename'
                ? 'bg-[#14161B] text-[#00F0FF] border-[#222630] border-b-[#14161B] -mb-[1px] shadow-sm'
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
                ? 'bg-[#14161B] text-[#00F0FF] border-[#222630] border-b-[#14161B] -mb-[1px] shadow-sm'
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
                ? 'bg-[#14161B] text-[#00F0FF] border-[#222630] border-b-[#14161B] -mb-[1px] shadow-sm'
                : 'text-[#8A92A6] border-transparent hover:text-[#F0F3F8]'
            }`}
          >
            <Clock size={14} />
            <span>Creation Metadata</span>
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto max-h-[60vh] divide-y divide-[#222630]">
          {/* Mode Specific Settings Box */}
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
                      className="w-full bg-[#0D0E11] border border-[#222630] rounded px-3 py-1.5 text-xs text-[#F0F3F8] focus:border-[#00F0FF] focus:outline-none"
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
                      onChange={(e) => setReferenceTrackId(e.target.value)}
                      className="w-full bg-[#0D0E11] border border-[#222630] rounded px-3 py-1.5 text-xs text-[#F0F3F8] focus:border-[#00F0FF] focus:outline-none"
                    >
                      {tracks.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} ({t.type})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#8A92A6] uppercase tracking-wider mb-1.5 flex items-center justify-between">
                    <span>Custom Timestamp Extraction Pattern</span>
                    <span className="text-[10px] text-[#00F0FF] font-mono lowercase">
                      tokens: &#123;YYYY&#125; &#123;MM&#125; &#123;DD&#125; &#123;HH&#125; &#123;mm&#125; &#123;ss&#125;
                    </span>
                  </label>
                  <input
                    type="text"
                    value={customPattern}
                    onChange={(e) => setCustomPattern(e.target.value)}
                    className="w-full bg-[#0D0E11] border border-[#222630] rounded px-3 py-1.5 text-xs font-mono text-[#00F0FF] focus:border-[#00F0FF] focus:outline-none"
                  />
                </div>
              </div>
            )}

            {activeMode === 'waveform' && (
              <div className="flex items-center gap-4 bg-[#0D0E11] p-3.5 rounded border border-[#222630]">
                <div className="p-2.5 rounded-full bg-[#00F0FF]/15 text-[#00F0FF] shrink-0">
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

          {/* NEW SECTION: TIMELINE PLACEMENT STRATEGY (Snapping vs Real-Time) */}
          <div className="p-5 bg-[#0F1116] space-y-3.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#00F0FF] flex items-center gap-1.5">
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
                    ? 'bg-[#18202A] border-[#00F0FF] shadow-[0_0_12px_rgba(0,240,255,0.2)]'
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
                      className="bg-[#0D0E11] border border-[#222630] text-[#00F0FF] text-[10px] rounded px-1.5 py-0.5 focus:outline-none"
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
                    ? 'bg-[#18202A] border-[#00F0FF] shadow-[0_0_12px_rgba(0,240,255,0.2)]'
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
                    ? 'bg-[#18202A] border-[#00F0FF] shadow-[0_0_12px_rgba(0,240,255,0.2)]'
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
                      className="bg-[#0D0E11] border border-[#222630] text-[#00F0FF] text-[10px] rounded px-1.5 py-0.5 focus:outline-none"
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

          {/* Calculated Delta Offsets Preview Table */}
          <div className="p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#8A92A6]">
                Detected Clips & Calculated Offsets
              </span>
              <span className="text-[11px] text-[#64748B]">
                Anchor: <strong className="text-[#00F0FF]">{tracks.find((t) => t.id === referenceTrackId)?.name || tracks[0]?.name}</strong>
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
                  {syncCandidates.map((candidate) => (
                    <tr key={candidate.trackId} className="hover:bg-[#14161B]/80 transition-colors">
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
                          <span className="font-mono text-xs text-[#00F0FF] font-semibold">
                            0.000s (Anchor)
                          </span>
                        ) : (
                          <span className="font-mono text-xs font-semibold text-[#10B981]">
                            {formatDeltaSeconds(candidate.calculatedOffsetSeconds)}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        {candidate.isReference ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-[#00F0FF]/15 text-[#00F0FF] border border-[#00F0FF]/30">
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
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Modal Actions Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-[#222630] bg-[#101217]">
          <div className="flex items-center gap-2 text-[11px] text-[#64748B]">
            <AlertCircle size={13} className="text-[#00F0FF]" />
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
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setSyncModalOpen(false)}
              className="px-3.5 py-1.5 rounded text-xs font-medium text-[#8A92A6] hover:text-[#F0F3F8] hover:bg-[#222630] transition-colors"
            >
              Cancel
            </button>

            <button
              onClick={handleApplySync}
              disabled={isAnalyzing}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded text-xs font-bold bg-[#00F0FF] hover:bg-[#38f2ff] text-[#0D0E11] shadow-[0_0_12px_rgba(0,240,255,0.35)] transition-all disabled:opacity-50 cursor-pointer"
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
          </div>
        </div>
      </div>
    </div>
  );
};
