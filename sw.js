/* Coup du Jour : service worker (fonctionnement hors ligne) */
const VERSION="cdj-v18";
const SHELL=["./","index.html","styles.css","advice.js","social.js","groupe.js","card.js","extras.js","peche.js","alerts.js","offline.js","config.js","manifest.webmanifest",
  "icon-192.png","badge-96.png","icon-512.png"];
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
    e.respondWith(fetch(req,{cache:"no-cache"}).then(r=>{ const cp=r.clone(); caches.open(VERSION).then(c=>c.put(req,cp)); return r; })
      .catch(()=>caches.match(req).then(r=>r||caches.match("index.html"))));
  }else if(CDN.includes(url.hostname)){
    e.respondWith(caches.match(req).then(r=>r||fetch(req).then(res=>{ const cp=res.clone(); caches.open(VERSION).then(c=>c.put(req,cp)); return res; })));
  }
});

// ---- Notifications push ----
self.addEventListener("push",e=>{
  let d={};
  try{ d=e.data?e.data.json():{}; }catch(_){ d={body:e.data?e.data.text():""}; }
  e.waitUntil(self.registration.showNotification(d.title||"Coup du Jour",{
    body:d.body||"", icon:"icon-192.png", badge:"badge-96.png", tag:d.tag, renotify:!!d.tag, vibrate:[80,40,80], timestamp:Date.now(), data:{url:d.url||"./"}
  }));
});
self.addEventListener("notificationclick",e=>{
  e.notification.close();
  const url=new URL((e.notification.data&&e.notification.data.url)||"./",self.registration.scope).href;
  e.waitUntil(clients.matchAll({type:"window",includeUncontrolled:true}).then(list=>{
    for(const c of list){
      if(c.url.startsWith(self.registration.scope)){
        return c.focus().then(w=>w&&w.navigate?w.navigate(url).catch(()=>w):w);
      }
    }
    return clients.openWindow(url);
  }));
});
