"use client";

import { useActionState } from "react";
import { saveCoursePriceAction } from "@/app/request-actions";
import type { FormState } from "@/app/actions";

/** Inline "Course price ₹/month" (what a course request costs). */
export function CoursePriceForm({ rupeesPerMonth }: { rupeesPerMonth: number }) {
  const [state, action, busy] = useActionState<FormState, FormData>(saveCoursePriceAction, undefined);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2 text-sm">
      <label htmlFor="coursePrice" className="text-muted-foreground">Course price</label>
      <span className="flex items-center rounded-md border bg-card pl-2">
        ₹<input id="coursePrice" name="coursePrice" type="number" min={0} step={1} defaultValue={rupeesPerMonth} className="h-8 w-20 bg-transparent px-1 outline-none" />
        <span className="pr-2 text-xs text-muted-foreground">/month</span>
      </span>
      <button disabled={busy} className="h-8 rounded-md bg-secondary px-2 text-xs">Save</button>
      {state?.ok && <span className="text-xs text-emerald-400">Saved</span>}
      {state?.error && <span className="text-xs text-destructive">{state.error}</span>}
    </form>
  );
}
