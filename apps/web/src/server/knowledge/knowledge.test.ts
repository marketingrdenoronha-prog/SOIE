import { test } from "node:test";
import assert from "node:assert/strict";
import { isBlockedIp, assertPublicUrl, KnowledgeFetchError, normalizePublicUrl, UrlValidationError, resolveRedirect } from "./ssrf.ts";
import { chunkText, normalizeText, checksum, approxTokens } from "./chunk.ts";
import { extractPage, extractContent, assessContent } from "./extract.ts";

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
  await assert.rejects(() => assertPublicUrl("ftp://example.com"), (e) => e instanceof UrlValidationError && e.code === "unsupported_protocol");
  await assert.rejects(() => assertPublicUrl("http://localhost/x"), (e) => e instanceof KnowledgeFetchError && e.code === "blocked_host");
  await assert.rejects(() => assertPublicUrl("http://127.0.0.1/x"), (e) => e instanceof KnowledgeFetchError && e.code === "blocked_host");
  await assert.rejects(() => assertPublicUrl("http://169.254.169.254/latest/meta-data"), (e) => e instanceof KnowledgeFetchError && e.code === "blocked_host");
  await assert.rejects(() => assertPublicUrl("asdfqwerlkj"), (e) => e instanceof UrlValidationError && e.code === "invalid_url");
});

test("normalizePublicUrl: aceita URLs públicas legítimas (com/sem protocolo)", () => {
  const ok = (raw: string, expectHref: string) => {
    const r = normalizePublicUrl(raw);
    assert.equal(r.url.href, expectHref, `${JSON.stringify(raw)} → ${r.url.href}`);
  };
  ok("empresa.com.br", "https://empresa.com.br/");
  ok("empresa.com.br/", "https://empresa.com.br/");
  ok("www.empresa.com.br/pagina", "https://www.empresa.com.br/pagina");
  ok("empresa.com.br/landing-page", "https://empresa.com.br/landing-page");
  ok("lp.empresa.com.br/oferta", "https://lp.empresa.com.br/oferta");
  ok("go.empresa.com.br/campanha", "https://go.empresa.com.br/campanha");
  ok("https://empresa.com.br", "https://empresa.com.br/");
  ok("HTTPS://Empresa.com.BR/Path", "https://empresa.com.br/Path"); // host baixado, path preservado
  ok("http://empresa.com.br/x", "http://empresa.com.br/x"); // http explícito é mantido
  // query, UTM e fragment não invalidam; fragment é preservado no objeto.
  ok("www.empresa.com.br/produto?id=123", "https://www.empresa.com.br/produto?id=123");
  ok("empresa.com.br/oferta?utm_source=google&utm_campaign=b2b", "https://empresa.com.br/oferta?utm_source=google&utm_campaign=b2b");
  ok("empresa.com.br/pagina#formulario", "https://empresa.com.br/pagina#formulario");
  ok("empresa.com.br:8080/x", "https://empresa.com.br:8080/x"); // host:porta sem protocolo
  ok("  empresa.com.br/landing-page  ", "https://empresa.com.br/landing-page"); // espaços nas bordas
  ok("​ empresa.com.br ﻿", "https://empresa.com.br/"); // invisíveis nas bordas
});

test("normalizePublicUrl: metadados separados (original/normalized/protocolAdded)", () => {
  const r = normalizePublicUrl("  lp.empresa.com.br/campanha?utm_source=instagram  ");
  assert.equal(r.original, "  lp.empresa.com.br/campanha?utm_source=instagram  ");
  assert.equal(r.normalized, "https://lp.empresa.com.br/campanha?utm_source=instagram");
  assert.equal(r.protocolAdded, true);
  assert.equal(normalizePublicUrl("https://empresa.com.br/x").protocolAdded, false);
});

test("normalizePublicUrl: rejeita vazio, protocolo perigoso e sintaxe inválida", () => {
  const code = (raw: string) => {
    try { normalizePublicUrl(raw); return "NO_THROW"; }
    catch (e) { return e instanceof UrlValidationError ? e.code : "WRONG_TYPE"; }
  };
  assert.equal(code(""), "empty_url");
  assert.equal(code("   "), "empty_url");
  assert.equal(code("javascript:alert(1)"), "unsupported_protocol");
  assert.equal(code("data:text/html,<b>x</b>"), "unsupported_protocol");
  assert.equal(code("file:///etc/passwd"), "unsupported_protocol");
  assert.equal(code("ftp://example.com"), "unsupported_protocol");
  assert.equal(code("mailto:foo@bar.com"), "unsupported_protocol");
  assert.equal(code("asdfqwerlkj"), "invalid_url"); // palavra solta, sem ponto
  assert.equal(code("http://"), "invalid_url");
});

test("normalizePublicUrl: localhost/IP passam a sintaxe (bloqueio é do SSRF)", () => {
  // Sintaticamente válidos — quem barra é assertHostAllowed (BLOCKED_URL).
  assert.equal(normalizePublicUrl("localhost").url.hostname, "localhost");
  assert.equal(normalizePublicUrl("127.0.0.1").url.hostname, "127.0.0.1");
  assert.equal(normalizePublicUrl("192.168.0.1:8080/x").url.hostname, "192.168.0.1");
});

test("resolveRedirect: relativo/absoluto públicos são resolvidos; internos/proto viram redirect_blocked", async () => {
  // IP público literal como base evita DNS no teste; host público passa direto.
  const pub = new URL("https://93.184.216.34/artigo/1"); // faixa pública
  // Location relativo é resolvido pelo parser nativo, mantendo o host.
  const rel = await resolveRedirect("/oferta/", pub);
  assert.equal(rel.href, "https://93.184.216.34/oferta/");
  // Cross-domain para outro IP público é permitido (só http/https + SSRF).
  const cross = await resolveRedirect("http://198.51.100.7/x", pub);
  assert.equal(cross.href, "http://198.51.100.7/x");
  // Redirect para loopback/privado/metadata é bloqueado (revalidação SSRF).
  for (const loc of ["http://127.0.0.1/admin", "//169.254.169.254/meta", "http://10.0.0.9/x"]) {
    await assert.rejects(() => resolveRedirect(loc, pub), (e) => e instanceof KnowledgeFetchError && e.code === "redirect_blocked", `${loc} deveria bloquear`);
  }
  // Redirect para protocolo perigoso é bloqueado antes de qualquer rede.
  await assert.rejects(() => resolveRedirect("ftp://198.51.100.7/x", pub), (e) => e instanceof KnowledgeFetchError && e.code === "redirect_blocked");
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

test("extractContent: página institucional SEM <article> cai na estratégia semântica", () => {
  const html = `<!doctype html><html lang="pt"><head>
    <title>Agência Exemplo</title>
    <meta name="description" content="Somos uma agência de conteúdo."/>
    </head><body>
    <header><nav>Home Sobre Contato Blog</nav></header>
    <section>
      <h1>Bem-vindo à Agência Exemplo</h1>
      <p>Ajudamos marcas a crescer com estratégia de conteúdo, design e performance digital.</p>
      <p>Nossa equipe cuida de branding, social media, tráfego pago e produção audiovisual.</p>
      <p>Atendemos empresas de todos os portes com foco em resultado e consistência editorial.</p>
    </section>
    <footer>© 2026 Agência Exemplo</footer>
    </body></html>`;
  const r = extractContent(html);
  assert.equal(r.method, "semantic", "sem <article>/<main>, a semântica deve vencer");
  assert.ok(r.text.includes("Ajudamos marcas a crescer"), "deve capturar o corpo institucional");
  assert.ok(!r.text.includes("Home Sobre Contato"), "menu (nav) não é conteúdo semântico");
  assert.ok(r.textLength >= 200, "corpo institucional deve superar o piso de escolha");
  assert.equal(r.likelyJavascriptRendered, false);
  assert.equal(assessContent(r, Boolean(r.description)).useful, true);
});

test("extractContent: página só com <main> usa a estratégia main", () => {
  const html = `<!doctype html><html><head><title>Serviços</title></head><body>
    <nav>menu de navegação lateral</nav>
    <main>
      <h2>Nossos serviços</h2>
      <p>Planejamento de linha editorial, produção de conteúdo e gestão de redes sociais.</p>
      <p>Também oferecemos consultoria de posicionamento e identidade verbal para marcas.</p>
      <p>Cada projeto inclui calendário editorial, briefing criativo e relatórios mensais de desempenho.</p>
    </main>
    </body></html>`;
  const r = extractContent(html);
  assert.equal(r.method, "main");
  assert.ok(r.text.includes("Planejamento de linha editorial"));
  assert.ok(!r.text.includes("menu de navegação lateral"), "nav é removido na estratégia main");
});

test("extractContent: SPA com <div id=root> vazio é detectada como JS-rendered", () => {
  const html = `<!doctype html><html><head><title>App</title></head><body>
    <div id="root"></div>
    <script src="/static/app.js"></script>
    <script src="/static/vendor.js"></script>
    </body></html>`;
  const r = extractContent(html);
  assert.equal(r.likelyJavascriptRendered, true, "root vazio + scripts => provável render por JS");
  assert.ok(r.textLength < 40, "praticamente sem texto útil");
});

test("assessContent: página curta com estrutura é útil; menu puro não é", () => {
  const structured = extractContent(
    `<!doctype html><html><head><title>Clínica</title>
     <meta name="description" content="Clínica odontológica."/></head><body>
     <section><h1>Clínica Sorriso</h1>
     <p>Atendimento odontológico humanizado no centro da cidade, com horário estendido.</p>
     </section></body></html>`,
  );
  assert.equal(assessContent(structured, Boolean(structured.description)).useful, true);

  const menuOnly = extractContent(
    `<!doctype html><html><head><title>X</title></head><body>
     <nav><ul><li>Home</li><li>Sobre</li><li>Contato</li></ul></nav>
     </body></html>`,
  );
  assert.equal(assessContent(menuOnly, false).useful, false);
});
