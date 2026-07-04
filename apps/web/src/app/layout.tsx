import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SOIE — Sistema Operacional de Inteligência Editorial",
  description: "Plataforma de inteligência editorial com IA para agências.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className="antialiased">{children}</body>
    </html>
  );
}
