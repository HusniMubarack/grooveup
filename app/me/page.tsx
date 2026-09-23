import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { cancelSubAction, logoutAction } from "@/app/actions";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { fmtDate, fmtDuration, rupees } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Placeholder } from "@/components/placeholder";
import { Thumb } from "@/components/service-card";

export default async function MyFloor() {
  const user = await requireUser("/me");
  const [practice, purchases, subs, follows] = await Promise.all([
    db.practiceEvent.findMany({ where: { userId: user.id }, include: { service: true }, orderBy: { updatedAt: "desc" }, take: 8 }),
    db.entitlement.findMany({ where: { userId: user.id, source: "PURCHASE" }, include: { service: { include: { teacher: { include: { user: true } } } } } }),
    db.subscription.findMany({ where: { studentId: user.id }, include: { teacher: { include: { user: true, services: { where: { includedInSub: true, published: true, unpublishedByAdmin: false } } } } }, orderBy: { status: "asc" } }),
    db.follow.findMany({ where: { studentId: user.id }, include: { teacher: { include: { user: true } } } }),
  ]);

  return (
    <div className="space-y-8">
      <h1 className="font-serif text-3xl">My Floor</h1>

      <section>
        <h2 className="mb-2 text-sm uppercase tracking-wide text-muted-foreground">Keep practicing</h2>
        {practice.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing yet — <Link href="/explore" className="text-primary">try a free demo</Link>.</p>
        ) : (
          <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
            {practice.map((p) => (
              <Link key={p.id} href={`/play/${p.serviceId}`} className="w-44 shrink-0">
                <Thumb s={p.service} />
                <p className="mt-1 line-clamp-1 text-sm">{p.service.title}</p>
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  {p.completed ? <><CheckCircle2 className="size-3 text-emerald-400" /> Completed</> : `Resume at ${fmtDuration(p.lastSec)}`}
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm uppercase tracking-wide text-muted-foreground">Subscriptions</h2>
        {subs.length === 0 && <p className="text-sm text-muted-foreground">No subscriptions yet.</p>}
        {subs.map((s) => (
          <Card key={s.id}>
            <CardHeader className="flex-row items-center justify-between">
              <div>
                <CardTitle><Link href={`/t/${s.teacher.handle}`}>{s.teacher.user.name}</Link></CardTitle>
                <p className="text-xs text-muted-foreground">
                  {rupees(s.teacher.monthlyPricePaise)}/mo · {s.status === "ACTIVE" ? `renews ${fmtDate(s.currentPeriodEnd)}` : "canceled"}
                </p>
              </div>
              {s.status === "ACTIVE" ? (
                <form action={cancelSubAction.bind(null, s.id)}><Button size="sm" variant="outline">Cancel</Button></form>
              ) : (
                <Badge variant="muted">Canceled</Badge>
              )}
            </CardHeader>
            {s.status === "ACTIVE" && (
              <CardContent className="flex flex-wrap gap-2">
                {s.teacher.services.map((svc) => (
                  <Link key={svc.id} href={`/play/${svc.id}`} className="rounded-full border px-3 py-1 text-xs hover:border-primary">{svc.title}</Link>
                ))}
              </CardContent>
            )}
          </Card>
        ))}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm uppercase tracking-wide text-muted-foreground">Purchased lessons</h2>
        {purchases.length === 0 && <p className="text-sm text-muted-foreground">No purchases yet.</p>}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {purchases.map((e) => e.service && (
            <Link key={e.id} href={`/play/${e.service.id}`}>
              <Thumb s={e.service} />
              <p className="mt-1 line-clamp-2 text-sm">{e.service.title}</p>
              <p className="text-xs text-muted-foreground">{e.service.teacher.user.name}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm uppercase tracking-wide text-muted-foreground">Following</h2>
        <div className="flex flex-wrap gap-2">
          {follows.length === 0 && <p className="text-sm text-muted-foreground">Not following anyone yet.</p>}
          {follows.map((f) => (
            <Link key={f.id} href={`/t/${f.teacher.handle}`} className="rounded-full border px-3 py-1 text-sm hover:border-primary">{f.teacher.user.name}</Link>
          ))}
        </div>
      </section>

      <section id="profile" className="scroll-mt-20">
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <p className="text-sm text-muted-foreground">{user.name} · {user.email}</p>
            <div><Badge variant="outline">{user.role}</Badge></div>
          </CardHeader>
          <CardContent>
            <form action={logoutAction}><Button variant="secondary" className="w-full sm:w-auto">Sign out</Button></form>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
