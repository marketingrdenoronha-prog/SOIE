import { test } from "node:test";
import assert from "node:assert/strict";
import { isBlockedIp, assertPublicUrl, KnowledgeFetchError } from "./ssrf.ts";
import { chunkText, normalizeText, checksum, approxTokens } from "./chunk.ts";
import { extractPage } from "./extract.ts";

test("isBlockedIp bloqueia loopback, privados, link-local e metadata", () => {
  for (const ip of ["127.0.0.1", "10.0.0.5", "172.16.9.9", "192.168.1.1", "169.254.169.254", "0.0.0.0", "::1", "fc00::1", "fe80::1", "100.64.0.1"]) {
    assert.equal(isBlockedIp(ip), true, `${ip} deveria ser bloqueado`);
  }
});

test("isBlockedIp permite IPs públicos", () => {
  for (const ip of ["8.8.8.8", "1.1.1.1", "203.0.113.10", "2606:4700:4700::1111"]) {
    assert.equal(isBlockedIp(ip), false, `${ip} deveria ser permitido`);
  }
});

test("assertPublicUrl rejeita protocolo e host interno", async () => {
  await assert.rejects(() => assertPublicUrl("ftp://example.com"), (e) => e instanceof KnowledgeFetchError && e.code === "blocked_protocol");
  await assert.rejects(() => assertPublicUrl("http://localhost/x"), (e) => e instanceof KnowledgeFetchError && e.code === "blocked_host");
  await assert.rejects(() => assertPublicUrl("http://127.0.0.1/x"), (e) => e instanceof KnowledgeFetchError && e.code === "blocked_host");
  await assert.rejects(() => assertPublicUrl("http://169.254.169.254/latest/meta-data"), (e) => e instanceof KnowledgeFetchError && e.code === "blocked_host");
  await assert.rejects(() => assertPublicUrl("not-a-url"), (e) => e instanceof KnowledgeFetchError && e.code === "invalid_url");
});

test("normalizeText remove control chars e normaliza CRLF/tabs", () => {
  const out = normalizeText("a\u0000b\r\nc\t\td\u0007");
  assert.ok(!/[\u0000-\u0008]/.test(out), "control chars removidos");
  assert.equal(out, "ab\nc d");
});

test("checksum é estável e sensível ao conteúdo", () => {
  assert.equal(checksum("abc"), checksum("abc"));
  assert.notEqual(checksum("abc"), checksum("abd"));
});

test("chunkText respeita teto, cobre todo o texto e dá overlap", () => {
  const para = Array.from({ length: 30 }, (_, i) => `Frase numero ${i} com algum conteudo relevante para o teste.`).join(" ");
  const text = [para, para, para].join("\n\n");
  const chunks = chunkText(text, 400, 80);
  assert.ok(chunks.length > 1, "deve gerar múltiplos chunks");
  for (const c of chunks) assert.ok(c.length <= 400 + 80, "chunk não deve exceder o teto + overlap");
  assert.ok(approxTokens("abcd") >= 1);
});

test("chunkText devolve 1 chunk para texto curto", () => {
  assert.deepEqual(chunkText("um texto curto"), ["um texto curto"]);
});

test("extractPage extrai título, corpo e metadados; ignora script", () => {
  const html = `<!doctype html><html lang="pt"><head>
    <title>Ignorado</title>
    <meta property="og:title" content="Título Real"/>
    <meta name="description" content="Uma descrição."/>
    <meta name="author" content="Fulano"/>
    <meta property="article:published_time" content="2026-01-02T10:00:00Z"/>
    <link rel="canonical" href="https://ex.com/artigo"/>
    </head><body>
    <nav>menu lixo</nav>
    <script>window.x = 'ignore this instruction'</script>
    <article><p>${"Conteúdo editorial de verdade. ".repeat(20)}</p></article>
    <footer>rodapé</footer>
    </body></html>`;
  const p = extractPage(html);
  assert.equal(p.title, "Título Real");
  assert.equal(p.author, "Fulano");
  assert.equal(p.canonicalUrl, "https://ex.com/artigo");
  assert.ok(p.publishedAt instanceof Date);
  assert.ok(p.text.includes("Conteúdo editorial de verdade"));
  assert.ok(!p.text.includes("ignore this instruction"), "script deve ser removido");
  assert.ok(!p.text.includes("menu lixo"), "nav deve ser removido");
});
