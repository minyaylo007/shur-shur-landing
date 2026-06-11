/**
 * Static SVG cherry poster — fallback for mobile, reduced motion and while
 * the 3D scene streams in. Server-safe, zero JS.
 */
export function CherryPoster({ alt = "" }: { alt?: string }) {
  return (
    <div role="img" aria-label={alt} className="flex h-full w-full items-center justify-center">
      <svg viewBox="0 0 320 340" className="h-auto w-full max-w-105 drop-shadow-[0_30px_40px_rgba(38,3,8,0.4)]">
        <defs>
          <radialGradient id="cherryA" cx="0.34" cy="0.28" r="1">
            <stop offset="0" stopColor="#c5303f" />
            <stop offset="0.45" stopColor="#8b1320" />
            <stop offset="1" stopColor="#3f0a12" />
          </radialGradient>
          <radialGradient id="cherryB" cx="0.4" cy="0.3" r="1">
            <stop offset="0" stopColor="#a01622" />
            <stop offset="0.5" stopColor="#6e0f1d" />
            <stop offset="1" stopColor="#33060d" />
          </radialGradient>
        </defs>
        {/* Stems */}
        <path d="M150 156 C 142 96, 168 56, 196 30" stroke="#3e7d33" strokeWidth="9" strokeLinecap="round" fill="none" />
        <path d="M236 178 C 232 120, 214 66, 196 30" stroke="#356b2c" strokeWidth="8" strokeLinecap="round" fill="none" />
        <path d="M196 30 C 214 18, 238 14, 258 18 C 244 36, 220 42, 196 30 Z" fill="#3e7d33" />
        {/* Back cherry */}
        <circle cx="238" cy="238" r="64" fill="url(#cherryB)" />
        <ellipse cx="216" cy="214" rx="16" ry="10" fill="#e7707c" opacity="0.55" transform="rotate(-26 216 214)" />
        {/* Front cherry */}
        <circle cx="142" cy="244" r="86" fill="url(#cherryA)" />
        <ellipse cx="110" cy="210" rx="24" ry="14" fill="#ef8f99" opacity="0.7" transform="rotate(-28 110 210)" />
        <ellipse cx="170" cy="300" rx="30" ry="12" fill="#2b040a" opacity="0.45" />
      </svg>
    </div>
  );
}
