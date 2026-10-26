/* osce/account.mjs - one sign-in for everything (founder 2026-10-25: "make progress for everything save so you login in
   settings so has osce progress plus this dual a mate progress"). The account is Duel a Mate's: a name and a 4-digit
   PIN (supabase/migrations/0002_pup_duel.sql), kept where the duel keeps it (study-kit/sync.mjs ACCOUNT_LS), so signing
   in here signs the duel in and the other way round. Signed in, sync.mjs keeps the OSCE record on the account
   (0006_osce_accounts.sql). The calls are the duel's own functions, over PostgREST, with the project in config.js. */
import { account, switchAccount, enabled } from '../study-kit/sync.mjs';

const cfg = () => (typeof window !== 'undefined' && window.OSCE_CONFIG) || {};
export const accountsOn = () => !!(cfg().supabaseUrl && cfg().supabaseAnonKey);
export { account };

/* the duel's own rules for a name and a PIN (one implementation: the vendored package's accounts.mjs) */
export { nameError, pinError, NAME_RE, PIN_RE } from '../vendor/pup-duel/duel/accounts.mjs';

async function rpc(fn, args) {
  const { supabaseUrl: url, supabaseAnonKey: key } = cfg();
  let r;
  try {
    r = await fetch(`${String(url).replace(/\/+$/, '')}/rest/v1/rpc/${fn}`, { method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: key, ...(String(key).split('.').length === 3 ? { Authorization: `Bearer ${key}` } : {}) },
      body: JSON.stringify(args) });
  } catch { throw new Error('No connection. Try again when you are online.'); }
  const j = await r.json().catch(() => null);
  if (!r.ok) throw new Error((j && (j.message || j.error)) || `That did not work (${r.status})`);
  if (j && typeof j.error === 'string') throw new Error(j.error);   /* pup_login answers a wrong PIN this way */
  return j;
}

export async function signIn(name, pin, create = false) {
  const p = create ? await rpc('pup_register', { p_name: name, p_pin: pin, p_look: {} }) : await rpc('pup_login', { p_name: name, p_pin: pin });
  await switchAccount(p);
  return p;
}
export const signOut = () => switchAccount(null);

/* the duel side of the account, for Settings: { rating, ranked, wins, losses, draws, bones } (null pieces when the
   backend has not got them) */
export async function duelStats(acc = account()) {
  if (!acc) return null;
  const [w, b] = await Promise.allSettled([rpc('pup_wallet', { p_token: acc.token }), rpc('pup_leaderboard', { p_token: acc.token })]);
  const row = b.status === 'fulfilled' && Array.isArray(b.value) ? b.value.find(p => p.id === acc.id) : null;
  if (b.status === 'rejected' && /Sign in again/.test(b.reason?.message || '')) { await signOut(); return null; }
  return { rating: row?.rating ?? null, ranked: row?.ranked ?? 0, wins: row?.wins ?? 0, losses: row?.losses ?? 0, draws: row?.draws ?? 0, bones: w.status === 'fulfilled' ? w.value?.bones ?? null : null };
}
export const syncOn = enabled;
