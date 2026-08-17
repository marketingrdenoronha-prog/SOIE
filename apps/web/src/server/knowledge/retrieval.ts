import { prisma } from "@soie/db";
import { embedText } from "../ai-runtime";

/**
 * Recuperação contextual da Base de Conhecimento para o agente planning.
 *
 * Estritamente escopada por organização + cliente (nunca cruza tenants). Busca
 * HÍBRIDA: lexical (Postgres FTS, sempre disponível) + semântica (pgvector,
 * best-effort quando há embeddings). Reordena por relevância, prioridade da
 * fonte e recência (para notícias), deduplica por fonte e respeita um teto de
 * contexto. Sem resultados por termo → cai para as fontes de maior prioridade.
 */

export interface KnowledgeHit {
  sourceId: string;
  title: string;
  type: string;
  url: string | null;
  domain: string | null;
  publishedAt: string | null;
  relevance: number;
  content: string;
}

interface Row {
  sourceId: string;
  title: string;
  type: string;
  url: string | null;
  domain: string | null;
  publishedAt: Date | null;
  content: string;
  score: number;
}

const MAX_SOURCES = 6;
const MAX_CHUNKS_PER_SOURCE = 2;
const MAX_TOTAL_CHARS = 7000;

export async function retrieveKnowledge(params: {
  organizationId: string;
  clientId: string;
  projectId?: string | null;
  query: string;
  limit?: number;
}): Promise<KnowledgeHit[]> {
  const { organizationId, clientId } = params;
  const projectId = params.projectId ?? null;
  const query = (params.query ?? "").trim().slice(0, 1000);
  const limit = params.limit ?? 14;

  const collected: Row[] = [];

  // 1) Lexical (FTS) — funciona sem nenhuma chave de IA.
  if (query) {
    try {
      const lex = await prisma.$queryRaw<Row[]>`
        SELECT e."knowledgeDocumentId" AS "sourceId", d.title, d.type, d.url, d.domain,
               d."publishedAt", e.content,
               ( ts_rank(e.tsv, websearch_to_tsquery('portuguese', ${query}))
                 + d.priority * 0.05
                 + CASE WHEN e."projectId" = ${projectId}::uuid THEN 0.12 ELSE 0 END
                 + CASE WHEN d.type = 'news' AND d."publishedAt" > now() - interval '45 days' THEN 0.10 ELSE 0 END
               ) AS score
        FROM "embeddings" e
        JOIN "knowledge_documents" d ON d.id = e."knowledgeDocumentId"
        WHERE e."organizationId" = ${organizationId}::uuid
          AND e."clientId" = ${clientId}::uuid
          AND d.enabled = true
          AND d.status = 'ready'
          AND e.tsv @@ websearch_to_tsquery('portuguese', ${query})
        ORDER BY score DESC
        LIMIT ${limit}
      `;
      collected.push(...lex);
    } catch {
      /* FTS indisponível → segue para fallback/semântica */
    }

    // 2) Semântica (pgvector) — best-effort quando há embeddings + chave.
    const vec = await embedText(query);
    if (vec) {
      try {
        const lit = `[${vec.join(",")}]`;
        const sem = await prisma.$queryRawUnsafe<Row[]>(
          `SELECT e."knowledgeDocumentId" AS "sourceId", d.title, d.type, d.url, d.domain,
                  d."publishedAt", e.content,
                  (1 - (e.embedding <=> $1::vector)) + d.priority * 0.05
                    + CASE WHEN e."projectId" = $4::uuid THEN 0.12 ELSE 0 END AS score
           FROM "embeddings" e
           JOIN "knowledge_documents" d ON d.id = e."knowledgeDocumentId"
           WHERE e."organizationId" = $2::uuid AND e."clientId" = $3::uuid
             AND d.enabled = true AND d.status = 'ready' AND e.embedding IS NOT NULL
           ORDER BY e.embedding <=> $1::vector ASC
           LIMIT $5`,
          lit,
          organizationId,
          clientId,
          projectId,
          limit,
        );
        collected.push(...sem);
      } catch {
        /* pgvector indisponível → mantém lexical */
      }
    }
  }

  // 3) Fallback: nada por termo → traz as fontes mais prioritárias/recentes.
  if (collected.length === 0) {
    try {
      const top = await prisma.$queryRaw<Row[]>`
        SELECT e."knowledgeDocumentId" AS "sourceId", d.title, d.type, d.url, d.domain,
               d."publishedAt", e.content,
               (d.priority * 0.1) AS score
        FROM "knowledge_documents" d
        JOIN "embeddings" e ON e."knowledgeDocumentId" = d.id AND e."chunkIndex" = 0
        WHERE d."organizationId" = ${organizationId}::uuid
          AND d."clientId" = ${clientId}::uuid
          AND d.enabled = true
          AND d.status = 'ready'
        ORDER BY d.priority DESC, d."createdAt" DESC
        LIMIT ${MAX_SOURCES}
      `;
      collected.push(...top);
    } catch {
      return [];
    }
  }

  // Merge/dedup: melhor score por (fonte+conteúdo), no máx. N chunks por fonte,
  // teto de fontes e de caracteres totais enviados ao modelo.
  const bestByKey = new Map<string, Row>();
  for (const r of collected) {
    const key = `${r.sourceId}::${r.content.slice(0, 60)}`;
    const prev = bestByKey.get(key);
    if (!prev || r.score > prev.score) bestByKey.set(key, r);
  }
  const ranked = [...bestByKey.values()].sort((a, b) => b.score - a.score);

  const perSource = new Map<string, number>();
  const sourcesSeen = new Set<string>();
  const hits: KnowledgeHit[] = [];
  let totalChars = 0;
  for (const r of ranked) {
    const count = perSource.get(r.sourceId) ?? 0;
    if (count >= MAX_CHUNKS_PER_SOURCE) continue;
    if (!sourcesSeen.has(r.sourceId) && sourcesSeen.size >= MAX_SOURCES) continue;
    if (totalChars + r.content.length > MAX_TOTAL_CHARS && hits.length > 0) continue;
    perSource.set(r.sourceId, count + 1);
    sourcesSeen.add(r.sourceId);
    totalChars += r.content.length;
    hits.push({
      sourceId: r.sourceId,
      title: r.title,
      type: r.type,
      url: r.url,
      domain: r.domain,
      publishedAt: r.publishedAt ? new Date(r.publishedAt).toISOString() : null,
      relevance: Number(r.score.toFixed(3)),
      content: r.content,
    });
  }
  return hits;
}

/** Monta a consulta de recuperação a partir do objetivo + sinais estratégicos. */
export function buildKnowledgeQuery(parts: {
  objective?: string | null;
  observations?: string | null;
  niche?: string | null;
  pillars?: unknown;
  pains?: string[];
}): string {
  const pillars = Array.isArray(parts.pillars) ? parts.pillars.map((p) => String(p)) : [];
  return [parts.objective, parts.observations, parts.niche, ...pillars, ...(parts.pains ?? [])]
    .filter((x): x is string => Boolean(x && String(x).trim()))
    .join(" ")
    .slice(0, 1000);
}
