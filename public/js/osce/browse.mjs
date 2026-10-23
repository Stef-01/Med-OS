/* osce/browse.mjs — the Study Session view (plan unit F3, 2026-10-19; from osce.mjs): OscesGroup + OscesQueue (the
   station queue, drag to reorder, reading/station timing, Start Practice), OscesBrowse + OscesBrowseCard (search,
   Source / Status / Complexity / Station Type / Saved filters, Add Random, Hide Details, the station cards
   paged 24 at a time by an IntersectionObserver), OscesBrowseDialog (the "Add Stations" sheet on a phone),
   OscesPreviewDialog and OscesTimingDialog. The search and filter state is this module's own (q, filt, shown); the
   queue is mem.sess.queue in the shared ctx. */
import { esc } from '../core.mjs';
import { wide, reduced } from '../study-kit/util.mjs';
import { dialogOf } from '../study-kit/ui.mjs';
import { discRowHtml, discCounts, discToggle } from '../study-kit/vocab.mjs';
import { osceFilter, osceRandom, osceOrigin, osceAttBy, clampMin, ROTATIONS, ORIGINS, CX, PHASES, DEFAULT_TIMING } from './core.mjs';
import { ctx, I, PAGE, save, sess, attempted, body, NOLOAD, notify, openDialog, closeDialog, topDialog, openPop, closePop, bmButton, tagHtml, srcTag, pulse, examOf, nameOf, initialOf } from './state.mjs';
import { tabsNav, tabBody, placePill, syncIndeterminate, contentTabs } from './session.mjs';

let q = '', filt = { status: null, cx: [], type: [], rot: [], origin: [], saved: false }, shown = PAGE, io = null, qT = 0;
let browseEl = null, browseScroll = null;
let pvTab = 'Instructions', pvId = null;

/* a view change drops the grid's observer (the entry calls this before every repaint) */
export function browseReset() { io?.disconnect(); io = null; }

/* ---------------------------------------------------------------- Study Session (OscesGroup.vue + OscesQueue.vue) */
export function renderGroup(main) {
  const { timing } = ctx.mem;
  main.innerHTML = `<div class="os-group">
    <aside class="os-side">
      <div class="os-side-in"><div class="os-queue-wrap"></div>
        ${wide() ? '' : `<button class="os-btn os-btn--lg os-addst" data-os="browse">${I.plusC}Add Stations</button>`}</div>
      <div class="os-side-foot">
        <div class="os-timing">${I.clock}
          ${PHASES.map(([k, l]) => `<div data-tk-show="${k}"><span>${timing[k]} min</span><small>${l}</small></div>`).join('')}
          <button class="os-link" data-os="timing">Change</button></div>
        <button class="os-btn os-btn--lg os-primary" data-os="startp"${sess().queue.length ? '' : ' disabled'}>Start Practice</button>
      </div>
    </aside>
    ${wide() ? '<section class="os-browse-pane"><div class="os-browse"></div></section>' : ''}
  </div>`;
  paintQueue();
  if (wide()) paintBrowse(main.querySelector('.os-browse'), main.querySelector('.os-browse-pane'));
}

function queueItemLabel(st) {
  if (ctx.mem.details) return `<span class="os-qt">${esc(st.title)} ${srcTag(st)}</span>`;
  return `<span class="os-qt">${tagHtml(st, 1)}</span>`;
}
export function paintQueue() {
  const { ov } = ctx, wrap = ov.querySelector('.os-queue-wrap');
  if (!wrap) return;
  const qu = sess().queue, had = new Set([...wrap.querySelectorAll('.os-qi')].map(li => li.dataset.id));
  wrap.innerHTML = `<div class="os-qhead"><h5>Station Queue</h5>${qu.length ? `<span class="os-badge">${qu.length}</span>` : ''}
      <button class="os-link os-qclear${qu.length ? '' : ' is-hidden'}" data-os="qclear">Clear</button></div>
    <ol class="os-queue" role="list">${qu.map((id, i) => {
      const st = ctx.byId.get(id);
      return `<li class="os-qi" data-id="${esc(id)}" data-i="${i}"><span class="os-qh" aria-label="Drag to reorder" role="button" tabindex="-1">${I.grip}</span>
        ${queueItemLabel(st)}
        <span class="os-qa"><button class="os-ic os-ic--sm" data-os="preview" data-id="${esc(id)}" aria-label="Preview">${I.eye}</button>
        <button class="os-ic os-ic--sm os-danger" data-os="qrm" data-id="${esc(id)}" aria-label="Remove">${I.minus}</button></span></li>`;
    }).join('') || `<li class="os-placeholder">Add stations to the queue by clicking<br><span class="os-wi">${I.plus} Add to Queue</span> or <span class="os-wi">${I.shuffle} Add Random</span></li>`}</ol>`;
  if (had.size) wrap.querySelectorAll('.os-qi').forEach(li => { if (had.has(li.dataset.id)) li.classList.add('still'); });   /* only a new row enters (auto-animate) */
  const sp = ov.querySelector('[data-os="startp"]');
  if (sp) sp.disabled = !qu.length;
  /* the Browse sheet's Done badge (OscesBrowseDialog.vue: pulse 1.7 over 400 ms when the queue grows) */
  const badge = ov.querySelector('.os-done-badge');
  if (badge) { const was = badge.hidden ? 0 : +badge.textContent || 0; badge.textContent = qu.length; badge.hidden = !qu.length; if (qu.length > was) pulse(badge, 1.7, 400); }
}
export function toggleQueue(id) {
  const qu = sess().queue, i = qu.indexOf(id);
  if (i >= 0) qu.splice(i, 1); else qu.push(id);
  save(); paintQueue(); syncCards();
  syncPreviewQueue(id);
  return i < 0;
}
export function clearQueue() { sess().queue = []; save(); paintQueue(); syncCards(); }
/* Remove on a queue row (auto-animate's leave): the row fades and shrinks while the rows below slide up into its
   place over the same 250 ms, then the queue repaints; instant under reduced motion */
export function removeQueued(b, id) {
  const li = b.closest('.os-qi');
  if (!li || reduced()) return toggleQueue(id);
  const h = li.getBoundingClientRect().height;
  li.classList.add('leaving');
  for (let n = li.nextElementSibling; n; n = n.nextElementSibling) n.style.transform = `translateY(${-h}px)`;
  setTimeout(() => toggleQueue(id), 250);
}
/* Add to Queue on a card or in the preview: the card pulses (eMedici's pulse(); a WAAPI animation, so the card's CSS
   entry animation is never replaced and restarted) */
export function queueFromButton(b, id, fromCard) {
  const added = toggleQueue(id);
  if (fromCard) pulse(b.closest('.os-scard'), added ? 1.015 : 0.985, 250);
}
export function addRandom() {
  const st = osceRandom(filtered(), sess().queue);
  if (!st) return notify('There are no more stations matching these filters.', 'danger');
  toggleQueue(st.id);
  notify(ctx.mem.details ? `Added: ${st.title}` : 'Added a random station', 'success');
}
export function toggleDetails() {
  ctx.mem.details = !ctx.mem.details; save();
  if (browseEl) { const r = browseEl, sr = browseScroll, top = sr?.scrollTop; paintBrowse(r, sr); if (sr) sr.scrollTop = top; }
  paintQueue();
}
/* a Save toggle: the Saved filter's grid follows */
export function afterBookmark() { if (filt.saved && browseEl) paintGrid(); }

/* ---------------------------------------------------------------- Browse (OscesBrowse.vue + OscesBrowseCard.vue) */
export function paintBrowse(el, scrollRoot) {
  browseEl = el; browseScroll = scrollRoot;
  const types = [...new Set(ctx.stations.flatMap(s => s.type || []))].sort();
  el.innerHTML = `<div class="os-toolbar">
      <label class="os-search">${I.search}<input class="os-q" type="search" placeholder="Search by Topic..." value="${esc(q)}" aria-label="Search stations" enterkeyhint="search"></label>
      <div class="os-tacts"><button class="os-btn" data-os="random">${I.shuffle}Add Random</button>
        <button class="os-btn" data-os="details">${ctx.mem.details ? I.eyeOff : I.eye}${ctx.mem.details ? 'Hide' : 'Show'} Details</button></div>
    </div>
    <div class="os-discrow"></div>
    <div class="os-frow"><div class="os-filters">
      ${FOPT.origin().length > 1 ? chip('origin', 'Source') : ''}${chip('status', 'Status')}${chip('cx', 'Complexity')}${chip('type', 'Station Type')}
      <button class="os-chip${filt.saved ? ' on' : ''}" data-os="saved" aria-pressed="${filt.saved}">${I.bm}Saved</button>
      <button class="os-link os-reset" data-os="reset"${anyFilter() ? '' : ' hidden'}>Reset</button></div>
      <span class="os-count"></span></div>
    <div class="os-grid"></div><div class="os-more" aria-hidden="true"></div>`;
  el.dataset.types = JSON.stringify(types);
  shown = PAGE;
  paintGrid();
}
export const FOPT = {
  status: () => [['0', 'Not Attempted'], ['1', 'Attempted'], ['p0', `Not done by ${nameOf(0)}`], ['p1', `Not done by ${nameOf(1)}`]],
  cx: () => CX.filter(c => ctx.stations.some(s => s.complexity === c)).map(c => [c, c]),
  type: () => [...new Set(ctx.stations.flatMap(s => s.type || []))].sort().map(t => [t, t]),
  rot: () => ROTATIONS.map(([id, l]) => [id, l]),
  origin: () => ORIGINS.filter(([v]) => ctx.stations.some(s => osceOrigin(s) === v)),
};
const fval = k => (k === 'status' ? (filt.status ? [filt.status] : []) : filt[k]);
function chipLabel(k, ph) {
  const v = fval(k), o = FOPT[k]();
  if (!v.length) return ph;
  const first = o.find(x => x[0] === v[0])?.[1] || v[0];
  return v.length > 1 ? `${first} +${v.length - 1}` : first;
}
const chip = (k, ph) => `<button class="os-chip${fval(k).length ? ' on' : ''}" data-os="filter" data-k="${k}" data-ph="${ph}" aria-haspopup="listbox">${esc(chipLabel(k, ph))}</button>`;
const disc = () => (Array.isArray(ctx.mem.disc) ? ctx.mem.disc : (ctx.mem.disc = []));   /* the discipline row's pick: mem.disc, a synced whole shard (k/disc) */
const anyFilter = () => !!(q || filt.status || filt.cx.length || filt.type.length || disc().length || filt.origin.length || filt.saved);
/* Status: attempted by either of you, or "Not done by" one of you (that person's attempts, status '0') */
const person = () => (filt.status === 'p0' ? 0 : filt.status === 'p1' ? 1 : null);
const attMap = () => osceAttBy(ctx.mem.hist, person());
const statusF = () => ({ ...filt, status: person() == null ? filt.status : '0' });
export const filtered = () => osceFilter(ctx.stations, q, { ...statusF(), rot: disc() }, attMap(), ctx.mem.bm);
/* the row counts what every other filter leaves, so a count is what a tap shows */
function paintDisc() {
  const box = browseEl?.querySelector('.os-discrow');
  if (!box) return;
  const rest = osceFilter(ctx.stations, q, { ...statusF(), rot: [] }, attMap(), ctx.mem.bm), sel = disc();
  box.innerHTML = discRowHtml('browse', discCounts(rest, s => s.specialty), id => (sel.includes(id) ? 'on' : 'off'), { on: !sel.length, n: rest.length });
}
export function discPick(id) { ctx.mem.disc = discToggle(disc(), id); save(); shown = PAGE; paintGrid(); }

export function paintGrid(more) {
  if (!browseEl) return;
  const list = filtered(), grid = browseEl.querySelector('.os-grid');
  browseEl.querySelector('.os-count').textContent = `${list.length} station${list.length === 1 ? '' : 's'}`;
  const from = more ? grid.children.length : 0;
  const html = list.slice(from, shown).map((s, i) => card(s, more ? i : Math.min(i, 8))).join('');
  if (more) grid.insertAdjacentHTML('beforeend', html);
  else grid.innerHTML = html || `<div class="os-empty"><p>No stations match these filters.</p>${anyFilter() ? '<button class="os-btn" data-os="reset">Reset filters</button>' : ''}${q.trim().length >= 3 ? `<button class="os-btn os-primary" data-os="reqnew" data-topic="${esc(q.trim())}">${I.plus}<span>Request this case</span></button>` : ''}</div>`;   /* nothing in the bank: ask for it, the search as the topic */
  /* filter row state */
  browseEl.querySelectorAll('[data-os="filter"]').forEach(b => { b.textContent = chipLabel(b.dataset.k, b.dataset.ph); b.classList.toggle('on', !!fval(b.dataset.k).length); });
  const sv = browseEl.querySelector('[data-os="saved"]'); sv.classList.toggle('on', filt.saved); sv.setAttribute('aria-pressed', String(filt.saved));
  browseEl.querySelector('.os-reset').hidden = !anyFilter();
  paintDisc();
  /* load the next page when the sentinel scrolls into view (ResourceList pages 12 at a time) */
  io?.disconnect();
  if (list.length > shown && 'IntersectionObserver' in window) {
    io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { shown += PAGE; paintGrid(true); } }, { root: browseScroll, rootMargin: '600px' });
    io.observe(browseEl.querySelector('.os-more'));
  }
}
function card(s, i) {
  const inQ = sess().queue.includes(s.id), att = attempted(s.id), { details } = ctx.mem;
  return `<article class="os-card os-scard os-in${inQ ? ' inq' : ''}" data-id="${esc(s.id)}" style="--d:${i}">
    <div class="os-ctop"><div class="os-tags">${tagHtml(s)}${s.complexity ? `<span class="os-tag">${esc(s.complexity)}</span>` : ''}</div>
      <div class="os-cacts">${details ? `<button class="os-ic os-ic--sm" data-os="preview" data-id="${esc(s.id)}" aria-label="Preview">${I.eye}</button>` : ''}${bmButton(s.id)}</div></div>
    <div class="os-cbody${details ? '' : ' spoiler'}"><h3>${esc(s.title)}</h3><p>${esc(s.desc)}</p></div>
    <div class="os-cfoot">${att ? `<button class="os-att" data-os="preview" data-id="${esc(s.id)}" data-tab="Attempts">${I.check}Attempted${doneBy(s.id)}</button>` : '<span class="os-natt">Not Attempted</span>'}
      <button class="os-btn os-qbtn${inQ ? ' soft' : ''}" data-os="queue" data-id="${esc(s.id)}">${inQ ? I.check : I.plus}<span>${inQ ? 'In Queue' : 'Add to Queue'}</span></button></div>
  </article>`;
}
/* the initials of whoever has done this station */
const doneBy = id => [0, 1].filter(i => osceAttBy({ [id]: ctx.mem.hist[id] }, i)[id]).map(i => `<span class="os-who os-who--${i}" title="${esc(nameOf(i))}">${esc(initialOf(i))}</span>`).join('');
export function syncCards() {
  ctx.ov.querySelectorAll('.os-scard').forEach(c => {
    const inQ = sess().queue.includes(c.dataset.id), b = c.querySelector('.os-qbtn');
    if (c.classList.contains('inq') === inQ) return;
    c.classList.toggle('inq', inQ);
    b.classList.toggle('soft', inQ);
    b.innerHTML = `${inQ ? I.check : I.plus}<span>${inQ ? 'In Queue' : 'Add to Queue'}</span>`;
  });
}
/* the search box (the input event, debounced) */
export function onSearch(t) { clearTimeout(qT); qT = setTimeout(() => { q = t.value; shown = PAGE; paintGrid(); }, 140); }
export function toggleSaved() { filt.saved = !filt.saved; shown = PAGE; paintGrid(); }
export function resetFilters() {
  q = ''; filt = { status: null, cx: [], type: [], rot: [], origin: [], saved: false }; ctx.mem.disc = []; save();
  if (browseEl) browseEl.querySelector('.os-q').value = '';
  shown = PAGE; paintGrid();
}
export function filterPop(b) {
  const k = b.dataset.k;
  const draw = () => FOPT[k]().map(([v, l]) => `<button class="os-opt" role="option" data-v="${esc(v)}" aria-selected="${fval(k).includes(v)}"><span class="os-optck">${I.check}</span>${esc(l)}</button>`).join('');
  openPop(b, `<div role="listbox" aria-multiselectable="${k !== 'status'}">${draw()}</div>`, (v, o) => {
    if (k === 'status') { filt.status = filt.status === v ? null : v; closePop(); }
    else { const s = new Set(filt[k]); s.has(v) ? s.delete(v) : s.add(v); filt[k] = [...s]; o.closest('.os-pop').firstElementChild.innerHTML = draw(); }
    shown = PAGE; paintGrid();
  });
}

/* ---------------------------------------------------------------- dialogs: timing, preview, the Add Stations sheet */
export function timingDlg() {   /* OscesTimingDialog.vue: one field per phase; Part 2 may be 0 (no Part 2) */
  const { timing } = ctx.mem;
  const d = openDialog({ kind: 'timing', title: 'Change Timing', cls: 'os-dlg--small', action: '<button class="os-btn os-primary" data-os="tsave">Save</button>',
    body: `<form class="os-tform">${PHASES.map(([k, l, long]) => `<div><label for="os-t-${k}" title="${long}">${l}</label>
      <span><input id="os-t-${k}" type="number" inputmode="numeric" min="${k === 'mx' ? 0 : 1}" max="99" step="1" value="${timing[k]}" data-tk="${k}"> min</span></div>`).join('')}
      <p class="os-tnote">Default ${DEFAULT_TIMING.reading} · ${DEFAULT_TIMING.station} · ${DEFAULT_TIMING.mx}: reading, then history and examination, then interpretation, management and safety netting. Part 2 at 0 runs without it.</p></form>` });
  const form = d.el.querySelector('form');
  form.addEventListener('submit', e => { e.preventDefault(); d.el.querySelector('[data-os="tsave"]').click(); });
}
export function saveTiming() {
  const d = topDialog(), { timing } = ctx.mem;
  d.el.querySelectorAll('[data-tk]').forEach(i => { timing[i.dataset.tk] = clampMin(i.value, timing[i.dataset.tk], i.dataset.tk === 'mx' ? 0 : 1); });
  save(); closeDialog();
  const t = ctx.ov.querySelector('.os-timing');
  if (t) { t.querySelectorAll('[data-tk-show]').forEach(x => { x.firstElementChild.textContent = `${timing[x.dataset.tkShow]} min`; }); t.classList.remove('flash'); void t.offsetWidth; t.classList.add('flash'); }
}

export async function previewDlg(id, initial) {   /* OscesPreviewDialog.vue; the body loads first (osce/<id>.json, once) */
  if (!ctx.byId.has(id)) return;
  let st;
  try { st = await body(id); } catch { return notify(NOLOAD, 'danger'); }
  if (!ctx.isOpen || dialogOf(ctx.ov, 'preview')) return;
  pvId = id;
  const tabs = [...contentTabs(st), 'Marking', 'Attempts'];
  pvTab = tabs.includes(initial) ? initial : 'Instructions';
  const inQ = sess().queue.includes(id), live = sess().idx != null;
  const d = openDialog({ kind: 'preview', title: st.title, cls: 'os-dlg--large',
    action: srcTag(st) + (live ? '' : `<button class="os-btn ${inQ ? 'soft' : 'os-primary'} os-pvq" data-os="pvqueue" data-id="${esc(id)}">${inQ ? I.check : I.plus}<span>${inQ ? 'In Queue' : 'Add to Queue'}</span></button>`),
    body: `<div class="os-pv">${tabsNav(tabs, 'os-tabs--pv').replace(/aria-selected="(true|false)"/g, '')}<div class="os-pv-scroll"><div class="os-pbody"></div></div></div>` });
  d.el.querySelectorAll('[data-os="tab"]').forEach(b => { b.dataset.os = 'pvtab'; });
  d.onClose = () => { pvId = null; };
  paintPreview();
}
export function previewTab(t) { pvTab = t; paintPreview(); }
function paintPreview() {
  const d = dialogOf(ctx.ov, 'preview');
  if (!d) return;
  const st = ctx.byId.get(pvId);
  d.el.querySelectorAll('[data-os="pvtab"]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === pvTab)));
  d.el.querySelector('.os-pbody').innerHTML = tabBody(st, null, pvTab, { editable: false });
  d.el.querySelector('.os-pv-scroll').scrollTop = 0; syncIndeterminate();
  requestAnimationFrame(() => placePill(d.el, true));
}
function syncPreviewQueue(id) {
  const b = ctx.ov.querySelector(`.os-pvq[data-id="${CSS.escape(id)}"]`);
  if (!b) return;
  const inQ = sess().queue.includes(id);
  b.className = `os-btn ${inQ ? 'soft' : 'os-primary'} os-pvq`;
  b.innerHTML = `${inQ ? I.check : I.plus}<span>${inQ ? 'In Queue' : 'Add to Queue'}</span>`;
}

export function browseDlg() {   /* OscesBrowseDialog.vue (phones) */
  const n = sess().queue.length;
  const d = openDialog({ kind: 'browse', title: 'Browse Stations', cls: 'os-dlg--full',
    action: `<button class="os-link os-done" data-os="dclose">Done<span class="os-badge os-done-badge"${n ? '' : ' hidden'}>${n}</span></button>`,
    body: '<div class="os-browse"></div>', onClose: () => { browseEl = null; browseScroll = null; io?.disconnect(); } });
  d.el.querySelector('.os-dlg-x').remove(); d.box.querySelector('button')?.focus({ preventScroll: true });
  paintBrowse(d.el.querySelector('.os-browse'), d.el.querySelector('.os-dlg-body'));
}
/* the browser pane turns into the sheet and back with the viewport */
export const browseSheetOpen = () => !!dialogOf(ctx.ov, 'browse');

/* ---------------------------------------------------------------- drag to reorder the queue by its handle (vue-slicksort, lock-axis y) */
export function onPointerDown(e) {
  const h = e.target.closest('.os-qh');
  if (!h) return;
  e.preventDefault();
  const li = h.closest('.os-qi'), list = li.parentElement, items = [...list.querySelectorAll('.os-qi')];
  if (items.length < 2) return;
  const from = items.indexOf(li), rects = items.map(x => x.getBoundingClientRect()), step = rects[1].top - rects[0].top || rects[0].height;
  const y0 = e.clientY;
  let to = from;
  li.classList.add('dragging');
  h.setPointerCapture?.(e.pointerId);
  const move = ev => {
    const dy = ev.clientY - y0;
    li.style.transform = `translateY(${dy}px)`;
    to = Math.max(0, Math.min(items.length - 1, from + Math.round(dy / step)));
    items.forEach((x, i) => {
      if (x === li) return;
      const shift = from < to && i > from && i <= to ? -step : from > to && i < from && i >= to ? step : 0;
      x.style.transform = shift ? `translateY(${shift}px)` : '';
    });
  };
  const up = () => {
    h.removeEventListener('pointermove', move); h.removeEventListener('pointerup', up); h.removeEventListener('pointercancel', up);
    const settle = () => {
      if (to !== from) { const qu = sess().queue, [x] = qu.splice(from, 1); qu.splice(to, 0, x); save(); }
      items.forEach(x => { x.style.transform = ''; x.classList.remove('settling'); });
      paintQueue();
    };
    li.classList.remove('dragging');
    if (reduced() || !li.style.transform) return settle();
    /* auto-animate after a sort: the row glides from where it was dropped into its slot (250 ms), then the list repaints */
    li.classList.add('settling');
    li.style.transform = `translateY(${(to - from) * step}px)`;
    setTimeout(settle, 250);
  };
  h.addEventListener('pointermove', move); h.addEventListener('pointerup', up); h.addEventListener('pointercancel', up);
}
