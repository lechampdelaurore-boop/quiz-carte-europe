# Europe à la carte

Jeu de géographie en français pour reconnaître **51 pays d'Europe** sur une carte interactive. Chaque question propose six noms et une seule bonne réponse. Le jeu fonctionne dans un navigateur sur ordinateur et sur mobile.

## Jouer

Ouvrir [le jeu publié sur GitHub Pages](https://lechampdelaurore-boop.github.io/quiz-carte-europe/), ou `index.html` dans un navigateur. Cliquer ou toucher un pays sur la carte. Les huit petits pays difficiles à toucher ont aussi un point circulaire. Le bouton **Choisir un pays au hasard** propose un pays qui n'a pas encore été trouvé.

La carte se déplace en la faisant glisser et se zoome avec la molette, un pincement à deux doigts ou les boutons +/−. Sur ordinateur, la question apparaît sous **Mon atlas**, à côté de la carte. La case **Zoom automatique sur le pays**, cochée par défaut, recentre la carte avec un léger agrandissement à chaque nouvelle question. Ce choix est enregistré dans le navigateur. Sur mobile, le quiz apparaît sous **Mon atlas** et comprend un aperçu du pays sélectionné.

Une bonne réponse rapporte **10 points lors de la première identification du pays**. Une mauvaise réponse révèle le nom et laisse le pays disponible pour un nouvel essai. Le compteur de série augmente après chaque bonne réponse et revient à zéro après une erreur. La progression est enregistrée dans le `localStorage` du navigateur ; elle reste propre à cet appareil et à ce navigateur. **Recommencer à zéro** efface cette sauvegarde après confirmation.

## Lancer en local

Le jeu est statique et ne nécessite ni installation ni compilation. Pour le servir avec Node.js 18 ou plus :

```bash
node scripts/serve.mjs
```

Ouvrir ensuite `http://127.0.0.1:8765/`. Le port peut être changé avec la variable d'environnement `PORT`.

Les polices Google Fonts sont facultatives : des polices locales de remplacement sont prévues hors ligne. La carte, les questions et la progression ne nécessitent aucun service distant.

## Modifier le projet

| Fichier | Rôle |
| --- | --- |
| `index.html` | Structure et textes de l'interface |
| `styles.css` | Styles ordinateur et mobile |
| `app.js` | Carte interactive, questions, score et sauvegarde |
| `map-data.js` | Tracés et noms des pays, générés à partir de Natural Earth |
| `scripts/generate-map.mjs` | Régénération des tracés à partir d'une révision épinglée |
| `scripts/serve.mjs` | Petit serveur local sans dépendance |
| `docs/ARCHITECTURE.md` | Règles techniques et points d'attention |
| `CLAUDE.md` | Contexte court pour reprendre le travail avec un agent de code |

Pour régénérer `map-data.js` à partir de la révision de Natural Earth épinglée dans le script :

```bash
node scripts/generate-map.mjs
```

Le script accepte aussi un fichier GeoJSON local en premier argument, par exemple `node scripts/generate-map.mjs countries.geojson`. La source complète n'est pas conservée dans ce dépôt ; seul le fichier de carte préparé est publié.

## Périmètre et source des données

La carte comprend les micro-États, le Kosovo et plusieurs pays transcontinentaux, notamment la Russie, la Turquie, le Kazakhstan et les pays du Caucase. Les territoires dépendants ne sont pas proposés comme réponses. Les frontières et la définition de l'Europe varient selon les sources.

Contours issus de [Natural Earth, Admin 0 Countries, échelle 1:10m](https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-admin-0-countries/) (données du domaine public). Le script épingle la révision `ca96624a56bd078437bca8184e78163e5039ad19` du dépôt source.

## Vérification rapide

1. Ouvrir le jeu et choisir un pays : six réponses doivent apparaître, une seule étant correcte.
2. Donner une bonne réponse : le score gagne 10 points et le pays devient vert.
3. Recharger : le score et le pays trouvé restent présents.
4. Donner une mauvaise réponse : le bon nom est révélé, sans nouveau point.
5. Sur ordinateur à 100 %, vérifier que la page entière tient à l'écran, que **Mon atlas** mesure moins de la moitié de la carte et que le quiz apparaît juste en dessous.
6. Faire glisser la carte à la souris : elle doit se déplacer sans ouvrir de question. Vérifier la molette et les boutons +/−.
7. Tirer un pays au hasard avec la case **Zoom automatique** cochée : la carte se recentre. Décocher la case et recommencer : la carte ne doit pas bouger.
8. Sur mobile, ouvrir une question : l'aperçu de la zone et les six réponses doivent être utilisables. Vérifier le glissement et le pincement à deux doigts.

Les détails du fonctionnement et les choix à conserver lors d'une reprise se trouvent dans [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
