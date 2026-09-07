"use client";

import { FirebaseApp, initializeApp, getApps } from "firebase/app";
import { Firestore, getFirestore } from "firebase/firestore";
import {
  Auth,
  User,
  getAuth,
  onAuthStateChanged,
  signInAnonymously,
} from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

const hasAll = Object.values(firebaseConfig).every((v) => Boolean(v));

export let app: FirebaseApp | null = null;
export let db: Firestore | null = null;
export let auth: Auth | null = null;

if (typeof window !== "undefined" && hasAll) {
  app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
  db = getFirestore(app);
  auth = getAuth(app);
}

let userPromise: Promise<User | null> | null = null;

export async function ensureUser(): Promise<User | null> {
  if (!auth) return null;
  if (auth.currentUser) return auth.currentUser;
  if (userPromise) return userPromise;

  userPromise = new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth!, (user) => {
      unsubscribe();
      if (user) {
        resolve(user);
        return;
      }
      signInAnonymously(auth!)
        .then((credential) => resolve(credential.user))
        .catch(() => resolve(null));
    });
  });

  return userPromise;
}

export const isFirebaseConfigured = hasAll;
