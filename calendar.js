// Coup du Jour : calendrier du mois (chances de pêche sur 30 jours) et réveil pêche.
(function(){
"use strict";
const A=window.CDJ; if(!A) return;
const {el,toast,frError}=A;
const $=s=>document.querySelector(s);
const get=(k,d)=>{ try{ return localStorage.getItem(k)??d; }catch(e){ return d; } };
const set=(k,v)=>{ try{ localStorage.setItem(k,v); }catch(e){} };
function btn(label,cls,fn){ const b=el("button",cls||"btn",label); b.type="button"; if(fn) b.addEventListener("click",fn); return b; }
const ADV=()=>window.CDJ_ADVICE;
const pad=n=>String(n).padStart(2,"0");
const hh=h=>Math.floor(h)+"h"+(h%1?pad(Math.round(h%1*60)):"");
const dayKey=d=>d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate());
function sheet(title,cls){
  const back=el("div","sheet-back"); const sh=el("div","sheet "+(cls||"")); sh.setAttribute("role","dialog"); sh.setAttribute("aria-modal","true"); sh.setAttribute("aria-label",title);
  const head=el("div","sheet-head"); head.append(el("h2",null,title)); const x=btn("✕","icon-btn"); x.setAttribute("aria-label","Fermer"); head.append(x); sh.append(head);
  const close=()=>{ back.remove(); document.removeEventListener("keydown",esc); }; const esc=e=>{ if(e.key==="Escape") close(); };
  x.addEventListener("click",close); back.addEventListener("click",e=>{ if(e.target===back) close(); }); document.addEventListener("keydown",esc);
  back.append(sh); document.body.append(back); return {sh,close};
}
// lieux possibles : position des conseils, spots du groupe
function places(){
  const out=[]; const cur=ADV()?.current?.(); const def=ADV()?.defaultPos?.();
  if(cur&&cur.lat!=null) out.push({id:"cur",name:"📍 Lieu des conseils",lat:cur.lat,lon:cur.lon});
  else if(def) out.push({id:"cur",name:"📍 "+def.name,lat:def.lat,lon:def.lon});
  A.spots.filter(s=>typeof A.cur!=="number"||s.group_id===A.cur).forEach(s=>out.push({id:String(s.id),name:s.name,lat:s.lat,lon:s.lon,spot:s}));
  return out;
}
const SP=()=>(ADV()?.species?.()||[]);
function pickSp(day,sp){ if(!day) return null; const list=day.per.filter(p=>!p.closed&&p.at!=null); if(sp) return list.find(p=>p.name===sp)||null; return list.sort((a,b)=>b.best-a.best)[0]||null; }
const MOONF={"Nouvelle lune":1.08,"Pleine lune":1.08,"Premier quartier":.96,"Dernier quartier":.96};

/* ---------- Calendrier ---------- */
async function calendar(){
  const {sh}=sheet("📅 Calendrier du mois","cal-sheet");
  const pl=places();
  const row=el("div","cal-opts");
  const ps=el("select"); pl.forEach(p=>ps.append(new Option(p.name,p.id))); ps.value=get("cdj-cal-place",pl[0]?.id||"cur"); if(![...ps.options].some(o=>o.value===ps.value)) ps.value=pl[0]?.id;
  const ss=el("select"); ss.append(new Option("Toutes les espèces","")); SP().forEach(n=>ss.append(new Option(n,n))); ss.value=get("cdj-cal-sp","");
  row.append(ps,ss); sh.append(row);
  const body=el("div","cal-body"); sh.append(body);
  async function draw(){
    set("cdj-cal-place",ps.value); set("cdj-cal-sp",ss.value);
    const p=pl.find(x=>x.id===ps.value)||pl[0]; if(!p){ body.textContent="Aucun lieu."; return; }
    body.innerHTML=""; body.append(el("p","note","Chargement des prévisions…"));
    let days; try{ days=await ADV().forecastDays(p.lat,p.lon,16); }catch(e){ body.innerHTML=""; body.append(el("p","warn","Prévisions indisponibles (pas de réseau ?).")); return; }
    const sc=d=>{ const x=pickSp(d,ss.value); return x?x.best:0; };
    // au-delà de 16 jours : tendance (saison + lune), à partir de la moyenne des derniers jours prévus
    const tail=days.slice(-7).map(sc); const base=tail.reduce((a,b)=>a+b,0)/(tail.length||1);
    const start=new Date(); start.setHours(12,0,0,0);
    const cells=[];
    for(let i=0;i<30;i++){
      const d=new Date(start.getTime()+i*864e5), k=dayKey(d), f=days.find(x=>x.k===k);
      if(f) cells.push({d,k,f,score:sc(f),trend:false,moon:f.moon});
      else{ const mo=ADV().moon(d); cells.push({d,k,f:null,score:Math.min(1,base*(MOONF[mo]||1)),trend:true,moon:mo}); }
    }
    body.innerHTML="";
    // meilleurs week-ends
    const we=[]; cells.forEach((c,i)=>{ if(c.d.getDay()===6){ const sun=cells[i+1]; we.push({sat:c,sun,score:Math.max(c.score,sun?sun.score:0)}); } });
    const bestWe=we.filter(w=>!w.sat.trend).sort((a,b)=>b.score-a.score).slice(0,2);
    if(bestWe.length){ const b=el("div","cal-best"); b.append(el("b",null,"🏆 Meilleurs week-ends")); bestWe.forEach(w=>b.append(el("span",null,"Sam. "+w.sat.d.getDate()+" / dim. "+(w.sun?w.sun.d.getDate():"–")+" "+w.sat.d.toLocaleDateString("fr-FR",{month:"short"})+" · "+Math.round(w.score*100)+" %"))); body.append(b); }
    const g=el("div","cal-grid");
    ["L","M","M","J","V","S","D"].forEach(x=>g.append(el("span","cal-wd",x)));
    const lead=(cells[0].d.getDay()+6)%7; for(let i=0;i<lead;i++) g.append(el("span"));
    const detail=el("div","cal-detail");
    cells.forEach(c=>{
      const b=el("button","cal-day"+(c.trend?" trend":"")+([0,6].includes(c.d.getDay())?" we":"")); b.type="button";
      b.style.setProperty("--s",c.score.toFixed(2));
      b.append(el("b",null,String(c.d.getDate())),el("span",null,Math.round(c.score*100)+(c.trend?"~":"")));
      if(c.moon==="Pleine lune") b.append(el("i",null,"🌕")); else if(c.moon==="Nouvelle lune") b.append(el("i",null,"🌑"));
      b.addEventListener("click",()=>{ g.querySelectorAll(".on").forEach(x=>x.classList.remove("on")); b.classList.add("on"); showDay(detail,c,p,ss.value); });
      g.append(b);
    });
    body.append(g);
    const leg=el("div","cal-leg"); leg.append(el("span","l0","faible"),el("i"),el("span","l1","excellent")); body.append(leg);
    body.append(el("p","note","Jours 1 à 16 : prévisions météo. Au-delà (~) : simple tendance d'après la saison et la lune, à revoir quand la météo sera connue."));
    body.append(detail);
    const first=cells.slice(0,16).reduce((a,b)=>b.score>a.score?b:a,cells[0]); g.querySelectorAll(".cal-day")[cells.indexOf(first)]?.click();
  }
  ps.addEventListener("change",draw); ss.addEventListener("change",draw);
  draw();
}
function showDay(box,c,p,sp){
  box.innerHTML="";
  box.append(el("h3",null,c.d.toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long"})+" · "+Math.round(c.score*100)+" %"+(c.trend?" (tendance)":"")));
  if(c.f){
    const top=c.f.per.filter(x=>!x.closed&&x.at!=null).sort((a,b)=>b.best-a.best).slice(0,3);
    const l=el("div","cal-sp"); top.forEach(x=>l.append(el("span",null,x.name+" "+Math.round(x.best*100)+" % · "+hh(x.from)+"–"+hh(x.to)))); box.append(l);
    box.append(el("p","note",[c.moon,"eau ~"+c.f.water.toFixed(0)+" °C",c.f.rain>=1?"pluie "+c.f.rain.toFixed(0)+" mm":"sec","vent max "+Math.round(c.f.wind)+" km/h"].join(" · ")));
    const days=Math.round((new Date(c.k+"T12:00:00")-new Date(dayKey(new Date())+"T12:00:00"))/864e5);
    if(days>=1&&days<=7) box.append(btn("⏰ Réveil pêche pour ce jour","btn primary small",()=>wake({k:c.k,placeId:p.id,sp})));
  }else box.append(el("p","note",c.moon+" · la météo de ce jour n'est pas encore connue."));
}

/* ---------- Réveil pêche ---------- */
async function travel(from,to){
  // durée en voiture (OSRM), sinon estimation à vol d'oiseau
  try{
    const r=await fetch("https://router.project-osrm.org/route/v1/driving/"+from.lon+","+from.lat+";"+to.lon+","+to.lat+"?overview=false");
    const d=await r.json(); if(d.routes?.[0]) return {min:Math.round(d.routes[0].duration/60),km:d.routes[0].distance/1000,real:true};
  }catch(e){}
  const R=6371, r=Math.PI/180, x=Math.sin((to.lat-from.lat)*r/2)**2+Math.cos(from.lat*r)*Math.cos(to.lat*r)*Math.sin((to.lon-from.lon)*r/2)**2;
  const km=2*R*Math.asin(Math.sqrt(x))*1.3; return {min:Math.round(km/60*60+5),km,real:false};
}
const getPos=()=>new Promise(res=>{ if(!navigator.geolocation) return res(null); navigator.geolocation.getCurrentPosition(p=>res({lat:+p.coords.latitude.toFixed(5),lon:+p.coords.longitude.toFixed(5)}),()=>res(null),{timeout:10000,maximumAge:300000}); });
async function wake(pre){
  const {sh,close}=sheet("⏰ Réveil pêche","wake-sheet");
  sh.append(el("p","note","Choisis ton spot pour le jour J : l'appli trouve le meilleur créneau, calcule le trajet et règle le réveil."));
  const f=el("div","wake-form");
  const fld=(label,input)=>{ const x=el("label","field",label); x.append(input); return x; };
  const ds=el("select"); for(let i=1;i<=7;i++){ const d=new Date(Date.now()+i*864e5); ds.append(new Option(i===1?"Demain, "+d.toLocaleDateString("fr-FR",{weekday:"long",day:"numeric"}):d.toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"short"}),dayKey(d))); }
  if(pre?.k) ds.value=pre.k;
  const pl=places(); const ps=el("select"); pl.forEach(p=>ps.append(new Option(p.name,p.id)));
  ps.value=pre?.placeId||get("cdj-wake-place",pl.find(p=>p.spot)?.id||pl[0]?.id); if(![...ps.options].some(o=>o.value===ps.value)) ps.value=pl[0]?.id;
  const ss=el("select"); ss.append(new Option("La meilleure espèce du jour","")); SP().forEach(n=>ss.append(new Option(n,n))); ss.value=pre?.sp??get("cdj-wake-sp","");
  const ms=el("select"); [[15,"15 min"],[30,"30 min"],[45,"45 min"],[60,"1 h"],[90,"1 h 30"]].forEach(([v,t])=>ms.append(new Option(t,v))); ms.value=get("cdj-wake-margin","45");
  const home=JSON.parse(get("cdj-home","null")||"null");
  const fs=el("select"); fs.append(new Option("📡 Ma position actuelle","pos")); if(home) fs.append(new Option("🏠 Mon domicile","home")); fs.value=home?"home":"pos";
  const r1=el("div","row2"); r1.append(fld("Jour",ds),fld("Spot",ps));
  const r2=el("div","row2"); r2.append(fld("Espèce visée",ss),fld("Marge avant le créneau",ms));
  f.append(r1,r2,fld("Départ de",fs));
  const sv=btn(home?"🏠 Remplacer mon domicile par ma position":"🏠 Enregistrer ma position comme domicile","linkbtn small",async()=>{ const p=await getPos(); if(!p) return toast("Autorise la localisation"); set("cdj-home",JSON.stringify(p)); toast("Domicile enregistré sur ce téléphone"); if(![...fs.options].some(o=>o.value==="home")) fs.append(new Option("🏠 Mon domicile","home")); fs.value="home"; calc(); });
  f.append(sv);
  sh.append(f);
  const res=el("div","wake-res"); sh.append(res);
  const mine=el("div","wake-list"); sh.append(mine);
  let plan=null;
  async function calc(){
    set("cdj-wake-place",ps.value); set("cdj-wake-sp",ss.value); set("cdj-wake-margin",ms.value);
    res.innerHTML=""; res.append(el("p","note","Calcul du créneau et du trajet…")); plan=null;
    const p=pl.find(x=>x.id===ps.value); if(!p){ res.textContent="Choisis un spot."; return; }
    let days; try{ days=await ADV().forecastDays(p.lat,p.lon,8); }catch(e){ res.innerHTML=""; res.append(el("p","warn","Prévisions indisponibles (pas de réseau ?).")); return; }
    const day=days.find(d=>d.k===ds.value); const best=pickSp(day,ss.value);
    if(!best){ res.innerHTML=""; res.append(el("p","warn",ss.value?ss.value+" : fermé ou pas de bon créneau ce jour-là.":"Pas de prévision pour ce jour.")); return; }
    const home2=JSON.parse(get("cdj-home","null")||"null");
    const from=fs.value==="home"&&home2?home2:(await getPos())||home2;
    const t=from?await travel(from,p):{min:0,km:0,real:false};
    const slot=new Date(ds.value+"T00:00:00"); slot.setHours(Math.floor(best.from),Math.round(best.from%1*60),0,0);
    const wakeAt=new Date(slot.getTime()-(t.min+Number(ms.value))*6e4);
    plan={wakeAt,slot,best,p,t};
    res.innerHTML="";
    const card=el("div","wake-card");
    card.append(el("div","wk-time",pad(wakeAt.getHours())+":"+pad(wakeAt.getMinutes())));
    const info=el("div","wk-info");
    info.append(el("b",null,best.name+" · créneau "+hh(best.from)+"–"+hh(best.to)+" ("+Math.round(best.best*100)+" %)"),
      el("span",null,"📍 "+p.name+(from?" · 🚗 "+(t.min>=60?Math.floor(t.min/60)+" h "+pad(t.min%60):t.min+" min")+(t.real?"":" (estimé)")+" · "+Math.round(t.km)+" km":" · trajet inconnu (localisation refusée)")),
      el("span",null,"⏳ "+ms.value+" min pour te préparer avant le créneau"));
    card.append(info); res.append(card);
    if(wakeAt<new Date()){ res.append(el("p","warn","Ce réveil serait déjà passé : choisis un autre jour ou réduis la marge.")); return; }
    const act=el("div","actions wake-act");
    const android=/Android/i.test(navigator.userAgent);
    if(android){
      const a=el("a","btn primary","⏰ Mettre l'alarme du téléphone");
      a.href="intent:#Intent;action=android.intent.action.SET_ALARM;i.android.intent.extra.alarm.HOUR="+wakeAt.getHours()+";i.android.intent.extra.alarm.MINUTES="+wakeAt.getMinutes()+";S.android.intent.extra.alarm.MESSAGE="+encodeURIComponent("🎣 "+best.name+" à "+p.name)+";B.android.intent.extra.alarm.SKIP_UI=false;end";
      act.append(a);
    }
    act.append(btn("🔔 Me réveiller par notification",android?"btn":"btn primary",saveAlarm));
    res.append(act);
    res.append(el("p","note",android?"L'alarme du téléphone sonne même en silencieux : c'est la plus sûre. Elle s'ouvre dans l'appli Horloge pour confirmer. La notification sert de rappel en plus.":"Sur iPhone, l'appli ne peut pas régler l'horloge : la notification sonnera à l'heure dite, avec le son des notifications."));
  }
  async function saveAlarm(){
    if(!plan) return;
    const {error}=await A.sb.from("wake_alarms").insert({user_id:A.me.id,fire_at:plan.wakeAt.toISOString(),title:"⏰ Debout, c'est l'heure ! 🎣",body:plan.best.name+" à "+plan.p.name+" · créneau "+hh(plan.best.from)+"–"+hh(plan.best.to)+(plan.t.min?" · "+plan.t.min+" min de route":""),spot_id:plan.p.spot?.id||null});
    if(error) return toast(frError(error));
    toast("Réveil programmé à "+pad(plan.wakeAt.getHours())+":"+pad(plan.wakeAt.getMinutes())); list();
  }
  async function list(){
    mine.innerHTML="";
    const {data}=await A.sb.from("wake_alarms").select("id,fire_at,body").is("sent_at",null).gte("fire_at",new Date().toISOString()).order("fire_at");
    if(!data?.length) return;
    mine.append(el("h3",null,"Mes réveils programmés"));
    data.forEach(w=>{ const r=el("div","wk-row"); const d=new Date(w.fire_at);
      r.append(el("span",null,d.toLocaleDateString("fr-FR",{weekday:"short",day:"numeric"})+" "+pad(d.getHours())+":"+pad(d.getMinutes())+" · "+w.body));
      r.append(btn("Annuler","linkbtn danger",async()=>{ const {error}=await A.sb.from("wake_alarms").delete().eq("id",w.id); if(error) return toast(frError(error)); list(); })); mine.append(r); });
  }
  [ds,ps,ss,ms,fs].forEach(x=>x.addEventListener("change",calc));
  calc(); list();
}
A.calendar=calendar; A.wake=wake;

/* ---------- Boutons sur l'écran Aujourd'hui ---------- */
function mount(){
  const day=$("#td-day"); if(!day||$("#td-tools")) return;
  const r=el("div","td-tools"); r.id="td-tools";
  r.append(btn("📅 Calendrier du mois","btn small",calendar),btn("⏰ Réveil pêche","btn small",()=>wake()));
  day.after(r);
}
mount(); setTimeout(mount,800);
})();
