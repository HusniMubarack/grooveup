import Link from "next/link";
import { ArrowRight, BookOpen, Film, Zap } from "lucide-react";
import { publicServiceWhere } from "@/lib/access";
import { CATEGORIES, CATEGORY_KEYS, type CategoryKey, findCourses, liveIn } from "@/lib/categories";
import { db } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { feedStyles } from "@/lib/prefs";
import { cn } from "@/lib/utils";
import { CourseCard, ServiceCard } from "@/components/service-card";
import { Dancer } from "@/components/dancer";

const ICONS = { moves: Zap, choreo: Film, courses: BookOpen } as const;
const ROW = 6;

const lessonQuery = (cat: "moves" | "choreo", style?: string, take?: number, only?: string[] | null) =>
  db.service.findMany({
    where: { AND: [liveIn(cat), style ? { style } : {}, only?.length ? { style: { in: only } } : {}] },
    include: { teacher: { include: { user: { select: { name: true } } } } },
    orderBy: [{ featured: "desc" }, { teacher: { featured: "desc" } }, { createdAt: "desc" }],
    take,
  });

/** Wraps each card so it "steps in" (see .step-in in globals.css), staggered by position. */
const stepIn = (nodes: React.ReactNode[]) =>
  nodes.map((n, i) => <div key={i} className="step-in" style={{ "--i": i } as React.CSSProperties}>{n}</div>);

function Row({ children }: { children: React.ReactNode[] }) {
  return (
    <div className="lean -mx-4 flex snap-x scroll-px-4 gap-3 overflow-x-auto px-4 pb-2 [&>*]:w-40 [&>*]:shrink-0 [&>*]:snap-start sm:[&>*]:w-52">
      {stepIn(children)}
    </div>
  );
}
function Grid({ children }: { children: React.ReactNode[] }) {
  // overflow-x-clip: cards stepping in from the side must never widen the page.
  return <div className="grid grid-cols-2 gap-x-3 gap-y-5 overflow-x-clip md:grid-cols-3 lg:grid-cols-4">{stepIn(children)}</div>;
}

export default async function Explore({ searchParams }: { searchParams: Promise<{ cat?: string; style?: string; all?: string }> }) {
  const sp = await searchParams;
  const cat = CATEGORY_KEYS.includes(sp.cat as CategoryKey) ? (sp.cat as CategoryKey) : undefined;
  const user = await currentUser();
  const showAll = sp.all === "1";
  // A student's feed shows only the styles they picked at onboarding (unless they ask for everything).
  const only = await feedStyles(user, showAll);
  const mine = showAll ? await feedStyles(user) : only;
  const keep = (extra: Record<string, string | undefined>) => {
    const p = new URLSearchParams(Object.entries({ cat, style: sp.style, all: showAll ? "1" : undefined, ...extra }).filter(([, v]) => v) as [string, string][]);
    return `/explore${p.size ? `?${p}` : ""}`;
  };

  return (
    <div className="space-y-7">
      <div className="beat-bar" aria-hidden />
      <header className="relative flex items-end justify-between gap-3 overflow-hidden pt-2">
        <div>
          <p className="rise text-[11px] uppercase tracking-[0.3em] text-primary">{user ? `Hey ${user.name.split(" ")[0]}` : "Groove up"}</p>
          <h1 className="rise-t font-serif text-5xl leading-none tracking-tight sm:text-6xl">Explore</h1>
        </div>
        <Dancer size={44} className="-mb-1 shrink-0 opacity-90" />
      </header>

      <div className="grid gap-2.5 sm:grid-cols-3">
        {CATEGORY_KEYS.map((k, i) => {
          const Icon = ICONS[k];
          const active = cat === k;
          return (
            <Link
              key={k}
              href={active ? "/explore" : `/explore?cat=${k}`}
              style={{ "--d": i + 1 } as React.CSSProperties}
              className={cn(
                `rise tilt motif motif-${k} group relative flex items-center gap-3 overflow-hidden rounded-2xl border p-4 sm:min-h-36 sm:flex-col sm:items-start sm:justify-end`,
                active ? "border-primary bg-primary/15" : "bg-card hover:border-primary/60",
              )}
            >
              <span className="motif-art" aria-hidden />
              <span className={cn("relative grid size-11 shrink-0 place-items-center rounded-xl", active ? "bg-primary text-primary-foreground" : "bg-muted text-primary")}>
                <Icon className="size-5" />
              </span>
              <span className="relative">
                <span className="block text-lg font-semibold leading-tight">{CATEGORIES[k].name}</span>
                <span className="block text-xs text-muted-foreground">{CATEGORIES[k].tagline}</span>
              </span>
            </Link>
          );
        })}
      </div>

      {mine && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-muted-foreground">Your feed:</span>
          {(showAll ? ["All styles"] : mine).map((st) => (
            <span key={st} className="rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-primary">{st}</span>
          ))}
          <Link href="/welcome" className="rounded-full border px-2.5 py-1 text-muted-foreground hover:text-foreground">Edit</Link>
          <Link href={keep({ all: showAll ? undefined : "1", style: undefined })} className="rounded-full border px-2.5 py-1 text-muted-foreground hover:text-foreground">
            {showAll ? "Only my styles" : "Show all styles"}
          </Link>
        </div>
      )}
      {!mine && user && (user.role === "STUDENT" || user.role === "BOTH") && (
        <Link href="/welcome" className="block rounded-lg border border-primary/40 bg-primary/10 p-3 text-sm">
          <b>Tell us what you dance</b>: we&apos;ll tailor this feed to your styles →
        </Link>
      )}

      {cat ? <CategoryView cat={cat} style={sp.style} only={only} keep={keep} /> : <Overview only={only} />}
    </div>
  );
}

async function Overview({ only }: { only: string[] | null }) {
  const [moves, choreo, courses] = await Promise.all([
    lessonQuery("moves", undefined, ROW, only),
    lessonQuery("choreo", undefined, ROW, only),
    findCourses(undefined, only),
  ]);
  const sections: [CategoryKey, React.ReactNode[], number][] = [
    ["moves", moves.map((s) => <ServiceCard key={s.id} s={s} />), moves.length],
    ["choreo", choreo.map((s) => <ServiceCard key={s.id} s={s} />), choreo.length],
    ["courses", courses.slice(0, ROW).map((t) => <CourseCard key={t.id} t={t} />), courses.length],
  ];
  return (
    <>
      {sections.map(([k, cards, n]) => (
        <section key={k} className="space-y-2">
          <div className="flex items-end justify-between">
            <h2 className="kinetic font-serif text-2xl">{CATEGORIES[k].name}</h2>
            <Link href={`/explore?cat=${k}`} className="flex items-center gap-1 text-sm text-primary">See all <ArrowRight className="size-3.5" /></Link>
          </div>
          {n === 0 ? <p className="text-sm text-muted-foreground">Nothing here yet.</p> : <Row>{cards}</Row>}
        </section>
      ))}
    </>
  );
}

async function CategoryView({ cat, style, only, keep }: { cat: CategoryKey; style?: string; only: string[] | null; keep: (extra: Record<string, string | undefined>) => string }) {
  const styleRows = await db.service.findMany({
    where: { AND: [publicServiceWhere, only?.length ? { style: { in: only } } : {}] },
    select: { style: true },
    distinct: ["style"],
  });
  const items =
    cat === "courses"
      ? (await findCourses(style, only)).map((t) => <CourseCard key={t.id} t={t} />)
      : (await lessonQuery(cat, style, undefined, only)).map((s) => <ServiceCard key={s.id} s={s} />);

  return (
    <section className="space-y-4">
      <div>
        <h2 className="kinetic font-serif text-3xl">{CATEGORIES[cat].name}</h2>
        <p className="text-sm text-muted-foreground">{CATEGORIES[cat].blurb}</p>
      </div>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4">
        {[undefined, ...styleRows.map((r) => r.style)].map((st) => (
          <Link
            key={st ?? "all"}
            href={keep({ style: st })}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1 text-xs",
              style === st ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground hover:border-primary/60",
            )}
          >
            {st ?? "All styles"}
          </Link>
        ))}
      </div>
      {items.length === 0 ? <p className="py-10 text-center text-muted-foreground">Nothing in this style yet.</p> : <Grid>{items}</Grid>}
    </section>
  );
}
