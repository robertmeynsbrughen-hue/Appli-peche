// Rivio : carnet de sortie hors ligne (sorties, prises et notes).
// Les sorties sont d'abord gardées dans IndexedDB, puis envoyées au retour du
// réseau par un identifiant créé sur le téléphone (client_id) : aucun doublon.
(function(){
"use strict";
const A=window.CDJ; if(!A) return;
const {el,toast,frError}=A;

const DB="cdj-logbook", STORE="outings";
let dbp=null;
function db(){
  if(dbp) return dbp;
  dbp=new Promise((res,rej)=>{
    const r=indexedDB.open(DB,1);
    r.onupgradeneeded=()=>{
      const d=r.result;
      if(!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE,{keyPath:"client_id"});
    };
    r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error);
  });
  return dbp;
}
async function tx(mode,fn){
  const d=await db();
  return new Promise((res,rej)=>{
    const t=d.transaction(STORE,mode), out=fn(t.objectStore(STORE));
    t.oncomplete=()=>res(out&&out.result!==undefined?out.result:out);
    t.onerror=()=>rej(t.error);
  });
}
const all=()=>tx("readonly",s=>s.getAll());
const putRec=r=>tx("readwrite",s=>s.put(r));
const delRec=id=>tx("readwrite",s=>s.delete(id));
const mine=async()=>A.me?(await all()).filter(r=>r.user_id===A.me.id):[];

const nowISO=()=>new Date().toISOString();
const uuid=()=>crypto.randomUUID?crypto.randomUUID():"lb-"+Date.now()+"-"+Math.random().toString(16).slice(2);
const txt=(v,max)=>{ const s=String(v??"").trim().slice(0,max); return s||null; };
const num=(v,max)=>{ const n=Number(String(v??"").replace(",",".")); return Number.isFinite(n)&&n>0?Math.min(Math.round(n*10)/10,max):null; };
const num2=(v,max)=>{ const n=Number(String(v??"").replace(",",".")); return Number.isFinite(n)&&n>0?Math.min(Math.round(n*100)/100,max):null; };
const isNetErr=e=>A.offline?.isNetErr?A.offline.isNetErr(e):!navigator.onLine||/Failed to fetch|NetworkError|Load failed|network|fetch/i.test((e&&e.message)||String(e||""));
const fmtN=n=>Number(n).toLocaleString("fr-FR",{maximumFractionDigits:2});
const fmtWhen=iso=>new Date(iso).toLocaleString("fr-FR",{weekday:"short",day:"numeric",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"});
const toLocalInput=iso=>{ const d=iso?new Date(iso):new Date(), p=n=>String(n).padStart(2,"0"); return d.getFullYear()+"-"+p(d.getMonth()+1)+"-"+p(d.getDate())+"T"+p(d.getHours())+":"+p(d.getMinutes()); };
const safe=fn=>{ try{ const r=fn(); if(r&&r.catch) r.catch(()=>{}); }catch(e){} };

function payloadOf(r){
  return {
    occurred_at:r.occurred_at,
    place:r.place||null,
    conditions:r.conditions||null,
    notes:r.notes||null,
    catches:(r.catches||[]).slice(0,50).map(c=>({
      species:c.species||null,
      length_cm:c.length_cm==null?null:c.length_cm,
      weight_kg:c.weight_kg==null?null:c.weight_kg,
      bait:c.bait||null,
      note:c.note||null,
      released:c.released===true||c.released===false?c.released:null,
    })),
  };
}

/* ---------- synchronisation ---------- */

let syncing=false, lastError=null;

async function pull(){
  const {data,error}=await A.sb.from("logbook_outings")
    .select("client_id,occurred_at,place,conditions,notes,updated_at,logbook_catches(species,length_cm,weight_kg,bait,note,released,position)")
    .eq("user_id",A.me.id);
  if(error) throw error;
  const local=new Map((await mine()).map(r=>[r.client_id,r]));
  const seen=new Set();
  for(const o of data||[]){
    seen.add(o.client_id);
    const l=local.get(o.client_id);
    if(l&&l.dirty) continue;                 // une modification locale non envoyée gagne
    const catches=(o.logbook_catches||[]).slice()
      .sort((a,b)=>(a.position??0)-(b.position??0))
      .map(c=>({
        species:c.species||null,
        length_cm:c.length_cm==null?null:Number(c.length_cm),
        weight_kg:c.weight_kg==null?null:Number(c.weight_kg),
        bait:c.bait||null,
        note:c.note||null,
        released:c.released===true||c.released===false?c.released:null,
      }));
    await putRec({
      client_id:o.client_id, user_id:A.me.id,
      occurred_at:o.occurred_at, place:o.place||null, conditions:o.conditions||null, notes:o.notes||null,
      catches, dirty:false, deleted:false, failed:null,
      updated_at:o.updated_at, server_updated_at:o.updated_at,
    });
  }
  // Une sortie synchronisée qui n'existe plus sur le serveur a été supprimée ailleurs.
  for(const [id,l] of local){
    if(!seen.has(id)&&!l.dirty) await delRec(id);
  }
}

async function sync(manual){
  if(!A.me||!A.sb) return;
  if(!navigator.onLine){ if(manual) toast("Toujours hors ligne : les sorties partiront au retour du réseau"); return drawStatus(); }
  if(syncing) return;
  if(navigator.locks?.request) return navigator.locks.request("cdj-logbook-sync",{ifAvailable:true},l=>l?syncNow(manual):null);
  return syncNow(manual);
}

async function syncNow(manual){
  if(syncing) return;
  syncing=true;
  let pushed=0, refused=0, offline=false;
  try{
    const recs=await mine();
    for(const r of recs.filter(x=>x.dirty)){
      try{
        if(r.deleted){
          const {error}=await A.sb.rpc("delete_logbook_outing",{p_client_id:r.client_id});
          if(error) throw error;
          await delRec(r.client_id);
        }else{
          const {data,error}=await A.sb.rpc("sync_logbook_outing",{p_client_id:r.client_id,p_payload:payloadOf(r)});
          if(error) throw error;
          const srv=Array.isArray(data)?data[0]:data;
          await putRec({...r,dirty:false,failed:null,server_updated_at:srv?.updated_at||nowISO()});
        }
        pushed++;
      }catch(e){
        if(isNetErr(e)){ offline=true; break; }
        refused++;
        try{ await putRec({...r,failed:frError?frError(e):String(e?.message||e)}); }catch(_){}
      }
    }
    if(!offline){ await pull(); lastError=null; }
  }catch(e){
    if(isNetErr(e)) offline=true;
    else lastError=frError?frError(e):String(e?.message||e);
  }finally{ syncing=false; }
  await drawStatus(); await drawList();
  if(manual){
    if(offline) toast("Toujours hors ligne : rien n'est perdu, nouvel essai au retour du réseau");
    else if(refused) toast(refused+" sortie"+(refused>1?"s":"")+" refusée"+(refused>1?"s":"")+" : le motif est affiché sur la fiche");
    else if(pushed) toast(pushed+" sortie"+(pushed>1?"s":"")+" synchronisée"+(pushed>1?"s":""));
    else toast("Carnet à jour");
  }
}

/* ---------- interface ---------- */

const box=()=>document.getElementById("logbook");
let built=false, statusEl=null, syncBtn=null, listHost=null, formHost=null;
let editing=null, formRows=[], showAll=false;

function ensureShell(b){
  if(built&&b.querySelector(".lb-head")) return;
  built=true;
  b.innerHTML="";
  const head=el("div","g-sec-head lb-head");
  const h=el("h2",null,"🎣 Carnet de sortie");
  head.append(h);
  const actions=el("div","lb-actions");
  syncBtn=el("button","linkbtn small","↻ Synchroniser"); syncBtn.type="button";
  syncBtn.addEventListener("click",()=>sync(true));
  const add=el("button","btn primary small","＋ Nouvelle sortie"); add.type="button";
  add.addEventListener("click",()=>openForm(null));
  actions.append(syncBtn,add);
  head.append(actions);
  b.append(head);
  b.append(el("p","note lb-intro","Note ici une sortie, ses prises et tes observations, même sans réseau. Tout est gardé sur ce téléphone et part automatiquement dès que la connexion revient."));
  statusEl=el("div","lb-status"); b.append(statusEl);
  formHost=el("div","lb-form-host"); formHost.hidden=true; b.append(formHost);
  listHost=el("div","lb-list"); b.append(listHost);
}

async function refresh(){
  const b=box(); if(!b) return;
  if(!A.me){ b.hidden=true; return; }
  b.hidden=false;
  ensureShell(b);
  await drawStatus();
  await drawList();
}

async function drawStatus(){
  if(!statusEl) return;
  let recs=[]; try{ recs=await mine(); }catch(e){}
  const pending=recs.filter(r=>r.dirty).length;
  const failed=recs.filter(r=>r.dirty&&r.failed).length;
  const off=!navigator.onLine;
  statusEl.className="lb-status"+(failed?" bad":pending?" wait":" ok");
  if(lastError&&!off) statusEl.textContent="⚠️ "+lastError;
  else if(failed) statusEl.textContent="⚠️ "+failed+" sortie"+(failed>1?"s":"")+" refusée"+(failed>1?"s":"")+" · touche Réessayer";
  else if(pending) statusEl.textContent=(off?"📴 Hors ligne · ":"⏳ ")+pending+" sortie"+(pending>1?"s":"")+" en attente d'envoi";
  else statusEl.textContent=off?"📴 Hors ligne · tes sorties restent sur ce téléphone":"✅ Carnet à jour";
  if(syncBtn){
    syncBtn.hidden=!pending||off;
    syncBtn.textContent=failed?"↻ Réessayer":"↻ Synchroniser";
  }
}

async function drawList(){
  if(!listHost) return;
  listHost.innerHTML="";
  let recs=[]; try{ recs=(await mine()).filter(r=>!r.deleted); }catch(e){}
  recs.sort((a,b)=>new Date(b.occurred_at)-new Date(a.occurred_at));
  if(!recs.length){
    const e=el("div","empty-state");
    e.append(el("div","es-ico","📓"),el("b",null,"Ton carnet de sortie est vide"),el("p",null,"Note une sortie, ses prises et tes observations, même au bord de l'eau sans réseau."));
    const a=el("div","actions");
    const b=el("button","btn primary","＋ Noter ma première sortie"); b.type="button";
    b.addEventListener("click",()=>openForm(null)); a.append(b); e.append(a);
    listHost.append(e);
    return;
  }
  const shown=showAll?recs:recs.slice(0,8);
  shown.forEach(r=>listHost.append(card(r)));
  if(recs.length>8){
    const more=el("div","actions");
    const b=el("button","linkbtn",showAll?"Voir moins":"Voir les "+recs.length+" sorties"); b.type="button";
    b.addEventListener("click",()=>{ showAll=!showAll; drawList(); }); more.append(b);
    listHost.append(more);
  }
}

function badge(r){
  const s=el("span","lb-badge "+(r.failed?"bad":r.dirty?"wait":"ok"));
  s.textContent=r.failed?"⚠️ Refusé":r.dirty?"⏳ En attente":"✅ Synchronisé";
  return s;
}

function card(r){
  const c=el("article","lb-card"+(r.failed?" bad":""));
  const top=el("div","lb-card-top");
  const left=el("div","lb-card-when");
  left.append(el("b",null,fmtWhen(r.occurred_at)));
  const sub=[r.place||"Lieu non noté",r.conditions].filter(Boolean).join(" · ");
  left.append(el("span","note",sub));
  top.append(left,badge(r));
  c.append(top);

  if(r.notes) c.append(el("p","lb-notes",r.notes));

  if(r.catches&&r.catches.length){
    const ul=el("ul","lb-catches");
    r.catches.forEach(x=>{
      const li=el("li");
      const main=[x.species||"Prise",x.length_cm!=null?fmtN(x.length_cm)+" cm":null,x.weight_kg!=null?fmtN(x.weight_kg)+" kg":null].filter(Boolean).join(" · ");
      li.append(el("b",null,main));
      const meta=[x.bait,x.note,x.released===true?"remise à l'eau":x.released===false?"gardée":null].filter(Boolean).join(" · ");
      if(meta) li.append(el("span","note",meta));
      ul.append(li);
    });
    c.append(ul);
  }

  if(r.failed) c.append(el("p","lb-err","Refusé : "+r.failed));

  const acts=el("div","lb-card-actions");
  const edit=el("button","linkbtn small","Modifier"); edit.type="button";
  edit.addEventListener("click",()=>openForm(r)); acts.append(edit);
  if(r.failed){
    const retry=el("button","linkbtn small","↻ Réessayer"); retry.type="button";
    retry.addEventListener("click",async()=>{ await putRec({...r,failed:null}); await sync(true); }); acts.append(retry);
  }
  const del=el("button","linkbtn danger small","Supprimer"); del.type="button";
  del.addEventListener("click",()=>removeRec(r)); acts.append(del);
  c.append(acts);
  return c;
}

async function removeRec(r){
  if(!confirm("Supprimer cette sortie du carnet ?")) return;
  try{
    const cur=(await mine()).find(x=>x.client_id===r.client_id);
    if(!cur) return;
    if(!cur.server_updated_at) await delRec(r.client_id);       // jamais envoyée : rien à effacer sur le serveur
    else await putRec({...cur,deleted:true,dirty:true,failed:null,updated_at:nowISO()});
    await drawList(); await drawStatus();
    if(navigator.onLine) sync(); else toast("Suppression gardée sur ce téléphone");
  }catch(e){ toast("Impossible de supprimer cette sortie : "+(frError?frError(e):e?.message||e)); }
}

function field(label,type,value,max){
  const w=el("label","lb-field");
  w.append(el("span",null,label));
  const i=el("input"); i.type=type||"text"; i.value=value??"";
  if(max) i.maxLength=max;
  i.setAttribute("aria-label",label);
  w.append(i);
  return {w,i};
}

function openForm(r){
  ensureShell(box());
  editing=r?r.client_id:null;
  formRows=[];
  formHost.hidden=false;
  formHost.innerHTML="";

  const form=el("form","lb-form");
  const head=el("div","lb-form-head");
  head.append(el("h3",null,r?"Modifier la sortie":"Nouvelle sortie"));
  const shut=el("button","icon-btn","✕"); shut.type="button"; shut.setAttribute("aria-label","Fermer le formulaire");
  shut.addEventListener("click",closeForm); head.append(shut);
  form.append(head);

  const dt=field("Date et heure","datetime-local",toLocalInput(r?.occurred_at),null);
  dt.i.required=true;
  const place=field("Lieu / poste","text",r?.place||"",160);
  const cond=field("Conditions","text",r?.conditions||"",200);
  cond.i.placeholder="Météo, vent, niveau d'eau…";

  const grid=el("div","lb-grid");
  grid.append(dt.w,place.w,cond.w);
  form.append(grid);

  const nw=el("label","lb-field lb-field-full");
  nw.append(el("span",null,"Notes de la sortie"));
  const notes=el("textarea"); notes.rows=3; notes.maxLength=4000; notes.value=r?.notes||"";
  notes.placeholder="Ce que tu as observé, ce qui a marché…";
  notes.setAttribute("aria-label","Notes de la sortie");
  nw.append(notes); form.append(nw);

  form.append(el("h4","g-sub","Prises"));
  const catchHost=el("div","lb-catch-list"); form.append(catchHost);

  const add=el("button","btn small","＋ Ajouter une prise"); add.type="button";
  add.addEventListener("click",()=>addCatch(catchHost));
  const addWrap=el("div","lb-add-catch"); addWrap.append(add); form.append(addWrap);

  (r?.catches||[]).forEach(c=>addCatch(catchHost,c));
  if(!(r?.catches||[]).length) addCatch(catchHost);

  const actions=el("div","actions lb-form-actions");
  const save=el("button","btn primary","Enregistrer"); save.type="submit";
  const cancel=el("button","btn","Annuler"); cancel.type="button"; cancel.addEventListener("click",closeForm);
  actions.append(save,cancel); form.append(actions);

  form.addEventListener("submit",async e=>{
    e.preventDefault();
    save.disabled=true; save.textContent="Enregistrement…";
    try{
      const when=dt.i.value?new Date(dt.i.value):new Date();
      if(isNaN(when.getTime())){ toast("Date invalide"); return; }
      const prev=editing?(await mine()).find(x=>x.client_id===editing):null;
      const catches=[];
      formRows.forEach(row=>{
        const c=row.read();
        if(c.species||c.length_cm!=null||c.weight_kg!=null||c.bait||c.note) catches.push(c);
      });
      const rec={
        client_id:editing||uuid(), user_id:A.me.id,
        occurred_at:when.toISOString(),
        place:txt(place.i.value,160),
        conditions:txt(cond.i.value,200),
        notes:txt(notes.value,4000),
        catches:catches.slice(0,50),
        updated_at:nowISO(), dirty:true, deleted:false, failed:null,
        server_updated_at:prev?.server_updated_at||null,
      };
      await putRec(rec);
      closeForm();
      await drawList(); await drawStatus();
      if(navigator.onLine){ toast("Sortie enregistrée"); sync(); }
      else toast("Sortie gardée sur ce téléphone · envoi au retour du réseau");
    }catch(err){
      toast("Impossible d'enregistrer la sortie : "+(frError?frError(err):err?.message||err));
    }finally{
      save.disabled=false; save.textContent="Enregistrer";
    }
  });

  formHost.append(form);
  try{ formHost.scrollIntoView({behavior:"smooth",block:"start"}); }catch(_){}
  setTimeout(()=>place.i.focus({preventScroll:true}),250);
}

function closeForm(){
  editing=null; formRows=[]; formHost.hidden=true; formHost.innerHTML="";
}

function addCatch(host,c){
  const row=el("div","lb-catch");
  const sp=field("Espèce","text",c?.species||"",80);
  const len=field("Taille (cm)","number",c?.length_cm??"",null); len.i.step="0.1"; len.i.min="0"; len.i.max="300"; len.i.inputMode="decimal";
  const wt=field("Poids (kg)","number",c?.weight_kg??"",null); wt.i.step="0.01"; wt.i.min="0"; wt.i.max="500"; wt.i.inputMode="decimal";
  const bait=field("Appât","text",c?.bait||"",120);
  const note=field("Note","text",c?.note||"",500);
  const rel=el("label","lb-check");
  const cb=el("input"); cb.type="checkbox"; cb.checked=c?.released===true;
  rel.append(cb,el("span",null,"Remise à l'eau"));
  const rm=el("button","icon-btn lb-catch-del","✕"); rm.type="button"; rm.setAttribute("aria-label","Retirer cette prise");
  rm.addEventListener("click",()=>{ const i=formRows.findIndex(x=>x.row===row); if(i>=0) formRows.splice(i,1); row.remove(); });
  row.append(sp.w,len.w,wt.w,bait.w,note.w,rel,rm);
  host.append(row);
  formRows.push({row,read:()=>({
    species:txt(sp.i.value,80),
    length_cm:num(len.i.value,300),
    weight_kg:num2(wt.i.value,500),
    bait:txt(bait.i.value,120),
    note:txt(note.i.value,500),
    released:cb.checked?true:null,
  })});
}

/* ---------- raccordement ---------- */

const visible=()=>{ const pv=document.getElementById("v-profil"); return !!pv&&!pv.hidden&&pv.dataset.s==="moi"; };

const prevProfil=A.hooks.profil;
A.hooks.profil=()=>{ try{ prevProfil?.(); }catch(e){} safe(refresh); };
const prevProfilSub=A.hooks.profilSub;
A.hooks.profilSub=v=>{ try{ prevProfilSub?.(v); }catch(e){} if(v==="moi") safe(refresh); };
const prevChange=A.hooks.change;
A.hooks.change=()=>{
  try{ prevChange?.(); }catch(e){}
  if(!A.me){ const b=box(); if(b) b.hidden=true; return; }
  if(visible()) safe(refresh);
  safe(()=>sync());
};
window.addEventListener("online",()=>{ safe(drawStatus); safe(()=>sync()); });
window.addEventListener("offline",()=>{ safe(drawStatus); });
window.addEventListener("visibilitychange",()=>{ if(document.hidden) return; safe(drawStatus); if(navigator.onLine) safe(()=>sync()); });
setInterval(()=>{ if(navigator.onLine&&A.me) safe(()=>sync()); },60000);

A.logbook={list:mine,sync:()=>sync(true)};

if(A.me&&visible()) refresh();
else if(A.me) sync();
})();
