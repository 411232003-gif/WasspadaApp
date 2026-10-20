/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ExternalLink,
  Flame,
  Loader2,
  MapPin,
  ShieldAlert,
  ShieldCheck,
  X,
} from "lucide-react";
import { reverseGeocode } from "@/lib/place-name";
import {
  haversineKm,
  levelFromEarthquake,
  type Earthquake,
  type Volcano,
} from "@/lib/live-api";
import type { FireDetection } from "@/lib/fire-detections";
import { ALERT_LEVELS } from "@/lib/alert-context";
import {
  GIBS_CREDIT,
  GIBS_LAYERS,
  gibsTileUrl,
  type GibsLayerKey,
} from "@/lib/gibs";

/* ---------- pemuat Cesium UMD (satu kali) ---------- */
let cesiumPromise: Promise<any> | null = null;
function loadCesium(): Promise<any> {
  if (!cesiumPromise) {
    cesiumPromise = new Promise((resolve, reject) => {
      const w = window as any;
      if (w.Cesium) return resolve(w.Cesium);
      w.CESIUM_BASE_URL = "/cesium/";
      if (!document.querySelector('link[href*="widgets.css"]')) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = "/cesium/Widgets/widgets.css";
        document.head.appendChild(link);
      }
      const s = document.createElement("script");
      s.src = "/cesium/Cesium.js";
      s.onload = () => resolve((window as any).Cesium);
      s.onerror = () => reject(new Error("Gagal memuat CesiumJS"));
      document.head.appendChild(s);
    });
  }
  return cesiumPromise;
}

const TILE_URLS: Record<string, { url: string; credit: string }> = {
  osm: {
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    credit: "© OpenStreetMap contributors",
  },
  "esri-street": {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
    credit: "© Esri | OpenStreetMap, Garmin, FAO, NOAA, USGS",
  },
  "esri-sat": {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    credit: "© Esri | Maxar, Earthstar Geographics",
  },
};

export interface GlobeLayers {
  volcanoes: boolean;
  earthquakes: boolean;
  fires: boolean;
  krb: boolean;
  wind: boolean;
  plume: boolean;
  evacuation: boolean;
  kelurahan: boolean;
}

export interface GlobeInfo {
  title: string;
  source: string;
  verified: boolean;
  lines: string[];
  lat: number;
  lon: number;
}

interface Props {
  volcanoes: Volcano[];
  earthquakes: Earthquake[];
  fires: FireDetection[];
  center: [number, number];
  centerName: string;
  safeZone: [number, number];
  plume: [number, number][];
  windLines: [number, number][][];
  /** pusat zona KRB (sumber abu / fallback lokasi pantauan) */
  krbCenter: [number, number] | null;
  layers: GlobeLayers;
  tileProvider: "osm" | "esri-street" | "esri-sat";
  /** overlay citra satelit NASA GIBS */
  satLayer: GibsLayerKey;
}

function fireColorHex(d: FireDetection): string {
  if ((d.verifiedBy?.length ?? 0) > 0) return "#22c55e";
  if (d.confidence === "high" || d.confidence === "reported") return "#ef4444";
  if (d.confidence === "medium") return "#f97316";
  return "#eab308";
}

/** Kartu info saat titik diklik — teks solid 100%, bukan transparan. */
function GlobeInfoCard({
  info,
  onClose,
}: {
  info: GlobeInfo;
  onClose: () => void;
}) {
  const [place, setPlace] = useState<string | null>(null);
  const [placeLoading, setPlaceLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    reverseGeocode(info.lat, info.lon)
      .then((name) => {
        if (alive) setPlace(name);
      })
      .finally(() => {
        if (alive) setPlaceLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [info.lat, info.lon]);

  return (
    <div className="absolute bottom-3 left-3 right-3 z-[600] max-w-sm rounded-2xl border border-white/15 bg-zinc-950/95 p-4 shadow-2xl sm:right-auto">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-bold leading-snug text-white">
            {info.title}
          </p>
          <p className="mt-0.5 text-[11px] font-semibold text-white">
            Sumber: {info.source}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup info"
          className="shrink-0 rounded-lg p-1 text-white/70 hover:bg-white/10 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <p
        className="mt-2 text-[12px] font-bold"
        style={{ color: info.verified ? "#4ade80" : "#fbbf24" }}
      >
        {info.verified
          ? "✓ Terkonfirmasi silang multi-sumber"
          : "Belum terkonfirmasi sumber lain"}
      </p>

      <ul className="mt-2 space-y-1 text-[12px] leading-relaxed text-white">
        {info.lines.map((line, i) => (
          <li key={i}>{line}</li>
        ))}
        <li>
          {placeLoading
            ? "Mencari nama lokasi..."
            : `Lokasi: ${place ?? "tidak dikenal"}`}
        </li>
        <li>
          Koordinat: {info.lat.toFixed(4)}, {info.lon.toFixed(4)}
        </li>
      </ul>

      <a
        href={`https://www.google.com/maps?q=${info.lat},${info.lon}`}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-sky-500/20 px-3 py-1.5 text-[12px] font-bold text-sky-300 hover:bg-sky-500/30"
      >
        <ExternalLink className="h-3.5 w-3.5" />
        Buka di Google Maps
      </a>
    </div>
  );
}

export default function CesiumGlobe({
  volcanoes,
  earthquakes,
  fires,
  center,
  centerName,
  safeZone,
  plume,
  windLines,
  krbCenter,
  layers,
  tileProvider,
  satLayer,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null);
  const dataSourceRef = useRef<any>(null);
  const overlayRef = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<GlobeInfo | null>(null);

  /* ---------- tingkat ancaman di sekitar lokasi pantauan ---------- */
  const threats = useMemo(() => {
    const list: { label: string; level: 1 | 2; dist: number }[] = [];
    for (const v of volcanoes) {
      if (v.lat == null || v.lon == null || v.level < 3) continue;
      const d = haversineKm(center, [v.lat, v.lon]);
      if (d <= 100) {
        list.push({
          label: `${v.name} (${v.status || ALERT_LEVELS[v.level].shortLabel})`,
          level: d <= 15 ? 2 : 1,
          dist: d,
        });
      }
    }
    for (const e of earthquakes) {
      if (!e.coordinates || (e.magnitude ?? 0) < 5) continue;
      const d = haversineKm(center, e.coordinates);
      if (d <= 300) {
        list.push({
          label: `Gempa M${e.magnitude} — ${e.location ?? ""}`,
          level: d <= 100 && (e.magnitude ?? 0) >= 5.5 ? 2 : 1,
          dist: d,
        });
      }
    }
    for (const f of fires) {
      const d = haversineKm(center, f.coordinates);
      if (d <= 25) {
        list.push({
          label: `Titik api ${f.source} — ${f.title}`,
          level: d <= 8 ? 2 : 1,
          dist: d,
        });
      }
    }
    return list.sort((a, b) => b.level - a.level || a.dist - b.dist).slice(0, 5);
  }, [volcanoes, earthquakes, fires, center]);

  const threatLevel: number = threats[0]?.level ?? 0;
  const threatColor =
    threatLevel === 2 ? "#ef4444" : threatLevel === 1 ? "#f97316" : "#22c55e";

  /* ---------- inisialisasi viewer ---------- */
  useEffect(() => {
    let cancelled = false;
    let viewer: any;
    let handler: any;

    loadCesium()
      .then((Cesium) => {
        if (cancelled || !containerRef.current) return;

        viewer = new Cesium.Viewer(containerRef.current, {
          baseLayer: false,
          animation: false,
          timeline: false,
          geocoder: false,
          homeButton: false,
          baseLayerPicker: false,
          sceneModePicker: true,
          navigationHelpButton: false,
          fullscreenButton: false,
          infoBox: false,
          selectionIndicator: false,
        });
        viewerRef.current = viewer;

        viewer.scene.globe.baseColor = Cesium.Color.BLACK;
        viewer.scene.globe.showGroundAtmosphere = true;
        viewer.scene.skyAtmosphere.show = true;
        viewer.camera.setView({
          destination: Cesium.Cartesian3.fromDegrees(
            center[1],
            center[0],
            1200000
          ),
        });

        dataSourceRef.current = new Cesium.CustomDataSource("wasspada");
        viewer.dataSources.add(dataSourceRef.current);

        handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
        handler.setInputAction((movement: any) => {
          const picked = viewer.scene.pick(movement.position);
          const info = picked?.id?.wasspadaInfo as GlobeInfo | undefined;
          setSelected(info ?? null);
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

        if (!cancelled) setReady(true);
      })
      .catch((e) => setLoadError(e instanceof Error ? e.message : "Error"));

    return () => {
      cancelled = true;
      handler?.destroy();
      if (viewer && !viewer.isDestroyed()) viewer.destroy();
      viewerRef.current = null;
      dataSourceRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- basemap ---------- */
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;
    loadCesium().then((Cesium) => {
      const tile = TILE_URLS[tileProvider] ?? TILE_URLS["esri-sat"];
      viewer.imageryLayers.removeAll(true);
      viewer.imageryLayers.addImageryProvider(
        new Cesium.UrlTemplateImageryProvider({
          url: tile.url,
          credit: tile.credit,
        })
      );
    });
  }, [tileProvider, ready]);

  /* ---------- overlay citra satelit NASA GIBS ---------- */
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;
    loadCesium().then((Cesium) => {
      if (overlayRef.current) {
        viewer.imageryLayers.remove(overlayRef.current, true);
        overlayRef.current = null;
      }
      if (satLayer === "none") return;
      const def = GIBS_LAYERS[satLayer];
      const layer = viewer.imageryLayers.addImageryProvider(
        new Cesium.UrlTemplateImageryProvider({
          url: gibsTileUrl(def),
          credit: GIBS_CREDIT,
          maximumLevel: def.maxZoom,
          tilingScheme: new Cesium.WebMercatorTilingScheme(),
        })
      );
      layer.alpha = def.alpha;
      overlayRef.current = layer;
    });
  }, [satLayer, ready]);

  /* ---------- kamera mengikuti lokasi pantauan ---------- */
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;
    loadCesium().then((Cesium) => {
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(
          center[1],
          center[0],
          900000
        ),
        duration: 1.6,
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center[0], center[1], ready]);

  /* ---------- bangun ulang seluruh entitas ---------- */
  useEffect(() => {
    const viewer = viewerRef.current;
    const ds = dataSourceRef.current;
    if (!viewer || viewer.isDestroyed() || !ds) return;

    loadCesium().then((Cesium) => {
      ds.entities.removeAll();
      const fromCss = (hex: string, alpha = 1) =>
        Cesium.Color.fromCssColorString(hex).withAlpha(alpha);
      const deg = (lat: number, lon: number) =>
        Cesium.Cartesian3.fromDegrees(lon, lat);
      const addPoint = (
        lat: number,
        lon: number,
        hex: string,
        px: number,
        info: GlobeInfo,
        outline = true
      ) => {
        const e = ds.entities.add({
          position: deg(lat, lon),
          point: {
            pixelSize: px,
            color: fromCss(hex),
            outlineColor: outline
              ? Cesium.Color.WHITE.withAlpha(0.9)
              : Cesium.Color.TRANSPARENT,
            outlineWidth: outline ? 1.5 : 0,
          },
        });
        e.wasspadaInfo = info;
        return e;
      };
      const addRing = (
        lat: number,
        lon: number,
        radiusKm: number,
        hex: string,
        fillAlpha = 0.12
      ) =>
        ds.entities.add({
          position: deg(lat, lon),
          ellipse: {
            semiMajorAxis: radiusKm * 1000,
            semiMinorAxis: radiusKm * 1000,
            material: fromCss(hex, fillAlpha),
            outline: true,
            outlineColor: fromCss(hex, 0.85),
            outlineWidth: 2,
          },
        });

      /* lokasi pantauan + cincin ancaman */
      if (layers.kelurahan) {
        addPoint(center[0], center[1], "#facc15", 11, {
          title: centerName || "Lokasi Pantauan",
          source: "WasspadaApp",
          verified: true,
          lines: ["Titik pemantauan utama kelurahan/desa."],
          lat: center[0],
          lon: center[1],
        });
        addRing(center[0], center[1], 12, threatColor, 0.1);
      }

      /* gunung api + KRB */
      if (layers.volcanoes) {
        for (const v of volcanoes) {
          if (v.lat == null || v.lon == null) continue;
          const color = ALERT_LEVELS[v.level]?.color ?? "#f97316";
          addPoint(v.lat, v.lon, color, 10 + v.level, {
            title: v.name,
            source: "PVMBG / MAGMA Indonesia",
            verified: true,
            lines: [
              `Status: ${v.status || ALERT_LEVELS[v.level].shortLabel}`,
              v.region ? `Wilayah: ${v.region}` : "",
            ].filter(Boolean),
            lat: v.lat,
            lon: v.lon,
          });
        }
      }

      /* zona KRB di sekitar sumber abu */
      if (layers.krb && krbCenter) {
        for (const z of [
          { km: 3, c: "#ef4444" },
          { km: 5, c: "#fb923c" },
          { km: 8, c: "#facc15" },
        ]) {
          addRing(krbCenter[0], krbCenter[1], z.km, z.c, 0.08);
        }
      }

      /* gempa + radius dampak ∝ magnitude */
      if (layers.earthquakes) {
        for (const e of earthquakes) {
          if (!e.coordinates) continue;
          const [lat, lon] = e.coordinates;
          const level = levelFromEarthquake(e.magnitude ?? 0);
          const color = ALERT_LEVELS[level]?.color ?? "#f97316";
          const mag = e.magnitude ?? 0;
          const radius = Math.min(
            Math.max(mag * 2.5 * Math.max(0.3, 1 - (e.depthKm ?? 0) / 300), 3),
            40
          );
          addPoint(lat, lon, color, 9, {
            title: `Gempa M${e.magnitude ?? "-"}`,
            source: "BMKG",
            verified: true,
            lines: [
              e.location ?? "",
              `Kedalaman ${e.depthKm ?? "-"} km — radius dampak ~${radius.toFixed(1)} km`,
              e.timestamp
                ? new Date(e.timestamp).toLocaleString("id-ID", {
                    dateStyle: "medium",
                    timeStyle: "short",
                    timeZone: "Asia/Jakarta",
                  })
                : "",
            ].filter(Boolean),
            lat,
            lon,
          });
          addRing(lat, lon, radius, color, 0.08);
        }
      }

      /* titik api — warna sesuai keyakinan/verifikasi */
      if (layers.fires) {
        for (const f of fires) {
          const [lat, lon] = f.coordinates;
          const verified = (f.verifiedBy?.length ?? 0) > 0;
          addPoint(lat, lon, fireColorHex(f), verified ? 10 : 8, {
            title: f.title,
            source: f.source,
            verified,
            lines: [
              verified
                ? `Sesuai ${f.verifiedBy!.join(" + ")}${
                    f.verifyDistanceKm != null
                      ? ` (~${f.verifyDistanceKm.toFixed(1)} km)`
                      : ""
                  }`
                : f.source === "PetaBencana"
                  ? "Laporan warga — belum ada konfirmasi satelit"
                  : "Deteksi satelit — perlu verifikasi lapangan",
              new Date(f.detectedAt).toLocaleString("id-ID", {
                dateStyle: "medium",
                timeStyle: "short",
                timeZone: "Asia/Jakarta",
              }),
              f.frp != null ? `Daya radiasi: ${f.frp.toFixed(1)} MW` : "",
              f.detail ?? "",
            ].filter(Boolean),
            lat,
            lon,
          });
        }
      }

      /* jalur evakuasi + zona aman */
      if (layers.evacuation) {
        ds.entities.add({
          polyline: {
            positions: Cesium.Cartesian3.fromDegreesArray([
              center[1],
              center[0],
              safeZone[1],
              safeZone[0],
            ]),
            width: 4,
            material: new Cesium.PolylineDashMaterialProperty({
              color: fromCss("#22c55e", 0.95),
            }),
          },
        });
        addRing(safeZone[0], safeZone[1], 0.5, "#22d3ee", 0.25);
        addPoint(safeZone[0], safeZone[1], "#22d3ee", 7, {
          title: "Zona Aman Evakuasi",
          source: "WasspadaApp",
          verified: true,
          lines: [
            `Jarak dari lokasi pantauan: ${haversineKm(center, safeZone).toFixed(1)} km`,
          ],
          lat: safeZone[0],
          lon: safeZone[1],
        });
      }

      /* kerucut abu */
      if (layers.plume && plume.length > 2) {
        ds.entities.add({
          polygon: {
            hierarchy: new Cesium.PolygonHierarchy(
              Cesium.Cartesian3.fromDegreesArray(
                plume.flatMap(([la, lo]) => [lo, la])
              )
            ),
            material: fromCss("#a855f7", 0.3),
            outline: true,
            outlineColor: fromCss("#a855f7", 0.9),
          },
        });
      }

      /* aliran angin */
      if (layers.wind) {
        for (const line of windLines) {
          ds.entities.add({
            polyline: {
              positions: Cesium.Cartesian3.fromDegreesArray(
                line.flatMap(([la, lo]) => [lo, la])
              ),
              width: 2.5,
              material: fromCss("#38bdf8", 0.7),
            },
          });
        }
      }
    });
  }, [
    ready,
    volcanoes,
    earthquakes,
    fires,
    center,
    centerName,
    safeZone,
    plume,
    windLines,
    krbCenter,
    layers,
    threatColor,
  ]);

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="absolute inset-0" />

      {!ready && !loadError && (
        <div className="absolute inset-0 z-[500] flex items-center justify-center gap-2 bg-black/60 text-white">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm font-semibold">Memuat globe 3D...</span>
        </div>
      )}
      {loadError && (
        <div className="absolute inset-0 z-[500] flex items-center justify-center bg-black/80 text-sm font-semibold text-red-300">
          {loadError}
        </div>
      )}

      {/* banner status ancaman — warna penuh, tegas */}
      <div
        className="absolute left-3 top-3 z-[600] flex max-w-[calc(100%-6rem)] items-start gap-2 rounded-xl border px-3 py-2 text-[12px] font-bold"
        style={{
          backgroundColor:
            threatLevel === 2
              ? "rgba(127,29,29,0.92)"
              : threatLevel === 1
                ? "rgba(124,45,18,0.92)"
                : "rgba(20,83,45,0.92)",
          borderColor: threatColor,
          color: "#ffffff",
        }}
      >
        {threatLevel === 0 ? (
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
        ) : (
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
        )}
        <span className="min-w-0">
          {threatLevel === 0 && "AMAN — tidak ada ancaman dalam radius pantau"}
          {threatLevel === 1 && "WASPADA — ancaman terdeteksi di sekitar lokasi"}
          {threatLevel === 2 && "BAHAYA — ancaman dekat terdeteksi!"}
          {threats.length > 0 && (
            <span className="mt-0.5 block text-[10px] font-semibold">
              {threats
                .map((t) => `${t.label} (~${t.dist.toFixed(0)} km)`)
                .join(" · ")}
            </span>
          )}
        </span>
      </div>

      {selected && (
        <GlobeInfoCard info={selected} onClose={() => setSelected(null)} />
      )}

      <p className="pointer-events-none absolute bottom-2 right-3 z-[500] flex items-center gap-1 text-[10px] font-semibold text-white/70">
        <MapPin className="h-3 w-3" />
        <Flame className="h-3 w-3" /> Klik titik untuk detail & lokasi
      </p>
    </div>
  );
}
