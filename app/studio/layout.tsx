import { ensureTeacherProfile, requireTeacher } from "@/lib/auth";
import { unreadCount } from "@/lib/chat";
import { db } from "@/lib/db";
import { SubTabs } from "@/components/sub-tabs";

export default async function StudioLayout({ children }: { children: React.ReactNode }) {
  const user = await requireTeacher();
  const profile = await ensureTeacherProfile(user.id, user.name);
  const [pending, unread] = await Promise.all([
    db.accessRequest.count({ where: { teacherId: profile.id, status: "PENDING" } }),
    unreadCount("teacher", profile.id),
  ]);
  return (
    <div className="space-y-5">
      <SubTabs
        tabs={[
          { href: "/studio", label: "Overview", exact: true },
          { href: "/studio/requests", label: "Requests", badge: pending },
          { href: "/studio/inbox", label: "Inbox", badge: unread },
        ]}
      />
      {children}
    </div>
  );
}
