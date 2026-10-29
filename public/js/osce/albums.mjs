/* osce/albums.mjs - question packs as album covers (founder 2026-10-29: "drastically improve the ui for the Q packs, make it
   more creative album covers like spotify would have but its with the mascot characters with references to famous
   singers popular right now but reimagined creatively as dogs and then when you complete the Q packs you unlock the
   featured dogs and accessories associated").

   An MDosce pick has a star: a dog of the kit dressed as a nod to a pop star (vendor/pup-duel/pup/rig/breeds.mjs, the
   pack stars: a pun and a look, never a name, a face or a logo), its album title and a cover style. Finishing the pack
   (FINISH: most of it right, against the AI or a mate) redeems the star's gift, so the dog and its signature piece join
   the duel's dogs on this device. A community playlist gets a cover of its own from its seed: one of the kit's dogs, in
   a piece from the wardrobe, on one of the styles, so no two covers in a row look alike.

   The covers are HTML with an empty dog slot; drawDogs(root) fills the slots after a paint (the rig's still, imported
   once, each drawing cached by its key and cloned). Pure parts are exported for scripts/albums.test.mjs. */
import { esc } from '../core.mjs';

/* the pack stars, by pick id */
export const STARS = Object.freeze({
  'paeds-acute': { dog: 'tailor', gift: 'mdpaedsacute', artist: 'Tail-or Swift', album: 'The Croup Era', sub: 'Paeds Version', style: 'eras', expr: 'proud', piece: 'sequin fringe' },
  'paeds-febrile': { dog: 'sabrina', gift: 'mdpaedsfebrile', artist: 'Sabrina Barkpenter', album: 'Short n’ Sweaty', sub: 'fever, fluids, jaundice', style: 'sweet', expr: 'bashful', piece: 'curtain fringe and bow' },
  'og-hypertension': { dog: 'charli', gift: 'mdogbp', artist: 'Charli XBark', album: 'brat', sub: 'pressure edition', style: 'brat', expr: 'mog', piece: 'lime bp band' }
});
export const starOf = p => (p?.pick ? STARS[String(p.id).replace(/^pick:/, '')] || null : null);

/* finishing a pack: at least FINISH.rounds rounds of it (or all of a shorter one), FINISH.share of them right */
export const FINISH = Object.freeze({ rounds: 5, share: 0.7 });
export const finished = (r, n) => !!r && r.rounds >= Math.min(FINISH.rounds, Math.max(1, n || 0)) && r.right >= Math.ceil(FINISH.share * r.rounds);

/* the community's styles, and the kit's dogs and pieces a seed picks from (no gift dog, no exclusive piece) */
export const STYLES = ['neon', 'sunset', 'mono', 'risograph', 'chrome', 'pastel'];
const COMMUNITY_DOGS = ['pip', 'mochi', 'sunny', 'scout', 'waffles', 'noodle', 'koda', 'pudding', 'domino', 'kiko', 'bagel', 'gaston', 'dash', 'nimbus', 'churro', 'lulu', 'heidi', 'rocky', 'archie', 'ziggy', 'coco', 'ruby', 'doge'];
const COMMUNITY_WEAR = [['head', 'headset'], ['face', 'hearts'], ['face', 'aviators'], ['head', 'bucket'], ['face', 'pixel'], ['head', 'snapback'], ['neck', 'chain'], ['head', 'crown'], ['face', 'threed'], ['head', 'cowboy'], ['neck', 'lei'], ['head', 'durag']];
const EXPRS = ['happy', 'excited', 'proud', 'overjoyed', 'mog', 'hyped', 'love'];
/* FNV-1a, then mixed, so ids a character apart still land on different covers */
const hash = s => { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.codePointAt(0), 16777619);
  h ^= h >>> 16; h = Math.imul(h, 0x45d9f3b); h ^= h >>> 16; h = Math.imul(h, 0x45d9f3b); return (h ^ (h >>> 16)) >>> 0; };

/* a playlist's cover: { style, dog, expr, wear, artist, album, sub, star } */
export function coverFor(p) {
  const st = starOf(p);
  if (st) return { style: st.style, dog: st.dog, expr: st.expr, wear: null, artist: st.artist, album: st.album, sub: st.sub, star: st };
  const h = hash(`${p?.id ?? ''}:${p?.cover ?? ''}`), [slot, id] = COMMUNITY_WEAR[(h >>> 9) % COMMUNITY_WEAR.length];
  return { style: STYLES[h % STYLES.length], dog: COMMUNITY_DOGS[(h >>> 3) % COMMUNITY_DOGS.length], expr: EXPRS[(h >>> 15) % EXPRS.length],
    wear: { [slot]: id }, artist: p?.owner_name || 'Someone', album: p?.title || 'Playlist', sub: '', star: null };
}

/* the cover's markup: size '' (a carousel's), 's' (a row's thumbnail) or 'l' (the detail's, with its record) */
export function albumHtml(p, size = '') {
  const c = coverFor(p), key = `${c.dog}|${c.expr}|${JSON.stringify(c.wear || {})}`;
  const lock = c.star && !starOwned(c.star) ? '<span class="os-alb-lock" aria-hidden="true">★</span>' : '';
  return `<span class="os-alb os-alb--${c.style}${size ? ` os-alb--${size}` : ''}"${c.star ? ` data-gift="${esc(c.star.gift)}"` : ''} aria-hidden="true">${size === 'l' ? '<span class="os-alb-rec"></span>' : ''}<span class="os-alb-art">
    <span class="os-alb-bg"></span><span class="os-alb-dog" data-dog="${esc(key)}"></span>
    ${size === 's' ? '' : `<span class="os-alb-tx"><i>${esc(c.artist)}</i><b>${esc(c.album)}</b>${c.sub ? `<em>${esc(c.sub)}</em>` : ''}</span>`}${lock}</span></span>`;
}

/* ---- the gift a finished pack redeems (the kit's gifts.mjs, kept on this device) ---- */
let gifts = null;
const giftsKit = () => (gifts ||= import('../vendor/pup-duel/pup/rig/gifts.mjs'));
let owned = null;   /* the redeemed gifts, read once the kit is in */
export const starOwned = st => !!owned?.has(st.gift);
export async function refreshOwned() { const g = await giftsKit(); owned = g.unlocked(); return owned; }
/* redeem a pack's star: { fresh, star } (fresh false when it was already in) */
export async function unlockStar(st) {
  const g = await giftsKit(), r = g.redeem(st.gift);
  owned = g.unlocked();
  return { fresh: r.ok && !r.already, star: st };
}

/* ---- the drawings ---- */
let kit = null;
const cache = new Map();
async function dogSvg(key) {
  if (cache.has(key)) return cache.get(key).cloneNode(true);
  kit ||= Promise.all([import('../vendor/pup-duel/pup/rig/still.mjs'), import('../vendor/pup-duel/pup/wardrobe.mjs')]);
  const [{ lookDog, still }, { ITEMS }] = await kit;
  const [dog, expr, w] = key.split('|'), wear = JSON.parse(w || '{}');
  const svg = still(lookDog({ dog }), { expr });
  for (const [slot, id] of Object.entries(wear)) {
    const it = ITEMS.find(i => i.id === id), g = svg.querySelector(`[data-p="wear${slot[0].toUpperCase()}${slot.slice(1)}"]`);
    if (!it || !g) continue;
    g.innerHTML = it.svg;
    const show = (n, on) => svg.querySelectorAll(`[data-p="${n}"]`).forEach(e => e.setAttribute('display', on ? 'inline' : 'none'));
    if (slot === 'head' && (it.ears === 'hide' || it.ears === 'hood')) { show('earsBack', false); show('earTips', false); if (it.ears === 'hood') show('earsFront', false); }
    if (slot === 'head' && it.ears === 'over') show('earsOver', true);
  }
  cache.set(key, svg);
  return svg.cloneNode(true);
}
/* fill every empty dog slot under root; a slot drawn fades its dog in (osce.css .os-alb-dog.in) */
export async function drawDogs(root) {
  if (!root) return;
  if (!owned) { await refreshOwned().catch(() => {}); root.querySelectorAll('.os-alb-lock').forEach(l => { /* owned now known: drop locks already earned */
    const tx = l.closest('.os-alb'); if (tx && tx.dataset.gift && owned?.has(tx.dataset.gift)) l.remove(); }); }
  /* every cover at once, faded in on one frame (not one after another) */
  const slots = [...root.querySelectorAll('.os-alb-dog:empty')];
  const svgs = await Promise.all(slots.map(s => dogSvg(s.dataset.dog).catch(() => null)));
  slots.forEach((s, i) => { if (!svgs[i]) s.remove(); else if (s.isConnected && !s.firstChild) s.append(svgs[i]); });
  requestAnimationFrame(() => slots.forEach(s => s.classList.add('in')));
}

/* the pack being played, so the duel's result can redeem its star (duel.mjs onResult): { star, title, n } or null */
let pending = null;
export const setPending = v => { pending = v; };
export const pendingFor = title => (pending && pending.title === title ? pending : null);
