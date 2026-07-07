"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { isLoggedIn } from "@/lib/api";

/**
 * Trava de acesso da plataforma. Envolve todo o shell autenticado (grupo
 * `(app)`): quem NÃO tem sessão é mandado para /login antes de ver qualquer
 * tela. Quem JÁ está logado passa direto — o gate nunca apaga o token nem
 * desconecta. Páginas públicas (login, cadastro, revisão por link) ficam fora
 * do grupo `(app)`, então não são afetadas.
 *
 * A verificação é no cliente porque o JWT vive no localStorage (não em cookie),
 * fora do alcance de um middleware. Tokens presentes mas expirados continuam
 * sendo tratados pelo `api()` (401 → limpa e volta ao login).
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (isLoggedIn()) {
      setReady(true);
    } else {
      // Guarda o destino para voltar depois do login.
      const next = pathname && pathname !== "/" ? `?next=${encodeURIComponent(pathname)}` : "";
      router.replace(`/login${next}`);
    }
  }, [router, pathname]);

  if (!ready) {
    // Enquanto verifica (ou redireciona), não mostra nada da plataforma.
    return (
      <div className="grid min-h-screen place-items-center bg-surface">
        <p className="text-sm text-muted">Verificando acesso…</p>
      </div>
    );
  }
  return <>{children}</>;
}
