/* Coup du Jour : service worker (fonctionnement hors ligne) */
const VERSION="cdj-v1";
const SHELL=["./","index.html","styles.css","advice.js","social.js","config.js","manifest.webmanifest",
  "icons/icon-192.png","icons/icon-512.png"];
const CDN=["unpkg.com","cdn.jsdelivr.net","fonts.googleapis.com","fonts.gstatic.com"];
self.addEventListener("install",e=>{ e.waitUntil(caches.open(VERSION).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting())); });
self.addEventListener("activate",e=>{
  e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==VERSION).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener("fetch",e=>{
  const req=e.request; if(req.method!=="GET") return;
  const url=new URL(req.url);
  if(url.origin===location.origin){
    // réseau d'abord pour recevoir les mises à jour, cache si hors ligne
    e.respondWith(fetch(req).then(r=>{ const cp=r.clone(); caches.open(VERSION).then(c=>c.put(req,cp)); return r; })
      .catch(()=>caches.match(req).then(r=>r||caches.match("index.html"))));
  }else if(CDN.includes(url.hostname)){
    e.respondWith(caches.match(req).then(r=>r||fetch(req).then(res=>{ const cp=res.clone(); caches.open(VERSION).then(c=>c.put(req,cp)); return res; })));
  }
});
