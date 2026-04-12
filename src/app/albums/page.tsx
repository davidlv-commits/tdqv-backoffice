"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { AuthGuard } from "@/components/auth-guard";
import { Sidebar } from "@/components/sidebar";
import { Button } from "@/components/ui/button";
import {
  getAlbums,
  saveAlbum,
  getTracks,
  type Album,
} from "@/lib/firestore";
import type { Track } from "@/lib/types";
import { uploadFile } from "@/lib/upload";

export default function AlbumsPage() {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [uploading, setUploading] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  const loadData = useCallback(async () => {
    try {
      const [albumsData, tracksData] = await Promise.all([
        getAlbums(),
        getTracks(),
      ]);
      setAlbums(albumsData);
      setTracks(tracksData);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const flash = (msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(""), 3000);
  };

  // Detect albums from tracks (group by album field).
  const detectedAlbums = new Map<string, { count: number; firstCover: string }>();
  for (const t of tracks) {
    const name = t.album || "Sin álbum";
    const existing = detectedAlbums.get(name);
    if (existing) {
      existing.count++;
    } else {
      detectedAlbums.set(name, { count: 1, firstCover: t.coverUrl || "" });
    }
  }

  // Merge detected albums with saved album data.
  const mergedAlbums = Array.from(detectedAlbums.entries()).map(
    ([name, { count, firstCover }]) => {
      const saved = albums.find((a) => a.name === name);
      return {
        name,
        trackCount: count,
        coverUrl: saved?.coverUrl || "",
        firstTrackCover: firstCover,
        id: saved?.id || "",
      };
    }
  );

  const handleUploadCover = useCallback(
    async (albumName: string, file: File) => {
      setUploading(albumName);
      setUploadProgress(0);

      try {
        const publicUrl = await uploadFile(file, "covers/albums", (p) =>
          setUploadProgress(p)
        );

        // Find or create album document.
        const existing = albums.find((a) => a.name === albumName);
        const albumId =
          existing?.id ||
          albumName
            .toLowerCase()
            .replace(/[^a-z0-9]/g, "-")
            .replace(/-+/g, "-");

        await saveAlbum({
          id: albumId,
          name: albumName,
          coverUrl: publicUrl,
        });

        flash(`Carátula de "${albumName}" actualizada`);
        await loadData();
      } catch (e) {
        console.error(e);
        flash("Error al subir la carátula");
      }
      setUploading(null);
      setUploadProgress(0);
    },
    [albums, loadData]
  );

  return (
    <AuthGuard>
      <div className="flex h-screen">
        <Sidebar />
        <main className="flex-1 overflow-auto bg-slate-50 p-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-zinc-900">
                Álbumes
              </h2>
              <p className="text-sm text-zinc-500">
                {mergedAlbums.length} álbumes detectados ·{" "}
                {tracks.length} tracks totales
              </p>
            </div>
            {message && (
              <span
                className={`text-sm font-medium ${
                  message.includes("Error")
                    ? "text-red-500"
                    : "text-green-600"
                }`}
              >
                {message}
              </span>
            )}
          </div>

          {loading ? (
            <p className="text-zinc-500">Cargando...</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {mergedAlbums.map((album) => (
                <AlbumCard
                  key={album.name}
                  album={album}
                  isUploading={uploading === album.name}
                  uploadProgress={uploadProgress}
                  onUpload={(file) => handleUploadCover(album.name, file)}
                />
              ))}
            </div>
          )}
        </main>
      </div>
    </AuthGuard>
  );
}

// ═══════════════════════════════════════
// Album Card
// ═══════════════════════════════════════

function AlbumCard({
  album,
  isUploading,
  uploadProgress,
  onUpload,
}: {
  album: {
    name: string;
    trackCount: number;
    coverUrl: string;
    firstTrackCover: string;
  };
  isUploading: boolean;
  uploadProgress: number;
  onUpload: (file: File) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const displayCover = album.coverUrl || album.firstTrackCover;
  const hasCustomCover = !!album.coverUrl;

  const handleFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      alert("Solo se permiten archivos de imagen");
      return;
    }
    onUpload(file);
  };

  return (
    <div
      className={`bg-white border rounded-xl overflow-hidden shadow-sm transition-all ${
        isDragging
          ? "border-amber-500 ring-2 ring-amber-500/20"
          : "border-zinc-200"
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) handleFile(file);
      }}
    >
      {/* Cover preview */}
      <div className="relative aspect-square bg-zinc-100">
        {displayCover ? (
          <img
            src={displayCover}
            alt={album.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-zinc-100 to-zinc-200">
            <span className="text-6xl opacity-20">💿</span>
          </div>
        )}

        {/* Upload overlay */}
        {isUploading && (
          <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center">
            <div className="w-3/4 h-2 bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-500 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            <p className="text-white text-sm mt-2 font-medium">
              {uploadProgress}%
            </p>
          </div>
        )}

        {isDragging && !isUploading && (
          <div className="absolute inset-0 bg-amber-500/20 flex items-center justify-center border-2 border-dashed border-amber-500 m-2 rounded-lg">
            <p className="text-amber-700 font-semibold text-sm">
              Suelta la imagen aquí
            </p>
          </div>
        )}

        {/* Badge */}
        {hasCustomCover && (
          <div className="absolute top-2 right-2 bg-green-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
            Personalizada
          </div>
        )}
        {!hasCustomCover && displayCover && (
          <div className="absolute top-2 right-2 bg-zinc-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
            Auto (1ª canción)
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-4">
        <h3 className="font-semibold text-zinc-900 text-sm">{album.name}</h3>
        <p className="text-xs text-zinc-500 mt-0.5">
          {album.trackCount} canciones
        </p>

        <div className="mt-3 flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
          <Button
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="flex-1 bg-amber-600 hover:bg-amber-700 text-white text-xs h-8"
          >
            {hasCustomCover ? "Cambiar carátula" : "Subir carátula"}
          </Button>
        </div>

        <p className="text-[10px] text-zinc-400 mt-2 text-center">
          O arrastra una imagen sobre la tarjeta
        </p>
      </div>
    </div>
  );
}
