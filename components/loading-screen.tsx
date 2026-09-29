import { Dancer } from "@/components/dancer";

/** Groove up loader: a hip-hop dancer silhouette warming up. */
export function LoadingScreen({ label = "Warming up…" }: { label?: string }) {
  return (
    <div role="status" aria-label="Loading" className="flex flex-col items-center justify-center gap-2">
      <Dancer size={84} />
      <p className="text-xs uppercase tracking-[0.3em] text-primary/80">{label}</p>
    </div>
  );
}
