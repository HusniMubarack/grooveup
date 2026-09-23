# Atelier — MVP

A dance-lesson marketplace for phones: teachers sell lessons, students practice with slow-mo, mirror and section jumps, and a small admin panel lets an operator moderate the demo.

**Stack:** Next.js 15 (App Router) · TypeScript · Tailwind v4 + shadcn/ui-style components · Auth.js v5 Credentials · Prisma 6 + SQLite · plain HTML5 `<video>` · pnpm.

## Run

```bash
cp .env.example .env     # then set AUTH_SECRET (openssl rand -base64 32)
pnpm i
pnpm prisma db seed      # applies migrations to prisma/dev.db, then wipes + loads demo data (re-runnable)
pnpm dev                 # http://localhost:3000
```

### Seed logins (password `password123`)

| Email | Role | Notes |
| --- | --- | --- |
| `teacher@atelier.dev` | TEACHER | Kabir Rao, hip-hop, **verified** |
| `student@atelier.dev` | STUDENT | Riya, one free demo in progress |
| `admin@atelier.dev` | ADMIN | the only admin |
| `arjun@atelier.dev` | STUDENT | follows and subscribes to Ananya, bought one pay-per-view lesson from Min-ji |
| `ananya@` / `minji@` / `diego@atelier.dev` | TEACHER | Bharatanatyam (**featured**), K-Pop, salsa |

The seed also includes 12 services (free demos, subscription-included and pay-per-view lessons, one featured, one already removed by an admin), 3 paid orders (so GMV is above zero) and 2 open reports.

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

## Rules worth knowing

- **Play access** (`lib/access.ts`): a lesson plays if it is free or a DEMO, if you bought it (Entitlement), or if you have an ACTIVE subscription to that teacher and the lesson is `includedInSub`. The owner and admins can always preview. Nothing plays for students if the lesson is unpublished, removed by an admin, or its teacher is banned. `/s/[id]` only ever shows the teaser.
- **Mock pay**: one server action, `payAction`, with `kind=SUBSCRIPTION|SERVICE`. It creates the Order plus the Subscription and/or Entitlements. There is no card form.
- **Cancel**: sets the subscription to CANCELED and deletes its SUBSCRIPTION entitlements. PURCHASE entitlements are kept.
- **Bans** take effect on the next request: the JWT callback re-reads the user each time, so a banned user is signed out and can't sign back in. Their teacher page shows "unavailable" and their lessons disappear from Explore.
- **Admin-removed lessons**: the teacher sees "Removed by admin: {reason}" and the Publish button stays disabled until an admin restores the lesson.
- `/admin/*` returns a 404 for anyone who isn't an admin. Registration can't create an ADMIN, and the admin UI can't promote anyone to ADMIN.

## Placeholders (stubs only)

Each one is a dashed "Coming soon" card with a disabled button: live class calendar (`/studio`), programs, membership tiers and messaging (`/t/[handle]`), real payments and tips/promo codes (`/s/[id]`), notes/reviews and compare-my-take (`/play/[id]`), real video hosting (`/studio/new`), PWA install and native app (`/`), and admin extras plus refunds (`/admin`, `/admin/commerce`).
