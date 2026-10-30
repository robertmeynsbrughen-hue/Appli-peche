// Rivio : récap de sortie en image (durée, touches, prises avec photos, météo), tracé GPS affiché seulement si on le choisit.
(function(){
"use strict";
const A=window.CDJ; if(!A) return;
const {el,toast}=A;
function btn(label,cls,fn){ const b=el("button",cls||"btn",label); b.type="button"; if(fn) b.addEventListener("click",fn); return b; }
function sheet(title,cls){
  const back=el("div","sheet-back"), sh=el("div","sheet "+(cls||"")); sh.setAttribute("role","dialog"); sh.setAttribute("aria-modal","true"); sh.setAttribute("aria-label",title);
  const head=el("div","sheet-head"); head.append(el("h2",null,title)); const x=btn("✕","icon-btn"); x.setAttribute("aria-label","Fermer"); head.append(x); sh.append(head);
  const close=()=>back.remove(); x.addEventListener("click",close); back.addEventListener("click",e=>{ if(e.target===back) close(); });
  back.append(sh); document.body.append(back); return {sh,close};
}
const FD="'Barlow Condensed', 'Arial Narrow', sans-serif", FB="'Source Sans 3', system-ui, sans-serif", FM="'JetBrains Mono', ui-monospace, monospace";
const C={bg:"#060c12",bg2:"#0d1a26",fg:"#eaf4f6",muted:"#8fa6b2",accent:"#2fd3c4",amber:"#ffb547",best:"#4aa8ff",line:"rgba(47,211,196,.10)"};
function rrect(x,X,Y,w,h,r){ x.beginPath(); x.moveTo(X+r,Y); x.arcTo(X+w,Y,X+w,Y+h,r); x.arcTo(X+w,Y+h,X,Y+h,r); x.arcTo(X,Y+h,X,Y,r); x.arcTo(X,Y,X+w,Y,r); x.closePath(); }
function fit(x,t,font,size,maxW){ let s=size; x.font=font.replace("{s}",s); while(s>18&&x.measureText(t).width>maxW){ s-=2; x.font=font.replace("{s}",s); } }
function loadImg(src){ return new Promise(res=>{ if(!src) return res(null); const i=new Image(); i.crossOrigin="anonymous"; i.onload=()=>res(i); i.onerror=()=>res(null); i.src=src; }); }
async function fonts(){ try{ await Promise.all([document.fonts.load("700 80px 'Barlow Condensed'"),document.fonts.load("400 32px 'Source Sans 3'"),document.fonts.load("600 32px 'Source Sans 3'"),document.fonts.load("500 24px 'JetBrains Mono'")]); }catch(_){} }
const fmtDur=min=>{ const h=Math.floor(min/60), m=min%60; return h?h+" h "+String(m).padStart(2,"0"):m+" min"; };
const fmtDist=m=>m>=1000?(m/1000).toFixed(1).replace(".",",")+" km":Math.round(m)+" m";
const num=x=>String(x).replace(".",",");

async function gather(t){
  const t0=new Date(new Date(t.started_at).getTime()-30*6e4).toISOString(), t1=new Date(new Date(t.ended_at||Date.now()).getTime()+60*6e4).toISOString();
  const {data:posts}=await A.sb.from("posts").select("id,species,length_cm,weight_kg,released,photo_path,photo_paths,conditions,created_at").eq("user_id",A.me.id).gte("created_at",t0).lte("created_at",t1).order("length_cm",{ascending:false,nullsFirst:false}).limit(12);
  const P=posts||[];
  const paths=P.map(p=>(p.photo_paths&&p.photo_paths[0])||p.photo_path).filter(Boolean).slice(0,3);
  let urls={}; if(paths.length){ const {data:sig}=await A.sb.storage.from("photos").createSignedUrls(paths,600); (sig||[]).forEach(z=>{ if(z.signedUrl) urls[z.path]=z.signedUrl; }); }
  const imgs=await Promise.all(P.slice(0,3).map(p=>loadImg(urls[(p.photo_paths&&p.photo_paths[0])||p.photo_path])));
  // météo : conditions enregistrées avec une prise, sinon relevé Open-Meteo à mi-sortie
  let w=P.find(p=>p.conditions)?.conditions||null;
  const pt=t.points?.[0];
  if(!w&&pt){
    try{
      const mid=new Date((new Date(t.started_at).getTime()+new Date(t.ended_at||Date.now()).getTime())/2), day=mid.toISOString().slice(0,10);
      const r=await fetch("https://api.open-meteo.com/v1/forecast?latitude="+pt[0].toFixed(2)+"&longitude="+pt[1].toFixed(2)+"&hourly=temperature_2m,wind_speed_10m,cloud_cover,precipitation&start_date="+day+"&end_date="+day+"&timezone=UTC");
      if(r.ok){ const d=await r.json(), H=d.hourly, i=Math.min(23,mid.getUTCHours()); w={air:H.temperature_2m[i],wind:H.wind_speed_10m[i],cloud:H.cloud_cover[i],rain:H.precipitation[i]||0}; }
    }catch(_){}
  }
  // lieu : spot du groupe le plus proche du départ (moins de 1 km)
  let place=null;
  if(pt){ let bd=1e9; A.spots.forEach(s=>{ const d=Math.hypot((s.lon-pt[1])*111*Math.cos(pt[0]*Math.PI/180),(s.lat-pt[0])*111); if(d<bd){ bd=d; place=d<=1?s.name:null; } }); }
  return {posts:P,imgs,w,place};
}
async function draw(t,g,opt){
  await fonts();
  const W=1080,H=1920, c=document.createElement("canvas"); c.width=W; c.height=H; const x=c.getContext("2d");
  const gr=x.createLinearGradient(0,0,0,H); gr.addColorStop(0,C.bg2); gr.addColorStop(.5,C.bg); gr.addColorStop(1,"#03070b"); x.fillStyle=gr; x.fillRect(0,0,W,H);
  x.strokeStyle=C.line; x.lineWidth=1; for(let i=0;i<=W;i+=60){ x.beginPath(); x.moveTo(i,0); x.lineTo(i,H); x.stroke(); } for(let j=0;j<=H;j+=60){ x.beginPath(); x.moveTo(0,j); x.lineTo(W,j); x.stroke(); }
  const P=72;
  x.fillStyle=C.accent; rrect(x,P,P,64,64,16); x.fill();
  x.fillStyle="#06231f"; x.fill(new Path2D("M"+(P+10)+" "+(P+32)+"c8-12 20-16 30-12 4 1.6 7.2 4.8 9.2 8L"+(P+58)+" "+(P+20)+"v24l-8.8-8c-2 3.2-5.2 6.4-9.2 8-10 4-22 0-30-12z"));
  x.fillStyle=C.fg; x.font="700 48px "+FD; x.textBaseline="middle"; x.fillText("RIVIO",P+84,P+34);
  const d0=new Date(t.started_at); x.font="500 26px "+FM; x.fillStyle=C.muted; x.textAlign="right"; x.fillText(d0.toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long"}).toUpperCase(),W-P,P+34); x.textAlign="left"; x.textBaseline="alphabetic";
  x.fillStyle=C.accent; x.font="600 30px "+FB; x.fillText("RÉCAP DE SORTIE",P,250);
  const title=(t.title&&!/^\w+ \d+ \w+$/.test(t.title)?t.title:null)||(opt.place&&g.place?g.place:"Ma sortie pêche");
  fit(x,title,"700 {s}px "+FD,76,W-2*P); x.fillStyle=C.fg; x.fillText(title,P,330);
  if(opt.place&&g.place&&title!==g.place){ x.font="400 30px "+FB; x.fillStyle=C.muted; x.fillText("📍 "+g.place,P,378); }
  // tracé ou bandeau sondeur
  let y=420;
  const boxH=opt.trace&&t.points?.length>1?640:300;
  x.fillStyle="rgba(13,22,32,.92)"; rrect(x,P,y,W-2*P,boxH,28); x.fill(); x.strokeStyle="rgba(47,211,196,.3)"; x.lineWidth=2; x.stroke();
  if(opt.trace&&t.points?.length>1){
    const pts=t.points, la=pts.map(p=>p[0]), lo=pts.map(p=>p[1]);
    const kx=Math.cos(la[0]*Math.PI/180);
    const minX=Math.min(...lo)*kx, maxX=Math.max(...lo)*kx, minY=Math.min(...la), maxY=Math.max(...la);
    const bw=W-2*P-120, bh=boxH-120, sc=Math.min(bw/Math.max(maxX-minX,1e-6),bh/Math.max(maxY-minY,1e-6));
    const ox=P+60+(bw-(maxX-minX)*sc)/2, oy=y+60+(bh-(maxY-minY)*sc)/2;
    const pr=p=>[ox+(p[1]*kx-minX)*sc, oy+(maxY-p[0])*sc];
    x.save(); x.shadowColor=C.accent; x.shadowBlur=18; x.strokeStyle=C.accent; x.lineWidth=8; x.lineJoin="round"; x.lineCap="round";
    x.beginPath(); pts.forEach((p,i)=>{ const [X,Y]=pr(p); i?x.lineTo(X,Y):x.moveTo(X,Y); }); x.stroke(); x.restore();
    const dot=(p,col,r)=>{ const [X,Y]=pr(p); x.fillStyle=col; x.beginPath(); x.arc(X,Y,r,0,Math.PI*2); x.fill(); x.strokeStyle="#fff"; x.lineWidth=4; x.stroke(); };
    dot(pts[0],"#2fd37a",16); dot(pts[pts.length-1],"#ff6b6b",16);
    (t.bites||[]).forEach(b=>dot(b,C.amber,13));
    x.font="500 22px "+FM; x.fillStyle=C.muted; x.fillText("● départ   ● arrivée   ● touche",P+32,y+boxH-26);
  }else{
    // échogramme stylisé : pas de position
    x.save(); x.beginPath(); rrect(x,P,y,W-2*P,boxH,28); x.clip();
    for(let k=0;k<5;k++){ x.strokeStyle="rgba(47,211,196,"+(0.5-k*0.08)+")"; x.lineWidth=3; x.beginPath(); for(let X=P;X<=W-P;X+=12){ const Y=y+boxH*0.55+k*26+Math.sin(X/70+k)*18+Math.sin(X/23)*5; X===P?x.moveTo(X,Y):x.lineTo(X,Y); } x.stroke(); }
    const nB=Math.max(1,(t.bites||[]).length);
    for(let k=0;k<Math.min(8,nB+g.posts.length);k++){ const X=P+120+k*((W-2*P-240)/Math.max(1,Math.min(8,nB+g.posts.length)-1||1)), Y=y+boxH*0.3+(k%3)*30; x.fillStyle=k<g.posts.length?C.amber:"rgba(255,181,71,.55)"; x.beginPath(); x.ellipse(X,Y,22,9,0,0,Math.PI*2); x.fill(); }
    x.restore();
    x.font="500 22px "+FM; x.fillStyle=C.muted; x.fillText("TRACÉ MASQUÉ · LE COIN RESTE SECRET 🤫",P+32,y+boxH-26);
  }
  y+=boxH+36;
  // chiffres clés
  const mins=Math.max(1,Math.round((new Date(t.ended_at||Date.now())-new Date(t.started_at))/6e4));
  const stats=[["DURÉE",fmtDur(mins)],["TOUCHES",String((t.bites||[]).length)],["PRISES",String(g.posts.length)],opt.trace?["PARCOURU",fmtDist(t.distance_m||0)]:null].filter(Boolean);
  const sw=(W-2*P-(stats.length-1)*20)/stats.length;
  stats.forEach((s,i)=>{ const X=P+i*(sw+20); x.fillStyle="rgba(13,22,32,.92)"; rrect(x,X,y,sw,150,22); x.fill(); x.strokeStyle="rgba(47,211,196,.25)"; x.lineWidth=2; x.stroke();
    x.font="500 22px "+FM; x.fillStyle=C.muted; x.fillText(s[0],X+24,y+44); fit(x,s[1],"700 {s}px "+FD,64,sw-40); x.fillStyle=C.fg; x.fillText(s[1],X+24,y+118); });
  y+=190;
  // prises
  if(g.posts.length){
    x.font="600 28px "+FB; x.fillStyle=C.accent; x.fillText("🎣 PRISES DE LA SORTIE",P,y); y+=26;
    const n=Math.min(3,g.posts.length), cw=(W-2*P-(n-1)*20)/n, ch=n===1?420:340;
    g.posts.slice(0,n).forEach((p,i)=>{
      const X=P+i*(cw+20), im=g.imgs[i];
      x.save(); rrect(x,X,y,cw,ch,24); x.clip();
      if(im){ const r=Math.max(cw/im.width,ch/im.height), w2=im.width*r, h2=im.height*r; x.drawImage(im,X+(cw-w2)/2,y+(ch-h2)/2,w2,h2); }
      else{ x.fillStyle="#12324a"; x.fillRect(X,y,cw,ch); x.font="120px serif"; x.textAlign="center"; x.fillText("🐟",X+cw/2,y+ch/2+40); x.textAlign="left"; }
      const sg=x.createLinearGradient(0,y+ch*0.5,0,y+ch); sg.addColorStop(0,"rgba(0,0,0,0)"); sg.addColorStop(1,"rgba(0,0,0,.8)"); x.fillStyle=sg; x.fillRect(X,y,cw,ch);
      x.restore();
      fit(x,p.species||"Prise","700 {s}px "+FD,44,cw-36); x.fillStyle="#fff"; x.fillText(p.species||"Prise",X+20,y+ch-58);
      const sz=[p.length_cm?num(p.length_cm)+" cm":null,p.weight_kg?num(p.weight_kg)+" kg":null,p.released?"♻️":null].filter(Boolean).join(" · ");
      x.font="500 26px "+FM; x.fillText(sz,X+20,y+ch-22);
    });
    y+=ch+40;
    if(g.posts.length>3){ x.font="400 28px "+FB; x.fillStyle=C.muted; x.fillText("+ "+(g.posts.length-3)+" autre"+(g.posts.length>4?"s":""),P,y); y+=40; }
  }else{
    x.font="400 34px "+FB; x.fillStyle=C.muted; x.fillText((t.bites||[]).length?"Des touches, pas de prise cette fois : la prochaine sera la bonne !":"Pas de prise cette fois, mais une belle sortie.",P,y+10); y+=70;
  }
  // météo
  if(g.w){ const w=g.w; const sky=w.rain>=0.3?"pluie":w.cloud>=65?"couvert":w.cloud>=35?"voilé":"ensoleillé";
    const t2=[w.water!=null?"eau "+num(Number(w.water).toFixed(1))+" °C":null,w.air!=null?"air "+Math.round(w.air)+" °C":null,w.wind!=null?"vent "+Math.round(w.wind)+" km/h":null,sky].filter(Boolean).join(" · ");
    x.font="400 30px "+FB; x.fillStyle=C.fg; x.fillText("🌤️ "+t2,P,Math.min(y+10,H-200)); }
  x.fillStyle="rgba(47,211,196,.35)"; x.fillRect(P,H-150,W-2*P,2);
  x.font="600 30px "+FB; x.fillStyle=C.fg; x.fillText("Sortie enregistrée avec Rivio",P,H-92);
  x.font="400 24px "+FB; x.fillStyle=C.muted; x.fillText("L'appli de pêche entre potes",P,H-56);
  return await new Promise(r=>c.toBlob(b=>{ let url=null; try{ url=c.toDataURL("image/jpeg",.8); }catch(_){} r({blob:b,url}); },"image/jpeg",.92));
}
async function open(t){
  if(!A.me) return;
  const {sh}=sheet("📸 Récap de sortie","cond-sheet recap-sheet");
  const prev=el("div","cond-prev"); prev.append(el("p","note","Préparation…")); sh.append(prev);
  const opts=el("div","recap-opts");
  const mk=(label,on,hint)=>{ const l=el("label","check"); const c=el("input"); c.type="checkbox"; c.checked=on; l.append(c," "+label); if(hint) l.append(el("span","note"," "+hint)); opts.append(l); return c; };
  const ct=mk("Afficher mon tracé GPS",false,"(sinon personne ne peut retrouver ton coin)");
  const cp=mk("Afficher le nom du lieu",false);
  sh.append(opts);
  const act=el("div","actions"); sh.append(act);
  let g; try{ g=await gather(t); }catch(_){ g={posts:[],imgs:[],w:null,place:null}; }
  if(!t.points||t.points.length<2) ct.disabled=true;
  if(!g.place) cp.parentNode.hidden=true;
  let out=null, seq=0;
  const redraw=async()=>{
    const s=++seq; prev.innerHTML=""; prev.append(el("p","note","Préparation…"));
    let o; try{ o=await draw(t,g,{trace:ct.checked,place:cp.checked}); }catch(_){ o=null; }
    if(s!==seq) return; out=o; prev.innerHTML="";
    if(!o?.blob){ prev.append(el("p","err","Image impossible à créer sur cet appareil.")); return; }
    const img=el("img"); img.src=o.url||URL.createObjectURL(o.blob); img.alt="Aperçu du récap de sortie"; prev.append(img);
  };
  ct.addEventListener("change",redraw); cp.addEventListener("change",redraw);
  const name=()=>"rivio-sortie-"+String(t.started_at).slice(0,10)+".jpg";
  if(navigator.share) act.append(btn("📤 Partager","btn primary",()=>{ if(!out?.blob) return; const f=new File([out.blob],name(),{type:"image/jpeg"}); if(navigator.canShare?.({files:[f]})) navigator.share({files:[f],title:"Ma sortie · Rivio"}).catch(()=>{}); else toast("Partage d'image non disponible : enregistre-la"); }));
  act.append(btn("⬇️ Enregistrer","btn",()=>{ if(!out?.blob) return; const l=document.createElement("a"); l.href=URL.createObjectURL(out.blob); l.download=name(); document.body.append(l); l.click(); setTimeout(()=>{ URL.revokeObjectURL(l.href); l.remove(); },1000); }));
  await redraw();
}
// à la fin d'une trace, puis depuis la liste « Mes traces »
const prevTS=A.hooks.trackSaved; A.hooks.trackSaved=t=>{ prevTS?.(t);
  // petit bandeau discret : ne gêne pas le bilan qui s'ouvre peut-être en même temps
  document.querySelector(".recap-snack")?.remove();
  const sn=el("div","recap-snack"); sn.setAttribute("role","status");
  sn.append(el("span",null,"Sortie enregistrée"), btn("📸 Récap en image","btn small primary",()=>{ sn.remove(); open(t); }), btn("✕","icon-btn",()=>sn.remove()));
  document.body.append(sn); setTimeout(()=>sn.remove(),20000);
};
const prevTA=A.hooks.trackActions; A.hooks.trackActions=(t,act)=>{ prevTA?.(t,act); act.append(btn("📸 Récap","btn small",()=>open(t))); };
A.recap={open};
})();
