"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { conversationFor, ensureConversation, MAX_MESSAGE, postMessage } from "@/lib/chat";
import { db } from "@/lib/db";

export type ChatMessage = { id: string; body: string; createdAt: string; mine: boolean; system: boolean };

async function teacherIdOf(userId: string) {
  return (await db.teacherProfile.findUnique({ where: { userId }, select: { id: true } }))?.id ?? null;
}

/** Student opens (or creates) their conversation with a teacher. Teachers can't cold-message students. */
export async function startChatAction(teacherId: string) {
  const u = await requireUser("/me/inbox");
  const t = await db.teacherProfile.findUnique({ where: { id: teacherId }, include: { user: { select: { banned: true } } } });
  if (!t || t.user.banned || t.userId === u.id) redirect("/me/inbox");
  const c = await ensureConversation(u.id, teacherId);
  redirect(`/me/inbox/${c.id}`);
}

export async function sendMessageAction(conversationId: string, body: string): Promise<{ error?: string }> {
  const u = await requireUser();
  const found = await conversationFor(conversationId, u.id, await teacherIdOf(u.id));
  if (!found) return { error: "Conversation not found." };
  const text = body.trim();
  if (!text) return { error: "Type a message." };
  if (text.length > MAX_MESSAGE) return { error: `Keep it under ${MAX_MESSAGE} characters.` };
  await postMessage(conversationId, u.id, text, found.side);
  return {};
}

/** Messages after a timestamp (for polling), and marks the thread read for the caller. */
export async function getThreadAction(conversationId: string, afterIso?: string): Promise<ChatMessage[] | null> {
  const u = await requireUser();
  const found = await conversationFor(conversationId, u.id, await teacherIdOf(u.id));
  if (!found) return null;
  const after = afterIso ? new Date(afterIso) : undefined;
  const msgs = await db.message.findMany({
    where: { conversationId, ...(after ? { createdAt: { gt: after } } : {}) },
    orderBy: { createdAt: "asc" },
    take: after ? 100 : 300,
  });
  if (msgs.length || !after)
    await db.conversation.update({
      where: { id: conversationId },
      data: found.side === "student" ? { studentReadAt: new Date() } : { teacherReadAt: new Date() },
    });
  return msgs.map((m) => ({ id: m.id, body: m.body, createdAt: m.createdAt.toISOString(), mine: m.senderId === u.id, system: m.senderId === null }));
}
