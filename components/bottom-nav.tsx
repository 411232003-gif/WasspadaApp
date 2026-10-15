"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  LayoutGrid,
  Map,
  TriangleAlert,
  MessageCircle,
  Newspaper,
  UserCircle2,
  X,
} from "lucide-react";

const FEATURE_ITEMS = [
  { href: "/live-map", label: "Monev", icon: Map },
  { href: "/alert-center", label: "Alerts", icon: TriangleAlert },
  { href: "/news", label: "Berita", icon: Newspaper },
  { href: "/chat", label: "Chat", icon: MessageCircle },
];

/* sudut penyebaran ikon pada busur atas dial */
const FEATURE_ANGLES = [-63, -21, 21, 63];

export function BottomNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [lastPath, setLastPath] = useState(pathname);

  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(false);
  }

  const featureActive = FEATURE_ITEMS.some((i) => pathname === i.href);

  return (
    <>
      {open && (
        <div
          className="mnav-scrim md:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden">
        <div className="glass-panel pb-[env(safe-area-inset-bottom)]">
          <div className="flex h-[4.5rem] items-center justify-between px-10">
            <Link
              href="/"
              className={`mnav-side${pathname === "/" ? " current" : ""}`}
              aria-label="Dashboard"
            >
              <span className="mnav-side-btn">
                <LayoutDashboard className="h-5 w-5" />
              </span>
              <span className="mnav-side-label">Dashboard</span>
            </Link>
            <Link
              href="/profil"
              className={`mnav-side${pathname === "/profil" ? " current" : ""}`}
              aria-label="Profil"
            >
              <span className="mnav-side-btn">
                <UserCircle2 className="h-5 w-5" />
              </span>
              <span className="mnav-side-label">Profil</span>
            </Link>
          </div>
        </div>

        {/* ===== dial radial liquid-glass: semua fitur ===== */}
        <div
          className={`mnav-dial${open ? " open" : ""}${
            featureActive ? " active" : ""
          }`}
        >
          <span className="mnav-plate" />
          <ul className="mnav-items">
            {FEATURE_ITEMS.map((item, i) => {
              const Icon = item.icon;
              const active = pathname === item.href;
              return (
                <li
                  key={item.href}
                  style={
                    {
                      "--a": `${FEATURE_ANGLES[i]}deg`,
                      "--i": i,
                    } as React.CSSProperties
                  }
                >
                  <Link
                    href={item.href}
                    className={`mnav-item${active ? " current" : ""}`}
                    onClick={() => setOpen(false)}
                  >
                    <span className="mnav-item-btn">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="mnav-item-label">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
          <button
            type="button"
            className="mnav-knob"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Tutup menu fitur" : "Buka menu fitur"}
            aria-expanded={open}
          >
            {open ? (
              <X className="h-5 w-5" />
            ) : (
              <LayoutGrid className="h-5 w-5" />
            )}
          </button>
        </div>
      </nav>
    </>
  );
}
