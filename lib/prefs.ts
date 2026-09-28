import type { Role } from "@prisma/client";
import { db } from "./db";
import { STYLES } from "./utils";

export type DancePrefs = { styles: string[]; level?: string };

export const STYLE_INFO: Record<string, string> = {
  "Hip-Hop": "Grooves, footwork and freestyle",
  Bharatanatyam: "South Indian classical: adavus and abhinaya",
  "K-Pop": "Sharp point choreo and dance covers",
  Salsa: "Partner work, on1 timing and shines",
  Contemporary: "Floorwork, flow and release",
  Bollywood: "Filmi, sangeet and semi-classical",
};

export function parsePrefs(json: string | null | undefined): DancePrefs | null {
  if (!json) return null;
  try {
    const v = JSON.parse(json);
    const styles = Array.isArray(v?.styles) ? v.styles.filter((s: unknown) => typeof s === "string" && STYLES.includes(s as string)) : [];
    return styles.length ? { styles, level: typeof v.level === "string" ? v.level : undefined } : null;
  } catch {
    return null;
  }
}

/** The styles a student's feed is limited to, or null (everything) for visitors, teachers, admins and "show all". */
export async function feedStyles(user: { id: string; role: Role } | null, showAll?: boolean): Promise<string[] | null> {
  if (!user || showAll || (user.role !== "STUDENT" && user.role !== "BOTH")) return null;
  const u = await db.user.findUnique({ where: { id: user.id }, select: { danceStyles: true } });
  return parsePrefs(u?.danceStyles)?.styles ?? null;
}

export async function needsOnboarding(userId: string) {
  const u = await db.user.findUnique({ where: { id: userId }, select: { role: true, danceStyles: true } });
  return !!u && (u.role === "STUDENT" || u.role === "BOTH") && !parsePrefs(u.danceStyles);
}
