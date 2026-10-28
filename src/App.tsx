import React, { useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Header } from './components/Header/Header';
import { MediaPool } from './components/MediaPool/MediaPool';
import { ProgramMonitor } from './components/Preview/ProgramMonitor';
import { Inspector } from './components/Inspector/Inspector';
import { Timeline } from './components/Timeline/Timeline';
import { SyncModal } from './components/SyncModal/SyncModal';
import { ExportModal } from './components/ExportModal/ExportModal';
import { SettingsModal } from './components/SettingsModal/SettingsModal';
import { SilenceModal } from './components/SilenceModal/SilenceModal';
import { AutoCaptionModal } from './components/AutoCaption/AutoCaptionModal';
import { VoiceoverModal } from './components/Voiceover/VoiceoverModal';
import { NoiseProfileModal } from './components/Audio/NoiseProfileModal';
import { TimelineAudioPlayer } from './components/Audio/TimelineAudioPlayer';
import { Film, Music, Video, Sparkles, ChevronLeft, ChevronRight } from 'lucide-react';
import { useTimelineStore, updateAppTitle } from './store/timelineStore';
import { useShortcutStore, normalizeKeyEvent } from './store/shortcutStore';
import { filePosterCache, getNearestCachedFrame } from './utils/frameCacheService';
import { unlockAudioContext } from './utils/audioMastering';

export const App: React.FC = () => {
  const {
    togglePlayPause,
    stepFrames,
    splitClipAtPlayhead,
    deleteClip,
    deleteSelectedClips,
    rippleDeleteClip,
    toggleSnapping,
    toggleRippleMode,
    initProxyEventListener,
    undo,
    redo,
    saveProject,
    switchMulticamAngle,
    isPlaying,
    selectedClipId,
    selectedClipIds,
    project,
    activeDragAsset,
    activeDragTransition,
    isDirty,
    currentProjectPath,
    timelineHeightPct,
    mediaPoolWidthPx,
    inspectorWidthPx,
    isMediaPoolCollapsed,
    isInspectorCollapsed,
    setTimelineHeightPct,
    setMediaPoolWidthPx,
    setInspectorWidthPx,
    toggleMediaPoolCollapsed,
    toggleInspectorCollapsed,
  } = useTimelineStore(
    useShallow((state) => ({
      togglePlayPause: state.togglePlayPause,
      stepFrames: state.stepFrames,
      splitClipAtPlayhead: state.splitClipAtPlayhead,
      deleteClip: state.deleteClip,
      deleteSelectedClips: state.deleteSelectedClips,
      rippleDeleteClip: state.rippleDeleteClip,
      toggleSnapping: state.toggleSnapping,
      toggleRippleMode: state.toggleRippleMode,
      initProxyEventListener: state.initProxyEventListener,
      undo: state.undo,
      redo: state.redo,
      saveProject: state.saveProject,
      switchMulticamAngle: state.switchMulticamAngle,
      isPlaying: state.isPlaying,
      selectedClipId: state.selectedClipId,
      selectedClipIds: state.selectedClipIds,
      project: state.project,
      activeDragAsset: state.activeDragAsset,
      activeDragTransition: state.activeDragTransition,
      isDirty: state.isDirty,
      currentProjectPath: state.currentProjectPath,
      timelineHeightPct: state.timelineHeightPct,
      mediaPoolWidthPx: state.mediaPoolWidthPx,
      inspectorWidthPx: state.inspectorWidthPx,
      isMediaPoolCollapsed: state.isMediaPoolCollapsed,
      isInspectorCollapsed: state.isInspectorCollapsed,
      setTimelineHeightPct: state.setTimelineHeightPct,
      setMediaPoolWidthPx: state.setMediaPoolWidthPx,
      setInspectorWidthPx: state.setInspectorWidthPx,
      toggleMediaPoolCollapsed: state.toggleMediaPoolCollapsed,
      toggleInspectorCollapsed: state.toggleInspectorCollapsed,
    }))
  );

  const mainContainerRef = React.useRef<HTMLElement>(null);

  // Splitter Handlers: Vertical Workspace Resizing (Upper Stage vs Timeline)
  const handleTimelineResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startPct = timelineHeightPct;
    const mainHeight = mainContainerRef.current?.clientHeight || window.innerHeight;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaY = moveEvent.clientY - startY;
      const deltaPct = (deltaY / mainHeight) * 100;
      // Dragging down decreases timeline height; dragging up increases timeline height
      const newPct = Math.max(15, Math.min(80, startPct - deltaPct));
      setTimelineHeightPct(newPct);
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  // Splitter Handlers: Media Pool Width Resizing
  const handleMediaPoolResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = mediaPoolWidthPx;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const newWidth = Math.max(200, Math.min(850, startWidth + deltaX));
      setMediaPoolWidthPx(newWidth);
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  // Splitter Handlers: Inspector Width Resizing
  const handleInspectorResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = inspectorWidthPx;

    const onMouseMove = (moveEvent: MouseEvent) => {
      // Dragging left increases inspector width; dragging right decreases inspector width
      const deltaX = startX - moveEvent.clientX;
      const newWidth = Math.max(220, Math.min(650, startWidth + deltaX));
      setInspectorWidthPx(newWidth);
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const { loadPreferences } = useShortcutStore();

  // Load preferences and initialize app title on mount
  useEffect(() => {
    loadPreferences();
    initProxyEventListener();
    updateAppTitle(project.name || 'Untitled Project', isDirty, currentProjectPath);
  }, []);

  // Ensure Web Audio context is seamlessly unlocked on first user gesture
  useEffect(() => {
    const unlock = () => {
      unlockAudioContext();
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  // Centralized Global Keyboard Shortcuts Engine
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore key repeats
      if (e.repeat) return;

      // Ignore if user is currently recording a new shortcut key in Settings
      if (useShortcutStore.getState().recordingActionId) {
        return;
      }

      // Ignore if user is currently typing in an input, textarea, select, or contentEditable
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable)
      ) {
        return;
      }

      // Ignore global timeline shortcuts if modal dialogs (like Noise Profile Modal) are open
      if (useTimelineStore.getState().isNoiseModalOpen) {
        return;
      }

      // If user is currently recording, pressing Space or Escape stops and saves recording cleanly
      if (e.key === ' ' || e.code === 'Space' || e.key === 'Escape') {
        if (target && target.tagName === 'BUTTON') target.blur();
        if (useTimelineStore.getState().isRecordingVoiceover) {
          e.preventDefault();
          e.stopPropagation();
          useTimelineStore.getState().stopVoiceoverRecording();
          return;
        }
      }

      const combo = normalizeKeyEvent(e);
      const shortcuts = useShortcutStore.getState().shortcuts;

      // Find if this combo matches an action in our shortcut map
      const matchedAction = Object.entries(shortcuts).find(
        ([_, key]) => key.toLowerCase() === combo.toLowerCase()
      )?.[0];

      if (matchedAction) {
        switch (matchedAction) {
          case 'play_pause':
            e.preventDefault();
            e.stopPropagation();
            if (target && target.tagName === 'BUTTON') target.blur();
            if (useTimelineStore.getState().isRecordingVoiceover) {
              useTimelineStore.getState().stopVoiceoverRecording();
              return;
            }
            togglePlayPause();
            return;
          case 'shuttle_reverse':
            e.preventDefault();
            stepFrames(-Math.round(project.fps || 30));
            return;
          case 'shuttle_pause':
            e.preventDefault();
            if (useTimelineStore.getState().isRecordingVoiceover) {
              useTimelineStore.getState().stopVoiceoverRecording();
              return;
            }
            if (isPlaying) togglePlayPause();
            return;
          case 'shuttle_forward':
            e.preventDefault();
            stepFrames(Math.round(project.fps || 30));
            return;
          case 'split_clip':
            e.preventDefault();
            splitClipAtPlayhead();
            return;
          case 'delete_clip':
            if (selectedClipId || selectedClipIds.length > 0) {
              e.preventDefault();
              deleteSelectedClips();
            }
            return;
          case 'ripple_delete':
            if (selectedClipId) {
              e.preventDefault();
              rippleDeleteClip(selectedClipId);
            }
            return;
          case 'toggle_snapping':
            e.preventDefault();
            toggleSnapping();
            return;
          case 'ripple_mode':
            e.preventDefault();
            toggleRippleMode();
            return;
          case 'undo':
            e.preventDefault();
            undo();
            return;
          case 'redo':
            e.preventDefault();
            redo();
            return;
          case 'save_project':
            e.preventDefault();
            saveProject();
            return;
          case 'multicam_angle_1':
            e.preventDefault();
            switchMulticamAngle(0);
            return;
          case 'multicam_angle_2':
            e.preventDefault();
            switchMulticamAngle(1);
            return;
          case 'multicam_angle_3':
            e.preventDefault();
            switchMulticamAngle(2);
            return;
          case 'multicam_angle_4':
            e.preventDefault();
            switchMulticamAngle(3);
            return;
          default:
            break;
        }
      }

      // Standard arrow navigation fallbacks
      if (e.code === 'ArrowLeft') {
        e.preventDefault();
        stepFrames(e.shiftKey ? -Math.round(project.fps || 30) : -1);
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        stepFrames(e.shiftKey ? Math.round(project.fps || 30) : 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    togglePlayPause,
    stepFrames,
    splitClipAtPlayhead,
    deleteClip,
    rippleDeleteClip,
    toggleSnapping,
    undo,
    redo,
    saveProject,
    switchMulticamAngle,
    isPlaying,
    selectedClipId,
    project.fps,
  ]);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#0D0E11] text-[#F0F3F8]">
      {/* Top CapCut / Premiere Navigation Bar */}
      <Header />

      {/* Main Studio Body */}
      <main ref={mainContainerRef} className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Upper Studio Stage: Media Pool (Left), Program Monitor (Center), Inspector (Right) */}
        <section
          style={{ height: `${100 - timelineHeightPct}%`, minHeight: '180px' }}
          className="flex overflow-hidden"
        >
          {/* 1. Media Library / Assets & Bins Panel */}
          {isMediaPoolCollapsed ? (
            <div
              onClick={toggleMediaPoolCollapsed}
              className="w-8 shrink-0 bg-[#12141A] border-r border-[#222630] flex flex-col items-center py-2.5 select-none cursor-pointer hover:bg-[#181B22] transition-colors group z-10"
              title="Expand Media Pool (Click to show)"
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleMediaPoolCollapsed();
                }}
                className="p-1 rounded bg-[#1C202B] hover:bg-[#00F0FF] text-[#8A92A6] hover:text-[#0D0E11] transition-all cursor-pointer"
                title="Expand Media Pool"
              >
                <ChevronRight size={13} />
              </button>
              <div className="mt-6 flex flex-col items-center gap-4 text-[#64748B] group-hover:text-[#F0F3F8] transition-colors">
                <span className="text-[10px] font-bold tracking-widest uppercase [writing-mode:vertical-lr] rotate-180">
                  Media Pool
                </span>
                <Film size={13} className="text-[#8A92A6] group-hover:text-[#00F0FF] transition-colors" />
              </div>
            </div>
          ) : (
            <>
              <div
                style={{ width: `${mediaPoolWidthPx}px` }}
                className="flex overflow-hidden shrink-0 relative"
              >
                <MediaPool />
              </div>

              {/* Splitter 1: Media Pool <-> Program Monitor */}
              <div
                onMouseDown={handleMediaPoolResizeStart}
                onDoubleClick={() => setMediaPoolWidthPx(400)}
                className="w-1.5 hover:w-2 bg-[#12141A] hover:bg-[#00F0FF]/40 active:bg-[#00F0FF] cursor-col-resize relative flex flex-col items-center justify-center transition-all group z-20 border-x border-[#222630] select-none shrink-0"
                title="Hold and drag to resize Media Pool (Double-click to reset)"
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleMediaPoolCollapsed();
                  }}
                  className="absolute top-2 -left-2 w-4 h-6 bg-[#181B22] hover:bg-[#00F0FF] text-[#8A92A6] hover:text-[#0D0E11] rounded border border-[#222630] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md z-30 cursor-pointer"
                  title="Hide Media Pool (Maximize Monitor Space)"
                >
                  <ChevronLeft size={11} />
                </button>
                <div className="h-8 w-1 bg-[#374151] group-hover:bg-[#00F0FF] rounded-full transition-colors" />
              </div>
            </>
          )}

          {/* 2. Center Program Monitor Canvas (Single Player - Expands into all available space) */}
          <div className="flex-1 flex min-w-0 overflow-hidden">
            <ProgramMonitor />
          </div>

          {/* Splitter 2: Program Monitor <-> Inspector (Shown only when Inspector is expanded) */}
          {!isInspectorCollapsed && (
            <div
              onMouseDown={handleInspectorResizeStart}
              onDoubleClick={() => setInspectorWidthPx(300)}
              className="w-1.5 hover:w-2 bg-[#12141A] hover:bg-[#00F0FF]/40 active:bg-[#00F0FF] cursor-col-resize relative flex flex-col items-center justify-center transition-all group z-20 border-x border-[#222630] select-none shrink-0"
              title="Hold and drag to resize Inspector (Double-click to reset)"
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleInspectorCollapsed();
                }}
                className="absolute top-2 -right-2 w-4 h-6 bg-[#181B22] hover:bg-[#00F0FF] text-[#8A92A6] hover:text-[#0D0E11] rounded border border-[#222630] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md z-30 cursor-pointer"
                title="Hide Inspector (Maximize Monitor Space)"
              >
                <ChevronRight size={11} />
              </button>
              <div className="h-8 w-1 bg-[#374151] group-hover:bg-[#00F0FF] rounded-full transition-colors" />
            </div>
          )}

          {/* 3. Right Clip Inspector / Properties Panel */}
          <div
            style={isInspectorCollapsed ? undefined : { width: `${inspectorWidthPx}px` }}
            className={`flex overflow-hidden shrink-0 ${isInspectorCollapsed ? 'w-10' : ''}`}
          >
            <Inspector />
          </div>
        </section>

        {/* Horizontal Workspace Splitter (Upper Stage vs Timeline) */}
        <div
          onMouseDown={handleTimelineResizeStart}
          onDoubleClick={() => setTimelineHeightPct(50)}
          className="h-2 bg-[#12141A] hover:bg-[#00F0FF]/40 active:bg-[#00F0FF] cursor-row-resize relative flex items-center justify-center transition-colors group z-20 border-y border-[#222630] select-none shrink-0"
          title="Hold and drag to resize Timeline height (Double-click to reset to 50%)"
        >
          <div className="w-14 h-1 bg-[#374151] group-hover:bg-[#00F0FF] rounded-full transition-colors flex items-center justify-center gap-1">
            <span className="w-1 h-0.5 bg-black/40 rounded-full" />
            <span className="w-1 h-0.5 bg-black/40 rounded-full" />
            <span className="w-1 h-0.5 bg-black/40 rounded-full" />
          </div>
        </div>

        {/* Lower Studio Stage: Dynamic Multi-Track Timeline */}
        <section
          style={{ height: `${timelineHeightPct}%`, minHeight: '160px' }}
          className="flex flex-col overflow-hidden"
        >
          <Timeline />
        </section>
      </main>

      {/* Multicam Synchronization Configuration Dialog */}
      <SyncModal />

      {/* Hardware Export & Render Configuration Dialog */}
      <ExportModal />

      {/* Preferences & Keyboard Shortcuts Configuration Dialog */}
      <SettingsModal />

      {/* Audio Silence Auto-Cut Configuration Dialog */}
      <SilenceModal />

      {/* Local AI Auto-Captions Configuration Dialog */}
      <AutoCaptionModal />

      {/* Live Audio / Voiceover Recording Dialog */}
      <VoiceoverModal />

      {/* Spectral Noise Profile & Room Tone Capture Dialog */}
      <NoiseProfileModal />

      {/* Multi-Track Synchronous Audio Player */}
      <TimelineAudioPlayer />

      {/* Floating Ghost Card during Media Drag */}
      {activeDragAsset && (() => {
        const thumb =
          activeDragAsset.asset.thumbnailUrl ||
          filePosterCache.get(activeDragAsset.asset.filePath) ||
          getNearestCachedFrame(activeDragAsset.asset.filePath, 0, 100);

        const durSec = activeDragAsset.asset.durationSeconds || 0;
        const durStr = `${Math.floor(durSec / 60)}:${Math.floor(durSec % 60).toString().padStart(2, '0')}`;

        return (
          <div
            style={{
              left: `${activeDragAsset.mouseX + 16}px`,
              top: `${activeDragAsset.mouseY + 16}px`,
            }}
            className="fixed pointer-events-none z-[99999] flex items-center gap-2.5 px-3 py-2 rounded-lg bg-[#0F1117]/95 border-2 border-[#00F0FF] shadow-[0_8px_32px_rgba(0,240,255,0.45)] text-white text-xs font-semibold backdrop-blur-md select-none ring-1 ring-white/20"
          >
            {thumb ? (
              <img
                src={thumb}
                alt=""
                className="w-10 h-7 rounded object-cover border border-[#222630] shrink-0"
              />
            ) : activeDragAsset.asset.mediaType === 'audio' ? (
              <div className="w-10 h-7 rounded bg-[#1A1D24] flex items-center justify-center text-[#F59E0B] shrink-0">
                <Music size={16} />
              </div>
            ) : (
              <div className="w-10 h-7 rounded bg-[#1A1D24] flex items-center justify-center text-[#00F0FF] shrink-0">
                <Video size={16} />
              </div>
            )}
            <div className="flex flex-col pr-1">
              <span className="truncate max-w-[180px] text-xs text-white font-mono font-bold leading-tight">
                {activeDragAsset.asset.name}
              </span>
              <span className="text-[10px] text-[#00F0FF] font-mono leading-tight mt-0.5">
                Drop to place on track ({durStr})
              </span>
            </div>
          </div>
        );
      })()}

      {/* Floating Ghost Chip during Transition Drag */}
      {activeDragTransition && (
        <div
          style={{
            left: `${activeDragTransition.mouseX + 16}px`,
            top: `${activeDragTransition.mouseY + 16}px`,
          }}
          className="fixed pointer-events-none z-[99999] flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#0F1117]/95 border-2 border-[#A855F7] shadow-[0_8px_32px_rgba(168,85,247,0.45)] text-white text-xs font-semibold backdrop-blur-md select-none ring-1 ring-white/20"
        >
          <div className="w-5 h-5 rounded bg-[#A855F7]/20 flex items-center justify-center text-[#A855F7]">
            <Sparkles size={12} />
          </div>
          <div className="flex flex-col">
            <span className="font-mono font-bold text-xs text-white">
              {activeDragTransition.label}
            </span>
            <span className="text-[10px] text-[#A855F7] font-mono">
              Drop on cut joint between clips
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
