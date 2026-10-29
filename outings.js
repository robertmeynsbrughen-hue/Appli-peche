// Coup du Jour : sorties planifiées (qui vient, covoiturage, matos partagé).
(function(){
"use strict";
const A=window.CDJ; if(!A) return;
const {el,toast,frError,confirmBtn,userLabel}=A;
const $=s=>document.querySelector(s);
function btn(label,cls,fn){ const b=el("button",cls||"btn",label); b.type="button"; if(fn) b.addEventListener("click",fn); return b; }
const ST={yes:["✅","Je viens"],maybe:["🤔","Peut-être"],no:["❌","Non"]};
const when=d=>{ const x=new Date(d); return x.toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long"})+" · "+x.toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"}).replace(":","h"); };
function rel(d){
  const t=new Date(d), now=new Date(), a=new Date(now.getFullYear(),now.getMonth(),now.getDate()), b=new Date(t.getFullYear(),t.getMonth(),t.getDate());
  const n=Math.round((b-a)/864e5);
  return n===0?"Aujourd'hui":n===1?"Demain":n<7?"Dans "+n+" jours":null;
}
let seq=0;
async function render(host,gid){
  const s=++seq;
  const since=new Date(Date.now()-12*36e5).toISOString();
  const {data:outs,error}=await A.sb.from("outings").select("id,group_id,user_id,title,place,spot_id,start_at,notes,profiles(username,is_admin)").eq("group_id",gid).gte("start_at",since).order("start_at").limit(20);
  const ids=(outs||[]).map(o=>o.id);
  const {data:rs}=ids.length?await A.sb.from("outing_rsvps").select("outing_id,user_id,status,seats,needs_ride,brings,profiles(username,is_admin)").in("outing_id",ids):{data:[]};
  if(s!==seq||!host.isConnected) return;
  host.innerHTML="";
  const sec=el("section","g-sec");
  const add=btn("+ Nouvelle sortie","btn small",()=>{ f.hidden=!f.hidden; if(!f.hidden) f.querySelector("input").focus(); });
  const hd=el("div","g-sec-head"); hd.append(el("h2",null,"Sorties prévues"),add); sec.append(hd);
  const f=form(gid,host); f.hidden=true; sec.append(f);
  if(error){ sec.append(el("p","err",frError(error))); host.append(sec); return; }
  if(!outs?.length) sec.append(el("p","empty small","Aucune sortie prévue. Lance « Samedi 6h au lac » et le groupe sera prévenu."));
  (outs||[]).forEach(o=>sec.append(card(o,(rs||[]).filter(r=>r.outing_id===o.id),host,gid)));
  host.append(sec);
}
function card(o,rs,host,gid){
  const c=el("article","outing");
  const top=el("div","out-top");
  const date=el("div","out-date"); const r=rel(o.start_at); if(r) date.append(el("span","out-rel",r)); date.append(el("span",null,when(o.start_at)));
  top.append(date);
  if(o.user_id===A.me.id||A.canModerate(o.group_id)) top.append(confirmBtn("Supprimer","Confirmer",async()=>{ const {error}=await A.sb.from("outings").delete().eq("id",o.id); if(error) return toast(frError(error)); toast("Sortie supprimée"); render(host,gid); },"linkbtn danger"));
  c.append(top, el("h3","out-title",o.title));
  const spot=o.spot_id?A.spots.find(x=>x.id===o.spot_id):null;
  if(spot){ const b=btn("📍 "+spot.name,"linkbtn",()=>{ location.hash="#carte"; setTimeout(()=>A.focusSpot?.(spot.id),300); }); c.append(b); }
  else if(o.place) c.append(el("div","note","📍 "+o.place));
  if(o.notes) c.append(el("p","out-notes",o.notes));
  const by=el("div","post-date"); by.append("Proposée par "); by.append(userLabel(o.profiles?.username,o.profiles?.is_admin)); c.append(by);
  // participants
  const yes=rs.filter(x=>x.status==="yes"), maybe=rs.filter(x=>x.status==="maybe");
  const ppl=el("div","chips");
  if(!yes.length&&!maybe.length) ppl.append(el("span","chip","Personne pour l'instant"));
  [...yes,...maybe].forEach(x=>ppl.append(el("span","chip"+(x.status==="yes"?" plus":""),ST[x.status][0]+" @"+(x.profiles?.username||"?"))));
  c.append(el("h4","g-sub",yes.length+" partant"+(yes.length>1?"s":"")+(maybe.length?" · "+maybe.length+" peut-être":"")), ppl);
  // covoiturage et matos
  const going=[...yes,...maybe];
  const cars=going.filter(x=>x.seats>0), need=going.filter(x=>x.needs_ride), gear=going.filter(x=>x.brings);
  if(cars.length||need.length){
    const free=cars.reduce((a,x)=>a+x.seats,0);
    c.append(el("h4","g-sub","Covoiturage · "+free+" place"+(free>1?"s":"")+" libre"+(free>1?"s":"")));
    const ul=el("ul","out-list");
    cars.forEach(x=>ul.append(el("li",null,"🚗 @"+(x.profiles?.username||"?")+" : "+x.seats+" place"+(x.seats>1?"s":""))));
    need.forEach(x=>ul.append(el("li",null,"🙋 @"+(x.profiles?.username||"?")+" cherche une place")));
    c.append(ul);
  }
  if(gear.length){
    c.append(el("h4","g-sub","Matos partagé"));
    const ul=el("ul","out-list");
    gear.forEach(x=>ul.append(el("li",null,"🎒 @"+(x.profiles?.username||"?")+" : "+x.brings)));
    c.append(ul);
  }
  // ma réponse
  const mine=rs.find(x=>x.user_id===A.me.id);
  const me={status:mine?.status||null,seats:mine?.seats||0,needs_ride:!!mine?.needs_ride,brings:mine?.brings||""};
  const save=async patch=>{
    Object.assign(me,patch);
    const {error}=await A.sb.from("outing_rsvps").upsert({outing_id:o.id,user_id:A.me.id,status:me.status||"yes",seats:me.seats,needs_ride:me.needs_ride,brings:me.brings||null,updated_at:new Date().toISOString()},{onConflict:"outing_id,user_id"});
    if(error) return toast(frError(error));
    render(host,gid);
  };
  const seg=el("div","seg"); seg.setAttribute("aria-label","Ma réponse");
  Object.entries(ST).forEach(([k,[e,t]])=>{ const b=btn(e+" "+t,null,()=>save({status:k,...(k==="no"?{seats:0,needs_ride:false}:{})})); b.setAttribute("aria-pressed",String(me.status===k)); seg.append(b); });
  c.append(seg);
  if(me.status==="yes"||me.status==="maybe"){
    const opts=el("div","out-opts");
    const sl=el("label","field","Places dans ma voiture"); const ss=el("select"); for(let i=0;i<=6;i++) ss.append(new Option(i?String(i):"Aucune",i)); ss.value=String(me.seats);
    ss.addEventListener("change",()=>save({seats:Number(ss.value),needs_ride:Number(ss.value)>0?false:me.needs_ride})); sl.append(ss);
    const nl=el("label","switch"); const ni=el("input"); ni.type="checkbox"; ni.checked=me.needs_ride; ni.addEventListener("change",()=>save({needs_ride:ni.checked,seats:ni.checked?0:me.seats}));
    const nt=el("span","switch-t"); nt.append(el("b",null,"Je cherche une place")); nl.append(ni,el("span","switch-ui"),nt);
    const bl=el("label","field","J'apporte"); const bi=el("input"); bi.maxLength=120; bi.placeholder="Bateau, sondeur, amorce, café…"; bi.value=me.brings;
    bi.addEventListener("change",()=>save({brings:bi.value.trim()})); bl.append(bi);
    opts.append(sl,nl,bl); c.append(opts);
  }
  return c;
}
function form(gid,host){
  const f=el("form","panel");
  const fld=(label,input)=>{ const l=el("label","field",label); l.append(input); return l; };
  const ti=el("input"); ti.required=true; ti.minLength=3; ti.maxLength=80; ti.placeholder="Samedi 6h au lac";
  const di=el("input"); di.type="datetime-local"; di.required=true;
  const t=new Date(); t.setDate(t.getDate()+(6-t.getDay()+7)%7||7); t.setHours(6,0,0,0);
  const pad=n=>String(n).padStart(2,"0"); di.value=t.getFullYear()+"-"+pad(t.getMonth()+1)+"-"+pad(t.getDate())+"T06:00";
  const ss=el("select"); ss.append(new Option("Aucun spot (lieu libre)","")); A.spots.filter(x=>x.group_id===gid).forEach(x=>ss.append(new Option(x.name,x.id)));
  const pi=el("input"); pi.maxLength=80; pi.placeholder="Lac de Clarens, parking nord";
  const ni=el("textarea"); ni.maxLength=500; ni.placeholder="Programme, espèces visées, permis…";
  const row=el("div","row2"); row.append(fld("Date et heure",di),fld("Spot",ss));
  const ok=el("button","btn primary","Proposer la sortie"); ok.type="submit";
  const act=el("div","actions"); act.append(ok,btn("Annuler","btn",()=>{ f.hidden=true; }));
  f.append(fld("Titre",ti),row,fld("Lieu (si pas de spot)",pi),fld("Infos (facultatif)",ni),act);
  f.addEventListener("submit",async e=>{
    e.preventDefault();
    const start=new Date(di.value); if(isNaN(start)) return toast("Date invalide");
    if(start<new Date(Date.now()-36e5)) return toast("Choisis une date à venir");
    ok.disabled=true;
    const {data,error}=await A.sb.from("outings").insert({group_id:gid,user_id:A.me.id,title:ti.value.trim(),spot_id:ss.value?Number(ss.value):null,place:pi.value.trim()||null,start_at:start.toISOString(),notes:ni.value.trim()||null}).select("id").single();
    ok.disabled=false;
    if(error) return toast(frError(error));
    await A.sb.from("outing_rsvps").upsert({outing_id:data.id,user_id:A.me.id,status:"yes"},{onConflict:"outing_id,user_id"});
    toast("Sortie proposée, le groupe est prévenu"); render(host,gid);
  });
  return f;
}
const prev=A.hooks.groupeExtras;
A.hooks.groupeExtras=(box,gid,mod)=>{
  prev?.(box,gid,mod);
  const root=box.parentElement; if(!root) return;
  const host=el("div","g-outings");
  const anchor=root.querySelector(".todo")||root.querySelector(".g-head");
  if(anchor) anchor.after(host); else root.prepend(host);
  render(host,gid);
};
if(A.me&&!$("#v-groupe").hidden) A.hooks.groupe?.();
})();
