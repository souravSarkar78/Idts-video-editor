import React, { useState } from 'react';
import { Volume2, Sparkles, RotateCcw, Scissors, CheckCircle2, AlertCircle } from 'lucide-react';
import { Waves, Shield } from '@/components/Icons';
import { Clip } from '../../types/ipc';
import { useTimelineStore } from '../../store/timelineStore';

interface SpectralDenoiseInspectorProps {
  selectedClip: Clip;
}

export const SpectralDenoiseInspector: React.FC<SpectralDenoiseInspectorProps> = ({ selectedClip }) => {
  const setIsNoiseModalOpen = useTimelineStore((state) => state.setIsNoiseModalOpen);
  const clearNoiseProfile = useTimelineStore((state) => state.clearNoiseProfile);
  const updateNoiseProfileSettings = useTimelineStore((state) => state.updateNoiseProfileSettings);
  const runSilenceAutoCutWithAmbientFill = useTimelineStore((state) => state.runSilenceAutoCutWithAmbientFill);

  const [isRunningAutoCut, setIsRunningAutoCut] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  const np = selectedClip.audioProcessing?.noiseProfile || {
    noiseReductionEnabled: false,
    reductionIntensityDb: 12.0,
    auditionResidue: false,
    ambientRecoveryEnabled: false,
    ambientFillIntensity: 0.25,
    silenceCutThresholdDb: -35.0,
    silenceMinDurationSec: 0.6,
    cutMarginPaddingMs: 50,
  };

  const hasProfile = Boolean(np.noiseProfilePath || np.roomToneLoopPath);
  const profileDuration = np.profileDurationSec ? `${np.profileDurationSec.toFixed(1)}s Ambient` : 'Ambient Captured';

  const handleOpenModal = () => {
    setIsNoiseModalOpen(true, selectedClip.id);
  };

  const handleClear = () => {
    clearNoiseProfile(selectedClip.id);
    setFeedbackMessage('Noise profile cleared');
  };

  const handleRunAutoCut = async () => {
    setIsRunningAutoCut(true);
    setFeedbackMessage(null);
    try {
      const msg = await runSilenceAutoCutWithAmbientFill(selectedClip.id);
      if (msg) {
        setFeedbackMessage(msg);
      }
    } finally {
      setIsRunningAutoCut(false);
    }
  };

  return (
    <div className="p-3 rounded-lg bg-[#0D0E11] border border-[#222630] space-y-3.5 select-none">
      {/* Header */}
      <div className="flex items-center justify-between pb-1 border-b border-[#222630]/60">
        <span className="text-xs font-bold text-[#F0F3F8] flex items-center gap-1.5">
          <Waves size={14} className="text-[#00F0FF]" />
          <span>Spectral Noise Profiling & Ambient Fill</span>
        </span>
        <span
          className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded ${
            hasProfile ? 'bg-[#00F0FF]/15 text-[#00F0FF]' : 'bg-[#181B22] text-[#64748B]'
          }`}
        >
          {hasProfile ? `[ Profile Loaded: ${profileDuration} ]` : '[ No Profile ]'}
        </span>
      </div>

      {feedbackMessage && (
        <div className="px-2.5 py-1.5 rounded bg-[#10B981]/10 border border-[#10B981]/30 text-[10px] text-[#10B981] flex items-center gap-1.5">
          <CheckCircle2 size={12} className="shrink-0" />
          <span className="truncate">{feedbackMessage}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. NOISE PROFILE SUB-SECTION                                              */}
      {/* ========================================================================= */}
      <div className="space-y-2">
        <div className="text-[10px] font-bold text-[#8A92A6] uppercase tracking-wider flex items-center justify-between">
          <span>1. Ambient Noise Profile</span>
        </div>

        <p className="text-[10px] text-[#64748B] leading-tight">
          Select a 2 to 5 second range of background noise on the interactive waveform to train the spectral filter.
        </p>

        <div className="flex items-center gap-2 pt-0.5">
          <button
            onClick={handleOpenModal}
            className="flex-1 py-1.5 px-2.5 rounded bg-[#00F0FF] hover:bg-[#34f3ff] text-[#0A0C10] font-bold text-xs flex items-center justify-center gap-1.5 shadow-[0_0_10px_rgba(0,240,255,0.25)] transition-all cursor-pointer"
            title="Open interactive waveform modal to select 2 to 5 seconds of noise"
          >
            <Sparkles size={13} />
            <span>Select & Capture Noise...</span>
          </button>

          {hasProfile && (
            <button
              onClick={handleClear}
              className="py-1.5 px-2.5 rounded bg-[#1A1D24] hover:bg-[#222630] border border-[#222630] text-[#8A92A6] hover:text-white text-xs font-medium transition-colors cursor-pointer"
              title="Clear captured spectral profile"
            >
              <RotateCcw size={12} />
            </button>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. DENOISE & CLEANUP SUB-SECTION                                          */}
      {/* ========================================================================= */}
      <div className="space-y-2.5 pt-2 border-t border-[#222630]/60">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-[#8A92A6] uppercase tracking-wider">
            2. Denoise & Cleanup
          </span>
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-bold font-mono transition-colors ${
              np.noiseReductionEnabled ? 'text-[#00F0FF]' : 'text-[#8A92A6]'
            }`}>
              {np.noiseReductionEnabled ? 'ON' : 'OFF'}
            </span>
            <label className="relative inline-flex items-center cursor-pointer" title="Toggle Noise Reduction On / Off">
              <input
                type="checkbox"
                checked={np.noiseReductionEnabled}
                onChange={(e) => updateNoiseProfileSettings(selectedClip.id, { noiseReductionEnabled: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-8 h-4 bg-[#222630] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3.5 after:transition-all peer-checked:bg-[#00F0FF]"></div>
            </label>
          </div>
        </div>

        {/* Reduction Intensity (dB) */}
        <div className={`space-y-1 transition-opacity ${np.noiseReductionEnabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-[#8A92A6]">Reduction Intensity</span>
            <div className="flex items-center gap-1">
              <span className="font-mono text-[10px] font-bold text-[#00F0FF]">
                {np.reductionIntensityDb.toFixed(1)} dB
              </span>
            </div>
          </div>
          <input
            type="range"
            min={0}
            max={48}
            step={0.5}
            value={np.reductionIntensityDb}
            onChange={(e) => updateNoiseProfileSettings(selectedClip.id, { reductionIntensityDb: Number(e.target.value) })}
            className="w-full h-1.5 bg-[#222630] rounded appearance-none cursor-pointer accent-[#00F0FF]"
          />

          {/* Toggle Radio: Clean Output vs Audition Removed Noise */}
          <div className="flex items-center gap-4 pt-1.5 text-[11px]">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name="denoise_output_mode"
                checked={!np.auditionResidue}
                onChange={() => updateNoiseProfileSettings(selectedClip.id, { auditionResidue: false })}
                className="accent-[#00F0FF] cursor-pointer"
              />
              <span className={!np.auditionResidue ? 'text-[#F0F3F8] font-medium' : 'text-[#8A92A6]'}>
                Clean Output
              </span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name="denoise_output_mode"
                checked={np.auditionResidue}
                onChange={() => updateNoiseProfileSettings(selectedClip.id, { auditionResidue: true })}
                className="accent-[#F59E0B] cursor-pointer"
              />
              <span className={np.auditionResidue ? 'text-[#F59E0B] font-medium' : 'text-[#8A92A6]'}>
                Audition Removed Noise (Residue)
              </span>
            </label>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. AUTO-CUT SILENCE & AMBIENT FILL SUB-SECTION                            */}
      {/* ========================================================================= */}
      <div className="space-y-2.5 pt-2 border-t border-[#222630]/60">
        <div className="text-[10px] font-bold text-[#8A92A6] uppercase tracking-wider flex items-center justify-between">
          <span>3. Auto-Cut Silence & Ambient Fill</span>
        </div>

        {/* Silence Cut Threshold dB */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-[#8A92A6]">Silence Cut Threshold</span>
            <span className="font-mono text-[10px] font-bold text-[#F0F3F8]">
              {np.silenceCutThresholdDb.toFixed(1)} dB
            </span>
          </div>
          <input
            type="range"
            min={-60}
            max={-20}
            step={1}
            value={np.silenceCutThresholdDb}
            onChange={(e) => updateNoiseProfileSettings(selectedClip.id, { silenceCutThresholdDb: Number(e.target.value) })}
            className="w-full h-1.5 bg-[#222630] rounded appearance-none cursor-pointer accent-[#10B981]"
          />
        </div>

        {/* Minimum Silence Duration */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-[#8A92A6]">Minimum Silence Duration</span>
            <span className="font-mono text-[10px] font-bold text-[#F0F3F8]">
              {np.silenceMinDurationSec.toFixed(2)}s
            </span>
          </div>
          <input
            type="range"
            min={0.2}
            max={2.0}
            step={0.05}
            value={np.silenceMinDurationSec}
            onChange={(e) => updateNoiseProfileSettings(selectedClip.id, { silenceMinDurationSec: Number(e.target.value) })}
            className="w-full h-1.5 bg-[#222630] rounded appearance-none cursor-pointer accent-[#10B981]"
          />
        </div>

        {/* Padding / Edge Margin */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-[#8A92A6]">Padding / Edge Margin</span>
            <span className="font-mono text-[10px] font-bold text-[#F0F3F8]">
              {np.cutMarginPaddingMs}ms
            </span>
          </div>
          <input
            type="range"
            min={10}
            max={100}
            step={5}
            value={np.cutMarginPaddingMs}
            onChange={(e) => updateNoiseProfileSettings(selectedClip.id, { cutMarginPaddingMs: Number(e.target.value) })}
            className="w-full h-1.5 bg-[#222630] rounded appearance-none cursor-pointer accent-[#10B981]"
          />
        </div>

        {/* Checkbox: Fill Cut Gaps with Ambient Noise Bed */}
        <div className="pt-1">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={np.ambientRecoveryEnabled}
              onChange={(e) => updateNoiseProfileSettings(selectedClip.id, { ambientRecoveryEnabled: e.target.checked })}
              className="rounded bg-[#0D0E11] border-[#222630] text-[#00F0FF] focus:ring-0 cursor-pointer w-3.5 h-3.5 accent-[#00F0FF]"
            />
            <span className="text-[11px] font-medium text-[#F0F3F8]">
              Fill Cut Gaps with Ambient Noise Bed
            </span>
          </label>
        </div>

        {/* Ambient Retrieval Intensity */}
        {np.ambientRecoveryEnabled && (
          <div className="space-y-1 pl-5 pt-0.5">
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-[#8A92A6]">Ambient Retrieval Intensity</span>
              <span className="font-mono font-bold text-[#00F0FF]">
                {Math.round(np.ambientFillIntensity * 100)}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={np.ambientFillIntensity}
              onChange={(e) => updateNoiseProfileSettings(selectedClip.id, { ambientFillIntensity: Number(e.target.value) })}
              className="w-full h-1 bg-[#222630] rounded appearance-none cursor-pointer accent-[#00F0FF]"
            />
          </div>
        )}

        {/* Action Button */}
        <div className="pt-2">
          <button
            onClick={handleRunAutoCut}
            disabled={isRunningAutoCut}
            className="w-full py-2 px-3 rounded bg-[#10B981] hover:bg-[#059669] text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-[0_0_12px_rgba(16,185,129,0.3)] transition-all cursor-pointer disabled:opacity-50"
          >
            <Scissors size={13} />
            <span>{isRunningAutoCut ? 'Analyzing Gaps & Cutting...' : 'Run Silence Auto-Cut with Ambient Fill'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
