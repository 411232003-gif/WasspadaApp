/**
 * Overlay cuaca Monev Map — sumber gratis tanpa API key (Open-Meteo).
 *
 * Satu request multi-lokasi mengambil grid ~150 titik se-Asia Tenggara:
 *   - suhu → diinterpolasi (IDW) ke canvas → gradasi warna di globe
 *   - angin (arah + kecepatan + hembusan) → vektor u/v untuk partikel
 *     animasi "angin berterbangan" ala Zoom Earth/Windy.
 */

/* ---------- wilayah grid: Indonesia + Asia Tenggara ---------- */

export const WEATHER_RECT = { west: 92, south: -13, east: 145, north: 12 };
const LAT_STEP = 2.6; // ~10 baris
const LON_STEP = 3.4; // ~16 kolom → ~160 titik per request

/* ---------- tipe ---------- */

export interface WeatherPoint {
  lat: number;
  lon: number;
  temp: number; // °C aktual
  feels: number; // °C terasa seperti (apparent)
  /** komponen vektor angin TUJUAN (m/s) — sudah dinegasikan dari arah datang */
  u: number;
  v: number;
  speed: number; // km/h
  gust: number; // km/h
}

type Rgb = [number, number, number];
interface ColorStop {
  t: number; // 0..1
  c: Rgb;
}

/* ---------- colormap ---------- */

/* colormap suhu berkontras tinggi ala Zoom Earth:
   ungu-biru dingin → hijau → kuning → oranye → merah panas */
const TEMP_STOPS: ColorStop[] = [
  { t: 0, c: [72, 0, 150] }, // ungu pekat — sangat dingin
  { t: 0.14, c: [35, 45, 220] }, // biru
  { t: 0.28, c: [0, 140, 230] }, // biru-cyan
  { t: 0.42, c: [10, 190, 110] }, // hijau
  { t: 0.54, c: [150, 225, 40] }, // hijau-kuning
  { t: 0.65, c: [255, 220, 30] }, // kuning
  { t: 0.78, c: [255, 125, 15] }, // oranye
  { t: 0.9, c: [235, 25, 25] }, // merah
  { t: 1, c: [140, 0, 35] }, // merah gelap — sangat panas
];
export const TEMP_RANGES = {
  temp: { min: -5, max: 45, unit: "°C", label: "Suhu" },
  feels: { min: -5, max: 50, unit: "°C", label: "Terasa" },
} as const;
export type TempMetric = keyof typeof TEMP_RANGES;

const WIND_STOPS: ColorStop[] = [
  { t: 0, c: [120, 220, 140] }, // hijau — tenang
  { t: 0.35, c: [255, 240, 130] }, // kuning
  { t: 0.6, c: [255, 160, 60] }, // oranye
  { t: 1, c: [220, 30, 40] }, // merah — kencang
];
const WIND_MAX_KMH = 100;

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

/** Warna partikel angin menurut kecepatan (km/h) — "rgba()" siap stroke. */
export function windRgba(kmh: number, alpha = 0.85): string {
  const [r, g, b] = lerpColor(WIND_STOPS, kmh / WIND_MAX_KMH);
  return `rgba(${r},${g},${b},${alpha})`;
}

/** CSS gradient colorbar suhu untuk legenda panel. */
export function tempColorbarCss(): string {
  const stops = TEMP_STOPS.map(
    (s) => `rgb(${s.c.join(",")}) ${Math.round(s.t * 100)}%`
  ).join(", ");
  return `linear-gradient(90deg, ${stops})`;
}

/* ---------- fetch grid Open-Meteo ---------- */

export async function fetchWeatherGrid(): Promise<WeatherPoint[]> {
  const lats: number[] = [];
  const lons: number[] = [];
  for (let lat = WEATHER_RECT.south; lat <= WEATHER_RECT.north + 0.01; lat += LAT_STEP) {
    for (let lon = WEATHER_RECT.west; lon <= WEATHER_RECT.east + 0.01; lon += LON_STEP) {
      lats.push(Number(lat.toFixed(2)));
      lons.push(Number(lon.toFixed(2)));
    }
  }
  const params = new URLSearchParams({
    latitude: lats.join(","),
    longitude: lons.join(","),
    current:
      "temperature_2m,apparent_temperature,wind_speed_10m,wind_direction_10m,wind_gusts_10m",
  });
  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
  if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
  const json = await res.json();
  const arr = Array.isArray(json) ? json : [json];

  return arr.map((item, i) => {
    const c = item?.current ?? {};
    const speedKmh = c.wind_speed_10m ?? 0;
    const dirRad = ((c.wind_direction_10m ?? 0) * Math.PI) / 180;
    const ms = speedKmh / 3.6;
    return {
      lat: lats[i] ?? item.latitude,
      lon: lons[i] ?? item.longitude,
      temp: c.temperature_2m ?? 0,
      feels: c.apparent_temperature ?? c.temperature_2m ?? 0,
      // arah DATANG → vektor TUJUAN dinegasikan
      u: -ms * Math.sin(dirRad),
      v: -ms * Math.cos(dirRad),
      speed: speedKmh,
      gust: c.wind_gusts_10m ?? speedKmh,
    };
  });
}

/** Sampling vektor angin terdekat dari grid (untuk partikel). */
export function sampleWind(
  grid: WeatherPoint[],
  lat: number,
  lon: number
): { u: number; v: number; speed: number; gust: number } | null {
  let best: WeatherPoint | null = null;
  let bestD = Infinity;
  const cosLat = Math.cos((lat * Math.PI) / 180);
  for (const g of grid) {
    const dx = (g.lon - lon) * cosLat;
    const dy = g.lat - lat;
    const d = dx * dx + dy * dy;
    if (d < bestD) {
      bestD = d;
      best = g;
    }
  }
  if (!best || bestD > 30) return null;
  return { u: best.u, v: best.v, speed: best.speed, gust: best.gust };
}

/** Suhu aktual & terasa terinterpolasi di titik klik (IDW seluruh grid). */
export function sampleTemp(
  grid: WeatherPoint[],
  lat: number,
  lon: number
): { temp: number; feels: number } | null {
  if (grid.length === 0) return null;
  const cosLat = Math.cos((lat * Math.PI) / 180);
  let nT = 0;
  let nF = 0;
  let den = 0;
  let nTnear = grid[0].temp;
  let nFnear = grid[0].feels;
  let nearestD = Infinity;
  for (const g of grid) {
    const dx = (g.lon - lon) * cosLat;
    const dy = g.lat - lat;
    const d2 = dx * dx + dy * dy;
    if (d2 < nearestD) {
      nearestD = d2;
      nTnear = g.temp;
      nFnear = g.feels;
    }
    const w = 1 / (d2 + 1e-6);
    nT += w * g.temp;
    nF += w * g.feels;
    den += w;
  }
  return {
    temp: nearestD < 0.05 ? nTnear : nT / den,
    feels: nearestD < 0.05 ? nFnear : nF / den,
  };
}

/* ---------- render suhu → canvas gradasi (IDW tajam) ---------- */

export function renderTempImage(
  grid: WeatherPoint[],
  metric: TempMetric = "temp"
): string {
  const W = 260;
  const { west, south, east, north } = WEATHER_RECT;
  const { min, max } = TEMP_RANGES[metric];
  const H = Math.round((W * (north - south)) / (east - west));
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  const img = ctx.createImageData(W, H);
  const range = max - min;
  const lonSpan = east - west;
  const latSpan = north - south;
  /* eksponen >1 → transisi warna lebih tegas, tak terlalu blur */
  const POW = 1.6;

  for (let y = 0; y < H; y++) {
    const lat = north - ((y + 0.5) / H) * latSpan;
    const cosLat = Math.cos((lat * Math.PI) / 180);
    for (let x = 0; x < W; x++) {
      const lon = west + ((x + 0.5) / W) * lonSpan;
      let num = 0;
      let den = 0;
      let nearest: number = min;
      let nearestD = Infinity;
      for (const g of grid) {
        const dx = (g.lon - lon) * cosLat;
        const dy = g.lat - lat;
        const d2 = dx * dx + dy * dy;
        if (d2 < nearestD) {
          nearestD = d2;
          nearest = g[metric];
        }
        const w = 1 / (Math.pow(d2, POW / 2) + 1e-6);
        num += w * g[metric];
        den += w;
      }
      const t = nearestD < 0.05 ? nearest : num / den;
      const [r, g, b] = lerpColor(TEMP_STOPS, (t - min) / range);
      const idx = (y * W + x) * 4;
      img.data[idx] = r;
      img.data[idx + 1] = g;
      img.data[idx + 2] = b;
      img.data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL("image/png");
}
