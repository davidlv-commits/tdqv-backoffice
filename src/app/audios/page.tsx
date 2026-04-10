"use client";

import { AuthGuard } from "@/components/auth-guard";
import { Sidebar } from "@/components/sidebar";

export default function AudiosPage() {
  return (
    <AuthGuard>
      <div className="flex h-screen">
        <Sidebar />
        <main className="flex-1 overflow-auto bg-slate-50 p-8">
          <h2 className="text-2xl font-bold text-zinc-900 mb-6">
            Gestión de audios
          </h2>

          <div className="bg-white border border-zinc-200 rounded-xl p-8 text-center shadow-sm">
            <p className="text-4xl mb-4">🎙️</p>
            <p className="text-zinc-600 font-medium mb-2">Próximamente</p>
            <p className="text-sm text-zinc-400 max-w-md mx-auto">
              Sube y gestiona grabaciones de voz y otros audios para los
              capítulos. Podrás añadir narraciones, efectos de sonido y
              ambientación sonora como media moments.
            </p>
          </div>
        </main>
      </div>
    </AuthGuard>
  );
}
