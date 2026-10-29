/* duel.mjs: Duel a Mate. Live MCQ duels between the two of you on the bank's differentials, with the Pup Duel
   package vendored in js/vendor/pup-duel (never edited here: change the package and vendor again; npm test checks).

   The questions are public/duel/pack.json (scripts/build-duel-pack.mjs, one per station: its likely diagnosis
   against its own differential). With config.js naming a Supabase project, and supabase/migrations/0002_pup_duel.sql
   run in it, each of you signs in with a name and a 4-digit PIN and challenges the other; a move reaches the other
   phone within 5 seconds. Without one, practice against the bot on this device.

   The overlay is the kit's (createOverlay: one key owner, focus back to the opener); the duel renders inside it and
   takes its keys through ui.key(). */

import { createOverlay } from '../study-kit/overlay.mjs';
import { current as libNow, allItems } from '../library/api.mjs';
import { mixPack, placePack } from '../library/mix.mjs';
import { ctx } from './state.mjs';
import { placementSpecs, placementName } from './core.mjs';

let shell = null, ui = null, bank = null;

/* the bank (fetched once), with Your questions and your friends' shared decks added as decks to choose from
   (docs/library.md: "duel with a mix of each other's questions"); the library is read fresh each time the duel opens */
async function loadPack(normPack) {
  if (!bank) {
    const r = await fetch('./duel/pack.json', { cache: 'no-cache' });
    if (!r.ok) throw new Error(`duel/pack.json ${r.status}`);
    bank = await r.json();
  }
  const all = allItems(libNow());
  return normPack(placePack(mixPack(bank, all.filter(x => !x.owner).map(x => x.item), all.filter(x => x.owner).map(x => x.item)), placementSpecs(ctx.mem), placementName(ctx.mem))).pack;
}
/* the decks the duel offers now, with their counts (the e2e reads it) */
export async function packDecks() {
  const { normPack, decksOf } = await import('../vendor/pup-duel/duel/pack.mjs');
  return decksOf(await loadPack(normPack)).map(({ id, count }) => ({ id, count }));
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
  /* Playlists (osce/playlists-view.mjs): the community library, opened from the duel's question picker; a playlist played
     there takes the bank's place for that game (the package's ui.playlist) */
  const onPlaylists = ({ mate }) => import('./playlists-view.mjs').then(m => m.openPlaylists({ onPlay: (qs, name) => ui?.playlist(qs, name, { mate }) }));
  ui = mountDuel(shell.el.firstElementChild, { transport, pack: questions, title: 'Duel a Mate', keys: 'host', storeKey: 'osce.duel', onClose: closeDuel, onPlaylists,
    signOutNote: 'This also signs you out of Settings on this device: your OSCE progress stops saving to your account here.' });
  shell.el.dataset.ready = '1';
}

/* a playlist from outside the duel (Your questions' Playlists): open the duel and play it against the AI */
export async function openDuelWith(questions, name, opener) {
  await openDuel(opener);
  /* after the duel's first screen is up (its lobby or sign-in): playing before it would have the lobby's first paint
     close the playlist's sheet */
  for (let i = 0; i < 100 && !shell?.el.querySelector('.pd-lobby, .pd-auth, form[data-pd="signin"]'); i++) await new Promise(r => setTimeout(r, 50));
  await new Promise(r => setTimeout(r, 120));
  return ui?.playlist(questions, name) ?? false;
}

export function closeDuel() {
  if (!shell?.isOpen) return;
  ui?.destroy(); ui = null;
  delete shell.el.dataset.ready;
  shell.close();
}
