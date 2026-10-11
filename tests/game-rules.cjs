const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
const section = (start, end) => source.slice(source.indexOf(start), source.indexOf(end));
let saved = JSON.stringify({
  schemaVersion: 3,
  stats: {
    FRA: { attempts: 2, mastered: true, correctAttempts: 1, wrongAttempts: 1 },
    DEU: { attempts: 1, mastered: false, correctAttempts: 0, wrongAttempts: 1 }
  },
  score: 10,
  streak: 0
});
const countries = [
  { id: 'FRA', name: 'France' },
  { id: 'DEU', name: 'Allemagne' },
  { id: 'ITA', name: 'Italie' }
];
const opened = [];
const context = {
  countries,
  countryById: new Map(countries.map(country => [country.id, country])),
  legacyCountry: { id: 'GBR', name: 'Royaume-Uni (ancien quiz)' },
  knownCountryId: id => ['FRA', 'DEU', 'ITA', 'GBR'].includes(id),
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
  let selectedId = 'ITA';
  let answered = false;
  let questionMode = 'qcm';
  let lastRandomId = null;
  function openQuestion(id) { opened.push(id); }
  ${section('  function submitAnswer(', '  function closeQuestion(')}
  ${section('  function randomQuestion(', '  function fittedWidth(')}
`, context);

assert.equal(vm.runInContext('progress.schemaVersion', context), 4);
assert.equal(JSON.stringify(vm.runInContext('progress.roundAnswered', context)), '["FRA","DEU"]');
vm.runInContext('randomQuestion()', context);
assert.deepEqual(opened, ['ITA'], 'Un tirage ne doit pas reprendre un pays tenté dans une ancienne sauvegarde');

vm.runInContext("submitAnswer('ITA')", context);
let progress = JSON.parse(saved);
assert.equal(progress.score, 20);
assert.deepEqual(progress.roundAnswered, ['FRA', 'DEU', 'ITA']);
assert.equal(progress.stats.ITA.attempts, 1);
assert.equal(progress.history.length, 1);

vm.runInContext("answered = false; submitAnswer('ITA'); randomQuestion()", context);
progress = JSON.parse(saved);
assert.equal(progress.stats.ITA.attempts, 1, 'Un pays joué ne doit pas enregistrer de deuxième réponse');
assert.equal(progress.history.length, 1);
assert.deepEqual(opened, ['ITA'], 'Le tirage doit s’arrêter lorsque tous les pays sont joués');

vm.runInContext('progress = loadProgress()', context);
assert.equal(JSON.stringify(vm.runInContext('progress.roundAnswered', context)), '["FRA","DEU","ITA"]');

countries.push({ id: 'ESP', name: 'Espagne' });
context.countryById.set('ESP', countries[3]);
vm.runInContext("progress.roundAnswered = []; settings.countrySelection = 'discover'; randomQuestion()", context);
assert.equal(opened.at(-1), 'ESP', 'Découverte doit privilégier un pays jamais joué');
vm.runInContext("settings.countrySelection = 'review'; randomQuestion()", context);
assert.ok(['FRA', 'DEU'].includes(opened.at(-1)), 'Révision doit utiliser les erreurs des anciennes parties');
console.log('Migration, réponse unique, tirage sans doublon, fin de partie et persistance : OK');
