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
    else tick;
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
})();
