// Coup du Jour : file d'attente hors ligne (posts avec photos, bilans, messages, événements carpe).
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
  if(flushing||!navigator.onLine||!A.me||!A.sb) return;
  flushing=true;
  let done=0, failed=0;
  try{
    const items=(await all()).filter(x=>x.user_id===A.me.id);
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
        failed++; await del(it.id);             // refus du serveur (droits, groupe quitté…) : on abandonne cet envoi
        console.warn("Envoi abandonné",it,e);
      }
    }
  }finally{ flushing=false; }
  updatePill();
  if(done){ A.toast(done+(done>1?" envois en attente publiés":" envoi en attente publié")); A.loadFeed(); A.hooks.afterFlush?.(); }
  if(failed) A.toast(failed+" envoi"+(failed>1?"s":"")+" refusé"+(failed>1?"s":"")+" par le serveur");
}

// Pastille « en attente »
const pill=document.createElement("button");
pill.type="button"; pill.className="queue-pill"; pill.hidden=true;
pill.addEventListener("click",()=>{ if(navigator.onLine) flush(); else A.toast("Toujours hors ligne : l'envoi partira dès le retour du réseau"); });
document.body.append(pill);
async function updatePill(){
  let n=0;
  try{ n=A.me?(await all()).filter(x=>x.user_id===A.me.id).length:0; }catch(e){}
  const off=!navigator.onLine;
  pill.hidden=!n&&!off;
  pill.classList.toggle("off",off);
  pill.textContent=(off?"📴 Hors ligne":"⏳ Envoi en attente")+(n?" · "+n:"");
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
