// Rivio : règles locales de pêche par département, lisibles hors réseau.
// Chaque fiche reprend une source publiée (fédération ou arrêté), avec sa date.
// Ce n'est jamais l'arrêté lui-même : parcours, réserves et plans d'eau peuvent
// avoir des règles propres. Périodes au format « MM-JJ », pour l'année indiquée.
// Ajouter un département : copier le bloc « 47 », vérifier chaque chiffre sur la
// source et mettre à jour « maj » (date de la source) et « consulte ».
window.CDJ_REGL={
  "47":{
    nom:"Lot-et-Garonne", annee:2026,
    source:{titre:"Fédération de pêche de Lot-et-Garonne · « Connaître la réglementation pêche »",url:"https://www.peche47.com/connaitre-la-reglementation-peche/",maj:"2026-04-21",consulte:"2026-11-04"},
    contact:"Fédération 47 : 05 53 66 16 68 · federation.peche.47@wanadoo.fr",
    general:[
      "2e catégorie : 4 cannes au maximum, 2 hameçons ou 3 mouches par ligne. 1re catégorie : 1 seule canne.",
      "Ouverture des carnassiers en 2e catégorie le samedi 25 avril 2026 à 6 h 39, et du black-bass le samedi 20 juin 2026 à 5 h 50 (heures légales d'Aiguillon).",
      "Taille mesurée du bout du museau à l'extrémité de la queue. Un poisson trop petit est remis à l'eau immédiatement.",
      "Autres tailles : mulet porc 20 cm, grenouilles verte et rousse 8 cm.",
      "Certains plans d'eau ont des règles particulières : vérifie les panneaux et la fédération."
    ],
    especes:[
      {sp:"Brochet",taille:60,c1:[["03-14","09-20"]],c2:[["01-01","01-25"],["04-25","12-31"]],lignes:["3 carnassiers par jour et par pêcheur (brochet, sandre, black-bass), dont 2 brochets au maximum."]},
      {sp:"Sandre",taille:50,c1:[["03-14","09-20"]],c2:[["01-01","01-25"],["04-25","12-31"]],lignes:["Compte dans les 3 carnassiers par jour."]},
      {sp:"Perche",taille:null,c1:[["03-14","09-20"]],c2:[["01-01","01-25"],["04-25","12-31"]],lignes:["Dans ce département, la perche ferme en même temps que le brochet et le sandre en 2e catégorie."]},
      {sp:"Black-bass",taille:40,c1:[["03-14","09-20"]],c2:[["01-01","01-25"],["06-20","12-31"]],lignes:["Compte dans les 3 carnassiers par jour."]},
      {sp:"Truite fario et arc-en-ciel",taille:23,c1:[["03-14","09-20"]],c2:[["03-14","09-20"]],lignes:["6 truites par jour et par pêcheur en 1re catégorie."]},
      {sp:"Anguille",taille:12,c1:[["05-01","09-20"]],c2:[["05-01","09-30"]],lignes:["Carnet de capture obligatoire."]},
      {sp:"Carpe",taille:null,c1:null,c2:null,lignes:["De nuit : toute l'année sur les parcours désignés, depuis la berge, avec appâts végétaux ou carnés (ni poisson mort ni vif), lampe blanche ou jaune. Les détails varient selon les parcours, surtout sur la Garonne.","Bateau interdit la nuit.","Une carpe de plus de 60 cm ne peut être ni gardée ni transportée vivante."]},
      {sp:"Silure",taille:null,c1:null,c2:null,lignes:["Pêche du silure de nuit interdite."]},
      {sp:"Écrevisses américaine, de Louisiane et signal",taille:null,c1:[["03-14","09-20"]],c2:[["01-01","12-31"]],lignes:["Espèces exotiques : ne jamais les remettre à l'eau vivantes, et interdites comme appât."]},
      {sp:"Écrevisses à pattes blanches et grêles",taille:null,c1:[],c2:[],lignes:["Pêche interdite toute l'année."]}
    ]
  }
};
