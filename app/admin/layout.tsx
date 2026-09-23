import { requireAdmin } from "@/lib/auth";
import { AdminNav } from "./nav";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin(); // non-admins get a 404
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-serif text-2xl">Admin</h1>
        <AdminNav />
      </div>
      {children}
    </div>
  );
}
