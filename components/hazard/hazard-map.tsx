"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useMemo, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polygon,
  Circle,
  Polyline,
  Tooltip,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import {
  fetchVolcanoes,
  fetchBMKG,
  fetchWind,
  computeDestination,
  cardinalTo,
  Volcano,
  Earthquake,
  type WindData,
} from "@/lib/live-api";
import { useAlert } from "@/lib/alert-context";
import {
  Wind,
  Layers,
  X,
  SlidersHorizontal,
  Flame,
  Activity,
  MapPin,
  Info,
} from "lucide-react";

/* ---------- konstanta ---------- */
const LEVEL_COLOR: Record<number, string> = {
  1: "#22c55e",
  2: "#facc15",
  3: "#fb923c",
  4: "#ef4444",
};
const LEVEL_LABEL: Record<number, string> = {
  1: "Normal",
  2: "Waspada",
  3: "Siaga",
  4: "Awas",
};
const KRB_ZONES = [
  { km: 3, label: "KRB III", color: "#ef4444" },
  { km: 5, label: "KRB II", color: "#fb923c" },
  { km: 8, label: "KRB I", color: "#facc15" },
];

type TileProvider = "osm" | "esri-street";

/* ---------- icon makers ---------- */
function volcanoIcon(color: string, active: boolean) {
  return L.divIcon({
    className: "bg-transparent",
    html: `<div class="map-marker" style="--accent:${color}">
      <div class="map-marker-core" style="width:${active ? "1rem" : "0.75rem"};height:${active ? "1rem" : "0.75rem"};background-color:${color};box-shadow:0 0 10px ${color};"></div>
      ${active ? `<div class="map-marker-ring" style="border-color:${color};box-shadow:0 0 10px ${color};"></div>` : ""}
    </div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}

function windArrowIcon(degTo: number) {
  const rot = degTo - 90; // karakter ➤ menghadap timur (90°)
  return L.divIcon({
    className: "bg-transparent",
    html: `<div style="width:26px;height:26px;display:flex;align-items:center;justify-content:center;color:#7dd3fc;text-shadow:0 0 8px #38bdf8;transform:rotate(${rot}deg);font-size:20px;font-weight:700;">➤</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
}

function kelurahanIcon() {
  return L.divIcon({
    className: "bg-transparent",
    html: `<div style="width:18px;height:18px;border-radius:50%;background:#facc15;box-shadow:0 0 14px #facc15;border:3px solid #fff;"></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

function computeCone(
  center: [number, number],
  bearingTo: number,
  radiusDeg: number,
  spread = 28,
  steps = 6
): [number, number][] {
  const points: [number, number][] = [center];
  for (let i = 0; i <= steps; i++) {
    const angle = bearingTo - spread + (2 * spread * i) / steps;
    const rad = ((90 - angle) * Math.PI) / 180;
    points.push([
      center[0] + radiusDeg * Math.sin(rad),
      center[1] + radiusDeg * Math.cos(rad),
    ]);
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

/* ---------- komponen utama ---------- */
export default function HazardMap() {
  const { disasterCenter, selectedKelurahan } = useAlert();

  const [volcanoes, setVolcanoes] = useState<Volcano[]>([]);
  const [earthquakes, setEarthquakes] = useState<Earthquake[]>([]);
  const [wind, setWind] = useState<WindData | null>(null);
  const [loading, setLoading] = useState(true);
  const [panelOpen, setPanelOpen] = useState(true);
  const [windBoost, setWindBoost] = useState(100); // % slider
  const [tileProvider, setTileProvider] = useState<TileProvider>(() => {
    const env = process.env.NEXT_PUBLIC_DEFAULT_TILE_PROVIDER as TileProvider;
    return env === "osm" ? "osm" : "esri-street";
  });
  const [layers, setLayers] = useState({
    volcanoes: true,
    earthquakes: true,
    wind: true,
    krb: true,
    plume: true,
  });

  const center = useMemo<[number, number]>(
    () => [disasterCenter[0], disasterCenter[1]],
    [disasterCenter[0], disasterCenter[1]]
  );
  const zoom = useMemo(() => (selectedKelurahan ? 11 : 5), [selectedKelurahan]);

  /* fetch gunung + gempa, refresh tiap 60 detik */
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [vRes, bRes] = await Promise.all([fetchVolcanoes(), fetchBMKG()]);
        if (cancelled) return;
        setVolcanoes((vRes.error ? [] : vRes.volcanoes) || []);
        const rawEqs = bRes.error
          ? []
          : [bRes.latest, ...(bRes.felt || [])].filter(
              (e): e is Earthquake => e != null && e.coordinates != null
            );
        const seen = new Set<string>();
        setEarthquakes(
          rawEqs.filter((e) => {
            const k = e.timestamp || `${e.coordinates?.join(",")}-${e.magnitude}`;
            if (seen.has(k)) return false;
            seen.add(k);
            return true;
          })
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    const interval = setInterval(load, 60000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  /* angin real-time di pusat pantauan */
  useEffect(() => {
    fetchWind(center[0], center[1])
      .then(setWind)
      .catch(() => setWind(null));
  }, [center[0], center[1]]);

  /* gunung prioritas: level tertinggi yang punya koordinat */
  const threatVolcano = useMemo(() => {
    const withCoords = volcanoes.filter(
      (v): v is Volcano & { lat: number; lon: number } =>
        v.lat != null && v.lon != null
    );
    if (!withCoords.length) return null;
    return [...withCoords].sort((a, b) => b.level - a.level)[0];
  }, [volcanoes]);

  const threatCenter = useMemo<[number, number]>(
    () =>
      threatVolcano ? [threatVolcano.lat, threatVolcano.lon] : center,
    [threatVolcano, center]
  );

  /* arah angin (ke mana) + kecepatan terskalakan slider */
  const windTo = wind?.windDirectionTo ?? 90;
  const effSpeed = (wind?.windSpeed ?? 20) * (windBoost / 100);
  const plumeLen = 0.01 + Math.min(0.09, (effSpeed / 80) * 0.09);

  const plume = useMemo(
    () => computeCone(threatCenter, windTo, plumeLen),
    [threatCenter, windTo, plumeLen]
  );

  /* garis aliran angin paralel (animasi dash via CSS) */
  const windLines = useMemo(() => {
    const perp = (windTo + 90) % 360;
    const lines: [number, number][][] = [];
    for (const off of [-14, -7, 0, 7, 14]) {
      const base = computeDestination(center, perp, off);
      lines.push([
        computeDestination(base, (windTo + 180) % 360, 26),
        computeDestination(base, windTo, 26),
      ]);
    }
    return lines;
  }, [center, windTo]);

  /* panah arah di garis tengah aliran */
  const windArrows = useMemo(() => {
    const pts: [number, number][] = [];
    for (const d of [-12, 0, 12]) {
      pts.push(computeDestination(center, windTo, d));
    }
    return pts;
  }, [center, windTo]);

  const tileConfig = useMemo(() => {
    if (tileProvider === "osm") {
      return {
        url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      };
    }
    return {
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
      attribution:
        '&copy; <a href="https://www.esri.com/">Esri</a> | &copy; OpenStreetMap, Garmin, FAO, NOAA, USGS',
    };
  }, [tileProvider]);

  const eqRadius = (m: number | null, depthKm: number | null) => {
    const mag = m ?? 0;
    if (!mag) return 4000;
    const depthFactor = Math.max(0.3, 1 - (depthKm ?? 0) / 300);
    return Math.min(Math.max(Math.round(mag * 2500 * depthFactor), 3000), 40000);
  };

  const toggle = (key: keyof typeof layers) =>
    setLayers((prev) => ({ ...prev, [key]: !prev[key] }));

  const layerItems: { key: keyof typeof layers; label: string }[] = [
    { key: "volcanoes", label: "Gunung api" },
    { key: "earthquakes", label: "Gempa" },
    { key: "wind", label: "Aliran angin" },
    { key: "krb", label: "Zona KRB" },
    { key: "plume", label: "Sebaran abu" },
  ];

  return (
    <div className="relative overflow-hidden rounded-2xl border border-card-border">
      <MapContainer
        center={center}
        zoom={zoom}
        scrollWheelZoom
        className="h-[62vh] min-h-[440px] w-full md:h-[calc(100vh-12rem)]"
      >
        <MapCenter center={center} zoom={zoom} />
        <TileLayer url={tileConfig.url} attribution={tileConfig.attribution} />

        {/* zona KRB di sekitar pusat pantauan */}
        {layers.krb &&
          KRB_ZONES.map((z) => (
            <Circle
              key={z.km}
              center={center}
              radius={z.km * 1000}
              pathOptions={{
                color: z.color,
                weight: 1.5,
                dashArray: "6 6",
                fillColor: z.color,
                fillOpacity: 0.07,
              }}
            >
              <Tooltip sticky>{`${z.label} — radius ${z.km} km`}</Tooltip>
            </Circle>
          ))}

        {/* marker gunung api */}
        {layers.volcanoes &&
          volcanoes.map(
            (v) =>
              v.lat != null &&
              v.lon != null && (
                <Marker
                  key={v.name}
                  position={[v.lat, v.lon]}
                  icon={volcanoIcon(
                    LEVEL_COLOR[v.level] ?? "#22c55e",
                    v.level >= 3
                  )}
                >
                  <Popup>
                    <div className="text-xs">
                      <p className="font-bold">{v.name}</p>
                      <p>
                        Status:{" "}
                        <b style={{ color: LEVEL_COLOR[v.level] }}>
                          {v.status || LEVEL_LABEL[v.level]}
                        </b>
                      </p>
                      {v.region && <p>Wilayah: {v.region}</p>}
                    </div>
                  </Popup>
                </Marker>
              )
          )}

        {/* gempa — ring radius ∝ magnitude */}
        {layers.earthquakes &&
          earthquakes.map((eq, i) =>
            eq.coordinates ? (
              <Circle
                key={`${eq.timestamp ?? i}`}
                center={eq.coordinates}
                radius={eqRadius(eq.magnitude, eq.depthKm)}
                pathOptions={{
                  color: "#f97316",
                  weight: 2,
                  fillColor: "#f97316",
                  fillOpacity: 0.08,
                }}
              >
                <Popup>
                  <div className="text-xs">
                    <p className="font-bold">Gempa M{eq.magnitude ?? "-"}</p>
                    {eq.location && <p>{eq.location}</p>}
                    {eq.depthKm != null && <p>Kedalaman: {eq.depthKm} km</p>}
                    {eq.potential && <p>{eq.potential}</p>}
                  </div>
                </Popup>
              </Circle>
            ) : null
          )}

        {/* aliran angin — garis dash beranimasi */}
        {layers.wind &&
          windLines.map((line, i) => (
            <Polyline
              key={i}
              positions={line}
              pathOptions={{
                color: "#38bdf8",
                weight: 2.5,
                opacity: 0.75,
                dashArray: "10 14",
                className: "wind-flow",
              }}
            />
          ))}
        {layers.wind &&
          windArrows.map((p, i) => (
            <Marker
              key={`wa-${i}`}
              position={p}
              icon={windArrowIcon(windTo)}
              interactive={false}
            />
          ))}

        {/* kerucut sebaran abu dari gunung berstatus tertinggi */}
        {layers.plume && threatVolcano && threatVolcano.level >= 2 && (
          <Polygon
            positions={plume}
            pathOptions={{
              color: "#a855f7",
              weight: 2,
              dashArray: "4 6",
              fillColor: "#a855f7",
              fillOpacity: 0.18,
            }}
          >
            <Tooltip sticky>
              Perkiraan sebaran abu {threatVolcano.name} mengikuti angin ke{" "}
              {cardinalTo((windTo + 180) % 360)}
            </Tooltip>
          </Polygon>
        )}

        {/* posisi kelurahan/lokasi terpilih */}
        {selectedKelurahan && (
          <Marker
            position={[selectedKelurahan.lat, selectedKelurahan.lon]}
            icon={kelurahanIcon()}
          >
            <Popup>
              <div className="text-xs">
                <p className="font-bold">{selectedKelurahan.name_local}</p>
                {selectedKelurahan.parent_name_local && (
                  <p>{selectedKelurahan.parent_name_local}</p>
                )}
              </div>
            </Popup>
          </Marker>
        )}
      </MapContainer>

      {/* toggle panel */}
      <button
        type="button"
        onClick={() => setPanelOpen((v) => !v)}
        aria-label="Panel hazard"
        className="absolute right-3 top-3 z-[1000] rounded-xl glass-panel p-2.5 text-fg shadow-lg hover:text-accent"
      >
        {panelOpen ? (
          <X className="h-4 w-4" />
        ) : (
          <SlidersHorizontal className="h-4 w-4" />
        )}
      </button>

      {/* panel kontrol */}
      {panelOpen && (
        <div className="absolute right-3 top-14 z-[1000] w-64 max-w-[calc(100%-1.5rem)] max-h-[calc(100%-4.5rem)] space-y-4 overflow-y-auto rounded-2xl glass-panel p-4 shadow-xl [scrollbar-width:thin]">
          <div className="flex items-center gap-2 border-b border-card-border pb-2">
            <Info className="h-4 w-4 text-accent" />
            <span className="text-xs font-bold text-fg">Peta Hazard</span>
          </div>

          {/* info angin */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 text-fg-muted">
                <Wind className="h-3.5 w-3.5" /> Angin
              </span>
              <span className="font-bold text-sky-400">
                {wind
                  ? `${Math.round(wind.windSpeed)} km/h → ${cardinalTo(wind.windDirectionFrom)}`
                  : "memuat..."}
              </span>
            </div>
            <input
              type="range"
              min={20}
              max={300}
              value={windBoost}
              onChange={(e) => setWindBoost(Number(e.target.value))}
              aria-label="Simulasi kekuatan angin"
              className="w-full accent-sky-400"
            />
            <p className="text-[10px] text-fg-muted">
              Geser untuk simulasi angin lebih kencang/lemah ({windBoost}%)
            </p>
          </div>

          {/* gunung terpantau */}
          {threatVolcano && (
            <div className="flex items-start gap-2 rounded-xl border border-card-border bg-black/20 p-2.5">
              <Flame
                className="mt-0.5 h-4 w-4 shrink-0"
                style={{ color: LEVEL_COLOR[threatVolcano.level] }}
              />
              <div className="text-[11px]">
                <p className="font-bold text-fg">{threatVolcano.name}</p>
                <p className="text-fg-muted">
                  Status {threatVolcano.status || LEVEL_LABEL[threatVolcano.level]}{" "}
                  — kerucut ungu = arah sebaran abu
                </p>
              </div>
            </div>
          )}

          {/* toggle layer */}
          <div className="space-y-1.5">
            <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-fg-muted">
              <Layers className="h-3 w-3" /> Layer
            </p>
            {layerItems.map((l) => (
              <button
                key={l.key}
                type="button"
                onClick={() => toggle(l.key)}
                className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  layers[l.key]
                    ? "bg-accent/15 text-accent"
                    : "bg-white/5 text-fg-muted hover:text-fg"
                }`}
              >
                {l.label}
                <span
                  className={`h-2 w-2 rounded-full ${
                    layers[l.key] ? "bg-accent" : "bg-white/20"
                  }`}
                />
              </button>
            ))}
          </div>

          {/* basemap */}
          <div className="flex gap-1.5">
            {(["esri-street", "osm"] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setTileProvider(p)}
                className={`flex-1 rounded-lg px-2 py-1.5 text-[10px] font-bold ${
                  tileProvider === p
                    ? "bg-accent/15 text-accent"
                    : "bg-white/5 text-fg-muted"
                }`}
              >
                {p === "osm" ? "OSM" : "Esri"}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* legend */}
      <div className="absolute bottom-3 left-3 z-[1000] space-y-1 rounded-xl glass-panel px-3 py-2 text-[10px] shadow-lg">
        <p className="font-bold text-fg">Legenda</p>
        <p className="flex items-center gap-1.5 text-fg-muted">
          <Flame className="h-3 w-3 text-orange-400" /> Gunung (warna = status)
        </p>
        <p className="flex items-center gap-1.5 text-fg-muted">
          <Activity className="h-3 w-3 text-orange-500" /> Ring gempa ∝ magnitude
        </p>
        <p className="flex items-center gap-1.5 text-fg-muted">
          <Wind className="h-3 w-3 text-sky-400" /> Aliran angin real-time
        </p>
        <p className="flex items-center gap-1.5 text-fg-muted">
          <MapPin className="h-3 w-3 text-yellow-400" /> Lokasi kamu
        </p>
        <p className="flex items-center gap-1.5 text-fg-muted">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-purple-500/40" />
          Kerucut = sebaran abu
        </p>
      </div>

      {loading && (
        <div className="absolute inset-x-0 top-3 z-[1000] mx-auto w-fit rounded-full glass-panel px-4 py-1.5 text-xs text-fg-muted shadow-lg">
          Memuat data BMKG &amp; PVMBG...
        </div>
      )}
    </div>
  );
}
