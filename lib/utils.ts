import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Integer paise → "₹499" / "₹1,499.50" */
export function rupees(paise: number) {
  const r = paise / 100;
  return "₹" + r.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

export function fmtDuration(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function fmtDate(d: Date) {
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function parseStyles(json: string): string[] {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export const STYLES = ["Hip-Hop", "Bharatanatyam", "K-Pop", "Salsa", "Contemporary", "Bollywood"];
export const LEVELS = ["BEGINNER", "INTERMEDIATE", "ADVANCED"] as const;
export const TYPES = ["STEP", "CHOREO", "SESSION", "DEMO"] as const;

/** Access end date, or "no expiry" when null. */
export function fmtUntil(d: Date | null | undefined) {
  return d ? fmtDate(d) : "no expiry";
}

export function timeAgo(d: Date) {
  const s = Math.max(1, Math.round((Date.now() - d.getTime()) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const days = Math.round(h / 24);
  return days < 30 ? `${days} d ago` : fmtDate(d);
}
