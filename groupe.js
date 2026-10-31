/* Rivio : vie du groupe — bilan rapide, mémos, sondages, statistiques, gestion, chat */
(function(){
const A=window.CDJ; if(!A) return;
const {el,toast,showErr,ago,frError,confirmBtn,userLabel,roleBadge,avatar}=A;
const $=s=>document.querySelector(s);
const root=$("#groupe-root");
let lastGroup;
const isMember=()=>!!A.me&&A.cur!=null&&A.cur!=="all"&&A.myRoles.has(A.cur);
const canChat=()=>!!A.me&&A.cur!=null&&A.cur!=="all"&&(A.myRoles.has(A.cur)||A.me.is_admin||A.me.is_controller);
const chatVisible=()=>!!A.me&&((A.me.is_admin||A.me.is_controller)||A.groups.length>0&&canChat());
const store={ get(k,d){ try{ const v=localStorage.getItem(k); return v==null?d:JSON.parse(v); }catch(e){ return d; } },
              set(k,v){ try{ localStorage.setItem(k,JSON.stringify(v)); }catch(e){} } };
const waterType=()=>{ try{ const w=localStorage.getItem("cdj-water"); return ["etang","riviere","canal"].includes(w)?w:null; }catch(e){ return null; } };
const fmtDate=iso=>new Date(iso).toLocaleString("fr-FR",{weekday:"short",day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"});
const MAXM=20;   // limite de membres par groupe (appliquée aussi côté base)
function section(title,extra){
  const s=el("section","g-sec"); const h=el("div","g-sec-head"); h.append(el("h2",null,title)); if(extra) h.append(extra);
  s.append(h); return s;
}
function btn(label,cls,fn){ const b=el("button",cls||"btn",label); b.type="button"; if(fn) b.addEventListener("click",fn); return b; }
async function signed(paths){
  const urls={}; if(!paths.length) return urls;
  const {data}=await A.sb.storage.from("photos").createSignedUrls(paths,3600);
  (data||[]).forEach(s=>{ if(s.signedUrl) urls[s.path]=s.signedUrl; }); return urls;
}

function askGroupName(g,title,explanation){
  return new Promise(resolve=>{
    const back=el("div","sheet-back group-confirm-back");
    const box=el("div","sheet group-confirm");
    const id="group-confirm-"+Date.now();
    box.setAttribute("role","dialog"); box.setAttribute("aria-modal","true"); box.setAttribute("aria-labelledby",id);
    const heading=el("h2",null,title); heading.id=id; box.append(heading,el("p","note",explanation));
    const form=el("form");
    const label=el("label","field","Nom exact du groupe : "+g.name);
    const input=el("input"); input.autocomplete="off"; input.maxLength=40; input.required=true; input.setAttribute("aria-label","Saisis le nom exact du groupe");
    label.append(input); form.append(label);
    const actions=el("div","actions");
    const cancel=btn("Annuler","btn",()=>finish(null));
    const submit=btn("Confirmer","btn danger",null); submit.type="submit"; submit.disabled=true;
    actions.append(cancel,submit); form.append(actions); box.append(form); back.append(box);
    const key=e=>{ if(e.key==="Escape") finish(null); };
    const finish=value=>{ document.removeEventListener("keydown",key); back.remove(); resolve(value); };
    input.addEventListener("input",()=>{ submit.disabled=input.value!==g.name; });
    form.addEventListener("submit",e=>{ e.preventDefault(); if(input.value===g.name) finish(input.value); });
    back.addEventListener("click",e=>{ if(e.target===back) finish(null); });
    document.addEventListener("keydown",key); document.body.append(back); input.focus();
  });
}

function chooseSuccessor(g,candidates){
  return new Promise(resolve=>{
    const back=el("div","sheet-back group-confirm-back"), box=el("div","sheet group-confirm");
    const id="group-successor-"+Date.now();
    box.setAttribute("role","dialog"); box.setAttribute("aria-modal","true"); box.setAttribute("aria-labelledby",id);
    const heading=el("h2",null,"Transmettre la responsabilité"); heading.id=id;
    box.append(heading,el("p","note","Choisis un membre actif de « "+g.name+" ». La transmission et ton départ seront faits ensemble."));
    const form=el("form"), label=el("label","field","Nouveau responsable");
    const select=el("select"); select.required=true; select.setAttribute("aria-labelledby",id);
    select.append(new Option("Choisir un membre…",""));
    candidates.forEach(m=>select.append(new Option("@"+(m.profiles?.username||"membre"),m.user_id)));
    label.append(select); form.append(label);
    const actions=el("div","actions"), cancel=btn("Annuler","btn",()=>finish(null));
    const submit=btn("Quitter et transmettre","btn primary",null); submit.type="submit"; submit.disabled=true;
    select.addEventListener("change",()=>{ submit.disabled=!select.value; });
    actions.append(cancel,submit); form.append(actions); box.append(form); back.append(box);
    const key=e=>{ if(e.key==="Escape") finish(null); };
    const finish=value=>{ document.removeEventListener("keydown",key); back.remove(); resolve(value); };
    form.addEventListener("submit",e=>{ e.preventDefault(); if(select.value) finish(select.value); });
    back.addEventListener("click",e=>{ if(e.target===back) finish(null); });
    document.addEventListener("keydown",key); document.body.append(back); select.focus();
  });
}

const GROUP_CLEANUP_KEY="cdj-group-photo-cleanups";
const groupCleanupRuns=new Map();
function pendingGroupCleanup(){ const q=store.get(GROUP_CLEANUP_KEY,[]); return Array.isArray(q)?q.map(String):[]; }
function queueGroupCleanup(gid){ const q=pendingGroupCleanup(); if(!q.includes(String(gid))) q.push(String(gid)); store.set(GROUP_CLEANUP_KEY,q); }
function finishGroupCleanupQueue(gid){ store.set(GROUP_CLEANUP_KEY,pendingGroupCleanup().filter(x=>x!==String(gid))); }
async function groupPhotoPaths(gid){
  const files=[], storage=A.sb.storage.from("photos");
  async function walk(prefix){
    let offset=0;
    while(true){
      const {data,error}=await storage.list(prefix,{limit:100,offset});
      if(error) throw error;
      const rows=data||[];
      for(const item of rows){
        if(!item.name) continue;
        const path=prefix+"/"+item.name;
        if(item.id==null&&!item.metadata) await walk(path);
        else files.push(path);
      }
      if(rows.length<100) break;
      offset+=rows.length;
    }
  }
  await walk(String(gid)); return files;
}
function cleanupDeletedGroup(gid){
  const key=String(gid), existing=groupCleanupRuns.get(key);
  if(existing) return existing;
  const run=(async()=>{
    const paths=await groupPhotoPaths(gid), storage=A.sb.storage.from("photos");
    for(let i=0;i<paths.length;i+=100){
      const {error}=await storage.remove(paths.slice(i,i+100));
      if(error) throw error;
    }
    const {error}=await A.sb.rpc("finish_group_delete_cleanup",{p_group:Number(gid)});
    if(error) throw error;
    finishGroupCleanupQueue(gid);
  })();
  groupCleanupRuns.set(key,run);
  return run.finally(()=>groupCleanupRuns.delete(key));
}
async function retryGroupPhotoCleanups(){
  if(!A.me||!navigator.onLine) return;
  for(const gid of pendingGroupCleanup()){
    try{ await cleanupDeletedGroup(gid); }
    catch(_){ /* Le droit de nettoyage temporaire permet un nouvel essai plus tard. */ }
  }
}
async function removeGroup(g,givenName){
  if(!navigator.onLine) return toast("Connecte-toi à Internet avant de supprimer ce groupe.");
  const confirmation=givenName??await askGroupName(g,"Supprimer le groupe ?","Cette action est définitive : les publications, adhésions et invitations du groupe seront supprimées.");
  if(confirmation==null) return;
  const {error}=await A.sb.rpc("delete_group",{p_group:g.id,p_confirmation:confirmation});
  if(error) return toast(frError(error));
  queueGroupCleanup(g.id);
  await A.loadGroups(); A.hooks.modo?.(); A.hooks.groupe?.();
  try{ await cleanupDeletedGroup(g.id); toast("Groupe supprimé"); }
  catch(_){ toast("Groupe supprimé. Nettoyage des photos en attente ; il sera retenté à ta prochaine ouverture."); }
}
async function leaveGroup(g){
  if(!navigator.onLine) return toast("Connecte-toi à Internet avant de quitter ce groupe.");
  const owner=A.roleOf(g.id,A.me.id)==="owner"||A.myRoles.get(g.id)==="owner";
  let successor=null, confirmation=null;
  if(owner){
    const {data,error}=await A.sb.from("memberships").select("user_id,role,profiles(username)").eq("group_id",g.id).eq("status","active");
    if(error) return toast(frError(error));
    const candidates=(data||[]).filter(m=>m.user_id!==A.me.id);
    if(candidates.length){ successor=await chooseSuccessor(g,candidates); if(!successor) return; }
    else{
      confirmation=await askGroupName(g,"Supprimer le groupe ?","Tu es son dernier membre actif. Quitter supprimera définitivement le groupe et son contenu.");
      if(confirmation==null) return;
    }
  }
  const {data,error}=await A.sb.rpc("leave_group",{p_group:g.id,p_successor:successor,p_confirmation:confirmation});
  if(error) return toast(frError(error));
  if(data==="deleted"){
    queueGroupCleanup(g.id);
    await A.loadGroups(); A.hooks.modo?.(); A.hooks.groupe?.();
    try{ await cleanupDeletedGroup(g.id); toast("Groupe supprimé"); }
    catch(_){ toast("Groupe supprimé. Nettoyage des photos en attente ; il sera retenté à ta prochaine ouverture."); }
    return;
  }
  toast(successor?"Tu as transmis la responsabilité et quitté le groupe.":"Tu as quitté le groupe.");
  await A.loadGroups(); A.hooks.groupChanged?.(); A.hooks.groupe?.();
}

/* ================= Bilan rapide ================= */
const SPECIES=["Brochet","Sandre","Perche","Black-bass","Silure","Carpe","Chevesne","Autre"];
const LURES=["Shad","Swimbait","Jerkbait","Poisson nageur","Spinnerbait","Cuillère","Drop-shot","Texan","Top-water","Vif / mort","Bouillette","Maïs / graines","Vers"];
const COLORS=["Naturel","Perche","Ablette","Blanc","Chartreuse","Firetiger","Orange","Noir","Fluo"];
const pick={species:null,lure:null,color:null,rating:null};
function chipRow(box,key,base,customKey,label){
  box.innerHTML="";
  if(label) box.append(el("span","pick-label",label));
  const list=[...base,...store.get(customKey,[]).filter(x=>!base.includes(x))];
  list.forEach(v=>{
    const c=btn(v,"pick"+(pick[key]===v?" on":""),()=>{ pick[key]=pick[key]===v?null:v; chipRow(box,key,base,customKey,label); });
    c.setAttribute("aria-pressed",String(pick[key]===v)); box.append(c);
  });
  if(customKey){
    const add=btn("+ Autre","pick add"); box.append(add);
    add.addEventListener("click",()=>{
      const inp=el("input","pick-input"); inp.maxLength=40; inp.placeholder="Ton "+(key==="lure"?"leurre / appât":"coloris");
      add.replaceWith(inp); inp.focus();
      const done=()=>{ const v=inp.value.trim(); if(v){ const cu=store.get(customKey,[]); if(!cu.includes(v)&&!base.includes(v)){ cu.push(v); store.set(customKey,cu.slice(-12)); } pick[key]=v; } chipRow(box,key,base,customKey,label); };
      inp.addEventListener("keydown",e=>{ if(e.key==="Enter"){ e.preventDefault(); done(); } });
      inp.addEventListener("blur",done);
    });
  }
}
function renderBilan(){
  chipRow($("#b-species"),"species",SPECIES,null);
  chipRow($("#b-lure"),"lure",LURES,"cdj-lures","Leurre");
  chipRow($("#b-color"),"color",COLORS,"cdj-colors","Coloris");
  const r=$("#b-rating"); r.innerHTML="";
  [4,3,2,1].forEach(n=>{
    const x=A.RATING[n]; const b=btn("","rate"+(pick.rating===n?" on":""),()=>{ pick.rating=n; renderBilan(); });
    b.setAttribute("aria-pressed",String(pick.rating===n));
    b.append(el("span","rate-e",x.e),el("span","rate-t",x.t)); r.append(b);
  });
}
// bilan pré-rempli depuis une trace GPS (durée, distance, touches)
let draft=null;
const fmtDur=m=>m>=60?Math.floor(m/60)+" h "+String(m%60).padStart(2,"0"):m+" min";
function showDraft(){
  $("#bilan .b-draft")?.remove();
  if(!draft) return;
  const d=el("div","b-draft");
  d.append(el("span",null,"🛶 "+(draft.title?draft.title+" · ":"")+fmtDur(draft.duration_min)+" · "+(draft.distance_m>=1000?(draft.distance_m/1000).toFixed(1).replace(".",",")+" km":draft.distance_m+" m")+" · "+draft.bites+" touche"+(draft.bites>1?"s":"")+" · météo du moment jointe"));
  d.append(btn("✕","linkbtn",()=>{ draft=null; showDraft(); }));
  $("#bilan h2").after(d);
}
A.bilanFromTrack=d=>{
  draft=d; location.hash="#fil";
  setTimeout(()=>{
    const b=document.querySelector('#post-mode [data-m="bilan"]');
    if(b&&b.getAttribute("aria-pressed")!=="true") b.click();
    if(!d.bites){ /* aucune touche : on propose le capot */ $("#b-capot").checked=true; $("#b-len").disabled=true; }
    showDraft(); $("#bilan").scrollIntoView({behavior:"smooth",block:"start"});
  },250);
};
// poids estimé d'après la taille (bilan sans pesée)
function bilanWeight(){
  let n=$("#b-wt-note"); if(!n){ n=el("p","note b-wt-note"); n.id="b-wt-note"; $("#b-len").closest(".q-row").after(n); }
  const W=window.CDJ_WEIGHT, len=parseFloat($("#b-len").value), w=W&&pick.species?W.est(pick.species,len):null;
  n.hidden=!w; const f=x=>W.fmt(x).replace(".",","); if(w) n.textContent="⚖️ Poids estimé : environ "+f(w)+" kg ("+f(w*0.85)+" à "+f(w*1.15)+" kg selon la corpulence)";
}
$("#b-len").addEventListener("input",bilanWeight);
$("#b-species").addEventListener("click",()=>setTimeout(bilanWeight,0));
$("#b-capot").addEventListener("change",()=>{ $("#b-len").disabled=$("#b-capot").checked; if($("#b-capot").checked) $("#b-len").value=""; });
$("#bilan").addEventListener("submit",async e=>{
  e.preventDefault(); showErr($("#b-err"));
  if(!isMember()) return showErr($("#b-err"),"Choisis d'abord un de tes groupes.");
  if(!pick.rating) return showErr($("#b-err"),"Choisis l'indice de réussite de ta session.");
  const capot=$("#b-capot").checked, len=parseFloat($("#b-len").value);
  const b=$("#b-submit"); b.disabled=true;
  const row={group_id:A.cur,user_id:A.me.id,species:pick.species,caught:!capot,
    length_cm:!capot&&len>0?Math.round(len):null,lure:pick.lure,color:pick.color,rating:pick.rating,water_type:waterType(),released:capot?null:(window.CDJ_REL?.("#b-rel")??null),conditions:window.CDJ_ADVICE?.snapshot?.()||null};
  if(draft){ row.track_id=draft.track_id; row.duration_min=draft.duration_min; row.distance_m=draft.distance_m; row.bites=draft.bites; }
  let {error}=navigator.onLine?await A.sb.from("sessions").insert(row):{error:new Error("Failed to fetch")};
  let queued=false;
  if(error&&A.offline?.isNetErr(error)&&await A.offline.enqueue({kind:"insert",table:"sessions",row})){ error=null; queued=true; }
  b.disabled=false;
  if(error) return showErr($("#b-err"),frError(error));
  if(queued){ Object.keys(pick).forEach(k=>pick[k]=null); $("#bilan").reset(); document.querySelectorAll("#b-rel button").forEach(x=>x.setAttribute("aria-pressed","false")); $("#b-len").disabled=false; renderBilan(); return toast("Pas de réseau : ton bilan partira dès le retour du réseau"); }
  Object.keys(pick).forEach(k=>pick[k]=null); $("#bilan").reset(); document.querySelectorAll("#b-rel button").forEach(x=>x.setAttribute("aria-pressed","false")); $("#b-len").disabled=false; renderBilan(); draft=null; showDraft();
  toast("Bilan partagé avec le groupe"); A.loadFeed();
});
renderBilan();

/* ================= Onglet Groupe ================= */
let renderSeq=0;
async function renderGroupe(){
  const seq=++renderSeq;
  if(!A.me||!A.groups.length){ root.innerHTML=""; return; }
  if(A.cur==="all") return adminOverview(seq);
  const g=A.curGroup; if(!g){ root.innerHTML=""; return; }
  const gid=g.id, mod=A.canModerate(gid), man=A.canManage(gid);
  const since=new Date(Date.now()-30*864e5).toISOString();
  const [memos,polls,sess,mg,members,cnt]=await Promise.all([
    A.sb.from("memos").select("id,user_id,title,body,link,photo_path,pinned,created_at,updated_at,profiles(username,is_admin)").eq("group_id",gid).order("pinned",{ascending:false}).order("updated_at",{ascending:false}).limit(30),
    A.sb.from("polls").select("id,user_id,question,place,event_at,created_at,profiles!polls_user_id_fkey(username,is_admin)").eq("group_id",gid).order("created_at",{ascending:false}).limit(10),
    A.sb.from("sessions").select("species,caught,lure,color,rating,created_at").eq("group_id",gid).gte("created_at",since),
    mod?A.sb.rpc("manage_groups"):Promise.resolve({data:null}),
    mod?A.sb.rpc("manage_members",{p_group:gid}):Promise.resolve({data:null}),
    A.sb.from("memberships").select("user_id",{count:"exact",head:true}).eq("group_id",gid).eq("status","active"),
  ]);
  const pollIds=(polls.data||[]).map(p=>p.id);
  const votes=pollIds.length?await A.sb.from("poll_votes").select("poll_id,user_id,choice,profiles(username)").in("poll_id",pollIds):{data:[]};
  const memoUrls=await signed((memos.data||[]).map(m=>m.photo_path).filter(Boolean));
  if(seq!==renderSeq) return;
  const info=(mg.data||[]).find(x=>x.id===gid);
  root.innerHTML="";

  // En-tête du groupe
  const head=el("div","g-head");
  const t=el("div"); const h=el("h1",null,g.name); const rb=A.me.is_admin?el("span","badge","Développeur"):A.me.is_controller?el("span","badge controller","Contrôle"):roleBadge(A.myRoles.get(gid)); if(rb) h.append(rb);
  const nb=info?Number(info.members):cnt.count, wait=info?Number(info.pending_members||0):0;
  const full=nb+wait>=MAXM;
  const cap=nb!=null?nb+"/"+MAXM+" membres"+(wait?" · "+wait+" en attente":"")+(full?" · complet":""):"";
  t.append(h, el("div","note"+(full?" warn":""),[g.region,cap].filter(Boolean).join(" · ")));
  head.append(t);
  if(info){
    // Code masqué visuellement pour les membres - on utilise le lien d'invitation (token)
    const code=el("div","g-code"); code.hidden=true;
    code.append(el("span","note","Code"),el("span","code",info.invite_code));
    const cp=btn("Copier","linkbtn",async()=>{ try{ await navigator.clipboard.writeText(info.invite_code); toast("Code copié"); }catch(e){ toast("Code : "+info.invite_code); } });
    code.append(cp, btn("🔗 Inviter","btn small",async()=>{ const {data}=await A.sb.rpc("create_group_invite",{p_group:gid}); if(data?.token) A.invite?.open(data.token,g.name); })); head.append(code);
  }
  root.append(head);

  // À traiter : renvoi vers l'onglet Modération (dans Profil)
  const pendingMembers=(members.data||[]).filter(m=>m.status==="pending");
  const todoN=pendingMembers.length+(info?.pending_posts||0);
  if(mod&&todoN){
    const box=el("button","todo todo-link"); box.type="button";
    box.append(el("span",null,"🛡️ "+todoN+" élément"+(todoN>1?"s":"")+" à traiter"),el("span","todo-go","Modération ›"));
    box.addEventListener("click",()=>{ location.hash="#profil"; setTimeout(()=>document.querySelector('#profil-sub [data-s="moderation"]')?.click(),300); });
    root.append(box);
  }

  const sub=(n,k)=>{ n.dataset.sub=k; return n; };
  root.append(sub(renderMemos(gid,memos.data||[],memoUrls,mod),"infos"));
  root.append(sub(renderPolls(gid,polls.data||[],votes.data||[],mod),"infos"));
  root.append(sub(renderStats(sess.data||[]),"infos"));
  const ex=sub(el("div","g-extras"),"activite"); root.append(ex); A.hooks.groupeExtras?.(ex,gid,mod);

  A.hooks.groupeRendered?.(root);
}
A.hooks.groupe=renderGroupe;
A.groupeAPI={renderManage:(g,info,members,man)=>renderManage(g,info,members,man)};

/* ---------- Mémos ---------- */
function renderMemos(gid,list,urls,mod){
  const addBtn=btn("+ Ajouter","linkbtn");
  const s=section("Mémos du groupe",addBtn);
  const form=memoForm(gid,null,mod); form.hidden=true; s.append(form);
  addBtn.addEventListener("click",()=>{ form.hidden=!form.hidden; if(!form.hidden) form.querySelector("input").focus(); });
  if(!list.length) s.append(el("p","empty small","Aucun mémo. Épinglez ici les règles du plan d'eau, les cartes AAPPMA ou les bons postes du secteur."));
  list.forEach(m=>{
    const c=el("article","memo"+(m.pinned?" pinned":""));
    const top=el("div","memo-top");
    const tt=el("h3",null,m.title); if(m.pinned) tt.prepend(el("span","pin","📌"));
    top.append(tt); c.append(top);
    if(m.body) c.append(el("p","memo-body",m.body));
    if(m.link&&/^https?:\/\//i.test(m.link)){ const a=el("a","memo-link",m.link.replace(/^https?:\/\//,"")); a.href=m.link; a.target="_blank"; a.rel="noopener"; c.append(a); }
    if(m.photo_path&&urls[m.photo_path]){ const im=el("img","memo-img"); im.src=urls[m.photo_path]; im.alt=m.title; im.loading="lazy"; c.append(im); }
    const foot=el("div","memo-foot");
    foot.append(el("span","note","@"+(m.profiles?.username||"?")+" · "+ago(m.updated_at||m.created_at)));
    const act=el("div","actions");
    if(mod) act.append(btn(m.pinned?"Désépingler":"Épingler","linkbtn",async()=>{ const {error}=await A.sb.from("memos").update({pinned:!m.pinned}).eq("id",m.id); if(error) return toast(frError(error)); renderGroupe(); }));
    if(m.user_id===A.me.id||mod){
      act.append(btn("Modifier","linkbtn",()=>{ const f=memoForm(gid,m,mod); c.replaceWith(f); f.querySelector("input").focus(); }));
      act.append(confirmBtn("Supprimer","Confirmer",async()=>{
        if(m.photo_path) await A.sb.storage.from("photos").remove([m.photo_path]);
        const {error}=await A.sb.from("memos").delete().eq("id",m.id); if(error) return toast(frError(error)); toast("Mémo supprimé"); renderGroupe();
      }));
    }
    foot.append(act); c.append(foot); s.append(c);
  });
  return s;
}
function memoForm(gid,m,mod){
  const f=el("form","panel memo-form");
  const fld=(label,input)=>{ const l=el("label","field",label); l.append(input); f.append(l); return input; };
  const ti=fld("Titre",el("input")); ti.required=true; ti.maxLength=80; ti.placeholder="Ex. : Règles du lac de Clarens"; ti.value=m?.title||"";
  const bo=fld("Contenu",el("textarea")); bo.maxLength=2000; bo.placeholder="Horaires, no-kill, postes, accès, contacts…"; bo.value=m?.body||"";
  const li=fld("Lien (facultatif)",el("input")); li.type="url"; li.maxLength=300; li.placeholder="https://… (carte AAPPMA, arrêté…)"; li.value=m?.link||"";
  const ph=fld(m?.photo_path?"Remplacer la photo (facultatif)":"Photo ou capture (facultatif)",el("input")); ph.type="file"; ph.accept="image/*";
  let pin=null;
  if(mod){ const l=el("label","check"); pin=el("input"); pin.type="checkbox"; pin.checked=!!m?.pinned; l.append(pin," Épingler en haut"); f.append(l); }
  const err=el("p","err"); err.hidden=true; f.append(err);
  const act=el("div","actions"); const ok=el("button","btn primary",m?"Enregistrer":"Ajouter le mémo"); ok.type="submit";
  act.append(ok, btn("Annuler","btn",()=>{ if(m) renderGroupe(); else f.hidden=true; })); f.append(act);
  f.addEventListener("submit",async e=>{
    e.preventDefault(); showErr(err); ok.disabled=true;
    try{
      if(li.value&&!/^https?:\/\//i.test(li.value)) throw new Error("Le lien doit commencer par https://");
      let photo=m?.photo_path||null;
      if(ph.files[0]){
        const blob=await A.compress(ph.files[0]); const path=gid+"/"+A.me.id+"/memo-"+Date.now()+".jpg";
        const {error}=await A.sb.storage.from("photos").upload(path,blob,{contentType:"image/jpeg"}); if(error) throw error;
        if(photo&&m) await A.sb.storage.from("photos").remove([photo]);
        photo=path;
      }
      const row={title:ti.value.trim(),body:bo.value.trim()||null,link:li.value.trim()||null,photo_path:photo};
      if(pin) row.pinned=pin.checked;
      const {error}=m?await A.sb.from("memos").update(row).eq("id",m.id):await A.sb.from("memos").insert({...row,group_id:gid,user_id:A.me.id});
      if(error) throw error;
      toast(m?"Mémo modifié":"Mémo ajouté"); renderGroupe();
    }catch(x){ showErr(err,frError(x)); ok.disabled=false; }
  });
  return f;
}

/* ---------- Sondages de sortie ---------- */
const CHOICES=[["oui","Oui"],["peut-etre","Peut-être"],["non","Non"]];
function renderPolls(gid,list,votes,mod){
  const addBtn=btn("+ Nouveau","linkbtn");
  const s=section("Sondages de sortie",addBtn);
  const form=pollForm(gid); form.hidden=true; s.append(form);
  addBtn.addEventListener("click",()=>{ form.hidden=!form.hidden; if(!form.hidden) form.querySelector("input").focus(); });
  if(!list.length) s.append(el("p","empty small","Aucun sondage. Lance « Qui est dispo samedi matin ? » pour organiser la prochaine sortie."));
  list.forEach(p=>{
    const vs=votes.filter(v=>v.poll_id===p.id);
    const mine=vs.find(v=>v.user_id===A.me.id)?.choice;
    const past=p.event_at&&new Date(p.event_at)<new Date(Date.now()-864e5);
    const c=el("article","poll"+(past?" past":""));
    c.append(el("h3",null,p.question));
    const meta=[p.place?"📍 "+p.place:"",p.event_at?"🗓 "+fmtDate(p.event_at):""].filter(Boolean).join("  ·  ");
    if(meta) c.append(el("div","poll-meta",meta));
    const row=el("div","votes");
    CHOICES.forEach(([k,label])=>{
      const who=vs.filter(v=>v.choice===k);
      const b=btn("","vote v-"+k+(mine===k?" on":""),async()=>{
        b.disabled=true;
        const {error}=mine===k
          ?await A.sb.from("poll_votes").delete().eq("poll_id",p.id).eq("user_id",A.me.id)
          :await A.sb.from("poll_votes").upsert({poll_id:p.id,user_id:A.me.id,choice:k,voted_at:new Date().toISOString()},{onConflict:"poll_id,user_id"});
        if(error){ b.disabled=false; return toast(frError(error)); }
        renderGroupe();
      });
      b.setAttribute("aria-pressed",String(mine===k)); b.disabled=past;
      b.append(el("span","vote-l",label),el("span","vote-n",String(who.length)));
      row.append(b);
    });
    c.append(row);
    const names=CHOICES.map(([k,label])=>{ const w=vs.filter(v=>v.choice===k).map(v=>"@"+(v.profiles?.username||"?")); return w.length?label+" : "+w.join(", "):""; }).filter(Boolean);
    if(names.length) c.append(el("div","poll-names",names.join("\n")));
    const foot=el("div","memo-foot");
    foot.append(el("span","note","par @"+(p.profiles?.username||"?")+" · "+ago(p.created_at)+(past?" · terminé":"")));
    if(p.user_id===A.me.id||mod) foot.append(confirmBtn("Supprimer","Confirmer",async()=>{ const {error}=await A.sb.from("polls").delete().eq("id",p.id); if(error) return toast(frError(error)); renderGroupe(); }));
    c.append(foot); s.append(c);
  });
  return s;
}
function pollForm(gid){
  const f=el("form","panel");
  const fld=(label,input)=>{ const l=el("label","field",label); l.append(input); f.append(l); return input; };
  const q=fld("Question",el("input")); q.required=true; q.minLength=3; q.maxLength=200; q.placeholder="Qui est dispo samedi matin ?";
  const row=el("div","row2"); f.append(row);
  const pl=el("label","field","Lieu (facultatif)"); const pi=el("input"); pi.maxLength=80; pi.placeholder="Garonne Aval"; pl.append(pi); row.append(pl);
  const dl=el("label","field","Date et heure (facultatif)"); const di=el("input"); di.type="datetime-local"; dl.append(di); row.append(dl);
  const err=el("p","err"); err.hidden=true; f.append(err);
  const act=el("div","actions"); const ok=el("button","btn primary","Lancer le sondage"); ok.type="submit"; act.append(ok,btn("Annuler","btn",()=>{ f.hidden=true; })); f.append(act);
  f.addEventListener("submit",async e=>{
    e.preventDefault(); showErr(err); ok.disabled=true;
    const {error}=await A.sb.from("polls").insert({group_id:gid,user_id:A.me.id,question:q.value.trim(),place:pi.value.trim()||null,event_at:di.value?new Date(di.value).toISOString():null});
    ok.disabled=false;
    if(error) return showErr(err,frError(error));
    toast("Sondage envoyé au groupe"); renderGroupe();
  });
  return f;
}

/* ---------- Statistiques des bilans ---------- */
function renderStats(list){
  const s=section("Ce qui marche en ce moment",el("span","note","30 derniers jours"));
  if(!list.length){ s.append(el("p","empty small","Pas encore de bilan ce mois-ci. Le premier se fait en 3 clics depuis l'onglet Fil.")); return s; }
  const n=list.length, caught=list.filter(x=>x.caught!==false).length;
  const avg=list.reduce((a,x)=>a+x.rating,0)/n;
  const kpis=el("div","kpis");
  const kpi=(v,l)=>{ const d=el("div","kpi"); d.append(el("div","kpi-v",v),el("div","kpi-l",l)); kpis.append(d); };
  kpi(String(n),"bilan"+(n>1?"s":""));
  kpi(Math.round(caught/n*100)+" %","sessions avec prise");
  kpi((A.RATING[Math.round(avg)]?.e||"")+" "+avg.toFixed(1).replace(".",","),"indice moyen /4");
  s.append(kpis);
  // combos leurre + coloris
  const combos=new Map();
  list.filter(x=>x.caught!==false&&(x.lure||x.color)).forEach(x=>{
    const k=[x.lure,x.color].filter(Boolean).join(" · ");
    const c=combos.get(k)||{k,n:0,r:0,sp:new Map()}; c.n++; c.r+=x.rating; if(x.species) c.sp.set(x.species,(c.sp.get(x.species)||0)+1); combos.set(k,c);
  });
  const top=[...combos.values()].map(c=>({...c,score:c.n*(c.r/c.n)})).sort((a,b)=>b.score-a.score).slice(0,5);
  if(top.length){
    s.append(el("h4","g-sub","Combos gagnants"));
    const max=top[0].score;
    const ul=el("ol","rank");
    top.forEach(c=>{
      const li=el("li"); const tx=el("div","rank-t"); tx.append(el("span","rank-k",c.k));
      const sp=[...c.sp.entries()].sort((a,b)=>b[1]-a[1]).map(([k])=>k).slice(0,2).join(", ");
      tx.append(el("span","rank-m",c.n+" prise"+(c.n>1?"s":"")+" · "+(A.RATING[Math.round(c.r/c.n)]?.e||"")+(sp?" · "+sp:"")));
      const bar=el("div","rank-bar"); const i=el("i"); i.style.width=Math.max(8,Math.round(c.score/max*100))+"%"; bar.append(i);
      li.append(tx,bar); ul.append(li);
    });
    s.append(ul);
  }
  const spc=new Map(); list.filter(x=>x.caught!==false&&x.species).forEach(x=>spc.set(x.species,(spc.get(x.species)||0)+1));
  if(spc.size){
    s.append(el("h4","g-sub","Espèces prises"));
    const ch=el("div","chips"); [...spc.entries()].sort((a,b)=>b[1]-a[1]).forEach(([k,v])=>ch.append(el("span","chip plus",k+" × "+v))); s.append(ch);
  }
  return s;
}

/* ---------- Gestion (modérateurs, responsables, admin) ---------- */
function afterManage(){ renderGroupe(); A.hooks.modo?.(); }
function renderManage(g,info,members,man){
  const s=section("Gestion du groupe");
  const active=members.filter(m=>m.status==="active");
  const list=el("div","list tight");
  active.forEach(m=>{
    const r=el("div","mrow");
    const left=el("div"); left.append(userLabel(m.username,m.is_admin,m.role)); left.append(el("div","post-date","depuis le "+new Date(m.joined_at).toLocaleDateString("fr-FR")));
    r.append(left);
    const act=el("div","actions");
    const self=m.user_id===A.me.id;
    if(man&&!self&&(A.me.is_admin||m.role!=="owner")){
      const sel=el("select","role-sel"); sel.setAttribute("aria-label","Rôle de @"+m.username);
      [["member","Membre"],["moderator","Modérateur"]].concat(A.me.is_admin?[["owner","Responsable"]]:[]).forEach(([v,l])=>sel.append(new Option(l,v)));
      sel.value=m.role;
      sel.addEventListener("change",async()=>{ const {error}=await A.sb.rpc("set_member_role",{p_group:g.id,p_user:m.user_id,p_role:sel.value}); if(error){ sel.value=m.role; return toast(frError(error)); } toast("@"+m.username+" est maintenant "+sel.options[sel.selectedIndex].text.toLowerCase()); await A.loadGroups(); afterManage(); });
      act.append(sel);
    }
    const canReset=!self&&!m.is_admin&&(A.me.is_admin||m.role==="member");
    if(canReset) act.append(btn("🔑","linkbtn",()=>A.account?.adminReset(m.user_id,m.username))), act.lastChild.title="Réinitialiser le mot de passe", act.lastChild.setAttribute("aria-label","Réinitialiser le mot de passe de @"+m.username);
    const canKick=!self&&(A.me.is_admin||(man&&m.role!=="owner")||(!man&&m.role==="member"));
    if(canKick) act.append(confirmBtn("Retirer","Confirmer",async()=>{ const {error}=await A.sb.from("memberships").delete().eq("group_id",g.id).eq("user_id",m.user_id); if(error) return toast(frError(error)); toast("@"+m.username+" retiré du groupe"); afterManage(); }));
    r.append(act); list.append(r);
  });
  s.append(el("h4","g-sub","Membres ("+active.length+"/"+MAXM+")"), list);
  if(man&&info){
    s.append(el("h4","g-sub","Réglages"));
    const opt=(label,hint,key)=>{
      const l=el("label","switch"); const i=el("input"); i.type="checkbox"; i.checked=!!info[key];
      const t=el("span","switch-t"); t.append(el("b",null,label),el("span","note",hint));
      l.append(i,el("span","switch-ui"),t);
      i.addEventListener("change",async()=>{
        const p={p_id:g.id,p_require_approval:key==="require_approval"?i.checked:info.require_approval,p_post_approval:key==="post_approval"?i.checked:info.post_approval};
        const {error}=await A.sb.rpc("set_group_options",p); if(error){ i.checked=!i.checked; return toast(frError(error)); }
        info[key]=i.checked; toast("Réglage enregistré"); A.loadGroups();
      });
      return l;
    };
    s.append(opt("Valider les nouveaux membres","Chaque personne qui entre le code attend ton accord.","require_approval"));
    s.append(opt("Valider les publications","Les prises des membres apparaissent après validation d'un modérateur.","post_approval"));
    const f=el("form","g-edit");
    const mk=(label,val,attrs)=>{ const l=el("label","field",label); const i=el("input"); Object.assign(i,attrs); i.value=val||""; l.append(i); f.append(l); return i; };
    const n=mk("Nom",g.name,{required:true,maxLength:40}), rg=mk("Région",g.region,{maxLength:40}), cd=mk("Code d'invitation",info.invite_code,{required:true,minLength:8,maxLength:40}); cd.closest("label").hidden=true;
    { const rg2=el("button","linkbtn","🎲 Générer un nouveau code sûr"); rg2.type="button"; rg2.addEventListener("click",async()=>{ if(!confirm("Remplacer le code ? Les anciens liens d'invitation ne marcheront plus.")) return; const {data:c,error}=await A.sb.rpc("regen_group_code",{p_id:g.id}); if(error) return toast(frError(error)); cd.value=c; toast("Nouveau code : "+c); await A.loadGroups(); afterManage(); }); f.append(rg2); }
    const err=el("p","err"); err.hidden=true; f.append(err);
    const ok=el("button","btn","Enregistrer"); ok.type="submit"; f.append(ok);
    f.addEventListener("submit",async e=>{ e.preventDefault(); showErr(err);
      const {error}=await A.sb.rpc("manage_save_group",{p_id:g.id,p_name:n.value.trim(),p_region:rg.value.trim(),p_code:cd.value.trim()});
      if(error) return showErr(err,frError(error)); toast("Groupe modifié"); await A.loadGroups(); afterManage(); });
    s.append(f);
  }
  if(man){
    const del=btn("🗑 Supprimer le groupe","btn small danger",()=>removeGroup(g));
    del.setAttribute("aria-label","Supprimer définitivement le groupe "+g.name);
    s.append(el("p","note","Suppression définitive du groupe et de ses données."),del);
  }
  return s;
}

/* ---------- Vue d'ensemble admin ---------- */
async function adminOverview(seq){
  const {data,error}=await A.sb.rpc("manage_groups");
  if(seq!==renderSeq) return;
  root.innerHTML="";
  const s=section("Tous les groupes",el("span","note","vue développeur"));
  if(error){ s.append(el("p","err",frError(error))); root.append(s); return; }
  (data||[]).forEach(g=>{
    const c=el("div","gcard");
    const h=el("div","gcard-head"); h.append(el("span","gcard-name",g.name+(g.region?" · "+g.region:"")));
    const pl=(n,w)=>n+" "+w+(n>1?"s":"");
    h.append(el("span","gcard-meta",g.members+"/"+MAXM+" membres · "+" · "+pl(g.posts,"post")+" · "+pl(g.spots,"spot"))); c.append(h);
    const flags=el("div","chips");
    if(g.pending_members) flags.append(el("span","chip minus",g.pending_members+" demande"+(g.pending_members>1?"s":"")));
    if(g.pending_posts) flags.append(el("span","chip minus",g.pending_posts+" post"+(g.pending_posts>1?"s":"")+" à valider"));
    if(g.require_approval) flags.append(el("span","chip","Adhésion validée"));
    if(g.post_approval) flags.append(el("span","chip","Posts validés"));
    if(flags.childNodes.length) c.append(flags);
    const code=el("div","note","Code : "); code.append(el("span","code",g.invite_code)); code.hidden=true; c.append(code);
    c.append(btn("Ouvrir ce groupe","btn small",()=>A.setGroup(g.id)));
    if(A.me.is_admin) c.append(btn("🗑 Supprimer le groupe","btn small danger",()=>removeGroup(g)));
    s.append(c);
  });
  root.append(s);
}

/* ================= Chat de groupe ================= */
// Membre : chat du groupe sélectionné. Admin : onglets pour passer d'un groupe à l'autre dans le chat.
const fab=$("#chat-fab"), panel=$("#chat-panel"), box=$("#chat-msgs"), badge=$("#chat-badge"), tabs=$("#chat-groups"), scopes=$("#chat-scopes");
let chatGid=null, chatScope="group", channel=null, staffChannel=null, msgs=[], names=new Map(), unread=new Map(), staffUnread=0, poll=null, subKey="", staffSubKey="";
const seenKey=g=>"cdj-chat-seen-"+g;
const staffSeenKey="cdj-chat-staff-seen";
const isAdmin=()=>!!(A.me?.is_admin||A.me?.is_controller);   // admin ou contrôleur : voit tous les chats
const chatGroups=()=>isAdmin()?A.groups:A.groups.filter(g=>A.myRoles.has(g.id));
const totalUnread=()=> (isAdmin()?[...unread.values()].reduce((a,b)=>a+b,0):(unread.get(chatGid)||0))+(isAdmin()?staffUnread:0);
function renderFab(){
  fab.hidden=!chatVisible()||!panel.hidden;
  const n=totalUnread(); badge.hidden=!n; badge.textContent=n>9?"9+":String(n);
}
function renderTabs(){
  scopes.hidden=!isAdmin();
  scopes.querySelectorAll("[data-scope]").forEach(b=>{ const on=b.dataset.scope===chatScope; b.classList.toggle("on",on); b.setAttribute("aria-selected",String(on)); });
  tabs.innerHTML=""; tabs.hidden=!isAdmin();
  if(!isAdmin()||chatScope==="staff") { tabs.hidden=true; return; }
  chatGroups().forEach(gr=>{
    const b=btn("","chat-tab"+(gr.id===chatGid?" on":""),()=>switchChat(gr.id));
    b.append(el("span",null,gr.name));
    const n=unread.get(gr.id)||0; if(n) b.append(el("span","chat-tab-n",n>9?"9+":String(n)));
    b.setAttribute("aria-pressed",String(gr.id===chatGid)); tabs.append(b);
  });
  tabs.querySelector(".on")?.scrollIntoView({inline:"center",block:"nearest"});
}
async function countUnread(gids){
  await Promise.all(gids.map(async gid=>{
    const seen=store.get(seenKey(gid),new Date(Date.now()-7*864e5).toISOString());
    const {count}=await A.sb.from("messages").select("id",{count:"exact",head:true}).eq("group_id",gid).gt("created_at",seen).neq("user_id",A.me.id);
    unread.set(gid,count||0);
  }));
  if(isAdmin()){
    const seen=store.get(staffSeenKey,new Date(Date.now()-7*864e5).toISOString());
    const {count}=await A.sb.from("staff_messages").select("id",{count:"exact",head:true}).gt("created_at",seen).neq("user_id",A.me.id);
    staffUnread=count||0;
  }
  renderFab(); renderTabs();
}
// Abonnement temps réel : tous les groupes pour l'admin, le groupe courant pour un membre
function subscribe(){
  const gids=isAdmin()?chatGroups().map(g=>g.id):(canChat()?[A.cur]:[]);
  const key=(A.me?.id||"")+"|"+gids.join(",");
  if(key!==subKey){
    subKey=key;
    if(channel){ A.sb?.removeChannel(channel); channel=null; }
    unread=new Map();
    if(gids.length){
      const opts={event:"INSERT",schema:"public",table:"messages"};
      if(!isAdmin()) opts.filter="group_id=eq."+gids[0];
      channel=A.sb.channel("chat-"+key).on("postgres_changes",opts,async ({new:m})=>{
        if(!gids.includes(m.group_id)) return;
        if(!panel.hidden&&chatScope==="group"&&m.group_id===chatGid){ m._scope="group"; await addMsg(m); markSeen(); }
        else if(m.user_id!==A.me.id){ unread.set(m.group_id,(unread.get(m.group_id)||0)+1); renderFab(); renderTabs(); }
      }).subscribe();
    }
    countUnread(gids);
  }
  const skey=isAdmin()?(A.me?.id||""):"";
  if(skey!==staffSubKey){
    staffSubKey=skey;
    if(staffChannel){ A.sb?.removeChannel(staffChannel); staffChannel=null; }
    if(skey){
      staffChannel=A.sb.channel("staff-chat-"+skey).on("postgres_changes",{event:"INSERT",schema:"public",table:"staff_messages"},async ({new:m})=>{
        if(!isAdmin()) return;
        m._scope="staff";
        if(!panel.hidden&&chatScope==="staff"){ await addMsg(m); markStaffSeen(); }
        else if(m.user_id!==A.me.id){ staffUnread++; renderFab(); }
      }).subscribe();
    } else staffUnread=0;
  }
}
function onGroupChanged(){
  if(!A.me){ if(channel) A.sb?.removeChannel(channel); if(staffChannel) A.sb?.removeChannel(staffChannel); channel=staffChannel=null; subKey=staffSubKey=""; unread=new Map(); staffUnread=0; closeChat(); renderFab(); return; }
  if(!isAdmin()&&chatScope==="staff") switchScope("group");
  if(!isAdmin()){
    const next=canChat()?A.cur:null;
    if(next!==chatGid){ chatGid=next; msgs=[]; box.innerHTML=""; if(!chatGid) closeChat(); else if(!panel.hidden) loadChat(); }
  }
  subscribe(); renderFab();
}
async function nameOf(uid){
  if(names.has(uid)) return names.get(uid);
  const {data}=await A.sb.from("profiles").select("username,is_admin").eq("id",uid).maybeSingle();
  const v=data||{username:"?"}; names.set(uid,v); return v;
}
async function loadChat(){
  if(chatScope==="group"&&!chatGid) return;
  const gid=chatGid, scope=chatScope, table=scope==="staff"?"staff_messages":"messages";
  let q=A.sb.from(table).select("id,user_id,body,photo_path,audio_path,audio_secs,created_at,profiles(username,is_admin,is_controller)");
  if(scope==="group") q=q.eq("group_id",gid);
  const {data,error}=await q.order("created_at",{ascending:false}).limit(80);
  if(gid!==chatGid||scope!==chatScope) return;
  if(error){ box.innerHTML=""; box.append(el("p","err",frError(error))); return; }
  const list=(data||[]).reverse().map(m=>({...m,_scope:scope}));
  await signAll(list);
  if(gid!==chatGid||scope!==chatScope) return;
  const same=list.length===msgs.length&&list.every((m,i)=>m.id===msgs[i].id&&m._scope===msgs[i]._scope);
  msgs=list; msgs.forEach(m=>{ if(m.profiles) names.set(m.user_id,m.profiles); });
  if(!same||!box.childElementCount) drawMsgs(true);
  scope==="staff"?markStaffSeen():markSeen();
}
async function addMsg(m){
  m._scope=m._scope||"group";
  if(m._scope!==chatScope||(m._scope==="group"&&m.group_id&&m.group_id!==chatGid)) return;
  if(msgs.some(x=>x.id===m.id&&x._scope===m._scope)) return;
  m.profiles=m.profiles||await nameOf(m.user_id);
  await signAll([m]);
  if(msgs.some(x=>x.id===m.id&&x._scope===m._scope)) return;
  msgs.push(m); drawMsgs(true);
}
function drawMsgs(scroll){
  box.innerHTML="";
  if(!msgs.length){ box.append(el("p","empty small","Aucun message. Lance la discussion !")); return; }
  let lastDay="", lastUser=null;
  msgs.forEach(m=>{
    const d=new Date(m.created_at), day=d.toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long"});
    if(day!==lastDay){ box.append(el("div","chat-day",day)); lastDay=day; lastUser=null; }
    const mine=m.user_id===A.me.id;
    const row=el("div","msg"+(mine?" mine":""));
    if(lastUser!==m.user_id){
      // pseudo toujours affiché ; admin en orange 👑, responsable en vert 👮, modérateur en bleu 🛡️
      const isAdm=chatScope==="staff"?!!m.profiles?.is_admin:!!m.profiles?.is_admin, isCtl=!isAdm&&(!!m.profiles?.is_controller||!!window.CDJ_CTRL?.has(m.profiles?.username)), role=chatScope==="staff"||isAdm||isCtl?null:A.roleOf(chatGid,m.user_id);
      const isResp=role==="owner", isMod=role==="moderator";
      const who=el("div","msg-who"+(isAdm?" is-admin":isCtl?" is-ctl":isResp?" is-owner":isMod?" is-mod":""));
      if(isAdm) who.append(el("span","msg-ico","👑"));
      else if(isCtl) who.append(el("span","msg-ico","⚖️"));
      else if(isResp) who.append(el("span","msg-ico","👮"));
      else if(isMod) who.append(el("span","msg-ico","🛡️"));
      who.append("@"+(m.profiles?.username||"?")); if(m.profiles?.username){ who.dataset.user=m.profiles.username; who.classList.add("user-link"); }
      if(isAdm||isCtl||isResp||isMod) who.setAttribute("title",isAdm?"Développeur":isCtl?"Contrôleur de l'appli":isResp?"Responsable du groupe":"Modérateur du groupe");
      row.append(who);
    }
    const b=el("div","bubble"+(m.body&&mentionsMe(m.body)&&!mine?" mention-me":"")+(m.photo_path?" has-photo":"")+(m.audio_path?" has-voice":""));
    const mn=mediaNode(m); if(mn) b.append(mn);
    if(chatScope==="group"&&!mine&&A.report){
      // appui long (ou clic droit) sur un message : le signaler
      b.addEventListener("contextmenu",e=>{ e.preventDefault(); A.report({kind:"message",target_id:m.id,group_id:chatGid,excerpt:m.body||(m.photo_path?"📷 Photo":m.audio_path?"🎤 Message vocal":""),author_id:m.user_id}); });
    }
    if(m.body) b.append(withMentions(m.body));
    b.append(el("span","msg-h",d.toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"})));
    row.append(b); box.append(row); lastUser=m.user_id;
  });
  if(scroll) requestAnimationFrame(()=>{ box.scrollTop=box.scrollHeight; });
}
// ---------- Photos et messages vocaux ----------
const urlCache=new Map(), media=new Map();
let playing=null;
const fmtSecs=s=>Math.floor(s/60)+":"+String(Math.round(s)%60).padStart(2,"0");
async function signAll(list){
  for(const bucket of ["photos","staff-media"]){
    const need=[...new Set(list.filter(m=>(m._scope==="staff")===(bucket==="staff-media")).flatMap(m=>[m.photo_path,m.audio_path]).filter(p=>p&&!urlCache.has(bucket+"|"+p)))];
    if(!need.length) continue;
    const {data}=await A.sb.storage.from(bucket).createSignedUrls(need,6*3600);
    (data||[]).forEach(s=>{ if(s.signedUrl) urlCache.set(bucket+"|"+s.path,s.signedUrl); });
  }
}
function mediaNode(m){
  const key=(m._scope||"group")+"|"+m.id;
  if(media.has(key)) return media.get(key);
  const signed=p=>urlCache.get((m._scope==="staff"?"staff-media":"photos")+"|"+p);
  let n=null;
  if(m.photo_path){
    const u=signed(m.photo_path);
    if(u){ n=el("a","msg-photo"); n.href=u; n.target="_blank"; n.rel="noopener"; const img=el("img"); img.src=u; img.loading="lazy"; img.alt="Photo envoyée par @"+(m.profiles?.username||"?"); n.append(img); }
    else n=el("span","note","Photo indisponible");
  }else if(m.audio_path) n=voiceNode(signed(m.audio_path),m.audio_secs||0);
  if(n) media.set(key,n);
  return n;
}
function voiceNode(url,secs){
  const w=el("div","voice");
  const b=btn("▶","voice-play"); b.setAttribute("aria-label","Écouter le message vocal de "+fmtSecs(secs));
  const bar=el("div","voice-bar"); const fill=el("i"); bar.append(fill);
  const t=el("span","voice-t",fmtSecs(secs));
  let a=null;
  const reset=()=>{ b.textContent="▶"; fill.style.width="0"; t.textContent=fmtSecs(secs); };
  b.addEventListener("click",()=>{
    if(!url) return toast("Message vocal indisponible");
    if(!a){
      a=new Audio(url); a.preload="auto";
      a.addEventListener("timeupdate",()=>{ const d=isFinite(a.duration)&&a.duration>0?a.duration:secs||1; fill.style.width=Math.min(100,a.currentTime/d*100)+"%"; t.textContent=fmtSecs(a.currentTime); });
      a.addEventListener("ended",()=>{ reset(); if(playing===a) playing=null; });
      a.addEventListener("error",()=>{ reset(); toast("Ce téléphone ne sait pas lire ce message vocal"); });
    }
    if(a.paused){ if(playing&&playing!==a) playing.pause(); playing=a; a.play().then(()=>{ b.textContent="❚❚"; }).catch(()=>toast("Lecture impossible")); }
    else{ a.pause(); b.textContent="▶"; }
  });
  w.append(b,bar,t); return w;
}
// envoi d'une photo
const picker=el("input"); picker.type="file"; picker.accept="image/*"; picker.hidden=true; document.body.append(picker);
$("#chat-photo").addEventListener("click",()=>{ if(!navigator.onLine) return toast("Pas de réseau : la photo ne peut pas partir pour l'instant"); picker.value=""; picker.click(); });
picker.addEventListener("change",async()=>{
  const f=picker.files?.[0], scope=chatScope; if(!f||(scope==="group"&&!chatGid)||(scope==="staff"&&!isAdmin())) return;
  const gid=chatGid, inp=$("#chat-input"), body=inp.value.trim()||null, bt=$("#chat-photo"), bucket=scope==="staff"?"staff-media":"photos";
  bt.disabled=true; toast("Envoi de la photo…");
  try{
    const blob=await A.compress(f);
    const path=scope==="staff"?A.me.id+"/chat-"+Date.now()+".jpg":gid+"/"+A.me.id+"/chat-"+Date.now()+".jpg";
    const up=await A.sb.storage.from(bucket).upload(path,blob,{contentType:"image/jpeg"});
    if(up.error) throw up.error;
    const row={user_id:A.me.id,body,photo_path:path}; if(scope==="group") row.group_id=gid;
    const {data,error}=await A.sb.from(scope==="staff"?"staff_messages":"messages").insert(row).select("id,user_id,group_id,body,photo_path,audio_path,audio_secs,created_at").single();
    if(error){ await A.sb.storage.from(bucket).remove([path]); throw error; }
    if(body) inp.value="";
    await addMsg({...data,_scope:scope,profiles:{username:A.me.username,is_admin:A.me.is_admin,is_controller:A.me.is_controller}}); scope==="staff"?markStaffSeen():markSeen();
  }catch(e){ toast(frError(e)); }
  finally{ bt.disabled=false; }
});
// message vocal
let rec=null, recTick=null;
const MAXREC=120;
function recUI(on){
  $("#chat-rec").hidden=!on; $("#chat-form").hidden=on;
  clearInterval(recTick);
  if(on){ const t0=Date.now(); const upd=()=>{ const s=(Date.now()-t0)/1000; $("#rec-t").textContent=fmtSecs(s); if(s>=MAXREC&&rec) stopRec(false); }; upd(); recTick=setInterval(upd,250); }
}
function stopRec(cancel){ if(!rec) return; rec.cancel=cancel; try{ rec.mr.stop(); }catch(e){ rec.stream.getTracks().forEach(x=>x.stop()); rec=null; recUI(false); } }
$("#chat-mic").addEventListener("click",async()=>{
  if(rec||(chatScope==="group"&&!chatGid)||(chatScope==="staff"&&!isAdmin())) return;
  if(!navigator.onLine) return toast("Pas de réseau : le vocal ne peut pas partir pour l'instant");
  if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder) return toast("L'enregistrement audio n'est pas pris en charge sur ce téléphone");
  let stream;
  try{ stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true}}); }
  catch(e){ return toast("Autorise le micro pour l'appli dans les réglages du navigateur"); }
  const T=[["audio/webm;codecs=opus","audio/webm","webm"],["audio/mp4","audio/mp4","m4a"],["audio/ogg;codecs=opus","audio/ogg","ogg"]].find(x=>MediaRecorder.isTypeSupported(x[0]))||["","audio/webm","webm"];
  let mr;
  try{ mr=new MediaRecorder(stream,T[0]?{mimeType:T[0],audioBitsPerSecond:32000}:undefined); }
  catch(e){ stream.getTracks().forEach(x=>x.stop()); return toast("Enregistrement impossible sur ce téléphone"); }
  const gid=chatGid, scope=chatScope;
  rec={mr,stream,chunks:[],type:T,start:Date.now(),cancel:false};
  mr.ondataavailable=e=>{ if(e.data&&e.data.size) rec?.chunks.push(e.data); };
  mr.onstop=async()=>{
    const r=rec; rec=null; stream.getTracks().forEach(x=>x.stop()); recUI(false);
    if(!r||r.cancel) return;
    const secs=Math.min(MAXREC,Math.round((Date.now()-r.start)/1000));
    if(secs<1) return toast("Message trop court : appuie, parle, puis Envoyer");
    const blob=new Blob(r.chunks,{type:r.type[1]});
    toast("Envoi du vocal…");
    try{
      const bucket=scope==="staff"?"staff-media":"photos";
      const path=scope==="staff"?A.me.id+"/vocal-"+Date.now()+"."+r.type[2]:gid+"/"+A.me.id+"/vocal-"+Date.now()+"."+r.type[2];
      const up=await A.sb.storage.from(bucket).upload(path,blob,{contentType:r.type[1]});
      if(up.error) throw up.error;
      const row={user_id:A.me.id,audio_path:path,audio_secs:Math.max(1,secs)}; if(scope==="group") row.group_id=gid;
      const {data,error}=await A.sb.from(scope==="staff"?"staff_messages":"messages").insert(row).select("id,user_id,group_id,body,photo_path,audio_path,audio_secs,created_at").single();
      if(error){ await A.sb.storage.from(bucket).remove([path]); throw error; }
      urlCache.set(bucket+"|"+path,URL.createObjectURL(blob));
      await addMsg({...data,_scope:scope,profiles:{username:A.me.username,is_admin:A.me.is_admin,is_controller:A.me.is_controller}}); scope==="staff"?markStaffSeen():markSeen();
    }catch(e){ toast(frError(e)); }
  };
  mr.start(250); recUI(true);
  if(navigator.vibrate) try{ navigator.vibrate(30); }catch(e){}
});
$("#rec-cancel").addEventListener("click",()=>stopRec(true));
$("#rec-send").addEventListener("click",()=>stopRec(false));

// @mentions : surlignage et suggestions de pseudos
const MENTION=/@([A-Za-z0-9_]{3,20})/g;
function mentionsMe(t){ const u=A.me?.username?.toLowerCase(); return !!u&&[...String(t).matchAll(MENTION)].some(x=>x[1].toLowerCase()===u); }
function withMentions(t){
  const span=el("span","msg-t"); let last=0;
  for(const x of String(t).matchAll(MENTION)){
    span.append(t.slice(last,x.index)); { const mb=el("b","mention user-link","@"+x[1]); mb.dataset.user=x[1]; span.append(mb); } last=x.index+x[0].length;
  }
  span.append(t.slice(last)); return span;
}
const members=new Map();   // groupe -> pseudos actifs
async function memberNames(gid){
  const cacheKey=chatScope==="staff"?"staff":gid;
  if(members.has(cacheKey)) return members.get(cacheKey);
  if(chatScope==="staff"){
    const {data}=await A.sb.from("profiles").select("username").or("is_admin.eq.true,is_controller.eq.true");
    const v=(data||[]).map(p=>p.username).filter(Boolean).sort((a,b)=>a.localeCompare(b,"fr"));
    members.set(cacheKey,v); return v;
  }
  const {data}=await A.sb.from("memberships").select("profiles(username)").eq("group_id",gid).eq("status","active");
  const v=(data||[]).map(r=>r.profiles?.username).filter(Boolean).sort((a,b)=>a.localeCompare(b,"fr"));
  members.set(cacheKey,v); return v;
}
const sugg=el("div","mention-sugg"); sugg.hidden=true; $("#chat-form").before(sugg);
$("#chat-input").addEventListener("input",async()=>{
  const inp=$("#chat-input"), pos=inp.selectionStart, before=inp.value.slice(0,pos);
  const m=before.match(/@([A-Za-z0-9_]{0,20})$/);
  if(!m||(chatScope==="group"&&!chatGid)){ sugg.hidden=true; return; }
  const q=m[1].toLowerCase();
  const list=(await memberNames(chatGid)).filter(n=>n!==A.me.username&&n.toLowerCase().startsWith(q)).slice(0,6);
  sugg.innerHTML=""; sugg.hidden=!list.length;
  list.forEach(n=>sugg.append(btn("@"+n,"chip",()=>{
    inp.value=before.slice(0,before.length-m[0].length)+"@"+n+" "+inp.value.slice(pos);
    sugg.hidden=true; inp.focus();
  })));
});
function markSeen(){ if(chatScope==="group"&&chatGid){ store.set(seenKey(chatGid),new Date().toISOString()); unread.set(chatGid,0); renderFab(); renderTabs(); } }
function markStaffSeen(){ store.set(staffSeenKey,new Date().toISOString()); staffUnread=0; renderFab(); renderTabs(); }
function headerText(){
  if(chatScope==="staff"){
    $("#chat-title").textContent="Chat · équipe staff";
    $("#chat-sub").textContent="Salon privé des développeurs et contrôleurs";
    $("#chat-input").placeholder="Écrire à l’équipe…";
    return;
  }
  const gr=A.groups.find(x=>x.id===chatGid);
  $("#chat-title").textContent="Chat · "+(gr?.name||"");
  $("#chat-sub").textContent=A.myRoles.has(chatGid)?"Visible par les membres du groupe":"Tu suis ce chat en tant que développeur";
  $("#chat-input").placeholder="Écrire au groupe…";
}
function switchScope(scope){
  if(scope==="staff"&&!isAdmin()) return;
  if(scope!="staff") scope="group";
  if(scope===chatScope) return;
  chatScope=scope; msgs=[]; names.clear(); box.innerHTML=""; sugg.hidden=true;
  renderTabs(); headerText();
  if(!panel.hidden) loadChat();
}
scopes.addEventListener("click",e=>{ const b=e.target.closest("[data-scope]"); if(b) switchScope(b.dataset.scope); });
function switchChat(gid){
  if(gid===chatGid&&chatScope==="group") return;
  chatScope="group";
  chatGid=gid; msgs=[]; box.innerHTML="";
  store.set("cdj-chat-last",gid);
  headerText(); renderTabs(); loadChat();
}
function openChat(){
  if(!chatVisible()) return;
  if(isAdmin()&&!chatGroups().length) chatScope="staff";
  if(isAdmin()&&chatScope==="staff"){
    chatGid=null; renderTabs(); headerText(); panel.hidden=false; document.body.classList.add("chat-open"); renderFab();
    msgs=[]; box.innerHTML=""; loadChat(); clearInterval(poll); poll=setInterval(()=>{ if(!panel.hidden) loadChat(); },20000);
    setTimeout(()=>$("#chat-input").focus(),150); return;
  }
  if(isAdmin()){
    const list=chatGroups().map(g=>g.id);
    const last=store.get("cdj-chat-last",null);
    chatGid=canChat()?A.cur:(list.includes(last)?last:list[0]);
  }else if(!canChat()){ toast("Choisis un de tes groupes pour ouvrir le chat"); return; }
  else chatGid=A.cur;
  if(!chatGid) return;
  chatScope="group";
  headerText(); renderTabs();
  panel.hidden=false; document.body.classList.add("chat-open"); renderFab();
  msgs=[]; box.innerHTML=""; loadChat();
  clearInterval(poll); poll=setInterval(()=>{ if(!panel.hidden) loadChat(); },20000);
  setTimeout(()=>$("#chat-input").focus(),150);
}
function closeChat(){ if(rec) stopRec(true); if(playing){ playing.pause(); playing=null; } panel.hidden=true; document.body.classList.remove("chat-open"); clearInterval(poll); renderFab(); }
fab.addEventListener("click",openChat);
$("#chat-close").addEventListener("click",closeChat);
document.addEventListener("keydown",e=>{ if(e.key==="Escape"&&!panel.hidden) closeChat(); });
$("#chat-form").addEventListener("submit",async e=>{
  e.preventDefault();
  const inp=$("#chat-input"), body=inp.value.trim(), scope=chatScope, gid=chatGid; if(!body||(scope==="group"&&!gid)||(scope==="staff"&&!isAdmin())) return;
  inp.value=""; sugg.hidden=true;
  const row={user_id:A.me.id,body}; if(scope==="group") row.group_id=gid;
  const table=scope==="staff"?"staff_messages":"messages";
  const {data,error}=navigator.onLine?await A.sb.from(table).insert(row).select("id,user_id,group_id,body,created_at").single():{error:new Error("Failed to fetch")};
  if(scope==="group"&&error&&A.offline?.isNetErr(error)&&await A.offline.enqueue({kind:"insert",table:"messages",row})) return toast("Pas de réseau : message envoyé dès le retour du réseau");
  if(error){ inp.value=body; return toast(frError(error)); }
  await addMsg({...data,_scope:scope,profiles:{username:A.me.username,is_admin:A.me.is_admin,is_controller:A.me.is_controller}}); scope==="staff"?markStaffSeen():markSeen();
});

/* ---------- Accroches ---------- */
A.hooks.openChat=openChat;
A.hooks.groupChanged=()=>{ lastGroup=A.cur; onGroupChanged(); };
A.hooks.leaveGroup=leaveGroup;
A.hooks.change=()=>{ if(A.cur!==lastGroup){ lastGroup=A.cur; onGroupChanged(); } else if(A.sb) subscribe(); renderFab(); retryGroupPhotoCleanups(); };
A.hooks.change();
if(!$("#v-groupe").hidden) renderGroupe();   // si les données sont arrivées avant le chargement de ce fichier
})();
