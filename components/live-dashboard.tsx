"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, Flame, Radius, Wind } from "lucide-react";
import { GlassCard } from "@/components/glass-card";
import { AlertMetric } from "@/components/alert-metric";
import { useAlert, ALERT_LEVELS } from "@/lib/alert-context";
import {
  cardinalFrom,
  cardinalTo,
  fetchWind,
  levelFromEarthquake,
  type WindData,
} from "@/lib/live-api";

function formatTime(iso: string | null | undefined) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function DashboardStatCards() {
  const { latestEarthquake, volcanoes, nearestEarthquake, dataUpdatedAt } =
    useAlert();

  const topVolcano = useMemo(
    () =>
      [...volcanoes].sort(
        (a, b) => b.level - a.level || a.name.localeCompare(b.name)
      )[0] || null,
    [volcanoes]
  );

  const impactKm = useMemo(() => {
    const m = nearestEarthquake?.item.magnitude ?? 0;
    if (!m) return null;
    const depth = nearestEarthquake?.item.depthKm ?? 0;
    const depthFactor = Math.max(0.3, 1 - depth / 300);
    const radiusM = Math.min(
      Math.max(Math.round(m * 2500 * depthFactor), 3000),
      35000
    );
    return radiusM / 1000;
  }, [nearestEarthquake]);

  const eqLevel = latestEarthquake
    ? levelFromEarthquake(latestEarthquake.magnitude || 0)
    : 1;
  const eqColor = ALERT_LEVELS[eqLevel].color;
  const volcanoColor = topVolcano
    ? ALERT_LEVELS[topVolcano.level].color
    : ALERT_LEVELS[1].color;

  return (
    <>
      <GlassCard className="p-5">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase text-fg-muted">
              Gempa Terkini
            </p>
            <p className="mt-1 text-2xl font-bold" style={{ color: eqColor }}>
              {latestEarthquake?.magnitude != null
                ? `M ${latestEarthquake.magnitude}`
                : "-"}
            </p>
            <p className="truncate text-xs text-fg-muted">
              {latestEarthquake?.location || "Menunggu data BMKG..."}
            </p>
            <p className="mt-1 text-[10px] text-fg-muted">
              {latestEarthquake
                ? `${latestEarthquake.depthKm ?? "-"} km · ${formatTime(
                    latestEarthquake.timestamp
                  )}`
                : ""}
            </p>
          </div>
          <div className="rounded-xl bg-accent/10 p-3 glow-ring">
            <Activity className="h-6 w-6 text-accent" />
          </div>
        </div>
      </GlassCard>

      <GlassCard className="p-5">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase text-fg-muted">
              Status Gunung Api
            </p>
            <p
              className="mt-1 text-2xl font-bold"
              style={{ color: volcanoColor }}
            >
              {topVolcano
                ? ALERT_LEVELS[topVolcano.level].shortLabel
                : "Memuat..."}
            </p>
            <p className="truncate text-xs text-fg-muted">
              {topVolcano
                ? `${topVolcano.name} · ${topVolcano.status}`
                : "Menunggu data PVMBG..."}
            </p>
            <p className="mt-1 text-[10px] text-fg-muted">
              {volcanoes.length > 0
                ? `${volcanoes.length} gunung api dipantau`
                : ""}
            </p>
          </div>
          <div className="rounded-xl bg-accent/10 p-3 glow-ring">
            <Flame className="h-6 w-6 text-accent" />
          </div>
        </div>
      </GlassCard>

      <GlassCard className="p-5">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase text-fg-muted">
              Radius Dampak
            </p>
            <p className="mt-1 text-2xl font-bold text-fg">
              {impactKm !== null ? `${impactKm.toFixed(1)} km` : "-"}
            </p>
            <p className="truncate text-xs text-fg-muted">
              {nearestEarthquake
                ? `Estimasi dari gempa M ${nearestEarthquake.item.magnitude ?? "-"}`
                : "Belum ada gempa terdekat"}
            </p>
            <p className="mt-1 text-[10px] text-fg-muted">
              {dataUpdatedAt ? `Update ${formatTime(dataUpdatedAt)}` : ""}
            </p>
          </div>
          <div className="rounded-xl bg-accent/10 p-3 glow-ring">
            <Radius className="h-6 w-6 text-accent" />
          </div>
        </div>
      </GlassCard>

      <AlertMetric />
    </>
  );
}

export function AshWindCard() {
  const { disasterCenter, nearestVolcano } = useAlert();
  const [wind, setWind] = useState<WindData | null>(null);
  const centerLat = disasterCenter[0];
  const centerLon = disasterCenter[1];

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      fetchWind(centerLat, centerLon)
        .then((w) => {
          if (!cancelled) setWind(w);
        })
        .catch(() => {});
    };
    load();
    const interval = setInterval(load, 300000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [centerLat, centerLon]);

  return (
    <GlassCard className="p-5">
      <div className="mb-4 flex items-center gap-2">
        <Wind className="h-5 w-5 text-accent" />
        <h3 className="text-sm font-semibold text-fg">Awan Abu Vulkanik</h3>
      </div>
      {wind ? (
        <ul className="space-y-3 text-sm text-fg-muted">
          <li className="flex items-center justify-between gap-2">
            <span>Arah angin</span>
            <span className="font-medium text-fg">
              {cardinalFrom(wind.windDirectionFrom)} ({wind.windDirectionFrom}°)
            </span>
          </li>
          <li className="flex items-center justify-between gap-2">
            <span>Kecepatan</span>
            <span className="font-medium text-fg">{wind.windSpeed} km/jam</span>
          </li>
          <li className="flex items-center justify-between gap-2">
            <span>Sebaran abu ke</span>
            <span className="font-medium text-fg">
              {cardinalTo(wind.windDirectionFrom)}
            </span>
          </li>
          <li className="flex items-center justify-between gap-2">
            <span>Gunung terdekat</span>
            <span className="truncate font-medium text-fg">
              {nearestVolcano
                ? `${nearestVolcano.item.name} (${nearestVolcano.distanceKm.toFixed(1)} km)`
                : "-"}
            </span>
          </li>
        </ul>
      ) : (
        <p className="text-sm text-fg-muted">
          Memuat data angin real-time dari Open-Meteo...
        </p>
      )}
      <p className="mt-3 text-[10px] text-fg-muted">Sumber: Open-Meteo API</p>
    </GlassCard>
  );
}
