import { NextResponse } from "next/server";

export const revalidate = 60;

interface BmkgRawItem {
  Tanggal?: string;
  Jam?: string;
  DateTime?: string;
  Coordinates?: string;
  Lintang?: string;
  Bujur?: string;
  Magnitude?: string;
  Kedalaman?: string;
  Wilayah?: string;
  Potensi?: string;
  Dirasakan?: string;
  Shakemap?: string;
}

function parseCoordinates(coords?: string): [number, number] | null {
  if (!coords) return null;
  const [lat, lon] = coords.split(",").map((v) => parseFloat(v.trim()));
  if (Number.isNaN(lat) || Number.isNaN(lon)) return null;
  return [lat, lon];
}

function parseDepth(kedalaman?: string): number | null {
  if (!kedalaman) return null;
  const match = kedalaman.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

function parseItem(item: BmkgRawItem) {
  return {
    date: item.Tanggal || null,
    time: item.Jam || null,
    timestamp: item.DateTime || null,
    coordinates: parseCoordinates(item.Coordinates),
    latitudeString: item.Lintang || null,
    longitudeString: item.Bujur || null,
    magnitude: item.Magnitude ? parseFloat(item.Magnitude) : null,
    depthKm: parseDepth(item.Kedalaman),
    location: item.Wilayah || null,
    potential: item.Potensi || null,
    felt: item.Dirasakan || null,
    shakemap: item.Shakemap || null,
  };
}

export async function GET() {
  try {
    const [autoRes, feltRes] = await Promise.all([
      fetch("https://data.bmkg.go.id/DataMKG/TEWS/autogempa.json"),
      fetch("https://data.bmkg.go.id/DataMKG/TEWS/gempadirasakan.json"),
    ]);

    if (!autoRes.ok) throw new Error(`BMKG autogempa responded ${autoRes.status}`);
    if (!feltRes.ok) throw new Error(`BMKG gempadirasakan responded ${feltRes.status}`);

    const autoData = await autoRes.json();
    const feltData = await feltRes.json();

    const latest = autoData?.Infogempa?.gempa
      ? parseItem(autoData.Infogempa.gempa as BmkgRawItem)
      : null;

    const feltList = Array.isArray(feltData?.Infogempa?.gempa)
      ? (feltData.Infogempa.gempa as BmkgRawItem[])
          .slice(0, 15)
          .map(parseItem)
      : [];

    return NextResponse.json({
      latest,
      felt: feltList,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("BMKG fetch failed:", error);
    return NextResponse.json(
      {
        error: "Gagal mengambil data BMKG.",
        latest: null,
        felt: [],
        updatedAt: new Date().toISOString(),
      },
      { status: 502 }
    );
  }
}
