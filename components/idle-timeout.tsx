"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { logout, useAuthUser } from "@/lib/auth";

const IDLE_LIMIT_MS = 15 * 60 * 1000;

// Halaman pemantauan dibiarkan tanpa timeout — pengguna bisa "diam" sambil
// memantau data live.
const MONITOR_PAGES = new Set(["/", "/live-map", "/alert-center"]);

const ACTIVITY_EVENTS = [
  "mousemove",
  "mousedown",
  "keydown",
  "touchstart",
  "scroll",
  "wheel",
] as const;

export function IdleTimeout() {
  const { user, loading } = useAuthUser();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (loading || !user || MONITOR_PAGES.has(pathname)) return;

    let timer: ReturnType<typeof setTimeout>;
    const onIdle = async () => {
      await logout();
      router.replace("/login?reason=idle");
    };
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(onIdle, IDLE_LIMIT_MS);
    };
    reset();

    for (const e of ACTIVITY_EVENTS) {
      window.addEventListener(e, reset, { passive: true });
    }
    return () => {
      clearTimeout(timer);
      for (const e of ACTIVITY_EVENTS) {
        window.removeEventListener(e, reset);
      }
    };
  }, [user, loading, pathname, router]);

  return null;
}
