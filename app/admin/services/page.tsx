import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { rupees } from "@/lib/utils";
import { restoreServiceAction, setServiceFeaturedAction, unpublishServiceAction } from "@/app/admin/actions";
import { ActionButton, AdminTable } from "@/components/admin-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";

type SP = { published?: string; flagged?: string; style?: string };

export default async function AdminServices({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const where: Prisma.ServiceWhereInput = {};
  if (sp.published) where.published = sp.published === "yes";
  if (sp.flagged) where.unpublishedByAdmin = sp.flagged === "yes";
  if (sp.style) where.style = sp.style;

  const [services, styles] = await Promise.all([
    db.service.findMany({ where, include: { teacher: { include: { user: true } } }, orderBy: [{ unpublishedByAdmin: "desc" }, { createdAt: "desc" }] }),
    db.service.findMany({ select: { style: true }, distinct: ["style"] }),
  ]);

  return (
    <div className="space-y-3">
      <form className="flex flex-wrap gap-2">
        <Select name="published" defaultValue={sp.published ?? ""} className="h-9 w-36">
          <option value="">Published: any</option><option value="yes">Published</option><option value="no">Unpublished</option>
        </Select>
        <Select name="flagged" defaultValue={sp.flagged ?? ""} className="h-9 w-40">
          <option value="">Admin flag: any</option><option value="yes">Removed by admin</option><option value="no">Not flagged</option>
        </Select>
        <Select name="style" defaultValue={sp.style ?? ""} className="h-9 w-36">
          <option value="">Any style</option>
          {styles.map(({ style }) => <option key={style}>{style}</option>)}
        </Select>
        <Button size="sm" className="h-9">Filter</Button>
      </form>

      <AdminTable
        rows={services}
        highlight={(s) => s.unpublishedByAdmin}
        columns={[
          { h: "Title", cell: (s) => <span className="font-medium">{s.title}</span> },
          { h: "Teacher", cell: (s) => <Link href={`/t/${s.teacher.handle}`} className="text-primary">{s.teacher.user.name}{s.teacher.user.banned && " (banned)"}</Link> },
          { h: "Type", cell: (s) => s.type },
          { h: "Style", cell: (s) => s.style },
          { h: "Level", cell: (s) => s.level },
          { h: "Price", cell: (s) => (s.isFree ? "Free" : `${s.pricePaise ? rupees(s.pricePaise) : "—"}${s.includedInSub ? " +sub" : ""}`), className: "whitespace-nowrap" },
          { h: "Pub", cell: (s) => (s.published ? "✓" : "—") },
          { h: "Feat", cell: (s) => (s.featured ? "★" : "—") },
          { h: "Admin flag", cell: (s) => (s.unpublishedByAdmin ? <span><Badge variant="destructive">removed</Badge><span className="block max-w-48 text-muted-foreground">{s.unpublishedReason}</span></span> : "—") },
          {
            h: "Actions",
            cell: (s) => (
              <div className="flex flex-wrap items-start gap-1">
                <Link href={`/s/${s.id}`} className="h-7 rounded bg-muted px-2 leading-7">Page</Link>
                <Link href={`/play/${s.id}`} className="h-7 rounded bg-muted px-2 leading-7">Play</Link>
                <ActionButton action={setServiceFeaturedAction} fields={{ serviceId: s.id, value: String(!s.featured) }}>{s.featured ? "Unfeature" : "Feature"}</ActionButton>
                {s.unpublishedByAdmin ? (
                  <ActionButton action={restoreServiceAction} fields={{ serviceId: s.id }} variant="primary">Restore</ActionButton>
                ) : (
                  <form action={unpublishServiceAction} className="inline-flex gap-1">
                    <input type="hidden" name="serviceId" value={s.id} />
                    <input name="reason" required placeholder="Reason" className="h-7 w-28 rounded border bg-muted px-1 text-[11px]" />
                    <button className="h-7 rounded bg-destructive/90 px-2 text-[11px] text-white">Unpublish</button>
                  </form>
                )}
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}
