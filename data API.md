# Data API WasspadaApp

Dokumentasi seluruh API yang dipakai aplikasi.

- API **tanpa kunci** → endpoint/kode ditulis lengkap, bisa langsung dipakai.
- API **berkunci** → hanya dicantumkan sumbernya (key disimpan di `.env`, tidak ditulis di sini).

---

## API Internal (route Next.js — proxy agar key & CORS aman)

| Route | Fungsi |
|---|---|
| `/api/bmkg` | Gempa terkini & gempa dirasakan |
| `/api/fires` | Titik api: PetaBencana + NASA FIRMS + NASA EONET + verifikasi silang |
| `/api/news` | Berita: PetaBencana, ReliefWeb(belom dapet key masih nunggu email wkwk), GDACS, Bluesky |
| `/api/pvmbg` | Status aktivitas gunung api (MAGMA) |
| `/api/volcanoes` | Daftar gunung api + koordinat |
| `/api/wind` | Angin & cuaca |
| `/api/wilayah` | Data kelurahan/desa Indonesia |
| `/api/verify-captcha` | Verifikasi reCAPTCHA |

---

## API Eksternal — TANPA KUNCI (gratis, publik)

### 1. BMKG — Gempa Bumi

```ts
const BMKG_LATEST = "https://data.bmkg.go.id/DataMKG/TEWS/autogempa.json";
const BMKG_FELT = "https://data.bmkg.go.id/DataMKG/TEWS/gempadirasakan.json";
```

2. PVMBG / MAGMA Indonesia — Status Gunung Api

```ts
const MAGMA_URL =
  "https://magma.esdm.go.id/v1/gunung-api/tingkat-aktivitas";
```

3. Koordinat Gunung Api (dataset GitHub)

```ts
const VOLCANO_CSV =
  "https://raw.githubusercontent.com/catris25/Indonesian-Volcanoes-in-Folium/main/Indonesian_volcanoes.csv";
```

4. PetaBencana — Laporan Bencana Warga

```ts
const PETA_REPORTS =
  "https://api.petabencana.id/reports?timeperiod=86400&format=json";
// Kartu laporan: https://cards.petabencana.id/cards/{id}
// Peta: https://petabencana.id/map
```

5. NASA EONET — Peristiwa Alam (kebakaran, dsb.)

```ts
const EONET_WILDFIRES =
  "https://eonet.gsfc.nasa.gov/api/v3/events" +
  "?category=wildfires&status=open&limit=50&bbox=95,6,141,-11";
// bbox = minLong,maxLat,maxLong,minLat (Indonesia)
```

6. NASA GIBS — Citra Satelit WMTS (4 layer)

```ts
// Pola: https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/{LAYER}/default/default/{TMS}/{z}/{y}/{x}.{ext}
const GIBS = {
  aerosol:   { id: "MODIS_Terra_Aerosol", tms: "GoogleMapsCompatible_Level6", ext: "png" },
  co:        { id: "AIRS_L2_Carbon_Monoxide_500hPa_Volume_Mixing_Ratio_Day", tms: "GoogleMapsCompatible_Level6", ext: "png" },
  precip:    { id: "IMERG_Precipitation_Rate", tms: "GoogleMapsCompatible_Level6", ext: "png" },
  truecolor: { id: "MODIS_Terra_CorrectedReflectance_TrueColor", tms: "GoogleMapsCompatible_Level9", ext: "jpeg" },
};
// "default" pada Time = data harian terbaru (jeda ~1–2 hari)
```

7. Open-Meteo — Angin & Cuaca

```ts
const OPEN_METEO =
  "https://api.open-meteo.com/v1/forecast" +
  "?latitude={lat}&longitude={lon}&current=wind_speed_10m,wind_direction_10m";
```

8. Nominatim (OpenStreetMap) — Nama Lokasi / Reverse Geocode

```ts
const NOMINATIM_REVERSE =
  "https://nominatim.openstreetmap.org/reverse" +
  "?format=jsonv2&accept-language=id&zoom=14&lat={lat}&lon={lon}";
// Batasi maks ~1 request/detik — di-cache di lib/place-name.ts
```

9. OpenAdminData — Wilayah Kelurahan Indonesia

```ts
const WILAYAH = "https://api.openadmindata.org/api/v1/id";
```

10. ReliefWeb (PBB/OCHA) — Berita Kemanusiaan

```ts
const RELIEFWEB = "https://api.reliefweb.int/v2/reports";
// Situs: https://reliefweb.int
```

11. GDACS — Peringatan Bencana Global (RSS)

```ts
const GDACS_RSS = "https://www.gdacs.org/xml/rss.xml";
```

12. Bluesky — Kabar Warga (public API)

```ts
const BSKY_SEARCH =
  "https://api.bsky.app/xrpc/app.bsky.feed.searchPosts?q={query}";
```

13. Tile Basemap Peta (OSM & Esri)

```ts
const TILES = {
  osm:         "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  esriStreet:  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
  esriSat:     "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
};
```

---

## API / Layanan — BERKUNCI (hanya sumber; key di `.env`)

| Layanan | Dipakai untuk | Key di |
|---|---|---|
| **NASA FIRMS** (VIIRS hotspot) | Titik panas satelit | `FIRMS_MAP_KEY` — daftar di firms.modaps.eosdis.nasa.gov/map_key |
| **Firebase** | Auth + Firestore (chat, grup, profil, bookmark) | `NEXT_PUBLIC_FIREBASE_*` — console.firebase.google.com |
| **Supabase** | Storage foto chat (auto-hapus 5 hari) | `NEXT_PUBLIC_SUPABASE_*` — supabase.com |
| **Google reCAPTCHA** | Verifikasi anti-bot saat login | `RECAPTCHA_*` — google.com/recaptcha/admin |

---

#Ringkasan

- **13 API eksternal gratis tanpa kunci** (kode di atas).
- **4 layanan berkunci** (Firebase, Supabase, FIRMS, reCAPTCHA).
- **8 route internal** sebagai proxy/penggabung.
- Total: **~17 sumber data** — semuanya gratis/free tier.
