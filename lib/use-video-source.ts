"use client";

import { useEffect, type RefObject } from "react";

/** Attach a source to a <video>: MP4 directly, HLS (.m3u8) through hls.js where supported, else natively. */
export function useVideoSource(ref: RefObject<HTMLVideoElement | null>, src: string | null | undefined) {
  useEffect(() => {
    const el = ref.current;
    if (!el || !src) return;
    if (!src.includes(".m3u8")) {
      el.src = src;
      return () => { el.removeAttribute("src"); el.load(); };
    }
    let destroy = () => {};
    let cancelled = false;
    import("hls.js").then(({ default: Hls }) => {
      if (cancelled) return;
      if (Hls.isSupported()) {
        const hls = new Hls();
        hls.loadSource(src);
        hls.attachMedia(el);
        destroy = () => hls.destroy();
      } else {
        el.src = src;
      }
    });
    return () => { cancelled = true; destroy(); };
  }, [ref, src]);
}
