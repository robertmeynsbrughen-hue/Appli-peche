// Rivio : écran « Aujourd'hui » (tableau de bord en tête de l'onglet Conseils).
(function(){
"use strict";
const A=window.CDJ; if(!A) return;
const {el}=A;
const $=s=>document.querySelector(s);
function btn(label,cls,fn){ const b=el("button",cls||"btn",label); b.type="button"; if(fn) b.addEventListener("click",fn); return b; }
const view=$("#v-conseils");
const box=el("div","today"); box.id="today";
view.prepend(box);
// le détail météo et conseils est replié derrière la carte du jour
let open=false; try{ open=localStorage.getItem("cdj-today-open")==="1"; }catch(e){}
function setOpen(v){ open=v; view.classList.toggle("detail-open",open); try{ localStorage.setItem("cdj-today-open",open?"1":"0"); }catch(e){} const t=$("#today-toggle"); if(t){ t.textContent=open?"Masquer le détail ▴":"Météo et conseils détaillés ▾"; t.setAttribute("aria-expanded",String(open)); } }
view.classList.add("has-today");

const slot=(id)=>{ let s=box.querySelector("#"+id); if(!s){ s=el("div","today-sec"); s.id=id; box.append(s); } return s; };
const sQuest=slot("td-quest"), sDay=slot("td-day"), sGo=slot("td-go"), sCatch=slot("td-catch"), sOut=slot("td-out");
const WATERS={etang:"Étang / lac",riviere:"Rivière",canal:"Canal"};
const fr=x=>String(x).replace(".",",");
const cap=t=>String(t).charAt(0).toUpperCase()+String(t).slice(1);

/* ---------- Pression réelle et prévision 24 h ---------- */
function pressureBlock(T){
  const P=T.press24;
  const w=el("div","dc-press");
  if(!T.pressure||!P||P.length<2){
    w.append(el("div","dc-k","Pression"),el("div","dc-v","Tendance "+T.trend+(T.live?"":" (exemple)")));
    return w;
  }
  const now=P[0].v, end=P[P.length-1].v, d=end-now;
  const vals=P.map(x=>x.v), lo=Math.min(...vals), hi=Math.max(...vals);
  const head=el("div","dp-head");
  const num=el("div","dp-now"); num.append(el("span","dp-num",String(Math.round(now))),el("span","dp-u","hPa"));
  const side=el("div","dp-side");
  side.append(el("div","dc-k","Pression actuelle"),el("div","dp-trend",cap(T.trend)+" sur 3 h"));
  head.append(num,side); w.append(head);
  // courbe des 24 prochaines heures
  const W=300,Hh=64,pad=4, span=Math.max(hi-lo,2), mid=(hi+lo)/2, y0=mid-span/2;
  const X=i=>pad+i*(W-2*pad)/(P.length-1), Y=v=>Hh-pad-(v-y0)/span*(Hh-2*pad);
  const pts=P.map((p,i)=>X(i).toFixed(1)+","+Y(p.v).toFixed(1)).join(" ");
  const NS="http://www.w3.org/2000/svg";
  const svg=document.createElementNS(NS,"svg"); svg.setAttribute("viewBox","0 0 "+W+" "+Hh); svg.setAttribute("class","dp-svg"); svg.setAttribute("preserveAspectRatio","none");
  svg.setAttribute("role","img"); svg.setAttribute("aria-label","Prévision de pression sur 24 h : de "+Math.round(now)+" à "+Math.round(end)+" hPa");
  const area=document.createElementNS(NS,"polygon"); area.setAttribute("points",X(0)+","+Hh+" "+pts+" "+X(P.length-1)+","+Hh); area.setAttribute("class","dp-area");
  const line=document.createElementNS(NS,"polyline"); line.setAttribute("points",pts); line.setAttribute("class","dp-line");
  const dot=document.createElementNS(NS,"circle"); dot.setAttribute("cx",X(0)); dot.setAttribute("cy",Y(now)); dot.setAttribute("r","3.5"); dot.setAttribute("class","dp-dot");
  svg.append(area,line,dot);
  const chart=el("div","dp-chart"); chart.append(svg);
  const axis=el("div","dp-axis"); P.forEach((p,i)=>{ if(i%6===0||i===P.length-1) axis.append(el("span",null,i===0?"Maint.":String(p.h).padStart(2,"0")+"h")); });
  chart.append(axis); w.append(chart);
  const foot=el("div","dp-foot");
  foot.append(el("span",null,"Dans 24 h : "+Math.round(end)+" hPa ("+(d>=0?"+":"")+fr(d.toFixed(1))+")"),el("span",null,"Min "+Math.round(lo)+" · max "+Math.round(hi)));
  w.append(foot);
  const tip=d<=-4?"Forte baisse annoncée : carnassiers souvent actifs avant la dégradation.":d<=-1.5?"Baisse annoncée : en général favorable aux mordées.":d>=4?"Forte remontée annoncée (front froid) : poissons plus prudents, pêche plus fine.":d>=1.5?"Remontée annoncée : activité souvent en recul.":"Pression stable : conditions régulières sur la journée.";
  w.append(el("div","dp-tip",tip));
  if(!T.pressMsl) w.append(el("div","dp-note","Pression mesurée au sol (ancienne donnée en cache)."));
  return w;
}

/* ---------- Carte du jour : conditions + pression ---------- */
function day(){
  const T=window.CDJ_TODAY;
  sDay.innerHTML="";
  const c=el("button","day-card"); c.type="button"; c.setAttribute("aria-label","Voir la météo et les conseils détaillés");
  if(!T){ c.append(el("div","dc-place","Chargement des conditions…")); }
  else{
    const top=el("div","dc-top");
    const t=el("div","dc-temp"); t.append(el("span","dc-num",T.water.toFixed(1).replace(".",",")),el("span","dc-u","°C"));
    const side=el("div","dc-side");
    side.append(el("div","dc-k",(T.water_measured?"Eau mesurée":"Eau estimée")+(T.live?"":" · exemple")),el("div","dc-v",T.sky+" · air "+Math.round(T.air)+" °C · vent "+Math.round(T.wind)+" km/h"),el("div","dc-v2","Eau "+(T.clarity||"")));
    top.append(t,side); c.append(top);
    c.append(pressureBlock(T));
    // Provenance : d'où vient la météo, de quand elle date, eau mesurée ou non.
    const prov=el("div","dc-prov");
    prov.append(el("span",null,"📍 "+String(T.place||"position par défaut").replace(/^📍\s*/,"")));
    prov.append(el("span",null,"🕐 "+(T.when||"à l'instant")+(T.cached?" · hors ligne":"")));
    prov.append(el("span",null,T.water_measured?"🌡️ eau mesurée":"🌡️ eau estimée"));
    c.append(prov);
  }
  c.addEventListener("click",()=>{ setOpen(!open); if(open) setTimeout(()=>$("#v-conseils .conds")?.scrollIntoView({behavior:"smooth",block:"start"}),60); });
  sDay.append(c);
  if(T?.locationFallback){
    const hint=el("div","today-location-hint");
    hint.append(el("b",null,"Lieu non défini : ces scores sont indicatifs."),el("span","note","Choisis ta position ou un spot pour obtenir des conditions locales."),btn("📍 Utiliser ma position GPS","btn primary small",()=>document.querySelector("#locate")?.click()));
    sDay.append(hint);
  }
  const tg=el("button","linkbtn today-toggle"); tg.type="button"; tg.id="today-toggle"; tg.addEventListener("click",()=>setOpen(!open)); sDay.append(tg);
  A.hooks.dayExtras?.(sDay,T);
  setOpen(open);
  quest();
}

/* ---------- Questionnaire : où pêches-tu, que cherches-tu ---------- */
const QKEY="cdj-quete";
let Q={step:1}; try{ Q=JSON.parse(localStorage.getItem(QKEY)||"null")||{step:1}; }catch(e){}
const saveQ=()=>{ try{ localStorage.setItem(QKEY,JSON.stringify(Q)); }catch(e){} };
const go=step=>{ Q.step=step; saveQ(); quest(); };
function setWater(v){ const b=document.querySelector('#water-type button[data-v="'+v+'"]'); if(b&&b.getAttribute("aria-pressed")!=="true") b.click(); }
function openSpecies(id){
  setOpen(true);
  setTimeout(()=>{
    const card=document.querySelector('#list .sp[data-sp="'+id+'"]'); if(!card) return;
    const det=card.querySelector("details.tips"); if(det) det.open=true;
    card.scrollIntoView({behavior:"smooth",block:"start"});
  },80);
}
function choice(label,sub,on,fn){
  const b=el("button","q-opt"+(on?" on":"")); b.type="button"; b.setAttribute("aria-pressed",String(!!on));
  b.append(el("span","q-ol",label)); if(sub) b.append(el("span","q-os",sub));
  b.addEventListener("click",fn); return b;
}
function quest(){
  const T=window.CDJ_TODAY;
  sQuest.innerHTML="";
  const card=el("section","quest"); card.setAttribute("aria-labelledby","q-title");
  const h=el("div","q-head");
  h.append(el("h2",null,"Que cherches-tu aujourd'hui ?")); h.querySelector("h2").id="q-title";
  if(Q.step<3) h.append(el("span","q-step",Q.step+"/2"));
  card.append(h);
  const water=T?.waterType||Q.water||"etang";
  const place=String(T?.place||"position par défaut").replace(/^📍\s*/,"");

  if(Q.step===1||!T){
    card.append(el("p","q-lead","Ton coin de pêche"));
    const where=el("div","q-opts");
    where.append(choice("📍 Je suis au bord de l'eau","position GPS",Q.where==="gps",()=>{ Q.where="gps"; Q.spotId=null; saveQ(); document.querySelector("#locate")?.click(); quest(); }));
    const spots=(A.spots||[]).filter(s=>s.lat!=null&&s.lon!=null);
    if(spots.length){
      const lab=el("label","q-opt q-sel"+(Q.where==="spot"?" on":""));
      lab.append(el("span","q-ol","📌 Un spot du groupe"));
      const sel=el("select"); sel.setAttribute("aria-label","Choisir un spot");
      sel.append(new Option("Choisir…",""));
      spots.forEach(s=>sel.append(new Option(s.name,String(s.id))));
      if(Q.where==="spot"&&Q.spotId) sel.value=String(Q.spotId);
      sel.addEventListener("change",()=>{ const s=spots.find(x=>String(x.id)===sel.value); if(!s) return;
        Q.where="spot"; Q.spotId=s.id; saveQ();
        window.CDJ_ADVICE?.loadAt(s.lat,s.lon,s.name).catch(()=>A.toast?.("Météo indisponible pour ce spot")); quest(); });
      lab.append(sel); where.append(lab);
    }
    card.append(where);
    card.append(el("p","q-lead","Type d'eau"));
    const seg=el("div","seg q-water"); seg.setAttribute("role","group"); seg.setAttribute("aria-label","Type d'eau");
    Object.entries(WATERS).forEach(([k,v])=>{ const b=el("button",null,v); b.type="button"; b.setAttribute("aria-pressed",String(water===k)); b.addEventListener("click",()=>{ Q.water=k; saveQ(); setWater(k); quest(); }); seg.append(b); });
    card.append(seg);
    card.append(el("p","note q-where","Conditions pour : "+place));
    const act=el("div","q-act");
    act.append(btn("Suivant →","btn primary",()=>{ if(!Q.where) Q.where="here"; Q.water=water; go(2); }));
    card.append(act);
  }
  else if(Q.step===2){
    card.append(el("p","q-lead","L'espèce que tu vises"));
    card.append(el("p","note","Classées pour "+place+" · "+WATERS[water]+", sur les 24 prochaines heures."));
    const opts=el("div","q-opts q-species");
    const list=[...T.all].sort((a,b)=>(a.closed-b.closed)||(b.pct-a.pct));
    opts.append(choice("🎲 Ce qui mord le mieux","je prends ce qui vient",Q.sp==="any",()=>{ Q.sp="any"; go(3); }));
    list.forEach(x=>opts.append(choice((x.fav?"⭐ ":"")+x.name,x.closed?"fermeture probable":x.pct+" %"+(x.from?" · "+x.from+"–"+x.to:""),Q.sp===x.id,()=>{ Q.sp=x.id; go(3); })));
    card.append(opts);
    const act=el("div","q-act"); act.append(btn("← Mon coin","btn small",()=>go(1))); card.append(act);
  }
  else{
    const open_=T.all.filter(x=>!x.closed).sort((a,b)=>b.pct-a.pct);
    const any=Q.sp==="any"||!T.all.some(x=>x.id===Q.sp);
    const x=any?(open_[0]||T.all[0]):T.all.find(y=>y.id===Q.sp);
    const res=el("div","q-res");
    const top=el("div","q-rtop");
    const nm=el("div","q-rname"); nm.append(el("span","q-rk",any?"🎲 Ce qui mord le mieux":"🎯 Ta cible"),el("span","q-rn",x.name));
    top.append(nm,el("span","q-rp",x.pct+" %"));
    res.append(top);
    res.append(el("div","q-rwin",x.from?"🕒 Meilleur créneau "+x.from+" – "+x.to:"Aucun créneau vraiment favorable dans les 24 h"));
    // frise 24 h de l'espèce
    const strip=el("div","q-strip"); strip.setAttribute("aria-hidden","true");
    (x.s||[]).forEach((v,k)=>{ const d=el("i",x.b?.[k]?"best":v<.5?"low":null); d.style.height=(20+v*80).toFixed(0)+"%"; strip.append(d); });
    res.append(strip);
    const verdict=x.closed?"Fermeture probable à cette période : vérifie l'arrêté de ton département avant de le cibler.":x.pct>=65?"Bon moment pour le cibler.":x.pct>=45?"Jouable : concentre-toi sur le créneau.":"Journée difficile pour cette espèce.";
    res.append(el("p","q-verdict"+(x.closed?" warn":""),verdict));
    const alt=open_.find(y=>y.id!==x.id);
    if(!any&&alt&&(x.closed||alt.pct>=x.pct+15)){
      const a=btn("Plus facile aujourd'hui : "+alt.name+" ("+alt.pct+" %)","linkbtn q-alt",()=>{ Q.sp=alt.id; go(3); }); res.append(a);
    }
    res.append(el("p","note q-where","📍 "+place+" · "+WATERS[water]));
    card.append(res);
    const act=el("div","q-act");
    act.append(btn("📖 Conseils pour "+x.name.toLowerCase(),"btn primary small",()=>openSpecies(x.id)));
    act.append(btn("Changer ma réponse","btn small",()=>go(1)));
    card.append(act);
  }
  sQuest.append(card);
}

/* ---------- Dernières prises du groupe ---------- */
let outSeq=0, catSeq=0;
async function catches(){
  const seq=++catSeq;
  if(!A.me||!A.groups.length){ sCatch.innerHTML=""; return; }
  let q=A.sb.from("posts").select("id,group_id,species,length_cm,weight_kg,photo_path,photo_paths,created_at,profiles!posts_user_id_fkey(username)").eq("status","published").order("created_at",{ascending:false}).limit(6);
  if(typeof A.cur==="number") q=q.eq("group_id",A.cur);
  const {data}=await q; const rows=data||[];
  if(seq!==catSeq) return;
  if(!rows.length){ sCatch.innerHTML=""; return; }
  const paths=rows.map(r=>(r.photo_paths&&r.photo_paths[0])||r.photo_path).filter(Boolean);
  let urls={};
  if(paths.length){ const {data:s}=await A.sb.storage.from("photos").createSignedUrls(paths,3600); (s||[]).forEach(x=>urls[x.path]=x.signedUrl); }
  if(seq!==catSeq) return;
  sCatch.innerHTML="";
  const h=el("div","today-h"); h.append(el("h2",null,"Dernières prises"),btn("Tout voir","linkbtn",()=>location.hash="#fil")); sCatch.append(h);
  const strip=el("div","catch-strip");
  rows.forEach(r=>{
    const p=(r.photo_paths&&r.photo_paths[0])||r.photo_path;
    const c=el("button","catch-c"); c.type="button";
    const im=el("div","catch-img"); if(p&&urls[p]) im.style.backgroundImage="url('"+urls[p]+"')"; else im.append(el("span",null,"🐟"));
    c.append(im, el("b",null,(r.species||"Prise")+(r.length_cm?" · "+String(r.length_cm).replace(".",",")+" cm":"")), el("span","note","@"+(r.profiles?.username||"?")+" · "+A.ago(r.created_at)));
    c.addEventListener("click",()=>location.hash="#fil");
    strip.append(c);
  });
  sCatch.append(strip);
}

/* ---------- Prochaine sortie prévue ---------- */
async function nextOuting(){
  const seq=++outSeq;
  if(!A.me||!A.groups.length){ sOut.innerHTML=""; return; }
  const out=el("div");
  let q=A.sb.from("outings").select("id,group_id,title,place,start_at").gte("start_at",new Date(Date.now()-2*36e5).toISOString()).order("start_at").limit(1);
  if(typeof A.cur==="number") q=q.eq("group_id",A.cur);
  const {data}=await q; const o=data?.[0];
  if(seq!==outSeq) return;
  const h=el("div","today-h"); h.append(el("h2",null,"Prochaine sortie"));
  out.append(h);
  if(!o){ const r=el("div","out-card empty"); r.append(el("span",null,"Rien de prévu pour l'instant."),btn("Proposer une sortie","btn small",()=>location.hash="#groupe")); out.append(r); sOut.replaceChildren(...out.childNodes); return; }
  const {data:rs}=await A.sb.from("outing_rsvps").select("status").eq("outing_id",o.id);
  if(seq!==outSeq) return;
  const yes=(rs||[]).filter(x=>x.status==="yes").length;
  const d=new Date(o.start_at);
  const r=el("button","out-card"); r.type="button";
  const cal=el("div","out-cal"); cal.append(el("b",null,String(d.getDate())),el("span",null,d.toLocaleDateString("fr-FR",{month:"short"}).replace(".","")));
  const t=el("div","out-t"); t.append(el("b",null,o.title),el("span","note",d.toLocaleDateString("fr-FR",{weekday:"long"})+" "+d.toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"}).replace(":","h")+(o.place?" · "+o.place:"")+" · "+yes+" partant"+(yes>1?"s":"")));
  r.append(cal,t); r.addEventListener("click",()=>location.hash="#groupe");
  out.append(r); sOut.replaceChildren(...out.childNodes);
}

/* ---------- Potes au bord de l'eau + bouton « Je pars pêcher » ---------- */
function mates(){
  // le module « Je pars pêcher » remplit #gofish-conseils : on le place en tête
  const g=$("#gofish-conseils"); if(g&&g.parentNode!==sGo) sGo.append(g);
  const pq=$("#permit-quick"); if(pq&&pq.parentNode!==sGo) sGo.append(pq);
}

function all(){ day(); mates(); catches(); nextOuting(); }
const qPrev=A.hooks.change; A.hooks.change=()=>{ qPrev?.(); if(Q.step===1) quest(); };
window.addEventListener("cdj-today",day);
const prevChange=A.hooks.change; A.hooks.change=()=>{ prevChange?.(); mates(); catches(); nextOuting(); };
all();
setTimeout(mates,800);
})();
