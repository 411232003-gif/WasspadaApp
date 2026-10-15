"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Heart,
  ImageOff,
  ImagePlus,
  Loader2,
  Lock,
  LogIn,
  MessageCircle,
  Send,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { GlassCard } from "@/components/glass-card";
import { useAuthUser } from "@/lib/auth";
import {
  sendChatMessage,
  subscribeChatMessages,
  toggleChatLike,
  getFirebaseStatus,
  ChatMessageDoc,
} from "@/lib/firestore";
import {
  cleanupExpiredChatImages,
  isSupabaseConfigured,
  uploadChatImage,
} from "@/lib/supabase";
import { Timestamp } from "firebase/firestore";

const NAME_KEY = "wasspada-chat-name";

function defaultName() {
  return `Warga-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

function formatTime(value: Timestamp | number | null) {
  if (!value) return "";
  const date =
    typeof value === "number"
      ? new Date(value)
      : (value as unknown as { toDate: () => Date }).toDate();
  return date.toLocaleString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "short",
  });
}

function msgMillis(value: ChatMessageDoc["createdAt"]) {
  if (!value) return 0;
  if (typeof value === "number") return value;
  const d = (value as unknown as { toDate?: () => Date }).toDate?.();
  return d ? d.getTime() : 0;
}

function ChatImage({ src }: { src: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <p className="mt-1.5 flex items-center gap-1.5 rounded-xl border border-card-border bg-black/20 px-3 py-2 text-[11px] italic text-fg-muted">
        <ImageOff className="h-3.5 w-3.5" />
        Foto kedaluwarsa (otomatis dihapus setelah 5 hari)
      </p>
    );
  }
  return (
    <a
      href={src}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-1.5 block"
    >
      <img
        src={src}
        alt="Foto dari chat"
        className="max-h-64 w-auto rounded-xl border border-card-border object-cover"
        loading="lazy"
        onError={() => setFailed(true)}
      />
    </a>
  );
}

interface ComposerProps {
  text: string;
  onTextChange: (value: string) => void;
  image: File | null;
  onImageChange: (file: File | null) => void;
  onSend: () => void;
  sending: boolean;
  disabled: boolean;
  placeholder: string;
  compact?: boolean;
}

function Composer({
  text,
  onTextChange,
  image,
  onImageChange,
  onSend,
  sending,
  disabled,
  placeholder,
  compact,
}: ComposerProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const preview = useMemo(
    () => (image ? URL.createObjectURL(image) : null),
    [image]
  );

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const pad = compact ? "p-2" : "p-3";
  const inputPad = compact ? "px-3 py-2 text-xs" : "px-3.5 py-2.5 text-sm";

  return (
    <div className={compact ? "" : `border-t border-card-border ${pad}`}>
      {preview && (
        <div className="relative mb-2 inline-block">
          <img
            src={preview}
            alt="Lampiran"
            className="h-20 rounded-xl border border-card-border object-cover"
          />
          <button
            type="button"
            onClick={() => onImageChange(null)}
            aria-label="Hapus foto"
            className="absolute -right-2 -top-2 rounded-full bg-black/70 p-1 text-white"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSend();
        }}
        className="flex items-center gap-2"
      >
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            onImageChange(e.target.files?.[0] ?? null);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={disabled || sending}
          aria-label="Lampirkan foto"
          title="Kirim foto"
          className={`rounded-xl bg-white/5 text-fg-muted hover:text-accent disabled:opacity-50 ${
            compact ? "p-2" : "p-2.5"
          }`}
        >
          <ImagePlus className={compact ? "h-4 w-4" : "h-5 w-5"} />
        </button>
        <input
          value={text}
          onChange={(e) => onTextChange(e.target.value)}
          maxLength={500}
          placeholder={placeholder}
          aria-label={placeholder}
          className={`flex-1 rounded-xl border border-card-border bg-card/50 text-fg outline-none placeholder:text-fg-muted focus:border-accent ${inputPad}`}
        />
        <button
          type="submit"
          disabled={(!text.trim() && !image) || sending || disabled}
          className={`flex items-center gap-1.5 rounded-xl bg-accent/15 font-bold text-accent hover:bg-accent/25 disabled:opacity-50 ${
            compact ? "px-3 py-2 text-xs" : "px-4 py-2.5 text-sm"
          }`}
        >
          {sending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          {!compact && <span className="hidden sm:inline">Kirim</span>}
        </button>
      </form>
    </div>
  );
}

function ChatAvatar({ src, name }: { src?: string; name: string }) {
  const [failed, setFailed] = useState(false);
  if (src && !failed) {
    return (
      <img
        src={src}
        alt={name}
        onError={() => setFailed(true)}
        className="h-6 w-6 shrink-0 rounded-full border border-card-border object-cover"
      />
    );
  }
  return (
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/20 text-[10px] font-bold text-accent">
      {(name || "?").slice(0, 1).toUpperCase()}
    </span>
  );
}

export function CommunityChat() {
  const router = useRouter();
  const { user: account, loading: authLoading } = useAuthUser();
  const [messages, setMessages] = useState<ChatMessageDoc[]>([]);
  const [text, setText] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [nameOverride, setNameOverride] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openThread, setOpenThread] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replyImage, setReplyImage] = useState<File | null>(null);
  const [replySending, setReplySending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const configured = getFirebaseStatus().configured;
  const supabaseReady = isSupabaseConfigured();

  const uid = account?.uid ?? null;
  const name =
    nameOverride ??
    account?.displayName ??
    account?.email ??
    "Anonim";

  useEffect(() => {
    if (!account) return;
    cleanupExpiredChatImages().catch(() => {});
    return subscribeChatMessages(setMessages);
  }, [account]);

  const topLevel = useMemo(
    () => messages.filter((m) => !m.parentId),
    [messages]
  );

  const repliesByParent = useMemo(() => {
    const map = new Map<string, ChatMessageDoc[]>();
    for (const m of messages) {
      if (!m.parentId) continue;
      const list = map.get(m.parentId) ?? [];
      list.push(m);
      map.set(m.parentId, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => msgMillis(a.createdAt) - msgMillis(b.createdAt));
    }
    return map;
  }, [messages]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [topLevel.length]);

  const updateName = (value: string) => {
    setNameOverride(value);
    localStorage.setItem(NAME_KEY, value || defaultName());
  };

  const send = async () => {
    const trimmed = text.trim();
    if ((!trimmed && !image) || sending) return;
    setSending(true);
    setError(null);
    try {
      const imageUrl = image ? await uploadChatImage(image) : undefined;
      await sendChatMessage(trimmed, name.trim() || "Anonim", {
        imageUrl,
        photoUrl: account?.photoURL ?? undefined,
      });
      setText("");
      setImage(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal mengirim pesan");
    } finally {
      setSending(false);
    }
  };

  const sendReply = async (parent: ChatMessageDoc) => {
    const trimmed = replyText.trim();
    if ((!trimmed && !replyImage) || replySending) return;
    setReplySending(true);
    setError(null);
    try {
      const imageUrl = replyImage
        ? await uploadChatImage(replyImage)
        : undefined;
      await sendChatMessage(trimmed, name.trim() || "Anonim", {
        imageUrl,
        photoUrl: account?.photoURL ?? undefined,
        parentId: parent.id,
        parentName: parent.name,
        parentText: parent.text.slice(0, 80),
      });
      setReplyText("");
      setReplyImage(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal mengirim balasan");
    } finally {
      setReplySending(false);
    }
  };

  const toggleLike = async (msg: ChatMessageDoc) => {
    if (!uid) return;
    try {
      await toggleChatLike(msg.id, msg.likes ?? [], uid);
    } catch {
      setError("Gagal memberi like. Coba lagi.");
    }
  };

  const renderBubble = (msg: ChatMessageDoc, isReply = false) => {
    const own = uid != null && msg.userId === uid;
    const likes = msg.likes ?? [];
    const liked = uid != null && likes.includes(uid);
    const replies = repliesByParent.get(msg.id) ?? [];
    const threadOpen = openThread === msg.id;

    return (
      <div
        key={msg.id}
        className={`flex flex-col ${own ? "items-end" : "items-start"}`}
      >
        <div
          className={`${
            isReply
              ? "max-w-[90%] rounded-2xl rounded-bl-sm bg-white/5 px-3 py-2"
              : `max-w-[80%] rounded-2xl px-3.5 py-2 sm:max-w-[65%] ${
                  own
                    ? "rounded-br-sm bg-accent/15 border border-accent/40"
                    : "rounded-bl-sm bg-white/5 border border-card-border"
                }`
          }`}
          style={
            own && !isReply ? { boxShadow: "0 0 12px var(--glow)" } : undefined
          }
        >
          <p
            className={`flex items-center gap-1.5 text-[10px] font-bold ${
              own ? "text-accent" : "text-fg-muted"
            }`}
          >
            <ChatAvatar src={msg.photoUrl} name={msg.name} />
            {own ? "Kamu" : msg.name || "Anonim"}
          </p>
          {msg.parentName && !isReply && (
            <p className="mt-0.5 truncate text-[10px] italic text-fg-muted">
              Membalas {msg.parentName}: “{msg.parentText}”
            </p>
          )}
          {msg.imageUrl && <ChatImage src={msg.imageUrl} />}
          {msg.text && (
            <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-fg">
              {msg.text}
            </p>
          )}

          {!isReply && (
            <div className="mt-1.5 flex items-center gap-4">
              <button
                type="button"
                onClick={() => toggleLike(msg)}
                disabled={!uid}
                aria-label="Sukai pesan"
                className={`flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold transition-colors ${
                  liked ? "text-red-400" : "text-fg-muted hover:text-red-400"
                }`}
              >
                <Heart
                  className={`h-3.5 w-3.5 ${liked ? "fill-red-400" : ""}`}
                />
                {likes.length > 0 ? likes.length : ""}
              </button>
              <button
                type="button"
                onClick={() => {
                  setOpenThread(threadOpen ? null : msg.id);
                  setReplyText("");
                  setReplyImage(null);
                }}
                aria-label="Komentar"
                className={`flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold transition-colors ${
                  threadOpen ? "text-accent" : "text-fg-muted hover:text-accent"
                }`}
              >
                <MessageCircle className="h-3.5 w-3.5" />
                {replies.length > 0 ? replies.length : ""}
              </button>
            </div>
          )}
        </div>
        <span className="mt-1 px-1 text-[9px] text-fg-muted">
          {formatTime(msg.createdAt)}
        </span>

        {!isReply && threadOpen && (
          <div className="mt-1 w-[92%] space-y-2 rounded-xl border border-card-border bg-black/20 p-2.5 sm:w-[80%]">
            {replies.map((r) => renderBubble(r, true))}
            <Composer
              compact
              text={replyText}
              onTextChange={setReplyText}
              image={replyImage}
              onImageChange={setReplyImage}
              onSend={() => sendReply(msg)}
              sending={replySending}
              disabled={!configured}
              placeholder={`Balas ${msg.name}...`}
            />
          </div>
        )}
      </div>
    );
  };

  if (authLoading) {
    return (
      <GlassCard className="flex h-[60vh] md:h-[calc(100vh-11rem)] min-h-[420px] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-accent" />
      </GlassCard>
    );
  }

  if (!account) {
    return (
      <GlassCard className="flex h-[60vh] md:h-[calc(100vh-11rem)] min-h-[420px] flex-col items-center justify-center gap-4 p-8 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-accent/10 text-accent shadow-[0_8px_20px_var(--glow)]">
          <Lock className="h-7 w-7" />
        </span>
        <div>
          <h3 className="text-base font-bold text-fg">
            Chat Publik Khusus Anggota
          </h3>
          <p className="mt-1.5 max-w-sm text-sm text-fg-muted">
            Masuk atau daftar akun terlebih dahulu untuk membaca dan mengirim
            pesan di chat publik.
          </p>
        </div>
        <div className="flex gap-3">
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
    <GlassCard className="flex h-[60vh] md:h-[calc(100vh-11rem)] min-h-[420px] flex-col overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-card-border p-4">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5 text-accent" />
          <h3 className="text-sm font-semibold text-fg">Chat Publik</h3>
          <span className="inline-flex items-center rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-bold text-accent">
            <Users className="mr-1 h-3 w-3" />
            Semua Pengguna
          </span>
        </div>
        <input
          value={name}
          onChange={(e) => updateName(e.target.value)}
          maxLength={40}
          placeholder="Nama kamu"
          aria-label="Nama tampilan"
          className="w-32 rounded-lg border border-card-border bg-card/50 px-2.5 py-1.5 text-xs text-fg outline-none focus:border-accent sm:w-40"
        />
      </div>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
        {!configured && (
          <p className="rounded-lg bg-yellow-500/10 p-3 text-center text-xs text-yellow-400">
            Layanan chat sedang tidak aktif. Silakan coba lagi nanti.
          </p>
        )}
        {configured && !supabaseReady && (
          <p className="rounded-lg bg-yellow-500/10 p-3 text-center text-xs text-yellow-400">
            Fitur kirim foto sedang nonaktif — kirim teks tetap bisa digunakan.
          </p>
        )}
        {configured && topLevel.length === 0 && (
          <p className="py-10 text-center text-sm text-fg-muted">
            Belum ada pesan. Jadilah yang pertama menyapa!
          </p>
        )}
        {topLevel.map((msg) => renderBubble(msg))}
      </div>

      {error && (
        <p className="mx-4 mb-2 rounded-lg bg-red-500/10 p-2 text-xs text-red-400">
          {error}
        </p>
      )}

      <Composer
        text={text}
        onTextChange={setText}
        image={image}
        onImageChange={setImage}
        onSend={send}
        sending={sending}
        disabled={!configured}
        placeholder="Tulis pesan untuk semua pengguna..."
      />
    </GlassCard>
  );
}
