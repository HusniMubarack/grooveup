import Mux from "@mux/mux-node";
import type { Service } from "@prisma/client";
import { db } from "./db";

/**
 * Mux video hosting. Everything is optional: without MUX_TOKEN_ID/SECRET the app keeps using pasted
 * MP4 URLs. Env: MUX_TOKEN_ID, MUX_TOKEN_SECRET (API), MUX_SIGNING_KEY (key id) and MUX_PRIVATE_KEY
 * (base64 private key) for signed playback.
 */
const env = (...names: string[]) => {
  for (const n of names) {
    const v = process.env[n]?.trim().replace(/^["']|["']$/g, "").trim();
    if (v) return v;
  }
  return undefined;
};
// The *_ID / *_PRIVATE spellings are accepted too, so either naming works in Vercel.
const creds = () => ({
  tokenId: env("MUX_TOKEN_ID"),
  tokenSecret: env("MUX_TOKEN_SECRET"),
  jwtSigningKey: env("MUX_SIGNING_KEY", "MUX_SIGNING_KEY_ID"),
  jwtPrivateKey: env("MUX_PRIVATE_KEY", "MUX_SIGNING_KEY_PRIVATE"),
});

export const muxEnabled = () => !!(creds().tokenId && creds().tokenSecret);
export const muxSigningEnabled = () => !!(creds().jwtSigningKey && creds().jwtPrivateKey);

let client: Mux | null = null;
function mux() {
  client ??= new Mux(creds()); // MUX_BASE_URL is still read from the env (handy for tests)
  return client;
}

/** A one-off URL the teacher's browser uploads the file to. Videos are created with signed-only playback. */
export async function createDirectUpload(corsOrigin: string, teacherId: string) {
  const upload = await mux().video.uploads.create({
    cors_origin: corsOrigin,
    // passthrough tags the upload with its owner so a stolen upload id can't be attached to another account.
    new_asset_settings: { playback_policy: ["signed"], video_quality: "basic", passthrough: teacherId },
  });
  if (!upload.url) throw new Error("Mux returned no upload URL");
  return { id: upload.id, url: upload.url };
}

export async function muxUploadBelongsTo(uploadId: string, teacherId: string) {
  if (!muxEnabled()) return false;
  try {
    const up = await mux().video.uploads.retrieve(uploadId);
    return up.new_asset_settings?.passthrough === teacherId;
  } catch {
    return false;
  }
}

type MuxFields = Pick<
  Service,
  | "id" | "muxUploadId" | "muxAssetId" | "muxPlaybackId" | "videoStatus"
  | "previewStartSec" | "previewEndSec" | "previewAssetId" | "previewPlaybackId" | "previewStatus" | "previewRange"
>;

const statusOf = (s?: string) => (s === "ready" ? "ready" : s === "errored" ? "errored" : "processing");
const signedId = (ids?: { id: string; policy: string }[] | null) => ids?.find((p) => p.policy === "signed")?.id ?? null;

/**
 * Pull upload → asset → playback id from Mux until the video is ready, then keep the preview clip
 * (the teacher-picked ≤ 30 s range, cut by Mux as its own asset) in step. Cheap no-op once all is ready.
 */
export async function syncMuxVideo<T extends MuxFields>(s: T): Promise<T> {
  if (!muxEnabled() || !s.muxUploadId) return s;
  try {
    if (s.videoStatus !== "ready" && s.videoStatus !== "errored") s = await syncMain(s);
    if (s.videoStatus === "ready" && s.muxAssetId) s = await syncPreview(s);
    return s;
  } catch (e) {
    console.error("Mux sync failed:", e instanceof Error ? e.message : e);
    return s;
  }
}

async function syncMain<T extends MuxFields>(s: T): Promise<T> {
  let assetId = s.muxAssetId;
  if (!assetId) {
    const up = await mux().video.uploads.retrieve(s.muxUploadId!);
    if (up.status === "errored" || up.status === "cancelled" || up.status === "timed_out") return save(s, { videoStatus: "errored" });
    assetId = up.asset_id ?? null;
    if (!assetId) return s; // still uploading
  }
  const asset = await mux().video.assets.retrieve(assetId);
  const videoStatus = statusOf(asset.status);
  return save(s, {
    muxAssetId: assetId,
    muxPlaybackId: signedId(asset.playback_ids),
    videoStatus,
    ...(videoStatus === "ready" && asset.duration ? { durationSec: Math.round(asset.duration) } : {}),
  });
}

async function syncPreview<T extends MuxFields>(s: T): Promise<T> {
  const wanted = s.previewStartSec != null && s.previewEndSec != null ? `${s.previewStartSec}-${s.previewEndSec}` : null;
  // Range removed or changed: drop the old clip.
  if (s.previewAssetId && s.previewRange !== wanted) {
    await deleteMuxAsset(s.previewAssetId);
    s = await save(s, { previewAssetId: null, previewPlaybackId: null, previewStatus: null, previewRange: null });
  }
  if (!wanted) return s;
  if (!s.previewAssetId) {
    const clip = await mux().video.assets.create({
      inputs: [{ url: `mux://assets/${s.muxAssetId}`, start_time: s.previewStartSec!, end_time: s.previewEndSec! }],
      playback_policies: ["signed"],
      video_quality: "basic",
      passthrough: `preview:${s.id}`,
    });
    return save(s, { previewAssetId: clip.id, previewRange: wanted, previewStatus: statusOf(clip.status), previewPlaybackId: signedId(clip.playback_ids) });
  }
  if (s.previewStatus !== "ready" && s.previewStatus !== "errored") {
    const clip = await mux().video.assets.retrieve(s.previewAssetId);
    return save(s, { previewStatus: statusOf(clip.status), previewPlaybackId: signedId(clip.playback_ids) });
  }
  return s;
}

async function save<T extends MuxFields>(s: T, data: Partial<Service>): Promise<T> {
  await db.service.update({ where: { id: s.id }, data });
  return { ...s, ...data };
}

export async function deleteMuxAsset(assetId: string | null) {
  if (!assetId || !muxEnabled()) return;
  await mux().video.assets.delete(assetId).catch((e) => console.error("Mux delete failed", e));
}

/** Short-lived signed stream URL. Only call after canPlay() said yes. */
export async function signedStreamUrl(playbackId: string) {
  const token = await mux().jwt.signPlaybackId(playbackId, { type: "video", expiration: "4h" });
  return `https://stream.mux.com/${playbackId}.m3u8?token=${token}`;
}

/** Signed poster (jpg) or animated preview (gif) for cards and teasers. Not sensitive, but Mux requires a token. */
export async function signedImageUrl(playbackId: string, kind: "thumbnail" | "gif") {
  const params: Record<string, string> = kind === "gif" ? { start: "0", end: "5", width: "480" } : { width: "640", time: "2" };
  const token = await mux().jwt.signPlaybackId(playbackId, { type: kind, expiration: "1h", params });
  return kind === "gif"
    ? `https://image.mux.com/${playbackId}/animated.gif?token=${token}`
    : `https://image.mux.com/${playbackId}/thumbnail.jpg?token=${token}`;
}
