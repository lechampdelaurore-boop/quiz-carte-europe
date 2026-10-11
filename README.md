# Europe à la carte

Jeu de géographie en français pour reconnaître **51 pays d'Europe** sur une carte interactive. On peut répondre en choisissant parmi six noms ou en écrivant le nom du pays. Le jeu fonctionne dans un navigateur sur ordinateur et sur mobile.

## Jouer

Ouvrir [le jeu publié sur GitHub Pages](https://lechampdelaurore-boop.github.io/quiz-carte-europe/), ou `index.html` dans un navigateur. Cliquer ou toucher un pays sur la carte. Les huit petits pays difficiles à toucher ont aussi un point circulaire. Par défaut, le bouton **Choisir un pays au hasard** privilégie les pays qui n'ont pas encore été trouvés.

Le bouton **Réglages** (engrenage) permet de choisir :

- **QCM** : six noms distincts, un seul correct ;
- **Réponse libre** : saisir le nom du pays et valider avec Entrée ou le bouton. Les accents, articles, espaces, tirets et petites fautes de frappe sont tolérés. Le nom exact d'un autre pays reste une mauvaise réponse ;
- **Découverte** : tirer en priorité les pays non trouvés ; **Tous les pays** : tirage uniforme ; **À réviser** : tirer les pays déjà ratés en donnant plus de chances aux plus difficiles. Si aucune erreur n'a encore été enregistrée, ce dernier mode reprend le tirage « Découverte » ;
- **Mode chronométré** : activer un compte à rebours pour chaque question et choisir librement sa durée entre 1 et 3 600 secondes. Le temps restant apparaît dans le quiz. Si le temps expire, la question compte comme une erreur, le bon pays est révélé et l'on peut continuer normalement. Le chrono s'arrête dès qu'une réponse est donnée ou que la question est fermée ; il se met en pause pendant l'ouverture des réglages ou de l'historique.

Le choix des réglages est conservé dans ce navigateur et s'applique à la prochaine question. Un clic direct sur la carte permet toujours de choisir n'importe quel pays, quel que soit le mode de tirage. Le nom d'un pays déjà trouvé apparaît dans une petite étiquette au survol sur ordinateur. Sur mobile, un premier toucher montre son nom pendant quelques secondes ; un second toucher sur ce pays ouvre une nouvelle question. Les pays encore inconnus ne dévoilent pas leur nom.

La carte se déplace en la faisant glisser et se zoome avec la molette, un pincement à deux doigts ou les boutons +/−. Au dézoom, un fond géographique prolonge l'Europe vers l'Atlantique, l'Afrique du Nord et l'Asie occidentale, sans afficher la carte du monde entière. Sur ordinateur, le bouton **Choisir un pays au hasard** se trouve entre **Mon atlas** et le quiz ; la question apparaît juste en dessous, à côté de la carte. La case **Zoom automatique sur le pays**, cochée par défaut, recentre la carte avec un léger agrandissement à chaque nouvelle question. Ce choix est enregistré dans le navigateur. Sur mobile, le quiz apparaît sous **Mon atlas** et comprend un aperçu du pays sélectionné ; la case de zoom automatique est masquée et la carte ne se recentre pas toute seule.

Une bonne réponse rapporte **10 points lors de la première identification du pays**, dans les deux modes. Après chaque réponse, une fenêtre animée verte ou rouge indique clairement le résultat et le bon pays. Cliquer ou toucher cette fenêtre lance une autre question ; le bouton **Un autre pays** reste disponible dans le quiz si la fenêtre est fermée avec Échap. Une mauvaise réponse laisse le pays disponible pour un nouvel essai. Le compteur de série augmente après chaque bonne réponse et revient à zéro après une erreur. La progression est enregistrée dans le `localStorage` du navigateur, avec un historique daté des réponses et des compteurs permanents de réussites et d'erreurs par pays. Le bouton **Historique** dans **Mon atlas** affiche les 51 pays classés par nombre d'erreurs, avec le nombre d'essais ; les dernières réponses sont consultables en bas de cette fenêtre. Le mode « À réviser » utilise les mêmes compteurs. Ces données restent propres à ce profil de navigateur et à cet appareil : il n'y a pas de compte ni de synchronisation. **Recommencer à zéro** efface aussi cet historique après confirmation, mais conserve les réglages.

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

1. Ouvrir le jeu en mode QCM et choisir un pays : six réponses doivent apparaître, une seule étant correcte.
2. Donner une bonne réponse : le score gagne 10 points et le pays devient vert.
3. Recharger : le score et le pays trouvé restent présents.
   Survoler ce pays : son nom doit apparaître dans la carte ; quitter le pays : l'étiquette disparaît. Sur mobile, le toucher une fois montre son nom sans ouvrir le quiz ; le toucher une seconde fois ouvre le quiz. Un pays non découvert n'affiche pas de nom.
4. Donner une mauvaise réponse : le bon nom est révélé, sans nouveau point.
   Vérifier dans `localStorage` (`atlas-club-europe-v1`) que chaque réponse ajoute un événement à `history` et met à jour les compteurs du pays ; recharger et vérifier leur conservation.
   Vérifier que les fenêtres de bonne et de mauvaise réponse sont distinctes, et qu'un clic ou un appui sur chacune ouvre un autre pays.
   Ouvrir **Historique** : les pays les plus ratés doivent apparaître en tête. Rater deux fois le même pays, rouvrir l'historique puis recharger la page : le compteur doit avoir augmenté de deux et rester enregistré.
5. Sur ordinateur à 100 %, vérifier que la page entière tient à l'écran, que **Mon atlas** mesure moins de la moitié de la carte et que le quiz apparaît juste en dessous.
6. Faire glisser la carte à la souris : elle doit se déplacer sans ouvrir de question. Dézoomer : les contours doivent continuer derrière l'Europe, sans bord rectangulaire net. Vérifier la molette et les boutons +/−.
7. Tirer un pays au hasard avec la case **Zoom automatique** cochée : la carte se recentre. Décocher la case et recommencer : la carte ne doit pas bouger.
8. Dans **Réglages**, choisir **Réponse libre** et **À réviser** : le tirage doit privilégier les pays ratés. Une faute légère ou un accent omis doit être accepté ; le nom d'un autre pays doit être refusé. Recharger et vérifier que les choix restent cochés.
9. Sur mobile, ouvrir une question dans chaque mode : l'aperçu de la zone et les réponses doivent être utilisables. Vérifier le glissement et le pincement à deux doigts.
10. Dans **Réglages**, activer le mode chronométré, saisir une durée valide et recharger : l'option et la durée doivent être conservées. Une valeur négative, nulle, non entière ou supérieure à 3 600 doit être refusée.
11. Ouvrir une question : le compte à rebours doit être visible et décroître. Le laisser atteindre zéro : une seule erreur et un événement `timedOut: true` doivent être enregistrés, y compris en QCM, puis la question suivante doit rester accessible. Répondre avant zéro : le décompte s'arrête. Désactiver le mode et ouvrir une question : aucun chronomètre ne doit apparaître.

Les détails du fonctionnement et les choix à conserver lors d'une reprise se trouvent dans [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
