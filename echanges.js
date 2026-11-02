// Rivio : messages privés, questions-réponses et parrainage (groupe Bienvenue),
// bilan du mois du groupe.
(function(){
"use strict";
const A=window.CDJ; if(!A) return;
const {el,toast,frError,ago}=A;
const $=s=>document.querySelector(s);
function btn(label,cls,fn){ const b=el("button",cls||"btn",label); b.type="button"; if(fn) b.addEventListener("click",fn); return b; }
function sheet(title,cls){
  const back=el("div","sheet-back"), sh=el("div","sheet "+(cls||"")); sh.setAttribute("role","dialog"); sh.setAttribute("aria-modal","true"); sh.setAttribute("aria-label",title);
  const head=el("div","sheet-head"); head.append(el("h2",null,title)); const x=btn("✕","icon-btn"); x.setAttribute("aria-label","Fermer"); head.append(x); sh.append(head);
  const close=()=>{ back.remove(); onClose.forEach(f=>f()); }; const onClose=[];
  x.addEventListener("click",close); back.addEventListener("click",e=>{ if(e.target===back) close(); });
  back.append(sh); document.body.append(back);
  return {sh,close,head,onClose};
}
const hhmm=iso=>{ const d=new Date(iso), today=new Date().toDateString()===d.toDateString(); return today?d.toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"}):d.toLocaleDateString("fr-FR",{day:"numeric",month:"short"})+" "+d.toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"}); };

/* =====================================================================
   Messages privés
   ===================================================================== */
let dmUnread=0;
const dmBtn=btn("","icon-btn chat-dm-btn",()=>openInbox()); dmBtn.setAttribute("aria-label","Messages privés");
dmBtn.append(el("span",null,"✉️")); const dmBadge=el("span","tab-badge"); dmBadge.hidden=true; dmBtn.append(dmBadge);
$("#chat-close")?.before(dmBtn);
async function refreshUnread(){
  if(!A.me||!A.sb) return;
  const {count}=await A.sb.from("direct_messages").select("id",{count:"exact",head:true}).eq("to_user",A.me.id).is("read_at",null);
  dmUnread=count||0; dmBadge.hidden=!dmUnread; dmBadge.textContent=dmUnread>9?"9+":String(dmUnread);
  const fb=$("#chat-badge"); if(fb) fb.classList.toggle("has-dm",!!dmUnread);
}
async function openInbox(){
  if(!A.me) return toast("Connecte-toi pour écrire en privé");
  const {sh,close}=sheet("✉️ Messages privés","dm-sheet");
  const list=el("div","dm-list"); sh.append(list);
  sh.append(el("p","note","Pour écrire à quelqu'un, touche son pseudo puis « Écrire ». Seuls vous deux voyez la conversation."));
  list.append(el("p","note","Chargement…"));
  const {data,error}=await A.sb.rpc("dm_threads");
  list.innerHTML="";
  if(error){ list.append(el("p","err",frError(error))); return; }
  if(!data?.length){ list.append(el("p","empty small","Aucune conversation pour l'instant.")); return; }
  data.forEach(t=>{
    const r=btn("","dm-row"+(t.unread?" unread":""),()=>{ close(); openDM(t.username,t.other); });
    r.append(A.avatar(t.username));
    const c=el("div","dm-c"); const top=el("div","dm-top"); top.append(el("b",null,"@"+t.username),el("span","note",hhmm(t.last_at)));
    c.append(top, el("span","dm-last",(t.last_mine?"Toi : ":"")+t.last_body));
    r.append(c); if(t.unread) r.append(el("span","dm-n",String(t.unread)));
    list.append(r);
  });
}
async function openDM(username,uid){
  if(!A.me) return toast("Connecte-toi pour écrire en privé");
  if(!uid){ const {data}=await A.sb.from("profiles").select("id").eq("username",username).maybeSingle(); uid=data?.id; }
  if(!uid) return toast("Membre introuvable");
  if(uid===A.me.id) return toast("C'est toi !");
  const {sh,close,head,onClose}=sheet("@"+username,"dm-sheet dm-thread");
  const {data:blk}=await A.sb.from("dm_blocks").select("blocked").eq("user_id",A.me.id).eq("blocked",uid).maybeSingle();
  let isBlocked=!!blk;
  const more=btn(isBlocked?"Débloquer":"Bloquer","linkbtn danger dm-block",async()=>{
    if(!isBlocked&&!confirm("Bloquer @"+username+" ? Cette personne ne pourra plus t'écrire en privé.")) return;
    const {error}=isBlocked?await A.sb.from("dm_blocks").delete().eq("user_id",A.me.id).eq("blocked",uid):await A.sb.from("dm_blocks").insert({user_id:A.me.id,blocked:uid});
    if(error) return toast(frError(error));
    isBlocked=!isBlocked; more.textContent=isBlocked?"Débloquer":"Bloquer"; toast(isBlocked?"@"+username+" ne peut plus t'écrire":"@"+username+" débloqué");
  });
  head.querySelector("h2").after(more);
  const box=el("div","dm-msgs"); sh.append(box);
  const f=el("form","chat-form dm-form"); const inp=el("input"); inp.maxLength=2000; inp.placeholder="Écrire à @"+username+"…"; inp.setAttribute("aria-label","Message privé"); inp.autocomplete="off";
  const send=el("button","btn primary"); send.type="submit"; send.setAttribute("aria-label","Envoyer"); send.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12l16-8-6 16-2-7z"/></svg>'; f.append(inp,send); sh.append(f);
  let last="";
  async function load(){
    const {data,error}=await A.sb.from("direct_messages").select("id,user_id,to_user,body,created_at,read_at").or("and(user_id.eq."+A.me.id+",to_user.eq."+uid+"),and(user_id.eq."+uid+",to_user.eq."+A.me.id+")").order("created_at",{ascending:false}).limit(100);
    if(error){ box.innerHTML=""; box.append(el("p","err",frError(error))); return; }
    const list=(data||[]).reverse(), key=list.map(m=>m.id+":"+(m.read_at?1:0)).join(",");
    if(key===last) return; last=key;
    box.innerHTML="";
    if(!list.length) box.append(el("p","empty small","Écris le premier message à @"+username+"."));
    list.forEach(m=>{ const mine=m.user_id===A.me.id; const row=el("div","msg"+(mine?" mine":"")); const b=el("div","bubble"); b.append(document.createTextNode(m.body)); b.append(el("span","msg-h",hhmm(m.created_at)+(mine&&m.read_at?" · lu":""))); row.append(b);
      // message reçu : on peut le signaler au staff (appui long ou clic droit, ou le petit drapeau)
      if(!mine&&A.report){ const rep=()=>A.report({kind:"dm",target_id:m.id,group_id:null,excerpt:m.body,author_id:m.user_id}); b.addEventListener("contextmenu",ev=>{ ev.preventDefault(); rep(); }); const f=btn("⚑","linkbtn dm-flag",rep); f.setAttribute("aria-label","Signaler ce message au staff"); f.title="Signaler au staff"; row.append(f); }
      box.append(row); });
    requestAnimationFrame(()=>{ box.scrollTop=box.scrollHeight; });
    if(list.some(m=>m.to_user===A.me.id&&!m.read_at)){ await A.sb.rpc("dm_mark_read",{p_from:uid}); refreshUnread(); }
  }
  f.addEventListener("submit",async e=>{
    e.preventDefault(); const body=inp.value.trim(); if(!body) return;
    send.disabled=true;
    const {error}=await A.sb.from("direct_messages").insert({user_id:A.me.id,to_user:uid,body});
    send.disabled=false;
    if(error) return toast(/row-level|violates/i.test(error.message||"")?"Impossible d'écrire à @"+username+" pour le moment":frError(error));
    inp.value=""; last=""; load();
  });
  await load(); inp.focus();
  const t=setInterval(()=>{ if(!document.hidden) load(); },8000);
  onClose.push(()=>clearInterval(t));
}
A.openDM=openDM; A.openInbox=openInbox;

// bouton « Écrire » sur le profil public
new MutationObserver(()=>{
  document.querySelectorAll(".pf-id:not([data-dm])").forEach(t=>{
    t.dataset.dm="1";
    const name=t.querySelector(".post-user")?.dataset.user; if(!name||!A.me||name===A.me.username) return;
    const b=btn("✉️ Écrire","btn small pf-dm",()=>{ t.closest(".sheet-back")?.remove(); openDM(name); });
    t.append(b);
  });
}).observe(document.body,{childList:true,subtree:true});

/* =====================================================================
   Groupe : questions-réponses et parrainage (Bienvenue), bilan du mois
   ===================================================================== */
const MONTHS=["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];
async function monthCard(host,gid){
  const {data:s,error}=await A.sb.rpc("my_group_month",{p_group:gid});
  if(error||!s||(!s.catches&&!s.messages)) return;
  const m=new Date(s.month+"T12:00:00Z");
  const c=el("section","g-sec month-card"); c.dataset.sub="activite";
  c.append(el("h3",null,"📊 "+MONTHS[m.getUTCMonth()][0].toUpperCase()+MONTHS[m.getUTCMonth()].slice(1)+" dans le groupe"));
  const k=el("div","kpis");
  const kpi=(v,l)=>{ const d=el("div","kpi"); d.append(el("div","kpi-v",String(v)),el("div","kpi-l",l)); k.append(d); };
  kpi(s.catches,"prise"+(s.catches>1?"s":"")); kpi(s.species,"espèce"+(s.species>1?"s":"")); kpi(s.anglers,"pêcheur"+(s.anglers>1?"s":"")); kpi(s.messages,"message"+(s.messages>1?"s":""));
  c.append(k);
  const lines=[];
  if(s.biggest) lines.push("🏆 Plus gros : "+s.biggest.species+" de "+String(s.biggest.length_cm).replace(".",",")+" cm par @"+s.biggest.username);
  if(s.top&&s.top.n>1) lines.push("🔥 Le plus actif : @"+s.top.username+" ("+s.top.n+" prises)");
  lines.forEach(l=>c.append(el("p","note",l)));
  host.prepend(c);
}

async function qaSection(host,gid){
  const s=el("section","g-sec qa-sec"); s.dataset.sub="activite";
  const h=el("div","g-sec-head"); h.append(el("h2",null,"❓ Questions-réponses")); s.append(h);
  s.append(el("p","note","Pose ta question : les pêcheurs du groupe te répondent, et la meilleure réponse reste en tête pour les suivants."));
  const ask=btn("✍️ Poser une question","btn primary small",()=>askSheet(gid,()=>draw())); s.append(ask);
  const list=el("div","qa-list"); s.append(list);
  host.append(s);
  async function draw(){
    list.innerHTML="";
    const {data,error}=await A.sb.from("qa_questions").select("id,user_id,title,body,best_answer_id,created_at,profiles(username),qa_answers(count)").eq("group_id",gid).order("created_at",{ascending:false}).limit(30);
    if(error){ list.append(el("p","err",frError(error))); return; }
    if(!data.length){ list.append(el("p","empty small","Aucune question pour l'instant. Lance-toi !")); return; }
    data.forEach(q=>{
      const n=q.qa_answers?.[0]?.count||0;
      const r=btn("","qa-row",()=>openQuestion(q.id,()=>draw()));
      r.append(el("span","qa-ic",q.best_answer_id?"✅":n?"💬":"❓"));
      const c=el("div","qa-c"); c.append(el("b",null,q.title), el("span","note","@"+(q.profiles?.username||"?")+" · "+ago(q.created_at)+" · "+(n?n+" réponse"+(n>1?"s":""):"pas encore de réponse")));
      r.append(c); list.append(r);
    });
  }
  await draw();
  const want=new URLSearchParams(location.search).get("qa");
  if(want){ history.replaceState(null,"",location.pathname+location.hash); openQuestion(Number(want),()=>draw()); }
}
function askSheet(gid,done){
  const {sh,close}=sheet("Poser une question");
  const f=el("form","qa-form");
  const tl=el("label","field","Ta question"); const ti=el("input"); ti.maxLength=140; ti.required=true; ti.placeholder="Ex. : quel fil pour débuter le brochet ?"; tl.append(ti);
  const bl=el("label","field","Précisions (facultatif)"); const bi=el("textarea"); bi.maxLength=1000; bi.rows=4; bi.placeholder="Ton matériel, l'endroit, ce que tu as déjà essayé…"; bl.append(bi);
  const ok=el("button","btn primary","Publier la question"); ok.type="submit";
  f.append(tl,bl,ok); sh.append(f);
  f.addEventListener("submit",async e=>{
    e.preventDefault(); if(ti.value.trim().length<5) return toast("Question trop courte");
    ok.disabled=true;
    const {error}=await A.sb.from("qa_questions").insert({group_id:gid,user_id:A.me.id,title:ti.value.trim(),body:bi.value.trim()||null});
    ok.disabled=false; if(error) return toast(frError(error));
    close(); toast("❓ Question publiée"); done?.();
  });
  setTimeout(()=>ti.focus(),50);
}
async function openQuestion(id,done){
  const {sh,close,onClose}=sheet("Question","qa-sheet");
  onClose.push(()=>done?.());
  const body=el("div"); sh.append(body);
  async function draw(){
    const [{data:q,error},{data:ans}]=await Promise.all([
      A.sb.from("qa_questions").select("id,group_id,user_id,title,body,best_answer_id,created_at,profiles(username)").eq("id",id).maybeSingle(),
      A.sb.from("qa_answers").select("id,user_id,body,created_at,profiles(username)").eq("question_id",id).order("created_at"),
    ]);
    body.innerHTML="";
    if(error||!q){ body.append(el("p","err",error?frError(error):"Question introuvable ou supprimée.")); return; }
    const canBest=q.user_id===A.me.id||A.canModerate?.(q.group_id);
    body.append(el("h3","qa-title",q.title));
    const by=el("p","note"); by.append(A.userLabel(q.profiles?.username)," · "+ago(q.created_at)); body.append(by);
    if(q.body) body.append(el("p","qa-body",q.body));
    if(q.user_id===A.me.id||A.canModerate?.(q.group_id)) body.append(btn("Supprimer la question","linkbtn danger",async()=>{ if(!confirm("Supprimer cette question et ses réponses ?")) return; const {error}=await A.sb.from("qa_questions").delete().eq("id",q.id); if(error) return toast(frError(error)); toast("Question supprimée"); close(); }));
    const list=(ans||[]).slice().sort((a,b)=>(b.id===q.best_answer_id)-(a.id===q.best_answer_id));
    body.append(el("h4","g-sub",list.length?list.length+" réponse"+(list.length>1?"s":""):"Pas encore de réponse"));
    list.forEach(a=>{
      const best=a.id===q.best_answer_id;
      const c=el("div","qa-ans"+(best?" best":""));
      if(best) c.append(el("span","qa-best","✅ Meilleure réponse"));
      const t=el("div","qa-ans-by"); t.append(A.userLabel(a.profiles?.username)); if(A.fishTags) t.append(A.fishTags(a.profiles?.username)); t.append(el("span","note"," "+ago(a.created_at))); c.append(t);
      c.append(el("p",null,a.body));
      const act=el("div","actions");
      if(canBest) act.append(btn(best?"Retirer « meilleure réponse »":"✅ Meilleure réponse","linkbtn",async()=>{ const {error}=await A.sb.rpc("qa_set_best",{p_question:q.id,p_answer:best?null:a.id}); if(error) return toast(frError(error)); draw(); }));
      if(a.user_id===A.me.id||A.canModerate?.(q.group_id)) act.append(btn("Supprimer","linkbtn danger",async()=>{ const {error}=await A.sb.from("qa_answers").delete().eq("id",a.id); if(error) return toast(frError(error)); draw(); }));
      if(a.user_id!==A.me.id&&a.profiles?.username) act.append(btn("✉️ Écrire","linkbtn",()=>{ close(); openDM(a.profiles.username,a.user_id); }));
      if(act.childElementCount) c.append(act);
      body.append(c);
    });
    const f=el("form","qa-form"); const ti=el("textarea"); ti.maxLength=1500; ti.rows=3; ti.placeholder="Ta réponse…"; ti.setAttribute("aria-label","Ta réponse");
    const ok=el("button","btn primary small","Répondre"); ok.type="submit"; f.append(ti,ok); body.append(f);
    f.addEventListener("submit",async e=>{
      e.preventDefault(); if(ti.value.trim().length<2) return;
      ok.disabled=true; const {error}=await A.sb.from("qa_answers").insert({question_id:q.id,user_id:A.me.id,body:ti.value.trim()}); ok.disabled=false;
      if(error) return toast(frError(error)); toast("💬 Réponse publiée"); draw();
    });
  }
  await draw();
}

async function mentorSection(host){
  const s=el("section","g-sec mentor-sec"); s.dataset.sub="activite";
  const h=el("div","g-sec-head"); h.append(el("h2",null,"🤝 Parrainage")); s.append(h);
  host.append(s);
  const body=el("div"); s.append(body);
  async function draw(){
    body.innerHTML="";
    const [{data:my},{data:kids},{data:prof}]=await Promise.all([
      A.sb.from("mentorships").select("mentor,created_at,p:profiles!mentorships_mentor_fkey(username)").eq("mentee",A.me.id).maybeSingle(),
      A.sb.from("mentorships").select("mentee,created_at,p:profiles!mentorships_mentee_fkey(username)").eq("mentor",A.me.id),
      A.sb.from("profiles").select("mentor_available").eq("id",A.me.id).maybeSingle(),
    ]);
    if(my){
      const c=el("div","mentor-me"); c.append(el("span",null,"Ton parrain : "),A.userLabel(my.p?.username)); if(A.fishTags) c.append(A.fishTags(my.p?.username));
      const a=el("div","actions"); a.append(btn("✉️ Lui écrire","btn small primary",()=>openDM(my.p.username,my.mentor)), btn("Arrêter le parrainage","linkbtn danger",async()=>{ if(!confirm("Arrêter le parrainage ?")) return; const {error}=await A.sb.from("mentorships").delete().eq("mentee",A.me.id); if(error) return toast(frError(error)); draw(); }));
      c.append(a); body.append(c);
    }else{
      body.append(el("p","note","Nouveau sur Rivio ou dans la pêche ? Choisis un parrain : un pêcheur expérimenté qui répond à tes questions en privé."));
      const {data:ms,error}=await A.sb.rpc("list_mentors");
      if(error) body.append(el("p","err",frError(error)));
      else if(!ms?.length) body.append(el("p","empty small","Aucun parrain disponible pour l'instant."));
      else ms.forEach(m=>{
        const r=el("div","mentor-row");
        const l=el("div"); l.append(A.userLabel(m.username)); if(A.fishTags) l.append(A.fishTags(m.username)); if(m.bio) l.append(el("span","note",m.bio));
        r.append(l, btn("Choisir","btn small",async()=>{ const {error}=await A.sb.rpc("choose_mentor",{p_mentor:m.id}); if(error) return toast(frError(error)); toast("🤝 @"+m.username+" est ton parrain ! Il est prévenu."); draw(); }));
        body.append(r);
      });
    }
    if(kids?.length){ const k=el("div","mentor-kids"); k.append(el("h4","g-sub","Tes filleuls ("+kids.length+"/3)")); kids.forEach(x=>{ const r=el("div","mentor-row"); r.append(A.userLabel(x.p?.username), btn("✉️ Écrire","btn small",()=>openDM(x.p.username,x.mentee))); k.append(r); }); body.append(k); }
    const lab=el("label","check mentor-vol"); const cb=el("input"); cb.type="checkbox"; cb.checked=!!prof?.mentor_available;
    lab.append(cb,document.createTextNode(" Je veux bien parrainer les nouveaux (3 filleuls maximum)"));
    cb.addEventListener("change",async()=>{ const {error}=await A.sb.rpc("set_mentor_available",{p_on:cb.checked}); if(error){ cb.checked=!cb.checked; return toast(frError(error)); } toast(cb.checked?"Merci ! Les nouveaux peuvent te choisir comme parrain":"Tu n'apparais plus dans la liste des parrains"); });
    body.append(lab);
  }
  await draw();
}

const prevGX=A.hooks.groupeExtras;
A.hooks.groupeExtras=(box,gid,mod)=>{
  prevGX?.(box,gid,mod);
  if(!A.me||!A.sb) return;
  const host=el("div","g-echanges"); host.dataset.sub="activite"; box.before(host);   // à côté : extras.js vide le bloc en arrivant
  const g=(A.groups||[]).find(x=>x.id===gid);
  (async()=>{
    await monthCard(host,gid);
    if(g?.is_welcome){ await qaSection(host,gid); await mentorSection(host); }
  })().catch(e=>console.warn(e));
};

/* =====================================================================
   Lien d'invitation personnel : badge d'ambassadeur
   ===================================================================== */
const PKEY="cdj-parrain";
(function catchRef(){
  const p=new URLSearchParams(location.search), who=p.get("parrain");
  if(!who||!/^[A-Za-z0-9_]{3,20}$/.test(who)) return;
  try{ localStorage.setItem(PKEY,JSON.stringify({u:who,t:Date.now()})); }catch(_){}
  p.delete("parrain"); const q=p.toString(); history.replaceState(null,"",location.pathname+(q?"?"+q:"")+location.hash);
})();
let refTried=false;
async function applyRef(){
  if(refTried||!A.me||!A.sb) return;
  let r=null; try{ r=JSON.parse(localStorage.getItem(PKEY)||"null"); }catch(_){}
  if(!r) return;
  refTried=true;
  try{ localStorage.removeItem(PKEY); }catch(_){}
  if(Date.now()-r.t>30*864e5||r.u.toLowerCase()===A.me.username.toLowerCase()) return;
  const {data}=await A.sb.rpc("set_referrer",{p_username:r.u});
  if(data) toast("🎉 Bienvenue ! @"+r.u+" t'a fait découvrir Rivio");
}
const LEVELS=[[10,"🥇","Ambassadeur or"],[5,"🥈","Ambassadeur argent"],[1,"🥉","Ambassadeur"]];
const levelOf=n=>LEVELS.find(([k])=>n>=k)||null;
const inviteUrl=()=>location.origin+location.pathname.replace(/[^/]*$/,"")+"?parrain="+encodeURIComponent(A.me.username);
async function ambassadorCard(){
  const pub=$("#pub-profile"); if(!pub||!A.me) return;
  let c=$("#ambassadeur");
  if(!c){ c=el("div","panel ambassadeur"); c.id="ambassadeur"; c.dataset.sub=pub.dataset.sub||"moi"; pub.after(c); }
  const {data:n}=await A.sb.rpc("referral_count",{p_user:A.me.id});
  c.innerHTML="";
  const h=el("div","g-sec-head"); h.append(el("h2",null,"📣 Invite tes potes")); c.append(h);
  const lv=levelOf(n||0), next=LEVELS.slice().reverse().find(([k])=>(n||0)<k);
  c.append(el("p","note",lv?lv[1]+" "+lv[2]+" · "+n+" ami"+(n>1?"s":"")+" pêche"+(n>1?"nt":"")+" grâce à toi.":"Partage ton lien : dès qu'un ami inscrit grâce à lui publie sa première prise, tu deviens ambassadeur."));
  if(next) c.append(el("p","note amb-next","Prochain palier : "+next[1]+" "+next[2]+" à "+next[0]+" ami"+(next[0]>1?"s":"")+"."));
  const link=el("input","amb-link"); link.readOnly=true; link.value=inviteUrl(); link.setAttribute("aria-label","Ton lien d'invitation");
  const act=el("div","actions");
  act.append(btn("📤 Partager mon lien","btn primary small",async()=>{
    const data={title:"Rivio",text:"Je note mes prises et je suis les bonnes conditions de pêche sur Rivio. Rejoins-moi :",url:link.value};
    try{ if(navigator.share){ await navigator.share(data); return; } }catch(e){ if(e?.name==="AbortError") return; }
    try{ await navigator.clipboard.writeText(link.value); toast("Lien copié"); }catch(_){ link.select(); toast("Copie le lien affiché"); }
  }));
  act.append(btn("Copier","btn small",async()=>{ try{ await navigator.clipboard.writeText(link.value); toast("Lien copié"); }catch(_){ link.select(); } }));
  c.append(link,act);
}
const prevPr=A.hooks.profil; A.hooks.profil=(...a)=>{ prevPr?.(...a); setTimeout(()=>ambassadorCard().catch(()=>{}),50); };
let ambDone=null; function ambMaybe(){ if(A.me&&ambDone!==A.me.id&&$("#pub-profile")){ ambDone=A.me.id; ambassadorCard().catch(()=>{ ambDone=null; }); } if(!A.me){ ambDone=null; $("#ambassadeur")?.remove(); } }
// badge sur le profil public
const seenAmb=new Map();
new MutationObserver(()=>{
  document.querySelectorAll(".pf-id:not([data-amb])").forEach(async t=>{
    t.dataset.amb="1";
    const name=t.querySelector(".post-user")?.dataset.user; if(!name||!A.sb) return;
    let n=seenAmb.get(name);
    if(n==null){ const {data:p}=await A.sb.from("profiles").select("id").eq("username",name).maybeSingle(); if(!p) return; const {data}=await A.sb.rpc("referral_count",{p_user:p.id}); n=data||0; seenAmb.set(name,n); }
    const lv=levelOf(n); if(!lv) return;
    const b=el("span","amb-badge",lv[1]+" "+lv[2]+" · "+n+" ami"+(n>1?"s":"")+" invité"+(n>1?"s":""));
    const tags=t.querySelector(".fish-tags"); (tags||t.querySelector("h2"))?.after(b);
  });
}).observe(document.body,{childList:true,subtree:true});

/* ---------- Ouverture depuis une notification ---------- */
function fromUrl(){
  const p=new URLSearchParams(location.search), dm=p.get("dm");
  if(dm&&A.me){ history.replaceState(null,"",location.pathname+location.hash); openDM(dm); }
  const qa=p.get("qa");
  if(qa&&A.me&&location.hash!=="#groupe"){ const w=(A.groups||[]).find(x=>x.is_welcome); if(w&&A.cur!==w.id) A.setGroup?.(w.id); location.hash="#groupe"; }
}
const prevCh=A.hooks.change; A.hooks.change=(...a)=>{ prevCh?.(...a); refreshUnread(); fromUrl(); applyRef(); ambMaybe(); };
setInterval(()=>{ if(!document.hidden) refreshUnread(); },60000);
if(A.me){ refreshUnread(); fromUrl(); applyRef(); ambMaybe(); }
})();
