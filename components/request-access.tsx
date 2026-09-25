"use client";

import { useActionState, useState } from "react";
import { Check, Clock, Copy, MessageCircle, Smartphone } from "lucide-react";
import { startChatAction } from "@/app/chat-actions";
import { cancelRequestAction, requestAccessAction } from "@/app/request-actions";
import type { FormState } from "@/app/actions";
import type { UpiInfo } from "@/lib/requests";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { rupees } from "@/lib/utils";

type Pending = { id: string; sentAgo: string; paymentRef: string | null } | null;

/**
 * "Request access" for a course or lesson: show the teacher's UPI details, take an optional payment
 * reference, send the request. Payment happens outside Groove up; the teacher approves it.
 */
export function RequestAccess({ teacherId, teacherName, serviceId, amountPaise, label, upi, pending }: {
  teacherId: string; teacherName: string; serviceId?: string; amountPaise: number; label: string; upi: UpiInfo; pending: Pending;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [state, action, busy] = useActionState<FormState, FormData>(requestAccessAction, undefined);
  const first = teacherName.split(" ")[0];

  if (pending || state?.ok) {
    return (
      <div className="space-y-2 rounded-lg border border-primary/40 bg-primary/5 p-3 text-sm">
        <p className="flex items-center gap-2 font-medium text-primary"><Clock className="size-4" /> Request pending</p>
        <p className="text-xs text-muted-foreground">
          {pending ? `Sent ${pending.sentAgo}${pending.paymentRef ? ` · ref ${pending.paymentRef}` : ""}. ` : ""}
          {first} will confirm your payment and unlock it.
        </p>
        <div className="flex flex-wrap gap-2">
          <form action={startChatAction.bind(null, teacherId)}><Button size="sm" variant="secondary"><MessageCircle /> Message {first}</Button></form>
          {pending && <form action={cancelRequestAction.bind(null, pending.id)}><Button size="sm" variant="ghost">Cancel request</Button></form>}
        </div>
      </div>
    );
  }

  if (!open) {
    return (
      <Button className="w-full" onClick={() => setOpen(true)}>
        {label} · {rupees(amountPaise)}
      </Button>
    );
  }

  return (
    <form action={action} className="space-y-3 rounded-lg border bg-card p-3 text-sm">
      <input type="hidden" name="teacherId" value={teacherId} />
      {serviceId && <input type="hidden" name="serviceId" value={serviceId} />}
      <p className="font-medium">{label} · {rupees(amountPaise)}</p>
      <ol className="list-decimal space-y-1 pl-4 text-xs text-muted-foreground">
        <li>Pay {first} {rupees(amountPaise)} by UPI.</li>
        <li>Send the request with your UPI reference. {first} unlocks it once the payment is confirmed.</li>
      </ol>
      {upi ? (
        <div className="space-y-2 rounded-md border p-2">
          {upi.qrSvg && (
            // QR generated server-side from the upi:// link; contains no user-supplied markup.
            <div className="mx-auto w-40 overflow-hidden rounded bg-white p-1" aria-label="UPI QR code" dangerouslySetInnerHTML={{ __html: upi.qrSvg }} />
          )}
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded bg-muted px-2 py-1 text-xs">{upi.id}</code>
            <Button type="button" size="sm" variant="ghost" onClick={() => { navigator.clipboard?.writeText(upi.id); setCopied(true); }}>
              {copied ? <Check /> : <Copy />} {copied ? "Copied" : "Copy"}
            </Button>
          </div>
          <Button asChild size="sm" variant="outline" className="w-full md:hidden">
            <a href={upi.link}><Smartphone /> Open UPI app</a>
          </Button>
        </div>
      ) : (
        <p className="rounded-md bg-muted/60 p-2 text-xs text-muted-foreground">{first} hasn&apos;t added UPI details yet. Send the request and they&apos;ll share how to pay in chat.</p>
      )}
      <div className="grid gap-1">
        <Label htmlFor="paymentRef">UPI transaction ID (optional)</Label>
        <Input id="paymentRef" name="paymentRef" maxLength={80} placeholder="e.g. 4321 8765 1234" />
      </div>
      <div className="grid gap-1">
        <Label htmlFor="note">Note to {first} (optional)</Label>
        <Input id="note" name="note" maxLength={500} placeholder="Anything they should know" />
      </div>
      {state?.error && <p className="text-xs text-destructive">{state.error}</p>}
      <div className="flex gap-2">
        <Button className="flex-1" disabled={busy}>Send request</Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Close</Button>
      </div>
    </form>
  );
}
