"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Lock, Mail, Plus, User } from "lucide-react";
import {
  isFirebaseConfigured,
  loginWithEmail,
  registerWithEmail,
  resetPassword,
  useAuthUser,
} from "@/lib/auth";
import {
  CaptchaBox,
  CaptchaHandle,
  isCaptchaConfigured,
  verifyCaptcha,
} from "@/components/auth/captcha-box";
import { isSupabaseConfigured, uploadChatImage } from "@/lib/supabase";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function AuthCard() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuthUser();

  const [flipped, setFlipped] = useState(false);
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPass, setRegPass] = useState("");
  const [regPhoto, setRegPhoto] = useState<File | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const loginCaptchaRef = useRef<CaptchaHandle>(null);
  const regCaptchaRef = useRef<CaptchaHandle>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const photoPreview = useMemo(
    () => (regPhoto ? URL.createObjectURL(regPhoto) : null),
    [regPhoto]
  );
  useEffect(() => {
    return () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview);
    };
  }, [photoPreview]);

  useEffect(() => {
    if (!authLoading && user) router.replace("/");
  }, [authLoading, user, router]);

  const resetCaptchas = () => {
    loginCaptchaRef.current?.reset();
    regCaptchaRef.current?.reset();
    setCaptchaToken(null);
  };

  const flipTo = (signup: boolean) => {
    setFlipped(signup);
    setError(null);
    setNotice(null);
    resetCaptchas();
  };

  const ensureCaptcha = async (): Promise<boolean> => {
    if (!isCaptchaConfigured) return true;
    if (!captchaToken) {
      setError("Selesaikan verifikasi captcha dulu.");
      return false;
    }
    const ok = await verifyCaptcha(captchaToken);
    if (!ok) {
      setError("Verifikasi captcha gagal. Coba lagi.");
      resetCaptchas();
      return false;
    }
    return true;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!EMAIL_RE.test(loginEmail.trim())) {
      setError("Masukkan alamat email yang valid.");
      return;
    }
    if (loginPass.length < 6) {
      setError("Password minimal 6 karakter.");
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (!(await ensureCaptcha())) return;
      await loginWithEmail(loginEmail, loginPass, remember);
      router.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login gagal.");
      resetCaptchas();
    } finally {
      setBusy(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!regName.trim()) {
      setError("Nama wajib diisi.");
      return;
    }
    if (!EMAIL_RE.test(regEmail.trim())) {
      setError("Masukkan alamat email yang valid.");
      return;
    }
    if (regPass.length < 6) {
      setError("Password minimal 6 karakter.");
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (!(await ensureCaptcha())) return;
      let photoURL: string | undefined;
      if (regPhoto && isSupabaseConfigured()) {
        photoURL = await uploadChatImage(regPhoto);
      }
      await registerWithEmail(regName, regEmail, regPass, photoURL);
      router.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Pendaftaran gagal.");
      resetCaptchas();
    } finally {
      setBusy(false);
    }
  };

  const handleForgot = async () => {
    if (busy) return;
    if (!EMAIL_RE.test(loginEmail.trim())) {
      setError("Isi email kamu dulu, lalu klik Lupa password.");
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await resetPassword(loginEmail);
      setNotice("Link reset password dikirim ke email kamu. Cek inbox/spam.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengirim reset.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className={flipped ? "flip-scene flipped" : "flip-scene"}>
        <div className="flip-card">
          {/* FRONT — LOGIN */}
          <div className="glass-circle front">
            <form className="login-form" onSubmit={handleLogin}>
              <h1>Login</h1>
              <div className="subtitle">Masuk ke akun WasspadaApp</div>

              {error && !flipped && <div className="form-msg error">{error}</div>}
              {notice && !flipped && <div className="form-msg ok">{notice}</div>}

              <div className="input-box">
                <Mail className="in-icon" />
                <input
                  type="email"
                  placeholder="Email"
                  autoComplete="email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  maxLength={100}
                  required
                />
              </div>

              <div className="input-box">
                <Lock className="in-icon" />
                <input
                  type="password"
                  placeholder="Password"
                  autoComplete="current-password"
                  value={loginPass}
                  onChange={(e) => setLoginPass(e.target.value)}
                  maxLength={72}
                  required
                />
              </div>

              <div className="forgot">
                <div className="remember">
                  <button
                    type="button"
                    className={remember ? "switch on" : "switch"}
                    onClick={() => setRemember(!remember)}
                    aria-label="Ingat saya"
                    aria-pressed={remember}
                  />
                  Ingat saya
                </div>
                <button type="button" className="link" onClick={handleForgot}>
                  Lupa password?
                </button>
              </div>

              <CaptchaBox ref={loginCaptchaRef} onChange={setCaptchaToken} />

              <button type="submit" className="submit" disabled={busy}>
                {busy ? "Memproses..." : "Masuk"}
              </button>

              <div className="signup-text">
                Belum punya akun?{" "}
                <button type="button" onClick={() => flipTo(true)}>
                  Daftar
                </button>
              </div>
            </form>
          </div>

          {/* BACK — SIGN UP */}
          <div className="glass-circle back">
            <form className="login-form" onSubmit={handleRegister}>
              <h1>Daftar</h1>
              <div className="subtitle">Buat akun baru</div>

              {error && flipped && <div className="form-msg error">{error}</div>}
              {notice && flipped && <div className="form-msg ok">{notice}</div>}

              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  setRegPhoto(e.target.files?.[0] ?? null);
                  e.target.value = "";
                }}
              />
              <button
                type="button"
                className="photo-pick"
                onClick={() => photoInputRef.current?.click()}
                aria-label="Pilih foto profil"
                title="Foto profil (opsional)"
              >
                {photoPreview ? (
                  <img src={photoPreview} alt="Foto profil" />
                ) : (
                  <span className="ph-icon">
                    <Camera size={22} />
                  </span>
                )}
                <span className="ph-badge">
                  <Plus size={12} />
                </span>
              </button>

              <div className="input-box">
                <User className="in-icon" />
                <input
                  type="text"
                  placeholder="Nama lengkap"
                  autoComplete="name"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  maxLength={40}
                  required
                />
              </div>

              <div className="input-box">
                <Mail className="in-icon" />
                <input
                  type="email"
                  placeholder="Email"
                  autoComplete="email"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  maxLength={100}
                  required
                />
              </div>

              <div className="input-box" style={{ marginBottom: 22 }}>
                <Lock className="in-icon" />
                <input
                  type="password"
                  placeholder="Password (min. 6 karakter)"
                  autoComplete="new-password"
                  value={regPass}
                  onChange={(e) => setRegPass(e.target.value)}
                  maxLength={72}
                  required
                />
              </div>

              <CaptchaBox ref={regCaptchaRef} onChange={setCaptchaToken} />

              <button type="submit" className="submit" disabled={busy}>
                {busy ? "Memproses..." : "Buat Akun"}
              </button>

              <div className="signup-text">
                Sudah punya akun?{" "}
                <button type="button" onClick={() => flipTo(false)}>
                  Login
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
      {!isFirebaseConfigured && (
        <p className="mt-4 text-center text-xs" style={{ color: "#8a1010" }}>
          Firebase belum dikonfigurasi — login tidak aktif.
        </p>
      )}
    </div>
  );
}


