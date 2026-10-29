/* osce/library-view.mjs - Your questions (docs/library.md; founder 2026-10-25): upload MCQs written by ChatGPT from
   your notes, study them, share decks with friends, and duel on them. One dialog, four tabs:

     Library   your decks and the decks friends share with you; study a deck, share it, delete it or a question
     Upload    1 copy the prompt for ChatGPT  2 paste what it returns (or choose the file)  3 see each question's
               checks  4 save to a deck: live at once, in Study and in Duel a Mate
     Friends   add by name, answer requests, remove
     Study     due cards first, by deck (yours, friends', or the bank), specialty, kind and year; answer, see why, then
               Again, Hard, Good or Easy. 0 to 1 (founder 2026-10-26) climbs Year 1 to final year instead (mcq/year.mjs)

   The rules are pure and tested (js/library/*.mjs, scripts/library.test.mjs); where things live is library/api.mjs.
   Plain text throughout (esc); the dialog handles its own clicks (data-lib), so osce.mjs only opens it. This module is
   the dialog, Library, Upload and Friends; Study is library-study.mjs (2026-10-27), its actions handed on by act. */
import { esc } from '../core.mjs';
import { icon } from '../study-kit/icons.mjs';
import { dialogOf } from '../study-kit/ui.mjs';
import { ctx, I, notify, openDialog, confirmDlg, now, markerCfg } from './state.mjs';
import { VERIFY_SYSTEM, VERIFY_SCHEMA, verifyPrompt, applyChecks } from '../library/verify.mjs';
import { account } from '../study-kit/sync.mjs';
import { chatPrompt } from '../library/prompt.mjs';
import { checkUpload, deckName, layers, layerLabel, yearLabel, diffLabel, LIMITS } from '../library/item.mjs';
import { summary } from '../library/stats.mjs';
import { grade, counts, soon } from '../library/sched.mjs';
import { today, streak } from '../library/plan.mjs';
import * as api from '../library/api.mjs';
import { reducedMotion, swipe } from '../study-kit/spring.mjs';
import { studyHtml, studyAct, rate, strike, myPref, setPref, saveNote } from './library-study.mjs';
const TABS = [['study', 'Study'], ['library', 'Library'], ['friends', 'Friends']];   /* Study first: the daily routine is open, Start (critique 2026-10-26); Upload lives inside Library */
const tabOf = tab => (tab === 'upload' ? 'library' : tab), tabIdx = tab => TABS.findIndex(t => t[0] === tabOf(tab));
const REPORTS = { key: 'The answer is wrong', outdated: 'Out of date', unclear: 'Unclear', typo: 'A typo' };   /* 0010_mcq_reports.sql */
const LET = 'ABCDE', GLABEL = { again: 'Again', hard: 'Hard', good: 'Good', easy: 'Easy' };
const SEV = { block: ['Must fix', 'danger'], major: ['Fix', 'warn'], minor: ['Tip', 'tip'] };
const V = { tab: 'study', lib: null, up: { text: '', res: null, deck: '' }, st: { deck: '', topic: '', cat: '', year: 0, diff: 0, view: '', q: null, i: 0, pick: null, n: 0, right: 0, mode: 'tutor', order: 'due', ends: 0, label: '', note: false }, bank: null, share: '', busy: false, msg: '' };
const day = () => new Date(now()).toISOString().slice(0, 10);

/* the start view's card */
/* the way into Playlists (osce/playlists-view.mjs), on the Library tab whether or not you have decks yet */
const PLAYLISTS_ROW = () => `<button class="os-libplaylists" data-lib="playlists"><span class="os-libplaylists-art" aria-hidden="true">${icon('users')}</span><span><b>Playlists</b><small>The community's questions: trending, favourites, and yours published</small></span><span class="os-chev" aria-hidden="true">${I.chevR}</span></button>`;

export function libraryCardHtml() {
  const lib = api.current(), all = api.allItems(lib), c = counts(all.map(x => ({ id: x.key })), api.studyMem().card, now());
  const mem = api.studyMem(), t = now(), sk = streak(mem.days, t), td = today(mem.days, t, myPref().goal);
  const sub = sk.days || td.n ? `${td.n} of ${td.goal} today${c.due ? ` · ${c.due} due` : ''}`
    : all.length ? `${all.length} question${all.length === 1 ? '' : 's'}${c.due ? ` · ${c.due} due` : ''}${lib.shared.length ? ` · ${lib.shared.length} from friends` : ''}`
    : 'The bank and your own decks';
  /* the streak is on Start, so the habit is seen before the tap (Duolingo) */
  return `<button class="os-card os-bigcard os-in" data-os="lib" style="--d:3">
    <span class="os-bigic">${icon('cards')}</span>
    <span class="os-bigtx"><strong>Your questions${sk.days ? ` <span class="os-libstartstreak${sk.live ? ' live' : ''}">${icon('flame')}${sk.days}</span>` : ''}</strong><span>${esc(sub)}</span></span>
    <span class="os-chev">${I.chevR}</span></button>`;
}

export async function libraryDlg(tab) {
  V.tab = TABS.some(t => t[0] === tab) || tab === 'upload' ? tab : V.tab; V.lib = api.current(); V.st.q = null; V.st.view = ''; V.share = ''; V.msg = '';   /* the sheet opens at the top of its tab, not on a page pushed last time */
  if (V.tab === 'upload' && tab !== 'upload') V.tab = 'library';
  const d = openDialog({ kind: 'lib', title: 'Your questions', cls: 'os-dlg--lib', onClose: () => ctx.render?.(),
    body: `<div class="os-lib"><nav class="os-libtabs" role="tablist" aria-label="Your questions">${TABS.map(([id, label]) => `<button role="tab" data-lib="tab" data-tab="${id}" id="os-libt-${id}" aria-controls="os-libp" aria-selected="${id === tabOf(V.tab)}" tabindex="${id === tabOf(V.tab) ? 0 : -1}">${label}</button>`).join('')}<span class="os-libtabs-ind" aria-hidden="true" style="--i:${tabIdx(V.tab)}"></span></nav>
      <div class="os-libp" id="os-libp" role="tabpanel" tabindex="-1"></div></div>` });
  wire(d.el);
  paint();
  if (V.lib.signedIn) {
    try { const n = await api.adoptLocal(); if (n) notify(`${n} question${n === 1 ? '' : 's'} from this phone moved onto your account.`, 'success'); } catch {}
    reload();
  }
  api.pullStudy().then(n => { if (n && V.tab === 'study' && !V.st.q) paint(); });
}
async function reload() {
  try { V.lib = await api.refresh(); } catch (e) { if (/Sign in again/.test(e.message)) V.lib = api.current(); else V.msg = 'Offline: showing what this phone last had.'; }
  if (dlg()) paint();
}
const dlg = () => dialogOf(ctx.ov, 'lib')?.el;
const panel = () => dlg()?.querySelector('.os-libp');

function wire(el) {
  el.addEventListener('submit', e => e.preventDefault());   /* Enter in Add a friend clicks its button, which does the work */
  let hold = null;
  el.addEventListener('pointerdown', e => {
    const b = e.target.closest('.os-libopt'); hold = null;
    if (!b || b.hasAttribute('aria-disabled') || e.button > 0) return;
    hold = { x: e.clientX, y: e.clientY, t: setTimeout(() => { hold.fired = true; strike(+b.dataset.i); }, 420) };
  });
  el.addEventListener('pointermove', e => { if (hold && !hold.fired && Math.hypot(e.clientX - hold.x, e.clientY - hold.y) > 10) { clearTimeout(hold.t); hold = null; } });
  ['pointerup', 'pointercancel'].forEach(t => el.addEventListener(t, () => { if (hold && !hold.fired) { clearTimeout(hold.t); hold = null; } }));
  el.addEventListener('click', e => { if (hold?.fired && e.target.closest('.os-libopt')) { e.stopPropagation(); e.preventDefault(); hold = null; } }, true);
  el.addEventListener('contextmenu', e => { const b = e.target.closest('.os-libopt'); if (!b || b.hasAttribute('aria-disabled')) return; e.preventDefault(); if (!hold?.fired) strike(+b.dataset.i); });
  el.addEventListener('click', e => { const b = e.target.closest('[data-lib]'); if (b && !b.disabled && el.contains(b)) act(b.dataset.lib, b, e); });
  el.addEventListener('input', e => { if (e.target.name === 'find') { V.find = e.target.value; clearTimeout(V.findT); V.findT = setTimeout(() => { const pos = e.target.selectionStart; paint(); const f = panel()?.querySelector('[name="find"]'); if (f) { f.focus(); f.setSelectionRange(pos, pos); } }, 160); return; } if (e.target.name === 'notes') { V.up.notes = e.target.value; const b = panel()?.querySelector('[data-lib="copyprompt"] span'); if (b) b.textContent = V.up.notes.trim() ? 'Copy the prompt with my notes' : 'Copy the prompt'; return; } if (e.target.matches?.('[data-lib-note]')) { clearTimeout(saveNote.t); const v = e.target.value; saveNote.t = setTimeout(() => saveNote(v), 400); return; } if (e.target.name === 'paste') { V.up.text = e.target.value; V.up.res = null; V.up.check = null; paintUploadResult(); } if (e.target.name === 'deck') V.up.deck = e.target.value; });
  el.addEventListener('change', e => {
    if (e.target.name === 'file') readFile(e.target);
    if (e.target.name === 'exam') { V.goalOpen = true; setPref('exam', e.target.value || ''); paint(); return; }
    if (e.target.name === 'sdeck') { V.st.deck = e.target.value; V.st.topic = ''; V.st.cat = ''; V.st.year = 0; paint(); }
  });
}
/* a key while this dialog is on top (osce.mjs onKey hands it over: the overlay stack owns every key, study-kit/stack.mjs).
   In a study card, 1 to 5 answer and then 1 to 4 grade; true when it was used. The arrows on the tabs are OSCE's own */
/* a panel arrives when you go to it, not on every repaint: from the side its tab sits on, a pushed page (Custom, the
   summary, Upload) from the right and back from the left (in and out along one path), otherwise it rises */
function arrive(dx = 0) {
  const p = panel(); if (!p || reducedMotion()) return;
  p.classList.remove('os-libp--enter', 'os-libp--slide'); void p.offsetWidth;
  p.style.setProperty('--dx', dx); p.classList.add('os-libp--enter', ...(dx ? ['os-libp--slide'] : []));
  clearTimeout(arrive.t); arrive.t = setTimeout(() => p.classList.remove('os-libp--enter', 'os-libp--slide'), 900);
}
function go(tab) {
  const from = V.tab;
  dlg()?.querySelector('.os-libtabs-ind')?.style.setProperty('--i', tabIdx(tab));
  V.tab = tab; V.share = '';
  dlg()?.querySelectorAll('[role="tab"]').forEach(b => { const on = b.dataset.tab === tabOf(tab); b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; });
  paint(); arrive(tab === 'upload' ? 1 : from === 'upload' && tab === 'library' ? -1 : Math.sign(tabIdx(tab) - tabIdx(from)));
}

/* ---------------------------------------------------------------- painting */
function paint() {
  const p = panel(); if (!p) return;
  p.setAttribute('aria-labelledby', `os-libt-${tabOf(V.tab)}`);
  p.innerHTML = (V.msg ? `<p class="os-libnote">${esc(V.msg)}</p>` : '') + ({ library: libraryHtml, upload: uploadHtml, friends: friendsHtml, study: studyHtml })[V.tab]();
  if (V.tab === 'upload') paintUploadResult();
  dlg()?.querySelector('.os-lib')?.classList.toggle('os-lib--sub', !!p.querySelector(':scope > .os-libsumhead'));
  p.querySelectorAll('.os-libdecks, .os-libgapl, .os-libfriends, .os-libbars').forEach(ul => [...ul.children].forEach((li, i) => li.style.setProperty('--n', i)));
  /* an answered card swipes away to Next (study-kit/spring.mjs swipe: 1:1, momentum decides, flies off at the finger's speed) */
  const card = p.querySelector('.os-libcard');
  if (card && V.st.q && V.st.pick != null) swipe(card, { canStart: () => V.st.pick != null, onCommit: () => { const x = V.st.q?.[V.st.i]; if (x) rate(V.st.pick === x.item.answer ? 'good' : 'again'); } });
  V.tap = '';
}
const signInHtml = why => `<div class="os-libsign"><p>${esc(why)}</p><button class="os-btn os-primary" data-os="signin">${icon('users')}<span>Sign in</span></button></div>`;
/* signed in from the sheet over this one: the library comes back with your decks, on the same tab */
if (typeof document !== 'undefined') document.addEventListener('os-account', () => { if (dlg()) reload(); });
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

function libraryHtml() {
  const { decks, shared, signedIn, friends } = V.lib, cards = api.studyMem().card, t = now();
  const friendsOk = friends.filter(f => f.status === 'friends');
  const due = (d, owner) => counts(d.items.map(it => ({ id: api.cardKey(it, owner) })), cards, t);
  const deckRow = (d, owner) => {
    const c = due(d, owner), mine = !owner;
    return `<li class="os-libdeck" data-deck="${esc(d.id)}">
      <div class="os-libdeck-top"><strong>${esc(d.name)}</strong></div>
      <p class="os-libmeta">${[plural(d.items.length, 'question'), c.due ? `<b>${c.due} due</b>` : '', c.new && c.new < d.items.length ? `${c.new} new` : '', owner ? `from ${esc(d.owner_name)}` : d.shared.length ? `shared with ${esc(d.shared.map(id => friends.find(f => f.id === id)?.name || 'a friend').join(', '))}` : ''].filter(Boolean).join(' · ')}</p>
      <div class="os-libacts">
        <button class="os-btn os-primary" data-lib="studydeck" data-deck="${esc(d.id)}"${d.items.length ? '' : ' disabled'}>${icon('cards')}<span>Study</span></button>
        ${mine && signedIn ? `<button class="os-btn" data-lib="share" data-deck="${esc(d.id)}" aria-expanded="${V.share === d.id}">${icon('share')}<span>Share</span></button>` : ''}
      </div>
      ${mine && V.share === d.id ? `<div class="os-libshare" role="group" aria-label="Share ${esc(d.name)} with">${friendsOk.length ? friendsOk.map(f => { const on = d.shared.includes(f.id); return `<button class="os-chip${on ? ' on' : ''}" data-lib="sharewith" data-deck="${esc(d.id)}" data-friend="${esc(f.id)}" aria-pressed="${on}">${on ? I.check : ''}${esc(f.name)}</button>`; }).join('') : `<p class="os-libmeta">Add a friend first, in Friends.</p>`}</div>` : ''}
      <details class="os-libqs"><summary>See ${plural(d.items.length, 'question')}</summary><ol>${d.items.map(it => `<li><span><span class="os-liblayer">${it.year ? `${esc(yearLabel(it))} · ` : ''}${esc(layerLabel(it))}</span>${esc(it.stem.length > 150 ? `${it.stem.slice(0, 150)}…` : it.stem)}</span>${mine ? `<button class="os-libx" data-lib="delq" data-deck="${esc(d.id)}" data-id="${esc(it.id)}" aria-label="Delete this question">${I.x}</button>` : ''}</li>`).join('')}</ol>${mine ? `<button class="os-link os-libdel" data-lib="deldeck" data-deck="${esc(d.id)}">Delete deck</button>` : ''}</details>
    </li>`;
  };
  if (!decks.length && !shared.length) return `${signedIn ? '' : signInHtml('Signed out: questions you upload stay on this phone. Sign in to keep them on your account, on every device, and to share them with friends.')}
    <div class="os-libempty">${icon('cards')}<p><strong>No questions yet</strong><br>ChatGPT can write them from your notes, in the format Med-OS reads.</p><button class="os-btn os-btn--lg os-primary" data-lib="tab" data-tab="upload">${icon('plus')}<span>Upload questions</span></button></div>
    ${PLAYLISTS_ROW()}`;
  const qn = (V.find || '').trim().toLowerCase(), found = qn.length > 1 ? api.allItems(V.lib).filter(e => `${e.item.stem} ${e.item.ask || ''} ${e.item.options.join(' ')} ${e.item.topic}`.toLowerCase().includes(qn)).slice(0, 30) : null;
  return `${signedIn ? '' : signInHtml('Signed out: these stay on this phone. Sign in to keep them on your account and share them.')}
    ${api.allItems(V.lib).length >= 20 || V.find ? `<label class="os-libfind">${I.search}<input type="search" name="find" placeholder="Find a question" value="${esc(V.find || '')}" aria-label="Find a question in your library" enterkeyhint="search"></label>` : ''}
    ${found ? `<p class="os-libmeta">${plural(found.length, 'question')} found</p><ul class="os-libgapl os-libfound" role="list">${found.map(e => `<li class="os-libgap"><div><span class="os-liblayer">${esc(layerLabel(e.item))} · ${esc(e.deckName)}</span><b>${esc(e.item.stem.length > 140 ? `${e.item.stem.slice(0, 140)}…` : e.item.stem)}</b><small>${esc(e.item.options[e.item.answer])}</small></div></li>`).join('')}</ul>` : ''}
    ${decks.length ? `<h3 class="os-libh">Your decks</h3><ul class="os-libdecks" role="list">${decks.map(d => deckRow(d, '')).join('')}</ul>` : ''}
    ${shared.length ? `<h3 class="os-libh">From friends</h3><ul class="os-libdecks" role="list">${shared.map(d => deckRow(d, d.owner)).join('')}</ul>` : ''}
    <button class="os-btn os-libadd" data-lib="tab" data-tab="upload">${icon('plus')}<span>${decks.length ? 'Upload more' : 'Upload questions'}</span></button>
    ${PLAYLISTS_ROW()}`;
}

function uploadHtml() {
  const names = V.lib.decks.map(d => d.name), deck = V.up.deck || names[0] || 'My questions';
  return `<div class="os-libsumhead"><button class="os-link" data-lib="tab" data-tab="library">${I.back}<span>Library</span></button><h3>Upload questions</h3></div>
  <ol class="os-libsteps">
    <li><h3>Ask ChatGPT</h3><p>Add notes if you like, copy the prompt, paste it into ChatGPT.</p>
      <label class="os-setf"><span>Your notes (optional)</span><textarea name="notes" rows="3" placeholder="e.g. Croup, bronchiolitis and the febrile infant: my week 3 paeds notes…">${esc(V.up.notes || '')}</textarea></label>
      <div class="os-libacts os-libacts--even"><button class="os-btn os-primary" data-lib="copyprompt">${icon('clipboardCheck')}<span>${V.up.notes?.trim() ? 'Copy the prompt with my notes' : 'Copy the prompt'}</span></button>
      <a class="os-btn" href="https://chatgpt.com/" target="_blank" rel="noopener noreferrer">Open ChatGPT</a></div>
      <details class="os-libprompt"><summary>See the prompt</summary><textarea readonly rows="8" aria-label="The prompt for ChatGPT">${esc(chatPrompt())}</textarea></details></li>
    <li><h3>Paste the reply</h3>
      <label class="os-setf"><span>Paste ChatGPT's reply</span><textarea name="paste" rows="6" spellcheck="false" placeholder='[{ "stem": "A 4-year-old boy…", "options": […], "answer": "A", "specialty": "Paediatrics", "kind": "clinical", … }]'>${esc(V.up.text)}</textarea></label>
      <label class="os-libfile"><input type="file" name="file" accept=".json,.csv,.txt,application/json,text/csv,text/plain"><span>${icon('plus')}Or choose a file</span></label></li>
    <li><h3>Check and save</h3><div class="os-libres" aria-live="polite"></div>
      <label class="os-setf"><span>Deck</span><input name="deck" maxlength="${LIMITS.deckName}" list="os-libdecknames" value="${esc(deck)}" autocomplete="off"></label>
      ${names.length ? `<div class="os-libchips os-libdeckchips" aria-label="Your decks">${names.slice(0, 6).map(n => `<button class="os-chip${n === deck ? ' on os-still' : ''}" data-lib="deckpick" data-v="${esc(n)}">${esc(n)}</button>`).join('')}</div>` : ''}
      <datalist id="os-libdecknames">${names.map(n => `<option value="${esc(n)}">`).join('')}</datalist>
      <button class="os-btn os-btn--lg os-primary os-libsave" data-lib="save" disabled>Save</button></li>
  </ol>
  <p class="os-libmeta os-libpool">Your questions are yours and your friends'. For everyone's bank, <button class="os-link" data-os="mcqnew">submit one for review</button>.</p>`;
}
function paintUploadResult() {
  const p = panel(), box = p?.querySelector('.os-libres'), btn = p?.querySelector('.os-libsave'); if (!box) return;
  const text = V.up.text.trim();
  if (!text) { box.innerHTML = '<p class="os-libmeta">Each question is checked here as soon as you paste it.</p>'; btn.disabled = true; btn.textContent = 'Save'; return; }
  const have = api.allItems(V.lib).filter(x => !x.owner).map(x => x.item);
  const r = V.up.res ||= checkUpload(text, { by: account()?.name || 'You', now: now(), have });
  if (!r.rows.length) { box.innerHTML = `<p class="os-liberr" role="alert">No questions found. Paste ChatGPT's whole answer: a JSON list that starts with [ (or CSV with a header row).</p>`; btn.disabled = true; btn.textContent = 'Save'; return; }
  const bad = r.rows.filter(x => !x.item), tips = r.rows.filter(x => x.item && x.problems.length);
  const by = layers(r.ready).map(t => `${t.topic} ${t.count}`).join(' · ');
  const row = x => `<li><span class="os-libn">${x.n}</span><div><p>${esc(x.stem || '(no stem)')}</p><ul>${x.problems.map(p2 => `<li><span class="os-mcqsev os-mcqsev--${SEV[p2.severity][1]}">${SEV[p2.severity][0]}</span><span>${esc(p2.reason)}</span></li>`).join('')}</ul></div></li>`;
  box.innerHTML = `<p class="os-libsum"><b>${plural(r.ready.length, 'question')} ready</b>${bad.length ? ` · <span class="os-libbad">${bad.length} to fix</span>` : ''}${by ? `<br><span class="os-libmeta">${esc(by)}</span>` : ''}</p>
    ${checkHtml(r)}
    ${r.ready[0] ? (() => { const q = r.ready[0]; return `<figure class="os-libprev" aria-label="How the first one looks"><figcaption class="os-liblayer">${esc([yearLabel(q), diffLabel(q), layerLabel(q)].filter(Boolean).join(' · '))}</figcaption><p>${esc(q.stem.length > 220 ? `${q.stem.slice(0, 220)}…` : q.stem)}${q.ask ? ` <b>${esc(q.ask)}</b>` : ''}</p><ol>${q.options.map((o, i) => `<li${i === q.answer ? ' class="ok"' : ''}><b>${LET[i]}</b><span>${esc(o)}</span></li>`).join('')}</ol></figure>`; })() : ''}
    ${r.more ? `<p class="os-liberr">Only the first ${LIMITS.upload} are read: upload the rest after.</p>` : ''}
    ${bad.length ? `<details class="os-libprobs" open><summary>Not saved until fixed (${bad.length})</summary><p class="os-libmeta">Ask ChatGPT to fix these and paste again; the ready ones are not saved twice.</p><ol>${bad.map(row).join('')}</ol></details>` : ''}
    ${tips.length ? `<details class="os-libprobs"><summary>Ready, with tips (${tips.length})</summary><ol>${tips.map(row).join('')}</ol></details>` : ''}`;
  btn.disabled = !r.ready.length || V.busy; btn.textContent = r.ready.length ? `Save ${plural(r.ready.length, 'question')}` : 'Save';
}
/* Check the medicine (library/verify.mjs): Claude answers each ready question blind with the student's own key; one it
   disagrees with is held back with its reason, unless kept anyway */
function checkHtml(r) {
  const c = V.up.check;
  if (!r.ready.length && !c?.held?.length) return '';
  if (!markerCfg().key) return `<p class="os-libcheck os-libcheck--off">${icon('stethoscope')}<span>ChatGPT gets about one question in five wrong. Add your Anthropic key in Settings (AI marking) and Claude can check each answer before you save.</span></p>`;
  if (!c) return `<button class="os-btn os-libcheck" data-lib="verify">${icon('stethoscope')}<span>Check the medicine with Claude</span></button>`;
  if (c.busy) return `<p class="os-libcheck">${icon('stethoscope')}<span>Claude is checking ${plural(c.n, 'question')}…</span></p>`;
  const held = c.held.filter(h => !c.kept?.has(h.item.id));
  return `<div class="os-libcheck os-libcheck--done"><p>${icon('stethoscope')}<span><b>Claude checked ${plural(c.n, 'question')}</b>: ${c.n - c.held.length} agree${c.held.length ? `, ${c.held.length} held back` : ''}.</span></p>
    ${held.length ? `<ol class="os-libheld">${held.map(h => `<li><p>${esc(h.item.stem.length > 140 ? `${h.item.stem.slice(0, 140)}…` : h.item.stem)}</p><p class="os-libheld-why">${esc(h.issue)}</p><button class="os-link" data-lib="keepheld" data-id="${esc(h.item.id)}">Keep it anyway</button></li>`).join('')}</ol>` : ''}</div>`;
}
async function verify() {
  const r = V.up.res; if (!r?.ready.length) return;
  const all = [...r.ready]; V.up.check = { busy: true, n: all.length }; paintUploadResult();
  try {
    const { default: Anthropic } = await import('../vendor/anthropic-sdk.mjs');
    const { key, model } = markerCfg(), client = new Anthropic({ apiKey: key, dangerouslyAllowBrowser: true }), checks = [];
    for (let i = 0; i < all.length; i += 25) {
      const res = await client.messages.create({ model, max_tokens: 8000, system: VERIFY_SYSTEM, output_config: { effort: 'medium', format: { type: 'json_schema', schema: VERIFY_SCHEMA } }, messages: [{ role: 'user', content: verifyPrompt(all.slice(i, i + 25)) }] });
      const text = res.content.filter(b => b.type === 'text').map(b => b.text).join('');
      checks.push(...(JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)).checks || []));
    }
    const out = applyChecks(all, checks);
    V.up.check = { n: all.length, held: out.held, kept: new Set(), all };
    r.ready = out.pass;
    notify(out.held.length ? `${plural(out.held.length, 'question')} held back: see why below.` : 'Claude agrees with every answer.', out.held.length ? '' : 'success');
  } catch (e) { V.up.check = null; notify(`The check did not run: ${String(e.message || e).slice(0, 120)}`, 'danger'); }
  paintUploadResult();
}
async function readFile(input) {
  const f = input.files?.[0]; if (!f) return;
  if (f.size > 4e6) { notify('That file is over 4 MB: split it.', 'danger'); input.value = ''; return; }
  V.up.text = await f.text(); V.up.res = null; V.up.check = null; input.value = '';
  const ta = panel()?.querySelector('[name="paste"]'); if (ta) ta.value = V.up.text;
  paintUploadResult();
}
async function save() {
  const r = V.up.res, name = deckName(panel()?.querySelector('[name="deck"]')?.value || '');
  if (!r?.ready.length) return;
  if (!name) { notify('Name the deck.', 'danger'); panel()?.querySelector('[name="deck"]')?.focus(); return; }
  V.busy = true; paintUploadResult();
  try {
    const out = await api.upload(name, r.ready);
    V.lib = api.current(); V.up = { text: '', res: null, deck: name, check: null };
    notify(`${out.added} saved to ${out.name}`, 'success');
    go('library');
  } catch (e) { notify(e.message || 'That did not save. Try again.', 'danger'); }
  finally { V.busy = false; if (V.tab === 'upload') paintUploadResult(); }
}

function friendsHtml() {
  if (!V.lib.signedIn) return signInHtml('Friends need an account: sign in with the name and PIN you use for Duel a Mate (or make one), then add friends by their name.');
  const f = V.lib.friends, by = s => f.filter(x => x.status === s);
  const row = (x, acts) => `<li class="os-libfriend"><span class="os-libav" aria-hidden="true">${esc((x.name || '?')[0].toUpperCase())}</span><strong>${esc(x.name)}</strong><span class="os-libacts">${acts}</span></li>`;
  const inc = by('incoming'), fr = by('friends'), out = by('outgoing');
  if (fr.length && !V.week) { V.week = 'loading'; api.friendWeek().then(w => { V.week = Array.isArray(w) ? w : []; if (V.tab === 'friends') paint(); }).catch(() => { V.week = []; }); }
  const wk = Array.isArray(V.week) && V.week.length > 1 ? V.week : null, top = wk ? Math.max(1, ...wk.map(x => x.week)) : 1;
  return `<form class="os-libaddf" data-lib-form="add" novalidate><label class="os-setf"><span>Add a friend by their name</span><span class="os-librow"><input name="fname" maxlength="20" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Friend's name"><button class="os-btn os-primary" data-lib="addfriend" type="submit">Add</button></span></label>
      <p class="os-libmeta">Friends add you as <b>${esc(V.lib.me?.name || '')}</b>.</p></form>
    ${wk ? `<h3 class="os-libh">This week</h3><ol class="os-libweek">${wk.map((x, i) => `<li class="${x.me ? 'me' : ''}"><span class="os-libweek-n">${i + 1}</span><span class="os-libav" aria-hidden="true">${esc((x.name || '?')[0].toUpperCase())}</span><span class="os-libweek-tx"><b>${esc(x.me ? `${x.name} (you)` : x.name)}</b><small>${plural(x.days, 'day')} studied</small><span class="os-libweek-bar" aria-hidden="true"><i style="transform:scaleX(${(x.week / top).toFixed(3)})"></i></span></span><span class="os-libweek-v">${x.week}</span></li>`).join('')}</ol><p class="os-libmeta">Answers in Study in the last 7 days. Effort, not scores.</p>` : ''}
    ${inc.length ? `<h3 class="os-libh">Asking to be friends</h3><ul class="os-libfriends" role="list">${inc.map(x => row(x, `<button class="os-btn os-primary" data-lib="accept" data-id="${esc(x.id)}">Accept</button><button class="os-btn" data-lib="decline" data-id="${esc(x.id)}">Decline</button>`)).join('')}</ul>` : ''}
    ${(() => {
      const list = `<ul class="os-libfriends" role="list">${fr.map(x => row(x, `<button class="os-btn os-libicon" data-lib="unfriend" data-id="${esc(x.id)}" data-name="${esc(x.name)}" aria-label="Remove ${esc(x.name)}" title="Remove">${icon('trash')}</button>`)).join('')}</ul>`;
      if (!fr.length) return '<h3 class="os-libh">Friends</h3><p class="os-libmeta">None yet. Once a friend accepts, share a deck with them from Library, and their shared decks show up there for you.</p>';
      return wk ? `<details class="os-libsettings os-libmanage"><summary>Manage friends (${fr.length})</summary>${list}</details>` : `<h3 class="os-libh">Friends (${fr.length})</h3>${list}`;
    })()}
    ${out.length ? `<h3 class="os-libh">Waiting for them</h3><ul class="os-libfriends" role="list">${out.map(x => row(x, `<button class="os-btn" data-lib="decline" data-id="${esc(x.id)}">Cancel</button>`)).join('')}</ul>` : ''}`;
}

/* ---------------------------------------------------------------- actions (Study's are library-study.mjs studyAct) */
async function act(a, b, e) {
  switch (a) {
    case 'tab': return go(b.dataset.tab);
    case 'playlists': return import('./playlists-view.mjs').then(m => m.openPlaylists({ opener: b }));   /* the community library (0011_playlists.sql) */
    case 'copyprompt': {
      const withNotes = (V.up.notes || '').trim();
      try { await navigator.clipboard.writeText(chatPrompt(withNotes)); notify('Copied. Paste it into ChatGPT.', 'success'); }
      catch { const d = panel()?.querySelector('.os-libprompt'); if (d) { d.open = true; d.querySelector('textarea').select(); } notify('Copy it from the box below.', ''); }
      return;
    }
    case 'save': return save();
    case 'verify': return verify();
    case 'readall': { const p = b.previousElementSibling; p?.classList.remove('clamp'); b.remove(); return; }
    case 'keepheld': { const c = V.up.check, h = c?.held.find(x => x.item.id === b.dataset.id); if (!h) return; c.kept.add(h.item.id); V.up.res.ready.push(h.item); return paintUploadResult(); }
    case 'deckpick': { V.up.deck = b.dataset.v; const inp = panel()?.querySelector('[name="deck"]'); if (inp) inp.value = b.dataset.v; panel()?.querySelectorAll('.os-libdeckchips .os-chip').forEach(c => c.classList.toggle('on', c === b)); return; }
    case 'share': V.share = V.share === b.dataset.deck ? '' : b.dataset.deck; return paint();
    case 'sharewith': {
      const on = b.getAttribute('aria-pressed') !== 'true'; b.disabled = true;
      try { await api.share(b.dataset.deck, b.dataset.friend, on); V.lib = api.current(); notify(on ? `Shared with ${b.textContent.trim()}.` : `No longer shared with ${b.textContent.trim()}.`, 'success'); }
      catch (err) { notify(err.message, 'danger'); }
      return paint();
    }
    case 'deldeck': {
      const d = V.lib.decks.find(x => x.id === b.dataset.deck); if (!d) return;
      if (!await confirmDlg({ title: `Delete ${d.name}?`, message: `Its ${plural(d.items.length, 'question')} go too, for you and anyone you shared it with. This cannot be undone.`, confirm: 'Delete'})) return;
      try { V.lib = await api.remove(d.id); notify(`${d.name} deleted.`, 'success'); } catch (err) { notify(err.message, 'danger'); }
      return paint();
    }
    case 'delq': {
      if (!await confirmDlg({ title: 'Delete this question?', message: 'It goes from the deck, for you and anyone it is shared with.', confirm: 'Delete'})) return;
      try { V.lib = await api.remove(b.dataset.deck, b.dataset.id); } catch (err) { notify(err.message, 'danger'); }
      return paint();
    }
    case 'addfriend': {
      e.preventDefault();
      const inp = panel()?.querySelector('[name="fname"]'), name = inp?.value.trim();
      if (!name) { inp?.setAttribute('aria-invalid', 'true'); inp?.focus(); return; }
      b.disabled = true;
      try { const r = await api.addFriend(name); V.lib = api.current(); notify(r.status === 'friends' ? `You and ${r.name} are friends.` : `Asked ${r.name}. They will see it in Friends.`, 'success'); paint(); }
      catch (err) { b.disabled = false; inp?.setAttribute('aria-invalid', 'true'); notify(err.message, 'danger'); inp?.focus(); }
      return;
    }
    case 'accept': case 'decline': {
      V.week = null;
      b.disabled = true;
      try { await api.answerFriend(b.dataset.id, a === 'accept'); V.lib = api.current(); } catch (err) { notify(err.message, 'danger'); }
      return paint();
    }
    case 'unfriend': {
      if (!await confirmDlg({ title: `Remove ${b.dataset.name}?`, message: 'Decks you share with each other stop being shared.', confirm: 'Remove'})) return;
      try { await api.answerFriend(b.dataset.id, false); V.lib = api.current(); } catch (err) { notify(err.message, 'danger'); }
      return paint();
    }
  }
  return studyAct(a, b, e);
}

export { libraryKey } from './library-study.mjs';
/* what library-study.mjs shares with the dialog */
export { V, paint, panel, dlg, arrive, day, plural, go, LET, REPORTS, tabIdx };
