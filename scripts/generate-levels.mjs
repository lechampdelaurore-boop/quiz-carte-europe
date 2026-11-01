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
  regions: FR + 'regions-version-simplifiee.geojson'
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
    const rings = [];
    for (const polygon of item.polygons) {
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
        if (ringIndex === 0 && minArea && ringArea(out) < minArea) return;
        rings.push({ points: out, hole: ringIndex > 0 });
      });
    }
    result.set(item.id, rings);
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
  { code: '971', title: 'Guadeloupe', extent: { west: -61.85, east: -60.95, south: 15.8, north: 16.55 } },
  { code: '972', title: 'Martinique', extent: { west: -61.27, east: -60.77, south: 14.36, north: 14.91 } },
  { code: '973', title: 'Guyane', extent: { west: -54.7, east: -51.5, south: 2.0, north: 5.85 } },
  { code: '974', title: 'La Réunion', extent: { west: 55.17, east: 55.88, south: -21.42, north: -20.84 } },
  { code: '976', title: 'Mayotte', extent: { west: 44.98, east: 45.33, south: -13.04, north: -12.61 } }
];
const IDF_INSET = { id: 'ile-de-france', title: 'Paris et petite couronne', box: { x: 10, y: 676, w: 190, h: 134 }, extent: { west: 2.12, east: 2.62, south: 48.71, north: 49.02 }, codes: ['75', '92', '93', '94'] };

function franceLayout() {
  const metro = mercatorFit(METRO_EXTENT, METRO_BOX);
  const insets = [];
  const projectors = {};
  DOM_LAYOUT.forEach((dom, i) => {
    const box = { x: 10, y: 10 + i * 133, w: 190, h: 125 };
    insets.push({ id: dom.code, title: dom.title, x: box.x, y: box.y, w: box.w, h: box.h });
    const inner = { x: box.x + 6, y: box.y + 18, w: box.w - 12, h: box.h - 24 };
    projectors[dom.code] = mercatorFit(dom.extent, inner);
  });
  const idfInner = { x: IDF_INSET.box.x + 6, y: IDF_INSET.box.y + 18, w: IDF_INSET.box.w - 12, h: IDF_INSET.box.h - 24 };
  insets.push({ id: IDF_INSET.id, title: IDF_INSET.title, ...IDF_INSET.box });
  return { metro, projectors, insets, idf: mercatorFit(IDF_INSET.extent, idfInner) };
}

function franceContext(metro) {
  return contextPaths(metro, FR_CONTEXT, 2);
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
  const [l, t] = layout.metro([FR_CONTEXT.west, FR_CONTEXT.north]);
  const [r, b] = layout.metro([FR_CONTEXT.east, FR_CONTEXT.south]);
  writeLevel({
    id: 'france-departements', title: 'Les départements', width: FR_WIDTH, height: FR_HEIGHT,
    contextExtent: { left: +l.toFixed(1), top: +t.toFixed(1), right: +r.toFixed(1), bottom: +b.toFixed(1) },
    zones, context: franceContext(layout.metro), lines: [], overlay, pins: [], neighbors,
    insets: layout.insets, attribution: [ATTRIBUTION.fr, ATTRIBUTION.ne].join(' ; ')
  });
}

// ---------- Index ----------

const LEVELS = {
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
