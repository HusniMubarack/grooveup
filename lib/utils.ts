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
