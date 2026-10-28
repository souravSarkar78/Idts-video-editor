import React, { useEffect, useState, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import {
  Mic,
  X,
  Radio,
  Sliders,
  Volume2,
  VolumeX,
  Clock,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { useTimelineStore } from '../../store/timelineStore';

export const VoiceoverModal: React.FC = () => {
  const {
    isVoiceoverModalOpen,
    setIsVoiceoverModalOpen,
    isRecordingVoiceover,
    voiceoverCountdown,
    voiceoverRecordingStartSec,
    voiceoverTargetTrackId,
    setVoiceoverTargetTrackId,
    voiceoverSelectedDeviceId,
    setVoiceoverSelectedDeviceId,
    voiceoverInputLevel,
    voiceoverPeakDb,
    voiceoverMuteTimeline,
    setVoiceoverMuteTimeline,
    voiceoverUseCountdown,
    setVoiceoverUseCountdown,
    availableAudioDevices,
    fetchAudioInputDevices,
    startVoiceoverRecording,
    stopVoiceoverRecording,
    cancelVoiceoverRecording,
    tracks,
    playhead,
  } = useTimelineStore(
    useShallow((state) => ({
      isVoiceoverModalOpen: state.isVoiceoverModalOpen,
      setIsVoiceoverModalOpen: state.setIsVoiceoverModalOpen,
      isRecordingVoiceover: state.isRecordingVoiceover,
      voiceoverCountdown: state.voiceoverCountdown,
      voiceoverRecordingStartSec: state.voiceoverRecordingStartSec,
      voiceoverTargetTrackId: state.voiceoverTargetTrackId,
      setVoiceoverTargetTrackId: state.setVoiceoverTargetTrackId,
      voiceoverSelectedDeviceId: state.voiceoverSelectedDeviceId,
      setVoiceoverSelectedDeviceId: state.setVoiceoverSelectedDeviceId,
      voiceoverInputLevel: state.voiceoverInputLevel,
      voiceoverPeakDb: state.voiceoverPeakDb,
      voiceoverMuteTimeline: state.voiceoverMuteTimeline,
      setVoiceoverMuteTimeline: state.setVoiceoverMuteTimeline,
      voiceoverUseCountdown: state.voiceoverUseCountdown,
      setVoiceoverUseCountdown: state.setVoiceoverUseCountdown,
      availableAudioDevices: state.availableAudioDevices,
      fetchAudioInputDevices: state.fetchAudioInputDevices,
      startVoiceoverRecording: state.startVoiceoverRecording,
      stopVoiceoverRecording: state.stopVoiceoverRecording,
      cancelVoiceoverRecording: state.cancelVoiceoverRecording,
      tracks: state.tracks,
      playhead: state.playhead,
    }))
  );

  const [inputGain, setInputGain] = useState<number>(1.0); // Pre-fader multiplier (0.5 to 2.0)
  const [audioStreamLevel, setAudioStreamLevel] = useState<number>(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Filter audio tracks for voiceover destination
  const audioTracks = tracks.filter((t) => (t.trackType || t.type) === 'audio');

  // Load devices on open
  useEffect(() => {
    if (isVoiceoverModalOpen) {
      fetchAudioInputDevices();
    }
  }, [isVoiceoverModalOpen, fetchAudioInputDevices]);

  // Set default audio track if not set
  useEffect(() => {
    if (isVoiceoverModalOpen && !voiceoverTargetTrackId && audioTracks.length > 0) {
      setVoiceoverTargetTrackId(audioTracks[0].id);
    }
  }, [isVoiceoverModalOpen, voiceoverTargetTrackId, audioTracks, setVoiceoverTargetTrackId]);

  // Real-time Web Audio API monitoring for hardware VU level
  useEffect(() => {
    if (!isVoiceoverModalOpen) {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((tr) => tr.stop());
        mediaStreamRef.current = null;
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(() => {});
        audioContextRef.current = null;
      }
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
      return;
    }

    let isMounted = true;

    async function initAudioMonitoring() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) return;

        const constraints: MediaStreamConstraints = {
          audio: voiceoverSelectedDeviceId && voiceoverSelectedDeviceId !== 'default'
            ? { deviceId: { exact: voiceoverSelectedDeviceId } }
            : true,
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (!isMounted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        mediaStreamRef.current = stream;
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({
          sampleRate: 48000,
        });
        audioContextRef.current = ctx;

        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.3;
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        const updateMeter = () => {
          if (!isMounted) return;
          analyser.getByteFrequencyData(dataArray);

          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const avg = sum / dataArray.length;
          const norm = Math.min(1.0, (avg / 128.0) * inputGain);
          setAudioStreamLevel(norm);

          animFrameRef.current = requestAnimationFrame(updateMeter);
        };

        updateMeter();
      } catch (err) {
        console.warn('Microphone preview monitoring error:', err);
      }
    }

    initAudioMonitoring();

    return () => {
      isMounted = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((tr) => tr.stop());
        mediaStreamRef.current = null;
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(() => {});
        audioContextRef.current = null;
      }
    };
  }, [isVoiceoverModalOpen, voiceoverSelectedDeviceId, inputGain]);

  if (!isVoiceoverModalOpen) return null;

  // Active display level: live Web Audio monitor or Tauri backend level
  const effectiveLevel = Math.max(audioStreamLevel, voiceoverInputLevel);
  const effectivePeakDb = Math.max(
    effectiveLevel > 0.001 ? 20 * Math.log10(effectiveLevel) : -60,
    voiceoverPeakDb
  );

  const elapsedRecordingSec = isRecordingVoiceover
    ? Math.max(0, playhead - voiceoverRecordingStartSec)
    : 0;

  const formatElapsed = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = Math.floor(sec % 60);
    const ms = Math.floor((sec % 1) * 100);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 select-none">
      <div className="w-full max-w-lg bg-[#14161B] border border-[#222630] rounded-xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="px-5 py-4 bg-[#101217] border-b border-[#222630] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-lg ${isRecordingVoiceover ? 'bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse' : 'bg-[#00F0FF]/15 text-[#00F0FF] border border-[#00F0FF]/30'}`}>
              <Mic size={18} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#F0F3F8]">
                {isRecordingVoiceover ? 'Recording Voiceover...' : 'Live Voiceover Studio'}
              </h2>
              <p className="text-[11px] text-[#64748B]">
                {isRecordingVoiceover
                  ? `Recording in sync with timeline at ${formatElapsed(elapsedRecordingSec)}`
                  : 'Capture 48kHz pristine studio audio directly into your timeline'}
              </p>
            </div>
          </div>

          {!isRecordingVoiceover && (
            <button
              onClick={() => setIsVoiceoverModalOpen(false)}
              className="p-1 rounded-md text-[#64748B] hover:text-[#F0F3F8] hover:bg-[#1E222D] transition-colors cursor-pointer"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4">
          {/* 3-Second Countdown Overlay */}
          {voiceoverCountdown !== null && (
            <div className="py-6 flex flex-col items-center justify-center bg-gradient-to-b from-[#1C162E] to-[#0D0E11] rounded-xl border border-[#A855F7]/40 shadow-inner">
              <span className="text-5xl font-black text-[#00F0FF] animate-ping font-mono">
                {voiceoverCountdown}
              </span>
              <span className="text-xs text-[#8A92A6] mt-3 font-semibold tracking-wider uppercase">
                Stand by, recording starts in...
              </span>
            </div>
          )}

          {/* Recording Status & Waveform Pulse Banner */}
          {isRecordingVoiceover && (
            <div className="p-4 rounded-xl bg-gradient-to-r from-red-950/40 via-red-900/20 to-[#0D0E11] border border-red-500/40 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-red-500 animate-ping inline-block" />
                  <span className="text-xs font-bold text-red-400 uppercase tracking-widest">
                    ON AIR • LIVE
                  </span>
                </div>
                <span className="text-xl font-mono font-black text-white">
                  {formatElapsed(elapsedRecordingSec)}
                </span>
              </div>

              {/* Pulsing VU Level indicator */}
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] font-mono text-[#8A92A6]">
                  <span>VU Level</span>
                  <span className={effectivePeakDb > -3 ? 'text-red-400 font-bold' : 'text-emerald-400'}>
                    {effectivePeakDb.toFixed(1)} dB
                  </span>
                </div>
                <div className="w-full h-2.5 bg-[#14161B] rounded-full overflow-hidden p-0.5 border border-[#222630]">
                  <div
                    style={{ width: `${Math.round(effectiveLevel * 100)}%` }}
                    className={`h-full rounded-full transition-all duration-75 ${
                      effectivePeakDb > -3
                        ? 'bg-gradient-to-r from-emerald-500 via-amber-500 to-red-500'
                        : 'bg-gradient-to-r from-emerald-500 to-emerald-400'
                    }`}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Configuration Grid (When not actively recording) */}
          {!isRecordingVoiceover && voiceoverCountdown === null && (
            <>
              {/* Input Device Selection */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-semibold text-[#F0F3F8]">
                  <span className="flex items-center gap-1.5">
                    <Radio size={13} className="text-[#00F0FF]" />
                    <span>Microphone Input Device</span>
                  </span>
                  <button
                    onClick={() => fetchAudioInputDevices()}
                    className="text-[10px] text-[#00F0FF] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw size={10} />
                    <span>Refresh</span>
                  </button>
                </div>

                <select
                  value={voiceoverSelectedDeviceId}
                  onChange={(e) => setVoiceoverSelectedDeviceId(e.target.value)}
                  className="w-full bg-[#0D0E11] border border-[#222630] rounded-lg px-3 py-2 text-xs text-[#F0F3F8] focus:outline-none focus:border-[#00F0FF] cursor-pointer"
                >
                  {availableAudioDevices.map((dev) => (
                    <option key={dev.id} value={dev.id}>
                      {dev.name} {dev.isDefault ? '(System Default)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Target Track Destination */}
              <div className="space-y-1.5">
                <span className="text-xs font-semibold text-[#F0F3F8] flex items-center gap-1.5">
                  <Sliders size={13} className="text-[#A855F7]" />
                  <span>Target Audio Track</span>
                </span>
                <select
                  value={voiceoverTargetTrackId || ''}
                  onChange={(e) => setVoiceoverTargetTrackId(e.target.value || null)}
                  className="w-full bg-[#0D0E11] border border-[#222630] rounded-lg px-3 py-2 text-xs text-[#F0F3F8] focus:outline-none focus:border-[#A855F7] cursor-pointer"
                >
                  <option value="">Create New Audio Track ("Voiceover")</option>
                  {audioTracks.map((tr) => (
                    <option key={tr.id} value={tr.id}>
                      {tr.name} ({tr.clips.length} clips)
                    </option>
                  ))}
                </select>
              </div>

              {/* Live Pre-Fader Input VU Level Meter */}
              <div className="p-3 rounded-lg bg-[#0D0E11] border border-[#222630] space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-[#F0F3F8] flex items-center gap-1.5">
                    <Mic size={12} className={effectiveLevel > 0.05 ? 'text-emerald-400' : 'text-[#64748B]'} />
                    <span>Input Level Test</span>
                  </span>
                  <span className="font-mono text-[10px] text-[#8A92A6]">
                    {effectivePeakDb > -58 ? `${effectivePeakDb.toFixed(1)} dB` : 'Silent (-∞)'}
                  </span>
                </div>

                {/* Multi-segment LED style VU Bar */}
                <div className="w-full h-3 bg-[#14161B] rounded-full overflow-hidden p-0.5 border border-[#222630]">
                  <div
                    style={{ width: `${Math.round(effectiveLevel * 100)}%` }}
                    className={`h-full rounded-full transition-all duration-75 ${
                      effectivePeakDb > -3
                        ? 'bg-gradient-to-r from-emerald-500 via-amber-400 to-red-500'
                        : 'bg-gradient-to-r from-emerald-500 to-emerald-400'
                    }`}
                  />
                </div>

                {/* Pre-Fader Input Gain Slider */}
                <div className="flex items-center justify-between pt-1 text-[10px] text-[#64748B]">
                  <span>Mic Pre-Gain</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min="0.5"
                      max="2.5"
                      step="0.05"
                      value={inputGain}
                      onChange={(e) => setInputGain(Number(e.target.value))}
                      className="w-28 accent-[#00F0FF] h-1 bg-[#222630] rounded cursor-pointer"
                    />
                    <span className="font-mono text-[#F0F3F8] w-8 text-right">
                      {(inputGain * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Options & Safeguards Checkboxes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <label className="flex items-center gap-2 p-2.5 rounded-lg bg-[#0D0E11] border border-[#222630] cursor-pointer hover:border-[#384152] transition-colors">
                  <input
                    type="checkbox"
                    checked={voiceoverMuteTimeline}
                    onChange={(e) => setVoiceoverMuteTimeline(e.target.checked)}
                    className="rounded border-[#222630] accent-[#00F0FF]"
                  />
                  <div className="min-w-0">
                    <div className="font-medium text-[#F0F3F8]">Mute Timeline</div>
                    <div className="text-[10px] text-[#64748B]">Prevents mic echo/feedback</div>
                  </div>
                </label>

                <label className="flex items-center gap-2 p-2.5 rounded-lg bg-[#0D0E11] border border-[#222630] cursor-pointer hover:border-[#384152] transition-colors">
                  <input
                    type="checkbox"
                    checked={voiceoverUseCountdown}
                    onChange={(e) => setVoiceoverUseCountdown(e.target.checked)}
                    className="rounded border-[#222630] accent-[#00F0FF]"
                  />
                  <div className="min-w-0">
                    <div className="font-medium text-[#F0F3F8]">3s Countdown</div>
                    <div className="text-[10px] text-[#64748B]">Pre-roll cue before record</div>
                  </div>
                </label>
              </div>
            </>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="px-5 py-3.5 bg-[#101217] border-t border-[#222630] flex items-center justify-between">
          <div className="text-[11px] font-mono text-[#64748B]">
            Anchored at: <span className="text-[#00F0FF] font-bold">{playhead.toFixed(2)}s</span>
          </div>

          <div className="flex items-center gap-2">
            {isRecordingVoiceover ? (
              <>
                <button
                  onClick={cancelVoiceoverRecording}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-[#8A92A6] hover:text-[#F0F3F8] hover:bg-[#1C202B] border border-[#222630] cursor-pointer transition-colors"
                >
                  Discard
                </button>
                <button
                  onClick={stopVoiceoverRecording}
                  className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-bold flex items-center gap-2 cursor-pointer transition-colors shadow-[0_0_16px_rgba(239,68,68,0.5)]"
                >
                  <div className="w-3 h-3 rounded-xs bg-white" />
                  <span>Stop & Insert Audio</span>
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setIsVoiceoverModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-[#8A92A6] hover:text-[#F0F3F8] hover:bg-[#1C202B] cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => startVoiceoverRecording()}
                  className="px-4 py-2 rounded-lg bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white text-xs font-bold flex items-center gap-2 cursor-pointer transition-all shadow-[0_0_16px_rgba(239,68,68,0.4)]"
                >
                  <div className="w-2.5 h-2.5 rounded-full bg-white animate-pulse" />
                  <span>Start Recording</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
