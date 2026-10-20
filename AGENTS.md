<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Preferensi pengguna

- JANGAN pernah menjalankan dev server atau membuka preview website sendiri (`npm run dev`, `npm start`, `browser_preview`, dsb.). Pengguna menjalankannya manual — cukup beri tahu "cek dengan `npm run dev`" setelah perubahan selesai. Verifikasi cukup lewat `npx tsc --noEmit`, `npm run lint`, dan `npm run build`.

