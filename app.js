(() => {
  'use strict';

  const map = window.EUROPE_MAP;
  const countries = map.countries;
  const countryById = new Map(countries.map(country => [country.id, country]));
  const storageKey = 'atlas-club-europe-v1';
  const historyLimit = 5000;
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.getElementById('europe-map');
  const miniMap = document.getElementById('mini-map');
  const viewport = document.getElementById('map-viewport');
  const quizPanel = document.getElementById('quiz-panel');
  const question = document.getElementById('quiz-question');
  const emptyQuestion = document.getElementById('quiz-empty');
  const autoZoom = document.getElementById('auto-zoom');
  const answers = document.getElementById('answers');
  const feedback = document.getElementById('feedback');
  const nextButton = document.getElementById('next-button');
  const nodes = new Map();
  let selectedId = null;
  let answered = false;
  let zoom = 1;
  let panX = 0;
  let panY = 0;
  let pinch = null;
  let touchPan = null;
  let pointerDrag = null;
  let suppressClick = false;
  let previousFocus = null;

  try { autoZoom.checked = localStorage.getItem('atlas-club-auto-zoom') !== 'false'; } catch (_) { /* Keep the default. */ }
  autoZoom.addEventListener('change', () => {
    try { localStorage.setItem('atlas-club-auto-zoom', String(autoZoom.checked)); } catch (_) { /* Optional preference. */ }
  });

  function count(value) {
    return Number.isSafeInteger(value) && value >= 0 ? value : 0;
  }

  function emptyProgress() {
    return { schemaVersion: 2, stats: {}, score: 0, streak: 0, history: [], historyDropped: 0 };
  }

  function loadProgress() {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey));
      if (saved && typeof saved === 'object' && saved.stats && typeof saved.stats === 'object' && !Array.isArray(saved.stats)) {
        const progress = emptyProgress();
        progress.score = count(saved.score);
        progress.streak = count(saved.streak);
        for (const country of countries) {
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
            mastered: old.mastered === true,
            correctAttempts,
            wrongAttempts,
            legacyAttempts,
            lastAttemptAt: typeof old.lastAttemptAt === 'string' ? old.lastAttemptAt : null
          };
        }
        if (Array.isArray(saved.history)) {
          const validHistory = saved.history.filter(item => item && countryById.has(item.countryId)
            && countryById.has(item.chosenId) && typeof item.correct === 'boolean'
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
  function saveProgress() {
    try { localStorage.setItem(storageKey, JSON.stringify(progress)); } catch (_) { /* The game still works without persistence. */ }
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

  function registerCountry(node, id) {
    node.setAttribute('tabindex', '0');
    node.setAttribute('role', 'button');
    node.setAttribute('aria-label', `Zone de pays à identifier, numéro ${countries.findIndex(country => country.id === id) + 1}`);
    node.addEventListener('click', () => {
      if (suppressClick) { suppressClick = false; return; }
      openQuestion(id);
    });
    node.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
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
      group.append(element('circle', { cx: pin.x, cy: pin.y, r: 13, class: 'pin-halo' }));
      group.append(element('circle', { cx: pin.x, cy: pin.y, r: 5, class: 'pin-core' }));
      registerCountry(group, pin.id);
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
    if (pin) miniMap.append(element('circle', { cx: pin.x, cy: pin.y, r: 9, class: 'preview-pin' }));
    const shape = nodes.get(id).find(node => node.tagName.toLowerCase() === 'path');
    const box = shape.getBBox();
    const left = Math.max(0, box.x), right = Math.min(map.width, box.x + box.width);
    const top = Math.max(0, box.y), bottom = Math.min(map.height, box.y + box.height);
    const centerX = pin ? pin.x : (left + right) / 2;
    const centerY = pin ? pin.y : (top + bottom) / 2;
    const span = Math.min(690, Math.max(240, (right - left) * 1.7, (bottom - top) * 3.2));
    const viewHeight = span / 2.8;
    miniMap.setAttribute('viewBox', `${centerX - span / 2} ${centerY - viewHeight / 2} ${span} ${viewHeight}`);
  }

  function updateUI() {
    const mastered = countries.filter(country => progress.stats[country.id]?.mastered).length;
    document.getElementById('mastered-count').textContent = mastered;
    document.getElementById('score').textContent = progress.score;
    document.getElementById('streak').textContent = progress.streak;
    document.getElementById('progress-ring').style.background = `conic-gradient(var(--teal) ${mastered / countries.length * 100}%, #e9ede6 0%)`;
    document.getElementById('progress-fill').style.width = `${mastered / countries.length * 100}%`;
    document.getElementById('progress-track').setAttribute('aria-valuenow', mastered);
    document.getElementById('progress-caption').textContent = mastered === countries.length
      ? 'Bravo ! Tu connais toute la carte.'
      : mastered === 0 ? 'Ton voyage commence ici.'
      : `${countries.length - mastered} pays encore à découvrir.`;

    for (const country of countries) {
      for (const node of nodes.get(country.id) || []) {
        node.classList.toggle('mastered', !!progress.stats[country.id]?.mastered);
        node.classList.toggle('selected', country.id === selectedId);
        node.classList.toggle('wrong', country.id === selectedId && answered && feedback.classList.contains('bad'));
        node.classList.toggle('pin-mastered', !!progress.stats[country.id]?.mastered);
        node.classList.toggle('pin-selected', country.id === selectedId);
      }
    }
  }

  function openQuestion(id) {
    if (!countryById.has(id)) return;
    previousFocus = document.activeElement;
    selectedId = id;
    answered = false;
    feedback.textContent = '';
    feedback.className = 'feedback';
    nextButton.hidden = true;
    const correct = countryById.get(id);
    updateMiniMap(id);
    const distractors = shuffle(countries.filter(country => country.id !== id)).slice(0, 5);
    const choices = shuffle([correct, ...distractors]);
    answers.replaceChildren();
    document.getElementById('question-number').textContent = `${String(countries.findIndex(country => country.id === id) + 1).padStart(2, '0')} / ${countries.length}`;
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
    emptyQuestion.hidden = true;
    question.hidden = false;
    if (autoZoom.checked && !window.matchMedia('(max-width: 850px)').matches) focusCountry(id);
    updateUI();
    answers.querySelector('button')?.focus();
    if (window.matchMedia('(max-width: 850px)').matches) quizPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function submitAnswer(chosenId) {
    if (answered || !selectedId) return;
    answered = true;
    const correct = chosenId === selectedId;
    const country = countryById.get(selectedId);
    const stat = progress.stats[selectedId] || {
      attempts: 0, mastered: false, correctAttempts: 0, wrongAttempts: 0,
      legacyAttempts: 0, lastAttemptAt: null
    };
    const at = new Date().toISOString();
    stat.attempts++;
    stat.lastAttemptAt = at;
    if (correct) {
      stat.correctAttempts++;
      if (!stat.mastered) progress.score += 10;
      stat.mastered = true;
      progress.streak++;
      feedback.textContent = `Bien joué ! C'est ${country.name}.`;
      feedback.classList.add('good');
    } else {
      stat.wrongAttempts++;
      progress.streak = 0;
      feedback.textContent = `Pas tout à fait : c'est ${country.name}. Réessaie ce pays plus tard !`;
      feedback.classList.add('bad');
    }
    progress.stats[selectedId] = stat;
    progress.history.push({ countryId: selectedId, chosenId, correct, at });
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
    nextButton.hidden = false;
    updateUI();
    nextButton.focus();
  }

  function closeQuestion() {
    question.hidden = true;
    emptyQuestion.hidden = false;
    selectedId = null;
    answered = false;
    feedback.className = 'feedback';
    updateUI();
    if (previousFocus?.isConnected) previousFocus.focus();
  }

  function randomQuestion() {
    const remaining = countries.filter(country => !progress.stats[country.id]?.mastered);
    const pool = remaining.length ? remaining : countries;
    openQuestion(pool[Math.floor(Math.random() * pool.length)].id);
  }

  function fittedWidth() {
    return Math.max(1, Math.min(viewport.clientWidth, viewport.clientHeight * map.width / map.height));
  }

  function renderMap() {
    const width = fittedWidth() * zoom;
    const height = width * map.height / map.width;
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
  document.getElementById('close-modal').addEventListener('click', closeQuestion);
  nextButton.addEventListener('click', () => { closeQuestion(); randomQuestion(); });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !question.hidden) closeQuestion();
  });
  document.getElementById('reset-button').addEventListener('click', () => {
    if (!window.confirm('Effacer ton score, les pays déjà trouvés et ton historique de réponses sur cet appareil ?')) return;
    progress = emptyProgress();
    saveProgress();
    updateUI();
  });
  document.getElementById('zoom-in').addEventListener('click', () => zoomFromCenter(1.25));
  document.getElementById('zoom-out').addEventListener('click', () => zoomFromCenter(1 / 1.25));
  viewport.addEventListener('wheel', event => {
    event.preventDefault();
    applyZoom(zoom * (event.deltaY < 0 ? 1.14 : 1 / 1.14), event.clientX, event.clientY);
  }, { passive: false });
  viewport.addEventListener('pointerdown', event => {
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
    if (event.touches.length === 1) touchPan = { x: event.touches[0].clientX, y: event.touches[0].clientY, panX, panY, moved: false };
    if (event.touches.length === 2) {
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
