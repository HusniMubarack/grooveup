"use client";

import { useEffect, useRef, useState } from "react";
import { FlipHorizontal2, Pause, Play, Repeat } from "lucide-react";
import { savePracticeAction } from "@/app/actions";
import { cn, fmtDuration } from "@/lib/utils";

type Section = { id: string; label: string; startSec: number; endSec: number };
type Loop = { a: number; b: number; label: string } | null;

export function Player({ serviceId, src, poster, sections, startAt }: { serviceId: string; src: string; poster?: string; sections: Section[]; startAt: number }) {
  const v = useRef<HTMLVideoElement>(null);
  const lastSaved = useRef(0);
  const loopRef = useRef<Loop>(null);
  const [playing, setPlaying] = useState(false);
  const [t, setT] = useState(0);
  const [dur, setDur] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [mirror, setMirror] = useState(false);
  const [done, setDone] = useState(false);
  const [loopMode, setLoopMode] = useState(false); // section taps loop that section
  const [loop, setLoopState] = useState<Loop>(null);
  const [markA, setMarkA] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const hlsResume = useRef(false); // hls.js handles the resume position itself
  const setLoop = (l: Loop) => { loopRef.current = l; setLoopState(l); };

  const save = (completed = false) => {
    const el = v.current;
    if (!el) return;
    lastSaved.current = el.currentTime;
    savePracticeAction(serviceId, el.currentTime, completed);
  };

  // HLS (Mux) streams: use hls.js wherever Media Source Extensions exist (Chrome, Edge, Firefox,
  // Safari, iOS 17.1+). Browser-native HLS is only a fallback: outside Safari it reports "maybe" but
  // breaks on the seeking, speed changes and looping this player does.
  useEffect(() => {
    const el = v.current;
    if (!el) return;
    setError(null);
    if (!src) return;
    if (!src.includes(".m3u8")) {
      el.src = src;
      return;
    }
    let hls: import("hls.js").default | null = null;
    let cancelled = false;
    import("hls.js").then(({ default: Hls }) => {
      if (cancelled) return;
      if (!Hls.isSupported()) {
        if (el.canPlayType("application/vnd.apple.mpegurl")) el.src = src;
        else setError("This browser can't play the video. Try Chrome, Safari or Firefox.");
        return;
      }
      hlsResume.current = true;
      hls = new Hls({ startPosition: startAt > 0 ? startAt : -1 });
      let retried = { network: false, media: false };
      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (!data.fatal || !hls) return;
        const code = data.response?.code;
        // Retry once for temporary failures on segments; access errors and a failed playlist won't fix themselves.
        const transient = !code || code >= 500;
        const playlist = /manifest/i.test(data.details);
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR && transient && !playlist && !retried.network) {
          retried = { ...retried, network: true };
          return hls.startLoad();
        }
        if (data.type === Hls.ErrorTypes.MEDIA_ERROR && !retried.media) {
          retried = { ...retried, media: true };
          return hls.recoverMediaError();
        }
        setError(
          code === 403 || code === 401
            ? "Your viewing link has expired. Reload to get a fresh one."
            : data.type === Hls.ErrorTypes.NETWORK_ERROR
              ? `Couldn't reach the video server${code ? ` (HTTP ${code})` : ""}. Check your connection and reload.`
              : `The video couldn't be played (${data.details}).`,
        );
      });
      hls.loadSource(src);
      hls.attachMedia(el);
    });
    return () => {
      cancelled = true;
      hls?.destroy();
    };
  }, [src, startAt]);

  useEffect(() => {
    const el = v.current;
    return () => { if (el && el.currentTime > 0) savePracticeAction(serviceId, el.currentTime, false); };
  }, [serviceId]);

  // Tight loop: check every animation frame (timeupdate only fires ~4x/second).
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const el = v.current;
      const l = loopRef.current;
      if (el && l && !el.paused && el.currentTime >= l.b) {
        el.currentTime = l.a;
        lastSaved.current = l.a; // a loop jump isn't progress worth saving
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const seek = (sec: number) => {
    if (!v.current) return;
    v.current.currentTime = sec;
    setT(sec);
  };
  const toggle = () => {
    const el = v.current;
    if (!el) return;
    if (el.paused) el.play().catch(() => {}); // play() rejects if the source can't load; the video shows its own error
    else el.pause();
  };
  const onSection = (s: Section) => {
    if (loopMode) setLoop({ a: s.startSec, b: s.endSec, label: s.label });
    seek(s.startSec);
    v.current?.play().catch(() => {});
  };
  const setA = () => { setMarkA(t); setLoop(null); };
  const setB = () => {
    if (markA === null || t <= markA + 0.3) return;
    setLoop({ a: markA, b: t, label: `${fmtDuration(Math.floor(markA))}–${fmtDuration(Math.floor(t))}` });
    seek(markA);
  };
  const clearLoop = () => { setLoop(null); setMarkA(null); };
  const pct = (x: number) => (dur ? `${(x / dur) * 100}%` : "0%");

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-lg border bg-black">
        {(error || !src) && (
          <div role="alert" className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-black/85 p-4 text-center text-sm">
            <p>{src ? error : "No video for this lesson yet."}</p>
            {src && (
              <button onClick={() => location.reload()} className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground">
                Reload
              </button>
            )}
          </div>
        )}
        <video
          ref={v}
          poster={poster}
          playsInline
          preload="metadata"
          onClick={toggle}
          className="aspect-video w-full transition-transform"
          style={{ transform: mirror ? "scaleX(-1)" : undefined }}
          onLoadedMetadata={(e) => {
            const el = e.currentTarget;
            setDur(el.duration);
            el.playbackRate = speed;
            if (!hlsResume.current && startAt > 0 && startAt < el.duration - 1) el.currentTime = startAt;
          }}
          onTimeUpdate={(e) => {
            const now = e.currentTarget.currentTime;
            setT(now);
            if (Math.abs(now - lastSaved.current) >= 10) save();
          }}
          onError={(e) => {
            // hls.js reports its own errors; this covers MP4 links and native HLS.
            const err = e.currentTarget.error;
            if (err && !hlsResume.current) setError(`The video couldn't load (${["", "aborted", "network error", "unsupported format", "source not supported"][err.code] ?? `code ${err.code}`}).`);
          }}
          onPlay={() => setPlaying(true)}
          onPause={() => { setPlaying(false); save(); }}
          onEnded={(e) => {
            const l = loopRef.current;
            if (l) { e.currentTarget.currentTime = l.a; e.currentTarget.play().catch(() => {}); return; } // loop reaching the very end
            setDone(true);
            save(true);
          }}
        />
      </div>

      <div className="flex items-center gap-3">
        <button onClick={toggle} aria-label={playing ? "Pause" : "Play"} className="grid size-11 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
          {playing ? <Pause className="size-5" /> : <Play className="size-5" />}
        </button>
        <div className="relative min-w-0 flex-1">
          {loop && (
            <span className="pointer-events-none absolute -bottom-1.5 h-1 rounded bg-primary" style={{ left: pct(loop.a), width: pct(loop.b - loop.a) }} aria-hidden />
          )}
          {markA !== null && !loop && (
            <span className="pointer-events-none absolute -bottom-2 h-2 w-0.5 bg-primary" style={{ left: pct(markA) }} aria-hidden />
          )}
          <input type="range" min={0} max={dur || 0} step={0.1} value={t} onChange={(e) => seek(Number(e.target.value))} className="relative w-full" aria-label="Scrub" />
        </div>
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

      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-2">
        <Repeat className="size-4 text-primary" aria-hidden />
        <button onClick={setA} className={cn("h-8 rounded-md border px-2.5 text-xs", markA !== null && !loop ? "border-primary text-primary" : "text-muted-foreground")}>
          Set A
        </button>
        <button onClick={setB} disabled={markA === null} className="h-8 rounded-md border px-2.5 text-xs text-muted-foreground disabled:opacity-40">
          Set B
        </button>
        <span className="min-w-0 flex-1 truncate text-xs">
          {loop ? <span className="text-primary">Looping {loop.label}</span> : markA !== null ? "Play to the end point, then Set B" : "Loop any part"}
        </span>
        {(loop || markA !== null) && (
          <button onClick={clearLoop} className="h-8 rounded-md px-2 text-xs text-muted-foreground hover:text-foreground">Clear</button>
        )}
      </div>

      {sections.length > 0 && (
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input type="checkbox" checked={loopMode} onChange={(e) => { setLoopMode(e.target.checked); if (!e.target.checked) clearLoop(); }} className="size-4 accent-[var(--primary)]" />
            Loop the section I tap
          </label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {sections.map((s) => {
              const looping = loop?.a === s.startSec && loop?.b === s.endSec;
              const active = looping || (t >= s.startSec && t < s.endSec);
              return (
                <button key={s.id} onClick={() => onSection(s)} className={cn("rounded-md border p-2 text-left text-sm", active ? "border-primary text-primary" : "bg-card")}>
                  <span className="flex items-center gap-1 truncate font-medium">{looping && <Repeat className="size-3.5 shrink-0" />}{s.label}</span>
                  <span className="text-xs text-muted-foreground">{fmtDuration(s.startSec)}–{fmtDuration(s.endSec)}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
      {done && <p className="text-center text-sm text-emerald-400">Marked complete. Nice work.</p>}
    </div>
  );
}
