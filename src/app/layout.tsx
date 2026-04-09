import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "TDQV Backoffice",
  description: "Panel de administración de contenido",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className="h-full dark">
      <body className={`${inter.className} min-h-full bg-zinc-900 text-zinc-100`}>
        {children}
      </body>
    </html>
  );
}
