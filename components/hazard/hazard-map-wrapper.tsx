"use client";

import dynamic from "next/dynamic";

const HazardMap = dynamic(() => import("./hazard-map"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[62vh] items-center justify-center rounded-2xl glass-panel">
      <p className="text-fg-muted">Memuat peta hazard...</p>
    </div>
  ),
});

export default function HazardMapWrapper() {
  return <HazardMap />;
}
