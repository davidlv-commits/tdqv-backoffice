"use client";

import { useEffect, useState } from "react";
import { AuthGuard } from "@/components/auth-guard";
import { Sidebar } from "@/components/sidebar";
import { collection, getDocs, query, orderBy, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface UserRow {
  id: string;
  totalPoints: number;
  currentMilestonePoints: number;
  streak: number;
  bestStreak: number;
  chaptersCompleted: number;
  songsListened: number;
  validReferrals: number;
  subscriptionTier: string;
  lastActiveDate: Date | null;
  trialExpiresAt: Date | null;
  referralCode: string;
  country: string;
  locale: string;
  timezone: string;
}

export default function UsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<keyof UserRow>("currentMilestonePoints");
  const [sortDesc, setSortDesc] = useState(true);

  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
    try {
      const snap = await getDocs(
        query(collection(db, "user_points"), orderBy("currentMilestonePoints", "desc"), limit(200))
      );
      setUsers(snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          totalPoints: data.totalPoints ?? 0,
          currentMilestonePoints: data.currentMilestonePoints ?? 0,
          streak: data.streak ?? 0,
          bestStreak: data.bestStreak ?? 0,
          chaptersCompleted: data.chaptersCompleted ?? 0,
          songsListened: data.songsListened ?? 0,
          validReferrals: data.validReferrals ?? 0,
          subscriptionTier: data.subscriptionTier ?? "free",
          lastActiveDate: data.lastActiveDate?.toDate() ?? null,
          trialExpiresAt: data.trialExpiresAt?.toDate() ?? null,
          referralCode: data.referralCode ?? "",
          country: data.country ?? "",
          locale: data.locale ?? "",
          timezone: data.timezone ?? "",
        };
      }));
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }

  const sorted = [...users].sort((a, b) => {
    const av = a[sortBy], bv = b[sortBy];
    if (av == null) return 1;
    if (bv == null) return -1;
    if (typeof av === "number" && typeof bv === "number") return sortDesc ? bv - av : av - bv;
    return sortDesc ? String(bv).localeCompare(String(av)) : String(av).localeCompare(String(bv));
  });

  const handleSort = (col: keyof UserRow) => {
    if (sortBy === col) setSortDesc(!sortDesc);
    else { setSortBy(col); setSortDesc(true); }
  };

  return (
    <AuthGuard>
      <div className="flex h-screen">
        <Sidebar />
        <main className="flex-1 overflow-auto bg-slate-50 p-8">
          <h2 className="text-2xl font-bold text-zinc-900 mb-2">Usuarios</h2>
          <p className="text-sm text-zinc-500 mb-6">{users.length} usuarios registrados</p>

          {loading ? (
            <p className="text-zinc-500">Cargando...</p>
          ) : (
            <div className="bg-white border border-zinc-200 rounded-xl shadow-sm overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50">
                    <Th label="#" />
                    <Th label="ID" onClick={() => handleSort("id")} active={sortBy === "id"} />
                    <Th label="Pts hito" onClick={() => handleSort("currentMilestonePoints")} active={sortBy === "currentMilestonePoints"} />
                    <Th label="Pts total" onClick={() => handleSort("totalPoints")} active={sortBy === "totalPoints"} />
                    <Th label="🔥" onClick={() => handleSort("streak")} active={sortBy === "streak"} />
                    <Th label="📖" onClick={() => handleSort("chaptersCompleted")} active={sortBy === "chaptersCompleted"} />
                    <Th label="🎵" onClick={() => handleSort("songsListened")} active={sortBy === "songsListened"} />
                    <Th label="👥" onClick={() => handleSort("validReferrals")} active={sortBy === "validReferrals"} />
                    <Th label="Tier" onClick={() => handleSort("subscriptionTier")} active={sortBy === "subscriptionTier"} />
                    <Th label="📍" onClick={() => handleSort("country")} active={sortBy === "country"} />
                    <Th label="Último" onClick={() => handleSort("lastActiveDate")} active={sortBy === "lastActiveDate"} />
                    <Th label="Código" />
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((u, i) => (
                    <tr key={u.id} className="border-b border-zinc-100 hover:bg-zinc-50">
                      <td className="px-3 py-2 text-zinc-400 font-mono text-xs">{i + 1}</td>
                      <td className="px-3 py-2 text-zinc-700 font-mono text-xs truncate max-w-[100px]">{u.id.substring(0, 10)}...</td>
                      <td className="px-3 py-2 font-bold text-amber-600">{u.currentMilestonePoints.toLocaleString()}</td>
                      <td className="px-3 py-2 text-zinc-500">{u.totalPoints.toLocaleString()}</td>
                      <td className="px-3 py-2">{u.streak > 0 ? `🔥${u.streak}` : "—"}</td>
                      <td className="px-3 py-2 text-zinc-600">{u.chaptersCompleted}</td>
                      <td className="px-3 py-2 text-zinc-600">{u.songsListened}</td>
                      <td className="px-3 py-2 text-zinc-600">{u.validReferrals}</td>
                      <td className="px-3 py-2">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                          u.subscriptionTier === "premium" ? "bg-amber-100 text-amber-700" :
                          u.subscriptionTier === "plus" ? "bg-purple-100 text-purple-700" :
                          "bg-zinc-100 text-zinc-500"
                        }`}>
                          {u.subscriptionTier.toUpperCase()}
                        </span>
                        {u.trialExpiresAt && u.trialExpiresAt > new Date() && (
                          <span className="text-[10px] ml-1 px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">TRIAL</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs text-zinc-500" title={u.timezone}>
                        {u.country || u.locale || "—"}
                      </td>
                      <td className="px-3 py-2 text-xs text-zinc-400">
                        {u.lastActiveDate ? u.lastActiveDate.toLocaleDateString() : "—"}
                      </td>
                      <td className="px-3 py-2 text-xs text-zinc-400 font-mono">{u.referralCode || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </main>
      </div>
    </AuthGuard>
  );
}

function Th({ label, onClick, active }: { label: string; onClick?: () => void; active?: boolean }) {
  return (
    <th
      className={`px-3 py-3 text-left text-xs font-semibold text-zinc-500 whitespace-nowrap ${
        onClick ? "cursor-pointer hover:text-zinc-700" : ""
      } ${active ? "text-amber-600" : ""}`}
      onClick={onClick}
    >
      {label} {active && "↕"}
    </th>
  );
}
