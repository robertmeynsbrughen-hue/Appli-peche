// Rivio : rangement en sous-onglets (Profil, Groupe).
(function(){
"use strict";
const A=window.CDJ; if(!A) return;
const {el}=A;
const $=s=>document.querySelector(s);
const get=(k,d)=>{ try{ return localStorage.getItem(k)||d; }catch(e){ return d; } };
const set=(k,v)=>{ try{ localStorage.setItem(k,v); }catch(e){} };

function bindBar(bar,host,key,def,onChange){
  const pick=v=>{
    host.dataset.s=v; set(key,v);
    bar.querySelectorAll("[data-s]").forEach(b=>{ const on=b.dataset.s===v; b.setAttribute("aria-selected",String(on)); b.tabIndex=on?0:-1; });
    onChange?.(v);
  };
  bar.querySelectorAll("[data-s]").forEach(b=>b.addEventListener("click",()=>{ pick(b.dataset.s); window.scrollTo({top:0,behavior:"smooth"}); }));
  bar.addEventListener("keydown",e=>{
    if(e.key!=="ArrowRight"&&e.key!=="ArrowLeft") return;
    const tabs=[...bar.querySelectorAll("[data-s]")], i=tabs.findIndex(t=>t.dataset.s===host.dataset.s);
    const n=tabs[(i+(e.key==="ArrowRight"?1:tabs.length-1))%tabs.length]; pick(n.dataset.s); n.focus();
  });
  pick(get(key,def));
}

/* ---------- Profil ---------- */
const pv=$("#v-profil"), pbar=$("#profil-sub");
bindBar(pbar,pv,"cdj-sub-profil","moi");
function syncProfil(){
  const logged=!!A.me;
  pbar.hidden=!logged;
  $("#account-panel").hidden=!logged;
  if(logged){ pv.dataset.s=pv.dataset.s||get("cdj-sub-profil","moi"); pv.classList.add("has-sub"); }
  else pv.classList.remove("has-sub");
  const av=$("#me-av");
  if(av&&A.me&&av.dataset.name!==A.me.username){
    const n=A.me.username; let h=0; for(const c of n) h=(h*31+c.charCodeAt(0))%360;
    av.className="avatar big"; av.dataset.name=n; av.textContent=n.charAt(0); av.style.background="hsl("+h+" 42% 42%)";
  }
}

/* ---------- Groupe ---------- */
const GSUBS=[["activite","📅 Activité"],["infos","📌 Infos"],["env","🌿 Environnement"],["membres","👥 Membres"]];
function groupBar(root){
  if(!root.querySelector("[data-sub]")||root.querySelector(".subbar")) return;
  const bar=el("div","subbar"); bar.setAttribute("role","tablist"); bar.setAttribute("aria-label","Rubriques du groupe");
  GSUBS.forEach(([k,t])=>{ const b=el("button",null,t); b.type="button"; b.setAttribute("role","tab"); b.dataset.s=k; bar.append(b); });
  const anchor=root.querySelector(".todo")||root.querySelector(".g-head");
  if(anchor) anchor.after(bar); else root.prepend(bar);
  root.classList.add("has-sub");
  bindBar(bar,root,"cdj-sub-groupe","activite");
}
const groot=$("#groupe-root");
if(groot) new MutationObserver(()=>groupBar(groot)).observe(groot,{childList:true});

/* ---------- Bulle de chat : en haut à gauche par défaut, déplaçable ---------- */
const fab=$("#chat-fab"), FKEY="cdj-fab-pos";
function placeFab(pos){
  if(!fab) return;
  const W=window.innerWidth, H=window.innerHeight, s=fab.offsetWidth||50, m=10;
  if(!pos){ fab.style.left=""; fab.style.top=""; fab.style.right=""; return; }
  const x=pos.side==="right"?W-s-m:m, y=Math.min(Math.max(pos.y,64),H-s-90);
  fab.style.left=x+"px"; fab.style.top=y+"px"; fab.style.right="auto";
}
let fpos=null; try{ fpos=JSON.parse(localStorage.getItem(FKEY)||"null"); }catch(e){}
if(fab&&!fab.classList.contains("in-head")){
  placeFab(fpos);
  let drag=null, moved=false;
  fab.addEventListener("pointerdown",e=>{ const r=fab.getBoundingClientRect(); drag={dx:e.clientX-r.left,dy:e.clientY-r.top,x0:e.clientX,y0:e.clientY}; moved=false; });
  window.addEventListener("pointermove",e=>{
    if(!drag) return;
    if(!moved&&Math.hypot(e.clientX-drag.x0,e.clientY-drag.y0)<8) return;
    if(!moved){ moved=true; fab.classList.add("dragging"); try{ fab.setPointerCapture(e.pointerId); }catch(_){} }
    fab.style.left=(e.clientX-drag.dx)+"px"; fab.style.top=(e.clientY-drag.dy)+"px"; fab.style.right="auto";
  },{passive:true});
  window.addEventListener("pointerup",e=>{
    if(!drag) return;
    if(moved){
      const r=fab.getBoundingClientRect();
      fpos={side:r.left+r.width/2>window.innerWidth/2?"right":"left",y:r.top};
      try{ localStorage.setItem(FKEY,JSON.stringify(fpos)); }catch(_){}
      placeFab(fpos); fab.classList.remove("dragging");
    }
    drag=null;
  });
  fab.addEventListener("click",e=>{ if(moved){ e.stopImmediatePropagation(); e.preventDefault(); moved=false; } },true);
  window.addEventListener("resize",()=>placeFab(fpos));
  fab.title="Chat du groupe (fais-moi glisser pour me déplacer)";
}

/* ---------- Contrôleurs de l'appli (réglages du développeur) ---------- */
async function ctrlPanel(){
  const box=$("#ctrl-panel"); if(!box) return;
  if(!A.me?.is_admin){ box.hidden=true; return; }
  box.hidden=false;
  const {data}=await A.sb.rpc("list_controllers");
  const names=(data||[]).map(x=>x.username);
  window.CDJ_CTRL=new Set(names);
  box.innerHTML="";
  box.append(el("h2",null,"Contrôleurs de l'appli"));
  box.append(el("p","note","Un contrôleur modère tous les groupes : il voit tout, valide ou supprime les publications, les commentaires et les messages, et peut retirer un simple membre. Il ne peut pas changer les rôles ni les réglages des groupes."));
  const list=el("div","list tight");
  if(!names.length) list.append(el("p","note","Aucun contrôleur pour l'instant."));
  names.forEach(n=>{
    const r=el("div","mrow"); r.append(A.userLabel(n,false));
    const b=el("button","linkbtn danger","Retirer"); b.type="button";
    b.addEventListener("click",async()=>{ const {error}=await A.sb.rpc("set_controller",{p_username:n,p_on:false}); if(error) return A.toast(A.frError(error)); A.toast("@"+n+" n'est plus contrôleur"); ctrlPanel(); });
    r.append(b); list.append(r);
  });
  box.append(list);
  const f=el("form","actions"); f.style.alignItems="flex-end";
  const l=el("label","field","Nommer un contrôleur"); l.style.flex="1"; l.style.minWidth="160px";
  const i=el("input"); i.required=true; i.placeholder="Pseudo du membre"; i.autocomplete="off"; l.append(i);
  const ok=el("button","btn primary","Nommer"); ok.type="submit";
  f.append(l,ok);
  f.addEventListener("submit",async e=>{
    e.preventDefault(); const n=i.value.trim().replace(/^@/,""); if(!n) return;
    const {error}=await A.sb.rpc("set_controller",{p_username:n,p_on:true});
    if(error) return A.toast(/introuvable/.test(error.message)?"Pseudo introuvable":A.frError(error));
    A.toast("@"+n+" est maintenant contrôleur"); ctrlPanel();
  });
  box.append(f);
}

const prev=A.hooks.change;
let ctrlDone=false;
A.hooks.change=()=>{ prev?.(); syncProfil(); if(A.me?.is_admin&&!ctrlDone){ ctrlDone=true; ctrlPanel(); } if(!A.me){ ctrlDone=false; const b=$("#ctrl-panel"); if(b) b.hidden=true; } };
syncProfil();
if(A.me?.is_admin){ ctrlDone=true; ctrlPanel(); }
})();
