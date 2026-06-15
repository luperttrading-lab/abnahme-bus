/* Service Worker — Abnahmeprotokoll Bus
   Strategie:
   - App-Dateien (Shell) beim Install cachen → offline lauffähig
   - index.html: network-first (neueste Version), Cache nur als Offline-Fallback
   - übrige Dateien: cache-first (schnell), Netz als Nachschub
   Bei jeder neuen App-Version die CACHE-Zahl erhöhen → alter Cache wird ersetzt. */
var CACHE = 'abnahme-bus-v4.54';
var SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-180.png',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', function(e){
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(function(c){
      // index.html und Root sind kritisch fürs Offline-Starten → frisch holen und sicher ablegen
      var critical = fetch('./index.html', {cache:'reload'}).then(function(res){
        if(res && res.ok){ return c.put('./index.html', res.clone()).then(function(){ return c.put('./', res.clone()); }); }
      }).catch(function(){});
      var rest = Promise.all(SHELL.filter(function(u){ return u!=='./' && u!=='./index.html'; })
        .map(function(u){ return c.add(u).catch(function(){}); }));
      return Promise.all([critical, rest]);
    })
  );
});

self.addEventListener('activate', function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.filter(function(k){ return k !== CACHE; })
                             .map(function(k){ return caches.delete(k); }));
    }).then(function(){ return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function(e){
  var req = e.request;
  if(req.method !== 'GET'){ return; }
  var url = new URL(req.url);
  if(url.origin !== self.location.origin){ return; }   // nur eigene Dateien

  var isDoc = req.mode === 'navigate' ||
              url.pathname.endsWith('/') ||
              url.pathname.endsWith('index.html');

  if(isDoc){
    // network-first: immer versuchen, die neueste index.html zu holen
    e.respondWith(
      fetch(req).then(function(res){
        var copy = res.clone();
        caches.open(CACHE).then(function(c){ c.put('./index.html', copy); });
        return res;
      }).catch(function(){
        return caches.match('./index.html').then(function(m){ return m || caches.match('./'); });
      })
    );
    return;
  }

  // cache-first für Icons/Manifest/Sonstiges
  e.respondWith(
    caches.match(req).then(function(m){
      return m || fetch(req).then(function(res){
        var copy = res.clone();
        caches.open(CACHE).then(function(c){ c.put(req, copy); });
        return res;
      }).catch(function(){ return m; });
    })
  );
});
