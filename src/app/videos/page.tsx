"use client";

import { useEffect, useState, useRef } from "react";
import { AuthGuard } from "@/components/auth-guard";
import { Sidebar } from "@/components/sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { getVideos, addVideo, saveVideo, deleteVideo, getBooks, getChapters } from "@/lib/firestore";
import type { Video, VideoSource, Book, Chapter } from "@/lib/types";

export default function VideosPage() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<Video>>({});
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [chapters, setChapters] = useState<{id: string; label: string; title: string}[]>([]);

  // New video form
  const [newVideo, setNewVideo] = useState({
    title: "", description: "", source: "youtube" as VideoSource,
    youtubeId: "", videoUrl: "", thumbnailUrl: "", order: 0, active: true,
    lockedUntilChapter: "", lockedUntilChapterTitle: "", isLockedByChapter: false,
  });

  const videoFileRef = useRef<HTMLInputElement>(null);
  const [videoFileName, setVideoFileName] = useState("");

  useEffect(() => {
    getVideos().then(v => { setVideos(v); setLoading(false); }).catch(() => setLoading(false));
    // Load chapters for the lock dropdown.
    Promise.all([getBooks()]).then(async ([books]) => {
      const allChapters: {id: string; label: string; title: string}[] = [];
      for (const b of books) {
        const chs = await getChapters(b.id);
        for (const c of chs) {
          allChapters.push({
            id: `${b.id}/${c.id}`,
            label: `${b.id === "book1" ? "Libro I" : "Libro II"} · Cap ${c.order} · ${c.title}`,
            title: c.title,
          });
        }
      }
      setChapters(allChapters);
    });
  }, []);

  const extractYoutubeId = (input: string): string => {
    // Handle various YouTube URL formats
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&?\s]+)/,
      /^([a-zA-Z0-9_-]{11})$/,
    ];
    for (const p of patterns) {
      const m = input.match(p);
      if (m) return m[1];
    }
    return input;
  };

  const getYoutubeThumbnail = (ytId: string) =>
    ytId ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` : "";

  const handleCreate = async () => {
    if (!newVideo.title) return;
    setSaving(true);
    try {
      const ytId = newVideo.source === "youtube" ? extractYoutubeId(newVideo.youtubeId) : "";
      await addVideo({
        title: newVideo.title,
        description: newVideo.description || "",
        source: newVideo.source,
        youtubeId: ytId,
        videoUrl: newVideo.source === "youtube" ? "" : newVideo.videoUrl,
        thumbnailUrl: newVideo.source === "youtube" ? getYoutubeThumbnail(ytId) : newVideo.thumbnailUrl || "",
        order: newVideo.order || (videos.length + 1),
        active: newVideo.active,
        ...(newVideo.isLockedByChapter && newVideo.lockedUntilChapter
          ? { lockedUntilChapter: newVideo.lockedUntilChapter, lockedUntilChapterTitle: newVideo.lockedUntilChapterTitle, isLockedByChapter: true }
          : { isLockedByChapter: false }),
      });
      const updated = await getVideos();
      setVideos(updated);
      setShowForm(false);
      setNewVideo({ title: "", description: "", source: "youtube", youtubeId: "", videoUrl: "", thumbnailUrl: "", order: 0, active: true, lockedUntilChapter: "", lockedUntilChapterTitle: "", isLockedByChapter: false });
    } catch (e) {
      console.error("Error creando video:", e);
      alert("Error al guardar el video. Revisa la consola.");
    }
    setSaving(false);
  };

  const handleSave = async () => {
    if (!expandedId) return;
    setSaving(true);
    try {
      await saveVideo({ id: expandedId, ...editData } as Partial<Video> & { id: string });
      setVideos(prev => prev.map(v => v.id === expandedId ? { ...v, ...editData } : v));
      setExpandedId(null);
    } catch (e) {
      console.error("Error guardando video:", e);
      alert("Error al guardar. Revisa la consola.");
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar este vídeo?")) return;
    await deleteVideo(id);
    setVideos(prev => prev.filter(v => v.id !== id));
  };

  const renderSourceForm = (data: Record<string, unknown>, update: (k: string, v: unknown) => void) => {
    const source = (data.source || "youtube") as VideoSource;
    return (
      <>
        {/* Source type */}
        <div>
          <Label className="text-xs text-zinc-500">Fuente del vídeo</Label>
          <div className="flex gap-2 mt-1">
            {(["youtube", "r2", "url"] as VideoSource[]).map(s => (
              <button key={s} onClick={() => update("source", s)}
                className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                  source === s ? "bg-amber-50 border-amber-500 text-amber-700" : "bg-white border-zinc-200 text-zinc-500 hover:border-zinc-300"
                }`}>
                {s === "youtube" ? "📺 YouTube" : s === "r2" ? "☁️ Subir vídeo" : "🔗 URL externa"}
              </button>
            ))}
          </div>
        </div>

        {source === "youtube" && (
          <div>
            <Label className="text-xs text-zinc-500">Enlace o ID de YouTube</Label>
            <Input
              value={(data.youtubeId as string) || ""}
              onChange={e => {
                const id = extractYoutubeId(e.target.value);
                update("youtubeId", id);
                update("thumbnailUrl", getYoutubeThumbnail(id));
              }}
              placeholder="https://youtu.be/jVmXHY6X0vQ o jVmXHY6X0vQ"
              className="bg-white border-zinc-300 text-zinc-900"
            />
            {(data.youtubeId as string) && (
              <div className="mt-3 space-y-2">
                <div className="rounded-lg overflow-hidden border border-zinc-200 aspect-video">
                  <iframe
                    width="100%"
                    height="100%"
                    src={`https://www.youtube.com/embed/${data.youtubeId}`}
                    title="Preview"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="block"
                  />
                </div>
                <p className="text-[10px] text-zinc-400">Si el video se reproduce aqui arriba, funcionara tambien en la App.</p>
              </div>
            )}
          </div>
        )}

        {source === "r2" && (
          <div>
            <Label className="text-xs text-zinc-500">Archivo de vídeo</Label>
            <input type="file" ref={videoFileRef} accept="video/*" className="hidden"
              onChange={e => {
                const f = e.target.files?.[0];
                if (f) setVideoFileName(f.name);
              }} />
            <button onClick={() => videoFileRef.current?.click()}
              className="w-full mt-1 border-2 border-dashed border-zinc-300 rounded-lg p-4 text-center hover:border-amber-500 transition-colors">
              {videoFileName ? (
                <span className="text-sm text-green-600">📹 {videoFileName}</span>
              ) : (data.videoUrl as string) ? (
                <span className="text-sm text-green-600">Vídeo cargado ✓</span>
              ) : (
                <span className="text-sm text-zinc-400">Subir vídeo .mp4, .mov</span>
              )}
            </button>
            <p className="text-[10px] text-zinc-400 mt-1">La subida a R2 se activará próximamente</p>
          </div>
        )}

        {source === "url" && (
          <div>
            <Label className="text-xs text-zinc-500">URL del vídeo</Label>
            <Input
              value={(data.videoUrl as string) || ""}
              onChange={e => update("videoUrl", e.target.value)}
              placeholder="https://..."
              className="bg-white border-zinc-300 text-zinc-900"
            />
          </div>
        )}
      </>
    );
  };

  return (
    <AuthGuard>
      <div className="flex h-screen">
        <Sidebar />
        <main className="flex-1 overflow-auto bg-slate-50 p-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-zinc-900">Gestión de vídeos</h2>
            <Button onClick={() => setShowForm(!showForm)}
              className="bg-amber-600 hover:bg-amber-700 text-white">
              {showForm ? "Cancelar" : "+ Nuevo vídeo"}
            </Button>
          </div>

          {/* New video form */}
          {showForm && (
            <div className="bg-white border border-zinc-200 rounded-xl p-6 shadow-sm mb-6 space-y-4">
              <h3 className="font-semibold text-zinc-900">Nuevo vídeo</h3>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-zinc-500">Título</Label>
                  <Input value={newVideo.title} onChange={e => setNewVideo(p => ({...p, title: e.target.value}))}
                    className="bg-white border-zinc-300 text-zinc-900" placeholder="Nombre del vídeo" />
                </div>
                <div>
                  <Label className="text-xs text-zinc-500">Orden</Label>
                  <Input type="number" value={newVideo.order} onChange={e => setNewVideo(p => ({...p, order: Number(e.target.value)}))}
                    className="bg-white border-zinc-300 text-zinc-900" />
                </div>
              </div>

              <div>
                <Label className="text-xs text-zinc-500">Descripción</Label>
                <Textarea value={newVideo.description} onChange={e => setNewVideo(p => ({...p, description: e.target.value}))}
                  className="bg-white border-zinc-300 text-zinc-900 min-h-[60px]" placeholder="Breve descripción..." />
              </div>

              {renderSourceForm(newVideo as unknown as Record<string, unknown>, (k, v) => setNewVideo(p => ({...p, [k]: v})))}

              {/* Chapter lock */}
              <div className="flex items-center gap-4 bg-zinc-50 rounded-lg p-3">
                <select value={newVideo.lockedUntilChapter}
                  onChange={e => {
                    const ch = chapters.find(c => c.id === e.target.value);
                    setNewVideo(p => ({...p, lockedUntilChapter: e.target.value, lockedUntilChapterTitle: ch?.title || ""}));
                  }}
                  className="flex-1 h-9 rounded-md border border-zinc-300 bg-white text-zinc-900 text-sm px-3">
                  <option value="">Sin capítulo asociado</option>
                  {chapters.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
                <label className="flex items-center gap-2 cursor-pointer flex-shrink-0">
                  <input type="checkbox" checked={newVideo.isLockedByChapter}
                    onChange={e => setNewVideo(p => ({...p, isLockedByChapter: e.target.checked}))}
                    className="w-4 h-4 rounded border-zinc-300 text-amber-600" />
                  <span className="text-xs text-zinc-700">Bloquear</span>
                </label>
              </div>

              <div className="flex gap-2">
                <Button onClick={handleCreate} disabled={saving || !newVideo.title}
                  className="bg-amber-600 hover:bg-amber-700 text-white">
                  {saving ? "Guardando..." : "Crear vídeo"}
                </Button>
                <Button variant="ghost" onClick={() => setShowForm(false)}>Cancelar</Button>
              </div>
            </div>
          )}

          {/* Video list */}
          {loading ? <p className="text-zinc-500">Cargando...</p> : videos.length === 0 && !showForm ? (
            <div className="bg-white border border-zinc-200 rounded-xl p-8 text-center shadow-sm">
              <p className="text-4xl mb-4">🎬</p>
              <p className="text-zinc-600 font-medium mb-2">No hay vídeos</p>
              <p className="text-sm text-zinc-400">Añade vídeos de YouTube o sube los tuyos propios</p>
            </div>
          ) : (
            <div className="space-y-2">
              {videos.map(v => (
                <div key={v.id}>
                  <div onClick={() => { setExpandedId(expandedId === v.id ? null : v.id); setEditData(v); }}
                    className={`flex items-center gap-4 bg-white border rounded-lg px-4 py-3 cursor-pointer transition-all ${
                      expandedId === v.id ? "border-amber-500/50 rounded-b-none shadow-sm" : "border-zinc-200 hover:border-zinc-300"
                    }`}>
                    {/* Thumbnail */}
                    <div className="w-24 h-14 rounded-lg overflow-hidden bg-zinc-100 flex-shrink-0 relative group/thumb">
                      {v.thumbnailUrl ? (
                        <img src={v.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                      ) : v.youtubeId ? (
                        <img src={`https://img.youtube.com/vi/${v.youtubeId}/hqdefault.jpg`} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-zinc-300 text-2xl">🎬</div>
                      )}
                      {/* Play overlay */}
                      <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover/thumb:opacity-100 transition-opacity">
                        <div className="w-8 h-8 rounded-full bg-white/90 flex items-center justify-center">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="#333"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                        </div>
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-zinc-900 truncate">{v.title}</p>
                      <p className="text-xs text-zinc-500">
                        {v.source === "youtube" ? `YouTube · ${v.youtubeId || ""}` : v.source === "r2" ? "R2" : "URL"}
                        {v.description && ` · ${v.description.substring(0, 50)}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {v.youtubeId && (
                        <button
                          onClick={e => { e.stopPropagation(); setPreviewId(previewId === v.id ? null : v.id); }}
                          className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                            previewId === v.id ? "bg-red-50 border-red-400 text-red-600" : "bg-white border-zinc-200 text-zinc-600 hover:border-red-400 hover:text-red-600"
                          }`}
                        >
                          {previewId === v.id ? "Cerrar preview" : "▶ Probar"}
                        </button>
                      )}
                      {v.isLockedByChapter && <Badge className="bg-amber-100 text-amber-700">Bloqueado</Badge>}
                      {v.active ? <Badge className="bg-green-100 text-green-700">Activo</Badge>
                        : <Badge className="bg-zinc-100 text-zinc-500">Inactivo</Badge>}
                      <button onClick={e => { e.stopPropagation(); handleDelete(v.id); }}
                        className="text-zinc-400 hover:text-red-500 text-sm">Eliminar</button>
                    </div>
                  </div>

                  {/* Inline preview */}
                  {previewId === v.id && v.youtubeId && (
                    <div className="bg-black rounded-b-lg overflow-hidden border border-zinc-200 border-t-0" style={{ marginTop: expandedId === v.id ? 0 : undefined }}>
                      <div className="aspect-video max-h-[400px]">
                        <iframe
                          width="100%"
                          height="100%"
                          src={`https://www.youtube.com/embed/${v.youtubeId}?autoplay=1`}
                          title={v.title}
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                          className="block"
                        />
                      </div>
                    </div>
                  )}

                  {/* Edit form */}
                  {expandedId === v.id && (
                    <div className="bg-zinc-50 border border-zinc-200 border-t-0 rounded-b-lg p-5 space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-xs text-zinc-500">Título</Label>
                          <Input value={editData.title || ""} onChange={e => setEditData(p => ({...p, title: e.target.value}))}
                            className="bg-white border-zinc-300 text-zinc-900" />
                        </div>
                        <div>
                          <Label className="text-xs text-zinc-500">Orden</Label>
                          <Input type="number" value={editData.order || 0} onChange={e => setEditData(p => ({...p, order: Number(e.target.value)}))}
                            className="bg-white border-zinc-300 text-zinc-900" />
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs text-zinc-500">Descripción</Label>
                        <Textarea value={editData.description || ""} onChange={e => setEditData(p => ({...p, description: e.target.value}))}
                          className="bg-white border-zinc-300 text-zinc-900 min-h-[60px]" />
                      </div>
                      {renderSourceForm(editData as unknown as Record<string, unknown>, (k, v) => setEditData(p => ({...p, [k]: v})))}

                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-2"><span className="text-xs text-zinc-500">Activo</span>
                          <Switch checked={editData.active ?? true} onCheckedChange={v => setEditData(p => ({...p, active: v}))} />
                        </label>
                      </div>

                      <div className="flex gap-2">
                        <Button onClick={handleSave} disabled={saving} className="bg-amber-600 hover:bg-amber-700 text-white">
                          {saving ? "Guardando..." : "Guardar"}
                        </Button>
                        <Button variant="ghost" onClick={() => setExpandedId(null)}>Cancelar</Button>
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
