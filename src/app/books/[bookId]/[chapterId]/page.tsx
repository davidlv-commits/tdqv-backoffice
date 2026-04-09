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

  // Text editor modal state
  const [showTextEditor, setShowTextEditor] = useState(false);
  const [editableBody, setEditableBody] = useState("");
  const [savingText, setSavingText] = useState(false);
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

  const openTextEditor = useCallback(() => {
    setEditableBody(paragraphs.join("\n\n"));
    setShowTextEditor(true);
    setSaveMessage("");
  }, [paragraphs]);

  const handleSaveText = async () => {
    if (!chapter) return;
    setSavingText(true);
    setSaveMessage("");
    try {
      const newParagraphs = editableBody.split("\n\n").filter((p) => p.trim());
      await saveChapter(bookId, {
        id: chapterId,
        body: editableBody,
        paragraphCount: newParagraphs.length,
      });
      setParagraphs(newParagraphs);
      setShowTextEditor(false);
      setSaveMessage("Texto guardado correctamente");
      setTimeout(() => setSaveMessage(""), 3000);
    } catch (e) {
      console.error("Error saving chapter:", e);
      setSaveMessage("Error al guardar");
    } finally {
      setSavingText(false);
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
      unlockMessage: newExclusive ? "Podras acceder a este contenido tras leer el capitulo" : undefined,
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
        <main className="flex-1 overflow-auto bg-slate-50 p-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Link href={`/books/${bookId}`} className="text-zinc-400 hover:text-zinc-600">←</Link>
              <div>
                <h2 className="text-2xl font-bold text-zinc-900">{chapter?.title || chapterId}</h2>
                <p className="text-sm text-zinc-500">
                  Capitulo {chapter?.order} · {paragraphs.length} parrafos · {moments.length} media moments
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {saveMessage && (
                <span className={`text-sm ${saveMessage.includes("Error") ? "text-red-500" : "text-green-600"}`}>
                  {saveMessage}
                </span>
              )}
              <Button
                onClick={openTextEditor}
                className="bg-amber-600 hover:bg-amber-700 text-white"
              >
                Editar texto
              </Button>
            </div>
          </div>

          {loading ? (
            <p className="text-zinc-500">Cargando...</p>
          ) : paragraphs.length === 0 ? (
            <p className="text-zinc-500">Este capitulo no tiene contenido en Firestore.</p>
          ) : (
            <div className="max-w-4xl bg-white border border-zinc-200 rounded-xl shadow-sm overflow-hidden">
              {/* Paragraph list - read-only display */}
              <div className="divide-y divide-zinc-100">
                {paragraphs.map((p, idx) => (
                  <div key={idx} className="group">
                    {/* Paragraph row */}
                    <div className="flex gap-0">
                      {/* Gutter with paragraph number */}
                      <div className="w-12 flex-shrink-0 bg-zinc-50 border-r border-zinc-100 flex items-start justify-center pt-5">
                        <span className="text-amber-600/50 font-mono text-xs select-none">
                          {idx}
                        </span>
                      </div>
                      {/* Paragraph text */}
                      <div className="flex-1 px-6 py-4">
                        <p className="text-sm text-zinc-700 leading-relaxed whitespace-pre-wrap">
                          {p}
                        </p>
                      </div>
                    </div>

                    {/* Media moments at this position */}
                    {getMomentsAt(idx).map((m) => (
                      <div
                        key={m.id}
                        className="ml-12 mr-6 mb-2 flex items-center gap-3 bg-amber-50 border border-amber-200/60 rounded-lg px-4 py-3"
                      >
                        <Badge className={
                          m.mediaType === "music" ? "bg-purple-100 text-purple-700 border-purple-200" :
                          m.mediaType === "audio" ? "bg-blue-100 text-blue-700 border-blue-200" :
                          m.mediaType === "video" ? "bg-red-100 text-red-700 border-red-200" :
                          "bg-green-100 text-green-700 border-green-200"
                        }>
                          {m.mediaType}
                        </Badge>
                        <span className="text-sm font-medium text-zinc-800 flex-1">{m.title}</span>
                        {m.isExclusive && (
                          <Badge variant="outline" className="border-amber-400/50 text-amber-700 text-xs">
                            Exclusivo
                          </Badge>
                        )}
                        <button
                          onClick={() => handleDeleteMoment(m.id)}
                          className="text-zinc-400 hover:text-red-500 text-xs"
                        >
                          ✕
                        </button>
                      </div>
                    ))}

                    {/* Insert media moment button */}
                    {addingAt === idx ? (
                      <div className="ml-12 mr-6 mb-3 bg-zinc-50 border border-zinc-200 rounded-lg p-4 space-y-3">
                        <div className="flex gap-3">
                          <div className="flex-1">
                            <Label className="text-xs text-zinc-500">Tipo</Label>
                            <Select value={newType} onValueChange={(v) => setNewType(v as MediaType)}>
                              <SelectTrigger className="bg-white border-zinc-300 text-zinc-900">
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
                            <Label className="text-xs text-zinc-500">Estilo</Label>
                            <Select value={newDisplay} onValueChange={(v) => setNewDisplay(v as DisplayStyle)}>
                              <SelectTrigger className="bg-white border-zinc-300 text-zinc-900">
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
                          <Label className="text-xs text-zinc-500">Titulo</Label>
                          <Input
                            value={newTitle}
                            onChange={(e) => setNewTitle(e.target.value)}
                            placeholder="Nombre del contenido"
                            className="bg-white border-zinc-300 text-zinc-900"
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-zinc-500">URL del media</Label>
                          <Input
                            value={newUrl}
                            onChange={(e) => setNewUrl(e.target.value)}
                            placeholder="https://..."
                            className="bg-white border-zinc-300 text-zinc-900"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={newExclusive}
                            onCheckedChange={setNewExclusive}
                          />
                          <Label className="text-xs text-zinc-600">Exclusivo (bloqueado hasta completar capitulo)</Label>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" onClick={handleAddMoment} className="bg-amber-600 hover:bg-amber-700 text-white">
                            Guardar
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setAddingAt(null)} className="text-zinc-600">
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="ml-12 my-0.5">
                        <button
                          onClick={() => setAddingAt(idx)}
                          className="text-xs text-zinc-300 hover:text-amber-600 opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity px-2 py-1"
                        >
                          + Insertar media aqui
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Full-screen text editor modal */}
      {showTextEditor && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[90vh] flex flex-col">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200">
              <div>
                <h3 className="text-lg font-bold text-zinc-900">Editar texto del capitulo</h3>
                <p className="text-sm text-zinc-500">
                  Separa los parrafos con lineas en blanco. El texto se guarda tal cual en Firestore.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  onClick={() => setShowTextEditor(false)}
                  className="text-zinc-600"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleSaveText}
                  disabled={savingText}
                  className="bg-amber-600 hover:bg-amber-700 text-white"
                >
                  {savingText ? "Guardando..." : "Guardar cambios"}
                </Button>
              </div>
            </div>

            {/* Single large textarea */}
            <div className="flex-1 p-6 overflow-hidden">
              <textarea
                value={editableBody}
                onChange={(e) => setEditableBody(e.target.value)}
                className="w-full h-full bg-zinc-50 border border-zinc-200 rounded-xl px-6 py-5 text-sm text-zinc-800 leading-relaxed resize-none focus:outline-none focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20 transition-colors font-serif"
                placeholder="Escribe el contenido del capitulo..."
                spellCheck={false}
              />
            </div>

            {/* Modal footer with stats */}
            <div className="px-6 py-3 border-t border-zinc-200 flex items-center justify-between text-xs text-zinc-400">
              <span>
                {editableBody.split("\n\n").filter((p) => p.trim()).length} parrafos
                · {editableBody.length} caracteres
              </span>
              <span>
                Los parrafos se separan con una linea en blanco
              </span>
            </div>
          </div>
        </div>
      )}
    </AuthGuard>
  );
}
