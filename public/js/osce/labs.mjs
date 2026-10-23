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

/* a printed range as bounds: "115-165", "115 to 165", "-2 to +2", "<5", "below 5", ">60", "above 60", "≤ 30" */
export function refBounds(r) {
  const s = String(r || '').replace(/−|–/g, '-').trim(), n = '([+-]?\\d+(?:\\.\\d+)?)';
  let m;
  if ((m = s.match(new RegExp(`^${n}\\s*(?:-|to)\\s*${n}$`, 'i')))) return { lo: +m[1], hi: +m[2] };
  if ((m = s.match(new RegExp(`^(?:<|≤|<=|below|under|less than)\\s*${n}$`, 'i')))) return { lo: null, hi: +m[1], strict: !/≤|<=/.test(s) };
  if ((m = s.match(new RegExp(`^(?:>|≥|>=|above|over|more than|greater than)\\s*${n}$`, 'i')))) return { lo: +m[1], hi: null, strict: !/≥|>=/.test(s) };
  return null;
}
/* the flag a numeric result should carry against its range ('' inside it); null when either is not a number */
export function expectedFlag(v, r) {
  const m = String(v || '').replace(/,/g, '').match(/^([<>]?)\s*([+-]?\d+(?:\.\d+)?)$/), b = refBounds(r);
  if (!m || m[1] || !b) return null;
  const x = +m[2];
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
  const b = refBounds(r), s = String(r || '');
  if (b && b.lo != null && b.hi != null && b.lo >= 0 && !/[+-]/.test(s.replace(/^\s*\d/, ''))) return `${s.match(/[\d.]+/g)[0]}-${s.match(/[\d.]+/g)[1]}`;
  if (b && b.lo == null) return `${/≤|<=/.test(s) ? '≤' : '<'}${b.hi}`;
  if (b && b.hi == null) return `${/≥|>=/.test(s) ? '≥' : '>'}${b.lo}`;
  return s;
}
const refCell = r => [r.r ? esc(refText(r.r)) : '', r.u ? `(${esc(r.u)})` : ''].filter(Boolean).join(' ');

export function labsHtml(labs, { label = '' } = {}) {
  const panels = cleanLabs(labs); if (!panels) return '';
  return `<div class="os-lab" role="group"${label ? ` aria-label="${esc(label)}"` : ''}>${panels.map(p => {
    const cols = p.cols || ['Result'];
    return `<table class="os-lab-t"><thead>${p.title ? `<tr class="os-lab-p"><th colspan="${cols.length + 2}">${esc(p.title)}</th></tr>` : ''}<tr><th class="os-lab-n">Test</th>${cols.map(c => `<th class="os-lab-v">${esc(c)}</th>`).join('')}<th class="os-lab-r">Ref. Range (Units)</th></tr></thead><tbody>${p.rows.map(r =>
      `<tr${r.t ? '' : ' class="os-lab-c"'}><th class="os-lab-n" scope="row">${esc(r.t)}${r.n ? `<small>${esc(r.n)}</small>` : ''}</th>${r.v.map((v, i) => `<td class="os-lab-v${r.f[i] ? ' os-lab-ab' : ''}">${r.f[i] ? '<i aria-hidden="true">*</i>' : ''}${esc(v)}${r.f[i] ? `<span class="kit-sr"> (${r.f[i] === 'A' ? 'abnormal' : /H/.test(r.f[i]) ? 'high' : 'low'})</span>` : ''}</td>`).join('')}<td class="os-lab-r">${refCell(r)}</td></tr>`).join('')}</tbody></table>`;
  }).join('')}</div>`;
}

/* the same in words, for the marker and anyone without the table: "Haemoglobin 65 g/L (115-165) *L" */
export function labsText(labs) {
  return (cleanLabs(labs) || []).map(p => `${p.title ? `${p.title}: ` : ''}${p.rows.map(r => `${r.t || '(same)'} ${r.v.map((v, i) => `${p.cols ? `${p.cols[i]} ` : ''}${v}${r.f[i] ? ` *${r.f[i]}` : ''}`).join(', ')}${r.u ? ` ${r.u}` : ''}${r.r ? ` (${refText(r.r)})` : ''}${r.n ? ` [${r.n}]` : ''}`).join('; ')}`).join(' | ');
}
