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

- Les exercices assistes ont besoin d'un modele propre : moins d'assistance
  n'est pas moins de performance. Les records et cibles restent generiques.
- Certaines machines generiques ne permettent pas de connaitre leur chargement
  exact sans leur gamme/modele. Les marques presentes varient selon le club.
- Les conseils techniques et visuels demandent encore une verification par
  variante (notamment kickback fessier versus hip thrust).
- La comparaison avec la periode precedente utilise encore la periode entiere;
  une comparaison a duree ecoulee egale serait plus pertinente.
- Le profil et le programme par defaut sont encore bases sur le profil initial.
  Un vrai parcours de creation de programme neutre reste a concevoir.
- Deux onglets modifiant les memes donnees en parallele ne sont pas synchronises.
- IndexedDB et localStorage restent sur le meme appareil : une suppression
  complete des donnees du navigateur peut effacer les deux. Le fichier exporte
  reste necessaire comme sauvegarde independante.
