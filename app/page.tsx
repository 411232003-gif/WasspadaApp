import { GlassCard } from "@/components/glass-card";
import { AlertStatusBar } from "@/components/alert-status-bar";
import { AlertControls } from "@/components/alert-controls";
import { UserProximityWidget } from "@/components/user-proximity-widget";
import { AlertMetric } from "@/components/alert-metric";
import { LiveDataPanel } from "@/components/live-data-panel";
import {
  Activity,
  Flame,
  Radius,
  Waves,
  Wind,
} from "lucide-react";

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
        <GlassCard className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase text-fg-muted">
                Gempa Terkini
              </p>
              <p className="mt-1 text-2xl font-bold text-fg">M 3.2</p>
              <p className="text-xs text-fg-muted">14 km barat laut</p>
            </div>
            <div className="rounded-xl bg-accent/10 p-3 glow-ring">
              <Activity className="h-6 w-6 text-accent" />
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase text-fg-muted">
                Status Gunung Api
              </p>
              <p className="mt-1 text-2xl font-bold text-fg">Normal</p>
              <p className="text-xs text-fg-muted">Tidak ada erupsi</p>
            </div>
            <div className="rounded-xl bg-accent/10 p-3 glow-ring">
              <Flame className="h-6 w-6 text-accent" />
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase text-fg-muted">
                Radius Dampak
              </p>
              <p className="mt-1 text-2xl font-bold text-fg">5 km</p>
              <p className="text-xs text-fg-muted">Estimasi dampak</p>
            </div>
            <div className="rounded-xl bg-accent/10 p-3 glow-ring">
              <Radius className="h-6 w-6 text-accent" />
            </div>
          </div>
        </GlassCard>

        <AlertMetric />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <AlertControls className="lg:col-span-2" />
        <UserProximityWidget />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <GlassCard className="lg:col-span-2 p-5 min-h-[260px] flex flex-col justify-center items-center text-center">
          <Waves className="h-12 w-12 text-accent mb-4" />
          <h3 className="text-lg font-semibold text-fg">
            Peta Dampak & Radius Bencana
          </h3>
          <p className="mt-2 max-w-md text-sm text-fg-muted">
            Integrasi peta interaktif akan ditampilkan di halaman Live Map.
            Radius abu vulkanik dan gempa dapat dikalkulasi dari data BMKG.
          </p>
        </GlassCard>

        <GlassCard className="p-5">
          <div className="mb-4 flex items-center gap-2">
            <Wind className="h-5 w-5 text-accent" />
            <h3 className="text-sm font-semibold text-fg">Awan Abu Vulkanik</h3>
          </div>
          <ul className="space-y-3 text-sm text-fg-muted">
            <li className="flex items-center justify-between">
              <span>Arah angin</span>
              <span className="font-medium text-fg">Barat Daya</span>
            </li>
            <li className="flex items-center justify-between">
              <span>Jarak jangkau</span>
              <span className="font-medium text-fg">±10 km</span>
            </li>
            <li className="flex items-center justify-between">
              <span>Ketebalan</span>
              <span className="font-medium text-fg">Ringan</span>
            </li>
          </ul>
        </GlassCard>
      </div>

      <LiveDataPanel />
    </div>
  );
}
