// Rivio : étangs, lacs et carpodromes où pêcher, avec leurs règles et un lien.
// Données relevées à la main sur des sources publiques (fédération, offices de
// tourisme, gestionnaires), avec la date de consultation. Vérifier avant de
// partir : arrêtés sécheresse, fermetures et tarifs changent en cours d'année.
// « approx » : position de la commune, pas de l'entrée de l'étang.
(function(){
"use strict";
const A=window.CDJ; if(!A) return;
const {el,toast}=A;
const VU="2026-11-04";
const ETANGS=[
  {id:"clarens",nom:"Lac de Clarens",commune:"Casteljaloux",dep:"47",lat:44.28887,lon:0.06797,type:"public",ha:17.4,
   nuit:true,tags:["Carpe de nuit","Label Famille","Ponton PMR","Float-tube"],
   infos:"2e catégorie, pêche toute l'année. Carnassiers trophées et poissons blancs. Réglementation particulière : se renseigner.",
   acces:"Carte de pêche + vignette Club halieutique",url:"https://www.generationpeche.fr/parcours-labellise/310/1146-lac-de-clarens-a-casteljaloux.htm",src:"Génération Pêche · Tourisme Lot-et-Garonne"},
  {id:"coulon",nom:"Lac de Coulon",commune:"Monflanquin",dep:"47",lat:44.52948,lon:0.75089,type:"public",ha:2.5,
   nuit:true,tags:["Carpe de nuit","Label Famille","No-kill carnassiers"],
   infos:"Plaine des sports, au sud du village. Carnassiers, poissons blancs et carpe de nuit, pendant l'ouverture.",
   acces:"Carte de pêche",url:"https://www.cirkwi.com/en/point-interet/1748803-parcours-de-peche-famille-lac-de-coulon",src:"Tourisme Lot-et-Garonne (Cirkwi) · Fédération 47"},
  {id:"touret",nom:"Carpodrome du Touret",commune:"Saint-Laurent",dep:"47",lat:44.23227,lon:0.40352,type:"carpodrome",ha:2.8,
   nuit:false,tags:["Carpodrome","No-kill","Concours carpe"],
   infos:"Parcours « Passion » aménagé pour la carpe de jour, en no-kill. Réglementation particulière : se renseigner.",
   acces:"Carte de pêche, accès libre",url:"https://www.cirkwi.com/fr/point-interet/1748804-parcours-de-peche-passion-carpodome-du-touret",src:"Tourisme Lot-et-Garonne (Cirkwi) · Fédération 47"},
  {id:"lescourroux",nom:"Lac du Lescourroux",commune:"Soumensac",dep:"47",lat:44.68237,lon:0.35377,type:"public",
   nuit:true,tags:["Carpe de nuit","Float-tube","Réserves"],
   infos:"Deux plans d'eau à cheval sur la Dordogne et le Lot-et-Garonne : carpe à toute heure toute l'année, réserves de pêche à respecter. Le plan d'eau voisin (24/47) a ses propres règles. Fermetures possibles en cas de sécheresse.",
   acces:"Carte de pêche",url:"https://www.federationpechedordogne.fr/zone-de-peche/parcours-de-peche-a-la-carpe-de-nuit-plans-deau-du-lescourroux/",src:"Fédération de pêche de la Dordogne · Office de tourisme du Pays de Lauzun"},
  {id:"lauzun",nom:"Lac de Lauzun",commune:"Lauzun",dep:"47",lat:44.62814,lon:0.45766,type:"public",ha:1,
   nuit:false,tags:["Label Famille","Ponton PMR","No-kill carnassiers"],
   infos:"Petit lac de 2e catégorie : carpes, gardons, brochets et perches. Carnassiers à remettre à l'eau.",
   acces:"Carte de pêche",url:"https://www.paysdelauzun.com/en/offres/lac-de-lauzun/",src:"Office de tourisme du Pays de Lauzun"},
  {id:"carpe-experience",nom:"Carpe Expérience",commune:"Feugarolles",dep:"47",lat:44.2236,lon:0.3436,approx:true,type:"prive",ha:9,
   nuit:true,tags:["Étang privé","No-kill","Réservation","5 postes"],
   infos:"Gravière de 9 ha dans un parc clos, 5 postes pour 10 pêcheurs, 3 cannes. Séjours de 48 h minimum (environ 75 € les 48 h, 250 € la semaine au moment du relevé). Carnassiers interdits.",
   acces:"Réservation : 06 30 99 73 52",url:"https://www.colinmaire.net/carpe-experience/",src:"Colin Maire (fiche du lac)"},
  {id:"neguenou",nom:"Lac de Néguenou",commune:"Prayssas",dep:"47",lat:44.2886,lon:0.5126,approx:true,type:"prive",
   nuit:false,tags:["Étang privé","No-kill","Camping"],
   infos:"Lac privé d'un camping, pêche exclusivement en no-kill : carpes, brochets, perches et sandres.",
   acces:"Avec un séjour au camping",url:"https://www.lacdeneguenou.fr/camping-peche-lot-et-garonne/",src:"Camping du lac de Néguenou"}
];
const T={public:["🏞️","Plan d'eau fédéral","#2c5f8f"],carpodrome:["🎯","Carpodrome","#d9822b"],prive:["🔒","Étang privé","#6b4fbf"]};
window.CDJ_ETANGS=ETANGS;
let on=false, layer=null, map=null;
try{ on=localStorage.getItem("cdj-etangs")==="1"; }catch(e){}
const save=()=>{ try{ localStorage.setItem("cdj-etangs",on?"1":"0"); }catch(e){} };

function card(e){
  const [ic,lab]=T[e.type];
  const d=el("div","etang-pop");
  d.append(el("b",null,ic+" "+e.nom), el("div","note",lab+" · "+e.commune+" ("+e.dep+")"+(e.ha?" · "+String(e.ha).replace(".",",")+" ha":"")));
  const tg=el("div","etang-tags"); e.tags.forEach(t=>tg.append(el("span","chip",t))); d.append(tg);
  d.append(el("p",null,e.infos), el("div","note","🎫 "+e.acces));
  if(e.approx) d.append(el("div","note","📍 Position approximative (commune) : vérifie l'accès exact sur la fiche."));
  const prep=el("div","etang-prep");
  prep.append(el("b",null,"🧭 Préparer ce lieu"),el("span","note","Profondeurs : Rivio ne référence pas de bathymétrie vérifiée pour cette fiche. Règles locales : résumé du département seulement, parcours à confirmer."));
  d.append(prep);
  const prepare=el("button","btn primary small","🌤️ Préparer ma sortie ici"); prepare.type="button";
  prepare.addEventListener("click",()=>{
    if(window.CDJ_REGL?.[e.dep]){
      try{ localStorage.setItem("cdj-regl-dep",e.dep); }catch(_){}
      const sel=document.querySelector("#regl .regl-dep select"); if(sel){ sel.value=e.dep; sel.dispatchEvent(new Event("change")); }
    }
    map?.closePopup(); location.hash="#conseils";
    window.CDJ_ADVICE?.loadAt(e.lat,e.lon,e.nom+(e.approx?" · position approximative":"")).catch(()=>toast("Conditions météo indisponibles pour ce lieu"));
  });
  d.append(prepare);
  const a=el("a",null,"Voir la fiche ↗"); a.href=e.url; a.target="_blank"; a.rel="noopener";
  d.append(a, el("div","note","Source : "+e.src+" · relevé le "+new Date(VU).toLocaleDateString("fr-FR")+". Vérifie les règles et les arrêtés avant de partir."));
  return d;
}
function draw(){
  if(!map||!window.L) return;
  if(!layer) layer=L.layerGroup();
  if(!on){ map.removeLayer(layer); return; }
  layer.clearLayers();
  ETANGS.forEach(e=>{
    const [ic,,col]=T[e.type];
    L.marker([e.lat,e.lon],{icon:L.divIcon({className:"",html:'<div class="zone-pin etang-pin" style="--c:'+col+'">'+ic+'</div>',iconSize:[30,30],iconAnchor:[15,15],popupAnchor:[0,-14]})})
      .bindPopup(card(e),{maxWidth:280}).addTo(layer);
  });
  layer.addTo(map);
}
const prevRow=A.hooks.layersRow;
A.hooks.layersRow=row=>{ prevRow?.(row);
  const b=el("button","btn small"+(on?" on":""),"🎣 Étangs"); b.type="button";
  b.addEventListener("click",()=>{ on=!on; save(); draw(); A.layersBar?.();
    if(on&&map){ const near=ETANGS.filter(e=>map.getBounds().contains([e.lat,e.lon])); if(!near.length) toast("Les étangs relevés sont en Lot-et-Garonne : dézoome ou déplace la carte"); } });
  row.prepend(b);
};
const prevReady=A.hooks.mapReady; A.hooks.mapReady=m=>{ prevReady?.(m); map=m; draw(); };
const prevShown=A.hooks.mapShown; A.hooks.mapShown=m=>{ prevShown?.(m); if(map!==m){ map=m; } draw(); };
if(A.map){ map=A.map; draw(); }
})();
