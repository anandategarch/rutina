# IDE — Rutina: Personal Coach Digital

> "Bukan sekadar logbook — coach digital yang berpikir, beradaptasi, dan mendampingi setiap rep."

Dokumen ini berisi **seluruh ide fitur** Rutina: 5 ide dari diskusi awal, ide tambahan dari AI,
beserta status implementasinya. Jadi panduan roadmap produk yang hidup.

---

## Bagian 1 — Ide dari Diskusi Awal (5 ide)

### 1. Sistem Auto-Progression Berbasis Aturan (Smart Rules) — ✅ TERIMPLEMENTASI

Ganti "menyalin angka histori" dengan algoritma yang menaikkan target secara bertahap.

**Aturan angkat beban (Double Progression):**
- Jika di sesi terakhir **semua set** mencapai repetisi maksimal (mis. 3×10 @ 20 kg)
  → beban berikutnya naik sebesar increment terkecil (mis. → 22.5 kg),
  repetisi kembali ke batas bawah (→ 3×8).
- Jika belum → beban dipertahankan sampai repetisi maksimal tercapai di semua set.
- Coach menampilkan alasan: *"Beban naik ke 40 kg! Sesi terakhir kamu sukses 3×10 @ 37.5 kg."*

**Aturan lari/jalan (Cardio):**
- Jika target jarak & pace tercapai (pace ≤ target + 5 dtk/km)
  → pace target dipertajam 5 detik/km pada sesi berikutnya.
- Jika pace lebih lambat > 45 dtk dari target → pace target dilonggarkan 5 detik
  (konsisten dulu, kecepatan menyusul).

### 2. Readiness Score (Cek Kondisi Tubuh Harian) — ✅ TERIMPLEMENTASI

Check-in singkat sebelum latihan: jam tidur (slider), DOMS/pegal (1–5), stres (1–5), energi (1–5).

**Skor 0–100** dengan bobot: tidur 30, energi 30, pegal 20, stres 20.

**Aksi coach otomatis:**
| Skor | Level | Aksi otomatis |
|------|-------|---------------|
| 80+ | Prime | Target standar — saatnya push |
| 60–79 | Siap | Target standar |
| 40–59 | Moderat | Beban −15%, kurangi 1 set, pace dilonggarkan |
| <40 | Pemulihan | Beban −30% — fokus teknik / sarankan sesi recovery ringan |

### 3. Deteksi Plateau & Saran Deload Otomatis — ✅ TERIMPLEMENTASI

- Untuk setiap latihan angkat, sistem menghitung **estimasi 1RM (rumus Epley)** per sesi.
- Jika e1RM terbaik **stagnan (variasi ≤ 2%) atau menurun selama 3 sesi berturut-turut**
  → coach mengirim peringatan: *"Performamu mandek. Bagaimana kalau Deload Week intensitas 50%?"*
- **Deload Week** bisa diaktifkan satu klik: selama 7 hari semua target dipangkas 50%
  (beban ×0.5, pace dilonggarkan +45 dtk/km), lalu otomatis kembali normal.

### 4. Pemandu Waktu Istirahat & Tempo (Real-time Guidance) — ✅ TERIMPLEMENTASI

- **Timer istirahat otomatis** muncul setiap selesai mencatat set: countdown ring visual,
  tombol **+15 detik** dan **Lewati**, bunyi *beep* di 3 detik terakhir,
  lalu suara *"Ayo, set berikutnya!"* (Web Speech API, bahasa Indonesia).
- **Panduan tempo** per latihan (mis. 3-1-1: turun 3 dtk · jeda 1 dtk · naik 1 dtk)
  ditampilkan pada kartu latihan, plus *form cue* singkat dari coach.

### 5. Saran Variasi & Pencegahan Cedera (Cross-Training) — ✅ TERIMPLEMENTASI

- Sistem memantau sesi kardio 7 hari terakhir.
- Jika **≥ 4 sesi kardio/minggu** atau **lari 3 hari berturut-turut**
  → coach mengirim saran: *"Kamu sudah sering lari minggu ini. Agar tidak cedera lutut,
  ganti dengan jalan santai / latihan kekuatan kaki / swimming."* (anti-spam: maks. 1×/minggu)

---

## Bagian 2 — Ide Tambahan dari AI — ✅ SEMUA TERIMPLEMENTASI

### 6. AI Coach Chat (Personal Assistant)
Chat dengan **Coach Rutina** yang ditenagai LLM dan **mengetahui seluruh data latihanmu**:
rencana hari ini, 5 sesi terakhir, PR, rata-rata readiness, streak, status plateau & deload.
Tanya apa saja — "Kenapa beban aku stagnan?", "Evaluasi minggu ini", "Tips DOMS" —
coach menjawab dengan angka kamu sendiri. Riwayat chat tersimpan di database.

### 7. Personal Records + Estimasi 1RM
Setiap set angkat dihitung e1RM-nya (Epley). Rekor pecah → coach merayakannya
(notifikasi + halaman Progres). Halaman PR menampilkan rekor aktif per latihan.

### 8. Autoregulasi Dua Arah
Progression tidak hanya naik — kalau repetisi jauh di bawah target di semua set,
coach **menurunkan beban 10%** otomatis dengan pesan edukatif
(*"fokus kualitas gerakan, naik lagi setelah repetisi kembali tercapai"*)
— mencegah ego lifting & cedera.

### 9. Analitik Volume & Tren
- Grafik **volume mingguan** (total beban × repetisi, 8 minggu) + km kardio.
- Grafik **tren e1RM** per latihan (pilih lewat chip), penanda plateau.
- Statistik: total sesi, total volume (ton), streak, rata-rata readiness 7 hari.

### 10. Streak & Konsistensi
Streak dihitung per **minggu aktif** (≥ 3 sesi/minggu) — lebih realistis daripada streak harian
yang hancur karena hari istirahat. Progress sesi minggu ini vs target (x/4).

### 11. Timer Sesi & Ringkasan Pasca-Latihan
Timer durasi sesi berjalan live. Setelah "Selesaikan": ringkasan volume, PR baru,
dan daftar keputusan progression — transparan seperti debriefing coach sungguhan.

### 12. Penyesuaian Target Real-time di UI
Kartu target menampilkan badge penyesuaian (mis. *"Readiness moderat: beban −15%, −1 set"*
atau *"Deload week: intensitas 50%"*) sehingga kamu selalu tahu **kenapa** angkanya berubah.

---

## Bagian 3 — Backlog Ide Berikutnya (belum diimplementasikan)

### 13. Kalkulator Set Pemanasan
Otomatis menghitung bar pemanasan (mis. 40% × 5, 60% × 3, 80% × 1) dari beban kerja hari ini.

### 14. Body Metrics
Pencatatan berat badan, lingkar lengan/pinggang, foto progres — tren komposisi tubuh.

### 15. Ekspor & Backup Data
Ekspor CSV/JSON seluruh log + import kembali. Miliki datamu sendiri.

### 16. Notifikasi & Reminder
Push notification / email pengingat jadwal latihan & check-in readiness.

### 17. Multi-User & Autentikasi
NextAuth.js — satu instance untuk seluruh tim/keluarga, data terpisah per user.

### 18. Integrasi Wearable
Import aktivitas dari GPS watch / HR strap (fit/GPX), deteksi overtraining dari HRV.

### 19. Library Gerakan Visual
GIF/video bentuk gerakan + checklist teknik per latihan di perpustakaan.

### 20. Periodisasi Jangka Panjang
Blok mesocycle (akumulasi → intensifikasi → deload → realisasi) yang direncanakan
coach berdasarkan respons tubuhmu, bukan hanya aturan mingguan.

### 21. Voice Coach Penuh (TTS)
Semua panduan sesi dibacakan (target set, hitungan tempo, sisa waktu istirahat) —
hands-free saat memakai headphone.

### 22. Tantangan Sosial
Leaderboard mingguan bersama teman, badge pencapaian, tantangan streak.

---

## Cara Kerja Mesin Coach (Ringkasan Teknis)

```
Check-in readiness ──┐
                     ├─► getPlan() ──► target harian (beban/reps/pace + catatan coach)
Riwayat performa ────┤                    ▲
                     │                    │ penyesuaian readiness & deload
Deload aktif? ───────┘
                     
Selesai sesi ──► completeSession()
                 ├─ Hitung volume & PR baru (Epley) → rayakan!
                 ├─ Double progression / autoregulasi / pace sharpening
                 ├─ Cek cross-training (kelebihan kardio)
                 ├─ Scan plateau (3 sesi terakhir) → saran deload
                 └─ Pesan coach otomatis masuk inbox
```

Semua logika ada di `src/lib/coach-engine.ts` — mudah diaudit, dikustomisasi,
dan dikembangkan dengan ide-ide backlog di atas.
