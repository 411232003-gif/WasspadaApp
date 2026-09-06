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
}

export async function fetchBMKG(): Promise<BmkgResponse> {
  const res = await fetch("/api/bmkg");
  return res.json();
}

export async function fetchPVMBG(): Promise<PvmbgResponse> {
  const res = await fetch("/api/pvmbg");
  return res.json();
}

export async function fetchVolcanoes(): Promise<VolcanoesResponse> {
  const res = await fetch("/api/volcanoes");
  return res.json();
}

export async function fetchWilayah(
  level: "province" | "regency" | "district" | "village",
  slug?: string
): Promise<WilayahResponse> {
  const url = slug
    ? `/api/wilayah?level=${level}&slug=${encodeURIComponent(slug)}`
    : `/api/wilayah?level=${level}`;
  const res = await fetch(url);
  return res.json();
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
