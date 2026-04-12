"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { AuthGuard } from "@/components/auth-guard";
import { Sidebar } from "@/components/sidebar";
import { ChapterRichEditor, type MediaHookWithPosition } from "@/components/chapter-rich-editor";
import { getChapter, getChapters, getMediaMoments, saveChapter, saveMediaMoment, deleteMediaMoment, splitChapter } from "@/lib/firestore";
import type { Chapter, MediaMoment } from "@/lib/types";

export default function ChapterEditorPage() {
  const { bookId, chapterId } = useParams<{ bookId: string; chapterId: string }>();
  const router = useRouter();
  const [chapter, setChapter] = useState<Chapter | null>(null);
  const [moments, setMoments] = useState<MediaMoment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saveMessage, setSaveMessage] = useState("");

  // Navigation: prev/next chapter IDs.
  const [prevChapterId, setPrevChapterId] = useState<string | null>(null);
  const [nextChapterId, setNextChapterId] = useState<string | null>(null);
  const [prevChapterTitle, setPrevChapterTitle] = useState<string>("");
  const [nextChapterTitle, setNextChapterTitle] = useState<string>("");

  useEffect(() => {
    Promise.all([
      getChapter(bookId, chapterId),
      getMediaMoments(bookId, chapterId),
      getChapters(bookId),
    ]).then(([ch, mm, allChapters]) => {
      setChapter(ch);
      setMoments(mm);

      // Find prev/next chapters.
      const idx = allChapters.findIndex((c) => c.id === chapterId);
      if (idx > 0) {
        setPrevChapterId(allChapters[idx - 1].id);
        setPrevChapterTitle(allChapters[idx - 1].title);
      } else {
        setPrevChapterId(null);
        setPrevChapterTitle("");
      }
      if (idx >= 0 && idx < allChapters.length - 1) {
        setNextChapterId(allChapters[idx + 1].id);
        setNextChapterTitle(allChapters[idx + 1].title);
      } else {
        setNextChapterId(null);
        setNextChapterTitle("");
      }

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

  const handleSplit = useCallback(async (splitAtParagraph: number, newTitle: string) => {
    if (!chapter) return;
    try {
      setSaveMessage("Dividiendo capítulo...");
      const newChapterId = await splitChapter(bookId, chapterId, splitAtParagraph, newTitle);
      setSaveMessage(`¡Dividido! Nuevo capítulo: "${newTitle}"`);
      // Navigate to the book page to see the result.
      setTimeout(() => {
        router.push(`/books/${bookId}`);
      }, 1500);
    } catch (e) {
      console.error("Split error:", e);
      setSaveMessage(`Error al dividir: ${e instanceof Error ? e.message : String(e)}`);
      setTimeout(() => setSaveMessage(""), 4000);
    }
  }, [bookId, chapterId, chapter, router]);

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
        <main className="flex-1 flex flex-col overflow-hidden bg-slate-50">
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
              <div className="flex items-center gap-3">
                {saveMessage && (
                  <span className={`text-sm font-medium ${saveMessage.includes("Error") ? "text-red-500" : "text-green-600"}`}>
                    {saveMessage}
                  </span>
                )}
                {/* Prev/Next chapter navigation */}
                <div className="flex items-center gap-1 ml-4">
                  {prevChapterId ? (
                    <Link
                      href={`/books/${bookId}/${prevChapterId}`}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100 rounded-lg transition-colors"
                      title={prevChapterTitle}
                    >
                      <span>←</span>
                      <span className="hidden lg:inline max-w-[120px] truncate">{prevChapterTitle}</span>
                    </Link>
                  ) : (
                    <span className="px-3 py-1.5 text-sm text-zinc-300 cursor-not-allowed">←</span>
                  )}
                  {nextChapterId ? (
                    <Link
                      href={`/books/${bookId}/${nextChapterId}`}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100 rounded-lg transition-colors"
                      title={nextChapterTitle}
                    >
                      <span className="hidden lg:inline max-w-[120px] truncate">{nextChapterTitle}</span>
                      <span>→</span>
                    </Link>
                  ) : (
                    <span className="px-3 py-1.5 text-sm text-zinc-300 cursor-not-allowed">→</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Editor */}
          <div className="max-w-5xl mx-auto px-8 py-4 flex-1 min-h-0">
            {loading ? (
              <p className="text-zinc-500">Cargando capítulo...</p>
            ) : !chapter?.body ? (
              <p className="text-zinc-500">Este capítulo no tiene contenido.</p>
            ) : (
              <ChapterRichEditor
                initialContent={chapter.body}
                onSave={handleSave}
                onSplit={handleSplit}
                existingHooks={existingHooks}
              />
            )}
          </div>
        </main>
      </div>
    </AuthGuard>
  );
}
