// Rivio : onglet Modération (signalements, adhésions, publications à valider, gestion du groupe) et bouton « Signaler ».
(function(){
"use strict";
const A=window.CDJ; if(!A) return;
const {el,toast,frError,confirmBtn,userLabel,ago}=A;
const $=s=>document.querySelector(s);
function btn(label,cls,fn){ const b=el("button",cls||"btn",label); b.type="button"; if(fn) b.addEventListener("click",fn); return b; }
function section(title,count){
  const s=el("section","g-sec"); const h=el("div","g-sec-head"); h.append(el("h2",null,title));
  if(count!=null) h.append(el("span","modo-count"+(count?"":" zero"),String(count)));
  s.append(h); return s;
}
const KIND={post:"Prise",comment:"Commentaire",message:"Message du chat"};
const TABLE={post:"posts",comment:"comments",message:"messages"};

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

/* ---------- Onglet Modération ---------- */
let seq=0;
async function render(){
  const root=$("#modo-root"); if(!root||!A.me) return;
  const s=++seq;
  const [{data:reps},{data:pend},{data:posts}]=await Promise.all([
    A.sb.from("reports").select("id,group_id,user_id,kind,target_id,excerpt,author_id,reason,created_at").eq("status","open").order("created_at",{ascending:false}).limit(100),
    A.sb.from("memberships").select("group_id,user_id,joined_at,profiles(username,is_admin)").eq("status","pending").limit(200),
    A.sb.from("posts").select("id,group_id,user_id,species,length_cm,weight_kg,caption,bait,photo_path,photo_paths,created_at,profiles(username,is_admin)").eq("status","pending").order("created_at").limit(100),
  ]);
  if(s!==seq) return;
  const mine=gid=>A.canModerate(gid);
  const R=(reps||[]).filter(r=>mine(r.group_id)), P=(pend||[]).filter(m=>mine(m.group_id)&&m.user_id!==A.me.id), Q=(posts||[]).filter(p=>mine(p.group_id));
  // pseudos des personnes citées dans les signalements
  const ids=[...new Set(R.flatMap(r=>[r.user_id,r.author_id]).filter(Boolean))];
  const names=new Map();
  if(ids.length){ const {data}=await A.sb.from("profiles").select("id,username,is_admin").in("id",ids); (data||[]).forEach(p=>names.set(p.id,p)); }
  const paths=Q.flatMap(p=>(p.photo_paths&&p.photo_paths.length)?[p.photo_paths[0]]:(p.photo_path?[p.photo_path]:[]));
  const urls={};
  if(paths.length){ const {data}=await A.sb.storage.from("photos").createSignedUrls(paths,3600); (data||[]).forEach(x=>{ if(x.signedUrl) urls[x.path]=x.signedUrl; }); }
  if(s!==seq) return;
  root.innerHTML="";
  const head=el("div","modo-head"); head.append(el("h1",null,"Modération"));
  head.append(el("p","note",A.me.is_admin?"Vue admin : tous les groupes.":A.me.is_controller?"Contrôleur : tous les groupes de l'appli.":"Les groupes où tu es responsable ou modérateur."));
  root.append(head);
  const gname=gid=>A.groupName(gid);

  // signalements
  const sr=section("⚑ Signalements",R.length);
  if(!R.length) sr.append(el("p","empty small","Aucun signalement en attente."));
  R.forEach(r=>{
    const c=el("div","modo-item");
    c.append(el("div","modo-meta",KIND[r.kind]+" · "+gname(r.group_id)+" · "+ago(r.created_at)));
    const who=el("div"); who.append("Signalé par "); who.append(userLabel(names.get(r.user_id)?.username,names.get(r.user_id)?.is_admin));
    if(r.author_id){ who.append(" · auteur "); who.append(userLabel(names.get(r.author_id)?.username,names.get(r.author_id)?.is_admin)); }
    c.append(who, el("b",null,r.reason));
    if(r.excerpt) c.append(el("p","modo-ex",r.excerpt));
    const act=el("div","actions");
    const done=async st=>{ const {error}=await A.sb.from("reports").update({status:st,handled_by:A.me.id}).eq("id",r.id); if(error) return toast(frError(error)); render(); badge(); };
    act.append(btn("Classer sans suite","btn small",()=>done("dismissed")));
    act.append(confirmBtn("Supprimer le contenu","Confirmer la suppression",async()=>{
      const {error}=await A.sb.from(TABLE[r.kind]).delete().eq("id",r.target_id);
      if(error) return toast(frError(error));
      await done("done"); toast("Contenu supprimé"); A.loadFeed();
    },"btn small danger-btn"));
    c.append(act); sr.append(c);
  });
  root.append(sr);

  // adhésions
  const sp=section("🙋 Demandes d'adhésion",P.length);
  if(!P.length) sp.append(el("p","empty small","Aucune demande en attente."));
  P.forEach(m=>{
    const c=el("div","modo-item");
    const t=el("div"); t.append(userLabel(m.profiles?.username,m.profiles?.is_admin)); t.append(" veut rejoindre « "+gname(m.group_id)+" »");
    c.append(t);
    const act=el("div","actions");
    act.append(confirmBtn("Refuser","Confirmer",async()=>{ const {error}=await A.sb.from("memberships").delete().eq("group_id",m.group_id).eq("user_id",m.user_id); if(error) return toast(frError(error)); toast("Demande refusée"); render(); badge(); },"btn small"));
    act.append(btn("Accepter","btn primary small",async()=>{ const {error}=await A.sb.rpc("approve_member",{p_group:m.group_id,p_user:m.user_id}); if(error) return toast(frError(error)); toast("@"+(m.profiles?.username||"?")+" a rejoint le groupe"); render(); badge(); A.loadGroups?.(); }));
    c.append(act); sp.append(c);
  });
  root.append(sp);

  // publications
  const sq=section("🕓 Publications à valider",Q.length);
  if(!Q.length) sq.append(el("p","empty small","Rien à valider."));
  Q.forEach(p=>{
    const c=el("div","modo-item");
    const top=el("div"); top.append(userLabel(p.profiles?.username,p.profiles?.is_admin)); top.append(" · "+gname(p.group_id)+" · "+ago(p.created_at));
    c.append(top);
    const ph=(p.photo_paths&&p.photo_paths.length)?p.photo_paths[0]:p.photo_path;
    if(ph&&urls[ph]){ const im=el("img","modo-img"); im.src=urls[ph]; im.alt="Photo de la prise"; im.loading="lazy"; c.append(im); }
    c.append(el("div",null,[p.species,p.length_cm?String(p.length_cm).replace(".",",")+" cm":null,p.weight_kg?String(p.weight_kg).replace(".",",")+" kg":null].filter(Boolean).join(" · ")||"Sans espèce"));
    if(p.caption||p.bait) c.append(el("p","modo-ex",[p.bait,p.caption].filter(Boolean).join(" — ")));
    const act=el("div","actions");
    act.append(confirmBtn("Refuser","Confirmer",async()=>{
      const all=(p.photo_paths&&p.photo_paths.length)?p.photo_paths:(p.photo_path?[p.photo_path]:[]);
      const {error}=await A.sb.from("posts").delete().eq("id",p.id); if(error) return toast(frError(error));
      if(all.length) await A.sb.storage.from("photos").remove(all);
      toast("Publication refusée"); render(); badge(); A.loadFeed();
    },"btn small"));
    act.append(btn("Valider","btn primary small",async()=>{ const {error}=await A.sb.rpc("approve_post",{p_id:p.id}); if(error) return toast(frError(error)); toast("Publication validée"); render(); badge(); A.loadFeed(); }));
    c.append(act); sq.append(c);
  });
  root.append(sq);

  // gestion du groupe courant
  const g=A.curGroup;
  const sg=section("⚙️ Gestion du groupe");
  if(A.cur==="all"||!g) sg.append(el("p","note","Choisis un groupe précis en haut de l'écran pour gérer ses membres, leurs rôles et ses réglages."));
  else if(!A.canModerate(g.id)) sg.append(el("p","note","Tu n'es pas modérateur de « "+g.name+" »."));
  else{
    const [{data:mg},{data:mem}]=await Promise.all([A.sb.rpc("manage_groups"),A.sb.rpc("manage_members",{p_group:g.id})]);
    if(s!==seq) return;
    const info=(mg||[]).find(x=>x.id===g.id);
    const m=A.groupeAPI?.renderManage(g,info,mem||[],A.canManage(g.id));
    if(m){ const h2=m.querySelector(".g-sec-head h2"); if(h2) h2.textContent=g.name; sg.append(m); }
  }
  root.append(sg);
}
async function badge(){
  const b=$("#modo-badge"); if(!b) return;
  if(!A.me||!A.isManager?.()){ b.hidden=true; return; }
  const [r,p,q]=await Promise.all([
    A.sb.from("reports").select("id,group_id").eq("status","open").limit(200),
    A.sb.from("memberships").select("group_id,user_id").eq("status","pending").limit(200),
    A.sb.from("posts").select("id,group_id").eq("status","pending").limit(200),
  ]);
  const n=(r.data||[]).filter(x=>A.canModerate(x.group_id)).length+(p.data||[]).filter(x=>A.canModerate(x.group_id)&&x.user_id!==A.me.id).length+(q.data||[]).filter(x=>A.canModerate(x.group_id)).length;
  b.hidden=!n; b.textContent=n>99?"99+":String(n);
}
A.hooks.modo=()=>{ if(!$("#v-modo").hidden) render(); badge(); };
const prevChange=A.hooks.change;
A.hooks.change=()=>{ prevChange?.(); badge(); if(!$("#v-modo").hidden) render(); };
setInterval(()=>{ if(document.visibilityState==="visible") badge(); },60000);
badge();
if(A.me&&!$("#v-modo").hidden) render();
})();
