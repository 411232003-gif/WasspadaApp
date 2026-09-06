"use client";

import "leaflet/dist/leaflet.css";
import { useMemo, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Polygon,
  Circle,
  Polyline,
} from "react-leaflet";
import L from "leaflet";
import { useTheme } from "@/lib/theme-provider";
import { Wind, Layers, Navigation, Info } from "lucide-react";

type Direction = "N" | "S" | "E" | "W";

const DIRECTION_DEGREES: Record<Direction, number> = {
  N: 0,
  E: 90,
  S: 180,
  W: 270,
};

const KELURAHAN_CENTER: [number, number] = [-6.2088, 106.8456];
const VOLCANO_COORDS: [number, number] = [-6.2088, 106.8956];
const EPICENTER_COORDS: [number, number] = [-6.2188, 106.8356];
const SAFE_ZONE_COORDS: [number, number] = [-6.1988, 106.8756];

const DIRECTIONS: Direction[] = ["N", "S", "E", "W"];

function getVolcanoIcon() {
  return L.divIcon({
    className: "bg-transparent",
    html: `<div class="map-marker volcano"><div class="map-marker-ring"></div><div class="map-marker-core"></div></div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}

function getEarthquakeIcon() {
  return L.divIcon({
    className: "bg-transparent",
    html: `<div class="map-marker earthquake"><div class="map-marker-ring"></div><div class="map-marker-core"></div></div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
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

export default function MapClient() {
  const { theme } = useTheme();
  const [direction, setDirection] = useState<Direction>("N");
  const [windSpeed, setWindSpeed] = useState(40);
  const [ashIntensity, setAshIntensity] = useState(40);
  const [layers, setLayers] = useState({
    ash: true,
    earthquake: true,
    evacuation: true,
  });

  const accent = theme === "maroon" ? "#d4af37" : "#06b6d4";
  const accentSecondary = theme === "maroon" ? "#f59e0b" : "#3b82f6";

  const ashPolygon = useMemo(() => {
    const radius = 0.01 + (windSpeed / 100) * 0.07;
    return computeAshPolygon(
      VOLCANO_COORDS,
      DIRECTION_DEGREES[direction],
      radius
    );
  }, [direction, windSpeed]);

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

  return (
    <div className="relative h-[60vh] md:h-[calc(100vh-7rem)] min-h-[420px] w-full rounded-2xl overflow-hidden glass-panel">
      <MapContainer
        center={KELURAHAN_CENTER}
        zoom={13}
        scrollWheelZoom
        className="h-full w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://carto.com/">CARTO</a> | &copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        <Marker position={VOLCANO_COORDS} icon={getVolcanoIcon()} />
        <Marker position={EPICENTER_COORDS} icon={getEarthquakeIcon()} />

        {layers.ash && (
          <Polygon positions={ashPolygon} pathOptions={ashPathOptions} />
        )}
        {layers.earthquake && (
          <Circle
            center={EPICENTER_COORDS}
            radius={5000}
            pathOptions={earthquakePathOptions}
          />
        )}
        {layers.evacuation && (
          <Polyline
            positions={[KELURAHAN_CENTER, SAFE_ZONE_COORDS]}
            pathOptions={evacuationPathOptions}
          />
        )}
      </MapContainer>

      <div className="absolute top-3 right-3 z-[500] w-72 rounded-2xl glass-panel p-4 theme-transition">
        <div className="mb-4 flex items-center gap-2">
          <Wind className="h-5 w-5 text-accent" />
          <h3 className="text-sm font-semibold text-fg">Simulasi Abu Vulkanik</h3>
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
                className={`rounded-lg py-1.5 text-xs font-semibold transition-all ${
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
              { key: "ash", label: "Sebaran Abu Vulkanik" },
              { key: "earthquake", label: "Area Gempa Terasa" },
              { key: "evacuation", label: "Jalur Evakuasi Kelurahan" },
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
            Koordinat bersifat simulasi. Ganti dengan data BMKG dan batas
            kelurahan asli di <code className="text-accent">components/map/map-client.tsx</code>.
          </p>
        </div>
      </div>
    </div>
  );
}
