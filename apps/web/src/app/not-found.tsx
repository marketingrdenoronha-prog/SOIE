import Link from "next/link";

export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center bg-surface p-6">
      <div className="text-center">
        <p className="text-sm font-medium uppercase tracking-wider text-muted">Erro 404</p>
        <h1 className="mt-2 text-2xl font-semibold">Página não encontrada</h1>
        <p className="mt-2 text-sm text-muted">O endereço não existe ou foi movido.</p>
        <Link
          href="/dashboard"
          className="mt-6 inline-block rounded-lg bg-brand px-5 py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          Ir para o Dashboard
        </Link>
      </div>
    </div>
  );
}
