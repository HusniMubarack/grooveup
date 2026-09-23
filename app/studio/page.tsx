import Link from "next/link";
import { Plus, ShieldAlert } from "lucide-react";
import { togglePublishAction } from "@/app/actions";
import { ensureTeacherProfile, requireTeacher } from "@/lib/auth";
import { db } from "@/lib/db";
import { rupees } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Placeholder } from "@/components/placeholder";
import { priceLabel, Thumb } from "@/components/service-card";

export default async function Studio() {
  const user = await requireTeacher();
  const profile = await ensureTeacherProfile(user.id, user.name);
  const [services, earnings, subs, followers] = await Promise.all([
    db.service.findMany({ where: { teacherId: profile.id }, orderBy: { createdAt: "desc" } }),
    db.order.aggregate({ where: { teacherId: profile.id }, _sum: { amountPaise: true } }),
    db.subscription.count({ where: { teacherId: profile.id, status: "ACTIVE" } }),
    db.follow.count({ where: { teacherId: profile.id } }),
  ]);
  const removed = services.filter((s) => s.unpublishedByAdmin);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="font-serif text-3xl">Studio</h1>
          <Link href={`/t/${profile.handle}`} className="text-sm text-primary">atelier/t/{profile.handle}</Link>
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
        {[["Earnings (mock)", rupees(earnings._sum.amountPaise ?? 0)], ["Active subs", subs], ["Followers", followers]].map(([k, v]) => (
          <Card key={k as string}><CardHeader className="p-3"><CardDescription className="text-xs">{k}</CardDescription><CardTitle className="text-xl text-primary">{v}</CardTitle></CardHeader></Card>
        ))}
      </div>

      <section className="space-y-2">
        <h2 className="text-sm uppercase tracking-wide text-muted-foreground">Your lessons</h2>
        {services.length === 0 && <p className="text-sm text-muted-foreground">No lessons yet. Create your first one.</p>}
        {services.map((s) => (
          <div key={s.id} className="flex items-center gap-3 rounded-lg border bg-card p-2">
            <Link href={`/s/${s.id}`} className="w-24 shrink-0"><Thumb s={s} /></Link>
            <div className="min-w-0 flex-1">
              <Link href={`/s/${s.id}`} className="line-clamp-1 font-medium hover:text-primary">{s.title}</Link>
              <p className="text-xs text-muted-foreground">{s.type} · {s.level} · {priceLabel(s)}</p>
              <div className="mt-1">
                {s.unpublishedByAdmin ? <Badge variant="destructive">Removed by admin</Badge> : s.published ? <Badge variant="outline">Published</Badge> : <Badge variant="muted">Draft</Badge>}
              </div>
            </div>
            <form action={togglePublishAction.bind(null, s.id)}>
              <Button size="sm" variant="secondary" disabled={s.unpublishedByAdmin} title={s.unpublishedByAdmin ? "Locked until an admin restores it" : undefined}>
                {s.published ? "Unpublish" : "Publish"}
              </Button>
            </form>
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
