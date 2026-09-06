"use client";

import dynamic from "next/dynamic";

const SceneClient = dynamic(() => import("./scene-client"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[60vh] items-center justify-center rounded-2xl glass-panel">
      <p className="text-fg-muted">Memuat scene 3D...</p>
    </div>
  ),
});

export default function SceneWrapper() {
  return <SceneClient />;
}
