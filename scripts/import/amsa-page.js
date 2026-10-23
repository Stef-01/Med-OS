/* import/amsa-page.js - runs inside the signed-in AMSA MedEd course tab (pasted via DevTools or the browser tool). Given
   the manifest (scripts/import/amsa-manifest.json, built by opening the course's 15 section pages one at a time: the
   Moodle Tiles format fills a section by script, so a plain fetch of a section page has no activities in it), it
   extracts each PDF's text with pdf.js inside the page, one at a time with long pauses (nothing crawls: one fetch, a
   pause, the next), and keeps the results in the page's IndexedDB so a reload loses nothing. The texts are read out of
   the tab in batches (dump) and written to scripts/import/amsa-raw/ by whoever drives the tab; ack marks a batch written.
     await __amsa.setManifest(items)        the manifest's items, once
     __amsa.run({ pause: 45000 })           fetch what is not cached yet
     __amsa.state / await __amsa.summary()  progress;  __amsa.stop()  stops after the current item
     await __amsa.dump(n)                   render the next n unexported texts as the page text
     await __amsa.ack([ids])                mark those ids exported */
(() => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const state = { phase: 'idle', done: 0, cached: 0, failed: [], current: '', total: 0, log: [] };
  const log = m => { state.log.push(`${new Date().toTimeString().slice(0, 8)} ${m}`); if (state.log.length > 300) state.log.shift(); };
  let stopping = false, pdfjs = null;

  /* IndexedDB: store "raw" keyed by resource id {id, title, section, file, pages, url, text, exported}; "meta" holds the manifest */
  const db = () => new Promise((ok, no) => { const q = indexedDB.open('amsa-import', 1); q.onupgradeneeded = () => { const d = q.result; d.createObjectStore('raw', { keyPath: 'id' }); d.createObjectStore('meta', { keyPath: 'k' }); }; q.onsuccess = () => ok(q.result); q.onerror = () => no(q.error); });
  const tx = async (store, mode, fn) => { const d = await db(); return new Promise((ok, no) => { const t = d.transaction(store, mode), s = t.objectStore(store), r = fn(s); t.oncomplete = () => ok(r && r.result); t.onerror = () => no(t.error); }); };
  const all = store => tx(store, 'readonly', s => s.getAll());
  const put = (store, v) => tx(store, 'readwrite', s => s.put(v));

  async function lib() {
    if (pdfjs) return pdfjs;
    pdfjs = await import('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.8.69/pdf.min.mjs');
    pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.8.69/pdf.worker.min.mjs';
    return pdfjs;
  }

  const setManifest = items => put('meta', { k: 'manifest', items });

  async function pdfText(url) {
    const p = await lib();
    const r = await fetch(url, { credentials: 'include' });
    const type = r.headers.get('content-type') || '', file = decodeURIComponent(r.url.split('/').pop().split('?')[0]);
    if (!/pdf/.test(type)) return { skip: `not a PDF (${type.split(';')[0]})`, file };
    const doc = await p.getDocument({ data: await r.arrayBuffer() }).promise, pages = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const tc = await (await doc.getPage(i)).getTextContent();
      let line = '', lastY = null, txt = '';
      for (const it of tc.items) {
        if (lastY !== null && Math.abs(it.transform[5] - lastY) > 2) { txt += `${line.trimEnd()}\n`; line = ''; }
        line += it.str; lastY = it.transform[5];
      }
      pages.push(txt + line);
    }
    return { pages: doc.numPages, file, text: pages.join('\n\n---page---\n\n') };
  }

  async function run({ pause = 45000, only = null } = {}) {
    stopping = false;
    const m = (await all('meta')).find(x => x.k === 'manifest');
    if (!m) throw new Error('no manifest: call setManifest(items) first');
    const have = new Set((await all('raw')).map(r => r.id));
    const todo = m.items.filter(i => !have.has(i.id) && (!only || only.includes(i.id)));
    state.phase = 'fetch'; state.total = m.items.length; state.cached = have.size;
    log(`${todo.length} to fetch, ${have.size} cached`);
    for (const i of todo) {
      if (stopping) break;
      state.current = `${i.title} (${i.id})`;
      try {
        if (i.mod !== 'resource') { state.failed.push({ id: i.id, title: i.title, why: `module ${i.mod}` }); log(`skip ${i.title}: ${i.mod}`); continue; }
        const got = await pdfText(`${i.url}&redirect=1`);
        if (got.skip) { state.failed.push({ id: i.id, title: i.title, why: got.skip, file: got.file }); log(`skip ${i.title}: ${got.skip}`); }
        else { await put('raw', { id: i.id, title: i.title, section: i.section, sectionNo: i.sectionNo, file: got.file, pages: got.pages, url: i.url, text: got.text, exported: false }); state.done++; log(`saved ${i.title} · ${got.pages} pages`); }
      } catch (e) { state.failed.push({ id: i.id, title: i.title, why: String(e).slice(0, 200) }); log(`fail ${i.title}: ${e}`); }
      await sleep(pause);
    }
    state.phase = stopping ? 'stopped' : 'finished'; state.current = '';
    log(state.phase);
  }

  /* the next n unexported texts, rendered as the page's main content so a text reader gets them whole */
  function show(text) {
    let m = document.getElementById('__amsa_out');
    if (!m) { m = document.createElement('main'); m.id = '__amsa_out'; document.body.innerHTML = ''; document.body.appendChild(m); }
    m.innerHTML = '<article><pre></pre></article>'; m.querySelector('pre').textContent = text;
    return text.length;
  }
  async function dump(n = 5) {
    const rows = (await all('raw')).filter(r => !r.exported).sort((a, b) => a.sectionNo - b.sectionNo || a.id - b.id).slice(0, n);
    const parts = rows.map(r => `=====RAW id=${r.id} title=${JSON.stringify(r.title)} section=${JSON.stringify(r.section)} file=${JSON.stringify(r.file)} pages=${r.pages} url=${r.url}\n${r.text}\n=====END ${r.id}`);
    return show(parts.join('\n') || '(nothing to dump)');
  }
  async function ack(ids) { for (const r of (await all('raw')).filter(r => ids.includes(r.id))) await put('raw', { ...r, exported: true }); return ids.length; }
  async function summary() { const rows = await all('raw'); return { phase: state.phase, current: state.current, total: state.total, cached: rows.length, unexported: rows.filter(r => !r.exported).length, failed: state.failed.length, last: state.log.slice(-3) }; }
  window.__amsa = { setManifest, run, stop: () => { stopping = true; }, state, dump, ack, summary, pdfText };
})();
