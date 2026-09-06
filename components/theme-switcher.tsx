"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/lib/theme-provider";

export function ThemeSwitcher() {
  const { theme, toggleTheme } = useTheme();

  const isMaroon = theme === "maroon";

  return (
    <button
      onClick={toggleTheme}
      type="button"
      aria-label={`Beralih ke mode ${isMaroon ? "gelap" : "merah marun emas"}`}
      className="flex items-center gap-2 rounded-full px-3 py-2 glass-panel theme-transition hover:scale-105 active:scale-95"
    >
      {isMaroon ? (
        <Sun className="h-4 w-4 text-accent" />
      ) : (
        <Moon className="h-4 w-4 text-accent" />
      )}
      <span className="hidden text-sm font-medium text-fg sm:inline">
        {isMaroon ? "Gold Mode" : "Dark Mode"}
      </span>
    </button>
  );
}
