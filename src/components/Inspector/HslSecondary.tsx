import React, { useState } from 'react';
import { Eye, ChevronDown, ChevronRight, RotateCcw } from 'lucide-react';
import { Pipette } from '@/components/Icons';
import { HslQualifier } from '../../types/ipc';

interface HslSecondaryProps {
  qualifier?: HslQualifier;
  onChange: (qualifier: HslQualifier) => void;
  onSampleColor?: () => void;
}

const DEFAULT_QUALIFIER: HslQualifier = {
  enabled: false,
  hueCenter: 180,
  hueWidth: 60,
  hueSoftness: 20,
  satCenter: 0.5,
  satWidth: 0.5,
  satSoftness: 0.2,
  lumCenter: 0.5,
  lumWidth: 0.5,
  lumSoftness: 0.2,
  isolatedHueShift: 0,
  isolatedSat: 1.0,
  isolatedGain: 1.0,
  showMatte: false,
};

export const HslSecondaryPanel: React.FC<HslSecondaryProps> = ({
  qualifier,
  onChange,
  onSampleColor,
}) => {
  const [isOpen, setIsOpen] = useState(true);

  const current: HslQualifier = qualifier || DEFAULT_QUALIFIER;

  const handleToggle = () => {
    onChange({ ...current, enabled: !current.enabled });
  };

  // Automatically enable qualifier when user moves any slider
  const updateQualifier = (updates: Partial<HslQualifier>) => {
    onChange({
      ...current,
      enabled: true,
      ...updates,
    });
  };

  const handleReset = () => {
    onChange({ ...DEFAULT_QUALIFIER, enabled: true });
  };

  // Internal eyedropper fallback if onSampleColor not provided
  const handleEyedropper = async () => {
    if (onSampleColor) {
      onSampleColor();
      return;
    }
    if (typeof window !== 'undefined' && 'EyeDropper' in window) {
      try {
        const eyeDropper = new (window as any).EyeDropper();
        const res = await eyeDropper.open();
        if (res?.sRGBHex) {
          const hex = res.sRGBHex.replace('#', '');
          const r = parseInt(hex.substring(0, 2), 16) / 255;
          const g = parseInt(hex.substring(2, 4), 16) / 255;
          const b = parseInt(hex.substring(4, 6), 16) / 255;
          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          let h = 0;
          const d = max - min;
          if (max !== min) {
            if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
            else if (max === g) h = (b - r) / d + 2;
            else if (max === b) h = (r - g) / d + 4;
            h = Math.round((h * 60) % 360);
          }
          const l = (max + min) / 2;
          const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));

          updateQualifier({
            hueCenter: h,
            satCenter: Number(s.toFixed(2)),
            lumCenter: Number(l.toFixed(2)),
          });
        }
      } catch {
        // Dismissed
      }
    }
  };

  return (
    <div className="rounded-lg bg-[#0D0E11] border border-[#222630] overflow-hidden select-none">
      {/* Header bar with toggle */}
      <div className="p-3 flex items-center justify-between bg-[#111319] border-b border-[#222630]/60">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="text-[#8A92A6] hover:text-[#F0F3F8] cursor-pointer"
          >
            {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
          <span className="text-[11px] font-bold text-[#F0F3F8] uppercase tracking-wider">
            HSL Secondary Qualifier
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Eyedropper sampling tool */}
          <button
            onClick={handleEyedropper}
            title="Sample Color from Screen / Viewport"
            className="px-2 py-0.5 rounded bg-[#1C202B] hover:bg-[#252B3A] text-[#8A92A6] hover:text-[#00F0FF] text-[10px] font-mono flex items-center gap-1 border border-[#222630] cursor-pointer transition-colors"
          >
            <Pipette size={11} className="text-[#00F0FF]" />
            <span>Eyedropper</span>
          </button>

          {/* Reset button */}
          <button
            onClick={handleReset}
            title="Reset Qualifier"
            className="text-[#64748B] hover:text-[#00F0FF] p-1 transition-colors cursor-pointer"
          >
            <RotateCcw size={11} />
          </button>

          {/* Enabled switch with working sliding toggle */}
          <button
            type="button"
            onClick={handleToggle}
            title={current.enabled ? 'Click to Disable HSL Qualifier' : 'Click to Enable HSL Qualifier'}
            className="w-9 h-5 rounded-full transition-all relative cursor-pointer"
            style={{
              backgroundColor: current.enabled ? '#00F0FF' : '#222630',
              boxShadow: current.enabled ? '0 0 10px rgba(0, 240, 255, 0.45)' : 'none',
            }}
          >
            <div
              className="w-3.5 h-3.5 rounded-full bg-black absolute top-[3px] transition-transform duration-150"
              style={{
                transform: current.enabled ? 'translateX(18px)' : 'translateX(3px)',
              }}
            />
          </button>

          <span
            className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${
              current.enabled ? 'bg-[#00F0FF]/15 text-[#00F0FF]' : 'bg-[#181B22] text-[#64748B]'
            }`}
          >
            {current.enabled ? 'ON' : 'OFF'}
          </span>
        </div>
      </div>

      {isOpen && (
        <div className="p-3 space-y-3.5">
          {/* Show Matte toggle */}
          <div
            onClick={() => updateQualifier({ showMatte: !current.showMatte })}
            className={`flex items-center justify-between p-2 rounded border cursor-pointer transition-colors ${
              current.showMatte
                ? 'bg-[#00F0FF]/15 border-[#00F0FF]/40 text-[#00F0FF]'
                : 'bg-[#14161F] border-[#222630] text-[#F0F3F8] hover:bg-[#1A1D27]'
            }`}
          >
            <span className="text-[11px] font-medium flex items-center gap-1.5">
              <Eye size={13} className={current.showMatte ? 'text-[#00F0FF]' : 'text-[#64748B]'} />
              <span>Show Matte / Isolation Mask (Black & White)</span>
            </span>
            <input
              type="checkbox"
              checked={current.showMatte}
              onChange={(e) => updateQualifier({ showMatte: e.target.checked })}
              className="accent-[#00F0FF] cursor-pointer"
            />
          </div>

          {/* Qualification Ranges */}
          <div className="space-y-3">
            <div className="text-[10px] font-bold text-[#8A92A6] uppercase tracking-wider">
              1. Color Selection Key
            </div>

            {/* Hue Range */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10px] font-mono text-[#8A92A6]">
                <span>Hue Center & Tolerance</span>
                <span className="text-[#00F0FF]">{Math.round(current.hueCenter)}° ± {Math.round(current.hueWidth)}°</span>
              </div>
              <input
                type="range"
                min={0}
                max={360}
                value={current.hueCenter}
                onChange={(e) => updateQualifier({ hueCenter: Number(e.target.value) })}
                className="w-full h-1.5 rounded appearance-none cursor-pointer"
                style={{
                  background: 'linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)',
                }}
              />
              <div className="flex items-center gap-2 text-[9px] text-[#64748B]">
                <span>Width:</span>
                <input
                  type="range"
                  min={10}
                  max={180}
                  value={current.hueWidth}
                  onChange={(e) => updateQualifier({ hueWidth: Number(e.target.value) })}
                  className="flex-1 h-1 bg-[#222630] rounded appearance-none cursor-pointer accent-[#00F0FF]"
                />
              </div>
            </div>

            {/* Saturation Range */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10px] font-mono text-[#8A92A6]">
                <span>Saturation Range</span>
                <span className="text-[#00F0FF]">{Math.round(current.satCenter * 100)}% ± {Math.round(current.satWidth * 100)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={current.satCenter}
                onChange={(e) => updateQualifier({ satCenter: Number(e.target.value) })}
                className="w-full h-1 bg-[#222630] rounded appearance-none cursor-pointer accent-[#00F0FF]"
              />
              <div className="flex items-center gap-2 text-[9px] text-[#64748B]">
                <span>Width:</span>
                <input
                  type="range"
                  min={0.05}
                  max={1}
                  step={0.01}
                  value={current.satWidth}
                  onChange={(e) => updateQualifier({ satWidth: Number(e.target.value) })}
                  className="flex-1 h-1 bg-[#222630] rounded appearance-none cursor-pointer accent-[#00F0FF]"
                />
              </div>
            </div>

            {/* Luminance Range */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10px] font-mono text-[#8A92A6]">
                <span>Luma Range</span>
                <span className="text-[#00F0FF]">{Math.round(current.lumCenter * 100)}% ± {Math.round(current.lumWidth * 100)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={current.lumCenter}
                onChange={(e) => updateQualifier({ lumCenter: Number(e.target.value) })}
                className="w-full h-1 bg-[#222630] rounded appearance-none cursor-pointer accent-[#00F0FF]"
              />
              <div className="flex items-center gap-2 text-[9px] text-[#64748B]">
                <span>Width:</span>
                <input
                  type="range"
                  min={0.05}
                  max={1}
                  step={0.01}
                  value={current.lumWidth}
                  onChange={(e) => updateQualifier({ lumWidth: Number(e.target.value) })}
                  className="flex-1 h-1 bg-[#222630] rounded appearance-none cursor-pointer accent-[#00F0FF]"
                />
              </div>
            </div>
          </div>

          {/* Isolated Adjustments */}
          <div className="space-y-2.5 pt-2 border-t border-[#222630]">
            <div className="text-[10px] font-bold text-[#8A92A6] uppercase tracking-wider">
              2. Isolated Color Adjustments
            </div>

            {/* Hue Shift */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10px] font-mono text-[#8A92A6]">
                <span>Hue Shift</span>
                <span className="text-[#00F0FF]">{Math.round(current.isolatedHueShift)}°</span>
              </div>
              <input
                type="range"
                min={-180}
                max={180}
                value={current.isolatedHueShift}
                onChange={(e) => updateQualifier({ isolatedHueShift: Number(e.target.value) })}
                className="w-full h-1 bg-[#222630] rounded appearance-none cursor-pointer accent-[#00F0FF]"
              />
            </div>

            {/* Isolated Saturation */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10px] font-mono text-[#8A92A6]">
                <span>Isolated Saturation</span>
                <span className="text-[#00F0FF]">{Math.round(current.isolatedSat * 100)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={2}
                step={0.01}
                value={current.isolatedSat}
                onChange={(e) => updateQualifier({ isolatedSat: Number(e.target.value) })}
                className="w-full h-1 bg-[#222630] rounded appearance-none cursor-pointer accent-[#00F0FF]"
              />
            </div>

            {/* Isolated Gain */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10px] font-mono text-[#8A92A6]">
                <span>Isolated Gain / Luma</span>
                <span className="text-[#00F0FF]">{Math.round(current.isolatedGain * 100)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={2}
                step={0.01}
                value={current.isolatedGain}
                onChange={(e) => updateQualifier({ isolatedGain: Number(e.target.value) })}
                className="w-full h-1 bg-[#222630] rounded appearance-none cursor-pointer accent-[#00F0FF]"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
