import { env } from "@soie/config";

/**
 * Cliente da API do Zernio (publicação/agendamento em redes sociais).
 *
 * Modelo do Zernio: uma chave da agência → vários "profiles" (um por cliente) →
 * cada profile tem "accounts" (contas conectadas por rede) → "posts" agendados
 * para uma ou mais accounts. Docs: https://docs.zernio.com
 *
 * Só é usado quando ZERNIO_API_KEY está configurada. Sem a chave, o SOIE ainda
 * monta e guarda o plano de agendamento (data + legenda por peça); só não
 * publica de verdade.
 */

const BASE = "https://zernio.com/api/v1";

export function hasZernio(): boolean {
  return Boolean(env.ZERNIO_API_KEY);
}

/** Plataformas suportadas para conectar (subset relevante). */
export const ZERNIO_PLATFORMS = [
  "instagram",
  "facebook",
  "tiktok",
  "linkedin",
  "youtube",
  "threads",
  "pinterest",
] as const;
export type ZernioPlatform = (typeof ZERNIO_PLATFORMS)[number];

/** Mapeia o canal interno do SOIE para a plataforma do Zernio. */
export function channelToPlatform(channel: string): ZernioPlatform | null {
  const c = (channel || "").toLowerCase();
  if (c.includes("insta")) return "instagram";
  if (c.includes("tiktok")) return "tiktok";
  if (c.includes("face") || c.includes("meta")) return "facebook";
  if (c.includes("linkedin")) return "linkedin";
  if (c.includes("you")) return "youtube";
  if (c.includes("thread")) return "threads";
  if (c.includes("pin")) return "pinterest";
  return null;
}

class ZernioError extends Error {}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  if (!env.ZERNIO_API_KEY) throw new ZernioError("Zernio não configurado (defina ZERNIO_API_KEY).");
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: {
        authorization: `Bearer ${env.ZERNIO_API_KEY}`,
        "content-type": "application/json",
        ...(init?.headers ?? {}),
      },
      signal: AbortSignal.timeout(30_000),
    });
  } catch (e) {
    throw new ZernioError(`Falha de rede ao falar com o Zernio: ${String(e)}`);
  }
  const text = await res.text();
  const data = text ? safeJson(text) : {};
  if (!res.ok) {
    const msg = (data && (data.message || data.error)) || `HTTP ${res.status}`;
    throw new ZernioError(`Zernio: ${msg}`);
  }
  return data as T;
}

function safeJson(t: string): any {
  try { return JSON.parse(t); } catch { return { raw: t }; }
}

/** Cria um profile (container das contas do cliente) e devolve o profileId. */
export async function createProfile(name: string): Promise<string> {
  const data = await call<any>("/profiles", { method: "POST", body: JSON.stringify({ name }) });
  const id = data?.profile?.id ?? data?.profile?._id ?? data?.id ?? data?._id;
  if (!id) throw new ZernioError("Zernio não retornou o profileId.");
  return String(id);
}

/**
 * Obtém a URL de AUTORIZAÇÃO real da rede (o "conectar um por um"). O endpoint
 * /connect/{platform} do Zernio não redireciona: ele responde um JSON com
 * `authUrl` (a página de login/OAuth da própria rede). É essa authUrl que o
 * operador abre para logar na conta do cliente e autorizar.
 */
export async function getConnectAuthUrl(profileId: string, platform: ZernioPlatform): Promise<string> {
  const data = await call<any>(`/connect/${platform}?profileId=${encodeURIComponent(profileId)}`);
  const url = data?.authUrl ?? data?.url ?? data?.redirectUrl;
  if (!url) throw new ZernioError("Zernio não retornou a URL de autorização (authUrl).");
  return String(url);
}

export interface ZernioAccount {
  accountId: string;
  platform: string;
  name: string | null;
}

/** Lista as contas conectadas de um profile. */
export async function listAccounts(profileId: string): Promise<ZernioAccount[]> {
  const data = await call<any>(`/accounts?profileId=${encodeURIComponent(profileId)}`);
  const arr: any[] = Array.isArray(data) ? data : (data?.accounts ?? data?.data ?? []);
  return arr.map((a) => ({
    accountId: String(a._id ?? a.id ?? a.accountId ?? ""),
    platform: String(a.platform ?? a.provider ?? ""),
    name: a.name ?? a.username ?? a.displayName ?? null,
  })).filter((a) => a.accountId);
}

export interface SchedulePostInput {
  profileId: string;
  accountId: string;
  platform: string;
  content: string;
  mediaUrls: string[];
  scheduledFor?: string; // ISO; ausente = publica já
  timezone?: string;
}

/** Cria (agenda ou publica) um post. Devolve o id do post no Zernio. */
export async function createPost(input: SchedulePostInput): Promise<string> {
  const body: Record<string, unknown> = {
    profileId: input.profileId,
    content: input.content,
    platforms: [{ platform: input.platform, accountId: input.accountId }],
    mediaUrls: input.mediaUrls,
  };
  if (input.scheduledFor) {
    body.scheduledFor = input.scheduledFor;
    body.timezone = input.timezone ?? "America/Sao_Paulo";
  } else {
    body.publishNow = true;
  }
  const data = await call<any>("/posts", { method: "POST", body: JSON.stringify(body) });
  const id = data?.post?.id ?? data?.post?._id ?? data?.id ?? data?._id;
  return id ? String(id) : "";
}
