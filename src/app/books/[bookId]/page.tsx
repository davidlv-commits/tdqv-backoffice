"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { AuthGuard } from "@/components/auth-guard";
import { Sidebar } from "@/components/sidebar";
import { Badge } from "@/components/ui/badge";
import { getChapters } from "@/lib/firestore";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Chapter } from "@/lib/types";

const BOOK_TITLES: Record<string, string> = {
  book1: "Tú de qué vas",
  book2: "Tú de qué vas, pero no",
};

export default function BookChapters() {
  const { bookId } = useParams<{ bookId: string }>();
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [mediaCounts, setMediaCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const chs = await getChapters(bookId);
        setChapters(chs);

        // Count media moments per chapter.
        const counts: Record<string, number> = {};
        const snap = await getDocs(
          query(collection(db, "media_moments"), where("bookId", "==", bookId))
        );
        for (const doc of snap.docs) {
          const chId = doc.data().chapterId as string;
          counts[chId] = (counts[chId] || 0) + 1;
        }
        setMediaCounts(counts);
      } catch {
        // ignore
      }
      setLoading(false);
    }
    load();
  }, [bookId]);

  const totalMedia = Object.values(mediaCounts).reduce((a, b) => a + b, 0);

  return (
    <AuthGuard>
      <div className="flex h-screen">
        <Sidebar />
        <main className="flex-1 overflow-auto bg-slate-50 p-8">
          <div className="flex items-center gap-3 mb-6">
            <Link href="/books" className="text-zinc-400 hover:text-zinc-600">←</Link>
            <div>
              <h2 className="text-2xl font-bold text-zinc-900">{BOOK_TITLES[bookId] || bookId}</h2>
              <p className="text-sm text-zinc-500">
                {chapters.length} capítulos · {totalMedia} media insertados
              </p>
            </div>
          </div>

          {loading ? (
            <p className="text-zinc-500">Cargando capítulos...</p>
          ) : chapters.length === 0 ? (
            <div className="bg-white border border-zinc-200 rounded-xl p-8 text-center shadow-sm">
              <p className="text-zinc-600 mb-2">No hay capítulos en Firestore</p>
              <p className="text-sm text-zinc-400">
                Necesitas migrar los capítulos desde los JSON locales. Usa el botón de importar.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {chapters.map((ch) => {
                const mediaCount = mediaCounts[ch.id] || ch.mediaMomentCount || 0;
                return (
                  <Link
                    key={ch.id}
                    href={`/books/${bookId}/${ch.id}`}
                    className="flex items-center justify-between bg-white border border-zinc-200 rounded-lg px-5 py-4 hover:border-amber-500/40 hover:shadow-sm transition-all"
                  >
                    <div className="flex items-center gap-4">
                      <span className="text-amber-600/60 font-mono text-sm w-8">
                        {ch.order}
                      </span>
                      <span className="font-medium text-zinc-900">{ch.title}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {mediaCount > 0 && (
                        <Badge className="bg-purple-100 text-purple-700 border-purple-300 hover:bg-purple-100">
                          🎵 {mediaCount} media
                        </Badge>
                      )}
                      <span className="text-zinc-400 text-sm">
                        {ch.paragraphCount || "?"} párrafos
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </main>
      </div>
    </AuthGuard>
  );
}
