"use client";

import { Node, mergeAttributes } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";

// Custom TipTap node for media hooks inside the text.
export const MediaBlock = Node.create({
  name: "mediaBlock",
  group: "block",
  atom: true,

  addAttributes() {
    return {
      mediaType: { default: "music" },
      mediaId: { default: "" },
      title: { default: "" },
      mediaUrl: { default: "" },
      isExclusive: { default: true },
      displayStyle: { default: "inline" },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-media-block]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-media-block": "" })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(MediaBlockView);
  },
});

// Visual component for the media block inside the editor.
function MediaBlockView({ node, deleteNode, selected }: NodeViewProps) {
  const { mediaType, title, mediaUrl } = node.attrs;

  const typeColors: Record<string, string> = {
    music: "bg-purple-50 border-purple-200 text-purple-700",
    audio: "bg-blue-50 border-blue-200 text-blue-700",
    video: "bg-red-50 border-red-200 text-red-700",
    image: "bg-green-50 border-green-200 text-green-700",
  };

  const typeIcons: Record<string, string> = {
    music: "🎵",
    audio: "🎙️",
    video: "🎬",
    image: "🖼️",
  };

  return (
    <NodeViewWrapper>
      <div
        className={`my-3 flex items-center gap-3 rounded-lg border px-4 py-3 ${
          typeColors[mediaType] || typeColors.music
        } ${selected ? "ring-2 ring-amber-500" : ""}`}
        contentEditable={false}
      >
        <span className="text-lg">{typeIcons[mediaType] || "📎"}</span>
        <div className="flex-1 min-w-0">
          <span className="text-sm font-semibold">{title || "Sin título"}</span>
          <span className="text-xs ml-2 opacity-60">{mediaType}</span>
        </div>
        {mediaUrl && mediaType === "music" && (
          <audio controls className="h-8 max-w-[180px]">
            <source src={mediaUrl} type="audio/mp4" />
          </audio>
        )}
        <button
          onClick={deleteNode}
          className="text-zinc-400 hover:text-red-500 text-sm flex-shrink-0"
          title="Eliminar"
        >
          ✕
        </button>
      </div>
    </NodeViewWrapper>
  );
}
