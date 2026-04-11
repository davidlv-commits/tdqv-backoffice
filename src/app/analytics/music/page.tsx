"use client";

import { useEffect, useState } from "react";
import { AuthGuard } from "@/components/auth-guard";
import { Sidebar } from "@/components/sidebar";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface TrackStat {
  id: string;
  title: string;
  artist: string;
  plays: number;
}

export default function MusicAnalyticsPage() {
  const [totalSongs, setTotalSongs] = useState(0);
  const [totalPlays, setTotalPlays] = useState(0);
  const [tracks, setTracks] = useState<TrackStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      // User totals.
      const usersSnap = await getDocs(collection(db, "user_points"));
      let plays = 0;
      usersSnap.docs.forEach((d) => {
        plays += d.data().songsListened ?? 0;
      });
      setTotalPlays(plays);

      // Track catalog.
      const tracksSnap = await getDocs(query(collection(db, "tracks"), orderBy("order")));
      setTotalSongs(tracksSnap.docs.length);
      setTracks(tracksSnap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          title: data.title ?? "",
          artist: data.artist ?? "TDQV",
          plays: 0, // TODO: track-level play counts
        };
      }));
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }

  return (
    <AuthGuard>
      <div className="flex h-screen">
        <Sidebar />
        <main className="flex-1 overflow-auto bg-slate-50 p-8">
          <h2 className="text-2xl font-bold text-zinc-900 mb-2">Música</h2>
          <p className="text-sm text-zinc-500 mb-6">Métricas de reproducción musical</p>

          {loading ? (
            <p className="text-zinc-500">Cargando...</p>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-4 mb-8">
                <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-sm">
                  <div className="text-xs text-zinc-500 mb-1">Canciones en catálogo</div>
                  <div className="text-2xl font-bold text-zinc-800">{totalSongs}</div>
                </div>
                <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-sm">
                  <div className="text-xs text-zinc-500 mb-1">Reproducciones totales</div>
                  <div className="text-2xl font-bold text-zinc-800">{totalPlays}</div>
                </div>
                <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-sm">
                  <div className="text-xs text-zinc-500 mb-1">Media por usuario</div>
                  <div className="text-2xl font-bold text-zinc-800">
                    {totalPlays > 0 ? (totalPlays / Math.max(1, tracks.length)).toFixed(1) : "0"}
                  </div>
                </div>
              </div>

              {/* Track catalog */}
              <div className="bg-white border border-zinc-200 rounded-xl shadow-sm">
                <div className="px-5 py-4 border-b border-zinc-200">
                  <h3 className="font-semibold text-zinc-700">Catálogo ({tracks.length} tracks)</h3>
                </div>
                <div className="divide-y divide-zinc-100 max-h-[400px] overflow-y-auto">
                  {tracks.map((t, i) => (
                    <div key={t.id} className="px-5 py-3 flex items-center gap-4">
                      <span className="text-sm text-zinc-400 w-6 font-mono">{i + 1}</span>
                      <div className="flex-1">
                        <div className="text-sm font-medium text-zinc-800">{t.title}</div>
                        <div className="text-xs text-zinc-400">{t.artist}</div>
                      </div>
                      <span className="text-xs font-mono text-zinc-400">{t.id}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </AuthGuard>
  );
}
