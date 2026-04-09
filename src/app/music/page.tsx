"use client";

import { useEffect, useState } from "react";
import { AuthGuard } from "@/components/auth-guard";
import { Sidebar } from "@/components/sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getTracks, saveTrack } from "@/lib/firestore";
import type { Track } from "@/lib/types";

export default function MusicPage() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);

  useEffect(() => {
    getTracks().then((t) => { setTracks(t); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  return (
    <AuthGuard>
      <div className="flex h-screen">
        <Sidebar />
        <main className="flex-1 overflow-auto p-8">
          <h2 className="text-2xl font-bold mb-6">Gestión de música</h2>

          {loading ? (
            <p className="text-zinc-500">Cargando tracks...</p>
          ) : tracks.length === 0 ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center">
              <p className="text-zinc-400 mb-2">No hay tracks en Firestore</p>
              <p className="text-sm text-zinc-600">Necesitas migrar los tracks desde el código Flutter.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {tracks.map((track) => (
                <div
                  key={track.id}
                  className="flex items-center gap-4 bg-zinc-900 border border-zinc-800 rounded-lg px-5 py-4"
                >
                  <span className="text-amber-500/60 font-mono text-sm w-6">{track.order}</span>
                  <div className="flex-1">
                    <p className="font-medium">{track.title}</p>
                    <p className="text-sm text-zinc-500">{track.artist} · {track.album}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {track.isInstrumental && (
                      <Badge variant="outline" className="text-purple-400 border-purple-400/30">
                        Instrumental
                      </Badge>
                    )}
                    {track.active ? (
                      <Badge className="bg-green-500/20 text-green-400">Activo</Badge>
                    ) : (
                      <Badge className="bg-zinc-700 text-zinc-400">Inactivo</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </AuthGuard>
  );
}
