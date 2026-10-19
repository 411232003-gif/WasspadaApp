"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Lock,
  LogIn,
  MessageCircle,
  MessagesSquare,
  UserPlus,
  Users,
} from "lucide-react";
import { GlassCard } from "@/components/glass-card";
import {
  ChatRoom,
  formatChatTime,
} from "@/components/chat/chat-room";
import {
  CreateGroupDialog,
  GroupInfoDialog,
} from "@/components/chat/group-dialogs";
import { useAuthUser } from "@/lib/auth";
import {
  addGroupMembers,
  createChatGroup,
  deleteChatGroup,
  deleteChatMessage,
  deleteGroupMessage,
  editChatMessage,
  editGroupMessage,
  fetchOlderChatMessages,
  getFirebaseStatus,
  joinChatGroup,
  removeGroupMember,
  renameChatGroup,
  resetGroupInvite,
  sendChatMessage,
  sendGroupMessage,
  setGroupMemberRole,
  subscribeChatGroups,
  subscribeChatMessages,
  subscribeGroupMessages,
  toggleChatLike,
  toggleGroupMessageLike,
  ChatGroupDoc,
  ChatMessageDoc,
  ChatPageMeta,
  GroupMemberCandidate,
} from "@/lib/firestore";
import {
  cleanupExpiredChatImages,
  isSupabaseConfigured,
  uploadChatImage,
} from "@/lib/supabase";
import { listProfiles } from "@/lib/profile";

const NAME_KEY = "wasspada-chat-name";
const PUBLIC_ROOM = "public";

function readSavedName() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(NAME_KEY);
}

function messageMillis(m: ChatMessageDoc): number {
  const v = m.createdAt;
  if (!v) return 0;
  return typeof v === "number" ? v : v.toMillis();
}

/** Gabung halaman pesan lama + live, dedupe by id, urut naik. */
function mergePages(
  older: ChatMessageDoc[],
  latest: ChatMessageDoc[]
): ChatMessageDoc[] {
  const map = new Map<string, ChatMessageDoc>();
  for (const m of older) map.set(m.id, m);
  for (const m of latest) map.set(m.id, m);
  return [...map.values()].sort(
    (a, b) => messageMillis(a) - messageMillis(b)
  );
}

export function CommunityChat() {
  const router = useRouter();
  const { user: account, loading: authLoading } = useAuthUser();
  const [messages, setMessages] = useState<ChatMessageDoc[]>([]);
  const [publicMeta, setPublicMeta] = useState<ChatPageMeta>({
    hasMore: false,
    oldest: null,
  });
  const [publicOlder, setPublicOlder] = useState<ChatMessageDoc[]>([]);
  const [groups, setGroups] = useState<ChatGroupDoc[]>([]);
  const [groupsReady, setGroupsReady] = useState(false);
  const [groupMessages, setGroupMessages] = useState<ChatMessageDoc[]>([]);
  const [groupMeta, setGroupMeta] = useState<ChatPageMeta>({
    hasMore: false,
    oldest: null,
  });
  const [groupOlder, setGroupOlder] = useState<ChatMessageDoc[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [nameOverride, setNameOverride] = useState<string | null>(
    readSavedName
  );
  const [createOpen, setCreateOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [profiles, setProfiles] = useState<GroupMemberCandidate[]>([]);
  const [profilesLoaded, setProfilesLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [shellError, setShellError] = useState<string | null>(null);
  const joinHandled = useRef(false);
  const configured = getFirebaseStatus().configured;
  const supabaseReady = isSupabaseConfigured();

  const uid = account?.uid ?? null;
  const name =
    nameOverride ?? account?.displayName ?? account?.email ?? "Anonim";

  const isGroupSel = sel !== null && sel !== PUBLIC_ROOM;
  const activeGroup = isGroupSel
    ? groups.find((g) => g.id === sel) ?? null
    : null;
  const isAdmin = uid != null && activeGroup?.roles?.[uid] === "admin";

  useEffect(() => {
    if (!account) return;
    cleanupExpiredChatImages().catch(() => {});
    const unsubs = [
      subscribeChatMessages((msgs, meta) => {
        setMessages(msgs);
        setPublicMeta(meta);
      }),
      subscribeChatGroups(account.uid, (list) => {
        setGroups(list);
        setGroupsReady(true);
      }),
    ];
    return () => unsubs.forEach((u) => u());
  }, [account]);

  /* reset riwayat halaman saat pindah room (pola render-adjust) */
  const [prevSel, setPrevSel] = useState<string | null>(null);
  if (sel !== prevSel) {
    setPrevSel(sel);
    setGroupOlder([]);
  }

  useEffect(() => {
    if (!isGroupSel || !account) return;
    return subscribeGroupMessages(sel as string, (msgs, meta) => {
      setGroupMessages(msgs);
      setGroupMeta(meta);
    });
  }, [sel, isGroupSel, account]);

  const allPublicMessages = useMemo(
    () => mergePages(publicOlder, messages),
    [publicOlder, messages]
  );
  const allGroupMessages = useMemo(
    () => mergePages(groupOlder, groupMessages),
    [groupOlder, groupMessages]
  );

  const loadOlderPublic = async () => {
    if (!publicMeta.oldest) return;
    const page = await fetchOlderChatMessages({ before: publicMeta.oldest });
    setPublicOlder((prev) => mergePages(page.messages, prev));
    setPublicMeta(page.meta);
  };

  const loadOlderGroup = async () => {
    if (!activeGroup || !groupMeta.oldest) return;
    const page = await fetchOlderChatMessages({
      groupId: activeGroup.id,
      before: groupMeta.oldest,
    });
    setGroupOlder((prev) => mergePages(page.messages, prev));
    setGroupMeta(page.meta);
  };

  /* grup dihapus/dikeluarkan saat sedang dibuka → kembali ke daftar
     (pola render-adjust seperti di bottom-nav) */
  if (isGroupSel && groupsReady && !activeGroup) {
    setSel(null);
    setInfoOpen(false);
  }

  /* daftar calon anggota dimuat saat dialog dibuka */
  useEffect(() => {
    if ((!createOpen && !infoOpen) || profilesLoaded) return;
    listProfiles()
      .then((list) => {
        setProfiles(
          list.map((p) => ({
            uid: p.uid,
            name: p.displayName || "Warga",
            photoUrl: p.photoUrl,
          }))
        );
        setProfilesLoaded(true);
      })
      .catch(() => setProfilesLoaded(true));
  }, [createOpen, infoOpen, profilesLoaded]);

  /* gabung grup lewat tautan undangan: /chat?join=<groupId> */
  useEffect(() => {
    if (!account || joinHandled.current) return;
    const params = new URLSearchParams(window.location.search);
    const joinId = params.get("join");
    if (!joinId) return;
    joinHandled.current = true;
    joinChatGroup(
      joinId,
      account.displayName || account.email || "Warga",
      account.photoURL ?? undefined,
      params.get("code") ?? undefined
    )
      .then(() => setSel(joinId))
      .catch((e) =>
        setShellError(
          e instanceof Error ? e.message : "Gagal bergabung ke grup."
        )
      )
      .finally(() => {
        window.history.replaceState(null, "", window.location.pathname);
      });
  }, [account]);

  const candidates = useMemo(() => {
    const map = new Map<string, GroupMemberCandidate>();
    for (const p of profiles) map.set(p.uid, p);
    for (const m of messages) {
      if (!map.has(m.userId) && m.userId) {
        map.set(m.userId, {
          uid: m.userId,
          name: m.name || "Warga",
          photoUrl: m.photoUrl,
        });
      }
    }
    for (const g of groups) {
      for (const [mid, info] of Object.entries(g.members ?? {})) {
        if (!map.has(mid)) {
          map.set(mid, { uid: mid, name: info.name, photoUrl: info.photoUrl });
        }
      }
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [profiles, messages, groups]);

  const updateName = (value: string) => {
    setNameOverride(value);
    localStorage.setItem(NAME_KEY, value);
  };

  const nameInput = (
    <input
      value={name}
      onChange={(e) => updateName(e.target.value)}
      maxLength={40}
      placeholder="Nama kamu"
      aria-label="Nama tampilan"
      className="w-24 shrink-0 rounded-lg border border-card-border bg-card/50 px-2.5 py-1.5 text-xs text-fg outline-none focus:border-accent sm:w-40"
    />
  );

  /* ===== handler chat publik ===== */
  const sendPublic = async (text: string, image: File | null) => {
    const imageUrl = image ? await uploadChatImage(image) : undefined;
    await sendChatMessage(text, name.trim() || "Anonim", {
      imageUrl,
      photoUrl: account?.photoURL ?? undefined,
    });
  };

  const replyPublic = async (
    parent: ChatMessageDoc,
    text: string,
    image: File | null
  ) => {
    const imageUrl = image ? await uploadChatImage(image) : undefined;
    await sendChatMessage(text, name.trim() || "Anonim", {
      imageUrl,
      photoUrl: account?.photoURL ?? undefined,
      parentId: parent.id,
      parentName: parent.name,
      parentText: parent.text.slice(0, 80),
    });
  };

  /* ===== handler grup ===== */
  const sendGroup = async (text: string, image: File | null) => {
    if (!activeGroup) return;
    const imageUrl = image ? await uploadChatImage(image) : undefined;
    await sendGroupMessage(activeGroup.id, text, name.trim() || "Anonim", {
      imageUrl,
      photoUrl: account?.photoURL ?? undefined,
    });
  };

  const replyGroup = async (
    parent: ChatMessageDoc,
    text: string,
    image: File | null
  ) => {
    if (!activeGroup) return;
    const imageUrl = image ? await uploadChatImage(image) : undefined;
    await sendGroupMessage(activeGroup.id, text, name.trim() || "Anonim", {
      imageUrl,
      photoUrl: account?.photoURL ?? undefined,
      parentId: parent.id,
      parentName: parent.name,
      parentText: parent.text.slice(0, 80),
    });
  };

  /* ===== aksi grup (admin/anggota) ===== */
  const run = async (fn: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    setShellError(null);
    try {
      await fn();
    } catch (e) {
      setShellError(
        e instanceof Error ? e.message : "Aksi gagal. Coba lagi."
      );
    } finally {
      setBusy(false);
    }
  };

  const handleCreate = (groupName: string, members: GroupMemberCandidate[]) =>
    run(async () => {
      const id = await createChatGroup(groupName, members);
      setCreateOpen(false);
      setSel(id);
    });

  if (authLoading) {
    return (
      <GlassCard className="flex h-[65dvh] md:h-[calc(100dvh-11rem)] min-h-[460px] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-accent" />
      </GlassCard>
    );
  }

  if (!account) {
    return (
      <GlassCard className="flex h-[65dvh] md:h-[calc(100dvh-11rem)] min-h-[460px] flex-col items-center justify-center gap-4 p-8 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-accent/10 text-accent shadow-[0_8px_20px_var(--glow)]">
          <Lock className="h-7 w-7" />
        </span>
        <div>
          <h3 className="text-base font-bold text-fg">
            Chat Publik & Grup Khusus Anggota
          </h3>
          <p className="mt-1.5 max-w-sm text-sm text-fg-muted">
            Masuk atau daftar akun terlebih dahulu untuk membaca, mengirim
            pesan, dan membuat grup seperti di WhatsApp.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={() => router.push("/login")}
            className="flex items-center gap-2 rounded-xl bg-accent/15 px-4 py-2.5 text-sm font-bold text-accent hover:bg-accent/25"
          >
            <LogIn className="h-4 w-4" />
            Masuk
          </button>
          <button
            type="button"
            onClick={() => router.push("/login")}
            className="flex items-center gap-2 rounded-xl border border-card-border bg-white/5 px-4 py-2.5 text-sm font-bold text-fg hover:bg-white/10"
          >
            <UserPlus className="h-4 w-4" />
            Daftar Akun
          </button>
        </div>
      </GlassCard>
    );
  }

  return (
    <>
      <div className="grid h-[65dvh] min-h-[460px] gap-3 md:h-[calc(100dvh-11rem)] md:grid-cols-[280px_minmax(0,1fr)]">
        {/* ===== daftar percakapan ===== */}
        <aside
          className={`min-h-0 flex-col ${
            sel === null ? "flex" : "hidden md:flex"
          }`}
        >
          <GlassCard className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="flex items-center justify-between gap-2 border-b border-card-border p-3">
              <div className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5 text-accent" />
                <h3 className="text-sm font-semibold text-fg">Obrolan</h3>
              </div>
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                className="flex items-center gap-1.5 rounded-xl bg-accent/15 px-3 py-2 text-xs font-bold text-accent hover:bg-accent/25"
              >
                <Users className="h-4 w-4" />
                Grup Baru
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2 [scrollbar-width:thin]">
              <button
                type="button"
                onClick={() => setSel(PUBLIC_ROOM)}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                  sel === PUBLIC_ROOM
                    ? "bg-accent/10 ring-1 ring-accent/40"
                    : "hover:bg-white/5"
                }`}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
                  <MessagesSquare className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-fg">
                    Chat Publik
                  </span>
                  <span className="block truncate text-[11px] text-fg-muted">
                    Semua warga WasspadaApp
                  </span>
                </span>
              </button>

              {groups.map((g) => {
                const myRole = uid ? g.roles?.[uid] : undefined;
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => setSel(g.id)}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                      sel === g.id
                        ? "bg-accent/10 ring-1 ring-accent/40"
                        : "hover:bg-white/5"
                    }`}
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-secondary/15 text-accent-secondary">
                      <Users className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate text-sm font-semibold text-fg">
                          {g.name}
                        </span>
                        {myRole === "admin" && (
                          <span className="shrink-0 rounded-full bg-accent/15 px-1.5 py-0.5 text-[8px] font-bold uppercase text-accent">
                            Admin
                          </span>
                        )}
                      </span>
                      <span className="block truncate text-[11px] text-fg-muted">
                        {g.lastMessageText
                          ? `${g.lastMessageName}: ${g.lastMessageText}`
                          : `${g.memberIds?.length ?? 0} anggota`}
                      </span>
                    </span>
                    {g.lastMessageAt && (
                      <span className="shrink-0 self-start pt-0.5 text-[9px] text-fg-muted">
                        {formatChatTime(g.lastMessageAt)}
                      </span>
                    )}
                  </button>
                );
              })}

              {groups.length === 0 && (
                <p className="px-3 py-4 text-center text-[11px] text-fg-muted">
                  Belum ada grup. Buat grup untuk koordinasi RT/RW seperti di
                  WhatsApp.
                </p>
              )}
            </div>
          </GlassCard>
        </aside>

        {/* ===== ruang chat ===== */}
        <section
          className={`min-h-0 min-w-0 flex-col ${
            sel === null ? "hidden md:flex" : "flex"
          }`}
        >
          {sel === PUBLIC_ROOM && (
            <ChatRoom
              uid={uid!}
              messages={allPublicMessages}
              hasMore={publicMeta.hasMore}
              onLoadOlder={loadOlderPublic}
              title="Chat Publik"
              subtitle="Semua pengguna WasspadaApp"
              badge={
                <span className="inline-flex shrink-0 items-center rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-bold text-accent">
                  <Users className="mr-1 h-3 w-3" />
                  Publik
                </span>
              }
              headerRight={nameInput}
              onBack={() => setSel(null)}
              placeholder="Tulis pesan untuk semua pengguna..."
              emptyText="Belum ada pesan. Jadilah yang pertama menyapa!"
              configured={configured}
              supabaseReady={supabaseReady}
              canDelete={(m) => m.userId === uid}
              onSend={sendPublic}
              onReply={replyPublic}
              onToggleLike={(m) => toggleChatLike(m.id, m.likes ?? [], uid!)}
              onEdit={(m, t) => editChatMessage(m.id, t)}
              onDelete={(m) => deleteChatMessage(m.id)}
            />
          )}

          {sel !== PUBLIC_ROOM && activeGroup && (
            <ChatRoom
              uid={uid!}
              messages={allGroupMessages}
              hasMore={groupMeta.hasMore}
              onLoadOlder={loadOlderGroup}
              title={activeGroup.name}
              subtitle={`${activeGroup.memberIds?.length ?? 0} anggota${
                isAdmin ? " · kamu admin" : ""
              }`}
              badge={
                <span className="inline-flex shrink-0 items-center rounded-full bg-accent-secondary/10 px-2 py-0.5 text-[10px] font-bold text-accent-secondary">
                  <Users className="mr-1 h-3 w-3" />
                  Grup
                </span>
              }
              headerRight={nameInput}
              onBack={() => setSel(null)}
              onOpenInfo={() => setInfoOpen(true)}
              placeholder={`Pesan ke ${activeGroup.name}...`}
              emptyText="Belum ada pesan di grup ini. Mulai percakapan!"
              configured={configured}
              supabaseReady={supabaseReady}
              canDelete={(m) => m.userId === uid || isAdmin}
              onSend={sendGroup}
              onReply={replyGroup}
              onToggleLike={(m) =>
                toggleGroupMessageLike(activeGroup.id, m.id, m.likes ?? [], uid!)
              }
              onEdit={(m, t) => editGroupMessage(activeGroup.id, m.id, t)}
              onDelete={(m) => deleteGroupMessage(activeGroup.id, m.id)}
            />
          )}

          {sel === null && (
            <GlassCard className="hidden min-h-0 flex-1 flex-col items-center justify-center gap-3 p-8 text-center md:flex">
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-accent/10 text-accent shadow-[0_8px_20px_var(--glow)]">
                <MessagesSquare className="h-7 w-7" />
              </span>
              <div>
                <h3 className="text-base font-bold text-fg">
                  Pilih percakapan
                </h3>
                <p className="mt-1 max-w-xs text-sm text-fg-muted">
                  Buka Chat Publik atau salah satu grup di sebelah kiri untuk
                  mulai berdiskusi.
                </p>
              </div>
            </GlassCard>
          )}
        </section>
      </div>

      {shellError && (
        <p className="mt-2 rounded-lg bg-red-500/10 p-2 text-xs text-red-400">
          {shellError}
        </p>
      )}

      {createOpen && (
        <CreateGroupDialog
          candidates={candidates}
          selfUid={account.uid}
          busy={busy}
          onClose={() => setCreateOpen(false)}
          onCreate={handleCreate}
        />
      )}

      {infoOpen && activeGroup && (
        <GroupInfoDialog
          group={activeGroup}
          selfUid={account.uid}
          candidates={candidates}
          busy={busy}
          onClose={() => setInfoOpen(false)}
          onRename={(n) =>
            run(() => renameChatGroup(activeGroup.id, n))
          }
          onToggleRole={(target, makeAdmin) =>
            run(() =>
              setGroupMemberRole(
                activeGroup.id,
                target,
                makeAdmin ? "admin" : "member"
              )
            )
          }
          onRemove={(target) =>
            run(() => removeGroupMember(activeGroup.id, target))
          }
          onAdd={(members) =>
            run(() => addGroupMembers(activeGroup.id, members))
          }
          onLeave={() =>
            run(async () => {
              await removeGroupMember(activeGroup.id, account.uid);
              setInfoOpen(false);
              setSel(null);
            })
          }
          onDisband={() =>
            run(async () => {
              await deleteChatGroup(activeGroup.id);
              setInfoOpen(false);
              setSel(null);
            })
          }
          onResetInvite={() =>
            run(() => resetGroupInvite(activeGroup.id))
          }
        />
      )}
    </>
  );
}
