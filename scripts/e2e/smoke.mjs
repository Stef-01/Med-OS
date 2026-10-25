#!/usr/bin/env node
/* smoke.mjs - the whole two-person flow in Chromium, at 393 px (a phone), 320 px and 1280 px (and Duel a Mate, two phones):
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
import { execFile } from 'node:child_process';
import { requestsFrom } from '../../public/js/osce/requests.mjs';
import { submissionsFrom } from '../lib/mcq-intake.mjs';
import { cleanItem } from '../../public/js/mcq/schema.mjs';
import { createServer as duelServer } from '../../public/js/vendor/pup-duel/duel/server-core.mjs';

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
/* and for mcq_submissions (supabase/migrations/0003_mcq.sql): GET every row, POST an insert (a repeated id is 409, as RLS
   with a primary key gives; there is no update) */
const MCQ = new Map();
function mcqTable(req, res) {
  if (req.method === 'GET') { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify([...MCQ.values()])); }
  let body = '';
  req.on('data', c => { body += c; });
  req.on('end', () => {
    const rows = [].concat(JSON.parse(body || '[]'));
    if (rows.some(r => MCQ.has(r.id) || r.item?.id !== r.id || r.item?.provenance?.kind !== 'user')) { res.writeHead(409); return res.end(); }
    for (const r of rows) MCQ.set(r.id, { ...r, created_at: new Date().toISOString() });
    res.writeHead(201); res.end();
  });
}
/* and for the duel's functions (supabase/migrations/0002_pup_duel.sql), the vendored package's own copy of their rules */
const DUEL = duelServer();
function duelRpc(req, res, fn) {
  let body = '';
  req.on('data', c => { body += c; });
  req.on('end', async () => {
    const a = JSON.parse(body || '{}'), call = {
      pup_register: () => DUEL.register(a.p_name, a.p_pin, a.p_look ?? {}), pup_login: () => DUEL.login(a.p_name, a.p_pin), pup_touch: () => DUEL.touch(a.p_token, a.p_look ?? null),
      pup_roster: () => DUEL.roster(a.p_token), pup_challenge: () => DUEL.challenge(a.p_token, a.p_opponent, a.p_setup), pup_inbox: () => DUEL.inbox(a.p_token),
      pup_post: () => DUEL.post(a.p_token, a.p_duel, a.p_id, a.p_kind, a.p_body ?? {}), pup_log: () => DUEL.log(a.p_token, a.p_duel, a.p_after ?? 0)
    }[fn];
    try { const out = await call(); res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(out)); }
    catch (e) { res.writeHead(400, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ code: 'P0001', message: e.message })); }
  });
}
/* the headers vercel.json gives each path, the CSP above all, so the e2e sees what production allows (a later rule
   overrides an earlier one for the same header, as on Vercel) */
const VERCEL = JSON.parse(fs.readFileSync(path.join(ROOT, '..', 'vercel.json'), 'utf8')).headers.map(h => ({ re: new RegExp(`^${h.source}$`), headers: h.headers }));
const prodHeaders = p => Object.fromEntries(VERCEL.filter(h => h.re.test(p)).flatMap(h => h.headers.map(x => [x.key, x.value])));
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  for (const [k, v] of Object.entries(prodHeaders(url.pathname))) res.setHeader(k, v);
  if (url.pathname === '/sb/rest/v1/osce_state') return supabase(req, res, url);
  if (url.pathname === '/sb/rest/v1/mcq_submissions') return mcqTable(req, res);
  const rpc = /^\/sb\/rest\/v1\/rpc\/(pup_[a-z]+)$/.exec(url.pathname);
  if (rpc) return duelRpc(req, res, rpc[1]);
  const u = decodeURIComponent(url.pathname);
  let f = path.join(ROOT, u.endsWith('/') ? `${u}index.html` : u);
  if (!f.startsWith(ROOT) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise(r => server.listen(0, r));
const BASE = `http://localhost:${server.address().port}/`;

const fails = [];
const PACK = JSON.parse(fs.readFileSync(path.join(ROOT, 'duel', 'pack.json'), 'utf8'));
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
    body.media = { patientScript: [{ src: 'media/ai-8b37c286/axr-1.png', alt: 'Supine abdominal radiograph', w: 800, h: 900, caption: 'Abdominal X-ray: show when the candidate asks for imaging', req: 'axr-1', findings: 'Dilated central small bowel loops with valvulae conniventes and a collapsed colon.',
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
    /* the findings under the image: closed until tapped, labelled AI-written; the image opens full size */
    const fnd = pg.locator('.os-pv .os-findings');
    ok(await fnd.count() === 1 && !(await fnd.evaluate(d => d.open)) && /Findings/.test(await fnd.locator('summary').textContent()) && /AI-written/i.test(await fnd.locator('summary b').textContent()), `${label}: the findings sit under the image, closed, labelled AI-written`);
    await fnd.locator('summary').click();
    ok(await fnd.evaluate(d => d.open) && /valvulae conniventes/.test(await fnd.locator('p').textContent()) && await fnd.locator('p').isVisible(), `${label}: a tap opens the findings sentence`);
    ok(await pg.locator('.os-pv .os-figzoom').getAttribute('href') === './media/ai-8b37c286/axr-1.png', `${label}: the image links to itself at full size`);
    await shot('figure');
    await pg.keyboard.press('Escape'); await pg.waitForSelector('.os-pv', { state: 'detached' });
    if (width < 900) { await pg.keyboard.press('Escape'); await pg.waitForTimeout(300); }
    await pg.keyboard.press('Escape');
  }

  /* a case request with no shared database: a search that finds nothing offers it, the form sends it, and the request
     travels as a message the writer's pipeline reads back */
  await click('[data-os="new"]');
  if (width < 900) { await click('[data-os="browse"]'); }
  await pg.fill('.os-q', 'snakebite on a bush walk'); await pg.waitForTimeout(400);
  ok(await pg.locator('.os-empty [data-os="reqnew"]').count() === 1, `${label}: a search that finds nothing offers to request the case`);
  await click('.os-empty [data-os="reqnew"]');
  await pg.waitForSelector('.os-reqf');
  ok(await pg.inputValue('.os-reqf [name="topic"]') === 'snakebite on a bush walk', `${label}: the search becomes the request's topic`);
  await pg.locator('.os-reqchip:has(input[value="acute"])').click();
  await pg.locator('.os-reqchip:has(input[value="bloods"])').click();
  ok(await pg.locator('.os-reqchip.on:has(input[value="bloods"])').count() === 1, `${label}: a chosen chip shows as chosen`);
  ok(await pg.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1 && [...document.querySelectorAll('.os-reqf *')].every(e => e.getBoundingClientRect().right <= innerWidth + 1)), `${label}: the request form fits the screen`);
  await shot('request-form');
  await click('.os-reqsend');
  await pg.waitForSelector('.os-reqlist');
  ok(/Requested/.test(await pg.textContent('.os-reqrow .os-reqst')) && await pg.locator('.os-reqrow [data-os="reqcopy"]').count() === 1, `${label}: the request is listed as Requested, with Copy to send it`);
  await click('.os-reqrow [data-os="reqcopy"]');
  const asked = requestsFrom(await pg.evaluate(() => navigator.clipboard.readText()));
  ok(asked.length === 1 && asked[0].topic === 'snakebite on a bush walk' && asked[0].setting === 'acute' && (asked[0].results || []).includes('bloods'), `${label}: Copy gives a message the writer's pipeline reads back`);
  await shot('requests');
  await pg.keyboard.press('Escape');
  await pg.fill('.os-q', ''); await pg.waitForTimeout(300);   /* the browser keeps its search between opens: leave it as found */
  if (width < 900) await pg.keyboard.press('Escape');
  await pg.keyboard.press('Escape');
  await pg.waitForSelector('.os-start [data-os="requests"]');
  ok(/1 waiting/.test(await pg.textContent('.os-start [data-os="requests"]')), `${label}: the start view counts the request as waiting`);

  /* Submit a question with no shared database: the checks run as you type, a flaw is named before submit, the key is
     marked, the question is kept on the phone and Export gives the file the pool's intake reads; paste reads CSV */
  await click('.os-start [data-os="mcq"]');
  await pg.waitForSelector('.os-mcqf');
  ok(await pg.locator('.os-mcqf .os-reqsend').isDisabled(), `${label}: an empty question cannot be submitted`);
  await pg.fill('.os-mcqf [name="stem"]', 'A 64-year-old man comes to the emergency department because of crushing central chest pain for 2 hours. He smokes. His pulse is 96/min and blood pressure is 150/90 mm Hg. Examination shows diaphoresis. An ECG shows 3 mm ST elevation in leads II, III and aVF.');
  await pg.fill('.os-mcqf [name="ask"]', 'Each of the following is appropriate EXCEPT which?');
  for (const [i, o] of ['Primary percutaneous coronary intervention', 'Exercise electrocardiographic stress testing', 'Outpatient transthoracic echocardiography', 'Oral proton pump inhibitor therapy trial'].entries()) await pg.fill(`.os-mcqf [name="opt${i}"]`, o);
  await pg.waitForSelector('.os-mcqchecks [data-check="schema"]');
  ok(/mark one option/.test(await pg.textContent('.os-mcqchecks')) && await pg.locator('.os-mcqf .os-reqsend').isDisabled(), `${label}: with no key marked the checks say so and Submit waits`);
  await pg.locator('.os-mcqf .os-mcqkey').first().click();
  await pg.waitForSelector('.os-mcqchecks [data-check="negative-stem"]');
  ok(await pg.locator('.os-mcqchecks [data-check="negative-stem"] .os-mcqsev').textContent() === 'Fix', `${label}: the negative lead-in is named before submit, live`);
  await pg.fill('.os-mcqf [name="ask"]', 'Which of the following is the most appropriate next step in management?');
  await pg.fill('.os-mcqf [name="explanation"]', 'Inferior STEMI within 12 hours of onset needs reperfusion; primary PCI is preferred where it is available in time.');
  await pg.selectOption('.os-mcqf [name="topic"]', 'Cardiology');
  await pg.waitForSelector('.os-mcqchecks .os-mcqok');
  ok(await pg.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1 && [...document.querySelectorAll('.os-mcqf *')].every(e => e.getBoundingClientRect().right <= innerWidth + 1)), `${label}: the question form fits the screen`);
  await shot('mcq-form');
  await click('.os-mcqf .os-reqsend');
  await pg.waitForSelector('.os-mcqs .os-mcqrow');
  ok(/Not sent/.test(await pg.textContent('.os-mcqrow .os-reqst')), `${label}: with no shared database the question is kept on the phone, marked not sent`);
  await click('.os-mcqs [data-os="mcqcopy"]');
  const exported = submissionsFrom(await pg.evaluate(() => navigator.clipboard.readText()));
  ok(exported.length === 1 && exported[0].provenance.kind === 'user' && exported[0].answer === 0 && !!cleanItem(exported[0]) && exported[0].provenance.submittedBy, `${label}: the export is the user's question, with its key and who sent it, as the intake reads it`);
  await click('[data-os="mcqnew"]');
  await pg.waitForSelector('.os-mcqf');
  await pg.locator('.os-mcqpaste summary').click();
  const csv = 'stem,a,b,c,d,e,answer,explanation\n"A 5-year-old girl is brought to the clinic with a limp for 3 days. Her temperature is 38.9°C. Examination shows a hot, swollen right knee. What is the most likely diagnosis?",Septic arthritis,Transient synovitis,Perthes disease,Juvenile idiopathic arthritis,,A,Fever and a hot joint\n"A 70-year-old woman comes to the clinic with a 2-week history of headache and jaw pain. Examination shows a tender temporal artery. What is the most appropriate next step?",High-dose prednisolone,Temporal artery biopsy only,Paracetamol,MRI brain,All of the above,A,Treat first';
  await pg.fill('.os-mcqf [name="paste"]', csv);
  await click('.os-mcqf [data-os="mcqimport"]');
  ok(/2 questions read/.test(await pg.textContent('.os-mcqfound')) && /Question 2: Option E is "All of the above"/.test(await pg.textContent('.os-mcqchecks')), `${label}: a pasted CSV of two questions is read and each is checked (all of the above is named)`);
  await shot('mcq-paste');
  await pg.keyboard.press('Escape');
  await pg.keyboard.press('Escape');
  await pg.waitForSelector('.os-start [data-os="mcq"]');
  ok(/1 submitted/.test(await pg.textContent('.os-start [data-os="mcq"]')), `${label}: the start view counts the submitted question`);

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
  const device = async route => {
    const ctx = await b.newContext({ viewport: { width: 393, height: 852 } });
    await ctx.route(/\/config\.js$/, r => r.fulfill({ contentType: 'text/javascript', body: `window.OSCE_CONFIG = { supabaseUrl: '${BASE}sb', supabaseAnonKey: 'anon' };` }));
    if (route) await route(ctx);
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

  /* a case request through the shared record: asked on one phone, answered by the writer's pipeline (the real script,
     against this stand-in), seen on the other phone; and Ready once the bank holds a station made from it */
  await a.click('.os-results [data-os="dclose"]'); await a.waitForTimeout(300); await a.click('[data-os="back"]'); await a.waitForSelector('.os-start [data-os="requests"]');   /* the session's setup, then the start view */
  await a.click('[data-os="requests"]'); await a.waitForSelector('.os-reqf');
  await a.fill('.os-reqf [name="topic"]', 'acute pulmonary oedema in an 80-year-old');
  await a.locator('.os-reqchip:has(input[value="xray"])').click();
  await a.click('.os-reqsend'); await a.waitForSelector('.os-reqlist');
  await a.waitForTimeout(900);
  const reqKey = [...SB.keys()].find(k => k.startsWith('osce\nreq/')), rid = reqKey ? reqKey.split('req/')[1] : '';
  ok(!!rid && SB.get(reqKey).value.topic === 'acute pulmonary oedema in an 80-year-old' && SB.get(reqKey).value.by === 'Alex', 'sync: the request reaches the shared record, with who asked');
  const inbox = fs.mkdtempSync(path.join(os.tmpdir(), 'req-e2e-'));
  const writer = (...args) => new Promise(res => execFile(process.execPath, [path.join(ROOT, '..', 'scripts', 'requests.mjs'), ...args],
    { env: { ...process.env, OSCE_SUPABASE_URL: `${BASE}sb`, OSCE_SUPABASE_KEY: 'anon', OSCE_REQUESTS_DIR: inbox } }, (e, out, err) => res({ e, out: `${out}${err}` })));
  const queued = await writer();
  ok(!queued.e && queued.out.includes(rid) && /acute pulmonary oedema/.test(queued.out) && /X-ray/.test(queued.out), 'sync: the writer\'s queue lists it from the shared record');
  const acc = await writer('accept', rid.slice(0, 6), 'Writing it this week');
  ok(!acc.e && SB.get(reqKey).value.status === 'accepted', `sync: the writer accepts it by a short id${acc.e ? `: ${acc.out}` : ''}`);
  const cpg = await device();
  await cpg.click('[data-os="requests"]'); await cpg.waitForSelector('.os-reqlist');
  ok(/Being written/.test(await cpg.textContent('.os-reqrow .os-reqst')) && /Writing it this week/.test(await cpg.textContent('.os-reqrow')), 'sync: the other phone shows it being written, with the writer\'s note');
  const index = JSON.parse(fs.readFileSync(path.join(ROOT, 'osce', 'index.json'), 'utf8')), made = index.stations[0];
  made.request = rid;
  const dpg = await device(ctx => ctx.route(/\/osce\/index\.json$/, r => r.fulfill({ contentType: 'application/json', body: JSON.stringify(index) })));
  ok(/1 ready/.test(await dpg.textContent('.os-start [data-os="requests"]')), 'sync: a station made from the request makes the start view say it is ready');
  await dpg.click('[data-os="requests"]'); await dpg.waitForSelector('.os-reqlist');
  ok(/Ready/.test(await dpg.textContent('.os-reqrow .os-reqst')), 'sync: the request reads Ready once the bank holds its station');
  await dpg.click('.os-reqrow [data-os="preview"]'); await dpg.waitForSelector('.os-pv');
  ok(await dpg.locator(`[role="dialog"][aria-label="${made.title.replace(/"/g, '\\"')}"] .os-pv`).count() === 1, 'sync: Open station opens the station made from it');
  /* a question through the shared table: submitted on a phone, inserted (never updated), pulled by the pool's intake (the
     real script, against this stand-in, into a temp file), and its status from the pool build shown to the submitter */
  await dpg.keyboard.press('Escape'); await dpg.keyboard.press('Escape'); await dpg.waitForSelector('.os-start [data-os="mcq"]');
  await dpg.click('.os-start [data-os="mcq"]'); await dpg.waitForSelector('.os-mcqf');
  await dpg.fill('.os-mcqf [name="stem"]', 'A 25-year-old woman comes to the emergency department because of wheeze and breathlessness for 6 hours. Her respiratory rate is 30/min, pulse 120/min and SpO2 91% on room air. Examination shows widespread wheeze.');
  await dpg.fill('.os-mcqf [name="ask"]', 'Which of the following is the most appropriate initial treatment?');
  for (const [i, o] of ['Inhaled salbutamol via spacer', 'Intravenous magnesium sulfate', 'Oral montelukast tablets', 'Intramuscular adrenaline injection'].entries()) await dpg.fill(`.os-mcqf [name="opt${i}"]`, o);
  await dpg.locator('.os-mcqf .os-mcqkey').first().click();
  await dpg.click('.os-mcqf .os-reqsend'); await dpg.waitForSelector('.os-mcqs .os-mcqrow');
  const sentRow = [...MCQ.values()][0];
  ok(MCQ.size === 1 && sentRow.item.provenance.kind === 'user' && sentRow.submitted_by === 'Alex' && /Waiting for review/.test(await dpg.textContent('.os-mcqrow .os-reqst')), 'sync: the question is inserted into mcq_submissions as the user\'s, and reads Waiting for review');
  const tmpSubs = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'mcq-e2e-')), 'submissions.json');
  const intake = await new Promise(res => execFile(process.execPath, [path.join(ROOT, '..', 'scripts', 'mcq-submissions.mjs'), '--out', tmpSubs],
    { env: { ...process.env, OSCE_SUPABASE_URL: `${BASE}sb`, OSCE_SUPABASE_KEY: 'anon' } }, (e, out, err) => res({ e, out: `${out}${err}` })));
  const pulled = JSON.parse(fs.readFileSync(tmpSubs, 'utf8')).items;
  ok(!intake.e && pulled.length === 1 && pulled[0].id === sentRow.id && JSON.stringify(pulled[0]) === JSON.stringify(sentRow.item), `sync: the intake pulls it exactly as submitted${intake.e ? `: ${intake.out}` : ''}`);
  const epg = await device(ctx => ctx.route(/\/mcq\/status\.json$/, r => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ submissions: { [sentRow.id]: { status: 'rejected', reasons: ['an independent solver reached another answer both times'] } } }) })));
  await epg.evaluate(rows => localStorage.setItem('osce.mcq.v1', JSON.stringify({ items: { [rows.id]: { item: rows.item, at: Date.now(), sent: true } } })), sentRow);
  await epg.click('.os-start [data-os="mcq"]'); await epg.waitForSelector('.os-mcqs .os-mcqrow .os-mcqwhy');
  ok(/Not taken/.test(await epg.textContent('.os-mcqrow .os-reqst')) && /another answer both times/.test(await epg.textContent('.os-mcqrow .os-mcqwhy')), 'sync: after the pool build the submitter sees Not taken, with the reason');
  ok(!errs.length, `sync: no page errors${errs.length ? `: ${errs.join(' | ')}` : ''}`);
  await b.close();
}

/* Duel a Mate: two phones through the shared record (polling only: no realtime here), every move inside 5 s; then
   practice against the bot on a phone with no shared record */
async function duel() {
  const b = await chromium.launch(), errs = [], lags = [];
  const phone = async (width, height, cfg) => {
    const ctx = await b.newContext({ viewport: { width, height }, deviceScaleFactor: 2 });
    await ctx.route(/^https:\/\//, r => r.abort());
    await ctx.route(/\/config\.js$/, r => r.fulfill({ contentType: 'text/javascript', body: `window.OSCE_CONFIG = ${JSON.stringify(cfg)};` }));
    const pg = await ctx.newPage();
    pg.on('pageerror', e => errs.push(e.message));
    pg.on('console', m => { if (m.type() === 'error' && !/status of 400/.test(m.text())) errs.push(m.text()); });
    await pg.goto(BASE, { waitUntil: 'networkidle' }); await pg.waitForSelector('.os[data-ready]');
    return pg;
  };
  const timed = async (label, fn) => { const t = Date.now(); await fn(); const ms = Date.now() - t; lags.push(ms); ok(ms <= 5000, `duel: ${label} in ${ms} ms (at most 5 s)`); };
  const shared = { supabaseUrl: `${BASE}sb`, supabaseAnonKey: 'anon', duelRealtime: false };
  const a = await phone(320, 640, shared), c = await phone(393, 852, shared);
  /* the way in: a slim bar at the bottom of the screen on Start, marked Beta (a work in progress), in view without scrolling */
  ok(await a.locator('.os-start > [data-os="duel"] .os-beta').isVisible(), 'duel: the Start bar is marked Beta');
  const atFoot = pg => pg.evaluate(() => { const r = document.querySelector('.os-start > [data-os="duel"]').getBoundingClientRect(); return r.bottom <= innerHeight + 1 && r.bottom > innerHeight - 140 && r.top >= 0; });
  ok(await atFoot(a), 'duel: the bar sits at the bottom of the screen');
  await a.evaluate(() => { const s = document.querySelector('.os-start'); s.scrollTop = s.scrollHeight; });
  ok(await atFoot(a), 'duel: the bar stays at the bottom when the start view scrolls');
  await a.evaluate(() => { document.querySelector('.os-start').scrollTop = 0; });
  for (const [pg, name, pin, dog] of [[a, 'Sam', '1234', 'mochi'], [c, 'Alex', '4321', 'rosie']]) {
    await pg.click('[data-os="duel"]');
    await pg.waitForSelector('.os-duel[data-ready] form[data-pd="signin"]');
    await pg.fill('.os-duel input[name="name"]', name); await pg.fill('.os-duel input[name="pin"]', pin);
    await pg.click('.os-duel [data-pd="new"]'); await pg.click(`.os-duel .pd-dogpick[data-dog="${dog}"]`);
    await pg.click('.os-duel form[data-pd="create"] button[type="submit"]');
    await pg.waitForSelector('.os-duel .pd-lobby');
  }
  ok(await a.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1 && [...document.querySelectorAll('.os-duel *')].every(e => e.getBoundingClientRect().right <= innerWidth + 1)), 'duel: the lobby fits a 320 px phone');
  await a.screenshot({ path: path.join(SHOTS, 'duel-lobby.png') });
  await timed('a new mate reaches the lobby', () => a.waitForSelector('.os-duel .pd-mate b >> text=Alex', { timeout: 6000 }));
  /* the dressing room over the overlay: the dog redrawn live, and Escape closes the room before the duel */
  await a.click('.os-duel [data-pd="dress"]'); await a.waitForSelector('.os-duel .pd-full .pd-preview iframe');
  await a.click('.os-duel .pd-tabs [data-tab="coat"]'); await a.click('.os-duel .pd-swatch[aria-label="Black and tan"]');
  await a.screenshot({ path: path.join(SHOTS, 'duel-dress.png') });
  await a.keyboard.press('Escape'); await a.waitForSelector('.os-duel .pd-full', { state: 'detached' });
  ok(await a.locator('.os-duel .pd-lobby').isVisible(), 'duel: Escape closes the dressing room and leaves the lobby open');
  await a.click('.os-duel .pd-mate'); await a.click('.os-duel [data-rounds="5"]'); await a.click('.os-duel [data-secs="15"]'); await a.click('.os-duel [data-pd="send"]');
  await timed('the challenge reaches the mate', () => c.waitForSelector('.os-duel [data-sec="invites"] .pd-duelrow', { timeout: 6000 }));
  await c.click('.os-duel [data-sec="invites"] .pd-btn.pd-pri');
  for (let r = 0; r < 2; r++) {
    await Promise.all([a, c].map(pg => pg.waitForSelector('.os-duel .pd-opt:not([disabled])', { timeout: 12000 })));
    if (r === 0) {
      const dogs = await a.evaluate(() => [...document.querySelectorAll('.os-duel .pd-dog iframe')].map(f => { try { return !!f.contentWindow.__dob; } catch { return false; } }));
      ok(dogs.length === 2 && dogs.every(Boolean), `duel: both dogs draw (the rig may be framed by its own site: ${dogs})`);
      await a.screenshot({ path: path.join(SHOTS, 'duel-question.png') }); const stem = await a.textContent('.os-duel .pd-stem'), inPack = PACK.questions.find(q => q.stem === stem), tag = await a.locator('.os-duel .pd-qtag').isVisible() ? await a.textContent('.os-duel .pd-qtag') : '';
      ok(!!inPack, 'duel: the question comes from the pool\'s pack, its stem whole');
      ok(inPack && (inPack.origin === 'ai') === /AI-written/.test(tag), `duel: the AI-written tag shows exactly when the question is AI-written (${inPack?.source})`); }
    await a.locator('.os-duel .pd-opt').nth(0).click();
    await timed(`round ${r + 1}: Sam's answer shows on Alex's phone`, () => c.waitForSelector('.os-duel .pd-theirs .pd-status >> text=Answered', { timeout: 6000 }));
    await c.locator('.os-duel .pd-opt').nth(1).click();
    await timed(`round ${r + 1}: the reveal reaches Sam`, () => a.waitForSelector('.os-duel .pd-why:not([hidden])', { timeout: 6000 }));
  }
  await a.screenshot({ path: path.join(SHOTS, 'duel-reveal.png') });
  await a.keyboard.press('Escape');
  await a.waitForSelector('.os-duel .pd-sheet [data-pd="go"]');
  ok(true, 'duel: Escape in a live duel asks before leaving');
  await a.click('.os-duel .pd-sheet [data-pd="go"]');
  await timed('leaving hands Alex the win', () => c.waitForSelector('.os-duel .pd-result[data-out="win"]', { timeout: 6000 }));
  await c.screenshot({ path: path.join(SHOTS, 'duel-result.png') });
  await a.waitForSelector('.os-duel .pd-result'); await a.click('.os-duel [data-pd="lobby"]'); await a.waitForSelector('.os-duel .pd-lobby');
  await a.keyboard.press('Escape');
  await a.waitForSelector('.os-duel', { state: 'hidden' });
  ok(await a.locator('.os-start [data-os="duel"]').isVisible(), 'duel: Escape from the lobby closes it, back on the start view');
  const solo = await phone(320, 640, {});
  await solo.click('[data-os="duel"]'); await solo.waitForSelector('.os-duel [data-pd="practice"]');
  await solo.click('.os-duel [data-pd="practice"]');
  await solo.waitForSelector('.os-duel .pd-opt:not([disabled])', { timeout: 15000 });
  await solo.locator('.os-duel .pd-opt').first().click();
  await solo.waitForSelector('.os-duel .pd-why:not([hidden])', { timeout: 25000 });
  ok(true, 'duel: practice against the bot needs no shared record');
  ok(!errs.length, `duel: no page errors${errs.length ? `: ${errs.join(' | ')}` : ''}`);
  console.log(`duel: slowest move ${Math.max(...lags)} ms`);
  await b.close();
}

try {
  await duel();
  await sync();
  await run(393, 852, 'phone');
  await run(320, 640, 'small');
  await run(1280, 860, 'wide');
} catch (e) { fails.push(`crashed: ${e.message}`); console.error(e); }
server.close();
console.log(`\n${fails.length ? `${fails.length} failed` : 'all passed'} · screenshots in ${SHOTS}`);
process.exit(fails.length ? 1 : 0);
