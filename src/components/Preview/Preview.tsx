import React, { useState, useEffect } from 'react';
import {
  Video,
  Layers,
  Volume2,
  Maximize,
  Sparkles,
  Camera,
  CheckCircle2,
} from 'lucide-react';
import { useTimelineStore } from '../../store/timelineStore';
import { formatTimecode } from '../../utils/timecode';

export const Preview: React.FC = () => {
  const { playhead, project, isPlaying, tracks } = useTimelineStore();
  const [activeAngle, setActiveAngle] = useState<'cam1' | 'cam2' | 'multicam'>('multicam');
  const [vuLeft, setVuLeft] = useState(45);
  const [vuRight, setVuRight] = useState(48);

  // Dynamic Audio VU meter animation during playback
  useEffect(() => {
    if (!isPlaying) {
      setVuLeft(0);
      setVuRight(0);
      return;
    }

    const interval = setInterval(() => {
      const base = 50 + Math.random() * 38;
      setVuLeft(Math.min(95, Math.max(10, base + (Math.random() * 8 - 4))));
      setVuRight(Math.min(95, Math.max(10, base + (Math.random() * 8 - 4))));
    }, 80);

    return () => clearInterval(interval);
  }, [isPlaying]);

  return (
    <div className="flex-1 flex overflow-hidden bg-[#0A0B0E] p-3 gap-3">
      {/* Video Viewport Stage */}
      <div className="flex-1 bg-[#14161B] rounded-lg border border-[#222630] flex flex-col overflow-hidden relative shadow-inner">
        {/* Top Viewport Header */}
        <div className="h-8 bg-[#101217] border-b border-[#222630] px-3 flex items-center justify-between text-xs text-[#8A92A6]">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-[#F0F3F8]">Program Monitor</span>
            <span className="text-[10px] text-[#64748B]">
              ({project.width}x{project.height} Rec.709)
            </span>
          </div>

          {/* Multicam Angle Switcher Buttons */}
          <div className="flex items-center gap-1 bg-[#0D0E11] p-0.5 rounded border border-[#222630]">
            <button
              onClick={() => setActiveAngle('multicam')}
              className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors ${
                activeAngle === 'multicam'
                  ? 'bg-[#00F0FF] text-[#0D0E11]'
                  : 'text-[#8A92A6] hover:text-[#F0F3F8]'
              }`}
            >
              Split Multi-Cam
            </button>
            <button
              onClick={() => setActiveAngle('cam1')}
              className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors ${
                activeAngle === 'cam1'
                  ? 'bg-[#00F0FF] text-[#0D0E11]'
                  : 'text-[#8A92A6] hover:text-[#F0F3F8]'
              }`}
            >
              Cam 1 (Center)
            </button>
            <button
              onClick={() => setActiveAngle('cam2')}
              className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors ${
                activeAngle === 'cam2'
                  ? 'bg-[#A855F7] text-[#F0F3F8]'
                  : 'text-[#8A92A6] hover:text-[#F0F3F8]'
              }`}
            >
              Cam 2 (Side)
            </button>
          </div>
        </div>

        {/* Monitor Screen Area */}
        <div className="flex-1 flex items-center justify-center relative bg-[#090A0C] overflow-hidden">
          {activeAngle === 'multicam' ? (
            // Split Multicam View (Cam 1 & Cam 2 side-by-side)
            <div className="w-full h-full grid grid-cols-2 gap-2 p-2">
              {/* Cam 1 Stage */}
              <div className="relative rounded border border-[#00F0FF]/40 bg-[#12141A] flex items-center justify-center overflow-hidden group">
                <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-[#00F0FF]/20 border border-[#00F0FF]/40 text-[#00F0FF] text-[10px] font-bold font-mono">
                  CAM 1 // MASTER 4K
                </div>
                <div className="text-center">
                  <Camera size={36} className="mx-auto text-[#00F0FF] opacity-60 mb-2" />
                  <span className="text-xs font-mono text-[#8A92A6]">VID_20261018_140000.mp4</span>
                </div>
                {/* Realtime Synced Tag */}
                <div className="absolute bottom-2 left-2 flex items-center gap-1 text-[10px] font-mono text-[#10B981]">
                  <CheckCircle2 size={11} />
                  <span>SYNCED [0.00s]</span>
                </div>
              </div>

              {/* Cam 2 Stage */}
              <div className="relative rounded border border-[#A855F7]/40 bg-[#12141A] flex items-center justify-center overflow-hidden group">
                <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-[#A855F7]/20 border border-[#A855F7]/40 text-[#A855F7] text-[10px] font-bold font-mono">
                  CAM 2 // SIDE 4K
                </div>
                <div className="text-center">
                  <Camera size={36} className="mx-auto text-[#A855F7] opacity-60 mb-2" />
                  <span className="text-xs font-mono text-[#8A92A6]">VID_20261018_140003.mp4</span>
                </div>
                <div className="absolute bottom-2 left-2 flex items-center gap-1 text-[10px] font-mono text-[#10B981]">
                  <CheckCircle2 size={11} />
                  <span>OFFSET [+3.00s]</span>
                </div>
              </div>
            </div>
          ) : (
            // Single Focused Angle View
            <div className="w-full h-full flex items-center justify-center relative">
              <div className="text-center">
                <Video
                  size={56}
                  className="mx-auto opacity-70 mb-3"
                  style={{ color: activeAngle === 'cam1' ? '#00F0FF' : '#A855F7' }}
                />
                <div className="text-sm font-semibold text-[#F0F3F8]">
                  {activeAngle === 'cam1' ? 'Cam 1 (Master / Center)' : 'Cam 2 (Side Angle)'}
                </div>
                <div className="text-xs font-mono text-[#8A92A6] mt-1">
                  {activeAngle === 'cam1' ? 'VID_20261018_140000.mp4' : 'VID_20261018_140003.mp4'}
                </div>
              </div>

              {/* Status overlay */}
              <div className="absolute top-3 left-3 px-2 py-1 rounded bg-[#0D0E11]/80 backdrop-blur-xs border border-[#222630] text-[11px] font-mono text-[#10B981] flex items-center gap-1.5">
                <CheckCircle2 size={12} />
                <span>TIME-ALIGNED</span>
              </div>
            </div>
          )}

          {/* Timecode overlay badge on monitor */}
          <div className="absolute bottom-3 right-3 px-3 py-1 bg-[#0D0E11]/90 backdrop-blur-md rounded border border-[#222630] text-[#00F0FF] timecode-display text-sm font-bold tracking-widest shadow-lg">
            {formatTimecode(playhead, project.fps)}
          </div>
        </div>
      </div>

      {/* Right Column: Audio VU Master Meters */}
      <div className="w-16 bg-[#14161B] rounded-lg border border-[#222630] flex flex-col p-2 select-none shrink-0">
        <div className="text-[9px] uppercase font-bold text-center text-[#64748B] mb-2 tracking-wider">
          MASTER
        </div>

        {/* Dual VU Meter Bars (Left and Right) */}
        <div className="flex-1 flex justify-center gap-2 items-end pb-2">
          {/* L Channel */}
          <div className="w-2.5 h-full bg-[#0D0E11] rounded-full overflow-hidden flex flex-col justify-end p-0.5 border border-[#222630]">
            <div
              style={{ height: `${vuLeft}%` }}
              className={`w-full rounded-full transition-all duration-75 ${
                vuLeft > 85 ? 'bg-red-500' : vuLeft > 70 ? 'bg-amber-400' : 'bg-[#10B981]'
              }`}
            />
          </div>

          {/* R Channel */}
          <div className="w-2.5 h-full bg-[#0D0E11] rounded-full overflow-hidden flex flex-col justify-end p-0.5 border border-[#222630]">
            <div
              style={{ height: `${vuRight}%` }}
              className={`w-full rounded-full transition-all duration-75 ${
                vuRight > 85 ? 'bg-red-500' : vuRight > 70 ? 'bg-amber-400' : 'bg-[#10B981]'
              }`}
            />
          </div>
        </div>

        {/* dB indicator */}
        <div className="text-[8px] font-mono text-center text-[#64748B] border-t border-[#222630] pt-1">
          {isPlaying ? '-6 dB' : '-∞ dB'}
        </div>
      </div>
    </div>
  );
};
