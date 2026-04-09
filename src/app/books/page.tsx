"use client";

import Link from "next/link";
import { AuthGuard } from "@/components/auth-guard";
import { Sidebar } from "@/components/sidebar";

const BOOKS = [
  {
    id: "book1",
    title: "Tu de que vas",
    chapters: 77,
    subtitle: "Libro I",
  },
  {
    id: "book2",
    title: "Tu de que vas, pero no",
    chapters: 58,
    subtitle: "Libro II",
  },
];

export default function BooksPage() {
  return (
    <AuthGuard>
      <div className="flex h-screen">
        <Sidebar />
        <main className="flex-1 overflow-auto p-8">
          <h2 className="text-2xl font-bold mb-6">Libros</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {BOOKS.map((book) => (
              <Link
                key={book.id}
                href={`/books/${book.id}`}
                className="bg-zinc-800/60 border border-zinc-700/50 rounded-xl p-6 hover:border-amber-500/30 transition-colors block"
              >
                <p className="text-lg font-semibold">{book.title}</p>
                <p className="text-sm text-zinc-400 mt-1">{book.subtitle}</p>
                <p className="text-amber-500 font-mono text-sm mt-3">
                  {book.chapters} capitulos
                </p>
              </Link>
            ))}
          </div>
        </main>
      </div>
    </AuthGuard>
  );
}
