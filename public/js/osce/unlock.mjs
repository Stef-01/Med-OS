/* osce/unlock.mjs - the moment a finished pack's star joins your dogs (albums.mjs): the dog springs in on its album's
   colours, rays turn behind it, and one line says what you got and where to find it. On the kit's overlay stack
   (study-kit/overlay.mjs), so it owns the keys over the duel: Escape or Enter, the button or a tap on the backdrop
   closes it, Tab stays in it, focus goes back where it was. */
import { esc } from '../core.mjs';
import { createOverlay } from '../study-kit/overlay.mjs';

let shell = null;
export const starName = st => (st.dog === 'sabrina' ? 'Barkpenter' : st.dog[0].toUpperCase() + st.dog.slice(1));

export async function showUnlock(st) {
  const name = starName(st);
  if (!shell) {
    shell = createOverlay({ cls: 'os-unlock', label: 'New dog unlocked', closeMs: 220,
      onKey: e => { if (e.key === 'Escape' || e.key === 'Enter') { e.preventDefault(); shell.close(); return true; } return false; } });
    shell.el.addEventListener('click', e => { if (e.target === shell.el || e.target.closest('button')) shell.close(); });
  }
  if (shell.isOpen) shell.close();
  shell.el.className = `os-unlock os-alb--${st.style}`;
  shell.el.setAttribute('aria-labelledby', 'os-unlock-h');
  shell.el.innerHTML = `<div class="os-unlock-card"><span class="os-unlock-rays" aria-hidden="true"></span>
    <span class="os-unlock-dog" aria-hidden="true"></span>
    <p class="os-unlock-k">Pack finished · new dog</p>
    <h2 id="os-unlock-h">${esc(name)} unlocked</h2>
    <p class="os-unlock-p">${esc(st.artist)}’s <i>${esc(st.album)}</i> star, ${esc(st.piece)} and all. Pick ${esc(name)} from your duel dogs.</p>
    <button type="button">Nice</button></div>`;
  shell.open(document.activeElement);
  shell.el.querySelector('button').focus({ preventScroll: true });
  try {
    const { lookDog, still } = await import('../vendor/pup-duel/pup/rig/still.mjs');
    shell.el.querySelector('.os-unlock-dog')?.append(still(lookDog({ dog: st.dog }), { expr: 'overjoyed' }));
  } catch { /* the words still say it */ }
}
