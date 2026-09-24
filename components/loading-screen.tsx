import { LogoMark } from "@/components/logo";

/** Groove up loader: logo over a bouncing gold equalizer. */
export function LoadingScreen() {
  return (
    <div role="status" aria-label="Loading" className="flex flex-col items-center justify-center gap-5">
      <LogoMark size={48} />
      <div className="flex h-8 items-end gap-1.5">
        {[0, 1, 2, 3, 4].map((i) => (
          <span key={i} className="groove-bar w-1.5 rounded-full bg-primary" style={{ animationDelay: `${i * 0.12}s` }} />
        ))}
      </div>
    </div>
  );
}
