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
    if (tab) { await pg.click(`.os-libtabs [data-tab="${tab}"]`); await pg.waitForSelector(`.os-libtabs [data-tab="${tab}"][aria-selected="true"]`); }
    await pg.waitForTimeout(250);
  };
  const close = async pg => { await pg.keyboard.press('Escape'); await pg.waitForSelector('.os-lib', { state: 'detached' }); };

  /* Lee, on a small phone: the card, the empty library, Upload */
  const sam = await phone(320, 640);
  ok(await sam.locator('.os-start > [data-os="lib"]').isVisible(), 'library: Your questions is a card on Start');
  await signUp(sam, 'Lee', '1234');
  await open(sam);
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
  await sam.click('.os-libqs summary'); await sam.waitForTimeout(200);
  ok(await sam.locator('.os-libqs li').count() === 3 && /Paediatrics › Anatomy/.test(await sam.textContent('.os-libqs')), 'library: each question shows its specialty and kind');

  /* Study: the drill-down, a card answered and graded, the keys */
  await sam.click('.os-libdeck [data-lib="studydeck"]'); await sam.waitForSelector('.os-libgo');
  await sam.click('.os-libchips [data-k="topic"][data-v="Paediatrics"]'); await sam.waitForTimeout(150);
  ok(/Study 2 cards/.test(await sam.textContent('.os-libgo')), 'study: Paediatrics narrows to its 2');
  await sam.click('.os-libchips [data-k="cat"][data-v="anatomy"]'); await sam.waitForTimeout(150);
  ok(/Study 1 card/.test(await sam.textContent('.os-libgo')), 'study: then Anatomy narrows to 1');
  await shot(sam, '320-study-pick'); await flat(sam, 'study pick');
  await sam.click('.os-libchips [data-k="cat"][data-v=""]'); await sam.click('.os-libgo');
  await sam.waitForSelector('.os-libopt');
  await shot(sam, '320-card'); await flat(sam, 'card');
  await sam.locator('.os-libopt').nth(1).click(); await sam.waitForSelector('.os-libexp');
  const after = await sam.evaluate(() => ({ ok: document.querySelectorAll('.os-libopt.ok').length, no: document.querySelectorAll('.os-libopt.no').length, again: document.querySelector('[data-lib="grade"].os-primary')?.dataset.g }));
  ok(after.ok === 1 && after.no <= 1 && ['again', 'good'].includes(after.again), `study: the answer shows right and wrong, the explanation, and suggests a grade (${JSON.stringify(after)})`);
  await shot(sam, '320-card-answered'); await flat(sam, 'answered');
  await sam.click('[data-lib="grade"][data-g="good"]'); await sam.waitForTimeout(150);
  await sam.keyboard.press('1'); await sam.waitForSelector('.os-libexp'); await sam.keyboard.press('3');
  await sam.waitForSelector('.os-libdone');
  ok(/2 cards studied/.test(await sam.textContent('.os-libdone')), 'study: keys 1 to 5 answer and 1 to 4 grade; done for now');
  const study = await sam.evaluate(() => JSON.parse(localStorage.getItem('osce.libstudy.v1') || '{}'));
  ok(Object.keys(study.card || {}).length === 2 && Object.values(study.card).every(c => c.due > Date.now()), 'study: each graded card is due again later');
  await sam.click('.os-libdone [data-lib="endstudy"]');
  /* the year: each question has one (given, or guessed and said so), chips by year, and 0 to 1 climbs them */
  ok(await sam.locator('.os-libchips [data-k="year"]').count() === 5, 'study: a Year row (All and Years 1 to 4)');
  await sam.click('[data-lib="order"][data-v="ladder"]'); await sam.waitForTimeout(150);
  ok(/Year 1 first principles/.test(await sam.textContent('.os-liborder')), 'study: 0 to 1 says what it does');
  await shot(sam, '320-study-ladder'); await flat(sam, 'study 0 to 1');
  await sam.selectOption('.os-libp [name="sdeck"]', '__bank'); await sam.waitForSelector('.os-libgo');
  await sam.click('[data-lib="order"][data-v="ladder"]').catch(() => {}); await sam.waitForTimeout(150);
  await sam.click('.os-libgo'); await sam.waitForSelector('.os-libopt');
  const climb = await sam.evaluate(() => document.querySelector('.os-libprog .os-liblayer').textContent);
  ok(/^Year 1 · /.test(climb) && await sam.locator('.os-libyear').isVisible(), `study: 0 to 1 over the bank starts at Year 1, and says so (${climb})`);
  await shot(sam, '320-ladder-card'); await flat(sam, 'ladder card');
  let last = 1, upward = true;
  for (let i = 0; i < 12; i++) {
    const y = +(await sam.textContent('.os-libprog .os-liblayer')).match(/^Year (\d)/)[1]; if (y < last) upward = false; last = y;
    await sam.locator('.os-libopt').first().click(); await sam.click('[data-lib="grade"][data-g="good"]'); await sam.waitForTimeout(60);
  }
  ok(upward && last >= 3, `study: 0 to 1 only ever climbs (reached Year ${last} after 12)`);
  await sam.click('[data-lib="endstudy"]');
  /* your summary: from the answers just given, the gaps with a way to study them, by year, difficulty, specialty */
  ok(await sam.locator('.os-libdiff, .os-libchips [data-k="diff"]').count() === 4, 'study: a Difficulty row (All, Easy, Medium, Hard)');
  await sam.click('.os-libgaps'); await sam.waitForSelector('.os-libsumhead');
  const sm = await sam.textContent('.os-libp');
  ok(/Your gaps/.test(sm) && /By year/.test(sm) && /By difficulty/.test(sm) && /By specialty/.test(sm) && /\d+%/.test(sm), 'summary: overall, your gaps, by year, by difficulty and by specialty');
  await sam.evaluate(() => document.querySelector('.os-dlg-body')?.scrollTo(0, 0)); await shot(sam, '320-summary'); await flat(sam, 'summary');
  await sam.evaluate(() => document.querySelector('.os-libbars')?.scrollIntoView({ block: 'center' })); await shot(sam, '320-summary-bars');
  const gapBtn = sam.locator('[data-lib="gap"]').first();
  if (await gapBtn.count()) { await gapBtn.click(); await sam.waitForSelector('.os-libopt'); ok(true, 'summary: Study this starts a session on that gap'); await sam.click('[data-lib="endstudy"]'); }
  else { await sam.click('[data-lib="sumback"]'); }
  ok(/0 due/.test(await sam.textContent('.os-libstat')) || /Study 0|Nothing due|Study 1 card/.test(await sam.textContent('.os-libgo')), 'study: the graded cards are no longer due');

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
  ok(/Friends \(1\)/.test(await alex.textContent('.os-libp')), 'friends: accepted, they are friends');
  await close(alex);

  /* Lee shares the deck; Kai finds it under From friends and studies it */
  await close(sam); await open(sam, 'library');
  await sam.click('.os-libdeck [data-lib="share"]'); await sam.waitForSelector('[data-lib="sharewith"]');
  await sam.click('[data-lib="sharewith"]'); await sam.waitForSelector('[data-lib="sharewith"][aria-pressed="true"]');
  ok(/Shared with Kai/.test(await sam.textContent('.os-libdeck .os-libmeta')), 'share: the deck says who it is shared with');
  await shot(sam, '320-shared'); await flat(sam, 'shared');
  await open(alex, 'library');
  await alex.waitForSelector('.os-libdeck');
  ok(/From friends/.test(await alex.textContent('.os-libp')) && /From Lee/.test(await alex.textContent('.os-libdeck')), "share: Kai has Lee's deck under From friends");
  ok(await alex.locator('[data-lib="deldeck"]').count() === 0, "share: a friend's deck cannot be deleted by Kai");
  await shot(alex, '393-from-friends');
  await alex.click('[data-lib="studydeck"]'); await alex.click('.os-libgo'); await alex.waitForSelector('.os-libopt');
  ok(/from Lee/.test(await alex.textContent('.os-libprog')), "study: a friend's card says whose it is");
  await shot(alex, '393-friend-card');

  /* the duel: the pack gains Lee's questions as a deck to pick */
  const mixed = await sam.evaluate(async () => (await import('./js/osce/duel.mjs')).packDecks());
  ok(mixed.some(d => d.id === 'bank') && mixed.some(d => d.id === 'mine' && d.count === 3), `duel: Your questions is a deck in the duel's pack (${JSON.stringify(mixed)})`);
  const alexDecks = await alex.evaluate(async () => (await import('./js/osce/duel.mjs')).packDecks());
  ok(alexDecks.some(d => d.id === 'friends' && d.count === 3), `duel: for Kai, Lee's shared deck is Friends' (${JSON.stringify(alexDecks)})`);
  /* practice on Lee's own questions: From, Yours, and a question tagged Yours */
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
  ok(/Yours/.test(await sam.textContent('.os-duel .pd-mtop .pd-qtag')), 'duel: the question is tagged Yours');
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

  /* signed out: kept on this phone, and a note says how to keep it on an account */
  const solo = await phone(320, 640, {});
  await open(solo, 'upload'); await solo.fill('.os-libp [name="paste"]', UPLOAD); await solo.waitForSelector('.os-libsum');
  await solo.click('.os-libsave'); await solo.waitForSelector('.os-libdeck');
  ok(/Signed out/.test(await solo.textContent('.os-libp')) && /3 questions/.test(await solo.textContent('.os-libdeck')), 'signed out: the questions are kept on this phone, with a note to sign in');
  await open(solo, 'friends'); ok(/need an account/.test(await solo.textContent('.os-libp')), 'signed out: Friends asks you to sign in');

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
  await wr.click('[data-wrap="share"]');
  ok(/My .* on Med-OS, wrapped/.test(await wr.evaluate(() => window.__copied || '')), 'wrapped: Copy for the group chat');
  await wr.click('[data-wrap="done"]'); await wr.waitForSelector('.os-wrap', { state: 'detached' });
  await wr.reload({ waitUntil: 'networkidle' }); await wr.waitForSelector('.os[data-ready]'); await wr.waitForTimeout(800);
  ok(await wr.locator('.os-wrap').count() === 0, 'wrapped: once a month, not every open');

  ok(!errs.length, `library: no page errors${errs.length ? `: ${errs.join(' | ')}` : ''}`);
  await b.close();
}
