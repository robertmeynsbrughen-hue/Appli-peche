// Rivio : fiche d'une prise en grand (photos, conditions du moment, spot sur une mini-carte).
(function(){
"use strict";
const A=window.CDJ; if(!A) return;
const {el,toast,frError,userLabel}=A;
function btn(label,cls,fn){ const b=el("button",cls||"btn",label); b.type="button"; if(fn) b.addEventListener("click",fn); return b; }
const num=x=>String(x).replace(".",",");
const PHASE={aube:"à l'aube",jour:"en journée",crep:"au crépuscule",nuit:"de nuit"};
const SKY=c=>c.rain>=0.3?"🌧️ pluie":c.cloud>=65?"☁️ couvert":c.cloud>=35?"⛅ voilé":"☀️ ensoleillé";

async function open(id){
  const {data:p,error}=await A.sb.from("posts").select("id,group_id,user_id,species,length_cm,weight_kg,bait,caption,created_at,photo_path,photo_paths,conditions,spots(id,name,lat,lon,depth_m,bottom),profiles(username,is_admin)").eq("id",id).maybeSingle();
  if(error||!p) return toast(error?frError(error):"Prise introuvable");
  const paths=(p.photo_paths&&p.photo_paths.length)?p.photo_paths:(p.photo_path?[p.photo_path]:[]);
  let urls={};
  if(paths.length){ const {data:s}=await A.sb.storage.from("photos").createSignedUrls(paths,3600); (s||[]).forEach(x=>urls[x.path]=x.signedUrl); }
  document.querySelector(".ps-back")?.remove();
  const back=el("div","sheet-back ps-back"); const sh=el("div","sheet ps-sheet"); sh.setAttribute("role","dialog"); sh.setAttribute("aria-modal","true"); sh.setAttribute("aria-label","Fiche de la prise");
  const close=()=>{ back.remove(); document.removeEventListener("keydown",key); };
  const key=e=>{ if(e.key==="Escape") close(); };
  document.addEventListener("keydown",key);
  const x=btn("✕","icon-btn ps-close",close); x.setAttribute("aria-label","Fermer");
  sh.append(x);
  // photos
  if(paths.length){
    const g=el("div","ps-photos"); const tr=el("div","ps-track");
    paths.forEach((pa,i)=>{ if(!urls[pa]) return; const im=el("img"); im.src=urls[pa]; im.alt=(p.species||"Prise")+" ("+(i+1)+"/"+paths.length+")"; tr.append(im); });
    g.append(tr);
    if(paths.length>1){ const c=el("span","gallery-count","1/"+paths.length); tr.addEventListener("scroll",()=>{ c.textContent=(Math.round(tr.scrollLeft/tr.clientWidth)+1)+"/"+paths.length; },{passive:true}); g.append(c); }
    sh.append(g);
  }
  const body=el("div","ps-body");
  const top=el("div","ps-top");
  top.append(el("h2",null,p.species||"Prise"));
  const sz=[p.length_cm?num(p.length_cm)+" cm":"",p.weight_kg?num(p.weight_kg)+" kg":""].filter(Boolean).join(" · ");
  if(sz) top.append(el("span","ps-size",sz));
  body.append(top);
  const by=el("div","ps-by"); by.append(userLabel(p.profiles?.username,p.profiles?.is_admin,A.roleOf(p.group_id,p.user_id))," · "+new Date(p.created_at).toLocaleString("fr-FR",{weekday:"long",day:"numeric",month:"long",hour:"2-digit",minute:"2-digit"}));
  body.append(by);
  if(p.caption) body.append(el("p","ps-cap",p.caption));
  if(p.bait){ const b=el("div","bait-box"); b.append(el("div","label","Appât et amorçage"),el("p",null,p.bait)); body.append(b); }
  // conditions du moment
  const c=p.conditions;
  const sec=el("div","ps-sec"); sec.append(el("h3",null,"Conditions au moment de la prise"));
  if(c&&typeof c==="object"){
    const g=el("div","ps-cond");
    const cell=(k,v)=>{ const d=el("div","psc"); d.append(el("span",null,k),el("b",null,v)); g.append(d); };
    if(c.water!=null) cell("Eau",num(c.water)+" °C"+(c.water_measured?" (mesurée)":""));
    if(c.air!=null) cell("Air",c.air+" °C");
    if(c.dp!=null) cell("Pression",c.dp<=-3?"forte baisse ↓↓":c.dp<=-1?"en baisse ↓":c.dp>=3?"forte hausse ↑↑":c.dp>=1?"en hausse ↑":"stable →");
    if(c.wind!=null) cell("Vent",c.wind+" km/h");
    if(c.cloud!=null) cell("Ciel",SKY(c));
    if(c.phase) cell("Moment",PHASE[c.phase]||c.phase);
    if(c.flow) cell("Débit",{basse:"basses eaux",normale:"normal",haute:"eau haute",crue:"crue"}[c.flow]||c.flow);
    if(c.water_type) cell("Eau",{etang:"étang / lac",riviere:"rivière",canal:"canal"}[c.water_type]||c.water_type);
    sec.append(g);
  }else sec.append(el("p","note","Pas de conditions enregistrées pour cette prise (publiée sans la météo du moment)."));
  body.append(sec);
  // spot sur une mini-carte
  const s=p.spots;
  if(s&&s.lat!=null){
    const ms=el("div","ps-sec"); ms.append(el("h3",null,"📍 "+s.name));
    const info=[s.depth_m?num(s.depth_m)+" m de fond":null,s.bottom||null].filter(Boolean).join(" · "); if(info) ms.append(el("p","note",info));
    const mm=el("div","ps-map"); ms.append(mm);
    const a=el("div","actions");
    a.append(btn("Voir sur la carte","btn small",()=>{ close(); location.hash="#carte"; setTimeout(()=>A.focusSpot?.(s.id),300); }));
    const it=el("a","btn small","🧭 Itinéraire"); it.href="https://www.google.com/maps/dir/?api=1&destination="+s.lat+","+s.lon; it.target="_blank"; it.rel="noopener"; a.append(it);
    ms.append(a); body.append(ms);
    setTimeout(()=>{ try{
      if(typeof L==="undefined") return;
      const m=L.map(mm,{zoomControl:false,attributionControl:false,dragging:false,scrollWheelZoom:false,doubleClickZoom:false,boxZoom:false,keyboard:false,tap:false,touchZoom:false}).setView([s.lat,s.lon],14);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19}).addTo(m);
      L.marker([s.lat,s.lon],{icon:L.divIcon({className:"",html:'<div class="spot-pin"></div>',iconSize:[22,22],iconAnchor:[11,22]})}).addTo(m);
      setTimeout(()=>m.invalidateSize?.(),120);
    }catch(e){} },60);
  }
  sh.append(body);
  back.append(sh); back.addEventListener("click",e=>{ if(e.target===back) close(); }); document.body.append(back);
}
A.openPost=open;
// bouton « Fiche » sur chaque prise du fil
const prevFX=A.hooks.feedExtras;
A.hooks.feedExtras=list=>{
  prevFX?.(list);
  list.forEach(({post,foot})=>{
    if(!foot.isConnected||foot.querySelector(".ps-open")) return;
    const art=foot.closest("article"); if(art) art.dataset.post=post.id;
    const b=btn("🔎 Fiche","linkbtn ps-open",()=>open(post.id)); b.title="Voir la fiche complète de la prise";
    (foot.querySelector(".actions")||foot).prepend(b);
  });
};
// le fil a pu s'afficher avant le chargement de ce module
if(document.querySelector("#feed article.post")) A.loadFeed();
})();
