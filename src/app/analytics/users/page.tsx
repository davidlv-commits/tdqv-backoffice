"use client";

import { useEffect, useState, useMemo } from "react";
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
  const [locationFilter, setLocationFilter] = useState("");
  const [tierFilter, setTierFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
    try {
      const snap = await getDocs(
        query(collection(db, "user_points"), orderBy("currentMilestonePoints", "desc"), limit(500))
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

  // Extract unique locations for the filter dropdown.
  const locations = useMemo(() => {
    const locs = new Map<string, number>();
    users.forEach((u) => {
      const loc = u.country || u.locale || u.timezone;
      if (loc) locs.set(loc, (locs.get(loc) ?? 0) + 1);
    });
    return [...locs.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([loc, count]) => ({ loc, count }));
  }, [users]);

  // Filter + sort.
  const filtered = useMemo(() => {
    let list = users;

    if (locationFilter) {
      list = list.filter((u) => {
        const loc = u.country || u.locale || u.timezone;
        return loc === locationFilter;
      });
    }

    if (tierFilter) {
      list = list.filter((u) => {
        if (tierFilter === "trial") return u.trialExpiresAt && u.trialExpiresAt > new Date();
        return u.subscriptionTier === tierFilter;
      });
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter((u) =>
        u.id.toLowerCase().includes(q) ||
        u.referralCode.toLowerCase().includes(q) ||
        u.country.toLowerCase().includes(q)
      );
    }

    return [...list].sort((a, b) => {
      const av = a[sortBy], bv = b[sortBy];
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "number" && typeof bv === "number") return sortDesc ? bv - av : av - bv;
      return sortDesc ? String(bv).localeCompare(String(av)) : String(av).localeCompare(String(bv));
    });
  }, [users, locationFilter, tierFilter, searchQuery, sortBy, sortDesc]);

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
          <p className="text-sm text-zinc-500 mb-4">
            {filtered.length} de {users.length} usuarios
            {locationFilter && <span className="text-amber-600"> · 📍 {locationFilter}</span>}
            {tierFilter && <span className="text-purple-600"> · {tierFilter.toUpperCase()}</span>}
          </p>

          {/* Filters bar */}
          <div className="flex flex-wrap items-center gap-3 mb-6">
            {/* Location filter */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-500">📍 Ubicación:</span>
              <select
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value)}
                className="text-sm border border-zinc-300 rounded-lg px-3 py-1.5 bg-white text-zinc-700"
              >
                <option value="">Todas</option>
                {locations.map((l) => (
                  <option key={l.loc} value={l.loc}>
                    {l.loc} ({l.count})
                  </option>
                ))}
              </select>
            </div>

            {/* Tier filter */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-500">Tier:</span>
              <select
                value={tierFilter}
                onChange={(e) => setTierFilter(e.target.value)}
                className="text-sm border border-zinc-300 rounded-lg px-3 py-1.5 bg-white text-zinc-700"
              >
                <option value="">Todos</option>
                <option value="premium">⭐ Premium</option>
                <option value="plus">✦ TDQV+</option>
                <option value="free">○ Gratis</option>
                <option value="trial">🎁 Trial</option>
              </select>
            </div>

            {/* Search */}
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar ID, código..."
              className="text-sm border border-zinc-300 rounded-lg px-3 py-1.5 bg-white text-zinc-700 w-48"
            />

            {(locationFilter || tierFilter || searchQuery) && (
              <button
                onClick={() => { setLocationFilter(""); setTierFilter(""); setSearchQuery(""); }}
                className="text-xs text-zinc-400 hover:text-zinc-600 underline"
              >
                Limpiar filtros
              </button>
            )}
          </div>

          {/* Location summary cards */}
          {!locationFilter && locations.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-6">
              {locations.slice(0, 8).map((l) => (
                <button
                  key={l.loc}
                  onClick={() => setLocationFilter(l.loc)}
                  className="text-xs bg-white border border-zinc-200 rounded-full px-3 py-1.5 hover:border-amber-400 hover:bg-amber-50 transition-colors"
                >
                  📍 {l.loc} <span className="font-bold text-amber-600 ml-1">{l.count}</span>
                </button>
              ))}
            </div>
          )}

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
                  {filtered.map((u, i) => (
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
