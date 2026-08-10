import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore, initializeFirestore, persistentLocalCache } from 'firebase/firestore';
import { getMessaging, isSupported } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

if (!firebaseConfig.apiKey) {
  console.error("Firebase config is missing. Please ensure your .env file is loaded and restart the Next.js dev server.");
}

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);

let db: ReturnType<typeof getFirestore>;

try {
  if (typeof window !== 'undefined') {
    db = initializeFirestore(app, {
      localCache: persistentLocalCache()
    }, process.env.NEXT_PUBLIC_FIREBASE_DATABASE_ID as string);
  } else {
    db = getFirestore(app, process.env.NEXT_PUBLIC_FIREBASE_DATABASE_ID as string);
  }
} catch (e) {
  db = getFirestore(app, process.env.NEXT_PUBLIC_FIREBASE_DATABASE_ID as string);
}

const googleProvider = new GoogleAuthProvider();

// Initialize Messaging only on client side
let messaging: ReturnType<typeof getMessaging> | null = null;
if (typeof window !== 'undefined') {
  isSupported().then((supported) => {
    if (supported) {
      messaging = getMessaging(app);
    }
  });
}

export { app, auth, db, googleProvider, messaging };
