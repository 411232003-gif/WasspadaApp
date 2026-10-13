"use client";

export interface Earthquake {
  date: string | null;
  time: string | null;
  timestamp: string | null;
  coordinates: [number, number] | null;
  latitudeString: string | null;
  longitudeString: string | null;
  magnitude: number | null;
  depthKm: number | null;
  location: string | null;
  potential: string | null;
  felt: string | null;
  shakemap: string | null;
}

export interface Volcano {
  name: string;
  level: 1 | 2 | 3 | 4;
  status: string;
  lat?: number | null;
  lon?: number | null;
  region?: string;
}

export interface BmkgResponse {
  latest: Earthquake | null;
  felt: Earthquake[];
  updatedAt: string;
  error?: string;
}

export interface PvmbgResponse {
  volcanoes: Volcano[];
  updatedAt: string;
  error?: string;
}

export interface VolcanoesResponse {
  volcanoes: Volcano[];
  updatedAt: string;
  error?: string;
}

export interface RegionEntity {
  id: string;
  name_local: string;
  name_en: string;
  slug: string;
  lat: number;
  lon: number;
  parent_id?: string;
  parent_name_local?: string;
  postal_code?: string;
}

export interface WilayahResponse {
  level: string;
  count: number;
  entities: RegionEntity[];
  error?: string;
}

export async function fetchBMKG(): Promise<BmkgResponse> {
  try {
    const res = await fetch("/api/bmkg");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (e: any) {
    return { latest: null, felt: [], updatedAt: new Date().toISOString(), error: e.message };
  }
}

export async function fetchPVMBG(): Promise<PvmbgResponse> {
  try {
    const res = await fetch("/api/pvmbg");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (e: any) {
    return { volcanoes: [], updatedAt: new Date().toISOString(), error: e.message };
  }
}

export async function fetchVolcanoes(): Promise<VolcanoesResponse> {
  try {
    const res = await fetch("/api/volcanoes");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (e: any) {
    return { volcanoes: [], updatedAt: new Date().toISOString(), error: e.message };
  }
}

export async function fetchWilayah(
  level: "province" | "regency" | "district" | "village",
  slug?: string
): Promise<WilayahResponse> {
  const url = slug
    ? `/api/wilayah?level=${level}&slug=${encodeURIComponent(slug)}`
    : `/api/wilayah?level=${level}`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return {
      level: data.level || level,
      count: data.count || 0,
      entities: Array.isArray(data.entities) ? data.entities : [],
    };
  } catch (e: any) {
    return { level, count: 0, entities: [], error: e.message };
  }
}

export interface NewsItem {
  id: string;
  source: "petabencana" | "bluesky" | "gdacs" | "reliefweb";
  title: string;
  text: string;
  url: string;
  imageUrl?: string;
  author?: string;
  createdAt: string;
  meta?: string;
}

export interface NewsSourceStatus {
  ok: boolean;
  count: number;
  error?: string;
}

export interface NewsResponse {
  items: NewsItem[];
  sources: Record<string, NewsSourceStatus>;
  updatedAt: string;
  error?: string;
}

export async function fetchNews(): Promise<NewsResponse> {
  try {
    const res = await fetch("/api/news");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (e) {
    return {
      items: [],
      sources: {},
      updatedAt: new Date().toISOString(),
      error: e instanceof Error ? e.message : "Gagal memuat berita",
    };
  }
}

export function findTargetVolcano(
  volcanoes: Volcano[],
  targetName: string
): Volcano | null {
  const normalized = targetName.toLowerCase();
  return (
    volcanoes.find((v) => v.name.toLowerCase().includes(normalized)) || null
  );
}

export function levelFromEarthquake(magnitude: number): 1 | 2 | 3 | 4 {
  if (magnitude >= 6.0) return 4;
  if (magnitude >= 5.5) return 3;
  if (magnitude >= 5.0) return 2;
  return 1;
}

export function haversineKm(a: [number, number], b: [number, number]) {
  const R = 6371;
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLon = toRad(b[1] - a[1]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return R * c;
}

export function getBearing(a: [number, number], b: [number, number]): number {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const toDeg = (v: number) => (v * 180) / Math.PI;
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);
  const dLon = toRad(b[1] - a[1]);
  const x = Math.sin(dLon) * Math.cos(lat2);
  const y =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return (toDeg(Math.atan2(x, y)) + 360) % 360;
}

export function cardinalFrom(deg: number): string {
  const dirs = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  const i = Math.round(deg / 22.5) % 16;
  return dirs[i];
}

export function cardinalTo(degFrom: number): string {
  return cardinalFrom((degFrom + 180) % 360);
}

export interface WindData {
  windSpeed: number;
  windDirectionFrom: number;
  windDirectionTo: number;
  updatedAt: string;
  error?: string;
}

export function computeDestination(
  from: [number, number],
  bearing: number,
  distanceKm: number
): [number, number] {
  const R = 6371;
  const toRad = (v: number) => (v * Math.PI) / 180;
  const toDeg = (v: number) => (v * 180) / Math.PI;
  const lat1 = toRad(from[0]);
  const lon1 = toRad(from[1]);
  const brng = toRad(bearing);
  const d = distanceKm / R;
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(d) +
      Math.cos(lat1) * Math.sin(d) * Math.cos(brng)
  );
  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(brng) * Math.sin(d) * Math.cos(lat1),
      Math.cos(d) - Math.sin(lat1) * Math.sin(lat2)
    );
  return [toDeg(lat2), (toDeg(lon2) + 540) % 360 - 180];
}

export async function fetchWind(lat: number, lon: number): Promise<WindData> {
  try {
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`
    );
    if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
    const data = await res.json();
    const from = data?.current_weather?.winddirection ?? 0;
    const speed = data?.current_weather?.windspeed ?? 0;
    return {
      windSpeed: speed,
      windDirectionFrom: from,
      windDirectionTo: (from + 180) % 360,
      updatedAt: new Date().toISOString(),
    };
  } catch (e: any) {
    return {
      windSpeed: 0,
      windDirectionFrom: 0,
      windDirectionTo: 180,
      updatedAt: new Date().toISOString(),
      error: e.message,
    };
  }
}
