import React, { useState } from 'react';
import {
  Download,
  X,
  CheckCircle2,
  AlertCircle,
  Sliders,
  Tv,
  Cpu,
  Sparkles,
  Waves,
  Film,
  Zap,
  FolderOpen,
} from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useTimelineStore, isTauri, tauriInvoke } from '../../store/timelineStore';
import { ExportConfig } from '../../types/ipc';

export const ExportModal: React.FC = () => {
  const {
    project,
    tracks,
    isExportModalOpen,
    setExportModalOpen,
    isExporting,
    exportProgress,
    exportStatusMessage,
    startExport,
    cancelExport,
  } = useTimelineStore(
    useShallow((state) => ({
      project: state.project,
      tracks: state.tracks,
      isExportModalOpen: state.isExportModalOpen,
      setExportModalOpen: state.setExportModalOpen,
      isExporting: state.isExporting,
      exportProgress: state.exportProgress,
      exportStatusMessage: state.exportStatusMessage,
      startExport: state.startExport,
      cancelExport: state.cancelExport,
    }))
  );

  const [outputPath, setOutputPath] = useState<string>('D:\\Programming-Projects\\video-editor\\Master_Render.mp4');
  const [resolution, setResolution] = useState<'1080p' | '4K' | '720p'>('1080p');
  const [fps, setFps] = useState<number>(30);
  const [codec, setCodec] = useState<'h264_nvenc' | 'h264_qsv' | 'h264_amf' | 'libx264'>('h264_nvenc');
  const [lutPath, setLutPath] = useState<string>('');
  const [denoiseEnabled, setDenoiseEnabled] = useState<boolean>(true);
  const [exportComplete, setExportComplete] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isExportModalOpen) return null;

  const handleBrowseOutputPath = async () => {
    try {
      if (isTauri) {
        const selected = await tauriInvoke<string | null>('save_file_dialog', { defaultPath: outputPath });
        if (selected) {
          setOutputPath(selected);
        }
      } else {
        const prompted = window.prompt('Enter output video file path (.mp4, .mov, .mkv):', outputPath);
        if (prompted) {
          setOutputPath(prompted);
        }
      }
    } catch (err) {
      console.error('Failed to open save file dialog', err);
    }
  };

  const handleAutoName = () => {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const timeStr = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
    const filename = `Render_${dateStr}_${timeStr}.mp4`;

    const lastSlash = Math.max(outputPath.lastIndexOf('\\'), outputPath.lastIndexOf('/'));
    if (lastSlash !== -1) {
      const dir = outputPath.slice(0, lastSlash);
      setOutputPath(`${dir}\\${filename}`);
    } else {
      setOutputPath(`D:\\Programming-Projects\\video-editor\\${filename}`);
    }
  };

  const setQuickPreset = (type: 'videos' | 'desktop' | 'project') => {
    const filename = outputPath.split(/[/\\]/).pop() || 'Master_Render.mp4';
    if (type === 'videos') {
      setOutputPath(`C:\\Users\\soura\\Videos\\${filename}`);
    } else if (type === 'desktop') {
      setOutputPath(`C:\\Users\\soura\\Desktop\\${filename}`);
    } else if (type === 'project') {
      setOutputPath(`D:\\Programming-Projects\\video-editor\\${filename}`);
    }
  };

  const handleBrowseLutPath = async () => {
    try {
      if (isTauri) {
        const selected = await tauriInvoke<string | null>('open_lut_dialog');
        if (selected) {
          setLutPath(selected);
        }
      } else {
        const prompted = window.prompt('Enter 3D LUT (.cube) file path:', lutPath);
        if (prompted) {
          setLutPath(prompted);
        }
      }
    } catch (err) {
      console.error('Failed to open LUT file dialog', err);
    }
  };

  const handleStartRender = async () => {
    setErrorMsg(null);
    setExportComplete(false);

    let width = 1920;
    let height = 1080;
    if (resolution === '4K') {
      width = 3840;
      height = 2160;
    } else if (resolution === '720p') {
      width = 1280;
      height = 720;
    }

    const config: ExportConfig = {
      outputPath: outputPath.trim() || 'D:\\Programming-Projects\\video-editor\\Master_Render.mp4',
      width,
      height,
      fps,
      codec,
      appliedLutPath: lutPath.trim() || undefined,
      denoiseEnabled,
      tracks,
      project,
    };

    const result = await startExport(config);
    if (result.success) {
      setExportComplete(true);
    } else {
      setErrorMsg(result.message);
    }
  };

  const handleClose = () => {
    if (isExporting) {
      cancelExport();
    }
    setExportComplete(false);
    setErrorMsg(null);
    setExportModalOpen(false);
  };

  const pct = exportProgress ? Math.min(100, Math.max(0, exportProgress.percentage)) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm select-none p-4">
      <div className="w-full max-w-xl bg-[#14161B] border border-[#222630] rounded-xl shadow-2xl overflow-hidden flex flex-col text-[#F0F3F8]">
        {/* Header */}
        <div className="h-13 bg-[#181B22] border-b border-[#222630] px-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-[#00F0FF]/15 border border-[#00F0FF]/30 flex items-center justify-center text-[#00F0FF]">
              <Download size={16} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#F0F3F8]">Export Master Timeline</h2>
              <p className="text-[11px] text-[#64748B]">
                Hardware accelerated render sidecar (FFmpeg NVENC / QSV)
              </p>
            </div>
          </div>

          {!isExporting && (
            <button
              onClick={handleClose}
              className="p-1 rounded-lg hover:bg-[#222630] text-[#64748B] hover:text-[#F0F3F8] transition-colors"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Body Content */}
        <div className="p-5 flex flex-col gap-4 overflow-y-auto max-h-[75vh]">
          {/* Output File Path */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-[#8A92A6] flex items-center gap-1.5">
                <FolderOpen size={13} className="text-[#00F0FF]" />
                <span>Output Destination Path</span>
              </label>
              <span className="text-[10px] text-[#64748B]">MP4 / MOV / MKV</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={outputPath}
                onChange={(e) => setOutputPath(e.target.value)}
                disabled={isExporting}
                placeholder="D:\Programming-Projects\video-editor\Master_Render.mp4"
                className="flex-1 bg-[#0D0E11] border border-[#222630] focus:border-[#00F0FF] rounded-lg px-3 py-2 text-xs font-mono text-[#F0F3F8] outline-none transition-colors"
              />
              <button
                type="button"
                onClick={handleBrowseOutputPath}
                disabled={isExporting}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#00F0FF]/15 hover:bg-[#00F0FF]/25 border border-[#00F0FF]/40 text-xs font-semibold text-[#00F0FF] transition-all cursor-pointer disabled:opacity-50"
                title="Browse folder and choose file name"
              >
                <FolderOpen size={14} />
                <span>Browse...</span>
              </button>
              <button
                type="button"
                onClick={handleAutoName}
                disabled={isExporting}
                className="px-3 py-2 rounded-lg bg-[#1E222D] hover:bg-[#252B3A] border border-[#222630] text-xs font-semibold text-[#8A92A6] hover:text-[#00F0FF] transition-colors disabled:opacity-50"
                title="Generate timestamped filename"
              >
                Auto Name
              </button>
            </div>

            {/* Quick destination presets */}
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[10px] text-[#64748B]">Quick presets:</span>
              <button
                type="button"
                disabled={isExporting}
                onClick={() => setQuickPreset('videos')}
                className="text-[10px] px-2 py-0.5 rounded bg-[#1A1D24] hover:bg-[#222630] text-[#8A92A6] hover:text-[#F0F3F8] border border-[#2A2E3B] transition-colors disabled:opacity-50"
              >
                Videos
              </button>
              <button
                type="button"
                disabled={isExporting}
                onClick={() => setQuickPreset('desktop')}
                className="text-[10px] px-2 py-0.5 rounded bg-[#1A1D24] hover:bg-[#222630] text-[#8A92A6] hover:text-[#F0F3F8] border border-[#2A2E3B] transition-colors disabled:opacity-50"
              >
                Desktop
              </button>
              <button
                type="button"
                disabled={isExporting}
                onClick={() => setQuickPreset('project')}
                className="text-[10px] px-2 py-0.5 rounded bg-[#1A1D24] hover:bg-[#222630] text-[#8A92A6] hover:text-[#F0F3F8] border border-[#2A2E3B] transition-colors disabled:opacity-50"
              >
                Project Dir
              </button>
            </div>
          </div>

          {/* Render Specifications Grid */}
          <div className="grid grid-cols-2 gap-3">
            {/* Resolution */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-[#8A92A6] flex items-center gap-1.5">
                <Tv size={13} className="text-[#00F0FF]" />
                <span>Resolution</span>
              </label>
              <select
                value={resolution}
                onChange={(e) => setResolution(e.target.value as any)}
                disabled={isExporting}
                className="bg-[#0D0E11] border border-[#222630] focus:border-[#00F0FF] rounded-lg px-3 py-2 text-xs font-mono text-[#F0F3F8] outline-none"
              >
                <option value="1080p">1080p FHD (1920 x 1080)</option>
                <option value="4K">4K UHD (3840 x 2160)</option>
                <option value="720p">720p HD (1280 x 720)</option>
              </select>
            </div>

            {/* Frame Rate */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-[#8A92A6] flex items-center gap-1.5">
                <Film size={13} className="text-[#00F0FF]" />
                <span>Framerate</span>
              </label>
              <select
                value={fps}
                onChange={(e) => setFps(Number(e.target.value))}
                disabled={isExporting}
                className="bg-[#0D0E11] border border-[#222630] focus:border-[#00F0FF] rounded-lg px-3 py-2 text-xs font-mono text-[#F0F3F8] outline-none"
              >
                <option value={24}>24 fps (Cinematic)</option>
                <option value={30}>30 fps (Standard NTSC)</option>
                <option value={60}>60 fps (High Smoothness)</option>
              </select>
            </div>
          </div>

          {/* Hardware Encoder Selection */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-[#8A92A6] flex items-center gap-1.5">
              <Cpu size={13} className="text-[#00F0FF]" />
              <span>Video Encoder (Hardware / CPU Fallback)</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setCodec('h264_nvenc')}
                disabled={isExporting}
                className={`p-2.5 rounded-lg border text-left flex flex-col gap-0.5 transition-all ${
                  codec === 'h264_nvenc'
                    ? 'bg-[#00F0FF]/10 border-[#00F0FF] text-[#F0F3F8]'
                    : 'bg-[#0D0E11] border-[#222630] text-[#64748B] hover:border-[#38BDF8]/50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#F0F3F8]">NVIDIA NVENC</span>
                  <Zap size={12} className={codec === 'h264_nvenc' ? 'text-[#00F0FF]' : 'text-zinc-600'} />
                </div>
                <span className="text-[10px] font-mono text-[#64748B]">RTX / GTX Dedicated HW</span>
              </button>

              <button
                type="button"
                onClick={() => setCodec('h264_qsv')}
                disabled={isExporting}
                className={`p-2.5 rounded-lg border text-left flex flex-col gap-0.5 transition-all ${
                  codec === 'h264_qsv'
                    ? 'bg-[#00F0FF]/10 border-[#00F0FF] text-[#F0F3F8]'
                    : 'bg-[#0D0E11] border-[#222630] text-[#64748B] hover:border-[#38BDF8]/50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#F0F3F8]">Intel QuickSync</span>
                  <Zap size={12} className={codec === 'h264_qsv' ? 'text-[#00F0FF]' : 'text-zinc-600'} />
                </div>
                <span className="text-[10px] font-mono text-[#64748B]">Core iGPU Acceleration</span>
              </button>

              <button
                type="button"
                onClick={() => setCodec('h264_amf')}
                disabled={isExporting}
                className={`p-2.5 rounded-lg border text-left flex flex-col gap-0.5 transition-all ${
                  codec === 'h264_amf'
                    ? 'bg-[#00F0FF]/10 border-[#00F0FF] text-[#F0F3F8]'
                    : 'bg-[#0D0E11] border-[#222630] text-[#64748B] hover:border-[#38BDF8]/50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#F0F3F8]">AMD AMF</span>
                  <Zap size={12} className={codec === 'h264_amf' ? 'text-[#00F0FF]' : 'text-zinc-600'} />
                </div>
                <span className="text-[10px] font-mono text-[#64748B]">Radeon GPU Hardware</span>
              </button>

              <button
                type="button"
                onClick={() => setCodec('libx264')}
                disabled={isExporting}
                className={`p-2.5 rounded-lg border text-left flex flex-col gap-0.5 transition-all ${
                  codec === 'libx264'
                    ? 'bg-[#00F0FF]/10 border-[#00F0FF] text-[#F0F3F8]'
                    : 'bg-[#0D0E11] border-[#222630] text-[#64748B] hover:border-[#38BDF8]/50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#F0F3F8]">Software x264</span>
                  <Cpu size={12} className={codec === 'libx264' ? 'text-[#00F0FF]' : 'text-zinc-600'} />
                </div>
                <span className="text-[10px] font-mono text-[#64748B]">Universal CPU Fallback</span>
              </button>
            </div>
          </div>

          {/* 3D LUT (.cube) & Audio Denoise */}
          <div className="flex flex-col gap-2 p-3 rounded-lg bg-[#0D0E11] border border-[#222630]">
            {/* 3D LUT Path */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold text-[#8A92A6] flex items-center gap-1.5">
                  <Sparkles size={12} className="text-[#A855F7]" />
                  <span>3D Color LUT (.cube path - optional)</span>
                </label>
                {lutPath && (
                  <button
                    type="button"
                    onClick={() => setLutPath('')}
                    disabled={isExporting}
                    className="text-[10px] text-[#64748B] hover:text-red-400 transition-colors"
                  >
                    Clear LUT
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={lutPath}
                  onChange={(e) => setLutPath(e.target.value)}
                  disabled={isExporting}
                  placeholder="e.g. C:\Presets\LUTs\cinematic_teal_orange.cube"
                  className="flex-1 bg-[#14161B] border border-[#222630] rounded px-2.5 py-1.5 text-xs font-mono text-[#F0F3F8] outline-none"
                />
                <button
                  type="button"
                  onClick={handleBrowseLutPath}
                  disabled={isExporting}
                  className="px-2.5 py-1.5 rounded bg-[#1E222D] hover:bg-[#252B3A] border border-[#222630] text-xs font-semibold text-[#A855F7] hover:text-[#d8b4fe] transition-colors disabled:opacity-50"
                  title="Browse for .cube LUT file"
                >
                  Browse...
                </button>
              </div>
            </div>

            {/* Audio Denoise Checkbox */}
            <label className="flex items-center gap-2.5 cursor-pointer mt-1 pt-2 border-t border-[#1C202B]">
              <input
                type="checkbox"
                checked={denoiseEnabled}
                onChange={(e) => setDenoiseEnabled(e.target.checked)}
                disabled={isExporting}
                className="w-4 h-4 accent-[#10B981] rounded cursor-pointer"
              />
              <div className="flex items-center gap-1.5 text-xs font-medium text-[#F0F3F8]">
                <Waves size={13} className="text-[#10B981]" />
                <span>Apply Audio FFT Denoise (`afftdn` 12dB filter)</span>
              </div>
            </label>
          </div>

          {/* Real-Time Export Progress Display */}
          {(isExporting || exportComplete || errorMsg) && (
            <div className="flex flex-col gap-2 p-3.5 rounded-lg bg-[#0C0E12] border border-[#222630]">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-[#8A92A6] truncate">{exportStatusMessage || 'Rendering...'}</span>
                <span className="font-mono text-[#00F0FF]">{pct.toFixed(1)}%</span>
              </div>

              {/* Progress Bar Container */}
              <div className="w-full h-2 bg-[#1A1D24] rounded-full overflow-hidden relative">
                <div
                  style={{ width: `${pct}%` }}
                  className={`h-full transition-all duration-150 ${
                    errorMsg
                      ? 'bg-red-500'
                      : exportComplete
                      ? 'bg-[#10B981]'
                      : 'bg-gradient-to-r from-[#00F0FF] to-[#10B981]'
                  }`}
                />
              </div>

              {/* Metadata Readout: FPS, ETA, Frame */}
              {isExporting && exportProgress && (
                <div className="flex items-center justify-between text-[11px] font-mono text-[#64748B]">
                  <span>Frame: {exportProgress.currentFrame}</span>
                  <span>Speed: {exportProgress.fps.toFixed(1)} fps</span>
                  <span>
                    ETA:{' '}
                    {exportProgress.etaSeconds !== undefined
                      ? `${Math.round(exportProgress.etaSeconds)}s`
                      : 'calculating...'}
                  </span>
                </div>
              )}

              {/* Completion notification */}
              {exportComplete && (
                <div className="flex items-center gap-2 text-xs font-semibold text-[#10B981] mt-1">
                  <CheckCircle2 size={15} />
                  <span>Render completed successfully! Output saved to disk.</span>
                </div>
              )}

              {/* Error notification */}
              {errorMsg && (
                <div className="flex items-start gap-2 text-xs text-red-400 mt-1">
                  <AlertCircle size={15} className="shrink-0 mt-0.5" />
                  <span className="break-all">{errorMsg}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="h-14 bg-[#181B22] border-t border-[#222630] px-5 flex items-center justify-between shrink-0">
          <div className="text-[11px] font-mono text-[#64748B]">
            Estimated duration: {((project.durationMs || 120000) / 1000).toFixed(1)}s
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleClose}
              disabled={isExporting}
              className="px-4 py-1.5 rounded-lg bg-[#222630] hover:bg-[#2C3240] text-xs font-semibold text-[#8A92A6] hover:text-[#F0F3F8] transition-colors disabled:opacity-50"
            >
              {exportComplete ? 'Close' : 'Cancel'}
            </button>

            {!exportComplete && (
              <button
                onClick={handleStartRender}
                disabled={isExporting}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[#00F0FF] hover:bg-[#3bf1ff] text-[#0D0E11] text-xs font-bold transition-all shadow-[0_0_12px_rgba(0,240,255,0.35)] cursor-pointer disabled:opacity-50"
              >
                <Download size={14} strokeWidth={2.5} />
                <span>{isExporting ? 'Rendering...' : 'Start Render'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
