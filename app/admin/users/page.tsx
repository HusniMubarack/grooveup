import Link from "next/link";
import type { Prisma, Role } from "@prisma/client";
import { db } from "@/lib/db";
import { fmtDate, rupees } from "@/lib/utils";
import { setBannedAction, setRoleAction, setTeacherFlagAction } from "@/app/admin/actions";
import { ActionButton, AdminTable } from "@/components/admin-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";

type SP = { q?: string; role?: string; banned?: string; u?: string };

export default async function AdminUsers({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const where: Prisma.UserWhereInput = {};
  if (sp.q) where.OR = [{ email: { contains: sp.q } }, { name: { contains: sp.q } }];
  if (sp.role) where.role = sp.role as Role;
  if (sp.banned) where.banned = sp.banned === "yes";

  const users = await db.user.findMany({ where, include: { teacherProfile: true }, orderBy: { createdAt: "desc" } });
  const selected = sp.u
    ? await db.user.findUnique({
        where: { id: sp.u },
        include: {
          teacherProfile: { include: { _count: { select: { services: true, subscriptions: { where: { status: "ACTIVE" } } } } } },
          subscriptions: { include: { teacher: true } },
          orders: { orderBy: { createdAt: "desc" } },
        },
      })
    : null;
  const qs = (extra: Record<string, string>) => new URLSearchParams({ ...(sp as Record<string, string>), ...extra }).toString();

  return (
    <div className="space-y-3">
      <form className="flex flex-wrap gap-2">
        <Input name="q" defaultValue={sp.q} placeholder="Search email or name" className="h-9 w-56" />
        <Select name="role" defaultValue={sp.role ?? ""} className="h-9 w-32">
          <option value="">Any role</option>
          {["STUDENT", "TEACHER", "BOTH", "ADMIN"].map((r) => <option key={r}>{r}</option>)}
        </Select>
        <Select name="banned" defaultValue={sp.banned ?? ""} className="h-9 w-32">
          <option value="">Banned: any</option>
          <option value="yes">Banned</option>
          <option value="no">Active</option>
        </Select>
        <Button size="sm" className="h-9">Filter</Button>
      </form>

      {selected && (
        <aside className="rounded-lg border border-primary/50 bg-card p-3 text-sm">
          <div className="flex items-center justify-between">
            <strong>{selected.name} <span className="font-normal text-muted-foreground">{selected.email}</span></strong>
            <Link href={`/admin/users?${qs({ u: "" })}`} className="text-xs text-muted-foreground">Close ✕</Link>
          </div>
          <div className="mt-2 grid gap-1 text-xs sm:grid-cols-3">
            <p>Services: <b>{selected.teacherProfile?._count.services ?? 0}</b>{selected.teacherProfile && <> · <Link className="text-primary" href={`/t/${selected.teacherProfile.handle}`}>@{selected.teacherProfile.handle}</Link></>}</p>
            <p>Subscribers: <b>{selected.teacherProfile?._count.subscriptions ?? 0}</b></p>
            <p>Subscriptions: {selected.subscriptions.map((s) => `@${s.teacher.handle} (${s.status.toLowerCase()})`).join(", ") || "—"}</p>
            <p className="sm:col-span-3">
              Orders ({selected.orders.length}, {rupees(selected.orders.reduce((a, o) => a + o.amountPaise, 0))}):{" "}
              {selected.orders.map((o) => `${o.type.toLowerCase()} ${rupees(o.amountPaise)} ${fmtDate(o.createdAt)}`).join(" · ") || "—"}
            </p>
          </div>
        </aside>
      )}

      <AdminTable
        rows={users}
        highlight={(u) => u.id === sp.u}
        columns={[
          { h: "Name", cell: (u) => <Link href={`/admin/users?${qs({ u: u.id })}`} className="font-medium text-primary hover:underline">{u.name}</Link> },
          { h: "Email", cell: (u) => u.email },
          { h: "Role", cell: (u) => <Badge variant={u.role === "ADMIN" ? "destructive" : "muted"}>{u.role}</Badge> },
          { h: "Banned", cell: (u) => (u.banned ? <Badge variant="destructive">banned</Badge> : "—") },
          { h: "Teacher", cell: (u) => u.teacherProfile ? <span>{u.teacherProfile.verified ? "✓ verified" : "unverified"}{u.teacherProfile.featured && " · ★"}</span> : "—" },
          { h: "Created", cell: (u) => fmtDate(u.createdAt), className: "whitespace-nowrap" },
          {
            h: "Actions",
            cell: (u) =>
              u.role === "ADMIN" ? <span className="text-muted-foreground">—</span> : (
                <div className="flex flex-wrap gap-1">
                  <ActionButton action={setBannedAction} fields={{ userId: u.id, banned: String(!u.banned) }} variant={u.banned ? "secondary" : "destructive"}>
                    {u.banned ? "Unban" : "Ban"}
                  </ActionButton>
                  <form action={setRoleAction} className="inline-flex gap-1">
                    <input type="hidden" name="userId" value={u.id} />
                    <select name="role" defaultValue={u.role} className="h-7 rounded border bg-muted px-1 text-[11px]">
                      <option>STUDENT</option><option>TEACHER</option><option>BOTH</option>
                    </select>
                    <button className="h-7 rounded bg-secondary px-2 text-[11px]">Set</button>
                  </form>
                  {u.teacherProfile && (
                    <>
                      <ActionButton action={setTeacherFlagAction} fields={{ teacherId: u.teacherProfile.id, flag: "verified", value: String(!u.teacherProfile.verified) }}>
                        {u.teacherProfile.verified ? "Unverify" : "Verify"}
                      </ActionButton>
                      <ActionButton action={setTeacherFlagAction} fields={{ teacherId: u.teacherProfile.id, flag: "featured", value: String(!u.teacherProfile.featured) }} variant={u.teacherProfile.featured ? "secondary" : "primary"}>
                        {u.teacherProfile.featured ? "Unfeature" : "Feature"}
                      </ActionButton>
                    </>
                  )}
                </div>
              ),
          },
        ]}
      />
    </div>
  );
}
