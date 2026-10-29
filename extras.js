// Coup du Jour : réactions et commentaires, classements et défis du mois, carnet perso.
(function(){
"use strict";
const A=window.CDJ; if(!A) return;
const {el,toast,frError,confirmBtn,userLabel,ago}=A;
const $=s=>document.querySelector(s);
const SPECIES=["Brochet","Sandre","Perche","Black-bass","Silure","Carpe","Chevesne"];
const REACT=[["fire","🔥","Feu"],["clap","👏","Bravo"],["fish","🎣","Belle prise"]];
const fmt=n=>Number(n).toLocaleString("fr-FR");
const pl=(n,w,ws)=>n+" "+(n>1?(ws||w+"s"):w);
function btn(label,cls,fn){ const b=el("button",cls||"btn",label); b.type="button"; if(fn) b.addEventListener("click",fn); return b; }
function section(title,extra){
  const s=el("section","g-sec"); const h=el("div","g-sec-head"); h.append(el("h2",null,title)); if(extra) h.append(extra);
  s.append(h); return s;
}
const monthStart=(d=new Date())=>new Date(d.getFullYear(),d.getMonth(),1);
const monthKey=d=>{ const x=new Date(d); return x.getFullYear()+"-"+String(x.getMonth()+1).padStart(2,"0"); };
const monthName=d=>d.toLocaleDateString("fr-FR",{month:"long",year:"numeric"});
const sameSp=(a,b)=>String(a||"").trim().toLowerCase()===String(b||"").trim().toLowerCase();

/* ---------- Réactions et commentaires dans le fil ---------- */
async function feedExtras(list){
  if(!list.length) return;
  const ids=list.map(x=>x.post.id);
  const [{data:reac},{data:coms}]=await Promise.all([
    A.sb.from("reactions").select("post_id,user_id,emoji").in("post_id",ids),
    A.sb.from("comments").select("id,post_id,user_id,body,created_at,profiles(username,is_admin)").in("post_id",ids).order("created_at"),
  ]);
  for(const x of list){
    if(!x.foot.isConnected) continue;
    const box=el("div","social");
    x.foot.before(box);
    drawSocial(box,x.post,(reac||[]).filter(r=>r.post_id===x.post.id),(coms||[]).filter(c=>c.post_id===x.post.id));
  }
}
function drawSocial(box,p,reac,coms,open){
  box.innerHTML="";
  const bar=el("div","react-bar");
  REACT.forEach(([k,e,label])=>{
    const mine=reac.some(r=>r.emoji===k&&r.user_id===A.me.id), n=reac.filter(r=>r.emoji===k).length;
    const b=btn("","react-btn"); b.setAttribute("aria-pressed",mine?"true":"false"); b.setAttribute("aria-label",label+(n?" ("+n+")":""));
    b.append(el("span",null,e)); if(n) b.append(el("span","react-n",String(n)));
    b.addEventListener("click",async()=>{
      b.disabled=true;
      const q=mine?A.sb.from("reactions").delete().eq("post_id",p.id).eq("user_id",A.me.id).eq("emoji",k)
                  :A.sb.from("reactions").insert({post_id:p.id,user_id:A.me.id,emoji:k});
      const {error}=await q;
      if(error){ b.disabled=false; return toast(frError(error)); }
      reac=mine?reac.filter(r=>!(r.emoji===k&&r.user_id===A.me.id)):[...reac,{post_id:p.id,user_id:A.me.id,emoji:k}];
      drawSocial(box,p,reac,coms,open);
    });
    bar.append(b);
  });
  const cb=btn("💬 "+(coms.length?coms.length:"Commenter"),"react-btn com");
  cb.setAttribute("aria-expanded",open?"true":"false");
  cb.addEventListener("click",()=>{ drawSocial(box,p,reac,coms,!open); if(!open) box.querySelector(".cmt-form input")?.focus(); });
  bar.append(cb);
  box.append(bar);
  // 2 derniers commentaires visibles, le reste en dépliant
  const shown=open?coms:coms.slice(-2);
  if(shown.length||open){
    const ul=el("div","cmts");
    if(!open&&coms.length>2){
      const more=btn("Voir les "+coms.length+" commentaires","linkbtn small",()=>drawSocial(box,p,reac,coms,true)); ul.append(more);
    }
    shown.forEach(c=>{
      const r=el("div","cmt");
      const t=el("div","cmt-t"); t.append(userLabel(c.profiles?.username,c.profiles?.is_admin,A.roleOf(p.group_id,c.user_id)));
      t.append(el("span","post-date",ago(c.created_at)));
      r.append(t, el("p",null,c.body));
      if(c.user_id!==A.me.id&&A.report) r.append(btn("⚑ Signaler","linkbtn small rep-btn",()=>A.report({kind:"comment",target_id:c.id,group_id:p.group_id,excerpt:c.body,author_id:c.user_id})));
      if(c.user_id===A.me.id||A.canModerate(p.group_id)){
        r.append(confirmBtn("Supprimer","Confirmer",async()=>{
          const {error}=await A.sb.from("comments").delete().eq("id",c.id);
          if(error) return toast(frError(error));
          coms=coms.filter(z=>z.id!==c.id); drawSocial(box,p,reac,coms,open);
        },"linkbtn danger small"));
      }
      ul.append(r);
    });
    box.append(ul);
  }
  if(open){
    const f=el("form","cmt-form");
    const i=el("input"); i.maxLength=500; i.placeholder="Ton commentaire…"; i.setAttribute("aria-label","Commentaire"); i.autocomplete="off";
    const s=el("button","btn primary small","Envoyer"); s.type="submit";
    f.append(i,s);
    f.addEventListener("submit",async e=>{
      e.preventDefault(); const body=i.value.trim(); if(!body) return;
      s.disabled=true;
      const {data,error}=await A.sb.from("comments").insert({post_id:p.id,user_id:A.me.id,body}).select("id,post_id,user_id,body,created_at").single();
      s.disabled=false;
      if(error) return toast(frError(error));
      coms=[...coms,{...data,profiles:{username:A.me.username,is_admin:A.me.is_admin}}];
      drawSocial(box,p,reac,coms,true);
    });
    box.append(f);
  }
}

/* ---------- Classements et défis du mois (onglet Groupe) ---------- */
let gSeq=0;
async function groupeExtras(box,gid,mod){
  const seq=++gSeq;
  const start=monthStart().toISOString();
  const [{data:posts},{data:sess},{data:chal}]=await Promise.all([
    A.sb.from("posts").select("user_id,species,length_cm,weight_kg,created_at,profiles(username,is_admin)").eq("group_id",gid).eq("status","published").gte("created_at",start),
    A.sb.from("sessions").select("user_id,species,caught,length_cm,lure,color,rating,created_at,profiles(username,is_admin)").eq("group_id",gid).gte("created_at",start),
    A.sb.from("challenges").select("id,user_id,title,species,min_length,month").eq("group_id",gid).order("month",{ascending:false}).order("created_at",{ascending:false}).limit(30),
  ]);
  if(seq!==gSeq||!box.isConnected) return;
  box.innerHTML="";
  const catches=[...(posts||[]).filter(p=>p.species||p.length_cm),...(sess||[]).filter(s=>s.caught!==false&&(s.species||s.length_cm))];
  box.append(renderChallenges(gid,mod,chal||[],catches));
  box.append(renderRanking(posts||[],sess||[],catches));
}
function wins(c,catches){
  const m=String(c.month).slice(0,7);
  const ok=catches.filter(x=>monthKey(x.created_at)===m&&(!c.species||sameSp(x.species,c.species))&&(!c.min_length||Number(x.length_cm)>=Number(c.min_length)));
  const by=new Map(); ok.forEach(x=>{ if(!by.has(x.user_id)) by.set(x.user_id,x.profiles); });
  return [...by.entries()].map(([id,p])=>({id,username:p?.username||"?"}));
}
function renderChallenges(gid,mod,list,catches){
  const add=mod?btn("+ Nouveau défi","btn small",()=>{ form.hidden=!form.hidden; if(!form.hidden) form.querySelector("input").focus(); }):null;
  const s=section("Défis du mois",add);
  const form=challengeForm(gid); form.hidden=true; if(mod) s.append(form);
  const cur=monthKey(new Date());
  const now=list.filter(c=>String(c.month).slice(0,7)===cur);
  if(!now.length){ s.append(el("p","empty small",mod?"Aucun défi ce mois-ci. Lance-en un : « Brochet de 70 cm et plus », « Une perche de 35 cm »…":"Aucun défi ce mois-ci. Les modérateurs peuvent en lancer un.")); return s; }
  now.forEach(c=>{
    const w=wins(c,catches);
    const card=el("div","chal"+(w.some(x=>x.id===A.me.id)?" done":""));
    const h=el("div","chal-h"); h.append(el("span","chal-ico","🏅"));
    const t=el("div"); t.append(el("div","chal-t",c.title));
    t.append(el("div","note",[c.species||"Toutes espèces",c.min_length?"≥ "+fmt(c.min_length)+" cm":null].filter(Boolean).join(" · ")+" · se termine le "+new Date(new Date().getFullYear(),new Date().getMonth()+1,0).toLocaleDateString("fr-FR",{day:"numeric",month:"long"})));
    h.append(t); card.append(h);
    const ws=el("div","chips");
    if(w.length) w.forEach(x=>ws.append(el("span","chip plus","🏅 @"+x.username)));
    else ws.append(el("span","chip","Personne pour l'instant : à toi de jouer"));
    card.append(ws);
    if(mod) card.append(confirmBtn("Supprimer le défi","Confirmer",async()=>{ const {error}=await A.sb.from("challenges").delete().eq("id",c.id); if(error) return toast(frError(error)); toast("Défi supprimé"); A.hooks.groupe?.(); },"linkbtn danger small"));
    s.append(card);
  });
  s.append(el("p","note","Une prise publiée dans le fil ou un bilan avec la bonne espèce et la bonne taille valide le défi automatiquement."));
  return s;
}
function challengeForm(gid){
  const f=el("form","panel");
  const t=el("label","field","Défi"); const ti=el("input"); ti.required=true; ti.maxLength=80; ti.minLength=3; ti.placeholder="Ex. Brochet de 70 cm et plus"; t.append(ti);
  const row=el("div","row2");
  const sp=el("label","field","Espèce"); const ss=el("select"); ss.append(new Option("Toutes","")); SPECIES.forEach(x=>ss.append(new Option(x,x))); sp.append(ss);
  const ln=el("label","field","Taille mini (cm)"); const li=el("input"); li.type="number"; li.min="1"; li.max="300"; li.inputMode="numeric"; li.placeholder="facultatif"; ln.append(li);
  row.append(sp,ln);
  const go=el("button","btn primary","Lancer le défi"); go.type="submit";
  const act=el("div","actions"); act.append(go);
  f.append(t,row,act);
  f.addEventListener("submit",async e=>{
    e.preventDefault(); go.disabled=true;
    const {error}=await A.sb.from("challenges").insert({group_id:gid,user_id:A.me.id,title:ti.value.trim(),species:ss.value||null,min_length:li.value?Number(li.value):null});
    go.disabled=false;
    if(error) return toast(frError(error));
    toast("Défi lancé, le groupe est prévenu"); A.hooks.groupe?.();
  });
  return f;
}
function renderRanking(posts,sess,catches){
  const s=section("Classement du mois",el("span","note",monthName(new Date())));
  if(!posts.length&&!sess.length){ s.append(el("p","empty small","Rien ce mois-ci pour l'instant. Première prise = première place !")); return s; }
  // Plus grosses prises par espèce
  const best=new Map();
  catches.filter(x=>x.species&&x.length_cm).forEach(x=>{ const k=x.species, b=best.get(k); if(!b||Number(x.length_cm)>Number(b.length_cm)) best.set(k,x); });
  if(best.size){
    s.append(el("h4","g-sub","Plus grosses prises"));
    const list=el("div","list tight rk-list");
    [...best.values()].sort((a,b)=>b.length_cm-a.length_cm).forEach(x=>{
      const r=el("div","mrow");
      const l=el("div","rk-l"); l.append(el("span","tag",x.species)); l.append(userLabel(x.profiles?.username,x.profiles?.is_admin));
      r.append(l, el("span","rk-v",fmt(x.length_cm)+" cm"+(x.weight_kg?" · "+fmt(x.weight_kg)+" kg":"")));
      list.append(r);
    });
    s.append(list);
  }
  // Les plus actifs : prises publiées + bilans
  const act=new Map();
  [...posts,...sess].forEach(x=>{ const a=act.get(x.user_id)||{p:x.profiles,n:0,c:0}; a.n++; if(x.caught!==false&&(x.species||x.length_cm)) a.c++; act.set(x.user_id,a); });
  const top=[...act.values()].sort((a,b)=>b.n-a.n||b.c-a.c).slice(0,5);
  if(top.length){
    s.append(el("h4","g-sub","Les plus actifs"));
    const list=el("div","list tight rk-list");
    const medal=["🥇","🥈","🥉"];
    top.forEach((a,i)=>{
      const r=el("div","mrow");
      const l=el("div","rk-l"); l.append(el("span","rk-pos",medal[i]||String(i+1))); l.append(userLabel(a.p?.username,a.p?.is_admin));
      r.append(l, el("span","rk-v",pl(a.n,"sortie")+" · "+pl(a.c,"prise")));
      list.append(r);
    });
    s.append(list);
  }
  // Combo du mois
  const combos=new Map();
  sess.filter(x=>x.caught!==false&&(x.lure||x.color)).forEach(x=>{ const k=[x.lure,x.color].filter(Boolean).join(" · "); combos.set(k,(combos.get(k)||0)+1); });
  const bc=[...combos.entries()].sort((a,b)=>b[1]-a[1])[0];
  if(bc){ const c=el("div","combo"); c.append(el("span","label","Combo du mois"),el("span",null,bc[0]+" · "+pl(bc[1],"prise"))); s.append(c); }
  return s;
}

/* ---------- Carnet perso (onglet Profil) ---------- */
let year=new Date().getFullYear(), cSeq=0, cache=null;
async function carnet(force){
  const box=$("#carnet");
  if(!A.me){ box.hidden=true; return; }
  box.hidden=false;
  const seq=++cSeq;
  if(!cache||force){
    const [{data:posts},{data:sess},{data:chal}]=await Promise.all([
      A.sb.from("posts").select("id,group_id,species,length_cm,weight_kg,bait,created_at,status,photo_path,photo_paths").eq("user_id",A.me.id).order("created_at",{ascending:false}).limit(1000),
      A.sb.from("sessions").select("id,group_id,species,caught,length_cm,lure,color,rating,created_at").eq("user_id",A.me.id).order("created_at",{ascending:false}).limit(1000),
      A.sb.from("challenges").select("id,group_id,title,species,min_length,month").limit(500),
    ]);
    if(seq!==cSeq) return;
    cache={posts:(posts||[]).filter(p=>p.status!=="pending"),sess:sess||[],chal:chal||[]};
  }
  drawCarnet(box,cache);
}
function drawCarnet(box,{posts,sess,chal}){
  box.innerHTML="";
  const h=el("div","g-sec-head"); h.append(el("h2",null,"Mon carnet"));
  const pdf=el("button","btn small","📄 Exporter en PDF"); pdf.type="button"; pdf.addEventListener("click",()=>exportPdf(cache)); h.append(pdf);
  box.append(h);
  const catches=[...posts.filter(p=>p.species||p.length_cm).map(p=>({...p,kind:"post"})),...sess.filter(s=>s.caught!==false&&(s.species||s.length_cm)).map(s=>({...s,kind:"sess"}))];
  if(!posts.length&&!sess.length){ box.append(el("p","empty small","Ton carnet se remplit tout seul avec tes prises et tes bilans de session.")); return; }

  // Records par espèce
  const rec=new Map();
  catches.filter(x=>x.species&&x.length_cm).forEach(x=>{ const r=rec.get(x.species); if(!r||Number(x.length_cm)>Number(r.length_cm)) rec.set(x.species,x); });
  if(rec.size){
    box.append(el("h4","g-sub","Mes records"));
    const g=el("div","records");
    [...rec.values()].sort((a,b)=>SPECIES.indexOf(a.species)-SPECIES.indexOf(b.species)).forEach(x=>{
      const c=el("div","record");
      c.append(el("span","record-sp",x.species), el("span","record-v",fmt(x.length_cm)), el("span","record-u","cm"+(x.weight_kg?" · "+fmt(x.weight_kg)+" kg":"")));
      c.append(el("span","record-d",new Date(x.created_at).toLocaleDateString("fr-FR",{day:"numeric",month:"short",year:"numeric"})));
      g.append(c);
    });
    box.append(g);
  }

  // Bilan de l'année
  const years=[...new Set([...posts,...sess].map(x=>new Date(x.created_at).getFullYear()))].sort();
  if(!years.includes(year)) year=years[years.length-1];
  const yh=el("div","year-nav");
  const prev=btn("‹","btn small",()=>{ year--; drawCarnet(box,cache); }); prev.setAttribute("aria-label","Année précédente"); prev.disabled=year<=years[0];
  const next=btn("›","btn small",()=>{ year++; drawCarnet(box,cache); }); next.setAttribute("aria-label","Année suivante"); next.disabled=year>=years[years.length-1];
  yh.append(el("h4","g-sub","Saison "+year), el("span",null), prev, next);
  box.append(yh);
  const inY=x=>new Date(x.created_at).getFullYear()===year;
  const ys=sess.filter(inY), yc=catches.filter(inY);
  const caps=ys.filter(s=>s.caught===false).length;
  const kpis=el("div","kpis");
  const kpi=(v,l)=>{ const d=el("div","kpi"); d.append(el("div","kpi-v",v),el("div","kpi-l",l)); kpis.append(d); };
  kpi(String(yc.length),"prise"+(yc.length>1?"s":""));
  kpi(String(ys.length),"bilan"+(ys.length>1?"s":"")+" de session");
  kpi(ys.length?Math.round((ys.length-caps)/ys.length*100)+" %":"–","sessions avec prise");
  box.append(kpis);
  const spc=new Map(); yc.filter(x=>x.species).forEach(x=>spc.set(x.species,(spc.get(x.species)||0)+1));
  if(spc.size){
    const chips=el("div","chips");
    [...spc.entries()].sort((a,b)=>b[1]-a[1]).forEach(([k,n])=>chips.append(el("span","chip plus",k+" × "+n)));
    box.append(chips);
  }
  const combos=new Map(); ys.filter(x=>x.caught!==false&&(x.lure||x.color)).forEach(x=>{ const k=[x.lure,x.color].filter(Boolean).join(" · "); combos.set(k,(combos.get(k)||0)+1); });
  const bc=[...combos.entries()].sort((a,b)=>b[1]-a[1])[0];
  if(bc){ const c=el("div","combo"); c.append(el("span","label","Mon combo fétiche"),el("span",null,bc[0]+" · "+pl(bc[1],"prise"))); box.append(c); }

  // Badges des défis
  const mine=catches.map(x=>({...x,user_id:A.me.id,profiles:{username:A.me.username}}));
  const won=chal.filter(c=>wins(c,mine.filter(x=>x.group_id===c.group_id)).length);
  box.append(el("h4","g-sub","Mes badges"));
  if(won.length){
    const chips=el("div","chips");
    won.forEach(c=>chips.append(el("span","chip badge-medal","🏅 "+c.title+" · "+new Date(c.month).toLocaleDateString("fr-FR",{month:"short",year:"2-digit"}))));
    box.append(chips);
  }else box.append(el("p","note","Réussis un défi du mois de ton groupe pour gagner ton premier badge 🏅"));

  // Historique
  const all=[...posts.filter(inY).map(p=>({...p,kind:"post"})),...ys.map(s=>({...s,kind:"sess"}))].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
  const hist=showAll?all:all.slice(0,12);
  if(hist.length){
    box.append(el("h4","g-sub","Mes sorties "+year+" ("+all.length+")"));
    const list=el("div","list tight rk-list");
    hist.forEach(x=>{
      const r=el("div","mrow");
      const what=x.kind==="sess"&&x.caught===false?(x.species?x.species+" ciblé · capot":"Capot")
        :[x.species||"Prise",x.length_cm?fmt(x.length_cm)+" cm":null,x.weight_kg?fmt(x.weight_kg)+" kg":null].filter(Boolean).join(" · ");
      const l=el("div"); l.append(el("div",null,what), el("div","post-date",(x.kind==="sess"?"Bilan":"Prise publiée")+" · "+A.groupName(x.group_id)));
      const rt=el("div","carnet-act"); rt.append(el("span","post-date",new Date(x.created_at).toLocaleDateString("fr-FR",{day:"numeric",month:"short"})));
      rt.append(confirmBtn("🗑","Supprimer ?",async()=>{
        if(x.kind==="post"){
          const ph=(x.photo_paths&&x.photo_paths.length)?x.photo_paths:(x.photo_path?[x.photo_path]:[]);
          const {error}=await A.sb.from("posts").delete().eq("id",x.id); if(error) return toast(frError(error));
          if(ph.length) await A.sb.storage.from("photos").remove(ph);
          cache.posts=cache.posts.filter(p=>p.id!==x.id);
        }else{
          const {error}=await A.sb.from("sessions").delete().eq("id",x.id); if(error) return toast(frError(error));
          cache.sess=cache.sess.filter(p=>p.id!==x.id);
        }
        toast(x.kind==="post"?"Prise supprimée":"Bilan supprimé"); drawCarnet(box,cache); A.loadFeed();
      },"linkbtn danger small"));
      r.append(l, rt);
      list.append(r);
    });
    box.append(list);
    if(all.length>12){ const more=el("div","actions"); more.append(btn(showAll?"Voir moins":"Voir les "+all.length+" sorties","linkbtn",()=>{ showAll=!showAll; drawCarnet(box,cache); })); box.append(more); }
  }
}
let showAll=false;
// export : page imprimable, le téléphone propose « Enregistrer en PDF »
function exportPdf(data){
  if(!data) return;
  const esc=t=>String(t??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  const rows=[...data.posts.map(p=>({...p,kind:"Prise"})),...data.sess.map(s=>({...s,kind:s.caught===false?"Capot":"Bilan"}))].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
  const rec=new Map(); rows.filter(r=>r.species&&r.length_cm&&r.kind!=="Capot").forEach(r=>{ const b=rec.get(r.species); if(!b||Number(r.length_cm)>Number(b.length_cm)) rec.set(r.species,r); });
  const d=x=>new Date(x).toLocaleDateString("fr-FR",{day:"2-digit",month:"2-digit",year:"numeric"});
  const html='<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Carnet de pêche · @'+esc(A.me.username)+'</title><style>'+
    'body{font-family:system-ui,sans-serif;color:#13221d;margin:24px}h1{margin:0 0 4px;font-size:22px}p{margin:0 0 16px;color:#5b6c65}'+
    'h2{font-size:15px;text-transform:uppercase;letter-spacing:.06em;border-bottom:2px solid #1f6f5c;padding-bottom:4px;margin:22px 0 8px}'+
    'table{border-collapse:collapse;width:100%;font-size:12px}th,td{border-bottom:1px solid #d3ddd8;padding:5px 6px;text-align:left}th{background:#e9efeb}'+
    '.rec{display:flex;flex-wrap:wrap;gap:8px}.rec div{border:1px solid #d3ddd8;border-radius:8px;padding:6px 10px}.rec b{display:block;font-size:18px;color:#c27a22}'+
    '@media print{body{margin:10mm}button{display:none}}</style></head><body>'+
    '<button onclick="print()" style="float:right;padding:8px 14px">Imprimer / PDF</button>'+
    '<h1>🎣 Carnet de pêche de @'+esc(A.me.username)+'</h1><p>Coup du Jour · exporté le '+d(Date.now())+' · '+rows.length+' entrées</p>'+
    '<h2>Records</h2><div class="rec">'+([...rec.values()].map(r=>'<div>'+esc(r.species)+'<b>'+esc(String(r.length_cm).replace(".",","))+' cm</b>'+(r.weight_kg?esc(String(r.weight_kg).replace(".",","))+' kg · ':'')+d(r.created_at)+'</div>').join("")||'<span>Aucun record mesuré</span>')+'</div>'+
    '<h2>Historique</h2><table><thead><tr><th>Date</th><th>Type</th><th>Espèce</th><th>Taille</th><th>Poids</th><th>Appât / combo</th><th>Groupe</th></tr></thead><tbody>'+
    rows.map(r=>'<tr><td>'+d(r.created_at)+'</td><td>'+r.kind+'</td><td>'+esc(r.species||"")+'</td><td>'+(r.length_cm?esc(String(r.length_cm).replace(".",","))+' cm':'')+'</td><td>'+(r.weight_kg?esc(String(r.weight_kg).replace(".",","))+' kg':'')+'</td><td>'+esc(r.bait||[r.lure,r.color].filter(Boolean).join(" · "))+'</td><td>'+esc(A.groupName(r.group_id))+'</td></tr>').join("")+
    '</tbody></table></body></html>';
  const w=window.open("","_blank");
  if(!w){ const a=document.createElement("a"); a.href=URL.createObjectURL(new Blob([html],{type:"text/html"})); a.download="carnet-peche-"+A.me.username+".html"; a.click(); return toast("Carnet téléchargé : ouvre-le puis Imprimer → PDF"); }
  w.document.write(html); w.document.close(); setTimeout(()=>{ try{ w.print(); }catch(e){} },400);
}

A.hooks.feedExtras=feedExtras;
A.hooks.groupeExtras=groupeExtras;
A.hooks.profil=()=>carnet(true);
const prevChange=A.hooks.change;
A.hooks.change=()=>{ prevChange?.(); if(!A.me){ cache=null; $("#carnet").hidden=true; } else if(!$("#v-profil").hidden) carnet(); };
// si les données sont arrivées avant le chargement de ce fichier
if(A.me&&!$("#v-profil").hidden) carnet(true);
if(A.me&&!$("#v-fil").hidden&&document.querySelector("#feed article.post")&&!document.querySelector("#feed .social")) A.loadFeed();
if(A.me&&!$("#v-groupe").hidden) A.hooks.groupe?.();
})();
