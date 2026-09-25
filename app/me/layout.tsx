import { requireUser } from "@/lib/auth";
import { unreadCount } from "@/lib/chat";
import { db } from "@/lib/db";
import { SubTabs } from "@/components/sub-tabs";

export default async function MyFloorLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser("/me");
  const [pending, unread] = await Promise.all([
    db.accessRequest.count({ where: { studentId: user.id, status: "PENDING" } }),
    unreadCount("student", user.id),
  ]);
  return (
    <div className="space-y-5">
      <h1 className="font-serif text-3xl">My Floor</h1>
      <SubTabs
        tabs={[
          { href: "/me", label: "Practice", exact: true },
          { href: "/me/requests", label: "Requests", badge: pending },
          { href: "/me/inbox", label: "Inbox", badge: unread },
        ]}
      />
      {children}
    </div>
  );
}
