"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  Box,
  ChevronRight,
  Info,
  LayoutDashboard,
  LogIn,
  LogOut,
  Map,
  MessageCircle,
  Newspaper,
  ShieldAlert,
  TriangleAlert,
  UserCircle2,
} from "lucide-react";
import { logout, useAuthUser } from "@/lib/auth";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/live-map", label: "Live Map", icon: Map },
  { href: "/3d-hazard", label: "3D Hazard Zone", icon: Box },
  { href: "/alert-center", label: "Alert Center", icon: TriangleAlert },
  { href: "/news", label: "Berita", icon: Newspaper },
  { href: "/chat", label: "Chat Publik", icon: MessageCircle },
  { href: "/profil", label: "Profil", icon: UserCircle2 },
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
      {/* ===== rail ikon (selalu terlihat) ===== */}
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
          <ShieldAlert className="h-6 w-6" />
        </button>

        <div className="gs-line" />

        <ul className="gs-mini">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <li key={item.href} className={active ? "active" : ""}>
                <Link href={item.href} aria-label={item.label} data-tip={item.label}>
                  <Icon className="h-5 w-5" />
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="gs-line" />

        <ul className="gs-mini">
          <li>
            {user ? (
              <button
                type="button"
                onClick={handleLogout}
                aria-label="Keluar"
                data-tip="Keluar"
              >
                <LogOut className="h-5 w-5" />
              </button>
            ) : (
              <Link href="/login" aria-label="Masuk" data-tip="Masuk">
                <LogIn className="h-5 w-5" />
              </Link>
            )}
          </li>
        </ul>

        <Link
          href={user ? "/profil" : "/login"}
          className="gs-profile"
          aria-label={displayName}
          data-tip={user ? `${displayName} — Profil` : "Masuk"}
        >
          {avatar}
        </Link>
      </aside>

      {/* ===== panel yang mengembang ===== */}
      <section className="gs-panel" aria-hidden={!open}>
        <span className="gs-shine" />
        <WindowDots big />

        <h1 className="gs-title">Wasspada</h1>
        <span className="gs-menu-title">MENU</span>
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

        <div className="gs-divider" />

        <ul className="gs-menu secondary">
          <li>
            <span className="gs-menu-item">
              <Info className="h-5 w-5" />
              <span>Data real: BMKG, PVMBG, GDACS</span>
            </span>
          </li>
          <li>
            {user ? (
              <button
                type="button"
                onClick={handleLogout}
                className="gs-menu-item w-full text-left"
              >
                <LogOut className="h-5 w-5" />
                <span>Keluar</span>
              </button>
            ) : (
              <Link href="/login" className="gs-menu-item">
                <LogIn className="h-5 w-5" />
                <span>Masuk</span>
              </Link>
            )}
          </li>
        </ul>

        <Link href={user ? "/profil" : "/login"} className="gs-account">
          {avatar}
          <span className="gs-account-text">
            <strong>{displayName}</strong>
            <small>{user ? "Akun terdaftar" : "Pengguna anonim"}</small>
          </span>
          <ChevronRight className="h-4 w-4" />
        </Link>
      </section>
    </div>
  );
}
