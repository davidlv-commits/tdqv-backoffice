import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, Timestamp } from 'firebase/firestore';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const firebaseConfig = {
  apiKey: 'AIzaSyCjWaDtWkpdQW__0h74JFBoNvGVgYj_Ds8',
  authDomain: 'tdqv-app.firebaseapp.com',
  projectId: 'tdqv-app',
  storageBucket: 'tdqv-app.firebasestorage.app',
  messagingSenderId: '989931694683',
  appId: '1:989931694683:web:9d16a03abb0b54c7f36d7e',
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const FLUTTER_DIR = '/Users/davidbellolopez-valeiras/Apps Developer/tdqv_flutter/assets/content';
const AUDIO_BASE = 'https://dblvglobal.com/tdqv-audio';

async function migrateBooks() {
  console.log('📚 Migrando libros...');

  await setDoc(doc(db, 'books', 'book1'), {
    title: 'Tú de qué vas',
    author: 'David Bello López-Valeiras',
    totalChapters: 77,
    coverUrl: '',
    status: 'active',
  });

  await setDoc(doc(db, 'books', 'book2'), {
    title: 'Tú de qué vas, pero no',
    author: 'David Bello López-Valeiras',
    totalChapters: 58,
    coverUrl: '',
    status: 'active',
  });

  console.log('  ✓ 2 libros creados');
}

async function migrateChapters(bookId, manifestPath, chaptersDir) {
  console.log(`📖 Migrando capítulos de ${bookId}...`);
  const manifestRaw = readFileSync(manifestPath, 'utf-8');
  const manifest = JSON.parse(manifestRaw);

  // Book 1: array directo. Book 2: objeto con campo "chapters".
  const chapters = Array.isArray(manifest) ? manifest : manifest.chapters || [];
  let count = 0;

  for (const entry of chapters) {
    const id = entry.id;
    const filename = entry.filename || `${id}.json`;
    const filePath = join(chaptersDir, filename);

    try {
      const chapterRaw = readFileSync(filePath, 'utf-8');
      const chapter = JSON.parse(chapterRaw);
      const body = chapter.body || '';
      const paragraphs = body.split('\n\n').filter(p => p.trim());

      await setDoc(doc(db, 'books', bookId, 'chapters', id), {
        title: chapter.title || entry.title,
        order: chapter.order ?? entry.order,
        body: body,
        paragraphCount: paragraphs.length,
        status: 'published',
        updatedAt: Timestamp.now(),
      });
      count++;
    } catch (e) {
      // Archivo no encontrado, skip.
    }
  }

  console.log(`  ✓ ${count} capítulos migrados`);
}

async function migrateTracks() {
  console.log('🎵 Migrando tracks...');

  const mainTracks = [
    { id: '01-el-norte-y-el-sur', title: 'El norte y el sur', order: 1 },
    { id: '02-galicia-en-tus-ojos', title: 'Galicia en tus ojos', order: 2 },
    { id: '03-el-adjetivo', title: 'El adjetivo', order: 3 },
    { id: '04-no-te-querre-siempre', title: 'No te querré siempre', order: 4 },
    { id: '05-el-cielo-se-parte', title: 'El cielo se parte', order: 5 },
    { id: '06-cordoba-sultana-de-piedra-y-luz', title: 'Córdoba, sultana de piedra y luz', order: 6 },
    { id: '07-malaga-mi-refugio-de-sal', title: 'Málaga, mi refugio de sal', order: 7 },
    { id: '08-pura-vida-en-la-piel', title: 'Pura vida en la piel', order: 8 },
    { id: '09-la-carta-en-nueva-york', title: 'La carta en Nueva York', order: 9 },
    { id: '10-palmeras-de-papel', title: 'Palmeras de papel', order: 10 },
    { id: '11-mi-galicia', title: 'Mi Galicia', order: 11 },
    { id: '12-navidad-de-cristal', title: 'Navidad de cristal', order: 12 },
    { id: '13-la-carta-mas-bonita-del-mundo', title: 'La carta más bonita del mundo', order: 13 },
  ];

  for (const t of mainTracks) {
    await setDoc(doc(db, 'tracks', t.id), {
      title: t.title,
      artist: 'TDQV',
      album: 'Tú de qué vas',
      audioUrl: `${AUDIO_BASE}/tu-de-que-vas/${t.id}.m4a`,
      coverUrl: '',
      isInstrumental: false,
      linkedMainTrackId: null,
      duration: 0,
      order: t.order,
      active: true,
    });

    // Instrumental version.
    await setDoc(doc(db, 'tracks', `${t.id}-instrumental`), {
      title: `${t.title} (Instrumental)`,
      artist: 'TDQV Instrumental',
      album: 'Tú de qué vas (Instrumental)',
      audioUrl: `${AUDIO_BASE}/tdqv-instrumental/${t.id}-instrumental.m4a`,
      coverUrl: '',
      isInstrumental: true,
      linkedMainTrackId: t.id,
      duration: 0,
      order: t.order,
      active: true,
    });
  }

  console.log(`  ✓ ${mainTracks.length * 2} tracks migrados (${mainTracks.length} main + ${mainTracks.length} instrumental)`);
}

async function main() {
  console.log('🚀 Iniciando migración a Firestore...\n');

  await migrateBooks();

  await migrateChapters(
    'book1',
    join(FLUTTER_DIR, 'book1/manifest.generated.json'),
    join(FLUTTER_DIR, 'book1'),
  );

  await migrateChapters(
    'book2',
    join(FLUTTER_DIR, 'book2/manifest.generated.json'),
    join(FLUTTER_DIR, 'book2'),
  );

  await migrateTracks();

  console.log('\n✅ Migración completada');
  process.exit(0);
}

main().catch(e => { console.error('Error:', e); process.exit(1); });
