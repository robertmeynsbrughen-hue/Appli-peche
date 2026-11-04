// Rivio : planning des postes. Sur la fiche d'un poste, chacun indique quand il
// y pêche ; le groupe voit qui occupe quel poste pour ne pas se marcher dessus.
(function(){
"use strict";
const A=window.CDJ; if(!A) return;
const {el,toast,frError,userLabel}=A;
const $=s=>document.querySelector(s);
function btn(label,cls,fn){ const b=el("button",cls||"btn",label); b.type="button"; if(fn) b.addEventListener("click",fn); return b; }
const fmt=d=>new Date(d).toLocaleString("fr-FR",{weekday:"short",day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}).replace(":","h");
const local=d=>{ const x=new Date(d); return new Date(x-x.getTimezoneOffset()*6e4).toISOString().slice(0,16); };
function nextSaturday(){ const d=new Date(); d.setHours(6,0,0,0); const k=(6-d.getDay()+7)%7||7; d.setDate(d.getDate()+k); return d; }
const overlaps=(a,b)=>new Date(a.starts_at)<new Date(b.ends_at)&&new Date(b.starts_at)<new Date(a.ends_at);
const who=b=>{ const n=b.profiles?.username||"?"; const s=el("span","user-link","@"+n); s.dataset.user=n; return s; };

async function load(q){ const {data,error}=await q; if(error) throw error; return data||[]; }
const SEL="id,group_id,spot_id,user_id,starts_at,ends_at,rods,note,profiles(username),spots(name)";

/* ---------- Sur la fiche du poste ---------- */
async function spotBlock(s,sh){
  if(!A.me) return;
  const box=el("div","postes"); box.append(el("h3","knot-h","📅 Qui pêche ici ?"),el("p","note","Chargement…"));
  const hist=sh.querySelector(".spot-hist"); if(hist) hist.before(box); else sh.append(box);
  const draw=async()=>{
    let list=[]; try{ list=await load(A.sb.from("spot_bookings").select(SEL).eq("spot_id",s.id).gt("ends_at",new Date().toISOString()).order("starts_at").limit(30)); }
    catch(e){ box.lastChild.textContent=frError(e); return; }
    box.innerHTML=""; box.append(el("h3","knot-h","📅 Qui pêche ici ?"));
    if(!list.length) box.append(el("p","note","Personne n'a prévu de pêcher ici. Indique quand tu viens : le groupe le verra."));
    const ul=el("ul","postes-list");
    list.forEach(b=>{
      const li=el("li"); const now=Date.now(); const live=new Date(b.starts_at)<=now;
      const t=el("div"); const l=el("b"); l.append(who(b),live?" · en ce moment":""); t.append(l,el("div","note",fmt(b.starts_at)+" → "+fmt(b.ends_at)+(b.rods?" · "+b.rods+" canne"+(b.rods>1?"s":""):"")+(b.note?" · "+b.note:"")));
      li.append(t);
      if(b.user_id===A.me.id||A.canModerate?.(b.group_id)) li.append(btn("Annuler","linkbtn danger",async()=>{ const {error}=await A.sb.from("spot_bookings").delete().eq("id",b.id); if(error) return toast(frError(error)); toast("Réservation annulée"); draw(); }));
      ul.append(li);
    });
    if(list.length) box.append(ul);
    const f=el("form","postes-form"); f.hidden=true;
    const st=el("input"); st.type="datetime-local"; st.value=local(nextSaturday()); st.required=true;
    const en=el("input"); en.type="datetime-local"; en.value=local(new Date(+nextSaturday()+30*36e5)); en.required=true;
    const rods=el("select"); rods.append(new Option("Non précisé","")); [1,2,3,4].forEach(n=>rods.append(new Option(n+" canne"+(n>1?"s":""),n)));
    const note=el("input"); note.maxLength=160; note.placeholder="Ex. : session carpe, je prends le bord gauche";
    const r=el("div","row2"); const l1=el("label","field","Arrivée"); l1.append(st); const l2=el("label","field","Départ"); l2.append(en); r.append(l1,l2);
    const ok=el("button","btn primary small","Réserver le poste"); ok.type="submit";
    const l3=el("label","field","Cannes"); l3.append(rods); const l4=el("label","field","Un mot pour le groupe"); l4.append(note); f.append(r,l3,l4,ok);
    f.addEventListener("submit",async e=>{
      e.preventDefault();
      const row={group_id:s.group_id,spot_id:s.id,user_id:A.me.id,starts_at:new Date(st.value).toISOString(),ends_at:new Date(en.value).toISOString(),rods:rods.value?Number(rods.value):null,note:note.value.trim()||null};
      if(new Date(row.ends_at)<=new Date(row.starts_at)) return toast("Le départ doit être après l'arrivée");
      if(new Date(row.ends_at)-new Date(row.starts_at)>7*864e5) return toast("7 jours au maximum");
      const clash=list.filter(b=>b.user_id!==A.me.id&&overlaps(b,row));
      if(clash.length&&!confirm("@"+clash.map(b=>b.profiles?.username).join(", @")+" a déjà prévu d'être sur ce poste à ce moment-là. Réserver quand même ?")) return;
      ok.disabled=true; const {error}=await A.sb.from("spot_bookings").insert(row); ok.disabled=false;
      if(error) return toast(frError(error));
      toast("📅 Poste réservé, le groupe le voit"); draw();
    });
    box.append(btn("📅 J'y vais","btn small",()=>{ f.hidden=!f.hidden; }),f);
  };
  draw();
}
const prevSE=A.hooks.spotExtras; A.hooks.spotExtras=(s,sh)=>{ prevSE?.(s,sh); spotBlock(s,sh); };

/* ---------- Dans le groupe : les postes de la semaine ---------- */
let seq=0;
async function groupBlock(host,gid){
  const k=++seq;
  let list=[]; try{ list=await load(A.sb.from("spot_bookings").select(SEL).eq("group_id",gid).gt("ends_at",new Date().toISOString()).lt("starts_at",new Date(Date.now()+8*864e5).toISOString()).order("starts_at").limit(40)); }catch(e){ list=[]; }
  if(k!==seq||!host.isConnected) return;
  host.innerHTML="";
  const sec=el("section","g-sec"); const hd=el("div","g-sec-head"); hd.append(el("h2",null,"Postes réservés")); sec.append(hd);
  if(!list.length){ sec.append(el("p","note","Aucun poste réservé cette semaine. Ouvre la fiche d'un poste sur la carte et touche « J'y vais ».")); host.append(sec); return; }
  const ul=el("ul","postes-list");
  list.forEach(b=>{
    const li=el("li"); const t=el("div"); const l=el("b",null,(b.spots?.name||"Poste")+" · "); l.append(who(b));
    const clash=list.some(o=>o!==b&&o.spot_id===b.spot_id&&o.user_id!==b.user_id&&overlaps(o,b));
    t.append(l,el("div","note",fmt(b.starts_at)+" → "+fmt(b.ends_at)+(b.rods?" · "+b.rods+" canne"+(b.rods>1?"s":""):"")+(clash?" · ⚠️ chevauche une autre réservation":"")));
    li.append(t,btn("📍","btn small",()=>{ const sp=A.spots.find(x=>x.id===b.spot_id); if(sp){ location.hash="#carte"; setTimeout(()=>A.map?.setView([sp.lat,sp.lon],16),300); } }));
    ul.append(li);
  });
  sec.append(ul); host.append(sec);
}
const prevG=A.hooks.groupeExtras;
A.hooks.groupeExtras=(box,gid,mod)=>{
  prevG?.(box,gid,mod);
  const root=box.parentElement; if(!root) return;
  const host=el("div","g-postes"); host.dataset.sub="activite";
  const after=root.querySelector(".g-outings")||root.querySelector(".subbar")||root.querySelector(".g-head");
  if(after) after.after(host); else root.prepend(host);
  groupBlock(host,gid);
};
})();
