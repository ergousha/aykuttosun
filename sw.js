/* Aykut Tosun – service worker
   Strateji: sayfa, CSS, JS ve veri dosyaları için ÖNCE AĞ (her zaman en güncel sürüm),
   internet yoksa önbellek. Görseller ve yazı tipleri önbellekten.
   Artık içerik güncellemelerinde VERSION'ı artırmak zorunlu değil; bu dosyanın kendisini
   değiştirdiğinizde artırmanız yeterli. */
const VERSION = "td-v13";
const CORE = [
  "/", "/manifest.webmanifest",
  "/assets/style.css", "/assets/app.js", "/assets/data.js", "/assets/risaleler.js",
  "/logo/svg/aykut-tosun-yatay-altin-krem.svg", "/icons/icon-192.png", "/icons/icon-512.png",
  "/icons/apple-touch-icon.png", "/icons/favicon-32.png"
];

self.addEventListener("install", (e) => {
  // HTTP önbelleğini atlayarak en güncel dosyaları al
  e.waitUntil(
    caches.open(VERSION)
      .then((c) => Promise.all(CORE.map((u) => fetch(u, { cache: "no-cache" }).then((r) => r.ok && c.put(u, r)).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Önce ağ (tarayıcı önbelleğini de atlayarak), olmazsa kayıtlı kopya
function networkFirst(req, cacheKey) {
  return fetch(req.url, { cache: "no-cache", credentials: "same-origin" })
    .then((r) => {
      if (r.ok) { const copy = r.clone(); caches.open(VERSION).then((c) => c.put(cacheKey || req, copy)); }
      return r;
    })
    .catch(() => caches.match(cacheKey || req, { ignoreSearch: true }).then((m) => m || caches.match("/")));
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  if (req.mode === "navigate") { e.respondWith(networkFirst(req)); return; }

  if (url.origin === location.origin) {
    // Görseller: önbellek öncelikli (sık değişmez)
    if (/\.(png|jpe?g|webp|gif|ico)$/i.test(url.pathname)) {
      e.respondWith(caches.match(req).then((c) => c || fetch(req).then((r) => {
        const copy = r.clone(); caches.open(VERSION).then((cc) => cc.put(req, copy)); return r;
      })));
      return;
    }
    // HTML, CSS, JS, veri, SVG, manifest: önce ağ
    e.respondWith(networkFirst(req));
    return;
  }

  // Dış görseller ve yazı tipleri (wixstatic, Google Fonts): önbellek öncelikli
  if (/static\.wixstatic\.com|fonts\.(googleapis|gstatic)\.com/.test(url.host)) {
    e.respondWith(caches.match(req).then((cached) => cached || fetch(req).then((r) => {
      const copy = r.clone(); caches.open(VERSION + "-ext").then((c) => c.put(req, copy)); return r;
    })));
  }
});
