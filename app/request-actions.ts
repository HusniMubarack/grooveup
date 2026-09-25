"use server";

import { revalidatePath } from "next/cache";
import { currentUser, requireTeacher, requireUser } from "@/lib/auth";
import { systemMessage } from "@/lib/chat";
import { db } from "@/lib/db";
import { expiryFrom, isUpiId, requestState } from "@/lib/requests";
import { fmtUntil, rupees } from "@/lib/utils";
import type { FormState } from "@/app/actions";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const refresh = () => revalidatePath("/", "layout");

async function myTeacherProfile() {
  const u = await requireTeacher();
  const t = await db.teacherProfile.findUnique({ where: { userId: u.id } });
  if (!t) throw new Error("No teacher profile");
  return t;
}

// ---------- student ----------

/** Student asks for a teacher's course (no serviceId) or one lesson, after paying them outside the app. */
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

  const paymentRef = str(f, "paymentRef").slice(0, 80) || null;
  const note = str(f, "note").slice(0, 500) || null;
  await db.accessRequest.create({ data: { studentId: u.id, teacherId: teacher.id, serviceId, amountPaise, paymentRef, note } });
  await systemMessage(
    u.id,
    teacher.id,
    `Access requested for ${item} · ${rupees(amountPaise)}${paymentRef ? ` · UPI ref ${paymentRef}` : ""}${note ? `\n“${note}”` : ""}`,
  );
  refresh();
  return { ok: "Request sent. The teacher will confirm your payment and unlock it." };
}

export async function cancelRequestAction(requestId: string) {
  const u = await requireUser();
  const r = await db.accessRequest.findUnique({ where: { id: requestId }, include: { service: true } });
  if (!r || r.studentId !== u.id || r.status !== "PENDING") return;
  await db.accessRequest.update({ where: { id: requestId }, data: { status: "CANCELED", decidedAt: new Date() } });
  await systemMessage(r.studentId, r.teacherId, `Request for ${r.service ? `“${r.service.title}”` : "the course"} withdrawn by the student.`);
  refresh();
}

// ---------- teacher ----------

/** Re-create a student's SUBSCRIPTION entitlements (used for My Floor) for a teacher's included lessons. */
async function syncStudentSubEntitlements(studentId: string, teacherId: string, active: boolean) {
  await db.entitlement.deleteMany({ where: { userId: studentId, teacherId, source: "SUBSCRIPTION" } });
  if (!active) return;
  const lessons = await db.service.findMany({ where: { teacherId, includedInSub: true }, select: { id: true } });
  if (lessons.length)
    await db.entitlement.createMany({ data: lessons.map((l) => ({ userId: studentId, serviceId: l.id, teacherId, source: "SUBSCRIPTION" as const })) });
}

export async function approveRequestAction(_: FormState, f: FormData): Promise<FormState> {
  const t = await myTeacherProfile();
  const r = await db.accessRequest.findUnique({ where: { id: str(f, "requestId") }, include: { service: true } });
  if (!r || r.teacherId !== t.id) return { error: "Request not found." };
  if (r.status !== "PENDING") return { error: "This request was already handled." };

  const choice = str(f, "expiry") || (r.serviceId ? "never" : "1m");
  const until = expiryFrom(choice, Number(str(f, "days")) || undefined);
  if (choice === "days" && !until) return { error: "Enter the number of days." };

  if (r.serviceId) {
    const existing = await db.entitlement.findFirst({ where: { userId: r.studentId, serviceId: r.serviceId, source: "PURCHASE" } });
    if (existing) await db.entitlement.update({ where: { id: existing.id }, data: { expiresAt: until } });
    else await db.entitlement.create({ data: { userId: r.studentId, serviceId: r.serviceId, teacherId: t.id, source: "PURCHASE", expiresAt: until } });
  } else {
    const sub = await db.subscription.findFirst({ where: { studentId: r.studentId, teacherId: t.id } });
    if (sub) await db.subscription.update({ where: { id: sub.id }, data: { status: "ACTIVE", currentPeriodEnd: until } });
    else await db.subscription.create({ data: { studentId: r.studentId, teacherId: t.id, status: "ACTIVE", currentPeriodEnd: until } });
    await syncStudentSubEntitlements(r.studentId, t.id, true);
  }
  await db.$transaction([
    db.order.create({
      data: {
        studentId: r.studentId, teacherId: t.id, serviceId: r.serviceId, amountPaise: r.amountPaise, method: "UPI",
        type: r.serviceId ? "SERVICE" : "SUBSCRIPTION",
      },
    }),
    db.accessRequest.update({ where: { id: r.id }, data: { status: "APPROVED", accessUntil: until, decidedAt: new Date() } }),
  ]);
  await systemMessage(r.studentId, t.id, `Access granted to ${r.service ? `“${r.service.title}”` : "the course"} · ${until ? `until ${fmtUntil(until)}` : "no expiry"}. Enjoy!`);
  refresh();
  return { ok: "Approved" };
}

export async function declineRequestAction(f: FormData) {
  const t = await myTeacherProfile();
  const r = await db.accessRequest.findUnique({ where: { id: str(f, "requestId") }, include: { service: true } });
  if (!r || r.teacherId !== t.id || r.status !== "PENDING") return;
  const reason = str(f, "reason").slice(0, 300) || null;
  await db.accessRequest.update({ where: { id: r.id }, data: { status: "DECLINED", decisionNote: reason, decidedAt: new Date() } });
  await systemMessage(r.studentId, t.id, `Request for ${r.service ? `“${r.service.title}”` : "the course"} declined${reason ? `: ${reason}` : "."}`);
  refresh();
}

/** End a student's course subscription (subId) or lesson access (entitlementId) early. */
export async function endAccessAction(f: FormData) {
  const t = await myTeacherProfile();
  const subId = str(f, "subId");
  const entitlementId = str(f, "entitlementId");
  if (subId) {
    const sub = await db.subscription.findUnique({ where: { id: subId } });
    if (!sub || sub.teacherId !== t.id) return;
    await db.subscription.update({ where: { id: sub.id }, data: { status: "CANCELED", currentPeriodEnd: new Date() } });
    await syncStudentSubEntitlements(sub.studentId, t.id, false);
    await systemMessage(sub.studentId, t.id, "Course access ended by the teacher.");
  } else if (entitlementId) {
    const e = await db.entitlement.findUnique({ where: { id: entitlementId }, include: { service: true } });
    if (!e || e.teacherId !== t.id || e.source !== "PURCHASE") return;
    await db.entitlement.update({ where: { id: e.id }, data: { expiresAt: new Date() } });
    await systemMessage(e.userId, t.id, `Access to “${e.service?.title ?? "lesson"}” ended by the teacher.`);
  }
  refresh();
}

/** Payment details students see when requesting access, plus the monthly course price. */
export async function savePaymentDetailsAction(_: FormState, f: FormData): Promise<FormState> {
  const t = await myTeacherProfile();
  const upiId = str(f, "upiId");
  if (upiId && !isUpiId(upiId)) return { error: "That doesn't look like a UPI ID (e.g. yourname@okaxis)." };
  const rupeesPerMonth = Number(str(f, "coursePrice"));
  if (!Number.isFinite(rupeesPerMonth) || rupeesPerMonth < 0 || rupeesPerMonth > 100000) return { error: "Enter a course price in rupees." };
  await db.teacherProfile.update({
    where: { id: t.id },
    data: { upiId: upiId || null, showUpiQr: f.get("showUpiQr") === "on", monthlyPricePaise: Math.round(rupeesPerMonth * 100) },
  });
  refresh();
  return { ok: "Saved" };
}
