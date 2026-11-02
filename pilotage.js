// Rivio : pilotage de l'appli. Mode maintenance, statistiques d'usage,
// signalement de bug, « Quoi de neuf », export des données (RGPD), et pour le
// développeur : sauvegardes, bugs reçus, comptes inactifs.
(function(){
"use strict";
const A=window.CDJ; if(!A) return;
const {el,toast,frError}=A;
const $=s=>document.querySelector(s);
function btn(label,cls,fn){ const b=el("button",cls||"btn",label); b.type="button"; if(fn) b.addEventListener("click",fn); return b; }
const store={ get(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } }, set(k,v){ try{ localStorage.setItem(k,v); }catch(e){} } };
const when=iso=>iso?new Date(iso).toLocaleString("fr-FR",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}):"—";
const version=()=>($("#app-version")?.textContent||"").trim();
function sheet(title){
  const back=el("div","sheet-back"), sh=el("div","sheet"); sh.setAttribute("role","dialog"); sh.setAttribute("aria-modal","true"); sh.setAttribute("aria-label",title);
  const head=el("div","sheet-head"); head.append(el("h2",null,title)); const x=btn("✕","icon-btn"); x.setAttribute("aria-label","Fermer"); head.append(x); sh.append(head);
  const close=()=>back.remove(); x.addEventListener("click",close); back.addEventListener("click",e=>{ if(e.target===back) close(); });
  back.append(sh); document.body.append(back); return {sh,close};
}
function download(name,obj){
  const blob=new Blob([JSON.stringify(obj,null,1)],{type:"application/json"});
  const a=el("a"); a.href=URL.createObjectURL(blob); a.download=name; document.body.append(a); a.click();
  setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); },1000);
}

/* ---------- Mode maintenance ---------- */
let maint=null, maintAt=0;
async function checkMaintenance(force){
  if(!A.sb||(!force&&Date.now()-maintAt<120e3)) return;
  maintAt=Date.now();
  const {data}=await A.sb.from("app_flags").select("value").eq("key","maintenance").maybeSingle();
  maint=data?.value||null; drawMaintenance();
}
function drawMaintenance(){
  const on=!!maint?.on;
  let ov=$("#maint-ov");
  const admin=!!A.me?.is_admin;
  if(!on||admin){ ov?.remove(); }
  else{
    if(!ov){ ov=el("div","maint-ov"); ov.id="maint-ov"; ov.setAttribute("role","alertdialog"); ov.setAttribute("aria-modal","true"); document.body.append(ov); }
    ov.innerHTML="";
    const c=el("div","maint-card");
    c.append(el("div","maint-ico","🛠️"),el("h2",null,"Rivio est en maintenance"));
    c.append(el("p",null,maint.message||"On améliore l'appli. Elle revient très vite, merci de ta patience !"));
    if(maint.until) c.append(el("p","note","Retour prévu vers "+new Date(maint.until).toLocaleString("fr-FR",{weekday:"long",hour:"2-digit",minute:"2-digit"}).replace(":"," h ")+"."));
    c.append(btn("↻ Réessayer","btn primary",()=>checkMaintenance(true)));
    ov.append(c);
  }
  let bar=$("#maint-admin");
  if(on&&admin){ if(!bar){ bar=el("div","maint-admin"); bar.id="maint-admin"; $("main")?.prepend(bar); } bar.textContent="🛠️ Mode maintenance actif : les membres voient l'écran de maintenance. Désactive-le dans Profil › Modération."; }
  else bar?.remove();
}

/* ---------- Statistiques : écrans ouverts ---------- */
const seen=new Map();
function track(){
  if(!A.me||!A.sb) return;
  let h=(location.hash||"#conseils").slice(1).split("?")[0]||"conseils";
  if(h==="profil"){ const s=$("#v-profil")?.dataset.s; if(s) h="profil-"+s; }
  const last=seen.get(h)||0; if(Date.now()-last<30*6e4) return;
  seen.set(h,Date.now());
  A.sb.rpc("track_screen",{p_screen:h.slice(0,20)}).then(()=>{},()=>{});
}
window.addEventListener("hashchange",()=>setTimeout(track,300));
const prevPS=A.hooks.profilSub; A.hooks.profilSub=(...a)=>{ prevPS?.(...a); setTimeout(track,200); };

/* ---------- Quoi de neuf (après une mise à jour) ---------- */
const NEWS=[
  ["0.75",["🇬🇧 La version anglaise couvre maintenant presque tous les écrans (Profil › Réglages › Apparence et langue).","⚡ L'appli répond plus vite, surtout dans les groupes actifs.","Et en coulisses : sauvegarde chiffrée chaque nuit hors de Supabase, photos effacées dès qu'un contenu est supprimé."]],
  ["0.71",["🐞 Un souci ? Signale-le en deux touches dans Profil › Réglages, avec une capture d'écran.","📦 Télécharge toutes tes données quand tu veux (Profil › Réglages).","Et en coulisses : sauvegardes complètes chaque semaine."]],
  ["0.70",["✉️ Messages privés : touche le pseudo d'un pêcheur puis « Écrire ».","💬 Dans le chat, touche un message pour réagir ou répondre.","📣 Invite tes potes avec ton lien perso et deviens ambassadeur.","📸 La date et le spot de ta prise sont lus dans la photo.","🏆 Le groupe est prévenu quand un record tombe."]],
  ["0.69",["🎣 Ton type de pêche s'affiche sous ton nom (Profil › Mon profil public).","📴 Bulletins, traces et relevés notés sans réseau partent tout seuls au retour du réseau."]],
];
const vnum=v=>v.split(".").map(Number).reduce((a,x,i)=>a+x*Math.pow(1000,2-i),0);
function whatsNew(){
  const v=version(); if(!v) return;
  const prev=store.get("cdj-version-vue");
  store.set("cdj-version-vue",v);
  if(!prev||prev===v||!A.me) return;     // premier lancement : rien à montrer
  const items=NEWS.filter(([nv])=>vnum(nv)>vnum(prev)&&vnum(nv)<=vnum(v));
  if(!items.length) return;
  const {sh,close}=sheet("✨ Quoi de neuf ?");
  items.forEach(([nv,list])=>{ sh.append(el("h4","g-sub","Version "+nv)); const ul=el("ul","news-list"); list.forEach(t=>ul.append(el("li",null,t))); sh.append(ul); });
  const a=el("div","actions"); a.append(btn("C'est parti !","btn primary",close)); sh.append(a);
}

/* ---------- Réglages : signaler un bug, mes données ---------- */
function settingsPanels(){
  const anchor=$("#account-panel"); if(!anchor||$("#bug-panel")) return;
  const bp=el("div","panel"); bp.id="bug-panel"; bp.dataset.sub="reglages";
  bp.append(el("h2",null,"🐞 Un souci ? Signale un bug"));
  bp.append(el("p","note","Décris ce qui ne marche pas. La version de l'appli, ton téléphone et l'écran ouvert sont joints automatiquement."));
  const f=el("form","bug-form");
  const ta=el("textarea"); ta.maxLength=2000; ta.rows=4; ta.placeholder="Ex. : quand je publie une prise avec 3 photos, l'appli reste sur « Envoi… »"; ta.setAttribute("aria-label","Description du problème");
  const fl=el("label","field","Capture d'écran (facultatif)"); const fi=el("input"); fi.type="file"; fi.accept="image/*"; fl.append(fi);
  const ok=el("button","btn primary","Envoyer au développeur"); ok.type="submit";
  const tl=el("label","field","Ce qui ne marche pas"); tl.append(ta);
  f.append(tl,fl,ok); bp.append(f);
  f.addEventListener("submit",async e=>{
    e.preventDefault();
    if(ta.value.trim().length<5) return toast("Décris le problème en quelques mots");
    ok.disabled=true; ok.textContent="Envoi…";
    try{
      let photo_path=null;
      if(fi.files?.[0]){ const blob=A.compress?await A.compress(fi.files[0]):fi.files[0]; const path=A.me.id+"/bug-"+Date.now()+".jpg"; const {error}=await A.sb.storage.from("bugs").upload(path,blob,{contentType:"image/jpeg"}); if(!error) photo_path=path; }
      const extra={screen:window.innerWidth+"×"+window.innerHeight,online:navigator.onLine,group:A.cur,standalone:matchMedia("(display-mode: standalone)").matches,lang:navigator.language};
      const {error}=await A.sb.from("bug_reports").insert({user_id:A.me.id,body:ta.value.trim(),screen:(sessionStorage.getItem("cdj-last-screen")||location.hash||"").slice(0,40),version:version(),agent:(navigator.userAgent||"").slice(0,160),extra,photo_path});
      if(error) throw error;
      ta.value=""; fi.value=""; toast("🐞 Merci ! Le développeur est prévenu");
    }catch(err){ toast(frError(err)); }
    finally{ ok.disabled=false; ok.textContent="Envoyer au développeur"; }
  });
  const dp=el("div","panel"); dp.id="data-panel"; dp.dataset.sub="reglages";
  dp.append(el("h2",null,"📦 Mes données"));
  dp.append(el("p","note","Télécharge tout ce que ton compte a créé dans Rivio : profil, prises, bilans, messages, spots, traces… dans un fichier lisible (JSON)."));
  const dl=btn("Télécharger mes données","btn",async()=>{
    dl.disabled=true; dl.textContent="Préparation…";
    const {data,error}=await A.sb.rpc("export_my_data");
    dl.disabled=false; dl.textContent="Télécharger mes données";
    if(error) return toast(frError(error));
    download("rivio-mes-donnees-"+new Date().toISOString().slice(0,10)+".json",data); toast("📦 Fichier téléchargé");
  });
  const act=el("div","actions"); act.append(dl); dp.append(act);
  dp.append(el("p","note","Un compte inutilisé pendant 2 ans est prévenu, puis peut être supprimé avec ses données un mois plus tard."));
  anchor.before(bp,dp);
  // langue de l'interface
  const tp=$("#theme-panel");
  if(tp&&!$("#lang-panel")){
    const lp=el("div","panel"); lp.id="lang-panel"; lp.dataset.sub="reglages";
    lp.append(el("h2",null,"🌐 Langue"));
    const seg=el("div","seg lang-seg"); seg.setAttribute("role","radiogroup"); seg.setAttribute("aria-label","Langue / Language");
    [["fr","🇫🇷 Français"],["en","🇬🇧 English"]].forEach(([k,l])=>{ const b=btn(l,null,()=>{ if(k!==(window.CDJ_LANG||"fr")) window.CDJ_SETLANG?.(k); }); b.setAttribute("aria-pressed",String(k===(window.CDJ_LANG||"fr"))); b.dataset.noi18n="1"; seg.append(b); });
    lp.append(seg,el("p","note","Choisis la langue de l'interface. Les messages écrits par les membres ne sont pas traduits."));
    tp.before(lp);
  }
  const show=!!A.me; bp.hidden=!show; dp.hidden=!show;
}
// on retient l'écran d'où vient le signalement (avant d'aller dans Réglages)
window.addEventListener("hashchange",e=>{ try{ const from=(new URL(e.oldURL).hash||"").split("?")[0]; if(from&&from!=="#profil") sessionStorage.setItem("cdj-last-screen",from); }catch(_){} });

/* ---------- Sections du développeur, insérées dans la modération ---------- */
function section(title,sub){ const s=el("section","g-sec mod-sec"); const h=el("div","g-sec-head"); h.append(el("h2",null,title)); s.append(h); if(sub) s.append(el("p","note",sub)); return s; }

async function maintenanceSec(){
  const s=section("🛠️ Mode maintenance","Pendant une grosse mise à jour : les membres voient un écran d'attente, toi tu gardes l'accès.");
  const {data}=await A.sb.from("app_flags").select("value").eq("key","maintenance").maybeSingle();
  const v=data?.value||{on:false};
  const f=el("form","mod-form");
  const ml=el("label","field","Message affiché"); const mi=el("input"); mi.maxLength=200; mi.placeholder="On installe une grosse nouveauté, retour dans 30 minutes !"; mi.value=v.message||""; ml.append(mi);
  const ul=el("label","field","Retour prévu (facultatif)"); const ui=el("input"); ui.type="datetime-local"; if(v.until){ const d=new Date(v.until); ui.value=new Date(d-d.getTimezoneOffset()*6e4).toISOString().slice(0,16); } ul.append(ui);
  const state=el("p","note "+(v.on?"warn":""),v.on?"⚠️ La maintenance est ACTIVE.":"La maintenance est désactivée.");
  const ok=el("button","btn "+(v.on?"":"primary"),v.on?"Désactiver la maintenance":"Activer la maintenance"); ok.type="submit";
  f.append(state,ml,ul,ok); s.append(f);
  f.addEventListener("submit",async e=>{
    e.preventDefault();
    const on=!v.on;
    if(on&&!confirm("Activer la maintenance ? Tous les membres verront l'écran d'attente.")) return;
    const value={on,message:mi.value.trim(),until:ui.value?new Date(ui.value).toISOString():null};
    const {error}=await A.sb.from("app_flags").upsert({key:"maintenance",value,updated_at:new Date().toISOString(),updated_by:A.me.id});
    if(error) return toast(frError(error));
    toast(on?"🛠️ Maintenance activée":"✅ Maintenance terminée"); checkMaintenance(true);
    const n=await maintenanceSec(); s.replaceWith(n);
  });
  return s;
}

async function statsSec(){
  const s=section("📈 Statistiques d'usage","Comptes connectés qui ont ouvert l'appli. Rien n'est compté pour les visiteurs sans compte.");
  const {data:u,error}=await A.sb.rpc("usage_stats");
  if(error){ s.append(el("p","err",frError(error))); return s; }
  const tiles=el("div","health-tiles");
  const tile=(n,l)=>{ const t=el("div","health-tile"); t.append(el("b",null,n==null?"—":String(n)),el("span",null,l)); tiles.append(t); };
  tile(u.dau,"aujourd'hui"); tile(u.wau,"sur 7 jours"); tile(u.mau,"sur 30 jours"); tile(u.users,"comptes au total"); tile(u.new_7d,"nouveaux en 7 jours"); tile(u.retention==null?null:u.retention+" %","reviennent la semaine suivante");
  s.append(tiles);
  const max=Math.max(1,...(u.daily||[]).map(d=>d.n));
  const chart=el("div","usage-chart"); chart.setAttribute("role","img"); chart.setAttribute("aria-label","Pêcheurs actifs par jour sur 30 jours");
  (u.daily||[]).forEach(d=>{ const c=el("div","uc-col"); const bar=el("div","uc-bar"); bar.style.height=Math.max(2,Math.round(d.n/max*100))+"%"; c.title=new Date(d.day+"T12:00:00").toLocaleDateString("fr-FR",{day:"numeric",month:"short"})+" : "+d.n; c.append(bar); chart.append(c); });
  s.append(el("h4","g-sub","Pêcheurs actifs par jour (30 jours)"),chart);
  const NAMES={conseils:"Aujourd'hui",fil:"Fil",carte:"Carte",groupe:"Groupe",profil:"Profil","profil-moi":"Profil › Moi","profil-reglages":"Réglages","profil-matos":"Outils","profil-moderation":"Modération","profil-collection":"Collection"};
  if((u.screens||[]).length){
    s.append(el("h4","g-sub","Écrans les plus ouverts (7 jours)"));
    const top=u.screens[0].n||1, list=el("div","usage-screens");
    u.screens.forEach(x=>{ const r=el("div","us-row"); r.append(el("span","us-n",NAMES[x.screen]||x.screen)); const b=el("span","us-bar"); b.style.width=Math.round(x.n/top*100)+"%"; r.append(b,el("span","us-v",String(x.n))); list.append(r); });
    s.append(list);
  }
  // comptes inactifs
  const {data:ina}=await A.sb.rpc("inactive_accounts");
  s.append(el("h4","g-sub","Comptes inactifs depuis presque 2 ans ("+(ina?.length||0)+")"));
  if(!ina?.length) s.append(el("p","note","Aucun pour l'instant. Ils sont prévenus automatiquement le 2 de chaque mois."));
  (ina||[]).forEach(a=>{ const r=el("div","log-row"); r.append(el("span","log-ic","💤")); const t=el("div","log-txt"); t.append(el("b",null,"@"+a.username),el("span","note","dernière activité "+when(a.last_seen)+(a.warned?" · prévenu":" · pas encore prévenu"))); r.append(t);
    if(a.warned) r.append(btn("Supprimer","linkbtn danger",async()=>{ if(!confirm("Supprimer définitivement le compte @"+a.username+" et ses données ?")) return; const {error}=await A.sb.rpc("admin_delete_inactive",{p_user:a.id}); if(error) return toast(frError(error)); toast("Compte supprimé"); r.remove(); }));
    s.append(r); });
  return s;
}

async function backupsSec(){
  const s=section("💾 Sauvegardes","Copie de toutes les tables chaque dimanche à 3 h 15, gardée 8 semaines. Télécharge-en une de temps en temps pour l'avoir aussi chez toi.");
  const list=el("div","log-list"); s.append(list);
  const act=el("div","actions"); s.append(act);
  const now=btn("💾 Sauvegarder maintenant","btn small",async()=>{ now.disabled=true; const {error}=await A.sb.rpc("backup_now"); now.disabled=false; if(error) return toast(frError(error)); toast("💾 Sauvegarde faite"); draw(); });
  act.append(now);
  async function draw(){
    list.innerHTML="";
    const {data,error}=await A.sb.rpc("backup_list");
    if(error){ list.append(el("p","err",frError(error))); return; }
    if(!data?.length){ list.append(el("p","note","Aucune sauvegarde pour l'instant.")); return; }
    data.forEach(b=>{
      const r=el("div","log-row"); r.append(el("span","log-ic","💾"));
      const t=el("div","log-txt"); t.append(el("b",null,new Date(b.snap+"T12:00:00").toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long"})),el("span","note",b.tables+" tables · "+b.rows+" lignes")); r.append(t);
      const d=btn("Télécharger","linkbtn",async()=>{ d.disabled=true; const {data:x,error}=await A.sb.rpc("backup_export",{p_snap:b.snap}); d.disabled=false; if(error) return toast(frError(error)); download("rivio-sauvegarde-"+b.snap+".json",x); });
      r.append(d); list.append(r);
    });
  }
  await draw();
  return s;
}

async function bugsSec(){
  const s=section("🐞 Bugs signalés","Envoyés par les membres depuis Profil › Réglages.");
  const seg=el("div","seg log-filter"), list=el("div","log-list"); let st="open";
  [["open","À traiter"],["done","Résolus"]].forEach(([k,l])=>{ const b=btn(l,null,()=>{ st=k; seg.querySelectorAll("button").forEach(x=>x.setAttribute("aria-pressed",String(x===b))); draw(); }); b.setAttribute("aria-pressed",String(k===st)); seg.append(b); });
  s.append(seg,list);
  async function draw(){
    list.innerHTML="";
    const {data,error}=await A.sb.from("bug_reports").select("id,user_id,body,screen,version,agent,extra,photo_path,status,created_at,profiles(username)").eq("status",st).order("created_at",{ascending:false}).limit(40);
    if(error){ list.append(el("p","err",frError(error))); return; }
    if(!data.length){ list.append(el("p","note",st==="open"?"Aucun bug en attente 🎉":"Aucun bug résolu pour l'instant.")); return; }
    const paths=data.map(b=>b.photo_path).filter(Boolean);
    let urls={};
    if(paths.length){ const {data:sg}=await A.sb.storage.from("bugs").createSignedUrls(paths,3600); (sg||[]).forEach(x=>{ if(x.signedUrl) urls[x.path]=x.signedUrl; }); }
    data.forEach(b=>{
      const r=el("div","log-row bug-row"); r.append(el("span","log-ic","🐞"));
      const t=el("div","log-txt");
      t.append(el("b",null,"@"+(b.profiles?.username||"?")+" · "+when(b.created_at)));
      t.append(el("span","log-det",b.body));
      t.append(el("span","note",[b.version?"v"+b.version:null,b.screen,b.extra?.screen,b.extra?.online===false?"hors ligne":null,(b.agent||"").replace(/^Mozilla\/5\.0 \(/,"").split(")")[0]].filter(Boolean).join(" · ")));
      if(b.photo_path&&urls[b.photo_path]){ const a=el("a","bug-shot"); a.href=urls[b.photo_path]; a.target="_blank"; a.rel="noopener"; const im=el("img"); im.src=urls[b.photo_path]; im.alt="Capture jointe"; a.append(im); t.append(a); }
      const act=el("div","actions");
      act.append(btn(st==="open"?"✅ Résolu":"↩️ Rouvrir","linkbtn",async()=>{ const {error}=await A.sb.from("bug_reports").update({status:st==="open"?"done":"open"}).eq("id",b.id); if(error) return toast(frError(error)); draw(); }));
      if(b.profiles?.username&&A.openDM) act.append(btn("✉️ Répondre","linkbtn",()=>A.openDM(b.profiles.username,b.user_id)));
      t.append(act); r.append(t); list.append(r);
    });
  }
  await draw();
  return s;
}

A.adminSections=Object.assign(A.adminSections||{},{pilotage:async()=>[await bugsSec(),await statsSec(),await backupsSec(),await maintenanceSec()]});

/* ---------- Démarrage ---------- */
const prevCh=A.hooks.change; A.hooks.change=(...a)=>{ prevCh?.(...a); settingsPanels(); const show=!!A.me; ["#bug-panel","#data-panel"].forEach(q=>{ const n=$(q); if(n) n.hidden=!show; }); checkMaintenance(); drawMaintenance(); track(); setTimeout(whatsNew,1200); };
document.addEventListener("visibilitychange",()=>{ if(!document.hidden) checkMaintenance(); });
setInterval(()=>{ if(!document.hidden) checkMaintenance(true); },3*60e3);
settingsPanels(); setTimeout(()=>checkMaintenance(true),800);
if(A.me){ track(); setTimeout(whatsNew,1500); }
})();
