import React, { useRef, useState, useEffect } from 'react';
import { RotateCcw } from 'lucide-react';
import { ColorWheel } from '../../types/ipc';

interface ColorWheelsProps {
  lift: ColorWheel;
  gamma: ColorWheel;
  gain: ColorWheel;
  offset: ColorWheel;
  onChange: (wheels: {
    lift?: ColorWheel;
    gamma?: ColorWheel;
    gain?: ColorWheel;
    offset?: ColorWheel;
  }) => void;
}

export const ColorWheelsPanel: React.FC<ColorWheelsProps> = ({
  lift,
  gamma,
  gain,
  offset,
  onChange,
}) => {
  return (
    <div className="space-y-3">
      <div className="text-[11px] font-bold text-[#8A92A6] uppercase tracking-wider flex items-center justify-between">
        <span>3-Way Color Wheels</span>
        <button
          onClick={() =>
            onChange({
              lift: { r: 0, g: 0, b: 0, luma: 0 },
              gamma: { r: 0, g: 0, b: 0, luma: 0 },
              gain: { r: 0, g: 0, b: 0, luma: 0 },
              offset: { r: 0, g: 0, b: 0, luma: 0 },
            })
          }
          className="text-[10px] font-mono text-[#64748B] hover:text-[#00F0FF] flex items-center gap-1 cursor-pointer"
        >
          <RotateCcw size={10} />
          <span>Reset Wheels</span>
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <SingleColorWheel
          label="Lift (Shadows)"
          wheel={lift}
          onChange={(w) => onChange({ lift: w })}
        />
        <SingleColorWheel
          label="Gamma (Midtones)"
          wheel={gamma}
          onChange={(w) => onChange({ gamma: w })}
        />
        <SingleColorWheel
          label="Gain (Highlights)"
          wheel={gain}
          onChange={(w) => onChange({ gain: w })}
        />
        <SingleColorWheel
          label="Offset (Global)"
          wheel={offset}
          onChange={(w) => onChange({ offset: w })}
        />
      </div>
    </div>
  );
};

interface SingleWheelProps {
  label: string;
  wheel: ColorWheel;
  onChange: (wheel: ColorWheel) => void;
}

const SingleColorWheel: React.FC<SingleWheelProps> = ({ label, wheel, onChange }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const cachedRectRef = useRef<DOMRect | null>(null);
  const rafRef = useRef<number | null>(null);
  const pendingWheelRef = useRef<ColorWheel | null>(null);

  // Convert (r, b) vector to (x, y) coordinates [-1, 1]
  const x = wheel.r || 0;
  const y = wheel.b || 0;
  const luma = wheel.luma || 0;

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (containerRef.current) {
      cachedRectRef.current = containerRef.current.getBoundingClientRect();
    }
    setIsDragging(true);
    updateVector(e.clientX, e.clientY);
  };

  const updateVector = (clientX: number, clientY: number) => {
    const rect = cachedRectRef.current || containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const radius = rect.width / 2;

    const dx = (clientX - cx) / radius;
    const dy = (clientY - cy) / radius;

    const dist = Math.hypot(dx, dy);
    const clampedDist = Math.min(1.0, dist);
    const angle = Math.atan2(dy, dx);

    const newR = Number((Math.cos(angle) * clampedDist).toFixed(3));
    const newB = Number((Math.sin(angle) * clampedDist).toFixed(3));
    const newG = Number((-(newR + newB) * 0.5).toFixed(3));

    const updated = {
      ...wheel,
      r: newR,
      g: newG,
      b: newB,
    };
    pendingWheelRef.current = updated;

    if (rafRef.current === null) {
      rafRef.current = requestAnimationFrame(() => {
        if (pendingWheelRef.current) {
          onChange(pendingWheelRef.current);
        }
        rafRef.current = null;
      });
    }
  };

  useEffect(() => {
    const handleMove = (e: PointerEvent) => {
      if (!isDragging) return;
      updateVector(e.clientX, e.clientY);
    };

    const handleUp = () => {
      if (isDragging) {
        if (rafRef.current !== null) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }
        if (pendingWheelRef.current) {
          onChange(pendingWheelRef.current);
          pendingWheelRef.current = null;
        }
        setIsDragging(false);
        cachedRectRef.current = null;
      }
    };

    if (isDragging) {
      window.addEventListener('pointermove', handleMove, { passive: true });
      window.addEventListener('pointerup', handleUp);
    }
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [isDragging]);

  const puckLeft = 50 + x * 45;
  const puckTop = 50 + y * 45;

  return (
    <div className="p-2.5 rounded-lg bg-[#0E1015] border border-[#222630] flex flex-col items-center select-none">
      <div className="w-full flex items-center justify-between mb-1.5">
        <span className="text-[10px] font-bold text-[#F0F3F8] truncate">{label}</span>
        <button
          onClick={() => onChange({ r: 0, g: 0, b: 0, luma: 0 })}
          title="Reset Wheel"
          className="text-[#64748B] hover:text-[#00F0FF] transition-colors cursor-pointer"
        >
          <RotateCcw size={10} />
        </button>
      </div>

      {/* 2D Chromatic Wheel */}
      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        className="w-24 h-24 rounded-full relative cursor-crosshair border border-[#323846] shadow-inner overflow-hidden"
        style={{
          background: `radial-gradient(circle at center, #1B1E26 0%, transparent 75%),
            conic-gradient(from 0deg, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)`,
        }}
      >
        {/* Subtle crosshairs */}
        <div className="absolute left-1/2 top-0 bottom-0 w-[1px] bg-black/40 -translate-x-1/2 pointer-events-none" />
        <div className="absolute top-1/2 left-0 right-0 h-[1px] bg-black/40 -translate-y-1/2 pointer-events-none" />

        {/* Center neutral anchor dot */}
        <div className="absolute left-1/2 top-1/2 w-1.5 h-1.5 -ml-[3px] -mt-[3px] rounded-full bg-white/30 pointer-events-none" />

        {/* Interactive Puck */}
        <div
          style={{ left: `${puckLeft}%`, top: `${puckTop}%` }}
          className="absolute w-3 h-3 -ml-1.5 -mt-1.5 rounded-full bg-white border-2 border-black shadow-[0_0_8px_rgba(255,255,255,0.8)] pointer-events-none transform active:scale-125 transition-transform"
        />
      </div>

      {/* Luma Slider */}
      <div className="w-full mt-2 space-y-0.5">
        <div className="flex items-center justify-between text-[9px] font-mono text-[#8A92A6]">
          <span>Luma</span>
          <span className="text-[#00F0FF]">{luma > 0 ? `+${(luma * 100).toFixed(0)}` : (luma * 100).toFixed(0)}</span>
        </div>
        <input
          type="range"
          min={-1}
          max={1}
          step={0.01}
          value={luma}
          onChange={(e) => onChange({ ...wheel, luma: parseFloat(e.target.value) })}
          className="w-full h-1 bg-[#222630] rounded appearance-none cursor-pointer accent-[#00F0FF]"
        />
      </div>
    </div>
  );
};
