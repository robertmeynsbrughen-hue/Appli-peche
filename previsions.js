// Rivio : carte des prévisions (spots colorés selon le score du jour), vent et berge,
// image des conditions à partager, album photo par espèce dans le Fishdex.
(function(){
"use strict";
const A=window.CDJ; if(!A) return;
const {el,toast,frError}=A;
const $=s=>document.querySelector(s);
const get=(k,d)=>{ try{ return localStorage.getItem(k)??d; }catch(e){ return d; } };
const set=(k,v)=>{ try{ localStorage.setItem(k,v); }catch(e){} };
function btn(label,cls,fn){ const b=el("button",cls||"btn",label); b.type="button"; if(fn) b.addEventListener("click",fn); return b; }
function sheet(title,cls){
  const back=el("div","sheet-back"), sh=el("div","sheet "+(cls||"")); sh.setAttribute("role","dialog"); sh.setAttribute("aria-modal","true"); sh.setAttribute("aria-label",title);
  const head=el("div","sheet-head"); head.append(el("h2",null,title)); const x=btn("✕","icon-btn"); x.setAttribute("aria-label","Fermer"); head.append(x); sh.append(head);
  const close=()=>back.remove(); x.addEventListener("click",close); back.addEventListener("click",e=>{ if(e.target===back) close(); });
  back.append(sh); document.body.append(back); return {sh,close};
}
const ADV=()=>window.CDJ_ADVICE;
const nrm=x=>String(x||"").normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase().trim();
const favs=()=>{ try{ return JSON.parse(localStorage.getItem("cdj-fav")||"[]"); }catch(_){ return []; } };

/* =================== Vent et berge =================== */
const DIR8=["N","NE","E","SE","S","SO","O","NO"];
const DIRL=["nord","nord-est","est","sud-est","sud","sud-ouest","ouest","nord-ouest"];
const d8=a=>Math.round(((a%360)+360)%360/45)%8;
// facing : direction vers laquelle on regarde l'eau depuis le poste ; dir : d'où vient le vent
function relation(facing,dir,speed){
  const diff=((dir-facing+540)%360)-180;
  const k=Math.abs(diff)<=45?"face":Math.abs(diff)>=135?"dos":"cote";
  return {k,side:diff>0?"droite":"gauche",calm:speed<6,strong:speed>=30};
}
const REL={face:["🌬️ Vent de face","Vent de face"],dos:["🍃 Vent dans le dos","Vent dans le dos"],cote:["↔️ Vent de côté","Vent de côté"]};
function relLabel(r){ if(r.calm) return "😌 Vent faible"; return REL[r.k][0]+(r.k==="cote"?" (de "+r.side+")":""); }
function advice(r){
  if(r.calm) return "Peu d'effet du vent : surface calme, poissons plus méfiants. Pêche fin et discret, les bordures et les zones ombragées.";
  let t={
    face:"La nourriture et l'eau oxygénée sont poussées vers ta berge : c'est souvent le bon côté, surtout pour la carpe et le poisson blanc. Lancers plus durs : plomb plus lourd, ligne plongeante.",
    dos:"Lancers faciles et longs, eau calme devant toi. Le poisson se tient plutôt vers la berge d'en face : pêche à distance, ou change de rive si tu peux.",
    cote:"La ligne fait un ventre et la dérive emporte le bouchon ou l'amorce. Canne basse, scion dans l'eau, ligne plongeante ou backlead, et amorce un peu en amont du vent."
  }[r.k];
  if(r.strong) t+=" Vent fort : prudence, préfère un poste abrité.";
  return t;
}
function compass(facing,dir){
  const ns="http://www.w3.org/2000/svg";
  const s=document.createElementNS(ns,"svg"); s.setAttribute("viewBox","0 0 120 120"); s.setAttribute("class","vb-compass"); s.setAttribute("aria-hidden","true");
  s.innerHTML='<g transform="rotate('+facing+' 60 60)"><path d="M8 60 A52 52 0 0 1 112 60 Z" class="vb-water"/></g><circle cx="60" cy="60" r="54" class="vb-ring"/>'+
    ["N","E","S","O"].map((l,i)=>{ const a=i*Math.PI/2; return '<text x="'+(60+46*Math.sin(a))+'" y="'+(64-46*Math.cos(a))+'" class="vb-card">'+l+'</text>'; }).join("")+
    // berge (trait) perpendiculaire au regard, pêcheur au centre, regard vers l'eau
    '<g transform="rotate('+facing+' 60 60)"><rect x="22" y="64" width="76" height="22" rx="4" class="vb-bank"/><path d="M60 62 L60 28" class="vb-look"/><path d="M54 34 L60 24 L66 34" class="vb-look"/><circle cx="60" cy="68" r="5" class="vb-me"/></g>'+
    (dir==null?"":'<g transform="rotate('+dir+' 60 60)"><path d="M60 12 L60 44" class="vb-wind"/><path d="M53 36 L60 46 L67 36" class="vb-wind"/></g>');
  return s;
}
function canEdit(s){ return !!A.me&&(A.myRoles.has(s.group_id)||A.me.is_admin); }
async function saveFacing(s,v,box){
  const {error}=await A.sb.rpc("set_spot_facing",{p_id:s.id,p_facing:v});
  if(error) return toast(frError(error));
  s.facing=v; const o=A.spots.find(x=>x.id===s.id); if(o) o.facing=v;
  toast(v==null?"Orientation effacée":"Orientation enregistrée"); windBank(s,box);
}
function picker(s,box){
  box.innerHTML="";
  box.append(el("h4","g-sub","🧭 Orientation du poste"), el("p","note","Debout au poste, face à l'eau : vers où regardes-tu ?"));
  const g=el("div","vb-pick");
  const order=[7,0,1,6,-1,2,5,4,3];
  order.forEach(i=>{
    if(i<0){ g.append(el("span","vb-mid","🎣")); return; }
    const b=btn(DIR8[i],"btn small"+(s.facing!=null&&d8(s.facing)===i?" on":""),()=>saveFacing(s,i*45,box)); b.setAttribute("aria-label","Je regarde vers le "+DIRL[i]); g.append(b);
  });
  box.append(g);
  const a=el("div","actions");
  if("DeviceOrientationEvent" in window) a.append(btn("📱 Prendre la direction du téléphone","btn small",()=>phoneHeading(s,box)));
  if(s.facing!=null) a.append(btn("Annuler","linkbtn",()=>windBank(s,box)));
  box.append(a);
}
function phoneHeading(s,box){
  const start=()=>{
    let done=false;
    const on=e=>{
      let h=null;
      if(e.webkitCompassHeading!=null) h=e.webkitCompassHeading;
      else if(e.absolute&&e.alpha!=null) h=360-e.alpha;
      if(h==null||done) return;
      done=true; off(); const v=Math.round(h)%360;
      if(confirm("Tu regardes vers le "+DIRL[d8(v)]+" ("+v+"°). Enregistrer ?")) saveFacing(s,v,box);
    };
    const off=()=>{ removeEventListener("deviceorientationabsolute",on); removeEventListener("deviceorientation",on); };
    addEventListener("deviceorientationabsolute",on); addEventListener("deviceorientation",on);
    toast("Tiens le téléphone à plat, pointé vers l'eau…");
    setTimeout(()=>{ if(!done){ done=true; off(); toast("Boussole indisponible : choisis la direction à la main"); } },5000);
  };
  const P=window.DeviceOrientationEvent;
  if(P&&typeof P.requestPermission==="function") P.requestPermission().then(r=>r==="granted"?start():toast("Boussole refusée")).catch(()=>toast("Boussole indisponible"));
  else start();
}
async function windBank(s,box){
  box.innerHTML="";
  box.append(el("h4","g-sub","🧭 Vent et berge"));
  if(s.facing==null){
    box.append(el("p","note","Indique une fois l'orientation du poste : Rivio te dira si le vent arrive de face, dans le dos ou de côté, et ce que ça change."));
    if(canEdit(s)) box.append(btn("🧭 Indiquer l'orientation","btn small",()=>picker(s,box)));
    return;
  }
  const wait=el("p","note","Vent du moment…"); box.append(wait);
  let f=null; try{ [f]=await ADV().forecastSpots([{lat:s.lat,lon:s.lon}]); }catch(_){}
  if(!box.isConnected) return;
  wait.remove();
  const w=f?.wind?.[0];
  const top=el("div","vb-top");
  top.append(compass(s.facing,w?.dir??null));
  const txt=el("div","vb-txt");
  txt.append(el("span","note","Poste face au "+DIRL[d8(s.facing)]));
  if(!w){ txt.append(el("b",null,"Vent indisponible"),el("span","note","Réessaie quand tu as du réseau.")); top.append(txt); box.append(top); }
  else{
    const r=relation(s.facing,w.dir,w.speed);
    txt.append(el("b","vb-k vb-"+(r.calm?"calm":r.k),relLabel(r)), el("span",null,"Vent de "+DIRL[d8(w.dir)]+", "+Math.round(w.speed)+" km/h"));
    top.append(txt); box.append(top, el("p","vb-adv",advice(r)));
    // évolution sur la journée
    const next=[3,6,9,12].map(z=>f.wind[z]).filter(x=>x&&x.dir!=null);
    if(next.length){
      const row=el("div","vb-next");
      next.forEach(x=>{ const q=relation(s.facing,x.dir,x.speed); const c=el("div","vb-n vb-"+(q.calm?"calm":q.k)); c.append(el("b",null,String(x.h).padStart(2,"0")+"h"),el("span",null,q.calm?"calme":q.k==="face"?"face":q.k==="dos"?"dos":"côté"),el("span","note",Math.round(x.speed)+" km/h")); row.append(c); });
      box.append(row);
    }
  }
  if(canEdit(s)) box.append(btn("Modifier l'orientation","linkbtn",()=>picker(s,box)));
}
const prevSE=A.hooks.spotExtras; A.hooks.spotExtras=(s,sh)=>{ prevSE?.(s,sh); const box=el("div","vent-berge"); const hist=sh.querySelector(".spot-hist"); if(hist) hist.before(box); else sh.append(box); windBank(s,box); };

/* =================== Carte des prévisions =================== */
const fc={on:get("cdj-fc","0")==="1",sp:get("cdj-fc-sp",""),when:get("cdj-fc-when","day"),layer:null,seq:0,res:null,busy:false};
function fcSpecies(){
  const all=ADV()?.species()||[];
  if(fc.sp&&all.includes(fc.sp)) return fc.sp;
  const f=favs().map(nrm), hit=all.find(n=>f.includes(nrm(n)));
  return hit||all.find(n=>/carpe/i.test(n))||all[0]||"";
}
const lvl=p=>p>=70?"top":p>=50?"good":p>=30?"mid":"low";
const RICO={face:"🌬️",dos:"🍃",cote:"↔️"};
function fcIcon(p,closed,rel){
  const bd=rel&&!rel.calm?'<i class="fc-w" title="'+REL[rel.k][1]+'">'+RICO[rel.k]+'</i>':"";
  return L.divIcon({className:"",html:'<div class="fc-pin fc-'+(closed?"closed":lvl(p))+'"><span>'+(closed?"✕":p)+'</span>'+bd+'</div>',iconSize:[34,34],iconAnchor:[17,17],popupAnchor:[0,-16]});
}
async function drawFc(){
  const map=A.map; if(!map||typeof L==="undefined") return;
  if(!fc.layer) fc.layer=L.layerGroup();
  const s=++fc.seq;
  if(!fc.on){ map.removeLayer(fc.layer); fc.layer.clearLayers(); return; }
  if(!map.hasLayer(fc.layer)) fc.layer.addTo(map);
  const spots=A.spots.filter(x=>A.cur==="all"||x.group_id===A.cur).slice(0,80);
  if(!spots.length){ fc.layer.clearLayers(); return; }
  fc.busy=true; A.layersBar?.();
  let res; try{ res=await ADV().forecastSpots(spots.map(x=>({lat:x.lat,lon:x.lon}))); }
  catch(_){ fc.busy=false; if(s===fc.seq){ toast("Prévisions indisponibles pour le moment"); fc.on=false; set("cdj-fc","0"); A.layersBar?.(); drawFc(); } return; }
  if(s!==fc.seq) return;
  fc.busy=false; fc.layer.clearLayers();
  const sp=fcSpecies(), hr=h=>String(h).padStart(2,"0")+"h";
  const rows=[];
  spots.forEach((x,i)=>{
    const r=res[i]; if(!r) return;
    const p=r.day.per.find(z=>z.name===sp); if(!p) return;
    const hNow=new Date().getHours(), vNow=p.all?.[hNow];
    const pct=Math.round((fc.when==="now"&&vNow!=null?vNow:p.best)*100); rows.push({x,pct,p});
    const rel=x.facing!=null&&r.wind?.[0]?relation(x.facing,r.wind[0].dir,r.wind[0].speed):null;
    const box=el("div","fc-pop");
    box.append(el("b",null,x.name), el("div","fc-pop-s",p.closed?sp+" : fermeture probable":sp+" · "+(fc.when==="now"?"maintenant ":"")+pct+" %"+(p.at!=null?" · 🕒 "+hr(p.from)+" – "+hr(p.to):"")));
    if(rel) box.append(el("div","note",relLabel(rel)+" en ce moment"));
    const t=el("div","pop-tools");
    t.append(btn("📋 Fiche du poste","btn small",()=>{ map.closePopup(); A.hooks.spotSheet?.(x); }));
    box.append(t);
    L.marker([x.lat,x.lon],{icon:fcIcon(pct,p.closed,rel),zIndexOffset:600,title:x.name+" "+pct+" %"}).bindPopup(box).addTo(fc.layer);
  });
  fc.res=rows.sort((a,b)=>b.pct-a.pct);
  A.layersBar?.();
}
function fcBar(){
  const w=el("div","fc-bar");
  const top=el("div","fc-row");
  top.append(el("b",null,"🎯 Prévisions du jour"));
  const sel=el("select","fc-sel"); sel.setAttribute("aria-label","Espèce");
  (ADV()?.species()||[]).forEach(n=>sel.append(new Option(n,n))); sel.value=fcSpecies();
  sel.addEventListener("change",()=>{ fc.sp=sel.value; set("cdj-fc-sp",fc.sp); drawFc(); });
  top.append(sel); w.append(top);
  const seg=el("div","seg fc-seg"); seg.setAttribute("aria-label","Moment");
  [["now","Maintenant"],["day","Meilleur du jour"]].forEach(([k,t])=>{ const b=btn(t,null,()=>{ fc.when=k; set("cdj-fc-when",k); drawFc(); }); b.setAttribute("aria-pressed",String(fc.when===k)); seg.append(b); });
  w.append(seg);
  const lg=el("div","fc-legend");
  [["top","70+"],["good","50–69"],["mid","30–49"],["low","< 30"]].forEach(([k,t])=>{ const i=el("span","fc-lg"); i.append(el("i","fc-dot fc-"+k),t); lg.append(i); });
  w.append(lg);
  if(fc.busy) w.append(el("p","note","Calcul des scores…"));
  else if(fc.res?.length){ const b=fc.res[0]; w.append(el("p","note",(fc.when==="now"?"Le mieux placé maintenant : ":"Meilleur spot aujourd'hui : ")+b.x.name+" ("+b.pct+" %)."+(fc.res.some(z=>z.x.facing!=null)?" 🌬️ vent de face · 🍃 dans le dos · ↔️ de côté.":""))); }
  else if(!A.spots.some(x=>A.cur==="all"||x.group_id===A.cur)) w.append(el("p","note","Aucun spot dans ce groupe pour l'instant."));
  return w;
}
const prevLR=A.hooks.layersRow; A.hooks.layersRow=row=>{ prevLR?.(row);
  const b=btn("🎯 Prévisions","btn small"+(fc.on?" on":""),()=>{ fc.on=!fc.on; set("cdj-fc",fc.on?"1":"0"); drawFc(); A.layersBar?.(); });
  row.prepend(b);
};
const prevLS=A.hooks.layersStatus; A.hooks.layersStatus=st=>{ prevLS?.(st); if(fc.on) st.append(fcBar()); };
const prevSL=A.hooks.spotsLoaded; A.hooks.spotsLoaded=()=>{ prevSL?.(); if(fc.on) drawFc(); };
const prevMS=A.hooks.mapShown; A.hooks.mapShown=m=>{ prevMS?.(m); if(fc.on) drawFc(); };
let lastCur=A.cur;
const prevCh=A.hooks.change; A.hooks.change=(...a)=>{ prevCh?.(...a); if(A.cur!==lastCur){ lastCur=A.cur; if(fc.on) drawFc(); } };
window.addEventListener("cdj-fav",()=>{ if(fc.on&&!fc.sp) drawFc(); });
// la barre des calques a pu être dessinée avant le chargement de ce module
A.layersBar?.(); if(fc.on&&A.map) drawFc();

/* =================== Image des conditions =================== */
const FD="'Barlow Condensed', 'Arial Narrow', sans-serif", FB="'Source Sans 3', system-ui, sans-serif", FM="'JetBrains Mono', ui-monospace, monospace";
const C={bg:"#060c12",bg2:"#0d1a26",fg:"#eaf4f6",muted:"#8fa6b2",accent:"#2fd3c4",amber:"#ffb547",best:"#4aa8ff",low:"#ff9a4a",line:"rgba(47,211,196,.10)"};
function rrect(ctx,x,y,w,h,r){ ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath(); }
function fit(ctx,t,font,size,maxW){ let s=size; ctx.font=font.replace("{s}",s); while(s>20&&ctx.measureText(t).width>maxW){ s-=2; ctx.font=font.replace("{s}",s); } }
async function fonts(){ try{ await Promise.all([document.fonts.load("700 80px 'Barlow Condensed'"),document.fonts.load("600 40px 'Barlow Condensed'"),document.fonts.load("400 32px 'Source Sans 3'"),document.fonts.load("600 32px 'Source Sans 3'"),document.fonts.load("500 24px 'JetBrains Mono'")]); }catch(_){} }
async function drawConditions(T){
  await fonts();
  const W=1080,H=1920, c=document.createElement("canvas"); c.width=W; c.height=H;
  const x=c.getContext("2d");
  const g=x.createLinearGradient(0,0,0,H); g.addColorStop(0,C.bg2); g.addColorStop(.55,C.bg); g.addColorStop(1,"#03070b"); x.fillStyle=g; x.fillRect(0,0,W,H);
  // grille sondeur et arcs
  x.strokeStyle=C.line; x.lineWidth=1; for(let i=0;i<=W;i+=60){ x.beginPath(); x.moveTo(i,0); x.lineTo(i,H); x.stroke(); } for(let j=0;j<=H;j+=60){ x.beginPath(); x.moveTo(0,j); x.lineTo(W,j); x.stroke(); }
  x.strokeStyle="rgba(47,211,196,.16)"; x.lineWidth=2; [260,400,540].forEach(r=>{ x.beginPath(); x.arc(W-60,300,r,Math.PI*.55,Math.PI*1.05); x.stroke(); });
  const P=72;
  // en-tête
  x.fillStyle=C.accent; rrect(x,P,P,64,64,16); x.fill();
  x.fillStyle="#06231f"; x.fill(new Path2D("M"+(P+10)+" "+(P+32)+"c8-12 20-16 30-12 4 1.6 7.2 4.8 9.2 8L"+(P+58)+" "+(P+20)+"v24l-8.8-8c-2 3.2-5.2 6.4-9.2 8-10 4-22 0-30-12z"));
  x.fillStyle=C.fg; x.font="700 48px "+FD; x.textBaseline="middle"; x.fillText("RIVIO",P+84,P+34);
  const now=new Date(), date=now.toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long"});
  x.font="500 26px "+FM; x.fillStyle=C.muted; x.textAlign="right"; x.fillText(date.toUpperCase(),W-P,P+34); x.textAlign="left";
  // lieu
  x.textBaseline="alphabetic";
  const place=String(T.place||"").replace(/^📍\s*/,"");
  x.fillStyle=C.accent; x.font="600 30px "+FB; x.fillText("CONDITIONS DE PÊCHE",P,250);
  fit(x,place,"700 {s}px "+FD,76,W-2*P); x.fillStyle=C.fg; x.fillText(place,P,330);
  // température de l'eau
  x.font="700 230px "+FD; x.fillStyle=C.fg; const tt=T.water.toFixed(1).replace(".",","); x.fillText(tt,P-6,590);
  const tw=x.measureText(tt).width; x.font="600 70px "+FD; x.fillStyle=C.accent; x.fillText("°C",P+tw+8,500);
  x.font="400 32px "+FB; x.fillStyle=C.muted; x.fillText((T.water_measured?"Eau mesurée":"Eau estimée")+(T.clarity?" · "+T.clarity:""),P,640);
  // pastilles météo
  const chips=[["Ciel",T.sky],["Air",Math.round(T.air)+" °C"],["Vent",Math.round(T.wind)+" km/h"],["Pression",String(T.trend||"").replace(/\s*[↑↓→]+/g,"")],["Lune",T.moon||"—"]].filter(z=>z[1]);
  let cx=P, cy=700; const cw=(W-2*P-24)/2;
  chips.forEach((z,i)=>{
    const w=i===chips.length-1&&chips.length%2?W-2*P:cw;
    x.fillStyle="rgba(13,22,32,.9)"; rrect(x,cx,cy,w,96,20); x.fill(); x.strokeStyle="rgba(47,211,196,.25)"; x.lineWidth=2; x.stroke();
    x.font="500 22px "+FM; x.fillStyle=C.muted; x.fillText(z[0].toUpperCase(),cx+24,cy+36);
    fit(x,z[1],"600 {s}px "+FB,34,w-48); x.fillStyle=C.fg; x.fillText(z[1],cx+24,cy+76);
    if(i%2===0&&w===cw){ cx+=cw+24; } else { cx=P; cy+=116; }
  });
  // espèces
  const favs=(T.fav||[]).filter(f=>!f.closed), others=(T.top||[]).filter(t=>!favs.some(f=>f.name===t.name));
  const blocks=favs[0]?[["⭐ TON ESPÈCE FAVORITE",favs[0]],others[0]&&["🏆 LA PLUS ADAPTÉE",others[0]]]:[["🏆 MEILLEUR COUP DU JOUR",T.top?.[0]],T.top?.[1]&&["DEUXIÈME CHOIX",T.top[1]]];
  let y=Math.max(cy+30,1060);
  blocks.filter(b=>b&&b[1]).forEach(([lab,s],bi)=>{
    const h=250;
    x.fillStyle=bi===0?"rgba(47,211,196,.10)":"rgba(13,22,32,.92)"; rrect(x,P,y,W-2*P,h,28); x.fill();
    x.strokeStyle=bi===0?"rgba(47,211,196,.55)":"rgba(143,166,178,.25)"; x.lineWidth=2; x.stroke();
    x.font="600 26px "+FB; x.fillStyle=bi===0?C.accent:C.muted; x.fillText(lab,P+32,y+50);
    fit(x,s.name,"700 {s}px "+FD,64,W-2*P-260); x.fillStyle=C.fg; x.fillText(s.name,P+32,y+120);
    x.font="700 88px "+FD; x.fillStyle=s.pct>=70?C.best:s.pct<35?C.low:C.accent; x.textAlign="right"; x.fillText(s.pct+"%",W-P-32,y+124); x.textAlign="left";
    if(s.from){ x.font="500 26px "+FM; x.fillStyle=C.fg; x.fillText("MEILLEUR CRÉNEAU  "+s.from+" – "+s.to,P+32,y+168); }
    // frise 24 h
    if(s.s?.length){
      const bx=P+32, bw=W-2*P-64, by=y+190, bh=40, n=s.s.length, sw=bw/n;
      s.s.forEach((v,k)=>{ const hh=Math.max(4,v*bh); const best=s.b?.[k], low=!best&&v<0.5;
        x.fillStyle=best?C.best:low?C.low:C.accent; x.globalAlpha=best||low?1:.25+v*.6; rrect(x,bx+k*sw+1.5,by+bh-hh,sw-3,hh,3); x.fill(); });
      x.globalAlpha=1;
      x.font="500 18px "+FM; x.fillStyle=C.muted; const h0=T.h0??now.getHours();
      [0,6,12,18].forEach(k=>{ if(k<n) x.fillText(((h0+k)%24)+"h",bx+k*sw,by+bh+24); });
    }
    y+=h+(s.s?.length?36:0)+28;
  });
  const rest=[...favs.slice(1),...others.slice(1)].slice(0,3);
  if(rest.length){ x.font="400 30px "+FB; x.fillStyle=C.muted; x.fillText("Aussi : "+rest.map(r=>r.name+" "+r.pct+" %").join(" · "),P,y+20); }
  // pied
  x.fillStyle="rgba(47,211,196,.35)"; x.fillRect(P,H-150,W-2*P,2);
  x.font="600 30px "+FB; x.fillStyle=C.fg; x.fillText("Prévisions de pêche Rivio",P,H-92);
  x.font="400 24px "+FB; x.fillStyle=C.muted; x.fillText("Estimations indicatives · météo Open-Meteo",P,H-56);
  return new Promise(r=>c.toBlob(b=>r({blob:b,url:c.toDataURL("image/jpeg",.8)}),"image/jpeg",.92));
}
async function shareConditions(){
  const T=window.CDJ_TODAY; if(!T) return toast("Conditions pas encore chargées");
  const {sh}=sheet("Partager les conditions","cond-sheet");
  const prev=el("div","cond-prev"); prev.append(el("p","note","Préparation de l'image…")); sh.append(prev);
  let out; try{ out=await drawConditions(T); }catch(_){ prev.innerHTML=""; prev.append(el("p","err","Image impossible à créer sur cet appareil.")); return; }
  prev.innerHTML=""; const img=el("img"); img.src=out.url; img.alt="Aperçu des conditions du jour"; prev.append(img);
  const name="rivio-conditions-"+new Date().toISOString().slice(0,10)+".jpg";
  const a=el("div","actions");
  const file=new File([out.blob],name,{type:"image/jpeg"});
  if(navigator.canShare?.({files:[file]})) a.append(btn("📤 Partager","btn primary",()=>navigator.share({files:[file],title:"Conditions de pêche · Rivio",text:"Les conditions du jour 🎣"}).catch(()=>{})));
  a.append(btn("⬇️ Enregistrer","btn",()=>{ const l=document.createElement("a"); l.href=URL.createObjectURL(out.blob); l.download=name; document.body.append(l); l.click(); setTimeout(()=>{ URL.revokeObjectURL(l.href); l.remove(); },1000); }));
  sh.append(a, el("p","note","Format story (1080 × 1920) : parfait pour les statuts WhatsApp et les stories."));
}
const prevDE=A.hooks.dayExtras; A.hooks.dayExtras=(slot,T)=>{ prevDE?.(slot,T); if(T) slot.append(btn("📸 Partager les conditions","btn small today-share",shareConditions)); };
A.shareConditions=shareConditions;

/* =================== Album par espèce (Fishdex) =================== */
const prevSp=A.hooks.speciesExtras; A.hooks.speciesExtras=async(e,sh)=>{
  prevSp?.(e,sh);
  const box=el("div","sp-album"); box.append(el("h4","g-sub","📸 Album "+(A.cur==="all"?"de tous les groupes":"du groupe")), el("p","note","Chargement…"));
  sh.append(box);
  let q=A.sb.from("posts").select("id,group_id,user_id,species,length_cm,weight_kg,photo_path,photo_paths,created_at,profiles(username)").eq("status","published").ilike("species",e.name).order("length_cm",{ascending:false,nullsFirst:false}).limit(40);
  if(typeof A.cur==="number") q=q.eq("group_id",A.cur);
  const {data,error}=await q;
  if(!box.isConnected) return;
  box.lastChild.remove();
  if(error){ box.append(el("p","err",frError(error))); return; }
  const rows=(data||[]).map(p=>({p,path:(p.photo_paths&&p.photo_paths[0])||p.photo_path})).filter(r=>r.path)
    .sort((a,b)=>(b.p.length_cm||0)-(a.p.length_cm||0)||(b.p.weight_kg||0)-(a.p.weight_kg||0)).slice(0,24);
  if(!rows.length){ box.append(el("p","note","Pas encore de photo de "+e.name.toLowerCase()+". La prochaine prise ouvre l'album !")); return; }
  const {data:sig}=await A.sb.storage.from("photos").createSignedUrls(rows.map(r=>r.path),3600);
  if(!box.isConnected) return;
  const urls={}; (sig||[]).forEach(z=>{ if(z.signedUrl) urls[z.path]=z.signedUrl; });
  const grid=el("div","sp-album-grid");
  rows.forEach(({p,path},i)=>{
    const t=btn("","alb-item",()=>A.openPost?.(p.id));
    t.style.backgroundImage=urls[path]?"url('"+urls[path]+"')":"none";
    const cap=el("span","alb-cap",[p.length_cm?String(p.length_cm).replace(".",",")+" cm":null,p.weight_kg?String(p.weight_kg).replace(".",",")+" kg":null].filter(Boolean).join(" · ")||"—");
    if(i<3&&p.length_cm) t.append(el("span","alb-rank",["🥇","🥈","🥉"][i]));
    t.append(cap); t.setAttribute("aria-label",e.name+" "+cap.textContent+" par "+(p.profiles?.username||"?"));
    grid.append(t);
  });
  box.append(grid, el("p","note",rows.length+" photo"+(rows.length>1?"s":"")+", de la plus grande à la plus petite."));
};
})();
