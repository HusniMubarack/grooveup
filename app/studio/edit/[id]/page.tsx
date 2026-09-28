import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireTeacher } from "@/lib/auth";
import { db } from "@/lib/db";
import { deleteBlocker } from "@/lib/lessons";
import { muxEnabled, muxSigningEnabled, signedStreamUrl, syncMuxVideo } from "@/lib/mux";
import { DeleteLessonButton } from "@/components/delete-lesson-button";
import { ServiceForm } from "@/components/service-form";

export default async function EditService({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireTeacher();
  const found = await db.service.findUnique({ where: { id }, include: { teacher: true, sections: { orderBy: { startSec: "asc" } } } });
  // Only the owner may edit; everyone else is sent back to their own Studio.
  if (!found || found.teacher.userId !== user.id) redirect("/studio");
  const s = await syncMuxVideo(found);
  const blocker = await deleteBlocker(s);
  // The teacher's own video for the preview picker (signed stream for Mux lessons).
  const currentVideoSrc =
    s.muxPlaybackId && s.videoStatus === "ready" && muxSigningEnabled() ? await signedStreamUrl(s.muxPlaybackId) : s.muxUploadId ? null : s.videoUrl || null;

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <Link href="/studio" className="flex items-center gap-1 text-sm text-muted-foreground"><ArrowLeft className="size-4" /> Studio</Link>
      <h1 className="font-serif text-3xl">Edit lesson</h1>
      <ServiceForm service={s} muxEnabled={muxEnabled()} currentVideoSrc={currentVideoSrc} />
      <div className="rounded-xl border border-destructive/40 p-4">
        <h2 className="text-sm font-semibold">Delete lesson</h2>
        <p className="mb-3 text-xs text-muted-foreground">{blocker ?? "Nobody has this lesson yet, so it can be deleted for good."}</p>
        <DeleteLessonButton id={s.id} disabledReason={blocker} />
      </div>
    </div>
  );
}
