/**
 * Layer citra satelit NASA GIBS (Global Imagery Browse Services) — gratis,
 * tanpa API key. Endpoint WMTS "GoogleMapsCompatible_LevelN" kompatibel
 * dengan skema tile XYZ standar, jadi bisa dipakai di Leaflet maupun Cesium.
 *
 * Time dimension memakai literal "default" = tanggal data terbaru yang
 * tersedia. Untuk animasi, waktu bisa diberikan eksplisit (ISO).
 */

export type GibsLayerKey =
  | "none"
  | "satellite"
  | "precip"
  | "aerosol"
  | "co"
  | "truecolor";

export interface GibsLayer {
  /** identifier layer di WMTS GIBS */
  id: string;
  label: string;
  /** tile matrix set: GoogleMapsCompatible_Level{maxZoom} */
  tms: string;
  /** ekstensi tile sesuai format produk */
  format: "png" | "jpeg";
  /** level zoom maksimum yang disediakan produk */
  maxZoom: number;
  /** opacity overlay di atas basemap */
  alpha: number;
  /** resolusi waktu produk — untuk frame animasi */
  step: "10min" | "day";
}

export const GIBS_LAYERS: Record<Exclude<GibsLayerKey, "none">, GibsLayer> = {
  satellite: {
    // Himawari-8/9 — geostasioner menutupi Indonesia, update tiap 10 menit
    id: "Himawari_AHI_Band13_Clean_Infrared",
    label: "Citra Satelit (Himawari IR)",
    tms: "GoogleMapsCompatible_Level6",
    format: "png",
    maxZoom: 6,
    alpha: 0.85,
    step: "10min",
  },
  precip: {
    id: "IMERG_Precipitation_Rate",
    label: "Curah Hujan (IMERG)",
    tms: "GoogleMapsCompatible_Level6",
    format: "png",
    maxZoom: 6,
    alpha: 0.7,
    step: "day",
  },
  aerosol: {
    id: "MODIS_Terra_Aerosol",
    label: "Aerosol / Asap",
    tms: "GoogleMapsCompatible_Level6",
    format: "png",
    maxZoom: 6,
    alpha: 0.6,
    step: "day",
  },
  co: {
    id: "AIRS_L2_Carbon_Monoxide_500hPa_Volume_Mixing_Ratio_Day",
    label: "Karbon Monoksida (CO)",
    tms: "GoogleMapsCompatible_Level6",
    format: "png",
    maxZoom: 6,
    alpha: 0.65,
    step: "day",
  },
  truecolor: {
    id: "MODIS_Terra_CorrectedReflectance_TrueColor",
    label: "Citra Sebenarnya",
    tms: "GoogleMapsCompatible_Level9",
    format: "jpeg",
    maxZoom: 9,
    alpha: 1,
    step: "day",
  },
};

/**
 * URL tile WMTS. `time` default = data terbaru yang tersedia; untuk animasi
 * berikan ISO "YYYY-MM-DD" (produk harian) atau "YYYY-MM-DDTHH:mm:ssZ".
 */
export function gibsTileUrl(layer: GibsLayer, time = "default"): string {
  return `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${layer.id}/default/${time}/${layer.tms}/{z}/{y}/{x}.${layer.format}`;
}

/** Daftar waktu frame untuk animasi layer (urut lama → baru). */
export function gibsFrames(step: GibsLayer["step"], count = 6): string[] {
  const frames: string[] = [];
  if (step === "10min") {
    // Himawari: frame tiap 10 menit, 2 jam terakhir (dibulatkan ke 10 menit)
    const stepMs = 10 * 60 * 1000;
    const latest = Math.floor(Date.now() / stepMs) * stepMs;
    for (let i = count - 1; i >= 0; i--) {
      frames.push(new Date(latest - i * stepMs).toISOString().slice(0, 19) + "Z");
    }
  } else {
    // produk harian: 6 hari terakhir
    for (let i = count - 1; i >= 0; i--) {
      frames.push(
        new Date(Date.now() - (i + 1) * 864e5).toISOString().slice(0, 10)
      );
    }
  }
  return frames;
}

export const GIBS_CREDIT = "NASA GIBS / EOSDIS";
