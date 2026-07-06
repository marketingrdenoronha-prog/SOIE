import { prisma } from "@soie/db";
import { z } from "zod";
import { requireAuth } from "@/server/auth";
import { ok, handle } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Importer for the Beam agency client base (the `base-clientes.json` skill
 * shipped by the user). Idempotent per-organization: matches on client name;
 * creates Cliente → Marca → Projeto + BrandVoice + Vocabulary in one go so the
 * whole SOIE workflow is immediately usable against the real portfolio.
 */
const importInput = z.object({
  base: z.object({
    clientes: z.array(z.record(z.unknown())),
  }).passthrough(),
  dryRun: z.boolean().optional(),
});

interface BeamClient {
  id?: number;
  nome: string;
  nome_alternativo?: string | string[];
  status?: string;
  nicho?: string;
  produtos_servicos?: unknown;
  publico_alvo?: string;
  tom_de_voz?: string;
  diferenciais?: string[];
  concorrentes?: string[];
  objetivos_atuais?: string;
  tagline?: string;
  localizacao?: string;
  instagram?: string;
  diretriz_importante?: string;
  pilares_de_conteudo?: string[];
  alerta_estrategico?: string;
  sinergia_estrategica?: string;
  conflito_carteira?: string;
}

export async function POST(req: Request) {
  return handle(async () => {
    const { org, sub } = requireAuth(req);
    const { base, dryRun } = importInput.parse(await req.json());
    const clients = base.clientes as unknown as BeamClient[];

    const stats = { total: clients.length, clients: 0, brands: 0, projects: 0, voices: 0, vocabularies: 0, skipped: 0 };
    const errors: string[] = [];

    // Um findMany em vez de um findFirst por cliente — o custo de "já existe?"
    // deixa de escalar com o tamanho da base.
    const existingNames = new Set(
      (
        await prisma.client.findMany({
          where: { organizationId: org, name: { in: clients.map((c) => c.nome) }, deletedAt: null },
          select: { name: true },
        })
      ).map((r) => r.name),
    );

    const toImport: BeamClient[] = [];
    for (const c of clients) {
      if (existingNames.has(c.nome)) { stats.skipped++; continue; }
      if (dryRun) { stats.clients++; continue; }
      toImport.push(c);
    }

    // Nested create: Cliente → Marca → Projeto + BrandVoice + Vocabulary numa
    // única query atômica por cliente (antes eram até 6 awaits seriais, e uma
    // falha no meio deixava cliente sem brand/project). Concorrência limitada
    // para não saturar o pool de conexões do Neon.
    const CONCURRENCY = 4;
    for (let i = 0; i < toImport.length; i += CONCURRENCY) {
      await Promise.all(
        toImport.slice(i, i + CONCURRENCY).map(async (c) => {
          try {
            const tags = [
              c.status ?? "ativo",
              ...(Array.isArray(c.nome_alternativo) ? c.nome_alternativo : c.nome_alternativo ? [c.nome_alternativo] : []),
              ...(c.localizacao ? [c.localizacao] : []),
            ];
            const hasVoice = Boolean(c.tom_de_voz || c.diferenciais?.length);
            const pilares = c.pilares_de_conteudo ?? [];

            await prisma.client.create({
              data: {
                organizationId: org, name: c.nome, industry: c.nicho, website: c.instagram,
                tags: tags.slice(0, 20), status: c.status ?? "active",
                brands: {
                  create: [{
                    organizationId: org, name: c.nome,
                    positioning: c.tagline ?? c.publico_alvo,
                    valueProposition: c.diferenciais?.join(" · "),
                    products: flattenProducts(c.produtos_servicos),
                    objectives: (c.objetivos_atuais ? [c.objetivos_atuais] : []) as unknown as object,
                    icp: c.publico_alvo ? { descricao: c.publico_alvo } : {},
                    projects: {
                      create: [{
                        organizationId: org,
                        name: c.objetivos_atuais?.slice(0, 100) ?? "Atendimento contínuo",
                        goal: buildGoal(c),
                        platforms: ["instagram"],
                      }],
                    },
                    ...(hasVoice
                      ? {
                          brandVoices: {
                            create: [{
                              organizationId: org,
                              tone: c.tom_de_voz ? { descricao: c.tom_de_voz } : {},
                              doList: (c.diferenciais ?? []) as unknown as object,
                              dontList: (c.concorrentes ?? []).map((x) => `Não mencionar concorrentes (${x})`) as unknown as object,
                              confidence: "medium" as const,
                            }],
                          },
                        }
                      : {}),
                    ...(pilares.length > 0
                      ? {
                          vocabularies: {
                            create: pilares.map((p) => ({ organizationId: org, kind: "pilar", term: p })),
                          },
                        }
                      : {}),
                  }],
                },
              },
            });
            stats.clients++;
            stats.brands++;
            stats.projects++;
            if (hasVoice) stats.voices++;
            stats.vocabularies += pilares.length;
          } catch (e) {
            errors.push(`${c.nome}: ${e instanceof Error ? e.message : String(e)}`);
          }
        }),
      );
    }

    void sub;
    return ok({ stats, errors }, 201);
  });
}

function flattenProducts(input: unknown): string[] {
  if (!input) return [];
  if (Array.isArray(input)) return input.filter((x): x is string => typeof x === "string");
  if (typeof input === "object") {
    return Object.values(input as Record<string, unknown>).flatMap(flattenProducts);
  }
  return [];
}

function buildGoal(c: BeamClient): string {
  const bits: string[] = [];
  if (c.objetivos_atuais) bits.push(c.objetivos_atuais);
  if (c.diretriz_importante) bits.push(`Diretriz: ${c.diretriz_importante}`);
  if (c.alerta_estrategico) bits.push(`⚠ ${c.alerta_estrategico}`);
  if (c.sinergia_estrategica) bits.push(`Sinergia: ${c.sinergia_estrategica}`);
  return bits.join("\n\n").slice(0, 2000);
}
