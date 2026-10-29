/* osce/requests-view.mjs - Request a case: the card on the start view, the form, and your requests with where each one
   stands (requested, being written, ready to open, not made). The laws are osce/requests.mjs; a request is saved in the
   shared record (mem.req), so with a Supabase project it reaches the case writer's pipeline and the answer comes back;
   with none, Copy or Share sends it. */
import { esc } from '../core.mjs';
import { enabled as syncOn } from '../study-kit/sync.mjs';
import { dialogOf } from '../study-kit/ui.mjs';
import { DISCIPLINES } from '../study-kit/vocab.mjs';
import { KINDS } from './core.mjs';
import { REQ_SETTINGS, REQ_PATIENTS, REQ_FOCUS, REQ_RESULTS, REQ_STATUS, REQ_MAX, cleanRequest, newRequestId, requestState, requestText } from './requests.mjs';
import { ctx, I, save, notify, openDialog, closeDialog, topDialog, nameOf, ago, now } from './state.mjs';

/* this record's requests, each with where it stands: ready to open first, then the open ones, then the rest; newest first within */
const ready = x => x.status === 'made' && ctx.byId.has(x.station);
const rank = x => (ready(x) ? 0 : x.status === 'declined' ? 2 : 1);
export const myRequests = () => Object.values(ctx.mem.req || {}).map(cleanRequest).filter(Boolean)
  .map(r => ({ r, ...requestState(r, ctx.stations) })).sort((a, b) => rank(a) - rank(b) || b.r.at - a.r.at);

/* the start view's card: what it is for, or how your requests stand */
export function requestCardHtml() {
  const list = myRequests(), n = list.filter(ready).length, open = list.filter(x => x.status === 'new' || x.status === 'accepted').length;
  const sub = list.length ? [n && `${n} ready to practise`, open && `${open} waiting`].filter(Boolean).join(' · ') || 'Ask for another case'
    : 'A station the bank lacks';
  return `<button class="os-card os-bigcard os-in" data-os="requests" style="--d:3">
    <span class="os-bigic">${I.bulb}${n ? `<span class="os-reqbadge" aria-hidden="true">${n}</span>` : ''}</span>
    <span class="os-bigtx"><strong>Request a case</strong><span>${esc(sub)}</span></span>
    <span class="os-chev">${I.chevR}</span></button>`;
}

/* the card opens your requests, or the form when there are none yet */
export function requestsDlg() { if (!myRequests().length) return requestForm(); openDialog({ kind: 'requests', title: 'Case requests', cls: 'os-dlg--small',
  action: `<button class="os-btn os-primary" data-os="reqnew">${I.plus}<span>New</span></button>`, body: `<div class="os-reqs">${listHtml()}</div>` }); }
export function paintRequests() { const d = dialogOf(ctx.ov, 'requests'); if (d) d.el.querySelector('.os-reqs').innerHTML = listHtml(); }

function listHtml() {
  const list = myRequests(), sync = syncOn();
  const hint = sync ? 'Your requests go to whoever writes your cases, and each shows here as it is written. A finished case joins the bank with its marking sheet.'
    : 'This app is not linked to a shared database, so send each request yourself with Copy or Share. A finished case joins the bank with its marking sheet and shows here as Ready.';
  const row = ({ r, status, station }) => {
    const label = status === 'made' && !ctx.byId.has(station) ? 'Written' : REQ_STATUS[status];
    const meta = [REQ_SETTINGS[r.setting] !== REQ_SETTINGS.any && REQ_SETTINGS[r.setting].split(':')[0], r.specialty, r.patient && REQ_PATIENTS[r.patient],
      r.results && r.results.map(k => KINDS[k]).join(', ')].filter(Boolean).join(' · ');
    return `<li class="os-reqrow" data-status="${status}">
      <div class="os-reqtop"><strong>${esc(r.topic)}</strong><span class="os-reqst os-reqst--${status}">${esc(label)}</span></div>
      <p class="os-reqmeta">${meta ? `${esc(meta)}<br>` : ''}${esc(r.by || 'Asked')} · ${esc(ago(r.at))}</p>
      ${r.reply ? `<p class="os-reqreply">${esc(r.reply)}</p>` : ''}
      ${status === 'made' && !ctx.byId.has(station) ? '<p class="os-reqmeta">It arrives with the next update of the app.</p>' : ''}
      <div class="os-reqacts">
        ${ready({ status, station }) ? `<button class="os-btn os-primary" data-os="preview" data-id="${esc(station)}">${I.eye}<span>Open station</span></button>` : ''}
        ${status === 'new' && !sync ? `<button class="os-btn" data-os="reqcopy" data-id="${esc(r.id)}">Copy</button>${typeof navigator !== 'undefined' && navigator.share ? `<button class="os-btn" data-os="reqshare" data-id="${esc(r.id)}">${I.share}<span>Share</span></button>` : ''}` : ''}
        ${status === 'new' ? `<button class="os-link" data-os="reqdrop" data-id="${esc(r.id)}">Withdraw</button>` : ''}
      </div></li>`;
  };
  return `<p class="os-handhint">${hint}</p>${list.length ? `<ul class="os-reqlist" role="list">${list.map(row).join('')}</ul>` : '<p class="os-reqmeta">No requests yet.</p>'}`;
}

/* the form: the case in a line, then whatever narrows it (all optional), and who is asking */
export function requestForm(topic = '') {
  const chip = (type, name, value, label, on) => `<label class="os-chip os-reqchip${on ? ' on' : ''}"><input type="${type}" name="${name}" value="${esc(value)}"${on ? ' checked' : ''}><span>${esc(label)}</span></label>`;
  const who = ctx.mem.reqWho === 1 ? 1 : 0;
  const d = openDialog({ kind: 'reqform', title: 'Request a case', cls: 'os-dlg--small', body: `<form class="os-set os-reqf" novalidate>
    <label class="os-setf"><span>What should the case be about?</span>
      <textarea name="topic" rows="2" maxlength="${REQ_MAX.topic}" placeholder="e.g. chest pain in a 58-year-old smoker">${esc(topic)}</textarea></label>
    <fieldset class="os-reqset"><legend>Setting</legend><div class="os-reqchips">${Object.entries(REQ_SETTINGS).map(([k, l]) => chip('radio', 'setting', k, l, k === 'any')).join('')}</div></fieldset>
    <label class="os-setf"><span>Specialty</span><select name="specialty"><option value="">Any</option>${DISCIPLINES.map(([, n, , specs]) => `<optgroup label="${esc(n)}">${specs.map(s => `<option>${esc(s)}</option>`).join('')}</optgroup>`).join('')}</select></label>
    <fieldset class="os-reqset"><legend>Patient</legend><div class="os-reqchips">${chip('radio', 'patient', '', 'Any', true)}${Object.entries(REQ_PATIENTS).map(([k, l]) => chip('radio', 'patient', k, l)).join('')}</div></fieldset>
    <fieldset class="os-reqset"><legend>Results to interpret in Part 2</legend><div class="os-reqchips">${REQ_RESULTS.map(k => chip('checkbox', 'results', k, KINDS[k])).join('')}</div></fieldset>
    <fieldset class="os-reqset"><legend>Focus</legend><div class="os-reqchips">${REQ_FOCUS.map(f => chip('checkbox', 'focus', f, f)).join('')}</div></fieldset>
    <label class="os-setf"><span>Anything else</span>
      <textarea name="notes" rows="3" maxlength="${REQ_MAX.notes}" placeholder="What you want to practise, a guideline to follow, your exam date"></textarea></label>
    <fieldset class="os-reqset"><legend>Who is asking</legend><div class="os-reqchips">${[0, 1].map(i => chip('radio', 'who', String(i), nameOf(i), i === who)).join('')}</div></fieldset>
    <button type="submit" class="os-btn os-btn--lg os-primary os-reqsend">Send request</button>
  </form>` });
  const f = d.el.querySelector('form');
  f.addEventListener('submit', e => { e.preventDefault(); sendRequest(f); });
  f.addEventListener('change', e => { if (e.target.closest('.os-reqchip')) f.querySelectorAll('.os-reqchip').forEach(l => l.classList.toggle('on', l.querySelector('input').checked)); });
  if (!topic) requestAnimationFrame(() => f.querySelector('[name="topic"]').focus({ preventScroll: true }));
}

function sendRequest(f) {
  const v = n => f.querySelector(`[name="${n}"]:checked`)?.value ?? f.querySelector(`[name="${n}"]`)?.value ?? '';
  const all = n => [...f.querySelectorAll(`[name="${n}"]:checked`)].map(x => x.value);
  const who = v('who') === '1' ? 1 : 0, at = now();
  const r = cleanRequest({ id: newRequestId(at), topic: v('topic'), setting: v('setting'), specialty: v('specialty'), patient: v('patient'),
    results: all('results'), focus: all('focus'), notes: v('notes'), by: nameOf(who), at, status: 'new' });
  if (!r) { notify('Say what the case should be about, in a few words.', 'danger'); return f.querySelector('[name="topic"]').focus(); }
  (ctx.mem.req ||= {})[r.id] = r; ctx.mem.reqWho = who;
  save();
  closeDialog(true);
  notify(syncOn() ? 'Request sent.' : 'Saved. Copy or Share it to send it.', 'success');
  if (dialogOf(ctx.ov, 'requests')) paintRequests(); else requestsDlg();
  ctx.render();
}

const findReq = id => cleanRequest(ctx.mem.req?.[id]);
export async function copyRequest(id) {
  const r = findReq(id); if (!r) return;
  try { await navigator.clipboard.writeText(requestText(r)); notify('Copied. Paste it into a message.', 'success'); }
  catch { notify('Could not copy on this device. Try Share.', 'danger'); }
}
export async function shareRequest(id) {
  const r = findReq(id); if (!r || !navigator.share) return;
  try { await navigator.share({ title: `OSCE case request: ${r.topic}`, text: requestText(r) }); } catch { /* the share sheet was closed */ }
}
export function withdrawRequest(id) {
  if (!ctx.mem.req?.[id]) return;
  delete ctx.mem.req[id];   /* the sync writes the removal, so it leaves the writer's queue too */
  save(); notify('Request withdrawn.');
  paintRequests(); ctx.render();
  if (!myRequests().length && topDialog()?.kind === 'requests') closeDialog(true);
}
