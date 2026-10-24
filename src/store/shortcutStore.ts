import { create } from 'zustand';
import { AppPreferences } from '../types/ipc';

export const isTauri =
  typeof window !== 'undefined' &&
  Boolean((window as any).__TAURI_INTERNALS__ || (window as any).__TAURI__);

async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (!isTauri) {
    throw new Error(`Tauri environment not available for invoke: ${cmd}`);
  }
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<T>(cmd, args);
}

export interface ShortcutAction {
  id: string;
  label: string;
  category: 'Playback' | 'Timeline' | 'Project' | 'Multicam';
  defaultKey: string;
  description: string;
}

export const SHORTCUT_DEFINITIONS: ShortcutAction[] = [
  {
    id: 'play_pause',
    label: 'Play / Pause',
    category: 'Playback',
    defaultKey: 'Space',
    description: 'Toggle timeline playback',
  },
  {
    id: 'shuttle_reverse',
    label: 'Shuttle Reverse',
    category: 'Playback',
    defaultKey: 'j',
    description: 'Step or play backward',
  },
  {
    id: 'shuttle_pause',
    label: 'Shuttle Pause',
    category: 'Playback',
    defaultKey: 'k',
    description: 'Pause playback',
  },
  {
    id: 'shuttle_forward',
    label: 'Shuttle Forward',
    category: 'Playback',
    defaultKey: 'l',
    description: 'Step or play forward',
  },
  {
    id: 'split_clip',
    label: 'Split / Razor at Playhead',
    category: 'Timeline',
    defaultKey: 'c',
    description: 'Slice selected clip or all clips at current playhead',
  },
  {
    id: 'delete_clip',
    label: 'Delete Selected Clip',
    category: 'Timeline',
    defaultKey: 'Delete',
    description: 'Remove selected clip from track',
  },
  {
    id: 'ripple_delete',
    label: 'Ripple Delete',
    category: 'Timeline',
    defaultKey: 'Shift+Delete',
    description: 'Remove clip and close timeline gap',
  },
  {
    id: 'toggle_snapping',
    label: 'Toggle Magnetic Snapping',
    category: 'Timeline',
    defaultKey: 's',
    description: 'Enable or disable magnetic edge snapping',
  },
  {
    id: 'ripple_mode',
    label: 'Toggle Ripple Editing Mode',
    category: 'Timeline',
    defaultKey: 'b',
    description: 'Toggle downstream ripple mode for clip trims and moves',
  },
  {
    id: 'undo',
    label: 'Undo Action',
    category: 'Timeline',
    defaultKey: 'Ctrl+z',
    description: 'Revert last edit or modification',
  },
  {
    id: 'redo',
    label: 'Redo Action',
    category: 'Timeline',
    defaultKey: 'Ctrl+y',
    description: 'Re-apply previously undone edit',
  },
  {
    id: 'save_project',
    label: 'Save Project',
    category: 'Project',
    defaultKey: 'Ctrl+s',
    description: 'Save project to .idts file',
  },
  {
    id: 'multicam_angle_1',
    label: 'Multicam Angle 1',
    category: 'Multicam',
    defaultKey: '1',
    description: 'Switch program cut to camera angle 1',
  },
  {
    id: 'multicam_angle_2',
    label: 'Multicam Angle 2',
    category: 'Multicam',
    defaultKey: '2',
    description: 'Switch program cut to camera angle 2',
  },
  {
    id: 'multicam_angle_3',
    label: 'Multicam Angle 3',
    category: 'Multicam',
    defaultKey: '3',
    description: 'Switch program cut to camera angle 3',
  },
  {
    id: 'multicam_angle_4',
    label: 'Multicam Angle 4',
    category: 'Multicam',
    defaultKey: '4',
    description: 'Switch program cut to camera angle 4',
  },
];

export function normalizeKeyEvent(e: KeyboardEvent): string {
  const parts: string[] = [];
  if (e.ctrlKey || e.metaKey) parts.push('Ctrl');
  if (e.altKey) parts.push('Alt');
  if (e.shiftKey) parts.push('Shift');

  let key = e.key;
  if (key === ' ') key = 'Space';
  else if (key === 'Escape') key = 'Esc';
  else if (key.length === 1) key = key.toLowerCase();

  // Don't append modifier key itself
  if (!['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) {
    parts.push(key);
  }

  return parts.join('+');
}

interface ShortcutStore {
  shortcuts: Record<string, string>;
  isSettingsModalOpen: boolean;
  recordingActionId: string | null;
  autoSaveIntervalSec: number;
  snappingEnabled: boolean;
  autoGenerateProxies: boolean;
  proxyResolution: string;
  proxyCodec: string;

  openSettingsModal: () => void;
  closeSettingsModal: () => void;
  startRecording: (actionId: string) => void;
  stopRecording: () => void;
  setShortcut: (actionId: string, keyCombo: string) => void;
  resetDefaults: () => void;
  setAutoGenerateProxies: (enabled: boolean) => void;
  setProxyResolution: (resolution: string) => void;
  setProxyCodec: (codec: string) => void;
  loadPreferences: () => Promise<void>;
  savePreferences: () => Promise<void>;
}

const DEFAULT_MAP = SHORTCUT_DEFINITIONS.reduce((acc, def) => {
  acc[def.id] = def.defaultKey;
  return acc;
}, {} as Record<string, string>);

export const useShortcutStore = create<ShortcutStore>((set, get) => ({
  shortcuts: { ...DEFAULT_MAP },
  isSettingsModalOpen: false,
  recordingActionId: null,
  autoSaveIntervalSec: 60,
  snappingEnabled: true,
  autoGenerateProxies: false,
  proxyResolution: '720p',
  proxyCodec: 'h264_nvenc',

  openSettingsModal: () => set({ isSettingsModalOpen: true }),
  closeSettingsModal: () => set({ isSettingsModalOpen: false, recordingActionId: null }),

  startRecording: (actionId: string) => set({ recordingActionId: actionId }),
  stopRecording: () => set({ recordingActionId: null }),

  setShortcut: (actionId: string, keyCombo: string) => {
    set((state) => ({
      shortcuts: { ...state.shortcuts, [actionId]: keyCombo },
      recordingActionId: null,
    }));
    get().savePreferences();
  },

  resetDefaults: () => {
    set({ shortcuts: { ...DEFAULT_MAP } });
    get().savePreferences();
  },

  setAutoGenerateProxies: (autoGenerateProxies: boolean) => {
    set({ autoGenerateProxies });
    get().savePreferences();
  },

  setProxyResolution: (proxyResolution: string) => {
    set({ proxyResolution });
    get().savePreferences();
  },

  setProxyCodec: (proxyCodec: string) => {
    set({ proxyCodec });
    get().savePreferences();
  },

  loadPreferences: async () => {
    if (!isTauri) {
      const stored = localStorage.getItem('idts_preferences');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (parsed.shortcuts) {
            set((state) => ({
              shortcuts: { ...state.shortcuts, ...parsed.shortcuts },
              autoSaveIntervalSec: parsed.autoSaveIntervalSec || 60,
              snappingEnabled: parsed.snappingEnabled !== false,
              autoGenerateProxies: Boolean(parsed.autoGenerateProxies),
              proxyResolution: parsed.proxyResolution || '720p',
              proxyCodec: parsed.proxyCodec || 'h264_nvenc',
            }));
          }
        } catch {}
      }
      return;
    }

    try {
      const prefs = await tauriInvoke<AppPreferences>('load_preferences');
      if (prefs) {
        set((state) => ({
          shortcuts: prefs.shortcuts ? { ...state.shortcuts, ...prefs.shortcuts } : state.shortcuts,
          autoSaveIntervalSec: prefs.autoSaveIntervalSec || 60,
          snappingEnabled: prefs.snappingEnabled !== false,
          autoGenerateProxies: Boolean(prefs.autoGenerateProxies),
          proxyResolution: prefs.proxyResolution || '720p',
          proxyCodec: prefs.proxyCodec || 'h264_nvenc',
        }));
      }
    } catch (err) {
      console.warn('Failed to load preferences from Tauri:', err);
    }
  },

  savePreferences: async () => {
    const {
      shortcuts,
      autoSaveIntervalSec,
      snappingEnabled,
      autoGenerateProxies,
      proxyResolution,
      proxyCodec,
    } = get();
    const prefs: AppPreferences = {
      shortcuts,
      autoSaveIntervalSec,
      theme: 'studio_dark',
      snappingEnabled,
      autoGenerateProxies,
      proxyResolution,
      proxyCodec,
    };

    if (!isTauri) {
      localStorage.setItem('idts_preferences', JSON.stringify(prefs));
      return;
    }

    try {
      await tauriInvoke('save_preferences', { prefs });
    } catch (err) {
      console.warn('Failed to save preferences to Tauri:', err);
    }
  },
}));
