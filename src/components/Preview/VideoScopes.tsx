import React, { useRef, useEffect, useState } from 'react';
import { Eye, X, Maximize2 } from 'lucide-react';
import { Activity, BarChart2, Minimize2 } from '@/components/Icons';

interface VideoScopesProps {
  videoElement: HTMLVideoElement | null;
  canvasElement: HTMLCanvasElement | null;
  isOpen: boolean;
  onClose: () => void;
  activeScope: 'all' | 'waveform' | 'parade' | 'vectorscope';
  onSelectScope: (scope: 'all' | 'waveform' | 'parade' | 'vectorscope') => void;
}

export const VideoScopes: React.FC<VideoScopesProps> = ({
  videoElement,
  canvasElement,
  isOpen,
  onClose,
  activeScope,
  onSelectScope,
}) => {
  const waveformRef = useRef<HTMLCanvasElement | null>(null);
  const paradeRef = useRef<HTMLCanvasElement | null>(null);
  const vectorscopeRef = useRef<HTMLCanvasElement | null>(null);

  const [isExpanded, setIsExpanded] = useState(false);
  const animFrameRef = useRef<number | null>(null);

  // Hidden offscreen canvas to sample video pixels
  const sampleCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!sampleCanvasRef.current) {
      sampleCanvasRef.current = document.createElement('canvas');
      sampleCanvasRef.current.width = 160;
      sampleCanvasRef.current.height = 90;
    }
  }, []);

  useEffect(() => {
    if (!isOpen) {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      return;
    }

    const renderScopes = () => {
      const source = videoElement || canvasElement;
      const sampleCanvas = sampleCanvasRef.current;

      if (source && sampleCanvas && (source instanceof HTMLVideoElement ? source.readyState >= 2 : true)) {
        const sCtx = sampleCanvas.getContext('2d', { willReadFrequently: true });
        if (sCtx) {
          try {
            sCtx.drawImage(source, 0, 0, sampleCanvas.width, sampleCanvas.height);
            const imgData = sCtx.getImageData(0, 0, sampleCanvas.width, sampleCanvas.height);
            const data = imgData.data;
            const w = sampleCanvas.width;
            const h = sampleCanvas.height;

            // 1. Draw Waveform (0-100 IRE)
            if (waveformRef.current && (activeScope === 'all' || activeScope === 'waveform')) {
              drawWaveform(waveformRef.current, data, w, h);
            }

            // 2. Draw RGB Parade
            if (paradeRef.current && (activeScope === 'all' || activeScope === 'parade')) {
              drawRgbParade(paradeRef.current, data, w, h);
            }

            // 3. Draw Vectorscope
            if (vectorscopeRef.current && (activeScope === 'all' || activeScope === 'vectorscope')) {
              drawVectorscope(vectorscopeRef.current, data, w, h);
            }
          } catch {
            // Video may be tainted or cross-origin; safely continue
          }
        }
      }

      animFrameRef.current = requestAnimationFrame(renderScopes);
    };

    animFrameRef.current = requestAnimationFrame(renderScopes);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isOpen, activeScope, videoElement, canvasElement]);

  if (!isOpen) return null;

  return (
    <div
      className={`absolute bottom-3 left-3 z-40 bg-[#0B0D12]/95 border border-[#222630] rounded-xl shadow-2xl backdrop-blur-md transition-all duration-200 overflow-hidden flex flex-col ${
        isExpanded ? 'w-[720px] h-[380px]' : 'w-[480px] h-[260px]'
      }`}
    >
      {/* Header bar */}
      <div className="h-9 px-3 bg-[#10131A] border-b border-[#222630] flex items-center justify-between shrink-0 select-none">
        <div className="flex items-center gap-2">
          <Activity size={14} className="text-[#00F0FF]" />
          <span className="text-xs font-bold text-[#F0F3F8] tracking-wide">Studio Video Scopes</span>
        </div>

        {/* Scope type switcher */}
        <div className="flex items-center bg-[#171A23] p-0.5 rounded-lg border border-[#222630] text-[10px] font-mono">
          {(['all', 'waveform', 'parade', 'vectorscope'] as const).map((type) => (
            <button
              key={type}
              onClick={() => onSelectScope(type)}
              className={`px-2 py-0.5 rounded transition-all capitalize cursor-pointer ${
                activeScope === type
                  ? 'bg-[#00F0FF] text-[#0D0E11] font-bold shadow-[0_0_8px_rgba(0,240,255,0.4)]'
                  : 'text-[#8A92A6] hover:text-[#F0F3F8]'
              }`}
            >
              {type === 'all' ? 'All' : type === 'waveform' ? 'Waveform' : type === 'parade' ? 'Parade' : 'Vectorscope'}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            title={isExpanded ? 'Minimize' : 'Maximize'}
            className="w-6 h-6 flex items-center justify-center rounded hover:bg-[#1E2330] text-[#8A92A6] hover:text-[#00F0FF] transition-colors cursor-pointer"
          >
            {isExpanded ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
          </button>
          <button
            onClick={onClose}
            title="Close Scopes"
            className="w-6 h-6 flex items-center justify-center rounded hover:bg-[#1E2330] text-[#8A92A6] hover:text-[#FF3B30] transition-colors cursor-pointer"
          >
            <X size={13} />
          </button>
        </div>
      </div>

      {/* Scope Canvases Display Area */}
      <div className="flex-1 p-2 grid gap-2 overflow-hidden bg-[#07080B]" style={{
        gridTemplateColumns:
          activeScope === 'all' ? 'repeat(3, 1fr)' : '1fr',
      }}>
        {/* 1. Luma Waveform */}
        {(activeScope === 'all' || activeScope === 'waveform') && (
          <div className="relative rounded-lg bg-[#0C0E14] border border-[#1A1D27] overflow-hidden flex flex-col">
            <div className="absolute top-1 left-1.5 px-1.5 py-0.5 rounded bg-black/70 border border-[#222630] text-[9px] font-mono font-bold text-[#00F0FF] pointer-events-none z-10">
              WAVEFORM (0–100 IRE)
            </div>
            <canvas ref={waveformRef} className="w-full h-full block" />
          </div>
        )}

        {/* 2. RGB Parade */}
        {(activeScope === 'all' || activeScope === 'parade') && (
          <div className="relative rounded-lg bg-[#0C0E14] border border-[#1A1D27] overflow-hidden flex flex-col">
            <div className="absolute top-1 left-1.5 px-1.5 py-0.5 rounded bg-black/70 border border-[#222630] text-[9px] font-mono font-bold text-emerald-400 pointer-events-none z-10">
              RGB PARADE
            </div>
            <canvas ref={paradeRef} className="w-full h-full block" />
          </div>
        )}

        {/* 3. Vectorscope */}
        {(activeScope === 'all' || activeScope === 'vectorscope') && (
          <div className="relative rounded-lg bg-[#0C0E14] border border-[#1A1D27] overflow-hidden flex flex-col">
            <div className="absolute top-1 left-1.5 px-1.5 py-0.5 rounded bg-black/70 border border-[#222630] text-[9px] font-mono font-bold text-amber-400 pointer-events-none z-10">
              VECTORSCOPE
            </div>
            <canvas ref={vectorscopeRef} className="w-full h-full block" />
          </div>
        )}
      </div>
    </div>
  );
};

// ==========================================
// SCOPE RENDERING ALGORITHMS (Canvas 2D)
// ==========================================

function drawWaveform(
  canvas: HTMLCanvasElement,
  data: Uint8ClampedArray,
  srcW: number,
  srcH: number
) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(10, Math.floor(rect.width * dpr));
  const height = Math.max(10, Math.floor(rect.height * dpr));

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.fillStyle = '#05070B';
  ctx.fillRect(0, 0, width, height);

  // Draw IRE grid lines (0, 25, 50, 75, 100 IRE)
  const ireLevels = [100, 75, 50, 25, 0];
  ctx.strokeStyle = '#1D2230';
  ctx.lineWidth = 1;
  ctx.font = `${Math.max(8, Math.floor(9 * dpr))}px monospace`;
  ctx.fillStyle = '#4B5568';

  ireLevels.forEach((ire) => {
    const y = height - (ire / 100) * (height - 16 * dpr) - 8 * dpr;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
    ctx.fillText(`${ire}`, 4 * dpr, y - 2 * dpr);
  });

  // Plot luminance points
  ctx.fillStyle = 'rgba(0, 240, 255, 0.22)';
  const xScale = width / srcW;
  const usableHeight = height - 16 * dpr;

  for (let y = 0; y < srcH; y += 2) {
    for (let x = 0; x < srcW; x += 2) {
      const idx = (y * srcW + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];

      // ITU-R BT.709 Luma equation
      const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      const plotX = x * xScale;
      const plotY = height - (luma / 255) * usableHeight - 8 * dpr;

      ctx.fillRect(plotX, plotY, 1.5 * dpr, 1.5 * dpr);
    }
  }
}

function drawRgbParade(
  canvas: HTMLCanvasElement,
  data: Uint8ClampedArray,
  srcW: number,
  srcH: number
) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(10, Math.floor(rect.width * dpr));
  const height = Math.max(10, Math.floor(rect.height * dpr));

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.fillStyle = '#05070B';
  ctx.fillRect(0, 0, width, height);

  const colWidth = width / 3;
  const usableHeight = height - 16 * dpr;

  // Grid line at 0 and 100 IRE
  ctx.strokeStyle = '#1D2230';
  ctx.lineWidth = 1;
  [0, 50, 100].forEach((ire) => {
    const y = height - (ire / 100) * usableHeight - 8 * dpr;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  });

  // Dividers between Red, Green, Blue
  ctx.strokeStyle = '#2A3042';
  ctx.beginPath();
  ctx.moveTo(colWidth, 0); ctx.lineTo(colWidth, height);
  ctx.moveTo(colWidth * 2, 0); ctx.lineTo(colWidth * 2, height);
  ctx.stroke();

  // Draw labels
  ctx.font = `bold ${Math.max(9, Math.floor(10 * dpr))}px monospace`;
  ctx.fillStyle = '#FF453A';
  ctx.fillText('R', 8 * dpr, 14 * dpr);
  ctx.fillStyle = '#30D158';
  ctx.fillText('G', colWidth + 8 * dpr, 14 * dpr);
  ctx.fillStyle = '#0A84FF';
  ctx.fillText('B', colWidth * 2 + 8 * dpr, 14 * dpr);

  const xScale = colWidth / srcW;

  for (let y = 0; y < srcH; y += 2) {
    for (let x = 0; x < srcW; x += 2) {
      const idx = (y * srcW + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];

      const plotX = x * xScale;

      // Red channel
      ctx.fillStyle = 'rgba(255, 69, 58, 0.28)';
      ctx.fillRect(plotX, height - (r / 255) * usableHeight - 8 * dpr, 1.2 * dpr, 1.2 * dpr);

      // Green channel
      ctx.fillStyle = 'rgba(48, 209, 88, 0.28)';
      ctx.fillRect(colWidth + plotX, height - (g / 255) * usableHeight - 8 * dpr, 1.2 * dpr, 1.2 * dpr);

      // Blue channel
      ctx.fillStyle = 'rgba(10, 132, 255, 0.28)';
      ctx.fillRect(colWidth * 2 + plotX, height - (b / 255) * usableHeight - 8 * dpr, 1.2 * dpr, 1.2 * dpr);
    }
  }
}

function drawVectorscope(
  canvas: HTMLCanvasElement,
  data: Uint8ClampedArray,
  srcW: number,
  srcH: number
) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(10, Math.floor(rect.width * dpr));
  const height = Math.max(10, Math.floor(rect.height * dpr));

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.fillStyle = '#05070B';
  ctx.fillRect(0, 0, width, height);

  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(cx, cy) - 10 * dpr;

  // Circular graticule rings
  ctx.strokeStyle = '#1D2230';
  ctx.lineWidth = 1;
  [0.5, 0.75, 1.0].forEach((factor) => {
    ctx.beginPath();
    ctx.arc(cx, cy, radius * factor, 0, Math.PI * 2);
    ctx.stroke();
  });

  // Crosshairs
  ctx.beginPath();
  ctx.moveTo(cx - radius, cy); ctx.lineTo(cx + radius, cy);
  ctx.moveTo(cx, cy - radius); ctx.lineTo(cx, cy + radius);
  ctx.stroke();

  // Skin-Tone Indicator Axis (I-Line at ~135 degrees)
  ctx.strokeStyle = 'rgba(255, 159, 10, 0.55)';
  ctx.setLineDash([3 * dpr, 3 * dpr]);
  ctx.beginPath();
  const skinAngle = -2.356; // approx -135 deg in canvas coordinates (top-left quadrant)
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(skinAngle) * radius, cy + Math.sin(skinAngle) * radius);
  ctx.stroke();
  ctx.setLineDash([]);

  // Skin tone label
  ctx.font = `${Math.max(7, Math.floor(8 * dpr))}px monospace`;
  ctx.fillStyle = '#FF9F0A';
  ctx.fillText('SKIN', cx + Math.cos(skinAngle) * (radius - 16 * dpr), cy + Math.sin(skinAngle) * (radius - 16 * dpr));

  // Plot chrominance points (U / V)
  ctx.fillStyle = 'rgba(255, 214, 10, 0.28)';

  for (let y = 0; y < srcH; y += 2) {
    for (let x = 0; x < srcW; x += 2) {
      const idx = (y * srcW + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];

      // YCbCr chrominance calculation
      const cb = -0.168736 * r - 0.331264 * g + 0.5 * b; // [-128, 127]
      const cr = 0.5 * r - 0.418688 * g - 0.081312 * b;

      const px = cx + (cb / 128) * radius * 0.85;
      const py = cy - (cr / 128) * radius * 0.85;

      ctx.fillRect(px, py, 1.2 * dpr, 1.2 * dpr);
    }
  }
}
