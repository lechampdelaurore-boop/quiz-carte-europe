// Génère les fichiers de données des niveaux de géographie dans data/.
// Usage : node scripts/generate-levels.mjs [id ...]   (sans argument : tous les niveaux)
// Les sources sont téléchargées une fois dans un cache (variable GEO_CACHE, sinon dossier temporaire).
// Format des fichiers : voir le commentaire de writeLevel() plus bas.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const NE = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/ca96624a56bd078437bca8184e78163e5039ad19/geojson/';
const FR = 'https://raw.githubusercontent.com/gregoiredavid/france-geojson/5d34ee6d0140c29f785fdb047d9329f1aab58833/';
const SOURCES = {
  countries10: NE + 'ne_10m_admin_0_countries.geojson',
  departements: FR + 'departements-avec-outre-mer.geojson',
  regions: FR + 'regions-avec-outre-mer.geojson',
  rivers: NE + 'ne_10m_rivers_lake_centerlines.geojson',
  riversEurope: NE + 'ne_10m_rivers_europe.geojson',
  countries50: NE + 'ne_50m_admin_0_countries.geojson',
  continents50: NE + 'ne_50m_geography_regions_polys.geojson'
};
const ATTRIBUTION = {
  ne: 'Natural Earth (domaine public), naturalearthdata.com',
  fr: 'Contours des départements et régions : france-geojson de Grégoire David, d\'après IGN et INSEE (Licence Ouverte / Open Licence)'
};

const root = fileURLToPath(new URL('..', import.meta.url));
const dataDir = path.join(root, 'data');
const cacheDir = process.env.GEO_CACHE || path.join(os.tmpdir(), 'geo-levels-cache');
fs.mkdirSync(cacheDir, { recursive: true });
fs.mkdirSync(dataDir, { recursive: true });

const loaded = new Map();
function source(name) {
  if (loaded.has(name)) return loaded.get(name);
  const url = SOURCES[name];
  const file = path.join(cacheDir, crypto.createHash('sha1').update(url).digest('hex').slice(0, 12) + '-' + path.basename(url));
  if (!fs.existsSync(file)) {
    console.log('Téléchargement', url);
    execFileSync('curl', ['--fail', '--location', '--silent', '--show-error', '-o', file, url]);
  }
  const json = JSON.parse(fs.readFileSync(file, 'utf8'));
  loaded.set(name, json);
  return json;
}

// ---------- Géométrie ----------

const polygonsOf = geometry => geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.type === 'MultiPolygon' ? geometry.coordinates : [];
const openRing = ring => {
  const r = ring.slice();
  if (r.length > 1 && r[0][0] === r[r.length - 1][0] && r[0][1] === r[r.length - 1][1]) r.pop();
  return r;
};
const keyOf = point => point[0] + ',' + point[1];
const merc = lat => Math.log(Math.tan(Math.PI / 4 + Math.max(-85, Math.min(85, lat)) * Math.PI / 360)) * 180 / Math.PI;

// Mercator ajusté dans un cadre { x, y, w, h } pour une emprise { west, east, south, north }.
function mercatorFit(extent, box) {
  const top = merc(extent.north);
  const sx = box.w / (extent.east - extent.west);
  const sy = box.h / (top - merc(extent.south));
  const s = Math.min(sx, sy);
  const ox = box.x + (box.w - (extent.east - extent.west) * s) / 2;
  const oy = box.y + (box.h - (top - merc(extent.south)) * s) / 2;
  const project = ([lon, lat]) => [ox + (lon - extent.west) * s, oy + (top - merc(lat)) * s];
  project.scale = s;
  return project;
}

function distanceSquared(p, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const t = dx || dy ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy))) : 0;
  return (p[0] - a[0] - t * dx) ** 2 + (p[1] - a[1] - t * dy) ** 2;
}
function douglasPeucker(points, tolerance) {
  if (points.length < 3) return points;
  const kept = new Uint8Array(points.length);
  kept[0] = kept[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [first, last] = stack.pop();
    let max = tolerance * tolerance;
    let selected = -1;
    for (let i = first + 1; i < last; i++) {
      const d = distanceSquared(points[i], points[first], points[last]);
      if (d > max) { max = d; selected = i; }
    }
    if (selected !== -1) { kept[selected] = 1; stack.push([first, selected], [selected, last]); }
  }
  return points.filter((_, i) => kept[i]);
}
const ringArea = ring => {
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) a += (ring[j][0] + ring[i][0]) * (ring[j][1] - ring[i][1]);
  return Math.abs(a / 2);
};

// Simplification qui respecte la topologie : les frontières communes sont découpées en arcs
// entre points de jonction, chaque arc est simplifié une seule fois, donc deux voisins gardent
// exactement le même tracé (ni trou ni chevauchement).
// items : [{ id, polygons: [[ring lon/lat, ...trous]], project }]
// Retourne Map id -> [[anneau projeté simplifié]] et la liste des arcs avec leurs propriétaires.
function topoSimplify(items, tolerance, { minArea = 0 } = {}) {
  const owners = new Map(); // clé de sommet -> Set(id)
  for (const item of items) {
    for (const polygon of item.polygons) for (const ring of polygon) for (const p of openRing(ring)) {
      const k = keyOf(p);
      let set = owners.get(k);
      if (!set) owners.set(k, set = new Set());
      set.add(item.id);
    }
  }
  const sameSet = (a, b) => a.size === b.size && [...a].every(v => b.has(v));
  const arcCache = new Map();
  const arcs = []; // { owners: [ids], points: projetés simplifiés }
  const result = new Map();
  for (const item of items) {
    const kept = [];
    const dropped = [];
    for (const polygon of item.polygons) {
      const rings = [];
      let small = false;
      polygon.forEach((rawRing, ringIndex) => {
        const ring = openRing(rawRing);
        if (ring.length < 3) return;
        const n = ring.length;
        const sets = ring.map(p => owners.get(keyOf(p)));
        let junctions = [];
        for (let i = 0; i < n; i++) {
          const s = sets[i];
          if (s.size >= 3 || !sameSet(s, sets[(i + n - 1) % n]) || !sameSet(s, sets[(i + 1) % n])) junctions.push(i);
        }
        if (!junctions.length) {
          // Anneau sans jonction (île, enclave) : on choisit deux points de façon déterministe.
          let first = 0;
          for (let i = 1; i < n; i++) if (keyOf(ring[i]) < keyOf(ring[first])) first = i;
          junctions = [first, (first + Math.floor(n / 2)) % n].sort((a, b) => a - b);
        }
        const out = [];
        for (let j = 0; j < junctions.length; j++) {
          const start = junctions[j];
          const end = junctions[(j + 1) % junctions.length];
          const span = ((end - start + n) % n) || n;
          const seq = [];
          for (let k = 0; k <= span; k++) seq.push(ring[(start + k) % n]);
          const fwd = seq.map(keyOf).join(';');
          const rev = seq.slice().reverse().map(keyOf).join(';');
          const canonical = fwd <= rev ? fwd : rev;
          let simplified = arcCache.get(canonical);
          if (!simplified) {
            const base = fwd <= rev ? seq : seq.slice().reverse();
            simplified = douglasPeucker(base.map(item.project), tolerance);
            arcCache.set(canonical, simplified);
            const endSet = owners.get(keyOf(seq[seq.length - 1]));
            const middle = span > 1 ? sets[(start + 1) % n] : sets[start];
            const shared = [...middle].filter(id => sets[start].has(id) && endSet.has(id));
            arcs.push({ owners: shared, points: simplified, isHole: ringIndex > 0 });
          }
          const pts = fwd <= rev ? simplified : simplified.slice().reverse();
          out.push(...pts.slice(0, -1));
        }
        if (out.length < 3) return;
        if (ringIndex === 0 && minArea && ringArea(out) < minArea) small = true;
        rings.push({ points: out, hole: ringIndex > 0 });
      });
      if (!rings.length || rings[0].hole) continue;
      (small ? dropped : kept).push(rings);
    }
    // Les petites îles sont retirées, sauf si la zone n'a rien d'autre (micro-États).
    if (!kept.length && !dropped.length && item.polygons.length) {
      // Îlots minuscules effacés par la simplification : on garde le plus grand contour brut.
      const raw = item.polygons.map(p => openRing(p[0]).map(item.project)).reduce((a, b) => ringArea(b) > ringArea(a) ? b : a);
      if (raw.length >= 3) dropped.push([{ points: raw, hole: false }]);
    }
    if (!kept.length && dropped.length) kept.push(dropped.reduce((a, b) => ringArea(b[0].points) > ringArea(a[0].points) ? b : a));
    result.set(item.id, kept.flat());
  }
  return { rings: result, arcs };
}

const fmt = v => (Math.round(v * 10) / 10).toFixed(1).replace(/\.0$/, '');
const pathOf = rings => rings.map(r => 'M' + r.points.map(([x, y]) => fmt(x) + ' ' + fmt(y)).join('L') + 'Z').join('');
const linePath = points => 'M' + points.map(([x, y]) => fmt(x) + ' ' + fmt(y)).join('L');

// Point intérieur le plus éloigné des bords (recherche sur grille affinée), pour les étiquettes.
function interiorPoint(rings) {
  const outers = rings.filter(r => !r.hole);
  if (!outers.length) return null;
  const main = outers.reduce((a, b) => ringArea(b.points) > ringArea(a.points) ? b : a);
  const pts = main.points;
  const inside = (x, y) => {
    let c = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i];
      const [xj, yj] = pts[j];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
    }
    return c;
  };
  const edgeDist = (x, y) => {
    let m = Infinity;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) m = Math.min(m, distanceSquared([x, y], pts[j], pts[i]));
    return Math.sqrt(m);
  };
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of pts) { minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); }
  let best = null;
  let cx = (minX + maxX) / 2, cy = (minY + maxY) / 2, w = maxX - minX, h = maxY - minY;
  for (let round = 0; round < 5; round++) {
    const steps = 24;
    for (let i = 0; i <= steps; i++) for (let j = 0; j <= steps; j++) {
      const x = cx - w / 2 + (w * i) / steps;
      const y = cy - h / 2 + (h * j) / steps;
      if (!inside(x, y)) continue;
      const d = edgeDist(x, y);
      if (!best || d > best.d) best = { x, y, d };
    }
    if (!best) break;
    cx = best.x; cy = best.y; w /= 4; h /= 4;
  }
  if (!best) { const [x, y] = pts[0]; return { x, y }; }
  return { x: +best.x.toFixed(1), y: +best.y.toFixed(1) };
}

const bboxOf = rings => {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const r of rings) for (const [x, y] of r.points) { minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); }
  return { minX, minY, maxX, maxY };
};

// Voisins : zones qui partagent au moins un segment dans les données sources.
function neighborsOf(items) {
  const segments = new Map();
  for (const item of items) for (const polygon of item.polygons) for (const raw of polygon) {
    const ring = openRing(raw);
    for (let i = 0; i < ring.length; i++) {
      const a = keyOf(ring[i]);
      const b = keyOf(ring[(i + 1) % ring.length]);
      const k = a < b ? a + '|' + b : b + '|' + a;
      let set = segments.get(k);
      if (!set) segments.set(k, set = new Set());
      set.add(item.id);
    }
  }
  const out = Object.fromEntries(items.map(item => [item.id, new Set()]));
  for (const set of segments.values()) if (set.size > 1) for (const a of set) for (const b of set) if (a !== b) out[a].add(b);
  return Object.fromEntries(Object.entries(out).map(([k, v]) => [k, [...v].sort()]));
}

// Fond neutre : pays Natural Earth recoupés grossièrement à une emprise (anneaux hors emprise ignorés).
function contextPaths(project, extent, tolerance) {
  const out = [];
  for (const feature of source('countries10').features) {
    const parts = [];
    for (const polygon of polygonsOf(feature.geometry)) {
      const ring = polygon[0];
      const lons = ring.map(p => p[0]);
      const lats = ring.map(p => p[1]);
      if (Math.max(...lons) < extent.west || Math.min(...lons) > extent.east || Math.max(...lats) < extent.south || Math.min(...lats) > extent.north) continue;
      const pts = douglasPeucker(ring.map(project), tolerance);
      if (pts.length >= 3 && ringArea(pts) > tolerance * tolerance) parts.push({ points: pts });
    }
    if (parts.length) out.push(pathOf(parts));
  }
  return out;
}

// Écrit data/<id>.js :
// (window.GEO_LEVELS ||= {})[id] = { id, title, width, height, contextExtent,
//   zones: [{ id, name, inSentence, type, d, label?, labelX, labelY, aliases?, dInset?, insetLabelX?, insetLabelY? }],
//   context: [d], lines: [d], overlay: [d], pins: [{ id, x, y, visible }], neighbors: { id: [ids] },
//   insets: [{ id, title, x, y, w, h }], attribution }
function writeLevel(level) {
  const file = path.join(dataDir, level.id + '.js');
  const js = `// Généré par scripts/generate-levels.mjs, ne pas modifier à la main.\n(window.GEO_LEVELS ||= {})[${JSON.stringify(level.id)}] = ${JSON.stringify(level)};\n`;
  fs.writeFileSync(file, js);
  console.log(`data/${level.id}.js : ${level.zones.length} zones, ${Math.round(js.length / 1024)} Ko`);
}

// ---------- France ----------

const DEP_REGION = {
  '01': 84, '02': 32, '03': 84, '04': 93, '05': 93, '06': 93, '07': 84, '08': 44, '09': 76, '10': 44,
  '11': 76, '12': 76, '13': 93, '14': 28, '15': 84, '16': 75, '17': 75, '18': 24, '19': 75, '2A': 94,
  '2B': 94, '21': 27, '22': 53, '23': 75, '24': 75, '25': 27, '26': 84, '27': 28, '28': 24, '29': 53,
  '30': 76, '31': 76, '32': 76, '33': 75, '34': 76, '35': 53, '36': 24, '37': 24, '38': 84, '39': 27,
  '40': 75, '41': 24, '42': 84, '43': 84, '44': 52, '45': 24, '46': 76, '47': 75, '48': 76, '49': 52,
  '50': 28, '51': 44, '52': 44, '53': 52, '54': 44, '55': 44, '56': 53, '57': 44, '58': 27, '59': 32,
  '60': 32, '61': 28, '62': 32, '63': 84, '64': 75, '65': 76, '66': 76, '67': 44, '68': 44, '69': 84,
  '70': 27, '71': 27, '72': 52, '73': 84, '74': 84, '75': 11, '76': 28, '77': 11, '78': 11, '79': 75,
  '80': 32, '81': 76, '82': 76, '83': 93, '84': 93, '85': 52, '86': 75, '87': 75, '88': 44, '89': 27,
  '90': 27, '91': 11, '92': 11, '93': 11, '94': 11, '95': 11,
  '971': 1, '972': 2, '973': 3, '974': 4, '976': 6
};
// Article de chaque département dans une phrase.
const DEP_SENTENCE = {
  '01': "l'Ain", '02': "l'Aisne", '03': "l'Allier", '04': 'les Alpes-de-Haute-Provence', '05': 'les Hautes-Alpes',
  '06': 'les Alpes-Maritimes', '07': "l'Ardèche", '08': 'les Ardennes', '09': "l'Ariège", '10': "l'Aube",
  '11': "l'Aude", '12': "l'Aveyron", '13': 'les Bouches-du-Rhône', '14': 'le Calvados', '15': 'le Cantal',
  '16': 'la Charente', '17': 'la Charente-Maritime', '18': 'le Cher', '19': 'la Corrèze', '2A': 'la Corse-du-Sud',
  '2B': 'la Haute-Corse', '21': "la Côte-d'Or", '22': "les Côtes-d'Armor", '23': 'la Creuse', '24': 'la Dordogne',
  '25': 'le Doubs', '26': 'la Drôme', '27': "l'Eure", '28': "l'Eure-et-Loir", '29': 'le Finistère',
  '30': 'le Gard', '31': 'la Haute-Garonne', '32': 'le Gers', '33': 'la Gironde', '34': "l'Hérault",
  '35': "l'Ille-et-Vilaine", '36': "l'Indre", '37': "l'Indre-et-Loire", '38': "l'Isère", '39': 'le Jura',
  '40': 'les Landes', '41': 'le Loir-et-Cher', '42': 'la Loire', '43': 'la Haute-Loire', '44': 'la Loire-Atlantique',
  '45': 'le Loiret', '46': 'le Lot', '47': 'le Lot-et-Garonne', '48': 'la Lozère', '49': 'le Maine-et-Loire',
  '50': 'la Manche', '51': 'la Marne', '52': 'la Haute-Marne', '53': 'la Mayenne', '54': 'la Meurthe-et-Moselle',
  '55': 'la Meuse', '56': 'le Morbihan', '57': 'la Moselle', '58': 'la Nièvre', '59': 'le Nord',
  '60': "l'Oise", '61': "l'Orne", '62': 'le Pas-de-Calais', '63': 'le Puy-de-Dôme', '64': 'les Pyrénées-Atlantiques',
  '65': 'les Hautes-Pyrénées', '66': 'les Pyrénées-Orientales', '67': 'le Bas-Rhin', '68': 'le Haut-Rhin', '69': 'le Rhône',
  '70': 'la Haute-Saône', '71': 'la Saône-et-Loire', '72': 'la Sarthe', '73': 'la Savoie', '74': 'la Haute-Savoie',
  '75': 'Paris', '76': 'la Seine-Maritime', '77': 'la Seine-et-Marne', '78': 'les Yvelines', '79': 'les Deux-Sèvres',
  '80': 'la Somme', '81': 'le Tarn', '82': 'le Tarn-et-Garonne', '83': 'le Var', '84': 'le Vaucluse',
  '85': 'la Vendée', '86': 'la Vienne', '87': 'la Haute-Vienne', '88': 'les Vosges', '89': "l'Yonne",
  '90': 'le Territoire de Belfort', '91': "l'Essonne", '92': 'les Hauts-de-Seine', '93': 'la Seine-Saint-Denis', '94': 'le Val-de-Marne',
  '95': "le Val-d'Oise", '971': 'la Guadeloupe', '972': 'la Martinique', '973': 'la Guyane', '974': 'La Réunion', '976': 'Mayotte'
};
const DEP_ALIASES = {
  '21': ["Côte d'Or"], '22': ["Côtes d'Armor"], '90': ['Belfort'], '95': ["Val d'Oise"], '974': ['Réunion'],
  '2A': ['Corse du Sud'], '75': ['Ville de Paris']
};

// Disposition commune aux niveaux France : métropole à droite, outre-mer en colonne à gauche.
const FR_WIDTH = 1000;
const FR_HEIGHT = 820;
const METRO_EXTENT = { west: -5.3, east: 9.7, south: 41.25, north: 51.2 };
const FR_CONTEXT = { west: -11, east: 18, south: 37, north: 55 };
const METRO_BOX = { x: 210, y: 10, w: 780, h: 800 };
const DOM_LAYOUT = [
  { code: '971', region: '01', title: 'Guadeloupe', extent: { west: -61.85, east: -60.95, south: 15.8, north: 16.55 } },
  { code: '972', region: '02', title: 'Martinique', extent: { west: -61.27, east: -60.77, south: 14.36, north: 14.91 } },
  { code: '973', region: '03', title: 'Guyane', extent: { west: -54.7, east: -51.5, south: 2.0, north: 5.85 } },
  { code: '974', region: '04', title: 'La Réunion', extent: { west: 55.17, east: 55.88, south: -21.42, north: -20.84 } },
  { code: '976', region: '06', title: 'Mayotte', extent: { west: 44.98, east: 45.33, south: -13.04, north: -12.61 } }
];
const IDF_INSET = { id: 'ile-de-france', title: 'Paris et petite couronne', box: { x: 10, y: 676, w: 190, h: 134 }, extent: { west: 2.12, east: 2.62, south: 48.71, north: 49.02 }, codes: ['75', '92', '93', '94'] };

function franceLayout({ idf = true } = {}) {
  const metro = mercatorFit(METRO_EXTENT, METRO_BOX);
  const insets = [];
  const projectors = {};
  const regionProjectors = {};
  DOM_LAYOUT.forEach((dom, i) => {
    const box = { x: 10, y: 10 + i * 133, w: 190, h: 125 };
    insets.push({ id: dom.code, title: dom.title, x: box.x, y: box.y, w: box.w, h: box.h });
    const inner = { x: box.x + 6, y: box.y + 18, w: box.w - 12, h: box.h - 24 };
    projectors[dom.code] = regionProjectors[dom.region] = mercatorFit(dom.extent, inner);
  });
  const idfInner = { x: IDF_INSET.box.x + 6, y: IDF_INSET.box.y + 18, w: IDF_INSET.box.w - 12, h: IDF_INSET.box.h - 24 };
  if (idf) insets.push({ id: IDF_INSET.id, title: IDF_INSET.title, ...IDF_INSET.box });
  return { metro, projectors, regionProjectors, insets, idf: mercatorFit(IDF_INSET.extent, idfInner) };
}

function franceContext(metro) {
  return contextPaths(metro, FR_CONTEXT, 2);
}
function franceExtent(metro) {
  const [l, t] = metro([FR_CONTEXT.west, FR_CONTEXT.north]);
  const [r, b] = metro([FR_CONTEXT.east, FR_CONTEXT.south]);
  return { left: +l.toFixed(1), top: +t.toFixed(1), right: +r.toFixed(1), bottom: +b.toFixed(1) };
}

function buildFranceDepartements() {
  const layout = franceLayout();
  const features = source('departements').features;
  const items = features.map(f => ({
    id: f.properties.code,
    name: f.properties.nom,
    polygons: polygonsOf(f.geometry),
    project: layout.projectors[f.properties.code] || layout.metro
  }));
  const { rings, arcs } = topoSimplify(items, 0.6, { minArea: 0.8 });
  const neighbors = neighborsOf(items);
  // Limites de régions : arcs partagés par deux départements de régions différentes.
  const overlayArcs = arcs.filter(a => a.owners.length === 2 && DEP_REGION[a.owners[0]] !== DEP_REGION[a.owners[1]]);
  const overlay = [overlayArcs.map(a => linePath(a.points)).join('')];
  if (process.env.DEBUG) {
    const have = new Set(overlayArcs.map(a => a.owners.slice().sort().join('-')));
    for (const [a, list] of Object.entries(neighbors)) for (const b of list) if (a < b && DEP_REGION[a] !== DEP_REGION[b] && !have.has([a, b].sort().join('-'))) console.log('limite manquante', a, b);
    console.log(arcs.filter(a => a.owners.length !== 2).map(a=>a.owners.length).reduce((m,v)=>(m[v]=(m[v]||0)+1,m),{}));
  }
  // Encadré Île-de-France agrandi.
  const idfItems = items.filter(i => IDF_INSET.codes.includes(i.id)).map(i => ({ ...i, project: layout.idf }));
  const idfRings = topoSimplify(idfItems, 0.4).rings;
  const zones = items.map(item => {
    const r = rings.get(item.id);
    const p = interiorPoint(r);
    const zone = { id: item.id, name: item.name, inSentence: DEP_SENTENCE[item.id], type: 'area', d: pathOf(r), label: item.id, labelX: p.x, labelY: p.y };
    if (DEP_ALIASES[item.id]) zone.aliases = DEP_ALIASES[item.id];
    if (idfRings.has(item.id)) {
      const ir = idfRings.get(item.id);
      const ip = interiorPoint(ir);
      Object.assign(zone, { dInset: pathOf(ir), insetLabelX: ip.x, insetLabelY: ip.y });
    }
    return zone;
  }).sort((a, b) => a.label.localeCompare(b.label, 'fr', { numeric: true }));
  for (const zone of zones) if (!DEP_SENTENCE[zone.id]) throw new Error('Article manquant pour ' + zone.id);
  if (zones.length !== 101) throw new Error('101 départements attendus, ' + zones.length + ' trouvés');
  writeLevel({
    id: 'france-departements', title: 'Les départements', width: FR_WIDTH, height: FR_HEIGHT,
    contextExtent: franceExtent(layout.metro),
    zones, context: franceContext(layout.metro), lines: [], overlay, pins: [], neighbors,
    insets: layout.insets, attribution: [ATTRIBUTION.fr, ATTRIBUTION.ne].join(' ; ')
  });
}

const REGION_SENTENCE = {
  '11': "l'Île-de-France", '24': 'le Centre-Val de Loire', '27': 'la Bourgogne-Franche-Comté', '28': 'la Normandie',
  '32': 'les Hauts-de-France', '44': 'le Grand Est', '52': 'les Pays de la Loire', '53': 'la Bretagne',
  '75': 'la Nouvelle-Aquitaine', '76': "l'Occitanie", '84': "l'Auvergne-Rhône-Alpes", '93': "la Provence-Alpes-Côte d'Azur",
  '94': 'la Corse', '01': 'la Guadeloupe', '02': 'la Martinique', '03': 'la Guyane', '04': 'La Réunion', '06': 'Mayotte'
};
const REGION_ALIASES = {
  '24': ['Centre'], '27': ['Bourgogne Franche Comté'], '93': ['PACA', "Provence Alpes Côte d'Azur", "Région Sud"],
  '84': ['Auvergne Rhône Alpes'], '32': ['Hauts de France'], '04': ['Réunion'], '11': ['Île de France', 'Ile de France']
};

function buildFranceRegions() {
  const layout = franceLayout({ idf: false });
  const items = source('regions').features.map(f => ({
    id: f.properties.code,
    name: f.properties.nom,
    polygons: polygonsOf(f.geometry),
    project: layout.regionProjectors[f.properties.code] || layout.metro
  }));
  const { rings } = topoSimplify(items, 0.6, { minArea: 0.8 });
  const zones = items.map(item => {
    const r = rings.get(item.id);
    const p = interiorPoint(r);
    if (!REGION_SENTENCE[item.id]) throw new Error('Article manquant pour la région ' + item.id);
    const zone = { id: item.id, name: item.name, inSentence: REGION_SENTENCE[item.id], type: 'area', d: pathOf(r), labelX: p.x, labelY: p.y };
    if (REGION_ALIASES[item.id]) zone.aliases = REGION_ALIASES[item.id];
    return zone;
  }).sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  if (zones.length !== 18) throw new Error('18 régions attendues, ' + zones.length + ' trouvées');
  writeLevel({
    id: 'france-regions', title: 'Les régions', width: FR_WIDTH, height: FR_HEIGHT,
    contextExtent: franceExtent(layout.metro),
    zones, context: franceContext(layout.metro), lines: [], overlay: [], pins: [], neighbors: neighborsOf(items),
    insets: layout.insets, attribution: [ATTRIBUTION.fr, ATTRIBUTION.ne].join(' ; ')
  });
}

// Noms tels qu'écrits dans Natural Earth (name ou name_fr), plusieurs graphies possibles.
const RIVERS = [
  { id: 'seine', name: 'Seine', inSentence: 'la Seine', kind: 'fleuve', ne: ['Seine'] },
  { id: 'loire', name: 'Loire', inSentence: 'la Loire', kind: 'fleuve', ne: ['Loire'] },
  { id: 'garonne', name: 'Garonne', inSentence: 'la Garonne', kind: 'fleuve', ne: ['Garonne'] },
  { id: 'rhone', name: 'Rhône', inSentence: 'le Rhône', kind: 'fleuve', ne: ['Rhône', 'Rhne'] },
  { id: 'rhin', name: 'Rhin', inSentence: 'le Rhin', kind: 'fleuve', ne: ['Rhin', 'Rhein', 'Rhine'] },
  { id: 'dordogne', name: 'Dordogne', inSentence: 'la Dordogne', kind: 'fleuve', ne: ['Dordogne'] },
  { id: 'meuse', name: 'Meuse', inSentence: 'la Meuse', kind: 'fleuve', ne: ['Maas', 'Meuse'] },
  { id: 'escaut', name: 'Escaut', inSentence: "l'Escaut", kind: 'fleuve', ne: ['Schelde', 'Escaut'] },
  { id: 'somme', name: 'Somme', inSentence: 'la Somme', kind: 'fleuve', ne: ['Somme'] },
  { id: 'charente', name: 'Charente', inSentence: 'la Charente', kind: 'fleuve', ne: ['Charente'] },
  { id: 'adour', name: 'Adour', inSentence: "l'Adour", kind: 'fleuve', ne: ['Adour'] },
  { id: 'vilaine', name: 'Vilaine', inSentence: 'la Vilaine', kind: 'fleuve', ne: ['Vilaine'] },
  { id: 'saone', name: 'Saône', inSentence: 'la Saône', kind: 'riviere', ne: ['Saône', 'Sane'] },
  { id: 'moselle', name: 'Moselle', inSentence: 'la Moselle', kind: 'riviere', ne: ['Mosel', 'Moselle'] },
  { id: 'marne', name: 'Marne', inSentence: 'la Marne', kind: 'riviere', ne: ['Marne'] },
  { id: 'allier', name: 'Allier', inSentence: "l'Allier", kind: 'riviere', ne: ['Allier'] },
  { id: 'lot', name: 'Lot', inSentence: 'le Lot', kind: 'riviere', ne: ['Lot'] },
  { id: 'tarn', name: 'Tarn', inSentence: 'le Tarn', kind: 'riviere', ne: ['Tarn'] },
  { id: 'durance', name: 'Durance', inSentence: 'la Durance', kind: 'riviere', ne: ['Durance'] },
  { id: 'vienne', name: 'Vienne', inSentence: 'la Vienne', kind: 'riviere', ne: ['Vienne'] }
];
const RIVER_AREA = { west: -6, east: 12, south: 41, north: 53 };
const FLEUVES_BOX = { x: 10, y: 10, w: 980, h: 960 };

function buildFranceFleuves() {
  const metro = mercatorFit(METRO_EXTENT, FLEUVES_BOX);
  const lineStrings = geometry => geometry.type === 'LineString' ? [geometry.coordinates] : geometry.type === 'MultiLineString' ? geometry.coordinates : [];
  const inArea = line => line.some(([x, y]) => x > RIVER_AREA.west && x < RIVER_AREA.east && y > RIVER_AREA.south && y < RIVER_AREA.north);
  const features = [...source('rivers').features, ...source('riversEurope').features].filter(f => f.geometry);
  // Décor : contour de la France métropolitaine et limites des régions.
  const regionItems = source('regions').features.filter(f => f.properties.code.length === 2 && +f.properties.code > 10)
    .map(f => ({ id: f.properties.code, polygons: polygonsOf(f.geometry), project: metro }));
  const { arcs, rings: regionRings } = topoSimplify(regionItems, 0.8);
  const franceRings = [...regionRings.values()].flat().filter(r => !r.hole).map(r => r.points);
  const inFrance = ([x, y]) => franceRings.some(pts => {
    let c = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i];
      const [xj, yj] = pts[j];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
    }
    return c;
  });
  const rawLines = [];
  const zones = RIVERS.map(river => {
    const lines = [];
    for (const f of features) {
      const names = [f.properties.name, f.properties.name_fr, f.properties.name_en];
      if (!names.some(n => river.ne.includes(n))) continue;
      for (const line of lineStrings(f.geometry)) if (inArea(line)) lines.push(line);
    }
    if (!lines.length) throw new Error('Cours d\'eau introuvable : ' + river.name);
    rawLines.push({ id: river.id, lines: lines.map(line => line.map(metro)) });
    const projected = lines.map(line => douglasPeucker(line.map(metro), 0.6)).filter(l => l.length > 1);
    // Point d'étiquette : milieu (en longueur) du plus long tronçon situé en France.
    const length = l => l.reduce((sum, p, i) => i ? sum + Math.hypot(p[0] - l[i - 1][0], p[1] - l[i - 1][1]) : 0, 0);
    const runs = [];
    for (const l of projected) {
      let run = [];
      for (const p of l) { if (inFrance(p)) run.push(p); else { if (run.length > 1) runs.push(run); run = []; } }
      if (run.length > 1) runs.push(run);
    }
    const longest = (runs.length ? runs : projected).reduce((a, b) => length(b) > length(a) ? b : a);
    let half = length(longest) / 2;
    let label = longest[0];
    for (let i = 1; i < longest.length; i++) {
      const step = Math.hypot(longest[i][0] - longest[i - 1][0], longest[i][1] - longest[i - 1][1]);
      if (step >= half) { const t = half / step; label = [longest[i - 1][0] + t * (longest[i][0] - longest[i - 1][0]), longest[i - 1][1] + t * (longest[i][1] - longest[i - 1][1])]; break; }
      half -= step;
    }
    return { id: river.id, name: river.name, inSentence: river.inSentence, type: 'line', kind: river.kind, d: projected.map(linePath).join(''), labelX: +label[0].toFixed(1), labelY: +label[1].toFixed(1) };
  });
  // Voisins : cours d'eau qui se rejoignent (extrémité d'un tronçon à moins de 3 unités de l'autre cours d'eau).
  const neighbors = Object.fromEntries(RIVERS.map(r => [r.id, new Set()]));
  for (const a of rawLines) for (const b of rawLines) {
    if (a.id === b.id) continue;
    for (const line of a.lines) for (const end of [line[0], line[line.length - 1]]) {
      if (b.lines.some(other => other.some(p => Math.hypot(p[0] - end[0], p[1] - end[1]) < 3))) { neighbors[a.id].add(b.id); neighbors[b.id].add(a.id); }
    }
  }
  const coast = arcs.filter(a => a.owners.length === 1).map(a => linePath(a.points)).join('');
  const borders = arcs.filter(a => a.owners.length === 2).map(a => linePath(a.points)).join('');
  const [l, t] = metro([FR_CONTEXT.west, FR_CONTEXT.north]);
  const [r, b] = metro([FR_CONTEXT.east, FR_CONTEXT.south]);
  const height = 980;
  writeLevel({
    id: 'france-fleuves', title: 'Les fleuves et rivières', width: 1000, height,
    contextExtent: { left: +l.toFixed(1), top: +t.toFixed(1), right: +r.toFixed(1), bottom: +b.toFixed(1) },
    zones, context: contextPaths(metro, FR_CONTEXT, 2), lines: [coast, borders], overlay: [], pins: [],
    neighbors: Object.fromEntries(Object.entries(neighbors).map(([k, v]) => [k, [...v].sort()])),
    insets: [], attribution: [ATTRIBUTION.ne, ATTRIBUTION.fr].join(' ; ')
  });
}

// ---------- Monde ----------

// Projection Equal Earth (Šavrič, Patterson, Jenny 2018), méridien central lon0, ajustée dans un cadre.
const EE = { A1: 1.340264, A2: -0.081106, A3: 0.000893, A4: 0.003796, M: Math.sqrt(3) / 2 };
function equalEarthRaw(lon, lat) {
  const l = lon * Math.PI / 180;
  const t = Math.asin(EE.M * Math.sin(lat * Math.PI / 180));
  const t2 = t * t, t6 = t2 * t2 * t2;
  const x = l * Math.cos(t) / (EE.M * (EE.A1 + 3 * EE.A2 * t2 + t6 * (7 * EE.A3 + 9 * EE.A4 * t2)));
  const y = t * (EE.A1 + EE.A2 * t2 + t6 * (EE.A3 + EE.A4 * t2));
  return [x, -y];
}
// Longitude relative au méridien central, ramenée dans [-180, 180[.
const wrapLon = (lon, lon0) => ((lon - lon0 + 540) % 360) - 180;
function equalEarthFit(extent, box) {
  const samples = [];
  const west = wrapLon(extent.west, extent.lon0);
  let east = wrapLon(extent.east, extent.lon0);
  if (east <= west) east += 360;
  for (let i = 0; i <= 40; i++) for (let j = 0; j <= 40; j++) {
    samples.push(equalEarthRaw(west + (east - west) * i / 40, extent.south + (extent.north - extent.south) * j / 40));
  }
  const xs = samples.map(p => p[0]);
  const ys = samples.map(p => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const s = Math.min(box.w / (maxX - minX), box.h / (maxY - minY));
  const ox = box.x + (box.w - (maxX - minX) * s) / 2 - minX * s;
  const oy = box.y + (isFinite(box.h) ? (box.h - (maxY - minY) * s) / 2 : 0) - minY * s;
  const project = ([lon, lat]) => {
    const [x, y] = equalEarthRaw(lon, lat);
    return [ox + x * s, oy + y * s];
  };
  project.scale = s;
  project.height = Math.ceil((maxY - minY) * s + 2 * box.y);
  // Anneau en longitudes relatives, sans saut au raccord (un anneau qui traverse le raccord déborde au-delà de 180°).
  project.ring = ring => {
    const rel = ring.map(([lon, lat]) => [wrapLon(lon, extent.lon0), lat]);
    // Un saut de plus de 180° entre deux points voisins signale le raccord : on déroule l'anneau.
    let jumps = false;
    for (let i = 1; i < rel.length; i++) if (Math.abs(rel[i][0] - rel[i - 1][0]) > 180) jumps = true;
    // L'Antarctique fait tout le tour du pôle : il ne se déroule pas.
    if (jumps && !rel.some(p => p[1] < -85)) for (const p of rel) if (p[0] < 0) p[0] += 360;
    return rel;
  };
  project.extentBox = () => {
    const corners = [[west, extent.north], [east, extent.north], [west, extent.south], [east, extent.south], [west, 0], [east, 0]].map(([x, y]) => equalEarthRaw(x, y));
    return { left: +(ox + Math.min(...corners.map(c => c[0])) * s).toFixed(1), top: +(oy + Math.min(...corners.map(c => c[1])) * s).toFixed(1),
      right: +(ox + Math.max(...corners.map(c => c[0])) * s).toFixed(1), bottom: +(oy + Math.max(...corners.map(c => c[1])) * s).toFixed(1) };
  };
  return project;
}
// Les anneaux sont réécrits en longitudes relatives : le projecteur reçoit des longitudes déjà relatives.
function relativeItems(items, project) {
  return items.map(item => ({
    ...item,
    polygons: item.polygons.map(polygon => polygon.map(ring => project.ring(ring))),
    project: ([lon, lat]) => project([lon, lat])
  }));
}

// Contour de la Terre entière dans la projection (décor).
function earthOutline(project) {
  const pts = [];
  for (let lat = -90; lat <= 90; lat += 2) pts.push(project([-180, lat]));
  for (let lat = 90; lat >= -90; lat -= 2) pts.push(project([180, lat]));
  return linePath(pts) + 'Z';
}

const ringCentroid = ring => {
  let x = 0, y = 0;
  for (const p of ring) { x += p[0]; y += p[1]; }
  return [x / ring.length, y / ring.length];
};
const pointInRing = ([x, y], ring) => {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
  }
  return c;
};

const CONTINENTS = [
  { id: 'afrique', ne: 'AFRICA', name: 'Afrique', inSentence: "l'Afrique" },
  { id: 'amerique-nord', ne: 'NORTH AMERICA', name: 'Amérique du Nord', inSentence: "l'Amérique du Nord", aliases: ['Amérique'] },
  { id: 'amerique-sud', ne: 'SOUTH AMERICA', name: 'Amérique du Sud', inSentence: "l'Amérique du Sud", aliases: ['Amérique'] },
  { id: 'antarctique', ne: 'ANTARCTICA', name: 'Antarctique', inSentence: "l'Antarctique", aliases: ['Antarctide'] },
  { id: 'asie', ne: 'ASIA', name: 'Asie', inSentence: "l'Asie" },
  { id: 'europe', ne: 'EUROPE', name: 'Europe', inSentence: "l'Europe" },
  { id: 'oceanie', ne: 'AUSTRALIA', name: 'Océanie', inSentence: "l'Océanie", aliases: ['Australie'] }
];
const NE_CONTINENT = { Africa: 'afrique', 'North America': 'amerique-nord', 'South America': 'amerique-sud', Antarctica: 'antarctique', Asia: 'asie', Europe: 'europe', Oceania: 'oceanie' };
// Continent d'une île absente des grands contours continentaux de Natural Earth.
function islandContinent(props, [lon, lat]) {
  const a3 = props.ADM0_A3;
  if (['ATF', 'HMD', 'SGS', 'IOT'].includes(a3)) return null;
  if (['SYC', 'MUS', 'SHN'].includes(a3)) return 'afrique';
  if (a3 === 'MDV') return 'asie';
  if (lon < -140 && lat < 30 && lat > -60) return 'oceanie'; // Hawaï, îles du Pacifique
  if (a3 === 'RUS' && lon > 60) return 'asie';
  if (props.CONTINENT === 'Europe' && lon < -30) return lat > 12 ? 'amerique-nord' : 'amerique-sud';
  if (props.CONTINENT === 'Europe' && lon > 40 && lat < 0) return 'afrique'; // La Réunion, Mayotte
  if (props.CONTINENT === 'Europe' && lon > 150) return 'oceanie'; // Nouvelle-Calédonie
  return NE_CONTINENT[props.CONTINENT] || null;
}

function buildMondeContinents() {
  const extent = { lon0: 0, west: -180, east: 180, south: -90, north: 90 };
  const project = equalEarthFit(extent, { x: 8, y: 8, w: 984, h: Infinity });
  const height = project.height;
  const mainland = source('continents50').features.filter(f => f.properties.FEATURECLA === 'Continent');
  const polygonsBy = Object.fromEntries(CONTINENTS.map(c => [c.id, []]));
  const mainRings = [];
  for (const c of CONTINENTS) {
    const f = mainland.find(m => m.properties.NAME === c.ne);
    for (const polygon of polygonsOf(f.geometry)) {
      polygonsBy[c.id].push(polygon);
      mainRings.push(polygon[0]);
    }
  }
  // Un contour de pays est déjà couvert si une bonne part de ses sommets tombe dans un grand contour continental.
  const boxes = mainRings.map(ring => {
    const xs = ring.map(p => p[0]), ys = ring.map(p => p[1]);
    return { ring, minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
  });
  const coveredByMainland = ring => {
    const step = Math.max(1, Math.floor(ring.length / 24));
    const sample = ring.filter((_, i) => i % step === 0);
    return boxes.some(b => {
      const inside = sample.filter(([x, y]) => x >= b.minX && x <= b.maxX && y >= b.minY && y <= b.maxY && pointInRing([x, y], b.ring)).length;
      return inside / sample.length > 0.25;
    });
  };
  for (const f of source('countries50').features) {
    for (const polygon of polygonsOf(f.geometry)) {
      if (coveredByMainland(polygon[0])) continue;
      const c = ringCentroid(polygon[0]);
      const continent = islandContinent(f.properties, c);
      if (continent) polygonsBy[continent].push(polygon);
    }
  }
  const items = relativeItems(CONTINENTS.map(c => ({ id: c.id, polygons: polygonsBy[c.id] })), project);
  const { rings } = topoSimplify(items, 0.5, { minArea: 0.3 });
  const zones = CONTINENTS.map(c => {
    const r = rings.get(c.id);
    const p = interiorPoint(r);
    const zone = { id: c.id, name: c.name, inSentence: c.inSentence, type: 'area', d: pathOf(r), labelX: p.x, labelY: p.y };
    if (c.aliases) zone.aliases = c.aliases;
    return zone;
  });
  writeLevel({
    id: 'monde-continents', title: 'Les continents', width: 1000, height,
    contextExtent: { left: 0, top: 0, right: 1000, bottom: height },
    zones, context: [], lines: [earthOutline(project)], overlay: [], pins: [],
    neighbors: { afrique: ['asie', 'europe'], 'amerique-nord': ['amerique-sud'], 'amerique-sud': ['amerique-nord'], antarctique: [], asie: ['afrique', 'europe', 'oceanie'], europe: ['afrique', 'asie'], oceanie: ['asie'] },
    insets: [], attribution: ATTRIBUTION.ne, projection: 'Equal Earth'
  });
}

// ---------- Pays du monde, continent par continent ----------

// [code Natural Earth ADM0_A3, nom, nom dans une phrase, alias éventuels]
const COUNTRY_NAMES = {
  afrique: [
    ['DZA', 'Algérie', "l'Algérie"], ['AGO', 'Angola', "l'Angola"], ['BEN', 'Bénin', 'le Bénin'],
    ['BWA', 'Botswana', 'le Botswana'], ['BFA', 'Burkina Faso', 'le Burkina Faso'], ['BDI', 'Burundi', 'le Burundi'],
    ['CMR', 'Cameroun', 'le Cameroun'], ['CPV', 'Cap-Vert', 'le Cap-Vert', ['Cap Vert']],
    ['CAF', 'République centrafricaine', 'la République centrafricaine', ['Centrafrique']],
    ['COM', 'Comores', 'les Comores'], ['COG', 'Congo', 'le Congo', ['République du Congo', 'Congo-Brazzaville']],
    ['COD', 'République démocratique du Congo', 'la République démocratique du Congo', ['RDC', 'Congo-Kinshasa']],
    ['CIV', "Côte d'Ivoire", "la Côte d'Ivoire"], ['DJI', 'Djibouti', 'Djibouti'], ['EGY', 'Égypte', "l'Égypte"],
    ['ERI', 'Érythrée', "l'Érythrée"], ['SWZ', 'Eswatini', "l'Eswatini", ['Swaziland']], ['ETH', 'Éthiopie', "l'Éthiopie"],
    ['GAB', 'Gabon', 'le Gabon'], ['GMB', 'Gambie', 'la Gambie'], ['GHA', 'Ghana', 'le Ghana'], ['GIN', 'Guinée', 'la Guinée'],
    ['GNB', 'Guinée-Bissau', 'la Guinée-Bissau'], ['GNQ', 'Guinée équatoriale', 'la Guinée équatoriale'],
    ['KEN', 'Kenya', 'le Kenya'], ['LSO', 'Lesotho', 'le Lesotho'], ['LBR', 'Liberia', 'le Liberia'], ['LBY', 'Libye', 'la Libye'],
    ['MDG', 'Madagascar', 'Madagascar'], ['MWI', 'Malawi', 'le Malawi'], ['MLI', 'Mali', 'le Mali'], ['MAR', 'Maroc', 'le Maroc'],
    ['MUS', 'Maurice', 'Maurice', ['Île Maurice']], ['MRT', 'Mauritanie', 'la Mauritanie'], ['MOZ', 'Mozambique', 'le Mozambique'],
    ['NAM', 'Namibie', 'la Namibie'], ['NER', 'Niger', 'le Niger'], ['NGA', 'Nigeria', 'le Nigeria', ['Nigéria']],
    ['UGA', 'Ouganda', "l'Ouganda"], ['RWA', 'Rwanda', 'le Rwanda'], ['STP', 'Sao Tomé-et-Principe', 'Sao Tomé-et-Principe'],
    ['SEN', 'Sénégal', 'le Sénégal'], ['SYC', 'Seychelles', 'les Seychelles'], ['SLE', 'Sierra Leone', 'la Sierra Leone'],
    ['SOM', 'Somalie', 'la Somalie'], ['SDN', 'Soudan', 'le Soudan'], ['SDS', 'Soudan du Sud', 'le Soudan du Sud'],
    ['ZAF', 'Afrique du Sud', "l'Afrique du Sud"], ['TZA', 'Tanzanie', 'la Tanzanie'], ['TCD', 'Tchad', 'le Tchad'],
    ['TGO', 'Togo', 'le Togo'], ['TUN', 'Tunisie', 'la Tunisie'], ['ZMB', 'Zambie', 'la Zambie'], ['ZWE', 'Zimbabwe', 'le Zimbabwe']
  ],
  asie: [
    ['AFG', 'Afghanistan', "l'Afghanistan"], ['SAU', 'Arabie saoudite', "l'Arabie saoudite"], ['ARM', 'Arménie', "l'Arménie"],
    ['AZE', 'Azerbaïdjan', "l'Azerbaïdjan"], ['BHR', 'Bahreïn', 'Bahreïn'], ['BGD', 'Bangladesh', 'le Bangladesh'],
    ['BTN', 'Bhoutan', 'le Bhoutan'], ['MMR', 'Birmanie', 'la Birmanie', ['Myanmar']], ['BRN', 'Brunei', 'Brunei'],
    ['KHM', 'Cambodge', 'le Cambodge'], ['CHN', 'Chine', 'la Chine'], ['CYP', 'Chypre', 'Chypre'],
    ['PRK', 'Corée du Nord', 'la Corée du Nord'], ['KOR', 'Corée du Sud', 'la Corée du Sud'],
    ['ARE', 'Émirats arabes unis', 'les Émirats arabes unis', ['Émirats']], ['GEO', 'Géorgie', 'la Géorgie'],
    ['IND', 'Inde', "l'Inde"], ['IDN', 'Indonésie', "l'Indonésie"], ['IRQ', 'Irak', "l'Irak", ['Iraq']], ['IRN', 'Iran', "l'Iran"],
    ['ISR', 'Israël', 'Israël'], ['JPN', 'Japon', 'le Japon'], ['JOR', 'Jordanie', 'la Jordanie'], ['KAZ', 'Kazakhstan', 'le Kazakhstan'],
    ['KGZ', 'Kirghizistan', 'le Kirghizistan'], ['KWT', 'Koweït', 'le Koweït'], ['LAO', 'Laos', 'le Laos'], ['LBN', 'Liban', 'le Liban'],
    ['MYS', 'Malaisie', 'la Malaisie'], ['MDV', 'Maldives', 'les Maldives'], ['MNG', 'Mongolie', 'la Mongolie'], ['NPL', 'Népal', 'le Népal'],
    ['OMN', 'Oman', 'Oman'], ['UZB', 'Ouzbékistan', "l'Ouzbékistan"], ['PAK', 'Pakistan', 'le Pakistan'], ['PSX', 'Palestine', 'la Palestine'],
    ['PHL', 'Philippines', 'les Philippines'], ['QAT', 'Qatar', 'le Qatar'], ['RUS', 'Russie', 'la Russie'], ['SGP', 'Singapour', 'Singapour'],
    ['LKA', 'Sri Lanka', 'le Sri Lanka'], ['SYR', 'Syrie', 'la Syrie'], ['TJK', 'Tadjikistan', 'le Tadjikistan'], ['TWN', 'Taïwan', 'Taïwan'],
    ['THA', 'Thaïlande', 'la Thaïlande'], ['TLS', 'Timor oriental', 'le Timor oriental', ['Timor-Leste']], ['TUR', 'Turquie', 'la Turquie'],
    ['TKM', 'Turkménistan', 'le Turkménistan'], ['VNM', 'Viêt Nam', 'le Viêt Nam', ['Vietnam']], ['YEM', 'Yémen', 'le Yémen']
  ],
  'amerique-nord': [
    ['ATG', 'Antigua-et-Barbuda', 'Antigua-et-Barbuda'], ['BHS', 'Bahamas', 'les Bahamas'], ['BRB', 'Barbade', 'la Barbade'],
    ['BLZ', 'Belize', 'le Belize'], ['CAN', 'Canada', 'le Canada'], ['CRI', 'Costa Rica', 'le Costa Rica'], ['CUB', 'Cuba', 'Cuba'],
    ['DMA', 'Dominique', 'la Dominique'], ['SLV', 'Salvador', 'le Salvador'], ['USA', 'États-Unis', 'les États-Unis', ['USA']],
    ['GRD', 'Grenade', 'la Grenade'], ['GRL', 'Groenland', 'le Groenland'], ['GTM', 'Guatemala', 'le Guatemala'], ['HTI', 'Haïti', 'Haïti'],
    ['HND', 'Honduras', 'le Honduras'], ['JAM', 'Jamaïque', 'la Jamaïque'], ['MEX', 'Mexique', 'le Mexique'], ['NIC', 'Nicaragua', 'le Nicaragua'],
    ['PAN', 'Panama', 'le Panama'], ['DOM', 'République dominicaine', 'la République dominicaine'],
    ['KNA', 'Saint-Christophe-et-Niévès', 'Saint-Christophe-et-Niévès', ['Saint-Kitts-et-Nevis']], ['LCA', 'Sainte-Lucie', 'Sainte-Lucie'],
    ['VCT', 'Saint-Vincent-et-les-Grenadines', 'Saint-Vincent-et-les-Grenadines'], ['TTO', 'Trinité-et-Tobago', 'Trinité-et-Tobago'],
    ['GLP', 'Guadeloupe', 'la Guadeloupe'], ['MTQ', 'Martinique', 'la Martinique']
  ],
  'amerique-sud': [
    ['ARG', 'Argentine', "l'Argentine"], ['BOL', 'Bolivie', 'la Bolivie'], ['BRA', 'Brésil', 'le Brésil'], ['CHL', 'Chili', 'le Chili'],
    ['COL', 'Colombie', 'la Colombie'], ['ECU', 'Équateur', "l'Équateur"], ['GUY', 'Guyana', 'le Guyana'], ['PRY', 'Paraguay', 'le Paraguay'],
    ['PER', 'Pérou', 'le Pérou'], ['SUR', 'Suriname', 'le Suriname'], ['URY', 'Uruguay', "l'Uruguay"], ['VEN', 'Venezuela', 'le Venezuela', ['Vénézuela']],
    ['GUF', 'Guyane', 'la Guyane', ['Guyane française']]
  ],
  oceanie: [
    ['AUS', 'Australie', "l'Australie"], ['FJI', 'Fidji', 'les Fidji'], ['KIR', 'Kiribati', 'les Kiribati'],
    ['MHL', 'Îles Marshall', 'les Îles Marshall', ['Marshall']], ['FSM', 'Micronésie', 'la Micronésie', ['États fédérés de Micronésie']],
    ['NRU', 'Nauru', 'Nauru'], ['NZL', 'Nouvelle-Zélande', 'la Nouvelle-Zélande'], ['PLW', 'Palaos', 'les Palaos', ['Palau']],
    ['PNG', 'Papouasie-Nouvelle-Guinée', 'la Papouasie-Nouvelle-Guinée'], ['SLB', 'Îles Salomon', 'les Îles Salomon', ['Salomon']],
    ['WSM', 'Samoa', 'les Samoa'], ['TON', 'Tonga', 'les Tonga'], ['TUV', 'Tuvalu', 'les Tuvalu'], ['VUT', 'Vanuatu', 'le Vanuatu'],
    ['NCL', 'Nouvelle-Calédonie', 'la Nouvelle-Calédonie'], ['PYF', 'Polynésie française', 'la Polynésie française', ['Polynésie']],
    ['WLF', 'Wallis-et-Futuna', 'Wallis-et-Futuna']
  ]
};
// Territoires rattachés à une zone jouable (pas de frontière intérieure dessinée).
const MERGED_INTO = { SOL: 'SOM', HKG: 'CHN', MAC: 'CHN', CYN: 'CYP' };
// Zones tirées de quelques polygones d'un pays (outre-mer français) : [code source, emprise].
const PARTS = {
  GLP: ['FRA', { west: -62, east: -60.9, south: 15.8, north: 16.6 }],
  MTQ: ['FRA', { west: -61.3, east: -60.7, south: 14.3, north: 14.95 }],
  GUF: ['FRA', { west: -55, east: -51, south: 1.9, north: 6 }]
};
const WORLD_LEVELS = {
  afrique: { title: "Les pays d'Afrique", extent: { lon0: 18, west: -26, east: 60, south: -36, north: 38 } },
  'amerique-nord': {
    title: "Les pays d'Amérique du Nord", extent: { lon0: -90, west: -170, east: -12, south: 6, north: 84 },
    // Encadré agrandi des Petites Antilles, placé dans l'Atlantique.
    inset: { id: 'antilles', title: 'Petites Antilles', box: { x: 700, y: 230, w: 180, h: 230 }, extent: { west: -63.4, east: -59.3, south: 9.9, north: 18.3 },
      codes: ['ATG', 'BRB', 'DMA', 'GRD', 'KNA', 'LCA', 'VCT', 'TTO', 'GLP', 'MTQ'] }
  },
  'amerique-sud': { title: "Les pays d'Amérique du Sud", extent: { lon0: -60, west: -92, east: -32, south: -56, north: 13 } },
  asie: { title: "Les pays d'Asie", extent: { lon0: 95, west: 25, east: 180, south: -11, north: 80 } },
  oceanie: { title: "Les pays d'Océanie", extent: { lon0: 165, west: 110, east: -128, south: -48, north: 22 } }
};

// Fusionne des polygones voisins (les arêtes communes s'annulent) et renvoie les anneaux extérieurs restants.
function dissolve(polygons) {
  const signed = ring => {
    let a = 0;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) a += (ring[j][0] - ring[i][0]) * (ring[j][1] + ring[i][1]);
    return a / 2;
  };
  const edges = new Map();
  for (const polygon of polygons) polygon.forEach((raw, index) => {
    let ring = openRing(raw);
    const ccw = signed(ring) > 0;
    if ((index === 0) !== ccw) ring = ring.slice().reverse();
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i];
      const b = ring[(i + 1) % ring.length];
      const back = keyOf(b) + '>' + keyOf(a);
      if (edges.has(back)) edges.delete(back);
      else edges.set(keyOf(a) + '>' + keyOf(b), [a, b]);
    }
  });
  const from = new Map();
  for (const [a, b] of edges.values()) {
    const k = keyOf(a);
    if (!from.has(k)) from.set(k, []);
    from.get(k).push(b);
  }
  const rings = [];
  for (const [startKey, list] of from) {
    while (list.length) {
      const ring = [];
      let key = startKey;
      let point = null;
      do {
        const next = from.get(key);
        if (!next || !next.length) break;
        point = next.pop();
        ring.push(point);
        key = keyOf(point);
      } while (key !== startKey);
      if (ring.length >= 3) rings.push(ring);
    }
  }
  const outers = rings.filter(r => signed(r) > 0);
  const holes = rings.filter(r => signed(r) <= 0);
  return outers.map(outer => [outer, ...holes.filter(h => pointInRing(h[0], outer))]);
}

const withinExtent = (ring, e) => ring.some(([x, y]) => x >= e.west && x <= e.east && y >= e.south && y <= e.north);

function buildWorldCountries(continent) {
  const level = WORLD_LEVELS[continent];
  const names = COUNTRY_NAMES[continent];
  const project = equalEarthFit(level.extent, { x: 8, y: 8, w: 984, h: Infinity });
  const features = source('countries50').features;
  const byCode = new Map(features.map(f => [f.properties.ADM0_A3, f]));
  const playable = new Set(names.map(n => n[0]));
  const items = names.map(([code, name, inSentence, aliases]) => {
    let polygons;
    if (PARTS[code]) {
      const [sourceCode, e] = PARTS[code];
      polygons = polygonsOf(byCode.get(sourceCode).geometry).filter(p => p[0].every(([x, y]) => x >= e.west && x <= e.east && y >= e.south && y <= e.north));
    } else {
      if (!byCode.has(code)) throw new Error('Pays absent de Natural Earth : ' + code);
      polygons = polygonsOf(byCode.get(code).geometry);
      const merged = Object.entries(MERGED_INTO).filter(([, target]) => target === code).map(([from]) => byCode.get(from));
      if (merged.length) polygons = dissolve([...polygons, ...merged.flatMap(f => polygonsOf(f.geometry))]);
    }
    if (!polygons.length) throw new Error('Aucun contour pour ' + code);
    return { id: code, name, inSentence, aliases, polygons };
  });
  // Pays de la même région affichés en fond, pour que la carte ne flotte pas dans le vide.
  const used = new Set([...playable, ...Object.keys(MERGED_INTO).filter(k => playable.has(MERGED_INTO[k]))]);
  const relWest = wrapLon(level.extent.west, level.extent.lon0);
  let relEast = wrapLon(level.extent.east, level.extent.lon0);
  if (relEast <= relWest) relEast += 360;
  const extentRel = { west: relWest - 30, east: relEast + 30, south: level.extent.south - 15, north: Math.min(90, level.extent.north + 10) };
  const context = [];
  const inPart = (code, polygon) => Object.entries(PARTS).some(([k, [src, e]]) => src === code && playable.has(k) &&
    polygon[0].every(([x, y]) => x >= e.west && x <= e.east && y >= e.south && y <= e.north));
  for (const f of features) {
    const code = f.properties.ADM0_A3;
    if (used.has(code)) continue;
    const parts = [];
    for (const polygon of polygonsOf(f.geometry)) {
      if (inPart(code, polygon)) continue;
      const ring = project.ring(polygon[0]);
      const lons = ring.map(p => p[0]);
      const lats = ring.map(p => p[1]);
      if (Math.max(...lons) < extentRel.west || Math.min(...lons) > extentRel.east || Math.max(...lats) < extentRel.south || Math.min(...lats) > extentRel.north) continue;
      const pts = douglasPeucker(ring.map(project), 1);
      if (pts.length >= 3 && ringArea(pts) > 1) parts.push({ points: pts });
    }
    if (parts.length) context.push(pathOf(parts));
  }
  const rel = relativeItems(items, project);
  const { rings } = topoSimplify(rel, 0.5, { minArea: 0.5 });
  let insetRings = new Map();
  const insets = [];
  if (level.inset) {
    const { id, title, box, extent, codes } = level.inset;
    const inner = { x: box.x + 6, y: box.y + 18, w: box.w - 12, h: box.h - 24 };
    const insetProject = mercatorFit(extent, inner);
    insetRings = topoSimplify(items.filter(i => codes.includes(i.id)).map(i => ({ ...i, project: insetProject })), 0.4).rings;
    insets.push({ id, title, ...box });
  }
  const pins = [];
  const zones = items.map(item => {
    const r = rings.get(item.id);
    const p = interiorPoint(r);
    if (!p) throw new Error('Contour vide après simplification : ' + item.id + ' (' + item.polygons.length + ' polygones)');
    const box = bboxOf(r);
    const zone = { id: item.id, name: item.name, inSentence: item.inSentence, type: 'area', d: pathOf(r), labelX: p.x, labelY: p.y };
    if (item.aliases) zone.aliases = item.aliases;
    if (insetRings.has(item.id)) {
      const ir = insetRings.get(item.id);
      const ip = interiorPoint(ir);
      Object.assign(zone, { dInset: pathOf(ir), insetLabelX: ip.x, insetLabelY: ip.y });
    }
    // Repère visible pour les pays trop petits pour être touchés au doigt.
    const area = r.filter(x => !x.hole).reduce((sum, x) => sum + ringArea(x.points), 0);
    if (Math.max(box.maxX - box.minX, box.maxY - box.minY) < 10 || area < 30) pins.push({ id: item.id, x: p.x, y: p.y, visible: true });
    return zone;
  }).sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  writeLevel({
    id: 'monde-' + continent, title: level.title, width: 1000, height: project.height,
    contextExtent: { left: 0, top: 0, right: 1000, bottom: project.height },
    zones, context, lines: [], overlay: [], pins, neighbors: neighborsOf(items),
    insets, attribution: ATTRIBUTION.ne, projection: 'Equal Earth'
  });
}

// ---------- Index ----------

const LEVELS = {
  'monde-afrique': { title: "Les pays d'Afrique", group: 'Monde', build: () => buildWorldCountries('afrique') },
  'monde-amerique-nord': { title: "Les pays d'Amérique du Nord", group: 'Monde', build: () => buildWorldCountries('amerique-nord') },
  'monde-amerique-sud': { title: "Les pays d'Amérique du Sud", group: 'Monde', build: () => buildWorldCountries('amerique-sud') },
  'monde-asie': { title: "Les pays d'Asie", group: 'Monde', build: () => buildWorldCountries('asie') },
  'monde-oceanie': { title: "Les pays d'Océanie", group: 'Monde', build: () => buildWorldCountries('oceanie') },
  'monde-continents': { title: 'Les continents', group: 'Monde', build: buildMondeContinents },
  'france-fleuves': { title: 'Les fleuves et rivières', group: 'France', build: buildFranceFleuves },
  'france-regions': { title: 'Les régions', group: 'France', build: buildFranceRegions },
  'france-departements': { title: 'Les départements', group: 'France', build: buildFranceDepartements }
};

function writeIndex() {
  const list = Object.entries(LEVELS)
    .filter(([id]) => fs.existsSync(path.join(dataDir, id + '.js')))
    .map(([id, l]) => ({ id, title: l.title, group: l.group, file: `data/${id}.js` }));
  fs.writeFileSync(path.join(dataDir, 'index.js'), `// Généré par scripts/generate-levels.mjs, ne pas modifier à la main.\nwindow.GEO_LEVEL_LIST = ${JSON.stringify(list, null, 2)};\n`);
  console.log(`data/index.js : ${list.length} niveaux`);
}

const wanted = process.argv.slice(2);
for (const id of wanted.length ? wanted : Object.keys(LEVELS)) {
  if (!LEVELS[id]) throw new Error('Niveau inconnu : ' + id);
  LEVELS[id].build();
}
writeIndex();
