"use client";

import { AlertTriangle } from "lucide-react";
import { GlassCard } from "@/components/glass-card";
import { useAlert } from "@/lib/alert-context";

export function AlertMetric() {
  const { alertConfig } = useAlert();

  return (
    <GlassCard className="p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase text-fg-muted">
            Level Peringatan
          </p>
          <p
            className="mt-1 text-2xl font-bold"
            style={{ color: alertConfig.color }}
          >
            {alertConfig.shortLabel}
          </p>
          <p className="text-xs text-fg-muted">Status lokasi saat ini</p>
        </div>
        <div
          className="rounded-xl p-3 glow-ring"
          style={{ backgroundColor: `${alertConfig.color}15` }}
        >
          <AlertTriangle className="h-6 w-6" style={{ color: alertConfig.color }} />
        </div>
      </div>
    </GlassCard>
  );
}
