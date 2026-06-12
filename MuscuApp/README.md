# Muscu — PWA de suivi d'entraînement

Application web installable (PWA), hors ligne, sans serveur ni base de données. Données stockées localement sur l'appareil (localStorage), export/import JSON intégré.

## Contenu du dossier

| Fichier | Rôle |
|---|---|
| `index.html` | Structure de l'application |
| `app.css` | Styles |
| `app.js` | Logique complète (séances, minuteur, stats, éditeur de programme, export) |
| `sw.js` | Service worker — cache hors ligne |
| `manifest.webmanifest` | Manifeste PWA (nom, icônes, plein écran) |
| `icons/` | Icônes 180 / 192 / 512 + maskable |

## Déploiement gratuit — GitHub Pages (~10 min)

1. Créer un compte sur github.com (gratuit).
2. Créer un dépôt : bouton **New repository** → nom `muscu` → **Public** → **Create repository**.
3. Sur la page du dépôt : **uploading an existing file** → glisser-déposer TOUT le contenu de ce dossier (y compris le dossier `icons`) → **Commit changes**.
4. **Settings** → **Pages** → Source : `Deploy from a branch` → Branch : `main`, dossier `/ (root)` → **Save**.
5. Attendre 1-2 min. URL : `https://TON-PSEUDO.github.io/muscu/`

Alternative équivalente : Cloudflare Pages ou Netlify (glisser-déposer le dossier, zéro configuration).

## Installation sur iPhone

1. Ouvrir l'URL dans Safari.
2. Bouton Partager → **Sur l'écran d'accueil**.
3. L'app s'ouvre en plein écran, fonctionne hors ligne après la première visite.

## Mettre à jour l'application

1. Modifier les fichiers dans le dépôt GitHub (bouton crayon ou ré-upload).
2. Dans `sw.js`, incrémenter la version du cache : `const CACHE='muscu-v1'` → `'muscu-v2'`. Sans cela, les utilisateurs gardent l'ancienne version en cache.
3. À la prochaine ouverture, l'app affiche « Mise à jour disponible ».

## Récupérer les données de l'ancienne version (fichier local)

Le stockage est lié au domaine : le fichier local et la version hébergée ne partagent pas leurs données.
Dans l'ancienne version : **Données** → **Exporter (copier)**. Dans la nouvelle : **Données** → coller → **Importer**. L'import accepte tous les formats antérieurs (v2, v3) et l'export complet v4 (programme inclus).

## Limites connues (web/iOS)

- Pas de vibration sur iPhone (API non supportée par Safari iOS) — signal sonore à la place.
- Le minuteur ne sonne pas si l'app est fermée ou l'écran verrouillé (limitation web). L'app reste utilisable écran allumé.
- Données locales à l'appareil : faire un export régulier en sauvegarde. Une synchronisation cloud (Supabase) est l'évolution naturelle si besoin multi-appareils.

## Vers une commercialisation

Le code est prêt pour : programme éditable par l'utilisateur (intégré), données isolées par domaine, échappement des entrées (XSS), versionnage du format de données (migrations automatiques v2→v3→v4). Étapes suivantes typiques : comptes utilisateurs + synchronisation (Supabase/Firebase), page d'accueil marketing, analytics respectueux (Plausible), puis éventuellement wrapper natif (Capacitor) pour l'App Store.
