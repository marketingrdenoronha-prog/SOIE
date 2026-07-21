import { z } from "zod";

/**
 * SOIE V2 — Onboarding estratégico do cliente.
 *
 * Único ponto de coleta manual do fluxo: 7 passos que capturam TODO o
 * conhecimento necessário para a IA gerar dossiê + linhas editoriais sozinha.
 * O payload é gravado em `StrategicOnboarding.payload` (Json), com validação
 * step-a-step aqui e validação de completude no `finalize`.
 *
 * Cada step é opcional individualmente (o wizard salva progresso), mas ao
 * finalizar o `finalizeOnboardingInput` exige o payload completo.
 */

/** Passo 1 — Identidade e presença digital. */
export const onboardingStepIdentity = z.object({
  displayName: z.string().min(1, "Nome público é obrigatório").max(200).optional(),
  tagline: z.string().max(300).optional(),
  website: z.string().max(500).optional(),
  instagram: z.string().max(120).optional(),
  linkedin: z.string().max(300).optional(),
  location: z.string().max(200).optional(),
});
export type OnboardingStepIdentity = z.infer<typeof onboardingStepIdentity>;

/** Passo 2 — Objetivos estratégicos e prazos. */
export const onboardingStepGoals = z.object({
  primaryObjective: z.string().min(1, "Objetivo principal é obrigatório").max(2000).optional(),
  secondaryObjectives: z.array(z.string().max(1000)).max(20).optional(),
  horizon: z.enum(["30d", "90d", "6m", "12m"]).optional(),
  successMetrics: z.string().max(1000).optional(),
});
export type OnboardingStepGoals = z.infer<typeof onboardingStepGoals>;

/** Passo 3 — Produtos/serviços. */
export const onboardingStepOffer = z.object({
  products: z
    .array(
      z.object({
        name: z.string().min(1).max(200),
        pitch: z.string().max(500).optional(),
        price: z.string().max(60).optional(),
      }),
    )
    .max(20)
    .optional(),
  services: z
    .array(z.object({ name: z.string().min(1).max(200), pitch: z.string().max(500).optional() }))
    .max(20)
    .optional(),
});
export type OnboardingStepOffer = z.infer<typeof onboardingStepOffer>;

/** Passo 4 — ICP (perfil de cliente ideal). */
export const onboardingStepICP = z.object({
  description: z.string().max(4000).optional(),
  demographics: z.string().max(2000).optional(),
  painPoints: z.array(z.string().max(1000)).max(30).optional(),
  desires: z.array(z.string().max(1000)).max(30).optional(),
  channelsWhereTheyAre: z.array(z.string().max(120)).max(20).optional(),
});
export type OnboardingStepICP = z.infer<typeof onboardingStepICP>;

/** Passo 5 — Concorrentes conhecidos e posicionamento defensivo. */
export const onboardingStepCompetition = z.object({
  competitors: z
    .array(
      z.object({
        name: z.string().min(1).max(200),
        url: z.string().max(500).optional(),
        note: z.string().max(1000).optional(),
      }),
    )
    .max(20)
    .optional(),
  differentiators: z.array(z.string().max(1000)).max(20).optional(),
});
export type OnboardingStepCompetition = z.infer<typeof onboardingStepCompetition>;

/** Passo 6 — Tom de voz e referências. */
export const onboardingStepVoice = z.object({
  tone: z.string().max(2000).optional(),
  formalityLevel: z.enum(["low", "medium", "high"]).optional(),
  doList: z.array(z.string().max(1000)).max(30).optional(),
  dontList: z.array(z.string().max(1000)).max(30).optional(),
  referenceProfiles: z.array(z.string().max(300)).max(20).optional(),
  // Campo para COLAR material bruto do próprio cliente (posts, textos, e-mails).
  // Sem limite de caracteres por decisão de produto — o operador cola o que tiver.
  referenceExamples: z.string().optional(),
});
export type OnboardingStepVoice = z.infer<typeof onboardingStepVoice>;

/** Passo 7 — Materiais complementares, links, observações finais. */
export const onboardingStepMaterials = z.object({
  materialLinks: z.array(z.string().max(500)).max(30).optional(),
  fileIds: z.array(z.string().uuid()).max(20).optional(),
  observations: z.string().max(8000).optional(),
});
export type OnboardingStepMaterials = z.infer<typeof onboardingStepMaterials>;

/** Payload completo (união dos 7 steps) — o que fica salvo em `payload`. */
export const onboardingPayload = z
  .object({
    identity: onboardingStepIdentity.optional(),
    goals: onboardingStepGoals.optional(),
    offer: onboardingStepOffer.optional(),
    icp: onboardingStepICP.optional(),
    competition: onboardingStepCompetition.optional(),
    voice: onboardingStepVoice.optional(),
    materials: onboardingStepMaterials.optional(),
  })
  .strict();
export type OnboardingPayload = z.infer<typeof onboardingPayload>;

/** Input para PATCH parcial (salvar um step). */
export const onboardingPatchInput = z.object({
  step: z.number().int().min(0).max(6).optional(),
  payload: onboardingPayload,
});
export type OnboardingPatchInput = z.infer<typeof onboardingPatchInput>;

/** Regra de completude para finalizar: exige o mínimo estratégico para a IA
 * gerar dossiê útil. Campos opcionais permanecem opcionais. */
export const onboardingCompleteness = z.object({
  identity: z.object({ displayName: z.string().min(1) }).passthrough(),
  goals: z.object({ primaryObjective: z.string().min(1) }).passthrough(),
  icp: z.object({ description: z.string().min(1) }).passthrough(),
  voice: z.object({ tone: z.string().min(1) }).passthrough(),
});

/** Checa se o payload já está completo o bastante para finalizar. */
export function isOnboardingComplete(payload: unknown): boolean {
  return onboardingCompleteness.safeParse(payload).success;
}

export const STEPS = [
  "identity",
  "goals",
  "offer",
  "icp",
  "competition",
  "voice",
  "materials",
] as const;
export type OnboardingStepKey = (typeof STEPS)[number];
