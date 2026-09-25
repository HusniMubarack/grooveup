import { ensureTeacherProfile, requireTeacher } from "@/lib/auth";
import { InboxView } from "@/components/inbox-view";

export default async function StudioInbox({ searchParams }: { searchParams: Promise<{ q?: string; unread?: string }> }) {
  const sp = await searchParams;
  const user = await requireTeacher();
  const t = await ensureTeacherProfile(user.id, user.name);
  return <InboxView side="teacher" ownerId={t.id} base="/studio/inbox" q={sp.q?.trim()} unread={sp.unread === "1"} />;
}
