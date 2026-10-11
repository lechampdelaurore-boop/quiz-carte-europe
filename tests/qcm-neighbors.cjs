const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const mapContext = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(root, 'map-data.js'), 'utf8'), mapContext);
const countries = mapContext.window.EUROPE_MAP.countries;
const countryById = new Map(countries.map(country => [country.id, country]));
let seed = 1;
const random = Object.create(Math);
random.random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const context = { countries, countryById, Math: random };
vm.createContext(context);
const section = (start, end) => source.slice(source.indexOf(start), source.indexOf(end));
vm.runInContext(`
  ${section('  const landNeighbors = {', '  const legacyCountry =')}
  ${section('  function shuffle(', '  function normalizeCountryName(')}
  this.landNeighbors = landNeighbors;
  this.qcmChoices = qcmChoices;
`, context);

const neighbors = context.landNeighbors;
assert.deepEqual(Object.keys(neighbors).sort(), Array.from(countries, country => country.id).sort());
assert.equal(Object.values(neighbors).reduce((sum, list) => sum + list.length, 0), 198);
for (const [id, list] of Object.entries(neighbors)) {
  assert.equal(new Set(list).size, list.length, `${id} : doublon dans les frontières`);
  for (const neighbor of list) {
    assert.notEqual(neighbor, id);
    assert.ok(countryById.has(neighbor), `${id} : voisin inconnu ${neighbor}`);
    assert.ok(neighbors[neighbor].includes(id), `${id} / ${neighbor} : frontière non réciproque`);
  }
}
assert.deepEqual([...neighbors.ENG].sort(), ['SCT', 'WLS']);
assert.deepEqual([...neighbors.NIR], ['IRL']);
assert.deepEqual([...neighbors.CYP], []);
assert.deepEqual([...neighbors.ISL], []);
assert.deepEqual([...neighbors.MLT], []);

const correctPositions = new Set();
const belgianNeighborPatterns = new Set();
for (const country of countries) {
  for (let attempt = 0; attempt < 80; attempt++) {
    const ids = context.qcmChoices(country.id).map(choice => choice.id);
    assert.equal(ids.length, 6, `${country.id} : nombre de réponses`);
    assert.equal(new Set(ids).size, 6, `${country.id} : doublon`);
    assert.ok(ids.includes(country.id), `${country.id} : bonne réponse absente`);
    if (neighbors[country.id].length) {
      assert.ok(ids.some(id => neighbors[country.id].includes(id)), `${country.id} : aucun voisin terrestre`);
    }
    if (country.id === 'BEL') {
      correctPositions.add(ids.indexOf('BEL'));
      belgianNeighborPatterns.add(ids.filter(id => neighbors.BEL.includes(id)).sort().join(','));
    }
  }
}
assert.equal(correctPositions.size, 6, 'La bonne réponse doit pouvoir occuper les six positions');
assert.ok(belgianNeighborPatterns.size > 1, 'Les voisins proposés pour la Belgique doivent varier');

console.log('54 pays, 99 frontières, six choix distincts, voisins et ordre variables : OK');
