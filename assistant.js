// Rivio : assistant montage (3 questions, sous la carte du jour) et « Mes conditions gagnantes »
// (analyse de la météo enregistrée avec tes prises et tes bilans, espèce par espèce).
(function(){
"use strict";
const A=window.CDJ; if(!A) return;
const {el,toast}=A;
const $=s=>document.querySelector(s);
function btn(label,cls,fn){ const b=el("button",cls||"btn",label); b.type="button"; if(fn) b.addEventListener("click",fn); return b; }
const nrm=x=>String(x||"").normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase().trim();
const get=(k,d)=>{ try{ return localStorage.getItem(k)??d; }catch(e){ return d; } };
const set=(k,v)=>{ try{ localStorage.setItem(k,v); }catch(e){} };
const SPID=name=>{ const n=nrm(name); return n.includes("black")?"bass":["brochet","sandre","perche","silure","chevesne","carpe"].find(k=>n.startsWith(k))||null; };
const favs=()=>{ try{ return JSON.parse(localStorage.getItem("cdj-fav")||"[]"); }catch(_){ return []; } };

/* =================== Assistant montage =================== */
const POSTES={
  def:[["bordure","🌿 Bordure, herbiers"],["profond","🕳️ Profond, cassures"],["courant","🌀 Courant"],["obstacles","🪵 Bois, obstacles"]],
  carpe:[["bordure","🌿 Près du bord, herbiers"],["profond","🕳️ Loin ou profond"],["courant","🌀 Rivière, courant"],["obstacles","🪵 Obstacles, bois"]],
};
const TECHS={
  def:[["leurre","🐟 Aux leurres"],["vif","🪝 Vif ou poisson mort"],["finesse","🎯 Finesse (drop-shot, texas)"]],
  chevesne:[["leurre","🐟 Petits leurres"],["surface","🦗 Surface (insectes)"],["appat","🍞 Appâts naturels"]],
  carpe:[["fond","⚫ Appât au fond"],["popup","🔴 Pop-up (appât flottant)"],["zig","〰️ Entre deux eaux (zig)"]],
};
// montages par espèce : leurre / appât, plombée, fil, nœuds conseillés (identifiants des fiches nœuds)
const RIG={
  brochet:{
    leurre:{bordure:["Jerkbait suspending ou spinnerbait 12-15 cm","plombée légère, leurre qui nage à 0,5-1,5 m"],profond:["Shad 12-18 cm sur tête plombée","tête 15-30 g selon la profondeur"],courant:["Cuillère tournante n°4-5 ou shad lesté","tête 20-30 g pour tenir dans le courant"],obstacles:["Swimbait en montage texan ou spinnerbait (anti-herbe)","plomb texan 10-20 g"]},
    vif:{bordure:["Vif de 12-18 cm sous flotteur 10-20 g, potence acier, triple n°4","flotteur réglé 30 cm au-dessus des herbiers"],profond:["Poisson mort manié ou vif posé au plomb coulissant","plomb 20-40 g"],courant:["Vif au plomb coulissant ou paternoster","plomb 40-60 g"],obstacles:["Vif sous flotteur en bordure d'obstacle","flotteur 10-15 g, pas trop près du bois"]},
    finesse:{bordure:["Finesse 12 cm en texan non plombé ou weightless","hameçon texan 4/0-5/0"],profond:["Shad 10-12 cm en ned ou tête légère","tête 10-14 g, lent"],courant:["Shad 10 cm tête 14-21 g","au contact du fond"],obstacles:["Texas 12 cm, hameçon 5/0","plomb balle 7-14 g"]},
    fil:"Tresse 20-30/100 + bas de ligne acier 7x7 ou fluorocarbone 60-80/100 (40-60 cm)",nodes:["albright","palomar"]},
  sandre:{
    leurre:{bordure:["Shad 7-10 cm en linéaire lent (surtout à la tombée de la nuit)","tête 5-10 g"],profond:["Shad ou finesse 7-12 cm, petits sauts sur le fond","tête 10-21 g"],courant:["Shad 7-10 cm en verticale ou linéaire","tête 20-28 g"],obstacles:["Shad en texan ou tête anti-croche","tête 10-14 g"]},
    vif:{bordure:["Petit vif (gardon 8-10 cm) au flotteur à la tombée de la nuit","flotteur 4-8 g"],profond:["Petit vif ou poisson mort posé au plomb coulissant","plomb 20-40 g, hameçon simple n°2"],courant:["Vif en paternoster","plomb 30-60 g"],obstacles:["Vif posé en bordure d'obstacle","plomb 20 g, fil 30/100"]},
    finesse:{bordure:["Ned rig 7 cm","tête 5-7 g"],profond:["Drop-shot, leurre 7 cm","plomb 10-20 g, 30-50 cm sous l'hameçon"],courant:["Drop-shot plomb lourd","plomb 20-28 g"],obstacles:["Texas 7-10 cm","plomb balle 7-10 g"]},
    fil:"Tresse 10-14/100 + bas de ligne fluorocarbone 30-35/100 (1 à 1,5 m)",nodes:["uni","palomar","dropshot"]},
  perche:{
    leurre:{bordure:["Petit crank ou spinner 4-6 cm, cuillère n°2","léger : 3-7 g"],profond:["Shad 5-7 cm","tête 5-10 g"],courant:["Cuillère n°2-3 ou shad lesté","tête 7-10 g"],obstacles:["Petit texas ou ned rig","plomb 3-5 g"]},
    vif:{bordure:["Ver ou petit vif sous flotteur","flotteur 1-3 g"],profond:["Vers ou petit vif posé","plomb 10-20 g"],courant:["Vers au toc ou au plomb","plomb 5-15 g"],obstacles:["Vif au flotteur près du bois","flotteur 2 g"]},
    finesse:{bordure:["Drop-shot leurre 5-6 cm","plomb 5-7 g"],profond:["Drop-shot ou ned rig","plomb 7-14 g"],courant:["Drop-shot plomb plus lourd","plomb 10-14 g"],obstacles:["Ned rig ou micro-texas","tête 3-5 g"]},
    fil:"Tresse 6-10/100 + bas de ligne fluorocarbone 20-25/100",nodes:["uni","palomar","dropshot"]},
  bass:{
    leurre:{bordure:["Spinnerbait ou crank peu plongeant; popper ou frog en surface","3/8 à 1/2 oz"],profond:["Jig ou crank plongeant","jig 10-14 g"],courant:["Crank ou chatterbait","10-14 g"],obstacles:["Texas ou jig dans le bois et les herbiers","plomb 7-14 g"]},
    vif:{bordure:["Vers ou petit vif sous flotteur","flotteur 2-4 g"],profond:["Vif posé","plomb 10-20 g"],courant:["Vif au plomb","plomb 10-20 g"],obstacles:["Vif au flotteur en bordure du bois","flotteur 3 g"]},
    finesse:{bordure:["Wacky worm","non plombé"],profond:["Drop-shot ou ned rig","plomb 7-10 g"],courant:["Ned rig","tête 5-7 g"],obstacles:["Texas finesse","plomb balle 3-7 g"]},
    fil:"Tresse 14-20/100 + bas de ligne fluorocarbone 30-35/100",nodes:["palomar","texas"]},
  silure:{
    leurre:{bordure:["Gros shad 20-25 cm ou swimbait","tête 30-60 g"],profond:["Gros shad en verticale ou leurre au clonk","tête 60-150 g"],courant:["Gros shad lesté dans les veines d'eau","tête 80-150 g"],obstacles:["Shad 20 cm, tête renforcée","tête 40-80 g"]},
    vif:{bordure:["Vif (gardon, carpeau) à la bouée ou sous flotteur","flotteur 40-60 g"],profond:["Vif posé ou montage à la bouée","plomb 100-200 g"],courant:["Montage à l'ancre et à la bouée","plomb 150-300 g"],obstacles:["Vif à la bouée au bord de l'obstacle","garde de 1 m sous la surface"]},
    finesse:{bordure:["Shad 15 cm en texan lourd","plomb 20-40 g"],profond:["Shad 15-20 cm en verticale","tête 60-100 g"],courant:["Shad 15 cm, tête lourde","80-120 g"],obstacles:["Texas lourd","plomb 30-40 g"]},
    fil:"Tresse 50-80/100 + bas de ligne tresse ou fluorocarbone 100/100",nodes:["palomar"]},
  chevesne:{
    leurre:{bordure:["Petit crank ou poisson nageur 3-5 cm","1-4 g"],profond:["Cuillère n°1-2","3-5 g"],courant:["Cuillère n°2 ou petit nageur coulant","4-6 g, lancer en amont"],obstacles:["Petit nageur sous les branches","2-4 g"]},
    surface:{bordure:["Insecte artificiel ou sauterelle à la volante","sans plomb, laisse dériver"],profond:["Sauterelle ou cerise à la volante","sans plomb"],courant:["Insecte posé en amont, dérive naturelle","sans plomb"],obstacles:["Insecte sous les branches en surplomb","sans plomb"]},
    appat:{bordure:["Pain, cerise ou fromage","petit flotteur 1-2 g"],profond:["Fromage ou pain au plomb","plomb 5-10 g"],courant:["Pain ou ver au toc","plombée 3-6 g"],obstacles:["Cerise ou pain à la volante","sans plomb"]},
    fil:"Nylon 16-20/100, ou tresse 8/100 + fluorocarbone 18-20/100",nodes:["palomar","uni"]},
  carpe:{
    fond:{bordure:["Bouillette de fond 15-20 mm ou tiger nut, bas de ligne cheveu","plomb 70-90 g en clip"],profond:["Bouillette de fond, montage hélicoptère","plomb 90-120 g"],courant:["Bouillette dure ou tiger nut, clip plomb","plomb 120-150 g"],obstacles:["Combi-rig, bouillette de fond","plomb 90 g largable"]},
    popup:{bordure:["Pop-up sur chod rig (herbiers, fond encombré)","plomb 70-90 g"],profond:["Pop-up sur D-rig ou ronnie","plomb 90-120 g"],courant:["Pop-up court sur clip plomb","plomb 120-150 g"],obstacles:["Ronnie rig, pop-up 15 mm","plomb 90 g largable"]},
    zig:{bordure:["Zig rig : mousse ou pop-up à la profondeur où tournent les carpes","plomb 70-90 g"],profond:["Zig rig long (jusqu'aux 3/4 de la profondeur)","plomb 90 g"],courant:["Zig peu adapté au courant : préfère un pop-up court","plomb 120 g"],obstacles:["Zig court au-dessus des herbiers","plomb 70 g"]},
    fil:"Corps de ligne nylon 30-35/100 + leader 50 lb ; bas de ligne tresse gainée 15-25 lb",nodes:["bases","cheveu"]},
};
const CARP_NODE={fond:{obstacles:"combi",profond:"helico",courant:"clip",bordure:"cheveu"},popup:{bordure:"chod",profond:"drig",courant:"clip",obstacles:"ronnie"},zig:{}};
function cond(){
  const s=window.CDJ_ADVICE?.snapshot?.(), T=window.CDJ_TODAY, h=new Date().getHours();
  const clarity=s?.clarity||(T?.clarity==="teintée"?"teintee":T?.clarity)||"claire";
  const phase=s?.phase||(h<8||h>=19?"nuit":"jour");
  return {clarity,phase,water:s?.water??T?.water??12,wind:s?.wind??T?.wind??8,cloud:s?.cloud??50};
}
function colorAdvice(c,id){
  if(id==="carpe") return c.clarity==="trouble"?"Appâts très visibles et odorants (jaune, blanc, rose fluo) ou forte attractivité":c.clarity==="claire"?"Couleurs naturelles et discrètes (marron, beige), peu d'amorce":"Pop-up contrastée sur appât naturel (snowman)";
  if(c.phase==="nuit") return "Noir ou blanc : la silhouette compte plus que la couleur";
  if(c.phase==="aube"||c.phase==="crep") return c.clarity==="trouble"?"Noir, chartreuse ou blanc nacré":"Blanc nacré, argenté ou fluo";
  if(c.clarity==="claire") return c.cloud>=65?"Naturel à reflets (ablette, gardon)":"Naturel et discret (perche, gardon, transparent pailleté)";
  if(c.clarity==="teintee") return "Contrasté : firetiger, dos foncé ventre clair, orange";
  return "Flashy ou sombre (chartreuse, noir, rouge) avec beaucoup de vibrations";
}
function animAdvice(c,id){
  if(id==="carpe") return c.water<10?"Eau froide : petits appâts, amorçage léger, change de poste si rien en 2 h":c.water>20?"Eau chaude : pêche tôt, tard et la nuit, près des zones oxygénées":"Amorçage régulier en petites quantités sur ton poste";
  if(c.water<8) return "Eau froide : très lent, au contact du fond, longues pauses";
  if(c.water<14) return "Vitesse moyenne, pauses régulières ; la touche vient souvent à la reprise";
  return "Eau chaude : récupération plus rapide et réactive, prospecte large";
}
function plan(id,poste,tech){
  const R=RIG[id]; if(!R) return null;
  const t=R[tech]||R[Object.keys(R)[0]], v=t?.[poste]||Object.values(t)[0];
  const c=cond();
  const nodes=[...R.nodes]; if(id==="carpe"){ const n=CARP_NODE[tech]?.[poste]||(tech==="zig"?"zig":null); if(n) nodes.unshift(n); }
  else if(tech==="finesse"&&(poste==="obstacles")) nodes.unshift("texas");
  else if(tech==="finesse"&&(poste==="profond"||poste==="courant")) nodes.unshift("dropshot");
  return {lure:v[0],lead:v[1],line:R.fil,color:colorAdvice(c,id),anim:animAdvice(c,id),nodes:[...new Set(nodes)].filter(n=>A.knots?.list?.some(k=>k.id===n)),c};
}
const CLAR={claire:"eau claire",teintee:"eau teintée",trouble:"eau trouble"}, PH={aube:"aube",jour:"plein jour",crep:"crépuscule",nuit:"nuit"};
function assistantCard(){
  const box=el("section","asst"); box.id="asst";
  let open=get("cdj-asst-open","0")==="1";
  const head=btn("","asst-head",()=>{ open=!open; set("cdj-asst-open",open?"1":"0"); render(); });
  const body=el("div","asst-body");
  box.append(head,body);
  const st={step:0,sp:null,poste:null,tech:null};
  const all=(window.CDJ_ADVICE?.species()||[]).filter(n=>SPID(n));
  function chips(opts,cur,fn){ const g=el("div","asst-chips"); opts.forEach(([k,t])=>{ const b=btn(t,"asst-chip"+(k===cur?" on":""),()=>fn(k)); g.append(b); }); return g; }
  function render(){
    head.innerHTML=""; head.append(el("span",null,"🧰 Assistant montage"), el("span","note",open?"▴":"3 questions ▾")); head.setAttribute("aria-expanded",String(open));
    body.hidden=!open; body.innerHTML=""; if(!open) return;
    const id=st.sp?SPID(st.sp):null;
    const dots=el("div","asst-steps"); ["Espèce","Poste","Technique"].forEach((t,i)=>{ const d=el("span","asst-dot"+(i<st.step?" done":i===st.step?" cur":""),(i+1)+". "+t); dots.append(d); }); body.append(dots);
    if(st.step===0){
      body.append(el("p","asst-q","Quelle espèce vises-tu ?"));
      const f=favs().map(nrm);
      const opts=[...all.filter(n=>f.includes(nrm(n))),...all.filter(n=>!f.includes(nrm(n)))].map(n=>[n,(f.includes(nrm(n))?"⭐ ":"")+n]);
      body.append(chips(opts,st.sp,k=>{ st.sp=k; st.step=1; st.poste=null; st.tech=null; render(); }));
    }else if(st.step===1){
      body.append(el("p","asst-q","Où pêches-tu ?"));
      body.append(chips(POSTES[id]||POSTES.def,st.poste,k=>{ st.poste=k; st.step=2; render(); }));
    }else if(st.step===2){
      body.append(el("p","asst-q","Comment veux-tu pêcher ?"));
      body.append(chips(TECHS[id]||TECHS.def,st.tech,k=>{ st.tech=k; st.step=3; render(); }));
    }else{
      const p=plan(id,st.poste,st.tech);
      if(!p){ body.append(el("p","note","Pas encore de montage pour cette espèce.")); }
      else{
        const res=el("div","asst-res");
        res.append(el("p","asst-ctx","Pour "+st.sp.toLowerCase()+", "+(POSTES[id]||POSTES.def).find(x=>x[0]===st.poste)[1].replace(/^\S+\s/,"").toLowerCase()+", aujourd'hui : "+CLAR[p.c.clarity]+", "+PH[p.c.phase]+", eau à "+Number(p.c.water).toFixed(0)+" °C."));
        const line=(ic,k,v)=>{ const r=el("div","asst-line"); r.append(el("span","al-i",ic)); const t=el("div"); t.append(el("b",null,k),el("span",null,v)); r.append(t); res.append(r); };
        line("🎣",id==="carpe"?"Appât et montage":"Leurre ou appât",p.lure);
        line("⚖️","Plombée",p.lead);
        line("🎨","Coloris",p.color);
        line("🧵","Fil",p.line);
        line("💡","Animation",p.anim);
        body.append(res);
        if(p.nodes.length){
          const nk=el("div","asst-knots"); nk.append(el("span","label","Nœuds et montages"));
          p.nodes.forEach(n=>{ const k=A.knots.list.find(x=>x.id===n); nk.append(btn("🪢 "+k.t,"btn small",()=>A.knots.open(k))); });
          body.append(nk);
        }
      }
      const a=el("div","actions");
      const g=A.guides?.list?.find(t=>nrm(t.n)===nrm(st.sp));
      if(g) a.append(btn("📘 Fiche technique "+st.sp,"btn small",()=>A.guides.open(g)));
      a.append(btn("↺ Recommencer","linkbtn",()=>{ st.step=0; st.sp=null; render(); }));
      body.append(a);
    }
    if(st.step>0&&st.step<3) body.append(btn("← Retour","linkbtn",()=>{ st.step--; render(); }));
  }
  render();
  return box;
}
function placeAssistant(){
  const day=$("#td-day"); if(!day||$("#asst")) return;
  day.after(assistantCard());
}
placeAssistant();
window.addEventListener("cdj-today",()=>{ if(!$("#asst")) placeAssistant(); });

/* =================== Mes conditions gagnantes =================== */
const FACT=[
  ["pression","📉","Pression",c=>c.dp==null?null:c.dp<=-1?"en baisse":c.dp>=1?"en hausse":"stable"],
  ["eau","🌡️","Eau",c=>c.water==null?null:c.water<8?"moins de 8 °C":c.water<12?"8 à 12 °C":c.water<16?"12 à 16 °C":c.water<20?"16 à 20 °C":"plus de 20 °C"],
  ["moment","🕒","Moment",c=>({aube:"à l'aube",jour:"en journée",crep:"au crépuscule",nuit:"de nuit"})[c.phase]||null],
  ["ciel","☁️","Ciel",c=>c.cloud==null?null:(c.rain>=0.3?"pluie":c.cloud>=65?"couvert":c.cloud>=35?"voilé":"ensoleillé")],
  ["vent","💨","Vent",c=>c.wind==null?null:c.wind<8?"calme":c.wind<=20?"modéré":"fort"],
  ["eau_c","💧","Clarté",c=>c.clarity?({claire:"claire",teintee:"teintée",trouble:"trouble"})[c.clarity]:null],
];
let wins=null, wSeq=0, wP=null;
function loadWins(force){
  if(!A.me) return Promise.resolve(null);
  if(wins&&!force) return Promise.resolve(wins);
  if(wP) return wP;
  wP=computeWins().finally(()=>{ wP=null; });
  return wP;
}
async function computeWins(){
  const s=++wSeq;
  const [{data:p},{data:se}]=await Promise.all([
    A.sb.from("posts").select("species,conditions,created_at").eq("user_id",A.me.id).not("conditions","is",null).order("created_at",{ascending:false}).limit(500),
    A.sb.from("sessions").select("species,caught,conditions,created_at").eq("user_id",A.me.id).not("conditions","is",null).order("created_at",{ascending:false}).limit(500)]);
  if(s!==wSeq) return wins;
  const by=new Map();
  const add=(sp,c,ok)=>{ if(!sp||!c) return; const k=sp.trim(); const key=[...by.keys()].find(x=>nrm(x)===nrm(k))||k; if(!by.has(key)) by.set(key,{catch:[],blank:[]}); by.get(key)[ok?"catch":"blank"].push(c); };
  (p||[]).forEach(r=>add(r.species,r.conditions,true));
  (se||[]).forEach(r=>add(r.species,r.conditions,r.caught!==false));
  const out=[];
  by.forEach((v,sp)=>{
    if(v.catch.length<3) return;
    const facts=[];
    FACT.forEach(([key,ic,lab,fn])=>{
      const cnt=new Map(), bl=new Map(); let tot=0;
      v.catch.forEach(c=>{ const b=fn(c); if(b){ cnt.set(b,(cnt.get(b)||0)+1); tot++; } });
      v.blank.forEach(c=>{ const b=fn(c); if(b) bl.set(b,(bl.get(b)||0)+1); });
      if(tot<3) return;
      const [best,n]=[...cnt.entries()].sort((a,b)=>b[1]-a[1])[0];
      const share=n/tot; if(share<0.45||n<2) return;
      const blanks=bl.get(best)||0;
      facts.push({key,ic,lab,val:best,n,tot,share,rate:v.blank.length?n/(n+blanks):null,fn});
    });
    facts.sort((a,b)=>b.share-a.share);
    out.push({sp,n:v.catch.length,blanks:v.blank.length,facts});
  });
  out.sort((a,b)=>b.n-a.n);
  wins=out; return out;
}
function matchToday(w){
  const s=window.CDJ_ADVICE?.snapshot?.(); if(!s||!w?.facts.length) return null;
  const ok=w.facts.filter(f=>f.fn(s)===f.val);
  return {ok:ok.length,of:w.facts.length,list:ok};
}
async function winsPanel(){
  let box=$("#gagnantes");
  const host=$("#carnet"); if(!host||!A.me){ box?.remove(); return; }
  if(!box){ box=el("div","panel gagnantes"); box.id="gagnantes"; box.dataset.sub="moi"; host.after(box); }
  box.innerHTML=""; box.append(el("h2",null,"🏅 Mes conditions gagnantes"), el("p","note","Rivio compare la météo enregistrée avec tes prises et tes bilans, espèce par espèce."));
  const list=await loadWins(true); if(!box.isConnected) return;
  if(!list?.length){ box.append(el("p","note","Il faut au moins 3 prises (ou bilans réussis) d'une même espèce avec la météo en direct pour voir tes conditions gagnantes. Publie tes prises depuis le bord de l'eau : la météo est enregistrée toute seule.")); return; }
  list.slice(0,6).forEach(w=>{
    const c=el("article","win-card");
    const h=el("div","win-h"); h.append(el("b",null,"🐟 "+w.sp), el("span","note",w.n+" prise"+(w.n>1?"s":"")+(w.blanks?" · "+w.blanks+" capot"+(w.blanks>1?"s":""):"")+" analysée"+(w.n+w.blanks>1?"s":"")));
    c.append(h);
    if(!w.facts.length) c.append(el("p","note","Pas encore de tendance nette : tes prises sont réparties dans des conditions variées."));
    const m=matchToday(w);
    w.facts.forEach(f=>{
      const r=el("div","win-f"+(m?.list.includes(f)?" now":""));
      r.append(el("span","wf-i",f.ic), el("span","wf-t",f.lab+" : "+f.val), el("span","wf-n",f.n+"/"+f.tot+(f.rate!=null?" · réussite "+Math.round(f.rate*100)+" %":"")));
      const bar=el("i","wf-bar"); bar.style.setProperty("--p",Math.round(f.share*100)+"%"); r.append(bar);
      c.append(r);
    });
    if(m) c.append(el("p","win-today"+(m.ok>=Math.ceil(m.of*0.6)?" good":""),(m.ok>=Math.ceil(m.of*0.6)?"✅ ":"")+"Aujourd'hui : "+m.ok+" condition"+(m.ok>1?"s":"")+" sur "+m.of+" réunie"+(m.ok>1?"s":"")+"."));
    box.append(c);
  });
  if(list.length&&list.every(w=>w.blanks===0)) box.append(el("p","note","Astuce : fais aussi un bilan quand tu rentres bredouille. Rivio pourra calculer ton taux de réussite selon les conditions."));
}
const prevP=A.hooks.profil; A.hooks.profil=()=>{ prevP?.(); winsPanel(); };
window.addEventListener("hashchange",()=>{ if(location.hash==="#profil"&&A.me&&!$("#gagnantes")) winsPanel(); });
if(A.me&&$("#carnet")) winsPanel();
// carte du jour : signaler quand les conditions ressemblent à tes meilleures journées
const prevDE=A.hooks.dayExtras; A.hooks.dayExtras=(slot,T)=>{
  prevDE?.(slot,T);
  if(!A.me||!wins) return;
  const f=favs().map(nrm);
  const w=wins.find(x=>f.includes(nrm(x.sp)))||wins[0]; if(!w) return;
  const m=matchToday(w); if(!m||m.ok<Math.ceil(m.of*0.6)) return;
  const b=btn("","win-hint",()=>{ location.hash="#profil"; document.querySelector('#profil-sub [data-s="moi"]')?.click(); setTimeout(()=>$("#gagnantes")?.scrollIntoView({behavior:"smooth"}),200); });
  b.append(el("b",null,"✅ Ça ressemble à tes meilleures journées de "+w.sp.toLowerCase()), el("span","note",m.list.map(x=>x.lab.toLowerCase()+" "+x.val).join(" · ").replace("moment ","")));
  slot.append(b);
};
const prevCh=A.hooks.change; A.hooks.change=(...a)=>{ prevCh?.(...a); if(A.me&&!wins) loadWins().then(()=>window.CDJ_ADVICE?.rerender?.()); if(!A.me) wins=null; };
if(A.me) loadWins().then(()=>window.CDJ_ADVICE?.rerender?.());
A.wins={load:loadWins,panel:winsPanel};
})();
