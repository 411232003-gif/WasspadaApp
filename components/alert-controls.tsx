"use client";

import { Volume2, VolumeX, Siren, Radio } from "lucide-react";
import { useAlert, playEmergencySiren } from "@/lib/alert-context";

export function AlertControls({ className = "" }: { className?: string }) {
  const { alertConfig, audioEnabled, setAudioEnabled, isInDangerZone } =
    useAlert();

  return (
    <div className={`rounded-2xl glass-panel p-4 ${className}`}>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Radio className="h-4 w-4 text-accent" />
          <h3 className="text-sm font-semibold text-fg">Sirene Peringatan</h3>
        </div>
        <button
          onClick={() => setAudioEnabled(!audioEnabled)}
          type="button"
          className={`flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium transition-colors ${
            audioEnabled
              ? "bg-accent/20 text-accent"
              : "text-fg-muted hover:text-fg"
          }`}
          title={
            audioEnabled
              ? "Matikan nada peringatan"
              : "Aktifkan nada peringatan"
          }
        >
          {audioEnabled ? (
            <Volume2 className="h-3.5 w-3.5" />
          ) : (
            <VolumeX className="h-3.5 w-3.5" />
          )}
          {audioEnabled ? "Audio ON" : "Audio OFF"}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div
          className="flex items-center gap-2 rounded-xl px-3 py-2.5"
          style={{
            backgroundColor: `${alertConfig.color}15`,
            border: `1px solid ${alertConfig.color}`,
            boxShadow: `0 0 14px ${alertConfig.glow}`,
          }}
        >
          <span
            className="h-2.5 w-2.5 rounded-full animate-pulse"
            style={{ backgroundColor: alertConfig.color }}
          />
          <span
            className="text-xs font-bold"
            style={{ color: alertConfig.color }}
          >
            {alertConfig.label}
          </span>
        </div>

        <button
          onClick={playEmergencySiren}
          type="button"
          className="flex items-center gap-1.5 rounded-xl bg-red-500/10 px-3 py-2.5 text-xs font-bold text-red-400 hover:bg-red-500/20"
        >
          <Siren className="h-4 w-4" />
          Tes Sirene
        </button>
      </div>

      <p className="mt-3 text-[11px] text-fg-muted">
        Status di atas dihitung otomatis dari data BMKG & PVMBG real-time.
        Sirene berbunyi otomatis saat status Awas atau lokasi Anda masuk zona
        bahaya{isInDangerZone ? " (aktif sekarang)" : ""}.
      </p>
    </div>
  );
}
