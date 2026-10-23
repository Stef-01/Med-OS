/* osce/session.mjs — a station on the clock and its review (plan unit F3, 2026-10-19; from osce.mjs): OscesSession
   (progress ring, Reading then Station countdowns, restart / pause / skip, the tick), StationTabs / Panes (Instructions,
   Patient Script with the exam findings and Part 2 under it, Marking), StationMarking + StationMarkingSheet (checklist with kids and Critical, global impression,
   feedback, guide, explanation), StationAttempts, OscesAttempt (an attempt reviewed), the Next Station and Session
   Complete dialogs, the More menu, and the Highlight tool. The clock's laws (osceStart/Pause/Resume/Next/Tick/Left/
   Finished) and the score are core.mjs; this module owns the attempt records in mem.hist and the session queue index. */
import { esc } from '../core.mjs';
import { wide, fmtDate } from '../study-kit/util.mjs';
import { safeHtml } from '../study-kit/safe.mjs';
import { figureHtml } from '../study-kit/media.mjs';
import { mnemonicsFor } from './mnemonics.mjs';
import { KINDS, HANDOVER, osceScore, osceLeft, osceFinished, osceStart, oscePause, osceResume, osceNext, osceTick, mmss, phasesOf, phaseName, phaseWhat, nextPhase, hasPart2, osceP2Start, osceP2Steps, DDX_TIERS, osceAskLabel, osceVitals, osceFrom, osceAiTicks, osceAiMissed, osceAiQuotes, osceAiFeedback, AI_MAX, osceNextCand } from './core.mjs';
import { ctx, I, GI, GI_C, save, sess, curAttempt, findAttempt, now, body, NOLOAD, bell, notify, confirmDlg, openDialog, closeDialog, openPop, closePop, tagHtml, srcTag, ago, aiEnabled, markerCfg, examOf, nameOf, whoBadge, roleLine, openPresenter, topDialog } from './state.mjs';
import { markDirect, markPromptText, parseReply } from './marker.mjs';
import { candidateLink } from './candidate.mjs';
import { chartFor } from './obs.mjs';
import { obsChartHtml, obsTableHtml, obsZonesHtml } from './obs-chart.mjs';
import { labsHtml } from './labs.mjs';

let tickT = 0, hlOn = false, hlT = 0, lastScroll = {};   /* StationTabs.vue: each tab keeps its scroll position */
let p2Mark = false;   /* Part 2 has started: the next switch to Marking opens at its Part 2 items */

/* ---------------------------------------------------------------- Session (OscesSession.vue) */
export function renderSession(main) {
  const s = sess(), st = ctx.byId.get(s.queue[s.idx]), a = curAttempt(), fin = osceFinished(s.timer);
  const pane = fin && wide();
  const tabs = [...contentTabs(st), ...(pane ? [] : ['Marking'])];
  if (!tabs.includes(ctx.tab)) ctx.tab = tabs[0];
  main.innerHTML = `<div class="os-sess${fin ? ' fin' : ''}${pane ? ' panes' : ''}">
    <div class="os-sbar">${fin ? finishedBar() : timerBar()}</div>
    <div class="os-panes">
      <div class="os-pl">${tabsNav(tabs)}<div class="os-pscroll"><div class="os-pbody">${tabBody(st, a, ctx.tab, { editable: true })}</div></div></div>
      ${pane ? `<div class="os-pr"><div class="os-pbody">${markingHtml(st, a, true)}</div></div>` : ''}
    </div></div>`;
  placePill(main); syncIndeterminate();
  if (!fin) startTick();
}
/* the tabs a station's content fills: the candidate's instructions, then the examiner's script, which runs in the order of
   the clock (the patient's history, the exam findings, then Part 2's results and questions) */
export const contentTabs = st => ['Instructions', ...(st.patient || st.media?.patientScript?.length || examOf(st) || hasPart2(st) ? ['Patient Script'] : [])];
/* what the bell means, said once as the clock moves on */
const phaseNotice = (c, timing) => (c === 'station' ? `Part 1: history and examination · ${timing.station} minutes` : c === 'mx' ? `Part 2: hand over the results · ${timing.mx} minutes` : '');
function timerBar() {
  const t = sess().timer, c = t?.c || 'reading', { timing } = ctx.mem, ps = phasesOf(timing), nx = nextPhase(c, timing);
  return `<div class="os-timer">
    <span class="os-ring${t?.at ? '' : ' paused'}" role="progressbar" aria-valuemin="0" aria-valuemax="100"><svg viewBox="0 0 100 100"><circle class="os-ring-t" r="43" cx="50" cy="50"/><circle class="os-ring-s" r="43" cx="50" cy="50" transform="rotate(-90 50 50)" stroke-linecap="round"/></svg></span>
    <div class="os-tcomps">${ps.map(k => `<div class="os-tc${k === c && t?.at ? '' : ' off'}${k === c ? ' cur' : ''}" data-c="${k}" title="${phaseName(k, true)}"><small>${phaseName(k)}</small><b>${k === c ? mmss(osceLeft(t, now())) : `${ps.indexOf(k) < ps.indexOf(c) ? 0 : timing[k]}:00`}</b></div>`).join('')}</div>
    <div class="os-tctl">
      <button class="os-ic" data-os="restart" aria-label="Restart Station" title="Restart Station">${I.reload}</button>
      <button class="os-ic os-ic--fill" data-os="pp" aria-label="${t?.at ? 'Pause Timer' : 'Start Timer'}" title="${t?.at ? 'Pause Timer' : 'Start Timer'}">${t?.at ? I.pause : I.play}</button>
      <button class="os-ic os-ic--fill" data-os="skip" aria-label="${nx ? `Skip to ${phaseName(nx)}` : 'Finish Station'}" title="${nx ? `Skip to ${phaseName(nx)}` : 'Finish Station'}">${nx ? I.next : I.stop}</button>
    </div></div>`;
}
function finishedBar() {
  const s = sess(), hasNext = s.idx < s.queue.length - 1;
  return `<div class="os-finished"><span class="os-fh">${I.done}<h5>Station Finished</h5></span>
    <button class="os-finbtn" data-os="${hasNext ? 'nextdlg' : 'end'}">${hasNext ? 'Next Station' : 'End Session'}</button></div>`;
}
function paintTimer() {
  const t = sess().timer, bar = ctx.ov.querySelector('.os-timer');
  if (!bar || !t) return;
  const left = osceLeft(t, now()), total = ctx.mem.timing[t.c] * 60, p = Math.min(1, Math.max(0, 1 - left / total));
  const seg = bar.querySelector('.os-ring-s'), C = 43 * 2 * Math.PI;
  seg.setAttribute('stroke-dasharray', `${C * p} ${C}`);
  seg.style.opacity = p ? 1 : 0;
  bar.querySelector('.os-ring').setAttribute('aria-valuenow', Math.round(p * 100));
  const b = bar.querySelector(`.os-tc[data-c="${t.c}"] b`);
  if (b) b.textContent = mmss(left);
  const pt = ctx.ov.querySelector('.os-prs-time');   /* the results on screen cover the clock: the time left rides on them */
  if (pt) { pt.hidden = false; pt.textContent = `${phaseName(t.c)} · ${mmss(left)}`; pt.classList.toggle('low', left <= 60); }
  bar.querySelector('.os-ring').classList.toggle('low', t.c !== 'reading' && !nextPhase(t.c, ctx.mem.timing) && left <= 60);
}
function startTick() {
  stopTick();
  paintTimer();
  tickT = setInterval(tick, 250);
  document.addEventListener('visibilitychange', tick);   /* a hidden tab throttles the interval: catch up the moment it shows */
}
function tick() {
  const s = sess(), { timing } = ctx.mem;
  if (!tickT || !s.timer || ctx.view !== 'session') return;
  const nx = osceTick(s.timer, timing, now());
  if (nx !== s.timer) {
    const was = s.timer.c;
    s.timer = nx; save(); bell();
    if (!nx.at) finishStation(); else { if (was !== nx.c) onPhase(nx.c); paintBar(); }
    return;
  }
  paintTimer();
}
export function stopTick() { clearInterval(tickT); tickT = 0; document.removeEventListener('visibilitychange', tick); }
function paintBar() { const bar = ctx.ov.querySelector('.os-sbar'); if (bar) { bar.innerHTML = timerBar(); paintTimer(); } }
/* the pause / play button */
export function togglePause() { const s = sess(); s.timer = s.timer?.at ? oscePause(s.timer, now()) : osceResume(s.timer, now()); save(); paintBar(); }
/* skip: on to the next phase, or from the last one to finished */
export function skip() {
  const s = sess(); s.timer = osceNext(s.timer, ctx.mem.timing, now()); save(); bell();
  if (!s.timer.at) return finishStation();
  onPhase(s.timer.c); paintBar();
}
/* a new phase: say so; at Part 2 the patient script opens at its questions and results, just below the exam findings, and
   the marking sheet will open at its Part 2 items */
function onPhase(c) {
  notify(phaseNotice(c, ctx.mem.timing));
  const st = ctx.byId.get(sess().queue[sess().idx]);
  if (c !== 'mx' || !hasPart2(st)) return;
  p2Mark = true;
  if (ctx.tab !== 'Patient Script') switchTab('Patient Script');
  requestAnimationFrame(() => ctx.ov.querySelector('.os-pl .os-part2')?.scrollIntoView({ block: 'start', behavior: 'smooth' }));
}
function finishStation() {
  p2Mark = false;
  const a = curAttempt();
  if (a && !a.fin) a.fin = now();
  if (a && !sess().done.includes(a.id)) sess().done.push(a.id);
  save();
  ctx.tab = wide() ? 'Instructions' : 'Marking';
  stopTick();
  ctx.render();
  ctx.ov.querySelector('.os-finished')?.classList.add('os-pop-in');
}
export async function startAttempt(idx) {
  const s = sess(), sid = s.queue[idx], { mem } = ctx;
  try { await body(sid); } catch { return notify(NOLOAD, 'danger'); }
  if (!ctx.isOpen || sess() !== s) return;
  if (s.queue[idx + 1]) body(s.queue[idx + 1]).catch(() => {});   /* the next station's body, ahead of the clock */
  /* an unfinished attempt being replaced (restart) is dropped */
  const old = curAttempt();
  if (old && !old.fin) mem.hist[old.sid] = (mem.hist[old.sid] || []).filter(x => x !== old);
  const a = { id: `a${now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, sid, who: s.cand === 1 ? 1 : 0, at: now(), fin: null, ticks: [], global: null, fb: '', notes: '' };
  (mem.hist[sid] ||= []).push(a);
  Object.assign(s, { idx, aid: a.id, timer: osceStart(mem.timing, now()) });
  s.done = s.done.filter(x => x !== a.id);
  save();
  lastScroll = {}; p2Mark = false;
  ctx.tab = 'Instructions';
  ctx.view = 'session';
  bell();
  ctx.render();
}
export async function endSession(skipConfirm) {
  const s = sess(), { mem } = ctx;
  const fin = osceFinished(s.timer);
  if (s.idx != null && !fin && !skipConfirm) {
    if (!await confirmDlg({ title: 'Are you sure you want to end the session?', confirm: 'End Session' })) return;
  }
  const a = curAttempt();
  if (a && !a.fin) mem.hist[a.sid] = (mem.hist[a.sid] || []).filter(x => x !== a);
  const results = (s.done || []).map(findAttempt).filter(Boolean);
  s.queue = s.idx == null ? s.queue : s.queue.slice(s.idx + (fin ? 1 : 0));
  Object.assign(s, { idx: null, aid: null, timer: null, done: [] });
  save();
  ctx.view = 'group';
  ctx.render();
  if (results.length) resultsDlg(results);
}

/* ---------------------------------------------------------------- tabs + station content (StationTabs / Instructions / Script) */
export function tabsNav(tabs, cls = '') {
  if (tabs.length < 2) return '';
  return `<div class="os-tabs ${cls}"><nav role="tablist">${tabs.map(t => `<button role="tab" data-os="tab" data-tab="${t}" aria-selected="${t === ctx.tab}">${t}</button>`).join('')}<span class="os-pill" aria-hidden="true"></span></nav></div>`;
}
export function placePill(root, animate) {
  root.querySelectorAll('.os-tabs nav').forEach(nav => {
    const on = nav.querySelector('[aria-selected="true"]'), pill = nav.querySelector('.os-pill');
    if (!on || !pill) return;
    if (!animate) pill.style.transition = 'none';
    pill.style.width = `${on.offsetWidth}px`;
    pill.style.transform = `translateX(${on.offsetLeft}px)`;
    if (!animate) { void pill.offsetWidth; pill.style.transition = ''; }
  });
}
/* where an imported case came from: the AMSA MedEd case it was converted from, and what AI added to it */
export const provHtml = st => (osceFrom(st) === 'amsa' ? `<p class="os-prov"><span class="os-tag os-tag--amsa">AMSA</span><span>Case from the AMSA MedEd OSCE library${st.source?.title ? `: ${st.source.url ? `<a href="${esc(st.source.url)}" target="_blank" rel="noopener noreferrer">${esc(st.source.title)}</a>` : esc(st.source.title)}` : ''}. AI turned it into this station and wrote what the source left out: the patient's words, the exam findings, the results and the examiner's questions.</span></p>` : '');
const imgs = list => (list || []).map(figureHtml).join('');   /* each image with its caption and credit (study-kit/media.mjs) */
export function tabBody(st, a, t, o = {}) {
  if (t === 'Patient Script') return scriptHtml(st, a, o);
  if (a && a.hl?.[t] && t === 'Instructions') return `<div class="os-sheet" data-hl="${t}">${a.hl[t]}</div>${o.editable ? toolbar() : ''}`;
  if (t === 'Instructions') {
    return `<div class="os-sheet" data-hl="Instructions"><h2>Instructions to Candidate</h2><div class="os-html">${safeHtml(st.stem)}</div>${imgs(st.media?.stem)}
      ${formatHtml()}
      ${st.tasks.length ? `<h3>Tasks</h3><ol class="os-tasks" role="list">${st.tasks.map((x, i) => `<li><span class="os-tn">${i + 1}</span><div class="os-html">${safeHtml(x)}</div></li>`).join('')}</ol>` : ''}
      </div>${provHtml(st)}${a && o.editable ? toolbar() : ''}`;
  }
  if (t === 'Marking') return `<div class="os-sheet">${markingHtml(st, a, !!o.editable)}</div>`;
  return attemptsHtml(st);
}
/* the examiner's script in the order of the clock: the patient's history, then the exam findings (Part 1), then Part 2's
   line to say, results to show and questions to ask, each its own card. Only the history is highlightable, so a
   highlight never stores the findings or the results */
function scriptHtml(st, a, o) {
  const t = 'Patient Script', script = a?.hl?.[t] || (st.patient || st.media?.patientScript?.length ? `<h2>Patient Script</h2><div class="os-html">${safeHtml(st.patient)}</div>${imgs(st.media?.patientScript)}` : '');
  const parts = [script && ['hx', 'History'], examOf(st) && ['ex', 'Exam'], st.ddx?.length && ['dd', 'Differentials'], hasPart2(st) && ['p2', 'Part 2']].filter(Boolean);
  return `${parts.length > 1 ? `<nav class="os-jump" aria-label="Jump to">${parts.map(([k, l], i) => `<button data-os="jump" data-to="${k}"${i ? '' : ' aria-current="true"'}>${l}</button>`).join('')}</nav>` : ''}${script ? `<div class="os-sheet" data-hl="${t}">${script}</div>` : ''}${examHtml(examOf(st), st.id)}${ddxHtml(st)}${qaHtml(st)}${a && o.editable ? toolbar() : ''}`;
}
/* the reasonable differentials, in the script where the examiner needs them: in the history (credit the questions that
   rule each one in or out) and at the differentials question (credit each one named with a reason). The leading diagnosis
   first, then the others a candidate may fairly offer, then the must-not-miss ones, each with this patient's features */
export function ddxHtml(st, o = {}) {
  const dd = st.ddx || []; if (!dd.length) return '';
  const row = d => `<li class="os-dd os-dd--${d.tier}"><div class="os-ddtop"><small class="os-ddtier">${DDX_TIERS[d.tier]}</small><strong>${esc(d.dx)}</strong></div>${o.compact ? '' : `${d.for ? `<p><b>For</b> ${esc(d.for)}</p>` : ''}${d.against ? `<p><b>Against</b> ${esc(d.against)}</p>` : ''}`}</li>`;
  return o.compact
    ? `<div class="os-ddx os-ddx--compact"><small>Reasonable differentials: credit any named with a reason</small><ul role="list">${dd.map(row).join('')}</ul></div>`
    : `<section class="os-ddx" aria-labelledby="os-ddx-h"><header class="os-ddhead"><strong id="os-ddx-h">Reasonable differentials</strong><small>Credit the candidate for exploring these in the history and for naming them, with a reason, in Part 2</small></header><ul role="list">${dd.map(row).join('')}</ul></section>`;
}
/* the jump bar: a tap scrolls to its part; scrolling lights the part in view */
const PARTS = { hx: '.os-sheet[data-hl]', ex: '.os-exam', dd: '.os-ddx', p2: '.os-part2' };
export function jumpTo(b) { b.closest('.os-pbody')?.querySelector(PARTS[b.dataset.to])?.scrollIntoView({ block: 'start', behavior: 'smooth' }); }
export function syncJump(sc) {
  const nav = sc?.querySelector?.('.os-jump'); if (!nav) return;
  const line = nav.getBoundingClientRect().bottom + 40, btns = [...nav.querySelectorAll('[data-os="jump"]')];
  const on = btns.filter(x => { const e = sc.querySelector(PARTS[x.dataset.to]); return e && e.getBoundingClientRect().top <= line; }).pop() || btns[0];
  btns.forEach(x => (x === on ? x.setAttribute('aria-current', 'true') : x.removeAttribute('aria-current')));
}
/* Mark Part 2: the marking sheet at its first Part 2 heading, in its own tab or in the pane beside the script */
export function markPart2(b) {
  const root = b.closest('.os-pv, .os-sess') || ctx.ov, tab = root.querySelector('[data-tab="Marking"]');
  if (tab && tab.getAttribute('aria-selected') !== 'true') { tab.click(); tab.focus({ preventScroll: true }); }   /* the button goes with the pane it sat in: focus stays in the view, on its tab */
  requestAnimationFrame(() => root.querySelector('.os-h-p2')?.scrollIntoView({ block: 'start', behavior: 'smooth' }));
}
/* the station's shape, from the timing in use: Reading 5 · Part 1 10 · Part 2 5 */
export function formatHtml(timing = ctx.mem.timing) {
  const ks = phasesOf(timing);   /* a timeline: each phase as wide as its minutes, then what each is for */
  return `<div class="os-fmt" role="group" aria-label="Station format"><ol class="os-format" role="list" style="grid-template-columns:${ks.map(k => `${Math.max(1, timing[k])}fr`).join(' ')}">${ks.map(k => `<li class="os-f-${k}"><small>${phaseName(k)}</small><b>${timing[k]} min</b></li>`).join('')}</ol>
    <ul class="os-format-what" role="list">${ks.map(k => `<li><b>${phaseName(k)}</b><span>${phaseWhat(k)}</span></li>`).join('')}</ul></div>`;
}
/* Part 2's results as slides: each handover result, then each Part 2 image (labelled by its alt text, which never names
   the diagnosis; the caption is the examiner's note and stays off the candidate's view) */
/* each Part 2 result as the candidate sees it: observations drawn on the patient's chart (or written out when there is
   no chart for them), everything else as handed over; `h` keeps the source for the examiner's card */
/* a lab table's abnormal rows, as a pathology report prints them: a cell that is only a flag (H, L, HH, LL, ↑, ↓) or ends in
   one after a number marks its row high or low and the flag becomes a badge. On sanitised HTML, whose cells carry no
   attributes; anything that is not a plain flag is left as it is */
const FLAG = /^(?:(.*\d.*?)\s+)?\(?(HH|LL|H|L|↑|↓)\)?$/;
export function flagHtml(html) {
  return String(html).replace(/<tr>([\s\S]*?)<\/tr>/g, (row, inner) => {
    let dir = '';
    const cells = inner.replace(/<td>([^<]*)<\/td>/g, (cell, txt) => {
      const m = txt.trim().match(FLAG); if (!m || (!m[1] && txt.trim().length > 4)) return cell;
      const f = m[2], hi = /H|↑/.test(f); dir ||= hi ? 'hi' : 'lo';
      return `<td>${m[1] ? `${m[1]} ` : ''}<b class="os-flag os-flag-${hi ? 'h' : 'l'}">${f}</b></td>`;
    });
    return dir ? `<tr class="os-${dir}">${cells}</tr>` : row;
  });
}
export function qaSlides(st) {
  const p = st.part2 || { handover: [] }, chart = chartFor(st.demo).id;
  const note = h => (h.result ? `<div class="os-html${h.obs ? ' os-obs-note' : ''}">${flagHtml(safeHtml(h.result))}</div>` : '');
  return [...p.handover.map(h => ({ label: h.label, h, html: h.obs ? `${(chart && obsChartHtml(chart, h.obs, { label: h.label })) || obsTableHtml(h.obs)}${note(h)}` : `${labsHtml(h.labs, { label: h.label })}${note(h)}` })),
    ...(st.media?.part2 || []).map(m => ({ label: m.alt || 'Image', html: figureHtml({ ...m, caption: '' }) }))];
}
/* the examiner's card for one result: observations compact (the table, then what the zones call for at each time), any
   other result as handed over; then the model interpretation, one tap away and never on the candidate's screen */
function qaCardBody(st, x) {
  const h = x.h; if (!h) return x.html;
  const ch = chartFor(st.demo);
  const shown = h.obs ? `${obsTableHtml(h.obs)}${h.result ? `<div class="os-html os-obs-note">${safeHtml(h.result)}</div>` : ''}<p class="os-obs-on">${esc(ch.short)}</p>` : x.html;
  const zones = h.obs && ch.id ? obsZonesHtml(ch.id, h.obs) : '';
  return `${shown}${zones || h.model ? `<details class="os-model"><summary>${I.check}<span>Model answer</span></summary>${zones ? `<div class="os-model-z"><small>The chart calls for</small>${zones}</div>` : ''}${h.model ? `<div class="os-html">${safeHtml(h.model)}</div>` : ''}</details>` : ''}`;
}
/* the candidate's phone in Part 2: the results, nothing of the examiner's */
export function part2Html(st) {
  const slides = qaSlides(st);
  return `<div class="os-sheet os-p2"><h2>Results from the examiner</h2><ul class="os-p2list" role="list">${slides.map(x => `<li><strong>${esc(x.label)}</strong>${x.html}</li>`).join('')}</ul></div>`;
}
/* Part 2 under the patient script, run the way a pair runs it with one laptop (2026-10-23, founder: "show the results,
   then move to the next question, then order a new test and show the new result"). The examiner steps through it:
   Results (what to say, Turn the screen, each result with its model answer), then each question in the order it is
   asked (ISBAR handover, differentials, management, follow-up), one at a time, with its expected answer and a chip per
   result to turn the screen to when the candidate asks for it again or orders it. A chip once shown carries a tick.
   "All on one page" lays the whole of Part 2 out at once, for reading a station before running it */
const p2 = new Map();   /* per station and attempt: { n: the step on screen, seen: the results the candidate has seen } */
export const p2State = sid => p2s(sid);
const p2s = sid => { const k = `${sid}:${ctx.view === 'session' ? sess().aid || '' : ''}`; if (!p2.has(k)) p2.set(k, { n: 0, seen: new Set() }); return p2.get(k); };
export function qaHtml(st) {
  if (!hasPart2(st)) return '';
  const p = st.part2, slides = qaSlides(st), m = ctx.mem?.timing?.mx, sid = esc(st.id), steps = osceP2Steps(p), flat = !!ctx.mem?.p2flat || steps.length < 2;
  const s = p2s(st.id), n = Math.min(s.n, steps.length - 1), mark = osceP2Start(st.check) != null;
  const markBtn = cls => (mark ? `<button class="os-btn ${cls}" data-os="markp2">${I.check}<span>Mark Part 2</span></button>` : '');
  const results = slides.length ? `<div class="os-qares"><h4>Results</h4><ul class="os-p2list" role="list">${slides.map((x, i) => `<li class="os-qacard">
      <div class="os-qatop"><span class="os-qalab">${x.h?.kind && KINDS[x.h.kind] ? `<small class="os-kind os-kind--${esc(x.h.kind)}">${esc(KINDS[x.h.kind])}</small>` : ''}<strong>${esc(x.label)}</strong></span><button class="os-ic os-ic--sm" data-os="present" data-sid="${sid}" data-i="${i}" aria-label="Show ${esc(x.label)} to the candidate" title="Show the candidate">${I.max}</button></div>${qaCardBody(st, x)}</li>`).join('')}</ul></div>` : '';
  const resStep = `${p.lead ? `<div class="os-p2lead"><small>Say</small><p>“${esc(p.lead)}”</p></div>` : ''}
    ${slides.length ? `<button class="os-btn os-btn--lg os-primary os-qashow" data-os="present" data-sid="${sid}" data-i="0">${I.max}<span>Turn the screen: show the results</span></button>` : ''}
    ${p.patient ? `<div class="os-p2lead os-p2pt"><small>As the patient</small><div class="os-html">${safeHtml(p.patient)}</div></div>` : ''}
    ${markBtn('os-p2mark')}${results}`;
  const exp = i => (p.expect?.[i] ? `<div class="os-qaexp"><small>Expected answer</small><div class="os-html">${safeHtml(p.expect[i])}</div></div>` : '');
  const chips = i => (slides.length ? `<div class="os-p2show"><small>Turn the screen to a result when the candidate asks for it</small><div class="os-p2chips">${slides.map((x, j) => `<button class="os-p2chip${s.seen.has(j) ? ' seen' : ''}" data-os="present" data-sid="${sid}" data-i="${j}" data-q="${i}">${s.seen.has(j) ? I.check : I.max}<span>${esc(x.label)}</span></button>`).join('')}</div></div>` : '');
  const qStep = i => `<div class="os-p2q"><small class="os-p2eye">Question ${i + 1} of ${p.ask.length} · ${esc(osceAskLabel(p.ask[i], i))}</small><p class="os-qaq">“${esc(p.ask[i])}”</p>${osceAskLabel(p.ask[i], i) === 'Differentials' ? ddxHtml(st, { compact: true }) : ''}${exp(i)}${chips(i)}</div>`;
  const go = (j, label, cls = '', ic = '') => `<button class="os-btn ${cls}" data-os="p2step" data-sid="${sid}" data-n="${j}">${ic}<span>${label}</span>${cls ? I.chevR : ''}</button>`;
  const foot = `<div class="os-p2foot">${n ? go(n - 1, 'Back', '', I.prev) : '<span></span>'}${n < steps.length - 1 ? go(n + 1, n ? 'Next question' : 'Ask the first question', 'os-primary') : markBtn('os-primary')}</div>`;
  const body = flat
    ? `${resStep}${p.ask.length ? `<div class="os-qaask"><h4>Examiner questions</h4><ol>${p.ask.map((q, i) => `<li><p class="os-qaq">“${esc(q)}”</p>${exp(i)}</li>`).join('')}</ol></div>` : ''}`
    : `${n ? qStep(n - 1) : resStep}${foot}`;
  return `<section class="os-part2" data-sid="${sid}" aria-labelledby="os-qa-h">
    <header class="os-qahead"><span class="os-bigic">${I.max}</span><span class="os-handt"><strong id="os-qa-h">Part 2 · questions and results</strong>
      <small>Interpretation, management and safety netting${m ? ` · ${m} minutes` : ''}</small></span>${steps.length > 1 ? `<button class="os-link os-p2flat" data-os="p2flat" data-sid="${sid}" aria-pressed="${flat}">${flat ? 'Step through' : 'All on one page'}</button>` : ''}</header>
    ${flat ? '' : `<ol class="os-p2steps" role="list" aria-label="Part 2 steps">${steps.map((x, j) => `<li><button data-os="p2step" data-sid="${sid}" data-n="${j}"${j === n ? ' aria-current="step"' : ''}${j < n ? ' class="done"' : ''}><b>${j || '•'}</b><span>${esc(x.label)}</span></button></li>`).join('')}</ol>`}
    <div class="os-p2body">${body}</div>
  </section>`;
}
/* a step of Part 2: repaint it in place and bring its top into view (Next sits at the bottom of a long step) */
export function p2Go(sid, n) {
  const st = ctx.byId.get(sid); if (!st) return;
  p2s(sid).n = Math.max(0, n);
  const sel = `.os-part2[data-sid="${CSS.escape(sid)}"]`;
  ctx.ov.querySelectorAll(sel).forEach(el => { el.outerHTML = qaHtml(st); });
  const el = ctx.ov.querySelector(`.os-pl ${sel}`) || ctx.ov.querySelector(sel);
  const bar = el?.querySelector('.os-p2steps') || el, top = bar?.getBoundingClientRect().top;
  if (bar && (top < 0 || top > innerHeight / 3)) bar.scrollIntoView({ block: 'start' });   /* at once: the question is what the examiner reads next */
  el?.querySelector('[aria-current="step"]')?.focus({ preventScroll: true });
}
export function p2Flat(sid) { ctx.mem.p2flat = !ctx.mem.p2flat; save(); p2Go(sid, p2s(sid).n); }
/* the exam's numbers the candidate asks to see in Part 1: the vitals as a grid, the bedside tests as a table */
export function examSlides(x) {
  if (!x) return [];
  return [x.vitals && { label: 'Vital signs', html: `<dl class="os-vitals">${osceVitals(x.vitals).map(([k, v]) => `<div>${k ? `<dt>${esc(k)}</dt>` : ''}<dd>${esc(v)}</dd></div>`).join('')}</dl>` },
    x.bedside?.length && { label: 'Bedside tests', html: `<div class="os-html"><table><tbody>${x.bedside.map(b => `<tr><th>${esc(b.test)}</th><td>${esc(b.find)}</td></tr>`).join('')}</tbody></table></div>` }].filter(Boolean);
}
/* the candidate's view: full screen and opaque, so the laptop can be turned round with nothing of the script, the rubric
   or the expected answers on it. It says who it is for, carries the question being asked when it was opened from one,
   moves through the results (Previous / Next, the arrow keys or a swipe) and hands back with one big button */
let pres = null;   /* { sid, exam, slides, i } while open */
export function present(sid, i = 0, o = {}) {
  const st = ctx.byId.get(sid); if (!st) return;
  const exam = o.set === 'exam', slides = exam ? examSlides(examOf(st)) : qaSlides(st); if (!slides.length) return;
  const q = !exam && o.q != null && o.q !== '' ? st.part2?.ask?.[+o.q] || '' : '';
  pres = { sid, exam, slides, i: Math.max(0, Math.min(slides.length - 1, i)) };
  const d = openPresenter(`<div class="os-prs"><div class="os-prs-top"><span class="os-prs-who">For the candidate</span><span class="os-prs-n" aria-live="polite"></span><span class="os-prs-time" hidden></span><button class="os-ic os-prs-x" data-ui="close" aria-label="Turn back to the examiner">${I.x}</button></div>
    ${q ? `<p class="os-prs-q"><small>The examiner asks</small>“${esc(q)}”</p>` : ''}
    <div class="os-prs-stage"></div>
    <div class="os-prs-nav"><button class="os-btn os-btn--lg os-prs-step" data-os="pprev" aria-label="Previous result">${I.prev}<span>Previous</span></button><button class="os-btn os-btn--lg os-primary os-prs-back" data-ui="close">${I.back}<span>Turn back to the examiner</span></button><button class="os-btn os-btn--lg os-prs-step" data-os="pnext" aria-label="Next result"><span>Next</span>${I.chevR}</button></div></div>`, () => { pres = null; });   /* the inner box fills the layer, so a tap never lands on the layer itself (which would close it) */
  let x0 = null;
  const stage = d.el.querySelector('.os-prs-stage');
  stage.addEventListener('pointerdown', e => { x0 = e.clientX; });
  stage.addEventListener('pointerup', e => { if (x0 != null && Math.abs(e.clientX - x0) > 60) presentStep(e.clientX < x0 ? 1 : -1); x0 = null; });
  paintPresenter();
  if (ctx.view === 'session') paintTimer();   /* on the clock: the time left shows at once */
}
export function presentStep(dir) { if (!pres) return; const n = pres.i + dir; if (n < 0 || n >= pres.slides.length) return; pres.i = n; paintPresenter(); }
export const presenting = () => !!pres && topDialog()?.kind === 'present';
function paintPresenter() {
  const d = topDialog(); if (!pres || !d || d.kind !== 'present') return;
  const { slides, i, sid, exam } = pres, x = slides[i], many = slides.length > 1;
  d.el.querySelector('.os-prs-n').textContent = many ? `${i + 1} of ${slides.length}` : '';
  d.el.querySelector('.os-prs-stage').innerHTML = `<div class="os-prs-slide"><h2>${esc(x.label)}</h2>${x.html}</div>`;
  d.el.querySelector('[data-os="pprev"]').disabled = i === 0;
  d.el.querySelector('[data-os="pnext"]').disabled = i === slides.length - 1;
  d.el.querySelectorAll('.os-prs-step').forEach(b => { b.hidden = !many; });
  if (exam) return;
  p2s(sid).seen.add(i);   /* the examiner's chip for this result gets its tick, under the layer, so focus still returns to it */
  ctx.ov.querySelectorAll(`.os-part2[data-sid="${CSS.escape(sid)}"] .os-p2chip[data-i="${i}"]:not(.seen)`).forEach(b => { b.classList.add('seen'); const ic = b.querySelector('svg'); if (ic) ic.outerHTML = I.check; });
}
/* Exam mode (2026-10-22, founder: "a clear separate section, as this has been invented from the original eMedici content"):
   the AI-written findings in their own box under the patient's history, labelled as such; each step is closed until tapped, so the candidate says what
   they would do before seeing what they find */
function examHtml(x, id) {
  if (!x) return '';
  const sid = esc(id), shows = examSlides(x).map(y => y.label), show = l => (shows.includes(l) ? `<button class="os-ic os-ic--sm os-exshow" data-os="present" data-set="exam" data-sid="${sid}" data-i="${shows.indexOf(l)}" aria-label="Show the ${l.toLowerCase()} to the candidate" title="Show the candidate">${I.max}</button>` : '');
  const step = (s, i) => `<li><details class="os-exstep"><summary><span class="os-exn">${i + 1}</span><span class="os-exa"><strong>${esc(s.area)}</strong>${s.do ? `<small>${esc(s.do)}</small>` : ''}</span>${I.chevD}</summary><p>${esc(s.find)}</p></details></li>`;
  return `<section class="os-exam" aria-labelledby="os-exam-h">
    <header class="os-exhead"><span class="os-bigic">${I.check}</span><span class="os-handt"><strong id="os-exam-h">Exam mode</strong><small>As the candidate examines each area, tap it and give what they find</small></span></header>
    <p class="os-exwarn"><b>AI-written</b> These findings were invented to fit this case.</p>
    ${x.vitals ? `<div class="os-exbox"><h4>Vitals${show('Vital signs')}</h4><p>${esc(x.vitals)}</p></div>` : ''}
    ${x.general ? `<div class="os-exbox"><h4>General inspection</h4><p>${esc(x.general)}</p></div>` : ''}
    <div class="os-exrow"><h4>Examination</h4><button class="os-link" data-os="examall">Reveal all</button></div>
    <ol class="os-exsteps" role="list">${(x.steps || []).map(step).join('')}</ol>
    ${x.bedside?.length ? `<div class="os-exbox"><h4>Bedside tests${show('Bedside tests')}</h4><ul role="list" class="os-exbed">${x.bedside.map(b => `<li><b>${esc(b.test)}</b><span>${esc(b.find)}</span></li>`).join('')}</ul></div>` : ''}
    ${x.key ? `<details class="os-exstep os-exkey"><summary><span class="os-exa"><strong>Findings that matter</strong></span>${I.chevD}</summary><p>${esc(x.key)}</p></details>` : ''}
  </section>`;
}
const toolbar = () => { const a = curAttempt(); return `<div class="os-btool"><label class="os-np1"><textarea data-np="notes" rows="1" placeholder="Notepad">${esc(a?.notes || '')}</textarea></label>
  <button class="os-hlbtn${hlOn ? ' on' : ''}" data-os="hl" aria-pressed="${hlOn}">${I.marker}Highlight</button>
  ${a?.hl?.[ctx.tab] ? '<button class="os-link" data-os="hlclear">Clear</button>' : ''}</div>`; };
const notepad = (k, v, ph) => `<label class="os-notepad${v ? ' filled' : ''}">${I.note}<textarea data-np="${k}" rows="${v ? 3 : k === 'fb' ? 2 : 1}" placeholder="${esc(ph)}">${esc(v || '')}</textarea></label>`;
/* the tab strip on the clock or in a review: swap the pane in place */
export function switchTab(t) {
  const pl = ctx.ov.querySelector('.os-pl'), sc = pl.querySelector('.os-pscroll');
  lastScroll[`${ctx.view}:${ctx.tab}`] = sc.scrollTop;
  ctx.tab = t;
  const s = ctx.view === 'session' ? sess() : null, st = s ? ctx.byId.get(s.queue[s.idx]) : ctx.byId.get(findAttempt(ctx.reviewId)?.sid);
  pl.querySelectorAll('[data-os="tab"]').forEach(x => x.setAttribute('aria-selected', String(x.dataset.tab === t)));
  const pane = pl.querySelector('.os-pbody');
  pane.innerHTML = tabBody(st, ctx.view === 'session' ? curAttempt() : findAttempt(ctx.reviewId), t, { editable: ctx.view === 'session' });
  pane.classList.remove('os-fade'); void pane.offsetWidth; pane.classList.add('os-fade');
  sc.scrollTop = lastScroll[`${ctx.view}:${t}`] || 0; syncIndeterminate();
  const h = t === 'Marking' && p2Mark && pane.querySelector('.os-h-p2');
  if (h) { p2Mark = false; sc.scrollTop += h.getBoundingClientRect().top - sc.getBoundingClientRect().top - 12; }
  syncJump(sc);
  placePill(pl, true);
}

/* StationMarking.vue + StationMarkingSheet.vue: info notice, checklist, global impression, feedback, guide, explanation */
export function markingHtml(st, a, editable) {
  const on = new Set((a?.ticks || []).map(String)), dis = editable ? '' : ' disabled';
  const showFb = !a || a.fin;
  const sc = osceScore(st.check, a?.ticks);
  const q = a?.ai?.status === 'done' && a.ai.result ? osceAiQuotes(a.ai.result.items) : null;   /* "said: …" under each AI-ticked item (the Evidence chip shows them) */
  const p2 = osceP2Start(st.check);
  return `<div class="os-marking${q && evid ? ' os-ai-evid' : ''}">
    ${a && !editable ? '' : '<h2>Marking Sheet</h2>'}
    <div class="os-notice">${I.info}<div><h5>Marking Sheet Provided for Information Only</h5><p>Please note that the marking checklist provided below is intended as a prompt for you to consider key areas in this station. It is not exhaustive. It does not equate to an assessment of competency and therefore no 'pass mark' is provided.</p></div></div>
    ${a && a.fin ? aiHtml(st, a) : ''}
    ${a && a.fin ? handHtml(a) : ''}
    ${a ? `<div class="os-tally"><b>${sc.got}</b> of ${sc.of} items ticked</div>` : ''}
    <div class="os-check">${st.check.map(i => checkItem(i, on, dis, q, p2)).join('')}
      <h3>Global impression</h3>
      <div class="os-gi" role="radiogroup" aria-label="Global impression">${GI.map((l, n) => `<label class="os-gil c-${GI_C[n]}"><input type="radio" name="gi-${esc(a?.id || 'p')}" value="${n}" data-gi${a?.global === n ? ' checked' : ''}${dis}><span>${l}</span></label>`).join('')}</div>
    </div>
    ${editable && a ? notepad('fb', a.fb, 'Written feedback for the candidate') : (a?.fb ? `<div class="os-fb">${esc(a.fb)}</div>` : '')}
    ${st.guide ? `<div class="os-html os-guide">${safeHtml(st.guide)}</div>` : ''}
    ${showFb ? feedbackHtml(st) : ''}
    ${memHtml(st)}
  </div>`;
}
const crit = c => (c ? `<span class="os-crit">${I.info}Critical</span>` : '');
const said = (q, key) => (q && q[key] ? `<small class="os-said">said: “${esc(q[key])}”</small>` : '');
function checkItem(i, on, dis, q, p2) {
  if (i.t === 'heading') return `<h3${i.id === p2 ? ' class="os-h-p2"' : ''}>${safeHtml(i.x)}</h3>`;   /* Part 2 starts here: Mark Part 2 and the Part 2 bell land on it */
  if (i.t === 'info') return `<div class="os-notice os-notice--sm">${I.info}<div class="os-html">${safeHtml(i.x)}</div></div>`;
  if (i.t === 'media') return `<div class="os-cmedia"><div class="os-html">${safeHtml(i.x)}</div>${imgs(i.media)}</div>`;
  const kids = (i.kids || []).filter(k => k.t === 'checkbox' || !k.t);
  const n = kids.filter(k => on.has(`${i.id}.${k.id}`)).length;
  const checked = kids.length ? n === kids.length : on.has(String(i.id));
  const ind = kids.length && n > 0 && n < kids.length;
  return `<div class="os-cbi${i.d || kids.length ? ' has' : ''}"><label class="os-cb os-cb--p"><input type="checkbox" data-tick="${esc(String(i.id))}"${kids.length ? ` data-parent="${kids.map(k => `${i.id}.${k.id}`).join(' ')}"` : ''}${checked ? ' checked' : ''}${ind ? ' data-ind="1"' : ''}${dis}><span class="os-html">${safeHtml(i.x)}${crit(i.crit)}${kids.length ? '' : said(q, String(i.id))}</span></label>
    ${i.d ? `<div class="os-cdesc os-html">${safeHtml(i.d)}</div>` : ''}${imgs(i.media)}
    ${kids.length ? `<div class="os-kids">${kids.map(k => `<label class="os-cb os-cb--k"><input type="checkbox" data-tick="${esc(`${i.id}.${k.id}`)}" data-of="${esc(String(i.id))}"${on.has(`${i.id}.${k.id}`) ? ' checked' : ''}${dis}><span class="os-html">${safeHtml(k.x)}${crit(k.crit)}${k.d ? `<span class="os-cdesc">${safeHtml(k.d)}</span>` : ''}${said(q, `${i.id}.${k.id}`)}</span></label>`).join('')}</div>` : ''}</div>`;
}
export function syncIndeterminate() { ctx.ov.querySelectorAll('[data-ind]').forEach(x => { x.indeterminate = true; }); }
/* ---------------------------------------------------------------- AI marking (2026-10-19; Stefan: "copy paste a transcript recording
   that is text and then AI will mark … later on, when a routine process is run"). On a finished attempt the marking sheet
   grows a fold: paste the transcript, Send → one pending row in optimus_osce_marking and `a.ai = {reqId, status, at}` on
   the attempt (save() → every device). The fleet's hourly osce_marking.py marks it against this station's own checklist;
   the next open of the marking view (and Refresh, and a sync pull) reads done/declined rows for this station's attempts
   and offers Apply AI marks: leaf ticks only (a parent id never ticks), the global impression, and the AI's feedback
   under its own heading in the pad — Stefan's own words stay. Per-item evidence ("said: …") behind the Evidence chip;
   Critical items missed are listed first. A declined row shows its note and lets him paste again. */
let evid = false, aiDraft = {}, aiReply = {}, aiBusy = {};
function aiHtml(st, a) {
  const ai = a.ai, n = (aiDraft[a.id] || '').length, busy = !!aiBusy[a.id], key = aiEnabled();
  if (!ai || !ai.status) {
    return `<details class="os-aifold" data-ai-fold${n || busy ? ' open' : ''}><summary>${I.bolt}<span>AI marking</span><small>paste a transcript</small>${I.chevD}</summary>
      <div class="os-aibody">
        <label class="os-notepad os-aipad${n ? ' filled' : ''}">${I.note}<textarea data-ai="tx" rows="5" maxlength="${AI_MAX}" placeholder="Paste the transcript of ${esc(nameOf(a.who === 1 ? 1 : 0))}'s attempt. Saying “I am now checking the radial pulse” or “I will examine the abdomen” counts as done.">${esc(aiDraft[a.id] || '')}</textarea></label>
        <div class="os-airow"><small class="os-aicount" aria-live="polite">${n.toLocaleString()} / ${AI_MAX.toLocaleString()}</small>
          ${key ? `<button class="os-btn os-primary" data-os="aisend" data-aid="${esc(a.id)}"${n < 1 || busy ? ' disabled' : ''}>${busy ? 'Marking…' : 'Mark with Claude'}</button>`
            : `<button class="os-btn os-primary" data-os="aicopy" data-aid="${esc(a.id)}"${n < 1 ? ' disabled' : ''}>Copy prompt for Claude</button>`}</div>
        <details class="os-aichat"${key ? '' : ' open'}><summary>${key ? 'Or use a Claude chat' : 'Mark it in a Claude chat'}${I.chevD}</summary>
          <p class="os-handhint">${key ? 'Copy the prompt, paste it into a Claude chat, then paste the reply here.' : 'Copy the prompt, paste it into a Claude chat, then paste the reply here. With an API key in Settings, Claude marks it here directly.'}</p>
          ${key ? `<button class="os-btn" data-os="aicopy" data-aid="${esc(a.id)}"${n < 1 ? ' disabled' : ''}>Copy prompt for Claude</button>` : ''}
          <label class="os-notepad os-aipad${aiReply[a.id] ? ' filled' : ''}">${I.note}<textarea data-ai="reply" rows="3" placeholder="Paste Claude's reply (the JSON) here">${esc(aiReply[a.id] || '')}</textarea></label>
          <div class="os-airow"><span></span><button class="os-btn" data-os="aipaste" data-aid="${esc(a.id)}"${aiReply[a.id] ? '' : ' disabled'}>Use this reply</button></div>
        </details>
      </div></details>`;
  }
  if (ai.status === 'declined') {
    return `<div class="os-ai os-ai--no"><div class="os-notice os-notice--sm os-notice--danger">${I.info}<div><h5>AI marking failed</h5><p>${esc(ai.note || 'The transcript could not be marked.')}</p></div></div>
      <div class="os-airow"><button class="os-link" data-os="aireset" data-aid="${esc(a.id)}">Try again</button></div></div>`;
  }
  const r = ai.result; if (!r) return '';
  const ticks = osceAiTicks(st.check, r.items), missed = osceAiMissed(st.check, r.items), of = osceScore(st.check, []).of;
  const critM = missed.filter(m => m.crit), sm = r.summary || {};
  /* the summary: the marker's phone lists when it wrote them (v4), else the Critical misses; the prose folds below */
  const plain = h => String(h || '').replace(/<[^>]+>/g, '');
  const missList = sm.missed?.length ? sm.missed : critM.slice(0, 5).map(m => (m.of ? `${plain(m.of).replace(/:$/, '')}: ` : '') + plain(m.x));
  const sentences = String(r.feedback || '').split(/(?<=[.!?])\s+(?=[A-Z])/).filter(Boolean);
  const li = xs => xs.map(x => `<li>${esc(x)}</li>`).join('');
  return `<section class="os-ai os-ai--done" aria-label="AI marking">
    <header class="os-aihead">
      <div class="os-aiscore"><b>${ticks.length}</b><span>/${of}</span></div>
      <div class="os-aihtx"><h3>${I.bolt}AI marking</h3>
        <p>${r.global != null ? `<b class="c-${GI_C[r.global]}">${GI[r.global]}</b> · ` : ''}${critM.length ? `${critM.length} Critical missed · ` : ''}${missed.length} not done</p></div>
      <button class="os-chip os-aievid${evid ? ' on' : ''}" data-os="aievid" aria-pressed="${evid}">${I.eye}Evidence</button>
    </header>
    <div class="os-aigrid">
      ${missList.length ? `<div class="os-aibox os-aibox--miss"><h5>Missed</h5><ul role="list">${li(missList)}</ul></div>` : '<div class="os-aibox os-aibox--good"><h5>Missed</h5><p>Every item done</p></div>'}
      ${sm.strengths?.length ? `<div class="os-aibox os-aibox--good"><h5>Did well</h5><ul role="list">${li(sm.strengths)}</ul></div>` : ''}
      ${sm.next ? `<div class="os-aibox os-aibox--next"><h5>Next time</h5><p>${esc(sm.next)}</p></div>` : ''}
    </div>
    ${r.phrasing?.length ? `<div class="os-aisec"><h4>Say it so it scores</h4><ol class="os-mphr">${r.phrasing.map(p => `<li>
      ${p.said ? `<p class="said">You said “${esc(p.said)}”</p>` : '<p class="said">Not said. Try:</p>'}<p class="better">“${esc(p.better)}”</p>${p.why ? `<small>${esc(p.why)}</small>` : ''}</li>`).join('')}</ol></div>` : ''}
    ${r.escalation?.length ? `<div class="os-aisec os-esc"><h4>Calling for senior help</h4><ul role="list">${r.escalation.map(e => `<li><span class="os-escto">${esc(e.to)}</span><p>“${esc(e.line)}”</p></li>`).join('')}</ul></div>` : ''}
    ${sentences.length ? `<details class="os-aisec os-aifull"><summary><h4>Full feedback</h4>${I.chevD}</summary>${sentences.map(x => `<p>${esc(x)}</p>`).join('')}</details>` : ''}
    <div class="os-airow"><small class="os-aimeta">${esc(r.model || 'AI')}${r.markedAt ? ` · ${esc(ago(Date.parse(r.markedAt) || now()))}` : ''} · <button class="os-link" data-os="aireset" data-aid="${esc(a.id)}">Mark again</button></small>
      <button class="os-btn os-primary" data-os="aiapply" data-aid="${esc(a.id)}"${ai.applied ? ' disabled' : ''}>${ai.applied ? 'Ticked on the checklist' : 'Tick these on the checklist'}</button></div>
  </section>`;
}
/* Handover add-on (2026-10-20): end any station with an ISBAR handover, management, discharge plan and safety netting for
   extra practice. Stefan's notes per field (saved on the attempt, every device), and the marker's model handover for this
   case behind "Show model" once the station is AI-marked. */
const HAND_HINT = { identify: 'Your name, role and ward; who you are calling about', situation: 'What is happening now, in one line',
  background: 'Relevant history, risk factors, what has been done', assessment: 'Obs and findings, your working diagnosis',
  recommendation: 'What you need from them, and by when', management: 'The plan: investigations, treatment, monitoring',
  discharge: 'Disposition, criteria to go home, follow-up', safety: 'Specific red flags and when to come back' };
export function handHtml(a) {
  const mine = a.hand || {}, model = a.ai?.status === 'done' ? a.ai.result?.handover || {} : {}, hasModel = HANDOVER.some(([k]) => model[k]);
  const filled = HANDOVER.filter(([k]) => mine[k]).length;
  return `<details class="os-hand"${filled ? ' open' : ''}><summary>${I.note}<span class="os-handt"><strong>Handover add-on</strong><small>ISBAR · management · discharge · safety netting${filled ? ` · ${filled} of ${HANDOVER.length} done` : ''}</small></span>${I.chevD}</summary>
    <div class="os-handbody">
      <p class="os-handhint">End the station by handing over to a senior as if on the phone. Say it aloud, jot the key words, then compare with the model.</p>
      ${HANDOVER.map(([k, l, name]) => `<div class="os-hfield"><label for="hand-${esc(a.id)}-${k}"><span class="os-hk">${l}</span>${name}</label>
        <textarea id="hand-${esc(a.id)}-${k}" rows="2" data-hand="${k}" data-aid="${esc(a.id)}" placeholder="${esc(HAND_HINT[k])}">${esc(mine[k] || '')}</textarea>
        ${model[k] ? `<details class="os-hmodel"><summary>Show model</summary><p>${esc(model[k])}</p></details>` : ''}</div>`).join('')}
      ${hasModel ? '' : '<p class="os-handhint">The model handover appears here once the station is AI-marked.</p>'}
    </div></details>`;
}
/* Memory aids (2026-10-20): the last thing on the marking sheet, closed by default; inside, "This station" (the aids
   this case names) and then every aid by group, each a fold of its own, letter by letter */
export function memHtml(st) {
  const groups = mnemonicsFor(st); if (!groups.length) return '';
  const own = groups[0].group === 'station' ? groups[0].items.length : 0;
  const aid = m => `<details class="os-mn"><summary><span class="os-mnname">${esc(m.name)}</span><small>${esc(m.what)}</small>${I.chevD}</summary>
    <ol class="os-mnl">${m.letters.map(([l, t]) => `<li><span class="os-mnk">${esc(l)}</span><span>${esc(t)}</span></li>`).join('')}</ol></details>`;
  return `<details class="os-mem"><summary>${I.marker}<span class="os-handt"><strong>Memory aids</strong><small>${own ? `${own} for this station · ` : ''}mnemonics for histories, examinations and emergencies</small></span>${I.chevD}</summary>
    <div class="os-membody">${groups.map((g, i) => `<details class="os-mg"${i === 0 && g.group === 'station' ? ' open' : ''}><summary><span>${esc(g.label)}</span><small>${g.items.length}</small>${I.chevD}</summary>
      <div class="os-mgl">${g.items.map(aid).join('')}</div></details>`).join('')}</div></details>`;
}
export function onHand(t) {
  const a = findAttempt(t.dataset.aid); if (!a) return;
  a.hand = { ...(a.hand || {}), [t.dataset.hand]: t.value.slice(0, 1200) }; save();
  t.style.height = 'auto'; t.style.height = `${t.scrollHeight}px`;
  const n = HANDOVER.filter(([k]) => a.hand[k]).length, sm = t.closest('.os-hand')?.querySelector('.os-handt small');
  if (sm) sm.textContent = `ISBAR · management · discharge · safety netting${n ? ` · ${n} of ${HANDOVER.length} done` : ''}`;
}
/* the marking container(s) on screen, repainted in place (a finished station may show it in the pane and in the tab) */
function aiRepaint(a) {
  const st = ctx.byId.get(a.sid);
  ctx.ov.querySelectorAll('.os-marking').forEach(el => {
    const editable = ctx.view === 'session';
    el.outerHTML = markingHtml(st, a, editable);
  });
  syncIndeterminate();
}
const shownAttempt = () => (ctx.view === 'session' ? curAttempt() : ctx.view === 'attempt' ? findAttempt(ctx.reviewId) : null);
/* the transcript and reply textareas: keep the drafts (a repaint must not lose them), count, enable the buttons */
export function onAiInput(t) {
  const a = shownAttempt(); if (!a) return;
  const box = t.closest('.os-aibody'); if (!box) return;
  if (t.dataset.ai === 'reply') {
    aiReply[a.id] = t.value;
    box.querySelector('[data-os="aipaste"]').disabled = !t.value.trim();
  } else {
    aiDraft[a.id] = t.value.slice(0, AI_MAX);
    box.querySelector('.os-aicount').textContent = `${aiDraft[a.id].length.toLocaleString()} / ${AI_MAX.toLocaleString()}`;
    box.querySelectorAll('[data-os="aisend"], [data-os="aicopy"]').forEach(b => { b.disabled = aiDraft[a.id].trim().length < 1 || !!aiBusy[a.id]; });
  }
  t.closest('.os-notepad')?.classList.toggle('filled', !!t.value);
}
/* a result in hand: on the attempt, the checklist ticked when nobody ticked it yet, saved, repainted */
function aiDone(a, result) {
  a.ai = { status: 'done', result, applied: false, at: now() };
  autoTick(a);
  delete aiDraft[a.id]; delete aiReply[a.id];
  save();
  aiRepaint(a);
  const st = ctx.byId.get(a.sid);
  notify(`AI marked · ${osceAiTicks(st.check, result.items).length} of ${osceScore(st.check, []).of}`, 'success');
}
/* Mark with Claude: the transcript and the checklist to the Messages API with the key saved on this device */
export async function aiSend(aid) {
  const a = findAttempt(aid), st = a && ctx.byId.get(a.sid), tx = (aiDraft[aid] || '').trim().slice(0, AI_MAX);
  if (!a || !st || !tx || aiBusy[aid] || a.ai?.status === 'done') return;
  if (!aiEnabled()) return notify('Add an Anthropic API key in Settings to mark here, or use a Claude chat.', 'danger');
  aiBusy[aid] = true; aiRepaint(a);
  try { aiDone(a, await markDirect(st, tx, markerCfg())); }
  catch (e) { notify(e?.status === 401 ? 'The API key was not accepted. Check it in Settings.' : e?.message && !e.status ? e.message : 'Could not mark the transcript. Check the connection and try again.', 'danger'); }
  finally { delete aiBusy[aid]; if (a.ai?.status !== 'done') aiRepaint(a); }
}
/* the chat path: one prompt on the clipboard, the reply pasted back */
export async function aiCopy(aid) {
  const a = findAttempt(aid), st = a && ctx.byId.get(a.sid), tx = (aiDraft[aid] || '').trim();
  if (!a || !st || !tx) return;
  try { await navigator.clipboard.writeText(markPromptText(st, tx)); notify('Prompt copied. Paste it into a Claude chat, then paste the reply below.', 'success'); }
  catch { notify('Could not copy. Allow clipboard access and try again.', 'danger'); }
  const fold = ctx.ov.querySelector('.os-aichat'); if (fold) fold.open = true;
}
export function aiPaste(aid) {
  const a = findAttempt(aid); if (!a) return;
  const r = parseReply(aiReply[aid]);
  if (!r) return notify('That reply has no marking in it. Paste the whole JSON Claude sent back.', 'danger');
  aiDone(a, r);
}
/* Apply AI marks: leaf ticks only, the global impression, the feedback under its heading (own words kept) */
export function aiApply(aid) {
  const a = findAttempt(aid), st = a && ctx.byId.get(a.sid);
  if (!a || !st || a.ai?.status !== 'done' || !a.ai.result) return;
  const r = a.ai.result;
  a.ticks = osceAiTicks(st.check, r.items);
  if (r.global != null) a.global = r.global;
  a.fb = osceAiFeedback(a.fb, r.feedback);
  a.ai.applied = true;
  if (ctx.view === 'session' && !sess().done.includes(a.id)) sess().done.push(a.id);
  save();
  aiRepaint(a);
  notify(`AI marks applied · ${a.ticks.length} of ${osceScore(st.check, []).of}`);
}
/* marks that arrive on an attempt Stefan has not ticked himself tick the checklist straight away (2026-10-20: "it should
   physically check off the right sections"); his own ticks are never overwritten: then the button applies them */
export function autoTick(a) {
  const st = ctx.byId.get(a.sid), r = a.ai?.result;
  if (!st?.check || !r || (a.ticks || []).length || a.ai.applied) return false;
  a.ticks = osceAiTicks(st.check, r.items);
  if (r.global != null && a.global == null) a.global = r.global;
  a.ai.applied = true;
  return true;
}
export function aiEvidence() { evid = !evid; const a = shownAttempt(); if (a) aiRepaint(a); }
/* Try again after a failure, or Mark again over a result (the ticks stay as they are) */
export function aiReset(aid) { const a = findAttempt(aid); if (!a || !a.ai) return; delete a.ai; save(); aiRepaint(a); }

function feedbackHtml(st) {   /* StationFeedback.vue: explanation, learning points, references */
  if (!st.explain && !st.points.length && !st.refs.length) return '';
  return `<hr><div class="os-feedback">
    ${st.explain ? `<h3>Explanation</h3><div class="os-html">${safeHtml(st.explain)}</div>${imgs(st.media?.explanation)}` : ''}
    ${st.points.length ? `<div class="os-points"><h3>Learning Points</h3><ul>${st.points.map(p => `<li>${safeHtml(p)}</li>`).join('')}</ul></div>` : ''}
    ${st.refs.length ? `<div class="os-refs"><h3>References</h3><ol>${st.refs.map(p => `<li>${safeHtml(p)}</li>`).join('')}</ol></div>` : ''}
  </div>`;
}
/* StationAttempts.vue */
function attemptsHtml(st) {
  const list = (ctx.mem.hist[st.id] || []).filter(a => a.fin).slice().reverse();
  if (!list.length) return `<div class="os-placeholder os-placeholder--box">Neither of you has attempted this station yet.</div>`;
  return `<ul class="os-attempts" role="list">${list.map(a => {
    const sc = osceScore(st.check, a.ticks);
    return `<li><button class="os-card os-acard" data-os="review" data-aid="${esc(a.id)}">
      <span class="os-arow">${whoBadge(a)}<span class="os-when" title="${esc(fmtDate(a.fin))}">${esc(ago(a.fin))}</span>
        ${a.global != null ? `<b class="c-${GI_C[a.global]}">${GI[a.global]}</b>` : '<span class="os-nomark">No mark</span>'}</span>
      <span class="os-ameta">${sc.got} of ${sc.of} items ticked</span>
      ${a.fb ? `<span class="os-fb os-fb--1">${esc(a.fb)}</span>` : ''}</button></li>`;
  }).join('')}</ul>`;
}
/* a tick or a global impression on the clock (the change event) */
export function onMark(t) {
  const a = curAttempt();
  if (ctx.view !== 'session' || !a) return;
  const { ov } = ctx;
  if (t.dataset.tick != null) {
    const set = new Set(a.ticks.map(String)), keys = t.dataset.parent ? t.dataset.parent.split(' ') : [t.dataset.tick];
    keys.forEach(k => (t.checked ? set.add(k) : set.delete(k)));
    a.ticks = [...set];
    keys.forEach(k => ov.querySelectorAll(`[data-tick="${CSS.escape(k)}"]`).forEach(x => { x.checked = t.checked; }));
    const pid = t.dataset.of || (t.dataset.parent ? t.dataset.tick : null);
    if (pid) ov.querySelectorAll(`[data-tick="${CSS.escape(pid)}"][data-parent]`).forEach(p => {
      const ks = p.dataset.parent.split(' '), n = ks.filter(k => set.has(k)).length;
      p.checked = n === ks.length; p.indeterminate = n > 0 && n < ks.length;
    });
  } else if (t.dataset.gi != null) {
    a.global = +t.value;
    ov.querySelectorAll('[data-gi]').forEach(x => { x.checked = +x.value === a.global; });
  } else return;
  if (a.fin && !sess().done.includes(a.id)) sess().done.push(a.id);
  save();
  const sc = osceScore(ctx.byId.get(a.sid).check, a.ticks);
  ov.querySelectorAll('.os-tally').forEach(x => { x.innerHTML = `<b>${sc.got}</b> of ${sc.of} items ticked`; });
}
/* the notepad and feedback textareas (the input event) */
export function onNote(t) {
  const a = curAttempt(); if (!a) return;
  a[t.dataset.np] = t.value; save();
  t.closest('.os-notepad')?.classList.toggle('filled', !!t.value);
  t.style.height = 'auto'; t.style.height = `${t.scrollHeight}px`;
}

/* ---------------------------------------------------------------- Attempt review (OscesAttempt.vue) */
export function renderAttempt(main) {
  const a = findAttempt(ctx.reviewId), st = a && ctx.byId.get(a.sid);
  if (!st) { ctx.view = ctx.back2; return ctx.render(); }
  const pane = wide();
  const tabs = [...contentTabs(st), ...(pane ? [] : ['Marking'])];
  if (!tabs.includes(ctx.tab)) ctx.tab = pane ? 'Instructions' : 'Marking';
  main.innerHTML = `<div class="os-sess fin${pane ? ' panes' : ''}"><div class="os-panes">
    <div class="os-pl">${tabsNav(tabs)}<div class="os-pscroll"><div class="os-pbody">${tabBody(st, a, ctx.tab, { editable: false })}</div></div></div>
    ${pane ? `<div class="os-pr"><div class="os-pbody">${markingHtml(st, a, false)}</div></div>` : ''}</div></div>`;
  placePill(main);
}
/* an attempt opened from a card, the Attempts tab or the results: its body first, then the review view */
export async function review(aid) {
  const at = findAttempt(aid);
  if (at) { try { await body(at.sid); } catch { return notify(NOLOAD, 'danger'); } if (!ctx.isOpen) return; }
  ctx.reviewId = aid;
  if (ctx.view !== 'attempt') ctx.back2 = ctx.view;
  return true;
}

/* ---------------------------------------------------------------- dialogs + menu on the clock */
export function nextDlg() {   /* OscesSessionFinishDialog.vue, plus who sits it: alternating by default, Swap to change */
  const s = sess(), st = ctx.byId.get(s.queue[s.idx + 1]);
  if (s.candFor !== s.aid) { s.cand = osceNextCand(curAttempt()?.who ?? s.cand, ctx.mem.alt); s.candFor = s.aid; save(); }   /* once per attempt: reopening the dialog never flips it again */
  openDialog({ kind: 'next', noHead: true, cls: 'os-dlg--small', body: `<div class="os-nextd">
    <div class="os-nexthd"><span class="os-nextic">${I.arrowR}</span><h2>Next Station</h2>
      <p>${ctx.mem.details ? `${esc(st.title)} ${srcTag(st)}` : tagHtml(st, 1)}</p></div>
    <div class="os-roles"><span class="os-rolest">${roleLine(s.cand)}</span><button class="os-link" data-os="swap">Swap</button></div>
    <hr>
    <div class="os-nextbtns"><button class="os-btn os-btn--lg os-primary" data-os="startnext" autofocus>Start Next Station</button>
      <button class="os-link os-dangerlink" data-os="endnow">End Session</button></div></div>` });
}
function resultsDlg(results) {   /* the session's results: each station, its global impression and ticks */
  const gi = results.filter(a => a.global != null);
  openDialog({ kind: 'results', noHead: true, cls: 'os-dlg--small', body: `<div class="os-results">
    <div class="os-nexthd"><span class="os-nextic ok">${I.done}</span><h2>Session Complete</h2>
      <p>${results.length} station${results.length === 1 ? '' : 's'} practised${gi.length ? ` · ${gi.filter(a => a.global >= 2).length} at standard or above` : ''}</p></div>
    <ul class="os-rlist" role="list">${results.map((a, i) => {
      const st = ctx.byId.get(a.sid), sc = osceScore(st?.check, a.ticks), p = sc.of ? sc.got / sc.of : 0;
      return `<li style="--d:${i}"><button class="os-rrow" data-os="review" data-aid="${esc(a.id)}">
        ${whoBadge(a)}<span class="os-rt"><b>${esc(st?.title || 'Station')}${st ? ` ${srcTag(st)}` : ''}</b><small>${sc.got} of ${sc.of} items ticked</small><i class="os-rbar"><i style="--p:${p}"></i></i></span>
        ${a.global != null ? `<span class="os-rgi c-${GI_C[a.global]}">${GI[a.global]}</span>` : '<span class="os-nomark">No mark</span>'}</button></li>`;
    }).join('')}</ul>
    <button class="os-btn os-btn--lg os-primary" data-os="dclose" autofocus>Done</button></div>` });
}
export function morePop(b) {
  const st = ctx.byId.get(sess().queue[sess().idx]);
  openPop(b, `<div role="menu" class="os-menu"><button class="os-opt" role="menuitem" data-v="cand">${I.eye}Candidate screen...</button>
    <button class="os-opt" role="menuitem" data-v="restart">${I.reload}Restart Station...</button>
    <button class="os-opt os-dangerlink" role="menuitem" data-v="end">${I.exit}End Session...</button><hr><span class="os-menu-id">Station #${esc(st.id)}</span></div>`, v => {
    closePop();
    if (v === 'cand') candDlg(); else if (v === 'restart') restartStation(); else endSession();
  });
}
export async function restartStation() {
  if (!await confirmDlg({ title: 'Are you sure you want to restart this station?', message: 'All current progress on this station will be lost.', confirm: 'Restart' })) return;
  startAttempt(sess().idx ?? 0);
}
/* Candidate screen: a link for the candidate's own phone that shows the instructions and the same countdown, so the
   examiner keeps this device with the patient script and the marking sheet (osce/candidate.mjs) */
function candDlg() {
  const s = sess(), st = ctx.byId.get(s.queue[s.idx]);
  if (!s.timer?.at) return notify('Start the timer first: the candidate screen follows it.', 'danger');
  const url = candidateLink(location.href, st.id, s.timer, ctx.mem.timing, now());
  openDialog({ kind: 'cand', title: 'Candidate screen', cls: 'os-dlg--small', body: `<div class="os-cand">
    <p>Open this on ${esc(nameOf(s.cand))}'s phone. It shows the instructions and the same countdown. If you pause or restart, send it again.</p>
    <input class="os-candurl" readonly value="${esc(url)}" aria-label="Candidate screen link">
    <div class="os-crow">${navigator.share ? '<button class="os-btn" data-os="candshare">Share</button>' : ''}<button class="os-btn os-primary" data-os="candcopy" autofocus>Copy link</button></div></div>` });
}
export async function candSend(how) {
  const u = ctx.ov.querySelector('.os-candurl')?.value; if (!u) return;
  try {
    if (how === 'share') await navigator.share({ title: 'OSCE station', url: u });
    else { await navigator.clipboard.writeText(u); notify('Link copied', 'success'); }
  } catch { /* the share sheet was closed */ }
}
/* Swap in the Next Station dialog: the other one sits it */
export function swapCand() {
  const s = sess(); s.cand = s.cand === 1 ? 0 : 1; save();
  const el = ctx.ov.querySelector('.os-rolest'); if (el) el.innerHTML = roleLine(s.cand);
}
/* Start Next Station / End Session from the Next Station dialog */
export function startNext() { const s = sess(); closeDialog(true); return startAttempt(s.idx + 1); }
export function endNow() { closeDialog(true); return endSession(true); }

/* ---------------------------------------------------------------- Highlight tool (HighlightControls): with it on, a selection in Instructions / Patient Script is marked and kept */
export function toggleHighlight() {
  hlOn = !hlOn;
  ctx.ov.querySelectorAll('[data-os="hl"]').forEach(x => { x.classList.toggle('on', hlOn); x.setAttribute('aria-pressed', String(hlOn)); });
  if (hlOn) applyHighlight();
}
export function clearHighlight() {
  const cur = curAttempt(); if (cur?.hl) delete cur.hl[ctx.tab]; save();
  const pane = ctx.ov.querySelector('.os-pl .os-pbody'); if (pane) pane.innerHTML = tabBody(ctx.byId.get(cur.sid), cur, ctx.tab, { editable: true });
}
/* document selectionchange: a settled selection becomes a mark */
export function onSelectionChange() { if (hlOn && ctx.isOpen) { clearTimeout(hlT); hlT = setTimeout(applyHighlight, 450); } }
function applyHighlight() {
  const sel = window.getSelection(), a = curAttempt();
  if (!hlOn || !sel || sel.isCollapsed || !a) return;
  const r = sel.getRangeAt(0), sheet = r.commonAncestorContainer.nodeType === 1 ? r.commonAncestorContainer.closest('.os-sheet[data-hl]') : r.commonAncestorContainer.parentElement?.closest('.os-sheet[data-hl]');
  if (!sheet) return;
  try { const m = document.createElement('mark'); m.appendChild(r.extractContents()); r.insertNode(m); } catch { return; }
  sel.removeAllRanges();
  (a.hl ||= {})[sheet.dataset.hl] = sheet.innerHTML;
  save();
  const tb = ctx.ov.querySelector('.os-btool');
  if (tb && !tb.querySelector('[data-os="hlclear"]')) tb.insertAdjacentHTML('beforeend', '<button class="os-link os-fade" data-os="hlclear">Clear</button>');
}
