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
  Thermometer,
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
  sampleTemp,
  sampleWind,
  windRgba,
  WEATHER_RECT,
  type WeatherPoint,
} from "@/lib/weather-overlay";
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

const SAT_TILE = {
  url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  credit: "© Esri | Maxar, Earthstar Geographics",
};
/* label nama tempat + garis jalan di atas citra satelit — overlay
   referensi resmi Esri (pasangan resmi basemap "hybrid" Esri) */
const LABEL_TILE = {
  url: "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
  credit: "© Esri",
};
const ROAD_TILE = {
  url: "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}",
  credit: "© Esri",
};

export interface GlobeLayers {
  volcanoes: boolean;
  earthquakes: boolean;
  fires: boolean;
  krb: boolean;
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
  /** pusat zona KRB (sumber abu / fallback lokasi pantauan) */
  krbCenter: [number, number] | null;
  layers: GlobeLayers;
  /** sembunyikan semua UI overlay di atas globe (mode peta penuh) */
  mapOnly: boolean;
  /** gambar gradasi suhu menutupi kotak wilayah (null = mati) */
  tempImage?: { url: string; rect: typeof WEATHER_RECT } | null;
  /** grid vektor angin untuk animasi partikel (null/[] = mati) */
  windField?: WeatherPoint[] | null;
  /** grid cuaca untuk probe suhu saat peta diklik (null = mati) */
  probeGrid?: WeatherPoint[] | null;
  /** tampilkan banner status ancaman (dimatikan saat mode demo cuaca) */
  showBanner?: boolean;
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
  krbCenter,
  layers,
  mapOnly,
  tempImage = null,
  windField = null,
  probeGrid = null,
  showBanner = true,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null);
  const dataSourceRef = useRef<any>(null);
  const tempLayerRef = useRef<any>(null);
  const windCanvasRef = useRef<HTMLCanvasElement>(null);

  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<GlobeInfo | null>(null);
  const [bannerOpen, setBannerOpen] = useState(true);
  /* hasil probe suhu saat peta diklik pada area kosong */
  const [probe, setProbe] = useState<{
    lat: number;
    lon: number;
    temp: number;
    feels: number;
  } | null>(null);
  const [prevProbeGrid, setPrevProbeGrid] = useState(probeGrid);
  if (probeGrid !== prevProbeGrid) {
    setPrevProbeGrid(probeGrid);
    setProbe(null);
  }
  const probeGridRef = useRef(probeGrid);
  useEffect(() => {
    probeGridRef.current = probeGrid;
  }, [probeGrid]);

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

        /* HP layar retina → cap resolusi render 1.5x agar tidak ngelag */
        viewer.resolutionScale = Math.min(window.devicePixelRatio || 1, 1.5);

        viewer.scene.globe.baseColor = Cesium.Color.BLACK;
        viewer.scene.globe.showGroundAtmosphere = true;
        viewer.scene.skyAtmosphere.show = true;

        /* HEMAT CPU/GPU: render hanya saat ada perubahan (geser/data),
           bukan 60fps terus-menerus — solusi utama lag di laptop & HP */
        viewer.scene.requestRenderMode = true;
        viewer.scene.maximumRenderTimeChange = Infinity;

        dataSourceRef.current = new Cesium.CustomDataSource("wasspada");
        viewer.dataSources.add(dataSourceRef.current);

        /* clustering: titik yang bertumpuk digabung jadi pin bernomor —
           zoom out terlihat jumlah, zoom in terpisah sendiri-sendiri */
        const cds = dataSourceRef.current;
        cds.clustering.enabled = true;
        cds.clustering.pixelRange = 44;
        cds.clustering.minimumClusterSize = 4;
        cds.clustering.clusterBillboards = true;
        cds.clustering.clusterLabels = true;
        cds.clustering.clusterPoints = true;
        const pinCache = new Map<number, HTMLCanvasElement>();
        const clusterPin = (n: number) => {
          let c = pinCache.get(n);
          if (!c) {
            c = document.createElement("canvas");
            c.width = c.height = 64;
            const g = c.getContext("2d");
            if (g) {
              g.beginPath();
              g.arc(32, 32, 28, 0, Math.PI * 2);
              g.fillStyle = "rgba(234,88,12,0.95)";
              g.fill();
              g.lineWidth = 4;
              g.strokeStyle = "#ffffff";
              g.stroke();
              g.font = "bold 28px sans-serif";
              g.textAlign = "center";
              g.textBaseline = "middle";
              g.fillStyle = "#ffffff";
              g.fillText(String(n), 32, 33);
            }
            pinCache.set(n, c);
          }
          return c;
        };
        cds.clustering.clusterEvent.addEventListener(
          (ents: any[], cluster: any) => {
            cluster.label.show = false;
            cluster.billboard.show = true;
            cluster.billboard.image = clusterPin(ents.length);
            cluster.billboard.width = 34;
            cluster.billboard.height = 34;
            cluster.billboard.verticalOrigin = Cesium.VerticalOrigin.CENTER;
            cluster.billboard.disableDepthTestDistance =
              Number.POSITIVE_INFINITY;
          }
        );

        handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
        handler.setInputAction((movement: any) => {
          /* drillPick memeriksa SEMUA objek di titik klik —
             billboard cluster sering terlewat oleh pick biasa */
          const pickedList = viewer.scene.drillPick(movement.position);
          const picked = pickedList?.[0];
          /* pin cluster = billboard/label tanpa wasspadaInfo */
          let clusterPos: any = null;
          for (const p of pickedList ?? []) {
            const pid = p?.id ?? p?.primitive?.id;
            if (
              pid &&
              !pid.wasspadaInfo &&
              (pid.billboard || pid.label || pid.clusteredEntities)
            ) {
              clusterPos = pid;
              break;
            }
          }
          if (clusterPos) {
            const pos =
              clusterPos.position?.getValue?.(viewer.clock.currentTime) ??
              viewer.camera.pickEllipsoid(
                movement.position,
                viewer.scene.globe.ellipsoid
              );
            if (pos) {
              const c = Cesium.Cartographic.fromCartesian(pos);
              const height = Math.max(
                150000,
                viewer.camera.positionCartographic.height * 0.35
              );
              viewer.camera.flyTo({
                destination: Cesium.Cartesian3.fromRadians(
                  c.longitude,
                  c.latitude,
                  height
                ),
                duration: 1.1,
              });
            }
            setSelected(null);
            setProbe(null);
            return;
          }
          const pid = picked?.id ?? picked?.primitive?.id;
          const info = pid?.wasspadaInfo as GlobeInfo | undefined;
          setSelected(info ?? null);
          /* probe suhu saat klik area kosong pada mode Suhu */
          if (info) {
            setProbe(null);
            return;
          }
          const grid = probeGridRef.current;
          if (grid && grid.length) {
            const cart = viewer.camera.pickEllipsoid(
              movement.position,
              viewer.scene.globe.ellipsoid
            );
            if (cart) {
              const c = Cesium.Cartographic.fromCartesian(cart);
              const lat = Cesium.Math.toDegrees(c.latitude);
              const lon = Cesium.Math.toDegrees(c.longitude);
              const t = sampleTemp(grid, lat, lon);
              if (t != null) {
                setProbe({ lat, lon, temp: t.temp, feels: t.feels });
                return;
              }
            }
          }
          setProbe(null);
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
  }, []);

  /* ---------- basemap citra satelit (tetap Esri World Imagery) ---------- */
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;
    loadCesium().then((Cesium) => {
      const tile = SAT_TILE;
      viewer.imageryLayers.removeAll(true);
      viewer.imageryLayers.addImageryProvider(
        new Cesium.UrlTemplateImageryProvider({
          url: tile.url,
          credit: tile.credit,
        })
      );
      /* label nama tempat + garis jalan di atas citra satelit */
      for (const t of [LABEL_TILE, ROAD_TILE]) {
        viewer.imageryLayers.addImageryProvider(
          new Cesium.UrlTemplateImageryProvider({
            url: t.url,
            credit: t.credit,
          })
        );
      }
      viewer.scene.requestRender();
    });
  }, [ready]);

  /* ---------- overlay gradasi suhu (SingleTileImageryProvider) ---------- */
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;
    loadCesium().then((Cesium) => {
      if (tempLayerRef.current) {
        viewer.imageryLayers.remove(tempLayerRef.current, true);
        tempLayerRef.current = null;
      }
      if (!tempImage) {
        viewer.scene.requestRender();
        return;
      }
      const spec = tempImage;
      Promise.resolve(
        Cesium.SingleTileImageryProvider.fromUrl(spec.url, {
          rectangle: Cesium.Rectangle.fromDegrees(
            spec.rect.west,
            spec.rect.south,
            spec.rect.east,
            spec.rect.north
          ),
        })
      )
        .then((provider: any) => {
          if (viewer.isDestroyed() || tempImage !== spec) return;
          const layer = viewer.imageryLayers.addImageryProvider(provider);
          layer.alpha = 0.65;
          tempLayerRef.current = layer;
          viewer.scene.requestRender();
        })
        .catch(() => {});
    });
  }, [tempImage, ready]);

  /* ---------- animasi partikel angin ala Zoom Earth ---------- */
  useEffect(() => {
    if (!windField || windField.length === 0 || !ready) return;
    const viewer = viewerRef.current;
    const canvas = windCanvasRef.current;
    if (!viewer || viewer.isDestroyed() || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let cancelled = false;
    let cleanupMove: (() => void) | null = null;
    let cleanupResize: (() => void) | null = null;

    loadCesium().then((Cesium) => {
      if (cancelled) return;
      const scene = viewer.scene;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const resize = () => {
        canvas.width = Math.max(1, Math.round(canvas.clientWidth * dpr));
        canvas.height = Math.max(1, Math.round(canvas.clientHeight * dpr));
      };
      resize();
      window.addEventListener("resize", resize);
      cleanupResize = () => window.removeEventListener("resize", resize);

      /* bersihkan jejak saat kamera mulai digeser agar tidak streak */
      const onMoveStart = () =>
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      viewer.camera.moveStart.addEventListener(onMoveStart);
      cleanupMove = () =>
        viewer.camera.moveStart.removeEventListener(onMoveStart);

      const { west, south, east, north } = WEATHER_RECT;
      const N = window.innerWidth < 768 ? 650 : 1700;
      const spawn = () => ({
        lat: south + Math.random() * (north - south),
        lon: west + Math.random() * (east - west),
        age: 0,
        max: 60 + Math.random() * 120,
        x: -1,
        y: -1,
      });
      const parts = Array.from({ length: N }, spawn);
      const ellipsoid = scene.globe.ellipsoid;
      const occluder = new Cesium.EllipsoidalOccluder(
        ellipsoid,
        Cesium.Cartesian3.ORIGIN
      );
      const scratch = new Cesium.Cartesian3();
      const toScreen =
        Cesium.SceneTransforms.worldToWindowCoordinates ??
        Cesium.SceneTransforms.wgs84ToWindowCoordinates;
      /* derajat/frame per m/s — disetel agar terasa seperti Zoom Earth */
      const K = 0.0045;
      const MAX_JUMP = 90 * dpr;

      const step = () => {
        if (cancelled) return;
        raf = requestAnimationFrame(step);
        /* jejak memudar */
        ctx.globalCompositeOperation = "destination-out";
        ctx.fillStyle = "rgba(0,0,0,0.15)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.globalCompositeOperation = "source-over";
        ctx.lineWidth = Math.max(0.8, dpr * 0.7);

        occluder.cameraPosition = scene.camera.position;
        const is3d = scene.mode === Cesium.SceneMode.SCENE3D;

        for (const p of parts) {
          const w = sampleWind(windField, p.lat, p.lon);
          p.age++;
          if (
            !w ||
            p.age > p.max ||
            p.lat < south ||
            p.lat > north ||
            p.lon < west ||
            p.lon > east
          ) {
            Object.assign(p, spawn());
            continue;
          }
          p.lat += w.v * K;
          p.lon += (w.u * K) / Math.max(0.2, Math.cos((p.lat * Math.PI) / 180));

          Cesium.Cartesian3.fromDegrees(p.lon, p.lat, 0, ellipsoid, scratch);
          const scr = toScreen(scene, scratch);
          const visible =
            scr && (!is3d || occluder.isPointVisible(scratch));
          if (!visible) {
            p.x = -1;
            continue;
          }
          const sx = scr.x * dpr;
          const sy = scr.y * dpr;
          if (p.x >= 0 && Math.hypot(sx - p.x, sy - p.y) < MAX_JUMP) {
            ctx.strokeStyle = windRgba(w.gust);
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(sx, sy);
            ctx.stroke();
          }
          p.x = sx;
          p.y = sy;
        }
      };
      raf = requestAnimationFrame(step);
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      cleanupMove?.();
      cleanupResize?.();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    };
  }, [windField, ready]);

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
      /* ikon SVG vektor berwarna — tidak bergantung font emoji OS */
      const ICON_FIRE = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><path d="M32 6c6 8 14 13 14 26 0 11-9 20-14 20s-14-9-14-20c0-6 2-11 5-14 1 6 4 9 7 10-1-9 4-18 8-22z" fill="#ff6a00" stroke="#fff" stroke-width="3" stroke-linejoin="round"/><path d="M32 24c3 5 7 8 7 15a7 7 0 11-14 0c0-4 2-7 4-9 1 4 3 6 5 7-1-6-1-9-2-13z" fill="#ffd500"/></svg>`
      )}`;
      const ICON_VOLCANO = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><path d="M6 54L24 20l6 8 8-14 20 40z" fill="#8d5524" stroke="#fff" stroke-width="3" stroke-linejoin="round"/><path d="M24 20l6 8-3 4-6-3z" fill="#fff"/><path d="M38 14l5 8-4 3-5-5z" fill="#fff"/></svg>`
      )}`;
      /* ikon di atas titik — ikut bisa diklik */
      const addIcon = (
        lat: number,
        lon: number,
        image: string,
        px: number,
        info: GlobeInfo
      ) => {
        const e = ds.entities.add({
          position: deg(lat, lon),
          billboard: {
            image,
            width: px,
            height: px,
            verticalOrigin: Cesium.VerticalOrigin.CENTER,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
        });
        e.wasspadaInfo = info;
        return e;
      };
      /* label teks di atas titik — ikut bisa diklik */
      const addMarkerLabel = (
        lat: number,
        lon: number,
        text: string,
        fontPx: number,
        info: GlobeInfo
      ) => {
        const e = ds.entities.add({
          position: deg(lat, lon),
          label: {
            text,
            font: `${fontPx}px sans-serif`,
            fillColor: Cesium.Color.WHITE,
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 3,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            pixelOffset: new Cesium.Cartesian2(0, -14),
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
        });
        e.wasspadaInfo = info;
        return e;
      };

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

      /* gunung api + KRB — ikon 🌋 agar mudah dikenali & diklik */
      if (layers.volcanoes) {
        for (const v of volcanoes) {
          if (v.lat == null || v.lon == null) continue;
          const info: GlobeInfo = {
            title: v.name,
            source: "PVMBG / MAGMA Indonesia",
            verified: true,
            lines: [
              `Status: ${v.status || ALERT_LEVELS[v.level].shortLabel}`,
              v.region ? `Wilayah: ${v.region}` : "",
            ].filter(Boolean),
            lat: v.lat,
            lon: v.lon,
          };
          addIcon(v.lat, v.lon, ICON_VOLCANO, 22, info);
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
          const eqInfo: GlobeInfo = {
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
          };
          addPoint(lat, lon, color, 12, eqInfo);
          addMarkerLabel(lat, lon, `M${(e.magnitude ?? 0).toFixed(1)}`, 11, eqInfo);
          addRing(lat, lon, radius, color, 0.08);
        }
      }

      /* titik api — ikon 🔥 besar agar mudah diklik */
      if (layers.fires) {
        for (const f of fires) {
          const [lat, lon] = f.coordinates;
          const verified = (f.verifiedBy?.length ?? 0) > 0;
          const info: GlobeInfo = {
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
          };
          addPoint(lat, lon, fireColorHex(f), verified ? 14 : 12, info);
          addIcon(lat, lon, ICON_FIRE, verified ? 22 : 18, info);
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
            "Estimasi arah menjauhi gunung — bukan titik evakuasi resmi BNPB",
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

      if (!viewer.isDestroyed()) viewer.scene.requestRender();
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
    krbCenter,
    layers,
    threatColor,
  ]);

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="absolute inset-0" />
      {/* canvas partikel angin — di atas globe, tidak menghalangi klik */}
      <canvas
        ref={windCanvasRef}
        className="pointer-events-none absolute inset-0 z-[400] h-full w-full"
      />

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

      {/* banner status ancaman — warna penuh, tegas, bisa ditutup */}
      {showBanner && !mapOnly && bannerOpen && (
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
          <button
            type="button"
            onClick={() => setBannerOpen(false)}
            aria-label="Sembunyikan status ancaman"
            className="ml-1 grid h-5 w-5 shrink-0 place-items-center rounded-md text-white/80 hover:bg-white/20 hover:text-white"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
      {showBanner && !mapOnly && !bannerOpen && (
        <button
          type="button"
          onClick={() => setBannerOpen(true)}
          aria-label="Tampilkan status ancaman"
          className="absolute left-3 top-3 z-[600] grid h-9 w-9 place-items-center rounded-full border shadow-lg"
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
            <ShieldCheck className="h-4 w-4" />
          ) : (
            <ShieldAlert className="h-4 w-4" />
          )}
        </button>
      )}

      {selected && (
        <GlobeInfoCard info={selected} onClose={() => setSelected(null)} />
      )}

      {/* kartu probe suhu — klik area kosong pada mode Suhu */}
      {probe && (
        <div className="absolute bottom-3 left-1/2 z-[650] flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/15 bg-zinc-950/95 px-4 py-2 shadow-xl">
          <Thermometer className="h-4 w-4 shrink-0 text-orange-400" />
          <span className="whitespace-nowrap text-[12px] font-bold text-white">
            {probe.temp.toFixed(1)}°C
            <span className="mx-1.5 text-[11px] font-semibold text-sky-300">
              terasa {probe.feels.toFixed(1)}°C
            </span>
            <span className="text-[10px] font-semibold text-white/70">
              {probe.lat.toFixed(2)}°, {probe.lon.toFixed(2)}°
            </span>
          </span>
          <button
            type="button"
            onClick={() => setProbe(null)}
            aria-label="Tutup info suhu"
            className="grid h-5 w-5 shrink-0 place-items-center rounded-md text-white/80 hover:bg-white/20"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {!mapOnly && (
        <p className="pointer-events-none absolute bottom-2 left-1/2 z-[500] flex -translate-x-1/2 items-center gap-1 whitespace-nowrap text-[10px] font-semibold text-white/70">
          <MapPin className="h-3 w-3" />
          <Flame className="h-3 w-3" /> Klik titik untuk detail & lokasi
        </p>
      )}
    </div>
  );
}
