import Link from "next/link";
import { BadgeCheck, Sparkles } from "lucide-react";
import { publicServiceWhere } from "@/lib/access";
import { db } from "@/lib/db";
import { parseStyles, rupees } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { LogoMark } from "@/components/logo";
import { Placeholder } from "@/components/placeholder";
import { ServiceCard } from "@/components/service-card";

export default async function Landing() {
  const [featuredTeachers, featuredServices] = await Promise.all([
    db.teacherProfile.findMany({ where: { featured: true, user: { banned: false } }, include: { user: true } }),
    db.service.findMany({
      where: { ...publicServiceWhere, OR: [{ featured: true }, { isFree: true }] },
      include: { teacher: { include: { user: true } } },
      orderBy: [{ featured: "desc" }, { createdAt: "desc" }],
      take: 4,
    }),
  ]);

  return (
    <div className="space-y-12">
      <section className="relative overflow-hidden rounded-2xl border bg-[radial-gradient(ellipse_at_top,_#3a2d0c_0%,_#0b0a09_65%)] px-5 py-14 text-center md:py-20">
        <LogoMark size={56} className="mx-auto" />
        <h1 className="mt-3 font-serif text-4xl leading-tight md:text-6xl">Your teacher.<br />Your floor.</h1>
        <p className="mx-auto mt-4 max-w-md text-muted-foreground">
          Hip-hop, Bharatanatyam, K-Pop and salsa from independent teachers. Slow it down, mirror it, loop the hard part —
          right on your phone.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Button asChild size="lg"><Link href="/explore">Explore lessons</Link></Button>
          <Button asChild size="lg" variant="outline"><Link href="/register?role=TEACHER">Teach on Groove up</Link></Button>
        </div>
      </section>

      {featuredTeachers.length > 0 && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 font-serif text-2xl"><Sparkles className="size-5 text-primary" /> Featured teachers</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {featuredTeachers.map((t) => (
              <Link key={t.id} href={`/t/${t.handle}`} className="rounded-lg border border-primary/60 bg-gradient-to-br from-primary/15 to-card p-4 hover:border-primary">
                <div className="flex items-center gap-2 font-semibold">
                  {t.user.name} {t.verified && <BadgeCheck className="size-4 text-primary" />}
                </div>
                <p className="text-xs text-primary">{parseStyles(t.styles).join(" · ")} · {rupees(t.monthlyPricePaise)}/mo</p>
                <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{t.bio}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="mb-3 flex items-end justify-between">
          <h2 className="font-serif text-2xl">Start moving</h2>
          <Link href="/explore" className="text-sm text-primary">See all →</Link>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {featuredServices.map((s) => <ServiceCard key={s.id} s={s} />)}
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
