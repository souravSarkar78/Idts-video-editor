import React, { useEffect, useRef, useMemo } from 'react';

export interface ContinuousWaveformProps {
  /** Raw PCM audio data (Float32Array or array of numbers in range -1.0 to 1.0, or 0.0 to 1.0 amplitudes) */
  pcmData?: Float32Array | number[];
  /** Optional Web Audio API AudioBuffer */
  audioBuffer?: AudioBuffer;
  /** Visual canvas width in CSS pixels */
  width: number;
  /** Visual canvas height in CSS pixels */
  height: number;
  /** Waveform line stroke color (default: '#7B88EB' soft lavender/blue) */
  strokeColor?: string;
  /** 0 dB silence center baseline color (default: '#3A3D4D') */
  baselineColor?: string;
  /** Line width in CSS pixels (default: 1.0) */
  lineWidth?: number;
  /** Zoom level multiplier (1.0 = fit full buffer, > 1.0 zooms in) */
  zoomLevel?: number;
  /** Horizontal scroll offset (0.0 = start, 1.0 = end of audio) */
  scrollOffset?: number;
  /** Noise floor / silence clamp threshold (default: 0.005) */
  silenceThreshold?: number;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Pure high-performance render function to draw a continuous polyline outline (oscillogram)
 * on any HTML5 CanvasRenderingContext2D with Retina/HiDPI support.
 */
export function renderContinuousOscillogram(
  ctx: CanvasRenderingContext2D,
  data: Float32Array | number[] | AudioBuffer,
  options: {
    width: number;
    height: number;
    strokeColor?: string;
    baselineColor?: string;
    lineWidth?: number;
    zoomLevel?: number;
    scrollOffset?: number;
    silenceThreshold?: number;
    dpr?: number;
  }
): void {
  const {
    width: w,
    height: h,
    strokeColor = '#7B88EB',
    baselineColor = '#3A3D4D',
    lineWidth = 1.0,
    zoomLevel = 1.0,
    scrollOffset = 0.0,
    silenceThreshold = 0.005,
    dpr = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1,
  } = options;

  if (w <= 0 || h <= 0) return;

  const canvas = ctx.canvas;
  const targetBufferW = Math.max(1, Math.round(w * dpr));
  const targetBufferH = Math.max(1, Math.round(h * dpr));

  if (canvas.width !== targetBufferW || canvas.height !== targetBufferH) {
    canvas.width = targetBufferW;
    canvas.height = targetBufferH;
  }

  // Work in CSS pixel coordinates with DPR scaling
  ctx.save();
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, h);

  const midY = h / 2;
  const usableH = Math.max(2, midY - 2);

  // 1. Draw Zero-Crossing Baseline at exactly 50% track height (0 dB silence)
  ctx.strokeStyle = baselineColor;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, midY);
  ctx.lineTo(w, midY);
  ctx.stroke();

  // Extract PCM channel samples
  let samples: Float32Array | number[];
  if ('getChannelData' in data && typeof data.getChannelData === 'function') {
    samples = data.getChannelData(0);
  } else {
    samples = data as (Float32Array | number[]);
  }

  const totalSamples = samples.length;
  if (!samples || totalSamples === 0) {
    ctx.restore();
    return;
  }

  // Calculate visible window based on zoomLevel and scrollOffset
  const zoom = Math.max(1.0, zoomLevel);
  const visibleFraction = 1.0 / zoom;
  const maxOffset = Math.max(0, 1.0 - visibleFraction);
  const clampedOffset = Math.max(0, Math.min(maxOffset, scrollOffset));

  const startSample = Math.floor(clampedOffset * totalSamples);
  const windowSampleCount = Math.max(1, Math.floor(visibleFraction * totalSamples));
  const endSample = Math.min(totalSamples, startSample + windowSampleCount);
  const visibleSamples = endSample - startSample;

  if (visibleSamples <= 0) {
    ctx.restore();
    return;
  }

  // 2. Continuous Line / Polyline Oscillogram (True Bipolar Min-Max Peak-to-Peak)
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.beginPath();
  let isFirst = true;

  for (let x = 0; x < w; x += 2) {
    const bucketStartRatio = x / w;
    const bucketEndRatio = (x + 1) / w;

    const idx0 = startSample + Math.floor(bucketStartRatio * visibleSamples);
    const idx1 = Math.max(idx0 + 1, startSample + Math.floor(bucketEndRatio * visibleSamples));

    let minVal = 0;
    let maxVal = 0;

    for (let k = idx0; k < idx1 && k < totalSamples; k++) {
      const s = samples[k];
      if (s < minVal) minVal = s;
      if (s > maxVal) maxVal = s;
    }

    // Clamp noise floor to center baseline
    if (Math.abs(minVal) < silenceThreshold && Math.abs(maxVal) < silenceThreshold) {
      minVal = 0;
      maxVal = 0;
    }

    // Map bipolar audio (-1.0 to +1.0) symmetrically to pixel space:
    // Positive samples rise upwards (-Y), negative samples descend downwards (+Y)
    const yMin = midY - maxVal * usableH;
    const yMax = midY - minVal * usableH;

    if (isFirst) {
      ctx.moveTo(x, yMin);
      ctx.lineTo(x, yMax);
      isFirst = false;
    } else {
      ctx.lineTo(x, yMin);
      ctx.lineTo(x, yMax);
    }
  }

  ctx.stroke();
  ctx.restore();
}

/**
 * Reusable React Continuous Waveform (Oscillogram) Component
 */
export const ContinuousWaveform: React.FC<ContinuousWaveformProps> = ({
  pcmData,
  audioBuffer,
  width,
  height,
  strokeColor = '#7B88EB',
  baselineColor = '#3A3D4D',
  lineWidth = 1.0,
  zoomLevel = 1.0,
  scrollOffset = 0.0,
  silenceThreshold = 0.005,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const activeData = useMemo(() => {
    if (audioBuffer) return audioBuffer;
    if (pcmData && pcmData.length > 0) return pcmData;
    return null;
  }, [audioBuffer, pcmData]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || width <= 0 || height <= 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (!activeData) {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      // Draw flat silence baseline
      const midY = height / 2;
      ctx.strokeStyle = baselineColor;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, midY);
      ctx.lineTo(width, midY);
      ctx.stroke();
      ctx.restore();
      return;
    }

    renderContinuousOscillogram(ctx, activeData, {
      width,
      height,
      strokeColor,
      baselineColor,
      lineWidth,
      zoomLevel,
      scrollOffset,
      silenceThreshold,
      dpr: window.devicePixelRatio || 1,
    });
  }, [
    activeData,
    width,
    height,
    strokeColor,
    baselineColor,
    lineWidth,
    zoomLevel,
    scrollOffset,
    silenceThreshold,
  ]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: `${width}px`, height: `${height}px` }}
      className={`pointer-events-none ${className}`}
    />
  );
};
