import Mux from "@mux/mux-node";
import type { Service } from "@prisma/client";
import { db } from "./db";

/**
 * Mux video hosting. Everything is optional: without MUX_TOKEN_ID/SECRET the app keeps using pasted
 * MP4 URLs. Env names are the SDK's own: MUX_TOKEN_ID, MUX_TOKEN_SECRET (API), MUX_SIGNING_KEY,
 * MUX_PRIVATE_KEY (base64 key for signed playback).
 */
export const muxEnabled = () => !!(process.env.MUX_TOKEN_ID && process.env.MUX_TOKEN_SECRET);
export const muxSigningEnabled = () => !!(process.env.MUX_SIGNING_KEY && process.env.MUX_PRIVATE_KEY);

let client: Mux | null = null;
function mux() {
  client ??= new Mux(); // reads the MUX_* env vars (and MUX_BASE_URL, handy for tests)
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

type MuxFields = Pick<Service, "id" | "muxUploadId" | "muxAssetId" | "muxPlaybackId" | "videoStatus">;

/** Pull upload → asset → playback id from Mux until the video is ready. Cheap no-op once ready. */
export async function syncMuxVideo<T extends MuxFields>(s: T): Promise<T> {
  if (!muxEnabled() || !s.muxUploadId || s.videoStatus === "ready" || s.videoStatus === "errored") return s;
  try {
    let assetId = s.muxAssetId;
    if (!assetId) {
      const up = await mux().video.uploads.retrieve(s.muxUploadId);
      if (up.status === "errored" || up.status === "cancelled" || up.status === "timed_out") return save(s, { videoStatus: "errored" });
      assetId = up.asset_id ?? null;
      if (!assetId) return s; // still uploading
    }
    const asset = await mux().video.assets.retrieve(assetId);
    const playbackId = asset.playback_ids?.find((p) => p.policy === "signed")?.id ?? null;
    const videoStatus = asset.status === "ready" ? "ready" : asset.status === "errored" ? "errored" : "processing";
    return save(s, {
      muxAssetId: assetId,
      muxPlaybackId: playbackId,
      videoStatus,
      ...(videoStatus === "ready" && asset.duration ? { durationSec: Math.round(asset.duration) } : {}),
    });
  } catch (e) {
    console.error("Mux sync failed", e);
    return s;
  }
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
