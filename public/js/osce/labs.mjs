/* Lab results as a pathology system shows them: Test | Result | Ref. Range (Units), the test name bold, the result right-
   aligned, an abnormal result red with an asterisk, the range and units grey. A test reported two ways (a count and a
   percentage) takes a second row with no name; a gas from two vessels, or a result beside an earlier one, takes a column
   each. Pure: data in, HTML out (every text escaped); the flags are checked against the ranges in code. */

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const FLAGS = Object.freeze(['', 'H', 'L', 'HH', 'LL', 'A']);   /* A: abnormal with no direction (a positive serology) */
const str = v => (typeof v === 'string' ? v.trim() : typeof v === 'number' && Number.isFinite(v) ? String(v) : '');
const list = (v, n) => { const a = (Array.isArray(v) ? v : [v]).map(str); while (a.length < n) a.push(''); return a.slice(0, n); };

/* a panel: { title?, cols?: [result column names], rows: [{ t: test ('' continues the row above), v: value or one per
   column, u: units, r: reference range, f: flag or one per column, n: a lab note }] }. Malformed rows and panels drop. */
export function cleanLabs(labs) {
  const out = (Array.isArray(labs) ? labs : []).map(p => {
    if (!p || typeof p !== 'object' || Array.isArray(p)) return null;
    const cols = (Array.isArray(p.cols) ? p.cols : []).map(str).filter(Boolean).slice(0, 4), n = Math.max(1, cols.length);
    const rows = (Array.isArray(p.rows) ? p.rows : []).map(r => {
      if (!r || typeof r !== 'object') return null;
      const v = list(r.v, n); if (!v.some(Boolean)) return null;
      const f = list(r.f ?? '', n).map(x => (FLAGS.includes(x) ? x : ''));
      const x = { t: str(r.t), v, f };
      for (const k of ['u', 'r', 'n']) if (str(r[k])) x[k] = str(r[k]);
      return x;
    }).filter(Boolean);
    if (!rows.length) return null;
    const x = { rows }; if (str(p.title)) x.title = str(p.title); if (cols.length) x.cols = cols;
    return x;
  }).filter(Boolean);
  return out.length ? out : null;
}

/* a printed range as bounds: "115-165", "115 to 165", "-2 to +2", "<5", "below 5", ">60", "above 60", "≤ 30"; words after
   the numbers ("≥10 indicates immunity", "3.0 to 7.7 (random)") are the lab's and do not change the bounds */
const RANGE = /^([+-]?\d+(?:\.\d+)?)\s*(?:-|to)\s*([+-]?\d+(?:\.\d+)?)(?=\s|$)/i, UPPER = /^(<=|<|≤|below|under|less than)\s*([+-]?\d+(?:\.\d+)?)(?=\s|$)/i, LOWER = /^(>=|>|≥|above|over|more than|greater than)\s*([+-]?\d+(?:\.\d+)?)(?=\s|$)/i;
export function refBounds(r) {
  const s = String(r || '').replace(/−|–/g, '-').trim();
  let m;
  if ((m = s.match(RANGE))) return { lo: +m[1], hi: +m[2], rest: s.slice(m[0].length).trim() };
  if ((m = s.match(UPPER))) return { lo: null, hi: +m[2], strict: !/≤|<=/.test(m[1]), rest: s.slice(m[0].length).trim() };
  if ((m = s.match(LOWER))) return { lo: +m[2], hi: null, strict: !/≥|>=/.test(m[1]), rest: s.slice(m[0].length).trim() };
  return null;
}
/* the flag a numeric result should carry against its range ('' inside it); null when either is not a number, or when a
   censored result ("<40", ">90") could fall either side */
export function expectedFlag(v, r) {
  const m = String(v || '').replace(/,/g, '').match(/^([<>]?)\s*([+-]?\d+(?:\.\d+)?)$/), b = refBounds(r);
  if (!m || !b) return null;
  const x = +m[2];
  if (m[1] === '<') return b.lo != null ? (x <= b.lo ? 'L' : null) : x <= b.hi ? '' : null;
  if (m[1] === '>') return b.hi != null ? (x >= b.hi ? 'H' : null) : x >= b.lo ? '' : null;
  if (b.lo != null && (b.strict && b.hi == null ? x <= b.lo : x < b.lo)) return 'L';
  if (b.hi != null && (b.strict && b.lo == null ? x >= b.hi : x > b.hi)) return 'H';
  return '';
}
/* every numeric flag that disagrees with its own value and range */
export function labFlagProblems(labs) {
  const p = [];
  for (const panel of cleanLabs(labs) || []) for (const r of panel.rows) r.v.forEach((v, i) => {
    const want = expectedFlag(v, r.r); if (want == null) return;
    const got = (r.f[i] || '').replace('HH', 'H').replace('LL', 'L');
    if (got !== want) p.push(`${r.t || '(continued)'}${panel.cols ? ` [${panel.cols[i]}]` : ''}: ${v}${r.u ? ` ${r.u}` : ''} against ${r.r} should be ${want ? `flagged ${want}` : 'unflagged'}, is ${got ? `flagged ${got}` : 'unflagged'}`);
  });
  return p;
}

/* "115 to 165" prints as a lab prints it, "115-165"; a range with a sign keeps its words ("-2 to +2") */
export function refText(r) {
  const s = String(r || '').replace(/−|–/g, '-').trim(), b = refBounds(s);
  if (!b) return s;
  const m = s.match(RANGE) || s.match(UPPER) || s.match(LOWER), tail = b.rest ? ` ${b.rest}` : '';
  if (b.lo != null && b.hi != null) return /^[+-]|\s[+-]/.test(m[0]) || /[+]/.test(m[0]) || b.lo < 0 ? `${m[1]} to ${m[2]}${tail}` : `${m[1]}-${m[2]}${tail}`;
  return b.lo == null ? `${b.strict ? '<' : '≤'}${m[2]}${tail}` : `${b.strict ? '>' : '≥'}${m[2]}${tail}`;
}
const refCell = r => [r.r ? esc(refText(r.r)) : '', r.u ? `(${esc(r.u)})` : ''].filter(Boolean).join(' ');

export function labsHtml(labs, { label = '' } = {}) {
  const panels = cleanLabs(labs); if (!panels) return '';
  return `<div class="os-lab" role="group"${label ? ` aria-label="${esc(label)}"` : ''}>${panels.map(p => {
    const cols = p.cols || ['Result'];
    return `<table class="os-lab-t"><thead>${p.title ? `<tr class="os-lab-p"><th colspan="${cols.length + 2}">${esc(p.title)}</th></tr>` : ''}<tr><th class="os-lab-n">Test</th>${cols.map(c => `<th class="os-lab-v">${esc(c)}</th>`).join('')}<th class="os-lab-r">Ref. Range (Units)</th></tr></thead><tbody>${p.rows.map(r =>
      `<tr${r.t ? '' : ' class="os-lab-c"'}><th class="os-lab-n" scope="row">${esc(r.t)}${r.n ? `<small>${esc(r.n)}</small>` : ''}</th>${r.v.map((v, i) => `<td class="os-lab-v${/^[<>≤≥]?\s*[+-]?\d/.test(v) ? '' : ' os-lab-tx'}${r.f[i] ? ' os-lab-ab' : ''}">${r.f[i] ? '<i aria-hidden="true">*</i>' : ''}${esc(v)}${r.f[i] ? `<span class="kit-sr"> (${r.f[i] === 'A' ? 'abnormal' : /H/.test(r.f[i]) ? 'high' : 'low'})</span>` : ''}</td>`).join('')}<td class="os-lab-r">${refCell(r)}</td></tr>`).join('')}</tbody></table>`;
  }).join('')}</div>`;
}

/* the same in words, for the marker and anyone without the table: "Haemoglobin 65 g/L (115-165) *L" */
export function labsText(labs) {
  return (cleanLabs(labs) || []).map(p => `${p.title ? `${p.title}: ` : ''}${p.rows.map(r => `${r.t || '(same)'} ${r.v.map((v, i) => `${p.cols ? `${p.cols[i]} ` : ''}${v}${r.f[i] ? ` *${r.f[i]}` : ''}`).join(', ')}${r.u ? ` ${r.u}` : ''}${r.r ? ` (${refText(r.r)})` : ''}${r.n ? ` [${r.n}]` : ''}`).join('; ')}`).join(' | ');
}
