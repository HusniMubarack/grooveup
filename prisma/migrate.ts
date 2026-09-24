/**
 * Apply pending migrations to Turso without touching data. Runs on every Vercel build ("vercel-build"),
 * so new columns exist before new code goes live. Locally, `pnpm prisma db seed` handles migrations.
 */
import { tursoAuthToken, tursoUrl } from "../lib/db";
import { applyTursoMigrations } from "./turso-migrate";

async function main() {
  const url = tursoUrl();
  if (!url) {
    console.log("No TURSO_DATABASE_URL set: skipping database migrations.");
    return;
  }
  console.log(`Migrating Turso database ${url.replace(/\?.*$/, "")}`);
  const applied = await applyTursoMigrations(url, tursoAuthToken());
  console.log(applied.length ? `Done: ${applied.join(", ")}` : "No pending migrations.");
}

main().catch((e) => {
  console.error("Migration failed. The previous deployment stays live.\n", e);
  if (/401|unauthori[sz]ed/i.test(String(e?.message ?? e))) console.error("Turso rejected TURSO_AUTH_TOKEN (HTTP 401): check it in Vercel → Settings → Environment Variables.");
  process.exit(1);
});
