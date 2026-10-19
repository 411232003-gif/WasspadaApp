import { cachedJsonResponse } from "@/lib/api-cache";
import type {
    FireConfidence,
    FireDetection,
    FireSourceStatus,
} from "@/lib/fire-detections";

interface PetaGeometry {
    properties?: Record<string, unknown>;
    geometry?: { coordinates?: unknown };
    coordinates?: unknown;
}

interface PetaResponse {
    result?: {
        objects?: { output?: { geometries?: PetaGeometry[] } };
        features?: PetaGeometry[];
    };
}

const INDONESIA_BBOX = "95,-11,141,6";
const PETA_REPORTS_URL =
    "https://api.petabencana.id/reports?timeperiod=86400&format=json";
const FIRMS_SOURCE = "VIIRS_SNPP_NRT";
/* EONET bbox pakai urutan minLong,maxLat,maxLong,minLat — gratis tanpa key */
const EONET_EVENTS_URL =
    "https://eonet.gsfc.nasa.gov/api/v3/events?category=wildfires&status=open&limit=50&bbox=95,6,141,-11";
/* radius cross-verifikasi antar-sumber (km) */
const VERIFY_RADIUS_KM: Record<string, number> = {
    PetaBencana: 5, // laporan warga vs titik panas satelit (piksel VIIRS ~375 m)
    "NASA FIRMS": 25, // hotspot vs area kejadian EONET (sentroid kasar)
    "NASA EONET": 25,
};

function pointCoordinates(value: unknown): [number, number] | null {
    if (
        !Array.isArray(value) ||
        typeof value[0] !== "number" ||
        typeof value[1] !== "number"
    ) {
        return null;
    }

    const [longitude, latitude] = value;
    if (
        latitude < -11 ||
        latitude > 6 ||
        longitude < 95 ||
        longitude > 141
    ) {
        return null;
    }

    return [latitude, longitude];
}

function parsePetaReports(data: PetaResponse): FireDetection[] {
    const geometries =
        data.result?.objects?.output?.geometries ?? data.result?.features ?? [];

    return geometries.flatMap((geometry) => {
        const properties = geometry.properties ?? {};
        const type = String(properties.disaster_type ?? "").toLowerCase();
        if (type !== "fire" && type !== "kebakaran") return [];

        const rawCoordinates =
            geometry.geometry?.coordinates ?? geometry.coordinates;
        const coordinates = pointCoordinates(rawCoordinates);
        const createdAt = String(properties.created_at ?? "");
        if (!coordinates || !createdAt) return [];

        const id = String(properties.pkey ?? properties.url ?? "");
        const submitter = properties.source ? String(properties.source) : undefined;
        const tags =
            properties.tags && typeof properties.tags === "object"
                ? (properties.tags as Record<string, unknown>)
                : undefined;
        const city = tags?.city ? String(tags.city) : undefined;

        return [
            {
                id: `peta-${id || `${createdAt}-${coordinates.join(",")}`}`,
                source: "PetaBencana" as const,
                coordinates,
                detectedAt: createdAt,
                confidence: "reported" as const,
                title: String(properties.title ?? "Laporan kebakaran"),
                detail: [city ? `Wilayah: ${city}` : null, submitter ? `Dilaporkan melalui ${submitter}` : null]
                    .filter(Boolean)
                    .join(" · ") || undefined,
            },
        ];
    });
}

function normalizeConfidence(value: string): FireConfidence {
    const normalized = value.trim().toLowerCase();
    if (normalized === "h" || normalized === "high") return "high";
    if (normalized === "l" || normalized === "low") return "low";
    if (normalized === "n" || normalized === "nominal" || normalized === "medium") {
        return "medium";
    }

    const numeric = Number(normalized);
    if (Number.isFinite(numeric)) {
        if (numeric >= 80) return "high";
        if (numeric >= 30) return "medium";
    }
    return "low";
}

function parseFirmsCsv(csv: string): FireDetection[] {
    const [headerLine, ...rows] = csv.trim().split(/\r?\n/);
    if (!headerLine) return [];

    const columns = new Map(
        headerLine.split(",").map((name, index) => [name.trim(), index])
    );
    const read = (cells: string[], name: string) => {
        const index = columns.get(name);
        return index === undefined ? "" : (cells[index] ?? "").trim();
    };

    return rows.flatMap((row) => {
        const cells = row.split(",");
        const latitude = Number(read(cells, "latitude"));
        const longitude = Number(read(cells, "longitude"));
        const coordinates = pointCoordinates([longitude, latitude]);
        const date = read(cells, "acq_date");
        const time = read(cells, "acq_time").padStart(4, "0");
        if (!coordinates || !date || !/^\d{4}$/.test(time)) return [];

        const detectedAt = new Date(
            `${date}T${time.slice(0, 2)}:${time.slice(2)}:00Z`
        );
        if (Number.isNaN(detectedAt.getTime())) return [];

        const satellite = read(cells, "satellite") || FIRMS_SOURCE;
        const confidence = normalizeConfidence(read(cells, "confidence"));
        const frp = Number(read(cells, "frp"));

        return [
            {
                id: `firms-${satellite}-${date}-${time}-${coordinates.join(",")}`,
                source: "NASA FIRMS" as const,
                coordinates,
                detectedAt: detectedAt.toISOString(),
                confidence,
                title: "Titik panas satelit",
                detail: `Satelit ${satellite}`,
                ...(Number.isFinite(frp) ? { frp } : {}),
            },
        ];
    });
}

async function fetchPetaReports(): Promise<FireDetection[]> {
    const response = await fetch(PETA_REPORTS_URL, {
        next: { revalidate: 300 },
    });
    if (!response.ok) throw new Error(`PetaBencana ${response.status}`);
    return parsePetaReports((await response.json()) as PetaResponse);
}

async function fetchFirmsDetections(mapKey: string): Promise<FireDetection[]> {
    const url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${encodeURIComponent(
        mapKey
    )}/${FIRMS_SOURCE}/${INDONESIA_BBOX}/1`;
    const response = await fetch(url, { next: { revalidate: 120 } });
    if (!response.ok) throw new Error(`NASA FIRMS ${response.status}`);
    return parseFirmsCsv(await response.text());
}

interface EonetGeometry {
    date?: string;
    type?: string;
    coordinates?: unknown;
    magnitudeValue?: number;
    magnitudeUnit?: string;
}

interface EonetEvent {
    id?: string;
    title?: string;
    link?: string;
    geometry?: EonetGeometry[];
}

function parseEonetEvents(data: { events?: EonetEvent[] }): FireDetection[] {
    return (data.events ?? []).flatMap((event) => {
        const points = (event.geometry ?? []).filter(
            (g) => g.type === "Point"
        );
        const latest = points[points.length - 1];
        const coordinates = pointCoordinates(latest?.coordinates);
        if (!event.id || !event.title || !latest?.date || !coordinates) {
            return [];
        }

        const detailParts = ["Peristiwa kebakaran masih terpantau"];
        if (latest.magnitudeValue != null && latest.magnitudeUnit) {
            detailParts.push(
                `luas terdampak ~${latest.magnitudeValue} ${latest.magnitudeUnit === "acres" ? "acre" : latest.magnitudeUnit}`
            );
        }
        if (event.link) detailParts.push("NASA EONET");

        return [
            {
                id: `eonet-${event.id}`,
                source: "NASA EONET" as const,
                coordinates,
                detectedAt: latest.date,
                confidence: "high" as const,
                title: event.title,
                detail: detailParts.join(" · "),
            },
        ];
    });
}

async function fetchEonetEvents(): Promise<FireDetection[]> {
    const response = await fetch(EONET_EVENTS_URL, {
        next: { revalidate: 600 },
    });
    if (!response.ok) throw new Error(`NASA EONET ${response.status}`);
    return parseEonetEvents(await response.json());
}

/* ---------- cross-verifikasi antar-sumber ---------- */

function distanceKm(
    a: [number, number],
    b: [number, number]
): number {
    const rad = Math.PI / 180;
    const dLat = (b[0] - a[0]) * rad;
    const dLon = (b[1] - a[1]) * rad;
    const h =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(a[0] * rad) *
            Math.cos(b[0] * rad) *
            Math.sin(dLon / 2) ** 2;
    return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/**
 * Tandai deteksi yang dikonfirmasi sumber lain dalam radius tertentu.
 * Laporan warga (PetaBencana) butuh satelit dekat (5 km); sesama produk
 * satelit (FIRMS/EONET) memakai radius lebih lebar karena sentroidnya kasar.
 */
function applyCrossVerification(detections: FireDetection[]): FireDetection[] {
    return detections.map((detection) => {
        const radius = VERIFY_RADIUS_KM[detection.source] ?? 5;
        const verifiedBy = new Set<string>();
        let nearest: number | undefined;

        for (const other of detections) {
            if (other.source === detection.source) continue;
            const d = distanceKm(detection.coordinates, other.coordinates);
            if (d <= radius) {
                verifiedBy.add(other.source);
                if (nearest === undefined || d < nearest) nearest = d;
            }
        }

        if (verifiedBy.size === 0) return detection;
        return {
            ...detection,
            verifiedBy: [...verifiedBy],
            verifyDistanceKm:
                nearest !== undefined ? Math.round(nearest * 10) / 10 : undefined,
        };
    });
}

export async function GET(request: Request) {
    const firmsMapKey = process.env.FIRMS_MAP_KEY;
    const [petaResult, firmsResult, eonetResult] = await Promise.allSettled([
        fetchPetaReports(),
        firmsMapKey ? fetchFirmsDetections(firmsMapKey) : Promise.resolve([]),
        fetchEonetEvents(),
    ]);

    let detections: FireDetection[] = [];
    const sources: Record<string, FireSourceStatus> = {
        PetaBencana: { ok: false, count: 0, configured: true },
        "NASA FIRMS": {
            ok: false,
            count: 0,
            configured: Boolean(firmsMapKey),
            ...(!firmsMapKey ? { error: "FIRMS_MAP_KEY belum diatur." } : {}),
        },
        "NASA EONET": { ok: false, count: 0, configured: true },
    };

    if (petaResult.status === "fulfilled") {
        detections.push(...petaResult.value);
        sources.PetaBencana = {
            ok: true,
            count: petaResult.value.length,
            configured: true,
        };
    } else {
        sources.PetaBencana.error =
            petaResult.reason instanceof Error
                ? petaResult.reason.message
                : "Sumber data tidak tersedia.";
    }

    if (firmsMapKey && firmsResult.status === "fulfilled") {
        detections.push(...firmsResult.value);
        sources["NASA FIRMS"] = {
            ok: true,
            count: firmsResult.value.length,
            configured: true,
        };
    } else if (firmsMapKey && firmsResult.status === "rejected") {
        sources["NASA FIRMS"].error =
            firmsResult.reason instanceof Error
                ? firmsResult.reason.message
                : "Sumber data tidak tersedia.";
    }

    if (eonetResult.status === "fulfilled") {
        detections.push(...eonetResult.value);
        sources["NASA EONET"] = {
            ok: true,
            count: eonetResult.value.length,
            configured: true,
        };
    } else {
        sources["NASA EONET"].error =
            eonetResult.reason instanceof Error
                ? eonetResult.reason.message
                : "Sumber data tidak tersedia.";
    }

    detections = applyCrossVerification(detections);

    detections.sort(
        (a, b) => new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime()
    );

    const payload = {
        detections,
        sources,
        updatedAt: new Date().toISOString(),
    };

    return cachedJsonResponse(request, "fires", payload, {
        detections,
        sources,
    });
}
