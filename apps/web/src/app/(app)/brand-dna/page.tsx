import { ModuleShell } from "@/components/module-shell";

export default function BrandDnaPage() {
  return (
    <ModuleShell
      title="DNA da Marca"
      subtitle="Codificar a identidade verbal para que todo conteúdo soe como a marca."
      features={[
        { name: "Vocabulário", desc: "Termos preferidos, proibidos e jargões." },
        { name: "Expressões", desc: "Frases e bordões característicos." },
        { name: "Tom", desc: "Registro emocional da comunicação." },
        { name: "Emojis", desc: "Política de uso por canal." },
        { name: "Formalidade", desc: "Do casual ao corporativo." },
        { name: "Arquétipos", desc: "Sábio, herói, criador… com peso e justificativa." },
      ]}
    />
  );
}
