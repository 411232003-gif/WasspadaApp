"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  ChevronRight,
  LayoutDashboard,
  LogIn,
  LogOut,
  Map,
  MessageCircle,
  Newspaper,
  ShieldAlert,
  TriangleAlert,
  UserCircle2,
  X,
} from "lucide-react";
import { logout, useAuthUser } from "@/lib/auth";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/live-map", label: "Monev Map", icon: Map },
  { href: "/alert-center", label: "Pusat Peringatan", icon: TriangleAlert },
  { href: "/news", label: "Berita Bencana", icon: Newspaper },
  { href: "/chat", label: "Chat Publik", icon: MessageCircle },
  { href: "/profil", label: "Profil Saya", icon: UserCircle2 },
];

function WindowDots({ big = false }: { big?: boolean }) {
  return (
    <div className={`gs-dots${big ? " big" : ""}`}>
      <span className="g" />
      <span className="r" />
      <span className="y" />
    </div>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { user } = useAuthUser();

  const initial = (user?.displayName || user?.email || "T")
    .charAt(0)
    .toUpperCase();
  const displayName = user?.displayName || user?.email || "Tamu";
  const avatar = user?.photoURL ? (
    <span className="gs-avatar gs-avatar-photo">
      <img src={user.photoURL} alt={displayName} />
    </span>
  ) : (
    <span className="gs-avatar">{initial}</span>
  );

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  return (
    <div className={`gs-wrap${open ? " open" : ""} hidden md:block`}>
      {/* ===== rail: hanya tombol fitur + akun ===== */}
      <aside className="gs-rail">
        <span className="gs-shine" />
        <WindowDots />

        <button
          type="button"
          className="gs-logo"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Tutup menu" : "Buka menu"}
          aria-expanded={open}
        >
          {open ? <X className="h-6 w-6" /> : <ShieldAlert className="h-6 w-6" />}
        </button>

        <div className="gs-line" />

        <Link
          href={user ? "/profil" : "/login"}
          className="gs-profile"
          aria-label={user ? displayName : "Masuk"}
          data-tip={user ? `${displayName} — Profil` : "Masuk"}
        >
          {user ? (
            avatar
          ) : (
            <span className="gs-avatar gs-avatar-login">
              <LogIn className="h-5 w-5" />
            </span>
          )}
        </Link>
      </aside>

      {/* ===== panel fitur ===== */}
      <section className="gs-panel" aria-hidden={!open}>
        <span className="gs-shine" />
        <WindowDots big />

        <h1 className="gs-title">Wasspada</h1>
        <span className="gs-menu-title">SEMUA FITUR</span>
        <div className="gs-divider" />

        <ul className="gs-menu">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <li key={item.href} className={active ? "current" : ""}>
                <Link href={item.href} onClick={() => setOpen(false)}>
                  <span className="gs-menu-item">
                    <Icon className="h-5 w-5" />
                    <span>{item.label}</span>
                  </span>
                  {active ? (
                    <ChevronRight className="h-4 w-4" />
                  ) : (
                    <span className="gs-dot" />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>

        {/* footer akun: profil bila masuk, tombol masuk bila belum */}
        <div className="gs-foot">
          <Link
            href={user ? "/profil" : "/login"}
            className="gs-account"
            onClick={() => setOpen(false)}
          >
            {user ? (
              avatar
            ) : (
              <span className="gs-avatar gs-avatar-login">
                <LogIn className="h-5 w-5" />
              </span>
            )}
            <span className="gs-account-text">
              <strong>{user ? displayName : "Masuk Akun"}</strong>
              <small>
                {user ? "Lihat profil saya" : "Masuk untuk simpan data kamu"}
              </small>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0" />
          </Link>
          {user && (
            <button
              type="button"
              onClick={handleLogout}
              className="gs-logout"
              aria-label="Keluar"
              title="Keluar"
            >
              <LogOut className="h-4 w-4" />
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
