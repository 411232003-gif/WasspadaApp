"use client";

import { useEffect } from "react";
import { useAlert } from "@/lib/alert-context";
import { fetchPVMBG, findTargetVolcano } from "@/lib/live-api";

const TARGET_VOLCANO = process.env.NEXT_PUBLIC_TARGET_VOLCANO || "Merapi";

export function LiveAlertSync() {
  const { setAlertLevel } = useAlert();

  useEffect(() => {
    let cancelled = false;

    async function sync() {
      try {
        const data = await fetchPVMBG();
        if (cancelled || data.error || data.volcanoes.length === 0) return;
        const target = findTargetVolcano(data.volcanoes, TARGET_VOLCANO);
        if (target) {
          setAlertLevel(target.level);
        }
      } catch {
        // ignore sync errors
      }
    }

    sync();
    const interval = setInterval(sync, 120000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [setAlertLevel]);

  return null;
}
