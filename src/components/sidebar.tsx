"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { auth } from "@/lib/firebase";

const MEDIA_ITEMS = [
  { href: "/books", label: "Libros", icon: "📚" },
  { href: "/music", label: "Música", icon: "🎵" },
  { href: "/music/sync", label: "Sincro LRC", icon: "⏱️" },
  { href: "/images", label: "Imágenes", icon: "🖼️" },
  { href: "/videos", label: "Vídeos", icon: "🎬" },
  { href: "/audios", label: "Audios", icon: "🎙️" },
];

const ANALYTICS_ITEMS = [
  { href: "/analytics", label: "Resumen", icon: "📊" },
  { href: "/analytics/users", label: "Usuarios", icon: "👥" },
  { href: "/analytics/points", label: "Puntos y Ranking", icon: "🏆" },
  { href: "/analytics/referrals", label: "Referidos", icon: "🔗" },
  { href: "/analytics/reading", label: "Lectura", icon: "📖" },
  { href: "/analytics/music", label: "Música", icon: "🎧" },
  { href: "/analytics/milestones", label: "Hitos y Premios", icon: "🎁" },
];

export function Sidebar() {
  const pathname = usePathname();
  const isMediaActive = MEDIA_ITEMS.some(
    (item) => pathname === item.href || pathname.startsWith(item.href + "/")
  );
  const isAnalyticsActive = ANALYTICS_ITEMS.some(
    (item) => pathname === item.href || pathname.startsWith(item.href + "/")
  );
  const [mediaOpen, setMediaOpen] = useState(isMediaActive);
  const [analyticsOpen, setAnalyticsOpen] = useState(isAnalyticsActive);

  return (
    <aside className="w-56 border-r border-zinc-800 bg-zinc-950 flex flex-col">
      <div className="p-4 border-b border-zinc-800">
        <h1 className="text-lg font-bold text-amber-500">TDQV</h1>
        <p className="text-xs text-zinc-500">Backoffice</p>
      </div>

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {/* Dashboard */}
        <Link
          href="/"
          className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
            pathname === "/"
              ? "bg-amber-500/10 text-amber-500"
              : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
          }`}
        >
          <span>🏠</span>
          Dashboard
        </Link>

        {/* Media section */}
        <SidebarSection
          label="Media"
          icon="🎬"
          isActive={isMediaActive}
          isOpen={mediaOpen}
          onToggle={() => setMediaOpen(!mediaOpen)}
          items={MEDIA_ITEMS}
          pathname={pathname}
        />

        {/* Analytics & Gamification */}
        <SidebarSection
          label="Analytics"
          icon="📈"
          isActive={isAnalyticsActive}
          isOpen={analyticsOpen}
          onToggle={() => setAnalyticsOpen(!analyticsOpen)}
          items={ANALYTICS_ITEMS}
          pathname={pathname}
        />
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

function SidebarSection({
  label,
  icon,
  isActive,
  isOpen,
  onToggle,
  items,
  pathname,
}: {
  label: string;
  icon: string;
  isActive: boolean;
  isOpen: boolean;
  onToggle: () => void;
  items: { href: string; label: string; icon: string }[];
  pathname: string;
}) {
  return (
    <>
      <button
        onClick={onToggle}
        className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors w-full text-left ${
          isActive
            ? "bg-amber-500/10 text-amber-500"
            : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
        }`}
      >
        <span>{icon}</span>
        <span className="flex-1">{label}</span>
        <svg
          className={`w-3.5 h-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && (
        <div className="ml-4 space-y-0.5">
          {items.map((item) => {
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
    </>
  );
}
