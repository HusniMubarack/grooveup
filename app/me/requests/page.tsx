import Link from "next/link";
import { cancelRequestAction } from "@/app/request-actions";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { cn, fmtUntil, rupees, timeAgo } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const LABEL = { PENDING: "Waiting for teacher", APPROVED: "Approved", DECLINED: "Declined", CANCELED: "Withdrawn" } as const;

export default async function MyRequests() {
  const user = await requireUser("/me/requests");
  const [requests, convos] = await Promise.all([
    db.accessRequest.findMany({
      where: { studentId: user.id },
      include: { teacher: { include: { user: { select: { name: true } } } }, service: { select: { id: true, title: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    db.conversation.findMany({ where: { studentId: user.id }, select: { id: true, teacherId: true } }),
  ]);
  // Pending first, then the rest newest first.
  const rows = [...requests].sort((a, b) => Number(b.status === "PENDING") - Number(a.status === "PENDING"));

  if (rows.length === 0)
    return (
      <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
        No requests yet. Pay a teacher by UPI, then tap <b>Request access</b> on their course or lesson.{" "}
        <Link href="/explore" className="text-primary">Explore</Link>
      </p>
    );

  return (
    <ul className="space-y-2">
      {rows.map((r) => {
        const chat = convos.find((c) => c.teacherId === r.teacherId)?.id;
        const target = r.service ? `/s/${r.service.id}` : `/t/${r.teacher.handle}`;
        return (
          <li key={r.id} className={cn("rounded-xl border bg-card p-3", r.status === "PENDING" && "border-primary/50")}>
            <div className="flex flex-wrap items-start gap-2">
              <div className="min-w-0 flex-1">
                <Link href={target} className="font-medium hover:text-primary">{r.service?.title ?? `${r.teacher.user.name}'s course`}</Link>
                <p className="text-xs text-muted-foreground">
                  {r.teacher.user.name} · {rupees(r.amountPaise)} · sent {timeAgo(r.createdAt)}
                  {r.paymentRef && ` · ref ${r.paymentRef}`}
                </p>
              </div>
              <Badge variant={r.status === "APPROVED" ? "outline" : r.status === "PENDING" ? "default" : "muted"}>{LABEL[r.status]}</Badge>
            </div>
            {r.status === "APPROVED" && (
              <p className="mt-1 text-xs text-emerald-400">Unlocked · access {r.accessUntil ? `until ${fmtUntil(r.accessUntil)}` : "with no expiry"}</p>
            )}
            {r.status === "DECLINED" && r.decisionNote && <p className="mt-1 text-xs text-muted-foreground">Reason: {r.decisionNote}</p>}
            <div className="mt-2 flex flex-wrap gap-2">
              {r.status === "APPROVED" && <Button asChild size="sm"><Link href={target}>Open</Link></Button>}
              {chat && <Button asChild size="sm" variant="secondary"><Link href={`/me/inbox/${chat}`}>Chat with {r.teacher.user.name.split(" ")[0]}</Link></Button>}
              {r.status === "PENDING" && (
                <form action={cancelRequestAction.bind(null, r.id)}><Button size="sm" variant="ghost">Withdraw</Button></form>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
