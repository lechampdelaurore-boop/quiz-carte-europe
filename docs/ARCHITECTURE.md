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
2. `openQuestion` tire cinq autres pays distincts, mélange les six choix et affiche le panneau de quiz sous « Mon atlas ».
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

Les pays de la carte sont des éléments SVG activables au clic, avec Entrée ou Espace. Les noms ne figurent pas dans leur étiquette accessible afin de ne pas donner la réponse avant la question. Le quiz est un panneau dans le flux de la page, sous « Mon atlas » sur ordinateur. Il se ferme avec Échap ou son bouton de fermeture. Les couleurs de correction s'accompagnent d'un texte explicite.

Sur ordinateur, le bandeau est compact et la page tient dans la hauteur du navigateur à 100 % ; le panneau « Mon atlas » mesure moins de la moitié de la carte. Sur mobile, les blocs se superposent et la page peut défiler. Les huit points agrandissent les petites cibles. Le panneau de quiz affiche un aperçu centré sur la zone sélectionnée sur mobile.

Le SVG de la carte est positionné dans un conteneur fixe. `renderMap` applique le zoom et le déplacement `panX/panY` ; le niveau initial ajuste la carte à la hauteur disponible. Le glissement à la souris ou au doigt déplace la carte, et un seuil de cinq pixels distingue ce geste d'un clic sur un pays. La molette, les boutons +/− et le pincement à deux doigts modifient le zoom autour du pointeur ou du centre des doigts.

La case **Zoom automatique sur le pays** est cochée par défaut. `focusCountry` utilise le centre du tracé SVG ou le point d'un petit État, place ce point au centre du conteneur et applique un zoom de 1,55. La préférence est conservée sous la clé `atlas-club-auto-zoom`, séparément du score.

## Déploiement

Tous les fichiers nécessaires au jeu sont à la racine du dépôt. GitHub Pages peut servir la branche `main`, dossier `/ (root)`, sans étape de build. Le script de génération et la documentation sont ignorés par le navigateur tant qu'ils ne sont pas ouverts directement.

## Points d'attention pour les évolutions

- Garder **exactement six réponses distinctes**, dont celle du pays sélectionné.
- Préserver la clé de sauvegarde ou prévoir une migration si le format change.
- Mettre à jour la liste des noms, les points et la documentation ensemble si le périmètre passe de 51 pays à un autre total.
- Vérifier le clic sur les petits pays et l'aperçu de question après toute modification de la projection ou de la carte.
- Vérifier le glissement, le zoom à la molette, le pincement et le centrage automatique après toute modification du conteneur de carte ou de ses règles `touch-action`.
- Ne pas ajouter le fichier GeoJSON mondial complet au dépôt : `map-data.js` est la version préparée pour le jeu.
