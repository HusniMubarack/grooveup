import Link from "next/link";
import { db } from "@/lib/db";
import { rupees } from "@/lib/utils";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Placeholder } from "@/components/placeholder";

export default async function AdminOverview() {
  const [users, teachers, published, activeSubs, openReports, gmv, logs, reports] = await Promise.all([
    db.user.count(),
    db.user.count({ where: { role: { in: ["TEACHER", "BOTH"] } } }),
    db.service.count({ where: { published: true, unpublishedByAdmin: false } }),
    db.subscription.count({ where: { status: "ACTIVE" } }),
    db.report.count({ where: { status: "OPEN" } }),
    db.order.aggregate({ _sum: { amountPaise: true } }),
    db.auditLog.findMany({ include: { admin: true }, orderBy: { createdAt: "desc" }, take: 10 }),
    db.report.findMany({ where: { status: "OPEN" }, include: { targetUser: true, targetService: true }, orderBy: { createdAt: "desc" }, take: 5 }),
  ]);

  const stats: [string, string | number][] = [
    ["Users", users], ["Teachers", teachers], ["Published services", published],
    ["Active subs", activeSubs], ["Open reports", openReports], ["Mock GMV", rupees(gmv._sum.amountPaise ?? 0)],
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {stats.map(([k, v]) => (
          <Card key={k}><CardHeader className="p-3"><CardDescription className="text-xs">{k}</CardDescription><CardTitle className="text-xl text-primary">{v}</CardTitle></CardHeader></Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <section>
          <h2 className="mb-2 text-sm uppercase tracking-wide text-muted-foreground">Open reports</h2>
          <ul className="space-y-1 text-sm">
            {reports.length === 0 && <li className="text-muted-foreground">Queue is clear.</li>}
            {reports.map((r) => (
              <li key={r.id}>
                <Link href="/admin/reports" className="block rounded-md border bg-card p-2 hover:border-primary">
                  <span className="text-primary">{r.targetType === "USER" ? r.targetUser?.name : r.targetService?.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">{r.reason}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h2 className="mb-2 text-sm uppercase tracking-wide text-muted-foreground">Audit log</h2>
          <ul className="divide-y rounded-md border bg-card font-mono text-[11px]">
            {logs.map((l) => (
              <li key={l.id} className="p-2">
                <span className="text-muted-foreground">{l.createdAt.toISOString().slice(0, 16).replace("T", " ")}</span>{" "}
                <span className="text-primary">{l.action}</span> {l.detail}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <Placeholder title="Admin extras" action="Open settings">
        Refunds, teacher payout approval, email blasts, a CMS homepage builder, a fine-grained role matrix and 2FA for
        admin accounts. None of these exist in the MVP.
      </Placeholder>
    </div>
  );
}
