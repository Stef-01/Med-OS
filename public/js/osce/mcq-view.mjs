/* osce/mcq-view.mjs - Submit a question: a student's own MCQ (or one from an open resource) for the standard pool.

   The form: the vignette, the lead-in question, four or five options with the key marked, the explanation, the topic,
   where it came from (written by you, or an open resource with its licence) and the author. The item-writing checks
   (js/mcq/flaws.mjs, the same code the pool's selector runs) run as you type and list what to fix before you send it.
   Paste JSON or CSV to fill the form, or to send several at once (js/mcq/schema.mjs draftsFrom).

   Where a question goes: with a Supabase project in config.js (and supabase/migrations/0003_mcq.sql run in it) it is
   inserted into mcq_submissions, which the pool's pipeline reads (node scripts/mcq-submissions.mjs); without one it is
   kept on this phone and Export gives a file for whoever builds the pool. Either way it is listed here with its
   status from mcq/status.json, written at every pool build: waiting for review, in the pool, or not taken with the
   reasons. A question stays the student's ("user") whatever the review suggests. Plain text throughout (esc). */
import { esc } from '../core.mjs';
import { lsGet, lsSet } from '../study-kit/store.mjs';
import { dialogOf } from '../study-kit/ui.mjs';
import { DISCIPLINES } from '../study-kit/vocab.mjs';
import { cleanItem, itemProblems, userItem, draftsFrom, newUserId, LETTERS, LICENCES, MAX } from '../mcq/schema.mjs';
import { flawReport } from '../mcq/flaws.mjs';
import { ctx, I, save, notify, openDialog, closeDialog, nameOf, ago, now } from './state.mjs';

export const LS = 'osce.mcq.v1';   /* { items: { id: { item, at, sent } } } on this device; the shared copy is the table */
const store = () => { const s = lsGet(LS, {}) || {}; if (!s.items || typeof s.items !== 'object') s.items = {}; return s; };
const keep = s => lsSet(LS, s);
const project = () => { const c = (typeof window !== 'undefined' && window.OSCE_CONFIG) || {}; return c.supabaseUrl && c.supabaseAnonKey ? { url: String(c.supabaseUrl).replace(/\/+$/, ''), key: c.supabaseAnonKey } : null; };
const STATUS = { pending: 'Waiting for review', pool: 'In the pool', 'pool-reserve': 'Passed, on reserve', rejected: 'Not taken', unsent: 'Not sent' };
const SEV = { block: ['Must fix', 'danger'], major: ['Fix', 'warn'], minor: ['Tip', 'tip'] };

let status = null;   /* mcq/status.json, fetched when the list opens */
async function loadStatus() {
  try { const r = await fetch('./mcq/status.json', { cache: 'no-cache' }); status = r.ok ? ((await r.json()).submissions || {}) : {}; } catch { status = status || {}; }
  return status;
}
export const mine = () => Object.values(store().items).filter(x => x && x.item && x.item.id).sort((a, b) => b.at - a.at);
const stateOf = x => { const s = status?.[x.item.id]; if (s) return s; return { status: x.sent ? 'pending' : 'unsent', reasons: [] }; };

/* the start view's card */
export function mcqCardHtml() {
  const list = mine(), inPool = list.filter(x => stateOf(x).status === 'pool').length;
  const sub = list.length ? `${list.length} submitted${inPool ? ` · ${inPool} in the pool` : ''}` : 'Write a question for the pool. It is checked as you type, then reviewed against Step 2 CK.';
  return `<button class="os-card os-bigcard os-in" data-os="mcq" style="--d:3">
    <span class="os-bigic">${I.note}</span>
    <span class="os-bigtx"><strong>Submit a question</strong><span>${esc(sub)}</span></span>
    <span class="os-chev">${I.chevR}</span></button>`;
}

export async function mcqDlg() {
  if (!mine().length) return mcqForm();
  openDialog({ kind: 'mcqs', title: 'Your questions', cls: 'os-dlg--small', action: `<button class="os-btn os-primary" data-os="mcqnew">${I.plus}<span>New</span></button>`, body: `<div class="os-reqs os-mcqs">${listHtml()}</div>` });
  await loadStatus(); paintMcqs();
}
export function paintMcqs() { const d = dialogOf(ctx.ov, 'mcqs'); if (d) d.el.querySelector('.os-mcqs').innerHTML = listHtml(); }

function listHtml() {
  const list = mine(), sync = !!project();
  const hint = sync ? 'Each question goes to the pool\'s review. Its status here updates when the pool is next rebuilt.'
    : 'This app is not linked to a shared database, so your questions stay on this phone. Export them and send the file to whoever builds the pool.';
  const row = x => {
    const st = stateOf(x), q = x.item, label = STATUS[st.status] || st.status;
    return `<li class="os-reqrow os-mcqrow" data-status="${esc(st.status)}" data-id="${esc(q.id)}">
      <div class="os-reqtop"><strong>${esc(q.stem.length > 140 ? `${q.stem.slice(0, 140)}…` : q.stem)}</strong><span class="os-reqst os-reqst--${st.status === 'pool' ? 'made' : st.status === 'rejected' ? 'declined' : st.status === 'pending' ? 'accepted' : 'new'}">${esc(label)}</span></div>
      <p class="os-reqmeta">Key ${LETTERS[q.answer]}: ${esc(q.options[q.answer])}<br>${esc(q.provenance.submittedBy || '')} · ${esc(ago(x.at))}</p>
      ${st.reasons?.length ? `<ul class="os-mcqwhy">${st.reasons.map(r => `<li>${esc(r)}</li>`).join('')}</ul>` : ''}
      ${!x.sent && sync ? `<div class="os-reqacts"><button class="os-btn" data-os="mcqsend" data-id="${esc(q.id)}">Send again</button></div>` : ''}
    </li>`;
  };
  return `<p class="os-handhint">${hint}</p><ul class="os-reqlist" role="list">${list.map(row).join('')}</ul>
    <div class="os-reqacts"><button class="os-btn" data-os="mcqexport">Export file</button><button class="os-btn" data-os="mcqcopy">Copy</button></div>`;
}

/* ------------------------------------------------------------------ the form */
const SPECS = DISCIPLINES.flatMap(d => d[3]);
export function mcqForm() {
  const who = ctx.mem.reqWho === 1 ? 1 : 0;
  const chip = (name, value, label, on) => `<label class="os-chip os-reqchip${on ? ' on' : ''}"><input type="radio" name="${name}" value="${esc(value)}"${on ? ' checked' : ''}><span>${esc(label)}</span></label>`;
  const d = openDialog({ kind: 'mcqform', title: 'Submit a question', cls: 'os-dlg--small', body: `<form class="os-set os-reqf os-mcqf" novalidate>
    <details class="os-mcqpaste"><summary>Paste JSON or CSV instead</summary>
      <label class="os-setf"><span>One question or many: JSON ({ stem, options, answer, … }) or CSV with a header row (stem, a, b, c, d, e, answer, explanation)</span>
        <textarea name="paste" rows="4" spellcheck="false"></textarea></label>
      <button type="button" class="os-btn" data-os="mcqimport">Read it</button><p class="os-reqmeta os-mcqfound" role="status"></p></details>
    <label class="os-setf"><span>The case (the vignette)</span>
      <textarea name="stem" rows="6" maxlength="${MAX.stem}" placeholder="A 34-year-old woman comes to the emergency department because of… Temperature is 38.4°C, pulse 112/min…"></textarea></label>
    <label class="os-setf"><span>The question (lead-in)</span>
      <input name="ask" maxlength="${MAX.ask}" placeholder="Which of the following is the most appropriate next step in management?"></label>
    <fieldset class="os-reqset"><legend>Options: mark the one best answer</legend><div class="os-mcqopts">
      ${LETTERS.split('').map((L, i) => `<div class="os-mcqopt"><label class="os-mcqkey" title="Mark ${L} as the answer"><input type="radio" name="key" value="${i}" aria-label="${L} is the answer"><span>${L}</span></label>
        <input name="opt${i}" maxlength="${MAX.option}" aria-label="Option ${L}" placeholder="${i === 4 ? 'Option E (optional)' : `Option ${L}`}"></div>`).join('')}
    </div></fieldset>
    <label class="os-setf"><span>Explanation: why the answer is right and each other option wrong</span>
      <textarea name="explanation" rows="4" maxlength="${MAX.explanation}"></textarea></label>
    <label class="os-setf"><span>Topic</span><select name="topic"><option value="">Choose</option>${DISCIPLINES.map(([, n, , specs]) => `<optgroup label="${esc(n)}">${specs.map(s => `<option>${esc(s)}</option>`).join('')}</optgroup>`).join('')}</select></label>
    <fieldset class="os-reqset"><legend>Where it came from</legend><div class="os-reqchips">${chip('from', 'own', 'I wrote it', true)}${chip('from', 'open', 'An open resource')}</div>
      <div class="os-mcqsrc" hidden>
        <label class="os-setf"><span>Source (name)</span><input name="source" maxlength="${MAX.name}" placeholder="e.g. a CC BY question set"></label>
        <label class="os-setf"><span>Link</span><input name="url" type="url" maxlength="${MAX.url}" placeholder="https://"></label>
        <label class="os-setf"><span>Licence</span><select name="licence">${LICENCES.filter(l => l !== 'own').map(l => `<option>${esc(l)}</option>`).join('')}</select></label>
        <p class="os-reqmeta">Only openly licensed questions can be shared. Questions from paid or official banks (UWorld, AMBOSS, NBME, the USMLE samples) cannot.</p>
      </div></fieldset>
    <label class="os-setf"><span>Author (as it should be credited)</span><input name="author" maxlength="${MAX.author}" value="${esc(nameOf(who))}"></label>
    <fieldset class="os-reqset"><legend>Who is submitting</legend><div class="os-reqchips">${[0, 1].map(i => chip('who', String(i), nameOf(i), i === who)).join('')}</div></fieldset>
    <section class="os-mcqchecks" aria-live="polite"></section>
    <button type="submit" class="os-btn os-btn--lg os-primary os-reqsend">Submit question</button>
  </form>` });
  const f = d.el.querySelector('form');
  f._drafts = null;
  let t = 0;
  const live = () => { clearTimeout(t); t = setTimeout(() => paintChecks(f), 150); };
  f.addEventListener('input', e => { if (e.target.name !== 'paste') { f._drafts = null; live(); } });
  f.addEventListener('change', e => {
    if (e.target.closest('.os-reqchip')) f.querySelectorAll('.os-reqchip').forEach(l => l.classList.toggle('on', l.querySelector('input').checked));
    f.querySelector('.os-mcqsrc').hidden = val(f, 'from') !== 'open';
    live();
  });
  f.addEventListener('submit', e => { e.preventDefault(); submit(f); });
  paintChecks(f);
}

const val = (f, n) => f.querySelector(`[name="${n}"]:checked`)?.value ?? f.querySelector(`[name="${n}"]`)?.value ?? '';
/* the form as a draft (schema.mjs draftsFrom's shape) */
function draftOf(f) {
  const open = val(f, 'from') === 'open', key = f.querySelector('[name="key"]:checked');
  return { stem: val(f, 'stem'), ask: val(f, 'ask'), options: LETTERS.split('').map((_, i) => val(f, `opt${i}`)), answer: key ? Number(key.value) : -1,
    explanation: val(f, 'explanation'), why: [], topic: val(f, 'topic'), tags: [], source: open ? val(f, 'source') || 'An open resource' : '', url: open ? val(f, 'url') : '', licence: open ? val(f, 'licence') : '', author: val(f, 'author') };
}
const itemOf = (draft, f, id = 'u-preview0') => userItem(draft, { by: nameOf(val(f, 'who') === '1' ? 1 : 0), now: now(), id });
/* everything the checks find, worst first: the shape (must fix), then the item-writing flaws */
export function findings(item) {
  const shape = itemProblems(item).map(reason => ({ check: 'schema', severity: 'block', reason }));
  const flaws = shape.length ? [] : flawReport(item).failed.filter(x => x.severity !== 'info' && x.check !== 'schema');
  const order = { block: 0, major: 1, minor: 2 };
  return [...shape, ...flaws].sort((a, b) => order[a.severity] - order[b.severity]);
}
function checksHtml(list, n = 1) {
  if (!list.length) return `<p class="os-mcqok">${I.check}<span>${n > 1 ? `All ${n} questions pass` : 'Passes'} the item-writing checks. The review then checks the medicine.</span></p>`;
  return `<h3>${list.some(x => x.severity === 'block') ? 'Fix these to submit' : 'Before you submit'}</h3><ul class="os-mcqlist">${list.map(x => `<li data-sev="${x.severity}" data-check="${esc(x.check)}"><span class="os-mcqsev os-mcqsev--${SEV[x.severity][1]}">${SEV[x.severity][0]}</span><span>${esc(x.reason)}</span></li>`).join('')}</ul>`;
}
function paintChecks(f) {
  const box = f.querySelector('.os-mcqchecks'), btn = f.querySelector('.os-reqsend');
  if (f._drafts) {
    const all = f._drafts.map((dr, i) => findings(itemOf(dr, f, `u-preview${i}`)).map(x => ({ ...x, reason: `Question ${i + 1}: ${x.reason}` }))).flat();
    box.innerHTML = checksHtml(all, f._drafts.length);
    btn.textContent = `Submit ${f._drafts.length} questions`; btn.disabled = all.some(x => x.severity === 'block');
    return;
  }
  const list = findings(itemOf(draftOf(f), f));
  const empty = !val(f, 'stem').trim() && !LETTERS.split('').some((_, i) => val(f, `opt${i}`).trim());
  box.innerHTML = empty ? '<p class="os-reqmeta">The item-writing checks run here as you type.</p>' : checksHtml(list);
  btn.textContent = 'Submit question'; btn.disabled = empty || list.some(x => x.severity === 'block');
}

/* paste: one question fills the form; several are sent together */
export function importPaste(b) {
  const f = b.closest('form'), drafts = draftsFrom(val(f, 'paste')), msg = f.querySelector('.os-mcqfound');
  if (!drafts.length) { msg.textContent = 'No question found. Check it is JSON with stem and options, or CSV with a header row.'; return; }
  if (drafts.length === 1) {
    const d = drafts[0];
    f.querySelector('[name="stem"]').value = d.stem; f.querySelector('[name="ask"]').value = d.ask || '';
    LETTERS.split('').forEach((_, i) => { f.querySelector(`[name="opt${i}"]`).value = d.options[i] || ''; });
    f.querySelectorAll('[name="key"]').forEach(r => { r.checked = Number(r.value) === d.answer; });
    f.querySelector('[name="explanation"]').value = d.explanation || '';
    if (SPECS.includes(d.topic)) f.querySelector('[name="topic"]').value = d.topic;
    if (d.source) { f.querySelector('[name="from"][value="open"]').checked = true; f.querySelector('[name="source"]').value = d.source; f.querySelector('[name="url"]').value = d.url || ''; if (LICENCES.includes(d.licence)) f.querySelector('[name="licence"]').value = d.licence; }
    if (d.author) f.querySelector('[name="author"]').value = d.author;
    f.dispatchEvent(new Event('change'));
    f._drafts = null; msg.textContent = 'One question read into the form.';
  } else { f._drafts = drafts; msg.textContent = `${drafts.length} questions read. They are checked below and sent together.`; }
  paintChecks(f);
}

async function send(item) {
  const p = project(); if (!p) return false;
  try {
    const r = await fetch(`${p.url}/rest/v1/mcq_submissions`, { method: 'POST', headers: { apikey: p.key, Authorization: `Bearer ${p.key}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ id: item.id, item, submitted_by: item.provenance.submittedBy || '' }) });
    return r.ok || r.status === 409;   /* 409: already there (sent before, the answer lost) */
  } catch { return false; }
}
async function submit(f) {
  const drafts = f._drafts || [draftOf(f)], who = val(f, 'who') === '1' ? 1 : 0, s = store(), made = [];
  for (const d of drafts) {
    const raw = userItem(d, { by: nameOf(who), now: now(), id: newUserId(now()) }), item = cleanItem(raw);
    if (!item || findings(item).some(x => x.severity === 'block')) { notify('A question still has something to fix: see the list above the button.', 'danger'); return paintChecks(f); }
    made.push(item);
  }
  for (const item of made) s.items[item.id] = { item, at: now(), sent: false };
  keep(s); ctx.mem.reqWho = who; save();
  const sync = !!project();
  if (sync) { for (const item of made) s.items[item.id].sent = await send(item); keep(s); }
  closeDialog(true);
  const unsent = made.filter(i => !s.items[i.id].sent).length;
  notify(!sync ? 'Saved on this phone. Export it to send it.' : unsent ? 'Saved, but it did not send. Try again from your questions.' : made.length > 1 ? `${made.length} questions sent for review.` : 'Question sent for review.', unsent && sync ? 'danger' : 'success');
  if (dialogOf(ctx.ov, 'mcqs')) paintMcqs(); else mcqDlg();
  ctx.render();
}
export async function resend(id) {
  const s = store(), x = s.items[id]; if (!x) return;
  x.sent = await send(x.item); keep(s); paintMcqs();
  notify(x.sent ? 'Sent.' : 'It did not send. Check the connection.', x.sent ? 'success' : 'danger');
}

/* the export: every question on this phone, in the file mcq-submissions.mjs reads */
export const exportText = () => JSON.stringify({ mcqSubmissions: 1, exportedAt: new Date(now()).toISOString(), items: mine().map(x => x.item) }, null, 1);
export function exportMcqs() {
  const blob = new Blob([exportText()], { type: 'application/json' }), a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = `mcq-submissions-${new Date(now()).toISOString().slice(0, 10)}.json`;
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
export async function copyMcqs() {
  try { await navigator.clipboard.writeText(exportText()); notify('Copied. Paste it into a message.', 'success'); }
  catch { notify('Could not copy on this device. Use Export file.', 'danger'); }
}
