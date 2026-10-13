# Ma bibliothèque

Application web (PWA) pour suivre ses livres, mangas et BD : ajout par ISBN ou scan du code-barres, séries de mangas avec tomes manquants, statut Possédé / Liste d'envies, case « Lu » avec le mois de lecture, note, statistiques de lecture par mois.

- Un seul fichier `index.html`, sans build, fonctionne hors ligne (service worker, cache `ma-bibliotheque-v7`).
- Données dans le navigateur (localStorage, format versionné), export/import JSON et CSV. Sauvegarde automatique avant « Effacer » / import « Remplacer », restaurable dans Réglages.
- Recherche ISBN sans clé d'API : **BnF** (ISBN-13 puis ISBN-10), **Sudoc** (bibliothèques universitaires), **Open Library** (API + recherche), Google Books en dernier recours ; couverture par ISBN (Open Library, BnF, Amazon). Si un tome est trop récent pour les catalogues, l'app reconnaît la série d'après les ISBN de tes tomes (même éditeur) et préremplit le tome suivant. ISBN-10 converti en ISBN-13, doublons signalés.
- Séries : noms rapprochés automatiquement (casse, accents, ponctuation, « Édition originale », « Tome N »), suggestions « Même série ? », **Fusionner…**, **Renommer**, « uniformiser » ; les renommages sont synchronisés (un tome ajouté ailleurs avec l'ancien nom rejoint la série).
- Scan du code-barres : BarcodeDetector natif (Android, macOS) sinon lecteur ZXing WebAssembly embarqué (`vendor/`, iPhone, Firefox, Windows) ; option « Photo du code-barres ».
- Lecture : on choisit seulement le **mois et l'année** (pas le jour). Dès qu'on coche « Lu » (couverture, liste, fiche, tome, « Tome suivant lu », « Tout lu… », sélection multiple), un sélecteur rapide s'ouvre : « Ce mois-ci » en un geste, mois précédents, autre mois/année ou « Lu (avant) » ; « Annuler » dans le toast. « Lu (avant) » : lu sans date — compte dans le total et le % de lus, pas dans les stats mensuelles ni l'objectif. Choix du mois partout (« Lu quand ? », formulaire, fiche) : année avec ‹ › (ou en glissant), toucher l'année pour la grille des années (jusqu'à 1990), puis grille de 12 mois en un geste ; mois futurs désactivés.
- **Deux bibliothèques** (par ex. une par personne), chacune avec son nom (renommable), ses livres, séries, statistiques et objectifs. Sélecteur sur l'accueil et pastille dans l'en-tête ; le choix est mémorisé par appareil. Un livre appartient à une bibliothèque : « Copier dans… » crée un exemplaire dans l'autre (lecture, note et notes restent personnelles), le formulaire permet de le déplacer. Carte « Comparer » dans les stats.
- **Format par livre** : Papier (par défaut) ou Kindle — chaque bibliothèque peut contenir les deux. Choix dans le formulaire, la fiche et la sélection multiple ; petit badge sur les couvertures Kindle, filtre « Format », stats par format.
- Objectif de lecture (par bibliothèque) : 5 par mois par défaut (anneau sur l'accueil), annuel = mensuel × 12 sauf réglage contraire (⚙️ Réglages).
- Suppression immédiate avec « Annuler » (7 s), aussi en sélection multiple.
- Synchronisation optionnelle entre appareils via un gist GitHub secret (`ma-bibliotheque-data.json`), même jeton que Suivi Montagne (le gist de Suivi Montagne n'est jamais modifié). Données v3 compatibles avec les anciennes versions : un ancien client conserve les bibliothèques et les formats ; ses nouveaux livres vont dans la bibliothèque 1.

App : https://blood63.github.io/ma-bibliotheque/

Licences des composants embarqués : `vendor/LICENSE-*` (barcode-detector, zxing-wasm — MIT ; moteur ZXing-C++ — Apache-2.0).
