// Rivio : profil public des membres (photo, bio, espèces favorites, stats).
(function(){
"use strict";
const A=window.CDJ; if(!A) return;
const {el,toast,frError,userLabel}=A;
const $=s=>document.querySelector(s);
const fmt=n=>Number(n).toLocaleString("fr-FR");
function btn(label,cls,fn){ const b=el("button",cls||"btn",label); b.type="button"; if(fn) b.addEventListener("click",fn); return b; }
const FAV=["Brochet","Sandre","Perche","Black-bass","Silure","Carpe","Chevesne","Truite fario","Barbeau","Tanche","Aspe"];
const pubUrl=path=>path?A.sb.storage.from("avatars").getPublicUrl(path).data.publicUrl:null;

/* ---------- Photos de profil partout dans l'appli ---------- */
window.CDJ_AVATARS=window.CDJ_AVATARS||{};
async function loadAvatars(force){
  if(!A.me) return;
  let data=null;
  try{ const c=JSON.parse(localStorage.getItem("cdj-avatars")||"null"); if(!force&&c&&Date.now()-c.t<36e5) data=c.d; }catch(_){}
  if(!data){ const r=await A.sb.from("profiles").select("username,avatar_path").not("avatar_path","is",null).limit(1000); data=r.data||[]; try{ localStorage.setItem("cdj-avatars",JSON.stringify({t:Date.now(),d:data})); }catch(_){} }
  (data||[]).forEach(p=>{ window.CDJ_AVATARS[p.username]=pubUrl(p.avatar_path); });
  upgradeAvatars();
}
function upgradeAvatars(root){
  (root||document).querySelectorAll(".avatar[data-name]:not(.has-img)").forEach(a=>{
    const u=window.CDJ_AVATARS[a.dataset.name]; if(!u) return;
    a.classList.add("has-img"); a.textContent=""; const i=el("img"); i.src=u; i.alt=""; i.loading="lazy"; a.append(i);
  });
}
new MutationObserver(()=>upgradeAvatars()).observe(document.body,{childList:true,subtree:true});

/* ---------- Fiche profil (au toucher d'un pseudo) ---------- */
let sheet=null;
function close(){ if(sheet){ sheet.remove(); sheet=null; document.removeEventListener("keydown",esc,true); } }
function esc(e){ if(e.key==="Escape"&&sheet){ e.stopPropagation(); close(); } }
function bigAvatar(name,url){
  const a=el("span","avatar big"); a.dataset.name=name;
  if(url){ a.classList.add("has-img"); const i=el("img"); i.src=url; i.alt="Photo de @"+name; a.append(i); }
  else{ let h=0; for(const c of name) h=(h*31+c.charCodeAt(0))%360; a.style.background="hsl("+h+" 42% 42%)"; a.textContent=name.charAt(0); }
  return a;
}
async function openProfile(username){
  if(!A.me||!username) return;
  close();
  sheet=el("div","sheet-back pf-back");
  const sh=el("div","sheet pf-sheet"); sh.setAttribute("role","dialog"); sh.setAttribute("aria-modal","true"); sh.setAttribute("aria-label","Profil de @"+username);
  const head=el("div","sheet-head"); head.append(el("span","label","Profil"));
  const x=btn("","icon-btn",close); x.setAttribute("aria-label","Fermer"); x.innerHTML='<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  head.append(x); sh.append(head, el("p","note","Chargement…"));
  sheet.append(sh); document.body.append(sheet);
  sheet.addEventListener("click",e=>{ if(e.target===sheet) close(); });
  document.addEventListener("keydown",esc,true);

  const {data:p}=await A.sb.from("profiles").select("id,username,is_admin,bio,fav_species,avatar_path,created_at").eq("username",username).maybeSingle();
  if(!sheet||!sh.isConnected) return;
  sh.lastChild.remove();
  if(!p){ sh.append(el("p","note","Profil introuvable.")); return; }
  const [{data:po},{data:se},{data:cs}]=await Promise.all([
    A.sb.from("posts").select("group_id,species,length_cm,weight_kg,created_at").eq("user_id",p.id).eq("status","published").limit(2000),
    A.sb.from("sessions").select("group_id,species,caught,length_cm,created_at").eq("user_id",p.id).limit(2000),
    A.sb.from("carp_sessions").select("id,group_id,started_at,carp_events(kind,at,weight_kg)").eq("user_id",p.id).limit(500),
  ]);
  if(!sh.isConnected) return;
  const D=A.dex;
  const rows=[...(po||[]).filter(x=>x.species).map(x=>({...x,kind:"post"})),...(se||[]).filter(x=>x.caught!==false&&x.species)];
  const found=D?D.collect(rows):new Map();
  const troph=D?D.trophiesOf(rows,cs||[],se||[],found):[];
  const carpN=(cs||[]).reduce((a,c)=>a+(c.carp_events||[]).filter(e=>e.kind==="prise").length,0);
  const total=rows.length+carpN;

  const top=el("div","pf-top");
  top.append(bigAvatar(p.username,pubUrl(p.avatar_path)));
  const t=el("div","pf-id"); const h=el("h2",null,""); h.append(userLabel(p.username,p.is_admin)); t.append(h);
  t.append(el("div","note","Membre depuis "+new Date(p.created_at).toLocaleDateString("fr-FR",{month:"long",year:"numeric"})));
  top.append(t); sh.append(top);
  if(p.bio) sh.append(el("p","pf-bio",p.bio));
  if(p.fav_species?.length){ const c=el("div","chips"); c.append(el("span","note","Espèces favorites :")); p.fav_species.forEach(s=>c.append(el("span","tag",s))); sh.append(c); }

  const k=el("div","kpis pf-kpis");
  const kpi=(v,l)=>{ const d=el("div","kpi"); d.append(el("div","kpi-v",v),el("div","kpi-l",l)); k.append(d); };
  kpi(String(total),"prise"+(total>1?"s":""));
  kpi(found.size+"/"+(D?.DEX.length||18),"espèces");
  kpi(String(troph.length),"trophée"+(troph.length>1?"s":""));
  sh.append(k);

  // records par espèce
  const rec=new Map();
  rows.filter(r=>r.length_cm).forEach(r=>{ const e=D?.entryOf(r.species); const n=e?e.name:r.species; const b=rec.get(n); if(!b||Number(r.length_cm)>Number(b.length_cm)) rec.set(n,r); });
  if(rec.size){
    sh.append(el("h4","g-sub","Records"));
    const g=el("div","records");
    [...rec.entries()].sort((a,b)=>b[1].length_cm-a[1].length_cm).slice(0,6).forEach(([n,r])=>{
      const c=el("div","record"); c.append(el("span","record-sp",n),el("span","record-v",fmt(r.length_cm)),el("span","record-u","cm"+(r.weight_kg?" · "+fmt(r.weight_kg)+" kg":"")));
      g.append(c);
    });
    sh.append(g);
  }
  const last=rows.slice().sort((a,b)=>new Date(b.created_at)-new Date(a.created_at))[0];
  if(last) sh.append(el("p","note","Dernière prise : "+[last.species,last.length_cm?fmt(last.length_cm)+" cm":null].filter(Boolean).join(" ")+" le "+new Date(last.created_at).toLocaleDateString("fr-FR",{day:"numeric",month:"long"})));

  if(D){
    const det=el("details","pf-more");
    const sm=el("summary"); sm.append(el("span",null,"Fishdex et trophées"),el("span","dex-count",found.size+"/"+D.DEX.length+" · 🏆 "+troph.length)); det.append(sm);
    det.addEventListener("toggle",()=>{ if(det.open&&det.childElementCount===1){ det.append(D.progress(found),D.grid(found,p.id===A.me.id?null:"@"+p.username),el("h4","g-sub","Trophées"),D.trophyGrid(troph)); } },{});
    sh.append(det);
  }
  if(p.id===A.me.id) sh.append(btn("✏️ Modifier mon profil","btn",()=>{ close(); location.hash="#profil"; setTimeout(()=>$("#pub-profile")?.scrollIntoView({behavior:"smooth"}),300); }));
}
// toucher un pseudo n'importe où (sauf dans un bouton qui a déjà son action)
document.addEventListener("click",e=>{
  const u=e.target.closest("[data-user]"); if(!u||!u.dataset.user) return;
  if(u.closest("button,a,.pf-sheet .pf-id,.story-view .sv-info")) return;
  e.preventDefault(); openProfile(u.dataset.user);
});
document.addEventListener("keydown",e=>{
  if(e.key!=="Enter"&&e.key!==" ") return;
  const u=e.target.closest?.("[data-user]"); if(!u||!u.dataset.user||u.closest("button,a")) return;
  e.preventDefault(); openProfile(u.dataset.user);
});

/* ---------- Mon profil public (onglet Profil) ---------- */
let mine=null, seq=0;
async function squareJpeg(file,size=320){
  const img=await new Promise((res,rej)=>{ const i=new Image(); i.onload=()=>res(i); i.onerror=rej; i.src=URL.createObjectURL(file); });
  const s=Math.min(img.naturalWidth,img.naturalHeight), c=document.createElement("canvas"); c.width=c.height=size;
  c.getContext("2d").drawImage(img,(img.naturalWidth-s)/2,(img.naturalHeight-s)/2,s,s,0,0,size,size);
  URL.revokeObjectURL(img.src);
  return new Promise(r=>c.toBlob(r,"image/jpeg",.85));
}
async function loadMine(){
  const box=$("#pub-profile"); if(!box) return;
  if(!A.me){ box.hidden=true; return; }
  box.hidden=false;
  const s=++seq;
  const {data}=await A.sb.from("profiles").select("username,bio,fav_species,avatar_path").eq("id",A.me.id).maybeSingle();
  if(s!==seq) return;
  mine={bio:data?.bio||"",fav:data?.fav_species||[],avatar:data?.avatar_path||null,file:null,preview:null};
  draw();
}
function draw(){
  const box=$("#pub-profile"); box.innerHTML="";
  const h=el("div","g-sec-head"); h.append(el("h2",null,"Mon profil public")); box.append(h);
  const top=el("div","pf-edit-top");
  top.append(bigAvatar(A.me.username,mine.preview||pubUrl(mine.avatar)));
  const pick=el("input"); pick.type="file"; pick.accept="image/*"; pick.hidden=true;
  pick.addEventListener("change",()=>{ const f=pick.files?.[0]; if(!f) return; mine.file=f; mine.preview&&URL.revokeObjectURL(mine.preview); mine.preview=URL.createObjectURL(f); draw(); });
  const col=el("div","pf-edit-btns");
  col.append(btn(mine.avatar||mine.preview?"Changer la photo":"Ajouter une photo","btn small",()=>pick.click()));
  if(mine.avatar||mine.preview) col.append(btn("Retirer","linkbtn danger",()=>{ mine.file=null; mine.preview=null; mine.avatar=null; draw(); }));
  top.append(col,pick); box.append(top);
  const bl=el("label","field","Bio"); const bi=el("textarea"); bi.maxLength=160; bi.placeholder="Pêcheur de carnassiers en float-tube, Lot-et-Garonne"; bi.value=mine.bio;
  const cnt=el("span","note",bi.value.length+"/160"); bi.addEventListener("input",()=>{ mine.bio=bi.value; cnt.textContent=bi.value.length+"/160"; });
  bl.append(bi,cnt); box.append(bl);
  const fl=el("div","field"); fl.append("Espèces favorites (3 maximum)");
  const chips=el("div","chips-pick");
  FAV.forEach(sp=>{ const on=mine.fav.includes(sp); const c=btn(sp,"pick"+(on?" on":""),()=>{
    if(on) mine.fav=mine.fav.filter(x=>x!==sp); else{ if(mine.fav.length>=3) return toast("3 espèces maximum"); mine.fav=[...mine.fav,sp]; }
    draw();
  }); c.setAttribute("aria-pressed",String(on)); chips.append(c); });
  fl.append(chips); box.append(fl);
  const act=el("div","actions");
  const save=btn("Enregistrer","btn primary",async()=>{
    save.disabled=true;
    try{
      let path=mine.avatar;
      if(mine.file){
        const blob=await squareJpeg(mine.file);
        path=A.me.id+"/avatar-"+Date.now()+".jpg";
        const up=await A.sb.storage.from("avatars").upload(path,blob,{contentType:"image/jpeg"});
        if(up.error) throw up.error;
      }
      const old=(await A.sb.from("profiles").select("avatar_path").eq("id",A.me.id).maybeSingle()).data?.avatar_path;
      const {error}=await A.sb.rpc("update_my_profile",{p_bio:mine.bio.trim()||null,p_fav:mine.fav,p_avatar:path});
      if(!error) try{ localStorage.removeItem("cdj-avatars"); if(A.me) A.me.fav_species=mine.fav; localStorage.setItem("cdj-fav",JSON.stringify(mine.fav||[])); window.dispatchEvent(new Event("cdj-fav")); }catch(_){}
      if(error) throw error;
      if(old&&old!==path) await A.sb.storage.from("avatars").remove([old]);
      mine.avatar=path; mine.file=null; if(mine.preview){ URL.revokeObjectURL(mine.preview); mine.preview=null; }
      if(path) window.CDJ_AVATARS[A.me.username]=pubUrl(path); else delete window.CDJ_AVATARS[A.me.username];
      document.querySelectorAll('.avatar[data-name="'+CSS.escape(A.me.username)+'"]').forEach(a=>{ a.classList.remove("has-img"); });
      upgradeAvatars();
      toast("Profil enregistré"); draw();
    }catch(e){ toast(frError(e)); }
    finally{ save.disabled=false; }
  });
  act.append(save, btn("Voir mon profil","btn",()=>openProfile(A.me.username)));
  box.append(act);
}

const prevProfil=A.hooks.profil;
A.hooks.profil=()=>{ prevProfil?.(); loadMine(); };
const prevChange=A.hooks.change;
let loaded=false;
A.hooks.change=()=>{ prevChange?.(); if(A.me&&!loaded){ loaded=true; loadAvatars(); } if(!A.me){ loaded=false; mine=null; const b=$("#pub-profile"); if(b) b.hidden=true; } };
A.openProfile=openProfile;
if(A.me){ loaded=true; loadAvatars(); if(!$("#v-profil").hidden) loadMine(); }
/* ---------- Onglet Modération (Admin / Contrôleur) ---------- */
function loadModeration(){
  const box=$("#moderation-content"); if(!box) return;
  if(!A.me||!(A.me.is_admin||A.me.is_controller)){ box.innerHTML="<p class='note'>Accès réservé aux administrateurs et contrôleurs.</p>"; return; }
  box.innerHTML="<p class='note'>Chargement…</p>";
  A.sb.rpc("manage_groups").then(({data,error})=>{
    if(box!==$("#moderation-content")) return;
    if(error) return box.innerHTML="<p class='err'>"+frError(error)+"</p>";
    if(!data?.length){ box.innerHTML="<p class='note'>Aucun groupe.</p>"; return; }
    box.innerHTML="";
    const selWrap=el("div","field"); selWrap.append(el("span","label","Groupe :"));
    const select=el("select"); select.style.maxWidth="320px";
    select.append(new Option("— Choisir un groupe —",""));
    data.forEach(g=>select.append(new Option(g.name+" ("+(g.region||"")+")",g.id)));
    selWrap.append(select);
    box.append(selWrap);

    const delDiv=el("div");
    const memDiv=el("div");

    const s1=el("div","panel"); s1.append(el("h3","g-sub","Supprimer le groupe"), delDiv);
    const s2=el("div","panel"); s2.append(el("h3","g-sub","Membres du groupe"), memDiv);
    box.append(s1, s2);

    function updateSection(){
      const val=select.value;
      if(!val){
        delDiv.innerHTML="<p class='note'>Sélectionnez un groupe ci-dessus.</p>";
        memDiv.innerHTML="<p class='note'>Sélectionnez un groupe ci-dessus.</p>";
        return;
      }
      const g=data.find(x=>String(x.id)===val);
      if(g){
        delDiv.innerHTML="<p class='note warn'>⚠️ Suppression définitive de <b>"+g.name+"</b> et de toutes ses données.</p>"+'<input id="mod-del-confirm" class="field" type="text" placeholder="Tapez le nom du groupe pour confirmer">'+'<div class="actions" style="margin-top:8px"><button class="btn danger" id="mod-del-btn">Supprimer le groupe</button></div>';
        delDiv.querySelector("#mod-del-btn")?.addEventListener("click",async()=>{
          const inp=delDiv.querySelector("#mod-del-confirm");
          if(inp.value!==g.name) return toast("Tapez exactement le nom du groupe ("+g.name+")");
          const {error}=await A.sb.rpc("delete_group",{p_group:Number(val),p_confirmation:g.name});
          if(error) return toast(frError(error));
          toast("Groupe supprimé"); loadModeration();
        });
      }
      memDiv.innerHTML="<p class='note'>Chargement des membres…</p>";
      A.sb.rpc("manage_members",{p_group:Number(val)}).then(({data:mem,error})=>{
        if(select.value!==val) return;
        if(error) return memDiv.innerHTML="<p class='err'>"+frError(error)+"</p>";
        if(!mem?.length){ memDiv.innerHTML="<p class='note'>Aucun membre.</p>"; return; }
        memDiv.innerHTML="";
        const list=el("div","list tight");
        mem.forEach(m=>{
          const row=el("div","mrow");
          row.append(A.userLabel(m.username,m.is_admin));
          const badges=el("div","chips");
          if(m.role==="owner") badges.append(el("span","chip","Responsable"));
          else if(m.role==="moderator") badges.append(el("span","chip","Modérateur"));
          else badges.append(el("span","chip","Membre"));
          if(m.status==="pending") badges.append(el("span","chip minus","En attente"));
          row.append(badges);
          const act=el("div","actions");
          if(m.status==="pending"&&A.me.is_admin) act.append(btn("Valider","btn small",async()=>{ await A.sb.rpc("approve_member",{p_group:Number(val),p_user:m.user_id}); updateSection(); }));
          if(A.me.is_admin||m.role!=="owner") act.append(btn(m.role==="owner"?"Retirer responsable":"Mettre modérateur","btn small",async()=>{
            const role=m.role==="owner"?"member":"moderator";
            await A.sb.rpc("set_member_role",{p_group:Number(val),p_user:m.user_id,p_role:role});
            updateSection();
          }));
          if(A.me.is_admin) act.append(btn("Exclure","linkbtn danger",async()=>{ await A.sb.from("memberships").delete().eq("group_id",val).eq("user_id",m.user_id); updateSection(); }));
          row.append(act); list.append(row);
        });
        memDiv.append(list);
      });
    }
    select.addEventListener("change",updateSection);
    updateSection();
  });
}
const prevProfil2=A.hooks.profil;
A.hooks.profil=()=>{ prevProfil2?.(); loadMine(); if(A.me?.is_admin||A.me?.is_controller) loadModeration(); };
})();
