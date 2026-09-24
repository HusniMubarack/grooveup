import { NextResponse, type NextRequest } from "next/server";
import { isServiceLive } from "@/lib/access";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { muxSigningEnabled, signedImageUrl } from "@/lib/mux";

/** Redirects to a freshly signed Mux poster (or ?gif=1 animated preview), so no tokens live in the DB. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await db.service.findUnique({ where: { id }, include: { teacher: { include: { user: { select: { banned: true } } } } } });
  if (!s) return new NextResponse(null, { status: 404 });
  if (!isServiceLive(s)) {
    const u = await currentUser();
    if (u?.role !== "ADMIN" && u?.id !== s.teacher.userId) return new NextResponse(null, { status: 404 });
  }
  const gif = req.nextUrl.searchParams.get("gif") === "1";
  let target = gif ? s.teaserUrl : s.thumbnailUrl;
  if (s.muxPlaybackId && muxSigningEnabled()) target = await signedImageUrl(s.muxPlaybackId, gif ? "gif" : "thumbnail");
  if (!target) return new NextResponse(null, { status: 404 });
  return NextResponse.redirect(target, { status: 302, headers: { "Cache-Control": "private, max-age=1800" } });
}
