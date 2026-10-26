/* osce/settings.mjs - the Settings dialog: your account (one sign-in for OSCE progress and Duel a Mate, osce/account.mjs),
   the games Start shows (each off until switched on here), AI marking on this device (an Anthropic API key and the
   model), and a progress file to export and import, so two of you can share attempts with no server at all. */
import { esc } from '../core.mjs';
import { enabled as syncOn, state as syncState } from '../study-kit/sync.mjs';
import { osceMergeImport, GAMES, osceGames } from './core.mjs';
import { account, accountsOn, signIn, signOut, duelStats, nameError, pinError } from './account.mjs';
import { tierOf } from '../vendor/pup-duel/duel/ranked.mjs';
import { ctx, save, notify, openDialog, closeDialog, topDialog, markerCfg, setMarkerCfg, DEFAULT_MODEL, nameOf } from './state.mjs';

export const MODELS = [['claude-opus-5-5', 'Claude Opus 5.5 (best marking)'], ['claude-sonnet-5-5', 'Claude Sonnet 5.5 (faster, cheaper)'], ['claude-haiku-5-5', 'Claude Haiku 5.5 (cheapest)']];

/* the account: sign in (or make one), or who you are and what is kept: your OSCE record and your duel */
function accountHtml() {
  if (!accountsOn()) return '';
  const a = account();
  if (!a) return `<section class="os-acct"><h3>Account</h3>
    <p class="os-handhint">Sign in to keep your OSCE progress and your Duel a Mate progress on every device. A name and a 4-digit PIN, the same as the duel's.</p>
    <label class="os-setf"><span>Name</span><input data-set="aname" autocomplete="username" autocapitalize="words" maxlength="20" spellcheck="false"></label>
    <label class="os-setf"><span>PIN</span><input data-set="apin" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="4" autocomplete="current-password"></label>
    <p class="os-err" role="alert" data-set="aerr"></p>
    <div class="os-crow"><button type="button" class="os-btn os-primary" data-set="ain">Sign in</button><button type="button" class="os-btn" data-set="anew">New account</button></div>
  </section>`;
  const { hist } = ctx.mem, tried = Object.values(hist || {}).filter(l => (l || []).some(x => x.fin)).length;
  const marked = Object.values(hist || {}).filter(l => (l || []).some(x => x.fin && x.ai?.status === 'done')).length;
  return `<section class="os-acct"><h3>Account</h3>
    <p class="os-acctwho">Signed in as <b>${esc(a.name || 'you')}</b></p>
    <dl class="os-acctstats">
      <div><dt>OSCE</dt><dd>${tried} station${tried === 1 ? '' : 's'} attempted${marked ? `, ${marked} AI-marked` : ''}</dd></div>
      <div><dt>Duel a Mate</dt><dd data-set="aduel">Loading…</dd></div>
    </dl>
    <p class="os-handhint">${syncState.unsynced ? 'Some changes are still waiting to upload.' : 'Saved to your account: sign in on another device to pick up where you left off.'}</p>
    <button type="button" class="os-link" data-set="aout">Sign out on this device</button>
  </section>`;
}
/* the games on Start: a switch each, off until turned on */
function gamesHtml() {
  const on = osceGames(ctx.mem);
  return `<section><h3>Games</h3>
    ${GAMES.map(g => `<button type="button" class="os-switch" role="switch" aria-checked="${on[g.id]}" data-set="game" data-game="${g.id}">
      <span class="os-switch-tx"><strong>${esc(g.name)}${g.beta ? ' <span class="os-beta">Beta</span>' : ''}</strong><span>${esc(g.line)} ${on[g.id] ? 'On the start screen.' : 'Off: switch it on to add it to the start screen.'}</span></span>
      <span class="os-switch-ui" aria-hidden="true"></span></button>`).join('')}
  </section>`;
}

export function settingsDlg() {
  const c = markerCfg(), a = account();
  const sync = a ? 'Kept on your account (above).' : syncOn() ? `Shared between your devices${syncState.unsynced ? ' · some changes are still waiting to upload' : ''}. Sign in above to keep it on your own account.` : 'On this device only. Set a Supabase project in config.js to share between devices, or use a progress file below.';
  const d = openDialog({ kind: 'settings', title: 'Settings', cls: 'os-dlg--small', action: '<button class="os-btn os-primary" data-os="ssave">Save</button>',
    body: `<form class="os-set">
      ${accountHtml()}
      ${gamesHtml()}
      <section><h3>AI marking</h3>
        <p class="os-handhint">With your own Anthropic API key, Claude marks a pasted transcript here against the station's checklist. The key stays in this browser. Without one, the marking sheet copies a prompt for a Claude chat instead.</p>
        <label class="os-setf"><span>API key</span><input type="password" data-set="key" value="${esc(c.key)}" placeholder="sk-ant-..." autocomplete="off" spellcheck="false"></label>
        <label class="os-setf"><span>Model</span><select data-set="model">${MODELS.map(([v, l]) => `<option value="${v}"${v === c.model ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select></label>
        ${c.key ? '<button type="button" class="os-link os-dangerlink" data-os="skeyclear">Remove the key from this device</button>' : ''}
      </section>
      <section><h3>Progress</h3>
        <p class="os-handhint">${esc(sync)}</p>
        <div class="os-crow"><button type="button" class="os-btn" data-os="sexport">Export progress</button>
          <label class="os-btn os-filebtn">Import progress<input type="file" accept="application/json,.json" data-set="import" hidden></label></div>
      </section></form>` });
  d.el.querySelector('form').addEventListener('submit', e => { e.preventDefault(); saveSettings(); });
  d.el.querySelector('[data-set="import"]').addEventListener('change', e => importFile(e.target.files?.[0]));
  wireAccount(d.el); wireGames(d.el);
}

function wireGames(el) {
  el.querySelectorAll('[data-set="game"]').forEach(b => b.addEventListener('click', () => {
    const id = b.dataset.game, on = b.getAttribute('aria-checked') !== 'true', g = GAMES.find(x => x.id === id);
    ctx.mem.games = { ...(ctx.mem.games || {}), [id]: on };
    save();
    b.setAttribute('aria-checked', String(on));
    b.querySelector('.os-switch-tx > span').textContent = `${g.line} ${on ? 'On the start screen.' : 'Off: switch it on to add it to the start screen.'}`;
    notify(on ? `${g.name} is on the start screen.` : `${g.name} is off.`, on ? 'success' : '');
    ctx.render();
  }));
}
function wireAccount(el) {
  const sec = el.querySelector('.os-acct'); if (!sec) return;
  const repaint = () => { sec.outerHTML = accountHtml(); wireAccount(el); el.querySelector('.os-acct button, .os-acct input')?.focus({ preventScroll: true }); ctx.render(); };
  const go = async create => {
    const name = sec.querySelector('[data-set="aname"]').value, pin = sec.querySelector('[data-set="apin"]').value, err = sec.querySelector('[data-set="aerr"]');
    const bad = nameError(name) || pinError(pin);
    if (bad) { err.textContent = bad; return; }
    sec.querySelectorAll('button').forEach(b => { b.disabled = true; });
    try { const p = await signIn(name, pin, create); notify(`Signed in as ${p.name}. Your progress is kept on your account.`, 'success'); repaint(); }
    catch (e) { err.textContent = e.message || 'That did not work. Try again.'; sec.querySelectorAll('button').forEach(b => { b.disabled = false; }); }
  };
  sec.querySelector('[data-set="ain"]')?.addEventListener('click', () => go(false));
  sec.querySelector('[data-set="anew"]')?.addEventListener('click', () => go(true));
  sec.querySelectorAll('[data-set="apin"], [data-set="aname"]').forEach(i => i.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); go(false); } }));   // Enter signs in, it does not save and close
  sec.querySelector('[data-set="aout"]')?.addEventListener('click', async () => { await signOut(); notify('Signed out on this device.'); repaint(); });
  const dd = sec.querySelector('[data-set="aduel"]');
  if (dd) duelStats().then(st => {
    if (!dd.isConnected) return;
    if (!st) { dd.textContent = 'Not played yet'; return; }
    const t = st.rating != null ? tierOf(st.rating, st.ranked) : null;
    const lines = [t ? (t.placing ? `${st.rating} rating, placing` : `${t.name}, ${st.rating} rating`) : '', `${st.wins} won, ${st.losses} lost${st.draws ? `, ${st.draws} drawn` : ''}`, st.bones != null ? `${st.bones} bones` : ''].filter(Boolean);
    dd.replaceChildren(...lines.map(l => Object.assign(document.createElement('span'), { textContent: l })));   /* one fact a line */
  }, () => { if (dd.isConnected) dd.textContent = "Can't reach the duel right now."; });
}

export function saveSettings() {
  const d = topDialog(); if (!d || d.kind !== 'settings') return;
  const key = d.el.querySelector('[data-set="key"]').value, model = d.el.querySelector('[data-set="model"]').value || DEFAULT_MODEL;
  if (key && !/^sk-ant-[\w-]{10,}$/.test(key.trim())) return notify('That does not look like an Anthropic API key (sk-ant-…).', 'danger');
  setMarkerCfg({ key, model });
  closeDialog();
  notify(key ? 'Saved. Claude can mark transcripts on this device.' : 'Saved.', 'success');
  ctx.render();
}
export function clearKey() { setMarkerCfg({ key: '', model: markerCfg().model }); closeDialog(true); notify('API key removed from this device.'); ctx.render(); }

/* the progress file: attempts, saved stations, case requests and names; the running session and this device's settings
   stay out (the case writer's pipeline reads the requests from it too: node scripts/requests.mjs add <file>) */
export function exportFile() {
  const { hist, bm, people, req } = ctx.mem;
  const blob = new Blob([JSON.stringify({ kind: 'osce-progress', v: 1, exportedAt: new Date().toISOString(), people, hist, bm, req })], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `osce-progress-${nameOf(0)}-${nameOf(1)}-${new Date().toISOString().slice(0, 10)}.json`.replace(/[^\w.-]+/g, '-');
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
async function importFile(f) {
  if (!f) return;
  let j;
  try { j = JSON.parse(await f.text()); } catch { return notify('That file is not a progress file.', 'danger'); }
  if (!j || j.kind !== 'osce-progress') return notify('That file is not a progress file.', 'danger');
  const { mem, added } = osceMergeImport(ctx.mem, j);
  Object.assign(ctx.mem, { hist: mem.hist, bm: mem.bm, req: mem.req, people: mem.people });
  save();
  closeDialog(true);
  notify(added ? `Imported ${added} attempt${added === 1 ? '' : 's'}.` : 'Nothing new in that file.', added ? 'success' : '');
  ctx.render();
}
