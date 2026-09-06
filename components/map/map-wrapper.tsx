"use client";

import dynamic from "next/dynamic";

const MapClient = dynamic(() => import("./map-client"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[60vh] items-center justify-center rounded-2xl glass-panel">
      <p className="text-fg-muted">Memuat peta interaktif...</p>
    </div>
  ),
});

export default function MapWrapper() {
  return <MapClient />;
}
