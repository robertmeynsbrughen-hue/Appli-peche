// Coup du Jour : photos reçues par « Partager → Coup du Jour » depuis la galerie du téléphone.
(function(){
"use strict";
const A=window.CDJ; if(!A) return;
const q=new URLSearchParams(location.search);
if(q.get("shared")!=="1"||!("caches" in window)) return;
history.replaceState(null,"",location.pathname+location.hash);
async function take(){
  const c=await caches.open("cdj-share");
  const keys=await c.keys(); const files=[]; let text="";
  for(const k of keys){
    const r=await c.match(k); if(!r) continue;
    if(k.url.endsWith("shared-text")) text=await r.text();
    else{ const b=await r.blob(); files.push(new File([b],decodeURIComponent(r.headers.get("X-Name")||"photo.jpg"),{type:b.type||"image/jpeg"})); }
    await c.delete(k);
  }
  return {files,text};
}
let tries=0;
async function go(){
  if(!A.me||!A.groups.length){ if(++tries<20) return setTimeout(go,500); return A.toast("Connecte-toi pour partager ta photo"); }
  if(typeof A.cur!=="number"){ A.toast("Choisis le groupe en haut, puis repartage ta photo"); return; }
  const {files,text}=await take();
  if(!files.length) return;
  location.hash="#fil";
  const b=document.querySelector('#post-mode [data-m="post"]');
  if(b&&b.getAttribute("aria-pressed")!=="true") b.click();
  setTimeout(()=>{
    const inp=document.getElementById("p-photo");
    try{ const dt=new DataTransfer(); files.forEach(f=>dt.items.add(f)); inp.files=dt.files; inp.dispatchEvent(new Event("change",{bubbles:true})); }catch(e){ A.toast("Ajoute la photo à la main : ton navigateur ne l'a pas transmise"); }
    if(text){ const cap=document.getElementById("p-caption"); if(cap&&!cap.value) cap.value=text; }
    document.getElementById("composer")?.scrollIntoView({behavior:"smooth",block:"start"});
    A.toast("📸 Photo reçue : ajoute l'espèce et la taille, puis publie");
  },350);
}
setTimeout(go,600);
})();
