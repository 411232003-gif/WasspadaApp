"use client";

import "leaflet/dist/leaflet.css";
import "react-leaflet-cluster/dist/assets/MarkerCluster.css";
import "react-leaflet-cluster/dist/assets/MarkerCluster.Default.css";
import { useEffect, useMemo, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polygon,
  Circle,
  Polyline,
  useMap,
} from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import L from "leaflet";
import { useTheme } from "@/lib/theme-provider";
import { useAlert } from "@/lib/alert-context";
import { ALERT_LEVELS } from "@/lib/alert-context";
import { fetchVolcanoes, fetchBMKG, Volcano, Earthquake, levelFromEarthquake } from "@/lib/live-api";
import { Wind, Layers, Navigation, Info, MapPin, X, SlidersHorizontal, Satellite } from "lucide-react";

type Direction = "N" | "S" | "E" | "W";
type TileProvider = "osm" | "carto-voyager" | "esri-street" | "carto-dark" | "carto-light" | "custom";

const DIRECTION_DEGREES: Record<Direction, number> = {
  N: 0,
  E: 90,
  S: 180,
  W: 270,
};

const DIRECTIONS: Direction[] = ["N", "S", "E", "W"];

function getDotIcon(color: string) {
  return L.divIcon({
    className: "bg-transparent",
    html: `<div style="width:12px;height:12px;border-radius:50%;background:${color};box-shadow:0 0 10px ${color};border:2px solid rgba(255,255,255,0.4);"></div>`,
    iconSize: [12, 12],
    iconAnchor: [6, 6],
  });
}

function getKelurahanIcon() {
  return L.divIcon({
    className: "bg-transparent",
    html: `<div style="width:18px;height:18px;border-radius:50%;background:#facc15;box-shadow:0 0 14px #facc15;border:3px solid #fff;"></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

function computeAshPolygon(
  center: [number, number],
  direction: number,
  radius: number,
  spread = 30,
  steps = 6
): [number, number][] {
  const points: [number, number][] = [center];
  const start = -spread;
  const end = spread;
  const step = (end - start) / steps;

  for (let i = 0; i <= steps; i++) {
    const angle = direction + start + i * step;
    const rad = ((90 - angle) * Math.PI) / 180;
    const lat = center[0] + radius * Math.sin(rad);
    const lon = center[1] + radius * Math.cos(rad);
    points.push([lat, lon]);
  }

  points.push(center);
  return points;
}

function MapCenter({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [map, center, zoom]);
  return null;
}

export default function MapClient() {
  const { theme } = useTheme();
  const { disasterCenter, selectedKelurahan, nearestVolcano, nearestEarthquake } = useAlert();
  const [direction, setDirection] = useState<Direction>("N");
  const [windSpeed, setWindSpeed] = useState(40);
  const [ashIntensity, setAshIntensity] = useState(40);
  const [layers, setLayers] = useState({
    ash: true,
    earthquake: true,
    evacuation: true,
    volcanoes: true,
    kelurahan: true,
  });

  const [volcanoes, setVolcanoes] = useState<Volcano[]>([]);
  const [earthquakes, setEarthquakes] = useState<Earthquake[]>([]);
  const [loading, setLoading] = useState(true);
  const [panelOpen, setPanelOpen] = useState(true);
  const [tileProvider, setTileProvider] = useState<TileProvider>(() => {
    const env = process.env.NEXT_PUBLIC_DEFAULT_TILE_PROVIDER as TileProvider;
    const allowed: TileProvider[] = ["osm", "carto-voyager", "esri-street", "carto-dark", "carto-light", "custom"];
    return allowed.includes(env) ? env : "carto-voyager";
  });
  const [cartoApiKey, setCartoApiKey] = useState<string>("");

  useEffect(() => {
    async function load() {
      try {
        const [vRes, bRes] = await Promise.all([fetchVolcanoes(), fetchBMKG()]);
        setVolcanoes((vRes.error ? [] : vRes.volcanoes) || []);
        const eqs = bRes.error
          ? []
          : [bRes.latest, ...(bRes.felt || [])].filter(
              (e): e is Earthquake => e != null && e.coordinates != null
            );
        setEarthquakes(eqs || []);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = localStorage.getItem("wasspada-carto-key");
      if (saved) setCartoApiKey(saved);
    } catch {
      // ignore
    }
  }, []);

  const mapCenter = useMemo<[number, number]>(
    () => [disasterCenter[0], disasterCenter[1]],
    [disasterCenter[0], disasterCenter[1]]
  );
  const zoom = useMemo(() => (selectedKelurahan ? 13 : 5), [selectedKelurahan]);

  const volcanoCoords: [number, number] =
    nearestVolcano && nearestVolcano.item.lat != null && nearestVolcano.item.lon != null
      ? [nearestVolcano.item.lat, nearestVolcano.item.lon]
      : mapCenter;

  const epicenterCoords: [number, number] =
    nearestEarthquake && nearestEarthquake.item.coordinates
      ? nearestEarthquake.item.coordinates
      : [mapCenter[0] + 0.01, mapCenter[1] + 0.01];

  const safeZoneCoords: [number, number] = [mapCenter[0] + 0.05, mapCenter[1] + 0.05];

  const tileConfig = useMemo(() => {
    const key = cartoApiKey || process.env.NEXT_PUBLIC_CARTO_API_KEY;
    const cartoAttr =
      '&copy; <a href="https://carto.com/">CARTO</a> | &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
    const osmAttr =
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

    switch (tileProvider) {
      case "carto-voyager":
        return {
          url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png",
          attribution: cartoAttr,
          subdomains: "abcd",
        };
      case "esri-street":
        return {
          url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
          attribution:
            '&copy; <a href="https://www.esri.com/">Esri</a> | &copy; OpenStreetMap, Garmin, FAO, NOAA, USGS',
          subdomains: "",
        };
      case "carto-dark":
        return key
          ? {
              url: `https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png?key=${key}`,
              attribution: cartoAttr,
              subdomains: "abcd",
            }
          : {
              url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
              attribution: osmAttr,
              subdomains: "abc",
            };
      case "carto-light":
        return key
          ? {
              url: `https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png?key=${key}`,
              attribution: cartoAttr,
              subdomains: "abcd",
            }
          : {
              url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
              attribution: osmAttr,
              subdomains: "abc",
            };
      case "custom":
        return {
          url:
            process.env.NEXT_PUBLIC_CUSTOM_TILE_URL ||
            "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
          attribution:
            process.env.NEXT_PUBLIC_CUSTOM_TILE_ATTRIBUTION ||
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          subdomains: "abc",
        };
      case "osm":
      default:
        return {
          url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
          attribution: osmAttr,
          subdomains: "abc",
        };
    }
  }, [tileProvider]);

  const accent = theme === "maroon" ? "#d4af37" : "#06b6d4";
  const accentSecondary = theme === "maroon" ? "#f59e0b" : "#3b82f6";

  const ashPolygon = useMemo(() => {
    const radius = 0.01 + (windSpeed / 100) * 0.07;
    return computeAshPolygon(volcanoCoords, DIRECTION_DEGREES[direction], radius);
  }, [direction, windSpeed, volcanoCoords]);

  const ashPathOptions = {
    color: accent,
    fillColor: accent,
    fillOpacity: 0.1 + (ashIntensity / 100) * 0.5,
    weight: 2,
    dashArray: "4 6" as const,
  };

  const earthquakePathOptions = {
    color: accentSecondary,
    fillColor: accentSecondary,
    fillOpacity: 0.15,
    weight: 2,
  };

  const evacuationPathOptions = {
    color: accent,
    weight: 4,
    dashArray: "8 8" as const,
    opacity: 0.9,
  };

  const volcanoMarkers = useMemo(() => {
    return (volcanoes || [])
      .filter((v) => v.lat != null && v.lon != null)
      .map((v) => {
        const color = ALERT_LEVELS[v.level].color;
        return (
          <Marker
            key={`v-${v.name}`}
            position={[v.lat!, v.lon!] as [number, number]}
            icon={getDotIcon(color)}
          >
            <Popup>
              <div className="text-bg">
                <strong>{v.name}</strong>
                <br />
                <span style={{ color }}>{v.status}</span>
                <br />
                {v.region}
              </div>
            </Popup>
          </Marker>
        );
      });
  }, [volcanoes]);

  const earthquakeMarkers = useMemo(() => {
    return (earthquakes || []).map((e) => {
      const level = levelFromEarthquake(e.magnitude || 0);
      const color = ALERT_LEVELS[level].color;
      return (
        <Marker
          key={`e-${e.timestamp || e.location || Math.random()}`}
          position={e.coordinates as [number, number]}
          icon={getDotIcon(color)}
        >
          <Popup>
            <div className="text-bg">
              <strong>Gempa M {e.magnitude}</strong>
              <br />
              {e.location}
              <br />
              {e.depthKm} km
            </div>
          </Popup>
        </Marker>
      );
    });
  }, [earthquakes]);

  return (
    <div className="relative h-[60vh] md:h-[calc(100vh-7rem)] min-h-[420px] w-full rounded-2xl overflow-hidden glass-panel">
      <MapContainer
        center={mapCenter}
        zoom={zoom}
        scrollWheelZoom
        className="h-full w-full"
      >
        <MapCenter center={mapCenter} zoom={zoom} />
        <TileLayer
          key={tileProvider}
          attribution={tileConfig.attribution}
          url={tileConfig.url}
          subdomains={tileConfig.subdomains}
        />

        {layers.kelurahan && (
          <Marker position={mapCenter} icon={getKelurahanIcon()}>
            <Popup>
              <div className="text-bg">
                <strong>{selectedKelurahan?.name_local || "Kelurahan"}</strong>
                <br />
                {mapCenter[0].toFixed(4)}, {mapCenter[1].toFixed(4)}
              </div>
            </Popup>
          </Marker>
        )}

        {layers.volcanoes && volcanoMarkers.length > 0 && (
          <MarkerClusterGroup
            key="volcano-cluster"
            showCoverageOnHover={false}
            spiderfyDistanceMultiplier={2}
          >
            {volcanoMarkers}
          </MarkerClusterGroup>
        )}

        {layers.earthquake && earthquakeMarkers.length > 0 && (
          <MarkerClusterGroup
            key="earthquake-cluster"
            showCoverageOnHover={false}
            spiderfyDistanceMultiplier={2}
          >
            {earthquakeMarkers}
          </MarkerClusterGroup>
        )}

        {layers.ash && (
          <Polygon positions={ashPolygon} pathOptions={ashPathOptions} />
        )}
        {layers.earthquake && (
          <Circle
            center={epicenterCoords}
            radius={5000}
            pathOptions={earthquakePathOptions}
          />
        )}
        {layers.evacuation && (
          <Polyline
            positions={[mapCenter, safeZoneCoords]}
            pathOptions={evacuationPathOptions}
          />
        )}
      </MapContainer>

      {!panelOpen && (
        <button
          onClick={() => setPanelOpen(true)}
          type="button"
          className="absolute top-3 right-3 z-[500] rounded-xl glass-panel p-2.5 text-fg hover:bg-white/5"
          aria-label="Buka panel simulasi"
        >
          <SlidersHorizontal className="h-5 w-5 text-accent" />
        </button>
      )}

      {panelOpen && (
        <div className="absolute top-3 right-3 z-[500] w-64 max-w-[calc(100%-1.5rem)] max-h-[80vh] overflow-auto rounded-2xl glass-panel p-4 theme-transition sm:w-72">
          <div className="mb-4 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Wind className="h-5 w-5 text-accent" />
              <h3 className="text-sm font-semibold text-fg">Simulasi Abu Vulkanik</h3>
            </div>
            <button
              onClick={() => setPanelOpen(false)}
              type="button"
              className="rounded-lg p-1 text-fg-muted hover:bg-white/10 hover:text-fg"
              aria-label="Tutup panel simulasi"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mb-4 space-y-2">
            <label className="flex items-center gap-1.5 text-xs font-medium text-fg-muted">
              <Satellite className="h-3.5 w-3.5" /> Basemap
            </label>
            <select
              value={tileProvider}
              onChange={(e) => setTileProvider(e.target.value as TileProvider)}
              className="w-full rounded-lg border border-card-border bg-card/50 px-3 py-2 text-sm text-fg outline-none focus:border-accent"
            >
              <option value="osm">OpenStreetMap (Gratis)</option>
              <option value="carto-voyager">CARTO Voyager (Gratis + Label)</option>
              <option value="esri-street">Esri WorldStreetMap (Label Jelas)</option>
              <option value="carto-dark">CARTO Dark (butuh API key)</option>
              <option value="carto-light">CARTO Light (butuh API key)</option>
              <option value="custom">Custom / Layanan Lain</option>
            </select>
            {(tileProvider === "carto-dark" || tileProvider === "carto-light") && (
              <div className="space-y-1">
                <input
                  type="text"
                  value={cartoApiKey}
                  onChange={(e) => {
                    const val = e.target.value.trim();
                    setCartoApiKey(val);
                    if (typeof window !== "undefined") {
                      if (val) localStorage.setItem("wasspada-carto-key", val);
                      else localStorage.removeItem("wasspada-carto-key");
                    }
                  }}
                  placeholder="Masukkan CARTO API key"
                  className="w-full rounded-lg border border-card-border bg-card/50 px-3 py-2 text-sm text-fg placeholder:text-fg-muted outline-none focus:border-accent"
                />
                {!cartoApiKey && !process.env.NEXT_PUBLIC_CARTO_API_KEY && (
                  <p className="text-xs text-red-400">
                    CARTO API key belum tersedia. Fallback ke OSM.
                  </p>
                )}
                <p className="text-[10px] text-fg-muted">
                  Key disimpan lokal di browser. Untuk production, gunakan NEXT_PUBLIC_CARTO_API_KEY di Vercel.
                </p>
              </div>
            )}
            {tileProvider === "custom" && (
              <p className="text-[10px] text-fg-muted">
                Gunakan NEXT_PUBLIC_CUSTOM_TILE_URL dan NEXT_PUBLIC_CUSTOM_TILE_ATTRIBUTION.
              </p>
            )}
          </div>

        <div className="mb-4">
          <label className="mb-2 flex items-center gap-1.5 text-xs font-medium text-fg-muted">
            <Navigation className="h-3.5 w-3.5" /> Arah Angin
          </label>
          <div className="grid grid-cols-4 gap-2">
            {DIRECTIONS.map((dir) => (
              <button
                key={dir}
                onClick={() => setDirection(dir)}
                type="button"
                className={`min-w-0 rounded-lg px-1 py-1 text-[10px] font-semibold transition-all sm:py-1.5 sm:text-xs ${
                  direction === dir
                    ? "bg-accent text-bg font-bold shadow-[0_0_12px_var(--glow)]"
                    : "text-fg hover:bg-white/5"
                }`}
              >
                {dir}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-4 space-y-1">
          <label className="flex items-center justify-between text-xs font-medium text-fg-muted">
            Kecepatan Angin
            <span className="text-fg">{windSpeed}%</span>
          </label>
          <input
            type="range"
            min={0}
            max={100}
            value={windSpeed}
            onChange={(e) => setWindSpeed(Number(e.target.value))}
            className="map-slider"
          />
        </div>

        <div className="mb-5 space-y-1">
          <label className="flex items-center justify-between text-xs font-medium text-fg-muted">
            Intensitas Abu
            <span className="text-fg">{ashIntensity}%</span>
          </label>
          <input
            type="range"
            min={0}
            max={100}
            value={ashIntensity}
            onChange={(e) => setAshIntensity(Number(e.target.value))}
            className="map-slider"
          />
        </div>

        <div>
          <label className="mb-2 flex items-center gap-1.5 text-xs font-medium text-fg-muted">
            <Layers className="h-3.5 w-3.5" /> Layer Peta
          </label>
          <div className="space-y-2">
            {[
              { key: "volcanoes", label: "Gunung Api Aktif" },
              { key: "earthquake", label: "Gempabumi BMKG" },
              { key: "kelurahan", label: "Lokasi Kelurahan" },
              { key: "ash", label: "Sebaran Abu Vulkanik" },
              { key: "evacuation", label: "Jalur Evakuasi" },
            ].map((item) => (
              <label
                key={item.key}
                className="flex cursor-pointer items-center gap-2 text-sm text-fg"
              >
                <input
                  type="checkbox"
                  checked={layers[item.key as keyof typeof layers]}
                  onChange={(e) =>
                    setLayers((prev) => ({
                      ...prev,
                      [item.key]: e.target.checked,
                    }))
                  }
                  className="h-4 w-4 accent-accent rounded border-card-border bg-card"
                />
                {item.label}
              </label>
            ))}
          </div>
        </div>

        <div className="mt-4 flex items-start gap-2 rounded-xl bg-black/20 p-2.5">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
          <p className="text-[11px] leading-relaxed text-fg-muted">
            {loading
              ? "Memuat data gunung api dan gempa..."
              : `Memantau ${volcanoes.length} gunung api aktif dan ${earthquakes.length} gempa.`}
          </p>
        </div>
      </div>
      )}
    </div>
  );
}
