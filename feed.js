// Coup du Jour : « Stories » des prises du jour, double-tap pour réagir 🔥.
(function(){
"use strict";
const A=window.CDJ; if(!A) return;
const {el}=A;
const $=s=>document.querySelector(s);
const get=(k,d)=>{ try{ return localStorage.getItem(k)??d; }catch(e){ return d; } };
const set=(k,v)=>{ try{ localStorage.setItem(k,v); }catch(e){} };

/* ---------- Double-tap sur une photo : 🔥 ---------- */
function burst(host){
  const f=el("div","dt-burst","🔥"); host.append(f); setTimeout(()=>f.remove(),900);
}
function fire(article){
  const b=article.querySelector(".react-bar .react-btn");   // la première réaction est 🔥
  burst(article.querySelector(".gallery")||article);
  try{ navigator.vibrate?.(25); }catch(e){}
  if(b&&b.getAttribute("aria-pressed")!=="true") b.click();
}
let lastTap=0, lastEl=null;
document.addEventListener("click",e=>{
  const g=e.target.closest?.("#feed .gallery"); if(!g) return;
  const now=Date.now();
  if(lastEl===g&&now-lastTap<320){ fire(g.closest("article")); lastTap=0; lastEl=null; return; }
  lastTap=now; lastEl=g;
});
document.addEventListener("dblclick",e=>{ const g=e.target.closest?.("#feed .gallery"); if(g){ e.preventDefault(); } });

/* ---------- Stories : les potes qui ont publié dans les dernières 24 h ---------- */
const host=el("div","stories"); host.id="stories"; host.hidden=true;
const fil=$("#v-fil"); const anchor=$("#gofish-fil")||$("#composer-all");
if(fil&&anchor) anchor.before(host); else fil?.prepend(host);
let stories=[];
const seen=()=>{ try{ return new Set(JSON.parse(get("cdj-seen-stories","[]"))); }catch(e){ return new Set(); } };
let lt=null;
function load(){ clearTimeout(lt); lt=setTimeout(doLoad,250); }
async function doLoad(){
  if(!A.me||!A.groups.length||A.cur==null) return;
  let q=A.sb.from("posts").select("id,group_id,user_id,species,length_cm,weight_kg,caption,photo_path,photo_paths,created_at,profiles(username)").eq("status","published").gte("created_at",new Date(Date.now()-24*36e5).toISOString()).order("created_at").limit(60);
  if(typeof A.cur==="number") q=q.eq("group_id",A.cur);
  const {data}=await q; const rows=(data||[]).filter(p=>(p.photo_paths&&p.photo_paths.length)||p.photo_path);
  const by=new Map();
  rows.forEach(p=>{ if(!by.has(p.user_id)) by.set(p.user_id,{user:p.profiles?.username||"?",uid:p.user_id,posts:[]}); by.get(p.user_id).posts.push(p); });
  stories=[...by.values()];
  draw();
}
function draw(){
  host.innerHTML="";
  if(!stories.length){ host.hidden=true; return; }
  host.hidden=false;
  const s=seen();
  stories.forEach((st,i)=>{
    const unseen=st.posts.some(p=>!s.has(p.id));
    const b=el("button","story"+(unseen?" new":"")); b.type="button";
    const ring=el("span","story-ring"); const av=A.avatar(st.user); av.classList.add("story-av"); ring.append(av);
    b.append(ring, el("span","story-n",st.uid===A.me?.id?"Toi":st.user));
    b.setAttribute("aria-label","Prises du jour de "+st.user);
    b.addEventListener("click",()=>open(i));
    host.append(b);
  });
}
async function open(si){
  let ui=si, pi=0, timer=null, urls={};
  const paths=stories.flatMap(st=>st.posts.map(p=>(p.photo_paths&&p.photo_paths[0])||p.photo_path));
  const {data:sig}=await A.sb.storage.from("photos").createSignedUrls(paths,3600);
  (sig||[]).forEach(x=>urls[x.path]=x.signedUrl);
  const ov=el("div","story-view"); ov.setAttribute("role","dialog"); ov.setAttribute("aria-label","Prises du jour");
  const bars=el("div","sv-bars"), head=el("div","sv-head"), img=el("div","sv-img"), info=el("div","sv-info");
  const close=el("button","sv-close","✕"); close.type="button"; close.setAttribute("aria-label","Fermer");
  ov.append(img,bars,head,info,close);
  document.body.append(ov);
  const done=()=>{ clearTimeout(timer); ov.remove(); draw(); document.removeEventListener("keydown",key); };
  function show(){
    clearTimeout(timer);
    const st=stories[ui]; if(!st) return done();
    const p=st.posts[pi]; if(!p){ ui++; pi=0; return show(); }
    const s=seen(); s.add(p.id); set("cdj-seen-stories",JSON.stringify([...s].slice(-300)));
    bars.innerHTML=""; st.posts.forEach((_,k)=>{ const b=el("i",k<pi?"done":k===pi?"run":null); bars.append(b); });
    head.innerHTML=""; const av=A.avatar(st.user); head.append(av,el("b",null,"@"+st.user),el("span",null,A.ago(p.created_at)));
    const path=(p.photo_paths&&p.photo_paths[0])||p.photo_path; img.style.backgroundImage=urls[path]?"url('"+urls[path]+"')":"none";
    info.innerHTML="";
    const t=el("div","sv-t"); t.append(el("b",null,p.species||"Belle prise")); const sz=[p.length_cm?String(p.length_cm).replace(".",",")+" cm":"",p.weight_kg?String(p.weight_kg).replace(".",",")+" kg":""].filter(Boolean).join(" · "); if(sz) t.append(el("span",null,sz));
    info.append(t); if(p.caption) info.append(el("p",null,p.caption));
    const go=el("button","btn small","🔥 Réagir dans le fil"); go.type="button"; go.addEventListener("click",e=>{ e.stopPropagation(); done(); location.hash="#fil"; }); info.append(go);
    timer=setTimeout(next,5000);
  }
  function next(){ const st=stories[ui]; if(pi<st.posts.length-1) pi++; else { ui++; pi=0; } show(); }
  function prev(){ if(pi>0) pi--; else if(ui>0){ ui--; pi=stories[ui].posts.length-1; } show(); }
  const key=e=>{ if(e.key==="Escape") done(); else if(e.key==="ArrowRight") next(); else if(e.key==="ArrowLeft") prev(); };
  document.addEventListener("keydown",key);
  close.addEventListener("click",e=>{ e.stopPropagation(); done(); });
  ov.addEventListener("click",e=>{ if(e.target.closest(".sv-info .btn")) return; (e.clientX<window.innerWidth*0.33?prev:next)(); });
  // glisser vers le bas pour fermer
  let y0=null; ov.addEventListener("touchstart",e=>{ y0=e.touches[0].clientY; },{passive:true});
  ov.addEventListener("touchend",e=>{ if(y0!=null&&e.changedTouches[0].clientY-y0>90) done(); y0=null; });
  show();
}
const prevChange=A.hooks.change; A.hooks.change=()=>{ prevChange?.(); load(); };
const prevFX=A.hooks.feedExtras; A.hooks.feedExtras=list=>{ prevFX?.(list); load(); };
load();
})();
