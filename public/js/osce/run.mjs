/* osce/run.mjs — the Start view (OscesStart.vue) and Fast Run (plan unit F3, 2026-10-19; from osce.mjs). Fast Run:
   rotation pills → specialties / source / station-type dropdowns → a shuffled queue → straight onto the clock
   (Stefan 2026-10-19). The selection lives in mem.run {specs, origin, type, open}; the laws it draws on (ROTATIONS,
   osceRunPool, osceShuffle) are in core.mjs. */
import { esc } from '../core.mjs';
import { discRowHtml, sourceLabel } from '../study-kit/vocab.mjs';
import { ROTATIONS, ORIGINS, osceOrigin, osceRunPool, osceShuffle, oscePeople, osceCounts, NAME_MAX } from './core.mjs';
import { ctx, I, GI, GI_C, save, sess, attempted, curAttempt, confirmDlg, openPop, ago, nameOf, initialOf, whoBadge } from './state.mjs';
import { startAttempt } from './session.mjs';

export function renderStart(main) {
  const s = sess(), n = s.queue.length, live = s.idx != null;
  const done = Object.keys(ctx.mem.hist).filter(attempted).length, n3 = osceCounts(ctx.mem.hist);
  main.innerHTML = `<div class="os-start">
    <p class="os-kicker">${ctx.stations.length} stations · ${done} attempted${n3[0] || n3[1] ? ` · ${esc(nameOf(0))} ${n3[0]} · ${esc(nameOf(1))} ${n3[1]}` : ''}</p>
    ${pairHtml()}
    ${live || n ? `<button class="os-card os-bigcard os-in" data-os="resume">
        <span class="os-bigic">${I.resume}</span>
        <span class="os-bigtx"><strong>Resume Study Session</strong>
          <span>${live ? `Station ${s.idx + 1} of ${n} in progress` : `${n} station${n === 1 ? '' : 's'} in the queue`}</span></span>
        <span class="os-chev">${I.chevR}</span></button>` : ''}
    ${runHtml()}
    <button class="os-card os-bigcard os-in" data-os="new" style="--d:2">
      <span class="os-bigic">${I.newS}</span>
      <span class="os-bigtx"><strong>New Study Session</strong>
        <span>Queue stations and run each one on the clock: one of you is the candidate, the other reads the patient and marks.</span></span>
      <span class="os-chev">${I.chevR}</span></button>
    ${doneHtml()}
  </div>`;
  runPaint();
}

/* Completed stations on the home (2026-10-20, founder: at the bottom, toggleable, a badge for completed vs AI-marked, a
   score ring beside each station): the latest finished attempt per station, newest first. The ring shows the AI's score
   when the station is AI-marked, else Stefan's own ticks; a tap opens that attempt (and lands on the AI marks). */
function doneHtml() {
  const rows = [];
  for (const [sid, list] of Object.entries(ctx.mem.hist || {})) {
    if (!ctx.byId.has(sid)) continue;
    const fin = (list || []).filter(a => a.fin && a.ai && a.ai.status);   /* only attempts whose transcript was sent: no transcript, not in the AI queue */
    if (!fin.length) continue;
    const a = fin.reduce((x, y) => ((y.fin || 0) > (x.fin || 0) ? y : x));
    rows.push({ sid, a });
  }
  if (!rows.length) return '';
  rows.sort((x, y) => (y.a.fin || 0) - (x.a.fin || 0));
  const marked = rows.filter(r => r.a.ai?.status === 'done').length;
  const row = ({ sid, a }) => {
    const st = ctx.byId.get(sid), ai = a.ai, r = ai?.status === 'done' ? ai.result : null;
    const got = r ? r.items.filter(i => i.done).length : 0, of = r ? r.items.length : 0;
    const badge = r ? '<span class="os-sb os-sb--ai">AI marked</span>'
      : ai?.status === 'declined' ? '<span class="os-sb os-sb--no">Not marked</span>' : '';
    const g = r && r.global != null ? ` · <b class="c-${GI_C[r.global]}">${GI[r.global]}</b>` : '';
    return `<li><button class="os-drow" data-os="review" data-aid="${esc(a.id)}">
      <span class="os-dscore${r ? ' ai' : ''}">${r && of ? `<b>${got}</b>/${of}` : '–'}</span>
      <span class="os-dtx"><strong>${whoBadge(a)}${esc(st.title)}</strong><span>${badge}<span class="os-dmeta">${esc(ago(a.fin))}${g}</span></span></span>
      <span class="os-chev">${I.chevR}</span></button></li>`;
  };
  return `<details class="os-card os-donecard os-in" style="--d:3">
    <summary><span class="os-bigic">${I.check}</span><span class="os-bigtx"><strong>AI marking</strong>
      <span>${marked} marked${rows.length - marked ? ` · ${rows.length - marked} not marked` : ''}</span></span>
      ${I.chevD}</summary>
    <ul role="list" class="os-dlist">${rows.slice(0, 40).map(row).join('')}
      ${marked ? `<li><button class="os-dall" data-os="marked">${I.bolt}<span>All AI feedback</span>${I.chevR}</button></li>` : ''}</ul></details>`;
}

/* ---------------------------------------------------------------- Study partners: two names, who sits first, alternate */
function pairHtml() {
  const s = sess(), p = ctx.mem.people;
  const name = i => `<label class="os-pairname"><span class="os-who os-who--${i}" aria-hidden="true">${esc(initialOf(i))}</span>
    <input data-person="${i}" value="${esc(p[i])}" placeholder="Partner ${i ? 'B' : 'A'}" maxlength="${NAME_MAX}" autocomplete="off" enterkeyhint="done" aria-label="Partner ${i ? 'B' : 'A'} name"></label>`;
  return `<section class="os-card os-pair os-in" aria-labelledby="os-pair-h">
    <div class="os-run-head"><span class="os-bigic">${I.users}</span>
      <span class="os-bigtx"><strong id="os-pair-h">Study partners</strong><span>One of you is the candidate, the other examines. Every attempt is saved under the candidate's name.</span></span></div>
    <div class="os-pairrow">${name(0)}${name(1)}</div>
    <div class="os-pairfoot"><span class="os-pairlab">First candidate</span>
      <div class="os-seg" role="radiogroup" aria-label="First candidate">${[0, 1].map(i => `<button role="radio" data-os="cand" data-i="${i}" aria-checked="${s.cand === i}">${esc(nameOf(i))}</button>`).join('')}</div>
      <button class="os-chip${ctx.mem.alt ? ' on' : ''}" data-os="alt" aria-pressed="${ctx.mem.alt}">${I.shuffle}Swap each station</button></div>
  </section>`;
}
/* typing a name: saved as it is typed, the initials and the first-candidate buttons follow (the inputs keep focus) */
export function onPerson(t) {
  const i = +t.dataset.person === 1 ? 1 : 0, p = [...ctx.mem.people];
  p[i] = t.value;
  ctx.mem.people = oscePeople(p);
  save();
  const box = t.closest('.os-pair'); if (!box) return;
  box.querySelectorAll('.os-pairname .os-who').forEach((b, k) => { b.textContent = initialOf(k); });
  box.querySelectorAll('[data-os="cand"]').forEach(b => { b.textContent = nameOf(+b.dataset.i); });
}
export function pickCand(i) {
  sess().cand = i === 1 ? 1 : 0; save();
  ctx.ov.querySelectorAll('[data-os="cand"]').forEach(b => b.setAttribute('aria-checked', String(+b.dataset.i === sess().cand)));
}
export function toggleAlt(b) { ctx.mem.alt = !ctx.mem.alt; save(); b.classList.toggle('on', ctx.mem.alt); b.setAttribute('aria-pressed', String(ctx.mem.alt)); }

/* ---------------------------------------------------------------- Fast Run (rotations → shuffled queue → straight in) */
export const run = () => (ctx.mem.run ||= { specs: [], origin: [], type: [], open: [] });
export const specsIn = rot => (ROTATIONS.find(r => r[0] === rot)?.[3] || []).filter(x => ctx.stations.some(s => (s.specialty || []).includes(x)));
export const rotState = rot => { const all = specsIn(rot), on = all.filter(x => run().specs.includes(x)).length; return !on ? 'off' : on === all.length ? 'on' : 'part'; };
/* the pool with every rotation's specialties picked: what a rotation button's count shows */
export const rotCount = rot => osceRunPool(ctx.stations, { ...run(), specs: specsIn(rot) }).length;
export function runHtml() {
  return `<section class="os-card os-run os-in" style="--d:1" aria-labelledby="os-run-h">
    <div class="os-run-head"><span class="os-bigic">${I.bolt}</span>
      <span class="os-bigtx"><strong id="os-run-h">Fast Run</strong>
        <span>Pick rotations. Every station in them runs back to back, in random order.</span></span></div>
    <div class="os-rots"></div>
    <div class="os-run-f">
      <button class="os-chip" data-os="runpop" data-k="specs" aria-haspopup="listbox"></button>
      <button class="os-chip" data-os="runpop" data-k="origin" aria-haspopup="listbox"></button>
      <button class="os-chip" data-os="runpop" data-k="type" aria-haspopup="listbox"></button>
      <button class="os-link os-run-clear" data-os="runclear">Clear</button>
    </div>
    <button class="os-btn os-btn--lg os-primary os-rungo" data-os="rungo">${I.shuffle}<span></span></button>
  </section>`;
}
/* everything on the panel that depends on the selection, updated in place */
export function runPaint() {
  const box = ctx.ov.querySelector('.os-run');
  if (!box) return;
  const { stations } = ctx, r = run(), n = osceRunPool(stations, r).length, nSpec = new Set(stations.flatMap(s => s.specialty || [])).size;
  /* the kit's discipline row, as on every Learn list page; here All picks every rotation (none picked runs nothing) */
  const ids = ROTATIONS.map(d => d[0]).filter(id => specsIn(id).length), every = ids.every(id => rotState(id) === 'on');
  box.querySelector('.os-rots').innerHTML = discRowHtml('run', ids.map(id => [id, rotCount(id)]), rotState,
    { on: every, n: osceRunPool(stations, { ...r, specs: ids.flatMap(specsIn) }).length });
  const lab = { specs: r.specs.length ? `${r.specs.length} of ${nSpec} specialties` : 'Specialties',
    origin: r.origin.length === 1 ? sourceLabel(r.origin[0]) : r.origin.length ? `${r.origin.length} sources` : 'All sources',
    type: r.type.length ? (r.type.length === 1 ? r.type[0] : `${r.type[0]} +${r.type.length - 1}`) : 'All station types' };
  const oneSource = new Set(stations.map(osceOrigin)).size < 2;   /* a one-option filter is a dead control */
  box.querySelectorAll('[data-os="runpop"]').forEach(b => {
    b.innerHTML = `${esc(lab[b.dataset.k])}${I.chevD}`;
    b.classList.toggle('on', !!r[b.dataset.k].length);
    if (b.dataset.k === 'origin') b.hidden = oneSource;
  });
  box.querySelector('.os-run-clear').hidden = !(r.specs.length || r.origin.length || r.type.length);
  const go = box.querySelector('.os-rungo');
  go.disabled = !n;
  go.querySelector('span').textContent = !r.specs.length ? 'Pick a rotation to start' : n ? `Start Fast Run · ${n} station${n === 1 ? '' : 's'}` : 'No stations match';
}
export function toggleRot(rot) {
  const r = run(), all = specsIn(rot), on = rotState(rot) === 'on';
  r.specs = on ? r.specs.filter(x => !all.includes(x)) : [...new Set([...r.specs, ...all])];
  save(); runPaint();
}
/* All: every rotation on, or off again when they all are */
export function runAll() {
  const r = run(), ids = ROTATIONS.map(d => d[0]).filter(id => specsIn(id).length);
  r.specs = ids.every(id => rotState(id) === 'on') ? [] : [...new Set(ids.flatMap(specsIn))];
  save(); runPaint();
}
export function runClear() { Object.assign(run(), { specs: [], origin: [], type: [] }); save(); runPaint(); }
export function runPop(b) {
  const k = b.dataset.k, r = run(), { stations } = ctx;
  const row = (v, label, sel, extra = '', cls = '') => `<button class="os-opt${cls}" role="option" data-v="${esc(v)}" aria-selected="${sel}">
    <span class="os-optck">${I.check}</span><span class="os-optl">${label}</span>${extra}</button>`;
  const count = x => `<small class="os-optn">${x}</small>`;
  const draw = () => {
    if (k === 'specs') return ROTATIONS.filter(([id]) => specsIn(id).length).map(([id, l, e]) => {
      const st = rotState(id), open = r.open.includes(id);
      return `<div class="os-optgrp"><div class="os-optrow">${row(`r:${id}`, `<i aria-hidden="true">${e}</i> ${esc(l)}`, st === 'on' ? 'true' : st === 'part' ? 'mixed' : 'false',
        count(rotCount(id)), ' os-opthead')}<button class="os-optx${open ? ' open' : ''}" data-v="x:${id}" aria-label="${open ? 'Hide' : 'Show'} ${esc(l)} specialties" aria-expanded="${open}">${I.chevD}</button></div>
        ${open ? specsIn(id).map(x => row(`s:${x}`, esc(x), r.specs.includes(x), count(stations.filter(s => (s.specialty || []).includes(x)).length), ' os-optsub')).join('') : ''}</div>`;
    }).join('');
    if (k === 'origin') return ORIGINS.map(([v, l]) => row(v, esc(l), r.origin.includes(v), count(stations.filter(s => osceOrigin(s) === v).length))).join('')
      + '<p class="os-pophint">None ticked runs both.</p>';
    return [...new Set(stations.flatMap(s => s.type || []))].sort().map(t => row(t, esc(t), r.type.includes(t))).join('') + '<p class="os-pophint">None ticked runs every type.</p>';
  };
  openPop(b, `<div role="listbox" aria-multiselectable="true" class="os-runlist">${draw()}</div>`, (v, o) => {
    if (v.startsWith('x:')) { const id = v.slice(2); r.open = r.open.includes(id) ? r.open.filter(x => x !== id) : [...r.open, id]; }
    else if (v.startsWith('r:')) toggleRot(v.slice(2));
    else if (v.startsWith('s:')) { const x = v.slice(2); r.specs = r.specs.includes(x) ? r.specs.filter(y => y !== x) : [...r.specs, x]; }
    else { const key = k === 'origin' ? 'origin' : 'type'; r[key] = r[key].includes(v) ? r[key].filter(y => y !== v) : [...r[key], v]; }
    save(); runPaint();
    const el = o.closest('.os-pop'), sc = el.scrollTop; el.firstElementChild.innerHTML = draw(); el.scrollTop = sc;
  });
}
export async function runGo() {
  const ids = osceShuffle(osceRunPool(ctx.stations, run()).map(s => s.id));
  if (!ids.length) return;
  const s = sess(), { mem } = ctx;
  if (s.idx != null && !await confirmDlg({ title: 'End the current session?', message: 'The station in progress will be lost.', confirm: 'Start Fast Run' })) return;
  const cur = curAttempt(); if (cur && !cur.fin) mem.hist[cur.sid] = mem.hist[cur.sid].filter(x => x !== cur);
  mem.sess = { queue: ids, idx: null, aid: null, timer: null, done: [], fast: true, cand: s.cand };
  save();
  startAttempt(0);
}
