"use client";

import { AuthGuard } from "@/components/auth-guard";
import { Sidebar } from "@/components/sidebar";

export default function MediaPage() {
  return (
    <AuthGuard>
      <div className="flex h-screen">
        <Sidebar />
        <main className="flex-1 overflow-auto p-8">
          <h2 className="text-2xl font-bold mb-6">Gestión de media</h2>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center">
            <p className="text-zinc-400 mb-2">Próximamente</p>
            <p className="text-sm text-zinc-600">
              Aquí podrás gestionar audios (grabaciones, narraciones), vídeos e imágenes
              que se insertan como sorpresas en los capítulos.
            </p>
          </div>
        </main>
      </div>
    </AuthGuard>
  );
}
