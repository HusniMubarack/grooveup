"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Tiny runtime for the motion system in globals.css:
 * - browsers without scroll-driven animations get html.no-sda + an IntersectionObserver that adds .is-in
 * - desktop pointers get a card tilt (--rx/--ry on the hovered .tilt) from one passive listener
 */
export function Motion() {
  const path = usePathname();

  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches || CSS.supports("animation-timeline: view()")) return;
    document.documentElement.classList.add("no-sda");
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); } }),
      { rootMargin: "0px 0px -8% 0px" },
    );
    const els = () => document.querySelectorAll(".step-in:not(.is-in), .kinetic:not(.is-in)");
    els().forEach((el) => io.observe(el));
    // A fast fling or jump can pass over items without them ever intersecting: reveal everything above the fold line.
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => els().forEach((el) => { if (el.getBoundingClientRect().top < innerHeight) el.classList.add("is-in"); }));
    };
    addEventListener("scroll", onScroll, { passive: true });
    return () => { io.disconnect(); removeEventListener("scroll", onScroll); cancelAnimationFrame(raf); };
  }, [path]);

  useEffect(() => {
    if (!matchMedia("(hover: hover) and (pointer: fine)").matches || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let current: HTMLElement | null = null;
    let raf = 0;
    const onMove = (e: PointerEvent) => {
      const el = (e.target as Element).closest?.(".tilt") as HTMLElement | null;
      if (current && current !== el) { current.style.removeProperty("--rx"); current.style.removeProperty("--ry"); }
      current = el;
      if (!el) return;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
        el.style.setProperty("--ry", `${(x * 10).toFixed(2)}deg`);
        el.style.setProperty("--rx", `${(-y * 10).toFixed(2)}deg`);
      });
    };
    document.addEventListener("pointermove", onMove, { passive: true });
    return () => { document.removeEventListener("pointermove", onMove); cancelAnimationFrame(raf); };
  }, []);

  return null;
}
