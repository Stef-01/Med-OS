/* Marked stations: every AI-marked attempt in the practice record (with sync on, both devices'). Per station: whose
   attempt it was, the score and global impression, the Critical items missed, the feedback, and the phrasing rewrites
   (what was said -> what to say so the examiner can tick it). */
import { esc } from '../core.mjs';
import { fmtDate } from '../study-kit/util.mjs';
import { safeHtml } from '../study-kit/safe.mjs';
import { osceAiMissed, osceAiResult } from './core.mjs';
import { ctx, I, GI, GI_C, body, findAttempt, whoBadge } from './state.mjs';

let rows = null, err = '';

/* every AI-marked attempt on this device (and, with sync on, the other device's), newest first, in the shape the cards read */
export async function loadMarked() {
  const out = [];
  for (const [sid, list] of Object.entries(ctx.mem.hist || {})) {
    if (!ctx.byId.has(sid)) continue;
    for (const a of list || []) if (a && a.fin && a.ai && (a.ai.status === 'done' || a.ai.status === 'declined'))
      out.push({ station_id: sid, attempt_id: a.id, status: a.ai.status, result: a.ai.result || null, note: a.ai.note || '', created_at: new Date(a.ai.at || a.fin).toISOString() });
  }
  rows = out.sort((x, y) => Date.parse(y.created_at) - Date.parse(x.created_at)).slice(0, 60);
  err = '';
  await Promise.all([...new Set(rows.filter(x => x.status === 'done').map(x => x.station_id))].map(id => body(id).catch(() => {})));
}

export function renderMarked(main) {
  if (rows == null) {
    main.innerHTML = `<div class="os-marked"><p class="os-kicker">Loading your marked stations…</p></div>`;
    loadMarked().then(() => { if (ctx.isOpen && ctx.view === 'marked') ctx.render(); });
    return;
  }
  const done = rows.filter(x => x.status === 'done');
  const head = `<div class="os-marked-top"><p class="os-kicker">${done.length} marked</p>
    </div>${err ? `<p class="os-marked-err">${esc(err)}</p>` : ''}`;
  if (!rows.length) {
    main.innerHTML = `<div class="os-marked">${head}<div class="os-card os-marked-empty"><p>No marked stations yet. Finish a station, paste the transcript under AI marking on the marking sheet, and Claude marks it against the checklist.</p></div></div>`;
    return;
  }
  main.innerHTML = `<div class="os-marked">${head}<ul role="list" class="os-marked-list">${rows.map((x, i) => card(x, i)).join('')}</ul></div>`;
}

function card(x, i) {
  const st = ctx.byId.get(String(x.station_id)), a = findAttempt(x.attempt_id), when = fmtDate(Date.parse(x.created_at) || Date.now());
  const open = a ? `<button class="os-btn soft" data-os="review" data-aid="${esc(a.id)}">Open attempt</button>` : '';
  if (x.status !== 'done') {
    const state = `Not marked${x.note ? `: ${esc(String(x.note).slice(0, 200))}` : ''}`;
    return `<li class="os-card os-mcard os-in" style="--d:${Math.min(i, 8)}"><div class="os-mhead"><strong>${esc(st.title)}</strong><span>${state} · ${esc(when)}</span></div>${open ? `<div class="os-mact">${open}</div>` : ''}</li>`;
  }
  const r = osceAiResult(x.result) || { items: [], global: null, feedback: '' }, phrasing = Array.isArray(x.result?.phrasing) ? x.result.phrasing : [];
  const n = r.items.filter(t => t.done).length, of = r.items.length, full = ctx.bodies?.get?.(String(x.station_id));
  const missed = full ? osceAiMissed(full.check, r.items) : [], crit = missed.filter(m => m.crit);
  const g = r.global != null ? `<b class="c-${GI_C[r.global]}">${GI[r.global]}</b>` : '';
  const apply = a && a.ai?.status === 'done' && !a.ai.applied ? `<button class="os-btn os-primary" data-os="aiapply" data-aid="${esc(a.id)}">Apply marks</button>` : '';
  return `<li class="os-card os-mcard os-in" style="--d:${Math.min(i, 8)}">
    <details${i === 0 ? ' open' : ''}><summary class="os-mhead"><span class="os-mtitle"><strong>${a ? whoBadge(a) : ''}${esc(st.title)}</strong>
      <span><b>${n}</b> of ${of}${g ? ` · ${g}` : ''} · ${esc(when)}</span></span>
      <span class="os-mbar" aria-hidden="true"><i style="width:${of ? Math.round(n / of * 100) : 0}%"></i></span>${I.chevD}</summary>
    <div class="os-mbody">
      ${crit.length ? `<section><h5>${crit.length} Critical missed</h5><ul role="list" class="os-mmiss">${crit.slice(0, 10).map(m => `<li><span class="os-html">${safeHtml(m.x)}</span></li>`).join('')}</ul></section>` : ''}
      ${r.feedback ? `<section><h5>Feedback</h5><p>${esc(r.feedback)}</p></section>` : ''}
      ${phrasing.length ? `<section><h5>Say it so it scores</h5><ol class="os-mphr">${phrasing.map(p => `<li>
          ${p.said ? `<p class="said">You said: “${esc(p.said)}”</p>` : '<p class="said">You missed this. Say:</p>'}
          <p class="better">“${esc(p.better)}”</p>${p.why ? `<small>${esc(p.why)}</small>` : ''}</li>`).join('')}</ol></section>`
        : ''}
      ${apply || open ? `<div class="os-mact">${apply}${open}</div>` : ''}
    </div></details></li>`;
}

export const markedReset = () => { rows = null; };
