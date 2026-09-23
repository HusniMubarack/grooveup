import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";

/** Turso (hosted SQLite) when TURSO_DATABASE_URL is set, otherwise the local prisma/dev.db file. */
function createClient() {
  const url = process.env.TURSO_DATABASE_URL;
  if (!url) return new PrismaClient();
  return new PrismaClient({ adapter: new PrismaLibSQL({ url, authToken: process.env.TURSO_AUTH_TOKEN }) });
}

const g = globalThis as unknown as { prisma?: PrismaClient };
export const db = g.prisma ?? createClient();
if (process.env.NODE_ENV !== "production") g.prisma = db;
