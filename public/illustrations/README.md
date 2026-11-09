# Ilustrasi spot “Evergreen flat-3D” — katalog

Aset SVG mandiri 96×96 yang mengikuti grammar 7 lapis
[`docs/design-foundation.md`](../../docs/design-foundation.md) §8: latar tema pastel +
kilau radial (`g-bghigh`), bayangan tanah `#0F172A`/opacity .07, subjek bergradien `g-*`,
kilau putih (stroke 2–2.5, opacity .18–.55), aksen kecil, dan maksimal 2 bintang kilau.
Setiap berkas berdiri sendiri (`<defs>` internal) sehingga aman dipakai lewat `<img>`,
CSS background, atau di-inline langsung ke komponen.

## Cara pakai

- Ukuran pakai (§8.3): **34–48** baris agenda · **42–54** judul halaman ·
  **86–110** kartu scene · **180** empty state (maks 70% lebar).
- Gradien memakai ID kanonik (`g-em`, `g-amb`, `g-sky`, …) dengan nilai identik
  dengan sprite `public/rutina.html`, sehingga aman di-inline bersama sprite.
- Uji wajib (§8.5): terbaca pada 34px, tetap indah pada 110px.
- Latar tema per keluarga warna: emerald `#ECFDF5` · amber `#FEF3C7` · sky `#E0F2FE` ·
  biru `#DBEAFE` · peach `#FFEDD5` · slate `#F1F5F9`.

## Katalog

### Kebiasaan — gaya hidup & olahraga (batch 1)

| Berkas | Konsep | Latar tema |
|---|---|---|
| `sepeda.svg` | bersepeda | peach `#FFEDD5` |
| `renang.svg` | berenang | sky `#E0F2FE` |
| `yoga.svg` | yoga pose pohon | emerald `#ECFDF5` |
| `peregangan.svg` | peregangan tubuh | amber `#FEF3C7` |
| `lompat-tali.svg` | lompat tali | peach `#FFEDD5` |
| `hiking.svg` | mendaki gunung | sky `#E0F2FE` |

### Kebiasaan — kesehatan & kreativitas (batch 2)

| Berkas | Konsep | Latar tema |
|---|---|---|
| `vitamin.svg` | minum vitamin | emerald `#ECFDF5` |
| `teh.svg` | waktu minum teh | amber `#FEF3C7` |
| `melukis.svg` | melukis di palet | biru `#DBEAFE` |
| `gitar.svg` | bermain gitar | peach `#FFEDD5` |
| `musik.svg` | dengar musik (headphone) | sky `#E0F2FE` |
| `berkebun.svg` | menyiram tanaman | emerald `#ECFDF5` |

### Keuangan (batch 3)

| Berkas | Konsep | Latar tema |
|---|---|---|
| `qris.svg` | bayar QRIS dari ponsel | emerald `#ECFDF5` |
| `tagihan.svg` | bayar tagihan (stempel lunas) | peach `#FFEDD5` |
| `donasi.svg` | berbagi donasi | amber `#FEF3C7` |
| `tumbuh-koin.svg` | dana tumbuh (koin + kecambah) | amber `#FEF3C7` |
| `sarang.svg` | telur emas di sarang | peach `#FFEDD5` |
| `payung.svg` | perlindungan anggaran | sky `#E0F2FE` |

### Tumbuh & pencapaian (batch 4)

| Berkas | Konsep | Latar tema |
|---|---|---|
| `bunga-matahari.svg` | mekar penuh semangat | amber `#FEF3C7` |
| `kupu-kupu.svg` | transformasi kebiasaan | emerald `#ECFDF5` |
| `lebah.svg` | produktif setiap hari | amber `#FEF3C7` |
| `bonsai.svg` | kesabaran merawat | slate `#F1F5F9` |
| `panen.svg` | hasil konsistensi | peach `#FFEDD5` |
| `kunci.svg` | pencapaian terbuka | amber `#FEF3C7` |

### Wawasan & alat (batch 5)

| Berkas | Konsep | Latar tema |
|---|---|---|
| `teropong.svg` | melihat wawasan lebih jauh | sky `#E0F2FE` |
| `kompas.svg` | arah tujuan yang jelas | sky `#E0F2FE` |
| `peta.svg` | perjalanan membangun kebiasaan | biru `#DBEAFE` |
| `jam.svg` | waktu yang konsisten | sky `#E0F2FE` |
| `awan.svg` | cadangan tersimpan aman | sky `#E0F2FE` |
| `kado.svg` | hadiah pencapaian | peach `#FFEDD5` |

## Ringkasan

- **30 spot ilustrasi baru** dalam 5 batch tematik: gaya hidup & olahraga,
  kesehatan & kreativitas, keuangan, tumbuh & pencapaian, wawasan & alat.
- Semua latar tema & gradien mengikuti katalog warna resmi §2 & §8.2.

---

*Semua ilustrasi digambar tangan mengikuti palet & aturan §8 design-foundation
(v2 Evergreen). Aset lama: `avatar.png`, `botanical-gardener.svg` (gaya v1).*
