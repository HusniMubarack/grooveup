"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play, Scissors } from "lucide-react";
import { MAX_PREVIEW_SEC } from "@/lib/categories";
import { useVideoSource } from "@/lib/use-video-source";
import { fmtDuration } from "@/lib/utils";

const MIN_PREVIEW_SEC = 3;

/**
 * Pick the public preview: a ≤ 30 s part of the teacher's own video. Plays the local file right after
 * picking it (no waiting for upload/processing), the pasted link, or the lesson's current video when editing.
 */
export function PreviewPicker({ src, initialStart, initialEnd }: { src: string | null; initialStart?: number | null; initialEnd?: number | null }) {
  const v = useRef<HTMLVideoElement>(null);
  const [dur, setDur] = useState(0);
  const [start, setStart] = useState(initialStart ?? 0);
  const [len, setLen] = useState(initialStart != null && initialEnd != null ? initialEnd - initialStart : 15);
  const [playing, setPlaying] = useState(false);
  const [t, setT] = useState(0);
  const [touched, setTouched] = useState(initialStart != null);
  useVideoSource(v, src);

  const maxLen = Math.max(MIN_PREVIEW_SEC, Math.min(MAX_PREVIEW_SEC, Math.floor(dur - start) || MAX_PREVIEW_SEC));
  const length = Math.min(len, maxLen);
  const end = start + length;

  // Stop at the end of the preview while previewing.
  useEffect(() => {
    const el = v.current;
    if (!el) return;
    const onTime = () => {
      setT(el.currentTime);
      if (playing && el.currentTime >= end) { el.pause(); el.currentTime = start; }
    };
    el.addEventListener("timeupdate", onTime);
    return () => el.removeEventListener("timeupdate", onTime);
  }, [playing, start, end]);

  if (!src) {
    return <p className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">Upload or paste the lesson video to choose its preview.</p>;
  }

  const playPreview = () => {
    const el = v.current;
    if (!el) return;
    if (playing) { el.pause(); return; }
    el.currentTime = start;
    el.muted = false;
    el.play().catch(() => {});
  };

  return (
    <div className="grid gap-2 rounded-md border p-3">
      {(touched || dur > 0) && <input type="hidden" name="previewStart" value={Math.floor(start)} />}
      {(touched || dur > 0) && <input type="hidden" name="previewEnd" value={Math.floor(end)} />}
      <div className="relative overflow-hidden rounded bg-black">
        <video
          ref={v}
          playsInline
          preload="metadata"
          className="aspect-video w-full"
          onLoadedMetadata={(e) => {
            const d = Math.floor(e.currentTarget.duration);
            setDur(d);
            if (initialStart == null) setLen(Math.min(15, d));
          }}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
        />
        <span className="absolute bottom-2 left-2 rounded bg-black/70 px-1.5 text-[11px] tabular-nums">{fmtDuration(Math.floor(t))}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <button type="button" onClick={playPreview} className="flex h-8 items-center gap-1 rounded-md bg-primary px-3 font-medium text-primary-foreground">
          {playing ? <Pause className="size-3.5" /> : <Play className="size-3.5" />} {playing ? "Stop" : "Play preview"}
        </button>
        <button
          type="button"
          onClick={() => { setStart(Math.floor(v.current?.currentTime ?? 0)); setTouched(true); }}
          className="flex h-8 items-center gap-1 rounded-md border px-3"
        >
          <Scissors className="size-3.5" /> Start here
        </button>
        <span className="ml-auto tabular-nums text-primary">
          {fmtDuration(start)} → {fmtDuration(end)} ({length} s)
        </span>
      </div>
      <label className="grid gap-1 text-[11px] text-muted-foreground">
        Starts at {fmtDuration(start)}
        <input type="range" min={0} max={Math.max(0, dur - MIN_PREVIEW_SEC)} step={1} value={start} aria-label="Preview start"
          onChange={(e) => { setStart(Number(e.target.value)); setTouched(true); if (v.current) v.current.currentTime = Number(e.target.value); }} />
      </label>
      <label className="grid gap-1 text-[11px] text-muted-foreground">
        Length {length} s (max {MAX_PREVIEW_SEC})
        <input type="range" min={MIN_PREVIEW_SEC} max={maxLen} step={1} value={length} aria-label="Preview length"
          onChange={(e) => { setLen(Number(e.target.value)); setTouched(true); }} />
      </label>
      <p className="text-[11px] text-muted-foreground">Students who haven&apos;t unlocked the lesson see only this part, with sound.</p>
    </div>
  );
}
