// Coup du Jour : fonds de carte (plan, IGN, satellite), radar de pluie, parkings et toilettes,
// carte hors ligne, trace GPS des sorties, et mode « Fond » (profondeurs et nature du fond).
(function(){
"use strict";
const A=window.CDJ; if(!A) return;
const {el,toast,frError,confirmBtn}=A;
const $=s=>document.querySelector(s);
const get=(k,d)=>{ try{ return localStorage.getItem(k)??d; }catch(e){ return d; } };
const set=(k,v)=>{ try{ localStorage.setItem(k,v); }catch(e){} };
function btn(label,cls,fn){ const b=el("button",cls||"btn",label); b.type="button"; if(fn) b.addEventListener("click",fn); return b; }
const IGN=layer=>"https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER="+layer+"&STYLE=normal&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&FORMAT="+(layer.startsWith("ORTHO")?"image/jpeg":"image/png");
const BASES={
  plan:{t:"🗺️ Plan",url:"https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",o:{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'}},
  ign:{t:"🧭 IGN",url:IGN("GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2"),o:{maxZoom:19,maxNativeZoom:18,attribution:"&copy; IGN Géoplateforme"}},
  sat:{t:"🛰️ Satellite",url:IGN("ORTHOIMAGERY.ORTHOPHOTOS"),o:{maxZoom:20,maxNativeZoom:19,attribution:"&copy; IGN Géoplateforme"}},
};
let map=null, base=null, baseKey=get("cdj-base","plan"), radar=null, poiLayer=null, poiOn=get("cdj-poi","1")==="1", radarOn=false;

/* ---------- Barre des calques ---------- */
function bar(){
  const box=$("#map-layers"); if(!box) return;
  box.hidden=!(A.me&&A.groups.length);
  const sb=$("#carte-sub"); if(sb) sb.hidden=box.hidden;
  box.innerHTML=""; box.classList.toggle("fond",mode==="fond");
  const seg=el("div","seg base-seg"); seg.setAttribute("aria-label","Fond de carte");
  Object.entries(BASES).forEach(([k,b])=>{ const x=btn(b.t,null,()=>{ setBase(k); bar(); }); x.setAttribute("aria-pressed",String(k===baseKey)); seg.append(x); });
  box.append(seg);
  const row=el("div","map-row lp-row");
  const pb=btn("🅿️🚻 Parkings & WC","btn small"+(poiOn?" on":""),()=>{ poiOn=!poiOn; set("cdj-poi",poiOn?"1":"0"); poi(); bar(); });
  const rb=btn("🌧️ Radar pluie","btn small"+(radarOn?" on":""),()=>{ radarOn=!radarOn; rain(); bar(); });
  const ob=btn("⬇️ Carte hors ligne","btn small",offline);
  const wb=btn("💨 Vent","btn small"+(wind.on?" on":""),()=>{ wind.on=!wind.on; loadWind(); bar(); });
  const zb=btn("🚧 Zones","btn small"+(zones.on?" on":""),()=>{ zones.on=!zones.on; set("cdj-zones",zones.on?"1":"0"); loadZones(); bar(); });
  row.append(wb,zb,pb,rb,ob); box.append(row);
  // boutons flottants sur la carte : mesurer, tracer, spot ici
  const fabs=$("#map-fabs");
  if(fabs){
    fabs.hidden=box.hidden;
    const sh=$("#spot-here");
    [...fabs.children].forEach(c=>{ if(c!==sh) c.remove(); });
    const fab=(ic,label,on,fn)=>{ const b=btn(ic,"map-fab"+(on?" on":""),fn); b.setAttribute("aria-label",label); b.title=label; return b; };
    fabs.prepend(fab(ruler.on?"✕📏":"📏",ruler.on?"Fin de la mesure":"Mesurer une distance",ruler.on,()=>ruler.on?stopRuler():startRuler()),
      fab(track.on?"⏹️":"🛶",track.on?"Fin de la trace":"Tracer ma sortie",track.on,()=>track.on?stopTrack():startTrack()));
    if(sh&&sh.parentNode!==fabs){ sh.className="map-fab spot-fab"; sh.textContent="📍"; sh.setAttribute("aria-label","Spot à ma position"); sh.title="Spot à ma position"; fabs.append(sh); }
    if(sh) sh.hidden=mode==="fond";
  }
  // bandeaux d'état par-dessus la carte
  const st=$("#map-status")||box;
  if(st!==box) st.innerHTML="";
  if(ruler.on) st.append(rulerBar());
  if(wind.on) st.append(windBar());
  if(zones.on&&(zones.draw||st===box)) st.append(zoneBar());
  if(zones.on&&!zones.draw&&st!==box) box.append(zoneBar());
  if(st!==box&&mode!=="fond"&&!ruler.on&&!zones.draw&&!track.on&&typeof A.cur==="number"&&!A.spots.some(x=>x.group_id===A.cur)){
    const h=el("div","map-hint"); h.append(el("b",null,"📍 Aucun spot pour l'instant"),el("span",null,"Touche la carte à l'endroit voulu, ou le bouton 📍 pour créer un spot à ta position.")); st.append(h);
  }
  if(track.on){
    const t=el("div","track-live");
    t.append(el("span",null,"● Trace en cours · "+fmtDist(track.dist)+" · "+track.bites.length+" touche"+(track.bites.length>1?"s":"")));
    t.append(btn("🎣 Touche ici !","btn primary small",addBite));
    st.append(t);
  }
  // sous la carte : légende du radar et liste des traces (la carte reste visible en haut)
  const below=$("#map-below");
  if(below){
    below.hidden=box.hidden||mode==="fond"; below.innerHTML="";
    if(radarOn&&radar?._cdjTime) below.append(el("p","note","Radar pluie : image de "+radar._cdjTime+" (RainViewer), le bleu clair est faible, le jaune et le rouge sont forts."));
    below.append(aappmaCard());
    below.append(tracksList());
  }
}
function setBase(k){
  if(!map||!BASES[k]) return;
  baseKey=k; set("cdj-base",k);
  // retire le fond d'origine (OpenStreetMap posé par social.js) ou le fond précédent
  map.eachLayer(l=>{ if(l instanceof L.TileLayer&&!l._cdjOverlay) map.removeLayer(l); });
  base=L.tileLayer(BASES[k].url,BASES[k].o).addTo(map); base.bringToBack?.();
  if(radar) radar.bringToFront?.();
}

/* ---------- Radar de pluie (RainViewer, gratuit) ---------- */
async function rain(){
  if(!map) return;
  if(radar){ map.removeLayer(radar); radar=null; }
  if(!radarOn) return;
  try{
    const r=await fetch("https://api.rainviewer.com/public/weather-maps.json"); const d=await r.json();
    const f=d.radar?.past?.[d.radar.past.length-1]; if(!f) throw 0;
    radar=L.tileLayer(d.host+f.path+"/256/{z}/{x}/{y}/2/1_1.png",{opacity:.65,maxNativeZoom:7,maxZoom:19,attribution:"Radar &copy; RainViewer",zIndex:400});
    radar._cdjOverlay=true; radar._cdjTime=new Date(f.time*1000).toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"});
    radar.addTo(map); bar();
  }catch(e){ radarOn=false; toast("Radar pluie indisponible pour le moment"); bar(); }
}

/* ---------- Parkings et toilettes publiques (OpenStreetMap, quel que soit le fond) ---------- */
const poiCache=new Map(); let poiTimer=null;
function poiIcon(kind){ return L.divIcon({className:"",html:'<div class="poi-pin '+kind+'">'+(kind==="wc"?"WC":"P")+'</div>',iconSize:[24,24],iconAnchor:[12,12],popupAnchor:[0,-10]}); }
function poi(){
  if(!map) return;
  if(!poiLayer){ poiLayer=L.layerGroup(); }
  if(!poiOn){ map.removeLayer(poiLayer); return; }
  if(!map.hasLayer(poiLayer)) poiLayer.addTo(map);
  clearTimeout(poiTimer); poiTimer=setTimeout(loadPoi,500);
}
async function loadPoi(){
  if(!poiOn||!map) return;
  if(map.getZoom()<13){ poiLayer.clearLayers(); return; }
  const b=map.getBounds(), r=x=>Math.round(x*50)/50;
  const s=r(b.getSouth()-.01), w=r(b.getWest()-.01), n=r(b.getNorth()+.01), e=r(b.getEast()+.01);
  const key=[s,w,n,e].join(",");
  let data=poiCache.get(key);
  if(!data){
    const q='[out:json][timeout:15];(nwr["amenity"="parking"]('+key+');nwr["amenity"="toilets"]('+key+'););out center 300;';
    try{
      const res=await fetch("https://overpass-api.de/api/interpreter",{method:"POST",body:"data="+encodeURIComponent(q),headers:{"Content-Type":"application/x-www-form-urlencoded"}});
      if(!res.ok) throw 0; data=(await res.json()).elements||[]; poiCache.set(key,data);
    }catch(err){ return; }
  }
  poiLayer.clearLayers();
  data.forEach(x=>{
    const lat=x.lat??x.center?.lat, lon=x.lon??x.center?.lon; if(lat==null) return;
    const t=x.tags||{}, wc=t.amenity==="toilets";
    const m=L.marker([lat,lon],{icon:poiIcon(wc?"wc":"park"),zIndexOffset:-500});
    const p=el("div"); p.append(el("b",null,(wc?"🚻 Toilettes":"🅿️ Parking")+(t.name?" · "+t.name:"")));
    const info=[t.fee==="yes"?"payant":t.fee==="no"?"gratuit":null,t.access==="private"?"privé":null,t.capacity?t.capacity+" places":null,t.wheelchair==="yes"?"accessible PMR":null,t.opening_hours?"horaires : "+t.opening_hours:null].filter(Boolean).join(" · ");
    if(info) p.append(el("div",null,info));
    const go=el("a",null,"Itinéraire"); go.href="https://www.google.com/maps/dir/?api=1&destination="+lat+","+lon; go.target="_blank"; go.rel="noopener"; p.append(go);
    m.bindPopup(p); m.addTo(poiLayer);
  });
}

/* ---------- Carte hors ligne (tuiles IGN autour des spots) ---------- */
function tilesAround(lat,lon,km,z){
  const n=2**z, x=(lon+180)/360*n, latR=lat*Math.PI/180, y=(1-Math.log(Math.tan(latR)+1/Math.cos(latR))/Math.PI)/2*n;
  const per=40075*Math.cos(latR)/n, d=Math.ceil(km/per), out=[];
  for(let i=Math.floor(x)-d;i<=Math.floor(x)+d;i++) for(let j=Math.floor(y)-d;j<=Math.floor(y)+d;j++) out.push([z,i,j]);
  return out;
}
async function offline(){
  const spots=A.spots.filter(s=>A.cur==="all"||s.group_id===A.cur);
  const centers=spots.length?spots.map(s=>[s.lat,s.lon]):(map?[[map.getCenter().lat,map.getCenter().lng]]:[]);
  if(!centers.length) return toast("Ajoute d'abord des spots sur la carte");
  const layer=baseKey==="sat"?"ORTHOIMAGERY.ORTHOPHOTOS":"GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2";
  const set_=new Set(); centers.slice(0,15).forEach(([la,lo])=>{ for(let z=11;z<=16;z++) tilesAround(la,lo,z>=15?1.2:3,z).forEach(t=>set_.add(t.join("/"))); });
  const list=[...set_].slice(0,1500);
  if(!confirm("Télécharger la carte "+(baseKey==="sat"?"satellite":"IGN")+" autour de "+Math.min(centers.length,15)+" spot"+(centers.length>1?"s":"")+" ("+list.length+" images, environ "+Math.round(list.length*(baseKey==="sat"?.03:.015))+" Mo) ?")) return;
  const cache=await caches.open("cdj-tiles"); let ok=0;
  toast("Téléchargement de la carte…");
  for(let k=0;k<list.length;k+=6){
    await Promise.all(list.slice(k,k+6).map(async s=>{ const [z,x,y]=s.split("/"); const u=IGN(layer).replace("{z}",z).replace("{x}",x).replace("{y}",y);
      try{ if(await cache.match(u)){ ok++; return; } const r=await fetch(u); if(r.ok){ await cache.put(u,r); ok++; } }catch(e){} }));
  }
  toast(ok+" morceaux de carte gardés hors ligne. Choisis le fond "+(baseKey==="sat"?"Satellite":"IGN")+" sans réseau.");
  if(baseKey==="plan"){ setBase("ign"); bar(); }
}

/* ---------- Trace GPS de la sortie ---------- */
const TKEY="cdj-track-live";
const track={on:false,watch:null,pts:[],bites:[],dist:0,start:null,line:null,layer:null};
const fmtDist=m=>m>=1000?(m/1000).toFixed(1).replace(".",",")+" km":Math.round(m)+" m";
function hav(a,b){ const R=6371e3,r=Math.PI/180,dl=(b[0]-a[0])*r,dg=(b[1]-a[1])*r; const h=Math.sin(dl/2)**2+Math.cos(a[0]*r)*Math.cos(b[0]*r)*Math.sin(dg/2)**2; return 2*R*Math.asin(Math.sqrt(h)); }
function save(){ set(TKEY,JSON.stringify({pts:track.pts,bites:track.bites,start:track.start,dist:track.dist})); }
function drawLive(){
  if(!map) return;
  if(!track.layer) track.layer=L.layerGroup().addTo(map);
  track.layer.clearLayers();
  if(track.pts.length>1) L.polyline(track.pts.map(p=>[p[0],p[1]]),{color:"#d93a2b",weight:4}).addTo(track.layer);
  track.bites.forEach(b=>L.marker([b[0],b[1]],{icon:L.divIcon({className:"",html:'<div class="bite-pin">🎣</div>',iconSize:[26,26],iconAnchor:[13,13]})}).addTo(track.layer));
}
function startTrack(resume,opts){
  if(!("geolocation" in navigator)) return toast("Localisation indisponible");
  if(!resume){ track.pts=[]; track.bites=[]; track.dist=0; track.start=Date.now(); track.quiet=!!opts?.quiet; }
  track.on=true;
  track.watch=navigator.geolocation.watchPosition(p=>{
    const pt=[+p.coords.latitude.toFixed(6),+p.coords.longitude.toFixed(6),Math.round((Date.now()-track.start)/1000)];
    const last=track.pts[track.pts.length-1];
    if(p.coords.accuracy>60) return;
    if(last){ const d=hav(last,pt); if(d<12) return; track.dist+=d; }
    track.pts.push(pt); save(); drawLive(); if(!$("#v-carte").hidden) updateLive();
    // premier point : les potes proches sont prévenus (distance seulement), sauf si la sortie est déjà annoncée
    if(track.pts.length===1&&!track.quiet&&!resume) A.checkin?.quiet("trace",{lat:pt[0],lon:pt[1]});
  },e=>{ if(e.code===1){ toast("Autorise la localisation pour tracer ta sortie"); stopTrack(true); } },{enableHighAccuracy:true,maximumAge:5000,timeout:30000});
  if(!resume) toast("Trace démarrée : garde l'appli ouverte pendant la sortie");
  bar(); drawLive();
}
function updateLive(){ const s=document.querySelector(".track-live span"); if(s) s.textContent="● Trace en cours · "+fmtDist(track.dist)+" · "+track.bites.length+" touche"+(track.bites.length>1?"s":""); }
function addBite(){
  const last=track.pts[track.pts.length-1];
  const push=(la,lo)=>{ track.bites.push([la,lo,Math.round((Date.now()-track.start)/1000)]); save(); drawLive(); bar(); toast("🎣 Touche notée ici"); if(navigator.vibrate) try{ navigator.vibrate(60); }catch(e){} };
  navigator.geolocation.getCurrentPosition(p=>push(+p.coords.latitude.toFixed(6),+p.coords.longitude.toFixed(6)),()=>{ if(last) push(last[0],last[1]); else toast("Position introuvable"); },{enableHighAccuracy:true,timeout:8000,maximumAge:5000});
}
async function stopTrack(discard){
  if(track.watch!=null) navigator.geolocation.clearWatch(track.watch);
  track.watch=null; track.on=false;
  A.hooks.trackStopped?.();
  const data={pts:track.pts,bites:track.bites,dist:track.dist,start:track.start};
  try{ localStorage.removeItem(TKEY); }catch(e){}
  if(track.layer) track.layer.clearLayers();
  if(discard||data.pts.length<2){ if(!discard) toast("Trace trop courte, rien d'enregistré"); bar(); return; }
  const title=prompt("Nom de la sortie (facultatif) :",new Date(data.start).toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long"}))||null;
  const {data:saved,error}=await A.sb.from("tracks").insert({user_id:A.me.id,group_id:typeof A.cur==="number"?A.cur:null,title,started_at:new Date(data.start).toISOString(),ended_at:new Date().toISOString(),points:data.pts,bites:data.bites,distance_m:Math.round(data.dist)}).select("id").single();
  if(error){ toast(frError(error)); set(TKEY,JSON.stringify(data)); return; }
  toast("Trace enregistrée · "+fmtDist(data.dist)); myTracks=null; bar();
  // bilan pré-rempli : durée, distance, touches et météo au point d'arrivée
  if(typeof A.cur==="number"&&A.bilanFromTrack&&confirm("Faire le bilan de cette sortie ? Durée, distance, touches et météo sont déjà remplies.")){
    const last=data.pts[data.pts.length-1];
    try{ await window.CDJ_ADVICE?.loadAt(last[0],last[1]); }catch(e){}
    A.bilanFromTrack({track_id:saved?.id||null,duration_min:Math.round((Date.now()-data.start)/6e4),distance_m:Math.round(data.dist),bites:data.bites.length,title});
  }
}
let myTracks=null, shown=new Map();
function tracksList(){
  const w=el("details","tracks"); w.open=get("cdj-tracks-open","0")==="1";
  w.addEventListener("toggle",()=>{ set("cdj-tracks-open",w.open?"1":"0"); if(w.open&&!myTracks) loadTracks(w); });
  w.append(el("summary",null,"🛶 Mes traces"));
  if(w.open) loadTracks(w);
  return w;
}
async function loadTracks(w){
  if(!myTracks){ const {data,error}=await A.sb.from("tracks").select("id,user_id,title,started_at,ended_at,distance_m,points,bites,shared,group_id,profiles(username)").order("started_at",{ascending:false}).limit(20); if(error) return; myTracks=data||[]; }
  [...w.querySelectorAll(".tr-row,.note")].forEach(x=>x.remove());
  if(!myTracks.length){ w.append(el("p","note","Aucune trace. Lance « Tracer ma sortie » au début de ta session.")); return; }
  myTracks.forEach(t=>{
    const r=el("div","tr-row"); const mine=t.user_id===A.me.id;
    const l=el("div"); l.append(el("b",null,(t.title||"Sortie")+(mine?"":" · @"+(t.profiles?.username||"?"))), el("div","note",new Date(t.started_at).toLocaleDateString("fr-FR",{day:"numeric",month:"short"})+" · "+fmtDist(t.distance_m||0)+" · "+(t.bites||[]).length+" touche"+((t.bites||[]).length>1?"s":"")));
    const act=el("div","actions");
    const on=shown.has(t.id);
    act.append(btn(on?"Masquer":"Voir","btn small"+(on?" on":""),()=>{ toggleTrack(t); loadTracks(w); }));
    if(mine){
      act.append(btn(t.shared?"👥 Partagée":"🔒 Privée","linkbtn",async()=>{ const {error}=await A.sb.from("tracks").update({shared:!t.shared}).eq("id",t.id); if(error) return toast(frError(error)); t.shared=!t.shared; toast(t.shared?"Trace visible par le groupe":"Trace privée"); loadTracks(w); }));
      act.append(confirmBtn("🗑","Supprimer ?",async()=>{ const {error}=await A.sb.from("tracks").delete().eq("id",t.id); if(error) return toast(frError(error)); if(shown.has(t.id)) toggleTrack(t); myTracks=myTracks.filter(x=>x.id!==t.id); loadTracks(w); },"linkbtn danger"));
    }
    r.append(l,act); w.append(r);
  });
}
function toggleTrack(t){
  if(!map) return;
  if(shown.has(t.id)){ map.removeLayer(shown.get(t.id)); shown.delete(t.id); return; }
  const g=L.layerGroup();
  const pts=(t.points||[]).map(p=>[p[0],p[1]]);
  if(pts.length>1) L.polyline(pts,{color:"#2c5f8f",weight:4,opacity:.85}).addTo(g);
  if(pts[0]) L.circleMarker(pts[0],{radius:6,color:"#2c8b73",fillOpacity:1}).bindPopup("Départ").addTo(g);
  (t.bites||[]).forEach(b=>L.marker([b[0],b[1]],{icon:L.divIcon({className:"",html:'<div class="bite-pin">🎣</div>',iconSize:[26,26],iconAnchor:[13,13]})}).bindPopup("Touche · "+Math.round(b[2]/60)+" min après le départ").addTo(g));
  g.addTo(map); shown.set(t.id,g);
  if(pts.length) map.fitBounds(L.latLngBounds(pts).pad(.2));
}

/* ---------- Mode « Fond » : profondeurs et nature du fond ---------- */
const BOTTOMS=[["Vase","#7a5c3a"],["Sable","#e2c27a"],["Gravier","#a8a29a"],["Argile","#b36a4a"],["Herbiers","#4e9a3a"],["Rocheux","#6b6f7a"],["Encombré","#3a3a3a"],["Coquillages","#e8e2d0"]];
const BCOL=Object.fromEntries(BOTTOMS);
let mode="carte", depth={layer:null,overlay:null,pts:[],adding:null};
function depthColor(d,max){ const t=Math.min(1,d/Math.max(3,max)); const a=[178,235,242], b=[8,48,107]; return "rgb("+a.map((v,i)=>Math.round(v+(b[i]-v)*t)).join(",")+")"; }
async function loadDepth(){
  if(!A.me) return;
  let q=A.sb.from("depth_points").select("id,group_id,user_id,lat,lon,depth_m,bottom,note,created_at,profiles(username)").limit(5000);
  if(typeof A.cur==="number") q=q.eq("group_id",A.cur);
  const {data,error}=await q;
  if(error){ depth.pts=[]; return; }
  // les fiches de poste comptent aussi comme relevés
  const fromSpots=A.spots.filter(s=>(s.depth_m||s.bottom)&&(A.cur==="all"||s.group_id===A.cur)).map(s=>({id:"s"+s.id,lat:s.lat,lon:s.lon,depth_m:s.depth_m,bottom:s.bottom,note:"Fiche du poste « "+s.name+" »",spot:true}));
  depth.pts=[...(data||[]),...fromSpots];
}
function drawDepth(){
  if(!map) return;
  if(!depth.layer) depth.layer=L.layerGroup();
  depth.layer.clearLayers();
  if(depth.overlay){ map.removeLayer(depth.overlay); depth.overlay=null; }
  if(mode!=="fond"){ map.removeLayer(depth.layer); return; }
  depth.layer.addTo(map);
  const pts=depth.pts.filter(p=>p.depth_m), max=Math.max(3,...pts.map(p=>Number(p.depth_m)));
  // interpolation (pondération par l'inverse de la distance) dans un rayon de 120 m autour des relevés
  if(pts.length>=3){
    const lat0=pts.reduce((a,p)=>a+Number(p.lat),0)/pts.length, mx=111320*Math.cos(lat0*Math.PI/180), my=110540;
    const pad=150;
    let s=Math.min(...pts.map(p=>p.lat))-pad/my, n=Math.max(...pts.map(p=>p.lat))+pad/my, w=Math.min(...pts.map(p=>p.lon))-pad/mx, e=Math.max(...pts.map(p=>p.lon))+pad/mx;
    const W=Math.min(240,Math.max(40,Math.round((e-w)*mx/8))), H=Math.min(240,Math.max(40,Math.round((n-s)*my/8)));
    const c=document.createElement("canvas"); c.width=W; c.height=H; const g=c.getContext("2d"); const img=g.createImageData(W,H);
    const P=pts.map(p=>[(Number(p.lon)-w)*mx,(n-Number(p.lat))*my,Number(p.depth_m)]);
    const sx=(e-w)*mx/W, sy=(n-s)*my/H;
    for(let j=0;j<H;j++) for(let i=0;i<W;i++){
      const X=(i+.5)*sx, Y=(j+.5)*sy; let num=0,den=0,near=1e9;
      for(const [px,py,v] of P){ const d2=(px-X)**2+(py-Y)**2; near=Math.min(near,d2); if(d2<1){ num=v; den=1; break; } const wgt=1/d2; num+=wgt*v; den+=wgt; }
      const k=(j*W+i)*4;
      if(near>120*120){ img.data[k+3]=0; continue; }
      const col=depthColor(num/den,max).match(/\d+/g).map(Number);
      img.data[k]=col[0]; img.data[k+1]=col[1]; img.data[k+2]=col[2]; img.data[k+3]=Math.round(170*(1-Math.sqrt(near)/120)+40);
    }
    g.putImageData(img,0,0);
    depth.overlay=L.imageOverlay(c.toDataURL(),[[s,w],[n,e]],{opacity:.75,interactive:false}).addTo(map);
  }
  depth.pts.forEach(p=>{
    const col=p.bottom&&BCOL[p.bottom]?BCOL[p.bottom]:"#fff";
    const label=p.depth_m?String(Number(p.depth_m)).replace(".",","):"·";
    const m=L.marker([p.lat,p.lon],{icon:L.divIcon({className:"",html:'<div class="depth-pin" style="--b:'+col+'">'+label+'</div>',iconSize:[30,30],iconAnchor:[15,15],popupAnchor:[0,-12]})});
    const pop=el("div"); pop.append(el("b",null,(p.depth_m?String(p.depth_m).replace(".",",")+" m":"Profondeur ?")+(p.bottom?" · "+p.bottom:"")));
    if(p.note) pop.append(el("div",null,p.note));
    if(p.profiles?.username) pop.append(el("div","note","@"+p.profiles.username+" · "+new Date(p.created_at).toLocaleDateString("fr-FR")));
    if(!p.spot&&(p.user_id===A.me.id||A.canModerate(p.group_id))){ const d=btn("Supprimer","linkbtn danger",async()=>{ const {error}=await A.sb.from("depth_points").delete().eq("id",p.id); if(error) return toast(frError(error)); map.closePopup(); await loadDepth(); drawDepth(); }); pop.append(d); }
    m.bindPopup(pop); m.addTo(depth.layer);
  });
}
function fondPanel(){
  const box=$("#fond-panel"); if(!box) return;
  box.hidden=mode!=="fond"||!A.me;
  if(box.hidden) return;
  box.innerHTML="";
  const leg=el("div","depth-legend"); leg.append(el("span",null,"Peu profond"),el("i"),el("span",null,"Profond"));
  box.append(leg);
  const bl=el("div","chips"); BOTTOMS.forEach(([n,c])=>{ const x=el("span","chip"); const d=el("i","bdot"); d.style.background=c; x.append(d,n); bl.append(x); }); box.append(bl);
  box.append(el("p","note",depth.pts.length?depth.pts.length+" relevé"+(depth.pts.length>1?"s":"")+" (membres et fiches de poste). Touche la carte pour ajouter une profondeur ou un type de fond.":"Aucun relevé pour l'instant. Touche la carte à l'endroit sondé pour ajouter une profondeur (sondeur, plomb sondeur) et/ou la nature du fond."));
  box.append(el("p","note","Il n'existe pas de carte publique gratuite des profondeurs pour les lacs et rivières : celle-ci se construit avec les relevés du groupe. Plus il y en a, plus elle est précise."));
  if(typeof A.cur!=="number") box.append(el("p","warn","Choisis un groupe précis pour ajouter des relevés."));
}
function addDepthAt(ll){
  if(typeof A.cur!=="number"){ toast("Choisis un groupe précis pour ajouter un relevé"); return; }
  const f=el("form","depth-form");
  const di=el("input"); di.type="number"; di.step="0.1"; di.min="0.1"; di.max="200"; di.inputMode="decimal"; di.placeholder="Profondeur (m)";
  const bs=el("select"); bs.append(new Option("Fond ?","")); BOTTOMS.forEach(([n])=>bs.append(new Option(n,n)));
  const ni=el("input"); ni.maxLength=160; ni.placeholder="Note (cassure, herbier…)";
  const ok=el("button","btn primary small","Ajouter"); ok.type="submit";
  f.append(el("b",null,"Nouveau relevé"),di,bs,ni,ok);
  f.addEventListener("submit",async e=>{
    e.preventDefault();
    if(!di.value&&!bs.value) return toast("Indique une profondeur ou un type de fond");
    ok.disabled=true;
    const {error}=await A.sb.from("depth_points").insert({group_id:A.cur,user_id:A.me.id,lat:+ll.lat.toFixed(6),lon:+ll.lng.toFixed(6),depth_m:di.value?Number(di.value):null,bottom:bs.value||null,note:ni.value.trim()||null});
    ok.disabled=false;
    if(error) return toast(frError(error));
    map.closePopup(); toast("Relevé ajouté"); await loadDepth(); drawDepth(); fondPanel();
  });
  L.popup().setLatLng(ll).setContent(f).openOn(map);
  setTimeout(()=>di.focus(),100);
}
function setMode(m){
  mode=m;
  window.CDJ_MAPMODE=m;
  document.querySelectorAll("#carte-sub [data-s]").forEach(b=>b.setAttribute("aria-selected",String(b.dataset.s===m)));
  $("#map-bar")?.classList.toggle("dim",m==="fond"); bar();
  fondPanel();
  if(m==="fond") toast("Mode Fond : touche la carte pour ajouter une profondeur. Repasse sur Surface pour créer un spot.");
  if(m==="fond") loadDepth().then(()=>{ drawDepth(); fondPanel(); }); else drawDepth();
}
document.querySelectorAll("#carte-sub [data-s]").forEach(b=>b.addEventListener("click",()=>setMode(b.dataset.s)));


/* ---------- Vent sur la carte (Open-Meteo, heure par heure) ---------- */
const wind={on:false,layer:null,data:null,key:null,h:0,times:[]};
function arrowIcon(dir,kmh,gust){
  const col=kmh>=40?"#b3261e":kmh>=25?"#d9822b":kmh>=12?"#2c8b73":"#5b7a8f";
  const rot=(dir+180)%360; // la flèche indique où va le vent
  return L.divIcon({className:"",iconSize:[44,44],iconAnchor:[22,22],html:'<div class="wind-arrow" style="--c:'+col+'"><svg viewBox="0 0 24 24" style="transform:rotate('+rot+'deg)"><path d="M12 2 L18 12 H14 V22 H10 V12 H6 Z"/></svg><b>'+Math.round(kmh)+(gust&&gust>kmh+10?"<i>↯"+Math.round(gust)+"</i>":"")+'</b></div>'});
}
async function loadWind(){
  if(!map) return;
  if(!wind.layer) wind.layer=L.layerGroup();
  if(!wind.on){ map.removeLayer(wind.layer); return; }
  if(!map.hasLayer(wind.layer)) wind.layer.addTo(map);
  const b=map.getBounds(), N=4, la=[], lo=[];
  const s=b.getSouth(), n=b.getNorth(), w=b.getWest(), e=b.getEast();
  for(let i=0;i<N;i++) for(let j=0;j<N;j++){ la.push((s+(n-s)*(i+.5)/N).toFixed(3)); lo.push((w+(e-w)*(j+.5)/N).toFixed(3)); }
  const key=la.join()+lo.join();
  if(key!==wind.key){
    try{
      const r=await fetch("https://api.open-meteo.com/v1/forecast?latitude="+la.join(",")+"&longitude="+lo.join(",")+"&hourly=wind_speed_10m,wind_direction_10m,wind_gusts_10m&forecast_days=2&timezone=auto");
      if(!r.ok) throw 0; let d=await r.json(); if(!Array.isArray(d)) d=[d];
      wind.data=d; wind.key=key;
      const t0=d[0].hourly.time, off=d[0].utc_offset_seconds||0, nowKey=new Date(Date.now()+off*1000).toISOString().slice(0,13)+":00";
      wind.i0=Math.max(0,t0.indexOf(nowKey)); wind.times=t0;
    }catch(err){ toast("Vent indisponible pour le moment"); wind.on=false; bar(); return; }
  }
  drawWind(); bar();
}
function drawWind(){
  if(!wind.data||!wind.layer) return;
  wind.layer.clearLayers();
  const i=wind.i0+wind.h;
  wind.data.forEach(p=>{ const H=p.hourly; if(H.wind_speed_10m[i]==null) return;
    L.marker([p.latitude,p.longitude],{icon:arrowIcon(H.wind_direction_10m[i],H.wind_speed_10m[i],H.wind_gusts_10m?.[i]),interactive:false,zIndexOffset:-800}).addTo(wind.layer); });
}
const DIRS=["nord","nord-est","est","sud-est","sud","sud-ouest","ouest","nord-ouest"];
function windBar(){
  const w=el("div","wind-bar");
  const i=(wind.i0||0)+wind.h, t=wind.times[i];
  const mid=wind.data?.[Math.floor(wind.data.length/2)]?.hourly;
  const lab=t?(wind.h===0?"Maintenant":t.slice(8,10)+"/"+t.slice(5,7)+" "+t.slice(11,13)+"h"):"…";
  const info=mid&&mid.wind_speed_10m[i]!=null?" · vent de "+DIRS[Math.round(mid.wind_direction_10m[i]/45)%8]+", "+Math.round(mid.wind_speed_10m[i])+" km/h":"";
  w.append(el("b",null,"💨 "+lab+info));
  const r=el("input"); r.type="range"; r.min="0"; r.max="36"; r.value=String(wind.h); r.setAttribute("aria-label","Heure du vent");
  r.addEventListener("input",()=>{ wind.h=Number(r.value); drawWind(); const nb=windBar(); w.replaceWith(nb); nb.querySelector("input").focus(); });
  w.append(r, el("p","note","La flèche montre où souffle le vent. En carpe, la berge qui prend le vent dans la face concentre souvent la nourriture et les poissons."));
  return w;
}

/* ---------- Zones à respecter (dessinées par les membres) ---------- */
const ZK={reserve:["🚫","Réserve, pêche interdite","#c0392b"],nokill:["♻️","Parcours no-kill","#2c8b73"],nuit:["🌙","Carpe de nuit autorisée","#6b4fbf"],mise_eau:["🛶","Mise à l'eau","#2c5f8f"],danger:["⚠️","Danger (courant, vase, barrage)","#d9822b"],frayere:["🐣","Frayère (ne pas pêcher)","#e05a8a"],autre:["📌","Autre","#5b6c65"]};
const zones={on:get("cdj-zones","0")==="1",layer:null,list:[],draw:null};
async function loadZones(){
  if(!map) return;
  if(!zones.layer) zones.layer=L.layerGroup();
  if(!zones.on){ map.removeLayer(zones.layer); zones.draw=null; drawDraft(); return; }
  if(!map.hasLayer(zones.layer)) zones.layer.addTo(map);
  let q=A.sb.from("map_zones").select("id,group_id,user_id,kind,name,note,geom,created_at,profiles(username)").limit(500);
  if(typeof A.cur==="number") q=q.eq("group_id",A.cur);
  const {data,error}=await q;
  if(error){ zones.list=[]; toast("Zones : "+frError(error)); }
  else zones.list=data||[];
  drawZones();
}
function drawZones(){
  if(!zones.layer) return;
  zones.layer.clearLayers();
  zones.list.forEach(z=>{
    const [ic,lab,col]=ZK[z.kind]||ZK.autre, c=(z.geom?.coords||[]);
    const pop=el("div"); pop.append(el("b",null,ic+" "+(z.name||lab)));
    if(z.name) pop.append(el("div","note",lab));
    if(z.note){ const n=el("p",null,z.note); n.style.margin="6px 0"; n.style.whiteSpace="pre-wrap"; pop.append(n); }
    pop.append(el("div","note","@"+(z.profiles?.username||"?")+" · "+new Date(z.created_at).toLocaleDateString("fr-FR")));
    if(z.user_id===A.me?.id||A.canModerate(z.group_id)) pop.append(btn("Supprimer","linkbtn danger",async()=>{ if(!confirm("Supprimer cette zone ?")) return; const {error}=await A.sb.from("map_zones").delete().eq("id",z.id); if(error) return toast(frError(error)); map.closePopup(); loadZones(); }));
    let shape;
    if(z.geom?.type==="polygon"&&c.length>=3) shape=L.polygon(c,{color:col,weight:2,fillColor:col,fillOpacity:.18,dashArray:z.kind==="reserve"?"6 4":null});
    else if(z.geom?.type==="line"&&c.length>=2) shape=L.polyline(c,{color:col,weight:5,opacity:.85});
    else if(c[0]) shape=L.marker(c[0],{icon:L.divIcon({className:"",html:'<div class="zone-pin" style="--c:'+col+'">'+ic+'</div>',iconSize:[30,30],iconAnchor:[15,15],popupAnchor:[0,-14]})});
    if(shape){ shape.bindPopup(pop); shape.addTo(zones.layer); }
  });
}
function drawDraft(){
  if(!map) return;
  if(!zones.dl) zones.dl=L.layerGroup().addTo(map);
  zones.dl.clearLayers();
  const d=zones.draw; if(!d) return;
  const col=(ZK[d.kind]||ZK.autre)[2];
  if(d.pts.length>1) (d.shape==="polygon"&&d.pts.length>2?L.polygon(d.pts,{color:col,dashArray:"4 4",fillOpacity:.1}):L.polyline(d.pts,{color:col,dashArray:"4 4"})).addTo(zones.dl);
  d.pts.forEach(p=>L.circleMarker(p,{radius:5,color:col,fillOpacity:1}).addTo(zones.dl));
}
function zoneBar(){
  const w=el("div","zone-bar");
  const d=zones.draw;
  if(!d){
    const leg=el("div","zone-leg"); Object.values(ZK).forEach(([ic,lab,col])=>{ const x=el("span","chip"); x.style.borderColor=col; x.append(ic+" "+lab); leg.append(x); });
    w.append(leg);
    if(typeof A.cur==="number"){
      const sel=el("select"); sel.append(new Option("+ Ajouter une zone…",""));
      Object.entries(ZK).forEach(([k,[ic,lab]])=>sel.append(new Option(ic+" "+lab,k)));
      sel.addEventListener("change",()=>{ if(!sel.value) return; const k=sel.value; zones.draw={kind:k,shape:k==="mise_eau"?"point":"polygon",pts:[]}; drawDraft(); bar();
        toast(k==="mise_eau"?"Touche la carte à l'endroit de la mise à l'eau":"Touche la carte pour poser les coins de la zone, puis « Terminer »"); });
      w.append(sel);
    }else w.append(el("p","note","Choisis un groupe précis pour ajouter des zones."));
    w.append(el("p","note","Les zones sont dessinées par les membres : vérifie toujours l'arrêté préfectoral et les panneaux sur place."));
    return w;
  }
  const [ic,lab]=ZK[d.kind];
  w.append(el("b",null,ic+" "+lab+" · "+d.pts.length+" point"+(d.pts.length>1?"s":"")));
  const a=el("div","actions");
  if(d.kind!=="mise_eau"){
    const shp=el("select"); shp.append(new Option("Surface","polygon"),new Option("Tronçon de berge","line")); shp.value=d.shape; shp.addEventListener("change",()=>{ d.shape=shp.value; drawDraft(); }); a.append(shp);
  }
  if(d.pts.length) a.append(btn("↶","btn small",()=>{ d.pts.pop(); drawDraft(); bar(); }));
  const need=d.shape==="polygon"?3:d.shape==="line"?2:1;
  const fin=btn("Terminer","btn primary small",finishZone); fin.disabled=d.pts.length<need; a.append(fin);
  a.append(btn("Annuler","linkbtn danger",()=>{ zones.draw=null; drawDraft(); bar(); }));
  w.append(a); return w;
}
function finishZone(){
  const d=zones.draw; if(!d) return;
  const [ic,lab]=ZK[d.kind];
  const f=el("form","depth-form");
  const ni=el("input"); ni.maxLength=60; ni.placeholder="Nom (facultatif)";
  const no=el("textarea"); no.maxLength=300; no.rows=3; no.placeholder=d.kind==="frayere"?"Espèce, période (ex. brochet, herbiers inondés en mars)":d.kind==="nuit"?"Postes, dates, conditions (ex. postes 3 à 8, de juin à octobre)":d.kind==="mise_eau"?"Accès, pente, gratuit ou payant…":"Précisions";
  const ok=el("button","btn primary small","Enregistrer"); ok.type="submit";
  f.append(el("b",null,ic+" "+lab),ni,no,ok);
  f.addEventListener("submit",async e=>{
    e.preventDefault(); ok.disabled=true;
    const {error}=await A.sb.from("map_zones").insert({group_id:A.cur,user_id:A.me.id,kind:d.kind,name:ni.value.trim()||null,note:no.value.trim()||null,geom:{type:d.shape,coords:d.pts.map(p=>[+p[0].toFixed(6),+p[1].toFixed(6)])}});
    ok.disabled=false;
    if(error) return toast(frError(error));
    map.closePopup(); zones.draw=null; drawDraft(); toast("Zone ajoutée pour le groupe"); await loadZones(); bar();
  });
  const last=d.pts[d.pts.length-1];
  L.popup().setLatLng(last).setContent(f).openOn(map);
  setTimeout(()=>ni.focus(),100);
}

/* ---------- AAPPMA la plus proche (OpenStreetMap) + fédération du département ---------- */
const aap={box:null,key:null,busy:false};
function aappmaCard(){
  if(!aap.box){ aap.box=el("div","panel aappma"); aap.box.append(el("h3",null,"🏛️ AAPPMA la plus proche"),el("p","note","Ouvre la carte pour chercher l'association de pêche du secteur.")); }
  return aap.box;
}
async function loadAappma(){
  if(!map||aap.busy) return;
  const c=map.getCenter(), lat=c.lat, lon=c.lng;
  const key=lat.toFixed(2)+","+lon.toFixed(2);
  if(key===aap.key) return;
  if(map.getZoom()<8){ const b=aappmaCard(); b.innerHTML=""; b.append(el("h3",null,"🏛️ AAPPMA la plus proche"),el("p","note","Zoome sur ton secteur pour trouver l'AAPPMA la plus proche.")); return; }
  aap.key=key; aap.busy=true;
  const box=aappmaCard();
  try{
    const q='[out:json][timeout:20];(nwr["name"~"AAPPMA|A\\.A\\.P\\.P\\.M\\.A|Association agréée.*pêche",i](around:40000,'+lat.toFixed(4)+','+lon.toFixed(4)+');nwr["club"="fishing"]["name"](around:40000,'+lat.toFixed(4)+','+lon.toFixed(4)+'););out center tags 40;';
    const [osm,geo]=await Promise.all([
      fetch("https://overpass-api.de/api/interpreter",{method:"POST",body:"data="+encodeURIComponent(q),headers:{"Content-Type":"application/x-www-form-urlencoded"}}).then(r=>r.ok?r.json():null).catch(()=>null),
      fetch("https://geo.api.gouv.fr/communes?lat="+lat.toFixed(5)+"&lon="+lon.toFixed(5)+"&fields=nom,codeDepartement,departement&format=json").then(r=>r.ok?r.json():null).catch(()=>null),
    ]);
    if(key!==aap.key) return;
    const list=(osm?.elements||[]).map(x=>{ const la=x.lat??x.center?.lat, lo=x.lon??x.center?.lon; return la==null?null:{t:x.tags||{},la,lo,d:hav([lat,lon],[la,lo])}; }).filter(Boolean).sort((a,b)=>a.d-b.d);
    const commune=geo?.[0];
    box.innerHTML="";
    box.append(el("h3",null,"🏛️ AAPPMA la plus proche"));
    const best=list.find(x=>/aappma|a\.a\.p\.p\.m\.a|agr[ée]{2}/i.test(x.t.name||""))||list[0];
    if(best){
      const t=best.t;
      box.append(el("b",null,t.name));
      const addr=[[t["addr:housenumber"],t["addr:street"]].filter(Boolean).join(" "),[t["addr:postcode"],t["addr:city"]].filter(Boolean).join(" ")].filter(Boolean).join(", ");
      box.append(el("div","note","à "+fmtDist(best.d)+" du centre de la carte"+(addr?" · "+addr:"")));
      const a=el("div","actions");
      const go=el("a","btn small","🧭 Itinéraire"); go.href="https://www.google.com/maps/dir/?api=1&destination="+best.la+","+best.lo; go.target="_blank"; go.rel="noopener"; a.append(go);
      const tel=t.phone||t["contact:phone"]; if(tel){ const x=el("a","btn small","📞 Appeler"); x.href="tel:"+tel.replace(/\s/g,""); a.append(x); }
      const web=t.website||t["contact:website"]; if(web){ const x=el("a","btn small","🌐 Site"); x.href=/^https?:/.test(web)?web:"https://"+web; x.target="_blank"; x.rel="noopener"; a.append(x); }
      const mail=t.email||t["contact:email"]; if(mail){ const x=el("a","btn small","✉️ Écrire"); x.href="mailto:"+mail; a.append(x); }
      a.append(btn("📍 Voir","btn small",()=>{ map.setView([best.la,best.lo],15); }));
      box.append(a);
      if(list.length>1) box.append(el("p","note","Autres associations à proximité : "+list.filter(x=>x!==best).slice(0,3).map(x=>x.t.name+" ("+fmtDist(x.d)+")").join(", ")));
    }else box.append(el("p","note","Aucune AAPPMA n'est encore référencée sur OpenStreetMap dans un rayon de 40 km."));
    if(commune){
      const s=el("p","note");
      const look=el("a",null,"chercher les AAPPMA près de "+commune.nom); look.href="https://www.google.com/search?q="+encodeURIComponent("AAPPMA "+commune.nom+" "+(commune.departement?.nom||"")); look.target="_blank"; look.rel="noopener";
      s.append("Secteur : "+commune.nom+" ("+(commune.departement?.nom||commune.codeDepartement)+"). Les AAPPMA dépendent de la fédération de pêche du département : ",look,".");
      box.append(s);
    }
    box.append(el("p","note","Source : OpenStreetMap, la liste peut être incomplète. Carte de pêche : cartedepeche.fr, en choisissant l'AAPPMA du secteur."));
  }catch(e){ aap.key=null; }
  finally{ aap.busy=false; }
}

/* ---------- Mètre : tracer un trait et lire la distance ---------- */
const ruler={on:false,pts:[],layer:null};
const WRAP=3.66; // un tour de bâton à spod (12 pieds)
function rulerDist(){ let d=0; for(let i=1;i<ruler.pts.length;i++) d+=hav(ruler.pts[i-1],ruler.pts[i]); return d; }
function rulerBar(){
  const w=el("div","ruler-bar"); const d=rulerDist();
  const txt=ruler.pts.length<2?"Touche la carte pour poser les points du trait":fmtDist(d)+(d<=400?" · ≈ "+Math.round(d/WRAP)+" tours de bâton":"");
  w.append(el("b",null,"📏 "+txt));
  const a=el("div","actions");
  if(ruler.pts.length) a.append(btn("↶ Annuler","btn small",()=>{ ruler.pts.pop(); drawRuler(); bar(); }), btn("Effacer","linkbtn danger",()=>{ ruler.pts=[]; drawRuler(); bar(); }));
  w.append(a); return w;
}
function drawRuler(){
  if(!map) return;
  if(!ruler.layer) ruler.layer=L.layerGroup().addTo(map);
  ruler.layer.clearLayers();
  if(ruler.pts.length>1) L.polyline(ruler.pts,{color:"#e7a650",weight:4,dashArray:"8 6"}).addTo(ruler.layer);
  let acc=0;
  ruler.pts.forEach((p,i)=>{
    if(i) acc+=hav(ruler.pts[i-1],p);
    const lab=i?fmtDist(acc):"0";
    L.marker(p,{icon:L.divIcon({className:"",html:'<div class="ruler-pt"><span>'+lab+'</span></div>',iconSize:[14,14],iconAnchor:[7,7]}),interactive:false}).addTo(ruler.layer);
  });
}
function startRuler(){ ruler.on=true; ruler.pts=[]; drawRuler(); bar(); toast("Touche la carte point par point pour tracer ton trait"); }
function stopRuler(){ ruler.on=false; ruler.pts=[]; drawRuler(); bar(); }

/* ---------- Accroches ---------- */
const prevClick=A.hooks.mapClick;
A.hooks.mapClick=ll=>{ if(prevClick?.(ll)) return true;
  if(ruler.on){ ruler.pts.push([ll.lat,ll.lng]); drawRuler(); bar(); return true; }
  if(zones.draw){ const d=zones.draw; d.pts.push([ll.lat,ll.lng]); drawDraft(); if(d.shape==="point") finishZone(); else bar(); return true; }
  if(mode==="fond"){ addDepthAt(ll); return true; } return false; };
const prevReady=A.hooks.mapReady;
function init(m){
  if(map===m) return; map=m;
  if(baseKey!=="plan") setBase(baseKey);
  let wt=null, at=null; map.on("moveend",()=>{ clearTimeout(at); at=setTimeout(loadAappma,900); if(poiOn) poi(); if(wind.on){ clearTimeout(wt); wt=setTimeout(loadWind,700); } });
  if(zones.on) loadZones();
  poi(); bar(); setTimeout(loadAappma,1200); setMode(mode);
  try{ const t=JSON.parse(localStorage.getItem(TKEY)||"null"); if(t&&t.pts&&!track.on){ Object.assign(track,t); startTrack(true); toast("Trace reprise"); } }catch(e){}
}
A.hooks.mapReady=m=>{ prevReady?.(m); init(m); };
const prevShown=A.hooks.mapShown;
A.hooks.mapShown=m=>{ prevShown?.(m); init(m); bar(); if(mode==="fond") setMode("fond"); };
const prevSpots=A.hooks.spotsLoaded; A.hooks.spotsLoaded=()=>{ prevSpots?.(); bar(); };
const prevChange=A.hooks.change;
let lastCur;
A.hooks.change=()=>{ prevChange?.(); if(A.cur!==lastCur){ lastCur=A.cur; myTracks=null; if(zones.on&&map) loadZones(); if(mode==="fond"&&map) setMode("fond"); } bar(); };
window.CDJ_MAPMODE=mode;
// panneau « Calques »
(function(){
  const pb=$("#layers-btn"), pn=$("#layers-panel");
  if(!pb||!pn) return;
  const setP=v=>{ pn.hidden=!v; pb.setAttribute("aria-expanded",String(v)); pb.classList.toggle("on",v); };
  pb.addEventListener("click",()=>setP(pn.hidden));
  $("#layers-close")?.addEventListener("click",()=>setP(false));
})();
A.track={start:o=>{ startTrack(false,o); }, stop:()=>stopTrack(), get on(){ return track.on; }};
A.zones={get list(){ return zones.list; }, kinds:ZK, draw:k=>{
  if(!map) return toast("Ouvre la carte d'abord");
  if(typeof A.cur!=="number") return toast("Choisis un groupe précis pour ajouter une zone");
  if(!zones.on){ zones.on=true; set("cdj-zones","1"); loadZones(); }
  zones.draw={kind:k,shape:"polygon",pts:[]}; drawDraft(); bar();
  toast("Touche la carte pour poser les coins de la zone, puis « Terminer »"); }};
if(A.map) init(A.map);
document.querySelectorAll("#carte-sub [data-s]").forEach(b=>b.setAttribute("aria-selected",String(b.dataset.s===mode)));
bar();
})();
