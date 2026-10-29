// Coup du Jour : « Je pars pêcher » (préparation en un geste, prévenir le groupe), potes au bord de l'eau,
// signalement discret aux potes proches quand on trace ou partage sa position.
(function(){
"use strict";
const A=window.CDJ; if(!A) return;
const {el,toast,frError}=A;
const $=s=>document.querySelector(s);
function btn(label,cls,fn){ const b=el("button",cls||"btn",label); b.type="button"; if(fn) b.addEventListener("click",fn); return b; }
const hhmm=t=>new Date(t).toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"}).replace(":","h");
function km(a,b,c,d){ const r=Math.PI/180, x=Math.sin((c-a)*r/2)**2+Math.cos(a*r)*Math.cos(c*r)*Math.sin((d-b)*r/2)**2; return 12742*Math.asin(Math.sqrt(x)); }
const fmtKm=d=>d<1?Math.round(d*1000)+" m":d.toFixed(d<10?1:0).replace(".",",")+" km";
const getPos=(ms=12000)=>new Promise(res=>{ if(!navigator.geolocation) return res(null);
  navigator.geolocation.getCurrentPosition(p=>res({lat:+p.coords.latitude.toFixed(5),lon:+p.coords.longitude.toFixed(5)}),()=>res(window.CDJ_POS?{lat:window.CDJ_POS.lat,lon:window.CDJ_POS.lon}:null),{enableHighAccuracy:true,timeout:ms,maximumAge:120000}); });

let mine=null, others=[], layer=null;

/* ---------- Données ---------- */
async function load(){
  if(!A.me){ mine=null; others=[]; return; }
  const now=new Date().toISOString();
  let q=A.sb.from("checkins").select("id,group_id,user_id,kind,announce,spot_id,place,lat,lon,note,started_at,ends_at,ended_at,profiles(username)").is("ended_at",null).gt("ends_at",now).order("started_at",{ascending:false}).limit(50);
  const {data,error}=await q;
  if(error){ mine=null; others=[]; return; }
  const rows=data||[];
  mine=rows.find(r=>r.user_id===A.me.id&&r.kind==="session")||null;
  others=rows.filter(r=>r.user_id!==A.me.id&&r.announce&&(A.cur==="all"||r.group_id===A.cur));
}
async function endMine(silent){
  if(!A.me) return;
  await A.sb.from("checkins").update({ended_at:new Date().toISOString()}).eq("user_id",A.me.id).is("ended_at",null);
  mine=null; if(!silent) toast("Bon retour ! Ta sortie est terminée"); render();
}
// signalement discret (trace ou position partagée) : seuls les potes proches sont prévenus, sans dévoiler l'endroit
async function quiet(kind,p){
  if(!A.me||!p) return;
  try{ if(localStorage.getItem("cdj-nearby-share")==="0") return; }catch(e){}
  if(mine) return; // déjà annoncé au groupe
  await A.sb.from("checkins").insert({user_id:A.me.id,group_id:typeof A.cur==="number"?A.cur:null,kind,announce:false,lat:+Number(p.lat).toFixed(4),lon:+Number(p.lon).toFixed(4),ends_at:new Date(Date.now()+4*36e5).toISOString()});
}

/* ---------- Bandeaux : moi au bord de l'eau, potes au bord de l'eau ---------- */
function slots(){
  const mk=(id,before)=>{ let s=document.getElementById(id); if(!s&&before){ s=el("div","gofish-slot"); s.id=id; before.before(s); } return s; };
  return [mk("gofish-conseils",$("#permit-quick")||$("#regl")),mk("gofish-fil",$("#post-mode")),mk("gofish-carte",$("#map-below"))].filter(Boolean);
}
function render(){
  const list=slots();
  const ok=A.me&&A.groups.length;
  list.forEach(s=>{
    s.innerHTML=""; s.hidden=!ok; if(!ok) return;
    if(mine){
      const b=el("div","gofish-me");
      const sp=A.spots.find(x=>x.id===mine.spot_id);
      b.append(el("div",null,"🎣 Tu es au bord de l'eau"+(sp?" · "+sp.name:mine.place?" · "+mine.place:"")+" depuis "+hhmm(mine.started_at)));
      const a=el("div","actions");
      a.append(btn("🏠 Je rentre","btn small",async()=>{ if(A.track?.on){ await A.track.stop(); } else await endMine(); }));
      b.append(a); s.append(b);
    }else if(s.id!=="gofish-carte"){
      const go=btn("🎣 Je pars pêcher","btn primary gofish-btn",open);
      s.append(go);
    }
    if(others.length){
      const w=el("div","gofish-others");
      others.slice(0,4).forEach(o=>{
        const r=el("div","gofish-o");
        const sp=A.spots.find(x=>x.id===o.spot_id);
        const l=el("div");
        const nb=el("b",null); const un=el("span","user-link","@"+(o.profiles?.username||"?")); if(o.profiles?.username) un.dataset.user=o.profiles.username; nb.append(un," pêche"+(sp?" à "+sp.name:o.place?" · "+o.place:"")); l.append(nb);
        const d=window.CDJ_POS?km(window.CDJ_POS.lat,window.CDJ_POS.lon,Number(o.lat),Number(o.lon)):null;
        l.append(el("div","note","depuis "+hhmm(o.started_at)+" · jusqu'à "+hhmm(o.ends_at)+(d!=null?" · à "+fmtKm(d)+" de toi":"")+(o.note?" · "+o.note:"")));
        const a=el("div","actions");
        a.append(btn("🚗 J'arrive","btn small",()=>join(o)));
        const it=el("a","btn small","🧭 Y aller"); it.href="https://www.google.com/maps/dir/?api=1&destination="+o.lat+","+o.lon; it.target="_blank"; it.rel="noopener"; a.append(it);
        a.append(btn("📍","btn small",()=>{ location.hash="#carte"; setTimeout(()=>A.map?.setView([Number(o.lat),Number(o.lon)],15),300); }));
        r.append(l,a); w.append(r);
      });
      s.append(w);
    }
  });
  drawMap();
}
async function join(o){
  const sp=A.spots.find(x=>x.id===o.spot_id);
  const {error}=await A.sb.from("messages").insert({group_id:o.group_id,user_id:A.me.id,body:"🚗 J'arrive @"+(o.profiles?.username||"")+(sp?" à "+sp.name:"")+" ! 🎣"});
  if(error) return toast(frError(error));
  toast("Message envoyé dans le chat du groupe");
}
function drawMap(){
  const map=A.map; if(!map||typeof L==="undefined") return;
  if(!layer) layer=L.layerGroup().addTo(map);
  layer.clearLayers();
  others.forEach(o=>{
    const n=(o.profiles?.username||"?");
    L.marker([Number(o.lat),Number(o.lon)],{icon:L.divIcon({className:"",html:'<div class="fish-pin"><span>🎣</span><b>'+n.replace(/[<>&"]/g,"")+'</b></div>',iconSize:[40,40],iconAnchor:[20,20],popupAnchor:[0,-16]})})
      .bindPopup("@"+n+" pêche ici depuis "+hhmm(o.started_at)).addTo(layer);
  });
}

/* ---------- Feuille « Je pars pêcher » ---------- */
async function open(){
  if(typeof A.cur!=="number"&&A.groups.length>1){ toast("Choisis d'abord le groupe à prévenir, en haut de l'écran"); }
  const gid=typeof A.cur==="number"?A.cur:A.groups[0]?.id;
  const back=el("div","sheet-back"); const sh=el("div","sheet gofish-sheet"); sh.setAttribute("role","dialog"); sh.setAttribute("aria-modal","true"); sh.setAttribute("aria-label","Je pars pêcher");
  const close=()=>back.remove();
  const head=el("div","sheet-head"); head.append(el("h2",null,"🎣 Je pars pêcher")); const x=btn("✕","icon-btn",close); x.setAttribute("aria-label","Fermer"); head.append(x); sh.append(head);
  back.append(sh); back.addEventListener("click",e=>{ if(e.target===back) close(); }); document.body.append(back);

  const f=el("form","gofish-form");
  const sl=el("label","field","Où ?"); const ss=el("select"); ss.append(new Option("📍 Ma position actuelle","")); sl.append(ss);
  const spots=A.spots.filter(s=>s.group_id===gid);
  spots.forEach(s=>ss.append(new Option(s.name,s.id)));
  const dl=el("label","field","Jusqu'à quand ?"); const ds=el("select");
  [[2,"2 heures"],[4,"4 heures"],[6,"6 heures"],[12,"Toute la nuit (12 h)"],[24,"24 heures"],[48,"48 heures"]].forEach(([h,t])=>ds.append(new Option(t,h))); ds.value="4"; dl.append(ds);
  const nl=el("label","field","Un mot pour les potes (facultatif)"); const ni=el("input"); ni.maxLength=140; ni.placeholder="Ex. : float-tube côté roseaux, venez !"; nl.append(ni);
  const sw=(label,on)=>{ const l=el("label","check"); const c=el("input"); c.type="checkbox"; c.checked=on; l.append(c," "+label); return [l,c]; };
  const [tl,tc]=sw("🛶 Lancer la trace GPS (parcours et touches)",true);
  const [al,ac]=sw("📣 Prévenir le groupe « "+(A.groups.find(g=>g.id===gid)?.name||"")+" »",true);
  f.append(sl,dl,nl,tl,al);
  sh.append(f);

  // check-list
  const ck=el("div","gofish-check"); ck.append(el("h3",null,"Avant de partir")); sh.append(ck);
  const line=(ic,txt,cls,action)=>{ const r=el("div","ck-row"+(cls?" "+cls:"")); r.append(el("span","ck-i",ic),el("span","ck-t",txt)); if(action) r.append(action); ck.append(r); return r; };
  const wait=line("⏳","Vérification en cours…");
  const go=el("button","btn primary gofish-go","C'est parti !"); go.type="button"; sh.append(go);

  const pos=await getPos();
  if(pos&&spots.length){
    const sorted=spots.map(s=>({s,d:km(pos.lat,pos.lon,s.lat,s.lon)})).sort((a,b)=>a.d-b.d);
    ss.innerHTML=""; ss.append(new Option("📍 Ma position actuelle",""));
    sorted.forEach(({s,d})=>ss.append(new Option(s.name+" ("+fmtKm(d)+")",s.id)));
    if(sorted[0].d<=0.5) ss.value=String(sorted[0].s.id);
  }
  const target=()=>{ const s=spots.find(x=>String(x.id)===ss.value); return s?{lat:s.lat,lon:s.lon,name:s.name,spot:s}:pos?{lat:pos.lat,lon:pos.lon,name:"Ma position"}:null; };
  async function checks(){
    [...ck.querySelectorAll(".ck-row")].forEach(r=>r.remove());
    const t=target();
    // conditions
    if(t&&window.CDJ_ADVICE){
      const r=line("🌤️","Conditions : chargement…");
      try{ await window.CDJ_ADVICE.loadAt(t.lat,t.lon,t.name); const s=window.CDJ_ADVICE.snapshot?.();
        r.querySelector(".ck-t").textContent=s?"Eau "+String(s.water).replace(".",",")+" °C"+(s.water_measured?" (mesurée)":"")+" · air "+s.air+" °C · vent "+s.wind+" km/h · pression "+(s.dp<=-1?"en baisse ↓":s.dp>=1?"en hausse ↑":"stable"):"Conditions chargées";
        r.append(btn("Détails","linkbtn",()=>{ close(); location.hash="#conseils"; }));
      }catch(e){ r.querySelector(".ck-t").textContent="Météo indisponible pour le moment"; }
    }else line("🌤️","Active la localisation ou choisis un spot pour voir les conditions","warn");
    // carte de pêche
    try{
      const {data}=await A.sb.from("profiles").select("permit_end").eq("id",A.me.id).maybeSingle();
      const end=data?.permit_end;
      if(!end) line("🎫","Date de fin de carte de pêche non renseignée","soft",btn("Renseigner","linkbtn",()=>{ close(); location.hash="#profil"; setTimeout(()=>document.querySelector('#profil-sub [data-s="reglages"]')?.click(),300); }));
      else{ const d=new Date(end+"T23:59:59"); const ok=d>=new Date(); line("🎫",ok?"Carte de pêche valable jusqu'au "+d.toLocaleDateString("fr-FR",{day:"numeric",month:"long"}):"Carte de pêche expirée depuis le "+d.toLocaleDateString("fr-FR",{day:"numeric",month:"long"}),ok?"ok":"bad",A.permit?btn("Montrer","linkbtn",()=>A.permit.show()):null); }
    }catch(e){}
    // stock
    try{ const low=A.stock?await A.stock.low():[]; if(low.length) line("🥣","Stock bas : "+low.map(i=>i.name).join(", "),"warn"); else if(A.stock) line("🥣","Stock d'appâts OK","ok"); }catch(e){}
    // matos
    try{
      const {data}=await A.sb.from("gear_items").select("kit,name,checked").eq("user_id",A.me.id);
      const todo=(data||[]).filter(g=>!g.checked);
      if(!(data||[]).length) line("🎒","Pas encore de liste de matos","soft",btn("Créer","linkbtn",()=>{ close(); location.hash="#profil"; setTimeout(()=>document.querySelector('#profil-sub [data-s="matos"]')?.click(),300); }));
      else if(todo.length) line("🎒",todo.length+" élément"+(todo.length>1?"s":"")+" pas coché"+(todo.length>1?"s":"")+" : "+todo.slice(0,4).map(g=>g.name).join(", ")+(todo.length>4?"…":""),"warn",btn("Ma liste","linkbtn",()=>{ close(); location.hash="#profil"; setTimeout(()=>document.querySelector('#profil-sub [data-s="matos"]')?.click(),300); }));
      else line("🎒","Matos : tout est coché","ok");
    }catch(e){}
    wait.remove();
  }
  ss.addEventListener("change",checks);
  checks();

  go.addEventListener("click",async()=>{
    const t=target(); if(!t) return toast("Active la localisation ou choisis un spot");
    if(!gid) return toast("Rejoins d'abord un groupe");
    go.disabled=true;
    const hours=Number(ds.value);
    const row={group_id:gid,user_id:A.me.id,kind:"session",announce:ac.checked,spot_id:t.spot?.id||null,place:t.spot?null:null,lat:+Number(t.lat).toFixed(5),lon:+Number(t.lon).toFixed(5),note:ni.value.trim()||null,ends_at:new Date(Date.now()+hours*36e5).toISOString()};
    await A.sb.from("checkins").update({ended_at:new Date().toISOString()}).eq("user_id",A.me.id).is("ended_at",null);
    const {data,error}=await A.sb.from("checkins").insert(row).select("id,group_id,user_id,kind,announce,spot_id,place,lat,lon,note,started_at,ends_at,ended_at").single();
    go.disabled=false;
    if(error) return toast(frError(error));
    mine=data; close();
    if(tc.checked&&A.track&&!A.track.on) A.track.start({quiet:true});
    toast(ac.checked?"Le groupe est prévenu, bonne pêche ! 🎣":"Bonne pêche ! 🎣");
    location.hash="#carte";
    if(t.spot) setTimeout(()=>A.map?.setView([t.lat,t.lon],15),400);
    render();
  });
}

/* ---------- Réglages « potes à proximité » ---------- */
async function settings(){
  const box=$("#nearby-panel"); if(!box) return;
  if(!A.me){ box.hidden=true; return; }
  box.hidden=false; box.innerHTML="";
  const {data}=await A.sb.from("profiles").select("nearby_km,nearby_share").eq("id",A.me.id).maybeSingle();
  const kmv=data?.nearby_km??15, share=data?.nearby_share!==false;
  box.append(el("h2",null,"📍 Potes à proximité"));
  const l1=el("label","field","Me prévenir quand un pote pêche à moins de"); const s1=el("select");
  [[0,"Jamais"],[5,"5 km"],[10,"10 km"],[15,"15 km"],[25,"25 km"],[40,"40 km"],[60,"60 km"]].forEach(([v,t])=>s1.append(new Option(t,v))); s1.value=String(kmv); l1.append(s1);
  const l2=el("label","check"); const c2=el("input"); c2.type="checkbox"; c2.checked=share; l2.append(c2," Prévenir mes potes proches quand je lance une trace ou partage ma position");
  box.append(l1,l2,el("p","note","Ta position exacte n'est pas envoyée : tes potes voient seulement la distance. Ta position du moment vient de la position partagée, de ta dernière sortie ou du lieu de ton alerte du matin."));
  const save=async()=>{ const {error}=await A.sb.rpc("set_nearby",{p_km:Number(s1.value),p_share:c2.checked}); if(error) return toast(frError(error)); try{ localStorage.setItem("cdj-nearby-share",c2.checked?"1":"0"); }catch(e){} toast("Préférence enregistrée"); };
  s1.addEventListener("change",save); c2.addEventListener("change",save);
}

/* ---------- Accroches ---------- */
A.checkin={quiet,endMine,open,get mine(){ return mine; }};
const prevChange=A.hooks.change; A.hooks.change=()=>{ prevChange?.(); load().then(render); };
const prevReady=A.hooks.mapReady; A.hooks.mapReady=m=>{ prevReady?.(m); drawMap(); };
const prevProfil=A.hooks.profil; A.hooks.profil=()=>{ prevProfil?.(); settings(); };
const prevStop=A.hooks.trackStopped; A.hooks.trackStopped=()=>{ prevStop?.(); if(mine) endMine(true).then(()=>toast("Sortie terminée, le groupe le voit")); };
setInterval(()=>{ if(document.visibilityState==="visible"&&A.me) load().then(render); },120000);
if(A.me) load().then(render);
if(A.me&&!$("#v-profil").hidden) settings();
})();
