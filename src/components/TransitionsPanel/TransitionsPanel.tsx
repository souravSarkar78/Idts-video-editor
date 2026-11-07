import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import {
  Search,
  Split,
  Plus,
  Check,
  Clock,
  Sparkles,
  SlidersHorizontal,
  Layers,
} from 'lucide-react';
import { useTimelineStore } from '../../store/timelineStore';
import { TRANSITIONS_CATALOG, TransitionPresetItem } from './transitionsCatalog';

interface TransitionCardProps {
  item: TransitionPresetItem;
  duration: number;
  alignment: 'center' | 'start' | 'end';
  onApply: (item: TransitionPresetItem) => void;
  onPointerDown: (item: TransitionPresetItem, e: React.PointerEvent) => void;
}

const TransitionCard: React.FC<TransitionCardProps> = ({
  item,
  onApply,
  onPointerDown,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const animFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);

  // Render static frame initially (mid-transition progress 0.5)
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
      className="group relative flex flex-col bg-[#1A1D24] hover:bg-[#202530] border border-[#262B36] hover:border-[#38BDF8]/50 rounded-lg overflow-hidden transition-all duration-200 cursor-grab active:cursor-grabbing shadow-sm hover:shadow-[0_4px_16px_rgba(56, 189, 248,0.15)]"
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
          {item.category.replace('& ', '')}
        </div>

        {/* Quick Add Overlay Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onApply(item);
          }}
          className="absolute bottom-1.5 right-1.5 w-6 h-6 rounded-md flex items-center justify-center bg-[#38BDF8] text-[#0A0D14] opacity-0 group-hover:opacity-100 hover:scale-110 shadow-[0_0_8px_rgba(56, 189, 248,0.5)] transition-all"
          title="Apply Transition to Cut"
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
          <span className="text-[9px] font-mono text-[#64748B] shrink-0">
            {item.defaultDuration}s
          </span>
        </div>
        <p className="text-[9px] text-[#64748B] line-clamp-1 mt-0.5">
          {item.description}
        </p>
      </div>
    </div>
  );
};

export const TransitionsPanel: React.FC = () => {
  const {
    tracks,
    addTransition,
    setActiveDragTransition,
    selectedClipId,
  } = useTimelineStore(
    useShallow((state) => ({
      tracks: state.tracks,
      addTransition: state.addTransition,
      setActiveDragTransition: state.setActiveDragTransition,
      selectedClipId: state.selectedClipId,
    }))
  );

  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [defaultDuration, setDefaultDuration] = useState<number>(0.5);
  const [alignment, setAlignment] = useState<'center' | 'start' | 'end'>('center');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2000);
  };

  const categories = [
    'All',
    'Smooth & Whip',
    'Glitch & Digital',
    'Light & Atmospheric',
    'Geometric & Shapes',
    'Artistic & Organic',
    'Trending',
  ] as const;

  const filteredItems = useMemo(() => {
    return TRANSITIONS_CATALOG.filter((item) => {
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

  const applyPresetDirectly = (item: TransitionPresetItem) => {
    // 1. If a clip is selected, find its neighbor cut
    if (selectedClipId) {
      for (const track of tracks) {
        if (track.trackType !== 'video' && track.type !== 'video') continue;
        const clipIdx = track.clips.findIndex((c) => c.id === selectedClipId);
        if (clipIdx !== -1) {
          if (clipIdx < track.clips.length - 1) {
            const nextClip = track.clips[clipIdx + 1];
            addTransition({
              trackId: track.id,
              fromClipId: selectedClipId,
              toClipId: nextClip.id,
              transitionType: item.xfadeName,
              duration: defaultDuration,
              alignment,
            });
            showToast(`Added ${item.name} to cut`);
            return;
          } else if (clipIdx > 0) {
            const prevClip = track.clips[clipIdx - 1];
            addTransition({
              trackId: track.id,
              fromClipId: prevClip.id,
              toClipId: selectedClipId,
              transitionType: item.xfadeName,
              duration: defaultDuration,
              alignment,
            });
            showToast(`Added ${item.name} to cut`);
            return;
          }
        }
      }
    }

    // 2. Fallback: Find closest cut to current playhead on first video track
    const currentPlayhead = useTimelineStore.getState().playhead;
    for (const track of tracks) {
      if (track.trackType !== 'video' && track.type !== 'video') continue;
      const sortedClips = [...track.clips].sort(
        (a, b) => (a.startPositionSeconds || 0) - (b.startPositionSeconds || 0)
      );

      let closestJoint: { fromClipId: string; toClipId: string; dist: number } | null = null;
      for (let i = 0; i < sortedClips.length - 1; i++) {
        const fromClip = sortedClips[i];
        const toClip = sortedClips[i + 1];
        const fromEnd = (fromClip.startPositionSeconds || 0) + (fromClip.durationSeconds || 0);
        const toStart = toClip.startPositionSeconds || 0;
        const cutSec = (fromEnd + toStart) / 2;
        const dist = Math.abs(currentPlayhead - cutSec);

        if (!closestJoint || dist < closestJoint.dist) {
          closestJoint = { fromClipId: fromClip.id, toClipId: toClip.id, dist };
        }
      }

      if (closestJoint) {
        addTransition({
          trackId: track.id,
          fromClipId: closestJoint.fromClipId,
          toClipId: closestJoint.toClipId,
          transitionType: item.xfadeName,
          duration: defaultDuration,
          alignment,
        });
        showToast(`Added ${item.name} to cut`);
        return;
      }
    }

    showToast('Select a clip or cut joint to apply transition');
  };

  const handlePointerDown = (item: TransitionPresetItem, e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const startX = e.clientX;
    const startY = e.clientY;
    let isDragging = false;

    const onPointerMove = (moveEvent: PointerEvent) => {
      const dist = Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY);
      if (dist > 5) {
        isDragging = true;
        setActiveDragTransition({
          transitionType: item.xfadeName,
          label: item.name,
          mouseX: moveEvent.clientX,
          mouseY: moveEvent.clientY,
        });
      }
    };

    const onPointerUp = (upEvent: PointerEvent) => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);

      if (!isDragging) {
        applyPresetDirectly(item);
        return;
      }

      setActiveDragTransition(null);

      const dropX = upEvent.clientX;
      const dropY = upEvent.clientY;
      const elem = document.elementFromPoint(dropX, dropY);

      // Dropped on a cut joint receiver
      const jointElem = elem?.closest('[data-cut-joint]');
      if (jointElem) {
        const trackId = jointElem.getAttribute('data-track-id');
        const fromClipId = jointElem.getAttribute('data-from-clip');
        const toClipId = jointElem.getAttribute('data-to-clip');
        if (trackId && fromClipId && toClipId) {
          addTransition({
            trackId,
            fromClipId,
            toClipId,
            transitionType: item.xfadeName,
            duration: defaultDuration,
            alignment,
          });
          showToast(`Added ${item.name} to cut`);
          return;
        }
      }

      // Dropped on a clip
      const clipElem = elem?.closest('[data-clip-id]');
      if (clipElem) {
        const clipId = clipElem.getAttribute('data-clip-id');
        if (clipId) {
          for (const track of tracks) {
            const idx = track.clips.findIndex((c) => c.id === clipId);
            if (idx !== -1) {
              const targetClip = track.clips[idx];
              const rect = clipElem.getBoundingClientRect();
              const isRightSide = dropX - rect.left > rect.width / 2;

              if (isRightSide && idx < track.clips.length - 1) {
                const nextClip = track.clips[idx + 1];
                addTransition({
                  trackId: track.id,
                  fromClipId: targetClip.id,
                  toClipId: nextClip.id,
                  transitionType: item.xfadeName,
                  duration: defaultDuration,
                  alignment,
                });
                showToast(`Added ${item.name} to cut`);
                return;
              } else if (!isRightSide && idx > 0) {
                const prevClip = track.clips[idx - 1];
                addTransition({
                  trackId: track.id,
                  fromClipId: prevClip.id,
                  toClipId: targetClip.id,
                  transitionType: item.xfadeName,
                  duration: defaultDuration,
                  alignment,
                });
                showToast(`Added ${item.name} to cut`);
                return;
              }
            }
          }
        }
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
              <Split size={15} />
            </div>
            <div>
              <h2 className="text-xs font-bold text-[#F0F3F8]">Video Transitions</h2>
              <p className="text-[10px] text-[#64748B]">
                {TRANSITIONS_CATALOG.length} seamless transitions with live scrub preview
              </p>
            </div>
          </div>

          {toastMessage && (
            <div className="px-2 py-0.5 rounded bg-[#10B981]/20 border border-[#10B981]/40 text-[#10B981] text-[10px] font-bold animate-fade-in">
              {toastMessage}
            </div>
          )}
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#525D73]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search 50+ video transitions..."
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

        {/* Alignment & Duration Configuration Strip */}
        <div className="flex items-center justify-between pt-1 border-t border-[#1F232D] text-[10px] text-[#8E9CAE]">
          <div className="flex items-center gap-1.5">
            <span className="text-[#64748B]">Alignment:</span>
            <div className="flex bg-[#181B22] rounded p-0.5 border border-[#2B303C]">
              {(['start', 'center', 'end'] as const).map((align) => (
                <button
                  key={align}
                  onClick={() => setAlignment(align)}
                  className={`px-1.5 py-0.5 rounded capitalize font-medium transition-colors cursor-pointer ${
                    alignment === align
                      ? 'bg-[#38BDF8] text-[#0A0D14] font-bold'
                      : 'text-[#8E9CAE] hover:text-white'
                  }`}
                  title={`${align.toUpperCase()} on cut`}
                >
                  {align}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[#64748B]">Duration:</span>
            <input
              type="range"
              min={0.1}
              max={2.5}
              step={0.1}
              value={defaultDuration}
              onChange={(e) => setDefaultDuration(parseFloat(e.target.value))}
              className="w-16 accent-[#38BDF8] cursor-pointer"
            />
            <span className="font-mono text-[#38BDF8] w-7 text-right">
              {defaultDuration.toFixed(1)}s
            </span>
          </div>
        </div>
      </div>

      {/* Grid Content */}
      <div className="flex-1 overflow-y-auto p-3 min-h-0 custom-scrollbar">
        {filteredItems.length === 0 ? (
          <div className="h-48 flex flex-col items-center justify-center text-center p-4">
            <Split size={28} className="text-[#3A4252] mb-2" />
            <p className="text-xs font-semibold text-[#8E9CAE]">No transitions found</p>
            <p className="text-[10px] text-[#525D73] mt-1">Try another search or category filter</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3">
            {filteredItems.map((item) => (
              <TransitionCard
                key={item.id}
                item={item}
                duration={defaultDuration}
                alignment={alignment}
                onApply={applyPresetDirectly}
                onPointerDown={handlePointerDown}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
