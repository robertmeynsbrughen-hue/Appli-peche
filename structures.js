// Rivio : carte des structures (cassures, bois noyé, herbiers, fosses, arrivées d'eau…) marquées par le groupe,
// et postes à prospecter selon l'espèce, la saison et le moment de la journée.
(function(){
"use strict";
const A=window.CDJ; if(!A) return;
const {el,toast,frError,ago}=A;
const get=(k,d)=>{ try{ return localStorage.getItem(k)??d; }catch(e){ return d; } };
const set=(k,v)=>{ try{ localStorage.setItem(k,v); }catch(e){} };
function btn(label,cls,fn){ const b=el("button",cls||"btn",label); b.type="button"; if(fn) b.addEventListener("click",fn); return b; }
const nrm=x=>String(x||"").normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase().trim();

const KINDS={
  cassure:["📐","Cassure","changement brusque de profondeur"],
  bois:["🪵","Bois noyé","arbres immergés, branches, souches"],
  herbier:["🌿","Herbier","nénuphars, potamots, roselière"],
  obstacle:["🪨","Obstacle","bloc, épave, pile de pont"],
  fosse:["🕳️","Fosse","trou plus profond que les alentours"],
  arrivee:["💧","Arrivée d'eau","affluent, ruisseau, rejet, déversoir"],
  courant:["🌀","Zone de courant","veine d'eau, contre-courant, remous"],
  haut_fond:["🏝️","Haut-fond","plateau, banc de sable ou de gravier"],
  ponton:["🛟","Ponton ou bordure","ponton, mur, enrochement, quai"],
};
const KK=Object.keys(KINDS);
// intérêt de chaque structure (0 à 3) par espèce et par saison : hiver, printemps, été, automne
const W={
  brochet:{hiver:{cassure:3,bois:2,herbier:1,obstacle:2,fosse:2,arrivee:1,ponton:1},printemps:{herbier:3,haut_fond:3,bois:2,arrivee:2,cassure:1,ponton:1},ete:{herbier:3,bois:3,obstacle:2,cassure:2,ponton:2,fosse:1},automne:{cassure:3,herbier:2,bois:2,obstacle:2,haut_fond:2,fosse:1}},
  sandre:{hiver:{fosse:3,cassure:3,obstacle:2,ponton:1},printemps:{ponton:3,obstacle:2,cassure:2,courant:1},ete:{cassure:3,obstacle:2,courant:2,haut_fond:2,ponton:2},automne:{cassure:3,obstacle:3,fosse:2,ponton:2}},
  perche:{hiver:{fosse:3,cassure:2,bois:2},printemps:{bois:3,herbier:2,ponton:2,haut_fond:1},ete:{herbier:3,ponton:3,bois:2,haut_fond:2},automne:{cassure:3,bois:2,herbier:2,obstacle:2}},
  bass:{hiver:{bois:3,fosse:2,cassure:2},printemps:{haut_fond:3,bois:2,herbier:2,ponton:2},ete:{herbier:3,bois:3,ponton:3,obstacle:2},automne:{bois:3,herbier:2,cassure:2,ponton:2}},
  silure:{hiver:{fosse:3,obstacle:2,cassure:1},printemps:{arrivee:3,courant:2,bois:2,herbier:1},ete:{courant:3,arrivee:3,obstacle:3,fosse:2,bois:2},automne:{fosse:3,obstacle:3,cassure:2,bois:1}},
  chevesne:{hiver:{fosse:2,bois:2,courant:1},printemps:{courant:3,arrivee:2,bois:2},ete:{bois:3,courant:3,arrivee:2,haut_fond:2},automne:{bois:2,courant:2,fosse:2}},
  carpe:{hiver:{fosse:3,cassure:2,bois:1},printemps:{haut_fond:3,herbier:2,arrivee:2,bois:2},ete:{herbier:3,bois:3,arrivee:2,haut_fond:2,obstacle:2},automne:{cassure:3,fosse:2,herbier:2,bois:2}},
};
const TIP={
  brochet:{hiver:"Il se tient en profondeur, sur les cassures et le bois : pêche lent, près du fond.",printemps:"Après la fraie, il traîne sur les hauts-fonds et les herbiers qui se réchauffent vite.",ete:"Il chasse en lisière d'herbiers et à l'ombre du bois noyé, surtout tôt et tard.",automne:"Saison des gros : il suit le poisson blanc le long des cassures et des herbiers qui se dégarnissent."},
  sandre:{hiver:"Collé au fond dans les fosses et au pied des cassures : verticale ou linéaire lent.",printemps:"Il garde ses frayères sur les enrochements, pontons et obstacles durs.",ete:"Le jour sur les cassures et dans les obstacles, la nuit sur les hauts-fonds en chasse.",automne:"Très actif sur les cassures et autour des obstacles, surtout par eau teintée."},
  perche:{hiver:"Regroupée en bancs dans les fosses et sur les cassures profondes.",printemps:"Elle remonte vers le bois noyé et les pontons pour frayer.",ete:"Bancs actifs le long des herbiers et sous les pontons.",automne:"Grosses perches sur les cassures et autour du bois : cherche les chasses."},
  bass:{hiver:"Calé dans le bois noyé et au pied des cassures, très lent.",printemps:"Il monte sur les hauts-fonds et les bordures qui chauffent.",ete:"Herbiers épais, bois et ombre des pontons : pêche en surface tôt et tard.",automne:"Il se nourrit fort autour du bois et des herbiers avant l'hiver."},
  silure:{hiver:"Peu actif, regroupé au fond des fosses.",printemps:"Il remonte vers les arrivées d'eau et les courants qui se réchauffent.",ete:"Veines de courant, arrivées d'eau et gros obstacles, surtout la nuit.",automne:"Il retourne vers les fosses et les obstacles : derniers bons coups avant l'hiver."},
  chevesne:{hiver:"Dans les zones calmes et profondes, sous le bois.",printemps:"Dans les courants et aux arrivées d'eau.",ete:"Sous les branches en surplomb et dans les veines de courant : il gobe en surface.",automne:"Le long du bois et dans les courants plus lents."},
  carpe:{hiver:"Regroupée dans les fosses et au pied des cassures : petites amorces, pêche précise.",printemps:"Elle monte sur les hauts-fonds et les herbiers qui chauffent les premiers.",ete:"Herbiers, bois noyé et arrivées d'eau oxygénée.",automne:"Elle se nourrit fort sur les cassures et en bordure de fosses."},
};
const SEASON=m=>m===12||m<=2?"hiver":m<=5?"printemps":m<=8?"ete":"automne";
const SEASON_TXT={hiver:"hiver",printemps:"printemps",ete:"été",automne:"automne"};
const SPID=name=>{ const n=nrm(name); return n.includes("black")?"bass":Object.keys(W).find(k=>n.startsWith(k))||null; };

const st={on:get("cdj-struct","0")==="1",adding:false,sp:get("cdj-struct-sp",""),list:null,layer:null,cur:null,seq:0,sugg:get("cdj-struct-sugg","1")==="1"};
function spName(){
  const all=(window.CDJ_ADVICE?.species()||[]).filter(n=>SPID(n));
  if(st.sp&&all.includes(st.sp)) return st.sp;
  let favs=[]; try{ favs=JSON.parse(localStorage.getItem("cdj-fav")||"[]").map(nrm); }catch(_){}
  return all.find(n=>favs.includes(nrm(n)))||all.find(n=>/brochet/i.test(n))||all[0]||"Brochet";
}
async function load(force){
  if(!A.me||typeof A.cur!=="number"&&A.cur!=="all") return [];
  if(st.list&&st.cur===A.cur&&!force) return st.list;
  let q=A.sb.from("structures").select("id,group_id,user_id,kind,lat,lon,note,created_at,profiles(username)").order("created_at",{ascending:false}).limit(500);
  if(typeof A.cur==="number") q=q.eq("group_id",A.cur);
  const s=++st.seq; const {data,error}=await q; if(s!==st.seq) return st.list||[];
  if(error){ toast(frError(error)); return []; }
  st.list=data||[]; st.cur=A.cur; return st.list;
}
// classement des postes : intérêt de la structure, bonus quand plusieurs structures se combinent (moins de 60 m)
function rank(list,name){
  const id=SPID(name), sea=SEASON(new Date().getMonth()+1), w=W[id]?.[sea]||{};
  const d=(a,b)=>Math.hypot((a.lon-b.lon)*111000*Math.cos(a.lat*Math.PI/180),(a.lat-b.lat)*111000);
  let me=null; try{ const m=window.CDJ_ADVICE?.meta?.(); if(m) me=m; }catch(_){}
  return list.map(x=>{
    const base=w[x.kind]||0; if(!base) return null;
    const near=list.filter(y=>y!==x&&d(x,y)<=60&&y.kind!==x.kind&&(w[y.kind]||0)>=1);
    const score=base+Math.min(1,near.length*0.5);
    return {x,score,combo:near,far:me?d(me,x):0};
  }).filter(Boolean).sort((a,b)=>b.score-a.score||a.far-b.far);
}
function icon(k,rankN){
  const i=KINDS[k]?.[0]||"📍";
  return L.divIcon({className:"",html:'<div class="st-pin'+(rankN?" st-top":"")+'">'+i+(rankN?'<b>'+rankN+'</b>':'')+'</div>',iconSize:[32,32],iconAnchor:[16,16],popupAnchor:[0,-14]});
}
async function draw(){
  const map=A.map; if(!map||typeof L==="undefined") return;
  if(!st.layer) st.layer=L.layerGroup();
  if(!st.on){ map.removeLayer(st.layer); st.layer.clearLayers(); return; }
  if(!map.hasLayer(st.layer)) st.layer.addTo(map);
  const had=!!st.list; const list=await load(); if(!st.on) return;
  if(!had) A.layersBar?.();
  st.layer.clearLayers();
  const top=st.sugg?rank(list,spName()).slice(0,5):[];
  list.forEach(x=>{
    const r=top.findIndex(t=>t.x===x);
    const k=KINDS[x.kind]||["📍","Structure",""];
    const box=el("div","st-pop");
    box.append(el("b",null,k[0]+" "+k[1]), el("div","note",k[2]));
    if(x.note) box.append(el("p",null,x.note));
    box.append(el("div","note","@"+(x.profiles?.username||"?")+" · "+ago(x.created_at)));
    if(r>=0){ const t=top[r]; box.append(el("div","st-why","🎯 Poste n°"+(r+1)+" pour le "+spName().toLowerCase()+(t.combo.length?" : combiné avec "+t.combo.map(c=>KINDS[c.kind][1].toLowerCase()).join(", "):""))); }
    if(x.user_id===A.me?.id||A.canModerate(x.group_id)){
      const del=A.confirmBtn("Supprimer","Confirmer",async()=>{ const {error}=await A.sb.from("structures").delete().eq("id",x.id); if(error) return toast(frError(error)); map.closePopup(); st.list=st.list.filter(y=>y.id!==x.id); draw(); A.layersBar?.(); });
      box.append(del);
    }
    L.marker([x.lat,x.lon],{icon:icon(x.kind,r>=0?r+1:0),zIndexOffset:r>=0?700:300,title:k[1]}).bindPopup(box).addTo(st.layer);
  });
}
function picker(lat,lon){
  const back=el("div","sheet-back"), sh=el("div","sheet st-sheet"); sh.setAttribute("role","dialog"); sh.setAttribute("aria-modal","true"); sh.setAttribute("aria-label","Nouvelle structure");
  const head=el("div","sheet-head"); head.append(el("h2",null,"Quelle structure ici ?")); const x=btn("✕","icon-btn"); x.setAttribute("aria-label","Fermer"); head.append(x); sh.append(head);
  const close=()=>back.remove(); x.addEventListener("click",close); back.addEventListener("click",e=>{ if(e.target===back) close(); });
  const g=el("div","st-kinds"); let kind=null;
  KK.forEach(k=>{ const [i,t,d]=KINDS[k]; const b=btn("","st-kind",()=>{ kind=k; g.querySelectorAll(".st-kind").forEach(y=>y.classList.toggle("on",y===b)); }); b.append(el("span","ek-i",i),el("b",null,t),el("span","note",d)); g.append(b); });
  const nl=el("label","field","Précision (facultatif)"); const ni=el("input"); ni.maxLength=200; ni.placeholder="ex. de 2 à 5 m, gros chêne couché"; nl.append(ni);
  const ok=btn("Ajouter","btn primary",async()=>{
    if(!kind) return toast("Choisis le type de structure");
    if(typeof A.cur!=="number") return toast("Choisis un groupe précis");
    ok.disabled=true;
    const {data,error}=await A.sb.from("structures").insert({group_id:A.cur,kind,lat:+lat.toFixed(6),lon:+lon.toFixed(6),note:ni.value.trim()||null}).select("id,group_id,user_id,kind,lat,lon,note,created_at").single();
    ok.disabled=false; if(error) return toast(frError(error));
    close(); st.list=[{...data,profiles:{username:A.me.username}},...(st.list||[])]; toast(KINDS[kind][0]+" Structure ajoutée"); draw(); A.layersBar?.();
  });
  const act=el("div","actions"); act.append(ok,btn("Annuler","linkbtn",close));
  sh.append(g,nl,act); back.append(sh); document.body.append(back);
}
function addHere(){
  if(!navigator.geolocation) return toast("Position indisponible");
  navigator.geolocation.getCurrentPosition(p=>picker(p.coords.latitude,p.coords.longitude),()=>toast("Autorise la localisation, ou touche la carte"),{enableHighAccuracy:true,timeout:10000});
}
function stBar(){
  const w=el("div","st-bar");
  const top=el("div","fc-row"); top.append(el("b",null,"🪵 Structures"));
  const add=btn(st.adding?"✓ Terminer":"➕ Marquer","btn small"+(st.adding?" on":""),()=>{ st.adding=!st.adding; if(st.adding) toast("Touche la carte à l'endroit de la structure"); A.layersBar?.(); });
  top.append(add, btn("📍 Ici","btn small",addHere)); w.append(top);
  if(st.adding){ w.append(el("p","note","Touche la carte : cassure, bois noyé, herbier, fosse, arrivée d'eau…")); return w; }
  const n=(st.list||[]).length;
  const row=el("div","fc-row");
  const sw=el("label","check"); const cb=el("input"); cb.type="checkbox"; cb.checked=st.sugg; cb.addEventListener("change",()=>{ st.sugg=cb.checked; set("cdj-struct-sugg",st.sugg?"1":"0"); draw(); A.layersBar?.(); }); sw.append(cb," 🎯 Postes à prospecter");
  row.append(sw);
  if(st.sugg){ const sel=el("select","fc-sel"); sel.setAttribute("aria-label","Espèce"); (window.CDJ_ADVICE?.species()||[]).filter(x=>SPID(x)).forEach(x=>sel.append(new Option(x,x))); sel.value=spName(); sel.addEventListener("change",()=>{ st.sp=sel.value; set("cdj-struct-sp",st.sp); draw(); A.layersBar?.(); }); row.append(sel); }
  w.append(row);
  if(!n){ w.append(el("p","note","Aucune structure. Marque les cassures, le bois noyé, les herbiers ou les fosses que tu connais : Rivio en déduit les postes à prospecter.")); return w; }
  if(st.sugg){
    const name=spName(), id=SPID(name), sea=SEASON(new Date().getMonth()+1);
    w.append(el("p","st-tip","🗓️ "+name+" en "+SEASON_TXT[sea]+" : "+(TIP[id]?.[sea]||"")));
    const r=rank(st.list,name).slice(0,5);
    if(!r.length) w.append(el("p","note","Aucune des structures marquées n'est intéressante pour cette espèce en cette saison."));
    else{
      const ol=el("ol","st-rank");
      r.forEach(t=>{ const k=KINDS[t.x.kind]; const li=el("li"); const b=btn("","linkbtn st-go",()=>{ A.map?.setView([t.x.lat,t.x.lon],16); }); b.append(k[0]+" "+k[1]+(t.x.note?" · "+t.x.note:"")+(t.combo.length?" + "+t.combo.map(c=>KINDS[c.kind][1].toLowerCase()).join(", "):"")); li.append(b); ol.append(li); });
      w.append(ol);
    }
    const h=new Date().getHours(), T=window.CDJ_TODAY;
    const lowLight=h<9||h>=17;
    w.append(el("p","note",(lowLight?"🌅 Lumière faible : les poissons remontent sur les bordures, herbiers et hauts-fonds.":"☀️ Plein jour : privilégie les cassures, fosses et l'ombre du bois.")+(T?" Conditions du jour : "+(T.fav?.[0]?.name===name?T.fav[0].pct:(T.top||[]).find(x=>x.name===name)?.pct??"—")+" % pour cette espèce.":"")));
  }
  return w;
}
const prevLR=A.hooks.layersRow; A.hooks.layersRow=row=>{ prevLR?.(row);
  row.prepend(btn("🪵 Structures","btn small"+(st.on?" on":""),()=>{ st.on=!st.on; st.adding=false; set("cdj-struct",st.on?"1":"0"); draw(); A.layersBar?.(); }));
};
const prevLS=A.hooks.layersStatus; A.hooks.layersStatus=s=>{ prevLS?.(s); if(st.on&&A.me) s.append(stBar()); };
const prevClick=A.hooks.mapClick; A.hooks.mapClick=ll=>{ if(prevClick?.(ll)) return true; if(st.on&&st.adding){ picker(ll.lat,ll.lng); return true; } return false; };
const prevMS=A.hooks.mapShown; A.hooks.mapShown=m=>{ prevMS?.(m); if(st.on) draw(); };
const prevCh=A.hooks.change; A.hooks.change=(...a)=>{ prevCh?.(...a); if(A.cur!==st.cur){ st.list=null; if(st.on&&A.map) draw().then(()=>A.layersBar?.()); } };
A.layersBar?.(); if(st.on&&A.map) draw();
A.structures={KINDS,rank:(name)=>rank(st.list||[],name),load};
})();
