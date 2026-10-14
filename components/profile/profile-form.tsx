"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Calendar,
  Camera,
  Loader2,
  LogIn,
  Lock,
  Save,
  UserCircle2,
} from "lucide-react";
import { GlassCard } from "@/components/glass-card";
import { useAuthUser } from "@/lib/auth";
import { getUserProfile, saveUserProfile } from "@/lib/profile";
import { isSupabaseConfigured, uploadChatImage } from "@/lib/supabase";

export function ProfileForm() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuthUser();

  const [name, setName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [existingPhoto, setExistingPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const preview = useMemo(
    () => (photo ? URL.createObjectURL(photo) : null),
    [photo]
  );
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  useEffect(() => {
    if (!user) return;
    getUserProfile(user.uid)
      .then((p) => {
        setName(p?.displayName || user.displayName || "");
        setBirthDate(p?.birthDate || "");
        setExistingPhoto(p?.photoUrl || user.photoURL);
      })
      .catch(() => {
        setName(user.displayName ?? "");
        setExistingPhoto(user.photoURL);
      });
  }, [user]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || busy) return;
    if (!name.trim()) {
      setError("Nama wajib diisi.");
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      let photoUrl = existingPhoto ?? undefined;
      if (photo) {
        if (!isSupabaseConfigured()) {
          setError("Supabase belum dikonfigurasi — foto tidak tersimpan.");
          return;
        }
        photoUrl = await uploadChatImage(photo);
        setExistingPhoto(photoUrl);
        setPhoto(null);
      }
      await saveUserProfile(user.uid, {
        displayName: name.trim(),
        birthDate,
        ...(photoUrl ? { photoUrl } : {}),
      });
      setNotice("Profil tersimpan. Foto & nama akan tampil di chat.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan profil.");
    } finally {
      setBusy(false);
    }
  };

  if (authLoading) {
    return (
      <GlassCard className="mx-auto flex max-w-md items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-accent" />
      </GlassCard>
    );
  }

  if (!user) {
    return (
      <GlassCard className="mx-auto flex max-w-md flex-col items-center gap-4 p-8 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-accent/10 text-accent shadow-[0_8px_20px_var(--glow)]">
          <Lock className="h-6 w-6" />
        </span>
        <p className="text-sm text-fg-muted">
          Masuk dulu untuk mengatur profil kamu.
        </p>
        <button
          type="button"
          onClick={() => router.push("/login")}
          className="flex items-center gap-2 rounded-xl bg-accent/15 px-4 py-2.5 text-sm font-bold text-accent hover:bg-accent/25"
        >
          <LogIn className="h-4 w-4" />
          Masuk / Daftar
        </button>
      </GlassCard>
    );
  }

  const shownPhoto = preview ?? existingPhoto;

  return (
    <GlassCard className="mx-auto max-w-md p-6 sm:p-8">
      <form onSubmit={save} className="space-y-5">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            setPhoto(e.target.files?.[0] ?? null);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          aria-label="Ganti foto profil"
          className="relative mx-auto block h-24 w-24 overflow-hidden rounded-full border-2 border-accent/40 bg-accent/10 shadow-[0_8px_24px_var(--glow)] transition-transform hover:scale-105"
        >
          {shownPhoto ? (
            <img
              src={shownPhoto}
              alt="Foto profil"
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-accent">
              <UserCircle2 className="h-10 w-10" />
            </span>
          )}
          <span className="absolute bottom-0 right-0 flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-green-500 to-purple-600 text-white shadow-md">
            <Camera className="h-3.5 w-3.5" />
          </span>
        </button>
        <p className="text-center text-[11px] text-fg-muted">
          Ketuk untuk ganti foto (otomatis dikompres &lt; 5 MB)
        </p>

        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-fg-muted">
            Nama tampilan
          </label>
          <div className="relative">
            <UserCircle2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-muted" />
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={40}
              required
              placeholder="Nama kamu"
              className="w-full rounded-xl border border-card-border bg-card/50 py-2.5 pl-10 pr-3 text-sm text-fg outline-none focus:border-accent"
            />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-fg-muted">
            Tanggal lahir
          </label>
          <div className="relative">
            <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-muted" />
            <input
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              max={new Date().toISOString().slice(0, 10)}
              className="w-full rounded-xl border border-card-border bg-card/50 py-2.5 pl-10 pr-3 text-sm text-fg outline-none focus:border-accent"
            />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-fg-muted">
            Email
          </label>
          <input
            type="email"
            value={user.email ?? ""}
            disabled
            className="w-full rounded-xl border border-card-border bg-card/30 px-3 py-2.5 text-sm text-fg-muted"
          />
        </div>

        {error && (
          <p className="rounded-lg bg-red-500/10 p-2.5 text-xs text-red-400">
            {error}
          </p>
        )}
        {notice && (
          <p className="rounded-lg bg-green-500/10 p-2.5 text-xs text-green-400">
            {notice}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent/15 py-3 text-sm font-bold text-accent transition-all hover:bg-accent/25 hover:shadow-[0_8px_20px_var(--glow)] disabled:opacity-60"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {busy ? "Menyimpan..." : "Simpan Profil"}
        </button>
      </form>
    </GlassCard>
  );
}
