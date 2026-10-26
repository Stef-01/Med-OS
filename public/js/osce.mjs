/* osce.mjs — Learn's OSCE Practice (rebuilt 2026-10-19 on eMedici's own front end: OscesStart, OscesGroup, OscesQueue,
   OscesBrowse(+Card/Dialog), OscesPreviewDialog, OscesTimingDialog, OscesSession(+Timer/TimerControls/FinishDialog),
   StationTabs/Panes/Marking/Attempts, StationMarkingSheet, osceMarks.ts), solo path only (no groups, codes or roles).

   Flow: Start (New / Resume Study Session) → Study Session (station queue + reading/station timing + Start Practice on
   the left; search, Status / Complexity / Station Type / Saved filters, Add Random, Hide Details and the station cards on
   the right; on a phone the browser is the "Add Stations" sheet) → a station on the clock (progress ring, Reading then
   Station countdowns, restart / pause / skip; tabs Instructions / Patient Script / Marking) → Station Finished (self-mark
   the checklist + global impression, written feedback, explanation) → Next Station dialog → End Session → results.

   Split (plan unit F3, 2026-10-19): this file is the entry: open / close, the overlay root, the view dispatcher and the
   event handlers that route a click to its view. osce/core.mjs holds the pure laws (tested without a browser in
   scripts/osce-core.test.js; re-exported below for learn.mjs and scripts/osce.test.js); osce/state.mjs the shared ctx,
   storage, the bank loader and the kit wrappers; osce/run.mjs the Start view + Fast Run; osce/browse.mjs the Study
   Session (queue, browser, preview, timing); osce/session.mjs a station on the clock, marking and the attempt review.
   Stations: ./osce/index.json (one light row per station, scripts/build-index.mjs); a station's body ./osce/<id>.json
   is fetched on first use and kept. HTML fields are pre-cut to the allowlist with no attributes, rendered through
   safeHtml(); plain text goes through esc(). Everything persists in localStorage 'osce.practice.v1', every access
   guarded; osce/settings.mjs, osce/marker.mjs and osce/candidate.mjs are the settings dialog, AI marking and the
   candidate screen. DOM-owning VIEW module; css/osce.css loads on the first open. */
import { createOverlay } from './study-kit/overlay.mjs';
import { wide, fmtDate } from './study-kit/util.mjs';
import { closeAllDialogs } from './study-kit/ui.mjs';
import { osceMigrate, osceFinished, oscePeople } from './osce/core.mjs';
import { ctx, I, $, load, save, sess, attempted, findAttempt, body, now, css, loadStations, audio, bmButton, srcTag, syncBm, closePop, topDialog, closeDialog, notify, NOLOAD, curAttempt, confirmDlg, roleShort, nameOf } from './osce/state.mjs';
import { esc } from './core.mjs';
import { attach as syncAttach, pull as syncPull, configureSync, wire as syncWire } from './study-kit/sync.mjs';   /* both of your devices, when config.js names a project */
import { requestsDlg, requestForm, copyRequest, shareRequest, withdrawRequest, paintRequests } from './osce/requests-view.mjs';
import { mcqDlg, mcqForm, importPaste, resend as mcqResend, exportMcqs, copyMcqs } from './osce/mcq-view.mjs';   /* Submit a question: the standard MCQ pool's way in (docs/mcq.md) */
import { libraryDlg, libraryKey } from './osce/library-view.mjs';
import { maybeWrapped, wrappedKey } from './osce/wrapped-view.mjs';   /* the month, wrapped: once, on the first open of a new month */   /* Your questions: upload, study, friends, sharing (docs/library.md) */
import { renderStart, toggleRot, runAll, runPop, runClear, runGo, onPerson, pickCand, toggleAlt } from './osce/run.mjs';
import { renderGroup, browseReset, browseDlg, browseSheetOpen, paintQueue, clearQueue, removeQueued, queueFromButton, addRandom, toggleDetails, afterBookmark, discPick, filterPop, toggleSaved, resetFilters, timingDlg, saveTiming, previewDlg, previewTab, onSearch, onPointerDown } from './osce/browse.mjs';
import { renderMarked, markedReset } from './osce/marked.mjs';
import { renderSession, renderAttempt, stopTick, startAttempt, endSession, togglePause, skip, switchTab, onMark, onNote, review, nextDlg, startNext, endNow, morePop, restartStation, toggleHighlight, clearHighlight, onSelectionChange, onAiInput, aiSend, aiCopy, aiPaste, aiApply, aiEvidence, aiReset, candSend, swapCand, onHand, present, presentStep, presenting, p2Go, p2Flat, jumpTo, syncJump, markPart2 } from './osce/session.mjs';
import { settingsDlg, saveSettings, clearKey, exportFile } from './osce/settings.mjs';
import { opened as remindersOpened } from './osce/reminders.mjs';

export * from './osce/core.mjs';   /* the pure laws, under the names learn.mjs and scripts/osce.test.js import */

/* ---------------------------------------------------------------- open / close */
export async function openOsce(deps = {}) {
  if (ctx.isOpen) return;
  ctx.isOpen = true;
  ctx.root = !!deps.root;   /* the app's first screen: Start has no back button */
  configureSync(deps); syncWire();
  remindersOpened();   /* opened today: no sad note from the dog tonight (reminders.mjs) */
  ctx.mem = osceMigrate(load(), now());
  try { await Promise.all([css(), loadStations()]); } catch (e) { ctx.isOpen = false; throw e; }
  if (!ctx.isOpen) return;
  const { mem, byId } = ctx;
  syncAttach('osce', mem, () => { if (ctx.isOpen) { mem.people = oscePeople(mem.people); save(); paintRequests(); if (!topDialog() && !ctx.ov.contains(document.activeElement?.closest?.('input, textarea'))) ctx.render(); } });   /* a newer shard from the other device: the same object, names re-checked, the att mirror rebuilt, a repaint unless someone is typing */
  syncPull('osce');
  /* drop queued ids the bank no longer has */
  mem.sess.queue = mem.sess.queue.filter(id => byId.has(id));
  if (mem.sess.idx != null && !mem.sess.queue[mem.sess.idx]) Object.assign(mem.sess, { idx: null, aid: null, timer: null });
  /* the bodies the first paint and save() need: the station on the clock, and attempted stations whose att mirror was
     never scored (a v1 save); normally none. A body that does not load is retried on use. */
  const need = new Set();
  if (mem.sess.idx != null) need.add(mem.sess.queue[mem.sess.idx]);
  for (const id of Object.keys(mem.hist)) if (byId.has(id) && attempted(id) && !(mem.att[id] && mem.att[id].of != null)) need.add(id);
  await Promise.all([...need].map(id => body(id).catch(() => {})));
  if (!ctx.isOpen) return;
  build();
  ctx.view = 'start';
  ctx.shell.open(deps.opener);
  render();
  if (!ctx.root) $('[data-os="back"]').focus({ preventScroll: true });   /* the first screen leaves focus alone: a name field would raise the phone's keyboard */
  ctx.ov.dataset.ready = '1';
  maybeWrapped(); syncPull('lib').then(n => { if (n && ctx.isOpen) maybeWrapped(); });   /* the other device's month too */
}

export function closeOsce() {
  if (!ctx.isOpen) return;
  ctx.isOpen = false;
  syncAttach('osce', null);
  stopTick();
  if (sess().timer?.at) { /* the clock keeps running by wall time; nothing to do */ }
  save();
  delete ctx.ov.dataset.ready;
  ctx.shell.close();   /* the stack, the kit's dialogs and popover, both overflow locks, the out animation, focus to the opener */
}

function build() {
  if (ctx.ov) return;
  const shell = ctx.shell = createOverlay({ cls: 'os', label: 'OSCE Practice', onKey });
  const ov = ctx.ov = shell.el;
  ov.innerHTML = `<header class="os-head">
      <button class="os-ic" data-os="back" aria-label="Back">${I.back}</button>
      <div class="os-htitle"><h1 class="os-title">OSCE Practice</h1><small class="os-sub"></small></div>
      <div class="os-hact"></div>
    </header>
    <main class="os-main"></main>
    <div class="os-alerts" role="status" aria-live="polite"></div>`;
  ov.addEventListener('click', onClick);
  ov.addEventListener('input', onInput);
  ov.addEventListener('change', onChange);
  ov.addEventListener('pointerdown', onPointerDown);
  let jumpRaf = 0; ov.addEventListener('scroll', e => { if (jumpRaf || !e.target.querySelector?.('.os-jump')) return; jumpRaf = requestAnimationFrame(() => { jumpRaf = 0; syncJump(e.target); }); }, true);   /* the script's jump bar follows the scroll */
  let tapped = null; ov.addEventListener('click', e => { tapped = e.target.closest('summary')?.parentElement || null; }, true);
  ov.addEventListener('toggle', e => { const d = e.target; if (d.open && d === tapped) { d.classList.add('os-opening'); setTimeout(() => d.classList.remove('os-opening'), 260); } }, true);   // disclosure reveal on user toggles only
  document.addEventListener('selectionchange', onSelectionChange);
  ctx.mq = window.matchMedia('(min-width: 900px)');
  const onMq = () => { if (!ctx.isOpen) return; if (wide() && browseSheetOpen()) closeDialog(); render(); };
  ctx.mq.addEventListener ? ctx.mq.addEventListener('change', onMq) : ctx.mq.addListener(onMq);
}

/* ---------------------------------------------------------------- render: header + view */
/* moving between views: deeper (Start, the queue, the station) arrives from the right, back from the left, on the
   smooth spring (study-kit/spring.mjs tokens); the repaint itself stays synchronous */
const DEPTH = { start: 0, group: 1, marked: 1, session: 2, attempt: 2 };
let lastView = null;
function render() {
  closePop();
  stopTick();
  browseReset();
  const main = $('.os-main'), { view } = ctx;
  if (lastView !== null && lastView !== view) {
    main.classList.remove('os-vin', 'os-vin--back'); void main.offsetWidth;
    main.classList.add('os-vin'); if ((DEPTH[view] ?? 1) < (DEPTH[lastView] ?? 1)) main.classList.add('os-vin--back');
  }
  lastView = view;
  main.dataset.view = view;
  if (view === 'start') renderStart(main);
  else if (view === 'group') renderGroup(main);
  else if (view === 'session') renderSession(main);
  else if (view === 'marked') renderMarked(main);
  else renderAttempt(main);
  renderHead();
}
ctx.render = render;   /* the views repaint through ctx (no import cycle) */

function renderHead() {
  const s = sess(), { view } = ctx, title = $('.os-title'), sub = $('.os-sub'), act = $('.os-hact'), backB = $('[data-os="back"]');
  sub.textContent = ''; act.innerHTML = '';
  backB.innerHTML = I.back; backB.setAttribute('aria-label', 'Back');
  backB.hidden = ctx.root && view === 'start';
  if (view === 'start') { title.textContent = 'OSCE Practice'; act.innerHTML = `<button class="os-hbtn" data-os="marked">${I.check}<span>Marked</span></button><button class="os-ic" data-os="settings" aria-label="Settings">${I.gear}</button>`; }
  else if (view === 'marked') title.textContent = 'Marked Stations';
  else if (view === 'group') title.textContent = 'Study Session';
  else if (view === 'session') {
    const st = ctx.byId.get(s.queue[s.idx]);
    title.textContent = `Station ${s.idx + 1} of ${s.queue.length}`;
    backB.innerHTML = I.x; backB.setAttribute('aria-label', 'End session');
    const a = curAttempt();
    sub.innerHTML = `${srcTag(st)}${roleShort(a && a.who === 1 ? 1 : 0)}`;
    act.innerHTML = bmButton(st.id, true) + `<button class="os-ic" data-os="more" aria-label="More Options" aria-haspopup="menu">${I.dots}</button>`;
  } else {
    const a = findAttempt(ctx.reviewId), st = a && ctx.byId.get(a.sid);
    title.textContent = st ? st.title : 'Attempt';
    sub.innerHTML = a ? `${st ? `${srcTag(st)} ` : ''}${a.who === 0 || a.who === 1 ? `${esc(nameOf(a.who))} · ` : ''}Attempted ${fmtDate(a.at)}` : '';
    if (st) act.innerHTML = bmButton(st.id, true);
  }
}

/* ---------------------------------------------------------------- events */
function back() {
  if (topDialog()) return closeDialog();
  if (ctx.view === 'session') return endSession();
  /* a view change repaints .os-main, detaching whatever had focus: land on the header's back button (e2e dom [shell/osce]) */
  if (ctx.view === 'attempt') { ctx.view = ctx.back2; ctx.tab = 'Instructions'; render(); return $('[data-os="back"]').focus({ preventScroll: true }); }
  if (ctx.view === 'group' || ctx.view === 'marked') { ctx.view = 'start'; render(); return $('[data-os="back"]').focus({ preventScroll: true }); }
  if (!ctx.root) closeOsce();
}
async function onClick(e) {
  const d = e.target.closest('[data-disc]');   /* the kit's discipline rows: Fast Run's rotations, the browser's filter */
  if (d) { const row = d.closest('[data-disc-row]').dataset.discRow, id = d.dataset.disc; return row === 'run' ? (id ? toggleRot(id) : runAll()) : discPick(id); }
  const b = e.target.closest('[data-os]');
  if (!b || b.disabled) return;
  const a = b.dataset.os, id = b.dataset.id, { mem } = ctx;
  audio();   /* unlock the bell inside a gesture */
  switch (a) {
    case 'back': return back();
    case 'duel': return (await import('./osce/duel.mjs')).openDuel(b).catch(() => notify('The duel did not load. Check the connection and try again.', 'danger'));
    case 'dclose': return closeDialog();
    case 'new': {
      const s = sess();
      if (s.idx != null && !await confirmDlg({ title: 'End the current session?', message: 'The station in progress will be lost.', confirm: 'New Session' })) return;
      const cur = curAttempt(); if (cur && !cur.fin) mem.hist[cur.sid] = mem.hist[cur.sid].filter(x => x !== cur);
      mem.sess = { queue: [], idx: null, aid: null, timer: null, done: [], cand: sess().cand }; save();
      ctx.view = 'group'; return render();
    }
    case 'resume': {
      const s = sess();
      if (s.idx != null) { try { await body(s.queue[s.idx]); } catch { return notify(NOLOAD, 'danger'); } if (!ctx.isOpen) return; }
      ctx.view = s.idx != null ? 'session' : 'group'; ctx.tab = 'Instructions'; return render();
    }
    case 'browse': return browseDlg();
    case 'rot': return toggleRot(b.dataset.rot);
    case 'runpop': return runPop(b);
    case 'runclear': return runClear();
    case 'rungo': return runGo();
    case 'timing': return timingDlg();
    case 'tsave': return saveTiming();
    case 'startp': if (sess().queue.length) { sess().done = []; ctx.ov.querySelector('.os-alerts')?.replaceChildren(); startAttempt(0); } return;   /* the "Added" toasts end with the queue */
    case 'qclear': return clearQueue();
    case 'qrm': return removeQueued(b, id);
    case 'queue': case 'pvqueue': return queueFromButton(b, id, a === 'queue');
    case 'preview': return previewDlg(id, b.dataset.tab);
    case 'pvtab': return previewTab(b.dataset.tab);
    case 'bm': { mem.bm[id] ? delete mem.bm[id] : (mem.bm[id] = 1); save(); syncBm(id); return afterBookmark(); }
    case 'random': return addRandom();
    case 'details': return toggleDetails();
    case 'filter': return filterPop(b);
    case 'saved': return toggleSaved();
    case 'reset': return resetFilters();
    case 'tab': return switchTab(b.dataset.tab);
    case 'pp': return togglePause();
    case 'skip': return skip();
    case 'restart': return restartStation();
    case 'hl': return toggleHighlight();
    case 'examall': { const all = [...b.closest('.os-exam').querySelectorAll('.os-exstep')], open = !all.every(d => d.open); all.forEach(d => { d.open = open; }); b.textContent = open ? 'Hide all' : 'Reveal all'; return; }
    case 'hlclear': return clearHighlight();
    case 'more': return morePop(b);
    case 'nextdlg': return nextDlg();
    case 'startnext': return startNext();
    case 'endnow': return endNow();
    case 'end': return endSession();
    case 'aisend': return aiSend(b.dataset.aid);
    case 'aicopy': return aiCopy(b.dataset.aid);
    case 'present': return present(b.dataset.sid, +b.dataset.i || 0, { set: b.dataset.set, q: b.dataset.q });
    case 'p2step': return p2Go(b.dataset.sid, +b.dataset.n || 0);
    case 'p2flat': return p2Flat(b.dataset.sid);
    case 'jump': return jumpTo(b);
    case 'markp2': return markPart2(b);
    case 'pprev': return presentStep(-1);
    case 'pnext': return presentStep(1);
    case 'aipaste': return aiPaste(b.dataset.aid);
    case 'cand': return pickCand(+b.dataset.i);
    case 'alt': return toggleAlt(b);
    case 'swap': return swapCand();
    case 'candcopy': return candSend('copy');
    case 'candshare': return candSend('share');
    case 'settings': return settingsDlg();
    case 'requests': return requestsDlg();
    case 'reqnew': return requestForm(b.dataset.topic || '');
    case 'reqcopy': return copyRequest(b.dataset.id);
    case 'reqshare': return shareRequest(b.dataset.id);
    case 'reqdrop': return withdrawRequest(b.dataset.id);
    case 'lib': return libraryDlg();
    case 'mcq': return mcqDlg();
    case 'mcqnew': return mcqForm();
    case 'mcqimport': return importPaste(b);
    case 'mcqsend': return mcqResend(b.dataset.id);
    case 'mcqexport': return exportMcqs();
    case 'mcqcopy': return copyMcqs();
    case 'ssave': return saveSettings();
    case 'skeyclear': return clearKey();
    case 'sexport': return exportFile();
    case 'aiapply': aiApply(b.dataset.aid); if (ctx.view === 'marked') render(); return;
    case 'marked': markedReset(); ctx.view = 'marked'; render(); return $('[data-os="back"]').focus({ preventScroll: true });
    case 'aievid': return aiEvidence();
    case 'aireset': return aiReset(b.dataset.aid);
    case 'review': {
      if (!await review(b.dataset.aid)) return;
      closeAllDialogs(ctx.ov);
      ctx.view = 'attempt'; ctx.tab = wide() ? 'Instructions' : 'Marking';
      render();
      if (b.closest('.os-donecard')) ctx.ov.querySelector('.os-ai')?.scrollIntoView({ block: 'start' });   /* from the AI marking card: straight to the marks, not item 1 of 41 */
      return;
    }
  }
}
function onInput(e) {
  const t = e.target;
  if (t.matches('.os-q')) return onSearch(t);
  if (t.dataset.np) onNote(t);
  if (t.dataset.ai) onAiInput(t);
  if (t.dataset.person != null) onPerson(t);
  if (t.dataset.hand) onHand(t);
}
function onChange(e) { onMark(e.target); }
function onKey(e) {
  if (!ctx.isOpen) return;
  e.stopImmediatePropagation();   /* OSCE is the top layer: nothing under it (the home, the deck, the app) sees this key */
  if (e.key === 'Escape') {
    e.preventDefault();
    return back();
  }
  if (e.key === 'Enter' && e.target.matches?.('.os-q')) { e.target.blur(); }
  if (topDialog()?.kind === 'lib' && libraryKey(e)) { e.preventDefault(); return; }
  if (topDialog()?.kind === 'wrapped' && wrappedKey(e)) { e.preventDefault(); return; }   /* Your questions: 1 to 5 answer, 1 to 4 grade */
  if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && presenting()) { e.preventDefault(); return presentStep(e.key === 'ArrowRight' ? 1 : -1); }   /* the results full screen */
  /* Space toggles the clock when focus is not in a control (the media-control convention); the arrow keys on a tab move
     to the neighbour tab (WAI-ARIA APG tabs). P2 polish 2026-10-19 */
  if (e.key === ' ' && ctx.view === 'session' && !osceFinished(sess().timer) && !e.target.closest?.('input, textarea, button, select, a, [contenteditable]')) { e.preventDefault(); return togglePause(); }
  if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && e.target.matches?.('[role="tab"]')) {
    const tabs = [...e.target.parentElement.querySelectorAll('[role="tab"]')], i = tabs.indexOf(e.target);
    const n = tabs[(i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length];
    e.preventDefault(); n.focus({ preventScroll: true }); n.click();
  }
  /* arrows in a popover, Tab inside a dialog: the kit's hook on the stack; Tab inside the overlay: the stack */
}
