import React, { useState } from 'react';
import { useTimelineStore } from '../../store/timelineStore';
import {
  X,
  Sparkles,
  Mic,
  Cpu,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { Subtitles, Loader2 } from '@/components/Icons';

export const AutoCaptionModal: React.FC = () => {
  const {
    isAutoCaptionModalOpen,
    setIsAutoCaptionModalOpen,
    tracks,
    isTranscribing,
    transcriptionProgress,
    generateAutoCaptions,
  } = useTimelineStore();

  const [selectedTrackId, setSelectedTrackId] = useState<string>(() => {
    // Prefer first audio track or video track with audio
    const audioTrack = tracks.find((t) => (t.trackType || t.type) === 'audio');
    if (audioTrack) return audioTrack.id;
    const videoTrack = tracks.find((t) => (t.trackType || t.type) === 'video');
    return videoTrack?.id || tracks[0]?.id || '';
  });

  const [selectedModel, setSelectedModel] = useState<string>('base.en');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isAutoCaptionModalOpen) return null;

  // Audio / Video candidate tracks
  const candidateTracks = tracks.filter(
    (t) => (t.trackType || t.type) === 'audio' || (t.trackType || t.type) === 'video'
  );

  const handleStartTranscribing = async () => {
    setErrorMsg(null);
    if (!selectedTrackId) {
      setErrorMsg('Please select an audio or video track to transcribe.');
      return;
    }

    const success = await generateAutoCaptions(selectedTrackId, selectedModel);
    if (!success) {
      setErrorMsg(
        'Transcription could not find a valid media file on the selected track or failed to extract speech.'
      );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-[520px] rounded-xl bg-[#14161B] border border-[#222630] shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#222630] bg-[#0D0E11]/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-[#A855F7]/15 text-[#A855F7] border border-[#A855F7]/30">
              <Subtitles size={18} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#F0F3F8] flex items-center gap-2">
                <span>AI Auto-Captions</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-[#A855F7]/20 text-[#A855F7] border border-[#A855F7]/40">
                  Whisper Local
                </span>
              </h2>
              <p className="text-[11px] text-[#64748B]">
                Speech-to-text with word-level boundary synchronization
              </p>
            </div>
          </div>
          <button
            onClick={() => !isTranscribing && setIsAutoCaptionModalOpen(false)}
            disabled={isTranscribing}
            className="p-1 rounded-lg text-[#64748B] hover:text-[#F0F3F8] hover:bg-[#1E222D] transition-colors disabled:opacity-40 cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 flex items-start gap-2.5 text-xs text-red-400">
              <AlertCircle size={15} className="shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {isTranscribing ? (
            <div className="py-8 px-4 flex flex-col items-center justify-center text-center space-y-4">
              <div className="relative">
                <div className="w-16 h-16 rounded-full border-4 border-[#222630] border-t-[#A855F7] animate-spin flex items-center justify-center" />
                <Sparkles size={20} className="absolute inset-0 m-auto text-[#A855F7] animate-pulse" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-[#F0F3F8]">
                  Transcribing Track Audio Locally...
                </h3>
                <p className="text-xs text-[#64748B]">
                  Running 16kHz speech recognition model without network requests
                </p>
              </div>

              {/* Progress bar */}
              <div className="w-full max-w-xs space-y-1.5">
                <div className="w-full h-2 rounded-full bg-[#1A1E27] overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#A855F7] to-[#00F0FF] transition-all duration-300"
                    style={{ width: `${transcriptionProgress}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] font-mono text-[#64748B]">
                  <span>Processing...</span>
                  <span>{transcriptionProgress}%</span>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Target Audio/Video Track Selection */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#8A92A6] flex items-center gap-1.5">
                  <Mic size={13} className="text-[#A855F7]" />
                  <span>Target Media Track</span>
                </label>
                <select
                  value={selectedTrackId}
                  onChange={(e) => setSelectedTrackId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#0D0E11] border border-[#222630] text-xs text-[#F0F3F8] focus:border-[#A855F7] focus:outline-none transition-colors"
                >
                  {candidateTracks.map((track) => (
                    <option key={track.id} value={track.id}>
                      {track.name} ({(track.trackType || track.type).toUpperCase()}) — {track.clips.length} clip(s)
                    </option>
                  ))}
                </select>
                <span className="text-[10px] text-[#64748B] block">
                  Select the track containing dialogue or voiceover to transcribe.
                </span>
              </div>

              {/* Model selection */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#8A92A6] flex items-center gap-1.5">
                  <Cpu size={13} className="text-[#A855F7]" />
                  <span>Speech Recognition Model</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'base.en', name: 'Whisper Base (English)', desc: 'Fastest inference, lower VRAM (~140MB)' },
                    { id: 'small.en', name: 'Whisper Small (English)', desc: 'Higher accuracy, clean accents (~460MB)' },
                  ].map((m) => (
                    <div
                      key={m.id}
                      onClick={() => setSelectedModel(m.id)}
                      className={`p-3 rounded-lg border text-left cursor-pointer transition-all ${
                        selectedModel === m.id
                          ? 'bg-[#A855F7]/15 border-[#A855F7] text-[#F0F3F8]'
                          : 'bg-[#0D0E11] border-[#222630] text-[#8A92A6] hover:border-[#3E4554]'
                      }`}
                    >
                      <div className="flex items-center justify-between font-bold text-xs">
                        <span>{m.name}</span>
                        {selectedModel === m.id && (
                          <CheckCircle2 size={13} className="text-[#A855F7]" />
                        )}
                      </div>
                      <p className="text-[10px] text-[#64748B] mt-1 leading-snug">{m.desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Output Info */}
              <div className="p-3 rounded-lg bg-[#0D0E11] border border-[#222630] text-[11px] text-[#8A92A6] space-y-1 leading-relaxed">
                <div className="flex items-center gap-1 text-[#F0F3F8] font-bold">
                  <Sparkles size={12} className="text-[#A855F7]" />
                  <span>Auto-Generated Subtitle Lane</span>
                </div>
                <p>
                  Transcribed phrases will be placed onto a dedicated purple Text Track with individual, fully editable subtitle blocks. You can re-time, re-style, or edit text in the Typography Inspector.
                </p>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2.5 px-5 py-3 border-t border-[#222630] bg-[#0D0E11]/60">
          <button
            onClick={() => setIsAutoCaptionModalOpen(false)}
            disabled={isTranscribing}
            className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-[#8A92A6] hover:text-[#F0F3F8] hover:bg-[#1E222D] transition-colors disabled:opacity-40 cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleStartTranscribing}
            disabled={isTranscribing || candidateTracks.length === 0}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold bg-[#A855F7] hover:bg-[#9333EA] text-white shadow-[0_0_12px_rgba(168,85,247,0.4)] transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            {isTranscribing ? (
              <>
                <Loader2 size={13} className="animate-spin" />
                <span>Transcribing...</span>
              </>
            ) : (
              <>
                <Sparkles size={13} />
                <span>Generate Auto-Captions</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
