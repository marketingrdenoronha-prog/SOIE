import { z } from "zod";

/**
 * Environment schema. Validated once at process start; import { env } from here.
 * Missing/invalid vars fail fast with a readable error instead of surfacing
 * as an undefined at some deep call site later.
 */
const EnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  API_PORT: z.coerce.number().default(3333),
  WEB_PORT: z.coerce.number().default(3000),
  APP_URL: z.string().url().default("http://localhost:3000"),
  API_URL: z.string().url().default("http://localhost:3333"),

  // Optional so the app can be built without a DB reachable (CI / Vercel first
  // deploy). At request time, Prisma raises a clear error if the URL is empty.
  DATABASE_URL: z.string().default(""),
  // Optional: when unset (e.g. serverless on Vercel), jobs run inline instead
  // of via BullMQ/Redis. Set it to enable the queue + worker.
  REDIS_URL: z.string().optional(),

  JWT_ACCESS_SECRET: z.string().min(8).default("dev-access-secret"),
  JWT_REFRESH_SECRET: z.string().min(8).default("dev-refresh-secret"),
  // Segredo do reset administrativo de senha. Quando VAZIO, a rota de reset
  // fica DESLIGADA (não vira porta aberta). Defina um valor forte no ambiente
  // para habilitar a redefinição de senha por e-mail sem estar logado.
  ADMIN_RESET_SECRET: z.string().optional(),
  // Long-lived access token: there is no refresh-token flow yet, so a short TTL
  // would silently log users out mid-use. 30 days = "log in once, keep using".
  JWT_ACCESS_TTL: z.coerce.number().default(60 * 60 * 24 * 30),
  JWT_REFRESH_TTL: z.coerce.number().default(60 * 60 * 24 * 30),

  SECRETS_MASTER_KEY: z.string().default("base64:dev-master-key"),

  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  DEEPSEEK_API_KEY: z.string().optional(),

  S3_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().default("auto"),
  S3_BUCKET: z.string().default("soie"),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),

  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
});

export type Env = z.infer<typeof EnvSchema>;

let cached: Env | null = null;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  if (cached) return cached;
  const parsed = EnvSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  cached = parsed.data;
  // Segurança: em produção, rodar com os segredos JWT default significa que
  // qualquer pessoa pode forjar tokens válidos. Não derruba o processo (para
  // não travar um deploy existente), mas grita no log a cada cold start.
  if (cached.NODE_ENV === "production") {
    if (cached.JWT_ACCESS_SECRET === "dev-access-secret" || cached.JWT_REFRESH_SECRET === "dev-refresh-secret") {
      console.error(
        "[SECURITY] JWT_ACCESS_SECRET/JWT_REFRESH_SECRET estão com o valor default de desenvolvimento em produção. " +
        "Qualquer token pode ser forjado. Configure segredos fortes nas variáveis de ambiente AGORA.",
      );
    }
  }
  return cached;
}

export const env: Env = loadEnv();
