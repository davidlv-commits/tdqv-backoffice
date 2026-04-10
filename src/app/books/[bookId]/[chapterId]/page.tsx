"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { AuthGuard } from "@/components/auth-guard";
import { Sidebar } from "@/components/sidebar";
import { ChapterRichEditor, type MediaHookWithPosition } from "@/components/chapter-rich-editor";
import { getChapter, getMediaMoments, saveChapter, saveMediaMoment, deleteMediaMoment } from "@/lib/firestore";
import type { Chapter, MediaMoment } from "@/lib/types";

export default function ChapterEditorPage() {
  const { bookId, chapterId } = useParams<{ bookId: string; chapterId: string }>();
  const [chapter, setChapter] = useState<Chapter | null>(null);
  const [moments, setMoments] = useState<MediaMoment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saveMessage, setSaveMessage] = useState("");

  useEffect(() => {
    Promise.all([
      getChapter(bookId, chapterId),
      getMediaMoments(bookId, chapterId),
    ]).then(([ch, mm]) => {
      setChapter(ch);
      setMoments(mm);
      setLoading(false);
    });
  }, [bookId, chapterId]);

  const handleSave = useCallback(async (body: string, hooks: MediaHookWithPosition[]) => {
    if (!chapter) return;
    try {
      // Save the updated text + mediaMomentCount.
      const paragraphs = body.split("\n\n").filter(p => p.trim());
      await saveChapter(bookId, {
        id: chapterId,
        body,
        paragraphCount: paragraphs.length,
        mediaMomentCount: hooks.length,
      });

      // Delete old media moments and save new ones.
      for (const m of moments) {
        await deleteMediaMoment(m.id);
      }
      for (let i = 0; i < hooks.length; i++) {
        const h = hooks[i];
        await saveMediaMoment({
          bookId,
          chapterId,
          paragraphIndex: h.paragraphIndex,
          mediaType: h.mediaType,
          mediaId: h.mediaId,
          title: h.title,
          mediaUrl: h.mediaUrl,
          isExclusive: h.isExclusive,
          displayStyle: h.displayStyle as "inline" | "fullscreen" | "ambient",
          autoplay: h.autoplay,
          initialVolume: h.initialVolume,
          crossfadeWithId: h.crossfadeWithId,
          order: i,
          active: true,
        });
      }

      // Refresh moments.
      const newMoments = await getMediaMoments(bookId, chapterId);
      setMoments(newMoments);

      // Update local chapter.
      setChapter(prev => prev ? {
        ...prev,
        body,
        paragraphCount: paragraphs.length,
        mediaMomentCount: hooks.length,
      } : prev);

      setSaveMessage(`Guardado: ${paragraphs.length} párrafos, ${hooks.length} media`);
      setTimeout(() => setSaveMessage(""), 3000);
    } catch (e) {
      console.error("Save error:", e);
      setSaveMessage("Error al guardar");
      setTimeout(() => setSaveMessage(""), 3000);
    }
  }, [bookId, chapterId, chapter, moments]);

  // Convert existing moments to hooks for the editor (preserving paragraphIndex).
  const existingHooks = moments.map((m) => ({
    mediaType: m.mediaType,
    mediaId: m.mediaId,
    title: m.title,
    mediaUrl: m.mediaUrl,
    isExclusive: m.isExclusive,
    displayStyle: m.displayStyle,
    autoplay: false,
    initialVolume: 0.3,
    crossfadeWithId: "",
    crossfadeWithTitle: "",
    paragraphIndex: m.paragraphIndex,
  }));

  return (
    <AuthGuard>
      <div className="flex h-screen">
        <Sidebar />
        <main className="flex-1 overflow-auto bg-slate-50">
          {/* Header */}
          <div className="sticky top-0 z-20 bg-slate-50 border-b border-zinc-200 px-8 py-4">
            <div className="flex items-center justify-between max-w-5xl">
              <div className="flex items-center gap-3">
                <Link href={`/books/${bookId}`} className="text-zinc-400 hover:text-zinc-600 text-lg">←</Link>
                <div>
                  <h2 className="text-xl font-bold text-zinc-900">{chapter?.title || chapterId}</h2>
                  <p className="text-sm text-zinc-500">
                    Capítulo {chapter?.order} · {chapter?.paragraphCount || 0} párrafos · {moments.length} media
                  </p>
                </div>
              </div>
              {saveMessage && (
                <span className={`text-sm font-medium ${saveMessage.includes("Error") ? "text-red-500" : "text-green-600"}`}>
                  {saveMessage}
                </span>
              )}
            </div>
          </div>

          {/* Editor */}
          <div className="max-w-5xl mx-auto p-8">
            {loading ? (
              <p className="text-zinc-500">Cargando capítulo...</p>
            ) : !chapter?.body ? (
              <p className="text-zinc-500">Este capítulo no tiene contenido.</p>
            ) : (
              <ChapterRichEditor
                initialContent={chapter.body}
                onSave={handleSave}
                existingHooks={existingHooks}
              />
            )}
          </div>
        </main>
      </div>
    </AuthGuard>
  );
}
