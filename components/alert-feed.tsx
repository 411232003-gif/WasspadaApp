"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Flame,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Rss,
} from "lucide-react";
import { GlassCard } from "@/components/glass-card";
import { subscribeAlerts, AlertDoc } from "@/lib/firestore";
import { fetchBMKG, fetchPVMBG, levelFromEarthquake } from "@/lib/live-api";
import { Timestamp } from "firebase/firestore";
import { ALERT_LEVELS } from "@/lib/alert-context";

function formatTime(value: Timestamp | number | null | undefined) {
  if (!value) return "-";
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

function toMillis(value: AlertDoc["createdAt"] | null | undefined) {
  if (!value) return 0;
  if (typeof value === "number") return value;
  const d = (value as unknown as { toDate?: () => Date }).toDate?.();
  return d ? d.getTime() : 0;
}

function parseTime(iso: string | null | undefined): number {
  if (!iso) return Date.now();
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? Date.now() : t;
}

async function fetchLiveAlerts(): Promise<AlertDoc[]> {
  const [bmkg, pvmbg] = await Promise.all([fetchBMKG(), fetchPVMBG()]);
  const alerts: AlertDoc[] = [];

  const quakes = [bmkg.latest, ...(bmkg.felt || [])].filter(
    (e) => e != null && e.magnitude != null
  );
  for (const eq of quakes) {
    const magnitude = eq!.magnitude!;
    const level = levelFromEarthquake(magnitude);
    alerts.push({
      id: `bmkg-${eq!.timestamp || `${eq!.location}-${magnitude}`}`,
      type: "earthquake",
      title: `Gempa BMKG M ${magnitude}`,
      description: `${eq!.location || "Lokasi tidak diketahui"}. Kedalaman ${
        eq!.depthKm ?? "-"
      } km. ${eq!.potential || ""}`.trim(),
      level,
      magnitude,
      depth: eq!.depthKm ?? undefined,
      location: eq!.location ?? undefined,
      tsunamiPotential: eq!.potential ?? undefined,
      createdAt: parseTime(eq!.timestamp),
    });
  }

  for (const v of pvmbg.volcanoes || []) {
    if (v.level < 2) continue;
    alerts.push({
      id: `pvmbg-${v.name}`,
      type: "volcano",
      title: `${v.name} - ${v.status}`,
      description: `Status aktivitas vulkanik ${v.name} saat ini ${v.status} (PVMBG). ${ALERT_LEVELS[v.level].recommendation}`,
      level: v.level,
      volcanoStatus: v.status,
      createdAt: parseTime(pvmbg.updatedAt),
    });
  }

  return alerts;
}

export function AlertFeed({ limit = 10 }: { limit?: number }) {
  const [firestoreAlerts, setFirestoreAlerts] = useState<AlertDoc[]>([]);
  const [liveAlerts, setLiveAlerts] = useState<AlertDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  useEffect(() => {
    const unsubscribe = subscribeAlerts((data) => {
      setFirestoreAlerts(data);
      setPage(1);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const data = await fetchLiveAlerts();
        if (!cancelled) setLiveAlerts(data);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    const interval = setInterval(load, 60000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const alerts = useMemo(() => {
    const seen = new Set<string>();
    return [...firestoreAlerts, ...liveAlerts]
      .filter((a) => {
        const key = `${a.type}|${a.title}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
  }, [firestoreAlerts, liveAlerts]);

  const pageSize = limit;
  const totalPages = Math.max(1, Math.ceil(alerts.length / pageSize));
  const paged = alerts.slice((page - 1) * pageSize, page * pageSize);

  const goPrev = () => setPage((p) => Math.max(1, p - 1));
  const goNext = () => setPage((p) => Math.min(totalPages, p + 1));

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
          <Rss className="mx-auto mb-2 h-6 w-6 text-fg-muted" />
          Belum ada alert. Data BMKG/PVMBG akan muncul otomatis saat tersedia.
        </GlassCard>
      )}

      {paged.map((alert) => {
        const level = ALERT_LEVELS[alert.level];
        const Icon = alert.type === "earthquake" ? Activity : Flame;
        const isLive = alert.id.startsWith("bmkg-") || alert.id.startsWith("pvmbg-");
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
                  <h3 className="font-semibold text-fg truncate">
                    {alert.title}
                  </h3>
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
                  <span className="capitalize">
                    {isLive ? `${alert.type} · Live` : alert.type}
                  </span>
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

      {alerts.length > pageSize && (
        <div className="flex items-center justify-between gap-2 pt-2">
          <button
            onClick={goPrev}
            disabled={page === 1}
            type="button"
            className="flex items-center gap-1 rounded-lg bg-accent/10 px-3 py-1.5 text-xs font-medium text-accent disabled:opacity-40"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Sebelumnya
          </button>
          <span className="text-xs text-fg-muted">
            Halaman {page} dari {totalPages}
          </span>
          <button
            onClick={goNext}
            disabled={page === totalPages}
            type="button"
            className="flex items-center gap-1 rounded-lg bg-accent/10 px-3 py-1.5 text-xs font-medium text-accent disabled:opacity-40"
          >
            Selanjutnya <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
