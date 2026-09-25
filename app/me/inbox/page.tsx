import { requireUser } from "@/lib/auth";
import { InboxView } from "@/components/inbox-view";

export default async function MyInbox({ searchParams }: { searchParams: Promise<{ q?: string; unread?: string }> }) {
  const sp = await searchParams;
  const user = await requireUser("/me/inbox");
  return <InboxView side="student" ownerId={user.id} base="/me/inbox" q={sp.q?.trim()} unread={sp.unread === "1"} />;
}
