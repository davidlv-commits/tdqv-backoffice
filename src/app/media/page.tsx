"use client";

import { useEffect, useState } from "react";
import { AuthGuard } from "@/components/auth-guard";
import { Sidebar } from "@/components/sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getBooks,
  getChapters,
  getMediaMoments,
  saveMediaMoment,
  updateMediaMoment,
  deleteMediaMoment,
} from "@/lib/firestore";
import type {
  Book,
  Chapter,
  MediaMoment,
  MediaType,
  DisplayStyle,
} from "@/lib/types";

export default function MediaPage() {
  const [books, setBooks] = useState<Book[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [moments, setMoments] = useState<MediaMoment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMoments, setLoadingMoments] = useState(false);

  // Filters
  const [selectedBook, setSelectedBook] = useState<string>("");
  const [selectedChapter, setSelectedChapter] = useState<string>("");

  // New moment form
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    paragraphIndex: 0,
    mediaType: "music" as MediaType,
    mediaId: "",
    title: "",
    mediaUrl: "",
    isExclusive: true,
    displayStyle: "inline" as DisplayStyle,
    unlockMessage: "",
    order: 0,
    active: true,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getBooks()
      .then((b) => {
        setBooks(b);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Load chapters when book changes
  useEffect(() => {
    if (!selectedBook) {
      setChapters([]);
      setSelectedChapter("");
      setMoments([]);
      return;
    }
    getChapters(selectedBook).then((c) => {
      setChapters(c);
      setSelectedChapter("");
      setMoments([]);
    });
  }, [selectedBook]);

  // Load moments when chapter changes
  useEffect(() => {
    if (!selectedBook || !selectedChapter) {
      setMoments([]);
      return;
    }
    setLoadingMoments(true);
    getMediaMoments(selectedBook, selectedChapter)
      .then((m) => {
        setMoments(m);
        setLoadingMoments(false);
      })
      .catch(() => setLoadingMoments(false));
  }, [selectedBook, selectedChapter]);

  const handleCreate = async () => {
    if (!selectedBook || !selectedChapter || !formData.title) return;
    setSaving(true);
    try {
      await saveMediaMoment({
        bookId: selectedBook,
        chapterId: selectedChapter,
        paragraphIndex: formData.paragraphIndex,
        mediaType: formData.mediaType,
        mediaId:
          formData.mediaId ||
          formData.title.toLowerCase().replace(/\s+/g, "-"),
        title: formData.title,
        mediaUrl: formData.mediaUrl,
        isExclusive: formData.isExclusive,
        displayStyle: formData.displayStyle,
        unlockMessage: formData.isExclusive
          ? formData.unlockMessage ||
            "Podras acceder a este contenido tras leer el capitulo"
          : undefined,
        order: formData.order,
        active: formData.active,
      });
      // Reload moments
      const m = await getMediaMoments(selectedBook, selectedChapter);
      setMoments(m);
      setShowForm(false);
      setFormData({
        paragraphIndex: 0,
        mediaType: "music",
        mediaId: "",
        title: "",
        mediaUrl: "",
        isExclusive: true,
        displayStyle: "inline",
        unlockMessage: "",
        order: 0,
        active: true,
      });
    } catch (e) {
      console.error("Error creating media moment:", e);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Eliminar este media moment?")) return;
    await deleteMediaMoment(id);
    setMoments((prev) => prev.filter((m) => m.id !== id));
  };

  const handleToggleActive = async (id: string, active: boolean) => {
    await updateMediaMoment(id, { active });
    setMoments((prev) =>
      prev.map((m) => (m.id === id ? { ...m, active } : m))
    );
  };

  const mediaTypeLabel = (t: MediaType) => {
    const labels: Record<MediaType, string> = {
      music: "Musica",
      audio: "Audio",
      video: "Video",
      image: "Imagen",
    };
    return labels[t];
  };

  const mediaTypeColor = (t: MediaType) => {
    const colors: Record<MediaType, string> = {
      music: "bg-purple-500/20 text-purple-400",
      audio: "bg-blue-500/20 text-blue-400",
      video: "bg-red-500/20 text-red-400",
      image: "bg-green-500/20 text-green-400",
    };
    return colors[t];
  };

  return (
    <AuthGuard>
      <div className="flex h-screen">
        <Sidebar />
        <main className="flex-1 overflow-auto bg-slate-50 p-8">
          <h2 className="text-2xl font-bold text-zinc-900 mb-6">Gestion de media</h2>

          {loading ? (
            <p className="text-zinc-500">Cargando...</p>
          ) : (
            <>
              {/* Filters */}
              <div className="flex gap-4 mb-6">
                <div className="w-64">
                  <Label className="text-xs text-zinc-400 mb-1 block">
                    Libro
                  </Label>
                  <Select
                    value={selectedBook}
                    onValueChange={(v) => setSelectedBook(v ?? "")}
                  >
                    <SelectTrigger className="bg-white border-zinc-300 text-zinc-900">
                      <SelectValue placeholder="Selecciona un libro" />
                    </SelectTrigger>
                    <SelectContent>
                      {books.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedBook && chapters.length > 0 && (
                  <div className="w-80">
                    <Label className="text-xs text-zinc-400 mb-1 block">
                      Capitulo
                    </Label>
                    <Select
                      value={selectedChapter}
                      onValueChange={(v) => setSelectedChapter(v ?? "")}
                    >
                      <SelectTrigger className="bg-white border-zinc-300 text-zinc-900">
                        <SelectValue placeholder="Selecciona un capitulo" />
                      </SelectTrigger>
                      <SelectContent>
                        {chapters.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.order}. {c.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {/* Content area */}
              {!selectedBook ? (
                <div className="bg-white border border-zinc-200 rounded-xl shadow-sm p-8 text-center">
                  <p className="text-zinc-600 mb-2">
                    Selecciona un libro para ver los media moments
                  </p>
                  <p className="text-sm text-zinc-400">
                    Los media moments son contenido multimedia que se inserta
                    entre los parrafos de los capitulos.
                  </p>
                </div>
              ) : !selectedChapter ? (
                <div className="bg-white border border-zinc-200 rounded-xl shadow-sm p-8 text-center">
                  <p className="text-zinc-600">
                    Selecciona un capitulo para ver sus media moments
                  </p>
                </div>
              ) : (
                <>
                  {/* Action bar */}
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-sm text-zinc-500">
                      {loadingMoments
                        ? "Cargando..."
                        : `${moments.length} media moment${moments.length !== 1 ? "s" : ""}`}
                    </p>
                    <Button
                      onClick={() => setShowForm(!showForm)}
                      className="bg-amber-600 hover:bg-amber-700"
                      size="sm"
                    >
                      {showForm ? "Cancelar" : "+ Nuevo media moment"}
                    </Button>
                  </div>

                  {/* New moment form */}
                  {showForm && (
                    <div className="bg-white border border-zinc-200 rounded-xl shadow-sm p-5 mb-6 space-y-4">
                      <h3 className="font-semibold text-sm text-zinc-700">
                        Crear nuevo media moment
                      </h3>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <Label className="text-xs text-zinc-500">Tipo</Label>
                          <Select
                            value={formData.mediaType}
                            onValueChange={(v) =>
                              v && setFormData((p) => ({
                                ...p,
                                mediaType: v as MediaType,
                              }))
                            }
                          >
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
                        <div>
                          <Label className="text-xs text-zinc-500">
                            Estilo de display
                          </Label>
                          <Select
                            value={formData.displayStyle}
                            onValueChange={(v) =>
                              v && setFormData((p) => ({
                                ...p,
                                displayStyle: v as DisplayStyle,
                              }))
                            }
                          >
                            <SelectTrigger className="bg-white border-zinc-300 text-zinc-900">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="inline">Inline</SelectItem>
                              <SelectItem value="fullscreen">
                                Fullscreen
                              </SelectItem>
                              <SelectItem value="ambient">Ambient</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs text-zinc-500">
                            Indice del parrafo (0-based)
                          </Label>
                          <Input
                            type="number"
                            value={formData.paragraphIndex}
                            onChange={(e) =>
                              setFormData((p) => ({
                                ...p,
                                paragraphIndex:
                                  parseInt(e.target.value) || 0,
                              }))
                            }
                            className="bg-white border-zinc-300 text-zinc-900"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label className="text-xs text-zinc-500">
                            Titulo
                          </Label>
                          <Input
                            value={formData.title}
                            onChange={(e) =>
                              setFormData((p) => ({
                                ...p,
                                title: e.target.value,
                              }))
                            }
                            placeholder="Nombre del contenido"
                            className="bg-white border-zinc-300 text-zinc-900"
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-zinc-500">
                            Media ID (opcional, se genera del titulo)
                          </Label>
                          <Input
                            value={formData.mediaId}
                            onChange={(e) =>
                              setFormData((p) => ({
                                ...p,
                                mediaId: e.target.value,
                              }))
                            }
                            placeholder="ej: track_01"
                            className="bg-white border-zinc-300 text-zinc-900"
                          />
                        </div>
                      </div>

                      <div>
                        <Label className="text-xs text-zinc-500">
                          URL del media
                        </Label>
                        <Input
                          value={formData.mediaUrl}
                          onChange={(e) =>
                            setFormData((p) => ({
                              ...p,
                              mediaUrl: e.target.value,
                            }))
                          }
                          placeholder="https://..."
                          className="bg-white border-zinc-300 text-zinc-900"
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label className="text-xs text-zinc-500">Orden</Label>
                          <Input
                            type="number"
                            value={formData.order}
                            onChange={(e) =>
                              setFormData((p) => ({
                                ...p,
                                order: parseInt(e.target.value) || 0,
                              }))
                            }
                            className="bg-white border-zinc-300 text-zinc-900"
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-zinc-500">
                            Mensaje de desbloqueo (solo si exclusivo)
                          </Label>
                          <Input
                            value={formData.unlockMessage}
                            onChange={(e) =>
                              setFormData((p) => ({
                                ...p,
                                unlockMessage: e.target.value,
                              }))
                            }
                            placeholder="Texto que ve el usuario bloqueado"
                            className="bg-white border-zinc-300 text-zinc-900"
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={formData.isExclusive}
                            onCheckedChange={(v) =>
                              setFormData((p) => ({
                                ...p,
                                isExclusive: v,
                              }))
                            }
                          />
                          <Label className="text-xs text-zinc-500">
                            Exclusivo (bloqueado hasta completar capitulo)
                          </Label>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={formData.active}
                            onCheckedChange={(v) =>
                              setFormData((p) => ({ ...p, active: v }))
                            }
                          />
                          <Label className="text-xs text-zinc-500">
                            Activo
                          </Label>
                        </div>
                      </div>

                      <div className="flex gap-2 pt-2">
                        <Button
                          onClick={handleCreate}
                          disabled={saving || !formData.title}
                          className="bg-amber-600 hover:bg-amber-700"
                        >
                          {saving ? "Guardando..." : "Crear media moment"}
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => setShowForm(false)}
                        >
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Moments list */}
                  {!loadingMoments && moments.length === 0 && !showForm && (
                    <div className="bg-white border border-zinc-200 rounded-xl shadow-sm p-8 text-center">
                      <p className="text-zinc-400 mb-2">
                        Este capitulo no tiene media moments
                      </p>
                      <p className="text-sm text-zinc-600">
                        Crea uno con el boton de arriba, o ve al editor del
                        capitulo para insertarlos entre parrafos.
                      </p>
                    </div>
                  )}

                  {moments.length > 0 && (
                    <div className="space-y-2">
                      {moments.map((m) => (
                        <div
                          key={m.id}
                          className={`flex items-center gap-4 bg-white border rounded-lg px-5 py-4 ${
                            m.active
                              ? "border-zinc-200"
                              : "border-zinc-200 opacity-60"
                          }`}
                        >
                          <span className="text-amber-500/60 font-mono text-sm w-8">
                            P{m.paragraphIndex}
                          </span>
                          <Badge className={mediaTypeColor(m.mediaType)}>
                            {mediaTypeLabel(m.mediaType)}
                          </Badge>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-zinc-900 truncate">{m.title}</p>
                            <p className="text-xs text-zinc-400 truncate">
                              {m.mediaUrl || "Sin URL"}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <Badge
                              variant="outline"
                              className="border-zinc-700 text-zinc-400 text-xs"
                            >
                              {m.displayStyle}
                            </Badge>
                            {m.isExclusive && (
                              <Badge
                                variant="outline"
                                className="border-amber-500/30 text-amber-500 text-xs"
                              >
                                Exclusivo
                              </Badge>
                            )}
                            <Switch
                              checked={m.active}
                              onCheckedChange={(v) =>
                                handleToggleActive(m.id, v)
                              }
                            />
                            <button
                              onClick={() => handleDelete(m.id)}
                              className="text-zinc-600 hover:text-red-400 text-xs ml-2"
                            >
                              Eliminar
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </main>
      </div>
    </AuthGuard>
  );
}
