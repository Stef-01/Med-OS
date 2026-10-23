#!/usr/bin/env node
/* smoke.mjs - the whole two-person flow in Chromium, at 393 px (a phone), 320 px and 1280 px:
   names → first candidate → New Study Session → Add Random ×2 → Start Practice → skip reading → finish → tick items +
   global impression → AI marking (chat path: paste a reply) → Next Station shows the other partner → swap → End Session
   → results → Marked → a preview (the patient script runs history, exam findings, Part 2) → Settings → the candidate screen link opens and counts down.
   No network beyond the local server; the Anthropic API is never called. Screenshots go to the folder given as the
   first argument (default: a temp folder). Exit 1 on any failure or page error.
   Run: npm run e2e   (serves public/ itself on a free port) */
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'public');
const SHOTS = process.argv[2] || fs.mkdtempSync(path.join(os.tmpdir(), 'osce-e2e-'));
fs.mkdirSync(SHOTS, { recursive: true });

function loadPlaywright() {
  const tries = [import.meta.url, '/opt/node22/lib/node_modules/'];
  for (const t of tries) { try { return createRequire(t)('playwright'); } catch {} }
  throw new Error('playwright is not installed: npm i -D playwright');
}
const { chromium } = loadPlaywright();

const TYPES = { '.html': 'text/html', '.mjs': 'text/javascript', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
/* a stand-in for the Supabase REST endpoint the sync uses (osce_state): GET by ns, POST upsert, older stamps never win */
const SB = new Map();
function supabase(req, res, url) {
  if (req.method === 'GET') {
    const ns = (url.searchParams.get('ns') || '').replace(/^eq\./, '');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify([...SB.values()].filter(r => r.ns === ns)));
  }
  let body = '';
  req.on('data', c => { body += c; });
  req.on('end', () => {
    for (const r of JSON.parse(body || '[]')) { const k = `${r.ns}\n${r.id}`, had = SB.get(k); if (!had || Date.parse(r.updated_at) > Date.parse(had.updated_at)) SB.set(k, r); }
    res.writeHead(201); res.end();
  });
}
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/sb/rest/v1/osce_state') return supabase(req, res, url);
  const u = decodeURIComponent(url.pathname);
  let f = path.join(ROOT, u.endsWith('/') ? `${u}index.html` : u);
  if (!f.startsWith(ROOT) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise(r => server.listen(0, r));
const BASE = `http://localhost:${server.address().port}/`;

const fails = [];
const ok = (cond, msg) => { if (!cond) fails.push(msg); console.log(`${cond ? 'ok  ' : 'FAIL'} ${msg}`); };

const REPLY = id => JSON.stringify({ items: [{ id, done: true, quote: 'I am washing my hands' }], global: 2, feedback: 'Clear introduction. Keep going.',
  phrasing: [], summary: { missed: ['Did not check allergies'], strengths: ['Good rapport'], next: 'Ask about allergies before any drug.' }, escalation: [], handover: {} });

async function run(width, height, label) {
  try { await runIn(width, height, label); }
  catch (e) { fails.push(`${label}: ${e.message.split('\n')[0]}`); console.error(`FAIL ${label}: ${e.message.split('\n')[0]}`); if (lastPage) await lastPage.screenshot({ path: path.join(SHOTS, `${label}-crash.png`) }).catch(() => {}); }
}
let lastPage = null;
async function runIn(width, height, label) {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width, height }, deviceScaleFactor: 2 });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE.slice(0, -1) });
  await ctx.route(/^https:\/\//, r => r.abort());   /* nothing leaves the machine */
  /* the X-ray station's body and image come from fixtures, routed before the first load: the app keeps a body once fetched,
     so a random session that happens to pick this station must already get the fixture */
  const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
  await ctx.route(/\/osce\/ai-8b37c286\.json$/, async r => {
    const body = JSON.parse(fs.readFileSync(path.join(ROOT, 'osce', 'ai-8b37c286.json'), 'utf8'));
    body.media = { patientScript: [{ src: 'media/ai-8b37c286/axr-1.png', alt: 'Supine abdominal radiograph', w: 800, h: 900, caption: 'Abdominal X-ray: show when the candidate asks for imaging', req: 'axr-1',
      credit: { author: 'Dr Example', license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0', page: 'https://commons.wikimedia.org/wiki/File:Example.png', via: 'Wikimedia Commons' } }] };
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await ctx.route(/\/media\/ai-8b37c286\/axr-1\.png$/, r => r.fulfill({ status: 200, contentType: 'image/png', body: PNG }));
  const pg = await ctx.newPage();
  lastPage = pg;
  const errs = [];
  pg.on('pageerror', e => errs.push(e.message));
  pg.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  const shot = n => pg.screenshot({ path: path.join(SHOTS, `${label}-${n}.png`) });
  const click = sel => pg.locator(sel).first().click();
  const finish = async (page = pg) => { for (let i = 0; i < 4 && !(await page.locator('.os-finished').count()); i++) await page.locator('[data-os="skip"]').first().click(); await page.waitForSelector('.os-finished'); };

  await pg.goto(BASE, { waitUntil: 'networkidle' });
  await pg.waitForSelector('.os[data-ready]');
  ok(await pg.locator('[data-os="back"]').isHidden(), `${label}: the first screen has no back button`);
  const nBank = fs.readdirSync('public/osce').filter(f => f.endsWith('.json') && f !== 'index.json').length;
  ok((await pg.textContent('.os-kicker')).split(/\D+/).includes(String(nBank)), `${label}: every station in the bank is listed (${nBank})`);
  const wideScroll = await pg.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1 || [...document.querySelectorAll('.os-main *')].some(e => e.getBoundingClientRect().right > innerWidth + 1 && getComputedStyle(e).position !== 'fixed'));
  ok(!wideScroll, `${label}: nothing runs off the right edge`);

  /* partners */
  await pg.fill('[data-person="0"]', 'Alex');
  await pg.fill('[data-person="1"]', 'Sam');
  ok((await pg.textContent('[data-os="cand"][data-i="1"]')).trim() === 'Sam', `${label}: names reach the first-candidate buttons`);
  await click('[data-os="cand"][data-i="0"]');
  await shot('start');

  /* a session of two */
  await click('[data-os="new"]');
  if (width < 900) { await click('[data-os="browse"]'); await pg.waitForSelector('.os-dlg .os-grid .os-scard'); }
  await click('[data-os="random"]');
  await click('[data-os="random"]');
  if (width < 900) { await shot('browse'); await click('.os-dlg [data-os="dclose"]'); await pg.waitForTimeout(300); }
  ok(await pg.locator('.os-qi').count() === 2, `${label}: two stations queued`);
  await click('[data-os="startp"]');
  await pg.waitForSelector('.os-timer');
  ok(/Candidate Alex · examiner Sam/.test(await pg.textContent('.os-sub')), `${label}: the header names the candidate and the examiner`);
  await shot('clock');
  ok(/Reading.*Part 1.*Part 2/.test((await pg.locator('.os-tc').allTextContents()).join('|')), `${label}: the clock runs Reading, Part 1 and Part 2`);
  ok(/5:00/.test(await pg.textContent('.os-tc.cur')), `${label}: reading time is 5 minutes`);
  await click('[data-os="skip"]');   /* reading → Part 1 */
  ok(/10:00|9:5\d/.test(await pg.textContent('.os-tc.cur')), `${label}: Part 1 is 10 minutes`);
  await click('[data-os="tab"][data-tab="Patient Script"]');
  await click('.os-pl [data-os="jump"][data-to="ex"]');
  /* the smooth scroll settles: a long history (the AMSA cases) takes longer than a short one */
  const landed = await pg.waitForFunction(() => { const nav = document.querySelector('.os-pl .os-jump').getBoundingClientRect(), e = document.querySelector('.os-pl .os-exam').getBoundingClientRect(); return e.top >= nav.bottom - 1 && e.top - nav.bottom < 30; }, null, { timeout: 3000 }).then(() => true, () => false);
  await pg.waitForTimeout(200);   /* the jump bar lights on the last scroll event */
  ok(landed
    && await pg.locator('.os-pl [data-os="jump"][data-to="ex"][aria-current="true"]').count() === 1, `${label}: the jump bar takes the examiner to the exam findings and lights Exam`);
  await shot('jump');
  if (await pg.locator('.os-pl .os-exshow').count()) {   /* the candidate asks for the vitals: the examiner turns the screen */
    await pg.locator('.os-pl .os-exshow').first().click();
    await pg.waitForSelector('.os-present.in');
    ok((await pg.textContent('.os-prs-slide h2')).trim() === 'Vital signs' && await pg.locator('.os-present .os-vitals dt').count() >= 3 && !(await pg.locator('.os-present .os-exsteps').count()),
      `${label}: the vitals turn to the candidate as a grid, without the examination findings`);
    ok((await pg.textContent('.os-prs-who')).trim() === 'For the candidate', `${label}: the turned screen says who it is for`);
    await pg.waitForTimeout(300);
    await shot('vitals');
    await click('.os-prs-back');
    await pg.waitForSelector('.os-present', { state: 'detached' });
  }
  await click('[data-os="skip"]');   /* Part 1 → Part 2 */
  await pg.waitForTimeout(300);
  const qa = pg.locator('.os-part2').first();
  ok(await qa.isVisible() && await pg.locator('[data-os="tab"][data-tab="Patient Script"][aria-selected="true"]').count() === 1, `${label}: Part 2 opens the patient script at its questions and results`);
  ok(await pg.evaluate(() => { const [h, e, q] = ['.os-pl .os-sheet[data-hl]', '.os-pl .os-exam', '.os-pl .os-part2'].map(s => document.querySelector(s)); return !!(h && e && q) && !!(h.compareDocumentPosition(e) & 4) && !!(e.compareDocumentPosition(q) & 4); }), `${label}: the script runs the history, the exam findings, then Part 2`);
  ok(await qa.locator('.os-p2steps button').count() >= 4 && await qa.locator('.os-p2steps [aria-current="step"]').textContent().then(t => /Results/.test(t)) && await qa.locator('.os-qacard').count() >= 2, `${label}: Part 2 opens on the results, with a step for each question`);
  await pg.waitForTimeout(900);   /* the smooth scroll settles */
  ok(await qa.evaluate(e => { const t = e.getBoundingClientRect().top; return t >= 0 && t < innerHeight / 2; }), `${label}: the patient script scrolls to the Part 2 questions`);
  await shot('part2');
  const firstResult = (await qa.locator('.os-qacard strong').first().textContent()).trim();
  await qa.locator('.os-qashow').click();
  await pg.waitForSelector('.os-present.in');
  const covered = await pg.evaluate(() => { const r = [[0.5, 0.5], [0.1, 0.9], [0.9, 0.1]].map(([x, y]) => document.elementFromPoint(innerWidth * x, innerHeight * y)); return r.every(e => e && e.closest('.os-present')); });
  ok(covered && !(await pg.locator('.os-present .os-check, .os-present .os-qaask').count()), `${label}: the results fill the screen and nothing of the rubric or the questions shows`);
  ok((await pg.textContent('.os-prs-slide h2')).trim() === firstResult, `${label}: the presenter starts at the first result`);
  ok(await pg.waitForFunction(() => getComputedStyle(document.querySelector('.os-present')).opacity === '1', null, { timeout: 2000 }).then(() => true, () => false), `${label}: the results layer fades in fully opaque`);
  ok(/^Part 2 · [0-5]:\d\d$/.test((await pg.textContent('.os-prs-time')).trim()), `${label}: the results show the time left in Part 2`);
  await shot('presenter');
  const n = await qa.locator('.os-qacard').count();
  await click('[data-os="pnext"]');
  ok(/^2 of/.test(await pg.textContent('.os-prs-n')), `${label}: Next moves to the second result`);
  await pg.keyboard.press('ArrowLeft');
  ok(/^1 of/.test(await pg.textContent('.os-prs-n')) && n >= 2, `${label}: the arrow keys move back`);
  await pg.keyboard.press('Escape');
  await pg.waitForSelector('.os-present', { state: 'detached' });
  ok(await qa.locator('.os-qashow').isVisible(), `${label}: closing the results brings the examiner back to the results step`);
  await qa.locator('.os-p2foot .os-primary').click();   /* Ask the first question */
  const q1 = pg.locator('.os-pl .os-part2').first();
  ok(/^Question 1 of \d · ISBAR handover$/.test((await q1.locator('.os-p2eye').textContent()).trim()) && await q1.locator('.os-qaexp').isVisible() && !(await q1.locator('.os-qacard').count()),
    `${label}: the first question is the ISBAR handover, with its expected answer and nothing else`);
  await pg.waitForTimeout(350);   /* the step settles */
  await shot('question1');
  const chip = q1.locator('.os-p2chip').nth(1), chipLabel = (await chip.textContent()).trim();
  await chip.click();   /* the candidate asks to see a result again */
  await pg.waitForSelector('.os-present.in');
  ok((await pg.textContent('.os-prs-slide h2')).trim() === chipLabel && /ISBAR/.test(await pg.textContent('.os-prs-q')) && !(await pg.locator('.os-present .os-qaexp').count()),
    `${label}: a chip turns the screen to that result, with the question and without the expected answer`);
  await pg.waitForTimeout(300);
  await shot('chip');
  await click('.os-prs-back');
  await pg.waitForSelector('.os-present', { state: 'detached' });
  ok(await pg.locator('.os-pl .os-p2chip.seen').count() >= 2, `${label}: each result the candidate has seen carries a tick`);
  await pg.locator('.os-pl .os-p2foot .os-primary').click();   /* Next question */
  ok(await pg.locator('.os-pl .os-ddx:not(.os-ddx--compact) .os-dd--likely').count() === 1 && await pg.locator('.os-pl .os-p2q .os-ddx--compact .os-dd').count() >= 3, `${label}: the script lists the reasonable differentials, and the differentials question carries them`);
  ok(/^Question 2 of/.test((await pg.locator('.os-pl .os-p2eye').textContent()).trim()) && await pg.locator('.os-pl .os-p2steps button.done').count() === 2, `${label}: Next question moves on and ticks off the steps behind it`);
  ok(await pg.locator('.os-pl [data-os="jump"][data-to="p2"][aria-current="true"]').count() === 1, `${label}: the jump bar lights Part 2`);
  await click('[data-os="tab"][data-tab="Marking"]');
  ok(await pg.evaluate(() => { const sc = document.querySelector('.os-pl .os-pscroll'), h = document.querySelector('.os-pl .os-h-p2'); const d = h && h.getBoundingClientRect().top - sc.getBoundingClientRect().top; return d >= 0 && d < 60; }), `${label}: after the Part 2 bell, Marking opens at the Part 2 items`);
  await shot('mark-p2');
  await click('[data-os="tab"][data-tab="Patient Script"]');
  await click('[data-os="skip"]');   /* Part 2 → finished */
  await pg.waitForSelector('.os-finished');
  if (width < 900) await click('[data-os="tab"][data-tab="Marking"]');
  const first = pg.locator('.os-check input[data-tick]').first();
  const firstKey = await first.getAttribute('data-tick');
  await first.check();
  await click('.os-gil.c-success input[value="2"]');
  ok(/1 of \d+ items ticked|[1-9]\d* of \d+ items ticked/.test(await pg.textContent('.os-tally')), `${label}: ticking updates the tally`);

  /* AI marking, the chat path */
  await click('[data-ai-fold] > summary');
  await pg.fill('[data-ai="tx"]', 'Candidate: Hi, I am Alex, a medical student. I am washing my hands.');
  await click('[data-os="aicopy"]');
  const clip = await pg.evaluate(() => navigator.clipboard.readText()).catch(() => '');
  ok(/checklist/.test(clip) && /transcript/.test(clip), `${label}: the copied prompt carries the checklist and the transcript`);
  const leaf = await pg.evaluate(() => document.querySelector('.os-check input[data-tick]:not([data-parent])')?.dataset.tick);
  await pg.fill('[data-ai="reply"]', `Here you go:\n\`\`\`json\n${REPLY(leaf || firstKey)}\n\`\`\``);
  await click('[data-os="aipaste"]');
  await pg.waitForSelector('.os-ai--done');
  ok(/At standard/.test(await pg.textContent('.os-ai--done')), `${label}: the pasted reply shows as AI marking`);
  await shot('marked');

  /* next station: the other partner sits it */
  await click('.os-finished [data-os="nextdlg"]');
  await pg.waitForSelector('.os-nextd');
  ok(/Sam is the candidate/.test(await pg.textContent('.os-roles')), `${label}: the next station goes to the other partner`);
  await click('[data-os="swap"]');
  ok(/Alex is the candidate/.test(await pg.textContent('.os-roles')), `${label}: Swap changes it`);
  await click('[data-os="swap"]');
  await click('[data-os="startnext"]');
  await pg.waitForSelector('.os-timer');
  ok(/Candidate Sam/.test(await pg.textContent('.os-sub')), `${label}: station 2 is Sam's`);

  /* candidate screen */
  await click('[data-os="pp"]'); await click('[data-os="pp"]');   /* pause, play: the clock is running */
  await click('[data-os="more"]');
  await click('.os-pop [data-v="cand"]');
  await pg.waitForSelector('.os-candurl');
  const link = await pg.inputValue('.os-candurl');
  ok(/\?cand=(ai|amsa)-[\w-]+/.test(link), `${label}: the candidate link names the station`);
  await click('.os-dlg [data-os="dclose"], .os-dlg .os-dlg-x');
  const cp = await ctx.newPage();
  cp.on('pageerror', e => errs.push(`candidate: ${e.message}`));
  await cp.goto(link, { waitUntil: 'networkidle' });
  await cp.waitForSelector('.os-candpage .os-tasks, .os-candpage .os-sheet');
  const t1 = await cp.textContent('.os-tc.cur b'); await cp.waitForTimeout(1300); const t2 = await cp.textContent('.os-tc.cur b');
  ok(t1 !== t2, `${label}: the candidate screen counts down (${t1} → ${t2})`);
  ok(!(await cp.locator('text=Patient Script').count()), `${label}: the candidate screen hides the patient script`);
  await cp.screenshot({ path: path.join(SHOTS, `${label}-candidate.png`) });
  await cp.close();
  /* the same link once Part 2 has started: the results the examiner hands over appear on the candidate's phone */
  const p2 = new URL(link); p2.searchParams.set('c', 'm'); p2.searchParams.set('left', '200'); p2.searchParams.set('t', String(Date.now()));
  const cp2 = await ctx.newPage();
  cp2.on('pageerror', e => errs.push(`candidate: ${e.message}`));
  await cp2.goto(p2.toString(), { waitUntil: 'networkidle' });
  await cp2.waitForSelector('.os-cpart2 .os-p2', { timeout: 5000 }).catch(() => {});
  ok(await cp2.locator('.os-cpart2 .os-p2list li').count() >= 2 && !(await cp2.locator('.os-cpart2 .os-p2ask').count()), `${label}: in Part 2 the candidate's screen shows the results, not the examiner's questions`);
  await cp2.screenshot({ path: path.join(SHOTS, `${label}-candidate-part2.png`) });
  await cp2.close();

  /* end the session: results list both, with their initials */
  await finish();
  await click('.os-finished [data-os="end"]');
  await pg.waitForSelector('.os-results');
  ok(await pg.locator('.os-results .os-who').count() === 2, `${label}: results show whose attempt each was`);
  await shot('results');
  await click('.os-results [data-os="dclose"]');
  await pg.waitForTimeout(300);

  /* back to start: per-person counts, the Marked view */
  await click('[data-os="back"]');
  await pg.waitForSelector('.os-start');
  ok(/Alex 1 · Sam 1/.test(await pg.textContent('.os-kicker')), `${label}: the start view counts each of you`);
  await click('[data-os="marked"]');
  await pg.waitForSelector('.os-mcard');
  ok(await pg.locator('.os-mcard').count() === 1, `${label}: Marked lists the AI-marked attempt`);
  await click('[data-os="back"]');

  /* a preview: the exam findings and Part 2 sit in the patient script, after the history; the marking sheet is the rubric */
  await click('[data-os="new"]');
  if (width < 900) { await click('[data-os="browse"]'); }
  await pg.waitForSelector('.os-scard [data-os="preview"]');
  await click('.os-scard [data-os="preview"]');
  await pg.waitForSelector('.os-pv');
  const tabs = await pg.locator('.os-pv [data-os="pvtab"]').allTextContents();
  ok(!tabs.includes('Exam') && tabs.includes('Marking') && tabs.includes('Patient Script'), `${label}: preview has Patient Script and Marking tabs, no separate Exam tab`);
  await click('.os-pv [data-tab="Patient Script"]');
  ok(await pg.locator('.os-pv .os-exam .os-exstep').count() > 0 && await pg.locator('.os-pv .os-exam ~ .os-part2').count() === 1, `${label}: the patient script carries the exam findings, then Part 2`);
  await click('.os-pv [data-tab="Marking"]');
  ok(await pg.locator('.os-pv .os-check input[data-tick]').count() > 10 && await pg.locator('.os-pv .os-part2, .os-pv .os-exam').count() === 0, `${label}: the full marking rubric renders, and only the rubric`);
  await shot('preview');
  await pg.keyboard.press('Escape');

  /* observations on the patient's chart: the croup toddler is on the 1 to 4 years chart; the candidate gets the chart and
     nothing of the examiner's, the examiner's card has the zones and the model answer closed */
  await pg.fill('.os-q', 'stridor'); await pg.waitForTimeout(300);
  await click('.os-scard[data-id="ai-e8892591"] [data-os="preview"]');
  await pg.waitForSelector('.os-pv');
  await click('.os-pv [data-tab="Patient Script"]');
  const card = pg.locator('.os-pv .os-qacard').first();
  ok(await card.locator('.os-obs-table').count() === 1 && await card.locator('details.os-model:not([open]) .os-obs-zones').count() === 1, `${label}: the examiner's card has the observations, and the zones and model answer one tap away`);
  await click('.os-pv .os-qashow');
  await pg.waitForSelector('.os-present.in');
  ok(await pg.locator('.os-present svg.os-obs-page').count() === 2 && /1 to 4 years/.test(await pg.textContent('.os-present .os-obs-cap')), `${label}: the results show the observations on the 1 to 4 years chart, both pages`);
  ok(await pg.locator('.os-present .os-obs-zones, .os-present .os-model').count() === 0, `${label}: the chart's zones and the model answer never reach the candidate`);
  ok(await pg.evaluate(() => [...document.querySelectorAll('.os-present svg.os-obs-page')].every(s => s.getBoundingClientRect().right <= innerWidth + 1)), `${label}: the chart fits the screen`);
  await pg.waitForTimeout(250);
  await shot('chart');
  await pg.keyboard.press('Escape');
  await pg.waitForSelector('.os-present', { state: 'detached' });
  await pg.keyboard.press('Escape');

  /* lab results printed the way a pathology system prints them: the PPH bloods, an abnormal value red with an asterisk */
  await pg.fill('.os-q', 'postpartum haemorrhage on delivery'); await pg.waitForTimeout(300);
  await click('.os-scard[data-id="ai-a98052d6"] [data-os="preview"]');
  await pg.waitForSelector('.os-pv');
  await click('.os-pv [data-tab="Patient Script"]');
  const labCard = pg.locator('.os-pv .os-qacard').filter({ has: pg.locator('.os-lab') }).first();
  ok(/Ref. Range \(Units\)/.test(await labCard.locator('.os-lab-t thead').first().textContent()) && await labCard.locator('.os-lab-ab').count() >= 2, `${label}: lab results print as Test | Result | Ref. Range (Units), abnormal ones flagged`);
  await labCard.locator('[data-os="present"]').click();
  await pg.waitForSelector('.os-present.in');
  await pg.waitForFunction(() => getComputedStyle(document.querySelector('.os-present')).opacity === '1', null, { timeout: 2000 }).catch(() => {});
  ok(await pg.locator('.os-present .os-lab-ab i').first().textContent() === '*' && await pg.locator('.os-present .os-model').count() === 0, `${label}: the candidate sees the lab table with its asterisks, not the model answer`);
  ok(await pg.evaluate(() => { const t = document.querySelector('.os-present .os-lab'); return t && t.scrollWidth <= t.clientWidth + 1; }), `${label}: the lab table fits the screen`);
  await shot('labs');
  await pg.keyboard.press('Escape');
  await pg.waitForSelector('.os-present', { state: 'detached' });
  ok(/Am I going to die/.test(await pg.textContent('.os-pv .os-part2 .os-p2pt')) && !/Am I going to die/.test(await pg.textContent('.os-pv .os-sheet[data-hl]')), `${label}: what the patient says in Part 2 sits in the Part 2 card, not the Part 1 script`);
  await click('.os-pv [data-os="markp2"]');
  await pg.waitForTimeout(800);
  ok(await pg.locator('.os-pv [data-tab="Marking"][aria-selected="true"]').count() === 1 && await pg.locator('.os-pv .os-h-p2').evaluate(h => { const t = h.getBoundingClientRect().top; return t >= 0 && t < innerHeight / 2; }), `${label}: Mark Part 2 opens the marking sheet at Interpretation`);
  await pg.keyboard.press('Escape');
  if (width < 900) await pg.keyboard.press('Escape');
  await pg.keyboard.press('Escape');

  /* a station with an X-ray: the figure, its caption and the licence credit (the body and the image from fixtures) */
  if (label !== 'small') {
    await click('[data-os="new"]');
    if (width < 900) { await click('[data-os="browse"]'); }
    await pg.fill('.os-q', 'right upper quadrant');
    await pg.waitForSelector('.os-scard[data-id="ai-8b37c286"] [data-os="preview"]');
    await click('.os-scard[data-id="ai-8b37c286"] [data-os="preview"]');
    await pg.waitForSelector('.os-pv');
    await click('.os-pv [data-tab="Patient Script"]');
    await pg.waitForSelector('.os-pv .os-fig img');
    ok(await pg.locator('.os-pv .os-fig img').evaluate(i => i.complete && i.naturalWidth > 0), `${label}: the X-ray loads in the patient script`);
    ok(/Abdominal X-ray: show when/.test(await pg.textContent('.os-pv figcaption')) && await pg.locator('.os-pv .os-credit a[href^="https://creativecommons.org"]').count() === 1, `${label}: the caption and the licence credit show under it`);
    await shot('figure');
    await pg.keyboard.press('Escape'); await pg.waitForSelector('.os-pv', { state: 'detached' });
    if (width < 900) { await pg.keyboard.press('Escape'); await pg.waitForTimeout(300); }
    await pg.keyboard.press('Escape');
  }

  /* settings */
  await pg.waitForSelector('[data-os="settings"]');
  await click('[data-os="settings"]');
  await pg.waitForSelector('.os-set');
  await pg.fill('[data-set="key"]', 'not-a-key');
  await click('[data-os="ssave"]');
  ok(await pg.locator('.os-set').count() === 1, `${label}: a malformed key is refused`);
  await shot('settings');
  await pg.keyboard.press('Escape');
  await pg.waitForSelector('.os-set', { state: 'detached' });

  /* Mark with Claude: a key on this device, the vendored SDK, the Messages API answered by a stub */
  if (label === 'phone') {
    let sent = null;
    await ctx.route('https://api.anthropic.com/**', async r => {
      if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'POST' } });
      sent = { url: r.request().url(), headers: r.request().headers(), body: JSON.parse(r.request().postData() || '{}') };
      const leafId = /\[(\d+(?:\.\d+)?)\]/.exec(sent.body.messages?.[0]?.content || '')?.[1] || '2';
      return r.fulfill({ status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ id: 'msg_1', type: 'message', role: 'assistant', model: 'claude-opus-5-5', stop_reason: 'end_turn', stop_details: null,
          content: [{ type: 'text', text: REPLY(leafId) }], usage: { input_tokens: 10, output_tokens: 10 } }) });
    });
    await click('[data-os="settings"]');
    await pg.fill('[data-set="key"]', 'sk-ant-api03-test-key-not-real');
    await click('[data-os="ssave"]');
    await pg.waitForSelector('.os-set', { state: 'detached' });
    ok(/sk-ant-api03-test-key-not-real/.test(await pg.evaluate(() => localStorage.getItem('osce.marker.v1')) || ''), `${label}: the key is saved on this device`);
    await click('[data-os="new"]');
    await click('[data-os="browse"]'); await pg.waitForSelector('.os-dlg .os-grid .os-scard');
    await click('[data-os="random"]'); await click('.os-dlg [data-os="dclose"]'); await pg.waitForTimeout(300);
    await click('[data-os="startp"]'); await pg.waitForSelector('.os-timer');
    await finish();
    await click('[data-os="tab"][data-tab="Marking"]');
    await click('[data-ai-fold] > summary');
    await pg.fill('[data-ai="tx"]', 'Candidate: Hello, I am Alex. I am washing my hands.');
    await click('[data-os="aisend"]');
    await pg.waitForSelector('.os-ai--done', { timeout: 10000 }).catch(() => {});
    ok(await pg.locator('.os-ai--done').count() === 1, `${label}: Mark with Claude shows the marks`);
    ok(sent && sent.body.model === 'claude-opus-5-5' && sent.body.output_config?.format?.type === 'json_schema' && /server-side-fallback/.test(sent.headers['anthropic-beta'] || ''),
      `${label}: the request names the model, the JSON schema and the fallback beta`);
    const keyIn = sent ? [sent.headers.authorization === 'Bearer sk-ant-api03-test-key-not-real' || sent.headers['x-api-key'] === 'sk-ant-api03-test-key-not-real', sent.url.includes('sk-ant'), JSON.stringify(sent.body).includes('sk-ant')] : [];
    ok(sent && sent.headers['anthropic-dangerous-direct-browser-access'] === 'true' && keyIn[0] && !keyIn[1] && !keyIn[2], `${label}: the key goes only in the API's auth header`);
    ok(await pg.locator('.os-check input[data-tick]:checked').count() >= 1, `${label}: the marks tick the checklist`);
    await shot('ai-direct');
  }

  ok(!errs.length, `${label}: no page errors${errs.length ? `: ${errs.join(' | ')}` : ''}`);
  await b.close();
}

/* two devices, one shared record: what one of you does on your phone shows on the other's */
async function sync() {
  const b = await chromium.launch(), errs = [];
  const device = async () => {
    const ctx = await b.newContext({ viewport: { width: 393, height: 852 } });
    await ctx.route(/\/config\.js$/, r => r.fulfill({ contentType: 'text/javascript', body: `window.OSCE_CONFIG = { supabaseUrl: '${BASE}sb', supabaseAnonKey: 'anon' };` }));
    const pg = await ctx.newPage(); pg.on('pageerror', e => errs.push(e.message));
    await pg.goto(BASE, { waitUntil: 'networkidle' }); await pg.waitForSelector('.os[data-ready]');
    return pg;
  };
  const a = await device();
  await a.fill('[data-person="0"]', 'Alex'); await a.fill('[data-person="1"]', 'Sam');
  await a.click('[data-os="new"]'); await a.click('[data-os="browse"]'); await a.waitForSelector('.os-dlg .os-grid .os-scard');
  await a.click('[data-os="random"]'); await a.click('.os-dlg [data-os="dclose"]'); await a.waitForTimeout(300);
  await a.click('[data-os="startp"]'); await a.waitForSelector('.os-timer');
  for (let i = 0; i < 4 && !(await a.locator('.os-finished').count()); i++) await a.click('[data-os="skip"]');
  await a.waitForSelector('.os-finished');
  await a.click('[data-os="tab"][data-tab="Marking"]'); await a.locator('.os-check input[data-tick]').first().check();
  await a.click('.os-finished [data-os="end"]'); await a.waitForSelector('.os-results');
  await a.waitForTimeout(900);   /* one upload per 400 ms */
  ok([...SB.keys()].some(k => k.startsWith('osce\nhist/')) && SB.has('osce\nk/people'), 'sync: the attempt and the names reach the shared record');
  ok(![...SB.keys()].some(k => /k\/(sess|run|disc)/.test(k)), 'sync: the running session and filters stay on the device');
  const bpg = await device();
  ok(await bpg.inputValue('[data-person="0"]') === 'Alex' && /Alex 1/.test(await bpg.textContent('.os-kicker')), 'sync: the other device shows the names and Alex\'s attempt');
  ok(!errs.length, `sync: no page errors${errs.length ? `: ${errs.join(' | ')}` : ''}`);
  await b.close();
}

try {
  await sync();
  await run(393, 852, 'phone');
  await run(320, 640, 'small');
  await run(1280, 860, 'wide');
} catch (e) { fails.push(`crashed: ${e.message}`); console.error(e); }
server.close();
console.log(`\n${fails.length ? `${fails.length} failed` : 'all passed'} · screenshots in ${SHOTS}`);
process.exit(fails.length ? 1 : 0);
