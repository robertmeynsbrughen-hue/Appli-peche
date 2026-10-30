// Rivio : bulletin d'eau noté par les membres (pris en compte dans les conseils pendant 48 h)
// et rubrique Environnement du groupe (signaler pollution, poissons morts, niveau anormal…).
(function(){
"use strict";
const A=window.CDJ; if(!A) return;
const {el,toast,frError,ago,confirmBtn}=A;
const $=s=>document.querySelector(s);
function btn(label,cls,fn){ const b=el("button",cls||"btn",label); b.type="button"; if(fn) b.addEventListener("click",fn); return b; }
function sheet(title,cls){
  const back=el("div","sheet-back"), sh=el("div","sheet "+(cls||"")); sh.setAttribute("role","dialog"); sh.setAttribute("aria-modal","true"); sh.setAttribute("aria-label",title);
  const head=el("div","sheet-head"); head.append(el("h2",null,title)); const x=btn("✕","icon-btn"); x.setAttribute("aria-label","Fermer"); head.append(x); sh.append(head);
  const close=()=>back.remove(); x.addEventListener("click",close); back.addEventListener("click",e=>{ if(e.target===back) close(); });
  back.append(sh); document.body.append(back); return {sh,close};
}
function seg(opts,val,label){
  const s=el("div","seg env-seg"); s.setAttribute("role","radiogroup"); s.setAttribute("aria-label",label); s.value=val;
  opts.forEach(([k,t])=>{ const b=btn(t,null,()=>{ s.value=s.value===k?null:k; s.querySelectorAll("button").forEach(x=>x.setAttribute("aria-pressed",String(x.dataset.k===s.value))); }); b.dataset.k=k; b.setAttribute("aria-pressed",String(k===val)); s.append(b); });
  return s;
}
const ADV=()=>window.CDJ_ADVICE;
const groupId=()=>typeof A.cur==="number"?A.cur:(A.groups[0]?.id??null);
function here(){
  return new Promise(res=>{
    const fb=()=>{ const m=ADV()?.meta?.(); res(m?{lat:m.lat,lon:m.lon,approx:true}:null); };
    if(!navigator.geolocation) return fb();
    navigator.geolocation.getCurrentPosition(p=>res({lat:+p.coords.latitude.toFixed(5),lon:+p.coords.longitude.toFixed(5)}),fb,{enableHighAccuracy:true,timeout:8000,maximumAge:120000});
  });
}
const dist=(a,b)=>{ const dx=(a.lon-b.lon)*111*Math.cos(a.lat*Math.PI/180), dy=(a.lat-b.lat)*111; return Math.hypot(dx,dy); };

/* =================== Bulletin d'eau =================== */
const COLORS=[["claire","Claire"],["teintee","Teintée"],["trouble","Trouble"]];
const LEVELS=[["bas","Bas"],["normal","Normal"],["haut","Haut"],["crue","Crue"]];
const CTXT={claire:"eau claire",teintee:"eau teintée",trouble:"eau trouble"}, LTXT={bas:"niveau bas",normal:"niveau normal",haut:"niveau haut",crue:"en crue"};
function reportText(r){ return [r.color?CTXT[r.color]:null,r.temp!=null?String(r.temp).replace(".",",")+" °C":null,r.level?LTXT[r.level]:null,r.weeds?"herbiers":null].filter(Boolean).join(" · "); }
function waterForm(spot){
  if(!A.me) return toast("Connecte-toi pour noter l'eau");
  const gid=spot?.group_id??groupId(); if(gid==null) return toast("Rejoins un groupe pour partager un bulletin d'eau");
  const {sh,close}=sheet("💧 Bulletin d'eau","env-sheet");
  sh.append(el("p","note","Ce que tu vois au bord de l'eau. Le groupe le voit pendant 48 h et les conseils s'en servent dans un rayon de 6 km."));
  const f=el("form","env-form");
  let where=null;
  const wl=el("label","field","Où"); const ws=el("select");
  const near=A.spots.filter(s=>s.group_id===gid);
  ws.append(new Option("📍 Ma position actuelle",""));
  near.forEach(s=>ws.append(new Option(s.name,String(s.id))));
  if(spot) ws.value=String(spot.id); wl.append(ws);
  // propose le spot le plus proche
  if(!spot&&near.length) here().then(p=>{ if(!p||!ws.isConnected||ws.value) return; let best=null,bd=1e9; near.forEach(s=>{ const d=dist(p,s); if(d<bd){ bd=d; best=s; } }); if(best&&bd<0.4) ws.value=String(best.id); where=p; });
  const c=seg(COLORS,null,"Couleur de l'eau"), lv=seg(LEVELS,null,"Niveau");
  const tl=el("label","field","Température de l'eau (°C, facultatif)"); const ti=el("input"); ti.type="number"; ti.step="0.1"; ti.min="0"; ti.max="35"; ti.inputMode="decimal"; ti.placeholder="ex. 12,5 au thermomètre"; tl.append(ti);
  const hw=el("label","check"); const hc=el("input"); hc.type="checkbox"; hw.append(hc," Herbiers bien présents");
  const nl=el("label","field","Remarque (facultatif)"); const ni=el("input"); ni.maxLength=200; ni.placeholder="Écume, vent, poissons en surface…"; nl.append(ni);
  const ok=el("button","btn primary","Partager au groupe"); ok.type="submit";
  f.append(wl,el("span","label","Couleur de l'eau"),c,el("span","label","Niveau"),lv,tl,hw,nl,el("div","actions"));
  f.lastChild.append(ok,btn("Annuler","linkbtn",close));
  sh.append(f);
  f.addEventListener("submit",async e=>{
    e.preventDefault();
    const temp=ti.value?Number(String(ti.value).replace(",",".")):null;
    if(!c.value&&!lv.value&&temp==null) return toast("Indique au moins la couleur, le niveau ou la température");
    ok.disabled=true;
    let pos;
    const s=ws.value?A.spots.find(x=>String(x.id)===ws.value):null;
    if(s) pos={lat:s.lat,lon:s.lon}; else pos=where||await here();
    if(!pos){ ok.disabled=false; return toast("Position introuvable : choisis un spot"); }
    const row={group_id:s?.group_id??gid,spot_id:s?.id??null,lat:+pos.lat.toFixed(5),lon:+pos.lon.toFixed(5),color:c.value||null,level:lv.value||null,temp,weeds:hc.checked||null,note:ni.value.trim()||null};
    const {data,error}=await A.sb.from("water_reports").insert(row).select("id,group_id,user_id,spot_id,lat,lon,color,level,temp,weeds,note,created_at").single();
    ok.disabled=false;
    if(error) return toast(frError(error));
    close(); toast("💧 Merci ! Bulletin partagé pour 48 h");
    const r={...(data||row),created_at:data?.created_at||new Date().toISOString(),profiles:{username:A.me.username}};
    cache=null; useReport(r);
  });
}
let cache=null, rSeq=0;
async function loadReports(){
  if(!A.me||!A.sb) return [];
  if(cache&&Date.now()-cache.ts<5*6e4) return cache.v;
  const {data,error}=await A.sb.from("water_reports").select("id,group_id,user_id,spot_id,lat,lon,color,level,temp,weeds,note,created_at,profiles(username)").gte("created_at",new Date(Date.now()-48*36e5).toISOString()).order("created_at",{ascending:false}).limit(200);
  if(error) return [];
  cache={ts:Date.now(),v:data||[]}; return cache.v;
}
function useReport(r){ ADV()?.setReport?.(r); }
async function pickFor(lat,lon){
  const s=++rSeq; const list=await loadReports(); if(s!==rSeq) return;
  const near=list.filter(r=>dist({lat,lon},r)<=6);
  // le plus récent ; à égalité d'âge (moins de 3 h d'écart), le plus proche
  near.sort((a,b)=>{ const ta=new Date(a.created_at), tb=new Date(b.created_at); if(Math.abs(ta-tb)<3*36e5) return dist({lat,lon},a)-dist({lat,lon},b); return tb-ta; });
  useReport(near[0]||null);
}
window.addEventListener("cdj-pos",e=>{ const d=e.detail; if(d) pickFor(d.lat,d.lon); });
function refreshFromMeta(){ const m=ADV()?.meta?.(); if(m) pickFor(m.lat,m.lon); }

// écran Aujourd'hui : bulletin en cours et bouton pour noter l'eau
const prevDE=A.hooks.dayExtras; A.hooks.dayExtras=(slot,T)=>{
  prevDE?.(slot,T);
  const r=ADV()?.report?.();
  if(r){ const b=el("div","water-note"); b.append(el("b",null,"💧 "+reportText(r)), el("span","note","Noté par @"+(r.profiles?.username||"un membre")+" "+ago(r.created_at)+(r.note?" · « "+r.note+" »":"")+" · pris en compte dans les conseils")); slot.append(b); }
  if(A.me&&A.groups.length) slot.append(btn("💧 Noter l'eau","btn small today-share",()=>waterForm(null)));
};
// fiche du poste : dernier bulletin du spot et bouton
const prevSE=A.hooks.spotExtras; A.hooks.spotExtras=(s,sh)=>{
  prevSE?.(s,sh);
  const box=el("div","spot-water"); const hist=sh.querySelector(".spot-hist"); if(hist) hist.before(box); else sh.append(box);
  box.append(el("h4","g-sub","💧 État de l'eau"));
  const line=el("p","note","…"); box.append(line, btn("💧 Noter l'eau ici","btn small",()=>waterForm(s)));
  loadReports().then(list=>{
    if(!line.isConnected) return;
    const r=list.find(x=>x.spot_id===s.id)||list.find(x=>dist(s,x)<=0.3);
    line.textContent=r?reportText(r)+" · @"+(r.profiles?.username||"?")+" "+ago(r.created_at):"Pas de bulletin depuis 48 h sur ce poste.";
    if(r) line.className="water-line";
  });
};

/* =================== Rubrique Environnement =================== */
const KINDS={pollution:["🛢️","Pollution","Couleur, odeur, mousse ou nappe anormale"],mortalite:["🐟","Poissons morts","Mortalité ou poissons en détresse"],niveau:["📉","Niveau anormal","Assec, vidange, lâcher d'eau brutal"],obstacle:["⚠️","Obstacle ou danger","Arbre, berge effondrée, barrage, courant dangereux"],dechets:["🗑️","Déchets","Dépôt sauvage, fils et plombs abandonnés"],autre:["❓","Autre","Tout autre problème"]};
const STATUS={ouvert:["Ouvert","st-open"],transmis:["Transmis","st-sent"],resolu:["Résolu","st-done"]};
const mapsLink=(lat,lon)=>"https://www.google.com/maps?q="+lat+","+lon;
function contactText(r){
  const k=KINDS[r.kind]||KINDS.autre;
  return "Signalement : "+k[1].toLowerCase()+"\nDate : "+new Date(r.created_at||Date.now()).toLocaleString("fr-FR",{dateStyle:"long",timeStyle:"short"})+
    (r.place?"\nLieu : "+r.place:"")+"\nPosition GPS : "+r.lat+", "+r.lon+" ("+mapsLink(r.lat,r.lon)+")"+(r.details?"\nConstat : "+r.details:"")+"\n\nSignalé par un pêcheur via l'appli Rivio.";
}
function whoBox(r){
  const w=el("div","env-who");
  w.append(el("b",null,"Qui prévenir ?"));
  const ul=el("ul","sp-list");
  [["🚨","Danger immédiat (personnes, gros déversement) : 112 ou les pompiers (18)."],
   ["🐟","Pollution ou poissons morts : la fédération de pêche de ton département et ton AAPPMA, qui préviennent les services compétents."],
   ["🌿","Le service départemental de l'OFB (Office français de la biodiversité) : police de l'eau et de l'environnement."],
   ["🏛️","Déchets, obstacle, berge dangereuse : la mairie de la commune."]].forEach(([i,t])=>{ const li=el("li"); li.append(i+" "+t); ul.append(li); });
  w.append(ul, el("p","note","Les coordonnées changent selon le département : cherche « fédération de pêche » et « OFB » suivis de ton département. Le message ci-dessous est prêt à envoyer."));
  const a=el("div","actions");
  const txt=contactText(r);
  if(navigator.share) a.append(btn("📤 Envoyer le signalement","btn primary small",()=>navigator.share({title:"Signalement environnement",text:txt}).catch(()=>{})));
  a.append(btn("📋 Copier le message","btn small",async()=>{ try{ await navigator.clipboard.writeText(txt); toast("Message copié"); }catch(_){ toast("Copie impossible"); } }));
  w.append(a); return w;
}
function envForm(gid,done){
  const {sh,close}=sheet("🌿 Signaler un problème","env-sheet");
  sh.append(el("p","note","Tout le groupe est prévenu. Ensuite, Rivio prépare le message à envoyer aux bons interlocuteurs."));
  const f=el("form","env-form");
  const kinds=el("div","env-kinds"); let kind=null;
  Object.entries(KINDS).forEach(([k,[i,t,d]])=>{ const b=btn("","env-kind",()=>{ kind=k; kinds.querySelectorAll(".env-kind").forEach(x=>x.classList.toggle("on",x===b)); }); b.append(el("span","ek-i",i),el("b",null,t),el("span","note",d)); kinds.append(b); });
  const pl=el("label","field","Lieu (facultatif)"); const pi=el("input"); pi.maxLength=80; pi.placeholder="ex. Pont de Castelmoron, rive gauche"; pl.append(pi);
  const dl=el("label","field","Ce que tu constates"); const di=el("textarea"); di.maxLength=600; di.placeholder="Depuis quand, étendue, odeur, nombre de poissons, espèce…"; dl.append(di);
  const phl=el("label","field","Photo (conseillée)"); const ph=el("input"); ph.type="file"; ph.accept="image/*"; phl.append(ph);
  const posNote=el("p","note","📍 La position est prise automatiquement là où tu es.");
  const ok=el("button","btn primary","Signaler au groupe"); ok.type="submit";
  const act=el("div","actions"); act.append(ok,btn("Annuler","linkbtn",close));
  f.append(el("span","label","Quel problème ?"),kinds,pl,dl,phl,posNote,act); sh.append(f);
  f.addEventListener("submit",async e=>{
    e.preventDefault(); if(!kind) return toast("Choisis le type de problème");
    ok.disabled=true; ok.textContent="Envoi…";
    const pos=await here(); if(!pos){ ok.disabled=false; ok.textContent="Signaler au groupe"; return toast("Position introuvable : autorise la localisation"); }
    let photo_path=null;
    if(ph.files?.[0]){ try{ const blob=await A.compress(ph.files[0]); const path=gid+"/"+A.me.id+"/env-"+Date.now()+".jpg"; const {error}=await A.sb.storage.from("photos").upload(path,blob,{contentType:"image/jpeg"}); if(!error) photo_path=path; }catch(_){} }
    const row={group_id:gid,kind,lat:pos.lat,lon:pos.lon,place:pi.value.trim()||null,details:di.value.trim()||null,photo_path};
    const {data,error}=await A.sb.from("env_reports").insert(row).select("id,created_at").single();
    ok.disabled=false; ok.textContent="Signaler au groupe";
    if(error) return toast(frError(error));
    close(); toast("🌿 Signalement envoyé au groupe");
    done?.();
    // étape suivante : prévenir les interlocuteurs
    const {sh:s2}=sheet("Prévenir les bons interlocuteurs","env-sheet");
    s2.append(whoBox({...row,...(data||{})}));
  });
}
let eSeq=0;
async function envSection(root){
  const gid=A.cur; if(typeof gid!=="number") return;
  const sec=el("section","g-sec env-sec"); sec.dataset.sub="env"; root.append(sec);
  const head=el("div","g-sec-head"); head.append(el("h3",null,"🌿 Environnement"));
  head.append(btn("⚠️ Signaler","btn small primary",()=>envForm(gid,()=>envSection.reload?.())));
  sec.append(head, el("p","note","Pollution, poissons morts, niveau anormal, déchets ou danger : préviens le groupe en un geste, puis envoie le message tout prêt aux services concernés."));
  const list=el("div","env-list"); sec.append(list);
  const water=el("div","env-water"); sec.append(water);
  const load=async()=>{
    const s=++eSeq;
    list.innerHTML=""; list.append(el("p","note","Chargement…"));
    const [{data,error},wr]=await Promise.all([A.sb.from("env_reports").select("id,group_id,user_id,kind,lat,lon,place,details,photo_path,status,created_at,updated_at,profiles(username,is_admin)").eq("group_id",gid).order("created_at",{ascending:false}).limit(40),loadReports()]);
    if(s!==eSeq||!list.isConnected) return;
    list.innerHTML="";
    if(error){ list.append(el("p","err",frError(error))); return; }
    const rows=(data||[]).sort((a,b)=>(a.status==="resolu")-(b.status==="resolu"));
    if(!rows.length){ const e=el("div","empty-state"); e.append(el("div","es-ico","🌿"),el("b",null,"Rien à signaler"),el("p",null,"Tant mieux ! Si tu vois un problème au bord de l'eau, touche « Signaler ».")); list.append(e); }
    const paths=rows.map(r=>r.photo_path).filter(Boolean); let urls={};
    if(paths.length){ const {data:sig}=await A.sb.storage.from("photos").createSignedUrls(paths,3600); (sig||[]).forEach(z=>{ if(z.signedUrl) urls[z.path]=z.signedUrl; }); }
    rows.forEach(r=>{
      const k=KINDS[r.kind]||KINDS.autre, st=STATUS[r.status]||STATUS.ouvert;
      const c=el("article","env-item"+(r.status==="resolu"?" done":""));
      const top=el("div","env-top"); top.append(el("span","ek-i",k[0]));
      const t=el("div","env-t"); t.append(el("b",null,k[1]+(r.place?" · "+r.place:"")), el("span","note","@"+(r.profiles?.username||"?")+" · "+ago(r.created_at)));
      top.append(t, el("span","env-st "+st[1],st[0])); c.append(top);
      if(r.details) c.append(el("p","env-d",r.details));
      if(r.photo_path&&urls[r.photo_path]){ const im=el("img","env-ph"); im.src=urls[r.photo_path]; im.alt="Photo du signalement"; im.loading="lazy"; c.append(im); }
      const a=el("div","actions");
      a.append(btn("📍 Carte","btn small",()=>{ location.hash="#carte"; setTimeout(()=>{ try{ A.map?.setView([r.lat,r.lon],16); if(typeof L!=="undefined"&&A.map) L.marker([r.lat,r.lon],{icon:L.divIcon({className:"",html:'<div class="env-pin">'+k[0]+'</div>',iconSize:[30,30],iconAnchor:[15,15]})}).addTo(A.map).bindPopup(k[1]).openPopup(); }catch(_){} },400); }));
      a.append(btn("📤 Prévenir","btn small",()=>{ const {sh}=sheet("Prévenir les bons interlocuteurs","env-sheet"); sh.append(whoBox(r)); }));
      const mine=r.user_id===A.me?.id, mod=A.canModerate(gid);
      if(mine||mod){
        if(r.status==="ouvert") a.append(btn("✓ Transmis","linkbtn",()=>setStatus(r,"transmis")));
        if(r.status!=="resolu") a.append(btn("✅ Résolu","linkbtn",()=>setStatus(r,"resolu")));
        else a.append(btn("Rouvrir","linkbtn",()=>setStatus(r,"ouvert")));
        a.append(confirmBtn("🗑","Supprimer ?",async()=>{ const {error}=await A.sb.from("env_reports").delete().eq("id",r.id); if(error) return toast(frError(error)); if(r.photo_path&&mine) A.sb.storage.from("photos").remove([r.photo_path]); load(); }));
      }
      c.append(a); list.append(c);
    });
    // bulletins d'eau du groupe (48 h)
    water.innerHTML="";
    const w=(wr||[]).filter(x=>x.group_id===gid).slice(0,8);
    water.append(el("h4","g-sub","💧 Bulletins d'eau (48 h)"));
    if(!w.length) water.append(el("p","note","Aucun bulletin récent. Note la couleur, le niveau et la température quand tu es au bord de l'eau : les conseils de tout le groupe en tiennent compte."));
    w.forEach(x=>{ const sp=A.spots.find(s=>s.id===x.spot_id); const r=el("div","mrow"); r.append(el("span",null,(sp?sp.name:"Position GPS")+" · "+reportText(x)), el("span","note","@"+(x.profiles?.username||"?")+" "+ago(x.created_at))); water.append(r); });
    water.append(btn("💧 Noter l'eau","btn small",()=>waterForm(null)));
  };
  const setStatus=async(r,v)=>{ const {error}=await A.sb.rpc("set_env_status",{p_id:r.id,p_status:v}); if(error) return toast(frError(error)); toast(v==="resolu"?"Signalement résolu, merci !":"Statut mis à jour"); load(); };
  envSection.reload=load;
  load();
}
const prevGR=A.hooks.groupeRendered; A.hooks.groupeRendered=root=>{ prevGR?.(root); envSection(root); };
// le groupe a pu être affiché avant le chargement de ce module
{ const r=$("#groupe-root"); if(r&&r.children.length&&!r.querySelector(".env-sec")) envSection(r); }
const prevCh=A.hooks.change; A.hooks.change=(...a)=>{ prevCh?.(...a); cache=null; if(A.me) refreshFromMeta(); };
if(A.me) refreshFromMeta();
A.env={waterForm,envForm:()=>{ const g=groupId(); if(g!=null) envForm(g); }};
})();
