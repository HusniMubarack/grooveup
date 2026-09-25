import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { canPlay } from "@/lib/access";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { muxSigningEnabled, signedStreamUrl, syncMuxVideo } from "@/lib/mux";
import { Placeholder } from "@/components/placeholder";
import { Player } from "@/components/player";
import { thumbSrc } from "@/components/service-card";

export default async function PlayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(`/play/${id}`);
  const s = await db.service.findUnique({
    where: { id },
    include: { teacher: { include: { user: true } }, sections: { orderBy: { startSec: "asc" } } },
  });
  if (!s) notFound();
  if (!(await canPlay(user, s))) redirect(`/s/${id}`);

  const progress = await db.practiceEvent.findUnique({ where: { userId_serviceId: { userId: user.id, serviceId: id } } });
  // Access is already checked above; only now is a short-lived signed stream URL minted.
  const video = await syncMuxVideo(s);
  const hostedOnMux = !!video.muxUploadId;
  const muxReady = hostedOnMux && video.videoStatus === "ready" && !!video.muxPlaybackId && muxSigningEnabled();
  const src = muxReady ? await signedStreamUrl(video.muxPlaybackId!) : hostedOnMux ? "" : s.videoUrl;
  const notice = !hostedOnMux || muxReady
    ? null
    : video.videoStatus === "errored"
      ? "Video processing failed. Ask the teacher to upload it again."
      : !muxSigningEnabled()
        ? "Video playback isn't configured on this server yet (missing Mux signing key)."
        : "This video is still processing. Check back in a minute.";

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link href={`/s/${id}`} className="flex items-center gap-1 text-sm text-muted-foreground"><ArrowLeft className="size-4" /> {s.teacher.user.name}</Link>
      <h1 className="font-serif text-2xl leading-tight">{s.title}</h1>
      {notice && <p className="rounded-md border border-primary/40 bg-primary/10 p-3 text-sm">{notice}</p>}
      <Player
        serviceId={s.id}
        src={src}
        poster={thumbSrc(video) || undefined}
        sections={s.sections}
        startAt={progress && !progress.completed ? progress.lastSec : 0}
      />
      <div className="grid gap-3 pt-4 md:grid-cols-2">
        <Placeholder title="Notes & reviews" action="Add note at 0:00">
          Timestamped private notes pinned to the timeline, and a star review you can leave once you&apos;ve unlocked the
          lesson.
        </Placeholder>
        <Placeholder title="Compare my take" action="Open camera">
          Record yourself with the front camera side-by-side with the teacher video, synced to the same section and speed.
        </Placeholder>
      </div>
    </div>
  );
}
