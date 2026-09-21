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
- SMTP personnalise desactive dans le tableau de bord. L'interface demande un
  SMTP personnalise avant modification des modeles d'e-mail. Les codes OTP et
  leur livraison a des utilisateurs externes ne sont donc pas encore verifies.
- La configuration publique de l'app reste vide volontairement jusqu'a la fin
  du parametrage SMTP et des modeles. Aucun transfert de donnees locales effectue.

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
3. Laisser Email Auth actif et la confirmation des e-mails active. Dans les
   modeles d'e-mails **Magic Link** et **Confirm Signup**, afficher le code
   `{{ .Token }}` au lieu de seulement proposer un lien. Dko utilise `verifyOtp`
   dans l'application : cela fonctionne aussi dans la PWA iPhone.
4. Configurer un SMTP de production pour les utilisateurs hors de l'equipe du
   projet. Le SMTP fourni par Supabase est reserve aux essais et ne suffit pas
   pour une application ouverte au public. Ne pas desactiver la verification de
   l'adresse pour contourner cette restriction. Verifier les quotas et, avant
   ouverture large, ajouter la protection anti-abus adaptee (limites/CAPTCHA).
5. Renseigner uniquement l'URL `https://<projet>.supabase.co` et la cle
   **publishable** `sb_publishable_...` dans `MuscuApp/supabase-config.js`.
   Cette cle est publique par conception. **Jamais de cle secret/service_role,
   mot de passe PostgreSQL ou jeton d'administration dans le navigateur/Git.**
6. Publier, puis tester avec deux vrais comptes de test : connexion, premiere
   sauvegarde, reouverture, restauration sur un navigateur vierge et conflit.
   Verifier dans le Security Advisor que RLS est active.

Aucun abonnement payant n'est cree par ce code. L'offre Free a des quotas et les
projets inactifs peuvent etre mis en pause : ne pas promettre une disponibilite
illimitee. L'offre SMTP choisie a ses propres conditions. Garder les exports JSON.

## Confidentialite et comportement

- Auth gere les sessions et leur renouvellement via le SDK officiel. Les jetons
  de session ne sont inclus ni dans les exports ni dans les sauvegardes cloud.
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
Il ne remplace pas un test final sur le vrai projet Supabase, notamment Auth/SMTP.
Les tests SQL doivent montrer : refus anonyme, isolation A/B, refus des ecritures
directes, conflit de revision, validation du format et suppression en cascade.

SDK navigateur vendore : `@supabase/supabase-js` **2.116.0**, distribution UMD
officielle depuis npm/jsDelivr. Licence MIT dans `MuscuApp/vendor/supabase-LICENSE`.
La copie locale evite une dependance CDN au demarrage et reste disponible hors ligne.
SHA-256 du fichier UMD : `84ee9bf45695c1dd3ba1595b6bcfb0f09672434631351ffc8ebe9140545d5ff6`.

Documentation officielle :
- https://supabase.com/docs/guides/getting-started/api-keys
- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://supabase.com/docs/guides/auth/auth-email-passwordless
- https://supabase.com/docs/guides/auth/auth-smtp
- https://supabase.com/pricing
