import { db } from "./db";

/** Why a lesson can't be deleted, or null if nobody has it yet. */
export async function deleteBlocker(s: { id: string; teacherId: string; includedInSub: boolean }): Promise<string | null> {
  const [bought, practiced, orders, subs, requested] = await Promise.all([
    db.entitlement.count({ where: { serviceId: s.id, source: "PURCHASE" } }),
    db.practiceEvent.count({ where: { serviceId: s.id } }),
    db.order.count({ where: { serviceId: s.id } }),
    s.includedInSub ? db.subscription.count({ where: { teacherId: s.teacherId, status: "ACTIVE" } }) : 0,
    db.accessRequest.count({ where: { serviceId: s.id, status: "PENDING" } }),
  ]);
  if (requested) return "A student has a pending request for this lesson. Approve or decline it first.";
  if (bought || orders) return "Students have bought this lesson. Unpublish it instead.";
  if (subs) return "Your course subscribers have this lesson. Unpublish it instead.";
  if (practiced) return "Students have practiced this lesson. Unpublish it instead.";
  return null;
}
