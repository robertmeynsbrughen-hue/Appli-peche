// Coup du Jour : bouton « + », profil en vitrine, célébrations, transitions, écran de démarrage, couleur de fond.
(function(){
"use strict";
const A=window.CDJ; if(!A) return;
const {el,toast}=A;
const $=s=>document.querySelector(s);
const get=(k,d)=>{ try{ return localStorage.getItem(k)??d; }catch(e){ return d; } };
const set=(k,v)=>{ try{ localStorage.setItem(k,v); }catch(e){} };
function btn(label,cls,fn){ const b=el("button",cls||"btn",label); b.type="button"; if(fn) b.addEventListener("click",fn); return b; }

/* ---------- Écran de démarrage ---------- */
(function(){
  const sp=$("#splash"); if(!sp) return;
  const hide=()=>{ sp.classList.add("out"); setTimeout(()=>sp.remove(),500); };
  setTimeout(hide,900);
})();

/* ---------- Bouton « + » dans la barre du bas ---------- */
const nav=$("nav.tabs");
const plus=el("button","tab-plus"); plus.type="button"; plus.setAttribute("aria-label","Ajouter : prise, bilan, session, dictée");
plus.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';
const carte=nav?.querySelector('[data-v="carte"]');
if(nav&&carte) nav.insertBefore(plus,carte);
function mode(m){
  location.hash="#fil";
  setTimeout(()=>{
    const b=document.querySelector('#post-mode [data-m="'+m+'"]');
    if(b&&b.getAttribute("aria-pressed")!=="true") b.click();
    const target=m==="post"?$("#composer"):m==="bilan"?$("#bilan"):$("#carp");
    target?.scrollIntoView({behavior:"smooth",block:"start"});
  },220);
}
function plusSheet(){
  if(!A.me||!A.groups.length){ location.hash="#profil"; return toast("Connecte-toi et rejoins un groupe pour partager"); }
  if(typeof A.cur!=="number") return toast("Choisis d'abord un groupe précis, en haut de l'écran");
  const back=el("div","sheet-back plus-back"); const sh=el("div","sheet plus-sheet"); sh.setAttribute("role","dialog"); sh.setAttribute("aria-modal","true"); sh.setAttribute("aria-label","Ajouter");
  const close=()=>{ back.classList.add("out"); setTimeout(()=>back.remove(),180); };
  const grid=el("div","plus-grid");
  const item=(ic,t,s,fn,cls)=>{ const b=el("button","plus-item"+(cls?" "+cls:"")); b.type="button"; b.append(el("span","pi-ico",ic),el("span","pi-t",t),el("span","pi-s",s)); b.addEventListener("click",()=>{ close(); fn(); }); grid.append(b); };
  item("📸","Prise","photo, taille, poids",()=>mode("post"));
  item("🎤","Dicter","mains libres",()=>{ mode("post"); setTimeout(()=>$("#voice-btn")?.click(),500); });
  item("🧾","Bilan","3 clics",()=>mode("bilan"));
  item("⏱️","Session carpe","départs et prises",()=>mode("carp"));
  item("🎣","Je pars pêcher","prévenir le groupe",()=>A.checkin?.open(),"wide");
  sh.append(el("div","plus-h","Ajouter"),grid);
  back.append(sh); back.addEventListener("click",e=>{ if(e.target===back) close(); });
  document.body.append(back);
}
plus.addEventListener("click",plusSheet);

/* ---------- Profil en vitrine ---------- */
const me=$("#me");
let hero=null;
function profileHero(){
  if(!me||!A.me) return;
  if(!hero){
    hero=el("div","pf-hero");
    me.classList.add("me-hero");
    me.prepend(hero);
  }
  const d=A.dex?.mine;
  hero.innerHTML="";
  const stat=(v,l)=>{ const s=el("div","pf-stat"); s.append(el("b",null,v),el("span",null,l)); return s; };
  const rec=d?.record;
  hero.append(stat(d?String(d.count):"…","prises"),
    stat(rec?.length_cm?String(rec.length_cm).replace(".",",")+" cm":"–",rec?.species?"record · "+rec.species:"record"),
    stat(d?d.found.size+"/"+(A.dex?.DEX?.length||18):"…","Fishdex"),
    stat(d?String(d.troph.length):"…","trophées"));
  // vitrine des trophées obtenus
  const shelf=me.querySelector(".pf-shelf")||el("div","pf-shelf");
  shelf.innerHTML="";
  const got=(A.dex?.TROPHIES||[]).filter(t=>d?.troph.includes(t.id));
  if(got.length){ got.slice(-8).reverse().forEach(t=>{ const x=el("span","pf-troph",t.e); x.title=t.name; shelf.append(x); }); me.append(shelf); }
  else shelf.remove();
}
window.addEventListener("cdj-dex",profileHero);
const prevProfil=A.hooks.profil; A.hooks.profil=()=>{ prevProfil?.(); profileHero(); };
// l'onglet « Réglages » passe derrière l'engrenage : on le garde accessible mais discret
(function(){ const g=document.querySelector('#profil-sub [data-s="reglages"]'); if(!g) return; g.classList.add("sub-gear"); g.textContent="⚙️"; g.setAttribute("aria-label","Réglages"); g.title="Réglages"; })();

/* ---------- Célébrations ---------- */
A.celebrate=(ico,title,sub)=>{
  const c=el("div","celebrate"); c.setAttribute("role","status");
  const card=el("div","cel-card"); card.append(el("div","cel-ico",ico),el("b",null,title)); if(sub) card.append(el("span",null,sub));
  c.append(card);
  for(let i=0;i<18;i++){ const p=el("i","cel-bit"); p.style.setProperty("--a",(i*20)+"deg"); p.style.setProperty("--d",(70+Math.random()*60)+"px"); p.style.setProperty("--c",["#e98a2c","#2c8b73","#ffd27a","#5cc2a3"][i%4]); c.append(p); }
  document.body.append(c);
  try{ navigator.vibrate?.([30,40,30]); }catch(e){}
  setTimeout(()=>c.classList.add("out"),1500); setTimeout(()=>c.remove(),1900);
};

/* ---------- Transitions douces entre les onglets ---------- */
let lastView=null;
function fade(){
  const v=[...document.querySelectorAll("section.view")].find(x=>!x.hidden);
  if(!v||v===lastView) return; lastView=v;
  v.classList.remove("view-in"); void v.offsetWidth; v.classList.add("view-in");
}
window.addEventListener("hashchange",()=>setTimeout(fade,0));
fade();

/* ---------- Couleur de fond choisie par le membre ---------- */
const BGS=[["auto","Auto","#dbe7f3"],["lac","Lac","#dbe7f3"],["sable","Sable","#efe4d2"],["menthe","Menthe","#dcefe6"],["ardoise","Ardoise","#dfe3e8"],["lavande","Lavande","#e6e1f3"],["rose","Rosé","#f4e0e2"],["peche","Pêche","#f8e2cf"],["foret","Forêt","#cfe0d4"]];
function applyBg(v){ if(v&&v!=="auto") document.documentElement.dataset.bg=v; else delete document.documentElement.dataset.bg; }
function bgPanel(){
  let box=$("#bg-panel");
  if(!box){ const tp=$("#theme-panel"); if(!tp) return; box=el("div","panel"); box.id="bg-panel"; box.dataset.sub="reglages"; tp.after(box); }
  const cur=get("cdj-bg","auto");
  box.innerHTML="";
  box.append(el("h2",null,"🎨 Couleur de fond"));
  const g=el("div","bg-grid");
  BGS.forEach(([v,l,c])=>{
    const b=btn("","bg-sw"+(v===cur?" on":""),()=>{ set("cdj-bg",v); applyBg(v); bgPanel(); });
    const dot=el("span","bg-dot"); dot.style.background=v==="auto"?"conic-gradient(#dbe7f3 0 50%,#f4e1ca 0)":c; b.append(dot,el("span",null,l));
    b.setAttribute("aria-pressed",String(v===cur)); g.append(b);
  });
  box.append(g, el("p","note","« Auto » garde la couleur de ton rôle (bleu membre, orange admin). Chaque couleur a sa version sombre si le mode sombre est actif. Le choix est propre à ce téléphone."));
}
applyBg(get("cdj-bg","auto"));
bgPanel();
})();
