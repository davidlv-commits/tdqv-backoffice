"use client";

import { AuthGuard } from "@/components/auth-guard";
import { Sidebar } from "@/components/sidebar";
import Link from "next/link";

export default function Dashboard() {
  return (
    <AuthGuard>
      <div className="flex h-screen">
        <Sidebar />
        <main className="flex-1 overflow-auto p-8">
          <h2 className="text-2xl font-bold mb-6">Dashboard</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <StatCard title="Libros" value="2" subtitle="135 capítulos en total" />
            <StatCard title="Canciones" value="26" subtitle="13 principales + 13 instrumentales" />
            <StatCard title="Media Moments" value="0" subtitle="Aún no configurados" />
          </div>

          <h3 className="text-lg font-semibold mb-4">Acceso rápido</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <QuickLink href="/books/book1" title="Tú de qué vas" subtitle="77 capítulos · Libro I" />
            <QuickLink href="/books/book2" title="Tú de qué vas, pero no" subtitle="58 capítulos · Libro II" />
            <QuickLink href="/music" title="Gestión de música" subtitle="Tracks y asignaciones" />
            <QuickLink href="/media" title="Media" subtitle="Audios, vídeos, imágenes" />
          </div>
        </main>
      </div>
    </AuthGuard>
  );
}

function StatCard({ title, value, subtitle }: { title: string; value: string; subtitle: string }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
      <p className="text-sm text-zinc-500">{title}</p>
      <p className="text-3xl font-bold text-amber-500 mt-1">{value}</p>
      <p className="text-xs text-zinc-600 mt-1">{subtitle}</p>
    </div>
  );
}

function QuickLink({ href, title, subtitle }: { href: string; title: string; subtitle: string }) {
  return (
    <Link href={href} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 hover:border-amber-500/30 transition-colors block">
      <p className="font-medium">{title}</p>
      <p className="text-sm text-zinc-500 mt-1">{subtitle}</p>
    </Link>
  );
}
