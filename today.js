// Rivio : écran « Aujourd'hui » (tableau de bord en tête de l'onglet Conseils).
(function(){
"use strict";
const A=window.CDJ; if(!A) return;
const {el}=A;
const $=s=>document.querySelector(s);
function btn(label,cls,fn){ const b=el("button",cls||"btn",label); b.type="button"; if(fn) b.addEventListener("click",fn); return b; }
const view=$("#v-conseils");
const box=el("div","today"); box.id="today";
view.prepend(box);
// le détail météo et conseils est replié derrière la carte du jour
let open=false; try{ open=localStorage.getItem("cdj-today-open")==="1"; }catch(e){}
function setOpen(v){ open=v; view.classList.toggle("detail-open",open); try{ localStorage.setItem("cdj-today-open",open?"1":"0"); }catch(e){} const t=$("#today-toggle"); if(t){ t.textContent=open?"Masquer le détail ▴":"Météo et conseils détaillés ▾"; t.setAttribute("aria-expanded",String(open)); } }
view.classList.add("has-today");

const slot=(id)=>{ let s=box.querySelector("#"+id); if(!s){ s=el("div","today-sec"); s.id=id; box.append(s); } return s; };
const sGo=slot("td-go"), sDay=slot("td-day"), sCatch=slot("td-catch"), sOut=slot("td-out");

/* ---------- Carte du jour ---------- */
function day(){
  const T=window.CDJ_TODAY;
  sDay.innerHTML="";
  const c=el("button","day-card"); c.type="button"; c.setAttribute("aria-label","Voir la météo et les conseils détaillés");
  if(!T){ c.append(el("div","dc-place","Chargement des conditions…")); }
  else{
    const top=el("div","dc-top");
    const t=el("div","dc-temp"); t.append(el("span","dc-num",T.water.toFixed(1).replace(".",",")),el("span","dc-u","°C"));
    const side=el("div","dc-side");
    side.append(el("div","dc-k",(T.water_measured?"Eau mesurée":"Eau estimée")+(T.live?"":" · exemple")),el("div","dc-v",T.sky+" · air "+Math.round(T.air)+" °C · vent "+Math.round(T.wind)+" km/h"),el("div","dc-v2","Pression "+T.trend));
    top.append(t,side); c.append(top);
    // Provenance : d'où vient la météo, de quand elle date, eau mesurée ou non.
    const prov=el("div","dc-prov");
    prov.append(el("span",null,"📍 "+(T.place||"position par défaut")));
    prov.append(el("span",null,"🕐 "+(T.when||"à l'instant")+(T.cached?" · hors ligne":"")));
    prov.append(el("span",null,T.water_measured?"🌡️ eau mesurée":"🌡️ eau estimée"));
    c.append(prov);
    const favs=(T.fav||[]).filter(x=>!x.closed);
    const fav=favs[0], others=T.top.filter(x=>!favs.some(f=>f.name===x.name));
    const block=(label,x,cls)=>{
      const b=el("div","dc-best"+(cls?" "+cls:""));
      b.append(el("span","dc-bk",label));
      const row=el("div","dc-brow"); row.append(el("span","dc-bn",x.name),el("span","dc-bp",x.pct+" %"));
      b.append(row);
      if(x.from) b.append(el("span","dc-bh","🕒 "+x.from+" – "+x.to));
      c.append(b);
    };
    if(fav){
      // l'espèce favorite du compte d'abord, puis la plus adaptée du moment
      block("⭐ Ton espèce favorite",fav,"dc-fav");
      if(others[0]) block("🏆 La plus adaptée en ce moment",others[0],"dc-second");
      const rest=[...favs.slice(1),...others.slice(1)].slice(0,2);
      if(rest.length){ const o=el("div","dc-others"); rest.forEach(x=>o.append(el("span",null,x.name+" "+x.pct+" %"+(x.from?" · "+x.from:"")))); c.append(o); }
    }else{
      const best=T.top[0];
      if(best){
        block("Meilleur coup du jour",best);
        if(T.top.length>1){ const o=el("div","dc-others"); T.top.slice(1).forEach(x=>o.append(el("span",null,x.name+" "+x.pct+" %"+(x.from?" · "+x.from:"")))); c.append(o); }
      }
    }
    c.append(el("div","dc-place","📍 "+String(T.place).replace(/^📍\s*/,"")+" · "+T.when));
  }
  c.addEventListener("click",()=>{ setOpen(!open); if(open) setTimeout(()=>$("#v-conseils .conds")?.scrollIntoView({behavior:"smooth",block:"start"}),60); });
  sDay.append(c);
  const tg=el("button","linkbtn today-toggle"); tg.type="button"; tg.id="today-toggle"; tg.addEventListener("click",()=>setOpen(!open)); sDay.append(tg);
  A.hooks.dayExtras?.(sDay,T);
  setOpen(open);
}

/* ---------- Dernières prises du groupe ---------- */
let outSeq=0, catSeq=0;
async function catches(){
  const seq=++catSeq;
  if(!A.me||!A.groups.length){ sCatch.innerHTML=""; return; }
  let q=A.sb.from("posts").select("id,group_id,species,length_cm,weight_kg,photo_path,photo_paths,created_at,profiles!posts_user_id_fkey(username)").eq("status","published").order("created_at",{ascending:false}).limit(6);
  if(typeof A.cur==="number") q=q.eq("group_id",A.cur);
  const {data}=await q; const rows=data||[];
  if(seq!==catSeq) return;
  if(!rows.length){ sCatch.innerHTML=""; return; }
  const paths=rows.map(r=>(r.photo_paths&&r.photo_paths[0])||r.photo_path).filter(Boolean);
  let urls={};
  if(paths.length){ const {data:s}=await A.sb.storage.from("photos").createSignedUrls(paths,3600); (s||[]).forEach(x=>urls[x.path]=x.signedUrl); }
  if(seq!==catSeq) return;
  sCatch.innerHTML="";
  const h=el("div","today-h"); h.append(el("h2",null,"Dernières prises"),btn("Tout voir","linkbtn",()=>location.hash="#fil")); sCatch.append(h);
  const strip=el("div","catch-strip");
  rows.forEach(r=>{
    const p=(r.photo_paths&&r.photo_paths[0])||r.photo_path;
    const c=el("button","catch-c"); c.type="button";
    const im=el("div","catch-img"); if(p&&urls[p]) im.style.backgroundImage="url('"+urls[p]+"')"; else im.append(el("span",null,"🐟"));
    c.append(im, el("b",null,(r.species||"Prise")+(r.length_cm?" · "+String(r.length_cm).replace(".",",")+" cm":"")), el("span","note","@"+(r.profiles?.username||"?")+" · "+A.ago(r.created_at)));
    c.addEventListener("click",()=>location.hash="#fil");
    strip.append(c);
  });
  sCatch.append(strip);
}

/* ---------- Prochaine sortie prévue ---------- */
async function nextOuting(){
  const seq=++outSeq;
  if(!A.me||!A.groups.length){ sOut.innerHTML=""; return; }
  const out=el("div");
  let q=A.sb.from("outings").select("id,group_id,title,place,start_at").gte("start_at",new Date(Date.now()-2*36e5).toISOString()).order("start_at").limit(1);
  if(typeof A.cur==="number") q=q.eq("group_id",A.cur);
  const {data}=await q; const o=data?.[0];
  if(seq!==outSeq) return;
  const h=el("div","today-h"); h.append(el("h2",null,"Prochaine sortie"));
  out.append(h);
  if(!o){ const r=el("div","out-card empty"); r.append(el("span",null,"Rien de prévu pour l'instant."),btn("Proposer une sortie","btn small",()=>location.hash="#groupe")); out.append(r); sOut.replaceChildren(...out.childNodes); return; }
  const {data:rs}=await A.sb.from("outing_rsvps").select("status").eq("outing_id",o.id);
  if(seq!==outSeq) return;
  const yes=(rs||[]).filter(x=>x.status==="yes").length;
  const d=new Date(o.start_at);
  const r=el("button","out-card"); r.type="button";
  const cal=el("div","out-cal"); cal.append(el("b",null,String(d.getDate())),el("span",null,d.toLocaleDateString("fr-FR",{month:"short"}).replace(".","")));
  const t=el("div","out-t"); t.append(el("b",null,o.title),el("span","note",d.toLocaleDateString("fr-FR",{weekday:"long"})+" "+d.toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"}).replace(":","h")+(o.place?" · "+o.place:"")+" · "+yes+" partant"+(yes>1?"s":"")));
  r.append(cal,t); r.addEventListener("click",()=>location.hash="#groupe");
  out.append(r); sOut.replaceChildren(...out.childNodes);
}

/* ---------- Potes au bord de l'eau + bouton « Je pars pêcher » ---------- */
function mates(){
  // le module « Je pars pêcher » remplit #gofish-conseils : on le place en tête
  const g=$("#gofish-conseils"); if(g&&g.parentNode!==sGo) sGo.append(g);
  const pq=$("#permit-quick"); if(pq&&pq.parentNode!==sGo) sGo.append(pq);
}

function all(){ day(); mates(); catches(); nextOuting(); }
window.addEventListener("cdj-today",day);
const prevChange=A.hooks.change; A.hooks.change=()=>{ prevChange?.(); mates(); catches(); nextOuting(); };
all();
setTimeout(mates,800);
})();
