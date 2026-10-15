"use client";

import dynamic from "next/dynamic";

const MonevMap = dynamic(() => import("./monev-map"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[60vh] items-center justify-center rounded-2xl glass-panel">
      <p className="text-fg-muted">Memuat peta monev...</p>
    </div>
  ),
});

export default function MonevMapWrapper() {
  return <MonevMap />;
}
