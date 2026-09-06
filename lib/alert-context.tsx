"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
  useCallback,
  useRef,
} from "react";

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

export const DISASTER_CENTER: [number, number] = [-6.2088, 106.8956];

interface UserLocation {
  lat: number;
  lon: number;
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
}

const AlertContext = createContext<AlertContextValue | undefined>(undefined);

function toRad(value: number) {
  return (value * Math.PI) / 180;
}

function haversineKm(a: [number, number], b: [number, number]) {
  const R = 6371;
  const dLat = toRad(b[0] - a[0]);
  const dLon = toRad(b[1] - a[1]);
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return R * c;
}

function getZone(distanceKm: number) {
  if (distanceKm <= 3) return "KRB III";
  if (distanceKm <= 5) return "KRB II";
  if (distanceKm <= 8) return "KRB I";
  return "Di Luar KRB";
}

function playEmergencySiren() {
  if (typeof window === "undefined") return;
  try {
    const AudioCtx =
      (window as any).AudioContext || (window as any).webkitAudioContext;
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

export function AlertProvider({ children }: { children: ReactNode }) {
  const [alertLevel, setAlertLevelState] = useState<AlertLevel>(1);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const didMount = useRef(false);

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
    ? haversineKm([userLocation.lat, userLocation.lon], DISASTER_CENTER)
    : null;

  const userZone = userDistanceKm !== null ? getZone(userDistanceKm) : null;
  const isInKrb3 = userDistanceKm !== null && userDistanceKm <= 3;
  const isInDangerZone = alertLevel === 4 || isInKrb3;

  useEffect(() => {
    if (!didMount.current) {
      didMount.current = true;
      return;
    }
    if (audioEnabled && isInDangerZone) {
      playEmergencySiren();
    }
  }, [alertLevel, isInKrb3, audioEnabled, isInDangerZone]);

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
