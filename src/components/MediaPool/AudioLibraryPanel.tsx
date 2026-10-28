import React, { useState, useRef, useEffect } from 'react';
import {
  Music,
  Volume2,
  Play,
  Plus,
  Mic,
  Sparkles,
  Upload,
  Trash2,
  FolderOpen,
} from 'lucide-react';
import { Square } from '@/components/Icons';
import { useTimelineStore, isTauri, tauriInvoke } from '../../store/timelineStore';
import { MediaAsset } from '../../types/ipc';
import { encodeWavPcm16 } from '../../store/timelineStore';
import {
  getSharedAudioContext,
  unlockAudioContext,
  loadAudioBuffer,
  getCachedAudioBuffer,
} from '../../utils/audioMastering';

export interface SfxPreset {
  id: string;
  name: string;
  category: 'Cinematic' | 'Transitions' | 'Foley & UI' | 'Risers' | 'Custom FX';
  durationSeconds: number;
  description: string;
  generateBuffer?: (sampleRate: number) => Float32Array;
  filePath?: string;
  isCustom?: boolean;
}

export interface CustomAudioFxItem {
  id: string;
  name: string;
  category: 'Custom FX';
  durationSeconds: number;
  filePath: string;
  dateAdded: number;
}

const STORAGE_KEY_CUSTOM_FX = 'idts_custom_audio_fx';

// Built-in studio sound effect synthesizers (pure client-side DSP)
export const SFX_PRESETS: SfxPreset[] = [
  {
    id: 'sfx-cinematic-boom',
    name: 'Sub Impact Boom',
    category: 'Cinematic',
    durationSeconds: 2.2,
    description: 'Deep cinematic 55Hz sub-bass hit with slow decay',
    generateBuffer: (sr) => {
      const len = Math.floor(sr * 2.2);
      const buf = new Float32Array(len);
      for (let i = 0; i < len; i++) {
        const t = i / sr;
        const env = Math.exp(-t * 2.2);
        const freq = 65 * Math.exp(-t * 3.5) + 38;
        buf[i] = Math.sin(2 * Math.PI * freq * t) * env * 0.85;
      }
      return buf;
    },
  },
  {
    id: 'sfx-cinematic-whoosh',
    name: 'Cinematic Fast Whoosh',
    category: 'Transitions',
    durationSeconds: 1.0,
    description: 'Dynamic white-noise sweep for fast cuts and camera pans',
    generateBuffer: (sr) => {
      const len = Math.floor(sr * 1.0);
      const buf = new Float32Array(len);
      let last = 0;
      for (let i = 0; i < len; i++) {
        const t = i / sr;
        const env = Math.sin((t / 1.0) * Math.PI);
        const white = Math.random() * 2 - 1;
        last = last * 0.7 + white * 0.3;
        buf[i] = last * env * 0.75;
      }
      return buf;
    },
  },
  {
    id: 'sfx-digital-glitch',
    name: 'Cyber Glitch Burst',
    category: 'Transitions',
    durationSeconds: 0.65,
    description: 'High-tech stuttering digital noise burst',
    generateBuffer: (sr) => {
      const len = Math.floor(sr * 0.65);
      const buf = new Float32Array(len);
      for (let i = 0; i < len; i++) {
        const t = i / sr;
        const step = Math.floor(t * 32) % 4;
        const freq = 300 + step * 250;
        const tone = Math.sin(2 * Math.PI * freq * t);
        const noise = (Math.random() * 2 - 1) * 0.35;
        const env = 1 - t / 0.65;
        buf[i] = (tone * 0.6 + noise) * env * 0.8;
      }
      return buf;
    },
  },
  {
    id: 'sfx-camera-shutter',
    name: 'Camera Shutter Snap',
    category: 'Foley & UI',
    durationSeconds: 0.35,
    description: 'Crisp mechanical SLR shutter click',
    generateBuffer: (sr) => {
      const len = Math.floor(sr * 0.35);
      const buf = new Float32Array(len);
      for (let i = 0; i < len; i++) {
        const t = i / sr;
        const click1 = t < 0.08 ? Math.sin(2 * Math.PI * 1800 * t) * Math.exp(-t * 80) : 0;
        const click2 =
          t > 0.09 && t < 0.2
            ? Math.sin(2 * Math.PI * 1200 * (t - 0.09)) * Math.exp(-(t - 0.09) * 60)
            : 0;
        buf[i] = (click1 + click2) * 0.8;
      }
      return buf;
    },
  },
  {
    id: 'sfx-ui-pop',
    name: 'Pop Bubble Click',
    category: 'Foley & UI',
    durationSeconds: 0.25,
    description: 'Warm organic UI pop for sticker drops and text pop-ins',
    generateBuffer: (sr) => {
      const len = Math.floor(sr * 0.25);
      const buf = new Float32Array(len);
      for (let i = 0; i < len; i++) {
        const t = i / sr;
        const freq = 750 * Math.exp(-t * 22) + 120;
        const env = Math.exp(-t * 18);
        buf[i] = Math.sin(2 * Math.PI * freq * t) * env * 0.9;
      }
      return buf;
    },
  },
  {
    id: 'sfx-tension-riser',
    name: 'Tension Pitch Riser',
    category: 'Risers',
    durationSeconds: 3.0,
    description: 'Smooth exponential pitch riser building anticipation',
    generateBuffer: (sr) => {
      const len = Math.floor(sr * 3.0);
      const buf = new Float32Array(len);
      for (let i = 0; i < len; i++) {
        const t = i / sr;
        const progress = t / 3.0;
        const freq = 120 + Math.pow(progress, 2.5) * 1600;
        const env = Math.pow(progress, 1.2) * 0.8;
        buf[i] = Math.sin(2 * Math.PI * freq * t) * env;
      }
      return buf;
    },
  },
  {
    id: 'sfx-future-chime',
    name: 'Futuristic Notification',
    category: 'Foley & UI',
    durationSeconds: 1.1,
    description: 'Pristine dual-harmonic bell chime',
    generateBuffer: (sr) => {
      const len = Math.floor(sr * 1.1);
      const buf = new Float32Array(len);
      for (let i = 0; i < len; i++) {
        const t = i / sr;
        const env = Math.exp(-t * 4.2);
        const osc1 = Math.sin(2 * Math.PI * 1046.5 * t);
        const osc2 = Math.sin(2 * Math.PI * 1318.5 * t) * 0.7;
        const osc3 = Math.sin(2 * Math.PI * 1567.98 * t) * 0.5;
        buf[i] = (osc1 + osc2 + osc3) * env * 0.35;
      }
      return buf;
    },
  },
];

export const AudioLibraryPanel: React.FC = () => {
  const {
    project,
    tracks,
    addAssetToTrack,
    importCustomAsset,
    playhead,
    startVoiceoverRecording,
    setActiveDragAsset,
  } = useTimelineStore();

  const [category, setCategory] = useState<
    'All' | 'Custom FX' | 'Cinematic' | 'Transitions' | 'Foley & UI' | 'Risers' | 'Project'
  >('All');
  const [playingSfxId, setPlayingSfxId] = useState<string | null>(null);
  const [customFxList, setCustomFxList] = useState<CustomAudioFxItem[]>([]);
  const activeSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load permanently saved custom audio FX from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_CUSTOM_FX);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setCustomFxList(parsed);
          // Pre-load audio buffers for fast preview and playback
          parsed.forEach((item: CustomAudioFxItem) => {
            if (item.filePath) loadAudioBuffer(item.filePath);
          });
        }
      }
    } catch (e) {
      console.warn('Failed to load custom audio FX from localStorage:', e);
    }
  }, []);

  // Save custom audio FX permanently to localStorage
  const saveCustomFxList = (list: CustomAudioFxItem[]) => {
    setCustomFxList(list);
    try {
      localStorage.setItem(STORAGE_KEY_CUSTOM_FX, JSON.stringify(list));
    } catch (e) {
      console.warn('Failed to save custom audio FX to localStorage:', e);
    }
  };

  // Import new custom audio FX permanently (via native Tauri file picker or file input)
  const handleImportCustomFx = async () => {
    if (isTauri) {
      try {
        const paths = await tauriInvoke<string[]>('open_file_dialog');
        if (paths && paths.length > 0) {
          await processImportedPaths(paths);
        }
      } catch (err) {
        console.warn('Failed to open audio file dialog:', err);
      }
    } else {
      fileInputRef.current?.click();
    }
  };

  const processImportedPaths = async (paths: string[]) => {
    const newItems: CustomAudioFxItem[] = [];

    for (const p of paths) {
      const filename = p.split(/[\\/]/).pop() || `Custom_SFX_${Date.now()}.wav`;
      let durationSec = 1.5;

      // Probe audio buffer duration
      try {
        const buf = await loadAudioBuffer(p);
        if (buf && buf.duration > 0) {
          durationSec = Number(buf.duration.toFixed(2));
        }
      } catch {}

      newItems.push({
        id: `custom-fx-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        name: filename,
        category: 'Custom FX',
        durationSeconds: durationSec,
        filePath: p,
        dateAdded: Date.now(),
      });
    }

    const updated = [...newItems, ...customFxList];
    saveCustomFxList(updated);
    setCategory('Custom FX');
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newItems: CustomAudioFxItem[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const blobUrl = URL.createObjectURL(file);
      let durationSec = 1.5;

      try {
        const buf = await loadAudioBuffer(blobUrl);
        if (buf && buf.duration > 0) {
          durationSec = Number(buf.duration.toFixed(2));
        }
      } catch {}

      newItems.push({
        id: `custom-fx-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        name: file.name,
        category: 'Custom FX',
        durationSeconds: durationSec,
        filePath: blobUrl,
        dateAdded: Date.now(),
      });
    }

    const updated = [...newItems, ...customFxList];
    saveCustomFxList(updated);
    setCategory('Custom FX');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Permanently delete a custom audio FX
  const handleDeleteCustomFx = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (playingSfxId === id && activeSourceRef.current) {
      try {
        activeSourceRef.current.stop();
      } catch {}
      activeSourceRef.current = null;
      setPlayingSfxId(null);
    }

    const updated = customFxList.filter((item) => item.id !== id);
    saveCustomFxList(updated);
  };

  // Real-time audition preview for both built-in synthesized presets and custom imported audio FX
  const handleTogglePreview = async (preset: SfxPreset) => {
    unlockAudioContext();
    const ctx = getSharedAudioContext();

    if (playingSfxId === preset.id && activeSourceRef.current) {
      try {
        activeSourceRef.current.stop();
      } catch {}
      activeSourceRef.current = null;
      setPlayingSfxId(null);
      return;
    }

    if (activeSourceRef.current) {
      try {
        activeSourceRef.current.stop();
      } catch {}
      activeSourceRef.current = null;
    }

    try {
      let buffer: AudioBuffer | null = null;

      if (preset.filePath) {
        // Custom imported audio FX
        buffer = getCachedAudioBuffer(preset.filePath) || (await loadAudioBuffer(preset.filePath));
      } else if (preset.generateBuffer) {
        // Built-in synthesized preset
        const sr = ctx.sampleRate || 48000;
        const samples = preset.generateBuffer(sr);
        buffer = ctx.createBuffer(1, samples.length, sr);
        buffer.copyToChannel(samples, 0);
      }

      if (!buffer) return;

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.onended = () => {
        setPlayingSfxId(null);
        activeSourceRef.current = null;
      };

      source.start(0);
      activeSourceRef.current = source;
      setPlayingSfxId(preset.id);
    } catch (err) {
      console.warn('Failed to play preview:', err);
    }
  };

  // Add preset or custom FX to timeline
  const handleAddSfxToTimeline = (preset: SfxPreset) => {
    let finalFilePath = preset.filePath;

    if (!finalFilePath && preset.generateBuffer) {
      const sr = 48000;
      const samples = preset.generateBuffer(sr);
      const wavBuffer = encodeWavPcm16(samples, sr);
      const blob = new Blob([wavBuffer], { type: 'audio/wav' });
      finalFilePath = URL.createObjectURL(blob);
    }

    if (!finalFilePath) return;

    const assetId = `asset-sfx-${preset.id}-${Date.now()}`;
    const newAsset: MediaAsset = {
      id: assetId,
      name: `${preset.name.replace(/\.[^/.]+$/, '')}.wav`,
      filePath: finalFilePath,
      mediaType: 'audio',
      durationSeconds: preset.durationSeconds,
      durationMs: preset.durationSeconds * 1000,
    };

    importCustomAsset(newAsset);

    const audioTrack = tracks.find((t) => t.trackType === 'audio' || t.type === 'audio') || tracks[0];
    if (audioTrack) {
      addAssetToTrack(newAsset.id, audioTrack.id, playhead);
    }
  };

  // Drag SFX preset or custom FX onto timeline
  const handlePointerDown = (preset: SfxPreset, e: React.PointerEvent) => {
    e.preventDefault();
    let finalFilePath = preset.filePath;

    if (!finalFilePath && preset.generateBuffer) {
      const sr = 48000;
      const samples = preset.generateBuffer(sr);
      const wavBuffer = encodeWavPcm16(samples, sr);
      const blob = new Blob([wavBuffer], { type: 'audio/wav' });
      finalFilePath = URL.createObjectURL(blob);
    }

    if (!finalFilePath) return;

    const assetId = `asset-sfx-${preset.id}-${Date.now()}`;
    const newAsset: MediaAsset = {
      id: assetId,
      name: `${preset.name.replace(/\.[^/.]+$/, '')}.wav`,
      filePath: finalFilePath,
      mediaType: 'audio',
      durationSeconds: preset.durationSeconds,
      durationMs: preset.durationSeconds * 1000,
    };

    importCustomAsset(newAsset);

    setActiveDragAsset({
      asset: newAsset,
      mouseX: e.clientX,
      mouseY: e.clientY,
    });

    const handlePointerMove = (moveEv: PointerEvent) => {
      setActiveDragAsset({
        asset: newAsset,
        mouseX: moveEv.clientX,
        mouseY: moveEv.clientY,
      });
    };

    const handlePointerUp = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      setActiveDragAsset(null);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  // Convert custom items into SfxPreset schema
  const customPresets: SfxPreset[] = customFxList.map((c) => ({
    id: c.id,
    name: c.name,
    category: 'Custom FX',
    durationSeconds: c.durationSeconds,
    description: 'User imported custom audio sound effect',
    filePath: c.filePath,
    isCustom: true,
  }));

  const projectAudioAssets = (project?.assets || []).filter((a) => a.mediaType === 'audio');
  const allSfxCombined = [...customPresets, ...SFX_PRESETS];

  const filteredPresets =
    category === 'All'
      ? allSfxCombined
      : category === 'Custom FX'
      ? customPresets
      : category === 'Project'
      ? []
      : SFX_PRESETS.filter((p) => p.category === category);

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#14161B] border-r border-[#222630] select-none">
      {/* Hidden file input for web fallback */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileInputChange}
        multiple
        accept="audio/*"
        className="hidden"
      />

      {/* Top Action Header: Import FX & Record Mic */}
      <div className="p-3 bg-[#111318] border-b border-[#222630] flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-[#00F0FF]/15 border border-[#00F0FF]/30 flex items-center justify-center text-[#00F0FF]">
            <Music size={13} />
          </div>
          <div>
            <div className="text-xs font-bold text-[#F0F3F8] flex items-center gap-1.5">
              <span>Sound Effects & Audio Library</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#00F0FF]/15 text-[#00F0FF]">
                {allSfxCombined.length} SFX
              </span>
            </div>
            <div className="text-[10px] text-[#64748B]">Audition and drag sound effects directly to audio tracks</div>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Import Custom FX Button */}
          <button
            onClick={handleImportCustomFx}
            className="px-2.5 py-1 rounded-md bg-[#1C202B] hover:bg-[#252B3A] border border-[#222630] hover:border-[#00F0FF]/50 text-[#F0F3F8] hover:text-[#00F0FF] text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
            title="Import custom sound effect files permanently"
          >
            <Upload size={12} className="text-[#00F0FF]" />
            <span>Import FX</span>
          </button>

          {/* Direct 1-Click Voiceover Recording */}
          <button
            onClick={() => startVoiceoverRecording()}
            className="px-2.5 py-1 rounded-md bg-red-500/20 hover:bg-red-500 border border-red-500/50 hover:border-red-500 text-red-400 hover:text-white text-[11px] font-bold flex items-center gap-1.5 transition-all shadow-[0_0_10px_rgba(239,68,68,0.25)] cursor-pointer"
            title="Direct 1-Click Voiceover Recording"
          >
            <Mic size={12} />
            <span>Record</span>
          </button>
        </div>
      </div>

      {/* Filter Category Pills */}
      <div className="p-2 border-b border-[#1C202B] flex items-center gap-1 overflow-x-auto shrink-0 scrollbar-none">
        {(
          [
            'All',
            'Custom FX',
            'Cinematic',
            'Transitions',
            'Foley & UI',
            'Risers',
            'Project',
          ] as const
        ).map((cat) => {
          const count =
            cat === 'Custom FX'
              ? customFxList.length
              : cat === 'Project'
              ? projectAudioAssets.length
              : undefined;

          return (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`px-2.5 py-1 rounded text-[11px] font-bold transition-all whitespace-nowrap cursor-pointer ${
                category === cat
                  ? 'bg-[#00F0FF]/15 text-[#00F0FF] border border-[#00F0FF]/40'
                  : 'bg-[#181B22] text-[#8A92A6] hover:text-[#F0F3F8] border border-[#222630]'
              }`}
            >
              {cat === 'Custom FX' ? `Custom FX (${customFxList.length})` : cat === 'Project' ? `Project Audio (${projectAudioAssets.length})` : cat}
            </button>
          );
        })}
      </div>

      {/* Audio Items List */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
        {category === 'Custom FX' && customFxList.length === 0 ? (
          <div className="py-12 flex flex-col items-center justify-center text-center text-[#64748B] space-y-3">
            <div className="w-10 h-10 rounded-full bg-[#1C202B] flex items-center justify-center text-[#00F0FF]">
              <Upload size={20} />
            </div>
            <div>
              <div className="text-xs font-bold text-[#F0F3F8]">No Custom FX Imported Yet</div>
              <div className="text-[11px] max-w-xs mt-1">
                Import your own WAV, MP3, or M4A sound effects to keep them saved permanently across all projects.
              </div>
            </div>
            <button
              onClick={handleImportCustomFx}
              className="px-3 py-1.5 rounded-md bg-[#00F0FF]/20 hover:bg-[#00F0FF] text-[#00F0FF] hover:text-[#0D0E11] text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Upload size={12} />
              <span>Import Audio FX Now</span>
            </button>
          </div>
        ) : category === 'Project' ? (
          projectAudioAssets.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center text-[#64748B] space-y-2">
              <Music size={28} className="opacity-40" />
              <div className="text-xs font-bold">No Audio Files in Project</div>
              <div className="text-[11px] max-w-xs">
                Import audio in Media Pool or record a voiceover to see files here.
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              {projectAudioAssets.map((asset) => (
                <div
                  key={asset.id}
                  className="p-2 rounded-lg bg-[#0D0E11] border border-[#222630] hover:border-[#00F0FF]/50 flex items-center justify-between gap-3 group transition-all"
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <div className="w-7 h-7 rounded bg-[#1A1E27] border border-[#282E3C] flex items-center justify-center text-[#00F0FF] shrink-0">
                      <Volume2 size={13} />
                    </div>
                    <div className="truncate">
                      <div className="text-xs font-bold text-[#F0F3F8] truncate">{asset.name}</div>
                      <div className="text-[10px] font-mono text-[#64748B]">
                        {(asset.durationSeconds || 0).toFixed(1)}s • Audio File
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      const audioTrack = tracks.find((t) => t.trackType === 'audio' || t.type === 'audio') || tracks[0];
                      if (audioTrack) {
                        addAssetToTrack(asset.id, audioTrack.id, playhead);
                      }
                    }}
                    className="p-1.5 rounded bg-[#1C202B] hover:bg-[#00F0FF] text-[#8A92A6] hover:text-[#0D0E11] transition-all cursor-pointer"
                    title="Add to Timeline at Playhead"
                  >
                    <Plus size={13} />
                  </button>
                </div>
              ))}
            </div>
          )
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {filteredPresets.map((preset) => {
              const isPlaying = playingSfxId === preset.id;
              return (
                <div
                  key={preset.id}
                  onPointerDown={(e) => handlePointerDown(preset, e)}
                  className={`group relative bg-[#0D0E11] hover:bg-[#161922] border rounded-lg p-2.5 flex flex-col justify-between transition-all cursor-grab active:cursor-grabbing hover:shadow-[0_4px_16px_rgba(0,240,255,0.15)] ${
                    preset.isCustom
                      ? 'border-[#00F0FF]/40 hover:border-[#00F0FF]'
                      : 'border-[#222630] hover:border-[#00F0FF]/70'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 truncate">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleTogglePreview(preset);
                        }}
                        className={`w-7 h-7 rounded-full flex items-center justify-center transition-all cursor-pointer shrink-0 ${
                          isPlaying
                            ? 'bg-[#00F0FF] text-[#0D0E11] animate-pulse shadow-[0_0_10px_#00F0FF]'
                            : 'bg-[#1C202B] hover:bg-[#00F0FF] text-[#00F0FF] hover:text-[#0D0E11]'
                        }`}
                        title={isPlaying ? 'Stop Preview' : 'Audition Sound Effect'}
                      >
                        {isPlaying ? <Square size={10} fill="currentColor" /> : <Play size={10} fill="currentColor" />}
                      </button>
                      <div className="truncate">
                        <div className="text-xs font-bold text-[#F0F3F8] group-hover:text-[#00F0FF] transition-colors leading-tight truncate">
                          {preset.name}
                        </div>
                        <span
                          className={`text-[9px] font-mono font-bold uppercase tracking-wider ${
                            preset.isCustom ? 'text-[#10B981]' : 'text-[#00F0FF]'
                          }`}
                        >
                          {preset.isCustom ? 'CUSTOM FX' : preset.category}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {/* Delete button for custom imported FX */}
                      {preset.isCustom && (
                        <button
                          onClick={(e) => handleDeleteCustomFx(preset.id, e)}
                          className="p-1 rounded bg-[#1C202B] hover:bg-red-500/20 text-[#64748B] hover:text-red-400 transition-all cursor-pointer"
                          title="Delete this custom sound effect permanently"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAddSfxToTimeline(preset);
                        }}
                        className="p-1 rounded bg-[#1C202B] hover:bg-[#00F0FF] text-[#8A92A6] hover:text-[#0D0E11] transition-all cursor-pointer"
                        title="Add to Timeline at Playhead"
                      >
                        <Plus size={12} />
                      </button>
                    </div>
                  </div>

                  <p className="text-[10px] text-[#64748B] mt-2 line-clamp-1 group-hover:text-[#8A92A6] transition-colors">
                    {preset.description}
                  </p>

                  <div className="mt-2.5 flex items-center justify-between text-[10px] font-mono text-[#525D73] pt-1.5 border-t border-[#1C202B]">
                    <span>{preset.durationSeconds}s</span>
                    <span className="text-[9px] group-hover:text-[#00F0FF] transition-colors">Drag to Track</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
