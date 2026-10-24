const CACHE = 'ma-bibliotheque-v18';
const COVERS = 'ma-bibliotheque-covers-v2'; // v1 (trop large : toutes les images BnF) supprimé à l'activation
const COVERS_MAX = 400; // au-delà, les plus anciennes entrées sont retirées
const ASSETS = ['./', './index.html', './releases.js', './manifest.webmanifest', './icon-192.png', './icon-512.png'];
// Images de couverture mises en cache pour l'affichage hors ligne (jamais les API, jamais api.github.com)
const COVER_HOSTS = ['covers.openlibrary.org', 'images-na.ssl-images-amazon.com', 'books.google.com', 'books.googleusercontent.com', 'catalogue.bnf.fr', 's4.anilist.co'];
// Police Playfair Display (Google Fonts) gardée en cache pour le mode hors ligne
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];
const FONTS = 'ma-bibliotheque-fonts-v1';
// BnF : seules les vignettes /couverture ; AniList : seules les images /file/… (pas les avatars ni les bannières du site)
function isCoverUrl(url) {
  if (!COVER_HOSTS.includes(url.hostname)) return false;
  if (url.hostname === 'catalogue.bnf.fr') return url.pathname === '/couverture';
  if (url.hostname === 's4.anilist.co') return url.pathname.startsWith('/file/');
  return true;
}
let trimming = null;
function trimCovers(c) { // plafond ~400 : cache.keys() rend les entrées dans l'ordre d'insertion
  if (trimming) return trimming;
  trimming = c.keys().then(keys => { const extra = keys.length - COVERS_MAX; return extra > 0 ? Promise.all(keys.slice(0, extra).map(k => c.delete(k))) : null; })
    .catch(() => {}).then(() => { trimming = null; });
  return trimming;
}
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
    const isCover = e.request.destination === 'image' && isCoverUrl(url);
    const isFont = FONT_HOSTS.includes(url.hostname);
    if (isCover || isFont) {
      e.respondWith(caches.open(isFont ? FONTS : COVERS).then(c => c.match(e.request).then(hit => hit || fetch(e.request).then(r => {
        if (r.ok || r.type === 'opaque') { const p = c.put(e.request, r.clone()).then(() => isFont ? null : trimCovers(c)).catch(() => {}); e.waitUntil(p); }
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
