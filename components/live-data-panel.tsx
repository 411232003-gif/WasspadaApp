"use client";

import { useEffect, useState } from "react";
import {
  Activity,
  Flame,
  RefreshCw,
  Database,
  AlertTriangle,
  MapPin,
} from "lucide-react";
import { GlassCard } from "@/components/glass-card";
import {
  fetchBMKG,
  fetchPVMBG,
  findTargetVolcano,
  levelFromEarthquake,
  BmkgResponse,
  PvmbgResponse,
} from "@/lib/live-api";
import { pushAlert } from "@/lib/firestore";
import { ALERT_LEVELS } from "@/lib/alert-context";

const TARGET_VOLCANO = process.env.NEXT_PUBLIC_TARGET_VOLCANO || "Merapi";

function formatTime(iso: string | null) {
  if (!iso) return "-";
  const d = new Date(iso);
  return d.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function LiveDataPanel() {
  const [bmkg, setBmkg] = useState<BmkgResponse | null>(null);
  const [pvmbg, setPvmbg] = useState<PvmbgResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [logStatus, setLogStatus] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [b, p] = await Promise.all([fetchBMKG(), fetchPVMBG()]);
      setBmkg(b);
      setPvmbg(p);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
  }, []);

  const target = pvmbg
    ? findTargetVolcano(pvmbg.volcanoes, TARGET_VOLCANO)
    : null;
  const targetConfig = target ? ALERT_LEVELS[target.level] : null;

  const logEarthquake = async () => {
    if (!bmkg?.latest) return;
    const eq = bmkg.latest;
    const magnitude = eq.magnitude;
    if (magnitude === null) return;
    const level = levelFromEarthquake(magnitude);
    await pushAlert({
      type: "earthquake",
      title: `Gempa BMKG M ${magnitude}`,
      description: eq.location || "Gempa terkini",
      level,
      magnitude,
      depth: eq.depthKm ?? undefined,
      location: eq.location ?? undefined,
      tsunamiPotential: eq.potential ?? undefined,
    });
    setLogStatus("Gempa tercatat di Firestore");
    setTimeout(() => setLogStatus(null), 3000);
  };

  const logVolcano = async () => {
    if (!target) return;
    await pushAlert({
      type: "volcano",
      title: `${target.name} - ${target.status}`,
      description: `Status PVMBG gunung ${target.name} saat ini ${target.status}.`,
      level: target.level,
      volcanoStatus: target.status,
    });
    setLogStatus("Status gunung tercatat di Firestore");
    setTimeout(() => setLogStatus(null), 3000);
  };

  return (
    <GlassCard className="p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-accent" />
          <h3 className="text-sm font-semibold text-fg">Data BMKG & PVMBG Live</h3>
        </div>
        <div className="flex items-center gap-2">
          {logStatus && (
            <span className="text-xs text-fg-muted">{logStatus}</span>
          )}
          <button
            onClick={load}
            disabled={loading}
            type="button"
            className="flex items-center gap-1.5 rounded-lg bg-accent/10 px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent/20 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          <h4 className="flex items-center gap-1.5 text-xs font-bold uppercase text-fg-muted">
            <MapPin className="h-3.5 w-3.5" /> Gempa Terkini (BMKG)
          </h4>
          {bmkg?.latest ? (
            <div className="rounded-xl border border-card-border bg-white/5 p-4">
              <div className="flex items-center justify-between">
                <p className="text-2xl font-bold text-fg">
                  M {bmkg.latest.magnitude ?? "-"}
                </p>
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                  style={{
                    backgroundColor: `${
                      ALERT_LEVELS[
                        levelFromEarthquake(bmkg.latest.magnitude || 0)
                      ].color
                    }20`,
                    color: ALERT_LEVELS[
                      levelFromEarthquake(bmkg.latest.magnitude || 0)
                    ].color,
                  }}
                >
                  {
                    ALERT_LEVELS[levelFromEarthquake(bmkg.latest.magnitude || 0)]
                      .shortLabel
                  }
                </span>
              </div>
              <p className="mt-1 text-sm text-fg-muted">
                {bmkg.latest.location || "Lokasi tidak tersedia"}
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-fg-muted">
                <span>Kedalaman: {bmkg.latest.depthKm ?? "-"} km</span>
                <span>
                  Koordinat: {" "}
                  {bmkg.latest.coordinates
                    ? `${bmkg.latest.coordinates[0].toFixed(2)}, ${bmkg.latest.coordinates[1].toFixed(2)}`
                    : "-"}
                </span>
              </div>
              <p className="mt-2 text-xs text-fg-muted">
                Dirasakan: {bmkg.latest.felt || "-"}
              </p>
              <p className="text-[10px] text-fg-muted">
                {formatTime(bmkg.latest.timestamp)}
              </p>
              <button
                onClick={logEarthquake}
                type="button"
                className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg bg-accent/10 py-1.5 text-xs font-medium text-accent hover:bg-accent/20"
              >
                <Database className="h-3.5 w-3.5" /> Log ke Firestore
              </button>
            </div>
          ) : (
            <p className="text-sm text-fg-muted">Data gempa belum tersedia.</p>
          )}
        </div>

        <div className="space-y-3">
          <h4 className="flex items-center gap-1.5 text-xs font-bold uppercase text-fg-muted">
            <Flame className="h-3.5 w-3.5" /> Status Gunung ({TARGET_VOLCANO})
          </h4>
          {target ? (
            <div
              className="rounded-xl border p-4"
              style={{
                borderColor: targetConfig?.color,
                backgroundColor: `${targetConfig?.color}10`,
              }}
            >
              <div className="flex items-center justify-between">
                <p className="text-lg font-bold text-fg">{target.name}</p>
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                  style={{
                    backgroundColor: `${targetConfig?.color}20`,
                    color: targetConfig?.color,
                  }}
                >
                  {target.status}
                </span>
              </div>
              <p className="mt-1 text-sm text-fg-muted">
                {targetConfig?.recommendation}
              </p>
              {targetConfig?.evacuationCue && (
                <p className="mt-2 flex items-center gap-1 text-xs font-bold text-red-400">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {targetConfig.evacuationCue}
                </p>
              )}
              <button
                onClick={logVolcano}
                type="button"
                className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg bg-accent/10 py-1.5 text-xs font-medium text-accent hover:bg-accent/20"
              >
                <Database className="h-3.5 w-3.5" /> Log ke Firestore
              </button>
            </div>
          ) : (
            <p className="text-sm text-fg-muted">
              {pvmbg?.error
                ? `Gagal memuat PVMBG: ${pvmbg.error}`
                : `Data ${TARGET_VOLCANO} tidak ditemukan.`}
            </p>
          )}
        </div>
      </div>
    </GlassCard>
  );
}
