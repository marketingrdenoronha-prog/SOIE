import { ModuleShell } from "@/components/module-shell";

export default function MarketPage() {
  return (
    <ModuleShell
      title="Inteligência de Mercado"
      subtitle="Entender o mercado, os concorrentes e o momento."
      features={[
        { name: "Pesquisa automática", desc: "Dispara conectores + Agentes Mercado/Concorrência." },
        { name: "Concorrentes", desc: "Posicionamento, forças, fraquezas e estratégia de conteúdo." },
        { name: "Benchmark", desc: "Frequência, formatos e temas dos concorrentes." },
        { name: "Notícias", desc: "Menções relevantes com sentimento." },
        { name: "Tendências", desc: "Google Trends, Reddit, TikTok, Instagram, LinkedIn, YouTube." },
        { name: "SWOT", desc: "Oportunidades e ameaças com nível de confiança." },
      ]}
    />
  );
}
