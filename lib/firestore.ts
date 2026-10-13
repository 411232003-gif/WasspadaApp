"use client";

import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
  limit,
  serverTimestamp,
  updateDoc,
  Timestamp,
} from "firebase/firestore";
import { db, ensureUser, isFirebaseConfigured } from "./firebase";

export type AlertType = "earthquake" | "volcano";

export interface AlertDoc {
  id: string;
  type: AlertType;
  title: string;
  description: string;
  level: 1 | 2 | 3 | 4;
  magnitude?: number;
  depth?: number;
  location?: string;
  tsunamiPotential?: string;
  volcanoStatus?: string;
  userId?: string;
  createdAt: Timestamp | number;
}

export type AlertInput = Omit<AlertDoc, "id" | "createdAt" | "userId">;
type AlertCallback = (alerts: AlertDoc[]) => void;

export interface BookmarkDoc {
  id: string;
  name: string;
  lat: number;
  lon: number;
  note?: string;
  userId: string;
  createdAt: Timestamp | number;
}

export type BookmarkInput = Omit<BookmarkDoc, "id" | "createdAt" | "userId">;
type BookmarkCallback = (bookmarks: BookmarkDoc[]) => void;

export interface SubscriptionDoc {
  id: string;
  volcanoName: string;
  targetLevel: 1 | 2 | 3 | 4;
  userId: string;
  createdAt: Timestamp | number;
}

export type SubscriptionInput = Omit<SubscriptionDoc, "id" | "createdAt" | "userId">;
type SubscriptionCallback = (subscriptions: SubscriptionDoc[]) => void;

export interface ChatMessageDoc {
  id: string;
  text: string;
  name: string;
  userId: string;
  imageUrl?: string;
  likes?: string[];
  parentId?: string;
  parentName?: string;
  parentText?: string;
  createdAt: Timestamp | number | null;
}

export interface ChatMessageOptions {
  imageUrl?: string;
  parentId?: string;
  parentName?: string;
  parentText?: string;
}

type ChatCallback = (messages: ChatMessageDoc[]) => void;

const COLLECTION_ALERTS = "disaster_alerts";
const COLLECTION_BOOKMARKS = "kelurahan_bookmarks";
const COLLECTION_SUBSCRIPTIONS = "alert_subscriptions";
const COLLECTION_MESSAGES = "community_messages";

function requireDb() {
  if (!db) {
    throw new Error(
      "Firebase belum dikonfigurasi. Isi NEXT_PUBLIC_FIREBASE_* di .env terlebih dahulu."
    );
  }
  return db;
}

function userBookmarksPath(userId: string) {
  return collection(requireDb(), "users", userId, COLLECTION_BOOKMARKS);
}

function userSubscriptionsPath(userId: string) {
  return collection(requireDb(), "users", userId, COLLECTION_SUBSCRIPTIONS);
}

export async function pushAlert(data: AlertInput): Promise<string> {
  const user = await ensureUser();
  const firestore = requireDb();
  if (!user) throw new Error("Gagal autentikasi pengguna anonim.");

  const docRef = await addDoc(collection(firestore, COLLECTION_ALERTS), {
    ...data,
    userId: user.uid,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

export function subscribeAlerts(callback: AlertCallback): () => void {
  if (!db) {
    callback([]);
    return () => {};
  }

  const q = query(
    collection(db, COLLECTION_ALERTS),
    orderBy("createdAt", "desc"),
    limit(20)
  );
  return onSnapshot(
    q,
    (snapshot) => {
      const alerts = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as AlertInput),
        createdAt: docSnap.data().createdAt as Timestamp | number,
      }));
      callback(alerts);
    },
    () => callback([])
  );
}

export async function addBookmark(data: BookmarkInput): Promise<string> {
  const user = await ensureUser();
  if (!user) throw new Error("Gagal autentikasi pengguna anonim.");

  const docRef = await addDoc(userBookmarksPath(user.uid), {
    ...data,
    userId: user.uid,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function removeBookmark(id: string): Promise<void> {
  const user = await ensureUser();
  if (!user) throw new Error("Gagal autentikasi pengguna anonim.");

  await deleteDoc(doc(requireDb(), "users", user.uid, COLLECTION_BOOKMARKS, id));
}

export function subscribeBookmarks(callback: BookmarkCallback): () => void {
  if (!db) {
    callback([]);
    return () => {};
  }

  const unsubscribePromise = ensureUser().then((user) => {
    if (!user) {
      callback([]);
      return () => {};
    }
    const q = query(
      userBookmarksPath(user.uid),
      orderBy("createdAt", "desc"),
      limit(20)
    );
    return onSnapshot(
      q,
      (snapshot) => {
        const bookmarks: BookmarkDoc[] = snapshot.docs.map((docSnap) => ({
          ...(docSnap.data() as BookmarkDoc),
          id: docSnap.id,
          createdAt: docSnap.data().createdAt as Timestamp | number,
        }));
        callback(bookmarks);
      },
      () => callback([])
    );
  });

  return () => {
    unsubscribePromise.then((unsubscribe) => unsubscribe());
  };
}

export async function addSubscription(
  data: SubscriptionInput
): Promise<string> {
  const user = await ensureUser();
  if (!user) throw new Error("Gagal autentikasi pengguna anonim.");

  const docRef = await addDoc(userSubscriptionsPath(user.uid), {
    ...data,
    userId: user.uid,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

export function subscribeSubscriptions(
  callback: SubscriptionCallback
): () => void {
  if (!db) {
    callback([]);
    return () => {};
  }

  const unsubscribePromise = ensureUser().then((user) => {
    if (!user) {
      callback([]);
      return () => {};
    }
    const q = query(
      userSubscriptionsPath(user.uid),
      orderBy("createdAt", "desc"),
      limit(20)
    );
    return onSnapshot(
      q,
      (snapshot) => {
        const subscriptions: SubscriptionDoc[] = snapshot.docs.map((docSnap) => ({
          ...(docSnap.data() as SubscriptionDoc),
          id: docSnap.id,
          createdAt: docSnap.data().createdAt as Timestamp | number,
        }));
        callback(subscriptions);
      },
      () => callback([])
    );
  });

  return () => {
    unsubscribePromise.then((unsubscribe) => unsubscribe());
  };
}

export async function sendChatMessage(
  text: string,
  name: string,
  options?: ChatMessageOptions
): Promise<string> {
  const user = await ensureUser();
  const firestore = requireDb();
  if (!user) throw new Error("Gagal autentikasi pengguna anonim.");

  const docRef = await addDoc(collection(firestore, COLLECTION_MESSAGES), {
    text: text.slice(0, 500),
    name: name.slice(0, 40),
    userId: user.uid,
    likes: [],
    ...(options?.imageUrl ? { imageUrl: options.imageUrl } : {}),
    ...(options?.parentId ? { parentId: options.parentId } : {}),
    ...(options?.parentName ? { parentName: options.parentName } : {}),
    ...(options?.parentText ? { parentText: options.parentText } : {}),
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function toggleChatLike(
  messageId: string,
  likes: string[],
  userId: string
): Promise<void> {
  const firestore = requireDb();
  const liked = likes.includes(userId);
  await updateDoc(doc(firestore, COLLECTION_MESSAGES, messageId), {
    likes: liked ? arrayRemove(userId) : arrayUnion(userId),
  });
}

export function subscribeChatMessages(callback: ChatCallback): () => void {
  if (!db) {
    callback([]);
    return () => {};
  }

  const q = query(
    collection(db, COLLECTION_MESSAGES),
    orderBy("createdAt", "desc"),
    limit(100)
  );
  return onSnapshot(
    q,
    (snapshot) => {
      const messages: ChatMessageDoc[] = snapshot.docs
        .map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<ChatMessageDoc, "id" | "createdAt">),
          createdAt: (docSnap.data().createdAt as Timestamp | null) ?? null,
        }))
        .reverse();
      callback(messages);
    },
    () => callback([])
  );
}

export function getFirebaseStatus() {
  return {
    configured: isFirebaseConfigured,
    mode: db ? ("firestore" as const) : ("unconfigured" as const),
  };
}
