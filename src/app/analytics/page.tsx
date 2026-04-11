"use client";

import { useEffect, useState } from "react";
import { AuthGuard } from "@/components/auth-guard";
import { Sidebar } from "@/components/sidebar";
import { collection, getCountFromServer, getDocs, query, where, orderBy, limit, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface Stats {
  totalUsers: number;
  activeToday: number;
  activeWeek: number;
  totalPoints: number;
  chaptersRead: number;
  songsListened: number;
  totalReferrals: number;
  premiumUsers: number;
  plusUsers: number;
  freeUsers: number;
  trialUsers: number;
}

interface TopUser {
  id: string;
  points: number;
  streak: number;
  tier: string;
  chapters: number;
}

export default function AnalyticsDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [topUsers, setTopUsers] = useState<TopUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  async function loadStats() {
    try {
      // Total users.
      const usersSnap = await getCountFromServer(collection(db, "user_points"));
      const totalUsers = usersSnap.data().count;

      // Active today/week.
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekStart = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000);

      const activeTodaySnap = await getCountFromServer(
        query(collection(db, "user_points"),
          where("lastActiveDate", ">=", Timestamp.fromDate(todayStart)))
      );
      const activeWeekSnap = await getCountFromServer(
        query(collection(db, "user_points"),
          where("lastActiveDate", ">=", Timestamp.fromDate(weekStart)))
      );

      // Tier counts.
      const premiumSnap = await getCountFromServer(
        query(collection(db, "user_points"), where("subscriptionTier", "==", "premium"))
      );
      const plusSnap = await getCountFromServer(
        query(collection(db, "user_points"), where("subscriptionTier", "==", "plus"))
      );

      // Trial users.
      const trialSnap = await getCountFromServer(
        query(collection(db, "user_points"),
          where("trialExpiresAt", ">=", Timestamp.fromDate(now)))
      );

      // Top users by points.
      const topSnap = await getDocs(
        query(collection(db, "user_points"),
          orderBy("currentMilestonePoints", "desc"),
          limit(10))
      );
      const tops = topSnap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          points: data.currentMilestonePoints ?? 0,
          streak: data.streak ?? 0,
          tier: data.subscriptionTier ?? "free",
          chapters: data.chaptersCompleted ?? 0,
        };
      });

      // Aggregate totals from top users (approximate).
      let totalPts = 0, totalCh = 0, totalSongs = 0, totalRefs = 0;
      const allUsers = await getDocs(collection(db, "user_points"));
      allUsers.forEach((d) => {
        const data = d.data();
        totalPts += data.totalPoints ?? 0;
        totalCh += data.chaptersCompleted ?? 0;
        totalSongs += data.songsListened ?? 0;
        totalRefs += data.validReferrals ?? 0;
      });

      setStats({
        totalUsers,
        activeToday: activeTodaySnap.data().count,
        activeWeek: activeWeekSnap.data().count,
        totalPoints: totalPts,
        chaptersRead: totalCh,
        songsListened: totalSongs,
        totalReferrals: totalRefs,
        premiumUsers: premiumSnap.data().count,
        plusUsers: plusSnap.data().count,
        freeUsers: totalUsers - premiumSnap.data().count - plusSnap.data().count,
        trialUsers: trialSnap.data().count,
      });
      setTopUsers(tops);
    } catch (e) {
      console.error("Error loading stats:", e);
    }
    setLoading(false);
  }

  return (
    <AuthGuard>
      <div className="flex h-screen">
        <Sidebar />
        <main className="flex-1 overflow-auto bg-slate-50 p-8">
          <h2 className="text-2xl font-bold text-zinc-900 mb-2">Analytics</h2>
          <p className="text-sm text-zinc-500 mb-6">Resumen general de la plataforma</p>

          {loading ? (
            <p className="text-zinc-500">Cargando estadísticas...</p>
          ) : !stats ? (
            <p className="text-zinc-500">No hay datos aún. Los usuarios empezarán a generar datos al usar la app.</p>
          ) : (
            <>
              {/* KPI Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <KPICard icon="👥" label="Usuarios totales" value={stats.totalUsers} />
                <KPICard icon="🟢" label="Activos hoy" value={stats.activeToday} />
                <KPICard icon="📅" label="Activos esta semana" value={stats.activeWeek} />
                <KPICard icon="🔗" label="Referidos totales" value={stats.totalReferrals} />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <KPICard icon="📖" label="Capítulos leídos" value={stats.chaptersRead} />
                <KPICard icon="🎵" label="Canciones escuchadas" value={stats.songsListened} />
                <KPICard icon="⭐" label="Puntos totales" value={stats.totalPoints.toLocaleString()} />
                <KPICard icon="🔥" label="Hito actual" value={formatMilestone(stats.totalUsers)} />
              </div>

              {/* Subscription breakdown */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div className="bg-white border border-zinc-200 rounded-xl p-6 shadow-sm">
                  <h3 className="font-semibold text-zinc-700 mb-4">Suscripciones</h3>
                  <div className="space-y-3">
                    <TierBar label="Premium" count={stats.premiumUsers} total={stats.totalUsers} color="bg-amber-500" />
                    <TierBar label="TDQV+" count={stats.plusUsers} total={stats.totalUsers} color="bg-purple-500" />
                    <TierBar label="Gratis" count={stats.freeUsers} total={stats.totalUsers} color="bg-zinc-400" />
                    <TierBar label="Trial activo" count={stats.trialUsers} total={stats.totalUsers} color="bg-green-500" />
                  </div>
                </div>

                {/* Top 10 Ranking */}
                <div className="bg-white border border-zinc-200 rounded-xl p-6 shadow-sm">
                  <h3 className="font-semibold text-zinc-700 mb-4">Top 10 Ranking</h3>
                  {topUsers.length === 0 ? (
                    <p className="text-sm text-zinc-400">Sin datos aún</p>
                  ) : (
                    <div className="space-y-2">
                      {topUsers.map((u, i) => (
                        <div key={u.id} className="flex items-center gap-3 py-1.5">
                          <span className="text-sm font-mono text-zinc-400 w-6">
                            {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}`}
                          </span>
                          <span className="text-sm text-zinc-700 flex-1 font-mono truncate">
                            {u.id.substring(0, 8)}...
                          </span>
                          <span className="text-xs text-zinc-400">
                            🔥{u.streak}
                          </span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                            u.tier === "premium" ? "bg-amber-100 text-amber-700" :
                            u.tier === "plus" ? "bg-purple-100 text-purple-700" :
                            "bg-zinc-100 text-zinc-500"
                          }`}>
                            {u.tier.toUpperCase()}
                          </span>
                          <span className="text-sm font-bold text-zinc-800 w-16 text-right">
                            {u.points.toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Milestones progress */}
              <div className="bg-white border border-zinc-200 rounded-xl p-6 shadow-sm">
                <h3 className="font-semibold text-zinc-700 mb-4">Progreso de Hitos</h3>
                <div className="space-y-4">
                  <MilestoneBar target={1000} current={stats.totalUsers} label="1K usuarios" prize="3 meses Premium" />
                  <MilestoneBar target={5000} current={stats.totalUsers} label="5K usuarios" prize="6 meses Premium" />
                  <MilestoneBar target={10000} current={stats.totalUsers} label="10K usuarios" prize="1 año Premium + merch" />
                  <MilestoneBar target={25000} current={stats.totalUsers} label="25K usuarios" prize="Cena presencial con el autor" />
                  <MilestoneBar target={50000} current={stats.totalUsers} label="50K usuarios" prize="iPhone + comida presencial" />
                  <MilestoneBar target={100000} current={stats.totalUsers} label="100K usuarios" prize="Viaje 15 días por los escenarios" />
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </AuthGuard>
  );
}

function KPICard({ icon, label, value }: { icon: string; label: string; value: string | number }) {
  return (
    <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">{icon}</span>
        <span className="text-xs text-zinc-500 font-medium">{label}</span>
      </div>
      <div className="text-2xl font-bold text-zinc-900">{value}</div>
    </div>
  );
}

function TierBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm text-zinc-600">{label}</span>
        <span className="text-sm font-medium text-zinc-800">{count} ({pct.toFixed(1)}%)</span>
      </div>
      <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function MilestoneBar({ target, current, label, prize }: { target: number; current: number; label: string; prize: string }) {
  const pct = Math.min(100, (current / target) * 100);
  const reached = current >= target;
  return (
    <div className={`p-4 rounded-lg border ${reached ? "border-green-200 bg-green-50" : "border-zinc-200"}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium text-zinc-700">
          {reached ? "✅ " : ""}{label}
        </span>
        <span className="text-xs text-zinc-500">{current.toLocaleString()} / {target.toLocaleString()}</span>
      </div>
      <div className="h-2.5 bg-zinc-100 rounded-full overflow-hidden mb-2">
        <div
          className={`h-full rounded-full transition-all ${reached ? "bg-green-500" : "bg-amber-500"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="text-xs text-zinc-400">🎁 {prize}</div>
    </div>
  );
}

function formatMilestone(users: number): string {
  if (users >= 100000) return "100K ✅";
  if (users >= 50000) return "→ 100K";
  if (users >= 25000) return "→ 50K";
  if (users >= 10000) return "→ 25K";
  if (users >= 5000) return "→ 10K";
  if (users >= 1000) return "→ 5K";
  return "→ 1K";
}
