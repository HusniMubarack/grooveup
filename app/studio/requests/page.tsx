import Link from "next/link";
import { MessageCircle, Search } from "lucide-react";
import type { Prisma, RequestStatus } from "@prisma/client";
import { declineRequestAction, endAccessAction } from "@/app/request-actions";
import { ensureTeacherProfile, requireTeacher } from "@/lib/auth";
import { db } from "@/lib/db";
import { upiLink, upiQrSvg } from "@/lib/requests";
import { cn, fmtUntil, rupees, timeAgo } from "@/lib/utils";
import { ApproveForm } from "@/components/approve-form";
import { PaymentDetailsForm } from "@/components/payment-details-form";
import { Badge } from "@/components/ui/badge";

const STATUSES = ["PENDING", "APPROVED", "DECLINED", "ALL"] as const;

export default async function StudioRequests({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  const sp = await searchParams;
  const user = await requireTeacher();
  const t = await ensureTeacherProfile(user.id, user.name);
  const status = (STATUSES as readonly string[]).includes(sp.status ?? "") ? (sp.status as (typeof STATUSES)[number]) : "PENDING";
  const q = sp.q?.trim();

  const where: Prisma.AccessRequestWhereInput = { teacherId: t.id };
  if (status !== "ALL") where.status = status as RequestStatus;
  else where.status = { not: "CANCELED" };
  if (q)
    where.OR = [
      { student: { name: { contains: q } } },
      { student: { email: { contains: q } } },
      { service: { title: { contains: q } } },
      { paymentRef: { contains: q } },
      ...("course".includes(q.toLowerCase()) ? [{ serviceId: null }] : []),
    ];

  const [requests, counts, convos] = await Promise.all([
    db.accessRequest.findMany({
      where,
      include: { student: { select: { id: true, name: true, email: true } }, service: { select: { title: true } } },
      orderBy: status === "PENDING" ? { createdAt: "asc" } : { decidedAt: "desc" },
      take: 100,
    }),
    db.accessRequest.groupBy({ by: ["status"], where: { teacherId: t.id }, _count: true }),
    db.conversation.findMany({ where: { teacherId: t.id }, select: { id: true, studentId: true } }),
  ]);
  const count = (s: string) => counts.find((c) => c.status === s)?._count ?? 0;
  const chatOf = (studentId: string) => convos.find((c) => c.studentId === studentId)?.id;
  // Lesson grants that can be ended early (course access is ended from the Overview's subscriber table).
  const grants = status === "APPROVED"
    ? await db.entitlement.findMany({ where: { teacherId: t.id, source: "PURCHASE", OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }, select: { id: true, userId: true, serviceId: true } })
    : [];
  const link = upiLink(t, user.name, t.monthlyPricePaise, "course");
  const qr = link && t.showUpiQr ? await upiQrSvg(link) : null;
  const href = (s: string) => `/studio/requests?${new URLSearchParams({ ...(q ? { q } : {}), status: s })}`;

  return (
    <div className="space-y-4">
      <details className="rounded-xl border bg-card" open={!t.upiId}>
        <summary className="cursor-pointer list-none p-3 text-sm font-medium">
          Payment details{" "}
          <span className="font-normal text-muted-foreground">· {t.upiId ? `${t.upiId}${t.showUpiQr ? " · QR on" : ""}` : "add your UPI ID so students can pay you"}</span>
        </summary>
        <div className="border-t p-3">
          <PaymentDetailsForm upiId={t.upiId ?? ""} showUpiQr={t.showUpiQr} coursePrice={t.monthlyPricePaise / 100} qrSvg={qr} />
        </div>
      </details>

      <div className="flex flex-wrap items-center gap-2">
        <form className="flex min-w-0 flex-1 items-center gap-2 rounded-md border bg-card px-2" action="/studio/requests">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <input name="q" defaultValue={q} placeholder="Search student, lesson or UPI ref" className="h-9 min-w-0 flex-1 bg-transparent text-sm outline-none" />
          <input type="hidden" name="status" value={status} />
        </form>
        <div className="flex gap-1 text-xs">
          {STATUSES.map((s) => (
            <Link key={s} href={href(s)} className={cn("rounded-full border px-2.5 py-1 capitalize", status === s ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground")}>
              {s.toLowerCase()}{s !== "ALL" && ` ${count(s)}`}
            </Link>
          ))}
        </div>
      </div>

      {requests.length === 0 ? (
        <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          {q ? "No requests match your search." : status === "PENDING" ? "No pending requests. You're all caught up." : "Nothing here yet."}
        </p>
      ) : (
        <ul className="space-y-2">
          {requests.map((r) => {
            const chat = chatOf(r.studentId);
            const grant = r.serviceId ? grants.find((g) => g.userId === r.studentId && g.serviceId === r.serviceId) : undefined;
            return (
              <li key={r.id} className="rounded-xl border bg-card p-3">
                <div className="flex flex-wrap items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{r.student.name} <span className="text-xs font-normal text-muted-foreground">{r.student.email}</span></p>
                    <p className="text-sm">
                      {r.service ? r.service.title : <span className="text-primary">Course</span>} · <span className="text-primary">{rupees(r.amountPaise)}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {timeAgo(r.createdAt)}
                      {r.paymentRef && <> · UPI ref <span className="font-mono text-foreground">{r.paymentRef}</span></>}
                    </p>
                    {r.note && <p className="mt-1 text-xs italic text-muted-foreground">“{r.note}”</p>}
                  </div>
                  {r.status !== "PENDING" && (
                    <Badge variant={r.status === "APPROVED" ? "outline" : "muted"}>
                      {r.status.toLowerCase()}{r.status === "APPROVED" && ` · ${r.accessUntil ? `until ${fmtUntil(r.accessUntil)}` : "no expiry"}`}
                    </Badge>
                  )}
                </div>
                {r.decisionNote && <p className="mt-1 text-xs text-muted-foreground">Reason: {r.decisionNote}</p>}
                <div className="mt-2 flex flex-wrap items-center gap-2 border-t pt-2">
                  {r.status === "PENDING" && (
                    <>
                      <ApproveForm requestId={r.id} isCourse={!r.serviceId} />
                      <details className="relative">
                        <summary className="flex h-8 cursor-pointer list-none items-center rounded-md px-2 text-xs text-muted-foreground hover:text-destructive">Decline</summary>
                        <form action={declineRequestAction} className="mt-1 flex gap-1">
                          <input type="hidden" name="requestId" value={r.id} />
                          <input name="reason" maxLength={300} placeholder="Reason (optional)" className="h-8 w-44 rounded-md border border-input bg-muted/40 px-2 text-xs" />
                          <button className="h-8 rounded-md bg-destructive px-2 text-xs text-white">Decline</button>
                        </form>
                      </details>
                    </>
                  )}
                  {grant && (
                    <form action={endAccessAction}>
                      <input type="hidden" name="entitlementId" value={grant.id} />
                      <button className="h-8 rounded-md px-2 text-xs text-muted-foreground hover:text-destructive">End access</button>
                    </form>
                  )}
                  {chat && (
                    <Link href={`/studio/inbox/${chat}`} className="ml-auto flex h-8 items-center gap-1 rounded-md px-2 text-xs text-primary hover:bg-muted">
                      <MessageCircle className="size-3.5" /> Chat
                    </Link>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
