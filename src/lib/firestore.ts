import {
  collection, doc, getDocs, getDoc, setDoc, updateDoc, deleteDoc,
  query, where, orderBy, addDoc, Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import type { Book, Chapter, MediaMoment, Track, Video } from './types';

// ═══ Books ═══

export async function getBooks(): Promise<Book[]> {
  const snap = await getDocs(collection(db, 'books'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Book));
}

export async function getBook(bookId: string): Promise<Book | null> {
  const snap = await getDoc(doc(db, 'books', bookId));
  return snap.exists() ? { id: snap.id, ...snap.data() } as Book : null;
}

export async function saveBook(book: Partial<Book> & { id: string }) {
  const { id, ...data } = book;
  await setDoc(doc(db, 'books', id), data, { merge: true });
}

// ═══ Chapters ═══

export async function getChapters(bookId: string): Promise<Chapter[]> {
  const q = query(
    collection(db, 'books', bookId, 'chapters'),
    orderBy('order'),
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, bookId, ...d.data() } as Chapter));
}

export async function getChapter(bookId: string, chapterId: string): Promise<Chapter | null> {
  const snap = await getDoc(doc(db, 'books', bookId, 'chapters', chapterId));
  return snap.exists() ? { id: snap.id, bookId, ...snap.data() } as Chapter : null;
}

export async function saveChapter(bookId: string, chapter: Partial<Chapter> & { id: string }) {
  const { id, ...data } = chapter;
  await setDoc(doc(db, 'books', bookId, 'chapters', id), {
    ...data,
    updatedAt: Timestamp.now(),
  }, { merge: true });
}

export async function addChapter(bookId: string, chapter: Omit<Chapter, 'id' | 'bookId'>) {
  const ref = await addDoc(collection(db, 'books', bookId, 'chapters'), {
    ...chapter,
    updatedAt: Timestamp.now(),
  });
  return ref;
}

export async function deleteChapter(bookId: string, chapterId: string) {
  await deleteDoc(doc(db, 'books', bookId, 'chapters', chapterId));
}

/**
 * Renumber all chapters from `startOrder` onwards by incrementing their order by `delta`.
 * Used after splits/inserts to push subsequent chapters down.
 */
export async function renumberChaptersFrom(
  bookId: string,
  startOrder: number,
  delta: number = 1,
  excludeId?: string,
) {
  const chapters = await getChapters(bookId);
  const toUpdate = chapters.filter(
    (ch) => ch.order >= startOrder && ch.id !== excludeId
  );
  for (const ch of toUpdate) {
    await setDoc(
      doc(db, 'books', bookId, 'chapters', ch.id),
      { order: ch.order + delta, updatedAt: Timestamp.now() },
      { merge: true },
    );
  }
}

/**
 * Split a chapter at a given paragraph index.
 * Everything from paragraphIndex onwards goes into a new chapter.
 * Subsequent chapters are renumbered.
 * Media moments are reassigned accordingly.
 */
export async function splitChapter(
  bookId: string,
  chapterId: string,
  splitAtParagraph: number,
  newChapterTitle: string,
) {
  const chapter = await getChapter(bookId, chapterId);
  if (!chapter) throw new Error('Chapter not found');

  const paragraphs = chapter.body.split('\n\n').filter((p) => p.trim());
  if (splitAtParagraph <= 0 || splitAtParagraph >= paragraphs.length) {
    throw new Error('Invalid split position');
  }

  const bodyBefore = paragraphs.slice(0, splitAtParagraph).join('\n\n');
  const bodyAfter = paragraphs.slice(splitAtParagraph).join('\n\n');

  // Renumber chapters after the current one to make room.
  await renumberChaptersFrom(bookId, chapter.order + 1);

  // Create the new chapter with the second half.
  const newChapterRef = await addChapter(bookId, {
    title: newChapterTitle,
    order: chapter.order + 1,
    body: bodyAfter,
    paragraphCount: paragraphs.length - splitAtParagraph,
    status: chapter.status,
    mediaMomentCount: 0,
  });

  // Update the original chapter with the first half.
  await saveChapter(bookId, {
    id: chapterId,
    body: bodyBefore,
    paragraphCount: splitAtParagraph,
  });

  // Reassign media moments: those at or after splitAtParagraph go to the new chapter.
  const moments = await getMediaMoments(bookId, chapterId);
  let newChapterMediaCount = 0;
  let oldChapterMediaCount = 0;

  for (const m of moments) {
    if (m.paragraphIndex >= splitAtParagraph) {
      // Move to new chapter with adjusted paragraphIndex.
      await deleteMediaMoment(m.id);
      await saveMediaMoment({
        bookId,
        chapterId: newChapterRef.id,
        paragraphIndex: m.paragraphIndex - splitAtParagraph,
        mediaType: m.mediaType,
        mediaId: m.mediaId,
        title: m.title,
        mediaUrl: m.mediaUrl,
        isExclusive: m.isExclusive,
        displayStyle: m.displayStyle,
        autoplay: m.autoplay,
        initialVolume: m.initialVolume,
        crossfadeWithId: m.crossfadeWithId,
        order: m.order,
        active: m.active,
      });
      newChapterMediaCount++;
    } else {
      oldChapterMediaCount++;
    }
  }

  // Update media moment counts.
  await saveChapter(bookId, { id: chapterId, mediaMomentCount: oldChapterMediaCount });
  await saveChapter(bookId, { id: newChapterRef.id, mediaMomentCount: newChapterMediaCount });

  return newChapterRef.id;
}

/**
 * Compact renumber: set all chapter orders to sequential 1, 2, 3...
 */
export async function compactRenumberChapters(bookId: string) {
  const chapters = await getChapters(bookId);
  for (let i = 0; i < chapters.length; i++) {
    if (chapters[i].order !== i + 1) {
      await setDoc(
        doc(db, 'books', bookId, 'chapters', chapters[i].id),
        { order: i + 1, updatedAt: Timestamp.now() },
        { merge: true },
      );
    }
  }
}

// ═══ Media Moments ═══

export async function getMediaMoments(bookId: string, chapterId: string): Promise<MediaMoment[]> {
  // Only filter by equality fields to avoid needing a composite index with orderBy.
  // Sorting is done client-side.
  const q = query(
    collection(db, 'media_moments'),
    where('bookId', '==', bookId),
    where('chapterId', '==', chapterId),
  );
  const snap = await getDocs(q);
  const moments = snap.docs.map(d => ({ id: d.id, ...d.data() } as MediaMoment));
  return moments.sort((a, b) => a.paragraphIndex - b.paragraphIndex || a.order - b.order);
}

export async function saveMediaMoment(moment: Omit<MediaMoment, 'id'>) {
  return addDoc(collection(db, 'media_moments'), moment);
}

export async function updateMediaMoment(id: string, data: Partial<MediaMoment>) {
  await updateDoc(doc(db, 'media_moments', id), data);
}

export async function deleteMediaMoment(id: string) {
  await deleteDoc(doc(db, 'media_moments', id));
}

// ═══ Tracks ═══

export async function getTracks(): Promise<Track[]> {
  const q = query(collection(db, 'tracks'), orderBy('order'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Track));
}

export async function saveTrack(track: Partial<Track> & { id: string }) {
  const { id, ...data } = track;
  await setDoc(doc(db, 'tracks', id), data, { merge: true });
}

export async function addTrack(track: Omit<Track, 'id'>) {
  return addDoc(collection(db, 'tracks'), track);
}

export async function deleteTrack(id: string) {
  await deleteDoc(doc(db, 'tracks', id));
}

// ═══ Videos ═══

export async function getVideos(): Promise<Video[]> {
  const q = query(collection(db, 'videos'), orderBy('order'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Video));
}

export async function saveVideo(video: Partial<Video> & { id: string }) {
  const { id, ...data } = video;
  await setDoc(doc(db, 'videos', id), data, { merge: true });
}

export async function addVideo(video: Omit<Video, 'id'>) {
  return addDoc(collection(db, 'videos'), video);
}

export async function deleteVideo(id: string) {
  await deleteDoc(doc(db, 'videos', id));
}

// ═══ Albums ═══

export interface Album {
  id: string;
  name: string;
  coverUrl: string;
  trackCount?: number;
}

export async function getAlbums(): Promise<Album[]> {
  const snap = await getDocs(collection(db, 'albums'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Album));
}

export async function saveAlbum(album: Partial<Album> & { id: string }) {
  const { id, ...data } = album;
  await setDoc(doc(db, 'albums', id), {
    ...data,
    updatedAt: Timestamp.now(),
  }, { merge: true });
}

export async function deleteAlbum(id: string) {
  await deleteDoc(doc(db, 'albums', id));
}
