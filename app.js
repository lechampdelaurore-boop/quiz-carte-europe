(() => {
  'use strict';

  const map = window.EUROPE_MAP;
  const countries = map.countries;
  const countryById = new Map(countries.map(country => [country.id, country]));
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
  const legacyCountry = { id: 'GBR', name: 'Royaume-Uni (ancien quiz)' };
  const knownCountryId = id => countryById.has(id) || id === legacyCountry.id;
  const storageKey = 'atlas-club-europe-v1';
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
  let selectedId = null;
  let answered = false;
  let questionMode = 'qcm';
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
        timerSeconds: validTimerSeconds(saved?.timerSeconds) ?? 30
      };
    } catch (_) { return { answerMode: 'qcm', countrySelection: 'discover', timedMode: false, timerSeconds: 30 }; }
  }

  const settings = loadSettings();
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
        for (const country of [...countries, legacyCountry]) {
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

  let progress = loadProgress();
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
  updateSettingsInfo();

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
    const neighbors = (landNeighbors[id] || []).filter(neighborId => countryById.has(neighborId));
    const neighborId = neighbors.length ? neighbors[Math.floor(Math.random() * neighbors.length)] : null;
    const distractors = shuffle(countries.filter(country => country.id !== id && country.id !== neighborId))
      .slice(0, neighborId ? 4 : 5);
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
      const names = [country.name, ...(countryAliases[country.id] || [])];
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

  function updateSettingsInfo() {
    for (const radio of settingsDialog.querySelectorAll('input[type="radio"]')) {
      radio.checked = radio.value === (radio.name === 'answer-mode' ? settings.answerMode : settings.countrySelection);
    }
    timedModeInput.checked = settings.timedMode;
    timerSetting.hidden = !settings.timedMode;
    timerSecondsInput.value = settings.timerSeconds;
    timerSecondsInput.removeAttribute('aria-invalid');
    timerError.hidden = true;
    const difficultCount = countries.filter(country => progress.stats[country.id]?.wrongAttempts > 0 && !hasFound(country.id)).length;
    document.getElementById('settings-note').textContent = difficultCount
      ? `${difficultCount} pays déjà raté${difficultCount > 1 ? 's' : ''} à retrouver. Les réglages s'appliquent à la prochaine question.`
      : 'Un pays reste à jouer jusqu’à sa première bonne réponse. « À réviser » privilégie les pays avec des erreurs enregistrées.';
    updateEmptyHint();
  }

  function updateEmptyHint() {
    const complete = isGameComplete();
    document.querySelector('#quiz-empty h2').textContent = complete ? 'Partie terminée !' : 'À toi de jouer';
    document.getElementById('new-game-finished').hidden = !complete;
    document.getElementById('quiz-empty-hint').textContent = complete
      ? `${countries.length} pays trouvés · ${progress.currentGame.errors} erreur${progress.currentGame.errors > 1 ? 's' : ''}. Lance une nouvelle partie pour rejouer.`
      : settings.answerMode === 'open'
        ? 'Sélectionne un pays non trouvé sur la carte, puis écris son nom ici.'
        : 'Sélectionne un pays non trouvé sur la carte pour afficher les six propositions ici.';
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
    const ordered = [...countries, ...(progress.stats.GBR ? [legacyCountry] : [])].sort((first, second) =>
      (progress.stats[second.id]?.wrongAttempts || 0) - (progress.stats[first.id]?.wrongAttempts || 0)
      || first.name.localeCompare(second.name, 'fr'));
    const totalErrors = ordered.reduce((total, country) => total + (progress.stats[country.id]?.wrongAttempts || 0), 0);
    const countriesWithErrors = ordered.filter(country => progress.stats[country.id]?.wrongAttempts > 0).length;
    const maxErrors = progress.stats[ordered[0].id]?.wrongAttempts || 0;
    document.getElementById('history-summary').textContent = totalErrors
      ? `${totalErrors} erreur${totalErrors > 1 ? 's' : ''} sur ${countriesWithErrors} pays.`
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
      label.textContent = country.name;
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
      entry.textContent = `${countryById.get(item.countryId)?.name || legacyCountry.name} — ${outcome}${when}`;
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
    mapTooltip.textContent = countryById.get(id).name;
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
    node.setAttribute('aria-label', `Zone de pays à identifier, numéro ${countries.findIndex(country => country.id === id) + 1}`);
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

  function buildMap() {
    svg.setAttribute('viewBox', `0 0 ${map.width} ${map.height}`);
    const contextLayer = element('g', { 'aria-hidden': 'true' });
    for (const d of map.context) contextLayer.append(element('path', { d, class: 'context-country' }));
    svg.append(contextLayer);

    const countryLayer = element('g');
    for (const country of countries) {
      const path = element('path', { d: country.d, class: 'country', 'data-country': country.id });
      registerCountry(path, country.id);
      countryLayer.append(path);
    }
    svg.append(countryLayer);

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
    updateUI();
    renderMap();
    new ResizeObserver(renderMap).observe(viewport);
  }

  function buildMiniMap() {
    const backdrop = element('g', { 'aria-hidden': 'true' });
    for (const d of map.context) backdrop.append(element('path', { d, class: 'context-country' }));
    miniMap.append(backdrop);
    for (const country of countries) {
      miniMap.append(element('path', { d: country.d, class: 'preview-country', 'data-preview-country': country.id }));
    }
  }

  function updateMiniMap(id) {
    for (const path of miniMap.querySelectorAll('.preview-country')) {
      path.classList.toggle('active', path.dataset.previewCountry === id);
    }
    miniMap.querySelector('.preview-pin')?.remove();
    const pin = map.pins.find(item => item.id === id);
    if (pin && pin.visible !== false) miniMap.append(element('circle', { cx: pin.x, cy: pin.y, r: 9, class: 'preview-pin' }));
    const shape = nodes.get(id).find(node => node.tagName.toLowerCase() === 'path');
    const box = shape.getBBox();
    const left = Math.max(0, box.x), right = Math.min(map.width, box.x + box.width);
    const top = Math.max(0, box.y), bottom = Math.min(map.height, box.y + box.height);
    const centerX = pin ? pin.x : (left + right) / 2;
    const centerY = pin ? pin.y : (top + bottom) / 2;
    const span = Math.min(790, Math.max(275, (right - left) * 1.9, (bottom - top) * 3.6));
    const aspectRatio = miniMap.clientWidth / miniMap.clientHeight || 2.8;
    const viewHeight = span / aspectRatio;
    miniMap.setAttribute('viewBox', `${centerX - span / 2} ${centerY - viewHeight / 2} ${span} ${viewHeight}`);
  }

  function updateUI() {
    const mastered = progress.currentGame.foundIds.length;
    const remaining = countries.length - mastered;
    document.getElementById('mastered-count').textContent = mastered;
    document.getElementById('score').textContent = progress.currentGame.score;
    document.getElementById('streak').textContent = progress.currentGame.streak;
    document.getElementById('progress-ring').style.background = `conic-gradient(var(--teal) ${mastered / countries.length * 100}%, #e9ede6 0%)`;
    document.getElementById('progress-fill').style.width = `${mastered / countries.length * 100}%`;
    document.getElementById('progress-track').setAttribute('aria-valuenow', mastered);
    document.getElementById('progress-caption').textContent = remaining === 0
      ? `Partie terminée : ${mastered} pays trouvés, ${progress.currentGame.errors} erreur${progress.currentGame.errors > 1 ? 's' : ''}.`
      : mastered === 0 && progress.currentGame.errors === 0 ? 'Ton voyage commence ici.'
      : `${remaining} pays encore à trouver.`;
    document.getElementById('random-button').disabled = remaining === 0;
    updateEmptyHint();

    for (const country of countries) {
      const masteredCountry = hasFound(country.id);
      const missedCountry = !masteredCountry && progress.currentGame.missedIds.includes(country.id);
      for (const node of nodes.get(country.id) || []) {
        node.setAttribute('aria-label', masteredCountry
          ? `${country.name}, déjà trouvé dans cette partie.`
          : `Zone de pays à identifier, numéro ${countries.findIndex(item => item.id === country.id) + 1}`);
        node.setAttribute('aria-disabled', String(masteredCountry));
        node.classList.toggle('mastered', masteredCountry);
        node.classList.toggle('missed', missedCountry);
        node.classList.toggle('selected', country.id === selectedId);
        node.classList.toggle('wrong', country.id === selectedId && answered && feedback.classList.contains('bad'));
        node.classList.toggle('pin-mastered', masteredCountry);
        node.classList.toggle('pin-missed', missedCountry);
        node.classList.toggle('pin-selected', country.id === selectedId);
      }
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
        button.append(marker, document.createTextNode(choice.name));
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
      feedback.textContent = `Bien joué ! C'est ${country.name}.`;
      feedback.classList.add('good');
    } else {
      stat.wrongAttempts++;
      progress.currentGame.errors++;
      progress.currentGame.streak = 0;
      if (!progress.currentGame.missedIds.includes(selectedId)) progress.currentGame.missedIds.push(selectedId);
      feedback.textContent = timedOut
        ? `Temps écoulé : c'est ${country.name}. Tu peux réessayer !`
        : `Pas tout à fait : c'est ${country.name}. Tu peux réessayer !`;
      feedback.classList.add('bad');
    }
    progress.stats[selectedId] = stat;
    const event = { countryId: selectedId, chosenId, correct, at, mode: questionMode };
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
    document.getElementById('next-button-label').textContent = isGameComplete() ? 'Voir le bilan' : 'Un autre pays';
    document.getElementById('result-cta-label').textContent = isGameComplete() ? 'Voir le bilan' : 'Un autre pays';
    resultDialog.dataset.result = correct ? 'good' : 'bad';
    document.getElementById('result-icon').textContent = correct ? '✓' : '×';
    document.getElementById('result-kicker').textContent = correct ? 'Bonne réponse' : 'Mauvaise réponse';
    document.getElementById('result-title').textContent = correct ? 'Bravo !' : timedOut ? 'Temps écoulé !' : 'À réviser !';
    document.getElementById('result-detail').textContent = correct
      ? `Tu as reconnu ${country.name}.`
      : `La bonne réponse était ${country.name}.`;
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
    const width = fittedWidth() * zoom;
    const height = width * map.height / map.width;
    const mapUnitsPerPixel = map.width / width;
    for (const group of pinGroups) {
      group.querySelector('.pin-hit').setAttribute('r', (18 * mapUnitsPerPixel).toFixed(2));
      group.querySelector('.pin-halo')?.setAttribute('r', (5 * mapUnitsPerPixel).toFixed(2));
      group.querySelector('.pin-core')?.setAttribute('r', (2 * mapUnitsPerPixel).toFixed(2));
    }
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
    const pin = map.pins.find(item => item.id === id);
    const shape = nodes.get(id).find(node => node.tagName.toLowerCase() === 'path');
    const box = shape.getBBox();
    const x = pin ? pin.x : box.x + box.width / 2;
    const y = pin ? pin.y : box.y + box.height / 2;
    zoom = 1.55;
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
      feedback.textContent = 'Écris un nom de pays avant de valider.';
      feedback.className = 'feedback info';
      freeAnswerInput.focus();
      return;
    }
    submitAnswer(matchTypedCountry(enteredText), enteredText);
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
    if (event.key === 'Escape' && !settingsDialog.open && !historyDialog.open && !resultDialog.open && !question.hidden) closeQuestion();
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

  buildMap();
})();
