/** BEAM SOIE — logo horizontal: símbolo "beam" (duas lâminas em degradê verde),
 * a palavra "BEAM" na cor do texto (adapta ao tema) e "SOIE" em verde, com o
 * "O" em forma de mira (anel + ponto). SVG escalável — controle o tamanho com
 * uma classe de altura (ex.: `h-7 w-auto`). */
export function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 500 64"
      className={className}
      role="img"
      aria-label="BEAM SOIE"
      fill="none"
      strokeWidth={6}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <defs>
        <linearGradient id="beamGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={GREEN_LIGHT} />
          <stop offset="1" stopColor={GREEN_DEEP} />
        </linearGradient>
      </defs>

      {/* Símbolo beam — duas lâminas deslocadas (topo à direita, base à esquerda). */}
      <g fill="url(#beamGrad)" stroke="none">
        <path d="M32 6 L70 6 L54 28 L16 28 Z" />
        <path d="M24 34 L62 34 L46 56 L8 56 Z" />
      </g>

      {/* BEAM — cor do texto (escuro no tema claro, claro no escuro). */}
      <g stroke="currentColor" transform="translate(92,0)">
        {/* B */}
        <path d="M0 12 L0 52" />
        <path d="M0 12 L16 12 C25 12 25 31 16 31 L0 31" />
        <path d="M0 31 L20 31 C30 31 30 52 20 52 L0 52" />
        {/* E */}
        <path d="M46 12 L46 52" />
        <path d="M46 12 L72 12" />
        <path d="M46 32 L72 32" />
        <path d="M46 52 L72 52" />
        {/* A */}
        <path d="M88 52 L105 12 L122 52" />
        <path d="M94 38 L116 38" />
        {/* M */}
        <path d="M140 52 L140 12 L160 40 L180 12 L180 52" />
      </g>

      {/* SOIE — verde da marca, com o O em mira. */}
      <g stroke={GREEN} transform="translate(298,0)">
        {/* S */}
        <path d="M44 18 C44 12 37 9 29 9 C19 9 12 13 12 21 C12 28 19 31 29 31 C39 31 46 34 46 42 C46 50 39 54 29 54 C20 54 13 51 12 45" />
        {/* O — anel + ponto central (mira) */}
        <circle cx="95" cy="32" r="22" />
        <circle cx="95" cy="32" r="3.5" fill={GREEN} stroke="none" />
        {/* I */}
        <path d="M132 12 L132 52" />
        {/* E — três barras */}
        <path d="M152 12 L192 12" />
        <path d="M152 32 L192 32" />
        <path d="M152 52 L192 52" />
      </g>
    </svg>
  );
}

/** Marca compacta (só o símbolo beam) para espaços apertados: favicon, avatar,
 * cabeçalho de páginas públicas. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} role="img" aria-label="BEAM SOIE" fill="none">
      <defs>
        <linearGradient id="beamGradMark" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={GREEN_LIGHT} />
          <stop offset="1" stopColor={GREEN_DEEP} />
        </linearGradient>
      </defs>
      <g fill="url(#beamGradMark)">
        <path d="M28 8 L58 8 L44 30 L14 30 Z" />
        <path d="M20 34 L50 34 L36 56 L6 56 Z" />
      </g>
    </svg>
  );
}

const GREEN = "#2FD968";
const GREEN_LIGHT = "#8FE9A0";
const GREEN_DEEP = "#2AD063";
