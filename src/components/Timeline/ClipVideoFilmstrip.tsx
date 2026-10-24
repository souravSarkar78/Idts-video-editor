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
}

export const ClipVideoFilmstrip: React.FC<ClipVideoFilmstripProps> = React.memo(({
  filePath,
  widthPx,
  heightPx = 46,
  inPointSeconds = 0,
  durationSeconds = 10,
  totalDurationSeconds = 60,
  fps = 30,
}) => {
  // Approximate 16:9 thumbnail width on the timeline
  const approxTileWidth = 72;
  // Span the full width of the clip seamlessly, even when deeply zoomed in (no cutoff or missing tiles)
  const numTiles = Math.max(1, Math.min(300, Math.ceil(widthPx / approxTileWidth)));
  // Each tile gets exact width so numTiles * tileWidth covers 100% of the clip width
  const tileWidth = widthPx / numTiles;

  // Revision state triggered when new frames are added to global cache
  const [, setCacheRev] = useState(0);
  const isCancelledRef = useRef(false);

  // Background frame extractor: decoupled from widthPx so zooming in/out NEVER cancels or restarts decoding
  useEffect(() => {
    isCancelledRef.current = false;
    if (!filePath || durationSeconds <= 0) return;

    // Distribute sample keyframes across the clip duration (~1 frame every 1.5s to 2s, max 30 keyframes)
    const sampleCount = Math.min(30, Math.max(8, Math.ceil(durationSeconds / 1.5)));
    const missingTimes: number[] = [];

    for (let k = 0; k < sampleCount; k++) {
      const t =
        inPointSeconds +
        (sampleCount === 1 ? 0 : (k / (sampleCount - 1)) * durationSeconds);
      if (!getNearestCachedFrame(filePath, t, 0.75)) {
        missingTimes.push(t);
      }
    }

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
        video.preload = 'auto';
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
          video.addEventListener('canplay', onReady);
          video.addEventListener('error', onError);
          setTimeout(onReady, 2500);
        });

        if (isCancelledRef.current) {
          cleanupVideo();
          return;
        }

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
            setTimeout(onSeeked, 800);
          });

          if (isCancelledRef.current) break;

          if (video.videoWidth > 0 && !video.seeking) {
            const dataUrl = captureVideoFrame(video, 120, 68);
            if (dataUrl) {
              setCachedFrame(filePath, targetTime, dataUrl);
              if (!isCancelledRef.current) {
                setCacheRev((r) => r + 1);
              }
            }
          }
        }

        cleanupVideo();
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
      className="absolute inset-0 flex overflow-hidden pointer-events-none select-none bg-[#0E1016]"
    >
      {Array.from({ length: numTiles }).map((_, index) => {
        // Precise timestamp corresponding to the center of this tile on the timeline
        const frameTime =
          inPointSeconds +
          ((index + 0.5) / numTiles) * durationSeconds;

        // 1. Closest authentic frame within 2 seconds
        let imgUrl: string | undefined = getNearestCachedFrame(filePath, frameTime, 2.0) || undefined;

        // 2. Fallback to nearest cached frame across the entire clip if still extracting
        if (!imgUrl) {
          imgUrl = getNearestCachedFrame(filePath, frameTime, Infinity) || poster || undefined;
        }

        return (
          <div
            key={index}
            style={{ width: `${tileWidth}px`, height: `${heightPx}px` }}
            className="shrink-0 relative border-r border-black/40 overflow-hidden bg-[#12151E] flex items-center justify-center group"
          >
            {imgUrl ? (
              <img
                src={imgUrl}
                alt=""
                className="w-full h-full object-cover select-none pointer-events-none"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-[#181C26] to-[#0E1017] text-[#475569]">
                <Film size={12} className="opacity-40 animate-pulse" />
                <span className="text-[8px] font-mono opacity-50 mt-0.5">
                  {formatTimecode(frameTime, fps).slice(3, 8)}
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
