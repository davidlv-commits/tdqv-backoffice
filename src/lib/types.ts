export interface Book {
  id: string;
  title: string;
  author: string;
  totalChapters: number;
  coverUrl: string;
  status: 'active' | 'draft';
}

export type ReactionType = 'me_rompio' | 'no_esperaba' | 'brutal' | 'precioso' | 'estoy_muerto' | 'me_parti';

export interface Chapter {
  id: string;
  bookId: string;
  title: string;
  order: number;
  body: string; // Texto completo con \n\n entre párrafos
  paragraphCount: number;
  status: 'published' | 'draft';
  mediaMomentCount?: number;
  availableReactions?: ReactionType[];
}

export type MediaType = 'music' | 'audio' | 'video' | 'image' | 'chat';
export type DisplayStyle = 'inline' | 'fullscreen' | 'ambient';

export interface MediaMoment {
  id: string;
  bookId: string;
  chapterId: string;
  paragraphIndex: number; // Después de qué párrafo (0-based)
  mediaType: MediaType;
  mediaId: string;
  title: string;
  mediaUrl: string;
  isExclusive: boolean; // Bloqueado hasta completar capítulo
  displayStyle: DisplayStyle;
  autoplay?: boolean;
  initialVolume?: number;
  crossfadeWithId?: string;
  unlockMessage?: string;
  order: number; // Si hay varios en el mismo párrafo
  active: boolean;
}

export interface Track {
  id: string;
  title: string;
  artist: string;
  album: string;
  audioUrl: string;
  coverUrl: string;
  isInstrumental: boolean;
  linkedMainTrackId?: string;
  duration?: number;
  order: number;
  active: boolean;
  lyrics?: string;
  style?: string;
  /** false = solo banda sonora de fondo (no aparece en el reproductor). Default true. */
  showInLibrary?: boolean;
  lockedUntilChapter?: string;
  lockedUntilChapterTitle?: string;
  isLockedByChapter?: boolean;
}

export type VideoSource = 'youtube' | 'r2' | 'url';

export interface Video {
  id: string;
  title: string;
  description?: string;
  source: VideoSource;
  youtubeId?: string;       // ID de YouTube (ej: jVmXHY6X0vQ)
  videoUrl?: string;        // URL directa (R2 o externa)
  thumbnailUrl?: string;    // Thumbnail personalizado o auto de YouTube
  duration?: number;
  order: number;
  active: boolean;
  lockedUntilChapter?: string;
  lockedUntilChapterTitle?: string;
  isLockedByChapter?: boolean;
}
