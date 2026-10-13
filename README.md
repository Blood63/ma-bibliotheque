# Ma bibliothèque

Application web (PWA) pour suivre ses livres, mangas et BD : ajout par ISBN ou scan du code-barres, séries de mangas avec tomes manquants, statut Possédé / Liste d'envies, case « Lu » avec le mois de lecture, note, statistiques de lecture par mois.

- Un seul fichier `index.html`, sans build, fonctionne hors ligne (service worker, cache `ma-bibliotheque-v5`).
- Données dans le navigateur (localStorage, format versionné), export/import JSON et CSV. Sauvegarde automatique avant « Effacer » / import « Remplacer », restaurable dans Réglages.
- Recherche ISBN : catalogue de la **BnF** (livres, BD, mangas publiés en France : série, tome, auteurs, éditeur) + **Open Library** (couvertures), Google Books en dernier recours. ISBN-10 converti en ISBN-13, doublons signalés.
- Scan du code-barres : BarcodeDetector natif (Android, macOS) sinon lecteur ZXing WebAssembly embarqué (`vendor/`, iPhone, Firefox, Windows) ; option « Photo du code-barres ».
- Lecture : on choisit seulement le **mois et l'année** (pas le jour). Dès qu'on coche « Lu » (couverture, liste, fiche, tome, « Tome suivant lu », « Tout lu… », sélection multiple), un sélecteur rapide s'ouvre : « Ce mois-ci » en un geste, mois précédents, autre mois/année ou « Lu (avant) » ; « Annuler » dans le toast. « Lu (avant) » : lu sans date — compte dans le total et le % de lus, pas dans les stats mensuelles ni l'objectif.
- **Deux bibliothèques** (par ex. une par personne), chacune avec son nom (renommable), ses livres, séries, statistiques et objectifs. Sélecteur sur l'accueil et pastille dans l'en-tête ; le choix est mémorisé par appareil. Un livre appartient à une bibliothèque : « Copier dans… » crée un exemplaire dans l'autre (lecture, note et notes restent personnelles), le formulaire permet de le déplacer. Carte « Comparer » dans les stats.
- **Format par livre** : Papier (par défaut) ou Kindle — chaque bibliothèque peut contenir les deux. Choix dans le formulaire, la fiche et la sélection multiple ; petit badge sur les couvertures Kindle, filtre « Format », stats par format.
- Objectif de lecture (par bibliothèque) : 5 par mois par défaut (anneau sur l'accueil), annuel = mensuel × 12 sauf réglage contraire (⚙️ Réglages).
- Suppression immédiate avec « Annuler » (7 s), aussi en sélection multiple.
- Synchronisation optionnelle entre appareils via un gist GitHub secret (`ma-bibliotheque-data.json`), même jeton que Suivi Montagne (le gist de Suivi Montagne n'est jamais modifié). Données v3 compatibles avec les anciennes versions : un ancien client conserve les bibliothèques et les formats ; ses nouveaux livres vont dans la bibliothèque 1.

App : https://blood63.github.io/ma-bibliotheque/

Licences des composants embarqués : `vendor/LICENSE-*` (barcode-detector, zxing-wasm — MIT ; moteur ZXing-C++ — Apache-2.0).
