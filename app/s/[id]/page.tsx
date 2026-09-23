import Link from "next/link";
import { notFound } from "next/navigation";
import { BadgeCheck, Lock, Play, ShieldAlert } from "lucide-react";
import { canPlay, isFreeToWatch, isServiceLive } from "@/lib/access";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { fmtDuration, rupees } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PayButton } from "@/components/pay-button";
import { Placeholder } from "@/components/placeholder";
import { ReportButton } from "@/components/report-button";

export default async function ServicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await db.service.findUnique({
    where: { id },
    include: { teacher: { include: { user: true } }, sections: { orderBy: { startSec: "asc" } } },
  });
  if (!s) notFound();

  const user = await currentUser();
  const live = isServiceLive(s);
  const isOwner = user?.id === s.teacher.userId;
  const isAdmin = user?.role === "ADMIN";
  if (!live && !isOwner && !isAdmin) {
    return (
      <div className="py-24 text-center">
        <p className="font-serif text-2xl">This lesson is unavailable.</p>
        <Link href="/explore" className="mt-4 inline-block text-primary underline">Back to Explore</Link>
      </div>
    );
  }

  const unlocked = await canPlay(user, s);
  const back = `/s/${s.id}`;

  return (
    <div className="space-y-6">
      {!live && (
        <p className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm">
          <ShieldAlert className="size-4 text-destructive" />
          {s.unpublishedByAdmin ? `Removed by admin: ${s.unpublishedReason}` : "Not published — only you and admins can see this."}
        </p>
      )}

      <div className="relative overflow-hidden rounded-lg border bg-black">
        {/* Locked or not, this page only ever shows the teaser. */}
        <video src={s.teaserUrl} poster={s.thumbnailUrl || undefined} controls playsInline className="aspect-video w-full" />
        {!unlocked && (
          <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-black/75 px-2 py-1 text-xs text-primary">
            <Lock className="size-3" /> Teaser
          </span>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-[1fr_280px]">
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1">
            <Badge variant="muted">{s.type}</Badge>
            <Badge variant="muted">{s.level}</Badge>
            <Badge variant="muted">{s.style}</Badge>
            <Badge variant="muted">{fmtDuration(s.durationSec)}</Badge>
          </div>
          <h1 className="font-serif text-3xl leading-tight">{s.title}</h1>
          <Link href={`/t/${s.teacher.handle}`} className="flex items-center gap-1 text-sm text-primary">
            {s.teacher.user.name} {s.teacher.verified && <BadgeCheck className="size-4" />}
          </Link>
          <p className="text-sm leading-relaxed text-muted-foreground">{s.description}</p>
          {s.sections.length > 0 && (
            <ul className="space-y-1 text-sm">
              {s.sections.map((sec) => (
                <li key={sec.id} className="flex justify-between border-b py-1">
                  <span>{sec.label}</span>
                  <span className="text-muted-foreground">{fmtDuration(sec.startSec)}–{fmtDuration(sec.endSec)}</span>
                </li>
              ))}
            </ul>
          )}
          <ReportButton targetType="SERVICE" targetId={s.id} />
        </div>

        <aside className="space-y-3">
          {unlocked ? (
            <Button asChild size="lg" className="w-full">
              <Link href={`/play/${s.id}`}><Play /> {isFreeToWatch(s) ? "Practice free" : "Practice now"}</Link>
            </Button>
          ) : !user ? (
            <Button asChild size="lg" className="w-full"><Link href={`/login?next=${back}`}>Sign in to unlock</Link></Button>
          ) : (
            <>
              {s.pricePaise > 0 && <PayButton kind="SERVICE" id={s.id} amountPaise={s.pricePaise} back={back} label="Buy lesson" />}
              {s.includedInSub && (
                <PayButton kind="SUBSCRIPTION" id={s.teacherId} amountPaise={s.teacher.monthlyPricePaise} back={back} label={`Subscribe to ${s.teacher.user.name.split(" ")[0]}`} />
              )}
              <p className="text-center text-xs text-muted-foreground">
                {s.includedInSub ? `Included with ${rupees(s.teacher.monthlyPricePaise)}/mo subscription.` : "One-time purchase, yours to keep."}
              </p>
            </>
          )}
          {(isOwner || isAdmin) && (
            <p className="text-center text-xs text-muted-foreground">{isAdmin ? "Admin preview access" : "You own this lesson"}</p>
          )}
          <Placeholder title="Real payments">
            A PaymentProvider interface: Razorpay first (UPI, cards), then Stripe for international. Platform keeps a 10%
            fee and teachers get scheduled payouts. Today this is a mock charge.
          </Placeholder>
          <Placeholder title="Tips & promo codes" action="Apply code">
            Students can tip a teacher after a lesson and apply teacher-issued promo codes at checkout.
          </Placeholder>
        </aside>
      </div>
    </div>
  );
}
