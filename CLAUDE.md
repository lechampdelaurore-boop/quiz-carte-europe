# Reprendre ce projet

Lis `README.md` puis `docs/ARCHITECTURE.md` avant de modifier le jeu.

Il s'agit d'une application statique en français, sans framework et sans dépendances à installer. Pour la lancer : `node scripts/serve.mjs`, puis ouvrir `http://127.0.0.1:8765/`.

Les règles importantes sont : 51 pays, six réponses distinctes en QCM ou un champ de réponse libre, et 10 points pour la première bonne réponse de chaque pays. Le menu « Réglages » choisit QCM/réponse libre et le tirage Découverte/Tous/À réviser ; il utilise `atlas-club-settings-v1` et s'applique à la prochaine question. La réponse libre tolère accents et petites fautes, mais refuse le nom exact d'un autre pays. La progression dans `localStorage` sous `atlas-club-europe-v1` est en version 3 : cumuls par pays et 5 000 dernières réponses datées, avec mode et texte saisi quand il existe. Voir le schéma, l'algorithme de correspondance et la migration dans `docs/ARCHITECTURE.md`. Le bouton de remise à zéro efface l'historique mais garde les réglages.

Le bouton « Historique » de « Mon atlas » affiche les 51 pays par nombre d'erreurs décroissant à partir de `stats[*].wrongAttempts`, plus les 20 réponses récentes. Le menu Réglages propose aussi un chrono par question de 1 à 3 600 secondes, conservé sous la même clé que les autres réglages. Une expiration appelle `submitAnswer(null, null, true)`, compte une erreur et écrit `timedOut: true` dans l'événement, même en QCM. Le chrono s'arrête à la réponse ou à la fermeture et se met en pause pendant les dialogues Réglages et Historique. Le mode normal ne lance pas d'intervalle. Garder la compatibilité des anciennes sauvegardes et la validation de la durée.

Après une réponse, `result-dialog` présente une animation verte ou rouge. Le clic sur cette fenêtre et le bouton « Un autre pays » utilisent le même `nextQuestion`. Échap ferme la fenêtre tout en laissant le bouton du quiz accessible. Garder le texte du résultat et la règle `prefers-reduced-motion` lors d'une modification visuelle.

Sur ordinateur à 100 %, la page entière tient à l'écran ; « Mon atlas » mesure moins de la moitié de la carte, le bouton de tirage au hasard est sous « Mon atlas » et le quiz juste en dessous. Les petits pays sont accessibles par des points sur la carte. La carte se déplace par glissement ; la molette, le pincement à deux doigts et les boutons règlent le zoom. Le fond géographique déborde du repère européen pour éviter une coupure au dézoom ; il est généré dans `map-data.js` depuis la source Natural Earth épinglée. La case de zoom automatique est enregistrée sous `atlas-club-auto-zoom`. Sur mobile (moins de 850 px), la case est masquée et le recentrage automatique désactivé ; la question montre un aperçu de la zone.

Un pays déjà trouvé révèle son nom dans `map-tooltip` au survol ou au focus. Sur mobile, le premier toucher révèle le nom et le second ouvre le quiz ; les pays inconnus restent anonymes. Les points des petits pays suivent le même comportement. Ne pas révéler le nom des pays non découverts dans les étiquettes accessibles.

Ne modifie pas `map-data.js` à la main. Modifie `scripts/generate-map.mjs`, puis lance `node scripts/generate-map.mjs` pour régénérer la carte. La révision de Natural Earth est épinglée dans le script.

Après une modification, vérifie les scénarios de la section « Vérification rapide » du README, ainsi que les éventuelles erreurs JavaScript dans le navigateur. Si `app.js` ou `styles.css` change, actualise aussi son paramètre `v` dans `index.html` pour éviter un ancien fichier en cache. Déploie la branche `main` sur GitHub Pages si le dépôt utilise cette publication.
