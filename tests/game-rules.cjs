const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const mapContext = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(root, 'map-data.js'), 'utf8'), mapContext);
const countries = mapContext.window.EUROPE_MAP.countries;
const section = (start, end) => source.slice(source.indexOf(start), source.indexOf(end));
let saved = JSON.stringify({
  schemaVersion: 4,
  stats: {
    FRA: { attempts: 2, mastered: true, correctAttempts: 1, wrongAttempts: 1 },
    ROU: { attempts: 1, mastered: false, correctAttempts: 0, wrongAttempts: 1 }
  },
  roundAnswered: ['FRA', 'ROU'],
  score: 10,
  streak: 0,
  history: [{ countryId: 'ROU', chosenId: 'BGR', correct: false, at: '2026-10-11T09:00:00.000Z', mode: 'qcm' }]
});
const opened = [];
const context = {
  countries,
  countryById: new Map(countries.map(country => [country.id, country])),
  legacyCountry: { id: 'GBR', name: 'Royaume-Uni (ancien quiz)' },
  knownCountryId: id => countries.some(country => country.id === id) || id === 'GBR',
  localStorage: {
    getItem: () => saved,
    setItem: (_key, value) => { saved = value; }
  },
  storageKey: 'atlas-club-europe-v1',
  historyLimit: 5000,
  updateSettingsInfo() {},
  updateUI() {},
  stopQuestionTimer() {},
  feedback: { textContent: '', classList: { add() {} } },
  answers: { querySelectorAll: () => [] },
  freeAnswerInput: { disabled: false },
  freeAnswerSubmit: { disabled: false },
  nextButton: { hidden: true },
  resultDialog: { dataset: {}, showModal() {} },
  resultAdvance: { focus() {} },
  document: { getElementById: () => ({ textContent: '' }) },
  settings: { countrySelection: 'all' },
  opened,
  Date
};
vm.createContext(context);
vm.runInContext(`
  ${section('  function count(', '  function element(')}
  let selectedId = 'ROU';
  let answered = false;
  let questionMode = 'qcm';
  let lastRandomId = null;
  function openQuestion(id) { opened.push(id); }
  ${section('  function submitAnswer(', '  function closeQuestion(')}
  ${section('  function randomQuestion(', '  function fittedWidth(')}
`, context);

assert.equal(vm.runInContext('progress.schemaVersion', context), 5);
assert.equal(JSON.stringify(vm.runInContext('progress.currentGame.foundIds', context)), '["FRA"]');
assert.equal(vm.runInContext('progress.currentGame.errors', context), 1);
assert.equal(vm.runInContext('progress.stats.ROU.wrongAttempts', context), 1);

vm.runInContext("submitAnswer('BGR')", context);
vm.runInContext("answered = false; submitAnswer('BGR')", context);
let progress = JSON.parse(saved);
assert.equal(progress.currentGame.errors, 3);
assert.equal(progress.stats.ROU.wrongAttempts, 3);
assert.equal(progress.currentGame.foundIds.includes('ROU'), false);
assert.equal(progress.history.length, 3);

vm.runInContext("answered = false; submitAnswer('ROU')", context);
progress = JSON.parse(saved);
assert.equal(progress.currentGame.foundIds.includes('ROU'), true);
assert.equal(progress.currentGame.score, 20);
assert.equal(progress.stats.ROU.correctAttempts, 1);
vm.runInContext("answered = false; submitAnswer('ROU')", context);
assert.equal(JSON.parse(saved).stats.ROU.attempts, 4, 'Un pays trouvé ne doit pas compter une réponse supplémentaire');

vm.runInContext("selectedId = 'BGR'; answered = false; submitAnswer('ROU')", context);
vm.runInContext("answered = false; submitAnswer('BGR')", context);
for (const country of countries) {
  if (['FRA', 'ROU', 'BGR'].includes(country.id)) continue;
  vm.runInContext(`selectedId = ${JSON.stringify(country.id)}; answered = false; submitAnswer(selectedId)`, context);
}
progress = JSON.parse(saved);
assert.equal(progress.currentGame.foundIds.length, countries.length);
assert.equal(progress.currentGame.score, countries.length * 10);
assert.equal(progress.currentGame.errors, 4);
assert.equal(vm.runInContext('isGameComplete()', context), true);
vm.runInContext('randomQuestion()', context);
assert.deepEqual(opened, [], 'Aucune question ne doit être tirée après la fin de partie');

vm.runInContext('startNewGame()', context);
progress = JSON.parse(saved);
assert.equal(progress.currentGame.foundIds.length, 0);
assert.equal(progress.currentGame.score, 0);
assert.equal(progress.currentGame.errors, 0);
assert.equal(progress.stats.ROU.wrongAttempts, 3);
assert.equal(progress.stats.BGR.wrongAttempts, 1);
assert.equal(progress.history.length, countries.length + 3);
assert.equal(vm.runInContext('isGameComplete()', context), false);

vm.runInContext("selectedId = 'ROU'; answered = false; submitAnswer('BGR')", context);
progress = JSON.parse(saved);
assert.equal(progress.stats.ROU.wrongAttempts, 4);
assert.equal(progress.currentGame.errors, 1);
vm.runInContext('progress = loadProgress()', context);
assert.equal(vm.runInContext('progress.stats.ROU.wrongAttempts', context), 4);
assert.equal(vm.runInContext('progress.currentGame.errors', context), 1);
vm.runInContext("settings.countrySelection = 'review'; randomQuestion()", context);
assert.ok(['FRA', 'ROU', 'BGR'].includes(opened.at(-1)), 'À réviser doit utiliser les erreurs cumulées');

saved = JSON.stringify({ schemaVersion: 3, stats: {
  FRA: { attempts: 2, mastered: true },
  ROU: { attempts: 2, mastered: false }
}, score: 10, streak: 1, history: [] });
vm.runInContext('progress = loadProgress()', context);
assert.equal(JSON.stringify(vm.runInContext('progress.currentGame.foundIds', context)), '["FRA"]');
assert.equal(JSON.stringify(vm.runInContext('progress.currentGame.missedIds', context)), '["ROU"]');
assert.equal(vm.runInContext('progress.currentGame.score', context), 10);

console.log('54 pays, erreurs répétées, fin de partie, nouvelle partie, révision et persistance : OK');
