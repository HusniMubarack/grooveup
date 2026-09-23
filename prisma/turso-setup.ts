/**
 * One-time setup for a Turso database: applies prisma/migrations, then loads the demo seed.
 * `prisma migrate` can't talk to Turso directly, so the migration SQL is applied here.
 *   TURSO_DATABASE_URL=libsql://... TURSO_AUTH_TOKEN=... pnpm db:turso
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@libsql/client";
import { tursoUrl } from "../lib/db";

async function main() {
  const url = tursoUrl();
  if (!url) throw new Error("Set TURSO_DATABASE_URL (and TURSO_AUTH_TOKEN) first.");
  const client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });

  await client.execute(`CREATE TABLE IF NOT EXISTS "_atelier_migrations" ("name" TEXT PRIMARY KEY)`);
  const applied = new Set((await client.execute(`SELECT name FROM "_atelier_migrations"`)).rows.map((r) => String(r.name)));
  const dir = join(__dirname, "migrations");
  for (const name of readdirSync(dir).filter((d) => !d.includes(".")).sort()) {
    if (applied.has(name)) continue;
    await client.executeMultiple(readFileSync(join(dir, name, "migration.sql"), "utf8"));
    await client.execute({ sql: `INSERT INTO "_atelier_migrations" (name) VALUES (?)`, args: [name] });
    console.log(`Applied migration ${name}`);
  }
  client.close();

  await import("./seed"); // wipes and reloads demo data through the Turso adapter
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
