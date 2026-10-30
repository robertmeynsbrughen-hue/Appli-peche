// Rivio : périodes de fraie, rappels de remise à l'eau et zones frayère.
(function(){
"use strict";
const A=window.CDJ; if(!A) return;
const {el}=A;
const $=s=>document.querySelector(s);
const MOIS=["janv.","févr.","mars","avr.","mai","juin","juil.","août","sept.","oct.","nov.","déc."];
// mois de début et de fin (0 = janvier), période indicative en France, variable selon l'eau et l'altitude
const SPAWN=[
  ["Brochet",1,3,"herbiers inondés et prairies noyées, eau peu profonde"],
  ["Perche",2,4,"branches immergées, herbiers, rubans d'œufs sur les obstacles"],
  ["Aspe",2,3,"radiers de graviers à courant vif"],
  ["Sandre",3,4,"nids sur fond dur (racines, pierres), le mâle garde le nid"],
  ["Gardon",3,4,"herbiers et racines en bordure"],
  ["Chevesne",3,5,"graviers en courant"],
  ["Black-bass",4,5,"nids en bordure peu profonde, le mâle garde le nid"],
  ["Barbeau",4,5,"radiers de graviers"],
  ["Brème",4,5,"herbiers peu profonds"],
  ["Carpe",4,6,"herbiers chauds peu profonds, eau au-dessus de 18 °C"],
  ["Silure",4,6,"racines et bois noyé, le mâle garde le nid"],
  ["Tanche",5,6,"herbiers denses et chauds"],
  ["Truite fario",10,0,"frayères de graviers en tête de radier"],
];
const inRange=(m,a,b)=>a<=b?(m>=a&&m<=b):(m>=a||m<=b);
const range=([,a,b])=>a===b?MOIS[a]:MOIS[a]+" – "+MOIS[b];
function active(d){ const m=(d||new Date()).getMonth(); return SPAWN.filter(s=>inRange(m,s[1],s[2])); }
function of(name){ if(!name) return null; const n=String(name).toLowerCase(); return SPAWN.find(s=>s[0].toLowerCase()===n)||null; }
function isOn(name,d){ const s=of(name); return !!s&&inRange((d||new Date()).getMonth(),s[1],s[2]); }

/* ---------- Fiche calendrier ---------- */
function sheet(){
  const back=el("div","sheet-back"), sh=el("div","sheet fraie-sheet"); sh.setAttribute("role","dialog"); sh.setAttribute("aria-modal","true"); sh.setAttribute("aria-label","Périodes de fraie");
  const head=el("div","sheet-head"); head.append(el("h2",null,"🐣 Périodes de fraie")); const x=el("button","icon-btn","✕"); x.type="button"; x.setAttribute("aria-label","Fermer"); head.append(x); sh.append(head);
  const close=()=>back.remove(); x.addEventListener("click",close); back.addEventListener("click",e=>{ if(e.target===back) close(); });
  sh.append(el("p","note","Pendant la fraie, les poissons sont fragiles et souvent regroupés sur leurs frayères. Relâche-les vite, évite de pêcher sur les nids et les frayères, et respecte les fermetures de ton département."));
  const now=new Date().getMonth();
  const g=el("div","fraie-grid");
  g.append(el("span","fg-sp",""));
  MOIS.forEach((m,i)=>g.append(el("span","fg-m"+(i===now?" now":""),m.slice(0,1).toUpperCase())));
  SPAWN.forEach(s=>{
    const on=inRange(now,s[1],s[2]);
    const lab=el("button","fg-sp"+(on?" on":""),s[0]); lab.type="button"; lab.title=s[3];
    lab.addEventListener("click",()=>{ info.textContent="🐟 "+s[0]+" · "+range(s)+" · "+s[3]+"."; });
    g.append(lab);
    MOIS.forEach((m,i)=>g.append(el("span","fg-c"+(inRange(i,s[1],s[2])?" f":"")+(i===now?" now":""))));
  });
  sh.append(g);
  const info=el("p","fraie-info","Touche une espèce pour voir où elle fraie."); sh.append(info);
  const a=el("div","actions");
  const z=el("button","btn","🐣 Marquer une frayère sur la carte"); z.type="button";
  z.addEventListener("click",()=>{ close(); markOnMap(); });
  a.append(z); sh.append(a);
  sh.append(el("p","note","Dates indicatives : la fraie avance ou recule de plusieurs semaines selon la température de l'eau, l'altitude et l'année."));
  back.append(sh); document.body.append(back);
}
function markOnMap(){
  location.hash="#carte";
  setTimeout(()=>A.zones?A.zones.draw("frayere"):A.toast("Ouvre la carte, puis Calques › Zones › Frayère"),350);
}

/* ---------- Bannière Aujourd'hui ---------- */
function banner(){
  const box=$("#today"); if(!box) return;
  let b=$("#td-fraie");
  const list=active();
  if(!list.length){ b?.remove(); return; }
  if(!b){ b=el("div","today-sec"); b.id="td-fraie"; const ref=$("#td-day"); ref?ref.after(b):box.append(b); }
  b.innerHTML="";
  const c=el("button","fraie-banner"); c.type="button"; c.setAttribute("aria-label","Voir les périodes de fraie");
  const names=list.map(s=>s[0]);
  const zn=(A.zones?.list||[]).filter(z=>z.kind==="frayere").length;
  c.append(el("span","fb-ico","🐣"));
  const t=el("div","fb-txt");
  t.append(el("b",null,"Fraie en cours : "+(names.length>3?names.slice(0,3).join(", ")+" +"+(names.length-3):names.join(", "))),
    el("span",null,"Relâche-les vite et évite les frayères"+(zn?" ("+zn+" marquée"+(zn>1?"s":"")+" sur la carte)":"")+"."));
  c.append(t,el("span","fb-go","›"));
  c.addEventListener("click",sheet);
  b.append(c);
}

/* ---------- Indices dans la prise et le bilan ---------- */
function hint(target,species,seg){
  if(!target) return;
  const s=of(species), on=s&&isOn(species);
  target.hidden=!on;
  if(!on) return;
  target.textContent="🐣 Le "+s[0].toLowerCase()+" est en période de fraie ("+range(s)+") : pense à le relâcher rapidement.";
  const g=$(seg);
  if(g&&!g.querySelector('[aria-pressed="true"]')) g.querySelector('[data-v="1"]')?.setAttribute("aria-pressed","true");
}
const ps=$("#p-species");
ps?.addEventListener("change",()=>hint($("#p-fraie"),ps.value,"#p-rel"));
const bs=$("#b-species"), brel=$("#b-rel");
if(bs&&brel){
  let bh=$("#b-fraie"); if(!bh){ bh=el("p","note fraie-hint"); bh.id="b-fraie"; bh.hidden=true; brel.after(bh); }
  new MutationObserver(()=>hint(bh,bs.querySelector(".pick.on")?.textContent||"","#b-rel")).observe(bs,{childList:true,subtree:true});
}

A.fraie={list:SPAWN,active,isOn,of,sheet,markOnMap};
window.addEventListener("hashchange",banner);
const prev=A.hooks.change; A.hooks.change=(...a)=>{ prev?.(...a); banner(); };
banner(); setTimeout(banner,1500);
})();
