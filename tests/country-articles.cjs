const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const mapContext = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(root, 'map-data.js'), 'utf8'), mapContext);
const countries = mapContext.window.EUROPE_MAP.countries;
const context = {};
vm.createContext(context);
const section = (start, end) => source.slice(source.indexOf(start), source.indexOf(end));
vm.runInContext(`
  ${section('  const countryNamesInSentence = {', '  const legacyCountry =')}
  this.names = countryNamesInSentence;
  this.nameInSentence = nameInSentence;
`, context);

const names = context.names;
assert.deepEqual(Object.keys(names).sort(), Array.from(countries, country => country.id).sort(),
  'Une forme avec article par zone jouable');
const withoutArticle = new Set(['CYP', 'MLT', 'MCO', 'SMR']);
for (const country of countries) {
  const text = names[country.id];
  const match = text.match(/^(le |la |les |l')?(.+)$/);
  assert.equal(match[2].toLowerCase(), country.name.toLowerCase(), `${country.id} : « ${text} » ne correspond pas à « ${country.name} »`);
  assert.equal(!match[1], withoutArticle.has(country.id), `${country.id} : article inattendu dans « ${text} »`);
  if (match[1] === "l'") assert.match(match[2], /^[AEÉIOUY]/, `${country.id} : élision devant une consonne`);
  if (match[1] === 'le ' || match[1] === 'la ') assert.doesNotMatch(match[2], /^[AEÉIOUY]/, `${country.id} : élision manquante`);
}
assert.equal(context.nameInSentence({ id: 'ROU', name: 'Roumanie' }), 'la Roumanie');
assert.equal(context.nameInSentence({ id: 'NLD', name: 'Pays-Bas' }), 'les Pays-Bas');
assert.equal(context.nameInSentence({ id: 'GBR', name: 'Royaume-Uni (ancien quiz)' }), 'Royaume-Uni (ancien quiz)');

console.log('54 noms avec article dans les messages : OK');
