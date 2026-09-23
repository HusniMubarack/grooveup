import Link from "next/link";
import { db } from "@/lib/db";
import { fmtDate, rupees } from "@/lib/utils";
import { cancelSubscriptionAction } from "@/app/admin/actions";
import { ActionButton, AdminTable } from "@/components/admin-table";

export default async function AdminCommerce() {
  const [orders, subs, teachers] = await Promise.all([
    db.order.findMany({ include: { student: true, service: true }, orderBy: { createdAt: "desc" } }),
    db.subscription.findMany({ where: { status: "ACTIVE" }, include: { student: true, teacher: { include: { user: true } } }, orderBy: { currentPeriodEnd: "asc" } }),
    db.teacherProfile.findMany({ include: { user: true } }),
  ]);
  const teacherById = new Map(teachers.map((t) => [t.id, t]));

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h2 className="text-sm uppercase tracking-wide text-muted-foreground">Orders ({rupees(orders.reduce((a, o) => a + o.amountPaise, 0))} mock GMV)</h2>
        <AdminTable
          rows={orders}
          columns={[
            { h: "Date", cell: (o) => fmtDate(o.createdAt), className: "whitespace-nowrap" },
            { h: "Student", cell: (o) => o.student.email },
            { h: "Type", cell: (o) => o.type },
            { h: "Amount", cell: (o) => rupees(o.amountPaise) },
            {
              h: "Teacher / service",
              cell: (o) => {
                const t = o.teacherId ? teacherById.get(o.teacherId) : undefined;
                return (
                  <span>
                    {t && <Link href={`/t/${t.handle}`} className="text-primary">@{t.handle}</Link>}
                    {o.service && <> · <Link href={`/s/${o.service.id}`} className="hover:underline">{o.service.title}</Link></>}
                  </span>
                );
              },
            },
            { h: "", cell: () => <button disabled title="Refunds are not in the MVP" className="h-7 cursor-not-allowed rounded border border-dashed px-2 text-[11px] text-muted-foreground">Refund (soon)</button> },
          ]}
        />
        <p className="text-[11px] text-muted-foreground">
          Refunds are a placeholder: they will reverse the order, revoke the matching entitlement and call the payment
          provider&apos;s refund API once real payments exist.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm uppercase tracking-wide text-muted-foreground">Active subscriptions</h2>
        <AdminTable
          rows={subs}
          empty="No active subscriptions."
          columns={[
            { h: "Student", cell: (s) => s.student.email },
            { h: "Teacher", cell: (s) => <Link href={`/t/${s.teacher.handle}`} className="text-primary">{s.teacher.user.name}</Link> },
            { h: "Price", cell: (s) => `${rupees(s.teacher.monthlyPricePaise)}/mo` },
            { h: "Period end", cell: (s) => fmtDate(s.currentPeriodEnd) },
            { h: "", cell: (s) => <ActionButton action={cancelSubscriptionAction} fields={{ subId: s.id }} variant="destructive">Cancel</ActionButton> },
          ]}
        />
      </section>
    </div>
  );
}
