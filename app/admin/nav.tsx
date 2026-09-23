"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const links = [
  ["/admin", "Overview"],
  ["/admin/users", "Users"],
  ["/admin/services", "Services"],
  ["/admin/commerce", "Commerce"],
  ["/admin/reports", "Reports"],
];

export function AdminNav() {
  const path = usePathname();
  return (
    <nav className="-mx-4 flex gap-1 overflow-x-auto px-4 md:mx-0 md:px-0">
      {links.map(([href, label]) => (
        <Link key={href} href={href} className={cn("shrink-0 rounded-md px-3 py-1.5 text-sm", path === href ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}>
          {label}
        </Link>
      ))}
    </nav>
  );
}
