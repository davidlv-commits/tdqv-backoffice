import {
  collection, doc, getDocs, getDoc, setDoc, updateDoc, deleteDoc,
  query, where, orderBy, addDoc, Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import type { Book, Chapter, MediaMoment, Track } from './types';

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

export async function deleteTrack(id: string) {
  await deleteDoc(doc(db, 'tracks', id));
}
