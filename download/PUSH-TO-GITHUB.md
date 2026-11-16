# Push Rutina (Personal Coach) ke GitHub

Aplikasi Personal Coach Digital ini sudah dipush ke repo
[`anandategarch/rutina`](https://github.com/anandategarch/rutina) pada
**branch `coach`** (main tetap memuat PWA pelacak kebiasaan & keuangan —
tidak tersentuh).

## Yang ada di branch `coach`

- Aplikasi Next.js 16 lengkap: coach engine, API routes, UI Evergreen,
  database Prisma + auto-seed demo 5 minggu.
- Tema **"Evergreen"** — satu keluarga desain dengan PWA Rutina utama:
  latar `#F8FAFC`, utama terra `#047857`/`#10B981`, tinta `#0F172A`,
  radius kartu 12/16/20 px, font Geist, gradasi hero zamrud khas
  `page-hero` repo utama. Mode gelap opsional "Evergreen Night".

## Merge ke main (kalau ingin jadi aplikasi utama repo)

Buka Pull Request `coach` → `main` di GitHub, review, lalu merge.
Atau lewat CLI:

```bash
git clone -b coach https://github.com/anandategarch/rutina.git
cd rutina
git checkout main
git merge coach --allow-unrelated-histories -m "feat: Personal Coach Digital (tema Evergreen)"
git push origin main
```

## Menjalankan secara lokal (branch coach)

```bash
bun install
mkdir -p db
echo "DATABASE_URL=file:./db/custom.db" > .env
bun run db:push
bun run dev   # http://localhost:3000
```

> Catatan: `.env` TIDAK ikut direpo (sudah di-ignore); buat manual
> seperti di atas. Aplikasi auto-seed data demo saat request pertama.

## Riwayat commit (ringkas)

```
feat: tema Evergreen — satu keluarga desain dengan Rutina PWA
8ea294b (squash UI coach sebelumnya)
chore: sertakan contoh websocket & skrip uji scaffold
fix: tambahkan logo Rutina & hooks shadcn/ui
docs: IDEAS.md (22 ide fitur + status) & README lengkap
feat: UI Rutina + seluruh antarmuka
feat: API routes — plan, readiness, sessions, sets, progress, coach AI, alerts, deload
feat: skema database & coach engine
chore: scaffold Next.js 16 + Tailwind 4 + shadcn/ui
```
