// Coup du Jour : Fishdex, la collection des espèces prises par chaque pêcheur.
(function(){
"use strict";
const A=window.CDJ; if(!A) return;
const {el,toast,frError,userLabel}=A;
const $=s=>document.querySelector(s);
const fmt=n=>Number(n).toLocaleString("fr-FR");

// Catalogue : numéro, nom, nom latin, rareté (1 à 3), couleur, silhouette
const DEX=[
  ["Brochet","Esox lucius",2,"#6f8f3a","long"],
  ["Sandre","Sander lucioperca",2,"#8a9a7b","spiny"],
  ["Perche","Perca fluviatilis",1,"#5f8a2e","spiny"],
  ["Black-bass","Micropterus salmoides",2,"#4f7a3a","spiny"],
  ["Silure","Silurus glanis",3,"#4b5560","cat"],
  ["Carpe","Cyprinus carpio",2,"#b88a2e","deep"],
  ["Chevesne","Squalius cephalus",1,"#7d8a96","slim"],
  ["Aspe","Leuciscus aspius",3,"#8fa3b5","long"],
  ["Truite fario","Salmo trutta",2,"#a0703a","long"],
  ["Barbeau","Barbus barbus",2,"#9a8458","slim"],
  ["Tanche","Tinca tinca",2,"#4e6b2e","deep"],
  ["Brème","Abramis brama",1,"#9c9472","deep"],
  ["Gardon","Rutilus rutilus",1,"#8d9cab","slim"],
  ["Rotengle","Scardinius erythrophthalmus",1,"#b0874a","slim"],
  ["Carassin","Carassius carassius",1,"#b9963c","deep"],
  ["Ablette","Alburnus alburnus",1,"#a9b8c6","slim"],
  ["Vandoise","Leuciscus leuciscus",2,"#93a4b0","slim"],
  ["Amour blanc","Ctenopharyngodon idella",3,"#7c8a5a","long"],
].map(([name,latin,rare,color,shape],i)=>({n:i+1,name,latin,rare,color,shape}));
const RARE=["","Commun","Peu commun","Rare"];

const norm=s=>String(s||"").normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase().trim();
const ALIAS={"truite":"Truite fario","bass":"Black-bass","blackbass":"Black-bass","black bass":"Black-bass","amour":"Amour blanc","carpe miroir":"Carpe","carpe commune":"Carpe","carpe cuir":"Carpe","breme":"Brème"};
function entryOf(species){
  const k=norm(species); if(!k) return null;
  let e=DEX.find(d=>norm(d.name)===k);
  if(!e&&ALIAS[k]) e=DEX.find(d=>d.name===ALIAS[k]);
  if(!e) e=DEX.find(d=>k.startsWith(norm(d.name)));
  return e||null;
}

// Silhouettes (viewBox 100 x 50)
const SHAPES={
  slim:{b:"M8 25C20 12 50 10 72 18L90 10L86 25L90 40L72 32C50 40 20 38 8 25Z",f:"M42 13L50 4L57 14ZM46 36L52 43L57 35Z"},
  long:{b:"M4 26C16 18 52 16 74 20L92 12L88 26L92 40L74 32C52 36 16 34 4 26Z",f:"M62 18L68 9L73 19ZM62 33L68 41L73 32Z"},
  spiny:{b:"M8 26C18 12 48 8 72 18L90 10L86 26L90 42L72 34C48 42 18 40 8 26Z",f:"M28 14L31 4L34 12L37 3L40 11L43 4L46 11L49 6L52 13ZM56 14L62 8L67 16Z"},
  deep:{b:"M8 27C16 8 52 4 72 18L90 10L86 27L90 44L72 36C52 48 16 46 8 27Z",f:"M34 10L42 2L64 12ZM46 44L52 49L58 42Z"},
  cat:{b:"M5 24C10 13 40 14 70 20L95 16L95 31L70 30C40 36 10 35 5 24Z",f:"M38 33L70 30L70 36L40 37Z",w:"M7 21L-1 12M7 26L-1 34"},
};
function fishSvg(e,caught){
  const sh=SHAPES[e.shape];
  const ns="http://www.w3.org/2000/svg";
  const svg=document.createElementNS(ns,"svg"); svg.setAttribute("viewBox","-4 0 104 50"); svg.setAttribute("aria-hidden","true");
  const mk=(d,fill,extra)=>{ const p=document.createElementNS(ns,"path"); p.setAttribute("d",d); p.setAttribute("fill",fill); if(extra) for(const [k,v] of Object.entries(extra)) p.setAttribute(k,v); svg.append(p); };
  const c=caught?e.color:"currentColor";
  mk(sh.f,c,{opacity:caught?".75":"1"});
  mk(sh.b,c);
  if(sh.w) mk(sh.w,"none",{stroke:c,"stroke-width":"1.6","stroke-linecap":"round"});
  if(caught){
    const eye=document.createElementNS(ns,"circle"); eye.setAttribute("cx",e.shape==="cat"?"14":"17"); eye.setAttribute("cy",e.shape==="cat"?"22":"23"); eye.setAttribute("r","2.6"); eye.setAttribute("fill","#0d2b25"); svg.append(eye);
  }
  return svg;
}

// Agrège les prises (posts publiés + bilans avec poisson) par espèce
function collect(rows){
  const m=new Map();
  rows.forEach(r=>{
    const e=entryOf(r.species); if(!e) return;
    const x=m.get(e.n)||{n:0,best:null,bestW:null,first:null};
    x.n++;
    if(r.length_cm&&(!x.best||Number(r.length_cm)>x.best)) x.best=Number(r.length_cm);
    if(r.weight_kg&&(!x.bestW||Number(r.weight_kg)>x.bestW)) x.bestW=Number(r.weight_kg);
    if(!x.first||r.created_at<x.first) x.first=r.created_at;
    m.set(e.n,x);
  });
  return m;
}
function grid(found,who){
  const g=el("div","dex-grid");
  DEX.forEach(e=>{
    const x=found.get(e.n);
    const c=el("button","dex-card"+(x?" got":"")+(x&&e.rare===3?" rare":"")); c.type="button";
    c.addEventListener("click",()=>openSpecies(e,x,who));
    c.append(el("span","dex-n","#"+String(e.n).padStart(3,"0")));
    const art=el("div","dex-art"); art.append(fishSvg(e,!!x)); c.append(art);
    c.append(el("span","dex-name",x?e.name:"???"));
    c.append(el("span","dex-rare","★".repeat(e.rare)+"☆".repeat(3-e.rare)));
    if(x){
      c.append(el("span","dex-meta","×"+x.n+(x.best?" · "+fmt(x.best)+" cm":"")));
      c.title=e.name+" ("+e.latin+") · "+RARE[e.rare]+" · 1re prise le "+new Date(x.first).toLocaleDateString("fr-FR",{day:"numeric",month:"long",year:"numeric"});
      c.setAttribute("aria-label",e.name+", pris "+x.n+" fois"+(x.best?", record "+fmt(x.best)+" centimètres":""));
    }else c.setAttribute("aria-label","Espèce numéro "+e.n+" pas encore prise, voir la fiche");
    g.append(c);
  });
  return g;
}
function progress(found){
  const n=found.size, w=el("div","dex-prog");
  const bar=el("div","dex-bar"); const i=el("i"); i.style.width=Math.round(n/DEX.length*100)+"%"; bar.append(i);
  w.append(el("span","dex-count",n+"/"+DEX.length), bar);
  return w;
}

/* ---------- Trophées automatiques ---------- */
// rows : prises (posts + bilans) ; carp : sessions carpe avec leurs événements ; sess : tous les bilans (capots compris)
function catchesOf(rows,carp){
  const list=rows.map(r=>({sp:entryOf(r.species)?.name||r.species,len:Number(r.length_cm)||0,kg:Number(r.weight_kg)||0,at:new Date(r.created_at)}));
  (carp||[]).forEach(cs=>(cs.carp_events||[]).filter(e=>e.kind==="prise").forEach(e=>list.push({sp:"Carpe",len:0,kg:Number(e.weight_kg)||0,at:new Date(e.at),session:cs.id})));
  return list;
}
const day=d=>d.getFullYear()+"-"+d.getMonth()+"-"+d.getDate();
const TROPHIES=[
  ["bapteme","🎣","Baptême","Ta toute première prise",s=>s.c.length>=1],
  ["double","✌️","Doublé","2 prises le même jour",s=>{ const m=new Map(); return s.c.some(c=>{ const k=day(c.at); m.set(k,(m.get(k)||0)+1); return m.get(k)>=2; }); }],
  ["levetot","🌅","Lève-tôt","Une prise avant 7 h",s=>s.c.some(c=>c.at.getHours()<7&&c.at.getHours()>=4)],
  ["nuit","🦉","Oiseau de nuit","Une prise entre 22 h et 4 h",s=>s.c.some(c=>c.at.getHours()>=22||c.at.getHours()<4)],
  ["hiver","🧊","Pêcheur d'hiver","Une prise en décembre, janvier ou février",s=>s.c.some(c=>[11,0,1].includes(c.at.getMonth()))],
  ["silure","🐋","Premier silure","Ton premier silure",s=>s.c.some(c=>c.sp==="Silure")],
  ["metre","📏","Métré","Un brochet de 100 cm ou plus",s=>s.c.some(c=>c.sp==="Brochet"&&c.len>=100)],
  ["monstre","🐉","Monstre","Un silure de 150 cm ou plus",s=>s.c.some(c=>c.sp==="Silure"&&c.len>=150)],
  ["cochon","🐷","Gros cochon","Une carpe de 15 kg ou plus",s=>s.c.some(c=>c.sp==="Carpe"&&c.kg>=15)],
  ["sandre","🎯","Sandre XXL","Un sandre de 70 cm ou plus",s=>s.c.some(c=>c.sp==="Sandre"&&c.len>=70)],
  ["perche","⭐","Perche record","Une perche de 40 cm ou plus",s=>s.c.some(c=>c.sp==="Perche"&&c.len>=40)],
  ["folie","🔥","Session de folie","5 carpes dans une même session",s=>{ const m=new Map(); return s.c.some(c=>c.session&&(m.set(c.session,(m.get(c.session)||0)+1),m.get(c.session)>=5)); }],
  ["collection","🌈","Collectionneur","5 espèces différentes",s=>s.species>=5],
  ["maitre","👑","Maître du Fishdex","10 espèces différentes",s=>s.species>=10],
  ["regulier","📆","Régulier","10 sorties enregistrées",s=>s.outings>=10],
  ["centurion","💯","Centurion","100 prises",s=>s.c.length>=100],
  ["capots","😵","Pas de bol","10 capots d'affilée",s=>{ let run=0, best=0; s.sess.slice().sort((a,b)=>new Date(a.created_at)-new Date(b.created_at)).forEach(x=>{ run=x.caught===false?run+1:0; best=Math.max(best,run); }); return best>=10; }],
].map(([id,e,name,desc,test])=>({id,e,name,desc,test}));
function trophiesOf(rows,carp,sessAll,found){
  const st={c:catchesOf(rows,carp),sess:sessAll||[],species:found.size,outings:(sessAll||[]).length+(carp||[]).length+rows.filter(r=>r.kind==="post").length};
  return TROPHIES.filter(t=>{ try{ return t.test(st); }catch(e){ return false; } }).map(t=>t.id);
}
function trophyGrid(ids){
  const g=el("div","troph-grid");
  TROPHIES.forEach(t=>{
    const got=ids.includes(t.id);
    const c=el("div","troph"+(got?" got":""));
    c.append(el("span","troph-e",got?t.e:"🔒"), el("span","troph-n",t.name), el("span","troph-d",t.desc));
    c.setAttribute("aria-label",t.name+" : "+t.desc+(got?", obtenu":", pas encore obtenu"));
    g.append(c);
  });
  return g;
}
function announce(ids){
  if(!A.me) return;
  const key="cdj-troph-"+A.me.id;
  let seen=null; try{ seen=JSON.parse(localStorage.getItem(key)||"null"); }catch(e){}
  try{ localStorage.setItem(key,JSON.stringify(ids)); }catch(e){}
  if(!seen) return;                    // première fois : pas d'avalanche d'annonces
  const fresh=ids.filter(i=>!seen.includes(i));
  fresh.forEach((i,k)=>{ const t=TROPHIES.find(x=>x.id===i); setTimeout(()=>toast("🏆 Nouveau trophée : "+t.e+" "+t.name),600+k*3000); });
}

/* ---------- Mon Fishdex (Profil) ---------- */
let mySeq=0;
async function myDex(){
  const box=$("#dex"); if(!box) return;
  if(!A.me){ box.hidden=true; return; }
  box.hidden=false;
  const s=++mySeq;
  const [{data:p},{data:se},{data:cs}]=await Promise.all([
    A.sb.from("posts").select("species,length_cm,weight_kg,created_at").eq("user_id",A.me.id).eq("status","published").limit(2000),
    A.sb.from("sessions").select("species,caught,length_cm,created_at").eq("user_id",A.me.id).limit(2000),
    A.sb.from("carp_sessions").select("id,started_at,carp_events(kind,at,weight_kg)").eq("user_id",A.me.id).limit(500),
  ]);
  if(s!==mySeq) return;
  const rows=[...(p||[]).filter(x=>x.species).map(x=>({...x,kind:"post"})),...(se||[]).filter(x=>x.caught!==false&&x.species)];
  const found=collect(rows);
  const troph=trophiesOf(rows,cs||[],se||[],found);
  announce(troph);
  box.innerHTML="";
  const h=el("div","g-sec-head"); h.append(el("h2",null,"Mon Fishdex")); box.append(h);
  box.append(progress(found));
  box.append(el("p","note",found.size?"Chaque nouvelle espèce publiée dans le fil ou notée dans un bilan se débloque ici.":"Ta collection est vide : publie ta première prise pour débloquer une espèce."));
  box.append(grid(found));
  const th=el("div","g-sec-head"); th.append(el("h2",null,"Mes trophées"), el("span","note",troph.length+"/"+TROPHIES.length)); box.append(th);
  box.append(trophyGrid(troph));
}

/* ---------- Fishdex du groupe (onglet Groupe) ---------- */
let gSeq=0;
async function groupDex(host,gid){
  const s=++gSeq;
  const [{data:mem},{data:p},{data:se},{data:cs}]=await Promise.all([
    A.sb.from("memberships").select("user_id,profiles(username,is_admin)").eq("group_id",gid).eq("status","active"),
    A.sb.from("posts").select("user_id,species,length_cm,weight_kg,created_at").eq("group_id",gid).eq("status","published").limit(3000),
    A.sb.from("sessions").select("user_id,species,caught,length_cm,created_at").eq("group_id",gid).limit(3000),
    A.sb.from("carp_sessions").select("id,user_id,started_at,carp_events(kind,at,weight_kg)").eq("group_id",gid).limit(1000),
  ]);
  if(s!==gSeq||!host.isConnected) return;
  const rows=[...(p||[]).filter(x=>x.species).map(x=>({...x,kind:"post"})),...(se||[]).filter(x=>x.caught!==false&&x.species)];
  const people=(mem||[]).map(m=>{
    const mine=rows.filter(r=>r.user_id===m.user_id), f=collect(mine);
    const tr=trophiesOf(mine,(cs||[]).filter(c=>c.user_id===m.user_id),(se||[]).filter(x=>x.user_id===m.user_id),f);
    return {id:m.user_id,p:m.profiles,found:f,troph:tr};
  })
    .sort((a,b)=>b.found.size-a.found.size||String(a.p?.username).localeCompare(String(b.p?.username)));
  host.innerHTML="";
  const sec=el("section","g-sec");
  const hd=el("div","g-sec-head"); hd.append(el("h2",null,"Fishdex du groupe"), el("span","note",DEX.length+" espèces à collectionner"));
  sec.append(hd);
  const groupFound=collect(rows);
  const all=el("button","dex-row group"); all.type="button";
  all.append(el("span","dex-who","🌍 Tout le groupe"), el("span","dex-count",groupFound.size+"/"+DEX.length));
  all.addEventListener("click",()=>openSheet("Collection du groupe",groupFound));
  const list=el("div","dex-list"); list.append(all);
  const medal=["🥇","🥈","🥉"];
  people.forEach((x,i)=>{
    const r=el("button","dex-row"); r.type="button";
    const who=el("span","dex-who"); who.append(el("span","rk-pos",x.found.size?(medal[i]||String(i+1)):"·")); who.append(userLabel(x.p?.username,x.p?.is_admin,A.roleOf(gid,x.id)));
    const bar=el("div","dex-bar"); const b=el("i"); b.style.width=Math.round(x.found.size/DEX.length*100)+"%"; bar.append(b);
    r.append(who, bar, el("span","dex-count",x.found.size+"/"+DEX.length), el("span","dex-tr","🏆 "+x.troph.length));
    r.setAttribute("aria-label","Fishdex de @"+(x.p?.username||"?")+" : "+x.found.size+" espèces sur "+DEX.length);
    r.addEventListener("click",()=>openSheet("Fishdex de @"+(x.p?.username||"?"),x.found,x.troph));
    list.append(r);
  });
  sec.append(list);
  host.append(sec);
}
/* ---------- Fiche espèce ---------- */
const MONTHS=["J","F","M","A","M","J","J","A","S","O","N","D"];
const LVL=["Faible","Moyenne","Bonne","Top"];
let spSheet=null;
function closeSp(){ if(spSheet){ spSheet.remove(); spSheet=null; document.removeEventListener("keydown",escSp,true); } }
function escSp(e){ if(e.key==="Escape"){ e.stopPropagation(); closeSp(); } }
async function openSpecies(e,x,who){
  closeSp();
  const info=(window.CDJ_SPECIES_INFO||{})[e.name]||{};
  spSheet=el("div","sheet-back sp-back");
  const sh=el("div","sheet sp-sheet"); sh.setAttribute("role","dialog"); sh.setAttribute("aria-modal","true"); sh.setAttribute("aria-label","Fiche "+e.name);
  const head=el("div","sheet-head"); head.append(el("span","dex-n","#"+String(e.n).padStart(3,"0")));
  const cl=el("button","icon-btn"); cl.type="button"; cl.setAttribute("aria-label","Fermer"); cl.innerHTML='<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>'; cl.addEventListener("click",closeSp);
  head.append(cl); sh.append(head);
  const hero=el("div","sp-hero"+(x?" got":"")); const art=el("div","sp-art"); art.append(fishSvg(e,true)); hero.append(art);
  const ht=el("div"); ht.append(el("h2",null,e.name), el("div","sp-latin",e.latin), el("div","dex-rare","★".repeat(e.rare)+"☆".repeat(3-e.rare)+" · "+RARE[e.rare]));
  hero.append(ht); sh.append(hero);
  const st=el("div","sp-status"+(x?" got":""));
  if(x) st.append(el("b",null,(who?who+" : ":"")+"pris "+x.n+" fois"), el("span",null,[x.best?"record "+fmt(x.best)+" cm":null,x.bestW?fmt(x.bestW)+" kg":null,"1re prise le "+new Date(x.first).toLocaleDateString("fr-FR",{day:"numeric",month:"long",year:"numeric"})].filter(Boolean).join(" · ")));
  else st.append(el("b",null,(who?who+" ne l'a":"Pas encore dans ta collection")+(who?" pas encore attrapé":"")), el("span",null,"Publie une prise de cette espèce pour la débloquer."));
  sh.append(st);
  if(info.size){ const f=el("div","sp-fact"); f.append(el("span","label","Taille"),el("span",null,info.size)); sh.append(f); }
  if(info.about) sh.append(el("h4","g-sub","Comportement"), el("p","sp-p",info.about));
  if(info.habitat) sh.append(el("h4","g-sub","Où le trouver"), el("p","sp-p",info.habitat));
  if(info.months){
    sh.append(el("h4","g-sub","Meilleures périodes"));
    const cal=el("div","sp-cal"); cal.setAttribute("role","img");
    cal.setAttribute("aria-label",info.months.map((v,i)=>new Date(2026,i,1).toLocaleDateString("fr-FR",{month:"long"})+" "+LVL[v].toLowerCase()).join(", "));
    const now=new Date().getMonth();
    info.months.forEach((v,i)=>{ const c=el("div","sp-m"+(i===now?" now":"")); const b=el("i","l"+v); b.style.height=(18+v*14)+"px"; c.append(b,el("span",null,MONTHS[i])); cal.append(c); });
    sh.append(cal, el("p","note","Activité du poisson. Vérifie aussi les périodes de fermeture dans Conseils."));
  }
  const list=(t,arr)=>{ if(!arr?.length) return; sh.append(el("h4","g-sub",t)); const ul=el("ul","sp-list"); arr.forEach(a=>ul.append(el("li",null,a))); sh.append(ul); };
  list("Techniques",info.tech); list("Montages et matériel",info.rigs);
  if(info.tip){ const t=el("div","sp-tip"); t.append(el("b",null,"💡 Astuce "),info.tip); sh.append(t); }
  // meilleures prises du groupe
  const best=el("div","sp-best"); best.append(el("h4","g-sub","Meilleures prises "+(A.cur==="all"?"de tous les groupes":"du groupe")), el("p","note","Chargement…"));
  sh.append(best);
  spSheet.append(sh); document.body.append(spSheet);
  spSheet.addEventListener("click",ev=>{ if(ev.target===spSheet) closeSp(); });
  document.addEventListener("keydown",escSp,true);
  if(!A.me) return;
  const names=[e.name,...Object.entries(ALIAS).filter(([,v])=>v===e.name).map(([k])=>k)];
  let qp=A.sb.from("posts").select("user_id,species,length_cm,weight_kg,created_at,profiles(username,is_admin)").eq("status","published").ilike("species",e.name).order("length_cm",{ascending:false,nullsFirst:false}).limit(30);
  let qs=A.sb.from("sessions").select("user_id,species,length_cm,created_at,profiles(username,is_admin)").eq("caught",true).ilike("species",e.name).order("length_cm",{ascending:false,nullsFirst:false}).limit(30);
  if(typeof A.cur==="number"){ qp=qp.eq("group_id",A.cur); qs=qs.eq("group_id",A.cur); }
  const [{data:p},{data:se}]=await Promise.all([qp,qs]);
  if(!best.isConnected) return;
  const rows=[...(p||[]),...(se||[])].filter(r=>r.length_cm||r.weight_kg).sort((a,b)=>(b.length_cm||0)-(a.length_cm||0)||(b.weight_kg||0)-(a.weight_kg||0)).slice(0,5);
  best.lastChild.remove();
  if(!rows.length){ best.append(el("p","note","Aucune prise mesurée pour l'instant. À toi d'ouvrir le classement !")); return; }
  const ol=el("div","list tight rk-list"); const medal=["🥇","🥈","🥉"];
  rows.forEach((r,i)=>{
    const row=el("div","mrow");
    const l=el("div","rk-l"); l.append(el("span","rk-pos",medal[i]||String(i+1)), userLabel(r.profiles?.username,r.profiles?.is_admin));
    row.append(l, el("span","rk-v",[r.length_cm?fmt(r.length_cm)+" cm":null,r.weight_kg?fmt(r.weight_kg)+" kg":null].filter(Boolean).join(" · ")+" · "+new Date(r.created_at).toLocaleDateString("fr-FR",{month:"short",year:"2-digit"})));
    ol.append(row);
  });
  best.append(ol);
}

let sheet=null;
function closeSheet(){ if(sheet){ sheet.remove(); sheet=null; document.removeEventListener("keydown",esc); } }
function esc(e){ if(e.key==="Escape") closeSheet(); }
function openSheet(title,found,troph){
  closeSheet();
  sheet=el("div","sheet-back");
  const sh=el("div","sheet dex-sheet"); sh.setAttribute("role","dialog"); sh.setAttribute("aria-modal","true"); sh.setAttribute("aria-label",title);
  const head=el("div","sheet-head"); head.append(el("h2",null,title));
  const x=el("button","icon-btn"); x.type="button"; x.setAttribute("aria-label","Fermer"); x.innerHTML='<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>'; x.addEventListener("click",closeSheet);
  head.append(x); sh.append(head, progress(found), grid(found,title.replace(/^Fishdex de /,"").replace(/^Collection du groupe$/,"Le groupe")));
  if(troph){ sh.append(el("h4","g-sub","Trophées · "+troph.length+"/"+TROPHIES.length)); sh.append(trophyGrid(troph)); }
  sheet.append(sh); document.body.append(sheet);
  sheet.addEventListener("click",e=>{ if(e.target===sheet) closeSheet(); });
  document.addEventListener("keydown",esc);
}

/* ---------- Accroches ---------- */
const prevProfil=A.hooks.profil;
A.hooks.profil=()=>{ prevProfil?.(); myDex(); };
const prevGX=A.hooks.groupeExtras;
A.hooks.groupeExtras=(box,gid,mod)=>{
  prevGX?.(box,gid,mod);
  const host=el("div","g-dex"); host.dataset.sub="membres"; box.after(host); groupDex(host,gid);
};
const prevChange=A.hooks.change;
A.hooks.change=()=>{ prevChange?.(); if(!A.me){ const d=$("#dex"); if(d) d.hidden=true; } };
A.dex={DEX,entryOf,collect,trophiesOf,TROPHIES,grid,progress,trophyGrid,openSpecies};
if(A.me&&!$("#v-profil").hidden) myDex();
if(A.me&&!$("#v-groupe").hidden) A.hooks.groupe?.();
})();
