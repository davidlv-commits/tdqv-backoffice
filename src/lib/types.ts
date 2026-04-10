export interface Book {
  id: string;
  title: string;
  author: string;
  totalChapters: number;
  coverUrl: string;
  status: 'active' | 'draft';
}

export interface Chapter {
  id: string;
  bookId: string;
  title: string;
  order: number;
  body: string; // Texto completo con \n\n entre párrafos
  paragraphCount: number;
  status: 'published' | 'draft';
  mediaMomentCount?: number;
}

export type MediaType = 'music' | 'audio' | 'video' | 'image';
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
  lockedUntilChapter?: string;  // chapter ID that unlocks this track
  lockedUntilChapterTitle?: string;  // chapter title for display
  isLockedByChapter?: boolean;  // whether track is locked until chapter is read
}
