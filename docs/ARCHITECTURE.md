# Architecture et décisions

## Vue d'ensemble

Application statique sans framework ni serveur applicatif. `index.html` charge `map-data.js`, qui expose `window.EUROPE_MAP`, puis `app.js`. L'interface est construite avec HTML, CSS et SVG. Aucun compte utilisateur n'est requis.

`map-data.js` contient :

- `width` et `height` : dimensions du repère SVG ;
- `countries` : 51 objets `{ id, name, d }`, avec le code pays, le nom français et le tracé SVG ;
- `context` : tracés neutres des terres autour de l'Europe, y compris sous les pays jouables ;
- `contextExtent` : limites projetées du fond, utilisées pour borner le glissement ;
- `pins` : coordonnées de huit petits pays pour créer des cibles tactiles plus larges.

Les tracés proviennent de Natural Earth 1:10m. `scripts/generate-map.mjs` télécharge une révision épinglée, retient une liste explicite de 51 pays, projette les coordonnées en Mercator et écrit `map-data.js`. Les réponses restent limitées à l'Europe ; le fond couvre une région plus large (longitude −80° à 120°, latitude 0° à 85°) pour éviter une coupure visible au dézoom. Si le périmètre géographique change, modifier la liste des noms et éventuellement les points dans ce script, puis régénérer la carte.

## Cycle d'une question

1. Un clic, une activation clavier ou le bouton aléatoire choisit un identifiant de pays.
2. `openQuestion` tire cinq autres pays distincts, mélange les six choix et affiche le panneau de quiz sous « Mon atlas ».
3. `submitAnswer` accepte une seule réponse, révèle la bonne et met à jour la progression.
4. Le bouton « Un autre pays » privilégie un pays encore non trouvé. Une fois les 51 pays trouvés, il peut proposer n'importe quel pays.

Un pays correctement identifié la première fois rapporte 10 points. Les bonnes réponses répétées prolongent la série sans ajouter de points. Les erreurs remettent la série à zéro. Le pourcentage de l'atlas correspond au nombre de pays trouvés au moins une fois divisé par 51. Un pays raté reste disponible.

## Sauvegarde

Clé `localStorage` : `atlas-club-europe-v1`. Le format actuel porte `schemaVersion: 2` :

```json
{
  "schemaVersion": 2,
  "stats": {
    "FRA": {
      "attempts": 3,
      "mastered": true,
      "correctAttempts": 1,
      "wrongAttempts": 1,
      "legacyAttempts": 1,
      "lastAttemptAt": "2026-10-11T12:00:00.000Z"
    }
  },
  "score": 10,
  "streak": 1,
  "history": [
    { "countryId": "FRA", "chosenId": "DEU", "correct": false, "at": "2026-10-11T11:00:00.000Z" },
    { "countryId": "FRA", "chosenId": "FRA", "correct": true, "at": "2026-10-11T12:00:00.000Z" }
  ],
  "historyDropped": 0
}
```

`stats` contient les cumuls permanents par pays : `attempts` pour toutes les réponses, `correctAttempts` et `wrongAttempts` pour les réponses connues, `legacyAttempts` pour les tentatives faites avant l'ajout de l'historique, et `mastered` pour un pays déjà trouvé au moins une fois. `lastAttemptAt` est la date UTC ISO 8601 de la dernière réponse connue, ou `null`. `score` et `streak` conservent leurs règles actuelles. Une réponse crée un seul événement dans `history`, avec le pays demandé, le choix de l'utilisateur, le résultat et sa date UTC ; les événements sont dans l'ordre des réponses.

Au chargement, les anciennes sauvegardes sous la même clé sont normalisées sans perdre score, série, pays trouvés ou nombre de tentatives. Le résultat des anciennes tentatives ne peut pas être déduit : leur nombre va dans `legacyAttempts`, sans événement fabriqué. L'historique détaillé garde au plus les **5 000 réponses les plus récentes** pour éviter de saturer `localStorage`. `historyDropped` compte les événements détaillés écartés ; les cumuls dans `stats` restent conservés. Un futur menu de difficultés pourra classer les pays par taux d'erreur (`wrongAttempts / (correctAttempts + wrongAttempts)`) ou examiner les derniers événements de chaque pays ; il doit ignorer `legacyAttempts` dans ce calcul.

« Recommencer à zéro » efface aussi les statistiques et l'historique. Les erreurs de lecture ou d'écriture du stockage n'empêchent pas de jouer ; dans ce cas, la partie courante reste en mémoire seulement. Il n'y a ni compte ni synchronisation entre appareils : deux personnes dans le même profil de navigateur partagent cette sauvegarde.

## Interface et accessibilité

Les pays de la carte sont des éléments SVG activables au clic, avec Entrée ou Espace. Les noms ne figurent pas dans leur étiquette accessible afin de ne pas donner la réponse avant la question. Le quiz est un panneau dans le flux de la page, sous « Mon atlas » sur ordinateur. Il se ferme avec Échap ou son bouton de fermeture. Les couleurs de correction s'accompagnent d'un texte explicite.

Sur ordinateur, le bandeau est compact et la page tient dans la hauteur du navigateur à 100 % ; le panneau « Mon atlas » mesure moins de la moitié de la carte. Le bouton de tirage au hasard se trouve entre « Mon atlas » et le quiz. Sur mobile, les blocs se superposent et la page peut défiler. Les huit points agrandissent les petites cibles. Le panneau de quiz affiche un aperçu centré sur la zone sélectionnée sur mobile.

Le SVG de la carte est positionné dans un conteneur fixe, avec `overflow: visible` pour laisser apparaître les tracés situés hors du repère initial de l'Europe. `renderMap` applique le zoom et le déplacement `panX/panY` ; le niveau initial ajuste la carte à la hauteur disponible et le zoom minimal est 0,85. Le déplacement est borné par `contextExtent` pour ne pas exposer les bords du fond. Le glissement à la souris ou au doigt déplace la carte, et un seuil de cinq pixels distingue ce geste d'un clic sur un pays. La molette, les boutons +/− et le pincement à deux doigts modifient le zoom autour du pointeur ou du centre des doigts.

Sur ordinateur, la case **Zoom automatique sur le pays** est cochée par défaut. `focusCountry` utilise le centre du tracé SVG ou le point d'un petit État, place ce point au centre du conteneur et applique un zoom de 1,55. La préférence est conservée sous la clé `atlas-club-auto-zoom`, séparément du score. Sous 850 px, la case est masquée et le recentrage automatique désactivé : le quiz fournit déjà un aperçu du pays. La préférence enregistrée reste disponible lors du retour sur ordinateur.

## Déploiement

Tous les fichiers nécessaires au jeu sont à la racine du dépôt. GitHub Pages peut servir la branche `main`, dossier `/ (root)`, sans étape de build. Le script de génération et la documentation sont ignorés par le navigateur tant qu'ils ne sont pas ouverts directement.

## Points d'attention pour les évolutions

- Garder **exactement six réponses distinctes**, dont celle du pays sélectionné.
- Préserver la clé de sauvegarde ou prévoir une migration si le format change.
- Mettre à jour la liste des noms, les points et la documentation ensemble si le périmètre passe de 51 pays à un autre total.
- Vérifier le clic sur les petits pays et l'aperçu de question après toute modification de la projection ou de la carte.
- Vérifier le glissement, le zoom à la molette, le pincement et le centrage automatique après toute modification du conteneur de carte ou de ses règles `touch-action`.
- Ne pas ajouter le fichier GeoJSON mondial complet au dépôt : `map-data.js` est la version préparée pour le jeu.
