"use client";

import { AlertTriangle, ShieldCheck, MapPin } from "lucide-react";
import { useAlert } from "@/lib/alert-context";

export function AlertStatusBar() {
  const {
    alertConfig,
    selectedKelurahan,
    nearestVolcano,
    kelurahanZone,
    kelurahanInDanger,
    isInKrb3,
    userZone,
  } = useAlert();
  const isHazard = alertConfig.level === 4 || kelurahanInDanger;

  return (
    <div
      className={`relative rounded-2xl p-4 sm:p-5 glass-panel theme-transition overflow-hidden ${
        isHazard ? "animate-pulse" : ""
      }`}
      style={{
        borderColor: isHazard ? "#ef4444" : alertConfig.color,
        boxShadow: `0 0 0 1px ${isHazard ? "#ef4444" : alertConfig.color}, 0 0 24px ${
          isHazard ? "rgba(239, 68, 68, 0.55)" : alertConfig.glow
        }`,
      }}
    >
      <div
        className="absolute inset-0 opacity-10"
        style={{ backgroundColor: isHazard ? "#ef4444" : alertConfig.color }}
      />
      <div className="relative flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
            style={{
              backgroundColor: `${isHazard ? "#ef4444" : alertConfig.color}20`,
              boxShadow: `0 0 16px ${
                isHazard ? "rgba(239, 68, 68, 0.55)" : alertConfig.glow
              }`,
            }}
          >
            {isHazard ? (
              <AlertTriangle
                className="h-5 w-5"
                style={{ color: isHazard ? "#ef4444" : alertConfig.color }}
              />
            ) : (
              <ShieldCheck
                className="h-5 w-5"
                style={{ color: alertConfig.color }}
              />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className="text-xs font-bold uppercase tracking-wider"
                style={{ color: isHazard ? "#ef4444" : alertConfig.color }}
              >
                Status PVMBG
              </span>
              <span
                className="rounded-full px-2 py-0.5 text-xs font-bold"
                style={{
                  backgroundColor: `${
                    isHazard ? "#ef4444" : alertConfig.color
                  }20`,
                  color: isHazard ? "#ef4444" : alertConfig.color,
                }}
              >
                {alertConfig.shortLabel}
              </span>
            </div>

            {selectedKelurahan ? (
              <div className="mt-0.5 flex items-center gap-1.5 text-sm text-fg">
                <MapPin className="h-3.5 w-3.5 text-fg-muted" />
                <span className="font-semibold">{selectedKelurahan.name_local}</span>
                <span className="text-fg-muted">•</span>
                <span className="text-fg-muted">
                  {selectedKelurahan.lat.toFixed(4)}, {selectedKelurahan.lon.toFixed(4)}
                </span>
              </div>
            ) : null}

            <h2 className="mt-0.5 text-lg font-bold text-fg">
              {alertConfig.label}
            </h2>
            <p className="max-w-3xl text-sm text-fg-muted">
              {alertConfig.recommendation}
            </p>

            {nearestVolcano && (
              <p className="mt-1 text-xs text-fg-muted">
                Gunung api terdekat: {" "}
                <span className="font-semibold text-fg">{nearestVolcano.item.name}</span>
                {" "}({nearestVolcano.distanceKm.toFixed(1)} km) -{" "}
                <span style={{ color: alertConfig.color }}>
                  {kelurahanZone || "-"}
                </span>
              </p>
            )}

            {(alertConfig.evacuationCue || kelurahanInDanger || isInKrb3) && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {alertConfig.evacuationCue && (
                  <span className="rounded-lg bg-red-500/10 px-2.5 py-1 text-xs font-bold text-red-400">
                    {alertConfig.evacuationCue}
                  </span>
                )}
                {kelurahanInDanger && (
                  <span className="rounded-lg bg-red-500/10 px-2.5 py-1 text-xs font-bold text-red-400">
                    {selectedKelurahan?.name_local} di {kelurahanZone} - SEGERA EVAKUASI
                  </span>
                )}
                {isInKrb3 && (
                  <span className="rounded-lg bg-red-500/10 px-2.5 py-1 text-xs font-bold text-red-400">
                    Anda di {userZone} - SEGERA EVAKUASI
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
