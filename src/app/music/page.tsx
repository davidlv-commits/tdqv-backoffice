"use client";

import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { AuthGuard } from "@/components/auth-guard";
import { Sidebar } from "@/components/sidebar";
import { uploadFile } from "@/lib/upload";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { getTracks, saveTrack, deleteTrack, getBooks, getChapters } from "@/lib/firestore";
import type { Track, Chapter, Book } from "@/lib/types";
import { addDoc, collection, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

// Chapter with book info for display
interface ChapterOption {
  id: string;
  bookId: string;
  bookTitle: string;
  bookNumber: number; // 1 or 2
  order: number;
  title: string;
  label: string; // "Libro I . Cap 6 . El encuentro"
}

const DEFAULT_STYLES = ["Pop", "Rock", "Balada", "Jazz", "Instrumental", "Acustico", "Flamenco"];

export default function MusicPage() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<Track>>({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Chapters for association
  const [chapterOptions, setChapterOptions] = useState<ChapterOption[]>([]);

  // Album collapse state
  const [collapsedAlbums, setCollapsedAlbums] = useState<Set<string>>(new Set());

  // File picker refs for edit form
  const editAudioRef = useRef<HTMLInputElement>(null);
  const editCoverRef = useRef<HTMLInputElement>(null);
  const [editAudioFile, setEditAudioFile] = useState<File | null>(null);
  const [editCoverFile, setEditCoverFile] = useState<File | null>(null);

  // New track form
  const [showNewForm, setShowNewForm] = useState(false);
  const [newTrack, setNewTrack] = useState<Partial<Track>>({
    title: "",
    artist: "",
    album: "",
    audioUrl: "",
    coverUrl: "",
    order: 0,
    isInstrumental: false,
    active: true,
    style: "",
    lyrics: "",
    lockedUntilChapter: "",
    lockedUntilChapterTitle: "",
    isLockedByChapter: false,
  });
  const [creatingTrack, setCreatingTrack] = useState(false);
  const newAudioRef = useRef<HTMLInputElement>(null);
  const newCoverRef = useRef<HTMLInputElement>(null);
  const [newAudioFile, setNewAudioFile] = useState<File | null>(null);
  const [newCoverFile, setNewCoverFile] = useState<File | null>(null);

  // Load tracks
  useEffect(() => {
    getTracks()
      .then((t) => {
        setTracks(t);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Load chapters from both books
  useEffect(() => {
    async function loadChapters() {
      try {
        const books = await getBooks();
        const allOptions: ChapterOption[] = [];

        for (const book of books) {
          const bookNum = book.id === "book1" ? 1 : book.id === "book2" ? 2 : parseInt(book.id.replace("book", "")) || 0;
          const romanNum = bookNum === 1 ? "I" : bookNum === 2 ? "II" : `${bookNum}`;
          const chapters = await getChapters(book.id);
          for (const ch of chapters) {
            allOptions.push({
              id: ch.id,
              bookId: book.id,
              bookTitle: book.title,
              bookNumber: bookNum,
              order: ch.order,
              title: ch.title,
              label: `Libro ${romanNum} \u00B7 Cap ${ch.order} \u00B7 ${ch.title}`,
            });
          }
        }

        allOptions.sort((a, b) => a.bookNumber - b.bookNumber || a.order - b.order);
        setChapterOptions(allOptions);
      } catch (e) {
        console.error("Error loading chapters:", e);
      }
    }
    loadChapters();
  }, []);

  // Compute unique albums and styles from existing tracks
  const existingAlbums = useMemo(() => {
    const albums = new Set<string>();
    for (const t of tracks) {
      if (t.album) albums.add(t.album);
    }
    return Array.from(albums).sort();
  }, [tracks]);

  const existingStyles = useMemo(() => {
    const styles = new Set<string>(DEFAULT_STYLES);
    for (const t of tracks) {
      if (t.style) styles.add(t.style);
    }
    return Array.from(styles).sort();
  }, [tracks]);

  // Group tracks by album
  const albumGroups = useMemo(() => {
    const groups: Record<string, Track[]> = {};
    for (const track of tracks) {
      const album = track.album || "Sin album";
      if (!groups[album]) groups[album] = [];
      groups[album].push(track);
    }
    const sorted = Object.entries(groups).sort(([a], [b]) => {
      const aIsInstr = a.toLowerCase().includes("instrumental");
      const bIsInstr = b.toLowerCase().includes("instrumental");
      if (aIsInstr && !bIsInstr) return 1;
      if (!aIsInstr && bIsInstr) return -1;
      return a.localeCompare(b);
    });
    return sorted;
  }, [tracks]);

  const toggleAlbum = (album: string) => {
    setCollapsedAlbums((prev) => {
      const next = new Set(prev);
      if (next.has(album)) {
        next.delete(album);
      } else {
        next.add(album);
      }
      return next;
    });
  };

  const handleExpand = (track: Track) => {
    if (expandedId === track.id) {
      setExpandedId(null);
      setEditData({});
      setEditAudioFile(null);
      setEditCoverFile(null);
    } else {
      setExpandedId(track.id);
      setEditData({
        title: track.title,
        artist: track.artist,
        album: track.album,
        audioUrl: track.audioUrl,
        coverUrl: track.coverUrl,
        isInstrumental: track.isInstrumental,
        active: track.active,
        order: track.order,
        lyrics: track.lyrics || "",
        linkedMainTrackId: track.linkedMainTrackId || "",
        style: track.style || "",
        lockedUntilChapter: track.lockedUntilChapter || "",
        lockedUntilChapterTitle: track.lockedUntilChapterTitle || "",
        isLockedByChapter: track.isLockedByChapter || false,
      });
      setEditAudioFile(null);
      setEditCoverFile(null);
    }
  };

  const handleSave = async () => {
    if (!expandedId) return;
    // Esperar a que terminen los uploads en curso.
    if (uploadingAudio || uploadingCover) {
      setSaveMsg("Esperando a que termine la subida...");
      return;
    }
    setSaving(true);
    try {
      const dataToSave: Partial<Track> & { id: string } = {
        id: expandedId,
        ...editData,
      };
      if (!dataToSave.lyrics) delete dataToSave.lyrics;
      if (!dataToSave.linkedMainTrackId) delete dataToSave.linkedMainTrackId;
      if (!dataToSave.style) delete dataToSave.style;
      if (!dataToSave.lockedUntilChapter) {
        delete dataToSave.lockedUntilChapter;
        delete dataToSave.lockedUntilChapterTitle;
        dataToSave.isLockedByChapter = false;
      }

      await saveTrack(dataToSave);
      // Actualizar la lista con los datos guardados.
      const savedData = { ...editData };
      setTracks((prev) =>
        prev.map((t) => (t.id === expandedId ? { ...t, ...savedData } : t))
      );
      // Refrescar editData para que la preview use coverUrl de R2.
      setEditData(savedData);
      setEditAudioFile(null);
      // Solo borrar coverFile si ya tenemos la URL de R2.
      if (savedData.coverUrl) setEditCoverFile(null);
      setSaveMsg("Guardado ✓");
      setTimeout(() => setSaveMsg(""), 2000);
    } catch (e) {
      console.error("Error saving track:", e);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Seguro que quieres eliminar este track?")) return;
    setDeleting(id);
    try {
      await deleteTrack(id);
      setTracks((prev) => prev.filter((t) => t.id !== id));
      if (expandedId === id) {
        setExpandedId(null);
        setEditData({});
      }
    } catch (e) {
      console.error("Error deleting track:", e);
    } finally {
      setDeleting(null);
    }
  };

  const handleCreateTrack = async () => {
    if (!newTrack.title) return;
    setCreatingTrack(true);
    try {
      const docData: Record<string, unknown> = {
        title: newTrack.title,
        artist: newTrack.artist || "",
        album: newTrack.album || "",
        audioUrl: newTrack.audioUrl || "",
        coverUrl: newTrack.coverUrl || "",
        order: newTrack.order || 0,
        isInstrumental: newTrack.isInstrumental || false,
        active: newTrack.active ?? true,
        style: newTrack.style || "",
        lyrics: newTrack.lyrics || "",
        createdAt: Timestamp.now(),
      };
      if (newTrack.isLockedByChapter && newTrack.lockedUntilChapter) {
        docData.lockedUntilChapter = newTrack.lockedUntilChapter;
        docData.lockedUntilChapterTitle = newTrack.lockedUntilChapterTitle || "";
        docData.isLockedByChapter = true;
      }

      const docRef = await addDoc(collection(db, "tracks"), docData);
      const created: Track = {
        id: docRef.id,
        title: newTrack.title || "",
        artist: newTrack.artist || "",
        album: newTrack.album || "",
        audioUrl: newTrack.audioUrl || "",
        coverUrl: newTrack.coverUrl || "",
        order: newTrack.order || 0,
        isInstrumental: newTrack.isInstrumental || false,
        active: newTrack.active ?? true,
        style: newTrack.style || "",
        lyrics: newTrack.lyrics || "",
        lockedUntilChapter: newTrack.lockedUntilChapter || "",
        lockedUntilChapterTitle: newTrack.lockedUntilChapterTitle || "",
        isLockedByChapter: newTrack.isLockedByChapter || false,
      };
      setTracks((prev) => [...prev, created].sort((a, b) => a.order - b.order));
      setShowNewForm(false);
      setNewTrack({
        title: "",
        artist: "",
        album: "",
        audioUrl: "",
        coverUrl: "",
        order: 0,
        isInstrumental: false,
        active: true,
        style: "",
        lyrics: "",
        lockedUntilChapter: "",
        lockedUntilChapterTitle: "",
        isLockedByChapter: false,
      });
      setNewAudioFile(null);
      setNewCoverFile(null);
    } catch (e) {
      console.error("Error creating track:", e);
    } finally {
      setCreatingTrack(false);
    }
  };

  const updateField = <K extends keyof Track>(key: K, value: Track[K]) => {
    setEditData((prev) => ({ ...prev, [key]: value }));
  };

  // Helper: handle chapter selection for edit form
  const handleEditChapterChange = (chapterId: string) => {
    const chapter = chapterOptions.find((c) => c.id === chapterId);
    setEditData((prev) => ({
      ...prev,
      lockedUntilChapter: chapterId,
      lockedUntilChapterTitle: chapter?.label || "",
    }));
  };

  // Helper: handle chapter selection for new form
  const handleNewChapterChange = (chapterId: string) => {
    const chapter = chapterOptions.find((c) => c.id === chapterId);
    setNewTrack((prev) => ({
      ...prev,
      lockedUntilChapter: chapterId,
      lockedUntilChapterTitle: chapter?.label || "",
    }));
  };

  // ---- Shared form section renderers ----

  function renderBasicInfoSection(
    data: Partial<Track>,
    setField: (key: keyof Track, value: string | number | boolean) => void,
    albumListId: string,
    styleListId: string
  ) {
    return (
      <div>
        <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">
          Informacion basica
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="text-xs text-zinc-500">Titulo *</Label>
            <Input
              value={data.title || ""}
              onChange={(e) => setField("title", e.target.value)}
              placeholder="Nombre de la cancion"
              className="bg-white border-zinc-300 text-zinc-900"
            />
          </div>
          <div>
            <Label className="text-xs text-zinc-500">Artista</Label>
            <Input
              value={data.artist || ""}
              onChange={(e) => setField("artist", e.target.value)}
              placeholder="David Bello"
              className="bg-white border-zinc-300 text-zinc-900"
            />
          </div>
          <div>
            <Label className="text-xs text-zinc-500">Album</Label>
            <Input
              list={albumListId}
              value={data.album || ""}
              onChange={(e) => setField("album", e.target.value)}
              placeholder="Escribe o selecciona un album"
              className="bg-white border-zinc-300 text-zinc-900"
            />
            <datalist id={albumListId}>
              {existingAlbums.map((a) => (
                <option key={a} value={a} />
              ))}
            </datalist>
          </div>
          <div>
            <Label className="text-xs text-zinc-500">Estilo / Genero</Label>
            <Input
              list={styleListId}
              value={(data.style as string) || ""}
              onChange={(e) => setField("style", e.target.value)}
              placeholder="Escribe o selecciona un estilo"
              className="bg-white border-zinc-300 text-zinc-900"
            />
            <datalist id={styleListId}>
              {existingStyles.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>
          <div>
            <Label className="text-xs text-zinc-500">Orden</Label>
            <Input
              type="number"
              value={data.order ?? 0}
              onChange={(e) => setField("order", parseInt(e.target.value) || 0)}
              className="bg-white border-zinc-300 text-zinc-900"
            />
          </div>
        </div>
      </div>
    );
  }

  const [uploadingAudio, setUploadingAudio] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  function renderFilesSection(
    data: Partial<Track>,
    audioFile: File | null,
    coverFile: File | null,
    audioInputRef: React.RefObject<HTMLInputElement | null>,
    coverInputRef: React.RefObject<HTMLInputElement | null>,
    onAudioSelect: (file: File | null) => void,
    onCoverSelect: (file: File | null) => void,
    onFieldChange?: (key: string, value: string) => void
  ) {
    const handleAudioUpload = async (file: File) => {
      setUploadingAudio(true);
      try {
        const url = await uploadFile(file, "tu-de-que-vas");
        setEditData(prev => ({...prev, audioUrl: url}));
        setNewTrack(prev => ({...prev, audioUrl: url}));
        onAudioSelect(null);
      } catch (e) {
        console.error("Audio upload error:", e);
      } finally {
        setUploadingAudio(false);
      }
    };

    const handleCoverUpload = async (file: File) => {
      onCoverSelect(file);
      setUploadingCover(true);
      try {
        const url = await uploadFile(file, "covers");
        setEditData(prev => ({...prev, coverUrl: url}));
        setNewTrack(prev => ({...prev, coverUrl: url}));
      } catch (e) {
        console.error("Cover upload error:", e);
      } finally {
        setUploadingCover(false);
      }
    };

    return (
      <div>
        <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">Archivos</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Audio */}
          <div>
            <Label className="text-xs text-zinc-500 mb-2 block">Audio</Label>
            <div className="bg-white border border-zinc-200 rounded-lg p-4 space-y-3">
              {data.audioUrl && (
                <div>
                  <span className="text-green-600 text-sm font-medium">Audio cargado ✓</span>
                  <audio controls src={data.audioUrl} className="w-full h-8 mt-2" preload="none" />
                </div>
              )}
              <input ref={audioInputRef} type="file" accept=".m4a,.mp3,audio/mpeg,audio/mp4" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleAudioUpload(f); }} />
              <button type="button" onClick={() => audioInputRef.current?.click()} disabled={uploadingAudio}
                className="w-full border-2 border-dashed border-zinc-300 rounded-lg py-3 px-4 text-sm text-zinc-500 hover:border-amber-400 hover:text-amber-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
                {uploadingAudio ? "Subiendo..." : data.audioUrl ? "Cambiar audio" : "Subir audio (.m4a, .mp3)"}
              </button>
            </div>
          </div>

          {/* Portada */}
          <div>
            <Label className="text-xs text-zinc-500 mb-2 block">Portada</Label>
            <div className="bg-white border border-zinc-200 rounded-lg p-4">
              <input ref={coverInputRef} type="file" accept="image/*" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleCoverUpload(f); }} />
              <button type="button" onClick={() => coverInputRef.current?.click()} disabled={uploadingCover}
                className="relative group">
                {(data.coverUrl || coverFile) ? (
                  <div className="relative">
                    <img src={coverFile ? URL.createObjectURL(coverFile) : (data.coverUrl || "")} alt="Portada" className="w-[120px] h-[120px] rounded-lg object-cover" />
                    <div className="absolute inset-0 bg-black/40 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <span className="text-white text-xs font-medium">Cambiar</span>
                    </div>
                  </div>
                ) : (
                  <div className="w-[120px] h-[120px] rounded-lg border-2 border-dashed border-zinc-300 flex flex-col items-center justify-center hover:border-amber-400 hover:text-amber-600 transition-colors text-zinc-400">
                    {uploadingCover ? (
                      <span className="text-xs">Subiendo...</span>
                    ) : (
                      <>
                        <svg className="w-6 h-6 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5a2.25 2.25 0 002.25-2.25V6.75a2.25 2.25 0 00-2.25-2.25H3.75A2.25 2.25 0 001.5 6.75v10.5A2.25 2.25 0 003.75 21z" />
                        </svg>
                        <span className="text-xs">Subir portada</span>
                      </>
                    )}
                  </div>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  function renderChapterSection(
    data: Partial<Track>,
    onChapterChange: (chapterId: string) => void,
    onLockChange: (locked: boolean) => void
  ) {
    return (
      <div>
        <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">
          Capitulo
        </h4>
        <div className="bg-white border border-zinc-200 rounded-lg p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-zinc-500">Capitulo asociado</Label>
              <select
                value={data.lockedUntilChapter || ""}
                onChange={(e) => onChapterChange(e.target.value)}
                className="w-full h-9 rounded-md border border-zinc-300 bg-white text-zinc-900 text-sm px-3 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
              >
                <option value="">Sin capitulo asociado</option>
                {chapterOptions.map((ch) => (
                  <option key={`${ch.bookId}-${ch.id}`} value={ch.id}>
                    {ch.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-zinc-400 mt-1">
                Se rellena automaticamente al insertar media en el editor de capitulos.
              </p>
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer pb-1">
                <input
                  type="checkbox"
                  checked={data.isLockedByChapter || false}
                  onChange={(e) => onLockChange(e.target.checked)}
                  disabled={!data.lockedUntilChapter}
                  className="w-4 h-4 rounded border-zinc-300 text-amber-600 focus:ring-amber-500 disabled:opacity-40"
                />
                <span className={`text-xs font-medium ${data.lockedUntilChapter ? "text-zinc-700" : "text-zinc-400"}`}>
                  Bloquear hasta leer el capitulo
                </span>
              </label>
            </div>
          </div>
          {data.isLockedByChapter && data.lockedUntilChapter && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-xs text-amber-700">
                Mensaje al usuario: &quot;Para escuchar esta cancion necesitas leer el capitulo{" "}
                <strong>{data.lockedUntilChapterTitle || data.lockedUntilChapter}</strong>&quot;
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  function renderLyricsSection(
    data: Partial<Track>,
    setField: (key: keyof Track, value: string | number | boolean) => void
  ) {
    return (
      <div>
        <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">
          Letra
        </h4>
        <Textarea
          value={(data.lyrics as string) || ""}
          onChange={(e) => setField("lyrics", e.target.value)}
          placeholder="Escribe la letra de la cancion..."
          className="bg-white border-zinc-300 text-zinc-900 font-mono text-sm min-h-[200px] p-4"
          style={{ minHeight: "200px" }}
        />
        <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-xs text-blue-700">
            <strong>Formato LRC para letras sincronizadas:</strong>{" "}
            <code className="bg-blue-100 px-1 rounded">
              [00:12.34] Linea de la letra
            </code>
          </p>
          <p className="text-xs text-blue-600 mt-1">
            Cada linea empieza con el timestamp entre corchetes [mm:ss.cc] seguido del texto.
          </p>
        </div>
      </div>
    );
  }

  function renderStatusSection(
    data: Partial<Track>,
    setField: (key: keyof Track, value: string | number | boolean) => void
  ) {
    return (
      <div>
        <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">
          Estado
        </h4>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Switch
              checked={data.active || false}
              onCheckedChange={(v) => setField("active", v)}
            />
            <Label className="text-xs text-zinc-600">Activo</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={data.isInstrumental || false}
              onCheckedChange={(v) => setField("isInstrumental", v)}
            />
            <Label className="text-xs text-zinc-600">Instrumental</Label>
          </div>
        </div>
      </div>
    );
  }

  return (
    <AuthGuard>
      <div className="flex h-screen">
        <Sidebar />
        <main className="flex-1 overflow-auto bg-slate-50 p-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-zinc-900">
              Gestion de musica
            </h2>
            <Button
              onClick={() => setShowNewForm(!showNewForm)}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {showNewForm ? "Cancelar" : "+ Subir nueva cancion"}
            </Button>
          </div>

          {/* New track form */}
          {showNewForm && (
            <div className="bg-white border border-zinc-200 rounded-xl shadow-sm p-5 mb-6 space-y-6">
              <h3 className="font-semibold text-sm text-zinc-700">
                Nueva cancion
              </h3>

              {/* 1. Basic info */}
              {renderBasicInfoSection(
                newTrack,
                (key, val) => setNewTrack((p) => ({ ...p, [key]: val })),
                "new-album-list",
                "new-style-list"
              )}

              {/* 2. Files */}
              {renderFilesSection(
                newTrack,
                newAudioFile,
                newCoverFile,
                newAudioRef,
                newCoverRef,
                setNewAudioFile,
                setNewCoverFile,
                (k, v) => setNewTrack(p => ({...p, [k]: v}))
              )}

              {/* 3. Chapter */}
              {renderChapterSection(
                newTrack,
                handleNewChapterChange,
                (locked) => setNewTrack((p) => ({ ...p, isLockedByChapter: locked }))
              )}

              {/* 4. Lyrics */}
              {renderLyricsSection(
                newTrack,
                (key, val) => setNewTrack((p) => ({ ...p, [key]: val }))
              )}

              {/* 5. Status */}
              {renderStatusSection(
                newTrack,
                (key, val) => setNewTrack((p) => ({ ...p, [key]: val }))
              )}

              <div className="flex gap-2 pt-2">
                <Button
                  onClick={handleCreateTrack}
                  disabled={creatingTrack || !newTrack.title}
                  className="bg-amber-600 hover:bg-amber-700"
                >
                  {creatingTrack ? "Creando..." : "Crear cancion"}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setShowNewForm(false)}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          )}

          {loading ? (
            <p className="text-zinc-500">Cargando tracks...</p>
          ) : tracks.length === 0 ? (
            <div className="bg-white border border-zinc-200 rounded-xl p-8 text-center shadow-sm">
              <p className="text-zinc-600 mb-2">No hay tracks en Firestore</p>
              <p className="text-sm text-zinc-400">
                Usa el boton de arriba para crear la primera cancion.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {albumGroups.map(([albumName, albumTracks]) => (
                <div key={albumName}>
                  {/* Album header */}
                  <button
                    onClick={() => toggleAlbum(albumName)}
                    className="flex items-center gap-3 mb-2 group w-full text-left"
                  >
                    <svg
                      className={`w-4 h-4 text-zinc-400 transition-transform ${
                        collapsedAlbums.has(albumName) ? "-rotate-90" : ""
                      }`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                    <h3 className="text-sm font-semibold text-zinc-700 group-hover:text-zinc-900">
                      {albumName}
                    </h3>
                    <Badge
                      variant="outline"
                      className="text-zinc-400 border-zinc-300 text-xs"
                    >
                      {albumTracks.length} track
                      {albumTracks.length !== 1 ? "s" : ""}
                    </Badge>
                  </button>

                  {/* Album tracks */}
                  {!collapsedAlbums.has(albumName) && (
                    <div className="space-y-2">
                      {albumTracks.map((track) => (
                        <div key={track.id}>
                          {/* Track row */}
                          <div
                            onClick={() => handleExpand(track)}
                            className={`flex items-center gap-4 bg-white border rounded-lg px-5 py-4 cursor-pointer transition-all ${
                              expandedId === track.id
                                ? "border-amber-500/50 rounded-b-none shadow-sm"
                                : "border-zinc-200 hover:border-zinc-300 hover:shadow-sm"
                            }`}
                          >
                            <span className="text-amber-600/60 font-mono text-sm w-6">
                              {track.order}
                            </span>
                            {track.coverUrl && (
                              <img
                                src={track.coverUrl}
                                alt=""
                                className="w-10 h-10 rounded object-cover"
                              />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-zinc-900 truncate">
                                {track.title}
                              </p>
                              <p className="text-sm text-zinc-500 truncate">
                                {track.artist}
                                {track.style ? ` \u00B7 ${track.style}` : ""}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {track.isLockedByChapter && (
                                <Badge
                                  variant="outline"
                                  className="text-amber-500 border-amber-400/30"
                                >
                                  Bloqueado
                                </Badge>
                              )}
                              {track.isInstrumental && (
                                <Badge
                                  variant="outline"
                                  className="text-purple-400 border-purple-400/30"
                                >
                                  Instrumental
                                </Badge>
                              )}
                              {track.lyrics && (
                                <Badge
                                  variant="outline"
                                  className="text-blue-400 border-blue-400/30"
                                >
                                  Letra
                                </Badge>
                              )}
                              {track.active ? (
                                <Badge className="bg-green-500/20 text-green-400">
                                  Activo
                                </Badge>
                              ) : (
                                <Badge className="bg-zinc-700 text-zinc-400">
                                  Inactivo
                                </Badge>
                              )}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDelete(track.id);
                                }}
                                disabled={deleting === track.id}
                                className="text-zinc-600 hover:text-red-400 text-sm ml-2 disabled:opacity-50"
                              >
                                {deleting === track.id ? "..." : "Eliminar"}
                              </button>
                            </div>
                          </div>

                          {/* Expanded edit form */}
                          {expandedId === track.id && (
                            <div className="bg-zinc-50 border border-zinc-200 border-t-0 rounded-b-lg p-5 space-y-6">
                              {/* 1. Basic info */}
                              {renderBasicInfoSection(
                                editData,
                                updateField,
                                "edit-album-list",
                                "edit-style-list"
                              )}

                              {/* 2. Files */}
                              {renderFilesSection(
                                editData,
                                editAudioFile,
                                editCoverFile,
                                editAudioRef,
                                editCoverRef,
                                setEditAudioFile,
                                setEditCoverFile,
                                (k, v) => setEditData(p => ({...p, [k]: v}))
                              )}

                              {/* 3. Chapter */}
                              {renderChapterSection(
                                editData,
                                handleEditChapterChange,
                                (locked) => updateField("isLockedByChapter", locked)
                              )}

                              {/* 4. Lyrics */}
                              {renderLyricsSection(editData, updateField)}

                              {/* 5. Status */}
                              {renderStatusSection(editData, updateField)}

                              {/* Actions */}
                              <div className="flex gap-2 pt-2">
                                <Button
                                  onClick={handleSave}
                                  disabled={saving}
                                  className="bg-amber-600 hover:bg-amber-700"
                                >
                                  {saving
                                    ? "Guardando..."
                                    : "Guardar cambios"}
                                </Button>
                                {saveMsg && <span className="text-green-600 text-sm ml-2">{saveMsg}</span>}
                                <Button
                                  variant="ghost"
                                  onClick={() => {
                                    setExpandedId(null);
                                    setEditData({});
                                    setEditAudioFile(null);
                                    setEditCoverFile(null);
                                  }}
                                >
                                  Cancelar
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
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
