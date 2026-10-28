import React, { useState } from 'react';
import {
  Palette,
  RotateCcw,
  Sun,
  Thermometer,
  Layers,
  Sparkles,
  Sliders,
  Tv,
  FolderOpen,
  Eye,
  SlidersHorizontal,
  Download,
  Trash2,
  Save,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Diamond, Pipette } from '@/components/Icons';
import {
  ColorGradingProfile,
  ColorWheel,
  SplineCurves,
  HslQualifier,
  SplitToning,
  SelectiveColorAdjustment,
  Clip,
  MediaTrack,
} from '../../types/ipc';
import { ColorWheelsPanel } from './ColorWheels';
import { SplineCurvesPanel } from './SplineCurves';
import { DEFAULT_COLOR_GRADING_PROFILE, useTimelineStore, isTauri, tauriInvoke } from '../../store/timelineStore';

interface ColorGradingInspectorProps {
  scope: 'clip' | 'track' | 'master';
  onSelectScope: (scope: 'clip' | 'track' | 'master') => void;
  selectedClip: Clip | null;
  parentTrack: MediaTrack | null;
  tracks: MediaTrack[];
  masterGrading: ColorGradingProfile | null;
  updateClipGradingProfile: (clipId: string, grading: Partial<ColorGradingProfile>) => void;
  resetClipGradingProfile: (clipId: string) => void;
  updateTrackGrading: (trackId: string, grading: Partial<ColorGradingProfile>) => void;
  resetTrackGrading: (trackId: string) => void;
  updateMasterGrading: (grading: Partial<ColorGradingProfile>) => void;
  resetMasterGrading: () => void;
  onAddAdjustmentLayer?: () => void;
}

// 8 selective color bands matching CapCut / professional color suites
const SELECTIVE_COLOR_PRESETS = [
  {
    id: 'red',
    name: 'Red',
    color: '#EF4444',
    hue: 0,
    hueGradient: 'linear-gradient(to right, #EC4899, #EF4444, #F97316)',
    leftName: 'Magenta',
    leftColor: '#EC4899',
    rightName: 'Orange',
    rightColor: '#F97316',
  },
  {
    id: 'orange',
    name: 'Orange',
    color: '#F97316',
    hue: 30,
    hueGradient: 'linear-gradient(to right, #EF4444, #F97316, #EAB308)',
    leftName: 'Red',
    leftColor: '#EF4444',
    rightName: 'Yellow',
    rightColor: '#EAB308',
  },
  {
    id: 'yellow',
    name: 'Yellow',
    color: '#EAB308',
    hue: 60,
    hueGradient: 'linear-gradient(to right, #F97316, #EAB308, #22C55E)',
    leftName: 'Orange',
    leftColor: '#F97316',
    rightName: 'Green',
    rightColor: '#22C55E',
  },
  {
    id: 'green',
    name: 'Green',
    color: '#22C55E',
    hue: 120,
    hueGradient: 'linear-gradient(to right, #EAB308, #22C55E, #06B6D4)',
    leftName: 'Yellow',
    leftColor: '#EAB308',
    rightName: 'Cyan',
    rightColor: '#06B6D4',
  },
  {
    id: 'cyan',
    name: 'Cyan',
    color: '#06B6D4',
    hue: 180,
    hueGradient: 'linear-gradient(to right, #22C55E, #06B6D4, #3B82F6)',
    leftName: 'Green',
    leftColor: '#22C55E',
    rightName: 'Blue',
    rightColor: '#3B82F6',
  },
  {
    id: 'blue',
    name: 'Blue',
    color: '#3B82F6',
    hue: 220,
    hueGradient: 'linear-gradient(to right, #06B6D4, #3B82F6, #A855F7)',
    leftName: 'Cyan',
    leftColor: '#06B6D4',
    rightName: 'Purple',
    rightColor: '#A855F7',
  },
  {
    id: 'purple',
    name: 'Purple',
    color: '#A855F7',
    hue: 270,
    hueGradient: 'linear-gradient(to right, #3B82F6, #A855F7, #EC4899)',
    leftName: 'Blue',
    leftColor: '#3B82F6',
    rightName: 'Magenta',
    rightColor: '#EC4899',
  },
  {
    id: 'magenta',
    name: 'Magenta',
    color: '#EC4899',
    hue: 315,
    hueGradient: 'linear-gradient(to right, #A855F7, #EC4899, #EF4444)',
    leftName: 'Purple',
    leftColor: '#A855F7',
    rightName: 'Red',
    rightColor: '#EF4444',
  },
] as const;

type SelectiveColorId = typeof SELECTIVE_COLOR_PRESETS[number]['id'];

function hexToHue(hex: string): number {
  const clean = hex.replace('#', '');
  if (clean.length < 6) return 0;
  const r = parseInt(clean.substring(0, 2), 16) / 255;
  const g = parseInt(clean.substring(2, 4), 16) / 255;
  const b = parseInt(clean.substring(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  if (max === min) return 0;
  const d = max - min;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else if (max === b) h = (r - g) / d + 4;
  return Math.round((h * 60) % 360);
}

// Reusable single adjustment row matching the user's reference images
const AdjustmentSliderRow: React.FC<{
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  trackGradient?: string;
  leftHint?: { name: string; color: string };
  rightHint?: { name: string; color: string };
  onChange: (val: number) => void;
  onReset?: () => void;
}> = ({ label, value, min = -100, max = 100, step = 1, trackGradient, leftHint, rightHint, onChange, onReset }) => {
  return (
    <div className="py-1">
      <div className="flex items-center gap-3">
        <span className="text-[12px] text-[#D1D5DB] font-medium w-20 shrink-0 truncate">{label}</span>

        {/* Slider Track */}
        <div className="flex-1 relative flex items-center">
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
            style={trackGradient ? { background: trackGradient } : undefined}
            className={`w-full h-1.5 rounded-full appearance-none cursor-pointer accent-[#00F0FF] ${
              trackGradient ? '' : 'bg-[#282B33]'
            }`}
          />
        </div>

        {/* Number Box with Steppers and Keyframe Diamond */}
        <div className="flex items-center gap-1 shrink-0">
          <div className="w-14 h-6 bg-[#16181E] border border-[#262A34] rounded flex items-center justify-between px-1">
            <input
              type="number"
              min={min}
              max={max}
              value={value}
              onChange={(e) => {
                const parsed = parseInt(e.target.value, 10);
                onChange(isNaN(parsed) ? 0 : Math.max(min, Math.min(max, parsed)));
              }}
              className="w-7 text-[11px] font-mono text-center text-[#F3F4F6] bg-transparent outline-none p-0"
            />
            <div className="flex flex-col text-[#6B7280] leading-none select-none">
              <button
                type="button"
                onClick={() => onChange(Math.min(max, value + 1))}
                className="hover:text-white text-[7px] p-0 cursor-pointer"
              >
                ▲
              </button>
              <button
                type="button"
                onClick={() => onChange(Math.max(min, value - 1))}
                className="hover:text-white text-[7px] p-0 cursor-pointer"
              >
                ▼
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={onReset || (() => onChange(0))}
            title="Reset to 0"
            className="p-1 text-[#6B7280] hover:text-[#00F0FF] transition-colors cursor-pointer"
          >
            <Diamond size={11} fill={value !== 0 ? 'currentColor' : 'none'} />
          </button>
        </div>
      </div>

      {/* Optional reference hint underneath slider (e.g. for Hue) */}
      {(leftHint || rightHint) && (
        <div className="flex items-center justify-between pl-20 pr-16 text-[9px] font-mono pt-1 leading-none select-none">
          {leftHint ? (
            <span className="flex items-center gap-1.5 opacity-90 hover:opacity-100 transition-opacity" style={{ color: leftHint.color }}>
              <span className="w-1.5 h-1.5 rounded-full inline-block shrink-0 shadow-xs" style={{ backgroundColor: leftHint.color }} />
              <span>{leftHint.name}</span>
            </span>
          ) : <span />}
          {rightHint ? (
            <span className="flex items-center gap-1.5 opacity-90 hover:opacity-100 transition-opacity" style={{ color: rightHint.color }}>
              <span>{rightHint.name}</span>
              <span className="w-1.5 h-1.5 rounded-full inline-block shrink-0 shadow-xs" style={{ backgroundColor: rightHint.color }} />
            </span>
          ) : <span />}
        </div>
      )}
    </div>
  );
};

export const ColorGradingInspector: React.FC<ColorGradingInspectorProps> = ({
  scope,
  onSelectScope,
  selectedClip,
  parentTrack,
  tracks,
  masterGrading,
  updateClipGradingProfile,
  resetClipGradingProfile,
  updateTrackGrading,
  resetTrackGrading,
  updateMasterGrading,
  resetMasterGrading,
  onAddAdjustmentLayer,
}) => {
  const colorGradingPresets = useTimelineStore((state) => state.colorGradingPresets) || [];
  const saveColorGradingPreset = useTimelineStore((state) => state.saveColorGradingPreset);
  const deleteColorGradingPreset = useTimelineStore((state) => state.deleteColorGradingPreset);
  const applyColorGradingPreset = useTimelineStore((state) => state.applyColorGradingPreset);
  const exportProfileAsCubeLut = useTimelineStore((state) => state.exportProfileAsCubeLut);

  const [selectedPresetId, setSelectedPresetId] = useState<string>('');
  const [isSavingPreset, setIsSavingPreset] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');

  // HSL Selective 8-Color Card States
  const [hslEnabled, setHslEnabled] = useState(true);
  const [selectedColorKey, setSelectedColorKey] = useState<SelectiveColorId>('red');

  // Accordion Section Visibility
  const [showAdvancedCurves, setShowAdvancedCurves] = useState(true);
  const [showColorWheels, setShowColorWheels] = useState(false);
  const [showScopesTarget, setShowScopesTarget] = useState(false);

  // Determine active profile based on scope
  const activeProfile: ColorGradingProfile =
    scope === 'clip'
      ? selectedClip?.colorGrading || {
          ...DEFAULT_COLOR_GRADING_PROFILE,
          exposure: selectedClip?.colorGrading?.exposure ?? 0,
          contrast: selectedClip?.colorGrading?.contrast ?? 1,
          saturation: selectedClip?.colorGrading?.saturation ?? 1,
          temperature: selectedClip?.colorGrading?.temperature ?? 0,
          lutPath: selectedClip?.lutPath,
        }
      : scope === 'track'
      ? parentTrack?.trackGrading || { ...DEFAULT_COLOR_GRADING_PROFILE }
      : masterGrading || { ...DEFAULT_COLOR_GRADING_PROFILE };

  const handleUpdate = (updates: Partial<ColorGradingProfile>) => {
    if (scope === 'clip' && selectedClip) {
      updateClipGradingProfile(selectedClip.id, updates);
    } else if (scope === 'track' && parentTrack) {
      updateTrackGrading(parentTrack.id, updates);
    } else if (scope === 'master') {
      updateMasterGrading(updates);
    }
  };

  const handleResetCurrent = () => {
    if (scope === 'clip' && selectedClip) {
      resetClipGradingProfile(selectedClip.id);
    } else if (scope === 'track' && parentTrack) {
      resetTrackGrading(parentTrack.id);
    } else if (scope === 'master') {
      resetMasterGrading();
    }
  };

  const trackClipCount = parentTrack ? parentTrack.clips?.length || 0 : 0;

  // Selective 8-Color Adjustment handler
  const currentSelective: SelectiveColorAdjustment =
    activeProfile.selectiveColors?.[selectedColorKey] ?? { hue: 0, saturation: 0, brightness: 0 };

  const handleUpdateSelectiveColor = (updates: Partial<SelectiveColorAdjustment>) => {
    const existing = activeProfile.selectiveColors || {};
    const curr = existing[selectedColorKey] || { hue: 0, saturation: 0, brightness: 0 };
    const next = {
      ...existing,
      [selectedColorKey]: { ...curr, ...updates },
    };
    handleUpdate({ selectiveColors: next });
  };

  const handleResetSelectiveColor = () => {
    const existing = { ...(activeProfile.selectiveColors || {}) };
    delete existing[selectedColorKey];
    handleUpdate({ selectiveColors: existing });
  };

  const handleResetAllSelective = () => {
    handleUpdate({ selectiveColors: {} });
  };

  // Eyedropper handler
  const handleEyedropper = async () => {
    if (typeof window !== 'undefined' && 'EyeDropper' in window) {
      try {
        const eyeDropper = new (window as any).EyeDropper();
        const res = await eyeDropper.open();
        if (res?.sRGBHex) {
          const h = hexToHue(res.sRGBHex);
          // Find closest preset color
          let closestKey: SelectiveColorId = 'red';
          let minDiff = 999;
          for (const p of SELECTIVE_COLOR_PRESETS) {
            const diff = Math.min(Math.abs(p.hue - h), 360 - Math.abs(p.hue - h));
            if (diff < minDiff) {
              minDiff = diff;
              closestKey = p.id;
            }
          }
          setSelectedColorKey(closestKey);
        }
      } catch {
        // Dismissed
      }
    }
  };

  const activeColorObj = SELECTIVE_COLOR_PRESETS.find((c) => c.id === selectedColorKey) || SELECTIVE_COLOR_PRESETS[0];

  return (
    <div className="space-y-3.5 select-none pb-6">
      {/* Scope Switcher Collapsible Drawer (Optional/Advanced Toggle) */}
      <div className="p-2.5 rounded-lg bg-[#0A0C10] border border-[#222630] space-y-2">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setShowScopesTarget(!showScopesTarget)}
            className="flex items-center gap-1.5 text-[11px] font-bold text-[#8A92A6] hover:text-[#00F0FF] uppercase tracking-wider transition-colors cursor-pointer"
          >
            <Layers size={13} className="text-[#00F0FF]" />
            <span>Target Scope: {scope.toUpperCase()}</span>
            {showScopesTarget ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>

          {onAddAdjustmentLayer && (
            <button
              onClick={onAddAdjustmentLayer}
              title="Add New Adjustment Layer to Timeline"
              className="px-2 py-0.5 rounded bg-[#A855F7]/15 hover:bg-[#A855F7]/30 text-[#A855F7] text-[10px] font-mono flex items-center gap-1 border border-[#A855F7]/30 transition-colors cursor-pointer"
            >
              <span>+ Adjustment Layer</span>
            </button>
          )}
        </div>

        {showScopesTarget && (
          <div className="grid grid-cols-3 gap-1 bg-[#14161F] p-1 rounded-lg border border-[#222630]">
            <button
              onClick={() => onSelectScope('clip')}
              className={`py-1.5 px-2 rounded text-xs font-mono font-bold transition-all truncate cursor-pointer ${
                scope === 'clip'
                  ? 'bg-[#00F0FF] text-[#0D0E11] shadow-[0_0_10px_rgba(0,240,255,0.4)]'
                  : 'text-[#8A92A6] hover:text-[#F0F3F8]'
              }`}
            >
              Clip
            </button>
            <button
              onClick={() => onSelectScope('track')}
              className={`py-1.5 px-2 rounded text-xs font-mono font-bold transition-all truncate cursor-pointer ${
                scope === 'track'
                  ? 'bg-[#00F0FF] text-[#0D0E11] shadow-[0_0_10px_rgba(0,240,255,0.4)]'
                  : 'text-[#8A92A6] hover:text-[#F0F3F8]'
              }`}
            >
              Track: {parentTrack?.name || 'V1'}
            </button>
            <button
              onClick={() => onSelectScope('master')}
              className={`py-1.5 px-2 rounded text-xs font-mono font-bold transition-all truncate cursor-pointer ${
                scope === 'master'
                  ? 'bg-[#00F0FF] text-[#0D0E11] shadow-[0_0_10px_rgba(0,240,255,0.4)]'
                  : 'text-[#8A92A6] hover:text-[#F0F3F8]'
              }`}
            >
              Master Bus
            </button>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 1. LIGHTNESS CARD (Image 2: Exposure, Contrast, Highlight, Shadow, etc.)   */}
      {/* ========================================================================= */}
      <div className="p-3 rounded-lg bg-[#0E1015] border border-[#222630] space-y-2">
        <div className="flex items-center justify-between pb-1">
          <span className="text-xs font-bold text-[#F0F3F8]">Lightness</span>
          <button
            onClick={() =>
              handleUpdate({
                exposure: 0,
                contrast: 1,
                highlights: 0,
                shadows: 0,
                whites: 0,
                blacks: 0,
                brilliance: 0,
              })
            }
            title="Reset Lightness"
            className="text-[#64748B] hover:text-[#00F0FF] transition-colors cursor-pointer"
          >
            <RotateCcw size={11} />
          </button>
        </div>

        {/* Exposure (-100 to 100, maps to -4.0 to +4.0 EV) */}
        <AdjustmentSliderRow
          label="Exposure"
          value={Math.round((activeProfile.exposure ?? 0) * 25)}
          min={-100}
          max={100}
          onChange={(val) => handleUpdate({ exposure: val / 25 })}
        />

        {/* Contrast (-100 to 100, maps to 0.0 to 2.0) */}
        <AdjustmentSliderRow
          label="Contrast"
          value={Math.round(((activeProfile.contrast ?? 1) - 1) * 100)}
          min={-100}
          max={100}
          onChange={(val) => handleUpdate({ contrast: 1 + val / 100 })}
        />

        {/* Highlight (-100 to 100) */}
        <AdjustmentSliderRow
          label="Highlight"
          value={Math.round((activeProfile.highlights ?? 0) * 100)}
          min={-100}
          max={100}
          onChange={(val) => handleUpdate({ highlights: val / 100 })}
        />

        {/* Shadow (-100 to 100) */}
        <AdjustmentSliderRow
          label="Shadow"
          value={Math.round((activeProfile.shadows ?? 0) * 100)}
          min={-100}
          max={100}
          onChange={(val) => handleUpdate({ shadows: val / 100 })}
        />

        {/* Whites (-100 to 100) */}
        <AdjustmentSliderRow
          label="Whites"
          value={Math.round((activeProfile.whites ?? 0) * 100)}
          min={-100}
          max={100}
          onChange={(val) => handleUpdate({ whites: val / 100 })}
        />

        {/* Blacks (-100 to 100) */}
        <AdjustmentSliderRow
          label="Blacks"
          value={Math.round((activeProfile.blacks ?? 0) * 100)}
          min={-100}
          max={100}
          onChange={(val) => handleUpdate({ blacks: val / 100 })}
        />

        {/* Brilliance (-100 to 100) */}
        <AdjustmentSliderRow
          label="Brilliance"
          value={Math.round((activeProfile.brilliance ?? 0) * 100)}
          min={-100}
          max={100}
          onChange={(val) => handleUpdate({ brilliance: val / 100 })}
        />
      </div>

      {/* ========================================================================= */}
      {/* 3. EFFECTS CARD (Image 3: Sharpen, Clarity, Particles, Fade, Vignette)    */}
      {/* ========================================================================= */}
      <div className="p-3 rounded-lg bg-[#0E1015] border border-[#222630] space-y-2">
        <div className="flex items-center justify-between pb-1">
          <span className="text-xs font-bold text-[#F0F3F8]">Effects</span>
          <button
            onClick={() =>
              handleUpdate({
                sharpen: 0,
                clarity: 0,
                particles: 0,
                fade: 0,
                vignette: 0,
              })
            }
            title="Reset Effects"
            className="text-[#64748B] hover:text-[#00F0FF] transition-colors cursor-pointer"
          >
            <RotateCcw size={11} />
          </button>
        </div>

        {/* Sharpen (0 to 100) */}
        <AdjustmentSliderRow
          label="Sharpen"
          value={Math.round(activeProfile.sharpen ?? 0)}
          min={0}
          max={100}
          onChange={(val) => handleUpdate({ sharpen: val })}
        />

        {/* Clarity (-100 to 100) */}
        <AdjustmentSliderRow
          label="Clarity"
          value={Math.round(activeProfile.clarity ?? 0)}
          min={-100}
          max={100}
          onChange={(val) => handleUpdate({ clarity: val })}
        />

        {/* Particles / Film Grain (0 to 100) */}
        <AdjustmentSliderRow
          label="Particles"
          value={Math.round(activeProfile.particles ?? 0)}
          min={0}
          max={100}
          onChange={(val) => handleUpdate({ particles: val })}
        />

        {/* Fade (0 to 100) */}
        <AdjustmentSliderRow
          label="Fade"
          value={Math.round(activeProfile.fade ?? 0)}
          min={0}
          max={100}
          onChange={(val) => handleUpdate({ fade: val })}
        />

        {/* Vignette (0 to 100) */}
        <AdjustmentSliderRow
          label="Vignette"
          value={Math.round(activeProfile.vignette ?? 0)}
          min={0}
          max={100}
          onChange={(val) => handleUpdate({ vignette: val })}
        />

        {/* Save as preset button directly inside Effects card, matching Image 3 */}
        <div className="pt-2">
          {isSavingPreset ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (newPresetName.trim()) {
                  const newId = saveColorGradingPreset(newPresetName.trim(), activeProfile);
                  setSelectedPresetId(newId);
                  setNewPresetName('');
                  setIsSavingPreset(false);
                }
              }}
              className="flex items-center gap-1.5 animate-in fade-in"
            >
              <input
                type="text"
                autoFocus
                placeholder="Preset Name (e.g. My Cinematic Look)..."
                value={newPresetName}
                onChange={(e) => setNewPresetName(e.target.value)}
                className="flex-1 bg-[#14161B] border border-[#00F0FF]/60 rounded px-2.5 py-1 text-xs text-[#F0F3F8] outline-none"
              />
              <button
                type="submit"
                className="px-3 py-1 bg-[#00F0FF] hover:bg-[#34f3ff] text-[#0D0E11] rounded text-xs font-bold transition-all cursor-pointer"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setIsSavingPreset(false)}
                className="px-2 py-1 text-xs text-[#8A92A6] hover:text-white"
              >
                Cancel
              </button>
            </form>
          ) : (
            <button
              onClick={() => setIsSavingPreset(true)}
              className="w-full py-2 px-4 rounded bg-[#06B6D4] hover:bg-[#22D3EE] text-[#0A0C10] font-bold text-xs flex items-center justify-center gap-1.5 shadow-[0_0_12px_rgba(6,182,212,0.3)] transition-all cursor-pointer"
            >
              <Save size={13} />
              <span>Save as preset</span>
            </button>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. HSL CARD (8-Color Selective Palette - Renamed from Basic to HSL)       */}
      {/* ========================================================================= */}
      <div className="p-3 rounded-lg bg-[#0E1015] border border-[#222630] space-y-3">
        {/* Card Header: Checkbox + "HSL" + Reset + Keyframe */}
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={hslEnabled}
              onChange={(e) => setHslEnabled(e.target.checked)}
              className="w-4 h-4 rounded border-[#2E3340] accent-[#00F0FF] cursor-pointer"
            />
            <span className="text-xs font-bold text-[#F0F3F8]">HSL</span>
          </label>

          <div className="flex items-center gap-2">
            <button
              onClick={handleResetAllSelective}
              title="Reset All HSL Colors"
              className="text-[#64748B] hover:text-white transition-colors cursor-pointer"
            >
              <RotateCcw size={12} />
            </button>
            <button
              title="Keyframe HSL"
              className="text-[#64748B] hover:text-[#00F0FF] transition-colors cursor-pointer"
            >
              <Diamond size={13} fill="none" />
            </button>
          </div>
        </div>

        {/* Eyedropper + 8 Selective Color Circles */}
        <div className="flex items-center justify-between pt-1 pb-1">
          {/* Eyedropper Button */}
          <button
            onClick={handleEyedropper}
            title="Sample Color from Screen"
            className="w-7 h-7 rounded-full bg-[#1F232D] hover:bg-[#2B313F] text-[#8A92A6] hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
          >
            <Pipette size={13} />
          </button>

          {/* 8 Color Circles */}
          {SELECTIVE_COLOR_PRESETS.map((preset) => {
            const isSelected = selectedColorKey === preset.id;
            return (
              <button
                key={preset.id}
                onClick={() => setSelectedColorKey(preset.id)}
                title={preset.name}
                className={`relative w-6 h-6 rounded-full transition-all cursor-pointer flex items-center justify-center ${
                  isSelected
                    ? 'ring-2 ring-white ring-offset-2 ring-offset-[#0E1015] scale-110 shadow-sm'
                    : 'hover:scale-105 opacity-85 hover:opacity-100'
                }`}
                style={{ backgroundColor: preset.color }}
              />
            );
          })}
        </div>

        {/* Sliders for the selected color band */}
        <div className={`space-y-2 pt-1 transition-opacity ${hslEnabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
          <AdjustmentSliderRow
            label="Hue"
            value={currentSelective.hue}
            min={-100}
            max={100}
            trackGradient={activeColorObj.hueGradient}
            leftHint={{ name: activeColorObj.leftName, color: activeColorObj.leftColor }}
            rightHint={{ name: activeColorObj.rightName, color: activeColorObj.rightColor }}
            onChange={(val) => handleUpdateSelectiveColor({ hue: val })}
            onReset={handleResetSelectiveColor}
          />

          <AdjustmentSliderRow
            label="Saturation"
            value={currentSelective.saturation}
            min={-100}
            max={100}
            trackGradient={`linear-gradient(to right, #4B5563, ${activeColorObj.color})`}
            onChange={(val) => handleUpdateSelectiveColor({ saturation: val })}
            onReset={handleResetSelectiveColor}
          />

          <AdjustmentSliderRow
            label="Brightness"
            value={currentSelective.brightness}
            min={-100}
            max={100}
            trackGradient={`linear-gradient(to right, #111827, ${activeColorObj.color}, #FFFFFF)`}
            onChange={(val) => handleUpdateSelectiveColor({ brightness: val })}
            onReset={handleResetSelectiveColor}
          />
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. PRESETS & CUSTOM LUT MANAGER                                           */}
      {/* ========================================================================= */}
      <div className="p-3 rounded-lg bg-[#0E1015] border border-[#222630] space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-[#F0F3F8] flex items-center gap-1.5">
            <Sparkles size={13} className="text-[#00F0FF]" />
            <span>Preset Looks & .CUBE LUTs</span>
          </span>
          <button
            onClick={() => {
              const currentPreset = colorGradingPresets.find((p) => p.id === selectedPresetId);
              exportProfileAsCubeLut(
                activeProfile,
                `${(currentPreset?.name || 'Custom_Adjustment').replace(/\s+/g, '_')}.cube`
              );
            }}
            title="Export Current Adjustment as standard .cube 3D LUT"
            className="flex items-center gap-1 px-2 py-0.5 rounded bg-[#1A1D24] hover:bg-[#222630] border border-[#222630] text-[#00F0FF] text-[10px] font-mono transition-colors cursor-pointer"
          >
            <Download size={11} />
            <span>Export .CUBE</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={selectedPresetId}
            onChange={(e) => {
              const pid = e.target.value;
              setSelectedPresetId(pid);
              if (pid) {
                applyColorGradingPreset(pid, scope);
              }
            }}
            className="flex-1 bg-[#14161B] border border-[#222630] focus:border-[#00F0FF] rounded px-2.5 py-1.5 text-xs font-mono text-[#F0F3F8] outline-none cursor-pointer"
          >
            <option value="">-- Apply a Saved Preset --</option>
            <optgroup label="Built-in Looks">
              {colorGradingPresets
                .filter((p) => p.isBuiltIn)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </optgroup>
            {colorGradingPresets.some((p) => !p.isBuiltIn) && (
              <optgroup label="My Custom Presets">
                {colorGradingPresets
                  .filter((p) => !p.isBuiltIn)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
              </optgroup>
            )}
          </select>

          {selectedPresetId && !colorGradingPresets.find((p) => p.id === selectedPresetId)?.isBuiltIn && (
            <button
              onClick={() => {
                deleteColorGradingPreset(selectedPresetId);
                setSelectedPresetId('');
              }}
              title="Delete this saved preset"
              className="p-1.5 rounded bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 transition-colors cursor-pointer shrink-0"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 5. SPLINE CURVES (Collapsible Accordion)                                   */}
      {/* ========================================================================= */}
      <div className="rounded-lg bg-[#0E1015] border border-[#222630] overflow-hidden">
        <button
          onClick={() => setShowAdvancedCurves(!showAdvancedCurves)}
          className="w-full p-3 flex items-center justify-between text-xs font-bold text-[#F0F3F8] hover:bg-[#14161F] transition-colors cursor-pointer"
        >
          <span className="flex items-center gap-1.5">
            <SlidersHorizontal size={13} className="text-[#00F0FF]" />
            <span>Spline Curves</span>
          </span>
          {showAdvancedCurves ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>
        {showAdvancedCurves && (
          <div className="p-3 pt-0">
            <SplineCurvesPanel
              curves={activeProfile.curves}
              onChange={(curves) => handleUpdate({ curves })}
            />
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 6. 3-WAY COLOR WHEELS (Collapsible Accordion)                             */}
      {/* ========================================================================= */}
      <div className="rounded-lg bg-[#0E1015] border border-[#222630] overflow-hidden">
        <button
          onClick={() => setShowColorWheels(!showColorWheels)}
          className="w-full p-3 flex items-center justify-between text-xs font-bold text-[#F0F3F8] hover:bg-[#14161F] transition-colors cursor-pointer"
        >
          <span className="flex items-center gap-1.5">
            <Palette size={13} className="text-[#00F0FF]" />
            <span>3-Way Color Wheels & Tone Balance</span>
          </span>
          {showColorWheels ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>
        {showColorWheels && (
          <div className="p-3 pt-0 space-y-3">
            <ColorWheelsPanel
              lift={activeProfile.lift || { r: 0, g: 0, b: 0, luma: 0 }}
              gamma={activeProfile.gamma || { r: 0, g: 0, b: 0, luma: 0 }}
              gain={activeProfile.gain || { r: 0, g: 0, b: 0, luma: 0 }}
              offset={activeProfile.offset || { r: 0, g: 0, b: 0, luma: 0 }}
              onChange={(wheels) => handleUpdate(wheels)}
            />

            {/* Temperature & Tint */}
            <div className="p-3 rounded-lg bg-[#08090D] border border-[#222630] space-y-3">
              <AdjustmentSliderRow
                label="Temperature"
                value={Math.round(activeProfile.temperature ?? 0)}
                min={-100}
                max={100}
                trackGradient="linear-gradient(to right, #38BDF8, #1F2937, #F59E0B)"
                onChange={(val) => handleUpdate({ temperature: val })}
              />
              <AdjustmentSliderRow
                label="Tint"
                value={Math.round(activeProfile.tint ?? 0)}
                min={-100}
                max={100}
                trackGradient="linear-gradient(to right, #10B981, #1F2937, #EC4899)"
                onChange={(val) => handleUpdate({ tint: val })}
              />
              <AdjustmentSliderRow
                label="Saturation"
                value={Math.round(((activeProfile.saturation ?? 1) - 1) * 100)}
                min={-100}
                max={100}
                onChange={(val) => handleUpdate({ saturation: 1 + val / 100 })}
              />
              <AdjustmentSliderRow
                label="Vibrance"
                value={Math.round((activeProfile.vibrance ?? 0) * 100)}
                min={-100}
                max={100}
                onChange={(val) => handleUpdate({ vibrance: val / 100 })}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
