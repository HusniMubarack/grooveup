import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";

/** Turso URL if configured. A libsql:// DATABASE_URL is accepted too, since that's an easy mix-up. */
export function tursoUrl() {
  if (process.env.TURSO_DATABASE_URL) return process.env.TURSO_DATABASE_URL;
  const u = process.env.DATABASE_URL;
  return u && /^(libsql|https?|wss?):\/\//.test(u) ? u : undefined;
}

/** Turso (hosted SQLite) when configured, otherwise the local prisma/dev.db file. */
function createClient() {
  const url = tursoUrl();
  if (!url) return new PrismaClient();
  return new PrismaClient({ adapter: new PrismaLibSQL({ url, authToken: process.env.TURSO_AUTH_TOKEN }) });
}

const g = globalThis as unknown as { prisma?: PrismaClient };
export const db = g.prisma ?? createClient();
if (process.env.NODE_ENV !== "production") g.prisma = db;
