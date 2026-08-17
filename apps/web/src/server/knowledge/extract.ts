/**
 * Extração do conteúdo editorial de uma página HTML (sem dependências externas).
 * Remove script/style/nav/rodapé, isola o corpo do artigo quando possível e
 * coleta metadados (título, descrição, autor, data, URL canônica). Tudo é
 * tratado como TEXTO/DADO — nunca como HTML renderizável nem instrução.
 */

export interface ExtractedPage {
  title: string;
  text: string;
  description?: string;
  author?: string;
  publishedAt?: Date;
  canonicalUrl?: string;
  language?: string;
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
    });

function meta(html: string, patterns: RegExp[]): string | undefined {
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]?.trim()) return decodeEntities(m[1].trim());
  }
  return undefined;
}

/** Remove tags e blocos de ruído, devolvendo texto limpo em parágrafos. */
function htmlToText(fragment: string): string {
  return fragment
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|svg|template|iframe|form)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<(nav|header|footer|aside)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<\/(p|div|section|article|li|h[1-6]|br|tr)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, " ")
    .split("\n")
    .map((line) => decodeEntities(line).replace(/[ \t ]+/g, " ").trim())
    .filter(Boolean)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function extractPage(html: string): ExtractedPage {
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
  ]);

  const publishedRaw = meta(html, [
    /<meta[^>]+property=["']article:published_time["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+name=["'](?:pubdate|publishdate|date|dc\.date)["'][^>]+content=["']([^"']+)["']/i,
    /<time[^>]+datetime=["']([^"']+)["']/i,
  ]);
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

  // Corpo: prefere <article> ou <main>; senão usa <body>.
  const article =
    html.match(/<article[\s\S]*?<\/article>/i)?.[0] ??
    html.match(/<main[\s\S]*?<\/main>/i)?.[0] ??
    html.match(/<body[\s\S]*?<\/body>/i)?.[0] ??
    html;

  let text = htmlToText(article);
  // Se o corpo isolado ficou curto demais, cai para a página inteira.
  if (text.length < 200) {
    const full = htmlToText(html.match(/<body[\s\S]*?<\/body>/i)?.[0] ?? html);
    if (full.length > text.length) text = full;
  }

  return { title: title.slice(0, 300), text, description, author, publishedAt, canonicalUrl, language };
}
