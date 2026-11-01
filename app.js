(() => {
  'use strict';

  // Levels shown in the menu, in order. A level becomes playable when its data file is listed in
  // window.GEO_LEVEL_LIST (data/index.js, produced with the map data) or, for Europe, with map-data.js.
  const levelCatalog = [
    { id: 'france-regions', group: 'France', title: 'Les régions', noun: 'region' },
    { id: 'france-departements', group: 'France', title: 'Les départements', noun: 'departement' },
    { id: 'france-fleuves', group: 'France', title: 'Les fleuves et rivières', noun: 'coursDEau' },
    { id: 'europe', group: 'Europe', title: "Les pays d'Europe", noun: 'pays', file: 'map-data.js?v=20261011-small-markers' },
    { id: 'monde-continents', group: 'Monde', title: 'Les continents', noun: 'continent', focusZoom: 1 },
    { id: 'monde-afrique', group: 'Monde', title: "Pays d'Afrique", noun: 'pays' },
    { id: 'monde-amerique-nord', group: 'Monde', title: "Pays d'Amérique du Nord", noun: 'pays' },
    { id: 'monde-amerique-sud', group: 'Monde', title: "Pays d'Amérique du Sud", noun: 'pays' },
    { id: 'monde-asie', group: 'Monde', title: "Pays d'Asie", noun: 'pays' },
    { id: 'monde-oceanie', group: 'Monde', title: "Pays d'Océanie", noun: 'pays' }
  ];
  const nouns = {
    pays: { one: 'pays', many: 'pays', feminine: false },
    region: { one: 'région', many: 'régions', feminine: true },
    departement: { one: 'département', many: 'départements', feminine: false },
    coursDEau: { one: "cours d'eau", many: "cours d'eau", feminine: false },
    continent: { one: 'continent', many: 'continents', feminine: false },
    zone: { one: 'zone', many: 'zones', feminine: true }
  };
  // French wording for the current level's kind of zone ("ce pays", "cette région", "trouvées"...).
  function makeWords(noun) {
    const vowel = /^[aeiouyéèêh]/i.test(noun.one);
    return {
      ...noun,
      this: `${noun.feminine ? 'cette' : vowel ? 'cet' : 'ce'} ${noun.one}`,
      which: noun.feminine ? 'Quelle' : 'Quel',
      another: `${noun.feminine ? 'Une autre' : 'Un autre'} ${noun.one}`,
      count: n => `${n} ${n > 1 ? noun.many : noun.one}`,
      found: n => `trouvé${noun.feminine ? 'e' : ''}${n > 1 ? 's' : ''}`,
      missed: n => `raté${noun.feminine ? 'e' : ''}${n > 1 ? 's' : ''}`
    };
  }
  let level = null;
  let words = makeWords(nouns.pays);
  let map = null;
  let countries = [];
  let countryById = new Map();
  let neighbors = {};
  // Land borders between playable zones, from the pinned Natural Earth 10m countries and map units.
  // UK map units are separate quiz answers; islands without a playable land neighbor have [].
  const landNeighbors = {
    ALB: ['GRC', 'KOS', 'MKD', 'MNE'], AND: ['ESP', 'FRA'],
    ARM: ['AZE', 'GEO', 'TUR'], AUT: ['CHE', 'CZE', 'DEU', 'HUN', 'ITA', 'LIE', 'SVK', 'SVN'],
    AZE: ['ARM', 'GEO', 'RUS', 'TUR'], BEL: ['DEU', 'FRA', 'LUX', 'NLD'],
    BGR: ['GRC', 'MKD', 'ROU', 'SRB', 'TUR'], BIH: ['HRV', 'MNE', 'SRB'],
    BLR: ['LTU', 'LVA', 'POL', 'RUS', 'UKR'], CHE: ['AUT', 'DEU', 'FRA', 'ITA', 'LIE'],
    CYP: [], CZE: ['AUT', 'DEU', 'POL', 'SVK'],
    DEU: ['AUT', 'BEL', 'CHE', 'CZE', 'DNK', 'FRA', 'LUX', 'NLD', 'POL'],
    DNK: ['DEU'], ENG: ['SCT', 'WLS'], ESP: ['AND', 'FRA', 'PRT'],
    EST: ['LVA', 'RUS'], FIN: ['NOR', 'RUS', 'SWE'],
    FRA: ['AND', 'BEL', 'CHE', 'DEU', 'ESP', 'ITA', 'LUX', 'MCO'],
    GEO: ['ARM', 'AZE', 'RUS', 'TUR'], GRC: ['ALB', 'BGR', 'MKD', 'TUR'],
    HRV: ['BIH', 'HUN', 'MNE', 'SRB', 'SVN'],
    HUN: ['AUT', 'HRV', 'ROU', 'SRB', 'SVK', 'SVN', 'UKR'],
    IRL: ['NIR'], ISL: [], ITA: ['AUT', 'CHE', 'FRA', 'SMR', 'SVN', 'VAT'],
    KAZ: ['RUS'], KOS: ['ALB', 'MKD', 'MNE', 'SRB'], LIE: ['AUT', 'CHE'],
    LTU: ['BLR', 'LVA', 'POL', 'RUS'], LUX: ['BEL', 'DEU', 'FRA'],
    LVA: ['BLR', 'EST', 'LTU', 'RUS'], MCO: ['FRA'], MDA: ['ROU', 'UKR'],
    MKD: ['ALB', 'BGR', 'GRC', 'KOS', 'SRB'], MLT: [],
    MNE: ['ALB', 'BIH', 'HRV', 'KOS', 'SRB'], NIR: ['IRL'],
    NLD: ['BEL', 'DEU'], NOR: ['FIN', 'RUS', 'SWE'], POL: ['BLR', 'CZE', 'DEU', 'LTU', 'RUS', 'SVK', 'UKR'],
    PRT: ['ESP'], ROU: ['BGR', 'HUN', 'MDA', 'SRB', 'UKR'],
    RUS: ['AZE', 'BLR', 'EST', 'FIN', 'GEO', 'KAZ', 'LTU', 'LVA', 'NOR', 'POL', 'UKR'],
    SCT: ['ENG'], SMR: ['ITA'],
    SRB: ['BGR', 'BIH', 'HRV', 'HUN', 'KOS', 'MKD', 'MNE', 'ROU'],
    SVK: ['AUT', 'CZE', 'HUN', 'POL', 'UKR'], SVN: ['AUT', 'HRV', 'HUN', 'ITA'],
    SWE: ['FIN', 'NOR'], TUR: ['ARM', 'AZE', 'BGR', 'GEO', 'GRC'],
    UKR: ['BLR', 'HUN', 'MDA', 'POL', 'ROU', 'RUS', 'SVK'],
    VAT: ['ITA'], WLS: ['ENG']
  };
  // Names with their French article, used inside sentences ("c'est la Roumanie").
  // Keep one entry per playable zone, as for landNeighbors.
  const countryNamesInSentence = {
    ALB: "l'Albanie", DEU: "l'Allemagne", AND: "l'Andorre", ENG: "l'Angleterre", ARM: "l'Arménie",
    AUT: "l'Autriche", AZE: "l'Azerbaïdjan", BEL: 'la Belgique', BLR: 'la Biélorussie',
    BIH: 'la Bosnie-Herzégovine', BGR: 'la Bulgarie', CYP: 'Chypre', HRV: 'la Croatie',
    DNK: 'le Danemark', SCT: "l'Écosse", ESP: "l'Espagne", EST: "l'Estonie", FIN: 'la Finlande',
    FRA: 'la France', GEO: 'la Géorgie', GRC: 'la Grèce', HUN: 'la Hongrie', IRL: "l'Irlande",
    NIR: "l'Irlande du Nord", ISL: "l'Islande", ITA: "l'Italie", KAZ: 'le Kazakhstan',
    KOS: 'le Kosovo', LVA: 'la Lettonie', LIE: 'le Liechtenstein', LTU: 'la Lituanie',
    LUX: 'le Luxembourg', MKD: 'la Macédoine du Nord', MLT: 'Malte', MDA: 'la Moldavie',
    MCO: 'Monaco', MNE: 'le Monténégro', NOR: 'la Norvège', WLS: 'le pays de Galles',
    NLD: 'les Pays-Bas', POL: 'la Pologne', PRT: 'le Portugal', ROU: 'la Roumanie',
    RUS: 'la Russie', SMR: 'Saint-Marin', SRB: 'la Serbie', SVK: 'la Slovaquie',
    SVN: 'la Slovénie', SWE: 'la Suède', CHE: 'la Suisse', CZE: 'la Tchéquie',
    TUR: 'la Turquie', UKR: "l'Ukraine", VAT: 'le Vatican'
  };
  const nameInSentence = country => country.inSentence || countryNamesInSentence[country.id] || country.name;
  // Department numbers are shown next to the name ("la Gironde (33)").
  const fullInSentence = country => nameInSentence(country) + (country.label ? ` (${country.label})` : '');
  const fullName = country => country.name + (country.label ? ` (${country.label})` : '');
  const europeLegacyCountry = { id: 'GBR', name: 'Royaume-Uni (ancien quiz)' };
  let legacyCountry = europeLegacyCountry;
  const knownCountryId = id => countryById.has(id) || (legacyCountry !== null && id === legacyCountry.id);
  let storageKey = 'atlas-club-europe-v1';
  const levelKey = 'atlas-club-level';
  const settingsKey = 'atlas-club-settings-v1';
  const historyLimit = 5000;
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.getElementById('europe-map');
  const miniMap = document.getElementById('mini-map');
  const viewport = document.getElementById('map-viewport');
  const mapTooltip = document.getElementById('map-tooltip');
  const quizPanel = document.getElementById('quiz-panel');
  const question = document.getElementById('quiz-question');
  const emptyQuestion = document.getElementById('quiz-empty');
  const autoZoom = document.getElementById('auto-zoom');
  const answers = document.getElementById('answers');
  const feedback = document.getElementById('feedback');
  const nextButton = document.getElementById('next-button');
  const freeAnswerForm = document.getElementById('free-answer-form');
  const freeAnswerInput = document.getElementById('free-answer-input');
  const freeAnswerSubmit = document.getElementById('free-answer-submit');
  const settingsDialog = document.getElementById('settings-dialog');
  const historyDialog = document.getElementById('history-dialog');
  const historyRows = document.getElementById('history-rows');
  const timedModeInput = document.getElementById('timed-mode');
  const timerSetting = document.getElementById('timer-setting');
  const timerSecondsInput = document.getElementById('timer-seconds');
  const timerError = document.getElementById('timer-error');
  const quizTimer = document.getElementById('quiz-timer');
  const timerValue = document.getElementById('timer-value');
  const resultDialog = document.getElementById('result-dialog');
  const resultAdvance = document.getElementById('result-advance');
  const nodes = new Map();
  const pinGroups = [];
  const codeLabels = [];
  let levelHasCodes = false;
  const askingCode = () => levelHasCodes && settings.ask === 'code';
  let selectedId = null;
  let answered = false;
  let questionMode = 'qcm';
  let questionAsk = 'name';
  let lastRandomId = null;
  let zoom = 1;
  let panX = 0;
  let panY = 0;
  let pinch = null;
  let touchPan = null;
  let pointerDrag = null;
  let suppressClick = false;
  let previousFocus = null;
  let tooltipCountryId = null;
  let tooltipFromTouch = false;
  let tooltipTimer = null;
  let lastTouchAt = 0;
  let timerInterval = null;
  let timerDeadline = 0;
  let timerRemainingMs = 0;
  let activeTimedQuestion = false;

  try { autoZoom.checked = localStorage.getItem('atlas-club-auto-zoom') !== 'false'; } catch (_) { /* Keep the default. */ }
  autoZoom.addEventListener('change', () => {
    try { localStorage.setItem('atlas-club-auto-zoom', String(autoZoom.checked)); } catch (_) { /* Optional preference. */ }
  });

  function validTimerSeconds(value) {
    const text = String(value ?? '').trim();
    const seconds = Number(text);
    return /^\d+$/.test(text) && Number.isSafeInteger(seconds) && seconds >= 1 && seconds <= 3600
      ? seconds : null;
  }

  function loadSettings() {
    try {
      const saved = JSON.parse(localStorage.getItem(settingsKey));
      return {
        answerMode: saved?.answerMode === 'open' ? 'open' : 'qcm',
        countrySelection: ['all', 'review'].includes(saved?.countrySelection) ? saved.countrySelection : 'discover',
        timedMode: saved?.timedMode === true,
        timerSeconds: validTimerSeconds(saved?.timerSeconds) ?? 30,
        ask: saved?.ask === 'code' ? 'code' : 'name',
        motion: saved?.motion !== false
      };
    } catch (_) { return { answerMode: 'qcm', countrySelection: 'discover', timedMode: false, timerSeconds: 30, ask: 'name', motion: true }; }
  }

  const settings = loadSettings();
  document.documentElement.classList.toggle('calme', !settings.motion);
  function saveSettings() {
    try { localStorage.setItem(settingsKey, JSON.stringify(settings)); } catch (_) { /* The game still works. */ }
  }

  function count(value) {
    return Number.isSafeInteger(value) && value >= 0 ? value : 0;
  }

  function emptyGame() {
    return { foundIds: [], missedIds: [], errors: 0, score: 0, streak: 0 };
  }

  function emptyProgress() {
    return { schemaVersion: 5, currentGame: emptyGame(), stats: {}, history: [], historyDropped: 0 };
  }

  function loadProgress() {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey));
      if (saved && typeof saved === 'object' && saved.stats && typeof saved.stats === 'object' && !Array.isArray(saved.stats)) {
        const progress = emptyProgress();
        for (const country of [...countries, ...(legacyCountry ? [legacyCountry] : [])]) {
          const old = saved.stats[country.id];
          if (!old || typeof old !== 'object') continue;
          const attempts = count(old.attempts);
          const correctAttempts = count(old.correctAttempts);
          const wrongAttempts = count(old.wrongAttempts);
          const legacyAttempts = 'legacyAttempts' in old
            ? count(old.legacyAttempts)
            : Math.max(0, attempts - correctAttempts - wrongAttempts);
          progress.stats[country.id] = {
            attempts: Math.max(attempts, correctAttempts + wrongAttempts + legacyAttempts),
            correctAttempts,
            wrongAttempts,
            legacyAttempts,
            lastAttemptAt: typeof old.lastAttemptAt === 'string' ? old.lastAttemptAt : null
          };
        }
        const oldGame = saved.currentGame;
        if (oldGame && typeof oldGame === 'object' && !Array.isArray(oldGame)) {
          progress.currentGame.foundIds = Array.isArray(oldGame.foundIds)
            ? [...new Set(oldGame.foundIds.filter(id => countryById.has(id)))] : [];
          progress.currentGame.missedIds = Array.isArray(oldGame.missedIds)
            ? [...new Set(oldGame.missedIds.filter(id => countryById.has(id)))] : [];
          progress.currentGame.errors = count(oldGame.errors);
          progress.currentGame.score = count(oldGame.score);
          progress.currentGame.streak = count(oldGame.streak);
        } else {
          progress.currentGame.foundIds = countries.filter(country => saved.stats[country.id]?.mastered === true)
            .map(country => country.id);
          const oldAnswered = Array.isArray(saved.roundAnswered)
            ? saved.roundAnswered : countries.filter(country => progress.stats[country.id]?.attempts > 0).map(country => country.id);
          progress.currentGame.missedIds = [...new Set(oldAnswered.filter(id => countryById.has(id)
            && saved.stats[id]?.mastered !== true))];
          progress.currentGame.errors = progress.currentGame.missedIds.length;
          progress.currentGame.score = count(saved.score);
          progress.currentGame.streak = count(saved.streak);
        }
        if (Array.isArray(saved.history)) {
          const validHistory = saved.history.filter(item => item && knownCountryId(item.countryId)
            && (knownCountryId(item.chosenId) || (item.chosenId === null && (item.mode === 'open' || item.timedOut === true)))
            && typeof item.correct === 'boolean'
            && typeof item.at === 'string');
          progress.history = validHistory.slice(-historyLimit);
          progress.historyDropped = count(saved.historyDropped) + Math.max(0, validHistory.length - historyLimit);
        } else {
          progress.historyDropped = count(saved.historyDropped);
        }
        return progress;
      }
    } catch (_) { /* Storage may be unavailable in private browsing. */ }
    return emptyProgress();
  }

  let progress = emptyProgress();
  const hasFound = id => progress.currentGame.foundIds.includes(id);
  const isGameComplete = () => progress.currentGame.foundIds.length === countries.length;
  function saveProgress() {
    try { localStorage.setItem(storageKey, JSON.stringify(progress)); } catch (_) { /* The game still works without persistence. */ }
  }
  function startNewGame() {
    progress.currentGame = emptyGame();
    lastRandomId = null;
    saveProgress();
  }

  function element(name, attributes = {}) {
    const node = document.createElementNS(svgNS, name);
    for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
    return node;
  }

  function shuffle(items) {
    const result = [...items];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  function qcmChoices(id) {
    const close = (neighbors[id] || []).filter(neighborId => countryById.has(neighborId));
    const neighborId = close.length ? close[Math.floor(Math.random() * close.length)] : null;
    const total = Math.min(6, countries.length);
    const distractors = shuffle(countries.filter(country => country.id !== id && country.id !== neighborId))
      .slice(0, total - (neighborId ? 2 : 1));
    return shuffle([countryById.get(id), ...(neighborId ? [countryById.get(neighborId)] : []), ...distractors]);
  }

  function normalizeCountryName(value) {
    return value.toLowerCase().replace(/œ/g, 'oe').replace(/æ/g, 'ae')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z]+/g, ' ').trim().replace(/^(?:l|le|la|les|un|une) /, '')
      .replace(/\s+/g, ' ');
  }

  // Damerau-Levenshtein (one adjacent letter swap counts as one typo).
  function editDistance(a, b) {
    const rows = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
    for (let i = 0; i <= a.length; i++) rows[i][0] = i;
    for (let j = 0; j <= b.length; j++) rows[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        rows[i][j] = Math.min(
          rows[i - 1][j] + 1,
          rows[i][j - 1] + 1,
          rows[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
        );
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
          rows[i][j] = Math.min(rows[i][j], rows[i - 2][j - 2] + 1);
        }
      }
    }
    return rows[a.length][b.length];
  }

  const countryAliases = { CZE: ['République tchèque'], BLR: ['Bélarus'] };
  function matchTypedCountry(value) {
    const typed = normalizeCountryName(value);
    if (!typed) return null;
    let bestId = null;
    let bestDistance = Infinity;
    let tied = false;
    for (const country of countries) {
      const names = [country.name, ...(country.aliases || [])];
      for (const name of names) {
        const normalized = normalizeCountryName(name);
        const distance = editDistance(typed, normalized);
        const allowed = normalized.length <= 4 ? 0 : normalized.length <= 9 ? 1 : 2;
        if (distance > allowed) continue;
        if (distance < bestDistance) {
          bestDistance = distance;
          bestId = country.id;
          tied = false;
        } else if (distance === bestDistance && bestId !== country.id) {
          tied = true;
        }
      }
    }
    return tied ? null : bestId;
  }

  // Department numbers: "1", "01" and "01 " all match "01"; "2a" matches "2A".
  function matchTypedCode(value) {
    const typed = value.toUpperCase().replace(/[^0-9A-Z]/g, '');
    if (!typed) return null;
    const exact = countries.find(country => country.label && country.label.toUpperCase() === typed);
    if (exact) return exact.id;
    const numeric = /^\d+$/.test(typed) ? countries.find(country => /^\d+$/.test(country.label || '') && Number(country.label) === Number(typed)) : null;
    return numeric ? numeric.id : null;
  }

  function updateSettingsInfo() {
    for (const radio of settingsDialog.querySelectorAll('input[type="radio"]')) {
      radio.checked = radio.value === (radio.name === 'answer-mode' ? settings.answerMode : settings.countrySelection);
    }
    timedModeInput.checked = settings.timedMode;
    document.getElementById('motion-toggle').checked = settings.motion;
    timerSetting.hidden = !settings.timedMode;
    timerSecondsInput.value = settings.timerSeconds;
    timerSecondsInput.removeAttribute('aria-invalid');
    timerError.hidden = true;
    for (const radio of settingsDialog.querySelectorAll('input[name="ask"]')) radio.checked = radio.value === settings.ask;
    document.getElementById('ask-setting').hidden = !levelHasCodes;
    const difficultCount = countries.filter(country => progress.stats[country.id]?.wrongAttempts > 0 && !hasFound(country.id)).length;
    document.getElementById('settings-note').textContent = difficultCount
      ? `${words.count(difficultCount)} déjà ${words.missed(difficultCount)} à retrouver. Les réglages s'appliquent à la prochaine question.`
      : `${words.feminine ? 'Une' : 'Un'} ${words.one} reste à jouer jusqu’à sa première bonne réponse. « À réviser » privilégie les ${words.many} avec des erreurs enregistrées.`;
    updateEmptyHint();
  }

  function updateEmptyHint() {
    const complete = isGameComplete();
    document.querySelector('#quiz-empty h2').textContent = complete ? 'Partie terminée !' : 'À toi de jouer';
    document.getElementById('new-game-finished').hidden = !complete;
    document.getElementById('quiz-empty-hint').textContent = complete
      ? `${words.count(countries.length)} ${words.found(countries.length)} · ${progress.currentGame.errors} erreur${progress.currentGame.errors > 1 ? 's' : ''}. Lance une nouvelle partie pour rejouer.`
      : settings.answerMode === 'open'
        ? `Sélectionne ${words.feminine ? 'une' : 'un'} ${words.one} non ${words.found(1)} sur la carte, puis écris ${askingCode() ? 'son numéro' : 'son nom'} ici.`
        : `Sélectionne ${words.feminine ? 'une' : 'un'} ${words.one} non ${words.found(1)} sur la carte pour afficher les propositions ici.`;
  }

  function showTimerInputError() {
    const valid = validTimerSeconds(timerSecondsInput.value) !== null;
    timerSecondsInput.setAttribute('aria-invalid', String(!valid));
    timerError.textContent = valid ? '' : 'Entre une durée entière de 1 à 3 600 secondes.';
    timerError.hidden = valid;
    return valid;
  }

  function closeSettings() {
    if (settings.timedMode && !showTimerInputError()) {
      timerSecondsInput.focus();
      return;
    }
    settingsDialog.close();
  }

  const historyDate = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
  function renderHistory() {
    const ordered = [...countries, ...(legacyCountry && progress.stats[legacyCountry.id] ? [legacyCountry] : [])].sort((first, second) =>
      (progress.stats[second.id]?.wrongAttempts || 0) - (progress.stats[first.id]?.wrongAttempts || 0)
      || first.name.localeCompare(second.name, 'fr'));
    const totalErrors = ordered.reduce((total, country) => total + (progress.stats[country.id]?.wrongAttempts || 0), 0);
    const countriesWithErrors = ordered.filter(country => progress.stats[country.id]?.wrongAttempts > 0).length;
    const maxErrors = progress.stats[ordered[0].id]?.wrongAttempts || 0;
    document.getElementById('history-summary').textContent = totalErrors
      ? `${totalErrors} erreur${totalErrors > 1 ? 's' : ''} sur ${words.count(countriesWithErrors)}.`
      : 'Aucune erreur enregistrée pour le moment.';
    const rows = ordered.map(country => {
      const stat = progress.stats[country.id];
      const errors = stat?.wrongAttempts || 0;
      const row = document.createElement('div');
      row.className = `history-row${errors ? ' has-errors' : ''}`;
      row.setAttribute('role', 'row');
      const name = document.createElement('span');
      name.className = 'history-country';
      name.setAttribute('role', 'cell');
      const label = document.createElement('span');
      label.className = 'history-country-name';
      label.textContent = fullName(country);
      name.append(label);
      if (errors) {
        const bar = document.createElement('span');
        bar.className = 'history-bar';
        bar.style.width = `${Math.max(8, errors / maxErrors * 100)}%`;
        bar.setAttribute('aria-hidden', 'true');
        name.append(bar);
      }
      const wrong = document.createElement('span');
      wrong.className = 'history-errors';
      wrong.setAttribute('role', 'cell');
      wrong.textContent = errors;
      const attempts = document.createElement('span');
      attempts.className = 'history-attempts';
      attempts.setAttribute('role', 'cell');
      attempts.textContent = stat?.attempts || 0;
      row.append(name, wrong, attempts);
      return row;
    });
    historyRows.replaceChildren(...rows);
    const recent = progress.history.slice(-20).reverse().map(item => {
      const entry = document.createElement('li');
      const date = new Date(item.at);
      const when = Number.isNaN(date.getTime()) ? '' : ` · ${historyDate.format(date)}`;
      const outcome = item.timedOut ? 'temps écoulé' : item.correct ? 'juste' : 'faux';
      const zone = countryById.get(item.countryId);
      entry.textContent = `${zone ? fullName(zone) : legacyCountry?.name || item.countryId} — ${outcome}${when}`;
      return entry;
    });
    if (!recent.length) {
      const empty = document.createElement('li');
      empty.textContent = 'Aucune réponse enregistrée.';
      recent.push(empty);
    }
    document.getElementById('recent-history-list').replaceChildren(...recent);
  }

  function hideCountryTooltip() {
    clearTimeout(tooltipTimer);
    tooltipTimer = null;
    mapTooltip.hidden = true;
    tooltipCountryId = null;
    tooltipFromTouch = false;
  }

  function positionCountryTooltip(clientX, clientY) {
    const rect = viewport.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const halfWidth = mapTooltip.offsetWidth / 2;
    const left = Math.max(halfWidth + 10, Math.min(rect.width - halfWidth - 10, x));
    const above = y - mapTooltip.offsetHeight - 16;
    const top = above >= 10 ? above : Math.min(rect.height - mapTooltip.offsetHeight - 10, y + 16);
    mapTooltip.style.left = `${left}px`;
    mapTooltip.style.top = `${Math.max(10, top)}px`;
  }

  function showCountryTooltip(id, clientX, clientY, fromTouch = false) {
    if (!hasFound(id)) return;
    clearTimeout(tooltipTimer);
    tooltipCountryId = id;
    tooltipFromTouch = fromTouch;
    mapTooltip.textContent = fullName(countryById.get(id));
    mapTooltip.hidden = false;
    positionCountryTooltip(clientX, clientY);
    if (fromTouch) tooltipTimer = setTimeout(hideCountryTooltip, 4000);
  }

  function nearestPinId(clientX, clientY) {
    const rect = svg.getBoundingClientRect();
    return map.pins.reduce((nearest, pin) => {
      const x = rect.left + pin.x * rect.width / map.width;
      const y = rect.top + pin.y * rect.height / map.height;
      const distance = (x - clientX) ** 2 + (y - clientY) ** 2;
      return distance < nearest.distance ? { id: pin.id, distance } : nearest;
    }, { id: null, distance: Infinity }).id;
  }

  function registerCountry(node, id, isPin = false) {
    const pointerCountry = event => isPin ? nearestPinId(event.clientX, event.clientY) : id;
    node.setAttribute('tabindex', '0');
    node.setAttribute('role', 'button');
    node.setAttribute('aria-label', anonymousLabel(id));
    node.addEventListener('click', event => {
      if (suppressClick) { suppressClick = false; return; }
      const targetId = isPin && event.detail !== 0 ? pointerCountry(event) : id;
      const fromTouch = event.pointerType === 'touch' || Date.now() - lastTouchAt < 700;
      if (hasFound(targetId)) {
        showCountryTooltip(targetId, event.clientX, event.clientY, fromTouch);
        return;
      }
      hideCountryTooltip();
      openQuestion(targetId);
    });
    node.addEventListener('pointerenter', event => {
      if (event.pointerType !== 'touch' && !pointerDrag?.moved) {
        showCountryTooltip(pointerCountry(event), event.clientX, event.clientY);
      }
    });
    node.addEventListener('pointermove', event => {
      if (event.pointerType !== 'touch' && !tooltipFromTouch && !pointerDrag?.moved) {
        const targetId = pointerCountry(event);
        if (tooltipCountryId === targetId) positionCountryTooltip(event.clientX, event.clientY);
        else if (isPin) { hideCountryTooltip(); showCountryTooltip(targetId, event.clientX, event.clientY); }
      }
    });
    node.addEventListener('pointerleave', event => {
      if (event.pointerType !== 'touch' && (isPin || tooltipCountryId === id) && !tooltipFromTouch) hideCountryTooltip();
    });
    node.addEventListener('focus', () => {
      const rect = node.getBoundingClientRect();
      showCountryTooltip(id, rect.left + rect.width / 2, rect.top + rect.height / 2);
    });
    node.addEventListener('blur', () => {
      if (tooltipCountryId === id && !tooltipFromTouch) hideCountryTooltip();
    });
    node.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        hideCountryTooltip();
        openQuestion(id);
      }
    });
    if (!nodes.has(id)) nodes.set(id, []);
    nodes.get(id).push(node);
  }

  // Found zones are "coloured in" with one of the six pastels, always the same for a zone.
  const tintOf = id => String([...id].reduce((sum, char, index) => sum + char.charCodeAt(0) * (index + 7), 0) % 4);
  const anonymousLabel = id => `${words.one[0].toUpperCase()}${words.one.slice(1)} à identifier, numéro ${countries.findIndex(country => country.id === id) + 1}`;

  function decorLayer(paths, className) {
    const layer = element('g', { 'aria-hidden': 'true', class: `${className}-layer` });
    for (const d of paths || []) layer.append(element('path', { d, class: className }));
    return layer;
  }

  function buildMap() {
    svg.replaceChildren();
    nodes.clear();
    pinGroups.length = 0;
    codeLabels.length = 0;
    svg.setAttribute('viewBox', `0 0 ${map.width} ${map.height}`);
    svg.setAttribute('aria-label', `Carte interactive : ${level.title.toLowerCase()}`);
    svg.append(decorLayer(map.context, 'context-country'));

    const insetLayer = element('g', { 'aria-hidden': 'true' });
    for (const inset of map.insets || []) {
      insetLayer.append(element('rect', { x: inset.x, y: inset.y, width: inset.w, height: inset.h, rx: 6, class: 'inset-frame' }));
      if (inset.title) {
        const title = element('text', { x: inset.x + 6, y: inset.y + 14, class: 'inset-title' });
        title.textContent = inset.title;
        insetLayer.append(title);
      }
    }
    svg.append(insetLayer);
    svg.append(decorLayer(map.lines, 'decor-line'));

    const countryLayer = element('g');
    for (const country of countries) {
      if (country.type === 'line') {
        const group = element('g', { class: 'country country-line', 'data-country': country.id });
        group.append(element('path', { d: country.d, class: 'line-hit' }), element('path', { d: country.d, class: 'line-casing' }), element('path', { d: country.d, class: 'line-stroke' }));
        registerCountry(group, country.id);
        countryLayer.append(group);
      } else {
        const path = element('path', { d: country.d, class: 'country', 'data-country': country.id });
        registerCountry(path, country.id);
        countryLayer.append(path);
        // Enlarged copy in an inset (Paris and the inner suburbs): same zone, second clickable shape.
        if (country.dInset) {
          const copy = element('path', { d: country.dInset, class: 'country', 'data-country': country.id });
          registerCountry(copy, country.id);
          countryLayer.append(copy);
        }
      }
    }
    svg.append(countryLayer);
    svg.append(decorLayer(map.overlay, 'overlay-line'));

    const labelLayer = element('g', { 'aria-hidden': 'true', class: 'code-labels' });
    for (const country of countries) {
      if (!country.label) continue;
      const inset = Number.isFinite(country.insetLabelX) && Number.isFinite(country.insetLabelY);
      const x = inset ? country.insetLabelX : country.labelX;
      const y = inset ? country.insetLabelY : country.labelY;
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      const text = element('text', { x, y, class: 'code-label', 'data-country': country.id });
      text.textContent = country.label;
      codeLabels.push(text);
      labelLayer.append(text);
    }
    svg.append(labelLayer);

    const pinLayer = element('g');
    for (const pin of map.pins) {
      const group = element('g', { class: 'pin-group', 'data-country': pin.id });
      group.append(element('circle', { cx: pin.x, cy: pin.y, class: 'pin-hit' }));
      if (pin.visible !== false) {
        group.append(element('circle', { cx: pin.x, cy: pin.y, class: 'pin-halo' }));
        group.append(element('circle', { cx: pin.x, cy: pin.y, class: 'pin-core' }));
      }
      registerCountry(group, pin.id, true);
      pinGroups.push(group);
      pinLayer.append(group);
    }
    svg.append(pinLayer);
    buildMiniMap();
    zoom = 1;
    panX = 0;
    panY = 0;
    updateUI();
    renderMap();
  }

  function buildMiniMap() {
    miniMap.replaceChildren(decorLayer(map.context, 'context-country'));
    for (const country of countries) {
      for (const d of [country.d, country.dInset].filter(Boolean)) {
        miniMap.append(element('path', { d, class: `preview-country${country.type === 'line' ? ' preview-line' : ''}`, 'data-preview-country': country.id }));
      }
    }
  }

  // The shape to frame for a zone: its enlarged inset copy when there is one.
  const zoneShape = id => { const list = nodes.get(id); return list[countryById.get(id).dInset ? 1 : 0] || list[0]; };

  // Point used to center the zoom and the preview: the label point, a pin, or the shape's box.
  function zoneCenter(id) {
    const country = countryById.get(id);
    const pin = map.pins.find(item => item.id === id);
    if (pin) return { x: pin.x, y: pin.y, pin };
    const box = zoneShape(id).getBBox();
    if (country.dInset && Number.isFinite(country.insetLabelX)) return { x: country.insetLabelX, y: country.insetLabelY, box };
    if (Number.isFinite(country.labelX) && Number.isFinite(country.labelY)) return { x: country.labelX, y: country.labelY, box };
    return { x: box.x + box.width / 2, y: box.y + box.height / 2, box };
  }

  function updateMiniMap(id) {
    for (const path of miniMap.querySelectorAll('.preview-country')) {
      path.classList.toggle('active', path.dataset.previewCountry === id);
    }
    miniMap.querySelector('.preview-pin')?.remove();
    const pin = map.pins.find(item => item.id === id);
    if (pin && pin.visible !== false) miniMap.append(element('circle', { cx: pin.x, cy: pin.y, r: 9, class: 'preview-pin' }));
    const box = zoneShape(id).getBBox();
    const left = Math.max(0, box.x), right = Math.min(map.width, box.x + box.width);
    const top = Math.max(0, box.y), bottom = Math.min(map.height, box.y + box.height);
    const center = zoneCenter(id);
    const centerX = center.x;
    const centerY = center.y;
    const span = Math.min(790, Math.max(275, (right - left) * 1.9, (bottom - top) * 3.6));
    const aspectRatio = miniMap.clientWidth / miniMap.clientHeight || 2.8;
    const viewHeight = span / aspectRatio;
    miniMap.setAttribute('viewBox', `${centerX - span / 2} ${centerY - viewHeight / 2} ${span} ${viewHeight}`);
  }

  function updateUI() {
    const mastered = progress.currentGame.foundIds.length;
    const remaining = countries.length - mastered;
    document.getElementById('mastered-count').textContent = mastered;
    document.getElementById('total-count').textContent = `/ ${countries.length}`;
    document.getElementById('progress-track').setAttribute('aria-valuemax', countries.length);
    document.getElementById('score').textContent = progress.currentGame.score;
    document.getElementById('streak').textContent = progress.currentGame.streak;
    document.getElementById('progress-ring').style.background = `conic-gradient(var(--good) ${mastered / countries.length * 100}%, var(--track) 0%)`;
    document.getElementById('progress-fill').style.width = `${mastered / countries.length * 100}%`;
    document.getElementById('progress-track').setAttribute('aria-valuenow', mastered);
    document.getElementById('progress-caption').textContent = remaining === 0
      ? `Partie terminée : ${words.count(mastered)} ${words.found(mastered)}, ${progress.currentGame.errors} erreur${progress.currentGame.errors > 1 ? 's' : ''}.`
      : mastered === 0 && progress.currentGame.errors === 0 ? 'Ton voyage commence ici.'
      : `${words.count(remaining)} encore à trouver.`;
    document.getElementById('random-button').disabled = remaining === 0;
    updateEmptyHint();

    for (const country of countries) {
      const masteredCountry = hasFound(country.id);
      const missedCountry = !masteredCountry && progress.currentGame.missedIds.includes(country.id);
      for (const node of nodes.get(country.id) || []) {
        node.setAttribute('aria-label', masteredCountry
          ? `${fullName(country)}, déjà ${words.found(1)} dans cette partie.`
          : anonymousLabel(country.id));
        node.setAttribute('aria-disabled', String(masteredCountry));
        node.classList.toggle('mastered', masteredCountry);
        node.classList.toggle('missed', missedCountry);
        node.classList.toggle('selected', country.id === selectedId);
        node.classList.toggle('wrong', country.id === selectedId && answered && feedback.classList.contains('bad'));
        node.classList.toggle('pin-mastered', masteredCountry);
        node.classList.toggle('pin-missed', missedCountry);
        node.classList.toggle('pin-selected', country.id === selectedId);
        if (masteredCountry) node.dataset.tint = tintOf(country.id); else delete node.dataset.tint;
      }
    }
    const codesEverywhere = !askingCode();
    for (const text of codeLabels) {
      const id = text.dataset.country;
      text.classList.toggle('hidden-label', !codesEverywhere && !hasFound(id));
      text.classList.toggle('selected-label', id === selectedId);
    }
  }

  function renderQuestionTimer() {
    const seconds = Math.max(0, Math.ceil(timerRemainingMs / 1000));
    timerValue.textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
    quizTimer.classList.toggle('urgent', seconds <= 10);
  }

  function stopQuestionTimer() {
    clearInterval(timerInterval);
    timerInterval = null;
    timerDeadline = 0;
    timerRemainingMs = 0;
    activeTimedQuestion = false;
    quizTimer.hidden = true;
  }

  function tickQuestionTimer() {
    if (!activeTimedQuestion || answered || question.hidden) return;
    timerRemainingMs = Math.max(0, timerDeadline - Date.now());
    renderQuestionTimer();
    if (timerRemainingMs === 0) submitAnswer(null, null, true);
  }

  function pauseQuestionTimer() {
    if (timerInterval === null) return;
    timerRemainingMs = Math.max(0, timerDeadline - Date.now());
    clearInterval(timerInterval);
    timerInterval = null;
    renderQuestionTimer();
  }

  function resumeQuestionTimer() {
    if (!activeTimedQuestion || answered || question.hidden) return;
    if (timerRemainingMs === 0) {
      submitAnswer(null, null, true);
      return;
    }
    timerDeadline = Date.now() + timerRemainingMs;
    timerInterval = setInterval(tickQuestionTimer, 250);
    tickQuestionTimer();
  }

  function startQuestionTimer() {
    stopQuestionTimer();
    if (!settings.timedMode) return;
    activeTimedQuestion = true;
    timerRemainingMs = settings.timerSeconds * 1000;
    quizTimer.hidden = false;
    renderQuestionTimer();
    resumeQuestionTimer();
  }

  function openQuestion(id) {
    if (!countryById.has(id) || hasFound(id) || isGameComplete()) return;
    hideCountryTooltip();
    previousFocus = document.activeElement;
    selectedId = id;
    answered = false;
    questionMode = settings.answerMode;
    feedback.textContent = '';
    feedback.className = 'feedback';
    nextButton.hidden = true;
    const correct = countryById.get(id);
    answers.replaceChildren();
    answers.hidden = questionMode !== 'qcm';
    freeAnswerForm.hidden = questionMode !== 'open';
    freeAnswerInput.value = '';
    freeAnswerInput.disabled = false;
    freeAnswerSubmit.disabled = false;
    document.getElementById('question-number').textContent = `${String(countries.findIndex(country => country.id === id) + 1).padStart(2, '0')} / ${countries.length}`;
    questionAsk = askingCode() ? 'code' : 'name';
    document.getElementById('quiz-title').textContent = questionAsk === 'code'
      ? `${words.which} est le numéro de ${words.this} ?` : `${words.which} est ${words.this} ?`;
    document.getElementById('quiz-hint').textContent = questionAsk === 'code'
      ? `C'est ${nameInSentence(correct)}.` : `${words.feminine ? 'La' : 'Le'} ${words.one} ${words.feminine ? 'sélectionnée' : 'sélectionné'} est ${words.feminine ? 'surlignée' : 'surligné'} sur la carte.`;
    document.getElementById('free-answer-label').textContent = questionAsk === 'code' ? 'Numéro' : `Nom ${/^[aeiouyé]/i.test(words.one) ? "de l'" : words.feminine ? 'de la ' : 'du '}${words.one}`;
    freeAnswerInput.placeholder = questionAsk === 'code' ? 'Écris le numéro' : `Écris le nom ${/^[aeiouyé]/i.test(words.one) ? "de l'" : words.feminine ? 'de la ' : 'du '}${words.one}`;
    freeAnswerInput.inputMode = questionAsk === 'code' ? 'numeric' : 'text';
    if (questionMode === 'qcm') {
      const choices = qcmChoices(id);
      for (const [index, choice] of choices.entries()) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'answer';
        button.dataset.id = choice.id;
        const marker = document.createElement('span');
        marker.className = 'answer-index';
        marker.textContent = String.fromCharCode(65 + index);
        button.append(marker, document.createTextNode(questionAsk === 'code' ? choice.label : choice.name));
        button.addEventListener('click', () => submitAnswer(choice.id));
        answers.append(button);
      }
    }
    emptyQuestion.hidden = true;
    question.hidden = false;
    updateMiniMap(id);
    startQuestionTimer();
    if (autoZoom.checked) focusCountry(id);
    updateUI();
    if (questionMode === 'open') freeAnswerInput.focus();
    else answers.querySelector('button')?.focus();
    if (window.matchMedia('(max-width: 850px)').matches) quizPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function submitAnswer(chosenId, enteredText = null, timedOut = false) {
    if (answered || !selectedId || hasFound(selectedId)) return;
    answered = true;
    stopQuestionTimer();
    const correct = chosenId === selectedId;
    const country = countryById.get(selectedId);
    const stat = progress.stats[selectedId] || {
      attempts: 0, correctAttempts: 0, wrongAttempts: 0,
      legacyAttempts: 0, lastAttemptAt: null
    };
    const at = new Date().toISOString();
    stat.attempts++;
    stat.lastAttemptAt = at;
    if (correct) {
      stat.correctAttempts++;
      progress.currentGame.foundIds.push(selectedId);
      progress.currentGame.score += 10;
      progress.currentGame.streak++;
      feedback.textContent = `Bien joué ! C'est ${fullInSentence(country)}.`;
      feedback.classList.add('good');
    } else {
      stat.wrongAttempts++;
      progress.currentGame.errors++;
      progress.currentGame.streak = 0;
      if (!progress.currentGame.missedIds.includes(selectedId)) progress.currentGame.missedIds.push(selectedId);
      feedback.textContent = timedOut
        ? `Temps écoulé : c'est ${fullInSentence(country)}. Tu peux réessayer !`
        : `Pas tout à fait : c'est ${fullInSentence(country)}. Tu peux réessayer !`;
      feedback.classList.add('bad');
    }
    progress.stats[selectedId] = stat;
    const event = { countryId: selectedId, chosenId, correct, at, mode: questionMode };
    if (questionAsk === 'code') event.ask = 'code';
    if (enteredText !== null) event.enteredText = enteredText;
    if (timedOut) event.timedOut = true;
    progress.history.push(event);
    if (progress.history.length > historyLimit) {
      progress.historyDropped += progress.history.length - historyLimit;
      progress.history.splice(0, progress.history.length - historyLimit);
    }
    saveProgress();
    for (const button of answers.querySelectorAll('button')) {
      button.disabled = true;
      if (button.dataset.id === selectedId) button.classList.add('correct');
      else if (button.dataset.id === chosenId) button.classList.add('wrong');
    }
    freeAnswerInput.disabled = true;
    freeAnswerSubmit.disabled = true;
    nextButton.hidden = false;
    updateUI();
    document.getElementById('next-button-label').textContent = isGameComplete() ? 'Voir le bilan' : words.another;
    document.getElementById('result-cta-label').textContent = isGameComplete() ? 'Voir le bilan' : words.another;
    resultDialog.dataset.result = correct ? 'good' : 'bad';
    document.getElementById('result-icon').textContent = correct ? '★' : '↻';
    document.getElementById('result-kicker').textContent = correct ? 'Bonne réponse' : 'À retenter';
    document.getElementById('result-title').textContent = correct ? 'Bravo !' : timedOut ? 'Temps écoulé !' : 'Presque !';
    if (!correct && settings.motion) navigator.vibrate?.(120);
    document.getElementById('result-detail').textContent = correct
      ? `Tu as reconnu ${fullInSentence(country)}.`
      : `La bonne réponse était ${fullInSentence(country)}.`;
    resultDialog.showModal();
    resultAdvance.focus();
  }

  function closeQuestion() {
    stopQuestionTimer();
    question.hidden = true;
    emptyQuestion.hidden = false;
    selectedId = null;
    answered = false;
    feedback.className = 'feedback';
    updateUI();
    if (previousFocus?.isConnected) previousFocus.focus();
  }

  function nextQuestion() {
    if (resultDialog.open) resultDialog.close();
    closeQuestion();
    if (!isGameComplete()) randomQuestion();
  }

  function randomQuestion() {
    const remaining = countries.filter(country => !hasFound(country.id));
    if (!remaining.length) { updateUI(); return; }
    const difficult = remaining.filter(country => progress.stats[country.id]?.wrongAttempts > 0);
    const unseen = remaining.filter(country => !progress.stats[country.id]?.attempts);
    const pool = settings.countrySelection === 'review' && difficult.length ? difficult
      : settings.countrySelection === 'discover' && unseen.length ? unseen : remaining;
    const candidates = pool.length > 1 ? pool.filter(country => country.id !== lastRandomId) : pool;
    let chosen;
    if (settings.countrySelection === 'review' && difficult.length) {
      const weights = candidates.map(country => {
        const stat = progress.stats[country.id];
        return 1 + Math.min(6, stat.wrongAttempts) + 4 * stat.wrongAttempts / (stat.correctAttempts + stat.wrongAttempts);
      });
      let draw = Math.random() * weights.reduce((sum, weight) => sum + weight, 0);
      chosen = candidates[candidates.length - 1];
      for (let i = 0; i < candidates.length; i++) {
        draw -= weights[i];
        if (draw < 0) { chosen = candidates[i]; break; }
      }
    } else {
      chosen = candidates[Math.floor(Math.random() * candidates.length)];
    }
    lastRandomId = chosen.id;
    openQuestion(chosen.id);
  }

  function fittedWidth() {
    return Math.max(1, Math.min(viewport.clientWidth, viewport.clientHeight * map.width / map.height));
  }

  function renderMap() {
    if (!map) return;
    const width = fittedWidth() * zoom;
    const height = width * map.height / map.width;
    const mapUnitsPerPixel = map.width / width;
    const pinVisualScale = window.matchMedia('(min-width: 851px)').matches ? 1.5 : 1;
    for (const group of pinGroups) {
      group.querySelector('.pin-hit').setAttribute('r', (18 * mapUnitsPerPixel).toFixed(2));
      group.querySelector('.pin-halo')?.setAttribute('r', (5 * pinVisualScale * mapUnitsPerPixel).toFixed(2));
      group.querySelector('.pin-core')?.setAttribute('r', (2 * pinVisualScale * mapUnitsPerPixel).toFixed(2));
    }
    // Department numbers keep a readable size on screen and hide when the map is too small for them.
    svg.style.setProperty('--label-size', `${(11 * mapUnitsPerPixel).toFixed(2)}px`);
    svg.classList.toggle('labels-crowded', width < (level.labelMinWidth || 0));
    const extent = map.contextExtent;
    const leftLimit = viewport.clientWidth - (viewport.clientWidth - width) / 2 - extent.right / map.width * width;
    const rightLimit = -(viewport.clientWidth - width) / 2 - extent.left / map.width * width;
    const topLimit = viewport.clientHeight - (viewport.clientHeight - height) / 2 - extent.bottom / map.height * height;
    const bottomLimit = -(viewport.clientHeight - height) / 2 - extent.top / map.height * height;
    panX = leftLimit <= rightLimit ? Math.max(leftLimit, Math.min(rightLimit, panX)) : (leftLimit + rightLimit) / 2;
    panY = topLimit <= bottomLimit ? Math.max(topLimit, Math.min(bottomLimit, panY)) : (topLimit + bottomLimit) / 2;
    svg.style.width = `${width}px`;
    svg.style.left = `${(viewport.clientWidth - width) / 2 + panX}px`;
    svg.style.top = `${(viewport.clientHeight - height) / 2 + panY}px`;
  }

  function applyZoom(nextZoom, clientX, clientY) {
    const clamped = Math.max(0.85, Math.min(3.5, nextZoom));
    if (Math.abs(clamped - zoom) < 0.001) return;
    const rect = viewport.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const oldWidth = fittedWidth() * zoom;
    const oldHeight = oldWidth * map.height / map.width;
    const mapX = (x - (viewport.clientWidth - oldWidth) / 2 - panX) / oldWidth;
    const mapY = (y - (viewport.clientHeight - oldHeight) / 2 - panY) / oldHeight;
    zoom = clamped;
    const width = fittedWidth() * zoom;
    const height = width * map.height / map.width;
    panX = x - (viewport.clientWidth - width) / 2 - mapX * width;
    panY = y - (viewport.clientHeight - height) / 2 - mapY * height;
    renderMap();
  }

  function focusCountry(id) {
    const { x, y } = zoneCenter(id);
    zoom = level.focusZoom || 1.55;
    const width = fittedWidth() * zoom;
    const height = width * map.height / map.width;
    panX = width * (0.5 - x / map.width);
    panY = height * (0.5 - y / map.height);
    renderMap();
  }

  function zoomFromCenter(factor) {
    const rect = viewport.getBoundingClientRect();
    applyZoom(zoom * factor, rect.left + rect.width / 2, rect.top + rect.height / 2);
  }

  function touchDistance(first, second) {
    return Math.hypot(first.clientX - second.clientX, first.clientY - second.clientY);
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = () => { script.remove(); reject(new Error(`Impossible de charger ${src}`)); };
      document.head.append(script);
    });
  }

  // Catalog entries, with the data file of each level that is ready (Europe always is).
  function levelEntries() {
    const listed = Array.isArray(window.GEO_LEVEL_LIST) ? window.GEO_LEVEL_LIST.filter(item => item && item.id && item.file) : [];
    const entries = levelCatalog.map(entry => ({ ...entry, file: entry.file || listed.find(item => item.id === entry.id)?.file || null }));
    for (const item of listed) {
      if (!entries.some(entry => entry.id === item.id)) {
        entries.push({ id: item.id, group: item.group || 'Autres', title: item.title || item.id, noun: 'zone', file: item.file });
      }
    }
    return entries;
  }

  function europeLevel(raw) {
    return {
      width: raw.width, height: raw.height, contextExtent: raw.contextExtent,
      context: raw.context, lines: [], overlay: [], insets: [], pins: raw.pins, neighbors: landNeighbors,
      attribution: 'Contours : Natural Earth',
      footnote: 'Les frontières et la définition de l’Europe peuvent varier selon les sources. Les pays transcontinentaux et le Kosovo sont inclus dans ce jeu.',
      countries: raw.countries.map(country => ({ ...country, type: 'area', aliases: countryAliases[country.id] || [] }))
    };
  }

  const pathOf = item => typeof item === 'string' ? item : item?.d;
  function normalizeLevel(data) {
    const zones = Array.isArray(data.zones) ? [...data.zones] : [];
    // Rivers given as named lines are playable line zones.
    for (const line of data.lines || []) if (line && typeof line === 'object' && line.id && line.name) zones.push({ ...line, type: 'line' });
    const width = Number(data.width) || 1000;
    const height = Number(data.height) || 1000;
    return {
      width, height,
      contextExtent: data.contextExtent || { left: 0, top: 0, right: width, bottom: height },
      context: (data.context || []).map(pathOf).filter(Boolean),
      lines: (data.lines || []).filter(line => !(line && typeof line === 'object' && line.id && line.name)).map(pathOf).filter(Boolean),
      overlay: (data.overlay || []).map(pathOf).filter(Boolean),
      insets: (data.insets || []).filter(inset => [inset.x, inset.y, inset.w, inset.h].every(Number.isFinite)),
      pins: (data.pins || []).filter(pin => pin && Number.isFinite(pin.x) && Number.isFinite(pin.y)),
      neighbors: data.neighbors && typeof data.neighbors === 'object' ? data.neighbors : {},
      attribution: data.attribution || '',
      footnote: data.footnote || '',
      countries: zones.filter(zone => zone && zone.id != null && zone.name && zone.d).map(zone => ({
        id: String(zone.id), name: zone.name, inSentence: zone.inSentence || null, d: zone.d,
        type: zone.type === 'line' ? 'line' : 'area', kind: zone.kind || null,
        label: zone.label != null && zone.label !== '' ? String(zone.label) : null,
        labelX: zone.labelX, labelY: zone.labelY,
        dInset: zone.dInset || null, insetLabelX: zone.insetLabelX, insetLabelY: zone.insetLabelY,
        aliases: Array.isArray(zone.aliases) ? zone.aliases : []
      }))
    };
  }

  async function loadLevelData(entry) {
    if (entry.id === 'europe') {
      if (!window.EUROPE_MAP) await loadScript(entry.file);
      return europeLevel(window.EUROPE_MAP);
    }
    if (!window.GEO_LEVELS?.[entry.id]) await loadScript(entry.file);
    const data = window.GEO_LEVELS?.[entry.id];
    if (!data) throw new Error(`Niveau ${entry.id} absent du fichier ${entry.file}`);
    return normalizeLevel(data);
  }

  const capitalize = text => text[0].toUpperCase() + text.slice(1);
  function applyLevelTexts() {
    document.title = `${level.title} — Géographie à la carte`;
    document.getElementById('level-group').textContent = level.group;
    document.getElementById('level-title').textContent = level.title;
    document.getElementById('map-question').textContent = `${words.which} est ${words.this} ?`;
    document.getElementById('map-instruction').textContent = `Clique sur ${words.feminine ? 'une' : 'un'} ${words.one}. Glisse pour déplacer la carte ; zoome avec la molette, deux doigts ou +/−.`;
    document.getElementById('random-label').textContent = `${words.feminine ? 'Une' : 'Un'} ${words.one} au hasard`;
    document.getElementById('map-credit').textContent = map.attribution;
    document.getElementById('history-col-name').textContent = capitalize(words.one);
    const footnote = document.getElementById('footnote');
    footnote.textContent = map.footnote;
    footnote.hidden = !map.footnote;
  }

  function applyLevel(entry, data) {
    if (!question.hidden) closeQuestion();
    if (resultDialog.open) resultDialog.close();
    hideCountryTooltip();
    level = { ...entry, focusZoom: entry.focusZoom || 1.55 };
    words = makeWords(nouns[entry.noun] || nouns.zone);
    map = data;
    countries = data.countries;
    countryById = new Map(countries.map(country => [country.id, country]));
    neighbors = data.neighbors;
    legacyCountry = entry.id === 'europe' ? europeLegacyCountry : null;
    storageKey = entry.id === 'europe' ? 'atlas-club-europe-v1' : `atlas-club-level-${entry.id}-v1`;
    levelHasCodes = countries.some(country => country.label);
    level.labelMinWidth = levelHasCodes ? 560 : 0;
    lastRandomId = null;
    progress = loadProgress();
    applyLevelTexts();
    buildMap();
    updateSettingsInfo();
    renderLevelMenu();
    try { localStorage.setItem(levelKey, entry.id); } catch (_) { /* Optional preference. */ }
  }

  let levelLoading = false;
  async function selectLevel(id) {
    const entry = levelEntries().find(item => item.id === id && item.file);
    if (!entry || levelLoading) return false;
    if (level?.id === id) return true;
    levelLoading = true;
    levelButton.setAttribute('aria-busy', 'true');
    try {
      applyLevel(entry, await loadLevelData(entry));
      return true;
    } catch (error) {
      console.warn(error);
      document.getElementById('level-status').textContent = `Ce niveau n'a pas pu se charger. Vérifie ta connexion et réessaie.`;
      return false;
    } finally {
      levelLoading = false;
      levelButton.removeAttribute('aria-busy');
    }
  }

  const levelButton = document.getElementById('level-button');
  const levelMenu = document.getElementById('level-menu');
  function renderLevelMenu() {
    const groups = new Map();
    for (const entry of levelEntries()) {
      if (!groups.has(entry.group)) groups.set(entry.group, []);
      groups.get(entry.group).push(entry);
    }
    const children = [];
    for (const [group, entries] of groups) {
      const heading = document.createElement('p');
      heading.className = 'level-menu-group';
      heading.textContent = group;
      children.push(heading);
      for (const entry of entries) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'level-option';
        button.dataset.level = entry.id;
        button.disabled = !entry.file;
        if (entry.id === level?.id) button.setAttribute('aria-current', 'true');
        const name = document.createElement('span');
        name.textContent = entry.title;
        const note = document.createElement('small');
        note.textContent = !entry.file ? 'bientôt' : entry.id === level?.id ? 'en cours' : '';
        button.append(name, note);
        button.addEventListener('click', async () => {
          if (await selectLevel(entry.id)) closeLevelMenu(true);
        });
        children.push(button);
      }
    }
    const status = document.createElement('p');
    status.className = 'level-status';
    status.id = 'level-status';
    status.setAttribute('role', 'status');
    children.push(status);
    levelMenu.replaceChildren(...children);
  }
  function openLevelMenu() {
    pauseQuestionTimer();
    renderLevelMenu();
    levelMenu.hidden = false;
    levelButton.setAttribute('aria-expanded', 'true');
    (levelMenu.querySelector('[aria-current="true"]') || levelMenu.querySelector('button:not(:disabled)'))?.focus();
  }
  function closeLevelMenu(returnFocus = false) {
    if (levelMenu.hidden) return;
    levelMenu.hidden = true;
    levelButton.setAttribute('aria-expanded', 'false');
    if (returnFocus) levelButton.focus();
    resumeQuestionTimer();
  }
  levelButton.addEventListener('click', () => (levelMenu.hidden ? openLevelMenu() : closeLevelMenu()));
  levelMenu.addEventListener('keydown', event => {
    const options = [...levelMenu.querySelectorAll('button:not(:disabled)')];
    const index = options.indexOf(document.activeElement);
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeLevelMenu(true); }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      options[(index + step + options.length) % options.length]?.focus();
    }
  });
  document.addEventListener('pointerdown', event => {
    if (!levelMenu.hidden && !event.target.closest('.level-picker')) closeLevelMenu();
  });
  levelMenu.addEventListener('focusout', event => {
    if (!levelMenu.hidden && event.relatedTarget && !event.relatedTarget.closest('.level-picker')) closeLevelMenu();
  });

  document.getElementById('random-button').addEventListener('click', randomQuestion);
  document.getElementById('settings-button').addEventListener('click', () => {
    pauseQuestionTimer();
    updateSettingsInfo();
    settingsDialog.showModal();
  });
  document.getElementById('settings-close').addEventListener('click', closeSettings);
  settingsDialog.addEventListener('cancel', event => {
    if (settings.timedMode && !showTimerInputError()) {
      event.preventDefault();
      timerSecondsInput.focus();
    }
  });
  settingsDialog.addEventListener('close', resumeQuestionTimer);
  settingsDialog.addEventListener('change', event => {
    if (event.target.name === 'answer-mode') settings.answerMode = event.target.value;
    if (event.target.name === 'country-selection') settings.countrySelection = event.target.value;
    if (event.target.name === 'ask') { settings.ask = event.target.value; updateUI(); }
    if (event.target.id === 'motion-toggle') {
      settings.motion = event.target.checked;
      document.documentElement.classList.toggle('calme', !settings.motion);
    }
    if (event.target === timedModeInput) {
      settings.timedMode = timedModeInput.checked;
      timerSetting.hidden = !settings.timedMode;
    }
    saveSettings();
    if (event.target.name === 'answer-mode' || event.target.name === 'country-selection') updateSettingsInfo();
  });
  timerSecondsInput.addEventListener('input', () => {
    if (showTimerInputError()) {
      settings.timerSeconds = validTimerSeconds(timerSecondsInput.value);
      saveSettings();
    }
  });
  document.getElementById('history-button').addEventListener('click', () => {
    pauseQuestionTimer();
    renderHistory();
    historyDialog.showModal();
  });
  document.getElementById('history-close').addEventListener('click', () => historyDialog.close());
  historyDialog.addEventListener('close', resumeQuestionTimer);
  freeAnswerForm.addEventListener('submit', event => {
    event.preventDefault();
    const enteredText = freeAnswerInput.value.trim();
    if (!enteredText) {
      feedback.textContent = questionAsk === 'code' ? 'Écris un numéro avant de valider.' : 'Écris un nom avant de valider.';
      feedback.className = 'feedback info';
      freeAnswerInput.focus();
      return;
    }
    submitAnswer(questionAsk === 'code' ? matchTypedCode(enteredText) : matchTypedCountry(enteredText), enteredText);
  });
  document.getElementById('close-modal').addEventListener('click', closeQuestion);
  nextButton.addEventListener('click', nextQuestion);
  resultAdvance.addEventListener('click', nextQuestion);
  resultDialog.addEventListener('cancel', event => {
    event.preventDefault();
    resultDialog.close();
    nextButton.focus();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && levelMenu.hidden && !settingsDialog.open && !historyDialog.open && !resultDialog.open && !question.hidden) closeQuestion();
  });
  document.getElementById('reset-button').addEventListener('click', () => {
    if (!window.confirm('Commencer une nouvelle partie ? Ton score et les pays trouvés seront remis à zéro. Ton historique et tes statistiques d’erreurs seront conservés.')) return;
    if (!question.hidden) closeQuestion();
    hideCountryTooltip();
    startNewGame();
    updateSettingsInfo();
    updateUI();
  });
  document.getElementById('new-game-finished').addEventListener('click', () => {
    startNewGame();
    hideCountryTooltip();
    updateSettingsInfo();
    updateUI();
  });
  document.getElementById('clear-data-button').addEventListener('click', () => {
    if (!window.confirm('Effacer définitivement le score, l’historique et toutes les statistiques de cet appareil ?')) return;
    historyDialog.close();
    if (!question.hidden) closeQuestion();
    progress = emptyProgress();
    hideCountryTooltip();
    lastRandomId = null;
    saveProgress();
    updateSettingsInfo();
    updateUI();
  });
  document.getElementById('zoom-in').addEventListener('click', () => zoomFromCenter(1.25));
  document.getElementById('zoom-out').addEventListener('click', () => zoomFromCenter(1 / 1.25));
  viewport.addEventListener('wheel', event => {
    event.preventDefault();
    hideCountryTooltip();
    applyZoom(zoom * (event.deltaY < 0 ? 1.14 : 1 / 1.14), event.clientX, event.clientY);
  }, { passive: false });
  viewport.addEventListener('pointerdown', event => {
    if (event.pointerType === 'touch') lastTouchAt = Date.now();
    if (event.target === viewport || event.target.classList.contains('context-country')) hideCountryTooltip();
    if (event.pointerType === 'touch' || event.button !== 0) return;
    pointerDrag = { x: event.clientX, y: event.clientY, panX, panY, moved: false };
  });
  document.addEventListener('pointermove', event => {
    if (!pointerDrag) return;
    const dx = event.clientX - pointerDrag.x;
    const dy = event.clientY - pointerDrag.y;
    if (!pointerDrag.moved && Math.hypot(dx, dy) < 5) return;
    pointerDrag.moved = true;
    suppressClick = true;
    hideCountryTooltip();
    viewport.classList.add('dragging');
    panX = pointerDrag.panX + dx;
    panY = pointerDrag.panY + dy;
    renderMap();
    event.preventDefault();
  });
  document.addEventListener('pointerup', () => {
    if (!pointerDrag) return;
    pointerDrag = null;
    viewport.classList.remove('dragging');
    setTimeout(() => { suppressClick = false; }, 0);
  });
  viewport.addEventListener('touchstart', event => {
    lastTouchAt = Date.now();
    if (event.touches.length === 1) touchPan = { x: event.touches[0].clientX, y: event.touches[0].clientY, panX, panY, moved: false };
    if (event.touches.length === 2) {
      hideCountryTooltip();
      touchPan = null;
      pinch = { distance: touchDistance(event.touches[0], event.touches[1]), zoom };
    }
  }, { passive: true });
  viewport.addEventListener('touchmove', event => {
    if (event.touches.length === 1 && touchPan) {
      const dx = event.touches[0].clientX - touchPan.x;
      const dy = event.touches[0].clientY - touchPan.y;
      if (!touchPan.moved && Math.hypot(dx, dy) < 5) return;
      event.preventDefault();
      touchPan.moved = true;
      suppressClick = true;
      hideCountryTooltip();
      panX = touchPan.panX + dx;
      panY = touchPan.panY + dy;
      renderMap();
    } else if (event.touches.length === 2 && pinch) {
      event.preventDefault();
      const centerX = (event.touches[0].clientX + event.touches[1].clientX) / 2;
      const centerY = (event.touches[0].clientY + event.touches[1].clientY) / 2;
      applyZoom(pinch.zoom * touchDistance(event.touches[0], event.touches[1]) / pinch.distance, centerX, centerY);
    }
  }, { passive: false });
  viewport.addEventListener('touchend', event => {
    if (event.touches.length < 2) pinch = null;
    if (event.touches.length === 0) {
      touchPan = null;
      setTimeout(() => { suppressClick = false; }, 0);
    }
  });
  viewport.addEventListener('touchcancel', () => { pinch = null; touchPan = null; suppressClick = false; });

  async function boot() {
    new ResizeObserver(renderMap).observe(viewport);
    let saved = null;
    try { saved = localStorage.getItem(levelKey); } catch (_) { /* Default level. */ }
    const wanted = new URLSearchParams(location.search).get('niveau') || saved || 'europe';
    if (!(await selectLevel(wanted)) && wanted !== 'europe') await selectLevel('europe');
    renderLevelMenu();
  }
  boot();
})();
