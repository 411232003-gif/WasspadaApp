import { NextResponse } from "next/server";

export const revalidate = 300;

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

export async function GET() {
  try {
    const res = await fetch(
      "https://magma.esdm.go.id/v1/gunung-api/tingkat-aktivitas"
    );

    if (!res.ok) throw new Error(`PVMBG responded ${res.status}`);

    const html = await res.text();
    const events: {
      index: number;
      type: "level" | "volcano";
      level?: number;
      raw?: string;
    }[] = [];

    for (const m of html.matchAll(LEVEL_REGEX)) {
      events.push({
        index: m.index || 0,
        type: "level",
        level: ROMAN_TO_INT[m[1]],
      });
    }

    for (const m of html.matchAll(VOLCANO_REGEX)) {
      events.push({
        index: m.index || 0,
        type: "volcano",
        raw: m[1].trim(),
      });
    }

    events.sort((a, b) => a.index - b.index);

    let currentLevel = 1;
    const volcanoes = [];

    for (const event of events) {
      if (event.type === "level" && event.level) {
        currentLevel = event.level;
      } else if (event.type === "volcano" && event.raw) {
        const name = event.raw.split(" - ")[0].trim();
        if (name && !/tidak ada/i.test(name)) {
          volcanoes.push({
            name,
            level: currentLevel,
            status: romanLevelToLabel(currentLevel),
          });
        }
      }
    }

    return NextResponse.json({
      volcanoes,
      updatedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: error.message || "Gagal mengambil data PVMBG",
        volcanoes: [],
        updatedAt: new Date().toISOString(),
      },
      { status: 502 }
    );
  }
}
