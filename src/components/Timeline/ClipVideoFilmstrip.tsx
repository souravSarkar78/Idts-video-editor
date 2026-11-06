import React, { useEffect, useState, useRef } from 'react';
import { Film } from 'lucide-react';
import { isTauri } from '../../store/timelineStore';
import { formatTimecode } from '../../utils/timecode';
import {
  getNearestCachedFrame,
  setCachedFrame,
  captureVideoFrame,
  getFilePoster,
} from '../../utils/frameCacheService';

interface ClipVideoFilmstripProps {
  filePath: string;
  widthPx: number;
  heightPx?: number;
  inPointSeconds?: number;
  durationSeconds?: number;
  totalDurationSeconds?: number;
  fps?: number;
  visibleTimeRange?: { startSec: number; endSec: number };
  clipStartSec?: number;
}

export const ClipVideoFilmstrip: React.FC<ClipVideoFilmstripProps> = React.memo(({
  filePath,
  widthPx,
  heightPx = 46,
  inPointSeconds = 0,
  durationSeconds = 10,
  totalDurationSeconds = 60,
  fps = 30,
  visibleTimeRange,
  clipStartSec = 0,
}) => {
  const pxPerSec = durationSeconds > 0 ? widthPx / durationSeconds : 35;
  const effectiveFps = Math.max(1, fps);
  const pxPerFrame = pxPerSec / effectiveFps;

  // Approximate 16:9 thumbnail width on the timeline
  const aspectTileWidth = Math.round(heightPx * (16 / 9));

  // Determine individual tile width:
  // If zoomed in to single-frame level (pxPerFrame >= 24), each tile represents exactly 1 frame!
  // Otherwise, each tile is roughly 16:9 thumbnail size (~80px).
  const isFrameLevel = pxPerFrame >= 24;
  const tileWidth = isFrameLevel ? pxPerFrame : Math.max(48, Math.min(aspectTileWidth, 84));

  // Viewport windowing: only compute tiles that overlap the screen
  let windowStartPx = 0;
  let windowEndPx = widthPx;

  if (visibleTimeRange) {
    const vStartSec = visibleTimeRange.startSec - clipStartSec;
    const vEndSec = visibleTimeRange.endSec - clipStartSec;
    windowStartPx = Math.max(0, (vStartSec - 0.2) * pxPerSec);
    windowEndPx = Math.min(widthPx, (vEndSec + 0.2) * pxPerSec);
  }

  const startTileIdx = Math.max(0, Math.floor(windowStartPx / tileWidth));
  const endTileIdx = Math.min(Math.ceil(widthPx / tileWidth), Math.ceil(windowEndPx / tileWidth));
  const visibleIndices: number[] = [];
  for (let i = startTileIdx; i < endTileIdx; i++) {
    visibleIndices.push(i);
  }

  // Revision state triggered when new frames are added to global cache
  const [, setCacheRev] = useState(0);
  const isCancelledRef = useRef(false);

  // Background frame extractor: lightweight sample points (head, mid, tail) with preload="metadata"
  useEffect(() => {
    isCancelledRef.current = false;
    if (!filePath || durationSeconds <= 0) return;

    // Distribute sample keyframes: head, mid, tail (max 3-4 keyframes, avoiding heavy browser seeking)
    const candidateTimes = [
      inPointSeconds + 0.1,
      inPointSeconds + durationSeconds * 0.5,
      Math.max(inPointSeconds + 0.1, inPointSeconds + durationSeconds - 0.5),
    ];

    const missingTimes = candidateTimes.filter(
      (t) => !getNearestCachedFrame(filePath, t, 1.0)
    );

    if (missingTimes.length === 0) return;

    let cleanupVideo: (() => void) | null = null;

    const extractSamples = async () => {
      try {
        let videoSrc = filePath;
        if (isTauri && typeof window !== 'undefined') {
          try {
            const internals = (window as any).__TAURI_INTERNALS__;
            if (internals?.convertFileSrc) {
              videoSrc = internals.convertFileSrc(filePath, 'asset');
            }
          } catch {}
        }

        const video = document.createElement('video');
        video.crossOrigin = 'anonymous';
        video.muted = true;
        video.playsInline = true;
        video.preload = 'metadata'; // Never buffer entire file into memory!
        video.src = videoSrc;

        cleanupVideo = () => {
          try {
            video.src = '';
            video.load();
          } catch {}
        };

        // Wait for video metadata to load
        await new Promise<void>((resolve) => {
          let resolved = false;
          const onReady = () => {
            if (!resolved) {
              resolved = true;
              video.removeEventListener('loadeddata', onReady);
              video.removeEventListener('loadedmetadata', onReady);
              video.removeEventListener('canplay', onReady);
              video.removeEventListener('error', onError);
              resolve();
            }
          };
          const onError = () => {
            if (!resolved) {
              resolved = true;
              resolve();
            }
          };

          video.addEventListener('loadeddata', onReady);
          video.addEventListener('loadedmetadata', onReady);
          video.addEventListener('canplay', onReady);
          video.addEventListener('error', onError);
          setTimeout(onReady, 1800);
        });

        if (isCancelledRef.current) {
          cleanupVideo();
          return;
        }

        let anyExtracted = false;

        // Decode each missing keyframe
        for (const targetTime of missingTimes) {
          if (isCancelledRef.current) break;

          const clampedTime = Math.min(
            video.duration || totalDurationSeconds,
            Math.max(0, targetTime)
          );

          try {
            video.currentTime = clampedTime;
          } catch {
            continue;
          }

          await new Promise<void>((resolve) => {
            let seekDone = false;
            const onSeeked = () => {
              if (!seekDone) {
                seekDone = true;
                video.removeEventListener('seeked', onSeeked);
                resolve();
              }
            };
            video.addEventListener('seeked', onSeeked);
            setTimeout(onSeeked, 400);
          });

          if (isCancelledRef.current) break;

          if (video.videoWidth > 0 && !video.seeking) {
            const dataUrl = captureVideoFrame(video, 120, 68);
            if (dataUrl) {
              setCachedFrame(filePath, targetTime, dataUrl);
              anyExtracted = true;
            }
          }
        }

        cleanupVideo();

        // Batch notify React exactly once when sampling completes
        if (anyExtracted && !isCancelledRef.current) {
          setCacheRev((r) => r + 1);
        }
      } catch {
        if (cleanupVideo) cleanupVideo();
      }
    };

    extractSamples();

    return () => {
      isCancelledRef.current = true;
      if (cleanupVideo) cleanupVideo();
    };
  }, [filePath, inPointSeconds, durationSeconds, totalDurationSeconds]);

  const poster = getFilePoster(filePath);

  return (
    <div
      style={{ height: `${heightPx}px` }}
      className="absolute inset-0 overflow-hidden pointer-events-none select-none bg-[#0E1016]"
    >
      {visibleIndices.map((index) => {
        // Precise timestamp corresponding to the center of this tile on the timeline
        const frameTime = inPointSeconds + ((index + 0.5) * tileWidth) / pxPerSec;
        const tileLeft = index * tileWidth;

        // 1. Closest authentic frame within 2 seconds
        let imgUrl: string | undefined = getNearestCachedFrame(filePath, frameTime, 2.0) || undefined;

        // 2. Fallback to nearest cached frame across the entire clip if still extracting
        if (!imgUrl) {
          imgUrl = getNearestCachedFrame(filePath, frameTime, Infinity) || poster || undefined;
        }

        return (
          <div
            key={index}
            style={{
              position: 'absolute',
              left: `${tileLeft}px`,
              width: `${tileWidth}px`,
              height: `${heightPx}px`,
            }}
            className="border-r border-black/50 overflow-hidden bg-[#12151E] flex items-center justify-center group"
          >
            {imgUrl ? (
              <img
                src={imgUrl}
                alt=""
                className="h-full object-cover select-none pointer-events-none"
                style={{
                  width: isFrameLevel ? '100%' : `${aspectTileWidth}px`,
                  maxWidth: '100%',
                }}
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-[#181C26] to-[#0E1017] text-[#475569]">
                <Film size={12} className="opacity-40 animate-pulse" />
                <span className="text-[8px] font-mono opacity-50 mt-0.5">
                  {formatTimecode(frameTime, effectiveFps).slice(3, 8)}
                </span>
              </div>
            )}

            {/* Film Perforation Sprocket Holes Overlay */}
            <div className="absolute top-0.5 left-0 right-0 flex justify-between px-1 pointer-events-none opacity-30">
              <div className="w-1 h-0.5 bg-black/80 rounded-xs" />
              <div className="w-1 h-0.5 bg-black/80 rounded-xs" />
            </div>
            <div className="absolute bottom-0.5 left-0 right-0 flex justify-between px-1 pointer-events-none opacity-30">
              <div className="w-1 h-0.5 bg-black/80 rounded-xs" />
              <div className="w-1 h-0.5 bg-black/80 rounded-xs" />
            </div>
          </div>
        );
      })}
    </div>
  );
});
ClipVideoFilmstrip.displayName = 'ClipVideoFilmstrip';
