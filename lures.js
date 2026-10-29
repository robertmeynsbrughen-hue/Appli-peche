// Coup du Jour : journal des leurres (ma boîte, avec les prises de chaque leurre).
(function(){
"use strict";
const A=window.CDJ; if(!A) return;
const {el,toast,frError,confirmBtn}=A;
const $=s=>document.querySelector(s);
function btn(label,cls,fn){ const b=el("button",cls||"btn",label); b.type="button"; if(fn) b.addEventListener("click",fn); return b; }
const KINDS=["Shad","Swimbait","Jerkbait","Poisson nageur","Spinnerbait","Chatterbait","Cuillère","Ondulante","Drop-shot","Texan","Jig","Top-water","Frog","Micro-leurre","Mouche","Autre"];
const norm=t=>String(t||"").normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase().trim();
const pub=p=>p?A.sb.storage.from("avatars").getPublicUrl(p).data.publicUrl:null;
let lures=[], catches=[], seq=0, editing=null;

async function load(){
  const box=$("#lures"); if(!box) return;
  if(!A.me){ box.hidden=true; return; }
  box.hidden=false;
  const s=++seq;
  const [{data:l,error},{data:p},{data:se}]=await Promise.all([
    A.sb.from("lures").select("*").eq("user_id",A.me.id).order("created_at"),
    A.sb.from("posts").select("species,length_cm,bait,caption,created_at").eq("user_id",A.me.id).eq("status","published").limit(2000),
    A.sb.from("sessions").select("species,caught,length_cm,lure,color,created_at").eq("user_id",A.me.id).eq("caught",true).limit(2000),
  ]);
  if(s!==seq) return;
  if(error){ box.innerHTML=""; box.append(el("p","err",/lures/.test(error.message)?"Journal des leurres bientôt disponible.":frError(error))); return; }
  lures=l||[];
  catches=[...(p||[]).map(x=>({sp:x.species,len:x.length_cm,at:x.created_at,text:norm((x.bait||"")+" "+(x.caption||""))})),
           ...(se||[]).map(x=>({sp:x.species,len:x.length_cm,at:x.created_at,lure:norm(x.lure),color:norm(x.color)}))];
  draw();
}
// une prise compte pour un leurre si son nom apparaît dans l'appât, ou si le type + le coloris du bilan correspondent
function statsOf(l){
  const n=norm(l.name), k=norm(l.kind), c=norm(l.color);
  const hit=catches.filter(x=>(x.text&&n.length>=3&&x.text.includes(n))||(x.lure&&k&&x.lure===k&&(!c||x.color===c)));
  const sp=new Map(); hit.forEach(h=>h.sp&&sp.set(h.sp,(sp.get(h.sp)||0)+1));
  const best=hit.filter(h=>h.len).sort((a,b)=>b.len-a.len)[0];
  return {n:hit.length,sp:[...sp.entries()].sort((a,b)=>b[1]-a[1]).map(x=>x[0]).slice(0,3),best,last:hit.map(h=>h.at).sort().pop()};
}
function draw(){
  const box=$("#lures"); box.innerHTML="";
  const h=el("div","g-sec-head"); h.append(el("h2",null,"Ma boîte à leurres"));
  h.append(btn(editing==="new"?"Fermer":"+ Ajouter","btn small",()=>{ editing=editing==="new"?null:"new"; draw(); }));
  box.append(h);
  if(editing==="new") box.append(form(null));
  if(!lures.length&&editing!=="new"){ box.append(el("p","note","Ajoute tes leurres préférés avec une photo : l'appli compte tout seul les prises faites avec chacun, d'après tes posts et tes bilans.")); return; }
  const g=el("div","lure-grid");
  lures.map(l=>({l,s:statsOf(l)})).sort((a,b)=>b.s.n-a.s.n).forEach(({l,s},i)=>{
    if(editing===l.id){ g.append(form(l)); return; }
    const c=el("div","lure"+(i===0&&s.n?" top":""));
    const ph=el("div","lure-ph"); const u=pub(l.photo_path);
    if(u){ const im=el("img"); im.src=u; im.alt=l.name; im.loading="lazy"; ph.append(im); } else ph.append(el("span",null,"🎣"));
    c.append(ph);
    const t=el("div","lure-t"); t.append(el("b",null,l.name), el("span","note",[l.kind,l.color,l.weight_g?String(l.weight_g).replace(".",",")+" g":null].filter(Boolean).join(" · ")));
    c.append(t);
    const st=el("div","lure-st"); st.append(el("span","lure-n",String(s.n)), el("span","note","prise"+(s.n>1?"s":"")));
    c.append(st);
    if(s.n) c.append(el("div","note",[s.sp.join(", "),s.best?"record "+String(s.best.len).replace(".",",")+" cm":null].filter(Boolean).join(" · ")));
    if(l.notes) c.append(el("p","lure-notes",l.notes));
    const act=el("div","actions"); act.append(btn("Modifier","linkbtn",()=>{ editing=l.id; draw(); }));
    act.append(confirmBtn("Supprimer","Confirmer",async()=>{ const {error}=await A.sb.from("lures").delete().eq("id",l.id); if(error) return toast(frError(error)); if(l.photo_path) A.sb.storage.from("avatars").remove([l.photo_path]); lures=lures.filter(x=>x.id!==l.id); draw(); },"linkbtn danger"));
    c.append(act); g.append(c);
  });
  box.append(g);
}
function form(l){
  const f=el("form","lure-form");
  const fld=(label,input)=>{ const x=el("label","field",label); x.append(input); return x; };
  const ni=el("input"); ni.required=true; ni.maxLength=60; ni.placeholder="Ex. Swimbait 15 perche"; ni.value=l?.name||"";
  const ks=el("select"); ks.append(new Option("Type…","")); KINDS.forEach(k=>ks.append(new Option(k,k))); ks.value=l?.kind||"";
  const ci=el("input"); ci.maxLength=40; ci.placeholder="Perche, firetiger…"; ci.value=l?.color||"";
  const wi=el("input"); wi.type="number"; wi.step="0.5"; wi.min="0.5"; wi.inputMode="decimal"; wi.placeholder="g"; wi.value=l?.weight_g??"";
  const no=el("input"); no.maxLength=300; no.placeholder="Animation, montage, où il marche…"; no.value=l?.notes||"";
  const pi=el("input"); pi.type="file"; pi.accept="image/*";
  const r1=el("div","row2"); r1.append(fld("Type",ks),fld("Coloris",ci));
  const r2=el("div","row2"); r2.append(fld("Poids (g)",wi),fld("Photo",pi));
  const ok=el("button","btn primary",l?"Enregistrer":"Ajouter à ma boîte"); ok.type="submit";
  const act=el("div","actions"); act.append(ok,btn("Annuler","btn",()=>{ editing=null; draw(); }));
  f.append(fld("Nom",ni),r1,r2,fld("Notes",no),act);
  f.addEventListener("submit",async e=>{
    e.preventDefault(); ok.disabled=true;
    try{
      let path=l?.photo_path||null;
      if(pi.files?.[0]){
        const blob=await A.compress(pi.files[0]);
        path=A.me.id+"/lure-"+Date.now()+".jpg";
        const up=await A.sb.storage.from("avatars").upload(path,blob,{contentType:"image/jpeg"});
        if(up.error) throw up.error;
        if(l?.photo_path) A.sb.storage.from("avatars").remove([l.photo_path]);
      }
      const row={user_id:A.me.id,name:ni.value.trim(),kind:ks.value||null,color:ci.value.trim()||null,weight_g:wi.value?Number(wi.value):null,notes:no.value.trim()||null,photo_path:path};
      const q=l?A.sb.from("lures").update(row).eq("id",l.id):A.sb.from("lures").insert(row);
      const {error}=await q; if(error) throw error;
      editing=null; toast(l?"Leurre modifié":"Leurre ajouté"); load();
    }catch(err){ toast(frError(err)); }
    finally{ ok.disabled=false; }
  });
  return f;
}
const prevProfil=A.hooks.profil;
A.hooks.profil=()=>{ prevProfil?.(); load(); };
if(A.me&&!$("#v-profil").hidden) load();
})();
