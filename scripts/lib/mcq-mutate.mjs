/* lib/mcq-mutate.mjs - the eval of the evals: take a good question, inject one known item-writing flaw, and see whether
   the checks catch it (scripts/mcq-evals.mjs measures the detection rate per flaw, and how often the same check fires
   on the unmutated questions). Each mutation names the check expected to catch it; null when the question cannot carry
   that flaw (a two-word lead-in has nothing to cut). Pure. */
import { sentences, leadIn, vignette, content } from '../../public/js/mcq/flaws.mjs';

const clone = q => ({ ...q, options: [...q.options], why: Array.isArray(q.why) ? [...q.why] : q.options.map(() => null), tags: [...(q.tags || [])] });
const other = q => (q.answer === 0 ? 1 : 0);
const withLead = (q, lead) => { const x = clone(q); delete x.ask; x.stem = `${vignette(q)} ${lead}`.trim(); return x; };

export const MUTATIONS = Object.freeze({
  /* a distractor becomes "All of the above" */
  'all-of-the-above': { expect: 'all-none', make: q => { const x = clone(q); x.options[x.options.length - 1 === x.answer ? x.options.length - 2 : x.options.length - 1] = 'All of the above'; return x; } },
  /* the key grows a long qualifying clause the distractors do not have */
  'longest-correct': { expect: 'longest-key', make: q => { const x = clone(q); x.options[x.answer] = `${x.options[x.answer].trim()}, which is confirmed by the combination of the history, the examination findings and the investigation results`; return x; } },
  /* the lead-in asks for the exception */
  'negative-stem': { expect: 'negative-stem', make: q => withLead(q, 'Each of the following is consistent with this patient\'s presentation EXCEPT which one?') },
  /* the key's own words are put into the vignette */
  'key-in-stem': { expect: 'clang', make: q => { const k = q.options[q.answer].trim(); if (!content(k).length) return null; const x = clone(q); const v = vignette(q), l = leadIn(q); delete x.ask; x.stem = `${v} The referral letter mentions ${k.charAt(0).toLowerCase()}${k.slice(1)}. ${l}`; return x; } },
  /* a distractor repeats another option in other words (same words, reordered or with an article) */
  'duplicate-options': { expect: 'duplicate-options', make: q => { const x = clone(q), i = other(q), j = x.options.findIndex((_, n) => n !== i && n !== x.answer); if (j < 0) return null; const w = x.options[i].trim(); x.options[j] = /^the /i.test(w) ? w.replace(/^the /i, '') : `The ${w.charAt(0).toLowerCase()}${w.slice(1)}`; return x; } },
  /* the lead-in is cut off: the stem ends on a finding */
  'missing-lead-in': { expect: 'lead-in', make: q => { const x = clone(q); delete x.ask; x.stem = vignette(q); return x.stem ? x : null; } },
  /* the vignette is cut to its first sentence */
  'truncated-vignette': { expect: ['vignette', 'stem-length'], make: q => { const ss = sentences(vignette(q)); if (ss.length < 3) return null; const x = clone(q); delete x.ask; x.stem = `${ss[0]} ${leadIn(q)}`; return x; } },
  /* the key becomes a distractor's twin "None of the above" (a second form of the same flaw) */
  'none-of-the-above': { expect: 'all-none', make: q => { const x = clone(q); x.options[other(q)] = 'None of the above'; return x; } }
});

/* the mutants of one question: [{ name, expect[], item }] for every mutation it can carry */
export function mutantsOf(q) {
  const out = [];
  for (const [name, m] of Object.entries(MUTATIONS)) {
    const item = m.make(q);
    if (item) out.push({ name, expect: [].concat(m.expect), item: { ...item, id: `${q.id}.m-${name}` } });
  }
  return out;
}

/* a wrong key: the same question with the key moved to a distractor (for the model judge: does the solver disagree?) */
export const wrongKey = q => ({ ...clone(q), id: `${q.id}.m-wrong-key`, answer: other(q) });
