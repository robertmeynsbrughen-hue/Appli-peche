/* Coup du Jour : navigation, comptes, groupes, fil photo, carte des spots, administration */
(function(){
const $=s=>document.querySelector(s);
const $$=s=>Array.from(document.querySelectorAll(s));
const C=window.CDJ_CONFIG||{};
const configured=typeof C.SUPABASE_URL==="string"&&C.SUPABASE_URL.startsWith("https://")&&C.SUPABASE_KEY&&!/COLLE/.test(C.SUPABASE_KEY);
const DOMAIN=C.EMAIL_DOMAIN||"coupdujour.app";
let sb=null, me=null, hasSession=false;
let groups=[], cur=null;            // cur : id de groupe ou "all" (admin)
let owners=new Map();               // id de groupe -> ensemble des responsables
let spots=[], map=null, layer=null, pending=null;
const markers={};

// ---------- Utilitaires ----------
function el(tag,cls,text){ const e=document.createElement(tag); if(cls) e.className=cls; if(text!=null) e.textContent=text; return e; }
function toast(t){ const d=el("div","toast",t); document.body.append(d); setTimeout(()=>d.remove(),2800); }
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
  if(/Invalid login/i.test(m)) return "Nom d'utilisateur ou mot de passe incorrect.";
  if(/already registered|already exists/i.test(m)) return "Ce nom d'utilisateur est déjà pris.";
  if(/code invalide/i.test(m)) return "Code du groupe incorrect.";
  if(/duplicate key.*(profiles|username)/i.test(m)) return "Ce nom d'utilisateur est déjà pris.";
  if(/duplicate key.*invite_code/i.test(m)) return "Ce code est déjà utilisé par un autre groupe.";
  if(/Password should/i.test(m)) return "Mot de passe trop court (6 caractères minimum).";
  if(/Email not confirmed/i.test(m)) return "La confirmation d'e-mail est encore activée dans Supabase : désactive-la (voir le guide).";
  if(/row-level security/i.test(m)) return "Action non autorisée dans ce groupe.";
  if(/limite de groupes/i.test(m)) return "Tu es déjà responsable de 3 groupes, c'est le maximum.";
  if(/non autoris/i.test(m)) return "Tu n'es pas responsable de ce groupe.";
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
function userLabel(name,isAdmin,isOwner){
  const s=el("span","post-user","@"+(name||"?"));
  if(isAdmin) s.append(el("span","badge","Admin"));
  else if(isOwner) s.append(el("span","badge owner","Resp."));
  return s;
}
function avatar(name){
  const n=name||"?"; let h=0; for(const c of n) h=(h*31+c.charCodeAt(0))%360;
  const a=el("span","avatar",n.charAt(0)); a.style.background="hsl("+h+" 42% 42%)"; a.setAttribute("aria-hidden","true");
  return a;
}
const isOwner=(gid,uid)=>!!owners.get(gid)?.has(uid);
const canManage=gid=>!!me&&(me.is_admin||isOwner(gid,me.id));
const isManager=()=>!!me&&(me.is_admin||[...owners.values()].some(set=>set.has(me.id)));
const groupName=id=>{ const g=groups.find(x=>x.id===id); return g?g.name:"?"; };

// ---------- Navigation ----------
const VIEWS=["conseils","fil","carte","profil","admin"];
function route(){
  let v=VIEWS.includes(location.hash.slice(1))?location.hash.slice(1):"conseils";
  if(v==="admin"&&!isManager()) v="profil";
  VIEWS.forEach(n=>{ $("#v-"+n).hidden=n!==v; });
  $$("nav.tabs a").forEach(a=>a.setAttribute("aria-current",a.dataset.v===v?"page":"false"));
  if(v==="carte") openMap();
  if(v==="fil") loadFeed();
  if(v==="admin") loadAdmin();
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
    e.textContent=logged?"Tu n'es dans aucun groupe pour l'instant. Rejoins-en un avec son code dans l'onglet Profil."
      :"Connecte-toi dans l'onglet Profil pour voir le contenu de ton groupe.";
  });
  $$("[data-need-member]").forEach(e=>e.hidden=!member);
  $("#composer").hidden=!member||cur==="all";
  $("#composer-all").hidden=!(member&&cur==="all");
  $("#feed-bar").hidden=!member;
  $("#map-bar").hidden=!member;
  $("#map").hidden=!member;
  $("#auth").hidden=!configured||hasSession;
  $("#join").hidden=!(configured&&hasSession&&!me);
  $("#me").hidden=!logged;
  $("#my-groups").hidden=!logged;
  $("#tab-admin").hidden=!isManager();
  $("#tab-admin-label").textContent=me?.is_admin?"Admin":"Gestion";
  $("#create-group").hidden=!logged||!!me?.is_admin;
  const who=$("#who"); who.textContent="";
  if(me){ who.append(el("span","who-name","@"+me.username)); if(me.is_admin) who.append(el("span","badge","Admin")); else if(isManager()) who.append(el("span","badge owner","Resp.")); }
  if(me){ const h=$("#me-name"); h.textContent="@"+me.username; if(me.is_admin) h.append(el("span","badge","Admin")); }
  if(!member){ $("#feed").innerHTML=""; }
  renderGroupSelects();
  renderMyGroups();
  renderPush();
}

function renderGroupSelects(){
  $$(".grp-select").forEach(sel=>{
    sel.innerHTML="";
    if(me?.is_admin) sel.append(new Option("Tous les groupes","all"));
    groups.forEach(g=>sel.append(new Option(g.name+(g.region?" · "+g.region:""),String(g.id))));
    sel.value=String(cur);
  });
}
$$(".grp-select").forEach(sel=>sel.addEventListener("change",()=>{
  setGroup(sel.value==="all"?"all":Number(sel.value));
}));
function setGroup(v){
  cur=v;
  try{ localStorage.setItem("cdj-grp",String(v)); }catch(e){}
  refreshUI(); loadSpots(); loadFeed();
}

// ---------- Comptes ----------
let authMode="login";
$$("#auth-mode button").forEach(b=>b.addEventListener("click",()=>{
  authMode=b.dataset.m;
  $$("#auth-mode button").forEach(x=>x.setAttribute("aria-pressed",String(x===b)));
  const su=authMode==="signup";
  $("#auth-title").textContent=su?"Créer un compte":"Connexion";
  $("#a-submit").textContent=su?"Créer mon compte":"Se connecter";
  $("#a-code-wrap").hidden=!su; $("#a-code").required=su;
  $("#a-pass").autocomplete=su?"new-password":"current-password";
  showErr($("#a-err"));
}));

$("#auth-form").addEventListener("submit",async e=>{
  e.preventDefault(); if(!sb) return;
  const u=$("#a-user").value.trim(), p=$("#a-pass").value, code=$("#a-code").value.trim();
  const btn=$("#a-submit"); btn.disabled=true; showErr($("#a-err"));
  try{
    if(authMode==="signup"){
      const {data:g,error:ce}=await sb.rpc("check_invite",{p_code:code});
      if(ce) throw ce; if(!g||!g.length) throw new Error("code invalide");
      const {error}=await sb.auth.signUp({email:emailOf(u),password:p});
      if(error) throw error;
      const {error:je}=await sb.rpc("join_group",{p_code:code,p_username:u});
      if(je) throw je;
    }else{
      const {error}=await sb.auth.signInWithPassword({email:emailOf(u),password:p});
      if(error) throw error;
    }
    $("#a-pass").value="";
    await loadMe();
    if(me){ toast("Bienvenue @"+me.username+" !"); location.hash="#fil"; }
  }catch(err){ showErr($("#a-err"),frError(err)); }
  finally{ btn.disabled=false; }
});

$("#join").addEventListener("submit",async e=>{
  e.preventDefault(); showErr($("#j-err"));
  const {error}=await sb.rpc("join_group",{p_code:$("#j-code").value.trim(),p_username:$("#j-user").value.trim()});
  if(error) return showErr($("#j-err"),frError(error));
  await loadMe();
});

$("#join-more").addEventListener("submit",async e=>{
  e.preventDefault(); showErr($("#jm-err"));
  const {data:gid,error}=await sb.rpc("join_group",{p_code:$("#jm-code").value.trim()});
  if(error) return showErr($("#jm-err"),frError(error));
  $("#jm-code").value="";
  await loadGroups(); setGroup(gid); toast("Groupe rejoint : "+groupName(gid));
});

$("#logout").addEventListener("click",async()=>{
  try{ const sub=pushSupported()?await currentSub():null; if(sub) await sb.rpc("delete_push_sub",{p_endpoint:sub.endpoint}); }catch(e){}
  await sb.auth.signOut();
  me=null; hasSession=false; groups=[]; spots=[]; cur=null; if(layer) layer.clearLayers();
  refreshUI(); route();
});

async function loadMe(){
  const {data:{session}}=await sb.auth.getSession();
  hasSession=!!session;
  if(!session){ me=null; groups=[]; refreshUI(); return; }
  const {data}=await sb.from("profiles").select("id,username,is_admin").eq("id",session.user.id).maybeSingle();
  me=data||null;
  if(me){ await loadGroups(); loadSpots(); loadStats(); syncPush(); }
  refreshUI();
}

async function loadGroups(){
  let rows=[];
  if(me.is_admin){
    const {data}=await sb.rpc("admin_groups"); rows=data||[];
  }else{
    const {data}=await sb.from("groups").select("id,name,region").order("name"); rows=data||[];
  }
  groups=rows;
  owners=new Map();
  if(groups.length){
    const {data:os}=await sb.from("memberships").select("group_id,user_id").eq("role","owner").in("group_id",groups.map(g=>g.id));
    (os||[]).forEach(o=>{ if(!owners.has(o.group_id)) owners.set(o.group_id,new Set()); owners.get(o.group_id).add(o.user_id); });
  }
  let saved=null; try{ saved=localStorage.getItem("cdj-grp"); }catch(e){}
  const valid=v=>v==="all"?me.is_admin:groups.some(g=>String(g.id)===v);
  cur=saved&&valid(saved)?(saved==="all"?"all":Number(saved)):(me.is_admin?"all":(groups[0]?.id??null));
  refreshUI();
}

async function loadStats(){
  const [{count:pc},{count:sc}]=await Promise.all([
    sb.from("posts").select("id",{count:"exact",head:true}).eq("user_id",me.id),
    sb.from("spots").select("id",{count:"exact",head:true}).eq("user_id",me.id)]);
  $("#me-stats").textContent=(pc||0)+" prise"+(pc>1?"s":"")+" partagée"+(pc>1?"s":"")+" · "+(sc||0)+" spot"+(sc>1?"s":"");
}

function renderMyGroups(){
  const box=$("#my-groups-list"); if(!box) return; box.innerHTML="";
  if(!me) return;
  const mine=me.is_admin?null:groups;
  if(me.is_admin){ box.append(el("p","note","En tant qu'admin tu vois tous les groupes. Gère-les depuis l'onglet Admin.")); return; }
  if(!mine.length){ box.append(el("p","note","Aucun groupe pour l'instant.")); return; }
  mine.forEach(g=>{
    const r=el("div","mrow");
    const nm=el("span",null,g.name+(g.region?" · "+g.region:""));
    if(isOwner(g.id,me.id)) nm.append(el("span","badge owner","Resp."));
    r.append(nm);
    r.append(confirmBtn("Quitter","Confirmer",async()=>{
      await sb.from("memberships").delete().eq("group_id",g.id).eq("user_id",me.id);
      await loadGroups(); loadSpots(); loadFeed();
    }));
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
  box.hidden=!pics.length; $("#p-measure").hidden=!pics.length;
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

// ---------- Poids estimé (formules longueur-poids : poids en g = a × longueur en cm ^ b) ----------
const LW={"Brochet":[0.0045,3.1],"Sandre":[0.0055,3.12],"Perche":[0.0105,3.1],"Black-bass":[0.011,3.08],"Silure":[0.0045,3.1],"Carpe":[0.019,3.0]};
let wtTouched=false;
function estWeight(sp,len){ const k=LW[sp]; if(!k||!(len>0)) return null; return k[0]*Math.pow(len,k[1])/1000; }
const fmtKg=w=>w>=10?w.toFixed(1):w.toFixed(2);
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
    const {error}=await sb.from("posts").insert({group_id:cur,caption:cap||null,species:$("#p-species").value||null,photo_path:path,photo_paths:paths.length?paths:null,spot_id:spot,
      length_cm:len>0?Math.round(len*10)/10:null, weight_kg:wt>0?Math.round(wt*100)/100:null, bait:$("#p-bait").value.trim()||null});
    if(error){ if(paths.length) await sb.storage.from("photos").remove(paths); throw error; }
    pics.forEach(f=>URL.revokeObjectURL(f.url)); pics=[]; renderThumbs();
    $("#composer").reset(); $("#p-measure").hidden=true; $("#p-wt-note").hidden=true; wtTouched=false;
    toast("Prise partagée"); loadFeed(); loadStats();
  }catch(err){ showErr($("#p-err"),frError(err)); }
  finally{ btn.disabled=false; btn.textContent="Publier"; }
});
$("#feed-refresh").addEventListener("click",()=>loadFeed());

async function loadFeed(){
  if(!me||!groups.length||cur==null) return;
  const feed=$("#feed");
  let q=sb.from("posts")
    .select("id,group_id,caption,species,photo_path,photo_paths,created_at,user_id,length_cm,weight_kg,bait,profiles(username,is_admin),spots(id,name)")
    .order("created_at",{ascending:false}).limit(60);
  if(cur!=="all") q=q.eq("group_id",cur);
  const {data,error}=await q;
  feed.innerHTML="";
  if(error){ feed.append(el("p","err",frError(error))); return; }
  const allPaths=p=>(p.photo_paths&&p.photo_paths.length)?p.photo_paths:(p.photo_path?[p.photo_path]:[]);
  const paths=data.flatMap(allPaths);
  const urls={};
  if(paths.length){
    const {data:signed}=await sb.storage.from("photos").createSignedUrls(paths,3600);
    (signed||[]).forEach(s=>{ if(s.signedUrl) urls[s.path]=s.signedUrl; });
  }
  if(!data.length){ feed.append(el("div","empty","Aucune prise pour l'instant. Partage la première !")); return; }
  for(const p of data){
    const a=el("article","post");
    const head=el("div","post-head");
    const who=el("div","post-who");
    who.append(avatar(p.profiles?.username));
    const left=el("div"); left.append(userLabel(p.profiles?.username,p.profiles?.is_admin,isOwner(p.group_id,p.user_id)));
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
    if(p.user_id===me.id||canManage(p.group_id)){
      const lbl=p.user_id===me.id?"Supprimer":"Supprimer (modération)";
      foot.append(confirmBtn(lbl,"Confirmer la suppression",async()=>{
        const ph=allPaths(p); if(ph.length) await sb.storage.from("photos").remove(ph);
        const {error}=await sb.from("posts").delete().eq("id",p.id);
        if(error) return toast(frError(error));
        toast("Post supprimé"); loadFeed(); loadStats();
      }));
    }
    body.append(foot); a.append(body); feed.append(a);
  }
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
    map.on("click",ev=>startSpot(ev.latlng.lat,ev.latlng.lng));
    drawSpots();
  }
  setTimeout(()=>map.invalidateSize(),50);
}
window.addEventListener("cdj-pos",ev=>{ if(map&&!spots.length) map.setView([ev.detail.lat,ev.detail.lon],12); });
function pinIcon(mine){ return L.divIcon({className:"",html:'<div class="spot-pin'+(mine?" mine":"")+'"></div>',iconSize:[22,22],iconAnchor:[11,22],popupAnchor:[0,-22]}); }

async function loadSpots(){
  if(!me||cur==null){ spots=[]; drawSpots(); return; }
  let q=sb.from("spots").select("id,group_id,name,note,lat,lon,created_at,user_id,profiles(username,is_admin)").order("created_at",{ascending:false});
  if(cur!=="all") q=q.eq("group_id",cur);
  const {data}=await q;
  spots=data||[];
  const sel=$("#p-spot"), prev=sel.value;
  sel.innerHTML='<option value="">Aucun</option>';
  spots.forEach(s=>sel.append(new Option(s.name,s.id)));
  sel.value=prev;
  drawSpots();
}
function drawSpots(){
  if(!layer) return;
  layer.clearLayers();
  spots.forEach(s=>{
    const m=L.marker([s.lat,s.lon],{icon:pinIcon(s.user_id===me?.id)});
    const box=el("div");
    box.append(el("b",null,s.name));
    const by=el("div"); by.style.color="var(--muted)";
    by.append(userLabel(s.profiles?.username,s.profiles?.is_admin,isOwner(s.group_id,s.user_id))," · "+ago(s.created_at));
    box.append(by);
    if(cur==="all") box.append(el("div","post-group",groupName(s.group_id)));
    if(s.note){ const n=el("p",null,s.note); n.style.margin="6px 0"; n.style.whiteSpace="pre-wrap"; box.append(n); }
    const go=el("a",null,"Itinéraire"); go.href="https://www.google.com/maps/dir/?api=1&destination="+s.lat+","+s.lon; go.target="_blank"; go.rel="noopener";
    box.append(go);
    if(s.user_id===me?.id||canManage(s.group_id)){
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
  $("#s-name").focus();
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

// ---------- Administration ----------
async function loadAdmin(){
  if(!isManager()) return;
  $("#adm-intro").textContent=me.is_admin
    ?"Vue d'ensemble de tous les groupes. Tu peux modérer posts et spots directement depuis le Fil et la Carte en choisissant « Tous les groupes »."
    :"Les groupes dont tu es responsable. Tu peux y supprimer posts, photos et spots depuis le Fil et la Carte, retirer un membre et changer le code.";
  const {data,error}=await sb.rpc("manage_groups");
  const box=$("#adm-groups"); box.innerHTML="";
  if(error){ box.append(el("p","err",frError(error))); return; }
  const list=data||[];
  if(me.is_admin){ groups=list; renderGroupSelects(); }
  box.append(el("div","label",(me.is_admin?"Groupes":"Mes groupes")+" ("+list.length+")"));
  list.forEach(g=>{
    const c=el("div","gcard");
    const h=el("div","gcard-head");
    h.append(el("span","gcard-name",g.name+(g.region?" · "+g.region:"")));
    const pl=(n,w)=>n+" "+w+(n>1?"s":"");
    h.append(el("span","gcard-meta",pl(g.members,"membre")+" · "+pl(g.posts,"post")+" · "+pl(g.spots,"spot")));
    c.append(h);
    const code=el("div","note","Code : "); code.append(el("span","code",g.invite_code)); c.append(code);
    const act=el("div","actions");
    const bFeed=el("button","linkbtn","Voir le fil"); bFeed.type="button";
    bFeed.addEventListener("click",()=>{ setGroup(g.id); location.hash="#fil"; });
    const bMap=el("button","linkbtn","Voir la carte"); bMap.type="button";
    bMap.addEventListener("click",()=>{ setGroup(g.id); location.hash="#carte"; });
    const bMem=el("button","linkbtn","Membres"); bMem.type="button";
    bMem.addEventListener("click",()=>loadMembers(g));
    const bEdit=el("button","linkbtn","Modifier"); bEdit.type="button";
    bEdit.addEventListener("click",()=>{
      $("#g-id").value=g.id; $("#g-name").value=g.name; $("#g-region").value=g.region||""; $("#g-code").value=g.invite_code;
      $("#adm-form-title").textContent="Modifier « "+g.name+" »"; $("#g-submit").textContent="Enregistrer"; $("#g-cancel").hidden=false;
      $("#adm-form").scrollIntoView({behavior:"smooth"});
    });
    act.append(bFeed,bMap,bMem,bEdit); c.append(act);
    box.append(c);
  });
}
function resetGroupForm(){
  $("#adm-form").reset(); $("#g-id").value="";
  $("#adm-form-title").textContent="Nouveau groupe"; $("#g-submit").textContent="Créer le groupe"; $("#g-cancel").hidden=true;
  showErr($("#g-err"));
}
$("#g-cancel").addEventListener("click",resetGroupForm);
$("#adm-form").addEventListener("submit",async e=>{
  e.preventDefault(); showErr($("#g-err"));
  const id=$("#g-id").value?Number($("#g-id").value):null;
  const {error}=await sb.rpc("manage_save_group",{p_id:id,p_name:$("#g-name").value.trim(),p_region:$("#g-region").value.trim(),p_code:$("#g-code").value.trim()});
  if(error) return showErr($("#g-err"),frError(error));
  toast(id?"Groupe modifié":"Groupe créé"); resetGroupForm();
  if(!id) await loadGroups();
  loadAdmin();
});

// Création d'un groupe par un membre (il en devient responsable)
$("#create-group").addEventListener("submit",async e=>{
  e.preventDefault(); showErr($("#cg-err"));
  const {data:gid,error}=await sb.rpc("manage_save_group",{p_id:null,p_name:$("#cg-name").value.trim(),p_region:$("#cg-region").value.trim(),p_code:$("#cg-code").value.trim()});
  if(error) return showErr($("#cg-err"),frError(error));
  $("#create-group").reset();
  await loadGroups(); setGroup(gid);
  toast("Groupe créé : tu en es responsable");
  location.hash="#admin";
});
async function loadMembers(g){
  const panel=$("#adm-members"), list=$("#adm-members-list");
  panel.hidden=false; $("#adm-members-title").textContent="Membres de « "+g.name+" »"; list.innerHTML="";
  const {data,error}=await sb.rpc("manage_members",{p_group:g.id});
  if(error){ list.append(el("p","err",frError(error))); return; }
  if(!data.length) list.append(el("p","note","Aucun membre."));
  data.forEach(m=>{
    const r=el("div","mrow");
    const left=el("div"); left.append(userLabel(m.username,m.is_admin,m.role==="owner")); left.append(el("div","post-date","depuis le "+new Date(m.joined_at).toLocaleDateString("fr-FR")));
    r.append(left);
    if(m.user_id!==me.id&&(me.is_admin||(!m.is_admin&&m.role!=="owner"))){
      r.append(confirmBtn("Retirer du groupe","Confirmer",async()=>{
        const {error}=await sb.from("memberships").delete().eq("group_id",g.id).eq("user_id",m.user_id);
        if(error) return toast(frError(error));
        toast("@"+m.username+" retiré"); loadMembers(g); loadAdmin();
      }));
    }
    list.append(r);
  });
  panel.scrollIntoView({behavior:"smooth"});
}

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
    st.textContent="Les notifications sont bloquées pour l'appli. Autorise-les dans les réglages du téléphone (Paramètres → Applis → Chrome ou Coup du Jour → Notifications), puis reviens ici.";
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

// ---------- Démarrage ----------
async function init(){
  refreshUI(); route();
  if(!configured||typeof supabase==="undefined") return;
  sb=supabase.createClient(C.SUPABASE_URL,C.SUPABASE_KEY);
  sb.auth.onAuthStateChange(ev=>{ if(ev==="SIGNED_OUT"){ me=null; hasSession=false; groups=[]; refreshUI(); } });
  try{ await loadMe(); }catch(e){}
  route();
}
init();
})();
