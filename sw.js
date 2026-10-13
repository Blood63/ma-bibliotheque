const CACHE='ma-bibliotheque-v3';
const COVERS = 'ma-bibliotheque-covers-v1';
const ASSETS = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'];
// Images de couverture mises en cache pour l'affichage hors ligne (jamais les API, jamais api.github.com)
const COVER_HOSTS = ['covers.openlibrary.org', 'books.google.com', 'books.googleusercontent.com'];
// Police Playfair Display (Google Fonts) gardée en cache pour le mode hors ligne
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];
const FONTS = 'ma-bibliotheque-fonts-v1';
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE && k !== COVERS && k !== FONTS).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) {
    const isCover = e.request.destination === 'image' && COVER_HOSTS.includes(url.hostname);
    const isFont = FONT_HOSTS.includes(url.hostname);
    if (isCover || isFont) {
      e.respondWith(caches.open(isFont ? FONTS : COVERS).then(c => c.match(e.request).then(hit => hit || fetch(e.request).then(r => {
        if (r.ok || r.type === 'opaque') c.put(e.request, r.clone()).catch(() => {});
        return r;
      }))));
    }
    return; // ne jamais intercepter l'API GitHub ni les API de recherche ISBN
  }
  e.respondWith(
    fetch(e.request).then(r => {
      const copy = r.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
      return r;
    }).catch(() => caches.match(e.request, {ignoreSearch: true}).then(r => r || caches.match('./index.html')))
  );
});
