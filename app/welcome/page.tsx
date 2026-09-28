import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { parsePrefs, STYLE_INFO } from "@/lib/prefs";
import { STYLES } from "@/lib/utils";
import { LogoMark } from "@/components/logo";
import { StylePicker } from "@/components/style-picker";

/** Onboarding (also reachable later via "Edit" on Explore): what does this student want to dance? */
export default async function Welcome({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const user = await requireUser("/welcome");
  const u = await db.user.findUnique({ where: { id: user.id }, select: { danceStyles: true } });
  const prefs = parsePrefs(u?.danceStyles);
  return (
    <div className="mx-auto max-w-2xl space-y-6 py-4">
      <div className="space-y-2">
        <LogoMark size={40} />
        <h1 className="font-serif text-3xl">{prefs ? "Your dance styles" : `Welcome, ${user.name.split(" ")[0]}!`}</h1>
        <p className="text-muted-foreground">What do you want to dance? We&apos;ll fill your feed with just these. Change it any time.</p>
      </div>
      <StylePicker
        styles={STYLES.map((name) => ({ name, blurb: STYLE_INFO[name] ?? "" }))}
        initial={prefs?.styles ?? []}
        initialLevel={prefs?.level}
        next={next?.startsWith("/") && !next.startsWith("//") ? next : undefined}
      />
    </div>
  );
}
