"use client";

import { useEffect, useState } from "react";
import { AuthGuard } from "@/components/auth-guard";
import { Sidebar } from "@/components/sidebar";
import { collection, getCountFromServer, getDocs, query, orderBy, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";

const MILESTONES = [
  { target: 1000, label: "1K", prize1: "3 meses Premium", prize2: "3 meses Premium" },
  { target: 5000, label: "5K", prize1: "6 meses Premium", prize2: "6 meses Premium" },
  { target: 10000, label: "10K", prize1: "1 año Premium + merchandising", prize2: "1 año Premium" },
  { target: 25000, label: "25K", prize1: "1 año + cena presencial con autor", prize2: "Cena presencial" },
  { target: 50000, label: "50K", prize1: "iPhone + comida presencial", prize2: "iPhone + comida" },
  { target: 100000, label: "100K", prize1: "Viaje 15 días escenarios del libro", prize2: "Viaje 15 días" },
];

interface Leader {
  id: string;
  points: number;
  streak: number;
  tier: string;
}

export default function MilestonesPage() {
  const [totalUsers, setTotalUsers] = useState(0);
  const [topUsers, setTopUsers] = useState<Leader[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const countSnap = await getCountFromServer(collection(db, "user_points"));
      setTotalUsers(countSnap.data().count);

      const topSnap = await getDocs(
        query(collection(db, "user_points"), orderBy("currentMilestonePoints", "desc"), limit(20))
      );
      setTopUsers(topSnap.docs.map((d) => ({
        id: d.id,
        points: d.data().currentMilestonePoints ?? 0,
        streak: d.data().streak ?? 0,
        tier: d.data().subscriptionTier ?? "free",
      })));
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }

  // Find current milestone.
  const currentMilestone = MILESTONES.find((m) => totalUsers < m.target) ?? MILESTONES[MILESTONES.length - 1];
  const prevMilestone = MILESTONES[MILESTONES.indexOf(currentMilestone) - 1];

  return (
    <AuthGuard>
      <div className="flex h-screen">
        <Sidebar />
        <main className="flex-1 overflow-auto bg-slate-50 p-8">
          <h2 className="text-2xl font-bold text-zinc-900 mb-2">Hitos y Premios</h2>
          <p className="text-sm text-zinc-500 mb-6">Progreso hacia el próximo hito</p>

          {loading ? (
            <p className="text-zinc-500">Cargando...</p>
          ) : (
            <>
              {/* Current milestone hero */}
              <div className="bg-gradient-to-r from-amber-50 to-purple-50 border border-amber-200 rounded-2xl p-8 mb-8">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="text-sm text-amber-600 font-medium mb-1">Próximo hito</div>
                    <div className="text-4xl font-bold text-zinc-900">{currentMilestone.label} usuarios</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-zinc-500">Progreso</div>
                    <div className="text-3xl font-bold text-amber-600">
                      {totalUsers.toLocaleString()} / {currentMilestone.target.toLocaleString()}
                    </div>
                  </div>
                </div>
                <div className="h-4 bg-white/60 rounded-full overflow-hidden mb-4">
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full transition-all"
                    style={{ width: `${Math.min(100, (totalUsers / currentMilestone.target) * 100)}%` }}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white/60 rounded-xl p-4">
                    <div className="text-xs text-zinc-500 mb-1">🥇 Premio #1 del ranking</div>
                    <div className="text-sm font-semibold text-zinc-800">{currentMilestone.prize1}</div>
                  </div>
                  <div className="bg-white/60 rounded-xl p-4">
                    <div className="text-xs text-zinc-500 mb-1">🎲 Premio sorteo</div>
                    <div className="text-sm font-semibold text-zinc-800">{currentMilestone.prize2}</div>
                  </div>
                </div>
              </div>

              {/* All milestones */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                {MILESTONES.map((m) => {
                  const reached = totalUsers >= m.target;
                  const pct = Math.min(100, (totalUsers / m.target) * 100);
                  return (
                    <div key={m.target} className={`rounded-xl border p-5 ${
                      reached ? "bg-green-50 border-green-200" : "bg-white border-zinc-200"
                    } shadow-sm`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-zinc-800">{reached ? "✅ " : ""}{m.label} usuarios</span>
                        <span className="text-sm text-zinc-500">{pct.toFixed(1)}%</span>
                      </div>
                      <div className="h-2 bg-zinc-100 rounded-full overflow-hidden mb-3">
                        <div className={`h-full rounded-full ${reached ? "bg-green-500" : "bg-amber-500"}`} style={{ width: `${pct}%` }} />
                      </div>
                      <div className="text-xs text-zinc-500">
                        🥇 {m.prize1} · 🎲 {m.prize2}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Current ranking for this milestone */}
              <div className="bg-white border border-zinc-200 rounded-xl shadow-sm">
                <div className="px-5 py-4 border-b border-zinc-200">
                  <h3 className="font-semibold text-zinc-700">Ranking actual (hito en curso)</h3>
                  <p className="text-xs text-zinc-400 mt-1">
                    Los puntos se resetean al completar cada hito. Ranking actual hacia {currentMilestone.label}.
                  </p>
                </div>
                <div className="divide-y divide-zinc-100">
                  {topUsers.length === 0 ? (
                    <p className="p-5 text-sm text-zinc-400">Sin usuarios aún</p>
                  ) : topUsers.map((u, i) => (
                    <div key={u.id} className="px-5 py-3 flex items-center gap-4">
                      <span className="w-8 text-center">
                        {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : <span className="text-sm text-zinc-400">{i + 1}</span>}
                      </span>
                      <span className="text-sm font-mono text-zinc-600 flex-1">{u.id.substring(0, 12)}...</span>
                      <span className="text-xs">{u.streak > 0 ? `🔥${u.streak}` : ""}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                        u.tier === "premium" ? "bg-amber-100 text-amber-700" :
                        u.tier === "plus" ? "bg-purple-100 text-purple-700" :
                        "bg-zinc-100 text-zinc-500"
                      }`}>
                        {u.tier.toUpperCase()}
                      </span>
                      <span className="text-lg font-bold text-amber-600 w-20 text-right">
                        {u.points.toLocaleString()}
                      </span>
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
