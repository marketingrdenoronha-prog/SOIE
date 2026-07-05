/** SOIE wordmark: S, O (ring + center dot), I and a three-bar E, in the brand
 * mint green. Scalable SVG so it stays crisp at any size; control the size with
 * a height class (e.g. `h-6 w-auto`). */
export function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 205 64"
      className={className}
      role="img"
      aria-label="SOIE"
      fill="none"
      stroke={GREEN}
      strokeWidth={6}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* S */}
      <path d="M44 18 C44 12 37 9 29 9 C19 9 12 13 12 21 C12 28 19 31 29 31 C39 31 46 34 46 42 C46 50 39 54 29 54 C20 54 13 51 12 45" />
      {/* O — ring + center dot */}
      <circle cx="95" cy="32" r="22" />
      <circle cx="95" cy="32" r="3.5" fill={GREEN} stroke="none" />
      {/* I */}
      <path d="M132 12 L132 52" />
      {/* E — three bars */}
      <path d="M152 12 L192 12" />
      <path d="M152 32 L192 32" />
      <path d="M152 52 L192 52" />
    </svg>
  );
}

/** Compact mark (the O: ring + dot) for tight spots like favicons/avatars. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      role="img"
      aria-label="SOIE"
      fill="none"
      stroke={GREEN}
      strokeWidth={6}
      strokeLinecap="round"
    >
      <circle cx="32" cy="32" r="24" />
      <circle cx="32" cy="32" r="4" fill={GREEN} stroke="none" />
    </svg>
  );
}

const GREEN = "#7CDD86";
