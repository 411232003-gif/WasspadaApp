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

function userBookmarksPath(userId: string) {
  return collection(db!, "users", userId, COLLECTION_BOOKMARKS);
}

function userSubscriptionsPath(userId: string) {
  return collection(db!, "users", userId, COLLECTION_SUBSCRIPTIONS);
}

export async function pushAlert(data: AlertInput): Promise<string> {
  const user = await ensureUser();

  if (db && user) {
    const docRef = await addDoc(collection(db, COLLECTION_ALERTS), {
      ...data,
      userId: user.uid,
      createdAt: serverTimestamp(),
    });
    return docRef.id;
  }

  const id = Math.random().toString(36).slice(2, 11);
  const alert: AlertDoc = {
    ...data,
    id,
    userId: "anonymous",
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
  const user = await ensureUser();

  if (db && user) {
    const docRef = await addDoc(userBookmarksPath(user.uid), {
      ...data,
      userId: user.uid,
      createdAt: serverTimestamp(),
    });
    return docRef.id;
  }

  const id = Math.random().toString(36).slice(2, 11);
  const bookmark: BookmarkDoc = { ...data, id, userId: "anonymous", createdAt: Date.now() };
  mockBookmarks.unshift(bookmark);
  notifyMockBookmarks();
  return id;
}

export async function removeBookmark(id: string): Promise<void> {
  const user = await ensureUser();

  if (db && user) {
    await deleteDoc(doc(db, "users", user.uid, COLLECTION_BOOKMARKS, id));
    return;
  }
  const idx = mockBookmarks.findIndex((b) => b.id === id);
  if (idx !== -1) {
    mockBookmarks.splice(idx, 1);
    notifyMockBookmarks();
  }
}

export function subscribeBookmarks(callback: BookmarkCallback): () => void {
  const userPromise = ensureUser();

  if (db) {
    const unsubscribePromise = userPromise.then((user) => {
      if (!user) {
        callback([...mockBookmarks]);
        return () => {};
      }
      const q = query(
        userBookmarksPath(user.uid),
        orderBy("createdAt", "desc"),
        limit(20)
      );
      return onSnapshot(q, (snapshot) => {
        const bookmarks: BookmarkDoc[] = snapshot.docs.map((docSnap) => ({
          ...(docSnap.data() as BookmarkDoc),
          id: docSnap.id,
          createdAt: docSnap.data().createdAt as Timestamp | number,
        }));
        callback(bookmarks);
      });
    });

    return () => {
      unsubscribePromise.then((unsubscribe) => unsubscribe());
    };
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
  const user = await ensureUser();

  if (db && user) {
    const docRef = await addDoc(userSubscriptionsPath(user.uid), {
      ...data,
      userId: user.uid,
      createdAt: serverTimestamp(),
    });
    return docRef.id;
  }

  const id = Math.random().toString(36).slice(2, 11);
  const subscription: SubscriptionDoc = {
    ...data,
    id,
    userId: "anonymous",
    createdAt: Date.now(),
  };
  mockSubscriptions.unshift(subscription);
  notifyMockSubscriptions();
  return id;
}

export function subscribeSubscriptions(
  callback: SubscriptionCallback
): () => void {
  const userPromise = ensureUser();

  if (db) {
    const unsubscribePromise = userPromise.then((user) => {
      if (!user) {
        callback([...mockSubscriptions]);
        return () => {};
      }
      const q = query(
        userSubscriptionsPath(user.uid),
        orderBy("createdAt", "desc"),
        limit(20)
      );
      return onSnapshot(q, (snapshot) => {
        const subscriptions: SubscriptionDoc[] = snapshot.docs.map((docSnap) => ({
          ...(docSnap.data() as SubscriptionDoc),
          id: docSnap.id,
          createdAt: docSnap.data().createdAt as Timestamp | number,
        }));
        callback(subscriptions);
      });
    });

    return () => {
      unsubscribePromise.then((unsubscribe) => unsubscribe());
    };
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
