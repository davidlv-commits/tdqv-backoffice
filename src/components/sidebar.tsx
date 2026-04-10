"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { auth } from "@/lib/firebase";

const MEDIA_ITEMS = [
  { href: "/books", label: "Libros", icon: "📚" },
  { href: "/music", label: "Música", icon: "🎵" },
  { href: "/images", label: "Imágenes", icon: "🖼️" },
  { href: "/videos", label: "Vídeos", icon: "🎬" },
  { href: "/audios", label: "Audios", icon: "🎙️" },
];

export function Sidebar() {
  const pathname = usePathname();
  const isMediaActive = MEDIA_ITEMS.some(
    (item) =>
      pathname === item.href || pathname.startsWith(item.href + "/")
  );
  const [mediaOpen, setMediaOpen] = useState(isMediaActive);

  return (
    <aside className="w-56 border-r border-zinc-800 bg-zinc-950 flex flex-col">
      <div className="p-4 border-b border-zinc-800">
        <h1 className="text-lg font-bold text-amber-500">TDQV</h1>
        <p className="text-xs text-zinc-500">Backoffice</p>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {/* Dashboard */}
        <Link
          href="/"
          className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
            pathname === "/"
              ? "bg-amber-500/10 text-amber-500"
              : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
          }`}
        >
          <span>📊</span>
          Dashboard
        </Link>

        {/* Media section */}
        <button
          onClick={() => setMediaOpen(!mediaOpen)}
          className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors w-full text-left ${
            isMediaActive
              ? "bg-amber-500/10 text-amber-500"
              : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
          }`}
        >
          <span>🎬</span>
          <span className="flex-1">Media</span>
          <svg
            className={`w-3.5 h-3.5 transition-transform ${
              mediaOpen ? "rotate-180" : ""
            }`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {mediaOpen && (
          <div className="ml-4 space-y-0.5">
            {MEDIA_ITEMS.map((item) => {
              const active =
                pathname === item.href ||
                (item.href !== "/" && pathname.startsWith(item.href + "/"));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                    active
                      ? "bg-amber-500/10 text-amber-500"
                      : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
                  }`}
                >
                  <span className="text-xs">{item.icon}</span>
                  {item.label}
                </Link>
              );
            })}
          </div>
        )}
      </nav>

      <div className="p-3 border-t border-zinc-800">
        <button
          onClick={() => auth.signOut()}
          className="w-full text-left px-3 py-2 text-sm text-zinc-500 hover:text-zinc-300 rounded-lg hover:bg-zinc-800/50 transition-colors"
        >
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
