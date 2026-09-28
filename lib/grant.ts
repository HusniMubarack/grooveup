import type { AccessRequest } from "@prisma/client";
import { systemMessage } from "./chat";
import { db } from "./db";
import { fmtUntil } from "./utils";

/** Re-create a student's SUBSCRIPTION entitlements (used for My Floor) for a teacher's included lessons. */
export async function syncStudentSubEntitlements(studentId: string, teacherId: string, active: boolean) {
  await db.entitlement.deleteMany({ where: { userId: studentId, teacherId, source: "SUBSCRIPTION" } });
  if (!active) return;
  const lessons = await db.service.findMany({ where: { teacherId, includedInSub: true }, select: { id: true } });
  if (lessons.length)
    await db.entitlement.createMany({ data: lessons.map((l) => ({ userId: studentId, serviceId: l.id, teacherId, source: "SUBSCRIPTION" as const })) });
}

export type GrantedBy = "teacher" | "admin" | "payment";

/**
 * Unlock what a request asked for: the teacher's course (subscription) or one lesson (entitlement),
 * until `until` (null = never). Used by teacher/admin approvals today and by the payment gateway later.
 */
export async function grantAccess(r: AccessRequest & { service: { title: string } | null }, until: Date | null, by: GrantedBy, method = "MANUAL") {
  if (r.serviceId) {
    const existing = await db.entitlement.findFirst({ where: { userId: r.studentId, serviceId: r.serviceId, source: "PURCHASE" } });
    if (existing) await db.entitlement.update({ where: { id: existing.id }, data: { expiresAt: until } });
    else await db.entitlement.create({ data: { userId: r.studentId, serviceId: r.serviceId, teacherId: r.teacherId, source: "PURCHASE", expiresAt: until } });
  } else {
    const sub = await db.subscription.findFirst({ where: { studentId: r.studentId, teacherId: r.teacherId } });
    if (sub) await db.subscription.update({ where: { id: sub.id }, data: { status: "ACTIVE", currentPeriodEnd: until } });
    else await db.subscription.create({ data: { studentId: r.studentId, teacherId: r.teacherId, status: "ACTIVE", currentPeriodEnd: until } });
    await syncStudentSubEntitlements(r.studentId, r.teacherId, true);
  }
  await db.$transaction([
    db.order.create({
      data: {
        studentId: r.studentId, teacherId: r.teacherId, serviceId: r.serviceId, amountPaise: r.amountPaise, method,
        type: r.serviceId ? "SERVICE" : "SUBSCRIPTION",
      },
    }),
    db.accessRequest.update({ where: { id: r.id }, data: { status: "APPROVED", accessUntil: until, decidedAt: new Date() } }),
  ]);
  const who = by === "admin" ? " by Groove up" : by === "payment" ? " after payment" : "";
  await systemMessage(r.studentId, r.teacherId, `Access granted${who} to ${r.service ? `“${r.service.title}”` : "the course"} · ${until ? `until ${fmtUntil(until)}` : "no expiry"}. Enjoy!`);
}
