# Dko 4.24

## Interface

- Noir profond et rouge, titres Barlow Condensed, champs et commandes en Barlow.
- Accueil : anatomie face/dos, seance active ou recommandee, bilan hebdomadaire
  et tonnage reel des six dernieres semaines.
- Deux colonnes sur ordinateur, disposition verticale sur mobile.
- Entrainement : un exercice a la fois par defaut, navigation numerotee,
  acces precedent/suivant et mode liste complet.
- La prochaine serie non validee est accentuee ; les exercices termines sont
  coches. Aucun passage automatique au mouvement suivant.
- Dernier ressenti consultable avec sa date, sans recopier la note dans la
  seance courante. Les exercices seulement notes restent pris en compte.
- Theme rose conserve avec son anatomie feminine.

## Donnees

Aucune migration ni modification du format de sauvegarde. Les preferences
d'affichage de la seance sont temporaires. Apres rechargement, la reprise ouvre
le premier exercice incomplet. Programmes, historique, charges et notes
restent stockes localement comme auparavant.

## Verification

- `node --check MuscuApp/app.js` et `node --check MuscuApp/sw.js`.
- `tests/workout-notes.cjs` : notes par exercice et par seance, rechargement,
  edition, historique, import/export, compatibilite et dernier ressenti.
- `tests/quality-regressions.cjs` : modes focus/liste, navigation, pause,
  anatomies, notes/charges conservees, imports, minuteur, recuperation,
  hors-ligne et captures mobile/ordinateur.
- Avec `AXE_PATH` : controle axe WCAG A/AA de sept vues dans les deux themes.
- Controles visuels Edge/Chromium, largeurs 320, 390 et 1440, dont 320 x 568.
  Un controle sur un vrai iPhone/Safari reste utile.

Playwright doit etre disponible dans `node_modules` ou `NODE_PATH`.
`PLAYWRIGHT_CHANNEL=msedge` permet d'utiliser Edge pour les tests de notes.
Les donnees de test sont isolees des donnees des utilisateurs.
