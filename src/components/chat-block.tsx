"use client";

import { Node, mergeAttributes } from "@tiptap/core";
import { NodeViewWrapper, NodeViewContent, ReactNodeViewRenderer } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";

/// TipTap node for chat messages inside chapters.
/// Uses NodeViewContent for editable text inside the bubble.
export const ChatBlock = Node.create({
  name: "chatBlock",
  group: "block",
  content: "inline*",

  addAttributes() {
    return {
      sender: { default: "mine" },
      senderName: { default: "" },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-chat-block]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-chat-block": "" }), 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ChatBlockView);
  },
});

function ChatBlockView({ node, updateAttributes, deleteNode, selected }: NodeViewProps) {
  const { sender, senderName } = node.attrs;

  const isMine = sender === "mine";
  const isTheirs = sender === "theirs";

  const bgColor = isMine
    ? "bg-amber-50 border-amber-200"
    : isTheirs
    ? "bg-purple-50 border-purple-200"
    : "bg-blue-50 border-blue-200";

  const align = isMine ? "mr-auto" : "ml-auto";
  const label = isMine ? "David" : senderName || "Azahara";
  const labelColor = isMine ? "text-amber-600" : isTheirs ? "text-purple-600" : "text-blue-600";

  return (
    <NodeViewWrapper className={`my-2 max-w-[80%] ${align}`}>
      <div className={`rounded-2xl border px-4 py-2.5 ${bgColor} ${
        isMine ? "rounded-bl-sm" : "rounded-br-sm"
      } ${selected ? "ring-2 ring-amber-500" : ""}`}>
        {/* Sender controls */}
        <div className="flex items-center gap-1.5 mb-1" contentEditable={false}>
          <button
            onClick={() => updateAttributes({ sender: "mine" })}
            className={`text-[10px] px-1.5 py-0.5 rounded-full border ${
              isMine ? "bg-amber-100 border-amber-300 text-amber-700 font-bold" : "border-zinc-200 text-zinc-400"
            }`}
          >
            D
          </button>
          <button
            onClick={() => updateAttributes({ sender: "theirs" })}
            className={`text-[10px] px-1.5 py-0.5 rounded-full border ${
              isTheirs ? "bg-purple-100 border-purple-300 text-purple-700 font-bold" : "border-zinc-200 text-zinc-400"
            }`}
          >
            A
          </button>
          <button
            onClick={() => updateAttributes({ sender: "other" })}
            className={`text-[10px] px-1.5 py-0.5 rounded-full border ${
              sender === "other" ? "bg-blue-100 border-blue-300 text-blue-700 font-bold" : "border-zinc-200 text-zinc-400"
            }`}
          >
            +
          </button>
          {sender === "other" && (
            <input
              type="text"
              value={senderName}
              onChange={(e) => updateAttributes({ senderName: e.target.value })}
              placeholder="Nombre..."
              className="text-[10px] px-1.5 py-0.5 border border-zinc-200 rounded w-16 bg-white"
            />
          )}
          <span className={`text-[10px] font-semibold ${labelColor} ml-1`}>{label}</span>
          <button
            onClick={deleteNode}
            className="text-zinc-300 hover:text-red-400 text-xs ml-auto"
          >
            ✕
          </button>
        </div>

        {/* Editable message content — TipTap manages this */}
        <NodeViewContent className="text-sm text-zinc-800 leading-relaxed outline-none" />
      </div>
    </NodeViewWrapper>
  );
}
