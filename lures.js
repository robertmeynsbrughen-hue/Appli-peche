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
    A.sb.from("posts").select("species,length_cm,bait,caption,created_at,conditions").eq("user_id",A.me.id).eq("status","published").limit(2000),
    A.sb.from("sessions").select("species,caught,length_cm,lure,color,created_at,conditions").eq("user_id",A.me.id).eq("caught",true).limit(2000),
  ]);
  if(s!==seq) return;
  if(error){ box.innerHTML=""; box.append(el("p","err",/lures/.test(error.message)?"Journal des leurres bientôt disponible.":frError(error))); return; }
  lures=l||[];
  catches=[...(p||[]).map(x=>({sp:x.species,len:x.length_cm,at:x.created_at,cond:x.conditions,text:norm((x.bait||"")+" "+(x.caption||""))})),
           ...(se||[]).map(x=>({sp:x.species,len:x.length_cm,at:x.created_at,cond:x.conditions,lure:norm(x.lure),color:norm(x.color)}))];
  draw();
}
// une prise compte pour un leurre si son nom apparaît dans l'appât, ou si le type + le coloris du bilan correspondent
function statsOf(l){
  const n=norm(l.name), k=norm(l.kind), c=norm(l.color);
  const hit=catches.filter(x=>(x.text&&n.length>=3&&x.text.includes(n))||(x.lure&&k&&x.lure===k&&(!c||x.color===c)));
  const sp=new Map(); hit.forEach(h=>h.sp&&sp.set(h.sp,(sp.get(h.sp)||0)+1));
  const best=hit.filter(h=>h.len).sort((a,b)=>b.len-a.len)[0];
  return {n:hit.length,sp:[...sp.entries()].sort((a,b)=>b[1]-a[1]).map(x=>x[0]).slice(0,3),best,last:hit.map(h=>h.at).sort().pop(),pat:pattern(hit)};
}
/* ---------- Quand sortir ce leurre : les conditions de ses prises ---------- */
const PRESS=c=>c.dp<=-1?"baisse":c.dp>=1?"hausse":"stable";
const SKY=c=>(c.rain>=0.3||c.cloud>=65)?"couvert":c.cloud>=35?"voilé":"soleil";
const LBL={press:{baisse:"pression en baisse",stable:"pression stable",hausse:"pression en hausse"},sky:{couvert:"ciel couvert",voilé:"ciel voilé",soleil:"grand soleil"},phase:{aube:"à l'aube",jour:"en journée",crep:"au crépuscule",nuit:"de nuit"},flow:{basse:"basses eaux",normale:"débit normal",haute:"eau haute",crue:"en crue"}};
function majority(vals){ const m=new Map(); vals.forEach(v=>v!=null&&m.set(v,(m.get(v)||0)+1)); const n=[...m.values()].reduce((a,b)=>a+b,0); const top=[...m.entries()].sort((a,b)=>b[1]-a[1])[0]; return top&&n>=2&&top[1]/n>=0.6?top[0]:null; }
function pattern(hit){
  const cs=hit.map(h=>h.cond).filter(c=>c&&typeof c==="object"&&c.water!=null);
  if(cs.length<2) return null;
  const w=cs.map(c=>Number(c.water)).sort((a,b)=>a-b);
  return {n:cs.length,press:majority(cs.map(c=>c.dp!=null?PRESS(c):null)),sky:majority(cs.map(c=>c.cloud!=null?SKY(c):null)),phase:majority(cs.map(c=>c.phase||null)),flow:majority(cs.map(c=>c.flow||null)),wmin:Math.floor(w[0]),wmax:Math.ceil(w[w.length-1])};
}
function patText(pt){ return [pt.press&&LBL.press[pt.press],pt.sky&&LBL.sky[pt.sky],pt.phase&&LBL.phase[pt.phase],pt.flow&&LBL.flow[pt.flow],"eau "+(pt.wmin===pt.wmax?pt.wmin:pt.wmin+"–"+pt.wmax)+" °C"].filter(Boolean).join(" · "); }
// comparaison avec les conditions du jour (conseils en direct)
function todayFit(pt){
  const c=window.CDJ_ADVICE?.snapshot?.(); if(!c||!pt) return null;
  let ok=0, tot=0;
  const chk=(want,have)=>{ if(want==null) return; tot++; if(want===have) ok++; };
  chk(pt.press,PRESS(c)); chk(pt.sky,SKY(c)); chk(pt.flow,c.flow||null);
  tot++; if(c.water>=pt.wmin-1.5&&c.water<=pt.wmax+1.5) ok++;
  return {ok,tot,score:ok/tot};
}
function draw(){
  const box=$("#lures"); box.innerHTML="";
  const h=el("div","g-sec-head"); h.append(el("h2",null,"Ma boîte à leurres"));
  h.append(btn(editing==="new"?"Fermer":"+ Ajouter","btn small",()=>{ editing=editing==="new"?null:"new"; draw(); }));
  box.append(h);
  if(editing==="new") box.append(form(null));
  if(!lures.length&&editing!=="new"){ box.append(el("p","note","Ajoute tes leurres préférés avec une photo : l'appli compte tout seul les prises faites avec chacun, d'après tes posts et tes bilans.")); return; }
  const g=el("div","lure-grid");
  const all=lures.map(l=>({l,s:statsOf(l)}));
  // leurre du jour : celui dont les prises ressemblent le plus aux conditions d'aujourd'hui
  const day=all.map(x=>({...x,fit:todayFit(x.s.pat)})).filter(x=>x.fit&&x.fit.score>=0.75).sort((a,b)=>b.fit.score-a.fit.score||b.s.n-a.s.n)[0];
  if(day){ const d=el("div","lure-day"); d.append(el("span",null,"🎯 Leurre du jour"),el("b",null,day.l.name),el("span","note",patText(day.s.pat))); box.append(d); }
  all.sort((a,b)=>b.s.n-a.s.n).forEach(({l,s},i)=>{
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
    if(s.pat){
      const fit=todayFit(s.pat);
      const w=el("div","lure-when"+(fit&&fit.score>=0.75?" good":fit&&fit.score<0.5?" meh":""));
      w.append(el("b",null,"Quand le sortir"),el("span",null,"Marche surtout : "+patText(s.pat)+" ("+s.pat.n+" prises)"));
      if(fit) w.append(el("span","lw-today",fit.score>=0.75?"✅ Les conditions du jour lui vont bien":fit.score>=0.5?"🟡 Conditions du jour à moitié favorables":"➖ Pas vraiment son jour"));
      c.append(w);
    }else if(s.n) c.append(el("p","note lure-hint","Publie encore des prises avec ce leurre (météo en direct) pour savoir quand il marche le mieux."));
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
