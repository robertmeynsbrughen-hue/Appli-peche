// Coup du Jour : réglementation, sessions carpe, fiche poste, liste de matos.
(function(){
"use strict";
const A=window.CDJ; if(!A) return;
const {el,toast,frError,confirmBtn,userLabel,ago}=A;
const $=s=>document.querySelector(s);
const fmt=n=>Number(n).toLocaleString("fr-FR");
const pl=(n,w,ws)=>n+" "+(n>1?(ws||w+"s"):w);
function btn(label,cls,fn){ const b=el("button",cls||"btn",label); b.type="button"; if(fn) b.addEventListener("click",fn); return b; }
const hm=d=>new Date(d).toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"});
const dlong=d=>d.toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long",...(d.getFullYear()!==new Date().getFullYear()?{year:"numeric"}:{})});
function dur(ms){ const m=Math.max(0,Math.round(ms/6e4)); const h=Math.floor(m/60); return h?h+" h "+String(m%60).padStart(2,"0"):m+" min"; }

/* ---------- Réglementation (onglet Conseils) ---------- */
function lastWeekday(y,m,wd){ const d=new Date(y,m+1,0); while(d.getDay()!==wd) d.setDate(d.getDate()-1); return d; }
function nthWeekday(y,m,wd,n){ const d=new Date(y,m,1); while(d.getDay()!==wd) d.setDate(d.getDate()+1); d.setDate(d.getDate()+7*(n-1)); return d; }
const DAY=864e5;
function pikeStatus(now){
  const y=now.getFullYear(), t=new Date(now.getFullYear(),now.getMonth(),now.getDate());
  const close=lastWeekday(y,0,0), open=lastWeekday(y,3,6);
  if(t>=close&&t<open) return {open:false,next:open};
  const nextClose=t<close?close:lastWeekday(y+1,0,0);
  return {open:true,next:nextClose};
}
const openRegl=new Set((()=>{ try{ return JSON.parse(localStorage.getItem("cdj-regl-open")||"[]"); }catch(e){ return []; } })());
function renderRegl(){
  const box=$("#regl"); if(!box) return;
  const now=new Date(), today=new Date(now.getFullYear(),now.getMonth(),now.getDate());
  const st=pikeStatus(now), days=Math.round((st.next-today)/DAY);
  box.innerHTML="";
  const h=el("div","g-sec-head"); const t=el("h2",null,"Réglementation"); t.id="regl-title"; h.append(t, el("span","note","2e catégorie"));
  box.append(h);
  const alert=el("div","regl-alert"+(st.open?"":" closed"));
  alert.append(el("span","regl-ico",st.open?"✅":"⛔"));
  const at=el("div");
  if(st.open){
    at.append(el("b",null,"Carnassiers ouverts"), el("div","note","Fermeture du brochet le "+dlong(st.next)+(days<=45?" (dans "+pl(days,"jour")+")":"")));
  }else{
    at.append(el("b",null,"Brochet fermé"), el("div","note","Ouverture le "+dlong(st.next)+" : dans "+pl(days,"jour")+". Pêche aux leurres et vifs souvent interdite aussi pendant cette période."));
  }
  alert.append(at); box.append(alert);
  const rows=[
    ["Brochet",st.open?"Ouvert":"Fermé","60 cm",st.open,["Fermé du dernier dimanche de janvier au dernier samedi d'avril (2e catégorie).","Taille mini 60 cm ; certains départements imposent une fenêtre 60 à 80 cm.","2 brochets maximum par jour, compris dans les 3 carnassiers.","Pendant la fermeture, les leurres et les vifs sont souvent interdits aussi."]],
    ["Sandre",st.open?"Ouvert*":"Fermé*","50 cm",st.open,["Dates fixées par l'arrêté du département, souvent les mêmes que le brochet, parfois plus tard.","Taille mini 50 cm.","Compte dans les 3 carnassiers par jour."]],
    ["Black-bass",st.open?"Ouvert*":"Fermé*","30 cm*",st.open,["Taille mini nationale 30 cm, parfois 40 cm selon le département.","Dates parfois différentes du brochet : vérifie l'arrêté.","Compte dans les 3 carnassiers par jour."]],
    ["Perche","Toute l'année","—",true,["Ouverte toute l'année en 2e catégorie.","Pas de taille nationale, certains départements en fixent une."]],
    ["Silure","Toute l'année","—",true,["Ouvert toute l'année, sans taille ni quota national.","Matériel costaud obligatoire, manipule-le avec précaution."]],
    ["Chevesne","Toute l'année","—",true,["Ouvert toute l'année, sans taille nationale."]],
    ["Carpe","Toute l'année","—",true,["Ouverte toute l'année.","La nuit, seulement sur les parcours autorisés par l'arrêté, et toute carpe prise de nuit doit être remise à l'eau."]],
  ];
  const list=el("div","regl-list");
  rows.forEach(([sp,state,size,ok,lines])=>{
    const d=el("details","regl-item"); d.open=openRegl.has(sp);
    d.addEventListener("toggle",()=>{ d.open?openRegl.add(sp):openRegl.delete(sp); try{ localStorage.setItem("cdj-regl-open",JSON.stringify([...openRegl])); }catch(e){} });
    const sm=el("summary");
    const top=el("span","regl-top"); top.append(el("span","tag",sp), el("span","chip "+(ok?"plus":"minus"),state));
    const sz=el("span","regl-size"); sz.append(el("span","label","Taille mini"), el("span","rk-v",size));
    sm.append(top,sz,el("span","regl-chev","›"));
    const ul=el("ul","regl-lines"); lines.forEach(t=>ul.append(el("li",null,t)));
    d.append(sm,ul); list.append(d);
  });
  box.append(list);
  const y=now.getFullYear();
  const o1=nthWeekday(y,2,6,2), c1=nthWeekday(y,8,0,3);
  box.append(el("p","note","Quota : 3 carnassiers (brochet, sandre, black-bass) par jour et par pêcheur, dont 2 brochets au maximum. 1re catégorie : ouverte du "+o1.toLocaleDateString("fr-FR",{day:"numeric",month:"long"})+" au "+c1.toLocaleDateString("fr-FR",{day:"numeric",month:"long"})+" en "+y+"."));
  box.append(el("p","note","* Règles nationales indicatives. L'arrêté de ton département et le règlement de ton AAPPMA peuvent être plus stricts : vérifie-les avant de garder un poisson."));
}

/* ---------- Session carpe (onglet Fil) ---------- */
const KINDS={depart:{e:"🔔",t:"Départ"},touche:{e:"〰️",t:"Touche"},prise:{e:"🐟",t:"Prise"},amorcage:{e:"🥣",t:"Amorçage"},relance:{e:"🎣",t:"Relance"}};
let carp=null, events=[], rod=1, tick=null, cSeq=0, rodsPick=2;
async function loadCarp(){
  const box=$("#carp"); if(!box||box.hidden||!A.me||typeof A.cur!=="number") return;
  const seq=++cSeq, gid=A.cur;
  const [{data:mine},{data:recent}]=await Promise.all([
    A.sb.from("carp_sessions").select("id,group_id,user_id,spot_id,rods,bait,groundbait,started_at,ended_at,bait_every_min,next_bait_at").eq("group_id",gid).eq("user_id",A.me.id).is("ended_at",null).order("started_at",{ascending:false}).limit(1),
    A.sb.from("carp_sessions").select("id,user_id,spot_id,rods,bait,started_at,ended_at,profiles(username,is_admin),spots(name),carp_events(kind)").eq("group_id",gid).not("ended_at","is",null).order("started_at",{ascending:false}).limit(5),
  ]);
  if(seq!==cSeq) return;
  carp=(mine||[])[0]||null;
  if(carp){
    const {data}=await A.sb.from("carp_events").select("id,kind,at,rod,weight_kg,note").eq("session_id",carp.id).order("at",{ascending:false});
    if(seq!==cSeq) return;
    events=data||[];
  }
  drawCarp(recent||[]);
}
function drawCarp(recent){
  const box=$("#carp"); box.innerHTML=""; clearInterval(tick);
  if(!carp){ drawStart(box,recent); A.hooks.carpDrawn?.(box,false); return; }
  const spot=A.spots.find(s=>s.id===carp.spot_id);
  const head=el("div","carp-head");
  const ht=el("div"); ht.append(el("h2",null,"Session en cours"));
  const sub=el("div","note"); ht.append(sub);
  const upd=()=>{ sub.textContent=[spot?"📍 "+spot.name:null,"depuis "+hm(carp.started_at)+" · "+dur(Date.now()-new Date(carp.started_at))].filter(Boolean).join(" · "); };
  upd(); tick=setInterval(upd,30000);
  head.append(ht, el("span","live-dot","EN DIRECT")); box.append(head);
  if(carp.bait||carp.groundbait) box.append(el("p","note",[carp.bait?"Esche : "+carp.bait:null,carp.groundbait?"Amorçage : "+carp.groundbait:null].filter(Boolean).join(" · ")));
  // cannes
  if(carp.rods>1){
    const seg=el("div","seg"); seg.setAttribute("aria-label","Canne concernée");
    for(let i=1;i<=carp.rods;i++){ const b=btn("Canne "+i,null,()=>{ rod=i; [...seg.children].forEach((x,j)=>x.setAttribute("aria-pressed",String(j+1===i))); }); b.setAttribute("aria-pressed",String(i===rod)); seg.append(b); }
    box.append(seg);
  }else rod=1;
  const grid=el("div","carp-grid");
  const prise=el("form","carp-prise"); prise.hidden=true;
  Object.entries(KINDS).filter(([k])=>k!=="relance").forEach(([k,v])=>{
    const b=btn("","carp-btn k-"+k,()=>{ if(k==="prise"){ prise.hidden=!prise.hidden; if(!prise.hidden) prise.querySelector("input").focus(); return; } addEvent(k); });
    b.append(el("span","carp-e",v.e),el("span",null,v.t)); grid.append(b);
  });
  box.append(grid);
  const wl=el("label","field","Poids (kg, facultatif)"); const wi=el("input"); wi.type="number"; wi.step="0.05"; wi.min="0.1"; wi.max="59"; wi.inputMode="decimal"; wl.append(wi);
  const nl=el("label","field","Note (facultatif)"); const ni=el("input"); ni.maxLength=200; ni.placeholder="Commune, miroir, sortie au ras du bord…"; nl.append(ni);
  const row=el("div","row2"); row.append(wl,nl);
  const ok=el("button","btn primary","Noter la prise"); ok.type="submit";
  const pact=el("div","actions"); pact.append(ok);
  prise.append(row,pact);
  prise.addEventListener("submit",e=>{ e.preventDefault(); addEvent("prise",wi.value?Number(wi.value):null,ni.value.trim()||null); });
  box.append(prise);
  box.append(baitBlock());
  // stats rapides
  const cnt=k=>events.filter(x=>x.kind===k).length;
  const kp=el("div","kpis");
  [[cnt("depart"),"départ"],[cnt("touche"),"touche"],[cnt("prise"),"prise"]].forEach(([n,l])=>{ const d=el("div","kpi"); d.append(el("div","kpi-v",String(n)),el("div","kpi-l",l+(n>1?"s":""))); kp.append(d); });
  box.append(kp);
  // journal
  if(events.length){
    const list=el("div","list tight rk-list");
    events.forEach((x,i)=>{
      const r=el("div","mrow");
      const l=el("div","rk-l"); l.append(el("span","rk-v",hm(x.at)), el("span",null,KINDS[x.kind].e+" "+KINDS[x.kind].t+(carp.rods>1&&x.rod?" · canne "+x.rod:"")+(x.weight_kg?" · "+fmt(x.weight_kg)+" kg":"")));
      if(x.note) l.append(el("span","post-date",x.note));
      r.append(l);
      const act=el("div","actions");
      if(x.kind==="prise"&&!x.queued) act.append(btn("📸 Publier","linkbtn",()=>publish(x)));
      if(x.queued) act.append(el("span","note","⏳ en attente"));
      else if(i===0) act.append(confirmBtn("Annuler","Confirmer",async()=>{ const {error}=await A.sb.from("carp_events").delete().eq("id",x.id); if(error) return toast(frError(error)); events=events.filter(z=>z.id!==x.id); drawCarp([]); },"linkbtn danger"));
      r.append(act); list.append(r);
    });
    box.append(list);
  }else box.append(el("p","note","Touche un bouton à chaque départ, touche, prise ou amorçage : l'heure est notée automatiquement et sert à trouver les meilleures heures de ton poste."));
  const end=el("div","actions");
  end.append(confirmBtn("Terminer la session","Confirmer la fin",async()=>{
    const {error}=await A.sb.from("carp_sessions").update({ended_at:new Date().toISOString()}).eq("id",carp.id);
    if(error) return toast(frError(error));
    toast("Session terminée : "+pl(cnt("prise"),"prise")+" en "+dur(Date.now()-new Date(carp.started_at)));
    carp=null; events=[]; loadCarp(); A.hooks.carpEnded?.();
  },"btn"));
  box.append(end);
  A.hooks.carpDrawn?.(box,true);
}
/* ---------- Rappel d'amorçage ---------- */
// intervalle conseillé : eau froide = on amorce peu et rarement ; courant fort = la nourriture part plus vite ; poissons actifs = plus souvent
function suggestBait(){
  const snap=window.CDJ_ADVICE?.snapshot?.();
  const w=snap?.water;
  let m=w==null?60:w<8?120:w<12?90:w<16?60:w<20?45:35;
  const why=[w!=null?"eau à "+String(w).replace(".",",")+" °C":"eau non mesurée"];
  if(snap?.flow==="haute"||snap?.flow==="crue"){ m*=.7; why.push("courant fort"); }
  else if(snap?.flow==="basse"){ m*=1.2; why.push("basses eaux"); }
  const recent=events.filter(e=>(e.kind==="depart"||e.kind==="prise")&&Date.now()-new Date(e.at)<2*36e5).length;
  if(recent>=2){ m*=.8; why.push(recent+" départs en 2 h"); }
  m=Math.max(20,Math.min(180,Math.round(m/5)*5));
  return {m,why:why.join(", ")};
}
async function setBait(min,fromEvent){
  const next=min?new Date(Date.now()+min*6e4).toISOString():null;
  const {error}=await A.sb.from("carp_sessions").update({bait_every_min:min||null,next_bait_at:next}).eq("id",carp.id);
  if(error){ if(!fromEvent) toast(frError(error)); return; }
  carp.bait_every_min=min||null; carp.next_bait_at=next; alarmed=null;
  if(!fromEvent) drawCarp([]);
}
let alarmed=null, wake=null;
function beep(){
  try{
    const ac=new (window.AudioContext||window.webkitAudioContext)();
    [0,.35,.7].forEach(t=>{ const o=ac.createOscillator(), g=ac.createGain(); o.frequency.value=880; o.connect(g); g.connect(ac.destination);
      g.gain.setValueAtTime(.0001,ac.currentTime+t); g.gain.exponentialRampToValueAtTime(.4,ac.currentTime+t+.02); g.gain.exponentialRampToValueAtTime(.0001,ac.currentTime+t+.25);
      o.start(ac.currentTime+t); o.stop(ac.currentTime+t+.3); });
    setTimeout(()=>ac.close(),1500);
  }catch(e){}
  if(navigator.vibrate) try{ navigator.vibrate([300,150,300,150,300]); }catch(e){}
}
async function keepAwake(on){
  try{
    if(on&&"wakeLock" in navigator){ wake=await navigator.wakeLock.request("screen"); wake.addEventListener?.("release",()=>{ wake=null; }); }
    else if(!on&&wake){ await wake.release(); wake=null; }
  }catch(e){ toast("Impossible de garder l'écran allumé sur ce téléphone"); }
}
document.addEventListener("visibilitychange",()=>{ if(document.visibilityState==="visible"&&localStorage.getItem("cdj-wake")==="1"&&carp&&!wake) keepAwake(true); });
function baitBlock(){
  const b=el("div","bait-rem");
  const sug=suggestBait();
  if(carp.bait_every_min){
    const due=carp.next_bait_at?new Date(carp.next_bait_at).getTime():null;
    const left=due?Math.round((due-Date.now())/6e4):null;
    const t=el("div","bait-t"); t.append(el("b",null,"🥣 Rappel toutes les "+carp.bait_every_min+" min"),el("span","note",left==null?"":left<=0?"C'est l'heure de réamorcer !":"Prochain amorçage dans "+left+" min"));
    b.append(t);
    const act=el("div","actions");
    act.append(btn("✓ Amorçage fait","btn primary small",()=>addEvent("amorcage")));
    const sel=el("select"); sel.setAttribute("aria-label","Intervalle"); [20,30,45,60,90,120,180].forEach(v=>sel.append(new Option(v+" min",v))); if(![20,30,45,60,90,120,180].includes(carp.bait_every_min)) sel.append(new Option(carp.bait_every_min+" min",carp.bait_every_min)); sel.value=String(carp.bait_every_min);
    sel.addEventListener("change",()=>setBait(Number(sel.value)));
    act.append(sel, btn("Arrêter","linkbtn",()=>setBait(null)));
    b.append(act);
    if(left!=null&&left<=0) b.classList.add("due");
  }else{
    b.append(el("div","bait-t",""));
    b.firstChild.append(el("b",null,"🥣 Rappel d'amorçage"),el("span","note","Conseillé : toutes les "+sug.m+" min ("+sug.why+"). Tu reçois une notification avec sonnerie, même téléphone en veille."));
    const act=el("div","actions"); act.append(btn("Activer ("+sug.m+" min)","btn small",()=>setBait(sug.m))); b.append(act);
  }
  const wl=el("label","switch"); const wi=el("input"); wi.type="checkbox"; wi.checked=!!wake||localStorage.getItem("cdj-wake")==="1";
  wi.addEventListener("change",()=>{ try{ localStorage.setItem("cdj-wake",wi.checked?"1":"0"); }catch(e){} keepAwake(wi.checked); });
  const wt=el("span","switch-t"); wt.append(el("b",null,"🔆 Garder l'écran allumé"),el("span","note","Pratique sur le rod-pod, consomme plus de batterie"));
  wl.append(wi,el("span","switch-ui"),wt); b.append(wl);
  return b;
}
setInterval(()=>{
  if(!carp||!carp.next_bait_at) return;
  const due=new Date(carp.next_bait_at).getTime();
  const n=document.querySelector("#carp .bait-rem .bait-t .note"); if(n){ const left=Math.round((due-Date.now())/6e4); n.textContent=left<=0?"C'est l'heure de réamorcer !":"Prochain amorçage dans "+left+" min"; }
  if(Date.now()>=due&&alarmed!==carp.next_bait_at&&document.visibilityState==="visible"){ alarmed=carp.next_bait_at; beep(); toast("🥣 C'est l'heure de réamorcer !"); if(!$("#carp").hidden) drawCarp([]); }
},15000);

async function addEvent(kind,weight,note,forRod){
  const ins={session_id:carp.id,kind,at:new Date().toISOString(),rod:carp.rods>1?(forRod||rod):null,weight_kg:weight||null,note:note||null};
  let {data,error}=navigator.onLine?await A.sb.from("carp_events").insert(ins).select("id,kind,at,rod,weight_kg,note").single():{error:new Error("Failed to fetch")};
  if(error&&A.offline?.isNetErr(error)&&await A.offline.enqueue({kind:"insert",table:"carp_events",row:ins})){ error=null; data={...ins,id:"q"+Date.now(),queued:true}; }
  if(error) return toast(frError(error));
  events=[data,...events];
  if(kind==="amorcage"&&carp.bait_every_min) await setBait(carp.bait_every_min,true);
  if(navigator.vibrate) try{ navigator.vibrate(40); }catch(e){}
  toast(KINDS[kind].e+" "+KINDS[kind].t+" notée à "+hm(data.at));
  drawCarp([]);
}
A.carp={get cur(){ return carp; }, addEvent, beep};
function publish(x){
  const b=document.querySelector('#post-mode button[data-m="post"]'); if(b) b.click();
  const set=(id,v)=>{ const e=$(id); if(e&&v!=null){ e.value=v; e.dispatchEvent(new Event("input",{bubbles:true})); e.dispatchEvent(new Event("change",{bubbles:true})); } };
  set("#p-species","Carpe"); if(x.weight_kg) set("#p-wt",x.weight_kg); if(carp?.spot_id) set("#p-spot",String(carp.spot_id));
  set("#p-bait",[carp?.bait,carp?.groundbait?"amorçage : "+carp.groundbait:null].filter(Boolean).join(", ")||null);
  if(x.note) set("#p-caption",x.note);
  $("#composer")?.scrollIntoView({behavior:"smooth",block:"start"});
  toast("Ajoute ta photo, les infos de la prise sont déjà remplies");
}
function drawStart(box,recent){
  const h=el("div","g-sec-head"); h.append(el("h2",null,"Nouvelle session carpe")); box.append(h);
  const f=el("form","carp-start");
  const sl=el("label","field","Poste"); const ss=el("select"); ss.append(new Option("Aucun / pas encore sur la carte",""));
  A.spots.filter(s=>s.group_id===A.cur).forEach(s=>ss.append(new Option(s.name,s.id))); sl.append(ss);
  const rl=el("div","field"); rl.append("Nombre de cannes");
  const seg=el("div","seg");
  for(let i=1;i<=4;i++){ const b=btn(String(i),null,()=>{ rodsPick=i; [...seg.children].forEach((x,j)=>x.setAttribute("aria-pressed",String(j+1===i))); }); b.setAttribute("aria-pressed",String(i===rodsPick)); seg.append(b); }
  rl.append(seg);
  const bl=el("label","field","Esche"); const bi=el("input"); bi.maxLength=120; bi.placeholder="Bouillette scopex 20 mm, maïs…"; bl.append(bi);
  const gl=el("label","field","Amorçage"); const gi=el("input"); gi.maxLength=200; gi.placeholder="2 kg de bouillettes, 1 kg de graines…"; gl.append(gi);
  const go=el("button","btn primary","▶ Démarrer la session"); go.type="submit";
  const act=el("div","actions"); act.append(go);
  f.append(sl,rl,bl,gl,act);
  f.addEventListener("submit",async e=>{
    e.preventDefault(); go.disabled=true;
    const {data,error}=await A.sb.from("carp_sessions").insert({group_id:A.cur,user_id:A.me.id,spot_id:ss.value?Number(ss.value):null,rods:rodsPick,bait:bi.value.trim()||null,groundbait:gi.value.trim()||null})
      .select("id,group_id,user_id,spot_id,rods,bait,groundbait,started_at,ended_at").single();
    go.disabled=false;
    if(error) return toast(frError(error));
    carp=data; events=[]; rod=1; toast("Session lancée, bonne pêche !"); drawCarp([]);
  });
  box.append(f);
  if(recent.length){
    box.append(el("h4","g-sub","Dernières sessions du groupe"));
    const list=el("div","list tight rk-list");
    recent.forEach(s=>{
      const ev=s.carp_events||[], n=ev.filter(x=>x.kind==="prise").length, d=ev.filter(x=>x.kind==="depart").length;
      const r=el("div","mrow");
      const l=el("div"); l.append(userLabel(s.profiles?.username,s.profiles?.is_admin,A.roleOf(A.cur,s.user_id)));
      l.append(el("div","post-date",[s.spots?.name,new Date(s.started_at).toLocaleDateString("fr-FR",{day:"numeric",month:"short"}),dur(new Date(s.ended_at)-new Date(s.started_at))].filter(Boolean).join(" · ")));
      r.append(l, el("span","rk-v wrap",pl(n,"prise")+"\n"+pl(d,"départ")));
      list.append(r);
    });
    box.append(list);
  }
}

/* ---------- Fiche du poste ---------- */
const BOTTOMS=["Vase","Sable","Gravier","Argile","Herbiers","Rocheux","Encombré","Coquillages"];
let sheetEl=null;
function closeSheet(){ if(sheetEl){ sheetEl.remove(); sheetEl=null; document.removeEventListener("keydown",esc); } }
function esc(e){ if(e.key==="Escape") closeSheet(); }
async function spotSheet(s,editing){
  closeSheet();
  sheetEl=el("div","sheet-back"); sheetEl.id="spot-sheet";
  const sh=el("div","sheet spot-sheet"); sh.setAttribute("role","dialog"); sh.setAttribute("aria-modal","true"); sh.setAttribute("aria-labelledby","ss-title");
  const head=el("div","sheet-head"); const t=el("h2",null,s.name); t.id="ss-title";
  const x=btn("","icon-btn",closeSheet); x.setAttribute("aria-label","Fermer"); x.innerHTML='<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  head.append(t,x); sh.append(head);
  sheetEl.append(sh); document.body.append(sheetEl);
  sheetEl.addEventListener("click",e=>{ if(e.target===sheetEl) closeSheet(); });
  document.addEventListener("keydown",esc);

  const tools=el("div","actions");
  tools.append(btn("🌤️ Conditions ici","btn small",()=>{ closeSheet(); location.hash="#conseils"; window.CDJ_ADVICE?.loadAt(s.lat,s.lon,s.name).catch(()=>toast("Météo indisponible pour ce spot")); }));
  const it=el("a","btn small","🧭 Itinéraire"); it.href="https://www.google.com/maps/dir/?api=1&destination="+s.lat+","+s.lon; it.target="_blank"; it.rel="noopener"; tools.append(it);
  sh.append(tools);

  // fiche technique
  const card=el("div","spot-facts");
  if(editing){
    const f=el("form","spot-form");
    const row=el("div","row2");
    const dl=el("label","field","Profondeur (m)"); const di=el("input"); di.type="number"; di.step="0.1"; di.min="0.1"; di.max="100"; di.inputMode="decimal"; di.value=s.depth_m??""; dl.append(di);
    const tl=el("label","field","Distance (tours de canne)"); const ti=el("input"); ti.type="number"; ti.step="1"; ti.min="1"; ti.max="500"; ti.inputMode="numeric"; ti.value=s.distance_tours??""; tl.append(ti);
    row.append(dl,tl);
    const bl=el("label","field","Nature du fond"); const bs=el("select"); bs.append(new Option("Non renseigné","")); BOTTOMS.forEach(b=>bs.append(new Option(b,b)));
    if(s.bottom&&!BOTTOMS.includes(s.bottom)) bs.append(new Option(s.bottom,s.bottom)); bs.value=s.bottom||""; bl.append(bs);
    const nl=el("label","field","Infos du poste"); const ni=el("textarea"); ni.maxLength=1000; ni.placeholder="Repère sur la rive d'en face, obstacles, accès, stationnement…"; ni.value=s.details||""; nl.append(ni);
    const ok=el("button","btn primary","Enregistrer la fiche"); ok.type="submit";
    const act=el("div","actions"); act.append(ok, btn("Annuler","btn",()=>spotSheet(s,false)));
    f.append(row,bl,nl,act);
    f.addEventListener("submit",async e=>{
      e.preventDefault(); ok.disabled=true;
      const v={p_id:s.id,p_depth:di.value?Number(di.value):null,p_tours:ti.value?Math.round(Number(ti.value)):null,p_bottom:bs.value||null,p_details:ni.value.trim()||null};
      const {error}=await A.sb.rpc("update_spot_sheet",v);
      ok.disabled=false;
      if(error) return toast(frError(error));
      Object.assign(s,{depth_m:v.p_depth,distance_tours:v.p_tours,bottom:v.p_bottom,details:v.p_details,sheet_updated_at:new Date().toISOString()});
      toast("Fiche du poste enregistrée"); A.loadSpots?.(); spotSheet(s,false);
    });
    card.append(f);
  }else{
    const facts=el("div","facts");
    const fact=(k,v)=>{ const d=el("div","fact"); d.append(el("span","label",k),el("span","fact-v",v||"—")); facts.append(d); };
    fact("Profondeur",s.depth_m?String(s.depth_m).replace(".",",")+" m":null);
    fact("Distance",s.distance_tours?s.distance_tours+" tours":null);
    fact("Fond",s.bottom);
    card.append(facts);
    if(s.details){ const p=el("p","spot-details",s.details); card.append(p); }
    if(s.note) card.append(el("p","note",s.note));
    const foot=el("div","actions");
    if(s.sheet_updated_at) foot.append(el("span","note","Mise à jour "+ago(s.sheet_updated_at)));
    if(A.myRoles.has(s.group_id)||A.me?.is_admin) foot.append(btn("✏️ Compléter la fiche","linkbtn",()=>spotSheet(s,true)));
    card.append(foot);
  }
  sh.append(card);

  // historique et heures de touches
  const hist=el("div","spot-hist"); hist.append(el("p","note","Chargement de l'historique…")); sh.append(hist);
  const [{data:posts},{data:sess}]=await Promise.all([
    A.sb.from("posts").select("id,user_id,species,length_cm,weight_kg,created_at,profiles(username,is_admin)").eq("spot_id",s.id).eq("status","published").order("created_at",{ascending:false}).limit(20),
    A.sb.from("carp_sessions").select("id,user_id,started_at,ended_at,carp_events(kind,at,weight_kg)").eq("spot_id",s.id).order("started_at",{ascending:false}).limit(100),
  ]);
  if(!hist.isConnected) return;
  hist.innerHTML="";
  const ses=sess||[], evs=ses.flatMap(x=>x.carp_events||[]);
  const bites=evs.filter(e=>e.kind==="depart"||e.kind==="prise");
  hist.append(el("h4","g-sub","Sessions carpe sur ce poste"));
  if(ses.length){
    const kp=el("div","kpis");
    const hours=ses.reduce((a,x)=>a+((x.ended_at?new Date(x.ended_at):new Date())-new Date(x.started_at))/36e5,0);
    const nP=evs.filter(e=>e.kind==="prise").length;
    [[String(ses.length),"session"+(ses.length>1?"s":"")],[String(nP),"prise"+(nP>1?"s":"")],[hours?(nP/hours*24).toFixed(1).replace(".",","):"0","prises / 24 h"]].forEach(([v,l])=>{ const d=el("div","kpi"); d.append(el("div","kpi-v",v),el("div","kpi-l",l)); kp.append(d); });
    hist.append(kp);
    const best=evs.filter(e=>e.kind==="prise"&&e.weight_kg).sort((a,b)=>b.weight_kg-a.weight_kg)[0];
    if(best) hist.append(el("p","note","Record du poste : "+fmt(best.weight_kg)+" kg le "+new Date(best.at).toLocaleDateString("fr-FR",{day:"numeric",month:"long",year:"numeric"})+"."));
  }else hist.append(el("p","note","Aucune session carpe enregistrée ici. Lance-en une depuis le Fil (« Session carpe ») en choisissant ce poste."));
  if(bites.length){
    hist.append(el("h4","g-sub","Heures des départs"));
    hist.append(biteChart(bites));
  }
  hist.append(el("h4","g-sub","Prises publiées ici"));
  if(posts?.length){
    const list=el("div","list tight rk-list");
    posts.forEach(p=>{
      const r=el("div","mrow");
      const l=el("div"); l.append(el("div",null,[p.species||"Prise",p.length_cm?fmt(p.length_cm)+" cm":null,p.weight_kg?fmt(p.weight_kg)+" kg":null].filter(Boolean).join(" · ")));
      const by=el("div","post-date"); by.append(userLabel(p.profiles?.username,p.profiles?.is_admin)); l.append(by);
      r.append(l, el("span","post-date",new Date(p.created_at).toLocaleDateString("fr-FR",{day:"numeric",month:"short",year:"2-digit"})));
      list.append(r);
    });
    hist.append(list);
  }else hist.append(el("p","note","Aucune prise publiée avec ce poste pour l'instant."));
}
function biteChart(bites){
  const n=new Array(24).fill(0); bites.forEach(e=>n[new Date(e.at).getHours()]++);
  const max=Math.max(...n);
  const wrap=el("div","bite");
  const bars=el("div","bite-bars"); bars.setAttribute("role","img");
  const top=n.map((v,h)=>[v,h]).filter(([v])=>v).sort((a,b)=>b[0]-a[0]).slice(0,3).map(([,h])=>h+"h");
  bars.setAttribute("aria-label","Répartition des départs par heure. Meilleures heures : "+top.join(", "));
  n.forEach((v,h)=>{ const i=el("i"); i.style.height=(v?Math.max(8,v/max*100):2)+"%"; if(v===max&&v) i.className="top"; i.title=h+"h : "+pl(v,"départ"); bars.append(i); });
  const ax=el("div","bite-axis"); ["0h","6h","12h","18h","23h"].forEach(t=>ax.append(el("span",null,t)));
  wrap.append(bars,ax, el("p","note","Meilleures heures : "+top.join(", ")+" ("+pl(bites.length,"départ")+" au total)."));
  return wrap;
}

/* ---------- Liste de matos (onglet Profil) ---------- */
const PRESETS={
  "Carpe":["Cannes et moulinets","Rod-pod ou piques","Détecteurs et centrale","Bouillettes et esches","Amorce et graines","Lance-bouillettes / spomb","Épuisette","Tapis de réception","Désinfectant","Peson et sac de pesée","Bivvy et duvet","Frontale et batteries","Carte de pêche"],
  "Carnassier":["Canne et moulinet","Boîte de leurres","Bas de ligne fluoro / acier","Agrafes et émerillons","Pince à décrocher","Épuisette","Mètre","Lunettes polarisantes","Carte de pêche"],
  "Float-tube":["Float-tube et gonfleur","Waders et palmes","Gilet de sauvetage","Sondeur chargé","Sac étanche","Sifflet"],
};
let gear=[], gSeq=0;
async function loadGear(){
  const box=$("#gear"); if(!box) return;
  if(!A.me){ box.hidden=true; return; }
  box.hidden=false;
  const seq=++gSeq;
  const {data,error}=await A.sb.from("gear_items").select("id,kit,name,checked,created_at").eq("user_id",A.me.id).order("created_at");
  if(seq!==gSeq) return;
  if(error){ box.innerHTML=""; box.append(el("p","err",frError(error))); return; }
  gear=data||[]; drawGear();
}
function drawGear(){
  const box=$("#gear"); box.innerHTML="";
  const h=el("div","g-sec-head"); h.append(el("h2",null,"Ma liste de matos")); box.append(h);
  const kits=[...new Set(gear.map(g=>g.kit))];
  if(!kits.length) box.append(el("p","note","Prépare ta check-list avant de partir : ajoute tes affaires une par une, ou pars d'une liste type."));
  kits.forEach(k=>{
    const items=gear.filter(g=>g.kit===k), done=items.filter(g=>g.checked).length;
    const sec=el("details","kit"); sec.open=true;
    const sm=el("summary"); sm.append(el("span","kit-name",k), el("span","chip"+(done===items.length?" plus":""),done+"/"+items.length)); sec.append(sm);
    const ul=el("div","kit-list");
    items.forEach(g=>{
      const row=el("div","kit-item");
      const lab=el("label"); const cb=el("input"); cb.type="checkbox"; cb.checked=g.checked;
      cb.addEventListener("change",async()=>{ g.checked=cb.checked; drawGear(); const {error}=await A.sb.from("gear_items").update({checked:g.checked}).eq("id",g.id); if(error){ toast(frError(error)); loadGear(); } });
      lab.append(cb, el("span",null,g.name)); row.append(lab);
      const del=btn("×","icon-x",async()=>{ gear=gear.filter(z=>z.id!==g.id); drawGear(); const {error}=await A.sb.from("gear_items").delete().eq("id",g.id); if(error){ toast(frError(error)); loadGear(); } });
      del.setAttribute("aria-label","Retirer "+g.name); row.append(del);
      ul.append(row);
    });
    sec.append(ul);
    const act=el("div","actions");
    act.append(btn("Tout décocher","linkbtn",async()=>{ items.forEach(g=>g.checked=false); drawGear(); await A.sb.from("gear_items").update({checked:false}).eq("user_id",A.me.id).eq("kit",k); }));
    act.append(confirmBtn("Supprimer la liste","Confirmer",async()=>{ gear=gear.filter(g=>g.kit!==k); drawGear(); await A.sb.from("gear_items").delete().eq("user_id",A.me.id).eq("kit",k); },"linkbtn danger"));
    sec.append(act); box.append(sec);
  });
  // ajout
  const f=el("form","gear-add");
  const ki=el("input"); ki.maxLength=40; ki.placeholder="Liste"; ki.setAttribute("aria-label","Nom de la liste"); ki.value=kits[0]||"Général"; ki.setAttribute("list","gear-kits");
  const dl=el("datalist"); dl.id="gear-kits"; kits.forEach(k=>dl.append(new Option(k)));
  const ni=el("input"); ni.maxLength=80; ni.required=true; ni.placeholder="Ajouter un élément…"; ni.setAttribute("aria-label","Élément à ajouter");
  const ok=el("button","btn primary small","Ajouter"); ok.type="submit";
  f.append(ki,dl,ni,ok);
  f.addEventListener("submit",async e=>{
    e.preventDefault(); const name=ni.value.trim(), kit=ki.value.trim()||"Général"; if(!name) return;
    const {data,error}=await A.sb.from("gear_items").insert({user_id:A.me.id,kit,name}).select("id,kit,name,checked,created_at").single();
    if(error) return toast(frError(error));
    gear.push(data); drawGear(); $("#gear .gear-add input:nth-of-type(2)")?.focus();
  });
  box.append(f);
  const pre=el("div","chips"); pre.append(el("span","note","Listes types :"));
  Object.keys(PRESETS).forEach(k=>pre.append(btn("+ "+k,"chip pick",async()=>{
    const have=new Set(gear.filter(g=>g.kit===k).map(g=>g.name));
    const rows=PRESETS[k].filter(n=>!have.has(n)).map(name=>({user_id:A.me.id,kit:k,name}));
    if(!rows.length) return toast("La liste « "+k+" » est déjà complète");
    const {data,error}=await A.sb.from("gear_items").insert(rows).select("id,kit,name,checked,created_at");
    if(error) return toast(frError(error));
    gear.push(...(data||[])); drawGear(); toast("Liste « "+k+" » ajoutée");
  })));
  box.append(pre);
}

/* ---------- Accroches ---------- */
A.hooks.afterFlush=()=>{ if(carp) loadCarp(); };
A.hooks.spotSheet=s=>spotSheet(s,false);
A.hooks.mode=m=>{ if(m==="carp") loadCarp(); else clearInterval(tick); };
const prevProfil=A.hooks.profil;
A.hooks.profil=()=>{ prevProfil?.(); loadGear(); };
const prevChange=A.hooks.change;
let lastCur;
A.hooks.change=()=>{
  prevChange?.();
  if(!A.me){ gear=[]; carp=null; const g=$("#gear"); if(g) g.hidden=true; return; }
  if(A.cur!==lastCur){ lastCur=A.cur; carp=null; loadCarp(); }
  if(!$("#v-profil").hidden&&$("#gear").hidden) loadGear();
};
renderRegl();
setInterval(()=>{ if(!$("#v-conseils").hidden) renderRegl(); },36e5);
if(A.me){ lastCur=A.cur; loadCarp(); if(!$("#v-profil").hidden) loadGear(); }
})();
