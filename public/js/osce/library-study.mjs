/* osce/library-study.mjs - Study, the Your questions tab you open every day (from library-view.mjs, 2026-10-27, which
   keeps the dialog, Library, Upload and Friends): the home (Today, the modes, Custom, Resume), the card (tutor or timed,
   strike, flag, note, Labs), the grades, the exam review, the notebook, your gaps and the summary, the keys, and the
   actions they fire (studyAct, which library-view.mjs act hands on). The laws are js/library/*.mjs. */
import { esc } from '../core.mjs';
import { icon } from '../study-kit/icons.mjs';
import { I, notify, now, ctx } from './state.mjs';
import { osceGames, placementSpecs, placementName } from './core.mjs';
import { deckName, layers, layerLabel, yearLabel, diffLabel, inPick, KINDS, KIND_IDS } from '../library/item.mjs';
import { YEARS, YEAR_IDS, DIFFICULTY, DIFF_IDS, ladder } from '../mcq/year.mjs';
import { displayOrder } from '../mcq/schema.mjs';
import { inText } from '../library/ranges.mjs';
import { openRanges } from './ranges-view.mjs';
import { record, summary, wrapped, monthOf, monthName, dayOf } from '../library/stats.mjs';
import { grade, counts, preview, soon, isNew, GRADES } from '../library/sched.mjs';
import { today, streak, heat, session, timedSecs, tally, smart, snapshot, resumable, examPlan, placeFirst, inPlace, pref as prefOf, GOALS, SIZES, WHICH, ORDERS, MODES } from '../library/plan.mjs';
import { lsGet, lsSet } from '../study-kit/store.mjs';
import * as api from '../library/api.mjs';
import { rpc, accountsOn } from './account.mjs';
import { animate, SPRING, reducedMotion } from '../study-kit/spring.mjs';
import { V, paint, panel, dlg, arrive, day, plural, go, LET, REPORTS, tabIdx } from './library-view.mjs';

export function libraryKey(e) {
  if (V.tab !== 'study' || !V.st.q || e.metaKey || e.ctrlKey || e.altKey || e.target.closest?.('input, textarea, select')) return false;
  if (V.st.rv != null && V.st.picks && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) { panel()?.querySelector(`.os-librevnav .os-btn:${e.key === 'ArrowRight' ? 'last' : 'first'}-child:not([disabled])`)?.click(); return true; }   /* going through an exam's answers */
  const it = V.st.q[V.st.i];
  if (it && V.st.pick == null && e.shiftKey && /^Digit[1-5]$/.test(e.code) && +e.code.slice(5) <= it.item.options.length) { strike(displayOrder(it.item, it.key)[+e.code.slice(5) - 1]); return true; }
  if (it && V.st.pick == null && /^[1-5]$/.test(e.key) && +e.key <= it.item.options.length) { choose(displayOrder(it.item, it.key)[+e.key - 1]); return true; }
  if (it && V.st.mode === 'exam' && V.st.pick == null && e.key === 'Enter' && !e.target.closest?.('button, a')) { examNext(); return true; }
  if (it && V.st.pick != null && /^[1-4]$/.test(e.key)) { rate(GRADES[+e.key - 1]); return true; }
  if (it && V.st.pick != null && (e.key === 'Enter' || e.key === ' ') && !e.target.closest?.('button, a')) { rate(V.st.pick === it.item.answer ? 'good' : 'again'); return true; }
  return false;
}
/* ---------------------------------------------------------------- Study
   Home     Today: the goal ring, the streak, what is due, and one Start; the modes a tap away (0 to 1, your weak spot,
            what you got wrong, what you flagged); Custom builds any session; Your summary under it all
   Custom   deck, specialty, kind, year, difficulty; which questions, how many, tutor or timed, in what order
   Card     focus: the tabs step aside; a flag and a note on every question; timed puts the exam's clock on it */
/* the bank (public/duel/pack.json: the stations' questions and the reviewed pool) as a deck to study, read-only */
const BANK = '__bank';
async function loadBank() {
  if (V.bank) return V.bank;
  try {
    const r = await fetch('./duel/pack.json', { cache: 'no-cache' }); if (!r.ok) throw new Error();
    V.bank = (await r.json()).questions.map(q => ({ item: { id: q.id, stem: q.stem, options: q.options, answer: q.answer, explanation: q.why || '', why: Array.isArray(q.notes) ? q.notes : [], topic: q.topic || '', cat: q.cat || '', year: q.year || 0, difficulty: q.difficulty || 0, ...(q.credit ? { credit: q.credit } : {}), ...(q.why && q.whyBy === 'ai' ? { whyBy: 'ai' } : {}) }, deck: BANK, deckName: 'The bank', owner: '', ownerName: '', key: `b:${q.id}` }));
  } catch { V.bank = []; }
  return V.bank;
}
/* everything you can study, your placement's specialties first (Today's new cards come from the front) */
const everything = () => placeFirst([...api.allItems(V.lib), ...(V.bank || [])], placementSpecs(ctx.mem));
function studyPool() {
  const d = V.st.deck;
  if (d === BANK) return V.bank || [];
  return d ? api.allItems(V.lib).filter(x => x.deck === d) : everything();
}
const inStudyPick = x => inPick(x.item, V.st) && (!V.st.year || x.item.year === V.st.year) && (!V.st.diff || x.item.difficulty === V.st.diff);
export const myPref = () => prefOf(api.studyMem().pref);
export function setPref(k, v) { const m = api.studyMem(); m.pref = prefOf({ ...prefOf(m.pref), [k]: v }); api.saveStudy(m); }
const LIVE = 'osce.lib.session';   /* the session you are in, on this device: Resume on the home within 12 hours */
const saveLive = () => { try { if (V.st.q && V.st.i < V.st.q.length) lsSet(LIVE, snapshot(V.st, now())); else lsSet(LIVE, null); } catch {} };
const startedToday = () => { const m = api.studyMem(); return m.day?.d === day() ? m.day.n | 0 : 0; };

/* the Study buddy's modules, fetched as a session opens so its row is drawn with the answer, not after it */
let buddyP = null;
const buddyKit = () => (buddyP ||= import('./buddy.mjs').then(b => { b.warm(); return b; }));
export function studyHtml() {
  if (osceGames(ctx.mem).mascot) buddyKit().catch(() => { buddyP = null; });
  if (!V.bank) { loadBank().then(() => { if (V.tab === 'study' && !V.st.q) paint(); }); return '<p class="os-libmeta">Loading…</p>'; }
  if (V.st.q) return cardHtml();
  if (V.st.view === 'summary') return summaryHtml();
  if (V.st.view === 'custom') return customHtml();
  if (V.st.view === 'notebook') return notebookHtml();
  return homeHtml();
}

/* the goal ring: an arc that fills as today's answers reach the goal (a spring brings it there) */
const ring = (frac, n, goal, what = 'today') => `<div class="os-libring" role="img" aria-label="${n} of ${goal} ${what}" style="--p:${frac.toFixed(3)}"><svg viewBox="0 0 44 44" aria-hidden="true"><circle cx="22" cy="22" r="19"/>${frac > 0 ? '<circle class="arc" cx="22" cy="22" r="19" pathLength="100"/>' : ''}</svg><b>${n}</b><small>of ${goal}${what === 'right' ? ' right' : ''}</small></div>`;
function homeHtml() {
  const mem = api.studyMem(), p = myPref(), t = now(), all = everything(), td = today(mem.days, t, p.goal), sk = streak(mem.days, t);
  const tl = tally(all, mem.card, t), plan = examPlan(p.exam, tl.fresh, t), q = session(all, mem.card, { order: 'due', size: p.size, newADay: plan?.perDay }, t, startedToday());
  const s = summary(all, mem.card), gap = s.gaps[0], res = resumable(lsGet(LIVE, null), all, t), notes = all.filter(e => mem.card[e.key]?.note).length;
  const pl = inPlace(all, placementSpecs(ctx.mem)), pn = placementName(ctx.mem);   /* your placement's questions (Settings) */
  const firstTime = !s.total.n;   /* the modes explain themselves until the first answer, then stay out of the way */
  const mode = (m, label, sub, ic, n = '') => `<button class="os-libmode${firstTime ? '' : ' os-libmode--short'}" data-lib="mode" data-m="${m}"><span class="os-libmode-ic">${icon(ic)}${n !== '' ? `<span class="os-libmode-n">${n}</span>` : ''}</span><span class="os-libmode-tx"><b>${esc(label)}</b>${firstTime || m === 'weak' ? `<small>${esc(sub)}</small>` : ''}</span></button>`;
  return `<section class="os-libtoday">
      ${ring(td.frac, td.n, td.goal)}
      <div class="os-libtoday-tx"><h3>${td.done ? 'Goal done today' : 'Today'}</h3>
        <p class="os-libstreak${sk.live ? ' live' : ''}">${icon('flame')}<span>${sk.days ? `${sk.days}-day streak${sk.live ? '' : ': study today to keep it'}` : 'Start a streak today'}</span></p>
        <p class="os-libmeta">${[tl.due ? `${tl.due} due` : '', `${Math.max(0, Math.min(tl.fresh, (plan?.perDay || 20) - startedToday()))} new`].filter(Boolean).join(' · ')}${plan ? ` · exam in ${plural(plan.days, 'day')}` : ''}</p></div>
    </section>
    ${res ? `<button class="os-libresume" data-lib="resume"><span><b>Resume your session</b><small>${esc(res.label || 'Study')} · ${plural(res.left, 'card')} left</small></span><span class="os-chev" aria-hidden="true">${I.chevR}</span></button>` : ''}
    <button class="os-btn os-btn--lg os-primary os-libgo" data-lib="today"${q.length ? '' : ' disabled'}>${q.length ? `Start · ${plural(q.length, 'card')}` : 'All caught up: try a mode below'}</button>
    <div class="os-libmodes">
      ${pl.length ? mode('place', `Rotation: ${pn}`, 'Your placement’s questions, due first', 'stethoscope', pl.length) : ''}
      ${mode('smart', 'Smart 10', 'Your weak areas, mixed so you win some', 'bolt')}
      ${mode('ladder', '0 to 1', 'Year 1 first principles up to final year', 'stairs')}
      ${gap ? mode('weak', 'Weak spot', `${gap.label} · ${gap.acc}%`, 'target') : ''}
      ${tl.incorrect ? mode('incorrect', 'Got wrong', 'Answer them again', 'refresh', tl.incorrect) : ''}
      ${tl.flagged ? mode('flagged', 'Flagged', 'The ones you marked', 'bookmark', tl.flagged) : ''}
      ${notes ? mode('notebook', 'Notes', 'Every note you wrote', 'pencil', notes) : ''}
      ${mode('custom', 'Custom', 'Deck, specialty, year, timed…', 'filter')}
    </div>
    ${gapsCardHtml()}
    <details class="os-libsettings"><summary>Goal and exam date</summary>
    <div class="os-libexam">${plan ? `<p><b>Exam in ${plural(plan.days, 'day')}</b><span>${plan.unseen} questions not seen yet: ${plan.perDay} new a day sees them all once by then.</span></p>` : '<p><b>Exam plan</b><span>Set your exam date and the day’s new questions follow from it.</span></p>'}
      <label class="os-libexamd"><span class="os-vh">Exam date</span><input type="date" name="exam" value="${esc(p.exam)}" min="${esc(dayOf(t))}"></label></div>
    <div class="os-libgoal"><span class="os-libh2">Daily goal</span><div class="os-seg" role="radiogroup" aria-label="Daily goal">${GOALS.map(g => `<button role="radio" data-lib="pref" data-k="goal" data-v="${g}" aria-checked="${p.goal === g}">${g}</button>`).join('')}</div></div></details>`;
}

function customHtml() {
  const mem = api.studyMem(), cards = mem.card, p = myPref(), t = now(), all = api.allItems(V.lib);
  const pool = studyPool(), L = layers(pool.map(x => x.item)), pick = pool.filter(inStudyPick), tl = tally(pick, cards, t);
  const q = session(pick, cards, { which: p.which, order: p.order, size: p.size }, t, startedToday());
  const inTK = pool.filter(x => inPick(x.item, V.st)), yN = y => inTK.filter(x => x.item.year === y && (!V.st.diff || x.item.difficulty === V.st.diff)).length;
  const inTKY = inTK.filter(x => !V.st.year || x.item.year === V.st.year), dN = d => inTKY.filter(x => x.item.difficulty === d).length;
  /* a chip with nothing behind it is left out (unless it is the one chosen) */
  const chip = (k, v, label, n, on) => (n === 0 && !on ? '' : `<button class="os-chip${on ? ' on' : ''}${on && V.tap !== `${k}:${v}` ? ' os-still' : ''}" data-lib="pick" data-k="${k}" data-v="${esc(v)}" aria-pressed="${on}">${esc(label)}<span class="os-libn2">${n}</span></button>`);
  const topic = L.find(x => x.topic === V.st.topic);
  const decks = [...V.lib.decks.map(d => [d.id, d.name]), ...V.lib.shared.map(d => [d.id, `${d.name} (${d.owner_name})`]), [BANK, `The bank (${(V.bank || []).length})`]];
  /* a group of chips is shown only when it can narrow anything: two or more options with questions, or one chosen */
  /* a group of chips is shown only when it can narrow anything: two or more options with questions, or one chosen */
  const group = (label, k, html) => ((html.match(/data-v="[^"]+"/g) || []).length >= 2 || V.st[k] ? `<p class="os-libh2">${label}</p><div class="os-libchips">${html}</div>` : '');
  /* a choice: chips that wrap (a segmented control truncates four labels at 320 px) */
  const seg = (k, opts, cur, label) => `<div class="os-libsegrow"><span class="os-libh2" id="os-lsr-${k}">${label}</span><div class="os-libchips" role="radiogroup" aria-labelledby="os-lsr-${k}">${opts.map(([v, l, n]) => { const on = String(cur) === String(v); return `<button class="os-chip${on ? ' on' : ''}${on && V.tap !== `${k}:${v}` ? ' os-still' : ''}" role="radio" data-lib="pref" data-k="${k}" data-v="${v}" aria-checked="${on}"${n === 0 && !on ? ' disabled' : ''}>${esc(l)}${n != null ? `<span class="os-libn2">${n}</span>` : ''}</button>`; }).join('')}</div></div>`;
  const whichN = { all: pick.length, unused: tl.unused, incorrect: tl.incorrect, flagged: tl.flagged };
  return `<div class="os-libsumhead"><button class="os-link" data-lib="sumback">${I.back}<span>Study</span></button><h3>Custom session</h3></div>
    <label class="os-setf"><span>Deck</span><select name="sdeck"><option value="">Everything (${everything().length})</option>${decks.map(([id, n]) => `<option value="${esc(id)}"${id === V.st.deck ? ' selected' : ''}>${esc(n)}</option>`).join('')}</select></label>
    ${group('Specialty', 'topic', `${chip('topic', '', 'All', pool.length, !V.st.topic)}${L.map(x => chip('topic', x.topic, x.topic, x.count, V.st.topic === x.topic)).join('')}`)}
    ${group('Kind', 'cat', `${chip('cat', '', 'All', topic ? topic.count : pool.length, !V.st.cat)}${KIND_IDS.map(k => chip('cat', k, KINDS[k].short || KINDS[k].label, topic ? topic.cats.find(x => x.id === k).count : pool.filter(x => x.item.cat === k).length, V.st.cat === k)).join('')}`)}
    ${group('Year', 'year', `${chip('year', '', 'All', inTK.length, !V.st.year)}${YEAR_IDS.map(y => chip('year', String(y), YEARS[y].label, yN(y), V.st.year === y)).join('')}`)}
    ${group('Difficulty', 'diff', `${chip('diff', '', 'All', inTKY.length, !V.st.diff)}${DIFF_IDS.map(d => chip('diff', String(d), DIFFICULTY[d].label, dN(d), V.st.diff === d)).join('')}`)}
    ${seg('which', Object.entries(WHICH).map(([v, l]) => [v, l, whichN[v]]), p.which, 'Questions')}
    ${seg('size', SIZES.map(n => [n, n ? String(n) : 'All']), p.size, 'How many')}
    ${seg('mode', Object.entries(MODES), p.mode, 'Mode')}
    <p class="os-libmeta os-libmodenote">${p.mode === 'exam' ? 'Exam: the exam’s clock on each question and no answers until the end, then go through them.' : p.mode === 'timed' ? 'Timed: the exam’s clock on each question (90 s plus reading time); the answer after each.' : 'Tutor: no clock; the answer and why after each.'}</p>
    ${seg('order', Object.entries(ORDERS), p.order, 'Order')}
    <div class="os-libstick"><button class="os-btn os-btn--lg os-primary os-libgo" data-lib="start"${q.length ? '' : ' disabled'}>${q.length ? `Start · ${plural(q.length, 'card')}` : 'Nothing matches: loosen a filter'}</button></div>`;
}

/* a session from a list (already in order): into focus */
function startWith(list, { mode = 'tutor', order = 'due', label = '' } = {}) {
  if (!list.length) { notify('Nothing to study there right now.', ''); return false; }
  Object.assign(V.st, { q: list, i: 0, pick: null, n: 0, right: 0, mode, order, label, note: false, seen: [], x: null, combo: 0, best: 0, sel: null, picks: null, rv: null });
  saveLive();
  dlg()?.querySelector('.os-lib')?.classList.add('os-lib--focus');
  paint(); tick(); panel()?.querySelector('.os-libopt')?.focus({ preventScroll: true });
  return true;
}
function endStudy() {
  clearInterval(V.st.timer); if (V.st.q && V.st.i >= V.st.q.length) lsSet(LIVE, null); V.st.q = null;
  dlg()?.querySelector('.os-lib')?.classList.remove('os-lib--focus');
  paint(); arrive(); panel()?.querySelector('.os-libgo')?.focus({ preventScroll: true });
}
/* timed and exam: the question's clock, every quarter second; at 0 it is answered blank (in an exam, with what was chosen) */
function tick() {
  clearInterval(V.st.timer);
  const x = V.st.q?.[V.st.i];
  if (!x || (V.st.mode !== 'timed' && V.st.mode !== 'exam') || V.st.pick != null) return;
  const total = timedSecs(x.item) * 1000; V.st.ends = now() + total;
  const draw = () => {
    const left = Math.max(0, V.st.ends - now()), el = panel()?.querySelector('.os-libclock');
    if (el) { el.querySelector('b').textContent = String(Math.ceil(left / 1000)); el.style.setProperty('--p', (left / total).toFixed(3)); el.classList.toggle('low', left < 15000); }
    if (!left) { clearInterval(V.st.timer); if (V.st.mode === 'exam') examNext(); else answer(-1); }
  };
  draw(); V.st.timer = setInterval(draw, 250);
}

/* after an exam: each question as you answered it, with the answer and why; Back, Next, and Results at the end */
function revHtml() {
  const keys = [...new Set((V.st.seen || []).map(s => s.key))], by = new Map(V.st.q.map(x => [x.key, x]));
  const n = Math.min(V.st.rv, keys.length - 1), x = by.get(keys[n]); if (!x) { V.st.rv = null; return cardHtml(); }
  const it = x.item, ord = displayOrder(it, x.key), picked = V.st.picks[x.key] ?? -1;   /* Back arrives from the left, Next from the right */
  return `<div class="os-libcard os-libcard--in os-librev${V.st.rvBack ? ' os-librev--back' : ''}" data-q="${esc(x.key)}">
    <div class="os-libtop">
      <button class="os-libx" data-lib="revend" aria-label="Back to the results">${I.x}</button>
      <div class="os-libbar" role="progressbar" aria-label="Answers gone through" aria-valuemin="0" aria-valuemax="${keys.length}" aria-valuenow="${n + 1}"><i style="transform:scaleX(${((n + 1) / keys.length).toFixed(3)})"></i></div>
      <span class="os-libcount2">${n + 1}/${keys.length}</span>
    </div>
    <p class="os-liblayer"><b>${esc(layerLabel(it))}</b></p>
    <p class="os-libstem">${esc(it.stem)}</p>${it.ask ? `<p class="os-libask">${esc(it.ask)}</p>` : ''}
    ${optsHtml(it, ord, picked, true)}
    ${expHtml(x, it, ord, picked)}
    <div class="os-librevnav"><button class="os-btn os-btn--lg" data-lib="revgo" data-v="${n - 1}"${n ? '' : ' disabled'}>Back</button><button class="os-btn os-btn--lg os-primary" data-lib="${n + 1 < keys.length ? 'revgo' : 'revend'}" data-v="${n + 1}">${n + 1 < keys.length ? 'Next' : 'Results'}</button></div>
  </div>`;
}
function cardHtml() {
  if (V.st.rv != null && V.st.picks) return revHtml();
  const x = V.st.q[V.st.i];
  if (!x) {
    const mem = api.studyMem(), p = myPref(), td = today(mem.days, now(), p.goal), sk = streak(mem.days, now()), pct = V.st.n ? Math.round((100 * V.st.right) / V.st.n) : 0;
    const missed = (V.st.seen || []).some(x => !x.ok);
    const exam = V.st.mode === 'exam' && V.st.picks;
    return `<div class="os-libempty os-libdone">${ring(V.st.n ? V.st.right / V.st.n : 0, V.st.right, V.st.n, 'right')}<p><strong>${exam ? 'Exam done' : td.done ? 'Daily goal done' : 'Session done'}</strong><br>${plural(V.st.n, 'card')} · ${pct}% right · ${td.n} of ${td.goal} today${sk.days ? ` · ${sk.days}-day streak` : ''}${V.st.best >= 3 ? `<br><span class="os-libbest">${icon('flame')}Best run: ${V.st.best} in a row</span>` : ''}</p>
      <div class="os-libacts os-libacts--col">${exam ? '<button class="os-btn os-btn--lg os-primary" data-lib="revgo" data-v="0">Go through the answers</button>' : ''}${missed ? `<button class="os-btn os-btn--lg${exam ? '' : ' os-primary'}" data-lib="redo">Redo the ${(() => { const k = new Set((V.st.seen || []).filter(x => !x.ok).map(x => x.key)).size; return k === 1 ? 'one' : k; })()} missed</button><button class="os-btn os-btn--lg" data-lib="today">Keep going</button>` : '<button class="os-btn os-btn--lg os-primary" data-lib="today">Keep going</button>'}<button class="os-link" data-lib="endstudy">Done</button></div>
      ${reviewHtml()}</div>`;
  }
  const it = x.item, picked = V.st.pick, shown = picked != null, card = api.studyMem().card[x.key] || {}, t = now(), timed = V.st.mode === 'timed' || V.st.mode === 'exam', exam = V.st.mode === 'exam';
  const ord = displayOrder(it, x.key);   /* the key spread by the card's id; each button keeps its stored index */
  const banner = V.st.order === 'ladder' && it.year && it.year !== V.st.q[V.st.i - 1]?.item.year;
  const meta = [it.year && !banner ? esc(yearLabel(it)) : '', it.difficulty ? esc(diffLabel(it)) : '', `<b>${esc(layerLabel(it))}</b>`, x.ownerName ? `from ${esc(x.ownerName)}` : ''].filter(Boolean).join(' · ');
  return `<div class="os-libcard${picked == null ? ' os-libcard--in' : ''}" data-q="${esc(x.key)}">
    <div class="os-libtop">
      <button class="os-libx" data-lib="endstudy" aria-label="End session">${I.x}</button>
      <div class="os-libbar" role="progressbar" aria-label="Progress" aria-valuemin="0" aria-valuemax="${V.st.q.length}" aria-valuenow="${V.st.i}"><i style="transform:scaleX(${(V.st.i / V.st.q.length).toFixed(3)})"></i></div>
      <span class="os-libcount2">${V.st.i + 1}/${V.st.q.length}</span>
      ${timed && !shown ? '<span class="os-libclock" aria-live="off" title="Time left"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"/><circle class="arc" cx="12" cy="12" r="10" pathLength="100"/></svg><b></b></span>' : ''}
      ${labsIn(it).length ? `<button class="os-libflag os-librng" data-lib="ranges" aria-label="Normal ranges" title="Normal ranges">${icon('flask')}</button>` : ''}
      <button class="os-libflag${card.f ? ' on' : ''}" data-lib="flag" aria-pressed="${!!card.f}" aria-label="${card.f ? 'Flagged' : 'Flag this question'}">${icon('bookmark')}</button>
    </div>
    <p class="os-liblayer">${meta}</p>
    ${banner ? `<p class="os-libyear"><b>${esc(YEARS[it.year].label)}</b> ${esc(YEARS[it.year].name)}</p>` : ''}
    <p class="os-libstem">${esc(it.stem)}</p>${it.ask ? `<p class="os-libask">${esc(it.ask)}</p>` : ''}
    ${optsHtml(it, ord, picked, shown)}
    ${shown ? `${expHtml(x, it, ord, picked, V.st.combo >= 3 ? `<span class="os-libcombo${V.st.comboAt === x.key + V.st.i ? ' os-still' : ''}">${icon('flame')}${V.st.combo} in a row</span>` : '')}
      ${picked !== it.answer && (card.w | 0) >= 4 && !card.note ? `<p class="os-libleech">${icon('alert')}<span>This one has caught you ${card.w} times. Write the rule in your own words: it is the fastest fix.</span></p>` : ''}
      ${V.st.note || card.note || (picked !== it.answer && (card.w | 0) >= 4) ? `<label class="os-libnote2"><span>Your note</span><textarea data-lib-note rows="2" maxlength="500" placeholder="A memory hook, the trap, the rule…">${esc(card.note || '')}</textarea></label>` : '<button class="os-link os-libaddnote" data-lib="note">Add a note</button>'}
      ${gradesHtml(picked === it.answer, card, t)}
      ${x.key.startsWith('b:') && accountsOn() ? (V.st.report === x.key ? `<div class="os-libreport" role="group" aria-label="What is wrong with it?"><span>What is wrong?</span>${Object.entries(REPORTS).map(([k, l]) => `<button class="os-chip" data-lib="report" data-v="${k}">${esc(l)}</button>`).join('')}</div>` : V.st.reported === x.key ? '<p class="os-libmeta os-libreported">Reported. Thank you.</p>' : '<button class="os-link os-libreportbtn" data-lib="reportopen">Report a problem</button>') : ''}` : (exam ? `<button class="os-btn os-btn--lg os-primary os-libnext os-libexamnext" data-lib="examnext">${V.st.sel == null ? 'Skip' : V.st.i + 1 >= V.st.q.length ? 'Finish' : 'Next'}</button><p class="os-libmeta os-libkeys">Exam: no answers until the end.</p>` : '<p class="os-libmeta os-libkeys"><span class="os-libkeys-touch">Tap an answer. Hold one to cross it out.</span><span class="os-libkeys-mouse">Press 1 to 5 to answer. Right-click, or Shift and the number, crosses one out.</span></p>')}
  </div>`;
}
/* the options: before the answer, tap to answer (in an exam, to choose: it can change until Next); after it, right, yours
   and the rest dimmed, with why beside the two that matter */
function optsHtml(it, ord, picked, shown) {
  return `<div class="os-libopts" role="group" aria-label="Options">${ord.map((i, pos) => {
      const o = it.options[i], st = !shown ? '' : i === it.answer ? ' ok' : i === picked ? ' no' : ' dim';
      const xd = !shown && V.st.x?.has(i), sel = !shown && V.st.mode === 'exam' && V.st.sel === i;
      return `<button class="os-libopt${st}${xd ? ' os-libopt--x' : ''}${sel ? ' sel' : ''}" data-lib="opt" data-i="${i}"${shown ? ' aria-disabled="true"' : V.st.mode === 'exam' ? ` aria-pressed="${sel}"` : ''}><b>${LET[pos]}</b><span>${esc(o)}</span><span class="os-vh os-libxvh">${xd ? 'crossed out' : ''}</span>${shown && (i === it.answer || i === picked) ? `<span class="os-vh">${i === it.answer ? 'correct answer' : 'your answer'}</span>` : ''}</button>${shown && it.why?.[i] && (i === it.answer || i === picked) ? `<p class="os-libwhy">${esc(it.why[i])}</p>` : ''}`;
    }).join('')}</div>`;
}
/* the answer box: right (with the run), or which was right; the explanation (and who wrote it, when AI did: lib/mcq-explain.mjs); the credit */
function expHtml(x, it, ord, picked, run = '') {
  return `<div class="os-libexp" role="status"><strong class="${picked === it.answer ? 'ok' : 'no'}">${picked === it.answer ? `Right${run ? ` ${run}` : ''}` : picked < 0 ? `${V.st.mode === 'exam' ? 'Not answered' : 'Time’s up'}: the answer is ${LET[ord.indexOf(it.answer)]}` : `The answer is ${LET[ord.indexOf(it.answer)]}`}</strong>${it.explanation ? explainHtml(it.explanation) : ''}${it.explanation && it.whyBy === 'ai' ? '<p class="os-libcredit">Explanation written by AI; the question and its answer are as published.</p>' : ''}${it.credit ? `<p class="os-libcredit">${esc(it.credit)}</p>` : ''}</div>`;
}
/* the day's goal, done: a burst of confetti from the top of the card (springs out, gravity down, fades), a buzz on a
   phone that has one, and a toast. Reduced motion: the toast alone */
function celebrate() {
  notify(`Daily goal done: ${myPref().goal} today. Keep the streak going tomorrow.`, 'success');
  try { navigator.vibrate?.([12, 40, 18]); } catch {}
  const host = panel()?.querySelector('.os-libcard'); if (!host || reducedMotion()) return;
  const box = document.createElement('div'); box.className = 'os-confetti'; box.setAttribute('aria-hidden', 'true');
  const colours = ['#1db954', '#00b4d8', '#ffb020', '#ff3d77', '#7b2ff7', '#c6ff00'];
  for (let k = 0; k < 28; k++) {
    const i = document.createElement('i'), a = (-90 + (Math.random() - 0.5) * 140) * Math.PI / 180, v = 160 + Math.random() * 160;
    i.style.cssText = `--x:${Math.cos(a) * v}px;--y:${Math.sin(a) * v}px;--r:${(Math.random() - 0.5) * 720}deg;--c:${colours[k % colours.length]};--d:${Math.random() * 80}ms`;
    box.append(i);
  }
  host.prepend(box); setTimeout(() => box.remove(), 1600);
}
/* the session's answers at its end: which you got, which you missed, and one tap to redo the missed */
function reviewHtml() {
  const seen = [], keys = new Set();
  for (const s of V.st.seen || []) if (!keys.has(s.key)) { keys.add(s.key); seen.push(s); }
  if (!seen.length) return '';
  const by = new Map(V.st.q.map(x => [x.key, x])), missed = seen.filter(s => !s.ok);
  const open = V.st.mode === 'exam' && V.st.picks;   /* after an exam, each opens its answer */
  return `<div class="os-libreview"><h3 class="os-libh">This session</h3><ol>${seen.map((s, n) => { const x = by.get(s.key); if (!x) return ''; const inner = `<span aria-label="${s.ok ? 'right' : 'missed'}">${s.ok ? I.check : I.x}</span><p>${esc(x.item.stem.length > 90 ? `${x.item.stem.slice(0, 90)}…` : x.item.stem)}</p>`; return `<li class="${s.ok ? 'ok' : 'no'}">${open ? `<button class="os-librevrow" data-lib="revgo" data-v="${n}">${inner}</button>` : inner}</li>`; }).join('')}</ol>
    ${missed.length ? '' : '<p class="os-libmeta">Every one right.</p>'}</div>`;
}
/* the Notebook: every question you wrote a note on */
function notebookHtml() {
  const mem = api.studyMem(), l = everything().filter(e => mem.card[e.key]?.note);
  return `<div class="os-libsumhead"><button class="os-link" data-lib="sumback">${I.back}<span>Study</span></button><h3>Notebook</h3></div>
    ${l.length ? `<button class="os-btn os-btn--lg os-primary os-libgo" data-lib="notestudy">${l.length === 1 ? 'Study it' : `Study these ${l.length}`}</button><ul class="os-libnotes" role="list">${l.map(e => `<li><span class="os-liblayer">${esc(layerLabel(e.item))}</span><p class="os-libnotes-q">${esc(e.item.stem.length > 120 ? `${e.item.stem.slice(0, 120)}…` : e.item.stem)}</p><p class="os-libnotes-a">${esc(e.item.options[e.item.answer])}</p><blockquote>${esc(mem.card[e.key].note)}</blockquote></li>`).join('')}</ul>` : '<p class="os-libmeta">No notes yet. After you answer, Add a note keeps the rule in your words.</p>'}`;
}
/* the grade follows the answer (research: answer-then-grade): right is Good and wrong is Again, one big Next; Hard and
   Easy sit either side of a right answer, and a wrong one can be marked misread. Each says when it comes back; keys 1 to 4
   pick any, Enter is Next */
/* the explanation: its first sentence bold, five lines, then Read all */
function explainHtml(text) {
  const m = String(text).match(/^(.+?[.!?])(\s+[\s\S]*)?$/), first = m ? m[1] : text, rest = m?.[2] || '';
  return `<p class="os-libexptx${rest.length > 220 ? ' clamp' : ''}">${rest.trim() ? `<b>${esc(first)}</b>${esc(rest)}` : esc(first)}</p>${rest.length > 220 ? '<button class="os-link os-libreadall" data-lib="readall">Read all</button>' : ''}`;
}
function gradesHtml(right, card, t) {
  const b = (g, label, cls = '', small = true) => `<button class="os-btn${cls}" data-lib="grade" data-g="${g}" aria-keyshortcuts="${GRADES.indexOf(g) + 1}"><span>${label}</span>${small ? `<small>in ${esc(preview(card, g, t))}</small>` : ''}</button>`;
  const back = g => `<p class="os-libback">Back in ${esc(preview(card, g, t))}.</p>`;
  return right
    ? `<div class="os-libgrades os-libgrades--right" role="group" aria-label="Next, and how well you knew it">${b('hard', 'Hard')}${b('good', 'Next', ' os-primary os-libnext', false)}${b('easy', 'Easy')}</div>${back('good')}`
    : `<div class="os-libgrades os-libgrades--wrong" role="group" aria-label="Next">${b('again', 'Next', ' os-primary os-libnext', false)}${back('again')}<button class="os-link os-libmisread" data-lib="grade" data-g="good" aria-keyshortcuts="3">I knew it, I misread</button></div>`;
}
/* the tests a question gives results for (its stem and ask; an option's drug is not a result): Normal ranges shows only then */
const labsIn = it => inText(`${it.stem} ${it.ask || ''}`);
/* a tap on an option: in an exam it chooses (in place, until Next); otherwise it answers */
function choose(i) {
  if (V.st.mode !== 'exam') return answer(i);
  if (V.st.pick != null || !V.st.q?.[V.st.i]) return;
  V.st.sel = V.st.sel === i ? null : i;
  panel()?.querySelectorAll('.os-libopt').forEach(b => { const on = +b.dataset.i === V.st.sel; b.classList.toggle('sel', on); b.setAttribute('aria-pressed', String(on)); });
  const nx = panel()?.querySelector('.os-libexamnext'); if (nx) nx.textContent = V.st.sel == null ? 'Skip' : V.st.i + 1 >= V.st.q.length ? 'Finish' : 'Next';
  try { navigator.vibrate?.(6); } catch {}
}
/* Next in an exam: the choice counts (towards your gaps, the month's Wrapped, and the card's next showing: Good if right,
   Again if not), nothing is shown, and the next question comes */
function examNext() {
  const x = V.st.q?.[V.st.i]; if (!x || V.st.mode !== 'exam') return;
  clearInterval(V.st.timer);
  const i = V.st.sel ?? -1, ok = i === x.item.answer, m = api.studyMem(), had = m.card[x.key], fresh = isNew(had);
  record(m, x, ok, now()); if (ok) V.st.right++;
  m.card[x.key] = grade(had, ok ? 'good' : 'again', now(), Math.random);
  if (fresh) { if (m.day.d !== day()) m.day = { d: day(), n: 0 }; m.day.n++; }
  api.saveStudy(m);
  (V.st.picks ||= {})[x.key] = i; V.st.seen.push({ key: x.key, ok });
  V.st.i++; V.st.n++; V.st.sel = null; V.st.x = null;
  saveLive(); paint(); tick();
  const end = !V.st.q[V.st.i]; if (end) arrive();
  panel()?.querySelector(end ? '.os-libdone .os-primary' : '.os-libopt')?.focus({ preventScroll: true });
}
export function strike(i) {
  if (V.st.pick != null || !V.st.q) return;
  const s = V.st.x || (V.st.x = new Set()); s.has(i) ? s.delete(i) : s.add(i);
  const b = panel()?.querySelector(`.os-libopt[data-i="${i}"]`);   /* in place: the line draws across, focus stays */
  b?.classList.toggle('os-libopt--x', s.has(i)); const vh = b?.querySelector('.os-libxvh'); if (vh) vh.textContent = s.has(i) ? 'crossed out' : '';
  try { navigator.vibrate?.(6); } catch {}
}
function answer(i) {
  if (V.st.pick != null) return;
  clearInterval(V.st.timer);
  V.st.pick = i;
  answeredQ(1);   /* the leaderboard's Today (study-log.mjs) */
  const x = V.st.q[V.st.i], m = api.studyMem(), ok = !!x && i === x.item.answer;   /* every answer counts towards your gaps and the month's Wrapped (stats.mjs) */
  V.st.lastOk = ok;
  if (x) { V.st.combo = ok ? (V.st.combo | 0) + 1 : 0; V.st.best = Math.max(V.st.best | 0, V.st.combo); }
  const goal = myPref().goal, before = today(m.days, now(), goal).n;
  if (x) { record(m, x, ok, now()); api.saveStudy(m); if (ok) V.st.right++; }
  if (before < goal && before + 1 >= goal) V.st.celebrate = true;   /* the answer that completes the day's goal */
  paint(); V.st.comboAt = x ? x.key + V.st.i : '';
  try { if (x && i >= 0) navigator.vibrate?.(ok ? 10 : [8, 50, 8]); } catch {}   /* the same frame as the green or the shake (Apple: harmony); phones that buzz */
  if (V.st.celebrate) { V.st.celebrate = false; celebrate(); }
  if (x) othersPicked(x, i);
  panel()?.querySelector(`[data-lib="grade"].os-primary`)?.focus({ preventScroll: true });
  /* a long stem puts the answer below the fold: bring the explanation up, once the Study buddy (when on) has its row,
     so nothing moves after the scroll lands (audit 2026-10-29) */
  const up = () => panel()?.querySelector('.os-libexp')?.scrollIntoView({ block: 'nearest', behavior: reducedMotion() ? 'auto' : 'smooth' });
  if (x && osceGames(ctx.mem).mascot) buddyKit().then(b => b.cheerIn(panel()?.querySelector('.os-libexp'), x.item, ok)).catch(() => {}).then(up);
  else up();
}
/* how everyone answered a bank question (0009_mcq_picks.sql): yours is added, then each option shows its share */
async function othersPicked(x, i) {
  if (!x.key.startsWith('b:') || !accountsOn()) return;
  const qid = x.item.id, at = V.st.i;
  try {
    if (i >= 0) await rpc('mcq_pick', { p_qid: qid, p_choice: i });
    const ns = await rpc('mcq_picks', { p_qid: qid }), total = (Array.isArray(ns) ? ns : []).reduce((a, b) => a + (b | 0), 0);
    if (V.st.i !== at || total < 2) return;
    panel()?.querySelectorAll('.os-libopt').forEach(b => {
      const k = +b.dataset.i, pct = Math.round((100 * ((ns[k] | 0))) / total);
      b.style.setProperty('--pct', `${pct}%`); b.classList.add('os-libopt--pct');
      b.insertAdjacentHTML('beforeend', `<em class="os-libpct">${pct}%</em>`);
    });
    panel()?.querySelector('.os-libopts')?.insertAdjacentHTML('afterend', `<p class="os-libmeta os-libothers">How ${total} students answered</p>`);
  } catch { /* offline: no spread, nothing lost */ }
}
let leaving = false;
import { answered as answeredQ } from './study-log.mjs';
export function rate(g) {
  const x = V.st.q?.[V.st.i]; if (!x || V.st.pick == null || leaving) return;
  /* the card goes out to the left before the next comes in from the right (audit 2026-10-29: it vanished) */
  const card = panel()?.querySelector('.os-libcard');
  if (card && !reducedMotion() && card.animate) {
    leaving = true;
    card.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateX(-28px)' }], { duration: 120, easing: 'cubic-bezier(.4,0,1,1)', fill: 'forwards' })
      .finished.catch(() => {}).then(() => { leaving = false; rateNow(g, x); });
    return;
  }
  rateNow(g, x);
}
function rateNow(g, x) {
  const m = api.studyMem(), had = m.card[x.key], fresh = isNew(had);
  m.card[x.key] = grade(had, g, now(), Math.random);
  if (fresh) { if (m.day.d !== day()) m.day = { d: day(), n: 0 }; m.day.n++; }
  api.saveStudy(m);
  if (soon(m.card[x.key], now()) && V.st.q.length < 200) V.st.q.push(x);   /* a learning step (1 or 10 minutes): once more before the session ends, as Anki does */
  V.st.seen.push({ key: x.key, ok: V.st.lastOk });
  V.st.i++; V.st.pick = null; V.st.n++; V.st.note = false; V.st.x = null;
  saveLive();
  paint(); tick();
  const end = !V.st.q[V.st.i]; if (end) arrive();
  panel()?.querySelector(end ? '.os-libdone .os-primary' : '.os-libopt')?.focus({ preventScroll: true });
}
function toggleFlag() {
  const x = V.st.q?.[V.st.i]; if (!x) return;
  const m = api.studyMem(), c = m.card[x.key] || {};
  m.card[x.key] = { ...c, f: c.f ? 0 : 1 }; api.saveStudy(m);
  const b = panel()?.querySelector('.os-libflag'), on = !!m.card[x.key].f;
  if (b) { b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); b.setAttribute('aria-label', on ? 'Flagged' : 'Flag this question'); }
}
export function saveNote(v) {
  const x = V.st.q?.[V.st.i]; if (!x) return;
  const m = api.studyMem(), c = m.card[x.key] || {}, note = String(v).slice(0, 500).trim();
  m.card[x.key] = { ...c, note }; if (!note) delete m.card[x.key].note; api.saveStudy(m);
}

/* ---------------------------------------------------------------- your gaps (stats.mjs) */
function gapsCardHtml() {
  const s = summary(everything(), api.studyMem().card);
  if (!s.total.n) return '';
  const g = s.gaps[0];
  return `<button class="os-libgaps" data-lib="summary"><span class="os-libgaps-tx"><small>Your summary</small><b>${g ? `Gap: ${esc(g.label)} · ${g.acc}%` : `${s.total.acc}% right over ${plural(s.total.n, 'answer')}`}</b></span><span class="os-chev" aria-hidden="true">${I.chevR}</span></button>`;
}
const bar = (label, x, sub = '') => `<li class="os-libbarrow"><span class="os-libbarl">${esc(label)}${sub ? `<small>${esc(sub)}</small>` : ''}</span><span class="os-libbart" aria-hidden="true"><i style="transform:scaleX(${x.n ? (x.acc / 100).toFixed(3) : 0})" class="${x.acc < 60 ? 'lo' : x.acc < 80 ? 'mid' : 'hi'}"></i></span><span class="os-libbarn">${x.n ? `${x.acc}%` : '–'}</span></li>`;
/* the last 15 weeks, a square a day, darker for more answers (Anki's heatmap, GitHub's grid) */
function heatHtml(days, t) {
  const h = heat(days, t, 15), n = Object.values(days || {}).filter(d => d.n).length;
  return `<figure class="os-libheat" aria-label="Days studied in the last 15 weeks: ${n}">${h.map(col => `<div>${col.map(c => (c ? `<i data-level="${c.level}" title="${c.d}: ${c.n}"></i>` : '<i class="x"></i>')).join('')}</div>`).join('')}<figcaption>${n} day${n === 1 ? '' : 's'} studied · last 15 weeks</figcaption></figure>`;
}
function summaryHtml() {
  const mem = api.studyMem(), s = summary(everything(), mem.card), t = now(), cur = monthOf(t);
  const months = [...new Set(Object.keys(mem.days || {}).map(d => d.slice(0, 7)))].sort().reverse().filter(m => wrapped(mem, m));
  const head = `<div class="os-libsumhead"><button class="os-link" data-lib="sumback">${I.back || '‹'}<span>Study</span></button><h3>Your summary</h3></div>`;
  if (!s.total.n) return `${head}<div class="os-libempty">${icon('reportAnalytics')}<p><strong>No answers yet</strong><br>Study a few cards and this shows where you are strong and where your gaps are.</p></div>`;
  const row = x => `<li class="os-libgap"><div><b>${esc(x.label)}</b><small>${x.acc}% right · ${plural(x.n, 'answer')}</small></div><button class="os-btn" data-lib="gap" data-v="${esc(x.id.includes('|') ? x.id : `${x.id}|`)}">Study this</button></li>`;
  return `${head}
    <div class="os-libbig"><div><b>${s.total.acc}%</b><small>right</small></div><div><b>${s.total.n}</b><small>answers</small></div><div><b>${s.total.seen}</b><small>seen of ${s.total.items.toLocaleString('en-AU')}</small></div></div>
    ${heatHtml(mem.days, t)}
    ${months.length ? `<div class="os-libwraps">${months.slice(0, 3).map(m => `<button class="os-libwrapbtn" data-lib="wrapped" data-m="${m}"${m === cur ? ' data-preview="1"' : ''}>${icon('star')}<span>${esc(monthName(m))}${m === cur ? ' so far' : ''}, wrapped</span></button>`).join('')}</div>` : ''}
    <h3 class="os-libh">Your gaps</h3>
    ${s.gaps.length ? `<ul class="os-libgapl" role="list">${s.gaps.map(row).join('')}</ul>` : (s.total.acc < 70 ? `<p class="os-libmeta">Not enough answers in one place to name a gap yet: three in a specialty does it.</p>` : `<p class="os-libmeta">No gaps: nothing under 70% with three or more answers. Keep going.</p>`)}
    ${s.untouched.length ? `<h3 class="os-libh">Not started</h3><ul class="os-libgapl" role="list">${s.untouched.slice(0, V.st.allNew ? 99 : 3).map(x => `<li class="os-libgap"><div><b>${esc(x.label)}</b><small>${plural(x.items, 'question')} waiting</small></div><button class="os-btn" data-lib="gap" data-v="${esc(x.id)}|">Start</button></li>`).join('')}</ul>${s.untouched.length > 3 && !V.st.allNew ? `<button class="os-link" data-lib="allnew">Show all ${s.untouched.length}</button>` : ''}` : ''}
    ${s.strong.length ? `<h3 class="os-libh">Strongest</h3><ul class="os-libgapl os-libstrong" role="list">${s.strong.map(x => `<li class="os-libgap"><div><b>${esc(x.label)}</b><small>${x.acc}% right · ${plural(x.n, 'answer')}</small></div></li>`).join('')}</ul>` : ''}
    <h3 class="os-libh">By year</h3><ul class="os-libbars" role="list">${s.years.map(x => bar(x.label, x, YEARS[x.id]?.name || '')).join('')}</ul>
    ${s.diffs.length ? `<h3 class="os-libh">By difficulty</h3><ul class="os-libbars" role="list">${s.diffs.map(x => bar(x.label, x)).join('')}</ul>` : ''}
    <h3 class="os-libh">By specialty</h3><ul class="os-libbars" role="list">${s.spec.filter(x => x.n).sort((a, b) => a.acc - b.acc).map(x => bar(x.label, x, plural(x.n, 'answer'))).join('')}</ul>`;
}

/* the summary's big numbers count up on a gentle spring (to the number, never past it) */
function countUp() {
  for (const b of panel()?.querySelectorAll('.os-libbig b') || []) {
    const m = b.textContent.match(/^(\d+)(%?)$/); if (!m || reducedMotion()) continue;
    const to = +m[1]; animate(0, to, { spec: SPRING.gentle, onFrame: v => { b.textContent = `${Math.round(v)}${m[2]}`; } });
  }
}

/* ---------------------------------------------------------------- Study's actions (library-view.mjs act hands them on) */
export async function studyAct(a, b, e) {
  switch (a) {
    case 'allnew': V.st.allNew = true; return paint();
    case 'reportopen': { V.st.report = V.st.q?.[V.st.i]?.key; paint(); return panel()?.querySelector('.os-libreport .os-chip')?.focus({ preventScroll: true }); }
    case 'report': {
      const x = V.st.q?.[V.st.i]; if (!x) return;
      try { await rpc('mcq_report', { p_qid: x.item.id, p_reason: b.dataset.v, p_note: '' }); V.st.reported = x.key; }
      catch { notify('The report did not send. Try again when you are online.', 'danger'); }
      V.st.report = null; return paint();
    }
    case 'studydeck': {   /* a deck's Study studies it (critique: not the Custom form) */
      const d = [...V.lib.decks, ...V.lib.shared].find(x => x.id === b.dataset.deck); if (!d) return;
      const l = api.allItems(V.lib).filter(x => x.deck === d.id), mem = api.studyMem(), p = myPref();
      let q = session(l, mem.card, { order: 'due', size: p.size }, now(), startedToday()); if (!q.length) q = session(l, mem.card, { order: 'shuffle', size: p.size }, now());
      V.tab = 'study'; dlg()?.querySelector('.os-libtabs-ind')?.style.setProperty('--i', tabIdx('study'));
      dlg()?.querySelectorAll('[role="tab"]').forEach(x => { const on = x.dataset.tab === 'study'; x.setAttribute('aria-selected', String(on)); x.tabIndex = on ? 0 : -1; });
      return startWith(q, { label: d.name });
    }
    case 'pick': { V.tap = `${b.dataset.k}:${b.dataset.v}`; V.st[b.dataset.k] = b.dataset.k === 'year' || b.dataset.k === 'diff' ? +b.dataset.v || 0 : b.dataset.v; if (b.dataset.k === 'topic') V.st.cat = ''; return paint(); }
    case 'summary': V.st.view = 'summary'; if (!V.bank) await loadBank(); paint(); arrive(1); countUp(); return panel()?.focus({ preventScroll: true });
    case 'sumback': V.st.view = ''; paint(); return arrive(-1);
    case 'gap': {   /* Study this: that specialty (and kind), from everything you can study, the weakest first */
      const [topic, cat] = String(b.dataset.v).split('|'), mem = api.studyMem();
      const l = everything().filter(x => x.item.topic === topic && (!cat || x.item.cat === cat));
      V.st.view = ''; return startWith(session(l, mem.card, { order: 'shuffle', size: 20 }, now()), { label: topic });
    }
    case 'wrapped': return (await import('./wrapped-view.mjs')).openWrapped(b.dataset.m, { preview: b.dataset.preview === '1' });
    case 'start': { const p = myPref(), mem = api.studyMem(); return startWith(session(studyPool().filter(inStudyPick), mem.card, { which: p.which, order: p.order, size: p.size }, now(), startedToday()), { mode: p.mode, order: p.order }); }
    case 'today': { const p = myPref(), mem = api.studyMem(), all = everything(), plan = examPlan(p.exam, tally(all, mem.card, now()).fresh, now()); V.st.q = null; return startWith(session(all, mem.card, { order: 'due', size: p.size, newADay: plan?.perDay }, now(), startedToday()), { label: 'Today' }); }
    case 'mode': {
      const m = b.dataset.m, mem = api.studyMem(), p = myPref(), all = everything();
      if (m === 'custom') { V.st.view = 'custom'; paint(); arrive(1); return panel()?.focus({ preventScroll: true }); }
      if (m === 'place') { const l = inPlace(all, placementSpecs(ctx.mem)); let q = session(l, mem.card, { order: 'due', size: p.size, newADay: p.size || l.length }, now()); if (!q.length) q = session(l, mem.card, { order: 'shuffle', size: p.size }, now()); return startWith(q, { label: `Rotation: ${placementName(ctx.mem)}` }); }
      if (m === 'smart') return startWith(smart(all, mem.card, now(), 10), { label: 'Smart 10' });
      if (m === 'notebook') { V.st.view = 'notebook'; paint(); arrive(1); return; }
      if (m === 'ladder') return startWith(session(all, mem.card, { order: 'ladder', size: p.size }, now()), { order: 'ladder', label: '0 to 1' });
      if (m === 'incorrect' || m === 'flagged') return startWith(session(all, mem.card, { which: m, order: 'shuffle', size: 0 }, now()), { label: m === 'incorrect' ? 'Got wrong' : 'Flagged' });
      if (m === 'weak') { const g = summary(all, mem.card).gaps[0]; if (!g) return; const [topic, cat] = g.id.split('|'); return startWith(session(all.filter(x => x.item.topic === topic && (!cat || x.item.cat === cat)), mem.card, { order: 'shuffle', size: p.size }, now()), { label: g.label }); }
      return;
    }
    case 'pref': { V.tap = `${b.dataset.k}:${b.dataset.v}`; const k = b.dataset.k, v = ['goal', 'size'].includes(k) ? +b.dataset.v : b.dataset.v; setPref(k, v); return paint(); }
    case 'flag': return toggleFlag();
    case 'resume': { const r = resumable(lsGet(LIVE, null), everything(), now()); if (!r) { lsSet(LIVE, null); return paint(); } startWith(r.q, { mode: r.mode, order: r.order, label: r.label }); Object.assign(V.st, { i: r.i, n: r.n, right: r.right }); paint(); tick(); return; }
    case 'redo': { const by = new Map(V.st.q.map(x => [x.key, x])), l = [...new Set(V.st.seen.filter(s => !s.ok).map(s => s.key))].map(k => by.get(k)).filter(Boolean); return startWith(l, { label: 'Redo' }); }
    case 'notestudy': { const mem = api.studyMem(); V.st.view = ''; return startWith(everything().filter(e => mem.card[e.key]?.note), { label: 'Notebook' }); }
    case 'note': { V.st.note = true; paint(); return panel()?.querySelector('[data-lib-note]')?.focus(); }
    case 'ranges': { const it = V.st.q?.[V.st.i]?.item; if (it) openRanges(`${it.stem} ${it.ask || ''}`); return; }
    case 'opt': return V.st.x?.has(+b.dataset.i) ? strike(+b.dataset.i) : choose(+b.dataset.i);
    case 'examnext': return examNext();
    case 'revgo': { const to = Math.max(0, +b.dataset.v || 0); V.st.rvBack = V.st.rv != null && to < V.st.rv; V.st.rv = to; } paint(); panel()?.scrollTo?.(0, 0); dlg()?.querySelector('.os-dlg-body')?.scrollTo(0, 0); return panel()?.querySelector('.os-librevnav .os-primary')?.focus({ preventScroll: true });
    case 'revend': V.st.rv = null; paint(); return arrive(-1);
    case 'grade': return rate(b.dataset.g);
    case 'endstudy': return endStudy();
  }
}
