import { activeSubWhere, liveGrantWhere } from "./access";
import { db } from "./db";
import { timeAgo } from "./utils";

export type ExpiryChoice = "never" | "1m" | "2m" | "3m" | "days";

/** Teacher's expiry choice → end date (null = never expires). */
export function expiryFrom(choice: string, days?: number): Date | null {
  const d = new Date();
  if (choice === "1m" || choice === "2m" || choice === "3m") {
    d.setMonth(d.getMonth() + Number(choice[0]));
    return d;
  }
  if (choice === "days" && days && days > 0) return new Date(Date.now() + Math.min(days, 3650) * 86400000);
  return null;
}

/** What a student currently has with this teacher/lesson: access, a pending request, or nothing. */
export async function requestState(studentId: string, teacherId: string, serviceId: string | null) {
  const [access, pending] = await Promise.all([
    serviceId
      ? db.entitlement.findFirst({ where: { userId: studentId, serviceId, ...liveGrantWhere() }, select: { expiresAt: true } })
      : db.subscription.findFirst({ where: { studentId, teacherId, ...activeSubWhere() }, select: { currentPeriodEnd: true } }),
    db.accessRequest.findFirst({ where: { studentId, teacherId, serviceId, status: "PENDING" }, orderBy: { createdAt: "desc" } }),
  ]);
  const until = access ? ("expiresAt" in access ? access.expiresAt : access.currentPeriodEnd) : undefined;
  return { hasAccess: !!access, until, pending };
}

/** Server-side props for <RequestAccess>: whether there's already a pending request. */
export async function requestPanel(studentId: string, teacherId: string, serviceId: string | null) {
  const state = await requestState(studentId, teacherId, serviceId);
  return {
    hasAccess: state.hasAccess,
    pending: state.pending ? { id: state.pending.id, sentAgo: timeAgo(state.pending.createdAt) } : null,
  };
}
