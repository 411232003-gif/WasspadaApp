"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAlert, ALERT_LEVELS } from "@/lib/alert-context";
import { useSmartPolling } from "@/lib/use-smart-polling";
import {
  fetchVolcanoes,
  fetchBMKG,
  fetchFireDetections,
  fetchWind,
  getBearing,
  computeDestination,
  haversineKm,
  cardinalTo,
  Volcano,
  Earthquake,
  type WindData,
} from "@/lib/live-api";
import type {
  FireDetection,
  FireSourceStatus,
} from "@/lib/fire-detections";
import {
  GIBS_CREDIT,
  GIBS_LAYERS,
  gibsFrames,
  gibsTileUrl,
  type GibsLayerKey,
} from "@/lib/gibs";
import {
  fetchWeatherGrid,
  renderWeatherImage,
  rainviewerTileUrl,
  colorbarCss,
  RAINVIEWER_CREDIT,
  WEATHER_LAYERS,
  WEATHER_RECT,
  type WeatherGrid,
  type WeatherLayerKey,
} from "@/lib/weather-overlay";
import type { OverlaySpec } from "./cesium-globe";
import {
  Wind,
  Layers,
  Navigation,
  Info,
  X,
  SlidersHorizontal,
  Satellite,
  Flame,
  Activity,
  MapPin,
  Route,
  CloudSun,
  Play,
  Pause,
  Maximize2,
  Minimize2,
} from "lucide-react";

const CesiumGlobe = dynamic(() => import("./cesium-globe"), { ssr: false });

type GibsOverlayKey = Exclude<GibsLayerKey, "none">;
type OverlayKey = "none" | GibsOverlayKey | "radar" | WeatherLayerKey;

const GIBS_OVERLAY_KEYS: GibsOverlayKey[] = [
  "satellite",
  "precip",
  "aerosol",
  "co",
  "truecolor",
];
const isGibsOverlay = (k: OverlayKey): k is GibsOverlayKey =>
  (GIBS_OVERLAY_KEYS as string[]).includes(k);
const isWeatherOverlay = (k: OverlayKey): k is WeatherLayerKey =>
  k in WEATHER_LAYERS;

/** Grup dropdown overlay ala Zoom Earth — satu overlay aktif. */
const OVERLAY_GROUPS: {
  label: string;
  options: { key: OverlayKey; label: string }[];
}[] = [
  {
    label: "Satelit",
    options: [
      { key: "none", label: "Mati" },
      { key: "satellite", label: "Live — Himawari" },
      { key: "truecolor", label: "HD — True Color" },
      { key: "radar", label: "Radar Hujan" },
    ],
  },
  {
    label: "Presipitasi",
    options: [
      { key: "none", label: "Mati" },
      { key: "precip", label: "IMERG (NASA)" },
    ],
  },
  {
    label: "Angin",
    options: [
      { key: "none", label: "Mati" },
      { key: "wind-speed", label: "Kecepatan" },
      { key: "wind-gusts", label: "Hembusan" },
    ],
  },
  {
    label: "Suhu",
    options: [
      { key: "none", label: "Mati" },
      { key: "temp-actual", label: "Aktual" },
      { key: "temp-feels", label: "Terasa Seperti" },
    ],
  },
  {
    label: "Kelembapan",
    options: [
      { key: "none", label: "Mati" },
      { key: "hum-rel", label: "Relatif" },
      { key: "hum-dew", label: "Titik Embun" },
      { key: "hum-wet", label: "Bola Basah" },
    ],
  },
  {
    label: "Tekanan",
    options: [
      { key: "none", label: "Mati" },
      { key: "pressure", label: "MSL" },
    ],
  },
  {
    label: "Atmosfer",
    options: [
      { key: "none", label: "Mati" },
      { key: "aerosol", label: "Asap (Aerosol)" },
      { key: "co", label: "Karbon Monoksida" },
    ],
  },
];

type Direction = "N" | "S" | "E" | "W";
type AshDirection = Direction | "AUTO";

const DIRECTION_DEGREES: Record<Direction, number> = {
  N: 0,
  E: 90,
  S: 180,
  W: 270,
};
const ASH_DIRECTIONS: AshDirection[] = ["AUTO", "N", "E", "S", "W"];

const MAX_FIRE_MARKERS = 250;

/** Label waktu frame animasi — jam untuk step 10-menit, tanggal untuk harian. */
function frameLabel(t: string): string {
  if (t === "default") return "Data terbaru";
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return t;
  return d.toLocaleString(
    "id-ID",
    t.includes("T")
      ? {
          day: "2-digit",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "Asia/Jakarta",
        }
      : { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Jakarta" }
  );
}

/* ---------- geometry helpers ---------- */
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

/* ---------- komponen utama ---------- */
export default function MonevMap() {
  const { disasterCenter, selectedKelurahan, nearestVolcano, nearestEarthquake } =
    useAlert();
  const centerLat = disasterCenter[0];
  const centerLon = disasterCenter[1];

  const [volcanoes, setVolcanoes] = useState<Volcano[]>([]);
  const [earthquakes, setEarthquakes] = useState<Earthquake[]>([]);
  const [fireDetections, setFireDetections] = useState<FireDetection[]>([]);
  const [fireSourceStatus, setFireSourceStatus] = useState<
    Record<string, FireSourceStatus>
  >({});
  const [wind, setWind] = useState<WindData | null>(null);
  const [loading, setLoading] = useState(true);
  const [panelOpen, setPanelOpen] = useState(true);
  const [legendOpen, setLegendOpen] = useState(true);
  const [shaking, setShaking] = useState(false);
  const lastTsRef = useRef<string | null>(null);

  const [ashDirection, setAshDirection] = useState<AshDirection>("AUTO");
  const [windBoost, setWindBoost] = useState(100); // %
  const [ashIntensity, setAshIntensity] = useState(40);
  /* overlay tunggal: GIBS / radar RainViewer / model Open-Meteo */
  const [overlay, setOverlay] = useState<OverlayKey>("none");
  const [mapOnly, setMapOnly] = useState(false);
  const [radarUrl, setRadarUrl] = useState<string | null>(null);
  const [grid, setGrid] = useState<WeatherGrid[] | null>(null);
  const [gridErr, setGridErr] = useState(false);

  /* playback linimasa layer GIBS (-1 = data terbaru/live) */
  const [playing, setPlaying] = useState(false);
  const [frameIdx, setFrameIdx] = useState(-1);
  const frames = useMemo(
    () =>
      isGibsOverlay(overlay) ? gibsFrames(GIBS_LAYERS[overlay].step) : [],
    [overlay]
  );
  const [prevOverlay, setPrevOverlay] = useState(overlay);
  if (overlay !== prevOverlay) {
    setPrevOverlay(overlay);
    setPlaying(false);
    setFrameIdx(-1);
  }
  const overlayTime =
    frameIdx >= 0 && frames.length ? frames[frameIdx] : "default";

  useEffect(() => {
    if (!playing || frames.length === 0) return;
    const id = setInterval(
      () => setFrameIdx((i) => (i + 1) % frames.length),
      900
    );
    return () => clearInterval(id);
  }, [playing, frames.length]);

  /* URL tile radar RainViewer — diambil saat layer radar dipilih */
  useEffect(() => {
    if (overlay !== "radar" || radarUrl) return;
    let on = true;
    rainviewerTileUrl()
      .then((u) => on && setRadarUrl(u))
      .catch(() => {});
    return () => {
      on = false;
    };
  }, [overlay, radarUrl]);

  /* grid model Open-Meteo — sekali fetch, dipakai semua layer model */
  useEffect(() => {
    if (!isWeatherOverlay(overlay) || grid || gridErr) return;
    let on = true;
    fetchWeatherGrid()
      .then((g) => on && setGrid(g))
      .catch(() => on && setGridErr(true));
    return () => {
      on = false;
    };
  }, [overlay, grid, gridErr]);

  /* grid → gambar gradasi warna (di-memo agar tidak render ulang) */
  const modelImage = useMemo(() => {
    if (!isWeatherOverlay(overlay) || !grid) return null;
    return renderWeatherImage(grid, overlay);
  }, [grid, overlay]);

  const overlaySpec = useMemo<OverlaySpec>(() => {
    if (overlay === "none") return null;
    if (isGibsOverlay(overlay)) {
      const def = GIBS_LAYERS[overlay];
      return {
        kind: "tile",
        url: gibsTileUrl(def, overlayTime),
        maxZoom: def.maxZoom,
        alpha: def.alpha,
        credit: GIBS_CREDIT,
      };
    }
    if (overlay === "radar") {
      return radarUrl
        ? {
            kind: "tile",
            url: radarUrl,
            maxZoom: 10,
            alpha: 0.75,
            credit: RAINVIEWER_CREDIT,
          }
        : null;
    }
    if (isWeatherOverlay(overlay) && modelImage) {
      return {
        kind: "image",
        url: modelImage,
        alpha: WEATHER_LAYERS[overlay].alpha,
        rect: WEATHER_RECT,
      };
    }
    return null;
  }, [overlay, overlayTime, radarUrl, modelImage]);
  const [layers, setLayers] = useState({
    volcanoes: true,
    earthquakes: true,
    fires: true,
    wind: true,
    krb: true,
    plume: true,
    evacuation: true,
    kelurahan: true,
  });

  const center = useMemo<[number, number]>(
    () => [centerLat, centerLon],
    [centerLat, centerLon]
  );

  const load = async () => {
    try {
      const [vRes, bRes] = await Promise.all([fetchVolcanoes(), fetchBMKG()]);
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
      setLoading(false);
    }
  };

  const isAlertActive =
    volcanoes.some((volcano) => volcano.level >= 3) ||
    earthquakes.some((earthquake) => (earthquake.magnitude ?? 0) >= 5.5);

  useSmartPolling(load, {
    stableIntervalMs: 300000,
    alertIntervalMs: 60000,
    isAlertActive,
  });

  const loadFireDetections = async () => {
    const response = await fetchFireDetections();
    if (!response.error) {
      setFireDetections(response.detections);
      setFireSourceStatus(response.sources);
    }
  };

  const nearbyFireActive = fireDetections.some(
    (detection) => haversineKm(center, detection.coordinates) <= 25
  );

  const visibleFireDetections = useMemo(() => {
    const prioritized = fireDetections.map((detection) => ({
      detection,
      isNearby: haversineKm(center, detection.coordinates) <= 25,
    }));
    prioritized.sort(
      (a, b) =>
        Number(b.isNearby) - Number(a.isNearby) ||
        Date.parse(b.detection.detectedAt) - Date.parse(a.detection.detectedAt)
    );
    return prioritized
      .slice(0, MAX_FIRE_MARKERS)
      .map(({ detection }) => detection);
  }, [center, fireDetections]);

  useSmartPolling(loadFireDetections, {
    stableIntervalMs: 300000,
    alertIntervalMs: 120000,
    isAlertActive: nearbyFireActive,
  });

  const loadWind = async () => {
    setWind(await fetchWind(center[0], center[1]));
  };

  useSmartPolling(loadWind, {
    stableIntervalMs: 300000,
    refreshKey: `${center[0]},${center[1]}`,
  });

  /* getar peta saat ada gempa baru >= 4.5 */
  useEffect(() => {
    const ts = nearestEarthquake?.item?.timestamp || null;
    const mag = nearestEarthquake?.item?.magnitude || 0;
    if (ts && lastTsRef.current && ts !== lastTsRef.current && mag >= 4.5) {
      setShaking(true);
      const t = setTimeout(() => setShaking(false), 600);
      return () => clearTimeout(t);
    }
    lastTsRef.current = ts;
  }, [nearestEarthquake?.item?.timestamp, nearestEarthquake?.item?.magnitude]);

  /* sumber abu: gunung terdekat kelurahan, fallback gunung level tertinggi */
  const plumeSource = useMemo<(Volcano & { lat: number; lon: number }) | null>(() => {
    const item = nearestVolcano?.item;
    if (item && item.lat != null && item.lon != null) {
      return item as Volcano & { lat: number; lon: number };
    }
    const withCoords = volcanoes.filter(
      (v): v is Volcano & { lat: number; lon: number } =>
        v.lat != null && v.lon != null
    );
    if (!withCoords.length) return null;
    return [...withCoords].sort((a, b) => b.level - a.level)[0];
  }, [nearestVolcano, volcanoes]);

  const plumeOrigin = useMemo<[number, number]>(
    () => (plumeSource ? [plumeSource.lat, plumeSource.lon] : center),
    [plumeSource, center]
  );

  /* arah angin (ke mana) + kecepatan terskalakan slider */
  const windTo = wind?.windDirectionTo ?? 90;
  const ashBearing =
    ashDirection === "AUTO" ? windTo : DIRECTION_DEGREES[ashDirection];
  const effSpeed = (wind?.windSpeed ?? 20) * (windBoost / 100);
  const plumeLen = 0.01 + Math.min(0.09, (effSpeed / 80) * 0.09);

  const plume = useMemo(
    () => computeCone(plumeOrigin, ashBearing, plumeLen),
    [plumeOrigin, ashBearing, plumeLen]
  );

  /* garis aliran angin paralel */
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

  /* zona aman menjauhi gunung terdekat */
  const safeZoneCoords: [number, number] = useMemo(() => {
    if (nearestVolcano?.item.lat != null && nearestVolcano.item.lon != null) {
      const bearingFromUser = getBearing(center, [
        nearestVolcano.item.lat,
        nearestVolcano.item.lon,
      ]);
      const away = (bearingFromUser + 180) % 360;
      const distance = Math.max(10, nearestVolcano.distanceKm * 1.5);
      return computeDestination(center, away, distance);
    }
    return computeDestination(center, 45, 10);
  }, [center, nearestVolcano]);

  const toggle = (key: keyof typeof layers) =>
    setLayers((prev) => ({ ...prev, [key]: !prev[key] }));

  const layerItems: { key: keyof typeof layers; label: string }[] = [
    { key: "volcanoes", label: "Gunung Api Aktif" },
    { key: "earthquakes", label: "Gempa & Radius Dampak" },
    { key: "fires", label: `Titik Kebakaran (${fireDetections.length})` },
    { key: "krb", label: "Zona KRB" },
    { key: "wind", label: "Aliran Angin" },
    { key: "plume", label: "Sebaran Abu" },
    { key: "evacuation", label: "Jalur Evakuasi" },
    { key: "kelurahan", label: "Lokasi Pantauan" },
  ];

  return (
    <div className="relative h-[60vh] md:h-[calc(100vh-7rem)] min-h-[420px] w-full rounded-2xl overflow-hidden glass-panel">
      <div className={shaking ? "h-full w-full shake-map" : "h-full w-full"}>
        <CesiumGlobe
          volcanoes={volcanoes}
          earthquakes={earthquakes}
          fires={visibleFireDetections}
          center={center}
          centerName={selectedKelurahan?.name_local || "Lokasi Pantauan"}
          safeZone={safeZoneCoords}
          plume={plume}
          windLines={windLines}
          krbCenter={layers.krb ? plumeOrigin : null}
          layers={layers}
          overlay={overlaySpec}
          mapOnly={mapOnly}
        />
      </div>

      {/* mode peta penuh — sembunyikan semua card overlay */}
      <button
        type="button"
        onClick={() => setMapOnly((v) => !v)}
        aria-label={mapOnly ? "Tampilkan kontrol peta" : "Lihat peta penuh"}
        title={mapOnly ? "Tampilkan kontrol" : "Lihat peta penuh"}
        className="absolute bottom-3 right-3 z-[700] grid h-9 w-9 place-items-center rounded-full glass-panel text-fg shadow-lg hover:text-accent"
      >
        {mapOnly ? (
          <Minimize2 className="h-4 w-4" />
        ) : (
          <Maximize2 className="h-4 w-4" />
        )}
      </button>

      {/* toggle panel */}
      {!mapOnly && !panelOpen && (
        <button
          onClick={() => setPanelOpen(true)}
          type="button"
          className="absolute top-3 right-3 z-[500] rounded-xl glass-panel p-2.5 text-fg hover:bg-white/5"
          aria-label="Buka panel monev"
        >
          <SlidersHorizontal className="h-5 w-5 text-accent" />
        </button>
      )}

      {/* panel kontrol */}
      {!mapOnly && panelOpen && (
        <div className="absolute top-3 right-3 z-[500] w-64 max-w-[calc(100%-1.5rem)] max-h-[80vh] overflow-y-auto rounded-2xl glass-panel p-4 theme-transition sm:w-72 [scrollbar-width:thin]">
          <div className="mb-4 flex items-center justify-between gap-2 border-b border-card-border pb-2">
            <div className="flex items-center gap-2">
              <Satellite className="h-4 w-4 text-accent" />
              <h3 className="text-sm font-semibold text-fg">Monev Map</h3>
            </div>
            <button
              onClick={() => setPanelOpen(false)}
              type="button"
              className="rounded-lg p-1 text-fg-muted hover:bg-white/10 hover:text-fg"
              aria-label="Tutup panel monev"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* status gunung sumber abu */}
          {plumeSource && (
            <div className="mb-3 flex items-start gap-2 rounded-xl border border-card-border bg-black/20 p-2.5">
              <Flame
                className="mt-0.5 h-4 w-4 shrink-0"
                style={{ color: ALERT_LEVELS[plumeSource.level].color }}
              />
              <div className="text-[11px]">
                <p className="font-bold text-fg">{plumeSource.name}</p>
                <p className="text-fg-muted">
                  Status{" "}
                  {plumeSource.status ||
                    ALERT_LEVELS[plumeSource.level].shortLabel}{" "}
                  — kerucut ungu = arah sebaran abu
                </p>
              </div>
            </div>
          )}

          {/* overlay citra satelit & model cuaca ala Zoom Earth */}
          <div className="mb-4 space-y-2">
            <label className="flex items-center gap-1.5 text-xs font-medium text-fg-muted">
              <CloudSun className="h-3.5 w-3.5" /> Cuaca & Citra Satelit
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {OVERLAY_GROUPS.map((g) => (
                <label key={g.label} className="block">
                  <span className="mb-0.5 block text-[9px] font-semibold uppercase tracking-wide text-fg-muted">
                    {g.label}
                  </span>
                  <select
                    value={
                      g.options.some((o) => o.key === overlay)
                        ? overlay
                        : "none"
                    }
                    onChange={(e) => setOverlay(e.target.value as OverlayKey)}
                    className="w-full rounded-lg border border-card-border bg-white/5 px-1.5 py-1.5 text-[10px] font-semibold text-fg outline-none focus:border-accent [&>option]:bg-zinc-900"
                  >
                    {g.options.map((o) => (
                      <option key={o.key} value={o.key}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
            <p className="text-[10px] leading-relaxed text-fg-muted">
              {overlay === "none" &&
                "Overlay nonaktif. Pilih layer — satu overlay aktif seperti Zoom Earth."}
              {isGibsOverlay(overlay) &&
                `${GIBS_LAYERS[overlay].label} — ${
                  overlay === "satellite"
                    ? "real-time tiap ~10 menit"
                    : "data harian terbaru (jeda ~1–2 hari)"
                }. Sumber: NASA GIBS.`}
              {overlay === "radar" &&
                (radarUrl
                  ? "Radar hujan komposit global, update ~10 menit. Sumber: RainViewer."
                  : "Memuat tile radar RainViewer...")}
              {isWeatherOverlay(overlay) &&
                (grid
                  ? `${WEATHER_LAYERS[overlay].label} — model Open-Meteo saat ini, grid Asia Tenggara.`
                  : gridErr
                    ? "Gagal memuat data model Open-Meteo."
                    : "Memuat grid model Open-Meteo...")}
            </p>

            {/* linimasa animasi — hanya layer GIBS */}
            {isGibsOverlay(overlay) && (
              <div className="space-y-1.5 rounded-xl border border-card-border bg-black/20 p-2.5">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (!playing && frameIdx === -1) setFrameIdx(0);
                      setPlaying((p) => !p);
                    }}
                    aria-label={playing ? "Jeda animasi" : "Putar animasi"}
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent/15 text-accent transition-colors hover:bg-accent/25"
                  >
                    {playing ? (
                      <Pause className="h-3.5 w-3.5" />
                    ) : (
                      <Play className="h-3.5 w-3.5" />
                    )}
                  </button>
                  <input
                    type="range"
                    min={0}
                    max={Math.max(frames.length - 1, 0)}
                    step={1}
                    value={frameIdx === -1 ? frames.length - 1 : frameIdx}
                    onChange={(e) => {
                      setPlaying(false);
                      setFrameIdx(Number(e.target.value));
                    }}
                    aria-label="Linimasa citra satelit"
                    className="h-1 min-w-0 flex-1 cursor-pointer accent-sky-400"
                  />
                </div>
                <p className="text-center text-[10px] font-semibold text-fg">
                  {frameIdx === -1
                    ? "Data terbaru — geser slider untuk melihat waktu lampau"
                    : frameLabel(overlayTime)}
                </p>
              </div>
            )}

            {/* colorbar legenda — hanya layer model cuaca */}
            {isWeatherOverlay(overlay) && grid && (
              <div className="space-y-0.5 rounded-xl border border-card-border bg-black/20 p-2.5">
                <div
                  className="h-2 w-full rounded-full"
                  style={{ background: colorbarCss(overlay) }}
                />
                <div className="flex justify-between text-[9px] font-semibold text-fg-muted">
                  <span>
                    {WEATHER_LAYERS[overlay].min}
                    {WEATHER_LAYERS[overlay].unit}
                  </span>
                  <span className="text-fg">
                    {WEATHER_LAYERS[overlay].label}
                  </span>
                  <span>
                    {WEATHER_LAYERS[overlay].max}
                    {WEATHER_LAYERS[overlay].unit}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* info angin + boost */}
          <div className="mb-4 space-y-1.5">
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
              Simulasi angin ({windBoost}%) — sumber: Open-Meteo
            </p>
          </div>

          {/* arah sebaran abu */}
          <div className="mb-4">
            <label className="mb-2 flex items-center gap-1.5 text-xs font-medium text-fg-muted">
              <Navigation className="h-3.5 w-3.5" /> Arah Sebaran Abu
            </label>
            <div className="grid grid-cols-5 gap-1.5">
              {ASH_DIRECTIONS.map((dir) => (
                <button
                  key={dir}
                  onClick={() => setAshDirection(dir)}
                  type="button"
                  className={`min-w-0 rounded-lg px-1 py-1.5 text-[9px] font-semibold transition-all ${ashDirection === dir
                    ? "bg-accent text-bg font-bold shadow-[0_0_12px_var(--glow)]"
                    : "text-fg hover:bg-white/5"
                    }`}
                >
                  {dir === "AUTO" ? "Auto" : dir}
                </button>
              ))}
            </div>
          </div>

          {/* intensitas abu */}
          <div className="mb-4 space-y-1">
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
                className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${layers[l.key]
                  ? "bg-accent/15 text-accent"
                  : "bg-white/5 text-fg-muted hover:text-fg"
                  }`}
              >
                {l.label}
                <span
                  className={`h-2 w-2 rounded-full ${layers[l.key] ? "bg-accent" : "bg-white/20"
                    }`}
                />
              </button>
            ))}
          </div>

          <div className="mt-4 flex items-start gap-2 rounded-xl bg-black/20 p-2.5">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
            <p className="text-[11px] leading-relaxed text-fg-muted">
              {loading
                ? "Memuat data gunung api dan gempa..."
                : `Memantau ${volcanoes.length} gunung api, ${earthquakes.length} gempa, dan ${fireDetections.length} titik kebakaran.`}
            </p>
          </div>
          {!fireSourceStatus["NASA FIRMS"]?.configured && (
            <p className="mt-2 rounded-lg border border-amber-400/20 bg-amber-400/5 px-2.5 py-2 text-[10px] leading-relaxed text-amber-200">
              Hotspot satelit belum diaktifkan. Marker saat ini berasal dari laporan PetaBencana.
            </p>
          )}
        </div>
      )}

      {/* legenda — bisa disembunyikan */}
      {!mapOnly && !legendOpen && (
        <button
          type="button"
          onClick={() => setLegendOpen(true)}
          aria-label="Tampilkan legenda"
          className="absolute bottom-3 left-3 z-[500] grid h-9 w-9 place-items-center rounded-full glass-panel text-fg shadow-lg hover:text-accent"
        >
          <Info className="h-4 w-4" />
        </button>
      )}
      {!mapOnly && legendOpen && (
        <div className="absolute bottom-3 left-3 z-[500] space-y-1 rounded-xl glass-panel px-3 py-2 text-[10px] shadow-lg">
          <div className="flex items-center justify-between gap-3">
            <p className="font-bold text-fg">Legenda</p>
            <button
              type="button"
              onClick={() => setLegendOpen(false)}
              aria-label="Sembunyikan legenda"
              className="grid h-5 w-5 place-items-center rounded-md text-fg-muted hover:bg-white/10 hover:text-fg"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
          <p className="flex items-center gap-1.5 text-fg-muted">
            <Flame className="h-3 w-3 text-orange-400" /> Gunung (warna = status)
          </p>
          <p className="flex items-center gap-1.5 text-fg-muted">
            <Activity className="h-3 w-3 text-orange-500" /> Ring gempa ∝ magnitude
          </p>
          <p className="flex items-center gap-1.5 text-fg-muted">
            <Flame className="h-3 w-3 text-red-500" /> Api: merah tinggi/laporan, oranye sedang, kuning rendah
          </p>
          <p className="flex items-center gap-1.5 text-fg-muted">
            <Flame className="h-3 w-3 text-emerald-500" /> Api hijau = terkonfirmasi silang multi-sumber
          </p>
          <p className="flex items-center gap-1.5 text-fg-muted">
            <Wind className="h-3 w-3 text-sky-400" /> Aliran angin real-time
          </p>
          <p className="flex items-center gap-1.5 text-fg-muted">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-purple-500/40" />
            Kerucut = sebaran abu
          </p>
          <p className="flex items-center gap-1.5 text-fg-muted">
            <Route className="h-3 w-3 text-emerald-400" /> Jalur evakuasi
          </p>
          <p className="flex items-center gap-1.5 text-fg-muted">
            <MapPin className="h-3 w-3 text-yellow-400" /> Lokasi kamu — klik titik untuk detail & Google Maps
          </p>
        </div>
      )}

      {loading && !mapOnly && (
        <div className="absolute inset-x-0 top-3 z-[500] mx-auto w-fit rounded-full glass-panel px-4 py-1.5 text-xs text-fg-muted shadow-lg">
          Memuat data BMKG &amp; PVMBG...
        </div>
      )}
    </div>
  );
}
