// Rivio : centre de notifications (cloche dans l'en-tête) et invitation par lien ou QR code.
(function(){
"use strict";
const A=window.CDJ; if(!A) return;
const {el,toast,frError,ago}=A;
const $=s=>document.querySelector(s);
function btn(label,cls,fn){ const b=el("button",cls||"btn",label); b.type="button"; if(fn) b.addEventListener("click",fn); return b; }
function sheet(title,cls){
  const back=el("div","sheet-back"), sh=el("div","sheet "+(cls||"")); sh.setAttribute("role","dialog"); sh.setAttribute("aria-modal","true"); sh.setAttribute("aria-label",title);
  const head=el("div","sheet-head"); head.append(el("h2",null,title)); const x=btn("✕","icon-btn"); x.setAttribute("aria-label","Fermer"); head.append(x); sh.append(head);
  const close=()=>back.remove(); x.addEventListener("click",close); back.addEventListener("click",e=>{ if(e.target===back) close(); });
  back.append(sh); document.body.append(back); return {sh,close};
}

/* =================== Centre de notifications =================== */
const head=$(".app-head-in");
const bell=el("button","notif-bell"); bell.type="button"; bell.id="notif-bell"; bell.hidden=true; bell.setAttribute("aria-label","Notifications");
bell.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 17V11a6 6 0 0 1 12 0v6l2 2H4z"/><path d="M10 21a2 2 0 0 0 4 0"/></svg>';
const badge=el("span","notif-badge"); badge.hidden=true; bell.append(badge);
const chat=$("#chat-fab"); if(chat) chat.before(bell); else head?.append(bell);
let unread=0, cSeq=0;
async function count(){
  if(!A.me){ bell.hidden=true; return; }
  bell.hidden=false;
  const s=++cSeq;
  const {count:n,error}=await A.sb.from("notifications").select("id",{count:"exact",head:true}).eq("user_id",A.me.id).is("read_at",null);
  if(s!==cSeq||error) return;
  unread=n||0; badge.textContent=unread>9?"9+":String(unread); badge.hidden=!unread;
  bell.setAttribute("aria-label","Notifications"+(unread?" ("+unread+" non lue"+(unread>1?"s":"")+")":""));
}
const ICON=[[/^post-/,"🎣"],[/^pend-/,"🕓"],[/^com-/,"💬"],[/^ment-/,"📣"],[/^req-|^ok-/,"🙋"],[/^rep-/,"⚑"],[/^spot-/,"📍"],[/^poll-/,"📊"],[/^memo-/,"📌"],[/^sess-/,"🧾"],[/^comp-|^photo-mois/,"🏆"],[/^out/,"📅"],[/^chal-/,"🏅"],[/^chk-/,"📍"],[/^wake-/,"⏰"],[/^storm/,"⛈️"],[/^flood/,"🌊"],[/^bait-/,"🥣"],[/^morning/,"🌤️"],[/^permit/,"🎫"],[/^regl-/,"🗓️"],[/^env-/,"🌿"]];
const iconOf=t=>{ for(const [r,i] of ICON) if(r.test(t||"")) return i; return "🔔"; };
async function openCenter(){
  const {sh,close}=sheet("Notifications","notif-sheet");
  const tools=el("div","actions notif-tools"); sh.append(tools);
  const list=el("div","notif-list"); sh.append(list);
  list.append(el("p","note","Chargement…"));
  const {data,error}=await A.sb.from("notifications").select("id,title,body,url,tag,created_at,read_at").eq("user_id",A.me.id).order("created_at",{ascending:false}).limit(60);
  list.innerHTML="";
  if(error){ list.append(el("p","err",frError(error))); return; }
  if(!data.length){ const e=el("div","empty-state"); e.append(el("div","es-ico","🔔"),el("b",null,"Aucune notification"),el("p",null,"Les nouvelles prises, commentaires, alertes et rappels apparaîtront ici, même si tu as raté la notification sur ton téléphone.")); list.append(e); return; }
  data.forEach(n=>{
    const r=btn("","notif-item"+(n.read_at?"":" unread"),()=>{
      close(); const h=(n.url||"").split("#")[1]; if(h) location.hash="#"+h;
    });
    r.append(el("span","ni-ico",iconOf(n.tag)));
    const t=el("div","ni-t"); t.append(el("b",null,n.title)); if(n.body) t.append(el("span",null,n.body)); t.append(el("span","note",ago(n.created_at)));
    r.append(t); list.append(r);
  });
  tools.append(btn("🗑️ Tout effacer","linkbtn danger",async()=>{ if(!confirm("Effacer toutes tes notifications ?")) return; const {error}=await A.sb.from("notifications").delete().eq("user_id",A.me.id); if(error) return toast(frError(error)); close(); count(); toast("Notifications effacées"); }));
  // ouvrir le centre marque tout comme lu
  if(data.some(n=>!n.read_at)){ await A.sb.from("notifications").update({read_at:new Date().toISOString()}).eq("user_id",A.me.id).is("read_at",null); count(); }
}
bell.addEventListener("click",()=>{ if(A.me) openCenter(); });
document.addEventListener("visibilitychange",()=>{ if(document.visibilityState==="visible") count(); });
navigator.serviceWorker?.addEventListener?.("message",()=>count());
setInterval(()=>{ if(document.visibilityState==="visible") count(); },120000);

/* =================== Invitation par lien et QR code =================== */
const base=()=>location.origin+location.pathname;
const linkOf=code=>base()+"?rejoindre="+encodeURIComponent(code);
let qrLib=null;
function loadQR(){
  if(window.QRCode) return Promise.resolve();
  if(qrLib) return qrLib;
  qrLib=new Promise((res,rej)=>{ const s=document.createElement("script"); s.src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"; s.onload=res; s.onerror=()=>{ qrLib=null; rej(); }; document.head.append(s); });
  return qrLib;
}
function invite(code,name){
  const {sh}=sheet("Inviter dans « "+name+" »","invite-sheet");
  const url=linkOf(code);
  sh.append(el("p","note","Ton pote ouvre le lien ou scanne le QR code : il arrive directement sur l'inscription, avec le groupe déjà choisi."));
  const qr=el("div","invite-qr"); qr.append(el("span","note","QR code…")); sh.append(qr);
  loadQR().then(()=>{ qr.innerHTML=""; new window.QRCode(qr,{text:url,width:220,height:220,colorDark:"#0b3229",colorLight:"#ffffff",correctLevel:window.QRCode.CorrectLevel.M}); }).catch(()=>{ qr.innerHTML=""; qr.append(el("span","note","QR code indisponible hors ligne : partage le lien.")); });
  const lk=el("div","invite-link"); lk.append(el("code",null,url)); sh.append(lk);
  const a=el("div","actions");
  if(navigator.share) a.append(btn("📤 Partager le lien","btn primary",()=>navigator.share({title:"Rivio",text:"Rejoins notre groupe de pêche « "+name+" » sur Rivio 🎣",url}).catch(()=>{})));
  a.append(btn("📋 Copier","btn",async()=>{ try{ await navigator.clipboard.writeText(url); toast("Lien copié"); }catch(_){ toast(url); } }));
  sh.append(a, el("p","note","Le lien contient le code du groupe : partage-le seulement avec les personnes que tu veux inviter. Change le code dans les réglages du groupe pour invalider les anciens liens."));
}
A.invite={open:invite,link:linkOf};

// arrivée par un lien d'invitation
let pending=null;
try{
  const q=new URLSearchParams(location.search), c=q.get("rejoindre");
  if(c){ pending=c.slice(0,40); localStorage.setItem("cdj-invite",pending); q.delete("rejoindre"); history.replaceState(null,"",location.pathname+(q.toString()?"?"+q:"")+location.hash); }
  else pending=localStorage.getItem("cdj-invite");
}catch(_){}
let shownOut=false, shownIn=false;
async function handleInvite(){
  if(!pending||!A.sb) return;
  if(A.me){ if(shownIn) return; shownIn=true; } else { if(shownOut) return; shownOut=true; }
  const {data:g}=await A.sb.rpc("check_invite",{p_code:pending});
  if(!g||!g.length){ try{ localStorage.removeItem("cdj-invite"); }catch(_){} pending=null; toast("Ce lien d'invitation n'est plus valable : demande un nouveau lien."); return; }
  const info=g[0];
  if(!A.me){
    // pas connecté : inscription ou connexion, code pré-rempli
    location.hash="#profil";
    setTimeout(()=>{
      document.querySelector('#auth-mode [data-m="signup"]')?.click();
      const c=$("#a-code"); if(c) c.value=pending;
      const j=$("#j-code"); if(j) j.value=pending;
      let n=$("#invite-note"); if(!n){ n=el("p","ok-msg"); n.id="invite-note"; $("#auth-form")?.prepend(n); }
      n.textContent="👋 Tu es invité dans le groupe « "+info.name+" ». Crée ton compte ci-dessous (le code est déjà rempli), ou connecte-toi si tu en as déjà un : on te proposera de le rejoindre.";
    },300);
    return;
  }
  if(A.groups.some(x=>x.name===info.name)){ try{ localStorage.removeItem("cdj-invite"); }catch(_){} pending=null; return; }
  const {sh,close}=sheet("Invitation","invite-sheet");
  sh.append(el("p",null,"Tu es invité à rejoindre le groupe « "+info.name+" »"+(info.region?" ("+info.region+")":"")+"."));
  if(info.full_group) sh.append(el("p","err","Ce groupe est complet."));
  else if(info.require_approval) sh.append(el("p","note","Un modérateur validera ta demande."));
  const a=el("div","actions");
  const ok=btn("👥 Rejoindre le groupe","btn primary",async()=>{
    ok.disabled=true;
    const {data:gid,error}=await A.sb.rpc("join_group",{p_code:pending});
    if(error){ ok.disabled=false; return toast(frError(error)); }
    try{ localStorage.removeItem("cdj-invite"); }catch(_){} pending=null; close();
    await A.loadGroups();
    toast(info.require_approval?"Demande envoyée : un modérateur doit la valider":"Bienvenue dans « "+info.name+" » !");
    if(gid&&!info.require_approval) location.hash="#fil";
  });
  ok.disabled=!!info.full_group;
  a.append(ok,btn("Plus tard","linkbtn",()=>{ try{ localStorage.removeItem("cdj-invite"); }catch(_){} pending=null; close(); }));
  sh.append(a);
}

const prevC=A.hooks.change; A.hooks.change=(...a)=>{ prevC?.(...a); count(); if(pending) setTimeout(handleInvite,300); };
count(); if(pending) setTimeout(handleInvite,900);
})();
