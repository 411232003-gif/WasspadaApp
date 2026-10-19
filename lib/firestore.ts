"use client";

import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  orderBy,
  limit,
  serverTimestamp,
  startAfter,
  updateDoc,
  where,
  QueryDocumentSnapshot,
  DocumentData,
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
  photoUrl?: string;
  likes?: string[];
  parentId?: string;
  parentName?: string;
  parentText?: string;
  createdAt: Timestamp | number | null;
  editedAt?: Timestamp | number | null;
}

export type GroupRole = "admin" | "member";

export interface GroupMemberInfo {
  name: string;
  photoUrl?: string;
  /** kode undangan yang dipakai saat join lewat tautan (dicek di rules) */
  inviteCode?: string;
}

export interface ChatGroupDoc {
  id: string;
  name: string;
  createdBy: string;
  memberIds: string[];
  roles: Record<string, GroupRole>;
  members: Record<string, GroupMemberInfo>;
  /** kode di tautan undangan /chat?join=<id>&code=<inviteCode> */
  inviteCode?: string;
  lastMessageText?: string;
  lastMessageName?: string;
  lastMessageAt?: Timestamp | number | null;
  createdAt: Timestamp | number | null;
}

export interface GroupMemberCandidate {
  uid: string;
  name: string;
  photoUrl?: string;
}

type GroupCallback = (groups: ChatGroupDoc[]) => void;

export interface ChatMessageOptions {
  imageUrl?: string;
  photoUrl?: string;
  parentId?: string;
  parentName?: string;
  parentText?: string;
}

/** Jumlah pesan terbaru yang di-subscribe live — hemat kuota baca. */
export const CHAT_PAGE_SIZE = 50;

export interface ChatPageMeta {
  hasMore: boolean;
  oldest: QueryDocumentSnapshot<DocumentData> | null;
}

type ChatPageCallback = (
  messages: ChatMessageDoc[],
  meta: ChatPageMeta
) => void;

function mapMessageDoc(docSnap: QueryDocumentSnapshot<DocumentData>) {
  return {
    id: docSnap.id,
    ...(docSnap.data() as Omit<ChatMessageDoc, "id" | "createdAt">),
    createdAt: (docSnap.data().createdAt as Timestamp | null) ?? null,
  } as ChatMessageDoc;
}

/** Ambil halaman pesan yang lebih lama (cursor = dokumen terlama saat ini). */
export async function fetchOlderChatMessages(args: {
  groupId?: string;
  before: QueryDocumentSnapshot<DocumentData>;
  limitCount?: number;
}): Promise<{ messages: ChatMessageDoc[]; meta: ChatPageMeta }> {
  const coll = args.groupId
    ? groupMessagesPath(args.groupId)
    : collection(requireDb(), COLLECTION_MESSAGES);
  const limitCount = args.limitCount ?? CHAT_PAGE_SIZE;
  const q = query(
    coll,
    orderBy("createdAt", "desc"),
    startAfter(args.before),
    limit(limitCount)
  );
  const snap = await getDocs(q);
  return {
    messages: snap.docs.map(mapMessageDoc).reverse(),
    meta: {
      hasMore: snap.size === limitCount,
      oldest: snap.docs[snap.docs.length - 1] ?? args.before,
    },
  };
}

const COLLECTION_ALERTS = "disaster_alerts";
const COLLECTION_BOOKMARKS = "kelurahan_bookmarks";
const COLLECTION_SUBSCRIPTIONS = "alert_subscriptions";
const COLLECTION_MESSAGES = "community_messages";
const COLLECTION_GROUPS = "chat_groups";

function requireDb() {
  if (!db) {
    throw new Error(
      "Firebase belum dikonfigurasi. Isi NEXT_PUBLIC_FIREBASE_* di .env terlebih dahulu."
    );
  }
  return db;
}

function toMillis(value: Timestamp | number | null | undefined): number {
  if (!value) return 0;
  if (typeof value === "number") return value;
  const d = (value as unknown as { toDate?: () => Date }).toDate?.();
  return d ? d.getTime() : 0;
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
    ...(options?.photoUrl ? { photoUrl: options.photoUrl } : {}),
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

export function subscribeChatMessages(
  callback: ChatPageCallback,
  limitCount = CHAT_PAGE_SIZE
): () => void {
  if (!db) {
    callback([], { hasMore: false, oldest: null });
    return () => {};
  }

  const q = query(
    collection(db, COLLECTION_MESSAGES),
    orderBy("createdAt", "desc"),
    limit(limitCount)
  );
  return onSnapshot(
    q,
    (snapshot) => {
      callback(snapshot.docs.map(mapMessageDoc).reverse(), {
        hasMore: snapshot.size === limitCount,
        oldest: snapshot.docs[snapshot.docs.length - 1] ?? null,
      });
    },
    () => callback([], { hasMore: false, oldest: null })
  );
}

export async function editChatMessage(
  messageId: string,
  text: string
): Promise<void> {
  const user = await ensureUser();
  const firestore = requireDb();
  if (!user) throw new Error("Gagal autentikasi pengguna anonim.");

  await updateDoc(doc(firestore, COLLECTION_MESSAGES, messageId), {
    text: text.trim().slice(0, 500),
    editedAt: serverTimestamp(),
  });
}

export async function deleteChatMessage(messageId: string): Promise<void> {
  const user = await ensureUser();
  const firestore = requireDb();
  if (!user) throw new Error("Gagal autentikasi pengguna anonim.");

  await deleteDoc(doc(firestore, COLLECTION_MESSAGES, messageId));
}

/* ================= Grup chat ala WhatsApp ================= */

export async function createChatGroup(
  groupName: string,
  members: GroupMemberCandidate[]
): Promise<string> {
  const user = await ensureUser();
  const firestore = requireDb();
  if (!user || user.isAnonymous) {
    throw new Error("Masuk dengan akun terdaftar untuk membuat grup.");
  }

  const seen = new Set<string>([user.uid]);
  const memberIds: string[] = [user.uid];
  const roles: Record<string, GroupRole> = { [user.uid]: "admin" };
  const membersMap: Record<string, GroupMemberInfo> = {
    [user.uid]: {
      name: (user.displayName || user.email || "Saya").slice(0, 40),
      ...(user.photoURL ? { photoUrl: user.photoURL } : {}),
    },
  };

  for (const m of members) {
    if (!m.uid || seen.has(m.uid)) continue;
    seen.add(m.uid);
    memberIds.push(m.uid);
    roles[m.uid] = "member";
    membersMap[m.uid] = {
      name: (m.name || "Warga").slice(0, 40),
      ...(m.photoUrl ? { photoUrl: m.photoUrl } : {}),
    };
  }

  const docRef = await addDoc(collection(firestore, COLLECTION_GROUPS), {
    name: (groupName.trim() || "Grup Baru").slice(0, 60),
    createdBy: user.uid,
    memberIds,
    roles,
    members: membersMap,
    inviteCode: newInviteCode(),
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

export function subscribeChatGroups(
  uid: string,
  callback: GroupCallback
): () => void {
  if (!db) {
    callback([]);
    return () => {};
  }

  const q = query(
    collection(db, COLLECTION_GROUPS),
    where("memberIds", "array-contains", uid),
    limit(50)
  );
  return onSnapshot(
    q,
    (snapshot) => {
      const groups = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<ChatGroupDoc, "id">),
      }));
      groups.sort(
        (a, b) =>
          toMillis(b.lastMessageAt ?? b.createdAt) -
          toMillis(a.lastMessageAt ?? a.createdAt)
      );
      callback(groups);
    },
    () => callback([])
  );
}

function groupDoc(groupId: string) {
  return doc(requireDb(), COLLECTION_GROUPS, groupId);
}

function groupMessagesPath(groupId: string) {
  return collection(requireDb(), COLLECTION_GROUPS, groupId, "messages");
}

export function subscribeGroupMessages(
  groupId: string,
  callback: ChatPageCallback,
  limitCount = CHAT_PAGE_SIZE
): () => void {
  if (!db) {
    callback([], { hasMore: false, oldest: null });
    return () => {};
  }

  const q = query(
    groupMessagesPath(groupId),
    orderBy("createdAt", "desc"),
    limit(limitCount)
  );
  return onSnapshot(
    q,
    (snapshot) => {
      const messages = snapshot.docs.map(
        (docSnap) =>
          ({ ...mapMessageDoc(docSnap), groupId }) as ChatMessageDoc
      );
      callback(messages.reverse(), {
        hasMore: snapshot.size === limitCount,
        oldest: snapshot.docs[snapshot.docs.length - 1] ?? null,
      });
    },
    () => callback([], { hasMore: false, oldest: null })
  );
}

export async function sendGroupMessage(
  groupId: string,
  text: string,
  name: string,
  options?: ChatMessageOptions
): Promise<string> {
  const user = await ensureUser();
  requireDb();
  if (!user) throw new Error("Gagal autentikasi pengguna anonim.");

  const docRef = await addDoc(groupMessagesPath(groupId), {
    text: text.slice(0, 500),
    name: name.slice(0, 40),
    userId: user.uid,
    likes: [],
    ...(options?.imageUrl ? { imageUrl: options.imageUrl } : {}),
    ...(options?.photoUrl ? { photoUrl: options.photoUrl } : {}),
    ...(options?.parentId ? { parentId: options.parentId } : {}),
    ...(options?.parentName ? { parentName: options.parentName } : {}),
    ...(options?.parentText ? { parentText: options.parentText } : {}),
    createdAt: serverTimestamp(),
  });

  updateDoc(groupDoc(groupId), {
    lastMessageText: (text.trim() || "Foto").slice(0, 80),
    lastMessageName: name.slice(0, 40),
    lastMessageAt: serverTimestamp(),
  }).catch(() => {});

  return docRef.id;
}

export async function toggleGroupMessageLike(
  groupId: string,
  messageId: string,
  likes: string[],
  userId: string
): Promise<void> {
  const liked = likes.includes(userId);
  await updateDoc(doc(groupMessagesPath(groupId), messageId), {
    likes: liked ? arrayRemove(userId) : arrayUnion(userId),
  });
}

export async function editGroupMessage(
  groupId: string,
  messageId: string,
  text: string
): Promise<void> {
  const user = await ensureUser();
  if (!user) throw new Error("Gagal autentikasi pengguna anonim.");

  await updateDoc(doc(groupMessagesPath(groupId), messageId), {
    text: text.trim().slice(0, 500),
    editedAt: serverTimestamp(),
  });
}

export async function deleteGroupMessage(
  groupId: string,
  messageId: string
): Promise<void> {
  const user = await ensureUser();
  if (!user) throw new Error("Gagal autentikasi pengguna anonim.");

  await deleteDoc(doc(groupMessagesPath(groupId), messageId));
}

export async function renameChatGroup(
  groupId: string,
  name: string
): Promise<void> {
  await updateDoc(groupDoc(groupId), {
    name: name.trim().slice(0, 60) || "Grup",
  });
}

export async function setGroupMemberRole(
  groupId: string,
  memberUid: string,
  role: GroupRole
): Promise<void> {
  await updateDoc(groupDoc(groupId), {
    [`roles.${memberUid}`]: role,
  });
}

export async function addGroupMembers(
  groupId: string,
  members: GroupMemberCandidate[]
): Promise<void> {
  const updates: Record<string, unknown> = {
    memberIds: arrayUnion(...members.map((m) => m.uid)),
  };
  for (const m of members) {
    updates[`roles.${m.uid}`] = "member";
    updates[`members.${m.uid}`] = {
      name: (m.name || "Warga").slice(0, 40),
      ...(m.photoUrl ? { photoUrl: m.photoUrl } : {}),
    };
  }
  await updateDoc(groupDoc(groupId), updates);
}

export async function removeGroupMember(
  groupId: string,
  memberUid: string
): Promise<void> {
  await updateDoc(groupDoc(groupId), {
    memberIds: arrayRemove(memberUid),
    [`roles.${memberUid}`]: deleteField(),
    [`members.${memberUid}`]: deleteField(),
  });
}

export async function getChatGroup(
  groupId: string
): Promise<ChatGroupDoc | null> {
  if (!db) return null;
  const snap = await getDoc(groupDoc(groupId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as Omit<ChatGroupDoc, "id">) };
}

function newInviteCode() {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 20);
}

/** Gabung grup lewat tautan undangan — menambahkan diri sendiri sebagai member. */
export async function joinChatGroup(
  groupId: string,
  name: string,
  photoUrl?: string,
  code?: string
): Promise<ChatGroupDoc> {
  const user = await ensureUser();
  if (!user || user.isAnonymous) {
    throw new Error("Masuk dengan akun terdaftar untuk bergabung ke grup.");
  }

  const existing = await getChatGroup(groupId);
  if (!existing) throw new Error("Grup tidak ditemukan atau sudah dibubarkan.");
  if (existing.memberIds?.includes(user.uid)) return existing;
  if (!existing.inviteCode || existing.inviteCode !== code) {
    throw new Error(
      "Tautan undangan sudah tidak berlaku. Minta tautan baru ke admin grup."
    );
  }

  await updateDoc(groupDoc(groupId), {
    memberIds: arrayUnion(user.uid),
    [`roles.${user.uid}`]: "member",
    [`members.${user.uid}`]: {
      name: (name || "Warga").slice(0, 40),
      ...(photoUrl ? { photoUrl } : {}),
      inviteCode: existing.inviteCode,
    },
  });
  return { ...existing, memberIds: [...existing.memberIds, user.uid] };
}

/** Admin mereset tautan undangan — semua tautan/QR lama otomatis mati. */
export async function resetGroupInvite(groupId: string): Promise<void> {
  const user = await ensureUser();
  if (!user) throw new Error("Gagal autentikasi pengguna anonim.");
  await updateDoc(groupDoc(groupId), { inviteCode: newInviteCode() });
}

/** Admin membubarkan grup: hapus semua pesan lalu dokumen grupnya. */
export async function deleteChatGroup(groupId: string): Promise<void> {
  const user = await ensureUser();
  if (!user) throw new Error("Gagal autentikasi pengguna anonim.");

  // Hapus isi pesan bertahap (Firestore tidak menghapus subkoleksi otomatis).
  for (;;) {
    const snap = await getDocs(
      query(groupMessagesPath(groupId), limit(400))
    );
    if (snap.empty) break;
    await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
    if (snap.size < 400) break;
  }
  await deleteDoc(groupDoc(groupId));
}

export function getFirebaseStatus() {
  return {
    configured: isFirebaseConfigured,
    mode: db ? ("firestore" as const) : ("unconfigured" as const),
  };
}
