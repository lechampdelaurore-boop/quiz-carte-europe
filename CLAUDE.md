# Reprendre ce projet

Lis `README.md` puis `docs/ARCHITECTURE.md` avant de modifier le jeu.

Il s'agit d'une application statique en français, sans framework et sans dépendances à installer. Pour la lancer : `node scripts/serve.mjs`, puis ouvrir `http://127.0.0.1:8765/`.

Les règles importantes sont : 51 pays, six réponses distinctes par question, 10 points pour la première bonne réponse de chaque pays, progression dans `localStorage` sous `atlas-club-europe-v1`, et utilisation sur ordinateur comme sur mobile. Les petits pays sont accessibles par des points sur la carte. La molette, le pincement à deux doigts et les boutons règlent le zoom. Sur mobile, la question montre un aperçu de la zone.

Ne modifie pas `map-data.js` à la main. Modifie `scripts/generate-map.mjs`, puis lance `node scripts/generate-map.mjs` pour régénérer la carte. La révision de Natural Earth est épinglée dans le script.

Après une modification, vérifie les scénarios de la section « Vérification rapide » du README, ainsi que les éventuelles erreurs JavaScript dans le navigateur. Déploie la branche `main` sur GitHub Pages si le dépôt utilise cette publication.
