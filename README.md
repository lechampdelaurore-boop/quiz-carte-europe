# Europe à la carte

Jeu de géographie en français pour reconnaître **54 zones d'Europe** sur une carte interactive. Le Royaume-Uni est partagé en Angleterre, Écosse, pays de Galles et Irlande du Nord ; l'Irlande reste une réponse distincte. On peut répondre en choisissant parmi six noms ou en écrivant le nom du pays ou territoire. Le jeu fonctionne dans un navigateur sur ordinateur et sur mobile.

## Jouer

Ouvrir [le jeu publié sur GitHub Pages](https://lechampdelaurore-boop.github.io/quiz-carte-europe/), ou `index.html` dans un navigateur. Cliquer ou toucher un pays sur la carte. Six très petites zones ont un repère discret avec une zone de clic élargie : Andorre, Liechtenstein, Monaco, Saint-Marin, Vatican et Malte. Le Luxembourg dispose uniquement d'une zone de clic élargie invisible ; le pays de Galles, l'Irlande du Nord et le Kosovo se sélectionnent directement par leur forme. Un pays reste jouable après une erreur ou une expiration du chrono, jusqu'à ce qu'il soit correctement trouvé. Le bouton **Choisir un pays au hasard** ne tire que les zones encore à trouver.

Le bouton **Réglages** (engrenage) permet de choisir :

- **QCM** : six noms distincts, un seul correct. Parmi les cinq autres, un pays partage une frontière terrestre avec la bonne réponse lorsqu'un tel voisin est jouable ; les quatre autres sont tirés au hasard. Pour une île sans voisin terrestre dans le quiz, les cinq autres sont aléatoires ;
- **Réponse libre** : saisir le nom du pays et valider avec Entrée ou le bouton. Les accents, articles, espaces, tirets et petites fautes de frappe sont tolérés. Le nom exact d'un autre pays reste une mauvaise réponse ;
- **Découverte** : privilégier les pays jamais joués ; **Tous les pays** : tirer uniformément parmi les pays encore à jouer ; **À réviser** : privilégier ceux ratés dans les parties précédentes, avec plus de chances pour les plus difficiles. Si aucun pays raté n'est encore disponible, ce mode tire parmi les autres zones à jouer ;
- **Mode chronométré** : activer un compte à rebours pour chaque question et choisir librement sa durée entre 1 et 3 600 secondes. Le temps restant apparaît dans le quiz. Si le temps expire, la question compte comme une erreur, le bon pays est révélé et l'on peut continuer normalement. Le chrono s'arrête dès qu'une réponse est donnée ou que la question est fermée ; il se met en pause pendant l'ouverture des réglages ou de l'historique.

Le choix des réglages est conservé dans ce navigateur et s'applique à la prochaine question. Un clic direct sur la carte permet de choisir un pays encore à trouver, quel que soit le mode de tirage. Après une bonne réponse, ce pays n'ouvre plus de question dans la partie en cours. Son nom apparaît dans une petite étiquette au survol sur ordinateur ou au toucher sur mobile. Les pays non trouvés ne dévoilent pas leur nom sur la carte.

La carte se déplace en la faisant glisser et se zoome avec la molette, un pincement à deux doigts ou les boutons +/−. Au dézoom, un fond géographique prolonge l'Europe vers l'Atlantique, l'Afrique du Nord et l'Asie occidentale, sans afficher la carte du monde entière. Sur ordinateur, le bouton **Choisir un pays au hasard** se trouve entre **Mon atlas** et le quiz ; la question apparaît juste en dessous, à côté de la carte. La case **Zoom automatique sur le pays**, cochée par défaut, recentre la carte avec un léger agrandissement à chaque nouvelle question, sur ordinateur comme sur mobile. Ce choix est enregistré dans le navigateur. Sur mobile, le quiz apparaît sous **Mon atlas** et comprend un aperçu plus grand du pays sélectionné, avec davantage de contexte géographique.

Une bonne réponse rapporte **10 points** dans la partie en cours. Après chaque réponse, une fenêtre animée verte ou rouge indique clairement le résultat et le bon pays. Cliquer ou toucher cette fenêtre lance une autre question disponible ; le bouton **Un autre pays** reste utilisable si la fenêtre est fermée avec Échap. Le compteur de série augmente après chaque bonne réponse et revient à zéro après une erreur. La progression de la partie est enregistrée dans le `localStorage` du navigateur : recharger la page conserve les pays trouvés et les erreurs. Quand les 54 zones ont été correctement trouvées, la partie se termine automatiquement avec un bilan des pays trouvés et des erreurs ; aucun autre quiz ne s'ouvre. **Nouvelle partie** remet à zéro les pays trouvés, les erreurs, le score et la série de la partie, tout en conservant l'historique daté et les compteurs cumulés de réussites et d'erreurs par pays. Le bouton **Historique** dans **Mon atlas** affiche les 54 zones jouables classées par nombre d'erreurs, avec le nombre d'essais ; les dernières réponses sont consultables en bas de cette fenêtre. Les anciennes statistiques du « Royaume-Uni » restent visibles comme ligne d'archive si elles existent, sans donner automatiquement la maîtrise des quatre nouveaux territoires. Le mode « À réviser » utilise les compteurs des zones jouables. Ces données restent propres à ce profil de navigateur et à cet appareil : il n'y a pas de compte ni de synchronisation. **Effacer toutes mes données**, dans l'historique, supprime la progression et les statistiques après confirmation, sans modifier les réglages.

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
| `tests/game-rules.cjs` | Vérification de la migration, des erreurs répétées, de la fin et de la nouvelle partie |
| `tests/qcm-neighbors.cjs` | Vérification des frontières et des six propositions du QCM |
| `tests/country-articles.cjs` | Vérification des noms avec article utilisés dans les messages (« la Roumanie », « les Pays-Bas ») |

Pour régénérer `map-data.js` à partir de la révision de Natural Earth épinglée dans le script :

```bash
node scripts/generate-map.mjs
```

Le script accepte les deux fichiers GeoJSON locaux en arguments, par exemple `node scripts/generate-map.mjs countries.geojson map-units.geojson`. Sans arguments, il télécharge les deux sources à la révision épinglée. Les sources complètes ne sont pas conservées dans ce dépôt ; seul le fichier de carte préparé est publié.

## Périmètre et source des données

La carte comprend les micro-États, le Kosovo et plusieurs pays transcontinentaux, notamment la Russie, la Turquie, le Kazakhstan et les pays du Caucase. Le Royaume-Uni, État souverain, est remplacé dans le quiz par ses quatre territoires constitutifs : Angleterre, Écosse, pays de Galles et Irlande du Nord. Les autres territoires dépendants ne sont pas proposés comme réponses. Les frontières et la définition de l'Europe varient selon les sources.

Contours issus de [Natural Earth, Admin 0 Countries](https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-admin-0-countries/) et [Admin 0 Map Units](https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-admin-0-details/), échelle 1:10m (données du domaine public). Le script épingle la révision `ca96624a56bd078437bca8184e78163e5039ad19` du dépôt source. L'[Office for National Statistics](https://service-manual.ons.gov.uk/content/language/countries-and-regions) énumère ces quatre composantes du Royaume-Uni.

## Vérification rapide

Lancer `node tests/game-rules.cjs`, `node tests/qcm-neighbors.cjs` et `node tests/country-articles.cjs` pour contrôler la partie, la persistance, les six propositions du QCM et les noms avec article des messages.

1. Ouvrir le jeu en mode QCM et choisir un pays : six réponses distinctes doivent apparaître, une seule étant correcte. Pour un pays avec frontières terrestres, au moins un distracteur doit être un voisin ; pour Chypre, l'Islande ou Malte, les cinq distracteurs sont aléatoires. Reposer plusieurs fois la question sur la Belgique pour vérifier que le voisin et l'ordre varient.
   Vérifier que l'Angleterre, l'Écosse, le pays de Galles et l'Irlande du Nord sont quatre zones distinctes et que l'Irlande n'est pas confondue avec l'Irlande du Nord.
2. Donner une bonne réponse : le score gagne 10 points et le pays devient vert.
3. Recharger : le score et le pays trouvé restent présents. Cliquer à nouveau sur ce pays, sur son éventuel repère ou l'activer au clavier ne doit pas ouvrir une question. Son nom doit apparaître au survol ou au toucher, sans permettre de le rejouer.
4. Donner trois mauvaises réponses pour un même pays : son compteur d'erreurs doit augmenter trois fois et ce pays doit rester sélectionnable. Puis donner la bonne réponse : il devient indisponible jusqu'à la prochaine partie.
   Vérifier dans `localStorage` (`atlas-club-europe-v1`) que chaque réponse ajoute un événement à `history` et met à jour les compteurs du pays ; recharger et vérifier leur conservation.
   Vérifier que les fenêtres de bonne et de mauvaise réponse sont distinctes, et qu'un clic ou un appui sur chacune ouvre un autre pays.
   Ouvrir **Historique** : les pays les plus ratés doivent apparaître en tête. Cliquer sur **Nouvelle partie**, rater le même pays à nouveau, puis recharger : son compteur cumulatif d'erreurs doit avoir augmenté et rester enregistré, alors que le score et les erreurs de la nouvelle partie ont été réinitialisés.
   Vérifier qu'un pays trouvé n'est jamais tiré au hasard, dans les trois modes de sélection ; une fois les 54 zones trouvées, vérifier le bilan final et l'impossibilité d'ouvrir un autre quiz. Le bouton **Nouvelle partie** doit permettre de rejouer les 54 zones. Vérifier que **Effacer toutes mes données** remet également l'historique à zéro.
5. Sur ordinateur à 100 %, vérifier que la page entière tient à l'écran, que **Mon atlas** mesure moins de la moitié de la carte et que le quiz apparaît juste en dessous.
6. Faire glisser la carte à la souris : elle doit se déplacer sans ouvrir de question. Dézoomer : les contours doivent continuer derrière l'Europe, sans bord rectangulaire net. Vérifier la molette et les boutons +/−. Aucun repère circulaire ne doit couvrir le pays de Galles, l'Irlande du Nord ou le Kosovo : leurs contours doivent rester cliquables. Les six repères des très petites zones doivent rester discrets, avec une cible tactile plus grande que leur diamètre visible ; le Luxembourg doit rester cliquable sans repère visible.
7. Tirer un pays au hasard avec la case **Zoom automatique** cochée : la carte se recentre. Décocher la case et recommencer : la carte ne doit pas bouger.
8. Dans **Réglages**, choisir **Réponse libre** et **À réviser** : le tirage doit privilégier les pays ratés. Une faute légère ou un accent omis doit être accepté ; le nom d'un autre pays doit être refusé. Recharger et vérifier que les choix restent cochés.
9. Sur mobile, ouvrir une question dans chaque mode : l'aperçu agrandi doit montrer le pays et ses alentours, et les réponses doivent être utilisables. Vérifier que la case de zoom automatique est visible, que le pays est recentré lorsqu'elle est cochée et que la carte garde sa position lorsqu'elle est décochée. Vérifier le glissement et le pincement à deux doigts.
10. Dans **Réglages**, activer le mode chronométré, saisir une durée valide et recharger : l'option et la durée doivent être conservées. Une valeur négative, nulle, non entière ou supérieure à 3 600 doit être refusée.
11. Ouvrir une question : le compte à rebours doit être visible et décroître. Le laisser atteindre zéro : une seule erreur et un événement `timedOut: true` doivent être enregistrés, y compris en QCM, puis la question suivante doit rester accessible. Répondre avant zéro : le décompte s'arrête. Désactiver le mode et ouvrir une question : aucun chronomètre ne doit apparaître.

Les détails du fonctionnement et les choix à conserver lors d'une reprise se trouvent dans [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
