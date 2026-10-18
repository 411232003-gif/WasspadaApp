import { NextResponse } from "next/server";
import { cachedJsonResponse } from "@/lib/api-cache";

interface OpenMeteoResponse {
    current_weather?: {
        winddirection?: number;
        windspeed?: number;
    };
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const lat = Number(searchParams.get("lat"));
    const lon = Number(searchParams.get("lon"));

    if (
        !Number.isFinite(lat) ||
        !Number.isFinite(lon) ||
        lat < -90 ||
        lat > 90 ||
        lon < -180 ||
        lon > 180
    ) {
        return NextResponse.json(
            { error: "Koordinat tidak valid." },
            { status: 400, headers: { "Cache-Control": "no-store" } }
        );
    }

    const roundedLat = Number(lat.toFixed(4));
    const roundedLon = Number(lon.toFixed(4));
    const cacheKey = `wind:${roundedLat}:${roundedLon}`;

    try {
        const url = new URL("https://api.open-meteo.com/v1/forecast");
        url.searchParams.set("latitude", String(roundedLat));
        url.searchParams.set("longitude", String(roundedLon));
        url.searchParams.set("current_weather", "true");

        const res = await fetch(url, { next: { revalidate: 60 } });
        if (!res.ok) throw new Error(`Open-Meteo responded ${res.status}`);

        const data = (await res.json()) as OpenMeteoResponse;
        const from = data.current_weather?.winddirection ?? 0;
        const payload = {
            windSpeed: data.current_weather?.windspeed ?? 0,
            windDirectionFrom: from,
            windDirectionTo: (from + 180) % 360,
            updatedAt: new Date().toISOString(),
        };

        return cachedJsonResponse(request, cacheKey, payload, {
            windSpeed: payload.windSpeed,
            windDirectionFrom: payload.windDirectionFrom,
            windDirectionTo: payload.windDirectionTo,
        });
    } catch (error) {
        console.error("Open-Meteo fetch failed:", error);
        return NextResponse.json(
            { error: "Gagal mengambil data angin." },
            { status: 502, headers: { "Cache-Control": "no-store" } }
        );
    }
}