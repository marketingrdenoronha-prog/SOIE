/**
 * Extração do conteúdo de uma página HTML (sem dependências externas), com
 * MÚLTIPLAS ESTRATÉGIAS EM CASCATA — para funcionar em artigos, notícias E
 * páginas institucionais (home, sobre, serviços, FAQ) que não têm <article>.
 *
 * Ordem: (1) <article> → (2) <main> → (3) semântica (h1–h4, p, li, blockquote,
 * figcaption, td, dd… em TODA a página) → (4) texto visível do <body>. Uma
 * estratégia fraca não encerra o processo: escolhe-se o melhor resultado.
 *
 * Tudo é tratado como TEXTO/DADO — nunca HTML renderizável nem instrução.
 */

export interface ExtractedMeta {
  title: string;
  description?: string;
  author?: string;
  publishedAt?: Date;
  canonicalUrl?: string;
  language?: string;
}

export interface ExtractionResult extends ExtractedMeta {
  text: string;
  method: "article" | "main" | "semantic" | "body" | "none";
  htmlLength: number;
  textLength: number;
  paragraphs: number;
  headings: number;
  likelyJavascriptRendered: boolean;
}

const decodeEntities = (s: string): string =>
  s
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, d) => {
      const n = Number(d);
      return n > 0 && n < 0x10ffff ? String.fromCodePoint(n) : "";
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => {
      const n = parseInt(h, 16);
      return n > 0 && n < 0x10ffff ? String.fromCodePoint(n) : "";
    });

function meta(html: string, patterns: RegExp[]): string | undefined {
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]?.trim()) return decodeEntities(m[1].trim());
  }
  return undefined;
}

/** Remove SEMPRE o que nunca é conteúdo editorial (não remove nav/header/footer
 * aqui — isso é decidido por estratégia). */
function stripInert(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|template|iframe|svg|canvas|form|button|select)[\s\S]*?<\/\1>/gi, " ");
}

/** Converte um fragmento HTML em texto limpo, em parágrafos. */
function htmlToText(fragment: string): string {
  return fragment
    .replace(/<\/(p|div|section|article|main|li|h[1-6]|br|tr|header|footer|figcaption|blockquote)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, " ")
    .split("\n")
    .map((line) => decodeEntities(line).replace(/[ \t ]+/g, " ").trim())
    .filter(Boolean)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Estratégia editorial: primeiro <article>/<main>, com o ruído (nav, header,
 * footer, aside) removido para um texto mais limpo. */
function editorialText(container: string): string {
  const cleaned = stripInert(container).replace(/<(nav|header|footer|aside)[\s\S]*?<\/\1>/gi, " ");
  return htmlToText(cleaned);
}

const SEMANTIC_TAGS = ["h1", "h2", "h3", "h4", "p", "li", "blockquote", "figcaption", "td", "dd", "summary"];

/** Estratégia semântica: coleta o texto dos elementos que carregam conteúdo em
 * TODA a página (inclusive dentro de header/footer/section — sites
 * institucionais guardam informação relevante ali). Deduplica e descarta itens
 * muito curtos (menu). */
function semanticText(body: string): string {
  const src = stripInert(body);
  const seen = new Set<string>();
  const blocks: string[] = [];
  const re = new RegExp(`<(${SEMANTIC_TAGS.join("|")})\\b[^>]*>([\\s\\S]*?)<\\/\\1>`, "gi");
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    const t = htmlToText(m[2] ?? "").replace(/\n+/g, " ").trim();
    if (t.length < 3) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    blocks.push(t);
  }
  return blocks.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/** Último recurso: texto visível de todo o <body> (mantém nav/header/footer). */
function bodyText(body: string): string {
  return htmlToText(stripInert(body));
}

export function extractContent(html: string): ExtractionResult {
  const htmlLength = html.length;
  const title =
    meta(html, [
      /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+name=["']twitter:title["'][^>]+content=["']([^"']+)["']/i,
      /<title[^>]*>([\s\S]*?)<\/title>/i,
    ]) ?? "Sem título";
  const description = meta(html, [
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i,
  ]);
  const author = meta(html, [
    /<meta[^>]+name=["']author["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+property=["']article:author["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+name=["']twitter:creator["'][^>]+content=["']([^"']+)["']/i,
  ]) ?? jsonLdField(html, ["author", "name"]);
  const publishedRaw =
    meta(html, [
      /<meta[^>]+property=["']article:published_time["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+name=["'](?:pubdate|publishdate|date|dc\.date)["'][^>]+content=["']([^"']+)["']/i,
      /<time[^>]+datetime=["']([^"']+)["']/i,
    ]) ?? jsonLdField(html, ["datePublished"]);
  let publishedAt: Date | undefined;
  if (publishedRaw) {
    const d = new Date(publishedRaw);
    if (!Number.isNaN(d.getTime())) publishedAt = d;
  }
  const canonicalUrl = meta(html, [
    /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i,
    /<meta[^>]+property=["']og:url["'][^>]+content=["']([^"']+)["']/i,
  ]);
  const language = meta(html, [/<html[^>]+lang=["']([^"'-]+)/i]);

  const bodyMatch = html.match(/<body[\s\S]*?<\/body>/i)?.[0] ?? html;

  // Roda TODAS as estratégias; não deixa uma falha encerrar as demais.
  const candidates: { method: ExtractionResult["method"]; text: string }[] = [
    { method: "article", text: safe(() => editorialText(html.match(/<article[\s\S]*?<\/article>/i)?.[0] ?? "")) },
    { method: "main", text: safe(() => editorialText(html.match(/<main[\s\S]*?<\/main>/i)?.[0] ?? "")) },
    { method: "semantic", text: safe(() => semanticText(bodyMatch)) },
    { method: "body", text: safe(() => bodyText(bodyMatch)) },
  ];

  // Escolha: a primeira estratégia (mais limpa) que já traz conteúdo suficiente
  // (≥200 chars); se nenhuma atingir, a de MAIOR volume de texto.
  let chosen = candidates.find((c) => c.text.length >= 200);
  if (!chosen) chosen = candidates.reduce((a, b) => (b.text.length > a.text.length ? b : a), { method: "none", text: "" });

  const text = chosen.text;
  const paragraphs = (text.match(/\n/g)?.length ?? 0) + (text ? 1 : 0);
  const headings = (bodyMatch.match(/<h[1-4]\b/gi)?.length ?? 0);
  const scriptCount = (html.match(/<script\b/gi)?.length ?? 0);
  const emptyRoot = /<div[^>]+id=["'](?:root|app|__next|__nuxt|q-app)["'][^>]*>\s*<\/div>/i.test(html);
  const likelyJavascriptRendered =
    emptyRoot || (text.length < 200 && (scriptCount >= 5 || htmlLength > 15000));

  return {
    title: title.slice(0, 300),
    description,
    author,
    publishedAt,
    canonicalUrl,
    language,
    text,
    method: text ? chosen.method : "none",
    htmlLength,
    textLength: text.length,
    paragraphs,
    headings,
    likelyJavascriptRendered,
  };
}

/** Extrai um campo de blocos JSON-LD (Article/Organization) quando útil. */
function jsonLdField(html: string, path: string[]): string | undefined {
  const blocks = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) ?? [];
  for (const b of blocks) {
    const jsonText = b.replace(/^[\s\S]*?>/, "").replace(/<\/script>$/i, "").trim();
    try {
      const data = JSON.parse(jsonText);
      const arr = Array.isArray(data) ? data : [data, ...(Array.isArray(data["@graph"]) ? data["@graph"] : [])];
      for (const node of arr) {
        let v: unknown = node;
        for (const key of path) v = v && typeof v === "object" ? (v as Record<string, unknown>)[key] : undefined;
        if (typeof v === "string" && v.trim()) return v.trim();
      }
    } catch {
      /* JSON-LD malformado → ignora */
    }
  }
  return undefined;
}

function safe(fn: () => string): string {
  try {
    return fn() || "";
  } catch {
    return "";
  }
}

/** Assinatura antiga preservada (usada por chamadas/tests existentes). */
export interface ExtractedPage extends ExtractedMeta {
  text: string;
}
export function extractPage(html: string): ExtractedPage {
  const r = extractContent(html);
  return {
    title: r.title,
    text: r.text,
    description: r.description,
    author: r.author,
    publishedAt: r.publishedAt,
    canonicalUrl: r.canonicalUrl,
    language: r.language,
  };
}

/** Avalia se o conteúdo extraído é ÚTIL (não só menu/rodapé), sem depender de um
 * único limite alto e rígido. Página institucional curta com estrutura passa. */
export function assessContent(r: ExtractionResult, hasDescription: boolean): { useful: boolean } {
  const len = r.textLength;
  if (len >= 150) return { useful: true };
  if (len >= 40 && (r.headings >= 1 || r.paragraphs >= 2 || hasDescription)) return { useful: true };
  return { useful: false };
}
