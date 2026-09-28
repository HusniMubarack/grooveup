import Link from "next/link";
import type { Prisma, RequestStatus } from "@prisma/client";
import { declineRequestAction } from "@/app/request-actions";
import { db } from "@/lib/db";
import { fmtUntil, rupees, timeAgo } from "@/lib/utils";
import { AdminTable } from "@/components/admin-table";
import { ApproveForm } from "@/components/approve-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";

/** All access requests across teachers. Admins can approve (with an expiry) or decline on a teacher's behalf. */
export default async function AdminRequests({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  const sp = await searchParams;
  const status = ["PENDING", "APPROVED", "DECLINED", "CANCELED"].includes(sp.status ?? "") ? (sp.status as RequestStatus) : sp.status === "ALL" ? undefined : "PENDING";
  const q = sp.q?.trim();
  const where: Prisma.AccessRequestWhereInput = status ? { status } : {};
  if (q)
    where.OR = [
      { student: { name: { contains: q } } },
      { student: { email: { contains: q } } },
      { teacher: { user: { name: { contains: q } } } },
      { service: { title: { contains: q } } },
    ];
  const [rows, pending] = await Promise.all([
    db.accessRequest.findMany({
      where,
      include: { student: true, teacher: { include: { user: true } }, service: { select: { id: true, title: true } } },
      orderBy: { createdAt: status === "PENDING" ? "asc" : "desc" },
      take: 200,
    }),
    db.accessRequest.count({ where: { status: "PENDING" } }),
  ]);

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {pending} pending. Until in-app payments launch, teachers or admins approve requests. Approvals and declines by admins are audit-logged.
      </p>
      <form className="flex flex-wrap gap-2">
        <Input name="q" defaultValue={q} placeholder="Search student, teacher or lesson" className="h-9 w-64" />
        <Select name="status" defaultValue={status ?? "ALL"} className="h-9 w-36">
          <option value="PENDING">Pending</option>
          <option value="APPROVED">Approved</option>
          <option value="DECLINED">Declined</option>
          <option value="CANCELED">Withdrawn</option>
          <option value="ALL">All</option>
        </Select>
        <Button size="sm" className="h-9">Filter</Button>
      </form>
      <AdminTable
        rows={rows}
        highlight={(r) => r.status === "PENDING"}
        empty="No requests."
        columns={[
          { h: "Sent", cell: (r) => timeAgo(r.createdAt), className: "whitespace-nowrap" },
          { h: "Student", cell: (r) => <span>{r.student.name}<span className="block text-muted-foreground">{r.student.email}</span></span> },
          { h: "Teacher", cell: (r) => <Link href={`/t/${r.teacher.handle}`} className="text-primary">{r.teacher.user.name}</Link> },
          { h: "Wants", cell: (r) => (r.service ? <Link href={`/s/${r.service.id}`} className="hover:underline">{r.service.title}</Link> : "Course") },
          { h: "Price", cell: (r) => rupees(r.amountPaise) },
          { h: "Note", cell: (r) => <span className="block max-w-48 text-muted-foreground">{r.note ?? "—"}</span> },
          {
            h: "Status / action",
            cell: (r) =>
              r.status === "PENDING" ? (
                <div className="flex flex-col gap-1">
                  <ApproveForm requestId={r.id} isCourse={!r.serviceId} />
                  <form action={declineRequestAction} className="flex gap-1">
                    <input type="hidden" name="requestId" value={r.id} />
                    <input name="reason" placeholder="Decline reason" className="h-7 w-32 rounded border bg-muted px-1 text-[11px]" />
                    <button className="h-7 rounded bg-destructive/90 px-2 text-[11px] text-white">Decline</button>
                  </form>
                </div>
              ) : (
                <Badge variant={r.status === "APPROVED" ? "outline" : "muted"}>
                  {r.status.toLowerCase()}{r.status === "APPROVED" && ` · ${r.accessUntil ? fmtUntil(r.accessUntil) : "no expiry"}`}
                </Badge>
              ),
          },
        ]}
      />
    </div>
  );
}
