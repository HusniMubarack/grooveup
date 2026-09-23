import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";

/** Turso URL if configured. A libsql:// DATABASE_URL is accepted too, since that's an easy mix-up. */
export function tursoUrl() {
  const t = clean(process.env.TURSO_DATABASE_URL);
  if (t) return t;
  const u = clean(process.env.DATABASE_URL);
  return u && /^(libsql|https?|wss?):\/\//.test(u) ? u : undefined;
}

/** Tolerate stray quotes/whitespace from copy-pasting into .env or the Vercel dashboard. */
function clean(v?: string) {
  return v?.trim().replace(/^["']|["']$/g, "").trim() || undefined;
}

export function tursoAuthToken() {
  return clean(process.env.TURSO_AUTH_TOKEN);
}

/** Turso (hosted SQLite) when configured, otherwise the local prisma/dev.db file. */
function createClient() {
  const url = tursoUrl();
  if (!url) return new PrismaClient();
  return new PrismaClient({ adapter: new PrismaLibSQL({ url, authToken: tursoAuthToken() }) });
}

const g = globalThis as unknown as { prisma?: PrismaClient };
export const db = g.prisma ?? createClient();
if (process.env.NODE_ENV !== "production") g.prisma = db;
