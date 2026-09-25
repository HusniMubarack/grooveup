import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { loadThread } from "@/lib/thread";
import { rupees } from "@/lib/utils";
import { InboxView } from "@/components/inbox-view";

export default async function MyThread({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ q?: string; unread?: string }> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const user = await requireUser(`/me/inbox/${id}`);
  const thread = await loadThread(id, user.id);
  if (!thread || thread.side !== "student") redirect("/me/inbox");
  const t = thread.c.teacher;
  const pending = await db.accessRequest.findMany({ where: { studentId: user.id, teacherId: t.id, status: "PENDING" }, include: { service: { select: { title: true } } } });
  const header = (
    <p className="text-xs text-muted-foreground">
      <Link href={`/t/${t.handle}`} className="text-primary">View {t.user.name.split(" ")[0]}&apos;s profile</Link>
      {pending.map((r) => (
        <span key={r.id}> · Waiting on <b>{r.service?.title ?? "course"}</b> ({rupees(r.amountPaise)})</span>
      ))}
    </p>
  );
  return (
    <InboxView
      side="student"
      ownerId={user.id}
      base="/me/inbox"
      q={sp.q?.trim()}
      unread={sp.unread === "1"}
      active={{ id, title: t.user.name, header, messages: thread.messages }}
    />
  );
}
