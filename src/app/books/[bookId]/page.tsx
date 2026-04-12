"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { AuthGuard } from "@/components/auth-guard";
import { Sidebar } from "@/components/sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getChapters, addChapter, deleteChapter, saveChapter, compactRenumberChapters, renumberChaptersFrom } from "@/lib/firestore";
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
  const [message, setMessage] = useState("");

  // Insert new chapter dialog state.
  const [showInsertDialog, setShowInsertDialog] = useState(false);
  const [insertAfterOrder, setInsertAfterOrder] = useState<number>(0);
  const [newChapterTitle, setNewChapterTitle] = useState("");
  const [inserting, setInserting] = useState(false);

  // Delete confirm.
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const loadData = useCallback(async () => {
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
  }, [bookId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const flash = (msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(""), 3000);
  };

  const handleInsertChapter = useCallback(async () => {
    if (!newChapterTitle.trim()) return;
    setInserting(true);

    try {
      // Make room for the new chapter.
      await renumberChaptersFrom(bookId, insertAfterOrder + 1);

      await addChapter(bookId, {
        title: newChapterTitle.trim(),
        order: insertAfterOrder + 1,
        body: "",
        paragraphCount: 0,
        status: "draft",
        mediaMomentCount: 0,
      });

      flash(`Capítulo "${newChapterTitle.trim()}" insertado en posición ${insertAfterOrder + 1}`);
      setShowInsertDialog(false);
      setNewChapterTitle("");
      await loadData();
    } catch (e) {
      console.error(e);
      flash("Error al insertar capítulo");
    }
    setInserting(false);
  }, [bookId, insertAfterOrder, newChapterTitle, loadData]);

  const handleDeleteChapter = useCallback(async (ch: Chapter) => {
    try {
      // Delete media moments for this chapter.
      const snap = await getDocs(
        query(
          collection(db, "media_moments"),
          where("bookId", "==", bookId),
          where("chapterId", "==", ch.id)
        )
      );
      for (const d of snap.docs) {
        const { deleteDoc, doc } = await import("firebase/firestore");
        await deleteDoc(doc(db, "media_moments", d.id));
      }

      await deleteChapter(bookId, ch.id);
      await compactRenumberChapters(bookId);
      flash(`Capítulo "${ch.title}" eliminado y capítulos renumerados`);
      setDeleteConfirm(null);
      await loadData();
    } catch (e) {
      console.error(e);
      flash("Error al eliminar capítulo");
    }
  }, [bookId, loadData]);

  const handleRenumber = useCallback(async () => {
    try {
      await compactRenumberChapters(bookId);
      flash("Capítulos renumerados correctamente");
      await loadData();
    } catch (e) {
      console.error(e);
      flash("Error al renumerar");
    }
  }, [bookId, loadData]);

  const totalMedia = Object.values(mediaCounts).reduce((a, b) => a + b, 0);

  return (
    <AuthGuard>
      <div className="flex h-screen">
        <Sidebar />
        <main className="flex-1 overflow-auto bg-slate-50 p-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Link href="/books" className="text-zinc-400 hover:text-zinc-600">←</Link>
              <div>
                <h2 className="text-2xl font-bold text-zinc-900">{BOOK_TITLES[bookId] || bookId}</h2>
                <p className="text-sm text-zinc-500">
                  {chapters.length} capítulos · {totalMedia} media insertados
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {message && (
                <span className={`text-sm font-medium mr-3 ${message.includes("Error") ? "text-red-500" : "text-green-600"}`}>
                  {message}
                </span>
              )}
              <Button
                size="sm"
                variant="outline"
                className="text-zinc-600 border-zinc-300"
                onClick={handleRenumber}
              >
                🔢 Renumerar
              </Button>
              <Button
                size="sm"
                className="bg-green-600 hover:bg-green-700 text-white"
                onClick={() => {
                  setInsertAfterOrder(chapters.length);
                  setNewChapterTitle("");
                  setShowInsertDialog(true);
                }}
              >
                + Añadir capítulo al final
              </Button>
            </div>
          </div>

          {/* Insert chapter dialog */}
          {showInsertDialog && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4 shadow-sm">
              <h3 className="font-semibold text-green-800 text-sm mb-3">
                Insertar nuevo capítulo {insertAfterOrder === 0 ? "al principio" : `después del capítulo ${insertAfterOrder}`}
              </h3>
              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <label className="text-xs text-zinc-500 mb-1 block">Título del capítulo</label>
                  <input
                    type="text"
                    value={newChapterTitle}
                    onChange={(e) => setNewChapterTitle(e.target.value)}
                    placeholder="Ej: Queríamos vernos"
                    className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm text-zinc-900 bg-white focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && newChapterTitle.trim()) handleInsertChapter();
                    }}
                  />
                </div>
                <Button
                  size="sm"
                  onClick={handleInsertChapter}
                  disabled={!newChapterTitle.trim() || inserting}
                  className="bg-green-600 hover:bg-green-700 text-white h-9"
                >
                  {inserting ? "Insertando..." : "Insertar"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowInsertDialog(false)}
                  className="h-9 text-zinc-500"
                >
                  Cancelar
                </Button>
              </div>
              <p className="text-[10px] text-zinc-400 mt-2">
                Los capítulos posteriores se renumerarán automáticamente.
              </p>
            </div>
          )}

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
            <div className="space-y-1">
              {chapters.map((ch) => {
                const mediaCount = mediaCounts[ch.id] || ch.mediaMomentCount || 0;
                const isDeleteTarget = deleteConfirm === ch.id;
                return (
                  <div key={ch.id} className="group">
                    <div className="flex items-center gap-2">
                      {/* Main chapter card */}
                      <Link
                        href={`/books/${bookId}/${ch.id}`}
                        className="flex-1 flex items-center justify-between bg-white border border-zinc-200 rounded-lg px-5 py-3.5 hover:border-amber-500/40 hover:shadow-sm transition-all"
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

                      {/* Action buttons — visible on hover */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => {
                            setInsertAfterOrder(ch.order);
                            setNewChapterTitle("");
                            setShowInsertDialog(true);
                          }}
                          className="p-1.5 rounded-md hover:bg-green-50 text-green-600 text-xs"
                          title="Insertar capítulo después"
                        >
                          ➕
                        </button>
                        {isDeleteTarget ? (
                          <div className="flex items-center gap-1 bg-red-50 border border-red-200 rounded-md px-2 py-1">
                            <span className="text-[10px] text-red-600 font-medium">¿Seguro?</span>
                            <button
                              onClick={() => handleDeleteChapter(ch)}
                              className="text-[10px] px-1.5 py-0.5 bg-red-600 text-white rounded font-medium hover:bg-red-700"
                            >
                              Sí
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(null)}
                              className="text-[10px] px-1.5 py-0.5 text-zinc-500 hover:text-zinc-700"
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeleteConfirm(ch.id)}
                            className="p-1.5 rounded-md hover:bg-red-50 text-red-400 hover:text-red-600 text-xs"
                            title="Eliminar capítulo"
                          >
                            🗑️
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>
    </AuthGuard>
  );
}
