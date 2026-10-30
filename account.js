// Coup du Jour : compte (e-mail, mot de passe, récupération, suppression du compte).
(function(){
"use strict";
const A=window.CDJ; if(!A||!A.sb) return;
const {el,toast,frError}=A;
const $=s=>document.querySelector(s);
const DOMAIN=(window.CDJ_CONFIG&&window.CDJ_CONFIG.EMAIL_DOMAIN)||"coupdujour.app";
const isFake=e=>!e||e.toLowerCase().endsWith("@"+DOMAIN);
const isMail=v=>/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
const siteUrl=()=>location.origin+location.pathname;
function btn(label,cls,fn){ const b=el("button",cls||"btn",label); b.type="button"; if(fn) b.addEventListener("click",fn); return b; }
function sheet(title){
  const back=el("div","sheet-back"), sh=el("div","sheet acc-sheet"); sh.setAttribute("role","dialog"); sh.setAttribute("aria-modal","true"); sh.setAttribute("aria-label",title);
  const head=el("div","sheet-head"); head.append(el("h2",null,title)); const x=btn("✕","icon-btn"); x.setAttribute("aria-label","Fermer"); head.append(x); sh.append(head);
  const close=()=>back.remove(); x.addEventListener("click",close);
  back.append(sh); document.body.append(back);
  return {sh,close};
}
function pwFields(){
  const l1=el("label","field","Nouveau mot de passe"); const p1=el("input"); p1.type="password"; p1.autocomplete="new-password"; p1.minLength=8; p1.required=true; p1.placeholder="8 caractères minimum"; l1.append(p1);
  const l2=el("label","field","Confirme le mot de passe"); const p2=el("input"); p2.type="password"; p2.autocomplete="new-password"; p2.minLength=8; p2.required=true; l2.append(p2);
  const show=el("label","check"); const cb=el("input"); cb.type="checkbox"; cb.addEventListener("change",()=>{ p1.type=p2.type=cb.checked?"text":"password"; }); show.append(cb," Afficher");
  return {nodes:[l1,l2,show],p1,p2};
}
async function setPassword(p1,p2,err){
  err.hidden=true;
  if(p1.value.length<8){ err.textContent="8 caractères minimum."; err.hidden=false; return false; }
  if(p1.value!==p2.value){ err.textContent="Les deux mots de passe ne sont pas identiques."; err.hidden=false; return false; }
  const {error}=await A.sb.auth.updateUser({password:p1.value});
  if(error){ err.textContent=frError(error); err.hidden=false; return false; }
  return true;
}

/* ---------- Lien « mot de passe oublié » reçu par e-mail ---------- */
let recoveryOpen=false;
function recoverySheet(){
  if(recoveryOpen) return; recoveryOpen=true;
  const {sh,close}=sheet("Nouveau mot de passe");
  sh.append(el("p","note","Choisis ton nouveau mot de passe. Tu resteras connecté sur ce téléphone."));
  const f=el("form","acc-form"); const pw=pwFields(); const err=el("p","err"); err.hidden=true;
  const ok=el("button","btn primary","Enregistrer"); ok.type="submit";
  f.append(...pw.nodes,err,el("div","actions")); f.lastChild.append(ok);
  f.addEventListener("submit",async e=>{ e.preventDefault(); ok.disabled=true; const done=await setPassword(pw.p1,pw.p2,err); ok.disabled=false; if(done){ toast("🔑 Mot de passe changé, bienvenue !"); recoveryOpen=false; close(); location.hash="#conseils"; } });
  sh.append(f); setTimeout(()=>pw.p1.focus(),100);
}
A.sb.auth.onAuthStateChange(ev=>{ if(ev==="PASSWORD_RECOVERY") setTimeout(recoverySheet,300); });
const link=window.CDJ_AUTHLINK||{};
if(link.recovery) setTimeout(async()=>{ const {data}=await A.sb.auth.getSession(); if(data.session) recoverySheet(); },1200);
if(link.error) setTimeout(()=>{
  toast(link.expired?"Ce lien a expiré ou a déjà servi : redemande un e-mail depuis « Mot de passe oublié ».":"Lien non valide : "+link.error,6000);
  if(/error/.test(location.hash)) history.replaceState(null,"",location.pathname+location.search+"#profil");
},800);

/* ---------- Réglages › Compte ---------- */
let seq=0;
async function panel(){
  const box=$("#account-box"); if(!box||!A.me) return;
  const s=++seq;
  const {data}=await A.sb.auth.getUser();
  if(s!==seq) return;
  const email=data?.user?.email||"", fake=isFake(email);
  box.innerHTML="";
  // e-mail
  const er=el("div","acc-row");
  const et=el("div","acc-t"); et.append(el("b",null,"📧 E-mail"));
  et.append(el("span","note",fake?"Aucun e-mail : ajoute-le pour pouvoir récupérer ton mot de passe si tu l'oublies.":email));
  er.append(et,btn(fake?"Ajouter":"Changer","btn small"+(fake?" primary":""),()=>emailSheet(fake)));
  if(fake) er.classList.add("warn");
  box.append(er);
  // mot de passe
  const pr=el("div","acc-row"); const pt=el("div","acc-t"); pt.append(el("b",null,"🔑 Mot de passe"),el("span","note","Change-le quand tu veux."));
  pr.append(pt,btn("Changer","btn small",passSheet)); box.append(pr);
  // suppression
  const dr=el("div","acc-row danger"); const dt=el("div","acc-t"); dt.append(el("b",null,"🗑️ Supprimer mon compte"),el("span","note","Efface ton compte, tes prises, tes photos et tes messages. Définitif."));
  dr.append(dt,btn("Supprimer","btn small danger",deleteSheet)); box.append(dr);
}
function emailSheet(fake){
  const {sh,close}=sheet(fake?"Ajouter mon e-mail":"Changer d'e-mail");
  sh.append(el("p","note",fake?"Avec un e-mail, tu pourras te connecter avec lui et récupérer ton mot de passe. Ton pseudo ne change pas.":"Ta nouvelle adresse servira pour te connecter et récupérer ton mot de passe."));
  const f=el("form","acc-form");
  const l=el("label","field","Adresse e-mail"); const i=el("input"); i.type="email"; i.autocomplete="email"; i.required=true; i.placeholder="ton@email.fr"; l.append(i);
  const err=el("p","err"); err.hidden=true; const okm=el("p","ok-msg"); okm.hidden=true;
  const ok=el("button","btn primary","Enregistrer"); ok.type="submit";
  f.append(l,err,okm,el("div","actions")); f.lastChild.append(ok);
  f.addEventListener("submit",async e=>{
    e.preventDefault(); err.hidden=true; okm.hidden=true;
    const v=i.value.trim().toLowerCase(); if(!isMail(v)){ err.textContent="Cette adresse e-mail n'est pas valide."; err.hidden=false; return; }
    ok.disabled=true;
    const {data,error}=await A.sb.auth.updateUser({email:v},{emailRedirectTo:siteUrl()});
    ok.disabled=false;
    if(error){ err.textContent=frError(error); err.hidden=false; return; }
    if((data?.user?.email||"").toLowerCase()===v){ toast("📧 E-mail enregistré : tu peux maintenant te connecter avec lui"); close(); panel(); }
    else{ okm.textContent="📧 Un lien de confirmation vient de partir à "+v+". Ouvre-le pour valider le changement (pense aux spams)."; okm.hidden=false; }
  });
  sh.append(f); setTimeout(()=>i.focus(),100);
}
function passSheet(){
  const {sh,close}=sheet("Changer de mot de passe");
  const f=el("form","acc-form"); const pw=pwFields(); const err=el("p","err"); err.hidden=true;
  const ok=el("button","btn primary","Enregistrer"); ok.type="submit";
  f.append(...pw.nodes,err,el("div","actions")); f.lastChild.append(ok);
  f.addEventListener("submit",async e=>{ e.preventDefault(); ok.disabled=true; const done=await setPassword(pw.p1,pw.p2,err); ok.disabled=false; if(done){ toast("🔑 Mot de passe changé"); close(); } });
  sh.append(f); setTimeout(()=>pw.p1.focus(),100);
}
async function removeFiles(){
  const uid=A.me.id, gids=[...new Set([...(A.groups||[]).map(g=>g.id),...(A.myRoles?[...A.myRoles.keys()]:[])])];
  const lists=await Promise.all([
    ...gids.map(g=>A.sb.storage.from("photos").list(g+"/"+uid,{limit:1000}).then(r=>({b:"photos",pre:g+"/"+uid,files:r.data||[]})).catch(()=>({files:[]}))),
    A.sb.storage.from("avatars").list(uid,{limit:1000}).then(r=>({b:"avatars",pre:uid,files:r.data||[]})).catch(()=>({files:[]})),
  ]);
  for(const l of lists){ const paths=l.files.filter(f=>f.name&&f.id!==null).map(f=>l.pre+"/"+f.name); for(let i=0;i<paths.length;i+=100) await A.sb.storage.from(l.b).remove(paths.slice(i,i+100)); }
}
function deleteSheet(){
  const {sh,close}=sheet("Supprimer mon compte");
  sh.append(el("p",null,"Cette action est définitive. Seront effacés :"));
  const ul=el("ul","acc-list"); ["ton compte et ton profil","tes prises, bilans, sessions carpe et photos","tes messages, commentaires et réactions","tes spots, zones, alarmes et ton carnet"].forEach(x=>ul.append(el("li",null,x))); sh.append(ul);
  sh.append(el("p","note","Les groupes que tu as créés restent en place pour les autres membres."));
  const f=el("form","acc-form");
  const l=el("label","field","Pour confirmer, tape ton pseudo : "+A.me.username); const i=el("input"); i.autocomplete="off"; i.autocapitalize="off"; l.append(i);
  const err=el("p","err"); err.hidden=true;
  const ok=el("button","btn danger","Supprimer définitivement"); ok.type="submit"; ok.disabled=true;
  i.addEventListener("input",()=>{ ok.disabled=i.value.trim().toLowerCase()!==A.me.username.toLowerCase(); });
  f.append(l,err,el("div","actions")); f.lastChild.append(ok,btn("Annuler","linkbtn",close));
  f.addEventListener("submit",async e=>{
    e.preventDefault(); ok.disabled=true; ok.textContent="Suppression…"; err.hidden=true;
    try{ await removeFiles(); }catch(_){ /* les fichiers restants seront orphelins mais inaccessibles */ }
    const {error}=await A.sb.rpc("delete_my_account");
    if(error){ err.textContent=frError(error); err.hidden=false; ok.disabled=false; ok.textContent="Supprimer définitivement"; return; }
    try{ await A.sb.auth.signOut(); }catch(_){}
    try{ Object.keys(localStorage).filter(k=>k.startsWith("cdj-")&&!["cdj-theme","cdj-bg"].includes(k)).forEach(k=>localStorage.removeItem(k)); }catch(_){}
    close(); alert("Ton compte a été supprimé. Merci d'avoir utilisé Coup du Jour.");
    location.hash="#conseils"; location.reload();
  });
  sh.append(f);
}
A.account={panel,recoverySheet};
const prev=A.hooks.profil; A.hooks.profil=()=>{ prev?.(); panel(); };
const prevC=A.hooks.change; A.hooks.change=(...a)=>{ prevC?.(...a); if(A.me&&!$("#v-profil").hidden) panel(); };
if(A.me&&!$("#v-profil").hidden) panel();
})();
