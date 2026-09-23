"use server";

import { revalidatePath } from "next/cache";
import type { Role } from "@prisma/client";
import { ensureTeacherProfile, requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

async function audit(adminId: string, action: string, detail: string) {
  await db.auditLog.create({ data: { adminId, action, detail } });
  revalidatePath("/", "layout");
}

async function nonAdminUser(id: string) {
  const u = await db.user.findUnique({ where: { id }, include: { teacherProfile: true } });
  return u && u.role !== "ADMIN" ? u : null;
}

export async function setBannedAction(f: FormData) {
  const admin = await requireAdmin();
  const user = await nonAdminUser(str(f, "userId"));
  if (!user) return;
  const banned = str(f, "banned") === "true";
  await db.user.update({ where: { id: user.id }, data: { banned } });
  await audit(admin.id, banned ? "user.ban" : "user.unban", `${user.email}`);
}

export async function setRoleAction(f: FormData) {
  const admin = await requireAdmin();
  const user = await nonAdminUser(str(f, "userId"));
  const role = str(f, "role") as Role;
  // Never promote to ADMIN from the UI.
  if (!user || !["STUDENT", "TEACHER", "BOTH"].includes(role) || role === user.role) return;
  await db.user.update({ where: { id: user.id }, data: { role } });
  if (role !== "STUDENT") await ensureTeacherProfile(user.id, user.name);
  await audit(admin.id, "user.role", `${user.email}: ${user.role} → ${role}`);
}

export async function setTeacherFlagAction(f: FormData) {
  const admin = await requireAdmin();
  const flag = str(f, "flag");
  if (flag !== "verified" && flag !== "featured") return;
  const value = str(f, "value") === "true";
  const t = await db.teacherProfile.update({ where: { id: str(f, "teacherId") }, data: { [flag]: value } });
  await audit(admin.id, `teacher.${value ? "" : "un"}${flag === "verified" ? "verify" : "feature"}`, `@${t.handle}`);
}

export async function unpublishServiceAction(f: FormData) {
  const admin = await requireAdmin();
  const reason = str(f, "reason");
  if (!reason) return;
  const s = await db.service.update({
    where: { id: str(f, "serviceId") },
    data: { published: false, unpublishedByAdmin: true, unpublishedReason: reason },
  });
  await audit(admin.id, "service.unpublish", `${s.title} — ${reason}`);
}

export async function restoreServiceAction(f: FormData) {
  const admin = await requireAdmin();
  const s = await db.service.update({
    where: { id: str(f, "serviceId") },
    data: { published: true, unpublishedByAdmin: false, unpublishedReason: null },
  });
  await audit(admin.id, "service.restore", s.title);
}

export async function setServiceFeaturedAction(f: FormData) {
  const admin = await requireAdmin();
  const featured = str(f, "value") === "true";
  const s = await db.service.update({ where: { id: str(f, "serviceId") }, data: { featured } });
  await audit(admin.id, featured ? "service.feature" : "service.unfeature", s.title);
}

export async function cancelSubscriptionAction(f: FormData) {
  const admin = await requireAdmin();
  const sub = await db.subscription.findUnique({
    where: { id: str(f, "subId") },
    include: { student: true, teacher: true },
  });
  if (!sub || sub.status !== "ACTIVE") return;
  await db.$transaction([
    db.subscription.update({ where: { id: sub.id }, data: { status: "CANCELED" } }),
    db.entitlement.deleteMany({ where: { userId: sub.studentId, teacherId: sub.teacherId, source: "SUBSCRIPTION" } }),
  ]);
  await audit(admin.id, "subscription.cancel", `${sub.student.email} → @${sub.teacher.handle}`);
}

/** Resolve or dismiss a report, optionally unpublishing the service / banning the user in one go. */
export async function closeReportAction(f: FormData) {
  const admin = await requireAdmin();
  const report = await db.report.findUnique({
    where: { id: str(f, "reportId") },
    include: { targetService: { include: { teacher: { include: { user: true } } } }, targetUser: true },
  });
  if (!report) return;
  // "Ban" on a service report bans the teacher who owns it.
  const banTarget = report.targetUser ?? report.targetService?.teacher.user;
  const status = str(f, "status") === "DISMISSED" ? "DISMISSED" : "RESOLVED";
  const shortcut = str(f, "shortcut");

  if (status === "RESOLVED" && shortcut === "unpublish" && report.targetService) {
    const reason = `Report upheld: ${report.reason}`;
    await db.service.update({
      where: { id: report.targetService.id },
      data: { published: false, unpublishedByAdmin: true, unpublishedReason: reason },
    });
    await db.auditLog.create({ data: { adminId: admin.id, action: "service.unpublish", detail: `${report.targetService.title} — ${reason}` } });
  }
  if (status === "RESOLVED" && shortcut === "ban" && banTarget && banTarget.role !== "ADMIN") {
    await db.user.update({ where: { id: banTarget.id }, data: { banned: true } });
    await db.auditLog.create({ data: { adminId: admin.id, action: "user.ban", detail: banTarget.email } });
  }
  await db.report.update({ where: { id: report.id }, data: { status } });
  await audit(admin.id, `report.${status.toLowerCase()}`, `${report.id.slice(-6)} (${report.reason.slice(0, 60)})`);
}
