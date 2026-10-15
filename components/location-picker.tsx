"use client";

import { useEffect, useRef, useState } from "react";
import {
  MapPin,
  ChevronDown,
  Crosshair,
  Search,
  Navigation,
  Loader2,
} from "lucide-react";
import { GlassCard } from "@/components/glass-card";
import { RegionEntity } from "@/lib/live-api";
import { useAlert } from "@/lib/alert-context";
import { addBookmark } from "@/lib/firestore";

type NominatimResult = {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
};

function shortName(displayName: string) {
  const parts = displayName.split(",");
  return {
    name: parts[0].trim(),
    parent: parts.slice(1).join(",").trim() || undefined,
  };
}

export function LocationPicker() {
  const { selectedKelurahan, setSelectedKelurahan } = useAlert();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const displayName = selectedKelurahan?.name_local || "Pilih Lokasi";

  /* tutup panel saat klik di luar */
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  /* cari lokasi di seluruh dunia (debounce 450ms) */
  useEffect(() => {
    const q = query.trim();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.length < 3) return;
    debounceRef.current = setTimeout(async () => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setSearching(true);
      setSearchError(null);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&accept-language=id&q=${encodeURIComponent(q)}`,
          { signal: ctrl.signal }
        );
        if (!res.ok) throw new Error("search failed");
        setResults(await res.json());
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          setSearchError("Pencarian lokasi gagal. Coba lagi.");
        }
      } finally {
        setSearching(false);
      }
    }, 450);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const pick = (entity: RegionEntity) => {
    setSelectedKelurahan(entity);
    addBookmark({
      name: entity.name_local,
      lat: entity.lat,
      lon: entity.lon,
      note: entity.parent_name_local || "",
    }).catch(() => {});
    setOpen(false);
    setQuery("");
    setResults([]);
  };

  const pickResult = (r: NominatimResult) => {
    const { name, parent } = shortName(r.display_name);
    pick({
      id: `place-${r.place_id}`,
      name_local: name,
      name_en: name,
      slug: `place-${r.place_id}`,
      lat: parseFloat(r.lat),
      lon: parseFloat(r.lon),
      parent_name_local: parent,
    });
  };

  const useMyLocation = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLocationError("Geolokasi tidak didukung di perangkat ini.");
      return;
    }
    setLocating(true);
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        /* cari nama tempat terdekat dari koordinat GPS */
        let name = "Lokasi Saya";
        let parent: string | undefined;
        try {
          const r = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&accept-language=id&lat=${pos.coords.latitude}&lon=${pos.coords.longitude}`
          );
          if (r.ok) {
            const d = await r.json();
            if (d?.display_name) {
              const s = shortName(d.display_name);
              name = s.name;
              parent = s.parent;
            }
          }
        } catch {
          /* nama cadangan tetap dipakai */
        }
        pick({
          id: `my-location-${Date.now()}`,
          name_local: name,
          name_en: name,
          slug: "my-location",
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          parent_name_local: parent,
        });
        setLocating(false);
      },
      () => {
        setLocating(false);
        setLocationError(
          "Gagal mengambil lokasi. Aktifkan izin lokasi lalu coba lagi."
        );
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  return (
    <div className="relative z-50" ref={wrapRef}>
      <button
        onClick={() => setOpen((prev) => !prev)}
        type="button"
        className="flex items-center gap-2 rounded-xl px-2.5 py-2 glass-panel theme-transition min-w-0 max-w-[132px] sm:min-w-[180px] sm:max-w-[260px]"
      >
        <MapPin className="h-4 w-4 shrink-0 text-accent" />
        <span className="flex-1 truncate text-left text-sm font-medium text-fg">
          {displayName}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-fg-muted transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <GlassCard className="absolute top-full right-0 mt-2 w-[300px] max-w-[calc(100vw-2rem)] p-4 space-y-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-fg-muted">
            Pilih Lokasi Pantauan
          </p>

          {/* lokasi GPS saat ini */}
          <button
            onClick={useMyLocation}
            disabled={locating}
            type="button"
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent/10 px-3 py-2 text-sm font-medium text-accent hover:bg-accent/20 disabled:opacity-60"
          >
            <Crosshair
              className={`h-4 w-4 ${locating ? "animate-spin" : ""}`}
            />
            {locating ? "Mencari posisi kamu..." : "Lokasi Saya Saat Ini"}
          </button>
          {locationError && (
            <p className="text-center text-xs text-red-400">{locationError}</p>
          )}

          <div className="border-t border-card-border pt-3 space-y-2">
            {/* cari lokasi mana pun di dunia */}
            <div className="flex items-center gap-2 rounded-lg border border-card-border bg-card/50 px-3 py-2">
              <Search className="h-4 w-4 shrink-0 text-fg-muted" />
              <input
                value={query}
                onChange={(e) => {
                  const v = e.target.value;
                  setQuery(v);
                  if (v.trim().length < 3) {
                    setResults([]);
                    setSearching(false);
                  }
                }}
                placeholder="Cari kota, daerah, atau tempat..."
                className="w-full bg-transparent text-sm text-fg placeholder:text-fg-muted outline-none"
              />
              {searching && (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-fg-muted" />
              )}
            </div>

            {searchError && (
              <p className="text-center text-xs text-red-400">{searchError}</p>
            )}

            {results.length > 0 && (
              <ul className="max-h-56 space-y-1 overflow-y-auto [scrollbar-width:thin]">
                {results.map((r) => {
                  const s = shortName(r.display_name);
                  return (
                    <li key={r.place_id}>
                      <button
                        type="button"
                        onClick={() => pickResult(r)}
                        className="flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left hover:bg-white/5"
                      >
                        <Navigation className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-fg">
                            {s.name}
                          </span>
                          {s.parent && (
                            <span className="block truncate text-[11px] text-fg-muted">
                              {s.parent}
                            </span>
                          )}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            {query.trim().length >= 3 &&
              !searching &&
              results.length === 0 &&
              !searchError && (
                <p className="text-center text-xs text-fg-muted">
                  Lokasi tidak ditemukan. Coba kata kunci lain.
                </p>
              )}
          </div>

          {selectedKelurahan && (
            <p className="border-t border-card-border pt-2 text-[10px] text-fg-muted">
              Sedang dipantau: {selectedKelurahan.name_local} (
              {selectedKelurahan.lat.toFixed(3)},{" "}
              {selectedKelurahan.lon.toFixed(3)})
            </p>
          )}
        </GlassCard>
      )}
    </div>
  );
}
