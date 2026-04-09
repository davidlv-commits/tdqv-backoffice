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
        <main className="flex-1 overflow-auto bg-slate-50 p-8">
          <h2 className="text-2xl font-bold text-zinc-900 mb-6">Libros</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {BOOKS.map((book) => (
              <Link
                key={book.id}
                href={`/books/${book.id}`}
                className="bg-white border border-zinc-200 rounded-xl p-6 hover:border-amber-500/40 hover:shadow-md transition-all block"
              >
                <p className="text-lg font-semibold text-zinc-900">{book.title}</p>
                <p className="text-sm text-zinc-500 mt-1">{book.subtitle}</p>
                <p className="text-amber-600 font-mono text-sm mt-3">
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
