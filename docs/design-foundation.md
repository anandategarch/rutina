# Pondasi Desain Rutina · v2 “Evergreen”

> **Status: AKTIF.** Dokumen ini adalah pedoman resmi untuk seluruh UI baru dan konsep
> `public/rutina.html`. Pedoman lama (`docs/design-system.md` v1 “Playful Botanical”)
> telah **diarsipkan** dan hanya berlaku untuk aplikasi lama di `src/`.
> Teman kerja: `docs/design-tokens.css` (nilai token siap salin) dan
> `docs/code-conventions.md` (aturan kode).

## 0. Cara memakai dokumen ini

- Semua tabel berisi **nilai eksak** — salin dari `docs/design-tokens.css`, jangan diketik ulang.
- Aturan **Jangan** sama kuatnya dengan aturan **Gunakan**.
- Perubahan token wajib menaikkan versi kecil (2.x) dan dicatat di §15.

---

## 1. Identitas

### 1.1 Karakter produk

Tiga kata kunci: **tenang, terang, tumbuh.**
Rutina terasa seperti halaman jurnal pagi — bukan panel administrasi. Ruang bernapas,
aksen dipakai hemat, dan setiap angka punya tempat yang jujur.

### 1.2 Lima prinsip (urutan = prioritas)

1. **Data jujur.** Tidak ada angka karangan. Semua metrik punya definisi resmi (§13).
   Bila data kosong, tampilkan empty state — jangan pura-pura ada.
2. **Ketenangan di atas kebisingan.** Satu layar = satu aksen kuat. Sisanya netral.
3. **Elevasi berbahasa.** Tiga tingkat shadow punya makna (§6) — bukan hiasan acak.
4. **Angka adalah warga kelas satu.** `tabular-nums`, hierarki tegas, format `id-ID`.
5. **Bahasa manusia.** Indonesia yang hangat-tenggang. Istilah teknis diterjemahkan
   (§12), tanpa jargon dan tanpa drama.

---

## 2. Warna

### 2.1 Primer — Emerald (identitas)

| Token | Nilai | Pakai untuk |
|---|---|---|
| `--terra` | `#10B981` | Aksi utama, nav aktif, link, fokus ring, tick kalender aktif |
| `--terra-deep` | `#059669` | Hover, teks di atas permukaan hijau muda, eyebrow |
| `#34D399` | gradient atas brand-mark | — |
| `--terra-soft` | `#D1FAE5` | Chip streak, latar spot, item nav aktif |
| `--terra-softer` (`--cream`) | `#ECFDF5` | Latar tema ilustrasi, state terpilih |
| `#A7F3D0` / `#BBF7D0` | — | Border state selesai/hover kartu |
| `#6EE7B7` / `#F0FDF4` | — | Aksen tengah / wash latar hero |

### 2.2 Sekunder & aksen

| Keluarga | Basis | Deep | Soft | Peran |
|---|---|---|---|---|
| Biru | `#3B82F6` | `#2563EB` | `#DBEAFE` | Belajar, kategori Learning, link sekunder |
| Amber (honey) | `#F59E0B` | `#D97706` | `#FEF3C7` | Peringatan ramah, sorotan, ilustrasi hangat |
| Sky | `#0EA5E9` | `#0284C7` | `#E0F2FE` | Kesehatan, arus data, ilustrasi udara/air |

### 2.3 Status

| Status | Warna | Deep | Soft | Pakai untuk |
|---|---|---|---|---|
| Sukses / masuk | `#22C55E` | `#16A34A` | `#DCFCE7` | Bar masuk, pemasukan, penanda selesai |
| Peringatan | `#F97316` | `#EA580C` | — | Bar keluar pada grafik, anggaran mulai penuh |
| Bahaya | `#EF4444` | `#DC2626` | `#FEE2E2` | Melebihi batas, nilai negatif, error |

### 2.4 Netral (kerangka)

| Token | Nilai | Peran |
|---|---|---|
| `--bg` | `#F8FAFC` | Kanvas aplikasi + pola titik `--line-soft` 1px/26px |
| `--bg-deep` | `#F1F5F9` | Track bar, segmen, sel heatmap kosong |
| `--surface` | `#FFFFFF` | Kartu, sheet, dock |
| `--surface-2` | `#F8FAFC` | Baris tabel, permukaan dalam kartu |
| `--line` | `#E2E8F0` | Border kartu/form (1px) |
| `--line-soft` | `#EEF2F6` | Pembatas internal, pola titik kanvas |
| `--ink` | `#0F172A` | Teks utama (jangan `#000`) |
| `--ink-2` | `#475569` | Teks sekunder |
| `--ink-3` | `#94A3B8` | Metadata, placeholder |

### 2.5 Palet kategori kebiasaan (dari `HabitOption`)

`General #64748B` · `Health #10B981` · `Fitness #F97316` · `Learning #3B82F6` ·
`Mindfulness #8B5CF6` · `Productivity #F59E0B` · `Social #EC4899` · `Creative #D946EF` ·
`Olahraga #F49B25` — dipakai untuk titik kategori, tag, dan warna teks tag.

### 2.6 Palet kategori keuangan (dari `FinanceCategory`)

27 kategori punya pasangan ikon+warna tetap di `FIN_STYLE` (lihat `public/rutina.html`).
Kategori baru tanpa entri memakai fallback: hash nama →
`FIN_PAL = ['#059669','#0EA5E9','#3B82F6','#6366F1','#8B5CF6','#EC4899','#F43F5E','#F97316','#EAB308','#14B8A6','#64748B']`.
**Jangan** menambah warna baru ad hoc — daftarkan di `FIN_STYLE`.

### 2.7 Aturan pemakaian warna

1. Latar gelap memakai `--ink` (`#0F172A`), **bukan** `#000`.
2. Teks di atas `--terra-soft` selalu `--terra-deep`, bukan `--terra`.
3. Satu elemen = satu keluarga warna; status (honey/rose) tidak dicampur dengan aksen.
4. Latar ikon berwarna memakai pola `${warna}1F` (12% alpha) + ikon `color: ${warna}`.
5. Nilai negatif uang → `--rose-deep` (teks dan/atau angka), positif masuk → `--sage-deep`.
6. Gradasi hanya untuk brand-mark, nav aktif, dan objek ilustrasi — bukan kartu.
7. Semua warna baru harus lewat token; **jangan** hex baru di komponen.
8. Jangan mewarnai border dengan warna status pada kartu netral (cukup bar + label).

---

## 3. Tipografi

Sistem font tunggal: **Plus Jakarta Sans** (display + body, 400–800) — karya Tokotype
(Indonesia) yang juga dipakai ekosistem Gojek/GoPay. Satu keluarga font = satu "suara"
tipografi, pola yang sama dengan aplikasi fintech Indonesia modern (GoPay, Livin',
SeaBank). Variable font via Google Fonts dengan `display=swap`; x-height tinggi dan
bentuk geometric-humanist menjaga keterbacaan di layar 360px. Heading dan angka besar
memakai **ExtraBold 800** untuk mempertahankan bobot display.

### 3.1 Skala

| Peran | Font | Ukuran | Berat | Lain-lain |
|---|---|---|---|---|
| H1 halaman | Plus Jakarta Sans | `clamp(24px, 3vw, 28px)` | 800 | `ls -.02em; lh 1.18; text-wrap: balance` |
| H2 hero | Plus Jakarta Sans | `clamp(21px, 2.6vw, 26px)` | 800 | maks lebar ±340px |
| H3 kartu | Plus Jakarta Sans | 17px | 800 | — |
| Angka besar (stat) | Plus Jakarta Sans | 25px (mobile 20px) | 700 | `t-num` (tabular), unit `<small>` body 600 |
| Angka hero | Plus Jakarta Sans | 30px | 700–800 | warna `--terra-deep` |
| Eyebrow | Plus Jakarta Sans | 11px | 800 | `uppercase; ls .14em; color --terra-deep` |
| Body | Plus Jakarta Sans | 14–16px | 400–500 | `lh 1.55` |
| Sub / meta | Plus Jakarta Sans | 13px | 500–600 | `--ink-3` |
| Caption/tag | Plus Jakarta Sans | 10.5–12px | 600–800 | tag: 10.5/800 |
| Nominal transaksi | Plus Jakarta Sans | 14.5px | 800 | `t-num`, rata kanan |

### 3.2 Aturan angka

- `font-variant-numeric: tabular-nums` (class `t-num`) untuk **semua** angka uang/jumlah.
- Rupiah: `'Rp ' + n.toLocaleString('id-ID')` → `Rp 1.234.567`; ringkas: `1,2 jt`, `250 rb`.
- Tanggal panjang: `Senin, 9 November 2026`; pendek: `9 Nov`.
- Minggu dimulai **Senin** (mengikuti `AppSettings.weekStart`).

---

## 4. Spasi & tata letak

### 4.1 Skala spasi

Basis 4px: gunakan **4 · 8 · 12 · 16 · 24**. Gap kartu 16; `card-pad` 16; hero 24;
`view` atas 24 / bawah 44; mobile 18 + 110 (ruang dock). Section berikutnya: 20–24.

### 4.2 Kerangka

- Kontainer maks **1180px**, lebar sidebar **268px**.
- Topbar 70px sticky (blur 14, latar `color-mix(bg 82% putih)`).
- Dock mengambang (mobile): kiri/kanan 14, bawah `14 + safe-area`, radius 24.
- Breakpoints: **640** (kolom tunggal) · **900** (grid runtuh) · **1024** (sidebar ⇄ dock) · 1180.

### 4.3 Resep grid

`stats` 4 kolom · `habit-grid` 2 · `badge-grid` 6→3→2 · `g-main` 1.45/1 · `g-fin` 3 ·
`g-donut` 1/1.35 · `g-cal` 1.5/1 · `g-waw` 1.5/1 · `dompet-grid` 3→2→1.
Semua kolom konten memakai `minmax(0,1fr)` — jangan `1fr` telanjang (mencegah overflow).

---

## 5. Radius

| Elemen | Radius |
|---|---|
| Kartu (`--r-lg`) | 16px |
| Hero (`--r-xl`) | 20px |
| Tombol / input / icon-btn | 14px (`--r-md`+2) |
| Chip kecil / spot kecil | 10–12px (`--r-sm`) |
| Dock | 24px · Sheet modal 28px |
| Pill, streak, track bar | 999px |
| Lingkaran: spot, avatar, btn-check | 50% |

---

## 6. Elevasi — Beautiful Shadows

Tiga tingkat, **netral**, berlapis. Nilai eksak (jangan diubah sesuka hati):

```css
--shadow-sm:
  0px 2px 3px -1px rgba(0,0,0,.1),
  0px 1px 0px 0px rgba(25,28,33,.02),
  0px 0px 0px 1px rgba(25,28,33,.08);
--shadow-md:
  0px 0px 0px 1px rgba(0,0,0,.06),
  0px 1px 1px -0.5px rgba(0,0,0,.06),
  0px 3px 3px -1.5px rgba(0,0,0,.06),
  0px 6px 6px -3px rgba(0,0,0,.06),
  0px 12px 12px -6px rgba(0,0,0,.06),
  0px 24px 24px -12px rgba(0,0,0,.06);
--shadow-lg:
  0 2.8px 2.2px rgba(0,0,0,.034),
  0 6.7px 5.3px rgba(0,0,0,.048),
  0 12.5px 10px rgba(0,0,0,.06),
  0 22.3px 17.9px rgba(0,0,0,.072),
  0 41.8px 33.4px rgba(0,0,0,.086),
  0 100px 80px rgba(0,0,0,.12);
```

| Tier | Makna | Komponen |
|---|---|---|
| **sm** | kontrol ringkas, permukaan sunyi | brand-mark, `btn-primary` saat diam, pill dock aktif, `ph-art`, seg aktif, dompet-card, hover icon-btn |
| **md** | permukaan terangkat default | **semua** `.card`, hero-quote, elevasi saat hover (btn-primary hover, habit-card hover) |
| **lg** | lift terkuat, momen penting | hero ringkasan, dock mengambang, sheet modal, toast |

Aturan:
1. Satu kekuatan per status; elevasi berubah hanya bila status berubah (diam→hover boleh naik satu tier).
2. **Netral selalu** — dilarang shadow berwarna/glow (`rgba(hijau,…)` dilarang).
3. Daftar padat (baris transaksi, agenda, sel kalender) **tanpa** shadow.
4. Jangan menumpuk dua utilitas shadow pada satu elemen.
5. Ring status (`.hm-cell.today`, `.wd.today`) adalah **penanda status**, bukan elevasi — biarkan.
6. `Beautiful lg` tidak untuk kontrol kecil / list.

---

## 7. Ikonografi

Tiga keluarga simbol SVG (sprite dalam `rutina.html`), semuanya `currentColor`:

| Keluarga | Awalan | viewBox | Gaya | Ukuran pakai |
|---|---|---|---|---|
| UI (navigasi & aksi) | `i-` | 24 | stroke 2–2.6, round | 20px default (14–22 pada slot padat) |
| Kategori keuangan | `c-` / `k-` | 24 | stroke 2, round | 16–20px dalam lingkaran `${warna}1F` |
| Ilustrasi spot | `ill-` | 96 | flat-3D (§8) | lihat §8.3 |

Aturan: `aria-hidden="true"` pada SVG + teks `sr-only`/label pada tombol ikon;
jangan campur ketebalan stroke dalam satu layar; ikon tidak pernah diwarnai hex langsung.

---

## 8. Ilustrasi — grammar “Evergreen flat-3D”

### 8.1 Tujuh lapis (urutan wajib)

```svg
<symbol id="ill-contoh" viewBox="0 0 96 96">
  <!-- L1 latar tema: pastel + kilau -->
  <circle cx="48" cy="48" r="46" fill="#ECFDF5"/>
  <circle cx="48" cy="48" r="46" fill="url(#g-bghigh)"/>
  <!-- L2 bayangan tanah -->
  <ellipse cx="48" cy="74" rx="17" ry="3.5" fill="#0F172A" opacity=".07"/>
  <!-- L3 subjek: gradien g-* -->
  <path d="…" fill="url(#g-em)"/>
  <!-- L4 kilau putih -->
  <path d="…" stroke="#FFFFFF" stroke-width="2" opacity=".35"
        stroke-linecap="round" fill="none"/>
  <!-- L5 aksen kecil -->
  <circle cx="22" cy="22" r="3" fill="#10B981"/>
  <!-- L6 bintang kilau (#FBBF24) -->
  <path d="M72 26l1.2 3.2 3.2 1.2-3.2 1.2L72 34.8l-1.2-3.2-3.2-1.2 3.2-1.2z" fill="#FBBF24"/>
</symbol>
```

Latar tema per keluarga warna: emerald `#ECFDF5` · amber `#FEF3C7` · sky `#E0F2FE` ·
biru `#DBEAFE` · peach `#FFEDD5` · slate `#F1F5F9`.
Kulit: `#FCD9B8` (utama) / `#F5C09A` (bayang); rambut & garis: `#1E293B`.

### 8.2 Katalog gradien

| ID | Atas → Bawah | Peran |
|---|---|---|
| `g-em` | `#34D399 → #059669` | objek primer hijau |
| `g-em2` | `#6EE7B8 → #10B981` | objek hijau sekunder |
| `g-amb` | `#FCD34D → #D97706` | objek amber primer |
| `g-amb2` | `#FDE68A → #F59E0B` | objek amber sekunder |
| `g-org` | `#FB923C → #EA580C` | aksen oranye kuat |
| `g-sky` | `#7DD3FC → #0284C7` | objek biru-langit |
| `g-blu` | `#60A5FA → #2563EB` | objek biru |
| `g-slate` | `#CBD5E1 → #94A3B8` | objek netral/logam |
| `g-bghigh` | radial putih | selalu di atas L1 |

### 8.3 Ukuran pakai

| Konteks | Wadah | Ilustrasi |
|---|---|---|
| Baris agenda / find-item | spot 50–56 | 34–48 |
| `head-art` kartu | 44 | 36 |
| `ph-art` judul halaman | 54 | 42 |
| `mini-stat` | 46 | 38 |
| Ilustrasi kartu scene | — | 86–110 |
| Empty state | — | 180 (maks 70%) |
| Lencana | — | 74 |
| Hero | — | viewBox 480×320 |

### 8.4 Katalog simbol (ringkas)

- **Kebiasaan (96):** `ill-meditasi · lari · sarapan · baca · air · jurnal · tidur · beban`
  plus 17 baru dari data asli: `belajar · bangun · jalan · memasak · badminton · bersih ·
  ranjang · cucisepatu · sikatgigi` dan keluarga gym `gym-dada · gym-punggung · gym-bahu ·
  gym-lengan · gym-perut · gym-kaki · gym-full` (semuanya berbagi templat `g-body`
  + sorotan kuning pada zona otot).
- **Sistem & keuangan:** `ill-hero(480×320) · piggy · dompet · naik · keranjang · kosong ·
  pagi · rumah · api · piala · medali · sprout · bulan · roket · target · bulb · kal ·
  koin · bintang · perisai · jatah · panas`.
- **Ikon kategori:** `c-*` (makanan … tag) dan `k-*` (pendidikan, investasi, kopi, jajan,
  servis, dating, parkir, badminton, loundry, skincare, potong, takterduga, pajak, hutang,
  listrik, air, pulsa, iuran, adjust, transfer) + dompet `k-kas · k-bank · k-ewallet`.

### 8.5 Larangan ilustrasi

1. Jangan `#000` — selalu `#0F172A` untuk garis/bayang.
2. Jangan outline penuh mengelilingi subjek (siluet gradien + kilau, bukan sketsa).
3. Bidang ≥ 12px wajib gradien `g-*`; warna solid hanya untuk detail kecil (≤ 12px).
4. Maksimal 1–2 bintang kilau per ilustrasi.
5. Jangan mengubah stroke-width kilau di luar 2–2.5, dan opacity di luar .18–.55.
6. Ilustrasi baru harus lolos uji: terbaca pada 34px, tetap indah pada 110px.

---

## 9. Komponen inti (spesifikasi)

| Komponen | Spesifikasi kunci |
|---|---|
| `btn` | min-h 46 (sm 40) · radius 14 · pad 0 22 (sm 0 16) · 700/14px |
| `chip` | min-h 37 · pad 8 15 · radius 999 · 12.5/700 · aktif: `--terra` + putih |
| `pill` | pad 7 13 · 12.5/700 · radius 999 |
| `icon-btn` | 44×44 · radius 14 · dot notifikasi 7px `--terra` |
| `btn-check` | 44 lingkaran · border 2 · `pop` .4s saat selesai |
| `avatar` | 40 · inisial Plus Jakarta Sans 700 · border `#A7F3D0` |
| `brand-mark` | 42 (tb 34) · radius 12 · gradasi `#34D399→#059669` |
| `card` | `--surface` · border `--line` · radius 16 · shadow **md** |
| `agenda-row` | grid `54 52 1fr auto auto` (mobile `44 1fr 44`) · radius 16 · `done`: wash hijau |
| `habit-card` | spot 56 · `wd` 27/hari · bar konsistensi + `btn-check` |
| `streak-pill` | `--terra-soft` + `--terra-deep` · 11/800 |
| `tx-row` | `tx-ic` 44 r14 · nominal 14.5/800 kanan · sub `kategori · dompet` |
| `dompet-card` | pad 13 15 · r16 · shadow **sm** · `src-ic` 42 r13 · saldo 15.5 Plus Jakarta Sans |
| Dock | r24 · blur 18 · `rgba(255,255,255,.92)` · item min-h 50 r16 · aktif `flex-grow 1.8` + label max-w 86 |
| Sidebar | 268 · nav-item 46 r14 · aktif `--terra-soft` + bar kiri 4×24 |
| Sheet modal | maks 520 · r28 · maks-h 92dvh · field 48 r14 · icon-picker grid 4 |
| Toast | r18 · pad 13 · ikon 38 r13 · bawah 96 (mobile) / kanan 26 (desktop) |
| Heatmap | sel 13 gap 3.5 · 18 minggu · level: kosong `#F1F5F9`, l1 `#A7F3D0`, l2 `#6EE7B7`, l3 `#10B981` · hari ini ring 2+4px |
| Heatmap pengeluaran | grid 7 kolom gap 5 · sel aspek-rasio r9 · level honey: kosong `#F1F5F9`, l1 `#FDE68A`, l2 `#F59E0B`, l3 `#D97706` · hari ini ring 2+4px `--honey` · masa depan dashed .45 · klik sel → toast hari |
| Kalender | 7 kolom `minmax(0,1fr)` gap 6 (mobile 4) · sel r14 min 44 (mobile 40 r11) · ticks 3.5×7 · `today` border `--terra` + `--terra-softer` · `sel` solid `--terra` putih · `future` dashed .45 · bintang ≥5 catatan |
| Donat | R76 stroke 27 · pusat: caps 10.5 + total Plus Jakarta Sans 16 |
| Grafik batang | batang 17 r5 · masuk `#22C55E` · keluar `#F97316` · sumbu `ringkas()` |

---

## 10. Gerak & transisi

| Interaksi | Durasi | Easing |
|---|---|---|
| Hover umum | .18s | ease |
| Nav dock (warna/latar) | .28s | ease |
| Dock tumbuh (`flex-grow`) | .4s | `cubic-bezier(.2,.9,.3,1)` |
| Masuk halaman | .45s | `cubic-bezier(.2,.7,.3,1)` |
| Sheet modal | .38s | `cubic-bezier(.25,.9,.3,1)` |
| Toast | .45s | `cubic-bezier(.25,1.2,.4,1)` |
| Ring progres | .9s | `cubic-bezier(.3,.8,.3,1)` |
| Bar progres | 1s | `cubic-bezier(.25,.8,.3,1)` |
| Garis grafik | 1.6s | `cubic-bezier(.4,.6,.3,1)` |
| `countUp` angka | 850ms | cubic-out |
| `pop` centang | .4s | `cubic-bezier(.3,1.6,.5,1)` |

`prefers-reduced-motion: reduce` → semua durasi `.01ms` (wajib; gerak tidak pernah
menjadi satu-satunya pembawa status).

---

## 11. Aksesibilitas

- `:focus-visible` → outline 2.5px `--terra`, offset 2px.
- Target sentuh ≥ 44px (`icon-btn` 44, `btn-check` 44, item dock 50).
- `aria-pressed` pada toggle, `aria-label` pada tombol ikon, `role` pada grafik.
- Kontras: `--ink`/`--surface` 15,8:1; `--terra-deep` di `--terra-soft` ≥ 4,5:1 (teks tebal).
- Status tidak pernah disandarkan warna saja — selalu ada label persen/teks.

---

## 12. Bahasa & tone

- Sapaan: pagi <11 · siang <15 · sore <19 · malam (sesuai jam perangkat).
- Kamus istilah resmi: **catatan** (bukan check-in) · **hari aktif** · **hari gemuk**
  (≥5 catatan/hari) · **hari sempurna** (semua kebiasaan) · **streak terbaik** ·
  **jangkar** (kebiasaan dengan catatan terbanyak) · **dompet** (sumber dana) ·
  **keluar/masuk/⇄ transfer**.
- Nilai uang selalu `Rp` + titik ribuan; label persen tanpa desimal.
- Empty state selalu menawarkan jalan keluar (“Coba ubah kata kunci…”, “Tambahkan…”).
- Tidak ada seruan berlebihan; rayakan dengan data (“+6 catatan minggu ini”), bukan drama.

---

## 13. Etika data (definisi metrik resmi)

Semua angka berasal dari database asli (atau snapshot identik saat offline) —
**tidak ada angka sintetis**:

- **hari aktif** = jumlah tanggal unik dengan ≥1 `HabitLog.completed`.
- **streak terbaik** = deret tanggal berurutan terpanjang satu kebiasaan.
- **jangkar** = kebiasaan dengan catatan terbanyak (tie-break: streak).
- **saldo dompet** = `initialBalance + pemasukan − pengeluaran ± transfer`
  (pasangan transfer bersih terhadap total saldo).
- **belanja riil** mengeluarkan `Penyesuaian Saldo` dari analisis kategori.
- `HabitLog` dengan `completed=0` **tidak** dihitung sebagai catatan.
- Mode konsep: database hanya dibaca; input baru berlabel “(konsep)” dan hanya di sesi.
- Footer wajib menyatakan sumber: “data langsung · Turso” / “snapshot database”.

---

## 14. Checklist QA sebelum merge

- [ ] `bun run lint` 0 error; `typecheck` lolos.
- [ ] Tidak ada `console.error`; halaman bersih di 390×844 dan 1440×900 (0 overflow).
- [ ] Shadow tier sesuai §6; tidak ada shadow berwarna.
- [ ] Warna baru lewat token (`var(--…)`), bukan hex baru.
- [ ] Ilustrasi baru mengikuti §8 (7 lapis, gradien, maks 2 sparkle).
- [ ] Angka: `t-num`, format `id-ID`; minggu Senin-awal.
- [ ] `prefers-reduced-motion` dihormati.
- [ ] Metrik mengikuti definisi §13; tidak ada angka karangan.
- [ ] Label aria + focus-visible utuh.

---

## 15. Versi & changelog

| Versi | Tanggal | Perubahan |
|---|---|---|
| 2.3 | 2026-11 | Tipografi: sistem font tunggal **Plus Jakarta Sans** (karya Tokotype/Indonesia, dipakai Gojek) menggantikan pasangan Source Serif 4 + Inter — sejajar dengan bahasa visual fintech Indonesia (GoPay/Livin'). Heading `.h-serif` naik ke ExtraBold 800; tabular-nums terverifikasi bekerja (`tnum`). |
| 2.2 | 2026-11 | Tipografi: pasangan font diganti ke **Source Serif 4 + Inter** (variable font, kontras serif/sans profesional — menggantikan Poppins/Plus Jakarta Sans yang terlalu mirip). Tabular-nums dipertahankan di semua angka; font smoothing penuh (webkit + moz) di root. |
| 2.1 | 2026-11 | Fitur baca-saja dari aplikasi v1: garis target harian (tick honey pada ring), habit kuantitatif (amount) dengan bar progres unit, kartu Jatah Harian & proyeksi (bar laju + penanda ideal), dan Heatmap Pengeluaran (§9, skala honey). Simbol spot baru: `ill-jatah` & `ill-panas`. |
| 2.0 | 2026-11 | “Evergreen”: emerald `#10B981` + netral slate; Poppins/Plus Jakarta Sans; radius 16; **Beautiful shadows** sm/md/lg (netral berlapis); ilustrasi flat-3D + 17 ilustrasi kebiasaan & 24 ikon kategori dari data asli; data jujur dari Turso (baca-saja). |
| 1.x | — | “Playful Botanical” (lavender/ivory, Nunito) — **diarsipkan** ke `docs/design-system.md`; hanya untuk aplikasi lama `src/`. |
