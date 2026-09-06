"use client";

import { useEffect, useState } from "react";
import { Activity, Flame, RefreshCw } from "lucide-react";
import { GlassCard } from "@/components/glass-card";
import { subscribeAlerts, AlertDoc } from "@/lib/firestore";
import { Timestamp } from "firebase/firestore";
import { ALERT_LEVELS } from "@/lib/alert-context";

function formatTime(value: Timestamp | number) {
  const date =
    typeof value === "number"
      ? new Date(value)
      : (value as unknown as { toDate: () => Date }).toDate();
  return date.toLocaleString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    day: "2-digit",
    month: "short",
  });
}

export function AlertFeed({ limit = 10 }: { limit?: number }) {
  const [alerts, setAlerts] = useState<AlertDoc[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(false);
    const unsubscribe = subscribeAlerts((data) => {
      setAlerts(data.slice(0, limit));
    });
    return unsubscribe;
  }, [limit]);

  return (
    <div className="space-y-3">
      {loading && (
        <div className="flex items-center justify-center py-8 text-fg-muted">
          <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
          Memuat data...
        </div>
      )}

      {!loading && alerts.length === 0 && (
        <GlassCard className="p-6 text-center text-sm text-fg-muted">
          Belum ada alert. Gunakan Mock BMKG Feed untuk menghasilkan data.
        </GlassCard>
      )}

      {alerts.map((alert) => {
        const level = ALERT_LEVELS[alert.level];
        const Icon = alert.type === "earthquake" ? Activity : Flame;
        return (
          <GlassCard key={alert.id} className="p-4">
            <div className="flex items-start gap-3">
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                style={{
                  backgroundColor: `${level.color}15`,
                  boxShadow: `0 0 10px ${level.glow}`,
                }}
              >
                <Icon className="h-4 w-4" style={{ color: level.color }} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-semibold text-fg truncate">{alert.title}</h3>
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                    style={{
                      backgroundColor: `${level.color}20`,
                      color: level.color,
                    }}
                  >
                    {level.shortLabel}
                  </span>
                </div>
                <p className="mt-1 text-sm text-fg-muted">{alert.description}</p>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-fg-muted">
                  <span className="capitalize">{alert.type}</span>
                  {alert.magnitude !== undefined && (
                    <span>M {alert.magnitude}</span>
                  )}
                  {alert.depth !== undefined && <span>{alert.depth} km</span>}
                  {alert.volcanoStatus && <span>{alert.volcanoStatus}</span>}
                  <span>{formatTime(alert.createdAt)}</span>
                </div>
              </div>
            </div>
          </GlassCard>
        );
      })}
    </div>
  );
}
