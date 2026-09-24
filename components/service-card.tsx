import Link from "next/link";
import { BadgeCheck, Lock, Star } from "lucide-react";
import type { Service, TeacherProfile, User } from "@prisma/client";
import { cn, fmtDuration, parseStyles, rupees } from "@/lib/utils";

export type CardService = Service & { teacher: TeacherProfile & { user: Pick<User, "name"> } };

export function priceLabel(s: Service) {
  if (s.isFree || s.type === "DEMO") return "Free";
  const parts = [];
  if (s.pricePaise > 0) parts.push(rupees(s.pricePaise));
  if (s.includedInSub) parts.push("in course");
  return parts.join(" · ");
}

export function Thumb({ s, className, locked }: { s: Pick<Service, "thumbnailUrl" | "durationSec">; className?: string; locked?: boolean }) {
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

/** Lesson card: picture, title, teacher, price. Nothing else. */
export function ServiceCard({ s, className }: { s: CardService; className?: string }) {
  const free = s.isFree || s.type === "DEMO";
  return (
    <Link href={`/s/${s.id}`} className={cn("group block", className)}>
      <Thumb s={s} locked={!free} className={cn(s.featured && "ring-1 ring-primary/70")} />
      <h3 className="mt-2 line-clamp-2 text-sm font-medium leading-snug group-hover:text-primary">
        {s.featured && <Star className="mr-1 inline size-3.5 fill-primary text-primary" aria-label="Featured" />}
        {s.title}
      </h3>
      <p className="mt-0.5 flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="flex min-w-0 items-center gap-1 truncate">
          {s.teacher.user.name}
          {s.teacher.verified && <BadgeCheck className="size-3.5 shrink-0 text-primary" aria-label="Verified" />}
        </span>
        <span className={cn("shrink-0", free ? "text-emerald-400" : "text-primary")}>{priceLabel(s)}</span>
      </p>
    </Link>
  );
}

export type CourseTeacher = TeacherProfile & {
  user: Pick<User, "name">;
  services: Pick<Service, "id" | "thumbnailUrl" | "durationSec">[];
};

/** A course = a teacher's subscription bundle in their style. */
export function CourseCard({ t, className }: { t: CourseTeacher; className?: string }) {
  const style = parseStyles(t.styles)[0] ?? "Dance";
  const first = t.user.name.split(" ")[0];
  const cover = t.services[0];
  return (
    <Link href={`/t/${t.handle}`} className={cn("group block", className)}>
      <div
        className={cn("relative aspect-video overflow-hidden rounded-md bg-cover bg-center", t.featured && "ring-1 ring-primary/70")}
        style={{ backgroundImage: `linear-gradient(to top, rgba(11,10,9,.9), rgba(11,10,9,.1)), url(${cover?.thumbnailUrl ?? ""}), linear-gradient(135deg, #3a2d0c, #0b0a09)` }}
      >
        <span className="absolute bottom-2 left-2 text-xs text-primary">{t.services.length} lessons</span>
      </div>
      <h3 className="mt-2 text-sm font-medium leading-snug group-hover:text-primary">
        {t.featured && <Star className="mr-1 inline size-3.5 fill-primary text-primary" aria-label="Featured" />}
        {style} with {first}
      </h3>
      <p className="mt-0.5 flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1 truncate">
          {t.user.name}
          {t.verified && <BadgeCheck className="size-3.5 shrink-0 text-primary" aria-label="Verified" />}
        </span>
        <span className="shrink-0 text-primary">{rupees(t.monthlyPricePaise)}/mo</span>
      </p>
    </Link>
  );
}
