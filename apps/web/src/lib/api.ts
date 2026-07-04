const BASE = "/api/v1";
const TOKEN_KEY = "soie.token";

export function getToken(): string | null {
  return typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null;
}
export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}
export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}
export function isLoggedIn(): boolean {
  return !!getToken();
}

/** Typed fetch wrapper. Attaches the bearer token and unwraps the error envelope. */
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const b = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
    throw new Error(b?.error?.message ?? `Erro ${res.status}`);
  }
  return res.json() as Promise<T>;
}
