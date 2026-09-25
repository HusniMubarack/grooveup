"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, Footprints, User } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/explore", label: "Explore", icon: Compass },
  { href: "/me", label: "My Floor", icon: Footprints },
  { href: "/me#profile", label: "Profile", icon: User },
];

/** Student bottom nav: phones only, hidden in /studio and /admin. */
export function MobileNav({ alert = false }: { alert?: boolean }) {
  const path = usePathname();
  // Hidden where it would cover the UI: admin/studio have their own nav, the player and an open chat need the full height.
  if (path.startsWith("/admin") || path.startsWith("/studio") || path.startsWith("/play") || /^\/me\/inbox\/./.test(path)) return null;
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-3 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      {items.map(({ href, label, icon: Icon }) => {
        const active = href === "/me#profile" ? false : href === "/me" ? path.startsWith("/me") : path === href;
        return (
          <Link key={label} href={href} className={cn("flex flex-col items-center gap-0.5 py-2 text-[11px]", active ? "text-primary" : "text-muted-foreground")}>
            <span className="relative">
              <Icon className="size-5" />
              {alert && href === "/me" && <span className="absolute -right-1 -top-0.5 size-2 rounded-full bg-primary" aria-label="New messages" />}
            </span>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
