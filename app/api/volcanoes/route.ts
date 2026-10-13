import { NextResponse } from "next/server";

export const revalidate = 300;

const PVMBG_URL =
  "https://magma.esdm.go.id/v1/gunung-api/tingkat-aktivitas";
const VOLCANO_CSV_URL =
  "https://raw.githubusercontent.com/catris25/Indonesian-Volcanoes-in-Folium/main/Indonesian_volcanoes.csv";

const LEVEL_REGEX = /Level (IV|III|II|I) \((Awas|Siaga|Waspada|Normal)\)/g;
const VOLCANO_REGEX = /<td>\s*([^<]+?)\s*<a[\s\S]*?Lihat laporan<\/a>/g;

const ROMAN_TO_INT: Record<string, number> = {
  IV: 4,
  III: 3,
  II: 2,
  I: 1,
};

function romanLevelToLabel(level: number) {
  const labels = ["I", "II", "III", "IV"];
  return `Level ${labels[level - 1]}`;
}

function normalizeName(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .replace(/gunung|anak|mount/g, "");
}

interface PvmbgVolcano {
  name: string;
  level: number;
  status: string;
}

interface CsvVolcano {
  name: string;
  lat: number;
  lon: number;
  region: string;
}

async function fetchPVMBGVolcanoes(): Promise<PvmbgVolcano[]> {
  const res = await fetch(PVMBG_URL);
  if (!res.ok) throw new Error(`PVMBG ${res.status}`);
  const html = await res.text();

  const events: { index: number; type: "level" | "volcano"; level?: number; raw?: string }[] = [];
  for (const m of html.matchAll(LEVEL_REGEX)) {
    events.push({ index: m.index || 0, type: "level", level: ROMAN_TO_INT[m[1]] });
  }
  for (const m of html.matchAll(VOLCANO_REGEX)) {
    events.push({ index: m.index || 0, type: "volcano", raw: m[1].trim() });
  }
  events.sort((a, b) => a.index - b.index);

  let currentLevel = 1;
  const list: PvmbgVolcano[] = [];
  for (const e of events) {
    if (e.type === "level" && e.level) {
      currentLevel = e.level;
    } else if (e.type === "volcano" && e.raw) {
      const name = e.raw.split(" - ")[0].trim();
      if (name && !/tidak ada/i.test(name)) {
        list.push({
          name,
          level: currentLevel,
          status: romanLevelToLabel(currentLevel),
        });
      }
    }
  }
  return list;
}

async function fetchVolcanoCoordinates(): Promise<CsvVolcano[]> {
  const res = await fetch(VOLCANO_CSV_URL);
  if (!res.ok) throw new Error(`CSV ${res.status}`);
  const text = await res.text();
  const lines = text.trim().split("\n").slice(1);
  return lines
    .map((line) => {
      const parts = line.split(",");
      if (parts.length < 5) return null;
      const name = parts[1].trim();
      const lat = parseFloat(parts[2]);
      const lon = parseFloat(parts[3]);
      const region = parts[4]?.trim() || "";
      if (!name || Number.isNaN(lat) || Number.isNaN(lon)) return null;
      return { name, lat, lon, region };
    })
    .filter(Boolean) as CsvVolcano[];
}

function findBestMatch(name: string, coords: CsvVolcano[]) {
  const target = normalizeName(name);
  let best: CsvVolcano | null = null;
  let bestScore = 0;

  for (const c of coords) {
    const n = normalizeName(c.name);
    if (n === target) return c;
    if (n.includes(target) || target.includes(n)) {
      const score = Math.min(n.length, target.length);
      if (score > bestScore) {
        bestScore = score;
        best = c;
      }
    }
  }
  return best;
}

export async function GET() {
  let pvmbgList: PvmbgVolcano[] = [];
  let pvmbgError = "";
  try {
    pvmbgList = await fetchPVMBGVolcanoes();
  } catch (error) {
    pvmbgError = "PVMBG gagal";
    console.error("PVMBG fetch failed:", error);
  }

  let coordsList: CsvVolcano[] = [];
  try {
    coordsList = await fetchVolcanoCoordinates();
  } catch (error) {
    console.error("CSV fetch failed:", error);
  }

  // Fallback ke semua koordinat CSV dengan level Normal kalau PVMBG mati
  if (pvmbgList.length === 0 && coordsList.length > 0) {
    return NextResponse.json({
      volcanoes: coordsList.map((c) => ({
        name: c.name,
        level: 1,
        status: "Level I",
        lat: c.lat,
        lon: c.lon,
        region: c.region,
      })),
      warning: pvmbgError || undefined,
      updatedAt: new Date().toISOString(),
    });
  }

  const volcanoes = pvmbgList
    .map((v) => {
      const match = findBestMatch(v.name, coordsList);
      return {
        name: v.name,
        level: v.level,
        status: v.status,
        lat: match?.lat ?? null,
        lon: match?.lon ?? null,
        region: match?.region || "Indonesia",
      };
    })
    .filter((v) => v.lat !== null && v.lon !== null);

  return NextResponse.json({ volcanoes, updatedAt: new Date().toISOString() });
}
