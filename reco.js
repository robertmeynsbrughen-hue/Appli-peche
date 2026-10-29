// Coup du Jour : reconnaissance de l'espèce sur la photo, directement dans le téléphone (modèle CLIP, sans compte).
(function(){
"use strict";
const A=window.CDJ; if(!A) return;
const {el,toast}=A;
const $=s=>document.querySelector(s);
const LIB="https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.0.2";
const MODEL="Xenova/clip-vit-base-patch32";
const READY="cdj-reco-ready";
// libellés anglais (le modèle a appris en anglais) -> espèce de l'appli
const LABELS=[
  ["Brochet","a northern pike, a long green fish with yellow spots and a duck-bill snout"],
  ["Sandre","a zander, a grey-green perch-like fish with glassy eyes and fangs"],
  ["Perche","a European perch with dark vertical stripes and red fins"],
  ["Black-bass","a largemouth bass with a big mouth and a dark lateral stripe"],
  ["Silure","a wels catfish with long whiskers and a huge flat head"],
  ["Carpe","a common carp, a big bronze fish with large scales"],
  ["Chevesne","a European chub, a silver fish with a big head and dark-edged scales"],
  ["Aspe","an asp fish, a slim silver predator with a big mouth"],
  ["Truite fario","a brown trout with red and black spots"],
  ["Barbeau","a barbel fish with whiskers and a long body"],
  ["Tanche","a tench, a dark olive green fish with tiny scales and red eyes"],
  ["Brème","a bream, a deep-bodied flat bronze fish"],
  ["Gardon","a roach, a small silver fish with red eyes"],
  ["Rotengle","a rudd, a golden fish with bright red fins"],
  ["Carassin","a crucian carp, a small golden round fish"],
  ["Ablette","a bleak, a tiny thin silver fish"],
  ["Vandoise","a common dace, a slender silver river fish"],
  ["Amour blanc","a grass carp, a long olive fish with big scales"],
];
let clf=null, loading=null;

function box(){ return $("#p-reco"); }
function ready(){ try{ return localStorage.getItem(READY)==="1"; }catch(e){ return false; } }

async function load(onProgress){
  if(clf) return clf;
  if(loading) return loading;
  loading=(async()=>{
    const T=await import(LIB);
    T.env.allowLocalModels=false;
    const files=new Map();
    const p=await T.pipeline("zero-shot-image-classification",MODEL,{
      dtype:"q8",
      progress_callback:e=>{
        if(e.status==="progress"&&e.file){ files.set(e.file,[e.loaded||0,e.total||0]); }
        let l=0,t=0; files.forEach(([a,b])=>{ l+=a; t+=b; });
        if(t) onProgress?.(l/t,t);
      },
    });
    try{ localStorage.setItem(READY,"1"); }catch(e){}
    clf=p; return p;
  })();
  try{ return await loading; }catch(e){ loading=null; throw e; }
}

function draw(state,data){
  const b=box(); if(!b) return;
  b.innerHTML="";
  if(state==="idle"){
    const go=el("button","btn","🔍 Reconnaître l'espèce"); go.type="button";
    go.addEventListener("click",()=>run(true));
    b.append(go);
    if(!ready()) b.append(el("span","note","1er usage : téléchargement d'environ 150 Mo (une seule fois, Wi-Fi conseillé)"));
  }else if(state==="loading"){
    const bar=el("div","dex-bar"); const i=el("i"); i.style.width=Math.round((data.p||0)*100)+"%"; bar.append(i);
    b.append(el("span","note",data.text), bar);
  }else if(state==="result"){
    b.append(el("span","label","L'IA pense à"));
    const chips=el("div","chips-pick");
    data.forEach((r,k)=>{
      const c=el("button","pick"+(k===0?" on":""),r.name+" · "+Math.round(r.score*100)+" %"); c.type="button";
      c.addEventListener("click",()=>{ setSpecies(r.name); [...chips.children].forEach(x=>x.classList.toggle("on",x===c)); });
      chips.append(c);
    });
    b.append(chips, el("span","note","Touche la bonne espèce si l'IA se trompe. Elle se base sur la 1re photo."));
  }else if(state==="error"){
    b.append(el("span","warn",data));
    const again=el("button","linkbtn","Réessayer"); again.type="button"; again.addEventListener("click",()=>run(true)); b.append(again);
  }
}
function setSpecies(name){
  const sel=$("#p-species"); if(!sel) return;
  if(![...sel.options].some(o=>o.value===name||o.text===name)) return;
  sel.value=name; sel.dispatchEvent(new Event("change",{bubbles:true}));
}
let runId=0;
async function run(user){
  const pics=A.pics||[]; if(!pics.length) return;
  const id=++runId;
  if(!clf&&!navigator.onLine&&!ready()) return draw("error","Pas de réseau pour télécharger l'IA. Réessaie en Wi-Fi.");
  draw("loading",{p:0,text:clf?"Analyse de la photo…":"Préparation de l'IA…"});
  try{
    const c=await load((p,t)=>{ if(id===runId) draw("loading",{p,text:"Téléchargement de l'IA : "+Math.round(p*100)+" % de "+Math.round(t/1048576)+" Mo"}); });
    if(id!==runId) return;
    draw("loading",{p:1,text:"Analyse de la photo…"});
    const url=URL.createObjectURL(pics[0].file);
    let out;
    try{ out=await c(url,LABELS.map(x=>x[1]),{hypothesis_template:"a photo of {}"}); }
    finally{ URL.revokeObjectURL(url); }
    if(id!==runId) return;
    const res=out.map(o=>({name:LABELS.find(x=>x[1]===o.label)?.[0],score:o.score})).filter(o=>o.name).slice(0,3);
    draw("result",res);
    // l'espèce la plus probable est pré-remplie si l'IA est assez sûre et que rien n'est choisi
    const sel=$("#p-species");
    if(res[0]&&res[0].score>=.3&&sel&&!sel.value) setSpecies(res[0].name);
  }catch(e){
    console.warn(e);
    if(id===runId) draw("error",user?"L'IA n'a pas pu se charger sur ce téléphone.":"");
  }
}

const prev=A.hooks.picsChanged;
A.hooks.picsChanged=pics=>{
  prev?.(pics);
  const b=box(); if(!b) return;
  b.hidden=!pics.length;
  if(!pics.length){ runId++; b.innerHTML=""; return; }
  // modèle déjà téléchargé : analyse automatique, sinon on propose le bouton
  if(clf||ready()) run(false); else draw("idle");
};
})();
