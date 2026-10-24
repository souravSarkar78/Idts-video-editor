import React, { useEffect, useRef } from 'react';
import { useTimelineStore } from '../../store/timelineStore';

interface ClipAudioWaveformProps {
  filePath: string;
  color?: string;
  widthPx: number;
  heightPx?: number;
  inPointSeconds?: number;
  durationSeconds?: number;
  totalDurationSeconds?: number;
}

export const ClipAudioWaveform: React.FC<ClipAudioWaveformProps> = React.memo(({
  filePath,
  color = '#FFFFFF',
  widthPx,
  heightPx = 28,
  inPointSeconds = 0,
  durationSeconds = 10,
  totalDurationSeconds = 60,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rawPeaks = useTimelineStore((state) => state.waveformData[filePath]);
  const peaks = rawPeaks || [];
  const fetchWaveformData = useTimelineStore((state) => state.fetchWaveformData);

  useEffect(() => {
    if (filePath && (!rawPeaks || rawPeaks.length === 0)) {
      fetchWaveformData(filePath);
    }
  }, [filePath, rawPeaks, fetchWaveformData]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || widthPx <= 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Ensure canvas internal pixel buffer matches container dimensions
    const targetW = Math.max(24, Math.round(widthPx));
    const targetH = heightPx;
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const baseY = h - 2;
    const maxAvailableH = h - 4;

    // Subtle bottom baseline
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, baseY);
    ctx.lineTo(w, baseY);
    ctx.stroke();

    // Active peak array: use real peaks if loaded, or generate immediate realistic procedural peaks
    let activePeaks = peaks || [];
    if (activePeaks.length === 0 && filePath) {
      const generated: number[] = [];
      let hash = 0;
      for (let i = 0; i < filePath.length; i++) {
        hash = (hash << 5) - hash + filePath.charCodeAt(i);
        hash |= 0;
      }

      // Generate realistic natural audio profile matching reference image
      const totalPoints = 360;
      for (let i = 0; i < totalPoints; i++) {
        const prog = i / (totalPoints - 1);

        // Soft ramp up at start, soft decay at end
        let edgeEnvelope = 1.0;
        if (prog < 0.08) {
          edgeEnvelope = prog / 0.08;
        } else if (prog > 0.92) {
          edgeEnvelope = (1.0 - prog) / 0.08;
        }

        // Multi-frequency audio dynamics
        const macroWave =
          Math.sin(i * 0.04 + hash * 0.02) * 0.35 +
          Math.cos(i * 0.12 + hash * 0.04) * 0.25 +
          0.6;

        const microJitter =
          Math.sin(i * 0.85) * 0.15 +
          Math.cos(i * 1.7) * 0.1;

        const val = Math.min(1.0, Math.max(0.04, (macroWave + microJitter) * edgeEnvelope));
        generated.push(val);
      }
      activePeaks = generated;
    }

    if (!activePeaks || activePeaks.length === 0) {
      return;
    }

    // Calculate slice of peaks corresponding to this clip segment
    const totalSec = totalDurationSeconds > 0 ? totalDurationSeconds : 60;
    const startRatio = inPointSeconds / totalSec;
    const durRatio = durationSeconds / totalSec;
    const startIdx = Math.max(0, Math.floor(startRatio * activePeaks.length));
    const count = Math.max(8, Math.floor(durRatio * activePeaks.length));
    const slice = activePeaks.slice(startIdx, Math.min(activePeaks.length, startIdx + count));

    if (slice.length === 0) return;

    // High-frequency deterministic noise generator for natural acoustic needle crests
    const getMicroNoise = (xCoord: number, seed: number) => {
      const s = Math.sin(xCoord * 12.9898 + (seed % 100) * 78.233) * 43758.5453;
      return s - Math.floor(s);
    };

    // Color gradient matching reference image: platinum white crest fading into silver-slate
    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, '#FFFFFF');
    gradient.addColorStop(0.35, 'rgba(241, 245, 249, 0.95)');
    gradient.addColorStop(1, 'rgba(148, 163, 184, 0.75)');

    ctx.fillStyle = gradient;

    // Render bottom-anchored rectified audio waveform (dense vertical spikes from baseline up)
    for (let x = 0; x < w; x += 1) {
      const progress = x / w;
      const peakIdx = Math.min(slice.length - 1, Math.floor(progress * slice.length));
      const pNext = Math.min(slice.length - 1, peakIdx + 1);
      const frac = progress * slice.length - peakIdx;
      const amp0 = slice[peakIdx] ?? 0;
      const amp1 = slice[pNext] ?? 0;
      const envelope = amp0 * (1 - frac) + amp1 * frac;

      if (envelope <= 0.015) {
        // Flat line on complete silence
        continue;
      }

      // Add high-frequency acoustic texture (spikes)
      const noise = getMicroNoise(x, 57);
      const spikeFactor = 0.72 + 0.28 * noise;
      const barH = Math.max(1.5, envelope * maxAvailableH * spikeFactor);
      const topY = baseY - barH;

      ctx.fillRect(x, topY, 1, barH);
    }
  }, [peaks, widthPx, heightPx, color, inPointSeconds, durationSeconds, totalDurationSeconds]);

  return (
    <canvas
      ref={canvasRef}
      width={Math.max(24, Math.round(widthPx))}
      height={heightPx}
      className="absolute inset-0 w-full h-full pointer-events-none opacity-85"
    />
  );
});
ClipAudioWaveform.displayName = 'ClipAudioWaveform';
