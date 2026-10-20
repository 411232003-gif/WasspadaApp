/**
 * Reverse-geocode koordinat → nama tempat via Nominatim (OSM).
 * Hasil di-cache per grid ~100 m agar patuh rate limit (maks 1 req/detik)
 * dan tidak memukul ulang saat popup dibuka-tutup.
 */
const cache = new Map<string, string | null>();
const pending = new Map<string, Promise<string | null>>();

export function reverseGeocode(lat: number, lon: number): Promise<string | null> {
    const key = `${lat.toFixed(3)},${lon.toFixed(3)}`;
    if (cache.has(key)) return Promise.resolve(cache.get(key) ?? null);
    const inflight = pending.get(key);
    if (inflight) return inflight;

    const request = fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&accept-language=id&zoom=14&lat=${lat}&lon=${lon}`
    )
        .then(async (res) => {
            if (!res.ok) return null;
            const data = await res.json();
            const name =
                typeof data?.display_name === "string"
                    ? data.display_name.split(",").slice(0, 3).join(",").trim()
                    : null;
            cache.set(key, name);
            return name;
        })
        .catch(() => {
            cache.set(key, null);
            return null;
        })
        .finally(() => pending.delete(key));

    pending.set(key, request);
    return request;
}
