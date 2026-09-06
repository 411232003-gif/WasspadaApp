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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const level = searchParams.get("level") || "province";
  const slug = searchParams.get("slug");

  const base = "https://api.openadmindata.org/api/v1/id";
  const url = slug
    ? `${base}/${level}/${slug}.json`
    : `${base}/${level}.json`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: `OpenAdminData ${res.status}: ${text}` },
        { status: res.status }
      );
    }
    const data = await res.json();

    let list: RegionEntity[] = [];
    if (data.entities && Array.isArray(data.entities)) {
      list = data.entities.map((e: any) => ({
        id: e.id,
        name_local: e.name_local,
        name_en: e.name_en,
        slug: e.slug,
        lat: e.lat,
        lon: e.lon,
        parent_id: e.parent_id,
        parent_name_local: e.parent_name_local,
        postal_code: e.postal_code,
      }));
    } else if (data.children && Array.isArray(data.children.entities)) {
      list = data.children.entities.map((e: any) => ({
        id: e.id,
        name_local: e.name_local,
        name_en: e.name_en,
        slug: e.slug,
        lat: e.lat,
        lon: e.lon,
        parent_id: e.parent_id,
        parent_name_local: e.parent_name_local,
        postal_code: e.postal_code,
      }));
    }

    return NextResponse.json({
      level: data.level?.key || level,
      count: list.length,
      entities: list,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Gagal memuat data wilayah" },
      { status: 502 }
    );
  }
}
