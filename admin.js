// Rivio : annonces à tous, remontée des erreurs, et pour le staff : journal de
// modération, santé de l'appli, rédaction des annonces.
(function(){
"use strict";
const A=window.CDJ; if(!A) return;
const {el,toast,frError}=A;
const $=s=>document.querySelector(s);
function btn(label,cls,fn){ const b=el("button",cls||"btn",label); b.type="button"; if(fn) b.addEventListener("click",fn); return b; }
const when=iso=>iso?new Date(iso).toLocaleString("fr-FR",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}):"—";
const store={ get(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } }, set(k,v){ try{ localStorage.setItem(k,v); }catch(e){} } };

/* ---------- Remontée des erreurs vers l'écran Santé ---------- */
const NOISE=/ResizeObserver loop|^Script error\.?$|chrome-extension:|moz-extension:|Non-Error promise rejection|AbortError|The operation was aborted/i;
let sentCount=0;
function report(e){
  try{
    if(!A.sb||!e||!e.message||NOISE.test(e.message)||NOISE.test(e.source||"")) return;
    if(++sentCount>20) return;           // au plus 20 envois par ouverture de l'appli
    const src=String(e.source||"").replace(location.origin,"").split("?")[0];
    A.sb.rpc("log_client_error",{p_message:String(e.message).slice(0,300),p_source:src.slice(0,120),p_line:e.line||null,
      p_version:($("#app-version")?.textContent||"").trim(),p_screen:(location.hash||"#").split("?")[0].slice(0,40),
      p_agent:(navigator.userAgent||"").replace(/\s*\(KHTML.*$/,"").slice(0,120)}).then(()=>{},()=>{});
  }catch(_){}
}
const buf=window.CDJ_ERRS||[];
buf.splice(0).forEach(report);
window.CDJ_ERRS={push:report};
if(!window.CDJ_ERRS_HOOKED){
  window.addEventListener("error",ev=>{ if(ev.message) report({message:ev.message,source:ev.filename,line:ev.lineno}); });
  window.addEventListener("unhandledrejection",ev=>{ const r=ev.reason; report({message:"Promesse rejetée : "+(r&&r.message||String(r)),source:r&&r.stack?String(r.stack).split("\n")[1]||"":""}); });
}

/* ---------- Bandeau d'annonce, visible par tous ---------- */
const LEVEL={info:["📣","Info"],nouveau:["✨","Nouveau"],important:["⚠️","Important"],maintenance:["🛠️","Maintenance"]};
const DKEY="cdj-annonces-lues";
const dismissed=()=>{ try{ return JSON.parse(store.get(DKEY)||"[]"); }catch(e){ return []; } };
let annTimer=null, lastAnn=0;
async function loadBanner(force){
  if(!A.sb) return;
  if(!force&&Date.now()-lastAnn<5*60e3) return;
  lastAnn=Date.now();
  const {data,error}=await A.sb.from("announcements").select("id,title,body,level,starts_at,ends_at").order("created_at",{ascending:false}).limit(5);
  if(error) return;
  const now=Date.now(), seen=dismissed();
  const a=(data||[]).find(x=>Date.parse(x.starts_at)<=now&&Date.parse(x.ends_at)>now&&!seen.includes(x.id));
  let bar=$("#annonce-bar");
  if(!a){ if(bar) bar.remove(); return; }
  if(!bar){ bar=el("div","annonce-bar"); bar.id="annonce-bar"; bar.setAttribute("role","status"); const m=$("main"); if(m) m.prepend(bar); else return; }
  bar.className="annonce-bar lvl-"+(LEVEL[a.level]?a.level:"info");
  bar.innerHTML="";
  const [ic,lab]=LEVEL[a.level]||LEVEL.info;
  const txt=el("div","ann-txt");
  txt.append(el("b",null,ic+" "+a.title));
  if(a.body) txt.append(el("span",null,a.body));
  const x=btn("✕","icon-btn ann-x",()=>{ const s=dismissed(); s.push(a.id); store.set(DKEY,JSON.stringify(s.slice(-30))); bar.remove(); loadBanner(true); });
  x.setAttribute("aria-label","Masquer l'annonce « "+lab+" »");
  bar.append(txt,x);
}
const prevCh=A.hooks.change; A.hooks.change=(...a)=>{ prevCh?.(...a); loadBanner(); };
document.addEventListener("visibilitychange",()=>{ if(!document.hidden) loadBanner(); });
clearInterval(annTimer); annTimer=setInterval(()=>{ if(!document.hidden) loadBanner(true); },15*60e3);
setTimeout(()=>loadBanner(true),1500);

/* ---------- Sections du staff, insérées par la modération ---------- */
function section(title,sub){
  const s=el("section","g-sec mod-sec"); const h=el("div","g-sec-head"); h.append(el("h2",null,title)); s.append(h);
  if(sub) s.append(el("p","note",sub));
  return s;
}
const ACTIONS={
  warning:["⚠️","Avertissement"], timeout:["⏳","Suspension"], lift_timeout:["✅","Suspension levée"],
  approve_post:["✔️","Prise validée"], reject_post:["✖️","Prise refusée"], delete_post:["🗑️","Prise supprimée"],
  delete_comment:["🗑️","Commentaire supprimé"], delete_message:["🗑️","Message supprimé"],
  approve_member:["🙋","Membre accepté"], refuse_member:["🚪","Demande refusée"], remove_member:["🚪","Membre retiré"],
  role_change:["🎖️","Rôle modifié"], report_done:["⚑","Signalement traité"], report_dismissed:["⚑","Signalement classé"],
  appeal_accepted:["📨","Contestation acceptée"], appeal_rejected:["📨","Contestation refusée"],
  controller_on:["🛡️","Garde-pêche nommé"], delete_account:["🗑️","Compte inactif supprimé"], controller_off:["🛡️","Garde-pêche retiré"], delete_group:["💥","Groupe supprimé"],
};
const FILTERS=[["tout","Tout",null],["sanctions","Sanctions",["warning","timeout","lift_timeout","appeal_accepted","appeal_rejected"]],
  ["contenus","Contenus",["approve_post","reject_post","delete_post","delete_comment","delete_message","report_done","report_dismissed"]],
  ["membres","Membres",["approve_member","refuse_member","remove_member","role_change","controller_on","controller_off","delete_group"]]];

async function journal(gmap){
  const s=section("📜 Journal de modération","Qui a fait quoi, et quand. Les actions automatiques n'y figurent pas.");
  const bar=el("div","seg log-filter"), list=el("div","log-list"), more=btn("Voir plus","btn small log-more");
  let filter="tout", limit=30;
  FILTERS.forEach(([k,l])=>{ const b=btn(l,null,()=>{ filter=k; limit=30; bar.querySelectorAll("button").forEach(x=>x.setAttribute("aria-pressed",String(x===b))); load(); }); b.setAttribute("aria-pressed",String(k===filter)); bar.append(b); });
  more.addEventListener("click",()=>{ limit+=30; load(); });
  s.append(bar,list,more);
  async function load(){
    list.innerHTML=""; list.append(el("p","note","Chargement…")); more.hidden=true;
    let q=A.sb.from("moderation_log").select("id,at,action,details,group_id,actor_p:profiles!moderation_log_actor_fkey(username),target_p:profiles!moderation_log_target_user_fkey(username)").order("at",{ascending:false}).limit(limit+1);
    const f=FILTERS.find(x=>x[0]===filter); if(f&&f[2]) q=q.in("action",f[2]);
    const {data,error}=await q;
    list.innerHTML="";
    if(error){ list.append(el("p","err",frError(error))); return; }
    if(!data.length){ list.append(el("p","note","Rien pour l'instant.")); return; }
    data.slice(0,limit).forEach(r=>{
      const [ic,lab]=ACTIONS[r.action]||["•",r.action];
      const row=el("div","log-row");
      row.append(el("span","log-ic",ic));
      const t=el("div","log-txt");
      const who=r.actor_p?.username?"@"+r.actor_p.username:"un modérateur";
      const target=r.target_p?.username?" · @"+r.target_p.username:"";
      t.append(el("b",null,lab+target));
      const meta=[who,when(r.at),r.group_id?(gmap?.get(r.group_id)?.name||"groupe #"+r.group_id):null].filter(Boolean).join(" · ");
      t.append(el("span","note",meta));
      if(r.details) t.append(el("span","log-det",r.details));
      row.append(t); list.append(row);
    });
    more.hidden=data.length<=limit;
  }
  await load();
  return s;
}

function tile(n,label,bad){ const t=el("div","health-tile"+(bad?" bad":"")); t.append(el("b",null,String(n)),el("span",null,label)); return t; }
async function sante(){
  const s=section("🩺 Santé de l'appli","Dernières 24 h, sauf mention contraire. Visible par le développeur uniquement.");
  const body=el("div","health"); s.append(body);
  const refresh=btn("↻ Actualiser","linkbtn",()=>load()); s.querySelector(".g-sec-head").append(refresh);
  async function load(){
    body.innerHTML=""; body.append(el("p","note","Analyse en cours…"));
    const {data:h,error}=await A.sb.rpc("app_health");
    body.innerHTML="";
    if(error){ body.append(el("p","err",frError(error))); return; }
    const cronBad=(h.cron||[]).filter(j=>j.failed_24h>0||(j.last&&j.last.status==="failed"));
    const verdict=el("p","health-verdict "+((h.errors_24h||cronBad.length||h.push_bad||(h.notify_failed||[]).length)?"warn":"ok"));
    verdict.textContent=(!h.errors_24h&&!cronBad.length&&!h.push_bad&&!(h.notify_failed||[]).length)?"✅ Tout fonctionne normalement.":"⚠️ Quelque chose mérite un coup d'œil (détails ci-dessous).";
    body.append(verdict);
    const tiles=el("div","health-tiles");
    tiles.append(tile(h.errors_24h,"erreurs sur les téléphones",h.errors_24h>0), tile(h.errors_7d,"erreurs sur 7 jours"),
      tile(h.push_ok,"notifications livrées"), tile(h.push_bad,"notifications en échec",h.push_bad>0),
      tile(cronBad.length,"tâches planifiées en panne",cronBad.length>0), tile((h.notify_failed||[]).length,"appels serveur refusés",(h.notify_failed||[]).length>0));
    body.append(tiles);
    const c=h.counts||{};
    body.append(el("p","note","👥 "+c.users+" comptes · 🔔 "+c.push_users+" avec notifications · 🫂 "+c.groups+" groupes · 🎣 "+c.posts_7d+" prises et 💬 "+c.messages_7d+" messages en 7 j · ⚑ "+c.reports_open+" signalement(s) ouvert(s) · 📨 "+c.appeals_open+" contestation(s) · ⏳ "+c.timeouts_active+" suspension(s) en cours"));
    if((h.top_errors||[]).length){
      const d=el("details","health-det"); d.open=h.errors_24h>0; d.append(el("summary",null,"Erreurs les plus fréquentes (7 jours)"));
      h.top_errors.forEach(e=>{ const r=el("div","log-row"); r.append(el("span","log-ic",String(e.n)+"×")); const t=el("div","log-txt"); t.append(el("b",null,e.message)); t.append(el("span","note",[e.users+" compte(s)","dernière le "+when(e.last_at),e.version?"v"+e.version:null,e.screen].filter(Boolean).join(" · "))); r.append(t); d.append(r); });
      body.append(d);
    }
    const dc=el("details","health-det"); dc.open=cronBad.length>0; dc.append(el("summary",null,"Tâches planifiées ("+(h.cron||[]).length+")"));
    (h.cron||[]).forEach(j=>{ const ok=!(j.failed_24h>0||(j.last&&j.last.status==="failed")); const r=el("div","log-row"); r.append(el("span","log-ic",!j.active?"⏸️":ok?"✅":"❌")); const t=el("div","log-txt"); t.append(el("b",null,j.job)); t.append(el("span","note",[j.schedule,j.last?"dernier passage "+when(j.last.at):"jamais lancée",j.failed_24h?j.failed_24h+" échec(s) en 24 h":null].filter(Boolean).join(" · "))); if(!ok&&j.last?.msg) t.append(el("span","log-det",j.last.msg)); r.append(t); dc.append(r); });
    body.append(dc);
    if((h.notify_failed||[]).length){
      const dn=el("details","health-det"); dn.open=true; dn.append(el("summary",null,"Appels refusés par le serveur de notifications"));
      h.notify_failed.forEach(f=>{ const r=el("div","log-row"); r.append(el("span","log-ic",String(f.status??"—"))); const t=el("div","log-txt"); t.append(el("b",null,when(f.at))); if(f.msg) t.append(el("span","log-det",f.msg)); r.append(t); dn.append(r); });
      body.append(dn);
    }
  }
  await load();
  return s;
}

const DUR=[["1","1 jour"],["3","3 jours"],["7","7 jours"],["30","30 jours"]];
async function annonces(){
  const s=section("📣 Annonce à tous","Un bandeau en haut de l'appli pour tous les utilisateurs, avec une notification si tu le souhaites.");
  const f=el("form","mod-form ann-form");
  const tl=el("label","field","Titre"); const ti=el("input"); ti.maxLength=80; ti.required=true; ti.placeholder="Ex. : Nouvelle version disponible"; tl.append(ti);
  const bl=el("label","field","Texte (facultatif)"); const bi=el("textarea"); bi.maxLength=500; bi.rows=3; bi.placeholder="Ce qui change, ce qu'il faut faire…"; bl.append(bi);
  const row=el("div","form-row");
  const ll=el("label","field","Type"); const ls=el("select"); Object.entries(LEVEL).forEach(([k,[ic,l]])=>ls.append(new Option(ic+" "+l,k))); ll.append(ls);
  const dl=el("label","field","Affichée pendant"); const ds=el("select"); DUR.forEach(([v,l])=>ds.append(new Option(l,v))); ds.value="7"; dl.append(ds);
  row.append(ll,dl);
  const pl=el("label","check"); const pc=el("input"); pc.type="checkbox"; pl.append(pc,document.createTextNode(" Envoyer aussi une notification à tout le monde"));
  const err=el("p","err"); err.hidden=true;
  const ok=el("button","btn primary","Publier l'annonce"); ok.type="submit";
  f.append(tl,bl,row,pl,err,ok);
  const list=el("div","log-list");
  f.addEventListener("submit",async e=>{
    e.preventDefault(); err.hidden=true;
    if(ti.value.trim().length<3){ err.hidden=false; err.textContent="Titre trop court"; return; }
    if(pc.checked&&!confirm("Envoyer une notification à tous les utilisateurs ?")) return;
    ok.disabled=true;
    const ends=new Date(Date.now()+Number(ds.value)*864e5).toISOString();
    const {error}=await A.sb.from("announcements").insert({title:ti.value.trim(),body:bi.value.trim()||null,level:ls.value,ends_at:ends,push:pc.checked});
    ok.disabled=false;
    if(error){ err.hidden=false; err.textContent=frError(error); return; }
    toast(pc.checked?"📣 Annonce publiée et notifiée":"📣 Annonce publiée"); f.reset(); ds.value="7"; draw(); loadBanner(true);
  });
  async function draw(){
    list.innerHTML="";
    const {data,error}=await A.sb.from("announcements").select("id,title,body,level,starts_at,ends_at,push").order("created_at",{ascending:false}).limit(10);
    if(error){ list.append(el("p","err",frError(error))); return; }
    if(!data.length){ list.append(el("p","note","Aucune annonce pour l'instant.")); return; }
    data.forEach(a=>{
      const live=Date.parse(a.ends_at)>Date.now();
      const r=el("div","log-row"+(live?"":" past")); r.append(el("span","log-ic",(LEVEL[a.level]||LEVEL.info)[0]));
      const t=el("div","log-txt"); t.append(el("b",null,a.title));
      t.append(el("span","note",(live?"En ligne jusqu'au ":"Terminée le ")+when(a.ends_at)+(a.push?" · notifiée":"")));
      if(a.body) t.append(el("span","log-det",a.body));
      r.append(t);
      if(live) r.append(btn("Retirer","linkbtn danger",async()=>{ const {error}=await A.sb.from("announcements").update({ends_at:new Date().toISOString()}).eq("id",a.id); if(error) return toast(frError(error)); toast("Annonce retirée"); draw(); loadBanner(true); }));
      list.append(r);
    });
  }
  s.append(f,el("h4","g-sub","Annonces récentes"),list);
  await draw();
  return s;
}

A.adminSections={journal,sante,annonces};
A.loadAnnonces=loadBanner;
})();
