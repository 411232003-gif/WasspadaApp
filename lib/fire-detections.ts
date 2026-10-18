export type FireConfidence = "low" | "medium" | "high" | "reported";
export type FireDetectionSource = "PetaBencana" | "NASA FIRMS";

export interface FireDetection {
    id: string;
    source: FireDetectionSource;
    coordinates: [number, number];
    detectedAt: string;
    confidence: FireConfidence;
    title: string;
    detail?: string;
    frp?: number;
}

export interface FireSourceStatus {
    ok: boolean;
    count: number;
    configured: boolean;
    error?: string;
}

export interface FireDetectionsResponse {
    detections: FireDetection[];
    sources: Record<string, FireSourceStatus>;
    updatedAt: string;
    error?: string;
}