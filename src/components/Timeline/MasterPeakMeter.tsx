import React, { useEffect, useRef, useState } from 'react';
import { useTimelineStore } from '../../store/timelineStore';

export const MasterPeakMeter: React.FC = () => {
  const isPlaying = useTimelineStore((state) => state.isPlaying);
  const masterMeterL = useTimelineStore((state) => state.masterMeterL);
  const masterMeterR = useTimelineStore((state) => state.masterMeterR);
  const setMasterMeters = useTimelineStore((state) => state.setMasterMeters);

  const [hasClipped, setHasClipped] = useState(false);
  const animFrameRef = useRef<number | null>(null);
  const levelRef = useRef({ l: -60, r: -60 });

  useEffect(() => {
    let lastTime = performance.now();

    const loop = (now: number) => {
      const dt = (now - lastTime) / 1000;
      lastTime = now;

      if (isPlaying) {
        // Dynamic realistic VU levels during playback
        // Simulates audio program peaks with natural variance & rhythmic spikes
        const t = now * 0.003;
        const baseSignal = Math.sin(t * 1.5) * 0.4 + Math.sin(t * 4.2) * 0.3 + 0.3;
        const transientNoise = Math.random() * 0.15;
        const instantAmp = Math.max(0.01, Math.min(1.0, baseSignal + transientNoise));

        // Map amplitude [0..1] to dB [-60..+1]
        const targetDbL = Math.max(-60, Math.min(1.0, 20 * Math.log10(instantAmp * 0.85 + 0.001) + 4));
        const targetDbR = Math.max(-60, Math.min(1.0, 20 * Math.log10(instantAmp * 0.88 + 0.001) + 4));

        // Attack: fast rise (30ms), Release: logarithmic decay (300ms)
        const attackRate = 1 - Math.exp(-dt / 0.03);
        const releaseRate = 1 - Math.exp(-dt / 0.35);

        levelRef.current.l += (targetDbL > levelRef.current.l ? attackRate : releaseRate) * (targetDbL - levelRef.current.l);
        levelRef.current.r += (targetDbR > levelRef.current.r ? attackRate : releaseRate) * (targetDbR - levelRef.current.r);

        if (levelRef.current.l >= 0 || levelRef.current.r >= 0) {
          setHasClipped(true);
        }

        setMasterMeters(levelRef.current.l, levelRef.current.r);
      } else {
        // Smoothly decay down to -60dB when stopped
        const decayRate = 1 - Math.exp(-dt / 0.18);
        levelRef.current.l += decayRate * (-60 - levelRef.current.l);
        levelRef.current.r += decayRate * (-60 - levelRef.current.r);
        setMasterMeters(levelRef.current.l, levelRef.current.r);
      }

      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [isPlaying, setMasterMeters]);

  // Convert dB (-60 to +3) to percentage height (0 to 100)
  const dbToPercent = (db: number) => {
    if (db <= -60) return 0;
    const clamped = Math.max(-60, Math.min(3, db));
    return ((clamped + 60) / 63) * 100;
  };

  const lPercent = dbToPercent(masterMeterL);
  const rPercent = dbToPercent(masterMeterR);

  return (
    <div
      className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-[#0D0E11] border border-[#222630] h-7 select-none cursor-pointer group"
      title={`Master Output VU Meter\nL: ${masterMeterL.toFixed(1)} dBFS | R: ${masterMeterR.toFixed(1)} dBFS\nClick to reset clip indicator`}
      onClick={() => setHasClipped(false)}
    >
      {/* Channel Labels */}
      <div className="flex flex-col text-[7px] font-mono font-bold leading-[9px] text-[#64748B]">
        <span>L</span>
        <span>R</span>
      </div>

      {/* Dual Horizontal Meter Bars */}
      <div className="flex flex-col gap-1 w-14">
        {/* Left Channel */}
        <div className="w-full h-1.5 bg-[#181B22] rounded-xs overflow-hidden relative">
          <div
            style={{ width: `${lPercent}%` }}
            className={`h-full transition-all duration-75 ${
              masterMeterL > -3
                ? 'bg-gradient-to-r from-[#10B981] via-[#F59E0B] to-[#EF4444]'
                : masterMeterL > -12
                ? 'bg-gradient-to-r from-[#10B981] to-[#F59E0B]'
                : 'bg-[#10B981]'
            }`}
          />
        </div>

        {/* Right Channel */}
        <div className="w-full h-1.5 bg-[#181B22] rounded-xs overflow-hidden relative">
          <div
            style={{ width: `${rPercent}%` }}
            className={`h-full transition-all duration-75 ${
              masterMeterR > -3
                ? 'bg-gradient-to-r from-[#10B981] via-[#F59E0B] to-[#EF4444]'
                : masterMeterR > -12
                ? 'bg-gradient-to-r from-[#10B981] to-[#F59E0B]'
                : 'bg-[#10B981]'
            }`}
          />
        </div>
      </div>

      {/* 0dB / CLIP indicator badge */}
      <div
        className={`px-1 py-0.5 rounded text-[8px] font-mono font-bold leading-none uppercase transition-all ${
          hasClipped
            ? 'bg-red-600 text-white shadow-[0_0_8px_#ef4444] animate-pulse'
            : 'bg-[#1A1D24] text-[#525D73]'
        }`}
        title={hasClipped ? 'Digital Hard Clipping Detected! Click to reset.' : 'Peak Headroom Normal (< 0dB)'}
      >
        CLIP
      </div>
    </div>
  );
};
