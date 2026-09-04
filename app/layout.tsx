import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LinkPonto | Gestão de jornada",
  description: "Controle de ponto simples, seguro e inteligente.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">{children}</body>
    </html>
  );
}
