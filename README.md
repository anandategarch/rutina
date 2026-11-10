# Rutina

Pelacak kebiasaan dan arus kas harian. Satu repo, dua lapisan:

| Lapisan | Lokasi | Status | Pedoman |
|---|---|---|---|
| Aplikasi (v1) — PWA Next.js | `src/` | Terpelihara | `docs/design-system.md` (arsip "Playful Botanical") |
| Konsep (v2) "Evergreen" | `public/rutina.html` + `src/app/api/rutina` | Aktif, arah ke depan | `docs/design-foundation.md` |

Konsep v2 adalah prototipe satu file yang membaca data asli dari Turso secara baca-saja. Kenapa dibatasi begitu: prototipe tidak boleh berisiko menyentuh skema database yang dipakai aplikasi utama, jadi `/api/rutina` hanya menjalankan SELECT dan memakai nama env berbeda (`RUTINA_TURSO_URL`, `RUTINA_TURSO_TOKEN`) supaya tidak tertukar dengan kredensial aplikasi lama. Bila Turso tak terjangkau, halaman jatuh ke snapshot data asli yang tertanam; footer selalu menyebut sumbernya, tidak pernah ada angka karangan. Di dalamnya ada 41 ilustrasi dan ikon SVG yang digambar tangan, plus animasi pembuka "Tunas Pagi" di halaman Ringkasan: begitu data tiba, section tumbuh berurutan dari atas ke bawah — sapaan menajam dari kabur, ring progres menggambar dirinya, sparkline merambat — dengan pegas ringan khas tema Evergreen, dan otomatis dilewati bila pengguna mengaktifkan reduced-motion. Fitur baca-saja yang diadaptasi dari aplikasi v1: garis target harian pada ring progres (AppSettings), habit kuantitatif (amount) dengan bar progres unit, kartu jatah harian & proyeksi anggaran (bar laju + penanda ideal), dan peta panas pengeluaran per bulan (skala honey, klik sel untuk ringkasan hari).

Sejak **v2.10**, tab Keuangan mendukung sunting lengkap di sesi tampilan: transaksi bisa diubah (nominal, kategori, sumber, tanggal, catatan; transfer antar-dompet terkunci jenisnya demi konsistensi saldo) dan dihapus lewat dialog konfirmasi, anggaran per kategori bisa ditambah/diubah/dihapus, dompet (sumber dana) bisa ditambah/diubah/dihapus — dompet yang dipakai transaksi akan memutus relasinya dengan aman, dan nama kategori bisa diganti lalu otomatis dipakai ulang oleh semua transaksi serta anggaran pemakainya. Semua statistik (arus kas, donat kategori, jatah harian, peta panas, saldo dompet, kalender harian) langsung dihitung ulang; database asli tetap tak tersentuh sampai menulis API diperkenalkan.

Sejak **v2.11**, tab Keuangan terbagi menjadi tiga anak tab ala rekening koran: **Analisa** (hero arus kas, chip bulan, strip statistik, jatah harian, donat + anggaran, peta panas), **Mutasi Transaksi** (strip posisi Masuk/Keluar/Net untuk bulan terpilih yang ikut berubah saat bulan diganti, plus riwayat lengkap dengan filter, pencarian, dan sunting/hapus), serta **Saldo Bank** (kartu saldo total semua dompet dengan arus bulan berjalan — jatuh ke bulan data terakhir bila bulan berjalan kosong — grid dompet, dan kartu arus dana per dompet dengan bar ganda masuk/keluar). Kontrolnya memakai pola segmented control bertema Evergreen (label diringkas di layar sempit, ARIA tablist, animasi pane menghormati reduced-motion); jarak antar kartu yang tadinya menempel kini seragam 20px, dan tombol "Kelola anggaran" dari Ringkasan mendarat langsung ke pane Analisa.

Sejak **v2.12** (audit mendalam + poles), anak tab Keuangan mengikuti pola WAI-ARIA tablist yang utuh: tiap tab punya `id` + `aria-controls`, tiap pane `aria-labelledby`, roving tabindex berpindah mengikuti tab aktif, panah kiri/kanan berpindah antar anak tab, dan subjudul halaman diumumkan lewat `aria-live="polite"`. Daftar bulan kini dihitung ulang dari transaksi + anggaran setiap kali data berubah (tambah/sunting/hapus), sehingga chip bulan tak lagi menyisakan bulan kosong saat satu-satunya transaksinya dipindah atau dihapus; menghapus anggaran terakhir di sebuah bulan kini juga memulihkan pilihan bulan ke data terbaru yang tersedia. Subjudul Mutasi Transaksi ditulis ulang jadi kalimat yang memandu pengguna, bukan bahasa internal.

## Prinsip

Mobile-first karena dipakai sambil berjalan; navigasi utama harus terjangkau ibu jari. Data tampil lebih dulu, dekorasi belakangan. Semua layar memakai token desain bersama (warna, tipografi, radius, spacing, elevasi) yang nilainya canonical di `docs/design-tokens.css`. Tiap domain (Habit, Finance, Calendar, Insights) dipisahkan dari shell aplikasi. Kontrol berlabel, fokus terlihat, animasi menghormati reduced-motion.

## Stack

Next.js App Router, React, TypeScript strict, Tailwind CSS v4 dengan design tokens CSS, Lucide icons. Penyimpanan cloud lewat Turso (libSQL) yang hanya diakses dari server-side API; LocalStorage menjadi mode demo dan sumber migrasi awal. Node.js minimum: **20.9**.

## Jalankan lokal

```bash
npm install
npm run dev
```

Buka http://localhost:3000. (Di sandbox mesin ini memakai `bun`; keduanya kompatibel.) Sebelum push, jalankan:

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
  rutina.html             Konsep v2 "Evergreen" — satu file mandiri
  illustrations/          30+ ilustrasi SVG Evergreen flat-3D
  tree/                   Tahap pertumbuhan pohon (benih → dewasa)
docs/
  design-foundation.md    ★ Pedoman AKTIF v2 (warna, tipografi, elevasi, ilustrasi…)
  design-tokens.css       ★ Nilai token canonical siap salin
  code-conventions.md     ★ Konvensi kode & pola API
  design-system.md        Arsip v1 "Playful Botanical"
  architecture.md         Batas lapisan (masih berlaku)
  database.md, pwa.md, rutina-experience-standard.md
AGENTS.md                 Aturan kerja kontributor & AI agent
```

## Database Turso

Server Next.js memakai `@libsql/client`. Kredensial tidak pernah dikirim ke browser. Empat tabel dibuat otomatis saat request workspace pertama: `habits` (definisi kebiasaan), `habit_checkins` (check-in per tanggal), `transactions` (pemasukan dan pengeluaran, integer Rupiah), dan `budgets` (batas per kategori). SQL awal ada di `db/migrations/0001_initial.sql`; pembuatannya idempoten. Pada koneksi pertama ke database kosong, data LocalStorage yang sudah ada dipindahkan ke Turso.

### Environment variables

Salin `.env.example` ke `.env.local`, lalu isi `TURSO_DATABASE_URL` dan `TURSO_AUTH_TOKEN` untuk aplikasi lama, serta `RUTINA_TURSO_URL` dan `RUTINA_TURSO_TOKEN` untuk konsep v2 (alasan pemisahan nama ada di paragraf pembuka). Jangan pakai prefix `NEXT_PUBLIC_` dan jangan commit `.env.local`. Di Vercel, isi variabel pada Project → Settings → Environment Variables untuk Production; setelah diubah, buat deployment baru.

### Perlindungan akses

Tidak ada halaman login atau password internal; akses bergantung pada Vercel Deployment Protection. Pemeriksaan konfigurasi project `habittracker2` tanggal 3 November 2026: SSO aktif untuk Preview, Production belum terkonfirmasi aktif. Karena endpoint data tidak punya login sendiri, aktifkan dan verifikasi **All Deployments** sebelum memakai Production dengan data pribadi. Setelah itu Rutina bisa dibuka dari desktop maupun HP lewat akun Vercel yang punya akses ke project; jangan menonaktifkan Deployment Protection atau membagikan akses team ke orang lain.

Saat `npm run dev` lokal, perlindungan Vercel tidak berlaku, jadi jangan ekspos server lokal ke jaringan publik. Bila variabel Turso kosong, aplikasi tetap jalan dengan LocalStorage/demo dan konsep v2 jatuh ke snapshot tertanam.

## Aturan kontribusi

Baca `AGENTS.md`, `docs/design-foundation.md` (pedoman desain aktif), dan `docs/code-conventions.md` sebelum menambah fitur atau mengubah visual. `docs/architecture.md` masih berlaku untuk batas lapisan aplikasi.
