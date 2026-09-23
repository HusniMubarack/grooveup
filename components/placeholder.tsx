import { Hammer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Visible stub for a post-MVP feature: title, a disabled button and a short description of intent. */
export function Placeholder({ title, action, children, className }: { title: string; action?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-lg border border-dashed border-primary/30 bg-card/50 p-4", className)}>
      <div className="mb-1 flex items-center gap-2 text-sm font-semibold">
        <Hammer className="size-4 text-primary" /> {title}
        <span className="ml-auto rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">Coming soon</span>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">{children}</p>
      {action && <Button size="sm" variant="outline" disabled className="mt-3">{action}</Button>}
    </div>
  );
}
