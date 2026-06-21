# AGENTS.md — Dako / Dko (PWA musculation)

Cadre de travail pour les agents IA (Claude Code & Codex) sur ce dépôt.
**À lire avant toute modification.**

## Projet
PWA de suivi musculation, **100 % vanilla** (HTML/CSS/JS), hors-ligne
(localStorage + miroir IndexedDB), **déployée sur GitHub Pages depuis la branche `main`**.
Pousser sur `main` = mettre en ligne (l'utilisateur, Ugo, teste sur son téléphone).
UI en **français**, tutoiement, thème sombre OLED + rouge.

## Fichiers (tout est dans `MuscuApp/`)
- `index.html` — coquille, barre d'onglets, enregistrement du service worker.
- `app.js` — **toute la logique** (~2300 lignes, monolithique) : données, rendu,
  séances, stats, bibliothèque machines, thèmes…
- `app.css` — design system (variables CSS `--ac`, `--bg`… ; thèmes `:root[data-theme="rose"]`).
- `sw.js` — service worker. **network-first** pour `index.html`/`app.js`/`app.css`
  (dernière version en ligne dès le rechargement), cache-first pour le reste.
- `bodymap.js` — **généré** : tracés SVG anatomiques (react-native-body-highlighter, MIT).
  `BODY_FRONT/BACK` (homme) + `BODY_*_F` (femme, thème rosé). Ne pas éditer à la main.
- `manifest.webmanifest`, `icons/`.

## Règles dures (faciles à casser — attention)
1. **Pas de moteur JS local** (ni node/deno). On ne peut pas exécuter le code →
   **valider en relisant** + équilibrer accolades `{}` / parenthèses / quotes.
   Repère : le nombre de `'` doit être **pair**.
2. **Apostrophes typographiques `’` (U+2019) dans le TEXTE des chaînes JS**,
   jamais l'apostrophe ASCII `'` (elle ferme la chaîne et casse le fichier).
   Ex : `notes:'jusqu’à l’étirement'`.
3. **À chaque livraison destinée aux utilisateurs** : incrémenter `CACHE` dans
   `sw.js` (`dako-vN`) **ET** `APP_VERSION` dans `app.js`. Sinon l'ancienne version
   reste en cache.
4. **Aucun secret** (clé API, token) dans le code ou les commits.
5. Thèmes : `SETTINGS.theme` (`dark` / `rose`) → `applyTheme()` pose `data-theme`
   sur `<html>`. `rose` = silhouette **féminine** (`BODY_*_F`). Après un changement
   de thème, `render()` régénère les silhouettes.

## Workflow Git (collaboration Claude + Codex)
- **Source unique = GitHub `Dako13/MUSCU`, branche `main`.** (Pas de branche de dev :
  GitHub Pages sert `main`, donc Ugo doit pouvoir tester chaque push sur son tél.)
- **Avant** toute tâche : `git pull` (récupérer le travail de l'autre agent).
- **Après** : valider → bump `CACHE` + `APP_VERSION` → `commit` → `push` sur `main`.
- **Commits petits et fréquents**, message clair.
- **Tour par tour** : ne PAS éditer `app.js` en même temps que l'autre agent
  (fichier monolithique = conflits). Annoncer avant de toucher `app.js`.
- Finir chaque message de commit par une ligne `Co-Authored-By:` propre à l'agent.

## Déploiement
Push sur `main` → GitHub Pages publie en 1-2 min → Ugo recharge l'app sur son tél.
(Le SW network-first affiche la dernière version dès le 1er rechargement en ligne.)

## État / threads ouverts
- Version courante : voir `APP_VERSION` dans `MuscuApp/app.js`.
- En cours : identité **Dko** (renommage + logo « bouclier » à finaliser).
