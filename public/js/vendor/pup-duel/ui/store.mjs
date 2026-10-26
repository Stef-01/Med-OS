/* store.mjs: the duel's item shop and the locker's loadouts, Optimus's live shop (public/js/study-kit/shop.mjs) on the
   duel's own design system (duel.css tokens, icons.mjs, one primary action a screen, 320 px first).

     the stage   your dog trying on the selected tile (a tap on a tile never buys); its rarity, slot and name; the
                 one button, which buys, equips or takes off
     the shop    the featured bundle (the parts you lack, 25 % off) and two featured pieces, six daily pieces with one
                 on a deal, the countdown to midnight when the rotation turns, then every piece by slot
   Tiles are coloured by rarity, NEW for two weeks after a piece arrives, a tick once owned. Words are few: a tile is
   its drawing and its price; the stage says the name.

   The rotation, prices, deals and bundles are wardrobe.mjs (pure); whether a purchase goes through is the server's
   (pup_buy / pup_buy_set): the screen sends the price it showed, and a refusal is said on the stage. */

import { SLOTS, SLOT_NAME, RARITY, SETS, VB, DEAL_OFF, itemOf, shopFor, priceToday, setPrice, isNew, msToReset, resetLabel } from '../pup/wardrobe.mjs';
import { SOLD, LOADOUTS, localDay } from '../duel/wallet.mjs';
import { icon } from './icons.mjs';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ONE = { head: 'Hat', face: 'Glasses', neck: 'Neckwear', back: 'Back bling' };
const SLOT_ICON = { head: 'hat', face: 'glasses', neck: 'bow', back: 'pack' };
const RANK = { legendary: 5, epic: 4, rare: 3, uncommon: 2, common: 1 };
const byRarity = (a, b) => RANK[b.rarity] - RANK[a.rarity] || a.price - b.price || a.name.localeCompare(b.name);
export const art = it => `<svg viewBox="${it.tile || it.vb || VB[it.slot]}" aria-hidden="true">${it.icon || it.svg}</svg>`;
export const bones = n => `<span class="pd-bone">${icon('bone')}<b>${n}</b></span>`;
const tick = '<span class="pd-stick" aria-hidden="true"><svg viewBox="0 0 16 16"><path d="M3.5 8.5l3 3 6-7"/></svg></span>';
const withSel = (look, sel) => {
  const w = { ...(look.wear || {}) };
  if (sel?.kind === 'item') w[itemOf(sel.id).slot] = sel.id;
  if (sel?.kind === 'set') for (const id of SETS.find(s => s.id === sel.id).items) w[itemOf(id).slot] = id;
  return { ...look, wear: w };
};

/* ctx: { sheet, dogFrame, wallet(), look(), buy(id, price, day), buySet(id, price), wear(look), back() | null }
   wallet() is { ok: true, bones, owned: Set } once the server answered, { ok: false } when it has no store */
export function openStore(ctx, { slot = 'all', sel = null } = {}) {
  const V = { slot, sel, day: localDay(), busy: false, err: '' };
  let timer = 0;
  ctx.sheet(`
    <header class="pd-top pd-dresstop pd-storetop">${`<button class="pd-ib" type="button" data-pd="${ctx.back ? 'sback' : 'shut'}" aria-label="Back" title="Back">${icon('back')}</button>`}<h2 class="pd-h1"><span>Store</span></h2><span class="pd-sbal" aria-live="polite"></span></header>
    <section class="pd-stage2" aria-label="Preview"><div class="pd-spv"></div><div class="pd-sinfo"></div></section>
    <div class="pd-panel pd-shop"></div>`, el => {
    const prev = ctx.dogFrame(ctx.look(), { label: 'Your dog trying it on' }), main = el.querySelector('.pd-shop'), info = el.querySelector('.pd-sinfo');
    el.querySelector('.pd-spv').append(prev.el);
    el.querySelector('[data-pd="sback"]')?.addEventListener('click', () => ctx.back());
    const W = () => ctx.wallet() || { ok: false, loading: true }, owned = () => W().owned || new Set();
    if (!V.sel) V.sel = { kind: 'item', id: shopFor(V.day).featured[0] };

    function tile(it) {
      const own = owned().has(it.id), on = ctx.look().wear?.[it.slot] === it.id, price = priceToday(it.id, V.day), deal = shopFor(V.day).deal === it.id && !own;
      const tag = on ? `<span class="pd-stag k-on">${icon('check')}</span>` : deal ? `<span class="pd-stag k-deal">−${Math.round(DEAL_OFF * 100)}%</span>` : isNew(it, V.day) && !own ? '<span class="pd-stag k-new">New</span>' : '';
      const label = `${it.name}, ${RARITY[it.rarity].name.toLowerCase()} ${ONE[it.slot].toLowerCase()}${own ? (on ? ', worn' : ', owned') : `, ${price} bones${deal ? ', on a deal' : ''}`}`;
      return `<button type="button" class="pd-stile" data-r="${it.rarity}" data-id="${it.id}"${own ? ' data-own' : ''} aria-pressed="false" aria-label="${esc(label)}" title="${esc(it.name)}">
        <span class="pd-sart">${art(it)}</span>${tag}<span class="pd-scost">${own ? tick : bones(price)}</span></button>`;
    }
    function setTile(set) {
      const { full, price, left } = setPrice(set.id, [...owned()]), items = set.items.map(itemOf), top = items.reduce((a, b) => (RANK[b.rarity] > RANK[a.rarity] ? b : a));
      return `<button type="button" class="pd-stile pd-sset" data-r="${top.rarity}" data-set="${set.id}" aria-pressed="false" title="${esc(set.name)}"
        aria-label="${esc(`${set.name}, a bundle of ${items.map(i => i.name).join(', ')}${left.length ? `, ${price} bones for the ${left.length} you lack` : ', owned'}`)}">
        <span class="pd-sart pd-quad">${items.map(i => `<span>${art(i)}</span>`).join('')}</span>${left.length ? '<span class="pd-stag k-deal">Bundle</span>' : ''}
        <span class="pd-scost">${left.length ? `${bones(price)}<s>${full}</s>` : tick}</span></button>`;
    }
    function paintMain() {
      const sh = shopFor(V.day), mine = SOLD.filter(i => owned().has(i.id)).length;
      main.innerHTML = `
        <div class="pd-shead"><h3 class="pd-h2">Featured</h3><span class="pd-reset" title="New pieces at midnight">${icon('clock')}<b data-reset>${resetLabel(msToReset())}</b><span class="pd-vh"> until new pieces</span></span></div>
        <div class="pd-sgrid pd-feat">${setTile(SETS.find(s => s.id === sh.set))}${sh.featured.map(id => tile(itemOf(id))).join('')}</div>
        <h3 class="pd-h2">Daily</h3>
        <div class="pd-sgrid">${sh.daily.map(id => tile(itemOf(id))).join('')}</div>
        <div class="pd-shead"><h3 class="pd-h2">Every piece</h3><span class="pd-count">${mine}/${SOLD.length}</span></div>
        <div class="pd-chips" role="group" aria-label="Slot">${['all', ...SLOTS].map(s => `<button type="button" data-slot="${s}" aria-pressed="${V.slot === s}" aria-label="${s === 'all' ? 'Every slot' : SLOT_NAME[s]}" title="${s === 'all' ? 'All' : SLOT_NAME[s]}">${s === 'all' ? 'All' : icon(SLOT_ICON[s])}</button>`).join('')}</div>
        <div class="pd-sgrid pd-sm">${SOLD.filter(i => V.slot === 'all' || i.slot === V.slot).sort(byRarity).map(tile).join('')}</div>`;
      paintSel();
    }
    function paintSel() {
      main.querySelectorAll('.pd-stile').forEach(t => t.setAttribute('aria-pressed', String(!!V.sel && (V.sel.kind === 'item' ? t.dataset.id === V.sel.id : t.dataset.set === V.sel.id))));
    }
    function paintBal() {
      const w = W(), bal = el.querySelector('.pd-sbal');
      bal.innerHTML = w.ok ? `${bones(w.bones)}<span class="pd-vh"> bones</span>` : '';
    }
    /* the stage: what is selected, and the one button that acts on it */
    function paintInfo() {
      const w = W(), look = ctx.look();
      let kicker, name, cta, fine = '';
      if (V.sel.kind === 'set') {
        const set = SETS.find(s => s.id === V.sel.id), { full, price, left } = setPrice(set.id, [...owned()]), short = Math.max(0, price - (w.bones || 0));
        kicker = `<span class="pd-rar" data-r="${itemOf(set.items[0]).rarity}">Bundle</span>${set.items.length} pieces`;
        name = set.name;
        cta = !left.length ? ['Wear the set', 'wearset', false] : short ? [`${bones(short)} more`, 'buyset', true, `${short} more bones for the ${set.name}`] : [`Buy · ${bones(price)}`, 'buyset', false, `Buy the ${set.name} for ${price} bones`];
        if (left.length) fine = `${left.length < set.items.length ? `For the ${left.length} you lack. ` : ''}Usually ${full}.`;
      } else {
        const it = itemOf(V.sel.id), own = owned().has(it.id), on = look.wear?.[it.slot] === it.id, price = priceToday(it.id, V.day), short = Math.max(0, price - (w.bones || 0));
        kicker = `<span class="pd-rar" data-r="${it.rarity}">${RARITY[it.rarity].name}</span>${ONE[it.slot]}${isNew(it, V.day) ? ' · New' : ''}`;
        name = it.name;
        cta = own ? [on ? 'Take it off' : 'Equip', on ? 'off' : 'wear', false, `${on ? 'Take off' : 'Equip'} ${it.name}`] : short ? [`${bones(short)} more`, 'buy', true, `${short} more bones for ${it.name}`] : [`Buy · ${bones(price)}`, 'buy', false, `Buy ${it.name} for ${price} bones`];
        if (!own && price < it.price) fine = `Today only. Usually ${it.price}.`;
      }
      if (!w.ok) { cta = [w.loading ? 'One moment' : 'Not open yet', '', true]; fine = w.loading ? '' : 'Not set up on this server yet.'; }
      info.innerHTML = `<p class="pd-kicker">${kicker}</p><h3 class="pd-sname"></h3>
        <button class="pd-btn pd-pri" type="button" data-pd="act" data-do="${cta[1]}"${cta[2] ? ' disabled' : ''}>${cta[0]}</button>
        <p class="pd-fine${V.err ? ' pd-err' : ''}" role="${V.err ? 'alert' : 'status'}"></p>`;
      info.querySelector('.pd-sname').textContent = name;
      info.querySelector('.pd-fine').textContent = V.err || fine;
      const b = info.querySelector('[data-pd="act"]');
      if (cta[3]) b.setAttribute('aria-label', cta[3]);
      b.addEventListener('click', act);
    }
    const paint = () => { paintBal(); paintMain(); paintInfo(); prev.dress(withSel(ctx.look(), V.sel)); };
    async function act() {
      if (V.busy) return;
      const b = info.querySelector('[data-pd="act"]'), what = b.dataset.do, look = ctx.look();
      V.busy = true; V.err = ''; b.disabled = true;
      try {
        if (what === 'buy') { await ctx.buy(V.sel.id, priceToday(V.sel.id, V.day), V.day); celebrate(); }
        else if (what === 'buyset') { await ctx.buySet(V.sel.id, setPrice(V.sel.id, [...owned()]).price); celebrate(); }
        else if (what === 'wear' || what === 'wearset') await ctx.wear(withSel(look, V.sel));
        else if (what === 'off') { const it = itemOf(V.sel.id), wear = { ...look.wear }; delete wear[it.slot]; await ctx.wear({ ...look, wear }); }
      } catch (e) { V.err = e.message || 'Something went wrong'; }
      V.busy = false;
      paint();
      info.querySelector('[data-pd="act"]')?.focus({ preventScroll: true });
    }
    function celebrate() {
      prev.expr('overjoyed'); prev.tap();
      setTimeout(() => prev.expr('proud'), 2600);
      const bal = el.querySelector('.pd-sbal'); bal.classList.remove('pd-pop'); void bal.offsetWidth; bal.classList.add('pd-pop');
    }
    main.addEventListener('click', e => {
      const c = e.target.closest('[data-slot]');
      if (c) { V.slot = c.dataset.slot; paintMain(); main.querySelector(`[data-slot="${V.slot}"]`)?.focus({ preventScroll: true }); return; }
      const t = e.target.closest('.pd-stile');
      if (!t) return;
      V.sel = t.dataset.set ? { kind: 'set', id: t.dataset.set } : { kind: 'item', id: t.dataset.id };
      V.err = '';
      paintSel(); paintInfo(); prev.dress(withSel(ctx.look(), V.sel)); prev.tap();
    });
    paint();
    if (slot !== 'all') main.querySelector('.pd-chips')?.scrollIntoView?.({ block: 'start' });
    /* the countdown, and a new shop at midnight while it is open */
    timer = setInterval(() => {
      if (!el.isConnected) { clearInterval(timer); return; }
      const r = el.querySelector('[data-reset]'); if (r) r.textContent = resetLabel(msToReset());
      if (localDay() !== V.day) { V.day = localDay(); paint(); }
    }, 30000);
    ctx.onWallet = () => { if (el.isConnected) paint(); };
  }, { full: true, label: 'Store' });
}

/* a tile in the locker that opens the store at that slot */
export function storeTile(slot, open) {
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'pd-piece pd-toshop'; b.dataset.pd = 'toshop';
  b.setAttribute('aria-label', `More ${SLOT_NAME[slot].toLowerCase()} in the store`); b.title = 'Store';
  b.innerHTML = icon('bag');
  b.addEventListener('click', () => open(slot));
  return b;
}

/* the locker's loadouts: three named presets of dog, coat, collar and pieces. Save puts the look on the dog now into
   one; Wear puts a saved one on the dog (the room's own Save then keeps it) */
export function loadoutsPanel({ wallet, face, cur, onWear, onSave }) {
  const box = document.createElement('div');
  box.className = 'pd-los';
  const saved = new Map((wallet?.loadouts || []).map(l => [l.slot, l]));
  for (let slot = 1; slot <= LOADOUTS; slot++) {
    const l = saved.get(slot), row = document.createElement('div');
    row.className = 'pd-lo'; row.dataset.slot = String(slot);
    const f = l ? face(l.look) : Object.assign(document.createElement('span'), { className: 'pd-face pd-loempty' });
    f.classList.add('pd-loface');
    const name = Object.assign(document.createElement('input'), { className: 'pd-loname', maxLength: 16, value: l?.name || `Loadout ${slot}`, autocomplete: 'off', spellcheck: false });
    name.setAttribute('aria-label', `Name of loadout ${slot}`);
    const wear = Object.assign(document.createElement('button'), { type: 'button', className: 'pd-btn pd-sm', textContent: 'Wear', disabled: !l });
    wear.dataset.lo = 'wear'; wear.setAttribute('aria-label', `Wear loadout ${slot}${l ? `, ${l.name}` : ''}`);
    const save = Object.assign(document.createElement('button'), { type: 'button', className: 'pd-ib', innerHTML: icon('savein') });
    save.dataset.lo = 'save'; save.setAttribute('aria-label', `Save this look as loadout ${slot}`); save.title = 'Save this look here';
    wear.addEventListener('click', () => onWear(l.look, l.name));
    save.addEventListener('click', () => onSave(slot, name.value, cur()));
    row.append(f, name, wear, save);
    box.append(row);
  }
  if (!wallet?.ok) { box.querySelectorAll('button, input').forEach(b => { b.disabled = true; }); box.insertAdjacentHTML('afterbegin', '<p class="pd-note">Loadouts open with the store.</p>'); }
  return box;
}
