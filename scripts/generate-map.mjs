import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const sourceUrl = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_countries.geojson';
const mapUnitsUrl = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson';
async function readSource(localFile, url) {
  if (localFile) return fs.readFileSync(path.resolve(localFile), 'utf8');
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Natural Earth download failed: HTTP ${response.status}`);
    return response.text();
  } catch (error) {
    try {
      return execFileSync('curl', ['--fail', '--location', '--silent', '--show-error', url], { encoding: 'utf8', maxBuffer: 30_000_000 });
    } catch (_) {
      throw new Error(`Cannot download Natural Earth. Pass local country and map-unit GeoJSON files as arguments. Cause: ${error.message}`);
    }
  }
}
const source = JSON.parse(await readSource(process.argv[2], sourceUrl));
const mapUnits = JSON.parse(await readSource(process.argv[3], mapUnitsUrl));
const output = fileURLToPath(new URL('..', import.meta.url));
fs.mkdirSync(output, { recursive: true });

const names = new Map(Object.entries({
  'Albania': 'Albanie', 'Andorra': 'Andorre', 'Armenia': 'Arménie',
  'Austria': 'Autriche', 'Azerbaijan': 'Azerbaïdjan', 'Belarus': 'Biélorussie',
  'Belgium': 'Belgique', 'Bosnia and Herzegovina': 'Bosnie-Herzégovine',
  'Bulgaria': 'Bulgarie', 'Croatia': 'Croatie', 'Cyprus': 'Chypre',
  'Czechia': 'Tchéquie', 'Denmark': 'Danemark', 'Estonia': 'Estonie',
  'Finland': 'Finlande', 'France': 'France', 'Georgia': 'Géorgie',
  'Germany': 'Allemagne', 'Greece': 'Grèce', 'Hungary': 'Hongrie',
  'Iceland': 'Islande', 'Ireland': 'Irlande', 'Italy': 'Italie',
  'Kazakhstan': 'Kazakhstan', 'Kosovo': 'Kosovo', 'Latvia': 'Lettonie',
  'Liechtenstein': 'Liechtenstein', 'Lithuania': 'Lituanie',
  'Luxembourg': 'Luxembourg', 'Malta': 'Malte', 'Moldova': 'Moldavie',
  'Monaco': 'Monaco', 'Montenegro': 'Monténégro', 'Netherlands': 'Pays-Bas',
  'North Macedonia': 'Macédoine du Nord', 'Norway': 'Norvège',
  'Poland': 'Pologne', 'Portugal': 'Portugal', 'Republic of Serbia': 'Serbie',
  'Romania': 'Roumanie', 'Russia': 'Russie', 'San Marino': 'Saint-Marin',
  'Slovakia': 'Slovaquie', 'Slovenia': 'Slovénie', 'Spain': 'Espagne',
  'Sweden': 'Suède', 'Switzerland': 'Suisse', 'Turkey': 'Turquie',
  'Ukraine': 'Ukraine', 'Vatican': 'Vatican'
}));
const ukNames = new Map(Object.entries({
  England: 'Angleterre', Scotland: 'Écosse', Wales: 'Pays de Galles',
  'Northern Ireland': 'Irlande du Nord'
}));

const bounds = { west: -14, east: 53, south: 31, north: 73 };
// Enough surrounding geography to fill the viewport while zooming out, without a world map.
const contextBounds = { west: -80, east: 120, south: 0, north: 85 };
const width = 1000;
const merc = latitude => Math.log(Math.tan(Math.PI / 4 + latitude * Math.PI / 360)) * 180 / Math.PI;
const mercNorth = merc(bounds.north);
const scale = Math.min(width / (bounds.east - bounds.west), 930 / (mercNorth - merc(bounds.south)));
const height = Math.round((mercNorth - merc(bounds.south)) * scale);
const xOffset = (width - (bounds.east - bounds.west) * scale) / 2;
const project = ([longitude, latitude]) => [xOffset + (longitude - bounds.west) * scale, (mercNorth - merc(latitude)) * scale];

function distanceSquared(point, start, end) {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const t = dx || dy ? Math.max(0, Math.min(1, ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) / (dx * dx + dy * dy))) : 0;
  const px = start[0] + t * dx;
  const py = start[1] + t * dy;
  return (point[0] - px) ** 2 + (point[1] - py) ** 2;
}

function simplify(points, tolerance) {
  if (points.length < 5) return points;
  const kept = new Uint8Array(points.length);
  kept[0] = kept[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [first, last] = stack.pop();
    let max = tolerance * tolerance;
    let selected = -1;
    for (let i = first + 1; i < last; i++) {
      const distance = distanceSquared(points[i], points[first], points[last]);
      if (distance > max) { max = distance; selected = i; }
    }
    if (selected !== -1) {
      kept[selected] = 1;
      stack.push([first, selected], [selected, last]);
    }
  }
  return points.filter((_, i) => kept[i]);
}

function pathFor(feature, tolerance, region = bounds) {
  const polygons = feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates] : feature.geometry.coordinates;
  const parts = [];
  for (const polygon of polygons) {
    for (const ring of polygon) {
      const longitudes = ring.map(point => point[0]);
      const latitudes = ring.map(point => point[1]);
      if (Math.max(...longitudes) < region.west || Math.min(...longitudes) > region.east ||
          Math.max(...latitudes) < region.south || Math.min(...latitudes) > region.north) continue;
      const projected = ring.map(project);
      const reduced = simplify(projected, tolerance);
      const points = reduced.length < 4 ? projected : reduced;
      if (points.length < 3) continue;
      parts.push('M' + points.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join('L') + 'Z');
    }
  }
  return parts.join('');
}

const countries = [];
const context = [];
for (const feature of source.features) {
  const name = feature.properties.ADMIN;
  const isCountry = names.has(name);
  const background = pathFor(feature, 2, contextBounds);
  if (background) context.push(background);
  if (isCountry) {
    const d = pathFor(feature, 0.5);
    if (!d) continue;
    countries.push({ id: feature.properties.ADM0_A3, name: names.get(name), d });
  }
}
for (const feature of mapUnits.features) {
  if (feature.properties.ADMIN !== 'United Kingdom') continue;
  const name = ukNames.get(feature.properties.GEOUNIT);
  if (!name) continue;
  const d = pathFor(feature, 0.5);
  if (d) countries.push({ id: feature.properties.GU_A3, name, d });
}
countries.sort((a, b) => a.name.localeCompare(b.name, 'fr'));
if (countries.length !== names.size + ukNames.size || new Set(countries.map(country => country.id)).size !== countries.length) {
  throw new Error(`Expected ${names.size + ukNames.size} unique playable areas, generated ${countries.length}: ${countries.map(c => c.name).join(', ')}`);
}

// Visible markers are reserved for shapes that are only a few pixels wide at the initial zoom.
// Luxembourg needs a larger touch target, but its outline remains visible without a marker.
const pins = [
  ['Andorre', 1.55, 42.55], ['Liechtenstein', 9.55, 47.15],
  ['Monaco', 7.42, 43.74], ['Saint-Marin', 12.45, 43.94],
  ['Vatican', 12.45, 41.90], ['Malte', 14.38, 35.94],
  ['Luxembourg', 6.12, 49.75, false]
].map(([name, longitude, latitude, visible = true]) => ({
  id: countries.find(country => country.name === name).id,
  x: +project([longitude, latitude])[0].toFixed(1),
  y: +project([longitude, latitude])[1].toFixed(1),
  visible
}));

const [contextLeft, contextTop] = project([contextBounds.west, contextBounds.north]);
const [contextRight, contextBottom] = project([contextBounds.east, contextBounds.south]);
const contextExtent = { left: contextLeft, top: contextTop, right: contextRight, bottom: contextBottom };
const payload = { width, height, contextExtent, countries, context, pins };
fs.writeFileSync(path.join(output, 'map-data.js'), `window.EUROPE_MAP = ${JSON.stringify(payload)};\n`);
console.log(`Generated ${countries.length} countries, ${context.length} surrounding areas; ${Math.round(fs.statSync(path.join(output, 'map-data.js')).size / 1024)} KiB`);
