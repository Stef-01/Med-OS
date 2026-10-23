/* osce/session.mjs — a station on the clock and its review (plan unit F3, 2026-10-19; from osce.mjs): OscesSession
   (progress ring, Reading then Station countdowns, restart / pause / skip, the tick), StationTabs / Panes (Instructions,
   Patient Script, Marking), StationMarking + StationMarkingSheet (checklist with kids and Critical, global impression,
   feedback, guide, explanation), StationAttempts, OscesAttempt (an attempt reviewed), the Next Station and Session
   Complete dialogs, the More menu, and the Highlight tool. The clock's laws (osceStart/Pause/Resume/Next/Tick/Left/
   Finished) and the score are core.mjs; this module owns the attempt records in mem.hist and the session queue index. */
import { esc } from '../core.mjs';
import { wide, fmtDate } from '../study-kit/util.mjs';
import { safeHtml } from '../study-kit/safe.mjs';
import { figureHtml } from '../study-kit/media.mjs';
import { mnemonicsFor } from './mnemonics.mjs';
import { HANDOVER, osceScore, osceLeft, osceFinished, osceStart, oscePause, osceResume, osceNext, osceTick, mmss, phasesOf, phaseName, phaseWhat, nextPhase, hasPart2, osceAiTicks, osceAiMissed, osceAiQuotes, osceAiFeedback, AI_MAX, osceNextCand } from './core.mjs';
import { ctx, I, GI, GI_C, save, sess, curAttempt, findAttempt, now, body, NOLOAD, bell, notify, confirmDlg, openDialog, closeDialog, openPop, closePop, tagHtml, srcTag, ago, aiEnabled, markerCfg, examOf, nameOf, whoBadge, roleLine } from './state.mjs';
import { markDirect, markPromptText, parseReply } from './marker.mjs';
import { candidateLink } from './candidate.mjs';

let tickT = 0, hlOn = false, hlT = 0, lastScroll = {};   /* StationTabs.vue: each tab keeps its scroll position */

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
/* the tabs a station's content fills: the examiner's Part 2 sheet only when the station has one */
export const contentTabs = st => ['Instructions', ...(st.patient || st.media?.patientScript?.length ? ['Patient Script'] : []), ...(examOf(st) ? ['Exam'] : []), ...(hasPart2(st) ? ['Part 2'] : [])];
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
/* a new phase: say so; at Part 2 the examiner's sheet comes up (unless they are marking) */
function onPhase(c) {
  notify(phaseNotice(c, ctx.mem.timing));
  const st = ctx.byId.get(sess().queue[sess().idx]);
  if (c === 'mx' && hasPart2(st) && ctx.tab !== 'Marking' && ctx.ov.querySelector('[data-os="tab"][data-tab="Part 2"]')) switchTab('Part 2');
}
function finishStation() {
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
  lastScroll = {};
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
const imgs = list => (list || []).map(figureHtml).join('');   /* each image with its caption and credit (study-kit/media.mjs) */
export function tabBody(st, a, t, o = {}) {
  if (a && a.hl?.[t] && (t === 'Instructions' || t === 'Patient Script')) return `<div class="os-sheet" data-hl="${t}">${a.hl[t]}</div>${o.editable ? toolbar() : ''}`;
  if (t === 'Instructions') {
    return `<div class="os-sheet" data-hl="Instructions"><h2>Instructions to Candidate</h2><div class="os-html">${safeHtml(st.stem)}</div>${imgs(st.media?.stem)}
      ${formatHtml()}
      ${st.tasks.length ? `<h3>Tasks</h3><ol class="os-tasks" role="list">${st.tasks.map((x, i) => `<li><span class="os-tn">${i + 1}</span><div class="os-html">${safeHtml(x)}</div></li>`).join('')}</ol>` : ''}
      </div>${a && o.editable ? toolbar() : ''}`;
  }
  if (t === 'Part 2') return part2Html(st);
  if (t === 'Patient Script') return `<div class="os-sheet" data-hl="Patient Script"><h2>Patient Script</h2><div class="os-html">${safeHtml(st.patient)}</div>${imgs(st.media?.patientScript)}</div>${a && o.editable ? toolbar() : ''}`;
  if (t === 'Marking') return `<div class="os-sheet">${markingHtml(st, a, !!o.editable)}</div>`;
  if (t === 'Exam') return `<div class="os-sheet">${examHtml(examOf(st))}</div>`;
  return attemptsHtml(st);
}
/* the station's shape, from the timing in use: Reading 5 · Part 1 10 · Part 2 5 */
export function formatHtml(timing = ctx.mem.timing) {
  return `<ol class="os-format" role="list" aria-label="Station format">${phasesOf(timing).map(k => `<li><small>${phaseName(k)}</small><b>${timing[k]} min</b><span>${phaseWhat(k)}</span></li>`).join('')}</ol>`;
}
/* Part 2 for the examiner: the opening line, the results to hand over (and their images), the questions in order */
export function part2Html(st, { candidate = false } = {}) {
  const p = st.part2 || { handover: [], ask: [] }, m = ctx.mem?.timing?.mx;
  return `<div class="os-sheet os-p2"><h2>${candidate ? 'Results from the examiner' : 'Part 2'}</h2>
    <p class="os-p2sub">Interpretation, management and safety netting${m ? ` · ${m} minutes` : ''}</p>
    ${!candidate && p.lead ? `<div class="os-p2lead"><small>Examiner says</small><p>“${esc(p.lead)}”</p></div>` : ''}
    ${p.handover.length ? `${candidate ? '' : '<h3>Hand over</h3>'}<ul class="os-p2list" role="list">${p.handover.map(h => `<li><strong>${esc(h.label)}</strong><div class="os-html">${safeHtml(h.result)}</div></li>`).join('')}</ul>` : ''}
    ${imgs(st.media?.part2)}
    ${!candidate && p.ask.length ? `<h3>Ask</h3><ol class="os-p2ask">${p.ask.map(q => `<li>${esc(q)}</li>`).join('')}</ol>` : ''}
  </div>`;
}
/* Exam mode (2026-10-22, founder: "a clear separate section, as this has been invented from the original eMedici content"):
   the AI-written findings in their own box, labelled as such; each step is closed until tapped, so the candidate says what
   they would do before seeing what they find */
function examHtml(x) {
  if (!x) return '';
  const step = (s, i) => `<li><details class="os-exstep"><summary><span class="os-exn">${i + 1}</span><span class="os-exa"><strong>${esc(s.area)}</strong>${s.do ? `<small>${esc(s.do)}</small>` : ''}</span>${I.chevD}</summary><p>${esc(s.find)}</p></details></li>`;
  return `<section class="os-exam" aria-labelledby="os-exam-h">
    <header class="os-exhead"><span class="os-bigic">${I.check}</span><span class="os-handt"><strong id="os-exam-h">Exam mode</strong><small>Say what you would examine, then tap to see what you find</small></span></header>
    <p class="os-exwarn"><b>AI-written</b> These findings were invented to fit this case.</p>
    ${x.vitals ? `<div class="os-exbox"><h4>Vitals</h4><p>${esc(x.vitals)}</p></div>` : ''}
    ${x.general ? `<div class="os-exbox"><h4>General inspection</h4><p>${esc(x.general)}</p></div>` : ''}
    <div class="os-exrow"><h4>Examination</h4><button class="os-link" data-os="examall">Reveal all</button></div>
    <ol class="os-exsteps" role="list">${(x.steps || []).map(step).join('')}</ol>
    ${x.bedside?.length ? `<div class="os-exbox"><h4>Bedside tests</h4><ul role="list" class="os-exbed">${x.bedside.map(b => `<li><b>${esc(b.test)}</b><span>${esc(b.find)}</span></li>`).join('')}</ul></div>` : ''}
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
  placePill(pl, true);
}

/* StationMarking.vue + StationMarkingSheet.vue: info notice, checklist, global impression, feedback, guide, explanation */
export function markingHtml(st, a, editable) {
  const on = new Set((a?.ticks || []).map(String)), dis = editable ? '' : ' disabled';
  const showFb = !a || a.fin;
  const sc = osceScore(st.check, a?.ticks);
  const q = a?.ai?.status === 'done' && a.ai.result ? osceAiQuotes(a.ai.result.items) : null;   /* "said: …" under each AI-ticked item (the Evidence chip shows them) */
  return `<div class="os-marking${q && evid ? ' os-ai-evid' : ''}">
    ${a && !editable ? '' : '<h2>Marking Sheet</h2>'}
    <div class="os-notice">${I.info}<div><h5>Marking Sheet Provided for Information Only</h5><p>Please note that the marking checklist provided below is intended as a prompt for you to consider key areas in this station. It is not exhaustive. It does not equate to an assessment of competency and therefore no 'pass mark' is provided.</p></div></div>
    ${a && a.fin ? aiHtml(st, a) : ''}
    ${a && a.fin ? handHtml(a) : ''}
    ${a ? `<div class="os-tally"><b>${sc.got}</b> of ${sc.of} items ticked</div>` : ''}
    <div class="os-check">${st.check.map(i => checkItem(i, on, dis, q)).join('')}
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
function checkItem(i, on, dis, q) {
  if (i.t === 'heading') return `<h3>${safeHtml(i.x)}</h3>`;
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
