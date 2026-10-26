/* duel.mjs: Duel a Mate. Live MCQ duels between the two of you on the bank's differentials, with the Pup Duel
   package vendored in js/vendor/pup-duel (never edited here: change the package and vendor again; npm test checks).

   The questions are public/duel/pack.json (scripts/build-duel-pack.mjs, one per station: its likely diagnosis
   against its own differential). With config.js naming a Supabase project, and supabase/migrations/0002_pup_duel.sql
   run in it, each of you signs in with a name and a 4-digit PIN and challenges the other; a move reaches the other
   phone within 5 seconds. Without one, practice against the bot on this device.

   The overlay is the kit's (createOverlay: one key owner, focus back to the opener); the duel renders inside it and
   takes its keys through ui.key(). */

import { createOverlay } from '../study-kit/overlay.mjs';

let shell = null, ui = null, pack = null;

async function loadPack(normPack) {
  if (pack) return pack;
  const r = await fetch('./duel/pack.json', { cache: 'no-cache' });
  if (!r.ok) throw new Error(`duel/pack.json ${r.status}`);
  pack = normPack(await r.json()).pack;
  return pack;
}

export async function openDuel(opener) {
  if (shell?.isOpen) return;
  const [{ mountDuel }, { supabaseTransport }, { normPack }] = await Promise.all([
    import('../vendor/pup-duel/ui/duel.mjs'), import('../vendor/pup-duel/duel/transport-supabase.mjs'), import('../vendor/pup-duel/duel/pack.mjs')
  ]);
  const questions = await loadPack(normPack);
  if (!shell) {
    shell = createOverlay({ cls: 'os os-duel', label: 'Duel a Mate', onKey: e => { if (ui?.key(e)) e.preventDefault(); } });
    shell.el.innerHTML = '<div class="os-duel-body"></div>';
  }
  const cfg = window.OSCE_CONFIG || {};
  const transport = cfg.supabaseUrl && cfg.supabaseAnonKey ? supabaseTransport({ url: cfg.supabaseUrl, key: cfg.supabaseAnonKey, realtime: cfg.duelRealtime !== false }) : null;
  shell.open(opener);
  ui = mountDuel(shell.el.firstElementChild, { transport, pack: questions, title: 'Duel a Mate', keys: 'host', storeKey: 'osce.duel', onClose: closeDuel,
    signOutNote: 'This also signs you out of Settings on this device: your OSCE progress stops saving to your account here.' });
  shell.el.dataset.ready = '1';
}

export function closeDuel() {
  if (!shell?.isOpen) return;
  ui?.destroy(); ui = null;
  delete shell.el.dataset.ready;
  shell.close();
}
