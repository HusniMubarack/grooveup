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

## Landing hero video & motion

The landing page hero plays a looping dance clip behind the headline. It's never part of the first paint: the source is attached only after the page is idle, and skipped for reduced motion, data-saver and 2G/3G connections. Until it plays, or if there's no clip, an animated hip-hop dancer silhouette (pure SVG + CSS, `components/dancer.tsx`) fills the stage. The same dancer is the app's loading and buffering animation.

**Adding the clip**
1. Pick a free, licence-free clip from Pexels or Pixabay (search "hip hop dance" or "street dance"): a dancer on a dark or plain background, 6–10 s, loopable.
2. Compress it to about 1–2 MB, 720p, H.264, no audio:
   ```bash
   ffmpeg -i input.mp4 -t 10 -vf "scale=-2:720,fps=30" -c:v libx264 -crf 28 -preset slow -pix_fmt yuv420p -movflags +faststart -an public/hero/dance.mp4
   ```
3. Commit `public/hero/dance.mp4`. Vercel serves it from its CDN.

Or set `NEXT_PUBLIC_HERO_VIDEO_URL` to a hosted clip's URL (it's read at build time, so redeploy after changing it).

**Scroll motion:** CSS scroll-driven animations (`animation-timeline`) where the browser supports them, with a ~1 KB IntersectionObserver fallback in `components/motion.tsx`. Classes in `app/globals.css`:
- `.step-in`: cards enter like a dance step.
- `.kinetic`: headings rise out of a skew.
- `.lean`: rows lean into view.
- `.beat-bar`: scroll progress with beat ticks.
- `.drift` / `.cross`: silhouette parallax.
- `.tilt`: pointer tilt on desktop.

No animation library is used, and everything is disabled under `prefers-reduced-motion`.

## Access requests, approvals & chat

Until in-app payments launch, access is granted by hand:

1. On a course or paid lesson the student taps **Request access** (with an optional note).
2. The **teacher** (Studio → Requests, searchable) or an **admin** (Admin → Requests) approves it, choosing how long access lasts: no expiry, 1–3 months or a custom number of days. Or they decline it with an optional reason. Admin decisions are audit-logged and appear in the chat as "by Groove up". Access can be ended early.
3. Every request, approval and decline also shows up as a note in that student's chat with the teacher.

**Payments later:** `lib/payments.ts` holds the plan: a `PaymentProvider` (Razorpay, then Stripe) whose confirmed payment calls `grantAccess()` from `lib/grant.ts` (the same unlock the manual approval uses). `PLATFORM_FEE_PERCENT` (10%) splits each payment between teacher and platform.

**Chat:** students message any teacher from the teacher's page or a lesson page. Teachers reply in **Studio → Inbox**; students use **My Floor → Inbox**. It's searchable, has an Unread filter, and polls every 4 s while open, so there are no websockets on Vercel.

## Lessons: tags and previews

- **Tags:** every lesson needs at least 3 (up to 10), with suggestions per style. They're lowercase and dash-separated, for example `party-steps`, and shown on the lesson page.
- **Preview:** in the lesson form the teacher plays their own video and picks the public preview (3–30 s) with *Start here* and length sliders. It plays from the local file right after picking it, so there's no wait for the upload.
  - For Mux lessons, Mux cuts the range into a **separate clip asset** (`mux://assets/<id>` with start and end times), so a locked lesson page never receives the full video.
  - For pasted MP4 links, the preview plays that link limited to the range. That isn't protected, since the link itself is public.

## Student onboarding & personalised feed

New students pick the dance styles they want (and optionally a level) at **/welcome**. Explore and the home page then show only those styles: a hip-hop fan isn't shown Bharatanatyam. A bar on Explore offers **Edit** and **Show all styles**. Students who skipped it are sent back to /welcome when they sign in.

## Practice player

Speed (0.5×/0.75×/1×), mirror, sections, **A–B loop** and **loop a section**, with a **pause between repeats** (default 3 s, shown as a countdown; tap to skip; remembered per device). Also **full screen**, which covers the whole player so the loop controls stay usable, and **Cast to TV**:
- Chromecast / Google TV via Google's Cast SDK in Chrome and Edge. The TV streams the signed link itself.
- AirPlay in Safari.
- The Remote Playback API elsewhere. The button is hidden when none of these is available.

## Deployments (branches, previews, production)

- **`main` is production.** Vercel → Settings → Git → Production Branch = `main`. A merge into `main` deploys the live site.
- **Every other branch makes a Preview deployment** with its own URL (and a stable `grooveup-git-<branch>-<you>.vercel.app`). Feature work, including Claude's `claude/...` branches, only ever creates previews.
- **Shipping:** push a branch → test its preview → open a PR into `main` → merge. To undo a bad release: Vercel → Deployments → pick the previous production deploy → **Promote**.
- **Keep preview data separate from production.** Every build runs database migrations, so previews must not point at the live database. Scope the env vars in Vercel:

| Variable | Production | Preview |
| --- | --- | --- |
| `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` | live DB (`grooveup`) | dev DB (`grooveup-dev`) |
| `MUX_TOKEN_ID`, `MUX_TOKEN_SECRET`, `MUX_SIGNING_KEY`, `MUX_PRIVATE_KEY` | Mux *Production* environment | Mux *Development* environment |
| `AUTH_SECRET` | its own value | a different value |

  Create and seed the dev database once:
  ```bash
  turso db create grooveup-dev
  turso db show grooveup-dev --url   # → dev TURSO_DATABASE_URL
  turso db tokens create grooveup-dev  # → dev TURSO_AUTH_TOKEN
  TURSO_DATABASE_URL="…" TURSO_AUTH_TOKEN="…" pnpm prisma db seed
  ```
  The `/admin` Setup card shows which database a deployment is using.
- **Vercel Hobby (free)** is for personal, non-commercial projects and builds one deployment at a time. Preview URLs are only visible to you while logged in to Vercel. Move to Pro before charging real customers.

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
| `student@grooveup.dev` | STUDENT | Riya: likes Hip-Hop and K-Pop, one free demo in progress, a pending request for Kabir's course and a chat with him |
| `admin@grooveup.dev` | ADMIN | the only admin |
| `arjun@grooveup.dev` | STUDENT | in Ananya's course, bought one lesson from Min-ji, has a pending request for Diego's lesson and two chats |
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
