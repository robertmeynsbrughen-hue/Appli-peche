/* Rivio : moteur de conseils */

(function(){
const $=s=>document.querySelector(s);
const MONTHS=["janv.","févr.","mars","avr.","mai","juin","juil.","août","sept.","oct.","nov.","déc."];
let waterType="etang";
let mode="manual";
let current=null; // {hours:[...], meta:{...}}

// ---------- Soleil et lune ----------
function sunTimes(date,lat,lon){
  const start=new Date(date.getFullYear(),0,0);
  const N=Math.floor((date-start)/864e5);
  const r=Math.PI/180;
  const decl=-23.44*Math.cos(2*Math.PI/365*(N+10))*r;
  const B=2*Math.PI*(N-81)/364;
  const eot=9.87*Math.sin(2*B)-7.53*Math.cos(B)-1.5*Math.sin(B);
  const cosH=(Math.sin(-0.833*r)-Math.sin(lat*r)*Math.sin(decl))/(Math.cos(lat*r)*Math.cos(decl));
  const H=Math.acos(Math.max(-1,Math.min(1,cosH)))/r;
  const noonUTC=12-lon/15-eot/60;
  const off=-date.getTimezoneOffset()/60;
  return {rise:noonUTC-H/15+off,set:noonUTC+H/15+off};
}
function moon(date){
  const syn=29.530588853, ref=Date.UTC(2000,0,6,18,14);
  const age=(((date-ref)/864e5)%syn+syn)%syn;
  const names=["Nouvelle lune","Premier croissant","Premier quartier","Gibbeuse croissante","Pleine lune","Gibbeuse décroissante","Dernier quartier","Dernier croissant"];
  return names[Math.round(age/syn*8)%8];
}
function phase(h,rise,set){
  if(h>=rise-1&&h<rise+1.5) return "aube";
  if(h>=set-1.5&&h<set+1) return "crep";
  if(h>=rise+1.5&&h<set-1.5) return "jour";
  return "nuit";
}
const fmtH=x=>{const h=Math.floor(x),m=Math.round((x-h)*60);return String(h).padStart(2,"0")+"h"+String(m===60?0:m).padStart(2,"0")};

// ---------- Espèces ----------
const SPECIES=[
 {id:"brochet",name:"Brochet",latin:"Esox lucius",t:[4,8,18,23],
  light:{aube:1,jour:.72,crep:1,nuit:.25},
  how:{
   froid:"Pêche lente près du fond : leurre souple 10 à 15 cm en tête plombée légère, jerkbait suspending avec de longues pauses, ou poisson mort manié. Postes : fosses et cassures de 3 à 6 m, bordures d'herbiers morts.",
   tempere:"Sa meilleure période. Prospecte vite pour trouver les poissons actifs : spinnerbait, poisson nageur 10 à 14 cm, shad 12 cm en linéaire. Postes : bordures d'herbiers, embâcles, entrées de bras morts.",
   chaud:"Il s'enfonce et se cale à l'ombre. Vise l'aube avec un leurre de surface ou un swimbait lent en bordure de végétation, puis le plus profond et frais en journée. Relâche-le vite, il supporte mal la chaleur."},
  closed:m=>m>=2&&m<=4},
 {id:"sandre",name:"Sandre",latin:"Sander lucioperca",t:[6,10,22,26],
  light:{aube:1,jour:.4,crep:1,nuit:.85},
  how:{
   froid:"Verticale ou shad 7 à 10 cm traîné très lentement au fond. Poisson mort (gardon, ablette) posé à la tombée de la nuit. Postes : fosses, piles de pont, cassures.",
   tempere:"Shad 8 à 12 cm sur le fond en animation sautillée, ou drop-shot. Eau teintée et faible lumière : c'est le moment clé. Postes : enrochements, ruptures de pente, sorties de courant.",
   chaud:"Pêche de nuit ou à l'aube sur les zones courantes et oxygénées. Petit leurre souple ou vif posé. En journée, cherche le plus profond."},
  closed:m=>m>=2&&m<=4, maybe:m=>m===5},
 {id:"perche",name:"Perche",latin:"Perca fluviatilis",t:[6,10,24,28],
  light:{aube:.8,jour:1,crep:.85,nuit:.15},
  how:{
   froid:"Elles se regroupent en profondeur : drop-shot, micro-jig, petit shad 5 cm au ras du fond, ou ver posé. Une prise annonce souvent un banc entier, insiste au même endroit.",
   tempere:"Cuillère tournante n°1 à 3, micro-leurres souples, petit crankbait. Postes : devant les obstacles, pontons, et surtout les chasses en surface sur les alevins.",
   chaud:"Matin et soir en surface (petits poppers, chasses), journée à l'ombre des pontons et des arbres. Le ver ou le petit vif au flotteur marchent toujours."}},
 {id:"bass",name:"Black-bass",latin:"Micropterus salmoides",t:[10,16,28,32],
  light:{aube:.95,jour:.8,crep:1,nuit:.2},
  how:{
   froid:"Activité très faible. Jig ou texan très lent posé dans les structures profondes, avec de longues pauses. Souvent mieux vaut viser une autre espèce.",
   tempere:"Texan et wacky dans les herbiers et embâcles, chatterbait ou crankbait le long des bordures. Insiste sur les zones qui chauffent au soleil.",
   chaud:"Le moment du top-water : popper, stickbait, frog dans les herbiers à l'aube et au crépuscule. En plein jour, texan sous les nénuphars et à l'ombre."},
  closed:m=>m>=2&&m<=4, maybe:m=>m===5||m===6},
 {id:"silure",name:"Silure",latin:"Silurus glanis",t:[8,14,26,30],
  light:{aube:.9,jour:.55,crep:1,nuit:1},
  how:{
   froid:"Il se regroupe dans les fosses profondes et bouge peu. Verticale avec un gros shad ou gros vif posé au fond, animation très lente. Les touches sont rares, vise les après-midis les plus doux.",
   tempere:"Shad 15 à 25 cm au fond, clonk en bateau, ou appâts posés (vif, bouquet de vers, calamar) près des fosses et des obstacles. Matériel costaud obligatoire : tresse 50/100 minimum.",
   chaud:"Pleine saison. La nuit et les temps orageux sont les meilleurs moments : appâts posés en bordure (vif, bouquet de vers), clonk, ou leurres de surface le soir. Postes : fosses, embâcles, sorties de courant."}},
 {id:"chevesne",name:"Chevesne",latin:"Squalius cephalus",t:[4,10,22,27],
  light:{aube:.9,jour:.85,crep:.9,nuit:.2},
  how:{
   froid:"Il se tient dans les zones calmes et profondes, souvent sous les obstacles. Pain ou fromage en dérive lente, petit leurre souple ou micro-jig animé doucement. Discrétion obligatoire : il est très méfiant.",
   tempere:"Le moment idéal : cuillère n°1 à 2, petit poisson nageur 3 à 5 cm, ou pain en surface. Postes : courants, veines d'eau derrière les rochers, bordures sous les branches.",
   chaud:"Il chasse en surface : insectes (sauterelles, criquets), petits poppers, mouche sèche, cerises ou mûres sous les arbres qui surplombent l'eau. Approche à pas de loup, il voit tout."}},
 {id:"carpe",name:"Carpe",latin:"Cyprinus carpio",t:[8,14,26,30],
  light:{aube:.95,jour:.7,crep:.9,nuit:.95},
  how:{
   froid:"Amorçage très léger (une poignée de bouillettes ou de pellets), bouillettes solubles ou petits appâts fluo. Postes : zones profondes et abritées, ou la rive qui a pris le soleil toute la journée. Sessions longues et patience.",
   tempere:"Amorçage modéré (graines, pellets, bouillettes), montage hair-rig, sac PVA. Postes : bordures, cassures, herbiers. La nuit est souvent la plus productive.",
   chaud:"Les carpes se tiennent en surface ou dans les zones ombragées et oxygénées : pain flottant, zig-rig, amorçage plus copieux. Privilégie la nuit et l'aube, évite les hauts-fonds chauds l'après-midi."}}
];

function tempScore(t,[mn,lo,hi,mx]){
  if(t>=lo&&t<=hi) return 1;
  if(t<lo) return t<=mn?0.08:0.2+0.8*(t-mn)/(lo-mn);
  return t>=mx?0.08:0.2+0.8*(mx-t)/(mx-hi);
}

function scoreHour(sp,c){
  let light=sp.light[c.phase];
  const cloudy=c.cloud>=65, rainy=c.rain>=0.3;
  if(c.phase==="jour"&&(cloudy||rainy)){
    if(sp.id==="brochet") light=.9;
    if(sp.id==="sandre") light=.65;
    if(sp.id==="carpe") light=.8;
    if(sp.id==="silure") light=.7;
  }
  if(sp.id==="carpe"&&c.phase==="jour"&&c.water<11&&!cloudy) light=.85; // le soleil réchauffe l'eau froide
  let s=tempScore(c.water,sp.t)*light;
  const dp=c.dp;
  const mod={
    brochet:(dp<=-1?.12:0)+(dp>=3?-.12:0)+(c.wind>=8&&c.wind<=28?.06:0),
    sandre:(dp<=-1?.08:0)+(dp>=3?-.08:0)+(cloudy?.06:0)+(rainy&&c.rain<4?.06:0)+(waterType!=="etang"?.03:0),
    perche:(Math.abs(dp)<1.2?.08:0)+(dp<=-3?-.06:0)+(c.wind>=5&&c.wind<=22?.04:0),
    bass:(dp>=3?-.15:0)+(Math.abs(dp)<1.2?.05:0)+(!cloudy&&c.air>=15?.05:0)+(waterType==="etang"?.04:0)+(waterType==="riviere"?-.04:0),
    silure:(dp<=-1?.1:0)+(dp>=3?-.08:0)+(rainy&&c.rain<4?.05:0)+(cloudy?.03:0)+(waterType==="riviere"?.06:waterType==="canal"?.02:-.03),
    chevesne:(Math.abs(dp)<1.2?.06:0)+(dp>=3?-.06:0)+(!cloudy&&c.water>=14&&c.phase==="jour"?.05:0)+(waterType==="riviere"?.06:waterType==="etang"?-.04:0),
    carpe:(dp<=-1&&c.water>=12?.08:0)+(dp>=3?-.1:0)+(c.wind>=6&&c.wind<=25&&c.air>=12?.06:0)+(waterType==="etang"?.03:0)
  }[sp.id];
  s+=mod;
  if(c.wind>40) s-=.15;
  if(c.rain>=4) s-=.08;
  return Math.max(0,Math.min(1,s));
}

function reasons(sp,c){
  const r=[]; const ts=tempScore(c.water,sp.t);
  if(ts>=1) r.push(["plus","Eau à "+c.water.toFixed(0)+" °C, plage idéale"]);
  else if(ts<.45) r.push(["minus","Eau à "+c.water.toFixed(0)+" °C, "+(c.water<sp.t[1]?"trop froide":"trop chaude")]);
  else r.push(["","Eau à "+c.water.toFixed(0)+" °C, correcte"]);
  const dp=c.dp;
  if(dp<=-1&&["brochet","sandre","silure"].includes(sp.id)) r.push(["plus","Pression en baisse, souvent synonyme de mordées"]);
  if(dp<=-1&&sp.id==="carpe"&&c.water>=12) r.push(["plus","Dépression douce, carpes actives"]);
  if(dp>=3) r.push(["minus","Forte hausse de pression (front froid)"]);
  if(Math.abs(dp)<1.2&&["perche","bass"].includes(sp.id)) r.push(["plus","Pression stable"]);
  if(c.cloud>=65&&["brochet","sandre","silure"].includes(sp.id)) r.push(["plus","Ciel couvert, faible luminosité"]);
  if(c.cloud<35&&sp.id==="sandre") r.push(["minus","Grand soleil : sandre discret en journée"]);
  if(c.wind>40) r.push(["minus","Vent très fort"]);
  else if(c.wind>=8&&c.wind<=28&&["brochet","carpe","perche"].includes(sp.id)) r.push(["plus","Vent modéré qui ride l'eau"]);
  return r;
}

function band(t){return t<10?"froid":t<=19?"tempere":"chaud"}

// ---------- Bouillettes (carpe) ----------
function carpBait(c,month){
  const t=c.water; let flav, size;
  if(t<8){ flav="fruitées et sucrées, très solubles : ananas, scopex, tutti frutti, fraise"; size="petites (12 à 15 mm), un pop-up fluo jaune ou rose sur le montage, et très peu d'amorce : une poignée suffit"; }
  else if(t<12){ flav="douces et crémeuses : scopex, crème vanille, ananas-banane, ou birdfood"; size="15 mm, en mélangeant appâts posés et pop-up, avec un amorçage léger"; }
  else if(t<=18){
    flav=(month>=9&&month<=11)
      ?"riches en protéines, car les carpes se préparent pour l'hiver : krill, crabe, poisson-calamar"
      :"poisson et fruité mélangés : krill-fraise, scopex-calamar, crabe";
    size="18 à 20 mm, amorçage modéré (bouillettes entières et cassées, pellets)"; }
  else { flav="farines de poisson et saveurs puissantes : calamar, halibut, crustacés, épicées (robin red)"; size="20 mm et plus pour éviter les petits poissons, amorçage plus copieux"; }
  let color;
  if(c.rain>=0.3) color="Eau teintée par la pluie : couleurs vives (jaune, orange, fluo) pour être repérée.";
  else if(c.cloud<35) color="Eau claire et grand soleil : couleurs naturelles (marron, beige), plus discrètes.";
  else color="Couleur : naturelle en amorce, avec un pop-up vif sur le montage pour attirer l'œil.";
  const river=waterType==="riviere"?" En rivière, choisis des bouillettes dures, à dominante poisson ou épicée, qui tiennent dans le courant et diffusent loin.":"";
  return "Bouillettes du moment : "+flav+". Taille : "+size+". "+color+river+" Ce sont des pistes générales : sur un plan d'eau très pêché, l'appât habituel du coin marche souvent mieux.";
}

// ---------- Clarté de l'eau, débit et leurres ----------
const CLARITY_TXT={claire:"claire",teintee:"teintée",trouble:"trouble"};
const FLOW_TXT={basse:"basses eaux",normale:"niveau normal",haute:"eau haute",crue:"en crue"};
function getFlow(meta){
  const v=$("#f-flow")?$("#f-flow").value:"auto";
  if(v!=="auto") return {status:v,trend:"stable",manual:true};
  return meta.flow||null;
}
function getClarity(c,meta){
  const v=$("#f-clarity")?$("#f-clarity").value:"auto";
  if(v!=="auto") return v;
  let s=0;
  const r48=meta.rain48!=null?meta.rain48:(c.rain>=5?20:c.rain>=1?8:0);
  if(r48>=20) s+=2; else if(r48>=6) s+=1;
  const f=waterType!=="etang"?getFlow(meta):null;
  if(f){ if(f.status==="crue") s+=2; else if(f.status==="haute") s+=1; if(f.trend==="hausse") s+=1; if(f.status==="basse") s-=1; }
  return s>=3?"trouble":s>=1?"teintee":"claire";
}
function lureAdvice(sp,c,meta){
  const cl=getClarity(c,meta);
  const low=c.phase!=="jour";
  const sunny=c.phase==="jour"&&c.cloud<35&&c.rain<0.3;
  const t=c.water;
  const flow=waterType==="riviere"?getFlow(meta):null;
  const strong=flow&&(flow.status==="haute"||flow.status==="crue");
  // coloris
  let col;
  if(c.phase==="nuit") col="noir ou très sombre (la silhouette se voit mieux de nuit), ou blanc";
  else if(cl==="trouble") col="fluo chartreuse, orange ou firetiger, ou noir pour la silhouette";
  else if(cl==="teintee") col=low?"blanc nacré, chartreuse ou dos sombre et ventre orange":"contrastés : chartreuse, blanc, firetiger";
  else col=sunny?"naturels et discrets : ablette, gardon, vairon, finition argentée ou translucide":(low?"naturels avec du contraste : perche, blanc nacré":"naturels : ablette, gardon, perche");
  // leurre selon espèce
  let lure="";
  if(sp.id==="brochet"){
    if(t<10) lure="jerkbait suspending ou shad 12 à 15 cm animé lentement près du fond";
    else if(t>20) lure=low?"leurre de surface (stickbait, frog) au ras des herbiers":"swimbait lent ou shad en bordure, à l'ombre";
    else lure=cl==="claire"?"poisson nageur 10 à 14 cm ou swimbait":"spinnerbait ou shad à grosse palette, qui vibre fort";
  }else if(sp.id==="sandre"){
    lure=t<10?"shad 7 à 10 cm en verticale ou traîné lentement au fond":"shad 8 à 12 cm sautillé sur le fond, ou drop-shot";
    if(c.phase==="nuit") lure="shad ou poisson nageur en récupération lente, dans les zones peu profondes";
  }else if(sp.id==="perche"){
    lure=t<10?"drop-shot ou micro-jig au ras du fond":(t>20&&low?"petit popper ou micro-leurre sur les chasses":"cuillère n°1 à 3 ou micro shad 5 à 7 cm");
    if(cl==="claire"&&sunny) col+=" ; cuillère argentée"; else col+=" ; cuillère cuivre ou dorée";
  }else if(sp.id==="bass"){
    lure=t<12?"jig ou texan très lent dans les structures":(t>20&&low?"popper, stickbait ou frog en surface":"texan, wacky ou chatterbait dans les herbiers");
    col=cl==="claire"?"green pumpkin, watermelon (naturels)":(c.phase==="nuit"||cl==="trouble"?"noir et bleu, junebug":"noir et bleu ou chartreuse");
  }else if(sp.id==="silure"){
    lure=t<12?"gros shad 15 à 20 cm en verticale dans les fosses":"gros shad 20 à 25 cm, leurre à forte vibration, ou clonk";
    col="la couleur compte peu, mise sur la vibration ; noir ou blanc pour la silhouette";
  }else if(sp.id==="chevesne"){
    lure=t<10?"micro-jig ou petit leurre souple 4 à 5 cm animé lentement":(t>18?"insecte, petit popper ou leurre de surface sous les branches":"cuillère n°1 à 2 ou petit poisson nageur 3 à 5 cm");
    col=sunny?"naturels et discrets : vairon, ablette, insecte":"naturels avec un point de couleur : vairon, cuillère cuivre ou dorée";
  }else return null;
  let extra="";
  if(strong) extra="Courant fort : alourdis la tête plombée (5 à 10 g de plus) et cherche les contre-courants près des berges.";
  else if(flow&&flow.status==="basse") extra="Basses eaux : allège les têtes et vise les fosses et zones plus profondes.";
  return {lure,col,extra};
}

// ---------- Rendu ----------
const openTips=new Set();   // menus « Conseils » ouverts, gardés entre deux actualisations
function mk(tag,cls,text){ const e=document.createElement(tag); if(cls) e.className=cls; if(text!=null) e.textContent=text; return e; }
const cap=t=>t.charAt(0).toUpperCase()+t.slice(1);
function render(){
  if(!current) return;
  let {hours,meta}=current;
  const tm=measuredTemp(meta);
  if(tm!=null) hours=hours.map(h=>({...h,water:tm}));
  const now=hours[0];
  const st=$("#status");
  st.innerHTML="";
  st.append(mk("span","pill"+(mode==="live"?"":" manual"),mode==="live"?"En direct":"Exemple"));
  st.append(mk("span",null,meta.place+" · "+meta.when));

  const trend=now.dp<=-3?"forte baisse ↓↓":now.dp<=-1?"en baisse ↓":now.dp>=3?"forte hausse ↑↑":now.dp>=1?"en hausse ↑":"stable →";
  const sky=now.rain>=0.3?"Pluie":now.cloud>=65?"Couvert":now.cloud>=35?"Voilé":"Ensoleillé";
  const clar=getClarity(now,meta);
  // relevé principal
  const hero=$("#hero"); hero.innerHTML="";
  const big=mk("div","hero-temp"); big.append(mk("span","hero-num",now.water.toFixed(1).replace(".",",")),mk("span","hero-unit","°C"));
  const side=mk("div","hero-side");
  side.append(mk("div","hero-k",tm!=null?"Eau mesurée":"Eau estimée"), mk("div","hero-v",sky+" · air "+Math.round(now.air)+"\u00a0°C"), mk("div","hero-v2","Eau "+CLARITY_TXT[clar]+(($("#f-clarity")||{}).value==="auto"?" (estimée)":"")));
  hero.append(big,side);
  if(mode==="live"&&meta.hub?.temp){
    const T=meta.hub.temp;
    hero.append(mk("div","hero-src",(tm!=null?"🌡️ Sonde ":"🌡️ Rivière proche : sonde ")+"« "+T.station+" »"+(T.river?" ("+T.river+")":"")+", à "+T.dist.toFixed(1).replace(".",",")+" km : "+T.v.toFixed(1).replace(".",",")+" °C le "+hhmmOf(T.t)+(tm==null?". Non utilisée car tu as choisi « étang ».":".")));
  }

  const g=$("#grid"); g.innerHTML="";
  const cells=[
    ["Pression",(meta.pressure?Math.round(meta.pressure)+"\u00a0hPa · ":"")+trend.replace(" ","\u00a0")],
    ["Vent",Math.round(now.wind)+" km/h"],
    ["Soleil",fmtH(meta.rise)+" · "+fmtH(meta.set)],
    ["Lune",meta.moon]
  ];
  const start=new Date(); start.setMinutes(0,0,0);
  const pos=meta.lat!=null?meta:DEFAULT_POS;
  const sol=solunar(start,pos.lat,pos.lon);
  cells.push(["Solunaire","★ "+(sol.major.map(hhmm).join(", ")||"–")+" · ☆ "+(sol.minor.map(hhmm).join(", ")||"–")]);
  if(waterType!=="etang"){
    const f=getFlow(meta);
    cells.push(["Débit rivière",f?(f.q!=null?Math.round(f.q)+" m³/s · ":"")+FLOW_TXT[f.status]+(f.trend==="hausse"?" ↑":f.trend==="baisse"?" ↓":""):"indisponible"]);
  }
  const HY=mode==="live"?meta.hub?.hydro:null;
  if(HY){
    const sgn=x=>(x>0?"+":"")+Math.round(x*100)+" cm";
    const parts=[];
    if(HY.h) parts.push(HY.h.m.toFixed(2).replace(".",",")+" m"+(HY.h.d24!=null?" ("+sgn(HY.h.d24)+" en 24 h)":""));
    if(HY.q) parts.push((HY.q.m3>=10?Math.round(HY.q.m3):HY.q.m3.toFixed(1).replace(".",","))+" m³/s"+(HY.q.r24?" (×"+HY.q.r24.toFixed(1).replace(".",",")+" en 24 h)":""));
    cells.push(["Station "+HY.station.replace(/\s*\[.*\]$/,""),parts.join(" · ")+" · relevé "+hhmmOf(Math.max(HY.h?.t||0,HY.q?.t||0))]);
  }
  for(const [k,v] of cells){ const d=mk("div","cell"+(k==="Solunaire"||k.startsWith("Station ")?" wide":"")); d.append(mk("div","k",k),mk("div","v",v)); if(k==="Solunaire") d.title="★ périodes majeures (lune au plus haut ou au plus bas, ±1 h) · ☆ mineures (lever et coucher de lune, ±30 min)"; g.append(d); }
  if(HY){
    const rising=(HY.h&&HY.h.d6!=null&&HY.h.d6>=0.3)||(HY.q&&HY.q.r24&&HY.q.r24>=1.8);
    if(rising){ const w=mk("div","cell wide flood-warn"); w.append(mk("div","k","⚠️ Montée des eaux en cours"),mk("div","v","Le niveau monte vite à la station (crue ou lâcher de barrage possible). Reste loin des bords glissants et ne traverse pas à gué.")); g.append(w); }
  }
  const cmp=mk("button","btn small cmp-btn","📅 Comparer les 7 prochains jours"); cmp.type="button"; cmp.addEventListener("click",compareDays); g.append(cmp);
  const solAt=k=>{ const t=start.getTime()+k*36e5+18e5; return sol.major.some(x=>Math.abs(x-t)<=90*6e4)?"maj":sol.minor.some(x=>Math.abs(x-t)<=60*6e4)?"min":null; };
  loadHist();

  const m=meta.month;
  const results=SPECIES.map(sp=>{
    const series=hours.map(h=>scoreHour(sp,h));
    const theory=Math.max(...series);
    const exp=experience(sp,now,meta);
    const peak=exp&&exp.succ!=null?.7*theory+.3*exp.succ:theory;
    const best=series.map(v=>v>=peak*0.85&&peak>0.15);
    let a=best.indexOf(true), b=a;
    while(b+1<best.length&&best[b+1]) b++;
    return {sp,series,peak,best,a,b,exp};
  }).sort((x,y)=>y.peak-x.peak);

  // espèces favorites du compte en tête, puis la plus adaptée du moment, puis les autres
  const nrm=x=>String(x||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();
  let favs=[]; try{ favs=JSON.parse(localStorage.getItem("cdj-fav")||"[]").map(nrm); }catch(_){}
  const isFav=r=>favs.includes(nrm(r.sp.name));
  const ordered=[...results.filter(isFav),...results.filter(r=>!isFav(r))];
  const bestOther=results.find(r=>!isFav(r));
  // résumé pour l'écran « Aujourd'hui »
  try{
    const hr=k=>new Date(start.getTime()+k*36e5).getHours()+"h";
    window.CDJ_TODAY={live:mode==="live",place:meta.place,when:meta.when,water:now.water,water_measured:tm!=null,air:now.air,sky,wind:now.wind,trend,
      top:results.filter(r=>!(r.sp.closed&&r.sp.closed(m))).slice(0,3).map(r=>({name:r.sp.name,pct:Math.round(r.peak*100),from:r.a>=0?hr(r.a):null,to:r.a>=0?hr(r.b+1):null})),
      fav:results.filter(isFav).map(r=>({name:r.sp.name,pct:Math.round(r.peak*100),from:r.a>=0?hr(r.a):null,to:r.a>=0?hr(r.b+1):null,closed:!!(r.sp.closed&&r.sp.closed(m))}))};
    window.dispatchEvent(new Event("cdj-today"));
  }catch(e){}
  const list=$("#list"); list.innerHTML="";
  ordered.forEach((r,i)=>{
    const fav=isFav(r), top=r===bestOther||(!favs.length&&i===0);
    const card=mk("article","sp"+(top?" top":"")+(fav?" fav":""));
    const pct=Math.round(r.peak*100);
    const closed=r.sp.closed&&r.sp.closed(m), maybe=!closed&&r.sp.maybe&&r.sp.maybe(m);
    // en-tête
    const head=mk("div","sp-head");
    const id=mk("div","sp-id");
    id.append(mk("span","sp-rank",fav?"★":String(results.indexOf(r)+1)));
    const nm=mk("div","sp-name",r.sp.name); nm.append(mk("small",null,r.sp.latin));
    id.append(nm);
    const gauge=mk("div","gauge"); gauge.style.setProperty("--p",pct);
    gauge.append(mk("span",null,String(pct)));
    gauge.setAttribute("role","img"); gauge.setAttribute("aria-label","Score "+pct+" sur 100");
    head.append(id,gauge);
    card.append(head);
    if(fav||(top&&favs.length)) card.append(mk("span","sp-tag "+(fav?"is-fav":"is-top"),fav?"⭐ Ton espèce favorite":"🏆 La plus adaptée en ce moment"));
    if(closed||maybe) card.append(mk("span","flag",closed?"Fermeture probable":"Fermeture possible"));
    // frise 24 h
    const tl=mk("div","timeline");
    const strip=mk("div","strip");
    r.series.forEach((v,k)=>{
      const low=!r.best[k]&&v<0.5;
      const so=solAt(k); const d=mk("div",[r.best[k]?"best":null,low?"low":null,so?"sol-"+so:null].filter(Boolean).join(" ")||null);
      if(!r.best[k]&&!low) d.style.opacity=(0.14+v*0.6).toFixed(2);
      d.style.height=(30+v*70).toFixed(0)+"%";
      d.title=hours[k].label+" : "+Math.round(v*100);
      strip.append(d);
    });
    const axis=mk("div","axis"); hours.forEach((h,k)=>{ if(k%3===0) axis.append(mk("span",null,h.label)); });
    tl.append(strip,axis); card.append(tl);
    const win=mk("div","window");
    if(r.a<0) win.textContent="Aucun créneau vraiment favorable dans les 24 h.";
    else{ win.append("Meilleur créneau "); win.append(mk("b",null,hours[r.a].label+" – "+(hours[r.b+1]?hours[r.b+1].label:hours[r.b].label))); }
    card.append(win);
    if(r.exp&&r.exp.n>=3) card.append(mk("div","exp","📒 Vos bilans : "+r.exp.n+" sorties dans des conditions proches, "+r.exp.caught+" avec prise"+(r.exp.succ>=.55?" · bon signe":r.exp.succ<.25?" · souvent difficile":"")));
    // menu déroulant des conseils
    const det=mk("details","tips"); det.open=openTips.has(r.sp.id);
    det.addEventListener("toggle",()=>{ det.open?openTips.add(r.sp.id):openTips.delete(r.sp.id); });
    det.append(mk("summary",null,"Conseils de pêche"));
    const body=mk("div","tips-body");
    const ch=mk("div","chips");
    for(const [cls,txt] of reasons(r.sp,now)) ch.append(mk("span","chip "+cls,txt));
    body.append(ch);
    const sec=(title,cls)=>{ const b=mk("section","tip"+(cls?" "+cls:"")); b.append(mk("h4",null,title)); body.append(b); return b; };
    sec("Technique et postes").append(mk("p",null,r.sp.how[band(now.water)]));
    const lh=hours[r.a>=0?r.a:0];
    const la=lureAdvice(r.sp,lh,meta);
    if(la){
      const b=sec("Leurre et coloris"+(r.a>0?" pour "+lh.label:""),"lure");
      const dl=mk("dl");
      dl.append(mk("dt",null,"Leurre"),mk("dd",null,cap(la.lure)),mk("dt",null,"Coloris"),mk("dd",null,cap(la.col)));
      b.append(dl);
      if(la.extra) b.append(mk("p","tip-extra",la.extra));
    }
    if(r.sp.id==="carpe") sec("Bouillettes","bait").append(mk("p",null,carpBait(now,m).replace(/^Bouillettes du moment : /,"").replace(/^./,c=>c.toUpperCase())));
    if(closed||maybe) body.append(mk("p","warn",closed?"Période de fermeture probable en 2e catégorie : vérifie l'arrêté de ton département avant de le cibler.":"Fermeture possible selon les départements à cette période : vérifie la réglementation locale."));
    det.append(body); card.append(det);
    list.append(card);
  });
}

// ---------- Solunaire : position de la lune (formules simplifiées de SunCalc) ----------
const RAD=Math.PI/180;
function moonAlt(date,lat,lon){
  const d=date/864e5-0.5+2440588-2451545, e=RAD*23.4397;
  const L=RAD*(218.316+13.176396*d), M=RAD*(134.963+13.064993*d), F=RAD*(93.272+13.22935*d);
  const l=L+RAD*6.289*Math.sin(M), b=RAD*5.128*Math.sin(F);
  const ra=Math.atan2(Math.sin(l)*Math.cos(e)-Math.tan(b)*Math.sin(e),Math.cos(l));
  const dec=Math.asin(Math.sin(b)*Math.cos(e)+Math.cos(b)*Math.sin(e)*Math.sin(l));
  const H=RAD*(280.16+360.9856235*d)+RAD*lon-ra, phi=RAD*lat;
  return Math.asin(Math.sin(phi)*Math.sin(dec)+Math.cos(phi)*Math.cos(dec)*Math.cos(H));
}
// périodes majeures (lune au plus haut ou au plus bas) et mineures (lever, coucher) sur 24 h
function solunar(start,lat,lon){
  const step=6e5, n=24*6+2, a=[];
  for(let i=-1;i<=n;i++) a.push(moonAlt(new Date(start.getTime()+i*step),lat,lon));
  const major=[], minor=[];
  for(let i=1;i<a.length-1;i++){
    const t=new Date(start.getTime()+(i-1)*step);
    if(t<start||t>start.getTime()+864e5) continue;
    if((a[i]>a[i-1]&&a[i]>=a[i+1])||(a[i]<a[i-1]&&a[i]<=a[i+1])) major.push(t);
    if((a[i-1]<0&&a[i]>=0)||(a[i-1]>0&&a[i]<=0)) minor.push(t);
  }
  return {major,minor};
}
const hhmm=d=>String(d.getHours()).padStart(2,"0")+"h"+String(d.getMinutes()).padStart(2,"0");

// ---------- Ce que disent vos bilans (conditions proches, près d'ici) ----------
let hist=null, histTry=0;
async function loadHist(){
  const A=window.CDJ; if(!A||!A.me||!A.sb||hist||Date.now()-histTry<60000) return;
  histTry=Date.now();
  try{
    const [{data:se},{data:po}]=await Promise.all([
      A.sb.from("sessions").select("species,caught,rating,conditions").not("conditions","is",null).limit(2000),
      A.sb.from("posts").select("species,conditions").eq("status","published").not("conditions","is",null).limit(2000),
    ]);
    hist=[...(se||[]).map(x=>({sp:x.species,ok:x.caught!==false,r:x.rating||2,c:x.conditions})),...(po||[]).map(x=>({sp:x.species,ok:true,r:3,c:x.conditions}))];
    render();
  }catch(e){}
}
function km(a,b,c,d){ const R=6371, dl=(c-a)*RAD, dg=(d-b)*RAD; const h=Math.sin(dl/2)**2+Math.cos(a*RAD)*Math.cos(c*RAD)*Math.sin(dg/2)**2; return 2*R*Math.asin(Math.sqrt(h)); }
function experience(sp,now,meta){
  if(!hist) return null;
  const nm=sp.name.toLowerCase();
  const near=hist.filter(h=>String(h.sp||"").toLowerCase()===nm&&h.c).map(h=>{
    const c=h.c;
    let d=Math.abs((c.water??now.water)-now.water)/3+Math.abs((c.dp??0)-now.dp)/2+Math.abs((c.wind??now.wind)-now.wind)/15+Math.abs((c.cloud??now.cloud)-now.cloud)/60;
    if(c.phase&&c.phase!==now.phase) d+=.5;
    if(c.lat!=null&&meta.lat!=null&&km(c.lat,c.lon,meta.lat,meta.lon)>30) d+=1;
    return {d,ok:h.ok,r:h.r};
  }).filter(x=>x.d<2.5).sort((a,b)=>a.d-b.d).slice(0,8);
  if(near.length<3) return {n:near.length};
  return {n:near.length,caught:near.filter(x=>x.ok).length,succ:near.reduce((a,x)=>a+(x.ok?x.r/4:0),0)/near.length};
}

// ---------- Comparateur des 7 prochains jours ----------
async function compareDays(){
  const pos=current&&current.meta.lat!=null?current.meta:DEFAULT_POS;
  const back=mk("div","sheet-back"); const sh=mk("div","sheet cmp-sheet"); sh.setAttribute("role","dialog"); sh.setAttribute("aria-modal","true"); sh.setAttribute("aria-label","Comparer les jours");
  const head=mk("div","sheet-head"); head.append(mk("h2",null,"Quel jour aller pêcher ?"));
  const x=mk("button","icon-btn"); x.type="button"; x.setAttribute("aria-label","Fermer"); x.innerHTML='<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  const close=()=>{ back.remove(); document.removeEventListener("keydown",esc); }; const esc=e=>{ if(e.key==="Escape") close(); };
  x.addEventListener("click",close); back.addEventListener("click",e=>{ if(e.target===back) close(); }); document.addEventListener("keydown",esc);
  head.append(x); sh.append(head, mk("p","note","Chargement des prévisions…")); back.append(sh); document.body.append(back);
  let d;
  try{
    const url="https://api.open-meteo.com/v1/forecast?latitude="+pos.lat.toFixed(3)+"&longitude="+pos.lon.toFixed(3)+"&hourly=temperature_2m,surface_pressure,cloud_cover,wind_speed_10m,precipitation&past_days=5&forecast_days=7&timezone=auto";
    const r=await fetch(url); if(!r.ok) throw 0; d=await r.json();
  }catch(e){ sh.lastChild.textContent="Prévisions indisponibles (pas de réseau ?)."; return; }
  const H=d.hourly, days=[...new Set(H.time.map(t=>t.slice(0,10)))];
  const today=new Date(); const todayKey=today.getFullYear()+"-"+String(today.getMonth()+1).padStart(2,"0")+"-"+String(today.getDate()).padStart(2,"0");
  const list=days.filter(k=>k>=todayKey).slice(0,7);
  const res=list.map(k=>{
    const i0=H.time.indexOf(k+"T00:00");
    const past=H.temperature_2m.slice(Math.max(0,i0-120),i0+1).filter(v=>v!=null);
    const water=Math.max(2,Math.min(30,0.85*past.reduce((a,b)=>a+b,0)/past.length+1.5));
    const date=new Date(k+"T12:00:00"); const {rise,set}=sunTimes(date,pos.lat,pos.lon);
    const per=SPECIES.map(sp=>{
      let best=0, at=null;
      for(let h=5;h<=22;h++){ const i=i0+h; if(H.time[i]==null) break;
        const c={phase:phase(h+.5,rise,set),water,air:H.temperature_2m[i],dp:(H.surface_pressure[i]??0)-(H.surface_pressure[i-3]??H.surface_pressure[i]),wind:H.wind_speed_10m[i],cloud:H.cloud_cover[i],rain:H.precipitation[i]||0};
        const v=scoreHour(sp,c); if(v>best){ best=v; at=h; } }
      const closed=sp.closed&&sp.closed(date.getMonth()+1);
      return {sp,best:closed?0:best,at,closed};
    });
    const rain=H.precipitation.slice(i0+5,i0+22).reduce((a,v)=>a+(v||0),0), wind=Math.max(...H.wind_speed_10m.slice(i0+5,i0+22));
    return {k,date,per,rain,wind,top:Math.max(...per.map(p=>p.best))};
  });
  sh.lastChild.remove();
  const bestDay=res.reduce((a,b)=>b.top>a.top?b:a,res[0]);
  sh.append(mk("p","note","Meilleur score de la journée (5 h à 22 h) pour chaque espèce, d'après les prévisions météo. Touche une case pour l'heure conseillée."));
  const wrap=mk("div","cmp-wrap"); const t=mk("table","cmp");
  const tr=mk("tr"); tr.append(mk("th"));
  res.forEach(r=>{ const th=mk("th",r===bestDay?"best":null); th.append(mk("span",null,r.date.toLocaleDateString("fr-FR",{weekday:"short"})),mk("small",null,r.date.getDate()+"/"+(r.date.getMonth()+1))); tr.append(th); });
  const thead=mk("thead"); thead.append(tr); t.append(thead);
  const tb=mk("tbody");
  SPECIES.forEach((sp,j)=>{
    const row=mk("tr"); row.append(mk("th",null,sp.name));
    const max=Math.max(...res.map(r=>r.per[j].best)), topI=res.findIndex(r=>r.per[j].best===max);
    res.forEach((r,ri)=>{ const p=r.per[j]; const v=Math.round(p.best*100);
      const td=mk("td",p.closed?"closed":(ri===topI&&v>=50?"top":null)); td.textContent=p.closed?"–":String(v);
      td.style.setProperty("--v",p.best.toFixed(2)); td.title=p.closed?"Fermé":(p.at!=null?"Vers "+p.at+"h":"");
      td.tabIndex=0; td.addEventListener("click",()=>info.textContent=sp.name+" · "+r.date.toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long"})+" : "+(p.closed?"fermé":v+" % vers "+p.at+"h"));
      row.append(td); });
    tb.append(row);
  });
  const wr=mk("tr","cmp-meteo"); wr.append(mk("th",null,"Météo"));
  res.forEach(r=>wr.append(mk("td",null,(r.rain>=3?"🌧":r.rain>=.5?"🌦":"☀️")+(r.wind>=35?"💨":""))));
  tb.append(wr); t.append(tb); wrap.append(t); sh.append(wrap);
  const info=mk("p","cmp-info",bestDay?"Meilleure journée : "+bestDay.date.toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long"}):""); sh.append(info);
}

// ---------- Mode manuel ----------
const DEFAULT_POS={lat:44.2,lon:0.6,name:"Sud-Ouest (position par défaut)"};
function buildManual(){
  const water=parseFloat($("#f-water").value)||12;
  const air=parseFloat($("#f-air").value)||14;
  const dp=parseFloat($("#f-trend").value);
  const wind=parseFloat($("#f-wind").value)||0;
  const cloud=parseFloat($("#f-cloud").value);
  const rain=parseFloat($("#f-rain").value);
  const now=new Date();
  const pos=current&&current.meta.lat!=null&&mode==="manual-pos"?current.meta:DEFAULT_POS;
  const {rise,set}=sunTimes(now,pos.lat,pos.lon);
  const hours=[];
  for(let k=0;k<24;k++){
    const d=new Date(now.getTime()+k*36e5);
    const h=d.getHours()+ (k===0?d.getMinutes()/60:0);
    hours.push({label:String(d.getHours()).padStart(2,"0")+"h",phase:phase(h,rise,set),water,air,dp,wind,cloud,rain});
  }
  current={hours,meta:{place:pos.name||DEFAULT_POS.name,lat:pos.lat,lon:pos.lon,
    when:now.getDate()+" "+MONTHS[now.getMonth()]+" "+String(now.getHours()).padStart(2,"0")+"h",
    rise,set,moon:moon(now),month:now.getMonth()+1,pressure:null,
    flow:current&&current.meta?current.meta.flow:null, rain48:null}};
  render();
}

function setDefaults(){
  const m=new Date().getMonth()+1;
  const seasonal={1:5,2:6,3:9,4:12,5:16,6:20,7:23,8:23,9:19,10:14,11:9,12:6}[m];
  $("#f-water").value=seasonal;
  $("#f-air").value=seasonal+2;
  $("#f-trend").value="-1.8";
  $("#f-wind").value=15;
  $("#f-cloud").value="90";
  $("#f-rain").value="0";
}

// ---------- Mode GPS + météo ----------
function note(t){const n=$("#geo-note");n.textContent=t;n.hidden=!t;}

async function fetchWeather(lat,lon){
  const url="https://api.open-meteo.com/v1/forecast?latitude="+lat.toFixed(3)+"&longitude="+lon.toFixed(3)+
    "&hourly=temperature_2m,surface_pressure,cloud_cover,wind_speed_10m,precipitation&daily=sunrise,sunset&past_days=5&forecast_days=2&timezone=auto";
  try{
    const res=await fetch(url);
    if(!res.ok) throw new Error("meteo");
    const d=await res.json();
    try{localStorage.setItem("cdj-meteo",JSON.stringify({lat,lon,ts:Date.now(),d}))}catch(e){}
    return {d,lat,lon,ts:null};
  }catch(e){
    const c=readCache(); if(c) return c; throw e;
  }
}

// ---------- Stations officielles Hub'Eau : niveau, débit et température de l'eau mesurés ----------
const HUB="https://hubeau.eaufrance.fr/api/";
function kmBetween(a,b,c,d){ const r=Math.PI/180, x=Math.sin((c-a)*r/2)**2+Math.cos(a*r)*Math.cos(c*r)*Math.sin((d-b)*r/2)**2; return 12742*Math.asin(Math.sqrt(x)); }
async function hubGet(path,ms=9000){
  const ctl=new AbortController(), t=setTimeout(()=>ctl.abort(),ms);
  try{ const r=await fetch(HUB+path,{signal:ctl.signal}); if(!r.ok) throw new Error("hubeau "+r.status); return await r.json(); }
  finally{ clearTimeout(t); }
}
const pick=(o,...k)=>{ for(const x of k) if(o&&o[x]!=null) return o[x]; return null; };
function nearest(list,lat,lon,max){
  return (list||[]).map(s=>{ const la=Number(pick(s,"latitude_station","latitude","y")), lo=Number(pick(s,"longitude_station","longitude","x")); return {s,d:isFinite(la)&&isFinite(lo)?kmBetween(lat,lon,la,lo):99}; })
    .filter(x=>x.d<=max).sort((a,b)=>a.d-b.d);
}
// hauteur (mm) et débit (l/s) en temps réel de la station la plus proche, sur 26 h
async function fetchHydro(lat,lon){
  const q="referentiel/stations?latitude="+lat.toFixed(4)+"&longitude="+lon.toFixed(4)+"&distance=15&en_service=true&format=json&size=60";
  let st; try{ st=await hubGet("v2/hydrometrie/"+q); }catch(e){ st=await hubGet("v1/hydrometrie/"+q); }
  const since=new Date(Date.now()-26*36e5).toISOString().slice(0,19);
  for(const {s,d} of nearest(st.data,lat,lon,15).slice(0,4)){
    const code=pick(s,"code_station"); if(!code) continue;
    let obs; try{ obs=await hubGet("v2/hydrometrie/observations_tr?code_entite="+code+"&date_debut_obs="+since+"&size=3000&fields=date_obs,resultat_obs,grandeur_hydro&format=json"); }catch(e){ continue; }
    const rows=(obs.data||[]).filter(o=>o.resultat_obs!=null).map(o=>({t:Date.parse(o.date_obs),v:Number(o.resultat_obs),g:o.grandeur_hydro})).sort((a,b)=>a.t-b.t);
    if(!rows.length) continue;
    const ser=g=>{ const r=rows.filter(x=>x.g===g); if(!r.length) return null; const last=r[r.length-1];
      const at=h=>{ const target=last.t-h*36e5; let best=null; for(const x of r) if(Math.abs(x.t-target)<=2*36e5&&(!best||Math.abs(x.t-target)<Math.abs(best.t-target))) best=x; return best?best.v:null; };
      return {now:last.v,t:last.t,h6:at(6),h24:at(24)}; };
    const h=ser("H"), qq=ser("Q");
    if(!h&&!qq) continue;
    if(Date.now()-Math.max(h?.t||0,qq?.t||0)>12*36e5) continue; // station muette
    return {code,station:pick(s,"libelle_station")||code,river:pick(s,"libelle_cours_eau"),dist:d,
      h:h&&{m:h.now/1000,d6:h.h6!=null?(h.now-h.h6)/1000:null,d24:h.h24!=null?(h.now-h.h24)/1000:null,t:h.t},
      q:qq&&{m3:qq.now/1000,r24:qq.h24?qq.now/qq.h24:null,t:qq.t}};
  }
  return null;
}
// dernière température mesurée par une sonde de rivière proche (moins de 5 jours)
async function fetchWaterTemp(lat,lon){
  const st=await hubGet("v1/temperature/station?latitude="+lat.toFixed(4)+"&longitude="+lon.toFixed(4)+"&distance=20&format=json&size=50");
  const since=new Date(Date.now()-6*864e5).toISOString().slice(0,10);
  for(const {s,d} of nearest(st.data,lat,lon,20).slice(0,4)){
    const code=pick(s,"code_station"); if(!code) continue;
    let c; try{ c=await hubGet("v1/temperature/chronique?code_station="+code+"&date_debut_mesure="+since+"&size=1000&format=json&fields=date_mesure_temp,heure_mesure_temp,resultat"); }catch(e){ continue; }
    const rows=(c.data||[]).filter(r=>r.resultat!=null).map(r=>({t:Date.parse(r.date_mesure_temp+"T"+(r.heure_mesure_temp||"12:00:00")),v:Number(r.resultat)})).filter(r=>isFinite(r.t)&&r.v>-1&&r.v<40).sort((a,b)=>a.t-b.t);
    const last=rows[rows.length-1];
    if(last&&Date.now()-last.t<=5*864e5) return {v:last.v,t:last.t,station:pick(s,"libelle_station")||code,river:pick(s,"libelle_cours_eau"),dist:d};
  }
  return null;
}
async function fetchHub(lat,lon){
  const key="cdj-hub-"+lat.toFixed(2)+","+lon.toFixed(2);
  try{ const c=JSON.parse(localStorage.getItem(key)||"null"); if(c&&Date.now()-c.ts<30*6e4) return c.v; }catch(e){}
  const [hydro,temp]=await Promise.all([fetchHydro(lat,lon).catch(()=>null),fetchWaterTemp(lat,lon).catch(()=>null)]);
  const v={hydro,temp};
  try{ localStorage.setItem(key,JSON.stringify({ts:Date.now(),v})); }catch(e){}
  return v;
}
// température mesurée utilisée seulement en rivière ou canal (une sonde de rivière ne dit rien d'un étang)
const measuredTemp=meta=>mode==="live"&&waterType!=="etang"&&meta?.hub?.temp?meta.hub.temp.v:null;
const hhmmOf=t=>new Date(t).toLocaleString("fr-FR",{weekday:"short",hour:"2-digit",minute:"2-digit"});
// Débit de la rivière la plus proche (prévisions GloFAS via Open-Meteo, maille d'environ 5 km)
async function fetchFlow(lat,lon){
  const key="cdj-flow";
  try{
    const url="https://flood-api.open-meteo.com/v1/flood?latitude="+lat.toFixed(3)+"&longitude="+lon.toFixed(3)+"&daily=river_discharge&past_days=92&forecast_days=7";
    const res=await fetch(url); if(!res.ok) throw new Error("flood");
    const d=await res.json(); const t=d.daily.time, q=d.daily.river_discharge;
    const today=new Date().toISOString().slice(0,10);
    let i=t.indexOf(today); if(i<0) i=Math.max(0,t.length-8);
    const past=q.slice(0,i).filter(v=>v!=null).sort((a,b)=>a-b);
    const qi=q[i];
    if(qi==null||!past.length) return null;
    const med=past[Math.floor(past.length/2)];
    if(!(med>0.5)) return null; // pas de vraie rivière à cet endroit
    const r=qi/med, q2=q[Math.min(q.length-1,i+2)];
    const status=r>=2.5?"crue":r>=1.4?"haute":r<=0.6?"basse":"normale";
    const trend=q2>qi*1.15?"hausse":q2<qi*0.85?"baisse":"stable";
    const f={q:qi,status,trend};
    try{localStorage.setItem(key,JSON.stringify({ts:Date.now(),f}))}catch(e){}
    return f;
  }catch(e){
    try{const c=JSON.parse(localStorage.getItem(key)||"null"); if(c&&Date.now()-c.ts<48*36e5) return c.f;}catch(_){}
    return null;
  }
}
function readCache(){
  try{const c=JSON.parse(localStorage.getItem("cdj-meteo")||"null");
    if(c&&Date.now()-c.ts<48*36e5) return {d:c.d,lat:c.lat,lon:c.lon,ts:c.ts};}catch(e){}
  return null;
}
async function loadLive(lat,lon,name){
  const {d,ts,lat:la,lon:lo}=await fetchWeather(lat,lon); lat=la; lon=lo;
  window.CDJ_POS={lat,lon};
  window.dispatchEvent(new CustomEvent("cdj-pos",{detail:{lat,lon}}));
  const H=d.hourly, off=d.utc_offset_seconds||0;
  const nowKey=new Date(Date.now()+off*1000).toISOString().slice(0,13)+":00";
  let i0=H.time.indexOf(nowKey); if(i0<0) i0=Math.max(0,H.time.length-48);
  const past=H.temperature_2m.slice(Math.max(0,i0-120),i0+1).filter(v=>v!=null);
  const avg=past.reduce((a,b)=>a+b,0)/past.length;
  const water=Math.max(2,Math.min(30,0.85*avg+1.5));
  const sun={};
  d.daily.time.forEach((day,k)=>{
    const f=s=>{const [hh,mm]=s.slice(11,16).split(":").map(Number);return hh+mm/60};
    sun[day]={rise:f(d.daily.sunrise[k]),set:f(d.daily.sunset[k])};
  });
  const hours=[];
  for(let k=0;k<24;k++){
    const i=i0+k; const t=H.time[i]; if(!t) break;
    const hh=Number(t.slice(11,13)); const sd=sun[t.slice(0,10)]||Object.values(sun)[0];
    const dp=(H.surface_pressure[i]??0)-(H.surface_pressure[i-3]??H.surface_pressure[i]);
    hours.push({label:String(hh).padStart(2,"0")+"h",phase:phase(hh+.5,sd.rise,sd.set),water,
      air:H.temperature_2m[i],dp,wind:H.wind_speed_10m[i],cloud:H.cloud_cover[i],rain:H.precipitation[i]||0});
  }
  const rain48=H.precipitation.slice(Math.max(0,i0-48),i0+1).reduce((a,v)=>a+(v||0),0);
  const [flow,hub]=await Promise.all([fetchFlow(lat,lon),fetchHub(lat,lon).catch(()=>null)]);
  // le débit mesuré corrige la tendance prévue
  if(flow&&hub?.hydro?.q?.r24){ const r=hub.hydro.q.r24; flow.trend=r>=1.25?"hausse":r<=0.8?"baisse":flow.trend; if(r>=2&&flow.status!=="crue") flow.status="haute"; }
  const today=sun[H.time[i0].slice(0,10)]||Object.values(sun)[0];
  const now=new Date();
  current={hours,meta:{place:name?"📍 "+name:lat.toFixed(3)+", "+lon.toFixed(3),lat,lon,
    when:now.getDate()+" "+MONTHS[now.getMonth()]+" "+String(now.getHours()).padStart(2,"0")+"h",
    rise:today.rise,set:today.set,moon:moon(now),month:now.getMonth()+1,pressure:H.surface_pressure[i0],rain48,flow,hub}};
  mode="live";
  // reporter dans le formulaire pour ajuster ensuite
  const h0=hours[0];
  $("#f-water").value=(measuredTemp(current.meta)??h0.water).toFixed(1); $("#f-air").value=Math.round(h0.air);
  $("#f-wind").value=Math.round(h0.wind);
  $("#f-cloud").value=h0.cloud>=65?"90":h0.cloud>=35?"50":"10";
  $("#f-rain").value=h0.rain>=3?"5":h0.rain>=0.3?"1":"0";
  const opts=[-3.5,-1.8,0,1.8,3.5]; $("#f-trend").value=String(opts.reduce((a,b)=>Math.abs(b-h0.dp)<Math.abs(a-h0.dp)?b:a));
  note(ts?"Hors ligne : météo du "+new Date(ts).toLocaleString("fr-FR",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})+".":"");
  render();
}

function locate(auto){
  const fail=()=>{
    const c=readCache();
    if(c){ loadLive(c.lat,c.lon).catch(()=>{}); return; }
    note("Position ou météo indisponibles. Vérifie que la localisation est autorisée pour l'appli, ou ajuste les conditions à la main.");
  };
  if(!("geolocation" in navigator)){ if(!auto) fail(); return; }
  try{
    navigator.geolocation.getCurrentPosition(
      p=>loadLive(p.coords.latitude,p.coords.longitude).catch(fail),
      ()=>fail(),
      {enableHighAccuracy:false,timeout:10000,maximumAge:600000});
  }catch(e){ fail(); }
}

// ---------- Événements ----------
document.querySelectorAll("#water-type button").forEach(b=>b.addEventListener("click",()=>{
  waterType=b.dataset.v;
  document.querySelectorAll("#water-type button").forEach(x=>x.setAttribute("aria-pressed",String(x===b)));
  try{localStorage.setItem("cdj-water",waterType)}catch(e){}
  render();
}));
$("#apply").addEventListener("click",()=>{mode="manual";buildManual();});
$("#locate").addEventListener("click",()=>locate(false));

try{const w=localStorage.getItem("cdj-water"); if(w){waterType=w;document.querySelectorAll("#water-type button").forEach(x=>x.setAttribute("aria-pressed",String(x.dataset.v===w)));}}catch(e){}
// prévisions jour par jour (jusqu'à 16 jours) : meilleur score et heure conseillée par espèce, pour un lieu donné
const fcCache=new Map();
async function forecastDays(lat,lon,n=16){
  const key=lat.toFixed(2)+","+lon.toFixed(2)+","+n;
  const c=fcCache.get(key); if(c&&Date.now()-c.ts<30*6e4) return c.v;
  const url="https://api.open-meteo.com/v1/forecast?latitude="+lat.toFixed(3)+"&longitude="+lon.toFixed(3)+"&hourly=temperature_2m,surface_pressure,cloud_cover,wind_speed_10m,precipitation&past_days=5&forecast_days="+Math.min(16,n)+"&timezone=auto";
  const r=await fetch(url); if(!r.ok) throw new Error("meteo"); const d=await r.json();
  const H=d.hourly, days=[...new Set(H.time.map(t=>t.slice(0,10)))];
  const today=new Date(); const todayKey=today.getFullYear()+"-"+String(today.getMonth()+1).padStart(2,"0")+"-"+String(today.getDate()).padStart(2,"0");
  const v=days.filter(k=>k>=todayKey).slice(0,n).map(k=>{
    const i0=H.time.indexOf(k+"T00:00");
    const past=H.temperature_2m.slice(Math.max(0,i0-120),i0+1).filter(x=>x!=null);
    const water=Math.max(2,Math.min(30,0.85*past.reduce((a,b)=>a+b,0)/past.length+1.5));
    const date=new Date(k+"T12:00:00"); const {rise,set}=sunTimes(date,lat,lon);
    const per=SPECIES.map(sp=>{
      let best=0, at=null, sc=[];
      for(let h=4;h<=22;h++){ const i=i0+h; if(H.time[i]==null) break;
        const c={phase:phase(h+.5,rise,set),water,air:H.temperature_2m[i],dp:(H.surface_pressure[i]??0)-(H.surface_pressure[i-3]??H.surface_pressure[i]),wind:H.wind_speed_10m[i],cloud:H.cloud_cover[i],rain:H.precipitation[i]||0};
        const x=scoreHour(sp,c); sc.push([h,x]); if(x>best){ best=x; at=h; } }
      // créneau : heures consécutives proches du meilleur score
      let from=at, to=at; if(at!=null){ const ok=h=>{ const e=sc.find(z=>z[0]===h); return e&&e[1]>=best*0.85; }; while(ok(from-1)) from--; while(ok(to+1)) to++; to++; }
      const closed=!!(sp.closed&&sp.closed(date.getMonth()+1));
      return {id:sp.id,name:sp.name,best:closed?0:best,at,from,to,closed};
    });
    const rain=H.precipitation.slice(i0+5,i0+22).reduce((a,x)=>a+(x||0),0), wind=Math.max(...H.wind_speed_10m.slice(i0+5,i0+22).filter(x=>x!=null));
    return {k,date,water,per,rain,wind,top:Math.max(...per.map(p=>p.best)),moon:moon(date)};
  });
  fcCache.set(key,{ts:Date.now(),v});
  return v;
}
window.CDJ_ADVICE={ forecastDays, moon, defaultPos:()=>DEFAULT_POS, current:()=>current?.meta?{lat:current.meta.lat,lon:current.meta.lon}:null, loadAt:(lat,lon,name)=>loadLive(lat,lon,name), species:()=>SPECIES.map(s=>s.name||s.id),
  // conditions du moment, enregistrées avec les bilans et les prises (seulement si la météo est réelle)
  snapshot:()=>{ if(!current||mode!=="live") return null; const h=current.hours[0], m=current.meta; const tmv=measuredTemp(m);
    return {water:+(tmv??h.water).toFixed(1),water_measured:tmv!=null,air:Math.round(h.air),dp:+h.dp.toFixed(1),wind:Math.round(h.wind),cloud:Math.round(h.cloud),rain:+(h.rain||0).toFixed(1),phase:h.phase,hour:new Date().getHours(),lat:+m.lat.toFixed(3),lon:+m.lon.toFixed(3),water_type:waterType,flow:m.flow?.status||null}; },
  refresh:()=>{ hist=null; histTry=0; loadHist(); }, rerender:()=>render() };
window.addEventListener("cdj-fav",()=>{ try{ render(); }catch(_){} });
setDefaults();
buildManual();
locate(true);
})();
