// Plano Web 版のオフライン対応（サービスワーカー）。
// - ページ（HTML）：まずネットから取る。つながらないときは保存しておいたものを使う（更新がすぐ届くように）
// - プログラム・画像など：公開のたびに全部を保存し直し、保存したものを使う（開いたことのない画面もオフラインで開ける）
// __BUILD_ID__ は公開のときに scripts/web-precache.js が置き換える。公開のたびに sw.js が変わり、古い保存は消える
// タスクのデータはここでは扱わない（ブラウザの中に別に保存されている）
const BUILD_ID = '__BUILD_ID__';
const PAGE_CACHE = 'plano-pages-' + BUILD_ID;
const ASSET_CACHE = 'plano-assets-' + BUILD_ID;

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const pages = await caches.open(PAGE_CACHE);
      await pages.add('/');
      const assets = await caches.open(ASSET_CACHE);
      try {
        const list = await (await fetch('/precache.json', { cache: 'no-store' })).json();
        await assets.addAll(list);
      } catch (e) {
        // 一覧がない（手元での確認など）ときは、開いたものから保存していく
        console.warn('Plano: 事前の保存に失敗しました', e);
      }
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  const keep = [PAGE_CACHE, ASSET_CACHE];
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => !keep.includes(key)).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

// 保存したページ（どの画面の URL でも、中身は同じ1枚のページ）
const cachedPage = () => caches.open(PAGE_CACHE).then((cache) => cache.match('/'));

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(PAGE_CACHE).then((cache) => cache.put('/', copy));
            return response;
          }
          // 画面の URL を直接開いて見つからないと言われたときも、保存したページを出す
          return cachedPage().then((cached) => cached || response);
        })
        .catch(() => cachedPage().then((cached) => cached || Response.error())),
    );
    return;
  }

  if (url.pathname === '/sw.js' || url.pathname === '/precache.json') return;

  // 保存したものがあれば使い、なければネットから取って保存する
  event.respondWith(
    caches.open(ASSET_CACHE).then((cache) =>
      cache.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok) cache.put(request, response.clone());
            return response;
          }),
      ),
    ),
  );
});
