import Link from "next/link";
import { notFound } from "next/navigation";
import { BadgeCheck, Sparkles } from "lucide-react";
import { toggleFollowAction } from "@/app/actions";
import { publicServiceWhere } from "@/lib/access";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseStyles, rupees } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PayButton } from "@/components/pay-button";
import { Placeholder } from "@/components/placeholder";
import { ReportButton } from "@/components/report-button";
import { ServiceCard } from "@/components/service-card";

export default async function TeacherPage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const t = await db.teacherProfile.findUnique({ where: { handle }, include: { user: true, _count: { select: { followers: true } } } });
  if (!t) notFound();

  if (t.user.banned) {
    return (
      <div className="py-24 text-center">
        <p className="font-serif text-2xl">This teacher is unavailable.</p>
        <Link href="/explore" className="mt-4 inline-block text-primary underline">Back to Explore</Link>
      </div>
    );
  }

  const user = await currentUser();
  const [services, follow, sub] = await Promise.all([
    db.service.findMany({ where: { ...publicServiceWhere, teacherId: t.id }, include: { teacher: { include: { user: true } } }, orderBy: [{ featured: "desc" }, { createdAt: "asc" }] }),
    user ? db.follow.findUnique({ where: { studentId_teacherId: { studentId: user.id, teacherId: t.id } } }) : null,
    user ? db.subscription.findFirst({ where: { studentId: user.id, teacherId: t.id, status: "ACTIVE" } }) : null,
  ]);
  const isOwner = user?.id === t.userId;

  return (
    <div className="space-y-8">
      <section className={`rounded-2xl border p-5 ${t.featured ? "border-primary/60 bg-gradient-to-br from-primary/15 to-card" : "bg-card"}`}>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-serif text-3xl">{t.user.name}</h1>
          {t.verified && <Badge variant="outline"><BadgeCheck /> Verified</Badge>}
          {t.featured && <Badge><Sparkles /> Featured</Badge>}
        </div>
        <p className="text-sm text-primary">@{t.handle} · {parseStyles(t.styles).join(" · ")} · {t._count.followers} followers</p>
        <p className="mt-3 max-w-prose text-sm text-muted-foreground">{t.bio}</p>

        {!isOwner && (
          <div className="mt-5 grid gap-2 sm:max-w-sm">
            {user ? (
              <form action={toggleFollowAction.bind(null, t.id, t.handle)}>
                <Button variant="secondary" className="w-full">{follow ? "Following ✓" : "Follow"}</Button>
              </form>
            ) : (
              <Button asChild variant="secondary"><Link href={`/login?next=/t/${t.handle}`}>Sign in to follow</Link></Button>
            )}
            {sub ? (
              <p className="rounded-md border border-primary/40 p-2 text-center text-sm text-primary">Subscribed — renews {sub.currentPeriodEnd.toLocaleDateString("en-IN")}</p>
            ) : (
              <PayButton kind="SUBSCRIPTION" id={t.id} amountPaise={t.monthlyPricePaise} back={`/t/${t.handle}`} label="Subscribe monthly" />
            )}
          </div>
        )}
        <div className="mt-4"><ReportButton targetType="USER" targetId={t.userId} /></div>
      </section>

      <section>
        <h2 className="mb-3 font-serif text-2xl">Lessons</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {services.map((s) => <ServiceCard key={s.id} s={s} />)}
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2">
        <Placeholder title="Programs" action="Start program">
          An ordered path through this teacher&apos;s lessons (e.g. &quot;Hip-hop foundations, 6 weeks&quot;) with a
          &quot;you are here&quot; marker driven by your practice history.
        </Placeholder>
        <Placeholder title="Membership tiers" action="Join Inner Circle">
          Two tiers per teacher: Member ({rupees(t.monthlyPricePaise)}/mo, all included lessons) and Inner Circle (adds live
          classes and feedback on your takes).
        </Placeholder>
        <Placeholder title="Message / custom choreo request" action="Message teacher">
          Direct messages with the teacher and a paid request flow for custom choreography (wedding sangeet, cover
          competition) with a quote and delivery date.
        </Placeholder>
      </section>
    </div>
  );
}
