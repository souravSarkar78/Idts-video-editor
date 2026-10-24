import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Film, Music } from 'lucide-react';
import { isTauri } from '../../store/timelineStore';
import { formatTimecode } from '../../utils/timecode';
import { MediaType } from '../../types/ipc';
import {
  getNearestCachedFrame,
  setCachedFrame,
  captureVideoFrame,
  filePosterCache,
} from '../../utils/frameCacheService';

interface MediaThumbnailProps {
  filePath: string;
  mediaType: MediaType | string;
  durationSeconds: number;
  name: string;
  className?: string;
}

export const MediaThumbnail: React.FC<MediaThumbnailProps> = ({
  filePath,
  mediaType,
  durationSeconds,
  name,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [posterUrl, setPosterUrl] = useState<string | null>(filePosterCache.get(filePath) || null);
  const [isHovering, setIsHovering] = useState(false);
  const [hoverRatio, setHoverRatio] = useState<number | null>(null);
  const [hoverTime, setHoverTime] = useState<number>(0);
  const [hoverFrameUrl, setHoverFrameUrl] = useState<string | null>(null);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const lastSeekTimeRef = useRef<number>(0);

  // Resolve convertFileSrc asset URL for Tauri
  useEffect(() => {
    let isCancelled = false;
    if (mediaType !== 'video' || !filePath) return;

    if (isTauri) {
      import('@tauri-apps/api/core')
        .then(({ convertFileSrc }) => {
          if (!isCancelled) {
            setVideoSrc(convertFileSrc(filePath));
          }
        })
        .catch(() => {
          if (!isCancelled) setVideoSrc(filePath);
        });
    } else {
      setVideoSrc(filePath);
    }

    return () => {
      isCancelled = true;
    };
  }, [filePath, mediaType]);

  // Capture default poster thumbnail once video metadata is available
  const handleLoadedData = useCallback(() => {
    setIsVideoReady(true);
    if (!videoRef.current) return;

    const existing = filePosterCache.get(filePath);
    if (existing) {
      setPosterUrl(existing);
      return;
    }

    try {
      const v = videoRef.current;
      if (v.videoWidth > 0) {
        const dataUrl = captureVideoFrame(v, 160, 90);
        if (dataUrl) {
          setCachedFrame(filePath, 0.1, dataUrl);
          setPosterUrl(dataUrl);
        }
      }
    } catch {
      // Ignored if canvas security policy blocks dataUrl
    }
  }, [filePath]);

  // Horizontal Hover Scrubbing with Cached Frame Reuse
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!containerRef.current || mediaType !== 'video') return;
      const rect = containerRef.current.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const targetTime = ratio * (durationSeconds || 10);

      setHoverRatio(ratio);
      setHoverTime(targetTime);

      // 1. Check if a frame near this time is already in cache
      const cached = getNearestCachedFrame(filePath, targetTime, 0.6);
      if (cached) {
        setHoverFrameUrl(cached);
        return;
      }

      // 2. If not yet cached, clear hoverFrameUrl so the live seeking video element is visible
      setHoverFrameUrl(null);

      // 3. Throttle seeking to avoid hardware decoder flooding
      const now = performance.now();
      if (videoRef.current && isVideoReady && now - lastSeekTimeRef.current > 40) {
        lastSeekTimeRef.current = now;
        try {
          videoRef.current.currentTime = targetTime;
        } catch {}
      }
    },
    [durationSeconds, isVideoReady, mediaType, filePath]
  );

  const handleMouseEnter = () => {
    if (mediaType === 'video') {
      setIsHovering(true);
    }
  };

  const handleMouseLeave = () => {
    setIsHovering(false);
    setHoverRatio(null);
    setHoverFrameUrl(null);
    if (videoRef.current) {
      try {
        videoRef.current.currentTime = Math.min(1.0, durationSeconds * 0.1);
      } catch {}
    }
  };

  if (mediaType === 'audio') {
    return (
      <div className={`relative w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-[#12141A] to-[#1E222D] text-[#F59E0B] select-none ${className}`}>
        <Music size={26} className="opacity-75 mb-1" />
        <span className="text-[9px] font-mono text-[#8A92A6]">Audio Media</span>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onMouseEnter={handleMouseEnter}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={`relative w-full h-full bg-[#0D0E12] overflow-hidden select-none cursor-pointer group ${className}`}
    >
      {/* Background Video Element for decoding and live rendering uncached frames */}
      {videoSrc && (
        <video
          ref={videoRef}
          src={videoSrc}
          crossOrigin="anonymous"
          preload="auto"
          muted
          playsInline
          onLoadedData={handleLoadedData}
          onSeeked={() => {
            if (videoRef.current) {
              const dataUrl = captureVideoFrame(videoRef.current, 160, 90);
              if (dataUrl) {
                const currentT = videoRef.current.currentTime;
                setCachedFrame(filePath, currentT, dataUrl);
                setHoverFrameUrl(dataUrl);
                if (!posterUrl) setPosterUrl(dataUrl);
              }
            }
          }}
          className={`absolute inset-0 w-full h-full object-cover pointer-events-none ${
            isHovering && !hoverFrameUrl ? 'opacity-100 z-20' : 'opacity-0 z-0'
          }`}
        />
      )}

      {/* Render Cached Frame (Zero CPU/GPU decoder utilization) or Static Poster */}
      {(hoverFrameUrl || posterUrl) && (
        <img
          src={hoverFrameUrl || posterUrl!}
          alt={name}
          draggable={false}
          className={`absolute inset-0 w-full h-full object-cover pointer-events-none select-none ${
            isHovering && !hoverFrameUrl ? 'opacity-0 z-0' : 'opacity-100 z-10'
          }`}
        />
      )}

      {/* Fallback film gradient while video decodes first frame */}
      {!posterUrl && !isVideoReady && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-[#12141A] to-[#1E222D] text-[#00F0FF] z-0">
          <Film size={24} className="opacity-40 animate-pulse mb-1" />
          <span className="text-[8px] font-mono text-[#64748B]">Loading frame...</span>
        </div>
      )}

      {/* Horizontal Hover Scrubber Needle & Playhead Line */}
      {isHovering && hoverRatio !== null && (
        <>
          {/* Vertical scrubber line indicator */}
          <div
            style={{ left: `${hoverRatio * 100}%` }}
            className="absolute top-0 bottom-0 w-[1.5px] bg-[#00F0FF] shadow-[0_0_8px_#00F0FF] pointer-events-none z-30"
          />

          {/* Hover Timecode Pill at top-center */}
          <div className="absolute top-1 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded bg-black/80 border border-[#00F0FF]/40 text-[9px] font-mono font-bold text-[#00F0FF] shadow-lg pointer-events-none z-30 flex items-center gap-1">
            <span>{formatTimecode(hoverTime, 30)}</span>
          </div>

          {/* Bottom Progress Bar Track */}
          <div className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-black/50 z-30 pointer-events-none">
            <div
              style={{ width: `${hoverRatio * 100}%` }}
              className="h-full bg-[#00F0FF] shadow-[0_0_6px_#00F0FF]"
            />
          </div>
        </>
      )}
    </div>
  );
};
