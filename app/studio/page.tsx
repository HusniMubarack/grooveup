import Link from "next/link";
import { ChevronDown, Pencil, Plus, ShieldAlert } from "lucide-react";
import type { Service } from "@prisma/client";
import { togglePublishAction } from "@/app/actions";
import { ensureTeacherProfile, requireTeacher } from "@/lib/auth";
import { CATEGORIES, CATEGORY_KEYS, type CategoryKey, categoryOf } from "@/lib/categories";
import { db } from "@/lib/db";
import { syncMuxVideo } from "@/lib/mux";
import { fmtDuration, fmtUntil, rupees } from "@/lib/utils";
import { endAccessAction } from "@/app/request-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AdminTable } from "@/components/admin-table";
import { Placeholder } from "@/components/placeholder";
import { priceLabel, Thumb } from "@/components/service-card";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

type Access = "Bought" | "Subscribed" | "Free";
type Learner = { id: string; name: string; access: Access; progress: string };

export default async function Studio() {
  const user = await requireTeacher();
  const profile = await ensureTeacherProfile(user.id, user.name);
  const [rawServices, orders, subs, followers, purchases, practice] = await Promise.all([
    db.service.findMany({ where: { teacherId: profile.id }, orderBy: { createdAt: "desc" } }),
    db.order.findMany({ where: { teacherId: profile.id }, include: { service: { select: { type: true, durationSec: true } } } }),
    db.subscription.findMany({ where: { teacherId: profile.id }, include: { student: { select: { id: true, name: true } } }, orderBy: { currentPeriodEnd: "desc" } }),
    db.follow.count({ where: { teacherId: profile.id } }),
    db.entitlement.findMany({ where: { teacherId: profile.id, source: "PURCHASE" }, include: { user: { select: { id: true, name: true } } } }),
    db.practiceEvent.findMany({ where: { service: { teacherId: profile.id } }, include: { user: { select: { id: true, name: true } } } }),
  ]);
  // Pick up Mux uploads that finished processing since the last visit.
  const services = await Promise.all(rawServices.map((s) => syncMuxVideo(s)));
  const removed = services.filter((s) => s.unpublishedByAdmin);
  const isLive = (s: { status: string; currentPeriodEnd: Date | null }) => s.status === "ACTIVE" && (!s.currentPeriodEnd || s.currentPeriodEnd > new Date());
  const activeSubs = subs.filter(isLive);
  const earnings = orders.reduce((a, o) => a + o.amountPaise, 0);

  // Earnings by category: SERVICE orders by their lesson's category, SUBSCRIPTION orders are the course.
  const byCat = Object.fromEntries(CATEGORY_KEYS.map((k) => [k, { orders: 0, paise: 0, students: new Set<string>() }])) as Record<CategoryKey, { orders: number; paise: number; students: Set<string> }>;
  for (const o of orders) {
    const k: CategoryKey = o.type === "SUBSCRIPTION" || !o.service ? "courses" : categoryOf(o.service);
    byCat[k].orders++;
    byCat[k].paise += o.amountPaise;
    byCat[k].students.add(o.studentId);
  }

  // Who can take each lesson, and how far they got.
  const learnersFor = (s: Service): Learner[] => {
    const seen = new Map<string, Learner>();
    const progress = (uid: string) => {
      const p = practice.find((e) => e.userId === uid && e.serviceId === s.id);
      return !p ? "Not started" : p.completed ? "Completed" : `Resume at ${fmtDuration(p.lastSec)}`;
    };
    const add = (u: { id: string; name: string }, access: Access) => {
      if (!seen.has(u.id)) seen.set(u.id, { id: u.id, name: u.name, access, progress: progress(u.id) });
    };
    purchases.filter((e) => e.serviceId === s.id).forEach((e) => add(e.user, "Bought"));
    if (s.includedInSub) activeSubs.forEach((sub) => add(sub.student, "Subscribed"));
    practice.filter((e) => e.serviceId === s.id).forEach((e) => add(e.user, "Free"));
    return [...seen.values()];
  };
  const groups: [string, Service[]][] = [
    [CATEGORIES.moves.name, services.filter((s) => categoryOf(s) === "moves")],
    [CATEGORIES.choreo.name, services.filter((s) => categoryOf(s) === "choreo")],
    ["Course lessons", services.filter((s) => categoryOf(s) === "courses")],
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="font-serif text-3xl">Studio</h1>
          <Link href={`/t/${profile.handle}`} className="text-sm text-primary">grooveup/t/{profile.handle}</Link>
        </div>
        <Button asChild><Link href="/studio/new"><Plus /> New lesson</Link></Button>
      </div>

      {removed.map((s) => (
        <p key={s.id} className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm">
          <ShieldAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
          <span><strong>{s.title}</strong> — Removed by admin: {s.unpublishedReason}</span>
        </p>
      ))}

      <div className="grid grid-cols-3 gap-3">
        {[["Earnings (mock)", rupees(earnings)], ["Course subscribers", activeSubs.length], ["Followers", followers]].map(([k, v]) => (
          <Card key={k as string}><CardHeader className="p-3"><CardDescription className="text-xs">{k}</CardDescription><CardTitle className="text-xl text-primary">{v}</CardTitle></CardHeader></Card>
        ))}
      </div>

      <section className="space-y-2">
        <h2 className="text-sm uppercase tracking-wide text-muted-foreground">Earnings by category</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {CATEGORY_KEYS.map((k) => (
            <Card key={k}>
              <CardHeader className="p-3">
                <CardDescription className="text-xs">{k === "courses" ? "Course subscriptions" : CATEGORIES[k].name}</CardDescription>
                <CardTitle className="text-lg text-primary">{rupees(byCat[k].paise)}</CardTitle>
                <p className="text-xs text-muted-foreground">{plural(byCat[k].orders, "order")} · {plural(byCat[k].students.size, "student")}</p>
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm uppercase tracking-wide text-muted-foreground">
          Course subscribers · {activeSubs.length} active, {subs.length - activeSubs.length} ended
        </h2>
        <AdminTable
          rows={subs}
          empty="No subscribers yet. Share your profile link to get your first."
          columns={[
            { h: "Student", cell: (s) => s.student.name },
            { h: "Status", cell: (s) => <Badge variant={isLive(s) ? "outline" : "muted"}>{isLive(s) ? "active" : s.status === "ACTIVE" ? "expired" : "ended"}</Badge> },
            { h: "Access until", cell: (s) => (isLive(s) ? fmtUntil(s.currentPeriodEnd) : "—"), className: "whitespace-nowrap" },
            {
              h: "",
              cell: (s) =>
                isLive(s) ? (
                  <form action={endAccessAction}>
                    <input type="hidden" name="subId" value={s.id} />
                    <button className="h-7 rounded bg-secondary px-2 text-[11px] hover:bg-destructive hover:text-white">End access</button>
                  </form>
                ) : null,
            },
          ]}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm uppercase tracking-wide text-muted-foreground">Students by lesson</h2>
        {groups.map(([label, list]) =>
          list.length === 0 ? null : (
            <div key={label} className="space-y-2">
              <h3 className="text-sm font-semibold text-primary">{label}</h3>
              {list.map((s) => {
                const learners = learnersFor(s);
                return (
                  <details key={s.id} className="group rounded-lg border bg-card">
                    <summary className="flex cursor-pointer list-none items-center gap-2 p-3 text-sm">
                      <span className="min-w-0 flex-1 truncate">{s.title}</span>
                      <Badge variant="muted">{plural(learners.length, "student")}</Badge>
                      <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
                    </summary>
                    <ul className="divide-y border-t text-xs">
                      {learners.length === 0 && <li className="p-3 text-muted-foreground">No students yet.</li>}
                      {learners.map((l) => (
                        <li key={l.id} className="flex items-center gap-2 px-3 py-2">
                          <span className="min-w-0 flex-1 truncate">{l.name}</span>
                          <span className="text-muted-foreground">{l.access}</span>
                          <span className={l.progress === "Completed" ? "text-emerald-400" : "text-muted-foreground"}>{l.progress}</span>
                        </li>
                      ))}
                    </ul>
                  </details>
                );
              })}
            </div>
          ),
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm uppercase tracking-wide text-muted-foreground">Your lessons</h2>
        {services.length === 0 && <p className="text-sm text-muted-foreground">No lessons yet. Create your first one.</p>}
        {services.map((s) => (
          <div key={s.id} className="flex items-center gap-3 rounded-lg border bg-card p-2">
            <Link href={`/s/${s.id}`} className="w-24 shrink-0"><Thumb s={s} /></Link>
            <div className="min-w-0 flex-1">
              <Link href={`/s/${s.id}`} className="line-clamp-1 font-medium hover:text-primary">{s.title}</Link>
              <p className="text-xs text-muted-foreground">{categoryOf(s) === "courses" ? "Course lesson" : CATEGORIES[categoryOf(s)].name} · {priceLabel(s)}</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {s.unpublishedByAdmin ? <Badge variant="destructive">Removed by admin</Badge> : s.published ? <Badge variant="outline">Published</Badge> : <Badge variant="muted">Draft</Badge>}
                {s.muxUploadId && s.videoStatus !== "ready" && (
                  <Badge variant={s.videoStatus === "errored" ? "destructive" : "muted"}>{s.videoStatus === "errored" ? "Video failed" : "Video processing…"}</Badge>
                )}
              </div>
            </div>
            <div className="flex shrink-0 flex-col gap-1">
              <Button asChild size="sm" variant="outline"><Link href={`/studio/edit/${s.id}`}><Pencil /> Edit</Link></Button>
              <form action={togglePublishAction.bind(null, s.id)}>
                <Button size="sm" variant="secondary" className="w-full" disabled={s.unpublishedByAdmin} title={s.unpublishedByAdmin ? "Locked until an admin restores it" : undefined}>
                  {s.published ? "Unpublish" : "Publish"}
                </Button>
              </form>
            </div>
          </div>
        ))}
      </section>

      <Placeholder title="Live class calendar" action="Schedule a live class">
        Schedule a Google Meet or Zoom class in your timezone; students see it in theirs with a join window that opens 10
        minutes before. The recording is then turned into a Service automatically.
      </Placeholder>
    </div>
  );
}
