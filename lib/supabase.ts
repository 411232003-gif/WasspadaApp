"use client";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SUPABASE_BUCKET =
  process.env.NEXT_PUBLIC_SUPABASE_BUCKET || "chat-images";

const MAX_SIZE_BYTES = 5 * 1024 * 1024;
const TARGET_BYTES = 4.5 * 1024 * 1024;
const MAX_DIMENSION = 1920;

export const CHAT_IMAGE_TTL_MS = 5 * 24 * 60 * 60 * 1000;

export function isSupabaseConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

function requireConfig() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
      "Supabase belum dikonfigurasi. Isi NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_ANON_KEY di .env."
    );
  }
}

function authHeaders(extra?: Record<string, string>) {
  return {
    apikey: SUPABASE_ANON_KEY!,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    ...extra,
  };
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number
): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

async function resizeImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;

  const scale = Math.min(
    1,
    MAX_DIMENSION / Math.max(bitmap.width, bitmap.height)
  );
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return file;
  }
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  let quality = 0.85;
  let blob = await canvasToBlob(canvas, "image/jpeg", quality);
  while (blob && blob.size > TARGET_BYTES && quality > 0.4) {
    quality -= 0.15;
    blob = await canvasToBlob(canvas, "image/jpeg", quality);
  }

  if (!blob) return file;
  return blob.size < file.size || file.size > MAX_SIZE_BYTES ? blob : file;
}

export async function uploadChatImage(file: File): Promise<string> {
  requireConfig();
  if (!file.type.startsWith("image/")) {
    throw new Error("File harus berupa gambar.");
  }

  const blob = await resizeImage(file);
  if (blob.size > MAX_SIZE_BYTES) {
    throw new Error("Gambar tidak dapat dikompres di bawah 5 MB.");
  }

  const baseName = file.name.replace(/\.[^.]+$/, "");
  const safeName = baseName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-50);
  const ext = blob.type === "image/jpeg" ? "jpg" : "img";
  const path = `${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}-${safeName}.${ext}`;

  const res = await fetch(
    `${SUPABASE_URL}/storage/v1/object/${SUPABASE_BUCKET}/${path}`,
    {
      method: "POST",
      headers: authHeaders({
        "Content-Type": blob.type || "application/octet-stream",
        "x-upsert": "false",
      }),
      body: blob,
    }
  );

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Upload foto gagal (${res.status}). ${body}`.trim());
  }

  return `${SUPABASE_URL}/storage/v1/object/public/${SUPABASE_BUCKET}/${path}`;
}

export async function cleanupExpiredChatImages(): Promise<void> {
  if (!isSupabaseConfigured()) return;

  const listRes = await fetch(
    `${SUPABASE_URL}/storage/v1/object/list/${SUPABASE_BUCKET}`,
    {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        prefix: "",
        limit: 1000,
        offset: 0,
        sortBy: { column: "created_at", order: "asc" },
      }),
    }
  );
  if (!listRes.ok) return;

  const items: { name?: string }[] = await listRes.json().catch(() => []);
  const cutoff = Date.now() - CHAT_IMAGE_TTL_MS;
  const expired = items
    .map((i) => i.name)
    .filter((name): name is string => {
      if (!name) return false;
      const match = /^(\d+)-/.exec(name);
      return match ? Number(match[1]) < cutoff : false;
    });

  await Promise.all(
    expired.map((name) =>
      fetch(
        `${SUPABASE_URL}/storage/v1/object/${SUPABASE_BUCKET}/${name}`,
        { method: "DELETE", headers: authHeaders() }
      ).catch(() => {})
    )
  );
}
