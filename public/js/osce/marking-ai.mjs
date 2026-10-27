/* osce/marking-ai.mjs - what a finished attempt's marking sheet grows beyond the checklist (from session.mjs, 2026-10-27, to
   keep that module to the clock, the tabs and the sheet): AI marking (the transcript fold, Mark with Claude or the chat
   path, the result, Apply), the Handover add-on and the Memory aids. session.mjs's markingHtml places them; the handlers
   here repaint through it. The marking laws (osceAiTicks/Missed/Quotes/Feedback) are core.mjs. */
import { esc } from '../core.mjs';
import { mnemonicsFor } from './mnemonics.mjs';
import { HANDOVER, osceScore, osceAiTicks, osceAiMissed, osceAiFeedback, AI_MAX } from './core.mjs';
import { ctx, I, GI, GI_C, save, sess, curAttempt, findAttempt, now, notify, ago, aiEnabled, markerCfg, nameOf } from './state.mjs';
import { markDirect, markPromptText, parseReply } from './marker.mjs';
import { markingHtml, syncIndeterminate } from './session.mjs';

/* AI marking (2026-10-19; Stefan: "copy paste a transcript recording
   that is text and then AI will mark … later on, when a routine process is run"). On a finished attempt the marking sheet
   grows a fold: paste the transcript, Send → one pending marking request and `a.ai = {reqId, status, at}` on
   the attempt (save() → every device). The fleet's hourly osce_marking.py marks it against this station's own checklist;
   the next open of the marking view (and Refresh, and a sync pull) reads done/declined rows for this station's attempts
   and offers Apply AI marks: leaf ticks only (a parent id never ticks), the global impression, and the AI's feedback
   under its own heading in the pad — Stefan's own words stay. Per-item evidence ("said: …") behind the Evidence chip;
   Critical items missed are listed first. A declined row shows its note and lets him paste again. */
let evid = false, aiDraft = {}, aiReply = {}, aiBusy = {};
export const aiEvid = () => evid;   /* the Evidence chip is on: the marking sheet shows "said: …" under each AI-ticked item */
export function aiHtml(st, a) {
  const ai = a.ai, n = (aiDraft[a.id] || '').length, busy = !!aiBusy[a.id], key = aiEnabled();
  if (!ai || !ai.status) {
    return `<details class="os-aifold" data-ai-fold${n || busy ? ' open' : ''}><summary>${I.bolt}<span>AI marking</span><small>paste a transcript</small>${I.chevD}</summary>
      <div class="os-aibody">
        <label class="os-notepad os-aipad${n ? ' filled' : ''}">${I.note}<textarea data-ai="tx" rows="5" maxlength="${AI_MAX}" placeholder="Paste the transcript of ${esc(nameOf(a.who === 1 ? 1 : 0))}'s attempt. Saying “I am now checking the radial pulse” or “I will examine the abdomen” counts as done.">${esc(aiDraft[a.id] || '')}</textarea></label>
        <div class="os-airow"><small class="os-aicount" aria-live="polite">${n.toLocaleString()} / ${AI_MAX.toLocaleString()}</small>
          ${key ? `<button class="os-btn os-primary" data-os="aisend" data-aid="${esc(a.id)}"${n < 1 || busy ? ' disabled' : ''}>${busy ? 'Marking…' : 'Mark with Claude'}</button>`
            : `<button class="os-btn os-primary" data-os="aicopy" data-aid="${esc(a.id)}"${n < 1 ? ' disabled' : ''}>Copy prompt for Claude</button>`}</div>
        <details class="os-aichat"${key ? '' : ' open'}><summary>${key ? 'Or use a Claude chat' : 'Mark it in a Claude chat'}${I.chevD}</summary>
          <p class="os-handhint">${key ? 'Copy the prompt, paste it into a Claude chat, then paste the reply here.' : 'Copy the prompt, paste it into a Claude chat, then paste the reply here. With an API key in Settings, Claude marks it here directly.'}</p>
          ${key ? `<button class="os-btn" data-os="aicopy" data-aid="${esc(a.id)}"${n < 1 ? ' disabled' : ''}>Copy prompt for Claude</button>` : ''}
          <label class="os-notepad os-aipad${aiReply[a.id] ? ' filled' : ''}">${I.note}<textarea data-ai="reply" rows="3" placeholder="Paste Claude's reply (the JSON) here">${esc(aiReply[a.id] || '')}</textarea></label>
          <div class="os-airow"><span></span><button class="os-btn" data-os="aipaste" data-aid="${esc(a.id)}"${aiReply[a.id] ? '' : ' disabled'}>Use this reply</button></div>
        </details>
      </div></details>`;
  }
  if (ai.status === 'declined') {
    return `<div class="os-ai os-ai--no"><div class="os-notice os-notice--sm os-notice--danger">${I.info}<div><h5>AI marking failed</h5><p>${esc(ai.note || 'The transcript could not be marked.')}</p></div></div>
      <div class="os-airow"><button class="os-link" data-os="aireset" data-aid="${esc(a.id)}">Try again</button></div></div>`;
  }
  const r = ai.result; if (!r) return '';
  const ticks = osceAiTicks(st.check, r.items), missed = osceAiMissed(st.check, r.items), of = osceScore(st.check, []).of;
  const critM = missed.filter(m => m.crit), sm = r.summary || {};
  /* the summary: the marker's phone lists when it wrote them (v4), else the Critical misses; the prose folds below */
  const plain = h => String(h || '').replace(/<[^>]+>/g, '');
  const missList = sm.missed?.length ? sm.missed : critM.slice(0, 5).map(m => (m.of ? `${plain(m.of).replace(/:$/, '')}: ` : '') + plain(m.x));
  const sentences = String(r.feedback || '').replace(/([.!?])\s+(?=[A-Z])/g, '$1\u0000').split('\u0000').filter(Boolean);   /* no lookbehind: Safari before 16.4 cannot parse one */
  const li = xs => xs.map(x => `<li>${esc(x)}</li>`).join('');
  return `<section class="os-ai os-ai--done" aria-label="AI marking">
    <header class="os-aihead">
      <div class="os-aiscore"><b>${ticks.length}</b><span>/${of}</span></div>
      <div class="os-aihtx"><h3>${I.bolt}AI marking</h3>
        <p>${r.global != null ? `<b class="c-${GI_C[r.global]}">${GI[r.global]}</b> · ` : ''}${critM.length ? `${critM.length} Critical missed · ` : ''}${missed.length} not done</p></div>
      <button class="os-chip os-aievid${evid ? ' on' : ''}" data-os="aievid" aria-pressed="${evid}">${I.eye}Evidence</button>
    </header>
    <div class="os-aigrid">
      ${missList.length ? `<div class="os-aibox os-aibox--miss"><h5>Missed</h5><ul role="list">${li(missList)}</ul></div>` : '<div class="os-aibox os-aibox--good"><h5>Missed</h5><p>Every item done</p></div>'}
      ${sm.strengths?.length ? `<div class="os-aibox os-aibox--good"><h5>Did well</h5><ul role="list">${li(sm.strengths)}</ul></div>` : ''}
      ${sm.next ? `<div class="os-aibox os-aibox--next"><h5>Next time</h5><p>${esc(sm.next)}</p></div>` : ''}
    </div>
    ${r.phrasing?.length ? `<div class="os-aisec"><h4>Say it so it scores</h4><ol class="os-mphr">${r.phrasing.map(p => `<li>
      ${p.said ? `<p class="said">You said “${esc(p.said)}”</p>` : '<p class="said">Not said. Try:</p>'}<p class="better">“${esc(p.better)}”</p>${p.why ? `<small>${esc(p.why)}</small>` : ''}</li>`).join('')}</ol></div>` : ''}
    ${r.escalation?.length ? `<div class="os-aisec os-esc"><h4>Calling for senior help</h4><ul role="list">${r.escalation.map(e => `<li><span class="os-escto">${esc(e.to)}</span><p>“${esc(e.line)}”</p></li>`).join('')}</ul></div>` : ''}
    ${sentences.length ? `<details class="os-aisec os-aifull"><summary><h4>Full feedback</h4>${I.chevD}</summary>${sentences.map(x => `<p>${esc(x)}</p>`).join('')}</details>` : ''}
    <div class="os-airow"><small class="os-aimeta">${esc(r.model || 'AI')}${r.markedAt ? ` · ${esc(ago(Date.parse(r.markedAt) || now()))}` : ''} · <button class="os-link" data-os="aireset" data-aid="${esc(a.id)}">Mark again</button></small>
      <button class="os-btn os-primary" data-os="aiapply" data-aid="${esc(a.id)}"${ai.applied ? ' disabled' : ''}>${ai.applied ? 'Ticked on the checklist' : 'Tick these on the checklist'}</button></div>
  </section>`;
}
/* Handover add-on (2026-10-20): end any station with an ISBAR handover, management, discharge plan and safety netting for
   extra practice. Stefan's notes per field (saved on the attempt, every device), and the marker's model handover for this
   case behind "Show model" once the station is AI-marked. */
const HAND_HINT = { identify: 'Your name, role and ward; who you are calling about', situation: 'What is happening now, in one line',
  background: 'Relevant history, risk factors, what has been done', assessment: 'Obs and findings, your working diagnosis',
  recommendation: 'What you need from them, and by when', management: 'The plan: investigations, treatment, monitoring',
  discharge: 'Disposition, criteria to go home, follow-up', safety: 'Specific red flags and when to come back' };
export function handHtml(a) {
  const mine = a.hand || {}, model = a.ai?.status === 'done' ? a.ai.result?.handover || {} : {}, hasModel = HANDOVER.some(([k]) => model[k]);
  const filled = HANDOVER.filter(([k]) => mine[k]).length;
  return `<details class="os-hand"${filled ? ' open' : ''}><summary>${I.note}<span class="os-handt"><strong>Handover add-on</strong><small>ISBAR · management · discharge · safety netting${filled ? ` · ${filled} of ${HANDOVER.length} done` : ''}</small></span>${I.chevD}</summary>
    <div class="os-handbody">
      <p class="os-handhint">End the station by handing over to a senior as if on the phone. Say it aloud, jot the key words, then compare with the model.</p>
      ${HANDOVER.map(([k, l, name]) => `<div class="os-hfield"><label for="hand-${esc(a.id)}-${k}"><span class="os-hk">${l}</span>${name}</label>
        <textarea id="hand-${esc(a.id)}-${k}" rows="2" data-hand="${k}" data-aid="${esc(a.id)}" placeholder="${esc(HAND_HINT[k])}">${esc(mine[k] || '')}</textarea>
        ${model[k] ? `<details class="os-hmodel"><summary>Show model</summary><p>${esc(model[k])}</p></details>` : ''}</div>`).join('')}
      ${hasModel ? '' : '<p class="os-handhint">The model handover appears here once the station is AI-marked.</p>'}
    </div></details>`;
}
/* Memory aids (2026-10-20): the last thing on the marking sheet, closed by default; inside, "This station" (the aids
   this case names) and then every aid by group, each a fold of its own, letter by letter */
export function memHtml(st) {
  const groups = mnemonicsFor(st); if (!groups.length) return '';
  const own = groups[0].group === 'station' ? groups[0].items.length : 0;
  const aid = m => `<details class="os-mn"><summary><span class="os-mnname">${esc(m.name)}</span><small>${esc(m.what)}</small>${I.chevD}</summary>
    <ol class="os-mnl">${m.letters.map(([l, t]) => `<li><span class="os-mnk">${esc(l)}</span><span>${esc(t)}</span></li>`).join('')}</ol></details>`;
  return `<details class="os-mem"><summary>${I.marker}<span class="os-handt"><strong>Memory aids</strong><small>${own ? `${own} for this station · ` : ''}mnemonics for histories, examinations and emergencies</small></span>${I.chevD}</summary>
    <div class="os-membody">${groups.map((g, i) => `<details class="os-mg"${i === 0 && g.group === 'station' ? ' open' : ''}><summary><span>${esc(g.label)}</span><small>${g.items.length}</small>${I.chevD}</summary>
      <div class="os-mgl">${g.items.map(aid).join('')}</div></details>`).join('')}</div></details>`;
}
export function onHand(t) {
  const a = findAttempt(t.dataset.aid); if (!a) return;
  a.hand = { ...(a.hand || {}), [t.dataset.hand]: t.value.slice(0, 1200) }; save();
  t.style.height = 'auto'; t.style.height = `${t.scrollHeight}px`;
  const n = HANDOVER.filter(([k]) => a.hand[k]).length, sm = t.closest('.os-hand')?.querySelector('.os-handt small');
  if (sm) sm.textContent = `ISBAR · management · discharge · safety netting${n ? ` · ${n} of ${HANDOVER.length} done` : ''}`;
}
/* the marking container(s) on screen, repainted in place (a finished station may show it in the pane and in the tab) */
function aiRepaint(a) {
  const st = ctx.byId.get(a.sid);
  ctx.ov.querySelectorAll('.os-marking').forEach(el => {
    const editable = ctx.view === 'session';
    el.outerHTML = markingHtml(st, a, editable);
  });
  syncIndeterminate();
}
const shownAttempt = () => (ctx.view === 'session' ? curAttempt() : ctx.view === 'attempt' ? findAttempt(ctx.reviewId) : null);
/* the transcript and reply textareas: keep the drafts (a repaint must not lose them), count, enable the buttons */
export function onAiInput(t) {
  const a = shownAttempt(); if (!a) return;
  const box = t.closest('.os-aibody'); if (!box) return;
  if (t.dataset.ai === 'reply') {
    aiReply[a.id] = t.value;
    box.querySelector('[data-os="aipaste"]').disabled = !t.value.trim();
  } else {
    aiDraft[a.id] = t.value.slice(0, AI_MAX);
    box.querySelector('.os-aicount').textContent = `${aiDraft[a.id].length.toLocaleString()} / ${AI_MAX.toLocaleString()}`;
    box.querySelectorAll('[data-os="aisend"], [data-os="aicopy"]').forEach(b => { b.disabled = aiDraft[a.id].trim().length < 1 || !!aiBusy[a.id]; });
  }
  t.closest('.os-notepad')?.classList.toggle('filled', !!t.value);
}
/* a result in hand: on the attempt, the checklist ticked when nobody ticked it yet, saved, repainted */
function aiDone(a, result) {
  a.ai = { status: 'done', result, applied: false, at: now() };
  autoTick(a);
  delete aiDraft[a.id]; delete aiReply[a.id];
  save();
  aiRepaint(a);
  const st = ctx.byId.get(a.sid);
  notify(`AI marked · ${osceAiTicks(st.check, result.items).length} of ${osceScore(st.check, []).of}`, 'success');
}
/* Mark with Claude: the transcript and the checklist to the Messages API with the key saved on this device */
export async function aiSend(aid) {
  const a = findAttempt(aid), st = a && ctx.byId.get(a.sid), tx = (aiDraft[aid] || '').trim().slice(0, AI_MAX);
  if (!a || !st || !tx || aiBusy[aid] || a.ai?.status === 'done') return;
  if (!aiEnabled()) return notify('Add an Anthropic API key in Settings to mark here, or use a Claude chat.', 'danger');
  aiBusy[aid] = true; aiRepaint(a);
  try { aiDone(a, await markDirect(st, tx, markerCfg())); }
  catch (e) { notify(e?.status === 401 ? 'The API key was not accepted. Check it in Settings.' : e?.message && !e.status ? e.message : 'Could not mark the transcript. Check the connection and try again.', 'danger'); }
  finally { delete aiBusy[aid]; if (a.ai?.status !== 'done') aiRepaint(a); }
}
/* the chat path: one prompt on the clipboard, the reply pasted back */
export async function aiCopy(aid) {
  const a = findAttempt(aid), st = a && ctx.byId.get(a.sid), tx = (aiDraft[aid] || '').trim();
  if (!a || !st || !tx) return;
  try { await navigator.clipboard.writeText(markPromptText(st, tx)); notify('Prompt copied. Paste it into a Claude chat, then paste the reply below.', 'success'); }
  catch { notify('Could not copy. Allow clipboard access and try again.', 'danger'); }
  const fold = ctx.ov.querySelector('.os-aichat'); if (fold) fold.open = true;
}
export function aiPaste(aid) {
  const a = findAttempt(aid); if (!a) return;
  const r = parseReply(aiReply[aid]);
  if (!r) return notify('That reply has no marking in it. Paste the whole JSON Claude sent back.', 'danger');
  aiDone(a, r);
}
/* Apply AI marks: leaf ticks only, the global impression, the feedback under its heading (own words kept) */
export function aiApply(aid) {
  const a = findAttempt(aid), st = a && ctx.byId.get(a.sid);
  if (!a || !st || a.ai?.status !== 'done' || !a.ai.result) return;
  const r = a.ai.result;
  a.ticks = osceAiTicks(st.check, r.items);
  if (r.global != null) a.global = r.global;
  a.fb = osceAiFeedback(a.fb, r.feedback);
  a.ai.applied = true;
  if (ctx.view === 'session' && !sess().done.includes(a.id)) sess().done.push(a.id);
  save();
  aiRepaint(a);
  notify(`AI marks applied · ${a.ticks.length} of ${osceScore(st.check, []).of}`);
}
/* marks that arrive on an attempt Stefan has not ticked himself tick the checklist straight away (2026-10-20: "it should
   physically check off the right sections"); his own ticks are never overwritten: then the button applies them */
export function autoTick(a) {
  const st = ctx.byId.get(a.sid), r = a.ai?.result;
  if (!st?.check || !r || (a.ticks || []).length || a.ai.applied) return false;
  a.ticks = osceAiTicks(st.check, r.items);
  if (r.global != null && a.global == null) a.global = r.global;
  a.ai.applied = true;
  return true;
}
export function aiEvidence() { evid = !evid; const a = shownAttempt(); if (a) aiRepaint(a); }
/* Try again after a failure, or Mark again over a result (the ticks stay as they are) */
export function aiReset(aid) { const a = findAttempt(aid); if (!a || !a.ai) return; delete a.ai; save(); aiRepaint(a); }
