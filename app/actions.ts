"use server";

import bcrypt from "bcryptjs";
import { AuthError, CredentialsSignin } from "next-auth";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Level, Role, ServiceType } from "@prisma/client";
import { currentUser, ensureTeacherProfile, isTeacher, requireTeacher, requireUser, signIn, signOut } from "@/lib/auth";
import { db } from "@/lib/db";
import { LEVELS, TYPES } from "@/lib/utils";

export type FormState = { error?: string; ok?: string } | undefined;

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const safeNext = (n: string) => (n.startsWith("/") && !n.startsWith("//") ? n : "/explore");

// ---------- auth ----------

export async function loginAction(_: FormState, f: FormData): Promise<FormState> {
  try {
    await signIn("credentials", { email: str(f, "email"), password: str(f, "password"), redirectTo: safeNext(str(f, "next")) });
  } catch (e) {
    if (e instanceof CredentialsSignin && e.code === "banned") return { error: "This account has been suspended. Contact support." };
    if (e instanceof AuthError) return { error: "Invalid email or password." };
    throw e; // NEXT_REDIRECT on success
  }
}

export async function registerAction(_: FormState, f: FormData): Promise<FormState> {
  const name = str(f, "name");
  const email = str(f, "email").toLowerCase();
  const password = str(f, "password");
  // Registration can never create an ADMIN.
  const requested = str(f, "role");
  const role: Role = requested === "TEACHER" || requested === "BOTH" ? requested : "STUDENT";

  if (!name || !email.includes("@") || password.length < 8) return { error: "Name, valid email and 8+ character password required." };
  if (await db.user.findUnique({ where: { email } })) return { error: "An account with that email already exists." };

  const user = await db.user.create({ data: { name, email, role, passwordHash: await bcrypt.hash(password, 10) } });
  if (isTeacher(role)) await ensureTeacherProfile(user.id, name);
  if (role === "BOTH") (await cookies()).set("atelier-mode", "teacher", { path: "/", sameSite: "lax" });

  await signIn("credentials", { email, password, redirectTo: isTeacher(role) ? "/studio" : "/explore" });
}

export async function logoutAction() {
  (await cookies()).delete("atelier-mode");
  await signOut({ redirectTo: "/" });
}

export async function setModeAction(mode: "student" | "teacher") {
  const u = await requireUser();
  if (u.role !== "BOTH") return;
  (await cookies()).set("atelier-mode", mode, { path: "/", sameSite: "lax" });
  redirect(mode === "teacher" ? "/studio" : "/explore");
}

// ---------- student ----------

export async function toggleFollowAction(teacherId: string, handle: string) {
  const u = await requireUser(`/t/${handle}`);
  const key = { studentId_teacherId: { studentId: u.id, teacherId } };
  if (await db.follow.findUnique({ where: key })) await db.follow.delete({ where: key });
  else await db.follow.create({ data: { studentId: u.id, teacherId } });
  revalidatePath(`/t/${handle}`);
}

/** The one mock payment action. kind=SUBSCRIPTION (id = teacherProfileId) or SERVICE (id = serviceId). */
export async function payAction(f: FormData) {
  const kind = str(f, "kind");
  const id = str(f, "id");
  const back = safeNext(str(f, "back"));
  const u = await requireUser(back);

  if (kind === "SUBSCRIPTION") {
    const teacher = await db.teacherProfile.findUnique({
      where: { id },
      include: { user: true, services: { where: { includedInSub: true } } },
    });
    if (!teacher || teacher.user.banned || teacher.userId === u.id) redirect(back);
    const periodEnd = new Date(Date.now() + 30 * 86400000);
    const existing = await db.subscription.findFirst({ where: { studentId: u.id, teacherId: id } });
    await db.$transaction([
      existing
        ? db.subscription.update({ where: { id: existing.id }, data: { status: "ACTIVE", currentPeriodEnd: periodEnd } })
        : db.subscription.create({ data: { studentId: u.id, teacherId: id, status: "ACTIVE", currentPeriodEnd: periodEnd } }),
      db.order.create({ data: { studentId: u.id, type: "SUBSCRIPTION", amountPaise: teacher.monthlyPricePaise, teacherId: id } }),
      db.entitlement.deleteMany({ where: { userId: u.id, teacherId: id, source: "SUBSCRIPTION" } }),
      db.entitlement.createMany({
        data: teacher.services.map((s) => ({ userId: u.id, serviceId: s.id, teacherId: id, source: "SUBSCRIPTION" as const })),
      }),
    ]);
  } else if (kind === "SERVICE") {
    const s = await db.service.findUnique({ where: { id }, include: { teacher: { include: { user: true } } } });
    if (!s || !s.published || s.unpublishedByAdmin || s.teacher.user.banned || s.pricePaise <= 0) redirect(back);
    const owned = await db.entitlement.findFirst({ where: { userId: u.id, serviceId: id, source: "PURCHASE" } });
    if (!owned) {
      await db.$transaction([
        db.order.create({ data: { studentId: u.id, type: "SERVICE", amountPaise: s.pricePaise, teacherId: s.teacherId, serviceId: id } }),
        db.entitlement.create({ data: { userId: u.id, serviceId: id, teacherId: s.teacherId, source: "PURCHASE" } }),
      ]);
    }
  }
  revalidatePath("/", "layout");
  redirect(back);
}

export async function cancelSubAction(subId: string) {
  const u = await requireUser("/me");
  const sub = await db.subscription.findUnique({ where: { id: subId } });
  if (!sub || sub.studentId !== u.id) return;
  await db.$transaction([
    db.subscription.update({ where: { id: subId }, data: { status: "CANCELED" } }),
    // Sub-derived unlocks go away; PURCHASE entitlements are untouched.
    db.entitlement.deleteMany({ where: { userId: u.id, teacherId: sub.teacherId, source: "SUBSCRIPTION" } }),
  ]);
  revalidatePath("/me");
}

export async function savePracticeAction(serviceId: string, lastSec: number, completed: boolean) {
  const u = await currentUser();
  if (!u) return;
  const sec = Math.max(0, Math.floor(lastSec));
  await db.practiceEvent.upsert({
    where: { userId_serviceId: { userId: u.id, serviceId } },
    create: { userId: u.id, serviceId, lastSec: sec, completed },
    // Once completed, stay completed.
    update: { lastSec: sec, ...(completed ? { completed: true } : {}) },
  });
}

export async function reportAction(_: FormState, f: FormData): Promise<FormState> {
  const u = await currentUser();
  if (!u) return { error: "Sign in to report." };
  const targetType = str(f, "targetType") === "USER" ? "USER" : "SERVICE";
  const targetId = str(f, "targetId");
  const reason = str(f, "reason");
  if (!["spam", "copyright", "inappropriate", "other"].includes(reason)) return { error: "Pick a reason." };
  const note = str(f, "note").slice(0, 500);
  await db.report.create({
    data: {
      reporterId: u.id,
      targetType,
      targetUserId: targetType === "USER" ? targetId : null,
      targetServiceId: targetType === "SERVICE" ? targetId : null,
      reason: note ? `${reason} — ${note}` : reason,
    },
  });
  return { ok: "Thanks — our moderators will take a look." };
}

// ---------- teacher ----------

export async function createServiceAction(_: FormState, f: FormData): Promise<FormState> {
  const u = await requireTeacher();
  const profile = await ensureTeacherProfile(u.id, u.name);

  const type = str(f, "type") as ServiceType;
  const level = str(f, "level") as Level;
  const title = str(f, "title");
  const durationSec = Math.round(Number(str(f, "durationMin")) * 60) || 0;
  const isFree = f.get("isFree") === "on" || type === "DEMO";
  const pricePaise = isFree ? 0 : Math.round(Number(str(f, "priceRupees")) * 100) || 0;
  const includedInSub = f.get("includedInSub") === "on";

  if (!title || !TYPES.includes(type) || !LEVELS.includes(level)) return { error: "Title, type and level are required." };
  if (!str(f, "videoUrl").startsWith("http") || !str(f, "teaserUrl").startsWith("http")) return { error: "Teaser and video URLs must be http(s) links." };
  if (!isFree && !includedInSub && pricePaise <= 0) return { error: "Paid lessons need a price, or include it in your subscription." };

  const sections = [1, 2]
    .map((n) => ({ label: str(f, `s${n}label`), startSec: Number(str(f, `s${n}start`)) || 0, endSec: Number(str(f, `s${n}end`)) || 0 }))
    .filter((s) => s.label);

  await db.service.create({
    data: {
      teacherId: profile.id,
      title,
      type,
      level,
      style: str(f, "style") || "Hip-Hop",
      description: str(f, "description"),
      durationSec,
      teaserUrl: str(f, "teaserUrl"),
      videoUrl: str(f, "videoUrl"),
      thumbnailUrl: str(f, "thumbnailUrl"),
      pricePaise,
      includedInSub,
      isFree,
      published: f.get("published") === "on",
      sections: { create: sections },
    },
  });
  // Existing subscribers get the new included lesson on their floor.
  if (includedInSub) {
    const created = await db.service.findFirst({ where: { teacherId: profile.id }, orderBy: { createdAt: "desc" } });
    const subs = await db.subscription.findMany({ where: { teacherId: profile.id, status: "ACTIVE" } });
    if (created && subs.length)
      await db.entitlement.createMany({
        data: subs.map((s) => ({ userId: s.studentId, serviceId: created.id, teacherId: profile.id, source: "SUBSCRIPTION" as const })),
      });
  }
  revalidatePath("/", "layout");
  redirect("/studio");
}

export async function togglePublishAction(serviceId: string) {
  const u = await requireTeacher();
  const s = await db.service.findUnique({ where: { id: serviceId }, include: { teacher: true } });
  if (!s || s.teacher.userId !== u.id) return;
  if (s.unpublishedByAdmin) return; // locked until an admin restores it
  await db.service.update({ where: { id: serviceId }, data: { published: !s.published } });
  revalidatePath("/", "layout");
}
