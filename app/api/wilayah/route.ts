import { NextResponse } from "next/server";

export const revalidate = 86400;

interface RegionEntity {
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

type Level = "province" | "regency" | "district" | "village";

// Map the requested child level to the parent endpoint that contains its children.
const PARENT_ENDPOINT: Record<Level, string> = {
  province: "province",
  regency: "province",
  district: "regency",
  village: "district",
};

function normalizeEntity(e: Record<string, unknown>): RegionEntity | null {
  if (!e || !e.id || !e.name_local) return null;
  return {
    id: String(e.id),
    name_local: String(e.name_local),
    name_en: String(e.name_en ?? e.name_local),
    slug: String(e.slug ?? e.id),
    lat: typeof e.lat === "number" ? e.lat : 0,
    lon: typeof e.lon === "number" ? e.lon : 0,
    parent_id: e.parent_id ? String(e.parent_id) : undefined,
    parent_name_local: e.parent_name_local ? String(e.parent_name_local) : undefined,
    postal_code: e.postal_code ? String(e.postal_code) : undefined,
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const level = (searchParams.get("level") || "province") as Level;
  const slug = searchParams.get("slug");

  const base = "https://api.openadmindata.org/api/v1/id";
  const parent = PARENT_ENDPOINT[level];
  const url = slug ? `${base}/${parent}/${slug}.json` : `${base}/${parent}.json`;

  try {
    const res = await fetch(url, { next: { revalidate: 86400 } });
    if (!res.ok) {
      console.error("OpenAdminData error:", res.status);
      return NextResponse.json(
        { error: "Sumber data wilayah sedang tidak tersedia.", entities: [] },
        { status: res.status < 500 ? res.status : 502 }
      );
    }
    const data = await res.json();

    let rawList: Record<string, unknown>[] = [];
    if (data.children && Array.isArray(data.children.entities)) {
      rawList = data.children.entities;
    } else if (data.entities && Array.isArray(data.entities)) {
      rawList = data.entities;
    }

    const list = rawList.map(normalizeEntity).filter((e): e is RegionEntity => e !== null);

    return NextResponse.json({
      level,
      count: list.length,
      entities: list,
    });
  } catch (error) {
    console.error("Wilayah fetch failed:", error);
    return NextResponse.json(
      { error: "Gagal memuat data wilayah.", entities: [] },
      { status: 502 }
    );
  }
}
