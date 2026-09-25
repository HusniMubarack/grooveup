import type { Prisma, Service, TeacherProfile, User } from "@prisma/client";
import { db } from "./db";
import type { SessionUser } from "./auth";

/** Services a member of the public may see (explore, teacher pages). */
export const publicServiceWhere: Prisma.ServiceWhereInput = {
  published: true,
  unpublishedByAdmin: false,
  teacher: { user: { banned: false } },
};

type ServiceWithTeacher = Service & { teacher: TeacherProfile & { user: Pick<User, "banned"> } };

export function isServiceLive(s: ServiceWithTeacher) {
  return s.published && !s.unpublishedByAdmin && !s.teacher.user.banned;
}

export function isFreeToWatch(s: Pick<Service, "isFree" | "type">) {
  return s.isFree || s.type === "DEMO";
}

/** A subscription that currently grants access (null period end = never expires). */
export const activeSubWhere = (): Prisma.SubscriptionWhereInput => ({
  status: "ACTIVE",
  OR: [{ currentPeriodEnd: null }, { currentPeriodEnd: { gt: new Date() } }],
});

/** A purchase/free grant that hasn't expired. */
export const liveGrantWhere = (): Prisma.EntitlementWhereInput => ({
  source: { in: ["PURCHASE", "FREE"] },
  OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
});

/** Server-side play rule. Admins and the owner may always preview. */
export async function canPlay(user: SessionUser | null, s: ServiceWithTeacher): Promise<boolean> {
  if (user?.role === "ADMIN") return true;
  if (user && s.teacher.userId === user.id) return true;
  if (!isServiceLive(s)) return false;
  if (isFreeToWatch(s)) return true;
  if (!user) return false;

  const bought = await db.entitlement.findFirst({
    where: { userId: user.id, serviceId: s.id, ...liveGrantWhere() },
  });
  if (bought) return true;

  if (s.includedInSub) {
    const sub = await db.subscription.findFirst({
      where: { studentId: user.id, teacherId: s.teacherId, ...activeSubWhere() },
    });
    if (sub) return true;
  }
  return false;
}
