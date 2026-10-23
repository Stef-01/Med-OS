/* osce/settings.mjs - the Settings dialog: AI marking on this device (an Anthropic API key and the model), whether
   progress is shared between your devices (config.js), and a progress file to export and import, so two of you can
   share attempts with no server at all. */
import { esc } from '../core.mjs';
import { enabled as syncOn, state as syncState } from '../study-kit/sync.mjs';
import { osceMergeImport } from './core.mjs';
import { ctx, save, notify, openDialog, closeDialog, topDialog, markerCfg, setMarkerCfg, DEFAULT_MODEL, nameOf } from './state.mjs';

export const MODELS = [['claude-opus-5-5', 'Claude Opus 5.5 (best marking)'], ['claude-sonnet-5-5', 'Claude Sonnet 5.5 (faster, cheaper)'], ['claude-haiku-5-5', 'Claude Haiku 5.5 (cheapest)']];

export function settingsDlg() {
  const c = markerCfg();
  const sync = syncOn() ? `Shared between your devices${syncState.unsynced ? ' · some changes are still waiting to upload' : ''}.` : 'On this device only. Set a Supabase project in config.js to share between devices, or use a progress file below.';
  const d = openDialog({ kind: 'settings', title: 'Settings', cls: 'os-dlg--small', action: '<button class="os-btn os-primary" data-os="ssave">Save</button>',
    body: `<form class="os-set">
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

/* the progress file: attempts, saved stations and names; the running session and this device's settings stay out */
export function exportFile() {
  const { hist, bm, people } = ctx.mem;
  const blob = new Blob([JSON.stringify({ kind: 'osce-progress', v: 1, exportedAt: new Date().toISOString(), people, hist, bm })], { type: 'application/json' });
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
  Object.assign(ctx.mem, { hist: mem.hist, bm: mem.bm, people: mem.people });
  save();
  closeDialog(true);
  notify(added ? `Imported ${added} attempt${added === 1 ? '' : 's'}.` : 'Nothing new in that file.', added ? 'success' : '');
  ctx.render();
}
