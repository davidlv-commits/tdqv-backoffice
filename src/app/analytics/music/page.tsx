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
  album: string;
  plays: number;
  isInstrumental: boolean;
  showInLibrary: boolean;
  hasLyrics: boolean;
  hasCover: boolean;
}

export default function MusicAnalyticsPage() {
  const [tracks, setTracks] = useState<TrackStat[]>([]);
  const [totalPlays, setTotalPlays] = useState(0);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<"plays" | "title" | "album">("plays");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const snap = await getDocs(collection(db, "tracks"));
      let plays = 0;
      const list = snap.docs.map((d) => {
        const data = d.data();
        const p = data.playCount ?? 0;
        plays += p;
        return {
          id: d.id,
          title: data.title ?? "",
          artist: data.artist ?? "TDQV",
          album: data.album ?? "",
          plays: p,
          isInstrumental: data.isInstrumental ?? false,
          showInLibrary: data.showInLibrary !== false,
          hasLyrics: !!(data.lyrics && data.lyrics.length > 0),
          hasCover: !!(data.coverUrl && data.coverUrl.length > 0),
        };
      });
      setTotalPlays(plays);
      setTracks(list);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }

  const sorted = [...tracks].sort((a, b) => {
    if (sortBy === "plays") return b.plays - a.plays;
    if (sortBy === "album") return a.album.localeCompare(b.album) || a.title.localeCompare(b.title);
    return a.title.localeCompare(b.title);
  });

  const mainTracks = sorted.filter((t) => !t.isInstrumental);
  const instrumentalTracks = sorted.filter((t) => t.isInstrumental);
  const topTrack = [...tracks].sort((a, b) => b.plays - a.plays)[0];

  // Group by album.
  const albums = new Map<string, { count: number; plays: number }>();
  tracks.forEach((t) => {
    const a = t.album || "Sin álbum";
    const cur = albums.get(a) ?? { count: 0, plays: 0 };
    albums.set(a, { count: cur.count + 1, plays: cur.plays + t.plays });
  });

  return (
    <AuthGuard>
      <div className="flex h-screen">
        <Sidebar />
        <main className="flex-1 overflow-auto bg-slate-50 p-8">
          <h2 className="text-2xl font-bold text-zinc-900 mb-2">Música</h2>
          <p className="text-sm text-zinc-500 mb-6">Reproducciones y catálogo</p>

          {loading ? (
            <p className="text-zinc-500">Cargando...</p>
          ) : (
            <>
              {/* KPIs */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-sm">
                  <div className="text-xs text-zinc-500 mb-1">Canciones</div>
                  <div className="text-2xl font-bold text-zinc-800">{mainTracks.length}</div>
                  <div className="text-xs text-zinc-400">{instrumentalTracks.length} instrumentales</div>
                </div>
                <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-sm">
                  <div className="text-xs text-zinc-500 mb-1">Reproducciones totales</div>
                  <div className="text-2xl font-bold text-amber-600">{totalPlays.toLocaleString()}</div>
                </div>
                <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-sm">
                  <div className="text-xs text-zinc-500 mb-1">Más reproducida</div>
                  <div className="text-lg font-bold text-zinc-800 truncate">{topTrack?.title ?? "—"}</div>
                  <div className="text-xs text-amber-600">{topTrack?.plays ?? 0} reproducciones</div>
                </div>
                <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-sm">
                  <div className="text-xs text-zinc-500 mb-1">Álbumes</div>
                  <div className="text-2xl font-bold text-zinc-800">{albums.size}</div>
                </div>
              </div>

              {/* Sort controls */}
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xs text-zinc-500">Ordenar por:</span>
                {(["plays", "title", "album"] as const).map((s) => (
                  <button key={s} onClick={() => setSortBy(s)}
                    className={`text-xs px-3 py-1 rounded-full border ${
                      sortBy === s ? "bg-amber-100 border-amber-300 text-amber-700 font-bold" : "border-zinc-200 text-zinc-500"
                    }`}>
                    {s === "plays" ? "▶ Reproducciones" : s === "title" ? "A-Z Título" : "💿 Álbum"}
                  </button>
                ))}
              </div>

              {/* Track table */}
              <div className="bg-white border border-zinc-200 rounded-xl shadow-sm overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 bg-zinc-50">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 w-8">#</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500">Título</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500">Álbum</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500">Artista</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-amber-600">▶ Reprod.</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-zinc-500">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((t, i) => (
                      <tr key={t.id} className="border-b border-zinc-100 hover:bg-zinc-50">
                        <td className="px-4 py-3 text-zinc-400 font-mono text-xs">{i + 1}</td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-zinc-800">{t.title}</div>
                          {t.isInstrumental && (
                            <span className="text-[10px] text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded">Instrumental</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-zinc-500 text-xs">{t.album || "—"}</td>
                        <td className="px-4 py-3 text-zinc-500 text-xs">{t.artist}</td>
                        <td className="px-4 py-3 text-right">
                          <span className={`font-bold ${t.plays > 0 ? "text-amber-600" : "text-zinc-300"}`}>
                            {t.plays.toLocaleString()}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {t.hasCover && <span title="Carátula" className="text-xs">🖼️</span>}
                            {t.hasLyrics && <span title="Letras" className="text-xs">📝</span>}
                            {!t.showInLibrary && <span title="Solo fondo" className="text-[10px] bg-zinc-100 text-zinc-500 px-1.5 rounded">BG</span>}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </main>
      </div>
    </AuthGuard>
  );
}
