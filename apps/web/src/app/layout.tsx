import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

// Cyber-Editorial OS type system: Hanken Grotesk for text, JetBrains Mono for
// labels, status chips and data. Self-hosted variable woff2 (latin) so the
// build has NO network dependency and the runtime serves them locally.
const sans = localFont({
  src: "./fonts/hanken-var.woff2",
  weight: "400 700",
  variable: "--font-sans",
  display: "swap",
});
const mono = localFont({
  src: "./fonts/jbmono-var.woff2",
  weight: "500 600",
  variable: "--font-mono",
  display: "swap",
});

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
    <html lang="pt-BR" className={`${sans.variable} ${mono.variable}`} suppressHydrationWarning>
      <body className="antialiased">{children}</body>
    </html>
  );
}
