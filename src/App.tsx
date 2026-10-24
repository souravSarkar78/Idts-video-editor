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
import { Film, Music, Video, Sparkles } from 'lucide-react';
import { useTimelineStore, updateAppTitle } from './store/timelineStore';
import { useShortcutStore, normalizeKeyEvent } from './store/shortcutStore';
import { filePosterCache, getNearestCachedFrame } from './utils/frameCacheService';

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
    }))
  );

  const { loadPreferences } = useShortcutStore();

  // Load preferences and initialize app title on mount
  useEffect(() => {
    loadPreferences();
    initProxyEventListener();
    updateAppTitle(project.name || 'Untitled Project', isDirty, currentProjectPath);
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
            togglePlayPause();
            return;
          case 'shuttle_reverse':
            e.preventDefault();
            stepFrames(-Math.round(project.fps || 30));
            return;
          case 'shuttle_pause':
            e.preventDefault();
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
      <main className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Upper Studio Stage: Media Pool (Left), Program Monitor (Center), Inspector (Right) */}
        <section className="h-[48%] min-h-[260px] flex overflow-hidden border-b border-[#222630]">
          {/* 1. Media Library / Assets & Bins Panel */}
          <div className="w-[40%] min-w-[360px] max-w-[560px] flex overflow-hidden">
            <MediaPool />
          </div>

          {/* 2. Center Program Monitor Canvas (Single Player) */}
          <div className="flex-1 flex overflow-hidden">
            <ProgramMonitor />
          </div>

          {/* 3. Right Clip Inspector / Properties Panel */}
          <div className="w-[280px] xl:w-[320px] flex overflow-hidden">
            <Inspector />
          </div>
        </section>

        {/* Lower Studio Stage: Dynamic Multi-Track Timeline */}
        <section className="h-[52%] min-h-[240px] flex flex-col overflow-hidden">
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
