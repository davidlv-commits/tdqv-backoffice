"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { MediaBlock } from "./media-block";
import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getTracks } from "@/lib/firestore";
import type { Track, MediaType } from "@/lib/types";

interface ChapterRichEditorProps {
  initialContent: string;
  onSave: (body: string, mediaHooks: MediaHook[]) => Promise<void>;
  existingHooks?: MediaHook[];
}

export interface MediaHook {
  mediaType: MediaType;
  mediaId: string;
  title: string;
  mediaUrl: string;
  isExclusive: boolean;
  displayStyle: string;
  autoplay: boolean;
  initialVolume: number;
  crossfadeWithId: string;
  crossfadeWithTitle: string;
}

export function ChapterRichEditor({
  initialContent,
  onSave,
  existingHooks = [],
}: ChapterRichEditorProps) {
  const [saving, setSaving] = useState(false);
  const [showInsert, setShowInsert] = useState(false);

  // Available media from Firestore.
  const [availableTracks, setAvailableTracks] = useState<Track[]>([]);
  const [selectedMediaType, setSelectedMediaType] = useState<string>("");
  const [selectedTrackId, setSelectedTrackId] = useState("");
  const [autoplay, setAutoplay] = useState(false);
  const [initialVolume, setInitialVolume] = useState(0.3);
  const [crossfadeFromPrevious, setCrossfadeFromPrevious] = useState(false);

  useEffect(() => {
    getTracks().then(setAvailableTracks);
  }, []);

  // Filtrar media según el tipo seleccionado.
  const filteredMedia = availableTracks.filter((t) => {
    if (selectedMediaType === "music") return !t.isInstrumental;
    if (selectedMediaType === "instrumental") return t.isInstrumental;
    // audio, video, image: por ahora no hay tracks de estos tipos,
    // se añadirán cuando el backoffice gestione más tipos de media.
    return false;
  });

  const bodyToHtml = (body: string) => {
    const paragraphs = body.split("\n\n").filter((p) => p.trim());
    return paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join("");
  };

  const htmlToBody = (editor: ReturnType<typeof useEditor>) => {
    if (!editor) return { body: "", hooks: [] as MediaHook[] };
    const json = editor.getJSON();
    const paragraphs: string[] = [];
    const hooks: MediaHook[] = [];

    for (const node of json.content || []) {
      if (node.type === "paragraph") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const text = (node.content || []).map((c: any) => c.text || "").join("");
        if (text.trim()) paragraphs.push(text);
      } else if (node.type === "mediaBlock") {
        hooks.push({
          mediaType: (node.attrs?.mediaType || "music") as MediaType,
          mediaId: node.attrs?.mediaId || "",
          title: node.attrs?.title || "",
          mediaUrl: node.attrs?.mediaUrl || "",
          isExclusive: node.attrs?.isExclusive ?? true,
          displayStyle: node.attrs?.displayStyle || "inline",
          autoplay: node.attrs?.autoplay ?? false,
          initialVolume: node.attrs?.initialVolume ?? 0.3,
          crossfadeWithId: node.attrs?.crossfadeWithId || "",
          crossfadeWithTitle: node.attrs?.crossfadeWithTitle || "",
        });
      }
    }
    return { body: paragraphs.join("\n\n"), hooks };
  };

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Solo texto plano — sin formateo.
        bold: false,
        italic: false,
        strike: false,
        heading: false,
        bulletList: false,
        orderedList: false,
        blockquote: false,
        codeBlock: false,
        code: false,
        horizontalRule: false,
      }),
      Placeholder.configure({
        placeholder: "Escribe el contenido del capítulo...",
      }),
      MediaBlock,
    ],
    content: bodyToHtml(initialContent),
    editorProps: {
      attributes: {
        class: "focus:outline-none min-h-[400px] text-[15px] leading-[1.9] text-zinc-800",
      },
    },
  });

  const handleSave = useCallback(async () => {
    if (!editor) return;
    setSaving(true);
    const { body, hooks } = htmlToBody(editor);
    await onSave(body, hooks);
    setSaving(false);
  }, [editor, onSave]);

  const handleInsertMedia = useCallback(() => {
    if (!editor || !selectedTrackId) return;

    const track = availableTracks.find((t) => t.id === selectedTrackId);
    if (!track) return;

    const mType = selectedMediaType || "music";

    editor
      .chain()
      .focus()
      .insertContent({
        type: "mediaBlock",
        attrs: {
          mediaType: mType,
          mediaId: track.id,
          title: track.title,
          mediaUrl: track.audioUrl,
          isExclusive: !autoplay,
          displayStyle: autoplay ? "ambient" : "inline",
          autoplay,
          initialVolume,
          crossfadeWithId: crossfadeFromPrevious ? "__previous__" : "",
          crossfadeWithTitle: crossfadeFromPrevious ? "Fundido desde la pista anterior" : "",
        },
      })
      .run();

    setShowInsert(false);
    setSelectedTrackId("");
    setAutoplay(false);
    setInitialVolume(0.3);
    setCrossfadeFromPrevious(false);
  }, [editor, selectedTrackId, availableTracks, autoplay, initialVolume, crossfadeFromPrevious, selectedMediaType]);

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-zinc-200 bg-white rounded-t-xl px-4 py-3 sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="text-zinc-600 border-zinc-300 hover:bg-zinc-50"
            onClick={() => setShowInsert(!showInsert)}
          >
            + Insertar media
          </Button>
          <span className="text-xs text-zinc-400 ml-2">
            Pon el cursor donde quieras y selecciona el contenido
          </span>
        </div>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={saving}
          className="bg-amber-600 hover:bg-amber-700 text-white"
        >
          {saving ? "Guardando..." : "Guardar cambios"}
        </Button>
      </div>

      {/* Insert media panel */}
      {showInsert && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-4 space-y-3">
          {/* Fila 1: Tipo + Contenido */}
          <div className="flex items-end gap-3">
            <div className="w-44">
              <label className="text-xs text-zinc-500 mb-1 block">Tipo de media</label>
              <Select value={selectedMediaType} onValueChange={(v) => { setSelectedMediaType(v || ""); setSelectedTrackId(""); }}>
                <SelectTrigger className="bg-white border-zinc-300 text-zinc-900 h-9">
                  <SelectValue placeholder="Tipo..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="music">🎵 Canciones</SelectItem>
                  <SelectItem value="instrumental">🎹 Instrumentales</SelectItem>
                  <SelectItem value="audio">🎙️ Audios</SelectItem>
                  <SelectItem value="video">🎬 Vídeos</SelectItem>
                  <SelectItem value="image">🖼️ Imágenes</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1">
              <label className="text-xs text-zinc-500 mb-1 block">Contenido</label>
              <Select value={selectedTrackId} onValueChange={(v) => setSelectedTrackId(v || "")} disabled={!selectedMediaType}>
                <SelectTrigger className="bg-white border-zinc-300 text-zinc-900 h-9">
                  <SelectValue placeholder={selectedMediaType ? "Selecciona..." : "Elige un tipo primero"} />
                </SelectTrigger>
                <SelectContent>
                  {filteredMedia.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.title}
                    </SelectItem>
                  ))}
                  {filteredMedia.length === 0 && (
                    <SelectItem value="__empty" disabled>No hay contenido de este tipo</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Fila 2: Opciones de reproducción (solo para audio/música) */}
          {selectedTrackId && selectedTrackId !== "__empty" && (selectedMediaType === "music" || selectedMediaType === "instrumental") && (
            <div className="flex items-center gap-4 bg-white rounded-lg border border-zinc-200 px-4 py-3">
              {/* Autoplay */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoplay}
                  onChange={(e) => setAutoplay(e.target.checked)}
                  className="w-4 h-4 rounded border-zinc-300 text-amber-600 focus:ring-amber-500"
                />
                <span className="text-xs text-zinc-700 font-medium">Autoplay</span>
              </label>

              {/* Volumen inicial (solo si autoplay) */}
              {autoplay && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-500">Vol:</span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={Math.round(initialVolume * 100)}
                    onChange={(e) => setInitialVolume(Number(e.target.value) / 100)}
                    className="w-24 h-1 accent-amber-600"
                  />
                  <span className="text-xs text-zinc-600 font-mono w-8">{Math.round(initialVolume * 100)}%</span>
                </div>
              )}

              {/* Crossfade desde pista anterior */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={crossfadeFromPrevious}
                  onChange={(e) => setCrossfadeFromPrevious(e.target.checked)}
                  className="w-4 h-4 rounded border-zinc-300 text-pink-600 focus:ring-pink-500"
                />
                <span className="text-xs text-zinc-700 font-medium">Fundido desde la pista anterior</span>
              </label>
            </div>
          )}

          {/* Fila 3: Botones */}
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={handleInsertMedia}
              disabled={!selectedTrackId || selectedTrackId === "__empty"}
              className="bg-amber-600 hover:bg-amber-700 text-white h-9"
            >
              Insertar aquí
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => { setShowInsert(false); setSelectedTrackId(""); setSelectedMediaType(""); setAutoplay(false); setCrossfadeFromPrevious(false); }}
              className="h-9 text-zinc-500"
          >
            ✕
          </Button>
          </div>
        </div>
      )}

      {/* Editor de texto plano */}
      <div className="bg-white border border-zinc-200 rounded-b-xl shadow-sm p-8 md:p-12">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

function escapeHtml(text: string) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
