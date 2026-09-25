"use client";

import { useActionState } from "react";
import { savePaymentDetailsAction } from "@/app/request-actions";
import type { FormState } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

export function PaymentDetailsForm({ upiId, showUpiQr, coursePrice, qrSvg }: { upiId: string; showUpiQr: boolean; coursePrice: number; qrSvg: string | null }) {
  const [state, action, busy] = useActionState<FormState, FormData>(savePaymentDetailsAction, undefined);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-[1fr_auto]">
      <div className="grid gap-3">
        <div className="grid gap-1">
          <Label htmlFor="upiId">Your UPI ID</Label>
          <Input id="upiId" name="upiId" defaultValue={upiId} placeholder="yourname@okaxis" />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="coursePrice">Course price (₹ per month)</Label>
          <Input id="coursePrice" name="coursePrice" type="number" min={0} step={1} defaultValue={coursePrice} />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="showUpiQr" defaultChecked={showUpiQr} className="size-4 accent-[var(--primary)]" /> Show a UPI QR code to students
        </label>
        <div className="flex items-center gap-2">
          <Button size="sm" disabled={busy}>Save</Button>
          {state?.ok && <span className="text-xs text-emerald-400">Saved</span>}
          {state?.error && <span className="text-xs text-destructive">{state.error}</span>}
        </div>
      </div>
      {qrSvg && (
        <div className="justify-self-center text-center">
          {/* Generated on the server from your UPI ID; nothing is uploaded. */}
          <div className="w-32 overflow-hidden rounded bg-white p-1" dangerouslySetInnerHTML={{ __html: qrSvg }} />
          <p className="mt-1 text-[10px] text-muted-foreground">What students scan</p>
        </div>
      )}
    </form>
  );
}
