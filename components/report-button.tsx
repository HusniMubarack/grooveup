"use client";

import { useActionState } from "react";
import { Flag } from "lucide-react";
import { reportAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Select, Textarea } from "@/components/ui/input";

export function ReportButton({ targetType, targetId }: { targetType: "USER" | "SERVICE"; targetId: string }) {
  const [state, action, pending] = useActionState(reportAction, undefined);
  return (
    <details className="group text-xs">
      <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-muted-foreground hover:text-destructive">
        <Flag className="size-3.5" /> Report
      </summary>
      {state?.ok ? (
        <p className="mt-2 text-emerald-400">{state.ok}</p>
      ) : (
        <form action={action} className="mt-2 grid max-w-sm gap-2 rounded-md border bg-card p-3">
          <input type="hidden" name="targetType" value={targetType} />
          <input type="hidden" name="targetId" value={targetId} />
          <Select name="reason" required defaultValue="">
            <option value="" disabled>Reason…</option>
            <option value="spam">Spam</option>
            <option value="copyright">Copyright</option>
            <option value="inappropriate">Inappropriate</option>
            <option value="other">Other</option>
          </Select>
          <Textarea name="note" placeholder="Optional note" maxLength={500} className="min-h-14" />
          {state?.error && <p className="text-destructive">{state.error}</p>}
          <Button size="sm" variant="destructive" disabled={pending}>Send report</Button>
        </form>
      )}
    </details>
  );
}
