/* shop.mjs (ui): the wardrobe, a full-screen sheet over the duel with two tabs (founder 2026-10-25: "make the shop
   and customisation far richer and beautiful"; what was borrowed and from where: docs/shop-research.md).

     the stage   the dog in your look with whatever is selected tried on (nothing is bought by a tap on a tile), the
                 piece's rarity, name and nod, and one button that names its action: Buy, Wear, Take off, Buy set,
                 or how many bones (and about how many wins) you are short
     Shop        today's rotation (a bundle priced for the pieces you lack, two featured pieces, six daily ones with
                 one on a deal, the time to the next rotation), the nine sets with how many of each you own, every
                 piece by slot, and how bones are earned with the last few lines of the ledger
     Locker      three saved outfits, each with a name of your own, then the dog, its coat, its collar and the four slots; a piece you do not own
                 is shown with its price and can be tried on and bought from the stage
   A look being changed is the dog's until Save; buying wears the piece and saves at once. A purchase is the one
   authored moment: the dog cheers, sparks in the piece's rarity colour, the balance counts down. Reduced motion
   keeps the cheer and drops the rest.

   The pure rules are elsewhere: prices and rotation in pup/wardrobe.mjs, the wallet in duel/shop.mjs. */

import { ITEMS as ALL, SETS, SLOTS, SLOT_NAME, RARITY, VB, itemOf, sigOf, shopFor, priceToday, setPrice, isNew, msToReset, resetLabel, DEAL_OFF, SET_OFF } from '../pup/wardrobe.mjs';
import { coatsFor, COLLARS } from '../pup/rig/coats.mjs';
import { lookDog } from '../pup/rig/still.mjs';
import { EYE_SHAPES, IRISES, BLUSH, STYLES } from '../pup/rig/eyes.mjs';
import { MOVES } from '../pup/rig/moves.mjs';
import { DOGS } from '../duel/accounts.mjs';
import { shown } from '../pup/rig/gifts.mjs';
import { PAY, PER_RIGHT, PRACTICE_CAP, OUTFITS, NAME_MAX, WHY, stateOf, winsAway, collection, fitWear, outfitName } from '../duel/shop.mjs';
import { icon } from './icons.mjs';

/* the duel sells what a player can earn: the monthly laurel is Optimus's to give */
export const ITEMS = ALL.filter(i => !i.exclusive);
const RANK = { legendary: 5, epic: 4, rare: 3, uncommon: 2, common: 1 };
const byRarity = (a, b) => RANK[b.rarity] - RANK[a.rarity] || a.price - b.price || a.name.localeCompare(b.name);
const ONE = { head: 'Hat', face: 'Glasses', neck: 'Neckwear', back: 'Back bling' };
const TABS = [['dog', 'paw', 'Dog'], ['coat', 'palette', 'Coat'], ['collar', 'collar', 'Collar'], ['eyes', 'sparkle', 'Eyes'], ['head', 'hat', SLOT_NAME.head], ['face', 'glasses', SLOT_NAME.face], ['neck', 'bow', SLOT_NAME.neck], ['back', 'pack', SLOT_NAME.back]];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const art = it => `<svg viewBox="${it.tile || it.vb || VB[it.slot]}" aria-hidden="true" focusable="false">${it.icon || it.svg}</svg>`;
const bones = n => `<span class="pd-bn">${icon('bone')}<b>${n}</b></span>`;
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const dayKey = (t = Date.now()) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

/* ctx: { sheet, dogFrame, face, ib, lookOf, look, wallet, buy(ids, total), saveLook(look), saveOutfits(list), say } */
export function openWardrobe(ctx) {
  const V = { tab: ctx.tab === 'locker' ? 'locker' : 'shop', sel: null, slot: 'all', ltab: 'head', day: dayKey() };
  let W = ctx.wallet, saved = ctx.lookOf(ctx.look), cur = structuredClone(saved), el, prev, tick = 0;
  function owns(id) { return W.owned.includes(id); }
  function sh() { return shopFor(V.day); }
  function priceOf(sel) { return sel.kind === 'set' ? setPrice(sel.id, W.owned).price : priceToday(sel.id, V.day); }

  ctx.sheet(`
    <header class="pd-top pd-wtop">${ctx.ib('shut', 'back', 'Close the wardrobe')}
      <div class="pd-wtabs" role="tablist" aria-label="Shop or locker"><button type="button" role="tab" data-wt="shop" id="pd-wt-shop" aria-controls="pd-wpanel">${icon('bag')}<span>Shop</span></button><button type="button" role="tab" data-wt="locker" id="pd-wt-locker" aria-controls="pd-wpanel">${icon('shirt')}<span>Locker</span></button></div>
      <span class="pd-bal" aria-live="polite">${icon('bone')}<b></b><span class="pd-vh"> bones</span></span></header>
    <div class="pd-wbody">
      <section class="pd-wstage" aria-label="Try on">
        <div class="pd-wpv"><div class="pd-burst" aria-hidden="true"></div><button type="button" class="pd-wreset" data-w="reset" aria-label="Reset this dog: take off every accessory"></button></div>
        <div class="pd-winfo" tabindex="-1"></div>
      </section>
      <div class="pd-wpanel" id="pd-wpanel" role="tabpanel" tabindex="-1"></div>
    </div>
    <div class="pd-wbar" hidden><button class="pd-link" type="button" data-w="undo">Undo</button><button class="pd-btn pd-pri" type="button" data-w="save">${icon('check')}Save look</button></div>`, root => {
    el = root;
    prev = ctx.dogFrame(cur, { label: 'Your dog trying it on' });
    el.querySelector('.pd-wpv').prepend(prev.el);
    el.addEventListener('click', onClick);
    el.querySelector('.pd-wtabs').addEventListener('keydown', e => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault(); setTab(V.tab === 'shop' ? 'locker' : 'shop'); el.querySelector(`[data-wt="${V.tab}"]`).focus();
    });
    paint();
    if (ctx.offline) note('The shop is offline. Your locker still works.');
    /* a look not saved: closing asks first (the bar turns into the question) */
    ctx.guard?.(() => {
      if (same(ctx.lookOf(cur), saved)) return true;
      const bar = el.querySelector('.pd-wbar');
      bar.hidden = false; bar.dataset.ask = '';
      bar.innerHTML = `<span class="pd-wask">Save this look?</span><button class="pd-link" type="button" data-w="discard">Discard</button><button class="pd-btn pd-pri" type="button" data-w="saveclose">${icon('check')}Save</button>`;
      bar.querySelector('[data-w="saveclose"]').focus({ preventScroll: true });
      ctx.say('Save this look before closing?');
      return false;
    });
    /* the radio groups (dogs, coats, collars): one tab stop, the arrows move and choose */
    el.addEventListener('keydown', e => {
      const g = e.target.closest?.('[role="radiogroup"]'); if (!g) return;
      const all = [...g.querySelectorAll('[role="radio"]')], i = all.indexOf(e.target); if (i < 0) return;
      const n = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key], to = e.key === 'Home' ? 0 : e.key === 'End' ? all.length - 1 : n ? (i + n + all.length) % all.length : -1;
      if (to < 0) return;
      e.preventDefault(); all[to].click(); (g.querySelector(`[role="radio"][aria-checked="true"]`) || all[to]).focus();
    });
    tick = setInterval(() => {
      if (!el.isConnected) { clearInterval(tick); return; }
      const r = el.querySelector('[data-w="reset"]'); if (r) r.textContent = resetLabel(msToReset());
      if (dayKey() !== V.day) { V.day = dayKey(); paint(); }
    }, 30000);
  }, { full: true, label: 'Wardrobe', cls: 'pd-ward' });

  /* ---- events ---- */
  function onClick(e) {
    const t = e.target.closest('[data-wt],[data-w],[data-item],[data-set],[data-slot],[data-ltab],[data-outfit],[data-dog],[data-v]');
    if (!t || !el.contains(t)) return;
    if (t.dataset.wt) return setTab(t.dataset.wt);
    const w = t.dataset.w;
    if (w === 'act') return act();
    if (w === 'reset') return askReset();
    if (w === 'resetyes') return resetDog();
    if (w === 'resetno') { paintBar(); return; }
    if (w === 'save') return save();
    if (w === 'undo') { cur = structuredClone(saved); V.sel = null; paint(); prev.dress(cur); return; }
    if (w === 'keep') return keepOutfit(+t.dataset.i, t);
    if (w === 'move') { playMove(); return; }
    if (w === 'earn') { el.querySelector('#pd-h-earn')?.scrollIntoView({ block: 'start', behavior: reduced() ? 'auto' : 'smooth' }); return; }
    if (w === 'discard') { cur = structuredClone(saved); ctx.close(); return; }
    if (w === 'saveclose') { save(true).then(ok => ok && ctx.close()); return; }
    if (t.dataset.slot) { V.slot = t.dataset.slot; paintPanel(); el.querySelector(`[data-slot="${V.slot}"]`)?.focus({ preventScroll: true }); return; }
    if (t.dataset.ltab) { V.ltab = t.dataset.ltab; V.sel = null; paintPanel(); paintInfo(); tryOn(); el.querySelector(`[data-ltab="${V.ltab}"]`)?.focus({ preventScroll: true }); return; }
    if (t.dataset.outfit) return wearOutfit(+t.dataset.outfit);
    if (t.dataset.dog) { pickDog(t.dataset.dog); return; }
    if (t.dataset.v !== undefined && t.closest('[data-kind]')) { pickSwatch(t.closest('[data-kind]').dataset.kind, t.dataset.v); return; }
    if (t.dataset.item) select({ kind: 'item', id: t.dataset.item });
    if (t.dataset.set) select({ kind: 'set', id: t.dataset.set });
  }
  function setTab(tab) {
    V.tab = tab; V.sel = null;
    paintTabs(); paintPanel(); paintInfo(); tryOn();
    el.querySelector('.pd-wpanel').scrollTop = 0;
  }
  /* a tap tries it on: in the Locker, an owned piece is worn at once (the bar offers Save) */
  function select(sel) {
    V.sel = sel;
    if (V.tab === 'locker' && sel.kind === 'item' && owns(sel.id)) {
      const it = itemOf(sel.id);
      if (cur.wear[it.slot] === it.id) delete cur.wear[it.slot]; else cur.wear[it.slot] = it.id;
    }
    paintSel(); paintInfo(); tryOn(true); paintBar();
    ctx.say(sayOf(sel));
    if (!matchMedia('(min-width: 900px)').matches) el.querySelector('.pd-wpanel').scrollIntoView?.({ block: 'nearest' });
  }

  /* ---- painting ---- */
  function paint() { paintTabs(); paintBal(); paintPanel(); paintInfo(); paintBar(); }
  function paintTabs() { el.querySelectorAll('[data-wt]').forEach(b => { const on = b.dataset.wt === V.tab; b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; }); el.querySelector('.pd-wpanel').setAttribute('aria-labelledby', `pd-wt-${V.tab}`); }
  function paintBal(from) {
    const b = el.querySelector('.pd-bal b');
    if (from == null || reduced() || from === W.bones) { b.textContent = W.bones; return; }
    const t0 = performance.now(), dur = 700, f = now => { const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3); b.textContent = Math.round(from + (W.bones - from) * e); if (k < 1) requestAnimationFrame(f); };
    requestAnimationFrame(f);
    const bal = el.querySelector('.pd-bal'); bal.classList.remove('pd-pop'); void bal.offsetWidth; bal.classList.add('pd-pop');
  }
  function paintBar() {
    const dirty = !same(ctx.lookOf(cur), saved), bar = el.querySelector('.pd-wbar');
    if ('ask' in bar.dataset) { delete bar.dataset.ask; bar.innerHTML = `<button class="pd-link" type="button" data-w="undo">Undo</button><button class="pd-btn pd-pri" type="button" data-w="save">${icon('check')}Save look</button>`; }
    bar.hidden = !dirty;
    const shut = el.querySelector('[data-pd="shut"]'); shut.setAttribute('aria-label', dirty ? 'Close without saving' : 'Close the wardrobe'); shut.title = shut.getAttribute('aria-label');
  }
  function paintPanel() {
    const p = el.querySelector('.pd-wpanel');
    p.innerHTML = V.tab === 'shop' ? shopHtml() : lockerHtml();
    if (V.tab === 'locker') fillLocker(p);
    paintSel();
  }
  function shopHtml() {
    const s = sh(), set = SETS.find(x => x.id === s.set);
    const list = ITEMS.filter(i => V.slot === 'all' || i.slot === V.slot).sort(byRarity);
    const col = collection(ITEMS, W.owned);
    return `
      <section class="pd-wsec" aria-labelledby="pd-h-today">
        <div class="pd-whead"><h2 class="pd-h2" id="pd-h-today">Today</h2><span class="pd-wnote">${icon('clock')}New in <b data-w="reset">${resetLabel(msToReset())}</b></span></div>
        <div class="pd-wgrid pd-wfeat">${setTile(set, true)}${s.featured.map(id => tile(itemOf(id))).join('')}</div>
        <div class="pd-wgrid pd-wdaily">${s.daily.map(id => tile(itemOf(id))).join('')}</div>
      </section>
      <section class="pd-wsec" aria-labelledby="pd-h-sets">
        <div class="pd-whead"><h2 class="pd-h2" id="pd-h-sets">Sets</h2><span class="pd-wnote">${Math.round(SET_OFF * 100)}% off the pieces you lack</span></div>
        <div class="pd-wrail">${SETS.map(x => setTile(x, false)).join('')}</div>
      </section>
      <section class="pd-wsec" aria-labelledby="pd-h-all">
        <div class="pd-whead"><h2 class="pd-h2" id="pd-h-all">Every piece</h2><span class="pd-wnote">${col.owned} of ${col.total} owned</span></div>
        <div class="pd-chips" role="group" aria-label="Show">${['all', ...SLOTS].map(x => `<button type="button" data-slot="${x}" aria-pressed="${V.slot === x}">${x === 'all' ? 'All' : SLOT_NAME[x]}</button>`).join('')}</div>
        <div class="pd-wgrid pd-wall">${list.map(i => tile(i)).join('')}</div>
      </section>
      <section class="pd-wsec pd-earn" aria-labelledby="pd-h-earn">
        <h2 class="pd-h2" id="pd-h-earn">Earn bones</h2>
        <dl class="pd-pay">
          <div><dt>${icon('trophy')}Win a duel</dt><dd>${PAY.win}</dd></div>
          <div><dt>${icon('zap')}Draw</dt><dd>${PAY.draw}</dd></div>
          <div><dt>${icon('check')}Finish a duel</dt><dd>${PAY.loss}</dd></div>
          <div><dt>${icon('star')}Each right answer</dt><dd>+${PER_RIGHT}</dd></div>
          <div><dt>${icon('bot')}Practice with Rex</dt><dd>${practiceLeft()} left today</dd></div>
        </dl>
        ${W.ledger.length ? `<h3 class="pd-h3">Recent</h3><ul class="pd-ledger">${W.ledger.slice(0, 6).map(l => `<li><span>${esc(WHY[l.why] || l.why)}</span><b data-sign="${l.d < 0 ? '-' : '+'}">${l.d < 0 ? '−' : '+'}${Math.abs(l.d)}</b></li>`).join('')}</ul>` : ''}
      </section>`;
  }
  /* the server counts practice bones by the UTC day (0002_pup_shop.sql pup_practice), so this does too */
  function practiceLeft() { return PRACTICE_CAP - (W.practice?.day === new Date().toISOString().slice(0, 10) ? W.practice.got : 0); }
  function tile(it) {
    const price = priceToday(it.id, V.day), st = stateOf(it, W, cur.wear, price), deal = sh().deal === it.id && !owns(it.id);
    const tag = st === 'equipped' ? `<span class="pd-tag pd-t-on">On</span>` : deal ? `<span class="pd-tag pd-t-deal">−${Math.round(DEAL_OFF * 100)}%</span>` : isNew(it, V.day) && !owns(it.id) ? '<span class="pd-tag pd-t-new">New</span>' : '';
    const cost = owns(it.id) ? `<span class="pd-own">${icon('check')}Owned</span>` : `${bones(price)}${deal ? `<s>${it.price}</s>` : ''}`;
    const said = owns(it.id) ? (st === 'equipped' ? 'wearing it' : 'owned') : `${price} bones${deal ? `, ${Math.round(DEAL_OFF * 100)} percent off today` : ''}`;
    return `<button type="button" class="pd-st" data-r="${it.rarity}" data-item="${it.id}" data-st="${st}" aria-pressed="false" aria-label="${esc(it.name)}, ${RARITY[it.rarity].name.toLowerCase()} ${ONE[it.slot].toLowerCase()}${it.sig ? `, with the ${esc(MOVES[it.sig.move].name)} move` : ''}, ${said}">
      <span class="pd-st-art">${art(it)}</span>${tag}${it.sig ? `<span class="pd-sigb" title="Signature move: ${esc(MOVES[it.sig.move].name)}">${icon('sparkle')}</span>` : ''}<span class="pd-st-plate"><b>${esc(it.name)}</b><span class="pd-st-cost">${cost}</span></span></button>`;
  }
  function setTile(set, wide) {
    const { full, price, left } = setPrice(set.id, W.owned), items = set.items.map(itemOf), have = items.length - left.length;
    const top = items.reduce((a, b) => (RANK[b.rarity] > RANK[a.rarity] ? b : a));
    return `<button type="button" class="pd-st pd-set${wide ? ' pd-set-wide' : ''}" data-r="${top.rarity}" data-set="${set.id}" aria-pressed="false" aria-label="${esc(set.name)}: ${items.map(i => esc(i.name)).join(', ')}. You own ${have} of ${items.length}${left.length ? `. ${price} bones for the rest` : ''}">
      <span class="pd-st-art pd-quad">${items.map(i => `<span${owns(i.id) ? ' data-own' : ''}>${art(i)}</span>`).join('')}</span>${wide && left.length ? '<span class="pd-tag pd-t-deal">Bundle</span>' : ''}
      <span class="pd-st-plate"><b>${esc(set.name)}</b><span class="pd-st-cost">${left.length ? `${bones(price)}<s>${full}</s>` : `<span class="pd-own">${icon('check')}Complete</span>`}</span><span class="pd-pips" aria-hidden="true">${items.map(i => `<i${owns(i.id) ? ' data-on' : ''}></i>`).join('')}</span></span></button>`;
  }
  function lockerHtml() {
    const col = collection(ITEMS, W.owned);
    return `
      <section class="pd-wsec" aria-labelledby="pd-h-fits">
        <div class="pd-whead"><h2 class="pd-h2" id="pd-h-fits">Outfits</h2><span class="pd-wnote">Tap to wear</span></div>
        <div class="pd-fits"></div>
      </section>
      <section class="pd-wsec" aria-label="Dress up">
        <div class="pd-tabs" role="group" aria-label="Dress up">${TABS.map(([id, ic, name]) => `<button type="button" data-ltab="${id}" aria-pressed="${V.ltab === id}" aria-label="${esc(name)}" title="${esc(name)}">${icon(ic)}</button>`).join('')}</div>
        <div class="pd-lpanel"></div>
      </section>
      <section class="pd-wsec" aria-labelledby="pd-h-col">
        <div class="pd-whead"><h2 class="pd-h2" id="pd-h-col">Collection</h2><span class="pd-wnote">${col.owned} of ${col.total}</span></div>
        <ul class="pd-col">${Object.keys(RANK).reverse().map(r => `<li data-r="${r}"><span>${RARITY[r].name}</span><b>${col.byRarity[r]?.[0] || 0}<small>/${col.byRarity[r]?.[1] || 0}</small></b></li>`).join('')}</ul>
      </section>`;
  }
  function fillLocker(p) {
    /* the outfits: a face for each kept look and its name (yours to change: type, then Enter or tap away), an empty
       one keeps the look on the dog */
    const fits = p.querySelector('.pd-fits');
    for (let i = 0; i < OUTFITS; i++) {
      const o = W.outfits[i], card = document.createElement('div');
      card.className = 'pd-fit';
      if (o) {
        const look = ctx.lookOf(fitWear(o, W.owned)), on = same(look, ctx.lookOf(cur)), name = outfitName(o, i);
        card.innerHTML = `<button type="button" class="pd-fit-wear" data-outfit="${i}" aria-pressed="${on}" aria-label="Wear ${esc(name)}"></button><button type="button" class="pd-fit-keep" data-w="keep" data-i="${i}" aria-label="Keep this look as ${esc(name)}" title="Keep this look here">${icon('repeat')}</button>`;
        card.firstChild.append(ctx.face(look));
        const nm = Object.assign(document.createElement('input'), { type: 'text', className: 'pd-fit-name', value: name, maxLength: NAME_MAX, autocomplete: 'off', spellcheck: false, enterKeyHint: 'done' });
        nm.dataset.i = String(i); nm.setAttribute('aria-label', `Name of outfit ${i + 1}`);
        nm.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); nm.blur(); } });
        nm.addEventListener('change', () => renameOutfit(i, nm));
        card.append(nm);
      } else card.innerHTML = `<button type="button" class="pd-fit-wear pd-fit-new" data-w="keep" data-i="${i}" aria-label="Keep this look as outfit ${i + 1}">${icon('plus')}<span>Keep look</span></button>`;
      fits.append(card);
    }
    const lp = p.querySelector('.pd-lpanel');
    lp.setAttribute('role', 'group'); lp.setAttribute('aria-label', TABS.find(t => t[0] === V.ltab)[2]);
    if (V.ltab === 'dog') {
      const g = document.createElement('div'); g.className = 'pd-dogs'; g.setAttribute('role', 'radiogroup'); g.setAttribute('aria-label', 'Dog');
      g.append(...DOGS.filter(d => shown(d) || d.id === cur.dog).map(d => {   /* a gift's dogs once it is redeemed (gifts.mjs) */
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'pd-dogpick'; b.dataset.dog = d.id; b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', String(d.id === cur.dog)); b.tabIndex = d.id === cur.dog ? 0 : -1;
        b.setAttribute('aria-label', `${d.name}, ${d.breedName}`); b.title = d.hint;
        b.append(ctx.face({ dog: d.id, collar: cur.collar }));
        return b;
      }));
      lp.append(g);
    } else if (V.ltab === 'coat') lp.append(swatches('coat', 'Coat', coatsFor(cur.dog).map(k => ({ id: k.from === cur.dog ? '' : k.id, name: k.name, colors: k.swatch })), cur.coat || ''));
    else if (V.ltab === 'collar') {
      const own = lookDog({ dog: cur.dog }).pal.collar;
      lp.append(swatches('collar', 'Collar', [{ id: '', name: 'Its own', colors: [own] }, ...COLLARS.filter(k => k.hex !== own).map(k => ({ id: k.id, name: k.name, colors: [k.hex] }))], cur.collar || ''));
    } else if (V.ltab === 'eyes') {
      /* the eyes (founder 2026-10-26: "changeable eyes both shapes and colors" and "blush options so can have on or off in
         the loadout"): free, like a coat; a dog's own is the first of each */
      const own = lookDog({ dog: cur.dog }).pal.ink;
      lp.append(h3('Face style'), chips('style', 'Face style', STYLES, cur.style || ''), h3('Shape'), chips('eyes', 'Eye shape', EYE_SHAPES, cur.eyes || ''),
        h3('Colour'), swatches('iris', 'Eye colour', IRISES.map(k => ({ id: k.id, name: k.name, colors: [k.hex || own, k.deep || own] })), cur.iris || ''),
        h3('Blush'), chips('blush', 'Blush', BLUSH, cur.blush || ''));
    } else {
      const mine = ITEMS.filter(i => i.slot === V.ltab && owns(i.id)).sort(byRarity), rest = ITEMS.filter(i => i.slot === V.ltab && !owns(i.id)).sort(byRarity);
      lp.innerHTML = `<div class="pd-wgrid pd-wall">${mine.map(tile).join('')}</div>${rest.length ? `<h3 class="pd-h3">In the shop</h3><div class="pd-wgrid pd-wall">${rest.map(tile).join('')}</div>` : ''}`;
    }
    p.querySelector('[data-ltab="coat"]').hidden = coatsFor(cur.dog).length < 2;
  }
  function h3(t) { const h = document.createElement('h3'); h.className = 'pd-h3'; h.textContent = t; return h; }
  /* a radio group of words (an eye shape, a blush), picked like a swatch */
  function chips(kind, label, opts, now) {
    const g = document.createElement('div'); g.className = 'pd-swatches pd-chips'; g.dataset.kind = kind; g.setAttribute('role', 'radiogroup'); g.setAttribute('aria-label', label);
    g.innerHTML = opts.map(o => `<button type="button" class="pd-swatch pd-chipsw" role="radio" data-v="${esc(o.id)}" aria-checked="${o.id === now}" tabindex="${o.id === now ? 0 : -1}">${esc(o.name)}</button>`).join('');
    return g;
  }
  function swatches(kind, label, opts, now) {
    const g = document.createElement('div'); g.className = 'pd-swatches'; g.dataset.kind = kind; g.setAttribute('role', 'radiogroup'); g.setAttribute('aria-label', label);
    g.innerHTML = opts.map(o => `<button type="button" class="pd-swatch" role="radio" data-v="${esc(o.id)}" aria-checked="${o.id === now}" tabindex="${o.id === now ? 0 : -1}" aria-label="${esc(o.name)}" title="${esc(o.name)}"><i style="--a:${o.colors[0]};--b:${o.colors[1] || o.colors[0]}"></i></button>`).join('');
    return g;
  }
  function paintSel() {
    el.querySelectorAll('.pd-st').forEach(t => t.setAttribute('aria-pressed', String(!!V.sel && ((V.sel.kind === 'item' && t.dataset.item === V.sel.id) || (V.sel.kind === 'set' && t.dataset.set === V.sel.id)))));
    el.querySelectorAll('.pd-st[data-item]').forEach(t => { const it = itemOf(t.dataset.item); t.dataset.st = stateOf(it, W, cur.wear, priceToday(it.id, V.day)); });
  }
  /* the stage's words and its one button */
  function paintInfo() {
    const box = el.querySelector('.pd-winfo');
    let html;
    if (!V.sel) {
      const d = DOGS.find(x => x.id === cur.dog) || DOGS[0], worn = SLOTS.map(s => itemOf(cur.wear[s])).filter(Boolean);
      html = `<h2 class="pd-wname"></h2><p class="pd-wkick">${esc(d.breedName)}</p>
        <p class="pd-wnod">${worn.length ? esc(worn.map(i => i.name).join(', ')) : 'Nothing on yet. Tap a piece to try it on.'}</p>`;
      box.innerHTML = html; box.querySelector('.pd-wname').textContent = d.name;
    } else if (V.sel.kind === 'set') {
      const set = SETS.find(s => s.id === V.sel.id), { full, price, left } = setPrice(set.id, W.owned), short = Math.max(0, price - W.bones), top = set.items.map(itemOf).reduce((a, b) => (RANK[b.rarity] > RANK[a.rarity] ? b : a));
      html = `<h2 class="pd-wname">${esc(set.name)}</h2><p class="pd-wkick"><span class="pd-rar" data-r="${top.rarity}">Set</span>${set.items.length - left.length} of ${set.items.length} owned</p>
        <p class="pd-wnod">${set.items.map(i => esc(itemOf(i).name)).join(', ')}</p>
        ${left.length ? (short ? cta(`${short} more bones`, `${short} more bones for the ${set.name}. Show how to earn them`, ctx.offline, true, 'earn') : cta(`Buy set ${bones(price)}`, `Buy the ${set.name} for ${price} bones`, ctx.offline))
          + `<p class="pd-wfine">${short ? `About ${winsAway(short)} ${winsAway(short) === 1 ? 'win' : 'wins'} away. ` : ''}${left.length < set.items.length ? `Priced for the ${left.length} you lack. ` : ''}Alone: ${full}.</p>`
          : cta('Wear the set', `Wear the ${set.name}`, false, true) + '<p class="pd-wfine">You own every piece.</p>'}`;
      box.innerHTML = html;
    } else {
      const it = itemOf(V.sel.id), price = priceToday(it.id, V.day), st = stateOf(it, W, cur.wear, price), short = Math.max(0, price - W.bones);
      const button = st === 'equipped' ? cta('Take it off', `Take off the ${it.name}`, false, true)
        : st === 'owned' ? cta('Wear it', `Wear the ${it.name}`, false, true)
        : short ? cta(`${short} more bones`, `${short} more bones for the ${it.name}. Show how to earn them`, ctx.offline, true, 'earn')
        : cta(`Buy ${bones(price)}`, `Buy the ${it.name} for ${price} bones`, ctx.offline);
      const fine = st === 'equipped' || st === 'owned' ? (same(ctx.lookOf(cur), saved) ? 'Yours to wear in every duel.' : 'Save the look to wear it in duels.')
        : short ? `About ${winsAway(short)} ${winsAway(short) === 1 ? 'win' : 'wins'} away. Every right answer earns a bone.`
        : price < it.price ? `Today only. Usually ${it.price}.` : 'Worn the moment you buy it.';
      html = `<h2 class="pd-wname">${esc(it.name)}</h2><p class="pd-wkick"><span class="pd-rar" data-r="${it.rarity}">${RARITY[it.rarity].name}</span>${ONE[it.slot]}${isNew(it, V.day) ? '<span class="pd-rar pd-rar-new">New</span>' : ''}</p>
        <p class="pd-wnod">A nod to ${esc(it.nod)}</p>${it.sig ? `<p class="pd-wsig"><button type="button" class="pd-sigplay" data-w="move" aria-label="Play the ${esc(MOVES[it.sig.move].name)} move">${icon('sparkle')}<span>${esc(MOVES[it.sig.move].name)}</span></button>${it.sig.aura ? '<span>Shimmers while worn</span>' : ''}</p>` : ''}${button}<p class="pd-wfine">${fine}</p>`;
      box.innerHTML = html;
    }
    if (!reduced()) { box.classList.remove('pd-in'); void box.offsetWidth; box.classList.add('pd-in'); }
  }
  function cta(label, aria, disabled, alt = false, w = 'act') { return `<button type="button" class="pd-btn ${alt ? '' : 'pd-pri '}pd-wcta" data-w="${w}" aria-label="${esc(aria)}"${disabled ? ' disabled' : ''}>${label}</button>`; }

  /* the dog wears your look with the selection swapped in */
  function tryOn(fresh = false) {
    const w = { ...cur.wear };
    if (V.sel?.kind === 'item') { const it = itemOf(V.sel.id); if (it && !(V.tab === 'locker' && owns(it.id))) w[it.slot] = it.id; }
    if (V.sel?.kind === 'set') for (const id of SETS.find(s => s.id === V.sel.id).items) w[itemOf(id).slot] = id;
    prev.dress({ ...cur, wear: w });
    if (fresh && !playMove()) prev.tap();
  }

  /* the selection's signature move (a set's first), after the piece's pop has landed; false when it has none */
  function playMove() {
    const ids = V.sel?.kind === 'set' ? SETS.find(s => s.id === V.sel.id).items : V.sel ? [V.sel.id] : [];
    /* in the Locker, a piece just taken off does not dance */
    const mv = ids.filter(id => V.tab !== 'locker' || V.sel.kind === 'set' || Object.values(cur.wear).includes(id)).map(id => sigOf(id)?.move).find(Boolean);
    if (!mv) return false;
    clearTimeout(V.moveT); V.moveT = setTimeout(() => prev.perform(mv), 380);
    return true;
  }

  /* ---- acting ---- */
  async function act() {
    const sel = V.sel; if (!sel) return;
    if (sel.kind === 'item' && owns(sel.id)) {
      const it = itemOf(sel.id);
      if (cur.wear[it.slot] === it.id) delete cur.wear[it.slot]; else cur.wear[it.slot] = it.id;
      paintSel(); paintInfo(); tryOn(); paintBar(); focusCta(); return;
    }
    if (sel.kind === 'set' && !setPrice(sel.id, W.owned).left.length) {
      for (const id of SETS.find(s => s.id === sel.id).items) cur.wear[itemOf(id).slot] = id;
      paintSel(); paintInfo(); tryOn(); paintBar(); focusCta(); return;
    }
    const ids = sel.kind === 'set' ? setPrice(sel.id, W.owned).left : [sel.id], total = priceOf(sel), was = W.bones, b = el.querySelector('.pd-wcta');
    b.disabled = true; b.dataset.busy = '';
    try {
      W = await ctx.buy(ids, total);
      const wear = sel.kind === 'set' ? SETS.find(s => s.id === sel.id).items : ids;
      for (const id of wear) cur.wear[itemOf(id).slot] = id;
      await save(true);
      celebrate(ids.map(itemOf));
      paintBal(was); paintPanel(); paintInfo(); paintBar(); tryOn();
      ctx.say(`Bought ${ids.map(i => itemOf(i).name).join(', ')}. ${W.bones} bones left.`);
      focusCta();
    } catch (e) {
      paintInfo();
      note(e.message || 'That did not go through. Try again.');
    }
  }
  function focusCta() { el.querySelector('.pd-wcta, .pd-winfo')?.focus({ preventScroll: true }); }
  async function save(quiet = false) {
    const look = ctx.lookOf(cur), btn = el.querySelector('[data-w="save"]');
    if (btn) btn.disabled = true;
    try { const p = await ctx.saveLook(look); saved = ctx.lookOf(p?.look || look); cur = structuredClone(saved); if (!quiet) ctx.say('Look saved'); return true; }
    catch (e) { note(e.message || 'The look did not save. Try again.'); return false; }
    finally { if (btn) btn.disabled = false; paintBar(); if (!quiet) { paintInfo(); paintSel(); } }
  }
  async function keepOutfit(i, btn) {
    if (W.outfits[i] && btn?.classList.contains('pd-fit-keep') && !('sure' in btn.dataset)) {
      btn.dataset.sure = ''; btn.innerHTML = icon('check'); btn.setAttribute('aria-label', `Tap again to replace outfit ${i + 1} with this look`); ctx.say(`Tap again to replace outfit ${i + 1}`);
      setTimeout(() => { if (btn.isConnected) { delete btn.dataset.sure; btn.innerHTML = icon('repeat'); btn.setAttribute('aria-label', `Keep this look as outfit ${i + 1}`); } }, 3000);
      return;
    }
    const list = Array.from({ length: OUTFITS }, (_, k) => W.outfits[k] || null), name = outfitName(W.outfits[i], i);
    list[i] = { ...ctx.lookOf(cur), name };
    try { W = await ctx.saveOutfits(list); ctx.say(`Kept as ${name}`); } catch (e) { ctx.say(e.message); }
    paintPanel(); el.querySelector(`[data-outfit="${i}"]`)?.focus({ preventScroll: true });
  }
  /* a kept outfit's new name, saved on the server with the rest; an empty name goes back to "Outfit 2" */
  async function renameOutfit(i, input) {
    const o = W.outfits[i]; if (!o) return;
    const name = outfitName({ name: input.value }, i);
    if (name === outfitName(o, i)) { input.value = name; return; }
    const list = Array.from({ length: OUTFITS }, (_, k) => W.outfits[k] || null);
    list[i] = { ...o, name };
    try { W = await ctx.saveOutfits(list); input.value = outfitName(W.outfits[i], i); ctx.say(`Outfit ${i + 1} is now ${input.value}`); }
    catch (e) { input.value = outfitName(o, i); ctx.say(e.message || 'The name did not save. Try again.'); }
    const wear = el.querySelector(`[data-outfit="${i}"]`), keep = el.querySelector(`.pd-fit-keep[data-i="${i}"]`);
    wear?.setAttribute('aria-label', `Wear ${input.value}`); keep?.setAttribute('aria-label', `Keep this look as ${input.value}`);
  }
  function wearOutfit(i) {
    const o = W.outfits[i]; if (!o) return;
    cur = structuredClone(ctx.lookOf(fitWear(o, W.owned))); V.sel = null;
    prev.dress(cur); prev.tap(); paintPanel(); paintInfo(); paintBar(); ctx.say(`Wearing ${outfitName(o, i)}`);
    el.querySelector(`[data-outfit="${i}"]`)?.focus({ preventScroll: true });
  }
  function pickDog(id) {
    /* a coat carries over where the new breed has one of that name (black and tan, cream), else its own */
    if (cur.coat && !coatsFor(id).some(k => k.id === cur.coat && k.from !== id)) delete cur.coat;
    cur.dog = id; prev.dress(cur); prev.tap();
    paintPanel(); paintInfo(); paintBar();
    el.querySelector(`[data-dog="${id}"]`)?.focus({ preventScroll: true });
  }
  function pickSwatch(kind, v) {
    if (kind === 'collar' && COLLARS.find(k => k.id === v)?.hex === lookDog({ dog: cur.dog }).pal.collar) v = '';
    if (v) cur[kind] = v; else delete cur[kind];
    prev.dress(cur);
    el.querySelectorAll(`[data-kind="${kind}"] .pd-swatch`).forEach(b => { const on = b.dataset.v === (cur[kind] || ''); b.setAttribute('aria-checked', String(on)); b.tabIndex = on ? 0 : -1; });
    paintBar();
  }
  /* a tap on the dog (founder 2026-10-26: "if you click the dog on preview it will go to default with no accessories with
     a pop out that says do you want to reset accessories on the dog"): the bar asks, and a yes takes every piece off and
     puts back its own coat, collar, eyes and blush; nothing is saved until Save */
  function askReset() {
    const bar = el.querySelector('.pd-wbar');
    bar.hidden = false; bar.dataset.ask = '';
    bar.innerHTML = `<span class="pd-wask">Reset accessories on this dog?</span><button class="pd-link" type="button" data-w="resetno">Keep</button><button class="pd-btn pd-pri" type="button" data-w="resetyes">${icon('repeat')}Reset</button>`;
    bar.querySelector('[data-w="resetyes"]').focus({ preventScroll: true });
    ctx.say('Reset accessories on this dog?');
  }
  function resetDog() {
    cur = { dog: cur.dog, wear: {} };
    V.sel = null; prev.dress(cur); prev.tap();
    paintPanel(); paintInfo(); paintBar();
    ctx.say('Reset. Save the look to keep it.');
  }
  /* a line under the stage's button, said too (an error, the shop offline) */
  function note(text) { const f = el.querySelector('.pd-wfine'); if (f) f.textContent = text; ctx.say(text); }
  function sayOf(sel) {
    if (sel.kind === 'set') { const s = SETS.find(x => x.id === sel.id), sp = setPrice(s.id, W.owned); return `${s.name}${sp.left.length ? `, ${sp.price} bones` : ', all owned'}`; }
    const it = itemOf(sel.id), st = stateOf(it, W, cur.wear, priceToday(it.id, V.day));
    return `${it.name}, ${RARITY[it.rarity].name}. ${st === 'equipped' ? 'Wearing it' : st === 'owned' ? 'Owned' : `${priceToday(it.id, V.day)} bones`}`;
  }
  /* the purchase: the dog cheers, sparks in the rarity's colour, the tile flips to owned */
  function celebrate(items) {
    const top = items.reduce((a, b) => (RANK[b.rarity] > RANK[a.rarity] ? b : a));
    prev.expr('overjoyed'); prev.tap(); setTimeout(() => prev.expr('happy'), 2400);
    if (reduced()) return;
    const burst = el.querySelector('.pd-burst');
    burst.dataset.r = top.rarity;
    burst.innerHTML = Array.from({ length: 14 }, (_, i) => `<i style="--a:${i * (360 / 14)}deg;--d:${i % 2 ? 58 : 84}px;--s:${i % 3 ? 1 : 1.5}"></i>`).join('') + '<b></b>';
    burst.classList.remove('pd-go'); void burst.offsetWidth; burst.classList.add('pd-go');
  }
}
