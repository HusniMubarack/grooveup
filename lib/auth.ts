import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import type { Role } from "@prisma/client";
import { db } from "./db";

class BannedError extends CredentialsSignin {
  code = "banned";
}

declare module "next-auth" {
  interface Session {
    user: { id: string; email: string; name: string; role: Role };
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(creds) {
        const email = String(creds?.email ?? "").toLowerCase().trim();
        const user = await db.user.findUnique({ where: { email } });
        if (!user || !(await bcrypt.compare(String(creds?.password ?? ""), user.passwordHash))) return null;
        if (user.banned) throw new BannedError();
        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],
  callbacks: {
    // Re-read the user on every request so role changes and bans apply immediately.
    async jwt({ token, user }) {
      const id = (user?.id ?? token.sub) as string | undefined;
      if (!id) return null;
      const u = await db.user.findUnique({ where: { id }, select: { role: true, banned: true, name: true } });
      if (!u || u.banned) return null;
      token.sub = id;
      token.role = u.role;
      token.name = u.name;
      return token;
    },
    session({ session, token }) {
      session.user.id = token.sub!;
      session.user.role = token.role as Role;
      session.user.name = token.name as string;
      return session;
    },
  },
});

export type SessionUser = { id: string; email: string; name: string; role: Role };

export async function currentUser(): Promise<SessionUser | null> {
  const s = await auth();
  return (s?.user as SessionUser) ?? null;
}

export async function requireUser(next = "/") {
  const u = await currentUser();
  if (!u) redirect(`/login?next=${encodeURIComponent(next)}`);
  return u;
}

export const isTeacher = (role?: Role) => role === "TEACHER" || role === "BOTH";

export async function requireTeacher() {
  const u = await requireUser("/studio");
  if (!isTeacher(u.role)) redirect("/");
  return u;
}

export async function requireAdmin() {
  const u = await currentUser();
  if (!u || u.role !== "ADMIN") notFound();
  return u;
}

/** Which hat a BOTH user is wearing (cookie). Others are fixed by role. */
export async function currentMode(role?: Role): Promise<"student" | "teacher"> {
  if (role === "TEACHER") return "teacher";
  if (role !== "BOTH") return "student";
  return (await cookies()).get("grooveup-mode")?.value === "teacher" ? "teacher" : "student";
}

export async function ensureTeacherProfile(userId: string, name: string) {
  const existing = await db.teacherProfile.findUnique({ where: { userId } });
  if (existing) return existing;
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 16) || "teacher";
  let handle = base;
  for (let i = 2; await db.teacherProfile.findUnique({ where: { handle } }); i++) handle = `${base}${i}`;
  return db.teacherProfile.create({ data: { userId, handle } });
}
