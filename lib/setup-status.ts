import { createClient } from "@libsql/client";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { tursoAuthToken, tursoUrl } from "./db";
import { muxEnabled, muxSigningEnabled } from "./mux";

export type Check = { label: string; ok: boolean; detail: string };

/** What this deployment is wired to. Reports presence only, never secret values. */
export async function setupStatus(): Promise<Check[]> {
  const url = tursoUrl();
  const checks: Check[] = [
    { label: "Database", ok: true, detail: !url ? "Local file prisma/dev.db" : url.startsWith("file:") ? "libSQL file (test)" : `Turso (${new URL(url.replace(/^libsql:/, "https:")).hostname})` },
  ];
  if (url && !url.startsWith("file:")) {
    let latest: string[] = [];
    try {
      latest = readdirSync(join(process.cwd(), "prisma", "migrations")).filter((d) => !d.includes(".")).sort();
    } catch {
      /* migrations folder isn't traced into every serverless bundle */
    }
    try {
      const c = createClient({ url, authToken: tursoAuthToken() });
      const rows = (await c.execute(`SELECT name FROM "_atelier_migrations" ORDER BY name`)).rows.map((r) => String(r.name));
      c.close();
      const missing = latest.filter((m) => !rows.includes(m));
      checks.push({
        label: "Migrations",
        ok: missing.length === 0,
        detail: missing.length ? `Missing: ${missing.join(", ")}` : `Up to date (${rows.at(-1) ?? "none"})`,
      });
    } catch (e) {
      checks.push({ label: "Migrations", ok: false, detail: `Couldn't read: ${String((e as Error).message).slice(0, 80)}` });
    }
  }
  checks.push(
    { label: "Auth secret", ok: !!process.env.AUTH_SECRET, detail: process.env.AUTH_SECRET ? "Set" : "Missing AUTH_SECRET" },
    { label: "Mux uploads", ok: muxEnabled(), detail: muxEnabled() ? "On" : "Off: MUX_TOKEN_ID / MUX_TOKEN_SECRET not set (pasted links only)" },
    { label: "Signed playback", ok: muxSigningEnabled(), detail: muxSigningEnabled() ? "On" : "Off: MUX_SIGNING_KEY / MUX_PRIVATE_KEY not set" },
  );
  return checks;
}
