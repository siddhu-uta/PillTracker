import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache } from 'firebase/firestore';

// Copy this file to config.js and fill in your Firebase project values.
// Firebase Console → Project Settings → Your apps → SDK setup and configuration
// config.js is gitignored — never commit your real API keys.
const firebaseConfig = {
  apiKey: 'YOUR_API_KEY',
  authDomain: 'YOUR_PROJECT_ID.firebaseapp.com',
  projectId: 'YOUR_PROJECT_ID',
  storageBucket: 'YOUR_PROJECT_ID.appspot.com',
  messagingSenderId: 'YOUR_MESSAGING_SENDER_ID',
  appId: 'YOUR_APP_ID',
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);

// initializeFirestore with persistentLocalCache enables offline support —
// Firestore caches reads locally and queues writes when there's no network.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache(),
});
