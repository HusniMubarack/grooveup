import type { Prisma } from "@prisma/client";
import { db } from "./db";

export const MAX_MESSAGE = 2000;

/** One conversation per student–teacher pair. */
export async function ensureConversation(studentId: string, teacherId: string) {
  return db.conversation.upsert({
    where: { studentId_teacherId: { studentId, teacherId } },
    create: { studentId, teacherId },
    update: {},
  });
}

/** Adds a message; senderId null = system message (request sent / approved / declined …). */
export async function postMessage(conversationId: string, senderId: string | null, body: string, side?: "student" | "teacher") {
  const now = new Date();
  await db.$transaction([
    db.message.create({ data: { conversationId, senderId, body: body.slice(0, MAX_MESSAGE), createdAt: now } }),
    db.conversation.update({
      where: { id: conversationId },
      // The sender has obviously read everything up to their own message.
      data: { lastMessageAt: now, ...(side === "student" ? { studentReadAt: now } : side === "teacher" ? { teacherReadAt: now } : {}) },
    }),
  ]);
}

export async function systemMessage(studentId: string, teacherId: string, body: string) {
  const c = await ensureConversation(studentId, teacherId);
  await postMessage(c.id, null, body);
}

export type Side = "student" | "teacher";

/** The conversation if this user is in it, and which side they're on. */
export async function conversationFor(id: string, userId: string, teacherProfileId?: string | null) {
  const c = await db.conversation.findUnique({
    where: { id },
    include: { student: { select: { id: true, name: true, email: true } }, teacher: { include: { user: { select: { id: true, name: true } } } } },
  });
  if (!c) return null;
  if (c.studentId === userId) return { c, side: "student" as Side };
  if (teacherProfileId && c.teacherId === teacherProfileId) return { c, side: "teacher" as Side };
  return null;
}

export async function listConversations(side: Side, id: string, q?: string, unreadOnly?: boolean) {
  const where: Prisma.ConversationWhereInput = side === "student" ? { studentId: id } : { teacherId: id };
  if (q) {
    const other = side === "student" ? { teacher: { user: { name: { contains: q } } } } : { student: { OR: [{ name: { contains: q } }, { email: { contains: q } }] } };
    where.OR = [other, { messages: { some: { body: { contains: q } } } }];
  }
  const rows = await db.conversation.findMany({
    where,
    include: {
      student: { select: { name: true } },
      teacher: { include: { user: { select: { name: true } } } },
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
    },
    orderBy: { lastMessageAt: "desc" },
  });
  const withUnread = rows.map((c) => ({
    ...c,
    unread: c.lastMessageAt > (side === "student" ? c.studentReadAt : c.teacherReadAt) && c.messages[0]?.senderId !== (side === "student" ? c.studentId : c.teacher.userId),
  }));
  return unreadOnly ? withUnread.filter((c) => c.unread) : withUnread;
}

/** Unread conversation count for badges. */
export async function unreadCount(side: Side, id: string) {
  const list = await listConversations(side, id);
  return list.filter((c) => c.unread).length;
}
