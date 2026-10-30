// Rivio : calculateurs de pêche (plomb, fil, amorce, conversions) et agenda pêche du groupe.
(function(){
"use strict";
const A=window.CDJ; if(!A) return;
const {el,toast,frError}=A;
const $=s=>document.querySelector(s);
function btn(label,cls,fn){ const b=el("button",cls||"btn",label); b.type="button"; if(fn) b.addEventListener("click",fn); return b; }
function sheet(title,cls){
  const back=el("div","sheet-back"), sh=el("div","sheet "+(cls||"")); sh.setAttribute("role","dialog"); sh.setAttribute("aria-modal","true"); sh.setAttribute("aria-label",title);
  const head=el("div","sheet-head"); head.append(el("h2",null,title)); const x=btn("✕","icon-btn"); x.setAttribute("aria-label","Fermer"); head.append(x); sh.append(head);
  const close=()=>back.remove(); x.addEventListener("click",close); back.addEventListener("click",e=>{ if(e.target===back) close(); });
  back.append(sh); document.body.append(back); return {sh,close};
}
// petite rangée de choix (segment) qui renvoie la valeur choisie
function seg(label,opts,val,onChange){
  const w=el("div","calc-field"); w.append(el("span","calc-lab",label));
  const s=el("div","seg calc-seg"); let cur=val;
  opts.forEach(([v,t])=>{ const b=btn(t,null,()=>{ cur=v; [...s.children].forEach(x=>x.setAttribute("aria-pressed",String(x===b))); onChange(); }); b.setAttribute("aria-pressed",String(v===val)); s.append(b); });
  w.append(s); w.val=()=>cur; return w;
}
const num=x=>String(x).replace(".",",");

/* ---------- Poids de plomb ---------- */
function lead(){
  const {sh}=sheet("Poids de plomb","calc-sheet");
  sh.append(el("p","note","Le bon poids tient le fond sans dériver, et reste lançable. Commence par la valeur conseillée, puis ajuste : si le montage roule, monte d'un cran."));
  const out=el("div","calc-out");
  const t=seg("Pêche",[["carpe","Carpe au fond"],["feeder","Feeder"],["pose","Posé carnassier"]],"carpe",up);
  const c=seg("Courant",[[0,"Étang"],[1,"Faible"],[2,"Moyen"],[3,"Fort"]],0,up);
  const d=seg("Distance",[[0,"< 30 m"],[1,"30–60 m"],[2,"60–100 m"],[3,"> 100 m"]],1,up);
  sh.append(t,c,d,out);
  function up(){
    const T=t.val(), C=c.val(), D=d.val();
    const base={carpe:[[70,90],[90,110],[110,140],[150,200]],feeder:[[20,30],[30,50],[50,80],[80,120]],pose:[[20,40],[40,60],[60,90],[90,150]]}[T][C];
    const add=T==="carpe"?[0,0,15,30][D]:[0,0,10,20][D];
    const lo=base[0]+add, hi=base[1]+add;
    out.innerHTML="";
    out.append(el("b","calc-big",lo+" à "+hi+" g"));
    const tips=[];
    if(T==="carpe") tips.push("Plomb sur clip ou en ligne, toujours éjectable en cas de casse.",C>=2?"Avec du courant : plomb plat ou à picots, il tient mieux le fond.":"Sur fond vaseux, préfère un plomb plat qui ne s'enfonce pas.");
    if(T==="feeder") tips.push("Le poids comprend la cage remplie.",C>=2?"Courant fort : cage plombée en bas, scion plus raide.":"En étang, une petite cage de 20 à 30 g suffit souvent.");
    if(T==="pose") tips.push("Plomb coulissant pour que le carnassier n'ait aucune résistance.",C>=2?"Courant fort : plomb plat ou montage à bras pour éviter que le vif s'emmêle.":"Ligne bien tendue et détecteur ou flotteur indicateur.");
    if(D===3) tips.push("Au-delà de 100 m, une arrachée (shock leader) est indispensable pour le lancer.");
    const ul=el("ul"); tips.forEach(x=>ul.append(el("li",null,x))); out.append(ul);
  }
  up();
}

/* ---------- Diamètre de fil ---------- */
const LINES={
  "Perche":{t:"0,06–0,10 mm (PE 0,4–0,8 · 6–12 lb)",b:"fluorocarbone 0,20–0,26 mm",n:"nylon 0,16–0,20 mm"},
  "Sandre":{t:"0,10–0,13 mm (PE 0,8–1 · 12–18 lb)",b:"fluorocarbone 0,28–0,35 mm",n:"nylon 0,25–0,30 mm"},
  "Brochet":{t:"0,13–0,19 mm (PE 1–2 · 18–30 lb)",b:"acier 7–15 kg ou fluorocarbone 0,60–0,80 mm",n:"nylon 0,30–0,35 mm"},
  "Black-bass":{t:"0,13–0,17 mm (PE 1–1,5 · 16–25 lb)",b:"fluorocarbone 0,30–0,40 mm",n:"nylon 0,28–0,32 mm"},
  "Silure":{t:"0,35–0,60 mm (80–130 lb)",b:"tresse ou nylon 1,00 mm et plus",n:"nylon 0,60–0,80 mm"},
  "Carpe":{t:"tresse de 20–30 lb seulement en bas de ligne",b:"bas de ligne 15–25 lb ; arrachée 0,50–0,60 mm pour les gros lancers",n:"nylon 0,30–0,40 mm en corps de ligne"},
  "Chevesne":{t:"0,08–0,10 mm (PE 0,6 · 8–10 lb)",b:"fluorocarbone 0,20–0,22 mm",n:"nylon 0,18–0,22 mm"},
  "Aspe":{t:"0,10–0,14 mm (PE 0,8–1,2 · 12–20 lb)",b:"fluorocarbone 0,28–0,30 mm",n:"nylon 0,25–0,28 mm"},
};
function line(){
  const {sh}=sheet("Diamètre de fil","calc-sheet");
  sh.append(el("p","note","Les plages ci-dessous conviennent à une pêche en bordure dégagée. En zone encombrée (bois, herbiers, rochers), monte d'un cran."));
  const out=el("div","calc-out");
  const sp=seg("Espèce",Object.keys(LINES).map(k=>[k,k]),"Brochet",up);
  const env=seg("Poste",[["clair","Dégagé"],["enc","Encombré"]],"clair",up);
  sh.append(sp,env,out);
  function up(){
    const L=LINES[sp.val()], enc=env.val()==="enc";
    out.innerHTML="";
    const tb=el("div","calc-table");
    [["Tresse (corps de ligne)",L.t],["Bas de ligne",L.b],["Nylon (corps de ligne)",L.n]].forEach(([k,v])=>{ const r=el("div","ct-row"); r.append(el("span","note",k),el("b",null,v)); tb.append(r); });
    out.append(tb);
    if(enc) out.append(el("p","calc-tip","🌿 Poste encombré : prends le haut de la plage, voire le cran au-dessus, et resserre le frein un peu plus."));
    if(sp.val()==="Brochet") out.append(el("p","calc-tip","⚠️ Toujours un bas de ligne anti-coupure pour le brochet, même en pêchant la perche ou le sandre là où il y en a."));
  }
  up();
}

/* ---------- Quantité d'amorce ---------- */
function bait(){
  const {sh}=sheet("Amorce : quantité et type","calc-sheet");
  sh.append(el("p","note","Un point de départ, à ajuster selon les touches : mieux vaut amorcer peu et souvent que trop d'un coup, surtout en eau froide."));
  // les conditions du jour pré-remplissent les choix quand elles sont connues
  const S=window.CDJ_ADVICE?.snapshot?.()||null;
  const w0=S?.water!=null?(S.water<10?0:S.water<=18?1:2):1;
  const p0=S?(S.water_type==="etang"?"etang":(S.flow==="haute"||S.flow==="crue")?"courant":"lente"):"etang";
  const c0=S?.clarity==="trouble"?"trouble":S?.clarity==="claire"?"claire":"teintee";
  const out=el("div","calc-out"), typ=el("div","calc-out calc-type");
  const t=seg("Pêche",[["carpe","Carpe"],["feeder","Feeder / coup"]],"carpe",up);
  const w=seg("Eau",[[0,"Froide < 10 °C"],[1,"10–18 °C"],[2,"Chaude > 18 °C"]],w0,up);
  const pst=seg("Poste",[["etang","Étang, lac"],["lente","Rivière lente"],["courant","Courant fort"]],p0,up);
  const cl=seg("Couleur de l'eau",[["claire","Claire"],["teintee","Teintée"],["trouble","Trouble"]],c0,up);
  const h=seg("Durée",[[4,"4 h"],[12,"12 h"],[24,"24 h"],[48,"48 h"],[72,"72 h"]],24,up);
  const r=seg("Cannes",[[1,"1"],[2,"2"],[3,"3"],[4,"4"]],2,up);
  if(S) sh.append(el("p","calc-tip","📡 Pré-réglé avec les conditions du jour : eau à "+num(S.water)+" °C"+(S.dp<=-1?", pression en baisse":S.dp>=1?", pression en hausse":"")+(S.clarity?", eau "+(S.clarity==="teintee"?"teintée":S.clarity)+" probable":"")+"."));
  sh.append(t,w,pst,cl,h,r,out,typ);
  function up(){
    const T=t.val(), W=w.val(), H=h.val(), R=r.val();
    let lo,hi,unit;
    if(T==="carpe"){ const per=[[0.3,0.5],[1,2],[2,3]][W]; lo=per[0]*R*H/24; hi=per[1]*R*H/24; unit="kg"; }
    else{ const per=[[0.08,0.12],[0.2,0.3],[0.3,0.5]][W]; lo=per[0]*H*R; hi=per[1]*H*R; unit="kg de mélange humidifié"; }
    const f=x=>num(x<1?Math.round(x*10)/10:Math.round(x*2)/2);
    out.innerHTML="";
    out.append(el("b","calc-big",f(lo)+" à "+f(hi)+" "+unit));
    const ul=el("ul");
    if(T==="carpe"){
      ul.append(el("li",null,"Environ un tiers au premier amorçage, puis le reste par petites touches."));
      ul.append(el("li",null,W===0?"Eau froide : privilégie des appâts solubles et très attractifs, en petite quantité.":"Mélange bouillettes, graines et pellets pour tenir les poissons sur le poste."));
      ul.append(el("li",null,"Le carnet d'amorçage te dira, avec le temps, la bonne dose pour ton poste."));
    }else{
      ul.append(el("li",null,"8 à 10 cages pleines au départ pour créer le coup, puis une cage à chaque lancer."));
      ul.append(el("li",null,W===0?"Eau froide : mélange fin et peu nourrissant.":"Eau chaude : mélange plus riche, plus collant si le courant est fort."));
    }
    out.append(ul);
    // type d'amorce le plus adapté
    const P=pst.val(), C=cl.val(), dp=S?.dp??0, items=[];
    if(T==="carpe"){
      items.push(W===0?"Appâts solubles et très attractifs, peu nourrissants : petites bouillettes (14–15 mm), sticks PVA de pellets fins, pop-ups de couleur vive.":W===1?"Mélange équilibré : bouillettes 16–20 mm, pellets de 4 à 8 mm, maïs ou tigernuts en appoint.":"Amorce nourrissante : bouillettes 20 mm et plus, graines préparées (chènevis, maïs, tigernuts), gros pellets.");
      if(W===0) items.push("Évite les graines en quantité : elles rassasient vite des poissons qui mangent peu.");
      if(P==="courant") items.push("Courant fort : bouillettes dures et pellets lourds qui coulent vite ; les graines légères partent avec le courant.");
      else if(P==="lente") items.push("Rivière lente : amorce un peu en amont du poste, la nourriture dérive vers ton coup.");
      else items.push("Étang : le spod ou la fronde permettent un amorçage précis et regroupé.");
    }else{
      items.push(W===0?"Mélange fin et peu nourrissant, couleur sombre, avec de la terre de rivière ; vers de vase ou petits asticots en esche.":W===1?"Mélange classique gardon–brème, sucré ou biscuité, avec du chènevis moulu.":"Mélange riche et nourrissant, avec pellets fins et graines ; gros asticots ou maïs en esche pour les brèmes et les carpes.");
      if(P==="courant") items.push("Courant fort : mélange lourd et collant (ajoute de la terre ou de la colle), boulettes bien serrées.");
      else if(P==="etang") items.push("Étang : mélange plus aérien qui forme un nuage, boulettes peu serrées.");
      else items.push("Rivière lente : mélange moyennement collant, qui s'ouvre au fond en quelques minutes.");
    }
    if(C==="trouble") items.push("Eau trouble : appâts très odorants et visibles (fruités, épicés, couleurs vives ou fluo).");
    else if(C==="claire") items.push("Eau claire : couleurs naturelles et discrètes (brun, beige), amorçage plus léger : les poissons voient tout.");
    if(dp<=-1) items.push("Pression en baisse : les poissons sont souvent actifs, tu peux amorcer un peu plus"+(W===0?", tout en restant léger vu l'eau froide.":"."));
    else if(dp>=1) items.push("Pression en hausse : poissons souvent prudents, reste léger et précis.");
    typ.innerHTML=""; typ.append(el("b","calc-tt","🧪 Type d'amorce conseillé"));
    const ul2=el("ul"); items.forEach(x=>ul2.append(el("li",null,x))); typ.append(ul2);
  }
  up();
}

/* ---------- Conversions ---------- */
const PE=[["0,4","8 lb","3,6 kg","0,10 mm"],["0,6","10 lb","4,5 kg","0,12 mm"],["0,8","12–14 lb","5,9 kg","0,14 mm"],["1","16–18 lb","7,7 kg","0,16 mm"],["1,5","22–25 lb","10,9 kg","0,20 mm"],["2","30 lb","13,6 kg","0,23 mm"],["3","40 lb","18,1 kg","0,28 mm"],["4","50 lb","22,7 kg","0,33 mm"]];
function conv(){
  const {sh}=sheet("Conversions","calc-sheet");
  const row=el("div","row2");
  const l1=el("label","field","Livres (lb)"); const lb=el("input"); lb.type="number"; lb.inputMode="decimal"; lb.min="0"; lb.step="0.5"; lb.value="20"; l1.append(lb);
  const l2=el("label","field","Kilos (kg)"); const kg=el("input"); kg.type="number"; kg.inputMode="decimal"; kg.min="0"; kg.step="0.1"; l2.append(kg);
  row.append(l1,l2); sh.append(row);
  const syncKg=()=>{ const v=parseFloat(lb.value); kg.value=isNaN(v)?"":(Math.round(v*0.4536*10)/10); };
  const syncLb=()=>{ const v=parseFloat(kg.value); lb.value=isNaN(v)?"":(Math.round(v/0.4536*10)/10); };
  lb.addEventListener("input",syncKg); kg.addEventListener("input",syncLb); syncKg();
  sh.append(el("h3","calc-h","Tresse : numéro PE, résistance et diamètre"));
  const tb=el("div","calc-table pe");
  const hd=el("div","ct-row ct-head"); ["PE","Résistance","","Diamètre"].forEach(x=>hd.append(el("span",null,x))); tb.append(hd);
  PE.forEach(r=>{ const d=el("div","ct-row"); r.forEach((x,i)=>d.append(el(i===0?"b":"span",null,x))); tb.append(d); });
  sh.append(tb, el("p","note","Valeurs moyennes : elles varient selon les marques et le nombre de brins. Le diamètre réel d'une tresse est souvent plus gros que celui annoncé."));
}

const CALCS=[["⚖️","Poids de plomb","Selon le courant et la distance",lead],["🧵","Diamètre de fil","Tresse, nylon et bas de ligne par espèce",line],["🥣","Amorce","Quantité et type selon les conditions",bait],["🔁","Conversions","Livres ↔ kilos, tresse PE",conv]];
function calcList(){
  const {sh,close}=sheet("Calculateurs","tech-list");
  const g=el("div","tech-grid");
  CALCS.forEach(([i,t,s,fn])=>{ const b=btn("","tech-card",()=>{ close(); fn(); }); b.append(el("b",null,i+" "+t),el("span","note",s)); g.append(b); });
  sh.append(g);
}
function calcPanel(){
  let box=$("#calc-panel");
  if(!box){ const k=$("#tech-panel")||$("#knots"); if(!k) return; box=el("div","panel"); box.id="calc-panel"; box.dataset.sub="matos"; k.before(box); }
  box.hidden=!A.me; if(box.hidden) return;
  box.innerHTML=""; box.append(el("h2",null,"🧮 Calculateurs"));
  const g=el("div","calc-grid");
  CALCS.forEach(([i,t,s,fn])=>{ const b=btn("","calc-card",fn); b.append(el("span","cc-ico",i),el("b",null,t),el("span","note",s)); g.append(b); });
  box.append(g);
}
// ajout dans « Découvrir sans compte »
function discoverItem(){
  const g=$("#discover .disc-grid"); if(!g||g.querySelector(".disc-calc")) return;
  const b=btn("","disc-item disc-calc",calcList); b.append(el("span","disc-ico","🧮"),el("b",null,"Calculateurs"),el("span","note","Plomb, fil, amorce")); g.append(b);
}

/* =================== Agenda pêche du groupe =================== */
const KINDS={ouverture:["🎣","Ouverture / fermeture"],concours:["🏆","Concours"],enduro:["⏱️","Enduro carpe"],salon:["🎪","Salon"],autre:["📌","Autre"]};
const iso=d=>{ const z=new Date(d.getTime()-d.getTimezoneOffset()*6e4); return z.toISOString().slice(0,10); };
function lastWeekday(y,m,wd){ const d=new Date(y,m+1,0); while(d.getDay()!==wd) d.setDate(d.getDate()-1); return d; }
function nthWeekday(y,m,wd,n){ const d=new Date(y,m,1); while(d.getDay()!==wd) d.setDate(d.getDate()+1); d.setDate(d.getDate()+7*(n-1)); return d; }
// dates générales (2e et 1re catégorie) ; l'arrêté du département peut les modifier
function legalDates(){
  const out=[], y=new Date().getFullYear();
  for(const yy of [y,y+1]){
    out.push({auto:true,kind:"ouverture",title:"Ouverture du brochet (2e catégorie)",start_date:iso(lastWeekday(yy,3,6))});
    out.push({auto:true,kind:"ouverture",title:"Fermeture du brochet (2e catégorie)",start_date:iso(lastWeekday(yy,0,0))});
    out.push({auto:true,kind:"ouverture",title:"Ouverture de la truite (1re catégorie)",start_date:iso(nthWeekday(yy,2,6,2))});
    out.push({auto:true,kind:"ouverture",title:"Fermeture de la truite (1re catégorie)",start_date:iso(nthWeekday(yy,8,0,3))});
  }
  return out;
}
const fmtD=s=>new Date(s+"T12:00:00").toLocaleDateString("fr-FR",{weekday:"short",day:"numeric",month:"short"});
let aSeq=0;
async function agenda(host,gid){
  const seq=++aSeq;
  const today=iso(new Date()), until=iso(new Date(Date.now()+200*864e5));
  const {data,error}=await A.sb.from("fish_events").select("id,group_id,user_id,kind,title,start_date,end_date,place,url,note,profiles(username)").eq("group_id",gid).gte("start_date",iso(new Date(Date.now()-3*864e5))).order("start_date").limit(60);
  if(seq!==aSeq) return;
  host.innerHTML="";
  const h=el("div","g-sec-head"); h.append(el("h2",null,"📅 Agenda pêche"));
  h.append(btn("+ Ajouter","btn small",()=>form(host,gid)));
  host.append(h);
  if(error){ host.append(el("p","err",frError(error))); return; }
  const items=[...(data||[]),...legalDates().filter(e=>e.start_date>=today&&e.start_date<=until)].filter(e=>(e.end_date||e.start_date)>=today).sort((a,b)=>a.start_date.localeCompare(b.start_date)).slice(0,12);
  if(!items.length){ host.append(el("p","note","Rien de prévu : ajoute un concours, un enduro ou un salon de ta région.")); return; }
  const list=el("div","ag-list");
  items.forEach(e=>{
    const r=el("div","ag-item"+(e.auto?" auto":""));
    const d=new Date(e.start_date+"T12:00:00");
    const date=el("div","ag-date"); date.append(el("b",null,String(d.getDate())),el("span",null,d.toLocaleDateString("fr-FR",{month:"short"}).replace(".","")));
    const t=el("div","ag-t");
    t.append(el("b",null,KINDS[e.kind][0]+" "+e.title));
    const meta=[e.end_date&&e.end_date!==e.start_date?"jusqu'au "+fmtD(e.end_date):fmtD(e.start_date),e.place,e.auto?"date générale, vérifie l'arrêté de ton département":(e.profiles?.username?"@"+e.profiles.username:null)].filter(Boolean).join(" · ");
    t.append(el("span","note",meta));
    if(e.note) t.append(el("span",null,e.note));
    if(e.url){ const a=el("a","ag-link","🔗 Infos et inscription"); a.href=e.url; a.target="_blank"; a.rel="noopener"; t.append(a); }
    r.append(date,t);
    if(!e.auto&&(e.user_id===A.me.id||A.canModerate(e.group_id))){ const x=btn("✕","icon-btn small",async()=>{ if(!confirm("Supprimer « "+e.title+" » de l'agenda ?")) return; const {error}=await A.sb.from("fish_events").delete().eq("id",e.id); if(error) return toast(frError(error)); agenda(host,gid); }); x.setAttribute("aria-label","Supprimer"); r.append(x); }
    list.append(r);
  });
  host.append(list);
}
function form(host,gid){
  const {sh,close}=sheet("Ajouter à l'agenda","calc-sheet");
  const f=el("form","acc-form");
  const k=el("label","field","Type"); const ks=el("select"); Object.entries(KINDS).forEach(([v,[i,t]])=>ks.append(new Option(i+" "+t,v))); ks.value="concours"; k.append(ks);
  const tl=el("label","field","Titre"); const ti=el("input"); ti.required=true; ti.maxLength=80; ti.placeholder="Ex. : Concours carnassiers du Lot"; tl.append(ti);
  const row=el("div","row2");
  const dl=el("label","field","Date"); const di=el("input"); di.type="date"; di.required=true; di.min=iso(new Date()); dl.append(di);
  const el2=el("label","field","Fin (facultatif)"); const ei=el("input"); ei.type="date"; el2.append(ei);
  row.append(dl,el2);
  const pl=el("label","field","Lieu"); const pi=el("input"); pi.maxLength=80; pi.placeholder="Lac, ville…"; pl.append(pi);
  const ul=el("label","field","Lien (facultatif)"); const ui=el("input"); ui.type="url"; ui.maxLength=300; ui.placeholder="https://…"; ul.append(ui);
  const nl=el("label","field","Note"); const ni=el("input"); ni.maxLength=300; ni.placeholder="Inscription avant le…, prix…"; nl.append(ni);
  const ok=el("button","btn primary","Ajouter"); ok.type="submit";
  f.append(k,tl,row,pl,ul,nl,el("div","actions")); f.lastChild.append(ok);
  f.addEventListener("submit",async ev=>{
    ev.preventDefault(); ok.disabled=true;
    const {error}=await A.sb.from("fish_events").insert({group_id:gid,user_id:A.me.id,kind:ks.value,title:ti.value.trim(),start_date:di.value,end_date:ei.value||null,place:pi.value.trim()||null,url:ui.value.trim()||null,note:ni.value.trim()||null});
    ok.disabled=false;
    if(error) return toast(frError(error));
    toast("📅 Ajouté à l'agenda du groupe"); close(); agenda(host,gid);
  });
  sh.append(f);
}
A.hooks.groupeExtras=(prev=>(box,gid,mod)=>{
  prev?.(box,gid,mod);
  if(!A.me||typeof gid!=="number") return;
  const host=el("section","g-sec g-agenda"); host.dataset.sub="activite";
  const after=box.parentElement?.querySelector(".g-outings");
  if(after) after.after(host); else box.before(host);
  agenda(host,gid);
})(A.hooks.groupeExtras);

A.calc={lead,line,bait,conv,list:calcList};
const prevP=A.hooks.profil; A.hooks.profil=()=>{ prevP?.(); calcPanel(); };
const prevC=A.hooks.change; A.hooks.change=(...a)=>{ prevC?.(...a); calcPanel(); discoverItem(); };
calcPanel(); discoverItem();
if(A.me&&!$("#v-groupe").hidden) A.hooks.groupe?.();
})();
