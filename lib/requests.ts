import QRCode from "qrcode";
import type { TeacherProfile } from "@prisma/client";
import { activeSubWhere, liveGrantWhere } from "./access";
import { db } from "./db";

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

/** UPI deep link (opens GPay/PhonePe/Paytm on phones) with the amount pre-filled. */
export function upiLink(t: Pick<TeacherProfile, "upiId">, payeeName: string, amountPaise: number, item: string) {
  if (!t.upiId) return null;
  const p = new URLSearchParams({ pa: t.upiId, pn: payeeName, am: (amountPaise / 100).toFixed(2), cu: "INR", tn: `Groove up: ${item}`.slice(0, 60) });
  return `upi://pay?${p.toString()}`;
}

/** QR for the UPI link as inline SVG. Generated on the fly: nothing is uploaded or stored. */
export async function upiQrSvg(link: string) {
  return QRCode.toString(link, { type: "svg", margin: 1, color: { dark: "#0b0a09", light: "#ffffff" } });
}

/** Plausible UPI VPA: name@handle. */
export const isUpiId = (v: string) => /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z][a-zA-Z0-9.-]{1,64}$/.test(v);

export type UpiInfo = { id: string; link: string; qrSvg: string | null } | null;

/** Everything the request panel needs to show the teacher's payment details. */
export async function upiInfo(t: Pick<TeacherProfile, "upiId" | "showUpiQr">, payeeName: string, amountPaise: number, item: string): Promise<UpiInfo> {
  const link = upiLink(t, payeeName, amountPaise, item);
  if (!link || !t.upiId) return null;
  return { id: t.upiId, link, qrSvg: t.showUpiQr ? await upiQrSvg(link) : null };
}
