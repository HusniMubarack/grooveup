import { cn } from "@/lib/utils";

/** Groove up mark: a groove (wave) rising into an up-arrow. Shared by header, hero, loading and icons. */
export const MARK_PATHS = ["M5 22 Q8.5 13 12 19.5 T19 15.5 L25.5 8.5", "M19.5 8 H26 V14.5"];

export function LogoMark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden className={className}>
      <rect width="32" height="32" rx="8" fill="#d4af37" />
      {MARK_PATHS.map((d) => (
        <path key={d} d={d} fill="none" stroke="#1a1405" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      ))}
    </svg>
  );
}

export function Logo({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark size={size} />
      <span className="font-semibold tracking-tight" style={{ fontSize: size * 0.68 }}>
        Groove <span className="text-primary">up</span>
      </span>
    </span>
  );
}
