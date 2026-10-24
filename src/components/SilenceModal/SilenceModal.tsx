import React, { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { X, VolumeX, Sliders, Check, AlertCircle, RefreshCw } from 'lucide-react';
import { useTimelineStore } from '../../store/timelineStore';

export const SilenceModal: React.FC = () => {
  const {
    isSilenceModalOpen,
    setSilenceModalOpen,
    tracks,
    autoCutSilence,
  } = useTimelineStore(
    useShallow((state) => ({
      isSilenceModalOpen: state.isSilenceModalOpen,
      setSilenceModalOpen: state.setSilenceModalOpen,
      tracks: state.tracks,
      autoCutSilence: state.autoCutSilence,
    }))
  );

  const [selectedTrackId, setSelectedTrackId] = useState<string>(() => {
    return tracks.find((t) => t.clips.length > 0)?.id || tracks[0]?.id || '';
  });
  const [thresholdDb, setThresholdDb] = useState<number>(-20);
  const [minDurationSec, setMinDurationSec] = useState<number>(0.25);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [resultMessage, setResultMessage] = useState<string | null>(null);

  if (!isSilenceModalOpen) return null;

  const handleExecute = async () => {
    if (!selectedTrackId) return;
    setIsProcessing(true);
    setResultMessage(null);

    try {
      const res = await autoCutSilence(selectedTrackId, thresholdDb, minDurationSec);
      if (res.error) {
        setResultMessage(`Error: ${res.error}`);
      } else if (res.cutCount > 0) {
        setResultMessage(
          `Successfully excised ${res.cutCount} silent interval${res.cutCount > 1 ? 's' : ''} (saved ${res.removedSec.toFixed(1)}s of dead air).`
        );
      } else {
        setResultMessage(
          `No pauses detected below ${thresholdDb} dB longer than ${minDurationSec.toFixed(2)}s. Tip: Raise Threshold (e.g. -15 to -5 dB) or decrease Minimum Duration (e.g. 0.10s to 0.20s).`
        );
      }
    } catch (err: any) {
      setResultMessage(`Error during silence detection: ${err?.message || err}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const selectedTrack = tracks.find((t) => t.id === selectedTrackId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-in fade-in duration-150 select-none">
      <div className="w-full max-w-md bg-[#14161B] border border-[#222630] rounded-xl shadow-2xl overflow-hidden flex flex-col text-[#F0F3F8]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#222630] bg-[#101217]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-amber-500/15 text-amber-400 border border-amber-500/30">
              <VolumeX size={18} />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-wide text-[#F0F3F8]">
                Audio Silence Auto-Cut
              </h2>
              <p className="text-[11px] text-[#64748B]">
                Automatically detect and ripple-excise pauses & dead air
              </p>
            </div>
          </div>

          <button
            onClick={() => setSilenceModalOpen(false)}
            className="p-1.5 rounded-lg text-[#8A92A6] hover:text-[#F0F3F8] hover:bg-[#222630] transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body Controls */}
        <div className="p-5 space-y-4 text-xs">
          {/* Target Track */}
          <div>
            <label className="block text-[11px] text-[#8A92A6] font-medium mb-1.5">
              Target Track
            </label>
            <select
              value={selectedTrackId}
              onChange={(e) => setSelectedTrackId(e.target.value)}
              className="w-full px-3 py-2 bg-[#0D0E11] border border-[#222630] rounded-md text-xs text-[#F0F3F8] focus:outline-none focus:border-[#00F0FF]/50"
            >
              {tracks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({(t.trackType || t.type).toUpperCase()} • {t.clips.length} clip{t.clips.length !== 1 ? 's' : ''})
                </option>
              ))}
            </select>
          </div>

          {/* Noise Threshold Slider */}
          <div className="space-y-1.5 p-3 rounded-lg bg-[#0D0E11] border border-[#222630]">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#8A92A6] font-medium flex items-center gap-1.5">
                <VolumeX size={13} className="text-[#00F0FF]" />
                <span>Silence Threshold</span>
              </span>
              <span className="font-mono font-bold text-[#00F0FF]">
                {thresholdDb} dB
              </span>
            </div>
            <input
              type="range"
              min={-50}
              max={0}
              step={1}
              value={thresholdDb}
              onChange={(e) => setThresholdDb(Number(e.target.value))}
              className="w-full h-1.5 bg-[#222630] rounded-lg appearance-none cursor-pointer accent-[#00F0FF]"
            />
            <div className="flex justify-between text-[10px] text-[#525D73] font-mono">
              <span>-50 dB (Quiet room)</span>
              <span>-25 dB (Standard)</span>
              <span>-5 dB (Aggressive)</span>
              <span>0 dB (Max)</span>
            </div>
          </div>

          {/* Minimum Silence Duration Slider */}
          <div className="space-y-1.5 p-3 rounded-lg bg-[#0D0E11] border border-[#222630]">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#8A92A6] font-medium flex items-center gap-1.5">
                <Sliders size={13} className="text-[#F59E0B]" />
                <span>Minimum Silence Duration</span>
              </span>
              <span className="font-mono font-bold text-[#F59E0B]">
                {minDurationSec.toFixed(2)} s
              </span>
            </div>
            <input
              type="range"
              min={0.05}
              max={2.0}
              step={0.05}
              value={minDurationSec}
              onChange={(e) => setMinDurationSec(Number(e.target.value))}
              className="w-full h-1.5 bg-[#222630] rounded-lg appearance-none cursor-pointer accent-[#F59E0B]"
            />
            <div className="flex justify-between text-[10px] text-[#525D73] font-mono">
              <span>0.05 s (Ultra-snappy)</span>
              <span>0.25 s (Natural pause)</span>
              <span>1.00 s+ (Long break)</span>
            </div>
          </div>

          {/* Status Message */}
          {resultMessage && (
            <div
              className={`p-3 rounded-lg border text-[11px] flex items-center gap-2 ${
                resultMessage.startsWith('Error')
                  ? 'bg-red-500/10 border-red-500/30 text-red-300'
                  : resultMessage.startsWith('Successfully')
                  ? 'bg-[#10B981]/10 border-[#10B981]/30 text-[#10B981]'
                  : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
              }`}
            >
              {resultMessage.startsWith('Error') ? (
                <AlertCircle size={14} className="text-red-400 shrink-0" />
              ) : resultMessage.startsWith('Successfully') ? (
                <Check size={14} className="text-[#10B981] shrink-0" />
              ) : (
                <AlertCircle size={14} className="text-amber-400 shrink-0" />
              )}
              <span>{resultMessage}</span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3.5 border-t border-[#222630] bg-[#101217] flex items-center justify-between">
          <button
            onClick={() => setSilenceModalOpen(false)}
            className="px-3.5 py-1.5 rounded-md text-xs font-semibold text-[#8A92A6] hover:text-[#F0F3F8] hover:bg-[#222630] transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <button
            onClick={handleExecute}
            disabled={isProcessing || !selectedTrack || selectedTrack.clips.length === 0}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-xs font-bold transition-all shadow-lg ${
              isProcessing || !selectedTrack || selectedTrack.clips.length === 0
                ? 'bg-[#222630] text-[#525D73] cursor-not-allowed'
                : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:brightness-110 text-black shadow-amber-500/20 cursor-pointer'
            }`}
          >
            {isProcessing ? (
              <>
                <RefreshCw size={13} className="animate-spin" />
                <span>Analyzing Audio...</span>
              </>
            ) : (
              <>
                <VolumeX size={13} />
                <span>Auto-Cut Silence</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
