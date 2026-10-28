import React, { useState, useRef, useEffect } from 'react';
import {
  Film,
  Music,
  Type,
  Sticker,
  Sparkles,
  Split,
  Filter,
  Download,
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
} from 'lucide-react';
import { PanelLeft, PanelRight } from '@/components/Icons';
import { useShallow } from 'zustand/react/shallow';
import { useTimelineStore } from '../../store/timelineStore';
import { useShortcutStore } from '../../store/shortcutStore';

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
    }))
  );

  const { openSettingsModal } = useShortcutStore();

  const [isFileMenuOpen, setIsFileMenuOpen] = useState(false);
  const fileMenuRef = useRef<HTMLDivElement>(null);

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

  const allClips = tracks.flatMap((t) => t.clips);
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

  const currentFileName = currentProjectPath
    ? currentProjectPath.split(/[\\/]/).pop() || `${project.name}.idts`
    : `${project.name || 'Untitled'}.idts`;

  return (
    <header className="h-11 bg-[#14161B] border-b border-[#222630] flex items-center justify-between px-3 select-none shrink-0 z-30">
      {/* LEFT: Branding Logo, File Menu & CapCut Style Tabs */}
      <div className="flex items-center gap-3">
        {/* "idts video editor" Branding & File Dropdown */}
        <div ref={fileMenuRef} className="relative">
          <button
            onClick={() => setIsFileMenuOpen(!isFileMenuOpen)}
            className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-[#181B22] hover:bg-[#1E222D] border border-[#222630] hover:border-[#00F0FF]/50 cursor-pointer transition-all text-[#F0F3F8]"
            title="File Menu (Project Operations)"
          >
            <div className="w-5 h-5 rounded bg-[#00F0FF] flex items-center justify-center text-[#0D0E11] font-black shadow-[0_0_8px_rgba(0,240,255,0.4)]">
              <Film size={12} strokeWidth={2.5} />
            </div>
            <div className="flex items-center gap-1">
              <span className="font-extrabold text-xs tracking-tight text-[#00F0FF]">idts</span>
              <span className="font-bold text-xs text-[#F0F3F8]">video editor</span>
            </div>
            <ChevronDown size={12} className={`text-[#64748B] transition-transform ${isFileMenuOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* File Menu Dropdown List */}
          {isFileMenuOpen && (
            <div className="absolute top-full left-0 mt-1.5 w-56 rounded-lg bg-[#14161B] border border-[#222630] shadow-2xl py-1 z-50 animate-in fade-in text-xs font-medium">
              <button
                onClick={() => {
                  setIsFileMenuOpen(false);
                  createNewProject();
                }}
                className="w-full flex items-center justify-between px-3.5 py-2 hover:bg-[#1C202B] text-[#F0F3F8] hover:text-[#00F0FF] transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <FilePlus size={14} className="text-[#8A92A6]" />
                  <span>New Project</span>
                </div>
              </button>

              <button
                onClick={async () => {
                  setIsFileMenuOpen(false);
                  await openProject();
                }}
                className="w-full flex items-center justify-between px-3.5 py-2 hover:bg-[#1C202B] text-[#F0F3F8] hover:text-[#00F0FF] transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <FolderOpen size={14} className="text-[#8A92A6]" />
                  <span>Open Project (.idts)</span>
                </div>
              </button>

              <button
                onClick={async () => {
                  setIsFileMenuOpen(false);
                  await saveProject(false);
                }}
                className="w-full flex items-center justify-between px-3.5 py-2 hover:bg-[#1C202B] text-[#F0F3F8] hover:text-[#00F0FF] transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Save size={14} className="text-[#8A92A6]" />
                  <span>Save Project</span>
                </div>
                <span className="text-[10px] font-mono text-[#64748B]">Ctrl+S</span>
              </button>

              <button
                onClick={async () => {
                  setIsFileMenuOpen(false);
                  await saveProject(true);
                }}
                className="w-full flex items-center justify-between px-3.5 py-2 hover:bg-[#1C202B] text-[#F0F3F8] hover:text-[#00F0FF] transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <SaveAll size={14} className="text-[#8A92A6]" />
                  <span>Save Project As...</span>
                </div>
              </button>

              <div className="h-[1px] bg-[#222630] my-1" />

              <button
                onClick={() => {
                  setIsFileMenuOpen(false);
                  setExportModalOpen(true);
                }}
                className="w-full flex items-center justify-between px-3.5 py-2 hover:bg-[#1C202B] text-[#00F0FF] transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Download size={14} className="text-[#00F0FF]" />
                  <span>Export Master...</span>
                </div>
              </button>
            </div>
          )}
        </div>

        <div className="h-4 w-[1px] bg-[#222630]" />

        {/* Top Category Tabs (Media, Audio, Text, Stickers, Effects, Transition, Filters) */}
        <nav className="flex items-center gap-0.5">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold transition-all relative cursor-pointer ${
                  isActive
                    ? 'text-[#00F0FF] bg-[#1A1E27]'
                    : 'text-[#8A92A6] hover:text-[#F0F3F8] hover:bg-[#181B22]'
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
      </div>

      {/* CENTER: App & Project Title with Dirty Indicator */}
      <div className="flex items-center gap-2 text-center">
        <span className="text-xs font-semibold text-[#F0F3F8] flex items-center gap-1.5 font-mono">
          <span className="text-[#00F0FF]">idts</span>
          <span className="text-[#525D73]">—</span>
          <span>{currentFileName}</span>
          {isDirty && <span className="text-amber-400 font-bold">*</span>}
        </span>
        {isDirty ? (
          <span className="flex items-center gap-1 px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30 text-[9px] font-mono">
            Unsaved
          </span>
        ) : (
          <span className="flex items-center gap-1 px-1.5 py-0.2 rounded bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/30 text-[9px] font-mono">
            Saved
          </span>
        )}
      </div>

      {/* RIGHT: Multi-Sync, Shortcuts/Settings & Export */}
      <div className="flex items-center gap-2.5">
        {/* Quick Sync Pill */}
        <button
          onClick={() => executeTauriSync()}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#0D0E11] hover:bg-[#1A1D24] border border-[#222630] text-xs font-medium text-[#8A92A6] hover:text-[#00F0FF] transition-all cursor-pointer"
          title="Align all camera tracks using smart synchronization"
        >
          <Zap size={13} className="text-[#00F0FF]" />
          <span>Multicam:</span>
          <span className="text-[10px] font-mono text-[#10B981] font-bold">
            {syncedCount}/{allClips.length}
          </span>
        </button>

        {/* Workspace Layout Quick Toggles */}
        <div className="flex items-center gap-0.5 bg-[#0D0E11] p-0.5 rounded-md border border-[#222630]">
          <button
            onClick={toggleMediaPoolCollapsed}
            className={`p-1.5 rounded transition-all cursor-pointer ${
              !isMediaPoolCollapsed
                ? 'bg-[#1E222D] text-[#00F0FF] shadow-xs'
                : 'text-[#64748B] hover:text-[#F0F3F8]'
            }`}
            title={isMediaPoolCollapsed ? 'Show Media Pool (Ctrl+B)' : 'Hide Media Pool to maximize preview monitor'}
          >
            <PanelLeft size={13} />
          </button>
          <button
            onClick={toggleInspectorCollapsed}
            className={`p-1.5 rounded transition-all cursor-pointer ${
              !isInspectorCollapsed
                ? 'bg-[#1E222D] text-[#00F0FF] shadow-xs'
                : 'text-[#64748B] hover:text-[#F0F3F8]'
            }`}
            title={isInspectorCollapsed ? 'Show Inspector' : 'Hide Inspector to maximize preview monitor'}
          >
            <PanelRight size={13} />
          </button>
          <button
            onClick={resetWorkspaceLayout}
            className="p-1.5 rounded text-[#64748B] hover:text-[#00F0FF] hover:bg-[#1E222D] transition-colors cursor-pointer"
            title="Reset Workspace Layout & Track Heights to Default"
          >
            <RotateCcw size={12} />
          </button>
        </div>

        {/* Preferences & Shortcuts Modal Button */}
        <button
          onClick={openSettingsModal}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#1A1D24] hover:bg-[#222630] border border-[#222630] text-xs font-medium text-[#8A92A6] hover:text-[#00F0FF] transition-colors cursor-pointer"
          title="Open Settings & Keyboard Shortcuts Configuration"
        >
          <Settings size={13} />
          <span>Settings</span>
        </button>

        {/* CapCut Style Export Pill */}
        <button
          onClick={() => setExportModalOpen(true)}
          className="flex items-center gap-1.5 px-3.5 py-1 bg-[#00F0FF] hover:bg-[#3bf1ff] text-[#0D0E11] rounded-md text-xs font-bold transition-all shadow-[0_0_10px_rgba(0,240,255,0.3)] cursor-pointer"
          title="Open Hardware Render & Export Dialog"
        >
          <Download size={13} strokeWidth={2.5} />
          <span>Export Master</span>
        </button>
      </div>
    </header>
  );
};
