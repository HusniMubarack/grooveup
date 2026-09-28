"use client";

import { useEffect, useRef, useState } from "react";
import { Cast, FlipHorizontal2, Maximize, Minimize, Pause, Play, Repeat } from "lucide-react";
import { castMethod, castTo, isSafari, loadCastSdk, type CastSession } from "@/lib/cast";
import { savePracticeAction } from "@/app/actions";
import { cn, fmtDuration } from "@/lib/utils";

type Section = { id: string; label: string; startSec: number; endSec: number };
type Loop = { a: number; b: number; label: string } | null;

const GAPS = [0, 1, 2, 3, 5, 10];
const GAP_KEY = "grooveup-loop-gap";

export function Player({ serviceId, src, poster, sections, startAt, title = "Groove up lesson" }: {
  serviceId: string; src: string; poster?: string; sections: Section[]; startAt: number; title?: string;
}) {
  const v = useRef<HTMLVideoElement>(null);
  const root = useRef<HTMLDivElement>(null);
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
  const setLoop = (l: Loop) => { loopRef.current = l; setLoopState(l); if (!l) stopCountdown(); };

  // Pause between loop repeats (seconds), shown as a countdown on the video.
  const [gap, setGapState] = useState(3);
  const gapRef = useRef(3);
  const [countdown, setCountdown] = useState<number | null>(null);
  const counting = useRef(false);
  const countTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const setGap = (g: number) => {
    gapRef.current = g;
    setGapState(g);
    try { localStorage.setItem(GAP_KEY, String(g)); } catch { /* private mode */ }
  };
  useEffect(() => {
    try {
      const g = Number(localStorage.getItem(GAP_KEY));
      if (GAPS.includes(g) && localStorage.getItem(GAP_KEY) !== null) { gapRef.current = g; setGapState(g); }
    } catch { /* private mode */ }
  }, []);
  function stopCountdown() {
    if (countTimer.current) clearInterval(countTimer.current);
    countTimer.current = null;
    counting.current = false;
    setCountdown(null);
  }
  /** Loop end reached: jump back to A, then wait `gap` seconds (with a countdown) before playing again. */
  const loopBack = (el: HTMLVideoElement, l: NonNullable<Loop>) => {
    lastSaved.current = l.a; // a loop jump isn't progress worth saving
    if (gapRef.current <= 0) {
      el.currentTime = l.a;
      if (el.paused) el.play().catch(() => {});
      return;
    }
    counting.current = true;
    el.pause();
    el.currentTime = l.a;
    let n = gapRef.current;
    setCountdown(n);
    countTimer.current = setInterval(() => {
      n -= 1;
      if (n <= 0) {
        stopCountdown();
        el.play().catch(() => {});
      } else setCountdown(n);
    }, 1000);
  };
  const skipCountdown = () => {
    if (!counting.current) return;
    stopCountdown();
    v.current?.play().catch(() => {});
  };
  useEffect(() => () => { if (countTimer.current) clearInterval(countTimer.current); }, []);

  // Full screen: the whole player (video + controls), so loops and sections stay usable.
  const [fullscreen, setFullscreen] = useState(false);
  useEffect(() => {
    const on = () => setFullscreen(document.fullscreenElement === root.current);
    document.addEventListener("fullscreenchange", on);
    return () => document.removeEventListener("fullscreenchange", on);
  }, []);
  const toggleFullscreen = () => {
    const el = root.current;
    const video = v.current as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else if (el?.requestFullscreen) el.requestFullscreen().catch(() => video?.webkitEnterFullscreen?.());
    else video?.webkitEnterFullscreen?.(); // iPhone: only the video element can go full screen
  };

  // Cast to a TV (Chromecast via the Cast SDK, AirPlay on Safari, Remote Playback elsewhere).
  const [castSdk, setCastSdk] = useState(false);
  const [castAvail, setCastAvail] = useState<ReturnType<typeof castMethod>>(null);
  const [casting, setCasting] = useState<CastSession | null>(null);
  useEffect(() => {
    let alive = true;
    loadCastSdk().then((ok) => { if (alive) { setCastSdk(ok); setCastAvail(castMethod(v.current, ok)); } });
    return () => { alive = false; };
  }, []);
  const startCast = async () => {
    const el = v.current;
    const method = castMethod(el, castSdk);
    if (!el || !method) return;
    if (method === "airplay") return (el as unknown as { webkitShowPlaybackTargetPicker: () => void }).webkitShowPlaybackTargetPicker();
    if (method === "remote") return (el as unknown as { remote: { prompt: () => Promise<void> } }).remote.prompt().catch(() => {});
    const session = await castTo({ src, title, poster, currentTime: el.currentTime });
    if (session) { el.pause(); setCasting(session); }
  };

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
    // Safari's own HLS is solid there and is what AirPlay needs.
    if (isSafari() && el.canPlayType("application/vnd.apple.mpegurl")) {
      el.src = src;
      return;
    }
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
      if (el && l && !el.paused && !counting.current && el.currentTime >= l.b) loopBack(el, l);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const seek = (sec: number) => {
    if (!v.current) return;
    if (counting.current) stopCountdown();
    v.current.currentTime = sec;
    setT(sec);
    casting?.seek(sec);
  };
  const toggle = () => {
    const el = v.current;
    if (!el) return;
    if (casting) return casting.playOrPause();
    if (counting.current) return skipCountdown();
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
    <div ref={root} className={cn("space-y-3", fullscreen && "flex h-full flex-col overflow-y-auto bg-background p-3")}>
      <div className={cn("relative overflow-hidden rounded-lg border bg-black", fullscreen && "flex min-h-0 flex-1 items-center")}>
        {countdown !== null && (
          <button
            onClick={skipCountdown}
            aria-label={`Loop restarts in ${countdown}. Tap to start now`}
            className="absolute inset-0 z-10 grid place-items-center bg-black/40"
          >
            <span className="grid size-24 place-items-center rounded-full border-4 border-primary bg-black/70 font-serif text-5xl tabular-nums text-primary" data-testid="loop-countdown">
              {countdown}
            </span>
          </button>
        )}
        {casting && (
          <div className="absolute inset-x-0 top-0 z-20 flex items-center gap-2 bg-black/80 px-3 py-2 text-xs">
            <Cast className="size-4 text-primary" /> Playing on {casting.device}
            <span className="text-muted-foreground">· mirror, speed and loops stay on this device</span>
            <button onClick={() => { casting.stop(); setCasting(null); }} className="ml-auto rounded bg-secondary px-2 py-1">Stop casting</button>
          </div>
        )}
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
          className={cn("w-full transition-transform", fullscreen ? "h-full object-contain" : "aspect-video")}
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
          onPause={() => { setPlaying(false); if (!counting.current) save(); }}
          onEnded={(e) => {
            const l = loopRef.current;
            if (l) return loopBack(e.currentTarget, l); // loop reaching the very end
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
        {castAvail && (
          <button onClick={startCast} aria-label="Cast to TV" title="Cast to TV" className={cn("grid size-9 place-items-center rounded-md border", casting ? "border-primary text-primary" : "text-muted-foreground")}>
            <Cast className="size-4" />
          </button>
        )}
        <button onClick={toggleFullscreen} aria-label={fullscreen ? "Exit full screen" : "Full screen"} title={fullscreen ? "Exit full screen" : "Full screen"} className="grid size-9 place-items-center rounded-md border text-muted-foreground">
          {fullscreen ? <Minimize className="size-4" /> : <Maximize className="size-4" />}
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
        <label className="flex w-full items-center gap-1.5 text-xs text-muted-foreground sm:w-auto">
          Pause between repeats
          <select value={gap} onChange={(e) => setGap(Number(e.target.value))} aria-label="Pause between loop repeats" className="h-8 rounded-md border border-input bg-muted/40 px-1.5 text-xs text-foreground">
            {GAPS.map((g) => <option key={g} value={g}>{g === 0 ? "none" : `${g} s`}</option>)}
          </select>
        </label>
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
