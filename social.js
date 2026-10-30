/* Rivio : navigation, comptes, groupes, fil photo, carte des spots, administration */
(function(){
const $=s=>document.querySelector(s);
const $$=s=>Array.from(document.querySelectorAll(s));
const C=window.CDJ_CONFIG||{};
const configured=typeof C.SUPABASE_URL==="string"&&C.SUPABASE_URL.startsWith("https://")&&C.SUPABASE_KEY&&!/COLLE/.test(C.SUPABASE_KEY);
const DOMAIN=C.EMAIL_DOMAIN||"coupdujour.app";
let sb=null, me=null, hasSession=false;
let groups=[], cur=null;            // cur : id de groupe ou "all" (admin)
let pendingGroups=[];               // groupes où ma demande attend une validation
let roles=new Map();                // id de groupe -> Map(utilisateur -> "owner" | "moderator")
let myRoles=new Map();              // id de groupe -> mon rôle actif
let postMode="none";
let spots=[], map=null, layer=null, pending=null;
const markers={};

// ---------- Utilitaires ----------
function el(tag,cls,text){ const e=document.createElement(tag); if(cls) e.className=cls; if(text!=null) e.textContent=text; return e; }
function toast(t,ms){ const d=el("div","toast",t); document.body.append(d); setTimeout(()=>d.remove(),ms||2800); }
function showErr(e,t){ e.textContent=t||""; e.hidden=!t; }
function ago(iso){
  const d=new Date(iso), s=(Date.now()-d)/1000;
  if(s<60) return "à l'instant";
  if(s<3600) return "il y a "+Math.floor(s/60)+" min";
  if(s<86400) return "il y a "+Math.floor(s/3600)+" h";
  return d.toLocaleDateString("fr-FR",{day:"numeric",month:"short",year:d.getFullYear()!==new Date().getFullYear()?"numeric":undefined});
}
const emailOf=u=>u.trim().toLowerCase()+"@"+DOMAIN;
function frError(e){
  const m=(e&&e.message)||String(e);
  if(/pseudo legacy/i.test(m)) return "Pseudo ou mot de passe incorrect. Si tu as ajouté un e-mail à ton compte, connecte-toi avec ton e-mail.";
  if(/Invalid login/i.test(m)) return "E-mail ou mot de passe incorrect.";
  if(/pseudo pris/i.test(m)) return "Ce pseudo est déjà pris, choisis-en un autre.";
  if(/email invalide|invalid format|validate email/i.test(m)) return "Cette adresse e-mail n'est pas valide.";
  if(/already registered|already exists/i.test(m)) return "Un compte existe déjà avec cet e-mail : connecte-toi, ou utilise « Mot de passe oublié ».";
  if(/not authorized|Email address not authorized/i.test(m)) return "L'envoi d'e-mails n'est pas encore activé sur le serveur. Réessaie plus tard ou préviens l'admin.";
  if(/deadline|timeout|504|sending.*email|smtp/i.test(m)) return "Le serveur d'e-mails ne répond pas pour l'instant. Réessaie dans quelques minutes.";
  if(/rate limit|too many|security purposes/i.test(m)) return "Trop de demandes d'un coup : attends quelques minutes avant de réessayer.";
  if(/same password|should be different/i.test(m)) return "Le nouveau mot de passe doit être différent de l'ancien.";
  if(/weak|Password should contain/i.test(m)) return "Mot de passe trop faible : mélange lettres et chiffres, 8 caractères minimum.";
  if(/code invalide/i.test(m)) return "Code du groupe incorrect.";
  if(/groupe complet/i.test(m)) return "Ce groupe est complet (20 membres maximum).";
  if(/duplicate key.*(profiles|username)/i.test(m)) return "Ce nom d'utilisateur est déjà pris.";
  if(/duplicate key.*invite_code/i.test(m)) return "Ce code est déjà utilisé par un autre groupe.";
  if(/Password should/i.test(m)) return "Mot de passe trop court (8 caractères minimum).";
  if(/Email not confirmed/i.test(m)) return "Confirme d'abord ton e-mail : ouvre le lien reçu par mail (pense aux spams).";
  if(/row-level security/i.test(m)) return "Action non autorisée dans ce groupe.";
  if(/limite de groupes/i.test(m)) return "Tu es déjà responsable de 3 groupes, c'est le maximum.";
  if(/seul l'admin peut changer le responsable/i.test(m)) return "Seul l'admin peut changer le responsable du groupe.";
  if(/seuls les modérateurs peuvent épingler/i.test(m)) return "Seuls les modérateurs peuvent épingler un mémo.";
  if(/non autoris/i.test(m)) return "Tu n'as pas les droits pour faire ça dans ce groupe.";
  if(/Email signups are disabled/i.test(m)) return "Les inscriptions sont désactivées dans Supabase (fournisseur Email).";
  if(/Failed to fetch|NetworkError/i.test(m)) return "Pas de connexion réseau.";
  return m;
}
// bouton à double appui pour confirmer (pas de boîte de dialogue)
function confirmBtn(label,confirmLabel,action,cls="linkbtn danger"){
  const b=el("button",cls,label); b.type="button";
  b.addEventListener("click",async()=>{
    if(b.dataset.c!=="1"){ b.dataset.c="1"; b.textContent=confirmLabel; setTimeout(()=>{ if(b.isConnected){ b.dataset.c=""; b.textContent=label; } },4000); return; }
    b.disabled=true; try{ await action(); }finally{ b.disabled=false; }
  });
  return b;
}
const ROLE_LABEL={owner:"Resp.",moderator:"Modo"};
function roleBadge(role){ return ROLE_LABEL[role]?el("span","badge "+role,ROLE_LABEL[role]):null; }
function userLabel(name,isAdmin,role){
  const s=el("span","post-user","@"+(name||"?"));
  if(name){ s.dataset.user=name; s.tabIndex=0; s.setAttribute("role","link"); s.title="Voir le profil de @"+name; }
  if(isAdmin) s.append(el("span","badge","Admin"));
  else if(name&&window.CDJ_CTRL?.has(name)) s.append(el("span","badge controller","Contrôle"));
  else if(role===true||role==="owner") s.append(roleBadge("owner"));
  else if(role==="moderator") s.append(roleBadge("moderator"));
  return s;
}
function avatar(name){
  const n=name||"?"; let h=0; for(const c of n) h=(h*31+c.charCodeAt(0))%360;
  const a=el("span","avatar",n.charAt(0)); a.style.background="hsl("+h+" 42% 42%)"; a.setAttribute("aria-hidden","true"); a.dataset.name=n;
  return a;
}
const roleOf=(gid,uid)=>roles.get(gid)?.get(uid);
// vue membre : un admin, contrôleur ou modo voit l'appli comme un simple membre (affichage seulement)
let userView=false; try{ userView=localStorage.getItem("cdj-userview")==="1"; }catch(e){}
let canSwitchView=false;
const isStaff=()=>!!me&&(me.is_admin||me.is_controller);
const canManage=gid=>!!me&&(me.is_admin||myRoles.get(gid)==="owner");
const canModerate=gid=>!!me&&(isStaff()||myRoles.get(gid)==="owner"||myRoles.get(gid)==="moderator");
const isManager=()=>!!me&&(isStaff()||[...myRoles.values()].some(r=>r!=="member"));
const staffBadge=()=>me?.is_admin?el("span","badge","Admin"):me?.is_controller?el("span","badge controller","Contrôle"):null;
const curGroup=()=>groups.find(g=>g.id===cur);
const hooks={};   // points d'accroche pour groupe.js
const groupName=id=>{ const g=groups.find(x=>x.id===id); return g?g.name:"?"; };

// ---------- Navigation ----------
const VIEWS=["conseils","fil","carte","groupe","modo","profil"];
function route(){
  let h=location.hash.slice(1);
  if(h==="admin") h="groupe";
  if(h==="chat"){ h="fil"; setTimeout(()=>hooks.openChat?.(),300); }
  let v=VIEWS.includes(h)?h:"conseils";
  if(v==="modo"&&!(me&&isManager())) v=me?"groupe":"conseils";
  VIEWS.forEach(n=>{ $("#v-"+n).hidden=n!==v; });
  $$("nav.tabs a").forEach(a=>a.setAttribute("aria-current",a.dataset.v===v?"page":"false"));
  if(v==="carte") openMap();
  if(v==="fil") loadFeed();
  if(v==="groupe") hooks.groupe?.();
  if(v==="profil") hooks.profil?.();
  if(v==="modo") hooks.modo?.();
  window.scrollTo(0,0);
}
window.addEventListener("hashchange",route);

// ---------- Affichage selon l'état ----------
function refreshUI(){
  const logged=!!me, member=logged&&(groups.length>0);
  const role=me?(me.is_admin?"admin":"user"):"";
  if(role) document.documentElement.dataset.role=role; else delete document.documentElement.dataset.role;
  const tc=document.querySelector('meta[name="theme-color"]');
  if(tc) tc.content=role==="admin"?"#b8691c":role==="user"?"#2c5f8f":"#1f6f5c";
  $$("[data-setup]").forEach(e=>e.hidden=configured);
  $$("[data-need-login]").forEach(e=>{
    e.hidden=!configured||member;
    e.textContent=!logged?"Connecte-toi dans l'onglet Profil pour voir le contenu de ton groupe."
      :pendingGroups.length?"Ta demande pour rejoindre « "+pendingGroups.map(g=>g.name).join(" », « ")+" » attend la validation d'un modérateur. Tu seras prévenu dès qu'elle sera acceptée."
      :"Tu n'es dans aucun groupe pour l'instant. Rejoins celui d'un pote avec son code, ou crée le tien.";
    if(logged&&!member&&!pendingGroups.length&&!e.closest("#v-profil")){ const b=el("button","btn primary small","👥 Rejoindre ou créer un groupe"); b.type="button"; b.style.marginTop="10px"; b.addEventListener("click",()=>{ location.hash="#profil"; setTimeout(()=>{ document.querySelector('#profil-sub [data-s="reglages"]')?.click(); document.querySelector("#my-groups")?.scrollIntoView({behavior:"smooth",block:"start"}); },250); }); e.append(document.createElement("br"),b); }
  });
  $$("[data-need-member]").forEach(e=>e.hidden=!member);
  const canPost=member&&cur!=="all";
  $("#post-mode").hidden=!canPost;
  $("#composer").hidden=!canPost||postMode!=="post";
  $("#bilan").hidden=!canPost||postMode!=="bilan";
  $("#carp").hidden=!canPost||postMode!=="carp";
  $("#composer-all").hidden=!(member&&cur==="all");
  $("#feed-bar").hidden=!member;
  $("#map-bar").hidden=!member;
  $("#map").hidden=!member;
  $("#auth").hidden=!configured||hasSession;
  $("#join").hidden=!(configured&&hasSession&&!me);
  $("#me").hidden=!logged;
  $("#my-groups").hidden=!logged;
  $("#tab-groupe").hidden=!member;
  $("#tab-modo").hidden=!(member&&isManager());
  $("#create-group").hidden=!logged;
  if(me){ const h=$("#me-name"); h.textContent="@"+me.username; const sb2=staffBadge(); if(sb2) h.append(sb2); }
  if(!member){ $("#feed").innerHTML=""; }
  renderSwitcher();
  renderMyGroups();
  renderPush();
  hooks.change?.();
}

// ---------- Bascule rapide entre groupes (en-tête) ----------
function renderSwitcher(){
  const btn=$("#grp-switch"), name=$("#gs-name");
  btn.hidden=!me||!groups.length;
  name.textContent="";
  if(!me||!groups.length) return;
  if(cur==="all") name.append("Tous les groupes");
  else{ name.append(curGroup()?.name||"Groupe"); const b=staffBadge()||roleBadge(myRoles.get(cur)); if(b) name.append(b); }
}
function openSwitcher(){
  const list=$("#gs-list"); list.innerHTML="";
  const item=(label,sub,val,badge,disabled)=>{
    const b=el("button","gs-item"+(val===cur?" on":"")); b.type="button"; b.disabled=!!disabled;
    const t=el("span","gs-t",label); if(badge) t.append(badge);
    b.append(t); if(sub) b.append(el("span","gs-s",sub));
    if(!disabled) b.addEventListener("click",()=>{ closeSheet(); setGroup(val); });
    list.append(b);
  };
  if(isStaff()) item("Tous les groupes",me.is_admin?"Vue d'ensemble admin":"Vue d'ensemble contrôleur","all");
  groups.forEach(g=>item(g.name,g.region||"",g.id,isStaff()?null:roleBadge(myRoles.get(g.id))));
  pendingGroups.forEach(g=>item(g.name,"Demande en attente de validation",null,null,true));
  $("#gs-sheet").hidden=false;
}
function closeSheet(){ $("#gs-sheet").hidden=true; }
$("#grp-switch").addEventListener("click",openSwitcher);
$("#gs-sheet").addEventListener("click",e=>{ if(e.target.id==="gs-sheet"||e.target.closest("[data-close]")) closeSheet(); });
function setGroup(v){
  cur=v;
  try{ localStorage.setItem("cdj-grp",String(v)); }catch(e){}
  refreshUI(); loadSpots(); loadFeed();
  if(!$("#v-groupe").hidden) hooks.groupe?.();
}
// Bilan rapide ou post photo
$$("#post-mode button").forEach(b=>b.addEventListener("click",()=>{
  postMode=postMode===b.dataset.m?"none":b.dataset.m;
  $$("#post-mode button").forEach(x=>x.setAttribute("aria-pressed",String(x.dataset.m===postMode)));
  try{ localStorage.setItem("cdj-mode",postMode); }catch(e){}
  refreshUI(); hooks.mode?.(postMode);
}));
try{ const m=localStorage.getItem("cdj-mode"); if(m==="post"||m==="bilan"||m==="carp"||m==="none"){ postMode=m; $$("#post-mode button").forEach(x=>x.setAttribute("aria-pressed",String(x.dataset.m===m))); } }catch(e){}

// ---------- Comptes (e-mail + mot de passe) ----------
let authMode="login";
const isMail=v=>/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
const siteUrl=()=>location.origin+location.pathname;
function setAuthMode(m){
  authMode=m;
  $$("#auth-mode button").forEach(x=>x.setAttribute("aria-pressed",String(x.dataset.m===m)));
  const su=m==="signup";
  $("#auth-title").textContent=su?"Créer un compte":"Connexion";
  $("#a-submit").textContent=su?"Créer mon compte":"Se connecter";
  $("#a-email-lab").textContent=su?"E-mail":"E-mail (ou pseudo pour un ancien compte)";
  const em=$("#a-email"); em.type=su?"email":"text"; em.autocomplete=su?"email":"username";
  $("#a-user-wrap").hidden=!su; $("#a-user").required=su;
  $("#a-code-wrap").hidden=!su; $("#a-code").required=false;
  $("#a-legacy").hidden=su; $("#a-forgot").hidden=su; $("#a-terms").hidden=!su;
  const pw=$("#a-pass"); pw.autocomplete=su?"new-password":"current-password"; pw.minLength=su?8:6;
  pw.placeholder=su?"8 caractères minimum":"";
  $("#auth-form").hidden=false; $("#forgot-form").hidden=true;
  showErr($("#a-err")); $("#a-ok").hidden=true;
}
$$("#auth-mode button").forEach(b=>b.addEventListener("click",()=>setAuthMode(b.dataset.m)));
setAuthMode("login");

$("#auth-form").addEventListener("submit",async e=>{
  e.preventDefault(); if(!sb) return;
  const id=$("#a-email").value.trim(), p=$("#a-pass").value, code=$("#a-code").value.trim(), u=$("#a-user").value.trim();
  const btn=$("#a-submit"); btn.disabled=true; showErr($("#a-err")); $("#a-ok").hidden=true;
  try{
    if(authMode==="signup"){
      if(!isMail(id)) throw new Error("email invalide");
      const [{data:free,error:ue},{data:g,error:ce}]=await Promise.all([sb.rpc("username_available",{p_username:u}),code?sb.rpc("check_invite",{p_code:code}):Promise.resolve({data:null})]);
      if(ue) throw ue; if(free===false) throw new Error("pseudo pris");
      if(code){ if(ce) throw ce; if(!g||!g.length) throw new Error("code invalide"); if(g[0].full_group) throw new Error("groupe complet"); }
      const {data:su,error}=await sb.auth.signUp({email:id.toLowerCase(),password:p,options:{emailRedirectTo:siteUrl()}});
      if(error) throw error;
      if(!su.session){
        // confirmation par e-mail activée : on finira l'inscription à la première connexion
        try{ localStorage.setItem("cdj-pending-join",JSON.stringify({code,username:u})); }catch(_){}
        $("#a-ok").textContent="📧 Presque fini ! Ouvre l'e-mail envoyé à "+id+" et touche le lien de confirmation, puis connecte-toi ici.";
        $("#a-ok").hidden=false; setAuthMode("login"); $("#a-email").value=id; $("#a-ok").hidden=false;
        return;
      }
      await finishProfile(u,code,g&&g[0]);
    }else{
      const email=isMail(id)?id.toLowerCase():emailOf(id);
      const {error}=await sb.auth.signInWithPassword({email,password:p});
      if(error){ if(!isMail(id)&&/Invalid login/i.test(error.message)) throw new Error("pseudo legacy"); throw error; }
    }
    $("#a-pass").value="";
    await loadMe();
    if(!me){ // compte créé avec confirmation e-mail : on termine l'adhésion si on a les infos
      let pj=null; try{ pj=JSON.parse(localStorage.getItem("cdj-pending-join")||"null"); }catch(_){}
      if(pj){ try{ await finishProfile(pj.username,pj.code); localStorage.removeItem("cdj-pending-join"); await loadMe(); }catch(_){ $("#j-user").value=pj.username; $("#j-code").value=pj.code||""; } }
    }
    if(me){ toast("Bienvenue @"+me.username+" !"); location.hash=groups.length?"#fil":"#conseils"; }
  }catch(err){ showErr($("#a-err"),frError(err)); }
  finally{ btn.disabled=false; }
});

// profil créé avec ou sans code de groupe
async function finishProfile(u,code,info){
  if(code){
    if(info?.require_approval) setTimeout(()=>toast("Demande envoyée à « "+info.name+" » : un modérateur doit la valider"),900);
    const {error}=await sb.rpc("join_group",{p_code:code,p_username:u}); if(error) throw error;
  }else{
    const {error}=await sb.rpc("create_profile",{p_username:u}); if(error) throw error;
  }
}
// mot de passe oublié
$("#a-forgot").addEventListener("click",()=>{ $("#auth-form").hidden=true; $("#forgot-form").hidden=false; const v=$("#a-email").value.trim(); if(isMail(v)) $("#f-email").value=v; showErr($("#f-err")); $("#f-ok").hidden=true; $("#f-email").focus(); });
$("#f-back").addEventListener("click",()=>setAuthMode("login"));
$("#forgot-form").addEventListener("submit",async e=>{
  e.preventDefault(); if(!sb) return;
  const em=$("#f-email").value.trim().toLowerCase(), b=$("#f-submit"); b.disabled=true; showErr($("#f-err")); $("#f-ok").hidden=true;
  const {error}=await sb.auth.resetPasswordForEmail(em,{redirectTo:siteUrl()});
  b.disabled=false;
  if(error) return showErr($("#f-err"),frError(error));
  // même message que l'adresse existe ou non, pour ne rien révéler
  $("#f-ok").textContent="📧 Si un compte existe avec "+em+", un e-mail vient de partir. Ouvre le lien qu'il contient (pense aux spams) pour choisir un nouveau mot de passe.";
  $("#f-ok").hidden=false;
});

$("#join").addEventListener("submit",async e=>{
  e.preventDefault(); showErr($("#j-err"));
  try{ await finishProfile($("#j-user").value.trim(),$("#j-code").value.trim()); }catch(error){ return showErr($("#j-err"),frError(error)); }
  await loadMe();
});

$("#join-more").addEventListener("submit",async e=>{
  e.preventDefault(); showErr($("#jm-err"));
  const {data:gid,error}=await sb.rpc("join_group",{p_code:$("#jm-code").value.trim()});
  if(error) return showErr($("#jm-err"),frError(error));
  $("#jm-code").value="";
  await loadGroups();
  if(pendingGroups.some(g=>g.id===gid)){ toast("Demande envoyée : un modérateur doit la valider"); refreshUI(); }
  else{ setGroup(gid); toast("Groupe rejoint : "+groupName(gid)); }
});

$("#logout").addEventListener("click",async()=>{
  try{ const sub=pushSupported()?await currentSub():null; if(sub) await sb.rpc("delete_push_sub",{p_endpoint:sub.endpoint}); }catch(e){}
  await sb.auth.signOut();
  try{ localStorage.removeItem("cdj-fav"); window.dispatchEvent(new Event("cdj-fav")); }catch(_){}
  me=null; hasSession=false; groups=[]; pendingGroups=[]; myRoles=new Map(); roles=new Map(); spots=[]; cur=null; if(layer) layer.clearLayers();
  hooks.groupChanged?.();
  refreshUI(); route();
});

async function loadMe(){
  const {data:{session}}=await sb.auth.getSession();
  hasSession=!!session;
  if(!session){ me=null; groups=[]; refreshUI(); return; }
  const {data}=await sb.from("profiles").select("id,username,is_admin,is_controller,pw_temp,fav_species").eq("id",session.user.id).maybeSingle();
  me=data||null;
  try{ const f=JSON.stringify(me?.fav_species||[]); if(localStorage.getItem("cdj-fav")!==f){ localStorage.setItem("cdj-fav",f); window.dispatchEvent(new Event("cdj-fav")); } }catch(_){}
  if(me){
    me.real={is_admin:!!me.is_admin,is_controller:!!me.is_controller};
    if(userView){ me.is_admin=false; me.is_controller=false; }
    sb.rpc("list_controllers").then(({data})=>{ window.CDJ_CTRL=new Set((data||[]).map(x=>x.username)); });
    await loadGroups(); loadSpots(); loadStats(); syncPush();
  }
  refreshUI();
}

async function loadGroups(){
  const [{data:gs},{data:mine}]=await Promise.all([
    sb.from("groups").select("id,name,region,require_approval,post_approval").order("name"),
    sb.from("memberships").select("group_id,role,status").eq("user_id",me.id)]);
  const mm=new Map((mine||[]).map(m=>[m.group_id,m]));
  myRoles=new Map((mine||[]).filter(m=>m.status==="active").map(m=>[m.group_id,m.role]));
  canSwitchView=!!(me.real?.is_admin||me.real?.is_controller||[...myRoles.values()].some(r=>r!=="member"));
  if(userView) myRoles=new Map([...myRoles].map(([g])=>[g,"member"]));
  viewToggle();
  const all=gs||[];
  pendingGroups=all.filter(g=>mm.get(g.id)?.status==="pending");
  groups=isStaff()?all:all.filter(g=>mm.get(g.id)?.status==="active");
  roles=new Map();
  if(groups.length){
    const {data:rs}=await sb.from("memberships").select("group_id,user_id,role").in("role",["owner","moderator"]).eq("status","active").in("group_id",groups.map(g=>g.id));
    (rs||[]).forEach(o=>{ if(!roles.has(o.group_id)) roles.set(o.group_id,new Map()); roles.get(o.group_id).set(o.user_id,o.role); });
  }
  let saved=null; try{ saved=localStorage.getItem("cdj-grp"); }catch(e){}
  const valid=v=>v==="all"?isStaff():groups.some(g=>String(g.id)===v);
  cur=saved&&valid(saved)?(saved==="all"?"all":Number(saved)):(isStaff()?"all":(groups[0]?.id??null));
  refreshUI();
}

function viewToggle(){
  const b=$("#view-toggle"); if(!b) return;
  b.hidden=!canSwitchView;
  const realLabel=me?.real?.is_admin?"Admin":me?.real?.is_controller?"Contrôle":"Modo";
  b.innerHTML=""; b.classList.toggle("on",userView);
  b.append(el("span","vt-eye",userView?"👤":"🛡️"),el("span","vt-t",userView?"Membre":realLabel));
  b.title=userView?"Tu vois l'appli comme un membre. Touche pour revenir en vue "+realLabel.toLowerCase():"Voir l'appli comme un simple membre";
  b.setAttribute("aria-label",b.title);
}
$("#view-toggle")?.addEventListener("click",()=>{
  userView=!userView;
  try{ localStorage.setItem("cdj-userview",userView?"1":"0"); if(userView&&localStorage.getItem("cdj-grp")==="all") localStorage.removeItem("cdj-grp"); }catch(e){}
  toast(userView?"Vue membre : tu vois l'appli comme un simple membre":"Retour en vue complète");
  setTimeout(()=>location.reload(),350);
});

async function loadStats(){
  const [{count:pc},{count:sc}]=await Promise.all([
    sb.from("posts").select("id",{count:"exact",head:true}).eq("user_id",me.id),
    sb.from("spots").select("id",{count:"exact",head:true}).eq("user_id",me.id)]);
  $("#me-stats").textContent=(pc||0)+" prise"+(pc>1?"s":"")+" partagée"+(pc>1?"s":"")+" · "+(sc||0)+" spot"+(sc>1?"s":"");
}

function renderMyGroups(){
  const box=$("#my-groups-list"); if(!box) return; box.innerHTML="";
  if(!me) return;
  if(me.is_admin) box.append(el("p","note","En tant qu'admin tu vois tous les groupes, même sans en être membre. Bascule de l'un à l'autre depuis l'en-tête."));
  const mine=groups.filter(g=>myRoles.has(g.id));
  if(!mine.length&&!pendingGroups.length&&!me.is_admin){ box.append(el("p","note","Aucun groupe pour l'instant.")); return; }
  const leave=(g,label)=>confirmBtn(label,"Confirmer",async()=>{
    await sb.from("memberships").delete().eq("group_id",g.id).eq("user_id",me.id);
    await loadGroups(); loadSpots(); loadFeed(); hooks.groupChanged?.();
  });
  mine.forEach(g=>{
    const r=el("div","mrow");
    const nm=el("button","linkbtn plain",g.name+(g.region?" · "+g.region:"")); nm.type="button";
    nm.addEventListener("click",()=>{ setGroup(g.id); location.hash="#fil"; });
    const b=roleBadge(myRoles.get(g.id)); if(b) nm.append(b);
    r.append(nm, leave(g,"Quitter"));
    box.append(r);
  });
  pendingGroups.forEach(g=>{
    const r=el("div","mrow");
    const nm=el("span",null,g.name); nm.append(el("span","badge wait","En attente"));
    r.append(nm, leave(g,"Annuler"));
    box.append(r);
  });
}

// ---------- Fil ----------
async function compress(file){
  const img=await createImageBitmap(file);
  const max=1600, k=Math.min(1,max/Math.max(img.width,img.height));
  const c=document.createElement("canvas");
  c.width=Math.round(img.width*k); c.height=Math.round(img.height*k);
  c.getContext("2d").drawImage(img,0,0,c.width,c.height);
  return new Promise(r=>c.toBlob(r,"image/jpeg",0.82));
}
// Photos choisies pour le post (on peut en ajouter en plusieurs fois)
const MAXPICS=6;
let pics=[];
function renderThumbs(){
  const box=$("#p-thumbs"); box.innerHTML="";
  box.hidden=!pics.length; $("#p-measure").hidden=!pics.length; hooks.picsChanged?.(pics);
  pics.forEach((f,i)=>{
    const t=el("div","thumb");
    const im=el("img"); im.src=f.url; im.alt="Photo "+(i+1); t.append(im);
    if(i===0) t.append(el("span","thumb-first","1re"));
    const x=el("button","thumb-x","×"); x.type="button"; x.setAttribute("aria-label","Retirer la photo "+(i+1));
    x.addEventListener("click",()=>{ URL.revokeObjectURL(f.url); pics.splice(i,1); renderThumbs(); });
    t.append(x); box.append(t);
  });
}
$("#p-photo").addEventListener("change",()=>{
  const add=[...$("#p-photo").files];
  const room=MAXPICS-pics.length;
  add.slice(0,room).forEach(file=>pics.push({file,url:URL.createObjectURL(file)}));
  if(add.length>room) toast("6 photos maximum par post");
  $("#p-photo").value="";
  renderThumbs();
});

// ---------- Relâché / gardé ----------
function relOf(sel){ const b=document.querySelector(sel+' [aria-pressed="true"]'); return b?b.dataset.v==="1":null; }
document.addEventListener("click",e=>{ const b=e.target.closest(".rel-seg button"); if(!b) return; const on=b.getAttribute("aria-pressed")==="true"; b.parentNode.querySelectorAll("button").forEach(x=>x.setAttribute("aria-pressed","false")); if(!on) b.setAttribute("aria-pressed","true"); });
window.CDJ_REL=relOf;
// ---------- Poids estimé (formules longueur-poids : poids en g = a × longueur en cm ^ b) ----------
const LW={"Brochet":[0.0045,3.1],"Sandre":[0.0055,3.12],"Perche":[0.0105,3.1],"Black-bass":[0.011,3.08],"Silure":[0.0045,3.1],"Carpe":[0.019,3.0],"Chevesne":[0.0105,3.05],"Truite fario":[0.0105,3.0],"Barbeau":[0.009,3.05],"Tanche":[0.015,3.05],"Brème":[0.009,3.15],"Gardon":[0.011,3.1],"Aspe":[0.008,3.05]};
let wtTouched=false;
function estWeight(sp,len){ const k=LW[sp]; if(!k||!(len>0)) return null; return k[0]*Math.pow(len,k[1])/1000; }
const fmtKg=w=>w>=10?w.toFixed(1):w.toFixed(2);
window.CDJ_WEIGHT={est:estWeight,fmt:fmtKg,species:Object.keys(LW)};
function updateWeight(){
  const len=parseFloat($("#p-len").value), sp=$("#p-species").value, note=$("#p-wt-note");
  const w=estWeight(sp,len);
  if(wtTouched){ note.hidden=true; return; }
  if(w==null){
    $("#p-wt").value="";
    note.hidden=!(len>0);
    note.textContent=sp?"Pas de formule de poids pour cette espèce : saisis-le à la main.":"Choisis l'espèce pour estimer le poids.";
    return;
  }
  $("#p-wt").value=fmtKg(w);
  note.hidden=false;
  note.textContent="Poids estimé d'après la longueur (entre "+fmtKg(w*0.85)+" et "+fmtKg(w*1.15)+" kg selon la corpulence). Corrige-le si tu as pesé le poisson.";
}
$("#p-len").addEventListener("input",updateWeight);
$("#p-species").addEventListener("change",updateWeight);
$("#p-wt").addEventListener("input",()=>{ wtTouched=$("#p-wt").value!==""; $("#p-wt-note").hidden=true; });

// ---------- Mesure sur photo ----------
const M={img:null,scale:1,pts:[]};
const STEPS=["Touche une graduation du mètre (par ex. le 0). Plus les 2 graduations sont écartées, plus la mesure est précise.","Touche la 2e graduation, à l'écart indiqué en haut (ex. 50 cm).","Touche le bout du museau.","Touche le bout de la queue.","Mesure terminée. Valide, ou recommence pour affiner."];
function mLength(){
  if(M.pts.length<4) return null;
  const d=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  const ref=d(M.pts[0],M.pts[1]), cm=parseFloat($("#m-ref").value);
  if(!(ref>0)||!(cm>0)) return null;
  return d(M.pts[2],M.pts[3])/ref*cm;
}
function mDraw(){
  const c=$("#m-canvas"), g=c.getContext("2d");
  g.clearRect(0,0,c.width,c.height);
  g.drawImage(M.img,0,0,c.width,c.height);
  const css=getComputedStyle(document.documentElement);
  const cols=[css.getPropertyValue("--amber").trim()||"#e3a24e",css.getPropertyValue("--accent").trim()||"#5cc2a3"];
  const P=M.pts.map(p=>({x:p.x*M.scale,y:p.y*M.scale}));
  [[0,1],[2,3]].forEach(([a,b],i)=>{
    if(P[a]&&P[b]){ g.strokeStyle=cols[i]; g.lineWidth=3; g.beginPath(); g.moveTo(P[a].x,P[a].y); g.lineTo(P[b].x,P[b].y); g.stroke(); }
  });
  P.forEach((p,i)=>{
    g.fillStyle=cols[i<2?0:1]; g.strokeStyle="#fff"; g.lineWidth=2;
    g.beginPath(); g.arc(p.x,p.y,8,0,Math.PI*2); g.fill(); g.stroke();
  });
  $("#m-step").textContent=(Math.min(M.pts.length,4)+1)+"/5 · "+STEPS[Math.min(M.pts.length,4)];
  const L=mLength();
  $("#m-result").textContent=L?"Longueur : "+L.toFixed(1)+" cm":"";
  $("#m-ok").disabled=!L;
}
function mLayout(){
  const area=$("#m-area"), c=$("#m-canvas");
  const s=Math.min(area.clientWidth/M.img.naturalWidth,area.clientHeight/M.img.naturalHeight);
  M.scale=s; c.width=Math.round(M.img.naturalWidth*s); c.height=Math.round(M.img.naturalHeight*s);
  mDraw();
}
$("#p-measure").addEventListener("click",()=>{
  const f=pics[0]?.file; if(!f) return;
  const img=new Image();
  img.onload=()=>{ M.img=img; M.pts=[]; $("#measure").hidden=false; document.body.style.overflow="hidden"; requestAnimationFrame(mLayout); };
  img.src=URL.createObjectURL(f);
});
$("#m-canvas").addEventListener("pointerdown",e=>{
  if(M.pts.length>=4) return;
  const r=e.target.getBoundingClientRect();
  M.pts.push({x:(e.clientX-r.left)/M.scale,y:(e.clientY-r.top)/M.scale});
  mDraw();
});
$("#m-ref").addEventListener("input",mDraw);
$("#m-reset").addEventListener("click",()=>{ M.pts=[]; mDraw(); });
function mClose(){ $("#measure").hidden=true; document.body.style.overflow=""; }
$("#m-cancel").addEventListener("click",mClose);
$("#m-ok").addEventListener("click",()=>{
  const L=mLength(); if(!L) return;
  $("#p-len").value=L.toFixed(1); mClose(); updateWeight();
});
window.addEventListener("resize",()=>{ if(!$("#measure").hidden&&M.img) mLayout(); });
$("#composer").addEventListener("submit",async e=>{
  e.preventDefault(); if(!me||cur==="all"||cur==null) return;
  const cap=$("#p-caption").value.trim();
  if(!pics.length&&!cap&&!$("#p-bait").value.trim()) return showErr($("#p-err"),"Ajoute une photo ou une légende.");
  const btn=$("#p-submit"); btn.disabled=true; btn.textContent="Envoi…"; showErr($("#p-err"));
  // hors ligne : on garde la prise (photos comprises) et on l'envoie au retour du réseau
  const queuePost=async()=>{
    const blobs=[]; for(const p of pics) blobs.push(await compress(p.file));
    const len=parseFloat($("#p-len").value), wt=parseFloat($("#p-wt").value);
    const ok=await window.CDJ.offline?.enqueue({kind:"post",blobs,row:{group_id:cur,caption:cap||null,species:$("#p-species").value||null,
      spot_id:$("#p-spot").value?Number($("#p-spot").value):null,length_cm:len>0?Math.round(len*10)/10:null,weight_kg:wt>0?Math.round(wt*100)/100:null,bait:$("#p-bait").value.trim()||null,released:relOf("#p-rel"),conditions:window.CDJ_ADVICE?.snapshot?.()||null}});
    if(!ok) return false;
    pics.forEach(f=>URL.revokeObjectURL(f.url)); pics=[]; renderThumbs();
    $("#composer").reset(); document.querySelectorAll("#p-rel button").forEach(x=>x.setAttribute("aria-pressed","false")); $("#p-measure").hidden=true; $("#p-wt-note").hidden=true; wtTouched=false;
    toast("Pas de réseau : ta prise partira automatiquement dès le retour du réseau"); return true;
  };
  if(!navigator.onLine&&window.CDJ.offline){ try{ await queuePost(); }finally{ btn.disabled=false; btn.textContent="Publier"; } return; }
  try{
    const paths=[], stamp=Date.now();
    for(let i=0;i<pics.length;i++){
      btn.textContent="Envoi "+(i+1)+"/"+pics.length+"…";
      const blob=await compress(pics[i].file);
      const path=cur+"/"+me.id+"/"+stamp+"-"+i+".jpg";
      const {error}=await sb.storage.from("photos").upload(path,blob,{contentType:"image/jpeg"});
      if(error){ if(paths.length) await sb.storage.from("photos").remove(paths); throw error; }
      paths.push(path);
    }
    const path=paths[0]||null;
    const spot=$("#p-spot").value?Number($("#p-spot").value):null;
    const len=parseFloat($("#p-len").value), wt=parseFloat($("#p-wt").value);
    const cardData={species:$("#p-species").value||null,length:len>0?Math.round(len*10)/10:null,weight:wt>0?Math.round(wt*100)/100:null,
      bait:$("#p-bait").value.trim()||null,date:new Date().toISOString(),username:me.username,group:curGroup()?.name||"",
      spot:spot?($("#p-spot").selectedOptions[0]?.textContent||null):null,photoUrl:pics[0]?URL.createObjectURL(pics[0].file):null};
    const {error}=await sb.from("posts").insert({group_id:cur,caption:cap||null,species:$("#p-species").value||null,photo_path:path,photo_paths:paths.length?paths:null,spot_id:spot,
      length_cm:len>0?Math.round(len*10)/10:null, weight_kg:wt>0?Math.round(wt*100)/100:null, bait:$("#p-bait").value.trim()||null,
      released:relOf("#p-rel"),conditions:window.CDJ_ADVICE?.snapshot?.()||null});
    if(error){ if(paths.length) await sb.storage.from("photos").remove(paths); throw error; }
    pics.forEach(f=>URL.revokeObjectURL(f.url)); pics=[]; renderThumbs();
    $("#composer").reset(); document.querySelectorAll("#p-rel button").forEach(x=>x.setAttribute("aria-pressed","false")); $("#p-measure").hidden=true; $("#p-wt-note").hidden=true; wtTouched=false;
    if(curGroup()?.post_approval&&!canModerate(cur)) toast("Prise envoyée : elle sera visible après validation"); else if(window.CDJ?.celebrate) window.CDJ.celebrate("🎣","Prise partagée","Le groupe est prévenu"); else toast("Prise partagée");
    loadFeed(); loadStats();
    // une belle prise avec photo : on propose tout de suite la carte d'identité
    if(cardData.photoUrl&&(cardData.species||cardData.length)) setTimeout(()=>window.CDJ.openCard?.(cardData),500);
  }catch(err){
    if(window.CDJ.offline?.isNetErr(err)&&await queuePost()) return;
    showErr($("#p-err"),frError(err));
  }
  finally{ btn.disabled=false; btn.textContent="Publier"; }
});
$("#feed-refresh").addEventListener("click",()=>loadFeed());

let feedSeq=0;
async function loadFeed(){
  if(!me||!groups.length||cur==null) return;
  const seq=++feedSeq;
  const feed=$("#feed");
  // silhouettes grisées pendant le premier chargement
  if(!feed.querySelector("article.post,article.sess")){ feed.innerHTML=""; for(let i=0;i<3;i++){ const k=el("div","skel-card"); k.append(el("div","skel skel-head"),el("div","skel skel-photo"),el("div","skel skel-line"),el("div","skel skel-line short")); feed.append(k); } }
  let q=sb.from("posts")
    .select("id,group_id,caption,species,photo_path,photo_paths,created_at,user_id,status,length_cm,weight_kg,bait,released,profiles(username,is_admin),spots(id,name)")
    .order("created_at",{ascending:false}).limit(60);
  let qs=sb.from("sessions").select("id,group_id,user_id,species,caught,length_cm,lure,color,rating,created_at,duration_min,distance_m,bites,released,profiles(username,is_admin)")
    .order("created_at",{ascending:false}).limit(40);
  if(cur!=="all"){ q=q.eq("group_id",cur); qs=qs.eq("group_id",cur); }
  const [{data,error},{data:sess}]=await Promise.all([q,qs]);
  if(seq!==feedSeq) return;   // un chargement plus récent a pris le relais : pas de doublon
  if(error){ feed.innerHTML=""; feed.append(el("p","err",frError(error))); return; }
  const allPaths=p=>(p.photo_paths&&p.photo_paths.length)?p.photo_paths:(p.photo_path?[p.photo_path]:[]);
  const paths=data.flatMap(allPaths);
  const urls={};
  if(paths.length){
    const {data:signed}=await sb.storage.from("photos").createSignedUrls(paths,3600);
    (signed||[]).forEach(s=>{ if(s.signedUrl) urls[s.path]=s.signedUrl; });
  }
  if(seq!==feedSeq) return;
  feed.innerHTML="";
  const items=[...data,...(sess||[]).map(x=>({...x,_kind:"session"}))].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
  if(!items.length){ const e=el("div","empty-state"); e.append(el("div","es-ico","🎣"),el("b",null,"Le fil est encore vide"),el("p",null,"Sois le premier : partage une prise avec sa photo, ou un bilan rapide de ta dernière sortie."));
    const a=el("div","actions"); const b1=el("button","btn primary","📸 Partager une prise"); b1.type="button"; b1.addEventListener("click",()=>document.querySelector('#post-mode [data-m="post"]')?.click());
    const b2=el("button","btn","🧾 Faire un bilan"); b2.type="button"; b2.addEventListener("click",()=>document.querySelector('#post-mode [data-m="bilan"]')?.click()); a.append(b1,b2); e.append(a); feed.append(e); return; }
  const social=[];
  for(const p of items){
    if(p._kind==="session"){ feed.append(sessionCard(p)); continue; }
    const a=el("article","post"+(p.status==="pending"?" is-pending":""));
    if(p.status==="pending"){
      const bar=el("div","pending-bar"); bar.append(el("span",null,"En attente de validation"));
      if(canModerate(p.group_id)){
        const ok=el("button","btn primary small","Valider"); ok.type="button";
        ok.addEventListener("click",async()=>{ ok.disabled=true; const {error}=await sb.rpc("approve_post",{p_id:p.id}); if(error){ ok.disabled=false; return toast(frError(error)); } toast("Publication validée"); loadFeed(); });
        bar.append(ok);
      }
      a.append(bar);
    }
    const head=el("div","post-head");
    const who=el("div","post-who");
    who.append(avatar(p.profiles?.username));
    const left=el("div"); left.append(userLabel(p.profiles?.username,p.profiles?.is_admin,roleOf(p.group_id,p.user_id)));
    if(cur==="all") left.append(el("div","post-group",groupName(p.group_id)));
    who.append(left);
    head.append(who, el("span","post-date",ago(p.created_at)));
    a.append(head);
    const shown=allPaths(p).filter(x=>urls[x]);
    if(shown.length){
      const gal=el("div","gallery");
      const track=el("div","gallery-track");
      shown.forEach((x,i)=>{
        const img=el("img"); img.loading="lazy"; img.src=urls[x];
        img.alt=(p.species?"Prise : "+p.species:"Photo de prise")+(shown.length>1?" ("+(i+1)+"/"+shown.length+")":"");
        track.append(img);
      });
      gal.append(track);
      if(shown.length>1){
        const cnt=el("span","gallery-count","1/"+shown.length);
        const dots=el("div","gallery-dots");
        shown.forEach((_,i)=>dots.append(el("i",i===0?"on":null)));
        track.addEventListener("scroll",()=>{
          const k=Math.round(track.scrollLeft/track.clientWidth);
          cnt.textContent=(k+1)+"/"+shown.length;
          [...dots.children].forEach((d,j)=>d.className=j===k?"on":"");
        },{passive:true});
        gal.append(cnt,dots);
      }
      a.append(gal);
    }
    const body=el("div","post-body");
    const tags=el("div","tags");
    if(p.species) tags.append(el("span","tag",p.species));
    const size=[p.length_cm?Number(p.length_cm).toLocaleString("fr-FR")+" cm":"",p.weight_kg?Number(p.weight_kg).toLocaleString("fr-FR")+" kg":""].filter(Boolean).join(" · ");
    if(size) tags.append(el("span","size",size));
    if(p.released===true) tags.append(el("span","tag rel-tag","♻️ Relâché"));
    else if(p.released===false) tags.append(el("span","tag kept-tag","🍽️ Gardé"));
    if(tags.childNodes.length) body.append(tags);
    if(p.bait){
      const bx=el("div","bait-box");
      bx.append(el("div","label","Appât et amorçage"), el("p",null,p.bait));
      body.append(bx);
    }
    if(p.caption) body.append(el("p",null,p.caption));
    const foot=el("div","post-foot");
    if(p.spots){
      const b=el("button","linkbtn","📍 "+p.spots.name); b.type="button";
      b.addEventListener("click",()=>{ location.hash="#carte"; setTimeout(()=>focusSpot(p.spots.id),300); });
      foot.append(b);
    }else foot.append(el("span"));
    const footR=el("div","actions");
    if(shown.length&&p.status!=="pending"){
      const cb=el("button","linkbtn","🪪 Carte"); cb.type="button"; cb.setAttribute("aria-label","Créer la carte d'identité de cette prise");
      cb.addEventListener("click",()=>window.CDJ.openCard?.({species:p.species,length:p.length_cm,weight:p.weight_kg,bait:p.bait,date:p.created_at,
        username:p.profiles?.username||"?",group:groupName(p.group_id),spot:p.spots?.name||null,photoUrl:urls[shown[0]]}));
      footR.append(cb);
    }
    foot.append(footR);
    if(p.user_id===me.id||canModerate(p.group_id)){
      const lbl=p.user_id===me.id?(p.status==="pending"?"Refuser / retirer":"Supprimer"):(p.status==="pending"?"Refuser":"Supprimer (modération)");
      footR.append(confirmBtn(lbl,"Confirmer la suppression",async()=>{
        const ph=allPaths(p); if(ph.length) await sb.storage.from("photos").remove(ph);
        const {error}=await sb.from("posts").delete().eq("id",p.id);
        if(error) return toast(frError(error));
        toast("Post supprimé"); loadFeed(); loadStats();
      }));
    }
    body.append(foot); a.append(body); feed.append(a);
    if(p.status!=="pending") social.push({post:p,body,foot});
  }
  hooks.feedExtras?.(social);
}

// Bilan de session affiché dans le fil
const RATING=[null,{e:"🏜️",t:"C'était désert"},{e:"😐",t:"Journée moyenne"},{e:"👍",t:"Belle journée"},{e:"🔥",t:"Journée de fou"}];
function sessionCard(x){
  const a=el("article","post session r"+x.rating);
  const head=el("div","post-head");
  const who=el("div","post-who"); who.append(avatar(x.profiles?.username));
  const left=el("div"); left.append(userLabel(x.profiles?.username,x.profiles?.is_admin,roleOf(x.group_id,x.user_id)));
  left.append(el("div","post-group","Bilan de session"+(cur==="all"?" · "+groupName(x.group_id):"")));
  who.append(left); head.append(who, el("span","post-date",ago(x.created_at)));
  const body=el("div","post-body");
  const r=RATING[x.rating]||RATING[2];
  const big=el("div","sess-rating"); big.append(el("span","sess-emoji",r.e),el("span",null,r.t)); body.append(big);
  const tags=el("div","tags");
  if(x.species) tags.append(el("span","tag",x.species));
  if(x.caught===false) tags.append(el("span","tag muted","Capot"));
  else if(x.length_cm) tags.append(el("span","size",Number(x.length_cm).toLocaleString("fr-FR")+" cm"));
  if(x.caught!==false&&x.released===true) tags.append(el("span","tag rel-tag","♻️ Relâché")); else if(x.caught!==false&&x.released===false) tags.append(el("span","tag kept-tag","🍽️ Gardé"));
  if(tags.childNodes.length) body.append(tags);
  if(x.duration_min!=null){ const m=x.duration_min, t=el("div","sess-trace"); t.textContent="🛶 "+(m>=60?Math.floor(m/60)+" h "+String(m%60).padStart(2,"0"):m+" min")+(x.distance_m?" · "+(x.distance_m>=1000?(x.distance_m/1000).toFixed(1).replace(".",",")+" km":Math.round(x.distance_m)+" m"):"")+(x.bites!=null?" · "+x.bites+" touche"+(x.bites>1?"s":""):""); body.append(t); }
  if(x.lure||x.color){ const c=el("div","combo"); c.append(el("span","label","Combo"),el("span",null,[x.lure,x.color].filter(Boolean).join(" · "))); body.append(c); }
  if(x.user_id===me.id||canModerate(x.group_id)){
    const foot=el("div","post-foot"); foot.append(el("span"));
    foot.append(confirmBtn("Supprimer","Confirmer la suppression",async()=>{
      const {error}=await sb.from("sessions").delete().eq("id",x.id);
      if(error) return toast(frError(error)); toast("Bilan supprimé"); loadFeed(); hooks.groupe?.();
    }));
    body.append(foot);
  }
  a.append(head,body); return a;
}

// ---------- Carte ----------
function openMap(){
  if(!me||!groups.length||typeof L==="undefined") return;
  if(!map){
    const pos=window.CDJ_POS;
    map=L.map("map").setView(pos?[pos.lat,pos.lon]:[46.6,2.4],pos?12:6);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,
      attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'}).addTo(map);
    layer=L.layerGroup().addTo(map);
    map.on("click",ev=>{ if(hooks.mapClick?.(ev.latlng)) return; startSpot(ev.latlng.lat,ev.latlng.lng); });
    drawSpots();
    hooks.mapReady?.(map);
  }
  setTimeout(()=>map.invalidateSize(),50);
  hooks.mapShown?.(map);
}
window.addEventListener("cdj-pos",ev=>{ if(map&&!spots.length) map.setView([ev.detail.lat,ev.detail.lon],12); });
function pinIcon(mine){ return L.divIcon({className:"",html:'<div class="spot-pin'+(mine?" mine":"")+'"></div>',iconSize:[22,22],iconAnchor:[11,22],popupAnchor:[0,-22]}); }

async function loadSpots(){
  if(!me||cur==null){ spots=[]; drawSpots(); return; }
  let q=sb.from("spots").select("id,group_id,name,note,lat,lon,created_at,user_id,depth_m,distance_tours,bottom,details,sheet_updated_at,profiles!spots_user_id_fkey(username,is_admin)").order("created_at",{ascending:false});
  if(cur!=="all") q=q.eq("group_id",cur);
  const {data,error}=await q;
  if(error){ console.error(error); toast("Spots : "+frError(error)); }
  spots=data||[];
  const sel=$("#p-spot"), prev=sel.value;
  sel.innerHTML='<option value="">Aucun</option>';
  spots.forEach(s=>sel.append(new Option(s.name,s.id)));
  sel.value=prev;
  drawSpots();
  hooks.spotsLoaded?.();
}
function drawSpots(){
  if(!layer) return;
  layer.clearLayers();
  spots.forEach(s=>{
    const m=L.marker([s.lat,s.lon],{icon:pinIcon(s.user_id===me?.id)});
    const box=el("div");
    box.append(el("b",null,s.name));
    const by=el("div"); by.style.color="var(--muted)";
    by.append(userLabel(s.profiles?.username,s.profiles?.is_admin,roleOf(s.group_id,s.user_id))," · "+ago(s.created_at));
    box.append(by);
    if(cur==="all") box.append(el("div","post-group",groupName(s.group_id)));
    if(s.note){ const n=el("p",null,s.note); n.style.margin="6px 0"; n.style.whiteSpace="pre-wrap"; box.append(n); }
    const sheet=[s.depth_m?String(s.depth_m).replace(".",",")+" m":null,s.distance_tours?s.distance_tours+" tours":null,s.bottom].filter(Boolean).join(" · ");
    if(sheet) box.append(el("div","pop-sheet",sheet));
    const tools=el("div","pop-tools");
    const cond=el("button","btn small","🌤️ Conditions ici"); cond.type="button";
    cond.addEventListener("click",()=>{ map.closePopup(); location.hash="#conseils"; window.CDJ_ADVICE?.loadAt(s.lat,s.lon,s.name).catch(()=>toast("Météo indisponible pour ce spot")); });
    const fiche=el("button","btn small","📋 Fiche du poste"); fiche.type="button";
    fiche.addEventListener("click",()=>{ map.closePopup(); hooks.spotSheet?.(s); });
    tools.append(cond,fiche); box.append(tools);
    const go=el("a",null,"Itinéraire"); go.href="https://www.google.com/maps/dir/?api=1&destination="+s.lat+","+s.lon; go.target="_blank"; go.rel="noopener";
    box.append(go);
    if(s.user_id===me?.id||canModerate(s.group_id)){
      const del=confirmBtn(s.user_id===me.id?"Supprimer":"Supprimer (modération)","Confirmer",async()=>{
        const {error}=await sb.from("spots").delete().eq("id",s.id);
        if(error) return toast(frError(error));
        map.closePopup(); toast("Spot supprimé"); loadSpots(); loadStats();
      });
      del.style.marginLeft="12px"; box.append(del);
    }
    m.bindPopup(box); m.addTo(layer); markers[s.id]=m;
  });
}
function focusSpot(id){
  const s=spots.find(x=>x.id===id); if(!s||!map) return;
  map.setView([s.lat,s.lon],15); markers[id]?.openPopup();
}
function startSpot(lat,lon){
  if(cur==="all"){ toast("Choisis d'abord un groupe pour y ajouter un spot"); return; }
  pending={lat,lon};
  $("#spot-coords").textContent="Groupe : "+groupName(cur)+" · "+lat.toFixed(5)+", "+lon.toFixed(5);
  $("#spot-form").hidden=false; showErr($("#s-err"));
  $("#spot-form").scrollIntoView({behavior:"smooth",block:"center"});
  setTimeout(()=>$("#s-name").focus({preventScroll:true}),350);
}
$("#spot-here").addEventListener("click",()=>{
  if(!navigator.geolocation) return toast("Localisation indisponible");
  navigator.geolocation.getCurrentPosition(p=>{
    map.setView([p.coords.latitude,p.coords.longitude],16);
    startSpot(p.coords.latitude,p.coords.longitude);
  },()=>toast("Autorise la localisation pour l'appli"),{enableHighAccuracy:true,timeout:15000});
});
$("#s-cancel").addEventListener("click",()=>{ $("#spot-form").hidden=true; pending=null; });
$("#spot-form").addEventListener("submit",async e=>{
  e.preventDefault(); if(!pending||cur==="all") return;
  const {error}=await sb.from("spots").insert({group_id:cur,name:$("#s-name").value.trim(),note:$("#s-note").value.trim()||null,lat:pending.lat,lon:pending.lon});
  if(error) return showErr($("#s-err"),frError(error));
  $("#spot-form").reset(); $("#spot-form").hidden=true; pending=null;
  toast("Spot enregistré"); loadSpots(); loadStats();
});

// Création d'un groupe par un membre (il en devient responsable)
$("#create-group").addEventListener("submit",async e=>{
  e.preventDefault(); showErr($("#cg-err"));
  const {data:gid,error}=await sb.rpc("manage_save_group",{p_id:null,p_name:$("#cg-name").value.trim(),p_region:$("#cg-region").value.trim(),p_code:$("#cg-code").value.trim()});
  if(error) return showErr($("#cg-err"),frError(error));
  $("#create-group").reset();
  await loadGroups(); setGroup(gid);
  toast("Groupe créé : tu en es responsable");
  location.hash="#groupe";
});
// ---------- Notifications push ----------
const VAPID_PUBLIC="BKA6wk-qXV331-Vep9m6SkC-4Kz4i-T3_Vm2ifrAHI35-h0Vd7xNNLmQo0v_HyIX0i46CkVcDnR6oVtppS_EdlM";
const pushSupported=()=>"serviceWorker" in navigator&&"PushManager" in window&&"Notification" in window;
function b64ToU8(str){ const s=str.replace(/-/g,"+").replace(/_/g,"/")+"===".slice((str.length+3)%4); return Uint8Array.from(atob(s),c=>c.charCodeAt(0)); }
const swReady=()=>Promise.race([navigator.serviceWorker.ready,new Promise((_,rej)=>setTimeout(()=>rej(new Error("sw")),6000))]);
async function currentSub(){ try{ const reg=await swReady(); return await reg.pushManager.getSubscription(); }catch(e){ return null; } }
async function saveSub(sub){
  const j=sub.toJSON();
  const {error}=await sb.rpc("save_push_sub",{p_endpoint:j.endpoint,p_p256dh:j.keys.p256dh,p_auth:j.keys.auth});
  if(error) throw error;
}
async function renderPush(){
  const panel=$("#push-panel"), st=$("#push-status"), btn=$("#push-btn");
  panel.hidden=!me; if(!me) return;
  btn.hidden=true;
  if(!pushSupported()){
    st.textContent=/iPhone|iPad/.test(navigator.userAgent)
      ?"Sur iPhone, installe d'abord l'appli sur l'écran d'accueil (Safari → Partager → Sur l'écran d'accueil), puis ouvre-la depuis son icône pour activer les notifications."
      :"Ce navigateur ne gère pas les notifications. Utilise Chrome sur Android.";
    return;
  }
  if(Notification.permission==="denied"){
    st.textContent="Les notifications sont bloquées pour l'appli. Autorise-les dans les réglages du téléphone (Paramètres → Applis → Chrome ou Rivio → Notifications), puis reviens ici.";
    return;
  }
  const sub=await currentSub();
  btn.hidden=false;
  if(sub&&Notification.permission==="granted"){
    st.textContent="Activées sur ce téléphone : tu es prévenu dès qu'un membre de tes groupes publie une prise ou un spot.";
    btn.textContent="Désactiver"; btn.className="btn"; btn.dataset.a="off";
  }else{
    st.textContent="Reçois une alerte dès qu'un membre de tes groupes publie une prise ou un spot, même appli fermée.";
    btn.textContent="Activer les notifications"; btn.className="btn primary"; btn.dataset.a="on";
  }
}
$("#push-btn").addEventListener("click",async()=>{
  const btn=$("#push-btn"); btn.disabled=true;
  try{
    if(btn.dataset.a==="on"){
      const perm=await Notification.requestPermission();
      if(perm!=="granted"){ toast("Notifications refusées"); return; }
      const reg=await swReady();
      let sub=await reg.pushManager.getSubscription();
      if(!sub) sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64ToU8(VAPID_PUBLIC)});
      await saveSub(sub);
      toast("Notifications activées");
    }else{
      const sub=await currentSub();
      if(sub){ await sb.rpc("delete_push_sub",{p_endpoint:sub.endpoint}); await sub.unsubscribe(); }
      toast("Notifications désactivées");
    }
  }catch(e){ toast("Impossible d'activer les notifications : "+frError(e)); }
  finally{ btn.disabled=false; renderPush(); }
});
// relie l'abonnement de ce téléphone au compte connecté
async function syncPush(){
  if(!me||!pushSupported()||Notification.permission!=="granted") return;
  const sub=await currentSub(); if(sub){ try{ await saveSub(sub); }catch(e){} }
}

// ---------- Accès partagé pour groupe.js ----------
window.CDJ={
  get sb(){ return sb; }, get me(){ return me; }, get cur(){ return cur; }, get groups(){ return groups; },
  get curGroup(){ return curGroup(); }, get myRoles(){ return myRoles; }, get spots(){ return spots; }, loadSpots, get map(){ return map; }, get pics(){ return pics; }, focusSpot,
  el, toast, showErr, ago, frError, confirmBtn, userLabel, roleBadge, avatar, compress,
  roleOf, canManage, canModerate, isManager, isStaff, groupName, setGroup, loadGroups, loadFeed, refreshUI, hooks, RATING,
};

// ---------- Démarrage ----------
async function init(){
  refreshUI(); route();
  if(!configured||typeof supabase==="undefined") return;
  { const h=location.hash; window.CDJ_AUTHLINK={recovery:/type=recovery/.test(h),error:/error_code=|error=/.test(h)?decodeURIComponent((h.match(/error_description=([^&]*)/)||[])[1]||"").replace(/\+/g," "):null,expired:/otp_expired/.test(h)}; }
  sb=supabase.createClient(C.SUPABASE_URL,C.SUPABASE_KEY);
  sb.auth.onAuthStateChange(ev=>{ if(ev==="SIGNED_OUT"){ me=null; hasSession=false; groups=[]; refreshUI(); } });
  try{ await loadMe(); }catch(e){}
  route();
}
init();
})();
