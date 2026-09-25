"use server";

import bcrypt from "bcryptjs";
import { AuthError, CredentialsSignin } from "next-auth";
import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import type { Level, Prisma, Role, ServiceType } from "@prisma/client";
import { currentUser, ensureTeacherProfile, isTeacher, requireTeacher, requireUser, signIn, signOut } from "@/lib/auth";
import { db } from "@/lib/db";
import { durationError, MAX_SECTIONS } from "@/lib/categories";
import { deleteBlocker } from "@/lib/lessons";
import { createDirectUpload, deleteMuxAsset, muxEnabled, muxUploadBelongsTo } from "@/lib/mux";
import { LEVELS, TYPES } from "@/lib/utils";

export type FormState = { error?: string; ok?: string; values?: Record<string, string> } | undefined;

/** Error + what the user typed (minus passwords), so the form can refill itself after React resets it. */
const fail = (f: FormData, error: string): FormState => ({
  error,
  values: Object.fromEntries([...f.entries()].filter(([k, v]) => typeof v === "string" && k !== "password" && !k.startsWith("$")) as [string, string][]),
});

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const safeNext = (n: string) => (n.startsWith("/") && !n.startsWith("//") ? n : "/explore");

// ---------- auth ----------

export async function loginAction(_: FormState, f: FormData): Promise<FormState> {
  const email = str(f, "email").toLowerCase();
  const next = str(f, "next");
  // Land by role unless we were sent here from a protected page.
  let redirectTo = next ? safeNext(next) : "/explore";
  if (!next) {
    const u = await db.user.findUnique({ where: { email }, select: { role: true } });
    if (u?.role === "ADMIN") redirectTo = "/admin";
    if (u?.role === "TEACHER" || u?.role === "BOTH") redirectTo = "/studio";
  }
  try {
    await signIn("credentials", { email, password: str(f, "password"), redirectTo });
  } catch (e) {
    if (e instanceof CredentialsSignin && e.code === "banned") return fail(f, "This account has been suspended. Contact support.");
    if (e instanceof AuthError) return fail(f, "Invalid email or password.");
    // Success is a NEXT_REDIRECT; BOTH users start in teacher mode.
    if (redirectTo === "/studio") (await cookies()).set("grooveup-mode", "teacher", { path: "/", sameSite: "lax" });
    throw e;
  }
}

export async function registerAction(_: FormState, f: FormData): Promise<FormState> {
  const name = str(f, "name");
  const email = str(f, "email").toLowerCase();
  const password = str(f, "password");
  // Registration can never create an ADMIN.
  const requested = str(f, "role");
  const role: Role = requested === "TEACHER" || requested === "BOTH" ? requested : "STUDENT";

  if (!name || !email.includes("@") || password.length < 8) return fail(f, "Name, valid email and 8+ character password required.");
  if (await db.user.findUnique({ where: { email } })) return fail(f, "An account with that email already exists.");

  const user = await db.user.create({ data: { name, email, role, passwordHash: await bcrypt.hash(password, 10) } });
  if (isTeacher(role)) await ensureTeacherProfile(user.id, name);
  if (role === "BOTH") (await cookies()).set("grooveup-mode", "teacher", { path: "/", sameSite: "lax" });

  await signIn("credentials", { email, password, redirectTo: isTeacher(role) ? "/studio" : "/explore" });
}

export async function logoutAction() {
  (await cookies()).delete("grooveup-mode");
  await signOut({ redirectTo: "/" });
}

export async function setModeAction(mode: "student" | "teacher") {
  const u = await requireUser();
  if (u.role !== "BOTH") return;
  (await cookies()).set("grooveup-mode", mode, { path: "/", sameSite: "lax" });
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

type ServiceInput = Omit<Prisma.ServiceUncheckedCreateInput, "teacherId" | "sections"> & {
  sections: { label: string; startSec: number; endSec: number }[];
};

/** Shared by create and update so the rules can't drift apart. Returns the data or an error message. */
async function parseServiceForm(f: FormData, teacherId: string, existing?: { muxUploadId: string | null }): Promise<ServiceInput | string> {
  const type = str(f, "type") as ServiceType;
  const level = str(f, "level") as Level;
  const title = str(f, "title");
  const durationSec = Math.max(0, Math.round((Number(str(f, "durationMin")) || 0) * 60 + (Number(str(f, "durationSec")) || 0)));
  const isFree = f.get("isFree") === "on" || type === "DEMO";
  const pricePaise = isFree ? 0 : Math.round(Number(str(f, "priceRupees")) * 100) || 0;
  // Course lessons are what a subscription buys.
  const includedInSub = f.get("includedInSub") === "on" || type === "SESSION";
  const muxUploadId = str(f, "muxUploadId") || null;
  const newUpload = muxUploadId && muxUploadId !== existing?.muxUploadId;
  const videoUrl = str(f, "videoUrl");
  const teaserUrl = str(f, "teaserUrl");
  const isUrl = (u: string) => /^https?:\/\//.test(u);

  if (!title || !TYPES.includes(type) || !LEVELS.includes(level)) return "Title, type and level are required.";
  const tooLong = durationError(type, durationSec);
  if (tooLong) return tooLong;
  if (!muxUploadId && !isUrl(videoUrl)) return "Upload a video or paste an http(s) video link.";
  if ((videoUrl && !isUrl(videoUrl)) || (teaserUrl && !isUrl(teaserUrl))) return "Video and teaser links must start with http(s)://";
  if (!isFree && !includedInSub && pricePaise <= 0) return "Paid lessons need a price, or include it in your course subscription.";
  // Upload ids come from the browser: make sure this teacher created it.
  if (newUpload && !(await muxUploadBelongsTo(muxUploadId, teacherId))) return "That video upload doesn't belong to you. Upload it again.";

  const sections = Array.from({ length: MAX_SECTIONS }, (_, i) => i + 1)
    .map((n) => ({ label: str(f, `s${n}label`), startSec: Number(str(f, `s${n}start`)) || 0, endSec: Number(str(f, `s${n}end`)) || 0 }))
    .filter((sec) => sec.label);
  if (sections.some((sec) => sec.endSec <= sec.startSec)) return "Each section must end after it starts.";

  return {
    title,
    type,
    level,
    style: str(f, "style") || "Hip-Hop",
    description: str(f, "description"),
    durationSec,
    teaserUrl,
    videoUrl,
    thumbnailUrl: str(f, "thumbnailUrl"),
    pricePaise,
    includedInSub,
    isFree,
    published: f.get("published") === "on",
    ...(newUpload ? { muxUploadId, muxAssetId: null, muxPlaybackId: null, videoStatus: "processing" } : {}),
    sections,
  };
}

/** Keep SUBSCRIPTION entitlements (used for My Floor) in step with includedInSub. Access itself is computed live. */
async function syncSubEntitlements(serviceId: string, teacherId: string, included: boolean) {
  await db.entitlement.deleteMany({ where: { serviceId, source: "SUBSCRIPTION" } });
  if (!included) return;
  const subs = await db.subscription.findMany({ where: { teacherId, status: "ACTIVE" } });
  if (subs.length)
    await db.entitlement.createMany({
      data: subs.map((sub) => ({ userId: sub.studentId, serviceId, teacherId, source: "SUBSCRIPTION" as const })),
    });
}

/** The teacher's own lesson, or null. */
async function ownService(id: string) {
  const u = await requireTeacher();
  const s = await db.service.findUnique({ where: { id }, include: { teacher: true } });
  return s && s.teacher.userId === u.id ? s : null;
}

export async function createServiceAction(_: FormState, f: FormData): Promise<FormState> {
  const u = await requireTeacher();
  const profile = await ensureTeacherProfile(u.id, u.name);
  const data = await parseServiceForm(f, profile.id);
  if (typeof data === "string") return fail(f, data);

  const { sections, ...fields } = data;
  const created = await db.service.create({ data: { ...fields, teacherId: profile.id, sections: { create: sections } } });
  // Existing subscribers get the new included lesson on their floor.
  if (created.includedInSub) await syncSubEntitlements(created.id, profile.id, true);
  revalidatePath("/", "layout");
  redirect("/studio");
}

export async function updateServiceAction(id: string, _: FormState, f: FormData): Promise<FormState> {
  const s = await ownService(id);
  if (!s) redirect("/studio");
  const data = await parseServiceForm(f, s.teacherId, s);
  if (typeof data === "string") return fail(f, data);

  const { sections, ...fields } = data;
  // An admin removal stays in force until an admin restores the lesson.
  if (s.unpublishedByAdmin) fields.published = false;
  await db.$transaction([
    db.serviceSection.deleteMany({ where: { serviceId: id } }),
    db.service.update({ where: { id }, data: { ...fields, sections: { create: sections } } }),
  ]);
  if (fields.muxUploadId && s.muxAssetId) await deleteMuxAsset(s.muxAssetId); // replaced video
  if (fields.includedInSub !== s.includedInSub) await syncSubEntitlements(id, s.teacherId, !!fields.includedInSub);
  revalidatePath("/", "layout");
  redirect("/studio");
}

export async function deleteServiceAction(id: string): Promise<FormState> {
  const s = await ownService(id);
  if (!s) return { error: "Lesson not found." };
  const blocker = await deleteBlocker(s);
  if (blocker) return { error: blocker };
  await db.service.delete({ where: { id } });
  await deleteMuxAsset(s.muxAssetId);
  revalidatePath("/", "layout");
  redirect("/studio");
}

/** Starts a direct browser → Mux upload for the signed-in teacher. */
export async function createMuxUploadAction(): Promise<{ id: string; url: string } | { error: string }> {
  const u = await requireTeacher();
  if (!muxEnabled()) return { error: "Video uploads aren't configured on this server." };
  const profile = await ensureTeacherProfile(u.id, u.name);
  const h = await headers();
  const origin = h.get("origin") ?? `https://${h.get("host")}`;
  try {
    return await createDirectUpload(origin, profile.id);
  } catch (e) {
    console.error(e);
    return { error: "Couldn't start the upload. Try again." };
  }
}

export async function togglePublishAction(serviceId: string) {
  const u = await requireTeacher();
  const s = await db.service.findUnique({ where: { id: serviceId }, include: { teacher: true } });
  if (!s || s.teacher.userId !== u.id) return;
  if (s.unpublishedByAdmin) return; // locked until an admin restores it
  await db.service.update({ where: { id: serviceId }, data: { published: !s.published } });
  revalidatePath("/", "layout");
}
