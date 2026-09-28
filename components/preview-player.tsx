"use client";

import { useRef } from "react";
import { useVideoSource } from "@/lib/use-video-source";

/**
 * Public preview with sound. Either the Mux clip (already cut to the teacher's range), or the pasted
 * video link held to [start, end] on the client, looping back to the start.
 */
export function PreviewPlayer({ src, start, end, poster }: { src: string; start?: number | null; end?: number | null; poster?: string }) {
  const v = useRef<HTMLVideoElement>(null);
  useVideoSource(v, src);
  const ranged = start != null && end != null;
  return (
    <video
      ref={v}
      poster={poster}
      controls
      playsInline
      preload="metadata"
      className="aspect-video w-full"
      aria-label="Lesson preview"
      onLoadedMetadata={(e) => { if (ranged) e.currentTarget.currentTime = start!; }}
      onTimeUpdate={(e) => {
        if (!ranged) return;
        const el = e.currentTarget;
        if (el.currentTime >= end! || el.currentTime < start! - 0.5) {
          el.currentTime = start!;
          if (el.currentTime >= end!) el.pause();
        }
      }}
      onEnded={(e) => { if (ranged) e.currentTarget.currentTime = start!; }}
    />
  );
}
