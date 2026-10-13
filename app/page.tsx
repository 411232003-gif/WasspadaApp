import Link from "next/link";
import { GlassCard } from "@/components/glass-card";
import { AlertStatusBar } from "@/components/alert-status-bar";
import { AlertControls } from "@/components/alert-controls";
import { UserProximityWidget } from "@/components/user-proximity-widget";
import { LiveDataPanel } from "@/components/live-data-panel";
import { DashboardStatCards, AshWindCard } from "@/components/live-dashboard";
import { Map } from "lucide-react";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-fg">Dashboard</h2>
          <p className="text-sm text-fg-muted">
            Pantau kondisi bencana di kelurahan target secara real-time.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold text-accent glow-ring">
            <span className="mr-2 h-2 w-2 rounded-full bg-accent animate-pulse" />
            BMKG Online
          </span>
        </div>
      </div>

      <AlertStatusBar />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <DashboardStatCards />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <AlertControls className="lg:col-span-2" />
        <UserProximityWidget />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <GlassCard className="lg:col-span-2 p-5 min-h-[260px] flex flex-col justify-center items-center text-center">
          <Map className="h-12 w-12 text-accent mb-4" />
          <h3 className="text-lg font-semibold text-fg">
            Peta Dampak & Radius Bencana
          </h3>
          <p className="mt-2 max-w-md text-sm text-fg-muted">
            Lihat sebaran abu vulkanik, radius gempa, dan jalur evakuasi dari
            data BMKG, PVMBG, dan Open-Meteo secara real-time di Live Map.
          </p>
          <Link
            href="/live-map"
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-accent/10 px-4 py-2 text-sm font-semibold text-accent hover:bg-accent/20"
          >
            <Map className="h-4 w-4" />
            Buka Live Map
          </Link>
        </GlassCard>

        <AshWindCard />
      </div>

      <LiveDataPanel />
    </div>
  );
}
