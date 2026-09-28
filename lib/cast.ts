"use client";
/* eslint-disable @typescript-eslint/no-explicit-any -- the Cast SDK ships no types in this repo */

/**
 * Casting to a TV.
 * - Chrome / Edge (desktop + Android): Google Cast Web Sender SDK → Chromecast / Google TV. The TV fetches
 *   the stream itself (signed Mux .m3u8 or MP4 link).
 * - Safari: AirPlay via the video element's own picker (needs native HLS, see Player).
 * - Anything else with the Remote Playback API: video.remote.prompt().
 */
const SDK = "https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1";
let sdkPromise: Promise<boolean> | null = null;

const w = () => window as any;
export const isChromium = () => typeof navigator !== "undefined" && /Chrome|Chromium|CriOS|Edg\//.test(navigator.userAgent);
export const isSafari = () => typeof navigator !== "undefined" && /Safari/.test(navigator.userAgent) && !/Chrome|Chromium|CriOS|Android|Edg\//.test(navigator.userAgent);

export function loadCastSdk(): Promise<boolean> {
  if (typeof window === "undefined" || !isChromium()) return Promise.resolve(false);
  if (w().cast?.framework) return Promise.resolve(true);
  sdkPromise ??= new Promise((resolve) => {
    w().__onGCastApiAvailable = (ok: boolean) => {
      if (ok) {
        w().cast.framework.CastContext.getInstance().setOptions({
          receiverApplicationId: w().chrome.cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID,
          autoJoinPolicy: w().chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED,
        });
      }
      resolve(ok);
    };
    const s = document.createElement("script");
    s.src = SDK;
    s.async = true;
    s.onerror = () => resolve(false);
    document.head.appendChild(s);
    setTimeout(() => resolve(!!w().cast?.framework), 8000);
  });
  return sdkPromise;
}

export type CastSession = { device: string; playOrPause(): void; seek(sec: number): void; stop(): void };

/** Opens the Chromecast picker and starts playing `src` on the chosen device. */
export async function castTo({ src, title, poster, currentTime }: { src: string; title: string; poster?: string; currentTime: number }): Promise<CastSession | null> {
  const cast = w().cast, chrome = w().chrome;
  const ctx = cast.framework.CastContext.getInstance();
  try {
    await ctx.requestSession();
  } catch {
    return null; // picker dismissed
  }
  const session = ctx.getCurrentSession();
  if (!session) return null;
  const info = new chrome.cast.media.MediaInfo(src, src.includes(".m3u8") ? "application/x-mpegURL" : "video/mp4");
  info.metadata = new chrome.cast.media.GenericMediaMetadata();
  info.metadata.title = title;
  if (poster) info.metadata.images = [new chrome.cast.Image(new URL(poster, location.href).href)];
  const req = new chrome.cast.media.LoadRequest(info);
  req.currentTime = currentTime;
  await session.loadMedia(req);
  const player = new cast.framework.RemotePlayer();
  const controller = new cast.framework.RemotePlayerController(player);
  return {
    device: session.getCastDevice()?.friendlyName ?? "your TV",
    playOrPause: () => controller.playOrPause(),
    seek: (sec) => { player.currentTime = sec; controller.seek(); },
    stop: () => ctx.endCurrentSession(true),
  };
}

/** Which cast method this browser + video element support right now. */
export function castMethod(video: HTMLVideoElement | null, castSdk: boolean): "cast" | "airplay" | "remote" | null {
  if (castSdk) return "cast";
  if (video && typeof (video as any).webkitShowPlaybackTargetPicker === "function") return "airplay";
  if (video && "remote" in video && typeof (video as any).remote?.prompt === "function") return "remote";
  return null;
}
