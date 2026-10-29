// Coup du Jour : stock d'appâts (bouillettes, maïs, amorces…), alerte avant une session carpe.
(function(){
"use strict";
const A=window.CDJ; if(!A) return;
const {el,toast,frError,confirmBtn}=A;
const $=s=>document.querySelector(s);
function btn(label,cls,fn){ const b=el("button",cls||"btn",label); b.type="button"; if(fn) b.addEventListener("click",fn); return b; }
const UNITS=["kg","g","L","sachets","boîtes","pots","pièces"];
const STEP={kg:.5,g:100,L:.5,sachets:1,"boîtes":1,pots:1,"pièces":1};
const IDEAS=["Bouillettes","Maïs","Graines (chènevis, blé)","Pellets","Amorce","Esches (pop-up, wafters)","Bouillettes à tremper","Asticots","Vers"];
const fmt=x=>String(Math.round(Number(x)*100)/100).replace(".",",");
let items=null;
const isLow=i=>i.low_at!=null&&Number(i.qty)<=Number(i.low_at);
async function load(){
  if(!A.me){ items=[]; return items; }
  const {data,error}=await A.sb.from("bait_stock").select("id,name,unit,qty,low_at,updated_at").order("name");
  items=error?[]:(data||[]); return items;
}
async function save(i,patch){
  Object.assign(i,patch);
  const {error}=await A.sb.from("bait_stock").update({...patch,updated_at:new Date().toISOString()}).eq("id",i.id);
  if(error) toast(frError(error));
}

/* ---------- Panneau Profil > Matos ---------- */
async function panel(){
  const box=$("#bait-stock"); if(!box) return;
  if(!A.me){ box.hidden=true; return; }
  box.hidden=false;
  await load();
  box.innerHTML="";
  box.append(el("h2",null,"🥣 Stock d'appâts"));
  const low=items.filter(isLow);
  if(low.length) box.append(el("p","warn","Stock bas : "+low.map(i=>i.name+" ("+fmt(i.qty)+" "+i.unit+")").join(", ")+". Pense à racheter avant ta prochaine session."));
  if(!items.length) box.append(el("p","note","Note ce que tu as en réserve : l'appli te prévient quand un appât passe sous ton seuil, au moment de lancer une session carpe et la veille d'une sortie prévue."));
  const list=el("div","stock-list");
  items.forEach(i=>{
    const r=el("div","stock-row"+(isLow(i)?" low":""));
    const l=el("div","stock-l"); l.append(el("b",null,i.name));
    const thr=el("button","linkbtn stock-thr",i.low_at!=null?"alerte sous "+fmt(i.low_at)+" "+i.unit:"définir une alerte");
    thr.type="button";
    thr.addEventListener("click",async()=>{ const v=prompt("Me prévenir quand il reste moins de combien de "+i.unit+" ? (vide pour aucune alerte)",i.low_at!=null?fmt(i.low_at):""); if(v===null) return; const n=v.trim()===""?null:Number(v.replace(",",".")); if(n!=null&&!(n>=0)) return toast("Nombre invalide"); await save(i,{low_at:n}); panel(); });
    l.append(thr);
    const q=el("div","stock-q");
    const st=STEP[i.unit]||1;
    const minus=btn("−","btn small",async()=>{ await save(i,{qty:Math.max(0,Math.round((Number(i.qty)-st)*100)/100)}); panel(); });
    const val=el("button","stock-v",fmt(i.qty)+" "+i.unit); val.type="button"; val.title="Modifier la quantité";
    val.addEventListener("click",async()=>{ const v=prompt("Quantité de « "+i.name+" » ("+i.unit+") :",fmt(i.qty)); if(v===null) return; const n=Number(v.replace(",",".")); if(!(n>=0)) return toast("Nombre invalide"); await save(i,{qty:n}); panel(); });
    const plus=btn("+","btn small",async()=>{ await save(i,{qty:Math.round((Number(i.qty)+st)*100)/100}); panel(); });
    q.append(minus,val,plus);
    r.append(l,q,confirmBtn("🗑","Supprimer ?",async()=>{ const {error}=await A.sb.from("bait_stock").delete().eq("id",i.id); if(error) return toast(frError(error)); panel(); },"linkbtn danger"));
    list.append(r);
  });
  box.append(list);
  // ajout
  const f=el("form","stock-add");
  const ni=el("input"); ni.maxLength=60; ni.placeholder="Appât (ex. Bouillettes scopex 20 mm)"; ni.required=true; ni.setAttribute("list","stock-ideas");
  const dl=el("datalist"); dl.id="stock-ideas"; IDEAS.forEach(x=>dl.append(new Option(x)));
  const qi=el("input"); qi.type="number"; qi.min="0"; qi.step="any"; qi.inputMode="decimal"; qi.placeholder="Qté";
  const us=el("select"); UNITS.forEach(u=>us.append(new Option(u,u)));
  const li=el("input"); li.type="number"; li.min="0"; li.step="any"; li.inputMode="decimal"; li.placeholder="Alerte sous";
  const ok=el("button","btn primary small","Ajouter"); ok.type="submit";
  f.append(ni,dl,qi,us,li,ok);
  f.addEventListener("submit",async e=>{
    e.preventDefault(); ok.disabled=true;
    const {error}=await A.sb.from("bait_stock").insert({user_id:A.me.id,name:ni.value.trim(),unit:us.value,qty:qi.value?Number(qi.value):0,low_at:li.value?Number(li.value):null});
    ok.disabled=false;
    if(error) return toast(frError(error));
    toast("Ajouté au stock"); panel();
  });
  box.append(f);
}

/* ---------- Session carpe : alerte au lancement, consommation à la fin ---------- */
async function carpDrawn(box,active){
  box.querySelector(".stock-warn")?.remove();
  if(!A.me) return;
  if(!items) await load();
  if(!box.isConnected) return;
  const low=items.filter(isLow);
  if(!active){
    if(!low.length) return;
    const w=el("div","stock-warn");
    w.append(el("b",null,"🥣 Stock bas avant ta session"),el("div",null,low.map(i=>i.name+" : "+fmt(i.qty)+" "+i.unit).join(" · ")));
    box.prepend(w);
  }else if(items.length){
    const w=el("div","stock-warn soft");
    w.append(btn("🥣 Noter ce que j'ai utilisé","linkbtn",()=>usage()));
    const end=[...box.querySelectorAll(".actions")].pop(); (end||box).before(w);
  }
}
function usage(){
  if(!items?.length) return;
  const back=el("div","sheet-back"); const sh=el("div","sheet"); sh.setAttribute("role","dialog"); sh.setAttribute("aria-modal","true");
  const close=()=>back.remove();
  const head=el("div","sheet-head"); head.append(el("h2",null,"🥣 Appâts utilisés")); const x=btn("✕","icon-btn",close); x.setAttribute("aria-label","Fermer"); head.append(x);
  sh.append(head, el("p","note","Indique ce que tu as consommé pendant la session : le stock est mis à jour."));
  const f=el("form","stock-usage"); const ins=[];
  items.forEach(i=>{ const r=el("label","stock-urow"); r.append(el("span",null,i.name+" (reste "+fmt(i.qty)+" "+i.unit+")")); const n=el("input"); n.type="number"; n.min="0"; n.step="any"; n.inputMode="decimal"; n.placeholder=i.unit; r.append(n); ins.push([i,n]); f.append(r); });
  const ok=el("button","btn primary","Mettre à jour le stock"); ok.type="submit"; f.append(ok);
  f.addEventListener("submit",async e=>{
    e.preventDefault(); ok.disabled=true;
    for(const [i,n] of ins){ const v=Number(String(n.value).replace(",",".")); if(v>0) await save(i,{qty:Math.max(0,Math.round((Number(i.qty)-v)*100)/100)}); }
    close(); const low=items.filter(isLow);
    toast(low.length?"Stock mis à jour · à racheter : "+low.map(i=>i.name).join(", "):"Stock mis à jour");
    if(!$("#v-profil").hidden) panel();
  });
  sh.append(f); back.append(sh); back.addEventListener("click",e=>{ if(e.target===back) close(); });
  document.body.append(back);
}
A.stock={load,usage,low:async()=>(await load()).filter(isLow)};

const prevDrawn=A.hooks.carpDrawn; A.hooks.carpDrawn=(box,active)=>{ prevDrawn?.(box,active); carpDrawn(box,active); };
const prevEnded=A.hooks.carpEnded; A.hooks.carpEnded=()=>{ prevEnded?.(); if(items?.length) setTimeout(usage,400); };
const prevProfil=A.hooks.profil; A.hooks.profil=()=>{ prevProfil?.(); panel(); };
if(A.me&&!$("#v-profil").hidden) panel();
})();
