/* library/playlists.mjs - community playlists, the pure part (founder 2026-10-26: "spotify styled community playlist
   style library for Questions ... a completley different set to the games standard question library set"). The server
   is supabase/migrations/0011_playlists.sql; the screens are osce/playlists-view.mjs. Pure, tested in node. */
import { duelQuestion } from './mix.mjs';

export const SORTS = Object.freeze([
  { id: 'trending', label: 'Trending' }, { id: 'new', label: 'New' }, { id: 'top', label: 'Top' }, { id: 'faves', label: 'Favourites' }, { id: 'mine', label: 'Yours' }
]);
export const sortOf = id => (SORTS.some(s => s.id === id) ? id : 'trending');
export const LIMITS = Object.freeze({ title: 60, blurb: 200, questions: 100 });

/* a cover: two colours from the playlist's seed (the same playlist always looks the same), as a CSS gradient. Hues are
   spread by the golden angle so neighbours in a list differ; saturation and lightness stay where white text reads */
export function cover(seed) {
  const n = Math.abs(Math.floor(Number(seed) || 0)), h1 = (n * 137.508) % 360, h2 = (h1 + 38 + (n % 5) * 9) % 360;
  return { a: `hsl(${h1.toFixed(0)} 62% 46%)`, b: `hsl(${h2.toFixed(0)} 70% 32%)`, css: `linear-gradient(135deg, hsl(${h1.toFixed(0)} 62% 46%), hsl(${h2.toFixed(0)} 70% 32%))` };
}

/* a playlist's questions as duel questions (the vendored package's pack format), tagged as a student's */
export const toDuel = (questions = []) => (Array.isArray(questions) ? questions : []).filter(it => it && typeof it.stem === 'string' && Array.isArray(it.options))
  .map(it => ({ ...duelQuestion(it, 'friends'), source: 'user', deck: undefined }));

/* "1.2k", "980", "1" */
export const count = n => { const v = Math.max(0, Math.floor(Number(n) || 0)); return v >= 1e4 ? `${Math.round(v / 1e3)}k` : v >= 1e3 ? `${(v / 1e3).toFixed(1).replace(/\.0$/, '')}k` : String(v); };

/* a title and blurb as typed, cleaned the way the server cleans them: '' when fine, else the reason */
export const clean = s => String(s ?? '').replace(/\s+/g, ' ').trim();
export function publishError(title, blurb) {
  const t = clean(title), b = clean(blurb);
  if (!t) return 'Name the playlist.';
  if (t.length > LIMITS.title) return `A name is at most ${LIMITS.title} characters.`;
  if (b.length > LIMITS.blurb) return `The description is at most ${LIMITS.blurb} characters.`;
  if (/<\s*\/?\s*[a-z][^>]*>/i.test(`${t} ${b}`)) return 'Plain text only.';
  return '';
}
