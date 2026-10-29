// Coup du Jour : fiches nœuds et montages (hors ligne).
(function(){
"use strict";
const A=window.CDJ; if(!A) return;
const {el}=A;
const $=s=>document.querySelector(s);
function btn(label,cls,fn){ const b=el("button",cls||"btn",label); b.type="button"; if(fn) b.addEventListener("click",fn); return b; }

// schémas simples (SVG) : ligne, hameçon, leurre
const HOOK='<path d="M70 20 V70 a18 18 0 0 1 -36 0 V58" fill="none" stroke="var(--fg)" stroke-width="4" stroke-linecap="round"/><path d="M34 58 l-7 9 M34 58 l7 7" stroke="var(--fg)" stroke-width="3" stroke-linecap="round"/><circle cx="70" cy="14" r="6" fill="none" stroke="var(--fg)" stroke-width="3"/>';
const LINE='stroke="var(--accent)" stroke-width="3" fill="none" stroke-linecap="round"';
const SVG={
  palomar:'<svg viewBox="0 0 220 110"><g transform="translate(110 0)">'+HOOK+'</g><path d="M10 20 C60 20 120 8 176 14" '+LINE+'/><path d="M10 30 C60 30 120 22 176 14" '+LINE+'/><ellipse cx="165" cy="16" rx="12" ry="9" '+LINE+'/><path d="M150 8 C140 30 200 30 188 8" '+LINE+' stroke-dasharray="4 4"/></svg>',
  uni:'<svg viewBox="0 0 220 80"><path d="M5 30 H215" stroke="var(--amber)" stroke-width="3"/><path d="M5 46 H215" '+LINE+'/><g fill="none" stroke="var(--amber)" stroke-width="3">'+[0,1,2,3,4,5].map(i=>'<ellipse cx="'+(60+i*9)+'" cy="38" rx="4" ry="12"/>').join("")+'</g><g fill="none" stroke="var(--accent)" stroke-width="3">'+[0,1,2,3].map(i=>'<ellipse cx="'+(140+i*9)+'" cy="38" rx="4" ry="12"/>').join("")+'</g><text x="70" y="70" font-size="11" fill="var(--muted)">tresse 8 tours</text><text x="132" y="70" font-size="11" fill="var(--muted)">fluoro 4 tours</text></svg>',
  cheveu:'<svg viewBox="0 0 220 120"><g transform="translate(70 0)">'+HOOK+'</g><g fill="none" stroke="var(--accent)" stroke-width="3">'+[0,1,2,3,4,5,6].map(i=>'<ellipse cx="140" cy="'+(28+i*6)+'" rx="7" ry="2.5"/>').join("")+'</g><path d="M140 70 C140 100 150 104 165 100" '+LINE+'/><circle cx="178" cy="100" r="13" fill="var(--amber)"/><path d="M140 14 V0" '+LINE+'/><text x="150" y="60" font-size="11" fill="var(--muted)">7 à 9 tours</text></svg>',
  texas:'<svg viewBox="0 0 240 90"><path d="M5 40 H70" '+LINE+'/><path d="M58 40 l-14 -9 v18 z" fill="var(--muted)"/><circle cx="76" cy="40" r="5" fill="var(--amber)"/><path d="M90 40 H120" '+LINE+'/><path d="M118 32 C160 22 210 28 232 40 C210 52 160 58 118 48 Z" fill="var(--amber)" opacity=".75"/><path d="M122 40 l10 -6 v20 C160 60 170 52 168 44" stroke="var(--fg)" stroke-width="3" fill="none"/><text x="20" y="70" font-size="11" fill="var(--muted)">balle + perle</text><text x="150" y="80" font-size="11" fill="var(--muted)">pointe cachée</text></svg>',
  dropshot:'<svg viewBox="0 0 160 160"><path d="M80 0 V140" '+LINE+'/><path d="M80 50 h20" stroke="var(--fg)" stroke-width="3"/><path d="M100 50 a8 8 0 0 1 -6 14" stroke="var(--fg)" stroke-width="3" fill="none"/><path d="M100 44 C130 40 150 48 152 56 C150 62 130 64 100 56 Z" fill="var(--amber)" opacity=".8"/><ellipse cx="80" cy="146" rx="7" ry="10" fill="var(--muted)"/><path d="M60 54 V140" stroke="var(--muted)" stroke-dasharray="3 4"/><text x="8" y="100" font-size="11" fill="var(--muted)">20–50 cm</text></svg>',
  clip:'<svg viewBox="0 0 240 100"><path d="M5 30 H120" '+LINE+'/><rect x="100" y="24" width="40" height="12" rx="6" fill="var(--muted)"/><path d="M140 30 H170" stroke="var(--fg)" stroke-width="3"/><circle cx="174" cy="30" r="5" fill="none" stroke="var(--fg)" stroke-width="3"/><path d="M179 30 C200 30 210 40 214 60" '+LINE+'/><ellipse cx="118" cy="62" rx="12" ry="18" fill="var(--muted)" opacity=".8"/><path d="M118 36 V44" stroke="var(--fg)" stroke-width="2"/><circle cx="220" cy="78" r="10" fill="var(--amber)"/><text x="80" y="96" font-size="11" fill="var(--muted)">plomb 80–120 g</text></svg>',
};
const KNOTS=[
  {id:"palomar",t:"Nœud Palomar",use:"Le nœud de base pour attacher un leurre, un émerillon ou un hameçon. Très solide, en tresse comme en nylon.",lvl:"Facile",steps:[
    "Double 15 cm de fil et passe la boucle dans l'œillet.",
    "Fais un nœud simple, sans serrer, avec le fil doublé.",
    "Passe le leurre (ou l'hameçon) entier dans la boucle.",
    "Humidifie, puis tire sur les deux brins : la boucle glisse au-dessus de l'œillet et le nœud se serre.",
    "Coupe le brin mort à 2–3 mm."],tip:"Avec un gros leurre, préfère un émerillon agrafe : passer le leurre dans la boucle devient difficile."},
  {id:"uni",t:"Raccord tresse–fluoro (double Uni)",use:"Pour relier la tresse du moulinet à un bas de ligne en fluorocarbone ou en nylon.",lvl:"Moyen",steps:[
    "Fais se chevaucher les deux fils sur 20 cm.",
    "Avec la tresse : forme une boucle le long du fluoro et fais 8 tours autour des deux fils, à l'intérieur de la boucle.",
    "Serre à moitié en tirant le bout de la tresse.",
    "Avec le fluoro : même chose autour de la tresse, 4 tours.",
    "Humidifie et tire sur les deux grands brins : les deux nœuds glissent l'un contre l'autre.",
    "Coupe les deux brins à ras (2 mm)."],tip:"Plus de tours avec la tresse (8 à 10) qu'avec le fluoro (4 à 5) : la tresse fine glisse facilement."},
  {id:"cheveu",t:"Montage cheveu (nœud sans nœud)",use:"Le montage carpe classique : l'appât pend sous l'hameçon, la carpe aspire et se pique seule.",lvl:"Moyen",steps:[
    "Fais une petite boucle au bout du bas de ligne (nœud en huit) : c'est le cheveu.",
    "Passe l'autre bout dans l'œillet par l'avant (côté pointe).",
    "Règle le cheveu : l'appât doit pendre à 1 cm environ sous la courbure.",
    "Enroule 7 à 9 tours serrés autour de la hampe, vers la courbure, en recouvrant le cheveu.",
    "Repasse le fil dans l'œillet par l'avant, puis tire pour serrer.",
    "Enfile la bouillette à l'aiguille et bloque-la avec un stop."],tip:"Un cheveu trop long fait rater les touches, trop court la carpe recrache l'hameçon : ajuste selon la taille de l'appât."},
  {id:"texas",t:"Montage Texas",use:"Le leurre souple anti-accroche pour pêcher dans les herbiers, le bois et les cailloux.",lvl:"Facile",steps:[
    "Enfile une balle (plomb « bullet ») pointe vers le leurre, puis une perle si tu veux du bruit.",
    "Noue un hameçon texan (offset) au Palomar.",
    "Pique la pointe dans le nez du leurre sur 1 cm et ressors-la par le dessous.",
    "Fais glisser le leurre jusqu'au coude de l'hameçon : la tête tient sur l'offset.",
    "Repique la pointe dans le corps du leurre, juste affleurante : elle ne s'accroche plus, mais ferre bien.",
    "Bloque la balle avec un stop-float si tu veux qu'elle reste contre le leurre."],tip:"Balle de 5 à 7 g en bordure, 10 à 20 g pour traverser les herbiers épais ou pêcher profond."},
  {id:"dropshot",t:"Drop-shot",use:"Pour pêcher la perche ou le sandre juste au-dessus du fond, en animant sur place.",lvl:"Facile",steps:[
    "Noue l'hameçon drop-shot au Palomar en gardant un long brin de 30 à 60 cm.",
    "Repasse ce long brin dans l'œillet par le haut : la pointe se retrouve tournée vers le haut.",
    "Fixe le plomb drop-shot en bas du brin, 20 à 50 cm sous l'hameçon selon la hauteur visée.",
    "Pique le leurre par le nez seulement.",
    "Pêche fil tendu, plomb au fond : fais vibrer le scion sans déplacer le plomb."],tip:"Poissons collés au fond : 15–20 cm. Poissons suspendus vus au sondeur : jusqu'à 60 cm."},
  {id:"clip",t:"Bas de ligne carpe sur clip plomb",use:"Le montage carpe de sécurité : le plomb se décroche si la ligne casse, le poisson ne reste pas attaché.",lvl:"Moyen",steps:[
    "Enfile un tube anti-emmêlement sur le corps de ligne.",
    "Enfile le clip plomb, puis noue un émerillon au bout du corps de ligne (Palomar).",
    "Enfonce l'émerillon dans le clip jusqu'au blocage.",
    "Accroche le plomb (80 à 120 g) et pousse la queue de clip, sans forcer.",
    "Fixe le bas de ligne (montage cheveu, 15 à 25 cm) sur l'émerillon."],tip:"Ne bloque jamais la queue de clip à fond en zone encombrée : le plomb doit pouvoir partir."},
];

function open(k){
  const back=el("div","sheet-back"); const sh=el("div","sheet knot-sheet"); sh.setAttribute("role","dialog"); sh.setAttribute("aria-modal","true"); sh.setAttribute("aria-label",k.t);
  const head=el("div","sheet-head"); head.append(el("h2",null,k.t)); const x=btn("✕","icon-btn"); x.setAttribute("aria-label","Fermer"); head.append(x); sh.append(head);
  const close=()=>back.remove(); x.addEventListener("click",close); back.addEventListener("click",e=>{ if(e.target===back) close(); });
  sh.append(el("p","note",k.use+" · Difficulté : "+k.lvl));
  const fig=el("div","knot-fig"); fig.innerHTML=SVG[k.id]||""; sh.append(fig);
  const ol=el("ol","knot-steps"); k.steps.forEach((s,i)=>{ const li=el("li"); li.append(el("span","ks-n",String(i+1)),el("span",null,s)); ol.append(li); }); sh.append(ol);
  if(k.tip) sh.append(el("p","knot-tip","💡 "+k.tip));
  back.append(sh); document.body.append(back);
}
function panel(){
  const box=$("#knots"); if(!box) return;
  box.hidden=!A.me; if(box.hidden) return;
  box.innerHTML="";
  box.append(el("h2",null,"📚 Nœuds et montages"));
  const g=el("div","knot-grid");
  KNOTS.forEach(k=>{ const b=el("button","knot-card"); b.type="button"; const f=el("div","knot-mini"); f.innerHTML=SVG[k.id]||""; b.append(f,el("b",null,k.t),el("span","note",k.lvl)); b.addEventListener("click",()=>open(k)); g.append(b); });
  box.append(g, el("p","note","Disponible sans réseau : pratique au bord de l'eau."));
}
A.knots={list:KNOTS,open};
const prev=A.hooks.profil; A.hooks.profil=()=>{ prev?.(); panel(); };
panel();
})();
