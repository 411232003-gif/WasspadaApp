"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import {
  Check,
  ChevronLeft,
  Heart,
  History,
  ImageOff,
  ImagePlus,
  Info,
  Loader2,
  MessageCircle,
  Pencil,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { GlassCard } from "@/components/glass-card";
import { ChatMessageDoc } from "@/lib/firestore";
import { Timestamp } from "firebase/firestore";

export function formatChatTime(value: Timestamp | number | null | undefined) {
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

export function ChatImage({ src }: { src: string }) {
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
      <Image
        src={src}
        alt="Foto dari chat"
        width={960}
        height={720}
        sizes="(max-width: 640px) 100vw, 640px"
        className="max-h-64 max-w-full w-auto rounded-xl border border-card-border object-cover"
        loading="lazy"
        onError={() => setFailed(true)}
      />
    </a>
  );
}

export function ChatAvatar({ src, name }: { src?: string; name: string }) {
  const [failed, setFailed] = useState(false);
  if (src && !failed) {
    return (
      <Image
        src={src}
        alt={name}
        width={24}
        height={24}
        unoptimized
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
          <Image
            src={preview}
            alt="Lampiran"
            width={320}
            height={320}
            unoptimized
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
          className={`min-w-0 flex-1 rounded-xl border border-card-border bg-card/50 text-fg outline-none placeholder:text-fg-muted focus:border-accent ${inputPad}`}
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

export interface ChatRoomProps {
  uid: string;
  messages: ChatMessageDoc[];
  /** masih ada pesan lama yang bisa dimuat (pagination) */
  hasMore?: boolean;
  onLoadOlder?: () => Promise<void>;
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  headerRight?: React.ReactNode;
  onBack?: () => void;
  onOpenInfo?: () => void;
  placeholder: string;
  emptyText: string;
  configured: boolean;
  supabaseReady: boolean;
  /** siapa boleh menghapus pesan (pemilik pesan / admin grup) */
  canDelete: (msg: ChatMessageDoc) => boolean;
  onSend: (text: string, image: File | null) => Promise<void>;
  onReply: (
    parent: ChatMessageDoc,
    text: string,
    image: File | null
  ) => Promise<void>;
  onToggleLike: (msg: ChatMessageDoc) => Promise<void>;
  onEdit: (msg: ChatMessageDoc, text: string) => Promise<void>;
  onDelete: (msg: ChatMessageDoc) => Promise<void>;
}

export function ChatRoom({
  uid,
  messages,
  hasMore,
  onLoadOlder,
  title,
  subtitle,
  badge,
  headerRight,
  onBack,
  onOpenInfo,
  placeholder,
  emptyText,
  configured,
  supabaseReady,
  canDelete,
  onSend,
  onReply,
  onToggleLike,
  onEdit,
  onDelete,
}: ChatRoomProps) {
  const [text, setText] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openThread, setOpenThread] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replyImage, setReplyImage] = useState<File | null>(null);
  const [replySending, setReplySending] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  /** scrollHeight sebelum pesan lama di-prepend — untuk menjaga posisi scroll */
  const pendingScrollRef = useRef<number | null>(null);

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

  /* auto-scroll hanya saat pesan TERBARU berubah, bukan saat memuat riwayat */
  const lastMsgId = topLevel.length ? topLevel[topLevel.length - 1].id : null;
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [lastMsgId]);

  /* setelah pesan lama ter-render di atas, kembalikan posisi scroll */
  useLayoutEffect(() => {
    const prevHeight = pendingScrollRef.current;
    if (prevHeight == null) return;
    pendingScrollRef.current = null;
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight - prevHeight;
  }, [messages]);

  const loadOlder = async () => {
    if (!onLoadOlder || loadingOlder) return;
    const el = scrollRef.current;
    pendingScrollRef.current = el?.scrollHeight ?? 0;
    setLoadingOlder(true);
    try {
      await onLoadOlder();
    } catch (e) {
      pendingScrollRef.current = null;
      setError(
        e instanceof Error ? e.message : "Gagal memuat pesan lama"
      );
    } finally {
      setLoadingOlder(false);
    }
  };

  const send = async () => {
    const trimmed = text.trim();
    if ((!trimmed && !image) || sending) return;
    setSending(true);
    setError(null);
    try {
      await onSend(trimmed, image);
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
      await onReply(parent, trimmed, replyImage);
      setReplyText("");
      setReplyImage(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal mengirim balasan");
    } finally {
      setReplySending(false);
    }
  };

  const saveEdit = async (msg: ChatMessageDoc) => {
    const trimmed = editText.trim();
    if (!trimmed || editSaving) return;
    setEditSaving(true);
    setError(null);
    try {
      await onEdit(msg, trimmed);
      setEditingId(null);
      setEditText("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal mengedit pesan");
    } finally {
      setEditSaving(false);
    }
  };

  const remove = async (msg: ChatMessageDoc) => {
    if (!window.confirm("Hapus pesan ini untuk semua orang?")) return;
    setError(null);
    try {
      await onDelete(msg);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menghapus pesan");
    }
  };

  const renderBubble = (msg: ChatMessageDoc, isReply = false) => {
    const own = msg.userId === uid;
    const likes = msg.likes ?? [];
    const liked = likes.includes(uid);
    const replies = repliesByParent.get(msg.id) ?? [];
    const threadOpen = openThread === msg.id;
    const editing = editingId === msg.id;

    return (
      <div
        key={msg.id}
        className={`flex min-w-0 flex-col ${own ? "items-end" : "items-start"}`}
      >
        <div
          className={`${
            isReply
              ? "max-w-[90%] rounded-2xl rounded-bl-sm bg-white/5 px-3 py-2"
              : `max-w-[85%] rounded-2xl px-3.5 py-2 sm:max-w-[65%] ${
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
            <span className="min-w-0 truncate">
              {own ? "Kamu" : msg.name || "Anonim"}
            </span>
          </p>
          {msg.parentName && !isReply && (
            <p className="mt-0.5 truncate text-[10px] italic text-fg-muted">
              Membalas {msg.parentName}: “{msg.parentText}”
            </p>
          )}
          {msg.imageUrl && <ChatImage src={msg.imageUrl} />}

          {editing ? (
            <div className="mt-1 flex items-center gap-1.5">
              <input
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                maxLength={500}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveEdit(msg);
                  if (e.key === "Escape") setEditingId(null);
                }}
                className="min-w-0 flex-1 rounded-lg border border-accent/50 bg-black/30 px-2.5 py-1.5 text-xs text-fg outline-none"
              />
              <button
                type="button"
                onClick={() => saveEdit(msg)}
                disabled={!editText.trim() || editSaving}
                aria-label="Simpan edit"
                className="rounded-lg bg-accent/15 p-1.5 text-accent hover:bg-accent/25 disabled:opacity-50"
              >
                {editSaving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Check className="h-3.5 w-3.5" />
                )}
              </button>
              <button
                type="button"
                onClick={() => setEditingId(null)}
                aria-label="Batal edit"
                className="rounded-lg bg-white/5 p-1.5 text-fg-muted hover:text-fg"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            msg.text && (
              <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-fg">
                {msg.text}
                {msg.editedAt && (
                  <span className="ml-1.5 text-[9px] italic text-fg-muted">
                    (diedit)
                  </span>
                )}
              </p>
            )
          )}

          {!isReply && (
            <div className="mt-1.5 flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  onToggleLike(msg).catch((e) =>
                    setError(
                      e instanceof Error ? e.message : "Gagal memberi like."
                    )
                  );
                }}
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
              {own && msg.text && !editing && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(msg.id);
                    setEditText(msg.text);
                  }}
                  aria-label="Edit pesan"
                  title="Edit pesan"
                  className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold text-fg-muted transition-colors hover:text-accent"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              )}
              {canDelete(msg) && (
                <button
                  type="button"
                  onClick={() => remove(msg)}
                  aria-label="Hapus pesan"
                  title="Hapus pesan"
                  className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold text-fg-muted transition-colors hover:text-red-400"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )}
        </div>
        <span className="mt-1 px-1 text-[9px] text-fg-muted">
          {formatChatTime(msg.createdAt)}
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

  return (
    <GlassCard className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b border-card-border p-3 sm:p-4">
        <div className="flex min-w-0 items-center gap-2">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              aria-label="Kembali ke daftar chat"
              className="-ml-1 rounded-lg p-1.5 text-fg-muted hover:text-fg md:hidden"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          )}
          {onOpenInfo ? (
            <button
              type="button"
              onClick={onOpenInfo}
              className="flex min-w-0 items-center gap-2 rounded-lg px-1 py-0.5 text-left hover:bg-white/5"
              title="Info grup & anggota"
            >
              <span className="min-w-0">
                <span className="flex items-center gap-1.5">
                  <h3 className="truncate text-sm font-semibold text-fg">
                    {title}
                  </h3>
                  {badge}
                </span>
                {subtitle && (
                  <p className="truncate text-[11px] text-fg-muted">
                    {subtitle}
                  </p>
                )}
              </span>
              <Info className="h-3.5 w-3.5 shrink-0 text-fg-muted" />
            </button>
          ) : (
            <span className="min-w-0">
              <span className="flex items-center gap-1.5">
                <MessageCircle className="h-5 w-5 shrink-0 text-accent" />
                <h3 className="truncate text-sm font-semibold text-fg">
                  {title}
                </h3>
                {badge}
              </span>
              {subtitle && (
                <p className="truncate text-[11px] text-fg-muted">{subtitle}</p>
              )}
            </span>
          )}
        </div>
        {headerRight}
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3 sm:p-4">
        {hasMore && onLoadOlder && (
          <div className="flex justify-center pb-1">
            <button
              type="button"
              onClick={loadOlder}
              disabled={loadingOlder}
              className="flex items-center gap-1.5 rounded-full border border-card-border bg-white/5 px-3.5 py-1.5 text-[11px] font-semibold text-fg-muted transition-colors hover:border-accent/40 hover:text-accent disabled:opacity-60"
            >
              {loadingOlder ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <History className="h-3 w-3" />
              )}
              Muat pesan lama
            </button>
          </div>
        )}
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
          <p className="py-10 text-center text-sm text-fg-muted">{emptyText}</p>
        )}
        {topLevel.map((msg) => renderBubble(msg))}
      </div>

      {error && (
        <p className="mx-3 mb-2 rounded-lg bg-red-500/10 p-2 text-xs text-red-400 sm:mx-4">
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
        placeholder={placeholder}
      />
    </GlassCard>
  );
}
