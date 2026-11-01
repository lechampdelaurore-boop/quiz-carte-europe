// Garde le jeu disponible hors ligne et permet de l'installer sur un téléphone.
// Changer CACHE à chaque mise à jour des fichiers du jeu.
var CACHE = 'quiz-carte-europe-v1';
var FONTS = 'quiz-carte-europe-polices';
var FILES = [
  './',
  './index.html',
  './app.js',
  './styles.css',
  './map-data.js',
  './data/france-departements.js',
  './data/france-fleuves.js',
  './data/france-regions.js',
  './data/index.js',
  './data/monde-afrique.js',
  './data/monde-amerique-nord.js',
  './data/monde-amerique-sud.js',
  './data/monde-asie.js',
  './data/monde-continents.js',
  './data/monde-oceanie.js',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(FILES); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE && k !== FONTS; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

function saveTo(name, req, res) {
  if (res.ok || res.type === 'opaque') { var copy = res.clone(); caches.open(name).then(function (c) { c.put(req, copy); }); }
  return res;
}

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);

  // Polices Google : la copie gardée d'abord, sinon le réseau.
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.match(req, { cacheName: FONTS }).then(function (hit) {
      return hit || fetch(req).then(function (res) { return saveTo(FONTS, req, res); });
    }));
    return;
  }
  if (url.origin !== location.origin) return;

  // Tout le reste passe d'abord par le réseau pour recevoir les mises à jour,
  // puis la copie gardée hors ligne (les paramètres ?v= sont ignorés en secours).
  e.respondWith(
    fetch(req).then(function (res) { return saveTo(CACHE, req, res); }).catch(function () {
      return caches.match(req, { cacheName: CACHE }).then(function (hit) {
        return hit || caches.match(req, { cacheName: CACHE, ignoreSearch: true });
      }).then(function (hit) {
        return hit || (req.mode === 'navigate' ? caches.match('./index.html', { cacheName: CACHE }) : Response.error());
      });
    })
  );
});
