"use client";

import { MapPin, Navigation, AlertTriangle, ShieldCheck } from "lucide-react";
import { GlassCard } from "@/components/glass-card";
import { useAlert } from "@/lib/alert-context";

export function UserProximityWidget() {
  const {
    userLocation,
    locationError,
    requestUserLocation,
    userDistanceKm,
    userZone,
    isInKrb3,
    isInDangerZone,
    alertConfig,
  } = useAlert();

  const statusText = !userZone
    ? "Belum diketahui"
    : isInKrb3
    ? `Berada di ${userZone} - SEGERA EVAKUASI`
    : `Berada di ${userZone}`;

  const zoneColor = isInKrb3
    ? "#ef4444"
    : userZone === "KRB I"
    ? "#22d3ee"
    : userZone === "KRB II"
    ? "#fb923c"
    : alertConfig.color;

  return (
    <GlassCard
      className={`p-5 ${isInDangerZone ? "animate-pulse" : ""}`}
      style={{
        borderColor: isInDangerZone ? "#ef4444" : undefined,
        boxShadow: isInDangerZone ? "0 0 24px rgba(239, 68, 68, 0.45)" : undefined,
      }}
    >
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Navigation className="h-5 w-5 text-accent" />
          <h3 className="text-sm font-semibold text-fg">
            Jarak Anda dari Gunung
          </h3>
        </div>
        <button
          onClick={requestUserLocation}
          type="button"
          className="flex items-center gap-1.5 rounded-lg bg-accent/10 px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent/20"
        >
          <MapPin className="h-3.5 w-3.5" />
          Cek Lokasi
        </button>
      </div>

      {locationError && (
        <p className="mb-3 rounded-lg bg-red-500/10 p-2.5 text-xs text-red-400">
          {locationError}
        </p>
      )}

      {userLocation && userDistanceKm !== null ? (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            {isInDangerZone ? (
              <AlertTriangle
                className="h-6 w-6 shrink-0"
                style={{ color: zoneColor }}
              />
            ) : (
              <ShieldCheck
                className="h-6 w-6 shrink-0"
                style={{ color: zoneColor }}
              />
            )}
            <div>
              <p className="text-2xl font-bold text-fg">
                {userDistanceKm.toFixed(2)}{" "}
                <span className="text-sm font-medium text-fg-muted">km</span>
              </p>
              <p className="text-sm font-medium" style={{ color: zoneColor }}>
                Status Anda: {statusText}
              </p>
            </div>
          </div>

          <div
            className="rounded-xl border p-3"
            style={{
              borderColor: zoneColor,
              backgroundColor: `${zoneColor}10`,
            }}
          >
            <p className="text-xs leading-relaxed" style={{ color: zoneColor }}>
              {isInKrb3
                ? "PERINGATAN: Anda berada di KRB III. Segera evakuasi menuju titik aman yang ditunjuk!"
                : userZone === "KRB II"
                ? "Anda berada di KRB II. Tetap waspada dan siapkan perlengkapan darurat."
                : userZone === "KRB I"
                ? "Anda berada di KRB I. Waspadai hujan abu dan potensi lahar."
                : "Anda di luar KRB saat ini. Tetap pantau status PVMBG."}
            </p>
          </div>

          <p className="text-[11px] text-fg-muted">
            Koordinat: {userLocation.lat.toFixed(5)},{" "}
            {userLocation.lon.toFixed(5)}
          </p>
        </div>
      ) : (
        <div className="py-4 text-center">
          <p className="text-sm text-fg-muted">
            Tekan &ldquo;Cek Lokasi&rdquo; untuk menghitung jarak Anda dari gunung dan
            mengecek zona KRB.
          </p>
        </div>
      )}
    </GlassCard>
  );
}
