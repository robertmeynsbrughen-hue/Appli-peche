/* Coup du Jour : navigation, comptes, fil photo, carte des spots */
(function(){
const $=s=>document.querySelector(s);
const $$=s=>Array.from(document.querySelectorAll(s));
const C=window.CDJ_CONFIG||{};
const configured=typeof C.SUPABASE_URL==="string"&&C.SUPABASE_URL.startsWith("https://")&&C.SUPABASE_KEY&&!/COLLE/.test(C.SUPABASE_KEY);
const DOMAIN=C.EMAIL_DOMAIN||"coupdujour.app";
let sb=null, me=null, hasSession=false;
let spots=[], map=null, layer=null, pending=null;

// ---------- Utilitaires ----------
function toast(t){
  const d=document.createElement("div"); d.className="toast"; d.textContent=t;
  document.body.append(d); setTimeout(()=>d.remove(),2800);
}
function showErr(el,t){ el.textContent=t||""; el.hidden=!t; }
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
  if(/duplicate key|profiles_username/i.test(m)) return "Ce nom d'utilisateur est déjà pris.";
  if(/Password should/i.test(m)) return "Mot de passe trop court (6 caractères minimum).";
  if(/Email not confirmed/i.test(m)) return "La confirmation d'e-mail est encore activée dans Supabase : désactive-la (voir le guide).";
  if(/Failed to fetch|NetworkError/i.test(m)) return "Pas de connexion réseau.";
  return m;
}

// ---------- Navigation ----------
const VIEWS=["conseils","fil","carte","profil"];
function route(){
  const v=VIEWS.includes(location.hash.slice(1))?location.hash.slice(1):"conseils";
  VIEWS.forEach(n=>{ $("#v-"+n).hidden=n!==v; });
  $$("nav.tabs a").forEach(a=>a.setAttribute("aria-current",a.dataset.v===v?"page":"false"));
  if(v==="carte") openMap();
  if(v==="fil"&&me) loadFeed();
  window.scrollTo(0,0);
}
window.addEventListener("hashchange",route);

// ---------- État d'affichage ----------
function refreshUI(){
  $$("[data-setup]").forEach(e=>e.hidden=configured);
  const logged=!!me;
  $$("[data-need-login]").forEach(e=>e.hidden=!configured||logged);
  $("#composer").hidden=!logged;
  $("#feed-bar").hidden=!logged;
  $("#map-bar").hidden=!logged;
  $("#map").hidden=!logged;
  $("#auth").hidden=!configured||hasSession;
  $("#join").hidden=!(configured&&hasSession&&!me);
  $("#me").hidden=!logged;
  $("#who").textContent=me?"@"+me.username:"";
  if(me){ $("#me-name").textContent="@"+me.username; }
  if(!logged){ $("#feed").innerHTML=""; }
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
      const {data:okCode,error:ce}=await sb.rpc("check_invite",{p_code:code});
      if(ce) throw ce; if(!okCode) throw new Error("code invalide");
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
  e.preventDefault();
  showErr($("#j-err"));
  const {error}=await sb.rpc("join_group",{p_code:$("#j-code").value.trim(),p_username:$("#j-user").value.trim()});
  if(error) return showErr($("#j-err"),frError(error));
  await loadMe();
});

$("#logout").addEventListener("click",async()=>{
  await sb.auth.signOut(); me=null; hasSession=false; spots=[]; if(layer) layer.clearLayers(); refreshUI();
});

async function loadMe(){
  const {data:{session}}=await sb.auth.getSession();
  hasSession=!!session;
  if(!session){ me=null; refreshUI(); return; }
  const {data}=await sb.from("profiles").select("id,username").eq("id",session.user.id).maybeSingle();
  me=data||null;
  refreshUI();
  if(me){ loadSpots(); loadStats(); }
}
async function loadStats(){
  const [{count:pc},{count:sc}]=await Promise.all([
    sb.from("posts").select("id",{count:"exact",head:true}).eq("user_id",me.id),
    sb.from("spots").select("id",{count:"exact",head:true}).eq("user_id",me.id)]);
  $("#me-stats").textContent=(pc||0)+" prise"+(pc>1?"s":"")+" partagée"+(pc>1?"s":"")+" · "+(sc||0)+" spot"+(sc>1?"s":"");
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
  e.preventDefault(); if(!me) return;
  const f=$("#p-photo").files[0], cap=$("#p-caption").value.trim();
  if(!f&&!cap) return showErr($("#p-err"),"Ajoute une photo ou une légende.");
  const btn=$("#p-submit"); btn.disabled=true; btn.textContent="Envoi…"; showErr($("#p-err"));
  try{
    let path=null;
    if(f){
      const blob=await compress(f);
      path=me.id+"/"+Date.now()+".jpg";
      const {error}=await sb.storage.from("photos").upload(path,blob,{contentType:"image/jpeg"});
      if(error) throw error;
    }
    const spot=$("#p-spot").value?Number($("#p-spot").value):null;
    const {error}=await sb.from("posts").insert({caption:cap||null,species:$("#p-species").value||null,photo_path:path,spot_id:spot});
    if(error) throw error;
    $("#composer").reset(); $("#p-preview").hidden=true;
    toast("Prise partagée"); loadFeed(); loadStats();
  }catch(err){ showErr($("#p-err"),frError(err)); }
  finally{ btn.disabled=false; btn.textContent="Publier"; }
});
$("#feed-refresh").addEventListener("click",()=>loadFeed());

async function loadFeed(){
  if(!me) return;
  const feed=$("#feed");
  const {data,error}=await sb.from("posts")
    .select("id,caption,species,photo_path,created_at,user_id,spot_id,profiles(username),spots(id,name)")
    .order("created_at",{ascending:false}).limit(60);
  if(error){ feed.innerHTML=""; const p=document.createElement("p"); p.className="err"; p.textContent=frError(error); feed.append(p); return; }
  const paths=data.map(p=>p.photo_path).filter(Boolean);
  const urls={};
  if(paths.length){
    const {data:signed}=await sb.storage.from("photos").createSignedUrls(paths,3600);
    (signed||[]).forEach(s=>{ if(s.signedUrl) urls[s.path]=s.signedUrl; });
  }
  feed.innerHTML="";
  if(!data.length){ const d=document.createElement("div"); d.className="empty"; d.textContent="Aucune prise pour l'instant. Partage la première !"; feed.append(d); return; }
  for(const p of data){
    const a=document.createElement("article"); a.className="post";
    const head=document.createElement("div"); head.className="post-head";
    const u=document.createElement("span"); u.className="post-user"; u.textContent="@"+(p.profiles?.username||"?");
    const dt=document.createElement("span"); dt.className="post-date"; dt.textContent=ago(p.created_at);
    head.append(u,dt); a.append(head);
    if(p.photo_path&&urls[p.photo_path]){
      const img=document.createElement("img"); img.loading="lazy"; img.src=urls[p.photo_path];
      img.alt=p.species?("Prise : "+p.species):"Photo de prise"; a.append(img);
    }
    const body=document.createElement("div"); body.className="post-body";
    if(p.species){ const t=document.createElement("span"); t.className="tag"; t.textContent=p.species; body.append(t); }
    if(p.caption){ const c=document.createElement("p"); c.textContent=p.caption; body.append(c); }
    const foot=document.createElement("div"); foot.className="post-foot";
    if(p.spots){
      const b=document.createElement("button"); b.type="button"; b.className="linkbtn"; b.textContent="📍 "+p.spots.name;
      b.addEventListener("click",()=>{ location.hash="#carte"; setTimeout(()=>focusSpot(p.spots.id),300); });
      foot.append(b);
    }else foot.append(document.createElement("span"));
    if(p.user_id===me.id){
      const del=document.createElement("button"); del.type="button"; del.className="linkbtn danger"; del.textContent="Supprimer";
      del.addEventListener("click",async()=>{
        if(del.dataset.confirm!=="1"){ del.dataset.confirm="1"; del.textContent="Confirmer la suppression"; return; }
        if(p.photo_path) await sb.storage.from("photos").remove([p.photo_path]);
        await sb.from("posts").delete().eq("id",p.id); loadFeed(); loadStats();
      });
      foot.append(del);
    }
    body.append(foot); a.append(body); feed.append(a);
  }
}

// ---------- Carte ----------
function openMap(){
  if(!me||typeof L==="undefined") return;
  if(!map){
    const pos=window.CDJ_POS;
    map=L.map("map",{zoomControl:true}).setView(pos?[pos.lat,pos.lon]:[46.6,2.4],pos?12:6);
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
  const {data}=await sb.from("spots").select("id,name,note,lat,lon,created_at,user_id,profiles(username)").order("created_at",{ascending:false});
  spots=data||[];
  const sel=$("#p-spot"), cur=sel.value;
  sel.innerHTML='<option value="">Aucun</option>';
  spots.forEach(s=>{ const o=document.createElement("option"); o.value=s.id; o.textContent=s.name; sel.append(o); });
  sel.value=cur;
  drawSpots();
}
const markers={};
function drawSpots(){
  if(!layer) return;
  layer.clearLayers();
  spots.forEach(s=>{
    const m=L.marker([s.lat,s.lon],{icon:pinIcon(s.user_id===me?.id)});
    const box=document.createElement("div");
    const b=document.createElement("b"); b.textContent=s.name; box.append(b);
    const by=document.createElement("div"); by.style.color="var(--muted)"; by.textContent="par @"+(s.profiles?.username||"?")+" · "+ago(s.created_at); box.append(by);
    if(s.note){ const n=document.createElement("p"); n.style.margin="6px 0"; n.style.whiteSpace="pre-wrap"; n.textContent=s.note; box.append(n); }
    const go=document.createElement("a"); go.href="https://www.google.com/maps/dir/?api=1&destination="+s.lat+","+s.lon; go.target="_blank"; go.rel="noopener"; go.textContent="Itinéraire";
    box.append(go);
    if(s.user_id===me?.id){
      const del=document.createElement("button"); del.type="button"; del.className="linkbtn danger"; del.style.marginLeft="12px"; del.textContent="Supprimer";
      del.addEventListener("click",async()=>{
        if(del.dataset.confirm!=="1"){ del.dataset.confirm="1"; del.textContent="Confirmer"; return; }
        await sb.from("spots").delete().eq("id",s.id); map.closePopup(); loadSpots(); loadStats();
      });
      box.append(del);
    }
    m.bindPopup(box); m.addTo(layer); markers[s.id]=m;
  });
}
function focusSpot(id){
  const s=spots.find(x=>x.id===id); if(!s||!map) return;
  map.setView([s.lat,s.lon],15); markers[id]?.openPopup();
}
function startSpot(lat,lon){
  pending={lat,lon};
  $("#spot-coords").textContent="Position : "+lat.toFixed(5)+", "+lon.toFixed(5);
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
  e.preventDefault(); if(!pending) return;
  const {error}=await sb.from("spots").insert({name:$("#s-name").value.trim(),note:$("#s-note").value.trim()||null,lat:pending.lat,lon:pending.lon});
  if(error) return showErr($("#s-err"),frError(error));
  $("#spot-form").reset(); $("#spot-form").hidden=true; pending=null;
  toast("Spot enregistré"); loadSpots(); loadStats();
});

// ---------- Démarrage ----------
async function init(){
  refreshUI(); route();
  if(!configured||typeof supabase==="undefined") return;
  sb=supabase.createClient(C.SUPABASE_URL,C.SUPABASE_KEY);
  sb.auth.onAuthStateChange((ev)=>{ if(ev==="SIGNED_OUT"){ me=null; hasSession=false; refreshUI(); } });
  try{ await loadMe(); }catch(e){}
  route();
}
init();
})();
