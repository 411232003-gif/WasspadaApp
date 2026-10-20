/**
 * Overlay model cuaca ala Zoom Earth — semua sumber gratis tanpa API key.
 *
 * 1) Radar hujan: RainViewer (komposit radar global, update ~10 menit).
 * 2) Parameter model (angin, suhu, kelembapan, tekanan): Open-Meteo
 *    multi-lokasi — satu request grid ~96 titik se-Asia Tenggara, lalu
 *    diinterpolasi (IDW) ke canvas menjadi gradasi warna seperti peta
 *    model Zoom Earth/GFS.
 */

/* ---------- tipe ---------- */

export type WeatherLayerKey =
  | "wind-speed"
  | "wind-gusts"
  | "temp-actual"
  | "temp-feels"
  | "hum-rel"
  | "hum-dew"
  | "hum-wet"
  | "pressure";

type Rgb = [number, number, number];
interface ColorStop {
  t: number; // posisi 0..1 pada rentang min..max
  c: Rgb;
}

export interface WeatherLayerDef {
  label: string;
  unit: string;
  min: number;
  max: number;
  alpha: number;
  stops: ColorStop[];
}

/* ---------- definisi layer + colormap ---------- */

const BLUE = (t: number): ColorStop[] => [
  { t: 0, c: [240, 249, 255] },
  { t: t * 0.4, c: [107, 174, 214] },
  { t: t * 0.7, c: [33, 113, 181] },
  { t, c: [8, 48, 107] },
];

const THERMAL = (t: number): ColorStop[] => [
  { t: 0, c: [49, 54, 149] },
  { t: t * 0.25, c: [69, 117, 180] },
  { t: t * 0.5, c: [224, 243, 248] },
  { t: t * 0.7, c: [254, 224, 144] },
  { t: t * 0.85, c: [244, 109, 67] },
  { t, c: [165, 0, 38] },
];

export const WEATHER_LAYERS: Record<WeatherLayerKey, WeatherLayerDef> = {
  "wind-speed": {
    label: "Kecepatan Angin",
    unit: "km/h",
    min: 0,
    max: 80,
    alpha: 0.65,
    stops: [
      { t: 0, c: [0, 104, 55] },
      { t: 0.4, c: [120, 198, 121] },
      { t: 0.6, c: [255, 237, 160] },
      { t: 0.8, c: [253, 141, 60] },
      { t: 1, c: [215, 25, 28] },
    ],
  },
  "wind-gusts": {
    label: "Hembusan Angin",
    unit: "km/h",
    min: 0,
    max: 120,
    alpha: 0.65,
    stops: [
      { t: 0, c: [0, 104, 55] },
      { t: 0.4, c: [120, 198, 121] },
      { t: 0.6, c: [255, 237, 160] },
      { t: 0.8, c: [253, 141, 60] },
      { t: 1, c: [165, 0, 38] },
    ],
  },
  "temp-actual": {
    label: "Suhu",
    unit: "°C",
    min: -10,
    max: 42,
    alpha: 0.6,
    stops: THERMAL(1),
  },
  "temp-feels": {
    label: "Suhu Terasa",
    unit: "°C",
    min: -10,
    max: 48,
    alpha: 0.6,
    stops: THERMAL(1),
  },
  "hum-rel": {
    label: "Kelembapan Relatif",
    unit: "%",
    min: 0,
    max: 100,
    alpha: 0.6,
    stops: BLUE(1),
  },
  "hum-dew": {
    label: "Titik Embun",
    unit: "°C",
    min: 0,
    max: 32,
    alpha: 0.6,
    stops: [
      { t: 0, c: [255, 247, 236] },
      { t: 0.35, c: [254, 196, 79] },
      { t: 0.65, c: [217, 95, 14] },
      { t: 1, c: [140, 45, 4] },
    ],
  },
  "hum-wet": {
    label: "Suhu Bola Basah",
    unit: "°C",
    min: 0,
    max: 36,
    alpha: 0.6,
    stops: [
      { t: 0, c: [241, 238, 246] },
      { t: 0.35, c: [189, 201, 225] },
      { t: 0.65, c: [116, 112, 200] },
      { t: 1, c: [81, 18, 124] },
    ],
  },
  pressure: {
    label: "Tekanan Udara",
    unit: "hPa",
    min: 985,
    max: 1030,
    alpha: 0.6,
    stops: [
      { t: 0, c: [103, 0, 31] },
      { t: 0.3, c: [244, 165, 130] },
      { t: 0.5, c: [247, 247, 247] },
      { t: 0.7, c: [146, 197, 222] },
      { t: 1, c: [5, 48, 97] },
    ],
  },
};

/* ---------- wilayah grid: Indonesia + Asia Tenggara ---------- */

export const WEATHER_RECT = { west: 94, south: -12, east: 142, north: 10 };
const LAT_STEP = 3.1; // 8 baris
const LON_STEP = 4.4; // 12 kolom → ~96 titik per request

function buildGridPoints(): { lat: number; lon: number }[] {
  const pts: { lat: number; lon: number }[] = [];
  for (let lat = WEATHER_RECT.south; lat <= WEATHER_RECT.north + 0.01; lat += LAT_STEP) {
    for (let lon = WEATHER_RECT.west; lon <= WEATHER_RECT.east + 0.01; lon += LON_STEP) {
      pts.push({ lat: Number(lat.toFixed(2)), lon: Number(lon.toFixed(2)) });
    }
  }
  return pts;
}

/* ---------- ambil data Open-Meteo (multi-lokasi, satu request) ---------- */

export interface WeatherGrid {
  lat: number;
  lon: number;
  values: Record<WeatherLayerKey, number>;
}

/** Pendekatan Stull (2011) untuk suhu bola basah dari T(°C) & RH(%). */
function wetBulbC(t: number, rh: number): number {
  const a = Math.atan;
  return (
    t * a(0.151977 * Math.pow(rh + 8.313659, 0.5)) +
    a(t + rh) -
    a(rh - 1.676331) +
    0.00391838 * Math.pow(rh, 1.5) * a(0.023101 * rh) -
    4.686035
  );
}

export async function fetchWeatherGrid(): Promise<WeatherGrid[]> {
  const pts = buildGridPoints();
  const params = new URLSearchParams({
    latitude: pts.map((p) => p.lat).join(","),
    longitude: pts.map((p) => p.lon).join(","),
    current: [
      "temperature_2m",
      "apparent_temperature",
      "relative_humidity_2m",
      "dew_point_2m",
      "wind_speed_10m",
      "wind_gusts_10m",
      "pressure_msl",
    ].join(","),
  });
  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
  if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
  const json = await res.json();
  const arr = Array.isArray(json) ? json : [json];

  return arr.map((item, i) => {
    const c = item?.current ?? {};
    const t = c.temperature_2m ?? 0;
    const rh = c.relative_humidity_2m ?? 0;
    return {
      lat: pts[i]?.lat ?? item.latitude,
      lon: pts[i]?.lon ?? item.longitude,
      values: {
        "wind-speed": c.wind_speed_10m ?? 0,
        "wind-gusts": c.wind_gusts_10m ?? 0,
        "temp-actual": t,
        "temp-feels": c.apparent_temperature ?? t,
        "hum-rel": rh,
        "hum-dew": c.dew_point_2m ?? 0,
        "hum-wet": wetBulbC(t, rh),
        pressure: c.pressure_msl ?? 1013,
      },
    };
  });
}

/* ---------- render grid → canvas gradasi (IDW) ---------- */

function lerpColor(stops: ColorStop[], x: number): Rgb {
  const t = Math.min(Math.max(x, 0), 1);
  for (let i = 1; i < stops.length; i++) {
    if (t <= stops[i].t || i === stops.length - 1) {
      const a = stops[i - 1];
      const b = stops[i];
      const f = b.t === a.t ? 0 : (t - a.t) / (b.t - a.t);
      return [
        Math.round(a.c[0] + (b.c[0] - a.c[0]) * f),
        Math.round(a.c[1] + (b.c[1] - a.c[1]) * f),
        Math.round(a.c[2] + (b.c[2] - a.c[2]) * f),
      ];
    }
  }
  return stops[0].c;
}

/** Interpolasi IDW grid → PNG dataURL yang menutupi WEATHER_RECT. */
export function renderWeatherImage(
  grid: WeatherGrid[],
  key: WeatherLayerKey
): string {
  const def = WEATHER_LAYERS[key];
  const W = 240;
  const H = Math.round(
    (W * (WEATHER_RECT.north - WEATHER_RECT.south)) /
      (WEATHER_RECT.east - WEATHER_RECT.west)
  );
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  const img = ctx.createImageData(W, H);
  const range = def.max - def.min || 1;
  const { west, south, east, north } = WEATHER_RECT;
  const lonSpan = east - west;
  const latSpan = north - south;

  for (let y = 0; y < H; y++) {
    const lat = north - ((y + 0.5) / H) * latSpan;
    for (let x = 0; x < W; x++) {
      const lon = west + ((x + 0.5) / W) * lonSpan;
      let num = 0;
      let den = 0;
      let nearest = grid[0]?.values[key] ?? def.min;
      let nearestD = Infinity;
      for (const g of grid) {
        const dx = (g.lon - lon) * Math.cos((lat * Math.PI) / 180);
        const dy = g.lat - lat;
        const d2 = dx * dx + dy * dy;
        if (d2 < nearestD) {
          nearestD = d2;
          nearest = g.values[key];
        }
        const w = 1 / (d2 + 1e-6);
        num += w * g.values[key];
        den += w;
      }
      const v = nearestD < 0.05 ? nearest : num / den;
      const [r, gg, b] = lerpColor(def.stops, (v - def.min) / range);
      const idx = (y * W + x) * 4;
      img.data[idx] = r;
      img.data[idx + 1] = gg;
      img.data[idx + 2] = b;
      img.data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL("image/png");
}

/* ---------- radar hujan RainViewer (gratis, ~10 menit) ---------- */

let radarCache: { url: string; ts: number } | null = null;

/** URL template tile radar terbaru; di-cache 5 menit. */
export async function rainviewerTileUrl(): Promise<string> {
  if (radarCache && Date.now() - radarCache.ts < 5 * 60 * 1000) {
    return radarCache.url;
  }
  const res = await fetch(
    "https://api.rainviewer.com/public/weather-maps.json"
  );
  if (!res.ok) throw new Error(`RainViewer ${res.status}`);
  const json = await res.json();
  const frames = json?.radar?.past ?? [];
  const path = frames.length
    ? frames[frames.length - 1].path
    : "/v2/radar/0";
  const url = `https://tilecache.rainviewer.com${path}/256/{z}/{x}/{y}/2/1_1.png`;
  radarCache = { url, ts: Date.now() };
  return url;
}

export const RAINVIEWER_CREDIT = "RainViewer";

/** CSS gradient untuk colorbar legenda di panel. */
export function colorbarCss(key: WeatherLayerKey): string {
  const stops = WEATHER_LAYERS[key].stops
    .map((s) => `rgb(${s.c.join(",")}) ${Math.round(s.t * 100)}%`)
    .join(", ");
  return `linear-gradient(90deg, ${stops})`;
}
