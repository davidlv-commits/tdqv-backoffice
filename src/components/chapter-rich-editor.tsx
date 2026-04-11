"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { MediaBlock } from "./media-block";
import { ChatBlock } from "./chat-block";
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
  onSave: (body: string, mediaHooks: MediaHookWithPosition[]) => Promise<void>;
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

export interface MediaHookWithPosition extends MediaHook {
  /** Index of the paragraph BEFORE which this block appears (0-based). */
  paragraphIndex: number;
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
    return false;
  });

  /**
   * Builds TipTap-compatible JSON content from body text + existing hooks.
   * Media blocks are inserted AFTER the paragraph at their paragraphIndex.
   */
  const buildEditorContent = (body: string, hooks: (MediaHook & { paragraphIndex?: number })[]) => {
    const paragraphs = body.split("\n\n").filter((p) => p.trim());

    // Group hooks by paragraphIndex.
    const hooksByParagraph = new Map<number, MediaHook[]>();
    hooks.forEach((h, i) => {
      const idx = h.paragraphIndex ?? i;
      if (!hooksByParagraph.has(idx)) hooksByParagraph.set(idx, []);
      hooksByParagraph.get(idx)!.push(h);
    });

    const content: Record<string, unknown>[] = [];

    for (let i = 0; i < paragraphs.length; i++) {
      content.push({
        type: "paragraph",
        content: [{ type: "text", text: paragraphs[i] }],
      });

      // Insert media blocks after this paragraph.
      const hooksHere = hooksByParagraph.get(i);
      if (hooksHere) {
        for (const h of hooksHere) {
          if (h.mediaType === "chat") {
            // Chat block.
            content.push({
              type: "chatBlock",
              attrs: { sender: h.mediaId, senderName: h.displayStyle },
              content: [{ type: "text", text: h.title }],
            });
          } else {
            content.push({
              type: "mediaBlock",
              attrs: {
                mediaType: h.mediaType,
                mediaId: h.mediaId,
                title: h.title,
                mediaUrl: h.mediaUrl,
                isExclusive: h.isExclusive,
                displayStyle: h.displayStyle,
                autoplay: h.autoplay,
                initialVolume: h.initialVolume,
                crossfadeWithId: h.crossfadeWithId,
                crossfadeWithTitle: h.crossfadeWithTitle,
              },
            });
          }
        }
      }
    }

    // Hooks that point beyond the text (appended at the end).
    for (const [idx, hooksArr] of hooksByParagraph.entries()) {
      if (idx >= paragraphs.length) {
        for (const h of hooksArr) {
          content.push({
            type: "mediaBlock",
            attrs: {
              mediaType: h.mediaType,
              mediaId: h.mediaId,
              title: h.title,
              mediaUrl: h.mediaUrl,
              isExclusive: h.isExclusive,
              displayStyle: h.displayStyle,
              autoplay: h.autoplay,
              initialVolume: h.initialVolume,
              crossfadeWithId: h.crossfadeWithId,
              crossfadeWithTitle: h.crossfadeWithTitle,
            },
          });
        }
      }
    }

    // If no content at all, add an empty paragraph so TipTap isn't empty.
    if (content.length === 0) {
      content.push({ type: "paragraph" });
    }

    return { type: "doc", content };
  };

  /**
   * Extracts body text and media hooks WITH their paragraph positions
   * from the TipTap editor JSON.
   */
  const htmlToBody = (editor: ReturnType<typeof useEditor>) => {
    if (!editor) return { body: "", hooks: [] as MediaHookWithPosition[] };
    const json = editor.getJSON();
    const paragraphs: string[] = [];
    const hooks: MediaHookWithPosition[] = [];

    for (const node of json.content || []) {
      if (node.type === "paragraph") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const text = (node.content || []).map((c: any) => c.text || "").join("");
        if (text.trim()) paragraphs.push(text);
      } else if (node.type === "chatBlock") {
        // Chat message — extract text content and sender.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const chatText = (node.content || []).map((c: any) => c.text || "").join("");
        hooks.push({
          paragraphIndex: paragraphs.length - 1 < 0 ? 0 : paragraphs.length - 1,
          mediaType: "chat" as MediaType,
          mediaId: node.attrs?.sender || "mine",
          title: chatText,
          mediaUrl: "",
          isExclusive: false,
          displayStyle: node.attrs?.senderName || "",
          autoplay: false,
          initialVolume: 0,
          crossfadeWithId: "",
          crossfadeWithTitle: "",
        });
      } else if (node.type === "mediaBlock") {
        hooks.push({
          paragraphIndex: paragraphs.length - 1 < 0 ? 0 : paragraphs.length - 1,
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
      ChatBlock,
    ],
    // Initialize with both text AND existing media blocks.
    content: buildEditorContent(initialContent, existingHooks),
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
          <Button
            size="sm"
            variant="outline"
            className="text-amber-600 border-amber-300 hover:bg-amber-50"
            onClick={() => {
              editor?.chain().focus().insertContent({
                type: "chatBlock",
                attrs: { sender: "mine" },
                content: [{ type: "text", text: "Mensaje de David..." }],
              }).run();
            }}
          >
            💬 Msg mío
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-purple-600 border-purple-300 hover:bg-purple-50"
            onClick={() => {
              editor?.chain().focus().insertContent({
                type: "chatBlock",
                attrs: { sender: "theirs" },
                content: [{ type: "text", text: "Mensaje de ella..." }],
              }).run();
            }}
          >
            💬 Msg suyo
          </Button>
          <span className="text-xs text-zinc-400 ml-2">
            Cursor donde quieras
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

          {/* Fila 2: Opciones de reproducción */}
          {selectedTrackId && selectedTrackId !== "__empty" && (selectedMediaType === "music" || selectedMediaType === "instrumental") && (
            <div className="flex items-center gap-4 bg-white rounded-lg border border-zinc-200 px-4 py-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoplay}
                  onChange={(e) => setAutoplay(e.target.checked)}
                  className="w-4 h-4 rounded border-zinc-300 text-amber-600 focus:ring-amber-500"
                />
                <span className="text-xs text-zinc-700 font-medium">Autoplay</span>
              </label>

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
