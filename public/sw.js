const STATIC_CACHE = "rutina-static-v19"; // v2.17 — skala angka semantik, aksi senyap, proporsi wawasan
const STATIC_PREFIX = "/_next/static/";
// Aset publik yang bisa berubah antar deploy — jangan cache-first.
const PUBLIC_ASSET = /^\/(?:icons\/|tree\/|illustrations\/|favicon\.ico$|apple-touch-icon|logo\.svg$)/;
// Shell aplikasi konsep (rutina.html) — network-first dengan fallback cache
// supaya pembaruan langsung sampai, tapi PWA tetap terbuka saat offline.
const APP_SHELL = "/rutina.html";

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    // Pra-panaskan shell agar kunjungan offline pertama pun punya konten.
    try {
      const cache = await caches.open(STATIC_CACHE);
      await cache.add(new Request(APP_SHELL, { cache: "reload" }));
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
        const response = await fetch(request);
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
