import React, { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import {
  Split,
  Sparkles,
  Layers,
  ArrowRight,
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  Sun,
  Moon,
  MoveRight,
  Plus,
  Check,
} from 'lucide-react';
import { useTimelineStore } from '../../store/timelineStore';

export interface TransitionPreset {
  id: string;
  name: string;
  type: string;
  description: string;
  category: 'Dissolve' | 'Dip' | 'Wipe' | 'Slide';
  icon: React.ComponentType<{ size?: number; className?: string }>;
  defaultDuration: number;
}

export const TRANSITION_PRESETS: TransitionPreset[] = [
  {
    id: 'trans_dissolve',
    name: 'Cross Dissolve',
    type: 'dissolve',
    category: 'Dissolve',
    description: 'Smooth optical blend between adjacent clips',
    icon: Sparkles,
    defaultDuration: 1.0,
  },
  {
    id: 'trans_fade_black',
    name: 'Dip to Black',
    type: 'fade',
    category: 'Dip',
    description: 'Fade out through black into incoming angle',
    icon: Moon,
    defaultDuration: 0.8,
  },
  {
    id: 'trans_fade_white',
    name: 'Dip to White',
    type: 'fadewhite',
    category: 'Dip',
    description: 'Luminous exposure flash dissolve',
    icon: Sun,
    defaultDuration: 0.5,
  },
  {
    id: 'trans_wipe_left',
    name: 'Wipe Left',
    type: 'wipeleft',
    category: 'Wipe',
    description: 'Directional boundary wipe right-to-left',
    icon: ArrowLeft,
    defaultDuration: 0.8,
  },
  {
    id: 'trans_wipe_right',
    name: 'Wipe Right',
    type: 'wiperight',
    category: 'Wipe',
    description: 'Directional boundary wipe left-to-right',
    icon: ArrowRight,
    defaultDuration: 0.8,
  },
  {
    id: 'trans_slide_up',
    name: 'Slide Up',
    type: 'slideup',
    category: 'Slide',
    description: 'Incoming angle pushes vertically upwards',
    icon: ArrowUp,
    defaultDuration: 0.7,
  },
  {
    id: 'trans_slide_down',
    name: 'Slide Down',
    type: 'slidedown',
    category: 'Slide',
    description: 'Incoming angle pushes vertically downwards',
    icon: ArrowDown,
    defaultDuration: 0.7,
  },
];

export const TransitionsPanel: React.FC = () => {
  const {
    setActiveDragTransition,
    tracks,
    addTransition,
    selectedClipId,
    selectedTransitionId,
    updateTransition,
    transitions,
    zoom,
  } = useTimelineStore(
    useShallow((state) => ({
      setActiveDragTransition: state.setActiveDragTransition,
      tracks: state.tracks,
      addTransition: state.addTransition,
      selectedClipId: state.selectedClipId,
      selectedTransitionId: state.selectedTransitionId,
      updateTransition: state.updateTransition,
      transitions: state.transitions,
      zoom: state.zoom,
    }))
  );

  const [defaultShowBorder, setDefaultShowBorder] = useState<boolean>(false);
  const [defaultBorderColor, setDefaultBorderColor] = useState<string>('#A855F7');
  const [defaultBorderWidth, setDefaultBorderWidth] = useState<number>(2);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const selectedTransition = (transitions || []).find((t) => t.id === selectedTransitionId);
  const effectiveShowBorder = selectedTransition ? Boolean(selectedTransition.showBorder) : defaultShowBorder;
  const effectiveBorderColor = selectedTransition ? (selectedTransition.borderColor || '#A855F7') : defaultBorderColor;
  const effectiveBorderWidth = selectedTransition ? (selectedTransition.borderWidth || 2) : defaultBorderWidth;

  const handleToggleBorder = () => {
    const nextVal = !effectiveShowBorder;
    setDefaultShowBorder(nextVal);
    if (selectedTransition) {
      updateTransition(selectedTransition.id, { showBorder: nextVal });
    }
  };

  const handleSelectBorderColor = (color: string) => {
    setDefaultBorderColor(color);
    if (selectedTransition) {
      updateTransition(selectedTransition.id, { borderColor: color });
    }
  };

  const handleSelectBorderWidth = (width: number) => {
    setDefaultBorderWidth(width);
    if (selectedTransition) {
      updateTransition(selectedTransition.id, { borderWidth: width });
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((cur) => (cur === msg ? null : cur));
    }, 2400);
  };

  // Instant apply preset to selected clip or nearest cut joint
  const applyPresetDirectly = (preset: TransitionPreset) => {
    // 1. If a transition is currently selected, update its type
    if (selectedTransitionId) {
      updateTransition(selectedTransitionId, {
        transitionType: preset.type,
      });
      showToast(`Updated to ${preset.name}`);
      return;
    }

    // 2. If a clip is selected on timeline, find its adjacent neighbor on the same track
    if (selectedClipId) {
      for (const track of tracks) {
        const sortedClips = [...track.clips].sort(
          (a, b) => (a.startPositionSeconds || 0) - (b.startPositionSeconds || 0)
        );
        const idx = sortedClips.findIndex((c) => c.id === selectedClipId);
        if (idx !== -1) {
          if (idx < sortedClips.length - 1) {
            // Apply between selected clip and next clip
            addTransition({
              trackId: track.id,
              fromClipId: sortedClips[idx].id,
              toClipId: sortedClips[idx + 1].id,
              transitionType: preset.type,
              duration: preset.defaultDuration,
              alignment: 'center',
            });
            showToast(`Added ${preset.name} to cut`);
            return;
          } else if (idx > 0) {
            // Selected last clip: apply between previous clip and selected clip
            addTransition({
              trackId: track.id,
              fromClipId: sortedClips[idx - 1].id,
              toClipId: sortedClips[idx].id,
              transitionType: preset.type,
              duration: preset.defaultDuration,
              alignment: 'center',
            });
            showToast(`Added ${preset.name} to cut`);
            return;
          }
        }
      }
    }

    // 3. Fallback: Find the cut joint on the first video track nearest to the playhead
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
        const currentPlayhead = useTimelineStore.getState().playhead;
        const dist = Math.abs(currentPlayhead - cutSec);

        if (!closestJoint || dist < closestJoint.dist) {
          closestJoint = {
            fromClipId: fromClip.id,
            toClipId: toClip.id,
            dist,
          };
        }
      }

      if (closestJoint) {
        addTransition({
          trackId: track.id,
          fromClipId: closestJoint.fromClipId,
          toClipId: closestJoint.toClipId,
          transitionType: preset.type,
          duration: preset.defaultDuration,
          alignment: 'center',
        });
        showToast(`Added ${preset.name} to cut`);
        return;
      }
    }

    showToast('Select a clip or cut joint to apply transition');
  };

  const handlePointerDown = (preset: TransitionPreset, e: React.PointerEvent) => {
    // Primary left-click only
    if (e.button !== 0) return;

    const startX = e.clientX;
    const startY = e.clientY;
    let isDragging = false;

    const onPointerMove = (moveEvent: PointerEvent) => {
      const dist = Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY);
      if (dist > 5) {
        isDragging = true;
        setActiveDragTransition({
          transitionType: preset.type,
          label: preset.name,
          mouseX: moveEvent.clientX,
          mouseY: moveEvent.clientY,
        });
      }
    };

    const onPointerUp = (upEvent: PointerEvent) => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);

      if (!isDragging) {
        // Simple click without drag: apply directly
        applyPresetDirectly(preset);
        return;
      }

      setActiveDragTransition(null);

      // Resolve drop location on timeline
      const dropX = upEvent.clientX;
      const dropY = upEvent.clientY;
      const elem = document.elementFromPoint(dropX, dropY);

      // Case A: Dropped directly on a cut joint receiver
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
            transitionType: preset.type,
            duration: preset.defaultDuration,
            alignment: 'center',
          });
          showToast(`Added ${preset.name} to cut`);
          return;
        }
      }

      // Case B: Dropped on a clip - smart boundary detection
      const clipElem = elem?.closest('[data-clip-id]');
      if (clipElem) {
        const clipId = clipElem.getAttribute('data-clip-id');
        const rect = clipElem.getBoundingClientRect();
        const isLeftHalf = dropX < rect.left + rect.width / 2;

        for (const track of tracks) {
          const sortedClips = [...track.clips].sort(
            (a, b) => (a.startPositionSeconds || 0) - (b.startPositionSeconds || 0)
          );
          const clipIdx = sortedClips.findIndex((c) => c.id === clipId);
          if (clipIdx !== -1) {
            if (isLeftHalf && clipIdx > 0) {
              // Connect previous clip with this clip
              addTransition({
                trackId: track.id,
                fromClipId: sortedClips[clipIdx - 1].id,
                toClipId: sortedClips[clipIdx].id,
                transitionType: preset.type,
                duration: preset.defaultDuration,
                alignment: 'center',
              });
              showToast(`Added ${preset.name} to cut`);
              return;
            } else if (!isLeftHalf && clipIdx < sortedClips.length - 1) {
              // Connect this clip with next clip
              addTransition({
                trackId: track.id,
                fromClipId: sortedClips[clipIdx].id,
                toClipId: sortedClips[clipIdx + 1].id,
                transitionType: preset.type,
                duration: preset.defaultDuration,
                alignment: 'center',
              });
              showToast(`Added ${preset.name} to cut`);
              return;
            } else if (sortedClips.length > 1) {
              // Fallback to whichever neighbor exists
              const from = clipIdx > 0 ? sortedClips[clipIdx - 1] : sortedClips[0];
              const to = clipIdx > 0 ? sortedClips[clipIdx] : sortedClips[1];
              addTransition({
                trackId: track.id,
                fromClipId: from.id,
                toClipId: to.id,
                transitionType: preset.type,
                duration: preset.defaultDuration,
                alignment: 'center',
              });
              showToast(`Added ${preset.name} to cut`);
              return;
            }
          }
        }
      }

      // Case C: Dropped anywhere along a track lane
      const trackElem = elem?.closest('[data-track-id]');
      if (trackElem) {
        const trackId = trackElem.getAttribute('data-track-id');
        const track = (tracks || []).find((t) => t.id === trackId);
        if (track && track.clips && track.clips.length >= 2) {
          const trackRect = trackElem.getBoundingClientRect();
          const dropOffsetX = dropX - trackRect.left;
          const dropSec = Math.max(0, dropOffsetX / (zoom || 50));

          const sortedClips = [...track.clips].sort(
            (a, b) => (a.startPositionSeconds || 0) - (b.startPositionSeconds || 0)
          );

          let closestJoint: { fromClipId: string; toClipId: string; dist: number } | null = null;
          for (let i = 0; i < sortedClips.length - 1; i++) {
            const fromClip = sortedClips[i];
            const toClip = sortedClips[i + 1];
            const cutSec =
              ((fromClip.startPositionSeconds || 0) +
                (fromClip.durationSeconds || 0) +
                (toClip.startPositionSeconds || 0)) /
              2;
            const dist = Math.abs(dropSec - cutSec);
            if (!closestJoint || dist < closestJoint.dist) {
              closestJoint = { fromClipId: fromClip.id, toClipId: toClip.id, dist };
            }
          }

          if (closestJoint && closestJoint.dist < 5.0) {
            addTransition({
              trackId: track.id,
              fromClipId: closestJoint.fromClipId,
              toClipId: closestJoint.toClipId,
              transitionType: preset.type,
              duration: preset.defaultDuration,
              alignment: 'center',
            });
            showToast(`Added ${preset.name} to cut`);
          }
        }
      }
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#14161B] select-none overflow-hidden relative">
      {/* Header bar */}
      <div className="h-10 px-3 bg-[#101217] border-b border-[#222630] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Split size={14} className="text-[#A855F7]" />
          <span className="text-xs font-bold text-[#F0F3F8]">Transitions Bin</span>
          <span className="text-[10px] font-mono text-[#64748B] bg-[#1E222D] px-1.5 py-0.2 rounded">
            {TRANSITION_PRESETS.length} Presets
          </span>
        </div>
        <span className="text-[10px] font-mono text-[#8A92A6]">Drag or Click to Apply</span>
      </div>

      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="absolute top-11 left-3 right-3 z-30 flex items-center justify-center gap-1.5 py-1 px-2.5 rounded-md bg-[#A855F7] text-white text-[11px] font-semibold shadow-lg animate-in fade-in duration-150">
          <Check size={12} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Grid of Transition Presets */}
      <div className="flex-1 overflow-y-auto p-3 grid grid-cols-2 gap-2.5">
        {TRANSITION_PRESETS.map((preset) => {
          const Icon = preset.icon;
          return (
            <div
              key={preset.id}
              onPointerDown={(e) => handlePointerDown(preset, e)}
              onDoubleClick={() => applyPresetDirectly(preset)}
              className="group relative bg-[#0D0E11] hover:bg-[#181B24] border border-[#222630] hover:border-[#A855F7]/70 rounded-lg p-2.5 flex flex-col justify-between transition-all cursor-grab active:cursor-grabbing hover:shadow-[0_4px_16px_rgba(168,85,247,0.2)]"
            >
              <div className="flex items-start justify-between">
                <div className="w-8 h-8 rounded-md bg-[#A855F7]/15 border border-[#A855F7]/30 flex items-center justify-center text-[#A855F7] group-hover:scale-105 transition-transform">
                  <Icon size={16} />
                </div>
                <span className="text-[9px] font-mono uppercase tracking-wider text-[#64748B] bg-[#1E222D] px-1 py-0.2 rounded">
                  {preset.category}
                </span>
              </div>

              <div className="mt-2 space-y-0.5">
                <div className="text-xs font-semibold text-[#F0F3F8] group-hover:text-[#A855F7] transition-colors">
                  {preset.name}
                </div>
                <div className="text-[10px] text-[#64748B] line-clamp-2 leading-tight">
                  {preset.description}
                </div>
              </div>

              <div className="mt-2 pt-1.5 border-t border-[#1C202B] flex items-center justify-between text-[10px] font-mono text-[#8A92A6]">
                <span>{preset.defaultDuration}s</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    applyPresetDirectly(preset);
                  }}
                  className="px-2 py-0.5 rounded bg-[#A855F7]/20 hover:bg-[#A855F7] text-[#A855F7] hover:text-white font-sans text-[10px] font-bold flex items-center gap-0.5 transition-all cursor-pointer"
                  title="Click to apply to selected clip / cut"
                >
                  <Plus size={10} />
                  <span>Apply</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Wipe / Slide Border Customization Card */}
      <div className="p-3 bg-[#0F1117] border-t border-[#222630] space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-[#F0F3F8]">Wipe Border Guide</span>
            {selectedTransition && (
              <span className="text-[9px] font-mono text-[#A855F7] bg-[#A855F7]/15 px-1 py-0.2 rounded">
                Active Cut Selected
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={handleToggleBorder}
            className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition-all cursor-pointer ${
              effectiveShowBorder
                ? 'bg-[#A855F7] text-white shadow-[0_0_8px_rgba(168,85,247,0.5)]'
                : 'bg-[#1C202B] text-[#64748B] hover:text-[#8A92A6]'
            }`}
          >
            {effectiveShowBorder ? 'BORDER: ON' : 'BORDER: OFF'}
          </button>
        </div>

        {effectiveShowBorder && (
          <div className="space-y-2 pt-1 bg-[#14161F] p-2 rounded-md border border-[#222630]/80">
            <div className="flex items-center justify-between text-[10px] text-[#8A92A6]">
              <span>Border Color</span>
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-[9px] text-white font-bold">{effectiveBorderColor}</span>
                <input
                  type="color"
                  value={effectiveBorderColor}
                  onChange={(e) => handleSelectBorderColor(e.target.value)}
                  className="w-4 h-4 rounded cursor-pointer border-0 bg-transparent p-0"
                  title="Choose Custom Hex Color"
                />
              </div>
            </div>

            {/* Quick Swatches */}
            <div className="flex items-center justify-between gap-1">
              {[
                { name: 'Purple', hex: '#A855F7' },
                { name: 'Pink', hex: '#EC4899' },
                { name: 'Cyan', hex: '#00F0FF' },
                { name: 'White', hex: '#FFFFFF' },
                { name: 'Amber', hex: '#F59E0B' },
                { name: 'Emerald', hex: '#10B981' },
                { name: 'Red', hex: '#EF4444' },
              ].map((c) => (
                <button
                  key={c.hex}
                  type="button"
                  onClick={() => handleSelectBorderColor(c.hex)}
                  style={{ backgroundColor: c.hex }}
                  className={`w-4 h-4 rounded-full transition-transform cursor-pointer ${
                    effectiveBorderColor.toLowerCase() === c.hex.toLowerCase()
                      ? 'scale-125 ring-2 ring-white shadow-[0_0_6px_rgba(255,255,255,0.8)]'
                      : 'hover:scale-110 opacity-70 hover:opacity-100'
                  }`}
                  title={c.name}
                />
              ))}
            </div>

            {/* Width selection */}
            <div className="flex items-center justify-between text-[10px] text-[#8A92A6] pt-0.5">
              <span>Thickness</span>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 5].map((w) => (
                  <button
                    key={w}
                    type="button"
                    onClick={() => handleSelectBorderWidth(w)}
                    className={`px-1.5 py-0.5 rounded text-[9px] font-mono transition-colors cursor-pointer ${
                      effectiveBorderWidth === w
                        ? 'bg-[#A855F7] text-white font-bold'
                        : 'bg-[#1C202B] text-[#64748B] hover:text-[#8A92A6]'
                    }`}
                  >
                    {w}px
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
