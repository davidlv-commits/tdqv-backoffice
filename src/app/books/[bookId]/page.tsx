"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { AuthGuard } from "@/components/auth-guard";
import { Sidebar } from "@/components/sidebar";
import { Badge } from "@/components/ui/badge";
import { getChapters } from "@/lib/firestore";
import type { Chapter } from "@/lib/types";

const BOOK_TITLES: Record<string, string> = {
  book1: "Tú de qué vas",
  book2: "Tú de qué vas, pero no",
};

export default function BookChapters() {
  const { bookId } = useParams<{ bookId: string }>();
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getChapters(bookId).then((c) => {
      setChapters(c);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [bookId]);

  return (
    <AuthGuard>
      <div className="flex h-screen">
        <Sidebar />
        <main className="flex-1 overflow-auto p-8">
          <div className="flex items-center gap-3 mb-6">
            <Link href="/books" className="text-zinc-500 hover:text-zinc-300">←</Link>
            <div>
              <h2 className="text-2xl font-bold">{BOOK_TITLES[bookId] || bookId}</h2>
              <p className="text-sm text-zinc-500">{chapters.length} capítulos</p>
            </div>
          </div>

          {loading ? (
            <p className="text-zinc-500">Cargando capítulos...</p>
          ) : chapters.length === 0 ? (
            <div className="bg-zinc-800/60 border border-zinc-700/50 rounded-xl p-8 text-center">
              <p className="text-zinc-400 mb-2">No hay capítulos en Firestore</p>
              <p className="text-sm text-zinc-500">
                Necesitas migrar los capítulos desde los JSON locales. Usa el botón de importar.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {chapters.map((ch) => (
                <Link
                  key={ch.id}
                  href={`/books/${bookId}/${ch.id}`}
                  className="flex items-center justify-between bg-zinc-800/60 border border-zinc-700/50 rounded-lg px-5 py-4 hover:border-amber-500/30 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <span className="text-amber-500/60 font-mono text-sm w-8">
                      {ch.order}
                    </span>
                    <span className="font-medium">{ch.title}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {(ch.mediaMomentCount || 0) > 0 && (
                      <Badge variant="outline" className="border-amber-500/30 text-amber-500">
                        {ch.mediaMomentCount} media
                      </Badge>
                    )}
                    <span className="text-zinc-600 text-sm">
                      {ch.paragraphCount || "?"} párrafos
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </main>
      </div>
    </AuthGuard>
  );
}
