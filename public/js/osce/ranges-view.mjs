/* ranges-view.mjs — the Normal ranges sheet, opened from a study card whose question has lab values (UWorld's and
   AMBOSS's lab values panel). The tests the question names come first; below, every range by group, and a find box.
   Stacked over Your questions: Escape and the grabber close it, the card keeps its place. */

import { esc } from '../core.mjs';
import { icon } from '../study-kit/icons.mjs';
import { openDialog } from './state.mjs';
import { RANGES, GROUPS, inText, find } from '../library/ranges.mjs';

/* a range split by sex goes on two lines, men over women */
const range = r => esc(r).split(/, (?=women)/).map((p, i) => (i ? p[0].toUpperCase() + p.slice(1) : p)).join('<br>');
const row = x => `<li><b>${esc(x.t)}</b><span class="os-rngr">${range(x.r)}${x.u ? ` <small>${esc(x.u)}</small>` : ''}</span>${x.n ? `<small class="os-rngn">${esc(x.n)}</small>` : ''}</li>`;
const groups = list => GROUPS.map(g => { const l = list.filter(x => x.g === g); return l.length ? `<section><h4>${esc(g)}</h4><ul class="os-rnglist" role="list">${l.map(row).join('')}</ul></section>` : ''; }).join('')
  || '<p class="os-libmeta">No test by that name here. Read the range on the lab report.</p>';

export function openRanges(text) {
  const hits = inText(text);
  const d = openDialog({ kind: 'ranges', title: 'Normal ranges', cls: 'os-dlg--rng',
    body: `<div class="os-rng">
      ${hits.length ? `<h3 class="os-libh">In this question</h3><ul class="os-rnglist os-rnghit" role="list">${hits.map(row).join('')}</ul>` : ''}
      <label class="os-rngfind">${icon('search')}<input type="search" name="rfind" placeholder="Find a test (${RANGES.length})" autocomplete="off" spellcheck="false" aria-label="Find a test"></label>
      <div class="os-rngall">${groups(RANGES)}</div>
      <p class="os-libmeta">Adult ranges, mostly as Med-OS’s stations use them. Labs differ: in an exam or on a ward, read the range printed on the report.</p>
    </div>` });
  const all = d.el.querySelector('.os-rngall');
  d.el.querySelector('[name="rfind"]')?.addEventListener('input', e => { all.innerHTML = groups(find(e.target.value)); });
  return d;
}
