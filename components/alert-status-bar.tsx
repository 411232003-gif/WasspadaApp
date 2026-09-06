"use client";

import { AlertTriangle, ShieldCheck } from "lucide-react";
import { useAlert } from "@/lib/alert-context";

export function AlertStatusBar() {
  const { alertConfig, isInKrb3, userZone } = useAlert();
  const isDanger = alertConfig.level === 4;

  return (
    <div
      className={`relative rounded-2xl p-4 sm:p-5 glass-panel theme-transition overflow-hidden ${
        isDanger ? "animate-pulse" : ""
      }`}
      style={{
        borderColor: isDanger ? "#ef4444" : alertConfig.color,
        boxShadow: `0 0 0 1px ${isDanger ? "#ef4444" : alertConfig.color}, 0 0 24px ${
          isDanger ? "rgba(239, 68, 68, 0.55)" : alertConfig.glow
        }`,
      }}
    >
      <div
        className="absolute inset-0 opacity-10"
        style={{ backgroundColor: isDanger ? "#ef4444" : alertConfig.color }}
      />
      <div className="relative flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
            style={{
              backgroundColor: `${isDanger ? "#ef4444" : alertConfig.color}20`,
              boxShadow: `0 0 16px ${
                isDanger ? "rgba(239, 68, 68, 0.55)" : alertConfig.glow
              }`,
            }}
          >
            {isDanger ? (
              <AlertTriangle
                className="h-5 w-5"
                style={{ color: isDanger ? "#ef4444" : alertConfig.color }}
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
                style={{ color: isDanger ? "#ef4444" : alertConfig.color }}
              >
                Status PVMBG
              </span>
              <span
                className="rounded-full px-2 py-0.5 text-xs font-bold"
                style={{
                  backgroundColor: `${isDanger ? "#ef4444" : alertConfig.color}20`,
                  color: isDanger ? "#ef4444" : alertConfig.color,
                }}
              >
                {alertConfig.shortLabel}
              </span>
            </div>
            <h2 className="mt-0.5 text-lg font-bold text-fg">
              {alertConfig.label}
            </h2>
            <p className="max-w-3xl text-sm text-fg-muted">
              {alertConfig.recommendation}
            </p>

            {(alertConfig.evacuationCue || isInKrb3) && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {alertConfig.evacuationCue && (
                  <span className="rounded-lg bg-red-500/10 px-2.5 py-1 text-xs font-bold text-red-400">
                    {alertConfig.evacuationCue}
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
