/* The observation chart, drawn: the patient's NSW "Between the Flags" chart (zones from obs-charts.mjs) with the rows
   charted the way a nurse charts them: a dot at each value joined to the last, blood pressure as v over ^ joined by a
   line, a dot in the row for consciousness, pain, distress and capillary refill, oxygen and device written in, initials
   at the foot, actions in the comments box. Pure: data in, SVG string out (every text escaped), tested in Node.
   Two pages like the paper chart (vitals, then consciousness to initials); CSS stacks them on a phone. */
import { chartById, zoneOf, catZone, PAIN_ROW, CRT_ROW, LACTATE_ROW, escalation, obsText, RESPONSE, AVPU } from './obs.mjs';

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
/* the chart's own fills (sampled from the PDF) and its print and pen */
export const FILL = Object.freeze({ red: '#f9b29b', yellow: '#ffe02e', blue: '#d6edf2', white: '#ffffff', grey: '#e6e7e8' });
const INK = '#231f20', RULE = '#b9b4b0', PEN = '#1f3a8a';
const LW = 58, CW = 30, RH = 8, CH = 9, TH = 12, HEAD = 16, PAD = 1;
const num = n => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, ''));

/* the sections of each page, in the chart's order; graph sections are params, category sections rows of labels */
const CAT_ROWS = {
  concern: [['yes', 'Yes'], ['no', 'No'], ['na', 'Not asked']],
  distress: [['severe', 'Severe'], ['moderate', 'Moderate'], ['mild', 'Mild'], ['normal', 'Normal']],
  crt: [['3+', '≥ 3 s'], ['<3', '< 3 s']],
  avpu: [['A', 'A'], ['C', 'C'], ['V', 'V'], ['P', 'P'], ['U', 'U']],
  pain: [['severe', 'Severe 7-10'], ['moderate', 'Mod 4-6'], ['mild', 'Mild 1-3'], ['nil', 'Nil']],
  lactate: [['4+', '≥ 4'], ['2-3.9', '2 - 3.9'], ['<2', '< 2']],
};
const CAT_OF = { concern: r => r.concern, distress: r => r.distress, crt: r => (r.crt != null ? CRT_ROW(r.crt) : null), avpu: r => r.avpu,
  pain: r => (r.pain != null ? PAIN_ROW(r.pain) : null), lactate: r => (r.lactate != null ? LACTATE_ROW(r.lactate) : null) };
const NAMES = { concern: 'Concern', distress: 'Distress', crt: 'CRT', avpu: 'Conscious', pain: 'Pain', lactate: 'Lactate',
  rr: 'Resp rate', spo2: 'SpO2 %', sbp: 'BP mmHg', hr: 'Heart rate', temp: 'Temp °C' };
export function layout(chart) {
  const adult = chart.id === 'sago';
  return [
    ['time', 'concern', 'rr', ...(adult ? [] : ['distress']), 'spo2', 'o2', 'dev', ...(adult ? ['sbp', 'rhythm', 'hr'] : ['hr', 'crt', 'sbp']), 'init'],
    ['time', 'avpu', 'pain', 'temp', 'lactate', 'bgl', 'init'],
  ];
}

function page(chart, rows, secs, cols) {
  const W = LW + cols * CW, out = [], marks = [];
  const cx = i => LW + i * CW + CW / 2;
  let y = PAD;
  const text = (x, yy, s, o = {}) => `<text x="${x}" y="${yy}" font-size="${o.size || 6}" fill="${o.fill || INK}"${o.anchor ? ` text-anchor="${o.anchor}"` : ''}${o.weight ? ` font-weight="${o.weight}"` : ''}${o.hand ? ' class="hand"' : ''}>${esc(s)}</text>`;
  const grid = (top, h) => { for (let i = 0; i <= cols; i++) out.push(`<line x1="${LW + i * CW}" y1="${top}" x2="${LW + i * CW}" y2="${top + h}" stroke="${RULE}" stroke-width="0.4"/>`); };
  const name = (top, h, s) => out.push(`<text transform="translate(9 ${top + h / 2}) rotate(-90)" font-size="5.4" font-weight="700" fill="${INK}" text-anchor="middle" dominant-baseline="middle">${esc(s)}</text>`);
  for (const sec of secs) {
    if (sec === 'time') {
      out.push(`<rect x="0" y="${y}" width="${W}" height="${HEAD}" fill="#f1f1f1"/>`, text(LW - 4, y + 10.5, 'Time', { anchor: 'end', weight: 700, size: 6.5 }));
      grid(y, HEAD);
      rows.forEach((r, i) => marks.push(text(cx(i), y + 11.5, r.t, { anchor: 'middle', size: 9, fill: PEN, hand: true })));
      y += HEAD;
    } else if (CAT_ROWS[sec]) {
      if (!chart.cats[sec] || (sec === 'lactate' && !rows.some(r => r.lactate != null))) continue;
      const list = CAT_ROWS[sec], top = y;
      list.forEach(([k, label], j) => {
        const z = sec === 'concern' && k === 'na' ? 'grey' : catZone(chart, sec, k) || 'white';
        out.push(`<rect x="${LW}" y="${y}" width="${cols * CW}" height="${CH}" fill="${FILL[z]}"/>`, `<rect x="16" y="${y}" width="${LW - 16}" height="${CH}" fill="${z === 'white' ? '#fff' : FILL[z]}"/>`);
        out.push(text(LW - 3, y + 6.4, label, { anchor: 'end', size: 5.6 }), `<line x1="16" y1="${y + CH}" x2="${W}" y2="${y + CH}" stroke="${RULE}" stroke-width="0.4"/>`);
        rows.forEach((r, i) => { if (CAT_OF[sec](r) === k) marks.push(`<circle cx="${cx(i)}" cy="${y + CH / 2}" r="2.2" fill="${PEN}"/>`); });
        y += CH;
      });
      grid(top, y - top); name(top, y - top, NAMES[sec]);
      out.push(`<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="${INK}" stroke-width="0.8"/>`);
    } else if (chart.params[sec]) {
      const p = chart.params[sec], n = Math.round((p.max - p.min) / p.step), top = y, h = n * RH;
      const vy = v => top + ((p.max - v) / p.step) * RH;
      for (let j = 0; j < n; j++) {
        const hi = p.max - j * p.step, z = zoneOf(chart, sec, hi - p.step / 2)?.zone || 'white';
        out.push(`<rect x="${LW}" y="${top + j * RH}" width="${cols * CW}" height="${RH}" fill="${FILL[z]}"/>`);
        if (z !== 'white') out.push(`<rect x="${LW - 14}" y="${top + j * RH}" width="14" height="${RH}" fill="${FILL[z]}"/>`);
        out.push(`<line x1="${LW}" y1="${top + j * RH}" x2="${W}" y2="${top + j * RH}" stroke="${RULE}" stroke-width="0.35"/>`);
      }
      for (const l of p.labels) { out.push(text(LW - 3, vy(l) + 2.1, num(l), { anchor: 'end', size: 5.6 }), `<line x1="${LW - 2}" y1="${vy(l)}" x2="${LW}" y2="${vy(l)}" stroke="${INK}" stroke-width="0.5"/>`); }
      if (sec === 'temp') out.push(`<line x1="${LW}" y1="${vy(37)}" x2="${W}" y2="${vy(37)}" stroke="${INK}" stroke-width="0.5" stroke-dasharray="2 2"/>`);
      grid(top, h); name(top, h, NAMES[sec]);
      const clamp = v => Math.min(top + h - 1.5, Math.max(top + 1.5, vy(v)));
      const off = v => v > p.max || v < p.min;
      if (sec === 'sbp') {
        rows.forEach((r, i) => {
          if (r.sbp == null) return;
          const x = cx(i), ys = clamp(r.sbp), yd = r.dbp != null ? clamp(r.dbp) : null;
          if (yd != null) marks.push(`<line x1="${x}" y1="${ys}" x2="${x}" y2="${yd}" stroke="${PEN}" stroke-width="0.9"/>`, `<path d="M${x - 3} ${yd + 4}L${x} ${yd}L${x + 3} ${yd + 4}" fill="none" stroke="${PEN}" stroke-width="1.1" stroke-linejoin="round"/>`);
          marks.push(`<path d="M${x - 3} ${ys - 4}L${x} ${ys}L${x + 3} ${ys - 4}" fill="none" stroke="${PEN}" stroke-width="1.1" stroke-linejoin="round"/>`);
          if (off(r.sbp)) marks.push(text(x + 4, ys + (r.sbp > p.max ? 6 : -2), num(r.sbp), { size: 8, fill: PEN, hand: true }));
        });
      } else {
        let last = null;
        rows.forEach((r, i) => {
          const v = r[sec]; if (v == null) { last = null; return; }
          const pt = [cx(i), clamp(v)];
          if (last) marks.push(`<line x1="${last[0]}" y1="${last[1]}" x2="${pt[0]}" y2="${pt[1]}" stroke="${PEN}" stroke-width="0.9"/>`);
          marks.push(`<circle cx="${pt[0]}" cy="${pt[1]}" r="2.2" fill="${PEN}"/>`);
          if (off(v)) marks.push(text(pt[0] + 3.5, pt[1] + (v > p.max ? 7 : -2.5), num(v), { size: 8, fill: PEN, hand: true }));
          last = pt;
        });
      }
      y += h;
      out.push(`<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="${INK}" stroke-width="0.8"/>`);
    } else {
      /* written rows: oxygen flow, device, rhythm, BGL, initials */
      const label = { o2: 'O2 L/min', dev: 'Device', rhythm: 'Rhythm', bgl: 'BGL mmol/L', init: 'Initials' }[sec];
      const val = { o2: r => (r.o2 != null ? num(r.o2) : r.dev === 'RA' ? '' : null), dev: r => r.dev || null, rhythm: r => r.rhythm || null, bgl: r => (r.bgl != null ? num(r.bgl) : null), init: r => r.init || null }[sec];
      if (!label || (sec === 'bgl' && !rows.some(r => r.bgl != null)) || (sec === 'rhythm' && !rows.some(r => r.rhythm))) continue;
      out.push(`<rect x="0" y="${y}" width="${W}" height="${TH}" fill="${sec === 'init' ? '#f1f1f1' : '#fff'}"/>`, text(LW - 3, y + 8, label, { anchor: 'end', size: 5.6, weight: sec === 'init' ? 700 : 400 }));
      grid(y, TH);
      rows.forEach((r, i) => { const s = val(r); if (s) marks.push(text(cx(i), y + 9.5, s, { anchor: 'middle', size: 8.5, fill: PEN, hand: true })); });
      y += TH;
      out.push(`<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="${INK}" stroke-width="${sec === 'init' ? 0.8 : 0.4}"/>`);
    }
  }
  const H = y + PAD;
  return { W, H, body: `<rect x="0" y="0" width="${W}" height="${H}" fill="#fff"/>${out.join('')}<rect x="0.4" y="0.4" width="${W - 0.8}" height="${H - 0.8}" fill="none" stroke="${INK}" stroke-width="0.8"/>${marks.join('')}` };
}

/* the chart for these rows, or '' when the patient has no chart (obsTableHtml writes them out) */
export function obsChartHtml(chartId, obs, { label = '' } = {}) {
  const chart = chartById(chartId), rows = obs?.rows || [];
  if (!chart || !rows.length) return '';
  const cols = Math.min(10, Math.max(4, rows.length + 1));   /* one empty column for the next set: wider marks on a phone */
  const words = rows.map(obsText).join('. ');
  const pages = layout(chart).map((secs, n) => {
    const p = page(chart, rows, secs, cols);
    return `<svg class="os-obs-page" viewBox="0 0 ${p.W} ${p.H}" role="img" aria-label="${esc(`${label || 'Observations'}, page ${n + 1} of 2: ${words}`)}">${p.body}</svg>`;
  });
  const notes = rows.filter(r => r.note).map(r => `<li><span class="hand">${esc(r.t)}</span> <span class="hand">${esc(r.note)}${r.init ? ` (${esc(r.init)})` : ''}</span></li>`).join('');
  const legend = chart.id === 'sago' ? [['yellow', RESPONSE.yellow], ['red', RESPONSE.red]] : [['blue', 'Increase frequency'], ['yellow', RESPONSE.yellow], ['red', RESPONSE.red]];
  return `<figure class="os-obs">
    <figcaption class="os-obs-cap"><strong>${esc(chart.title)}</strong> <span>${esc(chart.ages)} · ${esc(chart.form)}</span></figcaption>
    <div class="os-obs-pages">${pages.join('')}</div>
    ${notes ? `<div class="os-obs-notes"><span>Interventions / comments / actions</span><ul>${notes}</ul></div>` : ''}
    <ul class="os-obs-key" aria-hidden="true">${legend.map(([z, s]) => `<li><i style="background:${FILL[z]}"></i>${esc(s)}</li>`).join('')}</ul>
  </figure>`;
}

/* no chart for this patient: the rows written out, times across the top */
export function obsTableHtml(obs) {
  const rows = obs?.rows || [];
  if (!rows.length) return '';
  const lines = [['Resp rate', r => r.rr], ['SpO2 %', r => r.spo2], ['Oxygen', r => (r.dev && r.dev !== 'RA' ? `${r.o2 != null ? `${num(r.o2)} L/min ` : ''}${r.dev}` : r.dev === 'RA' ? 'Room air' : null)],
    ['BP', r => (r.sbp != null ? `${num(r.sbp)}${r.dbp != null ? `/${num(r.dbp)}` : ''}` : null)], ['Heart rate', r => (r.hr != null ? `${num(r.hr)}${r.rhythm === 'Irreg' ? ' irreg' : ''}` : null)],
    ['Temp °C', r => r.temp], ['Cap refill', r => (r.crt != null ? `${num(r.crt)} s` : null)], ['Resp distress', r => r.distress], ['Conscious', r => (r.avpu ? AVPU[r.avpu] : null)],
    ['Pain /10', r => r.pain], ['BGL', r => r.bgl], ['Lactate', r => r.lactate]]
    .filter(([, f]) => rows.some(r => f(r) != null && f(r) !== ''));
  const notes = rows.filter(r => r.note).map(r => `<li><b>${esc(r.t)}</b> ${esc(r.note)}</li>`).join('');   /* actions read as the notes they are, under the numbers */
  return `<table class="os-obs-table"><tr><th>Time</th>${rows.map(r => `<th>${esc(r.t)}</th>`).join('')}</tr>${lines.map(([l, f]) => `<tr><th>${esc(l)}</th>${rows.map(r => `<td>${esc(f(r) != null ? (typeof f(r) === 'number' ? num(f(r)) : f(r)) : '')}</td>`).join('')}</tr>`).join('')}</table>${notes ? `<ul class="os-obs-acts">${notes}</ul>` : ''}`;
}

/* for the examiner: what the chart calls for at each time, worked out from the zones (never written by hand) */
export function obsZonesHtml(chartId, obs) {
  const chart = chartById(chartId), rows = obs?.rows || [];
  if (!chart || !rows.length) return '';
  return `<ul class="os-obs-zones">${rows.map(r => {
    const e = escalation(chart, r);
    return `<li class="os-z-${e.zone}"><span class="os-zt">${esc(r.t)}</span><span class="os-zc">${esc(e.action || 'Between the flags')}</span>${e.why.length ? `<span class="os-zw">${esc(e.why.join('; '))}</span>` : ''}</li>`;
  }).join('')}</ul>`;
}
