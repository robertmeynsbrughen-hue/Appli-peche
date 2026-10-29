// Coup du Jour : carte de chaleur des prises et partage de position en direct.
(function(){
"use strict";
const A=window.CDJ; if(!A) return;
const {el,toast,frError}=A;
const $=s=>document.querySelector(s);
function btn(label,cls,fn){ const b=el("button",cls||"btn",label); b.type="button"; if(fn) b.addEventListener("click",fn); return b; }
const HEAT_JS="https://unpkg.com/leaflet.heat@0.2.0/dist/leaflet-heat.js";
const SEASONS={all:"Toute l'année",printemps:"Printemps",ete:"Été",automne:"Automne",hiver:"Hiver"};
const seasonOf=d=>{ const m=new Date(d).getMonth(); return m<=1||m===11?"hiver":m<=4?"printemps":m<=7?"ete":"automne"; };
const ago=d=>{ const s=Math.round((Date.now()-new Date(d))/1000); return s<60?"à l'instant":s<3600?"il y a "+Math.round(s/60)+" min":"il y a "+Math.round(s/3600)+" h"; };

/* ---------- Barre d'outils ---------- */
let heat={on:false,layer:null,sp:"",season:"all",data:null};
let live={on:false,watch:null,last:null,lastSent:0,until:null,poll:null,timer:null};
function bar(){
  const box=$("#map-tools"); if(!box) return;
  box.hidden=!(A.me&&A.groups.length);
  box.innerHTML="";
  const row=el("div","map-row");
  const hb=btn(heat.on?"🔥 Zones de prises ✓":"🔥 Zones de prises","btn small"+(heat.on?" on":""),()=>{ heat.on=!heat.on; bar(); drawHeat(); });
  const lb=btn(live.on?"📡 Position partagée":"📡 Partager ma position","btn small"+(live.on?" live":""),()=>live.on?stopLive(true):startLive());
  row.append(hb,lb); box.append(row);
  if(heat.on){
    const f=el("div","map-row");
    const ss=el("select"); ss.setAttribute("aria-label","Espèce"); ss.append(new Option("Toutes les espèces",""));
    (A.dex?.DEX||[]).forEach(d=>ss.append(new Option(d.name,d.name))); ss.value=heat.sp;
    ss.addEventListener("change",()=>{ heat.sp=ss.value; drawHeat(); });
    const se=el("select"); se.setAttribute("aria-label","Saison"); Object.entries(SEASONS).forEach(([k,v])=>se.append(new Option(v,k))); se.value=heat.season;
    se.addEventListener("change",()=>{ heat.season=se.value; drawHeat(); });
    f.append(ss,se); box.append(f);
    const n=el("p","note heat-note"); n.id="heat-note"; box.append(n);
  }
  if(live.on){
    const t=el("p","note live-note"); t.textContent="Visible par ton groupe jusqu'à "+new Date(live.until).toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"})+". L'appli doit rester ouverte pour mettre ta position à jour.";
    t.append(" "); t.append(btn("Arrêter","linkbtn danger",()=>stopLive(true))); box.append(t);
  }
}

/* ---------- Carte de chaleur ---------- */
let heatLib=null;
function loadHeat(){
  if(window.L?.heatLayer) return Promise.resolve();
  if(heatLib) return heatLib;
  heatLib=new Promise((res,rej)=>{ const s=document.createElement("script"); s.src=HEAT_JS; s.onload=res; s.onerror=()=>{ heatLib=null; rej(new Error("heat")); }; document.head.append(s); });
  return heatLib;
}
async function fetchHeat(){
  const gid=A.cur;
  let qp=A.sb.from("posts").select("spot_id,species,created_at").eq("status","published").not("spot_id","is",null).limit(5000);
  let qc=A.sb.from("carp_sessions").select("spot_id,carp_events(kind,at)").not("spot_id","is",null).limit(2000);
  if(gid!=="all"){ qp=qp.eq("group_id",gid); qc=qc.eq("group_id",gid); }
  const [{data:p},{data:c}]=await Promise.all([qp,qc]);
  const rows=[...(p||[])];
  (c||[]).forEach(s=>(s.carp_events||[]).filter(e=>e.kind==="prise").forEach(e=>rows.push({spot_id:s.spot_id,species:"Carpe",created_at:e.at})));
  return rows;
}
async function drawHeat(){
  const map=A.map;
  if(heat.layer&&map){ map.removeLayer(heat.layer); heat.layer=null; }
  if(!heat.on||!map) return;
  try{ await loadHeat(); }catch(e){ heat.on=false; bar(); return toast("Carte de chaleur indisponible (pas de réseau ?)"); }
  if(!heat.data) heat.data=await fetchHeat();
  const norm=s=>String(s||"").normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase();
  const rows=heat.data.filter(r=>(!heat.sp||norm(r.species)===norm(heat.sp))&&(heat.season==="all"||seasonOf(r.created_at)===heat.season));
  const by=new Map(); rows.forEach(r=>by.set(r.spot_id,(by.get(r.spot_id)||0)+1));
  const pts=[]; let max=1;
  by.forEach((n,id)=>{ const s=A.spots.find(x=>x.id===id); if(s){ pts.push([s.lat,s.lon,n]); max=Math.max(max,n); } });
  const note=$("#heat-note");
  if(note) note.textContent=pts.length?rows.length+" prise"+(rows.length>1?"s":"")+" sur "+pts.length+" spot"+(pts.length>1?"s":"")+". Plus c'est rouge, plus ça mord.":"Aucune prise liée à un spot pour ce filtre. Choisis un spot quand tu publies une prise pour alimenter la carte.";
  if(!pts.length||!A.map) return;
  heat.layer=L.heatLayer(pts,{radius:38,blur:28,maxZoom:15,max,minOpacity:.35,gradient:{.2:"#2c8b73",.5:"#e7c650",.8:"#e98a2c",1:"#d93a2b"}}).addTo(A.map);
  if(pts.length) A.map.fitBounds(L.latLngBounds(pts.map(p=>[p[0],p[1]])).pad(.3),{maxZoom:14});
}

/* ---------- Position en direct ---------- */
const LIVE_KEY="cdj-live-until";
function dist(a,b){ const R=6371e3, r=Math.PI/180, dLa=(b.lat-a.lat)*r, dLo=(b.lon-a.lon)*r; const h=Math.sin(dLa/2)**2+Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin(dLo/2)**2; return 2*R*Math.asin(Math.sqrt(h)); }
async function push(pos){
  const gid=typeof A.cur==="number"?A.cur:null; if(!gid||!A.me) return;
  const p={lat:+pos.coords.latitude.toFixed(5),lon:+pos.coords.longitude.toFixed(5)};
  const now=Date.now();
  if(live.last&&now-live.lastSent<20000&&dist(live.last,p)<25) return;
  live.last=p; live.lastSent=now;
  const {error}=await A.sb.from("live_positions").upsert({user_id:A.me.id,group_id:gid,lat:p.lat,lon:p.lon,accuracy:Math.round(pos.coords.accuracy||0),updated_at:new Date().toISOString(),expires_at:new Date(live.until).toISOString()},{onConflict:"user_id"});
  if(error&&!A.offline?.isNetErr(error)) toast(frError(error));
}
function startLive(resume){
  if(!("geolocation" in navigator)) return toast("Localisation indisponible sur ce téléphone");
  if(typeof A.cur!=="number") return toast("Choisis un groupe précis pour partager ta position");
  live.until=resume||Date.now()+2*36e5;
  try{ localStorage.setItem(LIVE_KEY,String(live.until)); }catch(e){}
  live.on=true; live.last=null; live.lastSent=0;
  live.watch=navigator.geolocation.watchPosition(push,err=>{ if(err.code===1){ toast("Autorise la localisation pour partager ta position"); stopLive(false); } },{enableHighAccuracy:true,maximumAge:15000,timeout:30000});
  clearTimeout(live.timer); live.timer=setTimeout(()=>stopLive(true),Math.max(0,live.until-Date.now()));
  if(!resume) toast("Position partagée avec le groupe pendant 2 h");
  bar(); refreshOthers();
}
async function stopLive(remove){
  if(live.watch!=null) navigator.geolocation.clearWatch(live.watch);
  live.watch=null; live.on=false; clearTimeout(live.timer);
  try{ localStorage.removeItem(LIVE_KEY); }catch(e){}
  if(remove&&A.me) await A.sb.from("live_positions").delete().eq("user_id",A.me.id);
  bar();
}
let othersLayer=null;
function personIcon(name,me){ return L.divIcon({className:"",html:'<div class="live-pin'+(me?" me":"")+'"><span>'+(name||"?").charAt(0).toUpperCase()+'</span></div>',iconSize:[34,34],iconAnchor:[17,17],popupAnchor:[0,-16]}); }
async function refreshOthers(){
  const map=A.map; if(!map||!A.me) return;
  if(!othersLayer) othersLayer=L.layerGroup().addTo(map);
  let q=A.sb.from("live_positions").select("user_id,group_id,lat,lon,accuracy,updated_at,profiles(username)");
  if(A.cur!=="all") q=q.eq("group_id",A.cur);
  const {data}=await q;
  othersLayer.clearLayers();
  (data||[]).forEach(p=>{
    const me=p.user_id===A.me.id;
    const m=L.marker([p.lat,p.lon],{icon:personIcon(p.profiles?.username,me),zIndexOffset:1000});
    const b=el("div"); b.append(el("b",null,"📡 @"+(p.profiles?.username||"?")+(me?" (toi)":"")));
    b.append(el("div",null,ago(p.updated_at)+(p.accuracy?" · à "+p.accuracy+" m près":"")));
    const go=el("a",null,"Itinéraire"); go.href="https://www.google.com/maps/dir/?api=1&destination="+p.lat+","+p.lon; go.target="_blank"; go.rel="noopener"; b.append(go);
    m.bindPopup(b); m.addTo(othersLayer);
  });
}

/* ---------- Accroches ---------- */
const prevReady=A.hooks.mapReady;
A.hooks.mapReady=m=>{ prevReady?.(m); bar(); };
const prevShown=A.hooks.mapShown;
A.hooks.mapShown=m=>{
  prevShown?.(m); bar(); refreshOthers(); if(heat.on) drawHeat();
  clearInterval(live.poll); live.poll=setInterval(()=>{ if(!$("#v-carte").hidden) refreshOthers(); else clearInterval(live.poll); },30000);
};
const prevChange=A.hooks.change;
let lastCur;
A.hooks.change=()=>{
  prevChange?.();
  if(!A.me){ if(live.on) stopLive(false); bar(); return; }
  if(A.cur!==lastCur){ lastCur=A.cur; heat.data=null; if(live.on&&typeof A.cur==="number") live.last=null; if(A.map){ drawHeat(); refreshOthers(); } }
  bar();
};
// reprise du partage après un rechargement de l'appli
try{ const u=Number(localStorage.getItem(LIVE_KEY)); if(u>Date.now()) setTimeout(()=>{ if(A.me) startLive(u); },1500); }catch(e){}
bar();
})();
