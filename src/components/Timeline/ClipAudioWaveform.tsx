import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useTimelineStore } from '../../store/timelineStore';
import { VolumeKeyframePoint } from '../../types/ipc';

interface ClipAudioWaveformProps {
  filePath: string;
  clipId?: string;
  volumeDb?: number;
  volumeKeyframes?: VolumeKeyframePoint[];
  color?: string;
  widthPx: number;
  heightPx?: number;
  inPointSeconds?: number;
  durationSeconds?: number;
  totalDurationSeconds?: number;
  noiseReductionEnabled?: boolean;
  reductionIntensityDb?: number;
  sensitivity?: number;
}

export const ClipAudioWaveform: React.FC<ClipAudioWaveformProps> = React.memo(({
  filePath,
  clipId,
  volumeDb = 0,
  volumeKeyframes = [],
  color = '#FFFFFF',
  widthPx,
  heightPx = 28,
  inPointSeconds = 0,
  durationSeconds = 10,
  totalDurationSeconds = 60,
  noiseReductionEnabled = false,
  reductionIntensityDb = 12.0,
  sensitivity = 6.0,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rawPeaks = useTimelineStore((state) => state.waveformData[filePath]);
  const peaks = rawPeaks || [];
  const fetchWaveformData = useTimelineStore((state) => state.fetchWaveformData);
  const addOrUpdateVolumeKeyframe = useTimelineStore((state) => state.addOrUpdateVolumeKeyframe);
  const removeVolumeKeyframe = useTimelineStore((state) => state.removeVolumeKeyframe);

  const [activeDragIndex, setActiveDragIndex] = useState<number | null>(null);
  const dragStartRef = useRef<{ clientX: number; clientY: number; origTime: number; origValue: number } | null>(null);

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
          Math.abs(Math.sin(i * 0.04 + hash * 0.02) * 0.5 +
          Math.cos(i * 0.12 + hash * 0.04) * 0.35);

        const microJitter =
          Math.sin(i * 0.85) * 0.08 +
          Math.cos(i * 1.7) * 0.05;

        const val = Math.min(1.0, Math.max(0.01, (macroWave + microJitter) * edgeEnvelope));
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

    // Color gradient: Cyan/Emerald tinted crest for clean denoised audio, platinum white for raw audio
    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    if (noiseReductionEnabled) {
      gradient.addColorStop(0, '#00F0FF');
      gradient.addColorStop(0.35, 'rgba(0, 240, 255, 0.90)');
      gradient.addColorStop(1, 'rgba(16, 185, 129, 0.70)');
    } else {
      gradient.addColorStop(0, '#FFFFFF');
      gradient.addColorStop(0.35, 'rgba(241, 245, 249, 0.95)');
      gradient.addColorStop(1, 'rgba(148, 163, 184, 0.75)');
    }

    ctx.fillStyle = gradient;

    // Render bottom-anchored rectified audio waveform (dense vertical spikes from baseline up)
    for (let x = 0; x < w; x += 1) {
      const progress = x / w;
      const peakIdx = Math.min(slice.length - 1, Math.floor(progress * slice.length));
      const pNext = Math.min(slice.length - 1, peakIdx + 1);
      const frac = progress * slice.length - peakIdx;
      const amp0 = slice[peakIdx] ?? 0;
      const amp1 = slice[pNext] ?? 0;
      let envelope = amp0 * (1 - frac) + amp1 * frac;

      if (noiseReductionEnabled) {
        const nrDb = reductionIntensityDb ?? 12.0;
        const sens = sensitivity ?? 6.0;
        const reductionFactor = Math.pow(10, -nrDb / 20);
        // Dynamic noise threshold based on sensitivity (camera hiss is ~0.15 - 0.35)
        const noiseGateThreshold = Math.min(0.45, 0.12 + (sens / 12.0) * 0.28);
        if (envelope < noiseGateThreshold) {
          const ratio = Math.max(0, envelope / noiseGateThreshold);
          envelope = envelope * (reductionFactor + (1 - reductionFactor) * Math.pow(ratio, 2.0));
        }
      }

      if (envelope <= 0.02) {
        // Draw subtle flat baseline for cleaned silence
        ctx.fillRect(x, baseY - 1, 1, 1);
        continue;
      }

      // Add high-frequency acoustic texture (spikes)
      const noise = getMicroNoise(x, 57);
      const spikeFactor = 0.72 + 0.28 * noise;
      const barH = Math.max(1.5, envelope * maxAvailableH * spikeFactor);
      const topY = baseY - barH;

      ctx.fillRect(x, topY, 1, barH);
    }
  }, [peaks, widthPx, heightPx, color, inPointSeconds, durationSeconds, totalDurationSeconds, noiseReductionEnabled, reductionIntensityDb, sensitivity]);

  // Volume Rubber-Banding Coordinate Helpers
  // Map dB (-60 to +12) to Y pixel coordinate: +12dB is at 4px, 0dB is ~middle-high, -60dB is at (heightPx - 4px)
  const dbToY = useCallback((db: number): number => {
    const clamped = Math.max(-60, Math.min(12, db));
    const usableH = Math.max(12, heightPx - 8);
    const fraction = (12 - clamped) / 72; // 0 at +12dB, 1 at -60dB
    return 4 + fraction * usableH;
  }, [heightPx]);

  const yToDb = useCallback((y: number): number => {
    const usableH = Math.max(12, heightPx - 8);
    const fraction = Math.max(0, Math.min(1, (y - 4) / usableH));
    const db = 12 - fraction * 72;
    return Number(db.toFixed(1));
  }, [heightPx]);

  const timeToX = useCallback((t: number): number => {
    const dur = Math.max(0.1, durationSeconds);
    const frac = Math.max(0, Math.min(1, t / dur));
    return frac * widthPx;
  }, [durationSeconds, widthPx]);

  const xToTime = useCallback((x: number): number => {
    const dur = Math.max(0.1, durationSeconds);
    const frac = Math.max(0, Math.min(1, x / Math.max(1, widthPx)));
    return Number((frac * dur).toFixed(2));
  }, [durationSeconds, widthPx]);

  // Handle double clicking on waveform to insert a volume keyframe
  const handleEnvelopeDoubleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!clipId) return;
    e.stopPropagation();
    e.preventDefault();

    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const newTime = xToTime(clickX);
    const newDb = yToDb(clickY);

    addOrUpdateVolumeKeyframe(clipId, newTime, newDb);
  };

  // Start dragging a keyframe point
  const handleStartDragKeyframe = (e: React.MouseEvent, index: number, point: VolumeKeyframePoint) => {
    if (!clipId) return;
    e.stopPropagation();
    e.preventDefault();

    // Alt+Click removes keyframe
    if (e.altKey) {
      removeVolumeKeyframe(clipId, point.time);
      return;
    }

    setActiveDragIndex(index);
    dragStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      origTime: point.time,
      origValue: point.value,
    };

    const handlePointerMove = (moveEvt: MouseEvent) => {
      if (!dragStartRef.current || !clipId) return;
      const deltaX = moveEvt.clientX - dragStartRef.current.clientX;
      const deltaY = moveEvt.clientY - dragStartRef.current.clientY;

      const deltaTime = (deltaX / Math.max(1, widthPx)) * durationSeconds;
      const usableH = Math.max(12, heightPx - 8);
      const deltaDb = -(deltaY / usableH) * 72;

      const newTime = Math.max(0, Math.min(durationSeconds, dragStartRef.current.origTime + deltaTime));
      const newDb = Math.max(-60, Math.min(12, dragStartRef.current.origValue + deltaDb));

      addOrUpdateVolumeKeyframe(clipId, Number(newTime.toFixed(2)), Number(newDb.toFixed(1)));
    };

    const handlePointerUp = () => {
      setActiveDragIndex(null);
      dragStartRef.current = null;
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseup', handlePointerUp);
    };

    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', handlePointerUp);
  };

  // Generate SVG Path for Rubber-Band Envelope
  const sortedPoints = [...volumeKeyframes].sort((a, b) => a.time - b.time);
  let pathD = '';
  let fillD = '';

  if (sortedPoints.length === 0) {
    const flatY = dbToY(volumeDb);
    pathD = `M 0 ${flatY} L ${widthPx} ${flatY}`;
    fillD = `M 0 ${heightPx} L 0 ${flatY} L ${widthPx} ${flatY} L ${widthPx} ${heightPx} Z`;
  } else {
    const coords: { x: number; y: number }[] = [];

    // Left edge
    if (sortedPoints[0].time > 0) {
      coords.push({ x: 0, y: dbToY(sortedPoints[0].value) });
    }

    for (const pt of sortedPoints) {
      coords.push({ x: timeToX(pt.time), y: dbToY(pt.value) });
    }

    // Right edge
    const last = sortedPoints[sortedPoints.length - 1];
    if (last.time < durationSeconds) {
      coords.push({ x: widthPx, y: dbToY(last.value) });
    }

    // Build SVG Path
    pathD = `M ${coords[0].x} ${coords[0].y}`;
    for (let i = 1; i < coords.length; i++) {
      pathD += ` L ${coords[i].x} ${coords[i].y}`;
    }

    fillD = `${pathD} L ${widthPx} ${heightPx} L 0 ${heightPx} Z`;
  }

  return (
    <div className="absolute inset-0 w-full h-full select-none">
      {/* Audio Waveform Canvas */}
      <canvas
        ref={canvasRef}
        width={Math.max(24, Math.round(widthPx))}
        height={heightPx}
        className="absolute inset-0 w-full h-full pointer-events-none opacity-85"
      />

      {/* Interactive Rubber-Band Volume Envelope SVG Overlay */}
      {clipId && (
        <svg
          width={widthPx}
          height={heightPx}
          onDoubleClick={handleEnvelopeDoubleClick}
          className="absolute inset-0 w-full h-full z-20 overflow-visible cursor-crosshair group/envelope"
        >
          {/* Subtle translucent fill below envelope line */}
          <path d={fillD} fill="rgba(16, 185, 129, 0.08)" pointerEvents="none" />

          {/* Envelope Rubber-Band Line */}
          <path
            d={pathD}
            fill="none"
            stroke="#10B981"
            strokeWidth={1.5}
            strokeDasharray={sortedPoints.length === 0 ? '4 2' : undefined}
            className="transition-colors hover:stroke-[#00F0FF] hover:stroke-[2]"
            pointerEvents="stroke"
          />

          {/* Keyframe Point Dots */}
          {sortedPoints.map((pt, idx) => {
            const cx = timeToX(pt.time);
            const cy = dbToY(pt.value);
            const isDragging = activeDragIndex === idx;

            return (
              <g key={`${pt.time}-${idx}`} className="cursor-grab active:cursor-grabbing">
                <title>{`Volume Keyframe: ${pt.value > 0 ? `+${pt.value}` : pt.value} dB at ${pt.time.toFixed(2)}s\n(Drag to adjust, Alt+Click or Right-Click to delete)`}</title>
                {/* Large transparent hit area */}
                <circle
                  cx={cx}
                  cy={cy}
                  r={8}
                  fill="transparent"
                  onMouseDown={(e) => handleStartDragKeyframe(e, idx, pt)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    removeVolumeKeyframe(clipId, pt.time);
                  }}
                />
                {/* Visual Dot */}
                <circle
                  cx={cx}
                  cy={cy}
                  r={isDragging ? 5 : 3.5}
                  fill={isDragging ? '#00F0FF' : '#10B981'}
                  stroke="#FFFFFF"
                  strokeWidth={1.5}
                  className="transition-all hover:scale-125 pointer-events-none shadow-sm"
                />
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
});
ClipAudioWaveform.displayName = 'ClipAudioWaveform';
