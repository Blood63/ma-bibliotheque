# Ma bibliothèque

Application pour suivre ses livres, ses mangas et ses BD. Elle marche dans le navigateur, y compris hors ligne, et s’installe sur l’écran d’accueil.

Adresse : https://blood63.github.io/ma-bibliotheque/

## Première utilisation

Ouvre le lien. La bibliothèque est vide : ajoute un livre avec le bouton **+** (code-barres, ISBN, titre, ou saisie à la main).

Tes livres restent **dans ce navigateur**. Un autre téléphone, ou une autre personne, ne les voit pas. Rien n’est envoyé à un serveur, sauf si tu actives toi-même la synchro ci-dessous.

Deux bibliothèques (par exemple une par personne) sont déjà prévues. Tu peux les renommer.

## Ne pas perdre ses livres

Dans **Réglages** (engrenage) :

- **Exporter JSON** : une copie complète (livres, notes, photos). Garde ce fichier.
- **Importer** : pour retrouver cette copie sur un autre appareil, ou après un changement de navigateur. Par défaut les livres sont fusionnés. « Remplacer » écrase la liste de cet appareil (une sauvegarde automatique est gardée juste avant).

Un rappel apparaît si aucun export n’a été fait depuis un mois.

## Synchro entre tes appareils (facultative)

Tu n’en as pas besoin pour utiliser l’application.

Si tu veux la même bibliothèque sur plusieurs appareils :

1. Sur GitHub, crée un jeton **classique** avec **uniquement** la case **gist** : [créer le jeton](https://github.com/settings/tokens/new?scopes=gist&description=Ma%20biblioth%C3%A8que). Ne coche rien d’autre.
2. Dans l’application : Réglages → colle le jeton → **Enregistrer et synchroniser**. Le premier appareil crée un gist privé.
3. Sur les autres appareils, colle **le même jeton**.

Le jeton reste sur l’appareil. Il n’est pas mis dans le fichier JSON. Les étapes détaillées (jeton classique ou fine-grained) sont dans les réglages. Pour le retirer : « Oublier le jeton », puis révoque-le sur GitHub si tu ne t’en sers plus.

## Ce que l’application sait faire

Ajout par ISBN ou scan, séries et tomes manquants, liste d’envies, « lu » au mois, lectures en cours, notes, deux bibliothèques, papier ou Kindle, prochaines sorties (Wikipédia et BnF). Les statistiques détaillées sont dans l’onglet Stats.

## Application Android (Google Play)

Le cœur de l’application est gratuit. Sur le **site**, les statistiques le sont aussi.

Dans l’**application Play** (emballage Trusted Web Activity), les statistiques détaillées sont proposées avec un abonnement d’environ 1 € par mois, payé à Google Play. Le prix exact est celui du Play Store. Identifiant du produit à créer : `premium_mensuel`.

Fichiers préparés dans le dépôt :

- `twa/twa-manifest.json` — projet Bubblewrap, facturation Play activée. Le nom de paquet est `io.github.blood63.mabibliotheque` (à ne plus changer après la première publication).
- `.well-known/assetlinks.json` — lien entre le site et l’application. L’empreinte SHA-256 est un **placeholder** (que des zéros) : à remplacer par celle de ta clé de signature.
- `billing/worker.js` — petit serveur qui confirme l’abonnement auprès de Google et accuse réception. Sans lui, Play rembourse un achat non confirmé au bout de 3 jours. L’adresse du serveur se met dans `BILLING_API` dans `index.html` (vide pour l’instant).
- `confidentialite.html` — page à indiquer dans la fiche Play.

Ce dépôt est un site de projet (`blood63.github.io/ma-bibliotheque/`). Android cherche `assetlinks.json` à la **racine du domaine** (`https://blood63.github.io/.well-known/assetlinks.json`), pas dans le sous-dossier. Il faut soit copier le fichier dans un dépôt `blood63.github.io`, soit utiliser un nom de domaine à toi pointé sur ce site.

La checklist Play Console (compte développeur, paiement, abonnement, clé, fiche) est dans la description de la pull request : une partie ne peut pas être faite depuis le code.

## Confidentialité

[confidentialite.html](confidentialite.html)

## Pour modifier le code

Un seul fichier `index.html`, plus `releases.js` et `sw.js`. Pas d’étape de build. Tests : `node tests/pure.test.js`.

Les clés de stockage (`maBibliotheque.v1` et la suite) ne changent pas d’une version à l’autre : une bibliothèque déjà présente sur un appareil est conservée.

Licences des composants embarqués : `vendor/LICENSE-*`.
