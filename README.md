# Ma bibliothèque

Application web (PWA) pour suivre ses livres, mangas et BD : ajout par ISBN (Open Library / Google Books) ou scan du code-barres, séries de mangas avec tomes manquants, statut Possédé / Liste d'envies, case « Lu » avec date, note, statistiques de lecture par mois.

- Un seul fichier `index.html`, sans build, fonctionne hors ligne (service worker).
- Données dans le navigateur (localStorage, format versionné), export/import JSON et CSV.
- Synchronisation optionnelle entre appareils via un gist GitHub secret (`ma-bibliotheque-data.json`), même jeton que Suivi Montagne.

App : https://blood63.github.io/ma-bibliotheque/
