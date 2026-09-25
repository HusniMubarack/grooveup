"use client";

import { useActionState, useState } from "react";
import { Check } from "lucide-react";
import { approveRequestAction } from "@/app/request-actions";
import type { FormState } from "@/app/actions";
import { Button } from "@/components/ui/button";

/** Approve with an expiry the teacher picks: never, 1–3 months or a number of days. */
export function ApproveForm({ requestId, isCourse }: { requestId: string; isCourse: boolean }) {
  const [expiry, setExpiry] = useState(isCourse ? "1m" : "never");
  const [state, action, busy] = useActionState<FormState, FormData>(approveRequestAction, undefined);
  if (state?.ok) return <p className="flex items-center gap-1 text-xs text-emerald-400"><Check className="size-3.5" /> Approved</p>;
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="requestId" value={requestId} />
      <label className="sr-only" htmlFor={`exp-${requestId}`}>Access for</label>
      <select
        id={`exp-${requestId}`}
        name="expiry"
        value={expiry}
        onChange={(e) => setExpiry(e.target.value)}
        className="h-8 rounded-md border border-input bg-muted/40 px-2 text-xs"
      >
        <option value="never">No expiry</option>
        <option value="1m">1 month</option>
        <option value="2m">2 months</option>
        <option value="3m">3 months</option>
        <option value="days">Custom days…</option>
      </select>
      {expiry === "days" && (
        <input name="days" type="number" min={1} max={3650} required placeholder="days" aria-label="Number of days" className="h-8 w-20 rounded-md border border-input bg-muted/40 px-2 text-xs" />
      )}
      <Button size="sm" disabled={busy}><Check /> Approve</Button>
      {state?.error && <span className="text-xs text-destructive">{state.error}</span>}
    </form>
  );
}
