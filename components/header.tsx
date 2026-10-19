import { ShieldAlert } from "lucide-react";
import { LocationPicker } from "@/components/location-picker";
import { GlobalSearch } from "@/components/global-search";
import { ThemeSwitcher } from "@/components/theme-switcher";

export function Header() {
  return (
    <header className="sticky top-0 z-40 glass-panel theme-transition">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-2 px-3 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/10 glow-ring">
            <ShieldAlert className="h-5 w-5 text-accent" />
          </div>
          <div className="flex min-w-0 flex-col">
            <h1 className="truncate text-base font-bold leading-tight text-fg glow-text sm:text-lg">
              WasspadaApp
            </h1>
            <span className="hidden text-[10px] uppercase tracking-wider text-fg-muted min-[420px]:block">
              Pemantau Bencana Sekitarmu
            </span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <GlobalSearch />
          <LocationPicker />
          <ThemeSwitcher />
        </div>
      </div>
    </header>
  );
}
