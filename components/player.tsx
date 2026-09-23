"use client";

import { useEffect, useRef, useState } from "react";
import { FlipHorizontal2, Pause, Play } from "lucide-react";
import { savePracticeAction } from "@/app/actions";
import { cn, fmtDuration } from "@/lib/utils";

type Section = { id: string; label: string; startSec: number; endSec: number };

export function Player({ serviceId, src, poster, sections, startAt }: { serviceId: string; src: string; poster?: string; sections: Section[]; startAt: number }) {
  const v = useRef<HTMLVideoElement>(null);
  const lastSaved = useRef(0);
  const [playing, setPlaying] = useState(false);
  const [t, setT] = useState(0);
  const [dur, setDur] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [mirror, setMirror] = useState(false);
  const [done, setDone] = useState(false);

  const save = (completed = false) => {
    const el = v.current;
    if (!el) return;
    lastSaved.current = el.currentTime;
    savePracticeAction(serviceId, el.currentTime, completed);
  };

  useEffect(() => {
    const el = v.current;
    return () => { if (el && el.currentTime > 0) savePracticeAction(serviceId, el.currentTime, false); };
  }, [serviceId]);

  const seek = (sec: number) => {
    if (!v.current) return;
    v.current.currentTime = sec;
    setT(sec);
  };
  const toggle = () => {
    const el = v.current;
    if (!el) return;
    if (el.paused) el.play(); else el.pause();
  };

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-lg border bg-black">
        <video
          ref={v}
          src={src}
          poster={poster}
          playsInline
          preload="metadata"
          onClick={toggle}
          className="aspect-video w-full transition-transform"
          style={{ transform: mirror ? "scaleX(-1)" : undefined }}
          onLoadedMetadata={(e) => {
            const el = e.currentTarget;
            setDur(el.duration);
            if (startAt > 0 && startAt < el.duration - 1) el.currentTime = startAt;
          }}
          onTimeUpdate={(e) => {
            const now = e.currentTarget.currentTime;
            setT(now);
            if (Math.abs(now - lastSaved.current) >= 10) save();
          }}
          onPlay={() => setPlaying(true)}
          onPause={() => { setPlaying(false); save(); }}
          onEnded={() => { setDone(true); save(true); }}
        />
      </div>

      <div className="flex items-center gap-3">
        <button onClick={toggle} aria-label={playing ? "Pause" : "Play"} className="grid size-11 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
          {playing ? <Pause className="size-5" /> : <Play className="size-5" />}
        </button>
        <input type="range" min={0} max={dur || 0} step={0.1} value={t} onChange={(e) => seek(Number(e.target.value))} className="min-w-0 flex-1" aria-label="Scrub" />
        <span className="w-20 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{fmtDuration(Math.floor(t))} / {fmtDuration(Math.floor(dur))}</span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {[0.5, 0.75, 1].map((r) => (
          <button
            key={r}
            onClick={() => { setSpeed(r); if (v.current) v.current.playbackRate = r; }}
            className={cn("h-9 rounded-md border px-3 text-sm", speed === r ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground")}
          >
            {r}x
          </button>
        ))}
        <button
          onClick={() => setMirror((m) => !m)}
          className={cn("ml-auto flex h-9 items-center gap-1 rounded-md border px-3 text-sm", mirror ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground")}
        >
          <FlipHorizontal2 className="size-4" /> Mirror
        </button>
      </div>

      {sections.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {sections.map((s) => {
            const active = t >= s.startSec && t < s.endSec;
            return (
              <button key={s.id} onClick={() => seek(s.startSec)} className={cn("rounded-md border p-2 text-left text-sm", active ? "border-primary text-primary" : "bg-card")}>
                <span className="block truncate font-medium">{s.label}</span>
                <span className="text-xs text-muted-foreground">{fmtDuration(s.startSec)}</span>
              </button>
            );
          })}
        </div>
      )}
      {done && <p className="text-center text-sm text-emerald-400">Marked complete. Nice work.</p>}
    </div>
  );
}
