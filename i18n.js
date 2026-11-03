// Rivio : version anglaise. L'interface est écrite en français ; quand la langue
// choisie est l'anglais, ce module traduit à la volée les textes affichés
// (textes, placeholders, infobulles, boîtes de dialogue, dates), sans jamais
// toucher au contenu écrit par les membres (messages, légendes, bios…).
// Les traductions sont dans i18n-en.js ; les nombres et les pseudos sont des
// paramètres : « il y a {n} h » ↔ « {n} h ago », « @{u} ».
(function(){
"use strict";
let lang="fr";
try{ lang=localStorage.getItem("cdj-lang")||((navigator.language||"").toLowerCase().startsWith("fr")?"fr":/^en/i.test(navigator.language||"")?"en":"fr"); }catch(e){}
window.CDJ_LANG=lang;
window.CDJ_SETLANG=l=>{ try{ localStorage.setItem("cdj-lang",l); }catch(e){} location.reload(); };
if(lang!=="en") return;
document.documentElement.lang="en";

// ---------- Dates et nombres : les appels en « fr-FR » passent en anglais ----------
const swap=l=>(l==="fr-FR"||l==="fr"||(Array.isArray(l)&&l[0]&&/^fr/.test(l[0])))?"en-GB":l;
const D=Date.prototype;
["toLocaleString","toLocaleDateString","toLocaleTimeString"].forEach(fn=>{ const o=D[fn]; D[fn]=function(l,opt){ return o.call(this,swap(l),opt); }; });
const N=Number.prototype.toLocaleString; Number.prototype.toLocaleString=function(l,opt){ return N.call(this,swap(l),opt); };
const IDF=Intl.DateTimeFormat; Intl.DateTimeFormat=function(l,opt){ return new IDF(swap(l),opt); }; Intl.DateTimeFormat.prototype=IDF.prototype; Intl.DateTimeFormat.supportedLocalesOf=IDF.supportedLocalesOf;

// ---------- Moteur de traduction ----------
const DICT=window.CDJ_EN||{};
const exact=new Map(), tpl=new Map();
for(const [fr,en] of Object.entries(DICT)){ (/\{n\}|\{u\}/.test(fr)?tpl:exact).set(fr,en); }
const NUM=/\d+(?:[.,]\d+)?/g, USER=/@[A-Za-z0-9_]{3,20}/g;
function viaTemplate(s){
  const users=[], nums=[];
  let k=s.replace(USER,m=>{ users.push(m.slice(1)); return "@{u}"; });
  k=k.replace(NUM,m=>{ nums.push(m); return "{n}"; });
  if(!users.length&&!nums.length) return null;
  const en=tpl.get(k); if(en==null) return null;
  let i=0,j=0;
  return en.replace(/\{n\}|\{u\}/g,m=>m==="{n}"?(nums[i++]??""):(users[j++]??""));
}
const RX=(window.CDJ_EN_RX||[]).map(([r,x,deep])=>[new RegExp(r),x,!!deep]);
// règle « profonde » (3e valeur à 1) : les morceaux capturés sont traduits eux aussi
function part(g){
  if(g==null) return "";
  const cap=x=>x.charAt(0).toUpperCase()+x.slice(1), low=x=>x.charAt(0).toLowerCase()+x.slice(1);
  const one1=x=>{ const r=one(x); if(r!=null) return r; if(/^\p{Ll}/u.test(x)){ const c=one(cap(x)); if(c!=null) return low(c); } return null; };
  const w=one1(g); if(w!=null) return w;
  if(g.includes(" · ")) return g.split(" · ").map(part).join(" · ");
  if(g.includes(", ")) return g.split(", ").map(x=>one1(x)??x).join(", ");
  return g;
}
function viaRegex(s){ for(const [r,x,deep] of RX){ if(r.test(s)) return deep?s.replace(r,(...m)=>x.replace(/\$(\d)/g,(_,i)=>part(m[+i]))):s.replace(r,x); } return null; }
function base(s){ return exact.get(s)??viaTemplate(s)??viaRegex(s); }
// « 💡 Astuce… », « 🪢 Nœuds » : un pictogramme devant un texte connu
const PREFIX=/^([^\p{L}\p{N}«"(]*\s)(\p{L}[\s\S]*)$/u;
function one(s){
  let r=base(s); if(r!=null) return r;
  const m=PREFIX.exec(s); if(m&&m[1].trim()){ r=base(m[2]); if(r!=null) return m[1]+r; }
  return null;
}
function tr(text){
  if(!text) return text;
  const t=text.trim(); if(!t||!/[A-Za-zÀ-ÿ]/.test(t)) return text;
  let out=one(t);
  if(out==null&&/ · /.test(t)){            // « Brochet · 86 cm · il y a 2 h » : chaque morceau
    const parts=t.split(" · "); let any=false;
    const done=parts.map(p=>{ const x=one(p); if(x!=null){ any=true; return x; } return p; });
    if(any) out=done.join(" · ");
  }
  if(out==null) return text;
  return text.replace(t,out);
}
window.CDJ_T=tr;

// contenu écrit par les membres : jamais traduit
const SKIP=".bubble,.dm-msgs,.dm-last,.qa-body,.qa-ans p,.qa-title,.qa-c b,.log-det,.pf-bio,.post-caption,.caption,.post-text,.memo-body,.memo-title,.cmt-b,.msg-quote span,.cp-t,.ann-txt,.post-user,.mention,[data-user-content],[contenteditable],script,style,textarea,code";
const ATTRS=["placeholder","aria-label","title"];
const done=new WeakMap();
function textNode(n){
  if(done.get(n)===n.nodeValue) return;
  const p=n.parentElement; if(!p) return;
  // les badges de rôle (Développeur, Modo, Garde-pêche…) sont de l'appli, même à côté d'un pseudo
  if(p.closest(SKIP)&&!p.classList.contains("badge")) return;
  const v=tr(n.nodeValue);
  if(v!==n.nodeValue){
    // une option sans valeur garde sa valeur française (elle est enregistrée telle quelle)
    if(p.tagName==="OPTION"&&!p.hasAttribute("value")) p.setAttribute("value",p.textContent);
    n.nodeValue=v;
  }
  done.set(n,n.nodeValue);
}
function attrs(e){
  if(e.closest&&e.closest(SKIP)&&e.tagName!=="TEXTAREA") return;
  for(const a of ATTRS){ const v=e.getAttribute&&e.getAttribute(a); if(v){ const t=tr(v); if(t!==v) e.setAttribute(a,t); } }
}
function walk(root){
  if(root.nodeType===3){ textNode(root); return; }
  if(root.nodeType!==1) return;
  attrs(root);
  const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT|NodeFilter.SHOW_ELEMENT);
  let n; while((n=w.nextNode())){ if(n.nodeType===3) textNode(n); else attrs(n); }
}
const mo=new MutationObserver(list=>{
  for(const m of list){
    if(m.type==="characterData") textNode(m.target);
    else if(m.type==="attributes") attrs(m.target);
    else m.addedNodes.forEach(walk);
  }
});
function start(){ walk(document.body); mo.observe(document.body,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:ATTRS}); document.title=tr(document.title); }
if(document.body) start(); else document.addEventListener("DOMContentLoaded",start);

// boîtes de dialogue du navigateur
const C=window.confirm, P=window.prompt, Al=window.alert;
window.confirm=m=>C.call(window,tr(String(m)));
window.prompt=(m,d)=>P.call(window,tr(String(m)),d);
window.alert=m=>Al.call(window,tr(String(m)));
})();
