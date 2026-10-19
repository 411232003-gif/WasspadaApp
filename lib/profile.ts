"use client";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { updateProfile } from "firebase/auth";
import { auth, db } from "./firebase";

export interface UserProfile {
  displayName: string;
  birthDate: string; // ISO yyyy-mm-dd
  photoUrl?: string;
}

const COLLECTION_PROFILES = "profiles";

export interface ProfileEntry extends UserProfile {
  uid: string;
}

export async function listProfiles(
  limitCount = 200
): Promise<ProfileEntry[]> {
  if (!db) return [];
  const snap = await getDocs(
    query(collection(db, COLLECTION_PROFILES), limit(limitCount))
  );
  return snap.docs.map((d) => ({ uid: d.id, ...(d.data() as UserProfile) }));
}

export async function getUserProfile(
  uid: string
): Promise<UserProfile | null> {
  if (!db) return null;
  const snap = await getDoc(doc(db, COLLECTION_PROFILES, uid));
  if (!snap.exists()) return null;
  return snap.data() as UserProfile;
}

export async function saveUserProfile(
  uid: string,
  profile: UserProfile
): Promise<void> {
  if (!db || !auth?.currentUser) {
    throw new Error("Firebase belum dikonfigurasi.");
  }

  await setDoc(
    doc(db, COLLECTION_PROFILES, uid),
    { ...profile, updatedAt: serverTimestamp() },
    { merge: true }
  );

  await updateProfile(auth.currentUser, {
    displayName: profile.displayName.slice(0, 40),
    ...(profile.photoUrl ? { photoURL: profile.photoUrl } : {}),
  });

  // Refresh agar nama/foto baru langsung dipakai di seluruh app
  // (onAuthStateChanged tidak terpicu oleh updateProfile).
  await auth.currentUser.reload();
}
