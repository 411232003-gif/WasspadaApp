// Salin aset statis Cesium (workers, widget, dsb.) ke public/cesium
// agar bisa disajikan Next.js tanpa lewat bundler. Dipanggil via postinstall.
import { cpSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "node_modules", "cesium", "Build", "Cesium");
const dest = join(root, "public", "cesium");

const parts = ["Workers", "ThirdParty", "Assets", "Widgets", "Cesium.js"];
if (!existsSync(src)) {
  console.warn("[copy-cesium] Build/Cesium tidak ditemukan — lewati.");
  process.exit(0);
}
mkdirSync(dest, { recursive: true });
for (const part of parts) {
  cpSync(join(src, part), join(dest, part), { recursive: true });
}
console.log("[copy-cesium] Aset Cesium tersalin ke public/cesium");
