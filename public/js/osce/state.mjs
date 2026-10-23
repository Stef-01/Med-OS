/* osce/state.mjs — what every OSCE view shares (plan unit F3, 2026-10-19; from osce.mjs): the one mutable `ctx`
   (overlay shell + root, open flag, the bank and its lazy bodies, the save `mem`, the current view / tab / attempt
   under review), storage (localStorage 'osce.practice.v1', every access guarded, the att mirror the start view reads),
   the bank loader (osce/index.json + exam.json, bodies fetched once on use), the bell, the kit's dialogs, popover and
   toast under OSCE's class names, the partner names, and the small HTML bits two views draw (Save button, tags).
   `ctx.render` is the view dispatcher: osce.mjs (the entry) sets it, so a view module repaints without importing the
   entry (no module cycle). The icons table lives here: every view draws from it. */
import { esc } from '../core.mjs';
import { loadCss } from '../study-kit/css.mjs';
import { lsGet, lsSet } from '../study-kit/store.mjs';
import { changed as syncChanged } from '../study-kit/sync.mjs';   /* every record on every device (2026-10-19) */
import { ago as agoAt, reduced } from '../study-kit/util.mjs';
import { icon } from '../study-kit/icons.mjs';
import { specialtyEmoji, sourceTag } from '../study-kit/vocab.mjs';
import { popover, closePopover, dialog as kitDialog, closeTop, topDialog as topDlg, confirm as kitConfirm, toast as kitToast } from '../study-kit/ui.mjs';
import { osceScore, osceStations, osceIndexRows, osceLazy, osceBody, osceOrigin, osceName, osceWho } from './core.mjs';

export const LS = 'osce.practice.v1';
export const KEY_LS = 'osce.marker.v1';   /* this device only, never synced: {key, model} for AI marking */
export const GI = ['Below standard', 'Borderline', 'At standard', 'Above standard'];   /* osceMarks.ts globalImpressionLabel */
export const GI_C = ['danger', 'warning', 'success', 'success'];
export const PAGE = 24, WIDE = '(min-width: 900px)';

export const I = {   /* tabler icons, as eMedici uses: the kit's table under this module's old names */
  back: icon('chevronLeft'), x: icon('x'), search: icon('search'), eye: icon('eye'), eyeOff: icon('eyeOff'), bm: icon('bookmark'), plus: icon('plus'),
  check: icon('check'), shuffle: icon('shuffle'), minus: icon('circleMinus'), plusC: icon('circlePlus'), grip: icon('grip'), clock: icon('clock'),
  reload: icon('refresh'), play: icon('playFilled'), pause: icon('pauseFilled'), next: icon('nextFilled'), stop: icon('stopFilled'), dots: icon('circleDots'),
  exit: icon('exit'), done: icon('circleCheck'), arrowR: icon('circleArrowRight'), info: icon('infoCircle'), chevR: icon('chevronRight'), chevD: icon('chevronDown'),
  bolt: icon('bolt'), newS: icon('circlePlus'), resume: icon('circlePlay'), marker: icon('marker'), note: icon('pencil'),
  gear: icon('settings'), users: icon('users'), max: icon('maximize'), prev: icon('chevronLeft'),
};   /* bolt, arrowR, chevR, newS, resume once asked for 1.3-1.4 in a second stroke-width attribute the parser ignored: they always drew at 2 */

/* ---------------------------------------------------------------- the shared state */
export const ctx = {
  shell: null, ov: null, isOpen: false, mq: null,
  dataP: null, stations: [], byId: new Map(), exam: {},
  bodies: new Map(), bodyP: new Map(),   /* id -> station whole (loaded); id -> its fetch in flight */
  mem: null, view: 'start', back2: 'group', tab: 'Instructions', reviewId: null,
  render: () => {},   /* set by osce.mjs: repaint the header + the current view */
};

export const load = () => lsGet(LS, {}) || {};
export const save = () => {
  try {   /* att mirrors the attempted stations for Learn's home count (learn.mjs reads .att keys) */
    const { mem, bodies } = ctx, att = {};
    for (const [id, list] of Object.entries(mem.hist)) {
      const fin = list.filter(a => a.fin);
      if (!fin.length) continue;
      const last = fin[fin.length - 1], st = bodies.get(id);
      if (st) { const sc = osceScore(st.check, last.ticks); att[id] = { got: sc.got, of: sc.of, at: last.fin }; }
      else att[id] = { ...(mem.att && mem.att[id]), at: last.fin };   /* body not loaded: the last score stands */
    }
    mem.att = att;
    lsSet(LS, mem);
    syncChanged('osce');
  } catch { /* this session still works */ }
};
export const $ = s => ctx.ov.querySelector(s);
export const sess = () => ctx.mem.sess;
export const attempted = id => (ctx.mem.hist[id] || []).some(a => a.fin);
export const curAttempt = () => { const s = sess(); return s.aid ? findAttempt(s.aid) : null; };
export const findAttempt = aid => { for (const l of Object.values(ctx.mem.hist)) { const a = l.find(x => x.id === aid); if (a) return a; } return null; };
export const now = () => Date.now();
export const ago = ms => agoAt(ms, now());

export const css = () => loadCss('./css/osce.css');
import { pulse } from '../study-kit/util.mjs'; export { pulse };   /* eMedici's pulse(), the kit's (lifted 2026-10-19) */

/* ---------------------------------------------------------------- the bank */
/* every Learn file but learn-index.json is fetched with the browser's default cache: the server's ETag decides (Vercel:
   max-age=0, must-revalidate), so an unchanged body costs a 304 */
const getJson = (url, must) => fetch(url, { cache: 'default' }).then(r => (r.ok ? r.json() : must ? Promise.reject(new Error(`${url} ${r.status}`)) : null));
/* the bank: osce/index.json (one light row per station, scripts/build-index.mjs) and the AI-written exam findings
   (exam.json; optional: a missing file leaves every station without the Exam tab) */
export const loadStations = () => ctx.dataP || (ctx.dataP = Promise.all([
  getJson('./osce/index.json', true).then(osceIndexRows),
  getJson('./exam.json').catch(() => null)])
  .then(([j, ex]) => {
    ctx.exam = (ex && typeof ex.stations === 'object' && ex.stations) || {};
    ctx.stations = osceStations(j, null);
    ctx.byId = new Map(ctx.stations.map(s => [s.id, s]));
    ctx.bodies = new Map(ctx.stations.filter(s => !osceLazy(s)).map(s => [s.id, s]));
    ctx.bodyP = new Map();
    return ctx.stations;
  })
  .catch(e => { ctx.dataP = null; throw e; }));
/* the station whole, fetched once: previews, the clock, attempt reviews and the att mirror read it; browse does not */
export const body = id => {
  const { byId, bodies, bodyP, stations } = ctx, s = byId.get(id);
  if (!s) return Promise.reject(new Error(`station ${id} is not in the bank`));
  if (bodies.has(id)) return Promise.resolve(bodies.get(id));
  if (!bodyP.has(id)) bodyP.set(id, getJson(`./osce/${encodeURIComponent(id)}.json`, true).then(j => {
    const full = osceBody(s, j);
    if (!full) throw new Error(`osce/${id}.json is not station ${id}`);
    bodies.set(id, full); byId.set(id, full);
    const i = stations.indexOf(s); if (i >= 0) stations[i] = full;
    return full;
  }).catch(e => { bodyP.delete(id); throw e; }));
  return bodyP.get(id);
};
export const NOLOAD = 'That station did not load. Check the connection and try again.';

/* ---------------------------------------------------------------- AI marking settings (this device only)
   An Anthropic API key on this device marks a transcript straight away (osce/marker.mjs); with no key, the marking fold
   copies a prompt for a Claude chat and takes the reply back. The key never leaves this browser except to the API. */
export const DEFAULT_MODEL = 'claude-opus-5-5';
export const markerCfg = () => { const c = lsGet(KEY_LS, {}) || {}; return { key: typeof c.key === 'string' ? c.key : '', model: typeof c.model === 'string' && c.model ? c.model : DEFAULT_MODEL }; };
export const setMarkerCfg = c => lsSet(KEY_LS, { key: String(c.key || '').trim(), model: String(c.model || DEFAULT_MODEL).trim() });
export const aiEnabled = () => !!markerCfg().key;

/* ---------------------------------------------------------------- partners: the names, and who sits / examines */
export const people = () => ctx.mem.people;
export const nameOf = i => osceName(ctx.mem.people, i);
/* the badge letter: the name's first letter, else A / B */
export const initialOf = i => (ctx.mem.people[i] ? ctx.mem.people[i].slice(0, 1).toUpperCase() : i === 1 ? 'B' : 'A');
export const whoOf = a => osceWho(a);
/* "Sam is the candidate · Alex examines" for the station on the clock */
export const roleLine = cand => `${esc(nameOf(cand))} is the candidate · ${esc(nameOf(cand === 1 ? 0 : 1))} examines`;
/* the same, short enough for the header on a phone */
export const roleShort = cand => `<span class="os-roleshort">Candidate <b>${esc(nameOf(cand))}</b> · examiner ${esc(nameOf(cand === 1 ? 0 : 1))}</span>`;
/* a small initial badge: whose attempt this was */
export const whoBadge = a => { const w = osceWho(a); return w == null ? '' : `<span class="os-who os-who--${w}" title="${esc(nameOf(w))}">${esc(initialOf(w))}</span>`; };

/* ---------------------------------------------------------------- bell: osceTimer.ts rings resources/sounds/bell.mp3; synthesized here */
let actx = null;
export function audio() {
  try { actx ||= new (window.AudioContext || window.webkitAudioContext)(); if (actx.state === 'suspended') actx.resume(); } catch { actx = null; }
  return actx;
}
export function bell() {
  try { navigator.vibrate?.(180); } catch {}
  const a = audio();
  if (!a) return;
  try {
    const t = a.currentTime + 0.02, out = a.createGain();
    out.gain.value = 0.32; out.connect(a.destination);
    [[1, 1], [2.76, 0.42], [5.4, 0.2], [8.93, 0.09]].forEach(([r, g]) => {   /* a struck bell's inharmonic partials */
      const o = a.createOscillator(), e = a.createGain();
      o.type = 'sine'; o.frequency.value = 784 * r;
      e.gain.setValueAtTime(0, t); e.gain.linearRampToValueAtTime(g, t + 0.006);
      e.gain.exponentialRampToValueAtTime(0.0001, t + 2.4 / Math.sqrt(r));
      o.connect(e); e.connect(out); o.start(t); o.stop(t + 2.6);
    });
  } catch {}
}

/* ---------------------------------------------------------------- HTML bits two views draw */
export const bmButton = (id, label) => `<button class="os-bm${label ? ' os-bm--label' : ''}" data-os="bm" data-id="${esc(id)}" aria-pressed="${!!ctx.mem.bm[id]}" aria-label="${ctx.mem.bm[id] ? 'Saved' : 'Save'}">${I.bm}${label ? `<span>${ctx.mem.bm[id] ? 'Saved' : 'Save'}</span>` : ''}</button>`;
export function syncBm(id) {
  const { mem } = ctx;
  ctx.ov.querySelectorAll(`.os-bm[data-id="${CSS.escape(id)}"]`).forEach(b => {
    b.setAttribute('aria-pressed', String(!!mem.bm[id]));
    b.setAttribute('aria-label', mem.bm[id] ? 'Saved' : 'Save');
    const sp = b.querySelector('span'); if (sp) sp.textContent = mem.bm[id] ? 'Saved' : 'Save';
    if (mem.bm[id]) pulse(b.querySelector('svg'), 1.5);   /* BookmarkButton.vue: the icon pulses on save, not on unsave */
  });
}
export function tagHtml(s, maxSpec = 2) {
  const sp = s.specialty || [];
  return sp.slice(0, maxSpec).map(n => `<span class="os-tag">${specialtyEmoji(n) ? `<i>${specialtyEmoji(n)}</i>` : ''}${esc(n)}</span>`).join('')
    + (sp.length > maxSpec ? `<span class="os-tag">+${sp.length - maxSpec}</span>` : '')
    + ((s.type || [])[0] ? `<span class="os-tag">${esc(s.type[0])}</span>` : '')
    + (s.mediaCount ? `<span class="os-tag" title="${s.mediaCount} image${s.mediaCount === 1 ? '' : 's'}">🩻 ${s.mediaCount}</span>` : '')
    + srcTag(s);
}
/* the station's source tag (the kit's, on every surface a station shows): AI with the class or weak concept it came from, else eMedici */
/* the AI-written examination findings for a station (osce_exam_findings.py), or null: never eMedici content */
export const examOf = st => (st && ctx.exam?.[String(st.id)]) || null;
export const srcTag = s => sourceTag(osceOrigin(s), osceOrigin(s) === 'ai' ? `${s.source?.label ? `AI generated from ${s.source.label}` : s.basis?.length ? 'AI generated from weak concepts' : 'AI generated'}${s.focus ? `: ${s.focus}` : ''}` : 'Written by you');

/* ---------------------------------------------------------------- dialogs (Dialog.vue in ui-modal), popovers, alerts */
const DLG = { wrap: 'os-modal', box: 'os-dlg', head: 'os-dlg-head', close: 'os-ic os-dlg-x', title: 'os-dlg-title', titleTag: 'h1', act: 'os-dlg-act', body: 'os-dlg-body', in: 'in', out: 'out' };
const CONFIRM = { ...DLG, confirm: 'os-confirm', crow: 'os-crow', btn: 'os-btn', danger: 'os-btn os-dangerbtn' };
export function openDialog({ kind, title = '', action = '', body = '', cls = '', noHead = false, onClose = null }) {
  return kitDialog({ kind, title, action, body, extra: cls, noHead, cls: DLG, root: ctx.ov, label: title || kind, onClose });
}
export const closeDialog = instant => closeTop(ctx.ov, instant);
/* the presenter: a full-screen, opaque layer over everything in OSCE (the marking sheet included) for showing the
   candidate a result; the kit's dialog in its bare form, so Escape, the close button and focus return work as elsewhere */
export const openPresenter = (body, onClose) => kitDialog({ kind: 'present', bare: true, body, root: ctx.ov, label: 'Results for the candidate', cls: { wrap: 'os-present', in: 'in', out: 'out' }, onClose });
export const topDialog = () => topDlg(ctx.ov);
export const confirmDlg = o => kitConfirm({ ...o, cls: CONFIRM, root: ctx.ov, extra: 'os-dlg--small' });

const POP = { pop: 'os-pop', in: 'in', out: 'out' };
export const openPop = (anchor, html, onPick) => popover(anchor, html, { role: null, onPick, cls: POP, root: ctx.ov, align: 'auto', origin: true });
export const closePop = closePopover;

export const notify = (text, type = '') => kitToast($('.os-alerts'), text, { tone: type, cls: { item: 'os-alert', in: 'in', out: 'out' } });
