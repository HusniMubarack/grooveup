import Link from "next/link";
import { db } from "@/lib/db";
import { fmtDate } from "@/lib/utils";
import { closeReportAction } from "@/app/admin/actions";
import { AdminTable } from "@/components/admin-table";
import { Badge } from "@/components/ui/badge";

export default async function AdminReports() {
  const reports = await db.report.findMany({
    include: { reporter: true, targetUser: { include: { teacherProfile: true } }, targetService: true },
    orderBy: { createdAt: "desc" },
  });
  // OPEN first, newest first within each group.
  const rows = [...reports].sort((a, b) => Number(b.status === "OPEN") - Number(a.status === "OPEN"));

  return (
    <AdminTable
      rows={rows}
      highlight={(r) => r.status === "OPEN"}
      empty="No reports."
      columns={[
        { h: "Status", cell: (r) => <Badge variant={r.status === "OPEN" ? "default" : "muted"}>{r.status}</Badge> },
        { h: "Date", cell: (r) => fmtDate(r.createdAt), className: "whitespace-nowrap" },
        {
          h: "Target",
          cell: (r) =>
            r.targetType === "SERVICE" && r.targetService ? (
              <Link href={`/s/${r.targetService.id}`} className="text-primary">Service: {r.targetService.title}</Link>
            ) : r.targetUser ? (
              <Link href={r.targetUser.teacherProfile ? `/t/${r.targetUser.teacherProfile.handle}` : `/admin/users?u=${r.targetUser.id}`} className="text-primary">
                User: {r.targetUser.name}{r.targetUser.banned && " (banned)"}
              </Link>
            ) : "—",
        },
        { h: "Reason", cell: (r) => <span className="block max-w-64">{r.reason}</span> },
        { h: "Reporter", cell: (r) => r.reporter.email },
        {
          h: "Actions",
          cell: (r) =>
            r.status !== "OPEN" ? <span className="text-muted-foreground">—</span> : (
              <form action={closeReportAction} className="flex flex-wrap gap-1">
                <input type="hidden" name="reportId" value={r.id} />
                <select name="shortcut" className="h-7 rounded border bg-muted px-1 text-[11px]" defaultValue="">
                  <option value="">Resolve only</option>
                  {r.targetType === "SERVICE" && <option value="unpublish">+ Unpublish service</option>}
                  <option value="ban">{r.targetType === "SERVICE" ? "+ Ban teacher" : "+ Ban user"}</option>
                </select>
                <button name="status" value="RESOLVED" className="h-7 rounded bg-primary px-2 text-[11px] text-primary-foreground">Resolve</button>
                <button name="status" value="DISMISSED" className="h-7 rounded bg-secondary px-2 text-[11px]">Dismiss</button>
              </form>
            ),
        },
      ]}
    />
  );
}
