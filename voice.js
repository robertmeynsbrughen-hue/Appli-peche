// Coup du Jour : dictée vocale d'une prise (« brochet 78 centimètres au shad blanc »).
(function(){
"use strict";
const A=window.CDJ; if(!A) return;
const {el,toast}=A;
const $=s=>document.querySelector(s);
const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
const norm=s=>String(s||"").normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase();

// espèces reconnues (le premier nom est celui de la liste de l'appli)
const SPECIES=[
  ["Black-bass",["black bass","blackbass","black-bass","bass"]],["Brochet",["brochet","brocheton","bec de canard"]],["Sandre",["sandre"]],
  ["Perche",["perche","perchette"]],["Silure",["silure","glane"]],["Carpe",["carpe","carpe miroir","carpe commune","carpe cuir","koi"]],
  ["Chevesne",["chevesne","chevaine","chub"]],["Aspe",["aspe","aspius"]],["Truite fario",["truite"]],["Barbeau",["barbeau","barbel"]],
  ["Tanche",["tanche"]],["Brème",["breme"]],["Gardon",["gardon"]],["Rotengle",["rotengle"]],["Carassin",["carassin"]],
  ["Ablette",["ablette"]],["Vandoise",["vandoise"]],["Amour blanc",["amour blanc","amour"]],
];
const WORDNUM={un:1,une:1,deux:2,trois:3,quatre:4,cinq:5,six:6,sept:7,huit:8,neuf:9,dix:10,onze:11,douze:12,treize:13,quatorze:14,quinze:15,seize:16,vingt:20,trente:30,quarante:40,cinquante:50,soixante:60};
const num=s=>Number(String(s).replace(",","."));

// analyse d'une phrase dictée : espèce, longueur (cm), poids (kg), appât, spot
function parse(text){
  const out={};
  let t=" "+norm(text).replace(/[!?;]/g," ").replace(/\s+/g," ")+" ";
  // petits nombres dits en toutes lettres (« trois kilos »)
  t=t.replace(/\b(un|une|deux|trois|quatre|cinq|six|sept|huit|neuf|dix|onze|douze|treize|quatorze|quinze|seize|vingt|trente|quarante|cinquante|soixante)\b(?=\s*(kg|kilo|livre|gramme|cm|centi|metre|m\b))/g,w=>String(WORDNUM[w]));
  t=t.replace(/(\d)\s*(?:virgule|point)\s*(\d)/g,"$1,$2");
  // espèce : la mention la plus longue gagne
  let best=null;
  SPECIES.forEach(([name,keys])=>keys.forEach(k=>{ const i=t.indexOf(" "+k+" ")>=0?t.indexOf(" "+k+" "):t.indexOf(" "+k+"s "); if(i>=0&&(!best||k.length>best.k.length)) best={name,k,i}; }));
  if(best) out.species=best.name;
  // longueur
  let m=t.match(/(\d+)\s*(?:m|metres?|metre)\s*(\d{1,2})\b(?!\s*(?:kg|kilo|gramme))/);
  if(m&&num(m[1])<=3) out.length=num(m[1])*100+num(m[2].length===1?m[2]+"0":m[2]), t=t.replace(m[0]," ");
  else{
    m=t.match(/(\d+(?:[.,]\d+)?)\s*(?:cm|centimetres?|centimetre|centi)\b/);
    if(m) out.length=num(m[1]), t=t.replace(m[0]," ");
    else{ m=t.match(/(\d(?:[.,]\d+)?)\s*(?:m|metres?|metre)\b/); if(m&&num(m[1])<=3) out.length=Math.round(num(m[1])*100), t=t.replace(m[0]," "); }
  }
  // poids
  m=t.match(/(\d+(?:[.,]\d+)?)\s*(?:kg|kilos?|kilogrammes?)(?:\s*(\d{1,3})\b(?!\s*(?:cm|centi)))?/);
  if(m){ let w=num(m[1]); if(m[2]) w+=num(m[2])/(m[2].length===1?10:m[2].length===2?100:1000); out.weight=Math.round(w*100)/100; t=t.replace(m[0]," "); }
  else{ m=t.match(/(\d+)\s*(?:g|grammes?)\b/); if(m) out.weight=num(m[1])/1000, t=t.replace(m[0]," "); }
  // nombre seul avec une espèce : longueur en cm
  if(out.length==null){ m=t.match(/\b(\d{2,3})\b/); if(m&&num(m[1])>=5&&num(m[1])<=250) out.length=num(m[1]), t=t.replace(m[0]," "); }
  // spot nommé
  const sp=A.spots.filter(s=>typeof A.cur!=="number"||s.group_id===A.cur).map(s=>({s,k:norm(s.name)})).filter(x=>x.k.length>=3&&t.includes(x.k)).sort((a,b)=>b.k.length-a.k.length)[0];
  if(sp){ out.spot=sp.s; t=t.replace(sp.k," "); }
  // appât : ce qui suit « au », « à la », « avec », « sur »… dans la phrase d'origine (accents conservés)
  const orig=" "+String(text).replace(/\s+/g," ")+" ";
  const bm=orig.match(/\s(?:au|aux|à la|a la|à l'|a l'|avec (?:un |une |le |la |des )?|sur (?:un |une )?|en (?:leurre|appât|esche)? ?)\s*([^,.]+)/i);
  if(bm){
    let b=bm[1].replace(/\b\d+(?:[.,]\d+)?\s*(?:cm|centimètres?|kg|kilos?|grammes?)\b/gi,"").replace(/\s+(?:au spot|sur le spot|à la fosse|au poste)\b.*$/i,"").trim();
    if(sp) b=b.replace(new RegExp(sp.s.name.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"),"i"),"").trim();
    if(b.length>=2&&!/^(spot|poste|bord|moulin|pont)\b/i.test(b)) out.bait=b.charAt(0).toUpperCase()+b.slice(1);
  }
  return out;
}

function fill(r,text){
  if(r.species){ const s=$("#p-species"); if(s){ s.value=r.species; s.dispatchEvent(new Event("change",{bubbles:true})); } }
  if(r.length!=null) $("#p-len").value=String(r.length);
  if(r.weight!=null) $("#p-wt").value=String(r.weight);
  if(r.bait){ const b=$("#p-bait"); if(b&&!b.value.trim()) b.value=r.bait; else if(b) b.value=b.value.trim()+" · "+r.bait; }
  if(r.spot){ const s=$("#p-spot"); if(s) s.value=String(r.spot.id); }
  ["#p-len","#p-wt"].forEach(q=>$(q)?.dispatchEvent(new Event("input",{bubbles:true})));
  const got=[r.species,r.length!=null?String(r.length).replace(".",",")+" cm":null,r.weight!=null?String(r.weight).replace(".",",")+" kg":null,r.bait,r.spot?"📍 "+r.spot.name:null].filter(Boolean);
  const box=$("#voice-res");
  if(box){ box.hidden=false; box.innerHTML=""; box.append(el("div",null,"« "+text+" »"),el("b",null,got.length?"Compris : "+got.join(" · "):"Je n'ai rien reconnu, réessaie en disant l'espèce et la taille.")); }
}

let rec=null;
function listen(b){
  if(!SR) return;
  if(rec){ try{ rec.stop(); }catch(e){} return; }
  rec=new SR(); rec.lang="fr-FR"; rec.interimResults=true; rec.maxAlternatives=1; rec.continuous=false;
  const box=$("#voice-res"); let final="";
  b.classList.add("rec"); b.textContent="🔴 Je t'écoute… (touche pour arrêter)";
  if(box){ box.hidden=false; box.innerHTML=""; box.append(el("div","note","Ex. : « brochet 78 centimètres au shad blanc » ou « carpe 14 kilos 500 au spot La fosse du pont »")); }
  rec.onresult=e=>{ let txt=""; for(let i=0;i<e.results.length;i++){ txt+=e.results[i][0].transcript; if(e.results[i].isFinal) final=txt; } if(box){ box.innerHTML=""; box.append(el("div",null,"« "+txt+" »")); } };
  rec.onerror=e=>{ if(e.error==="not-allowed"||e.error==="service-not-allowed") toast("Autorise le micro pour dicter ta prise"); else if(e.error==="no-speech") toast("Je n'ai rien entendu, réessaie"); else if(e.error==="network") toast("La dictée a besoin du réseau"); };
  rec.onend=()=>{ b.classList.remove("rec"); b.textContent="🎤 Dicter la prise"; const t=final; rec=null; if(t) fill(parse(t),t); };
  try{ rec.start(); }catch(e){ rec=null; b.classList.remove("rec"); b.textContent="🎤 Dicter la prise"; }
}

function mount(){
  const h=$("#composer h2"); if(!h||$("#voice-btn")) return;
  const w=el("div","voice-box");
  const b=el("button","btn voice-btn","🎤 Dicter la prise"); b.type="button"; b.id="voice-btn";
  if(!SR){ b.disabled=true; b.title="Dictée non disponible sur ce navigateur"; }
  b.addEventListener("click",()=>listen(b));
  const r=el("div","voice-res"); r.id="voice-res"; r.hidden=true;
  w.append(b,r);
  if(!SR) w.append(el("p","note","La dictée vocale marche avec Chrome sur Android."));
  h.after(w);
}
A.voice={parse};
mount();
})();
