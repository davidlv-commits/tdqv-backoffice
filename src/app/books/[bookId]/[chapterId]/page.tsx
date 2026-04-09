"use client";

import { useEffect, useState, useCallback } from "react";
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
import { getChapter, getMediaMoments, saveMediaMoment, deleteMediaMoment, saveChapter } from "@/lib/firestore";
import type { Chapter, MediaMoment, MediaType, DisplayStyle } from "@/lib/types";

export default function ChapterEditor() {
  const { bookId, chapterId } = useParams<{ bookId: string; chapterId: string }>();
  const [chapter, setChapter] = useState<Chapter | null>(null);
  const [paragraphs, setParagraphs] = useState<string[]>([]);
  const [moments, setMoments] = useState<MediaMoment[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingAt, setAddingAt] = useState<number | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

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

  const handleParagraphChange = useCallback((idx: number, value: string) => {
    setParagraphs((prev) => {
      const next = [...prev];
      next[idx] = value;
      return next;
    });
    setHasChanges(true);
    setSaveMessage("");
  }, []);

  const handleSaveChapter = async () => {
    if (!chapter) return;
    setSaving(true);
    setSaveMessage("");
    try {
      const newBody = paragraphs.join("\n\n");
      await saveChapter(bookId, {
        id: chapterId,
        body: newBody,
        paragraphCount: paragraphs.length,
      });
      setHasChanges(false);
      setSaveMessage("Guardado correctamente");
      setTimeout(() => setSaveMessage(""), 3000);
    } catch (e) {
      console.error("Error saving chapter:", e);
      setSaveMessage("Error al guardar");
    } finally {
      setSaving(false);
    }
  };

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
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Link href={`/books/${bookId}`} className="text-zinc-500 hover:text-zinc-300">←</Link>
              <div>
                <h2 className="text-2xl font-bold">{chapter?.title || chapterId}</h2>
                <p className="text-sm text-zinc-400">
                  Capítulo {chapter?.order} · {paragraphs.length} párrafos · {moments.length} media moments
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {saveMessage && (
                <span className={`text-sm ${saveMessage.includes("Error") ? "text-red-400" : "text-green-400"}`}>
                  {saveMessage}
                </span>
              )}
              <Button
                onClick={handleSaveChapter}
                disabled={!hasChanges || saving}
                className="bg-amber-600 hover:bg-amber-700 disabled:opacity-40"
              >
                {saving ? "Guardando..." : "Guardar cambios"}
              </Button>
            </div>
          </div>

          {loading ? (
            <p className="text-zinc-500">Cargando...</p>
          ) : paragraphs.length === 0 ? (
            <p className="text-zinc-500">Este capítulo no tiene contenido en Firestore.</p>
          ) : (
            <div className="max-w-4xl space-y-1">
              {paragraphs.map((p, idx) => (
                <div key={idx} className="group">
                  {/* Paragraph - editable */}
                  <div className="flex gap-3 py-2">
                    <span className="text-amber-500/30 font-mono text-xs w-8 pt-3 flex-shrink-0 text-right select-none">
                      {idx}
                    </span>
                    <textarea
                      value={p}
                      onChange={(e) => handleParagraphChange(idx, e.target.value)}
                      className="flex-1 bg-zinc-800/40 border border-zinc-700/30 rounded-lg px-4 py-3 text-sm text-zinc-300 leading-relaxed resize-none focus:outline-none focus:border-amber-500/40 focus:bg-zinc-800/60 transition-colors"
                      rows={Math.max(2, Math.ceil(p.length / 100))}
                    />
                  </div>

                  {/* Media moments at this position */}
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

                  {/* Insert media moment button */}
                  {addingAt === idx ? (
                    <div className="ml-11 mb-3 bg-zinc-800/60 border border-zinc-700/50 rounded-lg p-4 space-y-3">
                      <div className="flex gap-3">
                        <div className="flex-1">
                          <Label className="text-xs">Tipo</Label>
                          <Select value={newType} onValueChange={(v) => setNewType(v as MediaType)}>
                            <SelectTrigger className="bg-zinc-800 border-zinc-700">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="music">Musica</SelectItem>
                              <SelectItem value="audio">Audio</SelectItem>
                              <SelectItem value="video">Video</SelectItem>
                              <SelectItem value="image">Imagen</SelectItem>
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
                        <Label className="text-xs">Titulo</Label>
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
                        <Label className="text-xs">Exclusivo (bloqueado hasta completar capitulo)</Label>
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
                        + Insertar media aqui
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
