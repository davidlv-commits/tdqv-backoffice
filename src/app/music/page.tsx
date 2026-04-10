"use client";

import { useEffect, useState, useMemo } from "react";
import { AuthGuard } from "@/components/auth-guard";
import { Sidebar } from "@/components/sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { getTracks, saveTrack, deleteTrack } from "@/lib/firestore";
import type { Track } from "@/lib/types";
import { addDoc, collection, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function MusicPage() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<Track>>({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Album collapse state
  const [collapsedAlbums, setCollapsedAlbums] = useState<Set<string>>(new Set());

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
  });
  const [creatingTrack, setCreatingTrack] = useState(false);

  useEffect(() => {
    getTracks()
      .then((t) => {
        setTracks(t);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Group tracks by album
  const albumGroups = useMemo(() => {
    const groups: Record<string, Track[]> = {};
    for (const track of tracks) {
      const album = track.album || "Sin álbum";
      if (!groups[album]) groups[album] = [];
      groups[album].push(track);
    }
    // Sort albums: non-instrumental first, then instrumental
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
      });
    }
  };

  const handleSave = async () => {
    if (!expandedId) return;
    setSaving(true);
    try {
      const dataToSave: Partial<Track> & { id: string } = {
        id: expandedId,
        ...editData,
      };
      if (!dataToSave.lyrics) delete dataToSave.lyrics;
      if (!dataToSave.linkedMainTrackId) delete dataToSave.linkedMainTrackId;
      if (!dataToSave.style) delete dataToSave.style;

      await saveTrack(dataToSave);
      setTracks((prev) =>
        prev.map((t) => (t.id === expandedId ? { ...t, ...editData } : t))
      );
      setExpandedId(null);
      setEditData({});
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
      const docRef = await addDoc(collection(db, "tracks"), {
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
      });
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
      });
    } catch (e) {
      console.error("Error creating track:", e);
    } finally {
      setCreatingTrack(false);
    }
  };

  const updateField = <K extends keyof Track>(key: K, value: Track[K]) => {
    setEditData((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <AuthGuard>
      <div className="flex h-screen">
        <Sidebar />
        <main className="flex-1 overflow-auto bg-slate-50 p-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-zinc-900">
              Gestión de música
            </h2>
            <Button
              onClick={() => setShowNewForm(!showNewForm)}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {showNewForm ? "Cancelar" : "+ Subir nueva canción"}
            </Button>
          </div>

          {/* New track form */}
          {showNewForm && (
            <div className="bg-white border border-zinc-200 rounded-xl shadow-sm p-5 mb-6 space-y-4">
              <h3 className="font-semibold text-sm text-zinc-700">
                Nueva canción
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-zinc-500">Título *</Label>
                  <Input
                    value={newTrack.title || ""}
                    onChange={(e) =>
                      setNewTrack((p) => ({ ...p, title: e.target.value }))
                    }
                    placeholder="Nombre de la canción"
                    className="bg-white border-zinc-300 text-zinc-900"
                  />
                </div>
                <div>
                  <Label className="text-xs text-zinc-500">Artista</Label>
                  <Input
                    value={newTrack.artist || ""}
                    onChange={(e) =>
                      setNewTrack((p) => ({ ...p, artist: e.target.value }))
                    }
                    placeholder="David Bello"
                    className="bg-white border-zinc-300 text-zinc-900"
                  />
                </div>
                <div>
                  <Label className="text-xs text-zinc-500">Álbum</Label>
                  <Input
                    value={newTrack.album || ""}
                    onChange={(e) =>
                      setNewTrack((p) => ({ ...p, album: e.target.value }))
                    }
                    placeholder="Nombre del álbum"
                    className="bg-white border-zinc-300 text-zinc-900"
                  />
                </div>
                <div>
                  <Label className="text-xs text-zinc-500">Estilo / Género</Label>
                  <Input
                    value={newTrack.style || ""}
                    onChange={(e) =>
                      setNewTrack((p) => ({ ...p, style: e.target.value }))
                    }
                    placeholder="ej: Pop, Rock, Balada..."
                    className="bg-white border-zinc-300 text-zinc-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-zinc-500">URL del audio</Label>
                  <Input
                    value={newTrack.audioUrl || ""}
                    onChange={(e) =>
                      setNewTrack((p) => ({ ...p, audioUrl: e.target.value }))
                    }
                    placeholder="https://..."
                    className="bg-white border-zinc-300 text-zinc-900"
                  />
                </div>
                <div>
                  <Label className="text-xs text-zinc-500">URL de portada</Label>
                  <Input
                    value={newTrack.coverUrl || ""}
                    onChange={(e) =>
                      setNewTrack((p) => ({ ...p, coverUrl: e.target.value }))
                    }
                    placeholder="https://..."
                    className="bg-white border-zinc-300 text-zinc-900"
                  />
                  {newTrack.coverUrl && (
                    <img
                      src={newTrack.coverUrl}
                      alt="Preview"
                      className="w-16 h-16 rounded-lg object-cover mt-2"
                    />
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-zinc-500">Orden</Label>
                  <Input
                    type="number"
                    value={newTrack.order ?? 0}
                    onChange={(e) =>
                      setNewTrack((p) => ({
                        ...p,
                        order: parseInt(e.target.value) || 0,
                      }))
                    }
                    className="bg-white border-zinc-300 text-zinc-900"
                  />
                </div>
              </div>

              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={newTrack.isInstrumental || false}
                    onCheckedChange={(v) =>
                      setNewTrack((p) => ({ ...p, isInstrumental: v }))
                    }
                  />
                  <Label className="text-xs text-zinc-600">Instrumental</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={newTrack.active ?? true}
                    onCheckedChange={(v) =>
                      setNewTrack((p) => ({ ...p, active: v }))
                    }
                  />
                  <Label className="text-xs text-zinc-600">Activo</Label>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  onClick={handleCreateTrack}
                  disabled={creatingTrack || !newTrack.title}
                  className="bg-amber-600 hover:bg-amber-700"
                >
                  {creatingTrack ? "Creando..." : "Crear canción"}
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
                Usa el botón de arriba para crear la primera canción.
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
                                {track.style ? ` · ${track.style}` : ""}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
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
                            <div className="bg-zinc-50 border border-zinc-200 border-t-0 rounded-b-lg p-5 space-y-5">
                              {/* Basic info */}
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                  <Label className="text-xs text-zinc-500">
                                    Título
                                  </Label>
                                  <Input
                                    value={editData.title || ""}
                                    onChange={(e) =>
                                      updateField("title", e.target.value)
                                    }
                                    className="bg-white border-zinc-300 text-zinc-900"
                                  />
                                </div>
                                <div>
                                  <Label className="text-xs text-zinc-500">
                                    Artista
                                  </Label>
                                  <Input
                                    value={editData.artist || ""}
                                    onChange={(e) =>
                                      updateField("artist", e.target.value)
                                    }
                                    className="bg-white border-zinc-300 text-zinc-900"
                                  />
                                </div>
                                <div>
                                  <Label className="text-xs text-zinc-500">
                                    Álbum
                                  </Label>
                                  <Input
                                    value={editData.album || ""}
                                    onChange={(e) =>
                                      updateField("album", e.target.value)
                                    }
                                    className="bg-white border-zinc-300 text-zinc-900"
                                  />
                                </div>
                                <div>
                                  <Label className="text-xs text-zinc-500">
                                    Estilo / Género
                                  </Label>
                                  <Input
                                    value={(editData.style as string) || ""}
                                    onChange={(e) =>
                                      updateField("style", e.target.value)
                                    }
                                    placeholder="ej: Pop, Rock, Balada..."
                                    className="bg-white border-zinc-300 text-zinc-900"
                                  />
                                </div>
                                <div>
                                  <Label className="text-xs text-zinc-500">
                                    Orden
                                  </Label>
                                  <Input
                                    type="number"
                                    value={editData.order ?? 0}
                                    onChange={(e) =>
                                      updateField(
                                        "order",
                                        parseInt(e.target.value) || 0
                                      )
                                    }
                                    className="bg-white border-zinc-300 text-zinc-900"
                                  />
                                </div>
                              </div>

                              {/* Audio preview */}
                              <div>
                                <Label className="text-xs text-zinc-500 mb-2 block">
                                  Audio
                                </Label>
                                {editData.audioUrl ? (
                                  <div className="bg-white border border-zinc-200 rounded-lg p-4 space-y-3">
                                    <audio
                                      controls
                                      src={editData.audioUrl}
                                      className="w-full h-10"
                                      preload="none"
                                    />
                                    <div>
                                      <Label className="text-xs text-zinc-400">
                                        URL del audio
                                      </Label>
                                      <Input
                                        value={editData.audioUrl || ""}
                                        onChange={(e) =>
                                          updateField(
                                            "audioUrl",
                                            e.target.value
                                          )
                                        }
                                        placeholder="https://..."
                                        className="bg-white border-zinc-300 text-zinc-900 mt-1"
                                      />
                                    </div>
                                  </div>
                                ) : (
                                  <div className="bg-white border border-zinc-200 border-dashed rounded-lg p-4">
                                    <Label className="text-xs text-zinc-400">
                                      URL del audio
                                    </Label>
                                    <Input
                                      value={editData.audioUrl || ""}
                                      onChange={(e) =>
                                        updateField(
                                          "audioUrl",
                                          e.target.value
                                        )
                                      }
                                      placeholder="https://..."
                                      className="bg-white border-zinc-300 text-zinc-900 mt-1"
                                    />
                                  </div>
                                )}
                              </div>

                              {/* Cover image */}
                              <div>
                                <Label className="text-xs text-zinc-500 mb-2 block">
                                  Portada
                                </Label>
                                <div className="bg-white border border-zinc-200 rounded-lg p-4">
                                  <div className="flex items-start gap-4">
                                    {editData.coverUrl ? (
                                      <img
                                        src={editData.coverUrl}
                                        alt="Portada"
                                        className="w-[120px] h-[120px] rounded-lg object-cover flex-shrink-0"
                                      />
                                    ) : (
                                      <div className="w-[120px] h-[120px] rounded-lg bg-zinc-100 flex items-center justify-center flex-shrink-0">
                                        <span className="text-3xl text-zinc-300">
                                          🎵
                                        </span>
                                      </div>
                                    )}
                                    <div className="flex-1 space-y-2">
                                      <Label className="text-xs text-zinc-400">
                                        URL de la portada
                                      </Label>
                                      <Input
                                        value={editData.coverUrl || ""}
                                        onChange={(e) =>
                                          updateField(
                                            "coverUrl",
                                            e.target.value
                                          )
                                        }
                                        placeholder="https://..."
                                        className="bg-white border-zinc-300 text-zinc-900"
                                      />
                                      <p className="text-xs text-zinc-400">
                                        Introduce la URL de la imagen de
                                        portada. Se mostrará a 120x120px.
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Linked track */}
                              <div>
                                <Label className="text-xs text-zinc-500">
                                  ID del track principal (si es instrumental)
                                </Label>
                                <Input
                                  value={
                                    (editData.linkedMainTrackId as string) || ""
                                  }
                                  onChange={(e) =>
                                    updateField(
                                      "linkedMainTrackId",
                                      e.target.value
                                    )
                                  }
                                  placeholder="ej: track_01"
                                  className="bg-white border-zinc-300 text-zinc-900"
                                />
                              </div>

                              {/* Lyrics */}
                              <div>
                                <div className="flex items-center justify-between mb-1">
                                  <Label className="text-xs text-zinc-500">
                                    Letra
                                  </Label>
                                </div>
                                <Textarea
                                  value={(editData.lyrics as string) || ""}
                                  onChange={(e) =>
                                    updateField("lyrics", e.target.value)
                                  }
                                  placeholder="Escribe la letra de la canción..."
                                  className="bg-white border-zinc-300 text-zinc-900 font-mono text-sm min-h-[200px] p-4"
                                  style={{ minHeight: "200px" }}
                                />
                                <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                  <p className="text-xs text-blue-700">
                                    <strong>Formato LRC para letras sincronizadas:</strong>{" "}
                                    <code className="bg-blue-100 px-1 rounded">
                                      [00:12.34] Línea de la letra
                                    </code>
                                  </p>
                                  <p className="text-xs text-blue-600 mt-1">
                                    Cada línea empieza con el timestamp entre
                                    corchetes [mm:ss.cc] seguido del texto.
                                    Ejemplo:
                                  </p>
                                  <pre className="text-xs text-blue-600 mt-1 font-mono">
                                    {`[00:00.00] Intro\n[00:15.30] Primera línea de la canción\n[00:22.10] Segunda línea...`}
                                  </pre>
                                </div>
                              </div>

                              {/* Toggles */}
                              <div className="flex items-center gap-6">
                                <div className="flex items-center gap-2">
                                  <Switch
                                    checked={
                                      editData.isInstrumental || false
                                    }
                                    onCheckedChange={(v) =>
                                      updateField("isInstrumental", v)
                                    }
                                  />
                                  <Label className="text-xs text-zinc-600">
                                    Instrumental
                                  </Label>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Switch
                                    checked={editData.active || false}
                                    onCheckedChange={(v) =>
                                      updateField("active", v)
                                    }
                                  />
                                  <Label className="text-xs text-zinc-600">
                                    Activo
                                  </Label>
                                </div>
                              </div>

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
                                <Button
                                  variant="ghost"
                                  onClick={() => {
                                    setExpandedId(null);
                                    setEditData({});
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
