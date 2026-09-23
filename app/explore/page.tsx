import Link from "next/link";
import { BadgeCheck } from "lucide-react";
import type { Level, Prisma } from "@prisma/client";
import { publicServiceWhere } from "@/lib/access";
import { db } from "@/lib/db";
import { cn, LEVELS, parseStyles } from "@/lib/utils";
import { ServiceCard } from "@/components/service-card";

type SP = { style?: string; level?: string; price?: string };

function Chip({ sp, k, v, label }: { sp: SP; k: keyof SP; v?: string; label: string }) {
  const active = sp[k] === v;
  const next = new URLSearchParams(Object.entries({ ...sp, [k]: active ? undefined : v }).filter(([, x]) => x) as [string, string][]);
  return (
    <Link
      href={`/explore?${next}`}
      className={cn(
        "shrink-0 rounded-full border px-3 py-1 text-xs capitalize",
        active ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground hover:border-primary/60",
      )}
    >
      {label}
    </Link>
  );
}

export default async function Explore({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const where: Prisma.ServiceWhereInput = { ...publicServiceWhere };
  if (sp.style) where.style = sp.style;
  if (sp.level && LEVELS.includes(sp.level as Level)) where.level = sp.level as Level;
  if (sp.price === "free") where.OR = [{ isFree: true }, { type: "DEMO" }];
  if (sp.price === "paid") Object.assign(where, { isFree: false, pricePaise: { gt: 0 }, NOT: { type: "DEMO" } });
  if (sp.price === "sub") where.includedInSub = true;

  const [services, styles, teachers] = await Promise.all([
    db.service.findMany({
      where,
      include: { teacher: { include: { user: true } } },
      // Featured services pinned to the top, then featured teachers.
      orderBy: [{ featured: "desc" }, { teacher: { featured: "desc" } }, { createdAt: "desc" }],
    }),
    db.service.findMany({ where: publicServiceWhere, select: { style: true }, distinct: ["style"] }),
    db.teacherProfile.findMany({
      where: { user: { banned: false } },
      include: { user: true },
      orderBy: [{ featured: "desc" }, { verified: "desc" }],
    }),
  ]);

  return (
    <div className="space-y-5">
      <h1 className="font-serif text-3xl">Explore</h1>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {teachers.map((t) => (
          <Link
            key={t.id}
            href={`/t/${t.handle}`}
            className={cn(
              "flex shrink-0 items-center gap-1 rounded-lg border px-3 py-2 text-sm",
              t.featured ? "border-primary bg-primary/10" : "bg-card",
            )}
          >
            {t.featured && <span className="text-primary">★</span>}
            {t.user.name}
            {t.verified && <BadgeCheck className="size-3.5 text-primary" />}
            <span className="text-xs text-muted-foreground">· {parseStyles(t.styles)[0]}</span>
          </Link>
        ))}
      </div>

      <div className="space-y-2">
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4">
          {styles.map(({ style }) => <Chip key={style} sp={sp} k="style" v={style} label={style} />)}
        </div>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4">
          {LEVELS.map((l) => <Chip key={l} sp={sp} k="level" v={l} label={l.toLowerCase()} />)}
          <span className="w-px shrink-0 bg-border" />
          <Chip sp={sp} k="price" v="free" label="Free" />
          <Chip sp={sp} k="price" v="paid" label="Paid" />
          <Chip sp={sp} k="price" v="sub" label="Sub" />
        </div>
      </div>

      {services.length === 0 ? (
        <p className="py-10 text-center text-muted-foreground">Nothing matches those filters yet.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {services.map((s) => <ServiceCard key={s.id} s={s} />)}
        </div>
      )}
    </div>
  );
}
