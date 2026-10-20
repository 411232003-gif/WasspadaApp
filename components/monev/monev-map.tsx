"use client";

import "leaflet/dist/leaflet.css";
import "react-leaflet-cluster/dist/assets/MarkerCluster.css";
import "react-leaflet-cluster/dist/assets/MarkerCluster.Default.css";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
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
import MarkerClusterGroup from "react-leaflet-cluster";
import L from "leaflet";
import { useTheme } from "@/lib/theme-provider";
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
  cardinalFrom,
  cardinalTo,
  Volcano,
  Earthquake,
  levelFromEarthquake,
  type WindData,
} from "@/lib/live-api";
import type {
  FireConfidence,
  FireDetection,
  FireSourceStatus,
} from "@/lib/fire-detections";
import { reverseGeocode } from "@/lib/place-name";
import { GIBS_LAYERS, gibsTileUrl, type GibsLayerKey } from "@/lib/gibs";
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
  Globe2,
} from "lucide-react";

const CesiumGlobe = dynamic(() => import("./cesium-globe"), { ssr: false });

type Direction = "N" | "S" | "E" | "W";
type AshDirection = Direction | "AUTO";
type TileProvider = "osm" | "esri-street" | "esri-sat";

const DIRECTION_DEGREES: Record<Direction, number> = {
  N: 0,
  E: 90,
  S: 180,
  W: 270,
};
const ASH_DIRECTIONS: AshDirection[] = ["AUTO", "N", "E", "S", "W"];

const KRB_ZONES = [
  { km: 3, label: "KRB III", color: "#ef4444" },
  { km: 5, label: "KRB II", color: "#fb923c" },
  { km: 8, label: "KRB I", color: "#facc15" },
];
const MAX_FIRE_MARKERS = 250;

/* ---------- icon makers ---------- */
function getDotIcon(color: string) {
  return L.divIcon({
    className: "bg-transparent",
    html: `<div style="width:12px;height:12px;border-radius:50%;background:${color};box-shadow:0 0 10px ${color};border:2px solid rgba(255,255,255,0.4);"></div>`,
    iconSize: [12, 12],
    iconAnchor: [6, 6],
  });
}

function getVolcanoIcon(color: string, level: number) {
  const isActive = level >= 3;
  const size = level === 4 ? "1rem" : "0.75rem";
  return L.divIcon({
    className: "bg-transparent",
    html: `<div class="map-marker" style="--accent:${color}">
      <div class="map-marker-core" style="width:${size};height:${size};background-color:${color};box-shadow:0 0 10px ${color};"></div>
      ${isActive ? `<div class="map-marker-ring" style="border-color:${color};box-shadow:0 0 10px ${color};"></div>` : ""}
    </div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
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

function getFireIcon(confidence: FireConfidence, verified: boolean) {
  const level = verified
    ? "verified"
    : confidence === "reported"
      ? "reported"
      : confidence;
  return L.divIcon({
    className: "fire-marker-icon",
    html: `<span class="fire-marker fire-marker-${level}" aria-hidden="true"><span class="fire-marker-pulse"></span><span class="fire-marker-flame">🔥</span></span>`,
    iconSize: [38, 38],
    iconAnchor: [19, 19],
  });
}

function confidenceLabel(confidence: FireConfidence) {
  if (confidence === "reported") return "Laporan kejadian";
  if (confidence === "high") return "Keyakinan tinggi";
  if (confidence === "medium") return "Keyakinan sedang";
  return "Keyakinan rendah";
}

/** Konten popup titik api: status verifikasi, nama lokasi, link Google Maps.
 *  Reverse geocode dilakukan lazy — hanya saat popup dibuka — agar
 *  mematuhi rate limit Nominatim (maks 1 req/detik). */
function FirePopupContent({ detection }: { detection: FireDetection }) {
  const [lat, lon] = detection.coordinates;
  const [place, setPlace] = useState<string | null>(null);
  const [placeLoading, setPlaceLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    reverseGeocode(lat, lon)
      .then((name) => {
        if (alive) setPlace(name);
      })
      .finally(() => {
        if (alive) setPlaceLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [lat, lon]);

  const verified = (detection.verifiedBy?.length ?? 0) > 0;
  const statusText = verified
    ? "✓ Terkonfirmasi silang"
    : detection.source === "NASA FIRMS"
      ? "Indikasi satelit — perlu verifikasi lapangan"
      : detection.source === "NASA EONET"
        ? "Peristiwa kebakaran aktif (NASA EONET)"
        : "Laporan warga — belum ada konfirmasi satelit";

  return (
    <div className="text-bg min-w-44">
      <strong>{detection.title}</strong>
      <br />
      <b style={{ color: verified ? "#4ade80" : "#fbbf24" }}>{statusText}</b>
      {verified && (
        <>
          <br />
          <span style={{ fontSize: 10 }}>
            Sesuai {detection.verifiedBy!.join(" + ")}
            {detection.verifyDistanceKm != null &&
              ` (~${detection.verifyDistanceKm.toFixed(1)} km)`}
          </span>
        </>
      )}
      <br />
      {confidenceLabel(detection.confidence)}
      <br />
      {new Date(detection.detectedAt).toLocaleString("id-ID", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Jakarta",
      })}
      {detection.frp != null && (
        <>
          <br />
          Daya radiasi: {detection.frp.toFixed(1)} MW
        </>
      )}
      {detection.detail && (
        <>
          <br />
          {detection.detail}
        </>
      )}
      <br />
      {placeLoading
        ? "Mencari nama lokasi..."
        : `Sekitar: ${place ?? "lokasi tidak dikenal"}`}
      <br />
      {lat.toFixed(4)}, {lon.toFixed(4)}
      <br />
      <a
        href={`https://www.google.com/maps?q=${lat},${lon}`}
        target="_blank"
        rel="noopener noreferrer"
        style={{ color: "#38bdf8", fontWeight: 600 }}
      >
        Buka di Google Maps ↗
      </a>
    </div>
  );
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

function eqRadiusKm(m: number | null, depthKm: number | null) {
  const mag = m ?? 0;
  if (!mag) return 4;
  const depthFactor = Math.max(0.3, 1 - (depthKm ?? 0) / 300);
  return Math.min(Math.max(mag * 2.5 * depthFactor, 3), 40);
}

function MapCenter({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [map, center, zoom]);
  return null;
}

/* ---------- komponen utama ---------- */
export default function MonevMap() {
  const { theme } = useTheme();
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
  const [tileProvider, setTileProvider] = useState<TileProvider>(() => {
    const env = process.env.NEXT_PUBLIC_DEFAULT_TILE_PROVIDER as TileProvider;
    const allowed: TileProvider[] = ["osm", "esri-street", "esri-sat"];
    return allowed.includes(env) ? env : "esri-street";
  });
  const [viewMode, setViewMode] = useState<"2d" | "3d">("2d");
  const [satLayer, setSatLayer] = useState<GibsLayerKey>("none");
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
  const zoom = useMemo(() => (selectedKelurahan ? 12 : 5), [selectedKelurahan]);

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

  const tileConfig = useMemo(() => {
    if (tileProvider === "osm") {
      return {
        url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        subdomains: "abc",
      };
    }
    if (tileProvider === "esri-sat") {
      return {
        url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        attribution:
          '&copy; <a href="https://www.esri.com/">Esri</a> | Maxar, Earthstar Geographics',
        subdomains: "",
      };
    }
    return {
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
      attribution:
        '&copy; <a href="https://www.esri.com/">Esri</a> | &copy; OpenStreetMap, Garmin, FAO, NOAA, USGS',
      subdomains: "",
    };
  }, [tileProvider]);

  const accent = theme === "light" ? "#16a34a" : "#22c55e";

  const volcanoMarkers = useMemo(() => {
    return (volcanoes || [])
      .filter((v) => v.lat != null && v.lon != null)
      .map((v) => {
        const color = ALERT_LEVELS[v.level].color;
        return (
          <Marker
            key={`v-${v.name}`}
            position={[v.lat!, v.lon!] as [number, number]}
            icon={getVolcanoIcon(color, v.level)}
          >
            <Popup>
              <div className="text-bg">
                <strong>{v.name}</strong>
                <br />
                Status:{" "}
                <b style={{ color }}>
                  {v.status || ALERT_LEVELS[v.level].shortLabel}
                </b>
                <br />
                {v.region}
              </div>
            </Popup>
          </Marker>
        );
      });
  }, [volcanoes]);

  const earthquakeMarkers = useMemo(() => {
    return (earthquakes || []).map((e, i) => {
      const level = levelFromEarthquake(e.magnitude || 0);
      const color = ALERT_LEVELS[level].color;
      return (
        <Marker
          key={`e-${e.timestamp || e.location || i}`}
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

  const fireMarkers = useMemo(
    () =>
      visibleFireDetections.map((detection) => (
        <Marker
          key={detection.id}
          position={detection.coordinates}
          icon={getFireIcon(
            detection.confidence,
            (detection.verifiedBy?.length ?? 0) > 0
          )}
        >
          <Popup>
            <FirePopupContent detection={detection} />
          </Popup>
        </Marker>
      )),
    [visibleFireDetections]
  );

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
      {/* toggle peta 2D / globe 3D */}
      <div className="absolute bottom-3 right-3 z-[600] flex overflow-hidden rounded-xl border border-card-border shadow-lg">
        <button
          type="button"
          onClick={() => setViewMode("2d")}
          className={`px-3 py-2 text-[11px] font-bold transition-colors ${
            viewMode === "2d"
              ? "bg-accent text-bg"
              : "bg-zinc-950/90 text-white hover:text-accent"
          }`}
        >
          Peta 2D
        </button>
        <button
          type="button"
          onClick={() => setViewMode("3d")}
          className={`flex items-center gap-1 px-3 py-2 text-[11px] font-bold transition-colors ${
            viewMode === "3d"
              ? "bg-accent text-bg"
              : "bg-zinc-950/90 text-white hover:text-accent"
          }`}
        >
          <Globe2 className="h-3.5 w-3.5" />
          Globe 3D
        </button>
      </div>

      {viewMode === "3d" && (
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
          tileProvider={tileProvider}
          satLayer={satLayer}
        />
      )}

      {viewMode === "2d" && (
      <MapContainer
        center={center}
        zoom={zoom}
        scrollWheelZoom
        className={`h-full w-full ${shaking ? "shake-map" : ""}`}
      >
        <MapCenter center={center} zoom={zoom} />
        <TileLayer
          key={tileProvider}
          attribution={tileConfig.attribution}
          url={tileConfig.url}
          subdomains={tileConfig.subdomains}
        />

        {/* overlay citra satelit NASA GIBS (data ~2 hari lalu) */}
        {satLayer !== "none" && (
          <TileLayer
            key={`gibs-${satLayer}`}
            url={gibsTileUrl(GIBS_LAYERS[satLayer])}
            attribution="NASA GIBS / EOSDIS"
            opacity={GIBS_LAYERS[satLayer].alpha}
            maxNativeZoom={GIBS_LAYERS[satLayer].maxZoom}
            zIndex={10}
          />
        )}

        {/* posisi kelurahan/lokasi terpilih */}
        {layers.kelurahan && (
          <Marker position={center} icon={getKelurahanIcon()}>
            <Popup>
              <div className="text-bg">
                <strong>{selectedKelurahan?.name_local || "Lokasi Pantauan"}</strong>
                <br />
                {center[0].toFixed(4)}, {center[1].toFixed(4)}
              </div>
            </Popup>
          </Marker>
        )}

        {/* zona KRB di sekitar gunung sumber abu */}
        {layers.krb &&
          KRB_ZONES.map((z) => (
            <Circle
              key={z.km}
              center={plumeOrigin}
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

        {/* marker gunung api (cluster) */}
        {layers.volcanoes && volcanoMarkers.length > 0 && (
          <MarkerClusterGroup
            key="volcano-cluster"
            showCoverageOnHover={false}
            spiderfyDistanceMultiplier={2}
          >
            {volcanoMarkers}
          </MarkerClusterGroup>
        )}

        {/* gempa — marker cluster + ring radius ∝ magnitude */}
        {layers.earthquakes && earthquakeMarkers.length > 0 && (
          <MarkerClusterGroup
            key="earthquake-cluster"
            showCoverageOnHover={false}
            spiderfyDistanceMultiplier={2}
          >
            {earthquakeMarkers}
          </MarkerClusterGroup>
        )}
        {layers.fires && fireMarkers.length > 0 && (
          <MarkerClusterGroup
            key="fire-cluster"
            showCoverageOnHover={false}
            spiderfyDistanceMultiplier={2}
            maxClusterRadius={48}
          >
            {fireMarkers}
          </MarkerClusterGroup>
        )}
        {layers.earthquakes &&
          earthquakes.map((eq, i) => {
            if (!eq.coordinates) return null;
            const level = levelFromEarthquake(eq.magnitude || 0);
            const color = ALERT_LEVELS[level].color;
            return (
              <Circle
                key={`eqr-${eq.timestamp ?? i}`}
                center={eq.coordinates}
                radius={eqRadiusKm(eq.magnitude, eq.depthKm) * 1000}
                pathOptions={{
                  color,
                  weight: 1.5,
                  fillColor: color,
                  fillOpacity: 0.08,
                }}
              >
                <Popup>
                  <div className="text-bg">
                    <strong>Gempa M {eq.magnitude ?? "-"}</strong>
                    <br />
                    {eq.location}
                    <br />
                    Kedalaman {eq.depthKm ?? "-"} km — radius dampak ~
                    {eqRadiusKm(eq.magnitude, eq.depthKm).toFixed(1)} km
                    {eq.potential && (
                      <>
                        <br />
                        {eq.potential}
                      </>
                    )}
                  </div>
                </Popup>
              </Circle>
            );
          })}

        {/* aliran angin — garis dash beranimasi + panah */}
        {layers.wind &&
          windLines.map((line, i) => (
            <Polyline
              key={`wl-${i}`}
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

        {/* kerucut sebaran abu dari gunung terdekat/tertinggi */}
        {layers.plume && plumeSource && (
          <Polygon
            positions={plume}
            pathOptions={{
              color: "#a855f7",
              weight: 2,
              dashArray: "4 6",
              fillColor: "#a855f7",
              fillOpacity: 0.12 + (ashIntensity / 100) * 0.5,
            }}
          >
            <Tooltip sticky>
              Perkiraan sebaran abu {plumeSource.name} mengikuti angin ke{" "}
              {cardinalFrom(ashBearing)}
            </Tooltip>
          </Polygon>
        )}


        {/* jalur evakuasi ke zona aman */}
        {layers.evacuation && (
          <>
            <Polyline
              positions={[center, safeZoneCoords]}
              pathOptions={{
                color: accent,
                weight: 4,
                dashArray: "8 8",
                opacity: 0.9,
              }}
            />
            <Circle
              center={safeZoneCoords}
              radius={500}
              pathOptions={{
                color: "#22d3ee",
                fillColor: "#22d3ee",
                fillOpacity: 0.25,
                weight: 2,
              }}
            >
              <Popup>
                <div className="text-bg">
                  <strong>Zona Aman</strong>
                  <br />
                  {nearestVolcano
                    ? `Arah menjauhi ${nearestVolcano.item.name}`
                    : "Arah evakuasi perkiraan"}
                  <br />
                  Jarak: {haversineKm(center, safeZoneCoords).toFixed(1)} km
                </div>
              </Popup>
            </Circle>
          </>
        )}
      </MapContainer>
      )}

      {/* toggle panel */}
      {!panelOpen && (
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
      {panelOpen && (
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

          {/* basemap */}
          <div className="mb-4 space-y-2">
            <label className="flex items-center gap-1.5 text-xs font-medium text-fg-muted">
              <Satellite className="h-3.5 w-3.5" /> Basemap
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {(["esri-sat", "esri-street", "osm"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setTileProvider(p)}
                  className={`rounded-lg px-1 py-1.5 text-[10px] font-bold transition-colors ${tileProvider === p
                    ? "bg-accent/15 text-accent"
                    : "bg-white/5 text-fg-muted hover:text-fg"
                    }`}
                >
                  {p === "esri-sat" ? "Satelit" : p === "osm" ? "Standar" : "Jalan"}
                </button>
              ))}
            </div>
          </div>

          {/* layer citra satelit NASA */}
          <div className="mb-4 space-y-2">
            <label className="flex items-center gap-1.5 text-xs font-medium text-fg-muted">
              <Satellite className="h-3.5 w-3.5" /> Layer Satelit NASA
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={() => setSatLayer("none")}
                className={`rounded-lg px-1 py-1.5 text-[10px] font-bold transition-colors ${
                  satLayer === "none"
                    ? "bg-accent/15 text-accent"
                    : "bg-white/5 text-fg-muted hover:text-fg"
                }`}
              >
                Mati
              </button>
              {(Object.keys(GIBS_LAYERS) as (keyof typeof GIBS_LAYERS)[]).map(
                (key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSatLayer(key)}
                    className={`rounded-lg px-1 py-1.5 text-[10px] font-bold transition-colors ${
                      satLayer === key
                        ? "bg-accent/15 text-accent"
                        : "bg-white/5 text-fg-muted hover:text-fg"
                    }`}
                  >
                    {key === "aerosol"
                      ? "Asap"
                      : key === "co"
                        ? "CO"
                        : key === "precip"
                          ? "Hujan"
                          : "Warna Asli"}
                  </button>
                )
              )}
            </div>
            {satLayer !== "none" && (
              <p className="text-[10px] text-fg-muted">
                {GIBS_LAYERS[satLayer].label} — data harian terbaru (jeda ~1–2
                hari), sumber NASA GIBS.
              </p>
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
      {!legendOpen && (
        <button
          type="button"
          onClick={() => setLegendOpen(true)}
          aria-label="Tampilkan legenda"
          className="absolute bottom-3 left-3 z-[500] grid h-9 w-9 place-items-center rounded-full glass-panel text-fg shadow-lg hover:text-accent"
        >
          <Info className="h-4 w-4" />
        </button>
      )}
      {legendOpen && (
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
            <MapPin className="h-3 w-3 text-yellow-400" /> Lokasi kamu
          </p>
        </div>
      )}

      {loading && (
        <div className="absolute inset-x-0 top-3 z-[500] mx-auto w-fit rounded-full glass-panel px-4 py-1.5 text-xs text-fg-muted shadow-lg">
          Memuat data BMKG &amp; PVMBG...
        </div>
      )}
    </div>
  );
}
