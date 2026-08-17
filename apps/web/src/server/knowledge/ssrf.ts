import { lookup } from "node:dns/promises";
import net from "node:net";

/**
 * Busca segura de URL pública para ingestão na Base de Conhecimento.
 *
 * Protege contra SSRF: só http/https, resolve o host e BLOQUEIA IPs privados,
 * loopback, link-local e metadata services; segue no máximo N redirects
 * revalidando cada salto; aplica timeout, limite de tamanho e checa content-type.
 * O conteúdo externo é sempre DADO (nunca instrução) — quem chama sanitiza.
 */

export class KnowledgeFetchError extends Error {
  constructor(
    public readonly code:
      | "invalid_url"
      | "blocked_protocol"
      | "blocked_host"
      | "too_many_redirects"
      | "timeout"
      | "too_large"
      | "bad_content_type"
      | "http_error"
      | "fetch_failed",
    message: string,
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

/** Valida esquema e garante que o host NÃO resolve para um destino interno. */
export async function assertPublicUrl(raw: string): Promise<URL> {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new KnowledgeFetchError("invalid_url", "URL inválida.");
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new KnowledgeFetchError("blocked_protocol", "Só são aceitos links http(s) públicos.");
  }
  const host = u.hostname.replace(/^\[|\]$/g, "");
  if (!host || host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new KnowledgeFetchError("blocked_host", "Destino interno não permitido.");
  }
  // Se o host já é um IP, valida direto; senão resolve TODOS os endereços.
  if (net.isIP(host) !== 0) {
    if (isBlockedIp(host)) throw new KnowledgeFetchError("blocked_host", "Destino interno/privado não permitido.");
    return u;
  }
  let addrs: { address: string }[];
  try {
    addrs = await lookup(host, { all: true });
  } catch {
    throw new KnowledgeFetchError("blocked_host", "Não foi possível resolver o domínio.");
  }
  if (addrs.length === 0) throw new KnowledgeFetchError("blocked_host", "Domínio sem endereço resolvível.");
  for (const a of addrs) {
    if (isBlockedIp(a.address)) throw new KnowledgeFetchError("blocked_host", "O domínio aponta para um destino interno/privado.");
  }
  return u;
}

export interface FetchedPage {
  finalUrl: string;
  contentType: string;
  body: string;
}

/** Busca a página revalidando cada redirect, com timeout e limite de tamanho. */
export async function safeFetchUrl(raw: string): Promise<FetchedPage> {
  let current = await assertPublicUrl(raw);
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
          headers: { "user-agent": "SOIE-KnowledgeBot/1.0", accept: "text/html,text/plain,*/*;q=0.8" },
        });
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") throw new KnowledgeFetchError("timeout", "Tempo esgotado ao buscar a página.");
        throw new KnowledgeFetchError("fetch_failed", "Não foi possível acessar a página.");
      }

      // Redirect: revalida o novo destino (bloqueia SSRF via redirect).
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get("location");
        if (!loc) throw new KnowledgeFetchError("http_error", `Redirecionamento sem destino (HTTP ${res.status}).`);
        if (hop === MAX_REDIRECTS) throw new KnowledgeFetchError("too_many_redirects", "Muitos redirecionamentos.");
        current = await assertPublicUrl(new URL(loc, current).toString());
        continue;
      }

      if (res.status >= 400) throw new KnowledgeFetchError("http_error", `A página respondeu HTTP ${res.status}.`);

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
        return { finalUrl: current.toString(), contentType, body: text.slice(0, MAX_BYTES) };
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
      const body = Buffer.concat(chunks.map((c) => Buffer.from(c))).toString("utf8");
      return { finalUrl: current.toString(), contentType, body };
    }
    throw new KnowledgeFetchError("too_many_redirects", "Muitos redirecionamentos.");
  } finally {
    clearTimeout(timer);
  }
}
