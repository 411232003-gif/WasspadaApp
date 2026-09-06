"use client";

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
  limit,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db, isFirebaseConfigured } from "./firebase";

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
  createdAt: Timestamp | number;
}

export type AlertInput = Omit<AlertDoc, "id" | "createdAt">;
type AlertCallback = (alerts: AlertDoc[]) => void;

export interface BookmarkDoc {
  id: string;
  name: string;
  lat: number;
  lon: number;
  note?: string;
  createdAt: Timestamp | number;
}

export type BookmarkInput = Omit<BookmarkDoc, "id" | "createdAt">;
type BookmarkCallback = (bookmarks: BookmarkDoc[]) => void;

export interface SubscriptionDoc {
  id: string;
  volcanoName: string;
  targetLevel: 1 | 2 | 3 | 4;
  createdAt: Timestamp | number;
}

export type SubscriptionInput = Omit<SubscriptionDoc, "id" | "createdAt">;
type SubscriptionCallback = (subscriptions: SubscriptionDoc[]) => void;

const COLLECTION_ALERTS = "disaster_alerts";
const COLLECTION_BOOKMARKS = "kelurahan_bookmarks";
const COLLECTION_SUBSCRIPTIONS = "alert_subscriptions";

const mockAlerts: AlertDoc[] = [];
const mockAlertSubscribers: AlertCallback[] = [];

const mockBookmarks: BookmarkDoc[] = [];
const mockBookmarkSubscribers: BookmarkCallback[] = [];

const mockSubscriptions: SubscriptionDoc[] = [];
const mockSubscriptionSubscribers: SubscriptionCallback[] = [];

function notifyMockAlerts() {
  mockAlertSubscribers.forEach((cb) => cb([...mockAlerts]));
}

function notifyMockBookmarks() {
  mockBookmarkSubscribers.forEach((cb) => cb([...mockBookmarks]));
}

function notifyMockSubscriptions() {
  mockSubscriptionSubscribers.forEach((cb) => cb([...mockSubscriptions]));
}

export async function pushAlert(data: AlertInput): Promise<string> {
  if (db) {
    const docRef = await addDoc(collection(db, COLLECTION_ALERTS), {
      ...data,
      createdAt: serverTimestamp(),
    });
    return docRef.id;
  }

  const id = Math.random().toString(36).slice(2, 11);
  const alert: AlertDoc = {
    ...data,
    id,
    createdAt: Date.now(),
  };
  mockAlerts.unshift(alert);
  if (mockAlerts.length > 50) mockAlerts.pop();
  notifyMockAlerts();
  return id;
}

export function subscribeAlerts(callback: AlertCallback): () => void {
  if (db) {
    const q = query(
      collection(db, COLLECTION_ALERTS),
      orderBy("createdAt", "desc"),
      limit(20)
    );
    return onSnapshot(q, (snapshot) => {
      const alerts = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as AlertInput),
        createdAt: docSnap.data().createdAt as Timestamp | number,
      }));
      callback(alerts);
    });
  }

  callback([...mockAlerts]);
  mockAlertSubscribers.push(callback);
  return () => {
    const idx = mockAlertSubscribers.indexOf(callback);
    if (idx !== -1) mockAlertSubscribers.splice(idx, 1);
  };
}

export async function addBookmark(data: BookmarkInput): Promise<string> {
  if (db) {
    const docRef = await addDoc(collection(db, COLLECTION_BOOKMARKS), {
      ...data,
      createdAt: serverTimestamp(),
    });
    return docRef.id;
  }

  const id = Math.random().toString(36).slice(2, 11);
  const bookmark: BookmarkDoc = { ...data, id, createdAt: Date.now() };
  mockBookmarks.unshift(bookmark);
  notifyMockBookmarks();
  return id;
}

export async function removeBookmark(id: string): Promise<void> {
  if (db) {
    await deleteDoc(doc(db, COLLECTION_BOOKMARKS, id));
    return;
  }
  const idx = mockBookmarks.findIndex((b) => b.id === id);
  if (idx !== -1) {
    mockBookmarks.splice(idx, 1);
    notifyMockBookmarks();
  }
}

export function subscribeBookmarks(callback: BookmarkCallback): () => void {
  if (db) {
    const q = query(
      collection(db, COLLECTION_BOOKMARKS),
      orderBy("createdAt", "desc"),
      limit(20)
    );
    return onSnapshot(q, (snapshot) => {
      const bookmarks = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as BookmarkInput),
        createdAt: docSnap.data().createdAt as Timestamp | number,
      }));
      callback(bookmarks);
    });
  }

  callback([...mockBookmarks]);
  mockBookmarkSubscribers.push(callback);
  return () => {
    const idx = mockBookmarkSubscribers.indexOf(callback);
    if (idx !== -1) mockBookmarkSubscribers.splice(idx, 1);
  };
}

export async function addSubscription(
  data: SubscriptionInput
): Promise<string> {
  if (db) {
    const docRef = await addDoc(collection(db, COLLECTION_SUBSCRIPTIONS), {
      ...data,
      createdAt: serverTimestamp(),
    });
    return docRef.id;
  }

  const id = Math.random().toString(36).slice(2, 11);
  const subscription: SubscriptionDoc = {
    ...data,
    id,
    createdAt: Date.now(),
  };
  mockSubscriptions.unshift(subscription);
  notifyMockSubscriptions();
  return id;
}

export function subscribeSubscriptions(
  callback: SubscriptionCallback
): () => void {
  if (db) {
    const q = query(
      collection(db, COLLECTION_SUBSCRIPTIONS),
      orderBy("createdAt", "desc"),
      limit(20)
    );
    return onSnapshot(q, (snapshot) => {
      const subscriptions = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as SubscriptionInput),
        createdAt: docSnap.data().createdAt as Timestamp | number,
      }));
      callback(subscriptions);
    });
  }

  callback([...mockSubscriptions]);
  mockSubscriptionSubscribers.push(callback);
  return () => {
    const idx = mockSubscriptionSubscribers.indexOf(callback);
    if (idx !== -1) mockSubscriptionSubscribers.splice(idx, 1);
  };
}

export function getFirebaseStatus() {
  const mode: "firestore" | "mock" = db ? "firestore" : "mock";
  return {
    configured: isFirebaseConfigured,
    mode,
  };
}
