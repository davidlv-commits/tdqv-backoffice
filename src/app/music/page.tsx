"use client";

import { useEffect, useState } from "react";
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

export default function MusicPage() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<Track>>({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    getTracks()
      .then((t) => {
        setTracks(t);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

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
      // Remove empty optional fields
      if (!dataToSave.lyrics) delete dataToSave.lyrics;
      if (!dataToSave.linkedMainTrackId) delete dataToSave.linkedMainTrackId;

      await saveTrack(dataToSave);
      // Update local state
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

  const updateField = <K extends keyof Track>(key: K, value: Track[K]) => {
    setEditData((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <AuthGuard>
      <div className="flex h-screen">
        <Sidebar />
        <main className="flex-1 overflow-auto p-8">
          <h2 className="text-2xl font-bold mb-6">Gestion de musica</h2>

          {loading ? (
            <p className="text-zinc-500">Cargando tracks...</p>
          ) : tracks.length === 0 ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center">
              <p className="text-zinc-400 mb-2">No hay tracks en Firestore</p>
              <p className="text-sm text-zinc-600">
                Necesitas migrar los tracks desde el codigo Flutter.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {tracks.map((track) => (
                <div key={track.id}>
                  {/* Track row */}
                  <div
                    onClick={() => handleExpand(track)}
                    className={`flex items-center gap-4 bg-zinc-900 border rounded-lg px-5 py-4 cursor-pointer transition-colors ${
                      expandedId === track.id
                        ? "border-amber-500/50"
                        : "border-zinc-800 hover:border-zinc-700"
                    }`}
                  >
                    <span className="text-amber-500/60 font-mono text-sm w-6">
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
                      <p className="font-medium truncate">{track.title}</p>
                      <p className="text-sm text-zinc-500 truncate">
                        {track.artist} · {track.album}
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
                    <div className="bg-zinc-900/50 border border-zinc-800 border-t-0 rounded-b-lg p-5 space-y-4 -mt-1">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label className="text-xs text-zinc-400">
                            Titulo
                          </Label>
                          <Input
                            value={editData.title || ""}
                            onChange={(e) =>
                              updateField("title", e.target.value)
                            }
                            className="bg-zinc-800 border-zinc-700"
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-zinc-400">
                            Artista
                          </Label>
                          <Input
                            value={editData.artist || ""}
                            onChange={(e) =>
                              updateField("artist", e.target.value)
                            }
                            className="bg-zinc-800 border-zinc-700"
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-zinc-400">Album</Label>
                          <Input
                            value={editData.album || ""}
                            onChange={(e) =>
                              updateField("album", e.target.value)
                            }
                            className="bg-zinc-800 border-zinc-700"
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-zinc-400">Orden</Label>
                          <Input
                            type="number"
                            value={editData.order ?? 0}
                            onChange={(e) =>
                              updateField("order", parseInt(e.target.value) || 0)
                            }
                            className="bg-zinc-800 border-zinc-700"
                          />
                        </div>
                      </div>

                      <div>
                        <Label className="text-xs text-zinc-400">
                          URL del audio
                        </Label>
                        <Input
                          value={editData.audioUrl || ""}
                          onChange={(e) =>
                            updateField("audioUrl", e.target.value)
                          }
                          placeholder="https://..."
                          className="bg-zinc-800 border-zinc-700"
                        />
                      </div>

                      <div>
                        <Label className="text-xs text-zinc-400">
                          URL de la portada
                        </Label>
                        <Input
                          value={editData.coverUrl || ""}
                          onChange={(e) =>
                            updateField("coverUrl", e.target.value)
                          }
                          placeholder="https://..."
                          className="bg-zinc-800 border-zinc-700"
                        />
                        {editData.coverUrl && (
                          <img
                            src={editData.coverUrl}
                            alt="Preview"
                            className="w-16 h-16 rounded mt-2 object-cover"
                          />
                        )}
                      </div>

                      <div>
                        <Label className="text-xs text-zinc-400">
                          ID del track principal (si es instrumental)
                        </Label>
                        <Input
                          value={(editData.linkedMainTrackId as string) || ""}
                          onChange={(e) =>
                            updateField("linkedMainTrackId", e.target.value)
                          }
                          placeholder="ej: track_01"
                          className="bg-zinc-800 border-zinc-700"
                        />
                      </div>

                      <div>
                        <Label className="text-xs text-zinc-400">Letra</Label>
                        <Textarea
                          value={(editData.lyrics as string) || ""}
                          onChange={(e) =>
                            updateField("lyrics", e.target.value)
                          }
                          placeholder="Escribe la letra de la cancion..."
                          rows={6}
                          className="bg-zinc-800 border-zinc-700 font-mono text-sm"
                        />
                      </div>

                      <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={editData.isInstrumental || false}
                            onCheckedChange={(v) =>
                              updateField("isInstrumental", v)
                            }
                          />
                          <Label className="text-xs text-zinc-400">
                            Instrumental
                          </Label>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={editData.active || false}
                            onCheckedChange={(v) => updateField("active", v)}
                          />
                          <Label className="text-xs text-zinc-400">
                            Activo
                          </Label>
                        </div>
                      </div>

                      <div className="flex gap-2 pt-2">
                        <Button
                          onClick={handleSave}
                          disabled={saving}
                          className="bg-amber-600 hover:bg-amber-700"
                        >
                          {saving ? "Guardando..." : "Guardar cambios"}
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
        </main>
      </div>
    </AuthGuard>
  );
}
