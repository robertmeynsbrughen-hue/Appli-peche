// Rivio : faux Supabase pour les tests automatiques (aucune donnée réelle, aucun secret).
window.CDJ_CONFIG={SUPABASE_URL:"https://x.supabase.co",SUPABASE_KEY:"k",EMAIL_DOMAIN:"coupdujour.app"};
(function(){
const AS=new URLSearchParams(location.search).get("as")||"bob";
const H=3600e3, now=Date.now(), iso=t=>new Date(now-t).toISOString();
const P={u1:{id:"u1",username:"Roby_Admin",is_admin:true},u2:{id:"u2",username:"alice",is_admin:false,fish_styles:["carpe","feeder"]},u3:{id:"u3",username:"bob",is_admin:false},u4:{id:"u4",username:"marco_47",is_admin:false,fish_styles:["carnassier","float"],bio:"Brochet et silure en float-tube sur le Lot 🎣",fav_species:["Brochet","Silure"],avatar_path:"u4/avatar.jpg",created_at:"2026-03-02T10:00:00Z"},u5:{id:"u5",username:"lea_float",is_admin:false},u6:{id:"u6",username:"nouveau_47",is_admin:false}};
const ME=Object.values(P).find(p=>p.username===AS)||P.u3;
const T={
 app_flags:[{key:"maintenance",value:{on:/maint=1/.test(location.search),message:"On installe la 0.72, retour vers 15 h !",until:null}}],
 bug_reports:[{id:1,user_id:"u2",body:"Quand je publie 3 photos l'appli reste bloquée sur Envoi…",screen:"#fil",version:"0.70",agent:"Mozilla/5.0 (Linux; Android 14; Pixel 7)",extra:{screen:"412×915",online:true},photo_path:null,status:"open",created_at:new Date(Date.now()-3600e3).toISOString(),profiles:{username:"alice"}}],
 direct_messages:[{id:501,user_id:"u4",to_user:"u3",body:"Salut ! Tu viens samedi au lac ?",created_at:new Date(Date.now()-3*3600e3).toISOString(),read_at:null},{id:502,user_id:"u3",to_user:"u4",body:"Oui, 6h au parking nord",created_at:new Date(Date.now()-2*3600e3).toISOString(),read_at:new Date(Date.now()-1*3600e3).toISOString()}],
 dm_blocks:[], message_reactions:[], mentorships:[],
 qa_questions:[{id:1,group_id:13,user_id:"u2",title:"Quel fil pour débuter le brochet ?",body:null,best_answer_id:null,created_at:new Date(Date.now()-20*3600e3).toISOString(),profiles:{username:"alice"},qa_answers:[{count:1}]}],
 qa_answers:[{id:1,question_id:1,user_id:"u4",body:"Tresse 15/100 + bas de ligne fluoro 50/100, c'est la base.",created_at:new Date(Date.now()-5*3600e3).toISOString(),profiles:{username:"marco_47"}}],
 announcements:[{id:9,title:"Nouvelle version 0.69",body:"Saisie sans réseau, groupe Bienvenue et plus encore.",level:"nouveau",starts_at:new Date(Date.now()-3600e3).toISOString(),ends_at:new Date(Date.now()+86400e3).toISOString(),push:false,created_at:new Date().toISOString()}],
 moderation_log:[{id:1,at:new Date(Date.now()-2*3600e3).toISOString(),action:"warning",details:"Propos insultants ou agressifs",group_id:null,actor_p:{username:"Roby_Admin"},target_p:{username:"bob"}},{id:2,at:new Date(Date.now()-26*3600e3).toISOString(),action:"delete_message",details:"t'es qu'un nul",group_id:2,actor_p:{username:"marco_47"},target_p:{username:"alice"}},{id:3,at:new Date(Date.now()-50*3600e3).toISOString(),action:"approve_member",details:null,group_id:2,actor_p:{username:"bob"},target_p:{username:"marco_47"}},{id:4,at:new Date(Date.now()-80*3600e3).toISOString(),action:"timeout",details:"24 h · Spam ou publicité",group_id:null,actor_p:{username:"Roby_Admin"},target_p:{username:"spam_bot"}}],
 groups:[{id:13,name:"Bienvenue",region:null,require_approval:false,post_approval:false,is_welcome:true},{id:1,name:"Les potes",region:"Lot-et-Garonne",require_approval:false,post_approval:false},{id:2,name:"Float-tube 47",region:"Lot",require_approval:true,post_approval:true}],
 memberships:[{group_id:13,user_id:"u1",role:"owner",status:"active"},{group_id:13,user_id:"u3",role:"member",status:"active"},{group_id:13,user_id:"u4",role:"member",status:"active"},{group_id:1,user_id:"u1",role:"member",status:"active"},{group_id:1,user_id:"u2",role:"owner",status:"active"},{group_id:1,user_id:"u3",role:"member",status:"active"},
   {group_id:2,user_id:"u3",role:"owner",status:"active"},{group_id:2,user_id:"u4",role:"moderator",status:"active"},{group_id:2,user_id:"u2",role:"member",status:"active"},{group_id:2,user_id:"u5",role:"member",status:"pending"}],
 posts:[{id:71,group_id:2,user_id:'u2',status:'published',caption:'',species:'Brochet',length_cm:92,weight_kg:6.1,photo_path:'2/u2/ph3.jpg',photo_paths:['2/u2/ph3.jpg'],created_at:iso(90*H),spots:null},{id:72,group_id:2,user_id:'u3',status:'published',caption:'',species:'Brochet',length_cm:58,weight_kg:1.4,photo_path:'2/u3/ph2.jpg',photo_paths:['2/u3/ph2.jpg'],created_at:iso(190*H),spots:null},{id:61,group_id:2,user_id:'u3',status:'published',caption:'',species:'Carpe',length_cm:78,weight_kg:14.2,photo_path:'2/u3/ph1.jpg',photo_paths:['2/u3/ph1.jpg'],created_at:new Date(new Date().getFullYear(),new Date().getMonth()-1,12).toISOString(),spots:null,spot_id:5},{id:62,group_id:2,user_id:'u2',status:'published',caption:'',species:'Perche',length_cm:41,weight_kg:1.1,photo_path:'2/u2/ph2.jpg',photo_paths:['2/u2/ph2.jpg'],created_at:iso(5*H),spots:null},{id:51,group_id:2,user_id:'u4',status:'published',caption:'Au jerk dans les herbiers',species:'Brochet',length_cm:74,weight_kg:3.1,bait:null,photo_path:'2/u4/ph0.jpg',photo_paths:['2/u4/ph0.jpg'],released:true,created_at:iso(2*H),spots:null},{id:50,group_id:2,user_id:"u3",status:"published",caption:"",species:"Silure",length_cm:162,weight_kg:31,bait:null,photo_path:null,photo_paths:null,created_at:new Date(new Date().setHours(5,30)).toISOString(),spots:null,spot_id:5},
   {id:1,group_id:2,user_id:"u2",status:"pending",caption:"Sandre au crépuscule",species:"Sandre",length_cm:64,weight_kg:2.4,bait:"Shad 10 cm tête 14 g",photo_path:null,photo_paths:null,created_at:iso(1*H),spots:null},
   {id:2,group_id:2,user_id:"u4",status:"published",caption:"Grosse activité au lever",species:"Brochet",length_cm:86,weight_kg:4.9,bait:"Swimbait 15 cm coloris perche, récupération lente",photo_path:"2/u4/a.jpg",photo_paths:["2/u4/a.jpg"],released:false,created_at:iso(26*H),spots:{id:5,name:"La fosse du pont"},spot_id:5}],
 sessions:[{id:1,group_id:2,user_id:"u4",species:"Brochet",caught:true,length_cm:86,released:true,lure:"Swimbait",color:"Perche",rating:4,created_at:iso(3*H)},
   {id:2,group_id:2,user_id:"u2",species:"Perche",caught:true,length_cm:32,lure:"Drop-shot",color:"Naturel",rating:3,created_at:iso(30*H)},
   {id:3,group_id:2,user_id:"u3",species:"Brochet",caught:true,length_cm:71,lure:"Swimbait",color:"Perche",rating:4,created_at:iso(52*H),conditions:{water:12,dp:-1.6,cloud:80,rain:0.5,phase:'aube',flow:'normale'}},{id:8,group_id:2,user_id:"u3",species:"Brochet",caught:true,length_cm:66,lure:"Swimbait",color:"Perche",rating:3,created_at:iso(200*H),conditions:{water:10.5,dp:-2,cloud:90,rain:0,phase:'crep',flow:'normale'}},{id:9,group_id:2,user_id:"u3",species:"Brochet",caught:true,length_cm:78,lure:"Swimbait",color:"Perche",rating:4,created_at:iso(300*H),conditions:{water:13.5,dp:-1.2,cloud:70,rain:0,phase:'aube',flow:'haute'}},
   {id:4,group_id:2,user_id:"u2",species:"Sandre",caught:false,length_cm:null,lure:"Shad",color:"Chartreuse",rating:1,created_at:iso(80*H)},
   {id:6,group_id:2,user_id:"u3",species:"Chevesne",caught:true,length_cm:44,lure:"Cuillère",color:"Cuivre",rating:3,created_at:iso(140*H)},{id:7,group_id:2,user_id:"u4",species:"Aspe",caught:true,length_cm:68,released:true,lure:"Jig",color:"Blanc",rating:4,created_at:iso(150*H)},
   {id:5,group_id:2,user_id:"u4",species:"Sandre",caught:true,length_cm:58,released:true,lure:"Shad",color:"Chartreuse",rating:3,created_at:iso(120*H)}],
 memos:[{id:1,group_id:2,user_id:"u3",title:"Règles du lac de Clarens",body:"No-kill total sur les carnassiers.\nFloat-tube autorisé de 7 h à 19 h, gilet obligatoire.\nMise à l'eau côté parking nord uniquement.",link:"https://www.federationpeche47.fr",photo_path:null,pinned:true,created_at:iso(200*H),updated_at:iso(50*H)},
   {id:2,group_id:2,user_id:"u4",title:"Bons postes du secteur",body:"Cassure à 4 m devant les nénuphars, bordure de roseaux rive est le soir.",link:null,photo_path:null,pinned:false,created_at:iso(90*H),updated_at:iso(90*H)}],
 polls:[{id:1,group_id:2,user_id:"u4",question:"Qui est dispo samedi matin ?",place:"Garonne Aval",event_at:new Date(now+2*86400e3).toISOString(),created_at:iso(5*H)}],
 poll_votes:[{poll_id:1,user_id:"u4",choice:"oui"},{poll_id:1,user_id:"u2",choice:"peut-etre"}],
 messages:[{id:1,group_id:2,user_id:"u4",body:"Quelqu'un a testé le lac ce matin ?",created_at:iso(3*H)},{id:2,group_id:2,user_id:"u2",body:"Oui, eau teintée, ça tapait au shad chartreuse 👌",created_at:iso(2.8*H)},{id:3,group_id:2,user_id:"u1",body:"Top, je passe demain à 6h",created_at:iso(2.5*H)},{id:4,group_id:2,user_id:"u4",body:"Je viens avec toi ! @bob tu nous rejoins ?",created_at:iso(.5*H)}],
 reactions:[{post_id:2,user_id:"u2",emoji:"fire"},{post_id:2,user_id:"u3",emoji:"fire"},{post_id:2,user_id:"u2",emoji:"fish"}],
 comments:[{id:1,post_id:2,user_id:"u2",body:"Quel monstre ! Bravo 👏",created_at:iso(20*H)},{id:2,post_id:2,user_id:"u3",body:"Il est sorti où exactement ?",created_at:iso(19*H)},{id:3,post_id:2,user_id:"u4",body:"Je te montre samedi 😉",created_at:iso(18*H)}],
 challenges:[{id:1,group_id:2,user_id:"u3",title:"Brochet de 70 cm et plus",species:"Brochet",min_length:70,month:new Date(new Date().getFullYear(),new Date().getMonth(),1,12).toISOString().slice(0,10),created_at:iso(200*H)},
   {id:2,group_id:2,user_id:"u4",title:"Une perche de 35 cm",species:"Perche",min_length:35,month:new Date(new Date().getFullYear(),new Date().getMonth(),1,12).toISOString().slice(0,10),created_at:iso(100*H)}],
 spots:[{id:5,group_id:2,user_id:"u4",name:"La fosse du pont",note:"Accès par le chemin de halage",lat:44.2,lon:0.6,created_at:iso(400*H),depth_m:4.5,distance_tours:22,bottom:"Vase",details:"Cassure à 22 tours face au saule.\nAmorcer en ligne.",sheet_updated_at:iso(30*H),facing:225},{id:6,group_id:2,user_id:"u3",name:"Plan d'eau des Iles",note:null,lat:44.215,lon:0.62,created_at:iso(300*H),facing:null},{id:7,group_id:2,user_id:"u2",name:"Bras mort",note:null,lat:44.18,lon:0.57,created_at:iso(200*H),facing:90}],
 carp_sessions:[{id:9,group_id:2,user_id:"u4",spot_id:5,rods:2,bait:"Scopex 20 mm",groundbait:"2 kg bouillettes",started_at:iso(2*H),ended_at:null,created_at:iso(2*H),bait_every_min:null,next_bait_at:null},{id:1,group_id:2,user_id:"u4",spot_id:5,rods:3,bait:"Scopex 20 mm",groundbait:"3 kg de bouillettes",started_at:iso(60*H),ended_at:iso(36*H),created_at:iso(60*H)},
   {id:2,group_id:2,user_id:"u2",spot_id:5,rods:2,bait:"Maïs",groundbait:null,started_at:iso(130*H),ended_at:iso(118*H),created_at:iso(130*H)}],
 carp_events:[{id:1,session_id:1,kind:"depart",at:iso(55*H),rod:2},{id:2,session_id:1,kind:"prise",at:iso(54.8*H),rod:2,weight_kg:14.2},{id:3,session_id:1,kind:"depart",at:iso(42*H),rod:1},{id:4,session_id:1,kind:"touche",at:iso(41*H),rod:3},{id:5,session_id:2,kind:"prise",at:iso(126*H),rod:1,weight_kg:9.6},{id:6,session_id:2,kind:"depart",at:iso(122*H),rod:2}],
 gear_items:[{id:1,user_id:"u3",kit:"Carpe",name:"Bouillettes",checked:true,created_at:iso(9*H)},{id:2,user_id:"u3",kit:"Carpe",name:"Épuisette",checked:false,created_at:iso(8*H)}],
 alert_prefs:[], reports:[{id:1,group_id:2,user_id:"u2",kind:"comment",target_id:3,excerpt:"Je te montre samedi 😉",author_id:"u4",reason:"Spot privé dévoilé sans accord",status:"open",created_at:iso(2*H)}],
 competitions:[{id:1,group_id:2,user_id:"u3",title:"Open carnassiers du week-end",mode:"points",species:null,start_at:iso(48*H),end_at:new Date(now+24*H).toISOString(),created_at:iso(50*H)},{id:2,group_id:2,user_id:"u3",title:"Défi carpe",mode:"biggest",species:"Carpe",start_at:new Date(now+72*H).toISOString(),end_at:new Date(now+96*H).toISOString(),created_at:iso(5*H)}],
 lures:[{id:1,user_id:"u3",name:"Swimbait 15 perche",kind:"Swimbait",color:"Perche",weight_g:28,photo_path:null,notes:"Lent, près du fond",created_at:iso(300*H)},{id:2,user_id:"u3",name:"Cuillère cuivre n°2",kind:"Cuillère",color:"Cuivre",weight_g:6,photo_path:"u3/l.jpg",notes:null,created_at:iso(200*H)}], outings:[{id:1,group_id:2,user_id:"u4",title:"Lac de Clarens à l'aube",place:"Clarens",spot_id:5,start_at:new Date(now+86400e3).toISOString(),notes:"Float-tube, on vise le brochet",created_at:iso(3*H)}],
 outing_rsvps:[{outing_id:1,user_id:"u4",status:"yes",seats:2,needs_ride:false,brings:"Sondeur + café"},{outing_id:1,user_id:"u2",status:"maybe",seats:0,needs_ride:true,brings:null}],
 live_positions:[{user_id:"u4",group_id:2,lat:44.21,lon:0.61,accuracy:12,updated_at:iso(.05*H)}], push_subs:[],
 tracks:[{id:1,user_id:'u4',group_id:2,title:'Float-tube Clarens',started_at:iso(30*H),ended_at:iso(27*H),points:[[44.2,0.6,0],[44.202,0.603,600],[44.205,0.601,1500]],bites:[[44.202,0.603,620]],distance_m:1240,shared:true}],
 depth_points:[{id:1,group_id:2,user_id:'u4',lat:44.2005,lon:0.6005,depth_m:2.5,bottom:'Herbiers',note:'Herbier en bordure',created_at:iso(40*H)},{id:2,group_id:2,user_id:'u2',lat:44.2015,lon:0.6012,depth_m:6,bottom:'Gravier',note:null,created_at:iso(40*H)},{id:3,group_id:2,user_id:'u3',lat:44.1995,lon:0.6015,depth_m:3.2,bottom:'Vase',note:null,created_at:iso(40*H)}],
 post_shares:[], fish_events:[{id:1,group_id:2,user_id:"u3",kind:"enduro",title:"Enduro carpe du lac de Clarens",start_date:new Date(Date.now()+12*864e5).toISOString().slice(0,10),end_date:new Date(Date.now()+14*864e5).toISOString().slice(0,10),place:"Lac de Clarens",url:"https://example.org/enduro",note:"Inscription avant le 15, 2 pêcheurs par poste",created_at:iso(5*H)},{id:2,group_id:2,user_id:"u4",kind:"salon",title:"Salon de la pêche d'Agen",start_date:new Date(Date.now()+40*864e5).toISOString().slice(0,10),end_date:null,place:"Agen",url:null,note:null,created_at:iso(9*H)}], notifications:[{id:1,user_id:"u4",title:"🎣 Nouvelle prise · Float-tube 47",body:"@bob : Carpe · 78 cm · 14,2 kg",url:"./#fil",tag:"post-61",created_at:iso(1*H),read_at:null},{id:2,user_id:"u4",title:"💬 Commentaire · Float-tube 47",body:"@alice : Joli poisson ! Au jerk ?",url:"./#fil",tag:"com-51",created_at:iso(3*H),read_at:null},{id:3,user_id:"u4",title:"⛈️ Orage dans le quart d'heure · La fosse du pont",body:"Range les cannes en carbone, éloigne-toi de l'eau et des arbres isolés.",url:"./#conseils",tag:"storm",created_at:iso(26*H),read_at:iso(25*H)},{id:4,user_id:"u4",title:"🏆 Photo du mois de septembre",body:"@bob l'emporte (Carpe de 78 cm) avec 2 votes.",url:"./#groupe",tag:"photo-mois-2",created_at:iso(60*H),read_at:iso(50*H)}], baitings:[{id:1,user_id:"u4",group_id:2,spot_id:5,at:iso(60*H+3600e3*24),mix:["Bouillettes","Pellets"],qty_kg:3,note:"Spod à 60 m"},{id:2,user_id:"u4",group_id:2,spot_id:5,at:iso(200*H),mix:["Graines","Maïs"],qty_kg:5,note:null},{id:3,user_id:"u4",group_id:2,spot_id:5,at:iso(400*H),mix:["Bouillettes","Pellets"],qty_kg:2,note:null},{id:4,user_id:"u4",group_id:2,spot_id:5,at:iso(500*H),mix:["Graines"],qty_kg:4,note:null}],
 photo_votes:[{group_id:2,month:"__PREV__",user_id:"u2",post_id:61},{group_id:2,month:"__PREV__",user_id:"u3",post_id:61},{group_id:2,month:"__CUR__",user_id:"u2",post_id:51}], wake_alarms:[], checkins:[{id:1,group_id:2,user_id:'u4',kind:'session',announce:true,spot_id:5,place:null,lat:44.2,lon:0.6,note:'float côté roseaux',started_at:iso(1*H),ends_at:new Date(now+3*H).toISOString(),ended_at:null}], map_zones:[{id:1,group_id:2,user_id:'u4',kind:'nokill',name:'Parcours no-kill du pont',note:null,geom:{type:'polygon',coords:[[44.2,0.6],[44.202,0.6],[44.202,0.603]]},created_at:iso(20*H)}], bait_stock:[{id:1,user_id:'u3',name:'Bouillettes scopex',unit:'kg',qty:1.5,low_at:2,updated_at:iso(5*H)},{id:2,user_id:'u3',name:'Maïs',unit:'kg',qty:6,low_at:2,updated_at:iso(5*H)}]
};

T.water_reports=[{id:301,group_id:2,user_id:"u2",spot_id:5,lat:44.2,lon:0.6,color:"teintee",level:"haut",temp:11.5,weeds:null,note:"Eau qui monte doucement",created_at:new Date(Date.now()-3*36e5).toISOString()}];
T.env_reports=[{id:401,group_id:2,user_id:"u3",kind:"mortalite",lat:44.21,lon:0.61,place:"Sous le pont de la D911",details:"Une dizaine de gardons morts le long de la berge, odeur bizarre.",photo_path:"2/u3/ph2.jpg",status:"ouvert",created_at:new Date(Date.now()-20*36e5).toISOString()},{id:402,group_id:2,user_id:"u4",kind:"dechets",lat:44.19,lon:0.59,place:"Parking du lac",details:"Dépôt de sacs et de fils.",photo_path:null,status:"resolu",created_at:new Date(Date.now()-9*864e5).toISOString()}];
T.structures=[{id:501,group_id:2,user_id:"u4",kind:"cassure",lat:44.2003,lon:0.6004,note:"de 2 à 6 m",created_at:new Date(Date.now()-50*36e5).toISOString()},{id:502,group_id:2,user_id:"u2",kind:"bois",lat:44.2005,lon:0.6006,note:"gros chêne couché",created_at:new Date(Date.now()-40*36e5).toISOString()},{id:503,group_id:2,user_id:"u3",kind:"herbier",lat:44.205,lon:0.62,note:null,created_at:new Date(Date.now()-30*36e5).toISOString()},{id:504,group_id:2,user_id:"u4",kind:"fosse",lat:44.18,lon:0.57,note:"8 m",created_at:new Date(Date.now()-20*36e5).toISOString()},{id:505,group_id:2,user_id:"u4",kind:"arrivee",lat:44.215,lon:0.615,note:"ruisseau",created_at:new Date(Date.now()-10*36e5).toISOString()}];
(function(){
  const C=(dp,water,phase,cloud,wind,clarity)=>({dp,water,phase,cloud,wind,rain:0,clarity,air:14,hour:8});
  const brochets=[C(-2,11,"aube",80,10,"teintee"),C(-1.5,12,"aube",70,6,"teintee"),C(-1.2,13,"jour",90,12,"teintee"),C(0.2,10,"crep",40,9,"claire"),C(-2.5,11.5,"aube",75,14,"trouble"),C(-1.8,9,"jour",85,5,"teintee")];
  brochets.forEach((c,i)=>T.posts.push({id:900+i,group_id:2,user_id:"u4",status:"published",caption:"",species:"Brochet",length_cm:60+i*4,weight_kg:null,photo_path:null,photo_paths:null,conditions:c,created_at:new Date(Date.now()-(i+3)*864e5).toISOString(),spots:null}));
  T.sessions.push({id:950,group_id:2,user_id:"u4",species:"Brochet",caught:false,rating:1,conditions:C(1.5,16,"jour",10,22,"claire"),created_at:new Date(Date.now()-12*864e5).toISOString()},{id:951,group_id:2,user_id:"u4",species:"Brochet",caught:false,rating:2,conditions:C(0.5,15,"jour",20,18,"claire"),created_at:new Date(Date.now()-14*864e5).toISOString()});
  // la trace d'hier recouvre une prise avec photo
  T.posts.push({id:960,group_id:2,user_id:"u4",status:"published",caption:"",species:"Sandre",length_cm:63,weight_kg:2.2,released:true,photo_path:"2/u4/ph1.jpg",photo_paths:["2/u4/ph1.jpg"],conditions:{water:12.1,air:13,wind:9,cloud:70,rain:0},created_at:new Date(Date.now()-28*36e5).toISOString(),spots:null});
})();
let nextId=100;
(function(){ const f=o=>{ const d=new Date(); const x=new Date(Date.UTC(d.getFullYear(),d.getMonth()+o,1)); return x.toISOString().slice(0,10); }; T.photo_votes.forEach(v=>{ v.month=v.month==="__CUR__"?f(0):f(-1); }); })();
function withProfiles(r){ return r.user_id&&P[r.user_id]?{...r,profiles:P[r.user_id]}:r; }
function q(table){
  let f=[], op="select", payload=null, single=false, maybe=false, head=false, order=[], lim=null, upsert=false;
  const b={
    select(cols,o){ if(o&&o.head) head=true; return b; },
    eq(k,v){ f.push(r=>r[k]===v); return b; }, neq(k,v){ f.push(r=>r[k]!==v); return b; },
    gt(k,v){ f.push(r=>r[k]>v); return b; }, gte(k,v){ f.push(r=>r[k]>=v); return b; }, lt(k,v){ f.push(r=>r[k]<v); return b; }, lte(k,v){ f.push(r=>r[k]<=v); return b; }, ilike(k,v){ const s=String(v).toLowerCase(); f.push(r=>/%/.test(s)?String(r[k]||"").toLowerCase().includes(s.replace(/%/g,"")):String(r[k]||"").toLowerCase()===s); return b; }, is(k,v){ f.push(r=>(r[k]??null)===v); return b; }, not(k,o,v){ f.push(r=>(r[k]??null)!==v); return b; },
    or(){ return b; }, not(k,o,v){ f.push(r=>r[k]!=null); return b; }, is(k,v){ f.push(r=>r[k]==v); return b; },
    in(k,v){ f.push(r=>v.includes(r[k])); return b; },
    order(k,o){ order.push([k,o?.ascending!==false]); return b; }, limit(n){ lim=n; return b; },
    range(a,z){ if(a>0) f.push(()=>false); lim=z-a+1; return b; },
    insert(p){ op="insert"; payload=p; return b; }, update(p){ op="update"; payload=p; return b; }, delete(){ op="delete"; return b; },
    upsert(p){ op="insert"; payload=p; upsert=true; return b; },
    single(){ single=true; return b; }, maybeSingle(){ maybe=true; return b; },
    then(res,rej){ return Promise.resolve(run()).then(res,rej); }
  };
  function run(){
    const rows=T[table]||[];
    if(op==="insert"&&/offline_ins/.test(location.search)&&!["notifications","push_subs"].includes(table)) return {data:null,error:{message:"TypeError: Failed to fetch"}};
    if(op==="insert"){ const r={id:nextId++,token:'11111111-2222-3333-4444-555555555555',created_at:new Date().toISOString(),started_at:new Date().toISOString(),at:new Date().toISOString(),...payload};
      if(upsert){ const i=rows.findIndex(x=>x.poll_id===r.poll_id&&x.outing_id===r.outing_id&&x.user_id===r.user_id); if(i>=0){ rows[i]={...rows[i],...payload}; return {data:rows[i],error:null}; } }
      if(table==="posts"){ const g=T.groups.find(g=>g.id===r.group_id); const role=T.memberships.find(m=>m.group_id===r.group_id&&m.user_id===ME.id)?.role; r.status=g.post_approval&&role==="member"?"pending":"published"; }
      rows.unshift(r); return {data:single?r:[r],error:null}; }
    if(table==='post_shares'&&op==='insert'){}
    let out=rows.filter(r=>f.every(fn=>fn(r)));
    if(op==="update"){ out.forEach(r=>Object.assign(r,payload)); return {data:out,error:null}; }
    if(op==="delete"){ T[table]=rows.filter(r=>!out.includes(r)); return {data:null,error:null}; }
    for(const [k,asc] of order.slice().reverse()) out=out.slice().sort((a,b)=>(a[k]>b[k]?1:a[k]<b[k]?-1:0)*(asc?1:-1));
    if(lim) out=out.slice(0,lim);
    if(head) return {count:out.length,error:null};
    out=out.map(withProfiles);
    if(table==="carp_sessions") out=out.map(r=>({...r,carp_events:T.carp_events.filter(e=>e.session_id===r.id),spots:T.spots.find(x=>x.id===r.spot_id)||null}));
    if(table==="profiles") out=(f.length?Object.values(P).filter(p=>f.every(fn=>fn(p))):[ME]);
    if(single||maybe) return {data:out[0]||null,error:null};
    return {data:out,error:null};
  }
  return b;
}
function stats(g){ const ms=T.memberships.filter(m=>m.group_id===g.id); return {...g,invite_code:g.id===1?"CODE-47":"FLOAT-46-XYZ",
  my_role:ME.is_admin?"admin":(ms.find(m=>m.user_id===ME.id)?.role),members:ms.filter(m=>m.status==="active").length,pending_members:ms.filter(m=>m.status==="pending").length,
  posts:T.posts.filter(p=>p.group_id===g.id&&p.status==="published").length,pending_posts:T.posts.filter(p=>p.group_id===g.id&&p.status==="pending").length,spots:0}; }
window.supabase={createClient(){return{
  auth:{getSession:()=>Promise.resolve({data:{session:/nosession/.test(location.search)&&!window.__in?null:{user:{id:ME.id}}}}),onAuthStateChange(cb){ window.__authcb=cb; },signOut:()=>Promise.resolve(),
    getUser:()=>Promise.resolve({data:{user:{id:ME.id,email:window.__email||ME.username.toLowerCase()+"@coupdujour.app"}}}),
    signUp:(o)=>{ window.__signup=o; if(/confirm/.test(location.search)) return Promise.resolve({data:{user:{},session:null},error:null}); window.__in=true; return Promise.resolve({data:{user:{id:ME.id},session:{}},error:null}); },
    signInWithPassword:(o)=>{ window.__signin=o; if(o.password==="mauvais") return Promise.resolve({error:{message:"Invalid login credentials"}}); window.__in=true; return Promise.resolve({data:{},error:null}); },
    resetPasswordForEmail:(e,o)=>{ window.__reset=[e,o]; return Promise.resolve({data:{},error:null}); },
    updateUser:(o)=>{ window.__upd=o; if(o.email) window.__email=o.email; return Promise.resolve({data:{user:{email:o.email||window.__email}},error:null}); }},
  from:q,
  rpc:(n,a)=>{
    if(n==="log_client_error"){ (window.__errs=window.__errs||[]).push(a); return Promise.resolve({data:null,error:null}); }
    if(n==="timeout_schema_version") return Promise.resolve({data:"0008",error:null});
    if(n==="set_fish_styles"){ window.__styles=a.p_styles; ME.fish_styles=a.p_styles; return Promise.resolve({data:null,error:null}); }
    if(n==="dm_threads") return Promise.resolve({data:[{other:"u4",username:"marco_47",last_body:"Salut ! Tu viens samedi au lac ?",last_at:new Date().toISOString(),last_mine:false,unread:1}],error:null});
    if(n==="dm_mark_read"){ T.direct_messages.forEach(m=>{ if(m.to_user===ME.id) m.read_at=new Date().toISOString(); }); return Promise.resolve({data:null,error:null}); }
    if(n==="my_group_month") return Promise.resolve({data:{month:"2026-10-01",catches:9,species:4,anglers:3,messages:42,biggest:{username:"marco_47",species:"Brochet",length_cm:92},top:{username:"alice",n:4}},error:null});
    if(n==="list_mentors") return Promise.resolve({data:[{id:"u4",username:"marco_47",fish_styles:["carnassier"],bio:"Brochet et silure en float-tube",mentees:1}],error:null});
    if(n==="referral_count") return Promise.resolve({data:a.p_user==="u4"?6:a.p_user===ME.id?2:0,error:null});
    if(n==="set_referrer"){ window.__ref=a.p_username; return Promise.resolve({data:true,error:null}); }
    if(n==="track_screen"){ (window.__track=window.__track||[]).push(a.p_screen); return Promise.resolve({data:null,error:null}); }
    if(n==="usage_stats") return Promise.resolve({data:{dau:2,wau:3,mau:3,users:3,new_7d:1,retention:67,daily:Array.from({length:30},(_,i)=>({day:new Date(Date.now()-(29-i)*864e5).toISOString().slice(0,10),n:[0,1,2,1,3,2,2][i%7]})),screens:[{screen:"fil",n:42},{screen:"conseils",n:31},{screen:"carte",n:18},{screen:"profil-reglages",n:5}]},error:null});
    if(n==="inactive_accounts") return Promise.resolve({data:[],error:null});
    if(n==="backup_list") return Promise.resolve({data:[{snap:"2026-11-01",tables:52,rows:1840},{snap:"2026-10-25",tables:48,rows:1702}],error:null});
    if(n==="backup_export"){ window.__exp=a.p_snap; return Promise.resolve({data:{profiles:[{id:"u1"}]},error:null}); }
    if(n==="backup_now") return Promise.resolve({data:null,error:null});
    if(n==="export_my_data"){ window.__mine=true; return Promise.resolve({data:{profile:{id:ME.id},posts:[]},error:null}); }
    if(n==="warn_member"){ window.__warned=a; return Promise.resolve({data:null,error:null}); }
    if(n==="member_record") return Promise.resolve({data:{warnings:1,timeouts:0,next:"1440",history:[]},error:null});
    if(n==="app_health") return Promise.resolve({data:{errors_24h:3,errors_7d:7,top_errors:[{message:"TypeError: Cannot read properties of null (reading 'lat')",n:5,last_at:new Date().toISOString(),version:"0.68",screen:"#carte",users:2},{message:"Promesse rejetée : Failed to fetch",n:2,last_at:new Date().toISOString(),version:"0.68",screen:"#fil",users:1}],notify_calls:42,notify_failed:[],push_ok:58,push_bad:1,cron:[{job:"cdj-alerte-matin",schedule:"0 5 * * *",active:true,last:{status:"succeeded",at:new Date().toISOString()},failed_24h:0},{job:"cdj-orage",schedule:"*/15 * * * *",active:true,last:{status:"failed",at:new Date().toISOString(),msg:"ERROR: timeout"},failed_24h:2}],counts:{users:3,push_users:2,groups:3,posts_7d:4,messages_7d:18,reports_open:1,appeals_open:0,timeouts_active:0}},error:null});
    const mod=g=>ME.is_admin||["owner","moderator"].includes(T.memberships.find(m=>m.group_id===g&&m.user_id===ME.id&&m.status==="active")?.role);
    if(n==="peek_invite") return Promise.resolve({data:a.p_token==="T".repeat(32)?[{name:"Float-tube 47",require_approval:false,full_group:false}]:[],error:null});
    if(n==="redeem_invite"){ window.__redeemed=a.p_token; if(a.p_token!=="T".repeat(32)) return Promise.resolve({data:null,error:{message:"invitation expirée ou invalide"}}); if(!T.memberships.some(m=>m.group_id===2&&m.user_id===ME.id)) T.memberships.push({group_id:2,user_id:ME.id,role:"member",status:"active",created_at:new Date().toISOString()}); return Promise.resolve({data:2,error:null}); }
    if(n==="set_env_status"){ const r=T.env_reports.find(x=>x.id===a.p_id); if(r) r.status=a.p_status; return Promise.resolve({data:null,error:null}); }
    if(n==="set_spot_facing"){ const sp=T.spots.find(x=>x.id===a.p_id); if(sp) sp.facing=a.p_facing; window.__facing=a.p_facing; return Promise.resolve({data:null,error:null}); }
    if(n==="username_available") return Promise.resolve({data:!/^roby_admin$/i.test(a.p_username),error:null});
    if(n==="check_invite") return Promise.resolve({data:a.p_code==="FLOAT-46-XYZ"?[{name:"Float-tube 47",region:null,require_approval:false,full_group:false}]:[],error:null});
    if(n==="create_profile"){ window.__created=a.p_username; return Promise.resolve({data:null,error:null}); }
    if(n==="delete_my_account"){ window.__deleted=true; return Promise.resolve({data:null,error:null}); }
    if(n==="vote_photo"){ const p=T.posts.find(x=>x.id===a.p_post); const d=new Date(); const m=new Date(Date.UTC(d.getFullYear(),d.getMonth(),1)).toISOString().slice(0,10); const i=T.photo_votes.findIndex(v=>v.month===m&&v.user_id===ME.id&&v.group_id===p.group_id); if(i>=0&&T.photo_votes[i].post_id===p.id){ T.photo_votes.splice(i,1); return Promise.resolve({data:"retire",error:null}); } if(i>=0) T.photo_votes.splice(i,1); T.photo_votes.push({group_id:p.group_id,month:m,user_id:ME.id,post_id:p.id}); return Promise.resolve({data:"ok",error:null}); }
    if(n==="manage_groups") return Promise.resolve({data:T.groups.filter(g=>mod(g.id)).map(stats)});
    if(n==="manage_members") return Promise.resolve({data:T.memberships.filter(m=>m.group_id===a.p_group).map(m=>({...m,username:P[m.user_id].username,is_admin:P[m.user_id].is_admin,joined_at:iso(100*H)}))});
    if(n==="update_spot_sheet"){ Object.assign(T.spots.find(x=>x.id===a.p_id),{depth_m:a.p_depth,distance_tours:a.p_tours,bottom:a.p_bottom,details:a.p_details}); }
    if(n==="list_controllers") return Promise.resolve({data:[{username:"alice"}],error:null});
    if(n==="update_my_profile"){ Object.assign(ME,{bio:a.p_bio,fav_species:a.p_fav,avatar_path:a.p_avatar}); }
    if(n==="approve_member"){ T.memberships.find(m=>m.group_id===a.p_group&&m.user_id===a.p_user).status="active"; }
    if(n==="approve_post"){ T.posts.find(p=>p.id===a.p_id).status="published"; }
    if(n==="set_member_role"){ T.memberships.find(m=>m.group_id===a.p_group&&m.user_id===a.p_user).role=a.p_role; }
    if(n==="set_group_options"){ const g=T.groups.find(g=>g.id===a.p_id); g.require_approval=a.p_require_approval; g.post_approval=a.p_post_approval; }
    return Promise.resolve({data:null,error:null}); },
  channel:()=>{ const c={on(){return c;},subscribe(){return c;}}; return c; }, removeChannel(){},
  storage:{from:()=>({list:()=>Promise.resolve({data:[{name:"a.jpg",id:"1"}]}),getPublicUrl:p=>({data:{publicUrl:"_t/"+p.split("/").pop()}}),createSignedUrls:(ps)=>Promise.resolve({data:ps.map(p=>({path:p,signedUrl:"_t/"+p.split("/").pop()}))}),remove:()=>Promise.resolve({}),upload:()=>Promise.resolve({error:null})})}
}}};
})();
