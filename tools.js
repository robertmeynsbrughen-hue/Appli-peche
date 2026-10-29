// Coup du Jour : thème clair/sombre, visite guidée, recherche dans le fil.
(function(){
"use strict";
const A=window.CDJ; if(!A) return;
const {el}=A;
const $=s=>document.querySelector(s);
const get=(k,d)=>{ try{ return localStorage.getItem(k)??d; }catch(e){ return d; } };
const set=(k,v)=>{ try{ localStorage.setItem(k,v); }catch(e){} };
function btn(label,cls,fn){ const b=el("button",cls||"btn",label); b.type="button"; if(fn) b.addEventListener("click",fn); return b; }

/* ---------- Thème ---------- */
function applyTheme(t){
  if(t==="light"||t==="dark") document.documentElement.dataset.theme=t; else delete document.documentElement.dataset.theme;
}
function themePanel(){
  const box=$("#theme-panel"); if(!box) return;
  box.innerHTML="";
  box.append(el("h2",null,"Apparence"));
  const cur=get("cdj-theme","auto");
  const seg=el("div","seg"); seg.setAttribute("aria-label","Thème");
  [["auto","📱 Auto"],["light","☀️ Clair"],["dark","🌙 Sombre"]].forEach(([v,l])=>{
    const b=btn(l,null,()=>{ set("cdj-theme",v); applyTheme(v); themePanel(); }); b.setAttribute("aria-pressed",String(cur===v)); seg.append(b);
  });
  box.append(seg, el("p","note","« Auto » suit le réglage de ton téléphone."));
  box.append(btn("🧭 Revoir la visite guidée","btn",()=>tour(true)));
}
applyTheme(get("cdj-theme","auto"));
themePanel();

/* ---------- Visite guidée ---------- */
const SLIDES=[
  ["🎣","Bienvenue dans Coup du Jour","L'appli de pêche de ton groupe de potes. Voici le tour du propriétaire en 30 secondes.",null],
  ["☀️","Conseils","Chaque jour, les espèces classées selon la météo et l'eau, le meilleur créneau, le leurre et le coloris du moment. Compare aussi les 7 prochains jours.","conseils"],
  ["📸","Fil","Partage tes prises (photo, taille, poids), un bilan en 3 clics ou une session carpe. Réagis 🔥 et commente les prises des autres.","fil"],
  ["🗺️","Carte","Les spots du groupe, leur fiche (profondeur, fond…), les zones où ça mord et, si tu veux, ta position en direct.","carte"],
  ["👥","Groupe","Sorties prévues, défis, compétitions, classement, mémos et sondages. Le 💬 chat est dans la bulle, que tu peux déplacer.","groupe"],
  ["🐟","Profil","Ton profil, ton Fishdex à compléter, tes trophées, ta liste de matos, et l'alerte du matin dans les réglages.","profil"],
];
function tour(force){
  if(document.querySelector(".tour-back")) return;
  if(!force&&(get("cdj-tour-done","")==="1"||!A.me)) return;
  if(!force&&A.onbPending){ setTimeout(()=>tour(false),1500); return; }
  let i=0;
  const back=el("div","tour-back"); const card=el("div","tour"); card.setAttribute("role","dialog"); card.setAttribute("aria-modal","true"); card.setAttribute("aria-label","Visite guidée");
  back.append(card); document.body.append(back);
  const end=()=>{ set("cdj-tour-done","1"); back.remove(); document.removeEventListener("keydown",key); };
  const key=e=>{ if(e.key==="Escape") end(); if(e.key==="ArrowRight") go(i+1); if(e.key==="ArrowLeft") go(i-1); };
  document.addEventListener("keydown",key);
  function go(n){
    if(n>=SLIDES.length) return end();
    i=Math.max(0,n);
    const [e,t,txt,view]=SLIDES[i];
    if(view) location.hash="#"+view;
    card.innerHTML="";
    card.append(el("div","tour-ico",e), el("h2",null,t), el("p",null,txt));
    const dots=el("div","tour-dots"); SLIDES.forEach((_,k)=>dots.append(el("i",k===i?"on":null))); card.append(dots);
    const act=el("div","tour-act");
    act.append(btn(i===0?"Passer":"Précédent","btn",()=>i===0?end():go(i-1)));
    const nx=btn(i===SLIDES.length-1?"C'est parti !":"Suivant","btn primary",()=>go(i+1)); act.append(nx);
    card.append(act); nx.focus();
  }
  go(0);
}

/* ---------- Recherche dans le fil ---------- */
const bar=el("div","feed-search");
const inp=el("input"); inp.type="search"; inp.placeholder="🔎 Rechercher : espèce, membre, spot, leurre…"; inp.setAttribute("aria-label","Rechercher dans le fil"); inp.autocomplete="off";
const info=el("span","note"); bar.append(inp,info);
const feed=$("#feed"); if(feed) feed.before(bar);
const norm=t=>String(t||"").normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase();
function filter(){
  const terms=norm(inp.value).split(/\s+/).filter(Boolean);
  const items=[...document.querySelectorAll("#feed > article")];
  let n=0;
  items.forEach(a=>{ const ok=!terms.length||terms.every(t=>norm(a.textContent).includes(t)); a.hidden=!ok; if(ok) n++; });
  info.textContent=terms.length?(n?n+" résultat"+(n>1?"s":""):"Aucun résultat dans les dernières publications"):"";
}
let tm=null; inp.addEventListener("input",()=>{ clearTimeout(tm); tm=setTimeout(filter,150); });
if(feed) new MutationObserver(()=>{ if(inp.value) filter(); }).observe(feed,{childList:true});
const prevChange=A.hooks.change;
A.hooks.change=()=>{ prevChange?.(); bar.hidden=!(A.me&&A.groups.length); if(A.me) setTimeout(()=>tour(false),1200); };
bar.hidden=!(A.me&&A.groups.length);
A.tour=tour;
if(A.me) setTimeout(()=>tour(false),1200);
})();
