import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyCjWaDtWkpdQW__0h74JFBoNvGVgYj_Ds8',
  authDomain: 'tdqv-app.firebaseapp.com',
  projectId: 'tdqv-app',
  storageBucket: 'tdqv-app.firebasestorage.app',
  messagingSenderId: '989931694683',
  appId: '1:989931694683:web:9d16a03abb0b54c7f36d7e',
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const auth = getAuth(app);
export const db = getFirestore(app);
