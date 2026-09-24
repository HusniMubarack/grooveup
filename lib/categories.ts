import type { Prisma, Service, ServiceType } from "@prisma/client";
import { publicServiceWhere } from "./access";
import { db } from "./db";

/** The three ways to learn on Groove up. Single source of truth for Explore, teacher pages and Studio. */
export const CATEGORIES = {
  moves: {
    name: "Quick Moves",
    tagline: "One move. Under 90 seconds.",
    blurb: "Tiny, cheap, zero-excuse lessons. Learn one step before your chai cools.",
  },
  choreo: {
    name: "Full Choreo",
    tagline: "A whole routine in one video, under 20 min.",
    blurb: "Pick a routine, learn it end to end, and perform it tonight.",
  },
  courses: {
    name: "Courses",
    tagline: "A teacher's complete path in one style.",
    blurb: "Subscribe to a teacher and follow their curated lessons in hip-hop, salsa, classical and more.",
  },
} as const;
export type CategoryKey = keyof typeof CATEGORIES;
export const CATEGORY_KEYS = Object.keys(CATEGORIES) as CategoryKey[];

export const MOVE_MAX_SEC = 90;
export const CHOREO_MAX_SEC = 20 * 60;

/** Labels for the Studio form; the enum stays STEP / CHOREO / SESSION / DEMO. */
export const TYPE_LABELS: Record<ServiceType, string> = {
  STEP: "Quick move (≤ 90 s)",
  CHOREO: "Full choreo (≤ 20 min)",
  SESSION: "Course lesson (subscribers)",
  DEMO: "Free taster (≤ 90 s)",
};

export const categoryWhere: Record<Exclude<CategoryKey, "courses">, Prisma.ServiceWhereInput> = {
  moves: { type: { in: ["STEP", "DEMO"] }, durationSec: { lte: MOVE_MAX_SEC } },
  choreo: { type: "CHOREO", durationSec: { lte: CHOREO_MAX_SEC } },
};

export const liveIn = (cat: Exclude<CategoryKey, "courses">): Prisma.ServiceWhereInput => ({
  AND: [publicServiceWhere, categoryWhere[cat]],
});

/** Which bucket a lesson belongs to (course lessons are anything sold via the teacher's subscription). */
export function categoryOf(s: Pick<Service, "type" | "durationSec">): CategoryKey {
  if ((s.type === "STEP" || s.type === "DEMO") && s.durationSec <= MOVE_MAX_SEC) return "moves";
  if (s.type === "CHOREO" && s.durationSec <= CHOREO_MAX_SEC) return "choreo";
  return "courses";
}

/** Returns an error message if a lesson's type/duration break its category's limits. */
export function durationError(type: ServiceType, sec: number): string | null {
  if (sec <= 0) return "Duration is required.";
  if ((type === "STEP" || type === "DEMO") && sec > MOVE_MAX_SEC) return "Quick moves and free tasters must be 90 seconds or less.";
  if (type === "CHOREO" && sec > CHOREO_MAX_SEC) return "Full choreo must be 20 minutes or less.";
  return null;
}

/** Courses = teachers (not banned) with at least one live lesson included in their subscription. */
export async function findCourses(style?: string) {
  const lessons: Prisma.ServiceWhereInput = { AND: [publicServiceWhere, { includedInSub: true }] };
  const teachers = await db.teacherProfile.findMany({
    where: {
      user: { banned: false },
      services: { some: lessons },
      ...(style ? { styles: { contains: `"${style}"` } } : {}),
    },
    include: {
      user: { select: { name: true } },
      services: { where: lessons, select: { id: true, thumbnailUrl: true, durationSec: true }, orderBy: { createdAt: "asc" } },
    },
    orderBy: [{ featured: "desc" }, { verified: "desc" }],
  });
  return teachers;
}
