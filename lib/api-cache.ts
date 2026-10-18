import { createHash } from "node:crypto";

interface CachedResponse {
    identity: string;
    etag: string;
    body: string;
}

const MAX_CACHE_ENTRIES = 128;
const responseCache = new Map<string, CachedResponse>();
const CACHE_CONTROL =
    "public, max-age=0, s-maxage=30, stale-while-revalidate=59";

function hash(value: string): string {
    return createHash("sha256").update(value).digest("base64url");
}

function matchesEtag(header: string | null, etag: string): boolean {
    if (!header) return false;
    return header.split(",").some((candidate) => {
        const value = candidate.trim();
        return value === "*" || value.replace(/^W\//, "") === etag;
    });
}

export function cachedJsonResponse<T>(
    request: Request,
    cacheKey: string,
    payload: T,
    identity: unknown
): Response {
    const identityHash = hash(JSON.stringify(identity));
    let cached = responseCache.get(cacheKey);

    if (!cached || cached.identity !== identityHash) {
        const body = JSON.stringify(payload);
        cached = {
            identity: identityHash,
            etag: `"${hash(body)}"`,
            body,
        };
    }

    responseCache.delete(cacheKey);
    responseCache.set(cacheKey, cached);
    if (responseCache.size > MAX_CACHE_ENTRIES) {
        const oldestKey = responseCache.keys().next().value;
        if (oldestKey) responseCache.delete(oldestKey);
    }

    const headers = new Headers({
        "Cache-Control": CACHE_CONTROL,
        ETag: cached.etag,
        "Content-Type": "application/json; charset=utf-8",
    });

    if (matchesEtag(request.headers.get("if-none-match"), cached.etag)) {
        headers.delete("Content-Type");
        return new Response(null, { status: 304, headers });
    }

    return new Response(cached.body, { status: 200, headers });
}
