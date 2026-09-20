# Dko 4.25 : arbitrage des six pistes

## 1. Comparaison des series : livree

Point fort : retrouver les charges et repetitions precedentes sans quitter
la saisie. Risque : surcharge visuelle, ou comparaison de mouvements differents.

Decision : reference sous chaque serie, date indiquee une fois. Pas de colonne
supplementaire sur mobile, de score, ni de modification des valeurs saisies.
Seules les series validees sont reprises, dans leur ordre d'enregistrement.
Un exercice renomme ou dont l'unite a change n'est pas compare automatiquement.
La date retenue est la plus recente, sans utiliser une seance future.

Limite : cet ordre ne distingue pas les series d'echauffement ou une serie
intermediaire sautee, informations absentes de l'ancien format d'historique.

## 2. Remplacement ponctuel : differe

Point fort : continuer une seance quand une machine est occupee.
Risques : fusionner les charges de machines differentes ; perdre les series
deja saisies ; modifier involontairement le programme.

Decision : ne pas greffer un simple changement de nom sur le moteur actuel.
Une livraison distincte doit isoler l'identite de la variante, conserver les
series deja faites et couvrir l'annulation, l'historique et l'import/export.
Aucune promesse d'equivalence de charge entre machines.

## 3. Minuteur : livre

Le repos par exercice existait deja dans l'editeur du programme.
Point fort : le rendre accessible pendant l'entrainement.
Risque : modifier silencieusement le programme ou un compte a rebours en cours.

Decision : surcharge temporaire par exercice dans la seance active, presets
et saisie en secondes, bouton de retour a la valeur du programme. La nouvelle
duree concerne les prochains repos seulement. Ajustements -30 / +30 secondes
pour le repos en cours. Retirer plus que le temps restant termine le repos.

Les durees temporaires sont validees, sauvegardees et importables avec la
seance active ; elles ne sont pas heritees par la seance suivante.
Les limites web de sonnerie en arriere-plan/verrouillage restent inchangees.

## 4. Bilan : livre

Point fort : contextualiser le volume et identifier les records de charge.
Risque : confondre davantage de series avec une hausse de performance.

Decision : tableau avant/apres sur les exercices communs de la derniere
seance du meme programme d'entrainement. Affichage du nombre de series et du
tonnage, sans pourcentage de progression ni jugement automatique.
Si une charge manque, le tonnage de cet exercice est omis, pas transforme en zero.
Les premieres references sont separees des records. Les records nouveaux
ignorent les anciennes entrees de nom/unite differents et les dates futures.

## 5. Bibliotheque visuelle : differee

Point fort : reconnaitre l'equipement rapidement.
Risques : mauvaise variante en photo, droits non verifies, liens externes
casses, poids de telechargement et fonctionnement hors ligne.

Decision : conserver les medias existants ; ne pas ajouter de photos
generiques donnant une fausse impression de precision. Une prochaine passe
doit verifier modele, chargement, source/licence et solution hors ligne.

## 6. Sauvegarde : conserver l'existant

L'application propose deja export/import JSON, date de dernier export,
rappel apres sept jours et miroir IndexedDB.
Point fort : protection locale sans compte utilisateur.
Risques : notifications repetitives et fausse assurance.

Decision : pas de rappel supplementaire. Le miroir reste sur le meme appareil
et n'est pas une sauvegarde externe. Une date d'export ne prouve pas que
l'utilisateur conserve encore le fichier. Pas de synchronisation cloud ajoutee.

## Verification

- Syntaxe JavaScript et git diff --check.
- Tests training-flow : comparaisons, absence d'historique, incompatibilite
  d'unites, tonnage incomplet, minuteur, durees temporaires, rechargement,
  validation de sauvegarde, nouveaux records et premieres references.
- Tests quality-regressions et workout-notes : donnees existantes, import/export,
  notes isolees, reprise, hors-ligne et interfaces.
- Captures et inspection 320 / 390 / 1440, deux themes.
- Axe sur les vues existantes et sur bilan/reglage du repos/minuteur.
- Verification navigateur Edge/Chromium ; pas de validation sur iPhone physique.
