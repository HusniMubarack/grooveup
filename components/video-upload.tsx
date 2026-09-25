"use client";

import { useRef, useState } from "react";
import { CheckCircle2, UploadCloud } from "lucide-react";
import { createMuxUploadAction } from "@/app/actions";
import { Button } from "@/components/ui/button";

/**
 * Sends the teacher's file straight from the browser to Mux (resumable 5 MB chunks), so videos never
 * touch our server. The resulting upload id rides along with the lesson form in a hidden input.
 */
export function VideoUpload({ initialUploadId, status }: { initialUploadId?: string | null; status?: string | null }) {
  const [uploadId, setUploadId] = useState(initialUploadId ?? "");
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  async function start(file: File) {
    setError(null);
    setDone(false);
    setProgress(0);
    const res = await createMuxUploadAction();
    if ("error" in res) {
      setError(res.error);
      setProgress(null);
      return;
    }
    const { UpChunk } = await import("@mux/upchunk");
    const up = UpChunk.createUpload({ endpoint: res.url, file, chunkSize: 5120 });
    up.on("progress", (e) => setProgress(Math.round(e.detail as number)));
    up.on("error", (e) => {
      setError((e.detail as { message?: string })?.message ?? "Upload failed.");
      setProgress(null);
    });
    up.on("success", () => {
      setUploadId(res.id);
      setDone(true);
      setProgress(null);
    });
  }

  return (
    <div className="grid gap-2 rounded-md border border-dashed border-primary/40 p-3">
      <input type="hidden" name="muxUploadId" value={uploadId} />
      <input
        ref={input}
        type="file"
        accept="video/*"
        hidden
        onChange={(e) => e.target.files?.[0] && start(e.target.files[0])}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" disabled={progress !== null} onClick={() => input.current?.click()}>
          <UploadCloud /> {uploadId ? "Replace video" : "Upload video"}
        </Button>
        {progress !== null && <span className="text-xs text-muted-foreground">Uploading… {progress}%</span>}
        {done && <span className="flex items-center gap-1 text-xs text-emerald-400"><CheckCircle2 className="size-3.5" /> Uploaded. Save the lesson to finish.</span>}
        {!done && uploadId && status && <span className="text-xs text-muted-foreground">Hosted on Mux · {status}</span>}
      </div>
      {progress !== null && (
        <div className="h-1.5 overflow-hidden rounded bg-muted"><div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} /></div>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
      <p className="text-[11px] text-muted-foreground">
        Goes straight to secure video hosting (Mux). Students can only stream it through Groove up with a short-lived link.
      </p>
    </div>
  );
}
