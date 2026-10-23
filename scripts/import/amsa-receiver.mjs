#!/usr/bin/env node
/* amsa-receiver.mjs - takes the case texts the AMSA tab has cached (scripts/import/amsa-page.js) and writes each to
   scripts/import/amsa-raw/<slug>.md, the converter's input, without a person copying them out. Listens on 127.0.0.1 only,
   answers only the AMSA origin, and answers Chrome's private-network preflight so the https page may post to it.
   The tab posts one case at a time: POST /raw {id, title, section, file, pages, url, text}. A case already on disk is
   left as it is. Stop it with Ctrl+C once the tab reports nothing left.

     node scripts/import/amsa-receiver.mjs            port 8787 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url)), RAW = path.join(HERE, 'amsa-raw');
const ORIGIN = 'https://amsameded.org.au', PORT = Number(process.argv[2] || 8787);
const manifest = JSON.parse(fs.readFileSync(path.join(HERE, 'amsa-manifest.json'), 'utf8'));
const slugOf = new Map(manifest.items.map(i => [String(i.id), i.slug]));
const q = v => JSON.stringify(String(v ?? ''));

/* the case as the converter reads it (import-amsa.mjs parseRaw): front matter, then the text with its page breaks */
export const rawMd = (r, now) => `---\nid: ${r.id}\ntitle: ${q(r.title)}\nsection: ${q(r.section)}\nfile: ${q(r.file)}\npages: ${Number(r.pages) || 0}\nurl: ${r.url}\nfetched: ${now}\nsource: AMSA MedEd OSCEs (course 115)\n---\n\n${String(r.text || '').trim()}\n`;

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  fs.mkdirSync(RAW, { recursive: true });
  http.createServer((req, res) => {
    const cors = { 'Access-Control-Allow-Origin': ORIGIN, 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'content-type', 'Access-Control-Allow-Private-Network': 'true', Vary: 'Origin' };
    if (req.headers.origin !== ORIGIN) { res.writeHead(403); return res.end(); }
    if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }
    if (req.method !== 'POST' || req.url !== '/raw') { res.writeHead(404, cors); return res.end(); }
    let body = '';
    req.on('data', c => { body += c; if (body.length > 2e6) req.destroy(); });
    req.on('end', () => {
      try {
        const r = JSON.parse(body), slug = slugOf.get(String(r.id));
        if (!slug || !String(r.text || '').trim()) throw new Error(`unknown id or empty text: ${r.id}`);
        const file = path.join(RAW, `${slug}.md`), had = fs.existsSync(file);
        if (!had) fs.writeFileSync(file, rawMd(r, new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')));
        console.log(`${had ? 'kept' : 'wrote'} ${slug}.md`);
        res.writeHead(200, { ...cors, 'Content-Type': 'application/json' }); res.end(JSON.stringify({ ok: true, id: r.id, wrote: !had }));
      } catch (e) { console.log(`error: ${e.message}`); res.writeHead(400, cors); res.end(JSON.stringify({ ok: false, why: e.message })); }
    });
  }).listen(PORT, '127.0.0.1', () => console.log(`AMSA receiver on http://127.0.0.1:${PORT}/raw`));
}
