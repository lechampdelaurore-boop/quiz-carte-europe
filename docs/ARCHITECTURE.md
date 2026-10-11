# Architecture et décisions

## Vue d'ensemble

Application statique sans framework ni serveur applicatif. `index.html` charge `map-data.js`, qui expose `window.EUROPE_MAP`, puis `app.js`. L'interface est construite avec HTML, CSS et SVG. Aucun compte utilisateur n'est requis.

`map-data.js` contient :

- `width` et `height` : dimensions du repère SVG ;
- `countries` : 54 objets `{ id, name, d }`, avec l'identifiant de zone, le nom français et le tracé SVG ;
- `context` : tracés neutres des terres autour de l'Europe, y compris sous les pays jouables ;
- `contextExtent` : limites projetées du fond, utilisées pour borner le glissement ;
- `pins` : coordonnées de dix petites zones pour créer des cibles tactiles plus larges, notamment sur le pays de Galles et l'Irlande du Nord.

Les tracés proviennent de Natural Earth 1:10m. `scripts/generate-map.mjs` télécharge une révision épinglée d'Admin 0 Countries et d'Admin 0 Map Units, retient une liste explicite de 50 pays plus les quatre territoires du Royaume-Uni, projette les coordonnées en Mercator et écrit `map-data.js`. La forme `GBR` reste dans le fond neutre et ses quatre unités cartographiques `ENG`, `SCT`, `WLS` et `NIR` deviennent les zones cliquables. L'Irlande (`IRL`) reste indépendante. Les réponses restent limitées à l'Europe ; le fond couvre une région plus large (longitude −80° à 120°, latitude 0° à 85°) pour éviter une coupure visible au dézoom. Si le périmètre géographique change, modifier les listes des noms et éventuellement les points dans ce script, puis régénérer la carte.

## Cycle d'une question

1. Un clic, une activation clavier ou le bouton aléatoire choisit un identifiant de pays. Un clic direct sur la carte ignore le filtre de tirage.
2. `openQuestion` fige le mode de réponse et l'état du chronomètre pour cette question. En QCM, il tire cinq autres pays distincts et mélange les six choix. En réponse libre, il affiche un formulaire sans noms proposés. Si le mode chronométré est actif, un nouveau décompte commence avec la durée enregistrée.
3. `submitAnswer` accepte une seule réponse, arrête le décompte, révèle la bonne, met à jour la progression et ouvre `result-dialog`, avec une animation différente selon le résultat. Un formulaire vide ne compte pas comme une tentative. À zéro, `tickQuestionTimer` appelle `submitAnswer(null, null, true)` : l'expiration compte comme une erreur, sans choix fabriqué, et reçoit `timedOut: true` dans l'historique.
4. Le bouton dans la fenêtre de résultat et « Un autre pays » appellent tous deux `nextQuestion`, qui applique le filtre et la pondération choisis dans les réglages. Échap ferme la fenêtre de résultat et rend le bouton du quiz accessible.

Les réglages sont conservés sous `atlas-club-settings-v1` (`answerMode: "qcm" | "open"`, `countrySelection: "discover" | "all" | "review"`, `timedMode: boolean`, `timerSeconds: 1..3600`). Les anciennes sauvegardes de réglages chargent le mode chronométré désactivé et une durée par défaut de 30 secondes. Une saisie invalide n'est pas enregistrée et empêche la fermeture des réglages tant que le mode est activé. Les réglages s'appliquent à la prochaine question et ne sont pas effacés par « Recommencer à zéro ». Le tirage « Découverte » utilise les pays non trouvés, puis tous les pays si l'atlas est complet. « Tous les pays » est uniforme. « À réviser » utilise les pays ayant `wrongAttempts > 0` ; leur poids est `1 + min(6, wrongAttempts) + 4 × wrongAttempts / (correctAttempts + wrongAttempts)`. Le dernier pays tiré est écarté quand le groupe en contient plusieurs. Sans erreur enregistrée, « À réviser » reprend le tirage « Découverte ». Les anciennes tentatives dont le résultat est inconnu ne sont pas utilisées dans cette pondération.

Le décompte utilise une échéance `Date.now()` recalculée à chaque intervalle de 250 ms, pour éviter que les retards d'intervalle rallongent la question. Il s'arrête à la réponse, à la fermeture ou au remplacement de la question. L'ouverture des dialogues Réglages et Historique le met en pause ; leur fermeture reprend le temps restant. Le réglage peut changer pendant la pause, mais la question en cours garde son mode initial. Sans mode chronométré, aucun intervalle n'est lancé.

Pour la réponse libre, `normalizeCountryName` ignore majuscules, accents, articles initiaux, ponctuation et espaces multiples. `editDistance` compte l'échange de deux lettres voisines comme une seule faute. Un nom de quatre caractères ou moins doit être exact ; de cinq à neuf caractères, une faute est permise ; au-delà, deux fautes. `matchTypedCountry` cherche la zone reconnue la plus proche parmi les 54 noms et les variantes explicites « République tchèque » et « Bélarus ». Une égalité entre zones est refusée, et taper exactement le nom d'une autre zone reste une erreur. Le nom saisi est limité à 80 caractères.

Une zone correctement identifiée la première fois rapporte 10 points. Les bonnes réponses répétées prolongent la série sans ajouter de points. Les erreurs remettent la série à zéro. Le pourcentage de l'atlas correspond au nombre de zones trouvées au moins une fois divisé par 54. Une zone ratée reste disponible.

## Sauvegarde

Clé `localStorage` : `atlas-club-europe-v1`. Le format actuel porte `schemaVersion: 3` :

```json
{
  "schemaVersion": 3,
  "stats": {
    "FRA": {
      "attempts": 4,
      "mastered": true,
      "correctAttempts": 1,
      "wrongAttempts": 2,
      "legacyAttempts": 1,
      "lastAttemptAt": "2026-10-11T13:00:00.000Z"
    }
  },
  "score": 10,
  "streak": 0,
  "history": [
    { "countryId": "FRA", "chosenId": "DEU", "correct": false, "at": "2026-10-11T11:00:00.000Z", "mode": "qcm" },
    { "countryId": "FRA", "chosenId": "FRA", "correct": true, "at": "2026-10-11T12:00:00.000Z", "mode": "open", "enteredText": "Frnace" },
    { "countryId": "FRA", "chosenId": null, "correct": false, "at": "2026-10-11T13:00:00.000Z", "mode": "qcm", "timedOut": true }
  ],
  "historyDropped": 0
}
```

`stats` contient les cumuls permanents par pays : `attempts` pour toutes les réponses, `correctAttempts` et `wrongAttempts` pour les réponses connues, `legacyAttempts` pour les tentatives faites avant l'ajout de l'historique, et `mastered` pour un pays déjà trouvé au moins une fois. `lastAttemptAt` est la date UTC ISO 8601 de la dernière réponse connue, ou `null`. `score` et `streak` conservent leurs règles actuelles. Une réponse crée un seul événement dans `history`, avec le pays demandé, le choix reconnu, le résultat, la date UTC et le mode ; les événements sont dans l'ordre des réponses. En mode libre, `enteredText` conserve le texte saisi ; `chosenId` vaut `null` si aucun pays n'a été reconnu. Une expiration a `chosenId: null` et `timedOut: true`, même en QCM. Les événements créés avant la version 3 peuvent ne pas avoir de champ `mode` : ils proviennent du QCM.

Au chargement, les anciennes sauvegardes sous la même clé sont normalisées sans perdre score, série, pays trouvés ou nombre de tentatives. Les statistiques et événements `GBR` de l'ancien quiz sont conservés comme archive, sans être attribués à une des quatre nouvelles zones ; le score gagné auparavant reste acquis. `GBR` n'est plus proposé et ne compte plus dans la progression sur 54. Le résultat des tentatives antérieures à l'historique ne peut pas être déduit : leur nombre va dans `legacyAttempts`, sans événement fabriqué. L'historique détaillé garde au plus les **5 000 réponses les plus récentes** pour éviter de saturer `localStorage`. `historyDropped` compte les événements détaillés écartés ; les cumuls dans `stats` restent conservés.

« Recommencer à zéro » efface aussi les statistiques et l'historique. Les erreurs de lecture ou d'écriture du stockage n'empêchent pas de jouer ; dans ce cas, la partie courante reste en mémoire seulement. Il n'y a ni compte ni synchronisation entre appareils : deux personnes dans le même profil de navigateur partagent cette sauvegarde.

La fenêtre Historique lit directement `stats[*].wrongAttempts`, qui reste exact même quand les événements les plus anciens ont quitté la liste limitée à 5 000. Elle montre les 54 zones jouables triées par erreurs décroissantes et une ligne « Royaume-Uni (ancien quiz) » si des statistiques `GBR` existaient, puis les 20 réponses les plus récentes. Le mode « À réviser » ne tire que les zones jouables. Aucun nouveau format de progression ni recalcul à partir des seuls événements n'est nécessaire.

## Interface et accessibilité

Les pays de la carte sont des éléments SVG activables au clic, avec Entrée ou Espace. Le nom d'un pays non découvert ne figure jamais dans son étiquette accessible. Dès qu'il est trouvé, son étiquette accessible donne son nom, et `map-tooltip` l'affiche au survol ou au focus. Sur écran tactile, un premier toucher sur un pays trouvé affiche l'étiquette pendant quatre secondes sans ouvrir le quiz ; un second toucher sur le même pays ouvre le quiz. Déplacement, zoom et sélection d'un autre pays masquent l'étiquette. Les dix points suivent les mêmes règles que les tracés. Le quiz est un panneau dans le flux de la page, sous « Mon atlas » sur ordinateur. Il se ferme avec Échap ou son bouton de fermeture. Le menu « Réglages », l'historique et la fenêtre de résultat sont des dialogues modaux natifs, accessibles au clavier. Le temps restant utilise `role="timer"` sans annonce vocale chaque seconde. Le résultat est aussi annoncé par du texte ; les animations sont désactivées avec `prefers-reduced-motion: reduce`.

Sur ordinateur, le bandeau est compact et la page tient dans la hauteur du navigateur à 100 % ; le panneau « Mon atlas » mesure moins de la moitié de la carte. Le bouton de tirage au hasard se trouve entre « Mon atlas » et le quiz. Sur mobile, les blocs se superposent et la page peut défiler. Les dix points agrandissent les petites cibles. Le panneau de quiz affiche un aperçu centré sur la zone sélectionnée sur mobile.

Le SVG de la carte est positionné dans un conteneur fixe, avec `overflow: visible` pour laisser apparaître les tracés situés hors du repère initial de l'Europe. `renderMap` applique le zoom et le déplacement `panX/panY` ; le niveau initial ajuste la carte à la hauteur disponible et le zoom minimal est 0,85. Le déplacement est borné par `contextExtent` pour ne pas exposer les bords du fond. Le glissement à la souris ou au doigt déplace la carte, et un seuil de cinq pixels distingue ce geste d'un clic sur un pays. La molette, les boutons +/− et le pincement à deux doigts modifient le zoom autour du pointeur ou du centre des doigts.

La case **Zoom automatique sur le pays** est cochée par défaut sur ordinateur et mobile. `focusCountry` utilise le centre du tracé SVG ou le point d'un petit État, place ce point au centre du conteneur et applique un zoom de 1,55. La préférence est conservée sous la clé `atlas-club-auto-zoom`, séparément du score. Sous 850 px, le quiz fournit aussi un aperçu de 130 px de haut, avec un cadrage légèrement plus large. `updateMiniMap` ajuste son rapport largeur/hauteur à l'espace réellement disponible une fois le quiz affiché.

## Déploiement

Tous les fichiers nécessaires au jeu sont à la racine du dépôt. GitHub Pages peut servir la branche `main`, dossier `/ (root)`, sans étape de build. Le script de génération et la documentation sont ignorés par le navigateur tant qu'ils ne sont pas ouverts directement. Après une modification de `app.js` ou `styles.css`, changer aussi son paramètre `v` dans `index.html` pour forcer le navigateur à charger la nouvelle version.

## Points d'attention pour les évolutions

- Garder **exactement six réponses distinctes en QCM**, dont celle du pays sélectionné ; ne pas les afficher en réponse libre.
- Vérifier la reconnaissance des 54 noms et des petites fautes, ainsi que le refus du nom exact d'une autre zone, après toute modification de `matchTypedCountry`.
- Préserver la clé de sauvegarde ou prévoir une migration si le format change.
- Mettre à jour la liste des noms, les points et la documentation ensemble si le périmètre passe de 54 zones à un autre total.
- Vérifier le clic sur les petits pays et l'aperçu de question après toute modification de la projection ou de la carte.
- Vérifier le glissement, le zoom à la molette, le pincement et le centrage automatique après toute modification du conteneur de carte ou de ses règles `touch-action`.
- Ne pas ajouter le fichier GeoJSON mondial complet au dépôt : `map-data.js` est la version préparée pour le jeu.
