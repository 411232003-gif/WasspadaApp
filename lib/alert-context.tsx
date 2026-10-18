"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
  useCallback,
  useRef,
  useSyncExternalStore,
} from "react";
import {
  fetchVolcanoes,
  fetchBMKG,
  haversineKm,
  levelFromEarthquake,
  Volcano,
  Earthquake,
  RegionEntity,
} from "./live-api";
import { useSmartPolling } from "./use-smart-polling";

export type AlertLevel = 1 | 2 | 3 | 4;

export interface AlertLevelConfig {
  level: AlertLevel;
  label: string;
  shortLabel: string;
  color: string;
  glow: string;
  recommendation: string;
  evacuationCue?: string;
}

export const ALERT_LEVELS: Record<AlertLevel, AlertLevelConfig> = {
  1: {
    level: 1,
    label: "Level I (Normal)",
    shortLabel: "Normal",
    color: "#22d3ee",
    glow: "rgba(34, 211, 238, 0.35)",
    recommendation:
      "Kondisi gunung api normal. Kegiatan masyarakat dapat berlangsung rutin. Pantau perkembangan melalui PVMBG.",
  },
  2: {
    level: 2,
    label: "Level II (Waspada)",
    shortLabel: "Waspada",
    color: "#facc15",
    glow: "rgba(250, 204, 21, 0.35)",
    recommendation:
      "Terdapat peningkatan aktivitas vulkanik atau seismik. Warga diimbau waspada dan tidak mendekati kawah.",
  },
  3: {
    level: 3,
    label: "Level III (Siaga)",
    shortLabel: "Siaga",
    color: "#fb923c",
    glow: "rgba(251, 146, 60, 0.35)",
    recommendation:
      "Peningkatan letusan terdeteksi. Warga di KRB III disarankan bersiap evakuasi mengikuti arahan PVMBG.",
    evacuationCue: "Bersiap evakuasi dari KRB III",
  },
  4: {
    level: 4,
    label: "Level IV (Awas)",
    shortLabel: "Awas",
    color: "#ef4444",
    glow: "rgba(239, 68, 68, 0.55)",
    recommendation:
      "Erupsi utama atau letusan dahsyat mengancam permukiman. Segera evakuasi ke titik aman sesuai arahan petugas!",
    evacuationCue: "SEGERA EVAKUASI",
  },
};

export const DEFAULT_CENTER: [number, number] = [-2.5489, 118.0149];

interface UserLocation {
  lat: number;
  lon: number;
}

interface Nearest<T> {
  item: T;
  distanceKm: number;
}

interface AlertContextValue {
  alertLevel: AlertLevel;
  setAlertLevel: (level: AlertLevel) => void;
  alertConfig: AlertLevelConfig;
  audioEnabled: boolean;
  setAudioEnabled: (enabled: boolean) => void;
  userLocation: UserLocation | null;
  locationError: string | null;
  requestUserLocation: () => void;
  userDistanceKm: number | null;
  userZone: string | null;
  isInDangerZone: boolean;
  isInKrb3: boolean;
  selectedKelurahan: RegionEntity | null;
  setSelectedKelurahan: (entity: RegionEntity | null) => void;
  disasterCenter: [number, number];
  nearestVolcano: Nearest<Volcano> | null;
  nearestEarthquake: Nearest<Earthquake> | null;
  kelurahanZone: string | null;
  kelurahanInDanger: boolean;
  volcanoes: Volcano[];
  earthquakes: Earthquake[];
  latestEarthquake: Earthquake | null;
  dataUpdatedAt: string | null;
}

const AlertContext = createContext<AlertContextValue | undefined>(undefined);

function getZone(distanceKm: number) {
  if (distanceKm <= 3) return "KRB III";
  if (distanceKm <= 5) return "KRB II";
  if (distanceKm <= 8) return "KRB I";
  return "Di Luar KRB";
}

export function playEmergencySiren() {
  if (typeof window === "undefined") return;
  try {
    const win = window as unknown as {
      AudioContext?: typeof AudioContext;
      webkitAudioContext?: typeof AudioContext;
    };
    const AudioCtx = win.AudioContext || win.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === "suspended") {
      ctx.resume();
    }

    const cycles = 3;
    const cycleDuration = 0.8;
    const now = ctx.currentTime;
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.25, now);
    masterGain.connect(ctx.destination);

    for (let c = 0; c < cycles; c++) {
      const start = now + c * cycleDuration;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(600, start);
      osc.frequency.linearRampToValueAtTime(1200, start + cycleDuration * 0.5);
      osc.frequency.linearRampToValueAtTime(600, start + cycleDuration);
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.6, start + 0.05);
      gain.gain.linearRampToValueAtTime(0, start + cycleDuration);
      osc.connect(gain);
      gain.connect(masterGain);
      osc.start(start);
      osc.stop(start + cycleDuration);
    }
  } catch {
    // ignore audio errors
  }
}

function getNearestVolcano(
  center: [number, number],
  volcanoes?: Volcano[]
): Nearest<Volcano> | null {
  let best: Nearest<Volcano> | null = null;
  for (const v of volcanoes || []) {
    if (v.lat == null || v.lon == null) continue;
    const d = haversineKm(center, [v.lat, v.lon]);
    if (!best || d < best.distanceKm) {
      best = { item: v, distanceKm: d };
    }
  }
  return best;
}

function getNearestEarthquake(
  center: [number, number],
  earthquakes?: Earthquake[]
): Nearest<Earthquake> | null {
  let best: Nearest<Earthquake> | null = null;
  for (const e of earthquakes || []) {
    if (!e.coordinates) continue;
    const d = haversineKm(center, e.coordinates);
    if (!best || d < best.distanceKm) {
      best = { item: e, distanceKm: d };
    }
  }
  return best;
}

const STORAGE_KEY = "wasspada-kelurahan";
const KELURAHAN_EVENT = "wsp-kelurahan-changed";

/* Store eksternal untuk kelurahan tersimpan — hydration-safe karena
   server selalu mengembalikan null lalu React re-render di client. */
let kelurahanRaw: string | null | undefined;
let kelurahanCache: RegionEntity | null = null;

function getKelurahanSnapshot(): RegionEntity | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === kelurahanRaw) return kelurahanCache;
  kelurahanRaw = raw;
  if (!raw) {
    kelurahanCache = null;
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as RegionEntity | null;
    kelurahanCache =
      parsed?.lat != null && parsed?.lon != null ? parsed : null;
  } catch {
    kelurahanCache = null;
  }
  return kelurahanCache;
}

function getServerKelurahanSnapshot(): RegionEntity | null {
  return null;
}

function subscribeKelurahan(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener(KELURAHAN_EVENT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(KELURAHAN_EVENT, cb);
  };
}

export function AlertProvider({ children }: { children: ReactNode }) {
  const [alertLevel, setAlertLevelState] = useState<AlertLevel>(1);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const selectedKelurahan = useSyncExternalStore(
    subscribeKelurahan,
    getKelurahanSnapshot,
    getServerKelurahanSnapshot
  );
  const [nearestVolcano, setNearestVolcano] =
    useState<Nearest<Volcano> | null>(null);
  const [nearestEarthquake, setNearestEarthquake] =
    useState<Nearest<Earthquake> | null>(null);
  const [volcanoes, setVolcanoes] = useState<Volcano[]>([]);
  const [earthquakes, setEarthquakes] = useState<Earthquake[]>([]);
  const [latestEarthquake, setLatestEarthquake] = useState<Earthquake | null>(
    null
  );
  const [dataUpdatedAt, setDataUpdatedAt] = useState<string | null>(null);
  const didMount = useRef(false);

  const disasterCenter: [number, number] = selectedKelurahan
    ? [selectedKelurahan.lat, selectedKelurahan.lon]
    : DEFAULT_CENTER;
  const disasterCenterLat = disasterCenter[0];
  const disasterCenterLon = disasterCenter[1];

  const setSelectedKelurahan = useCallback((entity: RegionEntity | null) => {
    if (typeof window !== "undefined") {
      if (entity) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(entity));
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
      window.dispatchEvent(new Event(KELURAHAN_EVENT));
    }
  }, []);

  const setAlertLevel = useCallback((level: AlertLevel) => {
    setAlertLevelState(level);
  }, []);

  const requestUserLocation = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLocationError("Geolocation tidak didukung di perangkat ini.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
        });
        setLocationError(null);
      },
      () => {
        setLocationError(
          "Gagal mengakses lokasi. Pastikan izin lokasi diaktifkan."
        );
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  const userDistanceKm = userLocation
    ? haversineKm([userLocation.lat, userLocation.lon], disasterCenter)
    : null;

  const userZone = userDistanceKm !== null ? getZone(userDistanceKm) : null;
  const isInKrb3 = userDistanceKm !== null && userDistanceKm <= 3;
  const kelurahanZone = nearestVolcano
    ? getZone(nearestVolcano.distanceKm)
    : null;
  const kelurahanInDanger = kelurahanZone === "KRB III";
  const isInDangerZone = alertLevel === 4 || isInKrb3 || kelurahanInDanger;

  useEffect(() => {
    if (!didMount.current) {
      didMount.current = true;
      return;
    }
    if (audioEnabled && isInDangerZone) {
      playEmergencySiren();
    }
  }, [alertLevel, isInKrb3, audioEnabled, isInDangerZone, kelurahanInDanger]);

  const sync = async () => {
    try {
      const [volcanoRes, bmkgRes] = await Promise.all([
        fetchVolcanoes(),
        fetchBMKG(),
      ]);

      const volcanoList = (volcanoRes.error ? [] : volcanoRes.volcanoes) || [];
      const earthquakeList = bmkgRes.error
        ? bmkgRes.felt || []
        : [bmkgRes.latest, ...(bmkgRes.felt || [])].filter(
          (e): e is Earthquake => e != null && e.coordinates != null
        );

      const center: [number, number] = [disasterCenterLat, disasterCenterLon];
      const v = getNearestVolcano(center, volcanoList);
      const e = getNearestEarthquake(center, earthquakeList);

      setVolcanoes(volcanoList);
      setEarthquakes(earthquakeList);
      setLatestEarthquake(bmkgRes.error ? null : bmkgRes.latest);
      setDataUpdatedAt(new Date().toISOString());
      setNearestVolcano(v);
      setNearestEarthquake(e);

      const maxVolcanoLevel = volcanoList.reduce(
        (m, vol) => Math.max(m, vol.level),
        1
      );
      const eqLevel = e ? levelFromEarthquake(e.item.magnitude || 0) : 1;
      const kelurahanLevel = v ? v.item.level : 1;
      setAlertLevelState(
        Math.max(maxVolcanoLevel, eqLevel, kelurahanLevel) as AlertLevel
      );
    } catch {
      // ignore sync errors
    }
  };

  useSmartPolling(sync, {
    stableIntervalMs: 300000,
    alertIntervalMs: 60000,
    isAlertActive: alertLevel >= 3,
    refreshKey: `${disasterCenterLat},${disasterCenterLon}`,
  });

  return (
    <AlertContext.Provider
      value={{
        alertLevel,
        setAlertLevel,
        alertConfig: ALERT_LEVELS[alertLevel],
        audioEnabled,
        setAudioEnabled,
        userLocation,
        locationError,
        requestUserLocation,
        userDistanceKm,
        userZone,
        isInDangerZone,
        isInKrb3,
        selectedKelurahan,
        setSelectedKelurahan,
        disasterCenter,
        nearestVolcano,
        nearestEarthquake,
        kelurahanZone,
        kelurahanInDanger,
        volcanoes,
        earthquakes,
        latestEarthquake,
        dataUpdatedAt,
      }}
    >
      {children}
    </AlertContext.Provider>
  );
}

export function useAlert() {
  const context = useContext(AlertContext);
  if (!context) {
    throw new Error("useAlert must be used within AlertProvider");
  }
  return context;
}
