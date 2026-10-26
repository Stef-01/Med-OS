/* osce/library-view.mjs - Your questions (docs/library.md; founder 2026-10-25): upload MCQs written by ChatGPT from
   your notes, study them, share decks with friends, and duel on them. One dialog, four tabs:

     Library   your decks and the decks friends share with you; study a deck, share it, delete it or a question
     Upload    1 copy the prompt for ChatGPT  2 paste what it returns (or choose the file)  3 see each question's
               checks  4 save to a deck: live at once, in Study and in Duel a Mate
     Friends   add by name, answer requests, remove
     Study     due cards first, by deck (yours, friends', or the bank), specialty, kind and year; answer, see why, then
               Again, Hard, Good or Easy. 0 to 1 (founder 2026-10-26) climbs Year 1 to final year instead (mcq/year.mjs)

   The rules are pure and tested (js/library/*.mjs, scripts/library.test.mjs); where things live is library/api.mjs.
   Plain text throughout (esc); the dialog handles its own clicks (data-lib), so osce.mjs only opens it. */
import { esc } from '../core.mjs';
import { icon } from '../study-kit/icons.mjs';
import { dialogOf } from '../study-kit/ui.mjs';
import { ctx, I, notify, openDialog, confirmDlg, now, markerCfg } from './state.mjs';
import { VERIFY_SYSTEM, VERIFY_SCHEMA, verifyPrompt, applyChecks } from '../library/verify.mjs';
import { account } from '../study-kit/sync.mjs';
import { chatPrompt } from '../library/prompt.mjs';
import { checkUpload, deckName, layers, layerLabel, yearLabel, diffLabel, inPick, KINDS, KIND_IDS, LIMITS } from '../library/item.mjs';
import { YEARS, YEAR_IDS, DIFFICULTY, DIFF_IDS, ladder } from '../mcq/year.mjs';
import { displayOrder } from '../mcq/schema.mjs';
import { record, summary, wrapped, monthOf, monthName, dayOf } from '../library/stats.mjs';
import { grade, queue, counts, preview, soon, isNew, GRADES } from '../library/sched.mjs';
import { today, streak, heat, session, timedSecs, tally, smart, snapshot, resumable, examPlan, pref as prefOf, GOALS, SIZES, WHICH, ORDERS, MODES } from '../library/plan.mjs';
import { lsGet, lsSet } from '../study-kit/store.mjs';
import * as api from '../library/api.mjs';
import { rpc, accountsOn } from './account.mjs';
import { animate, SPRING, reducedMotion, swipe } from '../study-kit/spring.mjs';

const TABS = [['library', 'Library'], ['upload', 'Upload'], ['friends', 'Friends'], ['study', 'Study']];
const REPORTS = { key: 'The answer is wrong', outdated: 'Out of date', unclear: 'Unclear', typo: 'A typo' };   /* 0010_mcq_reports.sql */
const LET = 'ABCDE', GLABEL = { again: 'Again', hard: 'Hard', good: 'Good', easy: 'Easy' };
const SEV = { block: ['Must fix', 'danger'], major: ['Fix', 'warn'], minor: ['Tip', 'tip'] };
const V = { tab: 'library', lib: null, up: { text: '', res: null, deck: '' }, st: { deck: '', topic: '', cat: '', year: 0, diff: 0, view: '', q: null, i: 0, pick: null, n: 0, right: 0, mode: 'tutor', order: 'due', ends: 0, label: '', note: false }, bank: null, share: '', busy: false, msg: '' };
const day = () => new Date(now()).toISOString().slice(0, 10);

/* the start view's card */
export function libraryCardHtml() {
  const lib = api.current(), all = api.allItems(lib), c = counts(all.map(x => ({ id: x.key })), api.studyMem().card, now());
  const mem = api.studyMem(), t = now(), sk = streak(mem.days, t), td = today(mem.days, t, myPref().goal);
  const sub = sk.days || td.n ? `${td.n} of ${td.goal} today${c.due ? ` · ${c.due} due` : ''}`
    : all.length ? `${all.length} question${all.length === 1 ? '' : 's'}${c.due ? ` · ${c.due} due` : ''}${lib.shared.length ? ` · ${lib.shared.length} from friends` : ''}`
    : 'Study the bank or your own questions from ChatGPT, track your gaps, share with friends.';
  /* the streak is on Start, so the habit is seen before the tap (Duolingo) */
  return `<button class="os-card os-bigcard os-in" data-os="lib" style="--d:3">
    <span class="os-bigic">${icon('cards')}</span>
    <span class="os-bigtx"><strong>Your questions${sk.days ? ` <span class="os-libstartstreak${sk.live ? ' live' : ''}">${icon('flame')}${sk.days}</span>` : ''}</strong><span>${esc(sub)}</span></span>
    <span class="os-chev">${I.chevR}</span></button>`;
}

export async function libraryDlg(tab) {
  V.tab = TABS.some(t => t[0] === tab) ? tab : V.tab; V.lib = api.current(); V.st.q = null; V.share = ''; V.msg = '';
  const d = openDialog({ kind: 'lib', title: 'Your questions', cls: 'os-dlg--lib', onClose: () => ctx.render?.(),
    body: `<div class="os-lib"><nav class="os-libtabs" role="tablist" aria-label="Your questions">${TABS.map(([id, label]) => `<button role="tab" data-lib="tab" data-tab="${id}" id="os-libt-${id}" aria-controls="os-libp" aria-selected="${id === V.tab}" tabindex="${id === V.tab ? 0 : -1}">${label}</button>`).join('')}<span class="os-libtabs-ind" aria-hidden="true" style="--i:${TABS.findIndex(t => t[0] === V.tab)}"></span></nav>
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
  el.addEventListener('click', e => { const b = e.target.closest('[data-lib]'); if (b && !b.disabled && el.contains(b)) act(b.dataset.lib, b, e); });
  el.addEventListener('input', e => { if (e.target.name === 'find') { V.find = e.target.value; clearTimeout(V.findT); V.findT = setTimeout(() => { const pos = e.target.selectionStart; paint(); const f = panel()?.querySelector('[name="find"]'); if (f) { f.focus(); f.setSelectionRange(pos, pos); } }, 160); return; } if (e.target.name === 'notes') { V.up.notes = e.target.value; const b = panel()?.querySelector('[data-lib="copyprompt"] span'); if (b) b.textContent = V.up.notes.trim() ? 'Copy the prompt with my notes' : 'Copy the prompt'; return; } if (e.target.matches?.('[data-lib-note]')) { clearTimeout(saveNote.t); const v = e.target.value; saveNote.t = setTimeout(() => saveNote(v), 400); return; } if (e.target.name === 'paste') { V.up.text = e.target.value; V.up.res = null; V.up.check = null; paintUploadResult(); } if (e.target.name === 'deck') V.up.deck = e.target.value; });
  el.addEventListener('change', e => {
    if (e.target.name === 'file') readFile(e.target);
    if (e.target.name === 'exam') { setPref('exam', e.target.value || ''); paint(); return; }
    if (e.target.name === 'sdeck') { V.st.deck = e.target.value; V.st.topic = ''; V.st.cat = ''; V.st.year = 0; paint(); }
  });
}
/* a key while this dialog is on top (osce.mjs onKey hands it over: the overlay stack owns every key, study-kit/stack.mjs).
   In a study card, 1 to 5 answer and then 1 to 4 grade; true when it was used. The arrows on the tabs are OSCE's own */
export function libraryKey(e) {
  if (V.tab !== 'study' || !V.st.q || e.metaKey || e.ctrlKey || e.altKey || e.target.closest?.('input, textarea, select')) return false;
  const it = V.st.q[V.st.i];
  if (it && V.st.pick == null && /^[1-5]$/.test(e.key) && +e.key <= it.item.options.length) { answer(displayOrder(it.item, it.key)[+e.key - 1]); return true; }
  if (it && V.st.pick != null && /^[1-4]$/.test(e.key)) { rate(GRADES[+e.key - 1]); return true; }
  if (it && V.st.pick != null && (e.key === 'Enter' || e.key === ' ') && !e.target.closest?.('button, a')) { rate(V.st.pick === it.item.answer ? 'good' : 'again'); return true; }
  return false;
}
/* a panel rises in when you arrive at it (a tab, the summary), not on every repaint */
function arrive() { const p = panel(); if (!p || reducedMotion()) return; p.classList.remove('os-libp--enter'); void p.offsetWidth; p.classList.add('os-libp--enter'); clearTimeout(arrive.t); arrive.t = setTimeout(() => p.classList.remove('os-libp--enter'), 900); }
function go(tab) {
  dlg()?.querySelector('.os-libtabs-ind')?.style.setProperty('--i', TABS.findIndex(t => t[0] === tab));
  V.tab = tab; V.share = '';
  dlg()?.querySelectorAll('[role="tab"]').forEach(b => { const on = b.dataset.tab === tab; b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; });
  paint(); arrive();
}

/* ---------------------------------------------------------------- painting */
function paint() {
  const p = panel(); if (!p) return;
  p.setAttribute('aria-labelledby', `os-libt-${V.tab}`);
  p.innerHTML = (V.msg ? `<p class="os-libnote">${esc(V.msg)}</p>` : '') + ({ library: libraryHtml, upload: uploadHtml, friends: friendsHtml, study: studyHtml })[V.tab]();
  if (V.tab === 'upload') paintUploadResult();
  p.querySelectorAll('.os-libdecks, .os-libgapl, .os-libfriends, .os-libbars').forEach(ul => [...ul.children].forEach((li, i) => li.style.setProperty('--n', i)));
  /* an answered card swipes away to Next (study-kit/spring.mjs swipe: 1:1, momentum decides, flies off at the finger's speed) */
  const card = p.querySelector('.os-libcard');
  if (card && V.st.q && V.st.pick != null) swipe(card, { canStart: () => V.st.pick != null, onCommit: () => { const x = V.st.q?.[V.st.i]; if (x) rate(V.st.pick === x.item.answer ? 'good' : 'again'); } });
  V.tap = '';
}
const signInHtml = why => `<div class="os-libsign"><p>${esc(why)}</p><button class="os-btn" data-os="settings">${icon('settings')}<span>Sign in, in Settings</span></button></div>`;
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

function libraryHtml() {
  const { decks, shared, signedIn, friends } = V.lib, cards = api.studyMem().card, t = now();
  const friendsOk = friends.filter(f => f.status === 'friends');
  const due = (d, owner) => counts(d.items.map(it => ({ id: api.cardKey(it, owner) })), cards, t);
  const deckRow = (d, owner) => {
    const c = due(d, owner), mine = !owner;
    return `<li class="os-libdeck" data-deck="${esc(d.id)}">
      <div class="os-libdeck-top"><strong>${esc(d.name)}</strong><span class="os-libcount">${esc(plural(d.items.length, 'question'))}</span></div>
      <p class="os-libmeta">${owner ? `From ${esc(d.owner_name)} · ` : d.shared.length ? `Shared with ${esc(d.shared.map(id => friends.find(f => f.id === id)?.name || 'a friend').join(', '))} · ` : ''}${c.due ? `<b>${c.due} due</b> · ` : ''}${c.new} new</p>
      <div class="os-libacts">
        <button class="os-btn os-primary" data-lib="studydeck" data-deck="${esc(d.id)}"${d.items.length ? '' : ' disabled'}>${icon('cards')}<span>Study</span></button>
        ${mine && signedIn ? `<button class="os-btn" data-lib="share" data-deck="${esc(d.id)}" aria-expanded="${V.share === d.id}">${icon('share')}<span>Share</span></button>` : ''}
        ${mine ? `<button class="os-btn os-libicon" data-lib="deldeck" data-deck="${esc(d.id)}" aria-label="Delete ${esc(d.name)}" title="Delete deck">${icon('trash')}</button>` : ''}
      </div>
      ${mine && V.share === d.id ? `<div class="os-libshare" role="group" aria-label="Share ${esc(d.name)} with">${friendsOk.length ? friendsOk.map(f => { const on = d.shared.includes(f.id); return `<button class="os-chip${on ? ' on' : ''}" data-lib="sharewith" data-deck="${esc(d.id)}" data-friend="${esc(f.id)}" aria-pressed="${on}">${on ? I.check : ''}${esc(f.name)}</button>`; }).join('') : `<p class="os-libmeta">Add a friend first, in Friends.</p>`}</div>` : ''}
      <details class="os-libqs"><summary>The questions</summary><ol>${d.items.map(it => `<li><span><span class="os-liblayer">${it.year ? `${esc(yearLabel(it))} · ` : ''}${esc(layerLabel(it))}</span>${esc(it.stem.length > 150 ? `${it.stem.slice(0, 150)}…` : it.stem)}</span>${mine ? `<button class="os-libx" data-lib="delq" data-deck="${esc(d.id)}" data-id="${esc(it.id)}" aria-label="Delete this question">${I.x}</button>` : ''}</li>`).join('')}</ol></details>
    </li>`;
  };
  if (!decks.length && !shared.length) return `${signedIn ? '' : signInHtml('Signed out: questions you upload stay on this phone. Sign in to keep them on your account, on every device, and to share them with friends.')}
    <div class="os-libempty">${icon('cards')}<p><strong>No questions yet</strong><br>ChatGPT can write them from your notes, in the format Med-OS reads.</p><button class="os-btn os-btn--lg os-primary" data-lib="tab" data-tab="upload">${icon('plus')}<span>Upload questions</span></button></div>`;
  const qn = (V.find || '').trim().toLowerCase(), found = qn.length > 1 ? api.allItems(V.lib).filter(e => `${e.item.stem} ${e.item.ask || ''} ${e.item.options.join(' ')} ${e.item.topic}`.toLowerCase().includes(qn)).slice(0, 30) : null;
  return `${signedIn ? '' : signInHtml('Signed out: these stay on this phone. Sign in to keep them on your account and share them.')}
    <label class="os-libfind">${I.search}<input type="search" name="find" placeholder="Find a question" value="${esc(V.find || '')}" aria-label="Find a question in your library" enterkeyhint="search"></label>
    ${found ? `<p class="os-libmeta">${plural(found.length, 'question')} found</p><ul class="os-libgapl os-libfound" role="list">${found.map(e => `<li class="os-libgap"><div><span class="os-liblayer">${esc(layerLabel(e.item))} · ${esc(e.deckName)}</span><b>${esc(e.item.stem.length > 140 ? `${e.item.stem.slice(0, 140)}…` : e.item.stem)}</b><small>${esc(e.item.options[e.item.answer])}</small></div></li>`).join('')}</ul>` : ''}
    ${decks.length ? `<h3 class="os-libh">Your decks</h3><ul class="os-libdecks" role="list">${decks.map(d => deckRow(d, '')).join('')}</ul>` : ''}
    ${shared.length ? `<h3 class="os-libh">From friends</h3><ul class="os-libdecks" role="list">${shared.map(d => deckRow(d, d.owner)).join('')}</ul>` : ''}
    <button class="os-btn os-libadd" data-lib="tab" data-tab="upload">${icon('plus')}<span>Upload more</span></button>`;
}

function uploadHtml() {
  const names = V.lib.decks.map(d => d.name), deck = V.up.deck || names[0] || 'My questions';
  return `<ol class="os-libsteps">
    <li><h3>Ask ChatGPT</h3><p>Paste your notes, a lecture or a list of topics here (optional), copy the prompt and paste it into ChatGPT. It answers in the format Med-OS reads, each question tagged with its specialty, kind, year and difficulty.</p>
      <label class="os-setf"><span>Your notes (optional)</span><textarea name="notes" rows="3" placeholder="e.g. Croup, bronchiolitis and the febrile infant: my week 3 paeds notes…">${esc(V.up.notes || '')}</textarea></label>
      <div class="os-libacts"><button class="os-btn os-primary" data-lib="copyprompt">${icon('clipboardCheck')}<span>${V.up.notes?.trim() ? 'Copy the prompt with my notes' : 'Copy the prompt'}</span></button>
      <a class="os-btn" href="https://chatgpt.com/" target="_blank" rel="noopener noreferrer">Open ChatGPT</a></div>
      <details class="os-libprompt"><summary>See the prompt</summary><textarea readonly rows="8" aria-label="The prompt for ChatGPT">${esc(chatPrompt())}</textarea></details></li>
    <li><h3>Paste what it gives you</h3>
      <label class="os-setf"><span>ChatGPT's answer (JSON), or CSV with a header row</span><textarea name="paste" rows="6" spellcheck="false" placeholder='[{ "stem": "A 4-year-old boy…", "options": […], "answer": "A", "specialty": "Paediatrics", "kind": "clinical", … }]'>${esc(V.up.text)}</textarea></label>
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
    ${r.ready[0] ? (() => { const q = r.ready[0]; return `<figure class="os-libprev" aria-label="How the first one looks"><figcaption class="os-liblayer">${esc([yearLabel(q), diffLabel(q), layerLabel(q)].filter(Boolean).join(' · '))}</figcaption><p>${esc(q.stem.length > 220 ? `${q.stem.slice(0, 220)}…` : q.stem)}${q.ask ? ` <b>${esc(q.ask)}</b>` : ''}</p><ol>${q.options.map((o, i) => `<li${i === q.answer ? ' class="ok"' : ''}><b>${LET[i]}</b><span>${esc(o)}</span></li>`).join('')}</ol></figure>`; })() : ''}
    ${r.more ? `<p class="os-liberr">Only the first ${LIMITS.upload} are read: upload the rest after.</p>` : ''}
    ${bad.length ? `<details class="os-libprobs" open><summary>Not saved until fixed (${bad.length})</summary><p class="os-libmeta">Fix these in ChatGPT ("question 3 has no kind") and paste again; the ready ones are not saved twice.</p><ol>${bad.map(row).join('')}</ol></details>` : ''}
    ${tips.length ? `<details class="os-libprobs"><summary>Ready, with tips (${tips.length})</summary><ol>${tips.map(row).join('')}</ol></details>` : ''}
    ${checkHtml(r)}`;
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
    notify(`${plural(out.added, 'question')} saved to ${out.name}: live now in Study${V.lib.signedIn ? ' and Duel a Mate' : ''}.`, 'success');
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
  return `<form class="os-libaddf" data-lib-form="add" novalidate><label class="os-setf"><span>Add a friend by their name</span><span class="os-librow"><input name="fname" maxlength="20" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Their Duel a Mate name"><button class="os-btn os-primary" data-lib="addfriend" type="submit">Add</button></span></label>
      <p class="os-libmeta">You are <b>${esc(V.lib.me?.name || '')}</b>: friends add you by that.</p></form>
    ${wk ? `<h3 class="os-libh">This week</h3><ol class="os-libweek">${wk.map((x, i) => `<li class="${x.me ? 'me' : ''}"><span class="os-libweek-n">${i + 1}</span><span class="os-libav" aria-hidden="true">${esc((x.name || '?')[0].toUpperCase())}</span><span class="os-libweek-tx"><b>${esc(x.me ? `${x.name} (you)` : x.name)}</b><small>${plural(x.days, 'day')} studied</small><span class="os-libweek-bar" aria-hidden="true"><i style="transform:scaleX(${(x.week / top).toFixed(3)})"></i></span></span><span class="os-libweek-v">${x.week}</span></li>`).join('')}</ol><p class="os-libmeta">Answers in Study in the last 7 days. Effort, not scores.</p>` : ''}
    ${inc.length ? `<h3 class="os-libh">Asking to be friends</h3><ul class="os-libfriends" role="list">${inc.map(x => row(x, `<button class="os-btn os-primary" data-lib="accept" data-id="${esc(x.id)}">Accept</button><button class="os-btn" data-lib="decline" data-id="${esc(x.id)}">Decline</button>`)).join('')}</ul>` : ''}
    <h3 class="os-libh">Friends${fr.length ? ` (${fr.length})` : ''}</h3>
    ${fr.length ? `<ul class="os-libfriends" role="list">${fr.map(x => row(x, `<button class="os-btn os-libicon" data-lib="unfriend" data-id="${esc(x.id)}" data-name="${esc(x.name)}" aria-label="Remove ${esc(x.name)}" title="Remove">${icon('trash')}</button>`)).join('')}</ul>` : '<p class="os-libmeta">None yet. Once a friend accepts, share a deck with them from Library, and their shared decks show up there for you.</p>'}
    ${out.length ? `<h3 class="os-libh">Waiting for them</h3><ul class="os-libfriends" role="list">${out.map(x => row(x, `<button class="os-btn" data-lib="decline" data-id="${esc(x.id)}">Cancel</button>`)).join('')}</ul>` : ''}`;
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
    V.bank = (await r.json()).questions.map(q => ({ item: { id: q.id, stem: q.stem, options: q.options, answer: q.answer, explanation: q.why || '', why: Array.isArray(q.notes) ? q.notes : [], topic: q.topic || '', cat: q.cat || '', year: q.year || 0, difficulty: q.difficulty || 0, ...(q.credit ? { credit: q.credit } : {}) }, deck: BANK, deckName: 'The bank', owner: '', ownerName: '', key: `b:${q.id}` }));
  } catch { V.bank = []; }
  return V.bank;
}
const everything = () => [...api.allItems(V.lib), ...(V.bank || [])];
function studyPool() {
  const d = V.st.deck;
  if (d === BANK) return V.bank || [];
  return d ? api.allItems(V.lib).filter(x => x.deck === d) : everything();
}
const inStudyPick = x => inPick(x.item, V.st) && (!V.st.year || x.item.year === V.st.year) && (!V.st.diff || x.item.difficulty === V.st.diff);
const myPref = () => prefOf(api.studyMem().pref);
function setPref(k, v) { const m = api.studyMem(); m.pref = prefOf({ ...prefOf(m.pref), [k]: v }); api.saveStudy(m); }
const LIVE = 'osce.lib.session';   /* the session you are in, on this device: Resume on the home within 12 hours */
const saveLive = () => { try { if (V.st.q && V.st.i < V.st.q.length) lsSet(LIVE, snapshot(V.st, now())); else lsSet(LIVE, null); } catch {} };
const startedToday = () => { const m = api.studyMem(); return m.day?.d === day() ? m.day.n | 0 : 0; };

function studyHtml() {
  if (!V.bank) { loadBank().then(() => { if (V.tab === 'study' && !V.st.q) paint(); }); return '<p class="os-libmeta">Loading…</p>'; }
  if (V.st.q) return cardHtml();
  if (V.st.view === 'summary') return summaryHtml();
  if (V.st.view === 'custom') return customHtml();
  if (V.st.view === 'notebook') return notebookHtml();
  return homeHtml();
}

/* the goal ring: an arc that fills as today's answers reach the goal (a spring brings it there) */
const ring = (frac, n, goal) => `<div class="os-libring" role="img" aria-label="${n} of ${goal} today" style="--p:${frac.toFixed(3)}"><svg viewBox="0 0 44 44" aria-hidden="true"><circle cx="22" cy="22" r="19"/><circle class="arc" cx="22" cy="22" r="19" pathLength="100"/></svg><b>${n}</b><small>of ${goal}</small></div>`;
function homeHtml() {
  const mem = api.studyMem(), p = myPref(), t = now(), all = everything(), td = today(mem.days, t, p.goal), sk = streak(mem.days, t);
  const tl = tally(all, mem.card, t), plan = examPlan(p.exam, tl.fresh, t), q = session(all, mem.card, { order: 'due', size: p.size, newADay: plan?.perDay }, t, startedToday());
  const s = summary(all, mem.card), gap = s.gaps[0], res = resumable(lsGet(LIVE, null), all, t), notes = all.filter(e => mem.card[e.key]?.note).length;
  const mode = (m, label, sub, ic, n = '') => `<button class="os-libmode" data-lib="mode" data-m="${m}"><span class="os-libmode-ic" aria-hidden="true">${icon(ic)}</span><span class="os-libmode-tx"><b>${esc(label)}</b><small>${esc(sub)}</small></span>${n !== '' ? `<span class="os-libmode-n">${n}</span>` : ''}</button>`;
  return `<section class="os-libtoday">
      ${ring(td.frac, td.n, td.goal)}
      <div class="os-libtoday-tx"><h3>${td.done ? 'Goal done today' : 'Today'}</h3>
        <p class="os-libstreak${sk.live ? ' live' : ''}">${icon('flame')}<span>${sk.days ? `${sk.days}-day streak${sk.live ? '' : ': study today to keep it'}` : 'Start a streak today'}</span></p>
        <p class="os-libmeta">${tl.due} due · ${Math.max(0, Math.min(tl.fresh, (plan?.perDay || 20) - startedToday()))} new</p></div>
    </section>
    ${res ? `<button class="os-libresume" data-lib="resume"><span><b>Resume your session</b><small>${esc(res.label || 'Study')} · ${plural(res.left, 'card')} left</small></span><span class="os-chev" aria-hidden="true">${I.chevR}</span></button>` : ''}
    <button class="os-btn os-btn--lg os-primary os-libgo" data-lib="today"${q.length ? '' : ' disabled'}>${q.length ? `Start · ${plural(q.length, 'card')}` : 'All caught up: try a mode below'}</button>
    <div class="os-libmodes">
      ${mode('smart', 'Smart 10', 'Your weak areas, mixed so you win some', 'bolt')}
      ${mode('ladder', '0 to 1', 'Year 1 first principles up to final year', 'stairs')}
      ${gap ? mode('weak', 'Your weak spot', `${gap.label} · ${gap.acc}%`, 'target') : ''}
      ${tl.incorrect ? mode('incorrect', 'Got wrong', 'Answer them again', 'refresh', tl.incorrect) : ''}
      ${tl.flagged ? mode('flagged', 'Flagged', 'The ones you marked', 'bookmark', tl.flagged) : ''}
      ${notes ? mode('notebook', 'Notebook', 'Every note you wrote', 'pencil', notes) : ''}
      ${mode('custom', 'Custom session', 'Deck, specialty, year, timed…', 'filter')}
    </div>
    ${gapsCardHtml()}
    <div class="os-libexam">${plan ? `<p><b>Exam in ${plural(plan.days, 'day')}</b><span>${plan.unseen} questions not seen yet: ${plan.perDay} new a day sees them all once by then.</span></p>` : '<p><b>Exam plan</b><span>Set your exam date and the day’s new questions follow from it.</span></p>'}
      <label class="os-libexamd"><span class="os-vh">Exam date</span><input type="date" name="exam" value="${esc(p.exam)}" min="${esc(dayOf(t))}"></label></div>
    <div class="os-libgoal"><span class="os-libh2">Daily goal</span><div class="os-seg" role="radiogroup" aria-label="Daily goal">${GOALS.map(g => `<button role="radio" data-lib="pref" data-k="goal" data-v="${g}" aria-checked="${p.goal === g}">${g}</button>`).join('')}</div></div>`;
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
  /* a choice: chips that wrap (a segmented control truncates four labels at 320 px) */
  const seg = (k, opts, cur, label) => `<div class="os-libsegrow"><span class="os-libh2" id="os-lsr-${k}">${label}</span><div class="os-libchips" role="radiogroup" aria-labelledby="os-lsr-${k}">${opts.map(([v, l, n]) => { const on = String(cur) === String(v); return `<button class="os-chip${on ? ' on' : ''}${on && V.tap !== `${k}:${v}` ? ' os-still' : ''}" role="radio" data-lib="pref" data-k="${k}" data-v="${v}" aria-checked="${on}">${esc(l)}${n != null ? `<span class="os-libn2">${n}</span>` : ''}</button>`; }).join('')}</div></div>`;
  const whichN = { all: pick.length, unused: tl.unused, incorrect: tl.incorrect, flagged: tl.flagged };
  return `<div class="os-libsumhead"><button class="os-link" data-lib="sumback">${I.back}<span>Study</span></button><h3>Custom session</h3></div>
    <label class="os-setf"><span>Deck</span><select name="sdeck"><option value="">Everything (${everything().length})</option>${decks.map(([id, n]) => `<option value="${esc(id)}"${id === V.st.deck ? ' selected' : ''}>${esc(n)}</option>`).join('')}</select></label>
    <p class="os-libh2">Specialty</p><div class="os-libchips">${chip('topic', '', 'All', pool.length, !V.st.topic)}${L.map(x => chip('topic', x.topic, x.topic, x.count, V.st.topic === x.topic)).join('')}</div>
    <p class="os-libh2">Kind</p><div class="os-libchips">${chip('cat', '', 'All', topic ? topic.count : pool.length, !V.st.cat)}${KIND_IDS.map(k => chip('cat', k, KINDS[k].short || KINDS[k].label, topic ? topic.cats.find(x => x.id === k).count : pool.filter(x => x.item.cat === k).length, V.st.cat === k)).join('')}</div>
    <p class="os-libh2">Year</p><div class="os-libchips">${chip('year', '', 'All', inTK.length, !V.st.year)}${YEAR_IDS.map(y => chip('year', String(y), YEARS[y].label, yN(y), V.st.year === y)).join('')}</div>
    <p class="os-libh2">Difficulty</p><div class="os-libchips">${chip('diff', '', 'All', inTKY.length, !V.st.diff)}${DIFF_IDS.map(d => chip('diff', String(d), DIFFICULTY[d].label, dN(d), V.st.diff === d)).join('')}</div>
    ${seg('which', Object.entries(WHICH).map(([v, l]) => [v, l, whichN[v]]), p.which, 'Questions')}
    ${seg('size', SIZES.map(n => [n, n ? String(n) : 'All']), p.size, 'How many')}
    ${seg('mode', Object.entries(MODES), p.mode, 'Mode')}
    <p class="os-libmeta os-libmodenote">${p.mode === 'timed' ? 'Timed: the exam’s clock on each question (90 s plus reading time); the answer after each.' : 'Tutor: no clock; the answer and why after each.'}</p>
    ${seg('order', Object.entries(ORDERS), p.order, 'Order')}
    <button class="os-btn os-btn--lg os-primary os-libgo" data-lib="start"${q.length ? '' : ' disabled'}>${q.length ? `Start · ${plural(q.length, 'card')}` : 'Nothing matches: loosen a filter'}</button>`;
}

/* a session from a list (already in order): into focus */
function startWith(list, { mode = 'tutor', order = 'due', label = '' } = {}) {
  if (!list.length) { notify('Nothing to study there right now.', ''); return false; }
  Object.assign(V.st, { q: list, i: 0, pick: null, n: 0, right: 0, mode, order, label, note: false, seen: [] });
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
/* timed mode: the question's clock, every quarter second; at 0 it is answered blank */
function tick() {
  clearInterval(V.st.timer);
  const x = V.st.q?.[V.st.i];
  if (!x || V.st.mode !== 'timed' || V.st.pick != null) return;
  const total = timedSecs(x.item) * 1000; V.st.ends = now() + total;
  const draw = () => {
    const left = Math.max(0, V.st.ends - now()), el = panel()?.querySelector('.os-libclock');
    if (el) { el.querySelector('b').textContent = String(Math.ceil(left / 1000)); el.style.setProperty('--p', (left / total).toFixed(3)); el.classList.toggle('low', left < 15000); }
    if (!left) { clearInterval(V.st.timer); answer(-1); }
  };
  draw(); V.st.timer = setInterval(draw, 250);
}

function cardHtml() {
  const x = V.st.q[V.st.i];
  if (!x) {
    const mem = api.studyMem(), p = myPref(), td = today(mem.days, now(), p.goal), sk = streak(mem.days, now()), pct = V.st.n ? Math.round((100 * V.st.right) / V.st.n) : 0;
    return `<div class="os-libempty os-libdone">${ring(td.frac, td.n, td.goal)}<p><strong>${td.done ? 'Daily goal done' : 'Session done'}</strong><br>${plural(V.st.n, 'card')} · ${pct}% right${sk.days ? ` · ${sk.days}-day streak` : ''}</p>
      <div class="os-libacts"><button class="os-btn os-btn--lg os-primary" data-lib="today">Keep going</button><button class="os-btn os-btn--lg" data-lib="endstudy">Done</button></div>
      ${reviewHtml()}</div>`;
  }
  const it = x.item, picked = V.st.pick, shown = picked != null, card = api.studyMem().card[x.key] || {}, t = now(), timed = V.st.mode === 'timed';
  const ord = displayOrder(it, x.key);   /* the key spread by the card's id; each button keeps its stored index */
  const meta = [it.year ? yearLabel(it) : '', it.difficulty ? diffLabel(it) : '', layerLabel(it), x.ownerName ? `from ${x.ownerName}` : ''].filter(Boolean).join(' · ');
  return `<div class="os-libcard${picked == null ? ' os-libcard--in' : ''}" data-q="${esc(x.key)}">
    <div class="os-libtop">
      <button class="os-libx" data-lib="endstudy" aria-label="End the session">${I.x}</button>
      <div class="os-libbar" role="progressbar" aria-label="Progress" aria-valuemin="0" aria-valuemax="${V.st.q.length}" aria-valuenow="${V.st.i}"><i style="transform:scaleX(${(V.st.i / V.st.q.length).toFixed(3)})"></i></div>
      <span class="os-libcount2">${V.st.i + 1}/${V.st.q.length}</span>
      ${timed && !shown ? '<span class="os-libclock" aria-live="off" title="Time left"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"/><circle class="arc" cx="12" cy="12" r="10" pathLength="100"/></svg><b></b></span>' : ''}
      <button class="os-libflag${card.f ? ' on' : ''}" data-lib="flag" aria-pressed="${!!card.f}" aria-label="${card.f ? 'Flagged' : 'Flag this question'}">${icon('bookmark')}</button>
    </div>
    <p class="os-liblayer">${esc(meta)}</p>
    ${V.st.order === 'ladder' && it.year && it.year !== V.st.q[V.st.i - 1]?.item.year ? `<p class="os-libyear"><b>${esc(YEARS[it.year].label)}</b> ${esc(YEARS[it.year].name)}</p>` : ''}
    <p class="os-libstem">${esc(it.stem)}</p>${it.ask ? `<p class="os-libask">${esc(it.ask)}</p>` : ''}
    <div class="os-libopts" role="group" aria-label="Options">${ord.map((i, pos) => {
      const o = it.options[i], st = !shown ? '' : i === it.answer ? ' ok' : i === picked ? ' no' : ' dim';
      return `<button class="os-libopt${st}" data-lib="opt" data-i="${i}"${shown ? ' aria-disabled="true"' : ''}><b>${LET[pos]}</b><span>${esc(o)}</span>${shown && (i === it.answer || i === picked) ? `<span class="os-vh">${i === it.answer ? 'correct answer' : 'your answer'}</span>` : ''}</button>${shown && it.why?.[i] && (i === it.answer || i === picked) ? `<p class="os-libwhy">${esc(it.why[i])}</p>` : ''}`;
    }).join('')}</div>
    ${shown ? `<div class="os-libexp" role="status"><strong class="${picked === it.answer ? 'ok' : 'no'}">${picked === it.answer ? 'Right' : picked < 0 ? `Time’s up: the answer is ${LET[ord.indexOf(it.answer)]}` : `The answer is ${LET[ord.indexOf(it.answer)]}`}</strong>${it.explanation ? `<p>${esc(it.explanation)}</p>` : ''}${it.credit ? `<p class="os-libcredit">${esc(it.credit)}</p>` : ''}</div>
      ${picked !== it.answer && (card.w | 0) >= 4 && !card.note ? `<p class="os-libleech">${icon('alert')}<span>This one has caught you ${card.w} times. Write the rule in your own words: it is the fastest fix.</span></p>` : ''}
      ${V.st.note || card.note || (picked !== it.answer && (card.w | 0) >= 4) ? `<label class="os-libnote2"><span>Your note</span><textarea data-lib-note rows="2" maxlength="500" placeholder="A memory hook, the trap, the rule…">${esc(card.note || '')}</textarea></label>` : '<button class="os-link os-libaddnote" data-lib="note">Add a note</button>'}
      ${gradesHtml(picked === it.answer, card, t)}
      ${x.key.startsWith('b:') && accountsOn() ? (V.st.report === x.key ? `<div class="os-libreport" role="group" aria-label="What is wrong with it?"><span>What is wrong?</span>${Object.entries(REPORTS).map(([k, l]) => `<button class="os-chip" data-lib="report" data-v="${k}">${esc(l)}</button>`).join('')}</div>` : V.st.reported === x.key ? '<p class="os-libmeta os-libreported">Reported. Thank you.</p>' : '<button class="os-link os-libreportbtn" data-lib="reportopen">Report a problem</button>') : ''}` : '<p class="os-libmeta os-libkeys">Tap an answer (or press 1 to 5).</p>'}
  </div>`;
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
  return `<div class="os-libreview"><h3 class="os-libh">This session</h3><ol>${seen.map(s => { const x = by.get(s.key); return x ? `<li class="${s.ok ? 'ok' : 'no'}"><span aria-label="${s.ok ? 'right' : 'missed'}">${s.ok ? I.check : I.x}</span><p>${esc(x.item.stem.length > 90 ? `${x.item.stem.slice(0, 90)}…` : x.item.stem)}</p></li>` : ''; }).join('')}</ol>
    ${missed.length ? `<button class="os-btn" data-lib="redo">Redo the ${missed.length === 1 ? 'one' : missed.length} you missed</button>` : '<p class="os-libmeta">Every one right.</p>'}</div>`;
}
/* the Notebook: every question you wrote a note on */
function notebookHtml() {
  const mem = api.studyMem(), l = everything().filter(e => mem.card[e.key]?.note);
  return `<div class="os-libsumhead"><button class="os-link" data-lib="sumback">${I.back}<span>Study</span></button><h3>Notebook</h3></div>
    ${l.length ? `<button class="os-btn os-btn--lg os-primary os-libgo" data-lib="notestudy">Study these ${plural(l.length, 'question')}</button><ul class="os-libnotes" role="list">${l.map(e => `<li><span class="os-liblayer">${esc(layerLabel(e.item))}</span><p class="os-libnotes-q">${esc(e.item.stem.length > 120 ? `${e.item.stem.slice(0, 120)}…` : e.item.stem)}</p><p class="os-libnotes-a">${esc(e.item.options[e.item.answer])}</p><blockquote>${esc(mem.card[e.key].note)}</blockquote></li>`).join('')}</ul>` : '<p class="os-libmeta">No notes yet. After you answer, Add a note keeps the rule in your words.</p>'}`;
}
/* the grade follows the answer (research: answer-then-grade): right is Good and wrong is Again, one big Next; Hard and
   Easy sit either side of a right answer, and a wrong one can be marked misread. Each says when it comes back; keys 1 to 4
   pick any, Enter is Next */
function gradesHtml(right, card, t) {
  const b = (g, label, cls = '') => `<button class="os-btn${cls}" data-lib="grade" data-g="${g}" aria-keyshortcuts="${GRADES.indexOf(g) + 1}"><span>${label}</span><small>in ${esc(preview(card, g, t))}</small></button>`;
  return right
    ? `<div class="os-libgrades os-libgrades--right" role="group" aria-label="Next, and how well you knew it">${b('hard', 'Hard')}${b('good', 'Next', ' os-primary os-libnext')}${b('easy', 'Easy')}</div>`
    : `<div class="os-libgrades os-libgrades--wrong" role="group" aria-label="Next">${b('again', 'Next', ' os-primary os-libnext')}<button class="os-link os-libmisread" data-lib="grade" data-g="good" aria-keyshortcuts="3">I knew it, I misread</button></div>`;
}
function answer(i) {
  if (V.st.pick != null) return;
  clearInterval(V.st.timer);
  V.st.pick = i;
  const x = V.st.q[V.st.i], m = api.studyMem(), ok = !!x && i === x.item.answer;   /* every answer counts towards your gaps and the month's Wrapped (stats.mjs) */
  V.st.lastOk = ok;
  const goal = myPref().goal, before = today(m.days, now(), goal).n;
  if (x) { record(m, x, ok, now()); api.saveStudy(m); if (ok) V.st.right++; }
  if (before < goal && before + 1 >= goal) V.st.celebrate = true;   /* the answer that completes the day's goal */
  paint();
  try { if (x && i >= 0) navigator.vibrate?.(ok ? 10 : [8, 50, 8]); } catch {}   /* the same frame as the green or the shake (Apple: harmony); phones that buzz */
  if (V.st.celebrate) { V.st.celebrate = false; celebrate(); }
  if (x) othersPicked(x, i);
  panel()?.querySelector(`[data-lib="grade"].os-primary`)?.focus({ preventScroll: true });
  /* a long stem puts the answer below the fold: bring the explanation up */
  panel()?.querySelector('.os-libexp')?.scrollIntoView({ block: 'nearest', behavior: reducedMotion() ? 'auto' : 'smooth' });
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
function rate(g) {
  const x = V.st.q?.[V.st.i]; if (!x || V.st.pick == null) return;
  const m = api.studyMem(), had = m.card[x.key], fresh = isNew(had);
  m.card[x.key] = grade(had, g, now(), Math.random);
  if (fresh) { if (m.day.d !== day()) m.day = { d: day(), n: 0 }; m.day.n++; }
  api.saveStudy(m);
  if (soon(m.card[x.key], now()) && V.st.q.length < 200) V.st.q.push(x);   /* a learning step (1 or 10 minutes): once more before the session ends, as Anki does */
  V.st.seen.push({ key: x.key, ok: V.st.lastOk });
  V.st.i++; V.st.pick = null; V.st.n++; V.st.note = false;
  saveLive();
  paint(); tick(); panel()?.querySelector('.os-libopt, [data-lib="today"]')?.focus({ preventScroll: true });
}
function toggleFlag() {
  const x = V.st.q?.[V.st.i]; if (!x) return;
  const m = api.studyMem(), c = m.card[x.key] || {};
  m.card[x.key] = { ...c, f: c.f ? 0 : 1 }; api.saveStudy(m);
  const b = panel()?.querySelector('.os-libflag'), on = !!m.card[x.key].f;
  if (b) { b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); b.setAttribute('aria-label', on ? 'Flagged' : 'Flag this question'); }
  notify(on ? 'Flagged: it is in Flagged on the Study home.' : 'Flag removed.', '');
}
function saveNote(v) {
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
    <div class="os-libbig"><div><b>${s.total.acc}%</b><small>right</small></div><div><b>${s.total.n}</b><small>answers</small></div><div><b>${s.total.seen}</b><small>of ${s.total.items} questions seen</small></div></div>
    ${heatHtml(mem.days, t)}
    ${months.length ? `<div class="os-libwraps">${months.slice(0, 3).map(m => `<button class="os-libwrapbtn" data-lib="wrapped" data-m="${m}"${m === cur ? ' data-preview="1"' : ''}>${icon('star')}<span>${esc(monthName(m))}${m === cur ? ' so far' : ''}, wrapped</span></button>`).join('')}</div>` : ''}
    <h3 class="os-libh">Your gaps</h3>
    ${s.gaps.length ? `<ul class="os-libgapl" role="list">${s.gaps.map(row).join('')}</ul>` : (s.total.acc < 70 ? `<p class="os-libmeta">Not enough answers in one place to name a gap yet: three in a specialty does it.</p>` : `<p class="os-libmeta">No gaps: nothing under 70% with three or more answers. Keep going.</p>`)}
    ${s.untouched.length ? `<h3 class="os-libh">Not started</h3><ul class="os-libgapl" role="list">${s.untouched.map(x => `<li class="os-libgap"><div><b>${esc(x.label)}</b><small>${plural(x.items, 'question')} waiting</small></div><button class="os-btn" data-lib="gap" data-v="${esc(x.id)}|">Start</button></li>`).join('')}</ul>` : ''}
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

/* ---------------------------------------------------------------- actions */
async function act(a, b, e) {
  switch (a) {
    case 'tab': return go(b.dataset.tab);
    case 'copyprompt': {
      const withNotes = (V.up.notes || '').trim();
      try { await navigator.clipboard.writeText(chatPrompt(withNotes)); notify(withNotes ? 'Copied, with your notes. Paste it into ChatGPT.' : 'Copied. Paste it into ChatGPT, then add your notes.', 'success'); }
      catch { const d = panel()?.querySelector('.os-libprompt'); if (d) { d.open = true; d.querySelector('textarea').select(); } notify('Copy it from the box below.', ''); }
      return;
    }
    case 'save': return save();
    case 'verify': return verify();
    case 'reportopen': { V.st.report = V.st.q?.[V.st.i]?.key; paint(); return panel()?.querySelector('.os-libreport .os-chip')?.focus({ preventScroll: true }); }
    case 'report': {
      const x = V.st.q?.[V.st.i]; if (!x) return;
      try { await rpc('mcq_report', { p_qid: x.item.id, p_reason: b.dataset.v, p_note: '' }); V.st.reported = x.key; notify('Reported. Thank you: it goes to whoever keeps the bank.', 'success'); }
      catch { notify('The report did not send. Try again when you are online.', 'danger'); }
      V.st.report = null; return paint();
    }
    case 'keepheld': { const c = V.up.check, h = c?.held.find(x => x.item.id === b.dataset.id); if (!h) return; c.kept.add(h.item.id); V.up.res.ready.push(h.item); return paintUploadResult(); }
    case 'deckpick': { V.up.deck = b.dataset.v; const inp = panel()?.querySelector('[name="deck"]'); if (inp) inp.value = b.dataset.v; panel()?.querySelectorAll('.os-libdeckchips .os-chip').forEach(c => c.classList.toggle('on', c === b)); return; }
    case 'studydeck': Object.assign(V.st, { deck: b.dataset.deck, topic: '', cat: '', year: 0, diff: 0, q: null, view: 'custom' }); return go('study');
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
    case 'pick': { V.tap = `${b.dataset.k}:${b.dataset.v}`; V.st[b.dataset.k] = b.dataset.k === 'year' || b.dataset.k === 'diff' ? +b.dataset.v || 0 : b.dataset.v; if (b.dataset.k === 'topic') V.st.cat = ''; return paint(); }
    case 'summary': V.st.view = 'summary'; if (!V.bank) await loadBank(); paint(); arrive(); countUp(); return panel()?.focus({ preventScroll: true });
    case 'sumback': V.st.view = ''; paint(); return arrive();
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
      if (m === 'custom') { V.st.view = 'custom'; paint(); arrive(); return panel()?.focus({ preventScroll: true }); }
      if (m === 'smart') return startWith(smart(all, mem.card, now(), 10), { label: 'Smart 10' });
      if (m === 'notebook') { V.st.view = 'notebook'; paint(); arrive(); return; }
      if (m === 'ladder') return startWith(session(all, mem.card, { order: 'ladder', size: p.size }, now()), { order: 'ladder', label: '0 to 1' });
      if (m === 'incorrect' || m === 'flagged') return startWith(session(all, mem.card, { which: m, order: 'shuffle', size: 0 }, now()), { label: m });
      if (m === 'weak') { const g = summary(all, mem.card).gaps[0]; if (!g) return; const [topic, cat] = g.id.split('|'); return startWith(session(all.filter(x => x.item.topic === topic && (!cat || x.item.cat === cat)), mem.card, { order: 'shuffle', size: p.size }, now()), { label: g.label }); }
      return;
    }
    case 'pref': { V.tap = `${b.dataset.k}:${b.dataset.v}`; const k = b.dataset.k, v = ['goal', 'size'].includes(k) ? +b.dataset.v : b.dataset.v; setPref(k, v); return paint(); }
    case 'flag': return toggleFlag();
    case 'resume': { const r = resumable(lsGet(LIVE, null), everything(), now()); if (!r) { lsSet(LIVE, null); return paint(); } startWith(r.q, { mode: r.mode, order: r.order, label: r.label }); Object.assign(V.st, { i: r.i, n: r.n, right: r.right }); paint(); tick(); return; }
    case 'redo': { const by = new Map(V.st.q.map(x => [x.key, x])), l = [...new Set(V.st.seen.filter(s => !s.ok).map(s => s.key))].map(k => by.get(k)).filter(Boolean); return startWith(l, { label: 'Redo' }); }
    case 'notestudy': { const mem = api.studyMem(); V.st.view = ''; return startWith(everything().filter(e => mem.card[e.key]?.note), { label: 'Notebook' }); }
    case 'note': { V.st.note = true; paint(); return panel()?.querySelector('[data-lib-note]')?.focus(); }
    case 'opt': return answer(+b.dataset.i);
    case 'grade': return rate(b.dataset.g);
    case 'endstudy': return endStudy();
  }
}
