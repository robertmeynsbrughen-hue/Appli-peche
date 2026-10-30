// Rivio : navigation simplifiée. Barre du bas à 5 places (Aujourd'hui, Fil, +, Carte, Groupe),
// profil derrière l'avatar en haut à droite, modération rangée dans Groupe, « + » enrichi, boîte à outils.
(function(){
"use strict";
const A=window.CDJ; if(!A) return;
const {el,toast}=A;
const $=s=>document.querySelector(s);
function btn(label,cls,fn){ const b=el("button",cls||"btn",label); b.type="button"; if(fn) b.addEventListener("click",fn); return b; }
document.documentElement.classList.add("nav5");

/* ---------- Avatar du profil dans l'en-tête ---------- */
const head=$(".app-head-in");
const me=el("a","head-me"); me.href="#profil"; me.id="head-me"; me.setAttribute("aria-label","Mon profil et réglages");
const mb=el("span","tab-badge head-me-badge"); mb.hidden=true;
function drawMe(){
  me.innerHTML="";
  if(A.me){ const n=A.me.username||"?"; let h=0; for(const c of n) h=(h*31+c.charCodeAt(0))%360; const a=el("span","hm-av",n.charAt(0).toUpperCase()); a.style.background="hsl("+h+" 42% 42%)"; me.append(a); }
  else me.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>';
  me.append(mb);
  me.classList.toggle("on",location.hash==="#profil");
}
head?.append(me);
window.addEventListener("hashchange",()=>me.classList.toggle("on",location.hash==="#profil"));

/* ---------- Modération : badge reporté sur Groupe, accès depuis le groupe ---------- */
const gTab=$("#tab-groupe"), mBadge=$("#modo-badge");
const gBadge=el("span","tab-badge"); gBadge.hidden=true; gTab?.append(gBadge);
function syncBadge(){ if(!mBadge) return; gBadge.hidden=mBadge.hidden||!mBadge.textContent; gBadge.textContent=mBadge.textContent; }
if(mBadge) new MutationObserver(syncBadge).observe(mBadge,{attributes:true,childList:true,characterData:true,subtree:true});
// sur l'écran Modération, l'onglet Groupe reste allumé et un retour est proposé
function modoState(){
  const on=location.hash==="#modo";
  if(on) gTab?.setAttribute("aria-current","page");
  const v=$("#v-modo"); if(v&&!v.querySelector(".modo-back")){ const b=btn("← Retour au groupe","linkbtn modo-back",()=>{ location.hash="#groupe"; }); v.prepend(b); }
}
window.addEventListener("hashchange",()=>setTimeout(modoState,0));
const prevGR=A.hooks.groupeRendered; A.hooks.groupeRendered=root=>{
  prevGR?.(root);
  if(!(A.isManager?.())||root.querySelector(".modo-link")||root.querySelector(".todo-link")) return;
  const n=Number(mBadge&&!mBadge.hidden?mBadge.textContent:0)||0;
  const b=btn("🛡️ Modération"+(n?" · "+n+" à traiter":""),"btn small modo-link",()=>{ location.hash="#modo"; });
  const h=root.querySelector(".g-head")||root.firstChild; if(h) h.after(b); else root.prepend(b);
};

/* ---------- Boîte à outils (ancien onglet Matos) ---------- */
const mt=document.querySelector('#profil-sub [data-s="matos"]'); if(mt) mt.textContent="🧰 Outils";
const TOOLS=[["calc-panel","🧮","Calculs","plomb, fil, amorce"],["tech-panel","📘","Techniques","fiches par espèce"],["knots","🪢","Nœuds","et montages"],["lures","🎣","Leurres","ma boîte"],["bait-stock","🥣","Appâts","mon stock"],["gear","🎒","Matériel","check-list"]];
// la boîte à outils est un lanceur : on n'affiche que l'outil choisi, avec un retour vers la liste
let tool=null;
function showTool(id){
  tool=id;
  TOOLS.forEach(([pid])=>{ const x=document.getElementById(pid); if(x) x.classList.toggle("tool-off",!!id&&pid!==id||!id); });
  const g=$("#tool-grid"); if(g) g.classList.toggle("tool-off",!!id);
  let back=$("#tool-back");
  if(id&&!back){ back=btn("← Tous les outils","linkbtn tool-back",()=>{ showTool(null); window.scrollTo({top:0}); }); back.id="tool-back"; back.dataset.sub="matos"; g?.after(back); }
  if(back){ back.hidden=!id; const t=TOOLS.find(x=>x[0]===id); back.textContent="← Tous les outils"+(t?" · "+t[1]+" "+t[2]:""); }
  window.scrollTo({top:0});
}
function toolGrid(){
  const pv=$("#v-profil"); if(!pv||!A.me) return;
  let g=$("#tool-grid");
  if(!g){ g=el("div","tool-grid"); g.id="tool-grid"; g.dataset.sub="matos"; const first=pv.querySelector('[data-sub="matos"]'); if(first) first.before(g); else return; }
  g.innerHTML="";
  TOOLS.forEach(([id,ic,t,sub])=>{ if(!document.getElementById(id)) return;
    const b=btn("","tool-tile",()=>showTool(id));
    b.append(el("span","tt-i",ic),el("span","tt-t",t),el("span","tt-s",sub)); g.append(b); });
  showTool(tool);
}
// revenir sur l'onglet Outils depuis un autre sous-onglet repart de la liste
document.querySelector('#profil-sub [data-s="matos"]')?.addEventListener("click",()=>{ if(tool) showTool(null); });
const prevP=A.hooks.profil; A.hooks.profil=()=>{ prevP?.(); setTimeout(toolGrid,0); };

/* ---------- Barre du bas : on garde l'essentiel ---------- */
function sync(){ drawMe(); modoState(); syncBadge(); toolGrid(); }
const prevCh=A.hooks.change; A.hooks.change=(...a)=>{ prevCh?.(...a); sync(); };
sync();
})();
