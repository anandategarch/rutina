# Konvensi Kode Rutina

Pedoman teknis pendamping `docs/design-foundation.md` (visual) dan
`docs/architecture.md` (batas lapisan lama). Berlaku untuk seluruh kontribusi baru.

## 1. Bahasa & kerangka

- TypeScript **strict**; tanpa `any` (butuh alasan kuat + komentar bila terpaksa).
- Next.js **App Router**; route di `src/app`, domain lama di `src/features`,
  kode server di `src/lib/server` (wajib `import "server-only"`).
- `z-ai-web-dev-sdk` hanya boleh di **backend** — tidak pernah masuk bundle klien.

## 2. Penamaan

| Jenis | Konvensi | Contoh |
|---|---|---|
| File komponen | PascalCase | `HabitCard.tsx` |
| Util/lib, hook | camelCase + `use-` | `finance.ts`, `use-workspace.ts` |
| Tipe domain | PascalCase di `src/lib/types.ts` | `Habit`, `Transaction` |
| API route | kebab, folder per resource | `src/app/api/rutina/route.ts` |
| Simbol SVG | prefiks (`i-` UI, `c-/k-` kategori, `ill-` ilustrasi, `g-` gradien/templat) | `ill-gym-dada`, `g-bghigh` |
| Atribut hook di HTML konsep | `data-*` | `data-nav`, `data-check`, `data-cal` |

## 3. Pola API route (server)

Template resmi — lihat `src/app/api/rutina/route.ts`:

```ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 1. klien dibuat dari env, di-cache modul
// 2. GET: SELECT eksplisit kolom (jangan SELECT * di API publik)
// 3. hasil dipetakan ke bentuk JSON yang stabil & divalidasi bentuknya
// 4. header no-store; error → 502 + log berprefiks [/api/...]
```

- Identifier yang merupakan keyword SQL (`Transaction`, `Habit`) **wajib dikutip**.
- `libsql` dipakai lewat `@libsql/client`; jangan pernah import dari komponen klien.
- Baca-saja untuk data pribadi orang lain: tulis lewat route yang jelas berlabel.

## 4. Environment & rahasia

- `.env` **tidak pernah** di-commit (sudah di-gitignore); template di `.env.example`.
- Nama env per tanggung jawab, tidak berbagi: `TURSO_*` (aplikasi lama, tulis),
  `RUTINA_TURSO_*` (konsep v2, **baca-saja**) — jangan digabung agar skema asli
  tidak tersentuh route lain.
- Tanpa prefix `NEXT_PUBLIC_` untuk nilai rahasia; tidak ada rahasia di log.

## 5. Konsep satu-file (`public/rutina.html`)

- Satu HTML mandiri: CSS+JS+SVG ter-inline; data dari `/api/rutina`
  (fallback `#dbSnapshot` — snapshot **data asli**, bukan data palsu).
- Semua warna/tyfo/radius/shadow dari token `:root` — tidak ada hex baru di komponen.
- JS: satu objek `state`, fungsi `render*()` per wilayah, delegasi klik via `data-*`:
  `data-nav` `data-go` `data-check` `data-cal` `data-close` `data-open-modal`
  `data-tx-type` `data-tx-filter` `data-habit-filter` `data-fin-month`.
- JSON di dalam `<script>` harus di-escape `<\/` agar tidak menutup tag.
- Angka selalu `toLocaleString('id-ID')`; minggu Senin-awal (`AppSettings.weekStart`).

## 6. Prisma & database

- Skema di `prisma/schema.prisma`; file basis data di `db/`.
- Perubahan skema → `bun run db:push`; SQL historis tetap memakai `$queryRaw`
  sesuai `docs/database.md`.

## 7. Git & commit

- Format: `tipe(ruang): pesan` — tipe `feat fix docs chore refactor`.
- Satu commit = satu niat; jangan campur docs dan refactor besar.
- Jangan commit artefak dev (`shots/`, `dev.log`, `dev.pid` — sudah di-gitignore).

## 8. Sebelum kirim

1. `bun run lint` (0 error) dan `bun run typecheck`.
2. Uji 390×844 & 1440×900: tanpa overflow & tanpa `console.error`.
3. Checklist visual §14 di `docs/design-foundation.md`.
4. Ringkas perubahan + hal yang belum diuji di deskripsi PR.
