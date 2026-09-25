import Link from "next/link";
import { ArrowRight, BookOpen, Film, Zap } from "lucide-react";
import { publicServiceWhere } from "@/lib/access";
import { CATEGORIES, CATEGORY_KEYS, type CategoryKey, findCourses, liveIn } from "@/lib/categories";
import { db } from "@/lib/db";
import { cn } from "@/lib/utils";
import { CourseCard, ServiceCard } from "@/components/service-card";

const ICONS = { moves: Zap, choreo: Film, courses: BookOpen } as const;
const ROW = 6;

const lessonQuery = (cat: "moves" | "choreo", style?: string, take?: number) =>
  db.service.findMany({
    where: { AND: [liveIn(cat), style ? { style } : {}] },
    include: { teacher: { include: { user: { select: { name: true } } } } },
    orderBy: [{ featured: "desc" }, { teacher: { featured: "desc" } }, { createdAt: "desc" }],
    take,
  });

function Row({ children }: { children: React.ReactNode }) {
  return <div className="-mx-4 flex snap-x scroll-px-4 gap-3 overflow-x-auto px-4 pb-1 [&>*]:w-40 [&>*]:shrink-0 [&>*]:snap-start sm:[&>*]:w-52">{children}</div>;
}
function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-x-3 gap-y-5 md:grid-cols-3 lg:grid-cols-4">{children}</div>;
}

export default async function Explore({ searchParams }: { searchParams: Promise<{ cat?: string; style?: string }> }) {
  const sp = await searchParams;
  const cat = CATEGORY_KEYS.includes(sp.cat as CategoryKey) ? (sp.cat as CategoryKey) : undefined;

  return (
    <div className="space-y-6">
      <div className="grid gap-2 sm:grid-cols-3">
        {CATEGORY_KEYS.map((k) => {
          const Icon = ICONS[k];
          const active = cat === k;
          return (
            <Link
              key={k}
              href={active ? "/explore" : `/explore?cat=${k}`}
              className={cn(
                "flex items-center gap-3 rounded-xl border p-3 transition-colors sm:flex-col sm:items-start sm:p-4",
                active ? "border-primary bg-primary/15" : "bg-card hover:border-primary/60",
              )}
            >
              <span className={cn("grid size-10 shrink-0 place-items-center rounded-lg", active ? "bg-primary text-primary-foreground" : "bg-muted text-primary")}>
                <Icon className="size-5" />
              </span>
              <span>
                <span className="block font-semibold">{CATEGORIES[k].name}</span>
                <span className="block text-xs text-muted-foreground">{CATEGORIES[k].tagline}</span>
              </span>
            </Link>
          );
        })}
      </div>

      {cat ? <CategoryView cat={cat} style={sp.style} /> : <Overview />}
    </div>
  );
}

async function Overview() {
  const [moves, choreo, courses] = await Promise.all([lessonQuery("moves", undefined, ROW), lessonQuery("choreo", undefined, ROW), findCourses()]);
  const sections: [CategoryKey, React.ReactNode, number][] = [
    ["moves", moves.map((s) => <ServiceCard key={s.id} s={s} />), moves.length],
    ["choreo", choreo.map((s) => <ServiceCard key={s.id} s={s} />), choreo.length],
    ["courses", courses.slice(0, ROW).map((t) => <CourseCard key={t.id} t={t} />), courses.length],
  ];
  return (
    <>
      {sections.map(([k, cards, n]) => (
        <section key={k} className="space-y-2">
          <div className="flex items-end justify-between">
            <h2 className="font-serif text-xl">{CATEGORIES[k].name}</h2>
            <Link href={`/explore?cat=${k}`} className="flex items-center gap-1 text-sm text-primary">See all <ArrowRight className="size-3.5" /></Link>
          </div>
          {n === 0 ? <p className="text-sm text-muted-foreground">Nothing here yet.</p> : <Row>{cards}</Row>}
        </section>
      ))}
    </>
  );
}

async function CategoryView({ cat, style }: { cat: CategoryKey; style?: string }) {
  const styleRows = await db.service.findMany({ where: publicServiceWhere, select: { style: true }, distinct: ["style"] });
  const items =
    cat === "courses"
      ? (await findCourses(style)).map((t) => <CourseCard key={t.id} t={t} />)
      : (await lessonQuery(cat, style)).map((s) => <ServiceCard key={s.id} s={s} />);

  return (
    <section className="space-y-4">
      <div>
        <h1 className="font-serif text-2xl">{CATEGORIES[cat].name}</h1>
        <p className="text-sm text-muted-foreground">{CATEGORIES[cat].blurb}</p>
      </div>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4">
        {[undefined, ...styleRows.map((r) => r.style)].map((st) => (
          <Link
            key={st ?? "all"}
            href={`/explore?cat=${cat}${st ? `&style=${encodeURIComponent(st)}` : ""}`}
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
