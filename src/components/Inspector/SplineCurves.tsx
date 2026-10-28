import React, { useState, useRef, useEffect } from 'react';
import { RotateCcw } from 'lucide-react';
import { SplineCurves } from '../../types/ipc';

interface SplineCurvesProps {
  curves?: SplineCurves;
  onChange: (curves: SplineCurves) => void;
}

const DEFAULT_CURVES: SplineCurves = {
  master: [[0, 0], [1, 1]],
  red: [[0, 0], [1, 1]],
  green: [[0, 0], [1, 1]],
  blue: [[0, 0], [1, 1]],
};

/**
 * Computes a smooth monotonic cubic spline through sorted 2D points using the
 * Fritsch-Carlson algorithm, converted to an SVG cubic Bézier path (`d` attribute).
 * Prevents artificial overshoots and produces natural, continuous curve transitions.
 */
function buildMonotoneSplinePath(points: [number, number][]): string {
  const n = points.length;
  if (n === 0) return '';
  if (n === 1) return `M ${(points[0][0] * 100).toFixed(2)} ${((1 - points[0][1]) * 100).toFixed(2)}`;

  if (n === 2) {
    const x0 = (points[0][0] * 100).toFixed(2);
    const y0 = ((1 - points[0][1]) * 100).toFixed(2);
    const x1 = (points[1][0] * 100).toFixed(2);
    const y1 = ((1 - points[1][1]) * 100).toFixed(2);
    return `M ${x0} ${y0} L ${x1} ${y1}`;
  }

  // 1. Calculate secant slopes delta_k
  const dxs: number[] = [];
  const dys: number[] = [];
  const deltas: number[] = [];

  for (let i = 0; i < n - 1; i++) {
    const dx = points[i + 1][0] - points[i][0];
    const dy = points[i + 1][1] - points[i][1];
    dxs.push(dx);
    dys.push(dy);
    deltas.push(dx <= 0.00001 ? 0 : dy / dx);
  }

  // 2. Calculate initial tangents m_k
  const m: number[] = new Array(n).fill(0);
  m[0] = deltas[0];
  m[n - 1] = deltas[n - 2];

  for (let i = 1; i < n - 1; i++) {
    if (deltas[i - 1] * deltas[i] <= 0) {
      m[i] = 0;
    } else {
      // Weighted harmonic mean prevents overshoot
      const w1 = 2 * dxs[i] + dxs[i - 1];
      const w2 = dxs[i] + 2 * dxs[i - 1];
      m[i] = (w1 + w2) / (w1 / deltas[i - 1] + w2 / deltas[i]);
    }
  }

  // 3. Fritsch-Carlson adjustment to enforce strict monotonicity
  for (let i = 0; i < n - 1; i++) {
    if (deltas[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
    } else {
      const alpha = m[i] / deltas[i];
      const beta = m[i + 1] / deltas[i];
      const dist = alpha * alpha + beta * beta;
      if (dist > 9) {
        const tau = 3 / Math.sqrt(dist);
        m[i] = tau * alpha * deltas[i];
        m[i + 1] = tau * beta * deltas[i];
      }
    }
  }

  // 4. Construct SVG cubic Bézier segments in inverted SVG space
  let path = `M ${(points[0][0] * 100).toFixed(2)} ${((1 - points[0][1]) * 100).toFixed(2)}`;

  for (let i = 0; i < n - 1; i++) {
    const p0x = points[i][0];
    const p0y = points[i][1];
    const p1x = points[i + 1][0];
    const p1y = points[i + 1][1];
    const dx = dxs[i];

    // Control points in normalized [0, 1] space
    const cp1x = p0x + dx / 3;
    const cp1y = p0y + (m[i] * dx) / 3;

    const cp2x = p1x - dx / 3;
    const cp2y = p1y - (m[i + 1] * dx) / 3;

    // Convert to SVG coordinates (0..100 with inverted Y)
    const svgCp1x = (cp1x * 100).toFixed(2);
    const svgCp1y = ((1 - cp1y) * 100).toFixed(2);
    const svgCp2x = (cp2x * 100).toFixed(2);
    const svgCp2y = ((1 - cp2y) * 100).toFixed(2);
    const svgP1x = (p1x * 100).toFixed(2);
    const svgP1y = ((1 - p1y) * 100).toFixed(2);

    path += ` C ${svgCp1x} ${svgCp1y}, ${svgCp2x} ${svgCp2y}, ${svgP1x} ${svgP1y}`;
  }

  return path;
}

export const SplineCurvesPanel: React.FC<SplineCurvesProps> = ({ curves, onChange }) => {
  const [activeChannel, setActiveChannel] = useState<'master' | 'red' | 'green' | 'blue'>('master');
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [localCurves, setLocalCurves] = useState<SplineCurves>(curves || DEFAULT_CURVES);
  const localCurvesRef = useRef<SplineCurves>(localCurves);
  localCurvesRef.current = localCurves;

  const cachedRectRef = useRef<DOMRect | null>(null);
  const rafRef = useRef<number | null>(null);
  const pendingUpdatesRef = useRef<SplineCurves | null>(null);

  // Sync external curves when not actively dragging
  useEffect(() => {
    if (draggingIdx === null && curves) {
      setLocalCurves(curves);
    }
  }, [curves, draggingIdx]);

  const points = (localCurves[activeChannel] || [[0, 0], [1, 1]]) as [number, number][];

  const handlePointerDownPoint = (e: React.PointerEvent, idx: number) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture?.(e.pointerId);
    } catch {
      // Ignore if pointer capture fails
    }
    if (svgRef.current) {
      cachedRectRef.current = svgRef.current.getBoundingClientRect();
    }
    setDraggingIdx(idx);
  };

  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current || draggingIdx !== null) return;
    const rect = svgRef.current.getBoundingClientRect();
    const x = Math.max(0.02, Math.min(0.98, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, 1 - (e.clientY - rect.top) / rect.height));

    // Do not add if clicking too close to an existing point in X
    if (points.some((p) => Math.abs(p[0] - x) < 0.035)) {
      return;
    }

    // Insert new point in sorted order
    const nextPoints = [...points, [Number(x.toFixed(4)), Number(y.toFixed(4))] as [number, number]];
    nextPoints.sort((a, b) => a[0] - b[0]);

    const updated = {
      ...localCurves,
      [activeChannel]: nextPoints,
    };
    setLocalCurves(updated);
    onChange(updated);
  };

  const handleDeletePoint = (e: React.MouseEvent, idx: number) => {
    e.stopPropagation();
    e.preventDefault();
    // Do not delete endpoints
    if (idx === 0 || idx === points.length - 1) return;
    const nextPoints = points.filter((_, i) => i !== idx);
    const updated = {
      ...localCurves,
      [activeChannel]: nextPoints,
    };
    setLocalCurves(updated);
    onChange(updated);
  };

  // High-performance pointer drag handler with strict neighbor clamping & 60 FPS RAF throttling
  useEffect(() => {
    if (draggingIdx === null) return;

    const handlePointerMove = (e: PointerEvent) => {
      const rect = cachedRectRef.current || svgRef.current?.getBoundingClientRect();
      if (!rect) return;

      const rawX = (e.clientX - rect.left) / rect.width;
      const rawY = 1 - (e.clientY - rect.top) / rect.height;

      const currentPoints = localCurvesRef.current[activeChannel] || [[0, 0], [1, 1]];
      const isFirst = draggingIdx === 0;
      const isLast = draggingIdx === currentPoints.length - 1;

      // Strictly clamp interior points between their left and right neighbors to maintain sorting
      const minX = isFirst ? 0 : (currentPoints[draggingIdx - 1]?.[0] ?? 0) + 0.015;
      const maxX = isLast ? 1 : (currentPoints[draggingIdx + 1]?.[0] ?? 1) - 0.015;
      const x = isFirst ? 0 : isLast ? 1 : Math.max(minX, Math.min(maxX, rawX));
      const y = Math.max(0, Math.min(1, rawY));

      const updatedPoints = currentPoints.map((p, i) =>
        i === draggingIdx ? ([Number(x.toFixed(4)), Number(y.toFixed(4))] as [number, number]) : p
      );

      const nextCurves: SplineCurves = {
        ...localCurvesRef.current,
        [activeChannel]: updatedPoints,
      };

      setLocalCurves(nextCurves);
      pendingUpdatesRef.current = nextCurves;

      // Throttle upstream store updates to 60 FPS via requestAnimationFrame
      if (rafRef.current === null) {
        rafRef.current = requestAnimationFrame(() => {
          if (pendingUpdatesRef.current) {
            onChange(pendingUpdatesRef.current);
          }
          rafRef.current = null;
        });
      }
    };

    const handlePointerUp = () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      if (pendingUpdatesRef.current) {
        onChange(pendingUpdatesRef.current);
        pendingUpdatesRef.current = null;
      }
      setDraggingIdx(null);
      cachedRectRef.current = null;
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [draggingIdx, activeChannel, onChange]);

  // Construct smooth monotonic cubic spline path
  const pathD = buildMonotoneSplinePath(points);

  const strokeColor =
    activeChannel === 'master'
      ? '#F0F3F8'
      : activeChannel === 'red'
      ? '#FF453A'
      : activeChannel === 'green'
      ? '#30D158'
      : '#0A84FF';

  return (
    <div className="p-3 rounded-lg bg-[#0D0E11] border border-[#222630] space-y-2.5 select-none">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold text-[#8A92A6] uppercase tracking-wider">Spline Curves</span>
        <button
          onClick={() => {
            const reset = {
              ...localCurves,
              [activeChannel]: [[0, 0], [1, 1]] as [number, number][],
            };
            setLocalCurves(reset);
            onChange(reset);
          }}
          className="text-[10px] font-mono text-[#64748B] hover:text-[#00F0FF] flex items-center gap-1 cursor-pointer"
        >
          <RotateCcw size={10} />
          <span>Reset {activeChannel}</span>
        </button>
      </div>

      {/* Channel Tabs */}
      <div className="flex items-center gap-1 bg-[#14161F] p-0.5 rounded-md border border-[#222630]">
        {(['master', 'red', 'green', 'blue'] as const).map((ch) => (
          <button
            key={ch}
            onClick={() => setActiveChannel(ch)}
            className={`flex-1 py-1 rounded text-[10px] font-mono font-bold capitalize transition-all cursor-pointer ${
              activeChannel === ch
                ? ch === 'master'
                  ? 'bg-white/20 text-white'
                  : ch === 'red'
                  ? 'bg-red-500/25 text-red-400'
                  : ch === 'green'
                  ? 'bg-emerald-500/25 text-emerald-400'
                  : 'bg-blue-500/25 text-blue-400'
                : 'text-[#64748B] hover:text-[#F0F3F8]'
            }`}
          >
            {ch}
          </button>
        ))}
      </div>

      {/* Interactive SVG Curves Box */}
      <div className="relative w-full aspect-square bg-[#08090D] rounded border border-[#222630] overflow-hidden">
        {/* Subtle grid lines */}
        <div className="absolute inset-0 grid grid-cols-4 grid-rows-4 pointer-events-none">
          {Array.from({ length: 16 }).map((_, i) => (
            <div key={i} className="border-r border-b border-[#1A1D27]/60" />
          ))}
        </div>

        {/* Diagonal 1:1 neutral reference line */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          <line
            x1="0"
            y1="100%"
            x2="100%"
            y2="0"
            stroke="#1D2230"
            strokeDasharray="3 3"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        {/* Interactive SVG Surface */}
        <svg
          ref={svgRef}
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          onClick={handleSvgClick}
          className="w-full h-full block cursor-crosshair relative z-10"
        >
          <defs>
            <linearGradient id={`curve-fill-${activeChannel}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={strokeColor} stopOpacity="0.12" />
              <stop offset="100%" stopColor={strokeColor} stopOpacity="0.01" />
            </linearGradient>
          </defs>

          {/* Translucent under-curve area fill */}
          {pathD && (
            <path
              d={`${pathD} L 100 100 L 0 100 Z`}
              fill={`url(#curve-fill-${activeChannel})`}
              className="pointer-events-none"
            />
          )}

          {/* Smooth, crisp 1.75px curve spline path */}
          <path
            d={pathD}
            fill="none"
            stroke={strokeColor}
            strokeWidth="1.75"
            vectorEffect="non-scaling-stroke"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Rock-solid Control Points (No CSS scaling to eliminate hover dancing) */}
          {points.map((pt, idx) => {
            const px = pt[0] * 100;
            const py = (1 - pt[1]) * 100;
            const isDragging = draggingIdx === idx;
            const isHovered = hoveredIdx === idx;
            const isInterior = idx > 0 && idx < points.length - 1;

            return (
              <g key={idx}>
                {/* Large transparent hit area (16px diameter) for easy grabbing */}
                <circle
                  cx={px}
                  cy={py}
                  r="6"
                  fill="transparent"
                  className="cursor-grab active:cursor-grabbing"
                  onPointerDown={(e) => handlePointerDownPoint(e, idx)}
                  onPointerEnter={() => setHoveredIdx(idx)}
                  onPointerLeave={() => setHoveredIdx((prev) => (prev === idx ? null : prev))}
                  onDoubleClick={(e) => isInterior && handleDeletePoint(e, idx)}
                >
                  <title>{isInterior ? 'Double-click to remove point' : 'Drag to adjust'}</title>
                </circle>

                {/* Subtle hover/active outer ring */}
                {(isDragging || isHovered) && (
                  <circle
                    cx={px}
                    cy={py}
                    r="4.2"
                    fill="none"
                    stroke={strokeColor}
                    strokeWidth="1.5"
                    vectorEffect="non-scaling-stroke"
                    className="pointer-events-none opacity-50"
                  />
                )}

                {/* Stable visible point core: crisp 1.5px border with channel fill */}
                <circle
                  cx={px}
                  cy={py}
                  r="2.5"
                  fill={isDragging ? '#FFFFFF' : strokeColor}
                  stroke="#08090D"
                  strokeWidth="1.5"
                  vectorEffect="non-scaling-stroke"
                  className="pointer-events-none"
                />
              </g>
            );
          })}
        </svg>
      </div>

      <div className="text-[9px] text-[#64748B] text-center font-mono">
        Click to add point • Drag points to curve • Double-click point to delete
      </div>
    </div>
  );
};
