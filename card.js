/* Coup du Jour : carte d'identité de la prise (image à enregistrer ou partager) */
(function(){
const A=window.CDJ; if(!A) return;
const $=s=>document.querySelector(s);
const sheet=$("#card-sheet"), img=$("#card-img"), wait=$("#card-wait");
const LATIN={"Brochet":"Esox lucius","Sandre":"Sander lucioperca","Perche":"Perca fluviatilis","Black-bass":"Micropterus salmoides","Silure":"Silurus glanis","Carpe":"Cyprinus carpio","Chevesne":"Squalius cephalus","Aspe":"Leuciscus aspius","Truite fario":"Salmo trutta","Barbeau":"Barbus barbus","Tanche":"Tinca tinca","Brème":"Abramis brama","Gardon":"Rutilus rutilus","Rotengle":"Scardinius erythrophthalmus","Carassin":"Carassius carassius","Ablette":"Alburnus alburnus","Vandoise":"Leuciscus leuciscus","Amour blanc":"Ctenopharyngodon idella"};
const THEMES={
  nuit:{bg:"#0f1a17",fg:"#f1f5f2",muted:"#9fb3ab",accent:"#e7a650",chip:"rgba(15,26,23,0.62)",chipFg:"#f1f5f2",logo:"#2c8b73"},
  lac:{bg:"#123a31",fg:"#f1f5f2",muted:"#a9c7bc",accent:"#f0b562",chip:"rgba(18,58,49,0.66)",chipFg:"#f1f5f2",logo:"#2c8b73"},
  ivoire:{bg:"#f4efe3",fg:"#13221d",muted:"#6b6a5c",accent:"#a85f17",chip:"rgba(244,239,227,0.86)",chipFg:"#13221d",logo:"#1f6f5c"},
};
const SIZES={story:[1080,1920],carre:[1080,1080],portrait:[1080,1350]};
const FD="'Barlow Condensed', 'Arial Narrow', sans-serif", FB="'Source Sans 3', system-ui, sans-serif", FM="'JetBrains Mono', ui-monospace, monospace";
const store={ get(k,d){ try{ const v=localStorage.getItem(k); return v==null?d:v; }catch(e){ return d; } }, set(k,v){ try{ localStorage.setItem(k,v); }catch(e){} } };
let data=null, photo=null, blob=null, opts={format:store.get("cdj-card-format","story"),style:store.get("cdj-card-style","nuit")}, drawSeq=0;

const num=x=>Number(x).toLocaleString("fr-FR",{maximumFractionDigits:2});
function dateText(iso){
  const d=new Date(iso||Date.now());
  return d.toLocaleDateString("fr-FR",{day:"numeric",month:"short",year:"numeric"})+" · "+String(d.getHours()).padStart(2,"0")+" h "+String(d.getMinutes()).padStart(2,"0");
}
function loadImage(src){
  return new Promise((res,rej)=>{ const im=new Image(); im.crossOrigin="anonymous"; im.onload=()=>res(im); im.onerror=rej; im.src=src; });
}
async function fontsReady(){
  try{ await Promise.all([document.fonts.load("700 80px 'Barlow Condensed'"),document.fonts.load("600 40px 'Barlow Condensed'"),document.fonts.load("400 32px 'Source Sans 3'"),document.fonts.load("600 32px 'Source Sans 3'"),document.fonts.load("italic 400 32px 'Source Sans 3'"),document.fonts.load("500 24px 'JetBrains Mono'")]); }catch(e){}
}
function cover(ctx,im,x,y,w,h,fy){
  const r=Math.max(w/im.width,h/im.height), sw=w/r, sh=h/r;
  const sx=(im.width-sw)/2, sy=Math.max(0,Math.min(im.height-sh,(im.height-sh)*(fy??0.5)));
  ctx.drawImage(im,sx,sy,sw,sh,x,y,w,h);
}
function rrect(ctx,x,y,w,h,r){ ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath(); }
function fitText(ctx,text,font,size,maxW,min){ let s=size; ctx.font=font.replace("{s}",s); while(s>min&&ctx.measureText(text).width>maxW){ s-=2; ctx.font=font.replace("{s}",s); } return s; }
function wrap(ctx,text,maxW,maxLines){
  const words=String(text).split(/\s+/), lines=[]; let line="";
  for(const w of words){ const t=line?line+" "+w:w; if(ctx.measureText(t).width>maxW&&line){ lines.push(line); line=w; } else line=t; }
  if(line) lines.push(line);
  if(lines.length>maxLines){ lines.length=maxLines; let l=lines[maxLines-1]; while(ctx.measureText(l+"…").width>maxW&&l.length) l=l.slice(0,-1); lines[maxLines-1]=l+"…"; }
  return lines;
}
function logo(ctx,x,y,s,T){
  ctx.save(); ctx.translate(x,y); ctx.scale(s/32,s/32);
  ctx.fillStyle="#ffffff"; ctx.fill(new Path2D("M5 16c4-6 10-8 15-6 2 .8 3.6 2.4 4.6 4L29 10v12l-4.4-4c-1 1.6-2.6 3.2-4.6 4-5 2-11 0-15-6z"));
  ctx.fillStyle=T.logo; ctx.beginPath(); ctx.arc(11,15,1.6,0,Math.PI*2); ctx.fill(); ctx.restore();
}
function topBar(ctx,W,T,k,group){
  // pastille logo + nom de l'appli
  ctx.font="700 "+(21*k)+"px "+FD; const label="COUP DU JOUR"; const lw=ctx.measureText(label).width;
  const x=28*k, y=28*k, h=48*k;
  ctx.fillStyle=T.chip; rrect(ctx,x,y,7*k+34*k+10*k+lw+14*k,h,14*k); ctx.fill();
  ctx.fillStyle=T.logo; rrect(ctx,x+7*k,y+7*k,34*k,34*k,10*k); ctx.fill();
  logo(ctx,x+12*k,y+12*k,24*k,T);
  ctx.fillStyle=T.chipFg; ctx.textBaseline="middle"; ctx.fillText(label,x+51*k,y+h/2+1*k);
  if(group){
    ctx.font="600 "+(17*k)+"px "+FD; const g=group.toUpperCase(); const gw=Math.min(ctx.measureText(g).width,W*0.42);
    const gx=W-28*k-gw-28*k;
    ctx.fillStyle=T.chip; rrect(ctx,gx,y+5*k,gw+28*k,38*k,19*k); ctx.fill();
    ctx.fillStyle=T.chipFg; ctx.save(); ctx.beginPath(); ctx.rect(gx+14*k,y,gw,h); ctx.clip(); ctx.fillText(g,gx+14*k,y+h/2+1*k); ctx.restore();
  }
  ctx.textBaseline="alphabetic";
}
function scrim(ctx,W,y0,y1,T){
  const g=ctx.createLinearGradient(0,y0,0,y1);
  g.addColorStop(0,T.bg+"00"); g.addColorStop(0.7,T.bg+"d9"); g.addColorStop(1,T.bg);
  ctx.fillStyle=g; ctx.fillRect(0,y0,W,y1-y0);
}
function ruler(ctx,x,y,w,h,len,T,k){
  const max=Math.max(100,Math.ceil(len*1.1/20)*20);
  ctx.fillStyle=T.accent; rrect(ctx,x,y,w,h,6*k); ctx.fill();
  ctx.save(); rrect(ctx,x,y,w,h,6*k); ctx.clip();
  ctx.fillStyle="rgba(15,26,23,0.18)"; ctx.fillRect(x,y,w*len/max,h);
  for(let c=0;c<=max;c++){
    const tx=x+w*c/max; const big=c%10===0, mid=c%5===0;
    ctx.fillStyle=big?"rgba(15,26,23,0.8)":"rgba(15,26,23,0.45)";
    ctx.fillRect(tx-(big?1.5:0.75)*k/2,y,(big?2:1)*k,big?h:(mid?h*0.5:h*0.32));
  }
  ctx.fillStyle="#0f1a17"; ctx.fillRect(x+w*len/max-1.5*k,y,3*k,h);
  ctx.restore();
  ctx.font="500 "+(11*k)+"px "+FM; ctx.fillStyle=T.muted; ctx.textBaseline="top";
  const step=max<=100?20:max<=200?40:50;
  for(let c=0;c<=max;c+=step){ ctx.textAlign=c===0?"left":c===max?"right":"center"; ctx.fillText(String(c),x+w*c/max,y+h+6*k); }
  ctx.textAlign="center"; ctx.fillStyle=T.accent; ctx.fillText("▲ "+num(len)+" cm",Math.min(x+w-50*k,Math.max(x+50*k,x+w*len/max)),y+h+22*k);
  ctx.textAlign="left"; ctx.textBaseline="alphabetic";
  return h+40*k;
}
function field(ctx,x,y,label,value,size,weight,w,T,k){
  ctx.font="500 "+(11*k)+"px "+FM; ctx.fillStyle=T.muted;
  ctx.fillText(label.toUpperCase().split("").join(String.fromCharCode(8202)),x,y+11*k);
  ctx.fillStyle=T.fg;
  const isBig=size>=26;
  const font=(isBig?weight+" {s}px "+FD:weight+" {s}px "+FB);
  fitText(ctx,value,font,size*k,w,Math.round(size*k*0.6));
  ctx.fillText(value,x,y+(11+6+size*0.9)*k);
  return (11+6+size*1.05)*k;
}

async function render(){
  const seq=++drawSeq; if(!data) return;
  const [W,H]=SIZES[opts.format]||SIZES.story, k=W/540, T=THEMES[opts.style]||THEMES.nuit;
  await fontsReady();
  const c=document.createElement("canvas"); c.width=W; c.height=H; const ctx=c.getContext("2d");
  ctx.fillStyle=T.bg; ctx.fillRect(0,0,W,H);
  const showW=$("#card-weight").checked&&data.weight, showSpot=$("#card-spot").checked&&data.spot;
  const species=(data.species||"Belle prise"), latin=LATIN[data.species]||"";
  if(opts.format==="carre"){
    if(photo) cover(ctx,photo,0,0,W,H,0.55);
    scrim(ctx,W,H-300*k,H,T);
    topBar(ctx,W,T,k,null);
    const pad=28*k; let y=H-40*k;
    // bloc taille à droite
    let rightW=0;
    if(data.length){
      ctx.textAlign="right"; ctx.fillStyle=T.accent;
      ctx.font="500 "+(13*k)+"px "+FM; const unit=("cm"+(showW?" · "+num(data.weight)+" kg":"")).toUpperCase();
      ctx.fillText(unit,W-pad,y); rightW=ctx.measureText(unit).width;
      ctx.font="700 "+(104*k)+"px "+FD; const n=num(data.length); ctx.fillText(n,W-pad,y-20*k); rightW=Math.max(rightW,ctx.measureText(n).width);
      ctx.textAlign="left";
    }
    const maxW=W-2*pad-rightW-24*k;
    ctx.font="400 "+(15*k)+"px "+FB; ctx.fillStyle=T.muted; ctx.fillText("@"+data.username+(showSpot?" · "+data.spot:""),pad,y);
    y-=30*k;
    if(data.bait){ ctx.font="600 "+(17*k)+"px "+FB; ctx.fillStyle=T.fg; const l=wrap(ctx,data.bait,maxW,1); ctx.fillText(l[0],pad,y); y-=26*k; }
    fitText(ctx,species.toUpperCase(),"700 {s}px "+FD,64*k,maxW,36*k); ctx.fillStyle=T.fg; ctx.fillText(species.toUpperCase(),pad,y); y-=parseInt(ctx.font)*0.92;
    ctx.font="500 "+(11*k)+"px "+FM; ctx.fillStyle=T.accent; ctx.fillText(((data.group?data.group+" · ":"")+dateText(data.date).split(" · ")[0]).toUpperCase(),pad,y);
  }else{
    const portrait=opts.format==="portrait";
    const photoH=portrait?H*0.5:600*k;
    if(photo) cover(ctx,photo,0,0,W,photoH,0.5);
    scrim(ctx,W,photoH-220*k,photoH+20*k,T);
    topBar(ctx,W,T,k,data.group);
    const pad=32*k, w=W-2*pad; let y=photoH-(portrait?40:70)*k;
    ctx.font="500 "+(12*k)+"px "+FM; ctx.fillStyle=T.accent; ctx.fillText("CARTE D'IDENTITÉ DE LA PRISE",pad,y); y+=8*k;
    const sp=species.toUpperCase();
    const spSize=fitText(ctx,sp,"700 {s}px "+FD,(portrait?76:92)*k,w*0.98,44*k);
    ctx.fillStyle=T.fg; ctx.fillText(sp,pad,y+spSize*0.86); y+=spSize*0.95;
    if(latin){ ctx.font="italic 400 "+(16*k)+"px "+FB; ctx.fillStyle=T.muted; ctx.fillText(latin,pad,y+16*k); y+=26*k; }
    y+=(portrait?12:18)*k;
    if(data.length){ y+=ruler(ctx,pad,y,w,(portrait?30:40)*k,Number(data.length),T,k)+(portrait?4:10)*k; }
    const colW=(w-20*k)/2, rowGap=(portrait?10:14)*k;
    const cells=[];
    if(data.length) cells.push(["Taille",num(data.length)+" cm",34,700]);
    if(showW) cells.push(["Poids",num(data.weight)+" kg",34,700]);
    cells.push(["Date",dateText(data.date),18,600]);
    cells.push(["Pêcheur","@"+data.username,18,600]);
    if(showSpot) cells.push(["Spot",data.spot,18,600]);
    if(data.bait){
      ctx.font="500 "+(11*k)+"px "+FM; ctx.fillStyle=T.muted; ctx.fillText("APPÂT / LEURRE",pad,y+11*k);
      ctx.font="600 "+(24*k)+"px "+FD; ctx.fillStyle=T.fg;
      const lines=wrap(ctx,data.bait,w,portrait?1:2); lines.forEach((l,i)=>ctx.fillText(l,pad,y+(11+6+22+i*26)*k));
      y+=(11+6+lines.length*26+6)*k+rowGap;
    }
    for(let i=0;i<cells.length;i+=2){
      const a=cells[i], b=cells[i+1];
      const h1=field(ctx,pad,y,a[0],a[1],a[2],a[3],colW,T,k);
      const h2=b?field(ctx,pad+colW+20*k,y,b[0],b[1],b[2],b[3],colW,T,k):0;
      y+=Math.max(h1,h2)+rowGap;
      if(y>H-40*k) break;
    }
  }
  if(seq!==drawSeq) return;
  blob=await new Promise(r=>c.toBlob(r,"image/jpeg",0.92));
  if(seq!==drawSeq) return;
  if(img.src.startsWith("blob:")) URL.revokeObjectURL(img.src);
  img.src=URL.createObjectURL(blob); img.hidden=false; wait.hidden=true;
}

function fileName(){ return "coup-du-jour-"+(data.species||"prise").toLowerCase().replace(/[^a-z0-9]+/g,"-")+"-"+(data.length?data.length+"cm-":"")+opts.format+".jpg"; }
async function save(){
  if(!blob) return;
  const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=fileName();
  document.body.append(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(a.href),4000);
  A.toast("Carte enregistrée dans tes téléchargements");
}
async function share(){
  if(!blob) return;
  const file=new File([blob],fileName(),{type:"image/jpeg"});
  if(navigator.canShare&&navigator.canShare({files:[file]})){
    try{ await navigator.share({files:[file],title:"Ma prise · Coup du Jour",text:(data.species||"Belle prise")+(data.length?" de "+num(data.length)+" cm":"")+" 🎣"}); }
    catch(e){ if(e.name!=="AbortError") A.toast("Partage impossible, enregistre plutôt la carte"); }
  }else{ A.toast("Partage direct indisponible ici : la carte est enregistrée, partage-la depuis ta galerie"); save(); }
}

function sync(){
  document.querySelectorAll("#card-format button").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.v===opts.format)));
  document.querySelectorAll("#card-style button").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.v===opts.style)));
}
document.querySelectorAll("#card-format button").forEach(b=>b.addEventListener("click",()=>{ opts.format=b.dataset.v; store.set("cdj-card-format",opts.format); sync(); render(); }));
document.querySelectorAll("#card-style button").forEach(b=>b.addEventListener("click",()=>{ opts.style=b.dataset.v; store.set("cdj-card-style",opts.style); sync(); render(); }));
$("#card-weight").addEventListener("change",render);
$("#card-spot").addEventListener("change",render);
$("#card-save").addEventListener("click",save);
$("#card-share").addEventListener("click",share);
sheet.addEventListener("click",e=>{ if(e.target===sheet||e.target.closest("[data-close]")) close(); });
function close(){ sheet.hidden=true; document.body.classList.remove("chat-open"); }

// d = { species, length, weight, bait, date, username, group, spot, photoUrl }
A.openCard=async function(d){
  data=d; blob=null; photo=null; sync();
  $("#card-spot").checked=false; $("#card-spot").disabled=!d.spot; $("#card-weight").checked=true; $("#card-weight").disabled=!d.weight;
  img.hidden=true; wait.hidden=false; wait.textContent="Préparation de la carte…";
  sheet.hidden=false; document.body.classList.add("chat-open");
  if(d.photoUrl){ try{ photo=await loadImage(d.photoUrl); }catch(e){ photo=null; wait.textContent="Photo indisponible : la carte sera créée sans photo."; } }
  render();
};
})();
