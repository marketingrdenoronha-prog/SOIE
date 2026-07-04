import { ModuleShell } from "@/components/module-shell";

export default function CalendarPage() {
  return (
    <ModuleShell
      title="Calendário"
      subtitle="Planejar e visualizar a execução editorial no tempo."
      features={[
        { name: "Visão mensal e semanal", desc: "Duas perspectivas do plano." },
        { name: "Drag and drop", desc: "Arraste os itens entre dias e horários." },
        { name: "Filtros", desc: "Por plataforma, status, linha editorial e responsável." },
        { name: "Status por item", desc: "Do planejado ao publicado." },
        { name: "Geração por IA", desc: "O Agente Calendário distribui os temas por funil e cadência." },
        { name: "Ligado às entregas", desc: "Cada item aponta para um conteúdo/post." },
      ]}
    />
  );
}
