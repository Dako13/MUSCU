# Muscu — PWA de suivi d'entraînement

Application web installable (PWA), utilisable hors ligne. Données stockées localement sur l'appareil (localStorage + IndexedDB), export/import JSON intégré. Sauvegarde privée Supabase optionnelle, désactivée tant que le projet n'est pas configuré.

## Suivi et dossier coach (4.41)

Le résumé du suivi compare les jours écoulés de la semaine ou du mois aux mêmes
jours de la période précédente. Les séances datées dans le futur sont exclues
de ce résumé. Dans un dossier élève, l'historique affiche 20 séances puis charge
les suivantes à la demande, sans supprimer les données plus anciennes.

Pour les machines assistées reconnues, l'historique montre l'assistance utilisée
(moins signifie moins d'aide). Ces charges ne créent ni record ni score automatique
de progression : le poids du corps et les répétitions comptent aussi. Le coach
voit une colonne « Assistance min. » au lieu de « Charge max. ».

## Premier lancement et coaching (4.39)

Une installation neuve commence avec un profil non prérempli et un programme
vide. L'accueil propose un exemple modifiable de trois séances sans charges
cibles. Les installations et sauvegardes existantes gardent leurs programmes.

L'espace coach classe les élèves à vérifier selon la réception du programme et
la date de leur dernière sauvegarde ; cette date ne représente pas la date du
dernier entraînement. Un brouillon de programme coach peut être repris après
rechargement sur le même appareil, après contrôle des droits et de la révision.
Il n'est jamais publié automatiquement ni inclus dans la sauvegarde privée.
Déconnexion et changement de compte l'effacent.

Depuis la version 4.40, la liste des élèves dispose d'une recherche par nom
(insensible aux accents) et de filtres pour les dossiers à vérifier ou les
programmes en attente de réception. Le filtrage reste local à l'écran du coach.

## Catalogue étendu (4.33)

Ajout de 141 mouvements et variantes génériques et de 26 fiches Matrix
(Versa, Aura et Magnum), avec conseils individuels et chargement explicite.
Recherche par mots, synonymes français/anglais et référence constructeur.
Les données sont dans `exercise-catalog.js`, également disponible hors ligne.
Les anciennes entrées restent en place pour préserver favoris et références.

Le filtre par enseigne est une association indicative de marques, pas un
inventaire de chaque club. La présence locale des modèles doit être vérifiée.
Sources consultées le 23 septembre 2026 :
- [Basic-Fit : Matrix et Technogym](https://www.basic-fit.com/fr-lu/newestequipment).
- [Catalogue constructeur Matrix Versa](https://pl.matrixfitness.com/pol/strength/catalog?modalities=single-station&series=versa).
- [Catalogue Matrix 2025 : Aura et Magnum](https://www.matrixfitnessblog.it/Matrix_Strength_2025.pdf).
- [Matrix Magnum Vertical Bench Press et gamme plate-loaded](https://www.johnsonfitness.com/Matrix-Magnum-Vertical-Bench-Press-P36128.aspx).
- [Taxonomie des exercices ACE](https://www.acefitness.org/resources/everyone/exercise-library/).

Les conseils français sont rédigés pour Dko, sans copier les fiches sources.
Vérification des données : `node tests/exercise-catalog.cjs`.

## Bibliothèque personnelle (4.32)

L’ajout d’exercices propose une sélection multiple, des favoris, les ajouts récents
et les exercices personnels. La création conserve son brouillon lors du passage
à la bibliothèque. Les modèles personnels, favoris et récents sont inclus dans
les exports JSON et les sauvegardes privées, sans modifier les anciens programmes.

L’éditeur permet un incrément de charge par exercice, utilisé par les boutons
plus/moins et les cibles. Les remplacements ponctuels filtrent les candidats par
mouvement et muscles ; ils ne transfèrent pas la charge du mouvement remplacé.
L’accueil indique l’état de sauvegarde locale ou en ligne.

Tests : `node tests/library-workflow.cjs`, `node tests/cloud-sync.cjs` et
`node tests/cloud-browser.cjs` (Playwright avec Microsoft Edge pour les tests navigateur).

## Contenu du dossier

| Fichier | Rôle |
|---|---|
| `index.html` | Structure de l'application |
| `app.css` | Styles |
| `app.overrides.css` | Direction visuelle et adaptations responsive |
| `app.js` | Logique complète (séances, minuteur, stats, éditeur de programme, export) |
| `exercise-catalog.js` | Mouvements génériques et références Matrix avec conseils spécifiques |
| `data-integrity.js` | Validation des sauvegardes et fusion des historiques |
| `cloud-sync.js`, `cloud-ui.js` | Sauvegarde Supabase privée, connexion et restauration |
| `supabase-config.js` | Configuration publique optionnelle (aucun secret) |
| `sw.js` | Service worker — cache hors ligne |
| `manifest.webmanifest` | Manifeste PWA (nom, icônes, plein écran) |
| `icons/` | Icônes 180 / 192 / 512 + maskable |
| `icons/ui.svg` | Icônes d’interface Lucide, disponibles hors ligne |

Les icônes d’interface proviennent de [Lucide](https://lucide.dev).
Leurs licences ISC et MIT sont conservées dans [icons/lucide-LICENSE](icons/lucide-LICENSE).

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

## Repos des séances

Depuis la version 4.26, la création/édition d'une séance propose son repos
par défaut, avec raccourcis et durée libre en secondes. La priorité est :
ajustement pendant la séance, repos spécifique de l'exercice, repos de la séance,
puis réglages personnels. Les anciennes séances gardent leur comportement ;
ce réglage reste local et est inclus dans les sauvegardes.

## Répétitions et durée (4.27)

Les répétitions acceptent une virgule ou un point, par exemple 7,5 et 7.5.
La décimale est conservée dans l'historique, les corrections et les sauvegardes.
Les boutons plus/moins restent à un pas de 1 et conservent la partie décimale.

Chaque validation de série mémorise le temps écoulé, pauses déduites. La durée
enregistrée s'arrête à la dernière validation encore conservée. Une fois toutes
les séries validées, le chronomètre affiché se fige également.

Une séance ouverte est clôturée après 3 heures depuis son démarrage (pauses
comprises pour ce délai). Si iOS suspend la page, le contrôle est effectué au
retour ou au rechargement. La durée sauvegardée reste celle de la dernière
série validée, pas 3 heures. Un brouillon sans série validée est mis en pause,
sans supprimer ses notes. La clôture n'écrase pas un autre éditeur ouvert.

Les anciennes séances ouvertes sans horodatage de validation sont compatibles :
leur durée est laissée inconnue lors d'une clôture automatique, plutôt que
d'inventer l'heure de leur dernière série. Les durées historiques déjà
enregistrées ne sont pas recalculées.

Tests spécifiques : `tests/workout-duration.cjs` et `tests/workout-notes.cjs`.

## Mettre à jour l'application

1. Modifier les fichiers dans le dépôt GitHub (bouton crayon ou ré-upload).
2. Incrémenter `APP_VERSION` dans `app.js` et la version de secours dans `sw.js`. Le cache est versionné avec cette valeur lors de l’enregistrement du service worker.
3. À la prochaine ouverture, l'app affiche « Mise à jour disponible ».

## Récupérer les données de l'ancienne version (fichier local)

Le stockage est lié au domaine : le fichier local et la version hébergée ne partagent pas leurs données.
Dans l'ancienne version : **Données** → **Exporter (copier)**. Dans la nouvelle : **Données** → coller → **Importer**. L'import accepte tous les formats antérieurs (v2, v3) et l'export complet v4 (programme inclus).

## Limites connues (web/iOS)

Les corrections, tests et limites relevées lors du dernier audit sont décrits dans
[le bilan de qualité 4.22](../docs/quality-4.22.md).
La refonte rouge et noir et ses tests sont décrits dans
[le bilan 4.24](../docs/design-4.24.md).
Les arbitrages et tests des améliorations pendant la séance sont détaillés dans
[le bilan 4.25](../docs/decisions-4.25.md).

- Pas de vibration sur iPhone (API non supportée par Safari iOS) — signal sonore à la place.
- Le minuteur ne sonne pas si l'app est fermée ou l'écran verrouillé (limitation web). L'app reste utilisable écran allumé.
- Données locales à l'appareil : garder des exports réguliers. La sauvegarde Supabase optionnelle permet une restauration sur un autre appareil, sans fusion automatique.

## Vers une commercialisation

Le code est prêt pour : programme éditable par l'utilisateur (intégré), données isolées par domaine, échappement des entrées (XSS), versionnage du format de données (migrations automatiques v2→v3→v4). Étapes suivantes typiques : comptes utilisateurs + synchronisation (Supabase/Firebase), page d'accueil marketing, analytics respectueux (Plausible), puis éventuellement wrapper natif (Capacitor) pour l'App Store.
# Sauvegarde Supabase (4.29)

Une sauvegarde cloud privee et optionnelle est disponible dans Reglages > Compte
et sauvegarde. Elle reste desactivee tant que le projet n'est pas configure.
Le mode local/hors ligne et les donnees existantes sont conserves.
La connexion utilise Google, sans service d'envoi d'e-mails. Une proposition
facultative apparait au premier lancement une fois le cloud configure, apres
l'accueil du profil et jamais pendant une seance. Le choix sans compte est memorise.
Voir [la procedure d'activation et les limites](../supabase/README.md).
