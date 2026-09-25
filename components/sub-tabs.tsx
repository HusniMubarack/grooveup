"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export type Tab = { href: string; label: string; badge?: number; exact?: boolean };

/** Section tabs (Studio: Overview · Requests · Inbox, My Floor: Practice · Requests · Inbox). */
export function SubTabs({ tabs }: { tabs: Tab[] }) {
  const path = usePathname();
  return (
    <nav className="-mx-4 flex gap-1 overflow-x-auto border-b px-4 md:mx-0 md:px-0">
      {tabs.map((t) => {
        const active = t.exact ? path === t.href : path === t.href || path.startsWith(t.href + "/");
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              "-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-sm",
              active ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
            {!!t.badge && (
              <span className="min-w-5 rounded-full bg-primary px-1.5 text-center text-[11px] font-semibold leading-5 text-primary-foreground">{t.badge}</span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
