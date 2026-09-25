import { conversationFor } from "./chat";
import { db } from "./db";
import type { ChatMessage } from "@/app/chat-actions";

/** Loads a conversation for a participant (or null), its messages, and marks it read for them. */
export async function loadThread(id: string, userId: string, teacherProfileId?: string | null) {
  const found = await conversationFor(id, userId, teacherProfileId);
  if (!found) return null;
  const msgs = await db.message.findMany({ where: { conversationId: id }, orderBy: { createdAt: "asc" }, take: 300 });
  await db.conversation.update({
    where: { id },
    data: found.side === "student" ? { studentReadAt: new Date() } : { teacherReadAt: new Date() },
  });
  const messages: ChatMessage[] = msgs.map((m) => ({
    id: m.id, body: m.body, createdAt: m.createdAt.toISOString(), mine: m.senderId === userId, system: m.senderId === null,
  }));
  return { ...found, messages };
}
