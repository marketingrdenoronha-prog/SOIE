"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, setToken } from "@/lib/api";
import { Logo } from "@/components/logo";
import "../globals.css";

interface Tokens { accessToken: string }

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("register");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [orgName, setOrgName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const path = mode === "register" ? "/auth/register" : "/auth/login";
      const payload =
        mode === "register"
          ? { email, password, name, organizationName: orgName }
          : { email, password };
      const res = await api<Tokens>(path, { method: "POST", body: JSON.stringify(payload) });
      setToken(res.accessToken);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao entrar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-surface p-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-elevated p-7">
        <div className="mb-6 flex items-center">
          <Logo className="h-9 w-auto" />
        </div>
        <h1 className="text-lg font-semibold">
          {mode === "register" ? "Criar conta" : "Entrar"}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {mode === "register"
            ? "Crie sua organização para começar."
            : "Acesse sua organização."}
        </p>

        <form onSubmit={submit} className="mt-5 space-y-3">
          {mode === "register" && (
            <>
              <Field label="Seu nome" value={name} onChange={setName} />
              <Field label="Nome da organização" value={orgName} onChange={setOrgName} />
            </>
          )}
          <Field label="E-mail" type="email" value={email} onChange={setEmail} />
          <Field label="Senha" type="password" value={password} onChange={setPassword} />

          {error && <p className="text-sm text-rose-500">{error}</p>}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-brand py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "Aguarde…" : mode === "register" ? "Criar conta" : "Entrar"}
          </button>
        </form>

        <button
          onClick={() => { setMode(mode === "register" ? "login" : "register"); setError(null); }}
          className="mt-4 w-full text-center text-sm text-muted hover:text-foreground"
        >
          {mode === "register" ? "Já tem conta? Entrar" : "Não tem conta? Criar"}
        </button>
      </div>
    </div>
  );
}

function Field({
  label, value, onChange, type = "text",
}: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
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
