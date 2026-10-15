import { ShieldAlert } from "lucide-react";
import { LocationPicker } from "@/components/location-picker";
import { GlobalSearch } from "@/components/global-search";
import { ThemeSwitcher } from "@/components/theme-switcher";

export function Header() {
  return (
    <header className="sticky top-0 z-40 glass-panel theme-transition">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/10 glow-ring">
            <ShieldAlert className="h-5 w-5 text-accent" />
          </div>
          <div className="flex flex-col">
            <h1 className="text-lg font-bold leading-tight text-fg glow-text">
              WasspadaApp
            </h1>
            <span className="text-[10px] uppercase tracking-wider text-fg-muted">
              Pemantau Bencana Sekitarmu
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <GlobalSearch />
          <LocationPicker />
          <ThemeSwitcher />
        </div>
      </div>
    </header>
  );
}
