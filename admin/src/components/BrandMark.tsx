// Challenger brand mark — Sigma-style "C" with a lightning bolt notch
// cut out of the opening. Single SVG, no raster. Uses CSS variables so it
// re-themes via the existing accent palette.

export function BrandMark({ size = 34 }: { size?: number }) {
  // Stable per-instance gradient ids so multiple BrandMarks can co-exist
  // without colliding (e.g., sidebar + login page).
  const uid = String(size);
  const bgId    = `bm-bg-${uid}`;
  const shineId = `bm-shine-${uid}`;
  const maskId  = `bm-mask-${uid}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      shapeRendering="geometricPrecision"
      style={{
        display: "block",
        borderRadius: size * 0.22,
        boxShadow: "0 10px 24px -10px rgba(139, 92, 246, 0.55), 0 2px 0 0 rgba(255,255,255,0.04) inset",
      }}
    >
      <defs>
        <linearGradient id={bgId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%"   stopColor="#8b5cf6" />
          <stop offset="55%"  stopColor="#6d28d9" />
          <stop offset="100%" stopColor="#0fb990" />
        </linearGradient>
        <linearGradient id={shineId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"  stopColor="#fff" stopOpacity="0.20" />
          <stop offset="60%" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <mask id={maskId}>
          <rect width="64" height="64" fill="#000" />
          {/* "C" ring */}
          <circle cx="32" cy="32" r="18" fill="#fff" />
          <circle cx="32" cy="32" r="11" fill="#000" />
          {/* Open the right side of the C */}
          <rect x="32" y="22" width="22" height="20" fill="#000" />
          {/* Carve a lightning bolt right through the body */}
          <path d="M30 16 L20 36 L29 36 L25 50 L40 28 L31 28 Z" fill="#000" />
        </mask>
      </defs>
      <rect width="64" height="64" rx="14" fill={`url(#${bgId})`} />
      <rect width="64" height="64" rx="14" fill={`url(#${shineId})`} />
      <rect width="64" height="64" rx="14" fill="#fff" mask={`url(#${maskId})`} />
    </svg>
  );
}
