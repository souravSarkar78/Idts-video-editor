import React, { useState, useRef, useEffect } from 'react';
import {
  Film,
  Music,
  Type,
  Sticker,
  Sparkles,
  Split,
  Filter,
  Upload,
  Settings,
  Zap,
  ChevronDown,
  FilePlus,
  FolderOpen,
  Save,
  SaveAll,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  X,
  Activity,
  Info,
  ShieldCheck,
  Trash2,
  Cpu,
  Layers,
  Scissors,
  Undo2,
  Redo2,
  Maximize2,
  HelpCircle,
} from 'lucide-react';
import { PanelLeft, PanelRight, Minus, Square, Share2 } from '@/components/Icons';
import { useShallow } from 'zustand/react/shallow';
import { useTimelineStore, isTauri } from '../../store/timelineStore';
import { useShortcutStore } from '../../store/shortcutStore';
import { ProcessHealthStats } from '../../types/ipc';

export const Header: React.FC = () => {
  const {
    project,
    tracks,
    activeTab,
    setActiveTab,
    executeTauriSync,
    setExportModalOpen,
    isDirty,
    currentProjectPath,
    saveProject,
    openProject,
    createNewProject,
    isMediaPoolCollapsed,
    isInspectorCollapsed,
    toggleMediaPoolCollapsed,
    toggleInspectorCollapsed,
    resetWorkspaceLayout,
    undo,
    redo,
    splitClipAtPlayhead,
    deleteSelectedClips,
    rippleDeleteClip,
    selectedClipId,
    triggerAutoSave,
  } = useTimelineStore(
    useShallow((state) => ({
      project: state.project,
      tracks: state.tracks,
      activeTab: state.activeTab,
      setActiveTab: state.setActiveTab,
      executeTauriSync: state.executeTauriSync,
      setExportModalOpen: state.setExportModalOpen,
      isDirty: state.isDirty,
      currentProjectPath: state.currentProjectPath,
      saveProject: state.saveProject,
      openProject: state.openProject,
      createNewProject: state.createNewProject,
      isMediaPoolCollapsed: state.isMediaPoolCollapsed,
      isInspectorCollapsed: state.isInspectorCollapsed,
      toggleMediaPoolCollapsed: state.toggleMediaPoolCollapsed,
      toggleInspectorCollapsed: state.toggleInspectorCollapsed,
      resetWorkspaceLayout: state.resetWorkspaceLayout,
      undo: state.undo,
      redo: state.redo,
      splitClipAtPlayhead: state.splitClipAtPlayhead,
      deleteSelectedClips: state.deleteSelectedClips,
      rippleDeleteClip: state.rippleDeleteClip,
      selectedClipId: state.selectedClipId,
      triggerAutoSave: state.triggerAutoSave,
    }))
  );

  const { openSettingsModal } = useShortcutStore();

  const [isFileMenuOpen, setIsFileMenuOpen] = useState(false);
  const [activeMenuTab, setActiveMenuTab] = useState<'file' | 'edit' | 'view' | 'help'>('file');
  const [isHealthModalOpen, setIsHealthModalOpen] = useState(false);
  const [isAboutModalOpen, setIsAboutModalOpen] = useState(false);
  const [healthStats, setHealthStats] = useState<ProcessHealthStats | null>(null);
  const [autoSaveNotice, setAutoSaveNotice] = useState<string | null>(null);

  const fileMenuRef = useRef<HTMLDivElement>(null);

  const fetchHealthStats = async () => {
    if (isTauri) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const stats = await invoke<ProcessHealthStats>('get_process_health_stats');
        setHealthStats(stats);
      } catch (e) {
        console.warn('Failed to fetch health stats:', e);
      }
    }
  };

  const handleKillSidecars = async () => {
    if (isTauri) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('kill_all_sidecar_processes');
        await fetchHealthStats();
      } catch (e) {
        console.warn('Failed to kill sidecars:', e);
      }
    }
  };

  const handleManualAutoSave = async () => {
    const success = await triggerAutoSave();
    if (success) {
      setAutoSaveNotice('Timeline auto-saved successfully to disk backup!');
      setTimeout(() => setAutoSaveNotice(null), 3000);
    }
  };

  const handleToggleFullscreen = async () => {
    if (isTauri) {
      try {
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        const isFull = await getCurrentWindow().isFullscreen();
        await getCurrentWindow().setFullscreen(!isFull);
      } catch (e) {
        console.warn('Fullscreen toggle failed:', e);
      }
    }
  };

  // Project name inline editing
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(project.name || '1001');

  useEffect(() => {
    setTempName(project.name || '1001');
  }, [project.name]);

  // Close File menu on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (fileMenuRef.current && !fileMenuRef.current.contains(e.target as Node)) {
        setIsFileMenuOpen(false);
      }
    };
    if (isFileMenuOpen) {
      window.addEventListener('mousedown', handleOutsideClick);
    }
    return () => window.removeEventListener('mousedown', handleOutsideClick);
  }, [isFileMenuOpen]);

  const allClips = tracks.flatMap((t) => t.clips || []);
  const syncedCount = allClips.filter((c) => c.synced || c.isSynced).length;

  const tabs = [
    { id: 'media', label: 'Media', icon: Film },
    { id: 'audio', label: 'Audio', icon: Music },
    { id: 'text', label: 'Text', icon: Type },
    { id: 'stickers', label: 'Stickers', icon: Sticker },
    { id: 'effects', label: 'Effects', icon: Sparkles },
    { id: 'transitions', label: 'Transition', icon: Split },
    { id: 'filters', label: 'Filters', icon: Filter },
  ] as const;

  // Native window control actions (Tauri 2.0 window API)
  const handleMinimize = async () => {
    if (isTauri) {
      try {
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        await getCurrentWindow().minimize();
      } catch (err) {
        console.warn('Minimize failed:', err);
      }
    }
  };

  const handleMaximize = async () => {
    if (isTauri) {
      try {
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        await getCurrentWindow().toggleMaximize();
      } catch (err) {
        console.warn('Maximize failed:', err);
      }
    }
  };

  const handleClose = async () => {
    if (isTauri) {
      try {
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        await getCurrentWindow().close();
      } catch (err) {
        console.warn('Close failed:', err);
      }
    }
  };

  const handleNameSubmit = () => {
    if (tempName.trim()) {
      useTimelineStore.setState((state) => ({
        project: { ...state.project, name: tempName.trim() },
        isDirty: true,
      }));
    }
    setIsEditingName(false);
  };

  return (
    <header className="flex flex-col select-none shrink-0 z-30 bg-[#0E1015]">
      {/* ========================================================================= */}
      {/* TIER 1: CapCut-Style Window Title Bar (App Name, Project, Export & Controls) */}
      {/* ========================================================================= */}
      <div
        data-tauri-drag-region
        onDoubleClick={handleMaximize}
        className="h-8.5 bg-[#101217] border-b border-[#1E222D] flex items-center justify-between px-2.5 text-xs text-[#E2E8F0]"
      >
        {/* Left: App Logo, Name & CapCut "Menu ⌵" button */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Logo & App Name */}
          <div className="flex items-center gap-1.5 font-bold tracking-tight mr-1 pointer-events-none">
            <div className="w-4.5 h-4.5 rounded bg-[#00F0FF] flex items-center justify-center text-black font-black shadow-[0_0_8px_rgba(0,240,255,0.4)]">
              <Film size={11} strokeWidth={2.5} />
            </div>
            <div className="flex items-center gap-1">
              <span className="font-extrabold text-[12px] tracking-wide text-[#00F0FF]">IDTS</span>
              <span className="font-bold text-[12px] text-white">video editor</span>
            </div>
          </div>

          {/* Menu ⌵ Dropdown Pill Button */}
          <div ref={fileMenuRef} className="relative">
            <button
              type="button"
              onClick={() => setIsFileMenuOpen(!isFileMenuOpen)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#1B1F2A] hover:bg-[#252C3D] border border-white/5 hover:border-[#00F0FF]/40 text-[#CBD5E1] text-[11px] font-medium transition-all cursor-pointer"
            >
              <span>Menu</span>
              <ChevronDown
                size={11}
                className={`text-[#8E9CAE] transition-transform ${isFileMenuOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {/* Menu Dropdown Modal */}
            {isFileMenuOpen && (
              <div className="absolute top-full left-0 mt-1 w-72 rounded-lg bg-[#14161F] border border-[#262B38] shadow-2xl overflow-hidden z-50 text-xs font-medium">
                {/* Category Tabs: File | Edit | View | Help */}
                <div className="flex items-center border-b border-[#222630] bg-[#0E1015] px-1 pt-1">
                  {(['file', 'edit', 'view', 'help'] as const).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setActiveMenuTab(tab)}
                      className={`flex-1 py-1.5 text-[11px] font-bold capitalize transition-colors border-b-2 cursor-pointer ${
                        activeMenuTab === tab
                          ? 'text-[#00F0FF] border-[#00F0FF] bg-[#161922]'
                          : 'text-[#8A92A6] border-transparent hover:text-white'
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>

                <div className="py-1">
                  {/* FILE TAB */}
                  {activeMenuTab === 'file' && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setIsFileMenuOpen(false);
                          createNewProject();
                        }}
                        className="w-full flex items-center justify-between px-3.5 py-1.5 hover:bg-[#1C202B] text-[#F0F3F8] hover:text-[#00F0FF] transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <FilePlus size={14} className="text-[#8A92A6]" />
                          <span>New Project</span>
                        </div>
                        <span className="text-[10px] font-mono text-[#64748B]">Ctrl+N</span>
                      </button>

                      <button
                        type="button"
                        onClick={async () => {
                          setIsFileMenuOpen(false);
                          await openProject();
                        }}
                        className="w-full flex items-center justify-between px-3.5 py-1.5 hover:bg-[#1C202B] text-[#F0F3F8] hover:text-[#00F0FF] transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <FolderOpen size={14} className="text-[#8A92A6]" />
                          <span>Open Project (.idts)</span>
                        </div>
                        <span className="text-[10px] font-mono text-[#64748B]">Ctrl+O</span>
                      </button>

                      <button
                        type="button"
                        onClick={async () => {
                          setIsFileMenuOpen(false);
                          await saveProject(false);
                        }}
                        className="w-full flex items-center justify-between px-3.5 py-1.5 hover:bg-[#1C202B] text-[#F0F3F8] hover:text-[#00F0FF] transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <Save size={14} className="text-[#8A92A6]" />
                          <span>Save Project</span>
                        </div>
                        <span className="text-[10px] font-mono text-[#64748B]">Ctrl+S</span>
                      </button>

                      <button
                        type="button"
                        onClick={async () => {
                          setIsFileMenuOpen(false);
                          await saveProject(true);
                        }}
                        className="w-full flex items-center justify-between px-3.5 py-1.5 hover:bg-[#1C202B] text-[#F0F3F8] hover:text-[#00F0FF] transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <SaveAll size={14} className="text-[#8A92A6]" />
                          <span>Save Project As...</span>
                        </div>
                        <span className="text-[10px] font-mono text-[#64748B]">Ctrl+Shift+S</span>
                      </button>

                      <button
                        type="button"
                        onClick={async () => {
                          setIsFileMenuOpen(false);
                          await handleManualAutoSave();
                        }}
                        className="w-full flex items-center justify-between px-3.5 py-1.5 hover:bg-[#1C202B] text-[#F0F3F8] hover:text-[#00F0FF] transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <ShieldCheck size={14} className="text-[#10B981]" />
                          <span>Auto-Save Snapshot Now</span>
                        </div>
                      </button>

                      <div className="h-[1px] bg-[#222630] my-1" />

                      <button
                        type="button"
                        onClick={() => {
                          setIsFileMenuOpen(false);
                          setExportModalOpen(true);
                        }}
                        className="w-full flex items-center justify-between px-3.5 py-1.5 hover:bg-[#1C202B] text-[#00F0FF] transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <Upload size={14} className="text-[#00F0FF]" />
                          <span className="font-bold">Export Master Video...</span>
                        </div>
                        <span className="text-[10px] font-mono text-[#00F0FF]/80">Ctrl+E</span>
                      </button>
                    </>
                  )}

                  {/* EDIT TAB */}
                  {activeMenuTab === 'edit' && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setIsFileMenuOpen(false);
                          undo();
                        }}
                        className="w-full flex items-center justify-between px-3.5 py-1.5 hover:bg-[#1C202B] text-[#F0F3F8] hover:text-[#00F0FF] transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <Undo2 size={14} className="text-[#8A92A6]" />
                          <span>Undo</span>
                        </div>
                        <span className="text-[10px] font-mono text-[#64748B]">Ctrl+Z</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setIsFileMenuOpen(false);
                          redo();
                        }}
                        className="w-full flex items-center justify-between px-3.5 py-1.5 hover:bg-[#1C202B] text-[#F0F3F8] hover:text-[#00F0FF] transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <Redo2 size={14} className="text-[#8A92A6]" />
                          <span>Redo</span>
                        </div>
                        <span className="text-[10px] font-mono text-[#64748B]">Ctrl+Y</span>
                      </button>

                      <div className="h-[1px] bg-[#222630] my-1" />

                      <button
                        type="button"
                        onClick={() => {
                          setIsFileMenuOpen(false);
                          splitClipAtPlayhead();
                        }}
                        className="w-full flex items-center justify-between px-3.5 py-1.5 hover:bg-[#1C202B] text-[#F0F3F8] hover:text-[#00F0FF] transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <Scissors size={14} className="text-[#8A92A6]" />
                          <span>Split Clip at Playhead</span>
                        </div>
                        <span className="text-[10px] font-mono text-[#64748B]">Ctrl+K / C</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setIsFileMenuOpen(false);
                          rippleDeleteClip(selectedClipId || undefined);
                        }}
                        className="w-full flex items-center justify-between px-3.5 py-1.5 hover:bg-[#1C202B] text-[#F0F3F8] hover:text-[#00F0FF] transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <Trash2 size={14} className="text-[#8A92A6]" />
                          <span>Ripple Delete</span>
                        </div>
                        <span className="text-[10px] font-mono text-[#64748B]">Shift+Del</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setIsFileMenuOpen(false);
                          deleteSelectedClips();
                        }}
                        className="w-full flex items-center justify-between px-3.5 py-1.5 hover:bg-[#1C202B] text-[#F0F3F8] hover:text-[#00F0FF] transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <Trash2 size={14} className="text-[#8A92A6]" />
                          <span>Delete Selected</span>
                        </div>
                        <span className="text-[10px] font-mono text-[#64748B]">Del</span>
                      </button>

                      <div className="h-[1px] bg-[#222630] my-1" />

                      <button
                        type="button"
                        onClick={() => {
                          setIsFileMenuOpen(false);
                          openSettingsModal();
                        }}
                        className="w-full flex items-center justify-between px-3.5 py-1.5 hover:bg-[#1C202B] text-[#F0F3F8] hover:text-[#00F0FF] transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <Settings size={14} className="text-[#8A92A6]" />
                          <span>Preferences & Shortcuts</span>
                        </div>
                        <span className="text-[10px] font-mono text-[#64748B]">Ctrl+,</span>
                      </button>
                    </>
                  )}

                  {/* VIEW TAB */}
                  {activeMenuTab === 'view' && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setIsFileMenuOpen(false);
                          toggleMediaPoolCollapsed();
                        }}
                        className="w-full flex items-center justify-between px-3.5 py-1.5 hover:bg-[#1C202B] text-[#F0F3F8] hover:text-[#00F0FF] transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <Film size={14} className="text-[#8A92A6]" />
                          <span>Toggle Media Pool</span>
                        </div>
                        <span className="text-[10px] font-mono text-[#64748B]">M</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setIsFileMenuOpen(false);
                          toggleInspectorCollapsed();
                        }}
                        className="w-full flex items-center justify-between px-3.5 py-1.5 hover:bg-[#1C202B] text-[#F0F3F8] hover:text-[#00F0FF] transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <Layers size={14} className="text-[#8A92A6]" />
                          <span>Toggle Inspector</span>
                        </div>
                        <span className="text-[10px] font-mono text-[#64748B]">I</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setIsFileMenuOpen(false);
                          resetWorkspaceLayout();
                        }}
                        className="w-full flex items-center justify-between px-3.5 py-1.5 hover:bg-[#1C202B] text-[#F0F3F8] hover:text-[#00F0FF] transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <RotateCcw size={14} className="text-[#8A92A6]" />
                          <span>Reset Workspace Layout</span>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setIsFileMenuOpen(false);
                          handleToggleFullscreen();
                        }}
                        className="w-full flex items-center justify-between px-3.5 py-1.5 hover:bg-[#1C202B] text-[#F0F3F8] hover:text-[#00F0FF] transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <Maximize2 size={14} className="text-[#8A92A6]" />
                          <span>Toggle Fullscreen</span>
                        </div>
                        <span className="text-[10px] font-mono text-[#64748B]">F11</span>
                      </button>
                    </>
                  )}

                  {/* HELP TAB */}
                  {activeMenuTab === 'help' && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setIsFileMenuOpen(false);
                          openSettingsModal();
                        }}
                        className="w-full flex items-center justify-between px-3.5 py-1.5 hover:bg-[#1C202B] text-[#F0F3F8] hover:text-[#00F0FF] transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <HelpCircle size={14} className="text-[#00F0FF]" />
                          <span>Keyboard Shortcuts Cheat Sheet</span>
                        </div>
                        <span className="text-[10px] font-mono text-[#64748B]">? / F1</span>
                      </button>

                      <button
                        type="button"
                        onClick={async () => {
                          setIsFileMenuOpen(false);
                          await fetchHealthStats();
                          setIsHealthModalOpen(true);
                        }}
                        className="w-full flex items-center justify-between px-3.5 py-1.5 hover:bg-[#1C202B] text-[#F0F3F8] hover:text-[#00F0FF] transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <Activity size={14} className="text-[#10B981]" />
                          <span>System Health & Sidecar Telemetry</span>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setIsFileMenuOpen(false);
                          setIsAboutModalOpen(true);
                        }}
                        className="w-full flex items-center justify-between px-3.5 py-1.5 hover:bg-[#1C202B] text-[#F0F3F8] hover:text-[#00F0FF] transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <Info size={14} className="text-[#8A92A6]" />
                          <span>About IDTS Video Editor</span>
                        </div>
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Center: CapCut Style Project Name (e.g. "1001", Click to Rename) */}
        <div className="flex items-center justify-center flex-1 mx-4 min-w-0 pointer-events-auto">
          {isEditingName ? (
            <input
              autoFocus
              type="text"
              value={tempName}
              onChange={(e) => setTempName(e.target.value)}
              onBlur={handleNameSubmit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleNameSubmit();
                if (e.key === 'Escape') setIsEditingName(false);
              }}
              className="bg-[#0A0C10] border border-[#00F0FF] rounded px-2 py-0.5 text-xs text-white text-center font-semibold focus:outline-hidden max-w-[200px]"
            />
          ) : (
            <div
              onClick={() => setIsEditingName(true)}
              className="px-2.5 py-0.5 rounded-md hover:bg-[#1C202B] cursor-pointer text-xs font-semibold text-[#D1D5DB] hover:text-white transition-colors truncate flex items-center gap-1.5"
              title="Click to rename project"
            >
              <span className="truncate">{project.name || '1001'}</span>
              {isDirty && <span className="text-amber-400 font-bold text-xs">*</span>}
            </div>
          )}
        </div>

        {/* Right: Layout Toggles, Share, Cyan Export Button & Window Controls (─ ❐ ✕) */}
        <div className="flex items-center gap-2 shrink-0 pointer-events-auto">
          {/* Workspace Layout Quick Toggles [⊟ ⌵] [🗖] */}
          <div className="flex items-center bg-[#151922] p-0.5 rounded-md border border-[#222735]">
            <button
              type="button"
              onClick={toggleMediaPoolCollapsed}
              className={`p-1 rounded transition-all cursor-pointer ${
                !isMediaPoolCollapsed ? 'text-[#00F0FF]' : 'text-[#64748B] hover:text-white'
              }`}
              title="Toggle Media Panel"
            >
              <PanelLeft size={12} />
            </button>
            <button
              type="button"
              onClick={toggleInspectorCollapsed}
              className={`p-1 rounded transition-all cursor-pointer ${
                !isInspectorCollapsed ? 'text-[#00F0FF]' : 'text-[#64748B] hover:text-white'
              }`}
              title="Toggle Inspector Panel"
            >
              <PanelRight size={12} />
            </button>
          </div>

          {/* Quick Multicam Sync / Share Button */}
          <button
            type="button"
            onClick={() => executeTauriSync()}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#161922] hover:bg-[#202534] border border-[#262C3C] text-[11px] font-medium text-[#CBD5E1] hover:text-[#00F0FF] transition-all cursor-pointer"
            title="Smart Multicam Track Synchronization"
          >
            <Share2 size={12} className="text-[#8E9CAE]" />
            <span>Share</span>
          </button>

          {/* CapCut Prominent Cyan "Export" Button */}
          <button
            type="button"
            onClick={() => setExportModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-1 bg-[#00F0FF] hover:bg-[#38BDF8] text-[#0D0E11] rounded-md text-xs font-extrabold transition-all shadow-[0_0_12px_rgba(0,240,255,0.4)] cursor-pointer"
            title="Export Video Project"
          >
            <Upload size={13} strokeWidth={2.8} />
            <span>Export</span>
          </button>

          {/* Divider */}
          <div className="w-[1px] h-3.5 bg-[#2B303C] mx-0.5" />

          {/* Window Control Buttons: Minimize (─), Maximize (❐), Close (✕) */}
          <div className="flex items-center">
            <button
              type="button"
              onClick={handleMinimize}
              className="w-7 h-7 flex items-center justify-center rounded text-[#8E9CAE] hover:text-white hover:bg-[#1E232E] transition-colors cursor-pointer"
              title="Minimize"
            >
              <Minus size={13} />
            </button>

            <button
              type="button"
              onClick={handleMaximize}
              className="w-7 h-7 flex items-center justify-center rounded text-[#8E9CAE] hover:text-white hover:bg-[#1E232E] transition-colors cursor-pointer"
              title="Maximize / Restore"
            >
              <Square size={11} />
            </button>

            <button
              type="button"
              onClick={handleClose}
              className="w-7 h-7 flex items-center justify-center rounded text-[#8E9CAE] hover:text-white hover:bg-[#EF4444] transition-colors cursor-pointer"
              title="Close"
            >
              <X size={13} />
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TIER 2: Workspace Category Tabs (Media, Audio, Text, Stickers, Filters...) */}
      {/* ========================================================================= */}
      <div className="h-9 bg-[#13151B] border-b border-[#20242E] flex items-center justify-between px-3 text-xs">
        {/* Navigation Category Tabs */}
        <nav className="flex items-center gap-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-semibold transition-all relative cursor-pointer ${
                  isActive
                    ? 'text-[#00F0FF] bg-[#1A1F29]'
                    : 'text-[#8E9CAE] hover:text-[#F0F3F8] hover:bg-[#181B22]'
                }`}
              >
                <Icon size={13} className={isActive ? 'text-[#00F0FF]' : 'text-[#64748B]'} />
                <span>{tab.label}</span>
                {isActive && (
                  <span className="absolute bottom-0 left-2 right-2 h-[2px] bg-[#00F0FF] rounded-full shadow-[0_0_6px_#00F0FF]" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Right side helpers: Sync Count badge & Settings */}
        <div className="flex items-center gap-2.5">
          {syncedCount > 0 && (
            <div className="flex items-center gap-1 text-[10px] font-mono text-[#10B981] bg-[#10B981]/10 px-2 py-0.5 rounded border border-[#10B981]/30">
              <Zap size={10} />
              <span>Synced {syncedCount}/{allClips.length}</span>
            </div>
          )}

          <button
            type="button"
            onClick={openSettingsModal}
            className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] text-[#8E9CAE] hover:text-white hover:bg-[#1E232E] transition-colors"
            title="Settings & Shortcuts"
          >
            <Settings size={12} />
            <span>Settings</span>
          </button>
        </div>
      </div>

      {/* Auto-Save Notice Toast */}
      {autoSaveNotice && (
        <div className="fixed top-12 left-1/2 -translate-x-1/2 z-50 bg-[#10B981]/20 border border-[#10B981]/50 text-[#10B981] text-xs font-mono px-4 py-1.5 rounded-full shadow-lg flex items-center gap-2 animate-in fade-in select-none">
          <CheckCircle2 size={14} />
          <span>{autoSaveNotice}</span>
        </div>
      )}

      {/* System Health & Sidecar Process Lifecycle Modal */}
      {isHealthModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-in fade-in duration-150 select-none">
          <div className="w-full max-w-lg bg-[#14161B] border border-[#222630] rounded-xl shadow-2xl overflow-hidden flex flex-col text-[#F0F3F8]">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#222630] bg-[#101217]">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30">
                  <Activity size={18} />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-[#F0F3F8]">System Health & Telemetry</h2>
                  <p className="text-[11px] text-[#64748B]">Active sidecars, hardware engine, and storage integrity</p>
                </div>
              </div>
              <button
                onClick={() => setIsHealthModalOpen(false)}
                className="p-1.5 rounded-lg text-[#8A92A6] hover:text-[#F0F3F8] hover:bg-[#222630] transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              {/* Active Sidecar Processes */}
              <div className="p-3.5 rounded-lg bg-[#0D0E11] border border-[#222630] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#F0F3F8] flex items-center gap-1.5">
                    <Cpu size={14} className="text-[#00F0FF]" />
                    <span>Sidecar Child Processes</span>
                  </span>
                  <span className="font-mono text-[11px] text-[#10B981] bg-[#10B981]/10 px-2 py-0.5 rounded border border-[#10B981]/30">
                    Active: {healthStats?.activeProcessCount ?? 0}
                  </span>
                </div>
                <p className="text-[11px] text-[#8A92A6]">
                  Total sidecars spawned this session: <span className="font-mono text-white">{healthStats?.totalSpawnedCount ?? 0}</span>
                </p>
                {healthStats && healthStats.activeSidecarPids.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {healthStats.activeSidecarPids.map((pid) => (
                      <span key={pid} className="font-mono text-[10px] bg-[#1A1E29] text-[#00F0FF] border border-[#00F0FF]/30 px-2 py-0.5 rounded">
                        PID {pid}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-[10px] text-[#64748B] italic">No active background sidecar processes running.</p>
                )}
              </div>

              {/* Hardware Acceleration Status */}
              <div className="p-3.5 rounded-lg bg-[#0D0E11] border border-[#222630] space-y-1.5">
                <span className="font-bold text-[#F0F3F8] flex items-center gap-1.5">
                  <Zap size={14} className="text-[#00F0FF]" />
                  <span>Hardware Video Acceleration</span>
                </span>
                <p className="text-[11px] text-[#8A92A6]">
                  GPU Scheduling: <span className="text-white font-medium">Discrete High-Performance dGPU Enabled</span>
                </p>
                <p className="text-[10px] text-[#64748B]">
                  Encoders: NVIDIA NVENC (CUDA hardware accelerated), Intel QuickSync (QSV), AMD AMF, CPU libx264 ultrafast.
                </p>
              </div>

              {/* Storage & Recovery Location */}
              <div className="p-3.5 rounded-lg bg-[#0D0E11] border border-[#222630] space-y-1">
                <span className="font-bold text-[#F0F3F8]">Crash Recovery & Auto-Save</span>
                <p className="text-[10px] text-[#64748B] leading-relaxed">
                  Atomic timeline snapshots are saved every 60 seconds to:{' '}
                  <code className="text-[#00F0FF] bg-[#1A1D24] px-1 py-0.5 rounded font-mono">
                    %LOCALAPPDATA%/idts-video-editor/recovery/
                  </code>
                </p>
              </div>
            </div>

            <div className="px-5 py-3 border-t border-[#222630] bg-[#101217] flex items-center justify-between">
              <button
                onClick={handleKillSidecars}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-400 text-xs font-semibold transition-colors cursor-pointer"
                title="Force kill all active FFmpeg/Whisper child processes"
              >
                <Trash2 size={13} />
                <span>Kill Lingering Sidecars</span>
              </button>
              <button
                onClick={() => setIsHealthModalOpen(false)}
                className="px-4 py-1.5 rounded-lg bg-[#1F2430] hover:bg-[#282F3F] text-xs font-semibold text-white transition-colors cursor-pointer border border-[#2B3245]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* About IDTS Video Editor Modal */}
      {isAboutModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-in fade-in duration-150 select-none">
          <div className="w-full max-w-md bg-[#14161B] border border-[#222630] rounded-xl shadow-2xl overflow-hidden flex flex-col text-[#F0F3F8]">
            <div className="p-6 flex flex-col items-center text-center space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-[#00F0FF] flex items-center justify-center text-black font-black shadow-[0_0_20px_rgba(0,240,255,0.4)]">
                <Film size={28} strokeWidth={2.5} />
              </div>
              <div>
                <h2 className="text-base font-extrabold text-[#F0F3F8]">
                  <span className="text-[#00F0FF]">IDTS</span> video editor
                </h2>
                <p className="text-xs text-[#8A92A6] mt-0.5 font-mono">Version 0.1.0 (Production Hardened)</p>
              </div>
              <p className="text-xs text-[#8A92A6] leading-relaxed max-w-xs">
                A high-performance desktop video editor built with Tauri 2.0, Rust, React 19, TypeScript, and hardware-accelerated FFmpeg 7.0 sidecars.
              </p>
              <div className="w-full pt-2 border-t border-[#222630] grid grid-cols-2 gap-2 text-left text-[11px] text-[#8A92A6]">
                <div className="p-2 rounded bg-[#0D0E11] border border-[#222630]">
                  <span className="block font-semibold text-white">Native Core</span>
                  <span>Tauri 2.0 / Rust</span>
                </div>
                <div className="p-2 rounded bg-[#0D0E11] border border-[#222630]">
                  <span className="block font-semibold text-white">Graphics & Render</span>
                  <span>NVENC / QSV / WebGL</span>
                </div>
              </div>
            </div>
            <div className="px-5 py-3 border-t border-[#222630] bg-[#101217] flex justify-end">
              <button
                onClick={() => setIsAboutModalOpen(false)}
                className="px-4 py-1.5 rounded-lg bg-[#00F0FF] hover:bg-[#3bf1ff] text-[#0D0E11] text-xs font-bold transition-all shadow-[0_0_10px_rgba(0,240,255,0.3)] cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
