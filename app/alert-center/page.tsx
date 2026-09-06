import { AlertStatusBar } from "@/components/alert-status-bar";
import { UserProximityWidget } from "@/components/user-proximity-widget";
import { AlertFeed } from "@/components/alert-feed";
import { Bell } from "lucide-react";

export const metadata = {
  title: "Alert Center | WasspadaApp",
};

export default function AlertCenterPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-fg">Alert Center</h2>
          <p className="text-sm text-fg-muted">
            Riwayat dan status peringatan bencana untuk pengguna.
          </p>
        </div>
        <Bell className="h-5 w-5 text-fg-muted" />
      </div>

      <AlertStatusBar />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <h3 className="mb-3 text-sm font-semibold text-fg">Live Alert Feed</h3>
          <AlertFeed limit={15} />
        </div>

        <UserProximityWidget />
      </div>
    </div>
  );
}
