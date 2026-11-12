# Rutina

Pelacak kebiasaan dan arus kas harian — PWA satu file bertema taman botani ("Evergreen"), berbahasa Indonesia, mobile-first. Versi terkini: **v2.43** (`APP_VERSION` di `public/rutina.html`).

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
4. **v2.35**: kolom `Habit.mini` / `Habit.afterId` / `AppSettings.identityText` ditambahkan lewat migrasi `ALTER` idempoten di API — database lama (Turso maupun lokal) tak perlu dibuat ulang.
5. **v2.36**: audit dalam — agregat "hari ini" (`syncToday`) kini akurat saat untoggle: suara identitas, statistik & heatmap tak lagi menghitung hari yang dibatalkan sampai reload; semantik log amount parsial (v2.15) tetap terjaga.
6. **v2.37**: kolom `Transaction.recurrence` (mingguan/bulanan) + jurnal `habitMeta` diperluas (nama/emoji/kategori/jam/grup) — keduanya lewat migrasi `ALTER` idempoten, database lama aman.
7. **v2.38**: desain ulang komposer **Pengeluaran kilat** — nominal & dompet dibungkus `.field` (bahasa form aplikasi: 48px, radius 14, tepi 1.5px, fokus cincin terra) menggantikan kontrol mentah; art kepala kartu memakai varian `.head-art.honey` yang sah.
8. **v2.39**: audit menyeluruh menemukan fitur check-in mood/energi/tidur yang diminta tak pernah terkirim — kini lengkap: kartu **Check-in harian** di Ringkasan (skala 1–5 + lama tidur) menulis lewat jurnal overlay `dailyLog` (kunci tanggal) ke tabel `DailyLog` (UPSERT idempoten). Rapian audit: tinggi nama tanaman dikunci 2 baris (baseline strip rata), `.sc-grid` terdefinisi eksplisit, simbol sprite vestigial dibuang.
12. **v2.43**: **total tiap tanggal di Mutasi Transaksi** — kepala grup tanggal kini pola rekening-koron: label hari kiri, total hari kanan (senada strip Masuk/Keluar/Net di atasnya). Total mengikuti filter aktif — Semua → net harian (masuk−keluar, transfer netral); Masuk/Keluar/Transfer → jumlah jenis itu — dan dihitung dari baris yang TAMPAK (ikut bulan & kata kunci pencarian) sehingga angka kepala selalu cocok dengan daftar di bawahnya. Rincian kecil "+masuk · –keluar" tampil di layar ≥480px (ponsel bersih), tooltip merinci jumlah transaksi tiap jenis; warna sage/rose + angka tabular senada tipografi angka aplikasi.
11. **v2.42**: pulihan audit "hilang-muncul saat app dibuka" — **first paint instan**: data tertanam dilukis segera (animasi tunas ikut jalan), jaringan menyusul; bila data hidup identik, nol repaint — bila berbeda, angka menggulir mulus. **Data basi kini terlihat**: chip amber di bawah topbar ("Data per 9 Nov — koneksi database belum terjangkau") + tombol **Coba lagi** + 3x coba-ulang otomatis dengan backoff — dulu snapshot usang dipakai diam-diam tanpa penanda. **Reload SW aman**: pembaruan service worker tak lagi memuat ulang di tengah sesi aktif — ditunda sampai tab berpindah visibilitas. Font Geist utama di-preload (FOUT berkurang).
10. **v2.41**: perbaikan kritis "flicker gulir" — sejak v2.31 kartu di bawah lipatan (reveal saat digulir, kelas `.rv`) memakai fill-mode `backwards`, sehingga **setelah animasi masuk usai kartu kembali tak terlihat** (dan tak pernah reveal ulang: chart donat Keuangan, 21 kartu Kebiasaan, kartu Wawasan "hilang" setelah digulir; gulir balik pun tetap bolong). Kini `both` — nilai akhir ditahan, konten bertahan setelah muncul.
9. **v2.40**: pulihan audit UI/UX profesional — token aksen teks digelapkan sampai lolos **WCAG AA 4.5:1** di semua latar (terra/sage/honey/sky `-deep`; bonus `.btn-check.done` 3.77→5.48:1, tombol bahaya & lencana notifikasi naik ke rose-deep); target sentuh chip pemilih jam & `.btn-sm` 44px di ponsel; **tautan lompat** "Langsung ke konten" + `<main tabindex="-1">`; pemantik modal ditangkap eksplisit agar fokus kembali ke tombol pembuka juga setelah tap layar sentuh; bar progres hero sebaris penuh di ponsel dengan jejak lebih terlihat; keluarga CSS agenda/counter sisa tampilan lama dibuang.

## Fitur utama

- **Ringkasan** — progres harian, tren, animasi pembuka "Tunas Pagi", kartu **Semangat Hari Ini** (kutipan harian yang menempel pada progres asli), dan kartu **Suara Identitas** (Atomic Habits): tulis "aku yang ingin jadi…" sekali — tersinkron ke database — lalu tiap centang kebiasaan dihitung sebagai satu suara (pekan ini & total). Kartu **Catat Cepat** (v2.37): chip kebiasaan sekali-tap + komposer pengeluaran kilat (nominal → kategori teratas → dompet), didesain ulang v2.38 mengikuti bahasa form aplikasi. Kartu **Check-in Harian** (v2.39): mood · energi · tidur — tersinkron ke tabel `DailyLog`, terlihat juga di detail hari.
- **Kebiasaan** — pelacakan harian, target kuantitatif, riwayat mingguan, plus mekanik Atomic Habits: nudge **Jangan Bolong Dua Kali** (kartu yang kemarin terlewat), **Versi 2 Menit** + **Susun Kebiasaan** (jangkar "setelah X, aku akan Y"; kolom `Habit.mini`/`Habit.afterId`), dan nudge **Goldilocks** (pekan sempurna → "naik kelas?"; pekan <50% → "perkecil takarannya?"). Hero pohon tahap benih/tunas membawa microcopy **Fase Akar** (Plato Potensi Tersembunyi). **Sunting kebiasaan** (v2.37): aksi drill mengubah nama/kategori/grup/jam/versi mini/jangkar/ilustrasi tanpa kehilangan riwayat (jurnal `habitMeta`; ikon tersimpan di kolom `emoji` sebagai id `ill-…`). **Taman kebiasaan** (v2.37): tiap kebiasaan tampil sebagai tanaman (benih → tunas → pohon muda → pohon dewasa → berbunga, dari total catatan) di strip yang menggulir — tinggi nama dikunci dua baris (v2.39) supaya label tahap rata antar kartu.
- **Keuangan** — transaksi + transfer antar-dompet, dompet, anggaran per kategori, peta panas pengeluaran; tiga anak tab (Analisa / Mutasi / Saldo Bank). Mutasi Transaksi (v2.43) membawa **total tiap tanggal** di kepala grup — net harian atau jumlah jenis terfilter, selalu cocok dengan baris yang tampak. **Transaksi berulang** (v2.37): pilih "Setiap bulan/minggu" saat mencatat — occurrence jatuh tempo dilahirkan otomatis dengan id deterministik (`rec-…`), hapus instance diingat per perangkat.
- **Kalender** — catatan hari & ritme pekan; **pembanding pekan** (v2.37: hari aktif · catatan · pengeluaran vs pekan lalu) di kartu Ritme Ringkasan, dan **laporan bulanan** (v2.37) yang mengikuti bulan yang dibuka: konsistensi, top-3 kategori, anggaran, refleksi suara identitas.
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
