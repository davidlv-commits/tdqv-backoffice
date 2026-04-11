"use client";

import { Suspense, useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { AuthGuard } from "@/components/auth-guard";
import { Sidebar } from "@/components/sidebar";
import { Button } from "@/components/ui/button";
import { getTracks, saveTrack } from "@/lib/firestore";
import type { Track } from "@/lib/types";

export default function LrcSyncPageWrapper() {
  return (
    <Suspense fallback={<div className="p-8 text-zinc-500">Cargando...</div>}>
      <LrcSyncPage />
    </Suspense>
  );
}

function LrcSyncPage() {
  const searchParams = useSearchParams();
  const preselectedTrackId = searchParams.get("trackId");

  const [tracks, setTracks] = useState<Track[]>([]);
  const [selectedTrackId, setSelectedTrackId] = useState(preselectedTrackId || "");
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [timestamps, setTimestamps] = useState<number[]>([]);
  const [currentLineIndex, setCurrentLineIndex] = useState(0);
  const [saved, setSaved] = useState(false);
  const [mode, setMode] = useState<"idle" | "recording" | "done">("idle");

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const animFrameRef = useRef<number>(0);

  useEffect(() => {
    getTracks().then((t) => {
      // Only tracks with lyrics.
      const withLyrics = t.filter((tr) => tr.lyrics && tr.lyrics.trim().length > 0);
      setTracks(withLyrics);
      setLoading(false);
      if (preselectedTrackId && withLyrics.some((tr) => tr.id === preselectedTrackId)) {
        setSelectedTrackId(preselectedTrackId);
      }
    });
  }, [preselectedTrackId]);

  const selectedTrack = tracks.find((t) => t.id === selectedTrackId);
  const lines = (selectedTrack?.lyrics || "")
    .split("\n")
    .map((l) => l.replace(/\[\d{1,2}:\d{2}(?:\.\d{1,3})?\]/g, "").trim())
    .filter((l) => l.length > 0);

  // Keyboard handler: space = mark line.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.code === "Space" && mode === "recording") {
        e.preventDefault();
        markCurrentLine();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  const startRecording = useCallback(() => {
    if (!audioRef.current || !selectedTrack) return;

    setTimestamps([]);
    setCurrentLineIndex(0);
    setMode("recording");
    setSaved(false);

    audioRef.current.currentTime = 0;
    audioRef.current.play();
    setPlaying(true);

    // Update time display.
    const update = () => {
      if (audioRef.current) {
        setCurrentTime(audioRef.current.currentTime);
      }
      animFrameRef.current = requestAnimationFrame(update);
    };
    animFrameRef.current = requestAnimationFrame(update);
  }, [selectedTrack]);

  const markCurrentLine = useCallback(() => {
    if (mode !== "recording" || !audioRef.current) return;

    const time = audioRef.current.currentTime;
    setTimestamps((prev) => [...prev, time]);
    setCurrentLineIndex((prev) => {
      const next = prev + 1;
      if (next >= lines.length) {
        // All lines marked.
        setMode("done");
        audioRef.current?.pause();
        setPlaying(false);
        cancelAnimationFrame(animFrameRef.current);
      }
      return next;
    });
  }, [mode, lines.length]);

  const stopRecording = useCallback(() => {
    audioRef.current?.pause();
    setPlaying(false);
    setMode("idle");
    cancelAnimationFrame(animFrameRef.current);
  }, []);

  const generateLrc = useCallback(() => {
    if (timestamps.length === 0) return "";
    return lines
      .map((line, i) => {
        const t = timestamps[i] ?? 0;
        const min = Math.floor(t / 60);
        const sec = Math.floor(t % 60);
        const cs = Math.round((t % 1) * 100);
        return `[${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}.${String(cs).padStart(2, "0")}]${line}`;
      })
      .join("\n");
  }, [timestamps, lines]);

  const handleSave = useCallback(async () => {
    if (!selectedTrack) return;
    const lrc = generateLrc();
    await saveTrack({ id: selectedTrack.id, lyrics: lrc });
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }, [selectedTrack, generateLrc]);

  const formatTime = (t: number) => {
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    const cs = Math.round((t % 1) * 100);
    return `${m}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
  };

  return (
    <AuthGuard>
      <div className="flex h-screen">
        <Sidebar />
        <main className="flex-1 overflow-auto bg-slate-50">
          {/* Header */}
          <div className="sticky top-0 z-20 bg-slate-50 border-b border-zinc-200 px-8 py-4">
            <div className="flex items-center gap-3 max-w-3xl">
              <Link href="/music" className="text-zinc-400 hover:text-zinc-600 text-lg">←</Link>
              <div>
                <h2 className="text-xl font-bold text-zinc-900">Sincronizar letras</h2>
                <p className="text-sm text-zinc-500">
                  Escucha la canción y pulsa ESPACIO en cada línea para marcar el tiempo
                </p>
              </div>
            </div>
          </div>

          <div className="max-w-3xl mx-auto p-8 space-y-6">
            {loading ? (
              <p className="text-zinc-500">Cargando canciones...</p>
            ) : tracks.length === 0 ? (
              <p className="text-zinc-500">No hay canciones con letras. Añade letras primero en la página de Música.</p>
            ) : (
              <>
                {/* Track selector */}
                <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-sm">
                  <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2 block">
                    Canción
                  </label>
                  <select
                    value={selectedTrackId}
                    onChange={(e) => {
                      setSelectedTrackId(e.target.value);
                      setMode("idle");
                      setTimestamps([]);
                      setCurrentLineIndex(0);
                    }}
                    className="w-full border border-zinc-300 rounded-lg px-4 py-2 text-zinc-900 bg-white"
                  >
                    <option value="">Selecciona una canción...</option>
                    {tracks.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title} — {t.artist}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedTrack && (
                  <>
                    {/* Audio player (hidden controls) */}
                    <audio
                      ref={audioRef}
                      src={selectedTrack.audioUrl}
                      onEnded={() => {
                        setPlaying(false);
                        if (mode === "recording") setMode("done");
                        cancelAnimationFrame(animFrameRef.current);
                      }}
                    />

                    {/* Controls */}
                    <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-sm">
                      <div className="flex items-center gap-4">
                        <div className="text-2xl font-mono text-zinc-700 tabular-nums min-w-[100px]">
                          {formatTime(currentTime)}
                        </div>

                        {mode === "idle" && (
                          <Button
                            onClick={startRecording}
                            className="bg-red-500 hover:bg-red-600 text-white"
                            disabled={lines.length === 0}
                          >
                            ● Empezar grabación
                          </Button>
                        )}

                        {mode === "recording" && (
                          <>
                            <Button
                              onClick={markCurrentLine}
                              className="bg-amber-600 hover:bg-amber-700 text-white px-6 h-12 text-lg"
                            >
                              ⏎ Marcar línea ({currentLineIndex + 1}/{lines.length})
                            </Button>
                            <Button
                              variant="outline"
                              onClick={stopRecording}
                              className="border-zinc-300"
                            >
                              ■ Parar
                            </Button>
                            <span className="text-xs text-zinc-400">
                              o pulsa ESPACIO
                            </span>
                          </>
                        )}

                        {mode === "done" && (
                          <>
                            <Button
                              onClick={handleSave}
                              className="bg-green-600 hover:bg-green-700 text-white"
                            >
                              Guardar LRC sincronizado
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() => { setMode("idle"); setTimestamps([]); setCurrentLineIndex(0); }}
                              className="border-zinc-300"
                            >
                              Repetir
                            </Button>
                            {saved && <span className="text-green-600 text-sm">✓ Guardado</span>}
                          </>
                        )}
                      </div>
                    </div>

                    {/* Lyrics lines */}
                    <div className="bg-white border border-zinc-200 rounded-xl shadow-sm divide-y divide-zinc-100">
                      {lines.map((line, i) => {
                        const isMarked = i < timestamps.length;
                        const isCurrent = mode === "recording" && i === currentLineIndex;
                        const ts = timestamps[i];

                        return (
                          <div
                            key={i}
                            className={`px-5 py-3 flex items-center gap-4 transition-colors ${
                              isCurrent
                                ? "bg-amber-50 border-l-4 border-amber-500"
                                : isMarked
                                ? "bg-green-50/50"
                                : ""
                            }`}
                          >
                            {/* Line number */}
                            <span className="text-xs text-zinc-400 font-mono w-6 text-right flex-shrink-0">
                              {i + 1}
                            </span>

                            {/* Timestamp */}
                            <span className={`text-xs font-mono w-16 flex-shrink-0 ${
                              isMarked ? "text-green-600" : "text-zinc-300"
                            }`}>
                              {isMarked ? formatTime(ts!) : "--:--.--"}
                            </span>

                            {/* Lyric text */}
                            <span className={`flex-1 ${
                              isCurrent
                                ? "text-amber-800 font-semibold"
                                : isMarked
                                ? "text-zinc-700"
                                : "text-zinc-400"
                            }`}>
                              {line}
                            </span>

                            {/* Status */}
                            {isMarked && (
                              <span className="text-green-500 text-sm">✓</span>
                            )}
                            {isCurrent && (
                              <span className="text-amber-500 text-sm animate-pulse">●</span>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* LRC Preview */}
                    {mode === "done" && timestamps.length > 0 && (
                      <div className="bg-zinc-900 rounded-xl p-5 shadow-sm">
                        <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">
                          Preview LRC generado
                        </h4>
                        <pre className="text-sm text-green-400 font-mono whitespace-pre-wrap leading-relaxed">
                          {generateLrc()}
                        </pre>
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        </main>
      </div>
    </AuthGuard>
  );
}
