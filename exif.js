// Rivio : prise pré-remplie à partir de la photo (date, heure et position lues
// dans les informations EXIF du fichier, avant que l'appli ne compresse la photo).
(function(){
"use strict";
const A=window.CDJ; if(!A) return;
const $=s=>document.querySelector(s);

// Lecture minimale de l'EXIF d'un JPEG : date de prise de vue et coordonnées GPS
function parseExif(buf){
  const v=new DataView(buf);
  if(v.byteLength<4||v.getUint16(0)!==0xFFD8) return null;
  let off=2;
  while(off+4<v.byteLength){
    const marker=v.getUint16(off), size=v.getUint16(off+2);
    if(marker===0xFFE1&&v.getUint32(off+4)===0x45786966) return readTiff(v,off+10);
    if((marker&0xFF00)!==0xFF00||size<2) break;
    off+=2+size;
  }
  return null;
}
function readTiff(v,t){
  const le=v.getUint16(t)===0x4949;
  const u16=o=>v.getUint16(o,le), u32=o=>v.getUint32(o,le);
  if(u16(t+2)!==42) return null;
  const ifd=(start)=>{
    const out={}; if(start+2>v.byteLength) return out;
    const n=u16(start);
    for(let i=0;i<n;i++){
      const e=start+2+i*12; if(e+12>v.byteLength) break;
      const tag=u16(e), type=u16(e+2), count=u32(e+4), valOff=e+8;
      const size={1:1,2:1,3:2,4:4,5:8,7:1,9:4,10:8}[type]||1;
      const at=size*count>4?t+u32(valOff):valOff;
      if(at+size*count>v.byteLength) continue;
      if(type===2){ let s=""; for(let k=0;k<count-1;k++) s+=String.fromCharCode(v.getUint8(at+k)); out[tag]=s; }
      else if(type===3) out[tag]=u16(at);
      else if(type===4) out[tag]=u32(at);
      else if(type===5){ const arr=[]; for(let k=0;k<count;k++) arr.push(u32(at+k*8)/(u32(at+k*8+4)||1)); out[tag]=arr; }
    }
    return out;
  };
  const root=ifd(t+u32(t+4));
  const exif=root[0x8769]?ifd(t+root[0x8769]):{};
  const gps=root[0x8825]?ifd(t+root[0x8825]):{};
  const res={};
  const ds=exif[0x9003]||exif[0x9004]||root[0x0132];
  const m=ds&&/^(\d{4}):(\d\d):(\d\d) (\d\d):(\d\d):(\d\d)/.exec(ds);
  if(m){ const d=new Date(+m[1],+m[2]-1,+m[3],+m[4],+m[5],+m[6]); if(!isNaN(d)) res.time=d; }   // heure locale du téléphone
  const dms=a=>Array.isArray(a)&&a.length>=3?a[0]+a[1]/60+a[2]/3600:null;
  let la=dms(gps[2]), lo=dms(gps[4]);
  if(la!=null&&lo!=null&&(la||lo)){ if(gps[1]==="S") la=-la; if(gps[3]==="W") lo=-lo; if(Math.abs(la)<=90&&Math.abs(lo)<=180){ res.lat=la; res.lon=lo; } }
  return res;
}
async function readFile(file){
  try{
    if(!file||!/jpe?g/i.test(file.type||file.name||"")) return null;
    return parseExif(await file.slice(0,256*1024).arrayBuffer());
  }catch(_){ return null; }
}
function km(a,b,c,d){ const r=Math.PI/180, x=Math.sin((c-a)*r/2)**2+Math.cos(a*r)*Math.cos(c*r)*Math.sin((d-b)*r/2)**2; return 12742*Math.asin(Math.sqrt(x)); }

let info=null, ignored=false;
function note(){
  let n=$("#p-exif");
  if(!n){ n=document.createElement("div"); n.id="p-exif"; n.className="note exif-note"; $("#p-thumbs")?.after(n); }
  return n;
}
function show(spotName){
  const n=note(); n.innerHTML="";
  if(!info||ignored){ n.hidden=true; return; }
  const parts=[];
  const old=info.time&&Date.now()-info.time.getTime()>90*6e4;
  if(old) parts.push("📅 Prise du "+info.time.toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long"})+" à "+info.time.toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"}).replace(":"," h "));
  if(spotName) parts.push("📍 Spot « "+spotName+" » retrouvé grâce à la photo");
  if(!parts.length){ n.hidden=true; return; }
  n.hidden=false;
  const t=document.createElement("span"); t.textContent=parts.join(" · ")+" ";
  const x=document.createElement("button"); x.type="button"; x.className="linkbtn"; x.textContent="Ce n'est pas ça";
  x.addEventListener("click",()=>{ ignored=true; if(spotName&&$("#p-spot").dataset.auto==="1"){ $("#p-spot").value=""; delete $("#p-spot").dataset.auto; } show(); });
  n.append(t,x);
}
// on lit la première photo choisie, avant que social.js ne vide le champ
document.addEventListener("change",async e=>{
  if(e.target?.id!=="p-photo") return;
  const f=e.target.files?.[0]; if(!f||info) return;   // seule la première photo compte
  const r=await readFile(f);
  if(!r||(!r.time&&r.lat==null)) return;
  info=r; ignored=false;
  let spotName=null;
  if(r.lat!=null&&!$("#p-spot").value){
    const g=A.cur, best=(A.spots||[]).filter(s=>s.group_id===g&&s.lat!=null).map(s=>({s,d:km(r.lat,r.lon,Number(s.lat),Number(s.lon))})).sort((a,b)=>a.d-b.d)[0];
    if(best&&best.d<=0.6&&[...$("#p-spot").options].some(o=>o.value===String(best.s.id))){ $("#p-spot").value=String(best.s.id); $("#p-spot").dataset.auto="1"; spotName=best.s.name; }
  }
  show(spotName);
},true);
// photos retirées ou prise publiée : on oublie
function reset(){ info=null; ignored=false; const n=$("#p-exif"); if(n) n.hidden=true; delete $("#p-spot")?.dataset.auto; }
$("#composer")?.addEventListener("reset",()=>setTimeout(reset,0));
new MutationObserver(()=>{ if(info&&!$("#p-thumbs")?.querySelector(".thumb")) reset(); }).observe($("#p-thumbs")||document.body,{childList:true});

// heure réelle de la prise, utilisée à la publication (null si la photo est récente)
A.photoTime=()=>{ if(!info||ignored||!info.time) return null; const age=Date.now()-info.time.getTime(); return age>90*6e4&&age<395*864e5?info.time.toISOString():null; };
A.parseExif=parseExif;
})();
