// Rivio : fiches techniques par espèce (hors ligne) et accès sans compte (mode découverte).
(function(){
"use strict";
const A=window.CDJ; if(!A) return;
const {el}=A;
const $=s=>document.querySelector(s);
function btn(label,cls,fn){ const b=el("button",cls||"btn",label); b.type="button"; if(fn) b.addEventListener("click",fn); return b; }

// s = saisons [printemps, été, automne, hiver] ; l = leurres et appâts ; a = animations ; e = erreurs à éviter
const TECH=[
  {n:"Brochet",i:"Chasseur à l'affût : il attend sa proie posté contre un obstacle et attaque en une accélération.",
   s:["Après l'ouverture, en bordure peu profonde : herbiers qui repoussent, bras morts, sorties de frayères.","Tôt le matin et le soir, le long des herbiers et des nénuphars ; en journée, il descend vers les cassures plus profondes.","La meilleure saison : il suit les bancs de poissons blancs. Tombants, pointes, arbres noyés, à toute heure par temps gris.","Lent mais mordeur par temps doux : postes profonds et calmes, près du fond, aux heures les plus chaudes."],
   l:["Leurres souples de 10 à 20 cm (shad, finesse), sur tête plombée ou montage texan","Poissons nageurs et jerkbaits suspending en eau claire","Spinnerbaits et cuillères tournantes en eau teintée","Swimbaits imitant le gardon ou la perche","Vif ou poisson mort manié là où c'est autorisé"],
   a:["Récupération lente et régulière, entrecoupée d'arrêts : l'attaque vient souvent à la reprise","Twitchs secs et pauses longues avec un jerkbait en eau froide","Ferrage appuyé et immédiat : sa gueule est dure"],
   e:["Pêcher sans bas de ligne acier ou fluorocarbone épais (40/100 minimum) : ses dents coupent la ligne","Garder le poisson hors de l'eau trop longtemps : décroche-le avec une longue pince, dans l'eau si possible","Oublier la fermeture et la taille minimale de ton département"]},
  {n:"Sandre",i:"Poisson de fond, méfiant, qui chasse surtout dans la pénombre grâce à ses yeux sensibles à la lumière.",
   s:["Après la fraie (mai-juin), il se tient près des zones dures : pierres, enrochements, piles de ponts.","Actif à la tombée de la nuit et à l'aube, sur les cassures et les fonds durs ; en journée, profond et à l'ombre.","Très bonne saison : il suit le poisson fourrage sur les tombants, aussi en journée par temps couvert.","Profond et lent, en bas des fosses ; touches très fines, les jours doux et gris sont les meilleurs."],
   l:["Leurres souples de 7 à 12 cm (shad, finesse) sur tête plombée de 7 à 21 g","Montage drop-shot et ned rig quand il est méfiant","Lames vibrantes en verticale, en bateau","Poisson mort manié, ou petit vif posé près du fond là où c'est autorisé"],
   a:["Pêche au contact du fond : petits sauts suivis d'une redescente, la touche vient à la retombée","Animation lente, tenir le fil tendu pour sentir le « tic »","Ferrage rapide dès la touche : il recrache vite ce qui lui paraît suspect"],
   e:["Animer trop vite et trop haut au-dessus du fond","Utiliser une ligne trop visible en eau claire : bas de ligne fluorocarbone 25 à 30/100","Pêcher les heures de plein soleil au même endroit que le soir"]},
  {n:"Perche",i:"Prédateur grégaire et curieux : quand on en prend une, les autres sont souvent tout près.",
   s:["Près des herbiers naissants et des branches noyées, en bordure, avant et après la fraie.","Bancs en chasse près de la surface, souvent visibles (« chasses »), et aux abords des pontons et bateaux.","Grosses perches regroupées sur les tombants et les structures, plus profondes.","Bancs serrés en profondeur ; pêche verticale ou drop-shot très lent."],
   l:["Petits leurres souples de 3 à 7 cm, couleurs naturelles ou vives","Cuillères tournantes n°1 à 3","Micro-jigs et lames vibrantes","Drop-shot avec un petit finesse","Vers et petits vifs au flotteur"],
   a:["Récupération par saccades courtes, elle attaque souvent à la retombée","Dès qu'une touche a lieu, relance au même endroit : le banc est là","En hiver, presque immobile : faire juste vibrer le scion"],
   e:["Leurre trop gros pour la taille des perches présentes","Bouger de poste trop vite après une prise","Ferrer comme pour un brochet : sa bouche est fragile"]},
  {n:"Black-bass",i:"Poisson d'eau calme et chaude, très territorial, qui aime les obstacles et la couverture.",
   s:["Il remonte vers les bordures qui se réchauffent ; après la fraie, il garde les nids : à relâcher sans le déranger.","Le meilleur moment : herbiers, nénuphars, bois noyé ; top-water le matin et le soir.","Il suit le poisson fourrage, toujours près des obstacles ; tombants et pointes.","Ralenti, profond et collé au fond : animations très lentes."],
   l:["Leurres de surface (stickbait, popper, frog) sur les herbiers","Montages texan et wacky pour les obstacles","Spinnerbaits et chatterbaits","Écrevisses et créatures souples","Crankbaits sur les cassures"],
   a:["En surface : marche du chien (walking the dog), pauses longues","Texan : lancer dans l'obstacle, laisser couler, petits sauts","Ferrage puissant et décidé avec du texan"],
   e:["Pêcher en pleine eau, loin de tout obstacle","Garder les poissons des nids en période de fraie","Ligne trop fine dans les herbiers épais : tresse 20 à 30 lb"]},
  {n:"Silure",i:"Le plus gros poisson d'eau douce d'Europe, surtout nocturne, qui chasse au toucher et aux vibrations.",
   s:["Il quitte les fosses avec la hausse de température ; bordures et bras morts au crépuscule.","Saison idéale, en particulier de nuit : sorties de fosses, cassures, bordures encombrées.","Encore actif tant que l'eau reste au-dessus de 12 °C environ ; fosses et courants lents.","Regroupé et peu actif au fond des fosses."],
   l:["Grands leurres souples (15 à 30 cm), shads et swimbaits","Clonk pour l'attirer par le bruit, avec un appât sous le bateau","Vif ou bouquet de vers montés sur bas de ligne solide","Pellets et appâts odorants en pêche posée"],
   a:["Pêche verticale au clonk depuis un bateau ou un float-tube","Récupération lente près du fond avec de gros leurres","Combat long : régler le frein avant, garder la canne haute"],
   e:["Matériel sous-dimensionné : tresse 50 lb minimum, hameçons forts","Sortir un gros poisson sans gant ni technique : le prendre par la mâchoire inférieure avec un gant","Laisser le poisson hors de l'eau : photos rapides, poisson soutenu à l'horizontale"]},
  {n:"Carpe",i:"Poisson fouilleur, méfiant et très sensible à la nourriture et à la température de l'eau.",
   s:["Dès que l'eau dépasse 10 à 12 °C : bordures qui se réchauffent, eaux peu profondes au soleil.","Active de nuit et au petit matin ; herbiers, nénuphars, zones ombragées en journée, pêche en surface possible.","Elle se nourrit beaucoup avant l'hiver : amorçage plus copieux, postes plus profonds.","Peu active : petites quantités d'amorce, appâts très attractifs, zones les plus profondes et abritées."],
   l:["Bouillettes (14 à 24 mm), pop-ups et équilibrées","Graines préparées : maïs, chènevis, tigernuts","Pellets de toutes tailles","Pain et appâts flottants pour la pêche en surface"],
   a:["Amorçage précis au spod ou à la fronde, en restant régulier d'une sortie à l'autre","Montage cheveu et plomb lourd pour l'autoferrage","Ferrage ferme mais progressif au départ du détecteur"],
   e:["Amorcer en grosse quantité dans une eau froide","Négliger la sécurité du montage : le plomb doit pouvoir se libérer","Poser la carpe sur le sol : tapis de réception mouillé obligatoire"]},
  {n:"Chevesne",i:"Opportuniste vif et méfiant, qui mange de tout et fuit à la moindre ombre sur l'eau.",
   s:["Courants modérés, sorties de radiers, sous les branches en surplomb.","Sous les arbres en bordure, à l'affût des insectes qui tombent ; très bonne pêche en surface.","Courant plus lent, souches et obstacles ; il prend volontiers les petits leurres.","Calmes profonds et contre-courants, au plus chaud de la journée."],
   l:["Petits poissons nageurs et cuillères n°1 à 3","Leurres de surface et insectes artificiels","Pain, fromage, cerises, sauterelles","Mouche sèche et nymphe"],
   a:["Approche discrète, sans ombre portée sur l'eau, lancers en amont","Laisser dériver le leurre ou l'appât naturellement avec le courant","Ferrage rapide : il recrache vite"],
   e:["S'approcher en marchant bruyamment sur la berge","Ligne trop épaisse : il la voit en eau claire","Rester au même poste après une touche ratée : il faut le laisser se calmer ou changer"]},
  {n:"Aspe",i:"Prédateur rapide de pleine eau, qui chasse les bancs d'ablettes en surface dans le courant.",
   s:["Il se regroupe dans les radiers et les courants pour la fraie, puis chasse fort ensuite.","Chasses spectaculaires en surface, tôt le matin et le soir, dans les veines d'eau rapides.","Encore très actif dans le courant, parfois en journée.","Plus profond et plus lent, dans les zones de courant ralenti."],
   l:["Jerkminnows et petits poissons nageurs effilés","Lames et cuillères ondulantes lourdes pour lancer loin","Leurres de surface type stickbait","Bombettes et jigs légers"],
   a:["Lancer loin, au-delà de la chasse, et ramener vite en surface","Récupération rapide et régulière : il aime les proies qui fuient","Ferrage franc : sa bouche est dure"],
   e:["Ramener trop lentement : il se désintéresse du leurre","Pêcher les zones calmes alors qu'il chasse dans le courant","Négliger le frein : ses départs sont puissants"]},
];
const SEASONS=["🌱 Printemps","☀️ Été","🍂 Automne","❄️ Hiver"];
const seasonIdx=(d=new Date())=>{ const m=d.getMonth(); return m>=2&&m<=4?0:m>=5&&m<=7?1:m>=8&&m<=10?2:3; };

function sheet(title,cls){
  const back=el("div","sheet-back"), sh=el("div","sheet "+(cls||"")); sh.setAttribute("role","dialog"); sh.setAttribute("aria-modal","true"); sh.setAttribute("aria-label",title);
  const head=el("div","sheet-head"); head.append(el("h2",null,title)); const x=btn("✕","icon-btn"); x.setAttribute("aria-label","Fermer"); head.append(x); sh.append(head);
  const close=()=>back.remove(); x.addEventListener("click",close); back.addEventListener("click",e=>{ if(e.target===back) close(); });
  back.append(sh); document.body.append(back); return {sh,close};
}
function list(title,items){ const s=el("div","tech-sec"); s.append(el("h3",null,title)); const ul=el("ul"); items.forEach(x=>ul.append(el("li",null,x))); s.append(ul); return s; }
function open(t){
  const {sh}=sheet(t.n,"tech-sheet");
  sh.append(el("p","tech-intro",t.i));
  const cur=seasonIdx();
  const ss=el("div","tech-seasons");
  t.s.forEach((x,i)=>{ const c=el("div","tech-season"+(i===cur?" now":"")); c.append(el("b",null,SEASONS[i]+(i===cur?" · en ce moment":"")),el("span",null,x)); ss.append(c); });
  const sec=el("div","tech-sec"); sec.append(el("h3",null,"🗺️ Où la chercher"),ss); sh.append(sec);
  sh.append(list("🎣 Leurres et appâts",t.l), list("🌀 Animation et ferrage",t.a), list("⚠️ Erreurs à éviter",t.e));
  const ad=window.CDJ_ADVICE;
  if(ad?.current) try{ const sp=ad.current?.species?.find?.(x=>x.name===t.n); if(sp) sh.append(el("p","note","Aujourd'hui : "+sp.name+" à "+sp.score+" %.")); }catch(_){}
  sh.append(el("p","note","Respecte toujours la réglementation de ton département : périodes d'ouverture, tailles minimales et nombre de prises."));
}
function techList(){
  const {sh,close}=sheet("Fiches techniques","tech-list");
  sh.append(el("p","note","Où chercher chaque espèce selon la saison, avec quoi, comment l'animer. Disponible sans réseau."));
  const g=el("div","tech-grid");
  TECH.forEach(t=>{ const b=btn("","tech-card",()=>{ close(); open(t); }); const e=A.dex?.entryOf?.(t.n); b.append(el("b",null,t.n),el("span","note",t.i.split(/[,:]/)[0])); if(e?.color) b.style.borderLeftColor=e.color; g.append(b); });
  sh.append(g);
}
function knotList(){
  const K=A.knots; if(!K) return;
  const {sh,close}=sheet("Nœuds et montages","tech-list");
  sh.append(el("p","note","Les fiches pas à pas, disponibles sans réseau."));
  const g=el("div","tech-grid");
  K.list.forEach(k=>{ const b=btn("","tech-card",()=>{ close(); K.open(k); }); b.append(el("b",null,k.t),el("span","note",(k.cat==="carpe"?"Carpe · ":"")+k.lvl)); g.append(b); });
  sh.append(g);
}

/* ---------- Panneau Profil › Matos ---------- */
function panel(){
  let box=$("#tech-panel");
  if(!box){ const k=$("#knots"); if(!k) return; box=el("div","panel"); box.id="tech-panel"; box.dataset.sub="matos"; k.before(box); }
  box.hidden=!A.me; if(box.hidden) return;
  box.innerHTML="";
  box.append(el("h2",null,"🎯 Fiches techniques"));
  const g=el("div","chips-pick");
  TECH.forEach(t=>g.append(btn(t.n,"pick",()=>open(t))));
  box.append(g, el("p","note","Où la chercher selon la saison, leurres, animations et erreurs à éviter."));
}

/* ---------- Mode découverte (sans compte) ---------- */
function discover(){
  const auth=$("#auth"); if(!auth) return;
  let d=$("#discover");
  if(!d){
    d=el("div","panel discover"); d.id="discover";
    d.append(el("h2",null,"🧭 Découvrir sans compte"), el("p","note","Tu peux déjà utiliser une partie de l'appli sans t'inscrire :"));
    const g=el("div","disc-grid");
    const item=(ico,t,s,fn)=>{ const b=btn("","disc-item",fn); b.append(el("span","disc-ico",ico),el("b",null,t),el("span","note",s)); g.append(b); };
    item("🌤️","Conseils du jour","Meilleur créneau par espèce",()=>{ location.hash="#conseils"; });
    item("📅","Calendrier","30 jours de pêche",()=>{ location.hash="#conseils"; setTimeout(()=>A.calendar?.(),300); });
    item("🎯","Fiches techniques","8 espèces expliquées",techList);
    item("📚","Nœuds et montages","Pas à pas, sans réseau",knotList);
    d.append(g, el("p","note","Avec un compte (gratuit) : ton carnet, ta carte de spots, le fil et le chat avec tes potes."));
    auth.append(d);
  }
}
// sur Fil et Carte, sans compte : on propose les deux chemins
function needLogin(){
  if(A.me) return;
  document.querySelectorAll("[data-need-login]").forEach(e=>{
    if(e.hidden||e.querySelector(".nl-actions")) return;
    const a=el("div","actions nl-actions");
    a.append(btn("Créer un compte","btn primary small",()=>{ location.hash="#profil"; setTimeout(()=>document.querySelector('#auth-mode [data-m="signup"]')?.click(),200); }));
    a.append(btn("Découvrir sans compte","btn small",()=>{ location.hash="#profil"; setTimeout(()=>$("#discover")?.scrollIntoView({behavior:"smooth"}),250); }));
    e.append(a);
  });
}

A.guides={list:TECH,open,techList,knotList};
const prev=A.hooks.profil; A.hooks.profil=()=>{ prev?.(); panel(); };
const prevC=A.hooks.change; A.hooks.change=(...a)=>{ prevC?.(...a); panel(); needLogin(); };
discover(); panel(); setTimeout(needLogin,800);
})();
