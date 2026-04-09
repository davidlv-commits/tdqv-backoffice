"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { auth } from "@/lib/firebase";

const NAV = [
  { href: "/", label: "Dashboard", icon: "📊" },
  { href: "/books", label: "Libros", icon: "📚" },
  { href: "/music", label: "Música", icon: "🎵" },
  { href: "/media", label: "Media", icon: "🎬" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 border-r border-zinc-800 bg-zinc-950 flex flex-col">
      <div className="p-4 border-b border-zinc-800">
        <h1 className="text-lg font-bold text-amber-500">TDQV</h1>
        <p className="text-xs text-zinc-500">Backoffice</p>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {NAV.map((item) => {
          const active = pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                active
                  ? "bg-amber-500/10 text-amber-500"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
              }`}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
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
