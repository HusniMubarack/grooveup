import Link from "next/link";
import { BadgeCheck, Lock, Star } from "lucide-react";
import type { Service, TeacherProfile, User } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { cn, fmtDuration, rupees } from "@/lib/utils";

export type CardService = Service & { teacher: TeacherProfile & { user: Pick<User, "name"> } };

export function priceLabel(s: Service) {
  if (s.isFree || s.type === "DEMO") return "Free";
  const parts = [];
  if (s.pricePaise > 0) parts.push(rupees(s.pricePaise));
  if (s.includedInSub) parts.push("in sub");
  return parts.join(" · ");
}

export function Thumb({ s, className, locked }: { s: Service; className?: string; locked?: boolean }) {
  return (
    <div
      className={cn("relative aspect-video overflow-hidden rounded-md bg-cover bg-center", className)}
      style={{ backgroundImage: `url(${s.thumbnailUrl}), linear-gradient(135deg, #3a2d0c, #0b0a09)` }}
    >
      {locked && (
        <span className="absolute right-2 top-2 rounded-full bg-black/70 p-1.5 text-primary">
          <Lock className="size-3.5" />
        </span>
      )}
      <span className="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 text-[11px]">{fmtDuration(s.durationSec)}</span>
    </div>
  );
}

export function ServiceCard({ s }: { s: CardService }) {
  const free = s.isFree || s.type === "DEMO";
  return (
    <Link href={`/s/${s.id}`} className={cn("group block rounded-lg border bg-card p-2 transition-colors hover:border-primary/60", s.featured && "border-primary/50")}>
      <Thumb s={s} locked={!free} />
      <div className="space-y-1 p-1 pt-2">
        <div className="flex flex-wrap gap-1">
          {s.featured && <Badge><Star /> Featured</Badge>}
          <Badge variant="muted">{s.type}</Badge>
          <Badge variant="muted">{s.level}</Badge>
        </div>
        <h3 className="line-clamp-2 font-medium leading-snug group-hover:text-primary">{s.title}</h3>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            {s.teacher.user.name}
            {s.teacher.verified && <BadgeCheck className="size-3.5 text-primary" aria-label="Verified" />}
          </span>
          <span className={cn(free ? "text-emerald-400" : "text-primary")}>{priceLabel(s)}</span>
        </div>
      </div>
    </Link>
  );
}
