"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Map, Box, TriangleAlert, MessageCircle, Newspaper, UserCircle2 } from "lucide-react";

const NAV_ITEMS = [
  { href: "/", label: "Home", icon: LayoutDashboard },
  { href: "/live-map", label: "Map", icon: Map },
  { href: "/3d-hazard", label: "Hazard", icon: Box },
  { href: "/alert-center", label: "Alerts", icon: TriangleAlert },
  { href: "/news", label: "Berita", icon: Newspaper },
  { href: "/chat", label: "Chat", icon: MessageCircle },
  { href: "/profil", label: "Profil", icon: UserCircle2 },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 glass-panel pb-[env(safe-area-inset-bottom)] md:hidden">
      <div className="flex h-16 items-center">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-0.5 py-2 text-[10px] font-medium transition-colors ${
                isActive
                  ? "text-accent"
                  : "text-fg-muted hover:text-fg"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
