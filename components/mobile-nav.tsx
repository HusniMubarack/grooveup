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
export function MobileNav() {
  const path = usePathname();
  if (path.startsWith("/admin") || path.startsWith("/studio") || path.startsWith("/play")) return null;
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-3 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      {items.map(({ href, label, icon: Icon }) => {
        const active = href === "/me#profile" ? false : path === href;
        return (
          <Link key={label} href={href} className={cn("flex flex-col items-center gap-0.5 py-2 text-[11px]", active ? "text-primary" : "text-muted-foreground")}>
            <Icon className="size-5" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
