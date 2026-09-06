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

export async function fetchBMKG(): Promise<BmkgResponse> {
  const res = await fetch("/api/bmkg");
  return res.json();
}

export async function fetchPVMBG(): Promise<PvmbgResponse> {
  const res = await fetch("/api/pvmbg");
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
