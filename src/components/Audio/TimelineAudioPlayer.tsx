import React, { useEffect, useRef } from 'react';
import { useTimelineStore } from '../../store/timelineStore';
import {
  getInterpolatedVolumeDb,
  updateTrackDspParameters,
  loadAudioBuffer,
  getCachedAudioBuffer,
  startTrackBufferPlayback,
  stopTrackBufferPlayback,
  isTrackBufferActive,
  unlockAudioContext,
} from '../../utils/audioMastering';

export interface ActiveAudioClock {
  trackId: string;
  clipId: string;
  clipStart: number;
  inPoint: number;
  audio: HTMLAudioElement;
}

let activeAudioClock: ActiveAudioClock | null = null;

export function getActiveAudioClock(): ActiveAudioClock | null {
  return activeAudioClock;
}

export const TimelineAudioPlayer: React.FC = () => {
  const tracks = useTimelineStore((state) => state.tracks);
  const isPlaying = useTimelineStore((state) => state.isPlaying);
  const playhead = useTimelineStore((state) => state.playhead);
  const isRecordingVoiceover = useTimelineStore((state) => state.isRecordingVoiceover);
  const voiceoverMuteTimeline = useTimelineStore((state) => state.voiceoverMuteTimeline);

  const audioRefs = useRef<{ [trackId: string]: HTMLAudioElement }>({});

  // Pre-load all audio clips into decoded AudioBuffers so Web Audio DSP is instant
  useEffect(() => {
    const audioTracks = (tracks || []).filter(
      (t) => t.trackType === 'audio' || t.type === 'audio'
    );
    for (const t of audioTracks) {
      for (const c of t.clips || []) {
        const np = c.audioProcessing?.noiseProfile;
        const audioSrc = (np?.noiseReductionEnabled && np?.denoisedAudioPath) ? np.denoisedAudioPath : c.filePath;
        if (audioSrc) {
          loadAudioBuffer(audioSrc);
        }
      }
    }
  }, [tracks]);

  // Keep track of last played target times to detect scrub/seeks
  const lastTargetTimes = useRef<{ [trackId: string]: number }>({});

  useEffect(() => {
    const audioTracks = (tracks || []).filter(
      (t) => t.trackType === 'audio' || t.type === 'audio'
    );

    const hasAnySolo = audioTracks.some((t) => t.solo || t.isSolo);

    // Identify if any dialogue track is actively speaking for auto-ducking
    const isAnyDialogueActive = (tracks || []).some((t) => {
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

    let primaryClockRegistered = false;

    for (const track of audioTracks) {
      if (!audioRefs.current[track.id]) {
        const audio = new Audio();
        audio.preload = 'auto';
        audioRefs.current[track.id] = audio;
      }

      const audio = audioRefs.current[track.id];

      // Find active clip at playhead
      const activeClip = (track.clips || []).find((c) => {
        const s = c.startPositionSeconds ?? 0;
        const d = c.durationSeconds ?? 10;
        return playhead >= s && playhead < s + d;
      });

      if (activeClip && activeClip.filePath) {
        const np = activeClip.audioProcessing?.noiseProfile;
        let src = (np?.noiseReductionEnabled && np?.denoisedAudioPath) ? np.denoisedAudioPath : activeClip.filePath;

        if (
          !src.startsWith('blob:') &&
          !src.startsWith('http:') &&
          !src.startsWith('https:') &&
          !src.startsWith('data:') &&
          typeof window !== 'undefined'
        ) {
          try {
            const internals = (window as any).__TAURI_INTERNALS__;
            if (internals?.convertFileSrc) {
              src = internals.convertFileSrc(src, 'asset');
            }
          } catch {}
        }

        if (audio.src !== src) {
          audio.src = src;
        }

        // Precise timecode alignment
        const clipStart = activeClip.startPositionSeconds ?? 0;
        const inPoint = activeClip.inPointSeconds ?? 0;
        const targetTime = Math.max(0, playhead - clipStart + inPoint);

        // Mute / Solo calculation
        const isTrackMuted = track.muted || track.isMuted;
        const isMutedByRecord = isRecordingVoiceover && voiceoverMuteTimeline;
        const isMutedBySolo = hasAnySolo && !track.solo && !track.isSolo;
        const isMuted = Boolean(isTrackMuted || isMutedByRecord || isMutedBySolo);

        // Real-Time 3-Band Parametric EQ, Stereo Pan, Volume & Dynamic Ducking
        const volumeDb = getInterpolatedVolumeDb(activeClip, playhead - clipStart);
        const pan = activeClip.audioProcessing?.pan ?? activeClip.pan ?? 0;
        const bassGain = activeClip.audioProcessing?.bassGain ?? activeClip.bassGain ?? 0;
        const midGain = activeClip.audioProcessing?.midGain ?? activeClip.midGain ?? 0;
        const trebleGain = activeClip.audioProcessing?.trebleGain ?? activeClip.trebleGain ?? 0;

        const isDucked = Boolean(
          track.ducking?.duckingEnabled && (isAnyDialogueActive || isRecordingVoiceover)
        );
        const duckingDb = isDucked ? (track.ducking?.attenuationDb ?? -14) : 0;
        const totalDb = volumeDb + duckingDb;
        const linearGain = totalDb <= -58 ? 0 : Math.pow(10, totalDb / 20);

        // Update 3-Band Parametric EQ, Stereo Pan, Gain & Spectral Denoise directly on Web Audio DSP
        updateTrackDspParameters(track.id, {
          volumeDb,
          pan,
          bassGain,
          midGain,
          trebleGain,
          isMuted,
          duckingDb,
          noiseReductionEnabled: Boolean(activeClip.audioProcessing?.noiseProfile?.noiseReductionEnabled),
          reductionDb: activeClip.audioProcessing?.noiseProfile?.reductionIntensityDb,
          ambientRecoveryEnabled: Boolean(activeClip.audioProcessing?.noiseProfile?.ambientRecoveryEnabled),
          ambientIntensity: activeClip.audioProcessing?.noiseProfile?.ambientFillIntensity,
        });

        const cachedBuf = getCachedAudioBuffer(activeClip.filePath);
        if (!cachedBuf) {
          loadAudioBuffer(activeClip.filePath);
        }

        const lastTarget = lastTargetTimes.current[track.id] ?? targetTime;
        const isSeekJump = Math.abs(targetTime - lastTarget) > 0.08;
        lastTargetTimes.current[track.id] = targetTime;

        if (isPlaying && !isMuted) {
          unlockAudioContext();

          if (cachedBuf) {
            // Buffer is available: Route pure audio through 3-Band EQ and Stereo Panner
            if (!isTrackBufferActive(track.id) || isSeekJump) {
              startTrackBufferPlayback(track.id, cachedBuf, targetTime);
            }
            // Silence HTML audio element so we only hear the parametric EQ
            audio.muted = true;
            audio.volume = 0;
          } else {
            // Fallback while buffer is first decoding
            stopTrackBufferPlayback(track.id);
            audio.muted = isMuted || linearGain === 0;
            audio.volume = isMuted ? 0 : Math.max(0, Math.min(1.0, linearGain));
            if (audio.paused) {
              audio.currentTime = targetTime;
              audio.play().catch(() => {});
            }
          }

          // Register active audio track as Master Audio Clock
          if (!primaryClockRegistered) {
            activeAudioClock = {
              trackId: track.id,
              clipId: activeClip.id,
              clipStart,
              inPoint,
              audio,
            };
            primaryClockRegistered = true;
          }
        } else {
          stopTrackBufferPlayback(track.id);
          if (!audio.paused) {
            audio.pause();
          }
        }
      } else {
        stopTrackBufferPlayback(track.id);
        if (!audio.paused) {
          audio.pause();
        }
      }
    }

    if (!primaryClockRegistered) {
      activeAudioClock = null;
    }

    // Cleanup audio elements of deleted tracks
    const currentTrackIds = new Set(audioTracks.map((t) => t.id));
    for (const [id, a] of Object.entries(audioRefs.current)) {
      if (!currentTrackIds.has(id)) {
        a.pause();
        a.src = '';
        delete audioRefs.current[id];
      }
    }
  }, [tracks, isPlaying, playhead, isRecordingVoiceover, voiceoverMuteTimeline]);

  // Pause all on unmount
  useEffect(() => {
    return () => {
      activeAudioClock = null;
      for (const [id, a] of Object.entries(audioRefs.current)) {
        stopTrackBufferPlayback(id);
        a.pause();
        a.src = '';
      }
      audioRefs.current = {};
    };
  }, []);

  return null;
};
