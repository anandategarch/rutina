# Rutina — Personal Coach Digital

Aplikasi web fitness yang mengubah logbook latihan menjadi **personal coach digital**:
target harian beradaptasi otomatis lewat *progressive overload*, *readiness score*,
deteksi *plateau* & *deload*, timer istirahat dengan suara, dan **AI coach** yang
mengetahui seluruh data latihanmu. Seluruh antarmuka dalam Bahasa Indonesia.

> Daftar lengkap ide fitur (terimplementasi + backlog): lihat [IDEAS.md](./IDEAS.md)

## Fitur Utama

| Fitur | Deskripsi |
|---|---|
| **Auto-Progression** | Double progression angkat beban (3×10 @ 20 kg → 3×8 @ 22.5 kg) & penajaman pace lari otomatis |
| **Readiness Score** | Check-in harian (tidur, DOMS, stres, energi) → skor 0–100 → target disesuaikan otomatis |
| **Deteksi Plateau & Deload** | e1RM (Epley) stagnan 3 sesi → saran Deload Week; satu klik = intensitas 50% selama 7 hari |
| **Autoregulasi Dua Arah** | Gagal jauh di bawah target → beban otomatis turun 10% dengan pesan edukatif |
| **Timer Istirahat & Tempo** | Countdown ring + beep + suara "Ayo, set berikutnya!", panduan tempo 3-1-1 & form cue |
| **Cross-Training Guard** | Terlalu sering lari → saran pencegahan cedera otomatis |
| **AI Coach Chat** | LLM dengan konteks data pribadi: PR, readiness, streak, plateau — tanya apa saja |
| **PR & Analitik** | Personal records dengan estimasi 1RM, grafik volume mingguan & tren e1RM (recharts) |
| **Streak Minggu Aktif** | Konsistensi diukur per minggu (≥3 sesi) — realistis dengan hari istirahat |

## Tech Stack

- **Next.js 16** (App Router) + **TypeScript** + **React 19**
- **Tailwind CSS 4** + **shadcn/ui** (tema kustom **"Evergreen"**: terang & tenang, utama terra `#10B981`/`#047857`, tinta `#0F172A`, latar `#F8FAFC` — satu keluarga desain dengan Rutina PWA utama; mode gelap opsional "Evergreen Night")
- **Prisma ORM** + SQLite (`db/custom.db`, auto-seed 5 minggu data demo saat pertama kali dijalankan)
- **TanStack Query** (server state) + **Zustand** (UI state)
- **recharts** (grafik) + **framer-motion** (animasi) + **lucide-react** (ikon)
- **z-ai-web-dev-sdk** (LLM, hanya di backend) untuk AI Coach
- Font: **Geist** (display + body) + **Geist Mono**

## Menjalankan Secara Lokal

```bash
# 1. Install dependencies
bun install

# 2. Siapkan database (buat .env berisi DATABASE_URL=file:./db/custom.db)
mkdir -p db
echo "DATABASE_URL=file:./db/custom.db" > .env
bun run db:push        # buat skema

# 3. Jalankan dev server
bun run dev            # http://localhost:3000
```

Saat request pertama, aplikasi **otomatis men-seed** library latihan, rencana
mingguan, dan 5 minggu riwayat demo (termasuk pola plateau di Back Squat untuk
mendemokan deteksi deload).

## Struktur Proyek

```
prisma/schema.prisma        # Skema: Exercise, PlanItem, WorkoutSession, SetLog,
                            # ReadinessCheck, PersonalRecord, CoachMessage, ChatMessage, Profile
src/lib/
  coach-engine.ts           # OTAK aplikasi: progression, readiness, plateau,
                            # deload, cross-training, PR, streak, konteks AI
  seed.ts                   # Seed data demo idempotent
  date.ts                   # Helper tanggal timezone Asia/Jakarta
  types.ts                  # Kontrak DTO API ↔ frontend
  store.ts                  # Zustand (navigasi & sesi aktif)
src/app/api/
  plan/                     # Rencana harian + penyesuaian readiness/deload
  readiness/                # Check-in harian (GET/POST)
  sessions/                 # Riwayat & mulai sesi
  sessions/[id]/            # Detail, selesai (PATCH → progression), hapus
  sessions/[id]/sets/       # Catat/hapus set
  progress/                 # Analitik: volume, e1RM, PR, plateau
  coach/                    # AI Coach chat (LLM + konteks data)
  alerts/                   # Pesan coach (tandai dibaca)
  deload/                   # Aktifkan/akhiri Deload Week
src/components/rutina/      # Today, Readiness, Alerts, Session, RestTimer,
                            # Progress, History, CoachChat, shared UI
```

## Alur Pengguna (Golden Path)

1. **Check-in readiness** → skor + rekomendasi coach, target hari ini menyesuaikan.
2. **Mulai Latihan** → mode sesi layar penuh: input ter-prefill dari target.
3. **Catat set** → timer istirahat otomatis (beep + suara) → tempo & cue tampil.
4. **Selesaikan** → debrief: volume, PR baru, keputusan progression.
5. Coach mengirim pesan otomatis (PR, kenaikan beban, plateau, cross-training).
6. **Progres** → grafik volume/e1RM, PR, deload; **Coach** → tanya apa saja ke AI.

## Catatan

- Zona waktu semua logika "hari" mengikuti **Asia/Jakarta (WIB)**.
- UI bilingual tidak diperlukan — full Bahasa Indonesia.
- Tema terang default "Evergreen" (bisa toggle ke "Evergreen Night"), responsif
  mobile-first dengan bottom navigation & sidebar desktop.
- Token tema diambil langsung dari design system Rutina PWA: `--terra-strong` untuk
  tombol utama, gradasi hero `#F0FDF4 → #ECFDF5 → #D1FAE5`, radius kartu 12/16/20 px.
