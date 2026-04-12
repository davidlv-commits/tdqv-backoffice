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
  onSplit?: (splitAtParagraph: number, newTitle: string) => Promise<void>;
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
  onSplit,
  existingHooks = [],
}: ChapterRichEditorProps) {
  const [saving, setSaving] = useState(false);
  const [showInsert, setShowInsert] = useState(false);
  const [showSplitDialog, setShowSplitDialog] = useState(false);
  const [splitParagraphIndex, setSplitParagraphIndex] = useState<number | null>(null);
  const [splitTitle, setSplitTitle] = useState("");
  const [splitting, setSplitting] = useState(false);

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

  /**
   * Gets the paragraph index where the cursor currently is.
   * Returns -1 if cursor is not in a paragraph.
   */
  const getCursorParagraphIndex = (editor: ReturnType<typeof useEditor>): number => {
    if (!editor) return -1;
    const json = editor.getJSON();
    const { from } = editor.state.selection;

    let pos = 0;
    let paragraphIndex = 0;

    for (const node of json.content || []) {
      // Each node has a start/end position. We track position manually.
      const nodeSize = editor.state.doc.child(
        (json.content || []).indexOf(node)
      ).nodeSize;

      if (node.type === "paragraph") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const text = (node.content || []).map((c: any) => c.text || "").join("");
        if (text.trim()) {
          if (from >= pos && from <= pos + nodeSize) {
            return paragraphIndex;
          }
          paragraphIndex++;
        }
      }
      pos += nodeSize;
    }
    return paragraphIndex > 0 ? paragraphIndex - 1 : -1;
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

  const handleSplitHere = useCallback(() => {
    if (!editor) return;

    // First, save current state to get accurate body
    const { body } = htmlToBody(editor);
    const paragraphs = body.split("\n\n").filter(p => p.trim());

    if (paragraphs.length < 2) {
      alert("El capítulo necesita al menos 2 párrafos para dividirlo.");
      return;
    }

    // Find which paragraph the cursor is in
    const cursorPos = editor.state.selection.from;
    let nodeIndex = 0;
    let paragraphCount = 0;
    const doc = editor.state.doc;

    doc.forEach((node, offset) => {
      if (offset + node.nodeSize <= cursorPos) {
        if (node.type.name === "paragraph" && node.textContent.trim()) {
          paragraphCount++;
        }
      }
      nodeIndex++;
    });

    // splitAt = number of paragraphs that stay in the FIRST chapter
    const splitAt = Math.max(1, paragraphCount);

    if (splitAt >= paragraphs.length) {
      // Cursor is at the end — show dialog anyway but with last possible split
      setSplitParagraphIndex(paragraphs.length - 1);
    } else {
      setSplitParagraphIndex(splitAt);
    }

    setSplitTitle("");
    setShowSplitDialog(true);
  }, [editor]);

  const handleConfirmSplit = useCallback(async () => {
    if (splitParagraphIndex === null || !splitTitle.trim() || !onSplit) return;

    // First save current content
    if (editor) {
      setSplitting(true);
      const { body, hooks } = htmlToBody(editor);
      await onSave(body, hooks);
      // Then split
      await onSplit(splitParagraphIndex, splitTitle.trim());
      setSplitting(false);
      setShowSplitDialog(false);
    }
  }, [editor, splitParagraphIndex, splitTitle, onSplit, onSave]);

  // Preview split: show which paragraphs go where
  const getSplitPreview = () => {
    if (!editor || splitParagraphIndex === null) return null;
    const { body } = htmlToBody(editor);
    const paragraphs = body.split("\n\n").filter(p => p.trim());
    const before = paragraphs.slice(0, splitParagraphIndex);
    const after = paragraphs.slice(splitParagraphIndex);
    return { before, after, total: paragraphs.length };
  };

  const splitPreview = showSplitDialog ? getSplitPreview() : null;

  return (
    <div className="flex flex-col h-[calc(100vh-140px)]">
      {/* Toolbar — fixed at top */}
      <div className="flex-shrink-0 flex items-center justify-between border-b border-zinc-200 bg-white rounded-t-xl px-4 py-3 z-10">
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
              if (!editor) return;
              const { from, to } = editor.state.selection;
              const selectedText = editor.state.doc.textBetween(from, to, " ");
              const text = selectedText.trim() || "Mensaje de David...";
              editor.chain().focus().deleteSelection().insertContent({
                type: "chatBlock",
                attrs: { sender: "mine" },
                content: [{ type: "text", text }],
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
              if (!editor) return;
              const { from, to } = editor.state.selection;
              const selectedText = editor.state.doc.textBetween(from, to, " ");
              const text = selectedText.trim() || "Mensaje de ella...";
              editor.chain().focus().deleteSelection().insertContent({
                type: "chatBlock",
                attrs: { sender: "theirs" },
                content: [{ type: "text", text }],
              }).run();
            }}
          >
            💬 Msg suyo
          </Button>
          <div className="w-px h-6 bg-zinc-200 mx-1" />
          {onSplit && (
            <Button
              size="sm"
              variant="outline"
              className="text-red-600 border-red-300 hover:bg-red-50"
              onClick={handleSplitHere}
            >
              ✂️ Dividir capítulo aquí
            </Button>
          )}
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

      {/* Split dialog */}
      {showSplitDialog && splitPreview && (
        <div className="flex-shrink-0 bg-red-50 border-b border-red-200 px-4 py-4 space-y-3">
          <div className="flex items-start gap-4">
            <div className="flex-1">
              <h3 className="font-semibold text-red-800 text-sm mb-2">
                ✂️ Dividir capítulo en la posición del cursor
              </h3>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="bg-white rounded-lg border border-zinc-200 p-3">
                  <p className="text-xs font-semibold text-zinc-500 mb-1">
                    Capítulo actual (se queda con {splitPreview.before.length} párrafos)
                  </p>
                  <p className="text-xs text-zinc-600 line-clamp-3">
                    {splitPreview.before[0]?.substring(0, 120)}...
                  </p>
                  {splitPreview.before.length > 1 && (
                    <p className="text-xs text-zinc-400 mt-1">
                      ...y {splitPreview.before.length - 1} párrafos más
                    </p>
                  )}
                </div>
                <div className="bg-white rounded-lg border border-green-200 p-3">
                  <p className="text-xs font-semibold text-green-600 mb-1">
                    Nuevo capítulo ({splitPreview.after.length} párrafos)
                  </p>
                  <p className="text-xs text-zinc-600 line-clamp-3">
                    {splitPreview.after[0]?.substring(0, 120)}...
                  </p>
                  {splitPreview.after.length > 1 && (
                    <p className="text-xs text-zinc-400 mt-1">
                      ...y {splitPreview.after.length - 1} párrafos más
                    </p>
                  )}
                </div>
              </div>

              {/* Slider to adjust split position */}
              <div className="mb-3">
                <label className="text-xs text-zinc-500 mb-1 block">
                  Ajustar posición de corte (párrafo {splitParagraphIndex} de {splitPreview.total})
                </label>
                <input
                  type="range"
                  min={1}
                  max={splitPreview.total - 1}
                  value={splitParagraphIndex ?? 1}
                  onChange={(e) => setSplitParagraphIndex(Number(e.target.value))}
                  className="w-full h-1.5 accent-red-500"
                />
                <div className="flex justify-between text-[10px] text-zinc-400 mt-0.5">
                  <span>Párrafo 1</span>
                  <span>Párrafo {splitPreview.total}</span>
                </div>
              </div>

              <div>
                <label className="text-xs text-zinc-500 mb-1 block">
                  Título del nuevo capítulo *
                </label>
                <input
                  type="text"
                  value={splitTitle}
                  onChange={(e) => setSplitTitle(e.target.value)}
                  placeholder="Ej: Queríamos vernos"
                  className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm text-zinc-900 bg-white focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && splitTitle.trim()) handleConfirmSplit();
                  }}
                />
                <p className="text-[10px] text-zinc-400 mt-1">
                  Los capítulos posteriores se renumerarán automáticamente.
                  Los media moments se reasignarán al capítulo correcto.
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={handleConfirmSplit}
              disabled={!splitTitle.trim() || splitting}
              className="bg-red-600 hover:bg-red-700 text-white h-9"
            >
              {splitting ? "Dividiendo..." : "✂️ Confirmar división"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowSplitDialog(false)}
              className="h-9 text-zinc-500"
              disabled={splitting}
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {/* Insert media panel — fixed below toolbar */}
      {showInsert && (
        <div className="flex-shrink-0 bg-amber-50 border-b border-amber-200 px-4 py-4 space-y-3">
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

      {/* Editor — scrollable */}
      <div className="flex-1 overflow-y-auto bg-white border border-zinc-200 rounded-b-xl shadow-sm p-8 md:p-12">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

function escapeHtml(text: string) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
