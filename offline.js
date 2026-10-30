// Rivio : file d'attente hors ligne (posts avec photos, bilans, messages, événements carpe).
(function(){
"use strict";
const A=window.CDJ; if(!A) return;
const DB="cdj-offline", STORE="queue";
let dbp=null;
function db(){
  if(dbp) return dbp;
  dbp=new Promise((res,rej)=>{
    const r=indexedDB.open(DB,1);
    r.onupgradeneeded=()=>r.result.createObjectStore(STORE,{keyPath:"id",autoIncrement:true});
    r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error);
  });
  return dbp;
}
async function tx(mode,fn){
  const d=await db();
  return new Promise((res,rej)=>{ const t=d.transaction(STORE,mode); const out=fn(t.objectStore(STORE)); t.oncomplete=()=>res(out&&out.result!==undefined?out.result:out); t.onerror=()=>rej(t.error); });
}
const all=()=>tx("readonly",s=>s.getAll());
const del=id=>tx("readwrite",s=>s.delete(id));
const put=it=>tx("readwrite",s=>s.put(it));
const mine=async()=>A.me?(await all()).filter(x=>x.user_id===A.me.id):[];
const isNetErr=e=>!navigator.onLine||/Failed to fetch|NetworkError|Load failed|network|fetch/i.test((e&&e.message)||String(e||""));

async function enqueue(item){
  try{
    await tx("readwrite",s=>s.add({...item,user_id:A.me?.id,queued_at:new Date().toISOString()}));
  }catch(e){ A.toast("Impossible de garder l'envoi hors ligne sur ce téléphone"); return false; }
  updatePill();
  return true;
}
let flushing=false;
async function flush(){
  // verrou partagé entre onglets : deux onglets ouverts n'envoient jamais deux fois le même élément
  if(navigator.locks?.request) return navigator.locks.request("cdj-offline-flush",{ifAvailable:true},lock=>lock?flushNow():null);
  return flushNow();
}
async function flushNow(){
  if(flushing||!navigator.onLine||!A.me||!A.sb) return;
  flushing=true;
  let done=0, failed=0;
  try{
    const items=(await mine()).filter(x=>!x.failed);
    for(const it of items){
      try{
        if(it.kind==="post"){
          const paths=[];
          for(let i=0;i<(it.blobs||[]).length;i++){
            const path=it.row.group_id+"/"+A.me.id+"/"+it.id+"-"+Date.now()+"-"+i+".jpg";
            const {error}=await A.sb.storage.from("photos").upload(path,it.blobs[i],{contentType:"image/jpeg"});
            if(error){ if(paths.length) await A.sb.storage.from("photos").remove(paths); throw error; }
            paths.push(path);
          }
          const {error}=await A.sb.from("posts").insert({...it.row,photo_path:paths[0]||null,photo_paths:paths.length?paths:null});
          if(error){ if(paths.length) await A.sb.storage.from("photos").remove(paths); throw error; }
        }else{
          const {error}=await A.sb.from(it.table).insert(it.row);
          if(error) throw error;
        }
        await del(it.id); done++;
      }catch(e){
        if(isNetErr(e)) break;                 // toujours pas de réseau : on réessaiera
        // refus du serveur (droits, groupe quitté, session expirée…) : on garde l'envoi pour pouvoir le réessayer ou le supprimer
        failed++;
        try{ await put({...it,failed:true,error:A.frError?A.frError(e):String(e?.message||e),failed_at:new Date().toISOString()}); }catch(_){}
        console.warn("Envoi refusé, gardé de côté",it,e);
      }
    }
  }finally{ flushing=false; }
  updatePill();
  if(done){ A.toast(done+(done>1?" envois en attente publiés":" envoi en attente publié")); A.loadFeed(); A.hooks.afterFlush?.(); }
  if(failed) A.toast(failed+" envoi"+(failed>1?"s":"")+" refusé"+(failed>1?"s":"")+" : rien n'est perdu, touche la pastille ⚠️ pour réessayer");
}

// Pastille « en attente »
const pill=document.createElement("button");
pill.type="button"; pill.className="queue-pill"; pill.hidden=true;
pill.addEventListener("click",async()=>{
  const bad=(await mine()).filter(x=>x.failed);
  if(bad.length) return refusedSheet();
  if(navigator.onLine) flush(); else A.toast("Toujours hors ligne : l'envoi partira dès le retour du réseau");
});
// envois refusés : réessayer (éventuellement dans le groupe actuel) ou supprimer
const KIND={post:"Prise",sessions:"Bilan",messages:"Message",carp_events:"Événement carpe"};
async function refusedSheet(){
  const {el,toast}=A;
  const back=el("div","sheet-back"), sh=el("div","sheet"); sh.setAttribute("role","dialog"); sh.setAttribute("aria-modal","true"); sh.setAttribute("aria-label","Envois refusés");
  const head=el("div","sheet-head"); head.append(el("h2",null,"⚠️ Envois refusés")); const x=el("button","icon-btn","✕"); x.type="button"; x.setAttribute("aria-label","Fermer"); head.append(x); sh.append(head);
  const close=()=>back.remove(); x.addEventListener("click",close); back.addEventListener("click",e=>{ if(e.target===back) close(); });
  back.append(sh); document.body.append(back);
  sh.append(el("p","note","Le serveur a refusé ces envois au retour du réseau. Ils sont gardés sur ton téléphone : réessaie, envoie-les dans ton groupe actuel ou supprime-les."));
  const list=el("div","queue-list"); sh.append(list);
  const draw=async()=>{
    list.innerHTML="";
    const bad=(await mine()).filter(x=>x.failed);
    if(!bad.length){ close(); updatePill(); return; }
    bad.forEach(it=>{
      const r=it.row||{}, c=el("div","queue-item");
      const what=[KIND[it.kind]||KIND[it.table]||"Envoi",r.species,r.length_cm?r.length_cm+" cm":null,(it.blobs||[]).length?(it.blobs.length+" photo"+(it.blobs.length>1?"s":"")):null].filter(Boolean).join(" · ");
      c.append(el("b",null,what), el("span","note","Noté le "+new Date(it.queued_at).toLocaleString("fr-FR",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})+(it.error?" · motif : "+it.error:"")));
      const a=el("div","actions");
      const retry=async(row)=>{ await put({...it,row:row||it.row,failed:false,error:null}); await flush(); draw(); };
      const b1=el("button","btn small primary","↻ Réessayer"); b1.type="button"; b1.addEventListener("click",()=>retry()); a.append(b1);
      if(r.group_id!=null&&typeof A.cur==="number"&&A.cur!==r.group_id){ const b2=el("button","btn small","➜ Envoyer dans « "+(A.curGroup?.name||"ce groupe")+" »"); b2.type="button"; b2.addEventListener("click",()=>retry({...r,group_id:A.cur})); a.append(b2); }
      const b3=el("button","linkbtn danger","Supprimer"); b3.type="button"; b3.addEventListener("click",async()=>{ if(!confirm("Supprimer définitivement cet envoi ?")) return; await del(it.id); toast("Envoi supprimé"); draw(); updatePill(); }); a.append(b3);
      c.append(a); list.append(c);
    });
  };
  draw();
}
document.body.append(pill);
async function updatePill(){
  let n=0;
  let bad=0;
  try{ const m=await mine(); bad=m.filter(x=>x.failed).length; n=m.length-bad; }catch(e){}
  const off=!navigator.onLine;
  pill.hidden=!n&&!off&&!bad;
  pill.classList.toggle("bad",!!bad&&!off);
  if(bad&&!off){ pill.textContent="⚠️ "+bad+" envoi"+(bad>1?"s":"")+" refusé"+(bad>1?"s":"")+" · touche pour voir"; pill.setAttribute("aria-label",pill.textContent); return; }
  pill.classList.toggle("off",off);
  pill.textContent=off?"📴 Hors ligne"+(n?" · "+n+" élément"+(n>1?"s":"")+" en attente d'envoi":" · tes prises partiront au retour du réseau"):"⏳ "+n+" envoi"+(n>1?"s":"")+" en attente · touche pour réessayer";
  pill.setAttribute("aria-label",(off?"Hors ligne. ":"")+(n?n+" envoi"+(n>1?"s":"")+" en attente":""));
}

window.addEventListener("online",()=>{ updatePill(); setTimeout(flush,1500); });
window.addEventListener("offline",updatePill);
setInterval(()=>{ if(navigator.onLine) flush(); },60000);
const prevChange=A.hooks.change;
A.hooks.change=()=>{ prevChange?.(); updatePill(); if(A.me) flush(); };

A.offline={enqueue,flush,isNetErr,count:async()=>(await all()).length};
updatePill(); if(A.me) flush();
})();
