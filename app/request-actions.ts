"use server";

import { revalidatePath } from "next/cache";
import { currentUser, requireTeacher, requireUser } from "@/lib/auth";
import { systemMessage } from "@/lib/chat";
import { db } from "@/lib/db";
import { grantAccess, syncStudentSubEntitlements } from "@/lib/grant";
import { expiryFrom, requestState } from "@/lib/requests";
import { rupees } from "@/lib/utils";
import type { FormState } from "@/app/actions";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const refresh = () => revalidatePath("/", "layout");

/** Who may decide on a teacher's requests: that teacher, or any admin. */
async function decider(teacherId: string) {
  const u = await requireUser();
  if (u.role === "ADMIN") return { userId: u.id, admin: true };
  const t = await db.teacherProfile.findUnique({ where: { userId: u.id }, select: { id: true } });
  return t?.id === teacherId ? { userId: u.id, admin: false } : null;
}

async function audit(adminId: string, action: string, detail: string) {
  await db.auditLog.create({ data: { adminId, action, detail } });
}

// ---------- student ----------

/** Student asks for a teacher's course (no serviceId) or one lesson; the teacher or an admin approves it. */
export async function requestAccessAction(_: FormState, f: FormData): Promise<FormState> {
  const u = await currentUser();
  if (!u) return { error: "Sign in to request access." };
  const teacher = await db.teacherProfile.findUnique({ where: { id: str(f, "teacherId") }, include: { user: true } });
  if (!teacher || teacher.user.banned) return { error: "This teacher isn't available." };
  if (teacher.userId === u.id) return { error: "You can't request your own lessons." };

  const serviceId = str(f, "serviceId") || null;
  let amountPaise = teacher.monthlyPricePaise;
  let item = "the course";
  if (serviceId) {
    const s = await db.service.findUnique({ where: { id: serviceId } });
    if (!s || s.teacherId !== teacher.id || !s.published || s.unpublishedByAdmin) return { error: "This lesson isn't available." };
    if (s.pricePaise <= 0) return { error: "This lesson is only available through the course." };
    amountPaise = s.pricePaise;
    item = `“${s.title}”`;
  }

  const state = await requestState(u.id, teacher.id, serviceId);
  if (state.hasAccess) return { error: "You already have access." };
  if (state.pending) return { error: "You already have a pending request for this." };

  const note = str(f, "note").slice(0, 500) || null;
  await db.accessRequest.create({ data: { studentId: u.id, teacherId: teacher.id, serviceId, amountPaise, note } });
  await systemMessage(u.id, teacher.id, `Access requested for ${item} · ${rupees(amountPaise)}${note ? `\n“${note}”` : ""}`);
  refresh();
  return { ok: "Request sent. You'll get access as soon as it's approved." };
}

export async function cancelRequestAction(requestId: string) {
  const u = await requireUser();
  const r = await db.accessRequest.findUnique({ where: { id: requestId }, include: { service: true } });
  if (!r || r.studentId !== u.id || r.status !== "PENDING") return;
  await db.accessRequest.update({ where: { id: requestId }, data: { status: "CANCELED", decidedAt: new Date() } });
  await systemMessage(r.studentId, r.teacherId, `Request for ${r.service ? `“${r.service.title}”` : "the course"} withdrawn by the student.`);
  refresh();
}

// ---------- teacher or admin ----------

export async function approveRequestAction(_: FormState, f: FormData): Promise<FormState> {
  const r = await db.accessRequest.findUnique({ where: { id: str(f, "requestId") }, include: { service: { select: { title: true } }, student: { select: { email: true } } } });
  if (!r) return { error: "Request not found." };
  const who = await decider(r.teacherId);
  if (!who) return { error: "Request not found." };
  if (r.status !== "PENDING") return { error: "This request was already handled." };

  const choice = str(f, "expiry") || (r.serviceId ? "never" : "1m");
  const until = expiryFrom(choice, Number(str(f, "days")) || undefined);
  if (choice === "days" && !until) return { error: "Enter the number of days." };

  await grantAccess(r, until, who.admin ? "admin" : "teacher");
  if (who.admin) await audit(who.userId, "request.approve", `${r.student.email} → ${r.service?.title ?? "course"} (${choice === "days" ? `${str(f, "days")} days` : choice})`);
  refresh();
  return { ok: "Approved" };
}

export async function declineRequestAction(f: FormData) {
  const r = await db.accessRequest.findUnique({ where: { id: str(f, "requestId") }, include: { service: true, student: { select: { email: true } } } });
  if (!r || r.status !== "PENDING") return;
  const who = await decider(r.teacherId);
  if (!who) return;
  const reason = str(f, "reason").slice(0, 300) || null;
  await db.accessRequest.update({ where: { id: r.id }, data: { status: "DECLINED", decisionNote: reason, decidedAt: new Date() } });
  await systemMessage(r.studentId, r.teacherId, `Request for ${r.service ? `“${r.service.title}”` : "the course"} declined${who.admin ? " by Groove up" : ""}${reason ? `: ${reason}` : "."}`);
  if (who.admin) await audit(who.userId, "request.decline", `${r.student.email} → ${r.service?.title ?? "course"}${reason ? ` (${reason})` : ""}`);
  refresh();
}

/** End a student's course subscription (subId) or lesson access (entitlementId) early. */
export async function endAccessAction(f: FormData) {
  const subId = str(f, "subId");
  const entitlementId = str(f, "entitlementId");
  if (subId) {
    const sub = await db.subscription.findUnique({ where: { id: subId } });
    if (!sub || !(await decider(sub.teacherId))) return;
    await db.subscription.update({ where: { id: sub.id }, data: { status: "CANCELED", currentPeriodEnd: new Date() } });
    await syncStudentSubEntitlements(sub.studentId, sub.teacherId, false);
    await systemMessage(sub.studentId, sub.teacherId, "Course access ended.");
  } else if (entitlementId) {
    const e = await db.entitlement.findUnique({ where: { id: entitlementId }, include: { service: true } });
    if (!e || !e.teacherId || e.source !== "PURCHASE" || !(await decider(e.teacherId))) return;
    await db.entitlement.update({ where: { id: e.id }, data: { expiresAt: new Date() } });
    await systemMessage(e.userId, e.teacherId, `Access to “${e.service?.title ?? "lesson"}” ended.`);
  }
  refresh();
}

/** Monthly course price (what a course request costs). */
export async function saveCoursePriceAction(_: FormState, f: FormData): Promise<FormState> {
  const u = await requireTeacher();
  const t = await db.teacherProfile.findUnique({ where: { userId: u.id } });
  if (!t) return { error: "No teacher profile." };
  const rupeesPerMonth = Number(str(f, "coursePrice"));
  if (!Number.isFinite(rupeesPerMonth) || rupeesPerMonth < 0 || rupeesPerMonth > 100000) return { error: "Enter a price in rupees." };
  await db.teacherProfile.update({ where: { id: t.id }, data: { monthlyPricePaise: Math.round(rupeesPerMonth * 100) } });
  refresh();
  return { ok: "Saved" };
}
