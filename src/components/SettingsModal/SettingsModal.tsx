import React, { useEffect, useState } from 'react';
import {
  X,
  Settings as SettingsIcon,
  Keyboard,
  RotateCcw,
  Check,
  Search,
  Sparkles,
  Command,
  Info,
  Film,
  Zap,
} from 'lucide-react';
import {
  useShortcutStore,
  SHORTCUT_DEFINITIONS,
  normalizeKeyEvent,
} from '../../store/shortcutStore';

const CATEGORIES = ['All', 'Playback', 'Timeline', 'Project', 'Multicam'] as const;
type CategoryType = (typeof CATEGORIES)[number];

export const SettingsModal: React.FC = () => {
  const {
    isSettingsModalOpen,
    closeSettingsModal,
    shortcuts,
    setShortcut,
    resetDefaults,
    recordingActionId,
    startRecording,
    stopRecording,
    autoGenerateProxies,
    setAutoGenerateProxies,
    proxyResolution,
    setProxyResolution,
    proxyCodec,
    setProxyCodec,
  } = useShortcutStore();

  const [activeTab, setActiveTab] = useState<'shortcuts' | 'general' | 'media'>('shortcuts');
  const [selectedCat, setSelectedCat] = useState<CategoryType>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [recordedNotice, setRecordedNotice] = useState<string | null>(null);

  // Key recording listener
  useEffect(() => {
    if (!recordingActionId) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (e.key === 'Escape') {
        stopRecording();
        return;
      }

      const combo = normalizeKeyEvent(e);
      if (combo && combo !== 'Ctrl' && combo !== 'Shift' && combo !== 'Alt') {
        setShortcut(recordingActionId, combo);
        const actionDef = SHORTCUT_DEFINITIONS.find((d) => d.id === recordingActionId);
        setRecordedNotice(`Updated "${actionDef?.label}" to "${combo}"`);
        setTimeout(() => setRecordedNotice(null), 3000);
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [recordingActionId, setShortcut, stopRecording]);

  if (!isSettingsModalOpen) return null;

  const filteredShortcuts = SHORTCUT_DEFINITIONS.filter((item) => {
    const matchesCat = selectedCat === 'All' || item.category === selectedCat;
    const matchesSearch =
      item.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (shortcuts[item.id] || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-in fade-in duration-150 select-none">
      <div className="w-full max-w-3xl bg-[#14161B] border border-[#222630] rounded-xl shadow-2xl overflow-hidden flex flex-col text-[#F0F3F8] max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#222630] bg-[#101217]">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-[#00F0FF]/15 text-[#00F0FF] border border-[#00F0FF]/30">
              <SettingsIcon size={18} />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-wide text-[#F0F3F8]">
                Preferences & Settings
              </h2>
              <p className="text-[11px] text-[#64748B]">
                Customize keyboard shortcuts, layout, and editing behavior
              </p>
            </div>
          </div>

          <button
            onClick={closeSettingsModal}
            className="p-1.5 rounded-lg text-[#8A92A6] hover:text-[#F0F3F8] hover:bg-[#222630] transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Navigation Tabs */}
        <div className="flex items-center justify-between border-b border-[#222630] bg-[#0E1015] px-5 pt-2">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('shortcuts')}
              className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-t border-t border-x transition-all cursor-pointer ${
                activeTab === 'shortcuts'
                  ? 'bg-[#14161B] text-[#00F0FF] border-[#222630] border-b-[#14161B] -mb-[1px]'
                  : 'text-[#8A92A6] border-transparent hover:text-[#F0F3F8]'
              }`}
            >
              <Keyboard size={14} />
              <span>Keyboard Shortcuts</span>
            </button>
            <button
              onClick={() => setActiveTab('general')}
              className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-t border-t border-x transition-all cursor-pointer ${
                activeTab === 'general'
                  ? 'bg-[#14161B] text-[#00F0FF] border-[#222630] border-b-[#14161B] -mb-[1px]'
                  : 'text-[#8A92A6] border-transparent hover:text-[#F0F3F8]'
              }`}
            >
              <Command size={14} />
              <span>General & Persistence</span>
            </button>
            <button
              onClick={() => setActiveTab('media')}
              className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-t border-t border-x transition-all cursor-pointer ${
                activeTab === 'media'
                  ? 'bg-[#14161B] text-[#00F0FF] border-[#222630] border-b-[#14161B] -mb-[1px]'
                  : 'text-[#8A92A6] border-transparent hover:text-[#F0F3F8]'
              }`}
            >
              <Film size={14} />
              <span>Media / Performance</span>
            </button>
          </div>

          {activeTab === 'shortcuts' && (
            <button
              onClick={resetDefaults}
              className="flex items-center gap-1.5 text-[11px] font-mono text-[#8A92A6] hover:text-[#00F0FF] pb-2 cursor-pointer transition-colors"
            >
              <RotateCcw size={12} />
              <span>Reset to Defaults</span>
            </button>
          )}
        </div>

        {/* Modal Body */}
        {activeTab === 'shortcuts' ? (
          <div className="flex-1 flex flex-col overflow-hidden p-5 gap-3.5">
            {/* Search and Category Filter */}
            <div className="flex items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[#64748B]"
                />
                <input
                  type="text"
                  placeholder="Search actions or keys..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[#0D0E11] border border-[#222630] rounded-lg pl-9 pr-3 py-1.5 text-xs text-[#F0F3F8] placeholder-[#525D73] outline-none focus:border-[#00F0FF]/60"
                />
              </div>

              {/* Category Pills */}
              <div className="flex items-center gap-1 bg-[#0D0E11] p-1 rounded-lg border border-[#222630]">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCat(cat)}
                    className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                      selectedCat === cat
                        ? 'bg-[#1E222D] text-[#00F0FF] font-bold shadow-xs'
                        : 'text-[#8A92A6] hover:text-[#F0F3F8]'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Notification Banner */}
            {recordedNotice && (
              <div className="flex items-center gap-2 p-2 rounded-lg bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30 text-xs font-mono animate-in fade-in">
                <Check size={14} />
                <span>{recordedNotice}</span>
              </div>
            )}

            {/* Shortcuts Table */}
            <div className="flex-1 overflow-y-auto border border-[#222630] rounded-lg bg-[#0C0E12] divide-y divide-[#1C202B]">
              {filteredShortcuts.map((action) => {
                const currentKey = shortcuts[action.id] || action.defaultKey;
                const isRecordingThis = recordingActionId === action.id;

                return (
                  <div
                    key={action.id}
                    className="flex items-center justify-between px-4 py-2.5 hover:bg-[#141720]/60 transition-colors"
                  >
                    <div className="flex flex-col gap-0.5 max-w-[60%]">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-[#F0F3F8]">{action.label}</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#181B22] text-[#64748B] border border-[#222630]">
                          {action.category}
                        </span>
                      </div>
                      <span className="text-[11px] text-[#64748B] truncate">
                        {action.description}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {isRecordingThis ? (
                        <div className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-[#EF4444]/20 border border-red-500 text-red-400 text-xs font-mono font-bold animate-pulse">
                          <span>Press key combo...</span>
                          <button
                            onClick={stopRecording}
                            className="text-white hover:text-red-200 ml-1 text-[10px]"
                          >
                            (Esc)
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <kbd className="px-2.5 py-1 rounded-md bg-[#1B1E27] border border-[#2B3040] text-[#00F0FF] font-mono text-xs font-bold shadow-xs">
                            {currentKey}
                          </kbd>
                          <button
                            onClick={() => startRecording(action.id)}
                            className="px-2.5 py-1 rounded-md bg-[#181B22] hover:bg-[#222630] border border-[#222630] text-[11px] text-[#8A92A6] hover:text-[#F0F3F8] transition-colors cursor-pointer"
                          >
                            Record Key
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : activeTab === 'media' ? (
          <div className="flex-1 p-5 space-y-4 overflow-y-auto text-xs">
            {/* Auto Proxy Generation */}
            <div className="p-4 rounded-lg bg-[#0D0E11] border border-[#222630] space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-bold text-[#F0F3F8] flex items-center gap-2">
                    <Zap size={14} className="text-[#00F0FF]" />
                    <span>Automatic Proxy Generation</span>
                  </h3>
                  <p className="text-[11px] text-[#8A92A6] mt-1 leading-relaxed">
                    Automatically transcode 4K, 5.7K, and high-bitrate media files into fast-decoding lightweight editing proxies immediately upon import.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={autoGenerateProxies}
                    onChange={(e) => setAutoGenerateProxies(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-[#222630] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#00F0FF]"></div>
                </label>
              </div>
            </div>

            {/* Proxy Resolution & Codec Configuration */}
            <div className="p-4 rounded-lg bg-[#0D0E11] border border-[#222630] space-y-4">
              <h3 className="font-bold text-[#F0F3F8]">Transcoding Specifications</h3>

              <div className="grid grid-cols-2 gap-4">
                {/* Resolution */}
                <div>
                  <label className="block text-[11px] text-[#8A92A6] font-medium mb-1.5">
                    Proxy Resolution
                  </label>
                  <select
                    value={proxyResolution}
                    onChange={(e) => setProxyResolution(e.target.value)}
                    className="w-full px-3 py-2 bg-[#14161B] border border-[#222630] rounded-md text-xs text-[#F0F3F8] focus:outline-none focus:border-[#00F0FF]/50"
                  >
                    <option value="720p">720p (1280x720) - Standard (Recommended)</option>
                    <option value="540p">540p (960x540) - Low Bitrate</option>
                    <option value="360p">360p (640x360) - Lightweight Multi-Cam</option>
                  </select>
                  <span className="text-[10px] text-[#64748B] block mt-1">
                    Lower resolutions optimize seek performance for 4+ simultaneous camera angles.
                  </span>
                </div>

                {/* Codec */}
                <div>
                  <label className="block text-[11px] text-[#8A92A6] font-medium mb-1.5">
                    Video Transcoding Codec
                  </label>
                  <select
                    value={proxyCodec}
                    onChange={(e) => setProxyCodec(e.target.value)}
                    className="w-full px-3 py-2 bg-[#14161B] border border-[#222630] rounded-md text-xs text-[#F0F3F8] focus:outline-none focus:border-[#00F0FF]/50"
                  >
                    <option value="h264_nvenc">NVIDIA NVENC (GPU Hardware Accelerated)</option>
                    <option value="libx264">libx264 (CPU Ultrafast Fallback)</option>
                  </select>
                  <span className="text-[10px] text-[#64748B] block mt-1">
                    GPU acceleration renders proxies up to 10x faster than real-time.
                  </span>
                </div>
              </div>
            </div>

            {/* Cache Location Notice */}
            <div className="p-3.5 rounded-lg bg-[#0D0E11] border border-[#222630] space-y-1.5">
              <span className="font-bold text-[#F0F3F8]">Proxy Storage Cache</span>
              <p className="text-[11px] text-[#64748B] leading-relaxed">
                Generated proxy MP4 files are cached locally in{' '}
                <code className="text-white bg-[#1A1D24] px-1 py-0.5 rounded font-mono">
                  %LOCALAPPDATA%/idts-video-editor/proxies/
                </code>.
                You can delete individual proxies anytime from the Media Pool context menu.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex-1 p-5 space-y-4 overflow-y-auto text-xs">
            <div className="p-3.5 rounded-lg bg-[#0D0E11] border border-[#222630] space-y-2">
              <span className="font-bold text-[#F0F3F8] flex items-center gap-1.5">
                <Sparkles size={14} className="text-[#00F0FF]" />
                <span>idts Project File Association</span>
              </span>
              <p className="text-[11px] text-[#64748B] leading-relaxed">
                Projects are saved in native <code className="text-[#00F0FF]">.idts</code> format, storing timeline tracks, synchronized camera offsets, clip trim boundaries, color adjustments, and media pool bins.
              </p>
            </div>

            <div className="p-3.5 rounded-lg bg-[#0D0E11] border border-[#222630] space-y-2">
              <span className="font-bold text-[#F0F3F8]">Preferences Storage</span>
              <p className="text-[11px] text-[#64748B] leading-relaxed">
                Keyboard shortcuts and settings are persisted locally in{' '}
                <code className="text-white bg-[#1A1D24] px-1 py-0.5 rounded font-mono">
                  %APPDATA%/idts-video-editor/preferences.json
                </code>.
              </p>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[#222630] bg-[#101217] flex items-center justify-between text-xs text-[#64748B]">
          <span className="flex items-center gap-1 font-mono text-[11px]">
            <Info size={13} className="text-[#00F0FF]" />
            Changes are automatically saved to disk
          </span>
          <button
            onClick={closeSettingsModal}
            className="px-4 py-1.5 rounded-md bg-[#00F0FF] hover:bg-[#3bf1ff] text-[#0D0E11] font-bold transition-all cursor-pointer shadow-[0_0_10px_rgba(0,240,255,0.3)]"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
