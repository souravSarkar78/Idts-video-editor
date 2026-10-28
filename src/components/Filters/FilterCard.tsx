import React, { useState } from 'react';
import { Check, Sparkles, Move } from 'lucide-react';
import { FilterPreset } from '../../types/ipc';
import { DEFAULT_FILTER_SAMPLE_SVG } from './sampleImage';

interface FilterCardProps {
  preset: FilterPreset;
  isActive: boolean;
  sampleMode: 'default' | 'video_frame';
  videoFrameSnapshot: string | null;
  onApply: (preset: FilterPreset) => void;
  onDragStart?: (e: React.DragEvent, preset: FilterPreset) => void;
}

export const FilterCard: React.FC<FilterCardProps> = ({
  preset,
  isActive,
  sampleMode,
  videoFrameSnapshot,
  onApply,
  onDragStart,
}) => {
  const [isHovered, setIsHovered] = useState(false);

  // Determine preview image source: video frame snapshot or default calibration portrait
  const imageSrc =
    sampleMode === 'video_frame' && videoFrameSnapshot
      ? videoFrameSnapshot
      : DEFAULT_FILTER_SAMPLE_SVG;

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('application/json', JSON.stringify({ type: 'filter-preset', preset }));
    e.dataTransfer.effectAllowed = 'copyMove';
    if (onDragStart) {
      onDragStart(e, preset);
    }
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => onApply(preset)}
      className="flex flex-col items-center group cursor-pointer select-none transition-transform duration-150 active:scale-95"
      title={`Click to apply ${preset.name} • Drag to drop on timeline`}
    >
      {/* Square Thumbnail Image - CapCut style rounded corners */}
      <div
        className={`relative aspect-square w-full rounded-2xl overflow-hidden bg-[#161820] transition-all duration-200 shadow-md ${
          isActive
            ? 'ring-2 ring-[#00F0FF] shadow-[0_0_16px_rgba(0,240,255,0.45)]'
            : 'border border-[#282C37]/60 group-hover:border-[#4B5568] group-hover:shadow-lg'
        }`}
      >
        {/* Render Image with live CSS Filter Recipe applied */}
        <img
          src={imageSrc}
          alt={preset.name}
          className="w-full h-full object-cover pointer-events-none transform transition-transform duration-300 group-hover:scale-108"
          style={{
            filter: preset.shaderRecipe?.cssFilter || undefined,
          }}
          loading="lazy"
        />

        {/* Top-left Drag Handle (visible on hover) */}
        <div
          className={`absolute top-2 left-2 p-1 rounded-md bg-black/60 backdrop-blur-md text-white/80 transition-opacity duration-150 cursor-grab active:cursor-grabbing border border-white/10 ${
            isHovered ? 'opacity-100' : 'opacity-0'
          }`}
          title="Drag and drop onto timeline"
        >
          <Move size={12} className="text-white/80" />
        </div>

        {/* Active Applied State Checkmark Pill (Top Right) */}
        {isActive && (
          <div className="absolute top-2 right-2 z-10 flex items-center gap-1 bg-[#00F0FF] text-black px-1.5 py-0.5 rounded-md text-[9px] font-extrabold shadow-md">
            <Check size={10} strokeWidth={3} />
            <span>ACTIVE</span>
          </div>
        )}

        {/* Hover Action Overlay: "Apply" Button */}
        <div
          className={`absolute inset-0 flex items-center justify-center bg-black/35 backdrop-blur-[0.5px] transition-opacity duration-150 ${
            isHovered ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onApply(preset);
            }}
            className="flex items-center gap-1 px-3 py-1 rounded-full bg-[#00F0FF] hover:bg-[#38BDF8] text-black text-[11px] font-bold shadow-[0_0_12px_rgba(0,240,255,0.6)] transform transition-transform active:scale-95"
          >
            <Sparkles size={11} />
            <span>{isActive ? 'Applied' : 'Apply'}</span>
          </button>
        </div>
      </div>

      {/* Preset Name Underneath - Centered CapCut Style */}
      <span
        className={`text-[12px] font-medium mt-1.5 text-center truncate w-full px-0.5 leading-tight tracking-tight transition-colors ${
          isActive
            ? 'text-[#00F0FF] font-semibold'
            : 'text-[#9DA8B6] group-hover:text-white'
        }`}
      >
        {preset.name}
      </span>
    </div>
  );
};
