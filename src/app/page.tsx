"use client";

import { useEffect, useState } from "react";
import { AuthGuard } from "@/components/auth-guard";
import { Sidebar } from "@/components/sidebar";
import Link from "next/link";
import { collection, getCountFromServer, getDocs, query, where, orderBy, limit, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface DashStats {
  totalUsers: number;
  activeToday: number;
  activeWeek: number;
  newUsersToday: number;
  totalPoints: number;
  chaptersRead: number;
  songsListened: number;
  totalReferrals: number;
  premiumUsers: number;
  plusUsers: number;
  trialUsers: number;
  totalTracks: number;
  totalChapters: number;
  topCountries: { country: string; count: number }[];
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  async function loadStats() {
    try {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekStart = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000);

      // User counts.
      const usersSnap = await getCountFromServer(collection(db, "user_points"));
      const totalUsers = usersSnap.data().count;

      const activeTodaySnap = await getCountFromServer(
        query(collection(db, "user_points"), where("lastActiveDate", ">=", Timestamp.fromDate(todayStart)))
      );
      const activeWeekSnap = await getCountFromServer(
        query(collection(db, "user_points"), where("lastActiveDate", ">=", Timestamp.fromDate(weekStart)))
      );

      // Tiers.
      const premiumSnap = await getCountFromServer(
        query(collection(db, "user_points"), where("subscriptionTier", "==", "premium"))
      );
      const plusSnap = await getCountFromServer(
        query(collection(db, "user_points"), where("subscriptionTier", "==", "plus"))
      );
      const trialSnap = await getCountFromServer(
        query(collection(db, "user_points"), where("trialExpiresAt", ">=", Timestamp.fromDate(now)))
      );

      // Aggregates.
      const allUsers = await getDocs(collection(db, "user_points"));
      let totalPts = 0, totalCh = 0, totalSongs = 0, totalRefs = 0;
      const countryCounts: Record<string, number> = {};

      allUsers.forEach((d) => {
        const data = d.data();
        totalPts += data.totalPoints ?? 0;
        totalCh += data.chaptersCompleted ?? 0;
        totalSongs += data.songsListened ?? 0;
        totalRefs += data.validReferrals ?? 0;
        const country = data.country || data.locale || "";
        if (country) countryCounts[country] = (countryCounts[country] ?? 0) + 1;
      });

      const topCountries = Object.entries(countryCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([country, count]) => ({ country, count }));

      // Content counts.
      const tracksSnap = await getCountFromServer(collection(db, "tracks"));

      setStats({
        totalUsers,
        activeToday: activeTodaySnap.data().count,
        activeWeek: activeWeekSnap.data().count,
        newUsersToday: 0, // Would need createdAt field.
        totalPoints: totalPts,
        chaptersRead: totalCh,
        songsListened: totalSongs,
        totalReferrals: totalRefs,
        premiumUsers: premiumSnap.data().count,
        plusUsers: plusSnap.data().count,
        trialUsers: trialSnap.data().count,
        totalTracks: tracksSnap.data().count,
        totalChapters: 135,
        topCountries,
      });
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }

  const s = stats;

  return (
    <AuthGuard>
      <div className="flex h-screen">
        <Sidebar />
        <main className="flex-1 overflow-auto bg-slate-50 p-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-zinc-900">Dashboard</h2>
              <p className="text-sm text-zinc-500">TDQV — Tú de qué vas</p>
            </div>
            <div className="text-sm text-zinc-400">
              {new Date().toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })}
            </div>
          </div>

          {loading ? (
            <p className="text-zinc-500">Cargando...</p>
          ) : !s ? (
            <p className="text-zinc-500">Error cargando datos</p>
          ) : (
            <>
              {/* Hero KPIs */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <KPI icon="👥" label="Usuarios" value={s.totalUsers} />
                <KPI icon="🟢" label="Activos hoy" value={s.activeToday} accent />
                <KPI icon="📅" label="Activos 7d" value={s.activeWeek} />
                <KPI icon="🔗" label="Referidos" value={s.totalReferrals} />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <KPI icon="📖" label="Capítulos leídos" value={s.chaptersRead} />
                <KPI icon="🎵" label="Canciones" value={s.songsListened} />
                <KPI icon="⭐" label="Puntos totales" value={s.totalPoints.toLocaleString()} />
                <KPI icon="🎯" label="Hito actual" value={formatMilestone(s.totalUsers)} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                {/* Suscripciones */}
                <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-sm">
                  <h3 className="text-sm font-semibold text-zinc-700 mb-3">Suscripciones</h3>
                  <div className="space-y-2.5">
                    <TierRow label="⭐ Premium" count={s.premiumUsers} total={s.totalUsers} color="bg-amber-500" />
                    <TierRow label="✦ TDQV+" count={s.plusUsers} total={s.totalUsers} color="bg-purple-500" />
                    <TierRow label="○ Gratis" count={s.totalUsers - s.premiumUsers - s.plusUsers} total={s.totalUsers} color="bg-zinc-400" />
                    <TierRow label="🎁 Trial" count={s.trialUsers} total={s.totalUsers} color="bg-green-500" />
                  </div>
                </div>

                {/* Ubicaciones */}
                <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-sm">
                  <h3 className="text-sm font-semibold text-zinc-700 mb-3">Top ubicaciones</h3>
                  {s.topCountries.length === 0 ? (
                    <p className="text-sm text-zinc-400">Sin datos de ubicación aún</p>
                  ) : (
                    <div className="space-y-2.5">
                      {s.topCountries.map((c) => (
                        <div key={c.country} className="flex items-center justify-between">
                          <span className="text-sm text-zinc-600">{c.country}</span>
                          <span className="text-sm font-medium text-zinc-800">{c.count}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Milestone progress */}
                <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-sm">
                  <h3 className="text-sm font-semibold text-zinc-700 mb-3">Próximo hito</h3>
                  <MilestoneProgress current={s.totalUsers} />
                </div>
              </div>

              {/* Quick links */}
              <h3 className="text-sm font-semibold text-zinc-700 mb-3">Acceso rápido</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <QuickLink href="/analytics" icon="📈" title="Analytics completo" />
                <QuickLink href="/analytics/users" icon="👥" title="Usuarios" />
                <QuickLink href="/analytics/milestones" icon="🎁" title="Hitos y premios" />
                <QuickLink href="/analytics/referrals" icon="🔗" title="Referidos" />
                <QuickLink href="/books/book1" icon="📚" title="Libro I" />
                <QuickLink href="/books/book2" icon="📚" title="Libro II" />
                <QuickLink href="/music" icon="🎵" title="Música" />
                <QuickLink href="/music/sync" icon="⏱️" title="Sincro LRC" />
              </div>
            </>
          )}
        </main>
      </div>
    </AuthGuard>
  );
}

function KPI({ icon, label, value, accent }: { icon: string; label: string; value: string | number; accent?: boolean }) {
  return (
    <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-1.5">
        <span>{icon}</span>
        <span className="text-xs text-zinc-500">{label}</span>
      </div>
      <div className={`text-2xl font-bold ${accent ? "text-green-600" : "text-zinc-900"}`}>{value}</div>
    </div>
  );
}

function TierRow({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-zinc-600 w-24">{label}</span>
      <div className="flex-1 h-2 bg-zinc-100 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-medium text-zinc-700 w-8 text-right">{count}</span>
    </div>
  );
}

function MilestoneProgress({ current }: { current: number }) {
  const milestones = [1000, 5000, 10000, 25000, 50000, 100000];
  const next = milestones.find((m) => current < m) ?? milestones[milestones.length - 1];
  const pct = Math.min(100, (current / next) * 100);
  const labels: Record<number, string> = {
    1000: "1K", 5000: "5K", 10000: "10K", 25000: "25K", 50000: "50K", 100000: "100K",
  };
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-2xl font-bold text-amber-600">{labels[next]}</span>
        <span className="text-sm text-zinc-500">{current} / {next.toLocaleString()}</span>
      </div>
      <div className="h-3 bg-zinc-100 rounded-full overflow-hidden mb-2">
        <div className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full" style={{ width: `${pct}%` }} />
      </div>
      <div className="text-xs text-zinc-400">{pct.toFixed(1)}% completado</div>
    </div>
  );
}

function QuickLink({ href, icon, title }: { href: string; icon: string; title: string }) {
  return (
    <Link href={href} className="bg-white border border-zinc-200 rounded-lg px-4 py-3 hover:border-amber-500/40 hover:shadow-sm transition-all flex items-center gap-2">
      <span>{icon}</span>
      <span className="text-sm font-medium text-zinc-700">{title}</span>
    </Link>
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
