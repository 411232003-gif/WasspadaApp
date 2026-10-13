"use client";

import { useEffect, useRef, useState } from "react";
import { MessageCircle, Send, Users } from "lucide-react";
import { GlassCard } from "@/components/glass-card";
import {
  sendChatMessage,
  subscribeChatMessages,
  getFirebaseStatus,
  ChatMessageDoc,
} from "@/lib/firestore";
import { ensureUser } from "@/lib/firebase";
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

export function CommunityChat() {
  const [messages, setMessages] = useState<ChatMessageDoc[]>([]);
  const [text, setText] = useState("");
  const [name, setName] = useState("");
  const [uid, setUid] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const configured = getFirebaseStatus().configured;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const saved = localStorage.getItem(NAME_KEY);
      const resolved = saved || defaultName();
      localStorage.setItem(NAME_KEY, resolved);
      const u = await ensureUser();
      if (cancelled) return;
      setName(resolved);
      setUid(u?.uid ?? null);
    })();
    return subscribeChatMessages(setMessages);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  const updateName = (value: string) => {
    setName(value);
    localStorage.setItem(NAME_KEY, value || defaultName());
  };

  const send = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setError(null);
    try {
      await sendChatMessage(trimmed, name.trim() || "Anonim");
      setText("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal mengirim pesan");
    } finally {
      setSending(false);
    }
  };

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

      <div
        ref={scrollRef}
        className="flex-1 space-y-3 overflow-y-auto p-4"
      >
        {!configured && (
          <p className="rounded-lg bg-yellow-500/10 p-3 text-center text-xs text-yellow-400">
            Firebase belum dikonfigurasi. Chat memerlukan koneksi Firestore.
          </p>
        )}
        {configured && messages.length === 0 && (
          <p className="py-10 text-center text-sm text-fg-muted">
            Belum ada pesan. Jadilah yang pertama menyapa!
          </p>
        )}
        {messages.map((msg) => {
          const own = uid != null && msg.userId === uid;
          return (
            <div
              key={msg.id}
              className={`flex flex-col ${own ? "items-end" : "items-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-3.5 py-2 sm:max-w-[65%] ${
                  own
                    ? "rounded-br-sm bg-accent/15 border border-accent/40"
                    : "rounded-bl-sm bg-white/5 border border-card-border"
                }`}
                style={
                  own
                    ? { boxShadow: "0 0 12px var(--glow)" }
                    : undefined
                }
              >
                <p
                  className={`text-[10px] font-bold ${
                    own ? "text-accent" : "text-fg-muted"
                  }`}
                >
                  {own ? "Kamu" : msg.name || "Anonim"}
                </p>
                <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-fg">
                  {msg.text}
                </p>
              </div>
              <span className="mt-1 px-1 text-[9px] text-fg-muted">
                {formatTime(msg.createdAt)}
              </span>
            </div>
          );
        })}
      </div>

      {error && (
        <p className="mx-4 mb-2 rounded-lg bg-red-500/10 p-2 text-xs text-red-400">
          {error}
        </p>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="flex items-center gap-2 border-t border-card-border p-3"
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={500}
          placeholder="Tulis pesan untuk semua pengguna..."
          aria-label="Tulis pesan"
          className="flex-1 rounded-xl border border-card-border bg-card/50 px-3.5 py-2.5 text-sm text-fg outline-none placeholder:text-fg-muted focus:border-accent"
        />
        <button
          type="submit"
          disabled={!text.trim() || sending || !configured}
          className="flex items-center gap-1.5 rounded-xl bg-accent/15 px-4 py-2.5 text-sm font-bold text-accent hover:bg-accent/25 disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
          <span className="hidden sm:inline">Kirim</span>
        </button>
      </form>
    </GlassCard>
  );
}
