import { ModuleShell } from "@/components/module-shell";

export default function ClientsPage() {
  return (
    <ModuleShell
      title="Clientes"
      subtitle="Cadastro e base de conhecimento de cada cliente atendido pela agência."
      features={[
        { name: "Cadastro", desc: "Dados, indústria, site, contatos e responsável." },
        { name: "Briefings", desc: "Onboarding estruturado; o Agente Cliente consolida o contexto." },
        { name: "Documentos & Arquivos", desc: "Uploads que viram base de conhecimento (RAG)." },
        { name: "Marca", desc: "Tom de voz, ICP, produtos e objetivos." },
        { name: "Tags & status", desc: "Organização e filtro dos clientes." },
        { name: "Marcas", desc: "Um cliente pode ter várias marcas." },
      ]}
    />
  );
}
