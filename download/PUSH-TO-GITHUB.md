# Cara Push Rutina ke GitHub

Repo lokal sudah berisi 8 commit terstruktur (skema → engine → API → UI → docs).
Karena sandbox ini tidak punya akses ke akun GitHub-mu, semua sudah disiapkan
dalam bentuk **git bundle**: `rutina.bundle` (folder `download/`).

## Opsi A — Pakai bundle (paling cepat)

```bash
# 1. Download file rutina.bundle dari folder download
# 2. Buat repo kosong di GitHub (tanpa README): https://github.com/new  → nama: rutina
# 3. Clone dari bundle, lalu push:
git clone rutina.bundle rutina
cd rutina
git remote set-url origin https://github.com/USERNAME/rutina.git
git push -u origin main
```

## Opsi B — Dari project ini langsung

```bash
cd /home/z/my-project
git remote add origin https://github.com/USERNAME/rutina.git
git push -u origin main
```

## Opsi C — Pakai GitHub CLI

```bash
gh repo create rutina --public --source=. --remote=origin --push
```

## Isi Riwayat Commit

```
b010047 chore: sertakan contoh websocket & skrip uji scaffold
5dd1f3f fix: tambahkan logo Rutina & hooks shadcn/ui
7fffbdb docs: IDEAS.md (22 ide fitur + status) & README lengkap
246a119 feat: UI Rutina — tema Volt Dark + seluruh antarmuka
4167d22 feat: API routes — plan, readiness, sessions, sets, progress, coach AI, alerts, deload
f2b7d6c feat: skema database & coach engine
7d3edae chore: scaffold Next.js 16 + Tailwind 4 + shadcn/ui (tema dasar)
f313190 Initial commit
```

Setelah push, jangan lupa set `DATABASE_URL` di lokal masing-masing
(lihat `.env.example`) lalu `bun run db:push` — aplikasi akan auto-seed
data demo 5 minggu saat pertama dijalankan.
