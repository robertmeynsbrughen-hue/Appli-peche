// Coup du Jour : fiches nœuds et montages (hors ligne).
(function(){
"use strict";
const A=window.CDJ; if(!A) return;
const {el}=A;
const $=s=>document.querySelector(s);
function btn(label,cls,fn){ const b=el("button",cls||"btn",label); b.type="button"; if(fn) b.addEventListener("click",fn); return b; }

// schémas simples (SVG) : ligne, hameçon, leurre
const HOOK='<path d="M70 20 V70 a18 18 0 0 1 -36 0 V58" fill="none" stroke="var(--fg)" stroke-width="4" stroke-linecap="round"/><path d="M34 58 l-7 9 M34 58 l7 7" stroke="var(--fg)" stroke-width="3" stroke-linecap="round"/><circle cx="70" cy="14" r="6" fill="none" stroke="var(--fg)" stroke-width="3"/>';
const LINE='stroke="var(--accent)" stroke-width="3" fill="none" stroke-linecap="round"';
const SVG={
  palomar:'<svg viewBox="0 0 220 110"><g transform="translate(110 0)">'+HOOK+'</g><path d="M10 20 C60 20 120 8 176 14" '+LINE+'/><path d="M10 30 C60 30 120 22 176 14" '+LINE+'/><ellipse cx="165" cy="16" rx="12" ry="9" '+LINE+'/><path d="M150 8 C140 30 200 30 188 8" '+LINE+' stroke-dasharray="4 4"/></svg>',
  uni:'<svg viewBox="0 0 220 80"><path d="M5 30 H215" stroke="var(--amber)" stroke-width="3"/><path d="M5 46 H215" '+LINE+'/><g fill="none" stroke="var(--amber)" stroke-width="3">'+[0,1,2,3,4,5].map(i=>'<ellipse cx="'+(60+i*9)+'" cy="38" rx="4" ry="12"/>').join("")+'</g><g fill="none" stroke="var(--accent)" stroke-width="3">'+[0,1,2,3].map(i=>'<ellipse cx="'+(140+i*9)+'" cy="38" rx="4" ry="12"/>').join("")+'</g><text x="70" y="70" font-size="11" fill="var(--muted)">tresse 8 tours</text><text x="132" y="70" font-size="11" fill="var(--muted)">fluoro 4 tours</text></svg>',
  cheveu:'<svg viewBox="0 0 220 120"><g transform="translate(70 0)">'+HOOK+'</g><g fill="none" stroke="var(--accent)" stroke-width="3">'+[0,1,2,3,4,5,6].map(i=>'<ellipse cx="140" cy="'+(28+i*6)+'" rx="7" ry="2.5"/>').join("")+'</g><path d="M140 70 C140 100 150 104 165 100" '+LINE+'/><circle cx="178" cy="100" r="13" fill="var(--amber)"/><path d="M140 14 V0" '+LINE+'/><text x="150" y="60" font-size="11" fill="var(--muted)">7 à 9 tours</text></svg>',
  texas:'<svg viewBox="0 0 240 90"><path d="M5 40 H70" '+LINE+'/><path d="M58 40 l-14 -9 v18 z" fill="var(--muted)"/><circle cx="76" cy="40" r="5" fill="var(--amber)"/><path d="M90 40 H120" '+LINE+'/><path d="M118 32 C160 22 210 28 232 40 C210 52 160 58 118 48 Z" fill="var(--amber)" opacity=".75"/><path d="M122 40 l10 -6 v20 C160 60 170 52 168 44" stroke="var(--fg)" stroke-width="3" fill="none"/><text x="20" y="70" font-size="11" fill="var(--muted)">balle + perle</text><text x="150" y="80" font-size="11" fill="var(--muted)">pointe cachée</text></svg>',
  dropshot:'<svg viewBox="0 0 160 160"><path d="M80 0 V140" '+LINE+'/><path d="M80 50 h20" stroke="var(--fg)" stroke-width="3"/><path d="M100 50 a8 8 0 0 1 -6 14" stroke="var(--fg)" stroke-width="3" fill="none"/><path d="M100 44 C130 40 150 48 152 56 C150 62 130 64 100 56 Z" fill="var(--amber)" opacity=".8"/><ellipse cx="80" cy="146" rx="7" ry="10" fill="var(--muted)"/><path d="M60 54 V140" stroke="var(--muted)" stroke-dasharray="3 4"/><text x="8" y="100" font-size="11" fill="var(--muted)">20–50 cm</text></svg>',
  albright:'<svg viewBox="0 0 240 90"><path d="M5 38 H150 C182 38 182 58 150 58 H96" stroke="var(--amber)" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M235 48 H156" '+LINE+'/><g fill="none" stroke="var(--accent)" stroke-width="3">'+[0,1,2,3,4,5,6,7,8,9].map(i=>'<ellipse cx="'+(104+i*5)+'" cy="48" rx="2.6" ry="14"/>').join("")+'</g><path d="M104 48 C96 70 160 76 164 50" '+LINE+' stroke-dasharray="4 4"/><text x="8" y="78" font-size="11" fill="var(--muted)">gros fil : boucle</text><text x="120" y="86" font-size="11" fill="var(--muted)">fil fin : 10 à 12 tours</text></svg>',
  bases:'<svg viewBox="0 0 260 100"><g transform="translate(150 0)">'+HOOK+'</g><circle cx="30" cy="40" r="20" fill="none" stroke="var(--accent)" stroke-width="3"/><circle cx="30" cy="40" r="8" fill="none" stroke="var(--accent)" stroke-width="2"/><path d="M70 18 L110 62" stroke="var(--fg)" stroke-width="3" stroke-linecap="round"/><path d="M104 56 l10 10" stroke="var(--fg)" stroke-width="2"/><circle cx="240" cy="40" r="11" fill="var(--amber)"/><text x="6" y="88" font-size="11" fill="var(--muted)">fil</text><text x="64" y="88" font-size="11" fill="var(--muted)">aiguille</text><text x="160" y="98" font-size="11" fill="var(--muted)">hameçon</text><text x="224" y="70" font-size="11" fill="var(--muted)">appât</text></svg>',
  combi:'<svg viewBox="0 0 260 142"><g transform="translate(120 16)">'+HOOK+'</g><rect x="4" y="25" width="16" height="10" rx="4" fill="var(--muted)"/><path d="M20 30 H130" stroke="var(--fg)" stroke-width="5" stroke-linecap="round" opacity=".7"/><path d="M130 30 C160 30 175 26 190 30" '+LINE+' stroke-dasharray="3 3"/><path d="M172 102 V118" '+LINE+'/><circle cx="172" cy="129" r="11" fill="var(--amber)"/><text x="40" y="20" font-size="11" fill="var(--muted)">tresse gainée</text><text x="128" y="20" font-size="11" fill="var(--muted)">souple</text><text x="190" y="122" font-size="11" fill="var(--muted)">cheveu</text></svg>',
  drig:'<svg viewBox="0 0 260 120"><g transform="translate(120 16)">'+HOOK+'</g><path d="M10 30 H184" stroke="var(--fg)" stroke-width="4" stroke-linecap="round" opacity=".7"/><path d="M196 30 C212 46 212 70 196 82" '+LINE+'/><circle cx="208" cy="56" r="5" fill="none" stroke="var(--fg)" stroke-width="2.5"/><path d="M212 54 L234 30" stroke="var(--muted)" stroke-width="2"/><circle cx="238" cy="22" r="12" fill="var(--amber)"/><text x="20" y="50" font-size="11" fill="var(--muted)">fluoro rigide</text><text x="214" y="100" font-size="11" fill="var(--muted)">le D</text><text x="196" y="10" font-size="11" fill="var(--muted)">pop-up</text></svg>',
  chod:'<svg viewBox="0 0 260 120"><g transform="translate(140 22)">'+HOOK+'</g><path d="M5 100 H120" stroke="var(--muted)" stroke-width="4"/><ellipse cx="18" cy="100" rx="12" ry="8" fill="var(--muted)"/><circle cx="70" cy="100" r="5" fill="var(--amber)"/><circle cx="110" cy="100" r="5" fill="var(--amber)"/><circle cx="90" cy="100" r="5" fill="none" stroke="var(--fg)" stroke-width="2.5"/><path d="M90 95 C100 60 150 30 206 36" stroke="var(--fg)" stroke-width="4" fill="none" opacity=".7"/><circle cx="214" cy="52" r="5" fill="none" stroke="var(--fg)" stroke-width="2.5"/><path d="M216 48 L236 22" stroke="var(--muted)" stroke-width="2"/><circle cx="240" cy="16" r="12" fill="var(--amber)"/><text x="40" y="118" font-size="11" fill="var(--muted)">perles + plomb</text><text x="40" y="62" font-size="11" fill="var(--muted)">5 à 8 cm</text></svg>',
  ronnie:'<svg viewBox="0 -14 260 134"><g transform="translate(120 20)">'+HOOK+'</g><path d="M10 34 H176" stroke="var(--fg)" stroke-width="4" opacity=".7" stroke-linecap="round"/><rect x="183" y="34" width="14" height="18" rx="4" fill="var(--muted)"/><path d="M190 34 V18" stroke="var(--fg)" stroke-width="2.5"/><circle cx="190" cy="14" r="5" fill="none" stroke="var(--fg)" stroke-width="2.5"/><path d="M194 10 L220 -2" stroke="var(--muted)" stroke-width="2"/><circle cx="226" cy="10" r="12" fill="var(--amber)"/><text x="206" y="50" font-size="11" fill="var(--muted)">gaine</text><text x="20" y="54" font-size="11" fill="var(--muted)">émerillon rapide sur la hampe</text></svg>',
  zig:'<svg viewBox="0 0 200 160"><path d="M10 150 H190" stroke="var(--muted)" stroke-width="2" stroke-dasharray="6 5"/><path d="M10 10 H190" stroke="var(--accent-2)" stroke-width="2" opacity=".6"/><ellipse cx="40" cy="146" rx="12" ry="8" fill="var(--muted)"/><path d="M5 120 L40 140" '+LINE+'/><path d="M40 140 V46" '+LINE+' stroke-dasharray="2 4"/><g transform="translate(-10 22) scale(.6)">'+HOOK+'</g><rect x="22" y="22" width="14" height="10" rx="3" fill="var(--amber)"/><text x="54" y="96" font-size="11" fill="var(--muted)">bas de ligne long</text><text x="54" y="110" font-size="11" fill="var(--muted)">(1 à 4 m)</text><text x="54" y="34" font-size="11" fill="var(--muted)">mousse flottante</text><text x="100" y="146" font-size="11" fill="var(--muted)">fond</text><text x="110" y="24" font-size="11" fill="var(--muted)">surface</text></svg>',
  helico:'<svg viewBox="0 0 260 132"><path d="M5 30 H220" '+LINE+'/><ellipse cx="232" cy="30" rx="14" ry="10" fill="var(--muted)"/><circle cx="110" cy="30" r="5" fill="var(--amber)"/><circle cx="160" cy="30" r="5" fill="var(--amber)"/><circle cx="135" cy="30" r="5" fill="none" stroke="var(--fg)" stroke-width="2.5"/><path d="M135 35 C135 60 150 70 158 76" stroke="var(--fg)" stroke-width="3" fill="none"/><g transform="translate(96 60) scale(.6)">'+HOOK+'</g><text x="90" y="16" font-size="11" fill="var(--muted)">butées</text><text x="212" y="56" font-size="11" fill="var(--muted)">plomb</text><text x="10" y="128" font-size="11" fill="var(--muted)">le bas de ligne tourne autour de la ligne</text></svg>',
  clip:'<svg viewBox="0 0 240 100"><path d="M5 30 H120" '+LINE+'/><rect x="100" y="24" width="40" height="12" rx="6" fill="var(--muted)"/><path d="M140 30 H170" stroke="var(--fg)" stroke-width="3"/><circle cx="174" cy="30" r="5" fill="none" stroke="var(--fg)" stroke-width="3"/><path d="M179 30 C200 30 210 40 214 60" '+LINE+'/><ellipse cx="118" cy="62" rx="12" ry="18" fill="var(--muted)" opacity=".8"/><path d="M118 36 V44" stroke="var(--fg)" stroke-width="2"/><circle cx="220" cy="78" r="10" fill="var(--amber)"/><text x="80" y="96" font-size="11" fill="var(--muted)">plomb 80–120 g</text></svg>',
};
const KNOTS=[
  {id:"palomar",cat:"general",t:"Nœud Palomar",use:"Le nœud de base pour attacher un leurre, un émerillon ou un hameçon. Très solide, en tresse comme en nylon.",lvl:"Facile",steps:[
    "Double 15 cm de fil et passe la boucle dans l'œillet.",
    "Fais un nœud simple, sans serrer, avec le fil doublé.",
    "Passe le leurre (ou l'hameçon) entier dans la boucle.",
    "Humidifie, puis tire sur les deux brins : la boucle glisse au-dessus de l'œillet et le nœud se serre.",
    "Coupe le brin mort à 2–3 mm."],tip:"Avec un gros leurre, préfère un émerillon agrafe : passer le leurre dans la boucle devient difficile."},
  {id:"uni",cat:"general",t:"Raccord tresse–fluoro (double Uni)",use:"Pour relier la tresse du moulinet à un bas de ligne en fluorocarbone ou en nylon.",lvl:"Moyen",steps:[
    "Fais se chevaucher les deux fils sur 20 cm.",
    "Avec la tresse : forme une boucle le long du fluoro et fais 8 tours autour des deux fils, à l'intérieur de la boucle.",
    "Serre à moitié en tirant le bout de la tresse.",
    "Avec le fluoro : même chose autour de la tresse, 4 tours.",
    "Humidifie et tire sur les deux grands brins : les deux nœuds glissent l'un contre l'autre.",
    "Coupe les deux brins à ras (2 mm)."],tip:"Plus de tours avec la tresse (8 à 10) qu'avec le fluoro (4 à 5) : la tresse fine glisse facilement."},
  {id:"albright",cat:"general",t:"Nœud Albright",use:"Pour relier deux fils de diamètres très différents : tresse fine sur gros fluoro, nylon sur bas de ligne épais, ou tresse sur fil acier souple. Fin, il passe bien dans les anneaux.",lvl:"Moyen",steps:[
    "Avec le gros fil (bas de ligne), forme une boucle d'environ 5 cm : replie-le sur lui-même.",
    "Passe le fil fin dans la boucle sur 15 cm, par le côté du brin court.",
    "Pince la boucle et le fil fin entre le pouce et l'index, près du coude.",
    "Enroule le fil fin 10 à 12 fois autour des deux brins de la boucle et autour de lui-même, en avançant vers le bout de la boucle. Tours serrés et bien jointifs.",
    "Ressors le bout du fil fin par la boucle, du même côté que celui par où il est entré.",
    "Humidifie, puis tire doucement le fil fin pour tasser les spires, sans qu'elles glissent hors de la boucle.",
    "Tire fermement sur les deux grands brins, puis coupe les deux bouts à 2 mm."],tip:"Avec de la tresse très fine, double-la sur les 15 cm avant de faire les tours : le nœud tient beaucoup mieux."},
  {id:"bases",cat:"carpe",t:"Les bases du bas de ligne carpe",e:"🧰",use:"Le matériel à avoir et les règles communes à tous les bas de ligne : avec ça, tu peux fabriquer tous les montages de cette section.",lvl:"À lire d'abord",mat:["Tresse souple 15 à 25 lb","Tresse gainée 20 à 25 lb","Fluorocarbone rigide 20 à 30 lb (chod, D-rig)","Hameçons carpe n°4 à 8 (courbés, droits, chod)","Émerillons taille 8 ou 11, bagues métal (rig rings)","Aiguille à appât, stops à bouillette, gaine thermo et line-aligners","Ciseaux à tresse, briquet, plomb de lestage (pâte de tungstène)"],steps:[
    "Longueur : 15 à 25 cm pour la plupart des montages. Court (5 à 10 cm) sur fond encombré ou pour le chod, long (25 à 35 cm) sur fond vaseux.",
    "Matière : tresse souple pour un appât très libre, tresse gainée pour éviter les emmêlements au lancer, fluoro rigide pour présenter une pop-up au-dessus des débris.",
    "Hameçon : sa taille suit l'appât. Bouillette de 15 mm → n°6 ou 8. Bouillette de 20 mm et plus → n°4 ou 5. Pointe toujours piquante : teste-la sur l'ongle, elle doit accrocher.",
    "Cheveu : l'appât pend à environ 1 cm sous la courbure de l'hameçon, ou un peu moins pour une pop-up.",
    "Lest : une petite boule de pâte de tungstène à 2 ou 3 cm de l'hameçon plaque le bas de ligne au fond.",
    "Test dans la main : pose le bas de ligne sur ta paume et tire doucement par l'émerillon. L'hameçon doit se retourner et piquer la peau : s'il glisse à plat, revois le réglage.",
    "Prépare-les à la maison : 5 ou 6 bas de ligne d'avance, rangés à plat dans un rig-board, font gagner du temps au bord de l'eau."],tip:"Contrôle chaque bas de ligne après une prise ou un accrochage : une tresse abîmée ou une pointe émoussée, et tu le remplaces."},
  {id:"cheveu",cat:"carpe",t:"Bas de ligne cheveu (nœud sans nœud)",use:"Le montage carpe classique : l'appât pend sous l'hameçon, la carpe aspire et se pique seule.",lvl:"Moyen",steps:[
    "Fais une petite boucle au bout du bas de ligne (nœud en huit) : c'est le cheveu.",
    "Passe l'autre bout dans l'œillet par l'avant (côté pointe).",
    "Règle le cheveu : l'appât doit pendre à 1 cm environ sous la courbure.",
    "Enroule 7 à 9 tours serrés autour de la hampe, vers la courbure, en recouvrant le cheveu.",
    "Repasse le fil dans l'œillet par l'avant, puis tire pour serrer.",
    "Enfile la bouillette à l'aiguille et bloque-la avec un stop."],tip:"Un cheveu trop long fait rater les touches, trop court la carpe recrache l'hameçon : ajuste selon la taille de l'appât."},
  {id:"texas",cat:"general",t:"Montage Texas",use:"Le leurre souple anti-accroche pour pêcher dans les herbiers, le bois et les cailloux.",lvl:"Facile",steps:[
    "Enfile une balle (plomb « bullet ») pointe vers le leurre, puis une perle si tu veux du bruit.",
    "Noue un hameçon texan (offset) au Palomar.",
    "Pique la pointe dans le nez du leurre sur 1 cm et ressors-la par le dessous.",
    "Fais glisser le leurre jusqu'au coude de l'hameçon : la tête tient sur l'offset.",
    "Repique la pointe dans le corps du leurre, juste affleurante : elle ne s'accroche plus, mais ferre bien.",
    "Bloque la balle avec un stop-float si tu veux qu'elle reste contre le leurre."],tip:"Balle de 5 à 7 g en bordure, 10 à 20 g pour traverser les herbiers épais ou pêcher profond."},
  {id:"dropshot",cat:"general",t:"Drop-shot",use:"Pour pêcher la perche ou le sandre juste au-dessus du fond, en animant sur place.",lvl:"Facile",steps:[
    "Noue l'hameçon drop-shot au Palomar en gardant un long brin de 30 à 60 cm.",
    "Repasse ce long brin dans l'œillet par le haut : la pointe se retrouve tournée vers le haut.",
    "Fixe le plomb drop-shot en bas du brin, 20 à 50 cm sous l'hameçon selon la hauteur visée.",
    "Pique le leurre par le nez seulement.",
    "Pêche fil tendu, plomb au fond : fais vibrer le scion sans déplacer le plomb."],tip:"Poissons collés au fond : 15–20 cm. Poissons suspendus vus au sondeur : jusqu'à 60 cm."},
  {id:"combi",cat:"carpe",t:"Combi-rig",use:"Un bas de ligne en deux matières : tresse gainée côté plomb, qui ne s'emmêle pas, et tresse souple côté hameçon, qui laisse l'appât bouger librement. Polyvalent, il marche presque partout.",lvl:"Moyen",mat:["25 cm de tresse gainée 20 à 25 lb","10 cm de tresse souple 15 à 20 lb","Hameçon courbé n°4 à 6","Émerillon taille 8","Stop à bouillette, pâte de tungstène"],steps:[
    "Coupe 20 cm de tresse gainée et 10 cm de tresse souple.",
    "Relie les deux par un nœud Albright, ou par deux boucles en huit emboîtées : la section souple fera 5 à 8 cm une fois finie.",
    "Au bout de la tresse souple, fais une petite boucle (nœud en huit) : c'est le cheveu.",
    "Monte l'hameçon au nœud sans nœud (voir la fiche « Bas de ligne cheveu »), avec 7 à 8 tours sur la hampe.",
    "Mets une gaine thermo ou un line-aligner sur l'œillet pour que l'hameçon se retourne vite.",
    "À l'autre bout, noue l'émerillon (Palomar ou nœud grinner) et dénude 1 cm de gaine juste avant pour que le nœud serre bien.",
    "Pose une petite boule de pâte de tungstène juste au-dessus du raccord, puis teste le retournement dans la main."],tip:"Pas de tresse souple sous la main ? Dénude simplement 3 à 5 cm de gaine côté hameçon avec l'ongle : c'est le « stripped rig », presque aussi efficace."},
  {id:"drig",cat:"carpe",t:"D-rig (pop-up ou bouillette sur bague)",use:"L'appât est fixé sur une bague qui coulisse dans un petit D en dos d'hameçon. La carpe aspire, l'hameçon pivote et pique très vite. Idéal avec une pop-up ou une bouillette équilibrée.",lvl:"Moyen",mat:["20 cm de fluoro rigide 20 à 25 lb (ou tresse gainée)","Hameçon courbé ou droit n°4 à 6","Une petite bague métal (rig ring)","Fil à appât ou vis à pop-up","Briquet"],steps:[
    "Passe le fil dans l'œillet de l'hameçon par l'avant, côté pointe, et laisse dépasser 5 cm.",
    "Fais 7 tours serrés autour de la hampe avec le grand brin, puis repasse-le dans l'œillet par l'avant : c'est un nœud sans nœud sans cheveu.",
    "Le petit brin du départ ressort des spires, le long du dos de la hampe : enfile la bague dessus.",
    "Repasse ce petit brin dans l'œillet par l'arrière vers l'avant pour former un D le long du dos de la hampe. Règle la taille : le D fait environ la moitié de la hampe.",
    "Coupe le brin à 3 mm et fais-le fondre au briquet pour former une boule qui bloque tout.",
    "Fixe la pop-up sur la bague avec du fil à appât ou une vis.",
    "À l'autre bout, noue l'émerillon. Avec du fluoro rigide, redresse le fil à la vapeur (bouilloire) pour qu'il soit bien droit."],tip:"Pose un petit plomb ou de la pâte de tungstène à 1 cm de l'œillet pour que la pop-up tienne juste au-dessus du fond, à 1 ou 2 cm."},
  {id:"chod",cat:"carpe",t:"Chod rig",use:"Un bas de ligne très court et rigide qui coulisse sur le corps de ligne. La pop-up se pose toujours sur les débris, la vase ou les herbes : le montage du fond encombré.",lvl:"Avancé",mat:["10 cm de fil chod (fluoro très rigide 20 à 30 lb)","Hameçon chod à œillet retourné n°4 à 6","Une petite bague métal et un morceau de gaine silicone","Émerillon taille 8 ou bague large","Leadcore ou tresse plombée, 2 perles butoir, plomb éjectable"],steps:[
    "Coupe 8 à 10 cm de fil chod : une fois fini, le bas de ligne fera 5 à 8 cm.",
    "Enfile la bague, puis un petit bout de gaine silicone pour la bloquer.",
    "Passe le fil dans l'œillet par l'avant, fais 4 ou 5 tours de nœud sans nœud autour de la hampe et repasse par l'œillet : la bague reste en dos de hampe, retenue par la gaine.",
    "Brûle le bout au briquet pour faire une boule.",
    "À l'autre bout, forme une petite boucle (nœud en huit ou boucle soudée à la flamme) et passe-la dans un émerillon ou une bague large.",
    "Donne une courbe au fil à la vapeur : le chod doit faire un arc, hameçon tourné vers le haut.",
    "Sur la ligne, enfile une perle butoir, le chod, une seconde perle, puis le plomb. Écarte les perles de 30 cm à 1 m selon la hauteur des débris."],tip:"La perle du haut doit pouvoir glisser si la ligne casse : ne la colle jamais. Le poisson doit pouvoir se libérer du montage."},
  {id:"ronnie",cat:"carpe",t:"Ronnie rig (spinner)",use:"La pop-up est montée sur un émerillon rapide qui tourne autour de la hampe : l'hameçon se retourne dans tous les sens et pique très bien. Excellent sur fond propre ou en légère vase.",lvl:"Moyen",mat:["15 à 20 cm de tresse gainée ou de fluoro","Hameçon courbé à œillet n°4 à 6","Émerillon rapide à bague (ronnie swivel)","Une perle d'hameçon ou un bout de gaine thermo","Vis à pop-up, pâte de tungstène"],steps:[
    "Enfile la petite bague de l'émerillon rapide par la pointe et fais-la remonter jusqu'à l'œillet.",
    "Enfile ensuite une perle d'hameçon (ou un bout de gaine) par la pointe : elle maintient l'émerillon tout près de l'œillet.",
    "L'émerillon doit tourner librement autour de la hampe : vérifie-le avant d'aller plus loin.",
    "Visse la pop-up sur la bague de l'émerillon.",
    "Noue le bas de ligne directement sur l'œillet de l'hameçon (nœud Palomar ou nœud grinner) et l'émerillon de ligne à l'autre bout.",
    "Moule une petite boule de pâte de tungstène sous l'émerillon ou au nœud pour que la pop-up flotte à 2 ou 3 cm du fond."],tip:"Change d'émerillon rapide après quelques prises : sa bague s'ouvre avec le temps et l'appât peut partir au lancer."},
  {id:"zig",cat:"carpe",t:"Zig rig (pêche entre deux eaux)",use:"Un très long bas de ligne fin avec une petite mousse flottante : l'appât se tient à la hauteur choisie, là où les carpes se promènent en été ou par temps doux.",lvl:"Avancé",mat:["Nylon ou fluoro fin 8 à 12 lb, 1 à 4 m","Petit hameçon n°8 à 10 (fil fin)","Mousse flottante (zig foam) noire, jaune ou rouge","Plomb sur clip, émerillon taille 8"],steps:[
    "Mesure la profondeur au marqueur ou au sondeur.",
    "Choisis la hauteur : près de la surface par temps chaud, à mi-profondeur sinon. La longueur du bas de ligne donne la hauteur de l'appât au-dessus du fond : pour commencer, prends la moitié de la profondeur.",
    "Coupe le fil à la longueur choisie, plus 20 cm.",
    "Monte l'hameçon au nœud sans nœud avec un cheveu très court.",
    "Fixe un petit morceau de mousse sur le cheveu : elle doit faire remonter l'hameçon sans tirer trop fort.",
    "Noue l'émerillon au bout et fixe-le au clip plomb.",
    "Lance, laisse le plomb toucher le fond, puis tends doucement la ligne : la mousse monte et se place à la bonne hauteur."],tip:"Pas de touche en 1 h ? Change la hauteur de 50 cm. Les carpes suivent souvent une couche d'eau précise, plus chaude."},
  {id:"helico",cat:"carpe",t:"Montage hélicoptère",use:"Le plomb est en bout de ligne et le bas de ligne tourne autour du corps de ligne, entre deux butées. Il ne s'emmêle presque jamais, même lancé très loin.",lvl:"Moyen",mat:["Leadcore ou tresse plombée","2 butées (perles caoutchouc ou buffer beads)","Émerillon à bague large (helicopter swivel)","Plomb poire ou en goutte","Un bas de ligne au choix"],steps:[
    "Au bout du corps de ligne, monte le plomb sur un émerillon ou une agrafe.",
    "Enfile la butée du bas en la poussant à 5 cm au-dessus du plomb.",
    "Enfile l'émerillon hélicoptère : il doit tourner librement autour de la ligne.",
    "Enfile la butée du haut à 30 cm à 1 m au-dessus : la distance entre les butées règle la hauteur au-dessus des débris.",
    "Accroche ton bas de ligne sur l'émerillon.",
    "Sécurité : la butée du haut ne doit pas être bloquée. Si la ligne casse, l'émerillon doit pouvoir glisser et sortir par le haut."],tip:"Mets la butée du haut à 30 cm sur fond propre, plus haut sur vase ou herbier : le bas de ligne se posera au-dessus."},
  {id:"clip",cat:"carpe",t:"Bas de ligne carpe sur clip plomb",use:"Le montage carpe de sécurité : le plomb se décroche si la ligne casse, le poisson ne reste pas attaché.",lvl:"Moyen",steps:[
    "Enfile un tube anti-emmêlement sur le corps de ligne.",
    "Enfile le clip plomb, puis noue un émerillon au bout du corps de ligne (Palomar).",
    "Enfonce l'émerillon dans le clip jusqu'au blocage.",
    "Accroche le plomb (80 à 120 g) et pousse la queue de clip, sans forcer.",
    "Fixe le bas de ligne (montage cheveu, 15 à 25 cm) sur l'émerillon."],tip:"Ne bloque jamais la queue de clip à fond en zone encombrée : le plomb doit pouvoir partir."},
];

const CATS=[["general","Général","Nœuds de base et montages carnassiers."],["carpe","Carpe","Les bas de ligne carpe : à quoi ils servent et comment les fabriquer."]];
function open(k){
  const back=el("div","sheet-back"); const sh=el("div","sheet knot-sheet"); sh.setAttribute("role","dialog"); sh.setAttribute("aria-modal","true"); sh.setAttribute("aria-label",k.t);
  const head=el("div","sheet-head"); head.append(el("h2",null,k.t)); const x=btn("✕","icon-btn"); x.setAttribute("aria-label","Fermer"); head.append(x); sh.append(head);
  const close=()=>back.remove(); x.addEventListener("click",close); back.addEventListener("click",e=>{ if(e.target===back) close(); });
  sh.append(el("p","note",k.use+" · Difficulté : "+k.lvl));
  if(SVG[k.id]){ const fig=el("div","knot-fig"); fig.innerHTML=SVG[k.id]; sh.append(fig); }
  if(k.mat){ const m=el("div","knot-mat"); m.append(el("b",null,"🧰 Matériel")); const ul=el("ul"); k.mat.forEach(x=>ul.append(el("li",null,x))); m.append(ul); sh.append(m); }
  if(k.mat) sh.append(el("h3","knot-h","Fabrication"));
  const ol=el("ol","knot-steps"); k.steps.forEach((s,i)=>{ const li=el("li"); li.append(el("span","ks-n",String(i+1)),el("span",null,s)); ol.append(li); }); sh.append(ol);
  if(k.tip) sh.append(el("p","knot-tip","💡 "+k.tip));
  back.append(sh); document.body.append(back);
}
function panel(){
  const box=$("#knots"); if(!box) return;
  box.hidden=!A.me; if(box.hidden) return;
  box.innerHTML="";
  box.append(el("h2",null,"📚 Nœuds et montages"));
  CATS.forEach(([cat,title,sub])=>{
    const list=KNOTS.filter(k=>k.cat===cat); if(!list.length) return;
    box.append(el("h4","g-sub knot-cat",title)); if(sub) box.append(el("p","note",sub));
    const g=el("div","knot-grid");
    list.forEach(k=>{ const b=el("button","knot-card"); b.type="button"; const f=el("div","knot-mini"); if(SVG[k.id]) f.innerHTML=SVG[k.id]; else f.append(el("span","knot-emo",k.e||"📘")); b.append(f,el("b",null,k.t),el("span","note",k.lvl)); b.addEventListener("click",()=>open(k)); g.append(b); });
    box.append(g);
  });
  box.append(el("p","note","Disponible sans réseau : pratique au bord de l'eau."));
}
A.knots={list:KNOTS,open};
const prev=A.hooks.profil; A.hooks.profil=()=>{ prev?.(); panel(); };
panel();
})();
