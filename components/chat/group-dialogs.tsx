"use client";

import { useEffect, useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import {
  Check,
  Copy,
  Crown,
  Download,
  Link2,
  Loader2,
  LogOut,
  RefreshCw,
  Share2,
  Shield,
  ShieldOff,
  Trash2,
  UserMinus,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { GlassCard } from "@/components/glass-card";
import { ChatAvatar } from "@/components/chat/chat-room";
import {
  ChatGroupDoc,
  GroupMemberCandidate,
} from "@/lib/firestore";

function DialogShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 p-3 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <GlassCard className="flex max-h-[85dvh] flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b border-card-border p-4">
            <h3 className="text-sm font-bold text-fg">{title}</h3>
            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup"
              className="rounded-lg p-1.5 text-fg-muted hover:text-fg"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
            {children}
          </div>
        </GlassCard>
      </div>
    </div>
  );
}

function MemberChecklist({
  candidates,
  excludeIds,
  selected,
  onToggle,
}: {
  candidates: GroupMemberCandidate[];
  excludeIds: Set<string>;
  selected: Set<string>;
  onToggle: (uid: string) => void;
}) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const list = candidates.filter(
    (c) => !excludeIds.has(c.uid) && (!q || c.name.toLowerCase().includes(q))
  );

  return (
    <div className="space-y-2">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Cari pengguna..."
        className="w-full rounded-xl border border-card-border bg-card/50 px-3 py-2 text-xs text-fg outline-none placeholder:text-fg-muted focus:border-accent"
      />
      <ul className="max-h-56 space-y-1 overflow-y-auto pr-1 [scrollbar-width:thin]">
        {list.map((c) => {
          const on = selected.has(c.uid);
          return (
            <li key={c.uid}>
              <button
                type="button"
                onClick={() => onToggle(c.uid)}
                className={`flex w-full items-center gap-2.5 rounded-xl border px-3 py-2 text-left text-sm transition-colors ${
                  on
                    ? "border-accent/50 bg-accent/10 text-fg"
                    : "border-transparent text-fg hover:bg-white/5"
                }`}
              >
                <ChatAvatar src={c.photoUrl} name={c.name} />
                <span className="min-w-0 flex-1 truncate">{c.name}</span>
                <span
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-md border ${
                    on
                      ? "border-accent bg-accent/25 text-accent"
                      : "border-card-border text-transparent"
                  }`}
                >
                  <Check className="h-3 w-3" />
                </span>
              </button>
            </li>
          );
        })}
        {list.length === 0 && (
          <li className="py-4 text-center text-xs text-fg-muted">
            Tidak ada pengguna yang cocok. Pengguna baru muncul setelah
            melengkapi profil atau mengirim pesan di chat publik.
          </li>
        )}
      </ul>
    </div>
  );
}

export function CreateGroupDialog({
  candidates,
  selfUid,
  busy,
  onClose,
  onCreate,
}: {
  candidates: GroupMemberCandidate[];
  selfUid: string;
  busy: boolean;
  onClose: () => void;
  onCreate: (name: string, members: GroupMemberCandidate[]) => void;
}) {
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const exclude = new Set([selfUid]);

  const toggle = (uid: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });

  return (
    <DialogShell title="Buat Grup Baru" onClose={onClose}>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={60}
        placeholder="Nama grup (mis. Siaga RT 05)"
        autoFocus
        className="w-full rounded-xl border border-card-border bg-card/50 px-3.5 py-2.5 text-sm text-fg outline-none placeholder:text-fg-muted focus:border-accent"
      />

      <p className="text-[11px] font-semibold uppercase tracking-wide text-fg-muted">
        Pilih anggota ({selected.size} dipilih)
      </p>
      <MemberChecklist
        candidates={candidates}
        excludeIds={exclude}
        selected={selected}
        onToggle={toggle}
      />

      <p className="text-[11px] text-fg-muted">
        Kamu otomatis menjadi admin grup dan bisa mengatur role anggota
        lain nanti.
      </p>

      <button
        type="button"
        disabled={busy}
        onClick={() =>
          onCreate(
            name.trim() || "Grup Baru",
            candidates.filter((c) => selected.has(c.uid))
          )
        }
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent/15 py-2.5 text-sm font-bold text-accent hover:bg-accent/25 disabled:opacity-60"
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Users className="h-4 w-4" />
        )}
        Buat Grup
      </button>
    </DialogShell>
  );
}

export function GroupInfoDialog({
  group,
  selfUid,
  candidates,
  busy,
  onClose,
  onRename,
  onToggleRole,
  onRemove,
  onAdd,
  onLeave,
  onDisband,
  onResetInvite,
}: {
  group: ChatGroupDoc;
  selfUid: string;
  candidates: GroupMemberCandidate[];
  busy: boolean;
  onClose: () => void;
  onRename: (name: string) => void;
  onToggleRole: (uid: string, makeAdmin: boolean) => void;
  onRemove: (uid: string) => void;
  onAdd: (members: GroupMemberCandidate[]) => void;
  onLeave: () => void;
  onDisband: () => void;
  onResetInvite: () => void;
}) {
  const isAdmin = group.roles?.[selfUid] === "admin";
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState(group.name);
  const [lastName, setLastName] = useState(group.name);
  const [adding, setAdding] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [showInvite, setShowInvite] = useState(false);
  const [copied, setCopied] = useState(false);
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);

  if (lastName !== group.name) {
    setLastName(group.name);
    setNameDraft(group.name);
  }

  const inviteUrl =
    group.inviteCode && typeof window !== "undefined"
      ? `${window.location.origin}/chat?join=${group.id}&code=${group.inviteCode}`
      : "";

  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard API ditolak — tautan tetap bisa disalin manual */
    }
  };

  const downloadQr = () => {
    const canvas = qrCanvasRef.current;
    if (!canvas) return;
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `qr-${group.name.replace(/\s+/g, "-").toLowerCase()}.png`;
    a.click();
  };

  const shareInvite = async () => {
    const text = `Gabung ke grup "${group.name}" di WasspadaApp`;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: group.name, text, url: inviteUrl });
        return;
      } catch {
        /* dibatalkan pengguna / tidak didukung — fallback ke salin */
      }
    }
    copyInvite();
  };

  const members = group.memberIds ?? [];
  const exclude = new Set([...members, selfUid]);

  const togglePick = (uid: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });

  return (
    <DialogShell title="Info Grup" onClose={onClose}>
      <div className="flex items-center gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent/15 text-accent">
          <Users className="h-6 w-6" />
        </span>
        <div className="min-w-0 flex-1">
          {renaming && isAdmin ? (
            <div className="flex items-center gap-1.5">
              <input
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                maxLength={60}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    onRename(nameDraft);
                    setRenaming(false);
                  }
                  if (e.key === "Escape") setRenaming(false);
                }}
                className="min-w-0 flex-1 rounded-lg border border-accent/50 bg-black/30 px-2.5 py-1.5 text-sm text-fg outline-none"
              />
              <button
                type="button"
                aria-label="Simpan nama grup"
                onClick={() => {
                  onRename(nameDraft);
                  setRenaming(false);
                }}
                className="rounded-lg bg-accent/15 p-1.5 text-accent hover:bg-accent/25"
              >
                <Check className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={!isAdmin}
              onClick={() => isAdmin && setRenaming(true)}
              className="block min-w-0 text-left"
              title={isAdmin ? "Ketuk untuk ubah nama" : undefined}
            >
              <h4 className="truncate text-sm font-bold text-fg">
                {group.name}
              </h4>
              <p className="text-[11px] text-fg-muted">
                {members.length} anggota
                {isAdmin ? " · kamu admin" : ""}
              </p>
            </button>
          )}
        </div>
      </div>

      <p className="text-[11px] font-semibold uppercase tracking-wide text-fg-muted">
        Anggota
      </p>
      <ul className="space-y-1">
        {members.map((uid) => {
          const info = group.members?.[uid];
          const role = group.roles?.[uid] ?? "member";
          const isSelf = uid === selfUid;
          const isCreator = uid === group.createdBy;
          return (
            <li
              key={uid}
              className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 hover:bg-white/5"
            >
              <ChatAvatar src={info?.photoUrl} name={info?.name || "?"} />
              <span className="min-w-0 flex-1 truncate text-sm text-fg">
                {info?.name || "Warga"}
                {isSelf && <span className="text-fg-muted"> (kamu)</span>}
              </span>
              {isCreator && (
                <Crown
                  className="h-3.5 w-3.5 shrink-0 text-yellow-400"
                  aria-label="Pembuat grup"
                />
              )}
              {role === "admin" && (
                <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[9px] font-bold uppercase text-accent">
                  Admin
                </span>
              )}
              {isAdmin && !isSelf && (
                <span className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onToggleRole(uid, role !== "admin")}
                    aria-label={
                      role === "admin"
                        ? "Cabut status admin"
                        : "Jadikan admin"
                    }
                    title={
                      role === "admin"
                        ? "Cabut status admin"
                        : "Jadikan admin"
                    }
                    className="rounded-lg bg-white/5 p-1.5 text-fg-muted hover:text-accent disabled:opacity-50"
                  >
                    {role === "admin" ? (
                      <ShieldOff className="h-3.5 w-3.5" />
                    ) : (
                      <Shield className="h-3.5 w-3.5" />
                    )}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onRemove(uid)}
                    aria-label="Keluarkan dari grup"
                    title="Keluarkan dari grup"
                    className="rounded-lg bg-white/5 p-1.5 text-fg-muted hover:text-red-400 disabled:opacity-50"
                  >
                    <UserMinus className="h-3.5 w-3.5" />
                  </button>
                </span>
              )}
            </li>
          );
        })}
      </ul>

      {isAdmin && (
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setAdding((v) => !v)}
            className="flex w-full items-center gap-2 rounded-xl border border-card-border px-3 py-2 text-sm font-semibold text-fg hover:bg-white/5"
          >
            <UserPlus className="h-4 w-4 text-accent" />
            Tambah anggota
          </button>
          {adding && (
            <>
              <MemberChecklist
                candidates={candidates}
                excludeIds={exclude}
                selected={picked}
                onToggle={togglePick}
              />
              <button
                type="button"
                disabled={busy || picked.size === 0}
                onClick={() => {
                  onAdd(candidates.filter((c) => picked.has(c.uid)));
                  setPicked(new Set());
                  setAdding(false);
                }}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent/15 py-2 text-xs font-bold text-accent hover:bg-accent/25 disabled:opacity-60"
              >
                {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Tambahkan {picked.size > 0 ? `(${picked.size})` : ""}
              </button>
            </>
          )}
        </div>
      )}

      {/* ===== undangan via tautan & QR ===== */}
      {(group.inviteCode || isAdmin) && (
        <button
          type="button"
          onClick={() => setShowInvite((v) => !v)}
          className="flex w-full items-center gap-2 rounded-xl border border-card-border px-3 py-2 text-sm font-semibold text-fg hover:bg-white/5"
        >
          <Link2 className="h-4 w-4 text-accent" />
          Undang via tautan / QR
        </button>
      )}
      {showInvite && (
        <div className="space-y-3 rounded-xl border border-card-border bg-black/20 p-3">
          {group.inviteCode ? (
            <>
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={inviteUrl}
                  onFocus={(e) => e.target.select()}
                  aria-label="Tautan undangan grup"
                  className="min-w-0 flex-1 rounded-lg border border-card-border bg-card/50 px-2.5 py-2 text-[11px] text-fg outline-none"
                />
                <button
                  type="button"
                  onClick={copyInvite}
                  className="flex shrink-0 items-center gap-1 rounded-lg bg-accent/15 px-2.5 py-2 text-[11px] font-bold text-accent hover:bg-accent/25"
                >
                  {copied ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  {copied ? "Tersalin" : "Salin"}
                </button>
              </div>
              <div className="flex justify-center rounded-xl bg-white p-3">
                <QRCodeCanvas
                  ref={qrCanvasRef}
                  value={inviteUrl}
                  size={160}
                  bgColor="#ffffff"
                  fgColor="#0f172a"
                  level="M"
                  marginSize={2}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={downloadQr}
                  className="flex items-center justify-center gap-1.5 rounded-lg bg-white/5 px-2 py-2 text-[11px] font-bold text-fg hover:bg-white/10"
                >
                  <Download className="h-3.5 w-3.5" />
                  Unduh QR
                </button>
                <button
                  type="button"
                  onClick={shareInvite}
                  className="flex items-center justify-center gap-1.5 rounded-lg bg-white/5 px-2 py-2 text-[11px] font-bold text-fg hover:bg-white/10"
                >
                  <Share2 className="h-3.5 w-3.5" />
                  Bagikan
                </button>
              </div>
              <p className="text-center text-[10px] text-fg-muted">
                Siapa pun yang punya tautan/QR ini bisa bergabung sebagai
                anggota.
              </p>
              {isAdmin && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    if (
                      window.confirm(
                        "Reset tautan undangan? Tautan & QR lama langsung tidak berlaku."
                      )
                    ) {
                      onResetInvite();
                    }
                  }}
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-red-500/30 px-2 py-1.5 text-[11px] font-bold text-red-400 hover:bg-red-500/10 disabled:opacity-60"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Reset tautan undangan
                </button>
              )}
            </>
          ) : (
            isAdmin && (
              <button
                type="button"
                disabled={busy}
                onClick={onResetInvite}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent/15 py-2.5 text-xs font-bold text-accent hover:bg-accent/25 disabled:opacity-60"
              >
                {busy ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Link2 className="h-3.5 w-3.5" />
                )}
                Aktifkan tautan undangan
              </button>
            )
          )}
        </div>
      )}

      <button
        type="button"
        disabled={busy}
        onClick={onLeave}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-500/10 py-2.5 text-sm font-bold text-red-400 hover:bg-red-500/20 disabled:opacity-60"
      >
        <LogOut className="h-4 w-4" />
        Keluar dari Grup
      </button>

      {isAdmin && (
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            if (
              window.confirm(
                `Bubarkan grup "${group.name}"? Semua pesan akan dihapus permanen.`
              )
            ) {
              onDisband();
            }
          }}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/40 bg-red-500/5 py-2.5 text-sm font-bold text-red-400 hover:bg-red-500/15 disabled:opacity-60"
        >
          <Trash2 className="h-4 w-4" />
          Bubarkan Grup
        </button>
      )}
    </DialogShell>
  );
}
