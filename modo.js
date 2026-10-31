// Rivio : console de modération globale (Profil > Modération) et bouton « Signaler ».
// La modération propre à un groupe reste dans l'écran du groupe (groupe.js).
(function(){
"use strict";
const A=window.CDJ; if(!A) return;
const {el,toast,showErr,frError,confirmBtn,userLabel,ago}=A;
const $=s=>document.querySelector(s);
function btn(label,cls,fn){ const b=el("button",cls||"btn",label); b.type="button"; if(fn) b.addEventListener("click",fn); return b; }
function section(title,count){
  const s=el("section","g-sec mod-sec"); const h=el("div","g-sec-head"); h.append(el("h2",null,title));
  if(count!=null) h.append(el("span","modo-count"+(count?"":" zero"),String(count)));
  s.append(h); return s;
}
const KIND={post:"Prise",comment:"Commentaire",message:"Message du chat"};
const TABLE={post:"posts",comment:"comments",message:"messages"};
const TIMEOUTS=[["10","10 minutes",10],["60","1 heure",60],["1440","24 heures",1440],["10080","7 jours",10080]];
const STAFF=()=>!!(A.me&&(A.me.is_admin||A.me.is_controller));
const isStaff=()=>STAFF();
const activeSub=()=>document.querySelector("#v-profil")?.dataset.s==="moderation";

/* ---------- Signaler un contenu ---------- */
const REASONS=["Contenu inapproprié ou insultant","Spam ou publicité","Fausse prise, triche","Spot privé dévoilé sans accord","Autre"];
function report({kind,target_id,group_id,excerpt,author_id}){
  if(!A.me) return;
  const back=el("div","sheet-back"); const sh=el("div","sheet"); sh.setAttribute("role","dialog"); sh.setAttribute("aria-modal","true"); sh.setAttribute("aria-label","Signaler");
  const close=()=>{ back.remove(); document.removeEventListener("keydown",esc,true); }; const esc=e=>{ if(e.key==="Escape"){ e.stopPropagation(); close(); } };
  const head=el("div","sheet-head"); head.append(el("h2",null,"⚑ Signaler"));
  const x=btn("","icon-btn",close); x.setAttribute("aria-label","Fermer"); x.innerHTML='<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>'; head.append(x);
  sh.append(head, el("p","note","Les modérateurs du groupe et les contrôleurs seront prévenus. Ton signalement reste discret."));
  if(excerpt) sh.append(el("p","modo-ex",excerpt));
  const f=el("form","report-form"); let pick=REASONS[0];
  const opts=el("div","chips-pick");
  REASONS.forEach(r=>{ const b=btn(r,"pick"+(r===pick?" on":""),()=>{ pick=r; [...opts.children].forEach(c=>c.classList.toggle("on",c===b)); }); opts.append(b); });
  const ti=el("input"); ti.maxLength=150; ti.placeholder="Précision (facultatif)";
  const ok=el("button","btn primary","Envoyer le signalement"); ok.type="submit";
  f.append(opts,ti,ok);
  f.addEventListener("submit",async e=>{
    e.preventDefault(); ok.disabled=true;
    const reason=(pick+(ti.value.trim()?" : "+ti.value.trim():"")).slice(0,200);
    const {error}=await A.sb.from("reports").insert({group_id,user_id:A.me.id,kind,target_id,excerpt:excerpt?String(excerpt).slice(0,200):null,author_id:author_id||null,reason});
    ok.disabled=false;
    if(error) return toast(frError(error));
    close(); toast("Merci, les modérateurs sont prévenus");
  });
  sh.append(f); back.append(sh); document.body.append(back);
  back.addEventListener("click",e=>{ if(e.target===back) close(); });
  document.addEventListener("keydown",esc,true);
}
A.report=report;

// bouton sous les prises des autres
const prevFX=A.hooks.feedExtras;
A.hooks.feedExtras=list=>{
  prevFX?.(list);
  list.forEach(({post,foot})=>{
    if(!foot.isConnected||post.user_id===A.me?.id||foot.querySelector(".rep-btn")) return;
    const b=btn("⚑ Signaler","linkbtn rep-btn",()=>report({kind:"post",target_id:post.id,group_id:post.group_id,excerpt:[post.species,post.length_cm?post.length_cm+" cm":null,post.caption].filter(Boolean).join(" · "),author_id:post.user_id}));
    (foot.querySelector(".actions")||foot).append(b);
  });
};

/* ---------- Utilitaires de la console ---------- */
const ui={member:null, memberQuery:"", group:null, groupQuery:"", postStatus:"all", postQuery:""};
let seq=0, renderTimer=null;
const sameDay=iso=>new Date(iso).toLocaleString("fr-FR",{day:"numeric",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"});
const gname=(gmap,id)=>gmap.get(id)?.name||("Groupe #"+id);
function errLine(e){ return el("p","err",frError(e)); }
function nameWithBadge(p){
  const s=el("span","post-user","@"+(p?.username||"?"));
  if(p?.is_admin) s.append(el("span","badge","Développeur"));
  else if(p?.is_controller) s.append(el("span","badge controller","Contrôle"));
  return s;
}
function remaining(iso){
  let s=Math.max(0,Math.floor((new Date(iso).getTime()-Date.now())/1000));
  const d=Math.floor(s/86400); s-=d*86400;
  const h=Math.floor(s/3600); s-=h*3600;
  const m=Math.floor(s/60);
  if(d) return d+" j "+h+" h";
  if(h) return h+" h "+m+" min";
  return m+" min";
}
const stamp=iso=>iso?sameDay(iso):"—";
const userAt=p=>p?.username?"@"+p.username:null;
// Action sur une liste périmée : message clair + rafraîchissement.
function stale(refresh,msg){
  toast(msg||"Déjà traité par un autre modérateur — liste actualisée");
  refresh();
}

/* ---------- État du schéma de sanctions ---------- */
function schemaBanner(s,onRecheck){
  const d=el("div","mod-health "+(s?.ready?"ok":"warn"));
  d.setAttribute("role","status");
  if(s?.ready){
    d.append(el("b",null,"✔ Sanctions serveur actives"));
    d.append(el("span",null,"Schéma "+s.version+" : la base bloque les nouvelles publications et les modifications de contenu des membres suspendus."));
  }else if(s?.table){
    d.append(el("b",null,"⚠ Garde-fous incomplets"));
    d.append(el("span",null,"La table des sanctions existe, mais la migration 0007 n'est pas appliquée : les modifications de contenu ne sont pas encore bloquées. Applique migrations/0007_timeout_update_guards.sql."));
  }else{
    d.append(el("b",null,"⚠ Migration absente — sanctions inactives"));
    d.append(el("span",null,"La base n'applique pas les sanctions. Applique migrations/0006_timeouts.sql puis 0007_timeout_update_guards.sql avant de sanctionner un membre."));
  }
  if(!s?.ready&&onRecheck){
    const b=btn("Vérifier à nouveau","linkbtn",()=>onRecheck());
    d.append(b);
  }
  return d;
}
// Fiche d'une sanction : qui, motif, dates, levée. Utilisée pour l'actif et l'historique.
function sanctionCard(t,active){
  const c=el("div","modo-item sanction");
  const state=t.lifted_at?"levée":active?"active":new Date(t.ends_at).getTime()<=Date.now()?"expirée":"active";
  const head=el("div","sanction-head");
  head.append(el("span","badge "+(state==="active"?"wait":state==="expirée"?"":"owner"),state));
  head.append(el("span","modo-meta","du "+stamp(t.starts_at)+" au "+stamp(t.ends_at)));
  c.append(head);
  c.append(el("p","modo-ex","Motif : "+t.reason));
  c.append(el("div","post-date","Appliquée par "+(userAt(t.creator)||"un compte supprimé")+" · "+stamp(t.starts_at)));
  if(active) c.append(el("div","post-date",remaining(t.ends_at)+" restantes"));
  if(t.lifted_at){
    c.append(el("div","post-date","Levée par "+(userAt(t.lifter)||"un compte supprimé")+" le "+stamp(t.lifted_at)+(t.lift_reason?" · "+t.lift_reason:"")));
  }
  return c;
}

/* ---------- Recours du membre (Profil > Moi) ---------- */
const APPEAL_STATUS={
  open:["En attente","wait"],
  accepted:["Accepté","accepted"],
  rejected:["Refusé","rejected"],
};
// Détecte une migration 0008 absente, que l'erreur vienne de Postgres (42P01)
// ou de PostgREST (table ou fonction absente du cache de schéma).
const missingSchema=e=>!!e&&(e.code==="42P01"||e.code==="PGRST202"||e.code==="PGRST205"
  ||/does not exist|schema cache|could not find the (table|function)/i.test(e.message||""));
const missingTable=missingSchema;
function appealStatusBadge(status){
  const [label,cls]=APPEAL_STATUS[status]||[status||"?",""];
  return el("span","badge "+cls,label);
}
function appealMemberCard(a){
  const c=el("div","modo-item appeal");
  const head=el("div","sanction-head");
  head.append(appealStatusBadge(a.status));
  head.append(el("span","modo-meta","envoyé le "+stamp(a.created_at)));
  c.append(head);
  c.append(el("p","modo-ex","« "+a.message+" »"));
  if(a.reply){
    const r=el("div","appeal-reply");
    r.append(el("b",null,"Réponse du staff"));
    r.append(el("p",null,a.reply));
    c.append(r);
  }
  if(a.handled_at) c.append(el("div","post-date","Traité le "+stamp(a.handled_at)));
  return c;
}
let appealPanelSeq=0, appealPanelTimeout=null;
async function renderSanctionPanel(){
  const box=$("#sanction-panel"); if(!box) return;
  if(!A.me){ box.hidden=true; box.innerHTML=""; return; }
  const mySeq=++appealPanelSeq;
  try{ await A.loadTimeout?.(); }catch(e){}
  ensureTimeoutBanner();
  const t=A.isTimedOut?.()?A.myTimeout:null;
  let list=[], missing=false, error=null;
  try{
    const r=await A.sb.from("sanction_appeals")
      .select("id,timeout_id,message,status,reply,created_at,handled_at")
      .eq("user_id",A.me.id).order("created_at",{ascending:false}).limit(20);
    if(r.error){ if(missingTable(r.error)) missing=true; else error=r.error; }
    else list=r.data||[];
  }catch(e){ error=e; }
  if(mySeq!==appealPanelSeq) return;
  appealPanelTimeout=t?String(t.id):null;
  if(!t && !list.length){ box.hidden=true; box.innerHTML=""; return; }
  if(!t && error){ box.hidden=true; box.innerHTML=""; return; }
  box.hidden=false; box.innerHTML="";
  const head=el("div","g-sec-head"); head.append(el("h2",null,"Recours")); box.append(head);
  if(error){ box.append(errLine(error)); return; }

  if(t){
    const cur=list.find(a=>String(a.timeout_id)===String(t.id));
    if(missing){
      box.append(el("p","note warn","Le recours n'est pas encore disponible : la migration 0008_sanction_appeals.sql doit être appliquée."));
    }else if(cur){
      box.append(appealMemberCard(cur));
      box.append(el("p","note",cur.status==="open"
        ?"Le staff examine ta demande. La sanction reste active : tu peux lire l'application, mais l'écriture reste bloquée jusqu'à sa décision."
        :cur.status==="accepted"
          ?"La sanction a été levée après examen de ce recours."
          :"Le staff a examiné ce recours et a maintenu la sanction."));
    }else{
      box.append(el("p","note","Tu peux demander un réexamen de cette sanction. Tant que le staff n'a pas répondu, la sanction reste active : la lecture est possible, mais l'écriture reste bloquée. Un seul recours est possible par sanction."));
      const f=el("form","appeal-form");
      const lab=el("label","field","Explique ta demande");
      const ta=el("textarea");
      ta.required=true; ta.minLength=10; ta.maxLength=1000; ta.rows=4;
      ta.placeholder="Ce que tu souhaites faire corriger ou préciser…";
      lab.append(ta); f.append(lab);
      const err=el("p","err"); err.hidden=true; f.append(err);
      const ok3=el("button","btn primary","Envoyer ma demande"); ok3.type="submit"; f.append(ok3);
      f.addEventListener("submit",async ev=>{
        ev.preventDefault(); showErr(err);
        const msg=ta.value.trim();
        if(msg.length<10){ showErr(err,"Explique ta demande en 10 caractères minimum."); ta.focus(); return; }
        ok3.disabled=true;
        const r=await A.sb.rpc("submit_sanction_appeal",{p_timeout_id:t.id,p_message:msg});
        ok3.disabled=false;
        if(r.error){
          if(missingTable(r.error)) return showErr(err,"Le recours n'est pas disponible : la migration 0008 doit être appliquée.");
          if(/déjà/.test(r.error.message||"")){ showErr(err,frError(r.error)); renderSanctionPanel(); return; }
          return showErr(err,frError(r.error));
        }
        toast("Recours envoyé au staff");
        renderSanctionPanel();
      });
      box.append(f);
    }
  }

  const past=list.filter(a=>!t||String(a.timeout_id)!==String(t.id)).slice(0,5);
  if(past.length){
    box.append(el("h3","g-sub","Mes recours"));
    past.forEach(a=>box.append(appealMemberCard(a)));
  }
}

/* ---------- Contexte des signalements ---------- */
async function loadReportContext(R){
  const ids=kind=>[...new Set(R.filter(r=>r.kind===kind).map(r=>Number(r.target_id)).filter(Boolean))];
  const pIds=ids("post"), cIds=ids("comment"), mIds=ids("message");
  const empty={data:[]};
  const [pr,cr,mr]=await Promise.all([
    pIds.length?A.sb.from("posts").select("id,species,length_cm,weight_kg,caption,bait,photo_path,photo_paths,status").in("id",pIds):Promise.resolve(empty),
    cIds.length?A.sb.from("comments").select("id,post_id,body,created_at").in("id",cIds):Promise.resolve(empty),
    mIds.length?A.sb.from("messages").select("id,group_id,body,photo_path,audio_path,audio_secs,created_at").in("id",mIds):Promise.resolve(empty),
  ]);
  const parentIds=[...new Set((cr.data||[]).map(c=>c.post_id).filter(Boolean))];
  const par=parentIds.length?await A.sb.from("posts").select("id,species,length_cm,caption,photo_path,photo_paths").in("id",parentIds):empty;
  const map=arr=>new Map((arr||[]).map(x=>[String(x.id),x]));
  return {posts:map(pr.data),comments:map(cr.data),messages:map(mr.data),parents:map(par.data),errs:[pr.error,cr.error,mr.error,par.error].filter(Boolean)};
}
function reportContextText(r,ctx){
  if(r.kind==="post"){
    const p=ctx.posts.get(String(r.target_id));
    if(!p) return {text:"Contenu introuvable (peut-être déjà supprimé)."};
    const title=[p.species,p.length_cm?String(p.length_cm).replace(".",",")+" cm":null,p.weight_kg?String(p.weight_kg).replace(".",",")+" kg":null].filter(Boolean).join(" · ")||"Prise sans espèce";
    return {text:title, note:[p.bait,p.caption].filter(Boolean).join(" — ")||null};
  }
  if(r.kind==="comment"){
    const c=ctx.comments.get(String(r.target_id));
    if(!c) return {text:"Commentaire introuvable (peut-être déjà supprimé)."};
    const p=ctx.parents.get(String(c.post_id));
    return {text:"« "+c.body+" »", note:p?"sous la prise "+(p.species||"sans espèce")+(p.caption?" — "+p.caption:""):null};
  }
  if(r.kind==="message"){
    const m=ctx.messages.get(String(r.target_id));
    if(!m) return {text:"Message introuvable (peut-être déjà supprimé)."};
    const parts=[];
    if(m.body) parts.push("« "+m.body+" »");
    if(m.photo_path) parts.push("[photo]");
    if(m.audio_path) parts.push("[vocal"+(m.audio_secs?" "+m.audio_secs+" s":"")+"]");
    return {text:parts.join(" ")||"Message vide"};
  }
  return {text:r.excerpt||""};
}
function openReportContent(r,ctx){
  if(r.kind==="post"){ A.openPost?.(Number(r.target_id)); return; }
  if(r.kind==="comment"){ const c=ctx.comments.get(String(r.target_id)); A.openPost?.(Number(c?.post_id||r.target_id)); return; }
  if(r.kind==="message"){ A.setGroup?.(Number(r.group_id)); location.hash="#fil"; setTimeout(()=>A.hooks?.openChat?.(),300); }
}
function queueRender(opts){
  clearTimeout(renderTimer);
  renderTimer=setTimeout(()=>render(opts||{}),80);
}
async function fetchGroups(){
  const {data,error}=await A.sb.from("groups").select("id,name,region,require_approval,post_approval,created_at").order("name");
  if(error) throw error;
  return data||[];
}
async function signedMap(paths){
  const urls={}; if(!paths.length) return urls;
  const {data,error}=await A.sb.storage.from("photos").createSignedUrls(paths,3600);
  if(error) throw error;
  (data||[]).forEach(x=>{ if(x.signedUrl) urls[x.path]=x.signedUrl; });
  return urls;
}

/* ---------- 1. À traiter ---------- */
async function renderTodo(gmap, groupFilter){
  const [reps,pend,posts]=await Promise.all([
    A.sb.from("reports").select("id,group_id,user_id,kind,target_id,excerpt,author_id,reason,created_at").eq("status","open").order("created_at",{ascending:false}).limit(100),
    A.sb.from("memberships").select("group_id,user_id,joined_at,profiles(username,is_admin,is_controller)").eq("status","pending").limit(200),
    A.sb.from("posts").select("id,group_id,user_id,species,length_cm,weight_kg,caption,bait,photo_path,photo_paths,created_at,profiles!posts_user_id_fkey(username,is_admin,is_controller)").eq("status","pending").order("created_at").limit(100),
  ]);
  const errs=[reps.error,pend.error,posts.error].filter(Boolean);
  let R=reps.data||[], P=pend.data||[], Q=posts.data||[];
  if(groupFilter){
    R=R.filter(x=>x.group_id===groupFilter);
    P=P.filter(x=>x.group_id===groupFilter);
    Q=Q.filter(x=>x.group_id===groupFilter);
  }
  R=R.filter(x=>A.canModerate(x.group_id));
  P=P.filter(x=>A.canModerate(x.group_id)&&x.user_id!==A.me.id);
  Q=Q.filter(x=>A.canModerate(x.group_id));
  const sec=section("À traiter",R.length+P.length+Q.length);
  const box=el("div","list tight"); sec.append(box);
  if(groupFilter){
    const g=gmap.get(groupFilter);
    if(g) box.append(el("p","note","Filtré sur « "+g.name+" »."));
  }
  errs.forEach(e=>box.append(errLine(e)));

  const refresh=()=>{ const y=window.scrollY; render({keepScroll:true,y}); };

  // Contenu réellement signalé : permet de décider sans chercher ailleurs.
  let ctx={posts:new Map(),comments:new Map(),messages:new Map(),parents:new Map(),errs:[]};
  if(R.length){
    try{ ctx=await loadReportContext(R); }
    catch(e){ ctx.errs=[e]; }
  }
  ctx.errs.forEach(e=>box.append(errLine(e)));

  // signalements
  const ids=[...new Set(R.flatMap(r=>[r.user_id,r.author_id]).filter(Boolean))];
  const names=new Map();
  if(ids.length){
    const {data,error}=await A.sb.from("profiles").select("id,username,is_admin,is_controller").in("id",ids);
    if(error) box.append(errLine(error));
    (data||[]).forEach(p=>names.set(p.id,p));
  }
  let urls={};
  try{
    urls=await signedMap(Q.flatMap(p=>(p.photo_paths&&p.photo_paths.length)?[p.photo_paths[0]]:(p.photo_path?[p.photo_path]:[])));
  }catch(e){ box.append(errLine(e)); }

  if(R.length) box.append(el("h4","g-sub","Signalements ("+R.length+")"));
  R.forEach(r=>{
    const c=el("div","modo-item");
    c.append(el("div","modo-meta",(KIND[r.kind]||r.kind)+" · "+gname(gmap,r.group_id)+" · "+ago(r.created_at)));
    const who=el("div"); who.append("Signalé par "); who.append(nameWithBadge(names.get(r.user_id)));
    if(r.author_id){ who.append(" · auteur "); who.append(nameWithBadge(names.get(r.author_id))); }
    c.append(who, el("b",null,r.reason));
    // Aperçu du contenu au moment de la décision (et non seulement à l'instant du signalement).
    const info=reportContextText(r,ctx);
    const cx=el("div","modo-ctx");
    cx.append(el("b",null,(KIND[r.kind]||r.kind)+" signalé"));
    cx.append(el("div",null,info.text));
    if(info.note) cx.append(el("div","post-date",info.note));
    c.append(cx);
    const nav=el("div","actions");
    const found=(r.kind==="post"&&ctx.posts.has(String(r.target_id)))
      ||(r.kind==="comment"&&ctx.comments.has(String(r.target_id)))
      ||(r.kind==="message"&&ctx.messages.has(String(r.target_id)));
    if(found) nav.append(btn("Voir le contenu","linkbtn",()=>openReportContent(r,ctx)));
    const author=names.get(r.author_id);
    if(author?.username) nav.append(btn("Voir l'auteur","linkbtn",()=>A.openProfile?.(author.username)));
    if(nav.children.length) c.append(nav);

    const act=el("div","actions");
    // Mise à jour conditionnelle : si un autre modérateur a déjà traité le
    // signalement, aucune ligne ne correspond et la liste est rafraîchie.
    const done=async st=>{
      const {data,error}=await A.sb.from("reports").update({status:st,handled_by:A.me.id}).eq("id",r.id).eq("status","open").select("id");
      if(error){ toast(frError(error)); return false; }
      if(!data||!data.length){ stale(refresh,"Signalement déjà traité par un autre modérateur — liste actualisée"); return false; }
      return true;
    };
    act.append(btn("Classer sans suite","btn small",async()=>{
      if(await done("dismissed")){ toast("Signalement classé"); refresh(); }
    }));
    act.append(confirmBtn("Supprimer le contenu","Confirmer la suppression",async()=>{
      const {data:cur,error:ce}=await A.sb.from("reports").select("status").eq("id",r.id).maybeSingle();
      if(ce) return toast(frError(ce));
      if(!cur) return stale(refresh,"Signalement introuvable — liste actualisée");
      if(cur.status!=="open") return stale(refresh,"Signalement déjà traité par un autre modérateur — liste actualisée");
      const table=TABLE[r.kind];
      if(table){
        const {data:del,error}=await A.sb.from(table).delete().eq("id",r.target_id).select("id");
        if(error) return toast(frError(error));
        if(!del||!del.length) toast("Contenu déjà supprimé");
      }
      if(await done("done")){ toast("Contenu supprimé"); refresh(); A.loadFeed?.(); }
    },"btn small danger-btn"));
    c.append(act); box.append(c);
  });

  // adhésions
  if(P.length) box.append(el("h4","g-sub","Demandes d'adhésion ("+P.length+")"));
  P.forEach(m=>{
    const c=el("div","modo-item");
    const t=el("div"); t.append(nameWithBadge(m.profiles)); t.append(" veut rejoindre « "+gname(gmap,m.group_id)+" »");
    c.append(t);
    const act=el("div","actions");
    act.append(confirmBtn("Refuser","Confirmer",async()=>{
      const {data,error}=await A.sb.from("memberships").delete().eq("group_id",m.group_id).eq("user_id",m.user_id).eq("status","pending").select("user_id");
      if(error) return toast(frError(error));
      if(!data||!data.length) return stale(refresh,"Demande déjà traitée par un autre modérateur — liste actualisée");
      toast("Demande refusée"); refresh();
    },"btn small"));
    act.append(btn("Accepter","btn primary small",async()=>{
      const {data:cur,error:ce}=await A.sb.from("memberships").select("status").eq("group_id",m.group_id).eq("user_id",m.user_id).maybeSingle();
      if(ce) return toast(frError(ce));
      if(!cur||cur.status!=="pending") return stale(refresh,"Demande déjà traitée par un autre modérateur — liste actualisée");
      const {error}=await A.sb.rpc("approve_member",{p_group:m.group_id,p_user:m.user_id});
      if(error) return toast(frError(error));
      toast("@"+(m.profiles?.username||"?")+" a rejoint le groupe"); await A.loadGroups(); refresh();
    }));
    c.append(act); box.append(c);
  });

  // publications
  if(Q.length) box.append(el("h4","g-sub","Publications à valider ("+Q.length+")"));
  Q.forEach(p=>{
    const c=el("div","modo-item");
    const top=el("div"); top.append(nameWithBadge(p.profiles)); top.append(" · "+gname(gmap,p.group_id)+" · "+ago(p.created_at));
    c.append(top);
    const ph=(p.photo_paths&&p.photo_paths.length)?p.photo_paths[0]:p.photo_path;
    if(ph&&urls[ph]){ const im=el("img","modo-img"); im.src=urls[ph]; im.alt="Photo de la prise"; im.loading="lazy"; c.append(im); }
    c.append(el("div",null,[p.species,p.length_cm?String(p.length_cm).replace(".",",")+" cm":null,p.weight_kg?String(p.weight_kg).replace(".",",")+" kg":null].filter(Boolean).join(" · ")||"Sans espèce"));
    if(p.caption||p.bait) c.append(el("p","modo-ex",[p.bait,p.caption].filter(Boolean).join(" — ")));
    const act=el("div","actions");
    act.append(confirmBtn("Refuser","Confirmer",async()=>{
      const {data:cur,error:ce}=await A.sb.from("posts").select("status,photo_path,photo_paths").eq("id",p.id).maybeSingle();
      if(ce) return toast(frError(ce));
      if(!cur) return stale(refresh,"Publication déjà supprimée — liste actualisée");
      if(cur.status!=="pending") return stale(refresh,"Publication déjà traitée par un autre modérateur — liste actualisée");
      const all=(cur.photo_paths&&cur.photo_paths.length)?cur.photo_paths:(cur.photo_path?[cur.photo_path]:[]);
      const {data:del,error}=await A.sb.from("posts").delete().eq("id",p.id).select("id"); if(error) return toast(frError(error));
      if(!del||!del.length) return stale(refresh,"Publication déjà traitée — liste actualisée");
      if(all.length) await A.sb.storage.from("photos").remove(all);
      toast("Publication refusée"); refresh(); A.loadFeed?.();
    },"btn small"));
    act.append(btn("Valider","btn primary small",async()=>{
      const {data:cur,error:ce}=await A.sb.from("posts").select("status").eq("id",p.id).maybeSingle();
      if(ce) return toast(frError(ce));
      if(!cur||cur.status!=="pending") return stale(refresh,"Publication déjà traitée par un autre modérateur — liste actualisée");
      const {error}=await A.sb.rpc("approve_post",{p_id:p.id}); if(error) return toast(frError(error));
      toast("Publication validée"); refresh(); A.loadFeed?.();
    }));
    c.append(act); box.append(c);
  });

  if(!R.length&&!P.length&&!Q.length&&!errs.length) box.append(el("p","empty small","Rien à traiter pour le moment."));
  return sec;
}

/* ---------- 2. Recours contre les sanctions ---------- */
function appealContext(t){
  const c=el("div","modo-ctx");
  if(!t){
    c.append(el("b",null,"Sanction introuvable"));
    c.append(el("span",null,"La sanction liée à ce recours n'existe plus."));
    return c;
  }
  const state=t.lifted_at?"levée":new Date(t.ends_at).getTime()<=Date.now()?"expirée":"active";
  c.append(el("b",null,"Sanction "+state));
  c.append(el("span",null,"du "+stamp(t.starts_at)+" au "+stamp(t.ends_at)+" · motif : "+t.reason));
  if(t.lifted_at) c.append(el("span",null,"Levée le "+stamp(t.lifted_at)+(t.lift_reason?" · "+t.lift_reason:"")));
  else if(state==="active") c.append(el("span",null,remaining(t.ends_at)+" restantes"));
  return c;
}
async function renderAppeals(){
  const r=await A.sb.from("sanction_appeals")
    .select("id,timeout_id,user_id,message,status,reply,created_at,handled_at,member:profiles!sanction_appeals_user_fkey(username,is_admin,is_controller),handler:profiles!sanction_appeals_handled_by_fkey(username)")
    .order("created_at",{ascending:false}).limit(60);
  if(r.error){
    const sec=section("Recours");
    if(missingTable(r.error)) sec.append(el("p","note warn","Les recours ne sont pas encore disponibles : applique migrations/0008_sanction_appeals.sql."));
    else sec.append(errLine(r.error));
    return sec;
  }
  const list=r.data||[];
  const open=list.filter(a=>a.status==="open");
  const sec=section("Recours",open.length);

  const ids=[...new Set(list.map(a=>Number(a.timeout_id)).filter(Boolean))];
  let tmap=new Map();
  if(ids.length){
    const tr=await A.sb.from("moderation_timeouts").select("id,reason,starts_at,ends_at,lifted_at,lift_reason").in("id",ids);
    if(tr.error) sec.append(errLine(tr.error));
    else tmap=new Map((tr.data||[]).map(t=>[String(t.id),t]));
  }

  const addCard=a=>{
    const c=el("div","modo-item appeal");
    const head=el("div","sanction-head");
    head.append(nameWithBadge(a.member));
    head.append(appealStatusBadge(a.status));
    head.append(el("span","modo-meta","envoyé le "+stamp(a.created_at)));
    c.append(head);
    c.append(el("p","modo-ex","« "+a.message+" »"));
    c.append(appealContext(tmap.get(String(a.timeout_id))));
    if(a.status==="open"){
      const f=el("form","appeal-reply-form");
      const lab=el("label","field","Réponse au membre");
      const ta=el("textarea");
      ta.required=true; ta.minLength=3; ta.maxLength=1000; ta.rows=3;
      ta.placeholder="Explique la décision…";
      lab.append(ta); f.append(lab);
      const err=el("p","err"); err.hidden=true; f.append(err);
      const send=async accept=>{
        showErr(err);
        const reply=ta.value.trim();
        if(reply.length<3){ showErr(err,"Écris une réponse avant de valider."); ta.focus(); return; }
        const {error}=await A.sb.rpc("respond_sanction_appeal",{p_id:a.id,p_accept:accept,p_reply:reply});
        if(error){
          if(error.code==="42883"||error.code==="PGRST202") return showErr(err,"La migration 0008 n'est pas appliquée.");
          if(/déjà|introuvable|terminée|levée/i.test(error.message||"")) return stale(()=>render({keepScroll:true,y:window.scrollY}),"Recours déjà traité — liste actualisée");
          return showErr(err,frError(error));
        }
        toast(accept?"Recours accepté — sanction levée":"Recours refusé — sanction maintenue");
        render({keepScroll:true,y:window.scrollY});
      };
      const act=el("div","actions");
      act.append(confirmBtn("Lever la sanction","Confirmer la levée",()=>send(true),"btn primary small"));
      act.append(confirmBtn("Maintenir la sanction","Confirmer le maintien",()=>send(false),"btn small"));
      f.append(act); c.append(f);
    }else if(a.reply){
      const rep=el("div","appeal-reply");
      rep.append(el("b",null,"Réponse du staff"+(a.handler?.username?" (@"+a.handler.username+")":"")));
      rep.append(el("p",null,a.reply));
      c.append(rep);
      if(a.handled_at) c.append(el("div","post-date","Traité le "+stamp(a.handled_at)));
    }
    return c;
  };

  if(open.length){
    sec.append(el("h3","g-sub","En attente ("+open.length+")"));
    open.forEach(a=>sec.append(addCard(a)));
  }else{
    sec.append(el("p","note","Aucun recours en attente."));
  }
  const done=list.filter(a=>a.status!=="open").slice(0,10);
  if(done.length){
    sec.append(el("h3","g-sub","Recours traités"));
    done.forEach(a=>sec.append(addCard(a)));
  }
  return sec;
}

/* ---------- 2. Membres de l'application ---------- */
async function renderMembers(gmap,schema){
  const sec=section("Membres de l'application");
  const l=el("label","field","Rechercher un membre par pseudo");
  const inp=el("input"); inp.type="search"; inp.placeholder="@pseudo"; inp.autocomplete="off"; inp.value=ui.memberQuery;
  l.append(inp); sec.append(l);
  const results=el("div","list tight"); sec.append(results);
  const detail=el("div"); sec.append(detail);
  let timer=null, searchSeq=0;

  const runSearch=async()=>{
    const q=inp.value.trim().replace(/^@/,"");
    ui.memberQuery=inp.value;
    const id=++searchSeq;
    results.innerHTML="";
    if(q.length<2){ results.append(el("p","note","Tape au moins 2 lettres du pseudo.")); return; }
    const {data,error}=await A.sb.from("profiles").select("id,username,is_admin,is_controller,created_at").ilike("username","%"+q+"%").order("username").limit(20);
    if(id!==searchSeq) return;
    if(error){ results.append(errLine(error)); return; }
    if(!data?.length){ results.append(el("p","note","Aucun membre trouvé.")); return; }
    data.forEach(p=>{
      const b=el("button","mrow mod-row"); b.type="button";
      b.append(nameWithBadge(p), el("span","todo-go","Examiner"));
      b.addEventListener("click",()=>{ ui.member=p; ui.memberData=null; render({keepScroll:true,y:window.scrollY}); });
      results.append(b);
    });
  };
  inp.addEventListener("input",()=>{ clearTimeout(timer); timer=setTimeout(runSearch,300); });
  if(ui.memberQuery) runSearch(); else results.append(el("p","note","Recherche par pseudo, puis choisis le membre à examiner."));

  const p=ui.member;
  if(!p) return sec;

  const card=el("div","panel mod-card");
  const title=el("div","mod-card-head"); title.append(el("h3",null,"@"+p.username));
  if(p.is_admin) title.append(el("span","badge","Développeur")); else if(p.is_controller) title.append(el("span","badge controller","Contrôle"));
  card.append(title);
  card.append(el("p","note","Compte créé le "+sameDay(p.created_at)+"."));

  const [mem,to]=await Promise.all([
    A.sb.from("memberships").select("group_id,role,status,joined_at").eq("user_id",p.id).order("joined_at"),
    schema&&schema.table===false
      ? Promise.resolve({data:[],error:null})
      : A.sb.from("moderation_timeouts").select("id,user_id,reason,starts_at,ends_at,created_by,lifted_at,lift_reason,creator:profiles!moderation_timeouts_created_by_fkey(username),lifter:profiles!moderation_timeouts_lifted_by_fkey(username)").eq("user_id",p.id).order("starts_at",{ascending:false}).limit(30),
  ]);

  card.append(el("h4","g-sub","Groupes et statut"));
  if(mem.error) card.append(errLine(mem.error));
  const rows=mem.data||[];
  if(!rows.length&&!mem.error) card.append(el("p","note","Aucun groupe."));
  const gl=el("div","list tight");
  rows.forEach(m=>{
    const r=el("div","mrow");
    const left=el("div"); left.append(el("b",null,gname(gmap,m.group_id)));
    left.append(el("div","post-date",(m.role==="owner"?"Responsable":m.role==="moderator"?"Modérateur":"Membre")+" · "+(m.status==="active"?"actif":m.status==="pending"?"en attente":"inactif")));
    r.append(left);
    if(m.status==="pending") r.append(el("span","badge wait","En attente"));
    gl.append(r);
  });
  card.append(gl);

  card.append(el("h4","g-sub","Sanctions"));
  if(schema&&schema.table===false){
    card.append(el("p","note warn","Aucun timeout ne peut être appliqué : la table des sanctions n'existe pas dans la base. Applique migrations/0006_timeouts.sql puis migrations/0007_timeout_update_guards.sql."));
  }else if(to.error){
    card.append(errLine(to.error));
    card.append(el("p","note warn","Impossible de lire les sanctions. Vérifie l'état de la migration indiqué en haut de la page."));
  }else{
    const list=to.data||[];
    const active=list.find(t=>!t.lifted_at&&new Date(t.ends_at).getTime()>Date.now());
    if(!list.length) card.append(el("p","note","Aucune sanction enregistrée."));
    if(active){
      const c=sanctionCard(active,true);
      const canLift=A.me.is_admin||(!p.is_admin&&!p.is_controller);
      if(canLift){
        const act=el("div","actions");
        act.append(confirmBtn("Lever le timeout","Confirmer la levée",async()=>{
          const {error}=await A.sb.rpc("lift_timeout",{p_id:active.id});
          if(error){
            if(error.code==="42883"||error.code==="PGRST202") await A.checkTimeoutSchema?.(true);
            return toast(frError(error));
          }
          toast("Timeout levé"); render({keepScroll:true,y:window.scrollY});
        },"btn small"));
        c.append(act);
      }
      card.append(c);
    }
    const past=list.filter(t=>t.id!==active?.id);
    if(past.length){
      card.append(el("h4","g-sub","Historique des sanctions ("+past.length+")"));
      past.forEach(t=>card.append(sanctionCard(t,false)));
    }
  }

  const canTimeout=p.id!==A.me.id&&(A.me.is_admin||(!p.is_admin&&!p.is_controller));
  const ready=schema?!!schema.ready:true;
  if(!canTimeout){
    card.append(el("p","note",p.id===A.me.id?"Tu ne peux pas te suspendre toi-même.":"Seul le développeur peut suspendre un membre du staff."));
  }else if(!ready){
    card.append(el("h4","g-sub","Appliquer un timeout"));
    card.append(el("p","note warn","Formulaire désactivé : la base n'applique pas encore complètement les sanctions. Applique les migrations indiquées en haut de la page, puis clique sur « Vérifier à nouveau »."));
  }else{
    card.append(el("h4","g-sub","Appliquer un timeout"));
    const f=el("form","mod-form");
    const dur=el("label","field","Durée");
    const sel=el("select"); TIMEOUTS.forEach(([v,l])=>sel.append(new Option(l,v))); dur.append(sel);
    const why=el("label","field","Motif (obligatoire)");
    const reason=el("input"); reason.required=true; reason.minLength=3; reason.maxLength=300; reason.placeholder="Ex. : insultes répétées dans le chat"; why.append(reason);
    const err=el("p","err"); err.hidden=true;
    const ok=el("button","btn primary","Appliquer le timeout"); ok.type="submit";
    f.append(dur,why,err,ok);
    f.addEventListener("submit",async e=>{
      e.preventDefault(); showErr(err); ok.disabled=true;
      const {error}=await A.sb.rpc("apply_timeout",{p_user:p.id,p_minutes:Number(sel.value),p_reason:reason.value.trim()});
      if(error){
        showErr(err,frError(error)); ok.disabled=false;
        if(error.code==="42883"||error.code==="PGRST202") await A.checkTimeoutSchema?.(true);
        return;
      }
      toast("Timeout appliqué à @"+p.username); render({keepScroll:true,y:window.scrollY});
    });
    card.append(f);
  }
  detail.append(card);
  return sec;
}

/* ---------- 3. Groupes et publications ---------- */
async function renderGroups(groups){
  const sec=section("Groupes et publications");
  const l=el("label","field","Rechercher un groupe");
  const inp=el("input"); inp.type="search"; inp.placeholder="Nom du groupe"; inp.autocomplete="off"; inp.value=ui.groupQuery;
  l.append(inp); sec.append(l);
  const results=el("div","list tight"); sec.append(results);
  const draw=q=>{
    const needle=(q||"").trim().toLowerCase();
    results.innerHTML="";
    const rows=groups.filter(g=>!needle||g.name.toLowerCase().includes(needle)).slice(0,40);
    if(!rows.length){ results.append(el("p","note","Aucun groupe trouvé.")); return; }
    rows.forEach(g=>{
      const b=el("button","mrow mod-row"+(ui.group===g.id?" on":"")); b.type="button";
      const left=el("div"); left.append(el("b",null,g.name)); if(g.region) left.append(el("div","post-date",g.region));
      b.append(left, el("span","todo-go","Choisir"));
      b.addEventListener("click",()=>{ ui.group=g.id; ui.groupQuery=g.name; render({keepScroll:true,y:window.scrollY}); });
      results.append(b);
    });
  };
  inp.addEventListener("input",()=>{ ui.groupQuery=inp.value; draw(inp.value); });
  draw(ui.groupQuery);

  const g=groups.find(x=>x.id===ui.group);
  if(!g) return sec;

  const card=el("div","panel mod-card");
  const title=el("div","mod-card-head"); title.append(el("h3",null,g.name)); if(g.region) title.append(el("span","badge wait",g.region));
  card.append(title);
  const {data:mg,error:mge}=await A.sb.rpc("manage_groups");
  if(mge) card.append(errLine(mge));
  const info=(mg||[]).find(x=>x.id===g.id);
  if(info){
    const stats=el("div","mod-stats");
    const stat=(n,t)=>{ const d=el("div","mod-stat"); d.append(el("b",null,String(n)),el("span",null,t)); return d; };
    stats.append(stat(info.members,"membres"),stat(info.pending_members,"demandes"),stat(info.posts,"publications"),stat(info.pending_posts,"à valider"),stat(info.spots,"spots"));
    card.append(stats);
    card.append(el("p","note",(info.require_approval?"Adhésions validées":"Adhésion libre")+" · "+(info.post_approval?"publications validées":"publications directes")+" · créé le "+sameDay(info.created_at)));
  }

  // Suppression d'un groupe : réservée aux rôles qui peuvent le gérer
  // (développeur ou responsable du groupe), comme la fonction serveur.
  if(A.canManage(g.id)){
    const del=el("details","pf-more");
    del.append(el("summary",null,"Supprimer ce groupe"));
    del.append(el("p","note warn","Suppression définitive de « "+g.name+" » et de toutes ses données. Tape le nom exact pour confirmer."));
    const l=el("label","field","Nom du groupe");
    const inp=el("input"); inp.type="text"; inp.autocomplete="off"; inp.placeholder=g.name; l.append(inp);
    const err=el("p","err"); err.hidden=true;
    const b=btn("Supprimer le groupe","btn danger",async()=>{
      showErr(err);
      if(inp.value!==g.name) return showErr(err,"Le nom ne correspond pas.");
      b.disabled=true;
      const {error}=await A.sb.rpc("delete_group",{p_group:g.id,p_confirmation:g.name});
      b.disabled=false;
      if(error) return showErr(err,frError(error));
      toast("Groupe supprimé");
      ui.group=null; ui.groupQuery="";
      await A.loadGroups?.();
      render({keepScroll:true,y:window.scrollY});
    });
    del.append(l,err,b);
    card.append(del);
  }
  sec.append(card);

  const bar=el("div","mod-filters");
  const fl=el("label","field","Statut");
  const sel=el("select"); [["all","Toutes"],["published","Publiées"],["pending","En attente"]].forEach(([v,t])=>sel.append(new Option(t,v))); sel.value=ui.postStatus; fl.append(sel); bar.append(fl);
  const ql=el("label","field","Rechercher dans les publications");
  const qin=el("input"); qin.type="search"; qin.placeholder="Espèce, légende…"; qin.value=ui.postQuery; ql.append(qin); bar.append(ql);
  sec.append(bar);

  const stats=el("p","note");
  const list=el("div","list tight"); sec.append(stats,list);
  const loadPosts=async()=>{
    stats.textContent="Chargement…"; list.innerHTML="";
    let q=A.sb.from("posts").select("id,user_id,species,length_cm,weight_kg,caption,bait,photo_path,photo_paths,status,created_at,profiles!posts_user_id_fkey(username,is_admin,is_controller)").eq("group_id",g.id).order("created_at",{ascending:false}).limit(60);
    if(ui.postStatus!=="all") q=q.eq("status",ui.postStatus);
    const text=(ui.postQuery||"").trim().replace(/[%,()]/g," ");
    if(text) q=q.or("caption.ilike.%"+text+"%,species.ilike.%"+text+"%");
    const {data,error}=await q;
    if(error){ stats.hidden=true; list.append(errLine(error)); return; }
    const rows=data||[];
    stats.hidden=false; stats.textContent=rows.length+" publication"+(rows.length>1?"s":"")+" affichée"+(rows.length>1?"s":"")+".";
    let urls={};
    try{
      urls=await signedMap(rows.flatMap(p=>(p.photo_paths&&p.photo_paths.length)?[p.photo_paths[0]]:(p.photo_path?[p.photo_path]:[])));
    }catch(e){ list.append(errLine(e)); }
    if(!rows.length){ list.append(el("p","empty small","Aucune publication pour ce filtre.")); return; }
    rows.forEach(p=>{
      const c=el("div","modo-item");
      const top=el("div"); top.append(nameWithBadge(p.profiles)); top.append(" · "+ago(p.created_at));
      top.append(el("span","badge "+(p.status==="pending"?"wait":"owner"),p.status==="pending"?"En attente":p.status==="published"?"Publiée":(p.status||"?")));
      c.append(top);
      const ph=(p.photo_paths&&p.photo_paths.length)?p.photo_paths[0]:p.photo_path;
      if(ph&&urls[ph]){ const im=el("img","modo-img"); im.src=urls[ph]; im.alt="Photo de la prise"; im.loading="lazy"; c.append(im); }
      c.append(el("div",null,[p.species,p.length_cm?String(p.length_cm).replace(".",",")+" cm":null,p.weight_kg?String(p.weight_kg).replace(".",",")+" kg":null].filter(Boolean).join(" · ")||"Sans espèce"));
      if(p.caption||p.bait) c.append(el("p","modo-ex",[p.bait,p.caption].filter(Boolean).join(" — ")));
      const act=el("div","actions");
      if(p.status==="pending"){
        act.append(btn("Valider","btn primary small",async()=>{
          const {data:cur,error:ce}=await A.sb.from("posts").select("status").eq("id",p.id).maybeSingle();
          if(ce) return toast(frError(ce));
          if(!cur||cur.status!=="pending") return stale(loadPosts,"Publication déjà traitée par un autre modérateur — liste actualisée");
          const {error}=await A.sb.rpc("approve_post",{p_id:p.id}); if(error) return toast(frError(error));
          toast("Publication validée"); await loadPosts(); updateBadge(); A.loadFeed?.();
        }));
      }
      act.append(confirmBtn("Supprimer","Confirmer la suppression",async()=>{
        const {data:row,error:de}=await A.sb.from("posts").select("status,photo_path,photo_paths").eq("id",p.id).maybeSingle();
        if(de) return toast(frError(de));
        if(!row) return stale(loadPosts,"Publication déjà supprimée — liste actualisée");
        const all=(row.photo_paths&&row.photo_paths.length)?row.photo_paths:(row.photo_path?[row.photo_path]:[]);
        const {data:del,error}=await A.sb.from("posts").delete().eq("id",p.id).select("id");
        if(error) return toast(frError(error));
        if(!del||!del.length) return stale(loadPosts,"Publication déjà supprimée — liste actualisée");
        if(all.length) await A.sb.storage.from("photos").remove(all);
        toast("Publication supprimée"); await loadPosts(); updateBadge(); A.loadFeed?.();
      },"btn small danger-btn"));
      c.append(act); list.append(c);
    });
  };
  sel.addEventListener("change",()=>{ ui.postStatus=sel.value; loadPosts(); });
  let t=null;
  qin.addEventListener("input",()=>{ ui.postQuery=qin.value; clearTimeout(t); t=setTimeout(loadPosts,300); });
  await loadPosts();
  return sec;
}

/* ---------- 4. Contrôleurs de l'appli (développeur) ---------- */
async function renderControllers(){
  const sec=section("Contrôleurs de l'application");
  const {data,error}=await A.sb.rpc("list_controllers");
  const names=(data||[]).map(x=>x.username);
  window.CDJ_CTRL=new Set(names);
  if(error) sec.append(errLine(error));
  sec.append(el("p","note","Un contrôleur modère tous les groupes : il voit tout, valide ou supprime les publications, les commentaires et les messages, et peut appliquer un timeout. Il ne peut pas changer les rôles ni les réglages des groupes."));
  const list=el("div","list tight");
  if(!names.length) list.append(el("p","note","Aucun contrôleur pour l'instant."));
  names.forEach(n=>{
    const r=el("div","mrow"); r.append(nameWithBadge({username:n}));
    const b=el("button","linkbtn danger","Retirer"); b.type="button";
    b.addEventListener("click",async()=>{
      const {error}=await A.sb.rpc("set_controller",{p_username:n,p_on:false});
      if(error) return toast(frError(error));
      toast("@"+n+" n'est plus contrôleur"); render({keepScroll:true,y:window.scrollY});
    });
    r.append(b); list.append(r);
  });
  sec.append(list);

  const f=el("form","mod-form");
  const l=el("label","field","Nommer un contrôleur"); l.style.flex="1"; l.style.minWidth="160px";
  const i=el("input"); i.required=true; i.placeholder="Pseudo du membre"; i.autocomplete="off"; l.append(i);
  const err=el("p","err"); err.hidden=true;
  const ok=el("button","btn primary","Nommer"); ok.type="submit";
  f.append(l,err,ok);
  f.addEventListener("submit",async e=>{
    e.preventDefault(); showErr(err);
    const n=i.value.trim().replace(/^@/,""); if(!n) return;
    const {error}=await A.sb.rpc("set_controller",{p_username:n,p_on:true});
    if(error){ showErr(err,/introuvable/.test(error.message)?"Pseudo introuvable.":frError(error)); return; }
    toast("@"+n+" est maintenant contrôleur"); render({keepScroll:true,y:window.scrollY});
  });
  sec.append(f);
  return sec;
}

/* ---------- Rendu d'ensemble ---------- */
async function render(opts){
  opts=opts||{};
  const root=$("#moderation-content"); if(!root) return;
  if(!A.me||!isStaff()){ root.innerHTML=""; return; }
  const nav=window.CDJ_WANT_MOD||null;
  if(nav){
    if(nav.group&&(nav.section==="groups"||nav.section==="group")) ui.group=Number(nav.group);
    if(nav.section==="groups"||nav.section==="group") ui.groupQuery="";
    window.CDJ_WANT_MOD=null;
  }
  const mySeq=++seq;
  const y=window.scrollY;
  root.innerHTML="";
  root.append(el("p","note","Chargement de la modération…"));
  let groups;
  try{ groups=await fetchGroups(); }
  catch(e){ if(mySeq!==seq) return; root.innerHTML=""; root.append(errLine(e)); return; }
  if(mySeq!==seq) return;
  const gmap=new Map(groups.map(g=>[g.id,g]));
  root.innerHTML="";

  const head=el("div","modo-head");
  head.append(el("h1",null,"Modération"));
  head.append(el("p","note",A.me.is_admin?"Vue développeur : tous les groupes et les compteurs de l'appli.":"Vue contrôleur : tous les groupes de l'appli."));
  root.append(head);

  // État réel des garde-fous serveur : visible avant toute sanction.
  let schema=null;
  try{ schema=await A.checkTimeoutSchema?.(); }
  catch(e){ schema={table:false,version:null,ready:false,checked:true}; }
  if(mySeq!==seq) return;
  root.append(schemaBanner(schema,async()=>{
    try{ await A.checkTimeoutSchema?.(true); }catch(e){}
    render({keepScroll:true,y:window.scrollY});
  }));

  try{
    const todo=await renderTodo(gmap,nav?.section==="todo"?(Number(nav.group)||null):null); if(mySeq!==seq) return; todo.id="mod-todo"; root.append(todo);
    const appeals=await renderAppeals(); if(mySeq!==seq) return; appeals.id="mod-appeals"; root.append(appeals);
    const members=await renderMembers(gmap,schema); if(mySeq!==seq) return; members.id="mod-members"; root.append(members);
    const gs=await renderGroups(groups); if(mySeq!==seq) return; gs.id="mod-groups"; root.append(gs);
    if(A.me.is_admin){ const cs=await renderControllers(); if(mySeq!==seq) return; cs.id="mod-controllers"; root.append(cs); }
  }catch(e){
    if(mySeq!==seq) return;
    root.append(errLine(e));
    return;
  }

  if(nav){
    const target=nav.section==="groups"||nav.section==="group"?"#mod-groups":nav.section==="members"||nav.section==="member"?"#mod-members":nav.section==="controllers"?"#mod-controllers":nav.section==="appeals"?"#mod-appeals":"#mod-todo";
    setTimeout(()=>{ const n=root.querySelector(target); if(n) n.scrollIntoView({behavior:"smooth",block:"start"}); },80);
  }else if(opts.keepScroll){
    window.scrollTo(0,opts.y!=null?opts.y:y);
  }
  updateBadge();
}

/* ---------- Compteur et bandeau de sanction ---------- */
async function updateBadge(){
  if(!A.me||!A.sb||!isStaff()){ window.CDJ_MOD_COUNT=0; window.CDJ_SYNC_BADGE?.(); return; }
  const [r,p,q,ap]=await Promise.all([
    A.sb.from("reports").select("id").eq("status","open").limit(300),
    A.sb.from("memberships").select("user_id").eq("status","pending").limit(300),
    A.sb.from("posts").select("id").eq("status","pending").limit(300),
    A.sb.from("sanction_appeals").select("id").eq("status","open").limit(300),
  ]);
  const n=(r.data||[]).length+(p.data||[]).filter(x=>x.user_id!==A.me.id).length+(q.data||[]).length+(ap.data||[]).length;
  window.CDJ_MOD_COUNT=n; window.CDJ_SYNC_BADGE?.();
}

function ensureTimeoutBanner(){
  let b=document.getElementById("timeout-banner");
  if(!A.me||!A.isTimedOut?.()||!A.myTimeout){ if(b) b.remove(); return; }
  const t=A.myTimeout;
  if(!b){
    b=el("div","timeout-banner"); b.id="timeout-banner"; b.setAttribute("role","status");
    const head=document.querySelector(".app-head");
    if(head) head.after(b); else document.body.prepend(b);
    b.append(el("b",null,"⏳ Compte suspendu"),el("span","timeout-when"),el("span","timeout-why"));
  }
  b.querySelector(".timeout-when").textContent="jusqu'au "+new Date(t.ends_at).toLocaleString("fr-FR",{day:"numeric",month:"long",hour:"2-digit",minute:"2-digit"})+" ("+remaining(t.ends_at)+" restantes).";
  b.querySelector(".timeout-why").textContent=t.reason?"Motif : "+t.reason:"";
  if(!b.querySelector(".timeout-appeal")){
    b.append(btn("Demander un réexamen","linkbtn timeout-appeal",()=>{
      if(location.hash.startsWith("#profil")){
        A.openProfilSub?.("moi");
        setTimeout(()=>document.getElementById("sanction-panel")?.scrollIntoView({behavior:"smooth",block:"start"}),300);
      }else{
        location.hash="#profil";
        setTimeout(()=>{ A.openProfilSub?.("moi"); setTimeout(()=>document.getElementById("sanction-panel")?.scrollIntoView({behavior:"smooth",block:"start"}),300); },200);
      }
    }));
  }
}

/* ---------- Branchements ---------- */
const prevProfilSub=A.hooks.profilSub;
A.hooks.profilSub=v=>{
  prevProfilSub?.(v);
  if(v==="moderation"){ render(); }
  if(v==="moi"){ renderSanctionPanel(); }
};
// On enveloppe le hook Profil au lieu de le remplacer : d'autres modules
// (profil, carnet, outils…) y branchent leur propre rendu.
const prevProfil=A.hooks.profil;
A.hooks.profil=()=>{ prevProfil?.(); renderSanctionPanel(); if(activeSub()) render(); };
A.hooks.modo=()=>{ if(activeSub()) queueRender({keepScroll:true}); };
const prevChange=A.hooks.change;
A.hooks.change=()=>{
  prevChange?.(); ensureTimeoutBanner(); if(activeSub()) queueRender({keepScroll:true}); updateBadge();
  const panel=$("#sanction-panel");
  if(!A.me){ if(panel){ panel.hidden=true; panel.innerHTML=""; } }
  else if(panel?.hidden&&!$("#v-profil").hidden&&$("#v-profil").dataset.s==="moi") renderSanctionPanel();
};

function boot(){
  ensureTimeoutBanner();
  updateBadge();
  renderSanctionPanel();
  if(A.me&&activeSub()) render();
  if(window.CDJ_WANT_MOD) setTimeout(()=>A.openProfilSub?.("moderation"),0);
}
boot();
// Rafraîchit la sanction active (apparition, expiration) et le compteur.
let ticks=0;
setInterval(async()=>{
  if(document.visibilityState!=="visible"||!A.me) return;
  await A.loadTimeout?.();
  ensureTimeoutBanner();
  if(!$("#v-profil").hidden&&$("#v-profil").dataset.s==="moi"&&String(A.myTimeout?.id||"")!==String(appealPanelTimeout||"")) renderSanctionPanel();
  if(++ticks%2===0) updateBadge();
},30000);
})();
