"use client";

import { useState } from "react";
import { Logo } from "@/components/logo";
import "../globals.css";

/** Redefinição administrativa de senha. Página pública, mas o reset só funciona
 * com o SEGREDO DE ADMINISTRADOR (env ADMIN_RESET_SECRET) — serve para recuperar
 * o acesso quando ninguém consegue logar, sem depender de e-mail. */
export default function ResetPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [secret, setSecret] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      const r = await fetch("/api/v1/auth/admin-reset", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, newPassword: password, secret }),
      });
      if (!r.ok) {
        const b = await r.json().catch(() => null);
        throw new Error(b?.error?.message ?? (r.status === 404 ? "Reset desativado ou usuário não encontrado" : `Erro ${r.status}`));
      }
      setDone(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Falha ao redefinir");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-surface p-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-elevated p-7">
        <div className="mb-6 flex items-center">
          <Logo className="h-12 w-auto" />
        </div>
        <h1 className="text-lg font-semibold">Redefinir senha</h1>
        <p className="mt-1 text-sm text-muted">
          Recuperação de acesso com o segredo de administrador. Após redefinir, entre normalmente pelo login.
        </p>

        {done ? (
          <div className="mt-5 rounded-lg border border-ok/40 bg-ok/10 p-3 text-sm">
            <p className="font-medium text-ok">Senha redefinida.</p>
            <p className="mt-1 text-muted">Agora é só entrar com o e-mail e a nova senha.</p>
            <a href="/login" className="mt-3 inline-block rounded-md bg-brand px-4 py-2 text-xs font-semibold text-white dark:text-[#00390d]">Ir para o login</a>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-5 space-y-3">
            <Field label="E-mail da conta" type="email" value={email} onChange={setEmail} />
            <Field label="Nova senha (mín. 8)" type="password" value={password} onChange={setPassword} />
            <Field label="Segredo de administrador" type="password" value={secret} onChange={setSecret} />
            {err && <p className="text-sm text-rose-500">{err}</p>}
            <button type="submit" disabled={busy} className="w-full rounded-lg bg-brand py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 dark:text-[#00390d]">
              {busy ? "Redefinindo…" : "Redefinir senha"}
            </button>
          </form>
        )}

        <a href="/login" className="mt-4 block text-center text-sm text-muted hover:text-foreground">Voltar ao login</a>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-muted">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-brand"
      />
    </label>
  );
}
