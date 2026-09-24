/**
 * `prisma migrate` can't talk to Turso, so the seed applies prisma/migrations/*.sql itself,
 * tracking what has run in a small _atelier_migrations table. (The name predates the Groove up
 * rebrand; renaming it would make existing Turso databases re-run the init migration and fail.)
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@libsql/client";

export async function applyTursoMigrations(url: string, authToken?: string): Promise<string[]> {
  const client = createClient({ url, authToken });
  const done: string[] = [];
  try {
    await client.execute(`CREATE TABLE IF NOT EXISTS "_atelier_migrations" ("name" TEXT PRIMARY KEY)`);
    const applied = new Set((await client.execute(`SELECT name FROM "_atelier_migrations"`)).rows.map((r) => String(r.name)));
    const dir = join(__dirname, "migrations");
    for (const name of readdirSync(dir).filter((d) => !d.includes(".")).sort()) {
      if (applied.has(name)) continue;
      await client.executeMultiple(readFileSync(join(dir, name, "migration.sql"), "utf8"));
      await client.execute({ sql: `INSERT INTO "_atelier_migrations" (name) VALUES (?)`, args: [name] });
      console.log(`Applied migration ${name}`);
      done.push(name);
    }
    return done;
  } finally {
    client.close();
  }
}
