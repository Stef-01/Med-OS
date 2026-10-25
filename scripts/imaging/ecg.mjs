/* imaging/ecg.mjs - pure: a real 12-lead recording (WFDB, the format PhysioNet's databases use) drawn as the ECG a
   machine prints: 25 mm/s, 10 mm/mV, a 1 mm and 5 mm grid, a 1 mV calibration pulse, the leads in the standard 3 by 4
   layout (I aVR V1 V4 / II aVL V2 V5 / III aVF V3 V6, 2.5 s each) and lead II as a 10 s rhythm strip. Nothing is
   smoothed or redrawn: every sample is a point on the trace. The SVG is turned into a PNG by stage-ecg.mjs.

   parseHeader(text) -> { record, nsig, fs, nsamp, signals: [{ file, fmt, gain, baseline, units, lead }] }
   decode16(bytes, nsig) -> [Int16Array per signal] (WFDB format 16: little-endian two's complement, interleaved)
   decode212(bytes, nsig) -> the same for format 212 (two 12-bit samples in three bytes; the older databases)
   leadsMv(header, bytes) -> { I: Float64Array (mV), II: …, aVR: …, … }
   ecgSvg(leads, fs, { mm, note }) -> { svg, width, height } */

export const LAYOUT = [['I', 'aVR', 'V1', 'V4'], ['II', 'aVL', 'V2', 'V5'], ['III', 'aVF', 'V3', 'V6']];
export const RHYTHM = 'II';
const NAMES = { I: 'I', II: 'II', III: 'III', AVR: 'aVR', AVL: 'aVL', AVF: 'aVF', V1: 'V1', V2: 'V2', V3: 'V3', V4: 'V4', V5: 'V5', V6: 'V6' };
export const leadName = s => NAMES[String(s || '').trim().toUpperCase()] || String(s || '').trim();

export function parseHeader(text) {
  const lines = String(text || '').split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#'));
  if (!lines.length) throw new Error('empty header');
  const [record, nsig, fsRaw, nsamp] = lines[0].split(/\s+/);
  const n = Number(nsig), fs = parseFloat(String(fsRaw || '').split('/')[0]);
  if (!(n > 0) || !(fs > 0)) throw new Error('bad record line');
  const signals = lines.slice(1, 1 + n).map(l => {
    const f = l.split(/\s+/);
    /* "file fmt gain(baseline)/units adcres adczero init checksum blocksize description" */
    const g = String(f[2] || '').match(/^([\d.eE+-]+)(?:\((-?\d+)\))?(?:\/(\S+))?$/) || [];
    return { file: f[0], fmt: f[1], gain: Number(g[1]) || 200, baseline: g[2] !== undefined ? Number(g[2]) : Number(f[4]) || 0, units: g[3] || 'mV', lead: leadName(f.slice(8).join(' ')) };
  });
  if (signals.length !== n) throw new Error(`header lists ${signals.length} of ${n} signals`);
  return { record, nsig: n, fs, nsamp: Number(nsamp) || 0, signals };
}

export function decode16(bytes, nsig) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes), frames = Math.floor(b.length / (2 * nsig));
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength), out = Array.from({ length: nsig }, () => new Int16Array(frames));
  for (let i = 0; i < frames; i++) for (let s = 0; s < nsig; s++) out[s][i] = dv.getInt16((i * nsig + s) * 2, true);
  return out;
}

export function decode212(bytes, nsig) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes), total = Math.floor((b.length * 2) / 3), frames = Math.floor(total / nsig);
  const out = Array.from({ length: nsig }, () => new Int16Array(frames)), x12 = v => (v & 0x800 ? v - 0x1000 : v);
  for (let k = 0; k < frames * nsig; k++) {
    const j = Math.floor(k / 2) * 3, v = k % 2 ? b[j + 2] | ((b[j + 1] & 0xf0) << 4) : b[j] | ((b[j + 1] & 0x0f) << 8);
    out[k % nsig][Math.floor(k / nsig)] = x12(v);
  }
  return out;
}

export function leadsMv(header, bytes) {
  const fmt = new Set(header.signals.map(s => s.fmt));
  if (fmt.size !== 1 || !['16', '212'].includes([...fmt][0])) throw new Error('only WFDB formats 16 and 212 are read');
  const raw = ([...fmt][0] === '212' ? decode212 : decode16)(bytes, header.nsig), out = {};
  header.signals.forEach((s, i) => { const r = raw[i], mv = new Float64Array(r.length); for (let k = 0; k < r.length; k++) mv[k] = (r[k] - s.baseline) / s.gain; out[s.lead] = mv; });
  return out;
}

const r2 = n => Math.round(n * 100) / 100;
/* one trace: samples [a, b) of a lead at x0 mm, its baseline at y0 mm, as an SVG path in pixels */
function trace(sig, fs, a, b, x0, y0, mm) {
  let d = '';
  for (let k = a; k < b && k < sig.length; k++) {
    const x = (x0 + ((k - a) / fs) * 25) * mm, y = (y0 - sig[k] * 10) * mm;
    d += `${k === a ? 'M' : 'L'}${r2(x)} ${r2(y)}`;
  }
  return d;
}

export function ecgSvg(leads, fs, { mm = 6, note = '' } = {}) {
  for (const l of [...LAYOUT.flat(), RHYTHM]) if (!leads[l]) throw new Error(`lead ${l} is missing`);
  const left = 12, top = 6, pitch = 34, seg = 2.5, colW = seg * 25, W = left + 4 * colW + 4, H = top + 4 * pitch + 8;
  const w = Math.round(W * mm), h = Math.round(H * mm), n = Math.round(seg * fs), parts = [];
  /* the paper: 1 mm lines, every fifth one heavier */
  const minor = [], major = [];
  for (let x = 0; x <= W; x++) (x % 5 ? minor : major).push(`M${r2(x * mm)} 0V${h}`);
  for (let y = 0; y <= H; y++) (y % 5 ? minor : major).push(`M0 ${r2(y * mm)}H${w}`);
  parts.push(`<rect width="${w}" height="${h}" fill="#fff"/>`,
    `<path d="${minor.join('')}" stroke="#f4c7c7" stroke-width="${r2(mm * 0.12)}"/>`,
    `<path d="${major.join('')}" stroke="#e59a9a" stroke-width="${r2(mm * 0.22)}"/>`);
  const ink = `fill="none" stroke="#111" stroke-width="${r2(mm * 0.24)}" stroke-linejoin="round" stroke-linecap="round"`;
  const label = (x, y, t) => `<text x="${r2(x * mm)}" y="${r2(y * mm)}" font-family="Arial, Helvetica, sans-serif" font-size="${r2(mm * 3.2)}" fill="#111">${t}</text>`;
  const cal = y0 => `M${r2(2 * mm)} ${r2(y0 * mm)}H${r2(4 * mm)}V${r2((y0 - 10) * mm)}H${r2(9 * mm)}V${r2(y0 * mm)}H${r2(11 * mm)}`;
  const paths = [];
  LAYOUT.forEach((row, r) => {
    const y0 = top + pitch * (r + 0.62);
    paths.push(cal(y0));
    row.forEach((l, c) => {
      const x0 = left + c * colW;
      paths.push(trace(leads[l], fs, c * n, (c + 1) * n, x0, y0, mm));
      if (c) paths.push(`M${r2(x0 * mm)} ${r2((y0 - 3) * mm)}V${r2((y0 + 3) * mm)}`);   /* the tick where the leads change */
      parts.push(label(x0 + 1.2, y0 - 12.5, l));
    });
  });
  const yR = top + pitch * 3.62;
  paths.push(cal(yR), trace(leads[RHYTHM], fs, 0, 4 * n, left, yR, mm));
  parts.push(label(left + 1.2, yR - 12.5, RHYTHM));
  parts.push(`<path d="${paths.join('')}" ${ink}/>`);
  parts.push(label(left, H - 2, `25 mm/s · 10 mm/mV${note ? ` · ${note}` : ''}`).replace('fill="#111"', 'fill="#555"'));
  return { svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${parts.join('')}</svg>`, width: w, height: h };
}

/* a rhythm strip only (a monitor strip: VF, a single lead): one lead, the whole recording up to 10 s */
export function stripSvg(sig, fs, { mm = 6, lead = 'II', note = '', secs = 10 } = {}) {
  const left = 12, top = 4, W = left + secs * 25 + 4, H = top + 60 + 8, w = Math.round(W * mm), h = Math.round(H * mm);   /* room for coarse VF's swings */
  const minor = [], major = [];
  for (let x = 0; x <= W; x++) (x % 5 ? minor : major).push(`M${r2(x * mm)} 0V${h}`);
  for (let y = 0; y <= H; y++) (y % 5 ? minor : major).push(`M0 ${r2(y * mm)}H${w}`);
  const y0 = top + 34, cal = `M${r2(2 * mm)} ${r2(y0 * mm)}H${r2(4 * mm)}V${r2((y0 - 10) * mm)}H${r2(9 * mm)}V${r2(y0 * mm)}H${r2(11 * mm)}`;
  const txt = (x, y, t, c) => `<text x="${r2(x * mm)}" y="${r2(y * mm)}" font-family="Arial, Helvetica, sans-serif" font-size="${r2(mm * 3.2)}" fill="${c}">${t}</text>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="#fff"/>`
    + `<path d="${minor.join('')}" stroke="#f4c7c7" stroke-width="${r2(mm * 0.12)}"/><path d="${major.join('')}" stroke="#e59a9a" stroke-width="${r2(mm * 0.22)}"/>`
    + `<path d="${cal}${trace(sig, fs, 0, Math.round(secs * fs), left, y0, mm)}" fill="none" stroke="#111" stroke-width="${r2(mm * 0.24)}" stroke-linejoin="round" stroke-linecap="round"/>`
    + txt(left + 1.2, top + 6, lead, '#111') + txt(left, H - 2, `25 mm/s · 10 mm/mV${note ? ` · ${note}` : ''}`, '#555') + '</svg>';
  return { svg, width: w, height: h };
}
