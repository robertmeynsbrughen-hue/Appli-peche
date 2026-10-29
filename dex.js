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
function grid(found){
  const g=el("div","dex-grid");
  DEX.forEach(e=>{
    const x=found.get(e.n);
    const c=el("div","dex-card"+(x?" got":"")+(x&&e.rare===3?" rare":""));
    c.append(el("span","dex-n","#"+String(e.n).padStart(3,"0")));
    const art=el("div","dex-art"); art.append(fishSvg(e,!!x)); c.append(art);
    c.append(el("span","dex-name",x?e.name:"???"));
    c.append(el("span","dex-rare","★".repeat(e.rare)+"☆".repeat(3-e.rare)));
    if(x){
      c.append(el("span","dex-meta","×"+x.n+(x.best?" · "+fmt(x.best)+" cm":"")));
      c.title=e.name+" ("+e.latin+") · "+RARE[e.rare]+" · 1re prise le "+new Date(x.first).toLocaleDateString("fr-FR",{day:"numeric",month:"long",year:"numeric"});
      c.setAttribute("aria-label",e.name+", pris "+x.n+" fois"+(x.best?", record "+fmt(x.best)+" centimètres":""));
    }else c.setAttribute("aria-label","Espèce numéro "+e.n+" pas encore prise");
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

/* ---------- Mon Fishdex (Profil) ---------- */
let mySeq=0;
async function myDex(){
  const box=$("#dex"); if(!box) return;
  if(!A.me){ box.hidden=true; return; }
  box.hidden=false;
  const s=++mySeq;
  const [{data:p},{data:se}]=await Promise.all([
    A.sb.from("posts").select("species,length_cm,weight_kg,created_at").eq("user_id",A.me.id).eq("status","published").not("species","is",null).limit(2000),
    A.sb.from("sessions").select("species,length_cm,created_at").eq("user_id",A.me.id).eq("caught",true).not("species","is",null).limit(2000),
  ]);
  if(s!==mySeq) return;
  const found=collect([...(p||[]),...(se||[])]);
  box.innerHTML="";
  const h=el("div","g-sec-head"); h.append(el("h2",null,"Mon Fishdex")); box.append(h);
  box.append(progress(found));
  box.append(el("p","note",found.size?"Chaque nouvelle espèce publiée dans le fil ou notée dans un bilan se débloque ici.":"Ta collection est vide : publie ta première prise pour débloquer une espèce."));
  box.append(grid(found));
}

/* ---------- Fishdex du groupe (onglet Groupe) ---------- */
let gSeq=0;
async function groupDex(host,gid){
  const s=++gSeq;
  const [{data:mem},{data:p},{data:se}]=await Promise.all([
    A.sb.from("memberships").select("user_id,profiles(username,is_admin)").eq("group_id",gid).eq("status","active"),
    A.sb.from("posts").select("user_id,species,length_cm,weight_kg,created_at").eq("group_id",gid).eq("status","published").not("species","is",null).limit(3000),
    A.sb.from("sessions").select("user_id,species,length_cm,created_at").eq("group_id",gid).eq("caught",true).not("species","is",null).limit(3000),
  ]);
  if(s!==gSeq||!host.isConnected) return;
  const rows=[...(p||[]),...(se||[])];
  const people=(mem||[]).map(m=>{ const f=collect(rows.filter(r=>r.user_id===m.user_id)); return {id:m.user_id,p:m.profiles,found:f}; })
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
    r.append(who, bar, el("span","dex-count",x.found.size+"/"+DEX.length));
    r.setAttribute("aria-label","Fishdex de @"+(x.p?.username||"?")+" : "+x.found.size+" espèces sur "+DEX.length);
    r.addEventListener("click",()=>openSheet("Fishdex de @"+(x.p?.username||"?"),x.found));
    list.append(r);
  });
  sec.append(list);
  host.append(sec);
}
let sheet=null;
function closeSheet(){ if(sheet){ sheet.remove(); sheet=null; document.removeEventListener("keydown",esc); } }
function esc(e){ if(e.key==="Escape") closeSheet(); }
function openSheet(title,found){
  closeSheet();
  sheet=el("div","sheet-back");
  const sh=el("div","sheet dex-sheet"); sh.setAttribute("role","dialog"); sh.setAttribute("aria-modal","true"); sh.setAttribute("aria-label",title);
  const head=el("div","sheet-head"); head.append(el("h2",null,title));
  const x=el("button","icon-btn"); x.type="button"; x.setAttribute("aria-label","Fermer"); x.innerHTML='<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>'; x.addEventListener("click",closeSheet);
  head.append(x); sh.append(head, progress(found), grid(found));
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
  const host=el("div","g-dex"); box.after(host); groupDex(host,gid);
};
const prevChange=A.hooks.change;
A.hooks.change=()=>{ prevChange?.(); if(!A.me){ const d=$("#dex"); if(d) d.hidden=true; } };
A.dex={DEX,entryOf};
if(A.me&&!$("#v-profil").hidden) myDex();
if(A.me&&!$("#v-groupe").hidden) A.hooks.groupe?.();
})();
