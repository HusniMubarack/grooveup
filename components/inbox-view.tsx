import Link from "next/link";
import { MessageCircle, Search } from "lucide-react";
import { listConversations, type Side } from "@/lib/chat";
import { cn, timeAgo } from "@/lib/utils";
import type { ChatMessage } from "@/app/chat-actions";
import { ChatThread } from "@/components/chat-thread";

type Active = { id: string; title: string; header?: React.ReactNode; messages: ChatMessage[] };

/**
 * Inbox: searchable conversation list + open thread. Side by side on desktop; on phones the list and
 * the thread are separate screens (?q/unread filters keep working on both).
 */
export async function InboxView({ side, ownerId, base, q, unread, active }: {
  side: Side; ownerId: string; base: string; q?: string; unread?: boolean; active?: Active;
}) {
  const list = await listConversations(side, ownerId, q, unread);
  const qs = (extra: Record<string, string | undefined>) => {
    const p = new URLSearchParams(Object.entries({ q, unread: unread ? "1" : undefined, ...extra }).filter(([, v]) => v) as [string, string][]);
    const s = p.toString();
    return s ? `?${s}` : "";
  };

  return (
    <div className="grid overflow-hidden rounded-xl border bg-card md:h-[70dvh] md:grid-cols-[18rem_1fr]">
      <aside className={cn("flex min-h-0 flex-col border-r", active && "hidden md:flex")}>
        <form className="flex items-center gap-2 border-b p-2" action={base}>
          <Search className="ml-1 size-4 shrink-0 text-muted-foreground" />
          <input name="q" defaultValue={q} placeholder={side === "teacher" ? "Search students or messages" : "Search teachers or messages"} className="h-9 min-w-0 flex-1 bg-transparent text-sm outline-none" />
          {unread && <input type="hidden" name="unread" value="1" />}
        </form>
        <div className="flex gap-1 border-b px-2 py-1.5 text-xs">
          <Link href={`${base}${qs({ unread: undefined })}`} className={cn("rounded-full px-2.5 py-1", !unread ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>All</Link>
          <Link href={`${base}${qs({ unread: "1" })}`} className={cn("rounded-full px-2.5 py-1", unread ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>Unread</Link>
        </div>
        <ul className="min-h-0 flex-1 divide-y overflow-y-auto">
          {list.length === 0 && (
            <li className="p-6 text-center text-sm text-muted-foreground">
              {q || unread ? "No matching conversations." : side === "teacher" ? "Students' messages will show up here." : "Message a teacher from their lesson or profile page."}
            </li>
          )}
          {list.map((c) => {
            const name = side === "teacher" ? c.student.name : c.teacher.user.name;
            const last = c.messages[0];
            return (
              <li key={c.id}>
                <Link href={`${base}/${c.id}${qs({})}`} className={cn("flex items-start gap-2 p-3 hover:bg-muted/40", active?.id === c.id && "bg-muted/60")}>
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-secondary text-sm font-semibold">{name[0]}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className={cn("truncate text-sm", c.unread && "font-semibold")}>{name}</span>
                      <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">{timeAgo(c.lastMessageAt)}</span>
                    </span>
                    <span className={cn("line-clamp-1 text-xs", c.unread ? "text-foreground" : "text-muted-foreground")}>
                      {last ? (last.senderId === null ? `· ${last.body}` : last.body) : "No messages yet"}
                    </span>
                  </span>
                  {c.unread && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />}
                </Link>
              </li>
            );
          })}
        </ul>
      </aside>

      <section className={cn("flex min-h-[70dvh] flex-col md:min-h-0", !active && "hidden md:flex")}>
        {active ? (
          <>
            <header className="flex items-center gap-2 border-b p-3">
              <Link href={`${base}${qs({})}`} className="text-sm text-muted-foreground md:hidden" aria-label="Back to inbox">←</Link>
              <h2 className="truncate font-semibold">{active.title}</h2>
            </header>
            {active.header && <div className="border-b bg-muted/30 p-3 text-sm">{active.header}</div>}
            <ChatThread key={active.id} conversationId={active.id} initial={active.messages} />
          </>
        ) : (
          <div className="m-auto flex flex-col items-center gap-2 p-10 text-center text-sm text-muted-foreground">
            <MessageCircle className="size-8 text-primary" />
            Pick a conversation
          </div>
        )}
      </section>
    </div>
  );
}
