"use client";

import { useEffect, useState } from "react";
import { AuthGuard } from "@/components/auth-guard";
import { Sidebar } from "@/components/sidebar";
import { collection, getDocs, query, orderBy, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface PointsEvent {
  userId: string;
  action: string;
  basePoints: number;
  multipliedPoints: number;
  multiplier: number;
  detail: string;
  timestamp: Date;
}

export default function PointsPage() {
  const [events, setEvents] = useState<PointsEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<Record<string, { count: number; total: number }>>({});

  useEffect(() => {
    loadEvents();
  }, []);

  async function loadEvents() {
    try {
      // Get all user_points docs.
      const usersSnap = await getDocs(collection(db, "user_points"));
      const allEvents: PointsEvent[] = [];
      const actionSummary: Record<string, { count: number; total: number }> = {};

      for (const userDoc of usersSnap.docs) {
        // Get history for each user (limited).
        const histSnap = await getDocs(
          query(
            collection(db, "user_points", userDoc.id, "history"),
            orderBy("timestamp", "desc"),
            limit(50)
          )
        );
        for (const h of histSnap.docs) {
          const data = h.data();
          const action = data.action ?? "unknown";
          allEvents.push({
            userId: userDoc.id,
            action,
            basePoints: data.basePoints ?? 0,
            multipliedPoints: data.multipliedPoints ?? 0,
            multiplier: data.multiplier ?? 1,
            detail: data.detail ?? "",
            timestamp: data.timestamp?.toDate() ?? new Date(),
          });

          if (!actionSummary[action]) actionSummary[action] = { count: 0, total: 0 };
          actionSummary[action].count++;
          actionSummary[action].total += data.multipliedPoints ?? 0;
        }
      }

      allEvents.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      setEvents(allEvents.slice(0, 200));
      setSummary(actionSummary);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }

  const actionLabels: Record<string, string> = {
    paragraph_read: "📖 Párrafo leído",
    chapter_completed: "📕 Capítulo completado",
    song_completed: "🎵 Canción escuchada",
    valid_referral: "👥 Referido válido",
    daily_login: "🟢 Login diario",
  };

  return (
    <AuthGuard>
      <div className="flex h-screen">
        <Sidebar />
        <main className="flex-1 overflow-auto bg-slate-50 p-8">
          <h2 className="text-2xl font-bold text-zinc-900 mb-2">Puntos y Ranking</h2>
          <p className="text-sm text-zinc-500 mb-6">Desglose de puntos otorgados</p>

          {loading ? (
            <p className="text-zinc-500">Cargando...</p>
          ) : (
            <>
              {/* Summary cards */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
                {Object.entries(summary).map(([action, { count, total }]) => (
                  <div key={action} className="bg-white border border-zinc-200 rounded-xl p-4 shadow-sm">
                    <div className="text-xs text-zinc-500 mb-1">{actionLabels[action] || action}</div>
                    <div className="text-xl font-bold text-zinc-800">{count.toLocaleString()}</div>
                    <div className="text-xs text-amber-600 font-medium">{total.toLocaleString()} pts</div>
                  </div>
                ))}
              </div>

              {/* Event log */}
              <div className="bg-white border border-zinc-200 rounded-xl shadow-sm">
                <div className="px-5 py-4 border-b border-zinc-200">
                  <h3 className="font-semibold text-zinc-700">Últimos eventos ({events.length})</h3>
                </div>
                <div className="divide-y divide-zinc-100 max-h-[500px] overflow-y-auto">
                  {events.length === 0 ? (
                    <p className="p-5 text-sm text-zinc-400">Sin eventos aún</p>
                  ) : events.map((e, i) => (
                    <div key={i} className="px-5 py-3 flex items-center gap-4 text-sm">
                      <span className="text-xs text-zinc-400 w-32">{e.timestamp.toLocaleString()}</span>
                      <span className="text-xs font-mono text-zinc-500 w-24 truncate">{e.userId.substring(0, 8)}</span>
                      <span className="flex-1 text-zinc-700">{actionLabels[e.action] || e.action}</span>
                      <span className="text-xs text-zinc-400">{e.detail}</span>
                      <span className="text-xs text-zinc-400">x{e.multiplier.toFixed(1)}</span>
                      <span className="font-bold text-amber-600 w-16 text-right">+{e.multipliedPoints}</span>
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
