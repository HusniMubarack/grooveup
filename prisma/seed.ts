import type { Level, ServiceType } from "@prisma/client";
import { execSync } from "node:child_process";
import bcrypt from "bcryptjs";
import { db, tursoAuthToken, tursoUrl } from "../lib/db";
import { applyTursoMigrations } from "./turso-migrate";

// Public sample clips (Google's gtv-videos-bucket). Swap for your own footage any time.
const V = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample";
const CLIPS = ["ForBiggerBlazes", "ForBiggerEscapes", "ForBiggerFun", "ForBiggerJoyrides", "ForBiggerMeltdowns"];
const clip = (i: number) => ({
  teaserUrl: `${V}/${CLIPS[i % CLIPS.length]}.mp4`,
  videoUrl: `${V}/${CLIPS[(i + 2) % CLIPS.length]}.mp4`,
  thumbnailUrl: `${V}/images/${CLIPS[i % CLIPS.length]}.jpg`,
});

type Svc = {
  title: string;
  type: ServiceType;
  level: Level;
  description: string;
  durationSec: number;
  pricePaise?: number;
  includedInSub?: boolean;
  isFree?: boolean;
  featured?: boolean;
  unpublishedByAdmin?: string;
  sections: [string, number, number][];
};

const TEACHERS: {
  email: string;
  name: string;
  handle: string;
  style: string;
  bio: string;
  price: number;
  verified?: boolean;
  featured?: boolean;
  services: Svc[];
}[] = [
  {
    email: "teacher@atelier.dev",
    name: "Kabir Rao",
    handle: "kabir",
    style: "Hip-Hop",
    bio: "Bengaluru street dancer, 12 years of cyphers and battles. I teach grooves before tricks.",
    price: 49900,
    verified: true,
    services: [
      { title: "Grooves 101: Bounce & Rock", type: "DEMO", level: "BEGINNER", isFree: true, durationSec: 15,
        description: "Find the pocket. We drill the down-bounce and the rock until your body stops thinking about it.",
        sections: [["Down-bounce", 0, 5], ["Rock", 5, 10], ["Put it together", 10, 15]] },
      { title: "Running Man to Roger Rabbit Drill", type: "STEP", level: "INTERMEDIATE", includedInSub: true, pricePaise: 19900, durationSec: 60,
        description: "Two classic party steps, broken down at half-speed and chained into a clean eight-count transition.",
        sections: [["Running Man", 0, 20], ["Roger Rabbit", 20, 40], ["Transition", 40, 60]] },
      { title: "'Night Shift' Full Choreography", type: "CHOREO", level: "ADVANCED", pricePaise: 39900, durationSec: 60,
        description: "A 32-count routine with hits, freezes and a floor transition. Filmed front and back.",
        sections: [["Counts 1–16", 0, 25], ["Counts 17–32", 25, 50], ["Full run", 50, 60]] },
    ],
  },
  {
    email: "ananya@atelier.dev",
    name: "Ananya Iyer",
    handle: "ananya",
    style: "Bharatanatyam",
    bio: "Kalakshetra-trained. Adavus with patience, abhinaya with honesty.",
    price: 59900,
    featured: true,
    services: [
      { title: "Adavu Foundations: Tatta Adavu", type: "DEMO", level: "BEGINNER", isFree: true, durationSec: 15,
        description: "Aramandi posture and the first tatta adavu, counted slowly in three speeds.",
        sections: [["Aramandi", 0, 5], ["First speed", 5, 10], ["Second speed", 10, 15]] },
      { title: "Alarippu, Step by Step", type: "CHOREO", level: "BEGINNER", includedInSub: true, featured: true, durationSec: 60,
        description: "The traditional opening piece, taught one section at a time with neck and eye movements.",
        sections: [["Invocation", 0, 20], ["Tisra nadai", 20, 40], ["Closing", 40, 60]] },
      { title: "Abhinaya Expressions Session", type: "SESSION", level: "ADVANCED", includedInSub: true, durationSec: 60,
        description: "A full session on navarasa. We work one rasa at a time using a short padam.",
        sections: [["Shringara", 0, 20], ["Karuna", 20, 40], ["Veera", 40, 60]] },
    ],
  },
  {
    email: "minji@atelier.dev",
    name: "Min-ji Park",
    handle: "minji",
    style: "K-Pop",
    bio: "Ex-trainee turned cover-team coach. Sharp angles, clean formations.",
    price: 44900,
    services: [
      { title: "K-Pop Isolations Warm-up", type: "DEMO", level: "BEGINNER", isFree: true, durationSec: 15,
        description: "Chest, head and hip isolations to get you ready for sharp choreography.",
        sections: [["Chest", 0, 5], ["Head", 5, 10], ["Hips", 10, 15]] },
      { title: "Point Choreo Breakdown: Hook Moves", type: "STEP", level: "INTERMEDIATE", includedInSub: true, durationSec: 60,
        description: "The signature 'point' moves from three chart-topping hooks, mirrored and slowed down.",
        sections: [["Hook A", 0, 20], ["Hook B", 20, 40], ["Hook C", 40, 60]] },
      { title: "Full Dance Cover: 'Starlight'", type: "CHOREO", level: "INTERMEDIATE", pricePaise: 29900, durationSec: 60,
        description: "Full cover choreography with formation notes for groups of four or five.",
        sections: [["Verse", 0, 20], ["Pre-chorus", 20, 35], ["Chorus", 35, 60]] },
    ],
  },
  {
    email: "diego@atelier.dev",
    name: "Diego Fernandes",
    handle: "diego",
    style: "Salsa",
    bio: "Goa-based social dancer. On1 timing, clean leads, happy follows.",
    price: 49900,
    services: [
      { title: "Salsa On1 Basic Timing", type: "DEMO", level: "BEGINNER", isFree: true, durationSec: 15,
        description: "Hear the 1, step the 1. Basic forward-back and side basic with the count.",
        sections: [["Listen", 0, 5], ["Forward-back", 5, 10], ["Side basic", 10, 15]] },
      { title: "Cross-Body Lead Variations", type: "STEP", level: "INTERMEDIATE", includedInSub: true, pricePaise: 14900, durationSec: 60,
        description: "Four cross-body lead variations with inside and outside turns.",
        sections: [["Basic CBL", 0, 20], ["Inside turn", 20, 40], ["Outside turn", 40, 60]] },
      { title: "Club Shines Pack", type: "CHOREO", level: "ADVANCED", pricePaise: 24900, durationSec: 60,
        unpublishedByAdmin: "Copyright claim: soundtrack is an unlicensed commercial recording.",
        description: "Six solo shines to drop into any social dance.",
        sections: [["Shine 1–2", 0, 20], ["Shine 3–4", 20, 40], ["Shine 5–6", 40, 60]] },
    ],
  },
];

async function main() {
  // Bring the schema up to date first, so seeding works on a brand-new database.
  const turso = tursoUrl();
  if (turso) {
    console.log(`Seeding Turso database ${turso.replace(/\?.*$/, "")}`);
    if (!tursoAuthToken() && !turso.startsWith("file:")) throw new Error("TURSO_AUTH_TOKEN is not set.");
    await applyTursoMigrations(turso, tursoAuthToken());
  } else {
    console.log("Seeding local database prisma/dev.db");
    execSync("prisma migrate deploy", { stdio: "inherit" });
  }

  // Wipe in dependency order so the seed is re-runnable.
  await db.auditLog.deleteMany();
  await db.report.deleteMany();
  await db.practiceEvent.deleteMany();
  await db.entitlement.deleteMany();
  await db.order.deleteMany();
  await db.subscription.deleteMany();
  await db.follow.deleteMany();
  await db.serviceSection.deleteMany();
  await db.service.deleteMany();
  await db.teacherProfile.deleteMany();
  await db.user.deleteMany();

  const passwordHash = await bcrypt.hash("password123", 10);
  const daysAgo = (d: number) => new Date(Date.now() - d * 86400000);

  const admin = await db.user.create({
    data: { email: "admin@atelier.dev", name: "Platform Admin", role: "ADMIN", passwordHash, createdAt: daysAgo(60) },
  });

  const teachers: Record<string, { profileId: string; userId: string; services: { id: string; title: string }[] }> = {};
  let clipIdx = 0;
  for (const [i, t] of TEACHERS.entries()) {
    const user = await db.user.create({
      data: {
        email: t.email, name: t.name, role: "TEACHER", passwordHash, createdAt: daysAgo(50 - i * 5),
        teacherProfile: {
          create: {
            handle: t.handle, bio: t.bio, styles: JSON.stringify([t.style]),
            monthlyPricePaise: t.price, verified: !!t.verified, featured: !!t.featured,
          },
        },
      },
      include: { teacherProfile: true },
    });
    const services = [];
    for (const s of t.services) {
      const created = await db.service.create({
        data: {
          teacherId: user.teacherProfile!.id,
          title: s.title, type: s.type, style: t.style, level: s.level, description: s.description,
          durationSec: s.durationSec, ...clip(clipIdx++),
          pricePaise: s.pricePaise ?? 0, includedInSub: !!s.includedInSub, isFree: !!s.isFree,
          featured: !!s.featured,
          published: !s.unpublishedByAdmin,
          unpublishedByAdmin: !!s.unpublishedByAdmin,
          unpublishedReason: s.unpublishedByAdmin ?? null,
          sections: { create: s.sections.map(([label, startSec, endSec]) => ({ label, startSec, endSec })) },
        },
      });
      services.push(created);
    }
    teachers[t.handle] = { profileId: user.teacherProfile!.id, userId: user.id, services };
  }

  const student = await db.user.create({
    data: { email: "student@atelier.dev", name: "Riya Sharma", role: "STUDENT", passwordHash, createdAt: daysAgo(20) },
  });
  const arjun = await db.user.create({
    data: { email: "arjun@atelier.dev", name: "Arjun Mehta", role: "STUDENT", passwordHash, createdAt: daysAgo(30) },
  });

  // Riya has warmed up with a free demo so My Floor isn't empty.
  await db.practiceEvent.create({ data: { userId: student.id, serviceId: teachers.kabir.services[0].id, lastSec: 9 } });

  // Arjun: follows Ananya, subscribes to Ananya, bought a PPV from Min-ji.
  const ananya = teachers.ananya;
  await db.follow.create({ data: { studentId: arjun.id, teacherId: ananya.profileId } });
  await db.subscription.create({
    data: { studentId: arjun.id, teacherId: ananya.profileId, status: "ACTIVE", currentPeriodEnd: new Date(Date.now() + 20 * 86400000) },
  });
  await db.order.create({
    data: { studentId: arjun.id, type: "SUBSCRIPTION", amountPaise: 59900, teacherId: ananya.profileId, createdAt: daysAgo(10) },
  });
  for (const s of ananya.services.slice(1)) {
    await db.entitlement.create({ data: { userId: arjun.id, serviceId: s.id, teacherId: ananya.profileId, source: "SUBSCRIPTION" } });
  }
  const starlight = teachers.minji.services[2];
  await db.order.create({
    data: { studentId: arjun.id, type: "SERVICE", amountPaise: 29900, teacherId: teachers.minji.profileId, serviceId: starlight.id, createdAt: daysAgo(6) },
  });
  await db.entitlement.create({ data: { userId: arjun.id, serviceId: starlight.id, teacherId: teachers.minji.profileId, source: "PURCHASE" } });
  await db.practiceEvent.create({ data: { userId: arjun.id, serviceId: starlight.id, lastSec: 60, completed: true } });
  // An older PPV so GMV has some history.
  const nightShift = teachers.kabir.services[2];
  await db.order.create({
    data: { studentId: arjun.id, type: "SERVICE", amountPaise: 39900, teacherId: teachers.kabir.profileId, serviceId: nightShift.id, createdAt: daysAgo(15) },
  });
  await db.entitlement.create({ data: { userId: arjun.id, serviceId: nightShift.id, teacherId: teachers.kabir.profileId, source: "PURCHASE" } });

  // Two open reports for the admin queue.
  await db.report.create({
    data: {
      reporterId: arjun.id, targetType: "USER", targetUserId: teachers.diego.userId,
      reason: "spam — Bio and intro video push students to pay on an outside UPI link.", createdAt: daysAgo(2),
    },
  });
  await db.report.create({
    data: {
      reporterId: student.id, targetType: "SERVICE", targetServiceId: teachers.minji.services[1].id,
      reason: "copyright — Looks like a direct copy of an official dance practice video.", createdAt: daysAgo(1),
    },
  });

  await db.auditLog.create({
    data: { adminId: admin.id, action: "service.unpublish", detail: "Club Shines Pack — Copyright claim: soundtrack is an unlicensed commercial recording.", createdAt: daysAgo(3) },
  });

  console.log("Seeded: admin, 4 teachers, 12 services, 2 students, 3 orders, 2 open reports.");
}

main()
  .catch((e) => {
    console.error(e);
    if (/401|unauthori[sz]ed/i.test(String(e?.message ?? e)))
      console.error(
        "\nTurso rejected TURSO_AUTH_TOKEN (HTTP 401). Check that the token belongs to this database\n" +
          "(`turso db tokens create <db>`), is pasted whole on one line, and that no TURSO_* variable in\n" +
          "your shell is overriding .env. To seed the local file instead, remove the TURSO_* lines from .env.",
      );
    process.exit(1);
  })
  .finally(() => db.$disconnect());
