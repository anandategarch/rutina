const STATIC_CACHE = "rutina-static-v65"; // v2.63 — adaptasi Modern Web Guidance (github.com/GoogleChrome/modern-web-guidance, kurasi Chrome/Edge/Firefox/MDN): (1) kunci-gulir overlay deklaratif body.ov-open{overflow:hidden} menggantikan mutasi JS document.body.style.overflow — popup kalender/jam & panel bantuan yang dulu tak mengunci gulir latar kini seragam; (2) overscroll-behavior:contain di .modal/.sheet/.pop-scrim — gulir di batas sheet tak merangkai ke halaman di balik scrim; (3) scrollbar jalur standard: scrollbar-color/gutter primer + fallback ::-webkit-scrollbar dibungkus @supports not(scrollbar-color:auto), jempol #64748B (kontras ≥3:1 WCAG 1.4.11), scrollbar-gutter:stable anti layout-shift; (4) :user-invalid di nominal transaksi — umpan balik rose setelah interaksi + teks bantuan :has() + aria-describedby; (5) text-wrap balance/pretty; (6) :root color-scheme:light + accent-color terra + font-size-adjust:from-font; <dialog>/@starting-style, View Transitions, popover API dinilai & sengaja tak diadopsi (sheet kustom & koreografi stagger sudah matang, migrasi = risiko regresi); v64 memuat v2.62, v63 memuat v2.61 beban GPU overlay layar penuh: (1) saat modal/popup/panel bantuan terbuka, scrim backdrop-filter blur(3px) selebar viewport dihitung ulang TIAP FRAME karena animasi hiasan di baliknya (sceneBob/treeSway/quoteFloat/chartPulse/badgeShine/tcSway) tak pernah berhenti — terukur 50 ms/frame desktop, lebih berat di ponsel, sheet "lemot" walau handler hanya 2 ms; kini body.ov-open (gerbang: openModal/finishClose/popupShell+kill/panel bantuan) membekukan semua animasi hiasan selama overlay terbuka (nol perubahan visual — di balik gelap+blur tak terlihat), validasi A/B: 17 ms/frame datar; (2) blur(18px) bottomnav di bawah latar 97%-opak dicabut — tak pernah terlihat namun dihitung tiap frame saat konten bergulir/beranimasi di belakang bilah; (3) rantai blur bertumpuk diputus: frost topbar 14px & kartu kaca tree-progress 3px di bawah scrim overlay dimatikan selama overlay terbuka (blur di dalam blur tak stabil di-cache); (4) fillTxType: peta sekali-jalan gantikan lastTxOf() yang memindai seluruh jurnal per kategori (O(kategori×transaksi)) saat modal dibuka; v63 memuat v2.61, v62 memuat v2.60 (1) layout thrashing stagger dihapus — staggerList/staggerPage kini batch (tulis semua → SATU reflow → pasang animasi; dulu void offsetWidth per item = belasan layout paksa tiap render/pindah tab di ponsel); (2) SEMUA jalur simpan modal (transaksi/transfer/sunting, anggaran, kebiasaan, latihan bugar, asupan, dompet, ganti nama kategori): render berat pindah dari jalur input sinkron ke requestAnimationFrame frame berikutnya — penutupan sheet, toast & hujan koin menggambar dulu (tap tak lagi membeku), flashRows ikut setelah baris selesai digambar; (3) pageIn2 pindah tab: filter:blur(5px) halaman penuh (re-rasterisasi semua kartu tiap frame) diganti opacity+translateY murni kompositor; v62 memuat v2.60, v61 memuat v2.59
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
