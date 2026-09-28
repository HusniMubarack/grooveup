/** Lesson tags: free text, normalised, at least 3 per lesson so lessons can be categorised later. */
export const MIN_TAGS = 3;
export const MAX_TAGS = 10;

export const TAG_SUGGESTIONS: Record<string, string[]> = {
  "Hip-Hop": ["grooves", "footwork", "freestyle", "party-steps", "popping", "locking", "bounce", "old-school"],
  Bharatanatyam: ["adavu", "abhinaya", "nritta", "mudras", "aramandi", "classical", "margam", "carnatic"],
  "K-Pop": ["point-choreo", "cover", "isolations", "formations", "girl-group", "boy-group", "hooks", "stage-presence"],
  Salsa: ["on1", "partnerwork", "shines", "turns", "timing", "cross-body-lead", "social", "footwork"],
  Contemporary: ["floorwork", "release", "improv", "lyrical", "flow", "musicality"],
  Bollywood: ["sangeet", "filmi", "expressions", "wedding", "thumka", "semi-classical"],
};
export const COMMON_TAGS = ["beginner-friendly", "warm-up", "full-routine", "technique", "fitness", "slow-breakdown"];

/** "Party Steps!" → "party-steps"; null if it isn't a usable tag. */
export function normalizeTag(raw: string): string | null {
  const t = raw.toLowerCase().trim().replace(/[\s_]+/g, "-").replace(/[^a-z0-9-]/g, "").replace(/-+/g, "-").replace(/^-|-$/g, "");
  return t.length >= 2 && t.length <= 24 ? t : null;
}

export function parseTags(json: string | null | undefined): string[] {
  try {
    const v = JSON.parse(json ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/** Clean, dedupe and cap a submitted list. */
export function cleanTags(list: string[]): string[] {
  return [...new Set(list.map(normalizeTag).filter((t): t is string => !!t))].slice(0, MAX_TAGS);
}
