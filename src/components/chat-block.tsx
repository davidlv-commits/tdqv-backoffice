"use client";

import { Node, mergeAttributes } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";

/// TipTap node for chat messages inside chapters.
/// sender: "mine" | "theirs" | "other"
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

function ChatBlockView({ node, updateAttributes, selected }: NodeViewProps) {
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
    <NodeViewWrapper>
      <div className={`my-2 max-w-[80%] ${align} ${selected ? "ring-2 ring-amber-500" : ""}`}>
        {/* Sender toggle */}
        <div className="flex items-center gap-2 mb-1">
          <button
            onClick={() => updateAttributes({ sender: "mine" })}
            className={`text-[10px] px-2 py-0.5 rounded-full border ${
              isMine ? "bg-amber-100 border-amber-300 text-amber-700 font-bold" : "border-zinc-200 text-zinc-400"
            }`}
            contentEditable={false}
          >
            David
          </button>
          <button
            onClick={() => updateAttributes({ sender: "theirs" })}
            className={`text-[10px] px-2 py-0.5 rounded-full border ${
              isTheirs ? "bg-purple-100 border-purple-300 text-purple-700 font-bold" : "border-zinc-200 text-zinc-400"
            }`}
            contentEditable={false}
          >
            Ella
          </button>
          <button
            onClick={() => updateAttributes({ sender: "other" })}
            className={`text-[10px] px-2 py-0.5 rounded-full border ${
              sender === "other" ? "bg-blue-100 border-blue-300 text-blue-700 font-bold" : "border-zinc-200 text-zinc-400"
            }`}
            contentEditable={false}
          >
            Otro
          </button>
          {sender === "other" && (
            <input
              type="text"
              value={senderName}
              onChange={(e) => updateAttributes({ senderName: e.target.value })}
              placeholder="Nombre..."
              className="text-[10px] px-2 py-0.5 border border-zinc-200 rounded w-20"
              contentEditable={false}
            />
          )}
        </div>

        {/* Chat bubble */}
        <div
          className={`rounded-2xl border px-4 py-2.5 ${bgColor} ${
            isMine ? "rounded-bl-sm" : "rounded-br-sm"
          }`}
        >
          <span className={`text-[9px] font-semibold ${labelColor} block mb-0.5`}>
            {label}
          </span>
          {/* Editable content */}
          <div className="text-sm text-zinc-800 leading-relaxed" contentEditable suppressContentEditableWarning>
            {/* TipTap handles the content */}
          </div>
        </div>
      </div>
    </NodeViewWrapper>
  );
}
