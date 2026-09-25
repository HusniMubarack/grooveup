# Groove up — MVP

A dance-lesson marketplace for phones: teachers sell lessons, students practice with slow-mo, mirror and section jumps, and a small admin panel lets an operator moderate the demo.

**Stack:** Next.js 15 (App Router) · TypeScript · Tailwind v4 + shadcn/ui-style components · Auth.js v5 Credentials · Prisma 6 + SQLite · plain HTML5 `<video>` · pnpm.

## Run locally

```bash
cp .env.example .env     # then set AUTH_SECRET (openssl rand -base64 32)
pnpm i
pnpm prisma db seed      # creates prisma/dev.db, applies migrations, loads demo data (re-run to reset)
pnpm dev                 # http://localhost:3000
```

The local database is always the file `prisma/dev.db`. It doesn't read `DATABASE_URL`, so a `DATABASE_URL` left in your shell from another project can't break it. Delete `prisma/dev.db` and re-run the seed to start from scratch.

### Run locally against Turso instead

Add these to `.env` and run `pnpm dev`. The app then reads and writes the Turso database, the same one Vercel uses:

```bash
TURSO_DATABASE_URL="libsql://grooveup-<you>.turso.io"
TURSO_AUTH_TOKEN="…"
```

Comment them out to go back to `prisma/dev.db`. Note that `pnpm prisma db seed` and `pnpm db:turso` **wipe and reload** whichever database is configured, so don't run them against Turso once the demo has real data you care about.

## Deploy (Vercel + Turso, both free)

Production uses [Turso](https://turso.tech) (hosted SQLite) through Prisma's libSQL adapter. `lib/db.ts` uses Turso when `TURSO_DATABASE_URL` is set, and the local `prisma/dev.db` file otherwise.

1. **Create the database.** Install the Turso CLI, then:
   ```bash
   turso auth signup                      # or: turso auth login
   turso db create grooveup
   turso db show grooveup --url            # → TURSO_DATABASE_URL (libsql://…)
   turso db tokens create grooveup         # → TURSO_AUTH_TOKEN
   ```
   (You can also do this in the Turso web dashboard.)
2. **Load the schema and demo data** from your machine, once:
   ```bash
   TURSO_DATABASE_URL="libsql://…" TURSO_AUTH_TOKEN="…" pnpm db:turso
   ```
   This applies `prisma/migrations`, then runs the seed. Re-run it to reset the demo; new migrations are applied only once.
3. **Deploy on Vercel.** Go to vercel.com → Add New → Project, import this repo, and keep the Next.js defaults. Add these environment variables:
   | Name | Value |
   | --- | --- |
   | `AUTH_SECRET` | output of `openssl rand -base64 32` |
   | `TURSO_DATABASE_URL` | from step 1 |
   | `TURSO_AUTH_TOKEN` | from step 1 |

   Then deploy. Every push to the production branch redeploys.

   **Migrations run automatically on every Vercel build** (`vercel-build` → `prisma/migrate.ts`): new columns are added to Turso before the new code goes live, existing data is kept, and if a migration fails the build fails and the previous deployment stays up. Run `pnpm db:migrate` to do the same by hand. `pnpm prisma db seed` is only for (re)loading the demo data, and it wipes the database.
4. **Check the deployment:** sign in as `admin@grooveup.dev`. The **Setup** card on `/admin` shows the database, whether migrations are up to date, and whether Mux uploads and signed playback are configured (it only shows whether each is set, never the values).

## Video hosting (Mux)

Teachers upload lesson videos from the Studio **straight to [Mux](https://www.mux.com)**: the file goes from their browser to Mux in resumable 5 MB chunks and never passes through this app or Vercel. Students stream it through the Groove up player (HLS, adaptive quality) with speed, mirror, sections and A–B loop.

**Security**
- Videos are created with a **signed-only** playback policy. A stream URL only works with a token that expires after 4 hours.
- `/play/[id]` checks `canPlay()` first and only then mints the token, so locked lessons never reach the browser.
- Thumbnails and previews go through `/api/thumb/[id]`, which signs them on the fly.
- An upload is tagged with its teacher, so another account can't attach someone else's upload.
- No platform can stop screen recording.

**Setup** (about 5 minutes)
1. Create a Mux account → Settings → **Access Tokens** → new token with **Mux Video: Read + Write** → `MUX_TOKEN_ID`, `MUX_TOKEN_SECRET`.
2. Settings → **Signing Keys** → create one → `MUX_SIGNING_KEY` (the key ID) and `MUX_PRIVATE_KEY` (the base64 private key, shown only once).
3. Add all four to `.env` and to Vercel (Settings → Environment Variables), then redeploy.

Without these variables the Upload button is hidden and lessons use pasted MP4 links, which is how the seed data works. Videos are picked up once Mux finishes processing (the Studio shows "Video processing…" until then); no webhook is needed.

### Seed logins (password `password123`)

| Email | Role | Notes |
| --- | --- | --- |
| `teacher@grooveup.dev` | TEACHER | Kabir Rao, hip-hop, **verified** |
| `student@grooveup.dev` | STUDENT | Riya, one free demo in progress |
| `admin@grooveup.dev` | ADMIN | the only admin |
| `arjun@grooveup.dev` | STUDENT | follows and subscribes to Ananya, bought one pay-per-view lesson from Min-ji |
| `ananya@` / `minji@` / `diego@grooveup.dev` | TEACHER | Bharatanatyam (**featured**), K-Pop, salsa |

The seed also includes 15 lessons across the three categories (one featured, one already removed by an admin), 4 paid orders (so GMV is above zero) and 2 open reports. Arjun has bought, practiced and canceled with Kabir, so `teacher@`'s Studio insights aren't empty.

After login, teachers (and BOTH users, in teacher mode) land on `/studio`, students on `/explore` and the admin on `/admin`.

Sample videos are Google's public `gtv-videos-bucket` MP4s. If they can't load, thumbnails fall back to a gold gradient.

## Map

```
prisma/schema.prisma   all models (SQLite; TeacherProfile.styles is a JSON string)
prisma/seed.ts         demo data
lib/auth.ts            Auth.js config, role guards, BOTH-user mode cookie
lib/access.ts          canPlay() + public visibility rule, the single source of access truth
app/actions.ts         user server actions (auth, follow, payAction, cancel, report, studio)
app/admin/actions.ts   admin server actions (every mutation writes AuditLog)
components/player.tsx  the one player
components/admin-table.tsx  the one admin table
```

## How Explore is organised

`lib/categories.ts` is the single source of truth:

| Category | What it holds | Rule |
| --- | --- | --- |
| **Quick Moves** | one move, cheap and quick | STEP or DEMO (free taster), ≤ 90 s |
| **Full Choreo** | a whole routine in one video | CHOREO, ≤ 20 min |
| **Courses** | a teacher's full path in their style | the teacher's monthly subscription; its lessons are everything marked "included", incl. SESSION course lessons |

The Studio form enforces the duration limits. Teachers can edit any lesson (`/studio/edit/[id]`), add up to 8 practice sections, and delete a lesson only while no student has bought it, practiced it or gets it through their subscription; otherwise they unpublish it. The Studio also breaks earnings down by category and lists course subscribers and the students on each lesson (with access type and progress).

## Rules worth knowing

- **Play access** (`lib/access.ts`): a lesson plays if it is free or a DEMO, if you bought it (Entitlement), or if you have an ACTIVE subscription to that teacher and the lesson is `includedInSub`. The owner and admins can always preview. Nothing plays for students if the lesson is unpublished, removed by an admin, or its teacher is banned. `/s/[id]` only ever shows the teaser.
- **Mock pay**: one server action, `payAction`, with `kind=SUBSCRIPTION|SERVICE`. It creates the Order plus the Subscription and/or Entitlements. There is no card form.
- **Cancel**: sets the subscription to CANCELED and deletes its SUBSCRIPTION entitlements. PURCHASE entitlements are kept.
- **Bans** take effect on the next request: the JWT callback re-reads the user each time, so a banned user is signed out and can't sign back in. Their teacher page shows "unavailable" and their lessons disappear from Explore.
- **Admin-removed lessons**: the teacher sees "Removed by admin: {reason}" and the Publish button stays disabled until an admin restores the lesson.
- `/admin/*` returns a 404 for anyone who isn't an admin. Registration can't create an ADMIN, and the admin UI can't promote anyone to ADMIN.

## Placeholders (stubs only)

Each one is a dashed "Coming soon" card with a disabled button: live class calendar (`/studio`), programs, membership tiers and messaging (`/t/[handle]`), real payments and tips/promo codes (`/s/[id]`), notes/reviews and compare-my-take (`/play/[id]`), real video hosting (`/studio/new`), PWA install and native app (`/`), and admin extras plus refunds (`/admin`, `/admin/commerce`).
