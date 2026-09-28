"use client";

import { useActionState, useState } from "react";
import { Clock, MessageCircle } from "lucide-react";
import { startChatAction } from "@/app/chat-actions";
import { cancelRequestAction, requestAccessAction } from "@/app/request-actions";
import type { FormState } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { rupees } from "@/lib/utils";

type Pending = { id: string; sentAgo: string } | null;

/** "Request access" for a course or lesson. The teacher (or Groove up) approves it; in-app payments come later. */
export function RequestAccess({ teacherId, teacherName, serviceId, amountPaise, label, pending }: {
  teacherId: string; teacherName: string; serviceId?: string; amountPaise: number; label: string; pending: Pending;
}) {
  const [open, setOpen] = useState(false);
  const [state, action, busy] = useActionState<FormState, FormData>(requestAccessAction, undefined);
  const first = teacherName.split(" ")[0];

  if (pending || state?.ok) {
    return (
      <div className="space-y-2 rounded-lg border border-primary/40 bg-primary/5 p-3 text-sm">
        <p className="flex items-center gap-2 font-medium text-primary"><Clock className="size-4" /> Request pending</p>
        <p className="text-xs text-muted-foreground">
          {pending ? `Sent ${pending.sentAgo}. ` : ""}You&apos;ll get access as soon as {first} approves it.
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
      <p className="text-xs text-muted-foreground">
        Send a request and {first} (or the Groove up team) will unlock it for you. In-app payments are coming soon.
      </p>
      <div className="grid gap-1">
        <Label htmlFor="note">Note to {first} (optional)</Label>
        <Input id="note" name="note" maxLength={500} placeholder="Your level, what you want to learn…" />
      </div>
      {state?.error && <p className="text-xs text-destructive">{state.error}</p>}
      <div className="flex gap-2">
        <Button className="flex-1" disabled={busy}>Send request</Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Close</Button>
      </div>
    </form>
  );
}
