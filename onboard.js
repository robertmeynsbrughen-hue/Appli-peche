// Rivio : premier lancement guidé (photo, groupe, espèces préférées, lieu de pêche).
(function(){
"use strict";
const A=window.CDJ; if(!A) return;
const {el,toast,frError}=A;
const get=(k,d)=>{ try{ return localStorage.getItem(k)??d; }catch(e){ return d; } };
const set=(k,v)=>{ try{ localStorage.setItem(k,v); }catch(e){} };
function btn(label,cls,fn){ const b=el("button",cls||"btn",label); b.type="button"; if(fn) b.addEventListener("click",fn); return b; }
const SPECIES=["Brochet","Sandre","Perche","Black-bass","Silure","Carpe","Chevesne","Aspe","Truite fario","Barbeau","Tanche","Brème"];

async function squareJpeg(file,size=320){
  const img=await new Promise((res,rej)=>{ const i=new Image(); i.onload=()=>res(i); i.onerror=rej; i.src=URL.createObjectURL(file); });
  const s=Math.min(img.naturalWidth,img.naturalHeight), c=document.createElement("canvas"); c.width=c.height=size;
  c.getContext("2d").drawImage(img,(img.naturalWidth-s)/2,(img.naturalHeight-s)/2,s,s,0,0,size,size);
  return new Promise(r=>c.toBlob(r,"image/jpeg",.85));
}

let running=false;
async function maybeStart(force){
  if(running||!A.me) return;
  const key="cdj-onboard-"+A.me.id;
  if(!force&&get(key,"")==="1"){ A.onbPending=false; return; }
  A.onbPending=true; running=true;
  const {data:prof}=await A.sb.from("profiles").select("bio,fav_species,avatar_path").eq("id",A.me.id).maybeSingle();
  if(!force&&(prof?.bio||(prof?.fav_species||[]).length||prof?.avatar_path)){ set(key,"1"); A.onbPending=false; running=false; return; }
  const st={file:null,preview:null,fav:prof?.fav_species||[],bio:prof?.bio||null,avatar:prof?.avatar_path||null,place:null,alert:true};
  const back=el("div","tour-back onb-back"); const card=el("div","onb"); card.setAttribute("role","dialog"); card.setAttribute("aria-modal","true"); card.setAttribute("aria-label","Bienvenue");
  back.append(card); document.body.append(back);
  let step=0; const N=5;
  const finish=(tour)=>{ set(key,"1"); back.remove(); running=false; A.onbPending=false; if(tour) A.tour?.(true); };
  function frame(ico,title,text){
    card.innerHTML="";
    const dots=el("div","onb-dots"); for(let i=0;i<N;i++) dots.append(el("i",i===step?"on":i<step?"done":null)); card.append(dots);
    card.append(el("div","onb-ico",ico),el("h2",null,title)); if(text) card.append(el("p","note",text));
  }
  function nav(nextLabel,onNext,canSkip=true){
    const a=el("div","onb-nav");
    if(canSkip) a.append(btn(step===0?"Plus tard":"Passer","linkbtn",()=>{ if(step===0) return finish(false); step++; render(); }));
    else a.append(el("span"));
    const n=btn(nextLabel,"btn primary",async()=>{ n.disabled=true; try{ if(onNext) await onNext(); step++; render(); }catch(e){ toast(frError(e)); n.disabled=false; } });
    a.append(n); card.append(a); return n;
  }
  async function saveProfile(){
    let path=st.avatar;
    if(st.file){ const blob=await squareJpeg(st.file); path=A.me.id+"/avatar-"+Date.now()+".jpg"; const up=await A.sb.storage.from("avatars").upload(path,blob,{contentType:"image/jpeg"}); if(up.error) throw up.error; }
    const {error}=await A.sb.rpc("update_my_profile",{p_bio:st.bio,p_fav:st.fav,p_avatar:path}); if(error) throw error;
      try{ localStorage.removeItem("cdj-avatars"); if(A.me) A.me.fav_species=st.fav; localStorage.setItem("cdj-fav",JSON.stringify(st.fav||[])); window.dispatchEvent(new Event("cdj-fav")); }catch(_){}
    st.avatar=path;
    if(path&&window.CDJ_AVATARS){ window.CDJ_AVATARS[A.me.username]=A.sb.storage.from("avatars").getPublicUrl(path).data.publicUrl; }
  }
  function render(){
    if(step===0){
      frame("👋","Bienvenue @"+A.me.username+" !","En quatre petits écrans, on règle l'appli pour toi. Commence par une photo de profil : tes potes te reconnaîtront dans le fil et sur la carte.");
      const ph=el("label","onb-photo");
      const im=el("span","onb-av"); if(st.preview) im.style.backgroundImage="url('"+st.preview+"')"; else im.textContent=A.me.username.charAt(0).toUpperCase();
      const inp=el("input"); inp.type="file"; inp.accept="image/*"; inp.hidden=true;
      inp.addEventListener("change",()=>{ const f=inp.files?.[0]; if(!f) return; st.file=f; st.preview=URL.createObjectURL(f); render(); });
      ph.append(im,el("span","btn small",st.preview?"Changer la photo":"📷 Choisir une photo"),inp); card.append(ph);
      nav(st.file?"Continuer":"Continuer sans photo",async()=>{ if(st.file) await saveProfile(); });
    }else if(step===1){
      frame("👥","Ton groupe",A.groups.length?"Tu fais déjà partie de :":"Entre le code que t'a donné un pote pour rejoindre son groupe.");
      if(A.groups.length){ const l=el("div","onb-groups"); A.groups.slice(0,4).forEach(g=>l.append(el("span","chip","✓ "+g.name))); card.append(l); card.append(el("p","note","Tu pourras en rejoindre ou en créer d'autres depuis Profil ⚙️."));
        nav("Continuer"); }
      else{
        const i=el("input"); i.placeholder="Code du groupe"; i.autocomplete="off"; i.className="onb-input"; card.append(i);
        nav("Rejoindre",async()=>{ if(!i.value.trim()) throw new Error("Entre le code du groupe ou touche Passer"); const {data:gid,error}=await A.sb.rpc("join_group",{p_code:i.value.trim()}); if(error) throw error; if(gid==null) throw new Error("code invalide"); await A.loadGroups(); toast(A.groups.length?"Groupe rejoint !":"Demande envoyée : un modérateur doit la valider"); });
      }
    }else if(step===2){
      frame("🐟","Tes espèces préférées","Choisis jusqu'à 3 espèces : elles s'affichent sur ton profil et passent en tête des conseils.");
      const g=el("div","onb-chips");
      SPECIES.forEach(n=>{ const on=st.fav.includes(n); const c=btn(n,"pick"+(on?" on":""),()=>{ if(on) st.fav=st.fav.filter(x=>x!==n); else if(st.fav.length<3) st.fav=[...st.fav,n]; else toast("3 espèces maximum"); render(); }); c.setAttribute("aria-pressed",String(on)); g.append(c); });
      card.append(g);
      nav("Continuer",async()=>{ if(st.fav.length) await saveProfile(); });
    }else if(step===3){
      frame("📍","Ton coin de pêche","Où pêches-tu le plus souvent ? L'appli s'en sert pour la météo, l'alerte du matin, les crues et les potes à proximité.");
      const box=el("div","onb-place");
      const lab=el("div","onb-pl",st.place?"📍 "+st.place.name:"Aucun lieu choisi");
      const me=btn("📡 Ma position actuelle","btn",()=>{ navigator.geolocation?.getCurrentPosition(p=>{ st.place={lat:+p.coords.latitude.toFixed(4),lon:+p.coords.longitude.toFixed(4),name:"Ma position"}; render(); },()=>toast("Autorise la localisation"),{timeout:10000}); });
      box.append(lab,me);
      const spots=A.spots.filter(s=>typeof A.cur!=="number"||s.group_id===A.cur);
      if(spots.length){ const s=el("select","onb-input"); s.append(new Option("… ou un spot du groupe","")); spots.forEach(x=>s.append(new Option(x.name,x.id))); s.addEventListener("change",()=>{ const x=spots.find(y=>String(y.id)===s.value); if(x){ st.place={lat:x.lat,lon:x.lon,name:x.name}; render(); } }); box.append(s); }
      const al=el("label","check"); const c=el("input"); c.type="checkbox"; c.checked=st.alert; c.addEventListener("change",()=>st.alert=c.checked); al.append(c," Recevoir l'alerte du matin quand ça va mordre ici"); box.append(al);
      card.append(box);
      nav("Continuer",async()=>{ if(!st.place) return; const {error}=await A.sb.from("alert_prefs").upsert({user_id:A.me.id,enabled:st.alert,lat:st.place.lat,lon:st.place.lon,place:st.place.name.slice(0,60),updated_at:new Date().toISOString()},{onConflict:"user_id"}); if(error) throw error; });
    }else{
      frame("🎣","C'est prêt !","Ton profil est réglé. Pense à activer les notifications dans Profil ⚙️ pour être prévenu des prises et des sorties du groupe.");
      const a=el("div","onb-nav"); a.append(btn("Visite guidée (30 s)","btn",()=>finish(true)),btn("C'est parti !","btn primary",()=>{ finish(false); A.celebrate?.("🎣","Bienvenue !","Bonne pêche avec le groupe"); }));
      card.append(a);
    }
  }
  render();
}
A.onboard=()=>maybeStart(true);
const prevChange=A.hooks.change; A.hooks.change=()=>{ prevChange?.(); if(A.me) maybeStart(false); };
if(A.me) maybeStart(false);
})();
