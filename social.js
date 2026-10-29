/* Coup du Jour : navigation, comptes, groupes, fil photo, carte des spots, administration */
(function(){
const $=s=>document.querySelector(s);
const $$=s=>Array.from(document.querySelectorAll(s));
const C=window.CDJ_CONFIG||{};
const configured=typeof C.SUPABASE_URL==="string"&&C.SUPABASE_URL.startsWith("https://")&&C.SUPABASE_KEY&&!/COLLE/.test(C.SUPABASE_KEY);
const DOMAIN=C.EMAIL_DOMAIN||"coupdujour.app";
let sb=null, me=null, hasSession=false;
let groups=[], cur=null;            // cur : id de groupe ou "all" (admin)
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
function userLabel(name,isAdmin){
  const s=el("span","post-user","@"+(name||"?"));
  if(isAdmin) s.append(el("span","badge","Admin"));
  return s;
}
const groupName=id=>{ const g=groups.find(x=>x.id===id); return g?g.name:"?"; };

// ---------- Navigation ----------
const VIEWS=["conseils","fil","carte","profil","admin"];
function route(){
  let v=VIEWS.includes(location.hash.slice(1))?location.hash.slice(1):"conseils";
  if(v==="admin"&&!me?.is_admin) v="profil";
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
  $("#tab-admin").hidden=!me?.is_admin;
  const who=$("#who"); who.textContent="";
  if(me){ who.append("@"+me.username); if(me.is_admin) who.append(el("span","badge","Admin")); }
  if(me){ const h=$("#me-name"); h.textContent="@"+me.username; if(me.is_admin) h.append(el("span","badge","Admin")); }
  if(!member){ $("#feed").innerHTML=""; }
  renderGroupSelects();
  renderMyGroups();
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
  if(me){ await loadGroups(); loadSpots(); loadStats(); }
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
    r.append(el("span",null,g.name+(g.region?" · "+g.region:"")));
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
$("#p-photo").addEventListener("change",()=>{
  const f=$("#p-photo").files[0], pv=$("#p-preview");
  if(!f){ pv.hidden=true; return; }
  pv.src=URL.createObjectURL(f); pv.hidden=false;
});
$("#composer").addEventListener("submit",async e=>{
  e.preventDefault(); if(!me||cur==="all"||cur==null) return;
  const f=$("#p-photo").files[0], cap=$("#p-caption").value.trim();
  if(!f&&!cap) return showErr($("#p-err"),"Ajoute une photo ou une légende.");
  const btn=$("#p-submit"); btn.disabled=true; btn.textContent="Envoi…"; showErr($("#p-err"));
  try{
    let path=null;
    if(f){
      const blob=await compress(f);
      path=cur+"/"+me.id+"/"+Date.now()+".jpg";
      const {error}=await sb.storage.from("photos").upload(path,blob,{contentType:"image/jpeg"});
      if(error) throw error;
    }
    const spot=$("#p-spot").value?Number($("#p-spot").value):null;
    const {error}=await sb.from("posts").insert({group_id:cur,caption:cap||null,species:$("#p-species").value||null,photo_path:path,spot_id:spot});
    if(error) throw error;
    $("#composer").reset(); $("#p-preview").hidden=true;
    toast("Prise partagée"); loadFeed(); loadStats();
  }catch(err){ showErr($("#p-err"),frError(err)); }
  finally{ btn.disabled=false; btn.textContent="Publier"; }
});
$("#feed-refresh").addEventListener("click",()=>loadFeed());

async function loadFeed(){
  if(!me||!groups.length||cur==null) return;
  const feed=$("#feed");
  let q=sb.from("posts")
    .select("id,group_id,caption,species,photo_path,created_at,user_id,profiles(username,is_admin),spots(id,name)")
    .order("created_at",{ascending:false}).limit(60);
  if(cur!=="all") q=q.eq("group_id",cur);
  const {data,error}=await q;
  feed.innerHTML="";
  if(error){ feed.append(el("p","err",frError(error))); return; }
  const paths=data.map(p=>p.photo_path).filter(Boolean);
  const urls={};
  if(paths.length){
    const {data:signed}=await sb.storage.from("photos").createSignedUrls(paths,3600);
    (signed||[]).forEach(s=>{ if(s.signedUrl) urls[s.path]=s.signedUrl; });
  }
  if(!data.length){ feed.append(el("div","empty","Aucune prise pour l'instant. Partage la première !")); return; }
  for(const p of data){
    const a=el("article","post");
    const head=el("div","post-head");
    const left=el("div"); left.append(userLabel(p.profiles?.username,p.profiles?.is_admin));
    if(cur==="all") left.append(el("div","post-group",groupName(p.group_id)));
    head.append(left, el("span","post-date",ago(p.created_at)));
    a.append(head);
    if(p.photo_path&&urls[p.photo_path]){
      const img=el("img"); img.loading="lazy"; img.src=urls[p.photo_path];
      img.alt=p.species?("Prise : "+p.species):"Photo de prise"; a.append(img);
    }
    const body=el("div","post-body");
    if(p.species) body.append(el("span","tag",p.species));
    if(p.caption) body.append(el("p",null,p.caption));
    const foot=el("div","post-foot");
    if(p.spots){
      const b=el("button","linkbtn","📍 "+p.spots.name); b.type="button";
      b.addEventListener("click",()=>{ location.hash="#carte"; setTimeout(()=>focusSpot(p.spots.id),300); });
      foot.append(b);
    }else foot.append(el("span"));
    if(p.user_id===me.id||me.is_admin){
      const lbl=p.user_id===me.id?"Supprimer":"Supprimer (modération)";
      foot.append(confirmBtn(lbl,"Confirmer la suppression",async()=>{
        if(p.photo_path) await sb.storage.from("photos").remove([p.photo_path]);
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
    by.append(userLabel(s.profiles?.username,s.profiles?.is_admin)," · "+ago(s.created_at));
    box.append(by);
    if(cur==="all") box.append(el("div","post-group",groupName(s.group_id)));
    if(s.note){ const n=el("p",null,s.note); n.style.margin="6px 0"; n.style.whiteSpace="pre-wrap"; box.append(n); }
    const go=el("a",null,"Itinéraire"); go.href="https://www.google.com/maps/dir/?api=1&destination="+s.lat+","+s.lon; go.target="_blank"; go.rel="noopener";
    box.append(go);
    if(s.user_id===me?.id||me?.is_admin){
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
  if(!me?.is_admin) return;
  const {data,error}=await sb.rpc("admin_groups");
  const box=$("#adm-groups"); box.innerHTML="";
  if(error){ box.append(el("p","err",frError(error))); return; }
  groups=data||[]; renderGroupSelects();
  box.append(el("div","label","Groupes ("+groups.length+")"));
  groups.forEach(g=>{
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
  const {error}=await sb.rpc("admin_save_group",{p_id:id,p_name:$("#g-name").value.trim(),p_region:$("#g-region").value.trim(),p_code:$("#g-code").value.trim()});
  if(error) return showErr($("#g-err"),frError(error));
  toast(id?"Groupe modifié":"Groupe créé"); resetGroupForm(); loadAdmin();
});
async function loadMembers(g){
  const panel=$("#adm-members"), list=$("#adm-members-list");
  panel.hidden=false; $("#adm-members-title").textContent="Membres de « "+g.name+" »"; list.innerHTML="";
  const {data,error}=await sb.rpc("admin_members",{p_group:g.id});
  if(error){ list.append(el("p","err",frError(error))); return; }
  if(!data.length) list.append(el("p","note","Aucun membre."));
  data.forEach(m=>{
    const r=el("div","mrow");
    const left=el("div"); left.append(userLabel(m.username,m.is_admin)); left.append(el("div","post-date","depuis le "+new Date(m.joined_at).toLocaleDateString("fr-FR")));
    r.append(left);
    if(m.user_id!==me.id){
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
