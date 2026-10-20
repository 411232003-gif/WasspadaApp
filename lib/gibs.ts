/**
 * Layer citra satelit NASA GIBS (Global Imagery Browse Services) — gratis,
 * tanpa API key. Endpoint WMTS "GoogleMapsCompatible_LevelN" kompatibel
 * dengan skema tile XYZ standar, jadi bisa dipakai di Leaflet maupun Cesium.
 *
 * Time dimension memakai literal "default" = tanggal data terbaru yang
 * tersedia (produk harian berjeda ~1–2 hari dari waktu nyata).
 */

export type GibsLayerKey = "none" | "aerosol" | "co" | "precip" | "truecolor";

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
}

export const GIBS_LAYERS: Record<Exclude<GibsLayerKey, "none">, GibsLayer> = {
  aerosol: {
    id: "MODIS_Terra_Aerosol",
    label: "Aerosol / Asap",
    tms: "GoogleMapsCompatible_Level6",
    format: "png",
    maxZoom: 6,
    alpha: 0.6,
  },
  co: {
    id: "AIRS_L2_Carbon_Monoxide_500hPa_Volume_Mixing_Ratio_Day",
    label: "Karbon Monoksida (CO)",
    tms: "GoogleMapsCompatible_Level6",
    format: "png",
    maxZoom: 6,
    alpha: 0.65,
  },
  precip: {
    id: "IMERG_Precipitation_Rate",
    label: "Curah Hujan (IMERG)",
    tms: "GoogleMapsCompatible_Level6",
    format: "png",
    maxZoom: 6,
    alpha: 0.7,
  },
  truecolor: {
    id: "MODIS_Terra_CorrectedReflectance_TrueColor",
    label: "Citra Sebenarnya",
    tms: "GoogleMapsCompatible_Level9",
    format: "jpeg",
    maxZoom: 9,
    alpha: 1,
  },
};

export function gibsTileUrl(layer: GibsLayer): string {
  return `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${layer.id}/default/default/${layer.tms}/{z}/{y}/{x}.${layer.format}`;
}

export const GIBS_CREDIT = "NASA GIBS / EOSDIS";
