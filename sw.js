/* Rivio : service worker (fonctionnement hors ligne) */
const VERSION="cdj-v73";
const SHELL=["./","index.html","styles.css","advice.js","social.js","groupe.js","card.js","extras.js","peche.js","alerts.js","offline.js","species.js","dex.js","reco.js","outings.js","maptools.js","profile.js","layout.js","tools.js","lures.js","compet.js","modo.js","share.js","maplayers.js","stock.js","gofish.js","voice.js","today.js","ui.js","feed.js","onboard.js","postsheet.js","sharein.js","calendar.js","knots.js","fraie.js","carpe2.js","account.js","techniques.js","notifs.js","calc.js","previsions.js","environnement.js","structures.js","assistant.js","recap.js","nav.js","invite.js","share.html","confidentialite.html","config.js","manifest.webmanifest",
  "icon-192.png","badge-96.png","logo.svg","logo-96.png"];
const CDN=["unpkg.com","cdn.jsdelivr.net","fonts.googleapis.com","fonts.gstatic.com"];
self.addEventListener("install",e=>{ e.waitUntil(caches.open(VERSION).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting())); });
self.addEventListener("activate",e=>{
  e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==VERSION&&k!=="cdj-tiles"&&k!=="cdj-share").map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener("fetch",e=>{
  const req=e.request;
  // « Partager → Rivio » depuis la galerie : on garde les photos puis on ouvre l'appli
  if(req.method==="POST"&&new URL(req.url).pathname.endsWith("/share-target")){
    e.respondWith((async()=>{
      try{
        const fd=await req.formData(); const files=fd.getAll("photos").filter(f=>f&&f.size).slice(0,6);
        const c=await caches.open("cdj-share"); for(const k of await c.keys()) await c.delete(k);
        await Promise.all(files.map((f,i)=>c.put("./shared-"+i,new Response(f,{headers:{"Content-Type":f.type||"image/jpeg","X-Name":encodeURIComponent(f.name||("photo-"+i+".jpg"))}}))));
        const t=[fd.get("title"),fd.get("text")].filter(Boolean).join(" ").slice(0,300);
        if(t) await c.put("./shared-text",new Response(t));
      }catch(_){}
      return Response.redirect("./index.html?shared=1#fil",303);
    })());
    return;
  }
  if(req.method!=="GET") return;
  const url=new URL(req.url);
  if(url.origin===location.origin){
    // réseau d'abord pour recevoir les mises à jour, cache si hors ligne
    e.respondWith(fetch(req,{cache:"no-cache"}).then(r=>{ const cp=r.clone(); caches.open(VERSION).then(c=>c.put(req,cp)); return r; })
      .catch(()=>caches.match(req).then(r=>r||caches.match("index.html"))));
  }else if(url.hostname==="data.geopf.fr"){
    // tuiles IGN : celles téléchargées pour le hors ligne d'abord, sinon le réseau
    e.respondWith(caches.open("cdj-tiles").then(c=>c.match(req.url).then(r=>r||fetch(req).catch(()=>new Response("",{status:504})))));
  }else if(CDN.includes(url.hostname)){
    e.respondWith(caches.match(req).then(r=>r||fetch(req).then(res=>{ const cp=res.clone(); caches.open(VERSION).then(c=>c.put(req,cp)); return res; })));
  }
});

// ---- Notifications push ----
self.addEventListener("push",e=>{
  let d={};
  try{ d=e.data?e.data.json():{}; }catch(_){ d={body:e.data?e.data.text():""}; }
  e.waitUntil(self.registration.showNotification(d.title||"Rivio",{
    body:d.body||"", icon:"icon-192.png", badge:"badge-96.png", tag:d.tag, renotify:!!d.tag,
    vibrate:d.alarm?[600,250,600,250,600,250,900]:[80,40,80], requireInteraction:!!d.alarm, timestamp:Date.now(), data:{url:d.url||"./"}
  }).then(()=>self.clients.matchAll({type:"window"})).then(cs=>cs.forEach(c=>c.postMessage({type:"push"}))));
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
