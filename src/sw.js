/* Service worker do Visions OS: deixa o app instalável e abrir sem internet.
   - Página: sempre tenta a versão nova da rede; sem internet, usa a última salva.
   - Bibliotecas (unpkg) e fontes: guardadas no aparelho (URLs com versão fixa).
   - Banco (Firebase) e funções do Netlify: nunca passam pelo cache. */
const V = 'vos-v1';
const SHELL = ['./', './icon-192.png', './icon-512.png', './manifest.webmanifest'];
self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const u = new URL(req.url);
  if (u.hostname.endsWith('firebaseio.com') || u.pathname.startsWith('/.netlify/') || u.hostname.includes('awesomeapi')) return;
  if (req.mode === 'navigate' || (u.origin === location.origin && u.pathname.endsWith('.html'))) {
    e.respondWith(fetch(req).then(r => { const c = r.clone(); caches.open(V).then(x => x.put('./', c)); return r; }).catch(() => caches.match('./')));
    return;
  }
  if (u.hostname === 'unpkg.com' || u.hostname.includes('fonts.g') || u.origin === location.origin) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => { if (r.ok || r.type === 'opaque') { const c = r.clone(); caches.open(V).then(x => x.put(req, c)); } return r; })));
  }
});
