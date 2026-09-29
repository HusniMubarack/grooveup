import { cn } from "@/lib/utils";

/**
 * Hip-hop dancer silhouette. Jointed SVG figure (shoulders, elbows, hips, knees) animated purely in CSS
 * (see .dancer rules in globals.css): bounce / two-step → running man → wave + hit, one 3.2 s loop.
 * No JS, no images; a still pose under prefers-reduced-motion.
 */
export function Dancer({ size = 120, className, variant = "loader", title }: {
  size?: number; className?: string; variant?: "loader" | "hero"; title?: string;
}) {
  const limb = { stroke: "url(#dancer-fill)", strokeLinecap: "round" as const, fill: "none" };
  return (
    <svg
      viewBox="0 0 200 300"
      width={size}
      height={size * 1.5}
      className={cn("dancer", variant === "hero" && "dancer-hero", className)}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <defs>
        <linearGradient id="dancer-fill" gradientUnits="userSpaceOnUse" x1="40" y1="40" x2="170" y2="290">
          <stop offset="0" stopColor="#3b3223" />
          <stop offset="1" stopColor="#120f0a" />
        </linearGradient>
        <radialGradient id="dancer-floor">
          <stop offset="0" stopColor="#d4af37" stopOpacity=".45" />
          <stop offset="1" stopColor="#d4af37" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse className="d-floor" cx="100" cy="286" rx="58" ry="8" fill="url(#dancer-floor)" />
      <g className="d-body">
        {/* legs (behind torso) */}
        <g className="d-hip-l">
          <line x1="92" y1="170" x2="86" y2="216" strokeWidth="17" {...limb} />
          <g className="d-knee-l">
            <line x1="86" y1="216" x2="86" y2="260" strokeWidth="15" {...limb} />
            <path d="M78 262 h22 a6 6 0 0 1 0 10 h-24 z" fill="url(#dancer-fill)" />
          </g>
        </g>
        <g className="d-hip-r">
          <line x1="108" y1="170" x2="114" y2="216" strokeWidth="17" {...limb} />
          <g className="d-knee-r">
            <line x1="114" y1="216" x2="114" y2="260" strokeWidth="15" {...limb} />
            <path d="M104 262 h22 a6 6 0 0 1 0 10 h-24 z" fill="url(#dancer-fill)" />
          </g>
        </g>
        {/* torso: hoodie */}
        <path d="M78 98 Q100 88 122 98 L118 176 Q100 182 82 176 Z" fill="url(#dancer-fill)" />
        {/* head + cap */}
        <g className="d-head">
          <circle cx="100" cy="70" r="17" fill="url(#dancer-fill)" />
          <path d="M82 66 Q100 44 118 64 L132 66 Q120 70 84 70 Z" fill="#0b0a09" />
        </g>
        {/* arms */}
        <g className="d-sh-l">
          <line x1="82" y1="102" x2="68" y2="138" strokeWidth="14" {...limb} />
          <g className="d-el-l">
            <line x1="68" y1="138" x2="64" y2="170" strokeWidth="12" {...limb} />
            <circle cx="64" cy="174" r="7" fill="url(#dancer-fill)" />
          </g>
        </g>
        <g className="d-sh-r">
          <line x1="118" y1="102" x2="132" y2="138" strokeWidth="14" {...limb} />
          <g className="d-el-r">
            <line x1="132" y1="138" x2="136" y2="170" strokeWidth="12" {...limb} />
            <circle cx="136" cy="174" r="7" fill="url(#dancer-fill)" />
          </g>
        </g>
      </g>
    </svg>
  );
}
