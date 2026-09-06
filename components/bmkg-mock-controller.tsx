"use client";

import { useEffect, useState } from "react";
import { Play, Square, Plus, Radio } from "lucide-react";
import { GlassCard } from "@/components/glass-card";
import { pushRandomAlert } from "@/lib/bmkg-mock";
import { getFirebaseStatus } from "@/lib/firestore";

export function BmkgMockController() {
  const [isRunning, setIsRunning] = useState(false);
  const [count, setCount] = useState(0);
  const [mode, setMode] = useState<"firestore" | "mock">("mock");

  useEffect(() => {
    setMode(getFirebaseStatus().mode);
  }, []);

  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(async () => {
      await pushRandomAlert();
      setCount((c) => c + 1);
    }, 6000);
    return () => clearInterval(interval);
  }, [isRunning]);

  const handleManual = async () => {
    await pushRandomAlert();
    setCount((c) => c + 1);
  };

  return (
    <GlassCard className="p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Radio className="h-5 w-5 text-accent" />
          <h3 className="text-sm font-semibold text-fg">Mock BMKG Feed</h3>
        </div>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
            mode === "firestore"
              ? "bg-green-500/20 text-green-400"
              : "bg-yellow-500/20 text-yellow-400"
          }`}
        >
          {mode === "firestore" ? "Firestore" : "Mock Local"}
        </span>
      </div>

      <p className="mb-4 text-xs text-fg-muted">
        Menghasilkan data bencana simulasi (gempa & gunung api) setiap 6 detik.
        Jika Firebase dikonfigurasi, data akan disimpan ke Firestore.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={handleManual}
          type="button"
          className="flex items-center gap-1.5 rounded-lg bg-accent/10 px-3 py-2 text-xs font-medium text-accent hover:bg-accent/20"
        >
          <Plus className="h-3.5 w-3.5" />
          Generate 1
        </button>
        <button
          onClick={() => setIsRunning(!isRunning)}
          type="button"
          className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
            isRunning
              ? "bg-red-500/10 text-red-400 hover:bg-red-500/20"
              : "bg-accent/10 text-accent hover:bg-accent/20"
          }`}
        >
          {isRunning ? (
            <>
              <Square className="h-3.5 w-3.5" /> Stop Auto
            </>
          ) : (
            <>
              <Play className="h-3.5 w-3.5" /> Start Auto
            </>
          )}
        </button>
        <span className="ml-auto text-xs text-fg-muted">
          Generated: <span className="font-semibold text-fg">{count}</span>
        </span>
      </div>
    </GlassCard>
  );
}
