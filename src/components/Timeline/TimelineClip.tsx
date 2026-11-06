import React from 'react';
import {
  Sparkles,
  Type,
  CheckCircle2,
  Volume2,
  Mic,
  Compass,
  Eye,
  Loader2,
  FileCode,
  Film,
} from 'lucide-react';
import { Diamond } from '@/components/Icons';
import { Clip, MediaTrack } from '../../types/ipc';
import { ClipAudioWaveform } from './ClipAudioWaveform';
import { ClipVideoFilmstrip } from './ClipVideoFilmstrip';
import { formatTimecode } from '../../utils/timecode';
import { getNearestCachedFrame } from '../../utils/frameCacheService';

export interface TimelineClipProps {
  clip: Clip;
  track: MediaTrack;
  zoom: number;
  trackHeight: number;
  fps: number;
  color: string;
  isVideo: boolean;
  isText: boolean;
  isSelected: boolean;
  isDragging: boolean;
  isExternalDragging: boolean;
  edgeDragMode: 'trim' | 'stretch';
  isStabilizationAnalyzing?: number;
  visibleTimeRange?: { startSec: number; endSec: number };
  onSelectClip: (clipId: string, shiftKey?: boolean) => void;
  onContextMenu: (menuState: {
    x: number;
    y: number;
    clipId: string;
    trackId: string;
    clipName: string;
    isVideo: boolean;
    hasAttachedAudio: boolean;
  }) => void;
  onStartDragClip: (
    clipId: string,
    clientX: number,
    clientY: number,
    startSec: number,
    trackId: string,
    mediaType?: string
  ) => void;
  onStartTrimLeft: (clipId: string, clientX: number, isAlt: boolean) => void;
  onStartTrimRight: (clipId: string, clientX: number, isAlt: boolean) => void;
  onSeekToKeyframe?: (time: number) => void;
  onStartKeyframeDrag?: (clipId: string, time: number, clientX: number, durSec: number) => void;
  onRemoveKeyframe?: (clipId: string, time: number) => void;
}

export const TimelineClip: React.FC<TimelineClipProps> = React.memo(
  ({
    clip,
    track,
    zoom,
    trackHeight,
    fps,
    color,
    isVideo,
    isText,
    isSelected,
    isDragging,
    isExternalDragging,
    edgeDragMode,
    isStabilizationAnalyzing,
    visibleTimeRange,
    onSelectClip,
    onContextMenu,
    onStartDragClip,
    onStartTrimLeft,
    onStartTrimRight,
    onSeekToKeyframe,
    onStartKeyframeDrag,
    onRemoveKeyframe,
  }) => {
    const startSec = clip.startPositionSeconds || 0;
    const durSec = clip.durationSeconds || 10;
    const widthPx = durSec * zoom;
    const leftPx = startSec * zoom;
    const hasAttachedAudio = isVideo && !clip.audioExtracted && clip.hasAudio !== false;
    const isAdjustment = Boolean(
      clip.isAdjustmentLayer ||
      clip.mediaType === 'adjustment' ||
      clip.filePath === 'adjustment_layer' ||
      (clip.name && clip.name.toLowerCase().includes('adjustment layer'))
    );

    // Off-screen culling: When zoomed in, skip mounting heavy filmstrips & canvas waveforms for clips far outside viewport
    const isOffscreen = visibleTimeRange
      ? (startSec + durSec < visibleTimeRange.startSec - 0.5) || (startSec > visibleTimeRange.endSec + 0.5)
      : false;

    if (isOffscreen) {
      return (
        <div
          data-clip-id={clip.id}
          style={{
            left: `${leftPx}px`,
            width: `${Math.max(20, widthPx)}px`,
            height: `${trackHeight - 4}px`,
            top: '2px',
          }}
          className={`absolute rounded-xs overflow-hidden select-none cursor-pointer border ${
            isSelected ? 'border-[#00F0FF] shadow-xs' : 'border-[#222630]'
          } bg-[#14161F]`}
          onClick={(e) => {
            e.stopPropagation();
            onSelectClip(clip.id, e.shiftKey);
          }}
        >
          <div className="absolute top-0 left-0 right-0 h-1 z-10" style={{ backgroundColor: color }} />
          <div className="absolute top-1 left-2 text-[10px] text-white/70 truncate pointer-events-none">
            {clip.name}
          </div>
        </div>
      );
    }

    return (
      <div
        data-clip-id={clip.id}
        onClick={(e) => {
          e.stopPropagation();
          onSelectClip(clip.id, e.shiftKey);
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onSelectClip(clip.id, e.shiftKey);
          onContextMenu({
            x: e.clientX,
            y: e.clientY,
            clipId: clip.id,
            trackId: track.id,
            clipName: clip.name,
            isVideo,
            hasAttachedAudio,
          });
        }}
        onMouseDown={(e) => {
          e.stopPropagation();
          if (e.button === 0) {
            if (e.shiftKey) {
              onSelectClip(clip.id, e.shiftKey);
            }
            onStartDragClip(
              clip.id,
              e.clientX,
              e.clientY,
              startSec,
              track.id,
              clip.mediaType || track.trackType || (track as any).type
            );
          }
        }}
        title={`Clip: ${clip.name}\nPath: ${clip.filePath}\nStart: ${formatTimecode(startSec, fps)}\nDuration: ${durSec.toFixed(2)}s\nOffset: ${clip.syncDeltaSeconds !== undefined ? `+${clip.syncDeltaSeconds.toFixed(2)}s` : '0.00s'}`}
        style={{
          left: `${leftPx}px`,
          width: `${Math.max(widthPx, 24)}px`,
        }}
        className={`absolute top-1 bottom-1 rounded cursor-grab active:cursor-grabbing select-none border shadow-md group transition-[border-color,box-shadow,opacity] duration-150 ${
          isExternalDragging ? 'pointer-events-none' : ''
        } ${
          isDragging
            ? 'ring-2 ring-[#00F0FF] border-white z-30 shadow-[0_0_16px_rgba(0,240,255,0.6)] opacity-95'
            : isSelected
            ? isAdjustment
              ? 'border-white ring-2 ring-[#8B5CF6] z-20 shadow-[0_0_12px_rgba(139,92,246,0.5)]'
              : 'border-white ring-2 ring-[#00F0FF] z-20 shadow-[0_0_12px_rgba(0,240,255,0.4)]'
            : isAdjustment
            ? 'border-[#8B5CF6]/50 hover:border-[#8B5CF6] z-10'
            : 'border-[#222630] hover:border-[#00F0FF]/80 z-10'
        }`}
      >
        {/* Inner Clip Graphic Container */}
        <div className="absolute inset-0 rounded overflow-hidden">
          {isAdjustment ? (
            /* Dedicated Adjustment Layer / LUT Grade FX Clip */
            <div className="relative h-full w-full bg-gradient-to-r from-[#2E1065] via-[#3B0764] to-[#1E1B4B] overflow-hidden select-none border border-[#8B5CF6]/50 shadow-inner">
              {/* Top Color Accent Line */}
              <div className="absolute top-0 left-0 right-0 h-1 z-10 bg-[#8B5CF6]" />

              {/* Header Info */}
              <div className="absolute top-1.5 left-2 right-2 flex items-center justify-between text-[10px] font-semibold text-white drop-shadow-md truncate pointer-events-none z-10">
                <div className="flex items-center gap-1.5 truncate">
                  <Sparkles size={11} className="text-[#C4B5FD] shrink-0" />
                  <span className="truncate bg-black/60 px-1.5 py-0.5 rounded backdrop-blur-xs font-mono text-[#DDD6FE]">
                    {clip.name || 'Adjustment Layer'}
                  </span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-[9px] font-mono font-bold bg-[#8B5CF6] text-white px-1.5 py-0.2 rounded shadow-xs">
                    LUT / GRADE FX
                  </span>
                </div>
              </div>

              {/* Center FX indicator */}
              <div className="absolute inset-0 flex items-center justify-center px-4 pointer-events-none opacity-40">
                <span className="text-[10px] font-mono font-semibold tracking-wider text-[#A78BFA] uppercase truncate">
                  Adjustment Layer - Grades All Tracks Below
                </span>
              </div>

              {/* Bottom Duration info */}
              <div className="absolute bottom-1 right-2 text-[9px] font-mono text-[#C4B5FD] font-bold bg-black/60 px-1 rounded pointer-events-none">
                {durSec.toFixed(2)}s
              </div>
            </div>
          ) : isText || clip.textContent !== undefined ? (
            /* Dedicated Text / Title Clip */
            <div className="relative h-full w-full bg-gradient-to-r from-[#211233] via-[#1A0E29] to-[#140C1F] overflow-hidden select-none border border-[#A855F7]/40 shadow-inner">
              {/* Top Color Accent Line */}
              <div className="absolute top-0 left-0 right-0 h-1 z-10 bg-[#A855F7]" />

              {/* Header Info */}
              <div className="absolute top-1.5 left-2 right-2 flex items-center justify-between text-[10px] font-semibold text-white drop-shadow-md truncate pointer-events-none z-10">
                <div className="flex items-center gap-1.5 truncate">
                  <Type size={11} className="text-[#A855F7] shrink-0" />
                  <span className="truncate bg-black/60 px-1.5 py-0.5 rounded backdrop-blur-xs font-mono">
                    {clip.name || clip.textContent || 'Text'}
                  </span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-[9px] font-mono font-bold bg-[#A855F7]/80 text-white px-1.5 py-0.2 rounded shadow-xs">
                    {clip.textStyle?.presetStyle ? clip.textStyle.presetStyle.toUpperCase() : 'TEXT'}
                  </span>
                </div>
              </div>

              {/* Centered Preview of Text Content */}
              <div className="absolute inset-0 flex items-center justify-center px-4 pointer-events-none">
                <span
                  style={{
                    color: clip.textStyle?.fontColor || '#FFFFFF',
                    fontFamily: clip.textStyle?.fontFamily || 'Inter',
                    textShadow: clip.textStyle?.strokeWidth
                      ? `0 0 ${clip.textStyle.strokeWidth * 2}px ${clip.textStyle.strokeColor || '#000000'}`
                      : '0 2px 4px rgba(0,0,0,0.8)',
                  }}
                  className="text-xs font-bold truncate max-w-full drop-shadow-md"
                >
                  "{clip.textContent || clip.name}"
                </span>
              </div>

              {/* Bottom Duration info */}
              <div className="absolute bottom-1 right-2 text-[9px] font-mono text-[#A855F7] font-bold bg-black/60 px-1 rounded pointer-events-none">
                {durSec.toFixed(2)}s
              </div>
            </div>
          ) : isVideo ? (
            hasAttachedAudio ? (
              /* Video Clip with Attached Sub Audio Track */
              <div className="flex flex-col h-full w-full">
                {/* Video Lane: Filmstrip & Title */}
                <div className="relative flex-1 min-h-[22px] overflow-hidden bg-[#111319]">
                  <ClipVideoFilmstrip
                    filePath={clip.filePath}
                    widthPx={widthPx}
                    heightPx={Math.max(22, trackHeight - Math.min(32, Math.max(18, Math.round(trackHeight * 0.32))) - 8)}
                    inPointSeconds={clip.inPointSeconds || 0}
                    durationSeconds={durSec}
                    totalDurationSeconds={clip.metadata?.durationSeconds || durSec}
                    fps={fps}
                    visibleTimeRange={visibleTimeRange}
                    clipStartSec={startSec}
                  />

                  {/* Top Color Accent Line */}
                  <div className="absolute top-0 left-0 right-0 h-1 z-10" style={{ backgroundColor: color }} />

                  {/* Clip Info Header Overlay */}
                  <div className="absolute top-1.5 left-2 right-2 flex items-center justify-between text-[10px] font-semibold text-white drop-shadow-md truncate pointer-events-none z-10">
                    <span className="truncate bg-black/60 px-1.5 py-0.5 rounded backdrop-blur-xs">{clip.name}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      {clip.speedProfile && clip.speedProfile.speedMultiplier !== 1.0 && (
                        <div
                          className="flex items-center px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-[#F59E0B]/90 text-[#0D0E11] shadow-xs"
                          title={`Speed Ramping: ${clip.speedProfile.speedMultiplier}x`}
                        >
                          <span>[{clip.speedProfile.speedMultiplier}x]</span>
                        </div>
                      )}
                      {(clip.filterName || clip.filterId) && (
                        <div
                          className="flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-[#00F0FF]/90 text-black shadow-xs shrink-0"
                          title={`Active Filter: ${clip.filterName || clip.filterId} (${Math.round((clip.filterIntensity ?? 1) * 100)}%)`}
                        >
                          <Sparkles size={8} />
                          <span className="truncate max-w-[65px]">{clip.filterName || 'FX'}</span>
                        </div>
                      )}
                      {(clip.hasProxy || clip.proxyPath) && (
                        <div
                          className="flex items-center px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-[#10B981]/90 text-[#0D0E11] shadow-xs"
                          title="Low-res editing proxy active"
                        >
                          <span>PROX</span>
                        </div>
                      )}
                      {clip.synced && (
                        <div
                          className="flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-[#10B981]/90 text-[#0D0E11] shadow-xs shrink-0"
                          title="Synced with earliest clip anchor"
                        >
                          <CheckCircle2 size={10} />
                          <span>SYNCED</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Attached Audio Subtrack with White Oscillating Waveform */}
                <div
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onSelectClip(clip.id);
                    onContextMenu({
                      x: e.clientX,
                      y: e.clientY,
                      clipId: clip.id,
                      trackId: track.id,
                      clipName: clip.name,
                      isVideo: true,
                      hasAttachedAudio: true,
                    });
                  }}
                  style={{ height: `${Math.min(32, Math.max(18, Math.round(trackHeight * 0.32)))}px` }}
                  className="relative bg-[#0A0D14] border-t border-[#222630] overflow-hidden select-none"
                  title="Attached Audio Subtrack (Right-click to Extract Audio)"
                >
                  <div className="absolute left-1.5 top-0 bottom-0 flex items-center gap-1 z-10 pointer-events-none text-[8px] font-mono font-bold text-[#00F0FF]/80">
                    <Volume2 size={9} />
                    <span>{clip.audioProcessing?.noiseProfile?.noiseReductionEnabled ? 'Audio (Clean)' : 'Audio'}</span>
                  </div>
                  <ClipAudioWaveform
                    filePath={
                      (clip.audioProcessing?.noiseProfile?.noiseReductionEnabled &&
                        clip.audioProcessing?.noiseProfile?.denoisedAudioPath)
                        ? clip.audioProcessing.noiseProfile.denoisedAudioPath
                        : clip.filePath
                    }
                    clipId={clip.id}
                    waveformStatus={clip.waveformStatus}
                    volumeDb={clip.volumeDb ?? 0}
                    volumeKeyframes={clip.volumeKeyframes}
                    strokeColor="#7B88EB"
                    baselineColor="#3A3D4D"
                    widthPx={widthPx}
                    heightPx={Math.max(16, Math.min(30, Math.round(trackHeight * 0.32) - 2))}
                    inPointSeconds={clip.inPointSeconds || 0}
                    durationSeconds={durSec}
                    totalDurationSeconds={clip.metadata?.durationSeconds || durSec}
                    noiseReductionEnabled={clip.audioProcessing?.noiseProfile?.noiseReductionEnabled}
                    reductionIntensityDb={clip.audioProcessing?.noiseProfile?.reductionIntensityDb}
                    sensitivity={clip.audioProcessing?.noiseProfile?.sensitivity}
                    visibleTimeRange={visibleTimeRange}
                    clipStartSec={startSec}
                  />
                </div>
              </div>
            ) : (
              /* Video Only (Audio has been extracted to a separate audio track) */
              <div className="relative h-full w-full overflow-hidden bg-[#111319]">
                <ClipVideoFilmstrip
                  filePath={clip.filePath}
                  widthPx={widthPx}
                  heightPx={Math.max(28, trackHeight - 8)}
                  inPointSeconds={clip.inPointSeconds || 0}
                  durationSeconds={durSec}
                  totalDurationSeconds={clip.metadata?.durationSeconds || durSec}
                  fps={fps}
                  visibleTimeRange={visibleTimeRange}
                  clipStartSec={startSec}
                />
                {/* Top Color Accent Line */}
                <div className="absolute top-0 left-0 right-0 h-1 z-10" style={{ backgroundColor: color }} />

                {/* Clip Info Header Overlay */}
                <div className="absolute top-1.5 left-2 right-2 flex items-center justify-between text-[10px] font-semibold text-white drop-shadow-md truncate pointer-events-none z-10">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate bg-black/60 px-1.5 py-0.5 rounded backdrop-blur-xs">{clip.name}</span>
                    {clip.audioExtracted && (
                      <span className="text-[9px] font-mono text-[#00F0FF] bg-black/70 px-1 py-0.5 rounded border border-[#00F0FF]/30">
                        [Extracted Audio]
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {clip.speedProfile && clip.speedProfile.speedMultiplier !== 1.0 && (
                      <div
                        className="flex items-center px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-[#F59E0B]/90 text-[#0D0E11] shadow-xs"
                        title={`Speed Ramping: ${clip.speedProfile.speedMultiplier}x`}
                      >
                        <span>[{clip.speedProfile.speedMultiplier}x]</span>
                      </div>
                    )}
                    {(clip.filterName || clip.filterId) && (
                      <div
                        className="flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-[#00F0FF]/90 text-black shadow-xs shrink-0"
                        title={`Active Filter: ${clip.filterName || clip.filterId} (${Math.round((clip.filterIntensity ?? 1) * 100)}%)`}
                      >
                        <Sparkles size={8} />
                        <span className="truncate max-w-[65px]">{clip.filterName || 'FX'}</span>
                      </div>
                    )}
                    {(clip.hasProxy || clip.proxyPath) && (
                      <div
                        className="flex items-center px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-[#10B981]/90 text-[#0D0E11] shadow-xs"
                        title="Low-res editing proxy active"
                      >
                        <span>PROX</span>
                      </div>
                    )}
                    {clip.synced && (
                      <div
                        className="flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-[#10B981]/90 text-[#0D0E11] shadow-xs shrink-0"
                        title="Synced with earliest clip anchor"
                      >
                        <CheckCircle2 size={10} />
                        <span>SYNCED</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          ) : (
            /* Pure Audio Track Clip */
            <div className="relative h-full w-full bg-[#090C12] overflow-hidden select-none">
              {/* Top Color Accent Line */}
              <div className="absolute top-0 left-0 right-0 h-1 z-10" style={{ backgroundColor: color }} />

              {/* Header Info */}
              <div className="absolute top-1.5 left-2 right-2 flex items-center justify-between text-[10px] font-semibold text-white drop-shadow-md truncate pointer-events-none z-10">
                <div className="flex items-center gap-1">
                  <Mic size={10} className="text-[#F59E0B]" />
                  <span className="truncate bg-black/60 px-1.5 py-0.5 rounded backdrop-blur-xs">{clip.name}</span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {clip.speedProfile && clip.speedProfile.speedMultiplier !== 1.0 && (
                    <div
                      className="flex items-center px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-[#F59E0B]/90 text-[#0D0E11] shadow-xs"
                      title={`Speed Ramping: ${clip.speedProfile.speedMultiplier}x`}
                    >
                      <span>[{clip.speedProfile.speedMultiplier}x]</span>
                    </div>
                  )}
                  {clip.synced && (
                    <div
                      className="flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-[#10B981]/90 text-[#0D0E11] shadow-xs shrink-0"
                      title="Synced with earliest clip anchor"
                    >
                      <CheckCircle2 size={10} />
                      <span>SYNCED</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Continuous Line / Polyline Oscilloscope Waveform */}
              <div className="absolute inset-0 pt-3">
                <ClipAudioWaveform
                  filePath={
                    (clip.audioProcessing?.noiseProfile?.noiseReductionEnabled &&
                      clip.audioProcessing?.noiseProfile?.denoisedAudioPath)
                      ? clip.audioProcessing.noiseProfile.denoisedAudioPath
                      : clip.filePath
                  }
                  clipId={clip.id}
                  waveformStatus={clip.waveformStatus}
                  volumeDb={clip.volumeDb ?? 0}
                  volumeKeyframes={clip.volumeKeyframes}
                  strokeColor="#7B88EB"
                  baselineColor="#3A3D4D"
                  widthPx={widthPx}
                  heightPx={Math.max(24, trackHeight - 16)}
                  inPointSeconds={clip.inPointSeconds || 0}
                  durationSeconds={durSec}
                  totalDurationSeconds={clip.metadata?.durationSeconds || durSec}
                  noiseReductionEnabled={clip.audioProcessing?.noiseProfile?.noiseReductionEnabled}
                  reductionIntensityDb={clip.audioProcessing?.noiseProfile?.reductionIntensityDb}
                  sensitivity={clip.audioProcessing?.noiseProfile?.sensitivity}
                  visibleTimeRange={visibleTimeRange}
                  clipStartSec={startSec}
                />
              </div>
            </div>
          )}

          {/* Top Color Accent Line */}
          <div className="absolute top-0 left-0 right-0 h-1" style={{ backgroundColor: color }} />

          {/* Motion Vector Analysis Striped Pattern & Progress Overlay */}
          {(isStabilizationAnalyzing !== undefined ||
            clip.stabilizationProfile?.status?.type === 'analyzing' ||
            clip.stabilizationProfile?.status?.type === 'trackingMotion' ||
            clip.stabilizationProfile?.status?.type === 'probing' ||
            clip.stabilization?.status?.type === 'analyzing') && (
            <div className="absolute inset-0 z-35 pointer-events-none flex flex-col justify-end overflow-hidden">
              <div className="absolute inset-0 opacity-40 bg-[repeating-linear-gradient(45deg,#00F0FF,#00F0FF_10px,transparent_10px,transparent_20px)] animate-pulse" />
              <div className="relative z-10 bg-[#0D0E11]/90 backdrop-blur-xs px-2 py-0.5 flex items-center justify-between text-[9px] font-mono font-bold text-[#00F0FF] border-t border-[#00F0FF]/40">
                <span className="flex items-center gap-1">
                  <Loader2 size={10} className="animate-spin text-[#00F0FF]" />
                  <span>
                    {clip.stabilizationProfile?.status?.type === 'probing' ? 'Probing IMU...' : 'Tracking Motion...'}{' '}
                    {Math.round(
                      isStabilizationAnalyzing ??
                        (clip.stabilizationProfile?.status?.type === 'analyzing' ||
                        clip.stabilizationProfile?.status?.type === 'trackingMotion'
                          ? clip.stabilizationProfile.status.progress
                          : (clip.stabilization?.status as any)?.progress ?? 0)
                    )}
                    %
                  </span>
                </span>
              </div>
              <div className="w-full bg-[#181B22] h-1">
                <div
                  className="bg-[#00F0FF] h-1 transition-all duration-150"
                  style={{
                    width: `${Math.max(
                      5,
                      isStabilizationAnalyzing ??
                        (clip.stabilizationProfile?.status?.type === 'analyzing' ||
                        clip.stabilizationProfile?.status?.type === 'trackingMotion'
                          ? clip.stabilizationProfile.status.progress
                          : (clip.stabilization?.status as any)?.progress ?? 0)
                    )}%`,
                  }}
                />
              </div>
            </div>
          )}

          {/* Bottom Offset delta info */}
          {clip.syncDeltaSeconds !== undefined && (
            <div className="absolute bottom-1 right-2 text-[9px] font-mono text-emerald-400 font-bold bg-black/60 px-1 rounded pointer-events-none">
              +{clip.syncDeltaSeconds.toFixed(2)}s
            </div>
          )}

          {/* Keyframe Sub-Lane Visualizer */}
          {clip.keyframeTracks && clip.keyframeTracks.some((t) => t.keyframes.length > 0) && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="absolute bottom-0 left-0 right-0 h-4 bg-black/85 border-t border-[#00F0FF]/40 z-20 select-none overflow-hidden"
              title="Global Keyframe Sub-Lane: Click to seek playhead, drag diamond to adjust timing, double-click to delete"
            >
              {/* Floating KF indicator */}
              <div className="absolute left-1 top-0 bottom-0 flex items-center gap-0.5 text-[8px] font-mono font-bold text-[#00F0FF]/70 pointer-events-none z-10">
                <Diamond size={7} fill="currentColor" />
                <span>KF</span>
              </div>

              {/* Keyframe Diamond Points across full 100% width of clip */}
              <div className="absolute inset-0 pointer-events-none">
                {Array.from(
                  new Set(
                    clip.keyframeTracks.flatMap((track) =>
                      track.keyframes.map((k) => Number(k.time.toFixed(3)))
                    )
                  )
                )
                  .sort((a, b) => a - b)
                  .map((kfTime) => {
                    const kfPct = Math.min(100, Math.max(0, (kfTime / durSec) * 100));
                    const kfProps = clip.keyframeTracks
                      ?.filter((track) => track.keyframes.some((k) => Math.abs(k.time - kfTime) < 0.08))
                      .map((t) => {
                        switch (t.property) {
                          case 'position_x': return 'Pos X';
                          case 'position_y': return 'Pos Y';
                          case 'scale': return 'Scale';
                          case 'rotation': return 'Rotation';
                          case 'opacity': return 'Opacity';
                          default: return t.property;
                        }
                      }) || [];
                    const isMaster = kfProps.length >= 5;

                    return (
                      <div
                        key={`global-kf-${clip.id}-${kfTime}`}
                        style={{ left: `${kfPct}%` }}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSeekToKeyframe?.(startSec + kfTime);
                        }}
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          onStartKeyframeDrag?.(clip.id, kfTime, e.clientX, durSec);
                        }}
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          onRemoveKeyframe?.(clip.id, kfTime);
                        }}
                        title={`Keyframe at ${kfTime.toFixed(2)}s [${isMaster ? 'Master (All Properties)' : kfProps.join(', ')}]\n• Click: Seek playhead here\n• Drag: Shift timing\n• Double-click: Delete`}
                        className="absolute top-1/2 -mt-1.5 -ml-1.5 w-3 h-3 rotate-45 bg-[#00F0FF] border border-black shadow-[0_0_6px_#00F0FF] hover:scale-130 transition-transform cursor-ew-resize z-30 pointer-events-auto"
                      />
                    );
                  })}
              </div>
            </div>
          )}

          {/* Left Trim / Slow-Mo Stretch Handle */}
          <div
            onMouseDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onStartTrimLeft(clip.id, e.clientX, e.altKey);
            }}
            className={`absolute left-0 top-0 bottom-0 w-3.5 transition-colors cursor-col-resize z-25 flex items-center justify-center shadow-xs ${
              edgeDragMode === 'stretch'
                ? 'bg-amber-950/40 hover:bg-[#F59E0B] group-hover:bg-[#F59E0B]/30'
                : 'bg-black/40 hover:bg-[#00F0FF] group-hover:bg-[#00F0FF]/30'
            }`}
            title={
              edgeDragMode === 'stretch'
                ? 'Rate Stretch: Drag right to speed-up, drag left to slow-motion (Hold Alt for Trim)'
                : 'Trim / Recover: Drag left to recover hidden video, drag right to trim (Hold Alt for Slow-Mo)'
            }
          >
            <div className={`w-[2px] h-4 rounded-full ${edgeDragMode === 'stretch' ? 'bg-[#F59E0B]' : 'bg-white/70'}`} />
          </div>

          {/* Right Trim / Slow-Mo Stretch Handle */}
          <div
            onMouseDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onStartTrimRight(clip.id, e.clientX, e.altKey);
            }}
            className={`absolute right-0 top-0 bottom-0 w-3.5 transition-colors cursor-col-resize z-25 flex items-center justify-center shadow-xs ${
              edgeDragMode === 'stretch'
                ? 'bg-amber-950/40 hover:bg-[#F59E0B] group-hover:bg-[#F59E0B]/30'
                : 'bg-black/40 hover:bg-[#00F0FF] group-hover:bg-[#00F0FF]/30'
            }`}
            title={
              edgeDragMode === 'stretch'
                ? 'Rate Stretch: Drag right to stretch into Slow-Mo, drag left to speed-up (Hold Alt for Trim)'
                : 'Trim / Recover: Drag right to recover hidden video, drag left to trim (Hold Alt for Slow-Mo)'
            }
          >
            <div className={`w-[2px] h-4 rounded-full ${edgeDragMode === 'stretch' ? 'bg-[#F59E0B]' : 'bg-white/70'}`} />
          </div>
        </div>

        {/* FLOATING HOVER CARD: Displays Full Filename and Detailed Clip Metrics on Hover */}
        <div className="absolute bottom-full left-0 mb-2 hidden group-hover:flex flex-col gap-1 w-64 p-2.5 rounded-lg bg-[#0C0E12]/95 backdrop-blur-md border border-[#00F0FF]/60 shadow-[0_4px_24px_rgba(0,0,0,0.85)] pointer-events-none z-50 text-[11px]">
          {/* Cached Frame Preview (0 CPU/GPU resource overhead) */}
          {isVideo && (
            <div className="w-full h-24 rounded bg-[#0A0C10] overflow-hidden border border-[#222630] mb-1 relative flex items-center justify-center">
              {getNearestCachedFrame(clip.filePath, clip.inPointSeconds || 0, 10.0) ? (
                <img
                  src={getNearestCachedFrame(clip.filePath, clip.inPointSeconds || 0, 10.0)!}
                  alt=""
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="flex items-center gap-1.5 text-[#64748B] text-[10px] font-mono">
                  <Film size={12} className="opacity-50" />
                  <span>Video Preview</span>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center gap-1.5 text-[#00F0FF] font-bold">
            <FileCode size={13} className="shrink-0" />
            <span className="break-all leading-tight font-mono text-xs">{clip.name}</span>
          </div>
          <div className="text-[10px] text-[#8A92A6] font-mono break-all leading-tight">
            {clip.filePath}
          </div>
          <div className="flex items-center justify-between text-[10px] font-mono pt-1 border-t border-[#222630] text-[#64748B]">
            <span>Start: {formatTimecode(startSec, fps)}</span>
            <span>Dur: {durSec.toFixed(1)}s</span>
          </div>
          {clip.synced && (
            <div className="flex items-center justify-between text-[10px] font-mono text-[#10B981] font-semibold">
              <span>Sync Status:</span>
              <span>+{clip.syncDeltaSeconds?.toFixed(2) || '0.00'}s offset</span>
            </div>
          )}
        </div>
      </div>
    );
  },
  (prevProps, nextProps) => {
    // Custom comparator to prevent unnecessary re-renders when unaffected clips/tracks change
    return (
      prevProps.clip.id === nextProps.clip.id &&
      prevProps.clip.startPositionSeconds === nextProps.clip.startPositionSeconds &&
      prevProps.clip.durationSeconds === nextProps.clip.durationSeconds &&
      prevProps.clip.inPointSeconds === nextProps.clip.inPointSeconds &&
      prevProps.clip.outPointSeconds === nextProps.clip.outPointSeconds &&
      prevProps.clip.waveformStatus === nextProps.clip.waveformStatus &&
      prevProps.clip.synced === nextProps.clip.synced &&
      prevProps.clip.syncDeltaSeconds === nextProps.clip.syncDeltaSeconds &&
      prevProps.clip.audioExtracted === nextProps.clip.audioExtracted &&
      prevProps.clip.volumeDb === nextProps.clip.volumeDb &&
      prevProps.clip.volumeKeyframes === nextProps.clip.volumeKeyframes &&
      prevProps.clip.keyframeTracks === nextProps.clip.keyframeTracks &&
      prevProps.clip.filterName === nextProps.clip.filterName &&
      prevProps.clip.filterIntensity === nextProps.clip.filterIntensity &&
      prevProps.clip.speedProfile === nextProps.clip.speedProfile &&
      prevProps.clip.hasProxy === nextProps.clip.hasProxy &&
      prevProps.clip.stabilizationProfile === nextProps.clip.stabilizationProfile &&
      prevProps.clip.audioProcessing === nextProps.clip.audioProcessing &&
      prevProps.isSelected === nextProps.isSelected &&
      prevProps.isDragging === nextProps.isDragging &&
      prevProps.isExternalDragging === nextProps.isExternalDragging &&
      prevProps.zoom === nextProps.zoom &&
      prevProps.trackHeight === nextProps.trackHeight &&
      prevProps.edgeDragMode === nextProps.edgeDragMode &&
      prevProps.color === nextProps.color &&
      prevProps.isStabilizationAnalyzing === nextProps.isStabilizationAnalyzing &&
      prevProps.visibleTimeRange === nextProps.visibleTimeRange &&
      prevProps.fps === nextProps.fps
    );
  }
);
