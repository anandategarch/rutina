# Rutina

Pelacak kebiasaan dan arus kas harian — PWA satu file bertema taman botani ("Evergreen"), berbahasa Indonesia, mobile-first. Versi terkini: **v2.34** (`APP_VERSION` di `public/rutina.html`).

## Arsitektur

Aplikasi berjalan sepenuhnya dari satu file **`public/rutina.html`** — layout, gaya, ikon, dan mesin data tertanam di dalamnya. Sisa repo hanya penunjang:

```text
public/
  rutina.html      Aplikasi (shell PWA satu file)
  sw.js            Service worker — network-first utk shell & aset, offline-first
  manifest.json    Manifest PWA
  icons/           Ikon PWA (SVG + 192/512 + maskable + apple-touch)
  illustrations/   12 ilustrasi hero & scene yang dipakai shell
  tree/            5 tahap pohon konsistensi (benih→tunas→muda→dewasa→berbunga)
  fonts/           Geist (2 file woff2)
  robots.txt
src/app/
  page.tsx         Route "/" — redirect ke shell (fallback: iframe inline-style)
  api/rutina/      Jembatan data (baca-tulis, idempoten)
  layout.tsx       Layout minimal (cangkang)
```

## Aliran data

1. Shell memuat snapshot tertanam, lalu `GET /api/rutina` untuk data awan.
2. Semua suntingan pengguna ditulis dulu ke localStorage (lapisan overlay), lalu didorong via `POST /api/rutina`.
3. Tanpa `RUTINA_TURSO_URL`, API otomatis memakai SQLite lokal `db/rutina-preview.db` (dibuat & diisi dari snapshot) — mode pratinjau tetap baca-tulis penuh.

## Fitur utama

- **Ringkasan** — progres harian, tren, animasi pembuka "Tunas Pagi", dan kartu **Semangat Hari Ini**: kutipan motivasi kebiasaan yang berganti per hari, menempel pada progres asli, dan membawa ajakan bertindak ke tab kebiasaan.
- **Kebiasaan** — pelacakan harian, target kuantitatif, riwayat mingguan.
- **Keuangan** — transaksi + transfer antar-dompet, dompet, anggaran per kategori, peta panas pengeluaran; tiga anak tab (Analisa / Mutasi / Saldo Bank).
- **Kalender** — catatan hari & ritme pekan.
- **Wawasan** — pola, laporan, lencana.
- **PWA** — pasang ke layar utama, offline-first.

## Menjalankan lokal

```bash
bun install   # atau: npm install
bun run dev   # buka http://localhost:3000
```

Opsional: salin `.env.example` → `.env`, isi `RUTINA_TURSO_URL` & `RUTINA_TURSO_TOKEN` untuk sinkronisasi Turso.

## Deploy

Vercel, branch `main` (lihat `vercel.json`). Set env `RUTINA_TURSO_URL` + `RUTINA_TURSO_TOKEN` di dashboard untuk data awan; tanpa itu API memakai SQLite lokal per-instance.

## Konvensi

- **Satu sumber versi**: `APP_VERSION` di `public/rutina.html` (tampil di footer/topbar). Setiap perubahan perilaku menaikkan versi **dan** `STATIC_CACHE` di `sw.js` supaya klien lama segera diperbarui.
- Mobile-first (diuji di 390×844); semua animasi menghormati `prefers-reduced-motion`.
- Bahasa UI: Indonesia. Aset & konten visual digambar tangan, tanpa dependensi ikon eksternal.
- Riwayat perubahan detail ada di kepala `public/rutina.html` (blok komentar menurun sejak v2.13).
