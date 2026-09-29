import Link from "next/link";
import { ArrowRight, BadgeCheck, MessageCircle, Repeat, Sparkles } from "lucide-react";
import { publicServiceWhere } from "@/lib/access";
import { db } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { feedStyles } from "@/lib/prefs";
import { parseStyles, rupees, STYLES } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dancer } from "@/components/dancer";
import { HeroVideo } from "@/components/hero-video";
import { Placeholder } from "@/components/placeholder";
import { ServiceCard } from "@/components/service-card";

// Owner-provided stock clip: drop a file at public/hero/dance.mp4, or point this env var at a URL.
const HERO_VIDEO = process.env.NEXT_PUBLIC_HERO_VIDEO_URL || "/hero/dance.mp4";

const STEPS = [
  { n: "01", title: "Pick your style", body: "Hip-hop, Bharatanatyam, K-Pop, salsa… your feed shows only what you love.", icon: Sparkles },
  { n: "02", title: "Practice your way", body: "Slow it to 0.5×, mirror it, loop the hard eight counts with a breather between.", icon: Repeat },
  { n: "03", title: "Ask your teacher", body: "Real teachers, real replies. Request a course and chat when you're stuck.", icon: MessageCircle },
];

export default async function Landing() {
  const user = await currentUser();
  // Signed-in students see only the styles they picked.
  const only = await feedStyles(user);
  const [featuredTeachers, featuredServices] = await Promise.all([
    db.teacherProfile.findMany({
      where: { featured: true, user: { banned: false }, ...(only ? { OR: only.map((st) => ({ styles: { contains: `"${st}"` } })) } : {}) },
      include: { user: true },
    }),
    db.service.findMany({
      where: { ...publicServiceWhere, OR: [{ featured: true }, { isFree: true }], ...(only ? { style: { in: only } } : {}) },
      include: { teacher: { include: { user: true } } },
      orderBy: [{ featured: "desc" }, { createdAt: "desc" }],
      take: 4,
    }),
  ]);

  return (
    <div className="space-y-16">
      <div className="beat-bar" aria-hidden />

      {/* Hero: full-bleed stage. Dancer silhouette paints instantly; the stock clip fades in after idle. */}
      <section className="grain relative -mt-4 ml-[calc(50%-50vw)] flex min-h-[calc(100dvh-3.5rem)] w-screen items-center overflow-hidden bg-[radial-gradient(ellipse_at_70%_20%,#3a2d0c_0%,#0b0a09_60%)]">
        <HeroVideo src={HERO_VIDEO} />
        <div className="drift pointer-events-none absolute bottom-[4%] right-[-8%] opacity-70 sm:right-[6%] md:right-[12%]" aria-hidden>
          <Dancer size={260} variant="hero" className="h-auto w-[62vw] max-w-[340px]" />
        </div>
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" aria-hidden />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-background/90 via-background/30 to-transparent" aria-hidden />

        <div className="relative mx-auto w-full max-w-5xl px-4 py-16">
          <p className="rise inline-flex items-center gap-2 rounded-full border border-primary/40 bg-black/40 px-3 py-1 text-[11px] uppercase tracking-[0.25em] text-primary backdrop-blur" style={{ "--d": 0 } as React.CSSProperties}>
            <span className="size-1.5 animate-pulse rounded-full bg-primary" /> Dance classes on your phone
          </p>
          <h1 className="rise-t mt-5 font-serif text-5xl leading-[0.95] tracking-tight sm:text-7xl">
            Your teacher.
            <br />
            <span className="relative inline-block text-primary">
              Your floor.
              <span className="sweep absolute -bottom-1 left-0 h-1 w-full rounded-full bg-primary" aria-hidden />
            </span>
          </h1>
          <p className="rise-t mt-6 max-w-md text-base text-foreground/80 sm:text-lg">
            Learn hip-hop, Bharatanatyam, K-Pop and salsa from real teachers. Slow it down, mirror it, loop the hard part.
          </p>
          <div className="rise mt-8 flex flex-wrap items-center gap-3" style={{ "--d": 3 } as React.CSSProperties}>
            {user ? (
              <Button asChild size="lg" className="rounded-full px-7"><Link href="/explore">Go to Explore <ArrowRight /></Link></Button>
            ) : (
              <>
                <Button asChild size="lg" className="rounded-full px-7 shadow-[0_0_40px_-8px_rgba(212,175,55,.7)]"><Link href="/register">Start dancing free <ArrowRight /></Link></Button>
                <Button asChild size="lg" variant="outline" className="rounded-full border-foreground/20 bg-black/30 backdrop-blur"><Link href="/register?role=TEACHER">I teach</Link></Button>
                <Link href="/login" className="px-2 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">Sign in</Link>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Style marquee on a tilt */}
      <div className="-mx-4 overflow-hidden py-4" aria-hidden>
        <div className="-mx-6 -rotate-2 border-y border-primary/30 bg-primary/10 py-3">
          <div className="marquee-track flex w-max gap-8 whitespace-nowrap font-serif text-2xl uppercase tracking-widest text-primary/90">
            {[...STYLES, ...STYLES, ...STYLES, ...STYLES].map((s, i) => (
              <span key={i} className="flex items-center gap-8">{s}<span className="text-primary/40">✦</span></span>
            ))}
          </div>
        </div>
      </div>

      {/* How it works, with a shadow dancer crossing the stage as you scroll */}
      <section className="relative overflow-x-clip">
        <h2 className="kinetic mb-6 font-serif text-3xl sm:text-4xl">How it works</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {STEPS.map(({ n, title, body, icon: Icon }, i) => (
            <div key={n} className="step-in tilt relative overflow-hidden rounded-2xl border bg-card p-5" style={{ "--i": i } as React.CSSProperties}>
              <span className="absolute -right-2 -top-4 font-serif text-7xl text-primary/10">{n}</span>
              <Icon className="size-6 text-primary" />
              <h3 className="mt-3 text-lg font-semibold">{title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
        <div className="cross pointer-events-none absolute -bottom-10 left-0 opacity-40" aria-hidden>
          <Dancer size={46} />
        </div>
      </section>

      {featuredTeachers.length > 0 && (
        <section className="overflow-x-clip">
          <h2 className="kinetic mb-4 flex items-center gap-2 font-serif text-3xl"><Sparkles className="size-6 text-primary" /> Featured teachers</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {featuredTeachers.map((t, i) => (
              <Link key={t.id} href={`/t/${t.handle}`} style={{ "--i": i } as React.CSSProperties} className="step-in tilt block rounded-2xl border border-primary/50 bg-gradient-to-br from-primary/15 to-card p-5 hover:border-primary">
                <div className="flex items-center gap-2 text-lg font-semibold">
                  {t.user.name} {t.verified && <BadgeCheck className="size-4 text-primary" />}
                </div>
                <p className="text-xs text-primary">{parseStyles(t.styles).join(" · ")} · {rupees(t.monthlyPricePaise)}/mo</p>
                <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{t.bio}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="overflow-x-clip">
        <div className="mb-4 flex items-end justify-between">
          <h2 className="kinetic font-serif text-3xl">Start moving</h2>
          <Link href="/explore" className="flex items-center gap-1 text-sm text-primary">See all <ArrowRight className="size-3.5" /></Link>
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-5 md:grid-cols-4">
          {featuredServices.map((s, i) => (
            <div key={s.id} className="step-in" style={{ "--i": i } as React.CSSProperties}><ServiceCard s={s} /></div>
          ))}
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2">
        <Placeholder title="Native app" action="Get the app">
          An Expo (React Native) app sharing this backend, with offline downloads and background audio for practice.
          The web app stays mobile-first until then.
        </Placeholder>
        <Placeholder title="Install Groove up" action="Add to home screen">
          PWA install with a manifest and service worker so the app opens full-screen from the home screen.
          Out of scope for the MVP, which is plain mobile-first web.
        </Placeholder>
      </section>
    </div>
  );
}
