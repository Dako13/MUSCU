# Dko : sauvegarde privee Supabase

## Etat de la livraison

L'integration fonctionne sans serveur applicatif sur GitHub Pages. Elle reste
**desactivee tant que `MuscuApp/supabase-config.js` est vide**. Les donnees locales
existantes ne sont pas envoyees avant connexion puis activation explicite.

Ce module est une sauvegarde automatique avec restauration manuelle, pas une
fusion temps reel entre appareils. Le stockage local et le mode hors ligne restent
les sources de travail. La base contient un instantane prive par utilisateur.

## Projet configure le 21 septembre 2026

- Projet Dko : `emgtwcdhjmjndtsfdbvt`, region `eu-west-1`, offre Free.
- Migration appliquee : `20260920224724_dko_private_backups` dans l'historique
  distant, issue de `migrations/202609200001_private_backups.sql`. Ne pas la rejouer.
- `tests/cloud-remote-rls.sql` execute sur le projet reel : refus anonyme,
  isolation de deux comptes, refus des ecritures directes et conflit de revision
  verifies. La transaction est annulee integralement, sans envoi d'e-mail.
- Controle final : RLS active, aucune sauvegarde, aucun compte fictif restant.
- Connexion Google retenue en v4.29 a la place des codes par e-mail : aucun
  service SMTP necessaire. Projet Google Cloud `Dko Auth` cree sous l'identifiant
  `endless-set-509309-v8`, sans activation de facturation.
- Branding Google Dko, client OAuth Web et fournisseur Google Supabase configures
  le 22 septembre 2026. L'URL du site et l'unique URL de retour autorisee sont
  `https://dako13.github.io/MUSCU/MuscuApp/`. La cle publishable est activee dans
  l'application ; elle est publique par conception et ne donne aucun droit
  d'administration. Aucun transfert de donnees locales n'est effectue sans
  connexion puis activation explicite de la sauvegarde.
- L'application Google est en production pour les utilisateurs externes. Elle
  ne demande que `openid`, `email` et `profile`; aucun scope sensible ou
  restreint, aucun logo Google et aucun acces Gmail/Drive/contacts.

Security Advisor signale les fonctions `SECURITY DEFINER` executables par un role
API : `dko_save_backup` est volontairement accessible uniquement au role
`authenticated`, avec controles d'identite et de revision testes. L'autre fonction,
`rls_auto_enable`, preexistait au deploiement : elle retourne `event_trigger` et
utilise `search_path=pg_catalog`; elle n'a pas ete modifiee. Ces avertissements ne
sont pas un resultat "zero alerte" et restent a reevaluer si les privileges changent.

References des avertissements :
- https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable
- https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable

## Activation par le proprietaire du projet

1. Pour un nouveau deploiement, creer un projet Supabase (offre Free possible,
   choisir une region adaptee). Le projet Dko ci-dessus existe deja.
2. Sur un projet non configure uniquement, executer
   `migrations/202609200001_private_backups.sql` dans le SQL Editor, une seule fois.
   Cette etape est deja terminee pour Dko. Ne pas modifier les tables d'un autre projet.
3. Dans Google Auth Platform, configurer le branding Dko et un client OAuth de
   type **Application Web**. Origine JavaScript : `https://dako13.github.io`.
   URI de redirection Google :
   `https://emgtwcdhjmjndtsfdbvt.supabase.co/auth/v1/callback`.
   Ne demander que `openid`, `email` et `profile`, aucun acces Gmail/Drive et
   aucun jeton Google hors ligne. Faire approuver les contacts et conditions
   au proprietaire. Ne pas activer d'essai payant ni de compte de facturation.
   Une application Google externe commence en mode test : ajouter les comptes
   de test necessaires, puis la publier dans Google Auth Platform avant une
   ouverture a tous les utilisateurs.
4. Reporter le Client ID et le Client Secret directement dans le fournisseur
   **Google** de Supabase et l'activer. Ne jamais mettre le secret dans Git ni
   dans la conversation. Garder la verification de nonce active. Dans URL
   Configuration, Site URL et redirection autorisee exacte :
   `https://dako13.github.io/MUSCU/MuscuApp/` (sans joker).
   Le mode de publication Google doit permettre les utilisateurs externes :
   tant que l'app est en test, seuls les comptes de test autorises sont admis.
   Ne pas desactiver la confirmation des e-mails pour contourner un blocage.
5. Renseigner uniquement l'URL `https://<projet>.supabase.co` et la cle
   **publishable** `sb_publishable_...` dans `MuscuApp/supabase-config.js`.
   Cette cle est publique par conception. **Jamais de cle secret/service_role,
   mot de passe PostgreSQL ou jeton d'administration dans le navigateur/Git.**
6. Publier, puis tester avec deux vrais comptes de test : connexion, premiere
   sauvegarde, reouverture, restauration sur un navigateur vierge et conflit.
   Verifier dans le Security Advisor que RLS est active. Tester aussi le retour
   Google sur une vraie PWA iPhone : PKCE requiert le meme espace de stockage
   navigateur entre le depart et le retour. Ce point n'est pas valide par Edge.

Aucun abonnement payant n'est cree par ce code. L'offre Free a des quotas et les
projets inactifs peuvent etre mis en pause : ne pas promettre une disponibilite
illimitee. La connexion Google fait partie des fournisseurs OAuth de l'offre
Free Supabase. Aucun service d'e-mail n'est utilise. Garder les exports JSON.

## Confidentialite et comportement

- Auth gere les sessions et leur renouvellement via le SDK officiel. Les jetons
  de session ne sont inclus ni dans les exports ni dans les sauvegardes cloud.
- OAuth utilise PKCE (challenge S256) et revient a la racine de l'app, sur le
  meme appareil. Le code a usage unique est retire immediatement de l'URL ;
  les retours OAuth ne sont pas caches par le service worker. Aucun message
  d'erreur fourni dans l'URL n'est affiche tel quel. La connexion ne lance pas
  la sauvegarde sans le consentement deja prevu.
- Une invitation a se connecter est presentee une seule fois par navigateur,
  apres le profil initial. Fermer cette invitation ou continuer sans compte
  laisse l'app utilisable. La connexion reste accessible dans les reglages.
- RLS autorise seulement la lecture de la ligne dont `user_id = auth.uid()`.
  Les visiteurs anonymes n'ont aucun acces. Les ecritures directes sont refusees.
- `dko_save_backup` derive l'identite du JWT et impose une revision attendue.
  Une ecriture concurrente echoue avec `40001` au lieu d'ecraser une autre copie.
- Programmes, historique, seance en cours, notes, reglages et mensurations sont
  sauvegardes. Ce n'est **pas** du chiffrement de bout en bout : l'administrateur
  du projet conserve ses droits sur la base. Hebergement chez Supabase, pas un
  service partage anonyme. Informer les utilisateurs avant activation.
- Une liaison locale compte/projet empeche d'envoyer les donnees du compte A au
  compte B. Restaurer B reste possible apres confirmation et copie de securite.
  La deconnexion garde les donnees accessibles sur l'appareil ; ce n'est pas un
  verrouillage d'application pour appareil partage.
- Sur un nouvel appareil, une copie distante differente ne peut pas etre remplacee
  sans confirmation. Les deux copies sont exportables en JSON avant arbitrage.
- Une restauration est bloquee pendant une seance/edition et cree d'abord une
  copie IndexedDB `before-cloud-restore`, exportable depuis l'ecran du compte.
- Sauvegarde apres 2,5 s sans modification, reessai periodique/reconnexion.
  Pas de requete periodique quand l'empreinte des donnees n'a pas change.
  Aucune execution en arriere-plan garantie quand iOS suspend la PWA.
- Un appareil qui a des changements distants doit les restaurer explicitement.
  Il n'y a ni fusion automatique des programmes ni remplacement silencieux.
- Supprimer un utilisateur depuis Supabase supprime sa ligne par cascade. La
  suppression de compte en libre-service n'est pas implementee dans cette version.

## Verification

```text
node tests/cloud-sync.cjs
node tests/cloud-browser.cjs
node tests/cloud-sql.cjs
```

Le test navigateur utilise le SDK reel et des reponses HTTP simulees, sans envoyer
de donnees personnelles. Le test SQL execute la migration et les restrictions
dans PostgreSQL via PGlite (`PGLITE_PATH` peut pointer vers son `dist/index.cjs`).
Il ne remplace pas un test final sur le vrai projet Supabase, notamment Google
OAuth et le retour sur iPhone. Le test navigateur verifie le challenge PKCE reel
du SDK contre un fournisseur simule, les erreurs et le maintien des donnees.
Les tests SQL doivent montrer : refus anonyme, isolation A/B, refus des ecritures
directes, conflit de revision, validation du format et suppression en cascade.

SDK navigateur vendore : `@supabase/supabase-js` **2.116.0**, distribution UMD
officielle depuis npm/jsDelivr. Licence MIT dans `MuscuApp/vendor/supabase-LICENSE`.
La copie locale evite une dependance CDN au demarrage et reste disponible hors ligne.
SHA-256 du fichier UMD : `84ee9bf45695c1dd3ba1595b6bcfb0f09672434631351ffc8ebe9140545d5ff6`.

Documentation officielle :
- https://supabase.com/docs/guides/getting-started/api-keys
- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://supabase.com/docs/guides/auth/social-login/auth-google
- https://supabase.com/docs/guides/auth/sessions/pkce-flow
- https://supabase.com/docs/guides/auth/redirect-urls
- https://supabase.com/pricing
