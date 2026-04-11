"use client";

import { useEffect, useState } from "react";
import { AuthGuard } from "@/components/auth-guard";
import { Sidebar } from "@/components/sidebar";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface Referrer {
  id: string;
  code: string;
  referrals: number;
  tier: string;
  points: number;
}

interface Referred {
  id: string;
  referredBy: string;
  tier: string;
  chaptersCompleted: number;
  lastActive: Date | null;
}

export default function ReferralsPage() {
  const [referrers, setReferrers] = useState<Referrer[]>([]);
  const [referred, setReferred] = useState<Referred[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const snap = await getDocs(collection(db, "user_points"));
      const refs: Referrer[] = [];
      const refds: Referred[] = [];

      snap.docs.forEach((d) => {
        const data = d.data();
        if (data.referralCode && data.validReferrals > 0) {
          refs.push({
            id: d.id,
            code: data.referralCode,
            referrals: data.validReferrals ?? 0,
            tier: data.subscriptionTier ?? "free",
            points: data.currentMilestonePoints ?? 0,
          });
        }
        if (data.referredBy) {
          refds.push({
            id: d.id,
            referredBy: data.referredBy,
            tier: data.subscriptionTier ?? "free",
            chaptersCompleted: data.chaptersCompleted ?? 0,
            lastActive: data.lastActiveDate?.toDate() ?? null,
          });
        }
      });

      refs.sort((a, b) => b.referrals - a.referrals);
      setReferrers(refs);
      setReferred(refds);
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
          <h2 className="text-2xl font-bold text-zinc-900 mb-2">Referidos</h2>
          <p className="text-sm text-zinc-500 mb-6">
            {referrers.length} anfitriones · {referred.length} referidos
          </p>

          {loading ? (
            <p className="text-zinc-500">Cargando...</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Top referrers */}
              <div className="bg-white border border-zinc-200 rounded-xl shadow-sm">
                <div className="px-5 py-4 border-b border-zinc-200">
                  <h3 className="font-semibold text-zinc-700">Top Anfitriones</h3>
                </div>
                <div className="divide-y divide-zinc-100 max-h-[400px] overflow-y-auto">
                  {referrers.length === 0 ? (
                    <p className="p-5 text-sm text-zinc-400">Sin referidos aún</p>
                  ) : referrers.map((r, i) => (
                    <div key={r.id} className="px-5 py-3 flex items-center gap-3">
                      <span className="text-sm text-zinc-400 w-6">{i + 1}</span>
                      <span className="text-xs font-mono text-zinc-500 flex-1">{r.id.substring(0, 10)}...</span>
                      <span className="text-xs font-mono text-amber-600 bg-amber-50 px-2 py-0.5 rounded">{r.code}</span>
                      <span className="font-bold text-zinc-800">{r.referrals} 👥</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent referred */}
              <div className="bg-white border border-zinc-200 rounded-xl shadow-sm">
                <div className="px-5 py-4 border-b border-zinc-200">
                  <h3 className="font-semibold text-zinc-700">Usuarios Referidos</h3>
                </div>
                <div className="divide-y divide-zinc-100 max-h-[400px] overflow-y-auto">
                  {referred.length === 0 ? (
                    <p className="p-5 text-sm text-zinc-400">Sin referidos aún</p>
                  ) : referred.map((r) => (
                    <div key={r.id} className="px-5 py-3 flex items-center gap-3 text-sm">
                      <span className="text-xs font-mono text-zinc-500 flex-1">{r.id.substring(0, 10)}...</span>
                      <span className="text-xs text-zinc-400">via {r.referredBy}</span>
                      <span className="text-xs text-zinc-600">📖 {r.chaptersCompleted}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                        r.tier === "premium" ? "bg-amber-100 text-amber-700" :
                        r.tier === "plus" ? "bg-purple-100 text-purple-700" :
                        "bg-zinc-100 text-zinc-500"
                      }`}>{r.tier}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </AuthGuard>
  );
}
