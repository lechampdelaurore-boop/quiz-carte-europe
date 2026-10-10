# Architecture et décisions

## Vue d'ensemble

Application statique sans framework ni serveur applicatif. `index.html` charge `map-data.js`, qui expose `window.EUROPE_MAP`, puis `app.js`. L'interface est construite avec HTML, CSS et SVG. Aucun compte utilisateur n'est requis.

`map-data.js` contient :

- `width` et `height` : dimensions du repère SVG ;
- `countries` : 51 objets `{ id, name, d }`, avec le code pays, le nom français et le tracé SVG ;
- `context` : tracés neutres des pays voisins ;
- `pins` : coordonnées de huit petits pays pour créer des cibles tactiles plus larges.

Les tracés proviennent de Natural Earth 1:10m. `scripts/generate-map.mjs` télécharge une révision épinglée, retient une liste explicite de 51 pays, projette les coordonnées en Mercator et écrit `map-data.js`. Les pays extérieurs à la liste servent seulement de contexte. Si le périmètre géographique change, modifier la liste des noms et éventuellement les points dans ce script, puis régénérer la carte.

## Cycle d'une question

1. Un clic, une activation clavier ou le bouton aléatoire choisit un identifiant de pays.
2. `openQuestion` tire cinq autres pays distincts, mélange les six choix et ouvre la fenêtre.
3. `submitAnswer` accepte une seule réponse, révèle la bonne et met à jour la progression.
4. Le bouton « Un autre pays » privilégie un pays encore non trouvé. Une fois les 51 pays trouvés, il peut proposer n'importe quel pays.

Un pays correctement identifié la première fois rapporte 10 points. Les bonnes réponses répétées prolongent la série sans ajouter de points. Les erreurs remettent la série à zéro. Le pourcentage de l'atlas correspond au nombre de pays trouvés au moins une fois divisé par 51. Un pays raté reste disponible.

## Sauvegarde

Clé `localStorage` : `atlas-club-europe-v1`. Format :

```json
{
  "stats": {
    "FRA": { "attempts": 2, "mastered": true }
  },
  "score": 10,
  "streak": 1
}
```

Les erreurs de lecture ou d'écriture du stockage n'empêchent pas de jouer ; dans ce cas, la partie courante reste en mémoire seulement. Il n'y a pas de synchronisation entre appareils.

## Interface et accessibilité

Les pays de la carte sont des éléments SVG activables au clic, avec Entrée ou Espace. Les noms ne figurent pas dans leur étiquette accessible afin de ne pas donner la réponse avant la question. La fenêtre garde le focus à l'intérieur et se ferme avec Échap. Les couleurs de correction s'accompagnent d'un texte explicite.

Sur mobile, la carte conserve une largeur minimale pour permettre de toucher les pays et défile dans son conteneur. Les huit points agrandissent les petites cibles. La fenêtre affiche un aperçu centré sur la zone sélectionnée pour que l'emplacement reste visible même si la carte principale est masquée. Le zoom change la largeur du SVG, tout en conservant sous le pointeur ou au centre des doigts le même lieu sur la carte. Il est déclenché par la molette, un pincement à deux doigts ou les boutons +/−.

## Déploiement

Tous les fichiers nécessaires au jeu sont à la racine du dépôt. GitHub Pages peut servir la branche `main`, dossier `/ (root)`, sans étape de build. Le script de génération et la documentation sont ignorés par le navigateur tant qu'ils ne sont pas ouverts directement.

## Points d'attention pour les évolutions

- Garder **exactement six réponses distinctes**, dont celle du pays sélectionné.
- Préserver la clé de sauvegarde ou prévoir une migration si le format change.
- Mettre à jour la liste des noms, les points et la documentation ensemble si le périmètre passe de 51 pays à un autre total.
- Vérifier le clic sur les petits pays et l'aperçu de question après toute modification de la projection ou de la carte.
- Vérifier le zoom à la molette et au pincement après toute modification du conteneur de carte ou de ses règles `touch-action`.
- Ne pas ajouter le fichier GeoJSON mondial complet au dépôt : `map-data.js` est la version préparée pour le jeu.
