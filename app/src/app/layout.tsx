import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nuari",
  description: "Gestión modular para pequeños negocios.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
