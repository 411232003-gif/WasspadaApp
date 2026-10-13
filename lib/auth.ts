"use client";

import {
  User,
  browserLocalPersistence,
  browserSessionPersistence,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from "firebase/auth";
import { useEffect, useState } from "react";
import { auth, isFirebaseConfigured } from "./firebase";

export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  isAnonymous: boolean;
}

export function useAuthUser() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(() => Boolean(auth));

  useEffect(() => {
    if (!auth) return;
    return onAuthStateChanged(auth, (u) => {
      setUser(toAuthUser(u));
      setLoading(false);
    });
  }, []);

  return { user, loading };
}

function toAuthUser(user: User | null): AuthUser | null {
  if (!user || user.isAnonymous) return null;
  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    isAnonymous: user.isAnonymous,
  };
}

function friendlyError(code: string): string {
  switch (code) {
    case "auth/invalid-email":
      return "Format email tidak valid.";
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "Email atau password salah.";
    case "auth/email-already-in-use":
      return "Email sudah terdaftar. Silakan login.";
    case "auth/weak-password":
      return "Password minimal 6 karakter.";
    case "auth/too-many-requests":
      return "Terlalu banyak percobaan. Tunggu sebentar.";
    case "auth/network-request-failed":
      return "Koneksi bermasalah. Coba lagi.";
    case "auth/operation-not-allowed":
      return "Login email belum diaktifkan di Firebase Console.";
    default:
      return "Terjadi kesalahan. Coba lagi.";
  }
}

export async function loginWithEmail(
  email: string,
  password: string,
  remember: boolean
): Promise<void> {
  if (!auth) throw new Error("Firebase belum dikonfigurasi.");
  try {
    await setPersistence(
      auth,
      remember ? browserLocalPersistence : browserSessionPersistence
    );
    await signInWithEmailAndPassword(auth, email.trim(), password);
  } catch (e) {
    throw new Error(friendlyError((e as { code?: string }).code ?? ""));
  }
}

export async function registerWithEmail(
  name: string,
  email: string,
  password: string
): Promise<void> {
  if (!auth) throw new Error("Firebase belum dikonfigurasi.");
  try {
    const cred = await createUserWithEmailAndPassword(
      auth,
      email.trim(),
      password
    );
    await updateProfile(cred.user, { displayName: name.trim().slice(0, 40) });
  } catch (e) {
    throw new Error(friendlyError((e as { code?: string }).code ?? ""));
  }
}

export async function resetPassword(email: string): Promise<void> {
  if (!auth) throw new Error("Firebase belum dikonfigurasi.");
  try {
    await sendPasswordResetEmail(auth, email.trim());
  } catch (e) {
    throw new Error(friendlyError((e as { code?: string }).code ?? ""));
  }
}

export async function logout(): Promise<void> {
  if (!auth) return;
  await signOut(auth);
}

export { isFirebaseConfigured };
