"use client";

import { useEffect, useState } from "react";
import { AuthGuard } from "@/components/auth-guard";
import { Sidebar } from "@/components/sidebar";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface ChapterStats {
  chapterNumber: number;
  completions: number;
}

export default function ReadingPage() {
  const [chapterStats, setChapterStats] = useState<ChapterStats[]>([]);
  const [totalReadingMinutes, setTotalReadingMinutes] = useState(0);
  const [avgChapters, setAvgChapters] = useState(0);
  const [maxChapter, setMaxChapter] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const snap = await getDocs(collection(db, "user_points"));
      let totalMin = 0;
      let totalCh = 0;
      let maxCh = 0;
      const chapterCounts: Record<number, number> = {};

      snap.docs.forEach((d) => {
        const data = d.data();
        totalMin += data.totalReadingMinutes ?? 0;
        totalCh += data.chaptersCompleted ?? 0;
        const ch = data.chaptersCompleted ?? 0;
        if (ch > maxCh) maxCh = ch;
      });

      // Also check reading_progress for chapter completion details.
      // For now, aggregate from user_points.
      for (let i = 1; i <= maxCh; i++) {
        let count = 0;
        snap.docs.forEach((d) => {
          if ((d.data().chaptersCompleted ?? 0) >= i) count++;
        });
        chapterCounts[i] = count;
      }

      setTotalReadingMinutes(totalMin);
      setAvgChapters(snap.docs.length > 0 ? Math.round(totalCh / snap.docs.length) : 0);
      setMaxChapter(maxCh);
      setChapterStats(
        Object.entries(chapterCounts).map(([k, v]) => ({
          chapterNumber: parseInt(k),
          completions: v,
        }))
      );
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
          <h2 className="text-2xl font-bold text-zinc-900 mb-2">Lectura</h2>
          <p className="text-sm text-zinc-500 mb-6">Métricas de lectura y progreso</p>

          {loading ? (
            <p className="text-zinc-500">Cargando...</p>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-4 mb-8">
                <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-sm">
                  <div className="text-xs text-zinc-500 mb-1">Tiempo total de lectura</div>
                  <div className="text-2xl font-bold text-zinc-800">
                    {totalReadingMinutes > 60
                      ? `${Math.round(totalReadingMinutes / 60)}h ${totalReadingMinutes % 60}m`
                      : `${totalReadingMinutes}m`}
                  </div>
                </div>
                <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-sm">
                  <div className="text-xs text-zinc-500 mb-1">Media de capítulos por usuario</div>
                  <div className="text-2xl font-bold text-zinc-800">{avgChapters}</div>
                </div>
                <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-sm">
                  <div className="text-xs text-zinc-500 mb-1">Capítulo más avanzado</div>
                  <div className="text-2xl font-bold text-zinc-800">{maxChapter}</div>
                </div>
              </div>

              {/* Chapter completion funnel */}
              <div className="bg-white border border-zinc-200 rounded-xl p-6 shadow-sm">
                <h3 className="font-semibold text-zinc-700 mb-4">Funnel de capítulos</h3>
                <p className="text-xs text-zinc-400 mb-4">
                  Cuántos usuarios llegaron a cada capítulo
                </p>
                <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
                  {chapterStats.length === 0 ? (
                    <p className="text-sm text-zinc-400">Sin datos aún</p>
                  ) : chapterStats.map((ch) => {
                    const maxComp = chapterStats[0]?.completions ?? 1;
                    const pct = (ch.completions / maxComp) * 100;
                    return (
                      <div key={ch.chapterNumber} className="flex items-center gap-3">
                        <span className="text-xs text-zinc-400 w-8 text-right font-mono">{ch.chapterNumber}</span>
                        <div className="flex-1 h-5 bg-zinc-100 rounded overflow-hidden">
                          <div
                            className="h-full bg-amber-500/70 rounded transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs text-zinc-500 w-8">{ch.completions}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </AuthGuard>
  );
}
