import { ModuleShell } from "@/components/module-shell";

export default function LibraryPage() {
  return (
    <ModuleShell
      title="Biblioteca"
      subtitle="Repositório reutilizável de estruturas de alta performance."
      features={[
        { name: "Frameworks", desc: "AIDA, PAS, StoryBrand e outros." },
        { name: "Hooks", desc: "Ganchos de abertura por emoção e plataforma." },
        { name: "Storytelling & analogias", desc: "Estruturas narrativas reutilizáveis." },
        { name: "CTA", desc: "Chamadas para ação testadas." },
        { name: "Scripts", desc: "Roteiros base de vídeo e reels." },
        { name: "Templates", desc: "Modelos de peça e carrossel." },
      ]}
    />
  );
}
