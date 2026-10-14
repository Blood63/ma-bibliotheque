const CACHE = 'ma-bibliotheque-v11';
const COVERS = 'ma-bibliotheque-covers-v1';
const ASSETS = ['./', './index.html', './releases.js', './manifest.webmanifest', './icon-192.png', './icon-512.png'];
// Images de couverture mises en cache pour l'affichage hors ligne (jamais les API, jamais api.github.com)
const COVER_HOSTS = ['covers.openlibrary.org', 'images-na.ssl-images-amazon.com', 'books.google.com', 'books.googleusercontent.com', 'catalogue.bnf.fr'];
// Police Playfair Display (Google Fonts) gardée en cache pour le mode hors ligne
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];
const FONTS = 'ma-bibliotheque-fonts-v1';
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('ma-bibliotheque-') && k !== CACHE && k !== COVERS && k !== FONTS).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) {
    const isCover = e.request.destination === 'image' && COVER_HOSTS.includes(url.hostname) && (url.hostname !== 'catalogue.bnf.fr' || url.pathname === '/couverture');
    const isFont = FONT_HOSTS.includes(url.hostname);
    if (isCover || isFont) {
      e.respondWith(caches.open(isFont ? FONTS : COVERS).then(c => c.match(e.request).then(hit => hit || fetch(e.request).then(r => {
        if (r.ok || r.type === 'opaque') c.put(e.request, r.clone()).catch(() => {});
        return r;
      }))));
    }
    return; // ne jamais intercepter l'API GitHub ni les API de recherche ISBN
  }
  // Réseau d'abord (toujours la dernière version), mais si le réseau traîne (> 4 s, ex. 4G faible) on sert la copie locale
  e.respondWith(new Promise(resolve => {
    let done = false;
    const fromCache = () => caches.match(e.request, {ignoreSearch: true}).then(r => r || (e.request.mode === 'navigate' ? caches.match('./index.html') : undefined));
    const net = fetch(e.request).then(r => {
      if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {}); }
      return r;
    });
    const t = setTimeout(() => fromCache().then(r => { if (r && !done) { done = true; resolve(r); } }), 4000);
    net.then(r => { clearTimeout(t); if (!done) { done = true; resolve(r); } })
       .catch(() => { clearTimeout(t); fromCache().then(r => { if (!done) { done = true; resolve(r || Response.error()); } }); });
  }));
});
