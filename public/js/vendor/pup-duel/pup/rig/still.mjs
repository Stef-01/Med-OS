// still.mjs — a dog drawn once, at rest, with no page of its own: a face for a menu or a list (the stage's dog menu,
// the duel's mates and dressing room). The rig draws it (makeDog, then one frame at the loop's rest), so it is the dog
// the rig animates, in its coat and collar (coats.mjs).
// Part of the dog kit (public/doberman/); docs/doberman/README.md has the map.
import { DOGS, resolve, dogById } from './breeds.mjs';
import { dress } from './coats.mjs';
import { NS, r3 } from './parts.mjs';
import { makeDog } from './rig.mjs';
import { STILL } from './motion.mjs';

let made = 0;   // each still's own id prefix: its clip paths must not meet another still's in the same document

/* a look ({ dog, coat, collar }) as the dog the rig draws: an unknown dog is the registry's default */
export const lookDog = look => resolve(dress(DOGS.find(d => d.id === dogById(look && look.dog).id), look || {}));

/* an <svg> of one resolved dog, framed on its head and ears: 45 head units of room over the head's top, which takes
   in the tallest ears (a corgi's, a chihuahua's), down to the chin (the LPS head's, LPS_FACE in breeds.mjs); `expr` its face */
export function still(c, { expr = 'happy' } = {}) {
  const svg = document.createElementNS(NS, 'svg'), g = document.createElementNS(NS, 'g');
  const s = c.scale, m = c.mirror ? -1 : 1, hx = m * 18 * s, hy = -c.floorY * s;
  svg.setAttribute('viewBox', [hx - 64 * s, hy - 100 * s, 128 * s, 128 * s].map(r3).join(' '));
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.appendChild(g);
  const rig = makeDog(c, g, 'st' + (++made) + '-' + c.id);
  g.querySelector('[data-p="disc"]').setAttribute('r', '0');
  rig.setExpr(expr, -1e12);
  rig.frame(0, STILL, 16);
  return svg;
}
