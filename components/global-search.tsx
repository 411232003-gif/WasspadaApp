"use client";

import { useEffect, useRef, useState } from "react";
import { Search, Flame, X } from "lucide-react";
import { fetchVolcanoes, Volcano } from "@/lib/live-api";
import { ALERT_LEVELS } from "@/lib/alert-context";

export function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [volcanoes, setVolcanoes] = useState<Volcano[]>([]);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Volcano | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchVolcanoes().then((res) => {
      setVolcanoes(res.error ? [] : res.volcanoes || []);
    });
  }, []);

  const filtered = query.trim()
    ? (volcanoes || []).filter((v) =>
        v.name.toLowerCase().includes(query.toLowerCase())
      )
    : [];

  const selectVolcano = (v: Volcano) => {
    setSelected(v);
    setQuery(v.name);
    setOpen(false);
  };

  return (
    <div className="relative z-50 hidden sm:block">
      <div className="flex items-center gap-2 rounded-xl glass-panel px-3 py-2 min-w-[200px] max-w-[280px]">
        <Search className="h-4 w-4 text-fg-muted" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(e.target.value.trim().length > 0);
            setSelected(null);
          }}
          onFocus={() => query.trim() && setOpen(true)}
          placeholder="Cari Gunung Api..."
          className="w-full bg-transparent text-sm text-fg placeholder:text-fg-muted outline-none"
        />
        {(query || selected) && (
          <button
            onClick={() => {
              setQuery("");
              setSelected(null);
              setOpen(false);
              inputRef.current?.focus();
            }}
            type="button"
          >
            <X className="h-3.5 w-3.5 text-fg-muted hover:text-fg" />
          </button>
        )}
      </div>

      {open && filtered.length > 0 && (
        <div className="absolute top-full left-0 mt-2 w-full max-h-72 overflow-auto rounded-xl glass-panel p-2">
          {filtered.slice(0, 8).map((v) => {
            const level = ALERT_LEVELS[v.level];
            return (
              <button
                key={v.name}
                onClick={() => selectVolcano(v)}
                type="button"
                className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm text-fg hover:bg-white/5"
              >
                <span className="flex items-center gap-2 truncate">
                  <Flame className="h-3.5 w-3.5" style={{ color: level.color }} />
                  <span className="truncate">{v.name}</span>
                </span>
                <span
                  className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold"
                  style={{
                    backgroundColor: `${level.color}20`,
                    color: level.color,
                  }}
                >
                  {v.status}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {open && query.trim() && filtered.length === 0 && (
        <div className="absolute top-full left-0 mt-2 w-full rounded-xl glass-panel p-3 text-xs text-fg-muted">
          Tidak ada hasil untuk &quot;{query}&quot;.
        </div>
      )}

      {selected && (
        <div className="absolute top-full left-0 mt-2 w-full rounded-xl glass-panel p-3 text-xs">
          <p className="font-semibold text-fg">{selected.name}</p>
          <p className="text-fg-muted" style={{ color: ALERT_LEVELS[selected.level].color }}>
            {selected.status} - {selected.region}
          </p>
        </div>
      )}
    </div>
  );
}
