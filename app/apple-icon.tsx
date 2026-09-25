import { ImageResponse } from "next/og";
import { MARK_PATHS } from "@/components/logo";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#d4af37" }}>
        <svg width="150" height="150" viewBox="0 0 32 32">
          {MARK_PATHS.map((d) => (
            <path key={d} d={d} fill="none" stroke="#1a1405" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          ))}
        </svg>
      </div>
    ),
    size,
  );
}
