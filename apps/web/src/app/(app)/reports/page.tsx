import { ModuleShell } from "@/components/module-shell";

export default function ReportsPage() {
  return (
    <ModuleShell
      title="Relatórios"
      subtitle="Consolidar resultados para o cliente e para a gestão."
      features={[
        { name: "Performance", desc: "Posts publicados e métricas." },
        { name: "Conteúdo", desc: "Produção por período e linha editorial." },
        { name: "Pesquisa", desc: "Síntese de mercado e audiência." },
        { name: "Custo de IA", desc: "Gasto por período, agente e modelo." },
        { name: "Exportação", desc: "PDF, CSV e decks." },
        { name: "Agendamento", desc: "Relatórios recorrentes." },
      ]}
    />
  );
}
