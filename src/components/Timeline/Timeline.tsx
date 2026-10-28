import React, { useRef, useState, useEffect, useCallback, useLayoutEffect } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  ChevronLeft,
  ChevronRight,
  VolumeX,
  Volume2,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  ZoomIn,
  ZoomOut,
  RefreshCw,
  CheckCircle2,
  Video,
  Mic,
  Sliders,
  Plus,
  Trash2,
  Scissors,
  Gauge,
  Wand2,
  Sparkles,
  Zap,
  FileCode,
  Magnet,
  Undo2,
  Redo2,
  Music,
  Maximize2,
  Film,
  Type,
} from 'lucide-react';
import { Diamond, Subtitles, Waves } from '@/components/Icons';
import { useShallow } from 'zustand/react/shallow';
import { useTimelineStore } from '../../store/timelineStore';
import { formatTimecode, formatDeltaSeconds } from '../../utils/timecode';
import { MediaTrack, Clip, Transition } from '../../types/ipc';
import { ClipAudioWaveform } from './ClipAudioWaveform';
import { ClipVideoFilmstrip } from './ClipVideoFilmstrip';
import { MasterPeakMeter } from './MasterPeakMeter';
import { LiveRecordingWaveform } from './LiveRecordingWaveform';
import { getNearestCachedFrame } from '../../utils/frameCacheService';

interface TimelinePlayheadProps {
  zoom: number;
  isScrubbing: boolean;
  onScrubStart: (e: React.MouseEvent<HTMLDivElement>) => void;
}

const TimelinePlayhead: React.FC<TimelinePlayheadProps> = React.memo(({ zoom, isScrubbing, onScrubStart }) => {
  const playhead = useTimelineStore((state) => state.playhead);

  return (
    <div
      style={{ left: `${playhead * zoom}px` }}
      className="absolute top-0 bottom-0 w-0 pointer-events-none z-40"
    >
      {/* Playhead Marker (Cyan Drag Handle above the tracks on the ruler) */}
      <div
        onMouseDown={onScrubStart}
        style={{ transform: 'translateX(-50%)' }}
        className="w-4 h-6 bg-[#00F0FF] shadow-[0_0_12px_#00F0FF] -top-7 absolute flex flex-col items-center justify-center cursor-ew-resize pointer-events-auto z-50 hover:scale-110 active:scale-95 transition-transform rounded-xs select-none"
        title="Drag to Scrub Playhead"
      >
        <div className="w-1 h-2.5 bg-[#0D0E11] rounded-xs" />
        <div className="w-0 h-0 border-l-[3px] border-l-transparent border-r-[3px] border-r-transparent border-t-[4px] border-t-[#00F0FF] absolute -bottom-1" />
      </div>

      {/* Laser Needle Line with Wide Hit Target for Easy Scrubbing */}
      <div
        onMouseDown={onScrubStart}
        className="w-4 -ml-2 h-full cursor-ew-resize pointer-events-auto flex justify-center group"
        title="Drag Playhead Line"
      >
        <div className="w-[1.5px] h-full bg-[#00F0FF] shadow-[0_0_8px_#00F0FF] group-hover:w-[3px] group-hover:shadow-[0_0_12px_#00F0FF] transition-all" />
      </div>
    </div>
  );
});
TimelinePlayhead.displayName = 'TimelinePlayhead';

export const Timeline: React.FC = () => {
  const {
    project,
    tracks,
    isPlaying,
    zoom,
    selectedClipId,
    selectedClipIds,
    setPlayhead,
    stepFrames,
    togglePlayPause,
    setZoom,
    zoomIn,
    zoomOut,
    toggleTrackVisibility,
    toggleMute,
    toggleSolo,
    toggleLock,
    addTrack,
    removeTrack,
    moveClip,
    moveMultipleClips,
    selectClip,
    selectClips,
    splitClipAtPlayhead,
    deleteClip,
    deleteSelectedClips,
    extractAudioFromClip,
    duplicateClip,
    trimClipLeft,
    trimClipRight,
    stretchClip,
    edgeDragMode,
    setEdgeDragMode,
    setExportModalOpen,
    syncAllTracks,
    executeTauriSync,
    setSyncModalOpen,
    addAssetToTrack,
    importFiles,
    lastSyncMessage,
    syncPlacementMode,
    syncGapCushionSec,
    draggedAsset,
    activeDragAsset,
    isSnappingEnabled,
    toggleSnapping,
    calculateSnappedPosition,
    pushHistory,
    undo,
    redo,
    canUndo,
    canRedo,
    rippleDeleteClip,
    isRippleMode,
    toggleRippleMode,
    deleteGapAtTime,
    setSilenceModalOpen,
    transitions,
    selectedTransitionId,
    setSelectedTransitionId,
    updateTransition,
    removeTransition,
    activeDragTransition,
    addOrUpdateGlobalKeyframe,
    removeGlobalKeyframe,
    moveGlobalKeyframe,
    addOrUpdateKeyframe,
    removeKeyframe,
    expandedKeyframeClipIds,
    toggleKeyframeLane,
    addTextClip,
    setIsAutoCaptionModalOpen,
    setIsVoiceoverModalOpen,
    isRecordingVoiceover,
    startVoiceoverRecording,
    stopVoiceoverRecording,
    setInspectorTab,
    addAdjustmentLayer,
    captureNoiseProfile,
    setIsNoiseModalOpen,
    trackHeights,
    setTrackHeight,
    resetTrackHeight,
  } = useTimelineStore(
    useShallow((state) => ({
      project: state.project,
      tracks: state.tracks || [],
      isPlaying: state.isPlaying,
      zoom: state.zoom,
      selectedClipId: state.selectedClipId,
      selectedClipIds: state.selectedClipIds || [],
      setPlayhead: state.setPlayhead,
      stepFrames: state.stepFrames,
      togglePlayPause: state.togglePlayPause,
      setZoom: state.setZoom,
      zoomIn: state.zoomIn,
      zoomOut: state.zoomOut,
      toggleTrackVisibility: state.toggleTrackVisibility,
      toggleMute: state.toggleMute,
      toggleSolo: state.toggleSolo,
      toggleLock: state.toggleLock,
      addTrack: state.addTrack,
      addTextClip: state.addTextClip,
      setIsAutoCaptionModalOpen: state.setIsAutoCaptionModalOpen,
      setIsVoiceoverModalOpen: state.setIsVoiceoverModalOpen,
      isRecordingVoiceover: state.isRecordingVoiceover,
      startVoiceoverRecording: state.startVoiceoverRecording,
      stopVoiceoverRecording: state.stopVoiceoverRecording,
      setInspectorTab: state.setInspectorTab,
      removeTrack: state.removeTrack,
      moveClip: state.moveClip,
      moveMultipleClips: state.moveMultipleClips,
      selectClip: state.selectClip,
      selectClips: state.selectClips,
      splitClipAtPlayhead: state.splitClipAtPlayhead,
      deleteClip: state.deleteClip,
      deleteSelectedClips: state.deleteSelectedClips,
      extractAudioFromClip: state.extractAudioFromClip,
      duplicateClip: state.duplicateClip,
      trimClipLeft: state.trimClipLeft,
      trimClipRight: state.trimClipRight,
      stretchClip: state.stretchClip,
      edgeDragMode: state.edgeDragMode,
      setEdgeDragMode: state.setEdgeDragMode,
      setExportModalOpen: state.setExportModalOpen,
      syncAllTracks: state.syncAllTracks,
      executeTauriSync: state.executeTauriSync,
      setSyncModalOpen: state.setSyncModalOpen,
      addAssetToTrack: state.addAssetToTrack,
      importFiles: state.importFiles,
      lastSyncMessage: state.lastSyncMessage,
      syncPlacementMode: state.syncPlacementMode,
      syncGapCushionSec: state.syncGapCushionSec,
      draggedAsset: state.draggedAsset,
      activeDragAsset: state.activeDragAsset,
      isSnappingEnabled: state.isSnappingEnabled,
      toggleSnapping: state.toggleSnapping,
      calculateSnappedPosition: state.calculateSnappedPosition,
      pushHistory: state.pushHistory,
      undo: state.undo,
      redo: state.redo,
      canUndo: state.canUndo,
      canRedo: state.canRedo,
      rippleDeleteClip: state.rippleDeleteClip,
      isRippleMode: state.isRippleMode,
      toggleRippleMode: state.toggleRippleMode,
      deleteGapAtTime: state.deleteGapAtTime,
      setSilenceModalOpen: state.setSilenceModalOpen,
      transitions: state.transitions || [],
      selectedTransitionId: state.selectedTransitionId,
      setSelectedTransitionId: state.setSelectedTransitionId,
      updateTransition: state.updateTransition,
      removeTransition: state.removeTransition,
      activeDragTransition: state.activeDragTransition,
      addOrUpdateGlobalKeyframe: state.addOrUpdateGlobalKeyframe,
      removeGlobalKeyframe: state.removeGlobalKeyframe,
      moveGlobalKeyframe: state.moveGlobalKeyframe,
      addOrUpdateKeyframe: state.addOrUpdateKeyframe,
      removeKeyframe: state.removeKeyframe,
      expandedKeyframeClipIds: state.expandedKeyframeClipIds,
      toggleKeyframeLane: state.toggleKeyframeLane,
      addAdjustmentLayer: state.addAdjustmentLayer,
      captureNoiseProfile: state.captureNoiseProfile,
      setIsNoiseModalOpen: state.setIsNoiseModalOpen,
      trackHeights: state.trackHeights || {},
      setTrackHeight: state.setTrackHeight,
      resetTrackHeight: state.resetTrackHeight,
    }))
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const trackHeadersScrollRef = useRef<HTMLDivElement>(null);
  const isSyncingScrollRef = useRef(false);
  const tracksContainerRef = useRef<HTMLDivElement>(null);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [syncToast, setSyncToast] = useState<string | null>(null);

  // Synchronize vertical scrolling between track headers and timeline track lanes
  const handleRightScroll = () => {
    if (isSyncingScrollRef.current) return;
    if (scrollContainerRef.current && trackHeadersScrollRef.current) {
      isSyncingScrollRef.current = true;
      trackHeadersScrollRef.current.scrollTop = scrollContainerRef.current.scrollTop;
      requestAnimationFrame(() => {
        isSyncingScrollRef.current = false;
      });
    }
  };

  const handleLeftScroll = () => {
    if (isSyncingScrollRef.current) return;
    if (scrollContainerRef.current && trackHeadersScrollRef.current) {
      isSyncingScrollRef.current = true;
      scrollContainerRef.current.scrollTop = trackHeadersScrollRef.current.scrollTop;
      requestAnimationFrame(() => {
        isSyncingScrollRef.current = false;
      });
    }
  };

  // Real-time track height resizing handler
  const handleStartTrackResize = (trackId: string, e: React.MouseEvent, initialHeight: number) => {
    e.preventDefault();
    e.stopPropagation();
    const startY = e.clientY;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaY = moveEvent.clientY - startY;
      const newHeight = Math.max(36, Math.min(380, Math.round(initialHeight + deltaY)));
      setTrackHeight(trackId, newHeight);
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };
  const [gapContextMenu, setGapContextMenu] = useState<{
    x: number;
    y: number;
    trackId: string;
    timeSec: number;
  } | null>(null);

  // Close gap context menu on window click
  useEffect(() => {
    const handleClose = () => setGapContextMenu(null);
    window.addEventListener('click', handleClose);
    return () => window.removeEventListener('click', handleClose);
  }, []);

  // Marquee Selection Box State across tracks
  const [marqueeBox, setMarqueeBox] = useState<{
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
  } | null>(null);

  const marqueeRef = useRef<{
    isDown: boolean;
    startX: number;
    startY: number;
    isDragging: boolean;
    initialSelectedIds: string[];
    isShift: boolean;
  } | null>(null);

  const [draggingClip, setDraggingClip] = useState<{
    id: string;
    sourceTrackId: string;
    currentTrackId: string;
    initialMouseX: number;
    initialMouseY: number;
    initialStartSec: number;
    mediaType?: string;
    selectedClipPositions?: Map<string, number>;
  } | null>(null);
  const [dragOverTrackId, setDragOverTrackId] = useState<string | null>(null);
  const dragRafRef = useRef<number | null>(null);

  const [trimmingClip, setTrimmingClip] = useState<{
    id: string;
    side: 'left' | 'right';
    mode: 'trim' | 'stretch';
    initialMouseX: number;
    initialStartSec: number;
    initialInSec: number;
    initialOutSec: number;
    initialDurSec: number;
    sourceSpan: number;
    speed: number;
  } | null>(null);

  // Real-time floating tooltip pill during trimming or slow-motion stretching
  const [trimDragTooltip, setTrimDragTooltip] = useState<{
    x: number;
    y: number;
    text: string;
    isSlowMo: boolean;
  } | null>(null);

  // Global Keyframe diamond drag interaction state
  const [draggingKeyframe, setDraggingKeyframe] = useState<{
    clipId: string;
    originalTime: number;
    initialMouseX: number;
    clipDurationSec: number;
  } | null>(null);

  const handleStartKeyframeDrag = (
    clipId: string,
    time: number,
    mouseX: number,
    clipDurationSec: number
  ) => {
    setDraggingKeyframe({
      clipId,
      originalTime: time,
      initialMouseX: mouseX,
      clipDurationSec,
    });
  };

  useEffect(() => {
    if (!draggingKeyframe) return;

    const onMouseMove = (e: MouseEvent) => {
      const deltaPx = e.clientX - draggingKeyframe.initialMouseX;
      const deltaSec = deltaPx / zoom;
      const newTime = Math.max(
        0,
        Math.min(draggingKeyframe.clipDurationSec, draggingKeyframe.originalTime + deltaSec)
      );

      moveGlobalKeyframe(draggingKeyframe.clipId, draggingKeyframe.originalTime, newTime);
      setDraggingKeyframe((prev) =>
        prev ? { ...prev, originalTime: Number(newTime.toFixed(3)), initialMouseX: e.clientX } : null
      );
    };

    const onMouseUp = () => {
      setDraggingKeyframe(null);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [draggingKeyframe, zoom, moveGlobalKeyframe]);

  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    clipId: string;
    trackId: string;
    clipName: string;
    isVideo: boolean;
    hasAttachedAudio: boolean;
  } | null>(null);

  useEffect(() => {
    const handleCloseMenu = () => setContextMenu(null);
    window.addEventListener('click', handleCloseMenu);
    return () => window.removeEventListener('click', handleCloseMenu);
  }, []);

  // Dynamic timeline span: automatically expands to contain all clips no matter how long the videos are!
  const allClips = tracks.flatMap((t) => t.clips);
  const maxClipEndSec = allClips.reduce((max, clip) => {
    const end = (clip.startPositionSeconds ?? 0) + (clip.durationSeconds ?? 0);
    return Math.max(max, end);
  }, 0);

  const durationSeconds = Math.max((project.durationMs || 120000) / 1000, maxClipEndSec > 0 ? maxClipEndSec + 30 : 60);

  const pendingScrollLeftRef = useRef<number | null>(null);

  // Perspective Zoom Anchored to the Timeline Playhead Bar
  const applyAnchoredZoom = useCallback(
    (targetZoom: number) => {
      const scrollElem = scrollContainerRef.current;
      if (!scrollElem) {
        setZoom(targetZoom);
        return;
      }

      const currentZoom = useTimelineStore.getState().zoom;
      if (Math.abs(targetZoom - currentZoom) < 0.0001) return;

      const currentPlayhead = useTimelineStore.getState().playhead;
      const viewportWidth = scrollElem.clientWidth;
      // Use pendingScrollLeft if a zoom event was queued earlier in the same frame
      const currentScrollLeft =
        pendingScrollLeftRef.current !== null
          ? pendingScrollLeftRef.current
          : scrollElem.scrollLeft;

      // Current visual offset of the playhead bar from the left of the scroll viewport
      const playheadScreenX = currentPlayhead * currentZoom - currentScrollLeft;

      // Perspective rule:
      // If playhead bar is in the viewport (with 10px margin), keep it at its exact screen position ("in place").
      // If playhead bar is scrolled off-screen or out of view, center it in the middle of the viewport ("middle").
      let targetScreenX: number;
      if (playheadScreenX >= 10 && playheadScreenX <= viewportWidth - 10) {
        targetScreenX = playheadScreenX;
      } else {
        targetScreenX = viewportWidth / 2;
      }

      // Compute required scrollLeft: currentPlayhead * targetZoom - newScrollLeft = targetScreenX
      const newScrollLeft = Math.max(0, currentPlayhead * targetZoom - targetScreenX);

      // Apply scroll immediately (when scrollWidth allows) and queue for useLayoutEffect after DOM layout
      scrollElem.scrollLeft = newScrollLeft;
      pendingScrollLeftRef.current = newScrollLeft;

      setZoom(targetZoom);
    },
    [setZoom]
  );

  // Ensure scrollLeft applies cleanly after DOM expands/contracts to new zoom dimensions
  useLayoutEffect(() => {
    if (pendingScrollLeftRef.current !== null && scrollContainerRef.current) {
      scrollContainerRef.current.scrollLeft = pendingScrollLeftRef.current;
      pendingScrollLeftRef.current = null;
    }
  }, [zoom]);

  // Zoom to fit all available media across the timeline
  const handleZoomToFit = useCallback(() => {
    if (!scrollContainerRef.current) return;
    const visibleWidth = scrollContainerRef.current.clientWidth - 40;
    const timelineSec = Math.max(maxClipEndSec > 0 ? maxClipEndSec + 10 : durationSeconds, 10);
    const fitZoom = Math.max(0.02, Math.min(300, visibleWidth / timelineSec));
    setZoom(fitZoom);
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollLeft = 0;
    }
  }, [maxClipEndSec, durationSeconds, setZoom]);

  // Ctrl + Mouse Wheel Zoom In / Out
  useEffect(() => {
    const scrollElem = scrollContainerRef.current;
    if (!scrollElem) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        e.stopPropagation();

        const currentZoom = useTimelineStore.getState().zoom;
        const zoomFactor = e.deltaY < 0 ? 1.2 : 0.833;

        // Minimum zoom allows zooming out to fit all available video/audio in the view
        const visibleWidth = scrollElem.clientWidth - 40;
        const timelineSec = Math.max(maxClipEndSec > 0 ? maxClipEndSec + 10 : durationSeconds, 10);
        const minFitZoom = Math.max(0.02, visibleWidth / timelineSec);

        const targetZoom = Math.max(minFitZoom * 0.85, Math.min(400, currentZoom * zoomFactor));
        applyAnchoredZoom(targetZoom);
      }
    };

    scrollElem.addEventListener('wheel', handleWheel, { passive: false });
    return () => scrollElem.removeEventListener('wheel', handleWheel);
  }, [durationSeconds, maxClipEndSec, applyAnchoredZoom]);

  // Scrubbing logic
  const handleRulerScrub = useCallback(
    (e: React.MouseEvent<HTMLDivElement> | MouseEvent) => {
      if (!scrollContainerRef.current) return;
      const rect = scrollContainerRef.current.getBoundingClientRect();
      const scrollLeft = scrollContainerRef.current.scrollLeft;
      const clickX = e.clientX - rect.left + scrollLeft;
      const newTime = Math.max(0, Math.min(clickX / zoom, durationSeconds));
      setPlayhead(newTime);
    },
    [zoom, durationSeconds, setPlayhead]
  );

  const handleRulerMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsScrubbing(true);
    handleRulerScrub(e);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      // 1. Timecode Ruler Scrubbing
      if (isScrubbing) {
        handleRulerScrub(e);
        return;
      }

      // 2. Marquee Box Dragging across Multiple Tracks
      if (marqueeRef.current && marqueeRef.current.isDown) {
        const container = tracksContainerRef.current;
        if (!container) return;
        const rect = container.getBoundingClientRect();
        const currentX = Math.max(0, e.clientX - rect.left);
        const currentY = Math.max(0, e.clientY - rect.top);

        const dist = Math.hypot(currentX - marqueeRef.current.startX, currentY - marqueeRef.current.startY);
        if (!marqueeRef.current.isDragging && dist > 5) {
          marqueeRef.current.isDragging = true;
        }

        if (marqueeRef.current.isDragging) {
          setMarqueeBox({
            startX: marqueeRef.current.startX,
            startY: marqueeRef.current.startY,
            currentX,
            currentY,
          });

          // Compute Marquee Rectangle in pixels and seconds
          const boxLeftPx = Math.min(marqueeRef.current.startX, currentX);
          const boxRightPx = Math.max(marqueeRef.current.startX, currentX);
          const boxTopPx = Math.min(marqueeRef.current.startY, currentY);
          const boxBottomPx = Math.max(marqueeRef.current.startY, currentY);

          const boxStartSec = boxLeftPx / zoom;
          const boxEndSec = boxRightPx / zoom;

          const newlySelectedIds = new Set<string>(marqueeRef.current.initialSelectedIds);

          // Multi-track intersection testing across all track lanes
          const trackLanes = container.querySelectorAll<HTMLElement>('[data-track-id]');
          trackLanes.forEach((trackElem) => {
            const trackId = trackElem.getAttribute('data-track-id');
            const trackObj = tracks.find((t) => t.id === trackId);
            if (!trackObj) return;

            const trackTop = trackElem.offsetTop;
            const trackBottom = trackTop + trackElem.offsetHeight;

            // Check vertical intersection with this track lane
            const yIntersects = !(boxBottomPx < trackTop || boxTopPx > trackBottom);
            if (!yIntersects) return;

            // Check each clip on this track horizontally
            trackObj.clips.forEach((clip) => {
              const cStart = clip.startPositionSeconds || 0;
              const cEnd = cStart + (clip.durationSeconds || 10);

              // Does clip overlap horizontally with marquee time window?
              const xIntersects = !(boxEndSec < cStart || boxStartSec > cEnd);
              if (xIntersects) {
                newlySelectedIds.add(clip.id);
              }
            });
          });

          selectClips(Array.from(newlySelectedIds));
        }
        return;
      }

      // 3. Clip Trimming (Recover Footage) or Slow-Mo Rate Stretching
      if (trimmingClip) {
        const clientX = e.clientX;
        const clientY = e.clientY;
        if (dragRafRef.current) cancelAnimationFrame(dragRafRef.current);
        dragRafRef.current = requestAnimationFrame(() => {
          const deltaX = clientX - trimmingClip.initialMouseX;
          const deltaSec = deltaX / zoom;

          if (trimmingClip.mode === 'stretch') {
            if (trimmingClip.side === 'left') {
              const newDur = Math.max(0.1, trimmingClip.initialDurSec - deltaSec);
              const newStart = Math.max(0, trimmingClip.initialStartSec + deltaSec);
              stretchClip(trimmingClip.id, newDur, newStart);
              const newSpeed = Number((trimmingClip.sourceSpan / newDur).toFixed(2));
              setTrimDragTooltip({
                x: clientX + 16,
                y: clientY - 32,
                text: newSpeed < 1.0 ? `Slow-Mo: ${newSpeed}x (${newDur.toFixed(2)}s)` : `Fast-Motion: ${newSpeed}x (${newDur.toFixed(2)}s)`,
                isSlowMo: newSpeed < 1.0,
              });
            } else {
              const newDur = Math.max(0.1, trimmingClip.initialDurSec + deltaSec);
              stretchClip(trimmingClip.id, newDur);
              const newSpeed = Number((trimmingClip.sourceSpan / newDur).toFixed(2));
              setTrimDragTooltip({
                x: clientX + 16,
                y: clientY - 32,
                text: newSpeed < 1.0 ? `Slow-Mo: ${newSpeed}x (${newDur.toFixed(2)}s)` : `Fast-Motion: ${newSpeed}x (${newDur.toFixed(2)}s)`,
                isSlowMo: newSpeed < 1.0,
              });
            }
          } else {
            if (trimmingClip.side === 'left') {
              trimClipLeft(
                trimmingClip.id,
                deltaSec,
                trimmingClip.initialStartSec,
                trimmingClip.initialInSec,
                trimmingClip.initialDurSec,
                trimmingClip.speed
              );
              const newDur = Math.max(0.1, trimmingClip.initialDurSec - deltaSec);
              const diff = newDur - trimmingClip.initialDurSec;
              setTrimDragTooltip({
                x: clientX + 16,
                y: clientY - 32,
                text: diff >= 0 ? `Recovered: +${diff.toFixed(2)}s (${newDur.toFixed(2)}s)` : `Trimmed: ${diff.toFixed(2)}s (${newDur.toFixed(2)}s)`,
                isSlowMo: false,
              });
            } else {
              trimClipRight(
                trimmingClip.id,
                deltaSec,
                trimmingClip.initialDurSec,
                trimmingClip.initialInSec,
                trimmingClip.speed
              );
              const newDur = Math.max(0.1, trimmingClip.initialDurSec + deltaSec);
              const diff = newDur - trimmingClip.initialDurSec;
              setTrimDragTooltip({
                x: clientX + 16,
                y: clientY - 32,
                text: diff >= 0 ? `Recovered: +${diff.toFixed(2)}s (${newDur.toFixed(2)}s)` : `Trimmed: ${diff.toFixed(2)}s (${newDur.toFixed(2)}s)`,
                isSlowMo: false,
              });
            }
          }
        });
        return;
      }

      // 4. Clip Dragging (Single or Multi-Clip Group Move)
      if (draggingClip) {
        const clientX = e.clientX;
        const clientY = e.clientY;

        if (dragRafRef.current) cancelAnimationFrame(dragRafRef.current);
        dragRafRef.current = requestAnimationFrame(() => {
          const deltaX = clientX - draggingClip.initialMouseX;
          const deltaSec = deltaX / zoom;
          const rawStart = Math.max(0, draggingClip.initialStartSec + deltaSec);

          const clipObj = allClips.find((c) => c.id === draggingClip.id);
          const durSec = clipObj?.durationSeconds || 10;
          const newStart = calculateSnappedPosition(rawStart, durSec, draggingClip.id, zoom);
          const snappedDeltaSec = newStart - draggingClip.initialStartSec;

          // Find track under cursor via elementFromPoint
          const element = document.elementFromPoint(clientX, clientY);
          const trackLaneElem = element?.closest('[data-track-id]');
          const hoveredTrackId = trackLaneElem?.getAttribute('data-track-id');

          let targetTrackId = draggingClip.currentTrackId;
          if (hoveredTrackId && hoveredTrackId !== draggingClip.currentTrackId) {
            const currentTracks = useTimelineStore.getState().tracks;
            const targetTrack = currentTracks.find((t) => t.id === hoveredTrackId);
            if (targetTrack && !targetTrack.locked && !targetTrack.isLocked) {
              const targetType = targetTrack.trackType || targetTrack.type;
              const isCompatible =
                !draggingClip.mediaType ||
                (draggingClip.mediaType === 'audio' ? targetType === 'audio' : targetType === 'video');

              if (isCompatible) {
                targetTrackId = hoveredTrackId;
                setDraggingClip((prev) => (prev ? { ...prev, currentTrackId: hoveredTrackId } : null));
              }
            }
          }

          // If multiple clips are selected, move all in lockstep!
          if (draggingClip.selectedClipPositions && draggingClip.selectedClipPositions.size > 1) {
            const moves: Array<{ clipId: string; newStartSec: number }> = [];
            draggingClip.selectedClipPositions.forEach((initSec, id) => {
              moves.push({
                clipId: id,
                newStartSec: Math.max(0, initSec + snappedDeltaSec),
              });
            });
            moveMultipleClips(moves);
          } else {
            moveClip(draggingClip.id, newStart, targetTrackId);
          }
        });
      }
    };

    const handleMouseUp = () => {
      if (dragRafRef.current) {
        cancelAnimationFrame(dragRafRef.current);
        dragRafRef.current = null;
      }
      if (isScrubbing) setIsScrubbing(false);
      if (draggingClip) setDraggingClip(null);
      if (trimmingClip) setTrimmingClip(null);
      setTrimDragTooltip(null);

      // Finish or cancel Marquee selection
      if (marqueeRef.current) {
        if (marqueeRef.current.isDragging) {
          setMarqueeBox(null);
        } else if (!marqueeRef.current.isShift) {
          // Normal click on empty track space: clear selection and seek playhead
          selectClips([]);
          const clickSec = Math.max(0, marqueeRef.current.startX / zoom);
          setPlayhead(Math.min(clickSec, durationSeconds));
        }
        marqueeRef.current = null;
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [
    isScrubbing,
    draggingClip,
    trimmingClip,
    zoom,
    allClips,
    calculateSnappedPosition,
    tracks,
    selectClips,
    durationSeconds,
    setPlayhead,
    moveClip,
    moveMultipleClips,
    trimClipLeft,
    trimClipRight,
    stretchClip,
    handleRulerScrub,
  ]);

  // Edge Drag Mode keyboard shortcut listener (T for Trim, R for Rate Stretch / Slow-Mo)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.code === 'KeyT') {
        setEdgeDragMode('trim');
      } else if (e.code === 'KeyR') {
        setEdgeDragMode('stretch');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setEdgeDragMode]);

  // Multi-Sync Action trigger (calls Tauri IPC sync_active_timeline with fallback)
  const handleSyncAll = async () => {
    const res = await executeTauriSync();
    setSyncToast(res.message);
    setTimeout(() => setSyncToast(null), 4500);
  };

  // Drag and Drop from Media Pool onto Track Lanes & Headers
  const handleLaneDragOver = (e: React.DragEvent, trackId?: string) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
    if (trackId && trackId !== dragOverTrackId) {
      setDragOverTrackId(trackId);
    }
  };

  const handleLaneDragLeave = (e: React.DragEvent, trackId: string) => {
    e.preventDefault();
    if (dragOverTrackId === trackId) {
      setDragOverTrackId(null);
    }
  };

  const extractDroppedAssetId = (e: React.DragEvent): string | null => {
    try {
      const jsonStr = e.dataTransfer.getData('application/json');
      if (jsonStr) {
        const parsed = JSON.parse(jsonStr);
        if (parsed.assetId) return parsed.assetId;
      }
    } catch {}
    const plainText = e.dataTransfer.getData('text/plain');
    if (plainText) return plainText;
    return useTimelineStore.getState().draggedAsset?.id || null;
  };

  const handleLaneDrop = (e: React.DragEvent, trackId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverTrackId(null);

    let targetSec = useTimelineStore.getState().playhead;
    if (scrollContainerRef.current) {
      const rect = scrollContainerRef.current.getBoundingClientRect();
      const scrollLeft = scrollContainerRef.current.scrollLeft;
      const dropX = e.clientX - rect.left + scrollLeft;
      targetSec = Math.max(0, dropX / zoom);
    }

    // Check if dropped item is a filter preset or 3D LUT
    try {
      const rawJson = e.dataTransfer.getData('application/json');
      if (rawJson) {
        const payload = JSON.parse(rawJson);
        if (payload?.type === 'filter-preset' && payload.preset) {
          const clipUnderDrop = allClips.find((c) => {
            const start = c.startPositionSeconds ?? (c.startTimeMs / 1000);
            const dur = c.durationSeconds ?? (c.durationMs / 1000);
            return targetSec >= start && targetSec <= start + dur;
          });
          if (clipUnderDrop) {
            useTimelineStore.getState().applyFilterPreset(payload.preset, clipUnderDrop.id);
          } else {
            useTimelineStore.getState().applyFilterPreset(payload.preset);
          }
          return;
        }
      }
    } catch {
      // ignore
    }

    // 1. Files dropped directly from Windows Explorer
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files);
      importFiles(files);
      setTimeout(() => {
        const store = useTimelineStore.getState();
        const latestAsset = store.assets[store.assets.length - 1];
        if (latestAsset) {
          store.addAssetToTrack(latestAsset.id, trackId, targetSec);
        }
      }, 150);
      return;
    }

    // 2. Dragged asset from Media Pool
    const assetId = extractDroppedAssetId(e);
    if (assetId) {
      addAssetToTrack(assetId, trackId, targetSec);
    }
    useTimelineStore.getState().setDraggedAsset(null);
    useTimelineStore.getState().setActiveDragAsset(null);
  };

  const handleHeaderDrop = (e: React.DragEvent, trackId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverTrackId(null);

    const assetId = extractDroppedAssetId(e);
    if (!assetId) return;

    addAssetToTrack(assetId, trackId, useTimelineStore.getState().playhead);
    useTimelineStore.getState().setDraggedAsset(null);
    useTimelineStore.getState().setActiveDragAsset(null);
  };

  const handleTimelineContainerDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverTrackId(null);

    let targetSec = useTimelineStore.getState().playhead;
    if (scrollContainerRef.current) {
      const rect = scrollContainerRef.current.getBoundingClientRect();
      const scrollLeft = scrollContainerRef.current.scrollLeft;
      const dropX = e.clientX - rect.left + scrollLeft;
      targetSec = Math.max(0, dropX / zoom);
    }

    // Check if dropped item is a filter preset or 3D LUT
    try {
      const rawJson = e.dataTransfer.getData('application/json');
      if (rawJson) {
        const payload = JSON.parse(rawJson);
        if (payload?.type === 'filter-preset' && payload.preset) {
          const clipUnderDrop = allClips.find((c) => {
            const start = c.startPositionSeconds ?? (c.startTimeMs / 1000);
            const dur = c.durationSeconds ?? (c.durationMs / 1000);
            return targetSec >= start && targetSec <= start + dur;
          });
          if (clipUnderDrop) {
            useTimelineStore.getState().applyFilterPreset(payload.preset, clipUnderDrop.id);
          } else {
            useTimelineStore.getState().applyFilterPreset(payload.preset);
          }
          return;
        }
      }
    } catch {
      // ignore
    }

    // 1. Files dropped directly from Windows Explorer
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files);
      importFiles(files);
      setTimeout(() => {
        const store = useTimelineStore.getState();
        const latestAsset = store.assets[store.assets.length - 1];
        if (latestAsset) {
          const currentTracks = store.tracks;
          const targetTrack =
            currentTracks.find((t) => (t.trackType || t.type) === latestAsset.mediaType) ||
            currentTracks[0];
          if (targetTrack) {
            store.addAssetToTrack(latestAsset.id, targetTrack.id, targetSec);
          } else {
            const newTrackId = store.addTrack(latestAsset.mediaType === 'audio' ? 'audio' : 'video');
            store.addAssetToTrack(latestAsset.id, newTrackId, targetSec);
          }
        }
      }, 150);
      return;
    }

    // 2. Dragged asset from Media Pool
    const assetId = extractDroppedAssetId(e);
    if (!assetId) return;

    const currentAssets = useTimelineStore.getState().assets;
    const currentTracks = useTimelineStore.getState().tracks;
    const asset = currentAssets.find((a) => a.id === assetId);
    const mediaType = asset?.mediaType || 'video';

    // Find first compatible track or create one
    let targetTrack = currentTracks.filter((t) => (t.trackType || t.type) === mediaType).pop();
    if (!targetTrack && currentTracks.length > 0) {
      targetTrack = currentTracks[0];
    }

    if (targetTrack) {
      addAssetToTrack(assetId, targetTrack.id, targetSec);
    } else {
      const newTrackId = addTrack(mediaType === 'audio' ? 'audio' : 'video');
      addAssetToTrack(assetId, newTrackId, targetSec);
    }
    useTimelineStore.getState().setDraggedAsset(null);
    useTimelineStore.getState().setActiveDragAsset(null);
  };

  const handleSelectClip = useCallback(
    (clipId: string, isShift?: boolean) => {
      selectClip(clipId, isShift);
      // Auto-switch Inspector to 'audio' if selecting an audio clip or clip on audio track
      for (const t of tracks) {
        if (t.clips?.some((c) => c.id === clipId)) {
          if (t.trackType === 'audio' || t.type === 'audio') {
            setInspectorTab('audio');
          }
          break;
        }
      }
    },
    [selectClip, tracks, setInspectorTab]
  );

  // Ruler ticks generator
  const totalRulerSeconds = Math.max(durationSeconds, 60);
  const stepInterval =
    zoom < 0.2 ? 600 :
    zoom < 0.8 ? 300 :
    zoom < 2 ? 60 :
    zoom < 8 ? 30 :
    zoom < 25 ? 10 :
    zoom < 60 ? 5 : 1;

  const rulerTicks: number[] = [];
  for (let sec = 0; sec <= totalRulerSeconds; sec += stepInterval) {
    rulerTicks.push(sec);
  }

  const syncedCount = allClips.filter((c) => c.synced || c.isSynced).length;

  return (
    <div
      ref={containerRef}
      className="flex flex-col h-full bg-[#0D0E11] text-[#F0F3F8] border-t border-[#222630] select-none relative"
    >
      {/* Toast Notification for Multi-Sync Action */}
      {syncToast && (
        <div className="absolute top-12 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg bg-[#14161B]/95 backdrop-blur-md border border-[#00F0FF]/60 text-xs font-semibold text-[#F0F3F8] shadow-2xl flex items-center gap-2 animate-bounce">
          <Zap size={14} className="text-[#00F0FF]" />
          <span>{syncToast}</span>
        </div>
      )}

      {/* TOP TIMELINE TOOLBAR (1-Row, Flex-Wrap If Overflow, Sync on Rightmost) */}
      <div className="min-h-10 py-1 bg-[#14161B] border-b border-[#222630] px-3 flex flex-wrap items-center justify-between gap-y-1 gap-x-2 z-20 shrink-0">
        {/* Left Tools (One-row with flex-wrap) */}
        <div className="flex flex-wrap items-center gap-1">
          {/* 1. Undo / Redo */}
          <button
            onClick={undo}
            disabled={!canUndo()}
            title="Undo (Ctrl+Z)"
            className={`w-7 h-7 flex items-center justify-center rounded-md transition-colors ${
              canUndo()
                ? 'hover:bg-[#222630] text-[#8A92A6] hover:text-[#00F0FF] cursor-pointer'
                : 'text-[#3E4554] cursor-not-allowed'
            }`}
          >
            <Undo2 size={13} />
          </button>

          <button
            onClick={redo}
            disabled={!canRedo()}
            title="Redo (Ctrl+Y)"
            className={`w-7 h-7 flex items-center justify-center rounded-md transition-colors ${
              canRedo()
                ? 'hover:bg-[#222630] text-[#8A92A6] hover:text-[#00F0FF] cursor-pointer'
                : 'text-[#3E4554] cursor-not-allowed'
            }`}
          >
            <Redo2 size={13} />
          </button>

          <div className="h-4 w-[1px] bg-[#222630] mx-0.5" />

          {/* 2. Magnetic Snapping Toggle */}
          <button
            onClick={toggleSnapping}
            className={`w-7 h-7 flex items-center justify-center rounded-md transition-all cursor-pointer border ${
              isSnappingEnabled
                ? 'bg-[#00F0FF]/15 text-[#00F0FF] border-[#00F0FF]/50 shadow-[0_0_8px_rgba(0,240,255,0.25)]'
                : 'bg-[#181B22] text-[#64748B] border-[#222630] hover:text-[#F0F3F8]'
            }`}
            title={`Magnetic Snapping: ${isSnappingEnabled ? 'ON' : 'OFF'} (S)`}
          >
            <Magnet size={13} />
          </button>

          {/* 3. Multi-Track Ripple Mode Toggle */}
          <button
            onClick={toggleRippleMode}
            className={`w-7 h-7 flex items-center justify-center rounded-md transition-all cursor-pointer border ${
              isRippleMode
                ? 'bg-[#A855F7]/20 text-[#A855F7] border-[#A855F7]/50 shadow-[0_0_8px_rgba(168,85,247,0.3)]'
                : 'bg-[#181B22] text-[#64748B] border-[#222630] hover:text-[#F0F3F8]'
            }`}
            title={`Ripple Mode: ${isRippleMode ? 'ON' : 'OFF'} (B) - Trims & gap deletions ripple downstream clips`}
          >
            <Sliders size={13} />
          </button>

          <div className="h-4 w-[1px] bg-[#222630] mx-0.5" />

          {/* 4. Split Clip */}
          <button
            onClick={() => splitClipAtPlayhead()}
            title={
              selectedClipIds.length > 1
                ? `Split ${selectedClipIds.length} Selected Clips at Playhead (C)`
                : 'Split at Playhead (C)'
            }
            className="w-7 h-7 flex items-center justify-center rounded-md bg-[#1C202B] hover:bg-[#252B3A] text-[#8A92A6] hover:text-[#00F0FF] transition-colors border border-[#222630] cursor-pointer"
          >
            <Scissors size={13} />
          </button>

          {/* 5. Edge Drag Mode Switcher */}
          <div className="flex items-center bg-[#101217] p-0.5 rounded-md border border-[#222630]">
            <button
              onClick={() => setEdgeDragMode('trim')}
              className={`w-6 h-6 flex items-center justify-center rounded transition-all cursor-pointer ${
                edgeDragMode === 'trim'
                  ? 'bg-[#00F0FF] text-[#0D0E11] font-bold shadow-[0_0_8px_rgba(0,240,255,0.4)]'
                  : 'text-[#8A92A6] hover:text-[#F0F3F8]'
              }`}
              title="Trim / Recover Mode (T): Drag clip edges to trim or recover hidden video (Hold Alt for Slow-Mo)"
            >
              <Scissors size={12} className={edgeDragMode === 'trim' ? 'text-[#0D0E11]' : 'text-[#00F0FF]'} />
            </button>
            <button
              onClick={() => setEdgeDragMode('stretch')}
              className={`w-6 h-6 flex items-center justify-center rounded transition-all cursor-pointer ${
                edgeDragMode === 'stretch'
                  ? 'bg-[#F59E0B] text-[#0D0E11] font-bold shadow-[0_0_8px_rgba(245,158,11,0.4)]'
                  : 'text-[#8A92A6] hover:text-[#F0F3F8]'
              }`}
              title="Slow-Mo Stretch Mode (R): Drag clip edges outward to slow down, or inward to speed up"
            >
              <Gauge size={12} className={edgeDragMode === 'stretch' ? 'text-[#0D0E11]' : 'text-[#F59E0B]'} />
            </button>
          </div>

          <div className="h-4 w-[1px] bg-[#222630] mx-0.5" />

          {/* 6. Delete */}
          <button
            onClick={() => {
              if (selectedClipId || selectedClipIds.length > 0) deleteSelectedClips();
            }}
            disabled={!selectedClipId && selectedClipIds.length === 0}
            title={
              selectedClipIds.length > 1
                ? `Delete ${selectedClipIds.length} Selected Clips (Del)`
                : 'Delete Selected Clip (Del)'
            }
            className={`w-7 h-7 flex items-center justify-center rounded-md transition-colors ${
              selectedClipId || selectedClipIds.length > 0
                ? 'hover:bg-red-500/20 text-[#8A92A6] hover:text-red-400 cursor-pointer'
                : 'text-[#3E4554] cursor-not-allowed'
            }`}
          >
            <Trash2 size={13} />
          </button>

          {/* 7. Ripple Delete */}
          <button
            onClick={() => {
              if (selectedClipId) rippleDeleteClip(selectedClipId);
            }}
            disabled={!selectedClipId}
            title="Ripple Delete (Shift+Del): Delete clip and close timeline gap"
            className={`w-7 h-7 flex items-center justify-center rounded-md transition-colors border ${
              selectedClipId
                ? 'bg-[#1C202B] hover:bg-amber-500/20 text-amber-400 border-amber-500/30 cursor-pointer shadow-[0_0_6px_rgba(245,158,11,0.2)]'
                : 'text-[#3E4554] border-transparent cursor-not-allowed'
            }`}
          >
            <div className="relative flex items-center justify-center">
              <Trash2 size={13} className={selectedClipId ? 'text-amber-400' : 'text-[#3E4554]'} />
              <span className="absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-amber-400" />
            </div>
          </button>

          <div className="h-4 w-[1px] bg-[#222630] mx-0.5" />

          {/* 8. Auto-Cut Silence Button */}
          <button
            onClick={() => setSilenceModalOpen(true)}
            className="w-7 h-7 flex items-center justify-center rounded-md bg-[#1C202B] hover:bg-[#252B3A] text-amber-400 hover:text-amber-300 transition-colors border border-[#222630] cursor-pointer"
            title="Auto-Cut Silence: Detect and ripple-delete quiet intervals"
          >
            <VolumeX size={13} className="text-amber-400" />
          </button>

          <div className="h-4 w-[1px] bg-[#222630] mx-0.5" />

          {/* 9. Dynamic Track Adders */}
          <button
            onClick={() => addTrack('video')}
            className="h-7 px-2 flex items-center gap-1 rounded-md bg-[#1A1D24] hover:bg-[#222630] border border-[#222630] text-[#8A92A6] hover:text-[#00F0FF] transition-colors cursor-pointer"
            title="Add Video Track"
          >
            <Plus size={10} strokeWidth={3} className="text-[#00F0FF]" />
            <Video size={13} className="text-[#00F0FF]" />
          </button>

          <button
            onClick={() => addTrack('audio')}
            className="h-7 px-2 flex items-center gap-1 rounded-md bg-[#1A1D24] hover:bg-[#222630] border border-[#222630] text-[#8A92A6] hover:text-[#F59E0B] transition-colors cursor-pointer"
            title="Add Audio Track"
          >
            <Plus size={10} strokeWidth={3} className="text-[#F59E0B]" />
            <Mic size={13} className="text-[#F59E0B]" />
          </button>

          <button
            onClick={() => addTextClip()}
            className="h-7 px-2 flex items-center gap-1 rounded-md bg-[#1A1D24] hover:bg-[#222630] border border-[#222630] text-[#8A92A6] hover:text-[#A855F7] transition-colors cursor-pointer"
            title="Add Title / Text Overlay Track (T)"
          >
            <Plus size={10} strokeWidth={3} className="text-[#A855F7]" />
            <Type size={13} className="text-[#A855F7]" />
          </button>

          <button
            onClick={() => setIsAutoCaptionModalOpen(true)}
            className="h-7 px-2.5 flex items-center gap-1.5 rounded-md bg-[#1C202B] hover:bg-[#A855F7]/20 border border-[#222630] hover:border-[#A855F7]/50 text-[#A855F7] text-xs font-semibold transition-all cursor-pointer shadow-xs"
            title="Auto Captions: Generate local Whisper AI speech-to-text subtitles"
          >
            <Subtitles size={13} />
            <span className="hidden sm:inline text-[11px] font-bold">Captions</span>
          </button>

          <button
            onClick={(e) => {
              (e.currentTarget as HTMLElement)?.blur();
              if (isRecordingVoiceover) {
                stopVoiceoverRecording();
              } else {
                startVoiceoverRecording();
              }
            }}
            className={`w-7 h-7 flex items-center justify-center rounded-md border transition-all cursor-pointer relative group ${
              isRecordingVoiceover
                ? 'bg-red-500/25 border-red-500 text-red-400 animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.4)]'
                : 'bg-[#1C202B] hover:bg-red-500/20 border-[#222630] hover:border-red-500/50 text-[#8A92A6] hover:text-red-400'
            }`}
            title={isRecordingVoiceover ? 'Stop Recording' : 'Record'}
          >
            <Mic size={13} className={isRecordingVoiceover ? 'text-red-400 animate-bounce' : ''} />
            <span className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-[#14161B] border border-[#222630] text-[10px] font-bold text-white px-2 py-0.5 rounded shadow-lg whitespace-nowrap z-50">
              {isRecordingVoiceover ? 'Stop Recording' : 'Record'}
            </span>
          </button>
        </div>

        {/* Right Section: Sync Actions (before zoom slider), Zoom controls & FPS */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Sync Buttons */}
          <button
            onClick={handleSyncAll}
            className="h-7 px-2.5 flex items-center gap-1.5 rounded-md bg-gradient-to-r from-[#00F0FF] to-[#10B981] hover:brightness-110 text-[#0D0E11] text-xs font-bold transition-all shadow-[0_0_8px_rgba(0,240,255,0.3)] cursor-pointer"
            title={`Sync All Tracks (${syncedCount}/${allClips.length}) - Analyze clip filenames and synchronize tracks`}
          >
            <Zap size={13} fill="currentColor" />
            <span className="font-mono text-[11px] leading-none">
              {syncedCount}/{allClips.length}
            </span>
          </button>

          {/* Sync Settings / Placement Strategy */}
          <button
            onClick={() => setSyncModalOpen(true)}
            className="w-7 h-7 flex items-center justify-center rounded-md bg-[#1C202B] hover:bg-[#252B3A] border border-[#222630] hover:border-[#00F0FF]/50 text-[#8A92A6] hover:text-[#00F0FF] transition-all cursor-pointer"
            title={`Sync Placement Settings: ${
              syncPlacementMode === 'compact'
                ? `Snapped (${syncGapCushionSec}s cushion)`
                : syncPlacementMode === 'capped'
                ? 'Capped Gap'
                : 'Real Time Wall-Clock'
            } (Click to open settings)`}
          >
            <Sliders size={13} className="text-[#00F0FF]" />
          </button>

          <div className="h-4 w-[1px] bg-[#222630] mx-0.5" />

          {/* Zoom controls */}
          <div className="flex items-center gap-1.5 bg-[#0D0E11] px-2 py-1 rounded-md border border-[#222630] h-7">
            <button
              onClick={handleZoomToFit}
              className="flex items-center gap-1 px-1 py-0.5 rounded text-[10px] font-mono text-[#8A92A6] hover:text-[#00F0FF] hover:bg-[#1A1D24] transition-colors cursor-pointer"
              title="Zoom to Fit All Media in Timeline"
            >
              <Maximize2 size={11} />
              <span>Fit</span>
            </button>
            <button
              onClick={() => applyAnchoredZoom(Math.max(zoom / 1.25, 0.05))}
              className="text-[#8A92A6] hover:text-[#00F0FF] transition-colors cursor-pointer"
              title="Zoom Out (Ctrl+Scroll Down)"
            >
              <ZoomOut size={13} />
            </button>
            <input
              type="range"
              min={0.1}
              max={300}
              step={0.1}
              value={zoom}
              onChange={(e) => applyAnchoredZoom(Number(e.target.value))}
              className="w-16 h-1 bg-[#222630] rounded-lg appearance-none cursor-pointer accent-[#00F0FF]"
              title={`Zoom: ${zoom.toFixed(1)} px/sec`}
            />
            <button
              onClick={() => applyAnchoredZoom(Math.min(zoom * 1.25, 400))}
              className="text-[#8A92A6] hover:text-[#00F0FF] transition-colors cursor-pointer"
              title="Zoom In (Ctrl+Scroll Up)"
            >
              <ZoomIn size={13} />
            </button>
          </div>

          <MasterPeakMeter />

          <span
            className="text-[10px] font-mono text-[#64748B] px-1.5 py-1 rounded-md bg-[#0D0E11] border border-[#222630] h-7 flex items-center"
            title="Project Framerate"
          >
            {project.fps} FPS
          </span>
        </div>
      </div>

      {/* MAIN TIMELINE WORKSPACE */}
      <div data-timeline-container="true" className="flex flex-1 overflow-hidden relative">
        {/* LEFT COLUMN: Dynamic Track Headers */}
        <div className="w-56 shrink-0 bg-[#14161B] border-r border-[#222630] flex flex-col z-10 shadow-lg">
          {/* Header row corresponding to Timecode Ruler */}
          <div className="h-7 bg-[#14161B] border-b border-[#222630] flex items-center justify-between px-3 text-[10px] font-bold uppercase tracking-wider text-[#64748B]">
            <span>Tracks ({tracks.length})</span>
            <span className="text-[9px] font-mono lowercase text-[#525D73]">drag assets here</span>
          </div>

          {/* Dynamic Track Header Items */}
          <div ref={trackHeadersScrollRef} onScroll={handleLeftScroll} className="flex-1 overflow-y-auto no-scrollbar">
            {tracks.map((track) => {
              const isVideo = track.trackType === 'video' || track.type === 'video';
              const isText = track.trackType === 'text' || track.type === 'text';
              const defaultHeight = isVideo ? 80 : isText ? 64 : 64;
              const trackHeight = trackHeights[track.id] ?? defaultHeight;

              const isHeaderHoveredByPointer = Boolean(
                activeDragAsset &&
                  document
                    .elementFromPoint(activeDragAsset.mouseX, activeDragAsset.mouseY)
                    ?.closest(`[data-track-header-id="${track.id}"]`)
              );

              return (
                <DynamicTrackHeader
                  key={track.id}
                  track={track}
                  trackHeight={trackHeight}
                  onStartResize={(e) => handleStartTrackResize(track.id, e, trackHeight)}
                  onResetHeight={() => resetTrackHeight(track.id)}
                  isDragOver={dragOverTrackId === track.id || isHeaderHoveredByPointer}
                  onDragOver={(e) => handleLaneDragOver(e, track.id)}
                  onDragLeave={(e) => handleLaneDragLeave(e, track.id)}
                  onDrop={(e) => handleHeaderDrop(e, track.id)}
                  onToggleVisibility={() => toggleTrackVisibility(track.id)}
                  onToggleMute={() => toggleMute(track.id)}
                  onToggleSolo={() => toggleSolo(track.id)}
                  onToggleLock={() => toggleLock(track.id)}
                  onDeleteTrack={() => removeTrack(track.id)}
                />
              );
            })}
          </div>
        </div>

        {/* RIGHT COLUMN: Timecode Ruler + Track Lanes + Laser Playhead */}
        <div
          ref={scrollContainerRef}
          onScroll={handleRightScroll}
          data-timeline-scroll="true"
          className="flex-1 flex flex-col overflow-x-auto overflow-y-auto relative bg-[#0D0E11]"
        >
          {/* Frame-Accurate Timecode Ruler */}
          <div
            onMouseDown={handleRulerMouseDown}
            style={{ width: `${totalRulerSeconds * zoom}px` }}
            className="h-7 bg-[#14161B] border-b border-[#222630] relative cursor-pointer select-none shrink-0"
          >
            {rulerTicks.map((sec) => (
              <div
                key={sec}
                style={{ left: `${sec * zoom}px` }}
                className="absolute top-0 bottom-0 border-l border-[#222630] flex flex-col justify-end pb-1 pl-1"
              >
                <span className="timecode-display text-[9px] font-mono text-[#64748B] font-medium leading-none">
                  {formatTimecode(sec, project.fps)}
                </span>
                <div className="absolute bottom-0 left-0 w-[1px] h-2 bg-[#64748B]" />
              </div>
            ))}
          </div>

          {/* Track Lanes (Drop Targets for Media Pool Clips) */}
          <div
            ref={tracksContainerRef}
            data-timeline-container="true"
            style={{ width: `${totalRulerSeconds * zoom}px` }}
            className="flex-1 relative timeline-grid min-h-[160px]"
            onDragOver={(e) => handleLaneDragOver(e)}
            onDrop={handleTimelineContainerDrop}
            onMouseDown={(e) => {
              const target = e.target as HTMLElement;
              // If not clicking a clip, button, or input, initiate marquee selection / seek
              if (
                !target.closest('[data-clip-id]') &&
                !target.closest('button') &&
                !target.closest('input') &&
                e.button === 0
              ) {
                const container = tracksContainerRef.current;
                if (!container) return;
                const rect = container.getBoundingClientRect();
                const startX = Math.max(0, e.clientX - rect.left);
                const startY = Math.max(0, e.clientY - rect.top);

                marqueeRef.current = {
                  isDown: true,
                  startX,
                  startY,
                  isDragging: false,
                  initialSelectedIds: e.shiftKey ? [...selectedClipIds] : [],
                  isShift: e.shiftKey,
                };
              }
            }}
          >
            {/* Visual Neon Marquee Selection Box across Multiple Tracks */}
            {marqueeBox && (
              <div
                style={{
                  left: `${Math.min(marqueeBox.startX, marqueeBox.currentX)}px`,
                  top: `${Math.min(marqueeBox.startY, marqueeBox.currentY)}px`,
                  width: `${Math.abs(marqueeBox.currentX - marqueeBox.startX)}px`,
                  height: `${Math.abs(marqueeBox.currentY - marqueeBox.startY)}px`,
                }}
                className="absolute pointer-events-none z-50 border-2 border-[#00F0FF] bg-[#00F0FF]/15 rounded shadow-[0_0_16px_rgba(0,240,255,0.35)] backdrop-blur-[1px]"
              >
                {selectedClipIds.length > 0 && (
                  <div className="absolute top-1 right-1 px-1.5 py-0.5 rounded bg-black/85 border border-[#00F0FF]/50 text-[9px] font-mono font-bold text-[#00F0FF] shadow-md">
                    {selectedClipIds.length} {selectedClipIds.length === 1 ? 'clip' : 'clips'}
                  </div>
                )}
              </div>
            )}

            {tracks.map((track) => {
              const isLaneHoveredByPointer = Boolean(
                activeDragAsset &&
                  document
                    .elementFromPoint(activeDragAsset.mouseX, activeDragAsset.mouseY)
                    ?.closest(`[data-track-id="${track.id}"]`)
              );

              const scrollElem = scrollContainerRef.current;
              let externalDragDropSec: number | null = null;
              if (activeDragAsset && scrollElem) {
                const rect = scrollElem.getBoundingClientRect();
                const rawSec = Math.max(0, (activeDragAsset.mouseX - rect.left + scrollElem.scrollLeft) / zoom);
                externalDragDropSec = isSnappingEnabled
                  ? calculateSnappedPosition(rawSec, activeDragAsset.asset.durationSeconds || 10, 'new_clip', zoom)
                  : rawSec;
              }

              const isVideo = track.trackType === 'video' || track.type === 'video';
              const isText = track.trackType === 'text' || track.type === 'text';
              const defaultHeight = isVideo ? 80 : isText ? 64 : 64;
              const trackHeight = trackHeights[track.id] ?? defaultHeight;

              return (
                <DynamicTrackLane
                  key={track.id}
                  track={track}
                  trackHeight={trackHeight}
                  onStartResize={(e) => handleStartTrackResize(track.id, e, trackHeight)}
                  onResetHeight={() => resetTrackHeight(track.id)}
                  zoom={zoom}
                  selectedClipId={selectedClipId}
                  selectedClipIds={selectedClipIds}
                  draggingClipId={draggingClip?.id || null}
                  isDragOver={dragOverTrackId === track.id || isLaneHoveredByPointer}
                  isExternalDragging={Boolean(draggedAsset || activeDragAsset)}
                  ghostDropSec={isLaneHoveredByPointer ? externalDragDropSec : null}
                  ghostDurationSec={activeDragAsset?.asset.durationSeconds}
                  ghostAssetName={activeDragAsset?.asset.name}
                  transitions={transitions}
                  selectedTransitionId={selectedTransitionId}
                  setSelectedTransitionId={setSelectedTransitionId}
                  updateTransition={updateTransition}
                  removeTransition={removeTransition}
                  activeDragTransition={activeDragTransition}
                  onSelectClip={handleSelectClip}
                  onDragOver={(e) => handleLaneDragOver(e, track.id)}
                  onDragLeave={(e) => handleLaneDragLeave(e, track.id)}
                  onDrop={(e) => handleLaneDrop(e, track.id)}
                  onStartDragClip={(clipId, mouseX, mouseY, startSec, trackId, mediaType) => {
                    if (track.locked || track.isLocked) return;
                    pushHistory();

                    let activeIds = selectedClipIds;
                    if (!selectedClipIds.includes(clipId)) {
                      activeIds = [clipId];
                      handleSelectClip(clipId);
                    }

                    const clipPositions = new Map<string, number>();
                    allClips.forEach((c) => {
                      if (activeIds.includes(c.id)) {
                        clipPositions.set(c.id, c.startPositionSeconds || 0);
                      }
                    });

                    setDraggingClip({
                      id: clipId,
                      initialMouseX: mouseX,
                      initialMouseY: mouseY,
                      initialStartSec: startSec,
                      sourceTrackId: trackId,
                      currentTrackId: trackId,
                      mediaType,
                      selectedClipPositions: clipPositions,
                    });
                  }}
                  edgeDragMode={edgeDragMode}
                  onStartTrimLeft={(clipId, mouseX, isAlt = false) => {
                    if (track.locked || track.isLocked) return;
                    const c = track.clips.find((item) => item.id === clipId);
                    if (!c) return;
                    pushHistory();
                    const s = c.startPositionSeconds ?? (c.startTimeMs / 1000);
                    const inPt = c.inPointSeconds ?? (c.sourceOffsetMs ? c.sourceOffsetMs / 1000 : 0);
                    const dur = c.durationSeconds ?? (c.durationMs / 1000);
                    const outPt = c.outPointSeconds ?? (inPt + dur);
                    const spd = c.speedProfile?.speedMultiplier ?? 1.0;
                    const mode = isAlt ? (edgeDragMode === 'stretch' ? 'trim' : 'stretch') : edgeDragMode;
                    const sourceSpan = outPt > inPt ? outPt - inPt : dur * spd;
                    setTrimmingClip({
                      id: clipId,
                      side: 'left',
                      mode,
                      initialMouseX: mouseX,
                      initialStartSec: s,
                      initialInSec: inPt,
                      initialOutSec: outPt,
                      initialDurSec: dur,
                      sourceSpan,
                      speed: spd,
                    });
                  }}
                  onStartTrimRight={(clipId, mouseX, isAlt = false) => {
                    if (track.locked || track.isLocked) return;
                    const c = track.clips.find((item) => item.id === clipId);
                    if (!c) return;
                    pushHistory();
                    const s = c.startPositionSeconds ?? (c.startTimeMs / 1000);
                    const inPt = c.inPointSeconds ?? (c.sourceOffsetMs ? c.sourceOffsetMs / 1000 : 0);
                    const dur = c.durationSeconds ?? (c.durationMs / 1000);
                    const outPt = c.outPointSeconds ?? (inPt + dur);
                    const spd = c.speedProfile?.speedMultiplier ?? 1.0;
                    const mode = isAlt ? (edgeDragMode === 'stretch' ? 'trim' : 'stretch') : edgeDragMode;
                    const sourceSpan = outPt > inPt ? outPt - inPt : dur * spd;
                    setTrimmingClip({
                      id: clipId,
                      side: 'right',
                      mode,
                      initialMouseX: mouseX,
                      initialStartSec: s,
                      initialInSec: inPt,
                      initialOutSec: outPt,
                      initialDurSec: dur,
                      sourceSpan,
                      speed: spd,
                    });
                  }}
                  fps={project.fps}
                  onContextMenu={setContextMenu}
                  onStartKeyframeDrag={handleStartKeyframeDrag}
                  onRemoveKeyframe={removeGlobalKeyframe}
                  onSeekToKeyframe={setPlayhead}
                  onTrackGapContextMenu={(e, trackId) => {
                    const scrollContainer = scrollContainerRef.current;
                    if (!scrollContainer) return;
                    const rect = scrollContainer.getBoundingClientRect();
                    const scrollLeft = scrollContainer.scrollLeft;
                    const clickX = e.clientX - rect.left + scrollLeft;
                    const timeSec = Math.max(0, clickX / zoom);
                    setGapContextMenu({
                      x: e.clientX,
                      y: e.clientY,
                      trackId,
                      timeSec,
                    });
                  }}
                />
              );
            })}

            {/* Draggable Laser Playhead Needle & Handle */}
            <TimelinePlayhead
              zoom={zoom}
              isScrubbing={isScrubbing}
              onScrubStart={(e) => {
                e.stopPropagation();
                setIsScrubbing(true);
                handleRulerScrub(e);
              }}
            />
          </div>
        </div>
      </div>

      {/* Floating Clip Context Menu (Right Click) */}
      {contextMenu && (
        <div
          style={{
            left: `${Math.min(window.innerWidth - 220, Math.max(10, contextMenu.x))}px`,
            top: `${Math.min(window.innerHeight - 200, Math.max(10, contextMenu.y))}px`,
          }}
          className="fixed z-[99999] min-w-[210px] bg-[#14161B]/95 border border-[#2B3040] rounded-lg shadow-2xl py-1.5 text-xs text-[#F0F3F8] font-medium backdrop-blur-md animate-in fade-in select-none ring-1 ring-white/10"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-3 py-1 text-[10px] font-mono text-[#64748B] border-b border-[#222630] truncate">
            {contextMenu.clipName}
          </div>

          {contextMenu.isVideo && contextMenu.hasAttachedAudio && (
            <button
              onClick={() => {
                extractAudioFromClip(contextMenu.clipId);
                setContextMenu(null);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-[#1C202B] text-[#00F0FF] hover:text-[#3bf1ff] transition-colors cursor-pointer text-left"
            >
              <Music size={13} className="text-[#00F0FF]" />
              <span>Extract Audio to New Track</span>
            </button>
          )}

          {contextMenu.isVideo && !contextMenu.hasAttachedAudio && (
            <div className="px-3 py-1.5 text-[10px] text-[#64748B] italic">
              Audio already extracted
            </div>
          )}

          <button
            onClick={() => {
              setIsNoiseModalOpen(true, contextMenu.clipId);
              setInspectorTab('audio');
              setContextMenu(null);
            }}
            className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-[#1C202B] text-[#00F0FF] hover:text-[#3bf1ff] transition-colors cursor-pointer text-left"
          >
            <Waves size={13} className="text-[#00F0FF]" />
            <span>Capture Room Tone Profile...</span>
          </button>

          <div className="h-[1px] bg-[#222630] my-1" />

          <button
            onClick={() => {
              splitClipAtPlayhead(contextMenu.clipId);
              setContextMenu(null);
            }}
            className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[#1C202B] text-[#F0F3F8] transition-colors cursor-pointer text-left"
          >
            <div className="flex items-center gap-2.5">
              <Scissors size={13} className="text-[#8A92A6]" />
              <span>
                {selectedClipIds.length > 1 && selectedClipIds.includes(contextMenu.clipId)
                  ? `Split All ${selectedClipIds.length} Selected Clips at Playhead`
                  : 'Split at Playhead'}
              </span>
            </div>
            <span className="text-[10px] font-mono text-[#64748B]">C</span>
          </button>

          <button
            onClick={() => {
              duplicateClip(contextMenu.clipId);
              setContextMenu(null);
            }}
            className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-[#1C202B] text-[#F0F3F8] transition-colors cursor-pointer text-left"
          >
            <Plus size={13} className="text-[#8A92A6]" />
            <span>Duplicate Clip</span>
          </button>

          <button
            onClick={() => {
              rippleDeleteClip(contextMenu.clipId);
              setContextMenu(null);
            }}
            className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[#1C202B] text-amber-400 hover:text-amber-300 transition-colors cursor-pointer text-left"
          >
            <div className="flex items-center gap-2.5">
              <Trash2 size={13} className="text-amber-400" />
              <span>Ripple Delete</span>
            </div>
            <span className="text-[10px] font-mono text-[#64748B]">Shift+Del</span>
          </button>

          <button
            onClick={() => {
              deleteClip(contextMenu.clipId);
              setContextMenu(null);
            }}
            className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-colors cursor-pointer text-left"
          >
            <div className="flex items-center gap-2.5">
              <Trash2 size={13} className="text-red-400" />
              <span>Delete Clip</span>
            </div>
            <span className="text-[10px] font-mono text-[#64748B]">Del</span>
          </button>
        </div>
      )}

      {/* Floating Track Gap Context Menu (Right Click on Blank Space) */}
      {gapContextMenu && (
        <div
          style={{
            left: `${Math.min(window.innerWidth - 200, Math.max(10, gapContextMenu.x))}px`,
            top: `${Math.min(window.innerHeight - 150, Math.max(10, gapContextMenu.y))}px`,
          }}
          className="fixed z-[99999] min-w-[200px] bg-[#14161B]/95 border border-[#2B3040] rounded-lg shadow-2xl py-1.5 text-xs text-[#F0F3F8] font-medium backdrop-blur-md animate-in fade-in select-none ring-1 ring-white/10"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-3 py-1 text-[10px] font-mono text-[#64748B] border-b border-[#222630]">
            Track Gap @ {formatTimecode(gapContextMenu.timeSec, project.fps)}
          </div>
          <button
            onClick={() => {
              deleteGapAtTime(gapContextMenu.trackId, gapContextMenu.timeSec);
              setGapContextMenu(null);
            }}
            className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-amber-500/15 text-amber-400 hover:text-amber-300 transition-colors cursor-pointer text-left"
          >
            <Scissors size={13} />
            <span>Delete Gap (Ripple Pull)</span>
          </button>
          <button
            onClick={() => {
              addAdjustmentLayer(gapContextMenu.trackId, gapContextMenu.timeSec, 5);
              setGapContextMenu(null);
            }}
            className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-[#8B5CF6]/20 text-[#C4B5FD] hover:text-white transition-colors cursor-pointer text-left"
          >
            <Sparkles size={13} className="text-[#A78BFA]" />
            <span>New Adjustment Layer Here</span>
          </button>
        </div>
      )}

      {/* Real-time floating tooltip pill during trimming or slow-motion stretching */}
      {trimDragTooltip && (
        <div
          style={{ left: `${trimDragTooltip.x}px`, top: `${trimDragTooltip.y}px` }}
          className={`fixed pointer-events-none z-[999999] px-2.5 py-1 rounded shadow-xl text-xs font-mono font-bold border backdrop-blur-md flex items-center gap-1.5 transition-none ${
            trimDragTooltip.isSlowMo
              ? 'bg-[#F59E0B]/95 text-[#0D0E11] border-[#F59E0B] shadow-[0_0_14px_rgba(245,158,11,0.5)]'
              : 'bg-[#00F0FF]/95 text-[#0D0E11] border-[#00F0FF] shadow-[0_0_14px_rgba(0,240,255,0.5)]'
          }`}
        >
          {trimDragTooltip.isSlowMo ? <Gauge size={13} /> : <Scissors size={13} />}
          <span>{trimDragTooltip.text}</span>
        </div>
      )}
    </div>
  );
};

// DYNAMIC TRACK HEADER COMPONENT
interface DynamicTrackHeaderProps {
  track: MediaTrack;
  trackHeight: number;
  onStartResize?: (e: React.MouseEvent) => void;
  onResetHeight?: () => void;
  isDragOver?: boolean;
  onToggleVisibility: () => void;
  onToggleMute: () => void;
  onToggleSolo: () => void;
  onToggleLock: () => void;
  onDeleteTrack: () => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDragLeave?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
}

const DynamicTrackHeader: React.FC<DynamicTrackHeaderProps> = ({
  track,
  trackHeight,
  onStartResize,
  onResetHeight,
  isDragOver,
  onToggleVisibility,
  onToggleMute,
  onToggleSolo,
  onToggleLock,
  onDeleteTrack,
  onDragOver,
  onDragLeave,
  onDrop,
}) => {
  const isVideo = track.trackType === 'video' || track.type === 'video';
  const isText = track.trackType === 'text' || track.type === 'text';
  const isVisible = track.visible !== false && track.isVisible !== false;
  const isRecordingVoiceover = useTimelineStore((state) => state.isRecordingVoiceover);
  const voiceoverTargetTrackId = useTimelineStore((state) => state.voiceoverTargetTrackId);
  const startVoiceoverRecording = useTimelineStore((state) => state.startVoiceoverRecording);
  const stopVoiceoverRecording = useTimelineStore((state) => state.stopVoiceoverRecording);
  const setInspectorTab = useTimelineStore((state) => state.setInspectorTab);
  const selectedGradingScope = useTimelineStore((state) => state.selectedGradingScope);
  const activeGradingTrackId = useTimelineStore((state) => state.activeGradingTrackId);
  const isGradingSelected = isVideo && selectedGradingScope === 'track' && activeGradingTrackId === track.id;
  const isMuted = track.muted || track.isMuted;
  const isSolo = track.solo || track.isSolo;
  const isLocked = track.locked || track.isLocked;
  const color = track.color || (isText ? '#A855F7' : isVideo ? '#00F0FF' : '#F59E0B');
  const offsetSec = track.timeOffsetSeconds ?? 0;

  return (
    <div
      data-track-header-id={track.id}
      style={{ height: `${trackHeight}px` }}
      onClick={() => {
        if (!isVideo && !isText) {
          setInspectorTab('audio');
        } else if (isVideo) {
          useTimelineStore.getState().setSelectedGradingScope('track', track.id);
        }
      }}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={`border-b border-[#222630] px-3 py-1.5 flex flex-col justify-between bg-[#14161B] transition-colors relative group cursor-pointer ${
        isGradingSelected
          ? 'ring-2 ring-[#8B5CF6] border-l-4 border-l-[#8B5CF6] bg-[#8B5CF6]/15'
          : isDragOver
          ? 'bg-[#00F0FF]/15 border-l-4 border-l-[#00F0FF]'
          : 'hover:bg-[#181B22]'
      }`}
    >
      {/* Track Color Left Accent Tab */}
      <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: color }} />

      {/* Top Row: Track Name & Offset Badge */}
      <div className="flex items-center justify-between pl-1">
        <div className="flex items-center gap-1.5 truncate">
          {isText ? (
            <Type size={13} style={{ color }} />
          ) : isVideo ? (
            <Video size={13} style={{ color }} />
          ) : (
            <Mic size={13} style={{ color }} />
          )}
          <span className="text-xs font-semibold text-[#F0F3F8] truncate" title={track.name}>
            {track.name}
          </span>
          {track.trackGrading && (
            <span
              className="px-1 py-0.2 rounded text-[8px] font-mono font-bold bg-[#8B5CF6]/30 text-[#DDD6FE] border border-[#8B5CF6]/50"
              title="Track-level color grade active"
            >
              GRADE
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {offsetSec !== 0 && (
            <span
              className="text-[9px] font-mono px-1 rounded bg-[#0D0E11] border border-[#222630] text-[#10B981]"
              title={`Relative Timeline Offset: ${formatDeltaSeconds(offsetSec)}`}
            >
              {formatDeltaSeconds(offsetSec)}
            </span>
          )}

          {/* Delete Track button */}
          <button
            onClick={onDeleteTrack}
            className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-red-400 text-[#64748B] transition-opacity"
            title="Delete Track"
          >
            <Trash2 size={11} />
          </button>
        </div>
      </div>

      {/* Controls Row: Visibility, Mute, Solo, Lock Controls */}
      <div className="flex items-center justify-between pl-1">
        <div className="flex items-center gap-1">
          {/* Eye / Visibility button for Video & Text */}
          {(isVideo || isText) && (
            <button
              onClick={onToggleVisibility}
              title={isVisible ? 'Hide Track' : 'Show Track'}
              className={`w-5 h-5 rounded text-[10px] flex items-center justify-center transition-colors ${
                isVisible
                  ? isText
                    ? 'bg-[#222630] text-[#A855F7]'
                    : 'bg-[#222630] text-[#00F0FF]'
                  : 'bg-zinc-800 text-[#525D73]'
              }`}
            >
              {isVisible ? <Eye size={11} /> : <EyeOff size={11} />}
            </button>
          )}

          {/* Mute button */}
          <button
            onClick={onToggleMute}
            title={isMuted ? 'Unmute Track' : 'Mute Track'}
            className={`w-5 h-5 rounded text-[10px] font-bold flex items-center justify-center transition-colors ${
              isMuted
                ? 'bg-red-500/20 text-red-400 border border-red-500/40'
                : 'bg-[#222630] text-[#8A92A6] hover:text-[#F0F3F8]'
            }`}
          >
            {isMuted ? <VolumeX size={10} /> : 'M'}
          </button>

          {/* Solo button */}
          <button
            onClick={onToggleSolo}
            title={isSolo ? 'Unsolo Track' : 'Solo Track'}
            className={`w-5 h-5 rounded text-[10px] font-bold flex items-center justify-center transition-colors ${
              isSolo
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                : 'bg-[#222630] text-[#8A92A6] hover:text-[#F0F3F8]'
            }`}
          >
            S
          </button>

          {/* Lock button */}
          <button
            onClick={onToggleLock}
            title={isLocked ? 'Unlock Track' : 'Lock Track'}
            className={`w-5 h-5 rounded text-[10px] flex items-center justify-center transition-colors ${
              isLocked
                ? 'bg-red-500/20 text-red-400 border border-red-500/40'
                : 'bg-[#222630] text-[#8A92A6] hover:text-[#F0F3F8]'
            }`}
          >
            {isLocked ? <Lock size={10} /> : <Unlock size={10} />}
          </button>

          {/* Quick Direct Record button for Audio Tracks */}
          {!isVideo && !isText && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                (e.currentTarget as HTMLElement)?.blur();
                if (isRecordingVoiceover && voiceoverTargetTrackId === track.id) {
                  stopVoiceoverRecording();
                } else {
                  startVoiceoverRecording(track.id);
                }
              }}
              title={
                isRecordingVoiceover && voiceoverTargetTrackId === track.id
                  ? 'Stop Recording'
                  : 'Record directly to this track'
              }
              className={`w-5 h-5 rounded text-[10px] flex items-center justify-center transition-colors cursor-pointer ${
                isRecordingVoiceover && voiceoverTargetTrackId === track.id
                  ? 'bg-red-500 text-white animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.6)]'
                  : 'bg-[#222630] text-[#8A92A6] hover:text-red-400 hover:bg-red-500/20'
              }`}
            >
              <Mic size={10} />
            </button>
          )}
        </div>

        <span className="text-[10px] font-mono text-[#525D73]">
          {(track.clips || []).length} clip{(track.clips || []).length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Sub-track indicator for video tracks */}
      {isVideo && trackHeight >= 64 && (
        <div className="flex items-center justify-between pl-1 text-[9px] font-mono text-[#64748B] pt-0.5 border-t border-[#1F232D]">
          <div className="flex items-center gap-1">
            <Volume2 size={9} className="text-[#00F0FF]/70" />
            <span>Audio Subtrack</span>
          </div>
          <span className="text-[8px] text-[#525D73]">Linked</span>
        </div>
      )}

      {/* Bottom Track Resizer Handle */}
      <div
        onMouseDown={(e) => onStartResize?.(e)}
        onDoubleClick={(e) => {
          e.stopPropagation();
          onResetHeight?.();
        }}
        className="absolute bottom-0 left-0 right-0 h-1.5 cursor-row-resize z-40 group/resizer hover:bg-[#00F0FF]/60 active:bg-[#00F0FF] flex items-center justify-center transition-colors"
        title="Hold and drag to resize track height (Double-click to reset)"
      >
        <div className="w-8 h-[2px] bg-transparent group-hover/resizer:bg-[#00F0FF] rounded-full transition-colors" />
      </div>
    </div>
  );
};

// DYNAMIC TRACK LANE COMPONENT
interface DynamicTrackLaneProps {
  track: MediaTrack;
  trackHeight: number;
  onStartResize?: (e: React.MouseEvent) => void;
  onResetHeight?: () => void;
  zoom: number;
  selectedClipId: string | null;
  selectedClipIds?: string[];
  draggingClipId: string | null;
  isDragOver?: boolean;
  isExternalDragging?: boolean;
  ghostDropSec?: number | null;
  ghostDurationSec?: number;
  ghostAssetName?: string;
  transitions?: Transition[];
  selectedTransitionId?: string | null;
  setSelectedTransitionId?: (id: string | null) => void;
  updateTransition?: (id: string, updates: Partial<Transition>) => void;
  removeTransition?: (id: string) => void;
  activeDragTransition?: { transitionType: string; label: string; mouseX: number; mouseY: number } | null;
  onSelectClip: (id: string, isMulti?: boolean) => void;
  onStartDragClip: (
    id: string,
    clientX: number,
    clientY: number,
    startSec: number,
    trackId: string,
    mediaType?: string
  ) => void;
  edgeDragMode?: 'trim' | 'stretch';
  onStartTrimLeft: (id: string, clientX: number, isAlt?: boolean) => void;
  onStartTrimRight: (id: string, clientX: number, isAlt?: boolean) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onContextMenu: (info: {
    x: number;
    y: number;
    clipId: string;
    trackId: string;
    clipName: string;
    isVideo: boolean;
    hasAttachedAudio: boolean;
  }) => void;
  onTrackGapContextMenu?: (e: React.MouseEvent, trackId: string) => void;
  onStartKeyframeDrag?: (
    clipId: string,
    time: number,
    mouseX: number,
    clipDurationSec: number
  ) => void;
  onRemoveKeyframe?: (clipId: string, time: number) => void;
  onSeekToKeyframe?: (time: number) => void;
  fps?: number;
}

const DynamicTrackLane: React.FC<DynamicTrackLaneProps> = ({
  track,
  trackHeight,
  onStartResize,
  onResetHeight,
  zoom,
  selectedClipId,
  selectedClipIds = [],
  draggingClipId,
  isDragOver,
  isExternalDragging = false,
  ghostDropSec,
  ghostDurationSec,
  ghostAssetName,
  transitions = [],
  selectedTransitionId = null,
  setSelectedTransitionId,
  updateTransition,
  removeTransition,
  activeDragTransition = null,
  edgeDragMode = 'trim',
  onSelectClip,
  onStartDragClip,
  onStartTrimLeft,
  onStartTrimRight,
  onDragOver,
  onDragLeave,
  onDrop,
  onContextMenu,
  onTrackGapContextMenu,
  onStartKeyframeDrag,
  onRemoveKeyframe,
  onSeekToKeyframe,
  fps = 30,
}) => {
  const isVideo = track.trackType === 'video' || track.type === 'video';
  const isText = track.trackType === 'text' || track.type === 'text';
  const color = track.color || (isText ? '#A855F7' : isVideo ? '#00F0FF' : '#F59E0B');

  const isRecordingVoiceover = useTimelineStore((state) => state.isRecordingVoiceover);
  const voiceoverRecordingStartSec = useTimelineStore((state) => state.voiceoverRecordingStartSec);
  const voiceoverTargetTrackId = useTimelineStore((state) => state.voiceoverTargetTrackId);
  const playhead = useTimelineStore((state) => state.playhead);
  const liveRecordingPeaks = useTimelineStore((state) => state.liveRecordingPeaks);
  const setInspectorTab = useTimelineStore((state) => state.setInspectorTab);

  return (
    <div
      data-track-id={track.id}
      data-track-type={track.trackType || track.type}
      style={{ height: `${trackHeight}px` }}
      onClick={(e) => {
        const target = e.target as HTMLElement;
        if (!target.closest('[data-clip-id]')) {
          if (!isVideo && !isText) {
            setInspectorTab('audio');
          }
        }
      }}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onContextMenu={(e) => {
        const target = e.target as HTMLElement;
        if (!target.closest('[data-clip-id]')) {
          e.preventDefault();
          e.stopPropagation();
          onTrackGapContextMenu?.(e, track.id);
        }
      }}
      className={`border-b border-[#222630] relative transition-colors ${
        isDragOver
          ? 'bg-[#00F0FF]/10 ring-1 ring-[#00F0FF]/50 border-[#00F0FF]/40'
          : track.locked
          ? 'bg-[#0E0F14]/80'
          : 'hover:bg-[#12141A]/50'
      }`}
    >
      {/* Live Ghost Clip Drop Target Indicator */}
      {ghostDropSec !== null && ghostDropSec !== undefined && (
        <div
          style={{
            left: `${ghostDropSec * zoom}px`,
            width: `${Math.max(28, (ghostDurationSec || 10) * zoom)}px`,
          }}
          className="absolute top-1 bottom-1 rounded border-2 border-dashed border-[#00F0FF] bg-[#00F0FF]/25 shadow-[0_0_16px_rgba(0,240,255,0.4)] pointer-events-none z-40 flex items-center px-2 animate-pulse overflow-hidden backdrop-blur-xs select-none"
        >
          <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold text-white drop-shadow truncate">
            <span className="w-2 h-2 rounded-full bg-[#00F0FF] shadow-[0_0_6px_#00F0FF] shrink-0" />
            <span className="truncate">{ghostAssetName || 'New Clip'}</span>
            <span className="text-[#00F0FF] shrink-0">({formatTimecode(ghostDropSec, fps)})</span>
          </div>
        </div>
      )}

      {/* Live Voiceover Recording Block Overlay with Real-Time Audio Waveform */}
      {isRecordingVoiceover && voiceoverTargetTrackId === track.id && (
        <div
          style={{
            left: `${voiceoverRecordingStartSec * zoom}px`,
            width: `${Math.max(28, (Math.max(playhead, voiceoverRecordingStartSec + 0.05) - voiceoverRecordingStartSec) * zoom)}px`,
          }}
          className="absolute top-1 bottom-1 z-30 select-none pointer-events-none"
        >
          <LiveRecordingWaveform
            peaks={liveRecordingPeaks}
            widthPx={Math.max(28, (Math.max(playhead, voiceoverRecordingStartSec + 0.05) - voiceoverRecordingStartSec) * zoom)}
            heightPx={isVideo ? Math.max(30, trackHeight - 20) : Math.max(24, trackHeight - 16)}
            durationSec={Math.max(0, playhead - voiceoverRecordingStartSec)}
            fps={fps}
          />
        </div>
      )}

      {track.clips.map((clip) => {
        const isSelected = selectedClipIds && selectedClipIds.length > 0
          ? selectedClipIds.includes(clip.id)
          : selectedClipId === clip.id;
        const isDragging = draggingClipId === clip.id;
        const startSec = clip.startPositionSeconds || 0;
        const durSec = clip.durationSeconds || 10;
        const widthPx = durSec * zoom;
        const leftPx = startSec * zoom;
        const hasAttachedAudio = isVideo && !clip.audioExtracted && clip.hasAudio !== false;
        const isAdjustment = Boolean(
          clip.isAdjustmentLayer ||
          clip.mediaType === 'adjustment' ||
          clip.filePath === 'adjustment_layer' ||
          (clip.name && clip.name.toLowerCase().includes('adjustment layer'))
        );

        return (
          <div
            key={clip.id}
            data-clip-id={clip.id}
            onClick={(e) => {
              e.stopPropagation();
              onSelectClip(clip.id, e.shiftKey);
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onSelectClip(clip.id, e.shiftKey);
              onContextMenu({
                x: e.clientX,
                y: e.clientY,
                clipId: clip.id,
                trackId: track.id,
                clipName: clip.name,
                isVideo,
                hasAttachedAudio,
              });
            }}
            onMouseDown={(e) => {
              e.stopPropagation();
              if (e.button === 0) {
                if (e.shiftKey || !(selectedClipIds && selectedClipIds.includes(clip.id))) {
                  onSelectClip(clip.id, e.shiftKey);
                }
                onStartDragClip(
                  clip.id,
                  e.clientX,
                  e.clientY,
                  startSec,
                  track.id,
                  clip.mediaType || track.trackType || track.type
                );
              }
            }}
            title={`Clip: ${clip.name}\nPath: ${clip.filePath}\nStart: ${formatTimecode(startSec, fps)}\nDuration: ${durSec.toFixed(2)}s\nOffset: ${clip.syncDeltaSeconds !== undefined ? `+${clip.syncDeltaSeconds.toFixed(2)}s` : '0.00s'}`}
            style={{
              left: `${leftPx}px`,
              width: `${Math.max(widthPx, 24)}px`,
            }}
            className={`absolute top-1 bottom-1 rounded cursor-grab active:cursor-grabbing select-none border shadow-md group transition-[border-color,box-shadow,opacity] duration-150 ${
              isExternalDragging ? 'pointer-events-none' : ''
            } ${
              isDragging
                ? 'ring-2 ring-[#00F0FF] border-white z-30 shadow-[0_0_16px_rgba(0,240,255,0.6)] opacity-95'
                : isSelected
                ? isAdjustment
                  ? 'border-white ring-2 ring-[#8B5CF6] z-20 shadow-[0_0_12px_rgba(139,92,246,0.5)]'
                  : 'border-white ring-2 ring-[#00F0FF] z-20 shadow-[0_0_12px_rgba(0,240,255,0.4)]'
                : isAdjustment
                ? 'border-[#8B5CF6]/50 hover:border-[#8B5CF6] z-10'
                : 'border-[#222630] hover:border-[#00F0FF]/80 z-10'
            }`}
          >
            {/* Inner Clip Graphic Container */}
            <div className="absolute inset-0 rounded overflow-hidden">
              {isAdjustment ? (
                /* Dedicated Adjustment Layer / LUT Grade FX Clip */
                <div className="relative h-full w-full bg-gradient-to-r from-[#2E1065] via-[#3B0764] to-[#1E1B4B] overflow-hidden select-none border border-[#8B5CF6]/50 shadow-inner">
                  {/* Top Color Accent Line */}
                  <div className="absolute top-0 left-0 right-0 h-1 z-10 bg-[#8B5CF6]" />

                  {/* Header Info */}
                  <div className="absolute top-1.5 left-2 right-2 flex items-center justify-between text-[10px] font-semibold text-white drop-shadow-md truncate pointer-events-none z-10">
                    <div className="flex items-center gap-1.5 truncate">
                      <Sparkles size={11} className="text-[#C4B5FD] shrink-0" />
                      <span className="truncate bg-black/60 px-1.5 py-0.5 rounded backdrop-blur-xs font-mono text-[#DDD6FE]">
                        {clip.name || 'Adjustment Layer'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-[9px] font-mono font-bold bg-[#8B5CF6] text-white px-1.5 py-0.2 rounded shadow-xs">
                        LUT / GRADE FX
                      </span>
                    </div>
                  </div>

                  {/* Center FX indicator */}
                  <div className="absolute inset-0 flex items-center justify-center px-4 pointer-events-none opacity-40">
                    <span className="text-[10px] font-mono font-semibold tracking-wider text-[#A78BFA] uppercase truncate">
                      Adjustment Layer - Grades All Tracks Below
                    </span>
                  </div>

                  {/* Bottom Duration info */}
                  <div className="absolute bottom-1 right-2 text-[9px] font-mono text-[#C4B5FD] font-bold bg-black/60 px-1 rounded pointer-events-none">
                    {durSec.toFixed(2)}s
                  </div>
                </div>
              ) : isText || clip.textContent !== undefined ? (
                /* Dedicated Text / Title Clip */
                <div className="relative h-full w-full bg-gradient-to-r from-[#211233] via-[#1A0E29] to-[#140C1F] overflow-hidden select-none border border-[#A855F7]/40 shadow-inner">
                  {/* Top Color Accent Line */}
                  <div className="absolute top-0 left-0 right-0 h-1 z-10 bg-[#A855F7]" />

                  {/* Header Info */}
                  <div className="absolute top-1.5 left-2 right-2 flex items-center justify-between text-[10px] font-semibold text-white drop-shadow-md truncate pointer-events-none z-10">
                    <div className="flex items-center gap-1.5 truncate">
                      <Type size={11} className="text-[#A855F7] shrink-0" />
                      <span className="truncate bg-black/60 px-1.5 py-0.5 rounded backdrop-blur-xs font-mono">
                        {clip.name || clip.textContent || 'Text'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-[9px] font-mono font-bold bg-[#A855F7]/80 text-white px-1.5 py-0.2 rounded shadow-xs">
                        {clip.textStyle?.presetStyle ? clip.textStyle.presetStyle.toUpperCase() : 'TEXT'}
                      </span>
                    </div>
                  </div>

                  {/* Centered Preview of Text Content */}
                  <div className="absolute inset-0 flex items-center justify-center px-4 pointer-events-none">
                    <span
                      style={{
                        color: clip.textStyle?.fontColor || '#FFFFFF',
                        fontFamily: clip.textStyle?.fontFamily || 'Inter',
                        textShadow: clip.textStyle?.strokeWidth
                          ? `0 0 ${clip.textStyle.strokeWidth * 2}px ${clip.textStyle.strokeColor || '#000000'}`
                          : '0 2px 4px rgba(0,0,0,0.8)',
                      }}
                      className="text-xs font-bold truncate max-w-full drop-shadow-md"
                    >
                      "{clip.textContent || clip.name}"
                    </span>
                  </div>

                  {/* Bottom Duration info */}
                  <div className="absolute bottom-1 right-2 text-[9px] font-mono text-[#A855F7] font-bold bg-black/60 px-1 rounded pointer-events-none">
                    {durSec.toFixed(2)}s
                  </div>
                </div>
              ) : isVideo ? (
                hasAttachedAudio ? (
                  /* Video Clip with Attached Sub Audio Track */
                  <div className="flex flex-col h-full w-full">
                    {/* Video Lane: Filmstrip & Title */}
                    <div className="relative flex-1 min-h-[22px] overflow-hidden bg-[#111319]">
                      <ClipVideoFilmstrip
                        filePath={clip.filePath}
                        widthPx={widthPx}
                        heightPx={Math.max(22, trackHeight - Math.min(32, Math.max(18, Math.round(trackHeight * 0.32))) - 8)}
                        inPointSeconds={clip.inPointSeconds || 0}
                        durationSeconds={durSec}
                        totalDurationSeconds={clip.metadata?.durationSeconds || durSec}
                        fps={fps}
                      />

                      {/* Top Color Accent Line */}
                      <div className="absolute top-0 left-0 right-0 h-1 z-10" style={{ backgroundColor: color }} />

                      {/* Clip Info Header Overlay */}
                      <div className="absolute top-1.5 left-2 right-2 flex items-center justify-between text-[10px] font-semibold text-white drop-shadow-md truncate pointer-events-none z-10">
                        <span className="truncate bg-black/60 px-1.5 py-0.5 rounded backdrop-blur-xs">{clip.name}</span>
                        <div className="flex items-center gap-1 shrink-0">
                          {clip.speedProfile && clip.speedProfile.speedMultiplier !== 1.0 && (
                            <div
                              className="flex items-center px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-[#F59E0B]/90 text-[#0D0E11] shadow-xs"
                              title={`Speed Ramping: ${clip.speedProfile.speedMultiplier}x`}
                            >
                              <span>[{clip.speedProfile.speedMultiplier}x]</span>
                            </div>
                          )}
                          {(clip.filterName || clip.filterId) && (
                            <div
                              className="flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-[#00F0FF]/90 text-black shadow-xs shrink-0"
                              title={`Active Filter: ${clip.filterName || clip.filterId} (${Math.round((clip.filterIntensity ?? 1) * 100)}%)`}
                            >
                              <Sparkles size={8} />
                              <span className="truncate max-w-[65px]">{clip.filterName || 'FX'}</span>
                            </div>
                          )}
                        {(clip.hasProxy || clip.proxyPath) && (
                            <div
                              className="flex items-center px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-[#10B981]/90 text-[#0D0E11] shadow-xs"
                              title="Low-res editing proxy active"
                            >
                              <span>PROX</span>
                            </div>
                          )}
                          {clip.synced && (
                            <div
                              className="flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-[#10B981]/90 text-[#0D0E11] shadow-xs shrink-0"
                              title="Synced with earliest clip anchor"
                            >
                              <CheckCircle2 size={10} />
                              <span>SYNCED</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Attached Audio Subtrack with White Oscillating Waveform (Reference image style) */}
                    <div
                      onContextMenu={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onSelectClip(clip.id);
                        onContextMenu({
                          x: e.clientX,
                          y: e.clientY,
                          clipId: clip.id,
                          trackId: track.id,
                          clipName: clip.name,
                          isVideo: true,
                          hasAttachedAudio: true,
                        });
                      }}
                      style={{ height: `${Math.min(32, Math.max(18, Math.round(trackHeight * 0.32)))}px` }}
                      className="relative bg-[#0A0D14] border-t border-[#222630] overflow-hidden select-none"
                      title="Attached Audio Subtrack (Right-click to Extract Audio)"
                    >
                      <div className="absolute left-1.5 top-0 bottom-0 flex items-center gap-1 z-10 pointer-events-none text-[8px] font-mono font-bold text-[#00F0FF]/80">
                        <Volume2 size={9} />
                        <span>{clip.audioProcessing?.noiseProfile?.noiseReductionEnabled ? 'Audio (Clean)' : 'Audio'}</span>
                      </div>
                      <ClipAudioWaveform
                        filePath={
                          (clip.audioProcessing?.noiseProfile?.noiseReductionEnabled &&
                            clip.audioProcessing?.noiseProfile?.denoisedAudioPath)
                            ? clip.audioProcessing.noiseProfile.denoisedAudioPath
                            : clip.filePath
                        }
                        clipId={clip.id}
                        volumeDb={clip.volumeDb ?? 0}
                        volumeKeyframes={clip.volumeKeyframes}
                        color="#FFFFFF"
                        widthPx={widthPx}
                        heightPx={Math.max(16, Math.min(30, Math.round(trackHeight * 0.32) - 2))}
                        inPointSeconds={clip.inPointSeconds || 0}
                        durationSeconds={durSec}
                        totalDurationSeconds={clip.metadata?.durationSeconds || durSec}
                        noiseReductionEnabled={clip.audioProcessing?.noiseProfile?.noiseReductionEnabled}
                        reductionIntensityDb={clip.audioProcessing?.noiseProfile?.reductionIntensityDb}
                        sensitivity={clip.audioProcessing?.noiseProfile?.sensitivity}
                      />
                    </div>
                  </div>
                ) : (
                  /* Video Only (Audio has been extracted to a separate audio track) */
                  <div className="relative h-full w-full overflow-hidden bg-[#111319]">
                    <ClipVideoFilmstrip
                      filePath={clip.filePath}
                      widthPx={widthPx}
                      heightPx={Math.max(28, trackHeight - 8)}
                      inPointSeconds={clip.inPointSeconds || 0}
                      durationSeconds={durSec}
                      totalDurationSeconds={clip.metadata?.durationSeconds || durSec}
                      fps={fps}
                    />
                    {/* Top Color Accent Line */}
                    <div className="absolute top-0 left-0 right-0 h-1 z-10" style={{ backgroundColor: color }} />

                    {/* Clip Info Header Overlay */}
                    <div className="absolute top-1.5 left-2 right-2 flex items-center justify-between text-[10px] font-semibold text-white drop-shadow-md truncate pointer-events-none z-10">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate bg-black/60 px-1.5 py-0.5 rounded backdrop-blur-xs">{clip.name}</span>
                        {clip.audioExtracted && (
                          <span className="text-[9px] font-mono text-[#00F0FF] bg-black/70 px-1 py-0.5 rounded border border-[#00F0FF]/30">
                            [Extracted Audio]
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {clip.speedProfile && clip.speedProfile.speedMultiplier !== 1.0 && (
                          <div
                            className="flex items-center px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-[#F59E0B]/90 text-[#0D0E11] shadow-xs"
                            title={`Speed Ramping: ${clip.speedProfile.speedMultiplier}x`}
                          >
                            <span>[{clip.speedProfile.speedMultiplier}x]</span>
                          </div>
                        )}
                        {(clip.filterName || clip.filterId) && (
                          <div
                            className="flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-[#00F0FF]/90 text-black shadow-xs shrink-0"
                            title={`Active Filter: ${clip.filterName || clip.filterId} (${Math.round((clip.filterIntensity ?? 1) * 100)}%)`}
                          >
                            <Sparkles size={8} />
                            <span className="truncate max-w-[65px]">{clip.filterName || 'FX'}</span>
                          </div>
                        )}
                        {(clip.hasProxy || clip.proxyPath) && (
                          <div
                            className="flex items-center px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-[#10B981]/90 text-[#0D0E11] shadow-xs"
                            title="Low-res editing proxy active"
                          >
                            <span>PROX</span>
                          </div>
                        )}
                        {clip.synced && (
                          <div
                            className="flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-[#10B981]/90 text-[#0D0E11] shadow-xs shrink-0"
                            title="Synced with earliest clip anchor"
                          >
                            <CheckCircle2 size={10} />
                            <span>SYNCED</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              ) : (
                /* Pure Audio Track Clip */
                <div className="relative h-full w-full bg-[#090C12] overflow-hidden select-none">
                  {/* Top Color Accent Line */}
                  <div className="absolute top-0 left-0 right-0 h-1 z-10" style={{ backgroundColor: color }} />

                  {/* Header Info */}
                  <div className="absolute top-1.5 left-2 right-2 flex items-center justify-between text-[10px] font-semibold text-white drop-shadow-md truncate pointer-events-none z-10">
                    <div className="flex items-center gap-1">
                      <Mic size={10} className="text-[#F59E0B]" />
                      <span className="truncate bg-black/60 px-1.5 py-0.5 rounded backdrop-blur-xs">{clip.name}</span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {clip.speedProfile && clip.speedProfile.speedMultiplier !== 1.0 && (
                        <div
                          className="flex items-center px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-[#F59E0B]/90 text-[#0D0E11] shadow-xs"
                          title={`Speed Ramping: ${clip.speedProfile.speedMultiplier}x`}
                        >
                          <span>[{clip.speedProfile.speedMultiplier}x]</span>
                        </div>
                      )}
                      {clip.synced && (
                        <div
                          className="flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-[#10B981]/90 text-[#0D0E11] shadow-xs shrink-0"
                          title="Synced with earliest clip anchor"
                        >
                          <CheckCircle2 size={10} />
                          <span>SYNCED</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* White Continuous Oscillating Waveform (Reference image style) */}
                  <div className="absolute inset-0 pt-3">
                    <ClipAudioWaveform
                      filePath={
                        (clip.audioProcessing?.noiseProfile?.noiseReductionEnabled &&
                          clip.audioProcessing?.noiseProfile?.denoisedAudioPath)
                          ? clip.audioProcessing.noiseProfile.denoisedAudioPath
                          : clip.filePath
                      }
                      clipId={clip.id}
                      volumeDb={clip.volumeDb ?? 0}
                      volumeKeyframes={clip.volumeKeyframes}
                      color="#FFFFFF"
                      widthPx={widthPx}
                      heightPx={Math.max(24, trackHeight - 16)}
                      inPointSeconds={clip.inPointSeconds || 0}
                      durationSeconds={durSec}
                      totalDurationSeconds={clip.metadata?.durationSeconds || durSec}
                      noiseReductionEnabled={clip.audioProcessing?.noiseProfile?.noiseReductionEnabled}
                      reductionIntensityDb={clip.audioProcessing?.noiseProfile?.reductionIntensityDb}
                      sensitivity={clip.audioProcessing?.noiseProfile?.sensitivity}
                    />
                  </div>
                </div>
              )}

              {/* Top Color Accent Line */}
              <div className="absolute top-0 left-0 right-0 h-1" style={{ backgroundColor: color }} />

              {/* Clip Info Header Overlay */}
              <div className="absolute top-1.5 left-2 right-2 flex items-center justify-between text-[11px] font-semibold text-white drop-shadow-md truncate pointer-events-none">
                <span className="truncate">{clip.name}</span>

                {/* Emerald Synced Status Badge */}
                {clip.synced && (
                  <div
                    className="flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-[#10B981]/80 text-[#0D0E11] shadow-xs shrink-0"
                    title="Synced with earliest clip anchor"
                  >
                    <CheckCircle2 size={10} />
                    <span>SYNCED</span>
                  </div>
                )}
              </div>

              {/* Bottom Offset delta info */}
              {clip.syncDeltaSeconds !== undefined && (
                <div className="absolute bottom-1 right-2 text-[9px] font-mono text-emerald-400 font-bold bg-black/60 px-1 rounded pointer-events-none">
                  +{clip.syncDeltaSeconds.toFixed(2)}s
                </div>
              )}

              {/* Keyframe Sub-Lane Visualizer */}
              {clip.keyframeTracks && clip.keyframeTracks.some((t) => t.keyframes.length > 0) && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="absolute bottom-0 left-0 right-0 h-4 bg-black/85 border-t border-[#00F0FF]/40 z-20 select-none overflow-hidden"
                  title="Global Keyframe Sub-Lane: Click to seek playhead, drag diamond to adjust timing, double-click to delete"
                >
                  {/* Floating KF indicator */}
                  <div className="absolute left-1 top-0 bottom-0 flex items-center gap-0.5 text-[8px] font-mono font-bold text-[#00F0FF]/70 pointer-events-none z-10">
                    <Diamond size={7} fill="currentColor" />
                    <span>KF</span>
                  </div>

                  {/* Keyframe Diamond Points across full 100% width of clip */}
                  <div className="absolute inset-0 pointer-events-none">
                    {Array.from(
                      new Set(
                        clip.keyframeTracks.flatMap((track) =>
                          track.keyframes.map((k) => Number(k.time.toFixed(3)))
                        )
                      )
                    )
                      .sort((a, b) => a - b)
                      .map((kfTime) => {
                        const kfPct = Math.min(100, Math.max(0, (kfTime / durSec) * 100));
                        const kfProps = clip.keyframeTracks
                          ?.filter((track) => track.keyframes.some((k) => Math.abs(k.time - kfTime) < 0.08))
                          .map((t) => {
                            switch (t.property) {
                              case 'position_x': return 'Pos X';
                              case 'position_y': return 'Pos Y';
                              case 'scale': return 'Scale';
                              case 'rotation': return 'Rotation';
                              case 'opacity': return 'Opacity';
                              default: return t.property;
                            }
                          }) || [];
                        const isMaster = kfProps.length >= 5;

                        return (
                          <div
                            key={`global-kf-${clip.id}-${kfTime}`}
                            style={{ left: `${kfPct}%` }}
                            onClick={(e) => {
                              e.stopPropagation();
                              onSeekToKeyframe?.(startSec + kfTime);
                            }}
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              onStartKeyframeDrag?.(clip.id, kfTime, e.clientX, durSec);
                            }}
                            onDoubleClick={(e) => {
                              e.stopPropagation();
                              onRemoveKeyframe?.(clip.id, kfTime);
                            }}
                            title={`Keyframe at ${kfTime.toFixed(2)}s [${isMaster ? 'Master (All Properties)' : kfProps.join(', ')}]\n• Click: Seek playhead here\n• Drag: Shift timing\n• Double-click: Delete`}
                            className="absolute top-1/2 -mt-1.5 -ml-1.5 w-3 h-3 rotate-45 bg-[#00F0FF] border border-black shadow-[0_0_6px_#00F0FF] hover:scale-130 transition-transform cursor-ew-resize z-30 pointer-events-auto"
                          />
                        );
                      })}
                  </div>
                </div>
              )}

              {/* Left Trim / Slow-Mo Stretch Handle */}
              <div
                onMouseDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  onStartTrimLeft(clip.id, e.clientX, e.altKey);
                }}
                className={`absolute left-0 top-0 bottom-0 w-3.5 transition-colors cursor-col-resize z-25 flex items-center justify-center shadow-xs ${
                  edgeDragMode === 'stretch'
                    ? 'bg-amber-950/40 hover:bg-[#F59E0B] group-hover:bg-[#F59E0B]/30'
                    : 'bg-black/40 hover:bg-[#00F0FF] group-hover:bg-[#00F0FF]/30'
                }`}
                title={
                  edgeDragMode === 'stretch'
                    ? 'Rate Stretch: Drag right to speed-up, drag left to slow-motion (Hold Alt for Trim)'
                    : 'Trim / Recover: Drag left to recover hidden video, drag right to trim (Hold Alt for Slow-Mo)'
                }
              >
                <div className={`w-[2px] h-4 rounded-full ${edgeDragMode === 'stretch' ? 'bg-[#F59E0B]' : 'bg-white/70'}`} />
              </div>

              {/* Right Trim / Slow-Mo Stretch Handle */}
              <div
                onMouseDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  onStartTrimRight(clip.id, e.clientX, e.altKey);
                }}
                className={`absolute right-0 top-0 bottom-0 w-3.5 transition-colors cursor-col-resize z-25 flex items-center justify-center shadow-xs ${
                  edgeDragMode === 'stretch'
                    ? 'bg-amber-950/40 hover:bg-[#F59E0B] group-hover:bg-[#F59E0B]/30'
                    : 'bg-black/40 hover:bg-[#00F0FF] group-hover:bg-[#00F0FF]/30'
                }`}
                title={
                  edgeDragMode === 'stretch'
                    ? 'Rate Stretch: Drag right to stretch into Slow-Mo, drag left to speed-up (Hold Alt for Trim)'
                    : 'Trim / Recover: Drag right to recover hidden video, drag left to trim (Hold Alt for Slow-Mo)'
                }
              >
                <div className={`w-[2px] h-4 rounded-full ${edgeDragMode === 'stretch' ? 'bg-[#F59E0B]' : 'bg-white/70'}`} />
              </div>
            </div>

            {/* FLOATING HOVER CARD: Displays Full Filename and Detailed Clip Metrics on Hover */}
            <div className="absolute bottom-full left-0 mb-2 hidden group-hover:flex flex-col gap-1 w-64 p-2.5 rounded-lg bg-[#0C0E12]/95 backdrop-blur-md border border-[#00F0FF]/60 shadow-[0_4px_24px_rgba(0,0,0,0.85)] pointer-events-none z-50 text-[11px]">
              {/* Cached Frame Preview (0 CPU/GPU resource overhead) */}
              {isVideo && (
                <div className="w-full h-24 rounded bg-[#0A0C10] overflow-hidden border border-[#222630] mb-1 relative flex items-center justify-center">
                  {getNearestCachedFrame(clip.filePath, clip.inPointSeconds || 0, 10.0) ? (
                    <img
                      src={getNearestCachedFrame(clip.filePath, clip.inPointSeconds || 0, 10.0)!}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex items-center gap-1.5 text-[#64748B] text-[10px] font-mono">
                      <Film size={12} className="opacity-50" />
                      <span>Video Preview</span>
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center gap-1.5 text-[#00F0FF] font-bold">
                <FileCode size={13} className="shrink-0" />
                <span className="break-all leading-tight font-mono text-xs">{clip.name}</span>
              </div>
              <div className="text-[10px] text-[#8A92A6] font-mono break-all leading-tight">
                {clip.filePath}
              </div>
              <div className="flex items-center justify-between text-[10px] font-mono pt-1 border-t border-[#222630] text-[#64748B]">
                <span>Start: {formatTimecode(startSec, fps)}</span>
                <span>Dur: {durSec.toFixed(1)}s</span>
              </div>
              {clip.synced && (
                <div className="flex items-center justify-between text-[10px] font-mono text-[#10B981] font-semibold">
                  <span>Sync Status:</span>
                  <span>+{clip.syncDeltaSeconds?.toFixed(2) || '0.00'}s offset</span>
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* Cut-Joints and Applied Transitions */}
      {/* Render Cut Joints & Transition Chips */}
      {(() => {
        const sortedClips = [...track.clips].sort(
          (a, b) => (a.startPositionSeconds || 0) - (b.startPositionSeconds || 0)
        );
        const joints = [];

        for (let i = 0; i < sortedClips.length - 1; i++) {
          const fromClip = sortedClips[i];
          const toClip = sortedClips[i + 1];
          const fromEndSec = (fromClip.startPositionSeconds || 0) + (fromClip.durationSeconds || 10);
          const toStartSec = toClip.startPositionSeconds || 0;
          const gapSec = toStartSec - fromEndSec;

          // If clips are adjacent or close cut joint (gap <= 1.0s or overlapping)
          if (gapSec <= 1.0) {
            const cutJointSec = (fromEndSec + toStartSec) / 2;
            const cutJointPx = cutJointSec * zoom;

            // Find if there is an applied transition for this joint
            const transition = transitions.find(
              (t) =>
                t.trackId === track.id &&
                ((t.fromClipId === fromClip.id && t.toClipId === toClip.id) ||
                  (t.fromClipId === toClip.id && t.toClipId === fromClip.id))
            );

            joints.push({
              cutJointSec,
              cutJointPx,
              fromClip,
              toClip,
              transition,
            });
          }
        }

        return joints.map(({ cutJointPx, fromClip, toClip, transition }) => {
          if (transition) {
            const isSelected = selectedTransitionId === transition.id;
            const transWidth = Math.max(38, Math.min(120, transition.duration * zoom));
            const transLeft = cutJointPx - transWidth / 2;

            return (
              <div
                key={transition.id}
                style={{
                  left: `${transLeft}px`,
                  width: `${transWidth}px`,
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedTransitionId?.(isSelected ? null : transition.id);
                }}
                className={`absolute top-1.5 bottom-1.5 rounded-md z-30 flex items-center justify-center cursor-pointer select-none transition-all shadow-lg backdrop-blur-xs ${
                  isSelected
                    ? 'bg-[#A855F7] border-2 border-white ring-2 ring-[#A855F7] text-white shadow-[0_0_16px_rgba(168,85,247,0.85)]'
                    : 'bg-[#A855F7]/80 hover:bg-[#A855F7] border border-[#A855F7] text-white'
                }`}
                title={`Transition: ${transition.transitionType} (${transition.duration.toFixed(1)}s)\nClick to edit duration or delete`}
              >
                <div className="flex items-center gap-1 px-1 py-0.5 truncate text-[10px] font-mono font-bold">
                  <Sparkles size={11} className="shrink-0 text-white" />
                  <span className="truncate capitalize">{transition.transitionType}</span>
                </div>

                {/* Popover slider and quick duration presets when selected */}
                {isSelected && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 p-2.5 rounded-lg bg-[#0F1117]/95 border border-[#A855F7] shadow-2xl z-50 flex flex-col gap-2 text-xs backdrop-blur-md"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white capitalize flex items-center gap-1">
                        <Sparkles size={12} className="text-[#A855F7]" />
                        <span>{transition.transitionType}</span>
                      </span>
                      <button
                        onClick={() => removeTransition?.(transition.id)}
                        className="p-1 rounded hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-colors cursor-pointer"
                        title="Delete Transition"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[10px] text-[#8A92A6] font-mono">
                        <span>Duration</span>
                        <span className="text-[#A855F7] font-bold">{transition.duration.toFixed(1)}s</span>
                      </div>
                      <input
                        type="range"
                        min={0.2}
                        max={3.0}
                        step={0.1}
                        value={transition.duration}
                        onChange={(e) =>
                          updateTransition?.(transition.id, { duration: parseFloat(e.target.value) })
                        }
                        className="w-full h-1 bg-[#222630] rounded appearance-none cursor-pointer accent-[#A855F7]"
                      />
                      {/* Quick preset chips */}
                      <div className="flex items-center justify-between pt-1 border-t border-[#222630]/60">
                        {[0.5, 1.0, 1.5, 2.0].map((dur) => (
                          <button
                            key={dur}
                            onClick={() => updateTransition?.(transition.id, { duration: dur })}
                            className={`px-1.5 py-0.5 rounded text-[9px] font-mono transition-colors cursor-pointer ${
                              Math.abs(transition.duration - dur) < 0.05
                                ? 'bg-[#A855F7] text-white font-bold'
                                : 'bg-[#1C202B] hover:bg-[#282F3F] text-[#8A92A6]'
                            }`}
                          >
                            {dur}s
                          </button>
                        ))}
                      </div>

                      {/* Wipe/Slide Border Options */}
                      {(transition.transitionType.includes('wipe') || transition.transitionType.includes('slide')) && (
                        <div className="pt-2 border-t border-[#222630]/60 space-y-1.5">
                          <div className="flex items-center justify-between text-[10px]">
                            <span className="text-[#8A92A6] font-medium">Border Edge Line</span>
                            <button
                              type="button"
                              onClick={() =>
                                updateTransition?.(transition.id, {
                                  showBorder: !transition.showBorder,
                                })
                              }
                              className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold transition-all cursor-pointer ${
                                transition.showBorder
                                  ? 'bg-[#A855F7] text-white shadow-[0_0_8px_rgba(168,85,247,0.5)]'
                                  : 'bg-[#1C202B] text-[#64748B] hover:text-[#8A92A6]'
                              }`}
                            >
                              {transition.showBorder ? 'BORDER: ON' : 'BORDER: OFF'}
                            </button>
                          </div>

                          {transition.showBorder && (
                            <div className="space-y-1.5 pt-1 bg-[#14161F] p-1.5 rounded border border-[#222630]">
                              <div className="flex items-center justify-between text-[9px] text-[#8A92A6]">
                                <span>Edge Color</span>
                                <div className="flex items-center gap-1.5">
                                  <span className="font-mono text-[9px] text-white font-bold">
                                    {transition.borderColor || '#A855F7'}
                                  </span>
                                  <input
                                    type="color"
                                    value={transition.borderColor || '#A855F7'}
                                    onChange={(e) =>
                                      updateTransition?.(transition.id, { borderColor: e.target.value })
                                    }
                                    className="w-4 h-4 rounded cursor-pointer border-0 bg-transparent p-0"
                                    title="Custom Color Picker"
                                  />
                                </div>
                              </div>

                              {/* Preset color swatches */}
                              <div className="flex items-center justify-between gap-1 pt-0.5">
                                {[
                                  { name: 'Purple', hex: '#A855F7' },
                                  { name: 'Pink', hex: '#EC4899' },
                                  { name: 'Cyan', hex: '#00F0FF' },
                                  { name: 'White', hex: '#FFFFFF' },
                                  { name: 'Yellow', hex: '#EAB308' },
                                  { name: 'Green', hex: '#10B981' },
                                  { name: 'Red', hex: '#EF4444' },
                                ].map((c) => (
                                  <button
                                    key={c.hex}
                                    type="button"
                                    onClick={() =>
                                      updateTransition?.(transition.id, { borderColor: c.hex })
                                    }
                                    style={{ backgroundColor: c.hex }}
                                    className={`w-3.5 h-3.5 rounded-full transition-transform cursor-pointer ${
                                      (transition.borderColor || '#A855F7').toLowerCase() === c.hex.toLowerCase()
                                        ? 'scale-125 ring-2 ring-white shadow-[0_0_6px_rgba(255,255,255,0.7)]'
                                        : 'hover:scale-110 opacity-70 hover:opacity-100'
                                    }`}
                                    title={c.name}
                                  />
                                ))}
                              </div>

                              {/* Border Width / Thickness */}
                              <div className="flex items-center justify-between text-[9px] text-[#8A92A6] pt-0.5">
                                <span>Thickness</span>
                                <div className="flex items-center gap-1">
                                  {[1, 2, 3, 5].map((w) => (
                                    <button
                                      key={w}
                                      type="button"
                                      onClick={() =>
                                        updateTransition?.(transition.id, { borderWidth: w })
                                      }
                                      className={`px-1.5 py-0.2 rounded text-[8px] font-mono transition-colors cursor-pointer ${
                                        (transition.borderWidth || 2) === w
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
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          }

          // If no transition yet, render cut joint drop receiver
          const jointWidth = activeDragTransition ? 64 : 24;
          const jointLeft = cutJointPx - jointWidth / 2;

          return (
            <div
              key={`joint-${fromClip.id}-${toClip.id}`}
              data-cut-joint="true"
              data-track-id={track.id}
              data-from-clip={fromClip.id}
              data-to-clip={toClip.id}
              style={{
                left: `${jointLeft}px`,
                width: `${jointWidth}px`,
              }}
              className={`absolute top-0 bottom-0 z-30 flex items-center justify-center transition-all pointer-events-auto ${
                activeDragTransition
                  ? 'bg-[#A855F7]/35 border-2 border-dashed border-[#A855F7] shadow-[0_0_16px_rgba(168,85,247,0.55)] cursor-copy'
                  : 'hover:bg-[#A855F7]/20 group'
              }`}
              title="Cut Joint: Drop or click transition here"
            >
              {activeDragTransition ? (
                <div className="flex flex-col items-center gap-0.5 text-white pointer-events-none scale-105 transition-transform animate-pulse">
                  <Sparkles size={11} className="text-[#A855F7]" />
                  <span className="text-[8px] font-mono font-bold uppercase bg-[#A855F7] px-1 py-0.2 rounded text-white shadow-xs">
                    Drop Cut
                  </span>
                </div>
              ) : (
                <div className="w-[3px] h-5 rounded-full bg-transparent group-hover:bg-[#A855F7] transition-all" />
              )}
            </div>
          );
        });
      })()}

      {/* Bottom Track Resizer Handle */}
      <div
        onMouseDown={(e) => onStartResize?.(e)}
        onDoubleClick={(e) => {
          e.stopPropagation();
          onResetHeight?.();
        }}
        className="absolute bottom-0 left-0 right-0 h-1.5 cursor-row-resize z-40 group/resizer hover:bg-[#00F0FF]/60 active:bg-[#00F0FF] flex items-center justify-center transition-colors pointer-events-auto"
        title="Hold and drag to resize track height (Double-click to reset)"
      >
        <div className="w-16 h-[2px] bg-transparent group-hover/resizer:bg-[#00F0FF] rounded-full transition-colors" />
      </div>
    </div>
  );
};
