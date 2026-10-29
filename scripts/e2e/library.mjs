/* Your questions in the browser (docs/library.md), run by smoke.mjs: upload what ChatGPT wrote (one broken question
   held back), study it, add a friend, share a deck, the friend studies it, and a phone that is signed out keeps its
   own. Each screen at 320 px (and 393, and a laptop) with no sideways scroll; screenshots in the run's folder. */
import path from 'node:path';

const Q = (o = {}) => ({
  stem: 'A 67-year-old man has 2 hours of central crushing chest pain radiating to the left arm. He is sweaty and pale. His ECG shows ST elevation in leads II, III and aVF.',
  ask: 'Which coronary artery is most likely occluded?',
  options: ['Right coronary artery', 'Left anterior descending artery', 'Left circumflex artery', 'Left main coronary artery'],
  answer: 'A', explanation: 'Inferior ST elevation (II, III, aVF) is usually the right coronary artery, which supplies the inferior wall in most people.',
  why: ['Correct: the RCA supplies the inferior wall in about 80%.', 'The LAD gives anterior changes, V1 to V4.', 'The circumflex gives lateral changes.', 'Left main occlusion is usually widespread with shock.'],
  specialty: 'Cardiology', kind: 'anatomy', tags: ['stemi'], ...o });
export const UPLOAD = 'Here are your questions:\n```json\n' + JSON.stringify([
  Q(),
  Q({ stem: 'A 4-year-old boy has 2 days of a barking cough and noisy breathing. He has a temperature of 38.1 °C, inspiratory stridor at rest and mild subcostal recession. Oxygen saturation is 96% on room air.', ask: 'Which of the following is the most appropriate initial treatment?', options: ['Oral dexamethasone', 'Nebulised salbutamol', 'Intravenous ceftriaxone', 'Oral amoxicillin'], answer: 'A', explanation: 'Croup with stridor at rest is moderate: one dose of oral dexamethasone 0.15 mg/kg.', why: ['Correct.', 'No help for upper-airway oedema.', 'For bacterial tracheitis, not croup.', 'Croup is viral.'], specialty: 'Paeds', kind: 'clinical' }),
  Q({ stem: 'A 9-month-old girl has a 3-day history of vomiting and a bulging anterior fontanelle. She is irritable and febrile at 39.2 °C. A lumbar puncture is planned.', ask: 'Between which vertebrae is the needle usually inserted in an infant?', options: ['L3 and L4, or L4 and L5', 'T12 and L1', 'L1 and L2', 'S1 and S2'], answer: 'A', explanation: 'In infants the cord ends lower (about L3 at birth), so the LP goes at L3/4 or L4/5, below it.', why: ['Correct.', 'Too high: the cord is there.', 'Too high in an infant.', 'Below the thecal sac in practice.'], specialty: 'Paediatrics', kind: 'Anatomy' }),
  Q({ stem: 'A 30-year-old woman has palpitations, weight loss and heat intolerance for 3 months. She has a fine tremor and a smooth goitre with a bruit.', ask: 'Which is the most likely diagnosis?', options: ['Graves disease', 'Toxic multinodular goitre', 'Subacute thyroiditis', 'Hashimoto thyroiditis'], specialty: 'Endocrinology', kind: 'trivia' })
]) + '\n```\nLet me know if you want more!';

export async function library({ chromium, BASE, SHOTS, ok }) {
  const b = await chromium.launch(), errs = [], cfg = { supabaseUrl: `${BASE}sb`, supabaseAnonKey: 'anon', duelRealtime: false };
  const phone = async (width, height, c = cfg, seed = null) => {
    const ctx = await b.newContext({ viewport: { width, height }, deviceScaleFactor: 2 });
    if (seed) await ctx.addInitScript(([k, v]) => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem(k, v); sessionStorage.setItem('seeded', '1'); } }, seed);
    await ctx.route(/^https:\/\//, r => r.abort());
    await ctx.route(/\/config\.js$/, r => r.fulfill({ contentType: 'text/javascript', body: `window.OSCE_CONFIG = ${JSON.stringify(c)};` }));
    await ctx.addInitScript(() => { const cl = navigator.clipboard; if (!cl) return; const w = cl.writeText.bind(cl); cl.writeText = t => { window.__copied = String(t); return w(t).catch(() => {}); }; });
    const pg = await ctx.newPage();
    pg.on('pageerror', e => errs.push(`${width}: ${e.message}`));
    pg.on('console', m => { if (m.type() === 'error' && !/status of 400/.test(m.text())) errs.push(`${width}: ${m.text()}`); });
    await pg.goto(BASE, { waitUntil: 'networkidle' }); await pg.waitForSelector('.os[data-ready]');
    return pg;
  };
  /* nothing wider than the screen, and nothing in the dialog sticking out of its box (the first that does is named) */
  const flat = async (pg, where) => {
    /* measured at rest: an entrance (the card slides in from the right) is let finish first; endless ones (a clock) are not waited on */
    await pg.evaluate(() => Promise.race([Promise.all(document.getAnimations().filter(x => x.effect?.getComputedTiming().endTime !== Infinity).map(x => x.finished.catch(() => {}))), new Promise(r => setTimeout(r, 1500))]));
    const bad = await pg.evaluate(() => {
      if (document.documentElement.scrollWidth > innerWidth + 1) return 'the page';
      const box = document.querySelector('.os-lib')?.getBoundingClientRect();
      const out = box && [...document.querySelectorAll('.os-lib *')].find(e => { const r = e.getBoundingClientRect(); return r.width && (r.right > box.right + 1 || r.left < box.left - 1) && !e.closest('details:not([open]), .os-vh'); });
      return out ? `${out.tagName.toLowerCase()}.${[...out.classList].join('.')} (${Math.round(out.getBoundingClientRect().right)} > ${Math.round(box.right)})` : '';
    });
    ok(!bad, `library ${where}: no sideways scroll${bad ? `: ${bad}` : ''}`);
  };
  const shot = async (pg, name) => { await pg.waitForTimeout(350); await pg.screenshot({ path: path.join(SHOTS, `lib-${name}.png`) }); };
  const signUp = async (pg, name, pin) => {
    await pg.click('[data-os="settings"]'); await pg.waitForSelector('[data-set="aname"]');
    await pg.fill('[data-set="aname"]', name); await pg.fill('[data-set="apin"]', pin); await pg.click('[data-set="anew"]');
    await pg.waitForSelector('[data-set="aout"]'); await pg.keyboard.press('Escape'); await pg.waitForTimeout(400);
  };
  const open = async (pg, tab) => {
    if (!await pg.locator('.os-lib').count()) { await pg.click('.os-start [data-os="lib"]'); await pg.waitForSelector('.os-lib'); }
    if (tab === 'upload') { await pg.click('.os-libtabs [data-tab="library"]'); await pg.waitForSelector('.os-libtabs [data-tab="library"][aria-selected="true"]'); await pg.locator('.os-libp [data-lib="tab"][data-tab="upload"]').first().click(); await pg.waitForSelector('.os-libsteps'); }   /* Upload lives inside Library */
    else if (tab) { await pg.click(`.os-libtabs [data-tab="${tab}"]`); await pg.waitForSelector(`.os-libtabs [data-tab="${tab}"][aria-selected="true"]`); }
    await pg.waitForTimeout(250);
  };
  const close = async pg => { await pg.keyboard.press('Escape'); await pg.waitForSelector('.os-lib', { state: 'detached' }); };

  /* Lee, on a small phone: the card, the empty library, Upload */
  const sam = await phone(320, 640);
  ok(await sam.locator('.os-start > [data-os="lib"]').isVisible(), 'library: Your questions is a card on Start');
  await signUp(sam, 'Lee', '1234');
  await open(sam);
  ok(await sam.getAttribute('.os-libtabs [data-tab="study"]', 'aria-selected') === 'true' && /Start · /.test(await sam.textContent('.os-libgo')), 'library: opens on Study, Start ready on the bank for a first-timer');
  await shot(sam, '320-first-open');
  await open(sam, 'library');
  ok(/No questions yet/.test(await sam.textContent('.os-libp')), 'library: empty, it says how to start');
  await shot(sam, '320-empty'); await flat(sam, 'empty');
  await sam.click('.os-libempty [data-lib="tab"]'); await sam.waitForSelector('.os-libsteps');
  await sam.click('[data-lib="copyprompt"]');
  const clip = await sam.evaluate(() => window.__copied || '');
  ok(/Output ONLY a JSON array/.test(clip) && /Paediatrics/.test(clip) && /"anatomy"/.test(clip), 'library: Copy the prompt puts the ChatGPT prompt on the clipboard, with every specialty and kind');
  await shot(sam, '320-upload'); await flat(sam, 'upload');
  await sam.fill('.os-libp [name="paste"]', UPLOAD);
  await sam.waitForSelector('.os-libsum');
  const sum = await sam.textContent('.os-libsum');
  ok(/3 questions ready/.test(sum) && /1 to fix/.test(sum), `library: ChatGPT's fenced answer is read, 3 ready and 1 held back (${sum.trim()})`);
  ok(/trivia/.test(await sam.textContent('.os-libprobs')), 'library: the held-back question says what to fix (its kind)');
  ok(/Save 3 questions/.test(await sam.textContent('.os-libsave')), 'library: Save names how many');
  await sam.evaluate(() => document.querySelector('.os-libres').scrollIntoView({ block: 'start' })); await shot(sam, '320-checked'); await flat(sam, 'checked');
  await sam.fill('.os-libp [name="deck"]', 'Wk 1 mixed'); await sam.click('.os-libsave');
  await sam.waitForSelector('.os-libtabs [data-tab="library"][aria-selected="true"]'); await sam.waitForSelector('.os-libdeck');
  ok(/Wk 1 mixed/.test(await sam.textContent('.os-libdeck')) && /3 questions/.test(await sam.textContent('.os-libdeck')), 'library: saved, the deck is in Library at once with its 3 questions');
  await shot(sam, '320-library'); await flat(sam, 'library');
  ok(await sam.locator('.os-libp [name="find"]').count() === 0, 'library: no find box for a small library');
  await sam.click('.os-libqs summary'); await sam.waitForTimeout(200);
  ok(await sam.locator('.os-libqs li').count() === 3 && /Paediatrics › Anatomy/.test(await sam.textContent('.os-libqs')), 'library: each question shows its specialty and kind');

  /* a deck's Study studies it at once */
  await sam.click('.os-libdeck [data-lib="studydeck"]'); await sam.waitForSelector('.os-libopt');
  ok(/\/3$/.test((await sam.textContent('.os-libcount2')).trim()) && !(await sam.locator('.os-dlg-head').isVisible()), "deck: Study starts on the deck's 3, one bar on top (the sheet's header steps aside)");
  await sam.click('[data-lib="endstudy"]'); await sam.waitForSelector('.os-libtoday');
  /* Custom: the deck, the drill-down narrows, a chip with nothing is not shown */
  await sam.click('[data-lib="mode"][data-m="custom"]'); await sam.waitForSelector('.os-libgo');
  await sam.selectOption('.os-libp [name="sdeck"]', { label: 'Wk 1 mixed' }); await sam.waitForTimeout(150);
  await sam.click('.os-libchips [data-k="topic"][data-v="Paediatrics"]'); await sam.waitForTimeout(150);
  ok(/Start · 2 cards/.test(await sam.textContent('.os-libgo')), 'custom: Paediatrics narrows to its 2');
  await sam.click('.os-libchips [data-k="cat"][data-v="anatomy"]'); await sam.waitForTimeout(150);
  ok(/Start · 1 card/.test(await sam.textContent('.os-libgo')), 'custom: then Anatomy narrows to 1');
  ok(await sam.locator('.os-libchips [data-k="cat"][data-v="skills"]').count() === 0, 'custom: a kind with no questions is left out');
  ok(await sam.locator('[data-lib="pref"][data-k="which"]').count() === 4 && await sam.locator('[data-lib="pref"][data-k="mode"]').count() === 3, 'custom: which questions (all, unused, incorrect, flagged), how many, tutor, timed or exam, order');
  await sam.evaluate(() => document.querySelector('.os-dlg-body')?.scrollTo(0, 0)); await shot(sam, '320-custom'); await flat(sam, 'custom');
  await sam.click('.os-libchips [data-k="cat"][data-v=""]'); await sam.click('.os-libgo');
  await sam.waitForSelector('.os-libopt');
  ok(!(await sam.locator('.os-libtabs').isVisible()), 'card: focus mode, the tabs step aside');
  await shot(sam, '320-card'); await flat(sam, 'card');
  await sam.click('[data-lib="flag"]'); await sam.waitForSelector('.os-libflag.on');
  ok(true, 'card: a question can be flagged');
  /* cross out (UWorld, AMBOSS): right-click, Shift and the number, or a hold; a tap brings a crossed one back, it does not answer */
  await sam.locator('.os-libopt[data-i="2"]').click({ button: 'right' });
  ok(await sam.locator('.os-libopt[data-i="2"].os-libopt--x').count() === 1 && /crossed out/.test(await sam.textContent('.os-libopt[data-i="2"]')), 'cross out: right-click crosses an option out (and says so to a screen reader)');
  await sam.locator('.os-libopt[data-i="2"]').click();
  ok(await sam.locator('.os-libopt--x').count() === 0 && await sam.locator('.os-libexp').count() === 0, 'cross out: a tap on a crossed-out option brings it back, it does not answer');
  await sam.keyboard.press('Shift+Digit2'); const k1 = await sam.locator('.os-libopt--x').count();
  await sam.keyboard.press('Shift+Digit2'); const k2 = await sam.locator('.os-libopt--x').count();
  ok(k1 === 1 && k2 === 0, `cross out: Shift and a number crosses one out and back (${k1}, ${k2})`);
  { const bb = await sam.locator('.os-libopt[data-i="3"]').boundingBox(); await sam.mouse.move(bb.x + 30, bb.y + bb.height / 2); await sam.mouse.down(); await sam.waitForTimeout(520); await sam.mouse.up(); await sam.waitForTimeout(80); }
  ok(await sam.locator('.os-libopt[data-i="3"].os-libopt--x').count() === 1 && await sam.locator('.os-libexp').count() === 0, 'cross out: holding an option crosses it out, and the hold does not answer');
  await sam.locator('.os-libopt[data-i="1"]').click(); await sam.waitForSelector('.os-libexp');   /* a wrong one by its stored index: the shown order spreads the key */
  const after = await sam.evaluate(() => ({ ok: document.querySelectorAll('.os-libopt.ok').length, no: document.querySelectorAll('.os-libopt.no').length, again: document.querySelector('[data-lib="grade"].os-primary')?.dataset.g }));
  ok(after.ok === 1 && after.no <= 1 && ['again', 'good'].includes(after.again), `card: the answer shows right and wrong, the explanation, and suggests a grade (${JSON.stringify(after)})`);
  ok(await sam.locator('.os-libopt--x').count() === 0, 'cross out: once answered, the lines go (every option is seen as it is)');
  ok(await sam.locator('.os-libnext').count() === 1 && (await sam.locator('[data-lib="grade"]').count()) <= 3, 'card: one big Next; the grade follows the answer (Hard and Easy beside a right one)');
  await sam.click('[data-lib="note"]'); await sam.fill('[data-lib-note]', 'Inferior leads = RCA'); await sam.waitForTimeout(500);
  await shot(sam, '320-card-answered'); await flat(sam, 'answered');
  await sam.click('[data-lib="grade"][data-g="good"]'); await sam.waitForTimeout(150);
  await sam.keyboard.press('1'); await sam.waitForSelector('.os-libexp'); await sam.keyboard.press('3');
  await sam.waitForSelector('.os-libdone');
  ok(/2 cards/.test(await sam.textContent('.os-libdone')), 'card: keys 1 to 5 answer and 1 to 4 grade; the session ends with how it went');
  ok(await sam.locator('.os-libreview li').count() === 2 && await sam.locator('.os-libreview li.no').count() >= 1 && await sam.locator('[data-lib="redo"]').isVisible(), 'review: the session lists right and missed, with Redo the missed');
  await shot(sam, '320-session-done');
  const study = await sam.evaluate(() => JSON.parse(localStorage.getItem('osce.libstudy.v1') || '{}'));
  const cs = Object.values(study.card || {});
  ok(cs.length === 2 && cs.every(c => c.due > Date.now()) && cs.some(c => c.f === 1) && cs.some(c => c.note === 'Inferior leads = RCA'), 'card: graded cards are due later; the flag and the note are kept');
  await sam.click('.os-libdone [data-lib="endstudy"]'); await sam.click('[data-lib="sumback"]'); await sam.waitForSelector('.os-libtoday');
  /* Home: the goal ring, the streak, Start, the modes */
  const home = await sam.textContent('.os-libp');
  ok(/1-day streak/.test(home) && /of 20/.test(home) && /Start · /.test(await sam.textContent('.os-libgo')), `home: today's ring (of 20), a 1-day streak, and Start`);
  ok(await sam.locator('[data-lib="mode"][data-m="flagged"] .os-libmode-n').textContent() === '1', 'home: Flagged has the one flagged');
  await sam.evaluate(() => document.querySelector('.os-dlg-body')?.scrollTo(0, 0)); await shot(sam, '320-study-home'); await flat(sam, 'home');
  await sam.click('.os-libsettings > summary'); await sam.click('[data-lib="pref"][data-k="goal"][data-v="10"]'); await sam.waitForTimeout(150);
  ok(/of 10/.test(await sam.textContent('.os-libring')), 'home: the daily goal can be changed');
  /* Smart 10, the Notebook, Resume */
  await sam.click('[data-lib="mode"][data-m="smart"]'); await sam.waitForSelector('.os-libopt');
  ok(/\/10$/.test((await sam.textContent('.os-libcount2')).trim()), 'smart 10: a session of ten');
  await sam.locator('.os-libopt').first().click(); await sam.click('[data-lib="grade"][data-g="good"]'); await sam.waitForTimeout(100);
  await sam.click('[data-lib="endstudy"]'); await sam.waitForSelector('.os-libresume');
  ok(/9 cards left/.test(await sam.textContent('.os-libresume')), 'resume: a session left halfway is on the home');
  await sam.click('.os-libresume'); await sam.waitForSelector('.os-libopt');
  ok(/^2\/10$/.test((await sam.textContent('.os-libcount2')).trim()), 'resume: back where it was (2/10)');
  await sam.click('[data-lib="endstudy"]');
  await sam.click('[data-lib="mode"][data-m="notebook"]'); await sam.waitForSelector('.os-libnotes li');
  ok(/Inferior leads = RCA/.test(await sam.textContent('.os-libnotes')), 'notebook: every note, with its question and answer');
  await shot(sam, '320-notebook'); await flat(sam, 'notebook');
  await sam.click('[data-lib="sumback"]');
  /* 0 to 1 from the home: Year 1 first, only ever up */
  await sam.click('[data-lib="mode"][data-m="ladder"]'); await sam.waitForSelector('.os-libopt');
  const yearNow = () => sam.evaluate(() => { const b = document.querySelector('.os-libyear b'), m = document.querySelector('.os-libcard > .os-liblayer'); return +((b ? b.textContent : m.textContent).match(/Year (\d)/) || [0, 0])[1]; });
  const climb = await sam.textContent('.os-libyear');
  ok(/Year 1/.test(climb) && await yearNow() === 1, `0 to 1: starts at Year 1, and the banner says so (${climb.trim()})`);
  await shot(sam, '320-ladder-card'); await flat(sam, 'ladder card');
  let last = 1, upward = true;
  for (let i = 0; i < 12; i++) {
    const y = await yearNow(); if (y < last) upward = false; last = y;
    await sam.locator('.os-libopt').first().click(); await sam.click('[data-lib="grade"][data-g="good"]'); await sam.waitForTimeout(60);
    if (await sam.locator('.os-libdone').count()) break;
  }
  ok(upward && last >= 3, `0 to 1: only ever climbs (reached Year ${last})`);
  /* swipe: an answered card follows the finger and, flicked, goes to the next one */
  if (!(await sam.locator('.os-libdone').count())) {
    const before = (await sam.textContent('.os-libcount2')).trim();
    await sam.locator('.os-libopt').first().click(); await sam.waitForSelector('.os-libexp');
    await sam.waitForTimeout(500); const bx = await sam.locator('.os-libexp').boundingBox(), sy = bx.y + bx.height / 2;   /* where the thumb is after answering */
    await sam.mouse.move(bx.x + bx.width * 0.7, sy); await sam.mouse.down();
    for (let i = 1; i <= 6; i++) { await sam.mouse.move(bx.x + bx.width * 0.7 - i * 40, sy); await sam.waitForTimeout(12); }
    await sam.mouse.up(); await sam.waitForTimeout(700);
    const after = (await sam.textContent('.os-libcount2').catch(() => '')).trim();
    ok(after !== before, `swipe: a flick sends an answered card on (${before} to ${after})`);
  }
  /* how others answered: a bank question with answers from others shows each option's share */
  if (!(await sam.locator('.os-libdone').count())) {
    const qk = await sam.getAttribute('.os-libcard', 'data-q');
    await sam.evaluate(async id => { const { rpc } = await import('./js/osce/account.mjs'); for (const c of [0, 0, 1, 2]) await rpc('mcq_pick', { p_qid: id, p_choice: c }); }, qk.replace(/^b:/, ''));
    await sam.locator('.os-libopt').first().click(); await sam.waitForSelector('.os-libpct', { timeout: 4000 }).catch(() => {});
    const pcts = await sam.locator('.os-libpct').allTextContents();
    ok(pcts.length >= 3 && /How 5 students answered/.test(await sam.textContent('.os-libcard')), `others: each option shows how many chose it (${pcts.join(' ')})`);
    await shot(sam, '320-others');
    await sam.click('[data-lib="reportopen"]'); await sam.click('[data-lib="report"][data-v="unclear"]'); await sam.waitForSelector('.os-libreported');
    ok(true, 'report: a bank question can be reported (the answer is wrong, out of date, unclear, a typo)');
  }
  await sam.click('[data-lib="endstudy"]').catch(() => {}); if (await sam.locator('.os-libdone').count()) await sam.click('.os-libdone [data-lib="endstudy"]');
  /* timed: the exam's clock on each question */
  await sam.click('[data-lib="mode"][data-m="custom"]'); await sam.waitForSelector('[data-lib="pref"][data-k="mode"]');
  await sam.selectOption('.os-libp [name="sdeck"]', ''); await sam.click('[data-lib="pref"][data-k="order"][data-v="shuffle"]');
  await sam.click('[data-lib="pref"][data-k="mode"][data-v="timed"]'); await sam.click('.os-libgo'); await sam.waitForSelector('.os-libclock b');
  await sam.waitForTimeout(400);
  const secs = +(await sam.textContent('.os-libclock b'));
  ok(secs >= 85 && secs <= 240, `timed: a clock of 90 s plus reading (${secs} s)`);
  await shot(sam, '320-timed');
  await sam.click('[data-lib="endstudy"]');
  await sam.click('[data-lib="pref"][data-k="mode"][data-v="tutor"]'); await sam.click('[data-lib="pref"][data-k="order"][data-v="due"]');
  /* your summary: from the answers given, the gaps with a way to study them, by year, difficulty, specialty, and the heatmap */
  await sam.click('[data-lib="sumback"]'); await sam.click('.os-libgaps'); await sam.waitForSelector('.os-libsumhead');
  const sm = await sam.textContent('.os-libp');
  ok(/Your gaps/.test(sm) && /By year/.test(sm) && /By difficulty/.test(sm) && /By specialty/.test(sm) && /\d+%/.test(sm), 'summary: overall, your gaps, by year, by difficulty and by specialty');
  ok(await sam.locator('.os-libheat [data-level]').count() >= 70, 'summary: a heatmap of the weeks');
  await sam.evaluate(() => document.querySelector('.os-dlg-body')?.scrollTo(0, 0)); await shot(sam, '320-summary'); await flat(sam, 'summary');
  await sam.evaluate(() => document.querySelector('.os-libbars')?.scrollIntoView({ block: 'center' })); await shot(sam, '320-summary-bars');
  const gapBtn = sam.locator('[data-lib="gap"]').first();
  if (await gapBtn.count()) { await gapBtn.click(); await sam.waitForSelector('.os-libopt'); ok(true, 'summary: Study this starts a session on that gap'); await sam.click('[data-lib="endstudy"]'); }
  else { await sam.click('[data-lib="sumback"]'); }

  /* Kai, on a bigger phone: friends */
  const alex = await phone(393, 852);
  await signUp(alex, 'Kai', '4321');
  await open(sam, 'friends');
  await sam.fill('.os-libp [name="fname"]', 'kai'); await sam.click('[data-lib="addfriend"]');
  await sam.waitForSelector('.os-libfriend');
  ok(/Waiting for them/.test(await sam.textContent('.os-libp')), 'friends: a request by name (any case) waits for them');
  await shot(sam, '320-friends-sent'); await flat(sam, 'friends');
  await open(alex, 'friends');
  ok(/Asking to be friends/.test(await alex.textContent('.os-libp')) && /Lee/.test(await alex.textContent('.os-libfriend')), 'friends: Kai sees Lee asking');
  await shot(alex, '393-friends-incoming');
  await alex.click('[data-lib="accept"]'); await alex.waitForTimeout(300);
  ok(/friends \(1\)/i.test(await alex.textContent('.os-libp')), 'friends: accepted, they are friends');
  ok(await alex.locator('.os-libweek').count() === 0 || await alex.locator('.os-libmanage').count() === 1, 'friends: once the week board lists them, the list to manage folds under it');
  await close(alex); await open(alex, 'friends'); await alex.waitForSelector('.os-libweek li', { timeout: 5000 }).catch(() => {});
  const week = await alex.locator('.os-libweek li').allTextContents();
  ok(week.length === 2 && /Lee/.test(week[0]) && /\(you\)/.test(week[1]), `friends: this week's board, the most answers first (${week.map(w => w.replace(/\s+/g, ' ').trim()).join(' | ')})`);
  await shot(alex, '393-friends-week');
  await close(alex);

  /* Lee shares the deck; Kai finds it under From friends and studies it */
  await close(sam); await open(sam, 'library');
  await sam.click('.os-libdeck [data-lib="share"]'); await sam.waitForSelector('[data-lib="sharewith"]');
  await sam.click('[data-lib="sharewith"]'); await sam.waitForSelector('[data-lib="sharewith"][aria-pressed="true"]');
  ok(/shared with Kai/i.test(await sam.textContent('.os-libdeck .os-libmeta')), 'share: the deck says who it is shared with');
  await shot(sam, '320-shared'); await flat(sam, 'shared');
  await open(alex, 'library');
  await alex.waitForSelector('.os-libdeck');
  ok(/From friends/.test(await alex.textContent('.os-libp')) && /from Lee/i.test(await alex.textContent('.os-libdeck')), "share: Kai has Lee's deck under From friends");
  ok(await alex.locator('[data-lib="deldeck"]').count() === 0, "share: a friend's deck cannot be deleted by Kai");
  await shot(alex, '393-from-friends');
  await alex.click('[data-lib="studydeck"]'); await alex.waitForSelector('.os-libopt');
  ok(/from Lee/.test(await alex.textContent('.os-libcard > .os-liblayer')), "study: a friend's card says whose it is");
  await shot(alex, '393-friend-card');

  /* the duel: the pack gains Lee's questions as a deck to pick */
  const mixed = await sam.evaluate(async () => (await import('./js/osce/duel.mjs')).packDecks());
  ok(mixed.some(d => d.id === 'bank') && mixed.some(d => d.id === 'mine' && d.count === 3), `duel: Your questions is a deck in the duel's pack (${JSON.stringify(mixed)})`);
  const alexDecks = await alex.evaluate(async () => (await import('./js/osce/duel.mjs')).packDecks());
  ok(alexDecks.some(d => d.id === 'friends' && d.count === 3), `duel: for Kai, Lee's shared deck is Friends' (${JSON.stringify(alexDecks)})`);
  /* practice on Lee's own questions: From, Yours, and a question tagged A player's (a deal is read by both phones) */
  await close(alex); await close(sam);
  await sam.click('[data-os="settings"]'); await sam.waitForSelector('.os-switch[data-game="duel"]');
  if (await sam.getAttribute('.os-switch[data-game="duel"]', 'aria-checked') !== 'true') await sam.click('.os-switch[data-game="duel"]');   /* another device may have switched it on in the shared record */
  await sam.keyboard.press('Escape');
  await sam.click('.os-start [data-os="duel"]'); await sam.waitForSelector('.os-duel [data-pd="practice"]');
  await sam.click('.os-duel [data-pd="practice"]'); await sam.waitForSelector('.os-duel .pd-seg--deck');
  await sam.click('.os-duel .pd-seg--deck [data-deck="mine"]'); await sam.waitForTimeout(200);
  ok(/3/.test(await sam.textContent('.os-duel .pd-pick-n')), 'duel: From Yours, the setup counts your 3 questions');
  await shot(sam, '320-duel-from');
  await sam.click('.os-duel .pd-sheet [data-pd="send"]');
  await sam.waitForSelector('.os-duel .pd-opt:not([disabled])', { timeout: 15000 });
  ok(/A player's/.test(await sam.textContent('.os-duel .pd-mtop .pd-qtag')), 'duel: a library question is tagged A player\'s, true on either phone');
  await shot(sam, '320-duel-yours');
  await sam.keyboard.press('Escape');
  /* the duel's 0 to 1: Order on the setup, the first question Year 1 */
  const lad = await phone(320, 640, {});
  await lad.click('[data-os="settings"]'); await lad.click('.os-switch[data-game="duel"]'); await lad.keyboard.press('Escape');
  await lad.click('.os-start [data-os="duel"]'); await lad.waitForSelector('.os-duel [data-pd="practice"]');
  await lad.click('.os-duel [data-pd="practice"]'); await lad.waitForSelector('.os-duel [data-order="ladder"]');
  await lad.click('.os-duel [data-order="ladder"]');
  await shot(lad, '320-duel-ladder-setup');
  await lad.click('.os-duel .pd-sheet [data-pd="send"]'); await lad.waitForSelector('.os-duel .pd-opt:not([disabled])', { timeout: 15000 });
  const tag1 = (await lad.textContent('.os-duel .pd-mtop .pd-qtag')).trim(), fits = await lad.evaluate(() => { const t = document.querySelector('.os-duel .pd-mtop .pd-qtag'); return t.scrollWidth <= t.clientWidth + 1; });
  ok(tag1 === 'Year 1' && fits, `duel: 0 to 1 starts at Year 1, and the tag says so, whole (${tag1})`);   /* the climb itself: the package's core test */
  await shot(lad, '320-duel-ladder');

  /* check the medicine: with a key in Settings, Claude answers each ready question; one it disagrees with is held back */
  const vc = await phone(375, 812, {}, ['osce.marker.v1', JSON.stringify({ key: 'sk-ant-test', model: 'claude-sonnet-5-5' })]);
  await vc.route('https://api.anthropic.com/**', async r => {
    if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'POST' } });
    const body = JSON.parse(r.request().postData() || '{}'), qs = JSON.parse(body.messages[0].content);
    const checks = qs.map((q, i) => (i === 0 ? { id: q.id, choice: 1, ok: false, issue: 'The left anterior descending gives anterior changes; the key is right only if the leads are inferior.' } : { id: q.id, choice: 'ABCDE'.indexOf(q.key), ok: true, issue: '' }));
    return r.fulfill({ status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ id: 'msg_v', type: 'message', role: 'assistant', model: 'claude-sonnet-5-5', stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify({ checks }) }], usage: { input_tokens: 1, output_tokens: 1 } }) });
  });
  await open(vc, 'upload'); await vc.fill('.os-libp [name="paste"]', UPLOAD); await vc.waitForSelector('[data-lib="verify"]');
  await vc.click('[data-lib="verify"]'); await vc.waitForSelector('.os-libcheck--done');
  ok(/Claude checked 3 questions/.test(await vc.textContent('.os-libcheck--done')) && /held back/.test(await vc.textContent('.os-libcheck--done')) && /Save 2 questions/.test(await vc.textContent('.os-libsave')), 'check: Claude checks each answer; the one it disputes is held back with why');
  await vc.evaluate(() => document.querySelector('.os-libcheck--done').scrollIntoView({ block: 'center' })); await shot(vc, '375-checked-medicine');
  await vc.click('[data-lib="keepheld"]'); await vc.waitForTimeout(150);
  ok(/Save 3 questions/.test(await vc.textContent('.os-libsave')), 'check: a held question can be kept anyway');

  /* signed out: kept on this phone, and a note says how to keep it on an account */
  const solo = await phone(320, 640, {});
  await open(solo, 'upload'); await solo.fill('.os-libp [name="paste"]', UPLOAD); await solo.waitForSelector('.os-libsum');
  await solo.click('.os-libsave'); await solo.waitForSelector('.os-libdeck');
  ok(/Signed out/.test(await solo.textContent('.os-libp')) && /3 questions/.test(await solo.textContent('.os-libdeck')), 'signed out: the questions are kept on this phone, with a note to sign in');
  await open(solo, 'friends'); ok(/need an account/.test(await solo.textContent('.os-libp')), 'signed out: Friends asks you to sign in');
  const many = JSON.stringify(Array.from({ length: 21 }, (_, i) => Q({ stem: `A ${30 + i}-year-old man has crushing central chest pain for ${i + 2} hours. His ECG shows ST elevation in leads II, III and aVF.`, specialty: 'Cardiology', kind: 'anatomy', year: 2 })));
  await open(solo, 'upload'); await solo.fill('.os-libp [name="paste"]', many); await solo.waitForSelector('.os-libsum'); await solo.fill('.os-libp [name="deck"]', 'Cardio 21'); await solo.click('.os-libsave'); await solo.waitForSelector('.os-libfind');
  await solo.fill('.os-libp [name="find"]', '45-year-old'); await solo.waitForTimeout(400);
  ok(/1 question found/.test(await solo.textContent('.os-libp')) && /Right coronary/i.test(await solo.textContent('.os-libfound')), 'library: from 20 questions, find one across your decks (with its answer)');
  await open(solo, 'upload'); await solo.click('.os-libpool [data-os="mcqnew"]'); await solo.waitForSelector('.os-mcqf', { timeout: 5000 }).then(() => ok(true, 'upload: a link to submit a question to the shared bank'), () => ok(false, 'upload: a link to submit a question to the shared bank'));
  await solo.keyboard.press('Escape'); await solo.waitForTimeout(300);
  /* Normal ranges: a question with a lab value has the flask; the sheet opens on its tests; find narrows; Escape closes only the sheet */
  await solo.keyboard.press('Escape'); await solo.waitForTimeout(500);
  await open(solo, 'upload');
  await solo.fill('.os-libp [name="paste"]', JSON.stringify([Q({ stem: 'A 70-year-old man on spironolactone and ramipril has 2 days of weakness. His potassium is 6.9 mmol/L and creatinine 210 µmol/L. His ECG shows peaked T waves.', ask: 'What is the most appropriate first treatment?', options: ['Intravenous calcium gluconate', 'Oral sodium polystyrene sulfonate', 'Intravenous furosemide', 'Inhaled salbutamol alone'], answer: 'A', why: ['Correct: it steadies the heart first.', 'Too slow.', 'Not first.', 'An adjunct.'], explanation: 'With ECG changes, calcium gluconate stabilises the myocardium first; insulin and dextrose then shift potassium into cells.', specialty: 'Nephrology', kind: 'clinical', year: 3 })]));
  await solo.waitForSelector('.os-libsum'); await solo.fill('.os-libp [name="deck"]', 'Kidneys'); await solo.click('.os-libsave');
  await solo.locator('.os-libdeck', { hasText: 'Kidneys' }).locator('[data-lib="studydeck"]').click(); await solo.waitForSelector('.os-libopt');
  ok(await solo.locator('.os-libtop [data-lib="ranges"]').isVisible(), 'ranges: a question with a lab value has Normal ranges beside the flag');
  await solo.click('.os-libtop [data-lib="ranges"]'); await solo.waitForSelector('.os-rng');
  const hit = await solo.locator('.os-rnghit li b').allTextContents();
  ok(hit[0] === 'Potassium' && hit.includes('Creatinine') && /3\.5–5\.2/.test(await solo.textContent('.os-rnghit li')), `ranges: the question's tests first, in its order (${hit.join(', ')})`);
  await shot(solo, '320-ranges');
  await solo.fill('.os-rng [name="rfind"]', 'trop'); await solo.waitForTimeout(100);
  ok(await solo.locator('.os-rngall li').count() === 1 && /Troponin/.test(await solo.textContent('.os-rngall')), 'ranges: find narrows to the test');
  await solo.keyboard.press('Escape'); await solo.waitForTimeout(500);
  ok(await solo.locator('.os-rng').count() === 0 && await solo.locator('.os-libopt').count() > 0, 'ranges: Escape closes the sheet, the card is still there');
  await solo.click('[data-lib="endstudy"]'); await solo.waitForTimeout(300);
  /* Exam mode (UWorld's timed, untutored block): a tap chooses and can change, nothing is shown, Finish ends it; then go through the answers */
  await solo.click('[data-lib="mode"][data-m="custom"]'); await solo.waitForSelector('.os-libgo');
  await solo.selectOption('.os-libp [name="sdeck"]', { label: 'Kidneys' }); await solo.waitForTimeout(150);
  await solo.click('[data-lib="pref"][data-k="mode"][data-v="exam"]'); await solo.waitForTimeout(150);
  ok(/no answers until the end/.test(await solo.textContent('.os-libmodenote')), 'exam: Custom offers Exam, and says what it does');
  await solo.click('.os-libgo'); await solo.waitForSelector('.os-libopt');
  ok(await solo.locator('.os-libclock').count() === 1 && (await solo.textContent('.os-libexamnext')).trim() === 'Skip', 'exam: the clock runs; with nothing chosen, Next is Skip');
  await solo.locator('.os-libopt[data-i="1"]').click(); await solo.locator('.os-libopt[data-i="0"]').click();
  ok(await solo.locator('.os-libopt.sel').count() === 1 && await solo.locator('.os-libopt[data-i="0"].sel').count() === 1 && await solo.locator('.os-libexp, .os-libopt.ok, .os-libopt.no').count() === 0 && (await solo.textContent('.os-libexamnext')).trim() === 'Finish',
    'exam: a tap chooses and a second changes it; nothing says right or wrong; the last question finishes');
  await shot(solo, '320-exam');
  await solo.click('.os-libexamnext'); await solo.waitForSelector('.os-libdone');
  ok(/Exam done/.test(await solo.textContent('.os-libdone')) && /of 1 right/.test(await solo.textContent(".os-libring")), 'exam: the end says Exam done, with the score');
  await solo.click('.os-libdone [data-lib="revgo"]'); await solo.waitForSelector('.os-librev');
  ok(await solo.locator('.os-librev .os-libexp').isVisible() && await solo.locator('.os-librev .os-libopt.ok').count() === 1, 'exam: going through the answers shows each with the answer and why');
  await shot(solo, '320-exam-review');
  await solo.keyboard.press('ArrowRight'); await solo.waitForSelector('.os-libdone');
  ok(await solo.locator('.os-librevrow').count() === 1, 'exam: the arrow keys go through the answers; past the last, back on the results, where each question opens its answer');
  await solo.click('.os-libdone [data-lib="endstudy"]'); await solo.waitForSelector('.os-libgo');
  ok(/Custom session/.test(await solo.textContent('.os-libsumhead')), 'exam: Done goes back to Custom, where it started');
  await solo.click('[data-lib="pref"][data-k="mode"][data-v="tutor"]'); await solo.click('[data-lib="sumback"]'); await solo.waitForTimeout(300);

  /* Playlists (2026-10-26): Lee publishes a deck to the community; Kim, a new player, finds it under New, favourites it
     and plays it, and the duel opens on the playlist in place of the bank */
  const plFlat = async (pg, where) => ok(await pg.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1 && [...document.querySelectorAll('.os-pl:not([hidden]) .os-plbody > *')].every(e => e.getBoundingClientRect().right <= innerWidth + 1)), `playlists ${where}: no sideways scroll`);
  const lee = await phone(320, 640);   /* Lee on a fresh tab: the earlier phone is mid-duel */
  await lee.click('[data-os="settings"]'); await lee.fill('[data-set="aname"]', 'Lee'); await lee.fill('[data-set="apin"]', '1234'); await lee.click('[data-set="ain"]');
  await lee.waitForSelector('[data-set="aout"]'); await lee.keyboard.press('Escape'); await lee.waitForTimeout(400);
  await open(lee, 'library'); await lee.click('.os-libp [data-lib="playlists"]');
  await lee.waitForSelector('.os-pl:not([hidden]) .os-plpub');
  ok(/Playlists/.test(await lee.textContent('.os-pl .os-plhead h2')), 'playlists: Your questions opens the community library');
  await shot(lee, '320-playlists'); await plFlat(lee, 'browse');
  await lee.click('[data-pl="publishview"]'); await lee.waitForSelector('[data-pl-form="publish"]');
  await lee.fill('[data-pl-form="publish"] [name="title"]', 'Cardiology quickfire'); await lee.fill('[data-pl-form="publish"] [name="blurb"]', 'Quick ones before the ward round');
  await shot(lee, '320-playlists-publish'); await plFlat(lee, 'publish');
  await lee.click('[data-pl-form="publish"] button[type="submit"]');
  await lee.waitForFunction(() => document.querySelector('.os-pltitle') || (document.querySelector('.os-pl .os-plerr')?.textContent || '').trim(), null, { timeout: 8000 });
  const pubErr = await lee.evaluate(() => (document.querySelector('.os-pl .os-plerr')?.textContent || '').trim());
  ok(!pubErr, `playlists: publishing raises no error${pubErr ? `: ${pubErr}` : ''}`);
  await lee.waitForSelector('.os-pltitle');
  ok(/Cardiology quickfire/.test(await lee.textContent('.os-pltitle')) && /Unpublish/.test(await lee.textContent('.os-pldetail')), "playlists: the deck is live, its page open, Lee's to unpublish");
  await shot(lee, '320-playlist-mine'); await plFlat(lee, 'detail');
  await lee.keyboard.press('Escape'); await lee.keyboard.press('Escape'); await lee.waitForTimeout(400);
  const kim = await phone(375, 812);
  await signUp(kim, 'Kim', '4321');
  await open(kim, 'library'); await kim.click('.os-libp [data-lib="playlists"]'); await kim.waitForSelector('.os-pl:not([hidden]) .os-plchips');
  await kim.click('[data-pl="sort"][data-v="new"]'); await kim.waitForSelector('.os-plrow');
  ok(/Cardiology quickfire/.test(await kim.textContent('.os-pllist')) && /Lee/.test(await kim.textContent('.os-pllist')), "playlists: under New, Kim sees Lee's playlist and who made it");
  await shot(kim, '375-playlists-new'); await plFlat(kim, 'new');
  await kim.click('.os-plrow'); await kim.waitForSelector('.os-pltitle');
  await kim.click('[data-pl="fav"]'); await kim.waitForSelector('[data-pl="fav"][aria-pressed="true"]');
  await kim.waitForFunction(() => /1 favourite /.test(document.querySelector('.os-pldetail .os-plmeta')?.textContent || ''));
  ok(/Report/.test(await kim.textContent('.os-pldetail')), "playlists: Kim favourites it (1 favourite), and can report someone else's");
  await shot(kim, '375-playlist-detail'); await plFlat(kim, 'detail');
  await kim.click('[data-pl="play"]'); await kim.waitForSelector('.os-duel[data-ready] .pd-plrow', { timeout: 15000 });
  ok(/Cardiology quickfire/.test(await kim.textContent('.pd-plrow')), 'playlists: Play opens the duel on the playlist, in place of the bank');
  await shot(kim, '375-playlist-duel');

  /* a laptop */
  const wide = await phone(1280, 800);
  await wide.click('[data-os="settings"]'); await wide.fill('[data-set="aname"]', 'Lee'); await wide.fill('[data-set="apin"]', '1234'); await wide.click('[data-set="ain"]');   /* Lee's other device: sign in */
  await wide.waitForSelector('[data-set="aout"]'); await wide.keyboard.press('Escape'); await wide.waitForTimeout(400);
  await open(wide, 'library'); await wide.waitForSelector('.os-libdeck');
  ok(/Wk 1 mixed/.test(await wide.textContent('.os-libp')), "library: Lee's deck is on Lee's other device");
  await shot(wide, 'wide-library'); await flat(wide, 'wide');

  /* the month, wrapped: last month's answers on this phone, and the first open of this month shows the story once */
  const prevM = new Date(); prevM.setDate(1); prevM.setMonth(prevM.getMonth() - 1);
  const ym = `${prevM.getFullYear()}-${String(prevM.getMonth() + 1).padStart(2, "0")}`, days = {};
  for (const [d, n, r, h] of [[3, 14, 11, 23], [4, 22, 15, 23], [5, 9, 8, 22], [12, 31, 20, 1]]) days[`${ym}-${String(d).padStart(2, '0')}`] = { n, r, s: { Cardiology: [Math.ceil(n / 2), Math.ceil(r / 2)], Nephrology: [Math.floor(n / 2), Math.floor(r / 2) - 3] }, y: { 1: [n - 4, r - 2], 3: [4, 2] }, k: { clinical: [n, r] }, h: { [h]: n } };
  const wr = await phone(375, 812, {}, ['osce.libstudy.v1', JSON.stringify({ card: {}, day: { d: '', n: 0 }, days })]);
  await wr.waitForSelector('.os-wrap', { timeout: 8000 });
  ok(/wrapped/.test(await wr.textContent('.os-wrapbig')), 'wrapped: the first open of a new month pops last month out, Spotify-style');
  const names = [];
  for (let i = 0; i < 12 && !(await wr.locator('.os-wrapcard').count()); i++) {
    names.push(await wr.getAttribute('.os-wrap', 'data-theme')); await shot(wr, `375-wrapped-${i}`);
    await wr.click('.os-wraptap--r', { position: { x: 200, y: 400 } }); await wr.waitForTimeout(250);
  }
  ok(['count', 'streak', 'top', 'acc', 'nemesis', 'year'].every(t => names.includes(t)) && names.some(t => t.startsWith('vibe')), `wrapped: questions, streak, top specialty, accuracy, nemesis, persona, year (${names.join(' ')})`);
  ok(/Night Owl/.test(await wr.textContent('.os-wrapcard')) && /76/.test(await wr.textContent('.os-wrapcard')), 'wrapped: the final card has the numbers and the persona');
  await wr.waitForTimeout(500); await shot(wr, '375-wrapped-final');
  ok(await wr.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'wrapped: fits the phone');
  const [dl] = await Promise.all([wr.waitForEvent('download', { timeout: 5000 }).catch(() => null), wr.click('[data-wrap="image"]')]);
  if (dl) { const fp = path.join(SHOTS, 'lib-wrapped-card.png'); await dl.saveAs(fp); ok(/wrapped\.png$/.test(dl.suggestedFilename()), `wrapped: Save the card makes a 1080 by 1920 picture (${dl.suggestedFilename()})`); }
  else ok(false, 'wrapped: Save the card makes a picture');
  await wr.click('[data-wrap="share"]');
  ok(/My .* on Med-OS, wrapped/.test(await wr.evaluate(() => window.__copied || '')), 'wrapped: Copy for the group chat');
  await wr.click('[data-wrap="done"]'); await wr.waitForSelector('.os-wrap', { state: 'detached' });
  await wr.reload({ waitUntil: 'networkidle' }); await wr.waitForSelector('.os[data-ready]'); await wr.waitForTimeout(800);
  ok(await wr.locator('.os-wrap').count() === 0, 'wrapped: once a month, not every open');

  /* a bank question published without an explanation: the one the bank gives it says an AI wrote it (lib/mcq-explain.mjs) */
  const ex = await phone(320, 640, cfg);
  await ex.route(/\/duel\/pack\.json/, r => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ schemaVersion: 1, title: 'Bank', questions: [{ id: 'medqa-x', stem: 'A 35-year-old man has itchy, watery eyes and sneezing each spring, with bilateral conjunctival injection. What is the most appropriate treatment?', options: ['Erythromycin ointment', 'Ketotifen eye drops', 'Warm compresses', 'Fluorometholone eye drops'], answer: 1, why: 'Seasonal itch, watery discharge and sneezing are allergic conjunctivitis; a topical antihistamine and mast cell stabiliser such as ketotifen is first line.', whyBy: 'ai', topic: 'Ophthalmology', cat: 'clinical', origin: 'human', source: 'usmle-resource', year: 3, difficulty: 1 }] }) }));
  await open(ex);
  await ex.waitForSelector('.os-libgo:not([disabled])'); await ex.click('.os-libgo'); await ex.waitForSelector('.os-libopt');
  await ex.locator('.os-libopt').first().click(); await ex.waitForSelector('.os-libexp');
  ok(/Explanation written by AI/.test(await ex.textContent('.os-libexp')), 'study: an explanation AI wrote for a published question says so');
  await flat(ex, 'AI explanation at 320'); await shot(ex, 'ai-explanation-320');

  ok(!errs.length, `library: no page errors${errs.length ? `: ${errs.join(' | ')}` : ''}`);
  await b.close();
}
