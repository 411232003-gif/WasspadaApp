"use client";

import { useTheme } from "@/lib/theme-provider";

export function ThemeSwitcher() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <span className="t3d" title={isDark ? "Mode gelap aktif" : "Mode terang aktif"}>
      <label className="t3d-switch" aria-label="Ganti tema gelap/terang">
        <input
          type="checkbox"
          checked={isDark}
          onChange={toggleTheme}
          aria-checked={isDark}
        />
        <span className="t3d-btn">
          <span className="t3d-light" />
          <span className="t3d-dots" />
          <span className="t3d-chars" />
          <span className="t3d-shine" />
          <span className="t3d-shadow" />
        </span>
      </label>
    </span>
  );
}
