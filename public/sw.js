const STATIC_CACHE = "rutina-static-v66"; // v2.64 — audit menyeluruh "cek ulang semuanya, cari banyak temuan dan fix": 4 audit paralel (CSS/kompositor, arsitektur render, siklus listener, backend SQL) membedah 10.527 baris & route.ts — 33 temuan terverifikasi diperbaiki. Frontend: pop-scrim blur(3px) KEDUA di atas modal-backdrop blur saat pemilih tanggal dibuka dalam form transaksi dicabut (blur-atas-blur selebar viewport tak ter-cache); frost topbar blur(14px) diganti opak color-mix 96%; badgeShine left->translateX; filter leluhur .hero-ill/.tc-hero-art pindah ke elemen beranimasi sendiri; tree-progress kaca opak .92; tunas blur->scale; rowNew background->::before opacity; tp-item font-size->scale; btGlow box-shadow->cincin ::after; SEMUA bar width->scaleX; PAINT_QUIET memisahkan jalur data (simpan SNAP: countUp/donut-sweep/spark/cf-bar/line-draw/stagger/bar tak diputar ulang) dari jalur tampilan (tab tetap koreografi); agregat sekali-hitung agg() utk expByCat/walletBalances/finTotals/lastTxOf/catUsage (dulu ~50-60 pemindaian penuh per simpan — renderStats per baris anggaran, renderSettings per kategori, renderSaldoBank per dompet); centang kebiasaan 18-renderer sinkron dalam task klik -> rAF+quiet; renderTx 285 animasi serentak -> 48 pertama + debounce pencarian 140ms; staggerList antrean mikro-tugas SATU reflow lintas daftar; renderConsChart/WawasanHero O(pekan*tanggal)->bucket satu pass; fitDrillStats biner 4 langkah; drill dibatasi 30 baris; flashRows satu pemindaian; touchmove non-passive document hanya selama gestur baris (scroll-linking seluruh app pulih); 6 pointerdown capture + 6 MutationObserver mountSelect -> satu penutup bersama; heroParallax cache; penjaga atmo 400ms->2s + pulih instan via syncOvPause. Backend: POST tak lagi menulis ulang PENUH FinanceCategory+WeeklyBudget per sinkron (klien mengirim hanya saat berubah; ~34 autocommit -> client.batch write per seksi, atomik; WAL 4MB->ramping via wal_checkpoint TRUNCATE); GET ETag/304 (73 KB tak diunduh ulang); indeks Transaction(date/category)+WorkoutSet(workoutId)+Workout(date)+FoodLog(date); grouping set latihan O(n*m)->Map; v65 memuat v2.63, v64 memuat v2.62, v63 memuat v2.61, v62 memuat v2.60
const STATIC_PREFIX = "/_next/static/";
// Aset publik yang bisa berubah antar deploy — jangan cache-first.
const PUBLIC_ASSET = /^\/(?:icons\/|tree\/|illustrations\/|fonts\/|favicon\.ico$|apple-touch-icon|logo\.svg$|manifest\.json$)/;
// Shell aplikasi konsep (rutina.html) — network-first dengan fallback cache
// supaya pembaruan langsung sampai, tapi PWA tetap terbuka saat offline.
const APP_SHELL = "/rutina.html";

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    // Pra-panaskan shell + font Geist agar kunjungan offline pertama
    // pun punya konten DAN tipografi yang sama persis (v2.24).
    try {
      const cache = await caches.open(STATIC_CACHE);
      await Promise.all([
        APP_SHELL,
        "/fonts/geist-latin.woff2",
        "/fonts/geist-latin-ext.woff2",
      ].map((url) => cache.add(new Request(url, { cache: "reload" }))));
    } catch { /* offline saat install — abaikan */ }
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith("rutina-static-") && key !== STATIC_CACHE).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

/* v2.23 · pintu standar untuk meminta worker menunggu agar langsung aktif
   (dipakai halaman React maupun rutina.html saat menemukan pembaruan). */
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

const OFFLINE_HTML =
  '<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8">' +
  '<meta name="viewport" content="width=device-width, initial-scale=1">' +
  '<title>Rutina · Offline</title>' +
  '<style>body{font-family:system-ui,sans-serif;background:#F8FAFC;color:#0F172A;display:grid;place-items:center;min-height:100dvh;margin:0}div{text-align:center;padding:24px}h1{font-size:18px}p{font-size:14px;color:#475569}button{margin-top:12px;padding:10px 18px;border:none;border-radius:12px;background:#047857;color:#fff;font-weight:600;cursor:pointer}</style>' +
  '</head><body><div><h1>Koneksi belum tersedia</h1><p>Rutina membutuhkan jaringan untuk memuat data terbaru. Coba lagi setelah koneksi kembali.</p><button onclick="location.reload()">Coba lagi</button></div></body></html>';

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const requestUrl = new URL(request.url);
  if (requestUrl.origin !== self.location.origin) return;

  // Aset build immutable (di-hash Next.js) — cache-first.
  const isImmutableAsset = requestUrl.pathname.startsWith(STATIC_PREFIX);
  if (isImmutableAsset) {
    event.respondWith((async () => {
      const cache = await caches.open(STATIC_CACHE);
      const cached = await cache.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok && (response.type === "basic" || response.type === "default")) {
        await cache.put(request, response.clone());
      }
      return response;
    })());
    return;
  }

  // Shell konsep & aset publik — network-first dengan fallback cache.
  const isShell = requestUrl.pathname === APP_SHELL;
  const isPublicAsset = PUBLIC_ASSET.test(requestUrl.pathname);
  if (isShell || isPublicAsset) {
    event.respondWith((async () => {
      const cache = await caches.open(STATIC_CACHE);
      try {
        // v2.23 — shell HARUS menembus HTTP cache browser. Sebelumnya fetch
        // polos bisa dilayani entri HTTP cache lama: "network-first" tak
        // pernah benar-benar menyentuh jaringan, sehingga pengguna terus
        // melihat versi sebelumnya meski versi baru sudah ter-deploy.
        // Permintaan dibangun dari URL (bukan dari objek request navigasi —
        // constructor Request menolak mode "navigate" dengan init); respons
        // same-origin tetap bertipe "basic" sehingga tetap tersimpan di Cache API.
        const netReq = isShell ? new Request(requestUrl.href, { cache: "reload" }) : request;
        const response = await fetch(netReq);
        if (response.ok && (response.type === "basic" || response.type === "default")) {
          await cache.put(request, response.clone());
        }
        return response;
      } catch {
        const cached = await cache.match(request);
        if (cached) return cached;
        if (isShell) return new Response(OFFLINE_HTML, { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } });
        throw new Error("Rutina SW: offline tanpa cache untuk " + requestUrl.pathname);
      }
    })());
    return;
  }

  // Navigasi lain (HTML/API) — network-only, dengan halaman offline ringan
  // bila koneksi gagal dan tidak ada shell yang tersimpan.
  if (request.mode === "navigate") {
    event.respondWith((async () => {
      try {
        return await fetch(request);
      } catch {
        const cache = await caches.open(STATIC_CACHE);
        const shell = await cache.match(APP_SHELL);
        if (shell) return shell;
        return new Response(OFFLINE_HTML, { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } });
      }
    })());
    return;
  }

  event.respondWith(fetch(request));
});
