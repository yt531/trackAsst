import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let app: any, auth: any, db: any, googleProvider: any;

if (firebaseConfig.apiKey) {
  app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
  auth = getAuth(app);
  db = getFirestore(app, process.env.NEXT_PUBLIC_FIREBASE_DATABASE_ID as string);
  googleProvider = new GoogleAuthProvider();

  // Enable offline persistence
  if (typeof window !== 'undefined') {
    enableIndexedDbPersistence(db).catch((err) => {
      console.error('Failed to enable offline persistence:', err);
    });
  }
} else {
  console.warn("Firebase API Key is missing. Firebase features will not work.");
}

export { app, auth, db, googleProvider };
