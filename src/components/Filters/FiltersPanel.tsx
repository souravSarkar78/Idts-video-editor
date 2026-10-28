import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Layers,
  Grid,
  Film,
  Clock,
  Sun,
  Sparkles,
  FolderOpen,
  Upload,
  Search,
  RotateCcw,
  Sliders,
  Camera,
  Film as FilmIcon,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  Filter as FilterIcon,
  FolderPlus,
} from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useTimelineStore, isTauri, tauriInvoke } from '../../store/timelineStore';
import { FilterPreset, FilterCategory } from '../../types/ipc';
import { BUILT_IN_FILTER_CATEGORIES, BUILT_IN_FILTER_PRESETS } from './defaultPresets';
import { FilterCard } from './FilterCard';

export const FiltersPanel: React.FC = () => {
  const {
    tracks,
    playhead,
    selectedClipId,
    filterCategories,
    filterPresets,
    activeFilterCategory,
    samplePreviewMode,
    videoFrameSnapshot,
    isVideoFrameLoading,
    setActiveFilterCategory,
    setSamplePreviewMode,
    refreshVideoFrameSnapshot,
    applyFilterPreset,
    removeFilterFromClip,
    setClipFilterIntensity,
    importCustomCubeLut,
  } = useTimelineStore(
    useShallow((state) => ({
      tracks: state.tracks,
      playhead: state.playhead,
      selectedClipId: state.selectedClipId,
      filterCategories: state.filterCategories || BUILT_IN_FILTER_CATEGORIES,
      filterPresets: state.filterPresets || BUILT_IN_FILTER_PRESETS,
      activeFilterCategory: state.activeFilterCategory || 'all',
      samplePreviewMode: state.samplePreviewMode || 'default',
      videoFrameSnapshot: state.videoFrameSnapshot || null,
      isVideoFrameLoading: state.isVideoFrameLoading || false,
      setActiveFilterCategory: state.setActiveFilterCategory,
      setSamplePreviewMode: state.setSamplePreviewMode,
      refreshVideoFrameSnapshot: state.refreshVideoFrameSnapshot,
      applyFilterPreset: state.applyFilterPreset,
      removeFilterFromClip: state.removeFilterFromClip,
      setClipFilterIntensity: state.setClipFilterIntensity,
      importCustomCubeLut: state.importCustomCubeLut,
    }))
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [cardScale, setCardScale] = useState<'normal' | 'large'>('normal');
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // When switching to 'video_frame' mode, automatically request snapshot
  useEffect(() => {
    if (samplePreviewMode === 'video_frame') {
      refreshVideoFrameSnapshot();
    }
  }, [samplePreviewMode, playhead, selectedClipId, refreshVideoFrameSnapshot]);

  // Filter presets based on category and search
  const filteredPresets = useMemo(() => {
    const list = filterPresets && filterPresets.length > 0 ? filterPresets : BUILT_IN_FILTER_PRESETS;
    return list.filter((preset) => {
      // Category filter
      if (activeFilterCategory !== 'all') {
        if (activeFilterCategory === 'custom' && !preset.isCustom) return false;
        if (activeFilterCategory !== 'custom' && preset.category !== activeFilterCategory) return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = preset.name.toLowerCase().includes(q);
        const matchesDesc = preset.description.toLowerCase().includes(q);
        const matchesCat = (preset.categoryLabel || preset.category).toLowerCase().includes(q);
        return matchesName || matchesDesc || matchesCat;
      }
      return true;
    });
  }, [filterPresets, activeFilterCategory, searchQuery]);

  // Handle native or web .cube LUT import
  const handleImportLutClick = async () => {
    if (isTauri) {
      try {
        const selected = await tauriInvoke<string[]>('open_file_dialog');
        if (selected && selected.length > 0) {
          for (const path of selected) {
            await importCustomCubeLut(path);
          }
          return;
        }
      } catch (err) {
        console.warn('Native open_file_dialog failed, falling back to file input:', err);
      }
    }
    fileInputRef.current?.click();
  };

  const handleWebFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        await importCustomCubeLut(file.name, file.name.replace(/\.[^/.]+$/, ''));
      }
    }
  };

  // Category Icon mapper
  const renderCategoryIcon = (icon: string) => {
    switch (icon) {
      case 'Layers':
        return <Layers size={14} />;
      case 'Grid':
        return <Grid size={14} />;
      case 'Film':
        return <Film size={14} />;
      case 'Clock':
        return <Clock size={14} />;
      case 'Sun':
        return <Sun size={14} />;
      case 'Sparkles':
        return <Sparkles size={14} />;
      case 'FolderOpen':
        return <FolderOpen size={14} />;
      default:
        return <FilterIcon size={14} />;
    }
  };

  const categories = filterCategories && filterCategories.length > 0 ? filterCategories : BUILT_IN_FILTER_CATEGORIES;

  // Active clip filter info
  const appliedFilterId = activeClip?.filterId;
  const appliedFilterName = activeClip?.filterName;
  const appliedIntensity = Math.round((activeClip?.filterIntensity ?? 1.0) * 100);

  return (
    <div className="flex-1 flex flex-col h-full bg-[#12141A] text-[#C4C9D4] overflow-hidden select-none border-r border-[#222630]">
      {/* Hidden File Input for Custom .cube LUT import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".cube,.look,.3dl"
        multiple
        className="hidden"
        onChange={handleWebFileInput}
      />

      {/* Top Main Toolbar */}
      <div className="h-10 border-b border-[#222630] px-2.5 flex items-center justify-between gap-2 bg-[#15171E] shrink-0">
        {/* Left: Folders toggle, Title & Search */}
        <div className="flex items-center gap-2 min-w-0">
          {!isSidebarOpen && (
            <button
              type="button"
              onClick={() => setIsSidebarOpen(true)}
              className="flex items-center gap-1 px-2 py-1 rounded bg-[#1B1E26] hover:bg-[#252A36] border border-[#2E3444] text-[#A0AEC0] hover:text-[#00F0FF] text-xs font-medium transition-all shadow-xs shrink-0"
              title="Expand Folders & LUTs Sidebar"
            >
              <ChevronRight size={13} className="text-[#00F0FF]" />
              <span className="hidden sm:inline">Folders</span>
            </button>
          )}

          <div className="flex items-center gap-1 text-white font-semibold text-xs tracking-wide whitespace-nowrap shrink-0">
            <FilterIcon size={14} className="text-[#00F0FF]" />
            <span>Filters</span>
          </div>

          {/* Quick Search */}
          <div className="relative w-32 sm:w-44">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#64748B]" />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#0D0F14] border border-[#262B36] rounded-md pl-7 pr-6 py-0.5 text-xs text-white placeholder-[#64748B] focus:outline-hidden focus:border-[#00F0FF]"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-white"
              >
                <X size={11} />
              </button>
            )}
          </div>
        </div>

        {/* Right: Sample Mode Switcher */}
        <div className="flex items-center bg-[#0D0F14] p-0.5 rounded-md border border-[#262B36] text-xs shrink-0">
          <button
            type="button"
            onClick={() => setSamplePreviewMode('default')}
            className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium whitespace-nowrap transition-all ${
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
            className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium whitespace-nowrap transition-all ${
              samplePreviewMode === 'video_frame'
                ? 'bg-[#00F0FF] text-black font-semibold shadow-xs'
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
              className="p-1 hover:text-[#00F0FF] text-[#8E9CAE] disabled:opacity-50 transition-colors ml-0.5"
              title="Refresh timeline frame"
            >
              <RotateCcw size={11} className={isVideoFrameLoading ? 'animate-spin' : ''} />
            </button>
          )}
        </div>
      </div>

      {/* Active Filter Secondary Bar (Only when active clip has filter) */}
      {activeClip && appliedFilterId && (
        <div className="h-9 px-3 border-b border-[#222630] bg-[#161922] flex items-center justify-between gap-2 text-xs shrink-0">
          <div className="flex items-center gap-1.5 truncate">
            <span className="text-[10px] font-mono uppercase text-[#64748B] shrink-0">Active:</span>
            <span
              className="text-xs font-semibold text-[#00F0FF] truncate max-w-[140px]"
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
                className="w-16 sm:w-20 h-1 bg-[#262B36] rounded-lg appearance-none cursor-pointer accent-[#00F0FF]"
                title="Filter Intensity"
              />
            </div>

            {/* Remove Filter Button */}
            <button
              type="button"
              onClick={() => removeFilterFromClip(activeClip.id)}
              className="flex items-center gap-1 text-[10px] text-red-400 hover:text-red-300 hover:bg-red-500/10 px-1.5 py-0.5 rounded transition-colors"
              title="Remove filter from active clip"
            >
              <X size={10} />
              <span>Remove</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Body: Left Drawer Navigation Tree + Center Card Grid */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Drawer Navigation Tree (Collapsible) */}
        {isSidebarOpen && (
          <div className="w-40 border-r border-[#222630] bg-[#14161C] flex flex-col shrink-0 transition-all duration-200">
            {/* Tree Header */}
            <div className="p-2 border-b border-[#222630]/60 flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#64748B]">
                FOLDERS
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleImportLutClick}
                  className="p-1 rounded hover:bg-[#1E222D] text-[#00F0FF] hover:text-white transition-colors"
                  title="Import 3D LUT (.cube) file"
                >
                  <Upload size={11} />
                </button>
                <button
                  type="button"
                  onClick={() => setIsSidebarOpen(false)}
                  className="p-1 rounded hover:bg-[#1E222D] text-[#64748B] hover:text-white transition-colors"
                  title="Collapse Folders Sidebar"
                >
                  <ChevronLeft size={12} />
                </button>
              </div>
            </div>

            {/* Navigation Folder List */}
            <div className="flex-1 overflow-y-auto py-1 px-1 space-y-0.5 custom-scrollbar">
              {categories.map((cat) => {
                const isSelected = activeFilterCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setActiveFilterCategory(cat.id)}
                    className={`w-full flex items-center justify-between px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      isSelected
                        ? 'bg-[#00F0FF]/15 text-[#00F0FF] border border-[#00F0FF]/30'
                        : 'text-[#A0AEC0] hover:text-white hover:bg-[#1B1E26]'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      <span className={isSelected ? 'text-[#00F0FF]' : 'text-[#64748B]'}>
                        {renderCategoryIcon(cat.icon)}
                      </span>
                      <span className="truncate">{cat.name}</span>
                    </div>
                    <span
                      className={`text-[9px] font-mono px-1 py-0.2 rounded ${
                        isSelected ? 'bg-[#00F0FF]/20 text-[#00F0FF]' : 'bg-[#1E222D] text-[#64748B]'
                      }`}
                    >
                      {cat.count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Import .CUBE LUT Bottom Action */}
            <div className="p-1.5 border-t border-[#222630] bg-[#111318]">
              <button
                type="button"
                onClick={handleImportLutClick}
                className="w-full flex items-center justify-center gap-1 py-1 px-2 rounded-md bg-[#1F2430] hover:bg-[#282F3E] text-white text-[11px] font-medium border border-[#2F374A] hover:border-[#00F0FF]/50 transition-all shadow-xs"
              >
                <FolderPlus size={12} className="text-[#00F0FF]" />
                <span>Import .cube</span>
              </button>
            </div>
          </div>
        )}

        {/* Central Panel: Responsive Card Grid */}
        <div className="flex-1 flex flex-col overflow-hidden bg-[#0F1116]">
          {/* Active Category Description Header */}
          <div className="px-3 py-1.5 border-b border-[#222630]/60 flex items-center justify-between text-xs text-[#64748B] bg-[#12151B] shrink-0">
            <div className="flex items-center gap-1.5 truncate">
              <span className="font-semibold text-white text-xs truncate">
                {categories.find((c) => c.id === activeFilterCategory)?.name || 'All Filters'}
              </span>
              <span className="text-[10px] text-[#64748B] font-mono">
                ({filteredPresets.length})
              </span>
            </div>

            {/* Right: Card Size Toggle */}
            <div className="flex items-center bg-[#0D0F14] p-0.5 rounded border border-[#262B36] text-[10px] font-mono shrink-0">
              <button
                type="button"
                onClick={() => setCardScale('normal')}
                className={`px-2 py-0.5 rounded transition-all ${
                  cardScale === 'normal'
                    ? 'bg-[#222834] text-white font-bold'
                    : 'text-[#64748B] hover:text-white'
                }`}
                title="Normal size"
              >
                Normal
              </button>
              <button
                type="button"
                onClick={() => setCardScale('large')}
                className={`px-2 py-0.5 rounded transition-all ${
                  cardScale === 'large'
                    ? 'bg-[#00F0FF] text-black font-bold shadow-xs'
                    : 'text-[#64748B] hover:text-white'
                }`}
                title="Large size"
              >
                Large
              </button>
            </div>
          </div>

          {/* Grid Container */}
          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
            {filteredPresets.length > 0 ? (
              <div
                className={`grid ${
                  cardScale === 'large'
                    ? 'grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-x-4 gap-y-5'
                    : 'grid-cols-[repeat(auto-fill,minmax(110px,1fr))] gap-x-3 gap-y-4'
                }`}
              >
                {filteredPresets.map((preset) => {
                  const isActive = Boolean(
                    activeClip && (activeClip.filterId === preset.id || activeClip.lutPath === preset.lutPath)
                  );
                  return (
                    <FilterCard
                      key={preset.id}
                      preset={preset}
                      isActive={isActive}
                      sampleMode={samplePreviewMode}
                      videoFrameSnapshot={videoFrameSnapshot}
                      onApply={(p) => applyFilterPreset(p, activeClip?.id)}
                    />
                  );
                })}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-8">
                <div className="w-12 h-12 rounded-full bg-[#181C26] flex items-center justify-center text-[#64748B] mb-3">
                  <FilterIcon size={22} />
                </div>
                <h3 className="text-sm font-semibold text-white">No Filters Found</h3>
                <p className="text-xs text-[#64748B] max-w-sm mt-1">
                  {searchQuery
                    ? `No looks match your query "${searchQuery}". Try searching for another style or clear search.`
                    : 'No custom LUTs imported yet. Click "Import .cube LUT" to add technical camera profiles or creative grades.'}
                </p>
                {activeFilterCategory === 'custom' && (
                  <button
                    type="button"
                    onClick={handleImportLutClick}
                    className="mt-4 flex items-center gap-1.5 px-3 py-1.5 bg-[#00F0FF] text-black rounded text-xs font-semibold hover:bg-[#38BDF8]"
                  >
                    <Upload size={12} />
                    <span>Import .cube LUT</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
