/* Generic movements, independent of equipment brands. Tips are original French copy.
   Reference taxonomy: https://www.acefitness.org/resources/everyone/exercise-library/ */
const EXERCISE_CATALOG=(()=>{
  const group=(p,s,t,load,pattern,rows)=>rows.map(([n,tip,aliases='',variant=pattern])=>({n,tip,aliases,p:[...p],s:[...s],t,load,pattern:variant,b:'Générique',generic:true}));
  return [
    ...group(['pecs'],['triceps','delt_ant'],'Barre','libre','benchpress',[
      ['Développé incliné (barre)','Installe les sécurités du rack. Descends la barre vers le haut du thorax en gardant les avant-bras sous la barre, puis repousse sans décoller les fesses.','incline barbell bench press','inclinepress'],
      ['Développé décliné (barre)','Bloque tes jambes sur un banc adapté et fais-toi aider au décrochage. Descends vers le bas des pectoraux, sans rebond.','decline bench press'],
      ['Développé au sol (barre)','Place les sécurités à portée. Pose doucement les bras au sol à chaque descente, sans relâcher les poignets, puis repousse.','floor press']
    ]),
    ...group(['pecs'],['triceps','delt_ant'],'Haltères','libre','benchpress',[
      ['Développé décliné (haltères)','Utilise un banc décliné stable avec maintien des jambes. Garde les haltères au-dessus des coudes et prépare une sortie maîtrisée de la position.','decline dumbbell press'],
      ['Développé couché prise neutre (haltères)','Garde les paumes face à face et les coudes proches du buste. Descends les deux haltères ensemble sans les laisser partir vers les épaules.','neutral grip dumbbell press'],
      ['Développé au sol (haltères)','Genoux pliés, pose doucement les bras au sol puis pousse les haltères au-dessus de la poitrine. Ne rebondis pas sur les coudes.','dumbbell floor press'],
      ['Développé serré en pression (haltères)','Maintiens les haltères au contact au-dessus du sternum. Presse-les ensemble pendant la montée et la descente, sans casser les poignets.','squeeze press hex press']
    ]),
    ...group(['pecs'],[],'Haltères','libre','fly',[
      ['Écarté couché (haltères)','Sur banc plat, garde un angle léger et constant aux coudes. Ouvre seulement dans une amplitude confortable pour les épaules, puis rapproche les bras.','flat dumbbell fly'],
      ['Écarté décliné (haltères)','Fixe les jambes sur le banc décliné. Décris un arc autour du thorax avec une charge légère, sans descendre les bras excessivement.','decline fly']
    ]),
    ...group(['pecs'],['delt_ant'],'Poulie','poulie','fly',[
      ['Écarté poulies hautes vers le bas','Place un pied devant et garde le buste stable. Ramène les poignées vers le bas du thorax en conservant le même pli aux coudes.','high to low cable fly'],
      ['Écarté poulies basses vers le haut','Pars avec les poignées près des hanches. Rapproche les bras vers le haut du thorax sans hausser les épaules ni cambrer.','low to high cable fly'],
      ['Écarté unilatéral (poulie)','Place la poulie à hauteur de poitrine. Ramène le bras devant toi sans tourner le bassin ; contrôle le retour du même côté.','single arm cable fly'],
      ['Écarté incliné (poulies, banc)','Centre le banc incliné entre deux poulies basses. Rapproche les bras au-dessus du haut du thorax, dos maintenu contre le dossier.','incline cable fly']
    ]),
    ...group(['pecs'],['triceps','delt_ant'],'Poids du corps','corps','chestpress',[
      ['Pompes au sol','Garde tête, bassin et talons alignés. Descends le thorax entre les mains avec les coudes légèrement rapprochés du buste.','push up pushup'],
      ['Pompes inclinées (mains sur banc)','Appuie les mains sur un support fixe. Approche la poitrine du bord sans laisser le bassin tomber ; un support plus haut facilite le mouvement.','incline push up'],
      ['Pompes déclinées (pieds sur banc)','Pose les pieds sur un banc stable. Maintiens le ventre engagé et descends entre les mains sans avancer la tête seule.','decline push up'],
      ['Pompes sur les genoux','Garde une ligne continue entre les genoux et la tête. Descends le buste et le bassin ensemble au lieu de plier aux hanches.','kneeling push up']
    ]),
    ...group(['pecs'],['triceps','delt_ant'],'Smith','disques','benchpress',[
      ['Développé couché (Smith machine)','Centre le banc sous la barre et règle les butées. Vérifie à vide que la trajectoire arrive au thorax sans forcer les épaules.','smith bench press'],
      ['Développé incliné (Smith machine)','Règle les sécurités avant de charger. Positionne le banc pour que la barre descende vers le haut du thorax, sans projeter les coudes derrière toi.','smith incline press','inclinepress']
    ]),
    ...group(['dos'],['biceps'],'Poids du corps','corps','pulldown',[
      ['Tractions pronation','Depuis une suspension contrôlée, tire les coudes vers le bas sans élan des jambes. Redescends dans une amplitude que tes épaules tolèrent.','pull up pullup'],
      ['Tractions supination','Paumes vers toi, monte en rapprochant les coudes du buste. Évite de chercher la barre avec le menton et contrôle la descente.','chin up chinup'],
      ['Tractions prise neutre','Utilise les poignées parallèles et garde les poignets alignés. Monte sans balancer le bassin, puis redescends avec contrôle.','neutral grip pull up']
    ]),
    ...group(['dos'],['biceps'],'Poulie','poulie','pulldown',[
      ['Tirage vertical prise neutre serrée','Bloque les cuisses sous les coussins. Tire la poignée vers le haut du thorax en gardant les coudes près des côtes.','close neutral lat pulldown'],
      ['Tirage vertical prise large pronation','Choisis une largeur confortable, sans exagérer. Tire devant la tête vers le haut du thorax ; ne transforme pas le mouvement en rowing.','wide grip lat pulldown'],
      ['Tirage vertical supination','Paumes vers toi, tire avec les coudes vers le bas. Garde les poignets droits et évite de basculer en arrière à chaque répétition.','underhand lat pulldown'],
      ['Tirage vertical unilatéral à genou','Place un genou au sol face à la poulie haute. Amène le coude vers la hanche du même côté sans incliner tout le buste.','kneeling single arm lat pulldown']
    ]),
    ...group(['dos'],['biceps','delt_post'],'Poulie','poulie','rowhoriz',[
      ['Tirage horizontal prise neutre serrée','Assieds-toi avec les genoux souples. Tire vers le nombril sans reculer le buste ; laisse les omoplates avancer au retour contrôlé.','seated cable row close grip'],
      ['Tirage horizontal prise large','Tire la barre vers le bas du thorax avec les coudes écartés. Garde les épaules loin des oreilles et évite de te balancer.','wide grip cable row'],
      ['Tirage horizontal supination','Garde les paumes vers le haut et les coudes proches des côtes. Ramène la barre vers la taille sans plier les poignets.','underhand cable row'],
      ['Rowing poitrine sur banc (poulie basse)','Place le banc face à la poulie et appuie le thorax au dossier. Tire sans décoller la poitrine et sans coincer le câble sous le banc.','chest supported cable row']
    ]),
    ...group(['dos'],['biceps','delt_post'],'Haltères','libre','rowhoriz',[
      ['Rowing poitrine sur banc incliné (haltères)','Pose le thorax sur un banc incliné. Tire les coudes en arrière en laissant le cou libre, puis tends les bras sans quitter le support.','chest supported dumbbell row'],
      ['Rowing buste penché (deux haltères)','Recule les hanches et stabilise le tronc. Tire les deux haltères vers les flancs sans redresser le buste à chaque répétition.','bent over dumbbell row'],
      ['Rowing coudes ouverts (haltères, banc)','Thorax soutenu sur le banc, ouvre les coudes pour tirer vers les côtes hautes. Garde la charge assez légère pour ne pas hausser les épaules.','chest supported wide row']
    ]),
    ...group(['dos'],['biceps','lombaires'],'Barre','libre','rowhoriz',[
      ['Rowing barre supination','Paumes vers le haut, stabilise le buste penché. Tire vers la taille sans lancer les hanches ; réduis la charge si les poignets se plient.','underhand barbell row'],
      ['Rowing Pendlay','Repars de la barre posée au sol à chaque répétition. Gaine le buste avant de tirer ; évite de donner une impulsion avec le dos.','pendlay row'],
      ['Rowing Meadows (landmine)','Place-toi de côté par rapport à une barre fixée en landmine. Stabilise le buste avec la main libre et tire sans tourner le bassin.','meadows row']
    ]),
    ...group(['dos'],['biceps'],'Poids du corps','corps','rowhoriz',[
      ['Rowing inversé sous barre','Vérifie que la barre est solidement fixée. Garde le corps aligné et amène la poitrine vers la barre ; plie les genoux pour faciliter.','inverted row australian pull up'],
      ['Rowing aux sangles de suspension','Contrôle la fixation des sangles. Garde le corps droit en tirant les poignées vers les côtes ; recule les pieds pour alléger la difficulté.','TRX row suspension row']
    ]),
    ...group(['dos'],[],'Haltères','libre','pullover',[
      ['Pull-over (haltère, banc)','Allonge le dos sur le banc et garde les côtes contrôlées. Descends un haltère derrière la tête dans une amplitude confortable, coudes légèrement pliés.','dumbbell pullover']
    ]),
    ...group(['delt_ant','delt_lat'],['triceps'],'Haltères','libre','shoulderpress',[
      ['Développé épaules assis (haltères)','Appuie le dos sur un dossier presque vertical. Pousse les haltères sans les cogner et sans décoller les côtes.','seated dumbbell shoulder press'],
      ['Développé Arnold','Pars avec les paumes vers toi devant le visage. Ouvre puis pousse en une rotation confortable ; ne force pas la rotation en bas.','arnold press'],
      ['Développé épaules unilatéral (haltère)','Garde le bassin horizontal et le tronc stable. Pousse un seul haltère sans te pencher sur le côté opposé.','single arm shoulder press']
    ]),
    ...group(['delt_ant'],['triceps'],'Landmine','libre','shoulderpress',[
      ['Développé landmine unilatéral à genou','Fixe la barre dans son support. Un genou au sol, pousse la barre en diagonale sans cambrer ni tourner le bassin.','half kneeling landmine press']
    ]),
    ...group(['delt_lat'],[],'Haltères','libre','lateral',[
      ['Élévations latérales assis (haltères)','Assieds-toi sans élan des jambes. Monte les coudes latéralement dans une amplitude confortable et ralentis la descente.','seated lateral raise'],
      ['Élévation latérale unilatérale (haltère)','Tiens un support avec la main libre. Élève le bras sur le côté sans hausser le cou ni faire tourner le tronc.','single arm lateral raise']
    ]),
    ...group(['delt_lat'],[],'Poulie','poulie','lateral',[
      ['Élévation latérale poulie derrière le dos','Place la poulie basse derrière toi. Garde le câble dégagé du bassin et monte le coude sur le côté sans pivoter.','behind body cable lateral raise'],
      ['Élévation latérale allongé sur banc (poulie)','Installe un banc à côté de la poulie basse et stabilise le thorax. Monte le bras latéralement avec une charge légère, sans tirer avec le cou.','lying cable lateral raise']
    ]),
    ...group(['delt_ant'],[],'Haltères','libre','frontraise',[
      ['Élévations frontales (haltères)','Lève les haltères devant toi jusqu’à une hauteur confortable. Garde les côtes abaissées et évite de reculer le buste.','front raise']
    ]),
    ...group(['delt_post'],['dos'],'Poulie','poulie','reardelt',[
      ['Oiseau debout aux poulies croisées','Croise les câbles à hauteur des épaules. Ouvre les bras avec les coudes souples, sans transformer le geste en tirage vers le ventre.','reverse cable fly'],
      ['Oiseau unilatéral (poulie)','Attrape la poignée du côté opposé. Ouvre le bras vers le côté en gardant le sternum face à toi, sans rotation du tronc.','single arm rear delt fly']
    ]),
    ...group(['delt_post'],['dos'],'Haltères','libre','reardelt',[
      ['Oiseau poitrine sur banc incliné','Appuie le thorax au banc et laisse les bras pendre. Ouvre les coudes sur les côtés sans décoller la poitrine.','chest supported reverse fly']
    ]),
    ...group(['dos'],['avant_bras'],'Barre','libre','shrug',[
      ['Haussements d’épaules (barre)','Tiens la barre devant les cuisses et élève les épaules verticalement. Garde les bras longs et ne fais pas de cercles avec les épaules.','barbell shrugs']
    ]),
    ...group(['biceps'],['avant_bras'],'Haltères','libre','curl',[
      ['Curl alterné en supination (haltères)','Tourne progressivement la paume vers le haut en fléchissant le coude. Termine un côté sans balancer le buste avant de passer à l’autre.','alternating dumbbell curl'],
      ['Curl concentration (haltère)','Assis, stabilise le bras contre la face interne de la cuisse. Monte sans déplacer le coude et tends progressivement au retour.','concentration curl'],
      ['Curl pupitre unilatéral (haltère)','Pose tout le bras sur le pupitre. Descends lentement sans claquer le coude en extension, puis remonte sans soulever le bras.','dumbbell preacher curl'],
      ['Curl spider (haltères, banc)','Thorax sur un banc incliné, laisse les bras pendre vers le sol. Fléchis les coudes sans les ramener vers les côtes.','spider curl'],
      ['Curl marteau croisé (haltères)','Paume tournée vers le buste, ramène un haltère vers le pectoral opposé. Garde le poignet neutre et le coude près du corps.','cross body hammer curl'],
      ['Curl Zottman','Monte en supination, puis tourne les paumes vers le sol pour descendre lentement. Choisis une charge adaptée à cette descente plus exigeante.','zottman curl']
    ]),
    ...group(['biceps'],['avant_bras'],'Barre','libre','curl',[
      ['Curl debout (barre droite)','Prends une largeur qui garde les poignets confortables. Fléchis les coudes sans lancer le bassin et garde les épaules stables.','barbell curl'],
      ['Curl debout (barre EZ)','Choisis les angles de prise confortables de la barre EZ. Garde les coudes près du tronc et ralentis le retour.','ez bar curl'],
      ['Curl pupitre (barre EZ)','Règle le siège pour soutenir les bras sur le coussin. Descends avec contrôle et évite de rebondir dans la position basse.','ez preacher curl']
    ]),
    ...group(['biceps'],['avant_bras'],'Poulie','poulie','curl',[
      ['Curl bayésien unilatéral (poulie)','Place la poulie basse derrière toi et avance légèrement. Garde le bras un peu derrière le buste sans forcer l’épaule, puis fléchis le coude.','bayesian cable curl'],
      ['Curl marteau (poulie, corde)','Tiens la corde avec les paumes face à face. Monte les mains sans relever les coudes ni séparer exagérément les extrémités.','rope hammer curl'],
      ['Curl aux poulies hautes','Règle les poulies de chaque côté à hauteur des épaules. Garde les bras écartés et stables pendant que les mains se rapprochent de la tête.','high cable curl'],
      ['Curl allongé (poulie basse)','Allonge-toi face à la poulie basse, pieds hors du trajet du câble. Fléchis les coudes sans décoller les bras du sol.','lying cable curl']
    ]),
    ...group(['avant_bras'],['biceps'],'Barre','libre','curl',[
      ['Curl inversé pronation (barre EZ)','Paumes vers le bas, garde les poignets dans le prolongement des avant-bras. Monte avec une charge légère sans plier les poignets.','reverse curl']
    ]),
    ...group(['avant_bras'],[],'Haltères','libre','forearm',[
      ['Flexion des poignets (haltères)','Pose les avant-bras sur un banc, paumes vers le haut et mains hors du bord. Bouge uniquement les poignets sur une petite amplitude contrôlée.','wrist curl'],
      ['Extension des poignets (haltères)','Soutiens les avant-bras, paumes vers le bas. Relève les mains avec une faible charge sans décoller les coudes.','reverse wrist curl wrist extension']
    ]),
    ...group(['triceps'],[],'Poulie','poulie','triceps',[
      ['Extension triceps (poulie, barre droite)','Place les coudes près des côtes. Abaisse la barre par extension des coudes, sans pousser avec les épaules.','straight bar pushdown'],
      ['Extension triceps unilatérale (poulie)','Tiens une poignée et stabilise le coude contre le flanc. Tends le bras sans incliner le buste pour aider.','single arm pushdown'],
      ['Extension triceps au-dessus de la tête (poulie basse)','Dos à la poulie, amène la corde derrière la tête. Garde les bras orientés vers le haut et étends les coudes sans creuser le dos.','overhead cable triceps extension'],
      ['Extension triceps croisée (poulie)','Prends le câble du côté opposé à hauteur du thorax. Étends le coude en diagonale vers le bas en gardant le haut du bras stable.','cross body cable triceps extension']
    ]),
    ...group(['triceps'],[],'Haltères','libre','triceps',[
      ['Extension triceps à deux mains (haltère, assis)','Assis avec le tronc stable, tiens un haltère au-dessus de la tête. Plie puis tends les coudes sans laisser les côtes se soulever.','seated dumbbell overhead extension'],
      ['Extension triceps unilatérale au-dessus de la tête (haltère)','Garde le bras orienté vers le haut dans une position confortable. Abaisse doucement l’haltère derrière la tête puis étends le coude.','single arm overhead triceps extension'],
      ['Barre au front (haltères)','Allongé sur un banc, garde les paumes face à face. Plie les coudes pour amener les haltères près des tempes, sans déplacer tout le bras.','dumbbell skull crusher'],
      ['Kickback triceps (haltère)','Buste soutenu et bras le long du tronc, étends seulement le coude. Évite de monter l’épaule pour terminer la répétition.','dumbbell triceps kickback']
    ]),
    ...group(['triceps'],[],'Barre','libre','triceps',[
      ['Barre au front (barre EZ)','Allongé, garde la barre sous contrôle au-dessus du visage. Plie les coudes sans les écarter excessivement ; commence léger.','ez skull crusher lying triceps extension']
    ]),
    ...group(['triceps'],['pecs','delt_ant'],'Barre','libre','benchpress',[
      ['Développé couché prise serrée (barre)','Prends une largeur proche de celle des épaules, pas les mains collées. Garde les avant-bras alignés sous la barre et les coudes proches du buste.','close grip bench press']
    ]),
    ...group(['triceps'],['pecs','delt_ant'],'Poids du corps','corps','triceps',[
      ['Dips aux barres parallèles','Stabilise les épaules avant de descendre. Plie les coudes dans une amplitude confortable, sans laisser les épaules partir trop loin derrière.','parallel bar dips'],
      ['Pompes prise serrée','Place les mains sous le thorax à une largeur confortable. Garde les coudes près du corps et adapte la difficulté en surélevant les mains.','close grip push up diamond push up']
    ]),
    ...group(['quadriceps','fessiers'],['abdos'],'Barre','libre','squat',[
      ['Squat avant (front squat)','Place la barre sur les deltoïdes avant et garde les coudes hauts. Descends en maintenant le tronc gainé et les pieds entièrement au sol.','front squat'],
      ['Squat avec safety bar','Règle les sécurités du rack et centre le coussin. Tiens les poignées sans tirer la barre vers le bas et garde les appuis stables.','safety bar squat']
    ]),
    ...group(['quadriceps','fessiers'],[],'Haltères','libre','squat',[
      ['Goblet squat (haltère)','Tiens un haltère contre le thorax. Descends entre les hanches en gardant les talons posés, puis remonte sans laisser la charge tirer le dos.','goblet squat'],
      ['Squat sumo (haltère)','Adopte une largeur de pieds confortable, pointes légèrement ouvertes. Descends avec les genoux dans la direction des pieds en tenant la charge entre les jambes.','sumo dumbbell squat']
    ]),
    ...group(['quadriceps','fessiers'],[],'Poids du corps','corps','squat',[
      ['Squat au poids du corps','Garde les pieds ancrés et les genoux dans leur axe. Descends à une profondeur contrôlée, puis pousse le sol sans rebond.','air squat bodyweight squat']
    ]),
    ...group(['quadriceps','fessiers'],[],'Smith','disques','squat',[
      ['Squat (Smith machine)','Teste à vide le placement des pieds sous la trajectoire guidée. Règle les butées et garde le bassin sous contrôle pendant la descente.','smith squat']
    ]),
    ...group(['quadriceps','fessiers'],[],'Machine à disques','disques','squat',[
      ['Belt squat (machine à disques)','Place la ceinture sur les hanches selon la notice. Garde les pieds stables et descends sans te suspendre aux poignées.','belt squat'],
      ['Pendulum squat (machine à disques)','Règle les butées et les appuis avant de charger. Garde le dos contre le dossier et les talons en contact avec le plateau.','pendulum squat squat pendulaire']
    ]),
    ...group(['quadriceps','fessiers'],[],'Machine à disques','disques','legpress',[
      ['Presse à cuisses unilatérale (à disques)','Commence avec une charge réduite. Garde le bassin symétrique sur le siège pendant que la jambe active pousse le plateau.','single leg press'],
      ['Presse à cuisses horizontale (à disques)','Règle le dossier pour garder le bassin au contact à la descente. Pousse sur tout le pied sans verrouillage brutal des genoux.','horizontal plate loaded leg press']
    ]),
    ...group(['quadriceps'],[],'Machine à broche','broche','legext',[
      ['Leg extension unilatérale (pin)','Aligne le genou avec l’axe de rotation et place le rouleau au-dessus de la cheville. Tends une jambe sans tourner le bassin.','single leg extension']
    ]),
    ...group(['quadriceps','fessiers'],[],'Haltères','libre','lunge',[
      ['Fentes arrière (haltères)','Recule un pied et abaisse le genou arrière. Pousse dans le pied avant pour revenir, sans prendre une impulsion excessive avec le pied arrière.','reverse lunge'],
      ['Fentes avant (haltères)','Fais un pas en avant puis freine la descente. Garde le genou dans l’axe du pied et repousse le sol pour revenir au départ.','forward lunge'],
      ['Split squat pieds au sol (haltères)','Garde les deux pieds au sol en position décalée. Descends verticalement sans rapprocher les pieds et pousse surtout avec la jambe avant.','static lunge split squat'],
      ['Fentes latérales (haltère)','Fais un pas de côté puis recule les hanches au-dessus de la jambe fléchie. Garde l’autre pied en contact avec le sol et reviens avec contrôle.','lateral lunge side lunge']
    ]),
    ...group(['quadriceps','fessiers'],[],'Haltères','libre','stepup',[
      ['Montées sur banc (haltères)','Choisis une marche stable permettant de garder le bassin droit. Monte avec la jambe posée sur le support, sans sauter avec celle au sol.','step up step-up'],
      ['Montées latérales sur step (haltères)','Place-toi de côté devant une marche basse et stable. Monte sans incliner le bassin, puis contrôle la descente du pied extérieur.','lateral step up']
    ]),
    ...group(['quadriceps','fessiers'],[],'Smith','disques','lunge',[
      ['Squat bulgare (Smith machine)','Place le pied arrière sur un support stable et règle les butées. Descends en gardant l’appui avant stable, sans forcer le bassin à tourner.','smith bulgarian split squat'],
      ['Fentes arrière (Smith machine)','Teste la trajectoire à vide et règle les sécurités. Recule une jambe en gardant le pied avant ancré sous une position confortable.','smith reverse lunge']
    ]),
    ...group(['ischios','fessiers'],['lombaires'],'Haltères','libre','hinge',[
      ['Soulevé de terre roumain (haltères)','Fais glisser les haltères près des jambes en reculant les hanches. Arrête la descente avant de perdre la position du dos.','dumbbell Romanian deadlift RDL'],
      ['Soulevé de terre roumain unilatéral (haltère)','Garde le bassin orienté vers le sol et le genou porteur légèrement plié. Bascule aux hanches ; tiens un support si l’équilibre limite le geste.','single leg RDL'],
      ['Soulevé de terre roumain B-stance (haltères)','Décale un pied légèrement derrière sur la pointe. Charge surtout la jambe avant et recule les hanches sans faire pivoter le bassin.','kickstand RDL B stance']
    ]),
    ...group(['ischios','fessiers'],['lombaires'],'Barre','libre','hinge',[
      ['Soulevé de terre sumo (barre)','Pieds écartés selon ta mobilité, prends la barre entre les genoux. Gaine avant de pousser le sol et garde la barre près du corps.','sumo deadlift'],
      ['Soulevé de terre (trap bar)','Centre-toi dans la barre hexagonale. Gaine puis pousse le sol en gardant les poignées de niveau, sans tirer avec un à-coup.','hex bar deadlift trap bar']
    ]),
    ...group(['ischios','fessiers'],[],'Smith','disques','hinge',[
      ['Soulevé de terre roumain (Smith machine)','Place les pieds pour garder la barre près des jambes. Recule les hanches et règle les butées pour une amplitude maîtrisée.','smith RDL']
    ]),
    ...group(['ischios'],[],'Machine à broche','broche','legcurl',[
      ['Leg curl assis unilatéral (pin)','Stabilise la cuisse sous le coussin. Plie une jambe sans décoller le bassin et retiens le retour du rouleau.','single leg seated curl'],
      ['Leg curl debout unilatéral (pin)','Aligne le genou avec le pivot et appuie le buste au support. Ramène le talon sans avancer la hanche ni creuser le dos.','standing leg curl']
    ]),
    ...group(['ischios'],['fessiers'],'Poids du corps','corps','legcurl',[
      ['Leg curl glissé au sol','Allongé avec les talons sur des patins adaptés, monte le bassin. Éloigne puis ramène les talons sans laisser tomber les hanches.','sliding leg curl hamstring slide'],
      ['Leg curl sur Swiss ball','Pose les talons sur un ballon stable et monte le bassin. Ramène le ballon en pliant les genoux sans laisser les hanches tourner.','swiss ball leg curl'],
      ['Nordic curl assisté','Fixe les chevilles dans un dispositif prévu pour cela. Descends lentement en gardant les hanches alignées, avec les mains prêtes à recevoir le poids du corps.','assisted nordic hamstring curl']
    ]),
    ...group(['fessiers'],['ischios'],'Smith','disques','hipthrust',[
      ['Hip thrust (Smith machine)','Bloque un banc stable derrière toi et protège le bassin. Monte les hanches jusqu’à aligner le tronc, sans pousser avec les lombaires.','smith hip thrust']
    ]),
    ...group(['fessiers'],['ischios'],'Haltères','libre','hipthrust',[
      ['Hip thrust (haltère)','Place les omoplates contre un banc stable et protège le bassin sous la charge. Pousse dans les pieds pour aligner les hanches avec le tronc.','dumbbell hip thrust']
    ]),
    ...group(['fessiers'],['ischios'],'Poids du corps','corps','hipthrust',[
      ['Pont fessier au sol','Allongé, genoux pliés, pousse les pieds dans le sol. Monte le bassin sans dépasser l’alignement du tronc et garde les côtes contrôlées.','glute bridge'],
      ['Pont fessier unilatéral','Garde un pied au sol et l’autre jambe relevée. Monte le bassin sans laisser un côté descendre ni cambrer pour gagner de la hauteur.','single leg glute bridge'],
      ['Hip thrust unilatéral sur banc','Omoplates sur un banc fixe, pousse avec un seul pied. Garde le bassin horizontal et réduis l’amplitude si tu perds cet alignement.','single leg hip thrust'],
      ['Frog pumps','Allongé, rapproche les plantes des pieds et laisse les genoux ouverts confortablement. Soulève le bassin sur une petite amplitude sans forcer les hanches.','frog pump']
    ]),
    ...group(['fessiers'],['ischios'],'Poulie','poulie','hinge',[
      ['Pull-through (poulie basse, corde)','Dos à la poulie, passe la corde entre les jambes. Recule les hanches puis redresse-toi sans tirer la corde avec les bras.','cable pull through']
    ]),
    ...group(['fessiers'],[],'Poulie','poulie','kickback',[
      ['Kickback jambe tendue (poulie, sangle)','Fixe la sangle à la cheville et prends un appui stable. Recule la jambe sur une amplitude modérée sans tourner le bassin ni cambrer.','cable glute kickback'],
      ['Extension de hanche à genou sur banc (poulie)','Stabilise le genou et les mains sur un banc fixe. Recule la jambe attachée au câble en gardant le bassin face au sol.','kneeling cable hip extension']
    ]),
    ...group(['fessiers'],[],'Poulie','poulie','abductor',[
      ['Abduction de hanche debout (poulie)','Fixe la sangle à la cheville extérieure. Écarte la jambe sans pencher le tronc, avec la pointe du pied orientée vers l’avant.','standing cable hip abduction']
    ]),
    ...group(['fessiers'],[],'Poids du corps','corps','abductor',[
      ['Abduction de hanche allongé sur le côté','Superpose les hanches et garde le bassin immobile. Lève la jambe du dessus sans tourner la pointe du pied vers le plafond.','side lying hip abduction']
    ]),
    ...group(['adducteurs'],[],'Poulie','poulie','adductor',[
      ['Adduction de hanche debout (poulie)','Attache la sangle à la cheville proche de la poulie. Ramène la jambe devant la jambe d’appui sans incliner ni tourner le bassin.','standing cable hip adduction']
    ]),
    ...group(['mollets'],[],'Haltères','libre','calf',[
      ['Mollets debout unilatéral (haltère)','Tiens un support avec la main libre. Monte sur la pointe du pied porteur puis descends lentement, sans rebond ni rotation de la cheville.','single leg calf raise'],
      ['Mollets assis (haltères sur les cuisses)','Assieds-toi avec les genoux pliés et protège les cuisses sous les charges. Monte les talons puis redescends sans laisser les genoux bouger latéralement.','seated dumbbell calf raise']
    ]),
    ...group(['mollets'],[],'Machine à disques','disques','calf',[
      ['Mollets à la presse à cuisses','Installe les sécurités et place les avant-pieds de façon stable sur le plateau. Fais bouger les chevilles sans plier les genoux ni laisser glisser les pieds.','leg press calf raise'],
      ['Mollets debout (Smith machine)','Règle les butées et utilise un support stable si nécessaire. Monte sur les pointes sans verrouiller brutalement les genoux ni rouler les chevilles.','smith calf raise'],
      ['Mollets assis (machine à disques)','Règle le coussin sur les cuisses, pas sur les rotules. Laisse les talons descendre progressivement puis monte sans rebond.','plate loaded seated calf raise']
    ]),
    ...group(['mollets'],[],'Poids du corps','corps','calf',[
      ['Mollets debout au poids du corps','Prends un appui léger pour l’équilibre. Monte les talons ensemble, marque un court arrêt puis redescends lentement.','bodyweight calf raise']
    ]),
    ...group(['abdos'],[],'Poids du corps','corps','abs',[
      ['Crunch au sol','Garde les mains légères près de la tête ou sur le thorax. Décolle les omoplates en soufflant, sans tirer la nuque.','floor crunch'],
      ['Crunch inversé','Allongé, genoux pliés, rapproche le bassin des côtes en décollant légèrement le sacrum. Évite de lancer les jambes.','reverse crunch'],
      ['Relevé de genoux suspendu','Pars sans balancement et garde les épaules actives. Monte les genoux en contrôlant le bassin, puis redescends sans prendre d’élan.','hanging knee raise'],
      ['Relevé de jambes suspendu','Commence en suspension stable. Monte les jambes dans une amplitude contrôlée, sans cambrer ni te balancer ; plie les genoux si nécessaire.','hanging leg raise'],
      ['Crunch sur Swiss ball','Place le milieu du dos sur le ballon, pieds bien écartés au sol. Enroule doucement le thorax sans faire rouler le ballon sous toi.','stability ball crunch'],
      ['Crunch bicyclette','Rapproche alternativement une épaule du genou opposé sans tirer sur la tête. Garde le mouvement lent et réduis l’extension des jambes si le dos se creuse.','bicycle crunch']
    ]),
    ...group(['abdos'],[],'Poids du corps','corps','core',[
      ['Dead bug','Allongé, bras levés et genoux pliés, éloigne un bras et la jambe opposée. Arrête avant que les lombaires se creusent, puis alterne.','deadbug','deadbug'],
      ['Bird dog','À quatre pattes, allonge un bras et la jambe opposée. Garde le bassin horizontal et reviens sans déplacer le tronc.','bird-dog','birddog'],
      ['Roue abdominale à genoux','Gaine le bassin avant de faire rouler la roue. Avance seulement jusqu’où tu peux revenir sans laisser les lombaires se creuser.','ab wheel rollout','abwheel'],
      ['Gainage avec toucher d’épaule','En appui sur les mains, écarte les pieds pour stabiliser le bassin. Touche lentement l’épaule opposée avec une main, puis alterne sans pivoter.','plank shoulder taps','plank']
    ]),
    ...group(['abdos'],[],'Poulie','poulie','core',[
      ['Pallof press (poulie)','Place-toi de côté à une poulie à hauteur du sternum. Éloigne les mains devant toi puis ramène-les sans laisser le tronc tourner.','anti rotation pallof press','pallof'],
      ['Rotation diagonale haute vers basse (poulie)','Tiens la poignée à deux mains et pivote avec les hanches et les pieds. Descends en diagonale sans tordre uniquement les lombaires.','cable woodchop high to low','woodchop'],
      ['Rotation diagonale basse vers haute (poulie)','Pars près de la hanche et accompagne la diagonale avec le bassin. Garde les bras souples et ne lance pas la charge au-dessus de la tête.','cable lift low to high woodchop','woodchop']
    ])
  ];
})();

/* Matrix manufacturer catalogs identify models, not the inventory of a given club.
   Basic-Fit brand association is indicative; see the sources in README.md. */
const MATRIX_CATALOG=[
  ['Développé poitrine convergent (Versa)','VS-S13','broche','chestpress',['pecs'],['triceps','delt_ant'],
    'Règle le siège pour que les poignées partent à hauteur de poitrine. Pousse en suivant la trajectoire convergente sans décoller les omoplates du dossier.'],
  ['Pec fly / écarté assis (Versa)','VS-S22','broche','fly',['pecs'],[],
    'Règle les bras de départ pour une ouverture confortable. Dos contre le dossier, rapproche les poignées devant la poitrine en gardant les coudes légèrement pliés.'],
  ['Reverse fly / arrière épaules (Versa)','VS-S22','broche','reardelt',['delt_post'],['dos'],
    'Passe les bras de la machine en position arrière épaules. Assieds-toi face au dossier et ouvre les bras sans décoller le thorax ni hausser les épaules.'],
  ['Développé épaules convergent (Versa)','VS-S23','broche','shoulderpress',['delt_ant','delt_lat'],['triceps'],
    'Ajuste le siège pour commencer poignées près des épaules. Pousse vers le haut en gardant le dos au dossier et sans rapprocher les coudes de force.'],
  ['Tirage vertical divergent (Versa)','VS-S33','broche','pulldown',['dos'],['biceps'],
    'Bloque les cuisses sous les appuis. Tire les poignées vers le haut du thorax en guidant les coudes vers les flancs, puis laisse remonter sans te soulever.'],
  ['Tirage horizontal divergent (Versa)','VS-S34','broche','rowhoriz',['dos'],['biceps','delt_post'],
    'Ajuste le siège et cale le thorax contre l’appui. Ramène les poignées vers les côtes sans reculer le buste ; accompagne leur ouverture au retour.'],
  ['Biceps curl au pupitre (Versa)','VS-S40','broche','curl',['biceps'],[],
    'Ajuste le siège pour poser les bras sur le support. Fléchis les coudes sans relever les épaules, puis redescends sans claquer les poids de la pile.'],
  ['Triceps press / dips assis (Versa)','VS-S42','broche','triceps',['triceps'],['pecs'],
    'Place les pieds au sol et règle le siège pour atteindre les poignées sans hausser les épaules. Abaisse les poignées par extension des coudes, dos soutenu.'],
  ['Extension lombaire assise (Versa)','VS-S52','broche','backext',['lombaires'],[],
    'Règle le support du dos et stabilise les pieds. Redresse le tronc dans une amplitude confortable, sans donner un coup de reins ni finir en hyperextension.'],
  ['Abdominal crunch (Versa)','VS-S53','broche','abs',['abdos'],[],
    'Ajuste le siège et les appuis à ta taille. Rapproche le thorax du bassin en soufflant ; les bras accompagnent les poignées sans tirer seuls la charge.'],
  ['Presse à cuisses (Versa)','VS-S70','broche','legpress',['quadriceps','fessiers'],[],
    'Règle la position de départ et pose les pieds sur le plateau. Repousse sans décoller le bassin du dossier et reviens avant que le bas du dos ne se soulève.'],
  ['Extension des jambes (Versa)','VS-S71','broche','legext',['quadriceps'],[],
    'Aligne les genoux sur le pivot et place le rouleau au-dessus des chevilles. Tends les jambes sans soulever le bassin, puis redescends lentement.'],
  ['Mollets à la presse (Versa)','VS-S70','broche','calf',['mollets'],[],
    'Utilise la position mollets indiquée sur la machine, avant-pieds bien posés. Fais bouger les chevilles en gardant les genoux stables et sans laisser glisser les pieds.'],
  ['Leg curl assis (Versa)','VS-S72','broche','legcurl',['ischios'],[],
    'Aligne les genoux sur le pivot et abaisse le maintien des cuisses. Ramène les talons sous le siège, puis laisse remonter sans que le bassin se décolle.'],
  ['Abducteurs assis (Versa)','VS-S74','broche','abductor',['fessiers'],[],
    'Choisis le mode abduction et place les coussins contre la face extérieure des cuisses. Écarte les jambes sans prendre appui sur les poignées pour donner de l’élan.'],
  ['Adducteurs assis (Versa)','VS-S74','broche','adductor',['adducteurs'],[],
    'Passe les coussins contre la face interne des cuisses et règle une ouverture confortable. Resserre lentement sans faire claquer les appuis au centre.'],
  ['Glute / extension de hanche (Versa)','VS-S78','broche','kickback',['fessiers'],['ischios'],
    'Stabilise le buste sur les appuis prévus. Pousse la plateforme vers l’arrière avec la jambe active, sans faire pivoter les hanches ni cambrer le dos.'],
  ['Tirage vertical (Versa double fonction)','VS-S331','broche','pulldown',['dos'],['biceps'],
    'Place la machine en mode tirage vertical et règle le maintien des cuisses. Descends les poignées devant toi en gardant le buste stable et contrôle leur remontée.'],
  ['Tirage horizontal (Versa double fonction)','VS-S331','broche','rowhoriz',['dos'],['biceps','delt_post'],
    'Passe la machine en mode tirage horizontal et cale les pieds. Tire vers le tronc sans arrondir les épaules en fin de retour ni lancer le bassin.'],
  ['Biceps curl (Versa double fonction)','VS-S401','broche','curl',['biceps'],[],
    'Sélectionne la position biceps et règle le siège pour aligner les coudes avec le pivot. Fléchis les bras sans décoller les épaules des appuis.'],
  ['Extension triceps (Versa double fonction)','VS-S401','broche','triceps',['triceps'],[],
    'Passe les bras de la machine en position triceps et ajuste le siège. Étends les coudes sans pousser avec le torse, puis retiens le retour.'],
  ['Crunch abdominal (Versa double fonction)','VS-S531','broche','abs',['abdos'],[],
    'Place le poste en mode abdominaux et ajuste les appuis. Enroule le thorax vers le bassin en soufflant, sans tirer le mouvement uniquement avec les bras.'],
  ['Extension lombaire (Versa double fonction)','VS-S531','broche','backext',['lombaires'],[],
    'Sélectionne le mode dos et stabilise les pieds. Redresse le tronc progressivement, puis reviens sans laisser la pile retomber ni cambrer en fin de course.'],
  ['Tractions assistées (Versa)','VS-S601','broche','pulldown',['dos'],['biceps'],
    'Monte sur l’appui mobile en tenant les poignées. Plus la charge choisie à la broche est élevée, plus l’assistance est forte ; tire les coudes vers le bas sans balancer.'],
  ['Dips assistés (Versa)','VS-S601','broche','triceps',['triceps','pecs'],['delt_ant'],
    'Reste gainé sur l’appui mobile et saisis les barres. Descends dans une amplitude confortable pour les épaules, puis pousse sans rebond ; la pile règle l’assistance.'],
  ['Extension des jambes (Versa double fonction)','VS-S711','broche','legext',['quadriceps'],[],
    'Passe la machine en mode extension et aligne les genoux avec le pivot. Place le rouleau sur le bas des tibias, tends les jambes puis freine la descente.'],
  ['Leg curl assis (Versa double fonction)','VS-S711','broche','legcurl',['ischios'],[],
    'Sélectionne le mode flexion et ajuste le maintien des cuisses. Fléchis les genoux vers le bas sans décoller le bassin, puis laisse revenir la charge lentement.'],
  ['Élévations latérales (Aura)','G3-S21','broche','lateral',['delt_lat'],[],
    'Règle le siège pour que les appuis soutiennent les bras. Élève les coudes sur les côtés sans hausser les épaules, puis retiens le retour.'],
  ['Développé poitrine assis (Magnum Vertical Bench Press)','MG-PL12','disques','chestpress',['pecs'],['triceps','delt_ant'],
    'Charge les deux bras de façon équilibrée. Règle le siège et le dossier pour amener les poignées au niveau du thorax, puis pousse sans décoller les épaules.'],
  ['Développé couché (Magnum Supine Bench Press)','MG-PL13','disques','benchpress',['pecs'],['triceps','delt_ant'],
    'Allonge-toi avec les pieds stables et les poignets sous les poignées. Pousse les bras de la machine ensemble, puis descends dans une amplitude confortable.'],
  ['Développé incliné (Magnum Incline Bench Press)','MG-PL14','disques','inclinepress',['pecs'],['delt_ant','triceps'],
    'Règle le siège pour placer les poignées devant le haut du thorax. Pousse les deux leviers sans cambrer et accompagne leur retour sans relâcher la charge.'],
  ['Développé décliné (Magnum Vertical Decline Bench Press)','MG-PL15','disques','chestpress',['pecs'],['triceps'],
    'Garde le dos appuyé et les poignées au niveau prévu par la machine. Suis la trajectoire descendante des leviers sans te pencher pour aider la poussée.'],
  ['Développé épaules (Magnum Shoulder Press)','MG-PL23','disques','shoulderpress',['delt_ant','delt_lat'],['triceps'],
    'Ajuste le siège pour démarrer dans une position confortable des épaules. Garde le bassin contre le dossier en poussant les poignées vers le haut.'],
  ['Tirage vertical (Magnum Lat Pulldown)','MG-PL33','disques','pulldown',['dos'],['biceps'],
    'Bloque les cuisses sous le coussin et charge les deux côtés. Amène les coudes vers le bas sans te suspendre en arrière ; contrôle la remontée indépendante des bras.'],
  ['Tirage horizontal (Magnum Seated Row)','MG-PL34','disques','rowhoriz',['dos'],['biceps','delt_post'],
    'Règle le siège et stabilise les pieds sur les appuis. Tire les poignées vers les côtes sans avancer la tête ni transformer le tirage en balancier du dos.'],
  ['Crunch sur banc (Magnum Ab Crunch)','MG-PL50','disques','abs',['abdos'],[],
    'Teste le mouvement sans disque avant de charger le support prévu. Enroule le thorax vers le bassin et accompagne le retour sans tirer sur les poignées avec les bras.'],
  ['Presse à cuisses 45° (Magnum)','MG-PL70','disques','legpress',['quadriceps','fessiers'],[],
    'Charge le chariot symétriquement et repère les sécurités. Descends sans arrondir le bassin contre le dossier, puis pousse sur tout le pied.'],
  ['Hack squat (Magnum)','MG-PL71','disques','squat',['quadriceps'],['fessiers'],
    'Place le dos et les épaules contre les coussins, puis règle les butées. Descends avec les talons en contact et remonte sans décoller le bassin.'],
  ['Mollets debout (Magnum Standing Calf)','MG-PL76','disques','calf',['mollets'],[],
    'Règle la hauteur des coussins avant de te placer sous la machine. Monte les talons sans plier les genoux pour donner de l’élan et descends avec contrôle.'],
  ['Mollets assis (Magnum Seated Calf)','MG-PL77','disques','calf',['mollets'],[],
    'Place les avant-pieds sur le support et le coussin sur les cuisses. Libère le levier selon la notice, puis alterne montée et descente des talons sans rebond.'],
  ['Hip thrust (Magnum Glute Trainer)','MG-PL78','disques','hipthrust',['fessiers'],['ischios'],
    'Installe-toi sous le coussin de bassin et vérifie son verrouillage. Pousse dans les pieds pour monter les hanches sans finir en cambrant les lombaires.']
].map(([n,model,load,pattern,p,s,tip])=>({n,b:'Matrix',model,load,pattern,p,s,tip,t:load==='broche'?'Machine à broche':'Machine à disques',aliases:model}));
