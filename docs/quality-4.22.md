# Dko 4.22.0 - fiabilite et utilisation

Audit du 19 septembre 2026, realise sur une copie locale avec des profils de test
isoles. Aucune donnee personnelle des utilisateurs n'a ete lue ou modifiee.

## Corrections livrees

- Restauration IndexedDB avant toute ecriture des valeurs initiales. Un echec
  d'ecriture locale ne remplace plus le miroir de secours sain.
- Import valide integralement, puis apercu avec ajout, remplacement confirme,
  ou annulation. Conservation de l'historique lors d'un ajout, identification
  distincte des seances d'une meme journee et retour aux anciennes valeurs en
  cas d'echec d'ecriture. Copie de secours avant import dans IndexedDB.
- Ouverture directe des fichiers JSON et telechargement depuis Donnees.
- Noms des seances, noms et muscles des exercices conserves dans chaque seance
  enregistree. Les anciennes seances sont enrichies avec les definitions encore
  disponibles au premier lancement de cette version. Les definitions deja
  supprimees avant cette mise a jour ne peuvent pas etre reconstituees.
- Protection contre la suppression ou la modification d'une seance en cours.
  Les programmes reinitialises recoivent des identifiants uniques.
- Recherche insensible aux accents, filtres repliables, nombre de resultats,
  remise a zero et ajout fonctionnel depuis une fiche d'exercice.
- Fenetres avec fermeture, focus clavier, touche Echap, contenu de fond inactif
  et position de defilement reinitialisee. Intitules longs lisibles sur mobile.
- Editeur avec bouton Enregistrer accessible pendant le defilement et alerte
  avant de quitter des modifications non enregistrees.
- Saisie stricte des charges/repetitions, labels associes aux champs, contrastes
  des boutons, zoom navigateur autorise et mouvements reduits respectes.
- Moins de contenu avant les series, distinction des actions principale et
  secondaire. Notes et technique restent disponibles.
- Minuteur repris apres rechargement; seance active incluse dans la sauvegarde.
- Statistiques sans resume duplique et recuperation explicitement estimee.

## Verification

Node.js et Playwright doivent etre disponibles. Les scripts utilisent leur
propre serveur ephemere et des contextes navigateur sans donnees utilisateur.

```powershell
$env:PLAYWRIGHT_CHANNEL='msedge'
node --check MuscuApp/app.js
node --check MuscuApp/data-integrity.js
node tests/workout-notes.cjs
node tests/quality-regressions.cjs
```

`NODE_PATH` peut pointer vers une installation Playwright partagee. Pour ajouter
le controle axe-core, definir `AXE_PATH` vers `axe.min.js`. Le test de qualite
ecrit captures et mesures dans le dossier temporaire `dko-quality`.

Couverture : notes, sauvegarde/restauration, imports invalides, erreur de quota,
annulation, doublons, historique apres suppression, minuteur, bibliotheque,
editeur, themes, largeurs 320/390/1440 et fonctionnement hors ligne. Les controles
axe sur accueil, bibliotheque, entrainement, editeur et reglages ne remplacent
pas un audit manuel complet d'accessibilite ni un essai sur iPhone physique.

## Points restant a traiter

- Les machines assistees reconnues sont exclues des records de charge generiques
  depuis 4.41. Depuis 4.45, leur progression tient compte du poids de corps
  saisi pour chaque seance, de l'assistance et des repetitions. Une seance
  ancienne sans poids de corps reste visible mais ne produit pas de score
  automatique ; l'effort estime (poids moins assistance) n'est pas une mesure
  biomecanique exacte de la machine. Depuis 4.46, les courbes utilisent ce
  repere avec les repetitions si au moins deux pesees comparables existent ;
  sinon elles montrent seulement l'assistance, sans conclure a un progres.
- Certaines machines generiques ne permettent pas de connaitre leur chargement
  exact sans leur gamme/modele. Les marques presentes varient selon le club.
- Les conseils techniques et visuels demandent encore une verification par
  variante (notamment kickback fessier versus hip thrust).
- Le bilan compare les memes jours calendaires depuis 4.41, sans equivalence
  exacte heure par heure (l'historique enregistre la date de seance).
- Les nouvelles installations demarrent sur un profil et un programme neutres
  depuis 4.39 ; les programmes anterieurs restent inchanges.
- Depuis 4.42, un onglet perime bloque ses ecritures et demande un rechargement.
  Les modifications concurrentes ne sont pas fusionnees automatiquement.
- IndexedDB et localStorage restent sur le meme appareil : une suppression
  complete des donnees du navigateur peut effacer les deux. Le fichier exporte
  reste necessaire comme sauvegarde independante.
