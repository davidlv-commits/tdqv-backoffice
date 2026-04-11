"use client";

import { useEffect, useState, useMemo } from "react";
import { AuthGuard } from "@/components/auth-guard";
import { Sidebar } from "@/components/sidebar";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Line, Bar, Doughnut } from "react-chartjs-2";

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, ArcElement, Title, Tooltip, Legend, Filler
);

interface UserData {
  id: string;
  lastActiveDate: Date | null;
  country: string;
  locale: string;
  timezone: string;
  subscriptionTier: string;
  chaptersCompleted: number;
  songsListened: number;
  totalPoints: number;
  streak: number;
  validReferrals: number;
  trialExpiresAt: Date | null;
}

type Period = "7d" | "30d" | "90d" | "all";

export default function ReportsPage() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>("30d");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const snap = await getDocs(collection(db, "user_points"));
      setUsers(snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          lastActiveDate: data.lastActiveDate?.toDate() ?? null,
          country: data.country ?? "",
          locale: data.locale ?? "",
          timezone: data.timezone ?? "",
          subscriptionTier: data.subscriptionTier ?? "free",
          chaptersCompleted: data.chaptersCompleted ?? 0,
          songsListened: data.songsListened ?? 0,
          totalPoints: data.totalPoints ?? 0,
          streak: data.streak ?? 0,
          validReferrals: data.validReferrals ?? 0,
          trialExpiresAt: data.trialExpiresAt?.toDate() ?? null,
        };
      }));
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }

  // Period filter.
  const periodDays = period === "7d" ? 7 : period === "30d" ? 30 : period === "90d" ? 90 : 365;
  const cutoff = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);

  // ─── Chart data ───

  // 1. Activity by day (users active per day).
  const activityByDay = useMemo(() => {
    const days = new Map<string, number>();
    const nDays = Math.min(periodDays, 90);
    for (let i = nDays - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      days.set(d.toISOString().split("T")[0], 0);
    }
    users.forEach((u) => {
      if (!u.lastActiveDate) return;
      const key = u.lastActiveDate.toISOString().split("T")[0];
      if (days.has(key)) days.set(key, (days.get(key) ?? 0) + 1);
    });
    return { labels: [...days.keys()].map(formatLabel), values: [...days.values()] };
  }, [users, periodDays]);

  // 2. Activity by hour of day.
  const activityByHour = useMemo(() => {
    const hours = Array(24).fill(0);
    users.forEach((u) => {
      if (!u.lastActiveDate) return;
      if (u.lastActiveDate < cutoff) return;
      hours[u.lastActiveDate.getHours()]++;
    });
    return {
      labels: hours.map((_, i) => `${i.toString().padStart(2, "0")}:00`),
      values: hours,
    };
  }, [users, cutoff]);

  // 3. By country.
  const byCountry = useMemo(() => {
    const counts = new Map<string, number>();
    users.forEach((u) => {
      const loc = u.country || u.locale || "Desconocido";
      counts.set(loc, (counts.get(loc) ?? 0) + 1);
    });
    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
    return { labels: sorted.map((s) => s[0]), values: sorted.map((s) => s[1]) };
  }, [users]);

  // 4. By timezone (region).
  const byTimezone = useMemo(() => {
    const counts = new Map<string, number>();
    users.forEach((u) => {
      if (!u.timezone) return;
      const region = u.timezone.split("/")[0] || u.timezone;
      counts.set(region, (counts.get(region) ?? 0) + 1);
    });
    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
    return { labels: sorted.map((s) => s[0]), values: sorted.map((s) => s[1]) };
  }, [users]);

  // 5. Subscription tiers.
  const tierData = useMemo(() => {
    const tiers = { premium: 0, plus: 0, free: 0, trial: 0 };
    const now = new Date();
    users.forEach((u) => {
      if (u.trialExpiresAt && u.trialExpiresAt > now) tiers.trial++;
      else if (u.subscriptionTier === "premium") tiers.premium++;
      else if (u.subscriptionTier === "plus") tiers.plus++;
      else tiers.free++;
    });
    return tiers;
  }, [users]);

  // 6. Engagement distribution (chapters completed).
  const engagementDist = useMemo(() => {
    const buckets: Record<string, number> = {
      "0": 0, "1-5": 0, "6-10": 0, "11-20": 0, "21-50": 0, "50+": 0,
    };
    users.forEach((u) => {
      const ch = u.chaptersCompleted;
      if (ch === 0) buckets["0"]++;
      else if (ch <= 5) buckets["1-5"]++;
      else if (ch <= 10) buckets["6-10"]++;
      else if (ch <= 20) buckets["11-20"]++;
      else if (ch <= 50) buckets["21-50"]++;
      else buckets["50+"]++;
    });
    return { labels: Object.keys(buckets), values: Object.values(buckets) };
  }, [users]);

  // 7. Streak distribution.
  const streakDist = useMemo(() => {
    const buckets: Record<string, number> = {
      "0": 0, "1-3": 0, "4-7": 0, "8-14": 0, "15-30": 0, "30+": 0,
    };
    users.forEach((u) => {
      const s = u.streak;
      if (s === 0) buckets["0"]++;
      else if (s <= 3) buckets["1-3"]++;
      else if (s <= 7) buckets["4-7"]++;
      else if (s <= 14) buckets["8-14"]++;
      else if (s <= 30) buckets["15-30"]++;
      else buckets["30+"]++;
    });
    return { labels: Object.keys(buckets), values: Object.values(buckets) };
  }, [users]);

  const chartOpts = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { display: false }, ticks: { font: { size: 10 }, color: "#9ca3af" } },
      y: { grid: { color: "#f3f4f6" }, ticks: { font: { size: 10 }, color: "#9ca3af" } },
    },
  };

  return (
    <AuthGuard>
      <div className="flex h-screen">
        <Sidebar />
        <main className="flex-1 overflow-auto bg-slate-50 p-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-zinc-900">Informes</h2>
              <p className="text-sm text-zinc-500">{users.length} usuarios · Datos en tiempo real</p>
            </div>
            <div className="flex gap-2">
              {(["7d", "30d", "90d", "all"] as Period[]).map((p) => (
                <button key={p} onClick={() => setPeriod(p)}
                  className={`text-xs px-3 py-1.5 rounded-full border ${
                    period === p
                      ? "bg-amber-100 border-amber-300 text-amber-700 font-bold"
                      : "border-zinc-200 text-zinc-500 hover:bg-zinc-50"
                  }`}>
                  {p === "all" ? "Todo" : p}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <p className="text-zinc-500">Cargando informes...</p>
          ) : (
            <div className="space-y-6">
              {/* Row 1: Activity over time + hourly */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <ChartCard title="📈 Actividad diaria" subtitle="Usuarios activos por día">
                  <div className="h-64">
                    <Line data={{
                      labels: activityByDay.labels,
                      datasets: [{
                        data: activityByDay.values,
                        borderColor: "#d97706",
                        backgroundColor: "rgba(217, 119, 6, 0.1)",
                        fill: true,
                        tension: 0.4,
                        pointRadius: 2,
                        pointHoverRadius: 5,
                      }],
                    }} options={chartOpts} />
                  </div>
                </ChartCard>

                <ChartCard title="🕐 Horario de conexión" subtitle="¿Cuándo se conectan más?">
                  <div className="h-64">
                    <Bar data={{
                      labels: activityByHour.labels,
                      datasets: [{
                        data: activityByHour.values,
                        backgroundColor: "rgba(124, 58, 237, 0.6)",
                        borderRadius: 4,
                      }],
                    }} options={chartOpts} />
                  </div>
                </ChartCard>
              </div>

              {/* Row 2: Geography */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <ChartCard title="🌍 Usuarios por país/localidad" subtitle="Top 10 ubicaciones">
                  <div className="h-72">
                    <Bar data={{
                      labels: byCountry.labels,
                      datasets: [{
                        data: byCountry.values,
                        backgroundColor: [
                          "#d97706", "#7c3aed", "#059669", "#dc2626",
                          "#2563eb", "#d946ef", "#ea580c", "#0891b2",
                          "#4f46e5", "#be123c",
                        ],
                        borderRadius: 6,
                      }],
                    }} options={{
                      ...chartOpts,
                      indexAxis: "y" as const,
                    }} />
                  </div>
                </ChartCard>

                <ChartCard title="🌐 Distribución por región" subtitle="Zonas horarias">
                  <div className="h-72 flex items-center justify-center">
                    {byTimezone.labels.length > 0 ? (
                      <Doughnut data={{
                        labels: byTimezone.labels,
                        datasets: [{
                          data: byTimezone.values,
                          backgroundColor: [
                            "#d97706", "#7c3aed", "#059669", "#dc2626",
                            "#2563eb", "#d946ef", "#ea580c", "#0891b2",
                          ],
                          borderWidth: 0,
                        }],
                      }} options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                          legend: { position: "right" as const, labels: { font: { size: 11 }, color: "#6b7280" } },
                        },
                      }} />
                    ) : (
                      <p className="text-sm text-zinc-400">Sin datos de ubicación</p>
                    )}
                  </div>
                </ChartCard>
              </div>

              {/* Row 3: Subscriptions + Engagement */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <ChartCard title="💎 Suscripciones" subtitle="Distribución de tiers">
                  <div className="h-56 flex items-center justify-center">
                    <Doughnut data={{
                      labels: ["Premium", "TDQV+", "Trial", "Gratis"],
                      datasets: [{
                        data: [tierData.premium, tierData.plus, tierData.trial, tierData.free],
                        backgroundColor: ["#d97706", "#7c3aed", "#059669", "#9ca3af"],
                        borderWidth: 0,
                      }],
                    }} options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: { position: "bottom" as const, labels: { font: { size: 11 }, color: "#6b7280" } },
                      },
                    }} />
                  </div>
                </ChartCard>

                <ChartCard title="📖 Engagement: capítulos leídos" subtitle="Distribución de lectores">
                  <div className="h-56">
                    <Bar data={{
                      labels: engagementDist.labels,
                      datasets: [{
                        data: engagementDist.values,
                        backgroundColor: "rgba(217, 119, 6, 0.7)",
                        borderRadius: 4,
                      }],
                    }} options={chartOpts} />
                  </div>
                </ChartCard>

                <ChartCard title="🔥 Distribución de rachas" subtitle="Días consecutivos">
                  <div className="h-56">
                    <Bar data={{
                      labels: streakDist.labels,
                      datasets: [{
                        data: streakDist.values,
                        backgroundColor: "rgba(239, 68, 68, 0.6)",
                        borderRadius: 4,
                      }],
                    }} options={chartOpts} />
                  </div>
                </ChartCard>
              </div>

              {/* Key insights */}
              <div className="bg-white border border-zinc-200 rounded-xl p-6 shadow-sm">
                <h3 className="font-semibold text-zinc-700 mb-4">💡 Insights automáticos</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Insight
                    icon="🌍"
                    text={byCountry.labels.length > 0
                      ? `La mayor concentración de usuarios está en ${byCountry.labels[0]} (${byCountry.values[0]} usuarios)`
                      : "Sin datos de ubicación aún"}
                  />
                  <Insight
                    icon="🕐"
                    text={`La hora punta de conexión es a las ${activityByHour.labels[activityByHour.values.indexOf(Math.max(...activityByHour.values))]}`}
                  />
                  <Insight
                    icon="📖"
                    text={`${users.filter((u) => u.chaptersCompleted === 0).length} usuarios aún no empezaron a leer (${Math.round(users.filter((u) => u.chaptersCompleted === 0).length / Math.max(1, users.length) * 100)}%)`}
                  />
                  <Insight
                    icon="🔥"
                    text={`${users.filter((u) => u.streak >= 7).length} usuarios tienen racha de 7+ días`}
                  />
                  <Insight
                    icon="💎"
                    text={`Tasa de conversión a pago: ${Math.round((tierData.premium + tierData.plus) / Math.max(1, users.length) * 100)}%`}
                  />
                  <Insight
                    icon="👥"
                    text={`${users.filter((u) => u.validReferrals > 0).length} usuarios han traído al menos un referido`}
                  />
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </AuthGuard>
  );
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-sm">
      <h3 className="font-semibold text-zinc-700 text-sm">{title}</h3>
      <p className="text-xs text-zinc-400 mb-4">{subtitle}</p>
      {children}
    </div>
  );
}

function Insight({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="flex items-start gap-2 bg-zinc-50 rounded-lg p-3">
      <span className="text-sm mt-0.5">{icon}</span>
      <span className="text-sm text-zinc-600">{text}</span>
    </div>
  );
}

function formatLabel(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getDate()}/${d.getMonth() + 1}`;
}
