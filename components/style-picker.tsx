"use client";

import { useActionState, useState } from "react";
import { Check } from "lucide-react";
import { saveDanceStylesAction } from "@/app/actions";
import type { FormState } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Big tappable style tiles (multi-select) + optional level. */
export function StylePicker({ styles, initial, initialLevel, next }: {
  styles: { name: string; blurb: string }[]; initial: string[]; initialLevel?: string; next?: string;
}) {
  const [picked, setPicked] = useState<string[]>(initial);
  const [state, action, busy] = useActionState<FormState, FormData>(saveDanceStylesAction, undefined);
  const toggle = (s: string) => setPicked((p) => (p.includes(s) ? p.filter((x) => x !== s) : [...p, s]));

  return (
    <form action={action} className="space-y-6">
      {next && <input type="hidden" name="next" value={next} />}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {styles.map(({ name, blurb }) => {
          const on = picked.includes(name);
          return (
            <label
              key={name}
              className={cn(
                "relative flex min-h-28 cursor-pointer flex-col justify-end rounded-xl border p-3 transition-colors",
                on ? "border-primary bg-primary/15" : "bg-card hover:border-primary/50",
              )}
            >
              <input type="checkbox" name="style" value={name} checked={on} onChange={() => toggle(name)} className="sr-only" />
              {on && <Check className="absolute right-3 top-3 size-5 text-primary" />}
              <span className="font-semibold">{name}</span>
              <span className="text-xs text-muted-foreground">{blurb}</span>
            </label>
          );
        })}
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm text-muted-foreground">Your level (optional)</legend>
        <div className="flex flex-wrap gap-2">
          {["BEGINNER", "INTERMEDIATE", "ADVANCED"].map((l) => (
            <label key={l} className="cursor-pointer rounded-full border px-3 py-1 text-xs capitalize has-[:checked]:border-primary has-[:checked]:bg-primary has-[:checked]:text-primary-foreground">
              <input type="radio" name="level" value={l} defaultChecked={initialLevel === l} className="sr-only" />
              {l.toLowerCase()}
            </label>
          ))}
        </div>
      </fieldset>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button size="lg" className="w-full sm:w-auto" disabled={busy || picked.length === 0}>
        {picked.length ? `Show me ${picked.length === 1 ? picked[0] : `${picked.length} styles`}` : "Pick at least one style"}
      </Button>
    </form>
  );
}
