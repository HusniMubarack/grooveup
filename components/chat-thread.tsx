"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { SendHorizontal } from "lucide-react";
import { getThreadAction, sendMessageAction, type ChatMessage } from "@/app/chat-actions";
import { cn } from "@/lib/utils";

const POLL_MS = 4000;

function time(iso: string) {
  const d = new Date(iso);
  const today = new Date().toDateString() === d.toDateString();
  return d.toLocaleString("en-IN", today ? { hour: "numeric", minute: "2-digit" } : { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

/** A conversation: bubbles, system notes, polling for new messages while the tab is visible. */
export function ChatThread({ conversationId, initial }: { conversationId: string; initial: ChatMessage[] }) {
  const [msgs, setMsgs] = useState(initial);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, start] = useTransition();
  const bottom = useRef<HTMLDivElement>(null);
  const last = useRef(initial.at(-1)?.createdAt);
  const router = useRouter();

  // Opening the thread marks it read on the server; refresh once so the tab badges catch up.
  useEffect(() => { router.refresh(); }, [conversationId, router]);

  const pull = async () => {
    const fresh = await getThreadAction(conversationId, last.current);
    if (fresh?.length) {
      last.current = fresh.at(-1)!.createdAt;
      setMsgs((m) => [...m.filter((x) => !x.id.startsWith("tmp-")), ...fresh.filter((f) => !m.some((x) => x.id === f.id))]);
    }
  };

  useEffect(() => {
    const iv = setInterval(() => { if (document.visibilityState === "visible") pull(); }, POLL_MS);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  useEffect(() => { bottom.current?.scrollIntoView({ block: "end" }); }, [msgs.length]);

  const send = () => {
    const body = text.trim();
    if (!body || sending) return;
    setError(null);
    setText("");
    setMsgs((m) => [...m, { id: `tmp-${Date.now()}`, body, createdAt: new Date().toISOString(), mine: true, system: false }]);
    start(async () => {
      const res = await sendMessageAction(conversationId, body);
      if (res.error) {
        setError(res.error);
        setText(body);
        setMsgs((m) => m.filter((x) => !x.id.startsWith("tmp-")));
      }
      await pull();
    });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3" aria-live="polite">
        {msgs.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">Say hello 👋</p>}
        {msgs.map((m) =>
          m.system ? (
            <p key={m.id} className="mx-auto max-w-[85%] whitespace-pre-line rounded-md bg-muted/60 px-3 py-1.5 text-center text-xs text-muted-foreground">
              {m.body} · {time(m.createdAt)}
            </p>
          ) : (
            <div key={m.id} className={cn("flex", m.mine ? "justify-end" : "justify-start")}>
              <div className={cn("max-w-[80%] rounded-2xl px-3 py-2 text-sm", m.mine ? "rounded-br-sm bg-primary text-primary-foreground" : "rounded-bl-sm bg-secondary")}>
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
                <p className={cn("mt-0.5 text-right text-[10px]", m.mine ? "text-primary-foreground/70" : "text-muted-foreground")}>
                  {m.id.startsWith("tmp-") ? "sending…" : time(m.createdAt)}
                </p>
              </div>
            </div>
          ),
        )}
        <div ref={bottom} />
      </div>
      <form
        onSubmit={(e) => { e.preventDefault(); send(); }}
        className="flex items-end gap-2 border-t bg-background p-2"
      >
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          rows={1}
          maxLength={2000}
          placeholder="Write a message…"
          aria-label="Message"
          className="max-h-32 min-h-10 flex-1 resize-none rounded-2xl border border-input bg-muted/40 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <button aria-label="Send" disabled={!text.trim() || sending} className="grid size-10 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground disabled:opacity-40">
          <SendHorizontal className="size-4" />
        </button>
      </form>
      {error && <p className="px-3 pb-2 text-xs text-destructive">{error}</p>}
    </div>
  );
}
