import { test } from "node:test";
import assert from "node:assert/strict";
import { isBlockedIp, assertPublicUrl, KnowledgeFetchError } from "./ssrf.ts";
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
