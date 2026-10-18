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

export async function GET(request: Request) {
    const firmsMapKey = process.env.FIRMS_MAP_KEY;
    const [petaResult, firmsResult] = await Promise.allSettled([
        fetchPetaReports(),
        firmsMapKey ? fetchFirmsDetections(firmsMapKey) : Promise.resolve([]),
    ]);

    const detections: FireDetection[] = [];
    const sources: Record<string, FireSourceStatus> = {
        PetaBencana: { ok: false, count: 0, configured: true },
        "NASA FIRMS": {
            ok: false,
            count: 0,
            configured: Boolean(firmsMapKey),
            ...(!firmsMapKey ? { error: "FIRMS_MAP_KEY belum diatur." } : {}),
        },
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
