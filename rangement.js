// Rivio : rangement de l'interface.
// - En-tête allégé : la cloche et la vue membre passent dans le menu de l'avatar.
// - Sous-onglets du profil lisibles (icône + libellé court).
// - Réglages rangés en rubriques repliables.
// - Modération du développeur affichée section par section.
(function(){
"use strict";
const A=window.CDJ; if(!A) return;
const {el}=A;
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
function btn(label,cls,fn){ const b=el("button",cls||"btn",label); b.type="button"; if(fn) b.addEventListener("click",fn); return b; }
const store={ get(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } }, set(k,v){ try{ localStorage.setItem(k,v); }catch(e){} } };
document.documentElement.classList.add("tidy");

/* ---------- Sous-onglets du profil ---------- */
const SUBS={moi:["👤","Moi"],collection:["🐟","Collection"],matos:["🧰","Outils"],reglages:["⚙️","Réglages"],moderation:["🛡️","Modo"]};
function drawSubs(){
  $$("#profil-sub [data-s]").forEach(b=>{
    const s=SUBS[b.dataset.s]; if(!s||b.dataset.tidy) return;
    b.dataset.tidy="1"; b.classList.remove("sub-gear"); b.removeAttribute("title");
    b.innerHTML=""; b.append(el("span","sb-i",s[0]),el("span","sb-t",s[1]));
    b.setAttribute("aria-label",s[1]==="Modo"?"Modération":s[1]);
  });
}

/* ---------- En-tête : menu de l'avatar ---------- */
let menu=null;
function closeMenu(){ menu?.remove(); menu=null; $("#head-me")?.setAttribute("aria-expanded","false"); }
function openMenu(){
  const me=$("#head-me"); if(!me) return;
  if(menu){ closeMenu(); return; }
  menu=el("div","head-menu"); menu.setAttribute("role","menu");
  const go=(sub)=>{ closeMenu(); location.hash="#profil"; setTimeout(()=>$('#profil-sub [data-s="'+sub+'"]')?.click(),60); };
  const item=(ico,label,fn,extra)=>{ const b=btn("","hm-item",fn); b.setAttribute("role","menuitem"); b.append(el("span","hm-i",ico),el("span","hm-l",label)); if(extra) b.append(extra); menu.append(b); return b; };
  item("👤","Mon profil",()=>go("moi"));
  const bell=$("#notif-bell");
  if(bell){ const n=bell.querySelector(".notif-badge"); const c=n&&!n.hidden?el("span","hm-n",n.textContent):null; item("🔔","Notifications",()=>{ closeMenu(); bell.click(); },c); }
  item("⚙️","Réglages",()=>go("reglages"));
  if(A.isStaff?.()||A.me?.real?.is_admin||A.me?.real?.is_controller){
    const vt=$("#view-toggle");
    if(vt&&!vt.hidden){ const member=vt.classList.contains("on"); item(member?"🛡️":"👤",member?"Revenir en vue complète":"Voir l'appli comme un membre",()=>{ closeMenu(); vt.click(); }); }
    const mc=Number(window.CDJ_MOD_COUNT)||0;
    if(A.isStaff?.()) item("🛡️","Modération",()=>go("moderation"),mc?el("span","hm-n",String(mc)):null);
  }
  const r=me.getBoundingClientRect();
  menu.style.top=(r.bottom+6)+"px"; menu.style.right=Math.max(8,window.innerWidth-r.right)+"px";
  document.body.append(menu); me.setAttribute("aria-expanded","true");
  menu.querySelector("button")?.focus();
  setTimeout(()=>{ const off=e=>{ if(menu&&!menu.contains(e.target)&&!me.contains(e.target)){ closeMenu(); document.removeEventListener("pointerdown",off,true); } }; document.addEventListener("pointerdown",off,true); },0);
}
function headMenu(){
  const me=$("#head-me"); if(!me||me.dataset.menu) return;
  me.dataset.menu="1"; me.setAttribute("aria-haspopup","menu"); me.setAttribute("aria-expanded","false");
  me.addEventListener("click",e=>{ if(!A.me) return; e.preventDefault(); openMenu(); });
  me.addEventListener("keydown",e=>{ if(e.key==="Escape") closeMenu(); });
  // pastille de l'avatar : notifications non lues + éléments à modérer
  const bell=$("#notif-bell");
  const sync=()=>{
    const nb=bell?.querySelector(".notif-badge"), n=nb&&!nb.hidden?Number(String(nb.textContent).replace(/\D/g,""))||0:0;
    let dot=me.querySelector(".hm-dot");
    if(!dot){ dot=el("span","tab-badge hm-dot"); me.append(dot); }
    dot.hidden=!n; dot.textContent=n>9?"9+":String(n);
  };
  if(bell) new MutationObserver(sync).observe(bell,{subtree:true,childList:true,attributes:true,characterData:true});
  sync();
}
window.addEventListener("hashchange",closeMenu);
window.addEventListener("keydown",e=>{ if(e.key==="Escape") closeMenu(); });

/* ---------- Réglages en rubriques ---------- */
const GROUPS=[
  ["compte","👤","Mon compte","E-mail, mot de passe, mes données",["#account-panel","#data-panel"]],
  ["alertes","🔔","Alertes et notifications","Notifications, alerte du matin, potes proches, carte de pêche",["#push-panel","#alerts","#nearby-panel","#permit-panel"]],
  ["apparence","🎨","Apparence et langue","Thème, couleur de fond, langue",["#lang-panel","#theme-panel"]],
  ["groupes","👥","Mes groupes","Rejoindre, quitter ou créer un groupe",["#my-groups","#create-group"]],
  ["aide","❓","Aide","Installer l'appli, signaler un bug",["#install-panel","#bug-panel"]],
];
function tidySettings(){
  const pv=$("#v-profil"); if(!pv) return;
  // le panneau « Installer l'appli » n'a pas d'identifiant : on le repère à sa note de version
  const inst=$("#app-version")?.closest(".panel"); if(inst&&!inst.id) inst.id="install-panel";
  GROUPS.forEach(([k,ico,title,sub,ids])=>{
    let d=$('.set-group[data-k="'+k+'"]');
    if(!d){
      d=el("details","panel set-group"); d.dataset.k=k; d.dataset.sub="reglages";
      const s=el("summary"); s.append(el("span","sg-i",ico)); const t=el("span","sg-t"); t.append(el("b",null,title),el("span","note",sub)); s.append(t); d.append(s);
      d.open=store.get("cdj-set-"+k)==="1";
      d.addEventListener("toggle",()=>store.set("cdj-set-"+k,d.open?"1":"0"));
      const last=$$(".set-group").pop(), anchor=$("#lang-panel")||$("#theme-panel");
      if(last) last.after(d); else if(anchor) anchor.before(d); else return;
    }
    ids.forEach(id=>{ const p=$(id); if(p&&p.parentElement!==d){ p.classList.add("in-group"); d.append(p); } });
    // une rubrique vide (déconnecté) reste cachée
    d.hidden=!ids.some(id=>{ const p=$(id); return p&&(A.me||!p.hidden); });
  });
}
new MutationObserver(()=>{ if($("#v-profil")?.dataset.s==="reglages") queueMicrotask(tidySettings); }).observe(document.querySelector("#v-profil")||document.body,{childList:true,subtree:false,attributes:true,attributeFilter:["data-s"]});

/* ---------- Modération : une section à la fois ---------- */
let modTimer=null;
function tidyModeration(){
  const root=$("#moderation-content"); if(!root) return;
  const secs=[...root.children].filter(x=>x.matches("section.mod-sec[id]"));
  if(secs.length<2) return;
  let bar=root.querySelector(".mod-tabs");
  const head=root.querySelector(".modo-head");
  if(!bar){ bar=el("div","mod-tabs subbar"); bar.setAttribute("role","tablist"); bar.setAttribute("aria-label","Sections de la modération"); (head||root.firstChild)?.after(bar); }
  const want=root.dataset.cur&&secs.some(s=>s.id===root.dataset.cur)?root.dataset.cur:(store.get("cdj-mod-tab")&&secs.some(s=>s.id===store.get("cdj-mod-tab"))?store.get("cdj-mod-tab"):secs[0].id);
  bar.innerHTML="";
  const LAB={"mod-todo":["📥","À traiter"],"mod-appeals":["📨","Recours"],"mod-members":["👥","Membres"],"mod-groups":["🫂","Groupes"],"mod-controllers":["🛡️","Contrôleurs"],"mod-journal":["📜","Journal"],"mod-annonces":["📣","Annonces"],"mod-sante":["🩺","Santé"],"mod-bugs":["🐞","Bugs"],"mod-stats":["📈","Stats"],"mod-sauvegardes":["💾","Sauvegardes"],"mod-maintenance":["🛠️","Maintenance"]};
  secs.forEach(s=>{
    const h=s.querySelector(".g-sec-head h2")?.textContent||s.id;
    const n=s.querySelector(".g-sec-head .modo-count:not(.zero)")?.textContent;
    const [ic,lab]=LAB[s.id]||["•",h.replace(/^[^\p{L}]*/u,"").slice(0,14)];
    const b=btn("",null,()=>pick(s.id)); b.setAttribute("role","tab"); b.dataset.k=s.id; b.title=h;
    b.append(el("span","sb-i",ic),el("span","sb-t",lab));
    if(n) b.append(el("span","mt-n",n));
    bar.append(b);
  });
  function pick(id){
    root.dataset.cur=id; store.set("cdj-mod-tab",id);
    secs.forEach(s=>{ s.classList.toggle("mod-off",s.id!==id); });
    bar.querySelectorAll("button").forEach(b=>b.setAttribute("aria-selected",String(b.dataset.k===id)));
  }
  pick(want);
}
const mroot=$("#moderation-content");
if(mroot) new MutationObserver(()=>{ clearTimeout(modTimer); modTimer=setTimeout(tidyModeration,120); }).observe(mroot,{childList:true});
// un lien de notification vers une section précise l'affiche directement
const prevPS=A.hooks.profilSub; A.hooks.profilSub=(...a)=>{ prevPS?.(...a); if(a[0]==="reglages") setTimeout(tidySettings,0); };
window.addEventListener("click",e=>{ const t=e.target.closest?.("[data-mod-go]"); if(t&&mroot){ mroot.dataset.cur=t.dataset.modGo; tidyModeration(); } });

/* ---------- Démarrage ---------- */
const prevCh=A.hooks.change; A.hooks.change=(...a)=>{ prevCh?.(...a); drawSubs(); headMenu(); setTimeout(tidySettings,0); };
drawSubs(); headMenu(); setTimeout(tidySettings,300);
})();
