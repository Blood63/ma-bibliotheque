# Ma bibliothèque

Application web (PWA) pour suivre ses livres, mangas et BD : ajout par ISBN ou scan du code-barres, séries de mangas avec tomes manquants, statut Possédé / Liste d'envies, case « Lu » avec le mois de lecture, note, statistiques de lecture par mois.

- Un seul fichier `index.html`, sans build, fonctionne hors ligne (service worker, cache `ma-bibliotheque-v4`).
- Données dans le navigateur (localStorage, format versionné), export/import JSON et CSV. Sauvegarde automatique avant « Effacer » / import « Remplacer », restaurable dans Réglages.
- Recherche ISBN : catalogue de la **BnF** (livres, BD, mangas publiés en France : série, tome, auteurs, éditeur) + **Open Library** (couvertures), Google Books en dernier recours. ISBN-10 converti en ISBN-13, doublons signalés.
- Scan du code-barres : BarcodeDetector natif (Android, macOS) sinon lecteur ZXing WebAssembly embarqué (`vendor/`, iPhone, Firefox, Windows) ; option « Photo du code-barres ».
- Lecture : on choisit seulement le **mois et l'année** (pas le jour). « Lu (avant) » : lu sans date — compte dans le total et le % de lus, pas dans les stats mensuelles ni l'objectif.
- Objectif de lecture : 5 par mois par défaut (anneau sur l'accueil), annuel = mensuel × 12 sauf réglage contraire (⚙️ Réglages).
- Suppression immédiate avec « Annuler » (7 s), aussi en sélection multiple.
- Synchronisation optionnelle entre appareils via un gist GitHub secret (`ma-bibliotheque-data.json`), même jeton que Suivi Montagne (le gist de Suivi Montagne n'est jamais modifié).

App : https://blood63.github.io/ma-bibliotheque/

Licences des composants embarqués : `vendor/LICENSE-*` (barcode-detector, zxing-wasm — MIT ; moteur ZXing-C++ — Apache-2.0).
