// Coup du Jour : réglages de l'alerte du matin (onglet Profil).
(function(){
"use strict";
const A=window.CDJ; if(!A) return;
const {el,toast,frError}=A;
const $=s=>document.querySelector(s);
const SP=[["brochet","Brochet"],["sandre","Sandre"],["perche","Perche"],["bass","Black-bass"],["silure","Silure"],["carpe","Carpe"],["chevesne","Chevesne"]];
const WATER=[["etang","Étang / lac"],["riviere","Rivière"],["canal","Canal"]];
let pref=null, seq=0;
function btn(label,cls,fn){ const b=el("button",cls||"btn",label); b.type="button"; if(fn) b.addEventListener("click",fn); return b; }

async function load(){
  const box=$("#alerts"); if(!box) return;
  if(!A.me){ box.hidden=true; return; }
  box.hidden=false;
  const s=++seq;
  const {data,error}=await A.sb.from("alert_prefs").select("*").eq("user_id",A.me.id).maybeSingle();
  if(s!==seq) return;
  // table pas encore créée côté serveur : on masque simplement le panneau
  if(error&&/alert_prefs|PGRST205|42P01|does not exist/i.test((error.code||"")+" "+(error.message||""))){ box.hidden=true; return; }
  if(error){ box.innerHTML=""; box.append(el("p","err",frError(error))); return; }
  pref=data||{enabled:false,lat:null,lon:null,place:null,species:[],threshold:70,water:(()=>{ try{ return localStorage.getItem("cdj-water")||"etang"; }catch(e){ return "etang"; } })(),opening:true,_new:true};
  draw();
}
function draw(){
  const box=$("#alerts"); box.innerHTML="";
  const h=el("div","g-sec-head"); h.append(el("h2",null,"Alerte du matin")); box.append(h);
  box.append(el("p","note","Chaque matin vers 6 h, une notification si les conditions sont bonnes pour tes espèces, plus un rappel la veille de l'ouverture et de la fermeture du brochet."));
  const sw=(label,hint,val,fn)=>{ const l=el("label","switch"); const i=el("input"); i.type="checkbox"; i.checked=!!val; i.addEventListener("change",()=>fn(i.checked));
    const t=el("span","switch-t"); t.append(el("b",null,label)); if(hint) t.append(el("span","note",hint)); l.append(i,el("span","switch-ui"),t); return l; };
  box.append(sw("Recevoir l'alerte du matin",null,pref.enabled,v=>{ pref.enabled=v; draw(); }));
  const body=el("div","alert-body"); body.hidden=!pref.enabled; box.append(body);

  // lieu
  const loc=el("div","field"); loc.append("Lieu surveillé");
  const lv=el("div","alert-place",pref.lat!=null?"📍 "+(pref.place||Number(pref.lat).toFixed(3)+", "+Number(pref.lon).toFixed(3)):"Aucun lieu choisi");
  const la=el("div","actions");
  la.append(btn("Ma position actuelle","btn small",()=>{
    if(!("geolocation" in navigator)) return toast("Localisation indisponible sur ce téléphone");
    navigator.geolocation.getCurrentPosition(p=>{ pref.lat=+p.coords.latitude.toFixed(4); pref.lon=+p.coords.longitude.toFixed(4); pref.place="Ma position"; draw(); },
      ()=>{ const c=window.CDJ_POS; if(c){ pref.lat=+c.lat.toFixed(4); pref.lon=+c.lon.toFixed(4); pref.place="Dernière position"; draw(); } else toast("Autorise la localisation pour l'appli"); },{timeout:10000,maximumAge:600000});
  }));
  const spots=A.spots||[];
  if(spots.length){
    const sel=el("select","alert-spot"); sel.setAttribute("aria-label","Choisir un spot"); sel.append(new Option("ou un spot de la carte…",""));
    spots.forEach(s=>sel.append(new Option(s.name,s.id)));
    sel.addEventListener("change",()=>{ const s=spots.find(x=>String(x.id)===sel.value); if(s){ pref.lat=s.lat; pref.lon=s.lon; pref.place=s.name.slice(0,60); draw(); } });
    la.append(sel);
  }
  loc.append(lv,la); body.append(loc);

  // espèces
  const spf=el("div","field"); spf.append("Espèces (aucune = toutes)");
  const chips=el("div","chips-pick");
  SP.forEach(([id,n])=>{ const on=(pref.species||[]).includes(id); const c=btn(n,"pick"+(on?" on":""),()=>{ const s=new Set(pref.species||[]); on?s.delete(id):s.add(id); pref.species=[...s]; draw(); }); c.setAttribute("aria-pressed",String(on)); chips.append(c); });
  spf.append(chips); body.append(spf);

  // seuil
  const th=el("label","field"); const tv=el("span","rk-v",pref.threshold+" %");
  const tl=el("span"); tl.append("Seuil de réussite ",tv);
  const r=el("input"); r.type="range"; r.min="50"; r.max="90"; r.step="5"; r.value=pref.threshold;
  r.addEventListener("input",()=>{ pref.threshold=Number(r.value); tv.textContent=r.value+" %"; });
  th.append(tl,r, el("span","note","Plus il est haut, plus l'alerte est rare (70 % = bonne journée)."));
  body.append(th);

  // type d'eau
  const wf=el("div","field"); wf.append("Type d'eau");
  const seg=el("div","seg"); WATER.forEach(([v,n])=>{ const b=btn(n,null,()=>{ pref.water=v; draw(); }); b.setAttribute("aria-pressed",String(pref.water===v)); seg.append(b); });
  wf.append(seg); body.append(wf);
  body.append(sw("Rappels d'ouverture et de fermeture","Brochet, 2e catégorie : 7 jours avant, la veille",pref.opening,v=>{ pref.opening=v; }));

  const act=el("div","actions");
  const save=btn("Enregistrer","btn primary",async()=>{
    if(pref.enabled&&pref.lat==null&&!pref.opening) return toast("Choisis un lieu pour recevoir les conditions");
    save.disabled=true;
    const row={user_id:A.me.id,enabled:pref.enabled,lat:pref.lat,lon:pref.lon,place:pref.place,species:pref.species||[],threshold:pref.threshold,water:pref.water,opening:pref.opening,updated_at:new Date().toISOString()};
    const {error}=await A.sb.from("alert_prefs").upsert(row,{onConflict:"user_id"});
    save.disabled=false;
    if(error) return toast(frError(error));
    pref._new=false; toast(pref.enabled?"Alerte du matin activée":"Alerte du matin désactivée"); draw();
  });
  act.append(save);
  if(!pref._new&&pref.enabled) act.append(btn("Tester maintenant","btn",async e=>{
    const b=e.currentTarget; b.disabled=true;
    const {error}=await A.sb.rpc("test_morning_alert");
    setTimeout(()=>b.disabled=false,8000);
    if(error) return toast(frError(error));
    toast("Test envoyé : la notification arrive dans quelques secondes");
  }));
  box.append(act);
  if(!("Notification" in window)||Notification.permission!=="granted") box.append(el("p","warn","Active d'abord les notifications ci-dessus, sinon l'alerte ne pourra pas s'afficher."));
}

const prevProfil=A.hooks.profil;
A.hooks.profil=()=>{ prevProfil?.(); load(); };
const prevChange=A.hooks.change;
A.hooks.change=()=>{ prevChange?.(); if(!A.me){ pref=null; const b=$("#alerts"); if(b) b.hidden=true; } else if(!$("#v-profil").hidden&&!pref) load(); };
if(A.me&&!$("#v-profil").hidden) load();
})();
