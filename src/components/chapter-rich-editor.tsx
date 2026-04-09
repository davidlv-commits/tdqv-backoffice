"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { MediaBlock } from "./media-block";
import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { MediaType } from "@/lib/types";

interface ChapterRichEditorProps {
  initialContent: string; // body with \n\n between paragraphs
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
}

export function ChapterRichEditor({
  initialContent,
  onSave,
  existingHooks = [],
}: ChapterRichEditorProps) {
  const [saving, setSaving] = useState(false);
  const [showInsert, setShowInsert] = useState(false);
  const [insertType, setInsertType] = useState<MediaType>("music");
  const [insertTitle, setInsertTitle] = useState("");
  const [insertUrl, setInsertUrl] = useState("");

  // Convert body text to TipTap HTML.
  const bodyToHtml = (body: string, hooks: MediaHook[]) => {
    const paragraphs = body.split("\n\n").filter((p) => p.trim());
    let html = paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join("");

    // Insert existing hooks as media blocks (at end for now, will be positioned by backoffice)
    for (const hook of hooks) {
      html += `<div data-media-block data-media-type="${hook.mediaType}" data-title="${escapeHtml(hook.title)}" data-media-url="${hook.mediaUrl}"></div>`;
    }

    return html;
  };

  // Convert TipTap content back to body text + media hooks.
  const htmlToBody = (editor: ReturnType<typeof useEditor>) => {
    if (!editor) return { body: "", hooks: [] as MediaHook[] };

    const json = editor.getJSON();
    const paragraphs: string[] = [];
    const hooks: MediaHook[] = [];

    for (const node of json.content || []) {
      if (node.type === "paragraph") {
        const text = (node.content || [])
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .map((c: any) => c.text || "")
          .join("");
        if (text.trim()) paragraphs.push(text);
      } else if (node.type === "mediaBlock") {
        hooks.push({
          mediaType: (node.attrs?.mediaType || "music") as MediaType,
          mediaId: node.attrs?.mediaId || "",
          title: node.attrs?.title || "",
          mediaUrl: node.attrs?.mediaUrl || "",
          isExclusive: node.attrs?.isExclusive ?? true,
          displayStyle: node.attrs?.displayStyle || "inline",
        });
      }
    }

    return { body: paragraphs.join("\n\n"), hooks };
  };

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
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
    content: bodyToHtml(initialContent, existingHooks),
    editorProps: {
      attributes: {
        class:
          "prose prose-zinc max-w-none focus:outline-none min-h-[400px] text-[15px] leading-[1.9] text-zinc-800",
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
    if (!editor || !insertTitle) return;

    editor
      .chain()
      .focus()
      .insertContent({
        type: "mediaBlock",
        attrs: {
          mediaType: insertType,
          mediaId: insertTitle.toLowerCase().replace(/\s+/g, "-"),
          title: insertTitle,
          mediaUrl: insertUrl,
          isExclusive: true,
          displayStyle: "inline",
        },
      })
      .run();

    setShowInsert(false);
    setInsertTitle("");
    setInsertUrl("");
  }, [editor, insertType, insertTitle, insertUrl]);

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
            Pon el cursor donde quieras insertar el contenido multimedia
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
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-3 flex items-end gap-3">
          <div className="w-32">
            <Label className="text-xs text-zinc-500">Tipo</Label>
            <Select
              value={insertType}
              onValueChange={(v) => setInsertType(v as MediaType)}
            >
              <SelectTrigger className="bg-white border-zinc-300 text-zinc-900 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="music">🎵 Música</SelectItem>
                <SelectItem value="audio">🎙️ Audio</SelectItem>
                <SelectItem value="video">🎬 Vídeo</SelectItem>
                <SelectItem value="image">🖼️ Imagen</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1">
            <Label className="text-xs text-zinc-500">Título</Label>
            <Input
              value={insertTitle}
              onChange={(e) => setInsertTitle(e.target.value)}
              placeholder="Nombre del contenido"
              className="bg-white border-zinc-300 text-zinc-900 h-9"
            />
          </div>
          <div className="flex-1">
            <Label className="text-xs text-zinc-500">URL (opcional)</Label>
            <Input
              value={insertUrl}
              onChange={(e) => setInsertUrl(e.target.value)}
              placeholder="https://..."
              className="bg-white border-zinc-300 text-zinc-900 h-9"
            />
          </div>
          <Button
            size="sm"
            onClick={handleInsertMedia}
            disabled={!insertTitle}
            className="bg-amber-600 hover:bg-amber-700 text-white h-9"
          >
            Insertar
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowInsert(false)}
            className="h-9"
          >
            ✕
          </Button>
        </div>
      )}

      {/* Editor */}
      <div className="bg-white border border-zinc-200 rounded-b-xl shadow-sm p-8 md:p-12">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

function escapeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
