import type { Metadata, Viewport } from "next";
import PwaRegister from "./pwa-register";
import "./globals.css";

export const metadata: Metadata = {
  title: "LinkPonto | Gestão de jornada",
  description: "Controle de ponto simples, seguro e inteligente.",
  applicationName: "LinkPonto",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "LinkPonto",
  },
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/icons/icon-192.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#09271d",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
