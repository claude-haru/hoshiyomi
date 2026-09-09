// シンプルなオフライン対応 Service Worker。
// - 同一オリジンの GET は stale-while-revalidate（まずキャッシュ、裏で更新）
// - ナビゲーションはオフライン時に index.html へフォールバック
// キャッシュ名の版数を上げると古いキャッシュを破棄する。
const CACHE = 'astro-app-v1';
const SCOPE_URL = new URL(self.registration.scope);
const START_URL = new URL('./', SCOPE_URL).toString();

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then(async (cache) => {
      // 個別に取得（1 つ失敗してもインストールを止めない）
      for (const url of [START_URL, new URL('./index.html', SCOPE_URL).toString()]) {
        try {
          await cache.add(url);
        } catch {
          /* オフライン時や配信構成の差異は無視 */
        }
      }
    }),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== SCOPE_URL.origin) return; // 外部（Nominatim 等）は素通し

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() => caches.match(START_URL).then((r) => r || caches.match(new URL('./index.html', SCOPE_URL).toString()))),
    );
    return;
  }

  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(req);
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type === 'basic') cache.put(req, res.clone());
          return res;
        })
        .catch(() => undefined);
      return cached || (await network) || new Response('offline', { status: 503, statusText: 'offline' });
    }),
  );
});
