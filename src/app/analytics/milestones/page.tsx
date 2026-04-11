"use client";

import { useEffect, useState } from "react";
import { AuthGuard } from "@/components/auth-guard";
import { Sidebar } from "@/components/sidebar";
import { collection, getCountFromServer, getDocs, query, orderBy, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  getMilestones, initMilestones, markMilestoneReached,
  executeLottery, finalizeMilestone, getLotteryParticipants,
  type Milestone, type LotteryParticipant,
} from "@/lib/lottery";

export default function MilestonesPage() {
  const [totalUsers, setTotalUsers] = useState(0);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [previewParticipants, setPreviewParticipants] = useState<LotteryParticipant[] | null>(null);
  const [previewMilestoneId, setPreviewMilestoneId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      await initMilestones();
      const countSnap = await getCountFromServer(collection(db, "user_points"));
      setTotalUsers(countSnap.data().count);
      setMilestones(await getMilestones());
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }

  async function handleMarkReached(ms: Milestone) {
    if (!confirm(`¿Marcar el hito ${ms.label} como alcanzado? Esto congela el ranking.`)) return;
    setActionLoading(ms.id);
    await markMilestoneReached(ms.id);
    setMilestones(await getMilestones());
    setActionLoading(null);
  }

  async function handlePreviewLottery(ms: Milestone) {
    setActionLoading(ms.id);
    const participants = await getLotteryParticipants(ms.minPoints);
    setPreviewParticipants(participants);
    setPreviewMilestoneId(ms.id);
    setActionLoading(null);
  }

  async function handleExecuteLottery(ms: Milestone) {
    if (!confirm(`¿Ejecutar el sorteo del hito ${ms.label}? Esta acción NO se puede deshacer.`)) return;
    setActionLoading(ms.id);
    const result = await executeLottery(ms.id);
    if (result) {
      alert(
        `🎉 Sorteo completado!\n\n` +
        `🥇 #1 Ranking: ${result.winner1.userId.substring(0, 12)}... (${result.winner1.points} pts)\n` +
        `🎲 Sorteo: ${result.winner2.userId.substring(0, 12)}... (${result.winner2.points} pts, ${result.winner2.tickets} papeletas de ${result.totalTickets})\n\n` +
        `Seed: ${result.seed}\n` +
        `Participantes: ${result.totalParticipants}`
      );
    }
    setPreviewParticipants(null);
    setPreviewMilestoneId(null);
    setMilestones(await getMilestones());
    setActionLoading(null);
  }

  async function handleFinalize(ms: Milestone) {
    if (!confirm(
      `¿Finalizar el hito ${ms.label}?\n\n` +
      `Esto hará:\n` +
      `1. Marcar el hito como completado\n` +
      `2. RESETEAR los puntos de TODOS los usuarios a 0\n` +
      `3. Iniciar el siguiente hito\n\n` +
      `¿Estás seguro?`
    )) return;
    setActionLoading(ms.id);
    await finalizeMilestone(ms.id);
    setMilestones(await getMilestones());
    setActionLoading(null);
  }

  const currentMilestone = milestones.find((m) => m.status === "pending" || m.status === "reached");

  return (
    <AuthGuard>
      <div className="flex h-screen">
        <Sidebar />
        <main className="flex-1 overflow-auto bg-slate-50 p-8">
          <h2 className="text-2xl font-bold text-zinc-900 mb-2">Hitos y Premios</h2>
          <p className="text-sm text-zinc-500 mb-6">
            {totalUsers.toLocaleString()} usuarios · Gestión de hitos y sorteos
          </p>

          {loading ? (
            <p className="text-zinc-500">Cargando...</p>
          ) : (
            <>
              {/* Current milestone hero */}
              {currentMilestone && (
                <div className="bg-gradient-to-r from-amber-50 to-purple-50 border border-amber-200 rounded-2xl p-8 mb-8">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <div className="text-sm text-amber-600 font-medium mb-1">
                        {currentMilestone.status === "reached" ? "🎯 ¡HITO ALCANZADO!" : "Próximo hito"}
                      </div>
                      <div className="text-4xl font-bold text-zinc-900">{currentMilestone.label} usuarios</div>
                    </div>
                    <div className="text-right">
                      <div className="text-3xl font-bold text-amber-600">
                        {totalUsers.toLocaleString()} / {currentMilestone.target.toLocaleString()}
                      </div>
                      <div className="text-sm text-zinc-500">
                        {Math.round((totalUsers / currentMilestone.target) * 100)}% completado
                      </div>
                    </div>
                  </div>
                  <div className="h-4 bg-white/60 rounded-full overflow-hidden mb-6">
                    <div
                      className={`h-full rounded-full transition-all ${
                        currentMilestone.status === "reached"
                          ? "bg-gradient-to-r from-green-500 to-green-400"
                          : "bg-gradient-to-r from-amber-500 to-amber-400"
                      }`}
                      style={{ width: `${Math.min(100, (totalUsers / currentMilestone.target) * 100)}%` }}
                    />
                  </div>

                  {/* Action buttons */}
                  <div className="flex flex-wrap gap-3">
                    {currentMilestone.status === "pending" && totalUsers >= currentMilestone.target && (
                      <button
                        onClick={() => handleMarkReached(currentMilestone)}
                        disabled={actionLoading === currentMilestone.id}
                        className="bg-green-600 hover:bg-green-700 text-white px-6 py-2.5 rounded-xl font-medium text-sm"
                      >
                        {actionLoading === currentMilestone.id ? "Procesando..." : "🎯 Marcar hito alcanzado"}
                      </button>
                    )}
                    {currentMilestone.status === "reached" && (
                      <>
                        <button
                          onClick={() => handlePreviewLottery(currentMilestone)}
                          disabled={actionLoading === currentMilestone.id}
                          className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2.5 rounded-xl font-medium text-sm"
                        >
                          {actionLoading === currentMilestone.id ? "Cargando..." : "👀 Ver participantes"}
                        </button>
                        <button
                          onClick={() => handleExecuteLottery(currentMilestone)}
                          disabled={actionLoading === currentMilestone.id}
                          className="bg-amber-600 hover:bg-amber-700 text-white px-6 py-2.5 rounded-xl font-medium text-sm"
                        >
                          🎲 Ejecutar sorteo
                        </button>
                      </>
                    )}
                  </div>

                  {/* Prizes */}
                  <div className="grid grid-cols-2 gap-4 mt-6">
                    <div className="bg-white/60 rounded-xl p-4">
                      <div className="text-xs text-zinc-500 mb-1">🥇 #1 del ranking</div>
                      <div className="text-sm font-semibold text-zinc-800">{currentMilestone.prize1}</div>
                    </div>
                    <div className="bg-white/60 rounded-xl p-4">
                      <div className="text-xs text-zinc-500 mb-1">🎲 Ganador del sorteo</div>
                      <div className="text-sm font-semibold text-zinc-800">{currentMilestone.prize2}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Preview participants modal */}
              {previewParticipants && (
                <div className="bg-white border border-purple-200 rounded-xl shadow-sm mb-8">
                  <div className="px-5 py-4 border-b border-zinc-200 flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-zinc-700">Participantes del sorteo</h3>
                      <p className="text-xs text-zinc-400">
                        {previewParticipants.length} participantes ·
                        {" "}{previewParticipants.reduce((s, p) => s + p.tickets, 0).toLocaleString()} papeletas totales
                      </p>
                    </div>
                    <button onClick={() => setPreviewParticipants(null)} className="text-zinc-400 hover:text-zinc-600">✕</button>
                  </div>
                  <div className="divide-y divide-zinc-100 max-h-[400px] overflow-y-auto">
                    {previewParticipants.map((p, i) => {
                      const totalTickets = previewParticipants.reduce((s, pp) => s + pp.tickets, 0);
                      const chance = ((p.tickets / totalTickets) * 100).toFixed(2);
                      return (
                        <div key={p.userId} className="px-5 py-3 flex items-center gap-4">
                          <span className="w-8 text-center">
                            {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : <span className="text-sm text-zinc-400">{i + 1}</span>}
                          </span>
                          <span className="text-sm font-mono text-zinc-600 flex-1">{p.userId.substring(0, 14)}...</span>
                          <span className="text-sm text-zinc-500">{p.points.toLocaleString()} pts</span>
                          <span className="text-sm text-amber-600 font-medium w-20 text-right">
                            {p.tickets.toLocaleString()} 🎫
                          </span>
                          <span className="text-xs text-zinc-400 w-16 text-right">{chance}%</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* All milestones */}
              <h3 className="text-lg font-semibold text-zinc-800 mb-4">Todos los hitos</h3>
              <div className="space-y-4">
                {milestones.map((ms) => (
                  <div key={ms.id} className={`rounded-xl border p-5 shadow-sm ${
                    ms.status === "awarded" ? "bg-green-50 border-green-200" :
                    ms.status === "drawn" ? "bg-amber-50 border-amber-200" :
                    ms.status === "reached" ? "bg-purple-50 border-purple-200" :
                    "bg-white border-zinc-200"
                  }`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-zinc-800 text-lg">{ms.label}</span>
                        <span className={`text-[10px] px-2.5 py-1 rounded-full font-medium ${
                          ms.status === "awarded" ? "bg-green-200 text-green-800" :
                          ms.status === "drawn" ? "bg-amber-200 text-amber-800" :
                          ms.status === "reached" ? "bg-purple-200 text-purple-800" :
                          "bg-zinc-100 text-zinc-500"
                        }`}>
                          {ms.status === "awarded" ? "✅ COMPLETADO" :
                           ms.status === "drawn" ? "🎲 SORTEADO" :
                           ms.status === "reached" ? "🎯 ALCANZADO" :
                           "⏳ PENDIENTE"}
                        </span>
                      </div>
                      <span className="text-sm text-zinc-500">Mínimo: {ms.minPoints.toLocaleString()} pts</span>
                    </div>

                    {/* Progress bar */}
                    <div className="h-2 bg-zinc-100 rounded-full overflow-hidden mb-3">
                      <div
                        className={`h-full rounded-full ${
                          ms.status === "awarded" ? "bg-green-500" :
                          ms.status === "drawn" || ms.status === "reached" ? "bg-amber-500" :
                          "bg-zinc-300"
                        }`}
                        style={{ width: `${Math.min(100, (totalUsers / ms.target) * 100)}%` }}
                      />
                    </div>

                    {/* Prizes */}
                    <div className="text-xs text-zinc-500 mb-3">
                      🥇 {ms.prize1} · 🎲 {ms.prize2}
                    </div>

                    {/* Winners (if drawn or awarded) */}
                    {(ms.status === "drawn" || ms.status === "awarded") && ms.winner1Id && (
                      <div className="bg-white/80 rounded-lg p-4 space-y-2 border border-zinc-100">
                        <div className="flex items-center gap-3">
                          <span>🥇</span>
                          <span className="text-sm font-mono text-zinc-700">{ms.winner1Id.substring(0, 14)}...</span>
                          <span className="text-sm font-bold text-amber-600">{ms.winner1Points?.toLocaleString()} pts</span>
                          <span className="text-xs text-zinc-400">— #1 ranking</span>
                        </div>
                        {ms.winner2Id && (
                          <div className="flex items-center gap-3">
                            <span>🎲</span>
                            <span className="text-sm font-mono text-zinc-700">{ms.winner2Id.substring(0, 14)}...</span>
                            <span className="text-sm font-bold text-purple-600">{ms.winner2Points?.toLocaleString()} pts</span>
                            <span className="text-xs text-zinc-400">
                              — {ms.winner2Tickets?.toLocaleString()} de {ms.totalTickets?.toLocaleString()} papeletas
                            </span>
                          </div>
                        )}
                        <div className="text-xs text-zinc-400">
                          Seed: {ms.seed} · {ms.totalParticipants} participantes
                          {ms.drawnAt && ` · Sorteo: ${ms.drawnAt.toLocaleString()}`}
                        </div>

                        {ms.status === "drawn" && (
                          <button
                            onClick={() => handleFinalize(ms)}
                            disabled={actionLoading === ms.id}
                            className="mt-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
                          >
                            {actionLoading === ms.id ? "Procesando..." : "✅ Finalizar y resetear puntos"}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </main>
      </div>
    </AuthGuard>
  );
}
