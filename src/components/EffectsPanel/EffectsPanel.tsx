import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import {
  Search,
  Sparkles,
  Plus,
  Check,
  Sliders,
  Layers,
  Zap,
  Filter as FilterIcon,
} from 'lucide-react';
import { useTimelineStore } from '../../store/timelineStore';
import { FilterPreset } from '../../types/ipc';
import { EFFECTS_CATALOG, EffectPresetItem } from './effectsCatalog';

interface EffectCardProps {
  item: EffectPresetItem;
  onApply: (item: EffectPresetItem) => void;
  onPointerDown: (item: EffectPresetItem, e: React.PointerEvent) => void;
}

const EffectCard: React.FC<EffectCardProps> = ({ item, onApply, onPointerDown }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const animFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);

  // Render static frame initially
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    item.renderThumbnail(ctx, canvas.width, canvas.height, 0.5);
  }, [item]);

  // Live Hover Scrub Preview: 1.5-second loop
  useEffect(() => {
    if (!isHovered) {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) item.renderThumbnail(ctx, canvas.width, canvas.height, 0.5);
      }
      return;
    }

    startTimeRef.current = performance.now();

    const loop = (time: number) => {
      const elapsed = (time - (startTimeRef.current || time)) / 1000;
      const loopDuration = 1.5;
      const progress = (elapsed % loopDuration) / loopDuration;

      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          item.renderThumbnail(ctx, canvas.width, canvas.height, progress);
        }
      }
      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isHovered, item]);

  return (
    <div
      onPointerDown={(e) => onPointerDown(item, e)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="group relative flex flex-col bg-[#1A1D24] hover:bg-[#202530] border border-[#262B36] hover:border-[#00F0FF]/50 rounded-lg overflow-hidden transition-all duration-200 cursor-grab active:cursor-grabbing shadow-sm hover:shadow-[0_4px_16px_rgba(0,240,255,0.15)]"
    >
      {/* Thumbnail Canvas */}
      <div className="relative aspect-video w-full bg-[#0D0F14] overflow-hidden border-b border-[#262B36]">
        <canvas
          ref={canvasRef}
          width={180}
          height={100}
          className="w-full h-full object-cover block"
        />

        {/* Category Pill Tag */}
        <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wider uppercase bg-[#0D0F14]/80 text-[#8E9CAE] backdrop-blur-xs border border-white/5">
          {item.category}
        </div>

        {/* Quick Add Overlay Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onApply(item);
          }}
          className="absolute bottom-1.5 right-1.5 w-6 h-6 rounded-md flex items-center justify-center bg-[#00F0FF] text-[#0A0D14] opacity-0 group-hover:opacity-100 hover:scale-110 shadow-[0_0_8px_rgba(0,240,255,0.5)] transition-all"
          title="Apply Filter to Clip / Adjustment Layer"
        >
          <Plus size={13} strokeWidth={3} />
        </button>
      </div>

      {/* Info Bar */}
      <div className="p-2 flex flex-col justify-between flex-1 min-h-[46px]">
        <div className="flex items-center justify-between gap-1">
          <span className="text-[11px] font-semibold text-[#F0F3F8] truncate group-hover:text-[#00F0FF] transition-colors">
            {item.name}
          </span>
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: item.color }}
          />
        </div>
        <p className="text-[9px] text-[#64748B] line-clamp-1 mt-0.5">
          {item.description}
        </p>
      </div>
    </div>
  );
};

export const EffectsPanel: React.FC = () => {
  const {
    tracks,
    selectedClipId,
    applyFilterPreset,
    addAdjustmentLayer,
  } = useTimelineStore(
    useShallow((state) => ({
      tracks: state.tracks,
      selectedClipId: state.selectedClipId,
      applyFilterPreset: state.applyFilterPreset,
      addAdjustmentLayer: state.addAdjustmentLayer,
    }))
  );

  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2000);
  };

  const categories = [
    'All',
    'Trending',
    'Color Grade',
    'Cinematic',
    'Glitch',
    'Retro',
    'Blur & Optical',
    'Artistic',
    'Distortion',
    'Minimal',
  ] as const;

  const filteredItems = useMemo(() => {
    return EFFECTS_CATALOG.filter((item) => {
      const matchesCat =
        activeCategory === 'All'
          ? true
          : activeCategory === 'Trending'
          ? item.tags.includes('trending')
          : item.category === activeCategory;

      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        item.name.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.tags.some((t) => t.toLowerCase().includes(q));

      return matchesCat && matchesSearch;
    });
  }, [activeCategory, searchQuery]);

  const mapToFilterPreset = (item: EffectPresetItem): FilterPreset => {
    return {
      id: item.id,
      name: item.name,
      category: item.category,
      categoryLabel: item.category,
      description: item.description,
      filterType: 'colorGrade',
      ffmpegFilter: item.ffmpegFilter,
      defaultIntensity: 1.0,
      isCustom: false,
      previewAccentColor: item.color,
      shaderRecipe: {
        brightness: 1,
        contrast: 1,
        saturation: 1,
        temperature: 0,
        tint: 0,
        vignette: 0,
        grain: 0,
        sepia: 0,
        hueRotateDeg: 0,
        rgbBalance: [1, 1, 1],
        highlights: 0,
        shadows: 0,
        cssFilter: item.cssFilter,
      },
    };
  };

  const handleApplyPreset = (item: EffectPresetItem, targetClipId?: string) => {
    const preset = mapToFilterPreset(item);
    applyFilterPreset(preset, targetClipId);
    showToast(`Applied ${item.name}`);
  };

  const handlePointerDown = (item: EffectPresetItem, e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const startX = e.clientX;
    const startY = e.clientY;
    let isDragging = false;

    const onPointerMove = (moveEvent: PointerEvent) => {
      const dist = Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY);
      if (dist > 5) {
        isDragging = true;
        document.body.style.cursor = 'copy';
      }
    };

    const onPointerUp = (upEvent: PointerEvent) => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      document.body.style.cursor = '';

      if (!isDragging) {
        handleApplyPreset(item);
        return;
      }

      // Check drop target on timeline
      const dropX = upEvent.clientX;
      const dropY = upEvent.clientY;
      const elem = document.elementFromPoint(dropX, dropY);

      const clipElem = elem?.closest('[data-clip-id]');
      if (clipElem) {
        const clipId = clipElem.getAttribute('data-clip-id');
        if (clipId) {
          handleApplyPreset(item, clipId);
          return;
        }
      }

      // Dropped on timeline background or track header
      const trackElem = elem?.closest('[data-track-id]');
      if (trackElem) {
        handleApplyPreset(item);
      }
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#14161B] border-r border-[#222630] select-none">
      {/* Header Bar */}
      <div className="p-3 bg-[#101217] border-b border-[#222630] space-y-2.5 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-[#00F0FF]/15 text-[#00F0FF] border border-[#00F0FF]/30">
              <Sparkles size={15} />
            </div>
            <div>
              <h2 className="text-xs font-bold text-[#F0F3F8]">Visual Effects & Shaders</h2>
              <p className="text-[10px] text-[#64748B]">
                {EFFECTS_CATALOG.length} real-time shaders with 60 FPS live preview
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {toastMessage && (
              <div className="px-2 py-0.5 rounded bg-[#10B981]/20 border border-[#10B981]/40 text-[#10B981] text-[10px] font-bold animate-fade-in">
                {toastMessage}
              </div>
            )}
            <button
              onClick={() => addAdjustmentLayer?.()}
              className="flex items-center gap-1 px-2 py-1 bg-[#1A1F29] hover:bg-[#222938] text-[#00F0FF] border border-[#00F0FF]/30 rounded text-[10px] font-semibold transition-colors cursor-pointer"
              title="Add Adjustment Layer Track for Global Grading"
            >
              <Layers size={11} />
              <span>+ Adjustment</span>
            </button>
          </div>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#525D73]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search 50+ shaders & visual filters..."
            className="w-full bg-[#1A1D24] text-[#F0F3F8] text-xs pl-8 pr-3 py-1.5 rounded-md border border-[#2B303C] focus:border-[#00F0FF] focus:outline-hidden transition-colors placeholder:text-[#525D73]"
          />
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
          {categories.map((cat) => {
            const isSelected = activeCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-2.5 py-1 rounded text-[11px] font-medium whitespace-nowrap transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-[#00F0FF] text-[#0B0D13] font-bold shadow-[0_0_8px_rgba(0,240,255,0.3)]'
                    : 'bg-[#181B22] text-[#8E9CAE] hover:text-[#F0F3F8] hover:bg-[#202530] border border-[#2B303C]'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      {/* Grid Content */}
      <div className="flex-1 overflow-y-auto p-3 min-h-0 custom-scrollbar">
        {filteredItems.length === 0 ? (
          <div className="h-48 flex flex-col items-center justify-center text-center p-4">
            <Sparkles size={28} className="text-[#3A4252] mb-2" />
            <p className="text-xs font-semibold text-[#8E9CAE]">No visual filters found</p>
            <p className="text-[10px] text-[#525D73] mt-1">Try another search or category filter</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3">
            {filteredItems.map((item) => (
              <EffectCard
                key={item.id}
                item={item}
                onApply={(it) => handleApplyPreset(it, selectedClipId || undefined)}
                onPointerDown={handlePointerDown}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
