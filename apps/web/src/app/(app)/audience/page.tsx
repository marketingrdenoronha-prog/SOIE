import { ModuleShell } from "@/components/module-shell";

export default function AudiencePage() {
  return (
    <ModuleShell
      title="Inteligência da Audiência"
      subtitle="Compreender profundamente quem compra."
      features={[
        { name: "Persona", desc: "Perfil demográfico e psicográfico, canais e consciência." },
        { name: "Dores & objeções", desc: "Mapeadas e priorizadas, com evidências." },
        { name: "Desejos & motivações", desc: "O que move a decisão de compra." },
        { name: "Perguntas", desc: "Dúvidas reais da audiência viram pauta." },
        { name: "Sentimento", desc: "Análise de comentários e menções." },
        { name: "Linguagem", desc: "Como a audiência fala (insumo do DNA da marca)." },
      ]}
    />
  );
}
