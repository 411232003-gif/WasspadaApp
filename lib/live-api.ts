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
