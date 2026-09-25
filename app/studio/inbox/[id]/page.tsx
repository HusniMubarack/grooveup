import { redirect } from "next/navigation";
import { activeSubWhere, liveGrantWhere } from "@/lib/access";
import { ensureTeacherProfile, requireTeacher } from "@/lib/auth";
import { db } from "@/lib/db";
import { loadThread } from "@/lib/thread";
import { fmtUntil, rupees } from "@/lib/utils";
import { ApproveForm } from "@/components/approve-form";
import { InboxView } from "@/components/inbox-view";

export default async function StudioThread({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ q?: string; unread?: string }> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const user = await requireTeacher();
  const t = await ensureTeacherProfile(user.id, user.name);
  const thread = await loadThread(id, user.id, t.id);
  if (!thread || thread.side !== "teacher") redirect("/studio/inbox");
  const studentId = thread.c.studentId;

  // What this student has with me, and what they're waiting for: act without leaving the chat.
  const [sub, lessons, pending] = await Promise.all([
    db.subscription.findFirst({ where: { studentId, teacherId: t.id, ...activeSubWhere() } }),
    db.entitlement.findMany({ where: { userId: studentId, teacherId: t.id, ...liveGrantWhere() }, include: { service: { select: { title: true } } } }),
    db.accessRequest.findMany({ where: { studentId, teacherId: t.id, status: "PENDING" }, include: { service: { select: { title: true } } } }),
  ]);
  const header = (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        {thread.c.student.email} ·{" "}
        {sub ? `In your course (${sub.currentPeriodEnd ? `until ${fmtUntil(sub.currentPeriodEnd)}` : "no expiry"})` : "Not in your course"}
        {lessons.length > 0 && ` · ${lessons.map((l) => l.service?.title).join(", ")}`}
      </p>
      {pending.map((r) => (
        <div key={r.id} className="flex flex-wrap items-center gap-2 rounded-md border border-primary/40 bg-card p-2">
          <span className="min-w-0 flex-1 text-xs">
            Wants <b>{r.service?.title ?? "your course"}</b> · {rupees(r.amountPaise)}
            {r.paymentRef && <> · ref <span className="font-mono">{r.paymentRef}</span></>}
          </span>
          <ApproveForm requestId={r.id} isCourse={!r.serviceId} />
        </div>
      ))}
    </div>
  );

  return (
    <InboxView
      side="teacher"
      ownerId={t.id}
      base="/studio/inbox"
      q={sp.q?.trim()}
      unread={sp.unread === "1"}
      active={{ id, title: thread.c.student.name, header, messages: thread.messages }}
    />
  );
}
