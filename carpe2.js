// Rivio : minuteur par canne, carnet d'amorçage et photo du mois.
(function(){
"use strict";
const A=window.CDJ; if(!A) return;
const {el,toast,frError}=A;
const $=s=>document.querySelector(s);
function btn(label,cls,fn){ const b=el("button",cls||"btn",label); b.type="button"; if(fn) b.addEventListener("click",fn); return b; }
const hm=d=>new Date(d).toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"}).replace(":","h");
const num=x=>String(x).replace(".",",");
const ls={ get(k,d){ try{ const v=localStorage.getItem(k); return v==null?d:JSON.parse(v); }catch(e){ return d; } },
           set(k,v){ try{ if(v==null) localStorage.removeItem(k); else localStorage.setItem(k,JSON.stringify(v)); }catch(e){} } };

/* =================== Minuteur par canne =================== */
const STEPS=[15,20,30,45,60,90,120,180];
const key=id=>"cdj-rods-"+id;
let timersBox=null, rang={};
function state(){ const c=A.carp?.cur; return c?ls.get(key(c.id),{}):{}; }
function save(st){ const c=A.carp?.cur; if(c) ls.set(key(c.id),st); }
async function dropAlarm(id){ if(id&&typeof id==="number") await A.sb.from("wake_alarms").delete().eq("id",id); }
async function arm(r,every){
  const c=A.carp.cur, st=state(), old=st[r];
  const next=new Date(Date.now()+every*6e4);
  await dropAlarm(old?.alarm);
  const label=c.rods>1?"Canne "+r:"Ta canne";
  const {data,error}=await A.sb.from("wake_alarms").insert({user_id:A.me.id,fire_at:next.toISOString(),title:"🎣 "+label+" : c'est l'heure de relancer",body:"Vérifie l'esche et relance (minuteur de "+every+" min). Touche « Relancée » dans l'appli pour repartir.",url:"./#fil"}).select("id").single();
  st[r]={every,next:next.toISOString(),alarm:error?null:data.id};
  save(st); delete rang[r];
  if(error) toast("Minuteur lancé sur ce téléphone (notification indisponible : "+frError(error)+")");
}
async function stop(r){ const st=state(); await dropAlarm(st[r]?.alarm); delete st[r]; save(st); delete rang[r]; draw(); }
function left(t){ return Math.round((new Date(t.next).getTime()-Date.now())/6e4); }
function draw(){
  const box=timersBox, c=A.carp?.cur; if(!box||!c) return;
  box.innerHTML="";
  const st=state();
  const h=el("div","rt-head"); h.append(el("b",null,"⏲️ Minuteur par canne"),el("span","note","Une alarme par canne pour vérifier l'esche et relancer, même téléphone en veille."));
  box.append(h);
  for(let r=1;r<=c.rods;r++){
    const t=st[r], row=el("div","rt-row"+(t&&left(t)<=0?" due":""));
    const name=el("span","rt-name",c.rods>1?"Canne "+r:"Ta canne");
    row.append(name);
    if(t){
      const l=left(t);
      const info=el("span","rt-left",l<=0?"À relancer !":"dans "+(l>=60?Math.floor(l/60)+" h "+String(l%60).padStart(2,"0"):l+" min"));
      info.dataset.rod=r;
      const act=el("div","rt-act");
      act.append(btn("✓ Relancée","btn primary small",async()=>{ await arm(r,t.every); A.carp.addEvent("relance",null,null,r); }));
      const sel=el("select"); sel.setAttribute("aria-label","Intervalle canne "+r); STEPS.forEach(v=>sel.append(new Option(v+" min",v))); sel.value=String(t.every);
      sel.addEventListener("change",async()=>{ await arm(r,Number(sel.value)); draw(); });
      act.append(sel,btn("✕","icon-btn small",()=>stop(r)));
      act.lastChild.setAttribute("aria-label","Arrêter le minuteur");
      row.append(info,act);
    }else{
      const sel=el("select"); sel.setAttribute("aria-label","Lancer un minuteur canne "+r); sel.append(new Option("Lancer un minuteur…",""));
      STEPS.forEach(v=>sel.append(new Option("toutes les "+v+" min",v)));
      sel.addEventListener("change",async()=>{ if(!sel.value) return; await arm(r,Number(sel.value)); toast("⏲️ Minuteur lancé : prochaine alarme à "+hm(state()[r].next)); draw(); });
      row.append(el("span","rt-left off","pas de minuteur"),sel);
    }
    box.append(row);
  }
}
setInterval(()=>{
  const c=A.carp?.cur; if(!c||!timersBox||!document.body.contains(timersBox)) return;
  const st=state(); let redraw=false;
  Object.entries(st).forEach(([r,t])=>{
    const l=left(t), lab=timersBox.querySelector('.rt-left[data-rod="'+r+'"]');
    if(lab) lab.textContent=l<=0?"À relancer !":"dans "+(l>=60?Math.floor(l/60)+" h "+String(l%60).padStart(2,"0"):l+" min");
    if(l<=0&&rang[r]!==t.next&&document.visibilityState==="visible"){ rang[r]=t.next; A.carp.beep?.(); toast("🎣 "+(c.rods>1?"Canne "+r:"Ta canne")+" : c'est l'heure de relancer"); redraw=true; }
  });
  if(redraw) draw();
},15000);

/* =================== Carnet d'amorçage =================== */
const MIX=["Bouillettes","Pellets","Graines","Maïs","Chènevis","Tigernuts","Farines / stick mix","Asticots","Vers"];
let bSeq=0;
async function baitData(){
  const [b,cs,po]=await Promise.all([
    A.sb.from("baitings").select("id,group_id,spot_id,at,mix,qty_kg,note").eq("user_id",A.me.id).order("at",{ascending:false}).limit(200),
    A.sb.from("carp_sessions").select("spot_id,carp_events(kind,at)").eq("user_id",A.me.id).not("spot_id","is",null).limit(500),
    A.sb.from("posts").select("spot_id,created_at,species").eq("user_id",A.me.id).not("spot_id","is",null).ilike("species","carpe%").limit(500),
  ]);
  if(b.error) throw b.error;
  const catches=[];
  (cs.data||[]).forEach(s=>(s.carp_events||[]).filter(e=>e.kind==="prise").forEach(e=>catches.push({spot:s.spot_id,at:new Date(e.at).getTime()})));
  (po.data||[]).forEach(p=>catches.push({spot:p.spot_id,at:new Date(p.created_at).getTime()}));
  // une prise publiée et notée dans la session compte deux fois : on fusionne celles à moins de 20 min d'écart
  catches.sort((x,y)=>x.at-y.at);
  const uniq=catches.filter((c,i)=>!catches.slice(0,i).some(d=>d.spot===c.spot&&Math.abs(d.at-c.at)<20*6e4));
  const list=(b.data||[]).map(x=>{ const t=new Date(x.at).getTime(); return {...x,res:x.spot_id?uniq.filter(c=>c.spot===x.spot_id&&c.at>=t&&c.at<=t+72*36e5).length:null}; });
  return list;
}
function baitStats(list){
  const done=list.filter(x=>x.res!=null&&(x.res>0||Date.now()-new Date(x.at).getTime()>72*36e5));
  const by=new Map();
  done.forEach(x=>(x.mix||[]).forEach(m=>{ const s=by.get(m)||{n:0,c:0}; s.n++; s.c+=x.res||0; by.set(m,s); }));
  return [...by].filter(([,s])=>s.n>=2).map(([m,s])=>({m,n:s.n,avg:s.c/s.n})).sort((a,b)=>b.avg-a.avg);
}
function baitSheet(){
  const back=el("div","sheet-back"), sh=el("div","sheet bait-sheet"); sh.setAttribute("role","dialog"); sh.setAttribute("aria-modal","true"); sh.setAttribute("aria-label","Carnet d'amorçage");
  const head=el("div","sheet-head"); head.append(el("h2",null,"📒 Carnet d'amorçage")); const x=btn("✕","icon-btn"); x.setAttribute("aria-label","Fermer"); head.append(x); sh.append(head);
  const close=()=>back.remove(); x.addEventListener("click",close); back.addEventListener("click",e=>{ if(e.target===back) close(); });
  sh.append(el("p","note","Note chaque amorçage (pré-amorçage ou pendant la session). L'appli compte tes carpes prises sur le même poste dans les 72 h qui suivent, pour voir ce qui marche."));
  // formulaire
  const f=el("form","bait-form"); const c=A.carp?.cur;
  const sl=el("label","field","Poste"); const ss=el("select"); ss.append(new Option("Aucun / hors carte",""));
  const mySpots=A.spots.filter(s=>typeof A.cur!=="number"||s.group_id===A.cur);
  mySpots.forEach(s=>ss.append(new Option(s.name,s.id))); if(c?.spot_id) ss.value=String(c.spot_id); sl.append(ss);
  const dl=el("label","field","Quand"); const di=el("input"); di.type="datetime-local";
  const now=new Date(); now.setMinutes(now.getMinutes()-now.getTimezoneOffset()); di.value=now.toISOString().slice(0,16); dl.append(di);
  const row=el("div","row2"); row.append(sl,dl);
  const mixBox=el("div","chips-pick"); mixBox.append(el("span","pick-label","Mélange"));
  const picked=new Set();
  MIX.forEach(m=>{ const b=btn(m,"pick",()=>{ picked.has(m)?picked.delete(m):picked.add(m); b.classList.toggle("on",picked.has(m)); b.setAttribute("aria-pressed",String(picked.has(m))); }); b.setAttribute("aria-pressed","false"); mixBox.append(b); });
  const ql=el("label","field","Quantité (kg)"); const qi=el("input"); qi.type="number"; qi.min="0.1"; qi.max="200"; qi.step="0.1"; qi.inputMode="decimal"; qi.placeholder="ex. 3"; ql.append(qi);
  const nl=el("label","field","Note"); const ni=el("input"); ni.maxLength=300; ni.placeholder="Spod à 60 m, bouillettes 20 mm scopex…"; if(c?.groundbait) ni.value=c.groundbait; nl.append(ni);
  const row2=el("div","row2"); row2.append(ql,nl);
  const ok=el("button","btn primary","Enregistrer l'amorçage"); ok.type="submit";
  const act=el("div","actions"); act.append(ok);
  f.append(row,mixBox,row2,act);
  const listBox=el("div","bait-list");
  f.addEventListener("submit",async e=>{
    e.preventDefault();
    if(!picked.size&&!qi.value&&!ni.value.trim()) return toast("Indique au moins le mélange ou la quantité");
    ok.disabled=true;
    const sp=ss.value?Number(ss.value):null, spot=A.spots.find(s=>s.id===sp);
    const {error}=await A.sb.from("baitings").insert({user_id:A.me.id,group_id:spot?.group_id??(typeof A.cur==="number"?A.cur:null),spot_id:sp,at:new Date(di.value).toISOString(),mix:[...picked],qty_kg:qi.value?Number(qi.value):null,note:ni.value.trim()||null});
    ok.disabled=false;
    if(error) return toast(frError(error));
    toast("🥣 Amorçage noté"); qi.value=""; picked.clear(); mixBox.querySelectorAll(".pick").forEach(b=>{ b.classList.remove("on"); b.setAttribute("aria-pressed","false"); });
    fill(listBox);
  });
  sh.append(f,listBox); back.append(sh); document.body.append(back);
  fill(listBox);
}
async function fill(box){
  const seq=++bSeq; box.innerHTML=""; box.append(el("p","note","Chargement…"));
  let list; try{ list=await baitData(); }catch(e){ if(seq===bSeq){ box.innerHTML=""; box.append(el("p","err",frError(e))); } return; }
  if(seq!==bSeq) return;
  box.innerHTML="";
  if(!list.length){ box.append(el("p","note","Aucun amorçage noté pour l'instant.")); return; }
  const st=baitStats(list);
  if(st.length){
    box.append(el("h4","g-sub","Ce qui marche pour toi"));
    const g=el("div","bait-stats");
    st.slice(0,5).forEach((s,i)=>{ const d=el("div","bs-row"+(i===0?" top":"")); d.append(el("b",null,s.m),el("span",null,num(s.avg.toFixed(1))+" carpe"+(s.avg>=2?"s":"")+" par amorçage"),el("span","note",s.n+" amorçages")); g.append(d); });
    box.append(g);
  }
  box.append(el("h4","g-sub","Historique"));
  const ul=el("div","list tight");
  list.slice(0,40).forEach(x=>{
    const r=el("div","mrow bait-row");
    const l=el("div");
    const spot=A.spots.find(s=>s.id===x.spot_id);
    l.append(el("b",null,new Date(x.at).toLocaleDateString("fr-FR",{weekday:"short",day:"numeric",month:"short"})+" · "+hm(x.at)+(spot?" · 📍 "+spot.name:"")));
    l.append(el("div","note",[(x.mix||[]).join(", "),x.qty_kg?num(x.qty_kg)+" kg":null,x.note].filter(Boolean).join(" · ")||"—"));
    const pending=Date.now()-new Date(x.at).getTime()<72*36e5;
    const res=x.res==null?el("span","bait-res none","sans poste"):el("span","bait-res"+(x.res?" ok":""),x.res?"🐟 "+x.res:pending?"en cours":"0");
    res.title=x.res==null?"Choisis un poste pour suivre le résultat":"Carpes prises sur ce poste dans les 72 h";
    const del=btn("✕","icon-btn small",async()=>{ if(!confirm("Supprimer cet amorçage ?")) return; const {error}=await A.sb.from("baitings").delete().eq("id",x.id); if(error) return toast(frError(error)); fill(box); });
    del.setAttribute("aria-label","Supprimer");
    r.append(l,res,del); ul.append(r);
  });
  box.append(ul);
}

A.hooks.carpDrawn=(prev=>(box,active)=>{
  prev?.(box,active);
  if(!A.me) return;
  if(active){
    timersBox=el("div","rod-timers");
    const after=box.querySelector(".bait-rem");
    after?after.after(timersBox):box.append(timersBox);
    draw();
  }else timersBox=null;
  const b=btn("📒 Carnet d'amorçage","btn bait-open",baitSheet);
  const end=[...box.children].reverse().find(x=>x.classList.contains("actions"));
  if(active&&end) end.prepend(b); else box.append(el("div","actions bait-actions")), box.lastChild.append(b);
})(A.hooks.carpDrawn);
A.hooks.carpEnded=(prev=>()=>{
  prev?.();
  // la session est finie : on coupe les minuteurs restants
  Object.keys(localStorage).filter(k=>k.startsWith("cdj-rods-")).forEach(k=>{ const st=ls.get(k,{}); Object.values(st).forEach(t=>dropAlarm(t.alarm)); ls.set(k,null); });
})(A.hooks.carpEnded);
A.baitings={open:baitSheet};

/* =================== Photo du mois =================== */
const monthStart=(d,off)=>{ const p=new Intl.DateTimeFormat("sv-SE",{timeZone:"Europe/Paris"}).format(d).slice(0,7).split("-").map(Number); const x=new Date(Date.UTC(p[0],p[1]-1+(off||0),1)); return x.toISOString().slice(0,10); };
const monthName=iso=>new Date(iso+"T12:00:00Z").toLocaleDateString("fr-FR",{month:"long",timeZone:"UTC"});
let pSeq=0;
async function photoMonth(host,gid){
  const seq=++pSeq;
  const cur=monthStart(new Date()), prev=monthStart(new Date(),-1), next=monthStart(new Date(),1);
  // les mois sont calculés à l'heure de Paris, une marge d'un jour suffit pour le filtre
  const from=new Date(Date.parse(prev)-864e5).toISOString(), to=new Date(Date.parse(next)+864e5).toISOString();
  const [{data:posts,error},{data:votes}]=await Promise.all([
    A.sb.from("posts").select("id,user_id,species,length_cm,photo_path,created_at,profiles(username)").eq("group_id",gid).eq("status","published").not("photo_path","is",null).gte("created_at",from).lt("created_at",to).order("created_at",{ascending:false}).limit(200),
    A.sb.from("photo_votes").select("month,user_id,post_id").eq("group_id",gid).in("month",[cur,prev]),
  ]);
  if(seq!==pSeq) return;
  host.innerHTML="";
  const h=el("div","g-sec-head"); h.append(el("h2",null,"📸 Photo du mois")); host.append(h);
  if(error){ host.append(el("p","err",frError(error))); return; }
  const mOf=p=>monthStart(new Date(p.created_at));
  const now=(posts||[]).filter(p=>mOf(p)===cur), last=(posts||[]).filter(p=>mOf(p)===prev);
  const vCur=(votes||[]).filter(v=>v.month===cur), vPrev=(votes||[]).filter(v=>v.month===prev);
  const paths=[...now.map(p=>p.photo_path)];
  // gagnant du mois dernier
  let win=null;
  if(vPrev.length){
    const cnt=new Map(); vPrev.forEach(v=>cnt.set(v.post_id,(cnt.get(v.post_id)||0)+1));
    const best=Math.max(...cnt.values());
    const cands=last.filter(p=>cnt.get(p.id)===best).sort((a,b)=>new Date(a.created_at)-new Date(b.created_at));
    if(cands[0]){ win={p:cands[0],n:best}; paths.push(win.p.photo_path); }
  }
  const {data:signed}=paths.length?await A.sb.storage.from("photos").createSignedUrls([...new Set(paths)],3600):{data:[]};
  if(seq!==pSeq) return;
  const url={}; (signed||[]).forEach(s=>{ if(s.signedUrl) url[s.path]=s.signedUrl; });
  if(win){
    const w=el("button","pm-winner"); w.type="button";
    const img=el("img"); img.alt="Photo gagnante"; img.src=url[win.p.photo_path]||""; img.loading="lazy";
    const t=el("div","pm-wt");
    t.append(el("span","pm-crown","🏆 "+monthName(prev)),el("b",null,"@"+(win.p.profiles?.username||"?")),el("span","note",[win.p.species,win.p.length_cm?num(win.p.length_cm)+" cm":null].filter(Boolean).join(" · ")+" · "+win.n+" vote"+(win.n>1?"s":"")));
    w.append(img,t); w.addEventListener("click",()=>A.openPost?.(win.p.id));
    host.append(w);
  }
  const mine=vCur.find(v=>v.user_id===A.me.id);
  const voters=new Set(vCur.map(v=>v.user_id)).size;
  host.append(el("p","note",now.length?"Vote pour ta photo préférée "+(/^[aeiou]/i.test(monthName(cur))?"d'":"de ")+monthName(cur)+" (une voix, modifiable). Résultat le 1er du mois prochain. "+voters+" votant"+(voters>1?"s":"")+" pour l'instant.":"Aucune photo de prise ce mois-ci pour l'instant. Publie la tienne !"));
  if(!now.length) return;
  const g=el("div","pm-grid");
  now.forEach(p=>{
    const own=p.user_id===A.me.id, voted=mine?.post_id===p.id;
    const c=el("button","pm-cell"+(voted?" voted":"")+(own?" own":"")); c.type="button";
    const img=el("img"); img.alt="Prise de @"+(p.profiles?.username||"?"); img.loading="lazy"; img.src=url[p.photo_path]||"";
    c.append(img,el("span","pm-who","@"+(p.profiles?.username||"?")));
    if(voted) c.append(el("span","pm-vote","⭐ Ta voix"));
    else if(own) c.append(el("span","pm-vote own","Ta photo"));
    c.setAttribute("aria-label",(own?"Ta photo":"Voter pour la photo de @"+(p.profiles?.username||"?"))+(voted?" (ta voix actuelle, toucher pour retirer)":""));
    c.addEventListener("click",async()=>{
      if(own) return toast("Tu ne peux pas voter pour ta propre photo");
      const {data,error}=await A.sb.rpc("vote_photo",{p_post:p.id});
      if(error) return toast(frError(error));
      toast(data==="retire"?"Vote retiré":"⭐ Vote enregistré pour @"+(p.profiles?.username||"?"));
      photoMonth(host,gid);
    });
    g.append(c);
  });
  host.append(g);
}
A.hooks.groupeExtras=(prev=>(box,gid,mod)=>{
  prev?.(box,gid,mod);
  if(!A.me||typeof gid!=="number") return;
  const host=el("section","g-sec g-photomonth"); host.dataset.sub="activite";
  box.after(host);
  photoMonth(host,gid);
})(A.hooks.groupeExtras);
if(A.me&&!$("#v-groupe").hidden) A.hooks.groupe?.();
})();
