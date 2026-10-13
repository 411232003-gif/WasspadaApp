"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Map, Box, TriangleAlert, MessageCircle, Newspaper } from "lucide-react";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/live-map", label: "Live Map", icon: Map },
  { href: "/3d-hazard", label: "3D Hazard Zone", icon: Box },
  { href: "/alert-center", label: "Alert Center", icon: TriangleAlert },
  { href: "/news", label: "Berita", icon: Newspaper },
  { href: "/chat", label: "Chat Publik", icon: MessageCircle },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-16 md:left-0 z-30">
      <div className="flex h-full flex-col gap-2 p-4">
        <div className="mb-4 px-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-fg-muted">
            Menu
          </p>
        </div>
        <nav className="flex flex-col gap-2">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                data-active={isActive}
                className="nav-link"
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span className="text-sm font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto rounded-xl glass-panel p-3">
          <p className="text-xs font-semibold text-accent">BMKG Feed</p>
          <p className="mt-1 text-xs text-fg-muted">
            Data gempa dan status gunung api akan ditampilkan di dashboard.
          </p>
        </div>
      </div>
    </aside>
  );
}
