import React, { useEffect, useRef } from 'react';
import { formatTimecode } from '../../utils/timecode';

interface LiveRecordingWaveformProps {
  peaks: number[];
  widthPx: number;
  heightPx?: number;
  durationSec: number;
  fps?: number;
}

export const LiveRecordingWaveform: React.FC<LiveRecordingWaveformProps> = ({
  peaks = [],
  widthPx,
  heightPx = 56,
  durationSec,
  fps = 30,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || widthPx <= 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const targetW = Math.max(24, Math.round(widthPx));
    const targetH = heightPx;
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Subtle dark-red translucent background
    ctx.fillStyle = 'rgba(28, 10, 14, 0.75)';
    ctx.fillRect(0, 0, w, h);

    const baseY = h - 4;
    const maxAvailableH = h - 8;

    // Bottom baseline
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, baseY);
    ctx.lineTo(w, baseY);
    ctx.stroke();

    // Color gradient matching studio aesthetic: platinum white crest fading into coral/ruby red
    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, '#FFFFFF');
    gradient.addColorStop(0.35, 'rgba(254, 202, 202, 0.95)');
    gradient.addColorStop(1, 'rgba(239, 68, 68, 0.75)');
    ctx.fillStyle = gradient;

    const totalPeaks = peaks.length;

    // Render dense live waveform columns across canvas width
    for (let x = 0; x < w; x++) {
      let amp = 0.03; // Subtle resting live noise floor
      if (totalPeaks > 0) {
        const progress = x / Math.max(1, w);
        const peakIdx = Math.min(totalPeaks - 1, Math.floor(progress * totalPeaks));
        const pNext = Math.min(totalPeaks - 1, peakIdx + 1);
        const frac = progress * totalPeaks - peakIdx;
        const amp0 = peaks[peakIdx] ?? 0;
        const amp1 = peaks[pNext] ?? 0;
        amp = Math.max(amp, amp0 * (1 - frac) + amp1 * frac);
      }

      // High-frequency acoustic spike jitter
      const microJitter = (Math.sin(x * 12.9898 + 45.23) * 43758.5453) % 1;
      const spikeFactor = 0.75 + 0.25 * Math.abs(microJitter);
      const barH = Math.max(1.5, amp * maxAvailableH * spikeFactor);
      const topY = baseY - barH;

      ctx.fillRect(x, topY, 1, barH);
    }

    // Laser-red vertical recording needle at the active edge
    ctx.fillStyle = '#EF4444';
    ctx.shadowColor = '#EF4444';
    ctx.shadowBlur = 6;
    ctx.fillRect(w - 2, 0, 2, h);
    ctx.shadowBlur = 0;
  }, [peaks, widthPx, heightPx]);

  return (
    <div className="absolute inset-0 w-full h-full rounded border-2 border-red-500 overflow-hidden shadow-[0_0_16px_rgba(239,68,68,0.45)] select-none pointer-events-none">
      <canvas
        ref={canvasRef}
        width={Math.max(24, Math.round(widthPx))}
        height={heightPx}
        className="w-full h-full block"
      />

      {/* Floating Live Recording Badge */}
      <div className="absolute top-1.5 left-2 flex items-center gap-1.5 px-2 py-0.5 rounded bg-black/60 backdrop-blur-xs border border-red-500/40 text-[10px] font-mono font-bold text-white shadow-md">
        <span className="w-2 h-2 rounded-full bg-red-500 animate-ping shrink-0 shadow-[0_0_8px_#ef4444]" />
        <span className="text-red-400 font-extrabold tracking-wider">REC</span>
        <span className="text-white shrink-0">
          ({formatTimecode(durationSec, fps)})
        </span>
      </div>
    </div>
  );
};
