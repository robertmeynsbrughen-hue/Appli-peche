// Rivio : invitations par lien et QR code, à la place du code de groupe.
// Un seul jeton : le QR encode le lien, la durée dépend de qui l'émet
// (2 h responsable/modérateur, 1 h membre simple). Côté base, la durée est
// décidée par create_group_invite(), pas ici.
(function(){
"use strict";
const A=window.CDJ; if(!A) return;
const {el,toast,frError}=A;
const $=s=>document.querySelector(s);
function btn(label,cls,fn){ const b=el("button",cls||"btn",label); b.type="button"; if(fn) b.addEventListener("click",fn); return b; }

let qrLoading=null;
function loadQR(){
  if(window.qrcode) return Promise.resolve(true);
  if(qrLoading) return qrLoading;
  qrLoading=new Promise(res=>{
    const s=document.createElement("script");
    s.src="https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js";
    s.onload=()=>res(true); s.onerror=()=>res(false);
    document.head.append(s);
  });
  return qrLoading;
}

function drawQR(canvas,text){
  if(!window.qrcode) return false;
  try{
    const qr=window.qrcode(0,"M"); qr.addData(text); qr.make();
    const n=qr.getModuleCount(), pad=12, cell=Math.max(2,Math.floor(216/n));
    const side=n*cell+pad*2;
    canvas.width=side; canvas.height=side;
    const g=canvas.getContext("2d");
    g.fillStyle="#ffffff"; g.fillRect(0,0,side,side);
    g.fillStyle="#0b0f14";
    for(let r=0;r<n;r++) for(let c=0;c<n;c++) if(qr.isDark(r,c)) g.fillRect(pad+c*cell,pad+r*cell,cell,cell);
    return true;
  }catch(e){ return false; }
}

function fmtLeft(ms){
  if(ms<=0) return "expirée";
  const m=Math.floor(ms/60000), s=Math.floor((ms%60000)/1000);
  return m>0?m+" min "+String(s).padStart(2,"0")+" s":s+" s";
}

async function openInvite(){
  const gid=typeof A.cur==="number"?A.cur:null;
  if(!gid){ toast("Choisis d'abord un groupe précis"); return; }
  const {data,error}=await A.sb.rpc("create_group_invite",{p_group:gid});
  if(error) return toast(frError(error));

  const token=data.token;
  const url=location.origin+location.pathname+"?invite="+encodeURIComponent(token)+"#groupe";
  const end=new Date(data.expires_at).getTime();

  const back=el("div","inv-back"); back.setAttribute("role","dialog"); back.setAttribute("aria-modal","true");
  const box=el("div","inv-box");
  const close=()=>{ back.remove(); clearInterval(tick); };
  back.addEventListener("click",e=>{ if(e.target===back) close(); });

  box.append(el("h2","inv-title","Inviter dans le groupe"));
  box.append(el("p","note",(data.manager?"Lien valable 2 heures":"Lien valable 1 heure")+" · un seul lien pour tout le monde."));

  const canvas=el("canvas","inv-qr");
  box.append(canvas);

  const linkRow=el("div","inv-link");
  linkRow.setAttribute("role","button"); linkRow.tabIndex=0;
  linkRow.title="Copier le lien";
  const linkTxt=el("span","inv-url",url.length>52?url.slice(0,49)+"…":url);
  linkRow.append(linkTxt, el("span","inv-copy","copier"));
  box.append(linkRow);

  const timer=el("p","note inv-left");
  box.append(timer);

  const copy=async()=>{
    try{ await navigator.clipboard.writeText(url); }
    catch(_){ const t=document.createElement("textarea"); t.value=url; document.body.append(t); t.select(); document.execCommand("copy"); t.remove(); }
    linkTxt.textContent="Lien copié !"; linkRow.classList.add("ok");
    setTimeout(()=>{ linkTxt.textContent=url.length>52?url.slice(0,49)+"…":url; linkRow.classList.remove("ok"); },1600);
  };
  linkRow.addEventListener("click",copy);
  linkRow.addEventListener("keydown",e=>{ if(e.key==="Enter"||e.key===" "){ e.preventDefault(); copy(); } });

  if(navigator.share){
    box.append(btn("📤 Envoyer le lien","btn primary",()=>{
      navigator.share({title:"Rivio",text:"Rejoins le groupe sur Rivio",url}).catch(()=>{});
    }));
  }
  box.append(btn("Fermer","linkbtn",close));
  back.append(box); document.body.append(back);

  const tick=setInterval(()=>{
    const left=end-Date.now();
    timer.textContent="Expire dans "+fmtLeft(left);
    if(left<=0){ timer.textContent="Invitation expirée"; clearInterval(tick); }
  },1000);
  timer.textContent="Expire dans "+fmtLeft(end-Date.now());

  if(await loadQR()) drawQR(canvas,url);
  else canvas.replaceWith(el("p","note","QR indisponible hors connexion — le lien ci-dessous fonctionne."));
}

// Bouton dans la section Groupe, à côté de ce que le module y affiche déjà.
const prev=A.hooks.groupeRendered;
A.hooks.groupeRendered=root=>{
  prev?.(root);
  if(!A.me||typeof A.cur!=="number"||root.querySelector(".inv-open")) return;
  const b=btn("🔗 Inviter","btn small inv-open",openInvite);
  const head=root.querySelector(".g-sec-head")||root.firstChild;
  if(head&&head.after) head.after(b); else root.prepend(b);
};

A.openInvite=openInvite;

/* ---------- Arrivée par un lien d'invitation ----------
   Le jeton est gardé sur le téléphone (24 h au plus) : il sert après la connexion,
   ou juste après la création du profil pour un nouveau venu. */
const TKEY="cdj-invite-token";
const getTok=()=>{ try{ const o=JSON.parse(localStorage.getItem(TKEY)||"null"); if(o&&Date.now()-o.at<864e5) return o.t; localStorage.removeItem(TKEY); }catch(_){} return null; };
const setTok=t=>{ try{ if(t) localStorage.setItem(TKEY,JSON.stringify({t,at:Date.now()})); else localStorage.removeItem(TKEY); }catch(_){} };
try{
  const q=new URLSearchParams(location.search), t=q.get("invite");
  if(t){ setTok(t.slice(0,128)); q.delete("invite"); history.replaceState(null,"",location.pathname+(q.toString()?"?"+q:"")+location.hash); }
}catch(_){}
let busy=false, shown=false, ready=false;   // ready : la session a été vérifiée au démarrage
async function welcome(t){
  // pas encore de compte : on dit clairement qui invite, et on propose l'inscription
  if(shown||!A.sb) return; shown=true;
  const {data}=await A.sb.rpc("peek_invite",{p_token:t});
  const info=data&&data[0];
  if(!info){ setTok(null); toast("Ce lien d'invitation a expiré : demande un nouveau lien à ton pote."); return; }
  location.hash="#profil";
  setTimeout(()=>{
    document.querySelector('#auth-mode [data-m="signup"]')?.click();
    let n=$("#invite-note"); if(!n){ n=el("p","ok-msg"); n.id="invite-note"; $("#auth-form")?.prepend(n); }
    n.textContent="👋 Tu es invité dans le groupe « "+info.name+" ». Crée ton compte ci-dessous, ou connecte-toi si tu en as déjà un : tu rejoindras le groupe automatiquement"+(info.require_approval?" (un modérateur validera ton arrivée).":".");
  },300);
}
async function redeem(){
  const t=getTok(); if(!t||busy||!A.sb||!ready) return;
  if(!A.me){ welcome(t); return; }
  busy=true;
  try{
    const {data:gid,error}=await A.sb.rpc("redeem_invite",{p_token:t});
    if(error){
      if(/profil à terminer/i.test(error.message||"")) return;   // on réessaiera après la création du profil
      setTok(null); toast(frError(error)); return;
    }
    setTok(null); $("#invite-note")?.remove();
    await A.loadGroups();
    const g=A.groups.find(x=>x.id===gid);
    if(g){ A.setGroup(gid); toast("Bienvenue dans « "+g.name+" » !"); location.hash="#fil"; }
    else toast("Demande envoyée : un modérateur doit valider ton arrivée");
  }finally{ busy=false; }
}
A.hooks.inviteReady=()=>{ ready=true; redeem(); };
const prevCh=A.hooks.change; A.hooks.change=(...a)=>{ prevCh?.(...a); if(getTok()) setTimeout(redeem,200); };
// la session a pu être vérifiée avant le chargement de ce module
if(window.CDJ_BOOTED){ ready=true; setTimeout(redeem,0); }
})();
