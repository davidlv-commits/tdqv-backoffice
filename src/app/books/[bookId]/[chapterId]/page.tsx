"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { AuthGuard } from "@/components/auth-guard";
import { Sidebar } from "@/components/sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { getChapter, getMediaMoments, saveMediaMoment, deleteMediaMoment } from "@/lib/firestore";
import type { Chapter, MediaMoment, MediaType, DisplayStyle } from "@/lib/types";

export default function ChapterEditor() {
  const { bookId, chapterId } = useParams<{ bookId: string; chapterId: string }>();
  const [chapter, setChapter] = useState<Chapter | null>(null);
  const [paragraphs, setParagraphs] = useState<string[]>([]);
  const [moments, setMoments] = useState<MediaMoment[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingAt, setAddingAt] = useState<number | null>(null);

  // Form state for new media moment.
  const [newType, setNewType] = useState<MediaType>("music");
  const [newTitle, setNewTitle] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newExclusive, setNewExclusive] = useState(true);
  const [newDisplay, setNewDisplay] = useState<DisplayStyle>("inline");

  useEffect(() => {
    Promise.all([
      getChapter(bookId, chapterId),
      getMediaMoments(bookId, chapterId),
    ]).then(([ch, mm]) => {
      setChapter(ch);
      setMoments(mm);
      if (ch?.body) {
        setParagraphs(ch.body.split("\n\n").filter((p) => p.trim()));
      }
      setLoading(false);
    });
  }, [bookId, chapterId]);

  const handleAddMoment = async () => {
    if (addingAt === null || !newTitle) return;
    await saveMediaMoment({
      bookId,
      chapterId,
      paragraphIndex: addingAt,
      mediaType: newType,
      mediaId: newTitle.toLowerCase().replace(/\s+/g, "-"),
      title: newTitle,
      mediaUrl: newUrl,
      isExclusive: newExclusive,
      displayStyle: newDisplay,
      unlockMessage: newExclusive ? "Podrás acceder a este contenido tras leer el capítulo" : undefined,
      order: 0,
      active: true,
    });
    // Reload moments.
    const mm = await getMediaMoments(bookId, chapterId);
    setMoments(mm);
    setAddingAt(null);
    setNewTitle("");
    setNewUrl("");
  };

  const handleDeleteMoment = async (id: string) => {
    await deleteMediaMoment(id);
    setMoments((prev) => prev.filter((m) => m.id !== id));
  };

  const getMomentsAt = (idx: number) => moments.filter((m) => m.paragraphIndex === idx);

  return (
    <AuthGuard>
      <div className="flex h-screen">
        <Sidebar />
        <main className="flex-1 overflow-auto p-8">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <Link href={`/books/${bookId}`} className="text-zinc-500 hover:text-zinc-300">←</Link>
            <div>
              <h2 className="text-2xl font-bold">{chapter?.title || chapterId}</h2>
              <p className="text-sm text-zinc-500">
                Capítulo {chapter?.order} · {paragraphs.length} párrafos · {moments.length} media moments
              </p>
            </div>
          </div>

          {loading ? (
            <p className="text-zinc-500">Cargando...</p>
          ) : paragraphs.length === 0 ? (
            <p className="text-zinc-500">Este capítulo no tiene contenido en Firestore.</p>
          ) : (
            <div className="max-w-3xl space-y-1">
              {paragraphs.map((p, idx) => (
                <div key={idx}>
                  {/* Párrafo */}
                  <div className="flex gap-3 py-3 group">
                    <span className="text-amber-500/40 font-mono text-xs w-8 pt-1 flex-shrink-0 text-right">
                      {idx}
                    </span>
                    <p className="text-sm text-zinc-300 leading-relaxed flex-1">
                      {p.length > 200 ? p.slice(0, 200) + "…" : p}
                    </p>
                  </div>

                  {/* Media moments en esta posición */}
                  {getMomentsAt(idx).map((m) => (
                    <div
                      key={m.id}
                      className="ml-11 mb-2 flex items-center gap-3 bg-amber-500/5 border border-amber-500/20 rounded-lg px-4 py-3"
                    >
                      <Badge className={
                        m.mediaType === "music" ? "bg-purple-500/20 text-purple-400" :
                        m.mediaType === "audio" ? "bg-blue-500/20 text-blue-400" :
                        m.mediaType === "video" ? "bg-red-500/20 text-red-400" :
                        "bg-green-500/20 text-green-400"
                      }>
                        {m.mediaType}
                      </Badge>
                      <span className="text-sm font-medium flex-1">{m.title}</span>
                      {m.isExclusive && (
                        <Badge variant="outline" className="border-amber-500/30 text-amber-500 text-xs">
                          Exclusivo
                        </Badge>
                      )}
                      <button
                        onClick={() => handleDeleteMoment(m.id)}
                        className="text-zinc-600 hover:text-red-400 text-xs"
                      >
                        ✕
                      </button>
                    </div>
                  ))}

                  {/* Botón para insertar media moment */}
                  {addingAt === idx ? (
                    <div className="ml-11 mb-3 bg-zinc-900 border border-zinc-700 rounded-lg p-4 space-y-3">
                      <div className="flex gap-3">
                        <div className="flex-1">
                          <Label className="text-xs">Tipo</Label>
                          <Select value={newType} onValueChange={(v) => setNewType(v as MediaType)}>
                            <SelectTrigger className="bg-zinc-800 border-zinc-700">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="music">🎵 Música</SelectItem>
                              <SelectItem value="audio">🎙️ Audio</SelectItem>
                              <SelectItem value="video">🎬 Vídeo</SelectItem>
                              <SelectItem value="image">🖼️ Imagen</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex-1">
                          <Label className="text-xs">Estilo</Label>
                          <Select value={newDisplay} onValueChange={(v) => setNewDisplay(v as DisplayStyle)}>
                            <SelectTrigger className="bg-zinc-800 border-zinc-700">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="inline">Inline</SelectItem>
                              <SelectItem value="fullscreen">Fullscreen</SelectItem>
                              <SelectItem value="ambient">Ambient</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs">Título</Label>
                        <Input
                          value={newTitle}
                          onChange={(e) => setNewTitle(e.target.value)}
                          placeholder="Nombre del contenido"
                          className="bg-zinc-800 border-zinc-700"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">URL del media</Label>
                        <Input
                          value={newUrl}
                          onChange={(e) => setNewUrl(e.target.value)}
                          placeholder="https://..."
                          className="bg-zinc-800 border-zinc-700"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={newExclusive}
                          onCheckedChange={setNewExclusive}
                        />
                        <Label className="text-xs">Exclusivo (bloqueado hasta completar capítulo)</Label>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={handleAddMoment} className="bg-amber-600 hover:bg-amber-700">
                          Guardar
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setAddingAt(null)}>
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="ml-11 my-1">
                      <button
                        onClick={() => setAddingAt(idx)}
                        className="text-xs text-zinc-600 hover:text-amber-500 opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity"
                      >
                        + Insertar media aquí
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </AuthGuard>
  );
}
