(() => {
  'use strict';

  const map = window.EUROPE_MAP;
  const countries = map.countries;
  const countryById = new Map(countries.map(country => [country.id, country]));
  const storageKey = 'atlas-club-europe-v1';
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.getElementById('europe-map');
  const miniMap = document.getElementById('mini-map');
  const viewport = document.getElementById('map-viewport');
  const modal = document.getElementById('quiz-modal');
  const answers = document.getElementById('answers');
  const feedback = document.getElementById('feedback');
  const nextButton = document.getElementById('next-button');
  const nodes = new Map();
  let selectedId = null;
  let answered = false;
  let zoom = 1;
  let pinch = null;
  let previousFocus = null;

  function loadProgress() {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey));
      if (saved && typeof saved === 'object' && saved.stats && typeof saved.stats === 'object') {
        return {
          stats: saved.stats,
          score: Number.isFinite(saved.score) ? saved.score : 0,
          streak: Number.isFinite(saved.streak) ? saved.streak : 0
        };
      }
    } catch (_) { /* Storage may be unavailable in private browsing. */ }
    return { stats: {}, score: 0, streak: 0 };
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
    node.addEventListener('click', () => openQuestion(id));
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
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
    updateUI();
    answers.querySelector('button')?.focus();
  }

  function submitAnswer(chosenId) {
    if (answered || !selectedId) return;
    answered = true;
    const correct = chosenId === selectedId;
    const country = countryById.get(selectedId);
    const stat = progress.stats[selectedId] || { attempts: 0, mastered: false };
    stat.attempts++;
    if (correct) {
      if (!stat.mastered) progress.score += 10;
      stat.mastered = true;
      progress.streak++;
      feedback.textContent = `Bien joué ! C'est ${country.name}.`;
      feedback.classList.add('good');
    } else {
      progress.streak = 0;
      feedback.textContent = `Pas tout à fait : c'est ${country.name}. Réessaie ce pays plus tard !`;
      feedback.classList.add('bad');
    }
    progress.stats[selectedId] = stat;
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
    modal.hidden = true;
    document.body.style.overflow = '';
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

  function applyZoom(nextZoom, clientX, clientY) {
    const clamped = Math.max(1, Math.min(3.5, nextZoom));
    if (Math.abs(clamped - zoom) < 0.001) return;
    const viewportRect = viewport.getBoundingClientRect();
    const oldRect = svg.getBoundingClientRect();
    const localX = clientX - viewportRect.left;
    const localY = clientY - viewportRect.top;
    const relativeX = (viewport.scrollLeft + localX) / oldRect.width;
    const relativeY = (viewport.scrollTop + localY) / oldRect.height;
    zoom = clamped;
    const baseWidth = Math.max(viewport.clientWidth, 650);
    svg.style.width = `${baseWidth * zoom}px`;
    const newRect = svg.getBoundingClientRect();
    viewport.scrollLeft = relativeX * newRect.width - localX;
    viewport.scrollTop = relativeY * newRect.height - localY;
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
  modal.addEventListener('click', event => { if (event.target === modal) closeQuestion(); });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !modal.hidden) closeQuestion();
    if (event.key === 'Tab' && !modal.hidden) {
      const focusable = [...modal.querySelectorAll('button:not([disabled]):not([hidden])')];
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  });
  document.getElementById('reset-button').addEventListener('click', () => {
    if (!window.confirm('Effacer ton score et les pays déjà trouvés sur cet appareil ?')) return;
    progress = { stats: {}, score: 0, streak: 0 };
    saveProgress();
    updateUI();
  });
  document.getElementById('zoom-in').addEventListener('click', () => zoomFromCenter(1.25));
  document.getElementById('zoom-out').addEventListener('click', () => zoomFromCenter(1 / 1.25));
  viewport.addEventListener('wheel', event => {
    event.preventDefault();
    applyZoom(zoom * (event.deltaY < 0 ? 1.14 : 1 / 1.14), event.clientX, event.clientY);
  }, { passive: false });
  viewport.addEventListener('touchstart', event => {
    if (event.touches.length !== 2) return;
    pinch = { distance: touchDistance(event.touches[0], event.touches[1]), zoom };
  }, { passive: true });
  viewport.addEventListener('touchmove', event => {
    if (event.touches.length !== 2 || !pinch) return;
    event.preventDefault();
    const centerX = (event.touches[0].clientX + event.touches[1].clientX) / 2;
    const centerY = (event.touches[0].clientY + event.touches[1].clientY) / 2;
    applyZoom(pinch.zoom * touchDistance(event.touches[0], event.touches[1]) / pinch.distance, centerX, centerY);
  }, { passive: false });
  viewport.addEventListener('touchend', event => { if (event.touches.length < 2) pinch = null; });
  viewport.addEventListener('touchcancel', () => { pinch = null; });

  buildMap();
})();
