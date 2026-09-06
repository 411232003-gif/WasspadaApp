"use client";

import { Volume2, VolumeX } from "lucide-react";
import { useAlert, ALERT_LEVELS, AlertLevel } from "@/lib/alert-context";

export function AlertControls({ className = "" }: { className?: string }) {
  const { alertLevel, setAlertLevel, audioEnabled, setAudioEnabled } = useAlert();

  return (
    <div className={`rounded-2xl glass-panel p-4 ${className}`}>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-fg">Simulasi Status Alert</h3>
        <button
          onClick={() => setAudioEnabled(!audioEnabled)}
          type="button"
          className={`flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium transition-colors ${
            audioEnabled ? "bg-accent/20 text-accent" : "text-fg-muted hover:text-fg"
          }`}
          title={audioEnabled ? "Matikan nada peringatan" : "Aktifkan nada peringatan"}
        >
          {audioEnabled ? (
            <Volume2 className="h-3.5 w-3.5" />
          ) : (
            <VolumeX className="h-3.5 w-3.5" />
          )}
          {audioEnabled ? "Audio ON" : "Audio OFF"}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {(Object.keys(ALERT_LEVELS) as unknown as AlertLevel[]).map((level) => {
          const config = ALERT_LEVELS[level];
          return (
            <button
              key={level}
              onClick={() => setAlertLevel(level)}
              type="button"
              className={`rounded-xl px-3 py-2.5 text-xs font-bold transition-all ${
                alertLevel === level
                  ? "text-bg shadow-[0_0_16px_var(--glow)]"
                  : "text-fg hover:bg-white/5"
              }`}
              style={{
                backgroundColor: alertLevel === level ? config.color : "transparent",
                borderColor: config.color,
                borderWidth: alertLevel === level ? "0" : "1px",
                borderStyle: "solid",
              }}
            >
              {config.shortLabel}
            </button>
          );
        })}
      </div>

      <p className="mt-3 text-[11px] text-fg-muted">
        Klik level di atas untuk mensimulasikan perubahan status peringatan dan
        memicu nada bahaya (jika audio aktif).
      </p>
    </div>
  );
}
