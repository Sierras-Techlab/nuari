import type { Metadata } from "next";
import { Geist_Mono, Manrope } from "next/font/google";

import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  title: "nuari - Todo tu negocio, en un solo lugar",
  description: "Gestioná clientes, ventas, turnos, productos y más desde una plataforma simple para tu negocio.",
  metadataBase: new URL("https://nuari.app"),
  openGraph: {
    title: "nuari - Todo tu negocio, en un solo lugar",
    description: "Gestioná clientes, ventas, turnos, productos y más desde una plataforma simple para tu negocio.",
    locale: "es_AR",
    type: "website",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es-AR" className={`${manrope.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `try{const t=localStorage.getItem("nuari-theme");if(t==="dark"||(t!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches))document.documentElement.classList.add("dark");else document.documentElement.classList.add("light")}catch{}` }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
