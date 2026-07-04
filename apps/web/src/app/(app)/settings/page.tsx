import { ModuleShell } from "@/components/module-shell";

export default function SettingsPage() {
  return (
    <ModuleShell
      title="Configurações"
      subtitle="Administração da organização."
      features={[
        { name: "Equipe", desc: "Membros e convites." },
        { name: "Permissões", desc: "Papéis e escopos (RBAC)." },
        { name: "API Keys", desc: "Chaves de integração do tenant." },
        { name: "Chaves de IA", desc: "OpenAI, Claude, Gemini e DeepSeek (BYOK), cifradas." },
        { name: "Modelos", desc: "Política de modelo por tarefa e ordem de fallback." },
        { name: "Prompts", desc: "Gestão e versionamento dos prompts da org." },
      ]}
    />
  );
}
