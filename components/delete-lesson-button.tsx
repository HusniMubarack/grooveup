"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { deleteServiceAction } from "@/app/actions";
import { Button } from "@/components/ui/button";

export function DeleteLessonButton({ id, disabledReason }: { id: string; disabledReason: string | null }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="grid gap-2">
      <Button
        type="button"
        variant="destructive"
        size="sm"
        className="justify-self-start"
        disabled={!!disabledReason || pending}
        title={disabledReason ?? undefined}
        onClick={() => {
          if (!confirm("Delete this lesson for good?")) return;
          start(async () => {
            const res = await deleteServiceAction(id);
            if (res?.error) setError(res.error);
          });
        }}
      >
        <Trash2 /> Delete lesson
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
