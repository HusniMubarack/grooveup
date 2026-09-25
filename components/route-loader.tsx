"use client";

import { Suspense, useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { LoadingScreen } from "@/components/loading-screen";

/**
 * Shows the Groove up loader while an in-app link navigation is in flight.
 * (Next's loading.tsx would be the usual tool, but in Next 15 it stopped server-action
 * redirects and in-place refreshes, like Follow, from showing, so this listens to link clicks instead.)
 */
function Loader() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const [pending, setPending] = useState(false);
  const [visible, setVisible] = useState(false);

  // Navigation finished.
  useEffect(() => setPending(false), [pathname, search]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element).closest("a");
      if (!a || a.target || a.hasAttribute("download")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin) return;
      if (url.pathname === location.pathname && url.search === location.search) return; // same page / hash link
      setPending(true);
    };
    // Capture phase: Next's <Link> calls preventDefault during bubbling, before a bubble listener would see it.
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  // Only show for slow navigations, and never get stuck.
  useEffect(() => {
    if (!pending) return setVisible(false);
    const show = setTimeout(() => setVisible(true), 150);
    const giveUp = setTimeout(() => setPending(false), 10000);
    return () => { clearTimeout(show); clearTimeout(giveUp); };
  }, [pending]);

  if (!visible) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background/80 backdrop-blur-sm">
      <LoadingScreen />
    </div>
  );
}

export function RouteLoader() {
  return (
    <Suspense fallback={null}>
      <Loader />
    </Suspense>
  );
}
