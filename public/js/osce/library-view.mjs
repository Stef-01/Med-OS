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
import { ctx, I, notify, openDialog, confirmDlg, now } from './state.mjs';
import { account } from '../study-kit/sync.mjs';
import { chatPrompt } from '../library/prompt.mjs';
import { checkUpload, deckName, layers, layerLabel, yearLabel, diffLabel, inPick, KINDS, KIND_IDS, LIMITS } from '../library/item.mjs';
import { YEARS, YEAR_IDS, DIFFICULTY, DIFF_IDS, ladder } from '../mcq/year.mjs';
import { record, summary, wrapped, monthOf, monthName } from '../library/stats.mjs';
import { grade, queue, counts, preview, GRADES } from '../library/sched.mjs';
import * as api from '../library/api.mjs';

const TABS = [['library', 'Library'], ['upload', 'Upload'], ['friends', 'Friends'], ['study', 'Study']];
const LET = 'ABCDE', GLABEL = { again: 'Again', hard: 'Hard', good: 'Good', easy: 'Easy' };
const SEV = { block: ['Must fix', 'danger'], major: ['Fix', 'warn'], minor: ['Tip', 'tip'] };
const V = { tab: 'library', lib: null, up: { text: '', res: null, deck: '' }, st: { deck: '', topic: '', cat: '', year: 0, diff: 0, order: 'due', view: '', q: null, i: 0, pick: null, n: 0 }, bank: null, share: '', busy: false, msg: '' };
const day = () => new Date(now()).toISOString().slice(0, 10);

/* the start view's card */
export function libraryCardHtml() {
  const lib = api.current(), all = api.allItems(lib), c = counts(all.map(x => ({ id: x.key })), api.studyMem().card, now());
  const sub = all.length ? `${all.length} question${all.length === 1 ? '' : 's'}${c.due ? ` · ${c.due} due` : ''}${lib.shared.length ? ` · ${lib.shared.length} from friends` : ''}`
    : 'Turn your notes into questions with ChatGPT, study them and share them with friends.';
  return `<button class="os-card os-bigcard os-in" data-os="lib" style="--d:3">
    <span class="os-bigic">${icon('cards')}</span>
    <span class="os-bigtx"><strong>Your questions</strong><span>${esc(sub)}</span></span>
    <span class="os-chev">${I.chevR}</span></button>`;
}

export async function libraryDlg(tab) {
  V.tab = TABS.some(t => t[0] === tab) ? tab : V.tab; V.lib = api.current(); V.st.q = null; V.share = ''; V.msg = '';
  const d = openDialog({ kind: 'lib', title: 'Your questions', cls: 'os-dlg--lib', onClose: () => ctx.render?.(),
    body: `<div class="os-lib"><nav class="os-libtabs" role="tablist" aria-label="Your questions">${TABS.map(([id, label]) => `<button role="tab" data-lib="tab" data-tab="${id}" id="os-libt-${id}" aria-controls="os-libp" aria-selected="${id === V.tab}" tabindex="${id === V.tab ? 0 : -1}">${label}</button>`).join('')}</nav>
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
  el.addEventListener('input', e => { if (e.target.name === 'paste') { V.up.text = e.target.value; V.up.res = null; paintUploadResult(); } if (e.target.name === 'deck') V.up.deck = e.target.value; });
  el.addEventListener('change', e => {
    if (e.target.name === 'file') readFile(e.target);
    if (e.target.name === 'sdeck') { V.st.deck = e.target.value; V.st.topic = ''; V.st.cat = ''; V.st.year = 0; paint(); }
  });
}
/* a key while this dialog is on top (osce.mjs onKey hands it over: the overlay stack owns every key, study-kit/stack.mjs).
   In a study card, 1 to 5 answer and then 1 to 4 grade; true when it was used. The arrows on the tabs are OSCE's own */
export function libraryKey(e) {
  if (V.tab !== 'study' || !V.st.q || e.metaKey || e.ctrlKey || e.altKey || e.target.closest?.('input, textarea, select')) return false;
  const it = V.st.q[V.st.i];
  if (it && V.st.pick == null && /^[1-5]$/.test(e.key) && +e.key <= it.item.options.length) { answer(+e.key - 1); return true; }
  if (it && V.st.pick != null && /^[1-4]$/.test(e.key)) { rate(GRADES[+e.key - 1]); return true; }
  return false;
}
function go(tab) {
  V.tab = tab; V.share = '';
  dlg()?.querySelectorAll('[role="tab"]').forEach(b => { const on = b.dataset.tab === tab; b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; });
  paint();
}

/* ---------------------------------------------------------------- painting */
function paint() {
  const p = panel(); if (!p) return;
  p.setAttribute('aria-labelledby', `os-libt-${V.tab}`);
  p.innerHTML = (V.msg ? `<p class="os-libnote">${esc(V.msg)}</p>` : '') + ({ library: libraryHtml, upload: uploadHtml, friends: friendsHtml, study: studyHtml })[V.tab]();
  if (V.tab === 'upload') paintUploadResult();
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
  return `${signedIn ? '' : signInHtml('Signed out: these stay on this phone. Sign in to keep them on your account and share them.')}
    ${decks.length ? `<h3 class="os-libh">Your decks</h3><ul class="os-libdecks" role="list">${decks.map(d => deckRow(d, '')).join('')}</ul>` : ''}
    ${shared.length ? `<h3 class="os-libh">From friends</h3><ul class="os-libdecks" role="list">${shared.map(d => deckRow(d, d.owner)).join('')}</ul>` : ''}
    <button class="os-btn os-libadd" data-lib="tab" data-tab="upload">${icon('plus')}<span>Upload more</span></button>`;
}

function uploadHtml() {
  const names = V.lib.decks.map(d => d.name), deck = V.up.deck || names[0] || 'My questions';
  return `<ol class="os-libsteps">
    <li><h3>Ask ChatGPT</h3><p>Copy the prompt, paste it into ChatGPT, and add your notes, lecture slides or questions at the end. It answers in the format Med-OS reads, each question tagged with its specialty and kind.</p>
      <div class="os-libacts"><button class="os-btn os-primary" data-lib="copyprompt">${icon('clipboardCheck')}<span>Copy the prompt</span></button>
      <a class="os-btn" href="https://chatgpt.com/" target="_blank" rel="noopener noreferrer">Open ChatGPT</a></div>
      <details class="os-libprompt"><summary>See the prompt</summary><textarea readonly rows="8" aria-label="The prompt for ChatGPT">${esc(chatPrompt())}</textarea></details></li>
    <li><h3>Paste what it gives you</h3>
      <label class="os-setf"><span>ChatGPT's answer (JSON), or CSV with a header row</span><textarea name="paste" rows="6" spellcheck="false" placeholder='[{ "stem": "A 4-year-old boy…", "options": […], "answer": "A", "specialty": "Paediatrics", "kind": "clinical", … }]'>${esc(V.up.text)}</textarea></label>
      <label class="os-libfile"><input type="file" name="file" accept=".json,.csv,.txt,application/json,text/csv,text/plain"><span>${icon('plus')}Or choose a file</span></label></li>
    <li><h3>Check and save</h3><div class="os-libres" aria-live="polite"></div>
      <label class="os-setf"><span>Deck</span><input name="deck" maxlength="${LIMITS.deckName}" list="os-libdecknames" value="${esc(deck)}" autocomplete="off"></label>
      <datalist id="os-libdecknames">${names.map(n => `<option value="${esc(n)}">`).join('')}</datalist>
      <button class="os-btn os-btn--lg os-primary os-libsave" data-lib="save" disabled>Save</button></li>
  </ol>`;
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
    ${r.more ? `<p class="os-liberr">Only the first ${LIMITS.upload} are read: upload the rest after.</p>` : ''}
    ${bad.length ? `<details class="os-libprobs" open><summary>Not saved until fixed (${bad.length})</summary><p class="os-libmeta">Fix these in ChatGPT ("question 3 has no kind") and paste again; the ready ones are not saved twice.</p><ol>${bad.map(row).join('')}</ol></details>` : ''}
    ${tips.length ? `<details class="os-libprobs"><summary>Saved, with tips (${tips.length})</summary><ol>${tips.map(row).join('')}</ol></details>` : ''}`;
  btn.disabled = !r.ready.length || V.busy; btn.textContent = r.ready.length ? `Save ${plural(r.ready.length, 'question')}` : 'Save';
}
async function readFile(input) {
  const f = input.files?.[0]; if (!f) return;
  if (f.size > 4e6) { notify('That file is over 4 MB: split it.', 'danger'); input.value = ''; return; }
  V.up.text = await f.text(); V.up.res = null; input.value = '';
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
    V.lib = api.current(); V.up = { text: '', res: null, deck: name };
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
  return `<form class="os-libaddf" data-lib-form="add" novalidate><label class="os-setf"><span>Add a friend by their name</span><span class="os-librow"><input name="fname" maxlength="20" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Their Duel a Mate name"><button class="os-btn os-primary" data-lib="addfriend" type="submit">Add</button></span></label>
      <p class="os-libmeta">You are <b>${esc(V.lib.me?.name || '')}</b>: friends add you by that.</p></form>
    ${inc.length ? `<h3 class="os-libh">Asking to be friends</h3><ul class="os-libfriends" role="list">${inc.map(x => row(x, `<button class="os-btn os-primary" data-lib="accept" data-id="${esc(x.id)}">Accept</button><button class="os-btn" data-lib="decline" data-id="${esc(x.id)}">Decline</button>`)).join('')}</ul>` : ''}
    <h3 class="os-libh">Friends${fr.length ? ` (${fr.length})` : ''}</h3>
    ${fr.length ? `<ul class="os-libfriends" role="list">${fr.map(x => row(x, `<button class="os-btn os-libicon" data-lib="unfriend" data-id="${esc(x.id)}" data-name="${esc(x.name)}" aria-label="Remove ${esc(x.name)}" title="Remove">${icon('trash')}</button>`)).join('')}</ul>` : '<p class="os-libmeta">None yet. Once a friend accepts, share a deck with them from Library, and their shared decks show up there for you.</p>'}
    ${out.length ? `<h3 class="os-libh">Waiting for them</h3><ul class="os-libfriends" role="list">${out.map(x => row(x, `<button class="os-btn" data-lib="decline" data-id="${esc(x.id)}">Cancel</button>`)).join('')}</ul>` : ''}`;
}

/* ---------------------------------------------------------------- Study */
/* the bank (public/duel/pack.json: the stations' questions and the reviewed pool) as a deck to study, read-only */
const BANK = '__bank';
async function loadBank() {
  if (V.bank) return V.bank;
  try {
    const r = await fetch('./duel/pack.json', { cache: 'no-cache' }); if (!r.ok) throw new Error();
    V.bank = (await r.json()).questions.map(q => ({ item: { id: q.id, stem: q.stem, options: q.options, answer: q.answer, explanation: q.why || '', why: Array.isArray(q.notes) ? q.notes : [], topic: q.topic || '', cat: q.cat || '', year: q.year || 0, difficulty: q.difficulty || 0 }, deck: BANK, deckName: 'The bank', owner: '', ownerName: '', key: `b:${q.id}` }));
  } catch { V.bank = []; }
  return V.bank;
}
function studyPool() {
  const d = V.st.deck;
  if (d === BANK) return V.bank || [];
  const all = api.allItems(V.lib);
  return d ? all.filter(x => x.deck === d) : all;
}
const inStudyPick = x => inPick(x.item, V.st) && (!V.st.year || x.item.year === V.st.year) && (!V.st.diff || x.item.difficulty === V.st.diff);
function studyHtml() {
  if (V.st.q) return cardHtml();
  if (V.st.view === 'summary') return summaryHtml();
  const all = api.allItems(V.lib);
  if (!all.length && V.st.deck !== BANK) V.st.deck = BANK;   /* nothing of yours yet: the bank */
  if (V.st.deck === BANK && !V.bank) { loadBank().then(() => { if (V.tab === 'study' && !V.st.q) paint(); }); return '<p class="os-libmeta">Loading the bank…</p>'; }
  const pool = studyPool(), cards = api.studyMem().card, t = now(), L = layers(pool.map(x => x.item));
  const pick = pool.filter(inStudyPick), c = counts(pick.map(x => ({ id: x.key })), cards, t), q = V.st.order === 'ladder' ? climbQueue(pick) : sessionQueue(pick);
  const inTK = pool.filter(x => inPick(x.item, V.st)), yN = y => inTK.filter(x => x.item.year === y && (!V.st.diff || x.item.difficulty === V.st.diff)).length;
  const inTKY = inTK.filter(x => !V.st.year || x.item.year === V.st.year), dN = d => inTKY.filter(x => x.item.difficulty === d).length;
  const chip = (k, v, label, n, on) => `<button class="os-chip${on ? ' on' : ''}" data-lib="pick" data-k="${k}" data-v="${esc(v)}" aria-pressed="${on}"${n === 0 ? ' disabled' : ''}>${esc(label)}<span class="os-libn2">${n}</span></button>`;
  const topic = L.find(x => x.topic === V.st.topic);
  const decks = [...V.lib.decks.map(d => [d.id, d.name]), ...V.lib.shared.map(d => [d.id, `${d.name} (${d.owner_name})`]), [BANK, `The bank${V.bank ? ` (${V.bank.length})` : ''}`]];
  const order = (v, label) => `<button role="radio" data-lib="order" data-v="${v}" aria-checked="${V.st.order === v}">${label}</button>`;
  return `${gapsCardHtml()}<label class="os-setf"><span>Deck</span><select name="sdeck">${all.length ? `<option value="">Every deck of yours (${all.length})</option>` : ''}${decks.map(([id, n]) => `<option value="${esc(id)}"${id === V.st.deck ? ' selected' : ''}>${esc(n)}</option>`).join('')}</select></label>
    <div class="os-liborder"><div class="os-seg" role="radiogroup" aria-label="Order">${order('due', 'Due first')}${order('ladder', '0 to 1')}</div>
      <p class="os-libmeta">${V.st.order === 'ladder' ? 'Year 1 first principles, then each year up to final year: learn it from the ground up.' : 'Cards due today, then new ones, as spaced repetition says.'}</p></div>
    <p class="os-libh2">Specialty</p><div class="os-libchips">${chip('topic', '', 'All', pool.length, !V.st.topic)}${L.map(x => chip('topic', x.topic, x.topic, x.count, V.st.topic === x.topic)).join('')}</div>
    <p class="os-libh2">Kind</p><div class="os-libchips">${chip('cat', '', 'All', topic ? topic.count : pool.length, !V.st.cat)}${KIND_IDS.map(k => chip('cat', k, KINDS[k].label, topic ? topic.cats.find(x => x.id === k).count : pool.filter(x => x.item.cat === k).length, V.st.cat === k)).join('')}</div>
    <p class="os-libh2">Year</p><div class="os-libchips">${chip('year', '', 'All', inTK.length, !V.st.year)}${YEAR_IDS.map(y => chip('year', String(y), YEARS[y].label, yN(y), V.st.year === y)).join('')}</div>
    <p class="os-libh2">Difficulty</p><div class="os-libchips">${chip('diff', '', 'All', inTKY.length, !V.st.diff)}${DIFF_IDS.map(d => chip('diff', String(d), DIFFICULTY[d].label, dN(d), V.st.diff === d)).join('')}</div>
    <p class="os-libstat"><span><b>${c.due}</b> due</span><span><b>${c.new}</b> new</span><span><b>${c.learnt}</b> learnt</span></p>
    <button class="os-btn os-btn--lg os-primary os-libgo" data-lib="start"${q.length ? '' : ' disabled'}>${q.length ? `Study ${plural(q.length, 'card')}` : 'Nothing due: come back later'}</button>
    ${!q.length && pick.length ? `<button class="os-link" data-lib="cram">Go over them anyway</button>` : ''}`;
}
/* ---------------------------------------------------------------- your gaps (stats.mjs) */
const everything = () => [...api.allItems(V.lib), ...(V.bank || [])];
function gapsCardHtml() {
  const s = summary(everything(), api.studyMem().card);
  if (!s.total.n) return '';
  const g = s.gaps[0];
  return `<button class="os-libgaps" data-lib="summary"><span class="os-libgaps-tx"><small>Your summary</small><b>${g ? `Gap: ${esc(g.label)} · ${g.acc}%` : `${s.total.acc}% right over ${plural(s.total.n, 'answer')}`}</b></span><span class="os-chev" aria-hidden="true">${I.chevR}</span></button>`;
}
const bar = (label, x, sub = '') => `<li class="os-libbarrow"><span class="os-libbarl">${esc(label)}${sub ? `<small>${esc(sub)}</small>` : ''}</span><span class="os-libbart" aria-hidden="true"><i style="transform:scaleX(${x.n ? (x.acc / 100).toFixed(3) : 0})" class="${x.acc < 60 ? 'lo' : x.acc < 80 ? 'mid' : 'hi'}"></i></span><span class="os-libbarn">${x.n ? `${x.acc}%` : '–'}</span></li>`;
function summaryHtml() {
  const mem = api.studyMem(), s = summary(everything(), mem.card), t = now(), cur = monthOf(t);
  const months = [...new Set(Object.keys(mem.days || {}).map(d => d.slice(0, 7)))].sort().reverse().filter(m => wrapped(mem, m));
  const head = `<div class="os-libsumhead"><button class="os-link" data-lib="sumback">${I.back || '‹'}<span>Study</span></button><h3>Your summary</h3></div>`;
  if (!s.total.n) return `${head}<div class="os-libempty">${icon('reportAnalytics')}<p><strong>No answers yet</strong><br>Study a few cards and this shows where you are strong and where your gaps are.</p></div>`;
  const row = x => `<li class="os-libgap"><div><b>${esc(x.label)}</b><small>${x.acc}% right · ${plural(x.n, 'answer')}</small></div><button class="os-btn" data-lib="gap" data-v="${esc(x.id.includes('|') ? x.id : `${x.id}|`)}">Study this</button></li>`;
  return `${head}
    <div class="os-libbig"><div><b>${s.total.acc}%</b><small>right</small></div><div><b>${s.total.n}</b><small>answers</small></div><div><b>${s.total.seen}</b><small>of ${s.total.items} questions seen</small></div></div>
    ${months.length ? `<div class="os-libwraps">${months.slice(0, 3).map(m => `<button class="os-libwrapbtn" data-lib="wrapped" data-m="${m}"${m === cur ? ' data-preview="1"' : ''}>${icon('star')}<span>${esc(monthName(m))}${m === cur ? ' so far' : ''}, wrapped</span></button>`).join('')}</div>` : ''}
    <h3 class="os-libh">Your gaps</h3>
    ${s.gaps.length ? `<ul class="os-libgapl" role="list">${s.gaps.map(row).join('')}</ul>` : (s.total.acc < 70 ? `<p class="os-libmeta">Not enough answers in one place to name a gap yet: three in a specialty does it.</p>` : `<p class="os-libmeta">No gaps: nothing under 70% with three or more answers. Keep going.</p>`)}
    ${s.untouched.length ? `<h3 class="os-libh">Not started</h3><ul class="os-libgapl" role="list">${s.untouched.map(x => `<li class="os-libgap"><div><b>${esc(x.label)}</b><small>${plural(x.items, 'question')} waiting</small></div><button class="os-btn" data-lib="gap" data-v="${esc(x.id)}|">Start</button></li>`).join('')}</ul>` : ''}
    ${s.strong.length ? `<h3 class="os-libh">Strongest</h3><ul class="os-libgapl os-libstrong" role="list">${s.strong.map(x => `<li class="os-libgap"><div><b>${esc(x.label)}</b><small>${x.acc}% right · ${plural(x.n, 'answer')}</small></div></li>`).join('')}</ul>` : ''}
    <h3 class="os-libh">By year</h3><ul class="os-libbars" role="list">${s.years.map(x => bar(x.label, x, YEARS[x.id]?.name || '')).join('')}</ul>
    ${s.diffs.length ? `<h3 class="os-libh">By difficulty</h3><ul class="os-libbars" role="list">${s.diffs.map(x => bar(x.label, x)).join('')}</ul>` : ''}
    <h3 class="os-libh">By specialty</h3><ul class="os-libbars" role="list">${s.spec.filter(x => x.n).sort((a, b) => a.acc - b.acc).map(x => bar(x.label, x, plural(x.n, 'answer'))).join('')}</ul>`;
}

/* 0 to 1: what is not learnt yet (due or new), five from each year, Year 1 first; then, when that is all learnt, the
   learnt ones in the same climb */
const climbQueue = pick => {
  const cards = api.studyMem().card, t = now(), open = pick.filter(x => { const c = cards[x.key]; return !c || c.due <= t; });
  return ladder(open.length ? open : pick, x => x.item.year, 5, x => x.item.difficulty);
};
const sessionQueue = pick => {
  const m = api.studyMem(), started = m.day.d === day() ? m.day.n | 0 : 0;
  const ids = queue(pick.map(x => ({ id: x.key })), m.card, now(), started).map(x => x.id), by = new Map(pick.map(x => [x.key, x]));
  return ids.map(id => by.get(id));
};
function start(cram) {
  const pick = studyPool().filter(inStudyPick);
  V.st.q = cram ? [...pick].sort(() => Math.random() - 0.5).slice(0, 30) : V.st.order === 'ladder' ? climbQueue(pick) : sessionQueue(pick);
  V.st.i = 0; V.st.pick = null; V.st.n = 0;
  if (!V.st.q.length) { V.st.q = null; return; }
  paint(); panel()?.querySelector('.os-libopt')?.focus({ preventScroll: true });
}
function cardHtml() {
  const x = V.st.q[V.st.i];
  if (!x) return `<div class="os-libempty os-libdone">${I.check}<p><strong>Done for now</strong><br>${plural(V.st.n, 'card')} studied. Due cards come back when they are due.</p><button class="os-btn os-btn--lg os-primary" data-lib="endstudy">Back to Study</button></div>`;
  const it = x.item, picked = V.st.pick, shown = picked != null, card = api.studyMem().card[x.key], t = now();
  return `<div class="os-libcard">
    <div class="os-libprog"><span>${V.st.i + 1} of ${V.st.q.length}</span><span class="os-liblayer">${it.year ? `${esc(yearLabel(it))} · ` : ''}${it.difficulty ? `${esc(diffLabel(it))} · ` : ''}${esc(layerLabel(it))}${x.ownerName ? ` · from ${esc(x.ownerName)}` : ''}</span><button class="os-link" data-lib="endstudy">End</button></div>
    ${V.st.order === 'ladder' && it.year && it.year !== V.st.q[V.st.i - 1]?.item.year ? `<p class="os-libyear"><b>${esc(YEARS[it.year].label)}</b> ${esc(YEARS[it.year].name)}</p>` : ''}
    <div class="os-libbar" aria-hidden="true"><i style="transform:scaleX(${(V.st.i / V.st.q.length).toFixed(3)})"></i></div>
    <p class="os-libstem">${esc(it.stem)}</p>${it.ask ? `<p class="os-libask">${esc(it.ask)}</p>` : ''}
    <div class="os-libopts" role="group" aria-label="Options">${it.options.map((o, i) => {
      const st = !shown ? '' : i === it.answer ? ' ok' : i === picked ? ' no' : '';
      return `<button class="os-libopt${st}" data-lib="opt" data-i="${i}"${shown ? ' aria-disabled="true"' : ''}><b>${LET[i]}</b><span>${esc(o)}</span>${shown && (i === it.answer || i === picked) ? `<span class="os-vh">${i === it.answer ? 'correct answer' : 'your answer'}</span>` : ''}</button>${shown && it.why?.[i] && (i === it.answer || i === picked) ? `<p class="os-libwhy">${esc(it.why[i])}</p>` : ''}`;
    }).join('')}</div>
    ${shown ? `<div class="os-libexp" role="status"><strong class="${picked === it.answer ? 'ok' : 'no'}">${picked === it.answer ? 'Right' : `The answer is ${LET[it.answer]}`}</strong>${it.explanation ? `<p>${esc(it.explanation)}</p>` : ''}</div>
      <div class="os-libgrades" role="group" aria-label="How well did you know it?">${GRADES.map((g, k) => `<button class="os-btn${(picked === it.answer ? g === 'good' : g === 'again') ? ' os-primary' : ''}" data-lib="grade" data-g="${g}" aria-keyshortcuts="${k + 1}"><span>${GLABEL[g]}</span><small>${esc(preview(card, g, t))}</small></button>`).join('')}</div>` : '<p class="os-libmeta os-libkeys">Tap an answer (or press 1 to 5).</p>'}
  </div>`;
}
function answer(i) {
  if (V.st.pick != null) return;
  V.st.pick = i;
  const x = V.st.q[V.st.i], m = api.studyMem();   /* every answer counts towards your gaps and the month's Wrapped (stats.mjs) */
  if (x) { record(m, x, i === x.item.answer, now()); api.saveStudy(m); }
  paint();
  panel()?.querySelector(`[data-lib="grade"].os-primary`)?.focus({ preventScroll: true });
}
function rate(g) {
  const x = V.st.q?.[V.st.i]; if (!x || V.st.pick == null) return;
  const m = api.studyMem(), had = m.card[x.key];
  m.card[x.key] = grade(had, g, now());
  if (!had) { if (m.day.d !== day()) m.day = { d: day(), n: 0 }; m.day.n++; }
  api.saveStudy(m);
  if (g === 'again' && V.st.q.length < 200) V.st.q.push(x);   /* again: once more before the session ends */
  V.st.i++; V.st.pick = null; V.st.n++;
  paint(); panel()?.querySelector('.os-libopt, [data-lib="endstudy"]')?.focus({ preventScroll: true });
}

/* ---------------------------------------------------------------- actions */
async function act(a, b, e) {
  switch (a) {
    case 'tab': return go(b.dataset.tab);
    case 'copyprompt': {
      try { await navigator.clipboard.writeText(chatPrompt()); notify('Copied. Paste it into ChatGPT, then add your notes.', 'success'); }
      catch { const d = panel()?.querySelector('.os-libprompt'); if (d) { d.open = true; d.querySelector('textarea').select(); } notify('Copy it from the box below.', ''); }
      return;
    }
    case 'save': return save();
    case 'studydeck': V.st.deck = b.dataset.deck; V.st.topic = ''; V.st.cat = ''; V.st.q = null; return go('study');
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
      b.disabled = true;
      try { await api.answerFriend(b.dataset.id, a === 'accept'); V.lib = api.current(); } catch (err) { notify(err.message, 'danger'); }
      return paint();
    }
    case 'unfriend': {
      if (!await confirmDlg({ title: `Remove ${b.dataset.name}?`, message: 'Decks you share with each other stop being shared.', confirm: 'Remove'})) return;
      try { await api.answerFriend(b.dataset.id, false); V.lib = api.current(); } catch (err) { notify(err.message, 'danger'); }
      return paint();
    }
    case 'pick': { V.st[b.dataset.k] = b.dataset.k === 'year' || b.dataset.k === 'diff' ? +b.dataset.v || 0 : b.dataset.v; if (b.dataset.k === 'topic') V.st.cat = ''; return paint(); }
    case 'order': V.st.order = b.dataset.v === 'ladder' ? 'ladder' : 'due'; return paint();
    case 'summary': V.st.view = 'summary'; if (!V.bank) await loadBank(); paint(); return panel()?.focus({ preventScroll: true });
    case 'sumback': V.st.view = ''; return paint();
    case 'gap': {   /* Study this: the gap's specialty and kind, in your own questions when they have it, else the bank */
      const [topic, cat] = String(b.dataset.v).split('|'), match = x => x.item.topic === topic && (!cat || x.item.cat === cat);
      Object.assign(V.st, { view: '', topic: topic || '', cat: cat || '', year: 0, diff: 0, deck: api.allItems(V.lib).some(match) ? '' : BANK });
      if (V.st.deck === BANK && !V.bank) await loadBank();
      start(false); if (!V.st.q) start(true);   /* nothing due there: go over it anyway */
      if (!V.st.q) paint();
      return;
    }
    case 'wrapped': return (await import('./wrapped-view.mjs')).openWrapped(b.dataset.m, { preview: b.dataset.preview === '1' });
    case 'start': return start(false);
    case 'cram': return start(true);
    case 'opt': return answer(+b.dataset.i);
    case 'grade': return rate(b.dataset.g);
    case 'endstudy': V.st.q = null; paint(); return panel()?.querySelector('.os-libgo')?.focus({ preventScroll: true });
  }
}
