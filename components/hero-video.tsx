"use client";

import { useEffect, useRef, useState } from "react";

type Conn = { saveData?: boolean; effectiveType?: string };

/**
 * Background dance clip for the landing hero. Never part of the first paint: the source is attached
 * only once the page is idle, and skipped for reduced motion, data-saver or 2G/3G connections. Until it
 * plays (or if the file is missing) the animated dancer silhouette underneath is what people see.
 */
export function HeroVideo({ src, className }: { src: string; className?: string }) {
  const v = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const el = v.current;
    if (!el || !src) return;
    const conn = (navigator as Navigator & { connection?: Conn }).connection;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches || conn?.saveData || /(^|-)2g|3g/.test(conn?.effectiveType ?? "")) return;
    const start = () => {
      el.src = src;
      el.play().catch(() => {});
    };
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };
    if (w.requestIdleCallback) {
      const id = w.requestIdleCallback(start, { timeout: 2500 });
      return () => w.cancelIdleCallback?.(id);
    }
    const t = setTimeout(start, 1200);
    return () => clearTimeout(t);
  }, [src]);

  return (
    <video
      ref={v}
      muted
      loop
      playsInline
      preload="none"
      aria-hidden
      tabIndex={-1}
      onPlaying={() => setPlaying(true)}
      onError={() => setPlaying(false)}
      // Plain strings (no cn/tailwind-merge) keep this client component tiny.
      className={`pointer-events-none absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ${playing ? "opacity-55" : "opacity-0"} ${className ?? ""}`}
    />
  );
}
