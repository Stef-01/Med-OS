#!/usr/bin/env node
/* imaging/stage-ecg.mjs - real ECGs as staged candidates for the imaging pipeline. Each pick names a record of PTB-XL
   (21,799 clinical 12-lead ECGs, every one read by a cardiologist, CC BY 4.0) or a monitor strip from a PhysioNet
   arrhythmia database; the recording is downloaded from PhysioNet's open data bucket, drawn as the printed ECG
   (ecg.mjs) and saved as a PNG beside a manifest entry carrying its credit. fetch-imaging.mjs --staged then takes the
   candidates through the pixel check and acceptVerdict like any other image.

     node scripts/imaging/stage-ecg.mjs <stage dir> <picks.json>
   picks.json: { "<station>/<request>": [ { "db": "ptb-xl", "id": 15059 } | { "db": "cudb", "record": "cu01", "from": 120, "lead": "ECG" } ] } */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { parseHeader, leadsMv, ecgSvg, stripSvg } from './ecg.mjs';
import { addStaged } from './staged.mjs';

const BUCKET = 'https://physionet-open.s3.amazonaws.com';
export const DBS = {
  'ptb-xl': { version: '1.0.3', via: 'PTB-XL (PhysioNet)', license: 'CC BY 4.0', licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    author: 'Wagner P et al., PTB-XL (Sci Data 2020)',
    file: id => `records500/${String(Math.floor(id / 1000) * 1000).padStart(5, '0')}/${String(id).padStart(5, '0')}_hr` },
  cudb: { version: '1.0.0', via: 'CU Ventricular Tachyarrhythmia Database (PhysioNet)', license: 'ODC-BY 1.0 (Open Data Commons Attribution)', licenseUrl: 'https://opendatacommons.org/licenses/by/1-0/',
    author: 'Nolle FM et al., CU Ventricular Tachyarrhythmia Database (1986)', file: r => r },
};
export const pageOf = (db, file) => `https://physionet.org/content/${db}/${DBS[db].version}/${file}.hea`;

async function get(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return new Uint8Array(await r.arrayBuffer());
}

async function main() {
  const [stage, picksFile] = process.argv.slice(2);
  if (!stage || !picksFile) { console.error('usage: node scripts/imaging/stage-ecg.mjs <stage dir> <picks.json>'); process.exit(2); }
  const picks = JSON.parse(fs.readFileSync(picksFile, 'utf8'));
  const { chromium } = createRequire(import.meta.url)('playwright');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  let n = 0;
  for (const [key, list] of Object.entries(picks)) {
    const [station, req] = key.split('/');
    for (const p of list) {
      const db = DBS[p.db]; if (!db) throw new Error(`unknown database ${p.db}`);
      const file = db.file(p.db === 'ptb-xl' ? p.id : p.record), base = `${BUCKET}/${p.db}/${db.version}/${file}`;
      const header = parseHeader(new TextDecoder().decode(await get(`${base}.hea`)));
      const leads = leadsMv(header, await get(`${base}.dat`));
      let drawn, title;
      if (p.db === 'ptb-xl') { drawn = ecgSvg(leads, header.fs); title = `PTB-XL record ${p.id}`; }
      else {
        const lead = p.lead || header.signals[0].lead, from = Math.round((p.from || 0) * header.fs), sig = leads[lead].slice(from, from + Math.round(10 * header.fs));
        drawn = stripSvg(sig, header.fs, { lead: 'Monitor' }); title = `${p.db} record ${p.record} from ${p.from || 0} s`;
      }
      await page.setViewportSize({ width: drawn.width, height: drawn.height });
      await page.setContent(`<!doctype html><body style="margin:0">${drawn.svg}</body>`);
      const png = await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: drawn.width, height: drawn.height } });
      const name = `${p.db}-${p.id ?? `${p.record}-${p.from || 0}`}.png`;
      addStaged(stage, { station, req, name, bytes: png, title, description: p.note || '', source: p.db, via: db.via, license: db.license, licenseUrl: db.licenseUrl,
        author: db.author, page: pageOf(p.db, file) });
      n++; console.log(`${key}: ${name} (${Math.round(png.length / 1024)} KB)`);
    }
  }
  await browser.close();
  console.log(`${n} ECG${n === 1 ? '' : 's'} staged in ${path.resolve(stage)}`);
}
if (process.argv[1] && import.meta.url === new URL(`file://${path.resolve(process.argv[1])}`).href) main().catch(e => { console.error(e.message); process.exit(1); });
