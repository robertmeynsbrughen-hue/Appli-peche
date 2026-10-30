// Rivio : compétitions entre amis (un week-end, des points, un classement en direct).
(function(){
"use strict";
const A=window.CDJ; if(!A) return;
const {el,toast,frError,confirmBtn,userLabel}=A;
const $=s=>document.querySelector(s);
function btn(label,cls,fn){ const b=el("button",cls||"btn",label); b.type="button"; if(fn) b.addEventListener("click",fn); return b; }
const MODES={points:"Points (taille × rareté)",biggest:"Plus grosse prise",count:"Plus de prises"};
const fmt=n=>Number(n).toLocaleString("fr-FR");
const norm=t=>String(t||"").normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase().trim();
const when=d=>new Date(d).toLocaleDateString("fr-FR",{weekday:"short",day:"numeric",month:"short"})+" "+new Date(d).toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"}).replace(":","h");
function left(ms){ const h=Math.floor(ms/36e5); return h>=48?Math.round(h/24)+" jours":h>=1?h+" h "+String(Math.floor(ms%36e5/6e4)).padStart(2,"0"):Math.max(1,Math.round(ms/6e4))+" min"; }
function rarity(sp){ const e=A.dex?.entryOf(sp); return e?[1,1,1.5,2][e.rare]:1; }

let seq=0;
async function render(host,gid){
  const s=++seq;
  const since=new Date(Date.now()-14*864e5).toISOString();
  const {data:comps,error}=await A.sb.from("competitions").select("*").eq("group_id",gid).gte("end_at",since).order("start_at").limit(10);
  if(s!==seq||!host.isConnected) return;
  host.innerHTML="";
  if(error){ if(!/competitions/.test(error.message)) host.append(el("p","err",frError(error))); return; }
  const sec=el("section","g-sec");
  const hd=el("div","g-sec-head"); hd.append(el("h2",null,"Compétitions"));
  const mod=A.canModerate(gid);
  const f=form(gid,host); f.hidden=true;
  if(mod) hd.append(btn("+ Lancer","btn small",()=>{ f.hidden=!f.hidden; }));
  sec.append(hd); if(mod) sec.append(f);
  if(!comps?.length){ sec.append(el("p","empty small",mod?"Aucune compétition. Lance un week-end de pêche avec classement en direct !":"Aucune compétition en cours. Les modérateurs peuvent en lancer une.")); host.append(sec); return; }
  // prises du groupe sur la période couverte par les compétitions
  const from=comps.reduce((a,c)=>c.start_at<a?c.start_at:a,comps[0].start_at), to=comps.reduce((a,c)=>c.end_at>a?c.end_at:a,comps[0].end_at);
  const [{data:po},{data:se},{data:cs},{data:mem}]=await Promise.all([
    A.sb.from("posts").select("user_id,species,length_cm,weight_kg,created_at").eq("group_id",gid).eq("status","published").gte("created_at",from).lte("created_at",to).limit(3000),
    A.sb.from("sessions").select("user_id,species,caught,length_cm,created_at").eq("group_id",gid).eq("caught",true).gte("created_at",from).lte("created_at",to).limit(3000),
    A.sb.from("carp_sessions").select("user_id,carp_events(kind,at,weight_kg)").eq("group_id",gid).lte("started_at",to).limit(500),
    A.sb.from("memberships").select("user_id,profiles(username,is_admin)").eq("group_id",gid).eq("status","active"),
  ]);
  if(s!==seq||!host.isConnected) return;
  const names=new Map((mem||[]).map(m=>[m.user_id,m.profiles]));
  const catches=[...(po||[]),...(se||[])].map(x=>({u:x.user_id,sp:x.species,len:Number(x.length_cm)||0,kg:Number(x.weight_kg)||0,at:x.created_at}));
  (cs||[]).forEach(c=>(c.carp_events||[]).filter(e=>e.kind==="prise").forEach(e=>catches.push({u:c.user_id,sp:"Carpe",len:0,kg:Number(e.weight_kg)||0,at:e.at})));
  const now=Date.now();
  comps.forEach(c=>sec.append(card(c,catches,names,now,host,gid)));
  host.append(sec);
}
function standings(c,catches){
  const s0=Date.parse(c.start_at), e0=Date.parse(c.end_at);
  const inW=catches.filter(x=>{ const t=Date.parse(x.at); return t>=s0&&t<=e0&&(!c.species||norm(x.sp)===norm(c.species)); });
  const by=new Map();
  inW.forEach(x=>{
    const r=by.get(x.u)||{u:x.u,pts:0,n:0,best:0,bestKg:0};
    r.n++; r.best=Math.max(r.best,x.len); r.bestKg=Math.max(r.bestKg,x.kg);
    r.pts+=Math.round((x.len||10)*rarity(x.sp));
    by.set(x.u,r);
  });
  const key=c.mode==="count"?r=>r.n*1e6+r.best:c.mode==="biggest"?r=>r.best*1e3+r.bestKg:r=>r.pts;
  return [...by.values()].sort((a,b)=>key(b)-key(a));
}
function card(c,catches,names,now,host,gid){
  const st=new Date(c.start_at).getTime(), en=new Date(c.end_at).getTime();
  const state=now<st?"soon":now>en?"done":"live";
  const box=el("article","comp "+state);
  const top=el("div","comp-top");
  top.append(el("span","comp-state",state==="live"?"● EN DIRECT · encore "+left(en-now):state==="soon"?"Commence dans "+left(st-now):"Terminée"));
  if(c.user_id===A.me.id||A.canModerate(c.group_id)) top.append(confirmBtn("Supprimer","Confirmer",async()=>{ const {error}=await A.sb.from("competitions").delete().eq("id",c.id); if(error) return toast(frError(error)); render(host,gid); },"linkbtn danger"));
  box.append(top, el("h3","comp-title",c.title));
  box.append(el("div","note",MODES[c.mode]+(c.species?" · "+c.species+" uniquement":" · toutes espèces")+" · du "+when(c.start_at)+" au "+when(c.end_at)));
  const rk=standings(c,catches);
  const val=r=>c.mode==="count"?r.n+" prise"+(r.n>1?"s":""):c.mode==="biggest"?(r.best?fmt(r.best)+" cm":fmt(r.bestKg)+" kg"):fmt(r.pts)+" pts";
  if(state==="done"&&rk[0]){
    const w=el("div","comp-win"); w.append(el("span","comp-cup","🏆")); const t=el("div"); t.append(el("span","label","Vainqueur")); const n=el("div"); n.append(userLabel(names.get(rk[0].u)?.username,names.get(rk[0].u)?.is_admin)," · "+val(rk[0])); t.append(n); w.append(t); box.append(w);
  }
  if(state==="soon") box.append(el("p","note","Le classement démarrera avec la première prise publiée pendant la compétition."));
  else if(!rk.length) box.append(el("p","note",state==="live"?"Aucune prise pour l'instant : à toi d'ouvrir le score !":"Aucune prise pendant la compétition."));
  else{
    const list=el("div","list tight rk-list"); const medal=["🥇","🥈","🥉"];
    rk.slice(0,10).forEach((r,i)=>{
      const row=el("div","mrow"+(r.u===A.me.id?" me":""));
      const l=el("div","rk-l"); l.append(el("span","rk-pos",medal[i]||String(i+1)), userLabel(names.get(r.u)?.username,names.get(r.u)?.is_admin));
      row.append(l, el("span","rk-v",val(r)+(c.mode!=="count"?" · "+r.n+" prise"+(r.n>1?"s":""):"")));
      list.append(row);
    });
    box.append(list);
  }
  if(c.mode==="points") box.append(el("p","note","Points : taille en cm × rareté (×1 commun, ×1,5 peu commun, ×2 rare), 10 points pour une prise sans taille."));
  return box;
}
function form(gid,host){
  const f=el("form","panel");
  const fld=(label,input)=>{ const l=el("label","field",label); l.append(input); return l; };
  const ti=el("input"); ti.required=true; ti.minLength=3; ti.maxLength=80; ti.placeholder="Open carnassiers du week-end";
  const ms=el("select"); Object.entries(MODES).forEach(([k,v])=>ms.append(new Option(v,k)));
  const ss=el("select"); ss.append(new Option("Toutes espèces","")); (A.dex?.DEX||[]).forEach(d=>ss.append(new Option(d.name,d.name)));
  const pad=n=>String(n).padStart(2,"0"), loc=d=>d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate())+"T"+pad(d.getHours())+":"+pad(d.getMinutes());
  const sat=new Date(); sat.setDate(sat.getDate()+((6-sat.getDay()+7)%7||7)); sat.setHours(6,0,0,0);
  const sun=new Date(sat); sun.setDate(sun.getDate()+1); sun.setHours(20,0,0,0);
  const si=el("input"); si.type="datetime-local"; si.required=true; si.value=loc(sat);
  const ei=el("input"); ei.type="datetime-local"; ei.required=true; ei.value=loc(sun);
  const r1=el("div","row2"); r1.append(fld("Classement",ms),fld("Espèce",ss));
  const r2=el("div","row2"); r2.append(fld("Début",si),fld("Fin",ei));
  const ok=el("button","btn primary","Lancer la compétition"); ok.type="submit";
  const act=el("div","actions"); act.append(ok,btn("Annuler","btn",()=>{ f.hidden=true; }));
  f.append(fld("Nom",ti),r1,r2,act);
  f.addEventListener("submit",async e=>{
    e.preventDefault();
    const st=new Date(si.value), en=new Date(ei.value);
    if(!(en>st)) return toast("La fin doit être après le début");
    if(en-st>31*864e5) return toast("31 jours maximum");
    ok.disabled=true;
    const {error}=await A.sb.from("competitions").insert({group_id:gid,user_id:A.me.id,title:ti.value.trim(),mode:ms.value,species:ss.value||null,start_at:st.toISOString(),end_at:en.toISOString()});
    ok.disabled=false;
    if(error) return toast(frError(error));
    toast("Compétition lancée, le groupe est prévenu"); render(host,gid);
  });
  return f;
}
const prev=A.hooks.groupeExtras;
A.hooks.groupeExtras=(box,gid,mod)=>{
  prev?.(box,gid,mod);
  const host=el("div","g-comp"); host.dataset.sub="activite";
  const after=box.parentElement?.querySelector(".g-outings")||box;
  if(after===box) box.before(host); else after.after(host);
  render(host,gid);
};
if(A.me&&!$("#v-groupe").hidden) A.hooks.groupe?.();
})();
