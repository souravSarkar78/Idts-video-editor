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
  Loader2,
  AlertCircle,
  ZoomIn,
  ZoomOut,
  X,
} from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useTimelineStore, isTauri, tauriInvoke } from '../../store/timelineStore';
import { MediaAsset, Clip } from '../../types/ipc';
import { MediaThumbnail } from './MediaThumbnail';
import { TransitionsPanel } from '../TransitionsPanel/TransitionsPanel';
import { EffectsPanel } from '../EffectsPanel/EffectsPanel';
import { FiltersPanel } from '../Filters/FiltersPanel';
import { TitlesPanel } from '../TitlesPanel/TitlesPanel';
import { AudioLibraryPanel } from './AudioLibraryPanel';
import { Type } from '@/components/Icons';

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
    importMediaBatch,
    cancelMediaImport,
    isIngesting,
    ingestTotal,
    ingestCurrent,
    ingestStatusMessage,
    moveAssetToBin,
    deleteAsset,
    deleteMediaBatch,
    selectedAssetId,
    selectAsset,
    setDraggedAsset,
    setActiveDragAsset,
    addAssetToTrack,
    addAssetsToTrack,
    tracks,
    generateClipProxy,
    deleteClipProxy,
    proxyProgress,
    proxyStatus,
    addAdjustmentLayer,
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
      importMediaBatch: state.importMediaBatch,
      cancelMediaImport: state.cancelMediaImport,
      isIngesting: state.isIngesting,
      ingestTotal: state.ingestTotal,
      ingestCurrent: state.ingestCurrent,
      ingestStatusMessage: state.ingestStatusMessage,
      moveAssetToBin: state.moveAssetToBin,
      deleteAsset: state.deleteAsset,
      deleteMediaBatch: state.deleteMediaBatch,
      selectedAssetId: state.selectedAssetId,
      selectAsset: state.selectAsset,
      setDraggedAsset: state.setDraggedAsset,
      setActiveDragAsset: state.setActiveDragAsset,
      addAssetToTrack: state.addAssetToTrack,
      addAssetsToTrack: state.addAssetsToTrack,
      tracks: state.tracks,
      generateClipProxy: state.generateClipProxy,
      deleteClipProxy: state.deleteClipProxy,
      proxyProgress: state.proxyProgress,
      proxyStatus: state.proxyStatus,
      addAdjustmentLayer: state.addAdjustmentLayer,
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

  // Thumbnail Size / Zoom Level (with persistent localStorage remembering user's choice)
  const [gridCardSize, setGridCardSize] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('antigravity_mediapool_zoom');
      if (saved) {
        const val = parseInt(saved, 10);
        if (!isNaN(val) && val >= 75 && val <= 200) return val;
      }
    } catch {}
    return 100; // comfortable compact default (was 150 before)
  });

  const handleZoomChange = (val: number) => {
    setGridCardSize(val);
    try {
      localStorage.setItem('antigravity_mediapool_zoom', val.toString());
    } catch {}
  };

  // Virtual Scrolling State
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerWidth, setContainerWidth] = useState(400);
  const [containerHeight, setContainerHeight] = useState(600);

  // Multi-Selection State & Marquee Drag Box
  const [selectedMediaIds, setSelectedMediaIds] = useState<Set<string>>(new Set());
  const lastSelectedAssetIdRef = useRef<string | null>(null);
  const [marquee, setMarquee] = useState<{
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
    isActive: boolean;
  } | null>(null);

  // Cascading Media Deletion Safeguards & In-Use Warning Modal
  const [deletionModal, setDeletionModal] = useState<{
    isOpen: boolean;
    targetMediaIds: string[];
    affectedClips: { clip: Clip; trackName: string; trackId: string }[];
    affectedTrackCount: number;
    isInUse: boolean;
  } | null>(null);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;

    const onScroll = () => {
      setScrollTop(el.scrollTop);
    };

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
        setContainerHeight(entry.contentRect.height);
      }
    });

    el.addEventListener('scroll', onScroll, { passive: true });
    resizeObserver.observe(el);

    return () => {
      el.removeEventListener('scroll', onScroll);
      resizeObserver.disconnect();
    };
  }, []);

  // Close context menu on window click
  useEffect(() => {
    const handleCloseMenu = () => setAssetContextMenu(null);
    window.addEventListener('click', handleCloseMenu);
    return () => window.removeEventListener('click', handleCloseMenu);
  }, []);

  // Multi-Selection: Click, Ctrl/Cmd+Click, Shift+Click
  const handleAssetClick = (e: React.MouseEvent, asset: MediaAsset) => {
    // Shift+Click: Contiguous range selection
    if (e.shiftKey) {
      e.preventDefault();
      const lastId = lastSelectedAssetIdRef.current;
      const lastIdx = filteredAssets.findIndex((a) => a.id === lastId);
      const curIdx = filteredAssets.findIndex((a) => a.id === asset.id);
      const start = Math.max(0, Math.min(lastIdx === -1 ? 0 : lastIdx, curIdx));
      const end = Math.max(lastIdx === -1 ? 0 : lastIdx, curIdx);
      const next = new Set(selectedMediaIds);
      for (let i = start; i <= end; i++) {
        next.add(filteredAssets[i].id);
      }
      setSelectedMediaIds(next);
      selectAsset(asset.id);
      return;
    }

    // Ctrl+Click / Cmd+Click: Toggle individual asset in/out of the selection set
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const next = new Set(selectedMediaIds);
      if (next.has(asset.id)) {
        next.delete(asset.id);
      } else {
        next.add(asset.id);
      }
      setSelectedMediaIds(next);
      selectAsset(next.size > 0 ? (next.has(asset.id) ? asset.id : Array.from(next)[next.size - 1]) : null);
      lastSelectedAssetIdRef.current = asset.id;
      return;
    }

    // Normal Click: Single asset selection
    setSelectedMediaIds(new Set([asset.id]));
    selectAsset(asset.id);
    lastSelectedAssetIdRef.current = asset.id;
  };

  // Marquee / Drag-Box Selection
  const handleContainerMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('[data-asset-id]') || target.closest('button') || target.closest('input')) {
      return;
    }

    const startX = e.clientX;
    const startY = e.clientY;
    const initialSelection = new Set(e.ctrlKey || e.metaKey ? selectedMediaIds : []);

    if (!e.ctrlKey && !e.metaKey && !e.shiftKey) {
      setSelectedMediaIds(new Set());
      selectAsset(null);
    }

    let isMarquee = false;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      if (!isMarquee && Math.hypot(dx, dy) > 4) {
        isMarquee = true;
        document.body.style.userSelect = 'none';
      }

      if (isMarquee) {
        const curX = moveEvent.clientX;
        const curY = moveEvent.clientY;
        setMarquee({
          startX,
          startY,
          currentX: curX,
          currentY: curY,
          isActive: true,
        });

        const boxLeft = Math.min(startX, curX);
        const boxRight = Math.max(startX, curX);
        const boxTop = Math.min(startY, curY);
        const boxBottom = Math.max(startY, curY);

        const cardElements = document.querySelectorAll('[data-asset-id]');
        const newlySelected = new Set(initialSelection);

        cardElements.forEach((el) => {
          const rect = el.getBoundingClientRect();
          const isIntersecting = !(
            rect.right < boxLeft ||
            rect.left > boxRight ||
            rect.bottom < boxTop ||
            rect.top > boxBottom
          );
          const id = el.getAttribute('data-asset-id');
          if (id && isIntersecting) {
            newlySelected.add(id);
          }
        });

        setSelectedMediaIds(newlySelected);
        if (newlySelected.size > 0) {
          selectAsset(Array.from(newlySelected)[0]);
        }
      }
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      document.body.style.userSelect = '';
      setMarquee(null);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  // Cascading Media Deletion Safeguard
  const initiateMediaDeletion = (targetIds: string[]) => {
    if (!targetIds || targetIds.length === 0) return;
    const targetSet = new Set(targetIds);
    const targetAssets = assets.filter((a) => targetSet.has(a.id));
    const targetPaths = new Set(targetAssets.map((a) => a.filePath).filter(Boolean));

    // Inspect all tracks and clips across timelineStore to identify dependencies
    const affectedClips: { clip: Clip; trackName: string; trackId: string }[] = [];
    const affectedTrackIds = new Set<string>();

    for (const track of tracks) {
      for (const clip of track.clips || []) {
        const isMatch =
          (clip.mediaId && targetSet.has(clip.mediaId)) ||
          targetSet.has(clip.id) ||
          (clip.filePath && targetPaths.has(clip.filePath));
        if (isMatch) {
          affectedClips.push({
            clip,
            trackName: track.name || `Track ${track.id}`,
            trackId: track.id,
          });
          affectedTrackIds.add(track.id);
        }
      }
    }

    const isInUse = affectedClips.length > 0;
    setDeletionModal({
      isOpen: true,
      targetMediaIds: targetIds,
      affectedClips,
      affectedTrackCount: affectedTrackIds.size,
      isInUse,
    });
  };

  const confirmDeletion = async () => {
    if (!deletionModal) return;
    const { targetMediaIds, isInUse } = deletionModal;
    await deleteMediaBatch(targetMediaIds, isInUse);
    setSelectedMediaIds((prev) => {
      const next = new Set(prev);
      for (const id of targetMediaIds) next.delete(id);
      return next;
    });
    setDeletionModal(null);
  };

  // Keyboard Delete / Backspace Hook for Media Pool Selection
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (selectedMediaIds.size === 0) return;
      const target = (document.activeElement || e.target) as HTMLElement | null;
      if (
        target &&
        (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable)
      ) {
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        initiateMediaDeletion(Array.from(selectedMediaIds));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedMediaIds, assets, tracks]);

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
          await importMediaBatch(paths);
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
          await importMediaBatch(paths);
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

        const assetsToDrop =
          selectedMediaIds.size > 1 && selectedMediaIds.has(asset.id)
            ? filteredAssets.filter((a) => selectedMediaIds.has(a.id))
            : [asset];
        const assetIds = assetsToDrop.map((a) => a.id);

        if (binElem) {
          const binId = binElem.getAttribute('data-bin-id');
          if (binId && binId !== 'all') {
            assetIds.forEach((id) => moveAssetToBin(id, binId));
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
            store.addAssetsToTrack(assetIds, trackId, targetSec);
          }
        } else if (trackHeader) {
          const trackId = trackHeader.getAttribute('data-track-header-id');
          if (trackId) {
            store.addAssetsToTrack(assetIds, trackId, currentPlayhead);
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
          store.addAssetsToTrack(assetIds, matchingTrack?.id, targetSec);
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
    const assetsToAdd =
      selectedMediaIds.size > 1 && selectedMediaIds.has(asset.id)
        ? filteredAssets.filter((a) => selectedMediaIds.has(a.id))
        : [asset];

    addAssetsToTrack(assetsToAdd.map((a) => a.id));
  };

  if (activeTab === 'audio') {
    return <AudioLibraryPanel />;
  }

  if (activeTab === 'text') {
    return <TitlesPanel />;
  }

  if (activeTab === 'transitions') {
    return (
      <div className="flex-1 flex flex-col overflow-hidden bg-[#14161B] border-r border-[#222630] select-none">
        <TransitionsPanel />
      </div>
    );
  }

  if (activeTab === 'effects') {
    return (
      <div className="flex-1 flex flex-col overflow-hidden bg-[#14161B] border-r border-[#222630] select-none">
        <EffectsPanel />
      </div>
    );
  }

  if (activeTab === 'filters') {
    return (
      <div className="flex-1 flex flex-col overflow-hidden bg-[#14161B] border-r border-[#222630] select-none">
        <FiltersPanel />
      </div>
    );
  }

  // Virtual Scrolling Calculations for Grid & List
  const effWidth = Math.max(120, containerWidth - 24);
  const numCols = Math.max(1, Math.floor((effWidth + 8) / (gridCardSize + 8)));
  const colWidth = Math.floor((effWidth - (numCols - 1) * 8) / numCols);
  const cardHeight = Math.round((colWidth * 9) / 16) + 30;
  const gridRowHeight = cardHeight + 8;
  const totalGridRows = Math.ceil(filteredAssets.length / numCols);
  const startGridRow = Math.max(0, Math.floor(scrollTop / gridRowHeight) - 2);
  const endGridRow = Math.min(totalGridRows, Math.ceil((scrollTop + containerHeight) / gridRowHeight) + 2);
  const visibleGridAssets = filteredAssets.slice(startGridRow * numCols, endGridRow * numCols);
  const topGridSpacer = startGridRow * gridRowHeight;
  const bottomGridSpacer = Math.max(0, (totalGridRows - endGridRow) * gridRowHeight);

  const listRowHeight = 52;
  const totalListRows = filteredAssets.length;
  const startListRow = Math.max(0, Math.floor(scrollTop / listRowHeight) - 4);
  const endListRow = Math.min(totalListRows, Math.ceil((scrollTop + containerHeight) / listRowHeight) + 4);
  const visibleListAssets = filteredAssets.slice(startListRow, endListRow);
  const topListSpacer = startListRow * listRowHeight;
  const bottomListSpacer = Math.max(0, (totalListRows - endListRow) * listRowHeight);

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#14161B] border-r border-[#222630] select-none">
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
          <div className="flex items-center justify-between px-1.5 py-1 mb-1 text-[#38BDF8] text-xs font-semibold">
            <div className="flex items-center gap-1.5 truncate">
              <span className="w-1.5 h-1.5 rounded-full bg-[#38BDF8] shadow-xs shrink-0" />
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
              className="p-1 rounded hover:bg-[#222630] text-[#8A92A6] hover:text-[#38BDF8] transition-colors"
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
              className="w-full px-2 py-1 text-xs bg-[#1A1D24] border border-[#38BDF8]/50 rounded text-[#F0F3F8] focus:outline-none"
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
                    ? 'bg-[#1C212B] text-[#38BDF8] border-l-2 border-[#38BDF8]'
                    : 'text-[#8A92A6] hover:bg-[#161920] hover:text-[#F0F3F8]'
                }`}
                title="Click to view bin, or drag media here to move"
              >
                <div className="flex items-center gap-2 truncate flex-1 mr-1">
                  <Folder
                    size={14}
                    className={isActive ? 'text-[#38BDF8]' : 'text-[#64748B] group-hover:text-[#F0F3F8]'}
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
                        className="w-full px-1 py-0.5 text-xs bg-[#1A1D24] border border-[#38BDF8] rounded text-white"
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
        {/* Pool Toolbar Header: 2 Structured Rows */}
        <div className="border-b border-[#222630] bg-[#121419] shrink-0">
          {/* Row 1: Primary Actions (Import, Folder, Proxies) & Search Bar */}
          <div className="h-10 px-3 flex items-center justify-between gap-2 border-b border-[#222630]/60">
            {/* Left: Sidebar Toggle, Import CTA Buttons & Proxies */}
            <div className="flex items-center gap-1.5 shrink-0">
              {!isSidebarOpen && (
                <button
                  onClick={() => setIsSidebarOpen(true)}
                  className="p-1.5 rounded bg-[#1A1D24] hover:bg-[#222630] border border-[#222630] text-[#8A92A6] hover:text-[#38BDF8] transition-colors"
                  title="Show Bins & Folders"
                >
                  <ChevronRight size={13} />
                </button>
              )}

              <button
                onClick={handleNativeImportFiles}
                disabled={isImporting}
                className="flex items-center gap-1 px-2.5 py-1 bg-[#38BDF8] hover:bg-[#34f3ff] text-[#0D0E11] rounded text-[11px] font-bold transition-all shadow-[0_0_8px_rgba(56, 189, 248,0.3)] cursor-pointer"
                title="Import Media Files"
              >
                <Plus size={13} strokeWidth={3} />
                <span>{isImporting ? 'Probing...' : 'Import'}</span>
              </button>

              <button
                onClick={handleNativeImportFolder}
                disabled={isImporting}
                className="flex items-center gap-1 px-2 py-1 bg-[#1A1D24] hover:bg-[#222630] border border-[#222630] text-[#F0F3F8] rounded text-[11px] font-medium transition-colors cursor-pointer"
                title="Select folder to import and probe all clips"
              >
                <Folder size={12} className="text-[#38BDF8]" />
                <span className="hidden sm:inline">Folder</span>
              </button>

              {/* Optional Proxy Import Checkbox */}
              <label
                className="flex items-center gap-1.5 px-2 py-1 rounded bg-[#181B22] border border-[#222630] text-[10px] text-[#8A92A6] hover:text-[#F0F3F8] cursor-pointer select-none whitespace-nowrap shrink-0 transition-colors"
                title="When checked, imported video files will automatically transcode lightweight editing proxies in the background"
              >
                <input
                  type="checkbox"
                  checked={createProxiesNow}
                  onChange={(e) => {
                    setCreateProxiesNow(e.target.checked);
                    (window as any).__IDTS_AUTO_GEN_PROXIES__ = e.target.checked;
                  }}
                  className="rounded bg-[#0D0E11] border-[#222630] text-[#38BDF8] focus:ring-0 cursor-pointer w-3.5 h-3.5 accent-[#38BDF8] shrink-0"
                />
                <span>Proxies</span>
              </label>
            </div>

            {/* Right: Search Bar */}
            <div className="relative flex-1 max-w-[160px] min-w-[70px]">
              <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#64748B]" />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-7 pr-5 py-1 text-[11px] bg-[#0D0E11] border border-[#222630] rounded text-[#F0F3F8] placeholder-[#64748B] focus:outline-none focus:border-[#38BDF8]/50"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-white cursor-pointer"
                >
                  <X size={10} />
                </button>
              )}
            </div>
          </div>

          {/* Row 2: Filter Pills & Multi-Select Batch Action Bar */}
          <div className="h-8 px-3 flex items-center justify-between gap-2 bg-[#0F1116]">
            {/* Filter Pills */}
            <div className="flex items-center bg-[#0D0E11] p-0.5 rounded border border-[#222630] text-[10px]">
              <button
                onClick={() => setFilterType('all')}
                className={`px-2 py-0.5 rounded font-medium transition-colors ${
                  filterType === 'all'
                    ? 'bg-[#222630] text-[#38BDF8] font-semibold'
                    : 'text-[#8A92A6] hover:text-[#F0F3F8]'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilterType('video')}
                className={`px-2 py-0.5 rounded font-medium transition-colors ${
                  filterType === 'video'
                    ? 'bg-[#222630] text-[#38BDF8] font-semibold'
                    : 'text-[#8A92A6] hover:text-[#F0F3F8]'
                }`}
              >
                Videos
              </button>
              <button
                onClick={() => setFilterType('audio')}
                className={`px-2 py-0.5 rounded font-medium transition-colors ${
                  filterType === 'audio'
                    ? 'bg-[#222630] text-[#38BDF8] font-semibold'
                    : 'text-[#8A92A6] hover:text-[#F0F3F8]'
                }`}
              >
                Audio
              </button>
            </div>

            {/* Right: Batch Selection Actions or Active Bin Label */}
            {selectedMediaIds.size > 0 ? (
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => {
                    const assetsToAdd = filteredAssets.filter((a) => selectedMediaIds.has(a.id));
                    if (assetsToAdd.length > 0) addAssetsToTrack(assetsToAdd.map((a) => a.id));
                  }}
                  className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded bg-[#38BDF8] hover:bg-[#34f3ff] text-[#0D0E11] transition-all shadow-[0_0_6px_rgba(56, 189, 248,0.3)] cursor-pointer"
                  title={`Add ${selectedMediaIds.size} selected asset(s) to timeline`}
                >
                  <Plus size={11} strokeWidth={3} />
                  <span>Add ({selectedMediaIds.size})</span>
                </button>
                <button
                  onClick={() => initiateMediaDeletion(Array.from(selectedMediaIds))}
                  className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold rounded bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/40 transition-colors shadow-sm cursor-pointer"
                  title={`Delete ${selectedMediaIds.size} selected asset(s)`}
                >
                  <Trash2 size={11} />
                  <span>Delete</span>
                </button>
              </div>
            ) : (
              <span className="text-[10px] font-mono text-[#555E70] truncate">
                {activeBinId === 'all' ? 'All Media' : bins.find((b) => b.id === activeBinId)?.name || 'Media'}
              </span>
            )}
          </div>
        </div>

        {/* ASSET ITEMS CONTAINER WITH VIRTUALIZATION & DRAG-AND-DROP */}
        <div
          ref={scrollContainerRef}
          onMouseDown={handleContainerMouseDown}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
              importFiles(e.dataTransfer.files);
            }
          }}
          className="flex-1 overflow-y-auto p-3 flex flex-col relative"
        >
          {filteredAssets.length === 0 ? (
            <div
              onClick={handleNativeImportFiles}
              className="flex-1 min-h-[220px] flex flex-col items-center justify-center text-center p-6 text-[#64748B] cursor-pointer hover:bg-[#161820]/70 rounded-xl transition-all group border-2 border-dashed border-transparent hover:border-[#38BDF8]/35 select-none"
              title="Click anywhere to import media files"
            >
              <div className="w-14 h-14 rounded-full bg-[#181B22] border border-[#222630] group-hover:border-[#38BDF8]/60 group-hover:bg-[#38BDF8]/15 flex items-center justify-center mb-3 text-[#38BDF8] group-hover:scale-110 transition-all shadow-md">
                <Upload size={24} className="group-hover:-translate-y-0.5 transition-transform" />
              </div>
              <div className="text-sm font-semibold text-[#8A92A6] group-hover:text-white transition-colors">
                No media in this bin
              </div>
              <div className="text-xs text-[#525D73] group-hover:text-[#8A92A6] mt-1 max-w-[220px] transition-colors leading-relaxed">
                Click <span className="text-[#38BDF8] font-semibold underline decoration-[#38BDF8]/40 underline-offset-2">Import</span> or drag video/audio files from your explorer
              </div>
            </div>
          ) : viewMode === 'grid' ? (
            /* COMPACT PROFESSIONAL MEDIA GRID (VIRTUALIZED) */
            <div>
              {topGridSpacer > 0 && <div style={{ height: topGridSpacer }} aria-hidden="true" />}
              <div
                className="grid gap-2.5"
                style={{
                  gridTemplateColumns: `repeat(${numCols}, minmax(0, 1fr))`,
                }}
              >
                {visibleGridAssets.map((asset) => {
                  const isMultiSelected = selectedMediaIds.has(asset.id);
                  const isSelected = selectedAssetId === asset.id || isMultiSelected;
                  const isVideo = asset.mediaType === 'video';

                  // SKELETON PLACEHOLDER DURING BACKGROUND ASYNC INGESTION
                  if (asset.isPendingIngest) {
                    return (
                      <div
                        key={asset.id}
                        data-asset-id={asset.id}
                        className="group relative flex flex-col rounded-md overflow-hidden bg-[#0D0E11] border border-[#222630] animate-pulse select-none"
                        title={`Importing ${asset.name} (${asset.ingestStatus || 'Probing...'})...`}
                      >
                        <div className="relative aspect-video w-full bg-[#161820] flex flex-col items-center justify-center text-center p-2">
                          <Loader2 size={20} className="text-[#38BDF8] animate-spin mb-1.5" />
                          <span className="text-[10px] font-mono text-[#38BDF8] font-semibold uppercase tracking-wider">
                            {asset.ingestStatus || 'Probing...'}
                          </span>
                          <span className="text-[9px] text-[#64748B] truncate max-w-full px-2 mt-0.5">
                            {asset.name}
                          </span>
                        </div>
                        <div className="px-2 py-1.5 flex items-center justify-between text-[10px] font-mono bg-[#0C0E12] border-t border-[#1C202B]">
                          <span className="text-[#64748B] truncate">{asset.name}</span>
                          <span className="text-[#38BDF8] text-[9px]">Queued</span>
                        </div>
                      </div>
                    );
                  }

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
                      data-asset-id={asset.id}
                      onMouseDown={(e) => handleStartMouseDrag(e, asset)}
                      onDoubleClick={() => handleQuickAdd(asset)}
                      onClick={(e) => handleAssetClick(e, asset)}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (!selectedMediaIds.has(asset.id)) {
                          setSelectedMediaIds(new Set([asset.id]));
                          selectAsset(asset.id);
                        }
                        setAssetContextMenu({ x: e.clientX, y: e.clientY, asset });
                      }}
                      title={`File: ${asset.name}\nResolution: ${resBadge}\nFPS: ${fpsBadge}\nDuration: ${durationStr}\n(Right-click for Proxy options, double-click or drag to add to timeline)`}
                      className={`group relative flex flex-col rounded-md overflow-hidden bg-[#0D0E11] border transition-all cursor-grab active:cursor-grabbing hover:border-[#38BDF8]/80 hover:shadow-[0_0_16px_rgba(56, 189, 248,0.2)] ${
                        isMultiSelected
                          ? 'border-[#38BDF8] ring-2 ring-[#38BDF8] shadow-[0_0_12px_rgba(56, 189, 248,0.3)] bg-[#38BDF8]/10'
                          : isSelected
                          ? 'border-[#38BDF8] ring-1 ring-[#38BDF8]'
                          : 'border-[#222630]'
                      }`}
                    >
                      {/* Thumbnail Image Container with Live Horizontal Hover Scrubbing */}
                      <div className="relative aspect-video w-full bg-[#1A1D24] overflow-hidden flex items-center justify-center">
                        <MediaThumbnail
                          filePath={asset.filePath}
                          mediaType={asset.mediaType}
                          durationSeconds={asset.durationSeconds}
                          name={asset.name}
                          thumbnailUrl={asset.thumbnailUrl}
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
                              className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-[#38BDF8] text-[#0D0E11] shadow-md animate-pulse flex items-center gap-1"
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
                          className="absolute bottom-1.5 right-1.5 p-1 rounded-full bg-[#38BDF8] text-[#0D0E11] hover:scale-110 transition-transform shadow-lg opacity-0 group-hover:opacity-100 z-30 cursor-pointer"
                          title="Add to Timeline Track"
                        >
                          <Plus size={12} strokeWidth={3} />
                        </button>
                      </div>

                      {/* Compact Footer: ONLY Resolution, FPS, and Duration */}
                      <div className="px-2 py-1.5 flex items-center justify-between text-[10px] font-mono bg-[#0C0E12] border-t border-[#1C202B]">
                        <div className="flex items-center gap-1.5 truncate">
                          <span className="text-[#38BDF8] font-medium">{resBadge}</span>
                          <span className="text-[#64748B]">•</span>
                          <span className="text-[#94A3B8]">{fpsBadge}</span>
                        </div>
                        <span className="text-[#F0F3F8] font-semibold shrink-0 ml-1">{durationStr}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
              {bottomGridSpacer > 0 && <div style={{ height: bottomGridSpacer }} aria-hidden="true" />}
            </div>
          ) : (
            /* LIST VIEW (VIRTUALIZED) */
            <div className="space-y-1">
              {topListSpacer > 0 && <div style={{ height: topListSpacer }} aria-hidden="true" />}
              {visibleListAssets.map((asset) => {
                const isMultiSelected = selectedMediaIds.has(asset.id);
                const isSelected = selectedAssetId === asset.id || isMultiSelected;

                // SKELETON PLACEHOLDER DURING BACKGROUND ASYNC INGESTION
                if (asset.isPendingIngest) {
                  return (
                    <div
                      key={asset.id}
                      data-asset-id={asset.id}
                      className="group relative flex items-center justify-between px-3 py-2 rounded-md bg-[#0D0E11] border border-[#222630] animate-pulse select-none"
                      title={`Importing ${asset.name} (${asset.ingestStatus || 'Probing...'})...`}
                    >
                      <div className="flex items-center gap-3 truncate flex-1 min-w-0 pr-3">
                        <div className="w-12 h-8 rounded bg-[#161820] flex items-center justify-center shrink-0">
                          <Loader2 size={14} className="text-[#38BDF8] animate-spin" />
                        </div>
                        <div className="truncate flex-1 min-w-0">
                          <div className="text-xs font-semibold text-[#8A92A6] truncate">
                            {asset.name}
                          </div>
                          <div className="text-[10px] text-[#38BDF8] font-mono">
                            {asset.ingestStatus || 'Probing metadata...'}
                          </div>
                        </div>
                      </div>
                      <div className="text-xs font-mono text-[#64748B] shrink-0">
                        Queued
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={asset.id}
                    data-asset-id={asset.id}
                    onMouseDown={(e) => handleStartMouseDrag(e, asset)}
                    onDoubleClick={() => handleQuickAdd(asset)}
                    onClick={(e) => handleAssetClick(e, asset)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (!selectedMediaIds.has(asset.id)) {
                        setSelectedMediaIds(new Set([asset.id]));
                        selectAsset(asset.id);
                      }
                      setAssetContextMenu({ x: e.clientX, y: e.clientY, asset });
                    }}
                    title={`File: ${asset.name}\nPath: ${asset.filePath}\nDuration: ${formatSeconds(asset.durationSeconds)} (${asset.durationSeconds}s)\nType: ${asset.mediaType.toUpperCase()}\n(Right-click for Proxy options, double-click or drag to add to timeline)`}
                    className={`group relative flex items-center justify-between px-3 py-2 rounded-md bg-[#0D0E11] border transition-all cursor-grab active:cursor-grabbing hover:border-[#38BDF8]/60 hover:bg-[#161922] ${
                      isMultiSelected
                        ? 'border-[#38BDF8] ring-2 ring-[#38BDF8] bg-[#38BDF8]/15'
                        : isSelected
                        ? 'border-[#38BDF8] bg-[#161922]'
                        : 'border-[#222630]'
                    }`}
                  >
                    <div className="flex items-center gap-3 truncate flex-1 min-w-0 pr-3">
                      <div className="w-12 h-8 rounded bg-[#1A1D24] overflow-hidden shrink-0 flex items-center justify-center relative">
                        <MediaThumbnail
                          filePath={asset.filePath}
                          mediaType={asset.mediaType}
                          durationSeconds={asset.durationSeconds}
                          name={asset.name}
                          thumbnailUrl={asset.thumbnailUrl}
                        />
                        {asset.hasProxy && (
                          <div className="absolute top-0.5 left-0.5 px-1 py-0.2 rounded text-[7px] font-bold bg-[#10B981] text-[#0D0E11]">
                            PROX
                          </div>
                        )}
                      </div>
                      <div className="truncate flex-1 min-w-0">
                        <div className="text-xs font-semibold text-[#F0F3F8] group-hover:text-[#38BDF8] truncate group-hover:whitespace-normal group-hover:break-all transition-colors flex items-center gap-1.5">
                          <span>{asset.name}</span>
                          {asset.hasProxy && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-[#10B981]/25 text-[#10B981] border border-[#10B981]/40">
                              PROX
                            </span>
                          )}
                          {proxyStatus[asset.filePath] === 'transcoding' && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-[#38BDF8]/25 text-[#38BDF8] border border-[#38BDF8]/40 animate-pulse flex items-center gap-1">
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
                        className="p-1 rounded bg-[#1A1D24] hover:bg-[#38BDF8] hover:text-[#0D0E11] text-[#38BDF8] transition-colors cursor-pointer"
                        title="Add to Timeline Track"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
              {bottomListSpacer > 0 && <div style={{ height: bottomListSpacer }} aria-hidden="true" />}
            </div>
          )}
        </div>

        {/* Bottom Status Bar: Item Count, Zoom Slider & View Mode */}
        <div className="h-8 border-t border-[#222630] px-3 flex items-center justify-between gap-2 shrink-0 bg-[#0E1015] select-none text-[11px] text-[#8A92A6]">
          {/* Left: Summary / Selection Stats */}
          <div className="flex items-center gap-1.5 font-mono text-[10px] truncate text-[#64748B]">
            <span>
              {filteredAssets.length} {filteredAssets.length === 1 ? 'item' : 'items'}
            </span>
            {selectedMediaIds.size > 0 && (
              <span className="text-[#38BDF8] font-semibold">
                • {selectedMediaIds.size} selected
              </span>
            )}
          </div>

          {/* Right: Zoom Slider & Grid/List View Mode Toggle */}
          <div className="flex items-center gap-2 shrink-0">
            {viewMode === 'grid' && (
              <div
                className="flex items-center gap-1.5 px-2 py-0.5 bg-[#14161B] rounded border border-[#222630] text-[10px] text-[#8A92A6]"
                title="Thumbnail Size / Zoom"
              >
                <ZoomOut
                  size={11}
                  className="hover:text-white transition-colors cursor-pointer"
                  onClick={() => handleZoomChange(Math.max(75, gridCardSize - 15))}
                />
                <input
                  type="range"
                  min={75}
                  max={200}
                  step={5}
                  value={gridCardSize}
                  onChange={(e) => handleZoomChange(Number(e.target.value))}
                  className="w-16 sm:w-20 h-1 bg-[#222630] rounded appearance-none cursor-pointer accent-[#38BDF8]"
                />
                <ZoomIn
                  size={11}
                  className="hover:text-white transition-colors cursor-pointer"
                  onClick={() => handleZoomChange(Math.min(200, gridCardSize + 15))}
                />
              </div>
            )}

            <div className="flex items-center bg-[#14161B] rounded border border-[#222630] p-0.5 text-[#8A92A6]">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`p-1 rounded transition-colors ${viewMode === 'grid' ? 'bg-[#222630] text-[#38BDF8]' : 'hover:text-[#F0F3F8]'}`}
                title="Grid View"
              >
                <Grid size={12} />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`p-1 rounded transition-colors ${viewMode === 'list' ? 'bg-[#222630] text-[#38BDF8]' : 'hover:text-[#F0F3F8]'}`}
                title="List View"
              >
                <List size={12} />
              </button>
            </div>
          </div>
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
                  className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-[#1C202B] text-[#38BDF8] hover:text-[#3bf1ff] transition-colors cursor-pointer text-left"
                >
                  <Zap size={13} className="text-[#38BDF8]" />
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
            <span>
              {selectedMediaIds.size > 1 && selectedMediaIds.has(assetContextMenu.asset.id)
                ? `Add ${selectedMediaIds.size} Selected to Timeline`
                : 'Add to Timeline Track'}
            </span>
          </button>

          <button
            onClick={() => {
              const targetIds =
                selectedMediaIds.size > 0 && selectedMediaIds.has(assetContextMenu.asset.id)
                  ? Array.from(selectedMediaIds)
                  : [assetContextMenu.asset.id];
              initiateMediaDeletion(targetIds);
              setAssetContextMenu(null);
            }}
            className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-red-500/15 text-red-400 transition-colors cursor-pointer text-left"
          >
            <Trash2 size={13} />
            <span>
              {selectedMediaIds.size > 1 && selectedMediaIds.has(assetContextMenu.asset.id)
                ? `Delete ${selectedMediaIds.size} Selected Assets`
                : 'Delete Asset'}
            </span>
          </button>
        </div>
      )}

      {/* Marquee Selection Drag-Box Rectangle Overlay */}
      {marquee && marquee.isActive && (
        <div
          className="fixed pointer-events-none z-[9999] border-2 border-[#38BDF8] bg-[#38BDF8]/15 rounded shadow-[0_0_12px_rgba(56, 189, 248,0.3)] backdrop-blur-[1px]"
          style={{
            left: `${Math.min(marquee.startX, marquee.currentX)}px`,
            top: `${Math.min(marquee.startY, marquee.currentY)}px`,
            width: `${Math.abs(marquee.currentX - marquee.startX)}px`,
            height: `${Math.abs(marquee.currentY - marquee.startY)}px`,
          }}
        />
      )}

      {/* Cascading Media Deletion Safeguards & In-Use Warning Modal */}
      {deletionModal && deletionModal.isOpen && (
        <div className="fixed inset-0 z-[999999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div
            className={`w-full max-w-lg rounded-xl border p-6 shadow-2xl flex flex-col gap-4 bg-[#14161B] text-[#F0F3F8] ${
              deletionModal.isInUse
                ? 'border-red-500/60 shadow-[0_0_30px_rgba(239,68,68,0.25)]'
                : 'border-[#2B3040] shadow-[0_0_20px_rgba(0,0,0,0.6)]'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start gap-3">
              <div
                className={`p-2.5 rounded-lg shrink-0 ${
                  deletionModal.isInUse
                    ? 'bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse'
                    : 'bg-[#38BDF8]/20 text-[#38BDF8] border border-[#38BDF8]/40'
                }`}
              >
                {deletionModal.isInUse ? <AlertCircle size={24} /> : <Trash2 size={24} />}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-bold text-white tracking-wide">
                  {deletionModal.isInUse
                    ? 'Media Currently Used on Timeline'
                    : 'Delete Media Asset(s)'}
                </h3>
                <p className="text-xs text-[#8A92A6] mt-1 leading-relaxed">
                  {deletionModal.isInUse
                    ? `Warning: ${deletionModal.affectedClips.length} of the selected clips are currently used in your timeline across ${deletionModal.affectedTrackCount} track(s). Deleting them from the media pool will remove all corresponding clips from your timeline project.`
                    : `Delete ${deletionModal.targetMediaIds.length} selected asset(s) from media pool?`}
                </p>
              </div>
            </div>

            {/* In-Use Dependency Breakdown List */}
            {deletionModal.isInUse && deletionModal.affectedClips.length > 0 && (
              <div className="mt-1 bg-[#0A0B0E] border border-red-500/30 rounded-lg p-3 max-h-48 overflow-y-auto space-y-2">
                <div className="text-[10px] uppercase font-mono font-bold tracking-wider text-red-400/90 mb-1">
                  Affected Timeline Clip Instances:
                </div>
                {deletionModal.affectedClips.map((item, idx) => (
                  <div
                    key={`${item.clip.id}-${idx}`}
                    className="flex items-center justify-between text-xs py-1.5 px-2.5 rounded bg-[#14161B] border border-[#222630]"
                  >
                    <div className="truncate flex-1 min-w-0 pr-2">
                      <span className="font-semibold text-white">{item.clip.name || 'Unnamed Clip'}</span>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#1E222D] text-[#38BDF8] border border-[#2B3040] shrink-0">
                      {item.trackName}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 mt-2 pt-2 border-t border-[#222630]">
              <button
                onClick={() => setDeletionModal(null)}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-[#1C202B] hover:bg-[#252B3A] text-[#8A92A6] hover:text-white transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeletion}
                className={`px-4 py-2 rounded-lg text-xs font-semibold text-white transition-all shadow-md cursor-pointer ${
                  deletionModal.isInUse
                    ? 'bg-red-600 hover:bg-red-500 shadow-red-600/30'
                    : 'bg-red-600 hover:bg-red-500 shadow-red-600/20'
                }`}
              >
                {deletionModal.isInUse ? 'Delete Everywhere' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Overall Ingest Progress Toast */}
      {isIngesting && (
        <div className="fixed bottom-4 left-4 z-[99999] bg-[#14161B]/95 border border-[#38BDF8]/40 rounded-lg shadow-2xl p-3 flex flex-col gap-2 min-w-[280px] max-w-[340px] backdrop-blur-md animate-in slide-in-from-bottom-2 duration-200">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#F0F3F8] truncate">
              <Loader2 size={14} className="animate-spin text-[#38BDF8] shrink-0" />
              <span className="truncate">
                Importing: {ingestCurrent} of {ingestTotal} clips...
              </span>
            </div>
            <button
              onClick={cancelMediaImport}
              className="text-[10px] text-red-400 hover:text-red-300 font-medium px-2 py-0.5 rounded bg-red-500/10 hover:bg-red-500/20 transition-colors shrink-0 cursor-pointer"
              title="Cancel remaining files in queue"
            >
              Cancel Remaining
            </button>
          </div>
          <div className="w-full bg-[#1C202B] rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-[#38BDF8] h-1.5 transition-all duration-200"
              style={{
                width: `${ingestTotal > 0 ? Math.min(100, Math.round((ingestCurrent / ingestTotal) * 100)) : 0}%`,
              }}
            />
          </div>
          {ingestStatusMessage && (
            <div className="text-[10px] text-[#8A92A6] truncate font-mono">
              {ingestStatusMessage}
            </div>
          )}
        </div>
      )}
      </div>
    </div>
  );
};
