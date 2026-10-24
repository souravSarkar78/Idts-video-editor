import React, { useState, useRef, useEffect } from 'react';
import {
  Upload,
  Folder,
  FolderPlus,
  Film,
  Music,
  Video,
  Grid,
  List,
  Plus,
  Trash2,
  Clock,
  Sparkles,
  CheckCircle2,
  Search,
  SlidersHorizontal,
  FileCode,
  ChevronLeft,
  ChevronRight,
  Zap,
  RefreshCw,
  Split,
} from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useTimelineStore, isTauri, tauriInvoke } from '../../store/timelineStore';
import { MediaAsset } from '../../types/ipc';
import { MediaThumbnail } from './MediaThumbnail';
import { TransitionsPanel } from '../Transitions/TransitionsPanel';

export const MediaPool: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    bins,
    assets,
    activeBinId,
    setActiveBinId,
    createBin,
    renameBin,
    deleteBin,
    importFiles,
    importFromNativePaths,
    moveAssetToBin,
    deleteAsset,
    selectedAssetId,
    selectAsset,
    setDraggedAsset,
    setActiveDragAsset,
    addAssetToTrack,
    tracks,
    generateClipProxy,
    deleteClipProxy,
    proxyProgress,
    proxyStatus,
  } = useTimelineStore(
    useShallow((state) => ({
      activeTab: state.activeTab,
      setActiveTab: state.setActiveTab,
      bins: state.bins,
      assets: state.assets,
      activeBinId: state.activeBinId,
      setActiveBinId: state.setActiveBinId,
      createBin: state.createBin,
      renameBin: state.renameBin,
      deleteBin: state.deleteBin,
      importFiles: state.importFiles,
      importFromNativePaths: state.importFromNativePaths,
      moveAssetToBin: state.moveAssetToBin,
      deleteAsset: state.deleteAsset,
      selectedAssetId: state.selectedAssetId,
      selectAsset: state.selectAsset,
      setDraggedAsset: state.setDraggedAsset,
      setActiveDragAsset: state.setActiveDragAsset,
      addAssetToTrack: state.addAssetToTrack,
      tracks: state.tracks,
      generateClipProxy: state.generateClipProxy,
      deleteClipProxy: state.deleteClipProxy,
      proxyProgress: state.proxyProgress,
      proxyStatus: state.proxyStatus,
    }))
  );

  const [isCreatingBin, setIsCreatingBin] = useState(false);
  const [newBinName, setNewBinName] = useState('');
  const [editingBinId, setEditingBinId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [editingBinName, setEditingBinName] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [createProxiesNow, setCreateProxiesNow] = useState(false);
  const [assetContextMenu, setAssetContextMenu] = useState<{
    x: number;
    y: number;
    asset: MediaAsset;
  } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'video' | 'audio'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  // Close context menu on window click
  useEffect(() => {
    const handleCloseMenu = () => setAssetContextMenu(null);
    window.addEventListener('click', handleCloseMenu);
    return () => window.removeEventListener('click', handleCloseMenu);
  }, []);

  // Filter assets based on active bin, search, and type
  const filteredAssets = assets.filter((asset) => {
    // Bin filter
    if (activeBinId !== 'all' && asset.binId !== activeBinId) {
      return false;
    }
    // Search query
    if (searchQuery && !asset.name.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    // Type filter
    if (filterType === 'video' && asset.mediaType !== 'video') return false;
    if (filterType === 'audio' && asset.mediaType !== 'audio') return false;
    return true;
  });

  const handleCreateBin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBinName.trim()) return;
    createBin(newBinName.trim());
    setNewBinName('');
    setIsCreatingBin(false);
  };

  const handleRenameBinSubmit = (e: React.FormEvent, binId: string) => {
    e.preventDefault();
    if (editingBinName.trim()) {
      renameBin(binId, editingBinName.trim());
    }
    setEditingBinId(null);
  };

  const handleNativeImportFiles = async () => {
    setIsImporting(true);
    try {
      if (isTauri) {
        const paths = await tauriInvoke<string[]>('open_file_dialog');
        if (paths && paths.length > 0) {
          await importFromNativePaths(paths);
          setIsImporting(false);
          return;
        }
      }
      fileInputRef.current?.click();
    } catch {
      fileInputRef.current?.click();
    } finally {
      setIsImporting(false);
    }
  };

  const handleNativeImportFolder = async () => {
    setIsImporting(true);
    try {
      if (isTauri) {
        const paths = await tauriInvoke<string[]>('open_folder_dialog');
        if (paths && paths.length > 0) {
          await importFromNativePaths(paths);
          setIsImporting(false);
          return;
        }
      }
      folderInputRef.current?.click();
    } catch {
      folderInputRef.current?.click();
    } finally {
      setIsImporting(false);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      importFiles(e.target.files);
    }
  };

  const formatSeconds = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = Math.floor(sec % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStartMouseDrag = (startEvent: React.MouseEvent, asset: MediaAsset) => {
    if (startEvent.button !== 0) return;
    const target = startEvent.target as HTMLElement;
    if (target.closest('button') || target.closest('input')) return;

    const startX = startEvent.clientX;
    const startY = startEvent.clientY;
    let hasInitiatedDrag = false;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const dist = Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY);
      if (!hasInitiatedDrag && dist > 4) {
        hasInitiatedDrag = true;
        setDraggedAsset(asset);
        document.body.style.cursor = 'grabbing';
        document.body.style.userSelect = 'none';
      }
      if (hasInitiatedDrag) {
        moveEvent.preventDefault();
        setActiveDragAsset({
          asset,
          mouseX: moveEvent.clientX,
          mouseY: moveEvent.clientY,
        });
      }
    };

    const onMouseUp = (upEvent: MouseEvent) => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';

      if (hasInitiatedDrag) {
        // Prevent click event trigger right after dragging
        const captureClick = (e: MouseEvent) => {
          e.stopPropagation();
          e.preventDefault();
          window.removeEventListener('click', captureClick, true);
        };
        window.addEventListener('click', captureClick, true);

        const dropX = upEvent.clientX;
        const dropY = upEvent.clientY;
        const elem = document.elementFromPoint(dropX, dropY);
        const trackLane = elem?.closest('[data-track-id]');
        const trackHeader = elem?.closest('[data-track-header-id]');
        const timelineArea =
          elem?.closest('[data-timeline-container]') ||
          elem?.closest('[data-timeline-scroll]');
        const binElem = elem?.closest('[data-bin-id]');

        const store = useTimelineStore.getState();
        const currentTracks = store.tracks;
        const currentPlayhead = store.playhead;
        const currentZoom = store.zoom;

        if (binElem) {
          const binId = binElem.getAttribute('data-bin-id');
          if (binId && binId !== 'all') {
            moveAssetToBin(asset.id, binId);
          }
        } else if (trackLane) {
          const trackId = trackLane.getAttribute('data-track-id');
          const scrollElem = document.querySelector('[data-timeline-scroll]');
          let targetSec = currentPlayhead;
          if (scrollElem) {
            const rect = scrollElem.getBoundingClientRect();
            const scrollLeft = scrollElem.scrollLeft;
            const rawSec = Math.max(0, (dropX - rect.left + scrollLeft) / currentZoom);
            targetSec = store.isSnappingEnabled
              ? store.calculateSnappedPosition(rawSec, asset.durationSeconds || 10, 'new_clip', currentZoom)
              : rawSec;
          }
          if (trackId) {
            store.addAssetToTrack(asset.id, trackId, targetSec);
          }
        } else if (trackHeader) {
          const trackId = trackHeader.getAttribute('data-track-header-id');
          if (trackId) {
            store.addAssetToTrack(asset.id, trackId, currentPlayhead);
          }
        } else if (timelineArea) {
          const scrollElem = document.querySelector('[data-timeline-scroll]');
          let targetSec = currentPlayhead;
          if (scrollElem) {
            const rect = scrollElem.getBoundingClientRect();
            const scrollLeft = scrollElem.scrollLeft;
            const rawSec = Math.max(0, (dropX - rect.left + scrollLeft) / currentZoom);
            targetSec = store.isSnappingEnabled
              ? store.calculateSnappedPosition(rawSec, asset.durationSeconds || 10, 'new_clip', currentZoom)
              : rawSec;
          }
          const matchingTrack =
            currentTracks.find((t) => (t.trackType || t.type) === asset.mediaType) || currentTracks[0];
          if (matchingTrack) {
            store.addAssetToTrack(asset.id, matchingTrack.id, targetSec);
          } else {
            const newId = store.addTrack(asset.mediaType === 'audio' ? 'audio' : 'video');
            store.addAssetToTrack(asset.id, newId, targetSec);
          }
        }

        setActiveDragAsset(null);
        setDraggedAsset(null);
      }
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const handleBinDrop = (e: React.DragEvent, binId: string) => {
    e.preventDefault();
    try {
      const dataStr = e.dataTransfer.getData('application/json');
      if (!dataStr) return;
      const { assetId } = JSON.parse(dataStr);
      if (assetId) {
        moveAssetToBin(assetId, binId);
      }
    } catch {
      // ignore
    }
  };

  const handleQuickAdd = (asset: MediaAsset) => {
    const targetTrack =
      tracks.find((t) => (t.trackType || t.type) === asset.mediaType) || tracks[0];
    if (targetTrack) {
      addAssetToTrack(asset.id, targetTrack.id);
    }
  };

  if (activeTab === 'transitions') {
    return (
      <div className="flex-1 flex flex-col overflow-hidden bg-[#14161B] border-r border-[#222630] select-none">
        <div className="h-9 px-2 bg-[#101217] border-b border-[#222630] flex items-center gap-1 shrink-0">
          <button
            onClick={() => setActiveTab('media')}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold text-[#8A92A6] hover:text-[#F0F3F8] hover:bg-[#1A1D24] transition-colors cursor-pointer"
          >
            <Film size={12} />
            <span>Media Pool</span>
          </button>
          <button
            onClick={() => setActiveTab('transitions')}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold bg-[#1C212B] text-[#A855F7] border border-[#A855F7]/30 transition-colors cursor-pointer"
          >
            <Split size={12} />
            <span>Transitions</span>
          </button>
        </div>
        <TransitionsPanel />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#14161B] border-r border-[#222630] select-none">
      {/* Top Tab Bar: Media Pool vs Transitions */}
      <div className="h-9 px-2 bg-[#101217] border-b border-[#222630] flex items-center gap-1 shrink-0">
        <button
          onClick={() => setActiveTab('media')}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold bg-[#1C212B] text-[#00F0FF] border border-[#00F0FF]/30 transition-colors cursor-pointer"
        >
          <Film size={12} />
          <span>Media Pool</span>
        </button>
        <button
          onClick={() => setActiveTab('transitions')}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold text-[#8A92A6] hover:text-[#F0F3F8] hover:bg-[#1A1D24] transition-colors cursor-pointer"
        >
          <Split size={12} />
          <span>Transitions</span>
        </button>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Hidden File Inputs for Web Fallback Action */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileInputChange}
          multiple
          accept="video/*,audio/*"
          className="hidden"
        />
        <input
          type="file"
          ref={folderInputRef}
          onChange={handleFileInputChange}
          {...({ webkitdirectory: '', directory: '' } as any)}
          className="hidden"
        />

      {/* SUB-SIDEBAR: Local, Library & Bins */}
      {isSidebarOpen && (
        <div className="w-36 shrink-0 bg-[#0F1116] border-r border-[#222630] flex flex-col p-2">
          {/* Top category label & collapse button */}
          <div className="flex items-center justify-between px-1.5 py-1 mb-1 text-[#00F0FF] text-xs font-semibold">
            <div className="flex items-center gap-1.5 truncate">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00F0FF] shadow-[0_0_6px_#00F0FF] shrink-0" />
              <span className="truncate">Local Media</span>
            </div>
            <button
              onClick={() => setIsSidebarOpen(false)}
              className="p-1 rounded hover:bg-[#1E222D] text-[#64748B] hover:text-[#F0F3F8] transition-colors"
              title="Collapse Bins Sidebar"
            >
              <ChevronLeft size={13} />
            </button>
          </div>

          {/* Bins List Header */}
          <div className="flex items-center justify-between px-1.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#64748B] mt-0.5 mb-1">
            <span>Folders / Bins</span>
            <button
              onClick={() => setIsCreatingBin(true)}
              title="Create New Bin"
              className="p-1 rounded hover:bg-[#222630] text-[#8A92A6] hover:text-[#00F0FF] transition-colors"
            >
              <FolderPlus size={13} />
            </button>
          </div>

        {/* Create Bin Input Form */}
        {isCreatingBin && (
          <form onSubmit={handleCreateBin} className="mb-2 px-1">
            <input
              type="text"
              autoFocus
              placeholder="Bin name..."
              value={newBinName}
              onChange={(e) => setNewBinName(e.target.value)}
              onBlur={() => {
                if (!newBinName.trim()) setIsCreatingBin(false);
              }}
              className="w-full px-2 py-1 text-xs bg-[#1A1D24] border border-[#00F0FF]/50 rounded text-[#F0F3F8] focus:outline-none"
            />
          </form>
        )}

        {/* Bins List with Drag Target & Inline Rename Support */}
        <div className="flex-1 overflow-y-auto space-y-0.5">
          {bins.map((bin) => {
            const count =
              bin.id === 'all'
                ? assets.length
                : assets.filter((a) => a.binId === bin.id).length;
            const isActive = activeBinId === bin.id;
            const isEditing = editingBinId === bin.id;

            return (
              <div
                key={bin.id}
                onClick={() => setActiveBinId(bin.id)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => handleBinDrop(e, bin.id)}
                className={`flex items-center justify-between px-2.5 py-1.5 rounded-md cursor-pointer text-xs font-medium transition-all group ${
                  isActive
                    ? 'bg-[#1C212B] text-[#00F0FF] border-l-2 border-[#00F0FF]'
                    : 'text-[#8A92A6] hover:bg-[#161920] hover:text-[#F0F3F8]'
                }`}
                title="Click to view bin, or drag media here to move"
              >
                <div className="flex items-center gap-2 truncate flex-1 mr-1">
                  <Folder
                    size={14}
                    className={isActive ? 'text-[#00F0FF]' : 'text-[#64748B] group-hover:text-[#F0F3F8]'}
                  />
                  {isEditing ? (
                    <form
                      onSubmit={(e) => handleRenameBinSubmit(e, bin.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="flex-1"
                    >
                      <input
                        type="text"
                        autoFocus
                        value={editingBinName}
                        onChange={(e) => setEditingBinName(e.target.value)}
                        onBlur={() => setEditingBinId(null)}
                        className="w-full px-1 py-0.5 text-xs bg-[#1A1D24] border border-[#00F0FF] rounded text-white"
                      />
                    </form>
                  ) : (
                    <span
                      onDoubleClick={() => {
                        if (bin.id !== 'all') {
                          setEditingBinId(bin.id);
                          setEditingBinName(bin.name);
                        }
                      }}
                      className="truncate"
                    >
                      {bin.name}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-[10px] font-mono text-[#64748B] bg-[#0A0B0E] px-1.5 py-0.2 rounded">
                    {count}
                  </span>
                  {bin.id !== 'all' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteBin(bin.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-red-400 transition-opacity"
                      title="Delete Bin"
                    >
                      <Trash2 size={11} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Quick import helper at bottom of sidebar */}
        <div className="pt-2 border-t border-[#222630] space-y-1">
          <button
            onClick={handleNativeImportFolder}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 px-2 bg-[#1A1D24] hover:bg-[#222630] border border-[#222630] rounded text-[11px] font-medium text-[#8A92A6] hover:text-[#F0F3F8] transition-colors"
            title="Import entire directory recursively"
          >
            <Folder size={12} />
            <span>Import Folder</span>
          </button>
        </div>
      </div>
      )}

      {/* MAIN ASSET POOL AREA */}
      <div className="flex-1 flex flex-col overflow-hidden bg-[#14161B]">
        {/* Pool Toolbar: Import Buttons, Filters, Search & View Toggle */}
        <div className="h-11 border-b border-[#222630] px-3 flex items-center justify-between gap-3 shrink-0 bg-[#121419]">
          {/* CapCut Style Import CTA Buttons */}
          <div className="flex items-center gap-2">
            {!isSidebarOpen && (
              <button
                onClick={() => setIsSidebarOpen(true)}
                className="p-1.5 rounded bg-[#1A1D24] hover:bg-[#222630] border border-[#222630] text-[#8A92A6] hover:text-[#00F0FF] transition-colors mr-0.5"
                title="Show Bins & Folders"
              >
                <ChevronRight size={13} />
              </button>
            )}

            <button
              onClick={handleNativeImportFiles}
              disabled={isImporting}
              className="flex items-center gap-1.5 px-3 py-1 bg-[#00F0FF] hover:bg-[#34f3ff] text-[#0D0E11] rounded text-xs font-bold transition-all shadow-[0_0_8px_rgba(0,240,255,0.3)] cursor-pointer"
              title="Open Native Windows File Picker"
            >
              <Plus size={14} strokeWidth={3} />
              <span>{isImporting ? 'Probing...' : 'Import Files'}</span>
            </button>

            <button
              onClick={handleNativeImportFolder}
              disabled={isImporting}
              className="flex items-center gap-1.5 px-2.5 py-1 bg-[#1A1D24] hover:bg-[#222630] border border-[#222630] text-[#F0F3F8] rounded text-xs font-medium transition-colors cursor-pointer"
              title="Select folder to import and probe all clips"
            >
              <Folder size={12} className="text-[#00F0FF]" />
              <span>Folder</span>
            </button>

            {/* Optional Proxy Import Checkbox */}
            <label
              className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#181B22] border border-[#222630] text-[11px] text-[#8A92A6] hover:text-[#F0F3F8] cursor-pointer select-none whitespace-nowrap shrink-0 transition-colors"
              title="When checked, imported video files will automatically transcode lightweight editing proxies in the background"
            >
              <input
                type="checkbox"
                checked={createProxiesNow}
                onChange={(e) => {
                  setCreateProxiesNow(e.target.checked);
                  (window as any).__IDTS_AUTO_GEN_PROXIES__ = e.target.checked;
                }}
                className="rounded bg-[#0D0E11] border-[#222630] text-[#00F0FF] focus:ring-0 cursor-pointer w-3.5 h-3.5 accent-[#00F0FF] shrink-0"
              />
              <span className="whitespace-nowrap">Create proxies on import</span>
            </label>

            {/* Filter Pills */}
            <div className="flex items-center bg-[#0D0E11] p-0.5 rounded border border-[#222630] text-[11px]">
              <button
                onClick={() => setFilterType('all')}
                className={`px-2 py-0.5 rounded font-medium transition-colors ${
                  filterType === 'all'
                    ? 'bg-[#222630] text-[#00F0FF]'
                    : 'text-[#8A92A6] hover:text-[#F0F3F8]'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilterType('video')}
                className={`px-2 py-0.5 rounded font-medium transition-colors ${
                  filterType === 'video'
                    ? 'bg-[#222630] text-[#00F0FF]'
                    : 'text-[#8A92A6] hover:text-[#F0F3F8]'
                }`}
              >
                Videos
              </button>
              <button
                onClick={() => setFilterType('audio')}
                className={`px-2 py-0.5 rounded font-medium transition-colors ${
                  filterType === 'audio'
                    ? 'bg-[#222630] text-[#00F0FF]'
                    : 'text-[#8A92A6] hover:text-[#F0F3F8]'
                }`}
              >
                Audio
              </button>
            </div>
          </div>

          {/* Right Toolbar: Search & Grid/List view toggle */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#64748B]" />
              <input
                type="text"
                placeholder="Search clips..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-28 focus:w-40 transition-all pl-7 pr-2 py-1 text-[11px] bg-[#0D0E11] border border-[#222630] rounded text-[#F0F3F8] placeholder-[#64748B] focus:outline-none focus:border-[#00F0FF]/50"
              />
            </div>

            <div className="flex items-center bg-[#0D0E11] rounded border border-[#222630] p-0.5 text-[#8A92A6]">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1 rounded ${viewMode === 'grid' ? 'bg-[#222630] text-[#00F0FF]' : 'hover:text-[#F0F3F8]'}`}
                title="Grid View"
              >
                <Grid size={13} />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-1 rounded ${viewMode === 'list' ? 'bg-[#222630] text-[#00F0FF]' : 'hover:text-[#F0F3F8]'}`}
                title="List View"
              >
                <List size={13} />
              </button>
            </div>
          </div>
        </div>

        {/* ASSET ITEMS CONTAINER */}
        <div className="flex-1 overflow-y-auto p-3">
          {filteredAssets.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-[#64748B]">
              <div className="w-12 h-12 rounded-full bg-[#181B22] border border-[#222630] flex items-center justify-center mb-3 text-[#00F0FF]">
                <Upload size={22} />
              </div>
              <div className="text-sm font-semibold text-[#8A92A6]">No media in this bin</div>
              <div className="text-xs text-[#525D73] mt-1 max-w-[200px]">
                Click <span className="text-[#00F0FF] font-semibold">Import</span> or drag video/audio files from your explorer
              </div>
            </div>
          ) : viewMode === 'grid' ? (
            /* COMPACT PROFESSIONAL MEDIA GRID */
            <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2.5">
              {filteredAssets.map((asset) => {
                const isSelected = selectedAssetId === asset.id;
                const isVideo = asset.mediaType === 'video';
                
                const resBadge = isVideo
                  ? asset.height
                    ? asset.height >= 2160 || (asset.width && asset.width >= 3840)
                      ? '4K'
                      : `${asset.height}p`
                    : '1080p'
                  : `${asset.sampleRate ? Math.round(asset.sampleRate / 1000) : 48}kHz`;

                const fpsBadge = isVideo
                  ? `${Math.round(asset.framerate || 30)}fps`
                  : 'Audio';

                const durationStr = formatSeconds(asset.durationSeconds);

                return (
                  <div
                    key={asset.id}
                    onMouseDown={(e) => handleStartMouseDrag(e, asset)}
                    onDoubleClick={() => handleQuickAdd(asset)}
                    onClick={() => selectAsset(asset.id)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setAssetContextMenu({ x: e.clientX, y: e.clientY, asset });
                    }}
                    title={`File: ${asset.name}\nResolution: ${resBadge}\nFPS: ${fpsBadge}\nDuration: ${durationStr}\n(Right-click for Proxy options, double-click or drag to add to timeline)`}
                    className={`group relative flex flex-col rounded-md overflow-hidden bg-[#0D0E11] border transition-all cursor-grab active:cursor-grabbing hover:border-[#00F0FF]/80 hover:shadow-[0_0_16px_rgba(0,240,255,0.2)] ${
                      isSelected ? 'border-[#00F0FF] ring-1 ring-[#00F0FF]' : 'border-[#222630]'
                    }`}
                  >
                    {/* Thumbnail Image Container with Live Horizontal Hover Scrubbing */}
                    <div className="relative aspect-video w-full bg-[#1A1D24] overflow-hidden flex items-center justify-center">
                      <MediaThumbnail
                        filePath={asset.filePath}
                        mediaType={asset.mediaType}
                        durationSeconds={asset.durationSeconds}
                        name={asset.name}
                      />

                      {/* Top-Left Badges (PROX / Transcoding Progress) */}
                      <div className="absolute top-1.5 left-1.5 flex items-center gap-1 z-30 pointer-events-none">
                        {asset.hasProxy && (
                          <span
                            className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-[#10B981] text-[#0D0E11] shadow-md"
                            title="Editing proxy ready for smooth playback"
                          >
                            PROX
                          </span>
                        )}
                        {proxyStatus[asset.filePath] === 'transcoding' && (
                          <span
                            className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-[#00F0FF] text-[#0D0E11] shadow-md animate-pulse flex items-center gap-1"
                            title="Transcoding proxy..."
                          >
                            <RefreshCw size={9} className="animate-spin" />
                            <span>PROX {Math.round(proxyProgress[asset.filePath] || 0)}%</span>
                          </span>
                        )}
                      </div>

                      {/* On Hover: Clean Filename Overlay Banner at Bottom */}
                      <div
                        className="absolute bottom-0 inset-x-0 pl-2 pr-8 pt-4 pb-1 bg-gradient-to-t from-black/95 via-black/75 to-transparent text-[10px] font-medium text-white truncate opacity-0 group-hover:opacity-100 transition-opacity z-20 pointer-events-none"
                        title={asset.name}
                      >
                        {asset.name}
                      </div>

                      {/* Quick Add Button on Hover (Bottom-Right corner) */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleQuickAdd(asset);
                        }}
                        className="absolute bottom-1.5 right-1.5 p-1 rounded-full bg-[#00F0FF] text-[#0D0E11] hover:scale-110 transition-transform shadow-lg opacity-0 group-hover:opacity-100 z-30 cursor-pointer"
                        title="Add to Timeline Track"
                      >
                        <Plus size={12} strokeWidth={3} />
                      </button>
                    </div>

                    {/* Compact Footer: ONLY Resolution, FPS, and Duration */}
                    <div className="px-2 py-1.5 flex items-center justify-between text-[10px] font-mono bg-[#0C0E12] border-t border-[#1C202B]">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="text-[#00F0FF] font-medium">{resBadge}</span>
                        <span className="text-[#64748B]">•</span>
                        <span className="text-[#94A3B8]">{fpsBadge}</span>
                      </div>
                      <span className="text-[#F0F3F8] font-semibold shrink-0 ml-1">{durationStr}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* LIST VIEW */
            <div className="space-y-1">
              {filteredAssets.map((asset) => {
                const isSelected = selectedAssetId === asset.id;
                const isVideo = asset.mediaType === 'video';

                return (
                  <div
                    key={asset.id}
                    onMouseDown={(e) => handleStartMouseDrag(e, asset)}
                    onDoubleClick={() => handleQuickAdd(asset)}
                    onClick={() => selectAsset(asset.id)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setAssetContextMenu({ x: e.clientX, y: e.clientY, asset });
                    }}
                    title={`File: ${asset.name}\nPath: ${asset.filePath}\nDuration: ${formatSeconds(asset.durationSeconds)} (${asset.durationSeconds}s)\nType: ${asset.mediaType.toUpperCase()}\n(Right-click for Proxy options, double-click or drag to add to timeline)`}
                    className={`group relative flex items-center justify-between px-3 py-2 rounded-md bg-[#0D0E11] border transition-all cursor-grab active:cursor-grabbing hover:border-[#00F0FF]/60 hover:bg-[#161922] ${
                      isSelected ? 'border-[#00F0FF] bg-[#161922]' : 'border-[#222630]'
                    }`}
                  >
                    <div className="flex items-center gap-3 truncate flex-1 min-w-0 pr-3">
                      <div className="w-12 h-8 rounded bg-[#1A1D24] overflow-hidden shrink-0 flex items-center justify-center relative">
                        <MediaThumbnail
                          filePath={asset.filePath}
                          mediaType={asset.mediaType}
                          durationSeconds={asset.durationSeconds}
                          name={asset.name}
                        />
                        {asset.hasProxy && (
                          <div className="absolute top-0.5 left-0.5 px-1 py-0.2 rounded text-[7px] font-bold bg-[#10B981] text-[#0D0E11]">
                            PROX
                          </div>
                        )}
                      </div>
                      <div className="truncate flex-1 min-w-0">
                        <div className="text-xs font-semibold text-[#F0F3F8] group-hover:text-[#00F0FF] truncate group-hover:whitespace-normal group-hover:break-all transition-colors flex items-center gap-1.5">
                          <span>{asset.name}</span>
                          {asset.hasProxy && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-[#10B981]/25 text-[#10B981] border border-[#10B981]/40">
                              PROX
                            </span>
                          )}
                          {proxyStatus[asset.filePath] === 'transcoding' && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-[#00F0FF]/25 text-[#00F0FF] border border-[#00F0FF]/40 animate-pulse flex items-center gap-1">
                              <RefreshCw size={8} className="animate-spin" />
                              <span>PROX {Math.round(proxyProgress[asset.filePath] || 0)}%</span>
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-[#64748B] font-mono truncate group-hover:whitespace-normal group-hover:break-all">
                          {asset.filePath}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 text-xs font-mono text-[#8A92A6] shrink-0">
                      <span>{formatSeconds(asset.durationSeconds)}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleQuickAdd(asset);
                        }}
                        className="p-1 rounded bg-[#1A1D24] hover:bg-[#00F0FF] hover:text-[#0D0E11] text-[#00F0FF] transition-colors cursor-pointer"
                        title="Add to Timeline Track"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Floating Asset Context Menu */}
      {assetContextMenu && (
        <div
          style={{
            left: `${Math.min(window.innerWidth - 220, Math.max(10, assetContextMenu.x))}px`,
            top: `${Math.min(window.innerHeight - 200, Math.max(10, assetContextMenu.y))}px`,
          }}
          className="fixed z-[99999] min-w-[210px] bg-[#14161B]/95 border border-[#2B3040] rounded-lg shadow-2xl py-1.5 text-xs text-[#F0F3F8] font-medium backdrop-blur-md animate-in fade-in select-none ring-1 ring-white/10"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-3 py-1 text-[10px] font-mono text-[#64748B] border-b border-[#222630] truncate">
            {assetContextMenu.asset.name}
          </div>

          {assetContextMenu.asset.mediaType === 'video' && (
            <>
              {assetContextMenu.asset.hasProxy ? (
                <button
                  onClick={() => {
                    deleteClipProxy(assetContextMenu.asset.filePath);
                    setAssetContextMenu(null);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-red-500/15 text-red-400 transition-colors cursor-pointer text-left"
                >
                  <Trash2 size={13} />
                  <span>Delete Proxy File</span>
                </button>
              ) : (
                <button
                  onClick={() => {
                    generateClipProxy(assetContextMenu.asset.filePath);
                    setAssetContextMenu(null);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-[#1C202B] text-[#00F0FF] hover:text-[#3bf1ff] transition-colors cursor-pointer text-left"
                >
                  <Zap size={13} className="text-[#00F0FF]" />
                  <span>Generate Proxy</span>
                </button>
              )}
              <div className="h-[1px] bg-[#222630] my-1" />
            </>
          )}

          <button
            onClick={() => {
              handleQuickAdd(assetContextMenu.asset);
              setAssetContextMenu(null);
            }}
            className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-[#1C202B] text-[#F0F3F8] transition-colors cursor-pointer text-left"
          >
            <Plus size={13} className="text-[#8A92A6]" />
            <span>Add to Timeline Track</span>
          </button>

          <button
            onClick={() => {
              deleteAsset(assetContextMenu.asset.id);
              setAssetContextMenu(null);
            }}
            className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-red-500/15 text-red-400 transition-colors cursor-pointer text-left"
          >
            <Trash2 size={13} />
            <span>Delete Asset</span>
          </button>
        </div>
      )}
      </div>
    </div>
  );
};
