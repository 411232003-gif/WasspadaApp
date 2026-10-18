"use client";

import { useAlert } from "@/lib/alert-context";
import { fetchPVMBG, findTargetVolcano } from "@/lib/live-api";
import { useSmartPolling } from "@/lib/use-smart-polling";

const TARGET_VOLCANO = process.env.NEXT_PUBLIC_TARGET_VOLCANO || "Merapi";

export function LiveAlertSync() {
  const { alertLevel, setAlertLevel } = useAlert();

  const sync = async () => {
    const data = await fetchPVMBG();
    if (data.error || data.volcanoes.length === 0) return;
    const target = findTargetVolcano(data.volcanoes, TARGET_VOLCANO);
    if (target) setAlertLevel(target.level);
  };

  useSmartPolling(sync, {
    stableIntervalMs: 300000,
    alertIntervalMs: 60000,
    isAlertActive: alertLevel >= 3,
  });

  return null;
}
