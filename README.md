# Rutina

Rutina adalah ruang pribadi untuk membangun kebiasaan, mengatur fokus, dan memahami arus keuangan harian dalam satu pengalaman yang tenang dan konsisten.

## Dua lapisan dalam repo ini

| Lapisan | Lokasi | Status | Pedoman desain |
|---|---|---|---|
| **Aplikasi (v1)** — PWA Next.js lengkap | `src/` | Terpelihara | `docs/design-system.md` (ARSIP · “Playful Botanical”) |
| **Konsep (v2)** — “Evergreen” | `public/rutina.html` + `src/app/api/rutina` | **Aktif — arah ke depan** | `docs/design-foundation.md` (AKTIF) |

Konsep v2 adalah prototipe interaktif satu-file yang membaca **data asli** Anda dari
database Turso (mode **baca-saja**): kebiasaan + grup, kategori, transaksi, dompet,
anggaran, dan log harian — lengkap dengan 41 ilustrasi/ikon SVG yang digambar tangan.
Bila Turso tidak terjangkau, halaman otomatis memakai snapshot data asli yang tertanam
(berlabel jelas di footer — tidak pernah ada angka karangan).

## Prinsip produk

- **Mobile-first:** navigasi utama mudah dijangkau dengan satu tangan.
- **Clarity over decoration:** informasi penting tampil lebih dahulu; dekorasi tidak mengalahkan fungsi.
- **One design language:** warna, tipografi, radius, spacing, elevasi, dan interaksi memakai token bersama.
- **Feature boundaries:** setiap domain (Habit, Finance, Calendar, Insights) dipisahkan dari shell aplikasi.
- **Accessible by default:** kontrol memiliki label, fokus terlihat, dan animasi menghormati preferensi reduced-motion.

## Stack

- Next.js App Router
- React + TypeScript (strict)
- Tailwind CSS v4 + CSS design tokens
- Lucide icons
- Turso (libSQL) untuk penyimpanan cloud melalui server-side API
- LocalStorage sebagai mode demo/fallback dan sumber migrasi awal

Node.js minimum: **20.9**.

## Jalankan lokal

```bash
npm install
npm run dev
```

Buka http://localhost:3000. (Di sandbox ini mesin memakai `bun`; keduanya kompatibel.)

Perintah pemeriksaan:

```bash
npm run typecheck
npm run lint
npm run build
```

## Struktur

```text
src/
  app/
    api/
      workspace/          API workspace (aplikasi lama — bisa menulis)
      rutina/             API konsep v2 — BACA-SAJA dari database asli
    layout.tsx            Root layout dan metadata
    page.tsx              Entry point (menampilkan konsep public/rutina.html)
    globals.css           Design tokens dan styling
  components/             Primitive UI dan dialog
  features/               Aplikasi lama (v1)
  lib/                    Domain types, formatting, seed data
public/
  rutina.html             Konsep v2 “Evergreen” — satu file mandiri
docs/
  design-foundation.md    ★ Pedoman AKTIF v2 (warna, tipografi, elevasi, ilustrasi…)
  design-tokens.css       ★ Nilai token canonical siap salin
  code-conventions.md     ★ Konvensi kode & pola API
  design-system.md        Arsip v1 “Playful Botanical”
  architecture.md         Batas lapisan (masih berlaku)
  database.md, pwa.md, rutina-experience-standard.md
AGENTS.md                 Aturan kerja kontributor & AI agent
```

## Database Turso

Rutina menggunakan `@libsql/client` pada server Next.js. Kredensial tidak pernah dikirim ke browser.

Tabel yang dibuat otomatis pada request workspace pertama:
- `habits` — definisi kebiasaan.
- `habit_checkins` — check-in per tanggal.
- `transactions` — pemasukan dan pengeluaran (integer Rupiah).
- `budgets` — batas anggaran per kategori.

SQL awal tersedia di `db/migrations/0001_initial.sql`. API memastikan tabel tersedia secara idempoten sebelum membaca/menulis data. Pada koneksi pertama ke database kosong, data LocalStorage yang sudah ada akan dipindahkan ke Turso.

### Environment variables

Salin `.env.example` ke `.env.local` untuk lokal, lalu isi:

- `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` — aplikasi lama (bisa menulis).
- `RUTINA_TURSO_URL` / `RUTINA_TURSO_TOKEN` — konsep v2. Sengaja **nama env berbeda**:
  `/api/rutina` hanya menjalankan SELECT terhadap database asli dan tidak pernah
  membuat/mengubah tabel, sehingga skema database Anda tidak tersentuh oleh konsep.

Di Vercel, isi variabel tersebut pada **Project → Settings → Environment Variables** untuk Production. Setelah mengubah variabel, buat deployment baru. Jangan memakai prefix `NEXT_PUBLIC_` dan jangan commit `.env.local`.

### Perlindungan akses

Rutina tidak memakai halaman login atau password internal. Akses aplikasi bergantung pada **Vercel Deployment Protection**. Pada pemeriksaan konfigurasi project `habittracker2` tanggal 3 November 2026, Vercel melaporkan SSO protection aktif untuk **Preview**, sedangkan perlindungan Production belum terkonfirmasi aktif. Karena endpoint data tidak memiliki sistem login internal, aktifkan dan verifikasi perlindungan **All Deployments** sebelum menggunakan Production dengan data pribadi.

Setelah perlindungan All Deployments diverifikasi, kamu dapat membuka Rutina dari desktop maupun HP melalui akun Vercel yang memiliki akses ke project. Jangan menonaktifkan Deployment Protection atau membagikan akses team kepada orang lain. Kredensial Turso tetap disimpan server-side.

Saat menjalankan `npm run dev` secara lokal, perlindungan Vercel Authentication tidak berlaku. Jangan mengekspos server lokal ke jaringan publik. Jika variabel Turso belum tersedia, aplikasi tetap berjalan dengan LocalStorage/demo fallback; konsep v2 jatuh ke snapshot data asli yang tertanam di `public/rutina.html`.

## Aturan kontribusi

Baca `AGENTS.md`, `docs/design-foundation.md` (pedoman desain aktif), dan
`docs/code-conventions.md` sebelum menambah fitur atau mengubah visual.
`docs/architecture.md` masih berlaku untuk batas lapisan aplikasi.
