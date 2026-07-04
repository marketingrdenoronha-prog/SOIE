import { ModuleShell } from "@/components/module-shell";

export default function EditorialPage() {
  return (
    <ModuleShell
      title="Linha Editorial"
      subtitle="Transformar a estratégia em estrutura de conteúdo."
      features={[
        { name: "Categorias & subcategorias", desc: "Os eixos de conteúdo." },
        { name: "Temas & microtemas", desc: "Pautas concretas por categoria." },
        { name: "Objetivos", desc: "Autoridade, confiança, conversão…" },
        { name: "Funil", desc: "Topo, meio e fundo (ToFu/MoFu/BoFu)." },
        { name: "Plataformas", desc: "Onde cada linha atua." },
        { name: "Geração por IA", desc: "Agente Planejamento + Crítico a partir de mercado, audiência e DNA." },
      ]}
    />
  );
}
