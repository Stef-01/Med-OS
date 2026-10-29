/* buddy.mjs - the Study buddy (founder 2026-10-28: "make the mascot system from optimus integrated into MDosce so you have
   much more engaging prep assistance. make mascot a toggle and default off"). Optimus's Learn mascot
   (study-kit/mascot.mjs there), as MDosce has room for it: your duel dog, drawn once per answer (the rig's still, no
   iframe to load), docked in the answer's explanation so it never sits on a question. Its rules are Optimus's: one
   verdict per answer; a run climbs into bigger cheers; a miss is a sad face and the memory aid for the question's field;
   the first right answer after a miss is a comeback. The bubble carries content only (an aid, a run), never chatter.
   Off until Settings > Games turns it on (core.mjs GAMES). */
import { MNEMONICS } from './mnemonics.mjs';

/* the faces each verdict picks from (the rig's expressions.mjs) */
export const POOLS = Object.freeze({
  right: ['happy', 'excited', 'proud'], run: ['overjoyed', 'hyped', 'love'], party: ['dance', 'shades', 'hyped'],
  comeback: ['proud', 'overjoyed'], wrong: ['sad', 'puppy', 'surprised'], low: ['mopey', 'puppy']
});

/* one answer's reaction, over the run so far (mutated): pure, so the tests pin it */
export function reactionFor(r, ok, rnd = Math.random) {
  const at = p => p[Math.floor(rnd() * p.length) % p.length];
  if (ok) {
    const comeback = r.misses >= 1;
    r.streak++; r.misses = 0;
    if (comeback && r.streak === 1) return { mood: 'comeback', expr: at(POOLS.comeback), streak: 1 };
    const mood = r.streak >= 5 ? 'party' : r.streak >= 3 ? 'run' : 'right';
    return { mood, expr: at(POOLS[mood]), streak: r.streak };
  }
  r.streak = 0; r.misses++;
  return { mood: r.misses >= 3 ? 'low' : 'wrong', expr: at(POOLS[r.misses >= 3 ? 'low' : 'wrong']), streak: 0 };
}

/* the field a question is in, and the memory aid for it (Optimus's aidFor, over MDosce's own aids) */
const OG = /obstet|gynae|gyne|pregnan|labou?r|birth|postpartum|antenatal|pph|placent|fetal|foetal|contracep|menstr|ovar|uter|cervi|ectopic|miscarr|eclamp|shoulder dystocia|caesar|vagin|menopaus|breech/i;
const PAEDS = /paediatr|pediatr|child|infant|neonat|newborn|baby|toddler|adolesc|bronchiolitis|croup|kawasaki|febrile seizure|immunis|\d+-(?:year|month|week|day)-old (?:boy|girl)/i;
export const fieldOf = text => (OG.test(text || '') ? 'obs' : PAEDS.test(text || '') ? 'paeds' : '');
export function aidFor(text, list = MNEMONICS, rnd = Math.random) {
  if (!list?.length) return null;
  const t = String(text || ''), f = fieldOf(t), at = p => (p.length ? p[Math.floor(rnd() * p.length) % p.length] : null);
  const spec = m => !m.spec || (f === 'obs' ? m.spec.includes('Obstetrics') : f === 'paeds' ? m.spec.includes('Paediatrics') : false);
  const hit = list.filter(m => m.when && m.when.test(t) && spec(m) && m.group !== 'station');
  const inField = hit.filter(m => f && m.spec);   /* "delivery" also says "liver": the field wins */
  return at(inField) || at(hit) || null;
}
/* an aid as one short line: its name, what it is for, and its letters */
export const aidLine = m => (m ? `${m.name}: ${m.what}. ${(m.letters || []).map(([k, v]) => `${k} ${String(v).split(/[:(]/)[0].trim()}`).join(' · ')}` : '');

/* ---- the drawing ---- */
const run = { streak: 0, misses: 0 };
export const resetRun = () => { run.streak = 0; run.misses = 0; };

/* the look of your duel dog, as this device remembers it (the duel's own record, osce.duel:<transport>) */
function myLook() {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('osce.duel:')) { const me = JSON.parse(localStorage.getItem(k)); if (me?.look?.dog) return me.look; }
    }
  } catch { /* private mode */ }
  return { dog: 'pip' };
}

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* the buddy under one answered question: `host` the explanation it docks in, `item` the question */
export function cheerIn(host, item, ok) {
  if (!host) return;
  const r = reactionFor(run, ok);
  const aid = ok ? null : aidFor(`${item?.topic || ''} ${item?.stem || ''} ${(item?.options || [])[item?.answer] || ''}`);
  const say = !ok ? (aid ? `<b>${esc(aid.name)}</b> ${esc(aidLine(aid).slice(aid.name.length + 2))}` : '')
    : r.mood === 'comeback' ? '<b>Back on track.</b>' : r.streak >= 3 ? `<b>${r.streak} in a row.</b>` : '';
  const box = document.createElement('div');
  box.className = `os-buddy os-buddy--${r.mood}`;
  box.innerHTML = `<span class="os-buddy-dog" aria-hidden="true"></span>${say ? `<p class="os-buddy-say">${say}</p>` : ''}`;
  const verdict = host.querySelector(':scope > strong'); if (verdict) verdict.after(box); else host.prepend(box);   /* under the verdict, above the why */
  /* the row is in now (its circle holds the dog's room); the dog fades into it when drawn */
  rig().then(({ lookDog, still }) => { const slot = box.querySelector('.os-buddy-dog'); if (box.isConnected && slot) { slot.append(still(lookDog(myLook()), { expr: r.expr })); requestAnimationFrame(() => slot.classList.add('in')); } })
    .catch(() => box.querySelector('.os-buddy-dog')?.remove());
}
let rigP = null;
const rig = () => (rigP ||= import('../vendor/pup-duel/pup/rig/still.mjs'));
/* fetch the drawing ahead of the first answer */
export const warm = () => { rig().catch(() => { rigP = null; }); };
