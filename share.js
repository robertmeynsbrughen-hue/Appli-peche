// Coup du Jour : partage d'une prise par lien public, et rappel de la carte de pêche.
(function(){
"use strict";
const A=window.CDJ; if(!A) return;
const {el,toast,frError}=A;
const $=s=>document.querySelector(s);
function btn(label,cls,fn){ const b=el("button",cls||"btn",label); b.type="button"; if(fn) b.addEventListener("click",fn); return b; }

/* ---------- Partager une prise hors de l'appli ---------- */
async function share(post){
  let token=null;
  const {data:ex}=await A.sb.from("post_shares").select("token").eq("post_id",post.id).limit(1);
  if(ex&&ex[0]) token=ex[0].token;
  else{
    const {data,error}=await A.sb.from("post_shares").insert({post_id:post.id,user_id:A.me.id}).select("token").single();
    if(error) return toast(frError(error));
    token=data.token;
  }
  const url=new URL("share.html?t="+token,location.href).href;
  const title=(post.species||"Ma prise")+(post.length_cm?" de "+String(post.length_cm).replace(".",",")+" cm":"");
  try{
    if(navigator.share){ await navigator.share({title:title+" · Coup du Jour",text:"Regarde ma prise ! 🎣",url}); return; }
  }catch(e){ if(e&&e.name==="AbortError") return; }
  try{ await navigator.clipboard.writeText(url); toast("Lien copié : colle-le dans un message"); }
  catch(e){ prompt("Lien de partage :",url); }
}
const prevFX=A.hooks.feedExtras;
A.hooks.feedExtras=list=>{
  prevFX?.(list);
  list.forEach(({post,foot})=>{
    if(!foot.isConnected||post.user_id!==A.me?.id||foot.querySelector(".share-btn")) return;
    const b=btn("🔗 Partager","linkbtn share-btn",()=>share(post));
    b.title="Envoyer un lien vers cette prise, visible sans compte";
    (foot.querySelector(".actions")||foot).prepend(b);
  });
};

/* ---------- Carte de pêche ---------- */
async function permitPanel(){
  const box=$("#permit-panel"); if(!box) return;
  if(!A.me){ box.hidden=true; return; }
  box.hidden=false;
  const {data}=await A.sb.from("profiles").select("permit_end").eq("id",A.me.id).maybeSingle();
  const end=data?.permit_end||null;
  box.innerHTML="";
  box.append(el("h2",null,"🎫 Ma carte de pêche"));
  if(end){
    const d=new Date(end+"T12:00:00"), days=Math.ceil((d-new Date())/864e5);
    box.append(el("p",days<0?"warn":days<=30?"warn":"note",days<0?"Expirée depuis le "+d.toLocaleDateString("fr-FR",{day:"numeric",month:"long",year:"numeric"})+".":"Valable jusqu'au "+d.toLocaleDateString("fr-FR",{day:"numeric",month:"long",year:"numeric"})+" ("+(days===0?"aujourd'hui":"encore "+days+" jour"+(days>1?"s":""))+")."));
  }else box.append(el("p","note","Indique la date de fin de ta carte : l'appli te prévient 30 jours avant, 7 jours avant, la veille et le jour même."));
  const f=el("form","actions"); f.style.alignItems="flex-end";
  const l=el("label","field","Fin de validité"); const i=el("input"); i.type="date"; i.value=end||""; l.append(i);
  if(!end){ const y=new Date().getFullYear(); i.value=y+"-12-31"; }
  const ok=el("button","btn primary","Enregistrer"); ok.type="submit";
  f.append(l,ok);
  if(end) f.append(btn("Effacer","linkbtn danger",async()=>{ await A.sb.rpc("set_permit_end",{p_date:null}); permitPanel(); }));
  f.addEventListener("submit",async e=>{
    e.preventDefault(); if(!i.value) return;
    const {error}=await A.sb.rpc("set_permit_end",{p_date:i.value});
    if(error) return toast(frError(error));
    toast("Rappel enregistré"); permitPanel();
  });
  box.append(f);
  const a=el("a",null,"Acheter ou renouveler sur cartedepeche.fr"); a.href="https://www.cartedepeche.fr"; a.target="_blank"; a.rel="noopener"; box.append(a);
  box.append(el("p","note","Le rappel arrive par notification : active-les dans Réglages."));
  // carte scannée, gardée uniquement dans le téléphone
  const scans=await idb.all();
  const sc=el("div","permit-scan");
  sc.append(el("h3",null,"📷 Carte scannée pour les contrôles"));
  if(scans.length){
    const th=el("div","permit-thumbs"); scans.forEach(x=>{ const im=el("img"); im.src=URL.createObjectURL(x.blob); im.alt="Carte de pêche"; im.addEventListener("click",show); th.append(im); }); sc.append(th);
    const r=el("div","actions"); r.append(btn("🎫 Montrer ma carte","btn primary",show), btn("Ajouter une page","btn small",()=>scan(false)), btn("Supprimer","linkbtn danger",async()=>{ if(!confirm("Supprimer la carte scannée de ce téléphone ?")) return; await idb.clear(); permitPanel(); quick(); }));
    sc.append(r);
  }else{
    sc.append(el("p","note","Prends en photo ta carte de pêche (le PDF ou l'attestation avec le QR code, ou une capture d'écran) : en cas de contrôle, tu l'affiches en plein écran en un geste, même sans réseau au bord de l'eau."));
    sc.append(btn("📷 Scanner ma carte","btn primary",()=>scan(true)));
  }
  sc.append(el("p","note","L'image reste uniquement dans ce téléphone, elle n'est pas envoyée au groupe. Raccourci : appui long sur l'icône de l'appli puis « Ma carte de pêche »."));
  box.append(sc);
}

/* ---------- Carte scannée (stockée dans le téléphone, disponible hors ligne) ---------- */
const idb=(()=>{
  const open=()=>new Promise((res,rej)=>{ const r=indexedDB.open("cdj-permit",1); r.onupgradeneeded=()=>r.result.createObjectStore("scans",{keyPath:"id",autoIncrement:true}); r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error); });
  const tx=async(mode,fn)=>{ const db=await open(); return new Promise((res,rej)=>{ const t=db.transaction("scans",mode); const st=t.objectStore("scans"); const out=fn(st); t.oncomplete=()=>res(out.result); t.onerror=()=>rej(t.error); }); };
  return {
    all:async()=>{ try{ return (await tx("readonly",st=>st.getAll()))||[]; }catch(e){ return []; } },
    add:blob=>tx("readwrite",st=>st.add({blob,at:Date.now()})),
    clear:()=>tx("readwrite",st=>st.clear()),
  };
})();
function scan(replace){
  const i=document.createElement("input"); i.type="file"; i.accept="image/*";
  i.addEventListener("change",async()=>{
    const f=i.files?.[0]; if(!f) return;
    try{
      const img=await createImageBitmap(f);
      const k=Math.min(1,2000/Math.max(img.width,img.height)), c=document.createElement("canvas");
      c.width=Math.round(img.width*k); c.height=Math.round(img.height*k);
      const g=c.getContext("2d"); g.filter="contrast(1.15) brightness(1.05)"; g.drawImage(img,0,0,c.width,c.height);
      const blob=await new Promise(r=>c.toBlob(r,"image/jpeg",.88));
      if(replace) await idb.clear();
      await idb.add(blob);
      try{ await navigator.storage?.persist?.(); }catch(e){}
      toast("Carte enregistrée dans le téléphone"); permitPanel(); quick();
    }catch(e){ toast("Impossible de lire cette image"); }
  });
  i.click();
}
let lock=null;
async function show(){
  const scans=await idb.all();
  if(!scans.length){ location.hash="#profil"; toast("Scanne d'abord ta carte (Profil, Réglages)"); return; }
  const {data}=A.me?await A.sb.from("profiles").select("permit_end").eq("id",A.me.id).maybeSingle():{data:null};
  const ov=el("div","permit-view"); ov.setAttribute("role","dialog"); ov.setAttribute("aria-label","Ma carte de pêche");
  const head=el("div","pv-head");
  head.append(el("b",null,"🎫 Carte de pêche"+(A.me?" · @"+A.me.username:"")));
  const close=btn("✕ Fermer","btn small",()=>{ ov.remove(); try{ lock?.release(); }catch(e){} lock=null; document.removeEventListener("keydown",esc); });
  head.append(close); ov.append(head);
  if(data?.permit_end){ const d=new Date(data.permit_end+"T12:00:00"), ok=d>=new Date(new Date().toDateString()); ov.append(el("div","pv-valid"+(ok?"":" bad"),(ok?"✓ Fin de validité : ":"⚠ Expirée depuis le ")+d.toLocaleDateString("fr-FR",{day:"numeric",month:"long",year:"numeric"}))); }
  const imgs=el("div","pv-imgs"); scans.forEach(x=>{ const im=el("img"); im.src=URL.createObjectURL(x.blob); im.alt="Carte de pêche"; imgs.append(im); }); ov.append(imgs);
  ov.append(el("p","pv-tip","Monte la luminosité pour que le garde puisse lire le QR code. Pince pour zoomer."));
  document.body.append(ov);
  const esc=e=>{ if(e.key==="Escape") close.click(); }; document.addEventListener("keydown",esc);
  try{ lock=await navigator.wakeLock?.request("screen"); }catch(e){}
}
// accès rapide depuis l'onglet Conseils
async function quick(){
  const box=$("#permit-quick"); if(!box) return;
  const has=(await idb.all()).length>0;
  box.hidden=!has; box.innerHTML="";
  if(has) box.append(btn("🎫 Contrôle ? Montrer ma carte de pêche","btn permit-btn",show));
}
A.permit={show,scan};
function route(){ if(location.hash==="#ma-carte"){ history.replaceState(null,"",location.pathname+location.search+"#conseils"); show(); } }
window.addEventListener("hashchange",route);
setTimeout(route,600);
quick();
const prevProfil=A.hooks.profil;
A.hooks.profil=()=>{ prevProfil?.(); permitPanel(); };
if(A.me&&!$("#v-profil").hidden) permitPanel();
})();
