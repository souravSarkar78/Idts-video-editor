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
  Film as FilmIcon,
  Camera,
  RotateCcw,
  X,
} from 'lucide-react';
import { useTimelineStore } from '../../store/timelineStore';
import { FilterPreset } from '../../types/ipc';
import { EFFECTS_CATALOG, EffectPresetItem } from './effectsCatalog';
import { DEFAULT_FILTER_SAMPLE_SVG } from '../Filters/sampleImage';

interface EffectCardProps {
  item: EffectPresetItem;
  isActive: boolean;
  sampleMode: 'default' | 'video_frame';
  videoFrameSnapshot: string | null;
  onApply: (item: EffectPresetItem) => void;
  onPointerDown: (item: EffectPresetItem, e: React.PointerEvent) => void;
}

const EffectCard: React.FC<EffectCardProps> = ({
  item,
  isActive,
  sampleMode,
  videoFrameSnapshot,
  onApply,
  onPointerDown,
}) => {
  const [isHovered, setIsHovered] = useState(false);

  // Determine preview image source: video frame snapshot or default calibration portrait
  const imageSrc =
    sampleMode === 'video_frame' && videoFrameSnapshot
      ? videoFrameSnapshot
      : DEFAULT_FILTER_SAMPLE_SVG;

  return (
    <div
      onPointerDown={(e) => onPointerDown(item, e)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="group relative flex flex-col bg-[#1A1D24] hover:bg-[#202530] border border-[#262B36] hover:border-[#38BDF8]/50 rounded-lg overflow-hidden transition-all duration-200 cursor-grab active:cursor-grabbing shadow-sm hover:shadow-[0_4px_16px_rgba(56, 189, 248,0.15)]"
    >
      {/* Thumbnail Container */}
      <div
        className={`relative aspect-video w-full bg-[#0D0F14] overflow-hidden rounded-t-lg transition-all duration-200 ${
          isActive
            ? 'ring-2 ring-[#38BDF8] shadow-[0_0_14px_rgba(56, 189, 248,0.4)]'
            : 'border-b border-[#262B36]'
        }`}
      >
        <img
          src={imageSrc}
          alt={item.name}
          className="w-full h-full object-cover pointer-events-none transform transition-transform duration-300 group-hover:scale-108"
          style={{
            filter: item.cssFilter || undefined,
          }}
          loading="lazy"
        />

        {/* Category Pill Tag */}
        <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wider uppercase bg-[#0D0F14]/85 text-[#8E9CAE] backdrop-blur-xs border border-white/10 z-10">
          {item.category}
        </div>

        {/* Active Pill Badge if applied */}
        {isActive && (
          <div className="absolute top-1.5 right-1.5 z-10 flex items-center gap-1 bg-[#38BDF8] text-black px-1.5 py-0.5 rounded text-[9px] font-extrabold shadow-md">
            <Check size={10} strokeWidth={3} />
            <span>ACTIVE</span>
          </div>
        )}

        {/* Quick Add Overlay Button on Hover */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onApply(item);
          }}
          className="absolute bottom-1.5 right-1.5 w-6 h-6 rounded-md flex items-center justify-center bg-[#38BDF8] text-[#0A0D14] opacity-0 group-hover:opacity-100 hover:scale-110 shadow-[0_0_8px_rgba(56, 189, 248,0.5)] transition-all z-10 cursor-pointer"
          title="Apply Effect to Clip / Adjustment Layer"
        >
          <Plus size={13} strokeWidth={3} />
        </button>
      </div>

      {/* Info Bar */}
      <div className="p-2 flex flex-col justify-between flex-1 min-h-[46px]">
        <div className="flex items-center justify-between gap-1">
          <span className="text-[11px] font-semibold text-[#F0F3F8] truncate group-hover:text-[#38BDF8] transition-colors">
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
    playhead,
    selectedClipId,
    samplePreviewMode,
    videoFrameSnapshot,
    isVideoFrameLoading,
    setSamplePreviewMode,
    refreshVideoFrameSnapshot,
    applyFilterPreset,
    removeFilterFromClip,
    setClipFilterIntensity,
    addAdjustmentLayer,
  } = useTimelineStore(
    useShallow((state) => ({
      tracks: state.tracks,
      playhead: state.playhead,
      selectedClipId: state.selectedClipId,
      samplePreviewMode: state.samplePreviewMode || 'default',
      videoFrameSnapshot: state.videoFrameSnapshot || null,
      isVideoFrameLoading: state.isVideoFrameLoading || false,
      setSamplePreviewMode: state.setSamplePreviewMode,
      refreshVideoFrameSnapshot: state.refreshVideoFrameSnapshot,
      applyFilterPreset: state.applyFilterPreset,
      removeFilterFromClip: state.removeFilterFromClip,
      setClipFilterIntensity: state.setClipFilterIntensity,
      addAdjustmentLayer: state.addAdjustmentLayer,
    }))
  );

  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Find currently selected or targeted clip under playhead
  const allClips = useMemo(() => tracks.flatMap((t) => t.clips || []), [tracks]);
  const activeClip = useMemo(() => {
    if (selectedClipId) {
      return allClips.find((c) => c.id === selectedClipId) || null;
    }
    // Fallback: topmost video clip or adjustment layer covering playhead
    const clipsUnderPlayhead = allClips.filter((c) => {
      const start = c.startPositionSeconds ?? (c.startTimeMs / 1000);
      const dur = c.durationSeconds ?? (c.durationMs / 1000);
      return playhead >= start && playhead <= start + dur;
    });
    return clipsUnderPlayhead[clipsUnderPlayhead.length - 1] || null;
  }, [allClips, selectedClipId, playhead]);

  const appliedFilterId = activeClip?.filterId;
  const appliedFilterName = activeClip?.filterName;
  const appliedIntensity = Math.round((activeClip?.filterIntensity ?? 1.0) * 100);

  // When switching to 'video_frame' mode, automatically request snapshot
  useEffect(() => {
    if (samplePreviewMode === 'video_frame') {
      refreshVideoFrameSnapshot();
    }
  }, [samplePreviewMode, playhead, selectedClipId, refreshVideoFrameSnapshot]);

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
            <div className="p-1.5 rounded-md bg-[#38BDF8]/15 text-[#38BDF8] border border-[#38BDF8]/30">
              <Sparkles size={15} />
            </div>
            <div>
              <h2 className="text-xs font-bold text-[#F0F3F8]">Visual Effects & Shaders</h2>
              <p className="text-[10px] text-[#64748B]">
                {EFFECTS_CATALOG.length} real-time shaders with live preview
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {toastMessage && (
              <div className="px-2 py-0.5 rounded bg-[#10B981]/20 border border-[#10B981]/40 text-[#10B981] text-[10px] font-bold animate-fade-in">
                {toastMessage}
              </div>
            )}

            {/* Sample Mode Switcher: Built-in Still vs Timeline Frame */}
            <div className="flex items-center bg-[#0D0F14] p-0.5 rounded-md border border-[#262B36] text-xs shrink-0">
              <button
                type="button"
                onClick={() => setSamplePreviewMode('default')}
                className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium whitespace-nowrap transition-all cursor-pointer ${
                  samplePreviewMode === 'default'
                    ? 'bg-[#222834] text-white shadow-xs'
                    : 'text-[#8E9CAE] hover:text-white'
                }`}
                title="Built-in Sample Photo"
              >
                <FilmIcon size={11} />
                <span>Still</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSamplePreviewMode('video_frame');
                  refreshVideoFrameSnapshot();
                }}
                className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium whitespace-nowrap transition-all cursor-pointer ${
                  samplePreviewMode === 'video_frame'
                    ? 'bg-[#38BDF8] text-black font-semibold shadow-xs'
                    : 'text-[#8E9CAE] hover:text-white'
                }`}
                title="Current Timeline Frame"
              >
                <Camera size={11} />
                <span>Frame</span>
              </button>

              {samplePreviewMode === 'video_frame' && (
                <button
                  type="button"
                  onClick={() => refreshVideoFrameSnapshot()}
                  disabled={isVideoFrameLoading}
                  className="p-1 hover:text-[#38BDF8] text-[#8E9CAE] disabled:opacity-50 transition-colors ml-0.5 cursor-pointer"
                  title="Refresh timeline frame"
                >
                  <RotateCcw size={11} className={isVideoFrameLoading ? 'animate-spin' : ''} />
                </button>
              )}
            </div>

            <button
              onClick={() => addAdjustmentLayer?.()}
              className="flex items-center gap-1 px-2 py-1 bg-[#1A1F29] hover:bg-[#222938] text-[#38BDF8] border border-[#38BDF8]/30 rounded text-[10px] font-semibold transition-colors cursor-pointer"
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
            className="w-full bg-[#1A1D24] text-[#F0F3F8] text-xs pl-8 pr-3 py-1.5 rounded-md border border-[#2B303C] focus:border-[#38BDF8] focus:outline-hidden transition-colors placeholder:text-[#525D73]"
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
                    ? 'bg-[#38BDF8] text-[#0B0D13] font-bold shadow-[0_0_8px_rgba(56, 189, 248,0.3)]'
                    : 'bg-[#181B22] text-[#8E9CAE] hover:text-[#F0F3F8] hover:bg-[#202530] border border-[#2B303C]'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Effect Secondary Bar (Only when active clip has effect applied) */}
      {activeClip && appliedFilterId && (
        <div className="h-9 px-3 border-b border-[#222630] bg-[#161922] flex items-center justify-between gap-2 text-xs shrink-0">
          <div className="flex items-center gap-1.5 truncate">
            <span className="text-[10px] font-mono uppercase text-[#64748B] shrink-0">Active:</span>
            <span
              className="text-xs font-semibold text-[#38BDF8] truncate max-w-[140px]"
              title={appliedFilterName || appliedFilterId}
            >
              {appliedFilterName || appliedFilterId}
            </span>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {/* Intensity Slider */}
            <div className="flex items-center gap-1.5">
              <Sliders size={11} className="text-[#64748B]" />
              <span className="text-[10px] font-mono text-[#94A3B8] w-7 text-right">
                {appliedIntensity}%
              </span>
              <input
                type="range"
                min={0}
                max={100}
                value={appliedIntensity}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10) / 100;
                  setClipFilterIntensity(val, activeClip.id);
                }}
                className="w-16 sm:w-20 h-1 bg-[#262B36] rounded-lg appearance-none cursor-pointer accent-[#38BDF8]"
                title="Effect Intensity"
              />
            </div>

            {/* Remove Effect Button */}
            <button
              type="button"
              onClick={() => removeFilterFromClip(activeClip.id)}
              className="flex items-center gap-1 text-[10px] text-red-400 hover:text-red-300 hover:bg-red-500/10 px-1.5 py-0.5 rounded transition-colors cursor-pointer"
              title="Remove effect from active clip"
            >
              <X size={10} />
              <span>Remove</span>
            </button>
          </div>
        </div>
      )}

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
                isActive={activeClip?.filterId === item.id}
                sampleMode={samplePreviewMode}
                videoFrameSnapshot={videoFrameSnapshot}
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
