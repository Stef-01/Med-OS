/* osce/study-log.mjs - what a day of study puts on the leaderboard's Today tab (founder 2026-10-29: "a study session
   length leaderboard too so can show who has answered most qs in one day and time spent too in one day").

   answered(n)  a question (or n) answered: in Your questions, in a duel against a mate or the AI
   active()     a sign of study: an answer, a tick of a running station clock
   Time counts while the page is on screen and there was a sign of study in the last IDLE seconds, so an app left open
   on a desk adds nothing. What has built up goes to the account (pup_study_log, 0013_pup_study.sql) once a minute, and
   as the page is hidden; signed out it stays put until an account is there. The day is the phone's own date. */
import { account, rpc, accountsOn } from './account.mjs';

export const IDLE = 120, FLUSH = 60;
const P = { q: 0, s: 0, last: 0, tick: 0, flushing: false };
const now = () => Date.now() / 1000;
export const localDay = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/* the seconds a gap between two clock ticks adds: the gap, when the last sign of study is recent and the page is seen */
export const creditFor = (gap, sinceSign, visible) => (visible && sinceSign <= IDLE ? Math.max(0, Math.min(gap, 5)) : 0);

export function active() { P.last = now(); start(); }
export function answered(n = 1) { P.q += Math.max(0, n | 0); active(); }

function start() {
  if (P.tick || typeof window === 'undefined') return;
  let t0 = now();
  P.tick = setInterval(() => {
    const t = now(); P.s += creditFor(t - t0, t - P.last, document.visibilityState === 'visible'); t0 = t;
    if (P.s >= FLUSH || (P.q && P.s >= 10)) flush();
  }, 2000);
  addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(true); });
  addEventListener('pagehide', () => flush(true));
}

export async function flush(leaving = false) {
  const a = account(), q = P.q, s = Math.floor(P.s);
  if (!a || !accountsOn() || P.flushing || (!q && s < 1)) return;
  P.flushing = true; P.q = 0; P.s -= s;
  try { await rpc('pup_study_log', { p_token: a.token, p_answered: q, p_secs: s, p_day: localDay() }); }
  catch { if (!leaving) { P.q += q; P.s += s; } }   /* offline: kept for the next try */
  finally { P.flushing = false; }
}
