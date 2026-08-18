/* eslint-disable @next/next/no-img-element */
/** Logo oficial BEAM SOIE (arquivo original, fundo transparente). Controle o
 * tamanho com uma classe de altura (ex.: `h-7 w-auto`). */
export function Logo({ className }: { className?: string }) {
  return <img src="/beam-soie-logo.png" alt="BEAM SOIE" className={className} />;
}

/** Marca compacta (só o símbolo) para espaços apertados: cabeçalhos de páginas
 * públicas, avatares. Preserva a proporção dentro da caixa. */
export function LogoMark({ className }: { className?: string }) {
  return <img src="/beam-soie-mark.png" alt="BEAM SOIE" className={`object-contain ${className ?? ""}`} />;
}
