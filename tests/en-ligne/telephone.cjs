// Vérifie le site EN LIGNE (GitHub Pages) sur plusieurs tailles de téléphone et un ordinateur :
// chaque niveau prêt se charge sans erreur, la page ne déborde pas en largeur,
// une question s'ouvre avec ses réponses et la fenêtre de résultat s'affiche.
// Usage : node tests/en-ligne/telephone.cjs [url]   (captures dans captures/)
const { chromium } = require('playwright');
const fs = require('fs');
const vm = require('vm');

const URL = (process.argv[2] || 'https://lechampdelaurore-boop.github.io/quiz-carte-europe/').replace(/\/?$/, '/');
const SIZES = [[320, 568], [360, 640], [375, 667], [390, 664], [390, 844], [412, 780], [430, 932], [1366, 768]];
const expectedApp = (fs.readFileSync('index.html', 'utf8').match(/app\.js\?v=[^"]+/) || [])[0];
const listContext = { window: {} };
vm.runInNewContext(fs.readFileSync('data/index.js', 'utf8'), listContext);
const LEVELS = ['europe', ...listContext.window.GEO_LEVEL_LIST.map(level => level.id)];

(async () => {
  fs.mkdirSync('captures', { recursive: true });
  // Attendre que GitHub Pages serve la version du dépôt (même app.js?v= et même liste de niveaux).
  const expectedList = fs.readFileSync('data/index.js', 'utf8');
  for (let i = 0; ; i++) {
    const live = await fetch(URL + '?nocache=' + Date.now()).then(r => r.text()).catch(() => '');
    const liveList = await fetch(URL + 'data/index.js?nocache=' + Date.now()).then(r => r.text()).catch(() => '');
    if (expectedApp && live.includes(expectedApp) && liveList === expectedList) { console.log('Version en ligne : ' + expectedApp + ', ' + LEVELS.length + ' niveaux'); break; }
    if (i >= 18) { console.log('Version en ligne différente de ' + expectedApp + ' après 3 min'); process.exit(1); }
    await new Promise(r => setTimeout(r, 10000));
  }

  const browser = await chromium.launch();
  const lines = [`| Écran | ${LEVELS.join(' | ')} |`, `|---|${LEVELS.map(() => '---').join('|')}|`];
  let failed = false;
  for (const [w, h] of SIZES) {
    const cells = [];
    for (const level of LEVELS) {
      const mobile = w < 800;
      const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: mobile, hasTouch: mobile });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
      const problems = [];
      try {
        await page.goto(`${URL}?niveau=${level}&nocache=${Date.now()}`);
        await page.waitForFunction(() => document.querySelectorAll('#europe-map .country').length > 0, null, { timeout: 15000 });
        const current = await page.evaluate(() => localStorage.getItem('atlas-club-level'));
        if (current !== level) problems.push(`niveau ouvert : ${current}`);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        if (overflow > 0) problems.push(`déborde de ${overflow} px en largeur`);
        await page.click('#random-button');
        await page.waitForSelector('#quiz-question:not([hidden])', { timeout: 5000 });
        const answers = await page.locator('#answers button').count();
        if (answers < 2) problems.push(`${answers} réponse(s)`);
        await page.screenshot({ path: `captures/${w}x${h}-${level}-question.png` });
        await page.locator('#answers button').first().click();
        await page.waitForSelector('#result-dialog[open]', { timeout: 5000 });
        await page.waitForTimeout(1200);
        await page.screenshot({ path: `captures/${w}x${h}-${level}-resultat.png` });
      } catch (error) {
        problems.push(error.message.split('\n')[0]);
      }
      if (errors.length) problems.push(`erreurs console : ${errors.join(' / ')}`);
      if (problems.length) failed = true;
      cells.push(problems.length ? `❌ ${problems.join(' ; ')}` : '✅');
      await page.close();
    }
    lines.push(`| ${w}×${h} | ${cells.join(' | ')} |`);
  }
  await browser.close();
  const report = lines.join('\n');
  console.log(report);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, '## Test téléphone (site en ligne)\n\n' + report + '\n');
  process.exit(failed ? 1 : 0);
})();
