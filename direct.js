// Rivio : sessions carpe en direct. Les départs, touches et prises des potes
// arrivent en temps réel (Supabase Realtime, règles d'accès appliquées).
(function(){
"use strict";
const A=window.CDJ; if(!A) return;
const {el,toast}=A;
const $=s=>document.querySelector(s);
const hhmm=d=>new Date(d).toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"}).replace(":","h");
function ago(d){ const m=Math.round((Date.now()-new Date(d))/6e4); return m<1?"à l'instant":m<60?"il y a "+m+" min":"il y a "+Math.floor(m/60)+" h "+String(m%60).padStart(2,"0"); }
const E={depart:"🔔",touche:"〰️",prise:"🐟",amorcage:"🥣",relance:"🎣"};
let live=new Map(), channel=null, subKey="", tick=null;

async function load(){
  if(!A.me||!A.sb) return;
  const since=new Date(Date.now()-48*36e5).toISOString();
  const {data,error}=await A.sb.from("carp_sessions").select("id,group_id,user_id,spot_id,rods,started_at,ended_at,profiles!carp_sessions_user_id_fkey(username),carp_events(kind,at,rod,weight_kg)").is("ended_at",null).gt("started_at",since).neq("user_id",A.me.id).order("started_at",{ascending:false}).limit(20);
  if(error) return;
  live=new Map((data||[]).map(s=>[s.id,s])); render();
}
function slots(){
  const mk=(id,before)=>{ let s=document.getElementById(id); if(!s&&before){ s=el("div","carp-live-slot"); s.id=id; before.before(s); } return s; };
  return [mk("carp-live-conseils",$("#gofish-conseils")||$("#permit-quick")||$("#regl")),mk("carp-live-fil",$("#gofish-fil")||$("#post-mode"))].filter(Boolean);
}
function render(){
  const list=[...live.values()].filter(s=>typeof A.cur!=="number"||s.group_id===A.cur);
  slots().forEach(slot=>{
    slot.innerHTML=""; slot.hidden=!list.length; if(!list.length) return;
    list.slice(0,3).forEach(s=>{
      const ev=(s.carp_events||[]).slice().sort((a,b)=>new Date(b.at)-new Date(a.at));
      const n=k=>ev.filter(e=>e.kind===k).length;
      const sp=A.spots.find(x=>x.id===s.spot_id);
      const c=el("div","carp-live");
      const h=el("div","carp-live-h"); h.append(el("span","live-dot"),el("b",null,"En direct"));
      const u=el("span","user-link","@"+(s.profiles?.username||"?")); if(s.profiles?.username) u.dataset.user=s.profiles.username;
      const t=el("div"); const l=el("div","carp-live-who"); l.append(u," en session carpe"+(sp?" · "+sp.name:"")); t.append(l);
      t.append(el("div","carp-live-k",E.depart+" "+n("depart")+" départ"+(n("depart")>1?"s":"")+" · "+E.touche+" "+n("touche")+" touche"+(n("touche")>1?"s":"")+" · "+E.prise+" "+n("prise")+" prise"+(n("prise")>1?"s":"")));
      t.append(el("div","note","depuis "+hhmm(s.started_at)+(ev[0]?" · dernier événement "+ago(ev[0].at):"")));
      c.append(h,t); slot.append(c);
    });
  });
}
function subscribe(){
  const key=A.me?A.me.id:"";
  if(key===subKey) return; subKey=key;
  if(channel){ A.sb?.removeChannel(channel); channel=null; }
  if(!A.me||!A.sb?.channel) return;
  channel=A.sb.channel("carp-live-"+key)
    .on("postgres_changes",{event:"*",schema:"public",table:"carp_sessions"},({new:s,eventType})=>{
      if(!s||s.user_id===A.me.id) return;
      if(s.ended_at){ live.delete(s.id); render(); return; }
      if(eventType==="INSERT"){ load(); }
    })
    .on("postgres_changes",{event:"INSERT",schema:"public",table:"carp_events"},({new:e})=>{
      const s=live.get(e.session_id); if(!s) return;
      s.carp_events=[...(s.carp_events||[]),e]; render();
      if(e.kind==="prise"||e.kind==="depart"){
        const sp=A.spots.find(x=>x.id===s.spot_id);
        toast((e.kind==="prise"?"🐟 Prise":"🔔 Départ")+" pour @"+(s.profiles?.username||"?")+(sp?" à "+sp.name:"")+(e.weight_kg?" · "+String(e.weight_kg).replace(".",",")+" kg":"")+" !");
      }
    })
    .subscribe();
}
function start(){ subscribe(); load(); clearInterval(tick); tick=setInterval(render,60000); }
const prevCh=A.hooks.change; A.hooks.change=(...a)=>{ prevCh?.(...a); if(A.me){ start(); } else { live.clear(); render(); } };
if(A.me) start();
})();
