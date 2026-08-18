import { lookup } from "node:dns/promises";
import net from "node:net";

/**
 * Módulo ÚNICO de URL para a Base de Conhecimento: normalização de sintaxe
 * (parsing tolerante a copy/paste, sem rede) + busca segura anti-SSRF.
 *
 * Segurança: só http/https, resolve o host e BLOQUEIA IPs privados, loopback,
 * link-local e metadata services; segue no máximo N redirects revalidando cada
 * salto; aplica timeout, limite de tamanho e checa content-type. O conteúdo
 * externo é sempre DADO (nunca instrução) — quem chama sanitiza.
 */

// ───────────────────────── Normalização de sintaxe ─────────────────────────
// FONTE ÚNICA DE VERDADE para parsing/normalização. Usa o parser nativo
// `new URL()` como parser principal; regex só para detecção de protocolo.
// Erros aqui são LOCAIS (sintaxe/protocolo) — não devem persistir uma fonte.

export type UrlErrorCode = "empty_url" | "invalid_url" | "unsupported_protocol" | "invalid_host";

export class UrlValidationError extends Error {
  constructor(public readonly code: UrlErrorCode, message: string) {
    super(message);
  }
}

export interface NormalizedUrl {
  /** Objeto parseado — é a URL usada para o fetch (fetchUrl). */
  url: URL;
  /** Valor bruto recebido, preservado para diagnóstico/auditoria. */
  original: string;
  /** Representação canônica de sintaxe (`url.toString()`). */
  normalized: string;
  /** Se o protocolo foi adicionado automaticamente (entrada sem esquema). */
  protocolAdded: boolean;
}

// Caracteres a remover das EXTREMIDADES: espaços, controles C0/C1, DEL, nbsp,
// zero-width (200B–200D), marcas bidi (200E/200F), separadores de linha/parág.
// (2028/2029), word-joiner (2060) e BOM (FEFF). Escapes evitam invisíveis no
// fonte. Não tocamos em caracteres internos legítimos — o parser nativo cuida
// de percent-encoding, acentos e punycode.
const EDGE_INVISIBLE = "\\s\\u0000-\\u001f\\u007f-\\u009f\\u00a0\\u200b-\\u200f\\u2028\\u2029\\u2060\\ufeff";
const EDGE_JUNK = new RegExp(`^[${EDGE_INVISIBLE}]+|[${EDGE_INVISIBLE}]+$`, "g");

/** Esquema seguido de autoridade, ex.: `https://`, `ftp://`, `file://`. */
const SCHEME_WITH_AUTHORITY = /^([a-zA-Z][a-zA-Z0-9+.-]*):\/\//;
/** Esquema logo no início, ex.: `mailto:`, `javascript:`, `host:port`. */
const LEADING_SCHEME = /^([a-zA-Z][a-zA-Z0-9+.-]*):/;

function cleanInput(raw: string): string {
  return (raw ?? "").replace(EDGE_JUNK, "");
}

/**
 * Normaliza uma entrada "razoável" em uma URL http(s) válida.
 * - " empresa.com.br/landing " → https://empresa.com.br/landing
 * - www.empresa.com.br/x       → https://www.empresa.com.br/x
 * - https://lp.empresa.com/x?y → mantém como está
 * - javascript:alert(1)        → UnsupportedProtocol
 */
export function normalizePublicUrl(raw: string): NormalizedUrl {
  const original = raw ?? "";
  const value = cleanInput(original);
  if (!value) throw new UrlValidationError("empty_url", "Informe uma URL.");

  let candidate: string;
  let protocolAdded = false;

  const authority = value.match(SCHEME_WITH_AUTHORITY);
  if (authority) {
    const scheme = authority[1]!.toLowerCase();
    if (scheme === "http" || scheme === "https") candidate = value;
    else throw new UrlValidationError("unsupported_protocol", "Use uma URL iniciada por http:// ou https://.");
  } else {
    const lead = value.match(LEADING_SCHEME);
    if (lead) {
      const scheme = lead[1]!.toLowerCase();
      const after = value.slice(lead[0].length);
      if (scheme === "http" || scheme === "https") {
        candidate = value; // `http:algo` sem barras — deixa o parser nativo decidir.
      } else if (/^\d/.test(after)) {
        // `host:8080/...` sem protocolo — o "esquema" é, na verdade, o host.
        candidate = `https://${value}`;
        protocolAdded = true;
      } else {
        // javascript:, data:, mailto:, blob:, tel:, file (sem //)…
        throw new UrlValidationError("unsupported_protocol", "Use uma URL iniciada por http:// ou https://.");
      }
    } else if (value.startsWith("//")) {
      candidate = `https:${value}`; // protocol-relative
      protocolAdded = true;
    } else {
      candidate = `https://${value}`;
      protocolAdded = true;
    }
  }

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    throw new UrlValidationError("invalid_url", "A URL informada não possui um formato válido.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new UrlValidationError("unsupported_protocol", "Use uma URL iniciada por http:// ou https://.");
  }
  if (!url.hostname) {
    throw new UrlValidationError("invalid_host", "A URL informada não possui um domínio válido.");
  }
  // Quando prefixamos o protocolo (entrada ambígua), exigimos um host "de
  // verdade": com ponto (domínio) ou dois-pontos (IPv6). `localhost` e IPs
  // literais passam adiante — quem decide bloqueá-los é a camada de segurança
  // (SSRF → BLOCKED_URL), não a validação de sintaxe. Assim, "asdfqwer" vira
  // INVALID_URL, mas "empresa.com.br" e "localhost" seguem o fluxo.
  if (protocolAdded && !url.hostname.includes(".") && !url.hostname.includes(":") && url.hostname !== "localhost") {
    throw new UrlValidationError("invalid_url", "A URL informada não possui um formato válido.");
  }

  return { url, original, normalized: url.toString(), protocolAdded };
}

/** Host + caminho, sem query/fragment — seguro para log (não vaza tokens/UTM). */
export function safeUrlForLog(u: URL): string {
  return `${u.protocol}//${u.host}${u.pathname}`;
}

/** Só o código local (para o chamador decidir se persiste ou rejeita). */
export function isLocalUrlError(e: unknown): e is UrlValidationError {
  return e instanceof UrlValidationError;
}

// ─────────────────────────── Busca segura (SSRF) ───────────────────────────

export class KnowledgeFetchError extends Error {
  constructor(
    public readonly code:
      | "invalid_url"
      | "blocked_protocol"
      | "blocked_host"
      | "too_many_redirects"
      | "redirect_blocked"
      | "timeout"
      | "too_large"
      | "bad_content_type"
      | "http_error"
      | "dns_error"
      | "network_error"
      | "fetch_failed",
    message: string,
    public readonly httpStatus?: number,
  ) {
    super(message);
  }
}

const MAX_REDIRECTS = 4;
const TIMEOUT_MS = 12_000;
const MAX_BYTES = 3 * 1024 * 1024; // 3 MB de HTML/texto
const ALLOWED_CONTENT = ["text/html", "text/plain", "application/xhtml", "text/markdown", "application/xml", "text/xml"];

/** Um IP é proibido quando não é público (loopback/privado/link-local/etc.). */
export function isBlockedIp(ip: string): boolean {
  if (net.isIP(ip) === 0) return true; // não é IP → trate como bloqueado por segurança
  if (net.isIPv4(ip)) {
    const p = ip.split(".").map(Number);
    if (p[0] === 0) return true; // 0.0.0.0/8
    if (p[0] === 10) return true; // 10/8 privado
    if (p[0] === 127) return true; // loopback
    if (p[0] === 169 && p[1] === 254) return true; // link-local + metadata (169.254.169.254)
    if (p[0] === 172 && p[1] >= 16 && p[1] <= 31) return true; // 172.16/12
    if (p[0] === 192 && p[1] === 168) return true; // 192.168/16
    if (p[0] === 100 && p[1] >= 64 && p[1] <= 127) return true; // CGNAT 100.64/10
    if (p[0] >= 224) return true; // multicast/reservado
    return false;
  }
  // IPv6
  const v6 = ip.toLowerCase();
  if (v6 === "::1" || v6 === "::") return true; // loopback / unspecified
  if (v6.startsWith("fe80") || v6.startsWith("fe9") || v6.startsWith("fea") || v6.startsWith("feb")) return true; // link-local
  if (v6.startsWith("fc") || v6.startsWith("fd")) return true; // ULA privada fc00::/7
  if (v6.startsWith("ff")) return true; // multicast
  // IPv4 mapeado (::ffff:a.b.c.d)
  const mapped = v6.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isBlockedIp(mapped[1]!);
  return false;
}

/**
 * Garante que uma URL JÁ PARSEADA não aponta para um destino interno.
 * Resolve TODOS os endereços (IPv4 e IPv6) e bloqueia qualquer um privado.
 * Falha de resolução vira `dns_error` (≠ destino bloqueado por segurança).
 */
export async function assertHostAllowed(u: URL): Promise<void> {
  const host = u.hostname.replace(/^\[|\]$/g, "");
  if (!host || host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new KnowledgeFetchError("blocked_host", "Destino interno não permitido.");
  }
  // Se o host já é um IP, valida direto; senão resolve TODOS os endereços.
  if (net.isIP(host) !== 0) {
    if (isBlockedIp(host)) throw new KnowledgeFetchError("blocked_host", "Destino interno/privado não permitido.");
    return;
  }
  let addrs: { address: string }[];
  try {
    addrs = await lookup(host, { all: true });
  } catch {
    throw new KnowledgeFetchError("dns_error", "Não foi possível localizar o domínio informado.");
  }
  if (addrs.length === 0) throw new KnowledgeFetchError("dns_error", "Domínio sem endereço resolvível.");
  for (const a of addrs) {
    if (isBlockedIp(a.address)) throw new KnowledgeFetchError("blocked_host", "O domínio aponta para um destino interno/privado.");
  }
}

/** Normaliza a sintaxe (via ./url) e garante host público. Mantida por
 * compatibilidade — combina normalização + verificação de segurança. */
export async function assertPublicUrl(raw: string): Promise<URL> {
  const { url } = normalizePublicUrl(raw); // pode lançar UrlValidationError (sintaxe/protocolo)
  await assertHostAllowed(url);
  return url;
}

export interface FetchedPage {
  finalUrl: string;
  contentType: string;
  status: number;
  body: string;
  redirects: number;
}

/** Decodifica os bytes conforme o charset declarado (utf-8 por padrão; latin1/
 * windows-1252 quando o content-type indicar). */
function decodeBody(bytes: Buffer, contentType: string): string {
  const cs = (contentType.match(/charset=([^\s;]+)/i)?.[1] ?? "").toLowerCase();
  if (cs.includes("iso-8859") || cs.includes("latin1") || cs.includes("windows-1252")) return bytes.toString("latin1");
  return bytes.toString("utf8");
}

/** Resolve o destino de um redirect (relativo ou absoluto) via parser nativo e
 * REVALIDA segurança. Erros viram `redirect_blocked` (exceto DNS, que é claro).
 * Cross-domain é permitido desde que público e http(s). Exportado p/ testes. */
export async function resolveRedirect(location: string, base: URL): Promise<URL> {
  let next: URL;
  try {
    next = new URL(location, base); // resolve Location relativo (ex.: "/oferta/")
  } catch {
    throw new KnowledgeFetchError("redirect_blocked", "Redirecionamento para um endereço inválido.");
  }
  if (next.protocol !== "http:" && next.protocol !== "https:") {
    throw new KnowledgeFetchError("redirect_blocked", "Redirecionamento para um protocolo não suportado.");
  }
  try {
    await assertHostAllowed(next);
  } catch (e) {
    if (e instanceof KnowledgeFetchError && e.code === "dns_error") throw e;
    throw new KnowledgeFetchError("redirect_blocked", "A página redirecionou para um endereço que não pode ser acessado.");
  }
  return next;
}

/** Busca a página revalidando cada redirect, com timeout e limite de tamanho. */
export async function safeFetchUrl(raw: string): Promise<FetchedPage> {
  const { url } = normalizePublicUrl(raw); // sintaxe (pode lançar UrlValidationError)
  await assertHostAllowed(url); // segurança do host inicial
  let current = url;
  let redirects = 0;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      let res: Response;
      try {
        res = await fetch(current.toString(), {
          method: "GET",
          redirect: "manual",
          signal: controller.signal,
          headers: {
            // UA identificável de navegador-compatível — reduz 403 de sites que
            // barram clientes desconhecidos, sem burlar proteção anti-bot.
            "user-agent": "Mozilla/5.0 (compatible; SOIE-KnowledgeBot/1.0; +https://soie.app/bot)",
            accept: "text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.5",
            "accept-language": "pt-BR,pt;q=0.9,en;q=0.7",
          },
        });
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") throw new KnowledgeFetchError("timeout", "Tempo esgotado ao buscar a página.");
        const cause = (e as { cause?: { code?: string } })?.cause?.code;
        if (cause === "ENOTFOUND" || cause === "EAI_AGAIN") throw new KnowledgeFetchError("dns_error", "Não foi possível localizar o domínio informado.");
        throw new KnowledgeFetchError("network_error", "Não foi possível conectar ao site.");
      }

      // Redirect: revalida o novo destino (bloqueia SSRF via redirect).
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get("location");
        if (!loc) throw new KnowledgeFetchError("http_error", `Redirecionamento sem destino (HTTP ${res.status}).`, res.status);
        if (hop === MAX_REDIRECTS) throw new KnowledgeFetchError("too_many_redirects", "A página excedeu o limite de redirecionamentos.");
        current = await resolveRedirect(loc, current);
        redirects++;
        continue;
      }

      if (res.status >= 400) throw new KnowledgeFetchError("http_error", `A página respondeu HTTP ${res.status}.`, res.status);

      const contentType = (res.headers.get("content-type") ?? "").toLowerCase();
      if (contentType && !ALLOWED_CONTENT.some((c) => contentType.includes(c))) {
        throw new KnowledgeFetchError("bad_content_type", `Tipo de conteúdo não suportado (${contentType.split(";")[0]}).`);
      }
      const declared = Number(res.headers.get("content-length") ?? "0");
      if (declared && declared > MAX_BYTES) throw new KnowledgeFetchError("too_large", "Página grande demais para importar.");

      // Lê com teto de bytes (streaming) — content-length pode faltar/mentir.
      const reader = res.body?.getReader();
      if (!reader) {
        const text = await res.text();
        return { finalUrl: current.toString(), contentType, status: res.status, body: text.slice(0, MAX_BYTES), redirects };
      }
      const chunks: Uint8Array[] = [];
      let total = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          total += value.byteLength;
          if (total > MAX_BYTES) {
            await reader.cancel().catch(() => {});
            throw new KnowledgeFetchError("too_large", "Página grande demais para importar.");
          }
          chunks.push(value);
        }
      }
      const body = decodeBody(Buffer.concat(chunks.map((c) => Buffer.from(c))), contentType);
      return { finalUrl: current.toString(), contentType, status: res.status, body, redirects };
    }
    throw new KnowledgeFetchError("too_many_redirects", "A página excedeu o limite de redirecionamentos.");
  } finally {
    clearTimeout(timer);
  }
}
